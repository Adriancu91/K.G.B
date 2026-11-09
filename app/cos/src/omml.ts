// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ecuațiile din .docx (OMML: m:oMath, scrise de editorul de ecuații din Word) devin ecuații Suite, adică textul scris pe un
// rând din docs/equation.ts (a/b, x^2, x_1, sqrt(x), root(3, x), sum_(i=1)^n, lim_(x->0)). Semnele și gruparea sunt cele din
// mathml.ts, ca formulele din .docx și din .odt să arate la fel. Accentele (căciulă, bară sus, vector, puncte, tildă) devin hat(x), bar(x)…;
// ce nu știm (bara de jos, chenare, alte semne) se aduce fără el.
import { BIG, group as mathGroup, SIGNS } from './mathml';
import { accKindOf, ARROWS, FENCES } from './docs/equation';

/** Ca în mathml.ts, dar aici un rând de text are mai multe semne lipite ("2a", "nx"): pe ele le punem între paranteze. */
const group = (s: string) => (/^(?:\p{L}|\p{N}+(?:[.,]\p{N}+)?)$/u.test(s) || Object.values(BIG).includes(s) ? s : mathGroup(/^[\p{L}\p{N}.]+$/u.test(s) ? `(${s})` : s));

const fname = (s: string) => (/^[a-z]{2,6}$/.test(s) ? s : group(s));

const kidsOf = (n: Element): Element[] => Array.from(n.childNodes as ArrayLike<Node>).filter((c): c is Element => c.nodeType === 1);
const kid = (n: Element, name: string) => kidsOf(n).find((c) => c.localName === name);
/** Valoarea m:val a unei proprietăți (de exemplu m:chr din m:naryPr), sau undefined dacă lipsește. */
function prop(n: Element, pr: string, name: string): string | undefined {
  const p = kid(n, pr);
  const e = p && kid(p, name);
  if (!e) return undefined;
  return e.getAttribute('m:val') ?? e.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/math', 'val') ?? e.getAttribute('val') ?? '';
}
const on = (v: string | undefined) => v !== undefined && !/^(?:0|off|false)$/i.test(v);

/** Semnele dintr-un rând de text (m:t), unul câte unul: „x≤2” → „x<=2”. */
const signs = (t: string) => [...t].map((c) => BIG[c] ?? SIGNS[c] ?? c).join('');

/** Conținutul unui argument (m:e, m:num, m:sub…), cu bucățile lipite: „x” + „+1” rămân „x+1”. */
function arg(n: Element | undefined): string {
  if (!n) return '';
  return kidsOf(n).map(conv).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function conv(n: Element): string {
  switch (n.localName) {
    case 'oMathPara': case 'oMath': case 'e': case 'num': case 'den': case 'sub': case 'sup': case 'deg': case 'lim': case 'fName':
      return arg(n);
    case 'r': {
      const t = kidsOf(n).filter((c) => c.localName === 't').map((c) => c.textContent ?? '').join('');
      // Textul obișnuit (m:nor) rămâne între ghilimele, ca să nu fie citit ca litere de formulă.
      return on(prop(n, 'rPr', 'nor')) && /\s/.test(t.trim()) ? `"${t.trim().replace(/"/g, "'")}"` : signs(t).trim();
    }
    // Fracția fără linie (combinările, n peste k): stack(n, k).
    // Oblică (skw) și pe rând (lin): sfrac / lfrac, ca să arate la fel.
    case 'f': if (prop(n, 'fPr', 'type') === 'skw' || prop(n, 'fPr', 'type') === 'lin') return `${prop(n, 'fPr', 'type') === 'skw' ? 'sfrac' : 'lfrac'}({${arg(kid(n, 'num'))}}, {${arg(kid(n, 'den'))}})`;
      return prop(n, 'fPr', 'type') === 'noBar' ? `stack(${arg(kid(n, 'num'))}, ${arg(kid(n, 'den'))})` : `${group(arg(kid(n, 'num')))}/${group(arg(kid(n, 'den')))}`;
    case 'sSup': return `${group(arg(kid(n, 'e')))}^${group(arg(kid(n, 'sup')))}`;
    case 'sSub': return `${group(arg(kid(n, 'e')))}_${group(arg(kid(n, 'sub')))}`;
    case 'sSubSup': return `${group(arg(kid(n, 'e')))}_${group(arg(kid(n, 'sub')))}^${group(arg(kid(n, 'sup')))}`;
    case 'sPre': {
      // Indicii puși înainte (₉₂²³⁸U): {}_92^238 U, cu grupul gol în față.
      // Baza din mai multe bucăți stă între acolade (doar grupează), ca să nu apară paranteze în desen.
      const sub = arg(kid(n, 'sub')), sup = arg(kid(n, 'sup')), b = arg(kid(n, 'e')), e = /^[\p{L}\p{N}]*$/u.test(b) ? b : `{${b}}`;
      return sub || sup ? `{}${sub ? `_${group(sub)}` : ''}${sup ? `^${group(sup)}` : ''} ${e}` : e;
    }
    case 'rad': {
      const deg = arg(kid(n, 'deg')), e = arg(kid(n, 'e'));
      return deg && !on(prop(n, 'radPr', 'degHide')) ? `root(${deg}, ${e})` : `sqrt(${e})`;
    }
    case 'nary': {
      const chr = prop(n, 'naryPr', 'chr') || '∫';
      const sub = on(prop(n, 'naryPr', 'subHide')) ? '' : arg(kid(n, 'sub'));
      const sup = on(prop(n, 'naryPr', 'supHide')) ? '' : arg(kid(n, 'sup'));
      const op = BIG[chr] ?? chr;
      return `${op}${sub ? `_${group(sub)}` : ''}${sup ? `^${group(sup)}` : ''} ${arg(kid(n, 'e'))}`.trim();
    }
    case 'd': {
      const beg = prop(n, 'dPr', 'begChr') ?? '(', end = prop(n, 'dPr', 'endChr') ?? ')';
      const sep = prop(n, 'dPr', 'sepChr') ?? '|';
      const parts = kidsOf(n).filter((c) => c.localName === 'e').map(arg);
      if (beg === '{' && !end && parts.length === 1 && /^mat\(.*\)$/.test(parts[0])) return `cases${parts[0].slice(3)}`;
      // { } simple doar grupează în ecuațiile Suite: acoladele care se văd (o mulțime) se scriu braces(…).
      // Modulul, norma, partea întreagă: abs(…), norm(…), floor(…), ceil(…), ca să crească cât conținutul.
      const fence = Object.keys(FENCES).find((w) => FENCES[w][0] === beg && FENCES[w][1] === end);
      if (fence && parts.length === 1) return `${fence}(${parts[0]})`;
      if (beg === '(' && end === ')' && parts.length === 1 && /^stack(.*)$/.test(parts[0])) return `binom${parts[0].slice(5)}`;
      if (beg === '{' && end === '}') return `braces(${parts.join(sep === '|' && parts.length > 1 ? ' | ' : `${sep} `)})`;
      return `${beg}${parts.join(sep === '|' && parts.length > 1 ? ' | ' : `${sep} `)}${end}`;
    }
    case 'func': {
      const name = arg(kid(n, 'fName')), e = arg(kid(n, 'e'));
      return /^\(.*\)$/.test(e) || !e ? `${name}${e}` : `${name} ${e}`;
    }
    // Baza unei limite e un nume (lim, max, min), scris fără paranteze.
    // Altă bază (o săgeată, o literă): ce stă dedesubt / deasupra ei, underset / overset (unul în altul se unesc la citire).
    case 'limLow': case 'limUpp': {
      const e = arg(kid(n, 'e')), lim = arg(kid(n, 'lim')), low = n.localName === 'limLow';
      if (/^[a-z]{2,6}$/.test(e) || /^(?:overbrace|underbrace)[(]/.test(e) || !lim) return `${fname(e)}${low ? '_' : '^'}${group(lim)}`;
      return `${low ? 'underset' : 'overset'}({${lim}}, {${e}})`;
    }
    // Matricea și șirul de ecuații (un sistem): mat(a, b; c, d), câte un rând pe ecuație.
    case 'm': return `mat(${kidsOf(n).filter((c) => c.localName === 'mr').map((r) => kidsOf(r).filter((c) => c.localName === 'e').map(arg).join(', ')).join('; ')})`;
    case 'eqArr': return `mat(${kidsOf(n).filter((c) => c.localName === 'e').map(arg).join('; ')})`;
    case 'acc': {
      // Fără m:chr, accentul e căciula.
      const k = accKindOf(prop(n, 'accPr', 'chr') || String.fromCharCode(0x302)), e = arg(kid(n, 'e'));
      return k && e ? `${k}(${e})` : e;
    }
    case 'bar': {
      // m:pos lipsă = bara dedesubt (subliniere).
      const e = arg(kid(n, 'e'));
      return !e ? e : prop(n, 'barPr', 'pos') === 'top' ? `bar(${e})` : `underline(${e})`;
    }
    // Chenarul în jurul formulei; cu laturi ascunse (m:hideTop…) nu e chenar întreg, deci rămâne fără el.
    case 'borderBox': {
      const e = arg(kid(n, 'e'));
      const hidden = ['hideTop', 'hideBot', 'hideLeft', 'hideRight', 'strikeH', 'strikeV', 'strikeBLTR', 'strikeTLBR'].some((h) => on(prop(n, 'borderBoxPr', h)));
      return e && !hidden ? `box(${e})` : e;
    }
    case 'groupChr': {
      // Acolada culcată sub / deasupra termenilor (fără m:chr: acolada de jos); alte semne (săgeți, paranteze) rămân fără el.
      const e = arg(kid(n, 'e')), chr = prop(n, 'groupChrPr', 'chr') || String.fromCharCode(0x23df);
      // Săgeata sub text (text deasupra săgeții, ca la reacții) sau deasupra lui: overset / underset cu săgeata ca bază.
      if (e && [...chr].length === 1 && ARROWS.includes(chr)) return `${prop(n, 'groupChrPr', 'pos') === 'top' ? 'underset' : 'overset'}({${e}}, ${signs(chr)})`;
      if (!e || ![0x23de, 0x23df, 0x7b, 0x7d, 0xfe37, 0xfe38].includes(chr.charCodeAt(0))) return e;
      return `${prop(n, 'groupChrPr', 'pos') === 'top' ? 'overbrace' : 'underbrace'}(${e})`;
    }
    case 'box': case 'phant':
      return arg(kid(n, 'e'));
    default: return ''; // proprietățile (m:rPr, m:fPr, m:ctrlPr…) și ce nu se vede
  }
}

/** Textul ecuației Suite dintr-un m:oMath (sau m:oMathPara), sau null dacă e gol. */
export function ommlToEquation(math: Element | null | undefined): string | null {
  if (!math) return null;
  const src = conv(math).replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim().slice(0, 400);
  return src || null;
}
