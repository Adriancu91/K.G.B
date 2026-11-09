// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// PDF → tabel Sheets: tabelele din PDF (facturi, extrase de cont, liste de prețuri) devin rânduri și coloane într-un tabel nou,
// cu numerele, datele, procentele și sumele în lei recunoscute ca la importul CSV (deci se pot aduna). Dacă PDF-ul nu are
// tabele, fiecare rând de text devine un rând, cu bucățile despărțite de spații mari în coloane separate.
// Folosește aceleași rânduri și coloane ca PDF → Docs (`toDoc.ts`). Tabelul e nou și nesalvat; îl salvezi din Sheets.
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { readPages, tableAt, tableCells, type Line } from './toDoc';
import { csvToCells } from '../sheets/csv';
import { colName, emptySheet, emptySheetDoc, type CellStyle } from '../sheets/format';

/** Rândurile tabelului (un rând gol între tabele) și câte tabele s-au găsit; `heads` = rândurile de început ale tabelelor. */
export function sheetRowsOf(pages: (Line[] | null)[]): { rows: string[][]; tables: number; heads: number[] } {
  const rows: string[][] = [];
  const heads: number[] = [];
  for (const lines of pages) {
    if (!lines) continue;
    for (let li = 0; li < lines.length; li++) {
      const t = tableAt(lines, li);
      if (!t) continue;
      if (rows.length) rows.push([]);
      heads.push(rows.length);
      rows.push(...tableCells(lines.slice(li, li + t.rows), t.cols));
      li += t.rows - 1;
    }
  }
  if (heads.length) return { rows, tables: heads.length, heads };
  // Fără tabele: tot textul, rând cu rând (un rând gol între pagini).
  pages.forEach((lines) => {
    if (!lines) return;
    if (rows.length) rows.push([]);
    for (const l of lines) rows.push(l.cells.length ? l.cells.map((c) => c.text) : [l.text.trim()]);
  });
  return { rows, tables: 0, heads: [] };
}

/** Numărul din celulă, cu ce e în jurul lui („$1,234.56”, „1.234,56 lei”, „-350.50 EUR”). */
const CORE = /^([^\d+-]*?)([-+]?\d[\d.,]*)(\s*[^\d.,]*)$/;
/** Sigur englezesc: „1,234.56” sau „350.50” (punct urmat de 1–2 cifre la sfârșit). */
const EN = /^[-+]?(\d{1,3}(,\d{3})+\.\d+|\d+\.\d{1,2})$/;
/** Sigur românesc: „1.234,56” sau „350,50”. */
const RO = /^[-+]?(\d{1,3}(\.\d{3})+,\d+|\d+,\d{1,2})$/;
/** Orice număr scris englezește: „1,234”, „1,234.5”, „12.345”. */
const EN_ANY = /^[-+]?(\d{1,3}(,\d{3})+(\.\d+)?|\d+\.\d+)$/;

/**
 * PDF-urile în engleză scriu „1,234.56”; Sheets citește numerele românește („1.234,56”). Dacă în tot PDF-ul sunt mai multe numere
 * scrise sigur englezește decât românește, toate numerele scrise englezește se rescriu românește (și „1,234” devine 1234).
 * Altfel nu se schimbă nimic: „1,234” rămâne 1,234, ca în română.
 */
export function normalizeNumbers(rows: string[][]): string[][] {
  let en = 0, ro = 0;
  for (const r of rows) for (const v of r) {
    const m = CORE.exec(v.trim());
    if (!m) continue;
    if (EN.test(m[2])) en++;
    else if (RO.test(m[2])) ro++;
  }
  if (en <= ro) return rows;
  return rows.map((r) => r.map((v) => {
    const m = CORE.exec(v.trim());
    if (!m || !EN_ANY.test(m[2])) return v;
    const [int, dec] = m[2].split(',').join('').split('.');
    const sign = /^[-+]/.test(int) ? int[0] : '';
    const digits = int.replace(/^[-+]/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return m[1] + sign + digits + (dec !== undefined ? ',' + dec : '') + m[3];
  }));
}

/** Rândurile → fișierul Sheets (JSON): capul fiecărui tabel cu aldine, lățimea coloanelor după text. */
export function rowsToSheet(rows: string[][], heads: number[], title: string): string {
  // Un text din PDF care începe cu „=” nu e formulă.
  const imp = csvToCells(normalizeNumbers(rows).map((r) => r.map((v) => (v.startsWith('=') ? ' ' + v : v))), ';');
  const styles: Record<string, CellStyle> = { ...imp.styles };
  for (const h of heads) {
    (rows[h] ?? []).forEach((v, c) => {
      if (!v) return;
      const id = colName(c) + (h + 1);
      styles[id] = { ...styles[id], b: true, bg: '#dde7f5' };
    });
  }
  const colW: Record<string, number> = {};
  const widest: number[] = [];
  for (const r of rows) r.forEach((v, c) => { widest[c] = Math.max(widest[c] ?? 0, v.length); });
  widest.forEach((n, c) => { colW[colName(c)] = Math.max(60, Math.min(360, Math.round(n * 7.5 + 16))); });
  const sheet = { ...emptySheet('Foaia 1'), cells: imp.cells, styles, colW };
  return JSON.stringify({ ...emptySheetDoc(), title, sheets: [sheet] });
}

/** Citește PDF-ul și întoarce tabelul Sheets gata de deschis. */
export async function pdfToSheet(doc: PDFDocumentProxy, title: string, progress?: (n: number) => void): Promise<{ content: string; tables: number; rows: number; scanned: number }> {
  const { pages, scanned } = await readPages(doc, progress);
  const { rows, tables, heads } = sheetRowsOf(pages);
  return { content: rowsToSheet(rows, heads, title), tables, rows: rows.length, scanned };
}
