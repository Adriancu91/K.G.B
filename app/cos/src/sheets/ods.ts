// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import .ods (OpenDocument, tabelele din LibreOffice / OpenOffice), plus varianta „plată” .fods (un singur XML).
// Dă același rezultat ca importul .xlsx, deci restul aplicației (deschidere, salvare, export) rămâne neschimbat.
// Se păstrează: valorile, formulele (traduse), datele calendaristice, procentele și lei/euro, aldin/cursiv/subliniat,
// culorile, alinierea, chenarele, ruperea textului, celulele îmbinate, comentariile, lățimea coloanelor și înălțimea rândurilor.
import { CellStyle, cellId, COL_W, colName, COLS, FONTS, MAX_COL_W, MAX_NOTE, MAX_ROW_H, MIN_COL_W, MIN_ROW_H, ROWS, STYLE_COLS, WORK_ROWS } from './format';
import { DefinedName, keepCachedResults, formatNumber, PivotDef, sheetKey, SPILL_RE, type ExtBook } from './formula';
import { MAX_LINKS } from './extLinks';
import { fromExcelFormula, MAX_IMPORT_SHEETS, XlsxImport, XlsxSheet } from './xlsx';
import { cleanMerges } from './merge';
import { readOdsCharts } from './odsChart';
import { attr, deep, el, els, isEl, odfLength, openOdf, styleRoots } from '../odf';

const MAX_CELL_CHARS = 32767;
/** Cel mult atâtea celule adunate din rânduri/coloane repetate, ca un fișier ciudat să nu umple memoria. */
const MAX_CELLS = 2_000_000;
const BAD = 'Fișierul nu este un tabel OpenDocument (.ods) valid.';

/** Textul unui paragraf ODF: spațiile multiple (text:s), tab-urile și rândurile noi se păstrează; comentariile se sar. */
function textOf(n: Node): string {
  let out = '';
  for (const k of n.childNodes) {
    if (k.nodeType === 3 || k.nodeType === 4) out += (k as CharacterData).data;
    else if (isEl(k)) {
      if (k.localName === 's') out += ' '.repeat(Math.min(1000, Number(attr(k, 'c') ?? 1) || 1));
      else if (k.localName === 'tab') out += '\t';
      else if (k.localName === 'line-break') out += '\n';
      else if (k.localName !== 'annotation') out += textOf(k);
    }
  }
  return out;
}
const cellText = (c: Element) => els(c, 'p').map(textOf).join('\n');

// ---------- Formule: OpenFormula → Suite ----------

const quoteSheet = (s: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !/^[A-Z]{1,3}\d+$/i.test(s) ? s : `'${s.replace(/'/g, "''")}'`);

/** O referință ODF din paranteze drepte („.A1”, „Foaia2.A1:.B3”, „$'Foaia mea'.$A$1”) → „A1”, „Foaia2!A1:B3”. */
function odsRef(inner: string): string | null {
  const parts = inner.split(':');
  if (parts.length > 2) return null;
  let sheet = '';
  const out: string[] = [];
  for (const p of parts) {
    const m = /^\$?(?:'((?:[^']|'')*)'|([^.']*))\.(\$?[A-Za-z]{1,3}\$?\d+|\$?[A-Za-z]{1,3}|\$?\d+)$/.exec(p.trim());
    if (!m) return null;
    const s = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
    if (s && !sheet) sheet = s;
    out.push(m[3].toUpperCase());
  }
  return (sheet ? quoteSheet(sheet) + '!' : '') + out.join(':');
}

/**
 * Numele definite (table:named-range = o zonă, table:named-expression = o formulă sau o valoare), ca la Excel.
 * Cele din <table:table> sunt ale foii aceleia. Listele de zone („A1:B2 C3:D4”) nu se pot păstra și se sar.
 */
function readNames(node: Element, sheet: string | undefined, out: DefinedName[], ext?: Map<string, { name: string; path: string }>) {
  for (const group of els(node, 'named-expressions')) {
    for (const k of els(group)) {
      const name = attr(k, 'name');
      if (!name || out.length >= 5000) continue;
      let ref: string | null = null;
      if (k.localName === 'named-range') {
        const addr = (attr(k, 'cell-range-address') ?? '').trim();
        if (addr && !/\s/.test(addr)) ref = odsRef(addr);
      } else if (k.localName === 'named-expression') {
        const f = attr(k, 'expression');
        ref = f ? fromOdsFormula(f, ext)?.replace(/^=/, '') ?? null : null;
      }
      if (ref) out.push(sheet ? { name, ref, sheet } : { name, ref });
    }
  }
}

/**
 * Zonele de bază de date din LibreOffice (Date → Definește zona): formulele le pot folosi după nume (VLOOKUP("b"; Tabel; 2)),
 * deci le aducem ca nume definite. Cele fără nume dat de om (__Anonymous_Sheet_DB__) se sar.
 */
function readDbRanges(spreadsheet: Element, out: DefinedName[]) {
  const taken = new Set(out.filter((n) => !n.sheet).map((n) => n.name.toUpperCase()));
  for (const group of els(spreadsheet, 'database-ranges')) {
    for (const r of els(group, 'database-range')) {
      const name = attr(r, 'name') ?? '';
      if (!/^[\p{L}_][\p{L}\d_.]*$/u.test(name) || name.startsWith('__Anonymous') || taken.has(name.toUpperCase()) || out.length >= 5000) continue;
      const ref = odsRef((attr(r, 'target-range-address') ?? '').trim());
      if (!ref) continue;
      out.push({ name, ref });
      taken.add(name.toUpperCase());
    }
  }
}

/**
 * Tabelele pivot (table:data-pilot-table): unde stau, din ce zonă se fac, câmpurile pe rânduri / coloane și cele de date.
 * Le folosește GETPIVOTDATA; pivotul în sine e deja în celule, ca valori.
 */
function readPivots(spreadsheet: Element): PivotDef[] {
  const out: PivotDef[] = [];
  for (const group of els(spreadsheet, 'data-pilot-tables')) {
    for (const t of els(group, 'data-pilot-table')) {
      const target = odsRef((attr(t, 'target-range-address') ?? '').trim());
      const range = els(t, 'source-cell-range')[0];
      const source = range ? odsRef((attr(range, 'cell-range-address') ?? '').trim()) : null;
      const at = target?.lastIndexOf('!') ?? -1;
      if (!target || !source || at < 0 || out.length >= 500) continue;
      const sheet = target.slice(0, at).replace(/^'(.*)'$/, '$1').replace(/''/g, "'");
      const p: PivotDef = { sheet, target: target.slice(at + 1), source, rows: [], cols: [], data: [] };
      for (const fld of els(t, 'data-pilot-field')) {
        const name = attr(fld, 'source-field-name') ?? '';
        if (!name || attr(fld, 'is-data-layout-field') === 'true') continue;
        const o = attr(fld, 'orientation');
        if (o === 'row') p.rows.push(name);
        else if (o === 'column') p.cols.push(name);
        else if (o === 'data') p.data.push({ field: name, fn: attr(fld, 'function') ?? 'sum' });
        else if (o === 'page') { const sel = attr(fld, 'selected-page'); if (sel) (p.page ??= {})[name] = sel; }
        if (o === 'data') continue;
        const hidden: string[] = [];
        for (const lv of els(fld, 'data-pilot-level')) for (const ms of els(lv, 'data-pilot-members')) for (const m of els(ms, 'data-pilot-member')) {
          if (attr(m, 'display') === 'false') hidden.push(attr(m, 'name') ?? '');
        }
        if (hidden.length) (p.hide ??= {})[name] = hidden;
      }
      if (p.data.length) out.push(p);
    }
  }
  return out;
}

/** Adresa unui alt fișier din .ods („file:///C:/Date/Pre%C8%9Buri.xlsx” sau „Buget.ods”) → calea și numele lui. */
export function extFileOf(iri: string): { name: string; path: string } {
  let p = iri;
  try { p = decodeURI(p); } catch { /* rămâne cum e */ }
  p = p.replace(/^file:\/+(?=[A-Za-z]:)/i, '').replace(/^file:\/\//i, '');
  return { path: p, name: p.split(/[\\/]/).pop() ?? '' };
}

/**
 * „of:=SUM([.A1:.A3];2.5)” → „=SUM(A1:A3,2.5)” și apoi prin traducerea de la Excel (aceleași nume de funcții).
 * Trimiterile la alt fișier (['file:///C:/Date/Buget.xlsx'#$Foaie1.A1]) devin '[Buget.xlsx]Foaie1'!A1, iar fișierul se notează în `ext`.
 */
export function fromOdsFormula(f: string, ext?: Map<string, { name: string; path: string }>): string | null {
  const src = f.replace(/^[a-z]+:/i, '').replace(/^=/, '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < src.length && (src[j] !== '"' || src[j + 1] === '"')) j += src[j] === '"' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '[') {
      const end = src.indexOf(']', i);
      if (end < 0) return null;
      // Trimiterea la o celulă ștearsă ([#REF!], [.#REF!], [$Foaie.#REF!]) e eroarea #REF!, ca valoare.
      if (/#REF!/i.test(src.slice(i + 1, end))) { out += '#REF!'; i = end + 1; continue; }
      const xm = /^'((?:[^']|'')+)'#(.+)$/.exec(src.slice(i + 1, end));
      if (xm) {
        const file = extFileOf(xm[1].replace(/''/g, "'"));
        const inner = /^\$?(?:'((?:[^']|'')*)'|([^.']+))\.(.+)$/.exec(xm[2]);
        const ref = inner ? odsRef('.' + inner[3]) : null;
        if (!file.name || /[[\]]/.test(file.name) || !inner || ref === null) return null;
        const sh = inner[1] !== undefined ? inner[1].replace(/''/g, "'") : inner[2];
        out += `'[${file.name.replace(/'/g, "''")}]${sh.replace(/'/g, "''")}'!${ref}`;
        ext?.set(sheetKey(file.name), file);
        i = end + 1;
        continue;
      }
      const ref = odsRef(src.slice(i + 1, end));
      if (ref === null) return null; // trimiteri la alte fișiere, zone cu nume ciudate: păstrăm rezultatul
      out += ref;
      i = end + 1;
    } else {
      out += ch === ';' ? ',' : ch;
      i++;
    }
  }
  // Funcțiile scrise de LibreOffice cu prefix (COM.MICROSOFT.XLOOKUP, ORG.OPENOFFICE.…).
  out = out.replace(/\b(?:COM\.MICROSOFT|ORG\.OPENOFFICE|ORG\.LIBREOFFICE)\./gi, '');
  // Numele OpenDocument ale funcțiilor vechi din Excel (LEGACY.CHIDIST = CHIDIST).
  out = out.replace(/\bLEGACY\.(?=[A-Z]+\s*\()/gi, '');
  return fromExcelFormula(out);
}

// ---------- Stiluri ----------

interface OdsStyle { st: CellStyle; parent?: string }

function readStyles(roots: Element[]) {
  const cell: Record<string, OdsStyle> = {};
  const colW: Record<string, number> = {};
  const rowH: Record<string, number> = {};
  // Foile: ascunse (display=false) și culoarea filei (tableooo:tab-color).
  const table: Record<string, { hidden?: boolean; tab?: string }> = {};
  for (const root of roots) {
    for (const s of els(root, 'style')) {
      const name = attr(s, 'name');
      if (!name) continue;
      const family = attr(s, 'family');
      if (family === 'table') {
        const p = el(s, 'table-properties');
        const tc = p ? attr(p, 'tab-color') : null;
        table[name] = { ...(p && attr(p, 'display') === 'false' ? { hidden: true } : {}), ...(tc && /^#[0-9a-f]{6}$/i.test(tc) ? { tab: tc.toLowerCase() } : {}) };
      } else if (family === 'table-column') {
        const w = odfLength(attr(el(s, 'table-column-properties') ?? s, 'column-width'));
        if (w) colW[name] = w;
      } else if (family === 'table-row') {
        const p = el(s, 'table-row-properties');
        const h = p ? odfLength(attr(p, 'row-height')) : null;
        if (h && attr(p!, 'use-optimal-row-height') !== 'true') rowH[name] = h;
      } else if (family === 'table-cell') {
        const st: CellStyle = {};
        const t = el(s, 'text-properties');
        if (t) {
          if (attr(t, 'font-weight') === 'bold' || Number(attr(t, 'font-weight')) >= 600) st.b = true;
          if (attr(t, 'font-style') === 'italic') st.i = true;
          // Mărimea textului, când nu e cea obișnuită din LibreOffice (10 pt).
          const fs = /^([\d.]+)pt$/.exec(attr(t, 'font-size') ?? '');
          if (fs && Math.abs(Number(fs[1]) - 10) >= 0.5) st.sz = Math.round(Math.min(72, Math.max(6, Number(fs[1]))) * 2) / 2;
          const u = attr(t, 'text-underline-style');
          if (u && u !== 'none') st.u = true;
          const lt = attr(t, 'text-line-through-style');
          if (lt && lt !== 'none') st.s = true;
          // Fontul, doar dacă e unul pe care îl are Sheets și nu e cel obișnuit (altfel fiecare celulă din LibreOffice ar primi font).
          const fn = (attr(t, 'font-name') ?? attr(t, 'font-family') ?? '').replace(/^['"]|['"]$/g, '');
          if (fn && fn !== 'Calibri' && FONTS.includes(fn)) st.font = fn;
          const col = attr(t, 'color');
          if (col && /^#[0-9a-f]{6}$/i.test(col) && col.toLowerCase() !== '#000000') st.color = col.toLowerCase();
        }
        const c = el(s, 'table-cell-properties');
        if (c) {
          const bg = attr(c, 'background-color');
          if (bg && /^#[0-9a-f]{6}$/i.test(bg) && bg.toLowerCase() !== '#ffffff') st.bg = bg.toLowerCase();
          const all = attr(c, 'border');
          const side = (k: string) => { const v = attr(c, `border-${k}`) ?? all; return !!v && v !== 'none' && !/^0(\.0+)?\w*\s/.test(v); };
          const bd = [['top', 't'], ['bottom', 'b'], ['left', 'l'], ['right', 'r']].filter(([k]) => side(k)).map(([, k]) => k).join('');
          if (bd) st.bd = bd;
          if (attr(c, 'wrap-option') === 'wrap') st.wrap = true;
          const va = attr(c, 'vertical-align');
          if (va === 'top' || va === 'bottom' || va === 'middle') st.va = va;
        }
        const p = el(s, 'paragraph-properties');
        const al = p ? attr(p, 'text-align') : null;
        if (al === 'center') st.align = 'center';
        else if (al === 'end' || al === 'right') st.align = 'right';
        else if (al === 'start' || al === 'left') st.align = 'left';
        cell[name] = { st, parent: attr(s, 'parent-style-name') ?? undefined };
      }
    }
  }
  const resolved: Record<string, CellStyle> = {};
  const get = (name: string, depth = 0): CellStyle => {
    if (resolved[name]) return resolved[name];
    const s = cell[name];
    if (!s) return {};
    const r = { ...(s.parent && depth < 10 ? get(s.parent, depth + 1) : {}), ...s.st };
    resolved[name] = r;
    return r;
  };
  return { cellStyle: get, colW, rowH, table };
}

// ---------- Import ----------

/** Seria de zile ca în Excel (1 = 1 ianuarie 1900), din „2020-01-31” sau „2020-01-31T12:00:00”. */
function dateSerial(v: string): number | null {
  const m = /^(-?\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?)?/.exec(v);
  if (!m) return null;
  const days = (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000;
  const frac = m[4] ? (+m[4] * 3600 + +m[5] * 60 + Number(m[6] ?? 0)) / 86400 : 0;
  return days + frac;
}

/** O eroare salvată de LibreOffice: #N/A, #VALUE! sau „Err:502”, scris și în limba programului („Chyba:502”, „Fehler:502”, „Eroare:502”). */
const isOdsError = (v: string) => v.startsWith('#') || /^\p{L}{2,12}:\d{3}$/u.test(v);

/** Octeții unui .ods / .fods → foile lui, ca celule Suite (aceeași formă ca la importul .xlsx). */
export async function readOds(data: Uint8Array): Promise<XlsxImport> {
  const file = await openOdf(data, BAD);
  const { content } = file;
  const spreadsheet = deep(content, 'spreadsheet');
  if (!spreadsheet) throw new Error(BAD);
  const { cellStyle, colW: colStyleW, rowH: rowStyleH, table: tableStyle } = readStyles(styleRoots(file));
  let cut = false;
  let asValues = 0;
  const asValuesSamples: string[] = [];
  let total = 0;
  const srcTables: Element[] = [];
  const srcNames: string[] = [];
  const cachedBy: Record<string, string>[] = [];
  const out: XlsxSheet[] = [];
  const used = new Set<string>();
  let skipped = 0;
  const names: DefinedName[] = [];
  // Fișierele din care iau valori formulele, și foile ascunse în care programele OpenDocument păstrează valorile lor
  // (<table:table> cu <table:table-source table:mode="copy-results-only" xlink:href="file:///…">).
  const extUsed = new Map<string, { name: string; path: string }>();
  const extCache = new Map<string, ExtBook['sheets']>();
  readNames(spreadsheet, undefined, names, extUsed);
  readDbRanges(spreadsheet, names);
  // Fără setări, ODF spune „expresii regulate: da”; LibreOffice nou scrie use-wildcards="true" (* și ?, ca Excel).
  const calc = deep(spreadsheet, 'calculation-settings');
  const match = calc && (attr(calc, 'use-wildcards') === 'true' || attr(calc, 'use-regular-expressions') === 'false') ? undefined : 'regex' as const;

  for (const table of els(spreadsheet, 'table')) {
    const source = el(table, 'table-source');
    // Doar foile cu valorile păstrate ale altui fișier (o foaie vizibilă legată, copy-all, rămâne foaie).
    const linked = source && attr(source, 'href') && (attr(source, 'mode') === 'copy-results-only' || /^'.*'#/.test(attr(table, 'name') ?? ''))
      ? extFileOf(attr(source, 'href')!) : null;
    if (!linked && out.length >= MAX_IMPORT_SHEETS) { skipped++; continue; }
    const cells: Record<string, string> = {};
    const styles: Record<string, CellStyle> = {};
    const cached: Record<string, string> = {};
    const colW: Record<string, number> = {};
    const rowH: Record<string, number> = {};
    const hideRows: number[] = [];
    const hideCols: number[] = [];
    // Grupurile (table:table-row-group / table-column-group, unul în altul = nivelul următor), ca gruparea din Sheets.
    const rowLvl: Record<string, number> = {};
    const colLvl: Record<string, number> = {};
    let rowDepth = 0, colDepth = 0;
    const merges: string[] = [];
    let maxR = -1, maxC = -1;
    // Formulele-matrice (SORT, FREQUENCY…) întinse pe mai multe celule: rezultatele salvate în celulele lor se scot, ca formula să se reverse.
    const spillZones: { r: number; c: number; r2: number; c2: number }[] = [];
    // Coloanele: lățimea și stilul implicit al celulelor din coloană.
    const colDefault: (string | null)[] = [];
    const walkCols = (n: Element) => {
      for (const k of els(n)) {
        if (k.localName === 'table-column') {
          const rep = Math.min(COLS - colDefault.length, Number(attr(k, 'number-columns-repeated') ?? 1) || 1);
          const w = colStyleW[attr(k, 'style-name') ?? ''];
          for (let i = 0; i < rep; i++) {
            const c = colDefault.length;
            if (c >= STYLE_COLS) { colDefault.push(null); continue; }
            if (colDepth > 0) colLvl[String(c + 1)] = Math.min(7, colDepth);
            if (attr(k, 'visibility') === 'collapse') hideCols.push(c + 1);
            else if (w) {
              const px = Math.round(Math.min(MAX_COL_W, Math.max(MIN_COL_W, w)));
              if (Math.abs(px - COL_W) >= 4) colW[colName(c)] = px;
            }
            colDefault.push(attr(k, 'default-cell-style-name'));
          }
        } else if (k.localName === 'table-column-group') { colDepth++; walkCols(k); colDepth--; }
        else if (/^table-(header-)?columns$/.test(k.localName)) walkCols(k);
      }
    };
    walkCols(table);

    let r = 0;
    const readRow = (row: Element) => {
      const repRow = Number(attr(row, 'number-rows-repeated') ?? 1) || 1;
      const rowCells: { c: number; value?: string; formula?: string; st?: CellStyle; note?: string; span?: [number, number] }[] = [];
      let c = 0;
      for (const cell of els(row)) {
        if (cell.localName !== 'table-cell' && cell.localName !== 'covered-table-cell') continue;
        const rep = Number(attr(cell, 'number-columns-repeated') ?? 1) || 1;
        if (cell.localName === 'covered-table-cell') { c += rep; continue; }
        const type = attr(cell, 'value-type');
        let value: string | undefined;
        let fmt: CellStyle['fmt'];
        if (type === 'float' || type === 'percentage' || type === 'currency') {
          const v = Number(attr(cell, 'value'));
          if (Number.isFinite(v)) value = formatNumber(v);
          if (type === 'percentage') fmt = 'percent';
          if (type === 'currency') { const cur = attr(cell, 'currency'); fmt = cur === 'EUR' ? 'eur' : cur === 'RON' || cur === 'LEI' ? 'lei' : undefined; }
        } else if (type === 'date') {
          const n = dateSerial(attr(cell, 'date-value') ?? '');
          if (n !== null) { value = formatNumber(n); fmt = Number.isInteger(n) ? 'date' : 'datetime'; } else value = cellText(cell);
        } else if (type === 'time') {
          // Durata ISO a LibreOffice: PT13H30M00S (sau PT36H pentru durate peste o zi).
          const m = /^-?PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(attr(cell, 'time-value') ?? '');
          if (m) { value = formatNumber(Math.round((+(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0)) / 86400 * 1e10) / 1e10); fmt = 'time'; } else value = cellText(cell);
        } else if (type === 'boolean') {
          value = attr(cell, 'boolean-value') === 'true' ? 'ADEVĂRAT' : 'FALS';
        } else {
          value = cellText(cell);
        }
        if (value && value.length > MAX_CELL_CHARS) value = value.slice(0, MAX_CELL_CHARS);
        const fAttr = attr(cell, 'formula');
        // O formulă cu eroare are des valoarea 0 ca număr, iar eroarea doar în textul afișat („Err:502”, „#DIV/0!”).
        if (fAttr && type && type !== 'string') { const shown = cellText(cell).trim(); if (shown && isOdsError(shown)) value = shown; }
        const formula = fAttr ? fromOdsFormula(fAttr, extUsed) ?? undefined : undefined;
        const mr = Number(attr(cell, 'number-matrix-rows-spanned') ?? 1) || 1, mc = Number(attr(cell, 'number-matrix-columns-spanned') ?? 1) || 1;
        if (formula && (mr > 1 || mc > 1) && SPILL_RE.test(formula)) spillZones.push({ r, c, r2: r + mr - 1, c2: c + mc - 1 });
        if (fAttr && !formula) { asValues++; if (asValuesSamples.length < 50) asValuesSamples.push(`nu se poate citi: ${fAttr}`); }
        const sName = attr(cell, 'style-name') ?? colDefault[c] ?? null;
        let st = sName ? { ...cellStyle(sName) } : undefined;
        if (fmt) st = { ...st, fmt };
        const ann = el(cell, 'annotation');
        const note = ann ? els(ann, 'p').map(textOf).join('\n').slice(0, MAX_NOTE) : undefined;
        const cs = Number(attr(cell, 'number-columns-spanned') ?? 1), rs = Number(attr(cell, 'number-rows-spanned') ?? 1);
        const has = !!(formula || (value !== undefined && value !== '')) || !!note || !!(st && (st.bg || st.bd));
        if (has) {
          const end = formula || (value !== undefined && value !== '') || note ? COLS : Math.max(STYLE_COLS, c + 1);
          for (let i = 0; i < rep && c + i < end; i++) {
            rowCells.push({ c: c + i, value, formula, st, note, span: cs > 1 || rs > 1 ? [rs, cs] : undefined });
          }
          if (c + rep > COLS && (value || formula)) cut = true;
        }
        c += rep;
      }
      const h = rowStyleH[attr(row, 'style-name') ?? ''];
      // Rândurile doar cu fundal sau chenar, repetate până la capătul foii (LibreOffice face des asta), se opresc la 10.000.
      const content = rowCells.some((x) => (x.formula ?? x.value ?? '') !== '' || x.note);
      const times = rowCells.length ? Math.min(repRow, content ? ROWS - r : Math.max(0, WORK_ROWS - r)) : 0;
      if (content && r + repRow > ROWS) cut = true;
      for (let k = 0; k < times && total < MAX_CELLS; k++) {
        const rr = r + k;
        if (h) { const px = Math.round(h); if (px > MIN_ROW_H && px <= MAX_ROW_H) rowH[String(rr + 1)] = px; }
        for (const x of rowCells) {
          const id = cellId(rr, x.c);
          const content = x.formula ?? x.value;
          if (content !== undefined && content !== '') {
            cells[id] = content;
            if (x.formula && x.value !== undefined) cached[id] = x.value;
            maxR = Math.max(maxR, rr);
            maxC = Math.max(maxC, x.c);
            total++;
          }
          const st = x.note ? { ...x.st, note: x.note } : x.st;
          if (st && Object.keys(st).length) styles[id] = st;
          if (x.span) merges.push(`${id}:${cellId(Math.min(ROWS - 1, rr + x.span[0] - 1), Math.min(COLS - 1, x.c + x.span[1] - 1))}`);
        }
      }
      if (!rowCells.length && h && repRow === 1 && r < ROWS) { const px = Math.round(h); if (px > MIN_ROW_H && px <= MAX_ROW_H) rowH[String(r + 1)] = px; }
      // Rândurile ascunse de mână în LibreOffice (cele ascunse de filtru au „filter” și nu se iau).
      if (attr(row, 'visibility') === 'collapse') for (let k = 0; k < Math.min(repRow, 1000) && r + k < ROWS; k++) hideRows.push(r + k + 1);
      if (rowDepth > 0) for (let k = 0; k < Math.min(repRow, 1000) && r + k < ROWS; k++) rowLvl[String(r + k + 1)] = Math.min(7, rowDepth);
      r += repRow;
    };
    const walkRows = (n: Element) => {
      for (const k of els(n)) {
        if (r >= ROWS) return;
        if (k.localName === 'table-row') readRow(k);
        else if (k.localName === 'table-row-group') { rowDepth++; walkRows(k); rowDepth--; }
        else if (/^table-(header-)?rows$/.test(k.localName)) walkRows(k);
      }
    };
    walkRows(table);
    if (total >= MAX_CELLS) cut = true;
    for (const z of spillZones) {
      for (let rr = z.r; rr <= Math.min(z.r2, ROWS - 1); rr++) {
        for (let cc = z.c; cc <= Math.min(z.c2, COLS - 1); cc++) {
          if (rr === z.r && cc === z.c) continue;
          const id = cellId(rr, cc);
          if (!cells[id]?.startsWith('=')) { delete cells[id]; delete cached[id]; }
        }
      }
    }

    for (const [id, st] of Object.entries(styles)) {
      // Ca la .xlsx: celulele goale contează doar dacă au fundal, chenar sau notă.
      if (!cells[id] && !st.bg && !st.bd && !st.note) delete styles[id];
      else if (!Object.keys(st).length) delete styles[id];
    }
    if (linked) {
      // Valorile altui fișier, nu o foaie de-a tabelului: merg în legături (doar valorile, fără formule).
      const sn = (attr(source!, 'table-name') ?? /#\$?'?(.*?)'?$/.exec(attr(table, 'name') ?? '')?.[1] ?? '').slice(0, 31);
      const key = sheetKey(linked.name);
      if (sn && linked.name) {
        const vals: Record<string, string> = {};
        for (const [id, v] of Object.entries(cells)) if (!v.startsWith('=')) vals[id] = cached[id] ?? v; else if (cached[id]) vals[id] = cached[id];
        const list = extCache.get(key) ?? [];
        if (!list.some((x) => sheetKey(x.name) === sheetKey(sn))) list.push({ name: sn, cells: vals });
        extCache.set(key, list);
        if (!extUsed.has(key)) extUsed.set(key, linked);
      }
      continue;
    }
    cachedBy.push(cached);
    const base = (attr(table, 'name') ?? '').slice(0, 31).trim() || `Foaia ${out.length + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLocaleLowerCase('ro-RO')); n++) name = `${base.slice(0, 26)} (${n})`;
    used.add(name.toLocaleLowerCase('ro-RO'));
    readNames(table, name, names, extUsed);
    srcTables.push(table);
    srcNames.push(attr(table, 'name') ?? '');
    out.push({
      name, cells, styles, colW, rowH, hideRows, hideCols, ...(Object.keys(rowLvl).length ? { rowLvl } : {}), ...(Object.keys(colLvl).length ? { colLvl } : {}), charts: [], lists: [], rules: [], merges: cleanMerges(merges),
      rows: maxR + 1, cols: maxC + 1, ...tableStyle[attr(table, 'style-name') ?? ''],
    });
  }
  // Graficele: obiectele încorporate citite din fișier (ce nu e grafic sau nu se poate aduce se numără).
  const chartsSkipped = await readOdsCharts(file.zip, srcTables, out, srcNames);
  if (out.length && out.every((s) => s.hidden)) delete out[0].hidden;
  if (!out.length) throw new Error('Nu am găsit nicio foaie de calcul în fișier.');
  // Formulele pe care Suite nu le poate calcula păstrează rezultatul salvat de LibreOffice (ca la .xlsx).
  const pivots = readPivots(spreadsheet);
  const links: ExtBook[] = [...extUsed].slice(0, MAX_LINKS).map(([key, f]) => ({
    name: f.name, ...(f.path && f.path !== f.name ? { path: f.path } : {}), sheets: extCache.get(key) ?? [] }));
  asValues += keepCachedResults(out, cachedBy, names, isOdsError, asValuesSamples, pivots, match, links);
  return { sheets: out, active: 0, cut, asValues, asValuesSamples, chartsSkipped, skipped, names: names.length ? names : undefined,
    ...(pivots.length ? { pivots } : {}), ...(match ? { match } : {}), ...(links.length ? { links } : {}) };
}
