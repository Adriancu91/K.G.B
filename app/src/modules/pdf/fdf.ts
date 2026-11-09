// Original: src/pdf/fdf.ts din Cyber Office Studio, aplicația proprietarului (D-071, D-072), fără schimbări de logică.
// @ts-nocheck — K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine; testat în tests/.
// Comentariile în formatul .fdf (cel mai vechi, cu sintaxa PDF: %FDF-1.2, /FDF << /Annots [...] >>), pe lângă .xfdf.
// Scris de la zero, ca traducere între cele două: la export, XFDF-ul făcut de exportXfdf devine .fdf; la import, .fdf-ul
// devine XFDF și intră prin importXfdf (aceleași reguli: fără dubluri, răspunsuri legate la părinte, stări).
import { esc, find, FLAGS, KINDS, listNums, local, parseColor, parseXml, textOf } from './xfdf';
import { pdfString, PdfReader, type PV } from './formdata';

const toXml = new Map(KINDS);
const fromXml = new Map(KINDS.map(([a, b]) => [b, a]));
const NL = String.fromCharCode(10);
const fmt = (x: number) => String(Math.round(x * 1000) / 1000);
const arr = (v: number[]) => '[' + v.map(fmt).join(' ') + ']';
/** Un nume PDF: literele obișnuite rămân, restul ca #xx. */
const pdfName = (s: string) => '/' + [...new TextEncoder().encode(s)].map((b) => (b > 32 && b < 127 && !'()<>[]{}/%#'.includes(String.fromCharCode(b)) ? String.fromCharCode(b) : '#' + b.toString(16).padStart(2, '0').toUpperCase())).join('');

/** XFDF (cum îl scrie exportXfdf) → textul unui .fdf cu aceleași comentarii. */
export function xfdfToFdf(xml: string, fileName = ''): string {
  const root = parseXml(xml);
  const xfdf = root.kids.find((k) => local(k.name) === 'xfdf');
  const els = (xfdf && find(xfdf, 'annots'))?.kids.filter((k) => fromXml.has(local(k.name))) ?? [];
  // Obiectul 1 e rădăcina; comentariile primesc obiectele 2, 3, … (răspunsurile își arată părintele cu /IRT n 0 R).
  const objOf = new Map<string, number>();
  els.forEach((el, i) => { if (el.attrs.name) objOf.set(el.attrs.name, i + 2); });
  const objs = els.map((el) => {
    const kind = local(el.name);
    const at = el.attrs;
    const e: string[] = ['/Type /Annot', '/Subtype ' + pdfName(fromXml.get(kind)!)];
    const page = Number(at.page);
    if (Number.isInteger(page)) e.push('/Page ' + page);
    const rect = listNums(at.rect); if (rect.length === 4) e.push('/Rect ' + arr(rect));
    if (at.name) e.push('/NM ' + pdfString(at.name));
    if (at.title) e.push('/T ' + pdfString(at.title));
    if (at.subject) e.push('/Subj ' + pdfString(at.subject));
    if (at.date) e.push('/M ' + pdfString(at.date));
    if (at.creationdate) e.push('/CreationDate ' + pdfString(at.creationdate));
    const flags = (at.flags ?? 'print').toLowerCase().split(/[, ]+/);
    e.push('/F ' + FLAGS.filter(([, s]) => flags.includes(s)).reduce((acc, [bit]) => acc | bit, 0));
    const c = parseColor(at.color); if (c) e.push('/C ' + arr(c));
    const ic = parseColor(at['interior-color']); if (ic) e.push('/IC ' + arr(ic));
    if (at.opacity && Number.isFinite(Number(at.opacity))) e.push('/CA ' + fmt(Number(at.opacity)));
    if (at.width && Number.isFinite(Number(at.width))) e.push('/BS << /W ' + fmt(Number(at.width)) + ' >>');
    if (at.icon) e.push('/Name ' + pdfName(at.icon));
    if (at.state) e.push('/State ' + pdfString(at.state));
    if (at.statemodel) e.push('/StateModel ' + pdfString(at.statemodel));
    const qp = listNums(at.coords); if (qp.length >= 8) e.push('/QuadPoints ' + arr(qp));
    const l = [...listNums(at.start), ...listNums(at.end)]; if (kind === 'line' && l.length === 4) e.push('/L ' + arr(l));
    if (at.head || at.tail) e.push(`/LE [${pdfName(at.head || 'None')} ${pdfName(at.tail || 'None')}]`);
    const to = at.inreplyto && objOf.get(at.inreplyto);
    if (to) e.push(`/IRT ${to} 0 R`, '/RT ' + ((at.replyType ?? at.replytype ?? '').toLowerCase() === 'group' ? '/Group' : '/R'));
    const contents = find(el, 'contents') ?? find(el, 'contents-richtext'); if (contents) e.push('/Contents ' + pdfString(textOf(contents).trim()));
    const da = find(el, 'defaultappearance'); if (da) e.push('/DA ' + pdfString(textOf(da).trim()));
    const vs = find(el, 'vertices'); if (vs) e.push('/Vertices ' + arr(listNums(textOf(vs))));
    const ink = find(el, 'inklist');
    if (ink) e.push('/InkList [' + ink.kids.filter((g) => local(g.name) === 'gesture').map((g) => arr(listNums(textOf(g)))).join(' ') + ']');
    return '<< ' + e.join(' ') + ' >>';
  });
  const out = ['%FDF-1.2', '1 0 obj', `<< /FDF << /Annots [${objs.map((_, i) => `${i + 2} 0 R`).join(' ')}]${fileName ? ' /F ' + pdfString(fileName) : ''} >> >>`, 'endobj'];
  objs.forEach((o, i) => out.push(`${i + 2} 0 obj`, o, 'endobj'));
  out.push('trailer', '<< /Root 1 0 R >>', '%%EOF', '');
  return out.join(NL);
}

/** Textul unui .fdf (octeții lui) → XFDF, de dat la importXfdf. Fără /Annots: XFDF gol (niciun comentariu). */
export function fdfToXfdf(data: Uint8Array): string {
  let src = '';
  for (let i = 0; i < data.length; i += 8192) src += String.fromCharCode(...data.subarray(i, i + 8192));
  const lookup = (key: string, depth = 0): PV => {
    const [n, g] = key.split(' ');
    const m = new RegExp('(^|[^0-9])' + n + '[ ]+' + g + '[ ]+obj').exec(src);
    return m && depth < 8 ? resolve(new PdfReader(src, m.index + m[0].length).value(), depth + 1) : null;
  };
  const resolve = (v: PV | undefined, depth = 0): PV => (v && !Array.isArray(v) && !(v instanceof Map) && 'r' in v ? lookup(v.r, depth) : v ?? null);
  const text = (v: PV | undefined): string => { const x = resolve(v); return x && !Array.isArray(x) && !(x instanceof Map) ? ('s' in x ? x.s : 'n' in x ? x.n : '') : ''; };
  const nums = (v: PV | undefined): number[] => { const x = resolve(v); return Array.isArray(x) ? x.map((y) => Number(text(y))).filter(Number.isFinite) : []; };
  const hex2 = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  const color = (c: number[]) => (c.length === 3 ? '#' + c.map(hex2).join('') : c.length === 1 ? '#' + hex2(c[0]).repeat(3) : '');

  const at = src.indexOf('/FDF');
  const fdf = at < 0 ? null : resolve(new PdfReader(src, at + 4).value());
  const list = fdf instanceof Map ? resolve(fdf.get('Annots')) : null;
  // Comentariile, fiecare cu numele lui (/NM sau unul făcut din numărul obiectului, ca răspunsurile să-și găsească părintele).
  const items: { d: Map<string, PV>; name: string }[] = [];
  const nameByRef = new Map<string, string>();
  if (Array.isArray(list)) list.forEach((r, i) => {
    const d = resolve(r);
    if (!(d instanceof Map)) return;
    const ref = r && !Array.isArray(r) && !(r instanceof Map) && 'r' in r ? r.r : '';
    const name = text(d.get('NM')) || (ref ? 'fdf-' + ref.replace(' ', '-') : 'fdf-' + i);
    if (ref) nameByRef.set(ref, name);
    items.push({ d, name });
  });
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">', '<annots>'];
  for (const { d, name } of items) {
    const kind = toXml.get(text(d.get('Subtype')));
    if (!kind) continue;
    const a: [string, string][] = [['page', text(d.get('Page')) || '0']];
    const rect = nums(d.get('Rect')); if (rect.length === 4) a.push(['rect', rect.map(fmt).join(',')]);
    a.push(['name', name]);
    const add = (k: string, v: string) => { if (v) a.push([k, v]); };
    add('title', text(d.get('T')));
    add('subject', text(d.get('Subj')));
    add('date', text(d.get('M')));
    add('creationdate', text(d.get('CreationDate')));
    const f = Number(text(d.get('F')) || 0);
    a.push(['flags', FLAGS.filter(([bit]) => f & bit).map(([, s]) => s).join(',')]);
    add('color', color(nums(d.get('C'))));
    add('interior-color', color(nums(d.get('IC'))));
    if (d.has('CA')) add('opacity', text(d.get('CA')));
    const bs = resolve(d.get('BS')); if (bs instanceof Map && bs.has('W')) add('width', text(bs.get('W')));
    add('icon', text(d.get('Name')));
    add('state', text(d.get('State')));
    add('statemodel', text(d.get('StateModel')));
    const qp = nums(d.get('QuadPoints')); if (qp.length >= 8) a.push(['coords', qp.map(fmt).join(',')]);
    const l = nums(d.get('L')); if (kind === 'line' && l.length === 4) a.push(['start', `${fmt(l[0])},${fmt(l[1])}`], ['end', `${fmt(l[2])},${fmt(l[3])}`]);
    const le = resolve(d.get('LE')); if (Array.isArray(le)) { add('head', text(le[0])); add('tail', text(le[1])); }
    const irt = d.get('IRT');
    const parent = irt && !Array.isArray(irt) && !(irt instanceof Map) && 'r' in irt ? nameByRef.get(irt.r) : undefined;
    if (parent) { a.push(['inreplyto', parent]); if (text(d.get('RT')) === 'Group') a.push(['replyType', 'group']); }
    const pairs = (v: number[]) => { const o: string[] = []; for (let i = 0; i + 1 < v.length; i += 2) o.push(`${fmt(v[i])},${fmt(v[i + 1])}`); return o.join(';'); };
    const body: string[] = [];
    if (d.has('Contents')) body.push(`<contents>${esc(text(d.get('Contents')))}</contents>`);
    if (d.has('DA')) body.push(`<defaultappearance>${esc(text(d.get('DA')))}</defaultappearance>`);
    const vs = nums(d.get('Vertices')); if (vs.length) body.push(`<vertices>${pairs(vs)}</vertices>`);
    const ink = resolve(d.get('InkList'));
    if (Array.isArray(ink)) body.push(`<inklist>${ink.map((g) => `<gesture>${pairs(nums(g))}</gesture>`).join('')}</inklist>`);
    out.push(`<${kind} ${a.map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}${body.length ? `>${body.join('')}</${kind}>` : '/>'}`);
  }
  out.push('</annots>', '</xfdf>', '');
  return out.join(NL);
}
