// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tabelele scrise în câmpul notiței („| a | b |”): Tab / Shift+Tab între celule, Enter rând nou, bara de tabel
// (rând / coloană nouă sau ștearsă, sortare, aliniere). Funcții pure care întorc o modificare de text (Edit), ca în checklist.ts.
// Testate în tests/notes-table.test.mjs.
import type { Edit } from './checklist';

const NL = String.fromCharCode(10);
const isTableLine = (l: string) => { const t = l.trim(); return t.length > 1 && t.startsWith('|'); };
const cellsOf = (l: string) => {
  let t = l.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
};
const isSep = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));

export interface TableAt {
  /** Zona tabelului în text: de la începutul primului rând până la sfârșitul ultimului (fără Enter-ul final). */
  from: number;
  to: number;
  rows: string[][];
  /** Rândul cu „---” (sub capul tabelului), sau -1. */
  sep: number;
  row: number;
  col: number;
}

/** Tabelul în care e cursorul (`pos`), cu rândul și coloana lui, sau null. */
export function tableAt(v: string, pos: number): TableAt | null {
  const ls = v.lastIndexOf(NL, pos - 1) + 1;
  let le = v.indexOf(NL, pos); if (le < 0) le = v.length;
  if (!isTableLine(v.slice(ls, le))) return null;
  let from = ls;
  while (from > 0) { const p = v.lastIndexOf(NL, from - 2) + 1; if (!isTableLine(v.slice(p, from - 1))) break; from = p; }
  let to = le;
  while (to < v.length) { let e = v.indexOf(NL, to + 1); if (e < 0) e = v.length; if (!isTableLine(v.slice(to + 1, e))) break; to = e; }
  const lines = v.slice(from, to).split(NL);
  const rows = lines.map(cellsOf);
  const cols = Math.max(...rows.map((r) => r.length));
  for (const r of rows) while (r.length < cols) r.push('');
  const row = v.slice(from, ls).split(NL).length - 1;
  const before = v.slice(ls, pos), lead = v.slice(ls).trimStart().startsWith('|') ? 1 : 0;
  const col = Math.max(0, Math.min(cols - 1, before.split('|').length - 1 - lead));
  const sep = rows.length > 1 && isSep(rows[1]) ? 1 : -1;
  return { from, to, rows, sep, row, col };
}

/** Tabelul scris frumos, cu coloanele aliniate; `caret(r, c)` = locul de început al celulei în textul scris. */
export function formatTable(rows: string[][], sep: number) {
  const cols = Math.max(...rows.map((r) => r.length));
  const w = Array.from({ length: cols }, (_, c) => Math.max(3, ...rows.map((r, i) => (i === sep ? 3 : (r[c] ?? '').length))));
  const starts: number[][] = [];
  let at = 0;
  const lines = rows.map((r, i) => {
    const st: number[] = [];
    const cells = w.map((cw, c) => {
      if (i === sep) { const s = r[c] ?? '---'; const L = s.startsWith(':'), R = s.endsWith(':') && s.length > 1; return (L ? ':' : '') + '-'.repeat(cw - (L ? 1 : 0) - (R ? 1 : 0)) + (R ? ':' : ''); }
      return (r[c] ?? '').padEnd(cw);
    });
    let s = '|';
    for (const c of cells) { st.push(at + s.length + 1); s += ' ' + c + ' |'; }
    starts.push(st);
    at += s.length + 1;
    return s;
  });
  return { text: lines.join(NL), caret: (r: number, c: number) => starts[r][c] };
}

export type TableOp = 'next' | 'prev' | 'enter' | 'rowAbove' | 'rowBelow' | 'colLeft' | 'colRight' | 'delRow' | 'delCol' | 'align' | 'sortAsc' | 'sortDesc';

const num = (s: string) => { const t = s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return t !== '' && Number.isFinite(Number(t)) ? Number(t) : null; };

/** O comandă de tabel la cursorul `pos`: întoarce modificarea de făcut în text, sau null (cursorul nu e într-un tabel). */
export function tableOp(v: string, pos: number, op: TableOp): Edit | null {
  const t = tableAt(v, pos);
  if (!t) return null;
  let { rows, sep, row, col } = t;
  rows = rows.map((r) => [...r]);
  const cols = rows[0].length;
  const empty = () => Array.from({ length: rows[0].length }, () => '');
  const out = (r: number, c: number, after = ''): Edit => {
    const f = formatTable(rows, sep);
    return { from: t.from, to: t.to, text: f.text + after, caret: t.from + f.caret(r, c) };
  };
  const firstData = sep >= 0 ? sep + 1 : 0;
  if (row === sep) row = sep - 1 >= 0 ? sep - 1 : 0;
  switch (op) {
    case 'align': return out(row, col);
    case 'next': {
      if (col + 1 < cols) return out(row, col + 1);
      let r = row + 1; if (r === sep) r++;
      if (r >= rows.length) rows.push(empty());
      return out(r, 0);
    }
    case 'prev': {
      if (col > 0) return out(row, col - 1);
      let r = row - 1; if (r === sep) r--;
      return r < 0 ? out(row, 0) : out(r, cols - 1);
    }
    case 'enter': {
      // Enter pe un rând gol de la capătul tabelului iese din tabel (ca la liste); altfel face un rând nou dedesubt.
      if (row === rows.length - 1 && row >= firstData && rows[row].every((c) => !c) && rows.length > firstData + 1) {
        rows.pop();
        const f = formatTable(rows, sep);
        return { from: t.from, to: t.to, text: f.text + NL, caret: t.from + f.text.length + 1 };
      }
      const at = row < firstData ? firstData : row + 1;
      rows.splice(at, 0, empty());
      return out(at, 0);
    }
    case 'rowBelow': case 'rowAbove': {
      const at = op === 'rowAbove' ? Math.max(row, firstData) : row < firstData ? firstData : row + 1;
      rows.splice(at, 0, empty());
      return out(at, col);
    }
    case 'delRow': {
      if (row < firstData && sep >= 0) return null; // capul tabelului rămâne (ștergi tot tabelul cu − Coloană până la ultima)
      if (rows.length - (sep >= 0 ? 1 : 0) <= 1) return { from: t.from, to: Math.min(v.length, t.to + 1), text: '', caret: t.from };
      rows.splice(row, 1);
      const r = Math.min(row, rows.length - 1);
      return out(r === sep ? r + 1 < rows.length ? r + 1 : r - 1 : r, col);
    }
    case 'colLeft': case 'colRight': {
      const at = op === 'colLeft' ? col : col + 1;
      rows.forEach((r, i) => r.splice(at, 0, i === sep ? '---' : i === 0 && sep >= 0 ? `Coloana ${at + 1}` : ''));
      return out(row, at);
    }
    case 'delCol': {
      if (cols <= 1) return { from: t.from, to: Math.min(v.length, t.to + 1), text: '', caret: t.from };
      rows.forEach((r) => r.splice(col, 1));
      return out(row, Math.min(col, cols - 2));
    }
    case 'sortAsc': case 'sortDesc': {
      const data = rows.slice(firstData);
      if (data.length < 2) return out(row, col);
      const allNum = data.every((r) => !r[col] || num(r[col]) !== null);
      const k = op === 'sortAsc' ? 1 : -1;
      data.sort((a, b) => {
        // Celulele goale rămân la sfârșit, în ambele sensuri.
        if (!a[col] || !b[col]) return !a[col] && !b[col] ? 0 : !a[col] ? 1 : -1;
        return k * (allNum ? num(a[col])! - num(b[col])! : a[col].localeCompare(b[col], 'ro', { numeric: true, sensitivity: 'base' }));
      });
      rows = [...rows.slice(0, firstData), ...data];
      return out(row, col);
    }
  }
}
