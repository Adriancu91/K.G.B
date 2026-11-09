// Test pentru ecuațiile din Docs (equation.ts): citirea textului (fracții, puteri, indici, radicali, sume), desenul (SVG valid) și descrierea.
// Rulare (în suite/): node tests/docs-equation.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';

const out = join(tmpdir(), `suite-deq-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/equation.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { parseEquation, parseEq, tokenize, equationSvg, equationAlt, newEquation, EQ_TEMPLATES, EQ_MAX } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
ok(parseEquation(JSON.stringify(newEquation()))?.src === newEquation().src, 'ecuația nouă se citește înapoi');
ok(parseEquation('{x') === null && parseEquation({ src: '   ' }) === null && parseEquation(null) === null, 'descrierile goale sau stricate sunt respinse');
ok(parseEquation({ src: 'x'.repeat(1000) }).src.length === EQ_MAX, 'textul prea lung se taie');
ok(tokenize('a<=b != c +- d -> e').filter((t) => t.k === 'op').map((t) => t.s).join('') === '≤≠±→', 'semnele din două litere: ' + tokenize('a<=b != c +- d -> e').map((t) => t.s).join(' '));
ok(tokenize('x<-1').map((t) => t.s).join(' ') === 'x < − 1', 'x<-1 rămâne „mai mic decât minus 1”');
const f = parseEq('(a+b)/(c-d)');
ok(f.t === 'frac' && f.n.t === 'row' && f.d.t === 'row', 'fracția cu paranteze: parantezele dispar');
const q = parseEq('x^2 + y_1');
ok(q.t === 'row' && q.c[0].t === 'scr' && q.c[0].sup?.s === '2' && q.c[2].t === 'scr' && q.c[2].sub?.s === '1', 'putere și indice');
const s = parseEq('sum_(i=1)^n i');
ok(s.t === 'row' && s.c[0].t === 'scr' && s.c[0].b.t === 'big' && s.c[0].b.s === '∑' && s.c[0].sup?.s === 'n', 'suma cu limite');
const r = parseEq('root(3, x+1)');
ok(r.t === 'sqrt' && r.k?.s === '3' && r.c.t === 'row', 'radical de ordin 3');
ok(parseEq('sqrt(b^2-4ac)').t === 'sqrt', 'radical');
const g = parseEq('alfa + pi');
ok(g.c[0].s === 'α' && g.c[2].s === 'π', 'litere grecești din nume');
ok(parseEq('sin x').c[0].it === false && parseEq('a b').c[0].it === true, 'funcțiile drept, variabilele cursiv');
ok(parseEq('{a+b}/2').t === 'frac', 'acoladele grupează fără să se vadă');
// Desenul: SVG valid pentru fiecare model și pentru texte ciudate.
const tricky = ['', ')(', '((((', 'x^', '/', 'a/', '^_^', 'sum', 'int_^', 'root(', 'root(,)', '<&>"', 'x^^^2', '1/2/3/4', 'sqrt sqrt sqrt x', 'a'.repeat(400), '(((a/b)/c)/d)^2', 'hat()', 'vec(', 'bar(bar(bar(x)))', 'dot(x)^2', 'hat x', 'mat(', 'mat()', 'mat(;;;)', 'mat(,,,)', '(mat(a/b; c))^2', 'mat(mat(1, 2; 3, 4), x)', 'cases(', 'cases()', 'cases(cases(a; b); c)', 'braces(', 'braces()', 'braces(mat(a; b; c))', 'underbrace(', 'underbrace()_', 'overbrace(underbrace(x)_1)^2', 'underbrace x'];
// Cifrele mici lipite (x², a₁, xⁿ⁺¹) sunt puteri și indici adevărați.
const sameEq = (a, b) => JSON.stringify(parseEq(a)) === JSON.stringify(parseEq(b));
ok(sameEq('x² + y² = r²', 'x^2 + y^2 = r^2') && sameEq('a₁ + aₙ₊₁', 'a_1 + a_(n+1)') && sameEq('xⁿ⁺¹', 'x^(n+1)') && sameEq('E = mc²', 'E = mc^2') && sameEq('H₂O', 'H_2 O'), 'cifrele mici devin puteri și indici');
// Sistemul: semnele „=” stau unul sub altul, chiar dacă rândurile au lungimi diferite în stânga.
const eqX = (src) => [...equationSvg({ src }).svg.matchAll(/<text x="([\d.]+)"[^>]*>=<\/text>/g)].map((m) => Number(m[1]));
const al = eqX('cases(x = 1; a + b + c = 2)'), na = eqX('cases(x = 1; y + 2)');
ok(al.length === 2 && Math.abs(al[0] - al[1]) < 0.5 && na.length === 1, 'sistemul aliniat la =');
// Acolada culcată: underbrace(…)_(eticheta) mai înaltă decât textul, cu eticheta dedesubt.
const ub = parseEq('underbrace(a + b)_n');
ok(ub.t === 'scr' && ub.b.t === 'enc' && ub.b.k === 'ubrace' && equationSvg({ src: 'underbrace(a + b)_n' }).h > equationSvg({ src: 'a + b' }).h + 8 && parseEq('overbrace(x)').k === 'obrace', 'acolada culcată');
// Acoladele care se văd: braces(1, 2) e o paranteză {…}, iar { } simple doar grupează.
const br = parseEq('braces(1, 2)');
ok(br.t === 'par' && br.o === '{' && br.cl === '}' && parseEq('{a}').t === 'txt', 'acoladele vizibile');
ok((equationSvg({ src: 'braces(mat(a; b; c))' }).svg.match(/<path/g) || []).length === 2, 'acoladele înalte desenate');
// Chenarul și sublinierea: box(…) un dreptunghi gol în jur, underline(…) o linie dedesubt, mai jos decât textul.
const bx = equationSvg({ src: 'box(x)' }), ul = parseEq('underline(x)');
ok(bx.svg.includes('fill="none"') && bx.w > equationSvg({ src: 'x' }).w && ul.t === 'enc' && ul.k === 'under' && parseEq('box x').c?.[0]?.t === 'txt', 'chenarul și sublinierea');
for (const src of [...EQ_TEMPLATES.map(([, t]) => t), ...tricky]) {
  const { svg, w, h } = equationSvg({ src });
  let errs = 0;
  new DOMParser({ onError: () => { errs++; } }).parseFromString(svg, 'image/svg+xml');
  const bad = !Number.isFinite(w) || !Number.isFinite(h) || svg.includes('NaN') || svg.includes('undefined');
  ok(!errs && !bad && w >= 10 && h >= 10, `desen valid pentru ${JSON.stringify(src.slice(0, 40))} (${w}×${h})`);
}
const a = equationSvg({ src: 'a/b' }), b = equationSvg({ src: 'a + b' });
ok(a.h > b.h && a.w < b.w, 'fracția e mai înaltă și mai îngustă decât același text pe un rând');
ok(equationSvg({ src: 'x^2' }).svg.includes('font-style="italic"'), 'variabilele cursive');
// Accentele: hat(x) e un accent peste x, „hat x” fără paranteză rămâne cuvânt; bara și vectorul sunt linii, punctele cercuri.
const ac = parseEq('vec(F) = m hat(x)');
ok(ac.t === 'row' && ac.c[0].t === 'acc' && ac.c[0].k === 'vec' && ac.c[0].c.s === 'F' && ac.c[3].t === 'acc' && ac.c[3].k === 'hat', 'accentele citite');
ok(parseEq('hat x').c[0].t === 'txt', 'hat fără paranteză rămâne cuvânt');
ok(parseEq('dot(x)^2').t === 'scr' && parseEq('dot(x)^2').b.t === 'acc', 'accentul cu putere');
const plain = equationSvg({ src: 'x' }), hatted = equationSvg({ src: 'hat(X)' });
ok((hatted.svg.match(/<path/g) || []).length === 1 && hatted.h >= plain.h, 'căciula desenată deasupra');
ok((equationSvg({ src: 'ddot(x)' }).svg.match(/<circle/g) || []).length === 2 && (equationSvg({ src: 'dot(x)' }).svg.match(/<circle/g) || []).length === 1, 'punctele');
ok(EQ_TEMPLATES.some(([, t]) => t.startsWith('vec(')), 'modelul Vector în fereastră');
// Matricele: rândurile despărțite de ;, celulele de ,; rândurile scurte completate; parantezele cresc cât matricea.
const mt = parseEq('(mat(a, b; c))');
ok(mt.t === 'par' && mt.c.t === 'mat' && mt.c.r.length === 2 && mt.c.r[1].length === 2 && mt.c.r[1][1].s === '', 'matricea 2 × 2, celula lipsă goală');
const m1 = equationSvg({ src: 'mat(a; b; c)' }), m0 = equationSvg({ src: 'a' });
ok(m1.h > m0.h * 2 && (m1.svg.match(/<text/g) || []).length === 3, 'matricea pe trei rânduri e înaltă');
ok(equationSvg({ src: '(mat(a, b; c, d))' }).svg.includes('<path'), 'parantezele matricei desenate înalte');
// Sistemul: cases(…) e o matrice cu acoladă în stânga (un singur traseu desenat), mai lată decât aceeași matrice fără ea.
const cs = parseEq('cases(x + y = 5; x - y = 1)');
ok(cs.t === 'mat' && cs.cases === true && cs.r.length === 2 && parseEq('mat(a; b)').cases === undefined, 'sistemul citit');
const sv = equationSvg({ src: 'cases(a; b)' }), mv = equationSvg({ src: 'mat(a; b)' });
ok((sv.svg.match(/<path/g) || []).length === 1 && !mv.svg.includes('<path') && sv.w > mv.w, 'acolada sistemului desenată');
// Modulul, norma, partea întreagă: bare și colțuri care cresc; combinările: n peste k fără linie, în paranteze care rămân.
const ab = parseEq('abs(x - 1)'), nm = parseEq('norm(v)'), fl = parseEq('floor(x)'), ce = parseEq('ceil(x)');
ok(ab.t === 'par' && ab.o === '|' && ab.cl === '|' && ab.c.t === 'row' && nm.o === String.fromCharCode(0x2016) && fl.o === String.fromCharCode(0x230a) && fl.cl === String.fromCharCode(0x230b) && ce.o === String.fromCharCode(0x2308) && ce.cl === String.fromCharCode(0x2309), 'abs / norm / floor / ceil citite');
ok(parseEq('modul(x)').o === '|' && parseEq('norma(x)').t === 'par', 'numele românești modul / norma');
const bn = parseEq('binom(n, k)');
ok(bn.t === 'par' && bn.o === '(' && bn.c.t === 'frac' && bn.c.nb === true && bn.c.n.s === 'n' && bn.c.d.s === 'k', 'binom(n, k) = n peste k în paranteze');
const xb = parseEq('x^binom(n, 2)');
ok(xb.t === 'scr' && xb.sup.t === 'par' && xb.sup.c.nb, 'parantezele combinărilor rămân și în putere');
ok(parseEq('stack(a, b)').t === 'frac' && parseEq('stack(a, b)').nb && parseEq('a/b').nb === undefined, 'stack fără paranteze; fracția obișnuită are linie');
const bs = equationSvg({ src: 'binom(n, k)' }).svg, fs2 = equationSvg({ src: '(n/k)' }).svg;
ok(!bs.includes('<rect') && fs2.includes('<rect') && (bs.match(/<path/g) || []).length === 2, 'combinările fără linie, cu parantezele înalte');
const as = equationSvg({ src: 'abs(a/b)' }).svg, ns = equationSvg({ src: 'norm(a/b)' }).svg;
ok((as.match(/<path d="M[^"]* V[^"]*"/g) || []).length === 2 && !as.includes('Q') && (ns.match(/ V/g) || []).length === 4, 'modulul și norma înalte: bare drepte (una / două de fiecare parte)');
const fls = equationSvg({ src: 'floor(a/b)' }).svg;
ok((fls.match(/<path/g) || []).length === 2 && /V[0-9.]+ H/.test(fls), 'partea întreagă înaltă: colțurile de jos');
ok(equationSvg({ src: 'abs(x)' }).svg.includes('>|<'), 'modulul pe un rând: bara ca semn');
ok(EQ_TEMPLATES.some(([, t]) => t.startsWith('binom(')) && EQ_TEMPLATES.some(([, t]) => t.startsWith('abs(')), 'modelele Combinări și Modul în fereastră');
// Semnele mari noi: reuniunea / intersecția au limitele deasupra și dedesubt, integrala triplă în dreapta.
const bu = parseEq('bigcup_(i=1)^n A_i'), it3 = parseEq('iiint_V f');
ok(bu.t === 'row' && bu.c[0].t === 'scr' && bu.c[0].b.t === 'big' && bu.c[0].b.s === String.fromCharCode(0x22c3) && it3.c[0].b.s === String.fromCharCode(0x222d) && parseEq('reuniune').s === String.fromCharCode(0x22c3) && parseEq('bigcap').s === String.fromCharCode(0x22c2) && parseEq('coprod').s === String.fromCharCode(0x2210), 'bigcup / bigcap / iiint / coprod citite');
const bcu = equationSvg({ src: 'bigcup_(i=1)^n A' }), bci = equationSvg({ src: 'iiint_(i=1)^n A' });
ok(bcu.h > bci.h && bcu.w < bci.w + 40, 'reuniunea cu limitele sus și jos, integrala triplă cu ele în dreapta');
ok(equationAlt({ src: 'E = m c^2' }) === 'Ecuație: E = m c^2', 'textul alternativ');
// Cu interfața în engleză, textul alternativ al ecuațiilor noi e în engleză.
// Deasupra / dedesubt: overset(sus, X), underset(jos, X), unite; săgeata se lungește cât textul de pe ea.
const ov = parseEq('overset(a, underset(b, ->))'), xr = parseEq('xrightarrow(t)');
ok(ov.t === 'ovr' && ov.up?.s === 'a' && ov.lo?.s === 'b' && ov.b.t === 'op' && ov.b.s === String.fromCharCode(0x2192) && xr.t === 'ovr' && xr.up?.s === 't' && parseEq('underset(n, x)').lo?.s === 'n' && parseEq('deasupra(1, x)').up?.s === '1', 'overset / underset / xrightarrow citite');
const shortA = equationSvg({ src: 'xrightarrow(t)' }), longA = equationSvg({ src: 'xrightarrow(temperatura mare)' }), plainA = equationSvg({ src: 'x' }), ovx = equationSvg({ src: 'overset(n, x)' });
ok(longA.w > shortA.w + 60 && shortA.h > plainA.h && ovx.h > plainA.h + 6 && /<path/.test(shortA.svg) && !/→/.test(shortA.svg), 'săgeata desenată se lungește cât textul, textul stă deasupra');
for (const t of ['overset(', 'overset()', 'overset(,)', 'underset(a)', 'xrightarrow(', 'xrightarrow()', 'overset(a, overset(b, x))', 'overset(a, underset(b, overset(c, ->)))']) {
  let good = true;
  try { const r = equationSvg({ src: t }); good = /^<svg/.test(r.svg) && r.w > 0; } catch { good = false; }
  ok(good, 'nu se blochează: ' + t);
}
ok(['⇌', '⇔', '↔', '←', '⇒'].every((a) => /<path/.test(equationSvg({ src: `overset(k, ${a})` }).svg)), 'toate săgețile se desenează');
// Indicii în față: {}_92^238 U (grupul gol), cu baza care poate avea și ea indici; {}_1 singur rămâne cum e.
const pu = parseEq('{}_92^238 U'), pc = parseEq('{}_6^14 C^(2+)');
ok(pu.t === 'pre' && pu.sub?.s === '92' && pu.sup?.s === '238' && pu.b.s === 'U' && pc.t === 'pre' && pc.b.t === 'scr' && parseEq('{}_1').t === 'scr' && parseEq('{}_1 + x').t === 'row', 'indicii în față citiți');
const prU = equationSvg({ src: '{}_92^238 U' }), plU = equationSvg({ src: 'U' });
ok(prU.w > plU.w + 15 && prU.h > plU.h && prU.svg.indexOf('>238<') < prU.svg.indexOf('>U<'), 'indicii în față se desenează în stânga literei');
// Parantezele unghiulare cresc cât conținutul (desenate, cu vârful spre exterior); punctele de matrice.
const an = parseEq('angle(a/b)');
ok(an.t === 'par' && an.o === String.fromCharCode(0x27e8) && an.cl === String.fromCharCode(0x27e9) && /<path/.test(equationSvg({ src: 'angle(a/b)' }).svg) && parseEq('vdots').s === String.fromCharCode(0x22ee) && parseEq('ddots').s === String.fromCharCode(0x22f1) && parseEq('cdots').s === String.fromCharCode(0x22ef), 'angle(…) și punctele de matrice');
// Fracția oblică (mică, cu bara înclinată) și pe rând (a/b), nu una peste alta.
const sk = parseEq('sfrac(1, 2)'), ln = parseEq('lfrac(a + b, c)'), skS = equationSvg({ src: 'sfrac(1, 2)' }), stS = equationSvg({ src: '1/2' }), lnS = equationSvg({ src: 'lfrac(a + b, c)' });
ok(sk.t === 'frac' && sk.k === 'skw' && ln.t === 'frac' && ln.k === 'lin' && skS.h < stS.h && /<path/.test(skS.svg) && lnS.svg.includes('>/<') && lnS.svg.includes('>(<'), 'sfrac / lfrac citite și desenate');
globalThis.document = { documentElement: { lang: 'en' } };
ok(equationAlt({ src: 'E = m c^2' }) === 'Equation: E = m c^2', 'textul alternativ în engleză');
delete globalThis.document;
console.log(fail ? `${fail} GREȘELI` : 'TOATE OK');
process.exit(fail ? 1 : 0);
