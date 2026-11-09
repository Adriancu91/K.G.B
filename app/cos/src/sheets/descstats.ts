// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 📊 Statistici descriptive (ca Data Analysis → Descriptive Statistics din Excel): pentru fiecare coloană de numere din zona
// aleasă, un tabel cu media, eroarea standard, mediana, modul, abaterea standard, varianța, boltirea, asimetria, amplitudinea,
// minimul, maximul, suma, numărul de valori, quartilele și nivelul de încredere de 95% pentru medie.
// Formulele sunt cele din manualele de statistică (eșantion: împărțire la n − 1), la fel ca funcțiile MEDIE, ABATERE.STANDARD,
// BOLTIRE, ASIMETRIE din foaie. Testat în tests/sheets-descstats.test.mjs.

export interface StatColumn { name: string; values: number[] }

/** Logaritmul funcției Gamma (aproximarea Lanczos, g = 7). */
function lnGamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Funcția beta incompletă regularizată I_x(a, b), prin fracția continuă (metoda lui Lentz). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x > (a + 1) / (a + b + 2)) return 1 - betaInc(1 - x, b, a);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - (lnGamma(a) + lnGamma(b) - lnGamma(a + b))) / a;
  const tiny = 1e-300;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= 300; i++) {
    const m = i >> 1;
    let num: number;
    if (i === 0) num = 1;
    else if (i % 2 === 0) num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d; if (Math.abs(d) < tiny) d = tiny; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < tiny) c = tiny;
    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-14) break;
  }
  return front * (f - 1);
}

/** Probabilitatea cozilor (ambele) ale distribuției Student cu df grade de libertate, pentru valoarea t ≥ 0. */
export const tTwoTail = (t: number, df: number) => betaInc(df / (df + t * t), df / 2, 0.5);

/** Valoarea critică t pentru probabilitatea p pe ambele cozi (ca INV.T.2T): căutare prin înjumătățire. */
export function tInv2T(p: number, df: number): number {
  let lo = 0, hi = 1;
  while (tTwoTail(hi, df) > p && hi < 1e7) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoTail(mid, df) > p) lo = mid; else hi = mid;
    if (hi - lo < 1e-12 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}

/** Quartila (ca QUARTILE.INC): interpolare între valorile sortate. */
function quartile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q, i = Math.floor(pos), f = pos - i;
  return i + 1 < sorted.length ? sorted[i] + (sorted[i + 1] - sorted[i]) * f : sorted[i];
}

export const NA = '#N/A';
export const DIV0 = '#DIV/0!';

/** Rândurile tabelului: primul rând are numele coloanelor, apoi câte un rând pe statistică (numere sau o eroare ca text). */
export function describe(cols: StatColumn[], confidence = 0.95): (string | number)[][] {
  const labels = ['Media', 'Eroarea standard', 'Mediana', 'Modul', 'Abaterea standard', 'Varianța', 'Boltirea', 'Asimetria',
    'Amplitudinea', 'Minimul', 'Maximul', 'Suma', 'Numărul de valori', 'Quartila 1 (25%)', 'Quartila 3 (75%)',
    `Nivel de încredere (${Math.round(confidence * 1000) / 10}%)`];
  const out: (string | number)[][] = [['', ...cols.map((c) => c.name)], ...labels.map((l) => [l] as (string | number)[])];
  for (const col of cols) {
    const v = col.values, n = v.length;
    const sorted = [...v].sort((a, b) => a - b);
    const sum = v.reduce((a, b) => a + b, 0);
    const mean = n ? sum / n : NaN;
    const ss = v.reduce((a, x) => a + (x - mean) ** 2, 0);
    const variance = n > 1 ? ss / (n - 1) : NaN;
    const sd = Math.sqrt(variance);
    // Modul: valoarea care apare cel mai des, dacă apare de cel puțin două ori (la egalitate, prima din coloană, ca în foaie).
    const freq = new Map<number, number>();
    let mode: number | string = NA, best = 1;
    for (const x of v) { const k = (freq.get(x) ?? 0) + 1; freq.set(x, k); if (k > best) { best = k; mode = x; } }
    const z3 = sd > 0 ? v.reduce((a, x) => a + ((x - mean) / sd) ** 3, 0) : NaN;
    const z4 = sd > 0 ? v.reduce((a, x) => a + ((x - mean) / sd) ** 4, 0) : NaN;
    const kurt = n > 3 && sd > 0 ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * z4 - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3)) : DIV0;
    const skew = n > 2 && sd > 0 ? (n / ((n - 1) * (n - 2))) * z3 : DIV0;
    const se = n > 1 ? sd / Math.sqrt(n) : DIV0;
    const conf = n > 1 && typeof se === 'number' ? tInv2T(1 - confidence, n - 1) * se : DIV0;
    const vals: (string | number)[] = n
      ? [mean, se, quartile(sorted, 0.5), mode, n > 1 ? sd : DIV0, n > 1 ? variance : DIV0, kurt, skew,
        sorted[n - 1] - sorted[0], sorted[0], sorted[n - 1], sum, n, quartile(sorted, 0.25), quartile(sorted, 0.75), conf]
      : [DIV0, DIV0, NA, NA, DIV0, DIV0, DIV0, DIV0, NA, 0, 0, 0, 0, NA, NA, DIV0];
    vals.forEach((x, i) => out[i + 1].push(x));
  }
  return out;
}

/** Coloanele zonei: dacă primul rând are text (nu numere), el dă numele coloanelor; altfel „Coloana A”, „Coloana B”… */
export function columnsOf(grid: (number | string | null)[][], colLetter: (i: number) => string): { cols: StatColumn[]; skipped: number } {
  if (!grid.length) return { cols: [], skipped: 0 };
  const width = Math.max(...grid.map((r) => r.length));
  const head = grid[0].some((x) => typeof x === 'string' && x.trim() !== '' && !Number.isFinite(Number(x.replace(',', '.'))));
  let skipped = 0;
  const cols: StatColumn[] = [];
  for (let c = 0; c < width; c++) {
    const name = head && typeof grid[0][c] === 'string' && String(grid[0][c]).trim() ? String(grid[0][c]).trim() : `Coloana ${colLetter(c)}`;
    const values: number[] = [];
    for (let r = head ? 1 : 0; r < grid.length; r++) {
      const x = grid[r][c];
      if (typeof x === 'number' && Number.isFinite(x)) values.push(x);
      else if (x !== null && String(x).trim() !== '') skipped++;
    }
    cols.push({ name, values });
  }
  return { cols, skipped };
}
