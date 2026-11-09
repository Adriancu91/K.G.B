// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import din text (.csv, .txt, .tsv, .prn): fișierele cu date pe care le primește un birou din România, de oriunde ar veni.
// Ghicește singur codificarea (UTF-8 cu sau fără BOM, UTF-16 „Text Unicode”, Windows-1250 / 1252, ISO-8859-2 / 16),
// separatorul („;”, „,”, Tab, „|”, „^”, lățime fixă), rândul „sep=;”, virgula sau punctul zecimal, ordinea din date,
// și păstrează ca text codurile cu zero în față, CNP-urile și telefoanele. Fereastra Import din text (TextImportDialog.tsx)
// arată ce s-a ghicit și lasă schimbarea fiecărei alegeri. Scris de la zero.
import { cellId, COLS, ROWS, type CellStyle } from './format';
import { formatNumber } from './formula';
import { asText, parseEntry, type NumFmt } from './numfmt';

export type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1250' | 'windows-1252' | 'iso-8859-2' | 'iso-8859-16';
export const ENCODINGS: [TextEncoding, string][] = [
  ['utf-8', 'UTF-8'],
  ['utf-16le', 'UTF-16 LE (Text Unicode)'],
  ['utf-16be', 'UTF-16 BE'],
  ['windows-1250', 'Windows-1250 (Europa Centrală, română)'],
  ['windows-1252', 'Windows-1252 (Europa de Vest)'],
  ['iso-8859-2', 'ISO-8859-2 (Latin 2)'],
  ['iso-8859-16', 'ISO-8859-16 (română)'],
];

/** Felul unei coloane la import: general (se recunosc numerele și datele), text, dată în ordinea aleasă, sau omisă. */
export type ColType = 'general' | 'text' | 'date' | 'skip';
export type DateOrder = 'dmy' | 'mdy' | 'ymd';

export interface TextOptions {
  encoding: TextEncoding;
  /** Un caracter („;”, „,”, Tab, „|”, spațiu…) sau „fixed” pentru coloane de lățime fixă. */
  sep: string;
  /** La lățime fixă: pozițiile (în caractere) unde începe fiecare coloană după prima. */
  breaks: number[];
  /** Separatoarele puse unul după altul contează ca unul singur. */
  mergeSeps: boolean;
  /** Caracterul de ghilimele („"”, „'” sau nimic). */
  quote: string;
  /** Primul rând adus (0 = de la început); „sep=;” de pe primul rând se sare singur. */
  start: number;
  /** Primul rând adus e capul de tabel (îngroșat). */
  header: boolean;
  decimal: ',' | '.';
  dates: DateOrder;
  /** Felul fiecărei coloane (lipsă = general). */
  types: ColType[];
}

export interface TextImportResult {
  cells: Record<string, string>;
  styles: Record<string, CellStyle>;
  colW: Record<string, number>;
  rows: number;
  cols: number;
  /** Rânduri sau coloane care nu au încăput în tabel. */
  cut: boolean;
}

const NBSP = String.fromCharCode(160);
const NNBSP = String.fromCharCode(0x202f);
const BOM = String.fromCharCode(0xfeff);

// ---------------------------------------------------------------- codificarea

const RO_LETTERS = new Set([...'ăâîșțşţĂÂÎȘȚŞŢ']);
const WEST_LETTERS = new Set([...'éèêëàáäçíìïñóòôöúùûüßÉÈÀÁÄÇÍÓÖÚÜÑ€„”“’‘–—…°«»·±²³µ×§©®']);

/** Cât de firesc arată un text decodat: literele românești și cele vestice obișnuite câștigă, semnele ciudate pierd. */
function plausibility(text: string): number {
  let s = 0;
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c < 128) continue;
    if (RO_LETTERS.has(ch)) s += 3;
    else if (WEST_LETTERS.has(ch)) s += 1;
    else if (c === 0xfffd || (c >= 0x80 && c < 0xa0)) s -= 6;
    else if (c === 160) s += 0;
    else s -= 1;
  }
  return s;
}

function utf16NoBom(data: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  const n = Math.min(data.length, 1000) & ~1;
  if (n < 4) return null;
  let even = 0, odd = 0;
  for (let i = 0; i < n; i += 2) { if (data[i] === 0) even++; if (data[i + 1] === 0) odd++; }
  if (odd > n / 4 && even < n / 50) return 'utf-16le';
  if (even > n / 4 && odd < n / 50) return 'utf-16be';
  return null;
}

/** Codificarea fișierului: după semnătura de la început (BOM), altfel după octeți. */
export function detectEncoding(data: Uint8Array): TextEncoding {
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) return 'utf-8';
  if (data[0] === 0xff && data[1] === 0xfe) return 'utf-16le';
  if (data[0] === 0xfe && data[1] === 0xff) return 'utf-16be';
  const wide = utf16NoBom(data);
  if (wide) return wide;
  let high = false;
  for (let i = 0; i < data.length; i++) if (data[i] >= 0x80) { high = true; break; }
  if (!high) return 'utf-8';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(data);
    return 'utf-8';
  } catch { /* nu e UTF-8 curat: se alege mai jos */ }
  // O bucată de cel mult 512 KB e destul ca să se vadă felul literelor.
  const sample = data.subarray(0, 512 * 1024);
  const cands: TextEncoding[] = ['windows-1250', 'windows-1252', 'iso-8859-2', 'iso-8859-16', 'utf-8'];
  let best: TextEncoding = 'windows-1250';
  let bestScore = -Infinity;
  for (const enc of cands) {
    let score: number;
    try { score = plausibility(new TextDecoder(enc).decode(sample)); } catch { continue; }
    if (score > bestScore) { best = enc; bestScore = score; }
  }
  return best;
}

/** Octeții → text, în codificarea dată (fără semnătura BOM de la început). */
export function decodeText(data: Uint8Array, enc: TextEncoding): string {
  let text: string;
  try { text = new TextDecoder(enc).decode(data); } catch { text = new TextDecoder('utf-8').decode(data); }
  return text.startsWith(BOM) ? text.slice(1) : text;
}

/** Fișierul începe cu semnătura codificării (BOM): EF BB BF, FF FE sau FE FF. */
export function hasBom(data: Uint8Array): boolean {
  return (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) || (data[0] === 0xff && data[1] === 0xfe) || (data[0] === 0xfe && data[1] === 0xff);
}

/**
 * Text → octeți, în codificarea dată (pentru un fișier scris înapoi cum era). La codificările pe un octet, literele care nu
 * există în ea (de exemplu „ș” în Windows-1252) nu se pot scrie: atunci `lost` > 0 și cine cheamă alege altă codificare.
 */
export function encodeText(text: string, enc: TextEncoding, bom: boolean): { data: Uint8Array; lost: number } {
  if (enc === 'utf-8') return { data: new TextEncoder().encode((bom ? BOM : '') + text), lost: 0 };
  if (enc === 'utf-16le' || enc === 'utf-16be') {
    const s = (bom ? BOM : '') + text;
    const out = new Uint8Array(s.length * 2);
    const le = enc === 'utf-16le';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      out[2 * i + (le ? 0 : 1)] = c & 0xff;
      out[2 * i + (le ? 1 : 0)] = c >> 8;
    }
    return { data: out, lost: 0 };
  }
  // Tabelul invers al codificării pe un octet, din decodorul ei.
  const table = new Map<string, number>();
  const all = new Uint8Array(256).map((_, i) => i);
  const chars = new TextDecoder(enc).decode(all);
  for (let i = 0; i < 256 && i < chars.length; i++) if (chars[i] !== '�' && !table.has(chars[i])) table.set(chars[i], i);
  // „ş” / „ţ” (cu sedilă) și „ș” / „ț” (cu virgulă) sunt aceeași literă pentru cine citește: se scrie cea care există.
  const alt: Record<string, string> = { 'ș': 'ş', 'ş': 'ș', 'ț': 'ţ', 'ţ': 'ț', 'Ș': 'Ş', 'Ş': 'Ș', 'Ț': 'Ţ', 'Ţ': 'Ț' };
  const out = new Uint8Array(text.length);
  let lost = 0;
  for (let i = 0; i < text.length; i++) {
    const b = table.get(text[i]) ?? (alt[text[i]] !== undefined ? table.get(alt[text[i]]) : undefined);
    if (b === undefined) { lost++; out[i] = 0x3f; } else out[i] = b;
  }
  return { data: out, lost };
}

// ---------------------------------------------------------------- separatorul

const SEP_LINE = /^sep=(.)[ \t]*$/i;

/** Primele rânduri (pentru ghicit), cu numărul fiecărui separator în afara ghilimelelor. */
function sampleLines(text: string, max = 60): string[] {
  const lines: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length && lines.length < max && i < 256 * 1024; i++) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      lines.push(cur);
      cur = '';
      continue;
    }
    cur += quoted && ch !== '"' ? (ch === '\n' || ch === '\r' ? ' ' : ch) : ch;
  }
  if (cur && lines.length < max) lines.push(cur);
  return lines;
}

function countOutside(line: string, sep: string): number {
  let n = 0, q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch === sep) n++; }
  return n;
}

/** Cât de bine împarte un separator rândurile: partea rândurilor cu același număr de separatoare (și acel număr). */
function sepFit(lines: string[], sep: string): { fit: number; per: number } {
  const counts = lines.filter((l) => l.trim()).map((l) => countOutside(l, sep));
  if (!counts.length) return { fit: 0, per: 0 };
  const freq = new Map<number, number>();
  for (const c of counts) if (c > 0) freq.set(c, (freq.get(c) ?? 0) + 1);
  let per = 0, hits = 0;
  for (const [c, f] of freq) if (f > hits || (f === hits && c > per)) { per = c; hits = f; }
  // Rândurile cu mai multe separatoare decât de obicei (un text cu „;” în el) nu strică mult; cele fără deloc strică.
  const near = counts.filter((c) => c >= per && c > 0).length;
  return { fit: per ? (hits + near) / 2 / counts.length : 0, per };
}

/** Coloanele unui text aliniat cu spații (rapoarte .prn / .txt): pozițiile unde începe fiecare coloană după prima. */
export function detectBreaks(lines: string[]): number[] {
  const rows = lines.filter((l) => l.trim());
  if (rows.length < 2) return [];
  const width = Math.max(...rows.map((l) => l.length));
  const blank: boolean[] = [];
  for (let p = 0; p < width; p++) blank[p] = rows.every((l) => p >= l.length || l[p] === ' ');
  const out: number[] = [];
  let gap = 0;
  for (let p = 0; p < width; p++) {
    if (blank[p]) { gap++; continue; }
    if (gap >= 2 && p - gap > 0) out.push(p);
    gap = 0;
  }
  return out;
}

export interface SepGuess { sep: string; breaks: number[]; mergeSeps: boolean; skipFirst: boolean }

/** Ghicește separatorul (sau lățimea fixă). Un rând „sep=;” la început (scris de unele programe de tabele) are întâietate. */
export function detectSeparator(text: string): SepGuess {
  const lines = sampleLines(text);
  const m = lines.length ? SEP_LINE.exec(lines[0]) : null;
  if (m) return { sep: m[1], breaks: [], mergeSeps: false, skipFirst: true };
  // La egalitate: „;” (obișnuit în România), apoi Tab, „,”, „|”, „^”.
  const order = [';', '\t', ',', '|', '^'];
  let best = '', bestFit = 0, bestPer = 0;
  for (const s of order) {
    const { fit, per } = sepFit(lines, s);
    if (fit > bestFit + 0.05 || (fit > bestFit - 0.05 && fit > 0 && !best)) { best = s; bestFit = fit; bestPer = per; }
  }
  // Separatorul de pe fiecare rând câștigă; unul care lipsește din unele rânduri (de exemplu virgula zecimală dintr-un raport
  // aliniat cu spații, fără virgulă în capul de tabel) cedează în fața coloanelor de lățime fixă.
  if (best && bestFit >= 0.9 && bestPer > 0) return { sep: best, breaks: [], mergeSeps: false, skipFirst: false };
  const breaks = detectBreaks(lines);
  if (breaks.length) return { sep: 'fixed', breaks, mergeSeps: false, skipFirst: false };
  if (best && bestFit >= 0.6 && bestPer > 0) return { sep: best, breaks: [], mergeSeps: false, skipFirst: false };
  if (best && bestFit >= 0.3) return { sep: best, breaks: [], mergeSeps: false, skipFirst: false };
  return { sep: lines.length > 1 && lines.every((l) => !l.includes(';')) && lines.some((l) => l.includes('\t')) ? '\t' : ';', breaks: [], mergeSeps: false, skipFirst: false };
}

// ---------------------------------------------------------------- împărțirea în celule

/**
 * Textul → rânduri de celule, după alegeri. Ghilimelele țin la un loc separatoarele, ghilimelele dublate și rândurile noi
 * din celulă. O ghilimea deschisă și neînchisă până la sfârșit se citește ca un caracter obișnuit (nu înghite restul fișierului).
 * `max` oprește citirea după atâtea rânduri (pentru previzualizarea fișierelor mari).
 */
export function splitText(text: string, o: Pick<TextOptions, 'sep' | 'breaks' | 'mergeSeps' | 'quote' | 'start'>, max = Infinity): string[][] {
  const limit = max === Infinity ? Infinity : o.start + max;
  let rows: string[][];
  if (o.sep === 'fixed') {
    rows = [];
    const cuts = [...new Set(o.breaks)].filter((b) => b > 0).sort((a, b) => a - b);
    let at = 0;
    while (at <= text.length && rows.length < limit) {
      let end = text.indexOf('\n', at);
      const cr = text.indexOf('\r', at);
      let next: number;
      if (cr >= 0 && (end < 0 || cr < end)) { end = cr; next = text[cr + 1] === '\n' ? cr + 2 : cr + 1; }
      else if (end >= 0) next = end + 1;
      else { end = text.length; next = text.length + 1; }
      const line = text.slice(at, end);
      if (!(end === text.length && line === '')) {
        const cells: string[] = [];
        let prev = 0;
        for (const c of [...cuts, Infinity]) { cells.push(line.slice(prev, c === Infinity ? undefined : c).trim()); prev = c; if (prev >= line.length) break; }
        rows.push(cells);
      }
      at = next;
    }
  } else {
    const literal = new Set<number>();
    for (let tries = 0; ; tries++) {
      const res = parseDelimited(text, o.sep, o.quote, o.mergeSeps, literal, limit);
      rows = res.rows;
      if (res.open < 0 || tries > 50) break;
      literal.add(res.open);
    }
  }
  // Rândurile goale de la sfârșit nu se aduc.
  while (rows.length && rows[rows.length - 1].every((v) => v === '')) rows.pop();
  return rows.slice(o.start);
}

/** Citește textul cu separator; `open` = locul unei ghilimele rămase deschise la sfârșit (sau -1). */
function parseDelimited(text: string, sep: string, quote: string, merge: boolean, literal: Set<number>, limit: number): { rows: string[][]; open: number } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false; // după ghilimelele de închidere: spațiile până la separator nu mai intră în celulă
  let openAt = -1;
  let started = false; // celula are deja ceva (în afară de spațiile de la început)
  const endCell = () => {
    if (!(merge && cell === '' && !started)) row.push(cell);
    cell = ''; started = false; closed = false;
  };
  const endRow = () => {
    if (!merge || cell !== '' || started || !row.length) row.push(cell);
    rows.push(row);
    row = []; cell = ''; started = false; closed = false;
  };
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === quote) {
        if (text[i + 1] === quote) { cell += quote; i++; } else { quoted = false; closed = true; }
      } else cell += ch;
      continue;
    }
    if (quote && ch === quote && !started && !literal.has(i)) {
      // Spațiile dinaintea ghilimelelor de deschidere nu fac parte din celulă.
      cell = '';
      quoted = true;
      started = true;
      openAt = i;
      continue;
    }
    if (ch === sep) { endCell(); continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
      if (rows.length >= limit) return { rows, open: -1 };
      continue;
    }
    if (closed && (ch === ' ' || ch === '\t')) continue;
    cell += ch;
    if (ch !== ' ') started = true;
  }
  if (quoted) return { rows, open: openAt };
  if (cell !== '' || row.length || started) endRow();
  return { rows, open: -1 };
}

// ---------------------------------------------------------------- valorile

const EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86400000;

function serialOf(y: number, mo: number, d: number): number | null {
  if (y < 100) y += y < 50 ? 2000 : 1900;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 9999) return null;
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCDate() !== d || back.getUTCMonth() !== mo - 1) return null;
  return Math.round((t - EPOCH) / DAY_MS);
}

const TIME_TAIL = /(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?)?$/;
const ISO_DATE = new RegExp('^(\\d{4})[-./](\\d{1,2})[-./](\\d{1,2})' + TIME_TAIL.source);
const DMY_DATE = new RegExp('^(\\d{1,2})[-./](\\d{1,2})[-./](\\d{2}|\\d{4})' + TIME_TAIL.source);

/** O dată (cu oră, opțional) în ordinea dată → { serial, cu oră }; ISO (2026-10-28) se recunoaște mereu. */
export function parseDate(text: string, order: DateOrder): { v: number; time: boolean } | null {
  const t = text.trim();
  let y: number, mo: number, d: number;
  if (t.length < 6 || t.length > 30 || !/^\d/.test(t)) return null;
  let m = ISO_DATE.exec(t);
  let rest: RegExpExecArray | null = null;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; rest = m; }
  else {
    m = DMY_DATE.exec(t);
    if (!m || order === 'ymd') return null;
    // „28.10.26” cu an din două cifre: doar cu punct (obișnuit în România) sau oblică.
    if (m[3].length === 2 && /-/.test(t.slice(0, 8))) return null;
    y = +m[3];
    if (order === 'mdy') { mo = +m[1]; d = +m[2]; } else { d = +m[1]; mo = +m[2]; }
    rest = m;
  }
  const day = serialOf(y, mo, d);
  if (day === null) return null;
  const [hh, mm, ss] = [rest[4], rest[5], rest[6]];
  if (hh === undefined) return { v: day, time: false };
  if (+hh > 23 || +mm > 59 || +(ss ?? 0) > 59) return null;
  return { v: day + (+hh * 3600 + +mm * 60 + +(ss ?? 0)) / 86400, time: true };
}

const GROUPED: Record<string, RegExp> = { '.': /^\d{1,3}(\.\d{3})+$/, ',': /^\d{1,3}(,\d{3})+$/, ' ': /^\d{1,3}( \d{3})+$/, "'": /^\d{1,3}('\d{3})+$/ };

export interface NumRead { n: number; fmt?: NumFmt; dec?: number }

/**
 * Un număr scris în text, cu zecimalele după alegere („,” sau „.”). Merg miile cu punct, virgulă, spațiu sau apostrof,
 * semnul în față sau în spate, parantezele contabile, „%”, „lei”, „RON”, „€”, „EUR”. Numărul cu trei cifre după
 * separatorul care nu e cel zecimal („1.234” la virgulă zecimală) e cu mii; cu una, două sau patru cifre e zecimal oricum.
 */
export function parseNumber(text: string, decimal: ',' | '.'): NumRead | null {
  let t = text.trim();
  // Calea scurtă pentru numerele simple (cele mai multe dintr-un fișier mare).
  if (/^-?\d{1,11}$/.test(t)) return { n: Number(t) };
  if (decimal === ',' ? /^-?\d{1,11},\d{1,10}$/.test(t) : /^-?\d{1,11}\.\d{1,10}$/.test(t)) return { n: Number(t.replace(',', '.')) };
  if (!t || t.length > 40 || !/\d/.test(t) || !/^[-+(€.,\d]|^(lei|ron|eur)/i.test(t)) return null;
  if (t.includes(NBSP) || t.includes(NNBSP)) t = t.split(NBSP).join(' ').split(NNBSP).join(' ');
  let neg = false;
  let fmt: NumFmt | undefined;
  let m = /^\((.+)\)$/.exec(t);
  if (m) { neg = true; t = m[1].trim(); }
  m = /^(.+?)\s*%$/.exec(t);
  if (m) { fmt = 'percent'; t = m[1]; }
  else {
    m = /^(.+?)\s*(lei|ron)$/i.exec(t) ?? /^(?:lei|ron)\s*(.+)$/i.exec(t);
    if (m) { fmt = 'lei'; t = m[1]; }
    else {
      m = /^(.+?)\s*(€|eur|euro)$/i.exec(t) ?? /^(?:€|eur)\s*(.+)$/i.exec(t);
      if (m) { fmt = 'eur'; t = m[1]; }
    }
  }
  t = t.trim();
  if (/^[-+]/.test(t)) { if (t[0] === '-') neg = !neg; t = t.slice(1).trim(); }
  else if (/-$/.test(t)) { neg = !neg; t = t.slice(0, -1).trim(); }
  if (!/^[\d.,' ]+([eE][-+]?\d+)?$/.test(t) || !/^\d|^[.,]\d/.test(t)) return null;
  const other = decimal === ',' ? '.' : ',';
  let body = t, exp = '';
  const e = /^(.+?)([eE][-+]?\d+)$/.exec(t);
  if (e) { body = e[1]; exp = e[2]; }
  let intPart: string, frac = '';
  const grouped = (s: string, g: string) => GROUPED[g].test(s);
  const di = body.lastIndexOf(decimal);
  if (di >= 0 && body.indexOf(decimal) === di) {
    intPart = body.slice(0, di); frac = body.slice(di + 1);
    if (!/^\d*$/.test(frac)) return null;
  } else if (di >= 0) return null;
  else intPart = body;
  let isGrouped = false;
  if (/^\d*$/.test(intPart)) { /* simplu */ }
  else if (grouped(intPart, other) || grouped(intPart, ' ') || grouped(intPart, "'")) { isGrouped = true; intPart = intPart.replace(/[.,' ]/g, ''); }
  else if (!frac && di < 0 && (other === '.' ? /^\d+\.(\d{1,2}|\d{4,})$/ : /^\d+,(\d{1,2}|\d{4,})$/).test(intPart)) {
    // Celălalt separator, cu un număr de zecimale care nu poate fi de mii („12.50” la virgulă zecimală): tot zecimal.
    const k = intPart.indexOf(other);
    frac = intPart.slice(k + 1); intPart = intPart.slice(0, k);
  } else return null;
  if (intPart === '' && frac === '') return null;
  if (exp && isGrouped) return null;
  const n = Number((intPart || '0') + (frac ? '.' + frac : '') + exp);
  if (!Number.isFinite(n)) return null;
  const v = neg ? -n : n;
  if (fmt === 'percent') return { n: v / 100, fmt };
  if (fmt) return { n: v, fmt, ...(frac ? { dec: Math.min(frac.length, 10) } : {}) };
  if (isGrouped) return { n: v, fmt: 'number', dec: Math.min(frac.length, 10) };
  return { n: v };
}

/** Codurile care trebuie să rămână text: zero în față (cod poștal, cont, „007”), telefon cu „+”, șiruri lungi de cifre (CNP, IBAN numeric). */
export function isCodeLike(text: string): boolean {
  const t = text.trim();
  if (/^0\d+$/.test(t)) return true;
  if (/^\+\d[\d ]{6,}$/.test(t)) return true;
  if (/^\d{12,}$/.test(t)) return true;
  // Telefon scris pe grupe, cu zero în față: „0722 123 456”, „021-123.45.67”.
  if (/^0\d{2,4}([ .-]\d{2,4}){1,3}$/.test(t)) return true;
  return false;
}

export interface CellValue { raw: string; fmt?: NumFmt; dec?: number }

/** O valoare din fișier → ce se scrie în celulă (număr, dată, text), după felul coloanei. */
export function convertValue(v: string, type: ColType, o: Pick<TextOptions, 'decimal' | 'dates'>): CellValue | null {
  if (type === 'skip') return null;
  const t = v.trim();
  if (t === '') return null;
  if (type === 'text') return { raw: asText(v), fmt: 'text' };
  // Textul obișnuit (începe cu o literă) nu e nici număr, nici dată: calea scurtă.
  const c0 = t.charCodeAt(0);
  if (c0 > 64 && c0 !== 8364 && !/^(lei|ron|eur)/i.test(t)) return { raw: v };
  const d = parseDate(v, o.dates);
  if (d) return { raw: formatNumber(Math.round(d.v * 1e10) / 1e10), fmt: d.time ? 'datetime' : 'date' };
  if (type === 'date') return { raw: v };
  // Formulele din fișier nu se calculează (pot fi periculoase): rămân text.
  if (c0 === 61 || c0 === 64) return { raw: "'" + v };
  if (isCodeLike(v)) return { raw: asText(v.trim()) };
  const n = parseNumber(v, o.decimal);
  if (n) return { raw: formatNumber(n.n), ...(n.fmt ? { fmt: n.fmt } : {}), ...(n.dec !== undefined && n.fmt && n.fmt !== 'percent' ? { dec: n.dec } : {}) };
  // Ora („14:30”) și restul: ca la scrierea în celulă, fără să devină număr ce nu e număr.
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) { const e = parseEntry(t); return { raw: e.raw, ...(e.fmt ? { fmt: e.fmt } : {}), ...(e.dec !== undefined ? { dec: e.dec } : {}) }; }
  // Un text care, scris așa, s-ar citi ca număr în tabel (de exemplu „1.234” ambiguu) primește apostroful de text.
  if (/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return { raw: "'" + v };
  return { raw: v };
}

// ---------------------------------------------------------------- ghicitul complet

/** Virgula sau punctul zecimal, după numerele din fișier; la nehotărâre, după separator. */
export function detectDecimal(rows: string[][], sep: string): ',' | '.' {
  let comma = 0, point = 0;
  for (const r of rows.slice(0, 200)) for (const raw of r) {
    const v = raw.trim().replace(/\s*(%|lei|ron|€|eur)$/i, '');
    if (!/^[-+(]?[\d.,' ]+\)?-?$/.test(v) || !/\d/.test(v)) continue;
    if (/\d\.\d{3},\d+$/.test(v) || /^[-+(]?\d+,\d{1,2}\)?-?$/.test(v) || /^[-+(]?\d+,\d{4,}\)?-?$/.test(v)) comma++;
    else if (/\d,\d{3}\.\d+$/.test(v) || /^[-+(]?\d+\.\d{1,2}\)?-?$/.test(v) || /^[-+(]?\d+\.\d{4,}\)?-?$/.test(v)) point++;
  }
  if (comma > point) return ',';
  if (point > comma) return '.';
  return sep === ',' ? '.' : ',';
}

/** Ordinea din date: zi-lună-an (obișnuit în România), afară de cazul în care valorile arată clar lună-zi-an. */
export function detectDateOrder(rows: string[][]): DateOrder {
  let dmy = 0, mdy = 0, any = 0, iso = 0;
  for (const r of rows.slice(0, 300)) for (const v of r) {
    const t = v.trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(t)) { iso++; continue; }
    const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/.exec(t);
    if (!m) continue;
    any++;
    if (+m[1] > 12 && +m[2] <= 12) dmy++;
    if (+m[2] > 12 && +m[1] <= 12) mdy++;
  }
  if (!any && iso) return 'ymd';
  return mdy > dmy ? 'mdy' : 'dmy';
}

const looksValue = (v: string, o: Pick<TextOptions, 'decimal' | 'dates'>) => {
  const c = convertValue(v, 'general', o);
  return !!c && !!(c.fmt && c.fmt !== 'text') || (!!c && /^-?\d+(,\d+)?$/.test(c.raw));
};

/** Primul rând e cap de tabel: doar texte, iar sub el, în aceleași coloane, apar numere sau date. */
export function detectHeader(rows: string[][], o: Pick<TextOptions, 'decimal' | 'dates'>): boolean {
  if (rows.length < 2) return false;
  const first = rows[0];
  const filled = first.filter((v) => v.trim());
  if (!filled.length || filled.some((v) => looksValue(v, o) || isCodeLike(v))) return false;
  for (const r of rows.slice(1, 30)) for (let c = 0; c < r.length; c++) if (first[c]?.trim() && looksValue(r[c], o)) return true;
  // Fără numere: cap de tabel dacă textele de sus sunt scurte, diferite, și toate coloanele au nume.
  const names = new Set(filled.map((v) => v.trim().toLowerCase()));
  return filled.length >= 2 && filled.length === first.length && names.size === filled.length
    && filled.every((v) => v.length <= 40) && rows.slice(1, 30).some((r) => r.some((v, c) => v.trim() && v.trim() !== first[c]?.trim()));
}

export interface Analysis { options: TextOptions; text: string }

/** Totul ghicit dintr-o dată: codificarea, separatorul, rândul de început, zecimalele, datele și capul de tabel. */
export function analyzeText(data: Uint8Array): Analysis {
  const encoding = detectEncoding(data);
  const text = decodeText(data, encoding);
  return { text, options: guessOptions(text, encoding) };
}

/** Alegerile ghicite pentru un text deja decodat (și la schimbarea codificării din fereastră). */
export function guessOptions(text: string, encoding: TextEncoding): TextOptions {
  const g = detectSeparator(text);
  const base = { sep: g.sep, breaks: g.breaks, mergeSeps: g.mergeSeps, quote: '"', start: g.skipFirst ? 1 : 0 };
  const sample = splitText(text, base, 300);
  const decimal = detectDecimal(sample, g.sep);
  const dates = detectDateOrder(sample);
  const header = detectHeader(sample, { decimal, dates });
  return { encoding, ...base, header, decimal, dates, types: [] };
}

// ---------------------------------------------------------------- rândurile → celule

/** Rândurile → celulele tabelului: valorile după felul coloanei, capul de tabel îngroșat, lățimea coloanelor după conținut. */
export function rowsToCells(rows: string[][], o: TextOptions): TextImportResult {
  const cells: Record<string, string> = {};
  const styles: Record<string, CellStyle> = {};
  const widths: number[] = [];
  let cut = rows.length > ROWS;
  let cols = 0;
  // Coloanele omise dispar (cele din dreapta lor se mută la stânga).
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  const target: number[] = [];
  for (let c = 0, t = 0; c < width; c++) target[c] = o.types[c] === 'skip' ? -1 : t++;
  const n = Math.min(rows.length, ROWS);
  const letters: string[] = [];
  const colL = (c: number) => letters[c] ?? (letters[c] = cellId(0, c).replace(/\d+$/, ''));
  for (let r = 0; r < n; r++) {
    const row = rows[r];
    const head = o.header && r === 0;
    for (let c = 0; c < row.length; c++) {
      const tc = target[c];
      if (tc < 0) continue;
      if (tc >= COLS) { if (row[c].trim()) cut = true; continue; }
      const v = row[c];
      const val: CellValue | null = !head ? convertValue(v, o.types[c] ?? 'general', o)
        : !v.trim() ? null : { raw: /^[=@]/.test(v.trim()) || /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(v.trim()) ? "'" + v : v };
      if (!val) continue;
      const id = colL(tc) + (r + 1);
      cells[id] = val.raw;
      const st: CellStyle = {};
      if (val.fmt) st.fmt = val.fmt;
      if (val.dec !== undefined) st.dec = val.dec;
      if (head) st.b = true;
      if (v.includes('\n')) st.wrap = true;
      if (st.fmt || st.b || st.wrap) styles[id] = st;
      if (tc >= cols) cols = tc + 1;
      if (r < 2000) widths[tc] = Math.max(widths[tc] ?? 0, ...v.split('\n').map((l) => l.length));
    }
  }
  const colW: Record<string, number> = {};
  widths.forEach((len, c) => {
    if (len > 10) colW[colL(c)] = Math.round(Math.min(360, len * 7.2 + 18));
  });
  return { cells, styles, colW, rows: n, cols, cut };
}

/** Tot importul dintr-o dată: octeții fișierului, cu alegerile date (sau ghicite). */
export function importText(data: Uint8Array, opts?: Partial<TextOptions>): TextImportResult & { options: TextOptions } {
  const enc = opts?.encoding ?? detectEncoding(data);
  const text = decodeText(data, enc);
  const options: TextOptions = { ...guessOptions(text, enc), ...opts, encoding: enc };
  return { ...rowsToCells(splitText(text, options), options), options };
}

/**
 * Un fișier .txt arată ca un tabel (de deschis în Sheets, nu în Docs)? Da pentru „Text Unicode” cu Tab-uri și pentru
 * textele în care fiecare rând are același număr de Tab-uri, „;” sau „|” (cel puțin două rânduri).
 */
export function looksLikeTable(data: Uint8Array): boolean {
  const enc = detectEncoding(data.subarray(0, 64 * 1024));
  const text = decodeText(data.subarray(0, 64 * 1024), enc);
  const lines = sampleLines(text, 40).filter((l) => l.trim());
  if (lines.length < 2) return false;
  for (const s of ['\t', ';', '|']) {
    const counts = lines.map((l) => countOutside(l, s));
    const min = Math.min(...counts);
    if (min >= (s === '\t' ? 1 : 2) && counts.filter((c) => c === counts[0]).length >= lines.length * 0.9) return true;
  }
  return false;
}

/** Numele separatorului, pentru mesaje. */
export function sepName(sep: string): string {
  if (sep === 'fixed') return 'lățime fixă';
  if (sep === '\t') return 'Tab';
  if (sep === ' ') return 'spațiu';
  return `„${sep}”`;
}
