// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inserarea și ștergerea de rânduri sau coloane, ca în Excel: tot ce e dedesubt (sau la dreapta) se mută,
// iar formulele din toate foile își schimbă referințele ca să arate tot spre aceleași celule.
import { cellId, colName, COLS, parseCellId, ROWS, Sheet } from './format';
import { colIndex } from './filter';
import { sheetKey } from './formula';
import { cleanMerges } from './merge';
import { shiftLevels } from './group';

export type Axis = 'r' | 'c';
/**
 * La Inserare / Ștergere celule (nu rânduri sau coloane întregi): se mută doar celulele din banda aceasta,
 * adică din coloanele [c0, c1] când axa e 'r' (mutare în jos / în sus) sau din rândurile [r0, r1] când axa e 'c'.
 */
export type Band = [number, number];
const inBand = (band: Band | undefined, i: number) => !band || (i >= band[0] && i <= band[1]);

/** Noua poziție a unui rând/coloane după inserarea (n > 0) sau ștergerea (n < 0) de la `at`; null dacă e șters. */
export function shiftIndex(i: number, at: number, n: number): number | null {
  if (n > 0) return i >= at ? i + n : i;
  const d = -n;
  if (i < at) return i;
  return i >= at + d ? i - d : null;
}

const max = (axis: Axis) => (axis === 'r' ? ROWS : COLS);

/** Tabelele cu nume după inserare / ștergere: zona lor se mută sau se strânge; un tabel șters de tot dispare. */
function shiftTables(s: Sheet, next: Sheet, axis: Axis, at: number, n: number, band?: Band) {
  if (!s.tables) return;
  const out = s.tables.flatMap((t) => {
    const g = shiftArea(`${cellId(t.r0, t.c0)}:${cellId(t.r1, t.c1)}`, axis, at, n, band);
    const [a, b] = (g ?? '').split(':').map((x) => parseCellId(x));
    return a && b ? [{ ...t, r0: a.r, c0: a.c, r1: b.r, c1: b.c }] : [];
  });
  if (out.length) next.tables = out; else delete next.tables;
}

/** O zonă „A1:B5” (sau o celulă) după inserare/ștergere; null dacă a fost ștearsă toată sau iese din tabel. */
export function shiftArea(text: string, axis: Axis, at: number, n: number, band?: Band): string | null {
  const [a, b = a] = text.split(':');
  const p = parseCellId(a);
  const q = parseCellId(b);
  if (!p || !q) return text;
  // Cu bandă, se mută doar zonele care stau în întregime în ea (ca în Excel).
  if (band && !(inBand(band, axis === 'r' ? p.c : p.r) && inBand(band, axis === 'r' ? q.c : q.r))) return text;
  const lo = axis === 'r' ? p.r : p.c;
  const hi = axis === 'r' ? q.r : q.c;
  let nlo: number;
  let nhi: number;
  if (n > 0) { nlo = lo >= at ? lo + n : lo; nhi = hi >= at ? hi + n : hi; } else {
    const d = -n;
    nlo = lo < at ? lo : lo >= at + d ? lo - d : at;
    nhi = hi < at ? hi : hi >= at + d ? hi - d : at - 1;
  }
  if (nhi < nlo || nlo >= max(axis)) return null;
  nhi = Math.min(nhi, max(axis) - 1);
  const P = axis === 'r' ? { r: nlo, c: p.c } : { r: p.r, c: nlo };
  const Q = axis === 'r' ? { r: nhi, c: q.c } : { r: q.r, c: nhi };
  const out = cellId(P.r, P.c);
  return text.includes(':') ? `${out}:${cellId(Q.r, Q.c)}` : out;
}

// Referință (cu sau fără „$”), în afara textelor dintre ghilimele.
const REF = /(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\p{L}\d_(!])/giu;

/** Numele foii scris înaintea referinței care începe la `pos` (Costuri!A1, 'Foaia 1'!A1), sau null. */
export function prefixAt(src: string, pos: number): string | null {
  if (src[pos - 1] !== '!') return null;
  if (src[pos - 2] === "'") {
    let i = pos - 3;
    while (i >= 0 && !(src[i] === "'" && src[i - 1] !== "'")) i -= src[i] === "'" ? 2 : 1;
    return src.slice(i + 1, pos - 2).replace(/''/g, "'");
  }
  const m = /[\p{L}_][\p{L}\d_.]*$/u.exec(src.slice(0, pos - 1));
  return m ? m[0] : null;
}

/**
 * Referințele unei formule după inserare/ștergere în foaia `target`.
 * `inTarget`: formula e chiar în foaia aceea (referințele fără nume de foaie arată spre ea).
 */
export function shiftFormulaRefs(f: string, axis: Axis, at: number, n: number, inTarget: boolean, target: string, band?: Band): string {
  if (!f.startsWith('=')) return f;
  const src = f.slice(1);
  const key = sheetKey(target);
  let out = '';
  let last = 0;
  const strings = /"(?:[^"]|"")*"?|'(?:[^']|'')*'?/g;
  const skip: [number, number][] = [];
  for (let m = strings.exec(src); m; m = strings.exec(src)) skip.push([m.index, m.index + m[0].length]);
  for (let m = REF.exec(src); m; m = REF.exec(src)) {
    const pos = m.index;
    if (skip.some(([a, b]) => pos >= a && pos < b)) continue;
    const prev = src[pos - 1];
    if (prev && /[\p{L}\d_.$]/u.test(prev)) continue;
    // Capătul de jos al unei zone (A1:B5) ține de foaia capătului de sus.
    let startPos = pos;
    if (prev === ':') {
      const s = /(\$?[A-Z]{1,3}\$?\d+)$/i.exec(src.slice(0, pos - 1));
      if (s) startPos = pos - 1 - s[0].length;
    }
    const sheet = prefixAt(src, startPos);
    if (sheet === null ? !inTarget : sheetKey(sheet) !== key) continue;
    const [, cAbs, col, rAbs, row] = m;
    let r = Number(row) - 1;
    let c = colIndex(col.toUpperCase());
    if (band) {
      // Coordonata perpendiculară a referinței și a celuilalt capăt al zonei trebuie să fie în bandă.
      const perp = (cc: number, rr: number) => (axis === 'r' ? cc : rr);
      let other: { r: number; c: number } | null = null;
      if (src[pos + m[0].length] === ':') {
        const e = /^:\$?([A-Z]{1,3})\$?(\d+)/i.exec(src.slice(pos + m[0].length));
        if (e) other = { r: Number(e[2]) - 1, c: colIndex(e[1].toUpperCase()) };
      } else if (prev === ':' && startPos !== pos) {
        const s = /^\$?([A-Z]{1,3})\$?(\d+)/i.exec(src.slice(startPos));
        if (s) other = { r: Number(s[2]) - 1, c: colIndex(s[1].toUpperCase()) };
      }
      if (!inBand(band, perp(c, r)) || (other && !inBand(band, perp(other.c, other.r)))) continue;
    }
    const idx = axis === 'r' ? r : c;
    let ni = shiftIndex(idx, at, n);
    if (ni === null) {
      // O celulă ștearsă: într-o zonă, capătul se strânge (ca în Excel); singură, devine #REF!.
      const isStart = src[pos + m[0].length] === ':';
      const isEnd = prev === ':';
      if (isStart) ni = at;
      else if (isEnd) ni = at - 1;
    }
    let text: string;
    if (ni === null || ni < 0 || ni >= max(axis)) text = '#REF!';
    else {
      if (axis === 'r') r = ni; else c = ni;
      text = `${cAbs}${colName(c)}${rAbs}${r + 1}`;
    }
    out += src.slice(last, pos) + text;
    last = pos + m[0].length;
  }
  const res = '=' + out + src.slice(last);
  // Rândurile / coloanele întregi nu se schimbă când se mută doar o bandă de celule.
  return band ? res : shiftWhole(res, axis, at, n, inTarget, key);
}

// Rânduri întregi (2:5) sau coloane întregi (A:C).
const WHOLE_ROWS = /(\$?)(\d{1,7}):(\$?)(\d{1,7})(?![\p{L}\d_(.,])/gu;
const WHOLE_COLS = /(\$?)([A-Z]{1,3}):(\$?)([A-Z]{1,3})(?![\p{L}\d_(])/giu;

/** Zonele de rânduri / coloane întregi după inserare/ștergere pe aceeași axă; o zonă ștearsă toată devine #REF!. */
function shiftWhole(f: string, axis: Axis, at: number, n: number, inTarget: boolean, key: string): string {
  const src = f.slice(1);
  const skip: [number, number][] = [];
  const strings = /"(?:[^"]|"")*"?|'(?:[^']|'')*'?/g;
  for (let m = strings.exec(src); m; m = strings.exec(src)) skip.push([m.index, m.index + m[0].length]);
  const re = axis === 'r' ? WHOLE_ROWS : WHOLE_COLS;
  re.lastIndex = 0;
  let out = '';
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const pos = m.index;
    if (skip.some(([a, b]) => pos >= a && pos < b)) continue;
    const prev = src[pos - 1];
    if (prev && /[\p{L}\d_.$:]/u.test(prev)) continue;
    const sheet = prefixAt(src, pos);
    if (sheet === null ? !inTarget : sheetKey(sheet) !== key) continue;
    const [, aAbs, a, bAbs, b] = m;
    const idx = (s: string) => (axis === 'r' ? Number(s) - 1 : colIndex(s.toUpperCase()));
    let lo = Math.min(idx(a), idx(b)), hi = Math.max(idx(a), idx(b));
    if (n > 0) { if (lo >= at) lo += n; if (hi >= at) hi += n; } else {
      const d = -n;
      lo = lo < at ? lo : lo >= at + d ? lo - d : at;
      hi = hi < at ? hi : hi >= at + d ? hi - d : at - 1;
    }
    hi = Math.min(hi, max(axis) - 1);
    const name = (i: number) => (axis === 'r' ? String(i + 1) : colName(i));
    const text = hi < lo || lo >= max(axis) ? '#REF!' : `${aAbs}${name(lo)}:${bAbs}${name(hi)}`;
    out += src.slice(last, pos) + text;
    last = pos + m[0].length;
  }
  return last ? '=' + out + src.slice(last) : f;
}

/** Mută celulele, formatarea, lățimile, îmbinările și zonele foii după inserare/ștergere. */
export function shiftSheet(s: Sheet, axis: Axis, at: number, n: number, band?: Band): Sheet {
  if (band) return shiftBand(s, axis, at, n, band);
  const remap = <T>(obj: Record<string, T>) => {
    const out: Record<string, T> = {};
    for (const [id, v] of Object.entries(obj)) {
      const p = parseCellId(id);
      if (!p) continue;
      const i = shiftIndex(axis === 'r' ? p.r : p.c, at, n);
      if (i === null || i >= max(axis)) continue;
      out[axis === 'r' ? cellId(i, p.c) : cellId(p.r, i)] = v;
    }
    return out;
  };
  const areas = <T extends { range: string }>(list: T[] | undefined): T[] => (list ?? [])
    .map((x) => ({ ...x, range: shiftArea(x.range, axis, at, n) }))
    .filter((x): x is T => x.range !== null);
  const next: Sheet = { ...s, cells: remap(s.cells), styles: remap(s.styles) };
  if (axis === 'r' && s.hideRows) {
    const hideRows = s.hideRows.map((k) => shiftIndex(k - 1, at, n)).filter((i): i is number => i !== null && i < ROWS).map((i) => i + 1);
    if (hideRows.length) next.hideRows = hideRows; else delete next.hideRows;
  }
  if (axis === 'c' && s.hideCols) {
    const hideCols = s.hideCols.map((k) => shiftIndex(k - 1, at, n)).filter((i): i is number => i !== null && i < COLS).map((i) => i + 1);
    if (hideCols.length) next.hideCols = hideCols; else delete next.hideCols;
  }
  const lvKey = axis === 'r' ? 'rowLvl' : 'colLvl';
  if (s[lvKey]) {
    const lv = shiftLevels(s[lvKey], (i) => shiftIndex(i, at, n), max(axis));
    if (lv) next[lvKey] = lv; else delete next[lvKey];
  }
  if (axis === 'r' && s.rowH) {
    const rowH: Record<string, number> = {};
    for (const [k, h] of Object.entries(s.rowH)) {
      const i = shiftIndex(Number(k) - 1, at, n);
      if (i !== null && i < ROWS) rowH[String(i + 1)] = h;
    }
    if (Object.keys(rowH).length) next.rowH = rowH; else delete next.rowH;
  }
  if (axis === 'c') {
    const colW: Record<string, number> = {};
    for (const [k, w] of Object.entries(s.colW)) {
      const i = shiftIndex(colIndex(k), at, n);
      if (i !== null && i < COLS) colW[colName(i)] = w;
    }
    next.colW = colW;
  }
  const merges = cleanMerges((s.merges ?? []).map((m) => shiftArea(m, axis, at, n)).filter(Boolean));
  if (merges.length) next.merges = merges; else delete next.merges;
  if (s.lists) next.lists = areas(s.lists);
  if (s.rules) next.rules = areas(s.rules);
  if (s.charts) next.charts = areas(s.charts);
  shiftTables(s, next, axis, at, n);
  if (s.print?.area) {
    const area = shiftArea(s.print.area, axis, at, n);
    next.print = { ...s.print };
    if (area) next.print.area = area; else delete next.print.area;
  }
  if (s.filter) {
    const f = s.filter;
    if (axis === 'r') {
      const r = shiftIndex(f.r, at, n);
      if (r === null) delete next.filter; else next.filter = { ...f, r };
    } else {
      const g = shiftArea(`${cellId(f.r, f.c0)}:${cellId(f.r, f.c1)}`, 'c', at, n);
      const [a, b] = (g ?? '').split(':').map((x) => parseCellId(x));
      if (!a || !b) delete next.filter;
      else {
        // Valorile debifate țin de litera coloanei, deci se mută și ele.
        const hidden: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(f.hidden)) {
          const i = shiftIndex(colIndex(k), at, n);
          if (i !== null) hidden[colName(i)] = v;
        }
        next.filter = { ...f, c0: a.c, c1: b.c, hidden };
      }
    }
  }
  return next;
}

/** Inserare / ștergere de celule doar într-o bandă: restul foii (înălțimi, lățimi, rânduri ascunse, filtru) rămâne pe loc. */
function shiftBand(s: Sheet, axis: Axis, at: number, n: number, band: Band): Sheet {
  const remap = <T>(obj: Record<string, T>) => {
    const out: Record<string, T> = {};
    for (const [id, v] of Object.entries(obj)) {
      const p = parseCellId(id);
      if (!p) continue;
      if (!inBand(band, axis === 'r' ? p.c : p.r)) { out[id] = v; continue; }
      const i = shiftIndex(axis === 'r' ? p.r : p.c, at, n);
      if (i === null || i >= max(axis)) continue;
      out[axis === 'r' ? cellId(i, p.c) : cellId(p.r, i)] = v;
    }
    return out;
  };
  const areas = <T extends { range: string }>(list: T[] | undefined): T[] => (list ?? [])
    .map((x) => ({ ...x, range: shiftArea(x.range, axis, at, n, band) }))
    .filter((x): x is T => x.range !== null);
  const next: Sheet = { ...s, cells: remap(s.cells), styles: remap(s.styles) };
  const merges = cleanMerges((s.merges ?? []).map((m) => shiftArea(m, axis, at, n, band)).filter(Boolean));
  if (merges.length) next.merges = merges; else delete next.merges;
  if (s.lists) next.lists = areas(s.lists);
  if (s.rules) next.rules = areas(s.rules);
  if (s.charts) next.charts = areas(s.charts);
  shiftTables(s, next, axis, at, n, band);
  return next;
}

/** Ar ieși date din tabel la inserare? (ultimele n rânduri/coloane au ceva în ele; cu bandă, doar în ea) */
export function wouldPushOut(s: Sheet, axis: Axis, n: number, band?: Band): boolean {
  return Object.keys(s.cells).some((id) => {
    const p = parseCellId(id);
    return !!p && (axis === 'r' ? p.r : p.c) >= max(axis) - n && inBand(band, axis === 'r' ? p.c : p.r);
  });
}

/**
 * Îmbinările care taie marginea benzii nu se pot muta (Excel refuză la fel): întoarce prima, sau null.
 * `from` = primul rând/coloană afectat pe axă (de acolo în jos / la dreapta totul se mută).
 */
export function bandBlockedBy(s: Sheet, axis: Axis, from: number, band: Band): string | null {
  for (const m of s.merges ?? []) {
    const [a, b = a] = m.split(':');
    const p = parseCellId(a), q = parseCellId(b);
    if (!p || !q) continue;
    const lo = axis === 'r' ? p.c : p.r, hi = axis === 'r' ? q.c : q.r;
    const end = axis === 'r' ? q.r : q.c;
    if (end < from) continue;
    const inside = lo >= band[0] && hi <= band[1];
    const outside = hi < band[0] || lo > band[1];
    if (!inside && !outside) return m;
  }
  return null;
}

/** Inserare (n > 0) sau ștergere (n < 0) în foaia `active`; formulele din toate foile se actualizează. */
export function insertDelete(sheets: Sheet[], active: number, axis: Axis, at: number, n: number, band?: Band): Sheet[] {
  const target = sheets[active].name;
  return sheets.map((s, i) => {
    const base = i === active ? shiftSheet(s, axis, at, n, band) : s;
    let cells = base.cells;
    for (const [id, v] of Object.entries(base.cells)) {
      if (!v.startsWith('=')) continue;
      const f = shiftFormulaRefs(v, axis, at, n, i === active, target, band);
      if (f !== v) { if (cells === base.cells) cells = { ...cells }; cells[id] = f; }
    }
    return cells === base.cells ? base : { ...base, cells };
  });
}
