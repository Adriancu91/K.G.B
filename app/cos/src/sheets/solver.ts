// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Analiză „Ce-ar fi dacă” → 🧮 Rezolvitor (ca Solver): caută valorile mai multor celule pentru care o formulă (obiectivul)
// e cât mai mare, cât mai mică sau egală cu o valoare, respectând niște condiții (A1 <= 100, B2:B4 >= 0, C1 întreg…).
// Metoda: dacă formulele depind liniar de celulele schimbate (cazul obișnuit: producție, transport, buget), se rezolvă exact,
// cu metoda simplex în două faze (și ramificare pentru numerele întregi). Altfel: căutare Nelder–Mead cu penalizare pentru
// condițiile încălcate, pornită de mai multe ori, cu penalizarea tot mai mare.

export type SolverOp = '<=' | '>=' | '=' | 'int' | 'bin';
export type SolverGoal = 'max' | 'min' | 'value';

export interface SolverProblem {
  /** Numărul celulelor schimbate. */
  n: number;
  /** Valorile de pornire (din foaie). */
  x0: number[];
  /** Valorile măsurate pentru x: [obiectivul, apoi câte o pereche (stânga, dreapta) pentru fiecare condiție <=, >=, =].
   *  undefined dacă vreo formulă dă eroare. */
  measure(x: number[]): number[] | undefined;
  /** Condițiile <=, >=, = în ordinea perechilor din measure. */
  ops: ('<=' | '>=' | '=')[];
  /** Indicii celulelor schimbate care trebuie să fie întregi, respectiv 0 sau 1. */
  ints: number[];
  bins: number[];
  nonneg: boolean;
  goal: SolverGoal;
  target?: number;
  /** 'evo' = metoda evolutivă (pentru formule cu salturi: DACĂ, ROTUNJIRE, căutări în tabele); lipsă = automată. */
  method?: SolverMethod;
}
export type SolverMethod = 'auto' | 'evo';

export interface SolverResult {
  status: 'optim' | 'aproape' | 'imposibil' | 'nemarginit' | 'eroare';
  x: number[];
  obj: number;
  linear: boolean;
  /** Cât de mult e încălcată cea mai încălcată condiție (0 = toate respectate). */
  violation: number;
}

/** Celulele dintr-un text ca „B1:B3, D5” (cel mult `max`); mesaj de eroare în română dacă textul nu e bun. */
export function parseCells(text: string, max = 200): string[] | string {
  const parts = text.toUpperCase().replace(/\$/g, '').split(/[;,\s]+/).filter(Boolean);
  if (!parts.length) return 'Scrie celulele, de exemplu B1:B3.';
  const out: string[] = [];
  const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const colName = (c: number) => { let s = ''; for (c++; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };
  for (const p of parts) {
    const m = /^([A-Z]{1,3})(\d{1,7})(?::([A-Z]{1,3})(\d{1,7}))?$/.exec(p);
    if (!m || +m[2] < 1 || (m[4] && +m[4] < 1)) return `„${p}” nu e o celulă sau o zonă (de exemplu B1 sau B1:B3).`;
    const c0 = colNum(m[1]), r0 = +m[2] - 1, c1 = m[3] ? colNum(m[3]) : c0, r1 = m[4] ? +m[4] - 1 : r0;
    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++)
      for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) {
        const id = colName(c) + (r + 1);
        if (!out.includes(id)) out.push(id);
        if (out.length > max) return `Se pot folosi cel mult ${max} de celule.`;
      }
  }
  return out;
}

// ---------- Simplex (tablou dens, regula lui Bland ca să nu se învârtă în cerc) ----------

interface LP { c: number[]; A: number[][]; b: number[]; kind: ('<=' | '>=' | '=')[] }

/** max c·x cu A x (kind) b, x >= 0. */
function simplex(lp: LP): { status: 'optim' | 'imposibil' | 'nemarginit'; x: number[]; z: number } {
  const m = lp.A.length, n = lp.c.length;
  // Toate b >= 0 (înmulțim rândul cu -1 și întoarcem semnul).
  const A = lp.A.map((r) => r.slice()), b = lp.b.slice(), kind = lp.kind.slice();
  for (let i = 0; i < m; i++) if (b[i] < 0) { A[i] = A[i].map((v) => -v); b[i] = -b[i]; kind[i] = kind[i] === '<=' ? '>=' : kind[i] === '>=' ? '<=' : '='; }
  // Coloanele: x (n), variabile de abatere (câte una pentru <= și >=), artificiale (pentru >= și =).
  const slack: number[] = kind.map(() => -1);
  let cols = n;
  kind.forEach((k, i) => { if (k !== '=') slack[i] = cols++; });
  const art: number[] = kind.map(() => -1);
  kind.forEach((k, i) => { if (k !== '<=') art[i] = cols++; });
  const W = cols + 1; // ultima coloană = termenul liber
  const T = A.map((row, i) => {
    const r = new Array(W).fill(0);
    row.forEach((v, j) => (r[j] = v));
    if (slack[i] >= 0) r[slack[i]] = kind[i] === '<=' ? 1 : -1;
    if (art[i] >= 0) r[art[i]] = 1;
    r[W - 1] = b[i];
    return r;
  });
  const basis = kind.map((k, i) => (k === '<=' ? slack[i] : art[i]));
  const isArt = (j: number) => art.includes(j);
  const pivot = (pr: number, pc: number) => {
    const p = T[pr][pc];
    for (let j = 0; j < W; j++) T[pr][j] /= p;
    for (let i = 0; i < m; i++) if (i !== pr && T[i][pc] !== 0) { const f = T[i][pc]; for (let j = 0; j < W; j++) T[i][j] -= f * T[pr][j]; }
    basis[pr] = pc;
  };
  // Rulează simplex pentru max obj·x (obj pe toate coloanele); `allowed` = coloanele care pot intra în bază.
  const run = (obj: number[], allowed: (j: number) => boolean): 'optim' | 'nemarginit' => {
    for (let it = 0; it < 5000; it++) {
      // Costurile reduse: obj_j - sum obj_B T_ij
      let pc = -1;
      for (let j = 0; j < W - 1 && pc < 0; j++) {
        if (!allowed(j) || basis.includes(j)) continue;
        let d = obj[j];
        for (let i = 0; i < m; i++) d -= obj[basis[i]] * T[i][j];
        if (d > 1e-9) pc = j;
      }
      if (pc < 0) return 'optim';
      let pr = -1, best = Infinity;
      for (let i = 0; i < m; i++) if (T[i][pc] > 1e-12) {
        const q = T[i][W - 1] / T[i][pc];
        if (q < best - 1e-12 || (Math.abs(q - best) <= 1e-12 && basis[i] < basis[pr])) { best = q; pr = i; }
      }
      if (pr < 0) return 'nemarginit';
      pivot(pr, pc);
    }
    return 'optim';
  };
  // Faza 1: scoatem artificialele (max -sum art).
  if (art.some((j) => j >= 0)) {
    const o1 = new Array(W - 1).fill(0);
    art.forEach((j) => { if (j >= 0) o1[j] = -1; });
    run(o1, () => true);
    const infeas = basis.reduce((s, j, i) => s + (isArt(j) ? T[i][W - 1] : 0), 0);
    if (infeas > 1e-7) return { status: 'imposibil', x: [], z: 0 };
    // Artificialele rămase în bază cu valoarea 0: le înlocuim cu o coloană normală, dacă se poate.
    for (let i = 0; i < m; i++) if (isArt(basis[i])) {
      const j = T[i].findIndex((v, k) => k < W - 1 && !isArt(k) && Math.abs(v) > 1e-9);
      if (j >= 0) pivot(i, j);
    }
  }
  const o2 = new Array(W - 1).fill(0);
  lp.c.forEach((v, j) => (o2[j] = v));
  if (run(o2, (j) => !isArt(j)) === 'nemarginit') return { status: 'nemarginit', x: [], z: 0 };
  const x = new Array(n).fill(0);
  basis.forEach((j, i) => { if (j < n) x[j] = T[i][W - 1]; });
  return { status: 'optim', x, z: lp.c.reduce((s, v, j) => s + v * x[j], 0) };
}

// ---------- Rezolvarea ----------

/** Forma liniară a problemei, dacă există: F(x) = F0 + J·(x - x0) pentru toate valorile măsurate. */
function linearForm(p: SolverProblem): { F0: number[]; J: number[][] } | null {
  const F0 = p.measure(p.x0);
  if (!F0) return null;
  const J: number[][] = F0.map(() => new Array(p.n).fill(0));
  for (let j = 0; j < p.n; j++) {
    const x = p.x0.slice(); x[j] += 1;
    const F = p.measure(x);
    if (!F) return null;
    F.forEach((v, k) => (J[k][j] = v - F0[k]));
  }
  // Verificare în câteva puncte depărtate: dacă rezultatul nu se potrivește, problema nu e liniară.
  const pts = [p.x0.map((v, j) => v + 3.7 + j * 1.3), p.x0.map((v, j) => v - 2.1 * (j % 2 ? 1 : -1) + 0.5), p.x0.map((v, j) => v * 2 + 11 - j)];
  for (const x of pts) {
    const F = p.measure(x);
    if (!F) return null;
    for (let k = 0; k < F.length; k++) {
      const pred = F0[k] + J[k].reduce((s, a, j) => s + a * (x[j] - p.x0[j]), 0);
      if (Math.abs(F[k] - pred) > 1e-7 * Math.max(1, Math.abs(F[k]), Math.abs(pred))) return null;
    }
  }
  return { F0, J };
}

/** Cea mai mare încălcare a condițiilor (inclusiv nenegativ / întreg / binar) pentru valorile măsurate F. */
function violationOf(p: SolverProblem, x: number[], F: number[]): number {
  let v = 0;
  p.ops.forEach((op, k) => {
    const d = F[1 + 2 * k] - F[2 + 2 * k];
    const s = Math.max(1, Math.abs(F[2 + 2 * k]));
    v = Math.max(v, (op === '<=' ? Math.max(0, d) : op === '>=' ? Math.max(0, -d) : Math.abs(d)) / s);
  });
  if (p.nonneg) x.forEach((xi) => (v = Math.max(v, -xi)));
  for (const j of p.ints) v = Math.max(v, Math.abs(x[j] - Math.round(x[j])));
  for (const j of p.bins) v = Math.max(v, Math.abs(x[j] - Math.round(x[j])), -x[j], x[j] - 1);
  if (p.goal === 'value') v = Math.max(v, Math.abs(F[0] - (p.target ?? 0)) / Math.max(1, Math.abs(p.target ?? 0)));
  return v;
}

function solveLinear(p: SolverProblem, F0: number[], J: number[][]): SolverResult {
  // Variabilele: x = x0 + d; în simplex variabilele sunt >= 0, deci x = u - w pentru cele libere.
  // Rânduri: pentru fiecare condiție, (J_l - J_r)·x <= / >= / = -(F0_l - F0_r) + (J_l - J_r)·x0.
  const n = p.n, free = !p.nonneg;
  const binSet = new Set(p.bins), intSet = new Set([...p.ints, ...p.bins]);
  const baseRows: { a: number[]; b: number; kind: '<=' | '>=' | '=' }[] = [];
  const affine = (k: number) => ({ a: J[k], c: F0[k] - J[k].reduce((s, v, j) => s + v * p.x0[j], 0) }); // F_k(x) = a·x + c
  p.ops.forEach((op, k) => {
    const L = affine(1 + 2 * k), R = affine(2 + 2 * k);
    baseRows.push({ a: L.a.map((v, j) => v - R.a[j]), b: R.c - L.c, kind: op });
  });
  const obj = affine(0);
  if (p.goal === 'value') baseRows.push({ a: obj.a.slice(), b: (p.target ?? 0) - obj.c, kind: '=' });
  for (const j of binSet) baseRows.push({ a: Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)), b: 1, kind: '<=' });
  const sign = p.goal === 'min' ? -1 : 1;
  const cvec = p.goal === 'value' ? new Array(n).fill(0) : obj.a.map((v) => sign * v);
  const lpSolve = (extra: { j: number; kind: '<=' | '>='; v: number }[]) => {
    const rows = [...baseRows, ...extra.map((e) => ({ a: Array.from({ length: n }, (_, i) => (i === e.j ? 1 : 0)), b: e.v, kind: e.kind }))];
    // Variabilele libere (sau binare/întregi fără nenegativ) se despart în u - w.
    const expand = (a: number[]) => (free ? [...a, ...a.map((v) => -v)] : a);
    const r = simplex({ c: expand(cvec), A: rows.map((r) => expand(r.a)), b: rows.map((r) => r.b), kind: rows.map((r) => r.kind) });
    if (r.status !== 'optim') return r;
    return { ...r, x: free ? r.x.slice(0, n).map((u, j) => u - r.x[n + j]) : r.x };
  };
  let best: { x: number[]; z: number } | null = null;
  let firstStatus: 'optim' | 'imposibil' | 'nemarginit' | null = null;
  let nodes = 0;
  // Ramificare și mărginire pentru celulele întregi.
  const branch = (extra: { j: number; kind: '<=' | '>='; v: number }[]) => {
    if (nodes++ > 3000) return;
    const r = lpSolve(extra);
    if (firstStatus === null) firstStatus = r.status;
    if (r.status !== 'optim') return;
    if (best && r.z <= best.z + 1e-9) return;
    const j = [...intSet].find((i) => Math.abs(r.x[i] - Math.round(r.x[i])) > 1e-6);
    if (j === undefined) { best = { x: r.x.map((v, i) => (intSet.has(i) ? Math.round(v) : v)), z: r.z }; return; }
    const f = Math.floor(r.x[j]);
    branch([...extra, { j, kind: '<=', v: f }]);
    branch([...extra, { j, kind: '>=', v: f + 1 }]);
  };
  branch([]);
  const found = best as { x: number[]; z: number } | null;
  if (!found) {
    const st = firstStatus === 'nemarginit' ? 'nemarginit' : 'imposibil';
    return { status: st, x: p.x0.slice(), obj: F0[0], linear: true, violation: Infinity };
  }
  const x = found.x.map(tidy);
  const F = p.measure(x) ?? F0;
  return { status: nodes > 3000 ? 'aproape' : 'optim', x, obj: F[0], linear: true, violation: violationOf(p, x, F) };
}

/** Rotunjește zgomotul de calcul (2,9999999999997 → 3). */
function tidy(v: number): number {
  const r = Math.round(v);
  if (Math.abs(v - r) < 1e-9 * Math.max(1, Math.abs(v))) return r === 0 ? 0 : r;
  return Number(v.toPrecision(12));
}

function solveNonlinear(p: SolverProblem): SolverResult {
  const sign = p.goal === 'min' ? 1 : -1; // minimizăm
  const intSet = new Set([...p.ints, ...p.bins]);
  const cost = (x: number[], mu: number, round = false): number => {
    const xx = round ? x.map((v, j) => (intSet.has(j) ? Math.round(v) : v)) : x;
    const F = p.measure(xx);
    if (!F || F.some((v) => !Number.isFinite(v))) return Infinity;
    let pen = 0;
    p.ops.forEach((op, k) => {
      const d = F[1 + 2 * k] - F[2 + 2 * k];
      const e = op === '<=' ? Math.max(0, d) : op === '>=' ? Math.max(0, -d) : d;
      pen += e * e;
    });
    if (p.nonneg) xx.forEach((v) => { if (v < 0) pen += v * v; });
    for (const j of p.bins) { if (xx[j] < 0) pen += xx[j] ** 2; if (xx[j] > 1) pen += (xx[j] - 1) ** 2; }
    const o = p.goal === 'value' ? (F[0] - (p.target ?? 0)) ** 2 * mu : sign * F[0];
    return o + mu * pen;
  };
  let x = p.x0.slice();
  for (const mu of [1e2, 1e4, 1e6, 1e8, 1e10]) {
    for (let restart = 0; restart < 3; restart++) x = nelderMead((y) => cost(y, mu), x, 4000);
  }
  // Celulele întregi: rotunjim, apoi mai căutăm pentru celelalte, cu cele întregi fixate.
  if (intSet.size) {
    const fixed = x.map((v, j) => (intSet.has(j) ? Math.round(v) : v));
    const freeIdx = fixed.map((_, j) => j).filter((j) => !intSet.has(j));
    if (freeIdx.length) {
      const put = (y: number[]) => { const z = fixed.slice(); freeIdx.forEach((j, i) => (z[j] = y[i])); return z; };
      const y = nelderMead((y) => cost(put(y), 1e10), freeIdx.map((j) => fixed[j]), 4000);
      x = put(y);
    } else x = fixed;
  }
  x = x.map((v, j) => (intSet.has(j) ? Math.round(v) : v));
  // Curățăm zgomotul doar dacă nu strică rezultatul.
  const F = p.measure(x);
  if (!F) return { status: 'eroare', x: p.x0.slice(), obj: NaN, linear: false, violation: Infinity };
  const xt = x.map(tidy), Ft = p.measure(xt);
  const use = Ft && violationOf(p, xt, Ft) <= Math.max(violationOf(p, x, F), 1e-9) && sign * Ft[0] <= sign * F[0] + 1e-9 * Math.max(1, Math.abs(F[0]));
  const xs = use ? xt : x, Fs = use ? Ft! : F;
  const v = violationOf(p, xs, Fs);
  return { status: v <= 1e-6 ? 'optim' : v <= 1e-3 ? 'aproape' : 'imposibil', x: xs, obj: Fs[0], linear: false, violation: v };
}

// ---------- Metoda evolutivă ----------
// Pentru formulele care sar (DACĂ, ROTUNJIRE, căutări în tabele), unde căutarea în pantă se blochează: o populație de soluții
// care se amestecă (evoluție diferențială). Dintre două soluții câștigă cea care încalcă mai puțin condițiile, apoi cea cu
// obiectivul mai bun. Celulele întregi / 0-1 se rotunjesc la fiecare încercare. La sfârșit soluția se lustruiește cu Nelder–Mead.

/** Numere pseudo-aleatoare cu sămânță fixă (același model dă același rezultat). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Limitele fiecărei celule schimbate: din condițiile de forma „celulă ≤ / ≥ număr”, altfel o fereastră largă în jurul valorii de pornire.
 *  `softLo` / `softHi`: limita e doar ghicită (fereastra), deci se poate lărgi. */
export function solverBounds(p: SolverProblem): { lo: number[]; hi: number[]; softLo: boolean[]; softHi: boolean[] } {
  const lo: number[] = p.x0.map(() => -Infinity), hi: number[] = p.x0.map(() => Infinity);
  // O condiție e o limită pentru celula j dacă stânga urmează exact celula j și dreapta nu se schimbă (verificat în două puncte).
  const a = p.x0.map((v, j) => v + 1.37 + j * 0.61), b = p.x0.map((v, j) => v - 2.29 + j * 0.17);
  const Fa = p.measure(a), Fb = p.measure(b);
  if (Fa && Fb) p.ops.forEach((op, k) => {
    const L = 1 + 2 * k, R = 2 + 2 * k;
    if (Fa[R] !== Fb[R] || op === '=') return;
    const j = a.findIndex((v, i) => Fa[L] === v && Fb[L] === b[i]);
    if (j < 0) return;
    if (op === '<=') hi[j] = Math.min(hi[j], Fa[R]); else lo[j] = Math.max(lo[j], Fa[R]);
  });
  p.x0.forEach((_, j) => {
    if (p.nonneg) lo[j] = Math.max(lo[j], 0);
    if (p.bins.includes(j)) { lo[j] = Math.max(lo[j], 0); hi[j] = Math.min(hi[j], 1); }
  });
  const softLo = lo.map((l) => !Number.isFinite(l)), softHi = hi.map((h) => !Number.isFinite(h));
  p.x0.forEach((v, j) => {
    const span = Math.max(100, 10 * Math.abs(v));
    if (!Number.isFinite(lo[j]) && !Number.isFinite(hi[j])) { lo[j] = v - span; hi[j] = v + span; }
    else if (!Number.isFinite(lo[j])) lo[j] = Math.min(v, hi[j]) - span;
    else if (!Number.isFinite(hi[j])) hi[j] = Math.max(v, lo[j]) + span;
    if (hi[j] < lo[j]) hi[j] = lo[j];
  });
  return { lo, hi, softLo, softHi };
}

function solveEvolutionary(p: SolverProblem, maxEval = 12000): SolverResult {
  const n = p.n, intSet = new Set([...p.ints, ...p.bins]), sign = p.goal === 'min' ? 1 : -1;
  const { lo, hi, softLo, softHi } = solverBounds(p);
  const fix = (x: number[]) => x.map((v, j) => { const c = Math.min(hi[j], Math.max(lo[j], v)); return intSet.has(j) ? Math.round(c) : c; });
  // Încălcarea (fără întregi: se rotunjesc mereu) și obiectivul de micșorat.
  const judge = (x: number[]): { x: number[]; v: number; o: number } => {
    const F = p.measure(x);
    if (!F || F.some((t) => !Number.isFinite(t))) return { x, v: Infinity, o: Infinity };
    let v = 0;
    p.ops.forEach((op, k) => {
      const d = F[1 + 2 * k] - F[2 + 2 * k], s = Math.max(1, Math.abs(F[2 + 2 * k]));
      v += (op === '<=' ? Math.max(0, d) : op === '>=' ? Math.max(0, -d) : Math.abs(d)) / s;
    });
    const o = p.goal === 'value' ? Math.abs(F[0] - (p.target ?? 0)) : sign * F[0];
    return { x, v, o };
  };
  const better = (a: { v: number; o: number }, b: { v: number; o: number }) => (a.v <= 1e-9 && b.v <= 1e-9 ? a.o < b.o : a.v < b.v);
  const rand = rng(12345 + n * 977);
  const NP = Math.max(20, Math.min(60, 10 * n));
  let evals = 0;
  let best = judge(fix(p.x0));
  // Câteva ture: dacă cea mai bună soluție ajunge la o margine ghicită a ferestrei, fereastra se lărgește de 3 ori și se reia.
  for (let round = 0; round < 5 && evals < maxEval; round++) {
    let pop = Array.from({ length: NP }, (_, i) => (i ? judge(fix(lo.map((l, j) => l + rand() * (hi[j] - l)))) : best));
    evals += NP - 1;
    best = pop.reduce((a, b) => (better(b, a) ? b : a));
    let still = 0;
    while (evals < maxEval && still < 60) {
      const before = best;
      const next = pop.map((cur, i) => {
        let r1, r2, r3;
        do r1 = Math.floor(rand() * NP); while (r1 === i);
        do r2 = Math.floor(rand() * NP); while (r2 === i || r2 === r1);
        do r3 = Math.floor(rand() * NP); while (r3 === i || r3 === r1 || r3 === r2);
        const F = 0.5 + rand() * 0.4, CR = 0.9, jr = Math.floor(rand() * n);
        // Jumătate din încercări pornesc de la cea mai bună soluție (converge mai repede), restul de la una oarecare.
        const base = rand() < 0.5 ? best.x : pop[r1].x;
        const trial = cur.x.map((v, j) => (j === jr || rand() < CR ? base[j] + F * (pop[r2].x[j] - pop[r3].x[j]) : v));
        const t = judge(fix(trial)); evals++;
        return better(t, cur) || (t.v === cur.v && t.o === cur.o) ? t : cur;
      });
      pop = next;
      best = pop.reduce((a, b) => (better(b, a) ? b : a), best);
      still = best === before || (best.v === before.v && Math.abs(best.o - before.o) <= 1e-12 * Math.max(1, Math.abs(before.o))) ? still + 1 : 0;
    }
    let grew = false;
    best.x.forEach((v, j) => {
      const w = hi[j] - lo[j], edge = Math.max(1e-9, w * 0.02);
      if (softHi[j] && hi[j] - v <= edge) { hi[j] += 2 * Math.max(w, 1); grew = true; }
      if (softLo[j] && v - lo[j] <= edge) { lo[j] -= 2 * Math.max(w, 1); grew = true; }
    });
    if (!grew) break;
  }
  // Lustruirea: celulele întregi rămân fixe, celelalte se caută mai fin (doar dacă soluția rămâne la fel de bună).
  let x = best.x;
  const freeIdx = x.map((_, j) => j).filter((j) => !intSet.has(j));
  if (freeIdx.length) {
    const put = (y: number[]) => fix(freeIdx.reduce((z, j, i) => { z[j] = y[i]; return z; }, x.slice()));
    const cost = (y: number[]) => { const r = judge(put(y)); return r.v * 1e10 + r.o; };
    const y = nelderMead(cost, freeIdx.map((j) => x[j]), 3000);
    const c = judge(put(y));
    if (!better(best, c)) x = c.x;
  }
  const F = p.measure(x);
  if (!F) return { status: 'eroare', x: p.x0.slice(), obj: NaN, linear: false, violation: Infinity };
  const xt = fix(x.map(tidy)), Ft = p.measure(xt);
  const use = Ft && violationOf(p, xt, Ft) <= Math.max(violationOf(p, x, F), 1e-9) && (p.goal === 'value' || sign * Ft[0] <= sign * F[0] + 1e-9 * Math.max(1, Math.abs(F[0])));
  const xs = use ? xt : x, Fs = use ? Ft! : F;
  const v = violationOf(p, xs, Fs);
  return { status: v <= 1e-6 ? 'optim' : v <= 1e-3 ? 'aproape' : 'imposibil', x: xs, obj: Fs[0], linear: false, violation: v };
}

/** Nelder–Mead simplu (reflexie, extindere, contracție, micșorare). */
export function nelderMead(f: (x: number[]) => number, x0: number[], maxEval = 2000): number[] {
  const n = x0.length;
  if (!n) return x0;
  const pts: { x: number[]; v: number }[] = [{ x: x0.slice(), v: f(x0) }];
  for (let i = 0; i < n; i++) {
    const x = x0.slice();
    x[i] = x[i] !== 0 ? x[i] * 1.1 + 0.5 : 1;
    pts.push({ x, v: f(x) });
  }
  let evals = n + 1;
  while (evals < maxEval) {
    pts.sort((a, b) => a.v - b.v);
    const span = Math.abs(pts[n].v - pts[0].v), size = Math.max(...pts.slice(1).map((p) => Math.max(...p.x.map((v, j) => Math.abs(v - pts[0].x[j])))));
    if (span <= 1e-14 * Math.max(1, Math.abs(pts[0].v)) && size < 1e-10 * Math.max(1, ...pts[0].x.map(Math.abs))) break;
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += pts[i].x[j] / n;
    const at = (t: number) => c.map((v, j) => v + t * (pts[n].x[j] - v));
    const r = at(-1), fr = f(r); evals++;
    if (fr < pts[0].v) {
      const e = at(-2), fe = f(e); evals++;
      pts[n] = fe < fr ? { x: e, v: fe } : { x: r, v: fr };
    } else if (fr < pts[n - 1].v) pts[n] = { x: r, v: fr };
    else {
      const k = fr < pts[n].v ? at(-0.5) : at(0.5), fk = f(k); evals++;
      if (fk < Math.min(fr, pts[n].v)) pts[n] = { x: k, v: fk };
      else {
        for (let i = 1; i <= n; i++) { pts[i].x = pts[i].x.map((v, j) => pts[0].x[j] + 0.5 * (v - pts[0].x[j])); pts[i].v = f(pts[i].x); }
        evals += n;
      }
    }
  }
  pts.sort((a, b) => a.v - b.v);
  return pts[0].x;
}

export function solve(p: SolverProblem): SolverResult {
  if (!p.n) return { status: 'eroare', x: [], obj: NaN, linear: false, violation: Infinity };
  const F0 = p.measure(p.x0);
  if (!F0) return { status: 'eroare', x: p.x0.slice(), obj: NaN, linear: false, violation: Infinity };
  if (p.method === 'evo') return solveEvolutionary(p);
  const lin = linearForm(p);
  if (lin) return solveLinear(p, lin.F0, lin.J);
  return solveNonlinear(p);
}

/** O limită din raportul de limite: cea mai mică / mare valoare a celulei și obiectivul atunci (null = fără limită). */
export interface SolverLimit { lo: number | null; loObj: number | null; hi: number | null; hiObj: number | null }

/** Raportul de limite (ca Limits Report): pentru fiecare celulă schimbată, cât de jos / sus poate merge când celelalte
 *  rămân la valorile din x (soluția găsită) și toate condițiile sunt respectate, plus obiectivul în acele puncte.
 *  Doar pentru modelele liniare fără numere întregi (altfel întoarce null). */
export function solverLimits(p: SolverProblem, x: number[]): SolverLimit[] | null {
  if (p.ints.length || p.bins.length || !linearForm(p)) return null;
  return x.map((_, i) => {
    const at = (y: number) => x.map((v, k) => (k === i ? y : v));
    const one = (goal: 'min' | 'max'): [number | null, number | null] => {
      const r = solve({ ...p, n: 1, x0: [x[i]], ints: [], bins: [], goal, target: undefined,
        measure: (y) => { const F = p.measure(at(y[0])); return F && [y[0], ...F.slice(1)]; } });
      if (r.status !== 'optim') return [null, null];
      const F = p.measure(at(r.x[0]));
      return [r.x[0], F ? F[0] : null];
    };
    const [lo, loObj] = one('min'), [hi, hiObj] = one('max');
    return { lo, loObj, hi, hiObj };
  });
}

/** Raportul de sensibilitate (ca Sensitivity Report, fără intervalele permise): costul redus al fiecărei celule schimbate
 *  (cât se schimbă obiectivul dacă celula, aflată la 0, ar crește cu 1; 0 dacă nu e la 0) și prețul umbră al fiecărei
 *  condiții <=, >=, = (cât se schimbă obiectivul dacă partea dreaptă crește cu 1). Se măsoară rezolvând din nou cu o
 *  mică schimbare; null pentru „egal cu”, numere întregi sau formule neliniare, ori dacă o rezolvare nu reușește. */
export function solverSensitivity(p: SolverProblem, x: number[], obj: number): { reduced: (number | null)[]; shadow: (number | null)[] } | null {
  if (p.goal === 'value' || p.ints.length || p.bins.length || !linearForm(p)) return null;
  const tidy = (v: number) => { const r = Number(v.toPrecision(8)); return Math.abs(r) < 1e-9 ? 0 : r; };
  const again = (q: SolverProblem, d: number) => { const r = solve({ ...q, x0: x }); return r.status === 'optim' ? tidy((r.obj - obj) / d) : null; };
  const scale = Math.max(1, ...x.map(Math.abs));
  const reduced = x.map((v, i) => {
    if (!p.nonneg || Math.abs(v) > 1e-9 * scale) return 0;
    const d = 1e-4 * scale;
    return again({ ...p, ops: [...p.ops, '>='], measure: (y) => { const F = p.measure(y); return F && [...F, y[i], d]; } }, d);
  });
  const shadow = p.ops.map((_, k) => {
    const F0 = p.measure(x);
    const d = 1e-4 * Math.max(1, Math.abs(F0 ? F0[2 + 2 * k] : 1));
    return again({ ...p, measure: (y) => { const F = p.measure(y); if (!F) return F; const G = F.slice(); G[2 + 2 * k] += d; return G; } }, d);
  });
  return { reduced, shadow };
}

/** Intervalele permise din raportul de sensibilitate (null = fără limită). */
export interface SolverRanges { cInc: (number | null)[]; cDec: (number | null)[]; rInc: (number | null)[]; rDec: (number | null)[] }

/** Intervalele permise (ca Allowable Increase / Decrease): cât poate crește / scădea coeficientul fiecărei celule în obiectiv
 *  fără să se schimbe soluția, și cât poate crește / scădea partea dreaptă a fiecărei condiții fără să se schimbe prețul umbră.
 *  Se lucrează pe forma liniară a modelului (o singură măsurare a foii pentru tot), cu căutare prin dublare, apoi înjumătățire.
 *  null pentru „egal cu”, numere întregi, formule neliniare sau modele foarte mari (peste 60 de celule și condiții). */
export function solverRanges(p: SolverProblem): SolverRanges | null {
  if (p.goal === 'value' || p.ints.length || p.bins.length || p.n + p.ops.length > 60) return null;
  const lin = linearForm(p);
  if (!lin) return null;
  const { F0, J } = lin;
  const at = (F: number[], Jm: number[][]) =>
    solveLinear({ ...p, measure: (y) => F.map((f, k) => f + Jm[k].reduce((s, a, j) => s + a * (y[j] - p.x0[j]), 0)) }, F, Jm);
  const base = at(F0, J);
  if (base.status !== 'optim') return null;
  const scale = Math.max(1, ...base.x.map(Math.abs));
  const same = (y: number[]) => y.every((v, j) => Math.abs(v - base.x[j]) <= 1e-6 * scale);
  // Cel mai mare t ≥ 0 pentru care ok(t) rămâne adevărat; null dacă merge oricât (peste 10 miliarde × unitatea).
  const reach = (ok: (t: number) => boolean, unit: number): number | null => {
    let lo = 0, hi = unit * 1e-3;
    while (ok(hi)) { lo = hi; hi *= 2; if (hi > 1e10 * unit) return null; }
    for (let i = 0; i < 40 && hi - lo > 1e-12 * unit; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    const r = Number(lo.toPrecision(7));
    return Math.abs(r) < 1e-9 * unit ? 0 : r;
  };
  const coef = (i: number, sgn: number) => reach((t) => {
    const Jt = J.map((r) => r.slice()); Jt[0][i] += sgn * t;
    const r = at(F0, Jt);
    return r.status === 'optim' && same(r.x);
  }, Math.max(1, Math.abs(J[0][i])));
  const objAt = (k: number, d: number) => { const F = F0.slice(); F[2 + 2 * k] += d; const r = at(F, J); return r.status === 'optim' ? r.obj : null; };
  const rhs = (k: number, sgn: number) => {
    const unit = Math.max(1, Math.abs(F0[2 + 2 * k])), d = 1e-4 * unit;
    const o1 = objAt(k, sgn * d);
    if (o1 === null) return 0;
    // Întâi cu panta măsurată pe un pas mic și o toleranță largă; apoi panta se măsoară din nou la jumătatea intervalului găsit
    // (mult mai precis) și se caută iar, cu toleranță strânsă, ca limita să iasă exactă.
    const linear = (slope: number, tol: number) => (t: number) => { const o = objAt(k, sgn * t); return o !== null && Math.abs(o - (base.obj + slope * t)) <= tol * Math.max(1, Math.abs(base.obj), Math.abs(slope * t)); };
    const t1 = reach(linear((o1 - base.obj) / d, 1e-7), unit);
    if (t1 === null || t1 <= 2 * d) return t1;
    const oh = objAt(k, sgn * t1 / 2);
    return oh === null ? t1 : reach(linear((oh - base.obj) / (t1 / 2), 1e-10), unit);
  };
  return {
    cInc: base.x.map((_, i) => coef(i, 1)), cDec: base.x.map((_, i) => coef(i, -1)),
    rInc: p.ops.map((_, k) => rhs(k, 1)), rDec: p.ops.map((_, k) => rhs(k, -1)),
  };
}

/** Mesajul pentru utilizator. */
export function solverMessage(r: SolverResult, goal: SolverGoal): string {
  switch (r.status) {
    case 'optim': return goal === 'value' ? 'Am găsit o soluție care dă valoarea cerută și respectă toate condițiile.'
      : `Am găsit ${r.linear ? 'soluția cea mai bună' : 'o soluție'} care respectă toate condițiile${r.linear ? '' : ' (pentru formule neliniare poate exista una și mai bună, pornind din alte valori)'}.`;
    case 'aproape': return 'Am găsit o soluție aproape bună: condițiile sunt respectate doar aproximativ. Verifică valorile.';
    case 'imposibil': return 'Nu există nicio soluție care să respecte toate condițiile. Verifică condițiile (poate una se bate cap în cap cu alta).';
    case 'nemarginit': return `Obiectivul poate crește la nesfârșit${goal === 'min' ? ' în jos' : ''}: lipsește o condiție care să-l limiteze.`;
    default: return 'Formulele dau eroare pentru valorile de pornire. Corectează-le sau pune alte valori în celulele schimbate.';
  }
}

// ---------- Modelul salvat cu foaia (în .ssheet și în .xlsx) ----------

/** Modelul Rezolvitorului pentru o foaie: ce s-a scris în fereastră (celulele ca text, ca „A1:A2”). */
export interface SheetSolver {
  obj: string;
  goal: SolverGoal;
  target: string;
  vars: string;
  cons: { l: string; op: SolverOp; r: string }[];
  nonneg: boolean;
  /** Metoda aleasă (lipsă = automată). */
  method?: SolverMethod;
}

const OPS: SolverOp[] = ['<=', '>=', '=', 'int', 'bin'];
const GOALS: SolverGoal[] = ['max', 'min', 'value'];
const short = (v: unknown, n = 300) => (typeof v === 'string' ? v.slice(0, n) : '');

/** Modelul citit dintr-un fișier (sau null dacă nu e bun). */
export function cleanSolver(v: unknown): SheetSolver | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const obj = short(o.obj, 20), vars = short(o.vars);
  if (!obj && !vars) return null;
  const cons = Array.isArray(o.cons) ? o.cons.slice(0, 100).flatMap((c) => {
    if (!c || typeof c !== 'object') return [];
    const x = c as Record<string, unknown>;
    return OPS.includes(x.op as SolverOp) ? [{ l: short(x.l), op: x.op as SolverOp, r: short(x.r) }] : [];
  }) : [];
  return { obj, goal: GOALS.includes(o.goal as SolverGoal) ? (o.goal as SolverGoal) : 'max', target: short(o.target, 40), vars, cons, nonneg: o.nonneg !== false, ...(o.method === 'evo' ? { method: 'evo' as const } : {}) };
}

/** Celulele din text („A1:A2, C1”) cu $, cu numele foii în față, pentru numele ascunse din .xlsx. */
function absRef(sheetRef: string, text: string): string {
  return text.toUpperCase().replace(/\$/g, '').split(/[;,\s]+/).filter(Boolean)
    .map((p) => sheetRef + '!' + p.split(':').map((c) => c.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2')).join(':')).join(',');
}

const REL: Record<SolverOp, string> = { '<=': '1', '=': '2', '>=': '3', int: '4', bin: '5' };

/** Numele ascunse (locale foii) în care fișierele .xlsx țin modelul: solver_opt, solver_typ, solver_adj, solver_lhs1… */
export function solverNames(m: SheetSolver, sheetRef: string): { name: string; ref: string }[] {
  const isCellText = (t: string) => /^\$?[A-Z]{1,3}\$?\d+(:\$?[A-Z]{1,3}\$?\d+)?$/i.test(t.trim());
  const out = [
    { name: 'solver_adj', ref: absRef(sheetRef, m.vars) },
    { name: 'solver_opt', ref: absRef(sheetRef, m.obj) },
    { name: 'solver_typ', ref: m.goal === 'max' ? '1' : m.goal === 'min' ? '2' : '3' },
    { name: 'solver_val', ref: m.goal === 'value' && Number.isFinite(Number(m.target.replace(',', '.'))) ? String(Number(m.target.replace(',', '.'))) : '0' },
    { name: 'solver_neg', ref: m.nonneg ? '1' : '2' },
    // Motorul: 1 = neliniar, 3 = evolutiv (2 = simplex; la noi „automată” alege singură între simplex și neliniar).
    { name: 'solver_eng', ref: m.method === 'evo' ? '3' : '1' },
    { name: 'solver_ver', ref: '3' },
  ];
  const cons = m.cons.filter((c) => c.l.trim());
  cons.forEach((c, i) => {
    const r = c.op === 'int' ? '"integer"' : c.op === 'bin' ? '"binary"' : isCellText(c.r) ? absRef(sheetRef, c.r) : String(Number(c.r.trim().replace(',', '.')) || 0);
    out.push({ name: `solver_lhs${i + 1}`, ref: absRef(sheetRef, c.l) }, { name: `solver_rel${i + 1}`, ref: REL[c.op] }, { name: `solver_rhs${i + 1}`, ref: r });
  });
  out.push({ name: 'solver_num', ref: String(cons.length) });
  return out.filter((n) => n.ref);
}

/** Modelul din numele ascunse ale unei foi (nume → valoare). Celulele de pe alte foi nu se pot folosi și se sar. */
export function solverFromNames(names: Record<string, string>): SheetSolver | null {
  const cellsOf = (ref: string | undefined) => (ref ?? '').split(',').map((p) => p.replace(/^.*!/, '').replace(/\$/g, '').trim().toUpperCase())
    .filter((p) => /^[A-Z]{1,3}\d+(:[A-Z]{1,3}\d+)?$/.test(p)).join(', ');
  const obj = cellsOf(names.solver_opt), vars = cellsOf(names.solver_adj);
  if (!obj && !vars) return null;
  const typ = names.solver_typ?.trim();
  const goal: SolverGoal = typ === '2' ? 'min' : typ === '3' ? 'value' : 'max';
  const cons: SheetSolver['cons'] = [];
  const num = Math.min(100, Number(names.solver_num) || 0);
  const byRel: Record<string, SolverOp> = { '1': '<=', '2': '=', '3': '>=', '4': 'int', '5': 'bin' };
  for (let i = 1; i <= num; i++) {
    const l = cellsOf(names[`solver_lhs${i}`]), op = byRel[(names[`solver_rel${i}`] ?? '').trim()];
    if (!l || !op) continue;
    const rhs = (names[`solver_rhs${i}`] ?? '').trim();
    const r = op === 'int' || op === 'bin' ? '' : /!/.test(rhs) || /^\$?[A-Z]{1,3}\$?\d+/i.test(rhs) ? cellsOf(rhs) : rhs.replace(/^=/, '');
    if (op !== 'int' && op !== 'bin' && !r) continue;
    cons.push({ l, op, r: r.replace('.', ',') });
  }
  const val = (names.solver_val ?? '').trim();
  return { obj: obj.split(',')[0], goal, target: goal === 'value' ? val.replace('.', ',') : '', vars, cons, nonneg: (names.solver_neg ?? '1').trim() !== '2', ...((names.solver_eng ?? '').trim() === '3' ? { method: 'evo' as const } : {}) };
}
