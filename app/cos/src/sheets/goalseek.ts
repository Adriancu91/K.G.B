// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Analiză „Ce-ar fi dacă” → Căutare rezultat (Goal Seek, ca în Excel): caută valoarea unei celule cu număr
// pentru care o formulă dă rezultatul dorit (de exemplu: ce dobândă face rata lunară 1.500 lei?).
// Metoda: pași de secantă; când două încercări sunt de o parte și de alta a țintei, se strânge intervalul dintre ele
// (regula falsi, varianta Illinois), care ajunge sigur la soluție dacă formula e continuă.

export interface GoalSeekResult {
  /** S-a găsit o valoare pentru care formula e (aproape) egală cu ținta. */
  ok: boolean;
  /** Cea mai bună valoare găsită pentru celula schimbată. */
  x: number;
  /** Rezultatul formulei la acea valoare. */
  y: number;
  iterations: number;
}

/** Cele mai multe încercări (Excel face tot 100). */
export const MAX_ITER = 100;

/**
 * f(x) = rezultatul formulei când celula schimbată are valoarea x (undefined = eroare, de exemplu #DIV/0!).
 * Se oprește când rezultatul e la cel mult `tol` de țintă (Excel: 0,001), mai precis dacă se poate.
 */
export function goalSeek(f: (x: number) => number | undefined, target: number, x0: number, maxIter = MAX_ITER, tol = 0.001): GoalSeekResult {
  const g = (x: number) => { const y = f(x); return y === undefined || !Number.isFinite(y) ? undefined : y - target; };
  // Mergem cât de precis permit numerele (altfel ținta 1500 s-ar afișa 1500,0000000005).
  const fine = Math.max(Math.abs(target), 1) * 1e-14;
  let iterations = 0;
  let best = { x: x0, d: Infinity };
  const look = (x: number) => {
    iterations++;
    const d = g(x);
    if (d !== undefined && Math.abs(d) < Math.abs(best.d)) best = { x, d };
    return d;
  };
  const done = () => {
    let x = clean(best.x);
    let y = f(x);
    if (y === undefined || Math.abs(y - target) > Math.max(Math.abs(best.d), fine)) { x = best.x; y = best.d + target; }
    return { ok: Math.abs(y - target) <= tol, x, y, iterations };
  };

  let a = x0;
  let ga = look(a);
  if (ga === undefined) {
    // Pornim din altă parte dacă valoarea de acum dă eroare (de exemplu 0 la numitor).
    for (const t of [1, -1, 0.5, 10, x0 + 1, x0 - 1]) { a = t; ga = look(a); if (ga !== undefined) break; }
    if (ga === undefined) return done();
  }
  if (Math.abs(ga) <= fine) return done();
  let b = a !== 0 ? a * 1.01 : 0.01;
  let gb = look(b);
  for (let k = 0; gb === undefined && k < 20; k++) { b = (a + b) / 2; gb = look(b); }
  if (gb === undefined) return done();

  // Interval cu schimbare de semn: [lo, hi].
  const br = { on: false, lo: 0, hi: 0, glo: 0, ghi: 0, side: 0 };
  const bracket = (x1: number, g1: number, x2: number, g2: number) => {
    if (Math.sign(g1) !== Math.sign(g2)) Object.assign(br, { on: true, lo: x1, glo: g1, hi: x2, ghi: g2, side: 0 });
  };
  const upd = (x: number, gx: number) => {
    if (Math.sign(gx) === Math.sign(br.glo)) { br.lo = x; br.glo = gx; if (br.side === -1) br.ghi /= 2; br.side = -1; }
    else { br.hi = x; br.ghi = gx; if (br.side === 1) br.glo /= 2; br.side = 1; }
  };
  bracket(a, ga, b, gb);

  while (iterations < maxIter && Math.abs(best.d) > fine) {
    if (br.on) {
      // Regula falsi (Illinois): punctul unde dreapta dintre capete taie ținta.
      let x = (br.lo * br.ghi - br.hi * br.glo) / (br.ghi - br.glo);
      if (!Number.isFinite(x)) x = (br.lo + br.hi) / 2;
      let gx = look(x);
      if (gx === undefined) { x = (br.lo + br.hi) / 2; gx = look(x); if (gx === undefined) break; }
      upd(x, gx);
      if (Math.abs(br.hi - br.lo) <= 1e-15 * Math.max(1, Math.abs(br.lo))) break;
      continue;
    }
    // Secantă prin ultimele două încercări.
    let x: number;
    if (gb !== ga && Number.isFinite((b - a) / (gb - ga))) x = b - gb * (b - a) / (gb - ga);
    else x = b + (b - a) * 2 + (b === a ? 1 : 0); // formulă plată aici: încercăm mai departe
    if (!Number.isFinite(x) || Math.abs(x) > 1e300) break;
    // Nu sărim prea departe dintr-o dată (formulele cu puteri sau exponențiale o iau razna).
    const span = Math.max(Math.abs(b - a) * 1e3, Math.abs(b) * 10, 1);
    if (Math.abs(x - b) > span) x = b + Math.sign(x - b) * span;
    let gx = look(x);
    for (let k = 0; gx === undefined && k < 20 && iterations < maxIter; k++) { x = (x + b) / 2; gx = look(x); }
    if (gx === undefined) break;
    bracket(b, gb, x, gx);
    a = b; ga = gb;
    b = x; gb = gx;
  }
  return done();
}
/** 0,0699999999 → 0,07: rotunjim la 12 cifre semnificative dacă rezultatul rămâne la fel de bun. */
function clean(x: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  return Number(x.toPrecision(12));
}
