// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Umplerea automată (tragi de pătrățelul din colțul selecției), ca în Excel:
// 1, 2 → 3, 4, 5…; „Ziua 1” → „Ziua 2”; luni → marți; formulele își mută referințele.
import { cellId, isNumber } from './format';
import { formatNumber, shiftFormula } from './formula';

export interface Range { r0: number; c0: number; r1: number; c1: number }

/** Listele cunoscute (zile, luni), folosite și la sortarea după listă. */
export const LISTS = [
  ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'],
  ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie',
    'noiembrie', 'decembrie'],
  ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'],
];

/** Listele proprii (Liste proprii…): de exemplu „Nord, Sud, Est, Vest” sau numele colegilor; se continuă la umplere ca zilele. */
let custom: string[][] = [];
export const customLists = () => custom;
/** Păstrează doar listele bune: cel puțin două valori, fără goluri și fără dubluri (cel mult 50 de liste a câte 200 de valori). */
export function cleanLists(l: unknown): string[][] {
  if (!Array.isArray(l)) return [];
  const out: string[][] = [];
  for (const x of l) {
    if (!Array.isArray(x)) continue;
    const seen = new Set<string>();
    const vals = x.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter((v) => {
      const k = v.toLowerCase();
      if (!v || v.length > 100 || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 200);
    if (vals.length >= 2) out.push(vals);
    if (out.length >= 50) break;
  }
  return out;
}
export function setCustomLists(l: unknown) { custom = cleanLists(l); }
/** Listele scrise în fereastră: câte una pe rând, cu valorile despărțite prin virgulă sau punct și virgulă. */
export function parseLists(text: string): string[][] {
  return cleanLists(text.split(String.fromCharCode(10)).map((line) => line.split(/[,;]/)));
}
export const listsText = (l: string[][]) => l.map((x) => x.join(', ')).join(String.fromCharCode(10));

const plain = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const mod = (a: number, n: number) => ((a % n) + n) % n;

function sameCase(word: string, model: string): string {
  const m = model.trim();
  if (m.length > 1 && m === m.toUpperCase()) return word.toUpperCase();
  if (m[0] && m[0] === m[0].toUpperCase()) return word[0].toUpperCase() + word.slice(1);
  return word;
}

function numText(n: number, comma: boolean): string {
  const t = formatNumber(n);
  return comma ? t : t.replace(',', '.');
}

/**
 * Valorile de pe o linie (coloană sau rând) continuate la pozițiile cerute.
 * Poziția 0 e prima valoare din sursă; pozițiile negative sunt înainte de ea (umplere în sus/stânga).
 * `shift(text, d)` mută referințele unei formule cu d pași de-a lungul liniei.
 */
export function extendLine(src: string[], positions: number[], shift: (f: string, d: number) => string): string[] {
  const n = src.length;
  const copy = (i: number) => {
    const k = mod(i, n);
    return shift(src[k], i - k);
  };
  if (src.every((v) => v === '')) return positions.map(() => '');

  // Numere: o singură valoare se copiază, două sau mai multe fac o serie (1, 2 → 3, 4…).
  if (src.every((v) => isNumber(v))) {
    if (n === 1) return positions.map(copy);
    const nums = src.map((v) => Number(v.trim().replace(',', '.')));
    const step = (nums[n - 1] - nums[0]) / (n - 1);
    const comma = src.some((v) => v.includes(','));
    return positions.map((i) => numText(nums[0] + step * i, comma));
  }

  // Zile și luni: luni → marți, ianuarie → februarie; apoi listele proprii.
  for (const list of [...LISTS, ...custom]) {
    const idx = src.map((v) => list.findIndex((w) => plain(w) === plain(v)));
    if (idx.every((x) => x >= 0)) {
      const step = n >= 2 ? idx[1] - idx[0] : 1;
      return positions.map((i) => sameCase(list[mod(idx[0] + step * i, list.length)], src[mod(i, n)]));
    }
  }

  // Text care se termină cu un număr: „Ziua 1” → „Ziua 2”.
  const parts = src.map((v) => /^(.*?)(\d+)(\s*)$/.exec(v));
  if (!src.some((v) => v.startsWith('=')) && parts.every((p) => p && p[1] === parts[0]![1] && p[1] !== '')) {
    const nums = parts.map((p) => Number(p![2]));
    const step = n >= 2 ? nums[1] - nums[0] : 1;
    const pad = parts[0]![2].length;
    return positions.map((i) => {
      const v = nums[0] + step * i;
      const digits = String(Math.abs(v)).padStart(pad, '0');
      return parts[0]![1] + (v < 0 ? '-' : '') + digits + parts[0]![3];
    });
  }

  return positions.map(copy);
}

/** Zona în care ajunge umplerea când mouse-ul e pe celula p: în direcția în care a ieșit mai mult din selecție. */
export function fillTargetFor(s: Range, p: { r: number; c: number }): Range | null {
  const dv = p.r > s.r1 ? p.r - s.r1 : p.r < s.r0 ? s.r0 - p.r : 0;
  const dh = p.c > s.c1 ? p.c - s.c1 : p.c < s.c0 ? s.c0 - p.c : 0;
  if (!dv && !dh) return null;
  if (dv >= dh) return { ...s, r0: Math.min(s.r0, p.r), r1: Math.max(s.r1, p.r) };
  return { ...s, c0: Math.min(s.c0, p.c), c1: Math.max(s.c1, p.c) };
}

/** Celulele noi când sursa `src` e trasă până la `target` (care o conține). */
export function fillRange(cells: Record<string, string>, src: Range, target: Range): Record<string, string> {
  const patch: Record<string, string> = {};
  const get = (r: number, c: number) => cells[cellId(r, c)] ?? '';
  if (target.r0 < src.r0 || target.r1 > src.r1) {
    const rows: number[] = [];
    for (let r = target.r0; r <= target.r1; r++) if (r < src.r0 || r > src.r1) rows.push(r);
    for (let c = src.c0; c <= src.c1; c++) {
      const line: string[] = [];
      for (let r = src.r0; r <= src.r1; r++) line.push(get(r, c));
      const out = extendLine(line, rows.map((r) => r - src.r0), (f, d) => shiftFormula(f, d, 0));
      rows.forEach((r, i) => { patch[cellId(r, c)] = out[i]; });
    }
  } else {
    const cols: number[] = [];
    for (let c = target.c0; c <= target.c1; c++) if (c < src.c0 || c > src.c1) cols.push(c);
    for (let r = src.r0; r <= src.r1; r++) {
      const line: string[] = [];
      for (let c = src.c0; c <= src.c1; c++) line.push(get(r, c));
      const out = extendLine(line, cols.map((c) => c - src.c0), (f, d) => shiftFormula(f, 0, d));
      cols.forEach((c, i) => { patch[cellId(r, c)] = out[i]; });
    }
  }
  return patch;
}

/**
 * Formatarea zonei noi la umplere: se repetă formatarea sursei, ca în Excel (1 aldin, 2 normal → aldin, normal…).
 * Un obiect gol înseamnă „fără format”.
 */
export function fillStyles<S extends object>(styles: Record<string, S>, src: Range, target: Range): Record<string, S | Record<string, never>> {
  const patch: Record<string, S | Record<string, never>> = {};
  const h = src.r1 - src.r0 + 1;
  const w = src.c1 - src.c0 + 1;
  for (let r = target.r0; r <= target.r1; r++) {
    for (let c = target.c0; c <= target.c1; c++) {
      if (r >= src.r0 && r <= src.r1 && c >= src.c0 && c <= src.c1) continue;
      const s = styles[cellId(src.r0 + mod(r - src.r0, h), src.c0 + mod(c - src.c0, w))];
      patch[cellId(r, c)] = s ? { ...s } : {};
    }
  }
  return patch;
}
