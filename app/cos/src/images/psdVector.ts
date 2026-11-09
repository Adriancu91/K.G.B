// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Măștile vectoriale din .psd (blocurile „vmsk” / „vsms”): traseele formei (puncte cu mânere de curbă), desenate de noi
// într-o mască de pixeli (0–255), ca formele fără pixeli proprii (umplere cu culoare / degrade + contur) să apară cu conturul lor.

type Pt = [number, number];

/** Traseele din bloc, în pixeli (w × h = mărimea pozei), cu felul în care se combină fiecare (ops), plus dacă masca e întoarsă;
 *  stricat sau gol → null. */
export function readVectorMask(b: Uint8Array, w: number, h: number): { paths: Pt[][]; ops: number[]; invert: boolean } | null {
  if (b.length < 8 + 26) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const flags = v.getUint32(4);
  if (flags & 4) return null; // masca e oprită
  // Coordonatele sunt numere cu virgulă fixă 8.24, ca parte din înălțimea / lățimea pozei.
  const fx = (p: number) => (v.getInt32(p) / 16777216);
  const paths: Pt[][] = [], ops: number[] = [];
  // op: -1 = fișier vechi (toate traseele împreună, par-impar), 0 = exclude, 1 = adaugă, 2 = scade, 3 = intersectează.
  let knots: [Pt, Pt, Pt][] = [], left = 0, closed = true, fillAll = false, op = -1;
  const flush = () => {
    if (knots.length >= 2) {
      // Fiecare bucată dintre două puncte e o curbă: ancora, mânerul de plecare, mânerul de sosire al următorului, ancora lui.
      const out: Pt[] = [];
      const n = knots.length, segs = closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const [, a, aOut] = knots[i], [bIn, bp] = knots[(i + 1) % n];
        const len = Math.hypot(bp[0] - a[0], bp[1] - a[1]) + Math.hypot(aOut[0] - a[0], aOut[1] - a[1]) + Math.hypot(bIn[0] - bp[0], bIn[1] - bp[1]);
        const steps = Math.max(1, Math.min(200, Math.ceil(len / 2)));
        for (let s = 0; s < steps; s++) {
          const t = s / steps, u = 1 - t;
          const k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
          out.push([k0 * a[0] + k1 * aOut[0] + k2 * bIn[0] + k3 * bp[0], k0 * a[1] + k1 * aOut[1] + k2 * bIn[1] + k3 * bp[1]]);
        }
      }
      if (!closed) out.push(knots[n - 1][1]);
      paths.push(out);
      ops.push(op);
    }
    knots = [];
  };
  for (let p = 8; p + 26 <= b.length; p += 26) {
    const sel = v.getUint16(p);
    // „Umplerea de pornire” = 1: masca pornește plină, iar traseele scot din ea.
    if (sel === 8) { fillAll = v.getUint16(p + 2) === 1; continue; }
    if (sel === 0 || sel === 3) { flush(); left = v.getUint16(p + 2); op = v.getInt16(p + 4); closed = sel === 0; continue; }
    if ((sel === 1 || sel === 2 || sel === 4 || sel === 5) && left > 0) {
      // Pentru fiecare: mânerul dinainte, ancora, mânerul de după; fiecare ca (y, x).
      const pt = (o: number): Pt => [fx(p + o + 4) * w, fx(p + o) * h];
      knots.push([pt(2), pt(10), pt(18)]);
      if (--left === 0) flush();
    }
  }
  flush();
  if (!paths.length && !fillAll) return null;
  // Cu operații (fișierele noi), „umplerea de pornire” nu întoarce traseele: contează doar când nu e niciun traseu.
  if (ops.some((o) => o >= 0)) return { paths, ops, invert: !!(flags & 1) };
  return { paths, ops, invert: !!(flags & 1) !== fillAll };
}

/** Masca vectorială e oprită în fișier (nu decupează nimic, deci nu se pierde nimic dacă n-o folosim). */
export function vectorMaskOff(b: Uint8Array): boolean {
  return b.length >= 8 && (new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(4) & 4) !== 0;
}

/** Desenează traseele într-o mască w × h (0–255), netezită pe margini. Fără operații (ops): toate împreună, cu regula
 *  par-impar (găurile din forme rămân goale). Cu operații: primul traseu e baza, iar următoarele se adaugă, se scad,
 *  se intersectează sau se exclud din ea, pe rând. */
export function rasterizeVectorMask(paths: Pt[][], w: number, h: number, invert = false, ops?: number[]): Uint8Array {
  let acc: Float32Array;
  if (ops && ops.length === paths.length && ops.some((o) => o >= 0)) {
    acc = new Float32Array(w * h);
    // Un traseu fără operație (-1) o ia pe a celui dinainte.
    let last = 1;
    paths.forEach((p, k) => {
      if (ops[k] >= 0) last = ops[k];
      const c = cover([p], w, h), o = k === 0 ? 1 : last;
      for (let i = 0; i < acc.length; i++) {
        const a = acc[i], q = Math.min(1, c[i]);
        acc[i] = o === 2 ? a * (1 - q) : o === 3 ? a * q : o === 0 ? a + q - 2 * a * q : a + q - a * q;
      }
    });
  } else acc = cover(paths, w, h);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) { const m = Math.min(1, acc[i]); out[i] = Math.round((invert ? 1 - m : m) * 255); }
  return out;
}

/** Cât din fiecare pixel acoperă traseele (0–1), cu regula par-impar și 4 rânduri de probă pe pixel. */
function cover(paths: Pt[][], w: number, h: number): Float32Array {
  const acc = new Float32Array(w * h);
  const edges: [number, number, number, number][] = [];
  for (const pts of paths) for (let i = 0; i < pts.length; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    if (a[1] !== c[1]) edges.push([a[0], a[1], c[0], c[1]]);
  }
  const SUB = 4, xs: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let s = 0; s < SUB; s++) {
      const sy = y + (s + 0.5) / SUB;
      xs.length = 0;
      for (const [x0, y0, x1, y1] of edges) {
        if ((sy >= y0 && sy < y1) || (sy >= y1 && sy < y0)) xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, xs[k]), c = Math.min(w, xs[k + 1]);
        if (c <= a) continue;
        const ia = Math.floor(a), ic = Math.min(w - 1, Math.floor(c));
        const row = y * w;
        if (ia === ic) { acc[row + ia] += (c - a) / SUB; continue; }
        acc[row + ia] += (ia + 1 - a) / SUB;
        for (let x = ia + 1; x < ic; x++) acc[row + x] += 1 / SUB;
        if (ic < w) acc[row + ic] += (c - ic) / SUB;
      }
    }
  }
  return acc;
}
