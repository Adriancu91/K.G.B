// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import și export .csv, în formatul folosit în România: separator „;”, virgulă zecimală, dată zz.ll.aaaa.
import { CellStyle, cellId, COLS, isNumber, parseCellId, ROWS } from './format';
import { cellText } from './filter';
import { formatNumber, Result } from './formula';
import { parseEntry } from './numfmt';
import { decodeText, detectEncoding } from './textImport';

type Cells = Record<string, string>;
type Styles = Record<string, CellStyle>;

/**
 * Octeții fișierului → text. Codificarea se ghicește ca la Import din text (textImport.ts): UTF-8 cu sau fără BOM,
 * UTF-16 („Text Unicode”) cu sau fără semnătură, altfel Windows-1250 / 1252 sau ISO-8859-2 / 16, după literele care ies.
 */
export function decodeCsv(data: Uint8Array): string {
  return decodeText(data, detectEncoding(data));
}

/**
 * Ghicește separatorul după primele rânduri: „;”, „,” sau Tab (cel care apare cel mai des în afara ghilimelelor).
 * Separatoarele rare „|” și „^” (exporturi din programe de contabilitate, baze de date) câștigă doar dacă apar pe fiecare rând
 * și mai des decât celelalte, ca un „|” scris prin text să nu strice un CSV obișnuit.
 */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0, '|': 0, '^': 0 };
  const rare = ['|', '^'];
  // Pe câte rânduri cu text apare fiecare separator rar.
  const onLines: Record<string, number> = { '|': 0, '^': 0 };
  const seen = new Set<string>();
  let quoted = false;
  let lines = 0;
  let filled = 0;
  let empty = true;
  const endLine = () => {
    if (!empty) filled++;
    for (const d of seen) onLines[d]++;
    seen.clear();
    empty = true;
  };
  let i = 0;
  for (; i < text.length && lines < 20; i++) {
    const ch = text[i];
    if (ch === '"') { quoted = !quoted; empty = false; }
    else if (!quoted && ch === '\n') { lines++; endLine(); }
    else if (!quoted && ch in counts) { counts[ch]++; empty = false; if (rare.includes(ch)) seen.add(ch); }
    else if (ch !== '\r') empty = false;
  }
  if (i >= text.length) endLine();
  // La egalitate câștigă „;”, cel obișnuit în România.
  const best = [';', '\t', ','].reduce((b, d) => (counts[d] > counts[b] ? d : b), ';');
  const rareBest = rare.find((d) => filled > 0 && onLines[d] === filled && counts[d] > counts[best]);
  return rareBest ?? best;
}

/** Textul unui CSV → rânduri de celule (cu ghilimele, „""” în ghilimele și rânduri noi în celule). */
export function parseCsv(text: string, delim = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export interface CsvImport {
  cells: Cells;
  styles: Styles;
  rows: number;
  cols: number;
  /** Rânduri sau coloane care nu au încăput în tabel. */
  cut: boolean;
}

/** Rândurile CSV → celule; numerele, datele, procentele și sumele în lei se recunosc ca la scriere. */
export function csvToCells(rows: string[][], delim = ';'): CsvImport {
  const cells: Cells = {};
  const styles: Styles = {};
  let cut = rows.length > ROWS;
  let cols = 0;
  rows.slice(0, ROWS).forEach((row, r) => {
    if (row.length > COLS && row.slice(COLS).some((v) => v.trim())) cut = true;
    row.slice(0, COLS).forEach((v, c) => {
      if (v.trim() === '') return;
      const id = cellId(r, c);
      // Cu separatorul „,”, „|” sau „^” (exporturi internaționale), numerele au punct zecimal (1234.56); le păstrăm ca numere.
      const t = (delim === ',' || delim === '|' || delim === '^') && /^\s*[-+]?\d+\.\d+\s*$/.test(v) ? v.trim().replace('.', ',') : v;
      const e = parseEntry(t);
      cells[id] = e.raw;
      if (e.fmt) styles[id] = { fmt: e.fmt };
      cols = Math.max(cols, c + 1);
    });
  });
  return { cells, styles, rows: Math.min(rows.length, ROWS), cols, cut };
}

function quote(v: string, sep = ';'): string {
  return v.includes(sep) || /["\r\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Tabelul → text CSV cu „;”, pentru Excel în română. Se scriu valorile (rezultatele formulelor, nu formulele).
 * Sumele în lei și numerele cu mii se scriu simplu (1234,56), ca să rămână numere și în Excel.
 * Alt separator (un .csv adus cu „,”, Tab, „|” sau „^”, salvat înapoi peste el): la „,”, „|” și „^” numerele au punct
 * zecimal (1234.56), ca la citire (parseCsv), ca fișierul să rămână cum îl citesc programele care l-au făcut.
 */
export function cellsToCsv(cells: Cells, results: Record<string, Result>, styles: Styles, sep = ';'): string {
  const dot = sep === ',' || sep === '|' || sep === '^';
  let maxR = -1;
  let maxC = -1;
  for (const [id, v] of Object.entries(cells)) {
    const p = parseCellId(id);
    if (!v || !p || p.r >= ROWS || p.c >= COLS) continue;
    maxR = Math.max(maxR, p.r);
    maxC = Math.max(maxC, p.c);
  }
  const lines: string[] = [];
  for (let r = 0; r <= maxR; r++) {
    const out: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const id = cellId(r, c);
      const raw = cells[id];
      const res = results[id];
      const st = styles[id];
      let v: string;
      if ((st?.fmt === 'number' || st?.fmt === 'lei' || st?.fmt === 'eur') && !res?.err) {
        const n = res ? (res.num ? res.value : undefined) : raw && isNumber(raw) ? Number(raw.trim().replace(',', '.')) : undefined;
        v = n !== undefined ? formatNumber(n) : cellText(raw, res, st);
      } else v = cellText(raw, res, st);
      if (dot && /^-?\d+,\d+$/.test(v)) v = v.replace(',', '.');
      out.push(quote(v, sep));
    }
    lines.push(out.join(sep));
  }
  return lines.join('\r\n') + (lines.length ? '\r\n' : '');
}
