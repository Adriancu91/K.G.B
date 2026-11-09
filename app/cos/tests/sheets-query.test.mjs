// Test: interogarea din tabel / zonă (Date → Preluare date → Din tabel / zonă): capul de tabel citit ca nume de coloane,
// pașii (păstrează coloane, filtrează, sortează, dubluri, goale, redenumește, primele N) și rezultatul pus în celule.
// Rulare (în suite/): node tests/sheets-query.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-query-${process.pid}`);
await build({ entryPoints: ['src/sheets/query.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { readQTable, runQuery, qTableCells, cleanQuery, stepLabel } = await import(pathToFileURL(join(out, 'query.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'GREȘIT'} ${name}${ok ? '' : `\n   am: ${JSON.stringify(a)}\n   vreau: ${JSON.stringify(b)}`}`);
};

const cells = {
  A1: 'Oraș', B1: 'Produs', C1: 'Sumă', D1: '',
  A2: 'Iași', B2: 'Mere', C2: '10',
  A3: 'Cluj', B3: 'Pere', C3: '25,5',
  A4: 'Iași', B4: 'Mere', C4: '10',
  A5: 'Arad', B5: 'Prune', C5: '=C2*4',
  A7: 'Brașov', B7: 'Mere', C7: '5',
};
const res = evaluateAll(cells);
const t = readQTable(cells, res, { r0: 0, c0: 0, r1: 6, c1: 3 });
eq('capul de tabel (coloana goală primește nume)', t.head, ['Oraș', 'Produs', 'Sumă', 'Coloana 4']);
eq('numerele și formulele ca numere', t.rows.map((r) => r[2]), [10, 25.5, 10, 40, '', 5]);

const steps = [
  { k: 'noblank' },
  { k: 'keep', cols: ['Oraș', 'Sumă'] },
  { k: 'dedupe' },
  { k: 'filter', col: 'Sumă', op: 'ge', v: '10' },
  { k: 'sort', col: 'Sumă', desc: true },
  { k: 'rename', col: 'Sumă', to: 'Total' },
];
const r = runQuery(t, steps);
eq('rezultatul pașilor', r.table, { head: ['Oraș', 'Total'], rows: [['Arad', 40], ['Cluj', 25.5], ['Iași', 10]] });
eq('niciun pas sărit', r.skipped, []);
eq('primele 2', runQuery(t, [...steps, { k: 'top', n: 2 }]).table.rows.length, 2);
eq('conține (fără majuscule)', runQuery(t, [{ k: 'filter', col: 'Produs', op: 'has', v: 'MER' }]).table.rows.length, 3);
eq('sortare text crescătoare, golurile la sfârșit', runQuery(t, [{ k: 'sort', col: 'Oraș', desc: false }]).table.rows.map((x) => x[0]), ['Arad', 'Brașov', 'Cluj', 'Iași', 'Iași', '']);
eq('pas cu coloană care lipsește e sărit', runQuery(t, [{ k: 'filter', col: 'Preț', op: 'eq', v: '1' }, { k: 'noblank' }]).skipped, [1]);

const c = qTableCells(r.table);
eq('celulele rezultatului', c.cells, { A1: 'Oraș', B1: 'Total', A2: 'Arad', B2: '40', A3: 'Cluj', B3: '25.5', A4: 'Iași', B4: '10' });
eq('capul îngroșat', c.styles.A1, { b: true });
eq('textul cu = în față rămâne text', qTableCells({ head: ['x'], rows: [['=1+1']] }).cells.A2, "'=1+1");

eq('curățarea din fișier', cleanQuery({ src: 'Foaia 1', range: { r0: 0, c0: 0, r1: 6, c1: 3 }, steps: [...steps, { k: 'rău' }, { k: 'sort', col: 3 }] }).steps.length, steps.length);
eq('fără sursă = nimic', cleanQuery({ range: { r0: 0, c0: 0, r1: 1, c1: 1 }, steps: [] }), undefined);
const g = runQuery(t, [{ k: 'noblank' }, { k: 'group', col: 'Oraș', agg: 'sum', of: 'Sumă' }]).table;
eq('grupează după oraș (sumă)', g, { head: ['Oraș', 'Sumă Sumă'], rows: [['Iași', 20], ['Cluj', 25.5], ['Arad', 40], ['Brașov', 5]] });
eq('grupează: număr de rânduri', runQuery(t, [{ k: 'noblank' }, { k: 'group', col: 'Produs', agg: 'count' }]).table.rows, [['Mere', 3], ['Pere', 1], ['Prune', 1]]);
eq('grupează: medie', runQuery(t, [{ k: 'noblank' }, { k: 'group', col: 'Produs', agg: 'avg', of: 'Sumă' }]).table.rows[0], ['Mere', +(25 / 3).toPrecision(15)]);
const k = runQuery(t, [{ k: 'noblank' }, { k: 'calc', name: 'Cu TVA', a: 'Sumă', op: '*', b: '1,19', bCol: false }, { k: 'calc', name: 'Cheie', a: 'Oraș', op: '&', b: 'Produs', bCol: true }]).table;
eq('coloane calculate', k.head, ['Oraș', 'Produs', 'Sumă', 'Coloana 4', 'Cu TVA', 'Cheie']);
eq('valorile calculate', [k.rows[0][4], k.rows[0][5]], [11.9, 'IașiMere']);
eq('coloană nouă cu nume luat e sărită', runQuery(t, [{ k: 'calc', name: 'Oraș', a: 'Sumă', op: '+', b: '1', bCol: false }]).skipped, [1]);
eq('pașii noi trec de curățare', cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 1, c1: 1 }, steps: [{ k: 'group', col: 'A', agg: 'count' }, { k: 'calc', name: 'x', a: 'A', op: '&', b: 'B', bCol: true }, { k: 'group', col: 'A', agg: 'sum' }] }).steps.length, 2);
eq('eticheta grupării', stepLabel({ k: 'group', col: 'Oraș', agg: 'sum', of: 'Sumă' }), 'Grupează după Oraș: sumă din Sumă');
eq('eticheta pasului', stepLabel(steps[3]), 'Filtrează: Sumă mai mare sau egal cu „10”');

console.log(fail ? `\n${fail} GREȘELI` : '\nTOATE TESTELE AU TRECUT');
process.exit(fail ? 1 : 0);
