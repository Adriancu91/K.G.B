// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formatul numerelor din celule (1.234,56, lei, %, dată zz.ll.aaaa) și recunoașterea lor la scriere.
import { formatNumber } from './formula';

export type NumFmt = 'general' | 'number' | 'lei' | 'acct' | 'eur' | 'percent' | 'date' | 'datelong' | 'time' | 'datetime' | 'sci' | 'fraction' | 'text';

export const NUM_FORMATS: [NumFmt, string][] = [
  ['general', 'General'],
  ['number', 'Număr 1.234,56'],
  ['lei', 'Lei 1.234,56 lei'],
  ['acct', 'Contabil 1.234,56 lei (zero: - lei)'],
  ['eur', 'Euro 1.234,56 €'],
  ['percent', 'Procent 12%'],
  ['date', 'Dată 31.12.2026'],
  ['datelong', 'Dată lungă 31 decembrie 2026'],
  ['time', 'Oră 13:30'],
  ['datetime', 'Dată și oră 31.12.2026 13:30'],
  ['sci', 'Științific 1,23E+04'],
  ['fraction', 'Fracție 1 1/4'],
  ['text', 'Text (exact cum e scris: 00123, 0722…)'],
];

/** Formatele de dată și oră (zecimalele nu se schimbă ca la numere; la oră, ,00 adaugă secundele). */
export const DATE_FMTS: NumFmt[] = ['date', 'datelong', 'datetime'];

/** Câte zecimale arată fiecare format, dacă nu le-ai schimbat cu butoanele ,0 / ,00. */
export const DEFAULT_DEC: Record<NumFmt, number> = { general: 0, number: 2, lei: 2, acct: 2, text: 0, eur: 2, percent: 0, date: 0, datelong: 0, time: 0, datetime: 0, sci: 2, fraction: 0 };

const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

/** Partea de oră a unui număr de zi (0,5 = 12:00), ca „12:00” sau, cu secunde, „12:00:00”. */
export function serialToTime(n: number, seconds = false): string {
  let s = Math.round((n - Math.floor(n)) * 86400);
  if (!seconds) s = Math.round(s / 60) * 60;
  if (s >= 86400) s -= 86400;
  const p = (x: number) => String(x).padStart(2, '0');
  const t = `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}`;
  return seconds ? `${t}:${p(s % 60)}` : t;
}

/** 12345 → „1,23E+04” (cu virgulă, ca în Excel românesc). */
export function scientific(n: number, dec: number): string {
  if (n === 0) return (0).toFixed(dec).replace('.', ',') + 'E+00';
  const [m, e] = n.toExponential(dec).split('e');
  const exp = Number(e);
  return m.replace('.', ',') + 'E' + (exp < 0 ? '-' : '+') + String(Math.abs(exp)).padStart(2, '0');
}

/** 1,25 → „1 1/4”, cu numitorul de cel mult o cifră (ca „# ?/?” din Excel). */
export function fraction(n: number): string {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  let int = Math.floor(a);
  const frac = a - int;
  let best = { num: 0, den: 1, err: frac };
  for (let den = 1; den <= 9; den++) {
    const num = Math.round(frac * den);
    const err = Math.abs(frac - num / den);
    if (err < best.err - 1e-12) best = { num, den, err };
  }
  if (best.num === best.den) { int++; best.num = 0; }
  if (!best.num) return sign + String(int);
  return sign + (int ? `${int} ` : '') + `${best.num}/${best.den}`;
}

const DAY_MS = 86400000;
// Ziua 0 din Excel; așa datele copiate între Excel și Suite rămân aceleași numere.
const EPOCH = Date.UTC(1899, 11, 30);

/** 12345,678 cu 2 zecimale → „12.345,68”. */
export function grouped(n: number, dec: number): string {
  const [int, frac] = Math.abs(n).toFixed(dec).split('.');
  const body = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (frac ? ',' + frac : '');
  return (n < 0 && Number(body.replace(/\./g, '').replace(',', '.')) !== 0 ? '-' : '') + body;
}

export function serialToDate(n: number): string {
  const d = new Date(EPOCH + Math.floor(n) * DAY_MS);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** „17.10.2026” sau „17/10/2026” → numărul zilei (ca în Excel), sau null dacă nu e o dată reală. */
export function dateToSerial(text: string): number | null {
  const m = /^\s*(\d{1,2})[./](\d{1,2})[./](\d{4})\s*$/.exec(text);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCDate() !== d || back.getUTCMonth() !== mo - 1) return null; // de exemplu 31.02
  return Math.round((t - EPOCH) / DAY_MS);
}

export function formatValue(n: number, fmt: NumFmt, dec?: number): string {
  const k = dec ?? DEFAULT_DEC[fmt];
  switch (fmt) {
    case 'number': return grouped(n, k);
    case 'lei': return grouped(n, k) + ' lei';
    // Contabil: zero se scrie cu o liniuță, ca în rapoartele contabile.
    case 'acct': return (Math.abs(n) < 0.5 * 10 ** -k ? '-' : grouped(n, k)) + ' lei';
    case 'eur': return grouped(n, k) + ' €';
    case 'percent': return grouped(n * 100, k) + '%';
    case 'date': return serialToDate(n);
    case 'datelong': { const d = new Date(EPOCH + Math.floor(n) * DAY_MS); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
    case 'time': return serialToTime(n, (dec ?? 0) > 0);
    case 'datetime': return `${serialToDate(n)} ${serialToTime(n, (dec ?? 0) > 0)}`;
    case 'sci': return scientific(n, k);
    case 'fraction': return fraction(n);
    default: return formatNumber(n);
  }
}

/**
 * Ce ai scris într-o celulă, recunoscut ca în Excel: „17.10.2026” devine dată, „15%” procent,
 * „1.234,56” sau „250 lei” număr. Celula păstrează numărul simplu, iar formatul se pune separat.
 */
/** Ce se scrie într-o celulă cu formatul Text: exact textul, cu apostrof în față (nu devine număr, dată sau formulă). */
export const asText = (text: string) => (text === '' || text.startsWith("'") ? text : "'" + text);

/** Un text din alt fișier care, scris așa, ar deveni număr, valoare logică sau formulă primește apostroful de text. */
export function keepText(text: string): string {
  const t = text.trim();
  return text.startsWith("'") || text.startsWith('=') || /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t) || /^(TRUE|FALSE|ADEV[ĂA]RAT|FALS)$/i.test(t) ? "'" + text : text;
}

export function parseEntry(text: string): { raw: string; fmt?: NumFmt; dec?: number } {
  const t = text.trim();
  if (!t || t.startsWith('=')) return { raw: text };
  const serial = dateToSerial(t);
  if (serial !== null) return { raw: String(serial), fmt: 'date' };
  const tm = /^(?:(\d{1,2}[./]\d{1,2}[./]\d{4})\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (tm && +tm[2] < 24 && +tm[3] < 60 && +(tm[4] ?? 0) < 60) {
    const day = tm[1] ? dateToSerial(tm[1]) : 0;
    if (day !== null) {
      const v = day + (+tm[2] * 3600 + +tm[3] * 60 + +(tm[4] ?? 0)) / 86400;
      return { raw: formatNumber(Math.round(v * 1e10) / 1e10), fmt: tm[1] ? 'datetime' : 'time', ...(tm[4] ? { dec: 1 } : {}) };
    }
  }
  // „1.234” rămâne cum era (1,234), ca până acum; doar „1.234,5” și „1.234.567” sunt cu puncte de mii.
  const isGrouped = (s: string) => /^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) && (s.includes(',') || s.split('.').length > 2);
  const num = (s: string) => {
    if (isGrouped(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
    return /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s) ? Number(s.replace(',', '.')) : NaN;
  };
  let m = /^(.+?)\s*%$/.exec(t);
  if (m && Number.isFinite(num(m[1]))) return { raw: formatNumber(num(m[1]) / 100), fmt: 'percent' };
  m = /^(.+?)\s*lei$/i.exec(t);
  if (m && Number.isFinite(num(m[1]))) return { raw: formatNumber(num(m[1])), fmt: 'lei' };
  // „250 €”, „250 EUR”, „250 euro” sau „€250”.
  m = /^(.+?)\s*(?:€|eur|euro)$/i.exec(t) ?? /^€\s*(.+)$/.exec(t);
  if (m && Number.isFinite(num(m[1]))) return { raw: formatNumber(num(m[1])), fmt: 'eur' };
  if (isGrouped(t)) return { raw: formatNumber(num(t)), fmt: 'number' };
  return { raw: text };
}
