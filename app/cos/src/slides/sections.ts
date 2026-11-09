// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Secțiunile prezentării (ca Sections din PowerPoint): grupuri de slide-uri cu nume, în lista din stânga.
// O secțiune începe la slide-ul care are `section` (numele ei) și ține până la următorul slide cu `section`.
// Când există secțiuni, primul slide are mereu una („Secțiune implicită”), ca în PowerPoint.
import type { Slide } from './model';

export const DEFAULT_SECTION = 'Secțiune implicită';
export const NEW_SECTION = 'Secțiune fără nume';

/** Numele unei secțiuni dintr-un fișier: text nevid, cel mult 100 de caractere. */
export const cleanSection = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : undefined);

export interface Section { name: string; from: number; to: number }

/** Secțiunile, în ordine: de la slide-ul `from` până înainte de `to`. */
export function sectionsOf(slides: Slide[]): Section[] {
  const out: Section[] = [];
  slides.forEach((s, i) => {
    if (s.section === undefined) return;
    if (out.length) out[out.length - 1].to = i;
    out.push({ name: s.section, from: i, to: slides.length });
  });
  return out;
}

/** Secțiunea în care e slide-ul `i` (indice în sectionsOf), sau -1. */
export function sectionAt(slides: Slide[], i: number): number {
  return sectionsOf(slides).findIndex((x) => i >= x.from && i < x.to);
}

const strip = (s: Slide): Slide => { if (s.section === undefined) return s; const { section: _s, ...rest } = s; return rest; };
const mark = (s: Slide, name: string): Slide => (s.section === name ? s : { ...s, section: name });

/** Pune numele secțiunilor înapoi pe slide-uri: numele apare pe primul slide din fiecare șir cu aceeași cheie. */
function rebuild(slides: Slide[], keys: number[], names: string[]): Slide[] {
  return slides.map((s, i) => (keys[i] >= 0 && (i === 0 || keys[i - 1] !== keys[i]) ? mark(s, names[keys[i]]) : strip(s)));
}

function keysOf(slides: Slide[]): { keys: number[]; names: string[] } {
  const names: string[] = [];
  let k = -1;
  const keys = slides.map((s) => { if (s.section !== undefined) { names.push(s.section); k = names.length - 1; } return k; });
  return { keys, names };
}

/** Mută slide-ul de la `from` astfel încât să ajungă la locul `to`; secțiunile rămân pe loc, iar slide-ul mutat intră în secțiunea
 *  în care l-ai lăsat (a slide-ului de dinaintea lui). O secțiune rămasă goală dispare. */
export function relocate(slides: Slide[], from: number, to: number): Slide[] {
  if (from === to || from < 0 || from >= slides.length) return slides;
  const { keys, names } = keysOf(slides);
  const s = slides.slice(), k = keys.slice();
  const [m] = s.splice(from, 1);
  k.splice(from, 1);
  const at = Math.max(0, Math.min(to, s.length));
  const key = at > 0 ? k[at - 1] : (k[0] ?? -1);
  s.splice(at, 0, m);
  k.splice(at, 0, key);
  if (!names.length) return s;
  return rebuild(s, k, names);
}

/** Șterge slide-ul `i`; dacă începea o secțiune, ea începe acum la slide-ul următor (dacă el e tot în ea). */
export function removeAt(slides: Slide[], i: number): Slide[] {
  const s = slides.slice();
  const gone = s[i];
  if (gone?.section !== undefined && s[i + 1] && s[i + 1].section === undefined) s[i + 1] = mark(s[i + 1], gone.section);
  s.splice(i, 1);
  return s;
}

/** Secțiune nouă care începe la slide-ul `i`; slide-urile dinainte primesc „Secțiune implicită” dacă nu erau în nicio secțiune. */
export function addSection(slides: Slide[], i: number, name = NEW_SECTION): Slide[] {
  return slides.map((s, j) => (j === i ? mark(s, name) : j === 0 && i > 0 && s.section === undefined ? mark(s, DEFAULT_SECTION) : s));
}

export function renameSection(slides: Slide[], from: number, name: string): Slide[] {
  const n = cleanSection(name);
  return n && slides[from]?.section !== undefined ? slides.map((s, j) => (j === from ? mark(s, n) : s)) : slides;
}

/** Elimină secțiunea care începe la `from` (slide-urile rămân): ele trec în secțiunea de dinainte.
 *  Prima secțiune se unește cu următoarea, care îi ia locul. Dacă rămâne una singură, numită implicit, dispare și ea. */
export function removeSection(slides: Slide[], from: number): Slide[] {
  const list = sectionsOf(slides);
  const k = list.findIndex((x) => x.from === from);
  if (k < 0) return slides;
  let out: Slide[];
  if (k === 0 && list[1]) out = slides.map((s, j) => (j === 0 ? mark(s, list[1].name) : j === list[1].from ? strip(s) : s));
  else out = slides.map((s, j) => (j === from ? strip(s) : s));
  const left = sectionsOf(out);
  return left.length === 1 && left[0].name === DEFAULT_SECTION && left[0].from === 0 ? out.map(strip) : out;
}

export const removeAllSections = (slides: Slide[]): Slide[] => slides.map(strip);

/** Mută toată secțiunea care începe la `from` înaintea secțiunii de dinainte (-1) sau după cea de după (1).
 *  Întoarce slide-urile noi și locul unde a ajuns secțiunea. */
export function moveSection(slides: Slide[], from: number, dir: -1 | 1): { slides: Slide[]; at: number } {
  const list = sectionsOf(slides);
  const k = list.findIndex((x) => x.from === from);
  const o = k + dir;
  if (k < 0 || o < 0 || o >= list.length) return { slides, at: from };
  const [a, b] = dir < 0 ? [list[o], list[k]] : [list[k], list[o]];
  const blockA = slides.slice(a.from, a.to), blockB = slides.slice(b.from, b.to);
  const out = [...slides.slice(0, a.from), ...blockB, ...blockA, ...slides.slice(b.to)];
  return { slides: out, at: dir < 0 ? a.from : a.from + blockB.length };
}

/** Numele unice pentru fișierele .pptx (programul care le scrie le caută după nume): „Capitol”, „Capitol (2)”. */
export function uniqueNames(slides: Slide[]): Map<number, string> {
  const seen = new Map<string, number>(), out = new Map<number, string>();
  // Fiecare slide trebuie să fie într-o secțiune: cele de la început, fără, primesc „Secțiune implicită”.
  const any = slides.some((s) => s.section !== undefined);
  slides.forEach((s, i) => {
    const name = s.section ?? (any && i === 0 ? DEFAULT_SECTION : undefined);
    if (name === undefined) return;
    const c = (seen.get(name) ?? 0) + 1;
    seen.set(name, c);
    out.set(i, c === 1 ? name : `${name} (${c})`);
  });
  return out;
}

/** Zoom de secțiune: ultimul slide al secțiunii care conține slide-ul `j` (fără secțiuni: chiar `j`). */
export function sectionEnd(slides: Slide[], j: number): number {
  const s = sectionsOf(slides).find((x) => j >= x.from && j < x.to);
  return s ? s.to - 1 : j;
}

/** Câte miniaturi are cel mult un zoom de rezumat. */
export const SUMMARY_MAX = 12;
/**
 * Zoom de rezumat: slide-urile la care sare rezumatul: primul slide al fiecărei secțiuni (cu numele ei);
 * fără secțiuni (sau cu una singură), fiecare slide. Cel mult SUMMARY_MAX.
 */
export function summaryTargets(slides: Slide[]): { to: string; name: string; sec?: boolean }[] {
  const sec = sectionsOf(slides);
  const list = sec.length >= 2 ? sec.map((x) => ({ to: slides[x.from].id, name: x.name, sec: true })) : slides.map((x, i) => ({ to: x.id, name: `Slide ${i + 1}` }));
  return list.slice(0, SUMMARY_MAX);
}
/** Locurile miniaturilor pe slide-ul de rezumat: o grilă sub titlu, cu miniaturile la proporția slide-ului, centrată. */
export function summaryGrid(n: number, size: { w: number; h: number }): { x: number; y: number; w: number; h: number }[] {
  if (n <= 0) return [];
  const top = size.h * 0.24, bottom = size.h * 0.06, side = size.w * 0.06, gap = size.w * 0.025;
  const cols = n <= 3 ? n : n === 4 ? 2 : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols);
  const ar = size.h / size.w;
  const cw = Math.min(size.w * 0.42, (size.w - 2 * side - gap * (cols - 1)) / cols, (size.h - top - bottom - gap * (rows - 1)) / rows / ar);
  const ch = cw * ar, gw = cols * cw + (cols - 1) * gap, gh = rows * ch + (rows - 1) * gap;
  const x0 = (size.w - gw) / 2, y0 = top + (size.h - top - bottom - gh) / 2;
  return Array.from({ length: n }, (_, k) => {
    const r = Math.floor(k / cols), c = k % cols, inRow = r === rows - 1 ? n - r * cols : cols;
    const xr = x0 + (gw - (inRow * cw + (inRow - 1) * gap)) / 2;
    return { x: Math.round(xr + c * (cw + gap)), y: Math.round(y0 + r * (ch + gap)), w: Math.round(cw), h: Math.round(ch) };
  });
}
