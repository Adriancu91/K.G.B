// Test: zona unui tabel cu nume pentru Rezumat (tableDataRange): fără rândul de total din fișierele aduse
// (Total + SUBTOTAL), dar cu ultimul rând de date când el doar începe cu „Total…” fără formule.
// Rulare (în suite/): node tests/pivot-fromtable.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvft-${process.pid}`);
await build({ entryPoints: ['src/sheets/table.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { tableDataRange } = await import(pathToFileURL(join(out, 'table.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const t = { name: 'Tabel1', r0: 0, c0: 0, r1: 3, c1: 1, theme: 'blue', opts: {} };
const rr = (x) => `${x.r0},${x.c0},${x.r1},${x.c1}`;
let cells = { A1: 'Oraș', B1: 'Suma', A2: 'Cluj', B2: '10', A3: 'Iași', B3: '20', A4: 'Total', B4: '=SUBTOTAL(109;B2:B3)' };
check(rr(tableDataRange(t, cells)) === '0,0,2,1', 'rândul Total cu SUBTOTAL rămâne afară: ' + rr(tableDataRange(t, cells)));
cells = { ...cells, A4: 'Totalizator', B4: '5' };
check(rr(tableDataRange(t, cells)) === '0,0,3,1', 'un rând de date care începe cu „Total” rămâne: ' + rr(tableDataRange(t, cells)));
cells = { A1: 'Oraș', B1: 'Suma', A2: 'Total', B2: '=SUBTOTAL(9;B1:B1)' };
check(rr(tableDataRange({ ...t, r1: 1 }, cells)) === '0,0,1,1', 'tabel cu un singur rând: nu se taie: ' + rr(tableDataRange({ ...t, r1: 1 }, cells)));
console.log(bad ? `\n${bad} GRESITE` : '\nTOATE OK');
process.exit(bad ? 1 : 0);
