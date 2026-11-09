// Test pentru graficele statistice din Sheets: histograma (intervale egale, rotunde, cu numărătoarea corectă) și Pareto
// (de la mare la mic, cu procentul cumulat pe axa din dreapta); desenul SVG, salvarea în .xlsx și citirea înapoi.
// Rulare (în suite/): node tests/chart-stat.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartstat-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/chartSvg.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { writeXlsx, readXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { chartSvg, histogram, statData, boxStats } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
rmSync(dir, { recursive: true, force: true });

// Note la un examen: 20 de valori între 3 și 10.
const note = [3, 4, 5, 5, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 10, 10];
const h = histogram(note);
assert.equal(h.counts.reduce((a, b) => a + b, 0), note.length, 'histograma: fiecare valoare e numărată o dată');
assert.ok(h.labels[0].startsWith('[') && h.labels.slice(1).every((l) => l.startsWith('(')), 'primul interval închis, restul deschise la stânga: ' + h.labels.join(' '));
assert.ok(h.labels.every((l) => /^[[(]-?[\d.,]+, -?[\d.,]+\]$/.test(l)), 'capete rotunde: ' + h.labels.join(' '));
assert.ok(h.counts.length >= 3 && h.counts.length <= 30, 'un număr potrivit de intervale: ' + h.counts.length);
assert.deepEqual(histogram([5, 5, 5]), { labels: ['[5, 5]'], counts: [3] }, 'toate egale: un singur interval');
assert.deepEqual(histogram([]), { labels: [], counts: [] }, 'fără numere: nimic');
// Valoarea de pe o margine intră în intervalul din stânga ((a, b] include b).
const edge = histogram([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
const total = edge.counts.reduce((a, b) => a + b, 0);
assert.equal(total, 11);

const data = { categories: ['Întârzieri', 'Defecte', 'Greșeli', 'Altele'], series: [{ name: 'Plângeri', values: [10, 50, 30, 10] }] };
const p = statData('pareto', data);
assert.deepEqual(p.categories, ['Defecte', 'Greșeli', 'Întârzieri', 'Altele'], 'Pareto: de la mare la mic (la egalitate, în ordinea din foaie)');
assert.deepEqual(p.series[1].values, [50, 80, 90, 100], 'Pareto: procentul cumulat');
let svg = chartSvg('pareto', '', data);
assert.ok(svg.includes('>100%</text>') && svg.includes('>0%</text>'), 'Pareto: axa din dreapta 0%–100%');
svg = chartSvg('hist', '', { categories: note.map(String), series: [{ name: 'Note', values: note }] });
assert.equal((svg.match(/<rect x=(?![^>]*width="11")[^>]*fill="#4f6bed"/g) || []).length, h.counts.filter((c) => c > 0).length, 'histograma: câte o coloană pe fiecare interval cu valori');

// Cutia cu mustăți: quartilele ca QUARTILE.INC, 30 iese din tipar, mustața de sus rămâne la 9.
const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 30]);
assert.deepEqual([b.q1, b.med, b.q3], [3.25, 5.5, 7.75], 'quartilele');
assert.deepEqual([b.lo, b.hi, b.out], [1, 9, [30]], 'mustățile și valoarea ieșită din tipar');
assert.equal(boxStats([]), null);
svg = chartSvg('box', '', { categories: ['1', '2', '3'], series: [{ name: 'Clasa A', values: [5, 7, 9] }, { name: 'Clasa B', values: [4, 6, 10] }] });
assert.equal((svg.match(/<rect class="box"/g) || []).length, 2, 'cutie: câte una pe serie');
assert.ok(svg.includes('>Clasa A</text>') && svg.includes('>Clasa B</text>'), 'cutie: numele seriilor sub cutii');
assert.ok(chartSvg('box', '', { categories: ['a'], series: [{ name: 'x', values: [NaN] }] }).includes('Nu sunt numere'), 'cutie fără numere: mesaj');

const cells = { A1: 'Motiv', B1: 'Plângeri', A2: 'Întârzieri', B2: '10', A3: 'Defecte', B3: '50', A4: 'Greșeli', B4: '30', A5: 'Altele', B5: '10' };
for (const type of ['hist', 'pareto', 'box']) {
  const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type, range: 'A1:B5', title: 'T', yTitle: 'Număr' }] };
  const bytes = await writeXlsx([{ sheet, results: {} }]);
  const z = await JSZip.loadAsync(bytes);
  const x = await z.file(Object.keys(z.files).find((n) => /charts\/chart\d+\.xml$/.test(n))).async('string');
  assert.ok(x.includes('<c:numLit>') && !x.includes('<c:numRef>'), type + ': valorile calculate stau în grafic');
  assert.ok(x.includes(`<s:stat kind="${type}" range="A1:B5"/>`), type + ': semnul nostru');
  assert.equal(x.includes('<c:lineChart>'), type === 'pareto', type + ': linia doar la Pareto');
  if (type === 'box') assert.ok(x.includes('<c:grouping val="stacked"/>') && x.includes('<a:noFill/>'), 'cutie: coloane stivuite cu baza nevăzută');
  if (type === 'pareto') assert.ok(x.indexOf('Defecte') < x.indexOf('Întârzieri'), 'Pareto: ordinea de la mare la mic în .xlsx');
  const back = (await readXlsx(bytes)).sheets[0].charts[0];
  assert.equal(back.type, type, type + ': citit înapoi');
  assert.equal(back.range, 'A1:B5', type + ': zona citită înapoi');
  assert.equal(back.yTitle, 'Număr', type + ': titlul axei citit înapoi');
}
console.log('graficele statistice: toate verificările trec');
