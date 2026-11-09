// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Etichete (Word: Corespondență → Etichete): același text (o adresă, un nume, un cod) pe toată foaia de etichete autocolante,
// sau o singură etichetă pe locul ales. Rezultatul e un document nou: un tabel fără chenare, cu celulele cât etichetele,
// pe o pagină A4 cu marginile foii de etichete.
import type { JSONContent } from '@tiptap/react';
import { NO_PAGE_SETUP, serializeDoc, type PageSetup } from './format';
import { FIELD_RE, fieldValue, type MergeData } from './merge';

/** O foaie de etichete: coloane × rânduri, mărimea unei etichete și marginea de sus / din stânga (mm), pe A4. */
export interface LabelSheet { id: string; name: string; cols: number; rows: number; w: number; h: number; top: number; left: number }

export const LABEL_SHEETS: LabelSheet[] = [
  { id: '2x7', name: '14 pe foaie (2 × 7), 99,1 × 38,1 mm: adrese', cols: 2, rows: 7, w: 99.1, h: 38.1, top: 15.1, left: 4.7 },
  { id: '3x7', name: '21 pe foaie (3 × 7), 63,5 × 38,1 mm: adrese', cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.1, left: 7.2 },
  { id: '3x8', name: '24 pe foaie (3 × 8), 70 × 37 mm', cols: 3, rows: 8, w: 70, h: 37, top: 0, left: 0 },
  { id: '2x4', name: '8 pe foaie (2 × 4), 99,1 × 67,7 mm: colete', cols: 2, rows: 4, w: 99.1, h: 67.7, top: 13, left: 4.7 },
  { id: '4x10', name: '40 pe foaie (4 × 10), 48,5 × 25,4 mm: coduri, prețuri', cols: 4, rows: 10, w: 48.5, h: 25.4, top: 21.5, left: 8 },
  { id: '1x1', name: 'O etichetă pe pagină (A4 întreg)', cols: 1, rows: 1, w: 190, h: 270, top: 13, left: 10 },
];

export const sheetById = (id: string) => LABEL_SHEETS.find((s) => s.id === id) ?? LABEL_SHEETS[0];

const MM_PX = 96 / 25.4;

/**
 * Documentul cu etichetele. `one` = doar eticheta de pe rândul / coloana date (numărate de la 1), celelalte goale
 * (pentru o foaie începută); altfel textul e pe toate.
 */
export function labelsDoc(text: string, sheet: LabelSheet, one?: { row: number; col: number }): { doc: JSONContent; page: PageSetup } {
  return sheetsDoc(sheet, 1, (_p, r, c) => (!one || (one.row === r && one.col === c) ? text : ''));
}

/** Paragrafele unei etichete: câte unul pe rând de text (cel mult 30), fără spații între ele. */
function cellParas(text: string): JSONContent[] {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).slice(0, 30);
  return lines.some((l) => l.trim())
    ? lines.map((l) => ({ type: 'paragraph', attrs: { spaceBefore: 0, spaceAfter: 0 }, content: l ? [{ type: 'text', text: l }] : [] }))
    : [{ type: 'paragraph' }];
}

/** `pages` foi de etichete, fiecare un tabel de la pagină nouă; `text(foaie, rând, coloană)` dă textul fiecărei etichete (numărate de la 1). */
function sheetsDoc(sheet: LabelSheet, pages: number, text: (p: number, r: number, c: number) => string): { doc: JSONContent; page: PageSetup } {
  const content: JSONContent[] = [];
  for (let p = 1; p <= pages; p++) {
    const rows: JSONContent[] = [];
    for (let r = 1; r <= sheet.rows; r++) {
      const cells: JSONContent[] = [];
      for (let c = 1; c <= sheet.cols; c++) cells.push({ type: 'tableCell', attrs: { colwidth: [Math.round(sheet.w * MM_PX)], verticalAlign: 'middle' }, content: cellParas(text(p, r, c)) });
      rows.push({ type: 'tableRow', attrs: { rowHeight: Math.round(sheet.h) / 10 }, content: cells });
    }
    if (p > 1) content.push({ type: 'pageBreak' });
    content.push({ type: 'table', attrs: { borders: 'none' }, content: rows });
  }
  const doc: JSONContent = { type: 'doc', content };
  // Marginile foii: sus și în stânga ca la eticheta de pe foaie; jos și în dreapta cât rămâne, ca să încapă exact o foaie.
  const right = Math.max(0, Math.round((210 - sheet.left - sheet.cols * sheet.w) * 10) / 10);
  const bottom = Math.max(0, Math.round((297 - sheet.top - sheet.rows * sheet.h) * 10) / 10);
  const page: PageSetup = { ...NO_PAGE_SETUP, margins: { top: sheet.top, left: sheet.left, right: Math.min(right, 20), bottom: Math.min(bottom, 20) } };
  return { doc, page };
}

/** Cel mult atâtea etichete dintr-un tabel (o listă mai lungă se face pe bucăți), ca documentul să rămână ușor. */
export const MAX_MERGE_LABELS = 2000;

/** Textul etichetei pentru un rând din tabel: câmpurile «Nume» (și «Bloc de adresă») înlocuite cu valorile rândului. */
export function labelText(template: string, data: MergeData, row: number): string {
  return template.replace(FIELD_RE, (all, f: string) => fieldValue(data, row, f) ?? all);
}

/** Etichete din tabel: câte o etichetă pentru fiecare rând (în ordine, pe rânduri, apoi pe foi noi), cu textul completat. */
export function labelsMergeDoc(template: string, sheet: LabelSheet, data: MergeData, rows: number[]): { doc: JSONContent; page: PageSetup; count: number } {
  // Rândurile goale din tabel (fără nimic în nicio coloană) nu fac etichete.
  const list = rows.filter((r) => (data.rows[r] ?? []).some((v) => String(v ?? '').trim())).slice(0, MAX_MERGE_LABELS).map((r) => labelText(template, data, r)).filter((t) => t.trim());
  const per = sheet.cols * sheet.rows;
  const { doc, page } = sheetsDoc(sheet, Math.max(1, Math.ceil(list.length / per)), (p, r, c) => list[(p - 1) * per + (r - 1) * sheet.cols + (c - 1)] ?? '');
  return { doc, page, count: list.length };
}

/** Fișierul Suite al documentului cu etichete (de deschis într-un tab nou). */
export function labelsFile(text: string, sheet: LabelSheet, one?: { row: number; col: number }): string {
  const { doc, page } = labelsDoc(text, sheet, one);
  return serializeDoc(doc, page);
}
