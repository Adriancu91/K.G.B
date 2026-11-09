// Test pentru Căutare rezultat (Goal Seek) din Sheets: rate de credit, ecuații, erori la pornire, ținte imposibile.
// Rulare (în suite/): node tests/sheet-goalseek.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-goalseek-${process.pid}`);
await build({ entryPoints: ['src/sheets/goalseek.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { goalSeek } = await import(pathToFileURL(join(dir, 'goalseek.js')).href);
const { evaluateAll, formatNumber } = await import(pathToFileURL(join(dir, 'formula.js')).href);
rmSync(dir, { recursive: true, force: true });

// Ca în Sheets: celula schimbată primește x, se recalculează doar celula cu formula.
const seek = (cells, set, change, target) => goalSeek((x) => {
  const r = evaluateAll({ ...cells, [change]: formatNumber(x) }, undefined, undefined, [set])[set];
  return r && r.num && r.value !== undefined && !r.err ? r.value : undefined;
}, target, Number(cells[change] || 0));

let n = 0;
const near = (a, b, eps, msg) => { n++; assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} în loc de ${b}`); };

// 1. Ce dobândă anuală face rata 1.500 la 200.000 pe 20 de ani? (~6,58%)
{
  const r = seek({ A1: '0,05', B1: '=-PMT(A1/12;240;200000)' }, 'B1', 'A1', 1500);
  assert.ok(r.ok); near(r.y, 1500, 0.001, 'rata'); near(r.x, 0.065751, 0.00001, 'dobânda'); n++;
}
// 2. Ecuație de gradul 2: x² − 4 = 21 → 5 (de la 1).
{ const r = seek({ A1: '1', B1: '=A1^2-4' }, 'B1', 'A1', 21); assert.ok(r.ok); near(r.x, 5, 1e-6, 'x²'); }
// 3. Prețul cu TVA 19% care dă 1000 → 840,34; rezultatul rotunjit curat.
{ const r = seek({ A1: '100', B1: '=A1*1.19' }, 'B1', 'A1', 1000); assert.ok(r.ok); near(r.x, 840.336134, 1e-5, 'TVA'); }
// 4. Pornire din 0 cu împărțire la celulă (#DIV/0! la început).
{ const r = seek({ A1: '0', B1: '=10/A1' }, 'B1', 'A1', 4); assert.ok(r.ok); near(r.x, 2.5, 1e-6, 'împărțire'); }
// 5. Țintă imposibilă: x² + 1 = 0 → nu se găsește, fără blocare.
{ const r = seek({ A1: '3', B1: '=A1^2+1' }, 'B1', 'A1', 0); assert.equal(r.ok, false); assert.ok(r.iterations <= 100); n++; }
// 6. Formulă prin altă celulă (lanț): C1 = B1*2, B1 = A1+3 → C1 = 20 când A1 = 7.
{ const r = seek({ A1: '0', B1: '=A1+3', C1: '=B1*2' }, 'C1', 'A1', 20); assert.ok(r.ok); near(r.x, 7, 1e-9, 'lanț'); }
// 7. Exponențial: 1000·1,05^x = 2000 → ~14,2067 ani.
{ const r = seek({ A1: '1', B1: '=1000*1.05^A1' }, 'B1', 'A1', 2000); assert.ok(r.ok); near(r.x, 14.2067, 1e-3, 'ani'); }
// 8. Deja la țintă: nu se schimbă nimic.
{ const r = seek({ A1: '2', B1: '=A1*3' }, 'B1', 'A1', 6); assert.ok(r.ok); assert.equal(r.x, 2); n++; }
// 9. Funcție în trepte (ROUND): găsește o valoare care dă exact ținta.
{ const r = seek({ A1: '0', B1: '=ROUND(A1;0)*10' }, 'B1', 'A1', 30); assert.ok(r.ok, JSON.stringify(r)); near(r.y, 30, 1e-9, 'trepte'); }
// 10. Valoare negativă: 50 − 2x = 80 → −15.
{ const r = seek({ A1: '10', B1: '=50-2*A1' }, 'B1', 'A1', 80); assert.ok(r.ok); near(r.x, -15, 1e-9, 'negativ'); }

console.log(`sheet-goalseek: ${n} verificări trecute`);
