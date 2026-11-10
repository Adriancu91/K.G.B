// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Notița → tabel Sheets: lista de bifat devine un tabel „Nr. / De făcut / Gata”, cu Da/Nu din listă derulantă,
// „Da” colorat verde și numărul de sarcini făcute jos. O notiță fără bife dă câte un rând pentru fiecare rând de text.
// Tabelul e nou și nesalvat; îl salvezi din Sheets unde vrei.
import type { Note } from './store';
import { shownTitle } from './store';
import { BOX, DONE } from './checklist';
import { emptySheet, emptySheetDoc, type CellStyle } from '../sheets/format';

const HEAD: CellStyle = { b: true, bg: '#dde7f5', align: 'center', bd: 'tblr' };
const CELL: CellStyle = { bd: 'tblr' };

/** Rândurile tabelului: [text, bifat?] (bifat e null când notița nu are listă de bifat). */
export function sheetRows(n: Note): [string, boolean | null][] {
  const lines = (n.title.trim() ? n.body : n.body.split('\n').slice(1).join('\n')).split('\n');
  const items = lines.map((l) => l.trimStart()).filter((l) => l.startsWith(BOX) || l.startsWith(DONE));
  if (items.length) return items.map((l) => [l.replace(/^[☐☑] ?/, '').trim(), l.startsWith(DONE)] as [string, boolean]).filter(([t]) => t);
  return lines.map((l) => l.replace(/^[•\-*] +/, '').trim()).filter(Boolean).map((t) => [t, null]);
}

export function noteToSheet(n: Note): string {
  const rows = sheetRows(n);
  const check = rows.some(([, d]) => d !== null);
  const cells: Record<string, string> = {}, styles: Record<string, CellStyle> = {};
  cells.A1 = shownTitle(n);
  styles.A1 = { b: true };
  const head = check ? ['Nr.', 'De făcut', 'Gata', 'Observații'] : ['Nr.', 'Text', 'Observații'];
  head.forEach((t, i) => { const id = String.fromCharCode(65 + i) + '3'; cells[id] = t; styles[id] = HEAD; });
  rows.forEach(([text, done], i) => {
    const r = i + 4;
    cells[`A${r}`] = String(i + 1);
    styles[`A${r}`] = { ...CELL, align: 'center' };
    cells[`B${r}`] = text;
    styles[`B${r}`] = { ...CELL, wrap: true };
    if (check) {
      cells[`C${r}`] = done ? 'Da' : 'Nu';
      styles[`C${r}`] = { ...CELL, align: 'center' };
      styles[`D${r}`] = CELL;
    } else styles[`C${r}`] = CELL;
  });
  const last = rows.length + 3;
  if (check && rows.length) {
    const t = last + 2;
    cells[`B${t}`] = 'Făcute:';
    styles[`B${t}`] = { b: true, align: 'right' };
    cells[`C${t}`] = `=COUNTIF(C4:C${last};"Da")&" din "&COUNTA(B4:B${last})`;
    styles[`C${t}`] = { b: true, align: 'center' };
  }
  const sheet = {
    ...emptySheet('Foaia 1'), cells, styles,
    colW: check ? { A: 50, B: 340, C: 80, D: 200 } : { A: 50, B: 420, C: 200 },
    // Titlul notiței stă peste toată lățimea tabelului (coloana A e îngustă, doar pentru Nr.).
    merges: [check ? 'A1:D1' : 'A1:C1'],
    ...(check && rows.length ? {
      lists: [{ range: `C4:C${last}`, values: ['Da', 'Nu'] }],
      rules: [{ range: `C4:C${last}`, op: 'eq' as const, v1: 'Da', look: 'green' as const }],
    } : {}),
  };
  return JSON.stringify({ ...emptySheetDoc(), title: shownTitle(n), sheets: [sheet] });
}
