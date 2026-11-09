// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// AutoSum (Σ, Alt+=), ca în Excel: alege singur zona de numere de deasupra (sau din stânga)
// și pune acolo =SUM(...), =AVERAGE(...) etc.
import { cellId } from './format';
import { Range } from './fill';

export type AutoFn = 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN';
export const AUTO_FNS: [AutoFn, string][] = [
  ['SUM', 'Σ Sumă'],
  ['AVERAGE', 'Medie'],
  ['COUNT', 'Numără'],
  ['MAX', 'Maxim'],
  ['MIN', 'Minim'],
];

export interface Cellish {
  /** Celula are un număr (scris sau calculat de o formulă). */
  num(r: number, c: number): boolean;
  /** Celula are ceva scris în ea. */
  filled(r: number, c: number): boolean;
}

const text = (fn: AutoFn, r0: number, c0: number, r1: number, c1: number) =>
  `=${fn}(${cellId(r0, c0)}:${cellId(r1, c1)})`;

/** Blocul de numere cel mai apropiat, mergând de la (r, c) în direcția (dr, dc). Sare peste celulele goale lipite de țintă. */
function nearBlock(r: number, c: number, dr: number, dc: number, s: Cellish): [number, number] | null {
  let i = 1;
  const at = (k: number) => [r + dr * k, c + dc * k] as const;
  const inside = (k: number) => at(k)[0] >= 0 && at(k)[1] >= 0;
  while (inside(i) && !s.filled(...at(i))) i++;
  if (!inside(i) || !s.num(...at(i))) return null;
  const near = i;
  while (inside(i + 1) && s.num(...at(i + 1))) i++;
  return [near, i];
}

/** Formula propusă pentru o singură celulă (r, c), sau null dacă nu are numere în jur. */
export function autoFormula(r: number, c: number, s: Cellish, fn: AutoFn = 'SUM'): string | null {
  const up = nearBlock(r, c, -1, 0, s);
  if (up) return text(fn, r - up[1], c, r - up[0], c);
  const left = nearBlock(r, c, 0, -1, s);
  if (left) return text(fn, r, c - left[1], r, c - left[0]);
  return null;
}

/**
 * Pentru o zonă selectată: unde se pun formulele.
 * - dacă ultimul rând al zonei e gol, totalurile ajung în el (pentru fiecare coloană cu numere);
 * - altfel, pe rândul de sub zonă (sau, la o zonă de un singur rând, în coloana din dreapta).
 */
export function autoFill(range: Range, s: Cellish, fn: AutoFn = 'SUM'): Record<string, string> {
  const out: Record<string, string> = {};
  const { r0, c0, r1, c1 } = range;
  const anyNum = (a: number, b: number, d: number, e: number) => {
    for (let r = a; r <= d; r++) for (let c = b; c <= e; c++) if (s.num(r, c)) return true;
    return false;
  };
  if (r0 === r1) {
    // Un singur rând: totalul în prima celulă goală din dreapta (sau în ultima celulă a zonei, dacă e goală).
    const lastEmpty = c1 > c0 && !s.filled(r0, c1);
    const end = lastEmpty ? c1 - 1 : c1;
    if (anyNum(r0, c0, r0, end)) out[cellId(r0, lastEmpty ? c1 : c1 + 1)] = text(fn, r0, c0, r0, end);
    return out;
  }
  let lastEmpty = true;
  for (let c = c0; c <= c1; c++) if (s.filled(r1, c)) lastEmpty = false;
  const end = lastEmpty ? r1 - 1 : r1;
  const target = lastEmpty ? r1 : r1 + 1;
  for (let c = c0; c <= c1; c++) {
    if (!anyNum(r0, c, end, c)) continue;
    if (!lastEmpty && s.filled(target, c)) continue;
    out[cellId(target, c)] = text(fn, r0, c, end, c);
  }
  return out;
}
