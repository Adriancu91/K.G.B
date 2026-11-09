// Test: îmbinarea și adăugarea interogărilor (Editorul de interogare → Îmbină cu alt tabel / Adaugă dedesubt alt tabel):
// potrivirea după o coloană-cheie (toate rândurile / doar potrivirile / fără pereche), coloanele aduse cu nume unice,
// cheile repetate, adăugarea cu coloanele potrivite după nume, pașii săriți când celălalt tabel lipsește, cleanQuery.
// Rulare (în suite/): node tests/sheets-query-merge.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-qmerge-${process.pid}`);
await build({ entryPoints: ['src/sheets/query.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { runQuery, cleanQuery, stepLabel } = await import(pathToFileURL(join(out, 'query.js')).href);
rmSync(out, { recursive: true, force: true });

let fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'GREȘIT'} ${name}${ok ? '' : `\n   am: ${JSON.stringify(a)}\n   vreau: ${JSON.stringify(b)}`}`);
};

const comenzi = { head: ['Client', 'Sumă'], rows: [['Ana', 10], ['Bogdan', 20], ['ana ', 5], ['Dan', 7], ['', 3]] };
const clienti = { head: ['Nume', 'Oraș', 'Sumă'], rows: [['Ana', 'Iași', 1], ['Bogdan', 'Cluj', 2], ['Bogdan', 'Arad', 3], ['Ema', 'Deva', 4]] };
const luna2 = { head: ['Sumă', 'Client', 'Notă'], rows: [[8, 'Ema', 'nou']] };
const other = (n) => ({ clienti, luna2 })[n.toLowerCase()];

const left = runQuery(comenzi, [{ k: 'merge', src: 'Clienti', col: 'Client', col2: 'Nume', how: 'left', cols: [] }], other).table;
eq('left: coloanele aduse, Sumă devine Sumă (2)', left.head, ['Client', 'Sumă', 'Oraș', 'Sumă (2)']);
eq('left: cheie repetată dincolo = două rânduri, fără majuscule / spații, goale păstrate', left.rows, [
  ['Ana', 10, 'Iași', 1], ['Bogdan', 20, 'Cluj', 2], ['Bogdan', 20, 'Arad', 3], ['ana ', 5, 'Iași', 1], ['Dan', 7, '', ''], ['', 3, '', ''],
]);
const inner = runQuery(comenzi, [{ k: 'merge', src: 'clienti', col: 'Client', col2: 'Nume', how: 'inner', cols: ['Oraș'] }], other).table;
eq('inner: doar potrivirile, doar coloana aleasă', inner, { head: ['Client', 'Sumă', 'Oraș'], rows: [['Ana', 10, 'Iași'], ['Bogdan', 20, 'Cluj'], ['Bogdan', 20, 'Arad'], ['ana ', 5, 'Iași']] });
const anti = runQuery(comenzi, [{ k: 'merge', src: 'clienti', col: 'Client', col2: 'Nume', how: 'anti', cols: [] }], other).table;
eq('anti: rândurile fără pereche, coloanele neschimbate', anti, { head: ['Client', 'Sumă'], rows: [['Dan', 7], ['', 3]] });
const nums = runQuery({ head: ['Cod'], rows: [[1], ['2'], [3]] }, [{ k: 'merge', src: 'x', col: 'Cod', col2: 'Id', how: 'inner', cols: [] }], () => ({ head: ['Id', 'Den'], rows: [['1', 'unu'], [2, 'doi']] })).table;
eq('numerele se potrivesc cu textul care arată la fel', nums.rows, [[1, 'unu'], ['2', 'doi']]);

const app = runQuery(comenzi, [{ k: 'append', src: 'Luna2' }], other).table;
eq('append: coloanele după nume, Notă nouă la dreapta', app.head, ['Client', 'Sumă', 'Notă']);
eq('append: rândurile adăugate dedesubt', app.rows.slice(-2), [['', 3, ''], ['Ema', 8, 'nou']]);
eq('append: câte rânduri', app.rows.length, 6);

const miss = runQuery(comenzi, [{ k: 'merge', src: 'Lipsă', col: 'Client', col2: 'Nume', how: 'left', cols: [] }, { k: 'append', src: 'Lipsă' }, { k: 'merge', src: 'clienti', col: 'Client', col2: 'Nu există', how: 'left', cols: [] }, { k: 'top', n: 1 }], other);
eq('pașii cu tabel / coloană lipsă sunt săriți', miss.skipped, [1, 2, 3]);
eq('restul pașilor merg', miss.table.rows, [['Ana', 10]]);
eq('fără rezolvitor: sărit', runQuery(comenzi, [{ k: 'append', src: 'luna2' }]).skipped, [1]);

const q = cleanQuery({ src: 'Foaie1', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [
  { k: 'merge', src: 'T', col: 'a', col2: 'b', how: 'inner', cols: ['x'] }, { k: 'merge', src: 'T', col: 'a', col2: 'b', how: 'cross', cols: [] },
  { k: 'append', src: 'T' }, { k: 'append' }] });
eq('cleanQuery: păstrează îmbinarea și adăugarea bune', q.steps.map((s) => s.k + (s.how ?? '')), ['mergeinner', 'append']);
eq('stepLabel îmbinare', stepLabel({ k: 'merge', src: 'Clienti', col: 'Client', col2: 'Nume', how: 'inner', cols: ['Oraș'] }), 'Îmbină cu Clienti (Client = Nume, doar potrivirile): Oraș');
eq('stepLabel adăugare', stepLabel({ k: 'append', src: 'Luna2' }), 'Adaugă dedesubt rândurile din Luna2');

console.log(fail ? `${fail} GREȘITE` : 'TOATE OK');
process.exit(fail ? 1 : 0);
