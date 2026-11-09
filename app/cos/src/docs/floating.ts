// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Imaginile „în fața textului” și „în spatele textului”: nu ocupă loc în rând, se mută liber pe pagină (dx, dy de la locul lor)
// și au o ordine între ele (z): „Adu în față / Trimite în spate”, ca la Word (Arrange → Bring Forward / Send Backward).
// Cele din spatele textului rămân mereu sub text; cele din față mereu peste el, iar ordinea se aplică în fiecare grup.

export type FloatMode = 'front' | 'behind';
export type ZMove = 'front' | 'forward' | 'backward' | 'back';

export const isFloating = (align: unknown): align is FloatMode => align === 'front' || align === 'behind';

/** Deplasarea maximă față de locul imaginii (px), ca o imagine să nu se piardă departe de pagină. */
export const MAX_OFFSET = 4000;
export const clampOffset = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, n)) : 0;
};

/** z-index pe ecran: cele din spate sub text (negativ), cele din față peste el. */
export const zIndexOf = (mode: FloatMode, z: number) => (mode === 'behind' ? -1000 + z : 10 + z);

/**
 * Noua ordine a unui grup de imagini (date în ordinea din document, cu z-ul lor), după mutarea celei cu indicele `at`.
 * Întoarce z-ul nou al fiecăreia (1…n, fără egalități), în aceeași ordine ca la intrare.
 */
export function reorderZ(zs: number[], at: number, how: ZMove): number[] {
  // Ordinea de acum: după z, iar la egalitate cea de mai jos în document e deasupra.
  const order = zs.map((z, i) => ({ z: Number.isFinite(z) ? z : 0, i })).sort((a, b) => a.z - b.z || a.i - b.i).map((x) => x.i);
  const k = order.indexOf(at);
  if (k >= 0) {
    order.splice(k, 1);
    const to = how === 'front' ? order.length : how === 'back' ? 0 : how === 'forward' ? Math.min(order.length, k + 1) : Math.max(0, k - 1);
    order.splice(to, 0, at);
  }
  const out = new Array<number>(zs.length);
  order.forEach((i, rank) => { out[i] = rank + 1; });
  return out;
}

/** Clicul cade pe o literă? (altfel, sub el poate fi o imagine din spatele textului, care trebuie să poată fi aleasă). */
export function pointOnGlyph(x: number, y: number): boolean {
  const r = document.caretRangeFromPoint?.(x, y);
  const t = r?.startContainer;
  if (!r || !t || t.nodeType !== Node.TEXT_NODE) return false;
  const len = (t as Text).length;
  for (const o of [r.startOffset - 1, r.startOffset]) {
    if (o < 0 || o >= len) continue;
    const rr = document.createRange();
    rr.setStart(t, o);
    rr.setEnd(t, o + 1);
    const b = rr.getBoundingClientRect();
    if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return true;
  }
  return false;
}
