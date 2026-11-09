// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Referințele la tabelele din Excel („Tabel1[Suma]”, „Tabel1[#All]”, „Tabel1[[#This Row],[Preț]]”, „Tabel1[@Preț]”).
// Suite nu are (încă) tabele cu nume, așa că la import fiecare referință devine zona de celule pe care o înseamnă
// în Excel ($C$2:$C$10). Rezultatele sunt aceleași, iar fișierul salvat înapoi rămâne valid în Excel.

import { cellId } from './format';

export interface ExcelTable {
  /** Numele folosit în formule (displayName). */
  name: string;
  /** Foaia din Excel pe care stă tabelul. */
  sheet: string;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
  /** Numele coloanelor, în ordine. */
  cols: string[];
  /** Câte rânduri de cap (0 sau 1) și de total (0 sau 1) are tabelul. */
  head: number;
  totals: number;
}

const colOf = (id: string) => id.replace(/\d+$/, '');
const quoteSheet = (s: string) => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(s) && !/^[A-Z]{1,3}\d+$/i.test(s) ? s : `'${s.replace(/'/g, "''")}'`);

/** Citește conținutul dintre parantezele drepte, de la poziția „[” (inclusiv); întoarce textul și poziția de după „]”. */
function readBracket(src: string, i: number): { body: string; end: number } | null {
  let depth = 0;
  let j = i;
  while (j < src.length) {
    const ch = src[j];
    if (ch === "'") { j += 2; continue; } // „'” scapă caracterul următor ([ ] # ')
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return { body: src.slice(i + 1, j), end: j + 1 };
    }
    j++;
  }
  return null;
}

const unescape = (s: string) => s.replace(/'(.)/g, '$1').trim();

/** O referință (conținutul parantezei exterioare) → zona Excel, sau „#REF!”. */
function resolve(t: ExcelTable, body: string, row: number, sheet: string): string {
  const items: string[] = [];
  let thisRow = false;
  let cols: [number, number] | null = null;
  const findCol = (name: string) => t.cols.findIndex((c) => c.toLowerCase() === unescape(name).toLowerCase());
  const addCols = (a: string, b?: string) => {
    const i = findCol(a);
    const j = b === undefined ? i : findCol(b);
    if (i < 0 || j < 0) return false;
    const lo = Math.min(i, j);
    const hi = Math.max(i, j);
    cols = cols ? [Math.min(cols[0], lo), Math.max(cols[1], hi)] : [lo, hi];
    return true;
  };
  let b = body.trim();
  if (b.startsWith('@')) { thisRow = true; b = b.slice(1).trim(); }
  if (b && !b.startsWith('[')) {
    // [Suma] sau [#All]
    if (b.startsWith('#')) items.push(b.toLowerCase());
    else if (!addCols(b)) return '#REF!';
  } else if (b) {
    // [[#This Row],[Preț]] sau [[Preț]:[Cantitate]]
    let i = 0;
    while (i < b.length) {
      if (b[i] === '[') {
        const part = readBracket(b, i);
        if (!part) return '#REF!';
        i = part.end;
        const rest = /^\s*:\s*/.exec(b.slice(i));
        if (rest && b[i + rest[0].length] === '[') {
          const second = readBracket(b, i + rest[0].length);
          if (!second) return '#REF!';
          i = second.end;
          if (!addCols(part.body, second.body)) return '#REF!';
        } else if (part.body.trim().startsWith('#')) items.push(part.body.trim().toLowerCase());
        else if (!addCols(part.body)) return '#REF!';
      } else i++;
    }
  }
  const dataTop = t.r0 + t.head;
  const dataBottom = Math.max(dataTop, t.r1 - t.totals);
  let r0 = dataTop;
  let r1 = dataBottom;
  if (items.includes('#this row')) thisRow = true;
  const flags = items.filter((x) => x !== '#this row');
  if (flags.length) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const f of flags) {
      const span: [number, number] | null = f === '#all' ? [t.r0, t.r1]
        : f === '#data' ? [dataTop, dataBottom]
        : f === '#headers' ? (t.head ? [t.r0, t.r0] : null)
        : f === '#totals' ? (t.totals ? [t.r1, t.r1] : null) : null;
      if (!span) return '#REF!';
      lo = Math.min(lo, span[0]);
      hi = Math.max(hi, span[1]);
    }
    r0 = lo;
    r1 = hi;
  }
  const [ca, cb] = cols ?? [0, t.c1 - t.c0];
  const c0 = t.c0 + ca;
  const c1 = t.c0 + cb;
  const prefix = t.sheet.toLowerCase() === sheet.toLowerCase() ? '' : quoteSheet(t.sheet) + '!';
  if (thisRow) {
    // Rândul formulei: coloana fixă, rândul relativ (ca o formulă comună copiată în jos să meargă).
    if (row < dataTop || row > dataBottom) return '#REF!';
    const a = `$${colOf(cellId(row, c0))}${row + 1}`;
    return prefix + (c0 === c1 ? a : `${a}:$${colOf(cellId(row, c1))}${row + 1}`);
  }
  const a = `$${colOf(cellId(r0, c0))}$${r0 + 1}`;
  return prefix + (r0 === r1 && c0 === c1 ? a : `${a}:$${colOf(cellId(r1, c1))}$${r1 + 1}`);
}

/**
 * Formula Excel (textul din fișier, fără „=”) cu referințe la tabele → aceeași formulă cu zone de celule.
 * `row` e rândul celulei (de la 0), `sheet` foaia ei din Excel.
 */
export function expandStructuredRefs(f: string, tables: ExcelTable[], row: number, sheet: string): string {
  if (!tables.length || !f.includes('[')) return f;
  const byName = new Map(tables.map((t) => [t.name.toLowerCase(), t]));
  let out = '';
  let i = 0;
  while (i < f.length) {
    const ch = f[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < f.length && (f[j] !== ch || f[j + 1] === ch)) j += f[j] === ch ? 2 : 1;
      out += f.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const id = /^[\p{L}_\\][\p{L}\d_.\\]*/u.exec(f.slice(i));
    if (id && (i === 0 || !/[\p{L}\d_.$]/u.test(f[i - 1]))) {
      const t = byName.get(id[0].toLowerCase());
      const at = i + id[0].length;
      if (t && f[at] === '[') {
        const br = readBracket(f, at);
        if (br) { out += resolve(t, br.body, row, sheet); i = br.end; continue; }
      } else if (t && f[at] !== '(' && f[at] !== '!') {
        // Numele tabelului singur înseamnă datele lui.
        out += resolve(t, '', row, sheet);
        i = at;
        continue;
      }
      out += id[0];
      i = at;
      continue;
    }
    if (ch === '[' && (i === 0 || !/[\p{L}\d_\]]/u.test(f[i - 1]))) {
      // Fără numele tabelului ([@Preț]): tabelul în care stă formula. „[1]Foaie!A1” (alt fișier) rămâne neschimbat.
      const br = readBracket(f, i);
      const own = br && !/^\d+$/.test(br.body) ? tables.find((t) => t.sheet.toLowerCase() === sheet.toLowerCase() && row >= t.r0 && row <= t.r1) : undefined;
      if (br && own) { out += resolve(own, br.body, row, sheet); i = br.end; continue; }
    }
    out += ch;
    i++;
  }
  return out;
}
