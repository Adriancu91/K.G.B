// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Potrivirile unui text căutat într-un paragraf, cu opțiunile căutării avansate:
// litere mari / mici, doar cuvinte întregi și semne de înlocuire („?” = o literă, „*” = oricâte litere, pe cât mai puține).
// Fără semne de înlocuire, textul se caută exact cum e scris (și „?” sau „*” sunt căutate ca atare).

export interface SearchOpts {
  caseSensitive?: boolean;
  /** Doar cuvintele întregi: „mare” nu găsește „marea” sau „amare”. */
  wholeWord?: boolean;
  /** „?” ține locul unei litere, „*” al oricâtor litere. */
  wildcards?: boolean;
}

const BS = String.fromCharCode(92);
/** Caracterul care ține locul imaginilor și al altor obiecte din paragraf (nu face parte din cuvinte). */
const OBJ = String.fromCharCode(0xfffc);
const SPACES = ' ' + String.fromCharCode(9, 0xa0, 0x2002, 0x2003, 0x2009);
const SPECIAL = '.*+?^$' + '{}()|[]/' + BS;

/** Literă, cifră sau „_”: face parte dintr-un cuvânt. */
export function isWordChar(ch: string | undefined): boolean {
  if (!ch || ch === OBJ) return false;
  return ch.toLowerCase() !== ch.toUpperCase() || (ch >= '0' && ch <= '9') || ch === '_';
}

const cache = new Map<string, RegExp | null>();

function compile(term: string, opts: SearchOpts): RegExp | null {
  const ck = `${opts.caseSensitive ? 1 : 0}${opts.wildcards ? 1 : 0}${opts.wholeWord ? 1 : 0}${term}`;
  // Cu „Cuvinte întregi”, semnele nu trec peste spații: „s*d” găsește „sold”, nu „sat sold”.
  const not = OBJ + (opts.wholeWord ? SPACES : '');
  if (cache.has(ck)) return cache.get(ck)!;
  let src = '';
  for (const ch of term) {
    if (opts.wildcards && ch === '*') src += '[^' + not + ']*?';
    else if (opts.wildcards && ch === '?') src += '[^' + not + ']';
    else src += SPECIAL.includes(ch) ? BS + ch : ch;
  }
  const re = term ? new RegExp(src, opts.caseSensitive ? 'gu' : 'giu') : null;
  if (cache.size > 50) cache.clear();
  cache.set(ck, re);
  return re;
}

/** Pozițiile [început, sfârșit) ale potrivirilor din text, de la stânga la dreapta, fără suprapuneri. */
export function textMatches(text: string, term: string, opts: SearchOpts = {}): [number, number][] {
  const re = compile(term, opts);
  if (!re) return [];
  const out: [number, number][] = [];
  // Fără „Aa”, literele se compară cu literele mici românești (ca „Î” și „î”).
  const hay = opts.caseSensitive ? text : text.toLocaleLowerCase('ro-RO');
  const pat = opts.caseSensitive ? re : compile(term.toLocaleLowerCase('ro-RO'), opts)!;
  pat.lastIndex = 0;
  for (let m = pat.exec(hay); m; m = pat.exec(hay)) {
    const a = m.index, b = a + m[0].length;
    if (b === a) { pat.lastIndex++; continue; }
    if (opts.wholeWord && (isWordChar(hay[a - 1]) || isWordChar(hay[b]))) {
      // Încearcă și de la litera următoare (de exemplu „ana” în „banana ana”).
      pat.lastIndex = a + 1;
      continue;
    }
    out.push([a, b]);
  }
  return out;
}
