// Test: calculul iterativ din Sheets (referințe circulare calculate pe rând, ca „Activare calcul iterativ”).
// Rulare (în suite/): node tests/sheet-iterate.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
const out = join(tmpdir(), `suite-iter-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const book = (cells, iterate) => ({ self: 'Foaia 1', sheets: [{ name: 'Foaia 1', cells }], ...(iterate ? { iterate } : {}) });
// Comision din total: B1 = 1000 + B2, B2 = 10% din B1 → B1 = 1111,11…
const c1 = { B1: '=1000+B2', B2: '=B1*0.1' };
const off = evaluateAll(c1, book(c1));
check(off.B1.err === '#CIRC!', 'fără calcul iterativ: #CIRC!');
const on = evaluateAll(c1, book(c1, { max: 100, delta: 0.001 }));
check(Math.abs(on.B1.value - 1111.111) < 0.01 && Math.abs(on.B2.value - 111.111) < 0.01, `iterativ: B1 = ${on.B1.text}, B2 = ${on.B2.text}`);
// Numărul maxim de treceri: un contor A1 = A1 + 1 ajunge exact la max.
const c2 = { A1: '=A1+1' };
check(evaluateAll(c2, book(c2, { max: 10, delta: 0.001 })).A1.value === 10, 'contorul se oprește la 10 treceri');
check(evaluateAll(c2, book(c2, { max: 1, delta: 0.001 })).A1.value === 1, 'cu o singură trecere: 1');
// Formulele fără cerc nu se schimbă.
const c3 = { A1: '5', A2: '=A1*2', A3: '=SUM(A1:A2)' };
const r3 = evaluateAll(c3, book(c3, { max: 100, delta: 0.001 }));
check(r3.A2.value === 10 && r3.A3.value === 15, 'fără referințe circulare: rezultatele obișnuite');
// Rădăcina pătrată prin metoda lui Newton: X = (X + 2/X) / 2, pornind de la 1 (dacă X e 0 ia 1).
const c4 = { A1: '=IF(A1=0,1,(A1+2/A1)/2)' };
check(Math.abs(evaluateAll(c4, book(c4, { max: 100, delta: 1e-9 })).A1.value - Math.SQRT2) < 1e-9, 'Newton: √2');
console.log(bad ? `\n${bad} GRESELI` : '\nTOATE TESTELE AU TRECUT');
process.exit(bad ? 1 : 0);
