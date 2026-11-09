// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Desenul editabil: liniile unui desen de mână pus în notiță se păstrează lângă poză (`imageInk`, aceeași ordine ca
// `images`), ca desenul să se poată redeschide și schimba linie cu linie, nu doar ca poză.
import type { Paper, Stroke, Tool } from './Draw';

/** h: înălțimea foii, când nu e cea obișnuită (desenul scris direct pe pânza liberă are proporțiile lui). */
export interface Ink { paper: Paper; strokes: Stroke[]; h?: number }

/** Cât poate avea cel mult desenul păstrat (textul JSON); un desen mai mare rămâne doar poză. */
export const MAX_INK = 600_000;
const TOOLS: Tool[] = ['pen', 'marker', 'line', 'rect', 'ellipse', 'erase'];
const PAPERS: Paper[] = ['blank', 'lines', 'grid'];
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Desenul ca text (punctele rotunjite la o zecime); null dacă e gol sau prea mare. */
export function packInk(ink: Ink): string | null {
  if (!ink.strokes.length) return null;
  const s = JSON.stringify({
    v: 1,
    paper: ink.paper,
    ...(ink.h ? { h: Math.round(ink.h) } : {}),
    strokes: ink.strokes.map((st) => ({
      tool: st.tool, color: st.color, size: st.size,
      pts: st.pts.map(([x, y, p]) => [r1(x), r1(y), Math.round(p * 100) / 100]),
      ...(st.round ? { round: true } : {}),
    })),
  });
  return s.length <= MAX_INK ? s : null;
}

/** Citește desenul păstrat; null dacă lipsește sau nu e bun (de exemplu un caiet stricat). */
export function unpackInk(s: unknown): Ink | null {
  if (typeof s !== 'string' || s.length > MAX_INK) return null;
  let j: { v?: unknown; paper?: unknown; strokes?: unknown; h?: unknown };
  try { j = JSON.parse(s); } catch { return null; }
  if (!j || j.v !== 1 || !Array.isArray(j.strokes)) return null;
  const strokes: Stroke[] = [];
  for (const st of j.strokes as Record<string, unknown>[]) {
    if (!st || !TOOLS.includes(st.tool as Tool) || typeof st.color !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(st.color)) continue;
    if (typeof st.size !== 'number' || !(st.size > 0) || st.size > 200 || !Array.isArray(st.pts)) continue;
    const pts = (st.pts as unknown[]).filter((p): p is [number, number, number] =>
      Array.isArray(p) && p.length === 3 && p.every((v) => typeof v === 'number' && Number.isFinite(v)));
    if (!pts.length) continue;
    strokes.push({ tool: st.tool as Tool, color: st.color, size: st.size, pts, ...(st.round === true ? { round: true } : {}) });
  }
  if (!strokes.length) return null;
  const h = typeof j.h === 'number' && j.h >= 150 && j.h <= 2400 ? Math.round(j.h) : undefined;
  return { paper: PAPERS.includes(j.paper as Paper) ? (j.paper as Paper) : 'blank', strokes, ...(h ? { h } : {}) };
}

/** `imageInk` curățat la citirea caietului: aceeași lungime ca pozele, doar desene bune; undefined dacă nu e niciunul. */
export function cleanInk(raw: unknown, count: number): (string | null)[] | undefined {
  if (!Array.isArray(raw) || !count) return undefined;
  const list = raw.slice(0, count).map((s) => (unpackInk(s) ? (s as string) : null));
  return list.some(Boolean) ? list : undefined;
}
