// Test pentru ⊕ Consolidare (Sheets, consolidate.ts): după poziție și după etichete, cu toate funcțiile.
// Rulare (în suite/): node tests/sheets-consolidate.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-consolidate-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/consolidate.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { consolidate } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const J = JSON.stringify;

// După poziție: două tabele 2×2 (al doilea mai mare) se adună celulă cu celulă.
ok(J(consolidate([[[1, 2], [3, 4]], [[10, 20, 5], [30, 40, null]]], 'sum', false, false)) === J([[11, 22, 5], [33, 44, null]]), 'după poziție: sumă');
ok(J(consolidate([[[1, 2]], [[3, 'x']]], 'count', false, false)) === J([[2, 1]]), 'Număr: numără doar numerele');
ok(J(consolidate([[[2, 9]], [[4, 1]]], 'average', false, false)) === J([[3, 5]]), 'Medie');
ok(J(consolidate([[[2, 9]], [[4, 1]]], 'max', false, false)) === J([[4, 9]]) && J(consolidate([[[2, 9]], [[4, 1]]], 'min', false, false)) === J([[2, 1]]), 'Maxim și Minim');
ok(J(consolidate([[[2, 3]], [[4, 5]]], 'product', false, false)) === J([[8, 15]]), 'Produs');

// După etichete: lunile pe foi diferite, produsele în altă ordine, unul lipsește într-o lună, o coloană în plus în alta.
const ian = [[null, 'Buc', 'Lei'], ['Mere', 10, 50], ['Pere', 5, 30]];
const feb = [[null, 'Lei', 'Buc'], ['pere', 40, 8], ['Prune', 20, 4]];
const mar = [[null, 'Buc', 'Lei', 'Retur'], ['Mere', 1, 5, 2]];
const all = consolidate([ian, feb, mar], 'sum', true, true);
ok(J(all) === J([[null, 'Buc', 'Lei', 'Retur'], ['Mere', 11, 55, 2], ['Pere', 13, 70, null], ['Prune', 4, 20, null]]), 'după etichete (sus și stânga): ' + J(all));
// Doar după prima coloană: coloanele după poziție.
const left = consolidate([[['Mere', 1, 2], ['Pere', 3, 4]], [['Pere', 10, 20]]], 'sum', false, true);
ok(J(left) === J([['Mere', 1, 2], ['Pere', 13, 24]]), 'doar după prima coloană: ' + J(left));
// Doar după rândul de sus.
const top = consolidate([[['A', 'B'], [1, 2]], [['B', 'C'], [10, 20]]], 'sum', true, false);
ok(J(top) === J([['A', 'B', 'C'], [1, 12, 20]]), 'doar după rândul de sus: ' + J(top));
ok(J(consolidate([], 'sum', true, true)) === '[]' && J(consolidate([[]], 'sum', false, false)) === '[]', 'fără tabele: nimic');
console.log(fail ? `${fail} GREȘELI` : 'Toate testele trec.');
process.exit(fail ? 1 : 0);
