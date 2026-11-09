// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ✒ Traseu (ca Pen din Photoshop): click pune un colț, click și tragi pune un punct rotunjit (curba trece lin prin el).
// Traseul se face selecție, se conturează sau se umple. Fiecare punct are un mâner (hx, hy) spre care pleacă curba;
// mânerul de intrare e oglinda lui față de punct. Între două puncte e o curbă Bézier cubică. Testat în tests/images-pen.test.mjs.

// (ix, iy): mânerul de intrare, doar când nu e oglinda celui de ieșire (de exemplu după ce s-a adăugat un punct pe curbă).
// c: colț pus cu ◠ Curbură (Alt+click), care rămâne fără mâner când se recalculează traseul.
export type Anchor = { x: number; y: number; hx?: number; hy?: number; ix?: number; iy?: number; c?: boolean };

/** Mânerul de ieșire și cel de intrare ale punctului (fără mâner: chiar punctul, adică un colț). */
export const outH = (p: Anchor): [number, number] => (p.hx === undefined || p.hy === undefined ? [p.x, p.y] : [p.hx, p.hy]);
export const inH = (p: Anchor): [number, number] => (p.ix !== undefined && p.iy !== undefined ? [p.ix, p.iy] : p.hx === undefined || p.hy === undefined ? [p.x, p.y] : [2 * p.x - p.hx, 2 * p.y - p.hy]);

/**
 * ◠ Curbură (ca Curvature Pen): mânerele se pun singure, ca traseul să treacă lin prin toate punctele. Mânerul punctului
 * e paralel cu dreapta dintre vecinii lui și are o șesime din lungimea ei (curba Catmull-Rom scrisă ca Bézier).
 * La capetele traseului deschis vecinul lipsă e chiar punctul. Colțurile (c) rămân fără mâner.
 */
export function curvatureAnchors(a: Anchor[], closed: boolean): Anchor[] {
  const n = a.length;
  return a.map((p, i) => {
    if (p.c) return { x: p.x, y: p.y, c: true };
    if (n < 2) return { x: p.x, y: p.y };
    const prev = closed ? a[(i - 1 + n) % n] : a[Math.max(0, i - 1)], next = closed ? a[(i + 1) % n] : a[Math.min(n - 1, i + 1)];
    return { x: p.x, y: p.y, hx: p.x + (next.x - prev.x) / 6, hy: p.y + (next.y - prev.y) / 6 };
  });
}

/** Bucățile traseului: [start, mâner 1, mâner 2, capăt]. Închis = și bucata de la ultimul punct înapoi la primul. */
function segments(a: Anchor[], closed: boolean): [number, number][][] {
  const out: [number, number][][] = [];
  const n = a.length;
  for (let i = 0; i < n - 1 + (closed && n > 2 ? 1 : 0); i++) {
    const p = a[i], q = a[(i + 1) % n];
    out.push([[p.x, p.y], outH(p), inH(q), [q.x, q.y]]);
  }
  return out;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Traseul ca SVG (la scara k), pentru desenat pe ecran și pentru Path2D. */
export function penPathD(a: Anchor[], closed: boolean, k = 1): string {
  if (!a.length) return '';
  let d = `M${r2(a[0].x * k)} ${r2(a[0].y * k)}`;
  for (const [, c1, c2, e] of segments(a, closed)) d += ` C${r2(c1[0] * k)} ${r2(c1[1] * k)} ${r2(c2[0] * k)} ${r2(c2[1] * k)} ${r2(e[0] * k)} ${r2(e[1] * k)}`;
  return closed && a.length > 2 ? d + ' Z' : d;
}

/** Traseul ca listă de puncte (curbele împărțite în `steps` bucăți drepte), pentru selecție. */
export function flattenPen(a: Anchor[], closed: boolean, steps = 16): [number, number][] {
  if (!a.length) return [];
  const pts: [number, number][] = [[a[0].x, a[0].y]];
  for (const [p0, c1, c2, p3] of segments(a, closed)) {
    const straight = c1[0] === p0[0] && c1[1] === p0[1] && c2[0] === p3[0] && c2[1] === p3[1];
    const n = straight ? 1 : steps;
    for (let s = 1; s <= n; s++) {
      const t = s / n, u = 1 - t;
      const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
      pts.push([b0 * p0[0] + b1 * c1[0] + b2 * c2[0] + b3 * p3[0], b0 * p0[1] + b1 * c1[1] + b2 * c2[1] + b3 * p3[1]]);
    }
  }
  // La traseul închis, ultimul punct e chiar primul: nu-l repetăm.
  if (closed && pts.length > 1) pts.pop();
  return pts;
}

const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const bez = (g: [number, number][], t: number): [number, number] => {
  const u = 1 - t;
  return [u * u * u * g[0][0] + 3 * u * u * t * g[1][0] + 3 * u * t * t * g[2][0] + t * t * t * g[3][0], u * u * u * g[0][1] + 3 * u * u * t * g[1][1] + 3 * u * t * t * g[2][1] + t * t * t * g[3][1]];
};

/** Locul de pe traseu cel mai apropiat de (x, y): bucata, poziția pe ea (0–1) și distanța (în pixelii pozei). */
export function nearestOnPen(a: Anchor[], closed: boolean, x: number, y: number): { seg: number; t: number; d: number } | null {
  let best: { seg: number; t: number; d: number } | null = null;
  segments(a, closed).forEach((g, seg) => {
    // Întâi din 64 de pași, apoi mai fin în jurul celui mai bun pas.
    let bt = 0, bd = Infinity;
    for (let s = 0; s <= 64; s++) { const p = bez(g, s / 64), d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; bt = s / 64; } }
    for (let s = -8; s <= 8; s++) { const t = Math.max(0, Math.min(1, bt + s / 512)), p = bez(g, t), d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; bt = t; } }
    if (!best || bd < best.d) best = { seg, t: bt, d: bd };
  });
  return best;
}

/** Adaugă un punct pe bucata `seg`, la poziția t, fără să schimbe forma traseului (Add Anchor Point). */
export function insertAnchor(a: Anchor[], seg: number, t: number): Anchor[] {
  const n = a.length, i = seg, j = (seg + 1) % n;
  const p = a[i], q = a[j];
  const P0: [number, number] = [p.x, p.y], C1 = outH(p), C2 = inH(q), P3: [number, number] = [q.x, q.y];
  const ab = lerp(P0, C1, t), bc = lerp(C1, C2, t), cd = lerp(C2, P3, t), abc = lerp(ab, bc, t), bcd = lerp(bc, cd, t), m = lerp(abc, bcd, t);
  const out = a.slice();
  const pHas = C1[0] !== P0[0] || C1[1] !== P0[1], qHas = C2[0] !== P3[0] || C2[1] !== P3[1];
  // Mânerele de lângă punctul nou se scurtează; mânerul celălalt al vecinilor rămâne unde era.
  if (pHas) { const pi = inH(p); out[i] = { x: p.x, y: p.y, hx: ab[0], hy: ab[1], ix: pi[0], iy: pi[1] }; }
  if (qHas) out[j] = { ...q, ix: cd[0], iy: cd[1] };
  const straight = !pHas && !qHas;
  const np: Anchor = straight ? { x: m[0], y: m[1] } : { x: m[0], y: m[1], hx: bcd[0], hy: bcd[1], ix: abc[0], iy: abc[1] };
  out.splice(i + 1, 0, np);
  return out;
}

/** Scoate punctul i (Delete Anchor Point); bucățile vecine se unesc într-una. */
export function removeAnchor(a: Anchor[], i: number): Anchor[] {
  return a.filter((_, k) => k !== i);
}

/** Mută tot traseul (Path Selection). */
export function movePen(a: Anchor[], dx: number, dy: number): Anchor[] {
  return a.map((p) => {
    const q: Anchor = { x: p.x + dx, y: p.y + dy };
    if (p.hx !== undefined && p.hy !== undefined) { q.hx = p.hx + dx; q.hy = p.hy + dy; }
    if (p.ix !== undefined && p.iy !== undefined) { q.ix = p.ix + dx; q.iy = p.iy + dy; }
    return q;
  });
}

/** Punctele care rămân după simplificare (Ramer–Douglas–Peucker): se scot cele mai aproape de `tol` de dreapta vecinilor. */
function simplify(p: [number, number][], tol: number): [number, number][] {
  if (p.length < 3) return p.slice();
  const keep = new Uint8Array(p.length);
  keep[0] = keep[p.length - 1] = 1;
  const stack: [number, number][] = [[0, p.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = p[s], [bx, by] = p[e];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let far = -1, at = -1;
    for (let i = s + 1; i < e; i++) {
      const d = len ? Math.abs(dy * (p[i][0] - ax) - dx * (p[i][1] - ay)) / len : Math.hypot(p[i][0] - ax, p[i][1] - ay);
      if (d > far) { far = d; at = i; }
    }
    if (far > tol && at > 0) { keep[at] = 1; stack.push([s, at], [at, e]); }
  }
  return p.filter((_, i) => keep[i]);
}

/**
 * ✒ Traseu → 〰 Liber (ca Freeform Pen): din punctele trase cu mâna face un traseu cu puține puncte. Curba trece lin prin
 * fiecare punct (mânerele pe direcția dintre vecini, cât o treime din fiecare bucată); unde linia se frânge brusc rămâne colț.
 * `tol` = cât se poate depărta traseul de linia trasă (pixeli ai pozei); `closed` = traseul se închide (capătul lângă început).
 */
export function fitFreeform(pts: [number, number][], tol: number, closed: boolean): Anchor[] {
  let p = simplify(pts, tol);
  if (closed && p.length > 3 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < tol * 4) p = p.slice(0, -1);
  const n = p.length;
  if (n < 3) return p.map(([x, y]) => ({ x, y }));
  const r = (v: number) => Math.round(v * 100) / 100;
  return p.map(([x, y], i): Anchor => {
    const prev = closed ? p[(i - 1 + n) % n] : p[i - 1], next = closed ? p[(i + 1) % n] : p[i + 1];
    if (!prev || !next) return { x: r(x), y: r(y) };
    const ux = x - prev[0], uy = y - prev[1], vx = next[0] - x, vy = next[1] - y;
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (!lu || !lv) return { x: r(x), y: r(y) };
    // Frântură mai ascuțită de ~60° față de drum drept: colț.
    if ((ux * vx + uy * vy) / (lu * lv) < 0.5) return { x: r(x), y: r(y) };
    const tx = next[0] - prev[0], ty = next[1] - prev[1], lt = Math.hypot(tx, ty) || 1;
    return { x: r(x), y: r(y), hx: r(x + (tx / lt) * lv / 3), hy: r(y + (ty / lt) * lv / 3), ix: r(x - (tx / lt) * lu / 3), iy: r(y - (ty / lt) * lu / 3) };
  });
}
