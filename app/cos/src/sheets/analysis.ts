// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 📈 Analiza datelor (ca Data Analysis din Excel): corelație, covarianță, regresie liniară (cu tabelul ANOVA și valorile P)
// și histogramă cu clase automate. Fiecare funcție dă un tabel (rânduri de text / numere) pus apoi într-o foaie nouă.
// Corelația, covarianța și regresia folosesc doar rândurile în care toate coloanele alese au numere.
// Testat în tests/sheets-analysis.test.mjs.
import { betaInc, tInv2T, tTwoTail } from './descstats';
import { complexOf, complexText, normSDist, normSInv } from './formula';

export type Cell = number | string | null;
export type Table = (string | number)[][];

/** Numele coloanelor (din capul de tabel, dacă primul rând are text) și rândurile complete (doar numere). */
export function rowsOf(grid: Cell[][], colLetter: (i: number) => string): { names: string[]; rows: number[][]; dropped: number } {
  if (!grid.length) return { names: [], rows: [], dropped: 0 };
  const width = Math.max(...grid.map((r) => r.length));
  const head = grid[0].some((x) => typeof x === 'string' && x.trim() !== '' && !Number.isFinite(Number(x.replace(',', '.'))));
  const names: string[] = [];
  for (let c = 0; c < width; c++) names.push(head && typeof grid[0][c] === 'string' && String(grid[0][c]).trim() ? String(grid[0][c]).trim() : `Coloana ${colLetter(c)}`);
  const rows: number[][] = [];
  let dropped = 0;
  for (let r = head ? 1 : 0; r < grid.length; r++) {
    const row = grid[r];
    if (row.every((x) => x === null || String(x).trim() === '')) continue;
    if (row.length === width && row.every((x) => typeof x === 'number' && Number.isFinite(x))) rows.push(row as number[]);
    else dropped++;
  }
  return { names, rows, dropped };
}

const col = (rows: number[][], j: number) => rows.map((r) => r[j]);
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Matricea de corelație Pearson (doar jumătatea de jos, ca în tabelul clasic; diagonala = 1). */
export function correlation(names: string[], rows: number[][]): Table {
  const k = names.length, m = names.map((_, j) => mean(col(rows, j)));
  const out: Table = [['', ...names]];
  for (let i = 0; i < k; i++) {
    const line: (string | number)[] = [names[i]];
    for (let j = 0; j < k; j++) {
      if (j > i) { line.push(''); continue; }
      if (i === j) { line.push(1); continue; }
      let sxy = 0, sxx = 0, syy = 0;
      for (const r of rows) { const dx = r[i] - m[i], dy = r[j] - m[j]; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
      line.push(sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : '#DIV/0!');
    }
    out.push(line);
  }
  return out;
}

/** Matricea de covarianță (a populației: împărțire la n, ca în instrumentul clasic de analiză), jumătatea de jos. */
export function covariance(names: string[], rows: number[][]): Table {
  const k = names.length, n = rows.length, m = names.map((_, j) => mean(col(rows, j)));
  const out: Table = [['', ...names]];
  for (let i = 0; i < k; i++) {
    const line: (string | number)[] = [names[i]];
    for (let j = 0; j < k; j++) {
      if (j > i) { line.push(''); continue; }
      let s = 0;
      for (const r of rows) s += (r[i] - m[i]) * (r[j] - m[j]);
      line.push(s / n);
    }
    out.push(line);
  }
  return out;
}

/** Inversa unei matrice simetrice mici (eliminare Gauss-Jordan cu pivot); null dacă e singulară. */
function invert(a: number[][]): number[][] | null {
  const n = a.length, m = a.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    const scale = Math.max(1, ...m.map((r) => Math.abs(r[c])));
    if (Math.abs(m[p][c]) < 1e-12 * scale) return null;
    [m[c], m[p]] = [m[p], m[c]];
    const d = m[c][c];
    for (let j = 0; j < 2 * n; j++) m[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c && m[r][c] !== 0) { const f = m[r][c]; for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[c][j]; }
  }
  return m.map((r) => r.slice(n));
}

/** Probabilitatea cozii din dreapta a distribuției F (d1, d2) pentru valoarea f (ca DISTF.RT). */
export const fRightTail = (f: number, d1: number, d2: number) => (f <= 0 ? 1 : betaInc(d2 / (d2 + d1 * f), d2 / 2, d1 / 2));

export interface Regression {
  coef: number[]; se: number[]; t: number[]; p: number[]; lo: number[]; hi: number[];
  r2: number; adjR2: number; multipleR: number; stdErr: number; n: number;
  ssr: number; sse: number; sst: number; dfr: number; dfe: number; f: number; pF: number;
}

/** Regresia liniară prin cele mai mici pătrate: y = b0 + b1·x1 + … (ultima coloană e y). null dacă nu se poate calcula. */
export function regress(rows: number[][], confidence = 0.95): Regression | null {
  const n = rows.length, k = rows[0]?.length ? rows[0].length - 1 : 0, p = k + 1;
  if (k < 1 || n <= p) return null;
  const X = rows.map((r) => [1, ...r.slice(0, k)]), y = rows.map((r) => r[k]);
  const xtx = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((a, r) => a + r[i] * r[j], 0)));
  const inv = invert(xtx);
  if (!inv) return null;
  const xty = Array.from({ length: p }, (_, i) => X.reduce((a, r, q) => a + r[i] * y[q], 0));
  const coef = inv.map((row) => row.reduce((a, v, j) => a + v * xty[j], 0));
  const ym = mean(y);
  let sse = 0, sst = 0;
  X.forEach((r, q) => { const fit = r.reduce((a, v, j) => a + v * coef[j], 0); sse += (y[q] - fit) ** 2; sst += (y[q] - ym) ** 2; });
  const ssr = Math.max(0, sst - sse), dfr = k, dfe = n - p;
  const mse = sse / dfe, r2 = sst > 0 ? 1 - sse / sst : 1;
  const se = inv.map((row, i) => Math.sqrt(Math.max(0, row[i] * mse)));
  const t = coef.map((b, i) => (se[i] > 0 ? b / se[i] : NaN));
  const pv = t.map((x) => (Number.isFinite(x) ? tTwoTail(Math.abs(x), dfe) : NaN));
  const tc = tInv2T(1 - confidence, dfe);
  const f = mse > 0 ? ssr / dfr / mse : NaN;
  return {
    coef, se, t, p: pv, lo: coef.map((b, i) => b - tc * se[i]), hi: coef.map((b, i) => b + tc * se[i]),
    r2, adjR2: 1 - (1 - r2) * (n - 1) / dfe, multipleR: Math.sqrt(Math.max(0, r2)), stdErr: Math.sqrt(mse), n,
    ssr, sse, sst, dfr, dfe, f, pF: Number.isFinite(f) ? fRightTail(f, dfr, dfe) : NaN,
  };
}

const num = (x: number) => (Number.isFinite(x) ? x : '#NUM!');

/** Tabelul regresiei, în trei părți: statisticile de regresie, ANOVA și coeficienții. */
export function regressionTable(names: string[], reg: Regression, confidence = 0.95): Table {
  const pc = Math.round(confidence * 1000) / 10;
  const blank = (row: (string | number)[]) => [...row, ...Array(7 - row.length).fill('')];
  return [
    blank([`Regresia: ${names[names.length - 1]} după ${names.slice(0, -1).join(', ')}`]),
    blank([]),
    blank(['Statistici de regresie']),
    blank(['R multiplu', reg.multipleR]),
    blank(['R pătrat', reg.r2]),
    blank(['R pătrat ajustat', num(reg.adjR2)]),
    blank(['Eroarea standard', reg.stdErr]),
    blank(['Observații', reg.n]),
    blank([]),
    blank(['ANOVA', 'Grade de libertate', 'Suma pătratelor', 'Media pătratelor', 'F', 'Semnificația F']),
    blank(['Regresie', reg.dfr, reg.ssr, reg.ssr / reg.dfr, num(reg.f), num(reg.pF)]),
    blank(['Reziduuri', reg.dfe, reg.sse, reg.sse / reg.dfe]),
    blank(['Total', reg.n - 1, reg.sst]),
    blank([]),
    ['', 'Coeficient', 'Eroarea standard', 'Statistica t', 'Valoarea P', `Inferior ${pc}%`, `Superior ${pc}%`],
    ...reg.coef.map((b, i) => [i === 0 ? 'Interceptare' : names[i - 1], b, reg.se[i], num(reg.t[i]), num(reg.p[i]), reg.lo[i], reg.hi[i]]),
  ];
}

/** Marginile claselor pentru histogramă: regula lui Sturges (1 + log2 n clase), cu pas „rotund” (1, 2, 2,5 sau 5 × 10^k). */
export function autoBins(values: number[]): number[] {
  const lo = Math.min(...values), hi = Math.max(...values);
  if (!(hi > lo)) return [hi];
  const k = Math.max(1, Math.ceil(Math.log2(values.length)) + 1);
  const raw = (hi - lo) / k, p10 = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((s) => s >= raw * 0.999) ?? raw;
  const r = (x: number) => Math.round(x / p10 * 1e6) / 1e6 * p10;
  const edges: number[] = [];
  for (let e = r(Math.floor(lo / step) * step + step); ; e = r(e + step)) { edges.push(e); if (e >= hi || edges.length > 200) break; }
  return edges;
}

/** Histograma: pe fiecare rând marginea de sus a clasei (valorile ≤ ea, peste clasa anterioară), frecvența și procentul cumulat. */
export function histogram(name: string, values: number[], edges = autoBins(values)): Table {
  const counts = edges.map(() => 0);
  let more = 0;
  for (const v of values) { const i = edges.findIndex((e) => v <= e); if (i < 0) more++; else counts[i]++; }
  const n = values.length;
  const out: Table = [[`Clasa (${name}, până la)`, 'Frecvența', '% cumulat']];
  let cum = 0;
  edges.forEach((e, i) => { cum += counts[i]; out.push([e, counts[i], n ? cum / n : 0]); });
  if (more) { cum += more; out.push(['Mai mult', more, n ? cum / n : 0]); }
  return out;
}

/** Valoarea f pentru care coada din dreapta a distribuției F (d1, d2) are probabilitatea p (ca INV.F.RT): căutare prin înjumătățire. */
export function fInvRight(p: number, d1: number, d2: number): number {
  let lo = 0, hi = 1;
  while (fRightTail(hi, d1, d2) > p && hi < 1e9) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (fRightTail(mid, d1, d2) > p) lo = mid; else hi = mid;
    if (hi - lo < 1e-12 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}

const variance = (v: number[]) => { const m = mean(v); return v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1); };

/** ANOVA cu un factor: fiecare coloană e o grupă. null dacă nu sunt măcar două grupe cu câte două valori. */
export function anovaOne(cols: { name: string; values: number[] }[], alpha = 0.05): Table | null {
  const g = cols.filter((c) => c.values.length);
  const N = g.reduce((a, c) => a + c.values.length, 0), k = g.length;
  if (k < 2 || N - k < 1) return null;
  const all = g.flatMap((c) => c.values), gm = mean(all);
  const ssb = g.reduce((a, c) => a + c.values.length * (mean(c.values) - gm) ** 2, 0);
  const ssw = g.reduce((a, c) => { const m = mean(c.values); return a + c.values.reduce((s, x) => s + (x - m) ** 2, 0); }, 0);
  const dfb = k - 1, dfw = N - k, msb = ssb / dfb, msw = ssw / dfw, f = msw > 0 ? msb / msw : NaN;
  const blank = (row: (string | number)[]) => [...row, ...Array(7 - row.length).fill('')];
  return [
    blank(['ANOVA cu un factor']),
    blank([]),
    blank(['Rezumat', 'Numărul', 'Suma', 'Media', 'Varianța']),
    ...g.map((c) => blank([c.name, c.values.length, c.values.reduce((a, b) => a + b, 0), mean(c.values), c.values.length > 1 ? variance(c.values) : '#DIV/0!'])),
    blank([]),
    ['Sursa variației', 'Suma pătratelor', 'Grade de libertate', 'Media pătratelor', 'F', 'Valoarea P', 'F critic'],
    ['Între grupe', ssb, dfb, msb, num(f), Number.isFinite(f) ? fRightTail(f, dfb, dfw) : '#NUM!', fInvRight(alpha, dfb, dfw)],
    blank(['În interiorul grupelor', ssw, dfw, msw]),
    blank([]),
    blank(['Total', ssb + ssw, N - 1]),
  ];
}

/** Testul F pentru două variații (primele două coloane): F = var1 / var2, probabilitatea și F critic pe o coadă. */
export function fTest(a: { name: string; values: number[] }, b: { name: string; values: number[] }, alpha = 0.05): Table | null {
  if (a.values.length < 2 || b.values.length < 2) return null;
  const v1 = variance(a.values), v2 = variance(b.values), d1 = a.values.length - 1, d2 = b.values.length - 1;
  if (!(v2 > 0)) return null;
  const f = v1 / v2, right = fRightTail(f, d1, d2);
  // Ca în instrumentul clasic: cu F < 1 se folosește coada din stânga.
  const p = f >= 1 ? right : 1 - right, crit = f >= 1 ? fInvRight(alpha, d1, d2) : fInvRight(1 - alpha, d1, d2);
  return [
    ['Testul F pentru două variații', a.name, b.name],
    ['Media', mean(a.values), mean(b.values)],
    ['Varianța', v1, v2],
    ['Observații', a.values.length, b.values.length],
    ['Grade de libertate', d1, d2],
    ['F', f, ''],
    ['P(F<=f) o coadă', p, ''],
    ['F critic o coadă', crit, ''],
  ];
}

export type TKind = 'paired' | 'equal' | 'unequal';

/** Testul t pentru două medii: pe perechi (rânduri potrivite), cu varianțe egale (varianța comună) sau cu varianțe diferite
 *  (gradele de libertate după Welch, rotunjite la întreg, ca în instrumentul clasic). Diferența ipotetică a mediilor e 0. */
export function tTest(a: { name: string; values: number[] }, b: { name: string; values: number[] }, kind: TKind, alpha = 0.05): Table | null {
  const x = a.values, y = b.values, n1 = x.length, n2 = y.length;
  if (n1 < 2 || n2 < 2 || (kind === 'paired' && n1 !== n2)) return null;
  const m1 = mean(x), m2 = mean(y), v1 = variance(x), v2 = variance(y);
  const rows: Table = [];
  let t: number, df: number;
  if (kind === 'paired') {
    const d = x.map((v, i) => v - y[i]), sd = Math.sqrt(variance(d));
    df = n1 - 1; t = sd > 0 ? mean(d) / (sd / Math.sqrt(n1)) : NaN;
    const sxy = x.reduce((s, v, i) => s + (v - m1) * (y[i] - m2), 0) / (n1 - 1);
    rows.push(['Corelația Pearson', v1 > 0 && v2 > 0 ? sxy / Math.sqrt(v1 * v2) : '#DIV/0!', '']);
  } else if (kind === 'equal') {
    df = n1 + n2 - 2;
    const sp = ((n1 - 1) * v1 + (n2 - 1) * v2) / df;
    t = sp > 0 ? (m1 - m2) / Math.sqrt(sp * (1 / n1 + 1 / n2)) : NaN;
    rows.push(['Varianța comună', sp, '']);
  } else {
    const q1 = v1 / n1, q2 = v2 / n2;
    df = Math.round((q1 + q2) ** 2 / (q1 * q1 / (n1 - 1) + q2 * q2 / (n2 - 1)));
    t = q1 + q2 > 0 ? (m1 - m2) / Math.sqrt(q1 + q2) : NaN;
  }
  const two = Number.isFinite(t) ? tTwoTail(Math.abs(t), df) : NaN;
  const title = { paired: 'Testul t: două eșantioane pe perechi', equal: 'Testul t: două eșantioane, varianțe egale', unequal: 'Testul t: două eșantioane, varianțe diferite' }[kind];
  return [
    [title, a.name, b.name],
    ['Media', m1, m2],
    ['Varianța', v1, v2],
    ['Observații', n1, n2],
    ...rows,
    ['Diferența ipotetică a mediilor', 0, ''],
    ['Grade de libertate', num(df), ''],
    ['Statistica t', num(t), ''],
    ['P(T<=t) o coadă', num(two / 2), ''],
    ['t critic o coadă', num(tInv2T(2 * alpha, df)), ''],
    ['P(T<=t) două cozi', num(two), ''],
    ['t critic două cozi', num(tInv2T(alpha, df)), ''],
  ];
}

/** Media mobilă pe `n` valori (prima coloană): prognoza pentru fiecare rând e media ultimelor n valori, până la el inclusiv
 *  (primele n-1 rânduri: #N/A). Eroarea standard: rădăcina mediei pătratelor diferențelor pe ultimele n rânduri cu prognoză. */
export function movingAverage(name: string, values: number[], n = 3): Table | null {
  if (n < 2 || values.length < n) return null;
  const f = values.map((_, i) => (i >= n - 1 ? mean(values.slice(i - n + 1, i + 1)) : NaN));
  const out: Table = [[name, `Media mobilă (${n})`, 'Eroarea standard']];
  values.forEach((v, i) => {
    const ok = i >= 2 * n - 2;
    const err = ok ? Math.sqrt(values.slice(i - n + 1, i + 1).reduce((s, x, j) => s + (x - f[i - n + 1 + j]) ** 2, 0) / n) : '#N/A';
    out.push([v, Number.isFinite(f[i]) ? f[i] : '#N/A', err]);
  });
  return out;
}

/** Netezirea exponențială cu factorul de amortizare d (α = 1 - d): prognoza pentru rândul t vine din valoarea și prognoza
 *  rândului t-1; primul rând n-are prognoză, al doilea o ia pe prima valoare. Eroarea standard: pe ultimele 3 rânduri. */
export function expSmoothing(name: string, values: number[], damping = 0.3): Table | null {
  if (values.length < 2 || !(damping > 0 && damping < 1)) return null;
  const a = 1 - damping, f: number[] = [NaN, values[0]];
  for (let i = 2; i < values.length; i++) f.push(a * values[i - 1] + damping * f[i - 1]);
  const out: Table = [[name, `Netezire exponențială (amortizare ${String(damping).replace('.', ',')})`, 'Eroarea standard']];
  values.forEach((v, i) => {
    const err = i >= 3 ? Math.sqrt([i - 2, i - 1, i].reduce((s, j) => s + (values[j] - f[j]) ** 2, 0) / 3) : '#N/A';
    out.push([v, Number.isFinite(f[i]) ? f[i] : '#N/A', err]);
  });
  return out;
}

/** ANOVA cu doi factori fără replicare: rândurile sunt un factor (de exemplu magazinele), coloanele celălalt (lunile).
 *  Etichetele rândurilor vin din prima coloană (dacă are text), ale coloanelor din capul de tabel; rândurile incomplete se sar. */
export function anovaTwo(grid: Cell[][], colLetter: (i: number) => string, alpha = 0.05): { table: Table; dropped: number } | null {
  if (!grid.length) return null;
  const isText = (x: Cell) => typeof x === 'string' && x.trim() !== '' && !Number.isFinite(Number(x.replace(',', '.')));
  const head = grid[0].some(isText) && grid.length > 1;
  const body = grid.slice(head ? 1 : 0).filter((r) => r.some((x) => x !== null && String(x).trim() !== ''));
  const labels = body.some((r) => isText(r[0]));
  const c0 = labels ? 1 : 0, width = Math.max(...grid.map((r) => r.length));
  const cols = Array.from({ length: width - c0 }, (_, j) => (head && isText(grid[0][j + c0]) ? String(grid[0][j + c0]).trim() : `Coloana ${colLetter(j + c0)}`));
  const names: string[] = [], data: number[][] = [];
  let dropped = 0;
  body.forEach((r, i) => {
    const vals = Array.from({ length: cols.length }, (_, j) => r[j + c0]);
    if (vals.every((x) => typeof x === 'number' && Number.isFinite(x))) { data.push(vals as number[]); names.push(labels && isText(r[0]) ? String(r[0]).trim() : `Rândul ${i + 1}`); }
    else dropped++;
  });
  const R = data.length, C = cols.length;
  if (R < 2 || C < 2) return null;
  const all = data.flat(), gm = mean(all);
  const rowM = data.map(mean), colV = cols.map((_, j) => data.map((r) => r[j])), colM = colV.map(mean);
  const ssr = C * rowM.reduce((a, m) => a + (m - gm) ** 2, 0), ssc = R * colM.reduce((a, m) => a + (m - gm) ** 2, 0);
  const sst = all.reduce((a, x) => a + (x - gm) ** 2, 0), sse = Math.max(0, sst - ssr - ssc);
  const dfr = R - 1, dfc = C - 1, dfe = dfr * dfc, mse = sse / dfe;
  const line = (src: string, ss: number, df: number) => {
    const ms = ss / df, f = mse > 0 ? ms / mse : NaN;
    return [src, ss, df, ms, num(f), Number.isFinite(f) ? fRightTail(f, df, dfe) : '#NUM!', fInvRight(alpha, df, dfe)];
  };
  const blank = (row: (string | number)[]) => [...row, ...Array(7 - row.length).fill('')];
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const summary = (n: string, v: number[]) => blank([n, v.length, sum(v), mean(v), variance(v)]);
  return {
    dropped,
    table: [
      blank(['ANOVA cu doi factori fără replicare']),
      blank([]),
      blank(['Rezumat', 'Numărul', 'Suma', 'Media', 'Varianța']),
      ...data.map((r, i) => summary(names[i], r)),
      blank([]),
      ...colV.map((v, j) => summary(cols[j], v)),
      blank([]),
      ['Sursa variației', 'Suma pătratelor', 'Grade de libertate', 'Media pătratelor', 'F', 'Valoarea P', 'F critic'],
      line('Rânduri', ssr, dfr),
      line('Coloane', ssc, dfc),
      blank(['Eroare', sse, dfe, mse]),
      blank([]),
      blank(['Total', sst, R * C - 1]),
    ],
  };
}

/** ANOVA cu doi factori cu replicare: fiecare rând-factor (de exemplu metoda) are câte un bloc de n rânduri, iar coloanele sunt
 *  celălalt factor (de exemplu soiul). Eticheta blocului e în prima coloană, doar pe primul lui rând; fără etichete, n se dă ca
 *  argument. Toate celulele de date trebuie să fie numere. Rezultatul: rezumatul pe fiecare bloc și pe coloane, apoi rândurile,
 *  coloanele, interacțiunea și eroarea din interiorul grupelor. Întoarce motivul când datele nu se potrivesc. */
export function anovaRep(grid: Cell[][], colLetter: (i: number) => string, per?: number, alpha = 0.05): { table: Table } | { error: 'labels' | 'shape' | 'text' } {
  const isText = (x: Cell) => typeof x === 'string' && x.trim() !== '' && !Number.isFinite(Number(x.replace(',', '.')));
  const head = grid.length > 1 && grid[0].some(isText);
  const body = grid.slice(head ? 1 : 0).filter((r) => r.some((x) => x !== null && String(x).trim() !== ''));
  const labels = body.some((r) => isText(r[0]));
  const c0 = labels ? 1 : 0, width = Math.max(0, ...grid.map((r) => r.length));
  const C = width - c0;
  const cols = Array.from({ length: C }, (_, j) => (head && isText(grid[0][j + c0]) ? String(grid[0][j + c0]).trim() : `Coloana ${colLetter(j + c0)}`));
  // Blocurile: de la o etichetă la următoarea (sau câte per rânduri, fără etichete).
  const starts: number[] = [];
  if (labels) { if (!isText(body[0]?.[0])) return { error: 'shape' }; body.forEach((r, i) => { if (isText(r[0])) starts.push(i); }); }
  else { if (!per || per < 2 || body.length % per) return { error: 'labels' }; for (let i = 0; i < body.length; i += per) starts.push(i); }
  const n = (starts[1] ?? body.length) - starts[0], R = starts.length;
  if (R < 2 || C < 2 || n < 2 || starts.some((st, k) => (starts[k + 1] ?? body.length) - st !== n)) return { error: 'shape' };
  const data: number[][][] = [];
  for (const st of starts) {
    const blk: number[][] = Array.from({ length: C }, () => []);
    for (let i = st; i < st + n; i++) for (let j = 0; j < C; j++) {
      const x = body[i][j + c0];
      if (typeof x !== 'number' || !Number.isFinite(x)) return { error: 'text' };
      blk[j].push(x);
    }
    data.push(blk);
  }
  const names = starts.map((st, k) => (labels ? String(body[st][0]).trim() : `Grupa ${k + 1}`));
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const all = data.flat(2), gm = mean(all);
  const rowV = data.map((b) => b.flat()), colV = cols.map((_, j) => data.flatMap((b) => b[j]));
  const ssr = C * n * rowV.reduce((a, v) => a + (mean(v) - gm) ** 2, 0), ssc = R * n * colV.reduce((a, v) => a + (mean(v) - gm) ** 2, 0);
  const ssw = data.reduce((a, b) => a + b.reduce((s, v) => { const m = mean(v); return s + v.reduce((t, x) => t + (x - m) ** 2, 0); }, 0), 0);
  const sst = all.reduce((a, x) => a + (x - gm) ** 2, 0), ssi = Math.max(0, sst - ssr - ssc - ssw);
  const dfw = R * C * (n - 1), msw = ssw / dfw;
  const W = Math.max(7, C + 2);
  const blank = (row: (string | number)[]) => [...row, ...Array(W - row.length).fill('')];
  const line = (src: string, ss: number, df: number) => {
    const ms = ss / df, f = msw > 0 ? ms / msw : NaN;
    return blank([src, ss, df, ms, num(f), Number.isFinite(f) ? fRightTail(f, df, dfw) : '#NUM!', fInvRight(alpha, df, dfw)]);
  };
  const block = (title: string, groups: number[][], total: number[]) => [
    blank(['', ...cols, 'Total']),
    blank([title]),
    blank(['Numărul', ...groups.map((v) => v.length), total.length]),
    blank(['Suma', ...groups.map(sum), sum(total)]),
    blank(['Media', ...groups.map(mean), mean(total)]),
    blank(['Varianța', ...groups.map((v) => (v.length > 1 ? variance(v) : '#DIV/0!')), total.length > 1 ? variance(total) : '#DIV/0!']),
    blank([]),
  ];
  return {
    table: [
      blank(['ANOVA cu doi factori cu replicare']),
      blank([]),
      blank(['Rezumat']),
      ...data.flatMap((b, k) => block(names[k], b, rowV[k])),
      // La Total: pe coloane, fără coloana Total.
      ...block('Total', colV, all).slice(1, 6).map((r) => r.slice(0, C + 1).concat(Array(W - C - 1).fill(''))),
      blank([]),
      blank(['ANOVA']),
      blank(['Sursa variației', 'Suma pătratelor', 'Grade de libertate', 'Media pătratelor', 'F', 'Valoarea P', 'F critic']),
      line('Rânduri (eșantion)', ssr, R - 1),
      line('Coloane', ssc, C - 1),
      line('Interacțiune', ssi, (R - 1) * (C - 1)),
      blank(['În interiorul grupelor', ssw, dfw, msw]),
      blank([]),
      blank(['Total', sst, all.length - 1]),
    ],
  };
}

/** Rang și percentilă (prima coloană): valorile de la cea mai mare la cea mai mică, cu poziția lor inițială („Punctul”, numărat
 *  de la 1), rangul (egalitățile au același rang, ca RANK.EQ) și procentul de valori mai mici (ca PERCENTRANK.INC, trunchiat la 3 zecimale). */
export function rankPercentile(name: string, values: number[]): Table | null {
  const n = values.length;
  if (n < 2) return null;
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v || a.i - b.i);
  const out: Table = [['Punctul', name, 'Rangul', 'Procentul']];
  for (const { v, i } of order) {
    const rank = 1 + values.filter((x) => x > v).length, below = values.filter((x) => x < v).length;
    out.push([i + 1, v, rank, Math.floor((below / (n - 1)) * 1000 + 1e-9) / 1000]);
  }
  return out;
}

/** Testul z pentru două medii (primele două coloane). Varianțele „cunoscute” sunt varianțele eșantioanelor (instrumentul clasic
 *  le cere separat; cu eșantioane mari diferența e neglijabilă). Diferența ipotetică a mediilor e 0. */
export function zTest(a: { name: string; values: number[] }, b: { name: string; values: number[] }, alpha = 0.05): Table | null {
  const x = a.values, y = b.values, n1 = x.length, n2 = y.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = mean(x), m2 = mean(y), v1 = variance(x), v2 = variance(y), se = Math.sqrt(v1 / n1 + v2 / n2);
  const z = se > 0 ? (m1 - m2) / se : NaN;
  const one = Number.isFinite(z) ? 1 - normSDist(Math.abs(z)) : NaN;
  return [
    ['Testul z: două eșantioane pentru medii', a.name, b.name],
    ['Media', m1, m2],
    ['Varianța cunoscută', v1, v2],
    ['Observații', n1, n2],
    ['Diferența ipotetică a mediilor', 0, ''],
    ['z', num(z), ''],
    ['P(Z<=z) o coadă', num(one), ''],
    ['z critic o coadă', normSInv(1 - alpha), ''],
    ['P(Z<=z) două cozi', num(2 * one), ''],
    ['z critic două cozi', normSInv(1 - alpha / 2), ''],
  ];
}

/** Eșantionare (prima coloană): „periodic” ia fiecare a n-a valoare (a n-a, a 2n-a…); „aleator” alege n valori la întâmplare,
 *  fără să repete același rând (dacă n e mai mare decât numărul valorilor, le ia pe toate, amestecate). */
export function sample(name: string, values: number[], mode: 'periodic' | 'random', n: number, rnd: () => number = Math.random): Table | null {
  n = Math.floor(n);
  if (!values.length || !(n >= 1)) return null;
  let pickIdx: number[];
  if (mode === 'periodic') {
    if (n > values.length) return null;
    pickIdx = [];
    for (let i = n - 1; i < values.length; i += n) pickIdx.push(i);
  } else {
    const idx = values.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    pickIdx = idx.slice(0, Math.min(n, idx.length));
  }
  return [[`Eșantion (${name})`, 'Rândul din listă'], ...pickIdx.map((i) => [values[i], i + 1])];
}

/** Generator de numere la întâmplare cu sămânță (mulberry32): aceeași sămânță dă mereu aceleași numere. Fără sămânță, Math.random. */
export function seededRandom(seed?: number): () => number {
  if (seed == null || !Number.isFinite(seed)) return Math.random;
  let a = Math.floor(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RandDist = 'uniform' | 'normal' | 'bernoulli' | 'binomial' | 'poisson' | 'patterned' | 'discrete';
export interface RandOpts {
  dist: RandDist;
  vars: number;   // câte coloane
  count: number;  // câte numere în fiecare coloană (la „după un model” se calculează singur)
  a?: number; b?: number;          // uniformă: între a și b; normală: media a, abaterea b; Bernoulli / binomială: p = a, încercări b; Poisson: λ = a
  from?: number; to?: number; step?: number; repNum?: number; repSeq?: number; // după un model
  table?: [number, number][];      // discretă: valoarea și probabilitatea ei
}

/** Numerele cerute, pe coloane (rezultat[r][c]), sau motivul pentru care nu se pot face. */
export function randomNumbers(o: RandOpts, rnd: () => number = Math.random): number[][] | string {
  const vars = Math.floor(o.vars);
  if (!(vars >= 1 && vars <= 256)) return 'Numărul de variabile trebuie să fie între 1 și 256';
  const one = (): (() => number) | string => {
    const a = o.a ?? NaN, b = o.b ?? NaN;
    switch (o.dist) {
      case 'uniform':
        if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Scrie capetele intervalului';
        return () => Math.min(a, b) + rnd() * Math.abs(b - a);
      case 'normal': {
        if (!Number.isFinite(a) || !(b >= 0)) return 'Scrie media și o abatere standard pozitivă';
        // Box–Muller: 1 − rnd() ca logaritmul să nu primească 0.
        return () => a + b * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
      }
      case 'bernoulli':
        if (!(a >= 0 && a <= 1)) return 'Probabilitatea trebuie să fie între 0 și 1';
        return () => (rnd() < a ? 1 : 0);
      case 'binomial': {
        const n = Math.floor(b);
        if (!(a >= 0 && a <= 1)) return 'Probabilitatea trebuie să fie între 0 și 1';
        if (!(n >= 1 && n <= 100000)) return 'Numărul de încercări trebuie să fie între 1 și 100.000';
        return () => { let k = 0; for (let i = 0; i < n; i++) if (rnd() < a) k++; return k; };
      }
      case 'poisson': {
        if (!(a > 0 && a <= 100000)) return 'Media (λ) trebuie să fie mai mare decât 0 (cel mult 100.000)';
        // Metoda produsului, pe bucăți de cel mult 500, ca exp(−λ) să nu se facă 0.
        const part = (l: number) => { const L = Math.exp(-l); let k = 0, q = rnd(); while (q > L) { k++; q *= rnd(); } return k; };
        return () => { let k = 0, left = a; while (left > 0) { const l = Math.min(500, left); k += part(l); left -= l; } return k; };
      }
      case 'discrete': {
        const t = (o.table ?? []).filter(([v, q]) => Number.isFinite(v) && Number.isFinite(q));
        if (!t.length) return 'Selectează întâi două coloane: valorile și probabilitățile lor';
        if (t.some(([, q]) => q < 0)) return 'Probabilitățile nu pot fi negative';
        const sum = t.reduce((x, [, q]) => x + q, 0);
        if (Math.abs(sum - 1) > 1e-6) return `Probabilitățile trebuie să aibă suma 1 (acum: ${Math.round(sum * 1e6) / 1e6})`;
        return () => { let u = rnd(); for (const [v, q] of t) { if (u < q) return v; u -= q; } return t[t.length - 1][0]; };
      }
      default: return 'Distribuție necunoscută';
    }
  };
  if (o.dist === 'patterned') {
    const from = o.from ?? NaN, to = o.to ?? NaN, step = o.step ?? NaN, rn = Math.floor(o.repNum ?? 1), rs = Math.floor(o.repSeq ?? 1);
    if (![from, to, step].every(Number.isFinite) || !(step > 0)) return 'Scrie de la, până la și un pas pozitiv';
    if (!(rn >= 1 && rs >= 1)) return 'Repetările trebuie să fie cel puțin 1';
    const seq: number[] = [];
    const up = to >= from, n = Math.floor(Math.abs(to - from) / step + 1e-9) + 1;
    if (n * rn * rs > 1048575) return 'Prea multe numere (cel mult 1.048.575 de rânduri)';
    for (let r = 0; r < rs; r++) for (let i = 0; i < n; i++) for (let k = 0; k < rn; k++) seq.push(Math.round((from + (up ? 1 : -1) * i * step) * 1e12) / 1e12);
    return seq.map((v) => Array(vars).fill(v));
  }
  const count = Math.floor(o.count);
  if (!(count >= 1 && count <= 1048575)) return 'Câte numere: între 1 și 1.048.575';
  if (vars * count > 500000) return 'Prea multe numere deodată (cel mult 500.000)';
  const f = one();
  if (typeof f === 'string') return f;
  return Array.from({ length: count }, () => Array.from({ length: vars }, f));
}

/** Analiza Fourier (transformata Fourier rapidă) pe o coloană de numere reale sau complexe („3+4i”). Numărul valorilor trebuie
 *  să fie o putere a lui 2 (2, 4, 8 … 4096), ca în instrumentul clasic; „inversă” împarte la n. Rezultatul: numere complexe ca text. */
export function fourier(name: string, values: (string | number)[], inverse = false): Table | string {
  const n = values.length;
  if (n < 2 || n > 4096 || (n & (n - 1)) !== 0) return `Numărul valorilor trebuie să fie o putere a lui 2, între 2 și 4096 (acum: ${n})`;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const z = complexOf(values[i]);
    if (!z) return `Valoarea „${values[i]}” nu e un număr (real sau complex, de exemplu 3+4i)`;
    re[i] = z.re; im[i] = z.im;
  }
  // Cooley–Tukey iterativ: întâi ordinea cu biții inversați, apoi fluturii pe lungimi 2, 4, 8 …
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  const out: Table = [[`${inverse ? 'Fourier invers' : 'Fourier'} (${name})`]];
  // Zgomotul de calcul (de ordinul 1e-16 din cea mai mare valoare) devine 0, ca 10 să nu apară „10+1,2E-16i”.
  const big = Math.max(...re.map(Math.abs), ...im.map(Math.abs)), tiny = big * 1e-12;
  const clean = (x: number) => (Math.abs(x) < tiny ? 0 : x) / (inverse ? n : 1);
  for (let i = 0; i < n; i++) out.push([complexText(clean(re[i]), clean(im[i]))]);
  return out;
}
