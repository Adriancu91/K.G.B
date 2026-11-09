// Test: 🧮 Rezolvitor (src/sheets/solver.ts): probleme liniare cu răspuns cunoscut, numere întregi, formule neliniare,
// condiții imposibile și obiectiv nemărginit. Rulare (în suite/): node tests/sheets-solver.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-solver-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-solver-${process.pid}.mjs`);
writeFileSync(entry, `export * from ${JSON.stringify(join(process.cwd(), 'src/sheets/solver.ts').split(String.fromCharCode(92)).join('/'))};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { solve, parseCells, solverMessage } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
// measure: [obiectiv, stânga1, dreapta1, ...]
const prob = (n, obj, cons, extra = {}) => ({
  n, x0: new Array(n).fill(0), ops: cons.map((c) => c[1]), ints: [], bins: [], nonneg: true, goal: 'max',
  measure: (x) => [obj(x), ...cons.flatMap(([l, , r]) => [l(x), typeof r === 'function' ? r(x) : r])], ...extra,
});

// Producție: max 3x + 5y cu x <= 4, 2y <= 12, 3x + 2y <= 18 → x = 2, y = 6, profit 36.
{
  const r = solve(prob(2, (x) => 3 * x[0] + 5 * x[1], [[(x) => x[0], '<=', 4], [(x) => 2 * x[1], '<=', 12], [(x) => 3 * x[0] + 2 * x[1], '<=', 18]]));
  check(r.status === 'optim' && r.linear && r.x.join() === '2,6' && r.obj === 36, `producție: ${r.status} ${r.x} → ${r.obj}`);
}
// Minim cu >= (dietă): min 2a + 3b cu a + b >= 4, a + 3b >= 6 → a = 3, b = 1, cost 9.
{
  const r = solve(prob(2, (x) => 2 * x[0] + 3 * x[1], [[(x) => x[0] + x[1], '>=', 4], [(x) => x[0] + 3 * x[1], '>=', 6]], { goal: 'min' }));
  check(r.status === 'optim' && r.x.join() === '3,1' && r.obj === 9, `dietă (min): ${r.x} → ${r.obj}`);
}
// Egalitate și condiție între două celule: max x + 2y cu x + y = 10, y <= x → x = y = 5, 15.
{
  const r = solve(prob(2, (x) => x[0] + 2 * x[1], [[(x) => x[0] + x[1], '=', 10], [(x) => x[1], '<=', (x) => x[0]]]));
  check(r.status === 'optim' && r.x.join() === '5,5' && r.obj === 15, `egalitate: ${r.x} → ${r.obj}`);
}
// Întregi: max x + y cu 2x + 2y <= 7 → 3 (de exemplu 3 + 0); cu 5x + 4y <= 20, x <= 3.5, întregi → max 3x + 2y.
{
  const r = solve(prob(2, (x) => x[0] + x[1], [[(x) => 2 * x[0] + 2 * x[1], '<=', 7]], { ints: [0, 1] }));
  check(r.status === 'optim' && r.obj === 3 && r.x.every(Number.isInteger), `întregi: ${r.x} → ${r.obj}`);
  const r2 = solve(prob(2, (x) => 3 * x[0] + 2 * x[1], [[(x) => 5 * x[0] + 4 * x[1], '<=', 20], [(x) => x[0], '<=', 3.5]], { ints: [0, 1] }));
  check(r2.status === 'optim' && r2.x.join() === '3,1' && r2.obj === 11, `întregi 2: ${r2.x} → ${r2.obj}`);
}
// Binare (rucsac): valori 10, 13, 7, greutăți 4, 6, 3, capacitate 9 → ia 1 și 3? (4+3=7 → 17) sau 2 și 3 (9 → 20) → 20.
{
  const v = [10, 13, 7], w = [4, 6, 3];
  const r = solve(prob(3, (x) => x.reduce((s, xi, i) => s + v[i] * xi, 0), [[(x) => x.reduce((s, xi, i) => s + w[i] * xi, 0), '<=', 9]], { bins: [0, 1, 2] }));
  check(r.status === 'optim' && r.x.join() === '0,1,1' && r.obj === 20, `rucsac (binare): ${r.x} → ${r.obj}`);
}
// Fără „nenegativ”: min x cu x >= -5 → -5.
{
  const r = solve(prob(1, (x) => x[0], [[(x) => x[0], '>=', -5]], { goal: 'min', nonneg: false }));
  check(r.status === 'optim' && r.x[0] === -5, `fără nenegativ: ${r.x}`);
}
// Imposibil și nemărginit.
{
  const r = solve(prob(1, (x) => x[0], [[(x) => x[0], '>=', 5], [(x) => x[0], '<=', 3]]));
  check(r.status === 'imposibil' && /Nu există/.test(solverMessage(r, 'max')), 'imposibil: ' + r.status);
  const u = solve(prob(1, (x) => x[0], []));
  check(u.status === 'nemarginit', 'nemărginit: ' + u.status);
}
// Neliniar: min (x-1)² + (y-2)² cu x + y <= 2 → (0,5; 1,5), 0,5.
{
  const r = solve(prob(2, (x) => (x[0] - 1) ** 2 + (x[1] - 2) ** 2, [[(x) => x[0] + x[1], '<=', 2]], { goal: 'min' }));
  check(r.status === 'optim' && !r.linear && near(r.x[0], 0.5, 1e-4) && near(r.x[1], 1.5, 1e-4) && near(r.obj, 0.5, 1e-4), `neliniar: ${r.x} → ${r.obj}`);
}
// Valoare: x² = 9, x >= 0 → 3; dobânda pentru o rată (neliniar, o celulă).
{
  const r = solve(prob(1, (x) => x[0] * x[0], [], { goal: 'value', target: 9, x0: [1] }));
  check(r.status === 'optim' && near(r.x[0], 3, 1e-6), `valoare x² = 9: ${r.x}`);
}
// Eroare la pornire.
check(solve(prob(1, () => NaN, [], { measure: () => undefined })).status === 'eroare', 'formulă cu eroare → mesaj');
// Celulele.
check(parseCells('B1:B3, d5').join() === 'B1,B2,B3,D5' && typeof parseCells('B0') === 'string' && typeof parseCells('') === 'string', 'celulele: ' + parseCells('B1:B3, d5'));
console.log(bad ? `${bad} GRESELI` : 'Toate testele Rezolvitorului trec');
process.exit(bad ? 1 : 0);
