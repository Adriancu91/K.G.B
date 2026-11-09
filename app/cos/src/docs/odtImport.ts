// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import .odt (OpenDocument, documentele din LibreOffice / OpenOffice), plus varianta „plată” .fodt.
// Documentul devine HTML pentru editor, la fel ca la importul .docx: titluri, paragrafe, liste, tabele (cu celule îmbinate),
// poze, aldin/cursiv/subliniat/tăiat, culori, evidențiere, fonturi, mărimi și aliniere. Notele de subsol se pun la final.
import { parseRowHeight } from './tableRowHeight';
import { metafileToUrl } from '../metafile';
import { mathmlToEquation } from '../mathml';
import { equationAlt, equationToPng } from './equation';
import { odfFieldKind } from './field';
import { effectCss, effectOf, proofLangOf, type TextEffect } from './letterFormat';
import { attr, deep, el, els, isEl, OdfFile, odfLength, openOdf, styleRoots } from '../odf';
import { normalizeHref } from './link';
import { lineNums as lineNumsOf, type LineNums, type PageSetup, docProps, marginsFrom, paperFrom, type DocProps, type Margins, type Paper } from './format';
import { decorationCss } from './underlineStyle';

const BAD = 'Fișierul nu este un document OpenDocument (.odt) valid sau e stricat.';
/** Pozele din document se pun în editor ca date; peste această mărime totală le sărim, ca editorul să rămână ușor. */
const MAX_IMAGES_BYTES = 30 * 1024 * 1024;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Textul simplu dintr-o bucată de HTML făcută aici (fără etichete, cu caracterele speciale înapoi). */
// O notă pusă în altă notă (Word nu are așa ceva) rămâne în text, în paranteză.
const plainText = (html: string) => html.replace(/<sup data-footnote="([^"]*)"><[/]sup>/g, ' ($1)').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const color = (v: string | null) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);

interface TextLook { lang?: string; b?: boolean; i?: boolean; u?: boolean; uCss?: string; s?: boolean; sup?: boolean; sub?: boolean; color?: string; mark?: string; font?: string; size?: string; caps?: string; upper?: boolean; spacing?: string; fx?: TextEffect | null }
interface ParaLook { pageBefore?: boolean; pageAfter?: boolean; pstyle?: string; align?: string; heading?: number; indent?: number; right?: number; lh?: string; box?: boolean; boxLook?: string; shade?: string; dropCap?: boolean; keepNext?: boolean; keepLines?: boolean; noWidow?: boolean; tabs?: string; before?: number; after?: number; first?: number }
interface StyleDef { family: string; parent?: string; text: TextLook; para: ParaLook }

function readStyles(roots: Element[]) {
  const defs: Record<string, StyleDef> = {};
  const lists: Record<string, boolean[]> = {}; // pe niveluri: numerotată sau cu buline
  const cellBg: Record<string, string> = {}; // culoarea de fundal a stilurilor de celulă de tabel
  const cellBorder = new Set<string>(); // stilurile de celulă care au chenar
  const rowHeight: Record<string, string> = {}; // înălțimea (minimă) a stilurilor de rând de tabel
  const rowKeep = new Set<string>(); // stilurile de rând care nu se rup între pagini (fo:keep-together)
  const tableIndent: Record<string, number> = {}; // indentarea (cm) a stilurilor de tabel așezate la stânga
  const cellPad: Record<string, number> = {}; // marginile (cm) stilurilor de celulă
  const cellVA: Record<string, string> = {}; // alinierea verticală a stilurilor de celulă (middle / bottom)
  const tableAlign: Record<string, string> = {}; // așezarea tabelelor pe pagină (center / right)
  for (const root of roots) {
    for (const s of els(root)) {
      const name = attr(s, 'name');
      if (!name) continue;
      if (s.localName === 'list-style') {
        lists[name] = els(s).map((lv) => lv.localName === 'list-level-style-number');
        continue;
      }
      if (s.localName !== 'style') continue;
      if (attr(s, 'family') === 'table') {
        const tp = el(s, 'table-properties');
        const a = tp ? attr(tp, 'align') : undefined;
        if (a === 'center' || a === 'right') tableAlign[name] = a;
        else { const ml = parseRowHeight(tp ? attr(tp, 'margin-left') : undefined); if (ml) tableIndent[name] = ml; }
        continue;
      }
      if (attr(s, 'family') === 'table-row') {
        const rp = el(s, 'table-row-properties');
        const h = rp && attr(rp, 'use-optimal-row-height') !== 'true' ? attr(rp, 'min-row-height') ?? attr(rp, 'row-height') : undefined;
        if (h) rowHeight[name] = h;
        if (rp && attr(rp, 'keep-together') === 'always') rowKeep.add(name);
        continue;
      }
      if (attr(s, 'family') === 'table-cell') {
        const cp = el(s, 'table-cell-properties') ?? s;
        const bg = color(attr(cp, 'background-color'));
        if (bg && bg !== '#ffffff') cellBg[name] = bg;
        const va = attr(cp, 'vertical-align');
        if (va === 'middle' || va === 'bottom') cellVA[name] = va;
        // Marginile celulei (fo:padding sau fo:padding-left), în cm.
        const pd = attr(cp, 'padding') ?? attr(cp, 'padding-left');
        if (pd) { const v = /^0+(?:[.]0+)?[a-z]*$/.test(pd.trim()) ? 0 : parseRowHeight(pd); if (v !== null) cellPad[name] = v; }
        if (['border', 'border-top', 'border-bottom', 'border-left', 'border-right'].some((k) => { const v = attr(cp, k); return !!v && v !== 'none' && !/^0(\.0+)?[a-z]*(\s|$)/.test(v); })) cellBorder.add(name);
        continue;
      }
      const text: TextLook = {};
      const t = el(s, 'text-properties');
      if (t) {
        const w = attr(t, 'font-weight');
        if (w === 'bold' || Number(w) >= 600) text.b = true;
        else if (w === 'normal') text.b = false;
        const st = attr(t, 'font-style');
        if (st === 'italic' || st === 'oblique') text.i = true;
        else if (st === 'normal') text.i = false;
        const u = attr(t, 'text-underline-style');
        if (u) text.u = u !== 'none';
        if (u && u !== 'none') {
          // Stilul și culoarea sublinierii, ca CSS pe <u> (dublă, groasă, punctată, cu liniuțe, ondulată).
          const uc = attr(t, 'text-underline-color');
          const st = attr(t, 'text-underline-type') === 'double' ? 'double' : u === 'wave' ? 'wavy' : u === 'dotted' ? 'dotted' : /dash/.test(u) ? 'dashed'
            : /bold|thick/.test(attr(t, 'text-underline-width') ?? '') ? 'thick' : 'single';
          text.uCss = decorationCss(st, uc && /^#[0-9a-f]{6}$/i.test(uc) ? uc : null);
        }
        const lt = attr(t, 'text-line-through-style');
        if (lt) text.s = lt !== 'none';
        const c = color(attr(t, 'color'));
        if (c) text.color = c;
        const bg = color(attr(t, 'background-color'));
        if (bg && bg !== '#ffffff') text.mark = bg;
        const font = attr(t, 'font-name') ?? attr(t, 'font-family');
        if (font) text.font = font.replace(/['"]/g, '');
        // Exponent / indice: „super 58%” sau „33% 58%” (în sus), „sub 58%” sau „-33% 58%” (în jos).
        const tp = attr(t, 'text-position');
        if (tp) {
          const first = tp.trim().split(' ')[0];
          const v = parseFloat(first);
          text.sup = first === 'super' || v > 0;
          text.sub = first === 'sub' || v < 0;
        }
        const size = attr(t, 'font-size');
        if (size && /^[\d.]+pt$/.test(size)) text.size = size;
        // Majuscule mici, MAJUSCULE afișate și spațierea literelor (fo:letter-spacing="0.035cm").
        if (attr(t, 'font-variant') === 'small-caps') text.caps = 'small-caps';
        if (attr(t, 'text-transform') === 'uppercase') text.upper = true;
        const lsp = attr(t, 'letter-spacing');
        const lpx = lsp && lsp !== 'normal' ? odfLength(lsp) : null;
        if (lpx) text.spacing = `${Math.round(lpx * 0.75 * 100) / 100}pt`;
        // Efectele: style:text-outline, fo:text-shadow, style:font-relief.
        const sh = attr(t, 'text-shadow'), rel = attr(t, 'font-relief');
        const fx = effectOf({ outline: attr(t, 'text-outline') === 'true', shadow: !!sh && sh !== 'none', emboss: rel === 'embossed', imprint: rel === 'engraved' });
        if (fx) text.fx = fx;
        // Limba (fo:language + fo:country); „zxx” = fără limbă, deci nu se verifică ortografia.
        const lg = attr(t, 'language');
        if (lg) { const c = attr(t, 'country'); text.lang = lg === 'zxx' ? 'none' : proofLangOf(c && c !== 'none' ? `${lg}-${c}` : lg) ?? undefined; }
      }
      const para: ParaLook = {};
      const p = el(s, 'paragraph-properties');
      const al = p ? attr(p, 'text-align') : null;
      if (al === 'center') para.align = 'center';
      else if (al === 'end' || al === 'right') para.align = 'right';
      else if (al === 'justify') para.align = 'justify';
      else if (al === 'start' || al === 'left') para.align = 'left';
      // Retragerea de la stânga (în trepte de 1,25 cm = 47,24 px) și spațierea rândurilor în procente (150% = 1,5 rânduri).
      const ml = p ? odfLength(attr(p, 'margin-left')) : null;
      // Spațiul înainte / după (px → pt) și prima linie (fo:text-indent, px → cm; negativ = agățată).
      const ti = p ? odfLength(attr(p, 'text-indent')) : null;
      if (ti) para.first = Math.max(-10, Math.min(10, Math.round((ti / 37.795) * 100) / 100));
      if (ml !== null) para.indent = Math.min(8, Math.max(0, Math.round(((ml + Math.min(0, ti ?? 0)) / 47.24) * 100) / 100));
      const mr = p ? odfLength(attr(p, 'margin-right')) : null;
      if (mr) para.right = Math.min(15, Math.max(0, Math.round((mr / 37.795) * 100) / 100));
      // Ruperile de pagină (fo:break-before / fo:break-after="page") devin „Pagină nouă” în editor.
      if (p && attr(p, 'break-before') === 'page') para.pageBefore = true;
      if (p && attr(p, 'break-after') === 'page') para.pageAfter = true;
      const mt = p ? odfLength(attr(p, 'margin-top')) : null;
      const mb = p ? odfLength(attr(p, 'margin-bottom')) : null;
      if (mt !== null && mt >= 0) para.before = Math.round(mt * 0.75 * 2) / 2; // la jumătate de punct (ODF scrie în cm)
      if (mb !== null && mb >= 0) para.after = Math.round(mb * 0.75 * 2) / 2;
      const lh = p ? attr(p, 'line-height') : null;
      if (lh && lh.endsWith('%')) {
        const v = parseFloat(lh) / 100;
        if (v >= 0.8 && v <= 3) para.lh = String(Math.round(v * 100) / 100);
      }
      // Chenarul (fo:border="0.5pt solid #000000" sau pe laturi) și fundalul paragrafului.
      if (p && ['border', 'border-top', 'border-bottom', 'border-left', 'border-right'].some((k) => { const v = attr(p, k); return !!v && v !== 'none'; })) {
        para.box = true;
        // Laturile, linia și culoarea chenarului („0.5pt solid #000000”), ca „laturi-linie-culoare”.
        const on = (k: string) => { const v = attr(p, 'border-' + k) ?? attr(p, 'border'); return v && v !== 'none' ? v : null; };
        const [t, b, l, r] = ['top', 'bottom', 'left', 'right'].map(on);
        const sides = t && b && l && r ? 'all' : t && b && !l && !r ? 'tb' : t && !b && !l && !r ? 'top' : b && !t && !l && !r ? 'bottom' : l && !t && !b && !r ? 'left' : 'all';
        const one = t ?? b ?? l ?? r ?? '';
        const wpt = parseFloat(one) * (/mm/.test(one) ? 2.835 : /cm/.test(one) ? 28.35 : /in/.test(one) ? 72 : 1);
        const line = /double/.test(one) ? 'double' : /dashed/.test(one) ? 'dashed' : /dotted/.test(one) ? 'dotted' : wpt >= 1.2 && sides !== 'left' ? 'thick' : 'single';
        const c = (/#([0-9a-f]{6})/i.exec(one)?.[1] ?? '000000').toLowerCase();
        const look = `${sides}-${line}-${c}`;
        if (look !== 'all-single-6b6b80') para.boxLook = look;
      }
      const pbg = p ? color(attr(p, 'background-color')) : null;
      if (pbg && pbg !== '#ffffff') para.shade = pbg;
      // Letrina: <style:drop-cap style:lines="3"/> în proprietățile paragrafului.
      const dc = p ? el(p, 'drop-cap') : undefined;
      if (dc && Number(attr(dc, 'lines') ?? 0) > 1) para.dropCap = true;
      if (p && attr(p, 'keep-with-next') === 'always') para.keepNext = true;
      if (p && attr(p, 'keep-together') === 'always') para.keepLines = true;
      if (p && attr(p, 'widows') === '1' && attr(p, 'orphans') === '1') para.noWidow = true;
      // Opririle de tabulator (style:tab-stops): în fișier sunt de la retragerea paragrafului, la noi de la margine.
      const ts = p ? el(p, 'tab-stops') : undefined;
      if (ts) {
        const TYPE: Record<string, string> = { left: 'l', start: 'l', center: 'c', right: 'r', end: 'r', char: 'd' };
        const LEAD: Record<string, string> = { dotted: '.', dash: '-', 'long-dash': '-', solid: '_' };
        const stops: string[] = [];
        for (const t of Array.from(ts.children)) {
          if (t.localName !== 'tab-stop') continue;
          const px = odfLength(attr(t, 'position'));
          if (px === null) continue;
          const lt = attr(t, 'leader-text');
          const lead = lt === '.' || lt === '-' || lt === '_' ? lt : LEAD[attr(t, 'leader-style') ?? ''] ?? '';
          stops.push(`${Math.round(((px + (ml ?? 0)) / 37.795) * 100) / 100}${TYPE[attr(t, 'type') ?? 'left'] ?? 'l'}${lead}`);
        }
        if (stops.length) para.tabs = stops.join(' ');
      }
      // Stilurile „Title” / „Subtitle” din LibreOffice devin Titlu document / Subtitlu.
      if (name === 'Title' || name === 'Subtitle') para.pstyle = name.toLowerCase();
      if (name === 'Caption' || name === 'Figure' || name === 'Table' || name === 'Illustration' || name === 'Drawing') para.pstyle = 'caption';
      const lvl = attr(s, 'default-outline-level');
      if (lvl) para.heading = Number(lvl);
      defs[name] = { family: attr(s, 'family') ?? '', parent: attr(s, 'parent-style-name') ?? undefined, text, para };
    }
  }
  const cache: Record<string, { text: TextLook; para: ParaLook }> = {};
  const get = (name: string | null, depth = 0): { text: TextLook; para: ParaLook } => {
    if (!name) return { text: {}, para: {} };
    if (cache[name]) return cache[name];
    const d = defs[name];
    if (!d) return { text: {}, para: {} };
    const up = d.parent && depth < 12 ? get(d.parent, depth + 1) : { text: {}, para: {} };
    const r = { text: { ...up.text, ...d.text }, para: { ...up.para, ...d.para } };
    cache[name] = r;
    return r;
  };
  return { get, lists, cellBg, cellBorder, rowHeight, rowKeep, cellVA, tableAlign, tableIndent, cellPad };
}

/** Deschide etichetele pentru un aspect de text (diferența față de cel din jur) și le întoarce cu închiderile lor. */
function wrap(inner: string, look: TextLook, around: TextLook): string {
  if (!inner) return inner;
  let open = '', close = '';
  const css: string[] = [];
  if (look.font && look.font !== around.font) css.push(`font-family: ${esc(look.font)}`);
  if (look.size && look.size !== around.size) css.push(`font-size: ${look.size}`);
  if (look.color && look.color !== around.color && look.color !== '#000000') css.push(`color: ${look.color}`);
  if (look.caps && look.caps !== around.caps) css.push(`font-variant: ${look.caps}`);
  if (look.upper && !around.upper) css.push('text-transform: uppercase');
  if (look.spacing && look.spacing !== around.spacing) css.push(`letter-spacing: ${look.spacing}`);
  if (look.fx && look.fx !== around.fx) css.push(effectCss(look.fx));
  if (look.lang && look.lang !== around.lang && !/^ro(?:-RO)?$/.test(look.lang)) css.push(`--proof-lang: ${look.lang}`);
  if (css.length) { open += `<span style="${css.join('; ')}">`; close = '</span>' + close; }
  if (look.mark && look.mark !== around.mark) { open += `<mark data-color="${look.mark}" style="background-color: ${look.mark}">`; close = '</mark>' + close; }
  if (look.b && !around.b) { open += '<strong>'; close = '</strong>' + close; }
  if (look.i && !around.i) { open += '<em>'; close = '</em>' + close; }
  if (look.u && !around.u) { open += look.uCss ? `<u style="${look.uCss}">` : '<u>'; close = '</u>' + close; }
  if (look.s && !around.s) { open += '<s>'; close = '</s>' + close; }
  if (look.sup && !around.sup) { open += '<sup>'; close = '</sup>' + close; }
  else if (look.sub && !around.sub) { open += '<sub>'; close = '</sub>' + close; }
  return open + inner + close;
}

type OdtLayout = { props?: DocProps; landscape: boolean; margin: number; margins?: Margins; paper?: Paper; columns?: number; colLine?: boolean; lineNums?: LineNums; watermark?: string; background?: string };

/**
 * Filigranul pus din LibreOffice (Format → Filigran): o formă „fontwork” în antetul paginii,
 * cu numele PowerPlusWaterMarkObject…; textul ei e filigranul.
 */
function readWatermark(master: Element | undefined): string | undefined {
  if (!master) return undefined;
  for (const shape of [...master.getElementsByTagNameNS('*', 'custom-shape')]) {
    const geo = el(shape, 'enhanced-geometry');
    const named = /^PowerPlusWaterMarkObject/i.test(attr(shape, 'name') ?? '');
    if (!named && !(geo && attr(geo, 'text-path') === 'true' && /fontwork/.test(attr(geo, 'type') ?? ''))) continue;
    const text = els(shape, 'p').map((p) => p.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (text) return text;
  }
  return undefined;
}

/** Pagina documentului (din stilul paginii principale): orientarea, marginile în mm, coloanele și filigranul. */
/** Proprietățile documentului din meta.xml (sau din office:meta, în varianta plată): titlu, subiect, autor, cuvinte cheie. */
async function readMeta(file: OdfFile): Promise<DocProps | undefined> {
  // Doar office:meta de sub rădăcină (în text mai există text:meta, cu alt rost).
  let meta = el(file.content.documentElement, 'meta');
  const xml = await file.zip?.file('meta.xml')?.async('string');
  if (xml) meta = el(new DOMParser().parseFromString(xml, 'application/xml').documentElement, 'meta');
  if (!meta) return undefined;
  const text = (name: string) => els(meta!, name).map((e) => (e.textContent ?? '').trim()).filter(Boolean);
  return docProps({ props: {
    title: text('title')[0], subject: text('subject')[0],
    author: text('initial-creator')[0] ?? text('creator')[0],
    keywords: text('keyword').join(', '),
    label: els(meta, 'user-defined').find((e) => attr(e, 'name') === 'Clasificare')?.textContent,
  } });
}

function readLayout(file: OdfFile): OdtLayout | undefined {
  const root = file.styles ?? file.content;
  const masters = els(deep(root, 'master-styles') ?? root, 'master-page');
  const master = masters.find((m) => attr(m, 'name') === 'Standard') ?? masters[0];
  const watermark = readWatermark(master);
  const page = readPage(file, master);
  // Numerele rândurilor: <text:linenumbering-configuration text:number-lines="true" text:increment="5" text:restart-on-page="true"/>.
  const lnc = deep(root, 'linenumbering-configuration');
  const ln = lnc && attr(lnc, 'number-lines') !== 'false'
    ? lineNumsOf({ lineNums: { page: attr(lnc, 'restart-on-page') === 'true', by: Number(attr(lnc, 'increment')) || 1 } } as PageSetup) : undefined;
  const withLn = ln ? { ...(page ?? { landscape: false, margin: 20 }), lineNums: ln } : page;
  return watermark ? { ...(withLn ?? { landscape: false, margin: 20 }), watermark } : withLn;
}

function readPage(file: OdfFile, master: Element | undefined): OdtLayout | undefined {
  const name = master ? attr(master, 'page-layout-name') : null;
  if (!name) return undefined;
  const layout = styleRoots(file).flatMap((r) => els(r, 'page-layout')).find((l) => attr(l, 'name') === name);
  const props = el(layout, 'page-layout-properties');
  if (!props) return undefined;
  const w = odfLength(attr(props, 'page-width')) ?? 0, h = odfLength(attr(props, 'page-height')) ?? 0;
  const landscape = attr(props, 'print-orientation') === 'landscape' || (w > 0 && h > 0 && w > h);
  // Marginile în px → mm; dacă sunt diferite pe laturi, se păstrează fiecare.
  const mm = (k: string) => { const v = odfLength(attr(props, k)); return v !== null && v > 0 ? (v * 25.4) / 96 : 20; };
  const { margin, margins } = marginsFrom({ top: mm('margin-top'), bottom: mm('margin-bottom'), left: mm('margin-left'), right: mm('margin-right') });
  const cols = Number(attr(el(props, 'columns') ?? props, 'column-count'));
  // Culoarea paginii (Format → Pagină → Zonă → Culoare).
  const bg = color(attr(props, 'background-color'));
  const background = bg && bg !== '#ffffff' ? bg : undefined;
  const paper = w > 0 && h > 0 ? paperFrom((w * 25.4) / 96, (h * 25.4) / 96) : 'A4';
  return { landscape, margin, ...(paper !== 'A4' ? { paper } : {}), ...(margins ? { margins } : {}), ...(cols >= 2 ? { columns: Math.min(3, cols), ...(el(el(props, 'columns') ?? props, 'column-sep') && attr(el(el(props, 'columns') ?? props, 'column-sep')!, 'style') !== 'none' ? { colLine: true } : {}) } : {}), ...(background ? { background } : {}) };
}

export async function odtToHtml(data: Uint8Array): Promise<{ html: string; warnings: number; comments: never[]; changes: never[]; simplified?: boolean; repaired?: boolean; layout?: OdtLayout }> {
  const file: OdfFile = await openOdf(data, BAD);
  const body = el(deep(file.content, 'body'), 'text');
  if (!body) throw new Error(BAD);
  const { get, lists, cellBg, cellBorder, rowHeight, rowKeep, cellVA, tableAlign, tableIndent, cellPad } = readStyles(styleRoots(file));
  let warnings = 0;
  let imageBytes = 0;
  const notes: string[] = [];
  const pictures = new Map<string, string>();

  // Pozele din arhivă (Pictures/…) sau scrise direct în XML (office:binary-data), ca adrese data:.
  // Formula (obiect cu MathML: „Object 1/content.xml”, sau chiar în cadru la .fodt): devine ecuație Suite, desenată din text,
  // care se poate schimba (dublu clic / ✎ Ecuație). Dacă nu se poate desena, rămâne poza de previzualizare.
  const formula = async (frame: Element): Promise<string | null> => {
    const obj = el(frame, 'object');
    if (!obj) return null;
    let math: Element | Document | undefined = deep(obj, 'math');
    if (!math) {
      const href = (attr(obj, 'href') ?? '').replace(/^\.\//, '').replace(/\/$/, '');
      const f = file.zip && href && !/^[a-z]+:/i.test(href) ? file.zip.file(`${href}/content.xml`) : null;
      const doc = f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null;
      if (doc?.documentElement?.localName === 'math') math = doc;
    }
    const src = math ? mathmlToEquation(math) : null;
    if (!src) return null;
    try {
      const res = await equationToPng({ src });
      return `<img src="${res.src}" width="${Math.round(res.w)}" alt="${esc(equationAlt({ src }))}" data-equation="${esc(JSON.stringify({ src }))}">`;
    } catch { return null; }
  };

  const picture = async (frame: Element): Promise<string> => {
    const eq = await formula(frame);
    if (eq) return eq;
    const img = deep(frame, 'image');
    if (!img) { warnings++; return ''; } // obiecte, grafice, casete de text desenate
    const w = odfLength(attr(frame, 'width'));
    const size = w && w > 0 ? `width="${Math.round(w)}"` : '';
    let src = '';
    const href = attr(img, 'href');
    const bin = el(img, 'binary-data');
    if (bin) src = `data:image/png;base64,${bin.textContent?.replace(/\s+/g, '') ?? ''}`;
    else if (href && file.zip && !/^[a-z]+:/i.test(href)) {
      if (pictures.has(href)) src = pictures.get(href)!;
      else {
        const f = file.zip.file(href.replace(/^\.\//, ''));
        const bytes = f ? await f.async('uint8array') : null;
        const ext = href.split('.').pop()!.toLowerCase();
        const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' }[ext];
        // Desenele .wmf / .emf (și înlocuitorii obiectelor, fără extensie, des în acest format) devin PNG.
        const meta = bytes && !mime && imageBytes + bytes.length <= MAX_IMAGES_BYTES ? await metafileToUrl(bytes) : null;
        if (meta) { imageBytes += bytes!.length; src = meta; pictures.set(href, src); }
        else if (bytes && mime && imageBytes + bytes.length <= MAX_IMAGES_BYTES) {
          imageBytes += bytes.length;
          let s = '';
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          src = `data:${mime};base64,${btoa(s)}`;
          pictures.set(href, src);
        }
      }
    }
    if (!src) { warnings++; return ''; }
    // Textul alternativ: descrierea (svg:desc) sau titlul (svg:title) cadrului, altfel numele lui.
    const alt = el(frame, 'desc')?.textContent?.trim() || el(frame, 'title')?.textContent?.trim() || attr(frame, 'name') || '';
    return `<img src="${src}" ${size} alt="${esc(alt.slice(0, 1000))}">`;
  };

  /** Conținutul dintr-un paragraf: text, spații, rânduri noi, stiluri pe bucăți, note de subsol, poze. */
  const inline = async (n: Element, around: TextLook, imgs: string[]): Promise<string> => {
    let out = '';
    for (const k of n.childNodes) {
      if (k.nodeType === 3 || k.nodeType === 4) { out += esc((k as CharacterData).data); continue; }
      if (!isEl(k)) continue;
      switch (k.localName) {
        case 's': out += ' '.repeat(Math.min(200, Number(attr(k, 'c') ?? 1) || 1)); break;
        case 'tab': out += '<span data-tab=""></span>'; break;
        case 'line-break': out += '<br>'; break;
        case 'span': {
          const look = { ...around, ...get(attr(k, 'style-name')).text };
          out += wrap(await inline(k, look, imgs), look, around);
          break;
        }
        case 'a': {
          // Legăturile spre adrese web / e-mail și spre semnele de carte (#nume) rămân legături.
          const href = normalizeHref(attr(k, 'href') ?? '');
          const inner = await inline(k, around, imgs);
          out += href && inner ? `<a href="${esc(href)}">${inner}</a>` : inner;
          break;
        }
        case 'sequence': {
          // Numărul unei legende (Figura 1): rămâne număr automat.
          const sn = attr(k, 'name');
          const val = (k.textContent ?? '').trim();
          out += sn && /^[0-9]+$/.test(val) ? `<span data-seq="${esc(sn)}">${val}</span>` : await inline(k, around, imgs);
          break;
        }
        case 'page-number': case 'page-count': case 'date': case 'time': case 'author-name': case 'initial-creator': case 'creator': case 'title':
        case 'subject': case 'keywords': case 'file-name': case 'word-count': case 'character-count': {
          // Câmpurile cunoscute rămân câmpuri (field.ts); F9 le actualizează.
          const kind = odfFieldKind(k.localName);
          const inner = await inline(k, around, imgs);
          out += kind && inner ? `<span data-field="${kind}">${inner}</span>` : inner;
          break;
        }
        case 'execute-macro': {
          // Butonul cu macrocomandă (în .docx MACROBUTTON): rămâne buton; dublu clic rulează macrocomanda cu același nume.
          const mn = (attr(k, 'name') ?? '').trim().slice(0, 60);
          const inner = await inline(k, around, imgs);
          out += mn && inner ? `<span data-macrobtn="${esc(mn)}">${inner}</span>` : inner;
          break;
        }
        case 'ruby': case 'ruby-base': case 'meta': case 'bookmark-ref': case 'reference-ref': case 'chapter':
        case 'text-input': case 'database-display': case 'variable-get': case 'user-field-get': case 'bibliography-mark':
        case 'sender-firstname': case 'sender-lastname':
          out += await inline(k, around, imgs);
          break;
        case 'note': {
          const cit = el(k, 'note-citation')?.textContent || String(notes.length + 1);
          const nb = el(k, 'note-body');
          // O notă obișnuită (doar paragrafe) stă pe un rând; una cu liste sau tabele își păstrează blocurile.
          // O notă obișnuită (doar paragrafe) devine notă de subsol de-a noastră; una cu liste sau tabele se pune la final.
          if (!nb || els(nb).every((x) => x.localName === 'p')) {
            const parts = nb ? await Promise.all(els(nb, 'p').map((p) => inline(p, {}, imgs))) : [];
            const text = parts.map(plainText).join(String.fromCharCode(10)).trim();
            out += `<sup data-footnote="${esc(text)}"${attr(k, 'note-class') === 'endnote' ? ' data-endnote=""' : ''}></sup>`;
          } else {
            notes.push(`<p>[${esc(cit)}]</p>${await blocks(nb)}`);
            out += `[${esc(cit)}]`;
          }
          break;
        }
        case 'frame': {
          // O poză în rând cu textul; casetele de text (draw:text-box) își dau textul mai departe.
          const tb = el(k, 'text-box');
          if (tb) imgs.push(await blocks(tb));
          else imgs.push(await picture(k));
          break;
        }
        case 'bookmark': case 'bookmark-start': {
          const name = attr(k, 'name');
          if (name) out += `<span data-bookmark="${esc(name)}"></span>`;
          break;
        }
        case 'annotation': case 'annotation-end': case 'bookmark-end':
        case 'reference-mark': case 'reference-mark-start': case 'reference-mark-end': case 'soft-page-break':
        case 'change': case 'change-start': case 'change-end': case 'toc-mark': case 'alphabetical-index-mark':
          break;
        default:
          out += await inline(k, around, imgs);
      }
    }
    return out;
  };

  const paragraph = async (p: Element, tag?: string): Promise<string> => {
    const look = get(attr(p, 'style-name'));
    const imgs: string[] = [];
    const inner = wrap(await inline(p, look.text, imgs), look.text, {});
    let t = tag;
    if (!t) {
      const lvl = p.localName === 'h' ? Number(attr(p, 'outline-level') ?? look.para.heading ?? 1) : 0;
      t = lvl ? `h${Math.min(6, Math.max(1, lvl))}` : 'p';
    }
    let align = look.para.align && look.para.align !== 'left' ? ` style="text-align: ${look.para.align}"` : '';
    // Retragerea nu se ia în liste (au retragerea lor).
    if (!tag && look.para.indent) align += ` data-indent="${look.para.indent}"`;
    if (!tag && look.para.right) align += ` data-indent-right="${look.para.right}"`;
    if (look.para.lh) align += ` data-line-height="${look.para.lh}"`;
    if (look.para.before !== undefined) align += ` data-space-before="${look.para.before}"`;
    if (look.para.after !== undefined) align += ` data-space-after="${look.para.after}"`;
    if (!tag && look.para.first) align += ` data-first-line="${look.para.first}"`;
    if (look.para.box) align += ' data-box="1"' + (look.para.boxLook ? ` data-box-look="${look.para.boxLook}"` : '');
    if (look.para.shade) align += ` data-shade="${look.para.shade}"`;
    if (t === 'p' && look.para.dropCap) align += ' data-dropcap=""';
    if (look.para.keepNext) align += ' data-keep-next=""';
    if (look.para.tabs) align += ` data-tabs="${look.para.tabs}"`;
    if (look.para.keepLines) align += ' data-keep-lines=""';
    if (look.para.noWidow) align += ' data-no-widow=""';
    if (t === 'p' && look.para.pstyle) align += ` data-pstyle="${look.para.pstyle}"`;
    const para = `<${t}${align}>${inner}</${t}>`;
    // Pozele și casetele stau după paragraful lor (editorul le ține ca blocuri separate).
    const pb = '<div data-page-break=""></div>';
    // Un paragraf gol care doar rupe pagina (cum scrie și exportul nostru .odt) devine doar ruperea.
    if (!tag && !inner && !imgs.length && (look.para.pageBefore || look.para.pageAfter)) return pb;
    return (!tag && look.para.pageBefore ? pb : '') + (inner || !imgs.length ? para : '') + imgs.join('') + (!tag && look.para.pageAfter ? pb : '');
  };

  const list = async (l: Element, depth: number, numbered: boolean[] | undefined): Promise<string> => {
    const styleName = attr(l, 'style-name');
    const levels = (styleName && lists[styleName]) || numbered;
    const ordered = levels?.[Math.min(depth, (levels?.length ?? 1) - 1)] ?? false;
    let out = '';
    for (const item of els(l)) {
      if (item.localName !== 'list-item' && item.localName !== 'list-header') continue;
      let li = '';
      for (const k of els(item)) {
        if (k.localName === 'list') li += await list(k, depth + 1, levels);
        else if (k.localName === 'p' || k.localName === 'h') li += await paragraph(k, 'p');
        else li += await block(k);
      }
      out += `<li>${li || '<p></p>'}</li>`;
    }
    return out ? (ordered ? `<ol>${out}</ol>` : `<ul>${out}</ul>`) : '';
  };

  const table = async (t: Element): Promise<string> => {
    let rows = '';
    // Un tabel în care nicio celulă nu are chenar (în LibreOffice celulele fără stil n-au chenar) e „fără borduri”.
    let bordered = false;
    // Marginile primei celule cu stil: devin marginile tabelului dacă diferă de cele obișnuite (0,1 cm).
    let pad: number | undefined;
    const walk = async (n: Element, head = false) => {
      for (const k of els(n)) {
        if (k.localName === 'table-row') {
          const rep = Math.min(50, Number(attr(k, 'number-rows-repeated') ?? 1) || 1);
          let cells = '';
          for (const c of els(k)) {
            if (c.localName !== 'table-cell') continue; // celulele acoperite de o îmbinare nu se scriu
            const cs = Number(attr(c, 'number-columns-spanned') ?? 1), rs = Number(attr(c, 'number-rows-spanned') ?? 1);
            const span = (cs > 1 ? ` colspan="${cs}"` : '') + (rs > 1 ? ` rowspan="${rs}"` : '');
            const inner = await blocks(c);
            const bg = cellBg[attr(c, 'style-name') ?? ''];
            if (cellBorder.has(attr(c, 'style-name') ?? '')) bordered = true;
            if (pad === undefined && cellPad[attr(c, 'style-name') ?? ''] !== undefined) pad = cellPad[attr(c, 'style-name') ?? ''];
            const va = cellVA[attr(c, 'style-name') ?? ''];
            const one = `<td${span}${bg ? ` data-bg="${bg}"` : ''}${va ? ` data-valign="${va}"` : ''}>${inner || '<p></p>'}</td>`;
            cells += one.repeat(Math.min(64, Number(attr(c, 'number-columns-repeated') ?? 1) || 1));
          }
          const rh = rowHeight[attr(k, 'style-name') ?? ''];
          if (cells) rows += `<tr${head ? ' data-repeat-header=""' : ''}${rh ? ` data-row-height="${rh}"` : ''}${rowKeep.has(attr(k, 'style-name') ?? '') ? ' data-no-split=""' : ''}>${cells}</tr>`.repeat(rep);
        } else if (/^table-(header-)?rows$|^table-row-group$/.test(k.localName)) await walk(k, head || k.localName === 'table-header-rows');
      }
    };
    await walk(t);
    const ta = tableAlign[attr(t, 'style-name') ?? ''];
    const ti = ta ? undefined : tableIndent[attr(t, 'style-name') ?? ''];
    const tpad = pad !== undefined && Math.abs(pad - 0.1) > 0.02 ? pad : undefined;
    // Textul alternativ (table:title, table:desc).
    const altOf = (name: string) => (els(t).find((e) => e.localName === name)?.textContent ?? '').trim().slice(0, 2000);
    const at = altOf('title'), ad = altOf('desc');
    return rows ? `<table${bordered ? '' : ' data-borders="none"'}${ta ? ` data-align="${ta}"` : ''}${ti ? ` data-indent="${ti}"` : ''}${tpad !== undefined ? ` data-pad="${tpad}"` : ''}${at ? ` data-alt-title="${esc(at)}"` : ''}${ad ? ` data-alt-desc="${esc(ad)}"` : ''}><tbody>${rows}</tbody></table>` : '';
  };

  const block = async (k: Element): Promise<string> => {
    switch (k.localName) {
      case 'p': case 'h': return paragraph(k);
      case 'list': return list(k, 0, undefined);
      case 'table': return table(k);
      case 'section': case 'index-body': case 'index-title': case 'deletion': return k.localName === 'deletion' ? '' : blocks(k);
      case 'table-of-content': case 'alphabetical-index': case 'illustration-index': case 'bibliography': case 'user-index':
        return blocks(el(k, 'index-body') ?? k);
      case 'frame': { const tb = el(k, 'text-box'); return tb ? blocks(tb) : picture(k); }
      case 'tracked-changes': case 'sequence-decls': case 'variable-decls': case 'user-field-decls': case 'forms': case 'soft-page-break':
        return '';
      default: warnings++; return '';
    }
  };
  async function blocks(n: Element): Promise<string> {
    let out = '';
    for (const k of els(n)) out += await block(k);
    return out;
  }

  let html = await blocks(body);
  if (notes.length) html += '<h3>Note</h3>' + notes.join('');
  // Fără conținut în afara paragrafelor desenate (de exemplu doar forme): editorul are nevoie de cel puțin un paragraf.
  const props = await readMeta(file).catch(() => undefined);
  const layout = readLayout(file);
  return { html: html || '<p></p>', warnings, comments: [], changes: [], layout: props ? { ...(layout ?? { landscape: false, margin: 20 }), props } : layout };
}
