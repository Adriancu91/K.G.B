// Test: Sheets → Formatare axă: minimul, maximul și pasul axei valorilor, pe desen (SVG: gradațiile, coloanele tăiate la margine)
// și în .xlsx (c:scaling c:min / c:max, c:majorUnit), scrise și citite înapoi. Rulare (în suite/): node tests/sheets-chart-axis.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartaxis-${process.pid}`);
const entry = join(tmpdir(), `suite-chartaxis-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { chartSvg, userScale, niceScale } from ${p('src/sheets/chartSvg.ts')};\nexport { cleanAxis } from ${p('src/sheets/chart.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx, chartSvg, userScale, niceScale, cleanAxis } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1) Scara.
const auto = niceScale(0, 95);
ok(eq(userScale(auto, {}), auto), 'fără nimic ales: scara automată');
ok(eq(userScale(auto, { axMin: 50, axMax: 100 }), { lo: 50, hi: 100, step: 10 }), 'minim 50, maxim 100: pas automat 10');
ok(eq(userScale(auto, { axMin: 50, axMax: 100, axStep: 25 }), { lo: 50, hi: 100, step: 25 }), 'cu pasul 25');
ok(eq(userScale(auto, { axStep: 30 }), { lo: 0, hi: 120, step: 30 }), 'doar pasul 30: capetele rotunjite la multipli');
ok(eq(userScale(auto, { axMin: 100, axMax: 50 }), auto), 'maximul sub minim se ignoră');
ok(userScale(auto, { axMin: 0, axMax: 100, axStep: 0.001 }).step === 20, 'un pas prea mic (prea multe gradații) se ignoră');
ok(eq(cleanAxis({ axMin: 5, axMax: 2, axStep: -1 }), {}), 'curățarea: maxim sub minim și pas negativ');
ok(eq(cleanAxis({ axMin: '3', axMax: Infinity, axStep: 2 }), { axStep: 2 }), 'curățarea: doar numere finite');

// 2) Desenul.
const data = { categories: ['Ian', 'Feb', 'Mar'], series: [{ name: 'Vânzări', values: [60, 80, 140] }] };
const ticks = (s) => [...s.matchAll(/text-anchor="end" font-size="11"[^>]*>([^<]*)</g)].map((m) => m[1]);
const svg = chartSvg('col', 'T', data, undefined, undefined, { axMin: 50, axMax: 100, axStep: 25 });
ok(eq(ticks(svg), ['50', '75', '100']), 'gradațiile 50, 75, 100: ' + ticks(svg).join(','));
const rects = [...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)" fill="#/g)].map((m) => [Number(m[1]), Number(m[2])]);
const topY = Math.min(...rects.map((r) => r[0]));
ok(rects.length === 3 && rects.every((r) => r[1] >= 0), 'trei coloane, fără înălțimi negative');
ok(rects.filter((r) => Math.abs(r[0] - topY) < 0.2).length === 1, 'coloana de 140 e tăiată la maxim (singura care atinge sus)');
const bar = chartSvg('bar', 'T', data, undefined, undefined, { axMax: 100 });
ok(/>100</.test(bar) && !/>140</.test(bar) && !/>150</.test(bar), 'barele orizontale: axa se oprește la 100');
const sc = chartSvg('scatter', 'T', { categories: ['1', '2', '3'], series: [{ name: 'Y', values: [5, 7, 9] }] }, undefined, undefined, { axMin: 4, axMax: 10, axStep: 2 });
ok(eq(ticks(sc), ['4', '6', '8', '10']), 'puncte: axa verticală 4–10: ' + ticks(sc).join(','));

// 3) .xlsx dus-întors.
const cells = { A1: 'Luna', B1: 'Vânzări', A2: 'Ian', B2: '60', A3: 'Feb', B3: '80', A4: 'Mar', B4: '140' };
const charts = [
  { id: 'g1', type: 'col', range: 'A1:B4', title: 'Scara', axMin: 50, axMax: 100, axStep: 25 },
  { id: 'g2', type: 'line', range: 'A1:B4', title: 'Automat' },
  { id: 'g3', type: 'scatter', range: 'A1:B4', title: 'Puncte', axMin: 40 },
];
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, charts }, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
const files = Object.keys(zip.files).filter((f) => /charts\/chart\d+\.xml$/.test(f)).sort();
const xmls = await Promise.all(files.map((f) => zip.file(f).async('string')));
const x1 = xmls.find((x) => x.includes('Scara')) ?? '';
ok(/<c:scaling><c:orientation val="minMax"\/><c:max val="100"\/><c:min val="50"\/><\/c:scaling>/.test(x1), 'în .xlsx: c:max și c:min în ordinea bună');
ok(/<c:crossBetween val="between"\/><c:majorUnit val="25"\/><\/c:valAx>/.test(x1), 'în .xlsx: c:majorUnit după c:crossBetween');
ok(!/c:majorUnit|c:min val|c:max val/.test(xmls.find((x) => x.includes('Automat')) ?? 'c:min val'), 'graficul automat nu are scară scrisă');
const back = await readXlsx(bytes);
const ch = back.sheets?.[0]?.charts ?? back[0]?.charts ?? [];
const g1 = ch.find((c) => c.title === 'Scara'), g2 = ch.find((c) => c.title === 'Automat'), g3 = ch.find((c) => c.title === 'Puncte');
ok(g1?.axMin === 50 && g1?.axMax === 100 && g1?.axStep === 25, 'citit înapoi: 50 / 100 / 25');
ok(g2 && g2.axMin === undefined && g2.axMax === undefined && g2.axStep === undefined, 'citit înapoi: automatul rămâne automat');
ok(g3?.axMin === 40 && g3.axMax === undefined, 'citit înapoi la puncte: minimul axei verticale');

console.log(fail ? `${fail} GREȘITE` : 'TOATE BUNE');
process.exit(fail ? 1 : 0);
