// Test: ecuațiile Suite scrise în .docx / .pptx ca ecuații adevărate (docs/equationDocx.ts → OMML) și în .odt ca MathML, citite înapoi (omml.ts, mathml.ts)
// dau aceeași ecuație: același arbore ca în desen (parseEq), pentru toate modelele din fereastra Ecuație și câteva în plus.
// Rulare (în suite/): node tests/equation-docx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import * as docx from 'docx';

const dir = join(tmpdir(), `suite-eqdocx-${process.pid}`);
await build({ entryPoints: ['src/omml.ts', 'src/mathml.ts', 'src/docs/equation.ts', 'src/docs/equationDocx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error', external: ['@tiptap/*', 'docx'] });
const { ommlToEquation } = await import(pathToFileURL(join(dir, 'omml.js')).href);
const { parseEq, EQ_TEMPLATES } = await import(pathToFileURL(join(dir, 'docs', 'equation.js')).href);
const { mathmlToEquation } = await import(pathToFileURL(join(dir, 'mathml.js')).href);
const { equationMath, equationMathmlXml, equationOmmlXml } = await import(pathToFileURL(join(dir, 'docs', 'equationDocx.js')).href);
rmSync(dir, { recursive: true, force: true });

const extra = ['root(3, x) <= pi', '[a, b]', 'e^(i pi) + 1 = 0', 'x_1^2', 'alfa + beta != gama', 'int_0^inf e^(-x) dx = 1', 'hat(y) = bar(x) + dot(x) - ddot(x)', 'vec(AB) + tilde(n)^2', 'vec(v_1)', 'A = (mat(a, b; c, d))', 'det [mat(1, x, x^2; 1, y, y^2)] != 0', 'mat(a/b, sqrt(2); , 1)', 'cases(x + y = 5; x - y = 1)', 'f(x) = cases(x, x >= 0; -x, x < 0)', 'A = braces(1, 2, 3)', 'braces(mat(a; b))', 'box(E = m c^2)', 'underline(x + y) = 2', 'box(underline(a/b))', 'underbrace(1 + 2 + n)_(n termeni)', 'overbrace(a + b)^2 = c', 'underbrace(x)', 'abs(x - 1) = 2', 'norm(a/b)', 'floor(x/2) + ceil(x)', 'binom(n, k)', 'stack(a, b)', 'abs(mat(a, b; c, d))', 'x^binom(n, 2)', 'bigcup_(i=1)^n A_i = bigcap_k B_k', 'iiint_V f dV + oiint_S F dS', 'coprod_i X_i', 'iint_D f dA + oint_C v dr', 'A + B xrightarrow(t) C', 'overset(t, ->) + underset(k, ⇌)', 'overset(a, underset(b, ->)) = 1', 'overset(n, x) + underset(k, y)', 'overset(a, underset(b, Z))', '{}_92^238 U -> {}_90^234 Th + {}_2^4 He', '{}_6 C + {}^14 N', '{}_1^2 X_3', 'angle(x^2) - angle(x)^2', 'angle(a/b)', 'abs(x)^2 + floor(y)_1', 'sfrac(1, 2) + lfrac(a + b, c)', 'x^sfrac(3, 4)', 'lfrac(1, n) = sfrac(dx, dt)', 'mat(a_11, cdots, a_1n; vdots, ddots, vdots)'];
const all = [...EQ_TEMPLATES.map(([, s]) => s), ...extra];
const doc = new docx.Document({ sections: [{ children: all.map((s) => new docx.Paragraph({ children: [equationMath(s, docx)] })) }] });
const xml = await (await JSZip.loadAsync(await docx.Packer.toBuffer(doc))).file('word/document.xml').async('string');
const maths = Array.from(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('m:oMath'));
assert.equal(maths.length, all.length, 'câte o ecuație OMML pentru fiecare');
let same = 0;
const diff = [];
all.forEach((s, i) => {
  const back = ommlToEquation(maths[i]);
  assert.ok(back, `${s}: se citește înapoi`);
  if (JSON.stringify(parseEq(back)) === JSON.stringify(parseEq(s))) same++;
  else diff.push(`${s}  →  ${back}`);
});
for (const d of diff) console.log('   diferit: ' + d);
assert.equal(diff.length, 0, 'toate ecuațiile se întorc la fel');
assert.equal(equationMath('   ', docx), null, 'ecuație goală: nimic');
// Sistemul: semnul „=” al fiecărui rând are m:aln (aliniere), în .docx și în .pptx.
assert.equal(xml.split('<m:r><m:rPr><m:aln/></m:rPr><m:t>=</m:t></m:r>').length - 1, 2 * all.filter((s) => s.startsWith('cases(x + y')).length, 'semnul de aliniere în .docx');
assert.ok(equationOmmlXml('cases(x = 1; y = 2)').includes('<m:aln/></m:rPr><m:t xml:space="preserve">=</m:t>'), 'semnul de aliniere în .pptx');
console.log(`ecuațiile .docx: ${same} / ${all.length} se întorc la fel`);

// La fel ca text OMML (.pptx) și ca MathML (obiectele formulă din .odt).
const M = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';
for (const s of all) {
  const om = new DOMParser().parseFromString(equationOmmlXml(s).replace('<m:oMath>', `<m:oMath ${M}>`), 'application/xml').documentElement;
  assert.equal(JSON.stringify(parseEq(ommlToEquation(om))), JSON.stringify(parseEq(s)), `OMML (.pptx): ${s} → ${ommlToEquation(om)}`);
  const mm = new DOMParser().parseFromString(equationMathmlXml(s), 'application/xml');
  assert.equal(JSON.stringify(parseEq(mathmlToEquation(mm))), JSON.stringify(parseEq(s)), `MathML (.odt): ${s} → ${mathmlToEquation(mm)}`);
}
assert.equal(equationMathmlXml(''), null);
console.log(`și ca OMML (.pptx) și MathML (.odt): ${all.length} / ${all.length} se întorc la fel`);
