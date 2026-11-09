// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Formatare celule” (Ctrl+1): ce se schimbă pe celulele selectate. Fereastra ține doar câmpurile atinse de utilizator,
// ca restul formatării fiecărei celule (de exemplu culori diferite pe celule diferite) să rămână neatins.
import { cellId, type CellStyle } from './format';
import type { Range } from './fill';
import { eachCell } from './rows';
import { borderPatch, withLook, type BorderKind, type EdgeLook } from './border';

/** Câmpurile pe care le poate schimba fereastra. */
export const DIALOG_KEYS = ['fmt', 'dec', 'code', 'align', 'va', 'wrap', 'ind', 'rot', 'font', 'sz', 'b', 'i', 'u', 's', 'pos', 'color', 'bg', 'unlock'] as const;
export type DialogKey = typeof DIALOG_KEYS[number];
export type StyleChanges = Partial<Pick<CellStyle, DialogKey>>;

/** Ce câmpuri diferă între formatul de la început (`from`) și cel din fereastră (`to`); un câmp scos are valoarea undefined. */
export function styleChanges(from: CellStyle, to: CellStyle): StyleChanges {
  const out: Record<string, unknown> = {};
  for (const k of DIALOG_KEYS) {
    const a = from[k] === false ? undefined : from[k], b = to[k] === false ? undefined : to[k];
    if (a !== b) out[k] = b;
  }
  return out as StyleChanges;
}

const tidy = (s: CellStyle): CellStyle => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== false && v !== '')) as CellStyle;

/**
 * Formatările noi pentru celulele din `ranges`: schimbările puse peste formatul fiecărei celule, apoi chenarul ales (dacă e ales).
 * Rezultatul e un „patch” pentru applyCells: {} înseamnă celulă fără formatare.
 */
export function formatCellsPatch(
  cells: Record<string, string>, styles: Record<string, CellStyle>, ranges: Range[], ch: StyleChanges,
  border?: { kind: BorderKind; look: EdgeLook } | null,
): Record<string, CellStyle> {
  const patch: Record<string, CellStyle> = {};
  if (Object.keys(ch).length) {
    for (const g of ranges) {
      eachCell(g, [cells, styles], (r, c) => {
        const id = cellId(r, c);
        if (id in patch) return;
        const n: CellStyle = { ...styles[id], ...ch };
        // Un format din listă scoate codul particularizat, iar un cod scoate formatul din listă (ca la lista din bară).
        if ('fmt' in ch && !('code' in ch)) delete n.code;
        if (ch.code) { delete n.fmt; delete n.dec; }
        patch[id] = tidy(n);
      });
    }
  }
  if (border) {
    const base = { ...styles, ...patch };
    for (const g of ranges) Object.assign(patch, withLook(borderPatch({ ...base, ...patch }, g, border.kind), border.look));
  }
  for (const id of Object.keys(patch)) patch[id] = tidy(patch[id]);
  return patch;
}

/** Stilurile de celulă gata făcute (Excel: Pornire → Stiluri de celulă): un clic pune tot formatul dintr-o dată. */
export const CELL_STYLES: { id: string; label: string; ch: StyleChanges; border?: { kind: BorderKind; look: EdgeLook } }[] = [
  { id: 'normal', label: 'Normal', ch: { b: undefined, i: undefined, color: undefined, bg: undefined, sz: undefined, font: undefined, fmt: undefined, code: undefined, dec: undefined }, border: { kind: 'none', look: {} } },
  { id: 'good', label: 'Bun', ch: { color: '#006100', bg: '#c6efce' } },
  { id: 'bad', label: 'Rău', ch: { color: '#9c0006', bg: '#ffc7ce' } },
  { id: 'neutral', label: 'Neutru', ch: { color: '#9c5700', bg: '#ffeb9c' } },
  { id: 'title', label: 'Titlu', ch: { sz: 18, color: '#44546a', b: undefined } },
  { id: 'h1', label: 'Titlu 1', ch: { sz: 15, b: true, color: '#44546a' }, border: { kind: 'bottom', look: { st: 'thick', col: '#4472c4' } } },
  { id: 'h2', label: 'Titlu 2', ch: { sz: 13, b: true, color: '#44546a' }, border: { kind: 'bottom', look: { st: 'thick', col: '#a2b8e1' } } },
  { id: 'h3', label: 'Titlu 3', ch: { b: true, color: '#44546a' }, border: { kind: 'bottom', look: { st: 'medium', col: '#8ea9db' } } },
  { id: 'total', label: 'Total', ch: { b: true }, border: { kind: 'outline', look: { st: 'double', col: '#4472c4' } } },
  { id: 'input', label: 'Intrare', ch: { color: '#3f3f76', bg: '#ffcc99', unlock: true }, border: { kind: 'all', look: { col: '#7f7f7f' } } },
  { id: 'output', label: 'Ieșire', ch: { b: true, color: '#3f3f3f', bg: '#f2f2f2' }, border: { kind: 'all', look: { col: '#3f3f3f' } } },
  { id: 'calc', label: 'Calcul', ch: { b: true, color: '#fa7d00', bg: '#f2f2f2' }, border: { kind: 'all', look: { col: '#7f7f7f' } } },
  { id: 'check', label: 'Celulă de verificare', ch: { b: true, color: '#ffffff', bg: '#a5a5a5' }, border: { kind: 'all', look: { st: 'double', col: '#3f3f3f' } } },
  { id: 'note', label: 'Notă', ch: { bg: '#ffffcc' }, border: { kind: 'all', look: { col: '#b2b2b2' } } },
  { id: 'warn', label: 'Text de avertizare', ch: { color: '#ff0000' } },
  { id: 'explain', label: 'Text explicativ', ch: { i: true, color: '#7f7f7f' } },
  { id: 'accent1', label: 'Accent 1', ch: { color: '#ffffff', bg: '#4472c4' } },
  { id: 'accent2', label: 'Accent 2', ch: { color: '#ffffff', bg: '#ed7d31' } },
  { id: 'accent3', label: 'Accent 3', ch: { color: '#ffffff', bg: '#70ad47' } },
  { id: 'light1', label: 'Accent 1, 20%', ch: { bg: '#d9e1f2' } },
  { id: 'light3', label: 'Accent 3, 20%', ch: { bg: '#e2efda' } },
  { id: 'currency', label: 'Monedă (lei)', ch: { fmt: 'lei', dec: undefined, code: undefined } },
  { id: 'percent', label: 'Procent', ch: { fmt: 'percent', dec: undefined, code: undefined } },
  { id: 'comma', label: 'Număr cu mii', ch: { fmt: 'number', dec: undefined, code: undefined } },
];
