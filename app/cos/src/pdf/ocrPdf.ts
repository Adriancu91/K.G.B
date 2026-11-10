// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// PDF căutabil dintr-o dată, fără fereastra deschisă (pentru ⚙ Lot…): fiecare pagină fără text se desenează la ~300 dpi,
// se recunoaște cu OCR în română, iar cuvintele se pun invizibil în PDF (textlayer.ts). Paginile care au deja text se sar.
import * as pdfjs from 'pdfjs-dist';
import { defuse } from './guard';
import { recognize } from './ocr';
import { addTextLayer, type OcrWord } from './textlayer';

export interface OcrPdfResult { bytes: Uint8Array; words: number; pages: number; skipped: number }

export async function ocrPdf(bytes: Uint8Array, onStatus?: (s: string) => void): Promise<OcrPdfResult> {
  // pdf.js își ia octeții pentru el (îi mută în alt fir), deci îi dăm o copie.
  const view = await pdfjs.getDocument({ data: defuse(bytes.slice()).data, isEvalSupported: false }).promise;
  const canvas = document.createElement('canvas');
  const found = new Map<number, OcrWord[]>();
  let skipped = 0;
  try {
    for (let n = 1; n <= view.numPages; n++) {
      const pg = await view.getPage(n);
      const tc = await pg.getTextContent();
      if (tc.items.map((it) => ('str' in it ? it.str : '')).join('').replace(/\s/g, '').length > 20) { skipped++; continue; }
      onStatus?.(`OCR pagina ${n} din ${view.numPages}…`);
      const base = pg.getViewport({ scale: 1 });
      // 300 dpi, dar fără imagini uriașe pe paginile mari (memoria laptopului).
      const vp = pg.getViewport({ scale: Math.min(300 / 72, 4200 / Math.max(base.width, base.height)) });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pg.render({ canvasContext: ctx, viewport: vp, intent: 'print', annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE }).promise;
      const scale = vp.width / base.width;
      const { words } = await recognize(canvas, (p, status) => onStatus?.(status === 'recognizing text' ? `OCR pagina ${n} din ${view.numPages}: ${Math.round(p * 100)}%` : `OCR pagina ${n} din ${view.numPages}…`));
      if (words.length) found.set(n, words.map((w) => ({ text: w.text, x: w.x / scale, y: w.y / scale, w: w.w / scale, size: w.size / scale })));
    }
  } finally {
    canvas.width = 0;
    await view.loadingTask.destroy();
  }
  const count = [...found.values()].reduce((s, w) => s + w.length, 0);
  return { bytes: count ? await addTextLayer(bytes, found) : bytes, words: count, pages: found.size, skipped };
}
