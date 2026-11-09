// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mutarea celulelor prin tragere (de marginea selecției), ca în programele de calcul tabelar: conținutul și formatarea
// pleacă în locul nou, iar formulele din toate foile care arătau spre celulele mutate arată acum spre locul nou.
// Formulele mutate își păstrează referințele (nu se „deplasează” ca la copiere). Referințele spre celulele peste care
// s-a scris (din afara zonei mutate) devin #REF!, ca acolo. Cu Ctrl, tragerea copiază (formulele se deplasează ca la lipire).
// Testat în tests/sheets-move.test.mjs.
import { cellId, colName, COLS, ROWS, Sheet } from './format';
import { colIndex } from './filter';
import { sheetKey, shiftFormula } from './formula';
import { prefixAt } from './insert';

export interface Rect { r0: number; c0: number; r1: number; c1: number }
const inRect = (g: Rect, r: number, c: number) => r >= g.r0 && r <= g.r1 && c >= g.c0 && c <= g.c1;

// Referință (cu sau fără „$”), ca în insert.ts.
const REF = /(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\p{L}\d_(!])/giu;

/**
 * Referințele unei formule după mutarea zonei `from` cu (dr, dc) în foaia `target`.
 * O referință (sau o zonă cu ambele capete) din `from` se mută; una singură spre o celulă acoperită de mutare devine #REF!.
 */
export function moveFormulaRefs(f: string, from: Rect, dr: number, dc: number, inTarget: boolean, target: string): string {
  if (!f.startsWith('=')) return f;
  const src = f.slice(1);
  const key = sheetKey(target);
  const to: Rect = { r0: from.r0 + dr, c0: from.c0 + dc, r1: from.r1 + dr, c1: from.c1 + dc };
  const skip: [number, number][] = [];
  const strings = /"(?:[^"]|"")*"?|'(?:[^']|'')*'?/g;
  for (let m = strings.exec(src); m; m = strings.exec(src)) skip.push([m.index, m.index + m[0].length]);
  // Întâi toate referințele (cu poziția lor), ca să știm care sunt capete de zonă.
  interface Hit { pos: number; len: number; cAbs: string; rAbs: string; r: number; c: number; startPos: number; pair?: Hit }
  const hits: Hit[] = [];
  REF.lastIndex = 0;
  for (let m = REF.exec(src); m; m = REF.exec(src)) {
    const pos = m.index;
    if (skip.some(([a, b]) => pos >= a && pos < b)) continue;
    const prev = src[pos - 1];
    if (prev && /[\p{L}\d_.$]/u.test(prev)) continue;
    hits.push({ pos, len: m[0].length, cAbs: m[1], rAbs: m[3], r: Number(m[4]) - 1, c: colIndex(m[2].toUpperCase()), startPos: pos });
  }
  for (let i = 1; i < hits.length; i++) {
    const a = hits[i - 1], b = hits[i];
    if (a.pos + a.len + 1 === b.pos && src[b.pos - 1] === ':') { a.pair = b; b.pair = a; b.startPos = a.pos; }
  }
  let out = '';
  let last = 0;
  for (const h of hits) {
    const sheet = prefixAt(src, h.startPos);
    if (sheet === null ? !inTarget : sheetKey(sheet) !== key) continue;
    let text: string | null = null;
    if (h.pair) {
      // Zona se mută doar dacă e toată în zona mutată.
      const [a, b] = h.startPos === h.pos ? [h, h.pair] : [h.pair, h];
      if (inRect(from, a.r, a.c) && inRect(from, b.r, b.c)) text = `${h.cAbs}${colName(h.c + dc)}${h.rAbs}${h.r + 1 + dr}`;
    } else if (inRect(from, h.r, h.c)) text = `${h.cAbs}${colName(h.c + dc)}${h.rAbs}${h.r + 1 + dr}`;
    else if (inRect(to, h.r, h.c)) text = '#REF!';
    if (text === null) continue;
    out += src.slice(last, h.pos) + text;
    last = h.pos + h.len;
  }
  return last ? '=' + out + src.slice(last) : f;
}

/** Ținta mutării: zona `g` deplasată cu (dr, dc), ținută în tabel. */
export function moveTarget(g: Rect, dr: number, dc: number): Rect {
  const r = Math.max(-g.r0, Math.min(ROWS - 1 - g.r1, dr)), c = Math.max(-g.c0, Math.min(COLS - 1 - g.c1, dc));
  return { r0: g.r0 + r, c0: g.c0 + c, r1: g.r1 + r, c1: g.c1 + c };
}

/**
 * Mută (sau copiază, cu `copy`) zona `from` a foii `active` la `to` (aceeași mărime). Întoarce foile noi și câte celule
 * cu date din afara zonei au fost acoperite. Graficele, îmbinările și restul foii rămân cum sunt.
 */
export function moveCells(sheets: Sheet[], active: number, from: Rect, to: Rect, copy: boolean): { sheets: Sheet[]; overwritten: number } {
  const dr = to.r0 - from.r0, dc = to.c0 - from.c0;
  const sh = sheets[active];
  let overwritten = 0;
  for (let r = to.r0; r <= to.r1; r++) for (let c = to.c0; c <= to.c1; c++) if (!inRect(from, r, c) && (sh.cells[cellId(r, c)] ?? '') !== '') overwritten++;
  if (!dr && !dc) return { sheets, overwritten: 0 };
  // Ce se mută: conținutul (formulele copiate se deplasează) și formatarea.
  const moved: Record<string, string> = {}, movedSt: Sheet['styles'] = {};
  for (let r = from.r0; r <= from.r1; r++) for (let c = from.c0; c <= from.c1; c++) {
    const id = cellId(r, c), v = sh.cells[id], st = sh.styles[id], nid = cellId(r + dr, c + dc);
    if (v !== undefined && v !== '') moved[nid] = copy ? shiftFormula(v, dr, dc) : v;
    if (st) movedSt[nid] = { ...st };
  }
  const next = sheets.map((s, i) => {
    let cells = s.cells;
    if (!copy) {
      // Referințele din toate foile urmează celulele mutate.
      let changed = false;
      const nc: Record<string, string> = {};
      for (const [id, v] of Object.entries(s.cells)) {
        const w = v.startsWith('=') ? moveFormulaRefs(v, from, dr, dc, i === active, sh.name) : v;
        if (w !== v) changed = true;
        nc[id] = w;
      }
      if (changed) cells = nc;
    }
    if (i !== active) return cells === s.cells ? s : { ...s, cells };
    const c2 = { ...cells }, st2 = { ...s.styles };
    // Formulele mutate trec și ele prin rescriere (o formulă mutată care arăta spre altă celulă mutată o urmează).
    const movedNow: Record<string, string> = {};
    for (const [nid, v] of Object.entries(moved)) movedNow[nid] = !copy && v.startsWith('=') ? moveFormulaRefs(v, from, dr, dc, true, sh.name) : v;
    if (!copy) for (let r = from.r0; r <= from.r1; r++) for (let c = from.c0; c <= from.c1; c++) { delete c2[cellId(r, c)]; delete st2[cellId(r, c)]; }
    for (let r = to.r0; r <= to.r1; r++) for (let c = to.c0; c <= to.c1; c++) { delete c2[cellId(r, c)]; delete st2[cellId(r, c)]; }
    Object.assign(c2, movedNow);
    Object.assign(st2, movedSt);
    return { ...s, cells: c2, styles: st2 };
  });
  return { sheets: next, overwritten };
}
