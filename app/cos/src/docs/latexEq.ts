// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ecuațiile scrise cu bară inversă (de exemplu „frac{a}{b}”, „alpha”, „sqrt[3]{x}”, „begin{pmatrix} a & b ... end{pmatrix}”, fiecare cu
// bara inversă în față), cum le copiază oamenii din articole, manuale și site-uri, traduse în scrierea pe un rând din docs/equation.ts.
// Ce nu știm se lasă ca text (numele comenzii fără bară), nu se pierde. Bara inversă e scrisă prin cod (BS), nu în textul sursei.

import type { EqNode } from './equation';

const BS = String.fromCharCode(92);

/** Comenzile care devin un semn sau un cuvânt al ecuațiilor Suite. */
const SYM: Record<string, string> = {
  le: '<=', leq: '<=', leqslant: '<=', ge: '>=', geq: '>=', geqslant: '>=', ne: '!=', neq: '!=', pm: '+-', mp: '-+', times: '**', cdot: '*',
  div: '÷', to: '->', rightarrow: '->', Rightarrow: '=>', implies: '=>', approx: '~=', equiv: '==', infty: 'inf', ldots: '...', cdots: '...',
  dots: '...', vdots: 'vdots', ddots: 'ddots', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', lt: '<', gt: '>', '%': '%', '#': '#', '&': '&', ',': ' ', ';': ' ', ':': ' ',
  '!': '', ' ': ' ', quad: ' ', qquad: ' ', displaystyle: '', textstyle: '', limits: '', nolimits: '', varepsilon: 'epsilon', varphi: 'phi',
  vartheta: 'theta', ell: 'l', prime: "'", circ: 'grad', degree: 'grad', lbrace: 'braces(', rbrace: ')', mid: '|', vert: '|',
  langle: '⟨', rangle: '⟩', forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', sim: '~', propto: '∝', perp: '⊥', parallel: '∥',
  angle: '∠', leftarrow: '←', Leftrightarrow: '⇔', iff: '⇔', mapsto: '↦', supset: '⊃', subseteq: '⊆', supseteq: '⊇', emptyset: '∅',
  varnothing: '∅', setminus: '∖', hbar: 'ħ', triangle: '△', ast: '*', star: '⋆', bullet: '·',
  lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', lvert: '|', rvert: '|',
};
/** Comenzile cu un argument care devin funcțiile Suite (accente, chenar, acolade culcate). */
const FN: Record<string, string> = {
  vec: 'vec', overrightarrow: 'vec', hat: 'hat', widehat: 'hat', bar: 'bar', overline: 'bar', dot: 'dot', ddot: 'ddot', tilde: 'tilde',
  widetilde: 'tilde', underline: 'underline', boxed: 'box', fbox: 'box', overbrace: 'overbrace', underbrace: 'underbrace',
};
/** Comenzile de stil (aldin, drept, mulțimi) care păstrează doar conținutul. */
const STYLE = new Set(['mathbf', 'mathit', 'mathrm', 'mathsf', 'mathtt', 'mathbb', 'mathcal', 'mathfrak', 'boldsymbol', 'bm', 'operatorname', 'text', 'textrm', 'textit', 'textbf', 'mbox', 'mathop', 'mathnormal']);
/** Felurile de matrice și ce paranteze au. */
const ENV: Record<string, [string, string]> = {
  pmatrix: ['(', ')'], bmatrix: ['[', ']'], vmatrix: ['abs(', ')'], Vmatrix: ['norm(', ')'], Bmatrix: ['braces(', ')'], matrix: ['', ''], smallmatrix: ['', ''],
  array: ['', ''], aligned: ['', ''], align: ['', ''], 'align*': ['', ''], gathered: ['', ''], gather: ['', ''], split: ['', ''], cases: ['', ''],
};

/** Are textul măcar o comandă cu bară inversă? */
export const isLatexEq = (s: string) => s.includes(BS);

export function latexToEq(src: string): string {
  let i = 0;
  const isAlpha = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  /** Numele comenzii de după bara inversă: litere, sau un singur semn. */
  function name(): string {
    let j = i;
    while (j < src.length && isAlpha(src[j])) j++;
    if (j === i) j = Math.min(src.length, i + 1);
    else if (src[j] === '*') j++;
    const n = src.slice(i, j);
    i = j;
    return n;
  }
  const skipSpace = () => { while (src[i] === ' ') i++; };
  /** Un argument: {…} întreg sau un singur semn / o singură comandă. */
  function arg(): string {
    skipSpace();
    if (src[i] === '{') { i++; const s = seq('}'); if (src[i] === '}') i++; return s.trim(); }
    if (src[i] === BS) { i++; return cmd(name()).trim(); }
    return i < src.length ? src[i++] : '';
  }
  /** Textul dintre [ ] (ordinul radicalului), sau null dacă nu e. */
  function opt(): string | null {
    skipSpace();
    if (src[i] !== '[') return null;
    i++;
    const s = seq(']');
    if (src[i] === ']') i++;
    return s.trim();
  }
  /** Un text simplu dintr-un {…} (numele unui mediu, coloanele unui tabel). */
  function raw(): string {
    skipSpace();
    if (src[i] !== '{') return '';
    const j = src.indexOf('}', i);
    const s = src.slice(i + 1, j < 0 ? src.length : j);
    i = j < 0 ? src.length : j + 1;
    return s.trim();
  }
  function cmd(n: string): string {
    if (n === 'frac' || n === 'dfrac' || n === 'tfrac' || n === 'cfrac') { const a = arg(), b = arg(); return ` {${a}}/{${b}} `; }
    if (n === 'sfrac' || n === 'nicefrac') { const a = arg(), b = arg(); return ` sfrac({${a}}, {${b}}) `; }
    if (n === 'binom' || n === 'dbinom' || n === 'tbinom') { const a = arg(), b = arg(); return ` binom(${a}, ${b}) `; }
    if (n === 'sqrt') { const k = opt(), a = arg(); return k ? ` root(${k}, ${a}) ` : ` sqrt(${a}) `; }
    if (FN[n]) return ` ${FN[n]}(${arg()})`;
    // overset{sus}{X}, underset{jos}{X}, stackrel{sus}{X}; xrightarrow[jos]{sus}: săgeata cu text deasupra (și dedesubt).
    if (n === 'overset' || n === 'underset' || n === 'stackrel') { const a = arg(), b = arg(); return ` ${n === 'underset' ? 'underset' : 'overset'}({${a}}, {${b}}) `; }
    // prescript{sus}{jos}{X}: indicii în fața lui X, ca {}_jos^sus X.
    if (n === 'prescript') { const a = arg(), b = arg(), x = arg(); return ` {}${b ? `_{${b}}` : ''}${a ? `^{${a}}` : ''} {${x}} `; }
    if (n === 'xrightarrow' || n === 'xleftarrow') { const lo = opt(), a = arg(); const ar = `${n}({${a}})`; return lo ? ` underset({${lo}}, ${ar}) ` : ` ${ar} `; }
    if (STYLE.has(n)) return ` ${arg()} `;
    if (n === 'left' || n === 'right') {
      // Bara simplă sau dublă și colțurile lfloor / rfloor, lceil / rceil după left / right: modulul, norma, partea întreagă (cresc cât conținutul).
      skipSpace();
      const j = i;
      let m = src[i] === '|' ? (i++, '|') : '';
      if (!m && src[i] === BS && src[i + 1] === '|') { i += 2; m = 'V'; }
      if (!m && src[i] === BS) { i++; m = name(); }
      const fw = ({ '|': 'abs', vert: 'abs', lvert: 'abs', rvert: 'abs', V: 'norm', Vert: 'norm', lVert: 'norm', rVert: 'norm', lfloor: 'floor', rfloor: 'floor', lceil: 'ceil', rceil: 'ceil', langle: 'angle', rangle: 'angle' } as Record<string, string>)[m];
      if (fw) return n === 'left' ? ` ${fw}(` : ') ';
      i = j;
    }
    if (n === 'left' || n === 'right' || n === 'big' || n === 'Big' || n === 'bigg' || n === 'Bigg' || n === 'bigl' || n === 'bigr' || n === 'Bigl' || n === 'Bigr') {
      skipSpace();
      // left. / right. = fără paranteză; left{ … right} = acolade care se văd.
      if (src[i] === '.') { i++; return ' '; }
      if (src[i] === BS && (src[i + 1] === '{' || src[i + 1] === '}')) { i += 2; return src[i - 1] === '{' ? ' braces(' : ') '; }
      if (src[i] === BS) { i++; const m = name(); return m === 'lbrace' ? ' braces(' : m === 'rbrace' ? ') ' : m === 'langle' ? '(' : m === 'rangle' ? ')' : m === 'vert' || m === 'lvert' || m === 'rvert' ? '|' : ' '; }
      return i < src.length ? src[i++] : '';
    }
    if (n === '{') return ' braces(';
    if (n === '}') return ') ';
    if (n === BS) return ' ';
    if (n === 'begin') {
      const env = raw();
      if (env === 'array') raw(); // coloanele {cc}
      const [o, c] = ENV[env] ?? ['', ''];
      const body = seq('', env);
      const rows = body.split(String.fromCharCode(1)).map((r) => r.trim()).filter((r, k, all) => r || k < all.length - 1);
      // „x, & x >= 0”: virgula scrisă înainte de & e chiar despărțirea celulelor.
      const cells = rows.map((r) => r.split(String.fromCharCode(2)).map((x) => x.trim()).map((x, k, all) => (k < all.length - 1 && x.endsWith(',') ? x.slice(0, -1).trim() : x)));
      // aligned: „a &= b” e un singur rând de ecuație; matricele și sistemele au celule.
      const plain = env.startsWith('align') || env.startsWith('gather') || env === 'split';
      const inner = cells.map((r) => (plain ? r.join(' ') : r.join(', '))).join('; ');
      return env === 'cases' ? ` cases(${inner}) ` : ` ${o}mat(${inner})${c} `;
    }
    if (n === 'end') { raw(); return ''; }
    if (SYM[n] !== undefined) return ` ${SYM[n]} `;
    return ` ${n} `;
  }
  /** Citește până la semnul de închidere; în interiorul unui mediu, & și rândurile noi devin semne de despărțire. */
  function seq(close: string, env?: string): string {
    let out = '';
    while (i < src.length) {
      const c = src[i];
      if (close && c === close) break;
      if (c === BS) {
        i++;
        if (env !== undefined && src[i] === BS) { i++; out += String.fromCharCode(1); continue; }
        if (env !== undefined && src.startsWith('end{' + env + '}', i)) { i += env.length + 5; return out; }
        out += cmd(name());
        continue;
      }
      if (env !== undefined && c === '&') { i++; out += String.fromCharCode(2); continue; }
      if (c === '{') { i++; out += '{' + seq('}') + '}'; if (src[i] === '}') i++; continue; }
      if (c === '~') { i++; out += ' '; continue; }
      out += c;
      i++;
    }
    return out;
  }
  const out = seq('');
  return out.replace(/ +/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();
}

// ---------- Invers: ecuația Suite în scrierea cu bară inversă (pentru „Copiază”) ----------
const GREEK: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', Γ: 'Gamma', δ: 'delta', Δ: 'Delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', Θ: 'Theta', ι: 'iota',
  κ: 'kappa', λ: 'lambda', Λ: 'Lambda', μ: 'mu', ν: 'nu', ξ: 'xi', Ξ: 'Xi', π: 'pi', Π: 'Pi', ρ: 'rho', σ: 'sigma', Σ: 'Sigma', τ: 'tau',
  φ: 'phi', Φ: 'Phi', χ: 'chi', ψ: 'psi', Ψ: 'Psi', ω: 'omega', Ω: 'Omega', '∞': 'infty', '∇': 'nabla', '∂': 'partial', '°': 'circ',
};
const OPS_TEX: Record<string, string> = {
  '≤': 'le', '≥': 'ge', '≠': 'ne', '±': 'pm', '∓': 'mp', '→': 'to', '⇒': 'Rightarrow', '≈': 'approx', '≡': 'equiv', '…': 'ldots', '×': 'times',
  '·': 'cdot', '÷': 'div', '⋯': 'cdots', '⋮': 'vdots', '⋱': 'ddots', '∈': 'in', '∉': 'notin', '⊂': 'subset', '∪': 'cup', '∩': 'cap',
};
const BIG_TEX: Record<string, string> = { '∑': 'sum', '∏': 'prod', '∫': 'int', '∬': 'iint', '∮': 'oint', '∭': 'iiint', '∯': 'oiint', '⋃': 'bigcup', '⋂': 'bigcap', '∐': 'coprod' };
const FN_TEX = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'det', 'sup', 'gcd']);
const ACC_TEX: Record<string, string> = { hat: 'hat', bar: 'overline', vec: 'vec', dot: 'dot', ddot: 'ddot', tilde: 'tilde' };
const ENC_TEX: Record<string, string> = { under: 'underline', box: 'boxed', obrace: 'overbrace', ubrace: 'underbrace' };
/** Semnele modulului / normei / părții întregi scrise cu bară inversă (după left / right). */
const FENCE_TEX: Record<string, string> = { '‖': '|', '⌊': 'lfloor', '⌋': 'rfloor', '⌈': 'lceil', '⌉': 'rceil', '⟨': 'langle', '⟩': 'rangle' };
const MAT_ENV: Record<string, string> = { '(': 'pmatrix', '[': 'bmatrix', '|': 'vmatrix', '{': 'Bmatrix', '‖': 'Vmatrix' };

/** Arborele unei ecuații (parseEq) scris cu bară inversă. */
export function eqTreeToLatex(n: EqNode): string {
  const c = (x: string) => `${BS}${x}`;
  const g = (x: EqNode) => `{${eqTreeToLatex(x)}}`;
  switch (n.t) {
    case 'txt':
      if (GREEK[n.s]) return c(GREEK[n.s]);
      if (FN_TEX.has(n.s)) return c(n.s);
      if (n.s === '⋮' || n.s === '⋱' || n.s === '⋯') return c(OPS_TEX[n.s]);
      return [...n.s].map((ch) => (GREEK[ch] ? c(GREEK[ch]) + ' ' : '%#&_{}'.includes(ch) ? BS + ch : ch)).join('').trim();
    case 'op': return n.s === '−' ? '-' : OPS_TEX[n.s] ? c(OPS_TEX[n.s]) : n.s;
    case 'row': return n.c.map(eqTreeToLatex).join(' ');
    case 'frac': if (n.k === 'skw') return `${c('sfrac')}${g(n.n)}${g(n.d)}`;
      if (n.k === 'lin') return `${g(n.n)}/${g(n.d)}`;
      return n.nb ? `{${eqTreeToLatex(n.n)} ${c('atop')} ${eqTreeToLatex(n.d)}}` : `${c('frac')}${g(n.n)}${g(n.d)}`;
    case 'sqrt': return n.k ? `${c('sqrt')}[${eqTreeToLatex(n.k)}]${g(n.c)}` : `${c('sqrt')}${g(n.c)}`;
    case 'big': return c(BIG_TEX[n.s] ?? 'sum');
    case 'scr': {
      const base = eqTreeToLatex(n.b);
      const simple = n.b.t === 'txt' || n.b.t === 'big' || n.b.t === 'acc' || n.b.t === 'enc' || n.b.t === 'par';
      return `${simple ? base : `{${base}}`}${n.sub ? `_${g(n.sub)}` : ''}${n.sup ? `^${g(n.sup)}` : ''}`;
    }
    case 'par': {
      if (n.c.t === 'mat' && !n.c.cases && MAT_ENV[n.o] && (n.cl === ({ '(': ')', '[': ']', '|': '|', '{': '}', '‖': '‖' } as Record<string, string>)[n.o])) return matTex(n.c, MAT_ENV[n.o]);
      if (n.c.t === 'frac' && n.c.nb && n.o === '(' && n.cl === ')') return `${c('binom')}${g(n.c.n)}${g(n.c.d)}`;
      const side = (s: string) => (!s ? '.' : s === '{' || s === '}' ? BS + s : FENCE_TEX[s] ? c(FENCE_TEX[s]) : s);
      return `${c('left')}${side(n.o)} ${eqTreeToLatex(n.c)} ${c('right')}${side(n.cl)}`;
    }
    case 'acc': return `${c(ACC_TEX[n.k])}${g(n.c)}`;
    case 'enc': return `${c(ENC_TEX[n.k])}${g(n.c)}`;
    case 'pre': {
      const b = eqTreeToLatex(n.b);
      return `{}${n.sub ? `_${g(n.sub)}` : ''}${n.sup ? `^${g(n.sup)}` : ''}${n.b.t === 'txt' ? b : `{${b}}`}`;
    }
    case 'ovr': {
      // Săgeata spre dreapta / stânga cu text: xrightarrow[jos]{sus}; altfel overset / underset unul în altul.
      if (n.b.t === 'op' && (n.b.s === '→' || n.b.s === '←') && n.up) return `${c(n.b.s === '→' ? 'xrightarrow' : 'xleftarrow')}${n.lo ? `[${eqTreeToLatex(n.lo)}]` : ''}${g(n.up)}`;
      const lo = n.lo ? `${c('underset')}${g(n.lo)}${g(n.b)}` : eqTreeToLatex(n.b);
      return n.up ? `${c('overset')}${g(n.up)}{${lo}}` : lo;
    }
    case 'mat': return matTex(n, n.cases ? 'cases' : 'matrix');
  }
  function matTex(m: Extract<EqNode, { t: 'mat' }>, env: string): string {
    return `${c('begin')}{${env}} ${m.r.map((r) => r.map(eqTreeToLatex).join(' & ')).join(` ${BS}${BS} `)} ${c('end')}{${env}}`;
  }
}
