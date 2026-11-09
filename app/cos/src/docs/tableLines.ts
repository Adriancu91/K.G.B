// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Liniile tabelului (ca Borders / Border Styles / Pen Color): care linii se văd (toate, doar conturul, doar în interior,
// doar orizontale), felul lor (subțire, groasă, dublă, întreruptă, punctată) și culoarea. „Fără borduri” rămâne în tableBorders.ts.
// Pe ecran: atribute data-bset / data-bstyle și variabila --tb-c pe <table>; în .docx: w:tblBorders; în .odt: fo:border pe celule.

export type LineSet = 'outer' | 'inner' | 'horiz';
export type LineStyle = 'thick' | 'double' | 'dashed' | 'dotted';
export const LINE_SETS: [LineSet | null, string][] = [[null, 'Toate liniile'], ['outer', 'Doar conturul'], ['inner', 'Doar în interior'], ['horiz', 'Doar orizontale']];
export const LINE_STYLES: [LineStyle | null, string][] = [[null, 'Subțire'], ['thick', 'Groasă'], ['double', 'Dublă'], ['dashed', 'Întreruptă'], ['dotted', 'Punctată']];
export const LINE_COLORS = ['#000000', '#6b7280', '#1d4ed8', '#047857', '#b91c1c', '#c2410c', '#7c3aed'];

export const cleanSet = (v: unknown): LineSet | null => (v === 'outer' || v === 'inner' || v === 'horiz' ? v : null);
export const cleanStyle = (v: unknown): LineStyle | null => (v === 'thick' || v === 'double' || v === 'dashed' || v === 'dotted' ? v : null);
export const cleanColor = (v: unknown): string | null => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);

/** Atributele de tabel pentru tiptap (se adaugă în TableBorders). */
export const lineAttributes = {
  bset: {
    default: null,
    parseHTML: (el: HTMLElement) => cleanSet(el.getAttribute('data-bset')),
    renderHTML: (a: Record<string, unknown>) => (a.bset ? { 'data-bset': a.bset } : {}),
  },
  bstyle: {
    default: null,
    parseHTML: (el: HTMLElement) => cleanStyle(el.getAttribute('data-bstyle')),
    renderHTML: (a: Record<string, unknown>) => (a.bstyle ? { 'data-bstyle': a.bstyle } : {}),
  },
  bcolor: {
    default: null,
    parseHTML: (el: HTMLElement) => cleanColor(el.getAttribute('data-bcolor')),
    renderHTML: (a: Record<string, unknown>) => (a.bcolor ? { 'data-bcolor': a.bcolor, style: `--tb-c: ${a.bcolor}` } : {}),
  },
};

/** Pune pe <table> din editor atributele de linii (folosit de vederea tabelului). */
export function markLines(table: HTMLElement, attrs: Record<string, unknown>) {
  const set = cleanSet(attrs.bset), st = cleanStyle(attrs.bstyle), c = cleanColor(attrs.bcolor);
  if (set) table.setAttribute('data-bset', set); else table.removeAttribute('data-bset');
  if (st) table.setAttribute('data-bstyle', st); else table.removeAttribute('data-bstyle');
  if (c) { table.setAttribute('data-bcolor', c); table.style.setProperty('--tb-c', c); } else { table.removeAttribute('data-bcolor'); table.style.removeProperty('--tb-c'); }
}

/** Ce linii are o celulă, după locul ei (prima / ultima linie sau coloană) și setul ales. */
export function cellSides(set: LineSet | null, top: boolean, bottom: boolean, left: boolean, right: boolean): { t: boolean; b: boolean; l: boolean; r: boolean } {
  if (set === 'outer') return { t: top, b: bottom, l: left, r: right };
  if (set === 'inner') return { t: !top, b: !bottom, l: !left, r: !right };
  if (set === 'horiz') return { t: true, b: true, l: false, r: false };
  return { t: true, b: true, l: true, r: true };
}

/** Linia în .odt (fo:border): grosime, fel și culoare. */
export function odtLine(st: LineStyle | null, color: string | null): string {
  const c = color ?? '#000000';
  if (st === 'double') return `1.1pt double ${c}`;
  if (st === 'thick') return `1.5pt solid ${c}`;
  if (st === 'dashed') return `0.5pt dashed ${c}`;
  if (st === 'dotted') return `0.5pt dotted ${c}`;
  return `0.5pt solid ${c}`;
}

interface DocxLib { BorderStyle: Record<string, string> }
/** w:tblBorders pentru biblioteca docx (sau undefined când tabelul are liniile obișnuite). */
export function docxBorders(lib: DocxLib, attrs: Record<string, unknown> | undefined) {
  const set = cleanSet(attrs?.bset), st = cleanStyle(attrs?.bstyle), c = cleanColor(attrs?.bcolor);
  if (!set && !st && !c) return undefined;
  const line = {
    style: st === 'double' ? lib.BorderStyle.DOUBLE : st === 'dashed' ? lib.BorderStyle.DASHED : st === 'dotted' ? lib.BorderStyle.DOTTED : lib.BorderStyle.SINGLE,
    size: st === 'thick' ? 12 : 4,
    color: (c ?? '#000000').slice(1).toUpperCase(),
  };
  const none = { style: lib.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const s = cellSides(set, true, true, true, true);
  const inner = set === 'outer' ? none : line;
  return {
    top: set === 'inner' ? none : line,
    bottom: set === 'inner' ? none : line,
    left: set === 'inner' || set === 'horiz' ? none : s.l ? line : none,
    right: set === 'inner' || set === 'horiz' ? none : s.r ? line : none,
    insideHorizontal: inner,
    insideVertical: set === 'horiz' ? none : inner,
  };
}
