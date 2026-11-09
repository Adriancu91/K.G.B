// Test: stilurile de celulă făcute de utilizator (Stiluri celulă → Stil nou…) se păstrează în registru (.ssheet), curățate
// la citire: nume unice, cel mult 60 de litere, doar câmpurile de format. Rulare (în suite/): node tests/sheets-cellstyles.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-cellstyles-${process.pid}`);
await build({ entryPoints: ['src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { parseSheetDoc, serializeSheetDoc, emptySheetDoc, cleanCellStyles } = await import(pathToFileURL(join(out, 'format.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };

const doc = { ...emptySheetDoc(), cellStyles: [{ name: 'Preț important', st: { b: true, color: '#c00000', bg: '#fff2cc', fmt: 'currency', dec: 2 } }] };
const back = parseSheetDoc(serializeSheetDoc(doc));
check(back.cellStyles?.length === 1 && back.cellStyles[0].name === 'Preț important' && back.cellStyles[0].st.b === true && back.cellStyles[0].st.dec === 2, 'dus-întors prin .ssheet: stilul și formatul lui');
check(parseSheetDoc(serializeSheetDoc(emptySheetDoc())).cellStyles === undefined, 'fără stiluri: câmpul lipsește');
const c = cleanCellStyles([
  { name: '  Al meu  ', st: { b: true, evil: '<script>', bg: { x: 1 } } },
  { name: 'al MEU', st: { i: true } },
  { name: '', st: { b: true } },
  { name: 'x'.repeat(100), st: {} },
  { name: 'Fără format' },
  'nimic',
]);
check(c.length === 2 && c[0].name === 'Al meu' && c[0].st.b === true && !('evil' in c[0].st) && !('bg' in c[0].st), 'curățate: numele tăiat, câmpurile străine scoase, dublura (fără majuscule) sărită');
check(c[1].name.length === 60, 'numele lung tăiat la 60 de litere');
check(cleanCellStyles(Array.from({ length: 150 }, (_, i) => ({ name: 'S' + i, st: {} }))).length === 100, 'cel mult 100 de stiluri');

console.log(bad ? `${bad} GRESELI` : 'Toate testele pentru stilurile de celulă trec');
process.exit(bad ? 1 : 0);
