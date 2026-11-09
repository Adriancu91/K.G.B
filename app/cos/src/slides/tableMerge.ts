// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Celulele îmbinate ale tabelelor din Slides: fiecare îmbinare e [rând, coloană, câte rânduri, câte coloane] (colțul din stânga sus și
// întinderea). Textul îmbinării stă în celula din colț; celelalte celule acoperite rămân goale în grilă, ca grila să fie mereu dreptunghiulară.

export type Merge = [number, number, number, number];

const inside = (m: Merge, r: number, c: number) => r >= m[0] && r < m[0] + m[2] && c >= m[1] && c < m[1] + m[3];
const overlaps = (a: Merge, b: Merge) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** Îmbinările citite dintr-un fișier sau rămase după o schimbare: întregi, în tabel, mai mari de o celulă, fără suprapuneri. */
export function cleanMerges(raw: unknown, rows: number, cols: number): Merge[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Merge[] = [];
  for (const m of raw) {
    if (!Array.isArray(m) || m.length !== 4 || !m.every((v) => Number.isInteger(v))) continue;
    const [r, c] = m as number[];
    const rs = Math.min(m[2], rows - r), cs = Math.min(m[3], cols - c);
    if (r < 0 || c < 0 || r >= rows || c >= cols || rs < 1 || cs < 1 || rs * cs < 2) continue;
    const x: Merge = [r, c, rs, cs];
    if (!out.some((o) => overlaps(o, x))) out.push(x);
  }
  return out.length ? out : undefined;
}

/** Îmbinarea în care e celula (r, c), dacă e vreuna. */
export const mergeAt = (merges: Merge[] | undefined, r: number, c: number) => merges?.find((m) => inside(m, r, c));

/** Celula (r, c) e acoperită de o îmbinare și nu e colțul ei (nu se desenează). */
export const isCovered = (merges: Merge[] | undefined, r: number, c: number) => {
  const m = mergeAt(merges, r, c);
  return !!m && (m[0] !== r || m[1] !== c);
};

/** Îmbină celula (r, c) (sau îmbinarea ei) cu cea din dreapta ('right') ori de dedesubt ('down'). Zona crește până cuprinde întregi
 *  îmbinările pe care le atinge; textele celulelor acoperite se adaugă, pe rânduri noi, la textul din colț. Null dacă nu se poate. */
export function mergeCells(cells: string[][], merges: Merge[] | undefined, r: number, c: number, dir: 'right' | 'down'): { cells: string[][]; merge: Merge[] } | null {
  const rows = cells.length, cols = cells[0]?.length ?? 0;
  const from = mergeAt(merges, r, c) ?? [r, c, 1, 1];
  let box: Merge = dir === 'right' ? [from[0], from[1], from[2], from[3] + 1] : [from[0], from[1], from[2] + 1, from[3]];
  if (box[0] + box[2] > rows || box[1] + box[3] > cols) return null;
  for (let grew = true; grew;) {
    grew = false;
    for (const m of merges ?? []) {
      if (!overlaps(m, box)) continue;
      const r0 = Math.min(box[0], m[0]), c0 = Math.min(box[1], m[1]);
      const r1 = Math.max(box[0] + box[2], m[0] + m[2]), c1 = Math.max(box[1] + box[3], m[1] + m[3]);
      const nb: Merge = [r0, c0, r1 - r0, c1 - c0];
      if (nb.some((v, i) => v !== box[i])) { box = nb; grew = true; }
    }
  }
  const texts: string[] = [];
  const next = cells.map((row, i) => row.map((t, j) => {
    if (!inside(box, i, j)) return t;
    if (t.trim()) texts.push(t);
    return '';
  }));
  next[box[0]][box[1]] = texts.join('\n');
  return { cells: next, merge: [...(merges ?? []).filter((m) => !overlaps(m, box)), box] };
}

/** Separă îmbinarea în care e celula (r, c). */
export const splitCell = (merges: Merge[] | undefined, r: number, c: number) => merges?.filter((m) => !inside(m, r, c));

/** După un rând (axis 0) sau o coloană (axis 1) adăugată la indexul at (d = 1) ori scoasă de la at (d = -1): îmbinările se mută / cresc / scad. */
export function shiftMerges(merges: Merge[] | undefined, axis: 0 | 1, at: number, d: 1 | -1): Merge[] | undefined {
  if (!merges) return undefined;
  return merges.map((m) => {
    const x = [...m] as Merge, p = axis, s = axis + 2;
    if (d > 0) {
      if (x[p] >= at) x[p]++;
      else if (x[p] + x[s] > at) x[s]++;
    } else if (x[p] > at) x[p]--;
    else if (x[p] + x[s] > at) x[s]--;
    return x;
  });
}

/** Împarte celula (r, c) (sau îmbinarea ei) în două coloane ('cols') ori două rânduri ('rows'), ca Split Cells.
 *  O îmbinare lată de cel puțin 2 se taie în două; o celulă de lățime 1 primește o coloană nouă alături, iar celelalte rânduri
 *  se îmbină peste ea, ca să arate la fel. Textul rămâne în prima parte. `added` spune dacă grila a crescut. Null dacă nu încape. */
export function splitInto(cells: string[][], merges: Merge[] | undefined, r: number, c: number, dir: 'cols' | 'rows', max: number):
  { cells: string[][]; merge: Merge[] | undefined; added: boolean } | null {
  if (dir === 'rows') {
    const t = (g: string[][]) => g[0].map((_, j) => g.map((row) => row[j]));
    const tm = (ms: Merge[] | undefined) => ms?.map((m) => [m[1], m[0], m[3], m[2]] as Merge);
    const x = splitInto(t(cells), tm(merges), c, r, 'cols', max);
    return x && { cells: t(x.cells), merge: tm(x.merge), added: x.added };
  }
  const rows = cells.length, cols = cells[0]?.length ?? 0;
  const box = mergeAt(merges, r, c) ?? [r, c, 1, 1];
  const rest = (merges ?? []).filter((m) => m !== box);
  if (box[3] >= 2) {
    const w = Math.floor(box[3] / 2);
    const parts: Merge[] = [[box[0], box[1], box[2], w], [box[0], box[1] + w, box[2], box[3] - w]];
    return { cells, merge: cleanMerges([...rest, ...parts], rows, cols), added: false };
  }
  if (cols >= max) return null;
  const at = box[1] + 1;
  const next = cells.map((row) => { const y = [...row]; y.splice(at, 0, ''); return y; });
  const grown = (shiftMerges(rest, 1, at, 1) ?? []).map((m) => (m[1] + m[3] === at && m[1] <= box[1] ? [m[0], m[1], m[2], m[3] + 1] as Merge : m));
  const out: Merge[] = [...grown];
  if (box[2] > 1) out.push([box[0], box[1], box[2], 1], [box[0], at, box[2], 1]);
  for (let i = 0; i < rows; i++) {
    if (i >= box[0] && i < box[0] + box[2]) continue;
    if (!out.some((m) => inside(m, i, box[1]))) out.push([i, box[1], 1, 2]);
  }
  return { cells: next, merge: cleanMerges(out, rows, cols + 1), added: true };
}

/** Marginile din celule (în pixeli de slide: sus-jos, stânga-dreapta) și direcția textului din celule. */
export type TablePad = 'normal' | 'narrow' | 'wide' | 'none';
export const TABLE_PADS: [TablePad, string, number, number][] = [['normal', '▭ Margini normale', 6, 12], ['narrow', '▭ Margini înguste', 2, 5],
  ['wide', '▭ Margini late', 12, 24], ['none', '▭ Fără margini', 0, 0]];
export const cleanPad = (v: unknown): TablePad | undefined => (TABLE_PADS.some(([k]) => k === v) && v !== 'normal' ? v as TablePad : undefined);
export const padOf = (p: TablePad | undefined) => { const x = TABLE_PADS.find(([k]) => k === (p ?? 'normal'))!; return { v: x[2], h: x[3] }; };
/** Marginile citite dintr-un fișier (pixeli): felul cel mai apropiat. */
export function nearestPad(v: number, h: number): TablePad | undefined {
  const best = [...TABLE_PADS].sort((a, b) => Math.abs(a[2] - v) + Math.abs(a[3] - h) - Math.abs(b[2] - v) - Math.abs(b[3] - h))[0];
  return cleanPad(best[0]);
}
export type TableDir = 'vert' | 'vert270';
export const TABLE_DIRS: [TableDir | '', string][] = [['', '⇄ Text orizontal'], ['vert', '⤵ Text rotit 90°'], ['vert270', '⤴ Text rotit 270°']];
export const cleanDir = (v: unknown): TableDir | undefined => (v === 'vert' || v === 'vert270' ? v : undefined);

/** Chenarele tabelului: toate liniile (obișnuit), doar conturul, doar liniile din interior, doar cele orizontale sau deloc. */
export type TableBorder = 'all' | 'outer' | 'inner' | 'h' | 'none';
export const TABLE_BORDERS: [TableBorder, string][] = [['all', '▦ Toate chenarele'], ['outer', '□ Doar conturul'], ['inner', '┼ Doar în interior'],
  ['h', '☰ Doar orizontale'], ['none', '⬚ Fără chenare']];
export const cleanBorder = (v: unknown): TableBorder | undefined => (TABLE_BORDERS.some(([k]) => k === v) && v !== 'all' ? v as TableBorder : undefined);

/** Ce laturi are celula (r, c) (cu întinderea îmbinării ei): [sus, dreapta, jos, stânga]. */
export function cellSides(mode: TableBorder | undefined, merges: Merge[] | undefined, r: number, c: number, rows: number, cols: number): [boolean, boolean, boolean, boolean] {
  const m = mergeAt(merges, r, c) ?? [r, c, 1, 1];
  const edge: [boolean, boolean, boolean, boolean] = [m[0] === 0, m[1] + m[3] === cols, m[0] + m[2] === rows, m[1] === 0];
  switch (mode ?? 'all') {
    case 'none': return [false, false, false, false];
    case 'outer': return edge;
    case 'inner': return edge.map((e) => !e) as [boolean, boolean, boolean, boolean];
    case 'h': return [true, false, true, false];
    default: return [true, true, true, true];
  }
}

/** Chenarele citite dintr-un fișier: felul care se potrivește cu laturile tuturor celulelor (null = latură nescrisă), altfel nimic. */
export function detectBorder(side: (r: number, c: number) => (boolean | null)[], merges: Merge[] | undefined, rows: number, cols: number): TableBorder | undefined {
  const all: [number, number, (boolean | null)[]][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!isCovered(merges, r, c)) all.push([r, c, side(r, c)]);
  if (!all.length || all.some(([, , s]) => s.some((v) => v === null))) return undefined;
  const mode = TABLE_BORDERS.map(([k]) => k).find((k) => all.every(([r, c, s]) => cellSides(k, merges, r, c, rows, cols).every((v, i) => v === s[i])));
  return cleanBorder(mode);
}
