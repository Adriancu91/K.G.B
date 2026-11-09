// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Chenare (borduri) pe celule. Fiecare celulă ține minte ce laturi are trase: „t” sus, „b” jos, „l” stânga, „r” dreapta.
import { cellId, CellStyle, COLS, ROWS } from './format';
import type { Range } from './fill';

export type BorderKind = 'all' | 'outline' | 'bottom' | 'none' | 'top' | 'left' | 'right' | 'topBottom';

export const BORDER_KINDS: [BorderKind, string][] = [
  ['bottom', 'Bordură jos'],
  ['top', 'Bordură sus'],
  ['left', 'Bordură stânga'],
  ['right', 'Bordură dreapta'],
  ['none', 'Fără bordură'],
  ['all', 'Toate bordurile'],
  ['outline', 'Borduri exterioare'],
  ['topBottom', 'Bordură sus și jos'],
];
/** Laturile trase pe marginea zonei, pentru felurile care nu ating interiorul. */
const EDGE_SIDES: Partial<Record<BorderKind, string>> = { bottom: 'b', top: 't', left: 'l', right: 'r', outline: 'tblr', topBottom: 'tb' };

const SIDES = 'tblr';

/** Felul liniei de chenar (ca Stil linie din Excel); lipsă = subțire. */
export type LineStyle = 'medium' | 'thick' | 'double' | 'dashed' | 'dotted';
export const LINE_STYLES: [LineStyle | '', string][] = [['', '─ Linie subțire'], ['medium', '━ Linie medie'], ['thick', '▬ Linie groasă'],
  ['double', '═ Linie dublă'], ['dashed', '┄ Linie întreruptă'], ['dotted', '┈ Linie punctată']];
const LINE_KEYS: string[] = ['medium', 'thick', 'double', 'dashed', 'dotted'];
export const cleanLineStyle = (v: unknown): LineStyle | undefined => (typeof v === 'string' && LINE_KEYS.includes(v) ? v as LineStyle : undefined);
/** Cum arată o latură de chenar: felul și culoarea liniei. */
export interface EdgeLook { st?: LineStyle; col?: string }
const lookOf = (st: CellStyle | undefined): EdgeLook => ({ st: st?.bdStyle, col: st?.bdColor });

/** Felul și culoarea alese se pun pe celulele cu chenar din patch; celulele rămase fără chenar le pierd. */
export function withLook(patch: Record<string, CellStyle>, look: EdgeLook): Record<string, CellStyle> {
  const out: Record<string, CellStyle> = {};
  for (const [id, st] of Object.entries(patch)) {
    const n: CellStyle = { ...st };
    if (n.bd && look.st) n.bdStyle = look.st; else delete n.bdStyle;
    if (n.bd && look.col) n.bdColor = look.col; else delete n.bdColor;
    out[id] = n;
  }
  return out;
}

export function cleanBorder(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const out = [...SIDES].filter((s) => v.includes(s)).join('');
  return out || undefined;
}

const withSides = (st: CellStyle | undefined, add: string, remove = ''): CellStyle => {
  const now = new Set([...(st?.bd ?? '')].filter((s) => !remove.includes(s)));
  for (const s of add) now.add(s);
  const bd = [...SIDES].filter((s) => now.has(s)).join('');
  const next: CellStyle = { ...st };
  if (bd) next.bd = bd; else delete next.bd;
  return next;
};

/** Formatările schimbate de un tip de chenar pe zona g (un format gol {} înseamnă „fără formatare”). */
export function borderPatch(styles: Record<string, CellStyle>, g: Range, kind: BorderKind): Record<string, CellStyle> {
  const patch: Record<string, CellStyle> = {};
  const set = (r: number, c: number, add: string, remove = '') => {
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return;
    const id = cellId(r, c);
    patch[id] = withSides(patch[id] ?? styles[id], add, remove);
  };
  for (let r = g.r0; r <= g.r1; r++) {
    for (let c = g.c0; c <= g.c1; c++) {
      if (kind === 'all') set(r, c, SIDES);
      else if (kind === 'none') set(r, c, '', SIDES);
      else {
        const want = EDGE_SIDES[kind] ?? '';
        let add = '';
        if (want.includes('t') && r === g.r0) add += 't';
        if (want.includes('b') && r === g.r1) add += 'b';
        if (want.includes('l') && c === g.c0) add += 'l';
        if (want.includes('r') && c === g.c1) add += 'r';
        if (add) set(r, c, add);
      }
    }
  }
  // „Fără chenar” șterge și liniile vecinilor lipite de zonă (altfel ar rămâne trase pe margine).
  if (kind === 'none') {
    for (let c = g.c0; c <= g.c1; c++) { set(g.r0 - 1, c, '', 'b'); set(g.r1 + 1, c, '', 't'); }
    for (let r = g.r0; r <= g.r1; r++) { set(r, g.c0 - 1, '', 'r'); set(r, g.c1 + 1, '', 'l'); }
  }
  return patch;
}

/** Ce linii desenează o celulă: dreapta și jos (ale ei sau ale vecinului lipit); sus și stânga doar la marginea tabelului. */
export interface Edges { t: boolean; b: boolean; l: boolean; r: boolean; look?: { t?: EdgeLook; b?: EdgeLook; l?: EdgeLook; r?: EdgeLook } }
export function edges(styles: Record<string, CellStyle>, r: number, c: number): Edges {
  const me = styles[cellId(r, c)];
  const own = me?.bd ?? '';
  const right = c + 1 < COLS ? styles[cellId(r, c + 1)] : undefined;
  const below = r + 1 < ROWS ? styles[cellId(r + 1, c)] : undefined;
  const e: Edges = {
    r: own.includes('r') || !!right?.bd?.includes('l'),
    b: own.includes('b') || !!below?.bd?.includes('t'),
    t: own.includes('t') && r === 0,
    l: own.includes('l') && c === 0,
  };
  // Felul liniei: al celulei care a tras latura (a ei, sau a vecinului lipit).
  const lr = e.r ? lookOf(own.includes('r') ? me : right) : {}, lb = e.b ? lookOf(own.includes('b') ? me : below) : {};
  const lt = e.t ? lookOf(me) : {}, ll = e.l ? lookOf(me) : {};
  if (lr.st || lr.col || lb.st || lb.col || lt.st || lt.col || ll.st || ll.col) e.look = { t: lt, b: lb, l: ll, r: lr };
  return e;
}

/** Linia de tipărire / PDF pentru o latură, de exemplu „2px solid #c00”. */
export function printLine(look: EdgeLook | undefined): string {
  const st = look?.st;
  const w = st === 'medium' ? 2 : st === 'thick' || st === 'double' ? 3 : 1;
  return `${w}px ${st === 'double' ? 'double' : st === 'dashed' ? 'dashed' : st === 'dotted' ? 'dotted' : 'solid'} ${look?.col ?? '#000'}`;
}
