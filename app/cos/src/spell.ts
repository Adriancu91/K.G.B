// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Verificarea ortografiei cu fereastră (F7, în Sheets și Slides): cuvintele din texte, cuvântul greșit următor și
// înlocuirea lui (o dată sau peste tot). Verificatorul (dicționarul românesc al aplicației) se dă din afară, ca să se poată testa.

/** Un text de verificat: o celulă, o casetă de pe slide, notițele unui slide. `r`, `c` dau ordinea și locul. */
export interface SpellCell { id: string; r: number; c: number; text: string }
export interface SpellIssue { cell: number; id: string; start: number; end: number; word: string }

const WORD = /[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu;

/** Cuvintele dintr-un text, cu locul lor (fără numere, adrese web și e-mailuri). */
export function wordsIn(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  const skip: [number, number][] = [];
  for (const m of text.matchAll(/(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+/gi)) skip.push([m.index!, m.index! + m[0].length]);
  for (const m of text.matchAll(WORD)) {
    const start = m.index!, end = start + m[0].length;
    if (skip.some(([a, b]) => start < b && end > a)) continue;
    // Cuvintele lipite de cifre (de exemplu „A1”, „3kg”) nu se verifică.
    if (/\d/.test(text[start - 1] ?? '') || /\d/.test(text[end] ?? '')) continue;
    out.push({ word: m[0], start, end });
  }
  return out;
}

/**
 * Următorul cuvânt greșit, de la textul `cell` și poziția `pos` din el (fără a reveni la început).
 * `ignored`: cuvintele de sărit peste tot (Ignoră tot / Adaugă în dicționar), scrise cu litere mici.
 */
export function nextIssue(list: SpellCell[], cell: number, pos: number, wrong: (w: string) => boolean, ignored: Set<string>): SpellIssue | null {
  for (let i = cell; i < list.length; i++) {
    for (const w of wordsIn(list[i].text)) {
      if (i === cell && w.start < pos) continue;
      if (w.word.length < 2 || ignored.has(w.word.toLowerCase())) continue;
      // Prescurtările scrise numai cu majuscule (TVA, SRL, CNP) nu se verifică.
      if (w.word.length <= 5 && w.word === w.word.toUpperCase() && w.word !== w.word.toLowerCase()) continue;
      if (wrong(w.word)) return { cell: i, id: list[i].id, ...w };
    }
  }
  return null;
}

/** Textul cu cuvântul de la `start`–`end` schimbat. */
export function replaceAt(text: string, start: number, end: number, repl: string) {
  return text.slice(0, start) + repl + text.slice(end);
}

/** „Schimbă tot”: același cuvânt (ca întreg, cu aceleași litere) înlocuit în toate textele; întoarce textele noi și de câte ori. */
export function replaceEverywhere(list: SpellCell[], word: string, repl: string) {
  const patch: Record<string, string> = {};
  let n = 0;
  for (const x of list) {
    const ws = wordsIn(x.text).filter((w) => w.word === word);
    if (!ws.length) continue;
    let t = x.text;
    for (const w of ws.reverse()) t = replaceAt(t, w.start, w.end, repl);
    n += ws.length;
    patch[x.id] = t;
  }
  return { patch, n };
}
