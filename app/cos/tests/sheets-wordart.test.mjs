// Test: textul artistic din Sheets (poză cu `wa`, pics.ts): se păstrează în .ssheet, cel greșit se aruncă.
// Rulare (în suite/): node tests/sheets-wordart.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `suite-sheet-wa-${process.pid}.mjs`);
await build({ entryPoints: [join(process.cwd(), 'src/sheets/pics.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { cleanPics } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const src = 'data:image/png;base64,iVBORw0KGgo=';
const base = { src, r: 1, c: 2, dx: 0, dy: 0, w: 200, h: 72 };
const got = cleanPics([
  { ...base, id: 'a', alt: 'Raport', wa: { text: 'Raport', s: 'gold', fill: '#FF0000', lw: 99, font: 'serif' } },
  { ...base, id: 'b', wa: { text: 'x', s: 'nu-exista' } },
  { ...base, id: 'c', wa: '{"text":"Din text","s":"blue"}' },
  { ...base, id: 'd', wa: { text: '   ', s: 'blue' } },
], 1000, 100);
check(got.length === 4, 'toate cele 4 poze rămân');
check(got[0].wa && got[0].wa.text === 'Raport' && got[0].wa.s === 'gold' && got[0].wa.fill === '#ff0000' && got[0].wa.lw === 20 && got[0].wa.font === 'serif', `textul artistic bun se păstrează, curățat (${JSON.stringify(got[0].wa)})`);
check(got[1].wa === undefined && got[3].wa === undefined, 'stil necunoscut sau text gol: poza rămâne, fără text artistic');
check(got[2].wa && got[2].wa.text === 'Din text', 'merge și scris ca JSON');
const again = cleanPics(JSON.parse(JSON.stringify(got)), 1000, 100);
check(JSON.stringify(again) === JSON.stringify(got), 'dus-întors .ssheet: la fel');

console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut.');
process.exit(bad ? 1 : 0);
