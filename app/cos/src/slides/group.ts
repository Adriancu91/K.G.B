// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Gruparea casetelor (Group / Ungroup): casetele cu același `grp` se aleg, se mută, se copiază și se șterg împreună.
// În .pptx devin un <p:grpSp> (la export îl scriem noi; la import grupul de pe primul nivel se păstrează).
import { uid, type SlideEl } from './model';

/** Casetele din grupul casetei `id` (ea prima); fără grup, doar ea. */
export function groupOf(els: SlideEl[], id: string): string[] {
  const g = els.find((e) => e.id === id)?.grp;
  if (!g) return [id];
  return [id, ...els.filter((e) => e.grp === g && e.id !== id).map((e) => e.id)];
}

/** Toate casetele alese, cu grupurile lor întregi. */
export function withGroups(els: SlideEl[], ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) for (const x of groupOf(els, id)) if (!out.includes(x)) out.push(x);
  return out;
}

/** Grupează casetele alese (cel puțin două) într-un grup nou; grupurile lor vechi se înlocuiesc. */
export function groupEls(els: SlideEl[], ids: string[]): SlideEl[] {
  const all = withGroups(els, ids);
  if (all.length < 2) return els;
  const g = uid();
  return cleanGroups(els.map((e) => (all.includes(e.id) ? { ...e, grp: g } : e)));
}

/** Scoate din grup casetele alese (și restul grupurilor lor). */
export function ungroupEls(els: SlideEl[], ids: string[]): SlideEl[] {
  const gs = new Set(ids.map((id) => els.find((e) => e.id === id)?.grp).filter(Boolean));
  return els.map((e) => {
    if (!e.grp || !gs.has(e.grp)) return e;
    const { grp: _g, ...rest } = e;
    return rest;
  });
}

/** Grupurile rămase cu o singură casetă (după ștergere sau mutare pe alt slide) nu mai sunt grupuri. */
export function cleanGroups(els: SlideEl[]): SlideEl[] {
  const n = new Map<string, number>();
  for (const e of els) if (e.grp) n.set(e.grp, (n.get(e.grp) ?? 0) + 1);
  if (![...n.values()].some((c) => c < 2)) return els;
  return els.map((e) => {
    if (!e.grp || (n.get(e.grp) ?? 0) > 1) return e;
    const { grp: _g, ...rest } = e;
    return rest;
  });
}

/** Casetele lipite sau copiate primesc grupuri noi (aceleași între ele), ca să nu se lege de grupul de unde au venit. */
export function freshGroups(els: SlideEl[]): SlideEl[] {
  const map = new Map<string, string>();
  return cleanGroups(els.map((e) => {
    if (!e.grp) return e;
    if (!map.has(e.grp)) map.set(e.grp, uid());
    return { ...e, grp: map.get(e.grp)! };
  }));
}

const EMU = 9525;
const NODE_RE = /<p:(sp|pic|graphicFrame|cxnSp)[ >]/g;

/** Bucata de XML a casetei `id` din slide (p:sp, p:pic, p:graphicFrame sau p:cxnSp de pe primul nivel). */
function nodeRange(text: string, id: string): [number, number] | null {
  const at = text.indexOf(`name="el-${id}"`);
  if (at < 0) return null;
  let start = -1, tag = '';
  NODE_RE.lastIndex = 0;
  for (let m = NODE_RE.exec(text); m && m.index < at; m = NODE_RE.exec(text)) { start = m.index; tag = m[1]; }
  if (start < 0) return null;
  const close = `</p:${tag}>`, end = text.indexOf(close, at);
  return end < 0 ? null : [start, end + close.length];
}

/**
 * Export .pptx: casetele fiecărui grup se mută într-un <p:grpSp>, pus în locul celei mai din spate dintre ele
 * (ordinea lor rămâne). Coordonatele copiilor rămân cele de pe slide (chOff/chExt = off/ext ale grupului).
 */
export function groupXml(text: string, els: SlideEl[]): string {
  const groups = new Map<string, SlideEl[]>();
  for (const e of els) if (e.grp && /^[\w-]+$/.test(e.id)) groups.set(e.grp, [...(groups.get(e.grp) ?? []), e]);
  let next = Math.max(0, ...[...text.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => +m[1])) + 1;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const parts: { r: [number, number]; xml: string }[] = [];
    for (const e of members) {
      const r = nodeRange(text, e.id);
      if (r) parts.push({ r, xml: text.slice(r[0], r[1]) });
    }
    if (parts.length < 2) continue;
    parts.sort((a, b) => a.r[0] - b.r[0]);
    const x = Math.min(...members.map((e) => e.x)), y = Math.min(...members.map((e) => e.y));
    const r = Math.max(...members.map((e) => e.x + e.w)), b = Math.max(...members.map((e) => e.y + e.h));
    const off = `<a:off x="${Math.round(x * EMU)}" y="${Math.round(y * EMU)}"/>`, ext = `<a:ext cx="${Math.round((r - x) * EMU)}" cy="${Math.round((b - y) * EMU)}"/>`;
    const id = next++;
    const grp = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="Grup ${id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
      + `<p:grpSpPr><a:xfrm>${off}${ext}${off.replace('a:off', 'a:chOff')}${ext.replace('a:ext', 'a:chExt')}</a:xfrm></p:grpSpPr>`
      + parts.map((p) => p.xml).join('') + '</p:grpSp>';
    // De la coadă spre început, ca pozițiile de dinainte să rămână bune; primul loc primește grupul.
    for (let i = parts.length - 1; i >= 0; i--) text = text.slice(0, parts[i].r[0]) + (i === 0 ? grp : '') + text.slice(parts[i].r[1]);
  }
  return text;
}

export type Box = { x: number; y: number; w: number; h: number };

/** Chenarul care cuprinde casetele date. */
export function boxOf(els: Box[]): Box {
  const x = Math.min(...els.map((e) => e.x)), y = Math.min(...els.map((e) => e.y));
  return { x, y, w: Math.max(...els.map((e) => e.x + e.w)) - x, h: Math.max(...els.map((e) => e.y + e.h)) - y };
}

/**
 * Mărirea grupului din colțul `corner` (nw / ne / sw / se) cu (dx, dy): colțul opus rămâne pe loc, iar fiecare casetă
 * își schimbă locul și mărimea în aceeași proporție. `keep` păstrează proporțiile grupului (Shift).
 */
export function scaleGroup(els: (Box & { id: string })[], corner: string, dx: number, dy: number, keep = false, min = 10): { id: string; g: Box }[] {
  const b = boxOf(els);
  if (!b.w || !b.h) return els.map((e) => ({ id: e.id, g: { x: e.x, y: e.y, w: e.w, h: e.h } }));
  const east = corner.includes('e'), south = corner.includes('s');
  let w = Math.max(min, b.w + (east ? dx : -dx)), h = Math.max(min, b.h + (south ? dy : -dy));
  if (keep) { const k = Math.max(w / b.w, h / b.h); w = b.w * k; h = b.h * k; }
  const x0 = east ? b.x : b.x + b.w - w, y0 = south ? b.y : b.y + b.h - h;
  const kx = w / b.w, ky = h / b.h;
  return els.map((e) => ({
    id: e.id,
    g: { x: Math.round(x0 + (e.x - b.x) * kx), y: Math.round(y0 + (e.y - b.y) * ky), w: Math.max(1, Math.round(e.w * kx)), h: Math.max(1, Math.round(e.h * ky)) },
  }));
}
