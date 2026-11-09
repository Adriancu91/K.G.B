// Test pentru Sheets → Rezumat → ★ Recomandate: rezumatele propuse după felul coloanelor (text, numere, date).
// Rulare (în suite/): node tests/pivot-recommend.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pivrec-${process.pid}.mjs`);
await build({ stdin: { contents: `export { recommendPivots } from './src/sheets/pivot.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { recommendPivots } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };
// Coloanele: 0 Data (dată), 1 Regiune (4 valori), 2 Produs (3 valori), 3 Client (500 de valori, prea multe), 4 Cantitate, 5 Valoare.
const names = ['Data', 'Regiune', 'Produs', 'Client', 'Cantitate', 'Valoare'];
const kind = { num: [4, 5], date: [0] };
const distinct = (c) => [0, 4, 3, 500, 0, 0][c];
const recs = recommendPivots([0, 1, 2, 3, 4, 5], (c) => names[c], (c) => kind.num.includes(c) || c === 0, (c) => kind.date.includes(c), distinct);
check('cele 4 recomandări', recs.map((r) => r.label), ['Suma „Valoare” pe „Regiune”', 'Suma „Valoare” pe „Produs”', 'Suma „Valoare” pe luni', 'Suma „Valoare” pe „Regiune” și „Produs”']);
check('pe luni: grupare month după coloana de date', recs[2].spec, { rowCol: 0, valCol: 5, op: 'sum', group: 'month' });
check('două texte: rânduri și coloane', recs[3].spec, { rowCol: 1, colCol: 2, valCol: 5, op: 'sum' });
check('clientul cu 500 de valori nu e propus', recs.some((r) => r.label.includes('Client')), false);
const onlyText = recommendPivots([0, 1], (c) => ['Nume', 'Oraș'][c], () => false, () => false, () => 5);
check('fără numere: doar numărul de rânduri', onlyText.map((r) => r.spec), [{ rowCol: 0, valCol: 0, op: 'count' }]);
check('fără nimic potrivit: nicio recomandare', recommendPivots([0], () => 'X', () => true, () => false, () => 0), []);

console.log(fail ? `\n${fail} GREȘITE` : '\nToate trec.');
process.exit(fail ? 1 : 0);
