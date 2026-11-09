// Test: Analiza datelor în Sheets (analysis.ts): corelație, covarianță, regresie, histogramă, comparate cu valori calculate de mână.
// Rulare (în suite/): node tests/sheets-analysis.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-analysis-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-analysis-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/sheets/analysis.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { rowsOf, correlation, covariance, regress, regressionTable, fRightTail, autoBins, histogram, anovaOne, fTest, fInvRight, tTest, movingAverage, expSmoothing, anovaTwo, anovaRep, rankPercentile, zTest, sample, seededRandom, randomNumbers, fourier } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
const L = (i) => String.fromCharCode(65 + i);

// Distribuția F: valori din tabele (F 0,05 pentru 2 și 10 grade = 4,10; pentru 1 și 3 = 10,13).
check(near(fRightTail(4.102821, 2, 10), 0.05, 1e-4), 'F(2,10) = 4,1028 → 0,05: ' + fRightTail(4.102821, 2, 10));
check(near(fRightTail(10.127964, 1, 3), 0.05, 1e-4), 'F(1,3) = 10,128 → 0,05: ' + fRightTail(10.127964, 1, 3));

// Rândurile: capul de tabel, un rând cu text sărit, rândurile goale ignorate.
const grid = [['X', 'Y'], [1, 2], [2, 4], [null, null], [3, 5], ['n/a', 7], [4, 4], [5, 5]];
const { names, rows, dropped } = rowsOf(grid, L);
check(names.join('|') === 'X|Y' && rows.length === 5 && dropped === 1, `rândurile: ${names} · ${rows.length} complete · ${dropped} sărit`);
check(rowsOf([[1, 2], [3, 4]], L).names.join('|') === 'Coloana A|Coloana B', 'fără cap de tabel: Coloana A, Coloana B');

// Corelația și covarianța pentru X = 1…5, Y = 2, 4, 5, 4, 5: r = √0,6, cov = 6 / 5.
const cor = correlation(names, rows), cov = covariance(names, rows);
check(cor[1][1] === 1 && cor[1][2] === '' && near(cor[2][1], Math.sqrt(0.6)), 'corelația X–Y = 0,7746: ' + cor[2][1]);
check(near(cov[2][1], 1.2) && near(cov[1][1], 2) && near(cov[2][2], 1.2), `covarianța: ${cov[2][1]}, var X ${cov[1][1]}, var Y ${cov[2][2]}`);

// Regresia simplă: y = 2,2 + 0,6x, R² = 0,6, SSE 2,4, F = 4,5, se(b1) = √0,08.
const reg = regress(rows);
check(near(reg.coef[0], 2.2) && near(reg.coef[1], 0.6), `coeficienții: ${reg.coef}`);
check(near(reg.r2, 0.6) && near(reg.adjR2, 0.4666667) && near(reg.sse, 2.4) && near(reg.ssr, 3.6), `R² ${reg.r2}, ajustat ${reg.adjR2}`);
check(near(reg.f, 4.5) && near(reg.se[1], Math.sqrt(0.08)) && near(reg.t[1], 0.6 / Math.sqrt(0.08)), `F ${reg.f}, se ${reg.se[1]}, t ${reg.t[1]}`);
check(near(reg.pF, reg.p[1], 1e-9) && near(reg.p[1], 0.1240, 2e-3), `valoarea P a pantei = semnificația F: ${reg.p[1]}`);
check(near(reg.lo[1], 0.6 - 3.182446 * Math.sqrt(0.08), 1e-5), `intervalul 95% al pantei începe la ${reg.lo[1]}`);
const tab = regressionTable(names, reg);
check(tab.every((r) => r.length === 7) && tab.some((r) => r[0] === 'Interceptare') && tab.some((r) => r[0] === 'ANOVA'), 'tabelul: 7 coloane, ANOVA, Interceptare');

// Regresia multiplă exactă: y = 1 + 2·a + 3·b.
const exact = [[1, 0], [0, 1], [2, 1], [1, 3], [4, 2], [3, 5]].map(([a, b]) => [a, b, 1 + 2 * a + 3 * b]);
const r2 = regress(exact);
check(near(r2.coef[0], 1) && near(r2.coef[1], 2) && near(r2.coef[2], 3) && near(r2.r2, 1), `multiplă: ${r2.coef.map((x) => x.toFixed(6))}`);
// Cazuri care nu se pot calcula: prea puține rânduri, coloane identice.
check(regress([[1, 2], [2, 3]]) === null, 'două rânduri pentru o dreaptă: nu se poate (fără grade de libertate)');
check(regress([[1, 1, 2], [2, 2, 3], [3, 3, 5], [4, 4, 4]]) === null, 'două coloane X identice: nu se poate');

// Histograma: 1…10 → 5 clase cu pasul 2, câte 2 valori în fiecare.
const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
check(autoBins(v).join(',') === '2,4,6,8,10', 'clasele: ' + autoBins(v));
const h = histogram('Note', v);
check(h.length === 6 && h.slice(1).every((r) => r[1] === 2) && near(h[5][2], 1), 'frecvențele: ' + h.slice(1).map((r) => r[1]));
const h2 = histogram('Note', [1, 5, 50], [10, 20]);
check(h2[1][1] === 2 && h2[2][1] === 0 && h2[3][0] === 'Mai mult' && h2[3][1] === 1, 'clasa „Mai mult”: ' + JSON.stringify(h2));
check(autoBins([3, 3, 3]).join(',') === '3', 'toate valorile egale: o clasă');
const b = autoBins([0.12, 0.5, 0.33, 0.91, 0.07, 0.64]);
check(b[b.length - 1] >= 0.91 && b.every((x) => String(x).length < 8), 'clasele zecimale sunt rotunde: ' + b);

// ANOVA cu un factor: A = 1, 2, 3; B = 4, 5, 6; C = 7, 8, 9 → SSB 54, SSW 6, F 27, P = (1 + 2·27/6)^−3 = 0,001, F critic(2, 6) = 5,143253.
const an = anovaOne([{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [4, 5, 6] }, { name: 'C', values: [7, 8, 9] }]);
const btw = an.find((r) => r[0] === 'Între grupe'), win = an.find((r) => r[0] === 'În interiorul grupelor'), tot = an.find((r) => r[0] === 'Total');
check(near(btw[1], 54) && btw[2] === 2 && near(btw[4], 27) && near(btw[5], 0.001, 1e-6) && near(btw[6], 5.143253, 1e-5), 'ANOVA: între grupe ' + btw.slice(1).join(' · '));
check(near(win[1], 6) && win[2] === 6 && near(win[3], 1) && near(tot[1], 60) && tot[2] === 8, 'ANOVA: în interiorul grupelor și total');
check(an.find((r) => r[0] === 'B')?.[3] === 5 && an.every((r) => r.length === 7), 'ANOVA: rezumatul pe grupe (media lui B = 5)');
check(anovaOne([{ name: 'A', values: [1] }, { name: 'B', values: [] }]) === null, 'ANOVA: o singură grupă nu se poate');
// Testul F: x = 1…5 (varianța 2,5), y = 2, 4, …, 10 (varianța 10) → F = 0,25, coada din stânga; F critic stânga(4, 4) = 1 / 6,388233.
const ft = fTest({ name: 'X', values: [1, 2, 3, 4, 5] }, { name: 'Y', values: [2, 4, 6, 8, 10] });
const fv = ft.find((r) => r[0] === 'F')[1], fp = ft.find((r) => r[0].startsWith('P('))[1], fc = ft.find((r) => r[0].startsWith('F critic'))[1];
check(near(fv, 0.25) && near(fc, 1 / 6.388233, 1e-5) && fp > 0 && fp < 0.5 && near(fp, 1 - fRightTail(0.25, 4, 4)), `testul F: F ${fv}, P ${fp}, F critic ${fc}`);
check(near(fInvRight(0.05, 4, 4), 6.388233, 1e-5) && near(fInvRight(0.05, 2, 10), 4.102821, 1e-5), 'F critic din tabele (4, 4) și (2, 10)');


// Testele t: varianțe egale / diferite pentru 1-2-3 și 4-5-6 (t = -3,674235, 4 grade), pe perechi pentru 1-2-3-4 și 2-4-5-8.
{
  const A = { name: 'A', values: [1, 2, 3] }, B = { name: 'B', values: [4, 5, 6] };
  const get = (t, k) => t.find((r) => r[0] === k)?.[1];
  const eq = tTest(A, B, 'equal');
  check(eq[0][0].includes('varianțe egale') && near(get(eq, 'Varianța comună'), 1), 'testul t (egale): titlul și varianța comună 1');
  check(near(get(eq, 'Statistica t'), -3.674235) && get(eq, 'Grade de libertate') === 4, 'testul t (egale): t = -3,674235, 4 grade: ' + get(eq, 'Statistica t'));
  check(near(get(eq, 't critic două cozi'), 2.776445, 1e-5) && near(get(eq, 't critic o coadă'), 2.131847, 1e-5), 'testul t: t critic 2,776445 / 2,131847');
  check(near(get(eq, 'P(T<=t) două cozi'), 2 * get(eq, 'P(T<=t) o coadă')) && near(get(eq, 'P(T<=t) două cozi'), 0.021312, 1e-3), 'testul t: P două cozi ≈ 0,0213: ' + get(eq, 'P(T<=t) două cozi'));
  const un = tTest(A, { name: 'B', values: [4, 5, 6, 10] }, 'unequal');
  // q1 = 1/3, q2 = (20,75/3)/4 = 1,7292 → df Welch = 4,04… → 4
  check(get(un, 'Grade de libertate') === 4 && !un.some((r) => r[0] === 'Varianța comună'), 'testul t (diferite): grade Welch rotunjite = 4');
  check(near(get(un, 'Statistica t'), (2 - 6.25) / Math.sqrt(1 / 3 + 20.75 / 12)), 'testul t (diferite): t = ' + get(un, 'Statistica t'));
  const pr = tTest({ name: 'Înainte', values: [1, 2, 3, 4] }, { name: 'După', values: [2, 4, 5, 8] }, 'paired');
  check(near(get(pr, 'Statistica t'), -3.576237) && get(pr, 'Grade de libertate') === 3, 'testul t pe perechi: t = -3,576237, 3 grade: ' + get(pr, 'Statistica t'));
  check(near(get(pr, 'Corelația Pearson'), 0.981156, 1e-5), 'testul t pe perechi: corelația ' + get(pr, 'Corelația Pearson'));
  check(tTest(A, { name: 'B', values: [1, 2] }, 'paired') === null && tTest(A, { name: 'B', values: [1] }, 'equal') === null, 'testul t: perechi inegale / prea puține valori → nimic');
}

// Media mobilă pe 3 pentru 1…5 → #N/A, #N/A, 2, 3, 4; eroarea standard 1 pe ultimul rând.
{
  const m = movingAverage('V', [1, 2, 3, 4, 5], 3);
  check(m.length === 6 && m[1][1] === '#N/A' && m[2][1] === '#N/A' && m[3][1] === 2 && m[5][1] === 4, 'media mobilă: ' + m.map((r) => r[1]).join(' | '));
  check(m[4][2] === '#N/A' && near(m[5][2], 1), 'media mobilă: eroarea standard 1 pe ultimul rând: ' + m[5][2]);
  check(movingAverage('V', [1, 2], 3) === null, 'media mobilă: prea puține valori → nimic');
  // Netezire cu amortizarea 0,3 pentru 10, 20, 30, 40 → #N/A, 10, 17, 26,1; eroarea √(462,21 / 3).
  const e = expSmoothing('V', [10, 20, 30, 40], 0.3);
  check(e[1][1] === '#N/A' && e[2][1] === 10 && near(e[3][1], 17) && near(e[4][1], 26.1), 'netezirea exponențială: ' + e.map((r) => r[1]).join(' | '));
  check(near(e[4][2], Math.sqrt(462.21 / 3)) && e[3][2] === '#N/A', 'netezirea: eroarea standard ' + e[4][2]);
  check(e[0][1].includes('0,3') && expSmoothing('V', [1, 2], 1) === null, 'netezirea: amortizarea în titlu; amortizare 1 → nimic');
}

// ANOVA cu doi factori: 3 magazine × 3 luni [[1,2,3],[2,4,6],[3,5,7]] → SS rânduri 14, coloane 16,667, eroare 1,333; F 21 și 25.
{
  const g = [[null, 'Ian', 'Feb', 'Mar'], ['M1', 1, 2, 3], ['M2', 2, 4, 6], ['M3', 3, 5, 7], ['M4', 1, 'x', 2]];
  const { table, dropped } = anovaTwo(g, L);
  const row = (k) => table.find((r) => r[0] === k);
  check(dropped === 1 && row('M1')[3] === 2 && row('Feb')[1] === 3 && near(row('Mar')[3], 16 / 3), 'ANOVA 2 factori: rezumatul pe rânduri și coloane, rândul cu text sărit');
  check(near(row('Rânduri')[1], 14) && row('Rânduri')[2] === 2 && near(row('Rânduri')[4], 21), 'ANOVA 2 factori: rânduri SS 14, F 21: ' + row('Rânduri')[4]);
  check(near(row('Coloane')[1], 50 / 3) && near(row('Coloane')[4], 25) && near(row('Eroare')[1], 4 / 3) && row('Eroare')[2] === 4, 'ANOVA 2 factori: coloane F 25, eroarea 1,333 cu 4 grade');
  check(near(row('Rânduri')[6], 6.944272, 1e-5) && near(row('Total')[1], 32) && row('Total')[2] === 8, 'ANOVA 2 factori: F critic 6,944272, total 32 cu 8 grade');
  check(anovaTwo([[1, 2]], L) === null, 'ANOVA 2 factori: un singur rând → nimic');
}

// ANOVA cu doi factori cu replicare: 2 blocuri × 2 coloane × 2 rânduri. SS rânduri 18, coloane 72, interacțiune 8, în interior 8 (4 grade), total 106.
{
  const g = [['', 'S1', 'S2'], ['A1', 1, 5], [null, 3, 7], ['A2', 2, 10], [null, 4, 12]];
  const { table } = anovaRep(g, L);
  const row = (k) => table.find((r) => r[0] === k);
  check(near(row('Rânduri (eșantion)')[1], 18) && near(row('Rânduri (eșantion)')[4], 9) && near(row('Coloane')[1], 72) && near(row('Coloane')[4], 36), 'ANOVA cu replicare: rânduri SS 18 F 9, coloane SS 72 F 36');
  check(near(row('Interacțiune')[1], 8) && row('Interacțiune')[2] === 1 && near(row('Interacțiune')[4], 4) && near(row('În interiorul grupelor')[1], 8) && row('În interiorul grupelor')[2] === 4, 'ANOVA cu replicare: interacțiune 8 (F 4), în interior 8 cu 4 grade');
  const tot = table.findLast((r) => r[0] === 'Total');
  check(near(tot[1], 106) && tot[2] === 7 && near(row('Interacțiune')[6], 7.708647, 1e-5), 'ANOVA cu replicare: total 106 cu 7 grade, F critic 7,7086');
  const iA2 = table.findIndex((r) => r[0] === 'A2');
  check(table[iA2 + 1][0] === 'Numărul' && table[iA2 + 1][1] === 2 && table[iA2 + 3][2] === 11 && table[iA2 + 3][3] === 7, 'ANOVA cu replicare: rezumatul A2 (media S2 = 11, total 7)');
  const noLab = anovaRep([['S1', 'S2'], [1, 5], [3, 7], [2, 10], [4, 12]], L, 2);
  check(near(noLab.table.find((r) => r[0] === 'Interacțiune')[1], 8), 'ANOVA cu replicare: fără etichete, cu 2 rânduri pe grupă');
  check(anovaRep([['S1', 'S2'], [1, 5], [3, 7]], L).error === 'labels', 'ANOVA cu replicare: fără etichete și fără număr → cere numărul');
  check(anovaRep([['', 'S1', 'S2'], ['A1', 1, 5], [null, 3, 7], ['A2', 2, 10]], L).error === 'shape', 'ANOVA cu replicare: blocuri inegale → refuzat');
  check(anovaRep([['', 'S1', 'S2'], ['A1', 1, 5], [null, 'x', 7], ['A2', 2, 10], [null, 4, 12]], L).error === 'text', 'ANOVA cu replicare: text în date → refuzat');
}

// Generatorul de numere aleatoare: aceeași sămânță → aceleași numere; fiecare distribuție are media și valorile așteptate.
{
  const r1 = randomNumbers({ dist: 'uniform', vars: 2, count: 5, a: 10, b: 20 }, seededRandom(42));
  const r2 = randomNumbers({ dist: 'uniform', vars: 2, count: 5, a: 10, b: 20 }, seededRandom(42));
  check(r1.length === 5 && r1[0].length === 2 && JSON.stringify(r1) === JSON.stringify(r2) && r1.flat().every((x) => x >= 10 && x < 20), 'aleator: uniformă 10–20, 5 × 2, aceeași sămânță dă aceleași numere');
  const avg = (t) => { const v = t.flat(); return v.reduce((a, b) => a + b, 0) / v.length; };
  const nr = randomNumbers({ dist: 'normal', vars: 1, count: 20000, a: 50, b: 10 }, seededRandom(7));
  const sd = Math.sqrt(nr.flat().reduce((a, x) => a + (x - 50) ** 2, 0) / 20000);
  check(Math.abs(avg(nr) - 50) < 0.5 && Math.abs(sd - 10) < 0.5, `aleator: normală media ${avg(nr).toFixed(2)}, abaterea ${sd.toFixed(2)}`);
  const be = randomNumbers({ dist: 'bernoulli', vars: 1, count: 20000, a: 0.3 }, seededRandom(1));
  check(be.flat().every((x) => x === 0 || x === 1) && Math.abs(avg(be) - 0.3) < 0.02, 'aleator: Bernoulli 0 / 1, media ' + avg(be));
  const bi = randomNumbers({ dist: 'binomial', vars: 1, count: 5000, a: 0.5, b: 10 }, seededRandom(3));
  check(bi.flat().every((x) => Number.isInteger(x) && x >= 0 && x <= 10) && Math.abs(avg(bi) - 5) < 0.15, 'aleator: binomială 0–10, media ' + avg(bi));
  const po = randomNumbers({ dist: 'poisson', vars: 1, count: 5000, a: 4 }, seededRandom(5));
  const pb = randomNumbers({ dist: 'poisson', vars: 1, count: 200, a: 1200 }, seededRandom(6));
  check(Math.abs(avg(po) - 4) < 0.15 && Math.abs(avg(pb) - 1200) < 10, `aleator: Poisson λ 4 → ${avg(po)}, λ 1200 → ${avg(pb)}`);
  const di = randomNumbers({ dist: 'discrete', vars: 1, count: 4000, table: [[1, 0.25], [5, 0.75]] }, seededRandom(9));
  check(di.flat().every((x) => x === 1 || x === 5) && Math.abs(avg(di) - 4) < 0.1, 'aleator: discretă 1 / 5, media ' + avg(di));
  const pa = randomNumbers({ dist: 'patterned', vars: 2, count: 0, from: 1, to: 3, step: 1, repNum: 2, repSeq: 2 });
  check(pa.map((r) => r[0]).join() === '1,1,2,2,3,3,1,1,2,2,3,3' && pa[11][1] === 3, 'aleator: după un model 1, 1, 2, 2, 3, 3 de două ori');
  check(randomNumbers({ dist: 'patterned', vars: 1, count: 0, from: 1, to: 0, step: 0.25 }).map((r) => r[0]).join() === '1,0.75,0.5,0.25,0', 'aleator: model descrescător cu pasul 0,25');
  check(typeof randomNumbers({ dist: 'discrete', vars: 1, count: 3, table: [[1, 0.5], [2, 0.4]] }) === 'string' && typeof randomNumbers({ dist: 'bernoulli', vars: 1, count: 3, a: 2 }) === 'string' && typeof randomNumbers({ dist: 'uniform', vars: 0, count: 3, a: 0, b: 1 }) === 'string', 'aleator: suma probabilităților ≠ 1, p = 2, 0 variabile → mesaj');
}

// Analiza Fourier: [1, 2, 3, 4] → 10, -2+2i, -2, -2-2i; inversa dă înapoi valorile; 3 valori → mesaj.
{
  const f = fourier('X', [1, 2, 3, 4]);
  check(f.length === 5 && f[0][0] === 'Fourier (X)' && f.slice(1).map((r) => r[0]).join('|') === '10|-2+2i|-2|-2-2i', 'Fourier: 1, 2, 3, 4 → ' + f.slice(1).map((r) => r[0]).join(' | '));
  const back = fourier('Y', ['10', '-2+2i', '-2', '-2-2i'], true);
  check(back.slice(1).map((r) => r[0]).join('|') === '1|2|3|4', 'Fourier invers → 1, 2, 3, 4: ' + back.slice(1).map((r) => r[0]).join(' | '));
  const sq = fourier('S', [1, 0, 0, 0, 0, 0, 0, 0]);
  check(sq.slice(1).every((r) => r[0] === '1'), 'Fourier: impulsul → toate 1');
  const cos = fourier('C', Array.from({ length: 8 }, (_, i) => Math.cos((2 * Math.PI * i) / 8)));
  check(cos[2][0] === '4' && cos[8][0] === '4' && cos[1][0] === '0' && cos[3][0] === '0', 'Fourier: cosinusul are 4 pe frecvența 1 și 7: ' + cos.slice(1).map((r) => r[0]).join(' | '));
  check(typeof fourier('Z', [1, 2, 3]) === 'string' && typeof fourier('Z', [1, 'abc']) === 'string', 'Fourier: 3 valori sau text → mesaj');
}

// Rang și percentilă pentru 10, 30, 20, 30 → 30 (2) și 30 (4) au rangul 1 și 66,6%, 20 → 3 și 33,3%, 10 → 4 și 0%.
{
  const t = rankPercentile('Note', [10, 30, 20, 30]);
  check(t.length === 5 && t[0].join() === 'Punctul,Note,Rangul,Procentul', 'rang: capul de tabel');
  check(t.slice(1).map((r) => r.join(' ')).join(' | ') === '2 30 1 0.666 | 4 30 1 0.666 | 3 20 3 0.333 | 1 10 4 0', 'rang: ' + t.slice(1).map((r) => r.join(' ')).join(' | '));
  check(rankPercentile('x', [5]) === null, 'rang: o singură valoare → nimic');
}
// Testul z: X = 1…5, Y = 2, 4, 5, 4, 5 → medii 3 și 4, varianțe 2,5 și 1,5, z = -1/√0,8 = -1,118034, P o coadă 0,131776.
{
  const t = zTest({ name: 'X', values: [1, 2, 3, 4, 5] }, { name: 'Y', values: [2, 4, 5, 4, 5] });
  const row = (n) => t.find((r) => r[0] === n);
  check(row('Media')[1] === 3 && row('Media')[2] === 4 && near(row('Varianța cunoscută')[1], 2.5) && near(row('Varianța cunoscută')[2], 1.5), 'testul z: mediile și varianțele');
  check(near(row('z')[1], -1.118034), 'testul z: z = ' + row('z')[1]);
  check(near(row('P(Z<=z) o coadă')[1], 0.131776, 1e-5) && near(row('P(Z<=z) două cozi')[1], 0.263552, 1e-5), 'testul z: P o coadă / două cozi = ' + row('P(Z<=z) o coadă')[1]);
  check(near(row('z critic o coadă')[1], 1.644854, 1e-6) && near(row('z critic două cozi')[1], 1.959964, 1e-6), 'testul z: z critic 1,644854 și 1,959964');
  check(zTest({ name: 'a', values: [1] }, { name: 'b', values: [1, 2] }) === null, 'testul z: o singură valoare → nimic');
}

// Eșantionarea: periodic din 3 în 3 pe 1…10 → 3, 6, 9; aleator 4 din 10 → 4 valori diferite, cu rândul corect.
{
  const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const p = sample('V', v, 'periodic', 3);
  check(p[0][0] === 'Eșantion (V)' && p.slice(1).map((r) => r.join(':')).join(' ') === '30:3 60:6 90:9', 'eșantion periodic: ' + p.slice(1).map((r) => r.join(':')).join(' '));
  check(sample('V', v, 'periodic', 11) === null && sample('V', v, 'periodic', 0) === null, 'eșantion periodic: pas prea mare / 0 → nimic');
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r = sample('V', v, 'random', 4, rnd).slice(1);
  check(r.length === 4 && new Set(r.map((x) => x[1])).size === 4 && r.every(([val, i]) => v[i - 1] === val), 'eșantion aleator: 4 valori diferite, fiecare cu rândul ei: ' + r.map((x) => x.join(':')).join(' '));
  check(sample('V', v, 'random', 50, rnd).length === 11, 'eșantion aleator: mai multe decât valorile → toate');
}
console.log(bad ? `${bad} GRESELI` : 'Toate testele de analiză trec');
process.exit(bad ? 1 : 0);
