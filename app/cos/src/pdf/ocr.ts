// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// OCR: recunoașterea textului din scanări și poze, cu tesseract.js (Apache-2.0): română, engleză, maghiară, germană, franceză.
// Totul rulează local: motorul (WebAssembly) și datele limbilor sunt în aplicație, nu se descarcă nimic.
// Motorul ocupă ~150 MB de memorie cât lucrează, deci îl pornim doar la nevoie și îl oprim după.
import workerUrl from 'tesseract.js/dist/worker.min.js?url';
import coreSimd from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import corePlain from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import type { Worker } from 'tesseract.js';

/** Un modul WebAssembly minim cu instrucțiuni SIMD: dacă e valid, procesorul are varianta rapidă a motorului. */
const SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

let worker: Promise<Worker> | null = null;
let workerLang = '';

/** Limbile textului, ca în fereastra „Text din scanare”; „ron+eng” citește documentele amestecate. */
export const OCR_LANGS: [string, string][] = [['ron', 'Română'], ['ron+eng', 'Română și engleză'], ['eng', 'Engleză'], ['hun', 'Maghiară'], ['deu', 'Germană'], ['fra', 'Franceză']];
const LANG_KEY = 'suite.ocrLang';

/** Limba aleasă ultima dată (aceeași în PDF, Imagini și Notițe). */
export function ocrLang(): string {
  try { const l = localStorage.getItem(LANG_KEY); if (l && OCR_LANGS.some(([k]) => k === l)) return l; } catch { /* fără stocare: româna */ }
  return 'ron';
}

/** Schimbă limba; motorul pornit cu altă limbă se oprește și se repornește la următoarea recunoaștere. */
export function setOcrLang(l: string) {
  if (!OCR_LANGS.some(([k]) => k === l)) return;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* rămâne doar până la închidere */ }
  if (worker && workerLang !== l) void stopOcr();
}
let progress: ((p: number, status: string) => void) | null = null;

function getWorker(): Promise<Worker> {
  if (worker && workerLang !== ocrLang()) void stopOcr();
  workerLang = ocrLang();
  const lang = workerLang;
  worker ??= (async () => {
    const { createWorker, OEM } = await import('tesseract.js');
    const abs = (u: string) => new URL(u, location.href).href;
    return createWorker(lang, OEM.LSTM_ONLY, {
      workerPath: abs(workerUrl),
      corePath: abs(WebAssembly.validate(SIMD) ? coreSimd : corePlain),
      langPath: abs('tessdata'),
      // Regulile de securitate ale aplicației nu permit workeri din „blob:”; îl pornim direct din fișier.
      workerBlobURL: false,
      cacheMethod: 'none',
      gzip: true,
      logger: (m: { progress: number; status: string }) => progress?.(m.progress, m.status),
    });
  })();
  worker.catch(() => { worker = null; });
  return worker;
}

/**
 * Un cuvânt recunoscut, în pixelii imaginii: începutul pe linia de bază, lățimea și mărimea literelor,
 * plus dreptunghiul lui și numărul rândului (folosite la ascunderea datelor personale din poze).
 */
export interface PxWord {
  text: string; x: number; y: number; w: number; size: number;
  line: number; box: { x0: number; y0: number; x1: number; y1: number };
  /** Cât de sigur e OCR-ul pe cuvânt (0–100). */
  conf: number;
}

/** Un rând recunoscut: textul, marginile de sus și de jos (în pixeli) și paragraful în care l-a pus motorul. */
export interface PxLine { text: string; y0: number; y1: number; para: number }

/**
 * Textul rândurilor pe paragrafe (despărțite de un rând gol): paragraf nou unde îl vede motorul sau unde golul dintre
 * rânduri e vizibil mai mare decât cel obișnuit din poză.
 */
export function linesToParagraphs(lines: PxLine[]): string {
  if (!lines.length) return '';
  const hs = lines.map((l) => l.y1 - l.y0).sort((a, b) => a - b);
  const h = hs[hs.length >> 1] || 1;
  const gaps = lines.slice(1).map((l, i) => l.y0 - lines[i].y1).filter((g) => g >= 0).sort((a, b) => a - b);
  const usual = gaps.length ? gaps[Math.floor((gaps.length - 1) / 4)] : 0;
  let out = lines[0].text;
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i].y0 - lines[i - 1].y1;
    const big = gap > Math.max(usual * 1.6, h * 0.6);
    out += (lines[i].para !== lines[i - 1].para || big ? '\n\n' : '\n') + lines[i].text;
  }
  return out;
}

/** Textul recunoscut într-o imagine (de obicei o pagină desenată la 300 dpi) și cuvintele cu locul lor. */
export async function recognize(image: HTMLCanvasElement, onProgress?: (p: number, status: string) => void): Promise<{ text: string; words: PxWord[]; lines: PxLine[] }> {
  const w = await getWorker();
  progress = onProgress ?? null;
  try {
    const { data } = await w.recognize(image, {}, { text: true, blocks: true });
    const words: PxWord[] = [];
    const lines: PxLine[] = [];
    let lineNo = 0, paraNo = 0;
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        paraNo++;
        for (const line of para.lines) {
          lineNo++;
          const lt = line.text.replace(/\s+$/, '');
          if (lt.trim()) lines.push({ text: lt, y0: line.bbox.y0, y1: line.bbox.y1, para: paraNo });
          const b = line.baseline;
          // Linia de bază poate fi ușor înclinată: y-ul ei se calculează în dreptul fiecărui cuvânt.
          const at = (x: number) => (b.x1 > b.x0 ? b.y0 + ((b.y1 - b.y0) * (x - b.x0)) / (b.x1 - b.x0) : line.bbox.y1);
          const size = Math.max(4, (at(line.bbox.x0) - line.bbox.y0) / 0.75);
          for (const word of line.words) {
            if (!word.text.trim() || word.confidence < 20) continue;
            words.push({ text: word.text, x: word.bbox.x0, y: at(word.bbox.x0), w: word.bbox.x1 - word.bbox.x0, size, line: lineNo, box: { ...word.bbox }, conf: word.confidence });
          }
        }
      }
    }
    return { text: data.text, words, lines };
  } finally {
    progress = null;
  }
}

/** Oprește motorul și eliberează memoria. */
export async function stopOcr() {
  const w = worker;
  worker = null;
  if (w) await (await w).terminate().catch(() => {});
}
