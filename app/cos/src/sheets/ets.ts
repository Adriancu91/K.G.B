// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Prognoza cu netezire exponențială triplă (FORECAST.ETS, .CONFINT, .SEASONALITY, .STAT): modelul cu eroare, tendință și
// sezonalitate aditive. Pașii: valorile se ordonează după cronologie (dublurile se adună după regula aleasă, golurile se
// completează), se caută lungimea sezonului (autocorelația valorilor fără tendință), apoi α, β, γ care dau cea mai mică
// eroare pătratică pe un pas înainte (căutare Nelder–Mead). Rezultatele pot diferi puțin de alte programe, care își aleg
// parametrii cu metode proprii, nepublicate.
import { nelderMead } from './solver';

/** Seria pregătită: valorile la pași egali, de la t0; `months` = pasul e în luni (datele cad în aceeași zi a lunii). */
export interface EtsSeries { y: number[]; t0: number; step: number; months?: boolean }

// Datele din foaie sunt numere de zile de la 30.12.1899; pentru pașii lunari le trecem în „luna numărul…”.
const DAY = 86400000, EPOCH = Date.UTC(1899, 11, 30);
const monthIndex = (serial: number) => { const d = new Date(EPOCH + Math.round(serial) * DAY); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const isMonthEnd = (serial: number) => new Date(EPOCH + (Math.round(serial) + 1) * DAY).getUTCDate() === 1;
const dayOf = (serial: number) => new Date(EPOCH + Math.round(serial) * DAY).getUTCDate();
/** Datele sunt lunare: toate în aceeași zi a lunii (sau toate în ultima zi), la cel puțin 28 de zile una de alta. */
function monthly(ts: number[]): boolean {
  if (ts.some((t) => t < 61 || !Number.isInteger(t))) return false;
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] < 28) return false;
  return ts.every((t) => dayOf(t) === dayOf(ts[0]) && dayOf(t) <= 28) || ts.every(isMonthEnd);
}
/** Data aflată la j pași după `last` (cu luni: aceeași zi a lunii, sau ultima zi dacă seria e la sfârșit de lună). */
export function timeAfter(ser: EtsSeries, last: number, j: number): number {
  if (!ser.months) return last + j * ser.step;
  const d = new Date(EPOCH + Math.round(last) * DAY), m = d.getUTCMonth() + j * ser.step;
  const t = isMonthEnd(last) ? Date.UTC(d.getUTCFullYear(), m + 1, 0) : Date.UTC(d.getUTCFullYear(), m, d.getUTCDate());
  return Math.round((t - EPOCH) / DAY);
}
/** Câți pași după ultimul punct e `target` (negativ = în istoric); cu luni, fracțiunea vine din ziua lunii. */
export function stepsAhead(ser: EtsSeries, target: number): number {
  if (!ser.months) return (target - ser.t0) / ser.step - (ser.y.length - 1);
  const m = monthIndex(target), d = new Date(EPOCH + Math.floor(target) * DAY);
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const frac = isMonthEnd(ser.t0) ? (isMonthEnd(target) ? 0 : d.getUTCDate() / days - 1) : (d.getUTCDate() - dayOf(ser.t0)) / days;
  return (m - monthIndex(ser.t0)) / ser.step + frac / ser.step - (ser.y.length - 1);
}
export interface EtsModel {
  alpha: number; beta: number; gamma: number; season: number;
  /** Prognozele pe un pas înainte pentru fiecare punct (aceeași ordine ca y). */
  fitted: number[];
  level: number; trend: number; seasonal: number[];
  sse: number; n: number;
}

/** Codul erorii (ca text, „#NUM!”) sau seria pregătită. */
export function prepareSeries(pairs: [number, number][], completion = 1, aggregation = 1): EtsSeries | string {
  if (pairs.length < 3) return '#N/A';
  if (![0, 1].includes(completion) || !(aggregation >= 1 && aggregation <= 7)) return '#NUM!';
  // Dublurile din cronologie: AVERAGE, COUNT, COUNTA, MAX, MEDIAN, MIN, SUM.
  const byT = new Map<number, number[]>();
  for (const [v, t] of pairs) { const l = byT.get(t); if (l) l.push(v); else byT.set(t, [v]); }
  const agg = (l: number[]) => {
    const s = [...l].sort((a, b) => a - b);
    switch (aggregation) {
      case 2: case 3: return l.length;
      case 4: return s[s.length - 1];
      case 5: return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
      case 6: return s[0];
      case 7: return l.reduce((a, b) => a + b, 0);
      default: return l.reduce((a, b) => a + b, 0) / l.length;
    }
  };
  const ts = [...byT.keys()].sort((a, b) => a - b);
  if (ts.length < 3) return '#N/A';
  // Pasul: cea mai mică diferență; toate diferențele trebuie să fie multipli ai lui.
  // Pași lunari (lunile au 28–31 de zile): socotim în luni.
  const months = monthly(ts);
  const pos = months ? ts.map(monthIndex) : ts;
  let step = Infinity;
  for (let i = 1; i < ts.length; i++) step = Math.min(step, pos[i] - pos[i - 1]);
  if (!(step > 0)) return '#NUM!';
  const y: number[] = [agg(byT.get(ts[0])!)];
  for (let i = 1; i < ts.length; i++) {
    const k = (pos[i] - pos[i - 1]) / step;
    if (Math.abs(k - Math.round(k)) > 1e-6 * Math.max(1, k)) return '#NUM!';
    const v = agg(byT.get(ts[i])!), prev = y[y.length - 1];
    for (let j = 1; j < Math.round(k); j++) y.push(completion ? prev + ((v - prev) * j) / Math.round(k) : 0);
    y.push(v);
    if (y.length > 100000) return '#NUM!';
  }
  return { y, t0: ts[0], step, ...(months ? { months: true } : {}) };
}

/** Lungimea sezonului găsită în date (1 = fără sezon): vârful autocorelației valorilor fără tendința liniară. */
export function detectSeason(y: number[]): number {
  const n = y.length;
  if (n < 6) return 1;
  const xm = (n - 1) / 2, ym = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  y.forEach((v, i) => { sxy += (i - xm) * (v - ym); sxx += (i - xm) ** 2; });
  const b = sxy / sxx, r = y.map((v, i) => v - ym - b * (i - xm));
  const den = r.reduce((s, v) => s + v * v, 0);
  if (!(den > 1e-12 * Math.max(1, ym * ym) * n)) return 1;
  const maxLag = Math.min(Math.floor(n / 2), 8760);
  const acf = [1];
  for (let k = 1; k <= maxLag + 1; k++) { let s = 0; for (let t = 0; t + k < n; t++) s += r[t] * r[t + k]; acf.push(s / den); }
  let best = 0, bestV = 0.3; // sub 0,3 nu e un tipar care se repetă
  for (let k = 2; k <= maxLag; k++) if (acf[k] > bestV && acf[k] >= acf[k - 1] && acf[k] >= (acf[k + 1] ?? -Infinity)) { best = k; bestV = acf[k]; }
  if (!best) return 1;
  // Dacă un divizor al lui are aproape aceeași autocorelație, sezonul e cel scurt (12 și nu 24).
  for (let d = 2; d <= best; d++) {
    const k = best / d;
    if (Number.isInteger(k) && k >= 2 && acf[k] >= 0.9 * bestV) return k;
  }
  return best;
}

const sig = (v: number) => 1 / (1 + Math.exp(-v));
const logit = (p: number) => Math.log(p / (1 - p));

/** Modelul pentru parametrii daţi (α, β, γ reale, β ≤ α, γ ≤ 1 - α). */
function run(y: number[], m: number, alpha: number, beta: number, gamma: number): EtsModel {
  const n = y.length;
  let level: number, trend: number;
  const s = new Array(Math.max(m, 1)).fill(0);
  if (m >= 2 && n >= 2 * m) {
    const a = y.slice(0, m).reduce((p, q) => p + q, 0) / m, c = y.slice(m, 2 * m).reduce((p, q) => p + q, 0) / m;
    trend = (c - a) / m; level = a - trend * (m - 1) / 2 - trend;
    for (let i = 0; i < m; i++) s[i] = y[i] - (a + trend * (i - (m - 1) / 2));
  } else { level = y[0] - (y[1] - y[0]); trend = y[1] - y[0]; }
  const fitted: number[] = [];
  let sse = 0;
  for (let t = 0; t < n; t++) {
    const si = m >= 2 ? s[t % m] : 0;
    const f = level + trend + si, e = y[t] - f;
    fitted.push(f); sse += e * e;
    level = level + trend + alpha * e;
    trend = trend + beta * e;
    if (m >= 2) s[t % m] = si + gamma * e;
  }
  return { alpha, beta, gamma: m >= 2 ? gamma : 0, season: m >= 2 ? m : 1, fitted, level, trend, seasonal: s, sse, n };
}

/** Potrivește modelul: `season` = 1 caută singur sezonul, 0 fără sezon, altfel lungimea dată. */
export function fitEts(y: number[], season = 1): EtsModel | string {
  if (!Number.isInteger(season) || season < 0 || season > 8760) return '#NUM!';
  const m0 = season === 1 ? detectSeason(y) : season;
  const m = m0 >= 2 && y.length >= 2 * m0 ? m0 : m0 >= 2 ? -1 : 0;
  if (m < 0) return '#NUM!'; // sezonul cerut e mai lung decât jumătate din date
  const params = (p: number[]) => { const a = 0.001 + 0.998 * sig(p[0]); return [a, a * sig(p[1]), (1 - a) * sig(p[2])]; };
  const cost = (p: number[]) => { const [a, b, g] = params(p); return run(y, m, a, b, g).sse; };
  let best = [logit(0.3), logit(0.1), logit(0.1)];
  for (const start of [best, [logit(0.7), logit(0.3), logit(0.3)], [logit(0.1), logit(0.05), logit(0.5)]]) {
    const p = nelderMead(cost, start, 1500);
    if (cost(p) < cost(best)) best = p;
  }
  const [a, b, g] = params(best);
  return run(y, m, a, b, g);
}

/** Prognoza la h pași după ultimul punct (h poate fi cu zecimale; între pași se ia linia dreaptă). h ≤ 0: în istoric. */
export function etsForecast(md: EtsModel, h: number): number {
  const at = (k: number) => {
    if (k <= 0) return md.fitted[Math.max(0, md.n - 1 + k)];
    const si = md.season >= 2 ? md.seasonal[(md.n - 1 + k) % md.season] : 0;
    return md.level + k * md.trend + si;
  };
  const lo = Math.floor(h), f = h - lo;
  return f < 1e-9 ? at(lo) : at(lo) * (1 - f) + at(lo + 1) * f;
}

/** Jumătatea intervalului de încredere la h pași (z = cuantila normală pentru (1 + încrederea) / 2). */
export function etsConfint(md: EtsModel, h: number, z: number): number {
  const sigma2 = md.sse / Math.max(1, md.n);
  const H = Math.max(1, Math.ceil(h));
  let v = 1;
  for (let j = 1; j < H; j++) {
    const c = md.alpha + md.beta * j + (md.season >= 2 && j % md.season === 0 ? md.gamma : 0);
    v += c * c;
  }
  return z * Math.sqrt(sigma2 * v);
}

/** Statisticile modelului (FORECAST.ETS.STAT): 1 α, 2 β, 3 γ, 4 MASE, 5 SMAPE, 6 MAE, 7 RMSE, 8 pasul. */
export function etsStat(md: EtsModel, y: number[], step: number, type: number): number | string {
  const e = y.map((v, i) => v - md.fitted[i]);
  const mae = e.reduce((s, v) => s + Math.abs(v), 0) / y.length;
  switch (type) {
    case 1: return md.alpha;
    case 2: return md.beta;
    case 3: return md.gamma;
    case 4: { let d = 0; for (let i = 1; i < y.length; i++) d += Math.abs(y[i] - y[i - 1]); d /= y.length - 1; return d > 0 ? mae / d : '#DIV/0!'; }
    case 5: return y.reduce((s, v, i) => s + (Math.abs(v) + Math.abs(md.fitted[i]) > 0 ? (2 * Math.abs(e[i])) / (Math.abs(v) + Math.abs(md.fitted[i])) : 0), 0) / y.length;
    case 6: return mae;
    case 7: return Math.sqrt(e.reduce((s, v) => s + v * v, 0) / y.length);
    case 8: return step;
    default: return '#NUM!';
  }
}
