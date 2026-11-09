// Test pentru exportul .ods din Sheets: XML valid, formulele în sintaxa OpenFormula, și dus-întors prin cititorul nostru .ods
// (valori, texte, formule, formatare, formate de număr, lățimi, îmbinări, note, foi ascunse).
// Rulare (în suite/): node tests/sheets-ods-export.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
globalThis.DOMParser ??= DOMParser;
// În browser listele de noduri și atribute se pot parcurge cu for…of; în xmldom le facem la fel.
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}

const B = String.fromCharCode(92);
const src = (f) => join(process.cwd(), f).split(B).join('/');
const entry = join(tmpdir(), `suite-odsx-entry-${process.pid}.ts`);
writeFileSync(entry, [`export * from '${src('src/sheets/odsExport.ts')}';`, `export { readOds } from '${src('src/sheets/ods.ts')}';`, `export { evaluateAll } from '${src('src/sheets/formula.ts')}';`].join(String.fromCharCode(10)));
const out = join(tmpdir(), `suite-odsx-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true }); rmSync(entry, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const J = JSON.stringify;

// Formulele.
const f = (x) => m.toOdsFormula(x);
check('SUM cu zonă și număr', f('=SUM(A1:A3,2.5)') === 'of:=SUM([.A1:.A3];2.5)', f('=SUM(A1:A3,2.5)'));
check('nume românesc de funcție', f('=SUMĂ(A1:A3)') === 'of:=SUM([.A1:.A3])', f('=SUMĂ(A1:A3)'));
check('referințe absolute și altă foaie', f("=$B$2+'Foaia mea'!C3+Date!A1:B2") === "of:=[.$B$2]+[$'Foaia mea'.C3]+[$Date.A1:.B2]", f("=$B$2+'Foaia mea'!C3+Date!A1:B2"));
check('textul din ghilimele rămâne neatins', f('=IF(A1>0,"A1, B2","x")') === 'of:=IF([.A1]>0;"A1, B2";"x")', f('=IF(A1>0,"A1, B2","x")'));
check('LOG10 nu e referință', f('=LOG10(A2)') === 'of:=LOG10([.A2])', f('=LOG10(A2)'));
check('funcțiile noi cu COM.MICROSOFT.', f('=XLOOKUP(A1,B:B,C:C)') === 'of:=COM.MICROSOFT.XLOOKUP([.A1];[.B:.B];[.C:.C])', f('=XLOOKUP(A1,B:B,C:C)'));
check('rânduri întregi', f('=SUM(2:5)') === 'of:=SUM([.2:.5])', f('=SUM(2:5)'));

// O foaie completă, dus-întors.
const cells = { A1: 'Produs', B1: 'Preț', C1: 'Cant.', D1: 'Total', A2: 'Pâine', B2: '4,5', C2: '3', D2: '=B2*C2', A3: 'Lapte & co <1L>', B3: '7', C3: '2', D3: '=B3*C3',
  D4: '=SUM(D2:D3)', A5: 'Rând 1' + String.fromCharCode(10) + 'Rând 2', B5: '0,19', C5: 'ADEVĂRAT', A6: "'00123", B6: '45292', E1: 'Unite' };
const styles = { A1: { b: true, bg: '#ffeeaa', align: 'center', bd: 'tblr' }, B2: { fmt: 'lei', dec: 2 }, B5: { fmt: 'percent', dec: 0 }, B6: { fmt: 'date' },
  A3: { i: true, color: '#cc0000', font: 'Arial', sz: 14, note: 'Notă de test' }, A5: { wrap: true } };
const sheet = { name: 'Vânzări', cells, styles, colW: { A: 180 }, rowH: { 5: 48 }, merges: ['E1:F2'], hideCols: [7] };
const hidden = { name: 'Ascunsă', cells: { A1: '=Vânzări!D4*2' }, styles: {}, colW: {}, hidden: true };
const r1 = m.evaluateAll(cells, { self: 'Vânzări', sheets: [sheet, hidden] });
const r2 = m.evaluateAll(hidden.cells, { self: 'Ascunsă', sheets: [sheet, hidden] });
check('calculul de pornire', r1.D4?.value === 27.5, J(r1.D4));
const bytes = await m.writeOds([{ sheet, results: r1 }, { sheet: hidden, results: r2 }], 0);
const zip = await JSZip.loadAsync(bytes);
const names = Object.keys(zip.files);
check('mimetype primul și necomprimat', names[0] === 'mimetype' && (await zip.file('mimetype').async('string')) === 'application/vnd.oasis.opendocument.spreadsheet');
let errs = 0;
for (const x of ['content.xml', 'styles.xml', 'meta.xml', 'settings.xml', 'META-INF/manifest.xml']) new DOMParser({ onError: () => { errs++; } }).parseFromString(await zip.file(x).async('string'), 'text/xml');
check('toate fișierele XML sunt valide', !errs, errs);
const content = await zip.file('content.xml').async('string');
check('formula scrisă cu rezultatul', content.includes('table:formula="of:=SUM([.D2:.D3])" office:value-type="float" office:value="27.5"'), content.slice(content.indexOf('D2') - 50, content.indexOf('D2') + 50));

const back = await m.readOds(bytes);
check('două foi', back.sheets.length === 2, back.sheets.length);
const s = back.sheets[0];
const c = s.cells ?? s.sheet?.cells;
const st = s.styles ?? s.sheet?.styles;
check('numele foii', (s.name ?? s.sheet?.name) === 'Vânzări', s.name);
check('textul cu diacritice și semne', c.A2 === 'Pâine' && c.A3 === 'Lapte & co <1L>', c.A2 + ' / ' + c.A3);
check('numerele', ['4.5', '4,5'].includes(c.B2) && c.C2 === '3', c.B2 + ' ' + c.C2);
check('formulele', c.D2 === '=B2*C2' && /^=SUM[AĂ]?\(D2:D3\)$/.test(c.D4), c.D2 + ' ' + c.D4);
check('textul pe două rânduri', c.A5 === 'Rând 1' + String.fromCharCode(10) + 'Rând 2', J(c.A5));
check('textul care începe cu zero rămâne text', c.A6 === "'00123" || c.A6 === '00123', J(c.A6));
check('aldin, fundal, centrat, chenar', st.A1?.b && st.A1?.bg === '#ffeeaa' && st.A1?.align === 'center' && /t/.test(st.A1?.bd ?? '') && /b/.test(st.A1?.bd ?? ''), J(st.A1));
check('cursiv, culoare, font, mărime', st.A3?.i && st.A3?.color === '#cc0000' && st.A3?.font === 'Arial' && st.A3?.sz === 14, J(st.A3));
check('nota', st.A3?.note === 'Notă de test', J(st.A3));
check('lei', st.B2?.fmt === 'lei', J(st.B2));
check('procentul', st.B5?.fmt === 'percent', J(st.B5));
check('data', st.B6?.fmt === 'date' && (c.B6 === '45292' || /2024/.test(c.B6)), J(st.B6) + ' ' + c.B6);
check('încadrarea textului', st.A5?.wrap, J(st.A5));
const merges = s.merges ?? s.sheet?.merges;
check('celulele îmbinate', J(merges) === J(['E1:F2']), J(merges));
const colW = s.colW ?? s.sheet?.colW;
check('lățimea coloanei A', Math.abs((colW?.A ?? 0) - 180) <= 2, J(colW));
const rowH = s.rowH ?? s.sheet?.rowH;
check('înălțimea rândului 5', Math.abs((rowH?.[5] ?? rowH?.['5'] ?? 0) - 48) <= 2, J(rowH));
const h = back.sheets[1];
check('foaia ascunsă rămâne ascunsă', (h.hidden ?? h.sheet?.hidden) === true, J(h.hidden ?? h.sheet?.hidden));
check('formula spre altă foaie', /^=V[âa]nz[ăa]ri!D4\*2$|^='Vânzări'!D4\*2$/.test((h.cells ?? h.sheet?.cells).A1), (h.cells ?? h.sheet?.cells).A1);

console.log(fail ? `sheets-ods-export: ${fail} GREȘELI` : 'sheets-ods-export: toate trec');
process.exit(fail ? 1 : 0);
