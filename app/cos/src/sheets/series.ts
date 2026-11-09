// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Umplere → Serie (ca în Excel): pornind de la numărul sau data din prima celulă, celulele următoare primesc o serie
// liniară (+pas), de creștere (×pas) sau de date (zile, zile lucrătoare, luni, ani), până la capătul selecției sau la valoarea de oprire.

export type SeriesType = 'linear' | 'growth' | 'date';
export type DateUnit = 'day' | 'weekday' | 'month' | 'year';

export interface SeriesOpts {
  type: SeriesType;
  unit: DateUnit;
  step: number;
  /** Valoarea la care se oprește seria (inclusiv); lipsă = până la capătul selecției. */
  stop?: number;
}

/** Cele mai multe celule umplute dintr-o dată (o valoare de oprire foarte mare nu blochează aplicația). */
export const MAX_SERIES = 100000;

const EPOCH = Date.UTC(1899, 11, 30);
const DAY = 86400000;

function addMonths(serial: number, months: number): number {
  const d = new Date(EPOCH + Math.floor(serial) * DAY);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  // 31 ianuarie + 1 lună = 28/29 februarie (ultima zi a lunii), ca în Excel.
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return Math.round((t.getTime() - EPOCH) / DAY) + (serial - Math.floor(serial));
}

function addWeekdays(serial: number, n: number): number {
  let s = serial;
  const dir = n < 0 ? -1 : 1;
  for (let left = Math.abs(n); left > 0;) {
    s += dir;
    const wd = new Date(EPOCH + Math.floor(s) * DAY).getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return s;
}

/** Valoarea a i-a din serie (i = 0 e prima celulă). */
function nth(start: number, i: number, o: SeriesOpts): number {
  if (o.type === 'linear') return start + o.step * i;
  if (o.type === 'growth') return start * o.step ** i;
  const k = o.step * i;
  switch (o.unit) {
    case 'day': return start + k;
    case 'weekday': return addWeekdays(start, k);
    case 'month': return addMonths(start, k);
    case 'year': return addMonths(start, k * 12);
  }
}

/**
 * Valorile pentru celulele 1…count-1 (prima rămâne cum e). Seria se oprește înainte de valoarea care trece de `stop`
 * (în sensul pasului), deci poate fi mai scurtă decât count. Fără stop și count = 1 nu se umple nimic.
 */
export function seriesValues(start: number, count: number, o: SeriesOpts): number[] {
  const out: number[] = [];
  const up = o.type === 'growth' ? (start >= 0 ? o.step >= 1 : o.step < 1) : o.step >= 0;
  const n = Math.min(count, MAX_SERIES);
  for (let i = 1; i < n; i++) {
    const v = Math.round(nth(start, i, o) * 1e10) / 1e10;
    if (!Number.isFinite(v)) break;
    if (o.stop !== undefined && (up ? v > o.stop + 1e-9 : v < o.stop - 1e-9)) break;
    out.push(v);
  }
  return out;
}
