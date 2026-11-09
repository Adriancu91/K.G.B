// Test pentru sortarea după culoare din Sheets (fereastra Sortare: Culoarea fundalului / textului, Sus / Jos).
// Rulare (în suite/): node tests/sheet-sort-color.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-sortcolor-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/sort.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { sortRangeBy } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let n = 0;
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };
const cells = { A1: 'Ana', B1: '30', A2: 'Dan', B2: '10', A3: 'Ion', B3: '20', A4: 'Eva', B4: '40', A5: 'Rux', B5: '50' };
const styles = { A2: { bg: '#ffff00' }, A4: { bg: '#ffff00' }, A5: { bg: '#ff0000' }, B3: { color: '#c00000' } };
const g = { r0: 0, r1: 4, c0: 0, c1: 1 };
const names = (o) => [0, 1, 2, 3, 4].map((r) => o.cells['A' + (r + 1)]);

// 1. Galbenul sus, restul în ordinea de dinainte (sortare stabilă).
eq(names(sortRangeBy(cells, styles, {}, g, [{ col: 0, desc: false, on: 'bg', color: '#ffff00' }])), ['Dan', 'Eva', 'Ana', 'Ion', 'Rux'], 'galben sus');
// 2. Galbenul jos.
eq(names(sortRangeBy(cells, styles, {}, g, [{ col: 0, desc: true, on: 'bg', color: '#ffff00' }])), ['Ana', 'Ion', 'Rux', 'Dan', 'Eva'], 'galben jos');
// 3. Roșu sus, apoi galben sus, apoi după valoare: ca nivelurile din Excel.
eq(names(sortRangeBy(cells, styles, {}, g, [{ col: 0, desc: false, on: 'bg', color: '#ff0000' }, { col: 0, desc: false, on: 'bg', color: '#ffff00' }, { col: 1, desc: true }])),
  ['Rux', 'Eva', 'Dan', 'Ana', 'Ion'], 'roșu, galben, apoi sumă descrescător');
// 4. Culoarea textului pe coloana B.
eq(names(sortRangeBy(cells, styles, {}, g, [{ col: 1, desc: false, on: 'fg', color: '#c00000' }])), ['Ion', 'Ana', 'Dan', 'Eva', 'Rux'], 'text roșu sus');
// 5. Formatarea pleacă odată cu rândul.
const o = sortRangeBy(cells, styles, {}, g, [{ col: 0, desc: false, on: 'bg', color: '#ff0000' }]);
eq(o.styles.A1, { bg: '#ff0000' }, 'fundalul a mers cu rândul');
// 6. „Fără fundal” sus.
eq(names(sortRangeBy(cells, styles, {}, g, [{ col: 0, desc: false, on: 'bg', color: 'none' }])), ['Ana', 'Ion', 'Dan', 'Eva', 'Rux'], 'fără fundal sus');
// 7. După listă: zilele săptămânii (fără diacritice și cu majusculă se potrivesc), ce nu e în listă la final.
const days = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];
const dc = { A1: 'Vineri', A2: 'luni', A3: 'Altceva', A4: 'MARTI', A5: 'duminică' };
const g1 = { r0: 0, r1: 4, c0: 0, c1: 0 };
eq(names(sortRangeBy(dc, {}, {}, g1, [{ col: 0, desc: false, list: days }])), ['luni', 'MARTI', 'Vineri', 'duminică', 'Altceva'], 'luni → duminică');
eq(names(sortRangeBy(dc, {}, {}, g1, [{ col: 0, desc: true, list: days }])), ['duminică', 'Vineri', 'MARTI', 'luni', 'Altceva'], 'duminică → luni');
// 8. Listă proprie: Mic, Mediu, Mare.
const sz = { A1: 'Mare', A2: 'Mic', A3: 'Mediu', A4: 'Mic', A5: 'Mare' };
eq(names(sortRangeBy(sz, {}, {}, g1, [{ col: 0, desc: false, list: ['Mic', 'Mediu', 'Mare'] }])), ['Mic', 'Mic', 'Mediu', 'Mare', 'Mare'], 'listă proprie');
console.log(`sortarea după culoare și după listă: ${n} verificări trec`);
