// Test: 🧮 Rezolvitor → metoda Evolutivă (src/sheets/solver.ts): formule cu salturi (unde metoda obișnuită rămâne pe loc),
// celule 0 sau 1, limitele luate din condiții și metoda ținută minte în model și în numele din .xlsx.
// Rulare (în suite/): node tests/sheets-solver-evo.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

const entry = join(tmpdir(), `suite-solverevo-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-solverevo-${process.pid}.mjs`);
writeFileSync(entry, `export * from ${JSON.stringify(join(process.cwd(), 'src/sheets/solver.ts').split(String.fromCharCode(92)).join('/'))};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { solve, solverBounds, cleanSolver, solverNames, solverFromNames } = await import(pathToFileURL(out).href);
rmSync(entry, { force: true }); rmSync(out, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
// measure: [obiectiv, stânga1, dreapta1, ...]
const prob = (n, obj, cons, extra = {}) => ({
  n, x0: new Array(n).fill(0), ops: cons.map((c) => c[1]), ints: [], bins: [], nonneg: true, goal: 'max',
  measure: (x) => [obj(x), ...cons.flatMap(([l, , r]) => [l(x), r(x)])], ...extra,
});

// 1) Prag (ca un DACĂ): premiul de 50 vine abia de la 37 în sus, iar fiecare unitate costă 0,1. Cel mai bun: x = 37.
const step = prob(1, (x) => (x[0] >= 37 ? 50 : 0) - 0.1 * x[0], [[(x) => x[0], '<=', () => 100]]);
const auto = solve(step);
const evo = solve({ ...step, method: 'evo' });
console.log('automată:', auto.x, auto.obj, '| evolutivă:', evo.x, evo.obj);
check(evo.status === 'optim' && Math.abs(evo.x[0] - 37) < 0.05 && evo.obj > 46.2, `prag: evolutiva găsește x ≈ 37 (${evo.x[0]}, obiectiv ${evo.obj})`);
check(auto.obj < evo.obj, 'prag: metoda obișnuită rămâne mai jos (de aceea e nevoie de cea evolutivă)');

// 2) Rotunjire în trepte: venit = ROTUNJIRE.JOS(x / 10) × 30 − x, x întreg între 0 și 95 → cel mai bun x = 90 (270 − 90 = 180).
const stairs = prob(1, (x) => Math.floor(x[0] / 10) * 30 - x[0], [[(x) => x[0], '<=', () => 95]], { ints: [0] });
const s = solve({ ...stairs, method: 'evo' });
check(s.status === 'optim' && s.x[0] === 90 && s.obj === 180, `trepte: x = 90, obiectiv 180 (${s.x[0]}, ${s.obj})`);

// 3) Rucsac cu 5 obiecte 0 sau 1: valoarea cea mai mare cu greutatea cel mult 10 → 21.
const val = [10, 13, 7, 8, 4], wt = [5, 6, 3, 4, 2];
const sack = prob(5, (x) => x.reduce((t, v, i) => t + v * val[i], 0), [[(x) => x.reduce((t, v, i) => t + v * wt[i], 0), '<=', () => 10]], { bins: [0, 1, 2, 3, 4], method: 'evo' });
const k = solve(sack);
check(k.status === 'optim' && k.obj === 21 && k.x.every((v) => v === 0 || v === 1), `rucsac: valoarea 21 cu obiecte 0 / 1 (${k.x.join(',')} → ${k.obj})`);

// 4) Tabel de prețuri pe praguri (căutare): prețul pe bucată scade la 50 și la 100 de bucăți; bugetul e 1000 → cât mai multe bucăți.
const unit = (q) => (q >= 100 ? 6 : q >= 50 ? 8 : 10);
const buy = prob(1, (x) => x[0], [[(x) => x[0] * unit(x[0]), '<=', () => 1000]], { ints: [0], x0: [10] });
const b = solve({ ...buy, method: 'evo' });
check(b.status === 'optim' && b.x[0] === 166, `prețuri pe praguri: 166 de bucăți (${b.x[0]})`);

// 5) Valoare cerută: x² + DACĂ(x > 5; 10; 0) = 46 → x = 6.
const target = prob(1, (x) => x[0] * x[0] + (x[0] > 5 ? 10 : 0), [], { goal: 'value', target: 46, method: 'evo' });
const t = solve(target);
check(t.status === 'optim' && Math.abs(t.x[0] - 6) < 1e-4, `egal cu 46: x = 6 (${t.x[0]})`);

// 6) Limitele din condiții: 5 ≤ A ≤ 40, B fără limite (fereastră în jurul valorii de pornire), C ≥ 0 (nenegativ).
const lim = solverBounds(prob(3, (x) => x[0], [[(x) => x[0], '<=', () => 40], [(x) => x[0], '>=', () => 5], [(x) => x[0] + x[1], '<=', () => 70]], { nonneg: false, x0: [10, 3, 0] }));
check(lim.lo[0] === 5 && lim.hi[0] === 40, `limitele lui A: 5…40 (${lim.lo[0]}…${lim.hi[0]})`);
check(lim.lo[1] < 3 && lim.hi[1] > 3 && Number.isFinite(lim.lo[1]) && Number.isFinite(lim.hi[1]), `B are o fereastră finită în jurul lui 3 (${lim.lo[1]}…${lim.hi[1]})`);
const lim2 = solverBounds(prob(1, (x) => x[0], []));
check(lim2.lo[0] === 0 && lim2.hi[0] > 0, 'nenegativ: limita de jos 0');

// 7) Același model dă același rezultat (sămânță fixă).
const again = solve({ ...step, method: 'evo' });
check(again.x[0] === evo.x[0] && again.obj === evo.obj, 'aceeași soluție la a doua rulare');

// 8) Metoda ținută minte: în model (.ssheet) și în .xlsx (solver_eng = 3), citită înapoi.
const m = cleanSolver({ obj: 'B5', goal: 'max', target: '', vars: 'B1:B2', cons: [], nonneg: true, method: 'evo' });
check(m?.method === 'evo', 'modelul păstrează metoda evolutivă');
check(cleanSolver({ obj: 'B5', vars: 'B1', method: 'altceva' })?.method === undefined, 'o metodă necunoscută = automată');
const names = solverNames(m, 'Foaia1');
check(names.find((n) => n.name === 'solver_eng')?.ref === '3', 'solver_eng = 3 în .xlsx');
const back = solverFromNames(Object.fromEntries(names.map((n) => [n.name, n.ref])));
check(back?.method === 'evo', 'citit înapoi din .xlsx: evolutivă');
check(solverFromNames(Object.fromEntries(solverNames({ ...m, method: undefined }, 'Foaia1').map((n) => [n.name, n.ref])))?.method === undefined, 'automată rămâne automată');

console.log(bad ? `\n${bad} GREȘELI` : '\nToate verificările au trecut.');
process.exit(bad ? 1 : 0);
