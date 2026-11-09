// Original: src/pdf/xfdf.ts din Cyber Office Studio, aplicația proprietarului (D-071, D-072), fără schimbări de logică.
// @ts-nocheck — K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine; testat în tests/.
// Comentariile ca fișier separat, în formatul XFDF (XML, standard ISO 19444-1), ca „Exportă / Importă comentarii” din Acrobat:
// trimiți doar comentariile (fișier mic) cuiva care are același PDF, iar el le pune peste documentul lui.
// Merg notele, casetele de text, evidențierile, sublinierile, tăierile, formele, liniile, desenele, ștampilele și răspunsurile
// (cu stările lor). Aspectul desenat al ștampilelor nu se mută (Acrobat face la fel): ștampila apare ca dreptunghi cu numele ei.
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString } from 'pdf-lib';
import { open } from './edit';

/** Tipurile de comentarii care se mută: numele din PDF ↔ numele elementului XFDF. */
export const KINDS: [string, string][] = [
  ['Text', 'text'], ['FreeText', 'freetext'], ['Highlight', 'highlight'], ['Underline', 'underline'], ['StrikeOut', 'strikeout'],
  ['Squiggly', 'squiggly'], ['Square', 'square'], ['Circle', 'circle'], ['Line', 'line'], ['Polygon', 'polygon'], ['PolyLine', 'polyline'],
  ['Ink', 'ink'], ['Stamp', 'stamp'], ['Caret', 'caret'],
];
const toXml = new Map(KINDS);
const fromXml = new Map(KINDS.map(([a, b]) => [b, a]));

// ---------- XML: un cititor mic (XFDF e XML simplu), fără expresii regulate, ca să meargă la fel peste tot ----------

export interface XNode { name: string; attrs: Record<string, string>; kids: XNode[]; text: string }

const isSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === 13;

function decode(s: string): string {
  if (!s.includes('&')) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '&') { out += s[i]; continue; }
    const end = s.indexOf(';', i);
    if (end < 0 || end - i > 10) { out += '&'; continue; }
    const ent = s.slice(i + 1, end);
    const named: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
    let ch = named[ent];
    if (ch === undefined && ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      ch = Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    if (ch === undefined) { out += '&'; continue; }
    out += ch;
    i = end;
  }
  return out;
}

export function parseXml(src: string): XNode {
  const root: XNode = { name: '#root', attrs: {}, kids: [], text: '' };
  const stack: XNode[] = [root];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    const top = stack[stack.length - 1];
    if (lt < 0) { top.text += decode(src.slice(i)); break; }
    if (lt > i) top.text += decode(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt); i = e < 0 ? n : e + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) { const e = src.indexOf(']]>', lt); top.text += src.slice(lt + 9, e < 0 ? n : e); i = e < 0 ? n : e + 3; continue; }
    if (src[lt + 1] === '?' || src[lt + 1] === '!') { const e = src.indexOf('>', lt); i = e < 0 ? n : e + 1; continue; }
    if (src[lt + 1] === '/') {
      const e = src.indexOf('>', lt);
      const name = src.slice(lt + 2, e < 0 ? n : e).trim();
      // Închide până la elementul cu același nume (XML stricat nu oprește citirea).
      for (let k = stack.length - 1; k > 0; k--) if (stack[k].name === name) { stack.length = k; break; }
      i = e < 0 ? n : e + 1;
      continue;
    }
    // Eticheta de deschidere: numele, apoi atributele.
    let j = lt + 1;
    while (j < n && !isSpace(src.charCodeAt(j)) && src[j] !== '>' && src[j] !== '/') j++;
    const node: XNode = { name: src.slice(lt + 1, j), attrs: {}, kids: [], text: '' };
    let selfClose = false;
    while (j < n) {
      while (j < n && isSpace(src.charCodeAt(j))) j++;
      if (src[j] === '>') { j++; break; }
      if (src[j] === '/' && src[j + 1] === '>') { selfClose = true; j += 2; break; }
      let k = j;
      while (k < n && src[k] !== '=' && src[k] !== '>' && !isSpace(src.charCodeAt(k))) k++;
      const key = src.slice(j, k);
      while (k < n && isSpace(src.charCodeAt(k))) k++;
      if (src[k] !== '=') { if (k === j) k++; j = k; continue; }
      k++;
      while (k < n && isSpace(src.charCodeAt(k))) k++;
      const q = src[k];
      if (q === '"' || q === "'") {
        const e = src.indexOf(q, k + 1);
        node.attrs[key] = decode(src.slice(k + 1, e < 0 ? n : e));
        j = e < 0 ? n : e + 1;
      } else {
        let e = k;
        while (e < n && !isSpace(src.charCodeAt(e)) && src[e] !== '>') e++;
        node.attrs[key] = decode(src.slice(k, e));
        j = e;
      }
    }
    top.kids.push(node);
    if (!selfClose) stack.push(node);
    i = j;
  }
  return root;
}

export const esc = (s: string) => s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
/** Numele fără prefix („xfdf:annots” → „annots”), ca să citim și fișierele scrise cu spații de nume. */
export const local = (name: string) => name.slice(name.indexOf(':') + 1).toLowerCase();
export const find = (node: XNode, name: string): XNode | undefined => node.kids.find((k) => local(k.name) === name);
export const textOf = (node: XNode): string => node.text + node.kids.map(textOf).join('');

// ---------- PDF → XFDF ----------

const num = (v: unknown) => { const x = v instanceof PDFNumber ? v.asNumber() : Number(String(v)); return Number.isFinite(x) ? x : 0; };
const nums = (d: PDFDict, key: string): number[] | null => {
  const a = d.lookupMaybe(PDFName.of(key), PDFArray);
  return a ? a.asArray().map(num) : null;
};
const fmt = (x: number) => String(Math.round(x * 1000) / 1000);
const str = (d: PDFDict, key: string): string => {
  const v = d.get(PDFName.of(key));
  return v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : '';
};
const nameOf = (d: PDFDict, key: string): string => { const v = d.get(PDFName.of(key)); return v instanceof PDFName ? v.decodeText() : str(d, key); };
const hex2 = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
const colorOf = (c: number[] | null) => (c && c.length === 3 ? `#${c.map(hex2).join('')}` : c && c.length === 1 ? `#${hex2(c[0]).repeat(3)}` : '');
export const FLAGS: [number, string][] = [[1, 'invisible'], [2, 'hidden'], [4, 'print'], [8, 'nozoom'], [16, 'norotate'], [32, 'noview'], [64, 'readonly'], [128, 'locked'], [256, 'togglenoview']];

/** Comentariile documentului, ca text XFDF. `fileName` se scrie în fișier, ca Acrobat să știe la ce PDF se referă. */
export async function exportXfdf(bytes: Uint8Array, fileName = ''): Promise<{ xml: string; count: number }> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  // Fiecare comentariu are nevoie de un nume (/NM) ca răspunsurile să-și găsească părintele.
  const names = new Map<string, string>();
  const list: { page: number; d: PDFDict; ref: PDFRef | null; kind: string }[] = [];
  doc.getPages().forEach((p, page) => {
    p.node.lookupMaybe(PDFName.of('Annots'), PDFArray)?.asArray().forEach((r) => {
      const d = r instanceof PDFRef ? doc.context.lookupMaybe(r, PDFDict) : r instanceof PDFDict ? r : undefined;
      if (!d) return;
      const kind = toXml.get(nameOf(d, 'Subtype'));
      if (!kind) return;
      const ref = r instanceof PDFRef ? r : null;
      if (ref) names.set(ref.toString(), str(d, 'NM') || `suite-${ref.objectNumber}-${ref.generationNumber}`);
      list.push({ page, d, ref, kind });
    });
  });
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">', '<annots>'];
  for (const { page, d, ref, kind } of list) {
    const a: [string, string][] = [['page', String(page)]];
    const rect = nums(d, 'Rect');
    if (rect && rect.length === 4) a.push(['rect', rect.map(fmt).join(',')]);
    a.push(['name', ref ? names.get(ref.toString())! : str(d, 'NM') || `suite-${page}-${out.length}`]);
    const title = str(d, 'T'); if (title) a.push(['title', title]);
    const subj = str(d, 'Subj'); if (subj) a.push(['subject', subj]);
    const date = str(d, 'M'); if (date) a.push(['date', date]);
    const created = str(d, 'CreationDate'); if (created) a.push(['creationdate', created]);
    const f = num(d.get(PDFName.of('F')) ?? 0);
    const flags = FLAGS.filter(([bit]) => f & bit).map(([, s]) => s).join(','); if (flags) a.push(['flags', flags]);
    const color = colorOf(nums(d, 'C')); if (color) a.push(['color', color]);
    const ic = colorOf(nums(d, 'IC')); if (ic) a.push(['interior-color', ic]);
    const ca = d.get(PDFName.of('CA')); if (ca !== undefined) a.push(['opacity', fmt(num(ca))]);
    const bs = d.lookupMaybe(PDFName.of('BS'), PDFDict); if (bs?.get(PDFName.of('W')) !== undefined) a.push(['width', fmt(num(bs.get(PDFName.of('W'))))]);
    if (kind === 'text' || kind === 'stamp') { const icon = nameOf(d, 'Name'); if (icon) a.push(['icon', icon]); }
    const irt = d.get(PDFName.of('IRT'));
    if (irt instanceof PDFRef && names.has(irt.toString())) {
      a.push(['inreplyto', names.get(irt.toString())!]);
      if (nameOf(d, 'RT') === 'Group') a.push(['replyType', 'group']);
    }
    const state = str(d, 'State') || nameOf(d, 'State'); if (state) a.push(['state', state]);
    const model = str(d, 'StateModel') || nameOf(d, 'StateModel'); if (model) a.push(['statemodel', model]);
    const qp = nums(d, 'QuadPoints'); if (qp && ['highlight', 'underline', 'strikeout', 'squiggly'].includes(kind)) a.push(['coords', qp.map(fmt).join(',')]);
    const l = nums(d, 'L'); if (kind === 'line' && l && l.length === 4) { a.push(['start', `${fmt(l[0])},${fmt(l[1])}`]); a.push(['end', `${fmt(l[2])},${fmt(l[3])}`]); }
    const le = d.lookupMaybe(PDFName.of('LE'), PDFArray); if (le) { const [h, t] = le.asArray().map((x) => (x instanceof PDFName ? x.decodeText() : '')); if (h) a.push(['head', h]); if (t) a.push(['tail', t]); }
    const body: string[] = [];
    const contents = str(d, 'Contents'); if (contents) body.push(`<contents>${esc(contents)}</contents>`);
    const da = str(d, 'DA'); if (kind === 'freetext' && da) body.push(`<defaultappearance>${esc(da)}</defaultappearance>`);
    const vs = nums(d, 'Vertices'); if (vs && (kind === 'polygon' || kind === 'polyline')) body.push(`<vertices>${pairs(vs)}</vertices>`);
    const ink = d.lookupMaybe(PDFName.of('InkList'), PDFArray);
    if (kind === 'ink' && ink) body.push(`<inklist>${ink.asArray().map((g) => { const arr = g instanceof PDFArray ? g : doc.context.lookupMaybe(g as PDFRef, PDFArray); return arr ? `<gesture>${pairs(arr.asArray().map(num))}</gesture>` : ''; }).join('')}</inklist>`);
    out.push(`<${kind} ${a.map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}${body.length ? `>${body.join('')}</${kind}>` : '/>'}`);
  }
  out.push('</annots>');
  if (fileName) out.push(`<f href="${esc(fileName)}"/>`);
  out.push('</xfdf>', '');
  return { xml: out.join('\n'), count: list.length };
}

const pairs = (v: number[]) => { const o: string[] = []; for (let i = 0; i + 1 < v.length; i += 2) o.push(`${fmt(v[i])},${fmt(v[i + 1])}`); return o.join(';'); };

// ---------- XFDF → PDF ----------

export const listNums = (s: string | undefined): number[] => (s ?? '').split(/[,; ]+/).filter(Boolean).map(Number).filter(Number.isFinite);
export const parseColor = (s: string | undefined): number[] | null => {
  if (!s || s[0] !== '#' || (s.length !== 7 && s.length !== 4)) return null;
  const h = s.length === 4 ? s.slice(1).split('').map((c) => c + c).join('') : s.slice(1);
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return v.every(Number.isFinite) ? v.map((x) => Math.round(x * 1000) / 1000) : null;
};

export interface ImportResult { bytes: Uint8Array; added: number; skipped: number; already: number }

/** Pune comentariile din XFDF peste PDF. Cele care există deja (același /NM pe aceeași pagină) nu se dublează. */
export async function importXfdf(bytes: Uint8Array, xml: string): Promise<ImportResult> {
  const root = parseXml(xml);
  const xfdf = root.kids.find((k) => local(k.name) === 'xfdf');
  const annots = xfdf && find(xfdf, 'annots');
  if (!xfdf) throw new Error('Fișierul nu e XFDF (comentarii PDF exportate din Cyber Office Studio sau din alt program).');
  const doc = await open(bytes);
  const ctx = doc.context;
  const pages = doc.getPages();
  // Comentariile care sunt deja în PDF: după nume (/NM) și, pentru cele fără nume, după pagină, tip, loc, text și stare.
  const byName = new Map<string, PDFRef>();
  const bySig = new Map<string, PDFRef>();
  const sig = (page: number, subtype: string, rect: number[], contents: string, state: string) =>
    [page, subtype, rect.map((x) => Math.round(x)).join(','), contents.trim(), state].join('|');
  pages.forEach((p, i) => p.node.lookupMaybe(PDFName.of('Annots'), PDFArray)?.asArray().forEach((r) => {
    if (!(r instanceof PDFRef)) return;
    const d = ctx.lookupMaybe(r, PDFDict);
    if (!d) return;
    const nm = str(d, 'NM');
    if (nm) byName.set(nm, r);
    bySig.set(sig(i, nameOf(d, 'Subtype'), nums(d, 'Rect') ?? [], str(d, 'Contents'), str(d, 'State') || nameOf(d, 'State')), r);
  }));
  let added = 0, skipped = 0, already = 0;
  const replies: { d: PDFDict; to: string; group: boolean }[] = [];
  for (const el of annots?.kids ?? []) {
    const kind = local(el.name);
    const subtype = fromXml.get(kind);
    const at = el.attrs;
    const page = Number(at.page);
    const rect = listNums(at.rect);
    if (!subtype || !Number.isInteger(page) || page < 0 || page >= pages.length || rect.length !== 4) { skipped++; continue; }
    const contents = find(el, 'contents') ?? find(el, 'contents-richtext');
    const text = contents ? textOf(contents).trim() : '';
    const same = (at.name && byName.get(at.name)) || bySig.get(sig(page, subtype, rect, text, at.state ?? ''));
    if (same) { if (at.name) byName.set(at.name, same); already++; continue; }
    const d = ctx.obj({ Type: 'Annot', Subtype: subtype, Rect: rect, P: pages[page].ref }) as PDFDict;
    const set = (k: string, v: unknown) => d.set(PDFName.of(k), ctx.obj(v as never));
    if (at.name) d.set(PDFName.of('NM'), PDFHexString.fromText(at.name));
    if (at.title) d.set(PDFName.of('T'), PDFHexString.fromText(at.title));
    if (at.subject) d.set(PDFName.of('Subj'), PDFHexString.fromText(at.subject));
    if (at.date) d.set(PDFName.of('M'), PDFString.of(at.date));
    if (at.creationdate) d.set(PDFName.of('CreationDate'), PDFString.of(at.creationdate));
    const flags = (at.flags ?? 'print').toLowerCase().split(/[, ]+/);
    set('F', FLAGS.filter(([, s]) => flags.includes(s)).reduce((acc, [bit]) => acc | bit, 0));
    const c = parseColor(at.color); if (c) set('C', c);
    const ic = parseColor(at['interior-color']); if (ic) set('IC', ic);
    if (at.opacity && Number.isFinite(Number(at.opacity))) set('CA', Number(at.opacity));
    if (at.width && Number.isFinite(Number(at.width))) set('BS', { W: Number(at.width) });
    if (at.icon && (kind === 'text' || kind === 'stamp')) set('Name', PDFName.of(at.icon));
    if (at.state) d.set(PDFName.of('State'), PDFString.of(at.state));
    if (at.statemodel) d.set(PDFName.of('StateModel'), PDFString.of(at.statemodel));
    const qp = listNums(at.coords); if (qp.length >= 8) set('QuadPoints', qp);
    if (kind === 'line') {
      const l = [...listNums(at.start), ...listNums(at.end)];
      set('L', l.length === 4 ? l : rect);
      if (at.head || at.tail) set('LE', [PDFName.of(at.head || 'None'), PDFName.of(at.tail || 'None')]);
    }
    if (contents) d.set(PDFName.of('Contents'), PDFHexString.fromText(text));
    const da = find(el, 'defaultappearance'); if (da) d.set(PDFName.of('DA'), PDFString.of(textOf(da).trim()));
    else if (kind === 'freetext') d.set(PDFName.of('DA'), PDFString.of('0 0 0 rg /Helv 12 Tf'));
    const vs = find(el, 'vertices'); if (vs) set('Vertices', listNums(textOf(vs)));
    const ink = find(el, 'inklist');
    if (ink) set('InkList', ink.kids.filter((g) => local(g.name) === 'gesture').map((g) => listNums(textOf(g))));
    if (at.inreplyto) replies.push({ d, to: at.inreplyto, group: (at.replyType ?? at.replytype ?? '').toLowerCase() === 'group' });
    const ref = ctx.register(d);
    pages[page].node.addAnnot(ref);
    if (at.name) byName.set(at.name, ref);
    added++;
  }
  // Răspunsurile (și stările) se leagă la sfârșit, când toți părinții au primit obiect.
  for (const { d, to, group } of replies) {
    const parent = byName.get(to);
    if (!parent) continue;
    d.set(PDFName.of('IRT'), parent);
    d.set(PDFName.of('RT'), PDFName.of(group ? 'Group' : 'R'));
  }
  return { bytes: added ? await doc.save() : bytes, added, skipped, already };
}
