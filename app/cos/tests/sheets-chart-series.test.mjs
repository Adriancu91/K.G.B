// Test: Sheets → Proiectare diagramă → Date → Serii: seriile ascunse din grafic (datele rămân în tabel), pe desen,
// în foaie și în .xlsx (seria lipsă, citită înapoi ca ascunsă). Rulare (în suite/): node tests/sheets-chart-series.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartser-${process.pid}`);
const entry = join(tmpdir(), `suite-chartser-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { chartSvg } from ${p('src/sheets/chartSvg.ts')};\nexport { chartData, chartDataOf, shownData, cleanHide, canHideSeries, canSwitchRC } from ${p('src/sheets/chart.ts')};\nexport { parseSheetDoc, serializeSheetDoc } from ${p('src/sheets/format.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx, chartSvg, chartData, chartDataOf, shownData, cleanHide, canHideSeries, canSwitchRC, parseSheetDoc, serializeSheetDoc } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const cells = { A1: 'Luna', B1: 'Nord', C1: 'Sud', D1: 'Est', A2: 'Ian', B2: '60', C2: '30', D2: '10', A3: 'Feb', B3: '80', C3: '50', D3: '20', A4: 'Mar', B4: '140', C4: '70', D4: '30' };
const g = { r0: 0, c0: 0, r1: 3, c1: 3 };
const all = chartData(cells, {}, {}, g);
ok(eq(all.series.map((s) => s.name), ['Nord', 'Sud', 'Est']) && eq(all.where.cols, [1, 2, 3]), 'trei serii, coloanele B, C, D');
const sd = shownData(all, { type: 'col', hide: [2] });
ok(eq(sd.series.map((s) => s.name), ['Nord', 'Est']) && eq(sd.where.cols, [1, 3]), 'Sud ascunsă: rămân Nord și Est, cu coloanele lor');
ok(shownData(all, { type: 'col' }) === all && shownData(all, { type: 'col', hide: [7] }) === all, 'fără nimic ascuns (sau o coloană din afară): datele întregi');
ok(shownData(all, { type: 'col', hide: [1, 2, 3] }) === all, 'toate ascunse: rămân toate (graficul nu rămâne gol)');
ok(shownData(all, { type: 'bubble', hide: [2] }) === all && !canHideSeries('stock') && canHideSeries('pie'), 'la bule și bursă nu se ascund serii');
const svg = chartSvg('col', 'T', sd);
ok(svg.includes('>Nord<') && svg.includes('>Est<') && !svg.includes('>Sud<'), 'pe desen: legenda fără Sud');
ok(eq(cleanHide([3, 1, 1, -2, 'x', 2.5, 4]), [1, 3, 4]) && cleanHide([]) === undefined && cleanHide('1') === undefined, 'curățarea listei');

// În foaie.
const sheet = { name: 'Foaia 1', colW: {}, cells, styles: {}, charts: [{ id: 'g1', type: 'col', range: 'A1:D4', title: 'S', hide: [2, 2, -1] }] };
const re = parseSheetDoc(serializeSheetDoc({ format: 'suite-sheet', version: 1, title: '', sheets: [sheet] })).sheets[0];
ok(eq(re.charts[0].hide, [2]), 'în foaie: seria ascunsă se păstrează (curățată)');

// .xlsx dus-întors.
const charts = [{ id: 'g1', type: 'col', range: 'A1:D4', title: 'Fara Sud', hide: [2] }, { id: 'g2', type: 'line', range: 'A1:D4', title: 'Toate' }];
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, charts }, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
const files = Object.keys(zip.files).filter((f) => /charts\/chart\d+\.xml$/.test(f)).sort();
const xmls = await Promise.all(files.map((f) => zip.file(f).async('string')));
const X = (t) => xmls.find((x) => x.includes(`<a:t>${t}</a:t>`)) ?? '';
const x1 = X('Fara Sud');
ok((x1.match(/<c:ser>/g) ?? []).length === 2 && x1.includes('$B$2:$B$4') && x1.includes('$D$2:$D$4') && !x1.includes('$C$2:$C$4'), 'în .xlsx: doar seriile Nord și Est');
ok((X('Toate').match(/<c:ser>/g) ?? []).length === 3, 'în .xlsx: graficul fără serii ascunse le are pe toate');
const back = await readXlsx(bytes);
const ch = back.sheets?.[0]?.charts ?? back[0]?.charts ?? [];
const b1 = ch.find((c) => c.title === 'Fara Sud'), b2 = ch.find((c) => c.title === 'Toate');
ok(b1?.range === 'A1:D4' && eq(b1?.hide, [2]), 'citit înapoi: zona A1:D4 cu Sud ascunsă (' + b1?.range + ', ' + JSON.stringify(b1?.hide) + ')');
ok(b2 && b2.hide === undefined, 'citit înapoi: graficul întreg nu are serii ascunse');
const sd2 = shownData(chartData(cells, {}, {}, g), b1);
ok(eq(sd2.series.map((s) => s.name), ['Nord', 'Est']), 'citit înapoi: graficul arată tot Nord și Est');

// Comutare rând / coloană.
const rc = chartData(cells, {}, {}, g, false, true);
ok(eq(rc.categories, ['Nord', 'Sud', 'Est']) && eq(rc.series.map((s) => s.name), ['Ian', 'Feb', 'Mar']), 'pe rânduri: lunile sunt seriile, regiunile pe axă');
ok(eq(rc.series[0].values, [60, 30, 10]) && eq(rc.series[2].values, [140, 70, 30]), 'pe rânduri: valorile fiecărui rând');
ok(rc.where.byRow === true && eq(rc.where.cols, [1, 2, 3]), 'pe rânduri: seriile sunt rândurile 2–4');
ok(eq(chartDataOf(cells, {}, {}, g, { type: 'col', byRow: true, hide: [2] }).series.map((s) => s.name), ['Ian', 'Mar']), 'pe rânduri cu Feb ascunsă');
ok(eq(chartDataOf(cells, {}, {}, g, { type: 'hist', byRow: true }).series.map((s) => s.name), ['Nord', 'Sud', 'Est']) && !canSwitchRC('stock') && canSwitchRC('pie'), 'la histogramă (și bursă) nu se comută');
const nh = chartData({ B2: '1', C2: '2', B3: '3', C3: '4' }, {}, {}, { r0: 1, c0: 1, r1: 2, c1: 2 }, false, true);
ok(eq(nh.series.map((s) => s.name), ['Rândul 2', 'Rândul 3']), 'fără cap de tabel: seriile se numesc după rând');
const sheet2 = { name: 'Foaia 1', colW: {}, cells, styles: {}, charts: [{ id: 'g1', type: 'col', range: 'A1:D4', title: 'S', byRow: true }, { id: 'g2', type: 'col', range: 'A1:D4', title: 'T', byRow: 'da' }] };
const re2 = parseSheetDoc(serializeSheetDoc({ format: 'suite-sheet', version: 1, title: '', sheets: [sheet2] })).sheets[0];
ok(re2.charts[0].byRow === true && re2.charts[1].byRow === undefined, 'în foaie: comutarea se păstrează');
const bytes2 = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, charts: [{ id: 'g1', type: 'col', range: 'A1:D4', title: 'Pe randuri', byRow: true }, { id: 'g2', type: 'line', range: 'A1:D4', title: 'Pe randuri fara Feb', byRow: true, hide: [2] }] }, results: {} }]);
const zip2 = await JSZip.loadAsync(bytes2);
const xmls2 = await Promise.all(Object.keys(zip2.files).filter((f) => /charts\/chart\d+\.xml$/.test(f)).map((f) => zip2.file(f).async('string')));
const r1 = xmls2.find((x) => x.includes('<a:t>Pe randuri</a:t>')) ?? '';
ok(r1.includes("!$B$2:$D$2</c:f>") && r1.includes("!$B$4:$D$4</c:f>") && r1.includes("!$B$1:$D$1</c:f>") && r1.includes("!$A$2</c:f>"), 'în .xlsx: valorile pe rânduri (B2:D2…), etichetele din capul de tabel (B1:D1), numele din coloana A');
const back2 = await readXlsx(bytes2);
const ch2 = back2.sheets?.[0]?.charts ?? back2[0]?.charts ?? [];
const q1 = ch2.find((c) => c.title === 'Pe randuri'), q2 = ch2.find((c) => c.title === 'Pe randuri fara Feb');
ok(q1?.byRow === true && q1.range === 'A1:D4' && q1.hide === undefined, 'citit înapoi: pe rânduri, zona A1:D4 (' + JSON.stringify(q1) + ')');
ok(q2?.byRow === true && eq(q2.hide, [2]), 'citit înapoi: pe rânduri cu Feb ascunsă (' + JSON.stringify(q2?.hide) + ')');
ok(eq(chartDataOf(cells, {}, {}, g, q2).series.map((s) => s.name), ['Ian', 'Mar']), 'citit înapoi: graficul arată Ian și Mar');

console.log(fail ? `${fail} GREȘITE` : 'TOATE BUNE');
process.exit(fail ? 1 : 0);
