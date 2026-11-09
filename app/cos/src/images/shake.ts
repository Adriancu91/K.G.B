// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Reducerea tremuratului (Shake Reduction): poza mișcată la fotografiere e privită ca poza clară „trasă” pe o linie
// (unghi + lungime). O refacem prin deconvoluție Richardson–Lucy pe luminozitate: la fiecare pas estimarea se trage pe
// aceeași linie, se compară cu poza dată, iar diferența se întoarce înapoi. Culorile primesc doar schimbarea de luminozitate,
// ca să nu apară margini colorate. Unghiul poate fi ghicit din poză: pe direcția mișcării marginile sunt cele mai slabe.

type Px = Uint8ClampedArray;
const clampI = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v);

/** Punctele liniei de mișcare (deplasări întregi), centrată pe pixel; unghiul în grade, 0° = orizontal. */
export function shakeLine(angle: number, len: number): [number, number][] {
  const a = (angle * Math.PI) / 180, n = Math.max(2, Math.min(41, Math.round(len) + 1)), offs: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1) - 0.5) * len;
    offs.push([Math.round(Math.cos(a) * t), Math.round(-Math.sin(a) * t)]);
  }
  return offs;
}

/** Unghiul mișcării ghicit din poză (grade, -90…90): direcția pe care luminozitatea se schimbă cel mai puțin. */
export function guessShakeAngle(src: Px, w: number, h: number): number {
  let sxx = 0, syy = 0, sxy = 0;
  const L = (i: number) => 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
  const st = Math.max(1, Math.floor(Math.sqrt((w * h) / 250000)));
  for (let y = 1; y < h - 1; y += st) for (let x = 1; x < w - 1; x += st) {
    const o = (y * w + x) * 4;
    const gx = L(o + 4) - L(o - 4), gy = L(o + w * 4) - L(o - w * 4);
    sxx += gx * gx; syy += gy * gy; sxy += gx * gy;
  }
  // Energia marginilor pe direcția θ: cos²·Sxx + 2·cos·sin·Sxy + sin²·Syy; minimul e la θ = ½·atan2(2Sxy, Sxx − Syy) + 90°.
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy) + Math.PI / 2;
  // Axa y a pozei merge în jos, deci unghiul pe ecran are semnul schimbat.
  let deg = (-th * 180) / Math.PI;
  while (deg > 90) deg -= 180;
  while (deg <= -90) deg += 180;
  return Math.round(deg);
}

/** Trage valorile pe linia dată (media punctelor), cu marginile prelungite. */
function smear(a: Float32Array, w: number, h: number, offs: [number, number][], out: Float32Array) {
  const n = offs.length;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += a[clampI(y + offs[k][1], h - 1) * w + clampI(x + offs[k][0], w - 1)];
    out[y * w + x] = s / n;
  }
}

/**
 * Reface poza mișcată pe linia (unghi, lungime în pixeli), cu `iters` pași Richardson–Lucy (mai mulți = mai clar, dar și
 * mai mult zgomot). Alfa rămâne neschimbat.
 */
export function shakeReduce(src: Px, w: number, h: number, angle: number, len: number, iters: number): Px {
  if (len < 1.5 || iters < 1 || w < 2 || h < 2) return src.slice();
  const N = w * h, Y = new Float32Array(N);
  for (let p = 0, i = 0; p < N; p++, i += 4) Y[p] = 1 + 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
  const fwd = shakeLine(angle, len), back = fwd.map(([x, y]) => [-x, -y] as [number, number]);
  const est = Y.slice(), tmp = new Float32Array(N), ratio = new Float32Array(N);
  for (let it = 0; it < iters; it++) {
    smear(est, w, h, fwd, tmp);
    for (let p = 0; p < N; p++) ratio[p] = Y[p] / Math.max(1e-3, tmp[p]);
    smear(ratio, w, h, back, tmp);
    // Corecția pe pas e limitată, ca zgomotul și marginile tari să nu explodeze în inele.
    for (let p = 0; p < N; p++) est[p] = Math.min(400, est[p] * Math.min(2, Math.max(0.5, tmp[p])));
  }
  const out = src.slice();
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const d = est[p] - Y[p];
    out[i] = src[i] + d; out[i + 1] = src[i + 1] + d; out[i + 2] = src[i + 2] + d;
  }
  return out;
}
