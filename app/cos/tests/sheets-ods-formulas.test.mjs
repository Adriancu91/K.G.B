// Test: formulele din .ods care dădeau „formulă necunoscută”: erorile salvate ca 0 (textul „Err:502”), trimiterile la celule șterse ([#REF!]), formulele-matrice
// (SORT, FREQUENCY întinse pe mai multe celule), WEEKNUM cu tipul 150 (ISO) și DCOUNT cu coloana 0 (toate rândurile).
// Rulare (în suite/): node tests/sheets-ods-formulas.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';

globalThis.DOMParser ??= DOMParser;
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}
const out = join(tmpdir(), `suite-odsf-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { readOds } from './src/sheets/ods.ts'; export { evaluateAll } from './src/sheets/formula.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { readOds, evaluateAll } = await import(pathToFileURL(out).href);

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const open = (f) => readOds(new Uint8Array(readFileSync('../test-corpus/ods/' + f)));

// Fișiere reale: toate formulele se calculează (nimic păstrat doar ca rezultat).
for (const f of ['cachedValue.ods', 'matrix.ods', 'ArrayFormulasStatic.ods', 'date-time-functions.ods', 'database-functions.ods', 'fdo67682-2.ods']) {
  const r = await open(f);
  check(`${f}: toate formulele se calculează`, r.asValues === 0, JSON.stringify(r.asValuesSamples));
}
// Formula-matrice FREQUENCY: celulele de sub ea sunt goale (se umplu la calcul), nu rezultatele vechi.
const m = (await open('matrix.ods')).sheets[0];
const fq = Object.entries(m.cells).find(([, v]) => /^=FREQUENCY\(/.test(v));
check('FREQUENCY: formula e în prima celulă, restul zonei e gol', !!fq && !m.cells['B2'] && !m.cells['B3'], JSON.stringify(fq));

const cells = {
  A1: 'Nume', B1: 'Vârsta', A2: 'Ana', B2: '30', A3: 'Ion', B3: '40', A4: 'Dan', B4: '25',
  D1: 'Vârsta', D2: '>26',
  F1: '=WEEKNUM(DATE(1995,1,1),150)', F2: '=WEEKNUM(DATE(1995,1,1),21)', F3: '=DCOUNT(A1:B4,0,D1:D2)', F4: '=DCOUNTA(A1:B4,0,D1:D2)', F5: '=DCOUNT(A1:B4,"Vârsta",D1:D2)',
};
const r = evaluateAll(cells, { self: 'Foaia 1', sheets: [{ name: 'Foaia 1', cells }] });
check('WEEKNUM(1 ian 1995, 150) = 52 (ISO, ca 21)', r.F1.value === 52 && r.F2.value === 52, JSON.stringify([r.F1, r.F2]));
check('DCOUNT cu coloana 0 = rândurile potrivite', r.F3.value === 2 && r.F4.value === 2, JSON.stringify([r.F3, r.F4]));
check('DCOUNT cu coloana după nume rămâne la fel', r.F5.value === 2, JSON.stringify(r.F5));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
