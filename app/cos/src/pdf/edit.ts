// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Modificări de pagini într-un PDF, cu pdf-lib (MIT): rotire și ștergere. Fiecare funcție primește octeții
// documentului și întoarce octeții noului document; originalul nu se schimbă.
import { degrees, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNull, PDFNumber, PDFObjectCopier, PDFRef, PDFString, rgb, StandardFonts } from 'pdf-lib';
import type { OutlineItem } from './outline';
import { toPdfPoint } from './sign';

/** Mesajul pentru PDF-urile criptate: pdf-lib nu le poate rescrie fără să le strice conținutul. */
export const ENCRYPTED_MSG = 'PDF-ul e protejat (criptat): îl poți citi, căuta, tipări și completa formularele. '
  + 'Ca să-i modifici paginile (rotire, ștergere, semnătură…), apasă „Elimină parola”.';

export async function open(bytes: Uint8Array): Promise<PDFDocument> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  // Și PDF-urile doar „cu restricții” (fără parolă de deschidere) sunt criptate: rescrise de pdf-lib, nu se mai deschid.
  if (doc.isEncrypted) throw new Error(ENCRYPTED_MSG);
  return doc;
}

/** Rotește paginile date (de la 0) cu 90° spre dreapta (delta = 90) sau spre stânga (delta = -90). */
export async function rotatePages(bytes: Uint8Array, pages: number[], delta: 90 | -90 | 180): Promise<Uint8Array> {
  const doc = await open(bytes);
  for (const i of pages) {
    const p = doc.getPage(i);
    p.setRotation(degrees((((p.getRotation().angle + delta) % 360) + 360) % 360));
  }
  return doc.save();
}

/** Șterge paginile date (de la 0). Cel puțin o pagină trebuie să rămână. */
export async function deletePages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const doc = await open(bytes);
  const drop = [...new Set(pages)].filter((i) => i >= 0 && i < doc.getPageCount()).sort((a, b) => b - a);
  if (drop.length >= doc.getPageCount()) throw new Error('Un PDF trebuie să aibă cel puțin o pagină.');
  for (const i of drop) doc.removePage(i);
  return doc.save();
}

/** Copiile paginilor alese (de la 0) se pun fiecare imediat după pagina ei. */
export async function duplicatePages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const doc = await open(bytes);
  // De la sfârșit spre început, ca pozițiile paginilor încă necopiate să nu se schimbe.
  for (const i of [...new Set(pages)].filter((i) => i >= 0 && i < doc.getPageCount()).sort((a, b) => b - a)) {
    const [copy] = await doc.copyPages(doc, [i]);
    doc.insertPage(i + 1, copy);
  }
  return doc.save();
}

/** Adaugă la sfârșit toate paginile altui PDF (îmbinare). */
export async function appendPdf(bytes: Uint8Array, other: Uint8Array): Promise<Uint8Array> {
  const doc = await open(bytes);
  const src = await open(other);
  const pages = await doc.copyPages(src, src.getPageIndices());
  for (const p of pages) doc.addPage(p);
  return doc.save();
}

/**
 * Paginile alese (de la 0; toate dacă lipsesc) din alt PDF se pun în acest document înainte de poziția `at` (0 = la început,
 * numărul de pagini = la sfârșit). Cu `replace`, paginile acestea (de la 0) se scot întâi, iar cele noi le iau locul
 * (ca Acrobat → Replace Pages: o pagină semnată și scanată înlocuiește pagina nesemnată).
 */
export async function insertPdf(bytes: Uint8Array, other: Uint8Array, at: number, from?: number[], replace?: number[]): Promise<Uint8Array> {
  const doc = await open(bytes);
  const src = await open(other);
  const take = (from?.length ? from : src.getPageIndices()).filter((i) => i >= 0 && i < src.getPageCount());
  if (!take.length) throw new Error('Alege cel puțin o pagină din celălalt PDF.');
  const drop = [...new Set(replace ?? [])].filter((i) => i >= 0 && i < doc.getPageCount()).sort((a, b) => b - a);
  let pos = Math.max(0, Math.min(at, doc.getPageCount()));
  for (const i of drop) { doc.removePage(i); if (i < pos) pos--; }
  const pages = await doc.copyPages(src, take);
  pages.forEach((pg, k) => doc.insertPage(pos + k, pg));
  return doc.save();
}

/** Câte pagini are un PDF (pentru fereastra de inserare); mesaj clar dacă e criptat sau stricat. */
export async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  return (await open(bytes)).getPageCount();
}

/** Un PDF nou cu o pagină albă A4 (595 × 842 puncte), în picioare sau culcată. */
export async function blankPdf(landscape = false): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage(landscape ? [842, 595] : [595, 842]);
  doc.setCreator('Cyber Office Studio');
  return doc.save();
}

/** Pune o pagină albă după pagina `after` (de la 0), de aceeași mărime și orientare cum se vede aceasta. */
export async function insertBlankPage(bytes: Uint8Array, after: number): Promise<Uint8Array> {
  const doc = await open(bytes);
  const ref = doc.getPage(Math.max(0, Math.min(after, doc.getPageCount() - 1)));
  const { width, height } = ref.getCropBox();
  const turned = ref.getRotation().angle % 180 !== 0;
  doc.insertPage(after + 1, turned ? [height, width] : [width, height]);
  return doc.save();
}

/** Mută pagina `from` pe poziția `to` (ambele de la 0). */
export async function movePage(bytes: Uint8Array, from: number, to: number): Promise<Uint8Array> {
  const doc = await open(bytes);
  const n = doc.getPageCount();
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return bytes;
  // pdf-lib nu are „mută”: copiem pagina, o ștergem de la locul vechi și punem copia la cel nou.
  const [copy] = await doc.copyPages(doc, [from]);
  doc.removePage(from);
  doc.insertPage(to, copy);
  return doc.save();
}

/**
 * „1-3, 5” → paginile [0, 1, 2, 4] (de la 0), în ordinea scrisă și fără dubluri. Se acceptă „,” „;” și spații ca
 * separatori, „-” sau „–” pentru intervale. Întoarce un mesaj de eroare în română dacă textul nu e bun.
 */
export function parseRanges(text: string, count: number): number[] | string {
  // „1 - 3” e tot un interval: lipim întâi liniuța de numere.
  const parts = text.replace(/\s*[-–]\s*/g, '-').split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) return 'Scrie paginile, de exemplu 1-3, 5.';
  const out: number[] = [];
  for (const p of parts) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(p);
    if (!m) return `„${p}” nu e un număr de pagină sau un interval (de exemplu 2-4).`;
    let a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (a > b) [a, b] = [b, a];
    if (a < 1 || b > count) return `Documentul are paginile 1–${count}; „${p}” iese din ele.`;
    for (let i = a; i <= b; i++) if (!out.includes(i - 1)) out.push(i - 1);
  }
  return out;
}

/**
 * Scrie cuprinsul (semnele de carte) în PDF, în locul celui vechi; o listă goală îl scoate. Intrările cu sub-intrări
 * apar închise (ca în Acrobat la cuprinsurile mari); fiecare duce la pagina ei, la înălțimea ținută minte, dacă există.
 */
export async function writeOutline(bytes: Uint8Array, items: OutlineItem[]): Promise<Uint8Array> {
  const doc = await open(bytes);
  const ctx = doc.context;
  const pages = doc.getPages();
  const build = (list: OutlineItem[], parent: PDFRef) => {
    const refs = list.map(() => ctx.nextRef());
    list.forEach((it, i) => {
      const d = ctx.obj({}) as PDFDict;
      d.set(PDFName.of('Title'), PDFHexString.fromText(it.title));
      d.set(PDFName.of('Parent'), parent);
      if (i > 0) d.set(PDFName.of('Prev'), refs[i - 1]);
      if (i + 1 < list.length) d.set(PDFName.of('Next'), refs[i + 1]);
      const pg = it.page != null ? pages[it.page - 1] : undefined;
      if (pg) d.set(PDFName.of('Dest'), ctx.obj([pg.ref, PDFName.of('XYZ'), PDFNull, it.top != null ? PDFNumber.of(it.top) : PDFNull, PDFNull]));
      if (it.items.length) {
        const sub = build(it.items, refs[i]);
        d.set(PDFName.of('First'), sub.first);
        d.set(PDFName.of('Last'), sub.last);
        d.set(PDFName.of('Count'), PDFNumber.of(-it.items.length));
      }
      ctx.assign(refs[i], d);
    });
    return { first: refs[0], last: refs[refs.length - 1] };
  };
  if (!items.length) doc.catalog.delete(PDFName.of('Outlines'));
  else {
    const root = ctx.nextRef();
    const r = build(items, root);
    ctx.assign(root, ctx.obj({ Type: 'Outlines', First: r.first, Last: r.last, Count: items.length }));
    doc.catalog.set(PDFName.of('Outlines'), root);
  }
  return doc.save();
}

/** Un PDF nou doar cu paginile date (de la 0), în ordinea dată. */
export async function extractPages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await open(bytes);
  const doc = await PDFDocument.create();
  for (const p of await doc.copyPages(src, pages)) doc.addPage(p);
  return doc.save();
}

/** Paginile [1, 2, 3, 5] → textul „1-3, 5” (pentru fereastra Extrage pagini). */
export function rangesText(pages: number[]): string {
  const s = [...new Set(pages)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${s[i]}-${s[j]}` : String(s[i]));
    i = j;
  }
  return out.join(', ');
}
/** Tipul unei imagini după primii octeți: doar JPG și PNG se pot pune direct într-un PDF. */
export function imageKind(data: Uint8Array): 'jpg' | 'png' | null {
  if (data[0] === 0xff && data[1] === 0xd8) return 'jpg';
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'png';
  return null;
}

const A4: [number, number] = [595.28, 841.89];

/**
 * Imagini (poze, scanări) → pagini A4, câte o imagine pe pagină, cât mai mare și centrată; pagina e culcată dacă poza
 * e mai lată decât înaltă. Cu `base`, paginile se adaugă la sfârșitul acelui PDF; altfel se face unul nou.
 */
export async function imagesToPdf(images: Uint8Array[], base?: Uint8Array): Promise<Uint8Array> {
  const doc = base ? await open(base) : await PDFDocument.create();
  for (const data of images) await addImagePage(doc, data);
  return doc.save();
}

/** O imagine JPG / PNG ca pagină A4 nouă la sfârșitul documentului (culcată dacă poza e mai lată decât înaltă). */
async function addImagePage(doc: PDFDocument, data: Uint8Array) {
  const kind = imageKind(data);
  if (!kind) throw new Error('Se pot adăuga doar imagini JPG și PNG.');
  const img = kind === 'jpg' ? await doc.embedJpg(data) : await doc.embedPng(data);
  const [w, h] = img.width > img.height ? [A4[1], A4[0]] : A4;
  const s = Math.min(w / img.width, h / img.height);
  const page = doc.addPage([w, h]);
  page.drawImage(img, { x: (w - img.width * s) / 2, y: (h - img.height * s) / 2, width: img.width * s, height: img.height * s });
}

/** Un fișier de combinat: un PDF (cu paginile alese, de la 0; toate dacă lipsesc) sau o imagine JPG / PNG (o pagină A4). */
export interface CombineItem { name: string; data: Uint8Array; pages?: number[] }

/**
 * Combină mai multe fișiere într-un PDF nou, în ordinea dată: din fiecare PDF intră paginile alese (în ordinea scrisă),
 * fiecare imagine devine o pagină. Un PDF cu parolă oprește combinarea, cu numele lui în mesaj.
 */
export async function combineFiles(items: CombineItem[]): Promise<Uint8Array> {
  if (!items.length) throw new Error('Alege cel puțin un fișier.');
  const doc = await PDFDocument.create();
  // Fișierele atașate ale fiecărui PDF (XML-ul unei facturi, atașamentele unui e-mail) trec și ele în PDF-ul combinat.
  const files: [string, PDFRef][] = [];
  for (const it of items) {
    if (imageKind(it.data)) { await addImagePage(doc, it.data); continue; }
    // pdf-lib citește unele părți abia la copiere, deci și copierea paginilor stă sub același mesaj.
    try {
      const src = await open(it.data);
      const take = (it.pages?.length ? it.pages : src.getPageIndices()).filter((i) => i >= 0 && i < src.getPageCount());
      for (const p of await doc.copyPages(src, take)) doc.addPage(p);
      try {
        const copier = PDFObjectCopier.for(src.context, doc.context);
        for (const [name, spec] of embeddedFiles(src)) files.push([name, doc.context.register(copier.copy(spec))]);
      } catch { /* un arbore de atașamente stricat nu oprește combinarea */ }
    } catch (e) {
      throw new Error(`„${it.name}”: ${(e as Error).message === ENCRYPTED_MSG ? 'are parolă sau restricții; deschide-l întâi cu parola și salvează-l fără ea.' : 'nu e un PDF bun.'}`);
    }
  }
  if (!doc.getPageCount()) throw new Error('Nicio pagină de combinat.');
  if (files.length) {
    // Numele trebuie să fie unice și în ordine în arborele de nume: „factura.xml”, „factura (2).xml”…
    const taken = new Set<string>(), named: [string, PDFRef][] = [];
    for (const [name, ref] of files) {
      let n = name, k = 2;
      const dot = name.lastIndexOf('.'), stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
      while (taken.has(n)) n = `${stem} (${k++})${ext}`;
      taken.add(n);
      // Programele arată numele din specificație (UF / F), nu cheia din arbore: îl scriem și acolo.
      const spec = doc.context.lookup(ref);
      if (n !== name && spec instanceof PDFDict) { spec.set(PDFName.of('UF'), PDFHexString.fromText(n)); spec.set(PDFName.of('F'), PDFString.of(n.replace(/[^ -~]/g, '_'))); }
      named.push([n, ref]);
    }
    named.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const arr = doc.context.obj([]) as PDFArray;
    for (const [n, ref] of named) { arr.push(PDFHexString.fromText(n)); arr.push(ref); }
    doc.catalog.set(PDFName.of('Names'), doc.context.obj({ EmbeddedFiles: doc.context.obj({ Names: arr }) }));
  }
  return doc.save();
}

/** Fișierele atașate documentului (Names → EmbeddedFiles, cu tot cu ramuri Kids): numele și specificația fiecăruia. */
function embeddedFiles(src: PDFDocument): [string, PDFDict][] {
  const out: [string, PDFDict][] = [];
  const names = src.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  const walk = (node: PDFDict | undefined, depth: number) => {
    if (!node || depth > 20) return;
    const list = node.lookupMaybe(PDFName.of('Names'), PDFArray);
    if (list) {
      for (let i = 0; i + 1 < list.size(); i += 2) {
        const key = list.lookup(i), spec = list.lookup(i + 1);
        if ((key instanceof PDFString || key instanceof PDFHexString) && spec instanceof PDFDict) out.push([key.decodeText() || 'atasament', spec]);
      }
    }
    const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray);
    if (kids) for (let i = 0; i < kids.size(); i++) { const k = kids.lookup(i); if (k instanceof PDFDict) walk(k, depth + 1); }
  };
  walk(names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict), 0);
  return out;
}

/** Pune fișierele date ca atașamente în PDF (de exemplu atașamentele unui e-mail făcut PDF); numele care se repetă primesc „ (2)”. */
export async function attachAll(bytes: Uint8Array, files: { name: string; type: string; data: Uint8Array }[]): Promise<Uint8Array> {
  if (!files.length) return bytes;
  const doc = await PDFDocument.load(bytes);
  const taken = new Set<string>(), now = new Date();
  for (const f of files) {
    let n = f.name, k = 2;
    const dot = f.name.lastIndexOf('.'), stem = dot > 0 ? f.name.slice(0, dot) : f.name, ext = dot > 0 ? f.name.slice(dot) : '';
    while (taken.has(n)) n = `${stem} (${k++})${ext}`;
    taken.add(n);
    await doc.attach(f.data, n, { mimeType: f.type || 'application/octet-stream', creationDate: now, modificationDate: now });
  }
  return doc.save();
}
export type NumberPos = 'bottom-center' | 'bottom-right' | 'top-right';
export type NumberFmt = 'n' | 'n / N' | 'Pagina n din N';
export const NUMBER_POS: [NumberPos, string][] = [['bottom-center', 'Jos, la mijloc'], ['bottom-right', 'Jos, în dreapta'], ['top-right', 'Sus, în dreapta']];
export const NUMBER_FMT: NumberFmt[] = ['n', 'n / N', 'Pagina n din N'];

/**
 * Numere de pagină scrise în PDF (ca la un dosar de acte unit din mai multe fișiere): pe toate paginile, sau fără prima
 * (coperta), începând de la `start`. Numărul stă drept și pe paginile rotite, cu margine de ~1 cm.
 */
export async function numberPages(bytes: Uint8Array, o: { pos: NumberPos; fmt: NumberFmt; start: number; skipFirst: boolean; size?: number }): Promise<Uint8Array> {
  const doc = await open(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = o.size ?? 10;
  const pages = doc.getPages();
  const first = o.skipFirst ? 1 : 0;
  const total = o.start + pages.length - first - 1;
  for (let i = first; i < pages.length; i++) {
    const page = pages[i];
    const n = o.start + i - first;
    const label = o.fmt === 'n' ? String(n) : o.fmt === 'n / N' ? `${n} / ${total}` : `Pagina ${n} din ${total}`;
    const box = page.getCropBox();
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    // Mărimea paginii așa cum se vede (cu rotirea ei), apoi locul textului pe ea, cu y de sus în jos.
    const vw = rot % 180 ? box.height : box.width, vh = rot % 180 ? box.width : box.height;
    const tw = font.widthOfTextAtSize(label, size), margin = 28;
    const dx = o.pos === 'bottom-center' ? (vw - tw) / 2 : vw - tw - margin;
    const dy = o.pos === 'top-right' ? margin + size : vh - margin + size * 0.3;
    const [x, y] = toPdfPoint(dx, dy, box, rot);
    page.drawText(label, { x, y, size, font, color: rgb(0.15, 0.15, 0.15), rotate: degrees(rot) });
  }
  return doc.save();
}

/** Mărimile de hârtie pentru „Mărimea paginilor” (puncte PDF, în picioare). */
export const PAGE_SIZES: [string, string, number, number][] = [
  ['A4', 'A4 (210 × 297 mm)', 595.28, 841.89],
  ['A5', 'A5 (148 × 210 mm)', 419.53, 595.28],
  ['A3', 'A3 (297 × 420 mm)', 841.89, 1190.55],
  ['Letter', 'Letter (SUA, 8,5 × 11 in)', 612, 792],
  ['Legal', 'Legal (SUA, 8,5 × 14 in)', 612, 1008],
];

/**
 * Schimbă mărimea paginilor date (de la 0) la hârtia aleasă, cu tot conținutul micșorat / mărit ca să încapă, centrat
 * (ca Acrobat → Crop / „Fit to paper”: un PDF Letter din SUA devine A4). Orientarea fiecărei pagini se păstrează.
 */
export async function resizePages(bytes: Uint8Array, pages: number[], paper: string): Promise<Uint8Array> {
  const size = PAGE_SIZES.find(([k]) => k === paper);
  if (!size) throw new Error('Mărime de hârtie necunoscută: ' + paper);
  const doc = await open(bytes);
  for (const i of [...new Set(pages)].filter((i) => i >= 0 && i < doc.getPageCount())) {
    const page = doc.getPage(i);
    const box = page.getCropBox();
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    // Pagina văzută e culcată dacă e mai lată decât înaltă; hârtia nouă are aceeași orientare.
    const vw = rot % 180 ? box.height : box.width, vh = rot % 180 ? box.width : box.height;
    let [W, H] = vw > vh ? [size[3], size[2]] : [size[2], size[3]];
    if (rot % 180) [W, H] = [H, W]; // în coordonatele paginii, nerotite
    const s = Math.min(W / box.width, H / box.height);
    const dx = (W - box.width * s) / 2 - box.x * s, dy = (H - box.height * s) / 2 - box.y * s;
    page.scaleContent(s, s);
    page.scaleAnnotations(s, s);
    page.translateContent(dx, dy);
    // Și comentariile, legăturile și câmpurile se mută odată cu conținutul.
    // Punctele x, y din Rect, QuadPoints (evidențieri), Vertices (poligoane), L (linii) și InkList (desen) se mută cu dx, dy.
    const shift = (arr: unknown): number[] | null => {
      if (!arr || typeof arr !== 'object' || !('asArray' in arr)) return null;
      const nums = (arr as { asArray(): unknown[] }).asArray().map((n) => (n instanceof PDFNumber ? n.asNumber() : NaN));
      if (nums.length % 2 || nums.some((n) => !Number.isFinite(n))) return null;
      return nums.map((n, j) => n + (j % 2 ? dy : dx));
    };
    const annots = page.node.Annots();
    for (let k = 0; annots && k < annots.size(); k++) {
      const a = annots.lookup(k);
      if (!(a instanceof PDFDict)) continue;
      for (const key of ['Rect', 'QuadPoints', 'Vertices', 'L']) {
        const moved = shift(a.lookup(PDFName.of(key)));
        if (moved) a.set(PDFName.of(key), doc.context.obj(moved));
      }
      const ink = a.lookup(PDFName.of('InkList'));
      if (ink && 'asArray' in ink) {
        const strokes = (ink as unknown as { asArray(): unknown[] }).asArray().map((st) => shift(st instanceof PDFRef ? doc.context.lookup(st) : st));
        if (strokes.every(Boolean)) a.set(PDFName.of('InkList'), doc.context.obj(strokes as number[][]));
      }
    }
    page.setMediaBox(0, 0, W, H);
    page.setCropBox(0, 0, W, H);
    for (const k of ['TrimBox', 'BleedBox', 'ArtBox']) page.node.delete(PDFName.of(k));
  }
  return doc.save();
}
