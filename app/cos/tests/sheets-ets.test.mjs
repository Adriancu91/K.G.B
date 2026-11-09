// Test: FORECAST.ETS, FORECAST.ETS.CONFINT, FORECAST.ETS.SEASONALITY, FORECAST.ETS.STAT (src/sheets/ets.ts + formula.ts)
// pe serii cu răspuns cunoscut: tendință + sezon exact (prognoza exactă), linie dreaptă cu un gol, sezon găsit în zgomot,
// erorile pentru cronologia neregulată și argumentele greșite. Rulare (în suite/): node tests/sheets-ets.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-ets-entry-${process.pid}.ts`), out = join(tmpdir(), `suite-ets-${process.pid}.mjs`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { evaluateAll } from ${p('src/sheets/formula.ts')};\nexport * from ${p('src/sheets/ets.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll, detectSeason, prepareSeries } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
const calc = (cells, id) => { const r = evaluateAll(cells)[id]; return r?.err ? r.text : r?.value; };

// Tendință + sezon de 4, exact: y = 10 + 2t + [5, -3, 0, -2]; timpul în A (date lunare: 1, 2, …), valorile în B.
const season = [5, -3, 0, -2];
const cells = {};
for (let t = 0; t < 16; t++) { cells[`A${t + 1}`] = String(t + 1); cells[`B${t + 1}`] = String(10 + 2 * t + season[t % 4]); }
const f = (formula) => calc({ ...cells, D1: formula }, 'D1');
check(near(f('=FORECAST.ETS(17,B1:B16,A1:A16)'), 47, 1e-6), 'prognoza exactă la pasul 17: ' + f('=FORECAST.ETS(17,B1:B16,A1:A16)'));
check(near(f('=FORECAST.ETS(18,B1:B16,A1:A16)'), 10 + 34 - 3, 1e-6), 'pasul 18 (sezonul al doilea): ' + f('=FORECAST.ETS(18,B1:B16,A1:A16)'));
check(near(f('=FORECAST.ETS(17.5,B1:B16,A1:A16)'), (47 + 41) / 2, 1e-6), 'între pași: linia dreaptă');
check(f('=FORECAST.ETS.SEASONALITY(B1:B16,A1:A16)') === 4, 'sezonul găsit: ' + f('=FORECAST.ETS.SEASONALITY(B1:B16,A1:A16)'));
check(near(f('=FORECAST.ETS.CONFINT(17,B1:B16,A1:A16)'), 0, 1e-6), 'fără erori, intervalul de încredere e 0: ' + f('=FORECAST.ETS.CONFINT(17,B1:B16,A1:A16)'));
check(f('=FORECAST.ETS.STAT(B1:B16,A1:A16,8)') === 1 && near(f('=FORECAST.ETS.STAT(B1:B16,A1:A16,7)'), 0, 1e-6), 'STAT: pasul 1, RMSE 0');
const a = f('=FORECAST.ETS.STAT(B1:B16,A1:A16,1)'), b = f('=FORECAST.ETS.STAT(B1:B16,A1:A16,2)'), g = f('=FORECAST.ETS.STAT(B1:B16,A1:A16,3)');
check(a > 0 && a < 1 && b >= 0 && b <= a && g >= 0 && g <= 1 - a, `STAT: α ${a}, β ${b}, γ ${g} în limite`);
// Ordinea din cronologie nu contează; cu sezonul 0 (fără sezon) prognoza nu mai e exactă, dar e un număr.
const rev = {};
for (let t = 0; t < 16; t++) { rev[`A${16 - t}`] = cells[`A${t + 1}`]; rev[`B${16 - t}`] = cells[`B${t + 1}`]; }
check(near(calc({ ...rev, D1: '=FORECAST.ETS(17,B1:B16,A1:A16)' }, 'D1'), 47, 1e-6), 'cronologia inversată → aceeași prognoză');
check(typeof f('=FORECAST.ETS(17,B1:B16,A1:A16,0)') === 'number', 'sezonul 0 → un număr');
// Linie dreaptă cu un gol (lipsește t = 6), cronologie din 7 în 7 zile: y = 3t + 1.
const lin = {};
let r = 1;
for (let t = 1; t <= 12; t++) { if (t === 6) continue; lin[`A${r}`] = String(45000 + 7 * t); lin[`B${r}`] = String(3 * t + 1); r++; }
check(near(calc({ ...lin, D1: '=FORECAST.ETS(45000+7*14,B1:B11,A1:A11)' }, 'D1'), 43, 1e-6), 'linie cu un gol: t = 14 → 43: ' + calc({ ...lin, D1: '=FORECAST.ETS(45000+7*14,B1:B11,A1:A11)' }, 'D1'));
check(calc({ ...lin, D1: '=FORECAST.ETS.SEASONALITY(B1:B11,A1:A11)' }, 'D1') === 1, 'linia nu are sezon (1)');
check(calc({ ...lin, D1: '=FORECAST.ETS.STAT(B1:B11,A1:A11,8)' }, 'D1') === 7, 'pasul găsit: 7 zile');
// Golul completat cu 0: seria pregătită are 0 în loc de 19.
const s0 = prepareSeries([[4, 1], [7, 2], [16, 5]], 0);
check(s0.y.join() === '4,7,0,0,16', 'completare cu 0: ' + s0.y.join());
const s1 = prepareSeries([[4, 1], [6, 1], [7, 2], [10, 3]], 1, 7);
check(s1.y.join() === '10,7,10', 'dubluri adunate (7 = SUM): ' + s1.y.join());
// Sezon de 12 găsit în zgomot (lunar, 4 ani).
let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
const noisy = Array.from({ length: 48 }, (_, t) => 100 + t + 20 * Math.sin((2 * Math.PI * t) / 12) + 3 * rnd());
check(detectSeason(noisy) === 12, 'sezonul de 12 în zgomot: ' + detectSeason(noisy));
const nc = {};
noisy.forEach((v, t) => { nc[`A${t + 1}`] = String(t + 1); nc[`B${t + 1}`] = String(v); });
const fc = calc({ ...nc, D1: '=FORECAST.ETS(49,B1:B48,A1:A48)' }, 'D1'), want = 100 + 48 + 20 * Math.sin((2 * Math.PI * 48) / 12);
const ci = calc({ ...nc, D1: '=FORECAST.ETS.CONFINT(49,B1:B48,A1:A48,0.95)' }, 'D1');
check(Math.abs(fc - want) < 5 && ci > 0 && ci < 15, `zgomot: prognoza ${fc.toFixed(2)} (fără zgomot ${want.toFixed(2)}), ±${ci.toFixed(2)}`);
const ci2 = calc({ ...nc, D1: '=FORECAST.ETS.CONFINT(60,B1:B48,A1:A48,0.95)' }, 'D1');
check(ci2 > ci, 'mai departe în viitor → interval mai larg');
// Date lunare (1 ale fiecărei luni, 2024–2025; lunile au 28–31 de zile): pasul e o lună. y = 5 + 2k → ianuarie 2026 = 53.
const serial = (y, m, d) => (Date.UTC(y, m, d) - Date.UTC(1899, 11, 30)) / 86400000;
const mon = {};
for (let k = 0; k < 24; k++) { mon[`A${k + 1}`] = String(serial(2024 + Math.floor(k / 12), k % 12, 1)); mon[`B${k + 1}`] = String(5 + 2 * k); }
const fm = (x) => calc({ ...mon, D1: x }, 'D1');
check(near(fm(`=FORECAST.ETS(${serial(2026, 0, 1)},B1:B24,A1:A24)`), 53, 1e-6), 'lunar: ianuarie 2026 → 53: ' + fm(`=FORECAST.ETS(${serial(2026, 0, 1)},B1:B24,A1:A24)`));
check(near(fm(`=FORECAST.ETS(${serial(2026, 2, 1)},B1:B24,A1:A24)`), 57, 1e-6), 'lunar: martie 2026 → 57');
check(near(fm(`=FORECAST.ETS(${serial(2026, 0, 16)},B1:B24,A1:A24)`), 53 + 2 * 15 / 31, 1e-6), 'lunar: 16 ianuarie → între 53 și 55');
check(fm('=FORECAST.ETS.STAT(B1:B24,A1:A24,8)') === 1, 'lunar: pasul e 1 (lună)');
const me = {};
for (let k = 0; k < 24; k++) { me[`A${k + 1}`] = String(serial(2024, k + 1, 0)); me[`B${k + 1}`] = String(5 + 2 * k); }
check(near(calc({ ...me, D1: `=FORECAST.ETS(${serial(2026, 1, 0)},B1:B24,A1:A24)` }, 'D1'), 53, 1e-6), 'sfârșit de lună: 31.01.2026 → 53');
// Erori.
check(calc({ A1: '1', A2: '2', A3: '3.5', B1: '1', B2: '2', B3: '3', D1: '=FORECAST.ETS(5,B1:B3,A1:A3)' }, 'D1') === '#NUM!', 'cronologie neregulată → #NUM!');
check(f('=FORECAST.ETS(0,B1:B16,A1:A16)') === '#NUM!', 'ținta înainte de început → #NUM!');
check(f('=FORECAST.ETS(17,B1:B16,A1:A15)') === '#N/A', 'zone de mărimi diferite → #N/A');
check(f('=FORECAST.ETS.CONFINT(17,B1:B16,A1:A16,1.5)') === '#NUM!', 'încredere 1,5 → #NUM!');
check(f('=FORECAST.ETS.STAT(B1:B16,A1:A16,9)') === '#NUM!', 'STAT 9 → #NUM!');
check(f('=FORECAST.ETS(17,B1:B16,A1:A16,10)') === '#NUM!', 'sezon de 10 la 16 valori → #NUM!');
console.log(bad ? `${bad} GRESELI` : 'Toate testele FORECAST.ETS trec');
process.exit(bad ? 1 : 0);
