// Test: Revizuire → Afișare modificări (src/sheets/changes.ts): celulele schimbate între două stări, cele mai noi sus,
// limita pe o lipire mare și pe tot jurnalul, filtrarea pe foaie / zonă, citirea din fișier.
// Rulare (în suite/): node tests/sheets-changes.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-changes-${process.pid}`);
await build({ entryPoints: ['src/sheets/changes.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { diffCells, addChanges, changesIn, cleanChanges, MAX_CHANGES, MAX_PER_EDIT } = await import(pathToFileURL(join(out, 'changes.js')).href);
const { parseSheetDoc } = await import(pathToFileURL(join(out, 'format.js')).href);
rmSync(out, { recursive: true, force: true });

let fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'GREȘIT'} ${name}${ok ? '' : `\n   am: ${JSON.stringify(a)}\n   vreau: ${JSON.stringify(b)}`}`);
};

const a = { A1: 'Sumă', B2: '10', C3: '=B2*2' };
const b = { A1: 'Sumă', B2: '12', A2: 'nou', C3: '=B2*2' };
const d1 = diffCells('Foaia 1', a, b, 1000, 'Ana');
eq('doar celulele diferite, în ordinea rândurilor', d1.map((x) => `${x.id}:${x.o}>${x.n}`), ['A2:>nou', 'B2:10>12']);
eq('autorul, ora, foaia', [d1[0].who, d1[0].t, d1[0].sheet], ['Ana', 1000, 'Foaia 1']);
eq('aceeași stare = nimic', diffCells('F', a, a, 1, '').length, 0);
eq('celulă golită', diffCells('F', a, { A1: 'Sumă', C3: '=B2*2' }, 1, '').map((x) => [x.id, x.o, x.n]), [['B2', '10', '']]);

const big = {};
for (let r = 1; r <= 300; r++) big['A' + r] = String(r);
const d2 = diffCells('F', {}, big, 2, '');
eq('lipire mare: primele MAX_PER_EDIT celule', d2.length, MAX_PER_EDIT);
eq('lipire mare: ultimul rând spune câte au rămas', d2[d2.length - 1].more, 300 - MAX_PER_EDIT);

const log1 = addChanges(undefined, d1);
eq('cele mai noi sus (în cadrul unei schimbări, de la sfârșit)', log1.map((x) => x.id), ['B2', 'A2']);
const log2 = addChanges(log1, diffCells('Foaia 2', {}, { D4: 'x' }, 3000, ''));
eq('schimbarea nouă e prima', log2[0].id + '@' + log2[0].sheet, 'D4@Foaia 2');
let long = [];
for (let i = 0; i < 6; i++) long = addChanges(long, diffCells('F', {}, big, i, ''));
eq('jurnalul se taie la MAX_CHANGES', long.length, MAX_CHANGES);

eq('pe foaie (fără majuscule)', changesIn(log2, 'foaia 1').map((x) => x.id), ['B2', 'A2']);
eq('pe zonă', changesIn(log2, 'Foaia 1', { r0: 1, c0: 1, r1: 5, c1: 5 }).map((x) => x.id), ['B2']);
eq('tot registrul', changesIn(log2, null).length, 3);

const clean = cleanChanges([{ t: 1, who: 'A', sheet: 'F', id: 'B2', o: '', n: 'x' }, { t: 'x', who: '', sheet: 'F', id: 'B2', o: '', n: '' }, { t: 2, who: '', sheet: 'F', id: 'nu e celula', o: '', n: '' }, null]);
eq('cleanChanges păstrează doar rândurile bune', clean.length, 1);
const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, sheets: [{ name: 'F', cells: {} }], changes: log2 }));
eq('jurnalul se citește din fișier', doc.changes.length, 3);
eq('fără jurnal: câmpul lipsește', 'changes' in parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, sheets: [] })), false);

console.log(fail ? `${fail} GREȘITE` : 'TOATE OK');
process.exit(fail ? 1 : 0);
