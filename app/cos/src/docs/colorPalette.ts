// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Paleta de culori din Docs (culoarea textului și evidențierea): culorile temei documentului, fiecare cu nuanțe mai
// deschise și mai închise, culorile standard și ultimele culori folosite.
import { THEME_COLORS, themeColorsOf, type DocStyles } from './docStyles';

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Culoarea amestecată cu alb (k > 0, de exemplu 0.6 = cu 60% mai deschisă) sau cu negru (k < 0). */
export function shade(hex: string, k: number): string {
  const c = rgb(hex);
  return '#' + c.map((v) => hex2(k >= 0 ? v + (255 - v) * k : v * (1 + k))).join('');
}

/** Nuanțele unei coloane din paletă (sub culoarea de bază): 3 mai deschise și 2 mai închise; la alb doar mai închise, la negru doar mai deschise. */
export function shadesOf(hex: string): string[] {
  const [r, g, b] = rgb(hex);
  const lum = (r * 299 + g * 587 + b * 114) / 1000;
  if (lum > 240) return [-0.05, -0.15, -0.25, -0.35, -0.5].map((k) => shade(hex, k));
  if (lum < 20) return [0.5, 0.35, 0.25, 0.15, 0.05].map((k) => shade(hex, k));
  return [0.8, 0.6, 0.4, -0.25, -0.5].map((k) => shade(hex, k));
}

/** Culorile temei documentului: textul (negru), fundalul (alb) și culorile titlurilor (din ◧ Stiluri → Culorile temei). */
export function themeColumns(styles: DocStyles | undefined): { name: string; colors: string[] } {
  const id = themeColorsOf(styles) || 'albastru';
  const t = THEME_COLORS.find(([k]) => k === id)!;
  return { name: t[1], colors: [...new Set(['#000000', '#ffffff', t[2], t[3], t[4]])] };
}

export const STANDARD_COLORS: [string, string][] = [
  ['#c00000', 'Roșu închis'], ['#ff0000', 'Roșu'], ['#ffc000', 'Portocaliu'], ['#ffff00', 'Galben'], ['#92d050', 'Verde deschis'],
  ['#00b050', 'Verde'], ['#00b0f0', 'Albastru deschis'], ['#0070c0', 'Albastru'], ['#002060', 'Albastru închis'], ['#7030a0', 'Violet'],
];

/** Culorile de evidențiere (cele care se scriu cu numele lor în .docx). */
export const HIGHLIGHT_COLORS: [string, string][] = [
  ['#ffff00', 'Galben'], ['#00ff00', 'Verde aprins'], ['#00ffff', 'Turcoaz'], ['#ff00ff', 'Roz'], ['#0000ff', 'Albastru'],
  ['#ff0000', 'Roșu'], ['#000080', 'Albastru închis'], ['#008080', 'Verde-albastru'], ['#008000', 'Verde'], ['#800080', 'Violet'],
  ['#800000', 'Roșu închis'], ['#808000', 'Galben închis'], ['#808080', 'Gri 50%'], ['#c0c0c0', 'Gri 25%'], ['#000000', 'Negru'],
];

/** Lista culorilor recente: cea nouă prima, fără dubluri, cel mult `max`. */
export function pushRecent(list: string[], c: string, max = 10): string[] {
  const k = c.toLowerCase();
  return [k, ...list.filter((x) => x.toLowerCase() !== k)].slice(0, max);
}
