// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inserare tabel ca în Word: grila în care alegi rândurile × coloanele și „Transformă textul în tabel”
// (rândurile selectate devin rânduri de tabel, despărțite la Tab, punct și virgulă sau virgulă).
import type { Editor, JSONContent } from '@tiptap/core';

export const GRID_ROWS = 8;
export const GRID_COLS = 10;
export const MAX_ROWS = 200;
export const MAX_COLS = 30;

const TAB = String.fromCharCode(9);

/** Despărțitorul folosit în rânduri: Tab dacă există, altfel „;”, altfel „,”; null = câte o celulă pe rând. */
export function guessSeparator(lines: string[]): string | null {
  for (const s of [TAB, ';', ',']) if (lines.some((l) => l.includes(s))) return s;
  return null;
}

/** Rândurile de text → celulele tabelului (toate rândurile cu același număr de coloane). */
export function textToCells(lines: string[], sep = guessSeparator(lines)): string[][] {
  const rows = lines.filter((l) => l.trim() !== '').map((l) => (sep ? l.split(sep) : [l]).map((c) => c.trim()));
  const cols = Math.min(MAX_COLS, Math.max(1, ...rows.map((r) => r.length)));
  return rows.slice(0, MAX_ROWS).map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ''));
}

const cell = (type: string, text: string): JSONContent => ({
  type, content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});

/** Tabelul (JSON TipTap) cu celulele date; primul rând ca antet, dacă se cere. */
export function tableJson(cells: string[][], header: boolean): JSONContent {
  return {
    type: 'table',
    content: cells.map((r, i) => ({ type: 'tableRow', content: r.map((t) => cell(header && i === 0 ? 'tableHeader' : 'tableCell', t)) })),
  };
}

/** Paragrafele (de la nivelul de sus) atinse de selecție: [început, sfârșit, rândurile de text]; null dacă selecția nu are text. */
export function selectedLines(editor: Editor): { from: number; to: number; lines: string[] } | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  let start = -1, end = -1;
  const lines: string[] = [];
  editor.state.doc.forEach((node, pos) => {
    if (pos + node.nodeSize <= from || pos >= to) return;
    if (!['paragraph', 'heading'].includes(node.type.name)) return;
    if (start < 0) start = pos;
    end = pos + node.nodeSize;
    // Ruperile de rând (Shift+Enter) despart și ele rândurile.
    let text = '';
    node.forEach((ch) => { text += ch.isText ? ch.text : ch.type.name === 'hardBreak' ? String.fromCharCode(10) : ''; });
    lines.push(...text.split(String.fromCharCode(10)));
  });
  return start < 0 || !lines.some((l) => l.trim()) ? null : { from: start, to: end, lines };
}

export function insertGridTable(editor: Editor, rows: number, cols: number, header: boolean) {
  const r = Math.min(MAX_ROWS, Math.max(1, Math.round(rows))), c = Math.min(MAX_COLS, Math.max(1, Math.round(cols)));
  editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: header }).run();
}

export function convertTextToTable(editor: Editor, header: boolean): boolean {
  const sel = selectedLines(editor);
  if (!sel) return false;
  return editor.chain().focus().insertContentAt({ from: sel.from, to: sel.to }, tableJson(textToCells(sel.lines), header)).run();
}
