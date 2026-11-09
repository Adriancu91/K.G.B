// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ecuațiile din fișierele .odp / .odt (obiecte formulă: „Object 1/content.xml”, scrise în MathML) devin ecuații Suite, adică textul
// scris pe un rând din docs/equation.ts (a/b, x^2, x_1, sqrt(x), root(3, x), sum_(i=1)^n, hat(x)). Ce nu știm se aduce ca text simplu.
import { accKindOf, FENCES } from './docs/equation';

/** Copiii-element (fără text și comentarii), merge și cu DOM-ul din teste. */
const kidsOf = (n: Element): Element[] => Array.from(n.childNodes as ArrayLike<Node>).filter((c): c is Element => c.nodeType === 1);

/** Semnele scrise altfel în MathML decât în ecuațiile Suite. */
export const SIGNS: Record<string, string> = { '−': '-', '⋅': '*', '∙': '*', '·': '*', '×': '**', '≤': '<=', '≥': '>=', '≠': '!=', '±': '+-', '∓': '-+', '→': '->', '⇒': '=>', '≈': '~=', '≡': '==', '…': '...', '∞': 'inf', '⁡': '', '⁢': '' };
export const BIG: Record<string, string> = { '∑': 'sum', '∏': 'prod', '∫': 'int', '∬': 'iint', '∮': 'oint', '∭': 'iiint', '∯': 'oiint', '⋃': 'bigcup', '⋂': 'bigcap', '∐': 'coprod' };

/** O bucată pusă între paranteze dacă are mai mult de un semn (ca x^(n+1), nu x^n). */
export const group = (s: string) => (/^[\p{L}\p{N}.]+$/u.test(s) || /^\(.*\)$/.test(s) && balanced(s.slice(1, -1))
  // Un accent (hat(x), vec(AB)) e o singură bucată, ca x: tilde(n)^2, nu (tilde(n))^2.
  || /^(?:hat|bar|vec|dot|ddot|tilde|mat|cases|braces|underline|box|overbrace|underbrace|overset|underset|xrightarrow|xleftarrow|abs|norm|floor|ceil|angle|binom|stack)\(.*\)$/.test(s) && balanced(s.slice(s.indexOf('(') + 1, -1)) ? s : `(${s})`);
function balanced(s: string): boolean {
  let d = 0;
  for (const c of s) { if (c === '(') d++; else if (c === ')' && --d < 0) return false; }
  return d === 0;
}

/** Felul accentului unui <mover>: semnul de deasupra e un singur accent cunoscut (cu accent="true" sau un mo de accent). */
function k2acc(n: Element, k: Element[]): string | null {
  if (k.length < 2 || k[1].localName !== 'mo') return null;
  const t = (k[1].textContent ?? '').trim();
  if ([...t].length !== 1) return null;
  const kind = accKindOf(t);
  // ^ ~ . _ fără accent="true" pot fi o putere adevărată; semnele de accent propriu-zise sunt accent oricum.
  return kind && (n.getAttribute('accent') === 'true' || !'^~._'.includes(t)) ? kind : null;
}

/** Baza după care limitele rămân ^ / _ (sume, integrale, lim, max): la altele, ce e deasupra / dedesubt devine overset / underset. */
function limBase(b: Element | undefined): boolean {
  const t = (b?.textContent ?? '').trim();
  // Eticheta acoladei culcate (munder în munder) rămâne și ea underbrace(…)_eticheta.
  return !b || !!BIG[t] || /^(?:lim|max|min|sup|inf)$/.test(t) || (b.localName === 'mover' || b.localName === 'munder') && brace(kidsOf(b));
}
/** Un <mover> / <munder> al cărui semn e o acoladă culcată (⏞ ⏟ sau cele întinse ︷ ︸). */
function brace(k: Element[]): boolean {
  if (k.length !== 2 || k[1].localName !== 'mo') return false;
  const t = (k[1].textContent ?? '').trim();
  return [...t].length === 1 && [0x23de, 0x23df, 0xfe37, 0xfe38].includes(t.charCodeAt(0));
}

function conv(n: Element): string {
  const k = kidsOf(n);
  const t = (n.textContent ?? '').trim();
  switch (n.localName) {
    case 'menclose': {
      // Chenarul și sublinierea au scrierea lor (box, underline); celelalte (tăiat, rotund…) rămân fără semn.
      const inner = k.map(conv).join(' ').replace(/\s+/g, ' ').trim();
      const nt = (n.getAttribute('notation') ?? 'longdiv').trim();
      return !inner ? '' : nt === 'box' ? `box(${inner})` : nt === 'bottom' ? `underline(${inner})` : inner;
    }
    case 'math': case 'mrow': case 'mstyle': case 'mpadded': case 'mphantom': case 'merror': {
      // { urmat de un tabel, fără acolada de închidere: un sistem de ecuații.
      if (k.length === 2 && k[0].localName === 'mo' && (k[0].textContent ?? '').trim() === '{' && k[1].localName === 'mtable') return `cases${conv(k[1]).slice(3)}`;
      // { … } care se văd (o mulțime): braces(…), fiindcă { } simple doar grupează în ecuațiile Suite.
      const mo = (e: Element | undefined, s: string) => e?.localName === 'mo' && (e.textContent ?? '').trim() === s;
      // | … |, ‖ … ‖, ⌊ … ⌋: modulul, norma, partea întreagă.
      const fence = k.length >= 3 ? Object.keys(FENCES).find((w) => mo(k[0], FENCES[w][0]) && mo(k[k.length - 1], FENCES[w][1])) : undefined;
      if (fence) return `${fence}(${k.slice(1, -1).map(conv).join(' ').replace(/\s+/g, ' ').trim()})`;
      // a ∕ b (bara de împărțire U+2215, trei bucăți): fracția pe rând.
      if (k.length === 3 && mo(k[1], String.fromCharCode(0x2215))) return `lfrac({${conv(k[0])}}, {${conv(k[2])}})`;
      if (k.length >= 2 && mo(k[0], '{') && mo(k[k.length - 1], '}')) return `braces(${k.slice(1, -1).map(conv).join(' ').replace(/\s+/g, ' ').trim()})`;
      return k.map(conv).join(' ').replace(/\s+/g, ' ').trim();
    }
    case 'semantics': return k[0] ? conv(k[0]) : '';
    case 'annotation': case 'annotation-xml': case 'mspace': case 'none': case 'mprescripts': return '';
    case 'mi': case 'mn': return t;
    case 'mtext': return t ? `"${t.replace(/"/g, "'")}"` : '';
    case 'mo': return BIG[t] ?? SIGNS[t] ?? t;
    // linethickness="0": unul peste altul, fără linie (combinările).
    case 'mfrac': if (k.length >= 2 && n.getAttribute('bevelled') === 'true') return `sfrac({${conv(k[0])}}, {${conv(k[1])}})`;
      if (k.length >= 2 && /^0(?:.0*)?(?:px|pt|em)?$/.test((n.getAttribute('linethickness') ?? '').trim())) return `stack(${conv(k[0])}, ${conv(k[1])})`;
      return k.length >= 2 ? `${group(conv(k[0]))}/${group(conv(k[1]))}` : '';
    case 'msqrt': return `sqrt(${k.map(conv).join(' ')})`;
    case 'mroot': return k.length >= 2 ? `root(${conv(k[1])}, ${conv(k[0])})` : '';
    case 'mover': {
      // x cu căciulă / bară / săgeată deasupra: accentul Suite (hat(x), bar(x), vec(x)…), nu o putere.
      if (brace(k)) return `overbrace(${conv(k[0])})`;
      const acc = k2acc(n, k);
      if (acc) return `${acc}(${conv(k[0])})`;
      if (k.length >= 2 && !limBase(k[0]) && !(k[1].localName === 'mo' && '^~._'.includes((k[1].textContent ?? '').trim()))) return `overset({${conv(k[1])}}, {${conv(k[0])}})`;
      return k.length >= 2 ? `${group(conv(k[0]))}^${group(conv(k[1]))}` : '';
    }
    case 'msup': return k.length >= 2 ? `${group(conv(k[0]))}^${group(conv(k[1]))}` : '';
    case 'munder':
      if (brace(k)) return `underbrace(${conv(k[0])})`;
      if (k.length >= 2 && !limBase(k[0])) return `underset({${conv(k[1])}}, {${conv(k[0])}})`;
      return k.length >= 2 ? `${group(conv(k[0]))}_${group(conv(k[1]))}` : '';
    case 'msub': return k.length >= 2 ? `${group(conv(k[0]))}_${group(conv(k[1]))}` : '';
    case 'munderover': if (k.length >= 3 && !limBase(k[0])) return `overset({${conv(k[2])}}, underset({${conv(k[1])}}, {${conv(k[0])}}))`;
    // falls through
    case 'msubsup': return k.length >= 3 ? `${group(conv(k[0]))}_${group(conv(k[1]))}^${group(conv(k[2]))}` : '';
    case 'mfenced': {
      const at = (a: string, d: string) => (n.hasAttribute(a) ? n.getAttribute(a) ?? d : d);
      const open = at('open', '('), close = at('close', ')');
      const sep = at('separators', ',').trim().charAt(0) || ',';
      const fence = Object.keys(FENCES).find((w) => FENCES[w][0] === open && FENCES[w][1] === close);
      if (fence) return `${fence}(${k.map(conv).join(sep + ' ')})`;
      if (open === '{' && close === '}') return `braces(${k.map(conv).join(sep + ' ')})`;
      return `${open}${k.map(conv).join(sep + ' ')}${close}`;
    }
    case 'mmultiscripts': {
      // Baza, apoi perechile indice / putere după ea și, după <mprescripts/>, cele din fața ei; <none/> = lipsește.
      if (!k.length) return '';
      const at = k.findIndex((c) => c.localName === 'mprescripts');
      const pairs = (list: Element[]) => {
        const v = (c: Element | undefined) => (c && c.localName !== 'none' ? conv(c) : '');
        let out = '';
        for (let i = 0; i < list.length; i += 2) { const a = v(list[i]), b = v(list[i + 1]); out += `${a ? `_${group(a)}` : ''}${b ? `^${group(b)}` : ''}`; }
        return out;
      };
      const post = pairs(k.slice(1, at < 0 ? k.length : at)), pre = at < 0 ? '' : pairs(k.slice(at + 1));
      const b = conv(k[0]);
      return pre ? `{}${pre} ${post || /^[\p{L}\p{N}]*$/u.test(b) ? group(b) : `{${b}}`}${post}` : `${group(b)}${post}`;
    }
    case 'mtable': return `mat(${k.map(conv).join('; ')})`;
    case 'mtr': case 'mlabeledtr': return k.map(conv).join(', ');
    case 'mtd': return k.map(conv).join(' ');
    default: return k.length ? k.map(conv).join(' ') : t;
  }
}

/** Textul ecuației Suite din MathML (elementul <math> sau documentul lui), sau null dacă e gol. */
export function mathmlToEquation(root: Element | Document | null | undefined): string | null {
  if (!root) return null;
  const math = 'documentElement' in root ? root.documentElement : root;
  if (!math) return null;
  const src = conv(math).replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim().slice(0, 400);
  return src || null;
}
