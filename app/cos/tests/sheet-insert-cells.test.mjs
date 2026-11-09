// Test pentru Inserare / Ștergere celule cu mutare (în jos / la dreapta / în sus / la stânga) din Sheets.
// Rulare (în suite/): node tests/sheet-insert-cells.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-inscells-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/insert.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { insertDelete, wouldPushOut, bandBlockedBy, shiftFormulaRefs } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const sheet = (cells, extra = {}) => ({ name: 'Foaia1', cells, styles: {}, colW: {}, ...extra });

// Inserare B2 cu mutare în jos (axa r, de la rândul 1, banda coloanei B): B2 → B3, A2 și C2 rămân.
{
  const [s] = insertDelete([sheet({ A2: 'a', B2: 'b', B3: 'c', C2: 'x', D1: '=B2+B3+A2', D2: '=SUM(B1:B5)', D3: '=SUM(A1:C5)' }, { styles: { B2: { bold: true } } })], 0, 'r', 1, 1, [1, 1]);
  check('celulele din bandă coboară', [s.cells.B2, s.cells.B3, s.cells.B4, s.cells.A2, s.cells.C2], [undefined, 'b', 'c', 'a', 'x']);
  check('formatarea merge cu celula', s.styles, { B3: { bold: true } });
  check('referințele din bandă se mută, celelalte nu', s.cells.D1, '=B3+B4+A2');
  check('zona din bandă se lungește', s.cells.D2, '=SUM(B1:B6)');
  check('zona mai lată decât banda rămâne', s.cells.D3, '=SUM(A1:C5)');
}
// Inserare la dreapta (axa c, de la coloana 1, banda rândului 0): B1 → C1, B2 rămâne.
{
  const [s] = insertDelete([sheet({ B1: '1', C1: '2', B2: '9', A5: '=B1*C1+B2' })], 0, 'c', 1, 1, [0, 0]);
  check('la dreapta', [s.cells.B1, s.cells.C1, s.cells.D1, s.cells.B2], [undefined, '1', '2', '9']);
  check('formula urmărește celulele mutate', s.cells.A5, '=C1*D1+B2');
}
// Ștergere B2 cu mutare în sus: B3 urcă în B2; referința spre B2 devine #REF!.
{
  const [s] = insertDelete([sheet({ B2: 'șters', B3: 'urcă', A1: '=B2', A2: '=B3', A3: '=SUM(B1:B4)' })], 0, 'r', 1, -1, [1, 1]);
  check('în sus', [s.cells.B2, s.cells.B3], ['urcă', undefined]);
  check('referința ștearsă', s.cells.A1, '=#REF!');
  check('referința urcă', s.cells.A2, '=B2');
  check('zona se strânge', s.cells.A3, '=SUM(B1:B3)');
}
// Ștergere la stânga pe o zonă B1:C2 (2 coloane, rândurile 0–1): D1 → B1.
{
  const [s] = insertDelete([sheet({ B1: 'x', C1: 'y', D1: 'd', D3: 'stă', E2: 'e' })], 0, 'c', 1, -2, [0, 1]);
  check('la stânga', [s.cells.B1, s.cells.C2, s.cells.D1, s.cells.D3], ['d', 'e', undefined, 'stă']);
}
// Rânduri întregi și alte foi.
check('rânduri întregi nu se schimbă la bandă', shiftFormulaRefs('=SUM(2:5)+B2', 'r', 1, 1, true, 'Foaia1', [1, 1]), '=SUM(2:5)+B3');
{
  const out2 = insertDelete([sheet({ B2: 'b' }), { name: 'Alta', cells: { A1: '=Foaia1!B2+B2' }, styles: {}, colW: {} }], 0, 'r', 1, 1, [1, 1]);
  check('altă foaie urmărește celula mutată', out2[1].cells.A1, '=Foaia1!B3+B2');
}
// Zona „capăt de jos” cu capătul de sus în afara benzii nu se mută.
check('zonă pe două coloane, bandă de una', shiftFormulaRefs('=SUM(A1:B9)', 'r', 1, 1, true, 'Foaia1', [1, 1]), '=SUM(A1:B9)');
// Protecții.
check('ar ieși afară doar în bandă', [wouldPushOut(sheet({ A1048576: 'x' }), 'r', 1, [1, 1]), wouldPushOut(sheet({ B1048576: 'x' }), 'r', 1, [1, 1])], [false, true]);
check('îmbinare tăiată de bandă', bandBlockedBy(sheet({}, { merges: ['B5:C5'] }), 'r', 1, [1, 1]), 'B5:C5');
check('îmbinare în bandă', bandBlockedBy(sheet({}, { merges: ['B5:B6'] }), 'r', 1, [1, 1]), null);
check('îmbinare deasupra nu contează', bandBlockedBy(sheet({}, { merges: ['A1:C1'] }), 'r', 1, [1, 1]), null);
{
  const [s] = insertDelete([sheet({}, { merges: ['B5:B6'], rowH: { 3: 40 } })], 0, 'r', 1, 2, [1, 1]);
  check('îmbinarea din bandă coboară, înălțimile rămân', [s.merges, s.rowH], [['B7:B8'], { 3: 40 }]);
}
console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
