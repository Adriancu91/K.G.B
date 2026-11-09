// Test pentru Filtrul avansat din Sheets: zona de criterii („și” pe rând, „sau” între rânduri), rândurile unice, copierea.
// Rulare (în suite/): node tests/sheet-advfilter.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-adv-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/advfilter.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { advancedMatch, copyRows } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let n = 0;
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };
// Lista A1:C7 (rândurile 1..6 sunt date), criteriile în E1:F3.
const cells = {
  A1: 'Oraș', B1: 'Sumă', C1: 'Client',
  A2: 'Cluj', B2: '500', C2: 'Pop',
  A3: 'Iași', B3: '1500', C3: 'Popescu',
  A4: 'Cluj', B4: '2500', C4: 'Ionescu',
  A5: 'Arad', B5: '3000', C5: 'Dan',
  A6: 'Cluj', B6: '2500', C6: 'Ionescu',
  A7: 'Cluj-Napoca', B7: '=B4*2', C7: 'Ana',
};
const results = { B7: { text: '5000', num: true, value: 5000 } };
const list = { r0: 0, r1: 6, c0: 0, c1: 2 };
const crit = (c) => { const r = Object.keys(c).length; return { cells: { ...cells, ...c }, g: { r0: 0, r1: 2, c0: 4, c1: 5 } }; };

// 1. Pe același rând: Oraș = Cluj ȘI Sumă > 1000 (Cluj-Napoca intră și el: textul simplu înseamnă „începe cu”).
let t = crit({ E1: 'Oraș', F1: 'Sumă', E2: 'Cluj', F2: '>1000' });
eq(advancedMatch(t.cells, results, list, { r0: 0, r1: 1, c0: 4, c1: 5 }), [3, 5, 6], 'Cluj și > 1000');
// 2. Pe rânduri diferite: Arad SAU Sumă < 1000.
t = crit({ E1: 'Oraș', F1: 'Sumă', E2: 'Arad', F3: '<1000' });
eq(advancedMatch(t.cells, results, list, t.g), [1, 4], 'Arad sau < 1000');
// 3. Potrivire exactă cu ="=Cluj" (scris =Cluj): doar Cluj, fără Cluj-Napoca.
t = crit({ E1: 'Oraș', E2: '=Cluj' });
eq(advancedMatch(t.cells, results, list, { r0: 0, r1: 1, c0: 4, c1: 4 }), [1, 3, 5], 'exact Cluj');
// 4. Rândurile unice: Cluj 2500 Ionescu apare de două ori.
t = crit({ E1: 'Oraș', E2: 'Cluj' });
eq(advancedMatch(t.cells, results, list, { r0: 0, r1: 1, c0: 4, c1: 4 }, true), [1, 3, 6], 'unice');
// 5. Semne * și ?: client care începe cu „Pop” urmat de ceva.
t = crit({ F1: 'Client', F2: 'Pop?*' });
eq(advancedMatch(t.cells, results, list, { r0: 0, r1: 1, c0: 5, c1: 5 }), [2], 'Pop?*');
// 6. Un rând de criterii gol = toate rândurile (ca în Excel).
t = crit({ E1: 'Oraș' });
eq(advancedMatch(t.cells, results, list, { r0: 0, r1: 1, c0: 4, c1: 4 }).length, 6, 'criteriu gol');
// 7. Titlu necunoscut: mesaj clar.
t = crit({ E1: 'Țara', E2: 'RO' });
n++; assert.throws(() => advancedMatch(t.cells, results, list, { r0: 0, r1: 1, c0: 4, c1: 4 }), /Titlurile/);
// 8. Copierea: titlurile + rândurile, formula devine valoarea ei, formatarea merge cu ea.
const o = copyRows(cells, { B1: { b: true } }, results, list, [4, 6], 9, 0);
eq([o.cells.A10, o.cells.B10, o.cells.A11, o.cells.A12, o.cells.B12], ['Oraș', 'Sumă', 'Arad', 'Cluj-Napoca', '5000'], 'copiere');
eq(o.styles.B10, { b: true }, 'formatarea titlului');
eq(o.to, { r0: 9, c0: 0, r1: 11, c1: 2 }, 'zona scrisă');
console.log(`filtrul avansat: ${n} verificări trec`);
