// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Despărțirea în silabe după regulile românești: locurile din cuvânt unde se poate pune cratima la capăt de rând.
// Folosită de Docs (hyphenate.ts) și de textul din Imagini (casetele de paragraf). Testată în tests/docs-hyphenate.test.mjs.
const VOWELS = 'aăâeiîouyáéíóú';
const isV = (c: string) => VOWELS.includes(c);
// b, c, d, f, g, h, p, t, v urmate de l sau r rămân împreună (ca-pră, a-flu); grupurile de trei consoane de mai jos se despart după a doua.
const LIQ_FIRST = 'bcdfghptv';
const THREE_AFTER_TWO = ['lpt', 'mpt', 'mpț', 'nct', 'ncț', 'ncș', 'ndv', 'rct', 'rtf', 'stm'];
const MIN_LEFT = 2, MIN_RIGHT = 2, MIN_WORD = 6;

/** Locurile (după câte litere) unde se poate despărți cuvântul. Între două vocale nu desparte niciodată (hiat sau diftong: nu se știe). */
export function hyphenPoints(word: string): number[] {
  const w = word.toLocaleLowerCase('ro-RO');
  if (w.length < MIN_WORD || !/^\p{L}+$/u.test(w) || (word.length > 1 && word === word.toLocaleUpperCase('ro-RO'))) return [];
  // Unitățile: „ch” și „gh” sunt un singur sunet.
  const units: { s: string; at: number }[] = [];
  for (let i = 0; i < w.length; i++) {
    if ((w[i] === 'c' || w[i] === 'g') && w[i + 1] === 'h') { units.push({ s: w[i] + 'h', at: i }); i++; }
    else units.push({ s: w[i], at: i });
  }
  const vowel = (k: number) => units[k].s.length === 1 && isV(units[k].s);
  // „i” de la sfârșit după consoană (pomi, ochi, merși) nu e silabă.
  const last = units.length - 1;
  const nucleus = (k: number) => vowel(k) && !(k === last && units[k].s === 'i' && k > 0 && !vowel(k - 1));
  const out: number[] = [];
  let k = 0;
  while (k < units.length && !nucleus(k)) k++;
  while (k < units.length) {
    let e = k;
    while (e + 1 < units.length && vowel(e + 1)) e++; // grupul de vocale
    let n = e + 1;
    while (n < units.length && !nucleus(n)) n++; // următoarea vocală
    if (n >= units.length) break;
    const cl = units.slice(e + 1, n).map((u) => u.s);
    if (cl.some((c) => c.length === 1 && isV(c))) { k = n; continue; } // un „i” final între ele: nu despărțim
    let cut = -1; // câte consoane rămân în stânga
    if (cl.length === 1) cut = 0;
    else if (cl.length === 2) cut = cl[1].length === 1 && 'lr'.includes(cl[1]) && LIQ_FIRST.includes(cl[0]) ? 0 : 1;
    else if (cl.length === 3) cut = THREE_AFTER_TWO.includes(cl.join('')) ? 2 : 1;
    else if (cl.length >= 4) cut = 2;
    if (cut >= 0) {
      const at = units[e + 1 + cut].at;
      if (at >= MIN_LEFT && w.length - at >= MIN_RIGHT) out.push(at);
    }
    k = n;
  }
  return out;
}
