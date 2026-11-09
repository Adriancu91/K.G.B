// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Imagini → 🌀 Filtre → Randare: Copac și Flăcări (Tree, Flame), desenate de noi direct pe pixeli, peste poză.
// Mărimile sunt în procente din poză, deci previzualizarea micșorată arată la fel ca rezultatul.

type Px = Uint8ClampedArray;

/** Pseudo-aleator cu sămânță: același copac / foc la fiecare aplicare. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TREE_TYPES = ['Stejar (coroană largă)', 'Brad', 'Salcie (ramuri care cad)', 'Mesteacăn', 'Copac de toamnă', 'Copac fără frunze'];
export const FLAME_TYPES = ['Foc de-a lungul marginii de jos', 'O flacără', 'Lumânare (flacără liniștită)'];
export const FLAME_COLORS = ['Naturală', 'Albastră (gaz)', 'Verde', 'Violet'];

/** Amestecă o culoare peste pixel, cu acoperirea a (0…1). */
function put(out: Px, o: number, r: number, g: number, b: number, a: number) {
  if (a <= 0) return;
  if (a > 1) a = 1;
  out[o] += (r - out[o]) * a; out[o + 1] += (g - out[o + 1]) * a; out[o + 2] += (b - out[o + 2]) * a;
  out[o + 3] += (255 - out[o + 3]) * a;
}

/** O bucată de ramură: un trunchi de con de la (x0, y0, r0) la (x1, y1, r1), luminat din stânga sus, cu marginile netede. */
function branch(out: Px, w: number, h: number, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, col: readonly number[], marks: number) {
  const rm = Math.max(r0, r1) + 1, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2);
  const nx = -dy / L, ny = dx / L, lit = nx * -0.7 + ny * -0.7 >= 0 ? 1 : -1;
  const xa = Math.max(0, Math.floor(Math.min(x0, x1) - rm)), xb = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + rm));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1) - rm)), yb = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + rm));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x - x0, py = y - y0, t = Math.max(0, Math.min(1, (px * dx + py * dy) / L2));
    const r = r0 + (r1 - r0) * t, ex = px - dx * t, ey = py - dy * t, d = Math.hypot(ex, ey), a = r + 0.5 - d;
    if (a <= 0) continue;
    // Umbrirea cilindrică: partea dinspre lumină e mai deschisă, cealaltă mai închisă.
    const across = r > 0 ? (ex * nx + ey * ny) / Math.max(0.5, r) : 0, sh = 1 + 0.35 * lit * across;
    let k = sh;
    // Mesteacănul: dungi închise de-a curmezișul scoarței albe.
    if (marks && Math.sin(t * L * 0.45 + Math.floor(t * L / 7) * 2.1) > 0.93) k *= 0.25;
    put(out, (y * w + x) * 4, col[0] * k, col[1] * k, col[2] * k, a);
  }
}

/** O frunză sau un smoc de frunze: o elipsă umbrită spre dreapta jos. */
function leaf(out: Px, w: number, h: number, cx: number, cy: number, r: number, col: readonly number[]) {
  const xa = Math.max(0, Math.floor(cx - r - 1)), xb = Math.min(w - 1, Math.ceil(cx + r + 1));
  const ya = Math.max(0, Math.floor(cy - r * 0.8 - 1)), yb = Math.min(h - 1, Math.ceil(cy + r * 0.8 + 1));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const u = (x - cx) / r, v = (y - cy) / (r * 0.8), d = Math.hypot(u, v), a = (1 - d) * r + 0.5;
    if (a <= 0) continue;
    const k = 1.1 - 0.35 * (u + v) / 2 - 0.15 * d;
    put(out, (y * w + x) * 4, col[0] * k, col[1] * k, col[2] * k, a);
  }
}

/** Copac (Tree): trunchi, ramuri care se despart pe niveluri și frunze la capete, după tipul ales. */
export function drawTree(src: Px, w: number, h: number, v: Record<string, number>): Px {
  const out = src.slice(), tp = Math.max(0, Math.min(TREE_TYPES.length - 1, Math.round(v.tp ?? 0)));
  const rand = rng(4242 + Math.round(v.seed ?? 1) * 7919), H = Math.max(4, ((v.sz ?? 70) / 100) * h);
  const bx = ((v.x ?? 50) / 100) * (w - 1), by = ((v.y ?? 96) / 100) * (h - 1);
  const thick = Math.max(0.8, H * 0.035 * ((v.th ?? 100) / 100)), amount = (v.lv ?? 70) / 100;
  const bark: Record<number, number[]> = { 0: [92, 64, 40], 1: [78, 52, 34], 2: [96, 80, 56], 3: [236, 232, 222], 4: [84, 58, 38], 5: [70, 56, 46] };
  const greens: number[][] = tp === 1 ? [[24, 78, 42], [30, 92, 50], [18, 64, 36]] : tp === 2 ? [[120, 160, 60], [100, 146, 52], [140, 176, 80]]
    : tp === 3 ? [[130, 180, 70], [150, 196, 84], [112, 162, 60]] : tp === 4 ? [[214, 96, 24], [236, 160, 36], [180, 50, 24], [200, 130, 30]]
      : [[52, 120, 44], [70, 140, 52], [40, 100, 38]];
  const leaves: [number, number, number, number[]][] = [];
  const leafR = Math.max(1.2, H * (tp === 1 ? 0.03 : 0.026));
  const addLeaves = (x: number, y: number, n: number, spread: number) => {
    if (tp === 5) return;
    const cnt = Math.round(n * amount);
    for (let i = 0; i < cnt; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * spread;
      leaves.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, leafR * (0.6 + rand() * 0.6), greens[Math.floor(rand() * greens.length)]]);
    }
  };
  const col = bark[tp], marks = tp === 3 ? 1 : 0;
  if (tp === 1) {
    // Brad: trunchiul drept până sus, ramuri pe etaje, tot mai scurte spre vârf și aplecate în jos.
    const top = by - H;
    branch(out, w, h, bx, by, thick, bx, top, thick * 0.15, col, 0);
    const levels = 14;
    for (let i = 0; i < levels; i++) {
      const t = 0.15 + (i / levels) * 0.8, y = by - H * t, len = H * 0.36 * (1 - t) + H * 0.03;
      for (const s of [-1, 1]) {
        const jx = len * (0.85 + rand() * 0.3), ex = bx + s * jx, ey = y + len * 0.28;
        branch(out, w, h, bx, y, thick * 0.3 * (1 - t) + 0.6, ex, ey, 0.5, col, 0);
        for (let q = 0; q <= 4; q++) { const f = q / 4; addLeaves(bx + s * jx * f, y + len * 0.28 * f + leafR * 0.3, 3, leafR * 1.3); }
      }
    }
    addLeaves(bx, top + leafR, 4, leafR);
  } else {
    // Ramuri care se despart pe niveluri: unghiul și lungimea variază puțin la fiecare, ca să nu iasă un copac „de manual”.
    const depth = 8, spread = tp === 0 ? 0.52 : tp === 3 ? 0.38 : 0.5, droop = tp === 2 ? 0.28 : 0;
    const grow = (x: number, y: number, ang: number, len: number, r: number, lvl: number) => {
      // Salcia: ramurile de sus se apleacă tot mai mult spre pământ.
      const a = ang + (lvl < depth - 1 ? droop * (depth - lvl) / depth * (Math.cos(ang) > 0 ? -1 : 1) : 0);
      const ex = x + Math.cos(a) * len, ey = y - Math.sin(a) * len, r1 = r * 0.68;
      branch(out, w, h, x, y, r, ex, ey, Math.max(0.4, r1), col, marks);
      if (lvl === 0) {
        if (tp === 2) {
          // Salcia: de la capătul ramurii atârnă o șuviță lungă, cu frunze mici de-a lungul ei.
          const len2 = H * (0.12 + rand() * 0.18), sx = ex + (rand() - 0.5) * len2 * 0.15;
          branch(out, w, h, ex, ey, 0.6, sx, ey + len2, 0.4, col, 0);
          for (let q = 1; q <= 6; q++) addLeaves(ex + (sx - ex) * q / 6, ey + len2 * q / 6, 2, leafR * 0.8);
        } else addLeaves(ex, ey, 6, leafR * 2.2);
        return;
      }
      if (lvl <= 2) addLeaves((x + ex) / 2, (y + ey) / 2, 2, leafR * 1.5);
      const kids = rand() < 0.3 && lvl > 2 ? 3 : 2;
      for (let i = 0; i < kids; i++) {
        const side = kids === 2 ? (i === 0 ? -1 : 1) : i - 1;
        const na = a + side * spread * (0.7 + rand() * 0.6) + (rand() - 0.5) * 0.25;
        grow(ex, ey, na, len * (0.68 + rand() * 0.14), r1, lvl - 1);
      }
    };
    grow(bx, by, Math.PI / 2 + (rand() - 0.5) * 0.08, H * (tp === 3 ? 0.34 : 0.3), thick, depth);
  }
  for (const [x, y, r, c] of leaves) leaf(out, w, h, x, y, r, c);
  return out;
}

/** Zgomot neted pe 3 octave (0…1), cu sămânță; pentru limbile de foc. */
function noise2(seed: number) {
  const hash = (i: number, j: number) => { let t = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 982451653); t = Math.imul(t ^ (t >>> 13), 1274126177); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
  const one = (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  return (x: number, y: number) => (one(x, y) * 4 + one(x * 2.1, y * 2.1) * 2 + one(x * 4.3, y * 4.3)) / 7;
}

/** Culoarea focului după tărie (0…1): de la roșu închis la galben și alb în miez. */
function fireColor(I: number, kind: number): [number, number, number] {
  const ramps: number[][][] = [
    [[0, 0, 0], [130, 12, 0], [235, 80, 0], [255, 170, 30], [255, 236, 140], [255, 252, 230]],
    [[0, 0, 0], [10, 20, 120], [30, 80, 230], [90, 160, 255], [190, 225, 255], [245, 250, 255]],
    [[0, 0, 0], [0, 70, 20], [20, 170, 50], [110, 230, 90], [200, 255, 170], [245, 255, 235]],
    [[0, 0, 0], [70, 0, 90], [150, 40, 210], [210, 110, 255], [240, 190, 255], [252, 240, 255]],
  ];
  const r = ramps[Math.max(0, Math.min(ramps.length - 1, kind))], p = Math.max(0, Math.min(0.9999, I)) * (r.length - 1), i = Math.floor(p), f = p - i;
  return [r[i][0] + (r[i + 1][0] - r[i][0]) * f, r[i][1] + (r[i + 1][1] - r[i][1]) * f, r[i][2] + (r[i + 1][2] - r[i][2]) * f];
}

/** Flăcări (Flame): foc de-a lungul marginii de jos, o flacără sau o lumânare; adunate peste poză ca lumina (Ecran). */
export function drawFlames(src: Px, w: number, h: number, v: Record<string, number>): Px {
  const out = src.slice(), tp = Math.max(0, Math.min(FLAME_TYPES.length - 1, Math.round(v.tp ?? 0)));
  const rand = rng(911 + Math.round(v.seed ?? 1) * 7919), nz = noise2(Math.round(v.seed ?? 1));
  const H = Math.max(3, ((v.ht ?? 35) / 100) * h), turb = ((v.turb ?? 50) / 100) * (tp === 2 ? 0.25 : 1), col = Math.round(v.col ?? 0);
  const by = ((v.y ?? 100) / 100) * (h - 1);
  // Fiecare flacără: centrul, lățimea (jumătate) și înălțimea.
  const flames: [number, number, number][] = [];
  if (tp === 0) {
    const n = Math.max(3, Math.round(w / Math.max(4, H * 0.35)));
    for (let i = 0; i < n; i++) flames.push([((i + 0.2 + rand() * 0.6) / n) * w, (w / n) * (0.8 + rand() * 0.7), H * (0.55 + rand() * 0.45)]);
  } else {
    const cx = ((v.x ?? 50) / 100) * (w - 1), wd = ((v.wd ?? 30) / 100) * H * (tp === 2 ? 0.45 : 1);
    flames.push([cx, wd, H]);
  }
  const scale = 6 / H, top = Math.max(0, Math.floor(by - H * 1.15));
  for (let y = top; y <= Math.min(h - 1, Math.ceil(by + H * 0.04)); y++) for (let x = 0; x < w; x++) {
    // Limbile de foc se unduiesc: coordonata orizontală e împinsă de zgomot, mai tare spre vârf.
    const n1 = nz(x * scale * 0.9, (by - y) * scale * 0.55 + 3.7), n2 = nz(x * scale * 2.2 + 11, (by - y) * scale * 1.4);
    let I = 0;
    for (const [cx, hw, fh] of flames) {
      const t = (by - y) / fh;
      if (t < -0.04 || t > 1.15) continue;
      const tt = Math.max(0, t), wob = (n1 - 0.5) * 2.2 * turb * hw * (0.25 + tt);
      const u = Math.abs(x - cx + wob) / hw;
      if (u > 1.3) continue;
      // Forma unei flăcări: lată jos, tot mai îngustă spre vârf, rotunjită la bază.
      const prof = Math.pow(Math.max(0, 1 - tt), 0.75) * Math.min(1, (t + 0.04) * 30), edge = 1 - u / Math.max(0.05, prof);
      if (edge <= 0) continue;
      const k = edge * (1 - tt * 0.55) * (0.75 + (n2 - 0.5) * 1.1 * turb + 0.25);
      I = Math.max(I, k);
    }
    if (I <= 0.01) continue;
    let [r, g, b] = fireColor(Math.min(1, I * 1.15), col);
    // Lumânarea are un mic miez albastru la bază.
    if (tp === 2 && col === 0) {
      const t = (by - y) / H, u = Math.abs(x - flames[0][0]) / flames[0][1];
      if (t < 0.2 && u < 0.5) { const m = (1 - t / 0.2) * (1 - u / 0.5) * 0.8; r += (60 - r) * m; g += (110 - g) * m; b += (255 - b) * m; }
    }
    const o = (y * w + x) * 4, a = Math.min(1, I * 1.6);
    // Ecran: focul doar luminează, nu acoperă cu negru.
    out[o] = 255 - (255 - out[o]) * (255 - r * a) / 255;
    out[o + 1] = 255 - (255 - out[o + 1]) * (255 - g * a) / 255;
    out[o + 2] = 255 - (255 - out[o + 2]) * (255 - b * a) / 255;
    out[o + 3] = Math.max(out[o + 3], 255 * a);
  }
  return out;
}
