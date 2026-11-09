// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formatare condiționată simplă: celulele dintr-o zonă se colorează singure după valoare
// (de exemplu roșu dacă scrie „Neîncasat”, verde dacă suma e peste 1000), ca în Excel.

import { cellId, CellStyle, COLS, isNumber, lastUsedRow, ROWS, workEnd } from './format';
import { evaluateAll, shiftFormula, type Result, type SheetBook } from './formula';
import { validCnp, validCui, validIban } from './ids';

export type CondOp = 'gt' | 'lt' | 'ge' | 'le' | 'eq' | 'ne' | 'between' | 'text' | 'empty' | 'filled' | 'badcnp' | 'badcui' | 'badiban' | 'databar'
  | 'top' | 'bottom' | 'above' | 'below' | 'dup' | 'unique' | 'scale' | 'icons' | 'formula';
export type CondLook = 'red' | 'yellow' | 'green' | 'blue' | 'bold';

export interface SheetRule {
  /** Zona, de exemplu "C2:C50". */
  range: string;
  op: CondOp;
  /** Valoarea cu care se compară (pentru „între”: capătul de jos). */
  v1: string;
  /** Capătul de sus, doar pentru „între”. */
  v2?: string;
  look: CondLook;
}

export const COND_OPS: [CondOp, string][] = [
  ['gt', 'mai mare decât'], ['lt', 'mai mic decât'], ['ge', 'cel puțin'], ['le', 'cel mult'],
  ['between', 'între'], ['eq', 'egal cu'], ['ne', 'diferit de'], ['text', 'conține textul'],
  ['empty', 'e goală'], ['filled', 'nu e goală'],
  ['badcnp', 'e un CNP greșit'], ['badcui', 'e un CUI greșit'], ['badiban', 'e un IBAN greșit'],
  ['top', 'e printre cele mai mari (câte?)'], ['bottom', 'e printre cele mai mici (câte?)'],
  ['above', 'e peste medie'], ['below', 'e sub medie'],
  ['dup', 'se repetă în zonă (dubluri)'], ['unique', 'apare o singură dată în zonă'],
  ['databar', 'se arată ca bară (după mărime)'],
  ['scale', 'se colorează după mărime (scală de culori)'],
  ['icons', 'primește o pictogramă după mărime'],
  ['formula', 'formula e adevărată (de exemplu =$C2>1000)'],
];

// Seturile de pictograme (ca în Excel, cu 3 pictograme): treimea de sus / din mijloc / de jos a intervalului min–max.
const G = '#3fa34d', Y = '#f2b134', R = '#d9453b';
const ICON_SHAPES = {
  up: (c: string) => `<path d="M8 2l5 6H10v6H6V8H3z" fill="${c}"/>`,
  right: (c: string) => `<path d="M14 8l-6 5v-3H2V6h6V3z" fill="${c}"/>`,
  down: (c: string) => `<path d="M8 14l5-6H10V2H6v6H3z" fill="${c}"/>`,
  dot: (c: string) => `<circle cx="8" cy="8" r="6" fill="${c}"/>`,
  check: (c: string) => `<path d="M2 8.5l2-2 2.5 2.5L12 3.5l2 2-7.5 7.5z" fill="${c}"/>`,
  bang: (c: string) => `<path d="M6.5 2h3l-.5 8h-2zM8 11.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" fill="${c}"/>`,
  cross: (c: string) => `<path d="M3.5 2L8 6.5 12.5 2 14 3.5 9.5 8l4.5 4.5-1.5 1.5L8 9.5 3.5 14 2 12.5 6.5 8 2 3.5z" fill="${c}"/>`,
  tri: (c: string) => `<path d="M8 3l6 10H2z" fill="${c}"/>`,
  dash: (c: string) => `<rect x="3" y="6.5" width="10" height="3" fill="${c}"/>`,
  triDown: (c: string) => `<path d="M8 13L2 3h12z" fill="${c}"/>`,
  star: (c: string) => `<path d="M8 1.5l1.9 4.2 4.6.5-3.4 3.1 1 4.5L8 11.5l-4.1 2.3 1-4.5L1.5 6.2l4.6-.5z" fill="${c}" stroke="#c99a06" stroke-width=".8"/>`,
};
type Shape = keyof typeof ICON_SHAPES;
export const ICON_SETS: Record<CondLook, { label: string; xlsx: string; icons: [Shape, string][] }> = {
  green: { label: 'Săgeți', xlsx: '3Arrows', icons: [['up', G], ['right', Y], ['down', R]] },
  red: { label: 'Semafoare', xlsx: '3TrafficLights1', icons: [['dot', G], ['dot', Y], ['dot', R]] },
  yellow: { label: 'Bifă / ! / ✕', xlsx: '3Symbols2', icons: [['check', G], ['bang', Y], ['cross', R]] },
  blue: { label: 'Triunghiuri', xlsx: '3Triangles', icons: [['tri', G], ['dash', Y], ['triDown', R]] },
  bold: { label: 'Stele', xlsx: '3Stars', icons: [['star', '#f5c518'], ['star', '#fbe69a'], ['star', '#ffffff']] },
};

/** Pictograma ca imagine SVG (pentru fundalul celulei); nivelul 0 = treimea de sus. */
export function iconUrl(look: CondLook, level: number): string {
  const [shape, color] = ICON_SETS[look].icons[Math.max(0, Math.min(2, level))];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${ICON_SHAPES[shape](color)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Scalele de culori (aceleași ca în Excel): culoarea celei mai mici valori, [a mijlocului (percentila 50)], a celei mai mari. */
export const SCALES: Record<CondLook, { label: string; colors: string[] }> = {
  green: { label: 'Roșu → galben → verde', colors: ['#f8696b', '#ffeb84', '#63be7b'] },
  red: { label: 'Verde → galben → roșu', colors: ['#63be7b', '#ffeb84', '#f8696b'] },
  yellow: { label: 'Alb → verde', colors: ['#fcfcff', '#63be7b'] },
  blue: { label: 'Alb → albastru', colors: ['#fcfcff', '#5a8ac6'] },
  bold: { label: 'Roșu → alb → albastru', colors: ['#f8696b', '#fcfcff', '#5a8ac6'] },
};

/** Culoarea dintre a și b, la t (0–1). */
function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0')).join('');
}

/** Regulile care compară celula cu restul zonei (primele N, media, dublurile), ca în Excel. */
const ZONE_OPS: CondOp[] = ['top', 'bottom', 'above', 'below', 'dup', 'unique'];
export const zoneOp = (op: CondOp) => ZONE_OPS.includes(op);
/** Câte celule ia „primele N” (implicit 10, ca în Excel). */
export const topCount = (v: string) => { const n = Math.round(Number(v.trim().replace(',', '.'))); return Number.isFinite(n) && n >= 1 ? Math.min(n, 1000) : 10; };

/** Culoarea barelor de date pentru fiecare stil (aceleași ca în Excel). */
export const BAR_COLORS: Record<CondLook, string> = {
  red: '#f8696b', yellow: '#ffb628', green: '#63be7b', blue: '#638ec6', bold: '#638ec6',
};

/** Verificările de coduri românești: celula completată care nu trece de cifra de control. */
const BAD_CODE: Partial<Record<CondOp, (s: string) => boolean>> = { badcnp: validCnp, badcui: validCui, badiban: validIban };

/** Regulile pe care Excel nu le poate reproduce (nu are verificarea CNP/CUI/IBAN); nu se scriu în .xlsx. */
export const suiteOnly = (op: CondOp) => op in BAD_CODE;

/** Stilurile gata făcute (aceleași ca în Excel: fundal deschis și text închis din aceeași culoare). */
export const COND_LOOKS: Record<CondLook, { label: string; style: CellStyle }> = {
  red: { label: 'Roșu', style: { bg: '#ffc7ce', color: '#9c0006' } },
  yellow: { label: 'Galben', style: { bg: '#ffeb9c', color: '#9c5700' } },
  green: { label: 'Verde', style: { bg: '#c6efce', color: '#006100' } },
  blue: { label: 'Albastru', style: { bg: '#ddebf7', color: '#1f4e78' } },
  bold: { label: 'Aldin roșu', style: { b: true, color: '#c00000' } },
};

export const MAX_RULES = 50;
const OPS = COND_OPS.map(([k]) => k);
const LOOKS = Object.keys(COND_LOOKS) as CondLook[];

export const needsValue = (op: CondOp) => op !== 'empty' && op !== 'filled' && op !== 'databar' && op !== 'scale' && op !== 'icons' && !(op in BAD_CODE) && (!zoneOp(op) || op === 'top' || op === 'bottom');

interface Box { r0: number; c0: number; r1: number; c1: number }

function box(range: string): Box | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
  if (!m) return null;
  const col = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const [a, b, r0, r1] = [col(m[1]), col(m[3]), Number(m[2]) - 1, Number(m[4]) - 1];
  return { r0: Math.min(r0, r1), r1: Math.max(r0, r1), c0: Math.min(a, b), c1: Math.max(a, b) };
}

const num = (s: string): number | null => (isNumber(s) ? Number(s.trim().replace(',', '.')) : null);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('ro-RO').trim();

/** Valoarea celulei pentru comparare: numărul (și din formule) sau textul afișat. */
function valueOf(raw: string | undefined, res: Result | undefined): { n: number | null; s: string } {
  if (res) return res.err ? { n: null, s: res.text } : { n: res.num && res.value !== undefined ? res.value : null, s: res.text };
  const s = raw ?? '';
  return { n: num(s), s };
}

/** Se potrivește regula pe valoarea dată? Numerele se compară ca numere, textele fără diacritice și litere mari. */
export function ruleMatches(rule: SheetRule, raw: string | undefined, res?: Result): boolean {
  const { n, s } = valueOf(raw, res);
  if (rule.op === 'empty') return s.trim() === '';
  if (rule.op === 'filled') return s.trim() !== '';
  if (rule.op === 'databar' || rule.op === 'scale' || rule.op === 'icons' || zoneOp(rule.op)) return false;
  if (s.trim() === '') return false;
  const check = BAD_CODE[rule.op];
  if (check) return !check(s);
  if (rule.op === 'text') return !!rule.v1.trim() && fold(s).includes(fold(rule.v1));
  const a = num(rule.v1);
  if (rule.op === 'eq' || rule.op === 'ne') {
    const same = a !== null && n !== null ? n === a : fold(s) === fold(rule.v1);
    return rule.op === 'eq' ? same : !same;
  }
  if (n === null || a === null) return false;
  switch (rule.op) {
    case 'gt': return n > a;
    case 'lt': return n < a;
    case 'ge': return n >= a;
    case 'le': return n <= a;
    case 'between': {
      const b = num(rule.v2 ?? '');
      return b !== null && n >= Math.min(a, b) && n <= Math.max(a, b);
    }
  }
  return false;
}

/** Ce stil primește fiecare celulă din reguli (regula pusă ultima câștigă). Doar celulele atinse apar aici. */
export function condLooks(rules: SheetRule[] | undefined, cells: Record<string, string>, results: Record<string, Result>, book?: SheetBook): Record<string, CondLook> {
  const out: Record<string, CondLook> = {};
  for (const rule of rules ?? []) {
    const g = box(rule.range);
    if (!g) continue;
    if (rule.op === 'formula') {
      for (const id of formulaMatches(rule.v1, g, cells, book)) out[id] = rule.look;
      continue;
    }
    if (zoneOp(rule.op)) {
      for (const id of zoneMatches(rule, g, cells, results)) out[id] = rule.look;
      continue;
    }
    // Pentru „e goală” trebuie să trecem prin toate celulele; altfel ajung cele completate.
    if (rule.op === 'empty') {
      const end = Math.min(g.r1, workEnd(cells));
      for (let r = g.r0; r <= end; r++) for (let c = g.c0; c <= g.c1; c++) {
        const id = cellId(r, c);
        if (ruleMatches(rule, cells[id], results[id])) out[id] = rule.look;
      }
      continue;
    }
    for (const id of Object.keys(cells)) {
      const m = /^([A-Z]+)(\d+)$/.exec(id);
      if (!m) continue;
      const r = Number(m[2]) - 1;
      const c = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      if (r < g.r0 || r > g.r1 || c < g.c0 || c > g.c1) continue;
      if (ruleMatches(rule, cells[id], results[id])) out[id] = rule.look;
    }
  }
  return out;
}

const SELF_POS = /(?<![\p{L}\d_.])(ROW|RÂND|COLUMN|COLOANĂ)\(\s*\)/giu;

/** Cele mai multe celule verificate de o regulă cu formulă (fiecare e o formulă calculată). */
export const MAX_FORMULA_CELLS = 20000;

/** Rezultatul unei formule e „adevărat”: ADEVĂRAT sau un număr diferit de zero (ca în Excel); erorile nu. */
export function truthy(r: Result | undefined): boolean {
  if (!r || r.err) return false;
  if (r.num) return (r.value ?? Number(r.text)) !== 0;
  const t = r.text.trim().toUpperCase();
  return t === 'ADEVĂRAT' || t === 'TRUE';
}

/**
 * Regula cu formulă (ca în Excel: „Utilizați o formulă…”): formula e scrisă pentru prima celulă a zonei și se mută pentru
 * fiecare celulă, ca la copiere ($C2 rămâne pe coloana C, rândul se schimbă). Celulele unde dă ADEVĂRAT se colorează.
 */
export function formulaMatches(formula: string, g: { r0: number; r1: number; c0: number; c1: number }, cells: Record<string, string>, book?: SheetBook): string[] {
  const src = formula.trim();
  if (!src || src === '=') return [];
  const f = src.startsWith('=') ? src : '=' + src;
  const end = Math.min(g.r1, workEnd(cells));
  const temp: Record<string, string> = { ...cells };
  const map: [string, string][] = [];
  // Formulele se calculează în celule ajutătoare, în colțul de jos al foii (unde nu scrie nimeni).
  for (let r = g.r0; r <= end && map.length < MAX_FORMULA_CELLS; r++) {
    for (let c = g.c0; c <= g.c1 && map.length < MAX_FORMULA_CELLS; c++) {
      const host = cellId(ROWS - 1 - (map.length % 1000), COLS - 1 - Math.floor(map.length / 1000));
      // RÂND() / COLOANĂ() fără argument se referă la celula verificată (pentru dungi: =MOD(RÂND();2)=0), nu la cea ajutătoare.
      temp[host] = shiftFormula(f, r - g.r0, c - g.c0).replace(SELF_POS, (_m, fn: string) => `${fn}(${cellId(r, c)})`);
      map.push([cellId(r, c), host]);
    }
  }
  if (!map.length) return [];
  const res = evaluateAll(temp, book, undefined, map.map(([, h]) => h));
  return map.filter(([, h]) => truthy(res[h])).map(([id]) => id);
}

/** Celulele dintr-o coloană (rândurile r0–r1) care trec regula: pentru filtrele cu condiție. */
export function columnMatches(rule: SheetRule, c: number, r0: number, r1: number, cells: Record<string, string>, results: Record<string, Result>): Set<string> {
  if (zoneOp(rule.op)) return new Set(zoneMatches(rule, { r0, r1, c0: c, c1: c }, cells, results));
  const out = new Set<string>();
  for (let r = r0; r <= r1; r++) { const id = cellId(r, c); if (ruleMatches(rule, cells[id], results[id])) out.add(id); }
  return out;
}

/** Celulele din zonă care trec o regulă „pe zonă”: primele / ultimele N (cu egalitățile), peste / sub medie, dubluri / unice. */
function zoneMatches(rule: SheetRule, g: Box, cells: Record<string, string>, results: Record<string, Result>): string[] {
  const vals: { id: string; n: number | null; s: string }[] = [];
  const end = Math.min(g.r1, lastUsedRow(cells));
  for (let r = g.r0; r <= end; r++) for (let c = g.c0; c <= g.c1; c++) {
    const id = cellId(r, c);
    if ((cells[id] ?? '').trim() === '') continue;
    vals.push({ id, ...valueOf(cells[id], results[id]) });
  }
  const nums = vals.filter((v): v is { id: string; n: number; s: string } => v.n !== null && Number.isFinite(v.n));
  if (rule.op === 'top' || rule.op === 'bottom') {
    if (!nums.length) return [];
    const sorted = nums.map((v) => v.n).sort((a, b) => (rule.op === 'top' ? b - a : a - b));
    const edge = sorted[Math.min(topCount(rule.v1), sorted.length) - 1];
    return nums.filter((v) => (rule.op === 'top' ? v.n >= edge : v.n <= edge)).map((v) => v.id);
  }
  if (rule.op === 'above' || rule.op === 'below') {
    if (!nums.length) return [];
    const avg = nums.reduce((a, v) => a + v.n, 0) / nums.length;
    return nums.filter((v) => (rule.op === 'above' ? v.n > avg : v.n < avg)).map((v) => v.id);
  }
  // Dublurile: același număr sau același text (fără diacritice și litere mari, ca în Excel).
  const key = (v: { n: number | null; s: string }) => (v.n !== null ? 'n' + v.n : 's' + fold(v.s));
  const count = new Map<string, number>();
  for (const v of vals) count.set(key(v), (count.get(key(v)) ?? 0) + 1);
  return vals.filter((v) => (rule.op === 'dup' ? count.get(key(v))! > 1 : count.get(key(v)) === 1)).map((v) => v.id);
}

/**
 * Barele de date: fiecare număr din zonă primește o bară cât o parte din celulă, după mărimea lui față de cel mai mare
 * (ca în Excel). Valoarea e „culoare:procent”, ca rândurile să se redeseneze doar când se schimbă ceva.
 * Scalele de culori intră tot aici, ca „bg:#rrggbb” (fundalul celulei), iar pictogramele ca „ic:<set>:<nivel>”.
 */
export function dataBars(rules: SheetRule[] | undefined, cells: Record<string, string>, results: Record<string, Result>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of rules ?? []) {
    if (rule.op !== 'databar' && rule.op !== 'scale' && rule.op !== 'icons') continue;
    const g = box(rule.range);
    if (!g) continue;
    const vals: [string, number][] = [];
    const end = Math.min(g.r1, lastUsedRow(cells));
    for (let r = g.r0; r <= end; r++) for (let c = g.c0; c <= g.c1; c++) {
      const id = cellId(r, c);
      const { n } = valueOf(cells[id], results[id]);
      if (n !== null && Number.isFinite(n) && (cells[id] ?? '').trim() !== '') vals.push([id, n]);
    }
    if (!vals.length) continue;
    if (rule.op === 'scale') {
      for (const [id, color] of scaleColors(vals, SCALES[rule.look].colors)) out[id] = 'bg:' + color;
      continue;
    }
    if (rule.op === 'icons') {
      for (const [id, level] of iconLevels(vals)) out[id] = `ic:${rule.look}:${level}`;
      continue;
    }
    const lo = Math.min(0, ...vals.map(([, n]) => n));
    const hi = Math.max(...vals.map(([, n]) => n));
    for (const [id, n] of vals) {
      const pct = hi > lo ? Math.round(((n - lo) / (hi - lo)) * 100) : 100;
      out[id] = `${BAR_COLORS[rule.look]}:${Math.max(0, Math.min(100, pct))}`;
    }
  }
  return out;
}

/** Nivelul pictogramei: 0 de la 67 % din interval în sus, 1 de la 33 %, altfel 2 (pragurile implicite din Excel). */
export function iconLevels(vals: [string, number][]): [string, number][] {
  const ns = vals.map(([, n]) => n);
  const lo = Math.min(...ns), hi = Math.max(...ns);
  return vals.map(([id, n]) => {
    const p = hi > lo ? ((n - lo) / (hi - lo)) * 100 : 100;
    return [id, p >= 67 ? 0 : p >= 33 ? 1 : 2];
  });
}

/** Culorile scalei pentru fiecare valoare: între minim și maxim; la 3 culori, mijlocul e percentila 50 (ca în Excel). */
export function scaleColors(vals: [string, number][], colors: string[]): [string, string][] {
  const ns = vals.map(([, n]) => n).sort((a, b) => a - b);
  const lo = ns[0], hi = ns[ns.length - 1];
  const k = (ns.length - 1) / 2;
  const mid = ns[Math.floor(k)] + (ns[Math.ceil(k)] - ns[Math.floor(k)]) * (k - Math.floor(k));
  return vals.map(([id, n]) => {
    if (hi === lo) return [id, colors.length === 3 ? colors[1] : colors[0]];
    if (colors.length === 2) return [id, mix(colors[0], colors[1], (n - lo) / (hi - lo))];
    if (n <= mid) return [id, mid > lo ? mix(colors[0], colors[1], (n - lo) / (mid - lo)) : colors[1]];
    return [id, hi > mid ? mix(colors[1], colors[2], (n - mid) / (hi - mid)) : colors[1]];
  });
}

/** Descrierea regulii pentru listă: „C2:C50: mai mare decât 1000 → Verde”. */
export function describeRule(rule: SheetRule): string {
  if (rule.op === 'scale') return `${rule.range}: scală de culori ${SCALES[rule.look].label}`;
  if (rule.op === 'icons') return `${rule.range}: pictograme ${ICON_SETS[rule.look].label}`;
  if (rule.op === 'formula') return `${rule.range}: formula ${rule.v1.trim()} → ${COND_LOOKS[rule.look].label}`;
  const op = (COND_OPS.find(([k]) => k === rule.op)?.[1] ?? rule.op).replace(' (câte?)', '');
  const val = rule.op === 'top' || rule.op === 'bottom' ? ` ${topCount(rule.v1)}` : !needsValue(rule.op) ? '' : rule.op === 'between' ? ` ${rule.v1} și ${rule.v2 ?? ''}` : rule.op === 'text' ? ` „${rule.v1}”` : ` ${rule.v1}`;
  return `${rule.range}: ${op}${val} → ${COND_LOOKS[rule.look].label}`;
}

export function cleanRules(raw: unknown): SheetRule[] {
  if (!Array.isArray(raw)) return [];
  const out: SheetRule[] = [];
  for (const x of raw.slice(0, MAX_RULES)) {
    if (!x || typeof x !== 'object') continue;
    const { range, op, v1, v2, look } = x as Record<string, unknown>;
    if (typeof range !== 'string' || !box(range) || !OPS.includes(op as CondOp)) continue;
    out.push({
      range,
      op: op as CondOp,
      v1: typeof v1 === 'string' ? v1.slice(0, 200) : '',
      ...(op === 'between' && typeof v2 === 'string' ? { v2: v2.slice(0, 200) } : {}),
      look: LOOKS.includes(look as CondLook) ? look as CondLook : 'yellow',
    });
  }
  return out;
}
