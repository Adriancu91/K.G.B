// @ts-nocheck — copiat neschimbat; K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine.
//   Corectitudinea e acoperită de tests/stampbg.test.mjs; tipurile funcțiilor exportate rămân vizibile pentru restul aplicației.
// Copiat din Cyber Office Studio (src/pdf/stampBg.ts), aplicația proprietarului (D-071), fără schimbări.
// Folosit de „Ștampilele mele” în fereastra PDF (7.4l-1b2).
// Ștampila din poză: fundalul hârtiei devine transparent, cerneala rămâne cu culoarea ei.
// Merge și pe pozele făcute cu telefonul, cu lumina inegală: fundalul se măsoară pe bucăți (o grilă de blocuri),
// nu ca o singură culoare. Funcții pure, fără DOM (primesc și întorc pixeli RGBA), ca să se poată testa direct.

/** Toleranța obișnuită: cât de diferit de hârtie trebuie să fie un pixel ca să fie cerneală (0–1). */
export const BG_TOL = 0.12;

const lumOf = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Poza are deja transparență (de exemplu un PNG fără fundal)? Atunci fundalul nu se mai scoate din oficiu. */
export function hasAlpha(px: Uint8ClampedArray): boolean {
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) n++;
  return n > px.length / 4 / 100;
}

/**
 * Culoarea hârtiei pentru fiecare pixel: poza se împarte în blocuri, în fiecare bloc se ia partea luminoasă
 * (peste 70% din pixeli, ca să nu conteze cerneala), apoi blocurile se netezesc și se interpolează.
 */
function paperMap(px: Uint8ClampedArray, w: number, h: number): Float32Array {
  const B = Math.max(8, Math.round(Math.max(w, h) / 20));
  const gw = Math.ceil(w / B), gh = Math.ceil(h / B);
  const grid = new Float32Array(gw * gh * 4); // r, g, b, luminozitate
  const hist = new Uint32Array(256);
  for (let by = 0; by < gh; by++) {
    for (let bx = 0; bx < gw; bx++) {
      hist.fill(0);
      const x0 = bx * B, y0 = by * B, x1 = Math.min(w, x0 + B), y1 = Math.min(h, y0 + B);
      let total = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        hist[Math.min(255, Math.round(lumOf(px[i], px[i + 1], px[i + 2])))]++;
        total++;
      }
      // Pragul: pixelii din cei mai luminoși 30% ai blocului.
      let acc = 0, cut = 255;
      for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.3) { cut = v; break; } }
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        if (lumOf(px[i], px[i + 1], px[i + 2]) >= cut - 0.5) { r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
      }
      const k = (by * gw + bx) * 4;
      n = Math.max(1, n);
      grid[k] = r / n; grid[k + 1] = g / n; grid[k + 2] = b / n; grid[k + 3] = lumOf(r / n, g / n, b / n);
    }
  }
  // Un bloc plin de cerneală (de exemplu o ștampilă groasă) ar „vedea” cerneala ca hârtie: luăm vecinul cel mai luminos.
  const bright = new Float32Array(grid.length);
  for (let by = 0; by < gh; by++) for (let bx = 0; bx < gw; bx++) {
    let best = (by * gw + bx) * 4;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = bx + dx, y = by + dy;
      if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
      const k = (y * gw + x) * 4;
      if (grid[k + 3] > grid[best + 3]) best = k;
    }
    const k = (by * gw + bx) * 4;
    for (let c = 0; c < 4; c++) bright[k + c] = grid[best + c];
  }
  // Netezire (media cu vecinii), ca trecerea de la un bloc la altul să nu se vadă.
  const smooth = new Float32Array(grid.length);
  for (let by = 0; by < gh; by++) for (let bx = 0; bx < gw; bx++) {
    const k = (by * gw + bx) * 4;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = bx + dx, y = by + dy;
      if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
      const q = (y * gw + x) * 4;
      for (let c = 0; c < 4; c++) smooth[k + c] += bright[q + c];
      n++;
    }
    for (let c = 0; c < 4; c++) smooth[k + c] /= n;
  }
  // Interpolare între centrele blocurilor: culoarea hârtiei pentru fiecare pixel.
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, Math.min(gh - 1, (y + 0.5) / B - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, Math.min(gw - 1, (x + 0.5) / B - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
      const a = (y0 * gw + x0) * 4, b = (y0 * gw + x1) * 4, c = (y1 * gw + x0) * 4, d = (y1 * gw + x1) * 4;
      const o = (y * w + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        out[o + ch] = (smooth[a + ch] * (1 - tx) + smooth[b + ch] * tx) * (1 - ty) + (smooth[c + ch] * (1 - tx) + smooth[d + ch] * tx) * ty;
      }
    }
  }
  return out;
}

/**
 * Scoate hârtia: fiecare pixel devine transparent cât de aproape e de culoarea hârtiei din jurul lui.
 * `tol` (0,02–0,5): cât de diferit trebuie să fie de hârtie ca să rămână; marginea cernelii e moale (trecere treptată),
 * iar culoarea de pe margine se „curăță” de hârtie, ca să nu rămână un contur alb.
 */
export function removePaper(px: Uint8ClampedArray, w: number, h: number, tol = BG_TOL): Uint8ClampedArray {
  const paper = paperMap(px, w, h);
  const out = new Uint8ClampedArray(px.length);
  // Cât se deosebește fiecare pixel de hârtie: mai închis decât ea și de altă culoare (cerneala roșie deschisă e mai puțin
  // închisă, dar colorată).
  const diff = new Float32Array(w * h);
  const hist = new Uint32Array(101);
  let inkN = 0;
  for (let p = 0, o = 0, q = 0; p < px.length; p += 4, o += 3, q++) {
    const r = px[p], g = px[p + 1], b = px[p + 2];
    const pr = paper[o], pg = paper[o + 1], pb = paper[o + 2];
    const pl = Math.max(1, lumOf(pr, pg, pb));
    const dark = (pl - lumOf(r, g, b)) / pl;
    const hue = Math.sqrt(((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2) / 3) / 255;
    const s = Math.max(0, dark, hue * 1.2);
    diff[q] = s;
    if (s > tol + 0.05) { hist[Math.min(100, Math.round(s * 100))]++; inkN++; }
  }
  // Cât de puternică e cerneala plină (aproape cea mai închisă parte a ei): de la 60% din ea în sus, pixelul e opac;
  // între toleranță și atât, transparența crește treptat (marginea moale, unde cerneala e amestecată cu hârtia).
  let full = 0.6;
  if (inkN >= 50) {
    let acc = 0;
    for (let v = 100; v >= 0; v--) { acc += hist[v]; if (acc >= inkN * 0.1) { full = v / 100; break; } }
  }
  full = Math.max(tol + 0.15, Math.min(1, full));
  const soft = Math.max(0.06, (full - tol) * 0.6);
  for (let p = 0, o = 0, q = 0; p < px.length; p += 4, o += 3, q++) {
    const r = px[p], g = px[p + 1], b = px[p + 2];
    const pr = paper[o], pg = paper[o + 1], pb = paper[o + 2];
    let a = Math.max(0, Math.min(1, (diff[q] - tol) / soft));
    a = a * a * (3 - 2 * a);
    if (a <= 0.004) continue;
    // Culoarea cernelii fără hârtia amestecată în ea (pe marginile moi).
    const k = Math.max(a, 0.05);
    out[p] = a >= 1 ? r : (r - (1 - k) * pr) / k;
    out[p + 1] = a >= 1 ? g : (g - (1 - k) * pg) / k;
    out[p + 2] = a >= 1 ? b : (b - (1 - k) * pb) / k;
    out[p + 3] = Math.round(a * (px[p + 3] / 255) * 255);
  }
  despeckle(out, w, h);
  return out;
}

/** Punctele izolate (praf, zgomotul pozei) dispar: un pixel vizibil cu mai puțin de 2 vecini vizibili devine transparent. */
function despeckle(px: Uint8ClampedArray, w: number, h: number) {
  const vis = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) vis[i] = px[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!vis[i]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && vis[yy * w + xx]) n++;
    }
    if (n < 2) px[i * 4 + 3] = 0;
  }
}

/** Dreptunghiul cu desenul (pixelii destul de opaci), cu o margine mică; null dacă nu e nimic. */
export function contentBox(px: Uint8ClampedArray, w: number, h: number, minAlpha = 40, pad = 2): { x: number; y: number; w: number; h: number } | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] < minAlpha) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
