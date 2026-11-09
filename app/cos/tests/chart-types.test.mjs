// Test pentru tipurile noi de grafice din Sheets (bare, stivuite, arie, inel, puncte): desenarea și .xlsx dus-întors.
// Rulare (în suite/): node tests/chart-types.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-charts-${process.pid}`);
const dir2 = dir + '-b';
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/chartSvg.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
await build({ entryPoints: ['src/sheets/chartSvg.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir2, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { chartSvg, SHEET_CHART_TYPES } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
rmSync(dir, { recursive: true, force: true });

const data = { categories: ['1', '2', '3'], series: [{ name: 'Vânzări', values: [10, -4, 7] }, { name: 'Costuri', values: [3, 5, NaN] }] };
const count = (svg, tag) => svg.split("<" + tag + " ").length - 1;
let svg = chartSvg('stack', 'T', data);
assert.equal(count(svg, 'rect'), 1 + 5 + 2, 'stivuite: fundalul, 5 bucăți de coloană, 2 pătrățele în legendă');
svg = chartSvg('bar', '', data);
assert.ok(count(svg, 'rect') >= 5);
assert.ok(svg.includes('text-anchor="end"'));
svg = chartSvg('area', '', data);
assert.ok(svg.includes('fill-opacity="0.45"'));
svg = chartSvg('doughnut', '', data);
assert.ok(svg.includes('r="') && count(svg, 'circle') >= 1);
svg = chartSvg('scatter', '', data);
assert.equal(count(svg, 'circle'), 5);
assert.equal(SHEET_CHART_TYPES.length, 24);
// Radarul: câte un poligon pe serie (gol cu puncte / umplut), numele categoriilor în jurul lui, grila din linii gri.
const five = { categories: ['Viteză', 'Preț', 'Calitate', 'Design', 'Service'], series: [{ name: 'A', values: [4, 3, 5, 2, 4] }, { name: 'B', values: [2, 5, 3, 4, 1] }] };
svg = chartSvg('radar', '', five);
assert.equal(count(svg, 'polygon'), 2, 'radar: 2 poligoane');
assert.equal(count(svg, 'circle'), 10, 'radar: un punct pe fiecare valoare');
assert.equal(svg.split('class="rd-cat"').length - 1, 5, 'radar: 5 nume de categorii');
assert.ok(svg.includes('>Calitate<') && svg.includes('stroke="#e3e3e3"'), 'radar: categoriile și grila');
// Prima rază e în sus: punctul primei categorii (valoarea 4 din scara 0…5) e chiar deasupra centrului.
const p0 = /class="rd" points="([0-9.]+),([0-9.]+)/.exec(svg);
const p0b = /class="rd" points="[^"]+"[^>]*>[\s\S]*?class="rd" points="([0-9.]+),([0-9.]+)/.exec(svg);
assert.ok(p0 && p0b && Math.abs(+p0[1] - +p0b[1]) < 0.2 && +p0[2] < +p0b[2], 'radar: prima rază e în sus (A=4 mai sus decât B=2)');
svg = chartSvg('radarFill', '', five);
assert.ok(count(svg, 'polygon') === 2 && svg.includes('fill-opacity="0.35"') && count(svg, 'circle') === 0, 'radar umplut: poligoane pline, fără puncte');
assert.equal(chartSvg('radar', '', five, 480, 300, { noGrid: true }).split('stroke="#e3e3e3"').length - 1, 0, 'radar fără grilă');
// Coloane stivuite 100%: fiecare coloană e plină (procentele dau 100), axa merge 0%…100%.
const { toPercent } = await import(pathToFileURL(join(dir2, 'chartSvg.js')).href);
const pc = toPercent({ categories: ['a', 'b', 'c'], series: [{ name: 'X', values: [30, 0, NaN] }, { name: 'Y', values: [10, 0, 5] }] });
assert.deepEqual(pc.series[0].values.slice(0, 1), [75]);
assert.deepEqual(pc.series[1].values, [25, NaN, 100]);
assert.ok(Number.isNaN(pc.series[0].values[1]) && Number.isNaN(pc.series[0].values[2]), 'categoria cu total 0 și celula goală rămân goale');
svg = chartSvg('stack100', '', { categories: ['a', 'b'], series: [{ name: 'X', values: [30, 2] }, { name: 'Y', values: [10, 6] }] });
assert.ok(svg.includes('>100%<') && svg.includes('>0%<') && svg.includes('>40%<'), 'axa în procente');
assert.equal(count(svg, 'rect'), 1 + 4 + 2, 'stivuite 100%: fundalul, 4 bucăți, 2 în legendă');
// Înălțimea ambelor coloane e aceeași (100%).
const hs = [...svg.matchAll(/<rect x="[0-9.]+" y="[0-9.]+" width="[0-9.]+" height="([0-9.]+)" fill="[^"]+" stroke="#fff"/g)].map((m) => +m[1]);
assert.equal(hs.length, 4);
assert.ok(Math.abs(hs[0] + hs[1] - (hs[2] + hs[3])) < 0.5, 'coloanele au aceeași înălțime: ' + hs.join(','));

// Bare stivuite: o singură bară pe categorie, bucățile una după alta; 100%: toate barele au aceeași lungime, axa 0%…100%.
const two = { categories: ['a', 'b'], series: [{ name: 'X', values: [30, 2] }, { name: 'Y', values: [10, 6] }] };
const pieces = (sv) => [...sv.matchAll(/<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="[0-9.]+" fill="[^"]+" stroke="#fff"/g)].map((m) => ({ x: +m[1], y: +m[2], w: +m[3] }));
svg = chartSvg('barStack', '', two);
let pz = pieces(svg);
assert.equal(pz.length, 4, 'bare stivuite: 4 bucăți');
assert.ok(pz[0].y === pz[1].y && Math.abs(pz[0].x + pz[0].w - pz[1].x) < 0.2, 'a doua serie continuă bara primei: ' + JSON.stringify(pz.slice(0, 2)));
assert.ok(Math.abs(pz[0].w / pz[1].w - 3) < 0.05, 'lungimile sunt proporționale (30 și 10)');
svg = chartSvg('barStack100', '', two);
pz = pieces(svg);
assert.ok(svg.includes('>100%<') && svg.includes('>0%<'), 'bare 100%: axa în procente');
assert.ok(Math.abs(pz[0].w + pz[1].w - (pz[2].w + pz[3].w)) < 0.5, 'bare 100%: aceeași lungime: ' + pz.map((p) => p.w).join(','));
svg = chartSvg('barStack', '', { categories: ['a'], series: [{ name: 'X', values: [5] }, { name: 'Y', values: [-3] }] });
pz = pieces(svg);
assert.ok(pz.length === 2 && pz[1].x + pz[1].w <= pz[0].x + 0.2, 'valoarea negativă merge spre stânga de zero');

// .xlsx: fiecare tip se salvează și se citește înapoi la fel.
const cells = { A1: 'X', B1: 'Vânzări', A2: 'ian', B2: '10', A3: 'feb', B3: '4', A4: 'mar', B4: '7' };
for (const [type] of SHEET_CHART_TYPES) {
  if (type === 'combo' || type === 'combo2') continue; // cu o singură serie e un grafic cu coloane (vezi chart-combo.test.mjs)
  const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type, range: 'A1:B4', title: 'Test' }] };
  const back = (await readXlsx(await writeXlsx([{ sheet, results: {} }]))).sheets[0];
  assert.equal(back.charts?.[0]?.type, type, 'tipul ' + type + ' nu se păstrează: ' + back.charts?.[0]?.type);
  assert.equal(back.charts[0].range, 'A1:B4', type + ': zona');
}
rmSync(dir2, { recursive: true, force: true });
console.log('tipuri de grafice: toate verificările trec');
