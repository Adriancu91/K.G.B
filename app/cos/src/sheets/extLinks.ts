// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Legăturile spre alte registre (External references): formula =[Buget.xlsx]Foaie1!B2 ia valoarea din alt fișier.
// În .xlsx formulele scriu doar numărul registrului ([1]Foaie1!B2), iar numele fișierului, foile și ultimele valori citite
// stau în xl/externalLinks/externalLinkN.xml. În Suite formula păstrează numele fișierului, iar valorile stau în doc.links.

import { evaluateAll, formatNumber, sheetKey, type ExtBook, type Result } from './formula';
import { keepText } from './numfmt';

export const MAX_LINKS = 50;
const MAX_LINK_CELLS = 200000;

/** '[1]Foaia mea'!A1 sau [1]Foaie1!A1, cu sau fără apostrofuri (în afara textelor dintre ghilimele). */
const XL_EXT = /'\[(\d+)\]((?:[^']|'')+)'!|\[(\d+)\]([\p{L}_][\p{L}\d_.]*)!/gu;
/** 'C:\Dosar\[Buget.xlsx]Foaia mea'!A1 sau [Buget.xlsx]Foaie1!A1 (forma din Suite). */
const OUR_EXT = /'((?:[^'[]|'')*?)\[([^\][]+)\]((?:[^']|'')+)'!|\[([^\][]*[^\][\d][^\][]*)\]([\p{L}_][\p{L}\d_.]*)!/gu;

/** Aplică `fn` doar pe bucățile din afara textelor "…" ale formulei. */
function outsideStrings(f: string, fn: (part: string) => string): string {
  return f.split(/("(?:[^"]|"")*")/).map((p, i) => (i % 2 ? p : fn(p))).join('');
}

/** Numele foii cu apostrofurile dublate (cum stă între apostrofuri). */
const q = (s: string) => s.replace(/'/g, "''");

/** Formula din .xlsx cu [1] → formula Suite cu numele fișierului; `used` primește numerele registrelor folosite. */
export function extFromExcel(f: string, nameOf: (n: number) => string | null, used?: Set<number>): string {
  if (!f.includes('[')) return f;
  return outsideStrings(f, (p) => p.replace(XL_EXT, (all, n1, s1, n2, s2) => {
    const n = Number(n1 ?? n2), name = nameOf(n);
    if (!name) return all;
    used?.add(n);
    return `'[${q(name)}]${s1 ?? q(s2)}'!`;
  }));
}

/**
 * Formula Suite → formula .xlsx: [Buget.xlsx]Foaie1! devine [n]Foaie1!, unde n e locul registrului în `links` (numărat de la 1).
 * Registrele și foile care nu sunt încă în `links` se adaugă (fără valori), ca fișierul să rămână valid.
 */
export function extToExcel(f: string, links: ExtBook[]): string {
  if (!f.includes('[')) return f;
  return outsideStrings(f, (p) => p.replace(OUR_EXT, (all, dir, b1, s1, b2, s2) => {
    const book = (b1 ?? b2) as string, sheet = s1 !== undefined ? (s1 as string).replace(/''/g, "'") : (s2 as string);
    let i = links.findIndex((l) => sheetKey(l.name) === sheetKey(book));
    if (i < 0) {
      if (links.length >= MAX_LINKS) return all;
      const path = dir ? String(dir).replace(/''/g, "'") + book : undefined;
      links.push({ name: book, ...(path ? { path } : {}), sheets: [] });
      i = links.length - 1;
    }
    const l = links[i];
    if (!l.sheets.some((s) => sheetKey(s.name) === sheetKey(sheet))) l.sheets.push({ name: sheet, cells: {} });
    return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheet) && !/^[A-Z]{1,3}\d+$/i.test(sheet) ? `[${i + 1}]${sheet}!` : `'[${i + 1}]${q(sheet)}'!`;
  }));
}

/** Toate referințele spre alte registre scrise cu apostrofuri ('[Buget.xlsx]Foaie1'!), ca să se recunoască la fel ca foile obișnuite. */
export function quoteExtRefs(f: string): string {
  if (!f.includes('[')) return f;
  return outsideStrings(f, (p) => p.replace(OUR_EXT, (all, _dir, b1, _s1, b2, s2) => (b1 !== undefined ? all : `'[${q(b2)}]${q(s2)}'!`)));
}

/** Registrele externe pomenite într-o formulă Suite (numele fișierelor, cu litere mici). */
export function extBooksIn(f: string): string[] {
  if (!f.includes('[')) return [];
  const out = new Set<string>();
  outsideStrings(f, (p) => { for (const m of p.matchAll(OUR_EXT)) out.add(sheetKey(m[2] ?? m[4])); return p; });
  return [...out];
}

/** Formula Suite cu numele unui registru extern schimbat (Schimbă sursa…): [Vechi.xlsx]Foaie! → '[Nou.xlsx]Foaie'!. */
export function renameExtBook(f: string, from: string, to: string): string {
  if (!f.includes('[')) return f;
  const key = sheetKey(from);
  return outsideStrings(f, (p) => p.replace(OUR_EXT, (all, _dir, b1, s1, b2, s2) => {
    if (sheetKey(b1 ?? b2) !== key) return all;
    return `'[${q(to)}]${s1 ?? q(s2)}'!`;
  }));
}

/** Rezultatul unei formule ca text de celulă: numărul cu virgulă, eroarea, ADEVĂRAT / FALS, textul (cu apostrof dacă arată ca număr). */
export function resultCellText(r: Result | undefined): string {
  if (!r) return '';
  if (r.err) return r.err;
  if (r.num && r.value !== undefined) return formatNumber(r.value);
  return /^(ADEV[ĂA]RAT|FALS)$/.test(r.text) ? r.text : keepText(r.text);
}

/**
 * Foile unui registru citit din fișier → valorile păstrate pentru legătură: formulele lui se calculează (cu registrele lui externe),
 * iar în legătură rămân doar valorile (cel mult 200.000 de celule).
 */
export function linkSheetsFrom(sheets: { name: string; cells: Record<string, string> }[], ext?: ExtBook[]): ExtBook['sheets'] {
  let left = MAX_LINK_CELLS;
  return sheets.map((sh) => {
    const hasF = Object.values(sh.cells).some((t) => t.startsWith('='));
    const res = hasF ? evaluateAll(sh.cells, { self: sh.name, sheets, ext }) : {};
    const cells: Record<string, string> = {};
    for (const [id, t] of Object.entries(sh.cells)) {
      if (!t || left <= 0) continue;
      const v = t.startsWith('=') ? resultCellText(res[id]) : t;
      if (v) { cells[id] = v; left--; }
    }
    return { name: sh.name, cells };
  });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Valoarea unei celule din Suite → atributul t și textul <v> din externalLink. */
function cellXml(id: string, text: string): string {
  const t = text.trim();
  if (!t) return '';
  if (/^-?\d+(,\d+)?([eE][+-]?\d+)?$/.test(t)) return `<cell r="${id}"><v>${t.replace(',', '.')}</v></cell>`;
  if (/^(ADEV[ĂA]RAT|TRUE)$/i.test(t)) return `<cell r="${id}" t="b"><v>1</v></cell>`;
  if (/^(FALS|FALSE)$/i.test(t)) return `<cell r="${id}" t="b"><v>0</v></cell>`;
  if (/^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A)$/i.test(t)) return `<cell r="${id}" t="e"><v>${esc(t.toUpperCase())}</v></cell>`;
  return `<cell r="${id}" t="str"><v>${esc(text.startsWith("'") ? text.slice(1) : text)}</v></cell>`;
}

/** xl/externalLinks/externalLinkN.xml: foile registrului și valorile lor păstrate. */
export function externalLinkXml(l: ExtBook): string {
  const data = l.sheets.map((s, i) => {
    const rows = new Map<number, string[]>();
    for (const [id, v] of Object.entries(s.cells)) {
      const r = Number(/\d+$/.exec(id)?.[0]);
      const x = r ? cellXml(id, v) : '';
      if (x) (rows.get(r) ?? rows.set(r, []).get(r)!).push(x);
    }
    const body = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([r, cs]) => `<row r="${r}">${cs.join('')}</row>`).join('');
    return body ? `<sheetData sheetId="${i}">${body}</sheetData>` : `<sheetData sheetId="${i}"/>`;
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<externalLink xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><externalBook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1">'
    + `<sheetNames>${l.sheets.map((s) => `<sheetName val="${esc(s.name)}"/>`).join('')}</sheetNames>`
    + (data ? `<sheetDataSet>${data}</sheetDataSet>` : '') + '</externalBook></externalLink>';
}

/** Unde e fișierul, cum se scrie în legătura .xlsx: calea întreagă (file:///C:/…) sau doar numele, lângă registru. */
export function linkTarget(l: ExtBook): string {
  const p = (l.path ?? '').replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(p)) return 'file:///' + encodeURI(p);
  return encodeURI(p || l.name);
}

/** Valorile citite dintr-un alt registru, păstrate în doc: cel mult 50 de fișiere și 200.000 de celule în total. */
export function cleanLinks(raw: unknown): ExtBook[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtBook[] = [];
  let cells = 0;
  for (const x of raw.slice(0, MAX_LINKS)) {
    const name = typeof x?.name === 'string' ? x.name.trim().slice(0, 255) : '';
    if (!name || /[[\]]/.test(name) || out.some((o) => sheetKey(o.name) === sheetKey(name))) continue;
    const sheets: ExtBook['sheets'] = [];
    for (const s of Array.isArray(x.sheets) ? x.sheets.slice(0, 255) : []) {
      const sn = typeof s?.name === 'string' ? s.name.slice(0, 31) : '';
      if (!sn) continue;
      const c: Record<string, string> = {};
      for (const [id, v] of Object.entries(s.cells && typeof s.cells === 'object' ? s.cells : {})) {
        if (cells >= MAX_LINK_CELLS) break;
        if (/^[A-Z]{1,3}\d{1,7}$/.test(id) && typeof v === 'string' && v && !v.startsWith('=')) { c[id] = v.slice(0, 32767); cells++; }
      }
      sheets.push({ name: sn, cells: c });
    }
    out.push({ name, ...(typeof x.path === 'string' && x.path ? { path: x.path.slice(0, 1000) } : {}), sheets });
  }
  return out;
}
