// Test pentru graficul combinat din Sheets: coloane + linie (ultima serie), pe aceeași axă sau cu linia pe axa din dreapta;
// desenul SVG, salvarea în .xlsx (c:barChart + c:lineChart, a doua axă) și citirea înapoi.
// Rulare (în suite/): node tests/chart-combo.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartcombo-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/chartSvg.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { writeXlsx, readXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { chartSvg, SHEET_CHART_TYPES } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
rmSync(dir, { recursive: true, force: true });

const data = { categories: ['ian', 'feb', 'mar'], series: [{ name: 'Vânzări', values: [1000, 1500, 1200] }, { name: 'Cost', values: [800, 900, 700] }, { name: 'Marjă %', values: [20, 40, 42] }] };
assert.ok(SHEET_CHART_TYPES.some(([k]) => k === 'combo') && SHEET_CHART_TYPES.some(([k]) => k === 'combo2'), 'tipurile noi apar în listă');
let svg = chartSvg('combo', '', data);
assert.equal((svg.match(/<rect x=(?![^>]*width="11")[^>]*fill="#(4f6bed|e8743b)"/g) || []).length, 6, 'combinat: 2 serii × 3 luni de coloane');
assert.ok(/<path d="M[^"]*L[^"]*L[^"]*" fill="none" stroke="#19a979"/.test(svg), 'combinat: a treia serie e linie, cu a treia culoare');
assert.equal((svg.match(/<rect (?![^>]*width="11")[^>]*fill="#19a979"/g) || []).length, 0, 'linia nu are coloane');
// Cu axa din dreapta: numerele liniei (20…45) apar în dreapta, iar linia urcă până sus.
svg = chartSvg('combo2', '', data);
assert.ok(/text-anchor="start" font-size="11" fill="#666">\d+<\/text>/.test(svg), 'combinat cu a doua axă: etichete în dreapta');
const right = [...svg.matchAll(/text-anchor="start" font-size="11" fill="#666">([^<]+)</g)].map((m) => m[1]);
assert.ok(right.length >= 3 && right.every((t) => /^[0-9]+$/.test(t)) && Number(right.at(-1)) >= 42, 'a doua axă are numere rotunde și cuprinde maximul: ' + right.join(' '));
const ys = [...svg.matchAll(/<circle cx="[\d.]+" cy="([\d.]+)" r="3.5" fill="#19a979"/g)].map((m) => Number(m[1]));
const ysOne = [...chartSvg('combo', '', data).matchAll(/<circle cx="[\d.]+" cy="([\d.]+)" r="3.5" fill="#19a979"/g)].map((m) => Number(m[1]));
assert.equal(ys.length, 3);
assert.ok(Math.min(...ys) < Math.min(...ysOne) - 100, 'pe axa ei, linia nu mai stă turtită jos');
// O singură serie: doar coloane, fără erori.
assert.ok(chartSvg('combo2', '', { categories: ['a'], series: [{ name: 'x', values: [1] }] }).includes('<rect x='), 'o singură serie: coloane');

const cells = { A1: 'Luna', B1: 'Vânzări', C1: 'Cost', D1: 'Marjă', A2: 'ian', B2: '1000', C2: '800', D2: '20', A3: 'feb', B3: '1500', C3: '900', D3: '40' };
for (const type of ['combo', 'combo2']) {
  const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type, range: 'A1:D3', title: 'T' }] };
  const bytes = await writeXlsx([{ sheet, results: {} }]);
  const z = await JSZip.loadAsync(bytes);
  const f = Object.keys(z.files).find((n) => /charts\/chart\d+\.xml$/.test(n));
  const x = await z.file(f).async('string');
  const bar = /<c:barChart>[\s\S]*?<\/c:barChart>/.exec(x)[0], line = /<c:lineChart>[\s\S]*?<\/c:lineChart>/.exec(x)[0];
  assert.equal((bar.match(/<c:ser>/g) || []).length, 2, type + ': două serii de coloane');
  assert.equal((line.match(/<c:ser>/g) || []).length, 1, type + ': o serie linie');
  assert.ok(line.includes('$D$2:$D$3'), type + ': linia e ultima coloană');
  assert.equal(x.includes('<c:axPos val="r"/>'), type === 'combo2', type + ': a doua axă doar la combo2');
  assert.equal((x.match(/<c:valAx>/g) || []).length, type === 'combo2' ? 2 : 1, type + ': numărul axelor de valori');
  const back = (await readXlsx(bytes)).sheets[0].charts[0];
  assert.equal(back.type, type, type + ': citit înapoi');
  assert.equal(back.range, 'A1:D3', type + ': zona citită înapoi');
}
console.log('graficul combinat: toate verificările trec');
