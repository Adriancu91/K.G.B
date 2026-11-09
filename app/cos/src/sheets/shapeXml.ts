// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formele și casetele de text de pe foaie (shapeBox.ts) în .xlsx: se scriu ca forme adevărate (xdr:sp cu a:prstGeom, umplere,
// contur și text în a:txBody), nu ca poze, ca programul care deschide fișierul să le poată schimba. La deschidere, formele
// cunoscute din .xlsx (inclusiv casetele de text) devin forme Suite, cu textul lor.
import type { ShapeKind } from '../docs/shapes';
import type { ShapeBox } from './shapeBox';

/** Nodul XML citit de xlsx.ts (fără prefixele de spațiu de nume). */
export interface XmlNode { name: string; attrs: Record<string, string>; kids: XmlNode[]; text: string }

const EMU = 9525;
const PRST: Record<ShapeKind, string> = {
  rect: 'rect', round: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', pentagon: 'pentagon',
  star: 'star5', heart: 'heart', arrowRight: 'rightArrow', arrowLeft: 'leftArrow', arrowUp: 'upArrow', arrowDown: 'downArrow',
  arrowBoth: 'leftRightArrow', line: 'line', callout: 'wedgeRectCallout',
  hexagon: 'hexagon', parallelogram: 'parallelogram', trapezoid: 'trapezoid', plus: 'plus', chevron: 'chevron', rtTriangle: 'rtTriangle', star6: 'star6',
};
/** La citire: formele din fișier care seamănă cu ale noastre (celelalte rămân pe dinafară, ca până acum). */
const FROM_PRST: Record<string, ShapeKind> = {
  ...Object.fromEntries(Object.entries(PRST).map(([k, v]) => [v, k as ShapeKind])),
  flowChartProcess: 'rect', flowChartAlternateProcess: 'round', snipRoundRect: 'round', round2SameRect: 'round',
  flowChartConnector: 'ellipse', flowChartDecision: 'diamond', homePlate: 'pentagon',
  star4: 'star', star7: 'star', star8: 'star', star10: 'star', star12: 'star',
  notchedRightArrow: 'arrowRight', stripedRightArrow: 'arrowRight', upDownArrow: 'arrowUp', straightConnector1: 'line',
  wedgeRoundRectCallout: 'callout', wedgeEllipseCallout: 'callout', cloudCallout: 'callout',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (c: string) => c.replace('#', '').toUpperCase();
const solid = (c: string) => `<a:solidFill><a:srgbClr val="${hex(c)}"/></a:solidFill>`;

/** Locul pe foaie (ca la poze, pics.ts). */
export interface ShapePlace { r: number; c: number; dx: number; dy: number; w: number; h: number; alt?: string }

/** O formă ca xdr:oneCellAnchor cu xdr:sp (id-ul desenului `id`, numele „Forma n”). */
export function shapeAnchorXml(p: ShapePlace, sh: ShapeBox, id: number, n: number): string {
  const cx = Math.round(p.w * EMU), cy = Math.round(p.h * EMU);
  const isText = sh.k === 'rect' && sh.al === 'l';
  const fill = sh.k === 'line' || !sh.fill ? '<a:noFill/>' : solid(sh.fill);
  const ln = sh.stroke && sh.sw > 0 ? `<a:ln w="${Math.round(sh.sw * EMU)}">${solid(sh.stroke)}</a:ln>` : '<a:ln><a:noFill/></a:ln>';
  const algn = sh.al === 'l' ? 'l' : sh.al === 'r' ? 'r' : 'ctr';
  const rPr = `<a:rPr lang="ro-RO" sz="${Math.round(sh.fs * 75)}"${sh.b ? ' b="1"' : ''}>${solid(sh.tc)}</a:rPr>`;
  const paras = (sh.text ? sh.text.split('\n') : ['']).map((line) => line
    ? `<a:p><a:pPr algn="${algn}"/><a:r>${rPr}<a:t>${esc(line)}</a:t></a:r></a:p>`
    : `<a:p><a:pPr algn="${algn}"/><a:endParaRPr lang="ro-RO" sz="${Math.round(sh.fs * 75)}"/></a:p>`).join('');
  return `<xdr:oneCellAnchor><xdr:from><xdr:col>${p.c}</xdr:col><xdr:colOff>${p.dx * EMU}</xdr:colOff><xdr:row>${p.r}</xdr:row><xdr:rowOff>${p.dy * EMU}</xdr:rowOff></xdr:from>`
    + `<xdr:ext cx="${cx}" cy="${cy}"/><xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="${isText ? 'Caseta' : 'Forma'} ${n}"${p.alt ? ` descr="${esc(p.alt)}"` : ''}/>`
    + `<xdr:cNvSpPr${isText ? ' txBox="1"' : ''}/></xdr:nvSpPr>`
    + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${PRST[sh.k]}"><a:avLst/></a:prstGeom>${fill}${ln}</xdr:spPr>`
    + `<xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip" wrap="square" rtlCol="0" anchor="${isText ? 't' : 'ctr'}"/><a:lstStyle/>${paras}</xdr:txBody>`
    + '</xdr:sp><xdr:clientData/></xdr:oneCellAnchor>';
}

const kid = (n: XmlNode | undefined, name: string) => n?.kids.find((k) => k.name === name);
function find(n: XmlNode | undefined, name: string): XmlNode | undefined {
  if (!n) return undefined;
  for (const k of n.kids) { if (k.name === name) return k; const f = find(k, name); if (f) return f; }
  return undefined;
}
const rgb = (n: XmlNode | undefined): string | null => {
  const v = kid(n, 'srgbClr')?.attrs.val;
  return v && /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toLowerCase() : null;
};

/** O formă din .xlsx (nodul xdr:sp) → descrierea Suite; null pentru formele pe care nu le avem (desen liber, conectori frânți…). */
export function shapeFromSp(sp: XmlNode): ShapeBox | null {
  const spPr = kid(sp, 'spPr');
  const txBox = find(sp, 'cNvSpPr')?.attrs.txBox === '1';
  const prst = kid(spPr, 'prstGeom')?.attrs.prst ?? (txBox ? 'rect' : '');
  const k = FROM_PRST[prst];
  if (!k) return null;
  // Culorile: din spPr; altfel din stilul formei (fillRef / lnRef) cu culoare scrisă, altfel culorile obișnuite ale formelor.
  const style = kid(sp, 'style');
  let fill: string;
  if (kid(spPr, 'noFill')) fill = '';
  else fill = rgb(kid(spPr, 'solidFill')) ?? rgb(kid(style, 'fillRef')) ?? (txBox ? '#ffffff' : '#4472c4');
  const ln = kid(spPr, 'ln');
  let stroke: string;
  if (kid(ln, 'noFill')) stroke = '';
  else stroke = rgb(kid(ln, 'solidFill')) ?? rgb(kid(style, 'lnRef')) ?? (txBox ? (ln ? '#8a8a8a' : '') : '#2f528f');
  const w = Number(ln?.attrs.w);
  const sw = stroke ? Math.min(20, Math.max(1, Math.round((w > 0 ? w : 12700) / EMU))) : 0;
  if (k === 'line') fill = '';
  // Textul: paragrafele din txBody, cu mărimea, aldinul și culoarea primului fragment și alinierea primului paragraf.
  const body = kid(sp, 'txBody');
  const paras = body ? body.kids.filter((x) => x.name === 'p') : [];
  const lines = paras.map((p) => p.kids.filter((r) => r.name === 'r' || r.name === 'fld').map((r) => kid(r, 't')?.text ?? '').join(''));
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  const rPr = find(body, 'rPr') ?? find(body, 'endParaRPr') ?? find(body, 'defRPr');
  const sz = Number(rPr?.attrs.sz);
  const fs = sz > 0 ? Math.min(72, Math.max(8, Math.round(sz / 75))) : 14;
  const tc = rgb(kid(rPr, 'solidFill')) ?? (txBox || fill === '' || fill === '#ffffff' ? '#000000' : '#ffffff');
  const algn = paras.map((p) => kid(p, 'pPr')?.attrs.algn).find(Boolean);
  const al: ShapeBox['al'] = algn === 'r' ? 'r' : algn === 'ctr' ? 'c' : algn === 'l' || txBox ? 'l' : 'c';
  return { k, fill, stroke, sw, text: lines.join('\n').slice(0, 2000), tc, fs, ...(rPr?.attrs.b === '1' || rPr?.attrs.b === 'true' ? { b: true } : {}), al };
}

/** Desenul formei fără text, ca SVG (pentru citirea în afara ferestrei, unde nu se poate desena PNG-ul cu text). */
export function shapeSvgUrl(svg: string): string {
  return 'data:image/svg+xml;base64,' + (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(svg))) : Buffer.from(svg, 'utf8').toString('base64'));
}
