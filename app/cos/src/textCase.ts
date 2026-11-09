// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Schimbă literele” (Aa din PowerPoint, Shift+F3 din Word), cu regulile limbii române (ș, ț, î).
// Folosit de Slides și Docs. Textul rezultat are mereu aceeași lungime (ß nu devine SS), ca formatarea să rămână pe aceleași litere.
export type TextCase = 'upper' | 'lower' | 'title' | 'sentence' | 'toggle';
export const TEXT_CASES: [TextCase, string][] = [['sentence', 'Ca în propoziție.'], ['lower', 'litere mici'], ['upper', 'MAJUSCULE'], ['title', 'Fiecare Cuvânt Cu Majusculă']];

const each = (s: string, f: (c: string) => string) => Array.from(s, (c) => { const r = f(c); return r.length === c.length ? r : c; }).join('');
const up = (s: string) => each(s, (c) => c.toLocaleUpperCase('ro-RO'));
const low = (s: string) => each(s, (c) => c.toLocaleLowerCase('ro-RO'));

export function changeCase(text: string, c: TextCase): string {
  if (c === 'upper') return up(text);
  if (c === 'lower') return low(text);
  if (c === 'toggle') return each(text, (ch) => (ch === up(ch) ? low(ch) : up(ch)));
  if (c === 'title') return low(text).replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, a: string, b: string) => a + up(b));
  // Propoziție: prima literă din text și cea de după . ! ? (sau de la început de rând) devin mari, restul mici.
  return low(text).replace(/(^|[.!?…]\s+|\n\s*)(\p{L})/gu, (_, a: string, b: string) => a + up(b));
}

/** Ce face Shift+F3 (ca în Word): MAJUSCULE → litere mici → Propoziție (sau Fiecare Cuvânt, dacă nu e o propoziție întreagă) → MAJUSCULE… */
export function nextCase(text: string): TextCase {
  if (!/\p{L}/u.test(text)) return 'upper';
  if (text === up(text)) return 'lower';
  if (text === low(text)) return /[.!?…]\s*$/.test(text.trim()) ? 'sentence' : 'title';
  return 'upper';
}
