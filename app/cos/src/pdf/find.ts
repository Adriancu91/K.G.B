// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Căutarea în textul unui PDF: fără să conteze literele mari sau diacriticele („sedinta” găsește „Ședința”),
// și peste granițele bucăților de text în care pdf.js împarte un rând.

/** Textul unei pagini, în bucățile date de pdf.js (aceeași ordine ca în stratul de text). */
export interface PageText {
  items: string[];
  /** După bucată urmează un rând nou. */
  eol: boolean[];
}

/** O potrivire: pagina (de la 1) și bucățile de text pe care le atinge. */
export interface Match {
  page: number;
  items: number[];
  /** Pentru fiecare bucată atinsă: [bucata, prima literă, după ultima literă] (pentru Înlocuiește). */
  parts?: [number, number, number][];
}

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

/** Spațiile multiple (și rândurile noi) contează ca un singur spațiu. */
function squash(s: string): { text: string; map: number[] } {
  let text = '';
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const space = /\s/.test(s[i]);
    if (space && text.endsWith(' ')) continue;
    text += space ? ' ' : s[i];
    map.push(i);
  }
  return { text, map };
}

/** Opțiunile căutării: litere mari / mici și diacritice exact ca în căutare; doar cuvinte întregi. */
export interface FindOpts { exact?: boolean; whole?: boolean }
/** Literă sau cifră (în orice alfabet): marginile unui cuvânt întreg sunt orice altceva. */
const wordChar = (ch: string | undefined) => !!ch && (ch.toLowerCase() !== ch.toUpperCase() || (ch >= '0' && ch <= '9'));

export function findInPage(pt: PageText, query: string, page: number, opts: FindOpts = {}): Match[] {
  // Cu „exact”, textul rămâne cum e (aceleași poziții, ca la forma fără diacritice).
  const norm = opts.exact ? (x: string) => x : fold;
  const q = squash(norm(query.trim())).text;
  if (!q) return [];
  let joined = '';
  const starts: number[] = [];
  pt.items.forEach((s, i) => {
    starts.push(joined.length);
    joined += s;
    if (pt.eol[i] && !/\s$/.test(s)) joined += ' ';
  });
  const { text, map } = squash(norm(joined));
  const out: Match[] = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf(q, from);
    if (at < 0) break;
    if (opts.whole && (wordChar(text[at - 1]) || wordChar(text[at + q.length]))) { from = at + 1; continue; }
    const a = map[at];
    const b = map[at + q.length - 1];
    const items: number[] = [];
    const parts: [number, number, number][] = [];
    for (let i = 0; i < pt.items.length; i++) {
      const s = starts[i], e = s + pt.items[i].length - 1;
      if (pt.items[i].length && s <= b && e >= a) { items.push(i); parts.push([i, Math.max(a, s) - s, Math.min(b, e) - s + 1]); }
    }
    if (items.length) out.push({ page, items, parts });
    from = at + q.length;
  }
  return out;
}

export function findAll(pages: PageText[], query: string, opts: FindOpts = {}): Match[] {
  return pages.flatMap((pt, i) => findInPage(pt, query, i + 1, opts));
}

/** Textul din jurul unei potriviri, pentru lista căutării în dosar: [înainte, potrivirea, după], cu spațiile strânse. */
export function matchSnippet(pt: PageText, m: Match, around = 40): [string, string, string] {
  const parts = m.parts ?? [];
  if (!parts.length) return ['', '', ''];
  let joined = '';
  const starts: number[] = [];
  pt.items.forEach((s, i) => {
    starts.push(joined.length);
    joined += s;
    if (pt.eol[i] && !/\s$/.test(s)) joined += ' ';
  });
  const last = parts[parts.length - 1];
  const a = starts[parts[0][0]] + parts[0][1];
  const b = starts[last[0]] + last[2];
  const clean = (s: string) => s.replace(/\s+/g, ' ');
  const before = clean(joined.slice(Math.max(0, a - around), a)).trimStart();
  const after = clean(joined.slice(b, b + around)).trimEnd();
  return [(a > around ? '…' : '') + before, clean(joined.slice(a, b)), after + (b + around < joined.length ? '…' : '')];
}
