// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ⧉ Combină: un tabel (.xlsx / .xlsm / .ods / .csv) → pagina HTML de tipărit ca PDF A4: fiecare foaie vizibilă, cu numele ei
// deasupra, ca tabel cu chenar și valorile calculate ale formulelor. Foile foarte mari se taie (cu o notă sub tabel).
import { cellsToRows } from '../notes/sheetTable';
import type { XlsxSheet } from '../sheets/xlsx';
import type { Result } from '../sheets/formula';

export const SHEET_EXT = /[.](xlsx|xlsm|ods|fods|csv)$/i;
export const MAX_SHEET_ROWS = 2000;
export const MAX_SHEET_COLS = 40;

const SHEET_CSS = '<style>table.sheet{font-size:9pt;width:auto}table.sheet td{padding:1pt 4pt;white-space:nowrap}table.sheet td.n{text-align:right}'
    + 'table.sheet.styled{font-size:10pt}'
    + 'h2{page-break-before:always}h2:first-of-type{page-break-before:auto}p.cut{color:#666;font-size:9pt}</style>';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NUM = /^[-+(]?[\d.,\s]*\d[\d.,\s]*%?\)?(\s?(lei|ron|eur|€|\$|usd))?$/i;

/** Rândurile unei foi → tabel HTML; rândurile și coloanele goale de la capăt se scot; null dacă foaia e goală. */
export function rowsToPrintTable(rows: string[][]): { html: string; cut: boolean } | null {
  const r = rows.map((row) => row.map((c) => c ?? ''));
  while (r.length && r[r.length - 1].every((c) => !c.trim())) r.pop();
  if (!r.length) return null;
  const cols = Math.max(...r.map((row) => { let n = row.length; while (n && !row[n - 1].trim()) n--; return n; }));
  if (!cols) return null;
  const cut = r.length > MAX_SHEET_ROWS || cols > MAX_SHEET_COLS;
  const cell = (c: string) => `<td${NUM.test(c.trim()) ? ' class="n"' : ''}>${esc(c)}</td>`;
  const body = r.slice(0, MAX_SHEET_ROWS).map((row) => '<tr>' + Array.from({ length: Math.min(cols, MAX_SHEET_COLS) }, (_, i) => cell(row[i] ?? '')).join('') + '</tr>');
  return { html: '<table class="sheet">' + body.join('') + '</table>', cut };
}

/** Lățimea de tipărit a paginii A4 cu marginile obișnuite, în pixeli (190 mm). */
const PAGE_PX = 718;

/** O foaie .xlsx / .ods → tabel HTML ca în Sheets: textul afișat (formatul numerelor, lei, %, date), aldin / cursiv / culori / fundal /
 *  chenare / alinieri / font, celulele îmbinate, lățimile coloanelor, fără rândurile și coloanele ascunse, doar zona de tipărire
 *  (dacă foaia are una). Un tabel mai lat decât pagina se micșorează (cel mult până la 30%). */
async function styledTable(sh: XlsxSheet, results: Record<string, Result>): Promise<{ html: string; cut: boolean } | null> {
  const [{ printRange }, { mergesOf, mergeAt }, { cellText }, { cellId, colName, COL_W, isNumber }, { styleToCss }] = await Promise.all([
    import('../sheets/print'), import('../sheets/merge'), import('../sheets/filter'), import('../sheets/format'), import('../sheets/paste'),
  ]);
  const all = printRange(sh.cells, sh.print);
  if (!all) return null;
  const g = { ...all, r1: Math.min(all.r1, all.r0 + MAX_SHEET_ROWS - 1), c1: Math.min(all.c1, all.c0 + MAX_SHEET_COLS - 1) };
  const hr = new Set((sh.hideRows ?? []).map((n) => n - 1)), hc = new Set((sh.hideCols ?? []).map((n) => n - 1));
  const cols: number[] = [], rows: number[] = [];
  for (let c = g.c0; c <= g.c1; c++) if (!hc.has(c)) cols.push(c);
  for (let r = g.r0; r <= g.r1; r++) if (!hr.has(r)) rows.push(r);
  if (!cols.length || !rows.length) return null;
  const merges = mergesOf(sh.merges);
  const widths = cols.map((c) => sh.colW[colName(c)] ?? COL_W);
  const total = widths.reduce((s, w) => s + w, 0);
  const zoom = total > PAGE_PX ? Math.max(0.3, PAGE_PX / total) : 1;
  const span = (list: number[], a: number, b: number) => list.filter((x) => x >= a && x <= b).length;
  const body = rows.map((r) => {
    const h = sh.rowH?.[String(r + 1)];
    let tr = h ? `<tr style="height:${Math.round(h)}px">` : '<tr>';
    for (const c of cols) {
      const m = mergeAt(merges, r, c);
      // Celulele acoperite de o îmbinare nu se scriu; îmbinarea începe în prima celulă vizibilă a ei.
      if (m && (c !== cols.find((x) => x >= m.c0) || r !== rows.find((x) => x >= m.r0))) continue;
      const id = m ? cellId(m.r0, m.c0) : cellId(r, c), v = sh.cells[id] ?? '', res = results[id], st = sh.styles[id];
      const num = res ? res.num && !res.err : isNumber(v);
      let css = styleToCss(st, num);
      if (st?.font) css += `;font-family:'${st.font.replace(/['";]/g, '')}'`;
      if (st?.sz) css += `;font-size:${st.sz}pt`;
      if (st?.va) css += `;vertical-align:${st.va}`;
      if (st?.ind) css += `;padding-left:${6 + st.ind * 9}px`;
      // Ca în Sheets: textul lung trece peste celula vecină doar dacă aceea e goală; altfel se taie la marginea lui.
      const next = cols.find((x) => x > (m ? m.c1 : c));
      if (next !== undefined && (sh.cells[cellId(r, next)] ?? '').trim()) css += ';overflow:hidden';
      const attrs = m ? `${m.c1 > m.c0 ? ` colspan="${span(cols, m.c0, m.c1)}"` : ''}${m.r1 > m.r0 ? ` rowspan="${span(rows, m.r0, m.r1)}"` : ''}` : '';
      tr += `<td${attrs} style="${css}">${esc(cellText(sh.cells[id], res, st)).split(String.fromCharCode(10)).join('<br>')}</td>`;
    }
    return tr + '</tr>';
  });
  const colgroup = '<colgroup>' + widths.map((w) => `<col style="width:${Math.round(w)}px">`).join('') + '</colgroup>';
  return {
    html: `<table class="sheet styled" style="table-layout:fixed;width:${Math.round(total)}px${zoom < 1 ? `;zoom:${zoom.toFixed(3)}` : ''}">${colgroup}<tbody>${body.join('')}</tbody></table>`,
    cut: g.r1 < all.r1 || g.c1 < all.c1,
  };
}

export interface SheetHtml { name: string; html: string; cut: boolean; active: boolean }

/** Fiecare foaie vizibilă a unui tabel ca tabel HTML (fără stilul paginii); folosit și de Docs → Inserare → Foaie de calcul. */
export async function sheetTables(name: string, data: Uint8Array): Promise<SheetHtml[]> {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv' || ext === 'txt') {
    const { decodeCsv, parseCsv } = await import('../sheets/csv');
    const t = rowsToPrintTable(parseCsv(decodeCsv(data)));
    return t ? [{ name: name.replace(/^.*[\\/]/, '').replace(/[.][^.]+$/, ''), ...t, active: true }] : [];
  }
  const book = ext === 'ods' || ext === 'fods' ? await (await import('../sheets/ods')).readOds(data) : await (await import('../sheets/xlsx')).readXlsx(data);
  const { evaluateAll } = await import('../sheets/formula');
  const plain = book.sheets.map((s) => ({ name: s.name, cells: s.cells }));
  const out: SheetHtml[] = [];
  book.sheets.forEach((sh, i) => { if (!sh.hidden) out.push({ name: sh.name, html: '', cut: false, active: i === book.active }); });
  for (const o of out) {
    const sh = book.sheets.find((s) => s.name === o.name)!;
    let results: Record<string, Result> = {};
    // Cu tot caietul, ca formulele care iau date din alte foi să se calculeze.
    try { results = evaluateAll(sh.cells, { self: sh.name, sheets: plain, names: book.names }); } catch { /* fără calcul: formulele rămân goale */ }
    let t: { html: string; cut: boolean } | null = null;
    try { t = await styledTable(sh, results); } catch { t = null; }
    t ??= rowsToPrintTable(cellsToRows(sh.cells, results, MAX_SHEET_ROWS + 1, MAX_SHEET_COLS + 1));
    if (t) Object.assign(o, t);
  }
  return out.filter((o) => o.html);
}

/** Tot tabelul ca pagină HTML (corpul paginii, de pus în rtfPage). */
export async function sheetFileToHtml(name: string, data: Uint8Array): Promise<string> {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const list = await sheetTables(name, data);
  if (!list.length) throw new Error('tabelul e gol');
  if (ext === 'csv') return SHEET_CSS + list[0].html + (list[0].cut ? `<p class="cut">(tabelul e tăiat la ${MAX_SHEET_ROWS} de rânduri și ${MAX_SHEET_COLS} de coloane)</p>` : '');
  return SHEET_CSS + list.map((t) => (list.length > 1 ? `<h2>${esc(t.name)}</h2>` : '') + t.html
    + (t.cut ? `<p class="cut">(foaia e tăiată la ${MAX_SHEET_ROWS} de rânduri și ${MAX_SHEET_COLS} de coloane)</p>` : '')).join('');
}
