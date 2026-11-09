// Test pentru ecuațiile MathML din .odp / .odt (src/mathml.ts): devin textul ecuației Suite (docs/equation.ts), care se desenează
// la fel: fracții, puteri, indici, radicali, sume cu limite, paranteze. Rulare (în suite/): node tests/mathml.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-mathml-${process.pid}`);
await build({ entryPoints: ['src/mathml.ts', 'src/docs/equation.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error', external: ['@tiptap/*'] });
const { mathmlToEquation } = await import(pathToFileURL(join(dir, 'mathml.js')).href);
const { parseEq } = await import(pathToFileURL(join(dir, 'docs', 'equation.js')).href);
rmSync(dir, { recursive: true, force: true });

const NS = 'xmlns="http://www.w3.org/1998/Math/MathML"';
const eq = (body) => mathmlToEquation(new DOMParser().parseFromString(`<math ${NS}><semantics><mrow>${body}</mrow><annotation encoding="StarMath 5.0">x</annotation></semantics></math>`, 'application/xml'));
const cases = [
  ['<mi>a</mi><mo stretchy="false">=</mo><mi>a</mi>', 'a = a'],
  ['<msup><mi>a</mi><mn>2</mn></msup><mo>+</mo><msup><mi>b</mi><mn>2</mn></msup><mo>=</mo><msup><mi>c</mi><mn>2</mn></msup>', 'a^2 + b^2 = c^2'],
  ['<mi>x</mi><mo>=</mo><mfrac><mrow><mo>−</mo><mi>b</mi><mo>±</mo><msqrt><msup><mi>b</mi><mn>2</mn></msup><mo>−</mo><mn>4</mn><mi>a</mi><mi>c</mi></msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac>', 'x = (- b +- sqrt(b^2 - 4 a c))/(2 a)'],
  ['<munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><msub><mi>x</mi><mi>i</mi></msub>', 'sum_(i = 1)^n x_i'],
  ['<mroot><mi>x</mi><mn>3</mn></mroot><mo>≤</mo><mi>π</mi>', 'root(3, x) <= π'],
  ['<msup><mrow><mo>(</mo><mi>a</mi><mo>+</mo><mi>b</mi><mo>)</mo></mrow><mrow><mi>n</mi><mo>+</mo><mn>1</mn></mrow></msup>', '(a + b)^(n + 1)'],
  ['<mfenced><mi>x</mi><mi>y</mi></mfenced>', '(x, y)'],
  // Accentele: căciulă, bară, vector, punct (cu accent=true sau semnul de accent), dar x^~ fără accent rămâne putere.
  ['<mover accent="true"><mi>x</mi><mo>^</mo></mover><mo>+</mo><mover><mi>y</mi><mo>¯</mo></mover>', 'hat(x) + bar(y)'],
  ['<mover accent="true"><mrow><mi>A</mi><mi>B</mi></mrow><mo>→</mo></mover><mo>=</mo><mover><mi>x</mi><mo>˙</mo></mover>', 'vec(A B) = dot(x)'],
  ['<mover><mi>x</mi><mo>~</mo></mover>', 'x^(~)'],
  ['<mrow><mo>(</mo><mtable><mtr><mtd><mn>1</mn></mtd><mtd><mn>0</mn></mtd></mtr><mtr><mtd><mn>0</mn></mtd><mtd><mn>1</mn></mtd></mtr></mtable><mo>)</mo></mrow>', '(mat(1, 0; 0, 1))'],
  ['<mi>A</mi><mo>=</mo><mrow><mo>{</mo><mn>1</mn><mo>,</mo><mn>2</mn><mo>}</mo></mrow><mo>∪</mo><mfenced open="{" close="}"><mi>x</mi></mfenced>', 'A = braces(1 , 2) ∪ braces(x)'],
  ['<menclose notation="box"><mi>x</mi><mo>=</mo><mn>1</mn></menclose><mo>,</mo><menclose notation="bottom"><mi>y</mi></menclose><mo>,</mo><menclose notation="circle"><mi>z</mi></menclose>', 'box(x = 1) , underline(y) , z'],
  ['<munder><munder><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mo stretchy="true">⏟</mo></munder><mi>n</mi></munder><mo>=</mo><mover><mi>c</mi><mo>⏞</mo></mover>', 'underbrace(a + b)_n = overbrace(c)'],
  // Ce stă deasupra / dedesubt altceva decât o sumă sau lim: overset / underset (săgeata cu text la reacții).
  ['<mover><mo stretchy="true">→</mo><mi>t</mi></mover><mo>+</mo><munder><mi>x</mi><mi>n</mi></munder><mo>+</mo><munderover><mo>→</mo><mi>a</mi><mi>b</mi></munderover><mo>+</mo><munder><mi>lim</mi><mi>n</mi></munder>', 'overset({t}, {->}) + underset({n}, {x}) + overset({b}, underset({a}, {->})) + lim_n'],
  // Fracția oblică (bevelled) și pe rând (a ∕ b); modulul cu „s” în el rămâne întreg (abs(cos x)).
  ['<mfrac bevelled="true"><mn>1</mn><mn>2</mn></mfrac><mo>+</mo><mrow><mi>a</mi><mo>∕</mo><mi>b</mi></mrow><mo>+</mo><mrow><mo>|</mo><mi>cos</mi><mi>s</mi><mo>|</mo></mrow>', 'sfrac({1}, {2}) + lfrac({a}, {b}) + abs(cos s)'],
  // mmultiscripts: indicii după bază și, după <mprescripts/>, cei din fața ei (<none/> = lipsește).
  ['<mmultiscripts><mi>U</mi><mprescripts/><mn>92</mn><mn>238</mn></mmultiscripts><mo>+</mo><mmultiscripts><mi>C</mi><mn>2</mn><none/><mprescripts/><none/><mn>14</mn></mmultiscripts>', '{}_92^238 U + {}^14 C_2'],
  ['<mrow><mo>{</mo><mtable columnalign="left"><mtr><mtd><mi>x</mi><mo>=</mo><mn>1</mn></mtd></mtr><mtr><mtd><mi>y</mi><mo>=</mo><mn>2</mn></mtd></mtr></mtable></mrow>', 'cases(x = 1; y = 2)'],
];
for (const [body, want] of cases) {
  const got = eq(body);
  assert.equal(got, want);
  assert.ok(parseEq(got), `se poate desena: ${got}`);
}
assert.equal(eq(''), null, 'formulă goală: null');
assert.equal(mathmlToEquation(null), null);

// Fișierul real din colecție: math.odp are „a=a” într-un obiect formulă.
const real = join(import.meta.dirname, '..', '..', 'test-corpus', 'odp', 'math.odp');
if (existsSync(real)) {
  const zip = await JSZip.loadAsync(readFileSync(real));
  const xml = await zip.file('Object 1/content.xml').async('string');
  assert.equal(mathmlToEquation(new DOMParser().parseFromString(xml, 'application/xml')), 'a = a', 'math.odp: a = a');
}
console.log('ecuațiile MathML: toate verificările trec');
