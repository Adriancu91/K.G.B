// Test: Sheets → graficele cu datele pe altă foaie (de exemplu pe o foaie ascunsă): se citesc din .xlsx cu foaia datelor (src),
// se scriu înapoi cu trimiterile la acea foaie, iar redenumirea foii datelor schimbă și foaia graficului.
// Rulare (în suite/): node tests/sheets-chart-othersheet.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';
const dir = join(tmpdir(), `suite-chartother-${process.pid}`);
const entry = join(tmpdir(), `suite-chartother-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { renameSheet } from ${p('src/sheets/tabs.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx, renameSheet } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

// Fișiere reale: graficele de pe prima foaie, cu datele pe foile ascunse / pe altă foaie.
const a = await readXlsx(new Uint8Array(readFileSync('../test-corpus/xlsx/123233_charts.xlsx')));
const ca = a.sheets[0].charts ?? [];
ok(ca.length === 4 && a.chartsSkipped === 0, `123233_charts.xlsx: 4 grafice pe prima foaie (${ca.length}, sărite ${a.chartsSkipped})`);
ok(ca.every((c, i) => c.src === `data_Page1_1_${i + 1}`), `fiecare cu foaia lui de date: ${ca.map((c) => c.src).join(', ')}`);
const b = await readXlsx(new Uint8Array(readFileSync('../test-corpus/xlsx/WithThreeCharts.xlsx')));
const all = b.sheets.flatMap((s) => (s.charts ?? []).map((c) => [s.name, c.src ?? s.name]));
ok(all.length === 3 && b.chartsSkipped === 0 && all.every(([, src]) => src === 'Sheet1'), `WithThreeCharts.xlsx: 3 grafice, toate cu datele pe Sheet1: ${JSON.stringify(all)}`);

// Foile care sunt doar un grafic (chartsheet): o foaie goală cu graficul în colțul de sus, cu datele de pe altă foaie.
for (const f of ['WithChartSheet.xlsx', 'SimpleScatterChart.xlsx']) {
  const r = await readXlsx(new Uint8Array(readFileSync('../test-corpus/xlsx/' + f)));
  const cs = r.sheets.filter((s) => s.charts?.some((c) => c.src && c.at && c.at.r === 0 && c.at.c === 0));
  ok(r.skipped === 0 && cs.length === 1, `${f}: foaia-grafic se deschide, cu graficul pe ea (sărite ${r.skipped}, ${cs.map((s) => s.name + ' ← ' + s.charts[0].src).join(', ')})`);
}

// Scris și citit înapoi: trimiterile duc la foaia datelor.
const cells = { A1: 'Luna', B1: 'Vânzări', A2: 'Ian', B2: '10', A3: 'Feb', B3: '20' };
const book = [
  { sheet: { name: 'Raport', colW: {}, cells: { A1: 'Titlu' }, styles: {}, charts: [{ id: 'g1', type: 'col', range: 'A1:B3', src: 'Date', title: 'Din altă foaie' }] }, results: {} },
  { sheet: { name: 'Date', colW: {}, cells, styles: {} }, results: {} },
];
const bytes = await writeXlsx(book);
const zip = await JSZip.loadAsync(bytes);
const cXml = await zip.file('xl/charts/chart1.xml')?.async('string') ?? '';
ok(/<c:f>'?Date'?!\$?B\$?2:\$?B\$?3<\/c:f>/.test(cXml), `.xlsx: valorile din foaia Date (${/<c:val>[\s\S]*?<c:f>([^<]*)/.exec(cXml)?.[1]})`);
ok(/<c:v>20<\/c:v>/.test(cXml), '.xlsx: valorile salvate sunt cele din foaia Date');
const back = await readXlsx(bytes);
const ch = back.sheets[0].charts?.[0];
ok(ch && ch.src === 'Date' && ch.range === 'A1:B3', `citit înapoi: ${JSON.stringify(ch && { src: ch.src, range: ch.range })}`);
ok(!back.sheets[1].charts?.length, 'foaia Date nu primește graficul');

// Redenumirea foii datelor.
const ren = renameSheet(book.map((x) => x.sheet), 1, 'Cifre');
ok(ren[0].charts[0].src === 'Cifre', `după redenumire, graficul ia datele din „Cifre”: ${ren[0].charts[0].src}`);
const ren2 = renameSheet(book.map((x) => x.sheet), 0, 'Altul');
ok(ren2[0].charts[0].src === 'Date', 'redenumirea foii graficului nu schimbă foaia datelor');

if (fail) { console.log(`\n${fail} verificări GREȘITE`); process.exit(1); }
console.log('\nToate verificările au trecut');
