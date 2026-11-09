// Test pentru ecuațiile OMML din .docx (src/omml.ts): devin textul ecuației Suite (docs/equation.ts), care se desenează:
// fracții, puteri, indici, radicali, sume / integrale cu limite, paranteze, funcții, limite. Plus fișierele reale din colecție.
// Rulare (în suite/): node tests/omml.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-omml-${process.pid}`);
await build({ entryPoints: ['src/omml.ts', 'src/docs/equation.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error', external: ['@tiptap/*'] });
const { ommlToEquation } = await import(pathToFileURL(join(dir, 'omml.js')).href);
const { parseEq } = await import(pathToFileURL(join(dir, 'docs', 'equation.js')).href);
rmSync(dir, { recursive: true, force: true });

const NS = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const r = (t) => `<m:r><w:rPr><w:rFonts w:ascii="Cambria Math"/></w:rPr><m:t>${t}</m:t></m:r>`;
const eq = (body) => ommlToEquation(new DOMParser().parseFromString(`<m:oMath ${NS}>${body}</m:oMath>`, 'application/xml').documentElement);
const cases = [
  [r('a=a'), 'a=a'],
  [`<m:sSup><m:sSupPr><m:ctrlPr/></m:sSupPr><m:e>${r('a')}</m:e><m:sup>${r('2')}</m:sup></m:sSup>${r('+')}<m:sSup><m:e>${r('b')}</m:e><m:sup>${r('2')}</m:sup></m:sSup>`, 'a^2 + b^2'],
  [`${r('x=')}<m:f><m:fPr><m:ctrlPr/></m:fPr><m:num>${r('−b±')}<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e><m:sSup><m:e>${r('b')}</m:e><m:sup>${r('2')}</m:sup></m:sSup>${r('−4ac')}</m:e></m:rad></m:num><m:den>${r('2a')}</m:den></m:f>`, 'x= (-b+- sqrt(b^2 -4ac))/(2a)'],
  [`<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>${r('i=1')}</m:sub><m:sup>${r('n')}</m:sup><m:e><m:sSub><m:e>${r('x')}</m:e><m:sub>${r('i')}</m:sub></m:sSub></m:e></m:nary>`, 'sum_(i=1)^n x_i'],
  [`<m:nary><m:naryPr><m:limLoc m:val="subSup"/></m:naryPr><m:sub>${r('0')}</m:sub><m:sup>${r('1')}</m:sup><m:e>${r('f(x)dx')}</m:e></m:nary>`, 'int_0^1 f(x)dx'],
  [`<m:rad><m:deg>${r('3')}</m:deg><m:e>${r('x')}</m:e></m:rad>${r('≤π')}`, 'root(3, x) <=π'],
  [`<m:sSup><m:e><m:d><m:dPr><m:ctrlPr/></m:dPr><m:e>${r('a+b')}</m:e></m:d></m:e><m:sup>${r('n+1')}</m:sup></m:sSup>`, '(a+b)^(n+1)'],
  [`<m:func><m:fName><m:limLow><m:e>${r('lim')}</m:e><m:lim>${r('x→0')}</m:lim></m:limLow></m:fName><m:e><m:f><m:num><m:func><m:fName>${r('sin')}</m:fName><m:e>${r('x')}</m:e></m:func></m:num><m:den>${r('x')}</m:den></m:f></m:e></m:func>`, 'lim_(x->0) (sin x)/x'],
  [`<m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/><m:sepChr m:val=","/></m:dPr><m:e>${r('x')}</m:e><m:e>${r('y')}</m:e></m:d>`, '[x, y]'],
  [`<m:acc><m:accPr><m:chr m:val="̂"/></m:accPr><m:e>${r('a')}</m:e></m:acc>`, 'hat(a)'],
  [`<m:acc><m:e>${r('y')}</m:e></m:acc>${r('+')}<m:acc><m:accPr><m:chr m:val="⃗"/></m:accPr><m:e>${r('F')}</m:e></m:acc>`, 'hat(y) + vec(F)'],
  [`<m:d><m:e><m:m><m:mr><m:e>${r('a')}</m:e><m:e>${r('b')}</m:e></m:mr><m:mr><m:e>${r('c')}</m:e><m:e>${r('d')}</m:e></m:mr></m:m></m:e></m:d>`, '(mat(a, b; c, d))'],
  [`<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e><m:eqArr><m:e>${r('x+y=1')}</m:e><m:e>${r('x−y=0')}</m:e></m:eqArr></m:e></m:d>`, 'cases(x+y=1; x-y=0)'],
  [`${r('A=')}<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val="}"/><m:sepChr m:val=","/></m:dPr><m:e>${r('1')}</m:e><m:e>${r('2')}</m:e><m:e>${r('3')}</m:e></m:d>`, 'A= braces(1, 2, 3)'],
  [`<m:eqArr><m:e>${r('a=1')}</m:e><m:e>${r('b=2')}</m:e></m:eqArr>`, 'mat(a=1; b=2)'],
  [`<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${r('x')}</m:e></m:bar>${r('=')}<m:bar><m:e>${r('z')}</m:e></m:bar>`, 'bar(x) = underline(z)'],
  [`<m:borderBox><m:e>${r('E=m')}<m:sSup><m:e>${r('c')}</m:e><m:sup>${r('2')}</m:sup></m:sSup></m:e></m:borderBox>${r('+')}<m:borderBox><m:borderBoxPr><m:hideTop m:val="1"/></m:borderBoxPr><m:e>${r('q')}</m:e></m:borderBox>`, 'box(E=m c^2) + q'],
  // Acolada culcată (m:groupChr): dedesubt implicit, deasupra cu m:pos top; eticheta prin m:limLow / m:limUpp; o săgeată culcată devine săgeata cu text (overset).
  [`<m:limLow><m:e><m:groupChr><m:groupChrPr><m:chr m:val="⏟"/></m:groupChrPr><m:e>${r('a+b')}</m:e></m:groupChr></m:e><m:lim>${r('n')}</m:lim></m:limLow>${r('+')}<m:groupChr><m:groupChrPr><m:chr m:val="⏞"/><m:pos m:val="top"/></m:groupChrPr><m:e>${r('c')}</m:e></m:groupChr>${r('+')}<m:groupChr><m:groupChrPr><m:chr m:val="←"/></m:groupChrPr><m:e>${r('d')}</m:e></m:groupChr>`, 'underbrace(a+b)_n + overbrace(c) + overset({d}, ←)'],
  // Săgeata cu text deasupra (Word: groupChr cu săgeata dedesubt), dedesubt (pos top) și limUpp pe o literă: overset / underset.
  [`<m:groupChr><m:groupChrPr><m:chr m:val="→"/><m:vertJc m:val="bot"/></m:groupChrPr><m:e>${r('t')}</m:e></m:groupChr>${r('+')}<m:groupChr><m:groupChrPr><m:chr m:val="⇌"/><m:pos m:val="top"/></m:groupChrPr><m:e>${r('k')}</m:e></m:groupChr>${r('+')}<m:limUpp><m:e>${r('x')}</m:e><m:lim>${r('n')}</m:lim></m:limUpp>`, 'overset({t}, ->) + underset({k}, ⇌) + overset({n}, {x})'],
  // Fracția oblică (skw) și pe rând (lin): sfrac / lfrac.
  [`<m:f><m:fPr><m:type m:val="skw"/></m:fPr><m:num>${r('1')}</m:num><m:den>${r('2')}</m:den></m:f>${r('+')}<m:f><m:fPr><m:type m:val="lin"/></m:fPr><m:num>${r('a')}</m:num><m:den>${r('b')}</m:den></m:f>`, 'sfrac({1}, {2}) + lfrac({a}, {b})'],
  // Indicii puși în fața literei (m:sPre): {}_92^238 U; fără indici rămâne doar baza.
  [`<m:sPre><m:sub>${r('92')}</m:sub><m:sup>${r('238')}</m:sup><m:e>${r('U')}</m:e></m:sPre>${r('+')}<m:sPre><m:sub/><m:sup/><m:e>${r('x')}</m:e></m:sPre>`, '{}_92^238 U + x'],
  [`<m:acc><m:accPr><m:chr m:val="̈"/></m:accPr><m:e>${r('x')}</m:e></m:acc>${r('+')}<m:acc><m:accPr><m:chr m:val="̃"/></m:accPr><m:e>${r('n')}</m:e></m:acc>${r('+')}<m:acc><m:accPr><m:chr m:val="♥"/></m:accPr><m:e>${r('q')}</m:e></m:acc>`, 'ddot(x) + tilde(n) + q'],
];
for (const [body, want] of cases) {
  const got = eq(body);
  assert.equal(got, want);
  assert.ok(parseEq(got), `se poate desena: ${got}`);
}
assert.equal(eq(''), null, 'ecuație goală: null');
assert.equal(ommlToEquation(null), null);

// Fișierele reale din colecție (LibreOffice core, ecuații scrise de Word și de LibreOffice).
const corpus = join(import.meta.dirname, '..', '..', 'test-corpus', 'docx');
const want = {
  'math-mso2k7.docx': ['A=π r^2', '(x+a)^n'],
  'math-nary.docx': ['∰_1^2 x + 1', 'prod_a b', 'sum^2 x'],
  'math-rad.docx': ['sqrt(4)', 'root(3, x + 1)'],
};
let files = 0;
for (const [name, starts] of Object.entries(want)) {
  const p = join(corpus, name);
  if (!existsSync(p)) continue;
  files++;
  const xml = await (await JSZip.loadAsync(readFileSync(p))).file('word/document.xml').async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const maths = Array.from(doc.getElementsByTagName('m:oMath'));
  const got = maths.map((m) => ommlToEquation(m));
  for (const g of got) assert.ok(g && parseEq(g), `${name}: se poate desena: ${g}`);
  for (const s of starts) assert.ok(got.some((g) => g.startsWith(s)), `${name}: are „${s}…” (am: ${got.join(' | ')})`);
}
console.log(`omml: ${cases.length} ecuații + ${files} fișiere reale: OK`);
