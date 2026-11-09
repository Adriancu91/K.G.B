// Original: src/pdf/formdata.ts din Cyber Office Studio, aplicația proprietarului (D-071, D-072), fără schimbări de logică.
// @ts-nocheck — K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine; testat în tests/.
// Datele unui formular PDF, separat de PDF (Export / Import date formular): ce s-a completat în câmpuri se salvează într-un
// fișier mic .xfdf (XML standard, ISO 19444-1) sau .csv (un rând cu numele câmpurilor, unul cu valorile, ca să se adune
// în Sheets mai multe răspunsuri), apoi se poate pune înapoi în același formular gol. Testat în tests/pdf-formdata.test.mjs.
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import { parseXml, type XNode } from './xfdf'; // K.G.B.: „type” ca Node 24 să poată citi fișierul (singura schimbare)

export type FieldValue = string | string[] | boolean;
export interface FormValue { name: string; value: FieldValue }

const NO_FIELDS = 'PDF-ul nu are câmpuri de completat.';

/** Valorile tuturor câmpurilor (text, bife, liste, butoane radio), în ordinea din formular. Butoanele simple se sar. */
export async function readFormValues(bytes: Uint8Array): Promise<FormValue[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out: FormValue[] = [];
  for (const f of doc.getForm().getFields()) {
    try {
      const name = f.getName();
      if (f instanceof PDFTextField) out.push({ name, value: f.getText() ?? '' });
      else if (f instanceof PDFCheckBox) out.push({ name, value: f.isChecked() });
      else if (f instanceof PDFRadioGroup) out.push({ name, value: f.getSelected() ?? '' });
      else if (f instanceof PDFDropdown || f instanceof PDFOptionList) { const s = f.getSelected(); out.push({ name, value: s.length > 1 ? s : s[0] ?? '' }); }
    } catch { /* un câmp stricat nu oprește restul */ }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const asText = (v: FieldValue) => (typeof v === 'boolean' ? (v ? 'Da' : 'Off') : Array.isArray(v) ? v.join('; ') : v);

/** Fișierul .xfdf cu valorile (numele cu puncte, „a.b”, devin câmpuri unul în altul, cum le scriu și alte programe). */
export function valuesToXfdf(values: FormValue[], fileName = ''): string {
  interface T { kids: Map<string, T>; value?: FieldValue }
  const root: T = { kids: new Map() };
  for (const v of values) {
    let t = root;
    for (const part of v.name.split('.')) { if (!t.kids.has(part)) t.kids.set(part, { kids: new Map() }); t = t.kids.get(part)!; }
    t.value = v.value;
  }
  const write = (t: T, ind: string): string => [...t.kids].map(([name, k]) => {
    const vals = k.value === undefined ? [] : Array.isArray(k.value) ? k.value : [asText(k.value)];
    const inner = vals.map((x) => `${ind}  <value>${esc(x)}</value>\n`).join('') + write(k, ind + '  ');
    return `${ind}<field name="${esc(name)}">\n${inner}${ind}</field>\n`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">\n<fields>\n${write(root, '')}</fields>\n`
    + (fileName ? `<f href="${esc(fileName)}"/>\n` : '') + '</xfdf>\n';
}

/** Fișierul .csv: primul rând numele câmpurilor, al doilea valorile (cu ghilimele unde e nevoie). */
export function valuesToCsv(values: FormValue[]): string {
  const q = (s: string) => (/[",\n\r;]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s);
  return values.map((v) => q(v.name)).join(',') + '\r\n' + values.map((v) => q(asText(v.value))).join(',') + '\r\n';
}

/** Răspunsurile din mai multe formulare completate, adunate într-un singur tabel .csv: un rând pe fișier (prima coloană
 *  numele lui), o coloană pe câmp. Câmpurile se iau în ordinea în care apar prima dată, deci și formulare puțin diferite
 *  (un câmp în plus sau lipsă) intră în același tabel, cu celula goală unde câmpul lipsește. */
export function responsesToCsv(list: { file: string; values: FormValue[] }[]): string {
  const q = (s: string) => (/[",\n\r;]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s);
  const cols: string[] = [], seen = new Set<string>();
  for (const r of list) for (const v of r.values) if (!seen.has(v.name)) { seen.add(v.name); cols.push(v.name); }
  const rows = [['Fișier', ...cols].map(q).join(',')];
  for (const r of list) {
    const by = new Map(r.values.map((v) => [v.name, asText(v.value)]));
    rows.push([r.file, ...cols.map((c) => by.get(c) ?? '')].map(q).join(','));
  }
  return rows.join('\r\n') + '\r\n';
}

/** Citește un CSV (virgulă, punct și virgulă sau Tab; ghilimele duble) în rânduri. */
function parseCsv(src: string): string[][] {
  const text = (src.startsWith(String.fromCharCode(0xfeff)) ? src.slice(1) : src);
  const first = text.split(/\r?\n/)[0] ?? '';
  const sep = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/** Valorile dintr-un fișier .xfdf sau .csv (la CSV cu mai multe răspunsuri se ia rândul `row`, implicit primul). */
export function parseFormData(text: string, row = 1): FormValue[] {
  const t = text.trimStart();
  if (t.startsWith('<')) {
    const out: FormValue[] = [];
    const walk = (n: XNode, prefix: string) => {
      for (const k of n.kids) {
        if (k.name !== 'field') { if (k.name === 'fields' || k.name === 'xfdf') walk(k, prefix); continue; }
        const name = prefix + (k.attrs.name ?? '');
        const vals = k.kids.filter((x) => x.name === 'value').map((x) => x.text);
        if (vals.length) out.push({ name, value: vals.length > 1 ? vals : vals[0] });
        walk(k, name + '.');
      }
    };
    walk(parseXml(t), '');
    return out;
  }
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const vals = rows[Math.min(Math.max(1, row), rows.length - 1)];
  return rows[0].map((name, i) => ({ name: name.trim(), value: vals[i] ?? '' })).filter((v) => v.name);
}

const YES = ['da', 'yes', 'on', '1', 'true', 'x', 'adevărat', '✓', 'bifat'];

/** Pune valorile în câmpurile cu același nume. Întoarce PDF-ul nou, câte câmpuri s-au completat și numele care nu există în formular. */
export async function fillForm(bytes: Uint8Array, values: FormValue[]): Promise<{ bytes: Uint8Array; filled: number; missing: string[] }> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error(NO_FIELDS);
  const byName = new Map(fields.map((f) => [f.getName(), f]));
  let filled = 0;
  const missing: string[] = [];
  for (const { name, value } of values) {
    const f = byName.get(name);
    if (!f) { missing.push(name); continue; }
    const text = asText(value);
    try {
      if (f instanceof PDFTextField) { f.setText(text); filled++; }
      else if (f instanceof PDFCheckBox) {
        // Valoarea de „bifat” a câmpului (de exemplu „Yes” sau „Da”) sau una din cuvintele obișnuite.
        const on = typeof value === 'boolean' ? value : YES.includes(text.trim().toLowerCase()) || (text.trim() !== '' && text.trim().toLowerCase() !== 'off' && text.trim().toLowerCase() !== 'nu' && text.trim().toLowerCase() !== 'false' && text.trim() !== '0');
        if (on) f.check(); else f.uncheck();
        filled++;
      }
      else if (f instanceof PDFRadioGroup) { if (!text) { f.clear(); filled++; } else if (f.getOptions().includes(text)) { f.select(text); filled++; } }
      else if (f instanceof PDFDropdown) {
        if (!text) f.clear(); else f.select(text, f.isEditable());
        filled++;
      }
      else if (f instanceof PDFOptionList) {
        const want = (Array.isArray(value) ? value : text ? [text] : []).filter((x) => f.getOptions().includes(x));
        if (want.length) f.select(want); else f.clear();
        filled++;
      }
    } catch { /* o valoare care nu se potrivește (de exemplu o opțiune care nu e în listă) nu oprește restul */ }
  }
  try {
    return { bytes: await doc.save(), filled, missing };
  } catch {
    // Aspectul câmpurilor nu s-a putut redesena (de exemplu un font fără diacritice): îl lasă pe seama cititorului.
    return { bytes: await doc.save({ updateFieldAppearances: false }), filled, missing };
  }
}

// ---- .fdf: formatul mai vechi al datelor de formular, cu sintaxa PDF (%FDF-1.2, /FDF << /Fields [...] >>) ----
// Scris de la zero: la scriere, câmpurile cu nume cu punct devin /Kids; la citire se înțeleg și referințele „n 0 R”.
const BSL = 92; // codul caracterului „backslash” (ocolit în sursă)
const NL = String.fromCharCode(10);

/** Un șir PDF: textul ASCII ca (text), restul ca UTF-16BE cu BOM, în hex. */
export function pdfString(s: string): string {
  if (/^[ -~]*$/.test(s)) {
    let out = '(';
    for (const ch of s) { if (ch === '(' || ch === ')' || ch.charCodeAt(0) === BSL) out += String.fromCharCode(BSL); out += ch; }
    return out + ')';
  }
  let hex = '<FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return hex + '>';
}
const fdfValue = (v: FieldValue) => (typeof v === 'boolean' ? (v ? '/Yes' : '/Off') : Array.isArray(v) ? '[' + v.map(pdfString).join(' ') + ']' : pdfString(v));

/** Fișierul .fdf cu valorile (bifele ca /Yes / /Off, listele cu mai multe alegeri ca [..]). */
export function valuesToFdf(values: FormValue[], fileName = ''): string {
  interface T { kids: Map<string, T>; value?: FieldValue }
  const root: T = { kids: new Map() };
  for (const v of values) {
    let t = root;
    for (const part of v.name.split('.')) { if (!t.kids.has(part)) t.kids.set(part, { kids: new Map() }); t = t.kids.get(part)!; }
    t.value = v.value;
  }
  const write = (t: T): string => '[' + [...t.kids].map(([name, k]) =>
    `<< /T ${pdfString(name)}${k.value === undefined ? '' : ' /V ' + fdfValue(k.value)}${k.kids.size ? ' /Kids ' + write(k) : ''} >>`).join(NL) + ']';
  return ['%FDF-1.2', '1 0 obj', `<< /FDF << /Fields ${write(root)}${fileName ? ' /F ' + pdfString(fileName) : ''} >> >>`, 'endobj', 'trailer', '<< /Root 1 0 R >>', '%%EOF', ''].join(NL);
}

export type PV = { s: string } | { n: string } | { r: string } | PV[] | Map<string, PV> | null;
const isWs = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
const DELIMS = '()<>[]{}/%';
const isDelim = (c: number) => DELIMS.includes(String.fromCharCode(c));
const ESCAPES: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };

/** Textul unui șir PDF: UTF-16BE (cu BOM), UTF-8 (cu BOM) sau octeți simpli. */
function decodePdfString(b: number[]): string {
  if (b[0] === 0xfe && b[1] === 0xff) { let s = ''; for (let i = 2; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]); return s; }
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder().decode(new Uint8Array(b.slice(3)));
  return String.fromCharCode(...b);
}

/** Cititor mic de obiecte PDF (dicționare, liste, șiruri, nume, referințe), cât trebuie pentru .fdf. */
export class PdfReader {
  private src: string;
  pos: number;
  constructor(src: string, pos: number) { this.src = src; this.pos = pos; }
  private c(at = this.pos) { return this.src.charCodeAt(at); }
  private skip() {
    while (this.pos < this.src.length) {
      if (isWs(this.c())) this.pos++;
      else if (this.src[this.pos] === '%') { while (this.pos < this.src.length && this.c() !== 10 && this.c() !== 13) this.pos++; }
      else break;
    }
  }
  private token(): string { const a = this.pos; while (this.pos < this.src.length && !isWs(this.c()) && !isDelim(this.c())) this.pos++; return this.src.slice(a, this.pos); }
  value(depth = 0): PV {
    if (depth > 64) throw new Error('Fișierul .fdf e prea adânc');
    this.skip();
    const ch = this.src[this.pos];
    if (ch === undefined) return null;
    if (ch === '<' && this.src[this.pos + 1] === '<') {
      this.pos += 2;
      const m = new Map<string, PV>();
      for (;;) {
        this.skip();
        if (this.pos >= this.src.length) break;
        if (this.src.startsWith('>>', this.pos)) { this.pos += 2; break; }
        const k = this.value(depth + 1);
        if (!k || Array.isArray(k) || k instanceof Map || !('n' in k)) continue;
        m.set(k.n, this.value(depth + 1));
      }
      return m;
    }
    if (ch === '<') {
      const end = this.src.indexOf('>', this.pos);
      let hex = this.src.slice(this.pos + 1, end < 0 ? this.src.length : end).replace(/[^0-9a-fA-F]/g, '');
      this.pos = end < 0 ? this.src.length : end + 1;
      if (hex.length % 2) hex += '0';
      const b: number[] = [];
      for (let i = 0; i < hex.length; i += 2) b.push(parseInt(hex.slice(i, i + 2), 16));
      return { s: decodePdfString(b) };
    }
    if (ch === '[') {
      this.pos++;
      const a: PV[] = [];
      for (;;) {
        this.skip();
        if (this.pos >= this.src.length) break;
        if (this.src[this.pos] === ']') { this.pos++; break; }
        a.push(this.value(depth + 1));
      }
      return a;
    }
    if (ch === '(') {
      this.pos++;
      const b: number[] = [];
      let level = 1;
      while (this.pos < this.src.length) {
        const c = this.c();
        this.pos++;
        if (c === BSL) {
          const e = this.src[this.pos];
          if (e === undefined) break;
          if (e in ESCAPES) { b.push(ESCAPES[e]); this.pos++; }
          else if (e >= '0' && e <= '7') { let o = ''; while (o.length < 3 && this.src[this.pos] >= '0' && this.src[this.pos] <= '7') o += this.src[this.pos++]; b.push(parseInt(o, 8) & 255); }
          else if (this.c() === 13) { this.pos++; if (this.c() === 10) this.pos++; }
          else if (this.c() === 10) this.pos++;
          else { b.push(this.c()); this.pos++; }
          continue;
        }
        if (c === 40) level++;
        else if (c === 41 && --level === 0) break;
        b.push(c);
      }
      return { s: decodePdfString(b) };
    }
    if (ch === '/') {
      this.pos++;
      const raw = this.token().replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
      return { n: decodePdfString([...raw].map((x) => x.charCodeAt(0))) };
    }
    if (isDelim(this.c())) { this.pos++; return null; }
    const t = this.token();
    // „12 0 R”: o referință la un obiect din fișier.
    if (/^[0-9]+$/.test(t)) {
      const save = this.pos;
      this.skip();
      const g = this.token();
      this.skip();
      const after = this.pos + 1 >= this.src.length || isWs(this.c(this.pos + 1)) || isDelim(this.c(this.pos + 1));
      if (/^[0-9]+$/.test(g) && this.src[this.pos] === 'R' && after) { this.pos++; return { r: t + ' ' + g }; }
      this.pos = save;
    }
    return t ? { s: t } : null;
  }
}

/** Valorile dintr-un fișier .fdf (octeții lui). Bifele și butoanele radio vin ca nume (Yes, Off, F…). */
export function parseFdf(data: Uint8Array): FormValue[] {
  let src = '';
  for (let i = 0; i < data.length; i += 8192) src += String.fromCharCode(...data.subarray(i, i + 8192));
  const at = src.indexOf('/Fields');
  if (at < 0) return [];
  const resolve = (v: PV, depth = 0): PV => {
    if (!v || Array.isArray(v) || v instanceof Map || !('r' in v) || depth > 8) return v;
    const [n, g] = v.r.split(' ');
    const m = new RegExp('(^|[^0-9])' + n + '[ ]+' + g + '[ ]+obj').exec(src);
    if (!m) return null;
    return resolve(new PdfReader(src, m.index + m[0].length).value(), depth + 1);
  };
  const text = (v: PV): string | null => {
    const x = resolve(v);
    if (!x || Array.isArray(x) || x instanceof Map) return null;
    return 's' in x ? x.s : 'n' in x ? x.n : null;
  };
  const out: FormValue[] = [];
  const walk = (list: PV, prefix: string, depth: number) => {
    const arr = resolve(list);
    if (!Array.isArray(arr) || depth > 32) return;
    for (const item of arr) {
      const d = resolve(item);
      if (!(d instanceof Map)) continue;
      const t = d.has('T') ? text(d.get('T')!) : null;
      const name = t === null ? prefix.replace(/[.]$/, '') : prefix + t;
      if (d.has('V')) {
        const v = resolve(d.get('V')!);
        if (Array.isArray(v)) out.push({ name, value: v.map(text).filter((x): x is string => x !== null) });
        else { const s = text(v); if (s !== null) out.push({ name, value: s }); }
      }
      if (d.has('Kids')) walk(d.get('Kids')!, name ? name + '.' : '', depth + 1);
    }
  };
  walk(new PdfReader(src, at + 7).value(), '', 0);
  return out;
}

/** Fișierul primit e .fdf (are %FDF- la început). */
export function isFdf(data: Uint8Array): boolean {
  return String.fromCharCode(...data.subarray(0, 1024)).includes('%FDF-');
}
