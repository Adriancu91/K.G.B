// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ortografia în Sheets (F7): celulele cu text, rând cu rând, de la celula aleasă (verificarea e în src/spell.ts).
import { parseCellId } from './format';
import type { SpellCell } from '../spell';

/** Celulele cu text scris de mână (nu formule, nu numere), în ordinea citirii, începând cu cea aleasă și apoi de sus. */
export function spellCells(cells: Record<string, string>, from?: { r: number; c: number }, hidden: Set<number> = new Set()): SpellCell[] {
  const list: SpellCell[] = [];
  for (const [id, raw] of Object.entries(cells)) {
    const p = parseCellId(id);
    if (!p || hidden.has(p.r) || !raw || raw.startsWith('=') || !/\p{L}/u.test(raw)) continue;
    if (/^[-+]?[\d\s.,]+%?$/.test(raw.trim())) continue;
    list.push({ id, r: p.r, c: p.c, text: raw.startsWith("'") ? raw.slice(1) : raw });
  }
  list.sort((a, b) => a.r - b.r || a.c - b.c);
  if (!from) return list;
  const k = list.findIndex((x) => x.r > from.r || (x.r === from.r && x.c >= from.c));
  return k <= 0 ? list : [...list.slice(k), ...list.slice(0, k)];
}

/** Textul nou al celulelor schimbate, cu apostroful de la început păstrat (dacă era). */
export function spellPatch(cells: Record<string, string>, patch: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [id, t] of Object.entries(patch)) out[id] = (cells[id] ?? '').startsWith("'") ? "'" + t : t;
  return out;
}
