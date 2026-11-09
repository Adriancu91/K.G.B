// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Umplere rapidă (Ctrl+E): din unul-două exemple scrise lângă date, ghicim regula și completăm restul coloanei.
// Regula e o înșiruire de bucăți: un cuvânt din celulele din stânga (al n-lea de la început sau de la sfârșit, celula întreagă
// sau doar prima lui literă), scris ca atare / cu MAJUSCULE / cu litere mici / cu Prima Literă Mare, și texte fixe între ele.
// Exemple: „Ion Popescu” → „Popescu”, „I.P.”, „POPESCU, Ion”; „ion@firma.ro” → „firma.ro”; „București, 010011” → „010011”.

type Case = 'as' | 'up' | 'low' | 'title';
type Piece =
  | { k: 'const'; s: string }
  | { k: 'tok'; col: number; at: number; fromEnd: boolean; first: boolean; cs: Case }
  | { k: 'cell'; col: number; cs: Case }
  /** Textul de după (after) sau dinainte (before) de primul / ultimul semn `d` din celulă: „ion@firma.ro” → după „@” = „firma.ro”. */
  | { k: 'cut'; col: number; d: string; after: boolean; last: boolean; cs: Case };

export interface FlashRow { src: string[]; out: string | null }

const WORD = /[\p{L}\p{N}]+/gu;
interface Tok { s: string }
const tokens = (v: string): Tok[] => Array.from(v.matchAll(WORD), (m) => ({ s: m[0] }));

const cased = (s: string, cs: Case) =>
  cs === 'up' ? s.toLocaleUpperCase('ro-RO')
    : cs === 'low' ? s.toLocaleLowerCase('ro-RO')
      : cs === 'title' ? s.charAt(0).toLocaleUpperCase('ro-RO') + s.slice(1).toLocaleLowerCase('ro-RO')
        : s;
const CASES: Case[] = ['as', 'title', 'up', 'low'];

function run(p: Piece, src: string[], toks: Tok[][]): string | null {
  if (p.k === 'const') return p.s;
  if (p.k === 'cell') return src[p.col] ? cased(src[p.col], p.cs) : null;
  if (p.k === 'cut') {
    const v = src[p.col] ?? '';
    const i = p.last ? v.lastIndexOf(p.d) : v.indexOf(p.d);
    if (i < 0) return null;
    const part = (p.after ? v.slice(i + p.d.length) : v.slice(0, i)).trim();
    return part ? cased(part, p.cs) : null;
  }
  const list = toks[p.col] ?? [];
  const t = list[p.fromEnd ? list.length - 1 - p.at : p.at];
  if (!t) return null;
  return cased(p.first ? t.s.charAt(0) : t.s, p.cs);
}

function apply(prog: Piece[], src: string[]): string | null {
  const toks = src.map(tokens);
  let out = '';
  for (const p of prog) {
    const s = run(p, src, toks);
    if (s === null) return null;
    out += s;
  }
  return out;
}

/**
 * Prima regulă (căutare în adâncime, cu un buget de pași) care dă exact rezultatul fiecărui exemplu. Bucățile se verifică pe toate
 * exemplele deodată, pe măsură ce regula crește, așa că o regulă greșită se oprește repede. Cuvintele întregi se încearcă înaintea
 * textului fix; fiecare cuvânt întâi cum e scris în date, apoi cu Prima Literă Mare, MAJUSCULE, litere mici.
 */
function findProgram(ex: { src: string[]; out: string }[]): Piece[] | null {
  const toks = ex.map((e) => e.src.map(tokens));
  const head = ex[0];
  const cands: Piece[] = [], cuts: Piece[] = [];
  head.src.forEach((v, col) => {
    if (v) for (const cs of CASES) cands.push({ k: 'cell', col, cs });
    for (const d of new Set(v.replace(/[\p{L}\p{N}]/gu, ''))) {
      // După: de la ultimul semn întâi („Andrei Vasile Georgescu” → „Georgescu”); înainte: de la primul.
      for (const after of [true, false]) for (const last of after ? [true, false] : [false, true]) for (const cs of CASES) cuts.push({ k: 'cut', col, d, after, last, cs });
    }
    const list = toks[0][col];
    list.forEach((_, i) => {
      const last = i === list.length - 1 && i > 0;
      for (const first of [false, true]) {
        for (const cs of CASES) {
          const a: Piece = { k: 'tok', col, at: i, fromEnd: false, first, cs };
          const b: Piece = { k: 'tok', col, at: list.length - 1 - i, fromEnd: true, first, cs };
          cands.push(...(last ? [b, a] : [a, b]));
        }
      }
    });
  });
  // La aceeași lungime, cuvântul întreg câștigă în fața tăieturii după un semn.
  cands.push(...cuts);
  let budget = 200000;
  const go = (pos: number[], acc: Piece[]): Piece[] | null => {
    if (--budget < 0) return null;
    if (pos.every((p, i) => p === ex[i].out.length)) return acc.some((x) => x.k !== 'const') ? acc : null;
    if (pos.some((p, i) => p === ex[i].out.length)) return null;
    // Bucățile mai lungi întâi (o regulă cu mai puține bucăți se potrivește mai des pe celelalte rânduri).
    const here = cands.map((p) => ({ p, s: run(p, head.src, toks[0]) })).filter((x) => x.s && head.out.startsWith(x.s, pos[0]));
    here.sort((a, b) => b.s!.length - a.s!.length);
    const at = pos[0], o = head.out;
    const isWord = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);
    const isLower = (ch: string | undefined) => !!ch && ch !== ch.toLocaleUpperCase('ro-RO');
    const prevPiece = acc[acc.length - 1];
    for (const { p } of here) {
      // O singură literă (inițiala) doar ca inițială: nu lipită de un cuvânt dinainte și nu urmată de litere mici („firma” nu e „f” + „i”…).
      if (p.k === 'tok' && p.first && ((isWord(o[at - 1]) && !(prevPiece?.k === 'tok' && prevPiece.first)) || isLower(o[at + 1]))) continue;
      const next: number[] = [];
      let ok = true;
      for (let i = 0; i < ex.length && ok; i++) {
        const v = run(p, ex[i].src, toks[i]);
        if (!v || !ex[i].out.startsWith(v, pos[i])) ok = false;
        else next.push(pos[i] + v.length);
      }
      if (!ok) continue;
      const r = go(next, [...acc, p]);
      if (r || budget < 0) return r;
    }
    // Un caracter fix, același în toate exemplele, unit cu textul fix de dinainte.
    const ch = head.out[pos[0]];
    if (!ex.every((e, i) => e.out[pos[i]] === ch)) return null;
    const prev = acc[acc.length - 1];
    const nextAcc = prev && prev.k === 'const' ? [...acc.slice(0, -1), { k: 'const' as const, s: prev.s + ch }] : [...acc, { k: 'const' as const, s: ch }];
    return go(pos.map((p) => p + 1), nextAcc);
  };
  return go(ex.map(() => 0), []);
}

/**
 * Completează rândurile fără rezultat (out = null) după regula care se potrivește cu toate exemplele.
 * Întoarce valorile pentru fiecare rând (exemplele rămân cum sunt; „” unde regula nu se poate aplica), sau null dacă nu găsim o regulă.
 */
export function flashFill(rows: FlashRow[]): string[] | null {
  const ex = rows.filter((r) => r.out !== null && r.out !== '');
  if (!ex.length) return null;
  const prog = findProgram(ex.map((r) => ({ src: r.src, out: r.out! })));
  if (!prog) return null;
  return rows.map((r) => (r.out !== null && r.out !== '' ? r.out : r.src.some((v) => v) ? apply(prog, r.src) ?? '' : ''));
}
