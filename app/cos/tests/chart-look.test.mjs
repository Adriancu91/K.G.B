// Test pentru aspectul graficelor din Sheets: titlurile axelor și paletele de culori (desen SVG, salvarea în foaie, .xlsx).
// Rulare (în suite/): node tests/chart-look.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartlook-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/chartSvg.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { writeXlsx, readXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { chartSvg, PALETTES } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
rmSync(dir, { recursive: true, force: true });

const data = { categories: ['ian', 'feb'], series: [{ name: 'A', values: [10, 4] }, { name: 'B', values: [3, 5] }] };
let svg = chartSvg('col', 'T', data, 520, 320, { xTitle: 'Luna', yTitle: 'Lei', palette: 1 });
assert.ok(svg.includes('>Luna</text>') && svg.includes('>Lei</text>'), 'titlurile axelor apar');
assert.ok(svg.includes('rotate(-90)'), 'titlul axei verticale e rotit');
assert.ok(svg.includes(PALETTES[1][1][0]) && !svg.includes('#4f6bed'), 'paleta Albastru înlocuiește culorile obișnuite');
// Desenul următor, fără aspect, revine la culorile obișnuite și fără titluri.
svg = chartSvg('col', 'T', data);
assert.ok(svg.includes('#4f6bed') && !svg.includes('>Luna<'), 'aspectul nu rămâne „lipit” de la desenul dinainte');
for (const t of ['bar', 'scatter', 'line']) assert.ok(chartSvg(t, '', data, 520, 320, { xTitle: 'X1', yTitle: 'Y1' }).includes('>Y1</text>'), t + ': titlul vertical');
assert.equal(PALETTES.length, 6);

const cells = { A1: 'X', B1: 'A', A2: 'ian', B2: '10', A3: 'feb', B3: '4' };
const xml = async (ch) => {
  const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', range: 'A1:B3', title: 'T', ...ch }] };
  const z = await JSZip.loadAsync(await writeXlsx([{ sheet, results: {} }]));
  const f = Object.keys(z.files).find((n) => /charts\/chart\d+\.xml$/.test(n));
  return z.file(f).async('string');
};
let x = await xml({ type: 'col', xTitle: 'Luna', yTitle: 'Lei', palette: 2 });
const cat = /<c:catAx>[\s\S]*?<\/c:catAx>/.exec(x)[0], val = /<c:valAx>[\s\S]*?<\/c:valAx>/.exec(x)[0];
assert.ok(cat.includes('<a:t>Luna</a:t>') && val.includes('<a:t>Lei</a:t>'), '.xlsx: coloane: Luna pe categorii, Lei pe valori');
assert.ok(/<c:axPos val="b"\/><c:title>/.test(cat) && /<\/c:majorGridlines><c:title>/.test(val), '.xlsx: titlul stă în ordinea cerută de format');
assert.ok(x.includes(PALETTES[2][1][0].slice(1).toUpperCase()), '.xlsx: culoarea din paleta Verde');
x = await xml({ type: 'bar', xTitle: 'Valoare', yTitle: 'Luna' });
assert.ok(/<c:catAx>[\s\S]*<a:t>Luna<\/a:t>[\s\S]*<\/c:catAx>/.test(x) && /<c:valAx>[\s\S]*<a:t>Valoare<\/a:t>/.test(x), '.xlsx: barele orizontale: axele se schimbă între ele');
x = await xml({ type: 'col' });
assert.ok(!/<c:catAx>[\s\S]*<c:title>[\s\S]*<\/c:catAx>/.test(x) && x.includes('4F6BED'), '.xlsx: fără titluri de axă și cu culorile obișnuite');
// Dus-întors: titlurile axelor și paleta se citesc înapoi din .xlsx.
for (const [type, xT, yT, pal] of [['col', 'Luna', 'Lei', 2], ['bar', 'Valoare', 'Luna', 4], ['scatter', 'X', 'Y', 5]]) {
  const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type, range: 'A1:B3', title: 'T', xTitle: xT, yTitle: yT, palette: pal }] };
  const back = (await readXlsx(await writeXlsx([{ sheet, results: {} }]))).sheets[0].charts[0];
  assert.equal(back.xTitle, xT, type + ': titlul orizontal citit înapoi');
  assert.equal(back.yTitle, yT, type + ': titlul vertical citit înapoi');
  assert.equal(back.palette, pal, type + ': paleta citită înapoi');
}
const plain = (await readXlsx(await writeXlsx([{ sheet: { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type: 'col', range: 'A1:B3', title: 'T' }] }, results: {} }]))).sheets[0].charts[0];
assert.ok(plain.xTitle === undefined && plain.yTitle === undefined && plain.palette === undefined, 'fără aspect: nimic în plus la citire');
console.log('aspectul graficelor: toate verificările trec');
