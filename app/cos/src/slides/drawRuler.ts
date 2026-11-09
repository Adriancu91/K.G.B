// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 📏 Rigla din ✏ Desenează (ca șablonul Ruler din fila Draw): o riglă pusă peste slide, mutată trăgând de ea și rotită
// cu rotița mausului; linia începută lângă una dintre marginile ei lungi iese dreaptă, de-a lungul marginii.
// Toate măsurile sunt în coordonatele slide-ului.

/** Centrul riglei și unghiul ei, în grade (0 = orizontală). */
export interface Ruler { x: number; y: number; a: number }

/** Lungimea și grosimea riglei, după mărimea slide-ului. */
export const rulerSize = (W: number, H: number) => ({ len: Math.round(W * 0.8), th: Math.round(Math.max(H * 0.08, 24)) });

/** Rigla de la început: orizontală, la mijlocul slide-ului. */
export const newRuler = (W: number, H: number): Ruler => ({ x: W / 2, y: H / 2, a: 0 });

/** Locul punctului față de riglă: du de-a lungul ei, dv peste ea (pozitiv = sub marginea de jos, la unghiul 0). */
export function rulerLocal(r: Ruler, x: number, y: number) {
  const t = (r.a * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const dx = x - r.x, dy = y - r.y;
  return { du: dx * c + dy * s, dv: -dx * s + dy * c };
}

/**
 * Ce e sub punct: 'body' = rigla însăși (de mutat), 1 / -1 = lângă marginea de jos / de sus (linia se lipește de ea),
 * null = în altă parte. `near` = cât de departe de margine încă se lipește linia.
 */
export function rulerHit(r: Ruler, W: number, H: number, x: number, y: number, near: number): 'body' | 1 | -1 | null {
  const { len, th } = rulerSize(W, H);
  const { du, dv } = rulerLocal(r, x, y);
  if (Math.abs(du) > len / 2) return null;
  if (Math.abs(dv) <= th / 2) return 'body';
  if (Math.abs(dv) <= th / 2 + near) return dv > 0 ? 1 : -1;
  return null;
}

/** Punctul dus pe marginea riglei (side 1 jos, -1 sus), cu jumătate din grosimea liniei în afară, ca linia să atingă rigla. */
export function snapToEdge(r: Ruler, W: number, H: number, side: 1 | -1, x: number, y: number, lineW: number): { x: number; y: number } {
  const { len, th } = rulerSize(W, H);
  const t = (r.a * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const du = Math.max(-len / 2, Math.min(len / 2, rulerLocal(r, x, y).du));
  const dv = side * (th / 2 + lineW / 2);
  return { x: Math.round((r.x + du * c - dv * s) * 10) / 10, y: Math.round((r.y + du * s + dv * c) * 10) / 10 };
}

/** Unghiul nou după o rotire: pași de 1° (cu Shift 15°), lipit de 0 / 45 / 90… când ajunge la mai puțin de 1° de ele. */
export function rotateRuler(a: number, steps: number, big: boolean): number {
  let n = a + steps * (big ? 15 : 1);
  n = ((n % 360) + 360) % 360;
  const q = Math.round(n / 45) * 45;
  if (Math.abs(n - q) < 1) n = q % 360;
  return Math.round(n * 10) / 10;
}
