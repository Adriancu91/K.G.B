// Test: ecuațiile scrise cu bară inversă (docs/latexEq.ts) se desenează la fel ca aceleași ecuații scrise în felul Suite.
// În acest fișier bara inversă e scrisă „@” (înlocuită la rulare), ca să nu fie stricată de unelte.
// Rulare (în suite/): node tests/latex-eq.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-latexeq-${process.pid}`);
await build({ entryPoints: ['src/docs/equation.ts', 'src/docs/latexEq.ts', 'src/docs/equationDocx.ts', 'src/omml.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error', external: ['@tiptap/*', 'docx'] });
const { parseEq, equationSvg, equationLatex, EQ_TEMPLATES } = await import(pathToFileURL(join(dir, 'docs', 'equation.js')).href);
const { latexToEq, isLatexEq } = await import(pathToFileURL(join(dir, 'docs', 'latexEq.js')).href);
const { equationOmmlXml } = await import(pathToFileURL(join(dir, 'docs', 'equationDocx.js')).href);
rmSync(dir, { recursive: true, force: true });

const L = (s) => s.split('@').join(String.fromCharCode(92));
const same = (a, b) => JSON.stringify(parseEq(a)) === JSON.stringify(parseEq(b));
const cases = [
  ['@frac{a}{b}', 'a/b'],
  ['x = @frac{-b @pm @sqrt{b^2 - 4ac}}{2a}', 'x = (-b +- sqrt(b^2 - 4ac))/(2a)'],
  ['@sqrt[3]{x}', 'root(3, x)'],
  ['@sum_{i=1}^{n} i', 'sum_(i=1)^n i'],
  ['@int_0^1 f(x)@,dx', 'int_0^1 f(x) dx'],
  ['@lim_{x @to 0} @frac{@sin x}{x}', 'lim_(x->0) (sin x)/x'],
  ['@alpha + @beta @neq @gamma', 'alfa + beta != gama'],
  ['a @leq b @geq c @cdot d @times e', 'a <= b >= c * d ** e'],
  ['@vec{F} = m@vec{a}', 'vec(F) = m vec(a)'],
  ['@overline{x} + @hat{y} + @tilde{n}', 'bar(x) + hat(y) + tilde(n)'],
  ['A = @begin{pmatrix} a & b @@ c & d @end{pmatrix}', 'A = (mat(a, b; c, d))'],
  ['@begin{bmatrix}1&0@@0&1@end{bmatrix}', '[mat(1, 0; 0, 1)]'],
  ['f(x) = @begin{cases} x, & x @geq 0 @@ -x, & x < 0 @end{cases}', 'f(x) = cases(x, x >= 0; -x, x < 0)'],
  ['A = @{1, 2, 3@}', 'A = braces(1, 2, 3)'],
  ['@left( @frac{a}{b} @right)^2', '(a/b)^2'],
  ['@boxed{E = mc^2}', 'box(E = mc^2)'],
  ['@underbrace{1 + 2 + @cdots + n}_{n}', 'underbrace(1 + 2 + ... + n)_n'],
  ['@mathbb{R} @cup @mathrm{d}x', 'R ∪ d x'],
  ['e^{i@pi} + 1 = 0', 'e^(i pi) + 1 = 0'],
  ['A @xrightarrow{t} B', 'A xrightarrow({t}) B'],
  ['@left@langle x @right@rangle + @vdots', 'angle(x) + vdots'],
  ['@sfrac{1}{2} + @nicefrac{a}{b}', 'sfrac({1}, {2}) + sfrac({a}, {b})'],
  ['{}_{92}^{238}@mathrm{U} + @prescript{4}{2}{He}', '{}_{92}^{238} U + {}_{2}^{4} {He}'],
  ['@overset{@Delta}{@to} + @underset{n}{x} + @xleftarrow[b]{a}', 'overset({Delta}, {->}) + underset({n}, {x}) + underset({b}, xleftarrow({a}))'],
  ['x^{n+1}_{k}', 'x_k^(n+1)'],
  ['@begin{array}{cc} a & b @@ c & d @end{array}', 'mat(a, b; c, d)'],
  ['@begin{aligned} x &= 1 @@ y &= 2 @end{aligned}', 'mat(x = 1; y = 2)'],
  ['@frac12', '1/2'],
];
let n = 0;
for (const [tex, want] of cases) {
  const src = L(tex), conv = latexToEq(src);
  assert.ok(isLatexEq(src) || !tex.includes('@'), `are bară inversă: ${tex}`);
  assert.ok(same(src, want), `${tex}  →  ${conv}  (aștept ${want})`);
  n++;
}
assert.ok(!isLatexEq('a/b'), 'fără bară inversă nu se traduce');
// Ce nu știm rămâne ca text, nu se pierde; ce e stricat nu oprește desenul.
assert.ok(latexToEq(L('@foo{x}')).includes('foo'), 'comanda necunoscută rămâne');
for (const bad of ['@', '@frac', '@frac{', '@begin{pmatrix} a &', '@sqrt[', '@left', '{{{', '@end{x}', '@@@@', '@' + 'a'.repeat(500)]) {
  const { svg } = equationSvg({ src: L(bad) });
  assert.ok(svg.startsWith('<svg'), `desen pentru ${bad.slice(0, 20)}`);
}
// Modulul, norma, partea întreagă și combinările scrise cu bară inversă.
for (const [tex, w] of [['@left| x - 1 @right|', 'abs(x - 1)'], ['@left@| v @right@|', 'norm(v)'], ['@left@lfloor x @right@rfloor', 'floor(x)'], ['@left@lceil x @right@rceil', 'ceil(x)'], ['@binom{n}{k}', 'binom(n, k)'], ['@left( a @right)', '(a)']]) assert.ok(same(L(tex), w), 'bară inversă: ' + tex + '  →  ' + latexToEq(L(tex)));
assert.equal(equationLatex('binom(n, k)'), L('@binom{n}{k}'), 'combinările ca binom');
assert.ok(equationLatex('abs(mat(a, b; c, d))').includes('vmatrix'), 'determinantul ca vmatrix');
// La .docx / .pptx ecuația e scrisă ca ecuație adevărată (nu ca text cu bare inverse).
const om = equationOmmlXml(L('@frac{a}{b}'));
assert.ok(om.includes('<m:f>') && !om.includes(String.fromCharCode(92)), 'OMML din scrierea cu bară inversă');
// Invers: fiecare model (și câteva ecuații în plus) scris cu bară inversă și citit înapoi dă aceeași ecuație.
// lfrac (fracția pe rând) se scrie ca a/b, care la citire e fracția obișnuită: nu se întoarce la fel, e acceptat.
const back = [...EQ_TEMPLATES.map(([, t]) => t).filter((t) => !t.includes('lfrac')), ...cases.map(([, w]) => w), 'A = braces(1, 2)', '[mat(1, 0; 0, 1)]', 'box(underline(a/b))', 'overbrace(a + b)^2 = c', '100% + x_1^2', 'f(x) = cases(x, x >= 0; -x, x < 0)', 'abs(a/b) + norm(v)', 'floor(x/2) <= ceil(x)', 'binom(n, k)', 'x^binom(n, 2)', 'abs(mat(a, b; c, d))', 'bigcup_(i=1)^n A_i', 'iiint_V f dV', 'coprod_i X_i', 'A xrightarrow(t) B', 'overset(Delta, ->) + underset(n, x)', 'overset(a, underset(b, ->))', 'underset(n, xleftarrow(k))', 'overset(n, x) = y', '{}_92^238 U', '{}^14 N + {}_6 C_2', 'angle(x^2) - angle(x)^2', 'angle(a/b)', 'mat(a, vdots; ddots, b)', 'sfrac(1, 2) + x^sfrac(3, 4)'];
for (const s of back) { const tex = equationLatex(s); assert.ok(same(tex, s), `invers: ${s}  →  ${tex}  →  ${latexToEq(tex)}`); }
console.log(`invers: ${back.length} / ${back.length} ecuații scrise cu bară inversă și citite înapoi la fel`);
console.log(`ecuațiile cu bară inversă: ${n} / ${cases.length} la fel ca scrierea Suite`);
