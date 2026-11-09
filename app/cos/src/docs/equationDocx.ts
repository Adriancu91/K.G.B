// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ecuațiile Suite (docs/equation.ts) scrise în .docx / .pptx ca ecuații adevărate (OMML, m:oMath) și în .odt ca MathML, nu ca poză: în celălalt program
// se pot schimba, iar la redeschiderea în Suite redevin ecuații (omml.ts). Arborele e cel din parseEq, folosit și la desen.
import type * as D from 'docx';
import { ACC_CHR, ARROWS, INTEGRALS, parseEq, relIndex, type EqNode } from './equation';

type Lib = typeof D;
type M = D.MathComponent;

/** Limitele scrise sub nume (lim, max, min), ca în desen. */
const LIM_NAMES = new Set(['lim', 'max', 'min', 'sup', 'inf']);
/** Acoladele culcate (deasupra / dedesubt), cum le scrie un .docx în m:groupChr și MathML în mover / munder. */
const OBRACE = String.fromCharCode(0x23de), UBRACE = String.fromCharCode(0x23df);
const isBrace = (n: EqNode) => n.t === 'enc' && (n.k === 'obrace' || n.k === 'ubrace');
/** Săgeata de sub / de deasupra unui text (xrightarrow, overset(t, ->)): în .docx e m:groupChr, care o lungește cât textul. */
const arrowOf = (n: EqNode) => ((n.t === 'op' || n.t === 'txt') && n.s.length === 1 && ARROWS.includes(n.s) ? n.s : '');

export function equationMath(src: string, lib: Lib): D.Math | null {
  const s = src.trim();
  if (!s) return null;
  const run = (text: string, plain = false): M => new lib.MathRun(plain ? { text, style: 'plain' } : text);
  const flat = (n: EqNode | undefined): EqNode[] => (!n ? [] : n.t === 'row' ? n.c : [n]);
  // Un rând de noduri; operatorii mari (∑, ∫) iau ca argument nodul de după ei.
  const many = (items: EqNode[]): M[] => {
    const out: M[] = [];
    for (let i = 0; i < items.length; i++) {
      const n = items[i];
      const big = n.t === 'big' ? n : n.t === 'scr' && n.b.t === 'big' ? n.b : null;
      if (big && big.t === 'big') {
        const next = items[i + 1] && items[i + 1].t !== 'op' ? items[++i] : undefined;
        const sc = n.t === 'scr' ? n : null;
        const children = next ? one(next) : [];
        const sub = sc?.sub ? one(sc.sub) : undefined, sup = sc?.sup ? one(sc.sup) : undefined;
        if (big.s === '∑') out.push(new lib.MathSum({ children, subScript: sub, superScript: sup }));
        else if (big.s === '∫') out.push(new lib.MathIntegral({ children, subScript: sub, superScript: sup }));
        else {
          // Produsul, integralele duble / triple, reuniunea, intersecția: m:nary cu semnul lor, făcut din elementele bibliotecii.
          const el = (name: string, kids: unknown[] = [], val?: string) => new lib.BuilderElement({ name, children: kids as D.XmlComponent[], ...(val !== undefined ? { attributes: { v: { key: 'm:val', value: val } } } : {}) });
          const pr = [el('m:chr', [], big.s), el('m:limLoc', [], INTEGRALS.includes(big.s) ? 'subSup' : 'undOvr'), ...(sub ? [] : [el('m:subHide', [], '1')]), ...(sup ? [] : [el('m:supHide', [], '1')])];
          out.push(el('m:nary', [el('m:naryPr', pr), el('m:sub', sub ?? []), el('m:sup', sup ?? []), el('m:e', children)]) as unknown as M);
        }
        continue;
      }
      out.push(...one(n));
    }
    return out;
  };
  const one = (n: EqNode): M[] => {
    switch (n.t) {
      case 'txt': return n.s ? [run(n.s, !n.it && /\p{L}/u.test(n.s))] : [];
      case 'op': return [run(n.s)];
      case 'row': return many(n.c);
      case 'frac': {
        if (!n.nb && !n.k) return [new lib.MathFraction({ numerator: one(n.n), denominator: one(n.d) })];
        // Fără linie (combinările): m:f cu m:type noBar, făcut din elementele bibliotecii.
        const el = (name: string, children: unknown[] = [], val?: string) => new lib.BuilderElement({ name, children: children as D.XmlComponent[], ...(val !== undefined ? { attributes: { v: { key: 'm:val', value: val } } } : {}) });
        return [el('m:f', [el('m:fPr', [el('m:type', [], n.k ?? 'noBar')]), el('m:num', one(n.n)), el('m:den', one(n.d))]) as unknown as M];
      }
      case 'sqrt': return [new lib.MathRadical({ children: one(n.c), ...(n.k ? { degree: one(n.k) } : {}) })];
      case 'big': return [run(n.s)];
      case 'acc': {
        // Biblioteca n-are accente: m:acc (sau m:bar sus, pentru bară) făcut din elementele ei.
        const el = (name: string, children: unknown[] = [], val?: string) => new lib.BuilderElement({ name, children: children as D.XmlComponent[], ...(val !== undefined ? { attributes: { v: { key: 'm:val', value: val } } } : {}) });
        const e = el('m:e', one(n.c));
        return [(n.k === 'bar' ? el('m:bar', [el('m:barPr', [el('m:pos', [], 'top')]), e]) : el('m:acc', [el('m:accPr', [el('m:chr', [], ACC_CHR[n.k])]), e])) as unknown as M];
      }
      case 'enc': {
        const el = (name: string, children: unknown[] = [], val?: string) => new lib.BuilderElement({ name, children: children as D.XmlComponent[], ...(val !== undefined ? { attributes: { v: { key: 'm:val', value: val } } } : {}) });
        const e = el('m:e', one(n.c));
        if (n.k === 'obrace' || n.k === 'ubrace') {
          const up = n.k === 'obrace';
          return [el('m:groupChr', [el('m:groupChrPr', [el('m:chr', [], up ? OBRACE : UBRACE), el('m:pos', [], up ? 'top' : 'bot'), el('m:vertJc', [], up ? 'bot' : 'top')]), e]) as unknown as M];
        }
        return [(n.k === 'under' ? el('m:bar', [el('m:barPr', [el('m:pos', [], 'bot')]), e]) : el('m:borderBox', [e])) as unknown as M];
      }
      case 'mat': {
        const el = (name: string, children: unknown[]) => new lib.BuilderElement({ name, children: children as D.XmlComponent[] });
        const m = el('m:m', n.r.map((r) => el('m:mr', r.map((c) => el('m:e', one(c))))));
        if (!n.cases) return [m as unknown as M];
        // Sistemul: acolada din stânga (m:d fără paranteza din dreapta) în jurul unui șir de ecuații (sau al matricei, la mai multe coloane).
        const val = (name: string, v: string) => new lib.BuilderElement({ name, attributes: { v: { key: 'm:val', value: v } } });
        // Semnul „=” al fiecărui rând poartă m:aln: ecuațiile se aliniază la el, ca în desen.
        const aln = (c: EqNode): M[] => {
          const k = relIndex(c);
          if (k < 0 || c.t !== 'row' || c.c[k].t !== 'op') return one(c);
          const op = c.c[k];
          return [...many(c.c.slice(0, k)), el('m:r', [el('m:rPr', [el('m:aln', [])]), new lib.BuilderElement({ name: 'm:t', children: [(op as { s: string }).s] as unknown as D.XmlComponent[] })]) as unknown as M, ...many(c.c.slice(k + 1))];
        };
        const body = n.r[0]?.length === 1 ? el('m:eqArr', n.r.map((r) => el('m:e', aln(r[0])))) : m;
        return [el('m:d', [el('m:dPr', [val('m:begChr', '{'), val('m:endChr', '')]), el('m:e', [body])]) as unknown as M];
      }
      case 'par': {
        const inner = one(n.c);
        if (n.o === '(' && n.cl === ')') return [new lib.MathRoundBrackets({ children: inner })];
        if (n.o === '[' && n.cl === ']') return [new lib.MathSquareBrackets({ children: inner })];
        if (n.o === '{' && n.cl === '}') return [new lib.MathCurlyBrackets({ children: inner })];
        // Modulul, norma, partea întreagă: m:d cu semnele lor, ca să crească și în fișier cât conținutul.
        const el = (name: string, children: unknown[] = [], val?: string) => new lib.BuilderElement({ name, children: children as D.XmlComponent[], ...(val !== undefined ? { attributes: { v: { key: 'm:val', value: val } } } : {}) });
        return [el('m:d', [el('m:dPr', [el('m:begChr', [], n.o), el('m:endChr', [], n.cl)]), el('m:e', inner)]) as unknown as M];
      }
      case 'pre': return [new lib.MathPreSubSuperScript({ children: one(n.b), subScript: n.sub ? one(n.sub) : [], superScript: n.sup ? one(n.sup) : [] })];
      case 'ovr': {
        // Săgeata cu text: textul e baza lui m:groupChr, săgeata dedesubt (text deasupra) sau deasupra (doar text dedesubt).
        const ar = arrowOf(n.b);
        if (ar && (n.up || n.lo)) {
          const el = (name: string, children: unknown[] = [], val?: string) => new lib.BuilderElement({ name, children: children as D.XmlComponent[], ...(val !== undefined ? { attributes: { v: { key: 'm:val', value: val } } } : {}) });
          const top = !n.up;
          const g = el('m:groupChr', [el('m:groupChrPr', [el('m:chr', [], ar), el('m:pos', [], top ? 'top' : 'bot'), el('m:vertJc', [], top ? 'bot' : 'top')]), el('m:e', one((n.up ?? n.lo)!))]) as unknown as M;
          return n.up && n.lo ? [new lib.MathLimitLower({ children: [g], limit: one(n.lo) }) as unknown as M] : [g];
        }
        const base = one(n.b);
        const lo: M[] = n.lo ? [new lib.MathLimitLower({ children: base, limit: one(n.lo) }) as unknown as M] : base;
        return n.up ? [new lib.MathLimitUpper({ children: lo, limit: one(n.up) }) as unknown as M] : lo;
      }
      case 'scr': {
        if (n.b.t === 'big') return many([n]);
        const base = one(n.b);
        if (n.b.t === 'txt' && LIM_NAMES.has(n.b.s) && n.sub && !n.sup) return [new lib.MathLimitLower({ children: base, limit: one(n.sub) }) as unknown as M];
        if (isBrace(n.b)) {
          // Eticheta acoladei culcate: sub ea (m:limLow) sau deasupra (m:limUpp).
          const lo: M[] = n.sub ? [new lib.MathLimitLower({ children: base, limit: one(n.sub) }) as unknown as M] : base;
          return n.sup ? [new lib.MathLimitUpper({ children: lo, limit: one(n.sup) }) as unknown as M] : lo;
        }
        const sub = n.sub ? one(n.sub) : undefined, sup = n.sup ? one(n.sup) : undefined;
        if (sub && sup) return [new lib.MathSubSuperScript({ children: base, subScript: sub, superScript: sup })];
        if (sup) return [new lib.MathSuperScript({ children: base, superScript: sup })];
        if (sub) return [new lib.MathSubScript({ children: base, subScript: sub })];
        return base;
      }
    }
  };
  const children = many(flat(parseEq(s)));
  return children.length ? new lib.Math({ children }) : null;
}

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Aceeași ecuație ca text OMML (un m:oMath), pentru fișierele în care o scriem direct în XML (.pptx, în a14:m).
 * `rPr` dă proprietățile literelor din fiecare m:r (la .pptx: a:rPr cu culoarea și fontul), puse după m:rPr.
 */
export function equationOmmlXml(src: string, rPr = ''): string | null {
  const s = src.trim();
  if (!s) return null;
  const run = (text: string, plain = false) => `<m:r>${plain ? '<m:rPr><m:sty m:val="p"/></m:rPr>' : ''}${rPr}<m:t xml:space="preserve">${xmlEsc(text)}</m:t></m:r>`;
  const wrap = (tag: string, inner: string) => `<m:${tag}>${inner}</m:${tag}>`;
  const scripts = (base: string, sub?: string, sup?: string) => sub !== undefined && sup !== undefined ? wrap('sSubSup', wrap('e', base) + wrap('sub', sub) + wrap('sup', sup))
    : sub !== undefined ? wrap('sSub', wrap('e', base) + wrap('sub', sub)) : sup !== undefined ? wrap('sSup', wrap('e', base) + wrap('sup', sup)) : base;
  const many = (items: EqNode[]): string => {
    let out = '';
    for (let i = 0; i < items.length; i++) {
      const n = items[i];
      const big = n.t === 'big' ? n : n.t === 'scr' && n.b.t === 'big' ? n.b : null;
      if (big && big.t === 'big') {
        const next = items[i + 1] && items[i + 1].t !== 'op' ? items[++i] : undefined;
        const sc = n.t === 'scr' ? n : null;
        const pr = `<m:naryPr><m:chr m:val="${xmlEsc(big.s)}"/><m:limLoc m:val="${INTEGRALS.includes(big.s) ? 'subSup' : 'undOvr'}"/>${sc?.sub ? '' : '<m:subHide m:val="1"/>'}${sc?.sup ? '' : '<m:supHide m:val="1"/>'}</m:naryPr>`;
        out += wrap('nary', pr + wrap('sub', sc?.sub ? one(sc.sub) : '') + wrap('sup', sc?.sup ? one(sc.sup) : '') + wrap('e', next ? one(next) : ''));
        continue;
      }
      out += one(n);
    }
    return out;
  };
  const one = (n: EqNode): string => {
    switch (n.t) {
      case 'txt': return n.s ? run(n.s, !n.it && /\p{L}/u.test(n.s)) : '';
      case 'op': return run(n.s);
      case 'row': return many(n.c);
      case 'frac': return wrap('f', (n.nb || n.k ? `<m:fPr><m:type m:val="${n.k ?? 'noBar'}"/></m:fPr>` : '') + wrap('num', one(n.n)) + wrap('den', one(n.d)));
      case 'sqrt': return wrap('rad', (n.k ? '<m:deg>' + one(n.k) + '</m:deg>' : '<m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>') + wrap('e', one(n.c)));
      case 'big': return run(n.s);
      case 'enc':
        if (n.k === 'obrace' || n.k === 'ubrace') {
          const up = n.k === 'obrace';
          return wrap('groupChr', `<m:groupChrPr><m:chr m:val="${up ? OBRACE : UBRACE}"/><m:pos m:val="${up ? 'top' : 'bot'}"/><m:vertJc m:val="${up ? 'bot' : 'top'}"/></m:groupChrPr>` + wrap('e', one(n.c)));
        }
        return n.k === 'under' ? wrap('bar', '<m:barPr><m:pos m:val="bot"/></m:barPr>' + wrap('e', one(n.c))) : wrap('borderBox', wrap('e', one(n.c)));
      case 'acc': return n.k === 'bar' ? wrap('bar', '<m:barPr><m:pos m:val="top"/></m:barPr>' + wrap('e', one(n.c)))
        : wrap('acc', `<m:accPr><m:chr m:val="${ACC_CHR[n.k]}"/></m:accPr>` + wrap('e', one(n.c)));
      case 'mat': {
        const m = wrap('m', n.r.map((r) => wrap('mr', r.map((c) => wrap('e', one(c))).join(''))).join(''));
        if (!n.cases) return m;
        const aln = (c: EqNode): string => {
          const k = relIndex(c);
          if (k < 0 || c.t !== 'row' || c.c[k].t !== 'op') return one(c);
          return many(c.c.slice(0, k)) + `<m:r><m:rPr><m:aln/></m:rPr>${rPr}<m:t xml:space="preserve">${xmlEsc((c.c[k] as { s: string }).s)}</m:t></m:r>` + many(c.c.slice(k + 1));
        };
        const body = n.r[0]?.length === 1 ? wrap('eqArr', n.r.map((r) => wrap('e', aln(r[0]))).join('')) : m;
        return wrap('d', '<m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr>' + wrap('e', body));
      }
      case 'par': return wrap('d', `<m:dPr><m:begChr m:val="${xmlEsc(n.o)}"/><m:endChr m:val="${xmlEsc(n.cl)}"/></m:dPr>` + wrap('e', one(n.c)));
      case 'pre': return wrap('sPre', wrap('sub', n.sub ? one(n.sub) : '') + wrap('sup', n.sup ? one(n.sup) : '') + wrap('e', one(n.b)));
      case 'ovr': {
        const ar = arrowOf(n.b);
        if (ar && (n.up || n.lo)) {
          const top = !n.up;
          const g = wrap('groupChr', `<m:groupChrPr><m:chr m:val="${ar}"/><m:pos m:val="${top ? 'top' : 'bot'}"/><m:vertJc m:val="${top ? 'bot' : 'top'}"/></m:groupChrPr>` + wrap('e', one((n.up ?? n.lo)!)));
          return n.up && n.lo ? wrap('limLow', wrap('e', g) + wrap('lim', one(n.lo))) : g;
        }
        const lo = n.lo ? wrap('limLow', wrap('e', one(n.b)) + wrap('lim', one(n.lo))) : one(n.b);
        return n.up ? wrap('limUpp', wrap('e', lo) + wrap('lim', one(n.up))) : lo;
      }
      case 'scr': {
        if (n.b.t === 'big') return many([n]);
        const base = one(n.b);
        if (n.b.t === 'txt' && LIM_NAMES.has(n.b.s) && n.sub && !n.sup) return wrap('limLow', wrap('e', base) + wrap('lim', one(n.sub)));
        if (isBrace(n.b)) {
          const lo = n.sub ? wrap('limLow', wrap('e', base) + wrap('lim', one(n.sub))) : base;
          return n.sup ? wrap('limUpp', wrap('e', lo) + wrap('lim', one(n.sup))) : lo;
        }
        return scripts(base, n.sub ? one(n.sub) : undefined, n.sup ? one(n.sup) : undefined);
      }
    }
  };
  const inner = many(flat(parseEq(s)));
  return inner ? wrap('oMath', inner) : null;
}

const flat = (n: EqNode | undefined): EqNode[] => (!n ? [] : n.t === 'row' ? n.c : [n]);

/** Semnele de sine stătătoare ale accentelor, cum le pune MathML în <mover accent> (căciulă, bară, săgeată, punct, două puncte, tildă). */
const MML_ACC: Record<string, string> = { hat: '^', bar: String.fromCharCode(0xaf), vec: String.fromCharCode(0x2192), dot: String.fromCharCode(0x2d9), ddot: String.fromCharCode(0xa8), tilde: '~' };

/** Aceeași ecuație ca MathML (elementul <math>), pentru obiectele formulă din .odt („Object N/content.xml”). */
export function equationMathmlXml(src: string): string | null {
  const s = src.trim();
  if (!s) return null;
  const tag = (t: string, inner: string, attrs = '') => `<${t}${attrs}>${inner}</${t}>`;
  const grp = (parts: string[]) => (parts.length === 1 ? parts[0] : tag('mrow', parts.join('')));
  const many = (items: EqNode[]): string[] => items.map(one).filter(Boolean);
  const one = (n: EqNode): string => {
    switch (n.t) {
      case 'txt':
        if (!n.s) return '';
        if (/^[\d.,]+$/.test(n.s)) return tag('mn', xmlEsc(n.s));
        if (!/\p{L}/u.test(n.s)) return tag('mo', xmlEsc(n.s));
        // Un nume scris drept (sin, lim) sau mai multe litere cursive (cuvintele ecuației).
        return tag('mi', xmlEsc(n.s), !n.it ? ' mathvariant="normal"' : [...n.s].length > 1 ? ' mathvariant="italic"' : '');
      case 'op': return tag('mo', xmlEsc(n.s));
      case 'row': return grp(many(n.c));
      // Pe rând: a ∕ b cu bara de împărțire (U+2215), ca la citire să se știe că nu e o fracție etajată.
      case 'frac': if (n.k === 'lin') return tag('mrow', grp([one(n.n)].filter(Boolean)) + tag('mo', String.fromCharCode(0x2215)) + grp([one(n.d)].filter(Boolean)));
        return tag('mfrac', grp([one(n.n)].filter(Boolean)) + grp([one(n.d)].filter(Boolean)), n.nb ? ' linethickness="0"' : n.k === 'skw' ? ' bevelled="true"' : '');
      case 'sqrt': return n.k ? tag('mroot', (one(n.c) || '<mrow/>') + (one(n.k) || '<mrow/>')) : tag('msqrt', one(n.c));
      case 'big': return tag('mo', xmlEsc(n.s));
      case 'acc': return tag('mover', (one(n.c) || '<mrow/>') + tag('mo', MML_ACC[n.k]), ' accent="true"');
      case 'enc':
        if (n.k === 'obrace') return tag('mover', (one(n.c) || '<mrow/>') + tag('mo', OBRACE, ' stretchy="true"'));
        if (n.k === 'ubrace') return tag('munder', (one(n.c) || '<mrow/>') + tag('mo', UBRACE, ' stretchy="true"'));
        return tag('menclose', one(n.c), ` notation="${n.k === 'under' ? 'bottom' : 'box'}"`);
      case 'mat': {
        const t = tag('mtable', n.r.map((r) => tag('mtr', r.map((c) => tag('mtd', one(c))).join(''))).join(''), n.cases ? ' columnalign="left"' : '');
        return n.cases ? tag('mrow', tag('mo', '{', ' fence="true"') + t) : t;
      }
      case 'par': return tag('mrow', tag('mo', xmlEsc(n.o), ' fence="true"') + one(n.c) + (n.cl ? tag('mo', xmlEsc(n.cl), ' fence="true"') : ''));
      case 'pre': return tag('mmultiscripts', (one(n.b) || '<mrow/>') + '<mprescripts/>' + (n.sub ? one(n.sub) || '<none/>' : '<none/>') + (n.sup ? one(n.sup) || '<none/>' : '<none/>'));
      case 'ovr': {
        const ar = arrowOf(n.b);
        const base = ar ? tag('mo', ar, ' stretchy="true"') : one(n.b) || '<mrow/>';
        const lo = n.lo ? one(n.lo) || '<mrow/>' : '', up = n.up ? one(n.up) || '<mrow/>' : '';
        return lo && up ? tag('munderover', base + lo + up) : lo ? tag('munder', base + lo) : up ? tag('mover', base + up) : base;
      }
      case 'scr': {
        const base = one(n.b) || '<mrow/>';
        const sub = n.sub ? one(n.sub) || '<mrow/>' : '', sup = n.sup ? one(n.sup) || '<mrow/>' : '';
        // Limitele sumelor, produselor și ale lui lim stau sub / deasupra semnului; la integrală, în dreapta lui.
        const under = n.b.t === 'big' ? !INTEGRALS.includes(n.b.s) : n.b.t === 'txt' && LIM_NAMES.has(n.b.s) || isBrace(n.b);
        if (sub && sup) return tag(under ? 'munderover' : 'msubsup', base + sub + sup);
        if (sub) return tag(under ? 'munder' : 'msub', base + sub);
        if (sup) return tag(under ? 'mover' : 'msup', base + sup);
        return base;
      }
    }
  };
  const body = many(flat(parseEq(s))).join('');
  return body ? `<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline"><semantics><mrow>${body}</mrow><annotation encoding="Suite">${xmlEsc(s)}</annotation></semantics></math>` : null;
}
