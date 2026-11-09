// Test: Sheets → graficele de tip nou din .xlsx (cx:chart: cascadă, pâlnie, hartă de suprafețe, soare, cutie, histogramă, Pareto)
// se citesc cu felul lor, zona datelor (din numele ascunse _xlchart) și locul de pe foaie; salvate și citite înapoi își păstrează felul.
// Rulare (în suite/): node tests/sheets-chartex.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
const dir = join(tmpdir(), `suite-chartex-${process.pid}`);
const entry = join(tmpdir(), `suite-chartex-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

const want = {
  'waterfall.xlsx': ['waterfall', 'C4:C15', 'Waterfall'], 'waterfall2.xlsx': ['waterfall', 'C4:C19', 'Waterfall Test'],
  'SimpleHistogram.xlsx': ['hist', 'A1:A5', 'Chart Title'], 'funnel1.xlsx': ['funnel', 'B2:B7', ''], 'paretoLine.xlsx': ['pareto', 'C4:C13', 'ParetoLine'],
  'boxWhisker.xlsx': ['box', 'B4:D12', ''], 'treemap.xlsx': ['treemap', 'B4:E14', ''], 'sunburst.xlsx': ['sunburst', 'B4:E14', ''],
};
for (const [f, [type, range, title]] of Object.entries(want)) {
  const r = await readXlsx(new Uint8Array(readFileSync('../test-corpus/xlsx/' + f)));
  const ch = r.sheets[0].charts ?? [];
  const c = ch[0];
  ok(ch.length === 1 && r.chartsSkipped === 0 && c.type === type && c.range === range && c.title === title && !!c.at,
    `${f}: ${c ? `${c.type} ${c.range} „${c.title}” ${c.at ? 'cu loc' : 'fără loc'}` : 'niciun grafic'} (sărite ${r.chartsSkipped})`);
  // Caseta de rezervă („graficul nu e disponibil…”) nu apare ca formă.
  ok(!(r.sheets[0].pics ?? []).some((x) => x.sh), `${f}: fără caseta de rezervă`);
  const back = await readXlsx(await writeXlsx(r.sheets.map((s) => ({ sheet: s, results: {} }))));
  const c2 = back.sheets[0].charts?.[0];
  ok(c2?.type === type && c2?.range === range, `${f}: salvat și redeschis: ${c2?.type} ${c2?.range}`);
}
console.log(fail ? `\n${fail} greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
