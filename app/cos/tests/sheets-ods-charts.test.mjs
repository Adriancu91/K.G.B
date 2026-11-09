// Test: graficele din .ods (obiecte încorporate „Object N/content.xml”) ajung ca grafice Suite (tip, zonă, titluri, loc).
// Rulare (în suite/): node tests/sheets-ods-charts.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';

globalThis.DOMParser ??= DOMParser;
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}
const out = join(tmpdir(), `suite-odschart-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { readOds } from './src/sheets/ods.ts'; export { odsRange, odsRanges } from './src/sheets/odsChart.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { readOds, odsRange, odsRanges } = await import(pathToFileURL(out).href);

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const J = JSON.stringify;

check('adresa Data.A2:Data.B4', J(odsRange('Data.A2:Data.B4')) === J({ sheet: 'Data', r0: 1, c0: 0, r1: 3, c1: 1 }), J(odsRange('Data.A2:Data.B4')));
const q = "$'Foaia 1'.$B$1:.$C$3";
check('adresa cu $ și ghilimele', J(odsRange(q)) === J({ sheet: 'Foaia 1', r0: 0, c0: 1, r1: 2, c1: 2 }), J(odsRange(q)));
check('listă cu spații în nume', odsRanges("'Foaia 1'.A1:'Foaia 1'.A3 X.B1").length === 2);
check('zonă pe două foi = nimic', odsRange('A.A1:B.B2') === null);

// Fișier real: datele pe foaia Data, graficul pe foaia Chart.
const basic = await readOds(new Uint8Array(readFileSync('../test-corpus/ods/chart-import-basic.ods')));
const data = basic.sheets.find((s) => s.name === 'Data');
check('chart-import-basic: nimic sărit', basic.chartsSkipped === 0, String(basic.chartsSkipped));
// Graficul stă pe foaia lui; dacă e alta decât Data, ia datele de acolo (src).
const withChart = basic.sheets.filter((s) => s.charts.length);
const bc = withChart[0]?.charts[0];
check('chart-import-basic: graficul de coloane cu datele din foaia Data', withChart.length === 1 && bc.type === 'col' && bc.range === 'A2:B4' && (withChart[0] === data ? !bc.src : bc.src === 'Data'), J(withChart.map((s) => [s.name, s.charts])));

// Fișier făcut aici: bare orizontale stivuite, pe aceeași foaie cu datele, cu titlu, titluri de axe și legenda sus.
const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:chart="urn:oasis:names:tc:opendocument:xmlns:chart:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"';
const cell = (v) => (typeof v === 'number'
  ? `<table:table-cell office:value-type="float" office:value="${v}"><text:p>${v}</text:p></table:table-cell>`
  : `<table:table-cell office:value-type="string"><text:p>${v}</text:p></table:table-cell>`);
const rows = [['Lună', 'Venit', 'Cheltuieli'], ['Ian', 10, 4], ['Feb', 12, 6], ['Mar', 9, 5]].map((r) => '<table:table-row>' + r.map(cell).join('') + '</table:table-row>').join('');
const frame = '<table:shapes><draw:frame svg:x="2in" svg:y="0.5in" svg:width="4in" svg:height="3in"><draw:object xlink:href="./Object 1"/></draw:frame></table:shapes>';
const content = `<?xml version="1.0"?><office:document-content ${NS}><office:body><office:spreadsheet><table:table table:name="Buget">${frame}<table:table-column table:number-columns-repeated="3"/>${rows}</table:table></office:spreadsheet></office:body></office:document-content>`;
const ser = (c) => `<chart:series chart:values-cell-range-address="Buget.${c}2:Buget.${c}4" chart:label-cell-address="Buget.${c}1"/>`;
const obj = `<?xml version="1.0"?><office:document-content ${NS}><office:automatic-styles><style:style style:name="p"><style:chart-properties chart:vertical="true" chart:stacked="true" chart:data-label-number="value"/></style:style></office:automatic-styles>`
  + '<office:body><office:chart><chart:chart chart:class="chart:bar"><chart:title><text:p>Buget pe trimestru</text:p></chart:title><chart:legend chart:legend-position="top"/><chart:plot-area chart:style-name="p">'
  + '<chart:axis chart:dimension="x"><chart:title><text:p>Luna</text:p></chart:title><chart:categories table:cell-range-address="Buget.A2:Buget.A4"/></chart:axis>'
  + `<chart:axis chart:dimension="y"><chart:title><text:p>Lei</text:p></chart:title></chart:axis>${ser('B')}${ser('C')}</chart:plot-area></chart:chart></office:chart></office:body></office:document-content>`;
const zip = new JSZip();
zip.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');
zip.file('content.xml', content);
zip.file('Object 1/content.xml', obj);
const made = await readOds(await zip.generateAsync({ type: 'uint8array' }));
const g = made.sheets[0].charts[0];
check('bare orizontale stivuite', g?.type === 'barStack', J(g));
check('zona cu capul de tabel și prima coloană', g?.range === 'A1:C4', g?.range);
check('titlul și titlurile axelor (întoarse la bare)', g?.title === 'Buget pe trimestru' && g.xTitle === 'Lei' && g.yTitle === 'Luna', J(g));
check('legenda sus, valorile pe grafic, fără grilă', g?.legend === 't' && g.labels === true && g.noGrid === true, J(g));
check('locul pe foaie (2 in, 0,5 in; 4 × 3 in)', J(g?.at) === J({ r: 0, c: 0, dx: 192, dy: 48, w: 384, h: 288 }), J(g?.at));

// Un obiect care nu e grafic (de exemplu o formulă matematică) se numără ca sărit.
zip.file('Object 1/content.xml', '<?xml version="1.0"?><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>');
const other = await readOds(await zip.generateAsync({ type: 'uint8array' }));
check('obiectul care nu e grafic: sărit și numărat', other.sheets[0].charts.length === 0 && other.chartsSkipped === 1, String(other.chartsSkipped));
// Graficele radar (pânză de păianjen) din many_charts.ods: aduse ca radar, nimic sărit.
const many = await readOds(new Uint8Array(readFileSync('../test-corpus/ods/many_charts.ods')));
const radars = many.sheets.flatMap((s) => s.charts ?? []).filter((c) => c.type === 'radar' || c.type === 'radarFill');
check('many_charts.ods: 8 grafice radar, niciun grafic sărit', radars.length === 8 && many.chartsSkipped === 0, JSON.stringify([radars.length, many.chartsSkipped]));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
