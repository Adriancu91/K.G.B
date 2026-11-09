// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Minigraficele din celule (ca Sparklines): o linie, coloane sau câștig / pierdere desenate chiar în celulă, din numerele unei zone
// (un rând sau o coloană). Se redesenează singure când se schimbă datele. Desenul e SVG, pus ca fundal al celulei.
import { cellId, isNumber } from './format';
import type { Result } from './formula';

export type SparkKind = 'line' | 'col' | 'winloss';
export const SPARK_KINDS: [SparkKind, string][] = [['line', 'Linie'], ['col', 'Coloane'], ['winloss', 'Câștig / pierdere']];
export interface SheetSpark { at: string; range: string; kind: SparkKind; color?: string }
export const SPARK_MAX = 200;
const DEF_COLOR = '#2f6fdf', NEG = '#d93025', COLOR = /^#[0-9a-f]{6}$/i;

interface Box { r0: number; c0: number; r1: number; c1: number }
const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
export function sparkBox(range: string): Box | null {
  const m = /^([A-Z]{1,3})([0-9]+):([A-Z]{1,3})([0-9]+)$/.exec(range.trim().toUpperCase().split('$').join(''));
  if (!m) return null;
  const [a, b, r0, r1] = [colNum(m[1]), colNum(m[3]), Number(m[2]) - 1, Number(m[4]) - 1];
  if (r0 < 0 || r1 < 0) return null;
  return { r0: Math.min(r0, r1), r1: Math.max(r0, r1), c0: Math.min(a, b), c1: Math.max(a, b) };
}
const CELL = /^[A-Z]{1,3}[1-9][0-9]*$/;

/** Minigraficele valide (cel mult unul pe celulă, zona de cel mult 1000 de celule). */
export function cleanSparks(v: unknown): SheetSpark[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: SheetSpark[] = [];
  for (const x of v as Partial<SheetSpark>[]) {
    const at = typeof x?.at === 'string' ? x.at.toUpperCase() : '';
    const range = typeof x?.range === 'string' ? x.range.toUpperCase().split('$').join('') : '';
    const g = sparkBox(range);
    if (!CELL.test(at) || !g || seen.has(at) || (g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1) > 1000) continue;
    seen.add(at);
    const kind = SPARK_KINDS.some(([k]) => k === x.kind) ? x.kind as SparkKind : 'line';
    out.push({ at, range, kind, ...(typeof x.color === 'string' && COLOR.test(x.color) && x.color.toLowerCase() !== DEF_COLOR ? { color: x.color.toLowerCase() } : {}) });
    if (out.length >= SPARK_MAX) break;
  }
  return out;
}

/** Numerele zonei, în ordine (rând cu rând); celulele goale sau cu text lipsesc (null), ca graficul să aibă o pauză. */
export function sparkValues(range: string, cells: Record<string, string>, results: Record<string, Result>): (number | null)[] {
  const g = sparkBox(range);
  if (!g) return [];
  const out: (number | null)[] = [];
  for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) {
    const id = cellId(r, c), res = results[id], raw = cells[id] ?? '';
    let n: number | null = null;
    if (res) n = !res.err && res.num && res.value !== undefined ? res.value : null;
    else if (raw.trim() && isNumber(raw)) n = Number(raw.trim().replace(',', '.'));
    out.push(n !== null && Number.isFinite(n) ? n : null);
  }
  return out;
}

const f = (n: number) => n.toFixed(1);
/** Desenul minigraficului într-un dreptunghi de w × h (SVG). Fără numere, întoarce un SVG gol. */
export function sparkSvg(vals: (number | null)[], kind: SparkKind, color = DEF_COLOR, w = 100, h = 20): string {
  const nums = vals.filter((v): v is number => v !== null);
  const parts: string[] = [];
  const n = vals.length, pad = 2;
  if (nums.length && n) {
    const lo = Math.min(...nums), hi = Math.max(...nums);
    if (kind === 'line') {
      const y = (v: number) => (hi > lo ? pad + (h - 2 * pad) * (1 - (v - lo) / (hi - lo)) : h / 2);
      const x = (i: number) => (n > 1 ? pad + ((w - 2 * pad) * i) / (n - 1) : w / 2);
      let d = '', pen = false;
      vals.forEach((v, i) => { if (v === null) { pen = false; return; } d += (pen ? ' L' : ' M') + f(x(i)) + ' ' + f(y(v)); pen = true; });
      parts.push(`<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`);
      // Punctul cel mai înalt și cel mai jos, ca să se vadă ușor.
      const iHi = vals.indexOf(hi), iLo = vals.indexOf(lo);
      if (nums.length > 1) parts.push(`<circle cx="${f(x(iHi))}" cy="${f(y(hi))}" r="2" fill="${color}"/><circle cx="${f(x(iLo))}" cy="${f(y(lo))}" r="2" fill="${NEG}"/>`);
      else parts.push(`<circle cx="${f(x(vals.indexOf(nums[0])))}" cy="${f(h / 2)}" r="2" fill="${color}"/>`);
    } else {
      const bw = (w - 2 * pad) / n, gap = Math.min(2, bw * 0.2);
      if (kind === 'col') {
        const top = Math.max(0, hi), bot = Math.min(0, lo), span = top - bot || 1;
        const zero = pad + (h - 2 * pad) * (top / span);
        vals.forEach((v, i) => {
          if (v === null) return;
          const y0 = pad + (h - 2 * pad) * ((top - Math.max(v, 0)) / span), y1 = pad + (h - 2 * pad) * ((top - Math.min(v, 0)) / span);
          parts.push(`<rect x="${f(pad + i * bw + gap / 2)}" y="${f(y0)}" width="${f(Math.max(0.5, bw - gap))}" height="${f(Math.max(0.8, y1 - y0))}" fill="${v < 0 ? NEG : color}"/>`);
        });
        if (bot < 0) parts.push(`<rect x="${pad}" y="${f(zero - 0.25)}" width="${f(w - 2 * pad)}" height="0.5" fill="#888"/>`);
      } else {
        vals.forEach((v, i) => {
          if (v === null || v === 0) return;
          const hh = (h - 2 * pad) / 2 - 1;
          parts.push(`<rect x="${f(pad + i * bw + gap / 2)}" y="${f(v > 0 ? pad : h / 2 + 1)}" width="${f(Math.max(0.5, bw - gap))}" height="${f(hh)}" fill="${v < 0 ? NEG : color}"/>`);
        });
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${parts.join('')}</svg>`;
}

/** Pentru fiecare celulă cu minigrafic: „sp:” + adresa desenului (se pune ca fundal, ca barele de date). */
export function sparkMap(sparks: SheetSpark[] | undefined, cells: Record<string, string>, results: Record<string, Result>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of sparks ?? []) {
    const svg = sparkSvg(sparkValues(s.range, cells, results), s.kind, s.color ?? DEF_COLOR);
    out[s.at] = 'sp:url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }
  return out;
}

/** Zona de date implicită pentru o selecție: chiar selecția; locul implicit: celula din dreapta rândului (sau sub coloană). */
export function sparkPlace(sel: Box): { range: string; at: string } {
  const name = (c: number) => { let s = ''; for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
  const range = `${name(sel.c0)}${sel.r0 + 1}:${name(sel.c1)}${sel.r1 + 1}`;
  const tallOnly = sel.c0 === sel.c1 && sel.r1 > sel.r0;
  const at = tallOnly ? `${name(sel.c0)}${sel.r1 + 2}` : `${name(sel.c1 + 1)}${sel.r0 + 1}`;
  return { range, at };
}
