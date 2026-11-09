// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Imagini → 🌀 Filtre → Textură (Texture din Filter Gallery): Craquelură, Granulație, Plăci de mozaic, Patchwork și Vitraliu.
// Celulele (crăpături, vitraliu) vin dintr-o grilă cu puncte mutate la întâmplare, cu sămânță: același model la fiecare aplicare.

type Px = Uint8ClampedArray;

export const GRAIN_TYPES = ['Obișnuită', 'Moale', 'Stropi', 'Aglomerată', 'Contrastantă', 'Mărită', 'Punctată', 'Orizontală', 'Verticală'];

/** Pseudo-aleator cu sămânță, 0…1. */
function hash(x: number, y: number, s = 0) {
  let t = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1442695041)) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** Medie pe o fereastră de lățime 2r+1, pe rânduri (dx) sau pe coloane, într-un singur canal. */
function box1(a: Float32Array, w: number, h: number, r: number, horiz: boolean, vert: boolean) {
  let cur = a;
  if (horiz) {
    const o = new Float32Array(a.length);
    for (let y = 0; y < h; y++) {
      let s = 0; const row = y * w;
      for (let x = -r; x <= r; x++) s += cur[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { o[row + x] = s / (2 * r + 1); s += cur[row + Math.min(w - 1, x + r + 1)] - cur[row + Math.max(0, x - r)]; }
    }
    cur = o;
  }
  if (vert) {
    const o = new Float32Array(a.length);
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += cur[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { o[y * w + x] = s / (2 * r + 1); s += cur[Math.min(h - 1, y + r + 1) * w + x] - cur[Math.max(0, y - r) * w + x]; }
    }
    cur = o;
  }
  return cur;
}

/** Celula cea mai apropiată și distanța până la granița cu vecina (punctele grilei mutate la întâmplare). */
function cells(w: number, h: number, size: number, seed: number) {
  const id = new Int32Array(w * h), edge = new Float32Array(w * h), gw = Math.ceil(w / size) + 1;
  const pt = (gx: number, gy: number): [number, number] => [(gx + 0.15 + 0.7 * hash(gx, gy, seed)) * size, (gy + 0.15 + 0.7 * hash(gx, gy, seed + 1)) * size];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = Math.floor(x / size), gy = Math.floor(y / size);
    let d1 = 1e18, d2 = 1e18, b = 0, p1: [number, number] = [0, 0], p2: [number, number] = [0, 0];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const p = pt(gx + i, gy + j), d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (d < d1) { d2 = d1; p2 = p1; d1 = d; p1 = p; b = (gy + j + 1) * gw + gx + i + 1; } else if (d < d2) { d2 = d; p2 = p; }
    }
    id[y * w + x] = b;
    // Distanța până la mediatoarea dintre cele două puncte (granița exactă a celulei).
    const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, nx = p2[0] - p1[0], ny = p2[1] - p1[1], nl = Math.hypot(nx, ny) || 1;
    edge[y * w + x] = Math.abs(((x - mx) * nx + (y - my) * ny) / nl);
  }
  return { id, edge };
}

/** Craquelură: rețea de crăpături fine, ca vopseaua veche uscată, cu relief. */
export function craquelure(src: Px, w: number, h: number, v: Record<string, number>) {
  const sz = Math.max(4, v.r), { id, edge } = cells(w, h, sz, 11), depth = v.d / 100, bright = v.b / 100, out = src.slice();
  const lw = Math.max(0.6, sz / 25);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4, e = edge[i];
    // Crăpătura întunecă; chiar lângă ea, pe partea de sus-stânga, o margine luminată (relieful).
    const crack = e < lw ? 1 - e / lw : 0;
    const lit = e >= lw && e < lw * 2.5 && x > 0 && y > 0 && id[i - w - 1] !== id[i] ? 0.5 : 0;
    const shade = (hash(id[i], 0, 5) - 0.5) * 0.08;
    const k = (1 - crack * (0.4 + 0.6 * depth)) * (1 + shade + (bright - 0.5) * 0.3) + lit * 0.25 * depth;
    out[o] = src[o] * k; out[o + 1] = src[o + 1] * k; out[o + 2] = src[o + 2] * k;
  }
  return out;
}

/** Granulație: nouă feluri de grăunțe peste poză (de la fină la mărită, stropi, puncte sau dungi). */
export function grain(src: Px, w: number, h: number, v: Record<string, number>) {
  const type = Math.round(v.t), amt = v.v / 100, con = v.c / 100, n = new Float32Array(w * h), out = src.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n[y * w + x] = hash(x, y, 21) - 0.5;
  let g: Float32Array = n;
  if (type === 1) g = box1(n, w, h, 1, true, true).map((q) => q * 2.6);
  else if (type === 3) g = box1(n, w, h, 2, true, true).map((q) => (q > 0.03 ? 0.5 : q < -0.03 ? -0.5 : 0));
  else if (type === 4) g = n.map((q) => (q > 0 ? 0.5 : -0.5));
  else if (type === 5) { g = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = hash(x >> 2, y >> 2, 21) - 0.5; g = box1(g, w, h, 1, true, true); }
  else if (type === 7) g = box1(n, w, h, 6, true, false).map((q) => q * 4);
  else if (type === 8) g = box1(n, w, h, 6, false, true).map((q) => q * 4);
  for (let i = 0, o = 0; i < g.length; i++, o += 4) {
    const L = (0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2]) / 255;
    if (type === 2) {
      // Stropi: puncte rare, deschise pe zonele închise și închise pe cele deschise.
      if (n[i] > 0.5 - 0.06 * amt) { const c = L < 0.5 ? 255 : 0; out[o] = out[o + 1] = out[o + 2] = c; }
      continue;
    }
    if (type === 6) {
      // Punctată: doar puncte negre pe alb, mai dese unde poza e mai închisă.
      const p = n[i] + 0.5, c = p < (1 - L) * (0.4 + amt) ? 0 : 255;
      out[o] = out[o + 1] = out[o + 2] = c;
      continue;
    }
    const d = g[i] * 255 * amt * 1.2;
    for (let c = 0; c < 3; c++) out[o + c] = 128 + (src[o + c] + d - 128) * (1 + con);
  }
  return out;
}

/** Plăci de mozaic: poza tăiată în plăcuțe pătrate, cu rosturi între ele și marginile ușor teșite. */
export function mosaicTiles(src: Px, w: number, h: number, v: Record<string, number>) {
  const sz = Math.max(3, v.r), gr = Math.max(0.5, v.g), gb = v.b / 100, out = src.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, tx = Math.floor(x / sz), ty = Math.floor(y / sz), u = x - tx * sz, q = y - ty * sz;
    const dEdge = Math.min(u, q, sz - 1 - u, sz - 1 - q);
    if (dEdge < gr) { const c = 40 + 180 * gb; out[o] = out[o + 1] = out[o + 2] = c; continue; }
    // Teșitura: sus și stânga mai luminoase, jos și dreapta mai închise; fiecare plăcuță puțin altfel.
    const bev = dEdge < gr + 2 ? (Math.min(u, q) < Math.min(sz - 1 - u, sz - 1 - q) ? 0.12 : -0.15) : 0;
    const k = 1 + bev + (hash(tx, ty, 31) - 0.5) * 0.12;
    out[o] = src[o] * k; out[o + 1] = src[o + 1] * k; out[o + 2] = src[o + 2] * k;
  }
  return out;
}

/** Patchwork: pătrate de o singură culoare (media pătratului), fiecare cu un relief luminat din stânga sus. */
export function patchwork(src: Px, w: number, h: number, v: Record<string, number>) {
  const sz = Math.max(2, Math.round(v.r)), rel = v.v / 100, out = src.slice(), gw = Math.ceil(w / sz);
  const sum = new Float64Array(gw * Math.ceil(h / sz) * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, b = (Math.floor(y / sz) * gw + Math.floor(x / sz)) * 4;
    sum[b] += src[o]; sum[b + 1] += src[o + 1]; sum[b + 2] += src[o + 2]; sum[b + 3]++;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, tx = Math.floor(x / sz), ty = Math.floor(y / sz), b = (ty * gw + tx) * 4, u = x - tx * sz, q = y - ty * sz;
    // Fiecare pătrat iese la altă înălțime, deci și umbra lui e alta.
    const hgt = 0.4 + 0.6 * hash(tx, ty, 41), edge = u === 0 || q === 0 ? 1 : u === sz - 1 || q === sz - 1 ? -1 : 0;
    const k = 1 + edge * rel * 0.35 * hgt;
    for (let c = 0; c < 3; c++) out[o + c] = (sum[b + c] / sum[b + 3]) * k;
  }
  return out;
}

/** Vitraliu: celule de culoare plină (media celulei), despărțite de margini închise, ca plumbul dintre sticle. */
export function stainedGlass(src: Px, w: number, h: number, v: Record<string, number>) {
  const sz = Math.max(3, v.r), bw = Math.max(0.5, v.b), lt = v.l / 100, { id, edge } = cells(w, h, sz, 51), out = src.slice();
  const sums = new Map<number, number[]>();
  for (let i = 0, o = 0; i < id.length; i++, o += 4) {
    let s = sums.get(id[i]);
    if (!s) { s = [0, 0, 0, 0]; sums.set(id[i], s); }
    s[0] += src[o]; s[1] += src[o + 1]; s[2] += src[o + 2]; s[3]++;
  }
  const cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy) || 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4, s = sums.get(id[i])!;
    if (edge[i] < bw / 2) { out[o] = out[o + 1] = out[o + 2] = 20; continue; }
    // Lumina din spatele geamului: mijlocul pozei mai luminos.
    const k = 1 + lt * 0.5 * (1 - Math.hypot(x - cx, y - cy) / R);
    out[o] = (s[0] / s[3]) * k; out[o + 1] = (s[1] / s[3]) * k; out[o + 2] = (s[2] / s[3]) * k;
  }
  return out;
}
