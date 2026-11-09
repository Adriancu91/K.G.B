// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Export .odt (OpenDocument, LibreOffice / OpenOffice, și Word îl deschide): documentul (JSON TipTap) scris direct în XML-ul ODF.
// Ce se păstrează: formatul literelor, paragrafele (aliniere, retrageri, spațiere, chenar, fundal), titlurile, Titlu document / Subtitlu,
// listele, citatele, tabelele (și celulele unite), imaginile, legăturile, notele de subsol, pagina (hârtie, margini, coloane, culoare),
// antetul / subsolul cu numerele paginilor și proprietățile documentului.
import { sectionKind, sectionNewPage } from './sectionKinds';
import { fieldKindOf, ODF_FIELD } from './field';
import JSZip from 'jszip';
import { parseBoxLook } from './paragraphBox';
import { clampOffset, isFloating } from './floating';
import { figureEntriesJson, figuresTitle } from './figuresTable';
import { indexLinesJson } from './indexEntry';
import { authLinesJson, TOA_TITLE } from './authorities';
import { BIB_TITLE, citeTextJson, cleanStyle as citeStyle, docSourcesJson, refPieces } from './citation';
import { cellSides, cleanColor, cleanSet, cleanStyle, odtLine } from './tableLines';
import { odtSide, parseLines } from './cellLines';
import { tocLevels } from './toc';
import { dropText } from './formDropData';
import { dateText } from './formDate';
import type { JSONContent } from '@tiptap/react';
import { hex, imageSize } from './docx';
import { parseEquation } from './equation';
import { equationMathmlXml } from './equationDocx';
import { DOC_LABELS, lineNums, docProps, pageBackground, pageBorder, pageColumns, pageColLine, pageEven, pageFirst, pageMargins, paperSize, type PageSetup, hfSlots, numTokens, pageNumAt, pageNumStyle } from './format';
import { proofLangOf, spacingPt } from './letterFormat';
import { parseStops } from './tabStops';

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:xlink="http://www.w3.org/1999/xlink"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"',
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"',
].join(' ');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Textul, cu spațiile repetate și Tab-urile scrise ca în ODF (altfel LibreOffice le strânge într-un singur spațiu). */
function textXml(s: string): string {
  return esc(s)
    .replace(/\t/g, '<text:tab/>')
    .replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`)
    .replace(/^ /, '<text:s/>');
}

interface Ctx {
  /** Stilurile automate: proprietăți → nume (T1, P1, C1…). */
  text: Map<string, string>;
  para: Map<string, string>;
  cell: Map<string, string>;
  /** Stilurile de tabel (așezarea pe pagină) → nume (Ta1, Ta2…). */
  table: Map<string, string>;
  /** Stilurile de rând (înălțimea minimă) → nume (R1, R2…). */
  row: Map<string, string>;
  /** Stilurile cadrelor de imagine din fața / din spatele textului → nume (Gr1, Gr2…). */
  graphic: Map<string, string>;
  images: { path: string; data: Uint8Array; mime: string }[];
  /** Obiectele formulă (ecuațiile): „Object N/content.xml” cu MathML. */
  objects: string[];
  notes: number;
  tables: number;
  headings: { level: number; text: string }[];
  /** Documentul întreg (pentru Tabelul de figuri). */
  root: JSONContent;
  /** În interiorul unei liste numerotate pe niveluri (1.1., 1.1.1.). */
  outline?: boolean;
}

const ALIGN: Record<string, string> = { left: 'start', center: 'center', right: 'end', justify: 'justify' };

/** Semnul pentru letrină în cheia stilului de paragraf (devine <style:drop-cap/> la scriere). */
const DROP_CAP = 'suite-drop-cap';
const TABS = 'suite-tabs';

function tabStopsXml(v: string, left: number): string {
  const TYPE = { l: '', c: ' style:type="center"', r: ' style:type="right"', d: ' style:type="char" style:char=","' };
  const LEAD = { '': '', '.': ' style:leader-style="dotted" style:leader-text="."', '-': ' style:leader-style="dash" style:leader-text="-"', '_': ' style:leader-style="solid" style:leader-text="_"' };
  const stops = parseStops(v).map((t) => `<style:tab-stop style:position="${Math.max(0, t.pos - left).toFixed(2)}cm"${TYPE[t.align]}${LEAD[t.leader]}/>`);
  return stops.length ? `<style:tab-stops>${stops.join('')}</style:tab-stops>` : '';
}

function styleName(map: Map<string, string>, prefix: string, key: string): string {
  let n = map.get(key);
  if (!n) { n = `${prefix}${map.size + 1}`; map.set(key, n); }
  return n;
}

function textProps(marks: JSONContent['marks']): string {
  const p: string[] = [];
  for (const m of marks ?? []) {
    const a = m.attrs ?? {};
    if (m.type === 'bold') p.push('fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"');
    else if (m.type === 'italic') p.push('fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"');
    else if (m.type === 'underline' || m.type === 'link') {
      const st = m.type === 'underline' ? String(a.style ?? '') : '';
      const line = ({ dotted: 'dotted', dashed: 'dash', wavy: 'wave' } as Record<string, string>)[st] ?? 'solid';
      const color = m.type === 'underline' && /^#[0-9a-f]{6}$/i.test(String(a.color ?? '')) ? String(a.color) : 'font-color';
      p.push(`style:text-underline-style="${line}"${st === 'double' ? ' style:text-underline-type="double"' : ''} style:text-underline-width="${st === 'thick' ? 'bold' : 'auto'}" style:text-underline-color="${color}"`);
    }
    else if (m.type === 'strike') p.push('style:text-line-through-style="solid"');
    else if (m.type === 'superscript') p.push('style:text-position="super 58%"');
    else if (m.type === 'subscript') p.push('style:text-position="sub 58%"');
    else if (m.type === 'code') p.push('fo:font-family="\'Courier New\'"');
    else if (m.type === 'highlight') p.push(`fo:background-color="#${(hex(a.color) ?? 'FFF176').toLowerCase()}"`);
    else if (m.type === 'textStyle') {
      if (hex(a.color)) p.push(`fo:color="#${hex(a.color)!.toLowerCase()}"`);
      if (a.fontFamily) p.push(`fo:font-family="${esc(String(a.fontFamily).split(',')[0].replace(/["']/g, '').trim())}"`);
      const pt = parseFloat(String(a.fontSize ?? ''));
      if (pt) p.push(`fo:font-size="${pt}pt"`);
      if (a.fontVariant === 'small-caps') p.push('fo:font-variant="small-caps"');
      if (a.textTransform === 'uppercase') p.push('fo:text-transform="uppercase"');
      const ls = spacingPt(a.letterSpacing);
      if (ls) p.push(`fo:letter-spacing="${ls}pt"`);
      const fx = String(a.textEffect ?? '');
      if (fx === 'outline' || fx === 'outline-shadow') p.push('style:text-outline="true"');
      if (fx === 'shadow' || fx === 'outline-shadow') p.push('fo:text-shadow="1pt 1pt"');
      if (fx === 'emboss') p.push('style:font-relief="embossed"');
      if (fx === 'imprint') p.push('style:font-relief="engraved"');
      // Limba de verificare: fo:language + fo:country; „nu verifica” = limba „zxx” (fără limbă).
      const pl = proofLangOf(a.proofLang);
      if (pl === 'none') p.push('fo:language="zxx" fo:country="none"');
      else if (pl) { const [l, c] = pl.split('-'); p.push(`fo:language="${l}"${c ? ` fo:country="${c.toUpperCase()}"` : ''}`); }
    }
  }
  if ((marks ?? []).some((m) => m.type === 'link') && !p.some((x) => x.startsWith('fo:color'))) p.push('fo:color="#0563c1"');
  return [...new Set(p)].join(' ');
}

function inline(nodes: JSONContent[] = [], ctx: Ctx): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') {
      // Modificările urmărite: se exportă textul final (cel șters nu mai apare).
      if ((n.marks ?? []).some((m) => m.type === 'deletion')) continue;
      const props = textProps(n.marks);
      let t = textXml(n.text ?? '');
      // Câmpurile (field.ts) devin câmpuri .odt: text:page-count, text:title, text:date…
      const fk = fieldKindOf(String((n.marks ?? []).find((m) => m.type === 'docField')?.attrs?.kind ?? ''));
      if (fk && (n.marks ?? []).some((m) => m.type === 'docField')) { const [tag, at] = ODF_FIELD[fk]; t = `<text:${tag}${at}>${t}</text:${tag}>`; }
      // Butonul cu macrocomandă (MACROBUTTON): câmpul .odt text:execute-macro, cu numele macrocomenzii.
      const mb = String((n.marks ?? []).find((m) => m.type === 'macroBtn')?.attrs?.macro ?? '').trim();
      if (mb && !fk) t = `<text:execute-macro text:name="${esc(mb)}">${t}</text:execute-macro>`;
      if (props) t = `<text:span text:style-name="${styleName(ctx.text, 'T', props)}">${t}</text:span>`;
      const href = String((n.marks ?? []).find((m) => m.type === 'link')?.attrs?.href ?? '');
      if (/^(https?:|mailto:)/i.test(href) || /^#./.test(href)) t = `<text:a xlink:type="simple" xlink:href="${esc(href)}">${t}</text:a>`;
      out += t;
    } else if (n.type === 'hardBreak') out += '<text:line-break/>';
    else if (n.type === 'citation') out += textXml(citeTextJson(n));
    // Caseta de selectare: semnul ei (☐ / ☒), ca text.
    else if (n.type === 'formCheck') out += n.attrs?.checked ? '☒' : '☐';
    else if (n.type === 'formDrop') out += esc(dropText(n.attrs));
    else if (n.type === 'formDate') out += esc(dateText(n.attrs));
    else if (n.type === 'tabChar') out += '<text:tab/>';
    else if (n.type === 'bookmark' && n.attrs?.name) out += `<text:bookmark text:name="${esc(String(n.attrs.name))}"/>`;
    // Numărul legendei: secvența numerotată a programului (Figura, Tabelul…).
    else if (n.type === 'captionNum') { const l = esc(String(n.attrs?.label ?? 'Figura')); out += `<text:sequence text:name="${l}" text:formula="ooow:${l}+1" style:num-format="1">${Number(n.attrs?.n) || 1}</text:sequence>`; }
    else if (n.type === 'image') out += frame(n, ctx);
    else if (n.type === 'footnote') {
      const k = ++ctx.notes;
      const lines = String(n.attrs?.text ?? '').split(String.fromCharCode(10));
      // Nota de final: LibreOffice o pune la sfârșitul documentului (numerotarea i, ii, iii vine din text:notes-configuration).
      const [cls, id] = n.attrs?.end ? ['endnote', 'edn'] : ['footnote', 'ftn'];
      out += `<text:note text:id="${id}${k}" text:note-class="${cls}"><text:note-citation>${k}</text:note-citation><text:note-body>`
        + lines.map((l) => `<text:p text:style-name="Footnote">${textXml(l)}</text:p>`).join('') + '</text:note-body></text:note>';
    } else if (n.content) out += inline(n.content, ctx);
  }
  return out;
}

function frame(n: JSONContent, ctx: Ctx): string {
  const m = /^data:(image\/(png|jpe?g|gif|webp));base64,(.+)$/i.exec(String(n.attrs?.src ?? ''));
  if (!m) return '';
  const data = Uint8Array.from(atob(m[3]), (ch) => ch.charCodeAt(0));
  const size = imageSize(data) ?? { w: 400, h: 300 };
  const wanted = Number(n.attrs?.width) > 0 ? Number(n.attrs?.width) : size.w;
  const scale = Math.min(wanted, 640) / size.w;
  const ext = m[2].toLowerCase().replace('jpeg', 'jpg');
  const path = `Pictures/imagine${ctx.images.length + 1}.${ext}`;
  ctx.images.push({ path, data, mime: m[1].toLowerCase().replace('jpg', 'jpeg') });
  // Pixeli de ecran (96 pe inch) → cm.
  const cm = (px: number) => `${(px * 2.54 / 96).toFixed(3)}cm`;
  const fl = isFloating(n.attrs?.align)
    ? ` draw:style-name="${styleName(ctx.graphic, 'Gr', `style:wrap="run-through" style:run-through="${n.attrs?.align === 'behind' ? 'background' : 'foreground'}" style:vertical-pos="from-top" style:vertical-rel="paragraph" style:horizontal-pos="from-left" style:horizontal-rel="paragraph"`)}" text:anchor-type="paragraph" svg:x="${cm(clampOffset(n.attrs?.dx))}" svg:y="${cm(clampOffset(n.attrs?.dy))}" draw:z-index="${Math.max(0, Number(n.attrs?.z) || 0) + (n.attrs?.align === 'behind' ? 0 : 1000)}"`
    : ' text:anchor-type="as-char"';
  // Ecuația: obiect formulă (MathML), care se poate schimba și în alt program; poza rămâne ca previzualizare a lui.
  const eq = n.attrs?.equation ? parseEquation(n.attrs.equation) : null;
  const math = eq ? equationMathmlXml(eq.src) : null;
  if (math) ctx.objects.push(math);
  const obj = math ? `<draw:object xlink:href="./Object ${ctx.objects.length}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` : '';
  return `<draw:frame draw:name="${math ? 'Ecuatie' + ctx.objects.length : 'Imagine' + ctx.images.length}"${fl} svg:width="${cm(size.w * scale)}" svg:height="${cm(size.h * scale)}">`
    + obj + `<draw:image xlink:href="${path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>`
    + (String(n.attrs?.alt ?? '').trim() ? `<svg:desc>${esc(String(n.attrs?.alt).trim())}</svg:desc>` : '') + '</draw:frame>';
}

/** Stilul automat al paragrafului (aliniere, retrageri, spațiere, chenar, fundal), pe baza stilului numit `parent`. */
function paraStyle(node: JSONContent, parent: string, ctx: Ctx, extra = ''): string {
  const a = node.attrs ?? {};
  const p: string[] = [];
  const align = ALIGN[String(a.textAlign ?? '')];
  if (align && align !== 'start') p.push(`fo:text-align="${align}"`);
  const num = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const first = num(a.firstLine) ?? 0;
  const left = (Number(a.indent) || 0) * 1.25 + (first < 0 ? -first : 0);
  if (left) p.push(`fo:margin-left="${left.toFixed(2)}cm"`);
  const right = Number(a.indentRight) || 0;
  if (right > 0) p.push(`fo:margin-right="${right.toFixed(2)}cm"`);
  if (first) p.push(`fo:text-indent="${first.toFixed(2)}cm"`);
  const before = num(a.spaceBefore), after = num(a.spaceAfter);
  if (before !== null) p.push(`fo:margin-top="${before}pt"`);
  if (after !== null) p.push(`fo:margin-bottom="${after}pt"`);
  const lh = parseFloat(String(a.lineHeight ?? ''));
  if (lh > 0) p.push(`fo:line-height="${Math.round(lh * 100)}%"`);
  if (a.box) {
    // Chenarul ales (laturi, linie, culoare); fără alegere: complet, subțire, gri.
    const l = parseBoxLook(a.boxLook);
    const w = l.line === 'thick' ? '1.5pt' : l.line === 'double' ? '2.2pt' : l.sides === 'left' ? '3pt' : '0.5pt';
    const v = `${w} ${l.line === 'thick' || l.line === 'single' ? 'solid' : l.line} ${l.color}`;
    if (l.sides === 'all') p.push(`fo:border="${v}"`);
    else for (const k of l.sides === 'tb' ? ['top', 'bottom'] : [l.sides]) p.push(`fo:border-${k}="${v}"`);
    p.push('fo:padding="0.1cm"');
  }
  if (hex(a.shade)) p.push(`fo:background-color="#${hex(a.shade)!.toLowerCase()}"`);
  if (a.keepNext) p.push('fo:keep-with-next="always"');
  if (a.keepLines) p.push('fo:keep-together="always"');
  if (a.noWidow) p.push('fo:widows="1" fo:orphans="1"');
  if (a.dropCap) p.push(DROP_CAP);
  if (a.tabStops) p.push(`${TABS}="${String(a.tabStops)}|${left}"`);
  if (extra) p.push(extra);
  if (!p.length) return parent;
  return styleName(ctx.para, 'P', `${parent}|${p.join(' ')}`);
}

function blocks(nodes: JSONContent[] = [], ctx: Ctx, parent = 'Standard'): string {
  return nodes.map((n) => block(n, ctx, parent)).join('');
}

function block(n: JSONContent, ctx: Ctx, parent: string): string {
  switch (n.type) {
    case 'paragraph': {
      const base = n.attrs?.pstyle === 'title' ? 'Title' : n.attrs?.pstyle === 'subtitle' ? 'Subtitle' : n.attrs?.pstyle === 'caption' ? 'Caption' : parent;
      return `<text:p text:style-name="${paraStyle(n, base, ctx)}">${inline(n.content, ctx)}</text:p>`;
    }
    case 'heading': {
      const lvl = Math.min(6, Math.max(1, Number(n.attrs?.level) || 1));
      return `<text:h text:style-name="${paraStyle(n, `Heading_20_${lvl}`, ctx)}" text:outline-level="${lvl}">${inline(n.content, ctx)}</text:h>`;
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList': {
      const prevOutline = ctx.outline;
      if (n.type === 'orderedList' && n.attrs?.listStyle === 'outline') ctx.outline = true;
      const style = n.type === 'orderedList' ? (ctx.outline ? 'Numerotare_20_niveluri' : 'Numerotare') : 'Buline';
      const start = Number(n.attrs?.start) || 1;
      const items = (n.content ?? []).map((item, i) => {
        const startAttr = i === 0 && n.type === 'orderedList' && start !== 1 ? ` text:start-value="${start}"` : '';
        let inner = blocks(item.content, ctx, 'List_20_Paragraph');
        // Lista de bifat: căsuța rămâne ca semn la începutul rândului.
        if (n.type === 'taskList') inner = inner.replace(/^(<text:p [^>]*>)/, `$1${item.attrs?.checked ? '☑' : '☐'} `);
        return `<text:list-item${startAttr}>${inner}</text:list-item>`;
      }).join('');
      ctx.outline = prevOutline;
      return `<text:list text:style-name="${style}">${items}</text:list>`;
    }
    case 'blockquote':
      return blocks(n.content, ctx, 'Quotations');
    case 'textBox':
      // Caseta de text: în .odt păstrăm doar textul ei, ca paragrafe obișnuite.
      return blocks(n.content, ctx, 'Standard');
    case 'horizontalRule':
      return '<text:p text:style-name="Horizontal_20_Line"/>';
    case 'table':
      return table(n, ctx);
    case 'image': {
      const a = String(n.attrs?.align ?? 'center');
      const side = a === 'wrapLeft' ? 'left' : a === 'wrapRight' ? 'right' : a;
      const style = paraStyle({ attrs: { textAlign: side } }, 'Standard', ctx);
      const caption = String(n.attrs?.caption ?? '').trim();
      return `<text:p text:style-name="${style}">${frame(n, ctx)}</text:p>`
        + (caption ? `<text:p text:style-name="${paraStyle({ attrs: { textAlign: side } }, 'Caption', ctx)}">${textXml(caption)}</text:p>` : '');
    }
    case 'pageBreak':
      return `<text:p text:style-name="${styleName(ctx.para, 'P', 'Standard|fo:break-after="page"')}"/>`;
    // Întreruperea de secțiune: în .odt rămâne doar pagina nouă (secțiunile de pagină nu se păstrează).
    case 'sectionBreak':
      return sectionNewPage(sectionKind(n.attrs?.kind)) ? `<text:p text:style-name="${styleName(ctx.para, 'P', 'Standard|fo:break-after="page"')}"/>` : '';
    case 'columnBreak':
      return '<text:p text:style-name="' + styleName(ctx.para, 'P', 'Standard|fo:break-after="column"') + '"/>';
    case 'bibliography':
      return `<text:p text:style-name="${styleName(ctx.para, 'P', 'Standard|fo:margin-bottom="6pt"')}"><text:span text:style-name="${styleName(ctx.text, 'T', 'fo:font-weight="bold" fo:font-size="14pt"')}">${BIB_TITLE}</text:span></text:p>`
        + docSourcesJson(ctx.root).map((s) => `<text:p text:style-name="${styleName(ctx.para, 'P', 'Standard|fo:margin-left="1.27cm" fo:text-indent="-1.27cm" fo:margin-bottom="4pt"')}">`
          + refPieces(s, citeStyle(n.attrs?.style)).map((p) => (p.i ? `<text:span text:style-name="${styleName(ctx.text, 'T', 'fo:font-style="italic"')}">${textXml(p.t)}</text:span>` : textXml(p.t))).join('') + '</text:p>').join('');
    case 'docIndex':
      return `<text:p text:style-name="${styleName(ctx.para, 'P', 'Standard|fo:margin-bottom="6pt"')}"><text:span text:style-name="${styleName(ctx.text, 'T', 'fo:font-weight="bold" fo:font-size="14pt"')}">Index</text:span></text:p>`
        + indexLinesJson(ctx.root).map((l) => l.letter
          ? `<text:p text:style-name="Standard"><text:span text:style-name="${styleName(ctx.text, 'T', 'fo:font-weight="bold"')}">${textXml(l.text)}</text:span></text:p>`
          : `<text:p text:style-name="${l.sub ? styleName(ctx.para, 'P', 'Standard|fo:margin-left="0.25in"') : 'Standard'}">${textXml(l.text)}</text:p>`).join('');
    case 'docAuthorities':
      return `<text:p text:style-name="${styleName(ctx.para, 'P', 'Standard|fo:margin-bottom="6pt"')}"><text:span text:style-name="${styleName(ctx.text, 'T', 'fo:font-weight="bold" fo:font-size="14pt"')}">${TOA_TITLE}</text:span></text:p>`
        + authLinesJson(ctx.root, Number(n.attrs?.cat) || 0).map((l) => l.head
          ? `<text:p text:style-name="Standard"><text:span text:style-name="${styleName(ctx.text, 'T', 'fo:font-weight="bold"')}">${textXml(l.text)}</text:span></text:p>`
          : `<text:p text:style-name="${styleName(ctx.para, 'P', 'Standard|fo:margin-left="0.25in"')}">${textXml(l.text)}</text:p>`).join('');
    case 'tableOfFigures': {
      const label = String(n.attrs?.label ?? '');
      return `<text:p text:style-name="${styleName(ctx.para, 'P', 'Standard|fo:margin-bottom="6pt"')}"><text:span text:style-name="${styleName(ctx.text, 'T', 'fo:font-weight="bold" fo:font-size="14pt"')}">${textXml(figuresTitle(label))}</text:span></text:p>`
        + figureEntriesJson(ctx.root, label).map((t) => `<text:p text:style-name="Standard">${textXml(t)}</text:p>`).join('');
    }
    case 'tableOfContents':
      // Cuprinsul ajunge ca text obișnuit (titlurile, cu retragere pe nivel), ca la Word.
      return `<text:p text:style-name="${styleName(ctx.para, 'P', 'Standard|fo:margin-bottom="6pt"')}"><text:span text:style-name="${styleName(ctx.text, 'T', 'fo:font-weight="bold" fo:font-size="14pt"')}">Cuprins</text:span></text:p>`
        + ctx.headings.filter((h) => h.level <= tocLevels(n.attrs?.levels)).map((h) => `<text:p text:style-name="${styleName(ctx.para, 'P', `Standard|fo:margin-left="${((h.level - 1) * 0.63).toFixed(2)}cm"`)}">${textXml(h.text)}</text:p>`).join('');
    default:
      return n.content ? blocks(n.content, ctx, parent) : '';
  }
}

/** Liniile unei celule în .odt: toate la fel (fo:border) sau fiecare latură (top / bottom / left / right). */
function borderXml(s: { t: boolean; b: boolean; l: boolean; r: boolean }, line: string, own?: unknown): string {
  // Laturile puse pe celulă (cellLines.ts) bat liniile tabelului.
  const o = parseLines(own);
  if (o.t || o.b || o.l || o.r) {
    const side = (k: 't' | 'b' | 'l' | 'r') => odtSide(o[k]) ?? (s[k] ? line : 'none');
    return `fo:border-top="${side('t')}" fo:border-bottom="${side('b')}" fo:border-left="${side('l')}" fo:border-right="${side('r')}"`;
  }
  if (s.t && s.b && s.l && s.r) return `fo:border="${line}"`;
  return `fo:border-top="${s.t ? line : 'none'}" fo:border-bottom="${s.b ? line : 'none'}" fo:border-left="${s.l ? line : 'none'}" fo:border-right="${s.r ? line : 'none'}"`;
}

function table(n: JSONContent, ctx: Ctx): string {
  const rows = n.content ?? [];
  const noBorders = n.attrs?.borders === 'none';
  // Marginile celulelor (Proprietăți tabel), altfel 0,1 cm.
  const pad = n.attrs?.pad !== null && n.attrs?.pad !== undefined && Number(n.attrs.pad) >= 0 ? Number(n.attrs.pad) : 0.1;
  const lset = cleanSet(n.attrs?.bset), line = odtLine(cleanStyle(n.attrs?.bstyle), cleanColor(n.attrs?.bcolor));
  // Numărul de coloane: din primul rând (cu celulele unite pe orizontală).
  const cols = Math.max(1, (rows[0]?.content ?? []).reduce((s, c) => s + (Number(c.attrs?.colspan) || 1), 0));
  const pending: number[] = new Array(cols).fill(0); // câte rânduri mai acoperă o celulă unită pe verticală
  // Rândurile de antet repetate pe fiecare pagină stau, ca în Word, la începutul tabelului: în .odt merg în table:table-header-rows.
  let head = 0;
  while (head < rows.length && rows[head].attrs?.repeatHeader) head++;
  const xmlRows = rows.map((row, ri) => {
    let col = 0;
    let xml = '';
    const covered = () => { while (col < cols && pending[col] > 0) { pending[col]--; xml += '<table:covered-table-cell/>'; col++; } };
    for (const cell of row.content ?? []) {
      covered();
      const cs = Math.max(1, Number(cell.attrs?.colspan) || 1), rs = Math.max(1, Number(cell.attrs?.rowspan) || 1);
      const bg = hex(cell.attrs?.backgroundColor) ?? (cell.type === 'tableHeader' ? 'F0F0F0' : undefined);
      const va = cell.attrs?.verticalAlign === 'middle' || cell.attrs?.verticalAlign === 'bottom' ? cell.attrs.verticalAlign : undefined;
      const style = styleName(ctx.cell, 'C', `${noBorders ? 'fo:border="none"' : borderXml(cellSides(lset, ri === 0, ri + rs >= rows.length, col === 0, col + cs >= cols), line, cell.attrs?.cellLines)} fo:padding="${pad}cm"${bg ? ` fo:background-color="#${bg.toLowerCase()}"` : ''}${va ? ` style:vertical-align="${va}"` : ''}`);
      const span = (cs > 1 ? ` table:number-columns-spanned="${cs}"` : '') + (rs > 1 ? ` table:number-rows-spanned="${rs}"` : '');
      const inner = blocks(cell.content, ctx, 'Table_20_Contents') || '<text:p text:style-name="Table_20_Contents"/>';
      xml += `<table:table-cell table:style-name="${style}" office:value-type="string"${span}>${inner}</table:table-cell>`;
      for (let k = 0; k < cs; k++) { if (col + k < cols && rs > 1) pending[col + k] = rs - 1; }
      for (let k = 1; k < cs; k++) xml += '<table:covered-table-cell/>';
      col += cs;
    }
    covered();
    const h = Number(row.attrs?.rowHeight);
    const rp = [h > 0 ? `style:min-row-height="${h}cm"` : '', row.attrs?.noSplit ? 'fo:keep-together="always"' : ''].filter(Boolean).join(' ');
    const rs = rp ? ` table:style-name="${styleName(ctx.row, 'R', rp)}"` : '';
    return `<table:table-row${rs}>${xml}</table:table-row>`;
  });
  const body = head ? `<table:table-header-rows>${xmlRows.slice(0, head).join('')}</table:table-header-rows>${xmlRows.slice(head).join('')}` : xmlRows.join('');
  const k = ++ctx.tables;
  const al = n.attrs?.align === 'center' || n.attrs?.align === 'right' ? n.attrs.align : '';
  // Indentarea de la stânga a tabelului așezat la stânga: fo:margin-left.
  const ind = !al && Number(n.attrs?.indent) > 0 ? Number(n.attrs?.indent) : 0;
  const tp = al ? `table:align="${al}"` : ind ? `table:align="left" fo:margin-left="${ind}cm"` : '';
  const ts = tp ? ` table:style-name="${styleName(ctx.table, 'Ta', tp)}"` : '';
  // Textul alternativ: table:title și table:desc, primele în tabel.
  const alt = (n.attrs?.altTitle ? `<table:title>${esc(n.attrs.altTitle)}</table:title>` : '') + (n.attrs?.altDesc ? `<table:desc>${esc(n.attrs.altDesc)}</table:desc>` : '');
  return `<table:table table:name="Tabel${k}"${ts}>${alt}<table:table-column table:number-columns-repeated="${cols}"/>${body}</table:table>`;
}

function headingsOf(doc: JSONContent): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  const text = (n: JSONContent): string => n.text ?? (n.content ?? []).map(text).join('');
  const walk = (n: JSONContent) => {
    if (n.type === 'heading') { const t = text(n).trim(); if (t) out.push({ level: Number(n.attrs?.level) || 1, text: t }); }
    else if (n.type !== 'table') (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return out;
}

// Stilurile numite, ca în LibreOffice (aceleași nume, ca să fie recunoscute în lista de stiluri de acolo).
const HEADING_PT = [20, 16, 14, 13, 12, 11];
function namedStyles(page?: PageSetup): string {
  const ln = lineNums(page);
  const heads = HEADING_PT.map((pt, i) => `<style:style style:name="Heading_20_${i + 1}" style:display-name="Heading ${i + 1}" style:family="paragraph" style:parent-style-name="Heading" style:next-style-name="Standard" style:default-outline-level="${i + 1}" style:class="text">`
    + `<style:text-properties fo:font-size="${pt}pt" fo:font-weight="bold"${i === 3 || i === 5 ? ' fo:font-style="italic"' : ''}${i < 3 ? ' fo:color="#2e74b5"' : ''}/></style:style>`).join('');
  return `<office:styles>
<style:default-style style:family="paragraph"><style:paragraph-properties fo:orphans="2" fo:widows="2"/><style:text-properties style:font-name="Calibri" fo:font-family="Calibri" fo:font-size="11pt" fo:language="ro" fo:country="RO"${page?.hyphenate ? ' fo:hyphenate="true"' : ''}/></style:default-style>
<style:style style:name="Standard" style:family="paragraph" style:class="text"><style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.21cm" fo:line-height="115%"/></style:style>
<style:style style:name="Heading" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:class="text"><style:paragraph-properties fo:margin-top="0.42cm" fo:margin-bottom="0.21cm" fo:keep-with-next="always"/></style:style>
${heads}
<style:style style:name="Title" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:class="chapter"><style:text-properties fo:font-size="28pt" fo:letter-spacing="-0.02cm"/></style:style>
<style:style style:name="Subtitle" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:class="chapter"><style:text-properties fo:font-size="14pt" fo:color="#5a5a5a"/></style:style>
<style:style style:name="Caption" style:family="paragraph" style:parent-style-name="Standard" style:class="extra"><style:paragraph-properties fo:margin-top="0.1cm" fo:margin-bottom="0.35cm"/><style:text-properties fo:font-size="9pt" fo:font-style="italic" fo:color="#44546a"/></style:style>
<style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard" style:class="html"><style:paragraph-properties fo:margin-left="1cm" fo:border-left="1.5pt solid #bbbbbb" fo:padding-left="0.2cm"/></style:style>
<style:style style:name="List_20_Paragraph" style:display-name="List Paragraph" style:family="paragraph" style:parent-style-name="Standard" style:class="list"/>
<style:style style:name="Table_20_Contents" style:display-name="Table Contents" style:family="paragraph" style:parent-style-name="Standard" style:class="extra"><style:paragraph-properties fo:margin-bottom="0cm"/></style:style>
<style:style style:name="Caption" style:family="paragraph" style:parent-style-name="Standard" style:class="extra"><style:text-properties fo:font-size="10pt" fo:font-style="italic" fo:color="#555555"/></style:style>
<style:style style:name="Footnote" style:family="paragraph" style:parent-style-name="Standard" style:class="extra"><style:paragraph-properties fo:margin-bottom="0cm"/><style:text-properties fo:font-size="10pt"/></style:style>
<style:style style:name="Horizontal_20_Line" style:display-name="Horizontal Line" style:family="paragraph" style:parent-style-name="Standard" style:class="html"><style:paragraph-properties fo:border-bottom="0.5pt solid #999999" fo:padding="0cm"/></style:style>
<style:style style:name="Header_20_Footer" style:display-name="Header and Footer" style:family="paragraph" style:parent-style-name="Standard" style:class="extra"><style:paragraph-properties fo:margin-bottom="0cm"/><style:text-properties fo:font-size="9pt" fo:color="#555555"/></style:style>
<text:list-style style:name="Buline">${[0, 1, 2, 3, 4, 5].map((i) => `<text:list-level-style-bullet text:level="${i + 1}" text:bullet-char="${['•', '◦', '▪'][i % 3]}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.635cm" fo:margin-left="${(1.27 * (i + 1)).toFixed(3)}cm"/></style:list-level-properties></text:list-level-style-bullet>`).join('')}</text:list-style>
<text:list-style style:name="Numerotare">${[0, 1, 2, 3, 4, 5].map((i) => `<text:list-level-style-number text:level="${i + 1}" style:num-suffix="." style:num-format="${['1', 'a', 'i'][i % 3]}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.635cm" fo:margin-left="${(1.27 * (i + 1)).toFixed(3)}cm"/></style:list-level-properties></text:list-level-style-number>`).join('')}</text:list-style>
<text:list-style style:name="Numerotare_20_niveluri" style:display-name="Numerotare pe niveluri">${[0, 1, 2, 3, 4, 5].map((i) => `<text:list-level-style-number text:level="${i + 1}" style:num-suffix="." style:num-format="1" text:display-levels="${i + 1}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-${(0.635 + 0.3 * i).toFixed(3)}cm" fo:margin-left="${(1.27 * (i + 1)).toFixed(3)}cm"/></style:list-level-properties></text:list-level-style-number>`).join('')}</text:list-style>
<text:notes-configuration text:note-class="footnote" style:num-format="1" text:start-value="0" text:footnotes-position="page" text:start-numbering-at="document"/><text:notes-configuration text:note-class="endnote" style:num-format="i" text:start-value="0"/>
${ln ? `<text:linenumbering-configuration text:number-lines="true" text:increment="${ln.by ?? 1}" text:restart-on-page="${ln.page ? 'true' : 'false'}" text:offset="0.5cm" text:number-position="left" style:num-format="1" text:count-empty-lines="true" text:count-in-text-boxes="false"/>` : ''}
</office:styles>`;
}

function pageStyles(page: PageSetup | undefined): { auto: string; master: string } {
  const size = paperSize(page);
  const m = pageMargins(page);
  const cols = pageColumns(page);
  const bg = pageBackground(page);
  // Doar spațiile de la capete: Tab-urile despart locurile stânga / mijloc / dreapta.
  const st = (t?: string) => (t ?? '').replace(/^ +| +$/g, '');
  const header = st(page?.header);
  const footer = st(page?.footer);
  const numbers = !!page?.numbers;
  // Prima pagină diferită: ODF 1.3 are style:header-first / style:footer-first în pagina de bază.
  const first = pageFirst(page);
  // Paginile pare diferite: style:header-left / style:footer-left (paginile din stânga, adică cele pare).
  const even = pageEven(page);
  // Numărul paginii poate sta și sus (în antet).
  const at = pageNumAt(page), numTop = at[0] === 't';
  const hasHeader = !!header || !!st(first?.header) || !!st(even?.header) || (numTop && (numbers || !!first?.numbers));
  const hasFooter = !!footer || !!st(first?.footer) || !!st(even?.footer) || (!numTop && (numbers || !!first?.numbers));
  const hf = (tag: 'header' | 'footer') => `<style:${tag}-style><style:header-footer-properties fo:min-height="0cm" fo:${tag === 'header' ? 'margin-bottom' : 'margin-top'}="0.3cm"/></style:${tag}-style>`;
  const auto = `<office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="${size.w}mm" fo:page-height="${size.h}mm" style:print-orientation="${page?.landscape ? 'landscape' : 'portrait'}"`
    + ` fo:margin-top="${m.top}mm" fo:margin-bottom="${m.bottom}mm" fo:margin-left="${m.left}mm" fo:margin-right="${m.right}mm"${bg ? ` fo:background-color="${bg}"` : ''}${pageBorder(page) ? ` fo:border="${({ single: '0.5pt solid', double: '1.1pt double', thick: '2.25pt solid' })[pageBorder(page) as 'single']} #333333" fo:padding="0.4cm"` : ''}>`
    + (cols > 1 ? `<style:columns fo:column-count="${cols}" fo:column-gap="0.5cm">${pageColLine(page) ? '<style:column-sep style:width="0.02cm" style:color="#808080" style:height="100%"/>' : ''}</style:columns>` : '')
    + `</style:page-layout-properties>${hasHeader ? hf('header') : ''}${hasFooter ? hf('footer') : ''}</style:page-layout>`
    + `<style:style style:name="PHeader" style:family="paragraph" style:parent-style-name="Header_20_Footer"><style:paragraph-properties fo:text-align="center"/></style:style>`
    + `<style:style style:name="PFooter" style:family="paragraph" style:parent-style-name="Header_20_Footer"><style:paragraph-properties fo:text-align="${footer ? 'start' : 'end'}"><style:tab-stops><style:tab-stop style:position="${((size.w - m.left - m.right) / 10).toFixed(2)}cm" style:type="right"/></style:tab-stops></style:paragraph-properties></style:style>`
    + `<style:style style:name="PHF" style:family="paragraph" style:parent-style-name="Header_20_Footer"><style:paragraph-properties><style:tab-stops><style:tab-stop style:position="${((size.w - m.left - m.right) / 20).toFixed(2)}cm" style:type="center"/><style:tab-stop style:position="${((size.w - m.left - m.right) / 10).toFixed(2)}cm" style:type="right"/></style:tab-stops></style:paragraph-properties></style:style>`
    + '</office:automatic-styles>';
  const numXml = numTokens(pageNumStyle(page)).map((t) => (t === 'P' ? '<text:page-number text:select-page="current">1</text:page-number>' : t === 'T' ? '<text:page-count>1</text:page-count>' : textXml(t))).join('');
  const num = (text: string, on: boolean) => on ? `${text ? '<text:tab/>' : ''}${numXml}` : '';
  // Antetul fără număr și subsolul cu numărul jos în dreapta rămân ca înainte; altfel, trei locuri despărțite de tab-uri.
  const hfP = (text: string, top: boolean, on: boolean) => {
    const tabbed = text.includes(String.fromCharCode(9));
    if (top && !(on && numTop) && !tabbed) return `<text:p text:style-name="PHeader">${textXml(text)}</text:p>`;
    if (!top && at === 'br' && !tabbed) return `<text:p text:style-name="PFooter">${textXml(text)}${num(text, on)}</text:p>`;
    const slots = hfSlots(text, top, on, at);
    const parts = slots.map((s) => textXml(s.text) + (s.text && s.num ? ' · ' : '') + (s.num ? numXml : ''));
    while (parts.length > 1 && !parts[parts.length - 1]) parts.pop();
    return `<text:p text:style-name="PHF">${parts.join('<text:tab/>')}</text:p>`;
  };
  const fh = st(first?.header);
  const ff = st(first?.footer);
  const master = `<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1">`
    + (hasHeader ? `<style:header>${hfP(header, true, numbers)}</style:header>` : '')
    + (even && hasHeader ? `<style:header-left>${hfP(st(even.header), true, numbers)}</style:header-left>` : '')
    + (first && hasHeader ? `<style:header-first>${hfP(fh, true, first.numbers)}</style:header-first>` : '')
    + (hasFooter ? `<style:footer>${hfP(footer, false, numbers)}</style:footer>` : '')
    + (even && hasFooter ? `<style:footer-left>${hfP(st(even.footer), false, numbers)}</style:footer-left>` : '')
    + (first && hasFooter ? `<style:footer-first>${hfP(ff, false, first.numbers)}</style:footer-first>` : '')
    + '</style:master-page></office:master-styles>';
  return { auto, master };
}

function autoStyles(ctx: Ctx): string {
  const out: string[] = [];
  for (const [props, name] of ctx.text) out.push(`<style:style style:name="${name}" style:family="text"><style:text-properties ${props}/></style:style>`);
  for (const [key, name] of ctx.para) {
    const [parent, props] = key.split(/\|(.*)/s);
    // Letrina e un element în proprietățile paragrafului, nu un atribut.
    // Opririle de tabulator la fel, ca element (pozițiile de la retragerea paragrafului, ca în fișierele .odt obișnuite).
    const tm = new RegExp(`${TABS}="([^|"]*)[|]([^"]*)"`).exec(props);
    const kids = (props.includes(DROP_CAP) ? '<style:drop-cap style:length="1" style:lines="3" style:distance="0.1cm"/>' : '') + (tm ? tabStopsXml(tm[1], Number(tm[2]) || 0) : '');
    const own = props.replace(DROP_CAP, '').replace(tm?.[0] ?? '', '');
    const pp = kids ? `<style:paragraph-properties ${own}>${kids}</style:paragraph-properties>` : `<style:paragraph-properties ${own}/>`;
    out.push(`<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="${parent}">${pp}</style:style>`);
  }
  for (const [props, name] of ctx.table) out.push(`<style:style style:name="${name}" style:family="table"><style:table-properties ${props}/></style:style>`);
  for (const [props, name] of ctx.row) out.push(`<style:style style:name="${name}" style:family="table-row"><style:table-row-properties ${props}/></style:style>`);
  for (const [props, name] of ctx.graphic) out.push(`<style:style style:name="${name}" style:family="graphic"><style:graphic-properties ${props}/></style:style>`);
  for (const [props, name] of ctx.cell) out.push(`<style:style style:name="${name}" style:family="table-cell"><style:table-cell-properties ${props}/></style:style>`);
  return out.join('');
}

export async function docToOdt(doc: JSONContent, page?: PageSetup): Promise<Uint8Array> {
  const ctx: Ctx = { text: new Map(), para: new Map(), cell: new Map(), table: new Map(), row: new Map(), graphic: new Map(), images: [], objects: [], notes: 0, tables: 0, headings: headingsOf(doc), root: doc };
  const body = blocks(doc.content, ctx) || '<text:p text:style-name="Standard"/>';
  const head = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const content = `${head}<office:document-content ${NS} office:version="1.3"><office:automatic-styles>${autoStyles(ctx)}</office:automatic-styles>`
    + `<office:body><office:text>${body}</office:text></office:body></office:document-content>`;
  const ps = pageStyles(page);
  const styles = `${head}<office:document-styles ${NS} office:version="1.3">${namedStyles(page)}${ps.auto}${ps.master}</office:document-styles>`;
  const props = docProps(page);
  const metaXml = `${head}<office:document-meta ${NS} office:version="1.3"><office:meta><meta:generator>Cyber Office Studio Docs</meta:generator>`
    + (props?.title ? `<dc:title>${esc(props.title)}</dc:title>` : '')
    + (props?.subject ? `<dc:subject>${esc(props.subject)}</dc:subject>` : '')
    + (props?.author ? `<meta:initial-creator>${esc(props.author)}</meta:initial-creator><dc:creator>${esc(props.author)}</dc:creator>` : '')
    + (props?.keywords ?? '').split(',').map((k) => k.trim()).filter(Boolean).map((k) => `<meta:keyword>${esc(k)}</meta:keyword>`).join('')
    // Clasificarea (Proprietăți → Clasificare), ca proprietate a utilizatorului, cu numele etichetei.
    + (props?.label ? `<meta:user-defined meta:name="Clasificare">${esc(DOC_LABELS.find(([k]) => k === props.label)?.[1] ?? '')}</meta:user-defined>` : '')
    + `<meta:creation-date>${new Date().toISOString().slice(0, 19)}</meta:creation-date></office:meta></office:document-meta>`;
  const manifest = `${head}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">`
    + '<manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>'
    + ['content.xml', 'styles.xml', 'meta.xml'].map((f) => `<manifest:file-entry manifest:full-path="${f}" manifest:media-type="text/xml"/>`).join('')
    + ctx.images.map((im) => `<manifest:file-entry manifest:full-path="${im.path}" manifest:media-type="${im.mime}"/>`).join('')
    + ctx.objects.map((_m, i) => `<manifest:file-entry manifest:full-path="Object ${i + 1}/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.formula"/><manifest:file-entry manifest:full-path="Object ${i + 1}/content.xml" manifest:media-type="text/xml"/>`).join('')
    + '</manifest:manifest>';
  const zip = new JSZip();
  // „mimetype” trebuie să fie primul fișier din arhivă, necomprimat (așa recunosc programele formatul).
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', content);
  zip.file('styles.xml', styles);
  zip.file('meta.xml', metaXml);
  for (const im of ctx.images) zip.file(im.path, im.data);
  ctx.objects.forEach((m, i) => zip.file(`Object ${i + 1}/content.xml`, `${head}${m}`));
  zip.file('META-INF/manifest.xml', manifest);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.oasis.opendocument.text' });
}
