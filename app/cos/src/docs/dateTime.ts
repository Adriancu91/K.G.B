// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inserare dată și oră (Word: Insert → Date & Time), cu formatele folosite în România.
// Scurtături ca în Word: Alt+Shift+D scrie data, Alt+Shift+T scrie ora (în formatul ales ultima dată).
import { Extension } from '@tiptap/core';

const LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const ZILE = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** Formatele din fereastra „Dată și oră”: [id, cum se scrie]. Primele sunt doar data, ultimele conțin ora. */
export const DATE_FORMATS: [string, (d: Date) => string][] = [
  ['zz.ll.aaaa', (d) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`],
  ['z luna aaaa', (d) => `${d.getDate()} ${LUNI[d.getMonth()]} ${d.getFullYear()}`],
  ['zi, z luna aaaa', (d) => `${ZILE[d.getDay()]}, ${d.getDate()} ${LUNI[d.getMonth()]} ${d.getFullYear()}`],
  ['zz/ll/aaaa', (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`],
  ['aaaa-ll-zz', (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`],
  ['luna aaaa', (d) => `${LUNI[d.getMonth()]} ${d.getFullYear()}`],
  ['zz.ll.aaaa oo:mm', (d) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`],
  ['oo:mm', (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`],
  ['oo:mm:ss', (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`],
];

const KEY = 'suite.docs.dateFormat';
/** Formatul ales ultima dată pentru dată (Alt+Shift+D îl folosește); implicit 19.10.2026. */
export function lastDateFormat(): string {
  try { const v = localStorage.getItem(KEY); if (v && DATE_FORMATS.some(([id]) => id === v)) return v; } catch { /* fără memorie locală */ }
  return 'zz.ll.aaaa';
}
export function rememberDateFormat(id: string) {
  // Se ține minte doar un format de dată (fără oră), pentru Alt+Shift+D.
  if (id.includes('oo')) return;
  try { localStorage.setItem(KEY, id); } catch { /* fără memorie locală */ }
}

export function formatDate(d: Date, id: string): string {
  return (DATE_FORMATS.find(([f]) => f === id) ?? DATE_FORMATS[0])[1](d);
}

export const DateTime = Extension.create({
  name: 'dateTime',
  addKeyboardShortcuts() {
    return {
      'Alt-Shift-d': () => this.editor.commands.insertContent(formatDate(new Date(), lastDateFormat())),
      'Alt-Shift-t': () => this.editor.commands.insertContent(formatDate(new Date(), 'oo:mm')),
    };
  },
});
