// Test pentru calculele riglei din Docs: retragerile, rotunjirea la 0,25 cm, mutarea / scoaterea opririlor de tabulator.
// Rulare (în suite/): node tests/docs-ruler.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-ruler-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/rulerMath.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { indentMarks, firstLineFor, indentFor, rightFor, moveStop, snapCm } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let n = 0;
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };
eq(indentMarks(0, null), { body: 0, first: 0 }, 'fără retrageri');
eq(indentMarks(2, 1), { body: 2.5, first: 3.5 }, 'retras 2 pași, primul rând +1 cm');
eq(indentMarks(1, -0.75), { body: 2, first: 1.25 }, 'agățat');
eq(snapCm(1.13), 1.25, 'rotunjire 0,25');
eq(firstLineFor(3.6, 2.5), 1, 'primul rând tras la 3,6 cm');
eq(firstLineFor(2.4, 2.5), null, 'primul rând la fel cu restul = fără');
eq(firstLineFor(1.5, 2.5), -1, 'tras la stânga = agățat');
eq(indentFor(2.6, 0.5), { indent: 2, firstLine: 0.5 }, 'retragerea la 2,5 cm = 2 trepte');
eq(indentFor(2.05, null), { indent: 1.6, firstLine: null }, 'retragerea la 2 cm = 1,6 trepte');
eq(indentFor(3, -1), { indent: 1.6, firstLine: -1 }, 'agățat: restul rândurilor la 3 cm');
eq(rightFor(14.1, 16), 2, 'dreapta: 2 cm de la marginea textului');
eq(rightFor(16.1, 16), null, 'dreapta: la margine = fără');
eq(indentFor(-3, null), { indent: 0, firstLine: null }, 'nu sub 0');
const stops = [{ pos: 3, align: 'l', leader: '' }, { pos: 10, align: 'r', leader: '.' }];
eq(moveStop(stops, null, 5.1, 'c'), [stops[0], { pos: 5, align: 'c', leader: '' }, stops[1]], 'oprire nouă centrată');
eq(moveStop(stops, 10, 12.4), [stops[0], { pos: 12.5, align: 'r', leader: '.' }], 'mutată, își păstrează felul și punctele');
eq(moveStop(stops, 3, null), [stops[1]], 'scoasă');
eq(moveStop(stops, 3, 10), [{ pos: 10, align: 'l', leader: '' }], 'mutată peste alta o înlocuiește');
eq(moveStop(stops, null, -1), stops, 'în stânga marginii nu se pune');
console.log(`rigla: ${n} verificări trec`);
