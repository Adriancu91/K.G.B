// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tabele de culori (Color Lookup / LUT): fișiere .cube (3D sau 1D), plus câteva aspecte gata făcute, calculate aici.
// Culoarea fiecărui pixel se caută în tabel, cu interpolare între cele mai apropiate 8 noduri (triliniar).

export interface Lut {
  name: string;
  /** Câte noduri are tabelul pe fiecare axă (2…65). */
  n: number;
  /** Valorile 0…1: la 3D n³ culori (roșul se schimbă cel mai repede), la 1D n culori, câte 3 numere. */
  d: number[];
  /** Tabel 1D: fiecare canal separat. */
  one?: boolean;
  /** Cât se aplică (0…100%). */
  amount: number;
}

/** Citește un fișier .cube; aruncă o eroare cu mesaj în română dacă nu e bun. */
export function parseCube(text: string, fallbackName = 'Tabel de culori'): Lut {
  let name = fallbackName, n3 = 0, n1 = 0, lo = [0, 0, 0], hi = [1, 1, 1];
  const d: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const key = parts[0].toUpperCase();
    if (key === 'TITLE') { const t = line.slice(5).trim().replace(/^"|"$/g, ''); if (t) name = t.slice(0, 80); continue; }
    if (key === 'LUT_3D_SIZE') { n3 = Math.trunc(Number(parts[1])); continue; }
    if (key === 'LUT_1D_SIZE') { n1 = Math.trunc(Number(parts[1])); continue; }
    if (key === 'DOMAIN_MIN') { lo = parts.slice(1, 4).map(Number); continue; }
    if (key === 'DOMAIN_MAX') { hi = parts.slice(1, 4).map(Number); continue; }
    if (/^[A-Z_]+$/.test(key)) continue; // alte chei (LUT_3D_INPUT_RANGE etc.)
    const v = parts.slice(0, 3).map(Number);
    if (v.length < 3 || v.some((x) => !Number.isFinite(x))) throw new Error('Fișierul .cube are un rând greșit: ' + line.slice(0, 40));
    d.push(...v);
  }
  const one = !n3 && n1 > 0, n = n3 || n1;
  if (!(n >= 2 && n <= (one ? 65536 : 65))) throw new Error('Fișierul .cube nu spune mărimea tabelului (LUT_3D_SIZE).');
  if (d.length !== (one ? n : n * n * n) * 3) throw new Error('Fișierul .cube are alt număr de culori decât spune mărimea lui.');
  // Domeniul altul decât 0…1: valorile se aduc la 0…1.
  if (lo.some((x) => x !== 0) || hi.some((x) => x !== 1)) {
    for (let i = 0; i < d.length; i++) { const c = i % 3, span = hi[c] - lo[c] || 1; d[i] = (d[i] - lo[c]) / span; }
  }
  return { name, n, d, ...(one ? { one: true } : {}), amount: 100 };
}

/** Culoarea din tabel pentru r, g, b (0…255), amestecată cu cea de intrare după `amount`. */
export function lutPixel(t: Lut, r: number, g: number, b: number): [number, number, number] {
  const n = t.n, m = n - 1, d = t.d, k = Math.max(0, Math.min(100, t.amount)) / 100;
  const cl = (v: number) => Math.max(0, Math.min(1, v / 255));
  const R = cl(r) * m, G = cl(g) * m, B = cl(b) * m;
  let o: [number, number, number];
  if (t.one) {
    const at = (x: number, c: number) => { const i = Math.min(m - 1, Math.floor(x)), f = x - i; return d[i * 3 + c] * (1 - f) + d[(i + 1) * 3 + c] * f; };
    o = [at(R, 0), at(G, 1), at(B, 2)];
  } else {
    const r0 = Math.min(m - 1, Math.floor(R)), g0 = Math.min(m - 1, Math.floor(G)), b0 = Math.min(m - 1, Math.floor(B));
    const fr = R - r0, fg = G - g0, fb = B - b0;
    o = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const v = (ri: number, gi: number, bi: number) => d[((b0 + bi) * n * n + (g0 + gi) * n + (r0 + ri)) * 3 + c];
      const c00 = v(0, 0, 0) * (1 - fr) + v(1, 0, 0) * fr, c10 = v(0, 1, 0) * (1 - fr) + v(1, 1, 0) * fr;
      const c01 = v(0, 0, 1) * (1 - fr) + v(1, 0, 1) * fr, c11 = v(0, 1, 1) * (1 - fr) + v(1, 1, 1) * fr;
      o[c] = (c00 * (1 - fg) + c10 * fg) * (1 - fb) + (c01 * (1 - fg) + c11 * fg) * fb;
    }
  }
  return [r + (o[0] * 255 - r) * k, g + (o[1] * 255 - g) * k, b + (o[2] * 255 - b) * k];
}

/** Aspectele gata făcute (tabele 17 × 17 × 17 calculate din formule simple). */
export const LOOKS: [string, string][] = [
  ['warm', 'Seară caldă'], ['teal', 'Cinema (turcoaz și portocaliu)'], ['fade', 'Film decolorat'], ['cold', 'Iarnă rece'], ['mono', 'Alb-negru contrastant'],
];
export function makeLook(id: string): Lut {
  const n = 17, d: number[] = [];
  const s = (x: number) => x * x * (3 - 2 * x); // curbă în S
  for (let bi = 0; bi < n; bi++) for (let gi = 0; gi < n; gi++) for (let ri = 0; ri < n; ri++) {
    let r = ri / (n - 1), g = gi / (n - 1), b = bi / (n - 1);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    if (id === 'warm') { r = r * 0.92 + 0.08; g = g * 0.97 + 0.02; b = b * 0.85; }
    else if (id === 'teal') {
      // Umbrele spre turcoaz, luminile (și pielea) spre portocaliu; contrast puțin mai mare.
      const w = s(y);
      r = r + (w - 0.5) * 0.16; g = g + (0.5 - Math.abs(w - 0.5)) * 0.02; b = b - (w - 0.5) * 0.2;
      r = s(Math.max(0, Math.min(1, r))) * 0.5 + r * 0.5; b = s(Math.max(0, Math.min(1, b))) * 0.5 + b * 0.5;
    } else if (id === 'fade') {
      // Negrul ridicat (gri închis), culorile mai șterse, o tentă caldă.
      const k = 0.7; r = y + (r - y) * k; g = y + (g - y) * k; b = y + (b - y) * k;
      r = 0.08 + r * 0.88; g = 0.07 + g * 0.87; b = 0.06 + b * 0.84;
    } else if (id === 'cold') { r = r * 0.86; g = g * 0.96 + 0.02; b = b * 0.9 + 0.1; }
    else if (id === 'mono') { const v = s(s(y)); r = g = b = v; }
    d.push(...[r, g, b].map((x) => Math.max(0, Math.min(1, x))));
  }
  return { name: LOOKS.find(([k]) => k === id)?.[1] ?? id, n, d, amount: 100 };
}
