// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import .docx: transformăm fișierul Word în HTML (cu biblioteca mammoth, licență BSD),
// iar editorul îl citește ca pe orice text lipit. Se încarcă doar la nevoie.
// @ts-expect-error mammoth nu are tipuri pentru varianta de browser
import mammoth from 'mammoth/mammoth.browser.js';
import { htmlWithMetafiles } from '../metafile';
import { decodeDrop, encodeDrop } from './formDropData';
import { fromHex, sectionHf, sectionKind, sectionMargin, sectionOrient, toHex } from './sectionKinds';
import { cleanDate, parseShownDate } from './formDate';
import { linesFromTcBorders } from './cellLines';
import type { Restrict } from './format';
import { labelFromCustom } from './format';
import { sheetPwFrom } from '../sheets/sheetPassword';
import JSZip from 'jszip';
import { ommlToEquation } from '../omml';
import { effectCss, effectOf, ligaturesCss, ligaturesOf, proofLangOf, type Ligatures, type TextEffect } from './letterFormat';

/** Chenarul din w:pBdr ca „laturi-linie-culoare” (vezi paragraphBox.ts); null pentru chenarul obișnuit (complet, subțire). */
function boxLookOf(bdr: string): string | null {
  const side = (k: string) => { const m = new RegExp(`<w:${k}\\b[^>]*>`).exec(bdr)?.[0]; return m && !/w:val="(none|nil)"/.test(m) ? m : null; };
  const t = side('top'), b = side('bottom'), l = side('left'), r = side('right');
  const sides = t && b && l && r ? 'all' : t && b && !l && !r ? 'tb' : t && !b && !l && !r ? 'top' : b && !t && !l && !r ? 'bottom' : l && !t && !b && !r ? 'left' : 'all';
  const one = t ?? b ?? l ?? r ?? '';
  const val = /w:val="([^"]+)"/.exec(one)?.[1] ?? 'single';
  const sz = Number(/w:sz="(\d+)"/.exec(one)?.[1] ?? '4');
  const line = /double/i.test(val) ? 'double' : /dash/i.test(val) ? 'dashed' : /dot/i.test(val) ? 'dotted' : sz >= 12 && sides !== 'left' ? 'thick' : 'single';
  const c = (/w:color="([0-9A-Fa-f]{6})"/.exec(one)?.[1] ?? '000000').toLowerCase();
  const text = `${sides}-${line}-${c}`;
  return text === 'all-single-6b6b80' ? null : text;
}
import { isRepaired, needsRewrite, officeSigners, openOfficeZip } from '../officeFile';
import { footnotesFromMammoth } from './footnote';
import { captionsFromHtml } from './caption';
import { fieldsFromMarks, markFieldsXml } from './field';
import { pageHeaderImage, lineNums as lineNumsOf, type LineNums, type PageSetup, docProps, type EvenPage, type FirstPage, type NumAt, type NumStyle, marginsFrom, paperFrom, type DocProps, type Margins, type Paper, type PageBorder, pageWatermarkFont, pageWatermarkImage } from './format';
import { fromWordUnderline, type UnderlineStyle } from './underlineStyle';
import { chartAlt, chartSvgOf, chartToPng, DOC_CHART_W, parseChart, type DocChart } from './chart';

interface MammothResult {
  value: string;
  messages: { type: string; message: string }[];
}

// Bucățile din modelul de document al lui mammoth de care avem nevoie.
interface MNode {
  type: string;
  isUnderline?: boolean;
  children?: MNode[];
  value?: string;
  styleName?: string | null;
  numbering?: unknown;
  alignment?: string | null;
  indent?: { start?: string; end?: string; firstLine?: string; hanging?: string } | null;
  font?: string | null;
  fontSize?: number | null;
  highlight?: string | null;
}

// Pe lângă ce recunoaște mammoth implicit (titluri, aldin, cursiv, liste, tabele, imagini),
// păstrăm și sublinierea și textul tăiat.
const STYLE_MAP = [
  'u => u',
  'strike => s',
  "p[style-name='Title'] => p.doc-title:fresh",
  "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
  "p[style-name='Titlu'] => p.doc-title:fresh",
  "p[style-name='Subtitlu'] => p.doc-subtitle:fresh",
  // Legendele (Figura 1, Tabelul 1); numărul lor devine iar număr automat (captionsFromHtml).
  "p[style-name='caption'] => p.doc-caption:fresh",
  "p[style-name='Caption'] => p.doc-caption:fresh",
  "p[style-name='Legendă'] => p.doc-caption:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  // Ruperile de pagină (Ctrl+Enter în Word); mai jos devin „Pagină nouă” în editor.
  "br[type='page'] => hr.suite-pb",
  // Sfârșitul de coloană (Ctrl+Shift+Enter în Word) devine „Sfârșit de coloană” în editor.
  "br[type='column'] => hr.suite-cb",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
];

// Culorile de evidențiere din Word au nume fixe.
const HIGHLIGHT: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff',
  red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000',
  darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080',
  lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
};

const ALIGN: Record<string, string> = { center: 'center', right: 'right', end: 'right', both: 'justify', justify: 'justify', distribute: 'justify' };
const ALIGN_CODE: Record<string, string> = { center: 'c', right: 'r', justify: 'j' };
const CODE_ALIGN: Record<string, string> = { c: 'center', r: 'right', j: 'justify' };
// Semn invizibil cu care marcăm începutul paragrafelor aliniate; îl scoatem din HTML la final.
const MARK = '⁣';

// Mammoth nu citește culoarea textului, iar evidențierea făcută cu „umbrire” (cum o salvează și Suite)
// nu o vede deloc. Le citim direct din document.xml, rulaj cu rulaj, în aceeași ordine ca mammoth.
interface XmlRun { text: string; lang: string | null; noProof: boolean; color: string | null; shade: string | null; smallCaps: boolean; caps: boolean; spacing: number | null; effect: TextEffect | null; lig: Ligatures | null; uStyle: UnderlineStyle | null; uColor: string | null }

async function readXmlRuns(buffer: ArrayBuffer): Promise<XmlRun[]> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const runs: XmlRun[] = [];
  const val = (el: Element | null) => el?.getAttribute('w:val') ?? el?.getAttribute('w:fill') ?? null;
  const hex = (v: string | null) => (v && /^[0-9a-fA-F]{6}$/.test(v) ? '#' + v.toLowerCase() : null);
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const name = child.localName;
      // Mammoth ignoră textul șters și varianta „Choice” a desenelor (citește „Fallback”).
      if (name === 'del' || name === 'moveFrom' || name === 'Choice') continue;
      if (name === 'r') {
        const rPr = Array.from(child.children).find((c) => c.localName === 'rPr') ?? null;
        const prop = (n: string) => (rPr ? Array.from(rPr.children).find((c) => c.localName === n) ?? null : null);
        const text = Array.from(child.getElementsByTagName('w:t')).map((t) => t.textContent ?? '').join('');
        const shd = prop('shd');
        // Comutatoarele Word (w:smallCaps, w:caps) sunt pornite dacă există fără w:val="0"/"false".
        const on = (n: string) => { const e = prop(n); const v = e?.getAttribute('w:val'); return !!e && v !== '0' && v !== 'false'; };
        const sp = Number(prop('spacing')?.getAttribute('w:val'));
        const u = prop('u');
        runs.push({ text, lang: proofLangOf(prop('lang')?.getAttribute('w:val')), noProof: on('noProof'), color: hex(val(prop('color'))), shade: hex(shd?.getAttribute('w:fill') ?? null), smallCaps: on('smallCaps'), caps: on('caps'), spacing: sp ? sp / 20 : null,
          effect: effectOf({ outline: on('outline'), shadow: on('shadow'), emboss: on('emboss'), imprint: on('imprint'), glow: !!prop('glow') }), lig: ligaturesOf(prop('ligatures')?.getAttribute('w14:val')),
          uStyle: fromWordUnderline(u?.getAttribute('w:val')), uColor: hex(u?.getAttribute('w:color') ?? null) });
      }
      walk(child);
    }
  };
  const body = doc.getElementsByTagName('w:body')[0];
  if (body) walk(body);
  return runs.filter((r) => r.text);
}

function runText(run: MNode): string {
  let s = '';
  const walk = (n: MNode) => {
    if (n.type === 'text') s += n.value ?? '';
    n.children?.forEach(walk);
  };
  walk(run);
  return s;
}

const cssText = (v: string) => v.replace(/[^\w\s.-]/g, '');

/** Un comentariu din fișierul Word; în text, locul lui e marcat cu CMT_START+id+CMT_CLOSE … CMT_END+id+CMT_CLOSE. */
export interface ImportedComment {
  id: string; author: string; date: string; text: string;
  /** Răspunsurile (comentariile legate de acesta în commentsExtended.xml), în ordinea din fișier. */
  replies?: { author: string; date: string; text: string }[];
  /** La un răspuns: id-ul comentariului de sus (răspunsul nu devine comentariu separat). */
  parent?: string;
  /** Rezolvat în Word (w15:done="1" în commentsExtended.xml). */
  done?: boolean;
}
export const CMT_START = '\uE000';
export const CMT_END = '\uE002';
export const CMT_CLOSE = '\uE001';

/** O modificare urmărită din Word (text adăugat sau șters), marcată în text la fel ca un comentariu. */
export interface ImportedChange { id: string; kind: 'insertion' | 'deletion' | 'format' | 'paragraph'; author: string; date: string; /** La format: schimbările (JSON, ca în track.ts); la paragraf: cum era paragraful. */ ops?: string }
export const INS_START = String.fromCharCode(0xe003);
export const INS_END = String.fromCharCode(0xe004);
export const DEL_START = String.fromCharCode(0xe005);
export const DEL_END = String.fromCharCode(0xe006);
export const FMT_START = String.fromCharCode(0xe007);
export const FMT_END = String.fromCharCode(0xe008);
/** Semnul pus la începutul unui paragraf cu alinierea / stilul schimbate (w:pPrChange). */
export const PARA_MARK = String.fromCharCode(0xe009);

/** Alinierea din w:jc, cu numele din editor. */
const jcAlign = (pr: string) => {
  const v = /<w:jc w:val="(\w+)"/.exec(pr)?.[1] ?? '';
  return v === 'center' ? 'center' : v === 'right' || v === 'end' ? 'right' : v === 'both' || v === 'distribute' ? 'justify' : 'left';
};

/** Stilurile de titlu din styles.xml (numele „heading 1” … „heading 6”), după id: nivelul titlului. */
export function headingStyleLevels(stylesXml: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    if (!/w:type="paragraph"/.test(m[1])) continue;
    const id = attr(m[1], 'styleId');
    const lvl = /<w:name w:val="heading ([1-6])"/i.exec(m[2])?.[1];
    if (id && lvl) out.set(id, Number(lvl));
  }
  return out;
}

/**
 * Cum era paragraful înainte de w:pPrChange (felul: paragraf / titlu cu nivel, și alinierea), dacă diferă de cum e acum;
 * altfel null (schimbările de spațiere, retragere etc. nu le arătăm încă).
 */
export function pprChangeOld(newPr: string, oldPr: string, heads: Map<string, number>): { type: string; level?: number; textAlign: string; indent?: number; spaceBefore?: number | null; spaceAfter?: number | null; lineHeight?: number | null } | null {
  const lvl = (pr: string) => heads.get(/<w:pStyle w:val="([^"]+)"/.exec(pr)?.[1] ?? '') ?? 0;
  // Retragerea la stânga în trepte de 1,25 cm (709 twips), spațierea în puncte și rândurile în „rânduri” (ca la import).
  const ind = (pr: string) => {
    const t = /<w:ind\b[^>]*>/.exec(pr)?.[0] ?? '';
    const tw = (Number(attr(t, 'start') || attr(t, 'left')) || 0) - (Number(attr(t, 'hanging')) || 0);
    return Math.min(8, Math.max(0, Math.round((tw / 709) * 100) / 100));
  };
  const sp = (pr: string, k: 'before' | 'after' | 'line') => {
    const t = /<w:spacing\b[^>]*>/.exec(pr)?.[0] ?? '';
    const v = attr(t, k);
    if (v === '' || !Number.isFinite(Number(v))) return null;
    if (k !== 'line') return Math.round((Number(v) / 20) * 10) / 10;
    return /^(auto)?$/.test(attr(t, 'lineRule')) ? Math.round((Number(v) / 240) * 100) / 100 : null;
  };
  const l0 = lvl(oldPr), l1 = lvl(newPr), a0 = jcAlign(oldPr), a1 = jcAlign(newPr);
  const old: { type: string; level?: number; textAlign: string; indent?: number; spaceBefore?: number | null; spaceAfter?: number | null; lineHeight?: number | null } = l0 ? { type: 'heading', level: l0, textAlign: a0 } : { type: 'paragraph', textAlign: a0 };
  let diff = l0 !== l1 || a0 !== a1;
  if (ind(oldPr) !== ind(newPr)) { old.indent = ind(oldPr); diff = true; }
  // Retragerea la dreapta și prima linie, în cm (prima linie agățată = negativă); 0 = fără.
  const cm = (pr: string, k: 'right' | 'first') => {
    const t = /<w:ind\b[^>]*>/.exec(pr)?.[0] ?? '';
    const tw = k === 'right' ? Number(attr(t, 'end') || attr(t, 'right')) || 0 : (Number(attr(t, 'firstLine')) || 0) - (Number(attr(t, 'hanging')) || 0);
    return Math.round((tw / 567) * 100) / 100 || null;
  };
  for (const [k, w] of [['indentRight', 'right'], ['firstLine', 'first']] as const) {
    if (cm(oldPr, w) !== cm(newPr, w)) { (old as Record<string, unknown>)[k] = cm(oldPr, w); diff = true; }
  }
  for (const [k, w] of [['spaceBefore', 'before'], ['spaceAfter', 'after'], ['lineHeight', 'line']] as const) {
    if (sp(oldPr, w) !== sp(newPr, w)) { old[k] = sp(oldPr, w); diff = true; }
  }
  return diff ? old : null;
}

/**
 * Schimbările de format dintr-un w:rPrChange: ce s-a pus și ce s-a scos între formatul vechi (din w:rPrChange) și cel nou
 * (restul lui w:rPr): aldin, cursiv, subliniat, tăiat, exponent, indice, evidențierea și fontul / mărimea / culoarea
 * (textStyle: scos cu atributele vechi, pus cu cele noi, ca respingerea să readucă fontul și culoarea de dinainte).
 */
export function rprChangeOps(newPr: string, oldPr: string): { op: 'add' | 'remove'; type: string; attrs?: Record<string, string> }[] {
  const on = (pr: string, tag: string) => new RegExp('<w:' + tag + '(?: w:val="(?:true|1|on)")? ?/>').test(pr);
  const has: Record<string, (pr: string) => boolean> = {
    bold: (pr) => on(pr, 'b'), italic: (pr) => on(pr, 'i'), strike: (pr) => on(pr, 'strike'),
    underline: (pr) => /<w:u w:val="(?!none")[^"]+"/.test(pr),
    superscript: (pr) => /<w:vertAlign w:val="superscript"/.test(pr), subscript: (pr) => /<w:vertAlign w:val="subscript"/.test(pr),
  };
  const ops: { op: 'add' | 'remove'; type: string; attrs?: Record<string, string> }[] = [];
  for (const [type, f] of Object.entries(has)) {
    const a = f(oldPr), b = f(newPr);
    if (a !== b) ops.push({ op: b ? 'add' : 'remove', type });
  }
  // Evidențierea: w:highlight (culorile cu nume) sau fundalul rulajului (w:shd w:fill).
  const hl = (pr: string) => {
    const n = /<w:highlight w:val="([a-zA-Z]+)"/.exec(pr)?.[1];
    if (n && n !== 'none') return HIGHLIGHT_HEX[n] ?? '#ffff00';
    const f = /<w:shd\b[^>]*w:fill="([0-9A-Fa-f]{6})"/.exec(pr)?.[1];
    return f && !/^f{6}$/i.test(f) ? '#' + f.toLowerCase() : '';
  };
  const h0 = hl(oldPr), h1 = hl(newPr);
  if (h0 !== h1) {
    if (h0) ops.push({ op: 'remove', type: 'highlight', attrs: { color: h0 } });
    if (h1) ops.push({ op: 'add', type: 'highlight', attrs: { color: h1 } });
  }
  // Fontul, mărimea și culoarea (textStyle în editor).
  const ts = (pr: string) => {
    const a: Record<string, string> = {};
    const c = /<w:color w:val="([0-9A-Fa-f]{6})"/.exec(pr)?.[1];
    if (c && c !== '000000') a.color = '#' + c.toLowerCase();
    const f = /<w:rFonts\b[^>]*\bw:ascii="([^"]+)"/.exec(pr)?.[1];
    if (f) a.fontFamily = f;
    const sz = /<w:sz w:val="(\d+)"/.exec(pr)?.[1];
    if (sz && Number(sz) > 0) a.fontSize = Number(sz) / 2 + 'pt';
    return a;
  };
  const t0 = ts(oldPr), t1 = ts(newPr);
  if (JSON.stringify(t0) !== JSON.stringify(t1)) {
    if (Object.keys(t0).length) ops.push({ op: 'remove', type: 'textStyle', attrs: t0 });
    if (Object.keys(t1).length) ops.push({ op: 'add', type: 'textStyle', attrs: t1 });
  }
  return ops;
}

/** Culorile de evidențiere cu nume din .docx (w:highlight). */
const HIGHLIGHT_HEX: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080',
  darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
};

const attr = (tag: string, name: string) => new RegExp(`\\bw:${name}="([^"]*)"`).exec(tag)?.[1] ?? '';

// Mammoth nu știe unde încep și unde se termină comentariile, iar textul șters din „Track Changes” îl aruncă.
// Înlocuim în document.xml aceste locuri cu semne invizibile (textul șters devine text obișnuit între semne);
// editorul le transformă apoi în comentarii și modificări (vezi applyImportedComments / applyImportedChanges).
async function markRevisions(buffer: ArrayBuffer): Promise<{ buffer: ArrayBuffer; comments: ImportedComment[]; changes: ImportedChange[] }> {
  const zip = await JSZip.loadAsync(buffer);
  const cxml = await zip.file('word/comments.xml')?.async('string');
  const dxml = await zip.file('word/document.xml')?.async('string');
  if (!dxml) return { buffer, comments: [], changes: [] };
  const comments: ImportedComment[] = [];
  if (cxml) {
    const cdoc = new DOMParser().parseFromString(cxml, 'application/xml');
    // Firul de discuție: fiecare comentariu e cunoscut după paraId-ul ultimului lui paragraf.
    const byPara = new Map<string, ImportedComment>();
    for (const c of Array.from(cdoc.getElementsByTagName('w:comment'))) {
      const id = c.getAttribute('w:id') ?? '';
      if (!id) continue;
      const paras = c.getElementsByTagName('w:p');
      const paraId = paras.length ? paras[paras.length - 1].getAttribute('w14:paraId') ?? '' : '';
      comments.push({
        id,
        author: c.getAttribute('w:author') ?? '',
        date: c.getAttribute('w:date') ?? '',
        text: Array.from(c.getElementsByTagName('w:p'))
          .map((p) => Array.from(p.getElementsByTagName('w:t')).map((t) => t.textContent ?? '').join(''))
          .join('\n').trim(),
      });
      if (paraId) byPara.set(paraId.toUpperCase(), comments[comments.length - 1]);
    }
    const ext = await zip.file('word/commentsExtended.xml')?.async('string');
    if (ext && byPara.size) {
      const edoc = new DOMParser().parseFromString(ext, 'application/xml');
      for (const e of Array.from(edoc.getElementsByTagName('w15:commentEx'))) {
        const child = byPara.get((e.getAttribute('w15:paraId') ?? '').toUpperCase());
        if (child && e.getAttribute('w15:done') === '1') child.done = true;
        let top = byPara.get((e.getAttribute('w15:paraIdParent') ?? '').toUpperCase());
        // Un răspuns la un răspuns merge tot sub comentariul de sus.
        for (let i = 0; top?.parent && i < 50; i++) top = comments.find((c) => c.id === top!.parent);
        if (!child || !top || child === top || child.parent) continue;
        child.parent = top.id;
        (top.replies ??= []).push({ author: child.author, date: child.date, text: child.text });
      }
    }
  }
  const run = (text: string) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
  const changes: ImportedChange[] = [];
  let n = 0;
  const stack: { kind: 'insertion' | 'deletion'; id: string }[] = [];
  let marked = dxml;
  if (comments.length) {
    marked = marked
      .replace(/<w:commentRangeStart\b[^>]*?w:id="(\d+)"[^>]*\/>/g, (_m, id: string) => run(CMT_START + id + CMT_CLOSE))
      .replace(/<w:commentRangeEnd\b[^>]*?w:id="(\d+)"[^>]*\/>/g, (_m, id: string) => run(CMT_END + id + CMT_CLOSE));
  }
  // <w:ins>…</w:ins> și <w:del>…</w:del> din jurul rulajelor (nu și cele goale, din proprietățile paragrafelor).
  marked = marked.replace(/<w:(ins|del)\b([^>]*?)(\/?)>|<\/w:(ins|del)>/g, (m, open?: string, attrs?: string, self?: string) => {
    if (open) {
      if (self) return m;
      const kind = open === 'ins' ? 'insertion' : 'deletion';
      const id = String(++n);
      stack.push({ kind, id });
      changes.push({ id, kind, author: attr(attrs ?? '', 'author'), date: attr(attrs ?? '', 'date') });
      return run((kind === 'insertion' ? INS_START : DEL_START) + id + CMT_CLOSE);
    }
    const top = stack.pop();
    if (!top) return '';
    return run((top.kind === 'insertion' ? INS_END : DEL_END) + top.id + CMT_CLOSE);
  });
  // Rulajele cu format schimbat (w:rPrChange în w:rPr): semne în jurul lor și formatul vechi scos (mammoth citește doar formatul nou).
  marked = marked.replace(/<w:r\b[^>]*>(?:(?!<\/w:r>)[^])*?<\/w:r>/g, (m) => {
    const c = /<w:rPrChange\b([^>]*?)(?:\/>|>((?:(?!<\/w:rPrChange>)[^])*)<\/w:rPrChange>)/.exec(m);
    if (!c) return m;
    const rest = m.replace(c[0], '');
    const pr = /<w:rPr>((?:(?!<\/w:rPr>)[^])*)<\/w:rPr>/.exec(rest)?.[1] ?? '';
    const ops = rprChangeOps(pr, c[2] ?? '');
    if (!ops.length) return rest;
    const id = String(++n);
    changes.push({ id, kind: 'format', author: attr(c[1], 'author'), date: attr(c[1], 'date'), ops: JSON.stringify(ops) });
    return run(FMT_START + id + CMT_CLOSE) + rest + run(FMT_END + id + CMT_CLOSE);
  });
  // Paragrafele cu alinierea / stilul schimbate (w:pPrChange în w:pPr): semn la începutul paragrafului, cu felul lui de dinainte.
  if (marked.includes('<w:pPrChange')) {
    const heads = headingStyleLevels((await zip.file('word/styles.xml')?.async('string')) ?? '');
    const re = /<w:pPrChange\b([^>]*?)(?:\/>|>\s*(?:<w:pPr\s*\/>|<w:pPr>((?:(?!<\/w:pPr>)[^])*)<\/w:pPr>)?\s*<\/w:pPrChange>)/g;
    let out = '', last = 0;
    for (let m = re.exec(marked); m; m = re.exec(marked)) {
      const open = marked.lastIndexOf('<w:pPr>', m.index);
      const close = marked.indexOf('</w:pPr>', m.index + m[0].length);
      if (open < 0 || close < 0 || open < last) continue;
      const newPr = marked.slice(open + 7, m.index) + marked.slice(m.index + m[0].length, close);
      const old = pprChangeOld(newPr, m[2] ?? '', heads);
      if (!old) continue;
      const id = String(++n);
      changes.push({ id, kind: 'paragraph', author: attr(m[1], 'author'), date: attr(m[1], 'date'), ops: JSON.stringify(old) });
      const end = close + 8;
      out += marked.slice(last, end) + run(PARA_MARK + id + CMT_CLOSE);
      last = end;
    }
    marked = out + marked.slice(last);
  }
  // Textul șters e scris în Word ca <w:delText>; îl facem text obișnuit, ca mammoth să-l citească.
  if (changes.some((c) => c.kind === 'deletion')) marked = marked.replace(/<w:delText\b/g, '<w:t').replace(/<\/w:delText>/g, '</w:t>');
  if (!comments.length && !changes.length) return { buffer, comments, changes };
  zip.file('word/document.xml', marked);
  return { buffer: await zip.generateAsync({ type: 'arraybuffer' }), comments, changes };
}

// Culoarea de fundal a celulelor (w:tcPr/w:shd w:fill): semn invizibil la sfârșitul primului paragraf din celulă,
// care devine apoi data-bg pe <td>.
function markCellColors(xml: string, onFound: () => void): string {
  return xml.split(/(?=<w:tc[ >])/).map((seg) => {
    const pr = /^<w:tc[^>]*>[ ]*<w:tcPr>([^]*?)<[/]w:tcPr>/.exec(seg)?.[1];
    const fill = pr ? /<w:shd [^>]*w:fill="([0-9A-Fa-f]{6})"/.exec(pr)?.[1] : undefined;
    if (!fill || /^f{6}$/i.test(fill)) return seg;
    const end = seg.indexOf('</w:p>');
    if (end < 0) return seg;
    onFound();
    return seg.slice(0, end) + `<w:r><w:t>${MARK}b${fill.toLowerCase()}${MARK}</w:t></w:r>` + seg.slice(end);
  }).join('');
}

// Înălțimea rândurilor de tabel (w:trHeight, „cel puțin” sau „exact”): mammoth n-o citește. Semn invizibil în prima celulă,
// care devine apoi data-row-height (cm) pe <tr>.
function markRowHeights(xml: string, onFound: () => void): string {
  return xml.split(/(?=<w:tr[ >])/).map((seg) => {
    const pr = /^<w:tr[^>]*>[^<]*(?:<w:tblPrEx>[^]*?<[/]w:tblPrEx>[^<]*)?<w:trPr>([^]*?)<[/]w:trPr>/.exec(seg)?.[1];
    const h = pr ? /<w:trHeight [^>]*>/.exec(pr)?.[0] : undefined;
    const tw = h && attr(h, 'hRule') !== 'auto' ? Number(attr(h, 'val')) : 0;
    // Rândul care nu se rupe între pagini (w:cantSplit, fără val="0").
    const keep = pr ? /<w:cantSplit(?:\s*[/]>|\s+w:val="(?:1|true|on)")/.test(pr) : false;
    const end = seg.indexOf('</w:p>');
    if ((!(tw > 0) && !keep) || end < 0) return seg;
    onFound();
    return seg.slice(0, end) + (tw > 0 ? `<w:r><w:t>${MARK}r${Math.round((tw / 567) * 100)}${MARK}</w:t></w:r>` : '') + (keep ? `<w:r><w:t>${MARK}s${MARK}</w:t></w:r>` : '') + seg.slice(end);
  }).join('');
}

// Casetele de selectare (w:sdt cu w14:checkbox): semn invizibil cu starea lor (bifată sau nu), care devine <span data-form-check>.
function markFormChecks(xml: string, onFound: () => void): string {
  return xml.replace(/<w:sdt>((?:(?!<[/]?w:sdt>)[^])*?<w14:checkbox>(?:(?!<[/]?w:sdt>)[^])*?)<[/]w:sdt>/g, (m, inner: string) => {
    // Doar casetele din rând (în paragraf); cele care cuprind paragrafe întregi rămân cum sunt.
    if (inner.includes('<w:p>') || inner.includes('<w:p ')) return m;
    const on = /<w14:checked w14:val="(1|true|on)"/.test(inner);
    onFound();
    return `<w:r><w:t>${MARK}y${on ? '1' : '0'}${MARK}</w:t></w:r>`;
  });
}

// Listele verticale și listele combinate (w:sdt cu w:dropDownList / w:comboBox): semn invizibil cu variantele și alegerea,
// care devine <span data-form-drop>. Textul de completat (w:showingPlcHdr) înseamnă că nu e aleasă nicio variantă.
function markFormDrops(xml: string, onFound: () => void): string {
  return xml.replace(/<w:sdt>((?:(?!<[/]?w:sdt>)[^])*?<w:(?:dropDownList|comboBox)[ >/](?:(?!<[/]?w:sdt>)[^])*?)<[/]w:sdt>/g, (m, inner: string) => {
    if (inner.includes('<w:p>') || inner.includes('<w:p ')) return m;
    const pr = /<w:sdtPr>([^]*?)<[/]w:sdtPr>/.exec(inner)?.[1] ?? '';
    const body = /<w:sdtContent>([^]*?)<[/]w:sdtContent>/.exec(inner)?.[1] ?? '';
    const unx = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const items: string[] = [];
    for (const li of pr.matchAll(/<w:listItem\b([^>]*)>/g)) {
      const t = unx(/w:displayText="([^"]*)"/.exec(li[1])?.[1] ?? /w:value="([^"]*)"/.exec(li[1])?.[1] ?? '').trim();
      if (t && !items.includes(t)) items.push(t);
    }
    const value = pr.includes('<w:showingPlcHdr') ? '' : unx([...body.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<[/]w:t>/g)].map((x) => x[1]).join('')).trim();
    onFound();
    return `<w:r><w:t>${MARK}j${encodeDrop(items, value)}${MARK}</w:t></w:r>`;
  });
}

// Selectoarele de dată (w:sdt cu w:date): semn invizibil cu data (din w:fullDate sau, fără ea, din textul scris), care devine
// <span data-form-date>. Textul de completat (w:showingPlcHdr) înseamnă că nu e aleasă nicio dată.
function markFormDates(xml: string, onFound: () => void): string {
  return xml.replace(/<w:sdt>((?:(?!<[/]?w:sdt>)[^])*?<w:date[ >/](?:(?!<[/]?w:sdt>)[^])*?)<[/]w:sdt>/g, (m, inner: string) => {
    if (inner.includes('<w:p>') || inner.includes('<w:p ')) return m;
    const pr = /<w:sdtPr>([^]*?)<[/]w:sdtPr>/.exec(inner)?.[1] ?? '';
    const body = /<w:sdtContent>([^]*?)<[/]w:sdtContent>/.exec(inner)?.[1] ?? '';
    const shown = [...body.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<[/]w:t>/g)].map((x) => x[1]).join('');
    const value = pr.includes('<w:showingPlcHdr') ? '' : cleanDate(/w:fullDate="([^"]*)"/.exec(pr)?.[1] ?? '') || parseShownDate(shown);
    onFound();
    return `<w:r><w:t>${MARK}h${value}${MARK}</w:t></w:r>`;
  });
}

// Bordurile puse pe celule (w:tcBorders în w:tcPr): semn invizibil în celulă, care devine data-cl pe <td> (cellLines.ts).
function markCellLines(xml: string, onFound: () => void): string {
  return xml.split(/(?=<w:tc[ >])/).map((seg) => {
    const pr = /^<w:tc[^>]*>[^<]*<w:tcPr>([^]*?)<[/]w:tcPr>/.exec(seg)?.[1];
    const tb = pr ? /<w:tcBorders>([^]*?)<[/]w:tcBorders>/.exec(pr)?.[1] : undefined;
    const cl = tb ? linesFromTcBorders(tb) : null;
    const end = seg.indexOf('</w:p>');
    if (!cl || end < 0) return seg;
    onFound();
    return seg.slice(0, end) + `<w:r><w:t>${MARK}c${cl.replace(/ #/g, '_')}${MARK}</w:t></w:r>` + seg.slice(end);
  }).join('');
}

// Alinierea verticală a celulelor (w:vAlign la mijloc / jos): semn invizibil în celulă, care devine data-valign pe <td>.
function markCellVAlign(xml: string, onFound: () => void): string {
  return xml.split(/(?=<w:tc[ >])/).map((seg) => {
    const pr = /^<w:tc[^>]*>[^<]*<w:tcPr>([^]*?)<[/]w:tcPr>/.exec(seg)?.[1];
    const v = pr ? /<w:vAlign w:val="(center|bottom)"/.exec(pr)?.[1] : undefined;
    const end = seg.indexOf('</w:p>');
    if (!v || end < 0) return seg;
    onFound();
    return seg.slice(0, end) + `<w:r><w:t>${MARK}v${v === 'center' ? 'm' : 'b'}${MARK}</w:t></w:r>` + seg.slice(end);
  }).join('');
}

// Tabelele potrivite conținutului (AutoFit): lățime automată (w:tblW auto), fără aranjare fixă și fără lățimi de celulă
// scrise (toate w:tcW automate). Semn invizibil în prima celulă, care devine data-fit="content" pe <table>.
function markFitTables(xml: string, onFound: () => void): string {
  return xml.replace(/<w:tbl>(<w:tblPr>([^]*?)<[/]w:tblPr>)([^]*?)<[/]w:p>/g, (m, pr: string, inner: string, rest: string, at: number) => {
    if (!/<w:tblW [^>]*w:type="auto"/.test(inner) || /<w:tblLayout [^>]*w:type="fixed"/.test(inner)) return m;
    const end = xml.indexOf('</w:tbl>', at);
    const whole = xml.slice(at, end < 0 ? undefined : end);
    if (/<w:tcW [^>]*w:type="(?:dxa|pct)"/.test(whole.replace(/w:w="0" w:type="dxa"/g, ''))) return m;
    onFound();
    return `<w:tbl>${pr}${rest}<w:r><w:t>${MARK}f${MARK}</w:t></w:r></w:p>`;
  });
}

// Tabelele așezate la centru sau la dreapta (w:jc în w:tblPr): semn invizibil în prima celulă → data-align pe <table>.
function markTableAlign(xml: string, onFound: () => void): string {
  return xml.replace(/<w:tbl>(<w:tblPr>([^]*?)<[/]w:tblPr>)([^]*?)<[/]w:p>/g, (m, pr: string, inner: string, rest: string) => {
    const jc = /<w:jc w:val="(center|right|end)"/.exec(inner.split('<w:tblPrChange')[0])?.[1];
    if (!jc) return m;
    onFound();
    return `<w:tbl>${pr}${rest}<w:r><w:t>${MARK}a${jc === 'center' ? 'c' : 'r'}${MARK}</w:t></w:r></w:p>`;
  });
}

// Indentarea tabelului (w:tblInd, în twips) și marginile celulelor (w:tblCellMar, stânga; doar când diferă de 0,19 cm):
// semne invizibile în prima celulă → data-indent / data-pad (cm) pe <table>.
function markTableSpacing(xml: string, onFound: () => void): string {
  return xml.replace(/<w:tbl>(<w:tblPr>([^]*?)<[/]w:tblPr>)([^]*?)<[/]w:p>/g, (m, pr: string, inner: string, rest: string) => {
    const own = inner.split('<w:tblPrChange')[0];
    const ind = /<w:tblInd [^>]*>/.exec(own)?.[0];
    const indTw = ind && (attr(ind, 'type') || 'dxa') === 'dxa' ? Number(attr(ind, 'w')) : 0;
    const mar = /<w:tblCellMar>([^]*?)<[/]w:tblCellMar>/.exec(own)?.[1];
    const side = mar ? /<w:(?:left|start) [^>]*>/.exec(mar)?.[0] : undefined;
    const padTw = side && (attr(side, 'type') || 'dxa') === 'dxa' ? Number(attr(side, 'w')) : NaN;
    const marks = (indTw > 0 ? `${MARK}i${Math.round((indTw / 567) * 100)}${MARK}` : '') + (padTw >= 0 && padTw !== 108 ? `${MARK}p${Math.round((padTw / 567) * 100)}${MARK}` : '');
    if (!marks) return m;
    onFound();
    return `<w:tbl>${pr}${rest}<w:r><w:t>${marks}</w:t></w:r></w:p>`;
  });
}

/** Bordurile din <w:tblBorders>: 'none' dacă toate laturile sunt fără linie, 'some' dacă vreuna are, null dacă nu sunt scrise. */
// Textul alternativ al tabelului (w:tblCaption, w:tblDescription): se ține în listă, iar în prima celulă rămâne semnul cu numărul lui → data-alt-title / data-alt-desc.
function markTableAlt(xml: string, alts: TableAlt[], onFound: () => void): string {
  return xml.replace(/<w:tbl>(<w:tblPr>([^]*?)<[/]w:tblPr>)([^]*?)<[/]w:p>/g, (m, pr: string, inner: string, rest: string) => {
    const own = inner.split('<w:tblPrChange')[0];
    const val = (tag: string) => { const t = new RegExp(`<w:${tag} [^>]*>`).exec(own)?.[0]; return t ? unXml((attr(t, 'val') ?? '').replace(/&#(?:10|x[aA]);/g, '\n')).trim() : ''; };
    const t = val('tblCaption'), d = val('tblDescription');
    if (!t && !d) return m;
    onFound();
    alts.push({ t, d });
    return `<w:tbl>${pr}${rest}<w:r><w:t>${MARK}d${alts.length - 1}${MARK}</w:t></w:r></w:p>`;
  });
}

// Tabelul plutitor (w:tblpPr, textul curge pe lângă el): semn cu așezarea lui (tblpXSpec) → data-wrap="around" (+ data-align).
function markFloatTables(xml: string, onFound: () => void): string {
  return xml.replace(/<w:tbl>(<w:tblPr>([^]*?)<[/]w:tblPr>)([^]*?)<[/]w:p>/g, (m, pr: string, inner: string, rest: string) => {
    const own = inner.split('<w:tblPrChange')[0];
    const fp = /<w:tblpPr\b[^>]*>/.exec(own)?.[0];
    if (!fp) return m;
    const x = attr(fp, 'tblpXSpec');
    onFound();
    return `<w:tbl>${pr}${rest}<w:r><w:t>${MARK}w${x === 'center' ? 'c' : x === 'right' || x === 'outside' ? 'r' : 'l'}${MARK}</w:t></w:r></w:p>`;
  });
}

function tblBorders(pr: string): 'none' | 'some' | null {
  const b = /<w:tblBorders>([^]*?)<[/]w:tblBorders>/.exec(pr)?.[1];
  if (b === undefined) return null;
  const vals = [...b.matchAll(/w:val="([^"]*)"/g)].map((m) => m[1]);
  return vals.every((v) => v === 'none' || v === 'nil') ? 'none' : 'some';
}

/** Bordurile unui stil de tabel din styles.xml, urmând stilurile pe care se bazează; fără stil, cel implicit (de obicei fără borduri). */
function styleBorders(styles: string, id: string | undefined): 'none' | 'some' {
  for (let depth = 0; depth < 8; depth++) {
    const re = id
      ? new RegExp(`<w:style [^>]*w:styleId="${id.replace(/[^A-Za-z0-9_-]/g, '')}"[^>]*>([^]*?)<[/]w:style>`)
      : /<w:style [^>]*w:type="table"[^>]*w:default="1"[^>]*>([^]*?)<[/]w:style>/;
    const st = re.exec(styles)?.[1];
    if (st === undefined) return id ? 'some' : 'none'; // stil necunoscut: mai bine cu borduri
    const own = tblBorders(st.split('<w:tblStylePr')[0]);
    if (own) return own;
    id = /<w:basedOn w:val="([^"]*)"/.exec(st)?.[1];
    if (!id) return 'none';
  }
  return 'some';
}

// Tabelele fără borduri (scrise așa sau după stilul lor): semn invizibil în prima celulă, care devine apoi data-borders="none" pe <table>.
// Tabelele cu borduri puse pe celule (w:tcBorders) rămân cu borduri.
function markBorderlessTables(xml: string, styles: string, onFound: () => void): string {
  return xml.replace(/<w:tbl>(<w:tblPr>([^]*?)<[/]w:tblPr>)([^]*?)<[/]w:p>/g, (m, pr: string, inner: string, rest: string, at: number) => {
    const own = tblBorders(inner);
    const kind = own ?? styleBorders(styles, /<w:tblStyle w:val="([^"]*)"/.exec(inner)?.[1]);
    if (kind !== 'none') return m;
    const end = xml.indexOf('</w:tbl>', at);
    const whole = xml.slice(at, end < 0 ? undefined : end);
    if (/<w:tcBorders>(?:(?!<[/]w:tcBorders>)[^])*w:val="(?!none"|nil")/.test(whole)) return m;
    onFound();
    return `<w:tbl>${pr}${rest}<w:r><w:t>${MARK}n${MARK}</w:t></w:r></w:p>`;
  });
}

// Mammoth nu citește spațierea rândurilor (w:spacing w:line). O punem ca semn invizibil la începutul paragrafelor cu text,
// iar după conversie devine atributul data-line-height (în „rânduri” Word, de exemplu 1.5).
/**
 * Imaginile ancorate (wp:anchor), pe care mammoth le pune în rând: semn invizibil la începutul descrierii lor (wp:docPr descr,
 * pe care mammoth o face text alternativ) cu felul așezării. Fără text în jur → în fața / în spatele textului, cu deplasarea
 * (EMU → px) și ordinea (relativeHeight); cu text în jur (pătrat, strâns, prin) → în stânga sau în dreapta, după poziție.
 */
const rawAttr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? '';
async function markFloatingImages(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml || !xml.includes('<wp:anchor')) return buffer;
  let found = false;
  const marked = xml.replace(/<wp:anchor\b([^>]*)>([\s\S]*?)<\/wp:anchor>/g, (m, attrs: string, inner: string) => {
    if (!inner.includes('<a:blip') || !/<wp:docPr\b/.test(inner)) return m;
    const off = (tag: string) => {
      const pos = new RegExp(`<wp:position${tag}\\b[^>]*>([\\s\\S]*?)</wp:position${tag}>`).exec(inner)?.[1] ?? '';
      const v = /<wp:posOffset>\s*(-?\d+)\s*</.exec(pos)?.[1];
      return { px: v ? Math.max(-4000, Math.min(4000, Math.round(Number(v) / 9525))) : 0, align: /<wp:align>\s*(\w+)\s*</.exec(pos)?.[1] ?? '' };
    };
    let code: string;
    if (/<wp:wrapNone\b/.test(inner)) {
      const h = off('H'), v = off('V');
      const z = Math.max(0, Math.min(2147483647, Number(rawAttr(attrs, 'relativeHeight')) || 0));
      code = `f${/^(1|true|on)$/i.test(rawAttr(attrs, 'behindDoc')) ? 'b' : 'f'} ${h.px} ${v.px} ${z}`;
    } else if (/<wp:wrap(Square|Tight|Through)\b/.test(inner)) {
      const h = off('H');
      code = h.align === 'right' || (!h.align && h.px > 320) ? 'fR' : 'fL';
    } else return m;
    found = true;
    const tag = MARK + code + MARK;
    return m.replace(/<wp:docPr\b([^>]*?)(\/?)>/, (_d, a: string, close: string) =>
      /\sdescr="/.test(a) ? `<wp:docPr${a.replace(/\sdescr="/, ` descr="${tag}`)}${close}>` : `<wp:docPr${a} descr="${tag}"${close}>`);
  });
  if (!found) return buffer;
  zip.file('word/document.xml', marked);
  return zip.generateAsync({ type: 'arraybuffer' });
}

/** Semnele puse de markFloatingImages devin data-align / data-dx / data-dy / data-z pe <img>; ordinea devine 1…n în fiecare grup. */
function floatingFromMarks(html: string): string {
  const re = new RegExp(`<img([^>]*?) alt="${MARK}f(?:([bf]) (-?\\d+) (-?\\d+) (\\d+)|([LR]))${MARK}([^"]*)"`, 'g');
  const zs: Record<string, number[]> = { b: [], f: [] };
  for (const m of html.matchAll(re)) if (m[2]) zs[m[2]].push(Number(m[5]));
  const rank = (mode: string, z: number) => [...new Set(zs[mode])].sort((a, b) => a - b).indexOf(z) + 1;
  return html.replace(re, (_m, pre: string, mode?: string, dx?: string, dy?: string, z?: string, side?: string, alt = '') => {
    const a = mode ? ` data-align="${mode === 'b' ? 'behind' : 'front'}"${Number(dx) ? ` data-dx="${dx}"` : ''}${Number(dy) ? ` data-dy="${dy}"` : ''} data-z="${rank(mode, Number(z))}"`
      : ` data-align="${side === 'R' ? 'wrapRight' : 'wrapLeft'}"`;
    return `<img${pre}${a}${alt ? ` alt="${alt}"` : ''}`;
  });
}

interface TableAlt { t: string; d: string }

async function markLineSpacing(buffer: ArrayBuffer, alts: TableAlt[] = []): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml || (!xml.includes('w:line=') && !xml.includes('w:before=') && !xml.includes('w:after=') && !xml.includes('w:firstLine=')
    && !xml.includes('w:hanging=') && !xml.includes('<w:shd') && !xml.includes('<w:pBdr') && !xml.includes('<w:tbl>') && !xml.includes('<w:keepNext') && !xml.includes('<w:keepLines') && !/<w:widowControl w:val="(0|false)"/.test(xml) && !xml.includes('<w:tabs>') && !xml.includes('<w:framePr') && !xml.includes('<w14:checkbox') && !xml.includes('<w:dropDownList') && !xml.includes('<w:comboBox') && !xml.includes('<w:date'))) return buffer;
  let found = false;
  let marked = markCellColors(xml, () => { found = true; });
  if (xml.includes('<w:trHeight') || xml.includes('<w:cantSplit')) marked = markRowHeights(marked, () => { found = true; });
  if (xml.includes('<w:vAlign')) marked = markCellVAlign(marked, () => { found = true; });
  if (xml.includes('<w:tcBorders>')) marked = markCellLines(marked, () => { found = true; });
  if (xml.includes('<w14:checkbox')) marked = markFormChecks(marked, () => { found = true; });
  if (xml.includes('<w:dropDownList') || xml.includes('<w:comboBox')) marked = markFormDrops(marked, () => { found = true; });
  if (xml.includes('<w:date')) marked = markFormDates(marked, () => { found = true; });
  if (xml.includes('<w:tbl>')) {
    const styles = (await zip.file('word/styles.xml')?.async('string')) ?? '';
    marked = markBorderlessTables(marked, styles, () => { found = true; });
    marked = markFitTables(marked, () => { found = true; });
    marked = markTableAlign(marked, () => { found = true; });
    if (xml.includes('<w:tblInd') || xml.includes('<w:tblCellMar')) marked = markTableSpacing(marked, () => { found = true; });
    if (xml.includes('<w:tblpPr')) marked = markFloatTables(marked, () => { found = true; });
    if (xml.includes('<w:tblCaption') || xml.includes('<w:tblDescription')) marked = markTableAlt(marked, alts, () => { found = true; });
  }
  marked = marked.replace(
    /(<w:p(?:\s[^>]*)?>\s*<w:pPr>)([\s\S]*?<\/w:pPr>)(?=(?:(?!<\/w:p>)[\s\S])*?<w:t[ >])/g,
    (m, open: string, ppr: string) => {
      const own = ppr.split('<w:rPr')[0];
      const sp = /<w:spacing\b[^>]*>/.exec(own)?.[0];
      const line = sp ? Number(attr(sp, 'line')) : 0;
      const rule = sp ? attr(sp, 'lineRule') : '';
      const pct = line && (!rule || rule === 'auto') ? Math.round((line / 240) * 100) : 0;
      let marks = pct >= 80 && pct <= 300 ? `${MARK}l${pct}${MARK}` : '';
      // Spațiul înainte / după (twips) și prima linie / agățat (twips; agățat cu minus), scrise chiar pe paragraf.
      const tw = (tag: string | undefined, n: string) => { const v = tag ? attr(tag, n) : ''; return /^-?\d+$/.test(v) ? Number(v) : null; };
      const ind = /<w:ind\b[^>]*>/.exec(own)?.[0];
      const bef = tw(sp, 'before'), aft = tw(sp, 'after');
      const hang = tw(ind, 'hanging'), fl = tw(ind, 'firstLine');
      const first = hang ? -hang : fl;
      if (bef !== null || aft !== null || first) marks += `${MARK}s${bef ?? ''}_${aft ?? ''}_${first || ''}${MARK}`;
      // Chenarul (w:pBdr cu cel puțin o latură trasă) și fundalul paragrafului (w:shd cu o culoare, nu alb).
      const bdr = /<w:pBdr>([\s\S]*?)<\/w:pBdr>/.exec(own)?.[1] ?? '';
      const box = /<w:(top|bottom|left|right)\b[^>]*w:val="(?!none"|nil")/.test(bdr);
      const look = box ? boxLookOf(bdr) : null;
      const shd = /<w:shd\b[^>]*>/.exec(own.replace(/<w:pBdr>[\s\S]*?<\/w:pBdr>/, ''))?.[0];
      const fill = shd ? (attr(shd, 'fill') ?? '').toLowerCase() : '';
      const shade = /^[0-9a-f]{6}$/.test(fill) && fill !== 'ffffff' ? fill : '';
      // Cadrul de text (w:framePr fără letrină) = casetă de text; chenarul și fundalul trec pe casetă.
      const fp = /<w:framePr\b[^>]*>/.exec(own)?.[0];
      if (fp && !/w:dropCap="(?:drop|margin)"/.test(fp)) {
        const xa = attr(fp, 'xAlign');
        const wr = attr(fp, 'wrap');
        const around = !wr || wr === 'around' || wr === 'auto';
        const code = xa === 'center' ? 'c' : xa === 'right' || xa === 'outside' ? (around ? 'R' : 'r') : around ? 'L' : 'l';
        const w = Math.round(Number(attr(fp, 'w')) / 15) || 240;
        const bc = box ? ((/w:color="([0-9A-Fa-f]{6})"/.exec(bdr)?.[1] ?? '6b6b80').toLowerCase()) : '';
        marks += `${MARK}q${code}${w}_${bc}_${shade}${MARK}`;
      } else if (box || shade) marks += `${MARK}x${box ? '1' : '0'}${shade}${look ? '~' + look : ''}${MARK}`;
      // Păstrează cu următorul / liniile împreună (w:keepNext, w:keepLines fără w:val="0").
      const on = (tag: string) => { const i = own.indexOf(`<w:${tag}`); if (i < 0) return false; const t = own.slice(i, own.indexOf('>', i)); return !t.includes('w:val="0"') && !t.includes('w:val="false"'); };
      const kn = on('keepNext'), kl = on('keepLines'), nw = /<w:widowControl w:val="(0|false)"/.test(own);
      if (kn || kl || nw) marks += `${MARK}k${kn ? '1' : '0'}${kl ? '1' : '0'}${nw ? '1' : '0'}${MARK}`;
      // Opririle de tabulator proprii (w:tabs): poziția în twips de la margine, alinierea și umplerea.
      const tabs = tabStopsFrom(own);
      if (tabs) marks += `${MARK}t${tabs}${MARK}`;
      if (!marks) return m;
      found = true;
      return `${open}${ppr}<w:r><w:t>${marks}</w:t></w:r>`;
    },
  );
  if (!found) return buffer;
  zip.file('word/document.xml', marked);
  return zip.generateAsync({ type: 'arraybuffer' });
}

/** Opririle de tabulator ale unui paragraf (w:tabs din w:pPr), ca „3.5l 15r.” (cm de la margine), sau null. */
export function tabStopsFrom(ppr: string): string | null {
  const box = /<w:tabs>([\s\S]*?)<\/w:tabs>/.exec(ppr)?.[1];
  if (!box) return null;
  const ALIGN: Record<string, string> = { left: 'l', start: 'l', num: 'l', center: 'c', right: 'r', end: 'r', decimal: 'd' };
  const LEADER: Record<string, string> = { dot: '.', middleDot: '.', hyphen: '-', underscore: '_', heavy: '_' };
  const out: string[] = [];
  for (const t of box.match(/<w:tab\b[^>]*>/g) ?? []) {
    const a = ALIGN[attr(t, 'val') ?? ''], pos = Number(attr(t, 'pos'));
    if (!a || !(pos > 0)) continue;
    out.push(`${Math.round((pos / 567) * 100) / 100}${a}${LEADER[attr(t, 'leader') ?? ''] ?? ''}`);
  }
  return out.length ? out.join(' ') : null;
}

/** Tabulatorii din text (mammoth îi scrie ca semnul Tab) devin noduri „tabChar”, ca să nu se piardă ca spații. */
export function tabsToNodes(html: string): string {
  const tab = String.fromCharCode(9);
  if (!html.includes(tab)) return html;
  return html.replace(/(^|>)([^<]+)/g, (m, a: string, t: string) => (t.includes(tab) ? a + t.split(tab).join('<span data-tab=""></span>') : m));
}

const PREDEFINED = new Set(['lt', 'gt', 'amp', 'quot', 'apos']);

/**
 * Câteva fișiere au în document.xml o declarație DOCTYPE cu entități proprii („&testent;”). Word le ignoră, dar
 * cititorul XML al lui mammoth se oprește la ele, deci le scoatem. Așa nu se citește nici vreun fișier extern (XXE).
 */
async function sanitizeXml(zip: JSZip, xml: string): Promise<ArrayBuffer | null> {
  if (!/<!DOCTYPE/i.test(xml)) return null;
  const clean = xml.replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/i, '')
    .replace(/&([A-Za-z_][\w.-]*);/g, (m, name: string) => (PREDEFINED.has(name) ? m : ''));
  zip.file('word/document.xml', clean);
  return zip.generateAsync({ type: 'arraybuffer' });
}

/** Rezerva: doar textul paragrafelor, când documentul e prea complicat pentru mammoth (de exemplu tabele în tabele, sute de niveluri). */
function plainHtml(xml: string): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const paras = xml.split(/<\/w:p>/).map((p) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''));
  return paras.filter((p) => p.trim()).map((p) => `<p>${esc(p.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'))}</p>`).join('') || '<p></p>';
}

/** Orientarea și marginile paginii, din ultima secțiune a documentului (w:sectPr). */
export interface PageLayout { header?: string; footer?: string; numbers?: boolean; numAt?: NumAt; numStyle?: NumStyle; firstPage?: FirstPage; evenPage?: EvenPage; border?: PageBorder; final?: boolean; trackLock?: boolean; restrict?: Restrict; props?: DocProps; landscape: boolean; margin: number; margins?: Margins; paper?: Paper; columns?: number; colLine?: boolean; lineNums?: LineNums; watermark?: string; watermarkColor?: string; watermarkFlat?: boolean; watermarkFont?: string; background?: string; hyphenate?: boolean }

/** Filigranul din antetul Word (forma „PowerPlusWaterMarkObject” cu text), dacă există: textul, culoarea (#rrggbb) și dacă stă drept. */
type Watermark = { watermark?: string; watermarkColor?: string; watermarkFlat?: boolean; watermarkFont?: string; watermarkImage?: string; headerImage?: string };

/** Imaginea din antet (de exemplu sigla): prima poză DrawingML (w:drawing cu a:blip) din antetul paginilor, PNG sau JPEG. */
async function readHeaderImage(zip: JSZip, docXml: string): Promise<string | undefined> {
  const docRels = (await zip.file('word/_rels/document.xml.rels')?.async('string')) ?? '';
  // Antetul obișnuit al ultimei secțiuni (headerReference w:type="default"), altfel oricare antet.
  const refs = [...docXml.matchAll(/<w:headerReference\b[^>]*>/g)].map((m) => m[0]);
  const ref = refs.filter((r) => /w:type="default"/.test(r)).pop();
  const rid = ref ? /r:id="([^"]+)"/.exec(ref)?.[1] : undefined;
  const relOf = (rels: string, id: string) => [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((x) => x[0]).find((r) => r.includes(`Id="${id}"`));
  const main = rid ? /Target="([^"]+)"/.exec(relOf(docRels, rid) ?? '')?.[1] : undefined;
  const names = main ? ['word/' + main.replace(/^[.][/]/, '').replace(/^[/]?word[/]/, '')] : Object.keys(zip.files).filter((f) => /^word[/]header[0-9]*[.]xml$/.test(f));
  for (const name of names) {
    const xml = (await zip.file(name)?.async('string')) ?? '';
    const drawing = /<w:drawing>([^]*?)<[/]w:drawing>/.exec(xml)?.[1] ?? '';
    const emb = /<a:blip\b[^>]*r:embed="([^"]+)"/.exec(drawing)?.[1];
    if (!emb) continue;
    const rels = (await zip.file(name.replace('word/', 'word/_rels/') + '.rels')?.async('string')) ?? '';
    const target = /Target="([^"]+)"/.exec(relOf(rels, emb) ?? '')?.[1];
    const ext = target ? /[.](png|jpe?g)$/i.exec(target)?.[1]?.toLowerCase() : undefined;
    const file = target && ext ? zip.file(target.startsWith('/') ? target.slice(1) : 'word/' + target.replace(/^[.][/]/, '')) : null;
    if (!file) continue;
    const img = pageHeaderImage({ headerImage: `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,` + (await file.async('base64')) } as PageSetup);
    if (img) return img;
  }
  return undefined;
}
async function readWatermark(zip: JSZip): Promise<Watermark | undefined> {
  for (const name of Object.keys(zip.files).filter((f) => /^word[/]header[0-9]*[.]xml$/.test(f))) {
    const xml = (await zip.file(name)?.async('string')) ?? '';
    const shape = /<v:shape\b[^>]*id="[^"]*WaterMark[^"]*"[^>]*>([^]*?)<[/]v:shape>/.exec(xml)?.[1] ?? '';
    const text = /<v:textpath\b[^>]*string="([^"]*)"/.exec(shape)?.[1];
    if (text) {
      const t = text.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
      if (!t) continue;
      const tag = /<v:shape\b[^>]*id="[^"]*WaterMark[^"]*"[^>]*>/.exec(xml)?.[0] ?? '';
      const fill = /fillcolor="(#[0-9a-f]{6})"/i.exec(tag)?.[1]?.toLowerCase();
      const rot = Number(/rotation:(-?[0-9.]+)/.exec(tag)?.[1] ?? 0);
      // Fontul (din stilul v:textpath), doar dacă e unul dintre cele din fereastra Pagină.
      const fam = /font-family:(?:&quot;|")?([^;&"]+)/.exec(/<v:textpath\b[^>]*>/.exec(shape)?.[0] ?? '')?.[1]?.trim() ?? '';
      const font = pageWatermarkFont({ watermarkFont: fam } as PageSetup);
      return { watermark: t.slice(0, 40), ...(fill ? { watermarkColor: fill } : {}), ...(rot % 180 === 0 ? { watermarkFlat: true } : {}), ...(font ? { watermarkFont: font } : {}) };
    }
    // Filigranul din imagine: poza VML din antet (Word îi pune în id „WordPictureWatermark”), citită din legătura antetului.
    const pic = /<v:shape\b[^>]*id="[^"]*PictureWatermark[^"]*"[^>]*>([^]*?)<[/]v:shape>/.exec(xml)?.[1] ?? '';
    const rid = /<v:imagedata\b[^>]*r:id="([^"]+)"/.exec(pic)?.[1];
    if (rid) {
      const rels = (await zip.file(name.replace('word/', 'word/_rels/') + '.rels')?.async('string')) ?? '';
      const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((x) => x[0]).find((r) => r.includes(`Id="${rid}"`));
      const target = rel ? /Target="([^"]+)"/.exec(rel)?.[1] : undefined;
      const ext = target ? /[.](png|jpe?g)$/i.exec(target)?.[1]?.toLowerCase() : undefined;
      const file = target && ext ? zip.file(target.startsWith('/') ? target.slice(1) : 'word/' + target.replace(/^[.][/]/, '')) : null;
      if (file) {
        const img = pageWatermarkImage({ watermarkImage: `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,` + (await file.async('base64')) } as PageSetup);
        if (img) return { watermarkImage: img };
      }
    }
  }
  return undefined;
}

/** Antetul și subsolul ca text pe un rând, plus dacă subsolul are numărul paginii (câmpul PAGE). */
interface HeadFoot { header: string; footer: string; numbers: boolean; numAt?: NumAt; numStyle?: NumStyle; firstPage?: FirstPage; evenPage?: EvenPage }

const PAGE_FIELD = /<w:instrText[^>]*>\s*PAGE\b|<w:fldSimple\b[^>]*w:instr="\s*PAGE\b/;
const TOTAL_FIELD = /<w:instrText[^>]*>\s*(?:NUMPAGES|SECTIONPAGES)\b|<w:fldSimple\b[^>]*w:instr="\s*(?:NUMPAGES|SECTIONPAGES)\b/;
/**
 * Unde și cum e scris numărul paginii într-un antet / subsol Word: alinierea paragrafului cu câmpul PAGE (sau câte tab-uri sunt
 * înaintea lui: unul = mijloc, două = dreapta) și cuvintele din jur („Pagina … din …”, „… / …”, doar numărul).
 */
export function numberPlace(xml: string, top: boolean): { numAt: NumAt; numStyle: NumStyle } | null {
  const para = xml.split(/<\/w:p>/).find((p) => PAGE_FIELD.test(p));
  if (!para) return null;
  const jc = /<w:jc w:val="(\w+)"/.exec(para)?.[1] ?? '';
  const before = para.slice(0, para.search(PAGE_FIELD));
  const tabs = (before.match(/<w:tab\/>|<w:ptab\b[^>]*\/>/g) ?? []).length + (before.match(/<w:t(?:\s[^>]*)?>[^<]*\t/g) ?? []).length;
  const side = jc === 'center' ? 'c' : jc === 'right' || jc === 'end' ? 'r' : tabs >= 2 ? 'r' : tabs === 1 ? 'c' : 'l';
  const words = [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(' ');
  const total = TOTAL_FIELD.test(para);
  const pageWord = /\b(?:pagina|pag\.?|page|seite|página|pagină)\b/i.test(words);
  const numStyle: NumStyle = total ? (pageWord ? 'full' : /\//.test(words) ? 'slash' : 'full') : pageWord ? 'page' : 'num';
  return { numAt: ((top ? 't' : 'b') + side) as NumAt, numStyle };
}

const unXml = (t: string) => t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Textul unui antet / subsol Word: paragrafele unite cu „ · ”, fără rezultatele câmpurilor (numărul paginii) și fără desenele de rezervă. */
export function headFootText(xml: string, top = true): { text: string; page: boolean } {
  const page = /<w:instrText[^>]*>\s*(?:PAGE|NUMPAGES|SECTIONPAGES)\b|<w:fldSimple\b[^>]*w:instr="\s*(?:PAGE|NUMPAGES|SECTIONPAGES)\b/.test(xml);
  const clean = xml
    .replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '')
    .replace(/<w:fldSimple\b[^>]*\/>/g, '')
    .replace(/<w:fldSimple\b[^>]*>[\s\S]*?<\/w:fldSimple>/g, '')
    .replace(/w:fldCharType="separate"[\s\S]*?w:fldCharType="end"/g, '');
  // Un singur paragraf fără numărul paginii: bucățile din stânga / mijloc / dreapta merg pe cele trei locuri ale antetului.
  const placed = page ? null : headFootPlaces(clean, top);
  if (placed !== null) return { text: placed, page };
  // Altfel tab-urile despart bucățile: devin „ · ”.
  const flat = clean.replace(/<w:p?tab\/>|<w:p?tab [^>]*\/>/g, '<w:t> · </w:t>');
  const paras = flat.split(/<\/w:p>/).map((p) => unXml([...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')).replace(/\s+/g, ' ').trim());
  let text = [...new Set(paras.filter(Boolean))].join(' · ');
  // „Pagina 1 din 3” / „Page 1 of 3”: rămân doar cuvintele fără numere, pe care le scoatem (numărul îl pune Suite).
  if (page) text = text.replace(/(?:^|\s|·)(?:pagina|pag\.?|page|seite|página|pagină)\s*(?:(?:din|of|von|de|\/)\s*)?(?=$|\s|·)/gi, ' ').replace(/\s*(?:din|of|\/)\s*$/i, '').replace(/\s+/g, ' ').replace(/^[\s·-]+|[\s·-]+$/g, '').trim();
  text = text.replace(/(?:\s*·\s*)+/g, ' · ').replace(/^[\s·-]+|[\s·-]+$/g, '').trim();
  return { text: text.slice(0, 200), page };
}

/**
 * Antetul dintr-un singur paragraf, pe locurile Suite („stânga⇥mijloc⇥dreapta”, vezi format.ts hfSlots): alinierea paragrafului
 * (stânga / centrat / dreapta) și tab-urile (cu tab-ul de aliniere la dreapta „ptab”, sau un singur tab spre o oprire la dreapta).
 * `null` când antetul are mai multe paragrafe (rămân unite cu „ · ”).
 */
export function headFootPlaces(xml: string, top = true): string | null {
  const paras = xml.split(/<\/w:p>/).filter((p) => /<w:t(?:\s[^>]*)?>[^<]*[^<\s][^<]*<\/w:t>/.test(p));
  if (paras.length !== 1) return paras.length ? null : '';
  const p = paras[0];
  const jc = /<w:jc w:val="(\w+)"/.exec(p)?.[1] ?? '';
  const stops = [...p.matchAll(/<w:tab w:val="(\w+)"/g)].map((m) => m[1]).filter((v) => v !== 'clear');
  // Textul, cu un semn pentru fiecare tab: „R” = tab de aliniere la dreapta, „C” = la mijloc, „T” = tab obișnuit.
  const SEP = String.fromCharCode(1);
  const body = p.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, '')
    .replace(/<w:ptab\b[^>]*w:alignment="(\w+)"[^>]*\/>/g, (_m, a: string) => `<w:t>${SEP}${a === 'right' ? 'R' : a === 'center' ? 'C' : 'T'}</w:t>`)
    .replace(/<w:tab\/>|<w:tab [^>]*\/>/g, `<w:t>${SEP}T</w:t>`);
  const raw = unXml([...body.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''));
  const bits = raw.split(SEP);
  const parts = ['', '', ''];
  let at = 0;
  bits.forEach((b, i) => {
    let t = b;
    if (i > 0) {
      const kind = t[0];
      t = t.slice(1);
      // Un singur tab spre o oprire la dreapta (fără oprire la mijloc) sare direct în dreapta.
      at = kind === 'R' ? 2 : kind === 'C' ? 1 : Math.min(2, at + (stops.includes('right') && !stops.includes('center') ? 2 : 1));
    }
    parts[at] = (parts[at] ? parts[at] + ' ' : '') + t.replace(/\s+/g, ' ').trim();
  });
  // Fără tab-uri contează alinierea paragrafului.
  if (bits.length === 1) {
    const t = parts[0];
    parts[0] = '';
    parts[jc === 'center' ? 1 : jc === 'right' || jc === 'end' ? 2 : 0] = t;
  }
  const [l, c, r] = parts.map((x) => x.slice(0, 120));
  if (!l && !c && !r) return '';
  // Locul obișnuit nu are nevoie de tab-uri: antetul stă la mijloc, subsolul în stânga.
  if (top && !l && !r) return c;
  if (!top && !c && !r) return l;
  return r ? `${l}\t${c}\t${r}` : c ? `${l}\t${c}` : `${l}\t`;
}

/**
 * Antetul și subsolul din ultima secțiune (cele moștenite din secțiunile dinainte, ca în Word), și prima pagină diferită (w:titlePg).
 * Paginile pare diferite: w:evenAndOddHeaders în word/settings.xml, cu antetul / subsolul de tip „even”.
 */
async function readHeadFoot(zip: JSZip, docXml: string): Promise<HeadFoot | undefined> {
  const rels = (await zip.file('word/_rels/document.xml.rels')?.async('string')) ?? '';
  const target = (id: string) => {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${id}"`));
    const t = rel ? /Target="([^"]+)"/.exec(rel)?.[1] ?? '' : '';
    return t ? (t.startsWith('/') ? t.slice(1) : 'word/' + t) : '';
  };
  const refs: Record<string, string> = {};
  const sects = [...docXml.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)].map((m) => m[0]);
  for (const s of sects) {
    for (const m of s.matchAll(/<w:(header|footer)Reference\b[^>]*>/g)) {
      const type = attr(m[0], 'type') || 'default';
      const id = /\br:id="([^"]+)"/.exec(m[0])?.[1];
      if (id && !refs[`${m[1]}-${type}`]) refs[`${m[1]}-${type}`] = id;
    }
  }
  const last = sects[sects.length - 1] ?? '';
  const titlePg = /<w:titlePg(?: w:val="(?:1|true|on)")? ?\/>/.test(last);
  const read = async (key: string) => {
    const name = refs[key] ? target(refs[key]) : '';
    const xml = name ? await zip.file(name)?.async('string') : undefined;
    return xml ? headFootText(xml, key.startsWith('header')) : { text: '', page: false };
  };
  const h = await read('header-default'), f = await read('footer-default');
  const out: HeadFoot = { header: h.text, footer: f.text, numbers: f.page || h.page };
  // Locul și forma numărului (lipsă = jos în dreapta, „Pagina 1 din 3”, ca la noi).
  const raw = async (key: string) => { const name = refs[key] ? target(refs[key]) : ''; return (name && (await zip.file(name)?.async('string'))) || ''; };
  const place = numberPlace(await raw('footer-default'), false) ?? numberPlace(await raw('header-default'), true);
  if (place && place.numAt !== 'br') out.numAt = place.numAt;
  if (place && place.numStyle !== 'full') out.numStyle = place.numStyle;
  if (titlePg) {
    const fh = await read('header-first'), ff = await read('footer-first');
    out.firstPage = { header: fh.text, footer: ff.text, numbers: ff.page || fh.page };
  }
  const settings = (await zip.file('word/settings.xml')?.async('string')) ?? '';
  if (/<w:evenAndOddHeaders(?: w:val="(?:1|true|on)")? ?\/>/.test(settings) && (refs['header-even'] || refs['footer-even'])) {
    const eh = await read('header-even'), ef = await read('footer-even');
    out.evenPage = { header: eh.text, footer: ef.text };
  }
  return out.header || out.footer || out.numbers || out.firstPage || out.evenPage ? out : undefined;
}

const withHeadFoot = (l: PageLayout | undefined, hf: HeadFoot | undefined): PageLayout | undefined =>
  (hf ? { ...(l ?? { landscape: false, margin: 20 }), ...hf } : l);
const withWatermark = (l: PageLayout | undefined, watermark: Watermark | undefined): PageLayout | undefined =>
  (watermark ? { ...(l ?? { landscape: false, margin: 20 }), ...watermark } : l);
const withProps = (l: PageLayout | undefined, props: DocProps | undefined): PageLayout | undefined =>
  (props ? { ...(l ?? { landscape: false, margin: 20 }), props } : l);
const withLock = (l: PageLayout | undefined, lock: boolean, restrict?: Restrict): PageLayout | undefined =>
  (lock || restrict ? { ...(l ?? { landscape: false, margin: 20 }), ...(lock ? { trackLock: true } : {}), ...(restrict ? { restrict } : {}) } : l);
const withFinal = (l: PageLayout | undefined, final: boolean): PageLayout | undefined =>
  (final ? { ...(l ?? { landscape: false, margin: 20 }), final } : l);
// Despărțirea automată în silabe: w:autoHyphenation în settings.xml.
const withHyph = (l: PageLayout | undefined, settings: string): PageLayout | undefined =>
  (/<w:autoHyphenation(?: w:val="(?:1|true|on)")? ?\/>/.test(settings) ? { ...(l ?? { landscape: false, margin: 20 }), hyphenate: true } : l);

/** Proprietățile documentului din docProps/core.xml (titlu, subiect, autor, cuvinte cheie); autorul „Suite” e cel pus de noi când lipsește. */
async function readCoreProps(zip: JSZip): Promise<DocProps | undefined> {
  const xml = await zip.file('docProps/core.xml')?.async('string');
  if (!xml) return undefined;
  const get = (tag: string) => {
    const m = new RegExp('<' + tag + '(?: [^>]*)?>([^<]*)<').exec(xml);
    return m ? m[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '';
  };
  return docProps({ props: { title: get('dc:title'), subject: get('dc:subject'), author: ['Suite', 'Cyber Office Studio'].includes(get('dc:creator') ?? '') ? '' : get('dc:creator'), keywords: get('cp:keywords') } });
}

/**
 * Letrina din Word: prima literă stă într-un paragraf separat, cu cadru w:dropCap. O mutăm la începutul paragrafului următor,
 * fără mărimea ei mare, și punem semnul „d”, din care paragraful primește data-dropcap.
 */
function mergeDropCaps(xml: string): string {
  if (!xml.includes('w:dropCap=')) return xml;
  const para = /<w:p(?:\s[^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<w:framePr\b[^>]*w:dropCap="(?:drop|margin)"(?:(?!<\/w:p>)[\s\S])*?<\/w:p>(\s*)(<w:p(?:\s[^>]*)?>)(\s*<w:pPr>(?:(?!<\/w:p>)[\s\S])*?<\/w:pPr>)?/g;
  return xml.replace(para, (whole: string, gap: string, nextOpen: string, nextPpr: string | undefined) => {
    const cap = whole.slice(0, whole.length - gap.length - nextOpen.length - (nextPpr ?? '').length);
    const runs = (cap.split('</w:pPr>')[1] ?? cap.replace(/^<w:p[^>]*>/, '')).replace(/<\/w:p>$/, '')
      .replace(/<w:(?:sz|szCs|position)\b[^>]*\/>/g, '');
    return `${gap}${nextOpen}${nextPpr ?? ''}<w:r><w:t>${MARK}d${MARK}</w:t></w:r>${runs}`;
  });
}

/**
 * Întreruperile de secțiune: un paragraf cu w:sectPr în w:pPr închide o secțiune. După el punem un paragraf-semn cu felul
 * întreruperii, pe care mammoth îl lasă ca text. Felul e w:type al secțiunii URMĂTOARE (cum începe ea față de cea de dinainte);
 * ultima secțiune e w:sectPr de la capătul corpului.
 */
function sectionMarks(xml: string, hf: SectHf[] = []): string {
  const all = [...xml.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/g)];
  if (all.length < 2) return xml;
  // Antetul / subsolul propriu: doar când secțiunea are antetul ei (headerReference) și textul e altul decât cel de până la ea.
  let prevH = hf[0]?.hdr ?? '', prevF = hf[0]?.ftr ?? '';
  const hfOf = (i: number) => {
    const x = hf[i];
    if (!x) return '';
    let out = '';
    if (x.hdr !== undefined && x.hdr !== prevH) { out += '-h' + toHex(x.hdr); prevH = x.hdr; }
    if (x.ftr !== undefined && x.ftr !== prevF) { out += '-f' + toHex(x.ftr); prevF = x.ftr; }
    return out;
  };
  const typeOf = (sect: string) => sectionKind(/<w:type w:val="([a-zA-Z]+)"/.exec(sect)?.[1]);
  // Orientarea: documentul o ia de la prima secțiune (readLayout); o secțiune culcată altfel decât ea o ține pe întrerupere.
  const first = sectLandscape(all[0][0]);
  const orientOf = (sect: string) => (sectLandscape(sect) === first ? '' : sectLandscape(sect) ? '-landscape' : '-portrait');
  // Marginile: o secțiune cu aceeași margine pe toate laturile, alta decât a primei, o ține pe întrerupere (-m25 = 2,5 cm).
  const firstMar = sectMargins(all[0][0]);
  const marginOf = (sect: string) => {
    const m = sectMargins(sect);
    if (!m || (firstMar && m.every((v, k) => Math.abs(v - firstMar[k]) < 0.6))) return '';
    const mm = sectionMargin(m[0]);
    return mm && m.every((v) => Math.abs(v - mm) < 0.6) ? `-m${mm}` : '';
  };
  let out = '', last = 0;
  all.forEach((m, i) => {
    const end = m.index! + m[0].length;
    // Doar cele din paragrafe (cel de la capăt e urmat de </w:body>), și nu cele din modificările urmărite (w:sectPrChange).
    if (i === all.length - 1 || /^\s*<\/w:body>/.test(xml.slice(end, end + 40)) || xml.slice(Math.max(0, m.index! - 40), m.index!).includes('<w:sectPrChange')) return;
    const own = hfOf(i + 1);
    const close = xml.indexOf('</w:p>', end);
    if (close < 0 || close < last) return;
    const at = close + '</w:p>'.length;
    out += xml.slice(last, at) + `<w:p><w:r><w:t>${MARK}S${typeOf(all[i + 1][0])}${orientOf(all[i + 1][0])}${marginOf(all[i + 1][0])}${own}${MARK}</w:t></w:r></w:p>`;
    last = at;
  });
  return out + xml.slice(last);
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Antetul și subsolul obișnuit (w:type="default") din fiecare w:sectPr, ca text; lipsă = secțiunea nu are referința lui. */
type SectHf = { hdr?: string; ftr?: string };
async function sectionHfTexts(zip: JSZip, docXml: string): Promise<SectHf[]> {
  const sects = [...docXml.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/g)].map((m) => m[0]);
  if (sects.length < 2) return [];
  const rels = (await zip.file('word/_rels/document.xml.rels')?.async('string')) ?? '';
  const text = async (sect: string, kind: 'header' | 'footer') => {
    const ref = [...sect.matchAll(new RegExp(`<w:${kind}Reference\\b[^>]*>`, 'g'))].map((m) => m[0]).find((r) => (attr(r, 'type') || 'default') === 'default');
    const id = ref ? /\br:id="([^"]+)"/.exec(ref)?.[1] : undefined;
    if (!id) return undefined;
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${id}"`));
    const t = rel ? /Target="([^"]+)"/.exec(rel)?.[1] ?? '' : '';
    const xml = t ? await zip.file(t.startsWith('/') ? t.slice(1) : 'word/' + t)?.async('string') : undefined;
    return xml ? sectionHf(headFootText(xml, kind === 'header').text) ?? '' : undefined;
  };
  const out: SectHf[] = [];
  for (const s of sects) out.push({ hdr: await text(s, 'header'), ftr: await text(s, 'footer') });
  return out;
}

/** Marginile secțiunii în mm (sus, jos, stânga, dreapta), din w:pgMar; lipsă = nu are. */
function sectMargins(sect: string): number[] | undefined {
  const mar = /<w:pgMar\b[^>]*>/.exec(sect)?.[0];
  if (!mar) return undefined;
  return ['top', 'bottom', 'left', 'right'].map((k) => Math.abs(Number(attr(mar, k)) || 0) / 56.7);
}

/** Secțiunea e culcată (w:orient sau pagina mai lată decât înaltă). */
function sectLandscape(sect: string): boolean {
  const sz = /<w:pgSz\b[^>]*>/.exec(sect)?.[0] ?? '';
  const w = Number(attr(sz, 'w')), h = Number(attr(sz, 'h'));
  return attr(sz, 'orient') === 'landscape' || (w > 0 && h > 0 && w > h);
}

/** „Pagină nouă înainte” pusă direct pe paragraf (w:pageBreakBefore): o scriem ca rupere de pagină la începutul lui, pe care mammoth o vede. */
function breaksBefore(xml: string, styles: Set<string>): string {
  if (!xml.includes('<w:pageBreakBefore') && !styles.size) return xml;
  return xml.replace(/<w:pPr>((?:(?!<\/w:pPr>)[\s\S])*?)<\/w:pPr>/g, (m, inner: string) => {
    // Fără modificările urmărite ale paragrafului (au un w:pPr în interior).
    if (inner.includes('w:pPrChange')) return m;
    const on = /<w:pageBreakBefore(?: w:val="(?:1|true|on)")? ?\/>/.test(inner);
    const off = /<w:pageBreakBefore w:val="(?:0|false|off)" ?\/>/.test(inner);
    const style = /<w:pStyle w:val="([^"]+)"/.exec(inner)?.[1];
    return on || (!off && style && styles.has(style)) ? m + '<w:r><w:br w:type="page"/></w:r>' : m;
  });
}

/** Stilurile de paragraf care au „Pagină nouă înainte” (și cele bazate pe ele), din styles.xml. */
async function breakStyles(zip: JSZip): Promise<Set<string>> {
  const xml = (await zip.file('word/styles.xml')?.async('string')) ?? '';
  const info = new Map<string, { base?: string; pb?: boolean }>();
  for (const m of xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    if (!/w:type="paragraph"/.test(m[1])) continue;
    const id = /w:styleId="([^"]+)"/.exec(m[1])?.[1];
    if (!id) continue;
    const pb = /<w:pageBreakBefore(?: w:val="(?:1|true|on)")? ?\/>/.test(m[2]) ? true : /<w:pageBreakBefore w:val="(?:0|false|off)"/.test(m[2]) ? false : undefined;
    info.set(id, { base: /<w:basedOn w:val="([^"]+)"/.exec(m[2])?.[1], pb });
  }
  const has = (id: string, depth = 0): boolean => {
    const s = info.get(id);
    if (!s || depth > 20) return false;
    return s.pb ?? (s.base ? has(s.base, depth + 1) : false);
  };
  return new Set([...info.keys()].filter((id) => has(id)));
}

/** Ruperea de pagină vine de la mammoth ca <hr class="suite-pb" /> în mijlocul paragrafului: îl despărțim acolo. */
function pageBreaksFromMammoth(html: string): string {
  if (!html.includes('suite-pb')) return html;
  return html
    // Ruperea de la începutul unui paragraf sau titlu („Pagină nouă înainte”): iese în fața lui, iar paragraful își păstrează atributele.
    .replace(/<(p|h[1-6])((?: [^>]*)?)><hr class="suite-pb" ?\/?>/g, '<div data-page-break=""></div><$1$2>')
    .replace(/<hr class="suite-pb" ?\/?>/g, '</p><div data-page-break=""></div><p>')
    // Paragraful din care a plecat ruperea poate avea atribute (<p data-indent="1">): perechea goală rămasă se scoate.
    .replace(/<p( [^>]*)?><\/p>(?=<div data-page-break="">)/g, '')
    .replace(/(<div data-page-break=""><\/div>)<p><\/p>/g, '$1')
    // Ca în Word, o rupere chiar la începutul documentului nu lasă o pagină goală.
    .replace(/^<div data-page-break=""><\/div>/, '');
}

function readLayout(xml: string): PageLayout | undefined {
  const sect = xml.slice(xml.lastIndexOf('<w:sectPr'));
  if (!sect.startsWith('<w:sectPr')) return undefined;
  const sz = /<w:pgSz\b[^>]*>/.exec(sect)?.[0] ?? '';
  const w = Number(attr(sz, 'w')), h = Number(attr(sz, 'h'));
  // Cu mai multe secțiuni, orientarea și marginile documentului sunt ale primei (celelalte le țin pe întreruperea lor, vezi sectionMarks).
  const firstSect = /<w:sectPr\b[\s\S]*?<\/w:sectPr>/.exec(xml)?.[0];
  const mar = /<w:pgMar\b[^>]*>/.exec(firstSect && /<w:pgMar\b/.test(firstSect) ? firstSect : sect)?.[0] ?? '';
  const landscape = firstSect && /<w:pgSz\b/.test(firstSect) ? sectLandscape(firstSect) : sectLandscape(sect);
  // Marginile în twips → mm; dacă sunt diferite pe laturi, se păstrează fiecare.
  const mm = (k: string) => { const v = Number(attr(mar, k)); return v > 0 ? v / 56.7 : 20; };
  const { margin, margins } = marginsFrom({ top: mm('top'), bottom: mm('bottom'), left: mm('left'), right: mm('right') });
  // Textul pe coloane (w:cols w:num="2"); peste trei coloane rămân trei.
  const cols = Number(attr(/<w:cols\b[^>]*>/.exec(sect)?.[0] ?? '', 'num'));
  // Culoarea paginii: <w:background w:color="FFF2CC"/> la începutul documentului (fără „auto” și fără alb).
  const bg = (attr(/<w:background\b[^>]*>/.exec(xml)?.[0] ?? '', 'color')).toLowerCase();
  const background = /^[0-9a-f]{6}$/.test(bg) && bg !== 'ffffff' ? '#' + bg : undefined;
  const paper = w > 0 && h > 0 ? paperFrom(w / 56.693, h / 56.693) : 'A4';
  // Chenarul paginii: <w:pgBorders> cu cel puțin o latură trasă.
  const pgb = /<w:pgBorders\b[\s\S]*?<\/w:pgBorders>/.exec(sect)?.[0] ?? '';
  const bv = /<w:(?:top|left|bottom|right)\b[^>]*w:val="([a-zA-Z]+)"/.exec(pgb)?.[1] ?? '';
  const bsz = Number(/<w:(?:top|left|bottom|right)\b[^>]*w:sz="(\d+)"/.exec(pgb)?.[1] ?? 0);
  const border: PageBorder | undefined = !bv || bv === 'none' || bv === 'nil' ? undefined : /double/i.test(bv) ? 'double' : /thick/i.test(bv) || bsz >= 12 ? 'thick' : 'single';
  // Numerele rândurilor: <w:lnNumType w:countBy="5" w:restart="continuous"/> (fără restart = de la 1 pe fiecare pagină).
  const ln = /<w:lnNumType\b[^>]*>/.exec(sect)?.[0];
  const lineNums = ln ? (lineNumsOf({ lineNums: { page: (attr(ln, 'restart') || 'newPage') !== 'continuous', by: Number(attr(ln, 'countBy')) || 1 } } as PageSetup) ?? {}) : undefined;
  return { ...(border ? { border } : {}), landscape, margin, ...(paper !== 'A4' ? { paper } : {}), ...(margins ? { margins } : {}), ...(cols >= 2 ? { columns: Math.min(3, cols), ...(/^(?:1|true|on)$/.test(attr(/<w:cols\b[^>]*>/.exec(sect)?.[0] ?? '', 'sep')) ? { colLine: true } : {}) } : {}), ...(lineNums ? { lineNums } : {}), ...(background ? { background } : {}) };
}

/**
 * Formele VML (rezerva din mc:Fallback a casetelor / formelor cu text) pe care mammoth nu le parcurge: ovalul, arcul,
 * curba, linia frântă și linia. Le dăm numele v:shape, ca textul din v:textbox-ul lor să ajungă în document.
 */
export function vmlTextShapes(xml: string): string {
  return /<v:(?:oval|arc|curve|polyline|line)[\s>/]/.test(xml) ? xml.replace(/<(\/?)v:(?:oval|arc|curve|polyline|line)(?=[\s>/])/g, '<$1v:shape') : xml;
}

/** Un document stricat cu mai multe w:body unul după altul: le unim, ca să nu se piardă textul de după primul. */
export function oneBody(xml: string): string {
  return xml.replace(/<\/w:body>\s*<w:body(?:\s[^>]*)?>/g, '');
}

/**
 * Graficele (w:drawing cu c:chart), pe care mammoth le sare: în locul desenului punem un semn cu numărul graficului,
 * iar după conversie semnul devine graficul nostru (chart.ts), cu datele salvate în fișier, ca să se poată schimba.
 */
async function markCharts(zip: JSZip, xml: string): Promise<{ xml: string; charts: { c: DocChart; w: number }[] }> {
  const charts: { c: DocChart; w: number }[] = [];
  if (!xml.includes('<c:chart')) return { xml, charts };
  const rels = (await zip.file('word/_rels/document.xml.rels')?.async('string')) ?? '';
  const { chartFromDoc } = await import('../slides/pptxImport');
  const found = new Map<string, { c: DocChart; w: number } | null>();
  for (const m of xml.matchAll(/<w:drawing>([\s\S]*?)<\/w:drawing>/g)) {
    const id = /<c:chart\b[^>]*\br:id="([^"]+)"/.exec(m[1])?.[1];
    if (!id || found.has(m[0])) continue;
    const rel = new RegExp(`<Relationship\\b[^>]*\\bId="${id.replace(/[^\w-]/g, '')}"[^>]*>`).exec(rels)?.[0] ?? '';
    const target = /\bTarget="([^"]+)"/.exec(rel)?.[1] ?? '';
    const path = target.startsWith('/') ? target.slice(1) : 'word/' + target.replace(/^\.\//, '');
    const part = target && await zip.file(path)?.async('string').catch(() => undefined);
    const ch = part ? chartFromDoc(new DOMParser().parseFromString(part, 'application/xml')) : null;
    const c = ch && parseChart({ t: ch.chart, title: ch.text, cells: ch.cells, pal: ch.cpal, leg: ch.cleg, lab: ch.clab, ng: ch.cng, bg: ch.cbg, ln: ch.cln, fn: ch.cfont, ink: ch.cink });
    const cx = Number(/<wp:extent\b[^>]*\bcx="(\d+)"/.exec(m[1])?.[1]);
    found.set(m[0], c ? { c, w: cx ? Math.max(120, Math.min(900, Math.round(cx / 9525))) : DOC_CHART_W } : null);
  }
  const out = xml.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, (m) => {
    const f = found.get(m);
    if (!f) return m;
    charts.push(f);
    return `<w:t>${MARK}g${charts.length - 1}${MARK}</w:t>`;
  });
  return { xml: out, charts };
}

/** Semnele puse de markCharts devin imaginea graficului (PNG; SVG dacă desenul nu reușește) cu descrierea lui în data-chart. */
async function chartsFromMarks(html: string, charts: { c: DocChart; w: number }[]): Promise<string> {
  if (!charts.length) return html;
  const at = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const imgs = await Promise.all(charts.map(async ({ c, w }) => {
    const src = await chartToPng(c).catch(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(chartSvgOf(c)));
    return `<img src="${at(src)}" alt="${at(chartAlt(c))}" width="${w}" data-chart="${at(JSON.stringify(c))}" />`;
  }));
  return html.replace(new RegExp(`${MARK}g(\\d+)${MARK}`, 'g'), (_m, n: string) => imgs[Number(n)] ?? '');
}

/**
 * Ecuațiile (m:oMath, m:oMathPara), pe care mammoth le sare: în locul lor punem un semn cu numărul ecuației, iar după conversie
 * semnul devine ecuația Suite (omml.ts → equation.ts), desenată din textul ei, care se poate schimba cu ✎ Ecuație.
 */
function markMath(xml: string, root: string): { xml: string; eqs: string[] } {
  const eqs: string[] = [];
  if (!xml.includes('<m:oMath')) return { xml, eqs };
  const ns = [...root.matchAll(/\sxmlns:\w+="[^"]*"/g)].map((m) => m[0]).join('');
  const mathNs = ns.includes('xmlns:m=') ? '' : ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';
  const one = (frag: string): string | null => {
    const doc = new DOMParser().parseFromString(`<x${ns}${mathNs}>${frag}</x>`, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return null;
    const el = doc.documentElement.firstElementChild;
    return el ? ommlToEquation(el) : null;
  };
  const mark = (frag: string): string | null => {
    const src = one(frag);
    if (!src) return null;
    eqs.push(src);
    return `<w:r><w:t>${MARK}e${eqs.length - 1}${MARK}</w:t></w:r>`;
  };
  // Un m:oMathPara are câte o ecuație pe rând: fiecare devine ecuația ei, cu rând nou între ele.
  const out = xml.replace(/<m:oMathPara\b[\s\S]*?<\/m:oMathPara>/g, (para) => {
    const runs = [...para.matchAll(/<m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>/g)].map((m) => mark(m[0])).filter((r): r is string => !!r);
    return runs.length ? runs.join('<w:r><w:br/></w:r>') : para;
  }).replace(/<m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>/g, (m) => mark(m) ?? m);
  return { xml: out, eqs };
}

/** Semnele puse de markMath devin imaginea ecuației, cu textul ei în data-equation; dacă desenul nu reușește, rămâne textul. */
async function mathFromMarks(html: string, eqs: string[]): Promise<string> {
  if (!eqs.length) return html;
  const at = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const { equationAlt, equationToPng } = await import('./equation');
  const imgs = await Promise.all(eqs.map(async (src) => {
    try {
      const res = await equationToPng({ src });
      return `<img src="${at(res.src)}" width="${Math.round(res.w)}" alt="${at(equationAlt({ src }))}" data-equation="${at(JSON.stringify({ src }))}" />`;
    } catch { return at(src).replace(/>/g, '&gt;'); }
  }));
  return html.replace(new RegExp(`${MARK}e(\\d+)${MARK}`, 'g'), (_m, n: string) => imgs[Number(n)] ?? '');
}

export async function docxToHtml(data: Uint8Array): Promise<{ html: string; warnings: number; comments: ImportedComment[]; changes: ImportedChange[]; simplified?: boolean; repaired?: boolean; signers?: import('../xmlSig').XmlSigCheck[]; layout?: PageLayout }> {
  const zip = await openOfficeZip(data, 'docx', 'Fișierul nu este un document .docx valid sau e stricat.');
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (docXml === undefined) throw new Error('Fișierul nu este un document .docx: lipsește textul documentului.');
  const repaired = isRepaired(zip);
  const signers = await officeSigners(zip).catch(() => undefined);
  const wm0 = await readWatermark(zip).catch(() => undefined);
  const headerImage = await readHeaderImage(zip, docXml).catch(() => undefined);
  const watermark = headerImage ? { ...(wm0 ?? {}), headerImage } : wm0;
  const props0 = await readCoreProps(zip).catch(() => undefined);
  const headFoot = await readHeadFoot(zip, docXml).catch(() => undefined);
  // „Marcat ca final” din Word: _MarkAsFinal = adevărat în docProps/custom.xml.
  const custom = (await zip.file('docProps/custom.xml')?.async('string').catch(() => '')) ?? '';
  const final = /name="_MarkAsFinal"[^>]*>[ \t\r\n]*<vt:(?:bool|lpwstr)>[ \t\r\n]*(?:true|1)[ \t\r\n]*</i.test(custom);
  // Clasificarea (Public / Uz general / Confidențial / Strict confidențial), scrisă de noi în docProps/custom.xml.
  const label = labelFromCustom(custom);
  const props = label ? { ...(props0 ?? {}), label } : props0;
  // Urmărirea blocată (Revizuire → Blocare urmărire): w:documentProtection w:edit="trackedChanges" cu protecția pornită.
  const settingsXml = (await zip.file('word/settings.xml')?.async('string').catch(() => '')) ?? '';
  const prot = /<w:documentProtection\b[^>]*>/.exec(settingsXml)?.[0] ?? '';
  const enforced = /w:enforcement="(?:1|true|on)"/.test(prot);
  const trackLock = /w:edit="trackedChanges"/.test(prot) && enforced;
  // Restricționarea editării (doar citire / doar comentarii). Parola se păstrează doar în felul nou (algorithmName + hashValue);
  // hash-ul vechi al lui Word (cryptProviderType) nu se poate verifica, deci protecția se oprește atunci fără parolă.
  const editKind = /w:edit="(readOnly|comments)"/.exec(prot)?.[1];
  const protAttr = (n: string) => new RegExp(`w:${n}="([^"]*)"`).exec(prot)?.[1];
  const protPw = sheetPwFrom({ algorithmName: protAttr('algorithmName') ?? '', hashValue: protAttr('hashValue') ?? '', saltValue: protAttr('saltValue') ?? '', spinCount: protAttr('spinCount') ?? '0' });
  const restrict: Restrict | undefined = enforced && editKind ? { mode: editKind === 'readOnly' ? 'read' : 'comments', ...(protPw?.alg ? { pw: protPw } : {}) } : undefined;
  const body = oneBody(docXml);
  const charted = await markCharts(zip, body).catch(() => ({ xml: body, charts: [] as { c: DocChart; w: number }[] }));
  let mathed: { xml: string; eqs: string[] } = { xml: charted.xml, eqs: [] };
  try { mathed = markMath(charted.xml, /<w:document\b[^>]*>/.exec(docXml)?.[0] ?? ''); } catch { /* ecuațiile rămân sărite, ca înainte */ }
  const withBreaks = mergeDropCaps(breaksBefore(sectionMarks(vmlTextShapes(mathed.xml), await sectionHfTexts(zip, docXml).catch(() => [])), await breakStyles(zip).catch(() => new Set<string>())));
  if (withBreaks !== docXml) zip.file('word/document.xml', withBreaks);
  let buffer = (await sanitizeXml(zip, withBreaks))
    ?? (withBreaks !== docXml || needsRewrite(zip) ? await zip.generateAsync({ type: 'arraybuffer' }) : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  let comments: ImportedComment[] = [];
  let changes: ImportedChange[] = [];
  const tableAlts: TableAlt[] = [];
  try {
    ({ buffer, comments, changes } = await markRevisions(buffer));
  } catch {
    // Dacă nu reușim, importăm fără comentarii și modificări.
  }
  try {
    buffer = await markLineSpacing(buffer, tableAlts);
  } catch {
    // Dacă nu reușim, importăm fără spațierea rândurilor.
  }
  try {
    buffer = await markFloatingImages(buffer);
  } catch {
    // Dacă nu reușim, imaginile ancorate rămân în rând.
  }
  try {
    // Câmpurile cunoscute (autor, titlu, data, numărul de pagini…) rămân câmpuri (field.ts).
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')?.async('string');
    if (xml && (xml.includes('w:fldCharType') || xml.includes('<w:fldSimple'))) {
      const marked = markFieldsXml(xml, MARK);
      if (marked !== xml) { zip.file('word/document.xml', marked); buffer = await zip.generateAsync({ type: 'arraybuffer' }); }
    }
  } catch {
    // Dacă nu reușim, câmpurile rămân text obișnuit.
  }
  let xmlRuns: XmlRun[] = [];
  try {
    xmlRuns = await readXmlRuns(buffer);
  } catch {
    // Dacă nu reușim, importăm fără culori.
  }
  // Limba în care e scrisă cea mai mare parte a textului (după lungime): ea nu se mai pune pe fiecare bucată.
  const langLen = new Map<string, number>();
  for (const r of xmlRuns) langLen.set(r.lang ?? '', (langLen.get(r.lang ?? '') ?? 0) + r.text.length); // "" = fără limbă (a documentului)
  const mainLang = [...langLen].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Mammoth citește lista de stiluri abia după transformDocument, așa că putem adăuga reguli noi aici:
  // fiecare combinație de font/mărime/culoare primește un stil al ei, care devine <span class="suite-r-N">.
  const styleMap = [...STYLE_MAP];
  const runStyles: string[] = [];
  const styleIndex = new Map<string, number>();
  let xi = 0;

  const formatRun = (run: MNode) => {
    const css: string[] = [];
    if (run.font) css.push(`font-family: ${cssText(run.font)}`);
    if (run.fontSize) css.push(`font-size: ${run.fontSize}pt`);
    const text = runText(run);
    let xr: XmlRun | null = null;
    if (text) {
      // Căutăm rulajul potrivit puțin mai înainte, în caz că am sărit peste ceva.
      for (let k = xi; k < Math.min(xmlRuns.length, xi + 30); k++) {
        if (xmlRuns[k].text === text) { xr = xmlRuns[k]; xi = k + 1; break; }
      }
    }
    if (xr?.color && xr.color !== '#000000') css.push(`color: ${xr.color}`);
    if (xr?.smallCaps) css.push('font-variant: small-caps');
    if (xr?.caps) css.push('text-transform: uppercase');
    if (xr?.effect) css.push(effectCss(xr.effect));
    if (xr?.lig) css.push(ligaturesCss(xr.lig));
    // Limba de verificare: doar cea diferită de limba cea mai folosită în document (și de română); „nu verifica” mereu.
    if (xr?.noProof) css.push('--proof-lang: none');
    else if (xr?.lang && xr.lang !== mainLang && !/^ro(?:-RO)?$/i.test(xr.lang)) css.push(`--proof-lang: ${xr.lang}`);
    if (xr?.spacing) css.push(`letter-spacing: ${Math.round(xr.spacing * 100) / 100}pt`);
    // Sublinierea cu stil sau culoare (mammoth o vede doar simplă): o scriem în CSS, iar <u>-ul lui mammoth nu mai e nevoie.
    if (xr?.uStyle && (xr.uStyle !== 'single' || xr.uColor)) {
      css.push(`text-decoration: underline${xr.uStyle === 'thick' ? ' 2px' : xr.uStyle === 'single' ? '' : ' ' + xr.uStyle}${xr.uColor ? ' ' + xr.uColor : ''}`);
      run.isUnderline = false;
    }
    const mark = (run.highlight && HIGHLIGHT[run.highlight]) || (xr?.shade && xr.shade !== '#ffffff' ? xr.shade : null);
    if (!css.length && !mark) return;
    let key = css.join('; ');
    if (mark) key += `|${mark}`;
    let n = styleIndex.get(key);
    if (n === undefined) {
      n = runStyles.length;
      runStyles.push(key);
      styleIndex.set(key, n);
      styleMap.unshift(`r[style-name='suite-r-${n}'] => span.suite-r-${n}`);
    }
    run.styleName = `suite-r-${n}`;
  };

  const walk = (node: MNode) => {
    if (node.type === 'run') formatRun(node);
    if (node.type === 'paragraph' && (node.alignment || node.indent?.start || node.indent?.end)) {
      // Retragerea de la stânga, în trepte de 1,25 cm (709 twips); listele au retragerea lor.
      // La paragrafele agățate, retragerea din Word include și partea agățată (prima linie stă la start − hanging).
      const base = (Number(node.indent?.start) || 0) - (Number(node.indent?.hanging) || 0);
      // Treptele pot fi fracționare (o retragere de 2 cm = 1,6 trepte), ca să rămână centimetrii exacți.
      const steps = node.numbering ? 0 : Math.min(8, Math.max(0, Math.round((base / 709) * 100) / 100));
      // Retragerea la dreapta, în cm.
      const right = Math.min(15, Math.max(0, Math.round(((Number(node.indent?.end) || 0) / 567) * 100) / 100));
      const code = (ALIGN_CODE[ALIGN[node.alignment ?? ''] ?? ''] ?? '') + (steps > 0 ? `i${steps}` : '') + (right > 0 ? `r${right}` : '');
      // Pentru alinieri punem un semn la începutul paragrafului (nu atingem stilul, ca să rămână titlurile).
      if (code) node.children = [{ type: 'run', children: [{ type: 'text', value: MARK + code + MARK }] }, ...(node.children ?? [])];
    }
    node.children?.forEach(walk);
  };

  let res: MammothResult;
  try {
    res = await mammoth.convertToHtml(
      { arrayBuffer: buffer },
      { styleMap, transformDocument: (doc: MNode) => { walk(doc); return doc; } },
    );
  } catch {
    return { html: plainHtml(docXml), warnings: 1, comments: [], changes: [], simplified: true, repaired, ...(signers ? { signers } : {}), layout: withHyph(withHeadFoot(withLock(withFinal(withProps(withWatermark(readLayout(docXml), watermark), props), final), trackLock, restrict), headFoot), settingsXml) };
  }

  let html = res.value
    .replace(/<span class="suite-r-(\d+)">/g, (_m, n: string) => {
      const [css, mark] = runStyles[Number(n)].split('|');
      const span = css ? `<span style="${css}">` : '<span>';
      return mark ? `${span}<mark data-color="${mark}" style="background-color: ${mark}">` : span;
    });
  // Desenele .wmf / .emf (mammoth le lasă ca data: URL pe care fereastra nu le poate arăta) devin poze PNG.
  html = await htmlWithMetafiles(html);
  // Închidem și <mark> acolo unde l-am deschis: refacem închiderile pe rând.
  html = closeMarks(html);
  html = html.replace(
    new RegExp(`<(p|h[1-6]|li)>((?:<[^>]+>)*)${MARK}([crj]?)(?:i(\\d+(?:\\.\\d+)?))?(?:r(\\d+(?:\\.\\d+)?))?${MARK}`, 'g'),
    (_m, tag: string, open: string, code: string, ind?: string, right?: string) =>
      `<${tag}${code ? ` style="text-align: ${CODE_ALIGN[code]}"` : ''}${ind ? ` data-indent="${ind}"` : ''}${right ? ` data-indent-right="${right}"` : ''}>${open}`,
  );
  html = html.replace(
    new RegExp(`<(p|h[1-6]|li)( [^>]*)?>((?:<[^>]+>)*)${MARK}l(\\d{2,3})${MARK}`, 'g'),
    (_m, tag: string, attrs: string | undefined, open: string, pct: string) =>
      `<${tag}${attrs ?? ''} data-line-height="${Number(pct) / 100}">${open}`,
  );
  html = html.replace(
    new RegExp(`<(p|h[1-6]|li)( [^>]*)?>((?:<[^>]+>)*)${MARK}s(-?\\d*)_(-?\\d*)_(-?\\d*)${MARK}`, 'g'),
    (_m, tag: string, attrs: string | undefined, open: string, bef: string, aft: string, first: string) => {
      const pt = (v: string) => Math.round((Number(v) / 20) * 100) / 100;
      // Listele au retragerea lor: la ele păstrăm doar spațierea.
      const fl = first && tag !== 'li' ? Math.max(-10, Math.min(10, Math.round((Number(first) / 567) * 100) / 100)) : 0;
      return `<${tag}${attrs ?? ''}${bef ? ` data-space-before="${pt(bef)}"` : ''}${aft ? ` data-space-after="${pt(aft)}"` : ''}${fl ? ` data-first-line="${fl}"` : ''}>${open}`;
    },
  );
  html = html.replace(
    new RegExp(`<(p|h[1-6]|li)( [^>]*)?>((?:<[^>]+>)*)${MARK}x([01])([0-9a-f]{6})?(?:~([a-z]+-[a-z]+-[0-9a-f]{6}))?${MARK}`, 'g'),
    (_m, tag: string, attrs: string | undefined, open: string, box: string, shade?: string, look?: string) =>
      `<${tag}${attrs ?? ''}${box === '1' ? ' data-box="1"' : ''}${box === '1' && look ? ` data-box-look="${look}"` : ''}${shade ? ` data-shade="#${shade}"` : ''}>${open}`,
  );
  html = textBoxesFromMarks(html);
  html = floatingFromMarks(html);
  html = await chartsFromMarks(html, charted.charts);
  html = await mathFromMarks(html, mathed.eqs);
  html = html.replace(
    new RegExp(`<(td|th)([^>]*)>((?:(?!<t[dh][ >])[^])*?)${MARK}b([0-9a-f]{6})${MARK}`, 'g'),
    (_m, tag: string, attrs: string, inner: string, hex: string) => `<${tag}${attrs} data-bg="#${hex}">${inner}`,
  );
  html = html.replace(new RegExp(`${MARK}y([01])${MARK}`, 'g'), (_m, v: string) => `<span data-form-check="${v}"></span>`);
  html = html.replace(new RegExp(`${MARK}h([0-9-]*)${MARK}`, 'g'), (_m, v: string) => `<span data-form-date="${cleanDate(v)}"></span>`);
  html = html.replace(new RegExp(`${MARK}j([A-Za-z0-9%._-]*)${MARK}`, 'g'), (_m, code: string) => {
    const d = decodeDrop(code);
    const at = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return d ? `<span data-form-drop="${at(d.value)}" data-items="${at(d.items.join(String.fromCharCode(10)))}"></span>` : '';
  });
  html = html.replace(
    new RegExp(`<(td|th)([^>]*)>((?:(?!<t[dh][ >])[^])*?)${MARK}c([a-z0-9_|]+)${MARK}`, 'g'),
    (_m, tag: string, attrs: string, inner: string, v: string) => `<${tag}${attrs} data-cl="${v.replace(/_/g, ' #')}">${inner}`,
  );
  html = html.replace(
    new RegExp(`<(td|th)([^>]*)>((?:(?!<t[dh][ >])[^])*?)${MARK}v([mb])${MARK}`, 'g'),
    (_m, tag: string, attrs: string, inner: string, v: string) => `<${tag}${attrs} data-valign="${v === 'm' ? 'middle' : 'bottom'}">${inner}`,
  );
  html = html.replace(
    new RegExp(`<tr>((?:(?!<tr[ >])[^])*?)${MARK}r([0-9]+)${MARK}`, 'g'),
    (_m, inner: string, h: string) => `<tr data-row-height="${Number(h) / 100}">${inner}`,
  );
  html = html.replace(
    new RegExp(`<tr((?: [^>]*)?)>((?:(?!<tr[ >])[^])*?)${MARK}s${MARK}`, 'g'),
    (_m, attrs: string, inner: string) => `<tr${attrs} data-no-split="">${inner}`,
  );
  html = html.replace(
    new RegExp(`<table>((?:(?!<table[ >])[^])*?)${MARK}n${MARK}`, 'g'),
    (_m, inner: string) => `<table data-borders="none">${inner}`,
  );
  html = html.replace(
    new RegExp(`<table((?: [^>]*)?)>((?:(?!<table[ >])[^])*?)${MARK}f${MARK}`, 'g'),
    (_m, attrs: string, inner: string) => `<table${attrs} data-fit="content">${inner}`,
  );
  html = html.replace(
    new RegExp(`<table((?: [^>]*)?)>((?:(?!<table[ >])[^])*?)${MARK}a([cr])${MARK}`, 'g'),
    (_m, attrs: string, inner: string, a: string) => `<table${attrs} data-align="${a === 'c' ? 'center' : 'right'}">${inner}`,
  );
  html = html.replace(
    new RegExp(`<table((?: [^>]*)?)>((?:(?!<table[ >])[^])*?)${MARK}([ip])([0-9]+)${MARK}`, 'g'),
    (_m, attrs: string, inner: string, k: string, v: string) => `<table${attrs} data-${k === 'i' ? 'indent' : 'pad'}="${Number(v) / 100}">${inner}`,
  );
  html = html.replace(
    new RegExp(`<table((?: [^>]*)?)>((?:(?!<table[ >])[^])*?)${MARK}([ip])([0-9]+)${MARK}`, 'g'),
    (_m, attrs: string, inner: string, k: string, v: string) => `<table${attrs} data-${k === 'i' ? 'indent' : 'pad'}="${Number(v) / 100}">${inner}`,
  );
  html = html.replace(
    new RegExp(`<table((?: [^>]*)?)>((?:(?!<table[ >])[^])*?)${MARK}w([lcr])${MARK}`, 'g'),
    (_m, attrs: string, inner: string, x: string) => `<table${attrs} data-wrap="around"${x !== 'l' && !attrs.includes('data-align') ? ` data-align="${x === 'c' ? 'center' : 'right'}"` : ''}>${inner}`,
  );
  const attrEsc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(
    new RegExp(`<table((?: [^>]*)?)>((?:(?!<table[ >])[^])*?)${MARK}d([0-9]+)${MARK}`, 'g'),
    (_m, attrs: string, inner: string, n: string) => {
      const a = tableAlts[Number(n)];
      return `<table${attrs}${a?.t ? ` data-alt-title="${attrEsc(a.t)}"` : ''}${a?.d ? ` data-alt-desc="${attrEsc(a.d)}"` : ''}>${inner}`;
    },
  );
  html = html.replace(
    new RegExp(`<(p|h[1-6]|li)( [^>]*)?>((?:<[^>]+>)*)${MARK}k([01])([01])([01])${MARK}`, 'g'),
    (_m, tag: string, attrs: string | undefined, open: string, kn: string, kl: string, nw: string) =>
      `<${tag}${attrs ?? ''}${kn === '1' ? ' data-keep-next=""' : ''}${kl === '1' ? ' data-keep-lines=""' : ''}${nw === '1' ? ' data-no-widow=""' : ''}>${open}`,
  );
  html = html.replace(
    new RegExp(`<(p|h[1-6])( [^>]*)?>((?:<[^>]+>)*)${MARK}t([0-9.lcrd _-]+)${MARK}`, 'g'),
    (_m, tag: string, attrs: string | undefined, open: string, tabs: string) => `<${tag}${attrs ?? ''} data-tabs="${tabs}">${open}`,
  );
  // Letrina: semnul „d” pus de mergeDropCaps.
  html = html.replace(
    new RegExp(`<(p)( [^>]*)?>((?:<[^>]+>)*)${MARK}d${MARK}`, 'g'),
    (_m, tag: string, attrs: string | undefined, open: string) => `<${tag}${attrs ?? ''} data-dropcap="">${open}`,
  );
  // Întreruperile de secțiune: paragraful-semn pus de sectionMarks.
  html = html.replace(new RegExp(`<p>${MARK}S([a-zA-Z]+)(?:-(landscape|portrait))?(?:-m([0-9]+))?(?:-h([0-9a-f]*))?(?:-f([0-9a-f]*))?${MARK}</p>`, 'g'), (_m, k: string, o?: string, mm?: string, h?: string, f?: string) => `<div data-section-break="${sectionKind(k)}"${sectionOrient(o) ? ` data-orient="${sectionOrient(o)}"` : ''}${sectionMargin(mm) ? ` data-margin="${sectionMargin(mm)}"` : ''}${h !== undefined ? ` data-hdr="${escAttr(fromHex(h))}"` : ''}${f !== undefined ? ` data-ftr="${escAttr(fromHex(f))}"` : ''}></div>`);
  html = fieldsFromMarks(html, MARK);
  html = html.split(MARK).join('');
  html = tabsToNodes(html);
  html = footnotesFromMammoth(html);
  html = captionsFromHtml(html);
  html = pageBreaksFromMammoth(html);
  // Sfârșitul de coloană vine la fel, ca <hr class="suite-cb" /> în paragraf: paragraful se desparte acolo.
  if (html.includes('suite-cb')) {
    html = html
      .replace(/<(p|h[1-6])((?: [^>]*)?)><hr class="suite-cb" ?\/?>/g, '<div data-column-break=""></div><$1$2>')
      .replace(/<hr class="suite-cb" ?\/?>/g, '</p><div data-column-break=""></div><p>')
      .replace(/<p( [^>]*)?><\/p>(?=<div data-column-break="">)/g, '')
      .replace(/(<div data-column-break=""><\/div>)<p><\/p>/g, '$1');
  }
  return { html: html || '<p></p>', warnings: res.messages.filter((m) => m.type === 'warning').length, comments, changes, repaired, ...(signers ? { signers } : {}), layout: withHyph(withHeadFoot(withLock(withFinal(withProps(withWatermark(readLayout(docXml), watermark), props), final), trackLock, restrict), headFoot), settingsXml) };
}

// Fiecare <span ...><mark ...> deschis de noi trebuie închis ca </mark></span>.
function closeMarks(html: string): string {
  const stack: boolean[] = [];
  return html.replace(/<span\b[^>]*>(<mark [^>]*>)?|<\/span>/g, (m, mark?: string) => {
    if (m === '</span>') return stack.pop() ? '</mark></span>' : m;
    stack.push(!!mark);
    return m;
  });
}

/** Paragrafele vecine cu același cadru de text (semnul q) devin o singură casetă de text (div[data-textbox]). */
function textBoxesFromMarks(html: string): string {
  if (!html.includes(MARK + 'q')) return html;
  const ALIGN_CODE: Record<string, string> = { L: 'wrapLeft', R: 'wrapRight', l: 'left', c: 'center', r: 'right' };
  const re = new RegExp(`<(p|h[1-6])( [^>]*)?>((?:<[^>]+>)*)${MARK}q([LRlcr])(\\d+)_([0-9a-f]{6})?_([0-9a-f]{6})?${MARK}([\\s\\S]*?)</\\1>`, 'g');
  let out = '';
  let last = 0;
  let open = '';
  for (const m of html.matchAll(re)) {
    const [whole, tag, attrs = '', lead, code, w, border = '', fill = '', rest] = m;
    const key = `${code}${w}_${border}_${fill}`;
    const gap = html.slice(last, m.index);
    if (open && (gap.trim() || open !== key)) { out += '</div>'; open = ''; }
    out += gap;
    if (!open) {
      out += `<div data-textbox="" data-align="${ALIGN_CODE[code]}" data-width="${Math.min(650, Math.max(80, Number(w)))}" data-border="${border ? '#' + border : ''}"${fill ? ` data-fill="#${fill}"` : ''}>`;
      open = key;
    }
    out += `<${tag}${attrs}>${lead}${rest}</${tag}>`;
    last = m.index! + whole.length;
  }
  if (open) out += '</div>';
  return out + html.slice(last);
}
