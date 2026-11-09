// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Celule îmbinate (ca „Îmbină și centrează” din Excel). În fișier se păstrează ca zone „A1:C1”.
// Doar celula din stânga-sus are conținut; celelalte sunt acoperite de ea.
import { cellId, COLS, parseCellId, ROWS } from './format';
import type { Range } from './fill';

export function mergeText(g: Range): string {
  return `${cellId(g.r0, g.c0)}:${cellId(g.r1, g.c1)}`;
}

export function parseMerge(text: string): Range | null {
  const [a, b] = text.split(':');
  const p = a ? parseCellId(a) : null;
  const q = b ? parseCellId(b) : null;
  if (!p || !q) return null;
  const g = { r0: Math.min(p.r, q.r), c0: Math.min(p.c, q.c), r1: Math.max(p.r, q.r), c1: Math.max(p.c, q.c) };
  if (g.r1 >= ROWS || g.c1 >= COLS || (g.r0 === g.r1 && g.c0 === g.c1)) return null;
  return g;
}

export const overlaps = (a: Range, b: Range) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;

/** Lista din fișier, curățată: zone valide, cel puțin două celule, fără suprapuneri. */
export function cleanMerges(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: Range[] = [];
  for (const t of raw.slice(0, 1000)) {
    const g = typeof t === 'string' ? parseMerge(t) : null;
    if (g && !out.some((o) => overlaps(o, g))) out.push(g);
  }
  return out.map(mergeText);
}

export function mergesOf(list: string[] | undefined): Range[] {
  return (list ?? []).map(parseMerge).filter((g): g is Range => !!g);
}

export function mergeAt(merges: Range[], r: number, c: number): Range | undefined {
  return merges.find((g) => r >= g.r0 && r <= g.r1 && c >= g.c0 && c <= g.c1);
}

/** Cum se desenează un rând: unde începe o celulă îmbinată (câte coloane/rânduri ocupă) și ce coloane sunt acoperite. */
export interface RowMerge {
  start: Record<number, { cs: number; rs: number }>;
  covered: Set<number>;
  /** Text scurt, ca un rând să știe dacă s-a schimbat ceva la el. */
  key: string;
}

/** Rândurile ascunse de filtru nu se desenează, deci nu se numără nici în înălțimea îmbinării. */
export function mergeLayout(merges: Range[], hidden: Set<number> = new Set()): Map<number, RowMerge> {
  const rows = new Map<number, RowMerge>();
  const get = (r: number) => {
    let m = rows.get(r);
    if (!m) { m = { start: {}, covered: new Set(), key: '' }; rows.set(r, m); }
    return m;
  };
  for (const g of merges) {
    let rs = 0;
    for (let r = g.r0; r <= g.r1; r++) if (!hidden.has(r)) rs++;
    for (let r = g.r0; r <= g.r1; r++) {
      const m = get(r);
      for (let c = g.c0; c <= g.c1; c++) {
        if (r === g.r0 && c === g.c0) m.start[c] = { cs: g.c1 - g.c0 + 1, rs };
        else m.covered.add(c);
      }
      m.key += `${mergeText(g)}/${rs};`;
    }
  }
  return rows;
}

/** Îmbină zona: scoate îmbinările vechi din ea. Întoarce și celulele (în afară de stânga-sus) care aveau conținut. */
export function addMerge(list: string[] | undefined, g: Range, cells: Record<string, string>): { merges: string[]; lost: string[] } {
  const merges = mergesOf(list).filter((m) => !overlaps(m, g));
  merges.push(g);
  const lost: string[] = [];
  for (let r = g.r0; r <= g.r1; r++) {
    for (let c = g.c0; c <= g.c1; c++) {
      if ((r !== g.r0 || c !== g.c0) && cells[cellId(r, c)]) lost.push(cellId(r, c));
    }
  }
  return { merges: merges.map(mergeText), lost };
}

export function removeMerges(list: string[] | undefined, g: Range): string[] {
  return mergesOf(list).filter((m) => !overlaps(m, g)).map(mergeText);
}
