// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Pânza liberă a notiței (ca pagina fără margini din programele de notițe cunoscute): casete de text puse oriunde,
// mutate trăgând de bara lor, cu lățimea aleasă. Casetele stau în notiță lângă text (`boxes`), se caută,
// se arată în Lectură și se exportă (→ Docs, .html, .md) în ordinea în care se citesc: de sus în jos, apoi de la stânga.

import { unpackInk } from './ink';

export interface CanvasBox {
  id: string;
  /** Locul colțului din stânga-sus, în pixeli, față de colțul pânzei. */
  x: number; y: number;
  /** Lățimea casetei, în pixeli. */
  w: number;
  text: string;
  /** Poza casetei (JPEG micșorat, „data:image/…”); textul e atunci descrierea de sub ea. */
  img?: string;
  /** Liniile desenului de mână din care e făcută poza (ink.ts), ca desenul să se poată redeschide cu ✎. */
  ink?: string;
  /** Grupul casetei: casetele cu același grup se mută împreună. */
  group?: string;
}

export const BOX_MIN_W = 120;
export const BOX_MAX_W = 900;
export const CANVAS_MAX = 6000;
const MAX_BOXES = 200;
const MAX_PICS = 30;
const IMG_RE = /^data:image[/](jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const num = (v: unknown, lo: number, hi: number, def: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : def;

export function cleanBoxes(raw: unknown): CanvasBox[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  let pics = 0;
  const list = raw
    .filter((b) => b && typeof b === 'object' && typeof b.text === 'string')
    .slice(0, MAX_BOXES)
    .map((b, i) => ({
      ...(typeof b.img === 'string' && b.img.length < 4000000 && IMG_RE.test(b.img) && ++pics <= MAX_PICS
        ? { img: b.img as string, ...(unpackInk(b.ink) ? { ink: b.ink as string } : {}) } : {}),
      id: typeof b.id === 'string' && /^[a-z0-9]{1,24}$/.test(b.id) ? b.id : 'b' + i.toString(36),
      x: num(b.x, 0, CANVAS_MAX, 0), y: num(b.y, 0, CANVAS_MAX, 0), w: num(b.w, BOX_MIN_W, BOX_MAX_W, 240),
      text: (b.text as string).slice(0, 20000),
      ...(typeof b.group === 'string' && /^[a-z0-9]{1,24}$/.test(b.group) ? { group: b.group as string } : {}),
    }));
  return list.length ? soloUngrouped(list) : undefined;
}

/** Un grup rămas cu o singură casetă nu mai e grup. */
export function soloUngrouped(list: CanvasBox[]): CanvasBox[] {
  const n = new Map<string, number>();
  for (const b of list) if (b.group) n.set(b.group, (n.get(b.group) ?? 0) + 1);
  return list.map((b) => (b.group && n.get(b.group)! < 2 ? (({ group: _g, ...r }) => r)(b) : b));
}

/** Casetele care se mută împreună cu caseta dată: grupul ei, plus casetele alese (și grupurile lor) dacă e și ea aleasă. */
export function movingIds(boxes: CanvasBox[], id: string, chosen: ReadonlySet<string> = new Set()): string[] {
  const seed = new Set(chosen.has(id) ? [...chosen, id] : [id]);
  const groups = new Set(boxes.filter((b) => seed.has(b.id) && b.group).map((b) => b.group));
  return boxes.filter((b) => seed.has(b.id) || (b.group && groups.has(b.group))).map((b) => b.id);
}

/** Leagă casetele date (și grupurile lor) într-un singur grup nou. */
export function groupBoxes(boxes: CanvasBox[], ids: Iterable<string>): CanvasBox[] {
  const set = new Set(ids);
  const old = new Set(boxes.filter((b) => set.has(b.id) && b.group).map((b) => b.group));
  const members = boxes.filter((b) => set.has(b.id) || (b.group && old.has(b.group)));
  if (members.length < 2) return boxes;
  const g = 'g' + newBoxId();
  const take = new Set(members.map((b) => b.id));
  return soloUngrouped(boxes.map((b) => (take.has(b.id) ? { ...b, group: g } : b)));
}

/** Desparte grupul casetei date. */
export function ungroupBox(boxes: CanvasBox[], id: string): CanvasBox[] {
  const g = boxes.find((b) => b.id === id)?.group;
  return g ? boxes.map((b) => (b.group === g ? (({ group: _g, ...r }) => r)(b) : b)) : boxes;
}

/** Mută casetele date cu dx, dy, toate la fel, cât încap în pânză. */
export function shiftBoxes(boxes: CanvasBox[], ids: Iterable<string>, dx: number, dy: number): CanvasBox[] {
  const set = new Set(ids);
  const m = boxes.filter((b) => set.has(b.id));
  if (!m.length) return boxes;
  const lim = (d: number, lo: number, hi: number) => Math.round(Math.min(CANVAS_MAX - hi, Math.max(-lo, d)));
  const ddx = lim(dx, Math.min(...m.map((b) => b.x)), Math.max(...m.map((b) => b.x)));
  const ddy = lim(dy, Math.min(...m.map((b) => b.y)), Math.max(...m.map((b) => b.y)));
  return boxes.map((b) => (set.has(b.id) ? { ...b, x: b.x + ddx, y: b.y + ddy } : b));
}

export const newBoxId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Casetă nouă la locul dat (prinsă în pânză). */
export function makeBox(x: number, y: number, text = ''): CanvasBox {
  return { id: newBoxId(), x: num(x, 0, CANVAS_MAX, 0), y: num(y, 0, CANVAS_MAX, 0), w: 240, text };
}

/** Casetele în ordinea de citire: rânduri de sus în jos (casetele care încep la cel mult 24 px una de alta sunt pe același rând), apoi de la stânga. */
export function readingOrder(boxes: CanvasBox[]): CanvasBox[] {
  const byY = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: CanvasBox[][] = [];
  for (const b of byY) {
    const row = rows[rows.length - 1];
    if (row && b.y - row[0].y <= 24) row.push(b); else rows.push([b]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}

/** Textul casetelor nevide, în ordinea de citire, despărțite de un rând gol (pentru căutare și export). */
export const boxesText = (boxes: CanvasBox[] | undefined) =>
  readingOrder((boxes ?? []).filter((b) => b.text.trim())).map((b) => b.text.replace(/\s+$/, '')).join('\n\n');

/** Pozele de pe pânză, în ordinea de citire (pentru export). */
export const boxImages = (boxes: CanvasBox[] | undefined) => readingOrder((boxes ?? []).filter((b) => b.img)).map((b) => b.img!);

/** Textul notiței urmat de casetele pânzei (pentru export), despărțite de un rând gol. */
export const withBoxes = (body: string, n: { boxes?: CanvasBox[] }) => {
  const t = boxesText(n.boxes);
  return t ? `${body.replace(/\s+$/, '')}${body.trim() ? '\n\n' : ''}${t}` : body;
};

/** Liniile scrise direct pe pânză, în pixelii pânzei: [x, y, apăsare] pentru fiecare punct. */
export interface WetStroke { tool: 'pen' | 'marker'; color: string; size: number; pts: [number, number, number][] }

/** Lățimea pe care o are foaia ferestrei de desen (Draw.tsx), ca desenul scris pe pânză să se poată redeschide cu ✎. */
export const INK_SHEET_W = 1200;
// Caseta are rama de 1 px și bara de 16 px deasupra pozei: caseta se pune așa încât poza să cadă exact unde s-a scris.
const BOX_EDGE = 1, BOX_BAR = 16;

/** Unde se pune caseta făcută din liniile scrise pe pânză și cum se mută liniile în foaia de desen (INK_SHEET_W lățime). */
export function inkBoxPlace(strokes: WetStroke[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) {
    // Marginea liniei: jumătate din cea mai mare grosime (la markerul de evidențiere linia e mult mai lată).
    const pad = (s.tool === 'marker' ? s.size * 4 + 8 : s.size * 1.5) / 2 + 2;
    for (const [x, y] of s.pts) { x0 = Math.min(x0, x - pad); y0 = Math.min(y0, y - pad); x1 = Math.max(x1, x + pad); y1 = Math.max(y1, y + pad); }
  }
  if (!Number.isFinite(x0)) return null;
  x0 = Math.max(BOX_EDGE, Math.floor(x0)); y0 = Math.max(BOX_EDGE + BOX_BAR, Math.floor(y0));
  const w = Math.min(BOX_MAX_W - 2 * BOX_EDGE, Math.max(BOX_MIN_W - 2 * BOX_EDGE, Math.ceil(x1) - x0));
  const h = Math.max(8, Math.ceil(y1) - y0);
  const k = INK_SHEET_W / w;
  const sheet = strokes.map((s) => ({
    tool: s.tool, color: s.color, size: Math.min(200, s.size * k),
    pts: s.pts.map(([x, y, p]) => [(x - x0) * k, (y - y0) * k, p] as [number, number, number]),
  }));
  return {
    /** Dreptunghiul pozei, în pixelii pânzei. */
    x0, y0, w, h,
    /** Locul casetei (cu rama și bara ei). */
    box: { x: num(x0 - BOX_EDGE, 0, CANVAS_MAX, 0), y: num(y0 - BOX_EDGE - BOX_BAR, 0, CANVAS_MAX, 0), w: w + 2 * BOX_EDGE },
    /** Liniile în foaia de desen, cu foaia înaltă cât trebuie (proporțiile pozei). */
    sheet, sheetH: Math.round(h * k),
  };
}

/** Înălțimea pânzei: sub cea mai de jos casetă rămâne loc pentru încă una. */
export const canvasHeight = (boxes: CanvasBox[] | undefined, lineH = 22) =>
  Math.min(CANVAS_MAX + 400, Math.max(360, ...(boxes ?? []).map((b) => b.y + (b.img ? b.w : 0) + (b.text.split('\n').length + 2) * lineH + 160)));
