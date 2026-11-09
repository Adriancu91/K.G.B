// @ts-nocheck — copiat din Cyber Office Studio (src/pdf/redactFind.ts, plus `fold` din find.ts), aplicația proprietarului
//   (D-071), fără schimbări de logică; K.G.B. verifică tablourile mai strict decât proiectul de origine.
//   Testat în tests/redactfind.test.mjs.
// „Caută și redactează” (ca „Find Text & Redact” din Acrobat): găsește în textul PDF-ului CNP-uri, e-mailuri, telefoane,
// IBAN-uri sau cuvinte alese și întoarce dreptunghiurile lor pe pagină (puncte, pagina așa cum se vede), ca să fie redactate.
// `fold` din find.ts (Cyber Office Studio), adus aici ca fișierul să stea singur.
/** Un caracter → forma lui de căutare, tot un singur caracter (ca pozițiile să rămână aceleași). */
function foldChar(c: string): string {
  const n = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return n.length === 1 ? n : c.toLowerCase().length === 1 ? c.toLowerCase() : c;
}

export function fold(s: string): string {
  let out = '';
  for (const c of s) out += foldChar(c);
  return out;
}


export type RedactKind = 'cnp' | 'email' | 'phone' | 'iban' | 'words';
export const REDACT_KINDS: [RedactKind, string, string][] = [
  ['cnp', 'CNP', '[CNP]'],
  ['email', 'E-mail', '[e-mail]'],
  ['phone', 'Telefon', '[telefon]'],
  ['iban', 'IBAN (cont bancar)', '[IBAN]'],
];

export interface FoundSpan { kind: RedactKind; text: string; start: number; end: number }

/** CNP-ul are o cifră de control: așa nu redactăm orice număr de 13 cifre (coduri de bare, numere de dosar). */
export function validCnp(s: string): boolean {
  if (!/^[1-9]\d{12}$/.test(s)) return false;
  const key = '279146358279';
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * Number(key[i]);
  const c = sum % 11 === 10 ? 1 : sum % 11;
  return c === Number(s[12]);
}

const PATTERNS: Record<Exclude<RedactKind, 'words'>, RegExp> = {
  cnp: /(?<![\d])[1-9]\d{12}(?![\d])/g,
  email: /[\p{L}\d._%+-]+@[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.\p{L}{2,}/gu,
  // Mobile și fixe din România (+40 / 0040 / 0 și 9 cifre), grupate oricum, cu spații, puncte sau liniuțe.
  phone: /(?<![\d+])(?:\+40|0040|0)[\s.-]?[237](?:[\s.-]?\d){8}(?![\d])/g,
  iban: /\b[A-Z]{2}\d{2}(?:\s?[A-Z\d]{4}){3,7}(?:\s?[A-Z\d]{1,4})?\b/g,
};

/**
 * Bucățile de text de redactat. `words`: cuvintele sau expresiile, câte una pe rând sau despărțite prin virgulă;
 * literele mari și diacriticele nu contează („popescu” găsește „POPESCU” și „Popescu”).
 */
export function findSensitive(text: string, kinds: RedactKind[], words = ''): FoundSpan[] {
  const out: FoundSpan[] = [];
  for (const k of kinds) {
    if (k === 'words') continue;
    for (const m of text.matchAll(PATTERNS[k])) {
      const s = m[0];
      if (k === 'cnp' && !validCnp(s)) continue;
      if (k === 'iban' && !/^RO\d{2}/.test(s) && s.replace(/\s/g, '').length < 15) continue;
      out.push({ kind: k, text: s, start: m.index!, end: m.index! + s.length });
    }
  }
  if (kinds.includes('words')) {
    const hay = fold(text);
    for (const w of words.split(/[\n,;]+/).map((x) => fold(x.trim())).filter(Boolean)) {
      for (let at = hay.indexOf(w); at >= 0; at = hay.indexOf(w, at + w.length)) {
        out.push({ kind: 'words', text: text.slice(at, at + w.length), start: at, end: at + w.length });
      }
    }
  }
  // Fără suprapuneri: o bucată cuprinsă în alta mai lungă (de ex. telefon în IBAN) se lasă deoparte.
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  return out.filter((s, i) => !out.some((o, j) => j !== i && o.start <= s.start && o.end >= s.end && (o.end - o.start > s.end - s.start || j < i)));
}

/** O bucată de text de la pdf.js, cu poziția ei (matricea textului) și lățimea, în puncte PDF. */
export interface TextItem { str: string; transform: number[]; width: number; hasEOL?: boolean }
export interface Viewport { convertToViewportRectangle(rect: number[]): number[] }
export interface RedactBox { x: number; y: number; w: number; h: number; kind: RedactKind; text: string }

/**
 * Pe o pagină: unește bucățile de text (rândurile cu spațiu între ele), caută și transformă fiecare potrivire în dreptunghiuri,
 * câte unul pe fiecare bucată atinsă, cu marginea în jur ca să acopere tot (și literele cu codiță). `measure` dă lățimea unui șir
 * (în orice unitate) cu fontul bucății, ca literele late și cele înguste să nu fie socotite la fel.
 */
export function findBoxes(items: TextItem[], vp: Viewport, kinds: RedactKind[], words = '', measure?: (it: TextItem, s: string) => number): RedactBox[] {
  let joined = '';
  const owner: { item: number; off: number }[] = [];
  items.forEach((it, i) => {
    for (let k = 0; k < it.str.length; k++) { owner.push({ item: i, off: k }); joined += it.str[k]; }
    if (it.hasEOL || (i + 1 < items.length && !/\s$/.test(it.str))) {
      // Între bucăți punem un spațiu doar dacă e rând nou sau bucățile nu se ating (altfel „071” + „2345678” rămâne lipit).
      const next = items[i + 1];
      const gap = next ? Math.abs(next.transform[4] - (it.transform[4] + it.width)) > Math.hypot(it.transform[2], it.transform[3]) * 0.25 : true;
      if (it.hasEOL || gap || Math.abs((next?.transform[5] ?? 0) - it.transform[5]) > 1) { owner.push({ item: -1, off: 0 }); joined += it.hasEOL ? '\n' : ' '; }
    }
  });
  const boxes: RedactBox[] = [];
  for (const span of findSensitive(joined, kinds, words)) {
    // Caracterele potrivirii, grupate pe bucăți de text.
    const per = new Map<number, [number, number]>();
    for (let p = span.start; p < span.end; p++) {
      const o = owner[p];
      if (!o || o.item < 0) continue;
      const r = per.get(o.item);
      per.set(o.item, r ? [Math.min(r[0], o.off), Math.max(r[1], o.off + 1)] : [o.off, o.off + 1]);
    }
    for (const [i, [a, b]] of per) {
      const it = items[i];
      const [ta, tb, tc, td, te, tf] = it.transform;
      const len = it.str.length || 1;
      const h = Math.hypot(tc, td) || 10;
      const dl = Math.hypot(ta, tb) || 1;
      const ux = ta / dl, uy = tb / dl; // direcția textului
      const nx = -uy, ny = ux; // în sus, perpendicular pe text
      // Cu măsurarea literelor (lățimi proporționale) locul e mult mai exact decât lățimea împărțită egal.
      const total = measure ? measure(it, it.str) : 0;
      const at = (k: number) => (total > 0 ? (it.width * measure!(it, it.str.slice(0, k))) / total : (it.width * k) / len);
      const x0 = at(a), x1 = at(b);
      const pad = h * 0.08;
      const corners = [[x0 - pad, -h * 0.28], [x1 + pad, -h * 0.28], [x0 - pad, h * 0.98], [x1 + pad, h * 0.98]]
        .map(([along, up]) => [te + ux * along + nx * up, tf + uy * along + ny * up]);
      let vx0 = Infinity, vy0 = Infinity, vx1 = -Infinity, vy1 = -Infinity;
      for (const [cx, cy] of corners) {
        const [px, py] = vp.convertToViewportRectangle([cx, cy, cx, cy]);
        vx0 = Math.min(vx0, px); vx1 = Math.max(vx1, px);
        vy0 = Math.min(vy0, py); vy1 = Math.max(vy1, py);
      }
      boxes.push({ x: vx0, y: vy0, w: vx1 - vx0, h: vy1 - vy0, kind: span.kind, text: span.text });
    }
  }
  return boxes;
}

/**
 * Adaptare K.G.B. (nu din COS): pdf.js 6 nu mai are `convertToViewportRectangle`; aceeași socoteală din matricea vederii,
 * ca `findBoxes` să primească obiectul pe care îl aștepta (de la pdf.js 4).
 */
export function viewportOf(vp: { transform: number[] }): Viewport {
  const [a, b, c, d, e, f] = vp.transform;
  const pt = (x: number, y: number) => [a * x + c * y + e, b * x + d * y + f];
  return { convertToViewportRectangle: (r: number[]) => [...pt(r[0], r[1]), ...pt(r[2], r[3])] };
}
