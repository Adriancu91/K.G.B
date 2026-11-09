// Test: Sheets → formatarea zonei diagramei: umplerea, conturul și liniile de grilă, pe desen (SVG) și în .xlsx
// (c:chartSpace/c:spPr, c:majorGridlines), scrise și citite înapoi. Rulare (în suite/): node tests/sheets-chart-format.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartfmt-${process.pid}`);
const entry = join(tmpdir(), `suite-chartfmt-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { chartSvg } from ${p('src/sheets/chartSvg.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx, chartSvg } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const data = { categories: ['Ian', 'Feb', 'Mar'], series: [{ name: 'Vânzări', values: [10, 20, 15] }] };
const grid = (s) => (s.match(/stroke="#e3e3e3"/g) ?? []).length;

const plain = chartSvg('col', 'T', data);
ok(plain.includes('fill="#ffffff"') && !plain.includes('stroke-width="1.5"'), 'implicit: fundal alb, fără contur');
ok(grid(plain) > 2, `implicit: linii de grilă (${grid(plain)})`);
const fmt = chartSvg('col', 'T', data, undefined, undefined, { bg: '#e8f0fb', line: '#c62828', noGrid: true });
ok(fmt.includes('fill="#e8f0fb"') && fmt.includes('stroke="#c62828"'), 'umplerea și conturul alese apar pe desen');
ok(grid(fmt) === 0, 'fără linii de grilă');
ok(chartSvg('col', 'T', data, undefined, undefined, { bg: 'red;"<x' }).includes('fill="#ffffff"'), 'o culoare stricată nu intră în desen');
const hb = chartSvg('bar', 'T', data, undefined, undefined, { noGrid: true });
ok(grid(hb) === 0, 'și la barele orizontale, fără grilă');

const cells = { A1: 'Luna', B1: 'Vânzări', A2: 'Ian', B2: '10', A3: 'Feb', B3: '20' };
const charts = [
  { id: 'g1', type: 'col', range: 'A1:B3', title: 'Format', bg: '#fff8e1', line: '#2f6fd6', noGrid: true },
  { id: 'g2', type: 'line', range: 'A1:B3', title: 'Simplu' },
];
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, charts }, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
const c1 = await zip.file('xl/charts/chart1.xml').async('string');
const c2 = await zip.file('xl/charts/chart2.xml').async('string');
ok(/<\/c:chart><c:spPr><a:solidFill><a:srgbClr val="FFF8E1"\/><\/a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="2F6FD6"\/>/.test(c1), 'în .xlsx: c:spPr al zonei cu umplerea și conturul');
ok(!c1.includes('majorGridlines') && c2.includes('majorGridlines'), 'în .xlsx: grila lipsește doar unde a fost scoasă');
ok(c2.includes('<a:ln><a:noFill/></a:ln>'), 'în .xlsx: fără contur = a:noFill');
const back = (await readXlsx(bytes)).sheets[0].charts;
ok(back[0].bg === '#fff8e1' && back[0].line === '#2f6fd6' && back[0].noGrid === true, `citit înapoi: ${JSON.stringify([back[0].bg, back[0].line, back[0].noGrid])}`);
ok(!back[1].bg && !back[1].line && !back[1].noGrid, 'graficul simplu rămâne simplu');

// Fontul și culoarea textului din grafic: pe desen, în .xlsx (c:txPr al graficului) și citite înapoi.
const fx = chartSvg('col', 'T', data, undefined, undefined, { font: 'Georgia', ink: '#1f3864', xTitle: 'Luna' });
ok(fx.includes('font-family="Georgia, Segoe UI') && fx.includes('fill="#1f3864"') && !/<text[^>]* fill="#(222|333|444|555|666)"/.test(fx), 'desenul: fontul și culoarea textului alese');
ok(!chartSvg('col', 'T', data, undefined, undefined, { font: 'x"><y' }).includes('x"><y'), 'un font stricat nu intră în desen');
const fb = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, charts: [{ id: 'g1', type: 'col', range: 'A1:B3', title: 'Font', font: 'Georgia', ink: '#1f3864' }, { id: 'g2', type: 'col', range: 'A1:B3', title: 'Simplu' }] }, results: {} }]);
const fz = await JSZip.loadAsync(fb);
const f1 = await fz.file('xl/charts/chart1.xml').async('string'), f2 = await fz.file('xl/charts/chart2.xml').async('string');
ok(f1.includes('<c:txPr>') && f1.includes('typeface="Georgia"') && f1.includes('1F3864') && !f2.includes('<c:txPr>'), 'în .xlsx: c:txPr doar la graficul cu font / culoare aleasă');
const fback = (await readXlsx(fb)).sheets[0].charts;
ok(fback[0].font === 'Georgia' && fback[0].ink === '#1f3864' && !fback[1].font && !fback[1].ink, `citite înapoi: ${JSON.stringify([fback[0].font, fback[0].ink, fback[1].font, fback[1].ink])}`);

if (fail) { console.log(`\n${fail} verificări GREȘITE`); process.exit(1); }
console.log('\nToate verificările au trecut');
