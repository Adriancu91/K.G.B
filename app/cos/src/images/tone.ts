// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Unelte de retuș local cu pensula (ca Blur / Sharpen / Dodge / Burn / Sponge din Photoshop).
// La începutul trăsăturii se face o singură dată varianta prelucrată a pozei; pensula o „dezvăluie” doar unde treci,
// cu puterea aleasă (opacitatea trăsăturii). Așa trăsătura merge lin și pe poze mari.
// Tot aici: Înlocuiește culoarea (ca Color Replacement: nuanța pensulei, lumina pozei) și Pensula istoric
// (ca History Brush: pictezi înapoi poza de dinainte de modificări).
export type ToneMode = 'blur' | 'sharpen' | 'smudge' | 'dodge' | 'burn' | 'sponge' | 'recolor' | 'history' | 'redeye' | 'pattern' | 'liquify';
export const TONE_MODES: ToneMode[] = ['blur', 'sharpen', 'smudge', 'dodge', 'burn', 'sponge', 'recolor', 'history', 'redeye', 'pattern', 'liquify'];

/** Deschide (dodge) sau închide (burn) tonurile medii, ca la developarea clasică; albul și negrul rămân pe loc. */
export function dodgeBurn(d: Uint8ClampedArray, dodge: boolean) {
  const lut = new Uint8ClampedArray(256);
  const g = dodge ? 1 / 1.6 : 1.6;
  for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(v / 255, g));
  for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
}

/** Burete: culorile devin mai vii (more) sau mai șterse, spre gri; lumina rămâne aceeași. */
export function sponge(d: Uint8ClampedArray, more: boolean) {
  const k = more ? 1.8 : 0;
  for (let i = 0; i < d.length; i += 4) {
    const L = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    for (let c = 0; c < 3; c++) d[i + c] = L + (d[i + c] - L) * k;
  }
}

/** Ochi roșii: doar pixelii mult mai roșii decât verzi / albaștri devin închiși, ca o pupilă; restul rămâne la fel. */
export function redEye(d: Uint8ClampedArray) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], gb = (g + b) / 2;
    const ratio = r / (gb + 1);
    if (r < 60 || ratio < 1.5) continue;
    const w = Math.min(1, (ratio - 1.5) / 0.5);
    d[i] = r * (1 - w) + gb * 0.8 * w;
    d[i + 1] = g * (1 - 0.15 * w);
    d[i + 2] = b * (1 - 0.15 * w);
  }
}

/** Clarifică (unsharp mask): poza + (poza − poza estompată). */
export function sharpen(d: Uint8ClampedArray, blurred: Uint8ClampedArray, amount = 1.5) {
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = d[i + c] + (d[i + c] - blurred[i + c]) * amount;
}

/** Raza estompării, după mărimea pensulei (pensulă mare = estompare mai puternică). */
export const toneBlur = (size: number) => Math.max(2, Math.min(30, Math.round(size / 4)));

/** Varianta prelucrată a pozei întregi, pe care pensula o pictează. */
export function toneSource(img: HTMLCanvasElement, mode: ToneMode, size: number, more: boolean, color = '#000000', base?: HTMLCanvasElement): HTMLCanvasElement {
  const W = img.width, H = img.height;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  if (mode === 'history') {
    ctx.drawImage(base && base.width === W && base.height === H ? base : img, 0, 0);
    return c;
  }
  if (mode === 'pattern') {
    // Ștampila cu model: base e plăcuța modelului, repetată pe toată poza (pornind din colțul de sus, ca în Photoshop).
    if (!base) return c;
    ctx.fillStyle = ctx.createPattern(base, 'repeat')!;
    ctx.fillRect(0, 0, W, H);
    return c;
  }
  if (mode === 'recolor') {
    // Modul „color” din canvas: nuanța și saturația culorii alese, lumina pixelului din poză; transparența rămâne.
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, 0, 0);
    return c;
  }
  const blurred = () => {
    // Ca marginea pozei să nu devină transparentă, sub poza estompată punem copii mutate ale ei.
    const r = mode === 'sharpen' ? 2 : toneBlur(size);
    const b = document.createElement('canvas');
    b.width = W;
    b.height = H;
    const bc = b.getContext('2d', { willReadFrequently: true })!;
    bc.filter = `blur(${r}px)`;
    for (const [dx, dy] of [[0, 0], [-r * 2, 0], [r * 2, 0], [0, -r * 2], [0, r * 2]]) if (dx || dy) bc.drawImage(img, dx, dy);
    bc.drawImage(img, 0, 0);
    return b;
  };
  if (mode === 'blur') {
    const b = blurred();
    ctx.drawImage(b, 0, 0);
    b.width = 0;
    return c;
  }
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  if (mode === 'sharpen') {
    const b = blurred();
    sharpen(id.data, b.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data);
    b.width = 0;
  } else if (mode === 'sponge') sponge(id.data, more);
  else if (mode === 'redeye') redEye(id.data);
  else dodgeBurn(id.data, mode === 'dodge');
  ctx.putImageData(id, 0, 0);
  return c;
}

/** Modelele gata făcute ale ștampilei cu model, în culoarea pensulei. */
export const PATTERNS = ['Dungi', 'Carouri', 'Puncte', 'Cărămizi'];
export function patternTile(kind: number, color: string, size: number): HTMLCanvasElement {
  const s = Math.max(8, Math.round(size));
  const c = document.createElement('canvas');
  c.width = c.height = s * 2;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (kind === 0) {
    // Dungi pe diagonală, care se continuă de la o plăcuță la alta.
    ctx.lineWidth = s / 2;
    ctx.beginPath();
    for (const o of [-2 * s, 0, 2 * s]) { ctx.moveTo(o, 2 * s); ctx.lineTo(o + 2 * s, 0); }
    ctx.stroke();
  } else if (kind === 1) {
    ctx.fillRect(0, 0, s, s);
    ctx.fillRect(s, s, s, s);
  } else if (kind === 2) {
    for (const [x, y] of [[s / 2, s / 2], [1.5 * s, 1.5 * s]]) { ctx.beginPath(); ctx.arc(x, y, s / 3, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.lineWidth = Math.max(1, s / 8);
    ctx.strokeRect(0, 0, 2 * s, s);
    ctx.strokeRect(-s, s, 2 * s, s);
    ctx.strokeRect(s, s, 2 * s, s);
  }
  return c;
}

/** Butoanele din bara pensulei: unealta, eticheta, explicația. */
export const TONE_BTNS: [ToneMode, string, string][] = [
  ['blur', '◌ Estompează', 'Estompează doar unde treci cu pensula (de exemplu fundalul din spatele unei persoane sau un rid)'],
  ['sharpen', '◆ Clarifică', 'Face mai clare detaliile unde treci (ochi, text, frunze); nu exagera, apare zgomot'],
  ['smudge', '☝ Deget', 'Întinde culoarea de unde începi în direcția în care tragi, ca pe o pictură udă'],
  ['dodge', '☀ Deschide', 'Luminează locul unde treci: ochi, fețe în umbră'],
  ['burn', '☾ Întunecă', 'Întunecă locul unde treci: cer ars, margini prea luminoase'],
  ['sponge', '🧽 Burete', 'Culori mai vii sau mai șterse doar unde treci'],
  ['recolor', '🎨 Recolorează', 'Schimbă culoarea unde treci, dar păstrează umbrele și textura: un tricou, o mașină, ochii'],
  ['redeye', '👁 Ochi roșii', 'Click (sau tragi) pe un ochi roșu de la blitz: roșul devine pupilă închisă; pielea din jur nu se schimbă'],
  ['pattern', '▦ Model', 'Pictezi cu un model care se repetă: dungi, carouri, puncte, cărămizi sau o bucată din poză (selecție → ▦ Definește model)'],
  ['liquify', '〰 Lichefiere', 'Mută pixelii cu pensula: împinge, umflă, strânge sau răsucește (zâmbete, ochi, siluete, linii strâmbe)'],
  ['history', '↺ Istoric', 'Pictezi înapoi poza de dinainte de modificări, doar unde treci'],
];

/**
 * Deget (ca Smudge din Photoshop): pensula „ia” culoarea de unde începi și o întinde în direcția în care tragi.
 * Se lucrează pe o copie a pozei, pas cu pas (din sfert în sfert de rază), ca previzualizarea să arate exact rezultatul.
 */
export type Smudge = { carry: Float32Array; r: number; last: { x: number; y: number } };
export function smudgeStart(work: HTMLCanvasElement, p: { x: number; y: number }, r: number): Smudge {
  const R = Math.max(1, Math.round(r)), D = R * 2 + 1;
  const carry = new Float32Array(D * D * 4);
  const d = work.getContext('2d', { willReadFrequently: true })!.getImageData(Math.round(p.x) - R, Math.round(p.y) - R, D, D).data;
  for (let i = 0; i < d.length; i++) carry[i] = d[i];
  return { carry, r: R, last: p };
}
/** Întinde de la ultimul punct până la p; strength (0…1) = cât de departe se duce culoarea. */
export function smudgeTo(work: HTMLCanvasElement, s: Smudge, p: { x: number; y: number }, strength: number) {
  const ctx = work.getContext('2d', { willReadFrequently: true })!;
  const R = s.r, D = R * 2 + 1, W = work.width, H = work.height;
  const step = Math.max(1, R / 4);
  const n = Math.max(1, Math.ceil(Math.hypot(p.x - s.last.x, p.y - s.last.y) / step));
  const k = Math.min(0.98, Math.max(0, strength));
  for (let t = 1; t <= n; t++) {
    const cx = Math.round(s.last.x + ((p.x - s.last.x) * t) / n), cy = Math.round(s.last.y + ((p.y - s.last.y) * t) / n);
    const x0 = cx - R, y0 = cy - R;
    const id = ctx.getImageData(x0, y0, D, D);
    const d = id.data;
    for (let y = 0; y < D; y++) {
      const iy = y0 + y;
      if (iy < 0 || iy >= H) continue;
      for (let x = 0; x < D; x++) {
        const ix = x0 + x;
        if (ix < 0 || ix >= W) continue;
        const dist = Math.hypot(x - R, y - R) / R;
        if (dist > 1) continue;
        // Margine moale: în centru culoarea purtată acoperă mult, spre margine tot mai puțin.
        const w = k * (dist < 0.5 ? 1 : (1 - dist) * 2);
        const i = (y * D + x) * 4;
        for (let c = 0; c < 4; c++) {
          const v = d[i + c] + (s.carry[i + c] - d[i + c]) * w;
          d[i + c] = v;
          s.carry[i + c] = s.carry[i + c] * k + v * (1 - k);
        }
      }
    }
    ctx.putImageData(id, x0, y0);
  }
  s.last = p;
}

/**
 * Pensula de amestec (ca Mixer Brush din Photoshop): pensula are în ea vopsea de culoarea aleasă și, cât tragi, ia și din
 * culorile de pe poză, ca o pensulă udă. `wet` (0–1) = cât ia de pe poză, `mix` (0–1) = cât din vopseaua pensulei vine de
 * pe poză și cât din culoarea ei, `load` (0–1) = câtă vopsea are pensula (1 = nu se termină), `flow` (0–1) = cât de tare
 * pune vopseaua. Cu umed și amestec 0 pictează ca o pensulă moale; cu ambele 1, ca Degetul.
 */
export type Mixer = Smudge & { paint: [number, number, number]; left: number; noPaint?: boolean };
/** Ce a rămas în pensulă de la trăsătura trecută (vopseaua și cât mai are), sau pensula curățată (fără vopsea). */
export type MixerKeep = { carry?: Float32Array; left: number; noPaint: boolean };
/** Presetările pensulei de amestec: numele, Umed, Încărcare, Proporție. */
export const MIXER_PRESETS: [string, number, number, number][] = [
  ['Uscat', 0, 50, 0], ['Uscat, încărcare mare', 0, 100, 0], ['Umed', 50, 50, 50], ['Umed, amestec ușor', 50, 50, 20],
  ['Umed, amestec puternic', 50, 50, 80], ['Ud', 100, 50, 50], ['Ud, amestec puternic', 100, 50, 90], ['Foarte ud, încărcare mică', 100, 15, 100],
];
export type MixerOpts = { wet: number; mix: number; load: number; flow: number };
export function mixerStart(work: HTMLCanvasElement, p: { x: number; y: number }, r: number, color: string, mix: number, wet: number, keep: MixerKeep | null = null, load = true): Mixer {
  const s = smudgeStart(work, p, r);
  // keep lipsă = pensula plină, abia încărcată (ca înainte). Altfel pornește cu ce a rămas în ea; „load” o reîncarcă.
  if (keep) {
    let left = keep.left, noPaint = keep.noPaint;
    if (keep.carry && keep.carry.length === s.carry.length) s.carry.set(keep.carry);
    else if (!noPaint) return mixerStart(work, p, r, color, mix, wet, null);
    if (load) {
      const loaded = mixerStart(work, p, r, color, mix, wet, null);
      const m = mixRatio(mix, wet);
      for (let i = 0; i < s.carry.length; i += 4) {
        for (let c = 0; c < 3; c++) s.carry[i + c] = s.carry[i + c] * m + loaded.paint[c] * (1 - m);
        s.carry[i + 3] = s.carry[i + 3] * m + 255 * (1 - m);
      }
      left = 1; noPaint = false;
      return { ...s, paint: loaded.paint, left, noPaint };
    }
    const n = parseInt(color.slice(1), 16);
    return { ...s, paint: [(n >> 16) & 255, (n >> 8) & 255, n & 255], left: noPaint ? 1 : left, noPaint };
  }
  const n = parseInt(color.slice(1), 16);
  const paint: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // La început pensula are deja proporția la care ajunge pe trăsătură: umed × amestec din poză, 1 − amestec din vopsea.
  const m = mixRatio(mix, wet);
  for (let i = 0; i < s.carry.length; i += 4) {
    for (let c = 0; c < 3; c++) s.carry[i + c] = s.carry[i + c] * m + paint[c] * (1 - m);
    s.carry[i + 3] = s.carry[i + 3] * m + 255 * (1 - m);
  }
  return { ...s, paint, left: 1 };
}
/** Cât din vopseaua pensulei vine din poză la proporția și umezeala alese: umed × amestec față de 1 − amestec. */
function mixRatio(mix: number, wet: number) {
  const a = Math.max(0, Math.min(1, wet)) * Math.max(0, Math.min(1, mix)), b = 1 - Math.max(0, Math.min(1, mix));
  return a + b > 0 ? a / (a + b) : 0;
}
export function mixerTo(work: HTMLCanvasElement, orig: HTMLCanvasElement, s: Mixer, p: { x: number; y: number }, o: MixerOpts) {
  const ctx = work.getContext('2d', { willReadFrequently: true })!, octx = orig.getContext('2d', { willReadFrequently: true })!;
  const R = s.r, D = R * 2 + 1, W = work.width, H = work.height;
  const step = Math.max(1, R / 4);
  const n = Math.max(1, Math.ceil(Math.hypot(p.x - s.last.x, p.y - s.last.y) / step));
  // Pe fiecare amprentă vopseaua pensulei trage spre culoarea de pe poză (cu umed × amestec) și spre culoarea ei (cu
  // 1 − amestec); așa, pe o trăsătură lungă, ajunge la proporția aleasă de amestec și rămâne acolo.
  const mix = Math.max(0, Math.min(1, o.mix));
  const flow = Math.max(0, Math.min(1, o.flow)), pick = Math.max(0, Math.min(1, o.wet)) * mix * 0.25;
  // Pensula curățată nu mai are vopsea de pus: doar întinde culorile luate de pe poză.
  const refill = s.noPaint ? 0 : (1 - mix) * 0.35;
  // Pensula se golește cu fiecare amprentă (pune tot mai puțină vopsea); la încărcare 1 nu se golește deloc.
  const drain = (1 - Math.max(0, Math.min(1, o.load))) * 0.06;
  const P = [...s.paint, 255];
  for (let t = 1; t <= n; t++) {
    const cx = Math.round(s.last.x + ((p.x - s.last.x) * t) / n), cy = Math.round(s.last.y + ((p.y - s.last.y) * t) / n);
    const x0 = cx - R, y0 = cy - R;
    const id = ctx.getImageData(x0, y0, D, D);
    const d = id.data, od = octx.getImageData(x0, y0, D, D).data;
    const fill = refill * s.left;
    for (let y = 0; y < D; y++) {
      const iy = y0 + y;
      if (iy < 0 || iy >= H) continue;
      for (let x = 0; x < D; x++) {
        const ix = x0 + x;
        if (ix < 0 || ix >= W) continue;
        const dist = Math.hypot(x - R, y - R) / R;
        if (dist > 1) continue;
        const w = flow * s.left * (dist < 0.5 ? 1 : (1 - dist) * 2);
        const i = (y * D + x) * 4;
        for (let c = 0; c < 4; c++) {
          const under = d[i + c];
          d[i + c] = under + (s.carry[i + c] - under) * w;
          // Pensula ia din ce era pe poză înainte de trăsătură (umed; nu din vopseaua abia pusă de ea), apoi se reîncarcă din vopseaua ei (cât mai are).
          let v = s.carry[i + c] + (od[i + c] - s.carry[i + c]) * pick;
          v += (P[c] - v) * fill;
          s.carry[i + c] = v;
        }
      }
    }
    ctx.putImageData(id, x0, y0);
    s.left *= 1 - drain;
  }
  s.last = p;
}
