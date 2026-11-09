// Test: Sheets → Proiectare diagramă → Stiluri rapide: umbra și degradeul pe formele seriilor (SVG), stilurile gata făcute,
// salvarea în foaie și în .xlsx (a:effectLst / a:outerShdw, a:gradFill), citite înapoi. Rulare (în suite/): node tests/sheets-chart-style.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartstyle-${process.pid}`);
const entry = join(tmpdir(), `suite-chartstyle-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { chartSvg, CHART_STYLES, lighten, PALETTES } from ${p('src/sheets/chartSvg.ts')};\nexport { parseSheetDoc, serializeSheetDoc } from ${p('src/sheets/format.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx, chartSvg, CHART_STYLES, lighten, PALETTES, parseSheetDoc, serializeSheetDoc } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

// 1) Desenul.
const data = { categories: ['Ian', 'Feb', 'Mar'], series: [{ name: 'Nord', values: [60, 80, 140] }, { name: 'Sud', values: [30, 50, 70] }] };
const plain = chartSvg('col', 'T', data);
ok(!/filter=|linearGradient|<defs>/.test(plain), 'fără stil: nicio umbră sau degrade');
const sh = chartSvg('col', 'T', data, undefined, undefined, { fx: 'shadow' });
ok((sh.match(/<rect filter="url\(#sgsh\)"/g) ?? []).length === 6, 'umbre: cele 6 coloane au umbră');
ok(/<filter id="sgsh"[^>]*><feDropShadow /.test(sh) && (sh.match(/<filter id="sgsh"/g) ?? []).length === 1, 'umbre: un singur filtru definit');
ok(!/<rect filter[^>]*width="11" height="11"/.test(sh) && !/<rect filter[^>]*fill="#ffffff"/.test(sh), 'umbre: nu pe legendă și nu pe fundal');
const gr = chartSvg('col', 'T', data, undefined, undefined, { fx: 'grad' });
ok((gr.match(/fill="url\(#sg4f6bed\)"/g) ?? []).length === 3 && (gr.match(/fill="url\(#sge8743b\)"/g) ?? []).length === 3, 'degrade: coloanele fiecărei serii cu degradeul culorii ei');
ok(gr.includes(`<linearGradient id="sg4f6bed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten('#4f6bed', 0.45)}"/><stop offset="1" stop-color="#4f6bed"/>`), 'degrade: de la deschis sus la culoarea plină jos');
ok(/width="11" height="11" rx="2" fill="#4f6bed"/.test(gr), 'degrade: legenda rămâne plină');
ok(lighten('#000000', 0.5) === '#808080' && lighten('#4f6bed', 0) === '#4f6bed', 'amestecul cu alb');
const pie = chartSvg('pie', 'T', data, undefined, undefined, { fx: 'shadow' });
ok((pie.match(/<path filter="url\(#sgsh\)"/g) ?? []).length === 3, 'plăcintă cu umbre: cele 3 felii');
const line = chartSvg('line', 'T', data, undefined, undefined, { fx: 'shadow' });
ok(/<(path|polyline) filter="url\(#sgsh\)"/.test(line), 'linii cu umbre: linia seriei are umbră');
const pal = chartSvg('col', 'T', data, undefined, undefined, { fx: 'grad', palette: 1 });
ok(pal.includes(`url(#sg${PALETTES[1][1][0].slice(1)})`), 'degrade cu altă paletă: culorile paletei');
ok(CHART_STYLES.length === 8 && CHART_STYLES[0][1] && Object.keys(CHART_STYLES[0][1]).length === 0, '8 stiluri, primul e cel simplu');
const dark = chartSvg('col', 'T', data, undefined, undefined, CHART_STYLES[7][1]);
ok(/fill="#262626"/.test(dark) && /font-weight="600" fill="#ffffff"/.test(dark), 'stilul 8: fundal închis, titlu alb');

// 2) Salvarea în foaie.
const sheet = { name: 'Foaia 1', colW: {}, cells: { A1: 'x' }, styles: {}, charts: [{ id: 'g1', type: 'col', range: 'A1:B4', title: 'U', fx: 'shadow' }, { id: 'g2', type: 'col', range: 'A1:B4', title: 'D', fx: 'grad' }, { id: 'g3', type: 'col', range: 'A1:B4', title: 'R', fx: 'altceva' }] };
const re = parseSheetDoc(serializeSheetDoc({ format: 'suite-sheet', version: 1, title: '', sheets: [sheet] })).sheets[0];
ok(re.charts[0].fx === 'shadow' && re.charts[1].fx === 'grad' && re.charts[2].fx === undefined, 'în foaie: umbra și degradeul se păstrează, valorile necunoscute se scot');

// 3) .xlsx dus-întors.
const cells = { A1: 'Luna', B1: 'Nord', C1: 'Sud', A2: 'Ian', B2: '60', C2: '30', A3: 'Feb', B3: '80', C3: '50', A4: 'Mar', B4: '140', C4: '70' };
const charts = [
  { id: 'g1', type: 'col', range: 'A1:C4', title: 'Umbre', fx: 'shadow' },
  { id: 'g2', type: 'col', range: 'A1:C4', title: 'Degrade', fx: 'grad', palette: 2 },
  { id: 'g3', type: 'pie', range: 'A1:B4', title: 'Felii', fx: 'grad' },
  { id: 'g4', type: 'line', range: 'A1:C4', title: 'Linii', fx: 'shadow' },
  { id: 'g5', type: 'col', range: 'A1:C4', title: 'Simplu' },
];
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, charts }, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
const files = Object.keys(zip.files).filter((f) => /charts\/chart\d+\.xml$/.test(f)).sort();
const xmls = await Promise.all(files.map((f) => zip.file(f).async('string')));
const X = (t) => xmls.find((x) => x.includes(`<a:t>${t}</a:t>`)) ?? '';
ok((X('Umbre').match(/<a:solidFill><a:srgbClr val="[0-9A-F]{6}"\/><\/a:solidFill><a:effectLst><a:outerShdw /g) ?? []).length === 2, 'în .xlsx: umbra după umplere la fiecare serie');
ok((X('Degrade').match(/<c:spPr><a:gradFill rotWithShape="1"><a:gsLst>/g) ?? []).length === 2, 'în .xlsx: degradeul la fiecare serie');
ok((X('Felii').match(/<c:dPt>.*?<a:gradFill/g) ?? []).length === 3, 'în .xlsx: degradeul pe fiecare felie');
ok(/<a:ln w="28575" cap="rnd">.*?<\/a:ln><a:effectLst>/.test(X('Linii')), 'în .xlsx: umbra liniei după a:ln');
ok(!/effectLst|gradFill/.test(X('Simplu')), 'în .xlsx: graficul simplu fără efecte');
const back = await readXlsx(bytes);
const ch = back.sheets?.[0]?.charts ?? back[0]?.charts ?? [];
const by = (t) => ch.find((c) => c.title === t);
ok(by('Umbre')?.fx === 'shadow' && by('Linii')?.fx === 'shadow', 'citit înapoi: umbrele');
ok(by('Degrade')?.fx === 'grad' && by('Degrade')?.palette === 2, 'citit înapoi: degradeul și paleta Verde');
ok(by('Felii')?.fx === 'grad', 'citit înapoi: plăcinta cu degrade');
ok(by('Simplu') && by('Simplu').fx === undefined, 'citit înapoi: simplul rămâne simplu');

console.log(fail ? `${fail} GREȘITE` : 'TOATE BUNE');
process.exit(fail ? 1 : 0);
