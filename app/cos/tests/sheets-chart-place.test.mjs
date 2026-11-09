// Test: Sheets → graficele de pe foaie (Mutare diagramă): locul lor (celula din colț, depărtarea, mărimea) se scrie în .xlsx
// ca twoCellAnchor (from / to / ext) și se citește înapoi la fel; un grafic din panou primește la citire locul din fișier
// (în dreapta datelor). Rulare (în suite/): node tests/sheets-chart-place.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartplace-${process.pid}`);
const entry = join(tmpdir(), `suite-chartplace-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { cleanAt } from ${p('src/sheets/chart.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx, cleanAt } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

ok(cleanAt({ r: 2, c: 3, dx: 1, dy: 2, w: 400, h: 250 }, 100, 20)?.w === 400, 'cleanAt păstrează un loc bun');
ok(cleanAt({ r: 2, c: 3, w: 10, h: 99999 }, 100, 20)?.w === 120 && cleanAt({ r: 2, c: 3, w: 10, h: 99999 }, 100, 20)?.h === 3000, 'cleanAt pune mărimea în limite');
ok(cleanAt({ r: 'x', c: 3, w: 400, h: 200 }, 100, 20) === null && cleanAt(null, 100, 20) === null, 'cleanAt refuză un loc stricat');

const cells = { A1: 'Luna', B1: 'Vânzări', A2: 'Ian', B2: '10', A3: 'Feb', B3: '20' };
const at = { r: 3, c: 4, dx: 5, dy: 2, w: 400, h: 250 };
const charts = [
  { id: 'g1', type: 'col', range: 'A1:B3', title: 'Pe foaie', at },
  { id: 'g2', type: 'line', range: 'A1:B3', title: 'În panou' },
];
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: { E: 100 }, cells, styles: {}, charts }, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
const dXml = await zip.file('xl/drawings/drawing1.xml').async('string');
const first = dXml.split('</xdr:twoCellAnchor>')[0];
ok(/<xdr:from><xdr:col>4<\/xdr:col><xdr:colOff>47625<\/xdr:colOff><xdr:row>3<\/xdr:row><xdr:rowOff>19050<\/xdr:rowOff><\/xdr:from>/.test(first), 'from = E4, cu depărtarea în EMU');
ok(/<a:ext cx="3810000" cy="2381250"\/>/.test(first), 'ext = 400 × 250 px');
// Coloana E are 100 px: 5 + 400 = 405 → trece de E (100), apoi de F, G, H (câte COL_W) …
const to = /<xdr:to><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row><xdr:rowOff>(\d+)<\/xdr:rowOff><\/xdr:to>/.exec(first);
ok(to && +to[1] > 4 && +to[3] > 3, `to e după from (col ${to?.[1]}, rând ${to?.[3]})`);

const back = await readXlsx(bytes);
const ch = back.sheets[0].charts;
ok(ch.length === 2, 'două grafice citite');
ok(ch[0].at && ch[0].at.r === 3 && ch[0].at.c === 4 && ch[0].at.dx === 5 && ch[0].at.dy === 2 && ch[0].at.w === 400 && ch[0].at.h === 250, `primul grafic la locul lui: ${JSON.stringify(ch[0].at)}`);
ok(ch[1].at && ch[1].at.c === 3 && ch[1].at.r === 18, `al doilea primește locul din fișier, în dreapta datelor: ${JSON.stringify(ch[1].at)}`);
// Fără ext (cx = 0), mărimea vine din celula de sfârșit.
const zip2 = await JSZip.loadAsync(bytes);
zip2.file('xl/drawings/drawing1.xml', dXml.replace(/<a:ext cx="3810000" cy="2381250"\/>/, '<a:ext cx="0" cy="0"/>'));
const back2 = await readXlsx(await zip2.generateAsync({ type: 'uint8array' }));
const a2 = back2.sheets[0].charts[0].at;
ok(a2 && Math.abs(a2.w - 400) <= 1 && Math.abs(a2.h - 250) <= 1, `mărimea din from / to: ${JSON.stringify(a2)}`);

if (fail) { console.log(`\n${fail} verificări GREȘITE`); process.exit(1); }
console.log('\nToate verificările au trecut');
