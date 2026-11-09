// Test: 🧮 Rezolvitor, rapoartele de limite și de sensibilitate (src/sheets/solver.ts solverLimits, solverSensitivity): pentru fiecare celulă schimbată, cât de jos / sus
// poate merge cu celelalte la soluția găsită, și obiectivul atunci. Rulare (în suite/): node tests/sheets-solver-limits.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-solverlim-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-solverlim-${process.pid}.mjs`);
writeFileSync(entry, `export * from ${JSON.stringify(join(process.cwd(), 'src/sheets/solver.ts').split(String.fromCharCode(92)).join('/'))};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { solve, solverLimits, solverSensitivity } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
const prob = (n, obj, cons, extra = {}) => ({
  n, x0: new Array(n).fill(0), ops: cons.map((c) => c[1]), ints: [], bins: [], nonneg: true, goal: 'max',
  measure: (x) => [obj(x), ...cons.flatMap(([l, , r]) => [l(x), typeof r === 'function' ? r(x) : r])], ...extra,
});

// Producție: max 3x + 5y cu x <= 4, 2y <= 12, 3x + 2y <= 18 → x = 2, y = 6, profit 36.
{
  const p = prob(2, (x) => 3 * x[0] + 5 * x[1], [[(x) => x[0], '<=', 4], [(x) => 2 * x[1], '<=', 12], [(x) => 3 * x[0] + 2 * x[1], '<=', 18]]);
  const r = solve(p);
  const L = solverLimits(p, r.x);
  check(L && near(L[0].lo, 0) && near(L[0].loObj, 30) && near(L[0].hi, 2) && near(L[0].hiObj, 36), 'x: ' + JSON.stringify(L?.[0]));
  check(L && near(L[1].lo, 0) && near(L[1].loObj, 6) && near(L[1].hi, 6) && near(L[1].hiObj, 36), 'y: ' + JSON.stringify(L?.[1]));
}
// Dietă (min 2a + 3b cu a + b >= 4, a + 3b >= 6 → a = 3, b = 1): a poate crește oricât (fără limită de sus).
{
  const p = prob(2, (x) => 2 * x[0] + 3 * x[1], [[(x) => x[0] + x[1], '>=', 4], [(x) => x[0] + 3 * x[1], '>=', 6]], { goal: 'min' });
  const r = solve(p);
  const L = solverLimits(p, r.x);
  check(L && near(L[0].lo, 3) && near(L[0].loObj, 9) && L[0].hi === null && L[0].hiObj === null, 'a fără limită de sus: ' + JSON.stringify(L?.[0]));
  check(L && near(L[1].lo, 1) && L[1].hi === null, 'b: ' + JSON.stringify(L?.[1]));
}
// Fără „nenegative”: limita de jos vine doar din condiții (x >= -5).
{
  const p = prob(1, (x) => x[0], [[(x) => x[0], '<=', 7], [(x) => x[0], '>=', -5]], { nonneg: false });
  const r = solve(p);
  const L = solverLimits(p, r.x);
  check(L && near(L[0].lo, -5) && near(L[0].hi, 7), 'fără nenegative: ' + JSON.stringify(L?.[0]));
}
// Cu numere întregi sau formule neliniare: fără raport de limite.
{
  const p = prob(2, (x) => x[0] + x[1], [[(x) => 2 * x[0] + 2 * x[1], '<=', 7]], { ints: [0, 1] });
  check(solverLimits(p, solve(p).x) === null, 'cu întregi: fără limite');
  const q = prob(1, (x) => -(x[0] - 3) * (x[0] - 3), [[(x) => x[0], '<=', 10]]);
  check(solverLimits(q, solve(q).x) === null, 'neliniar: fără limite');
}

// Sensibilitatea: prețurile umbră la producție (x ≤ 4: 0, 2y ≤ 12: 1,5, 3x + 2y ≤ 18: 1) și la dietă (1,5 și 0,5).
{
  const p = prob(2, (x) => 3 * x[0] + 5 * x[1], [[(x) => x[0], '<=', 4], [(x) => 2 * x[1], '<=', 12], [(x) => 3 * x[0] + 2 * x[1], '<=', 18]]);
  const r = solve(p);
  const S = solverSensitivity(p, r.x, r.obj);
  check(S && S.reduced.join() === '0,0' && S.shadow.join() === '0,1.5,1', 'producție: ' + JSON.stringify(S));
  const q = prob(2, (x) => 2 * x[0] + 3 * x[1], [[(x) => x[0] + x[1], '>=', 4], [(x) => x[0] + 3 * x[1], '>=', 6]], { goal: 'min' });
  const rq = solve(q);
  const T = solverSensitivity(q, rq.x, rq.obj);
  check(T && T.shadow.join() === '1.5,0.5', 'dietă: ' + JSON.stringify(T));
}
// Costul redus: max 3x + y cu x + y ≤ 4 → x = 4, y = 0; dacă y ar crește cu 1, profitul scade cu 2.
{
  const p = prob(2, (x) => 3 * x[0] + x[1], [[(x) => x[0] + x[1], '<=', 4]]);
  const r = solve(p);
  const S = solverSensitivity(p, r.x, r.obj);
  check(S && S.reduced.join() === '0,-2' && S.shadow.join() === '3', 'cost redus: ' + JSON.stringify(S));
  check(solverSensitivity({ ...p, goal: 'value', target: 5 }, r.x, r.obj) === null, '„egal cu”: fără sensibilitate');
}

if (bad) { console.log(`\n${bad} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');
