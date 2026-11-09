// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// PDF → document Docs editabil: textul fiecărei pagini se strânge în rânduri, rândurile în paragrafe,
// textul mare devine titlu, rândurile cu buline devin liste, rândurile așezate pe aceleași coloane (facturi, extrase) devin tabel,
// iar între pagini se pune un salt de pagină. Pozele din pagini (la → Docs) se pun între paragrafe, la înălțimea lor de pe pagină;
// paginile scanate primesc și un rând explicativ.
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getObj, toCanvas } from './images';

/** O bucată de text de pe pagină, în puncte, cu y crescând în sus (ca în PDF). */
export interface Piece { str: string; x: number; y: number; w: number; size: number }

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };
/** Un rând de text; `cells` sunt bucățile despărțite de spații mari (coloanele unui tabel), fiecare cu x-ul de început. */
export interface Line { y: number; size: number; text: string; x: number; cells: { x: number; text: string }[] }

const BULLET = /^[•◦▪▫●○■□►▸‣∙·\-–—*]\s+/;

/** Bucățile cu aproape același y, de sus în jos. Exponentul și indicele (mai mici, puțin mai sus sau mai jos) rămân pe rândul lor. */
function rowsOf(pieces: Piece[]): Piece[][] {
  const list = pieces.filter((p) => p.str.length && p.size > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Piece[][] = [];
  for (const p of list) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - p.y) <= Math.max(1, 0.5 * Math.max(row[0].size, p.size))) row.push(p);
    else rows.push([p]);
  }
  return rows;
}

/**
 * Pagina așezată pe două coloane (articole, reviste): locul de pe orizontală lângă care rândurile au un spațiu gol lat
 * (mai mult decât între cuvinte) și text în ambele părți, la cel puțin o treime din rânduri. Întoarce și înălțimile între care
 * sunt coloanele (titlul și autorii de deasupra, pe toată lățimea, rămân separat). `null` = o singură coloană.
 */
export function columnSplit(pieces: Piece[]): { x: number; top: number; bottom: number } | null {
  const rows = rowsOf(pieces).filter((r) => r.some((p) => p.str.trim()));
  if (rows.length < 8) return null;
  const left = Math.min(...pieces.map((p) => p.x)), right = Math.max(...pieces.map((p) => p.x + p.w));
  let best: { x: number; top: number; bottom: number } | null = null, bestCross = Infinity;
  for (let x = left + (right - left) * 0.3; x <= left + (right - left) * 0.7; x += 2) {
    const state = rows.map((r) => {
      const g = 0.4 * Math.max(...r.map((p) => p.size));
      const words = r.filter((p) => p.str.trim());
      if (words.some((p) => p.x < x + g && p.x + p.w > x - g)) return 'cross';
      return words.some((p) => p.x + p.w <= x) && words.some((p) => p.x >= x) ? 'both' : '';
    });
    // Rândurile late de deasupra și de dedesubtul coloanelor (titlu, autori, subsol) nu contează.
    const first = state.indexOf('both'), last = state.lastIndexOf('both');
    if (first < 0) continue;
    const band = state.slice(first, last + 1);
    const both = band.filter((s) => s === 'both').length, cross = band.filter((s) => s === 'cross').length;
    if (both >= rows.length / 3 && cross <= band.length * 0.1 && cross < bestCross && !tableLike(rows.slice(first, last + 1))) {
      bestCross = cross;
      best = { x, top: Math.max(...rows[first].map((p) => p.y)), bottom: Math.min(...rows[last].map((p) => p.y)) };
    }
  }
  return best;
}

/** Rândurile cu cel puțin două goluri mari (trei celule) sunt multe: pagina e un tabel, nu text pe două coloane. */
function tableLike(rows: Piece[][]): boolean {
  const many = lineTexts(rows).filter((l) => l.cells.length >= 3).length;
  return many >= rows.length * 0.3;
}

/** O linie verticală trasă pe pagină (marginea unei coloane de tabel): x-ul și înălțimile între care merge, în puncte. */
export interface Rule { x: number; y0: number; y1: number }

// Codurile operațiilor din lista de desenare pdf.js (`OPS` din pdfjs-dist 4.x).
const OP = { save: 10, restore: 11, transform: 12, moveTo: 13, lineTo: 14, curveTo: 15, curveTo2: 16, curveTo3: 17, rectangle: 19, constructPath: 91, formBegin: 74, formEnd: 75 };
const STROKES = new Set([20, 21, 24, 25, 26, 27]);
const PAINTS = new Set([...STROKES, 22, 23]);

/**
 * Liniile verticale trase pe pagină (chenarele tabelelor): dreptunghiurile subțiri și înalte (pline sau conturate), liniile
 * drepte verticale conturate și marginile din stânga/dreapta ale dreptunghiurilor conturate (celule cu chenar).
 * Primește lista de desenare a paginii (`page.getOperatorList()`), ca să despartă coloanele lipite ale unui tabel cu linii.
 */
export function verticalRules(fnArray: number[], argsArray: unknown[]): Rule[] {
  const rules: Rule[] = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const mul = (a: number[], b: number[]) => [
    a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
  ];
  const pt = (x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const add = (x: number, ya: number, yb: number) => { if (Math.abs(yb - ya) >= 6) rules.push({ x, y0: Math.min(ya, yb), y1: Math.max(ya, yb) }); };
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i], args = argsArray[i] as unknown[] | null;
    if (fn === OP.save) stack.push(m);
    else if (fn === OP.restore) m = stack.pop() ?? m;
    else if (fn === OP.transform && args) m = mul(args as number[], m);
    else if (fn === OP.formBegin && args) { stack.push(m); if (Array.isArray(args[0])) m = mul(args[0] as number[], m); }
    else if (fn === OP.formEnd) m = stack.pop() ?? m;
    else if (fn === OP.constructPath && args) {
      const paint = fnArray[i + 1];
      if (!PAINTS.has(paint)) continue; // contur de decupare sau cale nedesenată
      const stroked = STROKES.has(paint);
      const ops = args[0] as number[], c = args[1] as number[];
      let k = 0, cur: number[] | null = null;
      for (const op of ops) {
        if (op === OP.rectangle) {
          const [x, y, w, h] = c.slice(k, k + 4); k += 4;
          const a = pt(x, y), b = pt(x + w, y + h);
          const wd = Math.abs(b[0] - a[0]);
          if (wd <= 2.5) add((a[0] + b[0]) / 2, a[1], b[1]);
          else if (stroked) { add(Math.min(a[0], b[0]), a[1], b[1]); add(Math.max(a[0], b[0]), a[1], b[1]); }
          cur = null;
        } else if (op === OP.moveTo) { cur = pt(c[k], c[k + 1]); k += 2; }
        else if (op === OP.lineTo) {
          const p = pt(c[k], c[k + 1]); k += 2;
          if (stroked && cur && Math.abs(p[0] - cur[0]) <= 1) add((p[0] + cur[0]) / 2, cur[1], p[1]);
          cur = p;
        } else if (op === OP.curveTo) { k += 6; cur = pt(c[k - 2], c[k - 1]); }
        else if (op === OP.curveTo2 || op === OP.curveTo3) { k += 4; cur = pt(c[k - 2], c[k - 1]); }
      }
    }
  }
  return rules;
}

/** Rândurile unei pagini, în ordinea de citire: la două coloane, întâi cea din stânga, apoi cea din dreapta. */
export function linesOf(pieces: Piece[], rules: Rule[] = []): Line[] {
  const split = columnSplit(pieces);
  if (split === null) return lineTexts(rowsOf(pieces), rules);
  const tol = 1;
  const above = pieces.filter((p) => p.y > split.top + tol), below = pieces.filter((p) => p.y < split.bottom - tol);
  const band = pieces.filter((p) => !above.includes(p) && !below.includes(p));
  return [
    ...lineTexts(rowsOf(above), rules),
    ...lineTexts(rowsOf(band.filter((p) => p.x + p.w / 2 < split.x)), rules),
    ...lineTexts(rowsOf(band.filter((p) => p.x + p.w / 2 >= split.x)), rules),
    ...lineTexts(rowsOf(below), rules),
  ];
}

function lineTexts(rows: Piece[][], rules: Rule[] = []): Line[] {
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    // Liniile verticale care trec prin mijlocul rândului (chenarele coloanelor), de la stânga la dreapta.
    const mid = row[0].y + 0.35 * row[0].size;
    const rx = rules.filter((r) => r.y0 <= mid && r.y1 >= mid).map((r) => r.x).sort((a, b) => a - b);
    let text = '';
    let end = -Infinity;
    const cells: { x: number; text: string; rule?: number }[] = [];
    for (const p of row) {
      const gap = p.x - end;
      // Un gol mai mare de vreo două litere late desparte celulele unui tabel; la fel o linie trasă între ele, oricât de mic e golul.
      const ruled = rx.some((x) => x > end - 1 && x < p.x + 1);
      if (!cells.length || ((gap > 1.5 * p.size || ruled) && p.str.trim())) {
        const left = rx.filter((x) => x < p.x + 1);
        cells.push({ x: p.x, text: '', rule: left.length ? left[left.length - 1] : undefined });
      }
      else if (gap > 0.15 * p.size && !/\s$/.test(cells[cells.length - 1].text) && !/^\s/.test(p.str)) cells[cells.length - 1].text += ' ';
      cells[cells.length - 1].text += p.str;
      if (text && gap > 0.15 * p.size && !/\s$/.test(text) && !/^\s/.test(p.str)) text += gap > 3 * p.size ? '    ' : ' ';
      text += p.str;
      end = Math.max(end, p.x + p.w);
    }
    const main = row.reduce((m, p) => (p.size > m.size ? p : m), row[0]);
    // Celula dintr-o coloană cu chenar începe la linia din stânga ei (numerele aliniate la dreapta au alt x pe fiecare rând,
    // dar aceeași coloană). Doar dacă linia e numai a ei: două celule între aceleași linii își păstrează x-ul.
    const x = (c: { x: number; rule?: number }) => (c.rule !== undefined && cells.filter((d) => d.rule === c.rule).length === 1 ? c.rule + 1 : c.x);
    const clean = cells.map((c) => ({ x: x(c), text: c.text.replace(/\s+/g, ' ').trim() })).filter((c) => c.text);
    return { y: main.y, x: row[0].x, size: main.size, text: text.replace(/\s+$/, ''), cells: clean };
  }).filter((l) => l.text.trim());
}

const para = (text: string, type = 'paragraph', attrs?: Record<string, unknown>): Node =>
  ({ type, ...(attrs ? { attrs } : {}), content: [{ type: 'text', text }] });

/** Mărimea obișnuită a textului: cea mai des întâlnită (după numărul de litere). */
function bodySize(pages: Line[][]): number {
  const count = new Map<number, number>();
  for (const l of pages.flat()) {
    const k = Math.round(l.size * 2) / 2;
    count.set(k, (count.get(k) ?? 0) + l.text.length);
  }
  let best = 10, most = -1;
  for (const [k, n] of count) if (n > most) { best = k; most = n; }
  return best;
}

/**
 * Unde începe un tabel în rândurile paginii: cel puțin două rânduri la rând cu 3+ celule, ale căror începuturi se potrivesc
 * cu coloanele rândului cu cele mai multe celule. Întoarce câte rânduri ține tabelul și coloanele lui (x-ul de început).
 */
export function tableAt(lines: Line[], i: number): { rows: number; cols: number[] } | null {
  const fits = (l: Line, cols: number[]) => l.cells.length >= 2 && l.cells.length <= cols.length
    && l.cells.every((c) => cols.some((x) => Math.abs(x - c.x) <= Math.max(12, l.size * 1.5)) || c.x > cols[cols.length - 1]);
  if (lines[i].cells.length < 3) return null;
  let j = i;
  let cols = lines[i].cells.map((c) => c.x);
  while (j + 1 < lines.length) {
    const next = lines[j + 1];
    const wider = next.cells.length > cols.length ? next.cells.map((c) => c.x) : cols;
    // Rândul următor trebuie să fie aproape (nu după un paragraf) și să aibă celulele pe aceleași coloane.
    if (lines[j].y - next.y > 3 * Math.max(lines[j].size, next.size) || !fits(next, wider)) break;
    if (!lines.slice(i, j + 2).every((l) => fits(l, wider))) break;
    cols = wider;
    j++;
  }
  return j > i ? { rows: j - i + 1, cols } : null;
}

const cellNode = (text: string): Node => ({ type: 'tableCell', content: [text ? para(text) : { type: 'paragraph' }] });

/** Textul celulelor tabelului, rând cu rând, așezat pe coloanele găsite de `tableAt`. */
export function tableCells(lines: Line[], cols: number[]): string[][] {
  return lines.map((l) => {
    const cells = cols.map(() => '');
    for (const c of l.cells) {
      // Celula merge la coloana cu începutul cel mai apropiat de stânga ei.
      let k = 0;
      for (let n = 0; n < cols.length; n++) if (cols[n] <= c.x + Math.max(12, l.size * 1.5)) k = n;
      cells[k] = cells[k] ? cells[k] + ' ' + c.text : c.text;
    }
    return cells;
  });
}

function tableNode(lines: Line[], cols: number[]): Node {
  return { type: 'table', content: tableCells(lines, cols).map((cells) => ({ type: 'tableRow', content: cells.map(cellNode) })) };
}

/** Face din rândurile paginilor conținutul unui document Docs. `null` = pagină fără text (scanată). */
/** O poză de pe pagină: `top` = marginea ei de sus (puncte PDF, de jos în sus), `width` = cât e de lată în document (pixeli). */
export interface PagePic { top: number; width: number; src: string; alt: string }

const picNode = (p: PagePic): Node => ({ type: 'image', attrs: { src: p.src, alt: p.alt, width: p.width } });

export function blocksOf(pages: (Line[] | null)[], pics: PagePic[][] = []): Node[] {
  const body = bodySize(pages.filter((p): p is Line[] => !!p));
  const out: Node[] = [];
  pages.forEach((lines, pi) => {
    if (pi) out.push({ type: 'pageBreak' });
    // Pozele paginii, de sus în jos; fiecare intră înaintea primului rând de sub ea.
    const left = [...(pics[pi] ?? [])].sort((a, b) => b.top - a.top);
    if (!lines) {
      for (const p of left) out.push(picNode(p));
      out.push(para(`[Pagina ${pi + 1} e scanată (o poză, fără text). Textul ei se poate scoate în PDF, cu „Text din scanare…”.]`));
      return;
    }
    let cur: { text: string; size: number; bullet: boolean; lastY: number; x: number } | null = null;
    let list: Node[] = [];
    const flushList = () => { if (list.length) out.push({ type: 'bulletList', content: list }); list = []; };
    const flush = () => {
      if (!cur) return;
      const t = cur.text.replace(/\s+/g, ' ').trim();
      if (t) {
        if (cur.bullet) list.push({ type: 'listItem', content: [para(t)] });
        else {
          flushList();
          // Textul mult mai mare decât cel obișnuit și scurt e titlu.
          const level = t.length <= 200 ? (cur.size >= body * 1.45 ? 1 : cur.size >= body * 1.15 ? 2 : 0) : 0;
          out.push(level ? para(t, 'heading', { level }) : para(t));
        }
      }
      cur = null;
    };
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if (left.length && left[0].top > l.y + l.size) {
        flush();
        flushList();
        while (left.length && left[0].top > l.y + l.size) out.push(picNode(left.shift()!));
      }
      const tbl = tableAt(lines, li);
      if (tbl) {
        flush();
        flushList();
        out.push(tableNode(lines.slice(li, li + tbl.rows), tbl.cols));
        li += tbl.rows - 1;
        continue;
      }
      const bullet = BULLET.test(l.text);
      const text = bullet ? l.text.replace(BULLET, '') : l.text;
      if (cur) {
        const gap = cur.lastY - l.y;
        const sameSize = Math.abs(l.size - cur.size) <= Math.max(0.6, cur.size * 0.12);
        // Rândul continuă paragraful dacă e aproape (spațiere obișnuită), are aceeași mărime și nu începe o bulină.
        if (!bullet && sameSize && gap > 0 && gap <= cur.size * 1.75) {
          const prev = cur.text;
          // Cuvânt despărțit în silabe la capăt de rând: „docu-” + „ment” → „document”.
          if (/[a-zăâîșțşţ]-$/i.test(prev) && /^[a-zăâîșțşţ]/.test(text)) cur.text = prev.slice(0, -1) + text.trimStart();
          else cur.text = prev + ' ' + text;
          cur.lastY = l.y;
          continue;
        }
        flush();
      }
      if (!bullet) flushList();
      cur = { text, size: l.size, bullet, lastY: l.y, x: l.x };
    }
    flush();
    flushList();
    for (const p of left) out.push(picNode(p));
  });
  return out.length ? out : [{ type: 'paragraph' }];
}

/** Rândurile de text ale unei pagini (de la 1); null = pagină fără text (scanată). */
export async function readPage(doc: PDFDocumentProxy, n: number): Promise<Line[] | null> {
  const pg = await doc.getPage(n);
  const tc = await pg.getTextContent();
  const pieces: Piece[] = [];
  for (const it of tc.items) {
    if (!('str' in it)) continue;
    // pdf.js pune bucăți doar cu spații peste golurile dintre cuvinte și coloane; ele ar ascunde golurile mari (coloanele
    // unui tabel). Spațiile se pun la loc după poziții, în lineTexts.
    if (!it.str.trim()) continue;
    const [a, b, , , e, f] = it.transform as number[];
    // Textul rotit (de exemplu ștampile pe diagonală sau note pe margine) se sare.
    if (Math.abs(b) > Math.abs(a) * 0.1) continue;
    pieces.push({ str: it.str, x: e, y: f, w: it.width, size: Math.abs(it.height || a) });
  }
  // Chenarele tabelelor (doar pe paginile cu text: la cele scanate n-ar ajuta și ar costa timp).
  let rules: Rule[] = [];
  if (pieces.length) {
    try {
      const ops = await pg.getOperatorList();
      rules = verticalRules(ops.fnArray, ops.argsArray);
    } catch { /* fără chenare: coloanele se despart doar după goluri */ }
  }
  const lines = linesOf(pieces, rules);
  pg.cleanup();
  return lines.length ? lines : null;
}

/** Rândurile de text ale fiecărei pagini (`null` = pagină fără text, scanată) și câte pagini sunt scanate. */
export async function readPages(doc: PDFDocumentProxy, progress?: (n: number) => void): Promise<{ pages: (Line[] | null)[]; scanned: number }> {
  const pages: (Line[] | null)[] = [];
  let scanned = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    progress?.(n);
    const lines = await readPage(doc, n);
    if (!lines) scanned++;
    pages.push(lines);
  }
  return { pages, scanned };
}

/** Câte poze intră într-un document și cât de mari (latura cea mai mare, în pixeli), ca documentul să rămână ușor. */
export const MAX_PICS = 150;
const PIC_SIDE = 1400;
const PIC_BYTES = 60e6;

type M = [number, number, number, number, number, number];
/** m urmat de ctm (operatorul cm din PDF: CTM' = m × CTM). */
const mul = (m: M, c: M): M => [m[0] * c[0] + m[1] * c[2], m[0] * c[1] + m[1] * c[3], m[2] * c[0] + m[3] * c[2], m[2] * c[1] + m[3] * c[3], m[4] * c[0] + m[5] * c[2] + c[4], m[4] * c[1] + m[5] * c[3] + c[5]];

/**
 * Pozele paginii n (de la 1), cu locul lor: matricea curentă se urmărește prin save / restore / cm și prin formele (XObject)
 * din pagină. Se sar pozele mici de pe pagină (sub 24 de puncte: linii, buline, puncte). `budget` scade cu fiecare poză.
 */
export async function readPagePictures(doc: PDFDocumentProxy, n: number, budget: { pics: number; bytes: number }): Promise<PagePic[]> {
  if (budget.pics <= 0 || budget.bytes <= 0) return [];
  const pg = await doc.getPage(n);
  const out: PagePic[] = [];
  try {
    const ops = await pg.getOperatorList();
    const O = pdfjs.OPS;
    let ctm: M = [1, 0, 0, 1, 0, 0];
    const stack: M[] = [];
    for (let i = 0; i < ops.fnArray.length && budget.pics > 0 && budget.bytes > 0; i++) {
      const fn = ops.fnArray[i], args = ops.argsArray[i] as unknown[];
      if (fn === O.save) stack.push(ctm);
      else if (fn === O.restore) ctm = stack.pop() ?? ctm;
      else if (fn === O.transform) ctm = mul(args as M, ctm);
      else if (fn === O.paintFormXObjectBegin) { stack.push(ctm); if (Array.isArray(args?.[0]) && (args[0] as number[]).length === 6) ctm = mul(args[0] as M, ctm); }
      else if (fn === O.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
      else if (fn === O.paintImageXObject && typeof args?.[0] === 'string') {
        const xs = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2], ctm[4] + ctm[0] + ctm[2]];
        const ys = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3], ctm[5] + ctm[1] + ctm[3]];
        const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
        if (w < 24 || h < 24) continue;
        const o = await getObj(pg, args[0]);
        if (!o || o.width < 16 || o.height < 16) continue;
        const c = toCanvas(o);
        if (!c) continue;
        // Pozele foarte mari se micșorează (o scanare de 5000 px ar face documentul greu).
        let canvas = c.canvas;
        const k = Math.min(1, PIC_SIDE / Math.max(canvas.width, canvas.height));
        if (k < 1) {
          const s = document.createElement('canvas');
          s.width = Math.max(1, Math.round(canvas.width * k)); s.height = Math.max(1, Math.round(canvas.height * k));
          s.getContext('2d')!.drawImage(canvas, 0, 0, s.width, s.height);
          canvas = s;
        }
        // În PDF, poza se desenează cu y în sus; cu matricea obișnuită (d > 0) iese dreaptă. Oglindită pe pagină: o întoarcem la fel.
        if (ctm[3] < 0 || ctm[0] < 0) {
          const f = document.createElement('canvas');
          f.width = canvas.width; f.height = canvas.height;
          const g = f.getContext('2d')!;
          g.translate(ctm[0] < 0 ? f.width : 0, ctm[3] < 0 ? f.height : 0);
          g.scale(ctm[0] < 0 ? -1 : 1, ctm[3] < 0 ? -1 : 1);
          g.drawImage(canvas, 0, 0);
          canvas = f;
        }
        const png = c.alpha || canvas.width * canvas.height < 250_000;
        const src = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88);
        budget.pics--; budget.bytes -= src.length;
        out.push({ top: Math.max(...ys), width: Math.max(24, Math.round(Math.min(624, (w * 96) / 72))), src, alt: `Poză din pagina ${n}` });
      }
    }
  } catch { /* fără poze pe pagina asta */ }
  pg.cleanup();
  return out;
}

/** Citește textul tuturor paginilor și întoarce fișierul Docs (JSON) gata de deschis; cu `pictures`, aduce și pozele. */
export async function pdfToDoc(doc: PDFDocumentProxy, progress?: (n: number) => void, pictures = false): Promise<{ content: string; scanned: number; pics: number }> {
  const { pages, scanned } = await readPages(doc, progress);
  const pics: PagePic[][] = [];
  const budget = { pics: MAX_PICS, bytes: PIC_BYTES };
  if (pictures) for (let n = 1; n <= doc.numPages; n++) { progress?.(n); pics.push(await readPagePictures(doc, n, budget)); }
  const content = { type: 'doc', content: blocksOf(pages, pics) };
  return { content: JSON.stringify({ format: 'suite-doc', version: 1, content, updatedAt: new Date().toISOString() }), scanned, pics: MAX_PICS - budget.pics };
}

/** Textul blocurilor, câte un rând pe paragraf, titlu, punct de listă sau rând de tabel (celulele cu „ | ” între ele). */
export function blockLines(nodes: Node[]): string[] {
  const text = (n: Node): string => n.text ?? (n.content ?? []).map(text).join('');
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type === 'paragraph' || n.type === 'heading') { const t = text(n).trim(); if (t) out.push(t); }
    else if (n.type === 'bulletList') for (const li of n.content ?? []) out.push('• ' + text(li).trim());
    else if (n.type === 'table') for (const r of n.content ?? []) out.push((r.content ?? []).map((c) => text(c).trim()).join(' | '));
  }
  return out;
}

/** Textul PDF-ului pe rânduri (paragrafe întregi, nu rândurile tăiate de lățimea paginii), pentru comparare. */
export async function pdfLines(doc: PDFDocumentProxy, progress?: (n: number) => void): Promise<string[]> {
  return blockLines(blocksOf((await readPages(doc, progress)).pages).filter((n) => n.type !== 'pageBreak' && !/^\[Pagina [0-9]+ e scanată/.test(n.content?.[0]?.text ?? '')));
}

/** Ca `pdfLines`, plus pagina fiecărui rând (de la 1), pentru rezumatul diferențelor. */
export async function pdfPageLines(doc: PDFDocumentProxy, progress?: (n: number) => void): Promise<{ lines: string[]; pages: number[] }> {
  const lines: string[] = [], pages: number[] = [];
  let page = 1, group: Node[] = [];
  const flush = () => { for (const l of blockLines(group)) { lines.push(l); pages.push(page); } group = []; };
  for (const n of blocksOf((await readPages(doc, progress)).pages)) {
    if (n.type === 'pageBreak') { flush(); page++; continue; }
    if (!/^\[Pagina [0-9]+ e scanată/.test(n.content?.[0]?.text ?? '')) group.push(n);
  }
  flush();
  return { lines, pages };
}
