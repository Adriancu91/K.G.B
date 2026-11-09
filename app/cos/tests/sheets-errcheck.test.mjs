// Test pentru Sheets → ⚠ Erori: lista formulelor cu eroare (în ordinea rândurilor), explicația, sursa erorii (formula care nu
// folosește alte celule cu eroare) și referințele circulare, calculate cu motorul de formule adevărat.
// Rulare (în suite/): node tests/sheets-errcheck.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-errcheck-entry-${process.pid}.ts`);
writeFileSync(entry, `export { sheetErrors } from '${join(process.cwd(), 'src/sheets/errcheck.ts').replaceAll('\\', '/')}';
export { evaluateAll } from '${join(process.cwd(), 'src/sheets/formula.ts').replaceAll('\\', '/')}';`);
const out = join(tmpdir(), `suite-errcheck-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { sheetErrors, evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true }); rmSync(entry, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + extra}`); if (!ok) fail++; };

const cells = {
  A1: '10', A2: '0',
  B1: '=A1/A2',          // #DIV/0! (sursă)
  B2: '=B1*2',           // primește eroarea de la B1
  C5: '=CAUTARE.V(99, A1:A2, 1, FALSE)', // #N/A sau #NAME? (sursă)
  D1: '=D2+1', D2: '=D1+1', // referință circulară
  E1: '=SUM(A1:A2)',     // fără eroare
  A10: '=NUMEFUNCTIEINEXISTENTA(1)', // #NAME?
};
const res = evaluateAll(cells, { self: 'Foaia1', sheets: [] });
const rep = sheetErrors(cells, res);
const ids = rep.items.map((i) => i.id);
check('celulele cu eroare, în ordinea rândurilor', JSON.stringify(ids) === JSON.stringify(['B1', 'D1', 'B2', 'D2', 'C5', 'A10']), JSON.stringify(ids));
const b1 = rep.items.find((i) => i.id === 'B1'), b2 = rep.items.find((i) => i.id === 'B2');
check('B1: #DIV/0! cu explicația în română', b1?.err === '#DIV/0!' && b1.help.includes('zero'), JSON.stringify(b1));
check('B1 e sursa, B2 doar primește eroarea', b1?.source === true && b2?.source === false, JSON.stringify([b1?.source, b2?.source]));
check('formula se vede în listă', b2?.formula === '=B1*2');
check('referințele circulare: D1 și D2', JSON.stringify(rep.circular) === JSON.stringify(['D1', 'D2']), JSON.stringify(rep.circular));
check('E1 (fără eroare) nu apare', !ids.includes('E1'));
check('numărătoarea pe tipuri', rep.counts.find(([e]) => e === '#DIV/0!')?.[1] === 2 && rep.counts.find(([e]) => e === '#CIRC!')?.[1] === 2, JSON.stringify(rep.counts));
check('valorile simple (fără =) nu apar niciodată', sheetErrors({ A1: '#N/A' }, { A1: { text: '#N/A', num: false, err: '#N/A' } }).items.length === 0);
check('foaie fără erori: listă goală', sheetErrors({ A1: '1', B1: '=A1+1' }, evaluateAll({ A1: '1', B1: '=A1+1' }, { self: 'F', sheets: [] })).items.length === 0);
// Viteză: 3.000 de formule cu eroare (fără căutarea sursei, peste 2.000).
const many = {}; for (let r = 1; r <= 3000; r++) many['A' + r] = '=1/0';
const t = Date.now();
const big = sheetErrors(many, evaluateAll(many, { self: 'F', sheets: [] }));
check(`3.000 de erori, listate repede (${Date.now() - t} ms)`, big.items.length === 3000 && Date.now() - t < 3000);

console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
