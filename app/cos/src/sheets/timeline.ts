// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Cronologia (ca Timeline din Excel): o coloană cu date împărțită pe ani, trimestre, luni sau zile; un clic pe o perioadă
// arată doar rândurile din ea. Filtrul pus e o condiție „între” pe numerele zilelor, deci merge și în .xlsx (customFilters).
import { CellStyle, cellId } from './format';
import { DATE_FMTS } from './numfmt';
import { Result } from './formula';

type Cells = Record<string, string>;
type Styles = Record<string, CellStyle>;
type Results = Record<string, Result>;

export type TimeLevel = 'y' | 'q' | 'm' | 'd';
export const TIME_LEVELS: [TimeLevel, string][] = [['y', 'Ani'], ['q', 'Trimestre'], ['m', 'Luni'], ['d', 'Zile']];

export interface TimePeriod { from: number; to: number; label: string; group: string; count: number }

const DAY_MS = 86400000;
const EPOCH = Date.UTC(1899, 11, 30);
const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
/** Cel mult atâtea perioade într-o cronologie (zilele unui tabel pe zece ani ar fi prea multe butoane). */
export const MAX_PERIODS = 400;

const toDate = (n: number) => new Date(EPOCH + Math.floor(n) * DAY_MS);
const toSerial = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m, d) - EPOCH) / DAY_MS);

/** Numărul zilei din celulă, dacă celula e o dată (formatul de dată sau un cod cu zi / lună / an); altfel null. */
export function cellSerial(raw: string | undefined, res: Result | undefined, st: CellStyle | undefined): number | null {
  const isDate = (st?.fmt && DATE_FMTS.includes(st.fmt)) || (!!st?.code && /[dy]|m{3,}/i.test(st.code.replace(/"[^"]*"|\[[^\]]*\]/g, '')));
  if (!isDate) return null;
  const n = res ? (res.err || !res.num ? NaN : Number(res.value)) : raw && /^\s*\d+([.,]\d+)?\s*$/.test(raw) ? Number(raw.trim().replace(',', '.')) : NaN;
  return Number.isFinite(n) && n >= 1 && n < 2958466 ? Math.floor(n) : null;
}

/** Numerele zilelor din coloana c, pe rândurile r0…r1 (fără cele din `skip`). */
export function columnSerials(cells: Cells, results: Results, styles: Styles, c: number, r0: number, r1: number, skip?: Set<number>): number[] {
  const out: number[] = [];
  for (let r = r0; r <= r1; r++) {
    if (skip?.has(r)) continue;
    const id = cellId(r, c);
    const n = cellSerial(cells[id], results[id], styles[id]);
    if (n !== null) out.push(n);
  }
  return out;
}

/** Perioada (început, sfârșit, nume) în care cade ziua n, la nivelul ales. */
export function periodOf(n: number, level: TimeLevel): { from: number; to: number; label: string; group: string } {
  const d = toDate(n);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (level === 'y') return { from: toSerial(y, 0, 1), to: toSerial(y + 1, 0, 1) - 1, label: String(y), group: '' };
  if (level === 'q') { const q = Math.floor(m / 3); return { from: toSerial(y, q * 3, 1), to: toSerial(y, q * 3 + 3, 1) - 1, label: `T${q + 1}`, group: String(y) }; }
  if (level === 'm') return { from: toSerial(y, m, 1), to: toSerial(y, m + 1, 1) - 1, label: MONTHS[m], group: String(y) };
  return { from: Math.floor(n), to: Math.floor(n), label: String(d.getUTCDate()), group: `${MONTHS[m]} ${y}` };
}

/**
 * Toate perioadele de la prima la ultima dată din coloană, una după alta (și cele fără rânduri, ca să se vadă golurile),
 * cu numărul de rânduri din fiecare. Null dacă sunt prea multe (de exemplu zilele pe mulți ani).
 */
export function periods(serials: number[], level: TimeLevel, keep: number[] = []): TimePeriod[] | null {
  const all = [...serials, ...keep];
  if (!all.length) return [];
  let lo = Infinity, hi = -Infinity;
  for (const n of all) { if (n < lo) lo = n; if (n > hi) hi = n; }
  const out: TimePeriod[] = [];
  for (let p = periodOf(lo, level); p.from <= hi; p = periodOf(p.to + 1, level)) {
    out.push({ ...p, count: 0 });
    if (out.length > MAX_PERIODS) return null;
  }
  for (const n of serials) {
    let a = 0, b = out.length - 1;
    while (a < b) { const mid = (a + b + 1) >> 1; if (out[mid].from <= n) a = mid; else b = mid - 1; }
    out[a].count++;
  }
  return out;
}

/** Perioada aleasă, ca bucăți (prima și ultima perioadă, una singură dacă e aceeași), ca numele lunilor să se poată traduce pe ecran. */
export function rangeParts(from: number, to: number, level: TimeLevel): { label: string; group: string }[] {
  const a = periodOf(from, level), b = periodOf(to, level);
  return a.from === b.from ? [a] : [a, b];
}

/** Numele perioadei alese, pentru capul cronologiei: „mar. 2026 – iun. 2026”, „T2 2026”, „2025 – 2026”. */
export function rangeLabel(from: number, to: number, level: TimeLevel): string {
  const name = (n: number) => { const p = periodOf(n, level); return level === 'y' ? p.label : level === 'd' ? `${p.label} ${p.group}` : `${p.label} ${p.group}`; };
  const a = name(from), b = name(to);
  return a === b ? a : `${a} – ${b}`;
}

/** Cel mai potrivit nivel pentru o coloană: lunile, sau anii dacă lunile ar fi prea multe, sau zilele pentru o singură lună. */
export function bestLevel(serials: number[]): TimeLevel {
  if (!serials.length) return 'm';
  const months = periods(serials, 'm');
  if (!months) return 'y';
  if (months.length > 48) return 'y';
  if (months.length === 1) return 'd';
  return 'm';
}
