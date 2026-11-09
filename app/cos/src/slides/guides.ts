// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ghidajele (Guides din PowerPoint): linii verticale și orizontale puse de utilizator pe slide, de care se lipesc casetele
// când le muți. Sunt ale prezentării (aceleași pe toate slide-urile), nu apar în prezentare și se păstrează în .pptx
// (p15:sldGuideLst din presentation.xml; poziția în optimi de punct: 1 px = 0,75 pt = 6 optimi).
import type { Size } from './model';

export interface Guides { v: number[]; h: number[] }
export const MAX_GUIDES = 20;

const cleanList = (a: unknown, max: number) =>
  [...new Set((Array.isArray(a) ? a : []).map((x) => Math.round(Number(x))).filter((x) => Number.isFinite(x) && x >= 0 && x <= max))].sort((p, q) => p - q).slice(0, MAX_GUIDES);

/** Ghidajele curățate (numere întregi pe slide, fără dubluri, cel mult 20 pe fiecare direcție); fără niciunul: null. */
export function cleanGuides(g: unknown, size: Size): Guides | null {
  const o = (g && typeof g === 'object' ? g : {}) as Partial<Guides>;
  const v = cleanList(o.v, size.w), h = cleanList(o.h, size.h);
  return v.length || h.length ? { v, h } : null;
}

/** Ghidajele de la început (ca în PowerPoint): câte unul la mijloc, pe fiecare direcție. */
export const centerGuides = (size: Size): Guides => ({ v: [Math.round(size.w / 2)], h: [Math.round(size.h / 2)] });

/** Mută ghidajul `i` din direcția `dir` la `pos`; scos în afara slide-ului, se șterge (ca tras afară în PowerPoint). */
export function moveGuide(g: Guides, dir: 'v' | 'h', i: number, pos: number, size: Size): Guides {
  const max = dir === 'v' ? size.w : size.h;
  const list = g[dir].slice();
  if (pos < 0 || pos > max) list.splice(i, 1);
  else list[i] = Math.round(pos);
  return { ...g, [dir]: list };
}

/** Un ghidaj nou pe direcția dată, la mijloc sau, dacă e ocupat, puțin mai încolo. */
export function addGuide(g: Guides | null | undefined, dir: 'v' | 'h', size: Size): Guides {
  const cur = g ?? { v: [], h: [] };
  const max = dir === 'v' ? size.w : size.h;
  let pos = Math.round(max / 2);
  while (cur[dir].includes(pos) && pos + 40 <= max) pos += 40;
  return { ...cur, [dir]: [...cur[dir], pos].slice(0, MAX_GUIDES) };
}

const GUIDE_EXT = '{EFAFB233-063F-42B5-8137-9DF3F51BA10A}';

/** presentation.xml cu ghidajele în p:extLst (ultimul copil al lui p:presentation). */
export function guidesPresXml(pres: string, g: Guides): string {
  let id = 1;
  const items = [...g.v.map((p) => `<p15:guide id="${id++}" orient="vert" pos="${Math.round(p * 6)}"/>`), ...g.h.map((p) => `<p15:guide id="${id++}" orient="horz" pos="${Math.round(p * 6)}"/>`)].join('');
  const ext = `<p:ext uri="${GUIDE_EXT}"><p15:sldGuideLst xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main">${items}</p15:sldGuideLst></p:ext>`;
  if (/<\/p:extLst>\s*<\/p:presentation>\s*$/.test(pres)) return pres.replace(/<\/p:extLst>(\s*<\/p:presentation>\s*)$/, ext + '</p:extLst>$1');
  return pres.replace(/<\/p:presentation>\s*$/, `<p:extLst>${ext}</p:extLst></p:presentation>`);
}

/** Ghidajele citite din p15:guide (orient, pos în optimi de punct), mutate pe pânza noastră cu `px` (EMU → pixeli pe x / y). */
export function guidesFromXml(guides: Element[], px: (emu: number, dir: 'v' | 'h') => number, size: Size): Guides | null {
  const g: Guides = { v: [], h: [] };
  for (const el of guides) {
    const dir = el.getAttribute('orient') === 'horz' ? 'h' : 'v';
    const pos = Number(el.getAttribute('pos') ?? 0);
    if (Number.isFinite(pos)) g[dir].push(px(pos * 1587.5, dir));
  }
  return cleanGuides(g, size);
}
