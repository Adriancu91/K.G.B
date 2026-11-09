// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import type { Range } from './fill';
import { parseCellId, WORK_ROWS } from './format';

/**
 * Rândurile care nu sunt ascunse de filtru, în ordine, fără să facem o listă cu tot milionul de rânduri.
 * Rândurile ascunse sunt toate deasupra rândului K; de la K în jos, fiecare rând e la locul lui (deplasat cu cele ascunse).
 */
export class ShownRows {
  readonly length: number;
  private readonly head: number[] = [];
  private readonly pos = new Map<number, number>();
  private readonly k: number;

  constructor(private readonly total: number, hidden: Set<number>) {
    let k = 0;
    for (const r of hidden) if (r + 1 > k) k = r + 1;
    this.k = Math.min(k, total);
    for (let r = 0; r < this.k; r++) {
      if (hidden.has(r)) continue;
      this.pos.set(r, this.head.length);
      this.head.push(r);
    }
    this.length = this.head.length + (total - this.k);
  }

  /** Rândul de pe locul i (de la 0), sau undefined în afara listei. */
  at(i: number): number | undefined {
    if (i < 0 || i >= this.length) return undefined;
    return i < this.head.length ? this.head[i] : this.k + i - this.head.length;
  }

  /** Locul rândului r printre cele vizibile, sau undefined dacă e ascuns. */
  indexOf(r: number): number | undefined {
    if (r < 0 || r >= this.total) return undefined;
    return r < this.k ? this.pos.get(r) : this.head.length + r - this.k;
  }

  /** Rândurile de pe locurile [a, b). */
  slice(a: number, b: number): number[] {
    const out: number[] = [];
    for (let i = Math.max(0, a); i < Math.min(b, this.length); i++) out.push(this.at(i) as number);
    return out;
  }
}

/**
 * Unde începe fiecare rând pe ecran, când unele rânduri sunt mai înalte. Se ține o listă doar până la ultimul rând înalt;
 * mai jos toate au aceeași înălțime și poziția se calculează direct.
 */
export class RowTops {
  private readonly tops: Float64Array;
  private readonly last: number;

  constructor(shown: ShownRows, tall: Map<number, number>, private readonly rowPx: number) {
    let last = 0;
    for (const r of tall.keys()) {
      const i = shown.indexOf(r);
      if (i !== undefined && i + 1 > last) last = i + 1;
    }
    this.last = last;
    this.tops = new Float64Array(last + 1);
    for (let i = 0; i < last; i++) this.tops[i + 1] = this.tops[i] + (tall.get(shown.at(i) as number) ?? rowPx);
  }

  /** Unde începe rândul de pe locul i. */
  top(i: number): number {
    return i <= this.last ? this.tops[i] : this.tops[this.last] + (i - this.last) * this.rowPx;
  }

  /** Locul rândului care se află la înălțimea y. */
  indexAt(y: number): number {
    const end = this.tops[this.last];
    if (y >= end) return this.last + Math.floor((y - end) / this.rowPx);
    let lo = 0, hi = this.last;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.tops[mid] <= y) lo = mid; else hi = mid - 1; }
    return lo;
  }
}

/**
 * Trece prin celulele zonei g, rând cu rând. O zonă mare (o coloană întreagă, Ctrl+A) se parcurge complet doar pe primele
 * 10.000 de rânduri; mai jos se iau doar celulele care au ceva în „used” (conținut sau formatare), ca să nu treacă prin milionul de rânduri.
 */
export function eachCell(g: Range, used: Record<string, unknown>[], fn: (r: number, c: number) => void): void {
  const dense = Math.min(g.r1, g.r0 + WORK_ROWS - 1);
  for (let r = g.r0; r <= dense; r++) for (let c = g.c0; c <= g.c1; c++) fn(r, c);
  if (g.r1 <= dense) return;
  const seen = new Set<string>();
  const pts: { r: number; c: number }[] = [];
  for (const m of used) {
    for (const id of Object.keys(m)) {
      if (seen.has(id)) continue;
      const p = parseCellId(id);
      if (!p || p.r <= dense || p.r > g.r1 || p.c < g.c0 || p.c > g.c1) continue;
      seen.add(id);
      pts.push(p);
    }
  }
  pts.sort((a, b) => a.r - b.r || a.c - b.c);
  for (const p of pts) fn(p.r, p.c);
}
