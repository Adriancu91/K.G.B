// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Diacritice automate: „sedinta de sambata” → „ședința de sâmbătă”. Pentru fiecare cuvânt scris fără diacritice se încearcă
// toate variantele (a → ă / â, i → î, s → ș, t → ț) și se păstrează cele pe care dicționarul românesc al aplicației le cunoaște.
// O singură variantă bună = schimbare sigură. Mai multe („fata” = fata / fată / fața / față) = se alege după cuvintele vecine
// și după o listă de preferințe pentru cuvintele dese, iar schimbarea se arată pentru verificare („nesigură”).
// Verificatorul (dicționarul) se dă din afară, ca să se poată testa fără aplicație. Ș și Ț se scriu cu virgulă, nu cu sedilă.

export interface DiacriticChange {
  start: number;
  end: number;
  from: string;
  to: string;
  /** Toate variantele corecte (cu majusculele cuvântului), prima e cea aleasă. */
  options: string[];
  /** false = cuvântul are mai multe forme corecte și alegerea trebuie verificată. */
  sure: boolean;
}

/** `valid(cuvânt cu litere mici)`: true dacă dicționarul îl cunoaște. */
export type WordCheck = (w: string) => boolean;

const SWAP: Record<string, string[]> = { a: ['a', 'ă', 'â'], i: ['i', 'î'], s: ['s', 'ș'], t: ['t', 'ț'] };
const MAX_VARIANTS = 1500;

/** Variantele cu diacritice ale unui cuvânt (litere mici, fără diacritice); prima e cuvântul însuși. */
export function variants(word: string): string[] {
  const opts: string[][] = [];
  const n = word.length;
  for (let k = 0; k < n; k++) {
    const ch = word[k];
    let o = SWAP[ch] ?? [ch];
    // „â” nu stă niciodată la începutul sau la sfârșitul cuvântului.
    if (ch === 'a' && (k === 0 || k === n - 1)) o = ['a', 'ă'];
    opts.push(o);
  }
  let total = 1;
  for (const o of opts) total *= o.length;
  // Cuvintele foarte lungi: „î” doar la început / sfârșit, ca să nu fie prea multe variante de încercat.
  if (total > MAX_VARIANTS) {
    for (let k = 1; k < n - 1; k++) if (word[k] === 'i') opts[k] = ['i'];
    total = opts.reduce((p, o) => p * o.length, 1);
    if (total > MAX_VARIANTS) return [word];
  }
  let out = [''];
  for (const o of opts) {
    const next: string[] = [];
    for (const p of out) for (const c of o) next.push(p + c);
    out = next;
  }
  return out;
}

// Cuvintele dese cu mai multe forme corecte, a căror formă e aproape mereu aceeași (schimbare sigură).
const FIXED: Record<string, string> = {
  si: 'și', in: 'în', isi: 'își', imi: 'îmi', iti: 'îți', il: 'îl', ii: 'îi', ti: 'ți', pana: 'până', asa: 'așa', mai: 'mai',
  maine: 'mâine', ultima: 'ultima', prima: 'prima', atat: 'atât', cat: 'cât', cate: 'câte', cati: 'câți', sase: 'șase', sapte: 'șapte',
  toti: 'toți', stii: 'știi', rau: 'rău', tara: 'țara', tari: 'țări', usa: 'ușa', acesti: 'acești', ati: 'ați', insa: 'însă', inca: 'încă',
  intr: 'într', dintr: 'dintr', printr: 'printr', s: 's', n: 'n', c: 'c', m: 'm', l: 'l', t: 'ț', v: 'v', i: 'i',
};
// Cuvintele dese la care o formă e mai probabilă, dar vecinii pot schimba alegerea (se arată pentru verificare).
const PREFER: Record<string, string> = {
  tine: 'tine', mana: 'mâna', sta: 'stă', da: 'da', va: 'va', seara: 'seara', apa: 'apa', fata: 'fata', data: 'data', masa: 'masa',
  casa: 'casa', luna: 'luna', ziua: 'ziua', buna: 'bună', noua: 'nouă', asteptam: 'așteptăm', ora: 'ora', scoala: 'școala', saptamana: 'săptămâna', vada: 'vadă', faca: 'facă', aiba: 'aibă',
};

// După acestea substantivul vine fără articol („o casă”, „fiecare zi”, „ultima lună”).
const DET_BARE = new Set(['o', 'nicio', 'vreo', 'fiecare', 'orice', 'altă', 'alta', 'această', 'aceeași', 'aceeasi', 'acea', 'prima',
  'ultima', 'două', 'doua', 'mai', 'foarte', 'prea', 'atât', 'atat', 'cam', 'destul', 'tot', 'așa', 'asa']);
// Prepozițiile după care substantivul simplu e fără articol („pe masă”, „de sâmbătă”), dar cu articol dacă are ceva după el
// („în sala mare”, „la piața din cartier”). „Cu” cere de obicei articol.
const PREPS = new Set(['pe', 'la', 'în', 'in', 'din', 'de', 'sub', 'prin', 'spre', 'fără', 'fara', 'după', 'dupa', 'despre', 'către',
  'catre', 'până', 'pana', 'între', 'intre', 'ca', 'pentru', 'contra', 'printre', 'dintre']);
// Cuvintele care, puse după un substantiv, îl cer cu articol („casa mea”, „fata vecinilor”).
const AFTER_ARTICLE = new Set(['mea', 'ta', 'sa', 'noastră', 'noastra', 'voastră', 'voastra', 'lui', 'ei', 'lor', 'aceasta', 'aceea',
  'asta', 'aia', 'respectivă', 'respectiva', 'întreagă', 'intreaga']);
// Cuvinte de legătură sau verbe: după un substantiv simplu, el rămâne fără articol („de sâmbătă a fost”, „pe masă și”).
const LINK = new Set(['și', 'si', 'sau', 'iar', 'dar', 'că', 'ca', 'este', 'e', 'a', 'are', 'au', 'era', 'erau', 'va', 'vor', 'nu', 'se',
  'poate', 'pot', 'fost', 'fi', 'trebuie', 'devine', 'rămâne', 'ramane', 'am', 'ai', 'ați', 'ati', 'au', 'cu']);
// Verbele care urmează de obicei după subiect („iarba a crescut”, „ședința este”).
const VERB_AFTER = new Set(['este', 'e', 'a', 'are', 'au', 'era', 'erau', 'va', 'vor', 'nu', 'se', 'poate', 'trebuie', 'devine', 'rămâne', 'ramane']);
// Rădăcini dese care se scriu cu diacritice (când dicționarul acceptă și forma fără ele, de obicei rară).
const STEMS = ['român', 'grădin', 'câin', 'pâin', 'mân', 'gând', 'vânt', 'sâng', 'cânt', 'pământ', 'întâ', 'tânăr', 'târg', 'câmp',
  'mânc', 'cumpăr', 'văz', 'făc', 'băiat', 'fără', 'văd', 'oraș', 'școal', 'ști', 'țăr', 'față', 'fiică', 'bucurești', 'brânz',
  'câștig', 'găs', 'plăc', 'răspun', 'întreb', 'încep', 'sfârș', 'până', 'cădea', 'lăs', 'rămân', 'spăl', 'trăi', 'zăpad', 'bărbat'];
// „vă” (vă rog, vă scriu) sau „va” (va fi, va face): după „va” vine de obicei un infinitiv.
const INF_END = /(a|ea|i|î|e)$/;
// După acestea urmează un infinitiv („vom verifica”, „a pleca”).
const INF_BEFORE = new Set(['vom', 'voi', 'vei', 'vor', 'veți', 'veti', 'a', 'putem', 'puteți', 'puteti', 'poate', 'pot', 'poți', 'poti']);

const WORD_RE = /[\p{L}\p{M}]+/gu;
const HAS_MARK = /[ăâîșțşţĂÂÎȘȚŞŢ]/;

function strip(w: string) {
  return w.normalize('NFC').replace(/[ăâ]/g, 'a').replace(/[ĂÂ]/g, 'A').replace(/î/g, 'i').replace(/Î/g, 'I')
    .replace(/[șş]/g, 's').replace(/[ȘŞ]/g, 'S').replace(/[țţ]/g, 't').replace(/[ȚŢ]/g, 'T');
}

/** Pune majusculele cuvântului original pe varianta aleasă. */
function matchCase(orig: string, v: string) {
  if (orig === orig.toLowerCase()) return v;
  if (orig === orig.toUpperCase()) return v.toUpperCase();
  let out = '';
  for (let k = 0; k < v.length; k++) out += orig[k] && orig[k] !== orig[k].toLowerCase() ? v[k].toUpperCase() : v[k];
  return out;
}

const CONS = /[bcdfghjklmnpqrstvwxyzșț]/;

/**
 * Alege forma potrivită dintre variantele corecte, după cuvintele vecine. Fiecare literă schimbată primește puncte:
 * „î” la început înaintea unei consoane (în-, îm-), „-ți” la sfârșit (mulți, aveți), „-ăm” (discutăm) și „-ă” la sfârșit
 * (după vecini: „o casă” / „casa mea”) cresc; celelalte schimbări din interior scad puțin. Întoarce [aleasa, sigur].
 */
function choose(word: string, good: string[], prev: string, next: string, nextIsEnd: boolean, capital: boolean): [string, boolean] {
  const p = prev.toLowerCase(), nx = next.toLowerCase();
  const has = (v: string) => good.includes(v);
  const fixed = FIXED[word];
  if (fixed && has(fixed)) return [fixed, true];
  if (word === 'ca' && has('că') && has('ca')) {
    if (['sa', 'să', 'si', 'și', 'de', 'atare', 'acum', 'cum', 'pe'].includes(nx) || ['mai', 'decât', 'decat', 'tot', 'cum', 'precum', 'astfel', 'atât', 'atat', 'încât', 'incat'].includes(p)) return ['ca', true];
    return ['că', false];
  }
  if (word === 'sa' && has('să') && has('sa')) {
    const prevArticulated = /(a|ul|le|ii|ea)$/.test(p) && !['ca', 'că', 'va', 'nu', 'mai', 'la', 'pe', 'ea', 'sa'].includes(p);
    if (prevArticulated && (nextIsEnd || PREPS.has(nx) || ['și', 'si', 'iar', 'dar'].includes(nx))) return ['sa', false];
    return ['să', true];
  }
  if (word === 'aceasta' && has('această') && has('aceasta')) {
    return nextIsEnd || LINK.has(nx) || PREPS.has(nx) ? ['aceasta', true] : ['această', true];
  }
  // Cât de potrivit e „-ă” la sfârșit (în loc de „-a”): pozitiv = fără articol / verb la persoana a 3-a, negativ = cu articol / infinitiv.
  if (word === 'va' && has('vă') && has('va')) return [nx && !INF_END.test(nx) ? 'vă' : 'va', false];
  let finalA = 0.6;
  if (DET_BARE.has(p)) finalA = 2;
  else if (PREPS.has(p)) finalA = nextIsEnd || LINK.has(nx) ? 2 : -1;
  else if (p === 'cu') finalA = -1;
  else if (INF_BEFORE.has(p)) finalA = -1.5;
  else if (capital && !p) finalA = -1;
  else if (VERB_AFTER.has(nx)) finalA = -1;
  if (AFTER_ARTICLE.has(nx) || /^\p{L}+(ilor|elor|ului)$/u.test(nx)) finalA = -2;
  const n = word.length;
  const score = (v: string) => {
    let s = 0;
    for (let k = 0; k < n; k++) {
      if (v[k] === word[k]) continue;
      const c = v[k];
      if (k === 0 && c === 'î') s += CONS.test(word[1] ?? '') ? 2 : -1;
      else if (k === 0) s += 0;
      else if (k === n - 1 && c === 'ă') s += finalA;
      else if (k === n - 2 && c === 'ț' && word[n - 1] === 'i') s += 1.5;
      else if (k === n - 2 && c === 'ă' && word[n - 1] === 'm') s += 1;
      else s -= c === 'ă' ? 0.5 : 0.6;
    }
    if (PREFER[word] === v) s += 1.5;
    if (STEMS.some((t) => v.includes(t))) s += 1;
    return s;
  };
  const ranked = good.map((v) => [v, score(v)] as const).sort((a, b) => b[1] - a[1]);
  const margin = ranked.length > 1 ? ranked[0][1] - ranked[1][1] : 9;
  return [ranked[0][0], margin >= 2 && PREFER[word] === undefined];
}

/**
 * Schimbările de diacritice pentru un text. Cuvintele care au deja diacritice, cele necunoscute în orice formă și cele
 * scrise numai cu majuscule scurte (prescurtări) rămân neatinse. Formele cu cratimă („intr-un”) se tratează pe bucăți.
 */
export function findDiacritics(text: string, valid: WordCheck): DiacriticChange[] {
  const words: { w: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(WORD_RE)) words.push({ w: m[0], start: m.index!, end: m.index! + m[0].length });
  const cache = new Map<string, string[]>();
  // Cuvintele scrise cu majusculă se încearcă și așa (numele proprii: „București”).
  const okForms = (low: string, cap: boolean) => {
    const key = (cap ? '^' : '') + low;
    let g = cache.get(key);
    if (!g) { g = variants(low).filter((v) => valid(v) || (cap && valid(v[0].toUpperCase() + v.slice(1)))); cache.set(key, g); }
    return g;
  };
  const out: DiacriticChange[] = [];
  for (let k = 0; k < words.length; k++) {
    const { w, start, end } = words[k];
    if (HAS_MARK.test(w) || !/[aist]/i.test(w)) continue;
    if (/\d/.test(text[start - 1] ?? '') || /\d/.test(text[end] ?? '')) continue;
    if (w.length <= 5 && w.length > 1 && w === w.toUpperCase()) continue;
    const low = w.toLowerCase();
    // Bucățile din „intr-un”, „s-a”: cuvântul de după cratimă se ia ca vecin.
    const hyphenNext = text[end] === '-' && words[k + 1]?.start === end + 1;
    const hyphenPrev = text[start - 1] === '-' && words[k - 1]?.end === start - 1;
    let good: string[];
    if ((hyphenNext || hyphenPrev) && low.length <= 6 && FIXED[low] !== undefined) good = [FIXED[low]];
    else good = okForms(low, w[0] !== low[0]);
    if (!good.length) continue;
    // Între două cuvinte vecine se trece doar peste spații (o virgulă sau un punct oprește legătura).
    const gap = (a: number, b: number) => /^[\s ]*$/.test(text.slice(a, b));
    const prev = k > 0 && gap(words[k - 1].end, start) ? (out.find((c) => c.start === words[k - 1].start)?.to ?? words[k - 1].w) : '';
    const nextOk = k + 1 < words.length && gap(end, words[k + 1].start);
    const next = nextOk ? words[k + 1].w : '';
    let to: string, sure: boolean;
    if (good.length === 1) { to = good[0]; sure = true; }
    else [to, sure] = choose(low, good, prev, next, !nextOk, w[0] !== low[0]);
    if (to === low && sure) continue;
    const options = [to, ...good.filter((g) => g !== to)].map((v) => matchCase(w, v));
    if (to === low && !options.slice(1).length) continue;
    out.push({ start, end, from: w, to: matchCase(w, to), options, sure });
  }
  // Cuvintele care rămân cum erau, dar au și alte forme posibile, se arată doar dacă alegerea nu e sigură.
  return out.filter((c) => c.to !== c.from || !c.sure);
}

/** Textul cu schimbările aplicate (de la sfârșit spre început, ca pozițiile să rămână bune). */
export function applyDiacritics(text: string, changes: DiacriticChange[]) {
  let t = text;
  for (const c of [...changes].sort((a, b) => b.start - a.start)) t = t.slice(0, c.start) + c.to + t.slice(c.end);
  return t;
}

/** Cât de aproape e un text de cel corect: procentul de cuvinte identice (pentru teste). */
export function wordAccuracy(got: string, want: string) {
  const a = got.match(WORD_RE) ?? [], b = want.match(WORD_RE) ?? [];
  let ok = 0;
  for (let k = 0; k < b.length; k++) if (a[k] === b[k]) ok++;
  return b.length ? ok / b.length : 1;
}

export { strip as stripDiacritics };
