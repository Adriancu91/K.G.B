// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Decuparea din ecran: dreptunghiul tras cu mouse-ul peste poza ecranului (micșorată ca să încapă) devine
// dreptunghiul din poza mare, în pixeli reali, fără să iasă din ea.

export interface Rect { x: number; y: number; w: number; h: number }

/** Dreptunghiul dintre două puncte (în orice ordine), în coordonatele afișate. */
export function dragRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Din coordonatele afișate (poza arătată la `shownW` × `shownH`) în pixelii pozei mari; null dacă e prea mic (un simplu clic). */
export function toImageRect(r: Rect, shownW: number, shownH: number, imgW: number, imgH: number, min = 4): Rect | null {
  if (shownW <= 0 || shownH <= 0) return null;
  const sx = imgW / shownW, sy = imgH / shownH;
  const x0 = Math.max(0, Math.min(imgW, Math.round(r.x * sx)));
  const y0 = Math.max(0, Math.min(imgH, Math.round(r.y * sy)));
  const x1 = Math.max(0, Math.min(imgW, Math.round((r.x + r.w) * sx)));
  const y1 = Math.max(0, Math.min(imgH, Math.round((r.y + r.h) * sy)));
  if (x1 - x0 < min || y1 - y0 < min) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Mărimea la care se arată poza ecranului ca să încapă în `boxW` × `boxH` fără deformare (niciodată mai mare decât e). */
export function fitSize(imgW: number, imgH: number, boxW: number, boxH: number) {
  const k = Math.min(1, boxW / imgW, boxH / imgH);
  return { w: Math.round(imgW * k), h: Math.round(imgH * k) };
}
