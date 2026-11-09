// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ecuațiile din Docs: ecuația se scrie pe un rând (x^2 + y^2 = r^2, (a+b)/(c-d), sqrt(x), sum_(i=1)^n i, alfa, pi, <=, !=, +-),
// iar desenul îl facem noi: fracții una peste alta, puteri, indici, radicali, paranteze care cresc, sume și integrale cu limite,
// accente deasupra literelor (hat(x), bar(x), vec(v), dot(x), ddot(x), tilde(x)) și matrice (mat(a, b; c, d)), sisteme (cases(x + y = 5; x - y = 1)).
// Desenul e SVG → PNG (ca la grafice), deci arată la fel în .docx, .odt, PDF și pagina web; textul ecuației rămâne pe imagine.
import type { Editor } from '@tiptap/react';
import { svgToPng } from '../sheets/chartSvg';
import { eqTreeToLatex, isLatexEq, latexToEq } from './latexEq';

export interface DocEquation { src: string }
export const EQ_MAX = 400;
export const EQ_SIZE = 20;

export const newEquation = (): DocEquation => ({ src: 'x = (-b +- sqrt(b^2 - 4ac))/(2a)' });

export function parseEquation(v: unknown): DocEquation | null {
  let o: unknown = v;
  if (typeof v === 'string') { try { o = JSON.parse(v); } catch { return null; } }
  if (!o || typeof o !== 'object') return null;
  const src = String((o as Record<string, unknown>).src ?? '').split(String.fromCharCode(10)).join(' ').trim().slice(0, EQ_MAX);
  return src ? { src } : null;
}

/** Modelele din fereastră: ce scrii și ce se vede. */
export const EQ_TEMPLATES: [string, string][] = [
  ['Fracție', 'a/b'], ['Fracție oblică', 'sfrac(1, 2)'], ['Fracție pe rând', 'lfrac(a + b, c)'], ['Putere', 'x^2'], ['Indice', 'x_1'], ['Radical', 'sqrt(x)'], ['Radical de ordin n', 'root(3, x)'],
  ['Sumă', 'sum_(i=1)^n i'], ['Integrală', 'int_0^1 f(x) dx'], ['Limită', 'lim_(x->0) sin(x)/x'], ['Produs', 'prod_(k=1)^n k'], ['Reuniune', 'bigcup_(i=1)^n A_i'],
  ['Modul', 'abs(x - 1) = 2'], ['Combinări', 'binom(n, k) = n!/(k! (n - k)!)'], ['Parte întreagă', 'floor(x) <= x < floor(x) + 1'], ['Normă', 'norm(v) = sqrt(x^2 + y^2)'],
  ['Ecuația de gradul 2', 'x = (-b +- sqrt(b^2 - 4ac))/(2a)'], ['Pitagora', 'a^2 + b^2 = c^2'], ['Cerc', 'A = pi r^2'],
  ['Binom', '(a + b)^2 = a^2 + 2ab + b^2'], ['Medie', 'x_m = 1/n sum_(i=1)^n x_i'], ['Vector', 'vec(F) = m vec(a)'], ['Medie cu bară', 'bar(x) = 1/n sum_(i=1)^n x_i'], ['Matrice', 'A = (mat(a, b; c, d))'], ['Sistem de ecuații', 'cases(x + y = 5; x - y = 1)'], ['Mulțime', 'A = braces(1, 2, 3)'], ['Rezultat în chenar', 'box(E = m c^2)'], ['Acoladă dedesubt', 'underbrace(1 + 2 + ... + n)_(n termeni)'], ['Text deasupra săgeții', '2H_2 + O_2 overset(t, ->) 2H_2 O'], ['Indici în față', '{}_92^238 U'], ['Paranteze unghiulare', 'angle(x^2) - angle(x)^2'],
];

/** Numele scrise cu litere care devin simboluri (în română și în engleză). */
const NAMES: Record<string, string> = {
  alfa: 'α', alpha: 'α', beta: 'β', gama: 'γ', gamma: 'γ', Gama: 'Γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
  teta: 'θ', theta: 'θ', Teta: 'Θ', Theta: 'Θ', iota: 'ι', kapa: 'κ', kappa: 'κ', lambda: 'λ', Lambda: 'Λ', miu: 'μ', mu: 'μ', niu: 'ν', nu: 'ν',
  xi: 'ξ', Xi: 'Ξ', pi: 'π', Pi: 'Π', ro: 'ρ', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', fi: 'φ', phi: 'φ', Fi: 'Φ', Phi: 'Φ', hi: 'χ', chi: 'χ',
  psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω', inf: '∞', infinit: '∞', infinity: '∞', grad: '°', deg: '°', nabla: '∇', partial: '∂',
  // Punctele din matrice: pe orizontală la mijlocul rândului, pe verticală, pe diagonală.
  cdots: '⋯', vdots: '⋮', ddots: '⋱',
};
/** Funcțiile scrise drept (nu cursiv), ca în manuale. */
const FUNCS = new Set(['sin', 'cos', 'tg', 'tan', 'ctg', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctg', 'arctan', 'sh', 'ch', 'sinh', 'cosh', 'tanh',
  'log', 'lg', 'ln', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'mod', 'gcd', 'cmmdc', 'cmmmc', 'dx', 'dy', 'dt']);
const LIMITS = new Set(['lim', 'max', 'min', 'sup', 'inf']);
const BIG: Record<string, string> = { sum: '∑', suma: '∑', prod: '∏', produs: '∏', int: '∫', integrala: '∫', iint: '∬', oint: '∮', '∑': '∑', '∏': '∏', '∫': '∫',
  // Integrala triplă, integrala pe o suprafață închisă, reuniunea și intersecția mare (a mai multor mulțimi), coprodusul.
  iiint: '∭', oiint: '∯', bigcup: '⋃', reuniune: '⋃', bigcap: '⋂', intersectie: '⋂', coprod: '∐',
  '∬': '∬', '∮': '∮', '∭': '∭', '∯': '∯', '⋃': '⋃', '⋂': '⋂', '∐': '∐' };
/** Semnele mari care au limitele în dreapta (integralele); celelalte (∑ ∏ ⋃ ⋂) le au deasupra și dedesubt. */
export const INTEGRALS = '∫∬∭∮∯';
const OPS2: Record<string, string> = { '<=': '≤', '>=': '≥', '!=': '≠', '+-': '±', '-+': '∓', '->': '→', '=>': '⇒', '~=': '≈', '==': '≡', '...': '…', '**': '×' };
const OPS1: Record<string, string> = { '+': '+', '-': '−', '=': '=', '<': '<', '>': '>', '*': '·', '±': '±', '×': '×', '÷': '÷', '·': '·', '≤': '≤', '≥': '≥', '≠': '≠', '≈': '≈', '→': '→', '⇒': '⇒', '←': '←', '↔': '↔', '⇔': '⇔', '⇌': '⇌', '∈': '∈', '∉': '∉', '⊂': '⊂', '∪': '∪', '∩': '∩', ',': ',', ';': ';', ':': ':', '!': '!', '|': '|', '%': '%', "'": '′' };

type Tok = { k: 'num' | 'word' | 'op' | 'open' | 'close' | 'sym'; s: string };
const isDigit = (c: string) => c >= '0' && c <= '9';
const isLetter = (c: string) => c.toLowerCase() !== c.toUpperCase() || c === 'ß';

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === String.fromCharCode(9)) { i++; continue; }
    if (isDigit(c)) {
      let j = i + 1;
      while (j < src.length && (isDigit(src[j]) || ((src[j] === '.' || src[j] === ',') && isDigit(src[j + 1] ?? '')))) j++;
      out.push({ k: 'num', s: src.slice(i, j) }); i = j; continue;
    }
    if (isLetter(c)) {
      let j = i + 1;
      while (j < src.length && isLetter(src[j])) j++;
      out.push({ k: 'word', s: src.slice(i, j) }); i = j; continue;
    }
    const three = src.slice(i, i + 3), two = src.slice(i, i + 2);
    if (OPS2[three]) { out.push({ k: 'op', s: OPS2[three] }); i += 3; continue; }
    if (OPS2[two]) { out.push({ k: 'op', s: OPS2[two] }); i += 2; continue; }
    if ('([{'.includes(c)) { out.push({ k: 'open', s: c }); i++; continue; }
    if (')]}'.includes(c)) { out.push({ k: 'close', s: c }); i++; continue; }
    if (c === '^' || c === '_' || c === '/' || c === '√' || BIG[c]) { out.push({ k: 'sym', s: c }); i++; continue; }
    out.push({ k: OPS1[c] ? 'op' : 'word', s: OPS1[c] ?? c }); i++;
  }
  return out;
}

export type EqNode =
  | { t: 'txt'; s: string; it: boolean }
  | { t: 'op'; s: string }
  | { t: 'row'; c: EqNode[] }
  /** nb = fără linie (numerele unul peste altul, ca la combinări: binom(n, k)). */
  /** k = felul: skw = oblică, mică (a⁄b, sfrac(a, b)); lin = pe rând, cu bară oblică (lfrac(a, b)); lipsă = una peste alta. */
  | { t: 'frac'; n: EqNode; d: EqNode; nb?: boolean; k?: 'skw' | 'lin' }
  | { t: 'scr'; b: EqNode; sup?: EqNode; sub?: EqNode }
  | { t: 'sqrt'; c: EqNode; k?: EqNode }
  | { t: 'par'; o: string; c: EqNode; cl: string }
  | { t: 'big'; s: string }
  | { t: 'acc'; k: AccKind; c: EqNode }
  /** Matrice / tabel de formule: mat(a, b; c, d) = rândurile despărțite de „;”, celulele de „,”. cases(…) = sistem: acoladă în stânga, rânduri aliniate la stânga. */
  | { t: 'mat'; r: EqNode[][]; cases?: boolean }
  /** underline(x): linie dedesubt; box(x): chenar în jur (de exemplu rezultatul final); overbrace(x) / underbrace(x): acoladă culcată deasupra / dedesubt. */
  | { t: 'enc'; k: 'under' | 'box' | 'obrace' | 'ubrace'; c: EqNode }
  /** overset(Δ, ->) / underset(n, X): ceva mic pus deasupra / dedesubt (Word: limUpp / limLow); săgeata se lungește cât textul (xrightarrow). */
  | { t: 'ovr'; b: EqNode; up?: EqNode; lo?: EqNode }
  /** {}_92^238 U: indicii puși în fața literei (numărul atomic și cel de masă, la fizică și chimie; Word: sPre). */
  | { t: 'pre'; b: EqNode; sub?: EqNode; sup?: EqNode };

/** Semnele puse deasupra unei litere: hat(x) căciulă, bar(x) bară, vec(v) săgeată de vector, dot(x) / ddot(x) puncte, tilde(x). */
export type AccKind = 'hat' | 'bar' | 'vec' | 'dot' | 'ddot' | 'tilde';
/** Săgețile care se lungesc cât textul pus deasupra / dedesubt (A + B overset(t, ->) C, la reacțiile chimice). */
export const ARROWS = '→←↔⇒⇔⇌';
export const ACCENTS: Record<string, AccKind> = { hat: 'hat', bar: 'bar', overline: 'bar', vec: 'vec', vector: 'vec', dot: 'dot', ddot: 'ddot', tilde: 'tilde' };
/** Semnul combinat (Unicode) al fiecărui accent, cum îl scrie un .docx în m:acc / m:chr. */
export const ACC_CHR: Record<AccKind, string> = {
  hat: String.fromCharCode(0x302), bar: String.fromCharCode(0x305), vec: String.fromCharCode(0x20d7),
  dot: String.fromCharCode(0x307), ddot: String.fromCharCode(0x308), tilde: String.fromCharCode(0x303),
};
/** Felul accentului după semn: cele combinate și cele de sine stătătoare (^ ¯ → ˙ ¨ ~), din .docx sau din MathML. */
export function accKindOf(ch: string): AccKind | null {
  const c = ch.trim().charCodeAt(0);
  if ([0x302, 0x5e, 0x2c6].includes(c)) return 'hat';
  if ([0x305, 0x304, 0xaf, 0x203e, 0x2015, 0x2014, 0x5f].includes(c)) return 'bar';
  if ([0x20d7, 0x20d1, 0x2192, 0x21c0].includes(c)) return 'vec';
  if ([0x307, 0x2d9, 0x2e].includes(c)) return 'dot';
  if ([0x308, 0xa8].includes(c)) return 'ddot';
  if ([0x303, 0x7e, 0x2dc, 0x223c].includes(c)) return 'tilde';
  return null;
}

/** Cuvintele pentru barele și colțurile care cresc: modulul, norma, partea întreagă (în jos / în sus). */
export const FENCES: Record<string, [string, string]> = {
  abs: ['|', '|'], modul: ['|', '|'], norm: ['‖', '‖'], norma: ['‖', '‖'],
  floor: ['⌊', '⌋'], ceil: ['⌈', '⌉'],
  // Parantezele unghiulare ⟨x⟩ (media, la fizică și statistică; produsul scalar).
  angle: ['⟨', '⟩'], unghiular: ['⟨', '⟩'],
};
const STACKS = new Set(['binom', 'comb', 'combinari', 'stack', 'stiva']);
const MATCH: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

/** Cifrele și semnele mici de sus / de jos (x², a₁, xⁿ⁺¹), cum vin din texte lipite: devin puteri și indici adevărați. */
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ', SUPN = '0123456789+-=()ni';
const SUBS = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₙᵢⱼₖₘₚₛₜ', SUBN = '0123456789+-=()aeoxnijkmpst';
export function unicodeScripts(src: string): string {
  let out = '';
  for (let i = 0; i < src.length;) {
    const sup = SUPS.includes(src[i]), sub = !sup && SUBS.includes(src[i]);
    if (!sup && !sub) { out += src[i++]; continue; }
    const set = sup ? SUPS : SUBS, plain = sup ? SUPN : SUBN;
    let run = '';
    while (i < src.length && set.includes(src[i])) run += plain[set.indexOf(src[i++])];
    out += (sup ? '^' : '_') + (run.length > 1 ? `(${run})` : run) + ' ';
  }
  return out;
}

/** Locul primului semn de relație (=, ≤, <…) dintr-un rând, la care se aliniază ecuațiile unui sistem; -1 dacă nu are. */
export function relIndex(n: EqNode): number {
  return n.t === 'row' ? n.c.findIndex((c, i) => i > 0 && c.t === 'op' && '=≤≥<>≠≈≡'.includes(c.s)) : -1;
}

/** Citește ecuația într-un arbore: fracțiile leagă mai tare decât + − =, puterile și indicii mai tare decât fracțiile. */
export function parseEq(src: string): EqNode {
  // Scrierea cu bară inversă (frac{a}{b}, alpha…) e tradusă întâi în scrierea Suite.
  const toks = tokenize(unicodeScripts(isLatexEq(src) ? latexToEq(src.slice(0, EQ_MAX)).slice(0, 2 * EQ_MAX) : src.slice(0, EQ_MAX)));
  let p = 0;
  const peek = () => toks[p];
  // Parantezele combinărilor rămân: fără ele, binom(n, k) ar fi doar două numere unul peste altul.
  const strip = (n: EqNode): EqNode => (n.t === 'par' && n.o === '(' && n.cl === ')' && !(n.c.t === 'frac' && n.c.nb) ? n.c : n);
  const row = (c: EqNode[]): EqNode => (c.length === 1 ? c[0] : { t: 'row', c });
  function parseRow(close?: string): EqNode {
    const items: EqNode[] = [];
    while (p < toks.length) {
      const tk = peek();
      if (tk.k === 'close') { if (tk.s === close) break; p++; items.push({ t: 'txt', s: tk.s, it: false }); continue; }
      items.push(parseFrac());
    }
    return row(items);
  }
  function parseFrac(): EqNode {
    let a = parseScript();
    while (peek()?.k === 'sym' && peek().s === '/' && a.t !== 'op') {
      p++;
      const b = p < toks.length && peek().k !== 'close' ? parseScript() : { t: 'txt', s: '', it: false } as EqNode;
      a = { t: 'frac', n: strip(a), d: strip(b) };
    }
    return a;
  }
  function parseArg(): EqNode {
    const tk = peek();
    if (!tk || tk.k === 'close') return { t: 'txt', s: '', it: false };
    // x^-1, x^+n: semnul merge împreună cu ce urmează.
    if (tk.k === 'op' && (tk.s === '−' || tk.s === '+')) { p++; return { t: 'row', c: [{ t: 'txt', s: tk.s, it: false }, strip(parseAtom())] }; }
    return strip(parseAtom());
  }
  function parseScript(): EqNode {
    const b = parseAtom();
    if (b.t === 'op') return b;
    let sup: EqNode | undefined, sub: EqNode | undefined;
    while (peek()?.k === 'sym' && (peek().s === '^' || peek().s === '_')) {
      const which = toks[p++].s;
      const arg = parseArg();
      if (which === '^' && !sup) sup = arg; else if (which === '_' && !sub) sub = arg;
    }
    // {}_92^238 U: indicii unui grup gol stau în fața a ce urmează (ca la bara inversă).
    const nx = peek();
    if ((sup || sub) && b.t === 'row' && !b.c.length && nx && nx.k !== 'close' && nx.k !== 'op' && !(nx.k === 'sym' && '^_/'.includes(nx.s))) {
      const o: EqNode & { t: 'pre' } = { t: 'pre', b: parseScript() };
      if (sub) o.sub = sub;
      if (sup) o.sup = sup;
      return o;
    }
    return sup || sub ? { t: 'scr', b, sup, sub } : b;
  }
  /** f(a, b): cele două bucăți despărțite de prima virgulă (după ea, virgulele rămân în a doua). */
  function twoArgs(): EqNode[][] {
    p++;
    const parts: EqNode[][] = [[]];
    while (p < toks.length && !(peek().k === 'close' && peek().s === ')')) {
      if (peek().k === 'op' && peek().s === ',' && parts.length === 1) { p++; parts.push([]); continue; }
      parts[parts.length - 1].push(parseFrac());
    }
    if (peek()) p++;
    return parts;
  }
  function parseAtom(): EqNode {
    const tk = toks[p++];
    if (!tk) return { t: 'txt', s: '', it: false };
    if (tk.k === 'num') return { t: 'txt', s: tk.s, it: false };
    if (tk.k === 'op') return { t: 'op', s: tk.s };
    if (tk.k === 'close') return { t: 'txt', s: tk.s, it: false };
    if (tk.k === 'open') {
      const inner = parseRow(MATCH[tk.s]);
      const cl = peek()?.k === 'close' && peek().s === MATCH[tk.s] ? toks[p++].s : '';
      // Acoladele doar grupează: {a+b}/2 se vede fără ele.
      return tk.s === '{' ? inner : { t: 'par', o: tk.s, c: inner, cl };
    }
    if (tk.k === 'sym') {
      if (tk.s === '√') return { t: 'sqrt', c: strip(parseArg()) };
      if (BIG[tk.s]) return { t: 'big', s: BIG[tk.s] };
      return { t: 'txt', s: tk.s, it: false };
    }
    const w = tk.s;
    if (w === 'sqrt' || w === 'rad') return { t: 'sqrt', c: strip(parseArg()) };
    if (w === 'root' && peek()?.k === 'open' && peek().s === '(') {
      // root(3, x): radicalul de ordin 3 din x.
      const parts = twoArgs();
      return parts.length > 1 ? { t: 'sqrt', k: row(parts[0]), c: row(parts[1]) } : { t: 'sqrt', c: row(parts[0]) };
    }
    if (BIG[w]) return { t: 'big', s: BIG[w] };
    // hat(x), vec(AB): accentul deasupra a ce e în paranteză (fără paranteză, cuvântul rămâne cuvânt).
    if (ACCENTS[w] && peek()?.k === 'open' && peek().s === '(') return { t: 'acc', k: ACCENTS[w], c: strip(parseAtom()) };
    if ((w === 'underline' || w === 'subliniat') && peek()?.k === 'open' && peek().s === '(') return { t: 'enc', k: 'under', c: strip(parseAtom()) };
    // underbrace(a + b)_(n termeni): acolada culcată sub termeni, cu eticheta dedesubt (overbrace: deasupra, cu ^).
    if ((w === 'overbrace' || w === 'acoladasus') && peek()?.k === 'open' && peek().s === '(') return { t: 'enc', k: 'obrace', c: strip(parseAtom()) };
    if ((w === 'underbrace' || w === 'acoladajos') && peek()?.k === 'open' && peek().s === '(') return { t: 'enc', k: 'ubrace', c: strip(parseAtom()) };
    if ((w === 'box' || w === 'chenar') && peek()?.k === 'open' && peek().s === '(') return { t: 'enc', k: 'box', c: strip(parseAtom()) };
    // braces(1, 2, 3): acolade care se văd (o mulțime), fiindcă { } simple doar grupează.
    if ((w === 'braces' || w === 'acolade') && peek()?.k === 'open' && peek().s === '(') return { t: 'par', o: '{', c: strip(parseAtom()), cl: '}' };
    // abs(x) = |x|, norm(x) = ‖x‖, floor(x) = ⌊x⌋, ceil(x) = ⌈x⌉: barele și colțurile cresc cât conținutul.
    if (FENCES[w] && peek()?.k === 'open' && peek().s === '(') return { t: 'par', o: FENCES[w][0], c: strip(parseAtom()), cl: FENCES[w][1] };
    // binom(n, k): combinările, n peste k în paranteze; stack(a, b): doar unul peste altul, fără linie.
    if (STACKS.has(w) && peek()?.k === 'open' && peek().s === '(') {
      const parts = twoArgs();
      const f: EqNode = { t: 'frac', n: row(parts[0]), d: row(parts[1] ?? []), nb: true };
      return w === 'stack' || w === 'stiva' ? f : { t: 'par', o: '(', c: f, cl: ')' };
    }
    // overset(sus, X) / underset(jos, X): ca la LaTeX, întâi ce stă deasupra / dedesubt, apoi baza; puse unul în altul se unesc.
    const OVER: Record<string, 'up' | 'lo'> = { overset: 'up', deasupra: 'up', stackrel: 'up', underset: 'lo', dedesubt: 'lo' };
    if (OVER[w] && peek()?.k === 'open' && peek().s === '(') {
      const parts = twoArgs();
      if (parts.length < 2) return row(parts[0]);
      const lim = row(parts[0]), base = row(parts[1]);
      const side = OVER[w];
      const m = base.t === 'ovr' && !base[side] ? { b: base.b, up: base.up, lo: base.lo, [side]: lim } : { b: base, [side]: lim };
      // Mereu în aceeași ordine (b, up, lo), oricum s-ar fi scris unul în altul.
      const o: EqNode & { t: 'ovr' } = { t: 'ovr', b: m.b };
      if (m.up) o.up = m.up;
      if (m.lo) o.lo = m.lo;
      return o;
    }
    // xrightarrow(text) / xleftarrow(text): săgeata cu textul deasupra, lungă cât el.
    if ((w === 'xrightarrow' || w === 'xleftarrow') && peek()?.k === 'open' && peek().s === '(') {
      return { t: 'ovr', b: { t: 'op', s: w === 'xrightarrow' ? '→' : '←' }, up: strip(parseAtom()) };
    }
    // sfrac(a, b): fracția oblică, mică (a⁄b); lfrac(a, b): pe rând, a/b (Word: m:type skw / lin).
    if ((w === 'sfrac' || w === 'lfrac') && peek()?.k === 'open' && peek().s === '(') {
      const parts = twoArgs();
      return { t: 'frac', n: row(parts[0]), d: row(parts[1] ?? []), k: w === 'sfrac' ? 'skw' : 'lin' };
    }
    const isCases = w === 'cases' || w === 'sistem';
    if ((w === 'mat' || w === 'matrix' || w === 'matrice' || isCases) && peek()?.k === 'open' && peek().s === '(') {
      // mat(a, b; c, d): fiecare celulă e o bucată de ecuație; rândurile mai scurte se completează cu celule goale.
      p++;
      const rows: EqNode[][][] = [[[]]];
      while (p < toks.length && !(peek().k === 'close' && peek().s === ')')) {
        const tk = peek();
        if (tk.k === 'op' && tk.s === ';') { p++; rows.push([[]]); continue; }
        if (tk.k === 'op' && tk.s === ',') { p++; rows[rows.length - 1].push([]); continue; }
        const r = rows[rows.length - 1];
        r[r.length - 1].push(parseFrac());
      }
      if (peek()) p++;
      const cols = Math.min(20, Math.max(...rows.map((r) => r.length)));
      const empty = (): EqNode => ({ t: 'txt', s: '', it: false });
      const r = rows.slice(0, 20).map((r) => Array.from({ length: cols }, (_, i) => (r[i]?.length ? row(r[i]) : empty())));
      return isCases ? { t: 'mat', r, cases: true } : { t: 'mat', r };
    }
    if (NAMES[w]) return { t: 'txt', s: NAMES[w], it: NAMES[w] >= 'α' && NAMES[w] <= 'ω' };
    if (FUNCS.has(w)) return { t: 'txt', s: w, it: false };
    return { t: 'txt', s: w, it: isLetter(w[0]) };
  }
  const root = parseRow();
  return root;
}

/** Ecuația scrisă cu bară inversă (butonul Copiază din fereastră), ca să fie lipită în alte programe sau pe site-uri. */
export const equationLatex = (src: string) => eqTreeToLatex(parseEq(src));

// ---------- Așezarea în pagină ----------
interface Box { w: number; a: number; d: number; draw(x: number, y: number): string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Lățimea aproximativă a unei litere, ca parte din mărimea fontului. */
function charW(c: string): number {
  if ('il.,;:!|′'.includes(c)) return 0.3;
  if ('jtfr()[]'.includes(c)) return 0.36;
  if ('mwMW'.includes(c)) return 0.8;
  if (isDigit(c)) return 0.5;
  if ('∑∏∫∬∭∮∯⋃⋂∐'.includes(c)) return 0.75;
  if ('=+−<>≤≥≠≈±∓→⇒←≡×÷·∈∉⊂∪∩'.includes(c)) return 0.62;
  if (c >= 'A' && c <= 'Z') return 0.66;
  return 0.52;
}
/** Culoarea cernelii pentru desenul curent (negru în Docs, culoarea textului temei în Slides). */
let INK = '#000';
const FONT = 'Cambria Math, Cambria, Times New Roman, serif';
function textBox(s: string, size: number, italic: boolean): Box {
  const w = [...s].reduce((t, c) => t + charW(c), 0) * size + (italic ? 0.06 * size : 0);
  return {
    w, a: 0.72 * size, d: 0.24 * size,
    draw: (x, y) => (s ? `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size.toFixed(1)}" font-family="${FONT}"${italic ? ' font-style="italic"' : ''}>${esc(s)}</text>` : ''),
  };
}
function hrow(boxes: Box[]): Box {
  const w = boxes.reduce((t, b) => t + b.w, 0);
  const a = Math.max(0, ...boxes.map((b) => b.a)), d = Math.max(0, ...boxes.map((b) => b.d));
  return { w, a, d, draw: (x, y) => { let cx = x; return boxes.map((b) => { const s = b.draw(cx, y); cx += b.w; return s; }).join(''); } };
}
const pad = (b: Box, l: number, r: number): Box => ({ w: b.w + l + r, a: b.a, d: b.d, draw: (x, y) => b.draw(x + l, y) });

function layout(n: EqNode, size: number): Box {
  switch (n.t) {
    case 'txt': return textBox(n.s, size, n.it);
    case 'op': {
      const b = textBox(n.s, size, false);
      if (',;!′%'.includes(n.s)) return pad(b, 0, 0.18 * size);
      if (n.s === '|') return pad(b, 0.06 * size, 0.06 * size);
      return pad(b, 0.24 * size, 0.24 * size);
    }
    case 'row': {
      // Un minus la început (−b) nu are spațiu în jur, ca semnul unui număr.
      const kids = n.c.map((c, i) => (c.t === 'op' && (c.s === '−' || c.s === '+' || c.s === '±') && (i === 0 || n.c[i - 1].t === 'op') ? textBox(c.s, size, false) : layout(c, size)));
      return hrow(kids);
    }
    case 'frac': {
      if (n.k === 'lin') {
        // Pe rând: a/b, cu paranteze în jurul bucăților din mai multe semne.
        const part = (x: EqNode) => layout(x.t === 'row' && x.c.length > 1 ? { t: 'par', o: '(', c: x, cl: ')' } : x, size);
        return hrow([part(n.n), pad(textBox('/', size, false), 0.04 * size, 0.04 * size), part(n.d)]);
      }
      if (n.k === 'skw') {
        // Oblică: numărătorul mic sus în stânga, bara înclinată, numitorul mic jos în dreapta.
        const s = Math.max(8, size * 0.7), nb = layout(n.n, s), db = layout(n.d, s), th = Math.max(1, 0.06 * size), sl = 0.42 * size, f = (v: number) => v.toFixed(1);
        const up = 0.45 * size;
        return {
          w: nb.w + sl + db.w + 0.1 * size, a: Math.max(0.78 * size, up + nb.a), d: Math.max(0.22 * size, db.d),
          draw: (x, y) => nb.draw(x + 0.05 * size, y - up) + `<path d="M${f(x + 0.05 * size + nb.w + 0.04 * size)} ${f(y + 0.18 * size)} L${f(x + 0.05 * size + nb.w + sl - 0.04 * size)} ${f(y - 0.78 * size)}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}" stroke-linecap="round"/>`
            + db.draw(x + 0.05 * size + nb.w + sl, y),
        };
      }
      const s = Math.max(9, size * 0.9);
      const nb = layout(n.n, s), db = layout(n.d, s);
      const axis = 0.3 * size, gap = 0.14 * size, th = Math.max(1, 0.06 * size), extra = 0.15 * size;
      const w = Math.max(nb.w, db.w) + 2 * extra;
      return {
        w: w + 0.12 * size, a: axis + gap + nb.d + nb.a, d: db.a + db.d + gap - axis,
        draw: (x, y) => {
          const bar = y - axis;
          return nb.draw(x + (w - nb.w) / 2, bar - gap - nb.d) + db.draw(x + (w - db.w) / 2, bar + gap + db.a)
            + (n.nb ? '' : `<rect x="${(x + 0.03 * size).toFixed(1)}" y="${(bar - th / 2).toFixed(1)}" width="${(w - 0.06 * size).toFixed(1)}" height="${th.toFixed(2)}"/>`);
        },
      };
    }
    case 'scr': {
      // Eticheta acoladei culcate stă sub / deasupra ei, ca limitele.
      const under = n.b.t === 'txt' && LIMITS.has(n.b.s) || n.b.t === 'enc' && (n.b.k === 'obrace' || n.b.k === 'ubrace');
      if (n.b.t === 'big' || under) {
        // Sumă / produs / integrală: simbolul mare, limitele deasupra și dedesubt (la integrală, în dreapta); lim / max / min: limita dedesubt.
        const big = n.b.t === 'big' ? textBox(n.b.s, size * 1.7, false) : layout(n.b, size), s = Math.max(8, size * 0.62);
        const up = n.sup ? layout(n.sup, s) : null, lo = n.sub ? layout(n.sub, s) : null;
        const shift = n.b.t === 'big' ? 0.32 * size : 0; // simbolul coborât, ca să stea pe axa ecuației
        if (n.b.t === 'big' && INTEGRALS.includes(n.b.s)) {
          const lw = Math.max(up?.w ?? 0, lo?.w ?? 0);
          return {
            w: big.w + lw + 0.1 * size, a: big.a - shift + (up ? 0.1 * size : 0), d: big.d + shift + (lo ? 0.15 * size : 0),
            draw: (x, y) => big.draw(x, y + shift) + (up ? up.draw(x + big.w * 0.85, y - big.a + shift + up.a * 0.6) : '') + (lo ? lo.draw(x + big.w * 0.55, y + shift + big.d + lo.a * 0.2) : ''),
          };
        }
        const w = Math.max(big.w, up?.w ?? 0, lo?.w ?? 0);
        const top = big.a - shift, bot = big.d + shift;
        return {
          w: w + 0.12 * size, a: top + (up ? up.a + up.d + 0.06 * size : 0), d: bot + (lo ? lo.a + lo.d + 0.04 * size : 0),
          draw: (x, y) => big.draw(x + (w - big.w) / 2, y + shift) + (up ? up.draw(x + (w - up.w) / 2, y - top - up.d - 0.06 * size) : '')
            + (lo ? lo.draw(x + (w - lo.w) / 2, y + bot + lo.a + 0.04 * size) : ''),
        };
      }
      const base = layout(n.b, size), s = Math.max(8, size * 0.7);
      const up = n.sup ? layout(n.sup, s) : null, lo = n.sub ? layout(n.sub, s) : null;
      const upY = up ? Math.max(0.42 * size, base.a - 0.55 * up.a) : 0, loY = lo ? Math.max(0.22 * size, base.d - 0.1 * size + 0.4 * lo.a) : 0;
      const sw = Math.max(up?.w ?? 0, lo?.w ?? 0) + 0.05 * size;
      return {
        w: base.w + sw, a: Math.max(base.a, up ? upY + up.a : 0), d: Math.max(base.d, lo ? loY + lo.d : 0),
        draw: (x, y) => base.draw(x, y) + (up ? up.draw(x + base.w + 0.03 * size, y - upY) : '') + (lo ? lo.draw(x + base.w + 0.01 * size, y + loY) : ''),
      };
    }
    case 'sqrt': {
      const c = layout(n.c, size), k = n.k ? layout(n.k, Math.max(7, size * 0.55)) : null;
      const gap = 0.2 * size, sw = 0.62 * size, lead = k ? Math.max(0, k.w - 0.3 * size) : 0, th = Math.max(1, 0.06 * size);
      const top = c.a + gap, bot = c.d;
      return {
        w: lead + sw + c.w + 0.18 * size, a: top + th + 0.04 * size, d: bot + 0.04 * size,
        draw: (x, y) => {
          const x0 = x + lead, yt = y - top, yb = y + bot, ym = y - 0.25 * size;
          const path = `M${x0.toFixed(1)} ${(ym + 0.06 * size).toFixed(1)} L${(x0 + 0.16 * size).toFixed(1)} ${(ym - 0.04 * size).toFixed(1)} L${(x0 + 0.32 * size).toFixed(1)} ${yb.toFixed(1)} L${(x0 + sw - 0.04 * size).toFixed(1)} ${yt.toFixed(1)} L${(x0 + sw + c.w + 0.12 * size).toFixed(1)} ${yt.toFixed(1)}`;
          return `<path d="${path}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}" stroke-linejoin="round"/>`
            + (k ? k.draw(x, ym - 0.12 * size) : '') + c.draw(x0 + sw + 0.04 * size, y);
        },
      };
    }
    case 'par': {
      const c = layout(n.c, size);
      const tall = c.a + c.d > 1.15 * size;
      if (!tall) return hrow([textBox(n.o, size, false), c, textBox(n.cl, size, false)]);
      // Paranteze mai înalte decât un rând: desenate, cât conținutul.
      const bw = 0.34 * size, th = Math.max(1, 0.07 * size), a = c.a + 0.08 * size, d = c.d + 0.08 * size;
      const bracket = (ch: string, x: number, y: number, left: boolean) => {
        if (!ch) return '';
        const yt = y - a, yb = y + d, xi = left ? x + bw * 0.85 : x + bw * 0.15, xo = left ? x + bw * 0.2 : x + bw * 0.8;
        if (ch === '(' || ch === ')') return `<path d="M${xi.toFixed(1)} ${yt.toFixed(1)} Q${xo.toFixed(1)} ${((yt + yb) / 2).toFixed(1)} ${xi.toFixed(1)} ${yb.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}"/>`;
        if (ch === '{' || ch === '}') {
          // Acolada: vârful din mijloc spre exterior.
          const xm = (xi + xo) / 2, m = (yt + yb) / 2, f = (v: number) => v.toFixed(1), q = 0.18 * size;
          return `<path d="M${f(xi)} ${f(yt)} Q${f(xm)} ${f(yt)} ${f(xm)} ${f(yt + q)} V${f(m - q)} Q${f(xm)} ${f(m)} ${f(xo)} ${f(m)} Q${f(xm)} ${f(m)} ${f(xm)} ${f(m + q)} V${f(yb - q)} Q${f(xm)} ${f(yb)} ${f(xi)} ${f(yb)}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}"/>`;
        }
        const line = (d: string) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}"/>`, f = (v: number) => v.toFixed(1), xm = (xi + xo) / 2;
        // Modulul: o bară dreaptă; norma: două; partea întreagă: colțul doar jos (⌊ ⌋) sau doar sus (⌈ ⌉).
        if (ch === '|') return line(`M${f(xm)} ${f(yt)} V${f(yb)}`);
        if (ch === '‖') { const g = 0.07 * size; return line(`M${f(xm - g)} ${f(yt)} V${f(yb)} M${f(xm + g)} ${f(yt)} V${f(yb)}`); }
        if (ch === '⌊' || ch === '⌋') return line(`M${f(xo)} ${f(yt)} V${f(yb)} H${f(xi)}`);
        if (ch === '⌈' || ch === '⌉') return line(`M${f(xi)} ${f(yt)} H${f(xo)} V${f(yb)}`);
        // Paranteza unghiulară: vârful la mijloc, spre exterior.
        if (ch === '⟨' || ch === '⟩') return line(`M${f(xi)} ${f(yt)} L${f(xo)} ${f((yt + yb) / 2)} L${f(xi)} ${f(yb)}`);
        return line(`M${f(xi)} ${f(yt)} H${f(xo)} V${f(yb)} H${f(xi)}`);
      };
      return {
        w: c.w + 2 * bw, a, d,
        draw: (x, y) => bracket(n.o, x, y, true) + c.draw(x + bw, y) + bracket(n.cl, x + bw + c.w, y, false),
      };
    }
    case 'big': return layout({ t: 'scr', b: n }, size);
    case 'mat': {
      // Celulele centrate în coloane, rândurile unul sub altul; tot tabelul stă pe axa ecuației (ca linia de fracție).
      const cells = n.r.map((r) => r.map((c) => layout(c, size)));
      const cols = cells[0]?.length ?? 0, cg = 0.8 * size, rg = 0.25 * size, axis = 0.3 * size;
      // Sistemul cu o coloană: fiecare rând mutat la dreapta ca semnele „=” să stea unul sub altul.
      const lw = n.r.map((r) => { const k = n.cases && cols === 1 ? relIndex(r[0]) : -1; return k < 0 || r[0].t !== 'row' ? -1 : layout({ t: 'row', c: r[0].c.slice(0, k) }, size).w; });
      const maxL = Math.max(-1, ...lw), shift = lw.map((l) => (l < 0 || lw.some((v) => v < 0) ? 0 : maxL - l));
      cells.forEach((r, i) => { if (shift[i]) r[0] = pad(r[0], shift[i], 0); });
      const cw = Array.from({ length: cols }, (_, i) => Math.max(0, ...cells.map((r) => r[i].w)));
      const ra = cells.map((r) => Math.max(0.72 * size, ...r.map((b) => b.a))), rd = cells.map((r) => Math.max(0.24 * size, ...r.map((b) => b.d)));
      const H = ra.reduce((t, a, i) => t + a + rd[i], 0) + rg * Math.max(0, cells.length - 1);
      const W = cw.reduce((t, w) => t + w, 0) + cg * Math.max(0, cols - 1);
      // Sistemul: acolada desenată în stânga, cât toate rândurile.
      const bw = n.cases ? 0.5 * size : 0, th = Math.max(1, 0.06 * size), f = (v: number) => v.toFixed(1);
      return {
        w: W + 0.2 * size + bw, a: axis + H / 2 + (n.cases ? 0.08 * size : 0), d: H / 2 - axis + (n.cases ? 0.08 * size : 0),
        draw: (x0, y) => {
          let yy = y - axis - H / 2, out = '';
          if (n.cases) {
            const t = yy - 0.08 * size, b = yy + H + 0.08 * size, m = (t + b) / 2, xl = x0 + 0.08 * size, xm = x0 + 0.22 * size, xr = x0 + 0.36 * size;
            out += `<path d="M${f(xr)} ${f(t)} Q${f(xm)} ${f(t)} ${f(xm)} ${f(t + 0.25 * size)} V${f(m - 0.2 * size)} Q${f(xm)} ${f(m)} ${f(xl)} ${f(m)} Q${f(xm)} ${f(m)} ${f(xm)} ${f(m + 0.2 * size)} V${f(b - 0.25 * size)} Q${f(xm)} ${f(b)} ${f(xr)} ${f(b)}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}"/>`;
          }
          const x = x0 + bw;
          cells.forEach((r, ri) => {
            const base = yy + ra[ri];
            let xx = x + 0.1 * size;
            r.forEach((b, ci) => { out += b.draw(xx + (n.cases ? 0 : (cw[ci] - b.w) / 2), base); xx += cw[ci] + cg; });
            yy = base + rd[ri] + rg;
          });
          return out;
        },
      };
    }
    case 'enc': {
      const c = layout(n.c, size), th = Math.max(1, 0.06 * size), f = (v: number) => v.toFixed(1);
      if (n.k === 'under') {
        const gap = 0.1 * size;
        return {
          w: c.w, a: c.a, d: c.d + gap + th,
          draw: (x, y) => c.draw(x, y) + `<rect x="${f(x)}" y="${f(y + c.d + gap)}" width="${f(c.w)}" height="${th.toFixed(2)}"/>`,
        };
      }
      if (n.k === 'obrace' || n.k === 'ubrace') {
        // Acolada culcată, cât tot conținutul, cu vârful la mijloc spre exterior.
        const gap = 0.08 * size, h = 0.3 * size, up = n.k === 'obrace';
        return {
          w: c.w + 0.1 * size, a: c.a + (up ? gap + h : 0), d: c.d + (up ? 0 : gap + h),
          draw: (x, y) => {
            const x0 = x + 0.05 * size, x1 = x0 + c.w, xm = (x0 + x1) / 2, q = Math.min(0.2 * size, c.w / 4);
            const s = up ? -1 : 1, y0 = up ? y - c.a - gap : y + c.d + gap, ym = y0 + s * h / 2, yt = y0 + s * h;
            const path = `M${f(x0)} ${f(y0)} Q${f(x0)} ${f(ym)} ${f(x0 + q)} ${f(ym)} H${f(xm - q)} Q${f(xm)} ${f(ym)} ${f(xm)} ${f(yt)} Q${f(xm)} ${f(ym)} ${f(xm + q)} ${f(ym)} H${f(x1 - q)} Q${f(x1)} ${f(ym)} ${f(x1)} ${f(y0)}`;
            return c.draw(x0, y) + `<path d="${path}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}" stroke-linejoin="round"/>`;
          },
        };
      }
      const pd = 0.18 * size;
      return {
        w: c.w + 2 * pd + 0.1 * size, a: c.a + pd, d: c.d + pd,
        draw: (x, y) => `<rect x="${f(x + 0.05 * size)}" y="${f(y - c.a - pd + th / 2)}" width="${f(c.w + 2 * pd)}" height="${f(c.a + c.d + 2 * pd - th)}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}"/>`
          + c.draw(x + 0.05 * size + pd, y),
      };
    }
    case 'pre': {
      // Ca puterea și indicele, dar în stânga bazei, lipiți de ea (aliniați la dreapta).
      const base = layout(n.b, size), s = Math.max(8, size * 0.7);
      const up = n.sup ? layout(n.sup, s) : null, lo = n.sub ? layout(n.sub, s) : null;
      const upY = up ? Math.max(0.42 * size, base.a - 0.55 * up.a) : 0, loY = lo ? Math.max(0.22 * size, base.d - 0.1 * size + 0.4 * lo.a) : 0;
      const sw = Math.max(up?.w ?? 0, lo?.w ?? 0) + 0.06 * size;
      return {
        w: base.w + sw, a: Math.max(base.a, up ? upY + up.a : 0), d: Math.max(base.d, lo ? loY + lo.d : 0),
        draw: (x, y) => (up ? up.draw(x + sw - 0.03 * size - up.w, y - upY) : '') + (lo ? lo.draw(x + sw - 0.03 * size - lo.w, y + loY) : '') + base.draw(x + sw, y),
      };
    }
    case 'ovr': {
      const s = Math.max(8, size * 0.7), g = 0.06 * size;
      const up = n.up ? layout(n.up, s) : null, lo = n.lo ? layout(n.lo, s) : null;
      const inner = Math.max(up?.w ?? 0, lo?.w ?? 0);
      const arrow = (n.b.t === 'op' || n.b.t === 'txt') && n.b.s.length === 1 && ARROWS.includes(n.b.s) ? n.b.s : '';
      // Săgeata desenată: cel puțin cât un semn obișnuit, altfel cât textul de pe ea plus câte puțin la capete.
      const base: Box = !arrow ? layout(n.b, size) : (() => {
        const w = Math.max(1.1 * size, inner + 0.5 * size), th = Math.max(1, 0.06 * size), hd = 0.16 * size, f = (v: number) => v.toFixed(1);
        return {
          w, a: 0.46 * size, d: 0.08 * size,
          draw: (x, y) => {
            const ym = y - 0.3 * size, x1 = x + w, line = (d: string) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
            const right = (yy: number) => `M${f(x1 - hd)} ${f(yy - hd * 0.65)} L${f(x1)} ${f(yy)} L${f(x1 - hd)} ${f(yy + hd * 0.65)}`;
            const left = (yy: number) => `M${f(x + hd)} ${f(yy - hd * 0.65)} L${f(x)} ${f(yy)} L${f(x + hd)} ${f(yy + hd * 0.65)}`;
            if (arrow === '⇌') {
              // Reacția în ambele sensuri: două săgeți cu câte o jumătate de vârf.
              const a = ym - 0.08 * size, b = ym + 0.08 * size;
              return line(`M${f(x)} ${f(a)} H${f(x1)} L${f(x1 - hd)} ${f(a - hd * 0.65)} M${f(x1)} ${f(b)} H${f(x)} L${f(x + hd)} ${f(b + hd * 0.65)}`);
            }
            if (arrow === '⇒' || arrow === '⇔') {
              const a = ym - 0.07 * size, b = ym + 0.07 * size, l = arrow === '⇔' ? x + hd * 0.5 : x;
              return line(`M${f(l)} ${f(a)} H${f(x1 - hd * 0.5)} M${f(l)} ${f(b)} H${f(x1 - hd * 0.5)} ${right(ym)}${arrow === '⇔' ? ' ' + left(ym) : ''}`);
            }
            return line(`M${f(x)} ${f(ym)} H${f(x1)} ${arrow === '←' ? left(ym) : right(ym)}${arrow === '↔' ? ' ' + left(ym) : ''}`);
          },
        };
      })();
      const w = Math.max(base.w, inner), pw = arrow ? 0.24 * size : 0.04 * size;
      return {
        w: w + 2 * pw, a: base.a + (up ? up.a + up.d + g : 0), d: base.d + (lo ? lo.a + lo.d + g : 0),
        draw: (x, y) => base.draw(x + pw + (w - base.w) / 2, y) + (up ? up.draw(x + pw + (w - up.w) / 2, y - base.a - g - up.d) : '')
          + (lo ? lo.draw(x + pw + (w - lo.w) / 2, y + base.d + g + lo.a) : ''),
      };
    }
    case 'acc': {
      const c = layout(n.c, size);
      // Semnul stă deasupra literelor (la x mic mai jos decât la X mare), cât toată lățimea pentru bară și vector.
      const th = Math.max(1, 0.06 * size), gap = 0.1 * size, mh = n.k === 'bar' ? th : n.k === 'vec' ? 0.22 * size : 0.18 * size;
      const top = Math.min(c.a, n.c.t === 'txt' && /^[a-zα-ω]+$/.test(n.c.s) && !/[bdfhklt]/.test(n.c.s) ? 0.5 * size : c.a);
      const slant = n.c.t === 'txt' && n.c.it ? 0.08 * size : 0;
      return {
        w: c.w, a: Math.max(c.a, top + gap + mh), d: c.d,
        draw: (x, y) => {
          const yb = y - top - gap, cx = x + c.w / 2 + slant, f = (v: number) => v.toFixed(1);
          const line = (d: string) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${th.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
          const hw = Math.max(0.2 * size, Math.min(c.w / 2, 0.32 * size));
          let mark = '';
          if (n.k === 'bar') mark = line(`M${f(x + 0.04 * size + slant)} ${f(yb)} H${f(x + c.w - 0.02 * size + slant)}`);
          else if (n.k === 'vec') {
            const x1 = x + 0.04 * size + slant, x2 = x + c.w + slant, ym = yb - mh / 2;
            mark = line(`M${f(x1)} ${f(ym)} H${f(x2)} M${f(x2 - 0.16 * size)} ${f(ym - 0.1 * size)} L${f(x2)} ${f(ym)} L${f(x2 - 0.16 * size)} ${f(ym + 0.1 * size)}`);
          } else if (n.k === 'hat') mark = line(`M${f(cx - hw)} ${f(yb)} L${f(cx)} ${f(yb - mh)} L${f(cx + hw)} ${f(yb)}`);
          else if (n.k === 'tilde') mark = line(`M${f(cx - hw)} ${f(yb - mh * 0.3)} Q${f(cx - hw / 2)} ${f(yb - mh * 1.2)} ${f(cx)} ${f(yb - mh * 0.5)} T${f(cx + hw)} ${f(yb - mh * 0.7)}`);
          else {
            const r = 0.065 * size, dots = n.k === 'dot' ? [cx] : [cx - 0.14 * size, cx + 0.14 * size];
            mark = dots.map((dx) => `<circle cx="${f(dx)}" cy="${f(yb - r)}" r="${r.toFixed(2)}"/>`).join('');
          }
          return c.draw(x, y) + mark;
        },
      };
    }
  }
}

/** Desenul ecuației ca SVG, cu lățimea și înălțimea lui. */
export function equationSvg(e: DocEquation, size = EQ_SIZE, ink = '#000'): { svg: string; w: number; h: number } {
  INK = /^#[0-9a-f]{3,8}$/i.test(ink) ? ink : '#000';
  const b = layout(parseEq(e.src), size);
  const m = Math.round(size * 0.3);
  const w = Math.max(10, Math.ceil(b.w + 2 * m)), h = Math.max(10, Math.ceil(b.a + b.d + 2 * m));
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="${INK}">${b.draw(m, m + b.a)}</svg>`, w, h };
}

export async function equationToPng(e: DocEquation, size = EQ_SIZE, scale = 3, ink = '#000'): Promise<{ src: string; w: number; h: number }> {
  const { svg, w, h } = equationSvg(e, size, ink);
  const blob = await svgToPng(svg, w, h, scale);
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return { src, w, h };
}

/** Textul alternativ (pentru cititorul de ecran, păstrat și în .docx) în limba interfeței de acum, ca numele foilor noi din Sheets. */
export const equationAlt = (e: DocEquation) => `${typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'Equation' : 'Ecuație'}: ${e.src}`.slice(0, 300);

export async function insertEquation(editor: Editor) {
  const e = newEquation();
  const { src, w } = await equationToPng(e);
  editor.chain().focus().insertContent({ type: 'image', attrs: { src, alt: equationAlt(e), width: w, align: 'center', equation: JSON.stringify(e) } }).run();
}
