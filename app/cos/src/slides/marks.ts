// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
/**
 * Formatarea pe bucăți de text dintr-o casetă (aldin, cursiv, subliniat, tăiat, culoare, font doar pe cuvintele selectate).
 * Textul casetei rămâne un șir simplu (`el.text`, folosit la căutare, export, schiță); formatul stă alături, în `el.marks`:
 * bucăți [s, e) din șir, fiecare cu felul ei. Ce nu e acoperit de o bucată are formatul casetei.
 */
import type { CSSProperties } from 'react';

export interface MarkFmt {
  /** Aldin / cursiv: true = pornit, false = oprit pe bucata asta, chiar dacă toată caseta e aldină / cursivă. */
  b?: boolean;
  i?: boolean;
  /** Subliniat și tăiat (doar pornite: o linie a casetei nu se poate scoate de pe o bucată). */
  u?: boolean;
  k?: boolean;
  /** Culoarea textului (#rrggbb) și fontul. */
  c?: string;
  f?: string;
  /** Mărimea, ca înmulțitor față de mărimea casetei (1,5 = de o dată și jumătate mai mare). */
  z?: number;
  /** Evidențierea (culoarea de fundal a literelor, ca un marker), #rrggbb. */
  h?: string;
  /** Exponent (sus, mai mic) sau indice (jos, mai mic), ca x² sau H₂O. */
  v?: 'sup' | 'sub';
}
export interface TextMark extends MarkFmt { s: number; e: number }
export type MarkKey = keyof MarkFmt;
const KEYS: MarkKey[] = ['b', 'i', 'u', 'k', 'c', 'f', 'z', 'h', 'v'];
/** Exponentul / indicele se scriu cu 65% din mărime (înmulțit cu mărimea bucății, dacă are una). */
const V_SCALE = 0.65;
const vSize = (f: MarkFmt) => (f.v ? `calc(${f.z ?? 1}em * ${V_SCALE})` : f.z ? `${f.z}em` : '');

const NBSP = String.fromCharCode(160);
const sameFmt = (a: MarkFmt, b: MarkFmt) => KEYS.every((k) => a[k] === b[k]);
const fmtOnly = (m: MarkFmt): MarkFmt => { const o: MarkFmt = {}; for (const k of KEYS) if (m[k] !== undefined) (o as Record<string, unknown>)[k] = m[k]; return o; };
const isEmpty = (m: MarkFmt) => KEYS.every((k) => m[k] === undefined);

/** Bucățile puse în ordine, fără cele goale sau ieșite din text, iar cele lipite cu același format unite. */
export function cleanMarks(marks: TextMark[] | undefined, len: number): TextMark[] | undefined {
  if (!marks?.length) return undefined;
  const out: TextMark[] = [];
  for (const m of [...marks].sort((a, b) => a.s - b.s)) {
    const s = Math.max(0, m.s), e = Math.min(len, m.e);
    if (e <= s || isEmpty(m)) continue;
    const last = out[out.length - 1];
    if (last && last.e >= s && sameFmt(last, m)) last.e = Math.max(last.e, e);
    else out.push({ ...fmtOnly(m), s: last ? Math.max(s, last.e) : s, e });
  }
  const res = out.filter((m) => m.e > m.s);
  return res.length ? res : undefined;
}

/** Scoate o proprietate din toate bucățile (când se pune pe toată caseta, ca în PowerPoint). */
export function stripMarks(marks: TextMark[] | undefined, keys: MarkKey[]): TextMark[] | undefined {
  if (!marks) return undefined;
  return cleanMarks(marks.map((m) => { const o = { ...m }; for (const k of keys) delete o[k]; return o; }), Infinity);
}

/** Bucățile de text dintre `from` și `to`, fiecare cu formatul ei (gol = al casetei). */
export function segments(text: string, from: number, to: number, marks: TextMark[] | undefined): { t: string; f: MarkFmt }[] {
  const out: { t: string; f: MarkFmt }[] = [];
  let p = from;
  for (const m of marks ?? []) {
    if (m.e <= p || m.s >= to) continue;
    const s = Math.max(m.s, p), e = Math.min(m.e, to);
    if (s > p) out.push({ t: text.slice(p, s), f: {} });
    out.push({ t: text.slice(s, e), f: fmtOnly(m) });
    p = e;
  }
  if (p < to) out.push({ t: text.slice(p, to), f: {} });
  return out.filter((x) => x.t);
}

/** Felul bucății în CSS (pentru afișare). */
export function markCss(f: MarkFmt): CSSProperties {
  const deco = [f.u ? 'underline' : '', f.k ? 'line-through' : ''].filter(Boolean).join(' ');
  return {
    ...(f.b !== undefined ? { fontWeight: f.b ? 700 : 400 } : {}),
    ...(f.i !== undefined ? { fontStyle: f.i ? 'italic' : 'normal' } : {}),
    ...(deco ? { textDecorationLine: deco } : {}),
    ...(f.c ? { color: f.c } : {}),
    ...(f.f ? { fontFamily: `"${f.f}"` } : {}),
    ...(vSize(f) ? { fontSize: vSize(f) } : {}),
    ...(f.h ? { backgroundColor: f.h } : {}),
    ...(f.v ? { verticalAlign: f.v === 'sup' ? 'super' : 'sub' } : {}),
  };
}
const cssText = (f: MarkFmt) => {
  const s = markCss(f);
  return [
    s.fontWeight !== undefined ? `font-weight:${s.fontWeight}` : '',
    s.fontStyle ? `font-style:${s.fontStyle}` : '',
    s.textDecorationLine ? `text-decoration-line:${s.textDecorationLine}` : '',
    s.color ? `color:${s.color}` : '',
    f.f ? `font-family:'${f.f.replace(/['"<>&]/g, '')}'` : '',
    vSize(f) ? `font-size:${vSize(f)}` : '',
    f.h ? `background-color:${f.h}` : '',
    f.v ? `vertical-align:${f.v === 'sup' ? 'super' : 'sub'}` : '',
  ].filter(Boolean).join(';');
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** HTML-ul bucății de text dintre `from` și `to`, cu formatul pe bucăți (pentru caseta editabilă). */
export function marksHtml(text: string, from: number, to: number, marks: TextMark[] | undefined): string {
  return segments(text, from, to, marks).map(({ t, f }) => (isEmpty(f) ? esc(t) : `<span style="${cssText(f)}">${esc(t)}</span>`)).join('');
}

/** Culoarea CSS ca #rrggbb (rgb(…) din editor → hex); undefined dacă nu se poate citi. */
export function toHex(c: string): string | undefined {
  const t = c.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{3}$/.test(t)) return '#' + [...t.slice(1)].map((x) => x + x).join('');
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(t);
  return m ? '#' + m.slice(1, 4).map((v) => Number(v).toString(16).padStart(2, '0')).join('') : undefined;
}

/** Formatul unui nod din caseta editabilă: elementele dintre el și casetă (cel mai apropiat câștigă). */
function fmtOfNode(el: Element | null, root: Element): MarkFmt {
  const f: MarkFmt = {};
  let zz = 1;
  for (let n = el; n && n !== root; n = n.parentElement) {
    const tag = n.localName, st = (n as HTMLElement).style;
    if (f.b === undefined) {
      if (tag === 'b' || tag === 'strong') f.b = true;
      else if (st?.fontWeight) f.b = st.fontWeight === 'bold' || st.fontWeight === 'bolder' || Number(st.fontWeight) >= 600;
    }
    if (f.i === undefined) {
      if (tag === 'i' || tag === 'em') f.i = true;
      else if (st?.fontStyle) f.i = st.fontStyle === 'italic' || st.fontStyle === 'oblique';
    }
    const deco = `${st?.textDecorationLine ?? ''} ${st?.textDecoration ?? ''}`;
    if (tag === 'u' || /underline/.test(deco)) f.u = true;
    if (tag === 's' || tag === 'strike' || tag === 'del' || /line-through/.test(deco)) f.k = true;
    if (f.c === undefined) {
      const c = (tag === 'font' && n.getAttribute('color')) || st?.color;
      if (c) f.c = toHex(c);
    }
    if (f.f === undefined) {
      const face = (tag === 'font' && n.getAttribute('face')) || st?.fontFamily;
      if (face) f.f = face.split(',')[0].replace(/["']/g, '').trim() || undefined;
    }
    if (f.v === undefined) {
      if (tag === 'sup' || st?.verticalAlign === 'super') f.v = 'sup';
      else if (tag === 'sub' || st?.verticalAlign === 'sub') f.v = 'sub';
    }
    // Mărimea scrisă de noi la exponent / indice: calc(<z>em * 0.65), adică doar <z> e mărimea bucății.
    const vz = /^calc\(([\d.]+)em \* [\d.]+\)$/.exec(st?.fontSize ?? '');
    if (vz && parseFloat(vz[1]) > 0) zz *= parseFloat(vz[1]);
    if (f.h === undefined && st?.backgroundColor) f.h = toHex(st.backgroundColor) ?? (st.backgroundColor === 'transparent' ? '' : undefined);
    // Mărimile în em se înmulțesc (o bucată mărită în interiorul alteia mărite).
    if (st?.fontSize?.endsWith('em') && parseFloat(st.fontSize) > 0) zz *= parseFloat(st.fontSize);
  }
  const z = Math.round(zz * 100) / 100;
  if (z !== 1) f.z = z;
  if (f.h === '') delete f.h; // „fără evidențiere” pe o bucată din interiorul uneia evidențiate
  return fmtOnly(f);
}

/**
 * Citește formatul pe bucăți din caseta editabilă `root`, al cărei text (fără format) e `text`.
 * Fiecare nod de text se caută în ordine în șir (tab-urile de nivel și trecerile la rând nu sunt în noduri).
 */
export function marksFromDom(root: Element, text: string): TextMark[] | undefined {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: TextMark[] = [];
  let pos = 0;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const d = n.data.split(NBSP).join(' ');
    if (!d) continue;
    const at = text.indexOf(d, pos);
    if (at < 0) continue;
    pos = at + d.length;
    const f = fmtOfNode(n.parentElement, root);
    if (!isEmpty(f)) out.push({ ...f, s: at, e: at + d.length });
  }
  return cleanMarks(out, text.length);
}

/** Pune `patch` pe literele [s, e) (o valoare undefined scoate proprietatea), păstrând restul formatului fiecărei litere. */
export function applyMarks(marks: TextMark[] | undefined, len: number, s: number, e: number, patch: MarkFmt): TextMark[] | undefined {
  const per: MarkFmt[] = Array.from({ length: len }, () => ({}));
  for (const m of marks ?? []) for (let x = Math.max(0, m.s); x < Math.min(len, m.e); x++) per[x] = fmtOnly(m);
  for (let x = Math.max(0, s); x < Math.min(len, e); x++) {
    const f = { ...per[x], ...patch };
    for (const k of KEYS) if (f[k] === undefined) delete f[k];
    per[x] = f;
  }
  return cleanMarks(per.map((f, x) => ({ ...f, s: x, e: x + 1 })), len);
}

/** Locul selecției `r` în textul simplu al casetei editabile (ca la marksFromDom); null dacă nu atinge text. */
export function rangeOffsets(root: Element, text: string, r: Range): [number, number] | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0, s = -1, e = -1;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const d = n.data.split(NBSP).join(' ');
    if (!d) continue;
    const at = text.indexOf(d, pos);
    if (at < 0) continue;
    pos = at + d.length;
    if (!r.intersectsNode(n)) continue;
    const from = n === r.startContainer ? r.startOffset : 0, to = n === r.endContainer ? r.endOffset : d.length;
    if (to <= from && n !== r.startContainer) continue;
    if (s < 0) s = at + from;
    e = at + to;
  }
  return s >= 0 && e > s ? [s, e] : null;
}

/** Bucățile citite dintr-un fișier .sslides: doar câmpurile cunoscute, cu valori bune. */
export function parseMarks(v: unknown, len: number): TextMark[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const ok = v.slice(0, 5000).filter((m) => m && typeof m === 'object' && Number.isInteger(m.s) && Number.isInteger(m.e)).map((m): TextMark => ({
    s: m.s, e: m.e,
    ...(typeof m.b === 'boolean' ? { b: m.b } : {}),
    ...(typeof m.i === 'boolean' ? { i: m.i } : {}),
    ...(m.u === true ? { u: true } : {}),
    ...(m.k === true ? { k: true } : {}),
    ...(typeof m.c === 'string' && /^#[0-9a-f]{6}$/i.test(m.c) ? { c: m.c.toLowerCase() } : {}),
    ...(typeof m.f === 'string' && /^[\p{L}\p{N} ._-]{1,60}$/u.test(m.f) ? { f: m.f } : {}),
    ...(typeof m.h === 'string' && /^#[0-9a-f]{6}$/i.test(m.h) ? { h: m.h.toLowerCase() } : {}),
    ...(m.v === 'sup' || m.v === 'sub' ? { v: m.v } : {}),
    ...(typeof m.z === 'number' && m.z >= 0.2 && m.z <= 6 && m.z !== 1 ? { z: Math.round(m.z * 100) / 100 } : {}),
  }));
  return cleanMarks(ok, len);
}

/** Bucățile după o schimbare de text făcută din afara casetei (Înlocuiește, Aa): rămân doar dacă lungimea e aceeași. */
export const marksAfterEdit = (marks: TextMark[] | undefined, before: string, after: string) => (before.length === after.length ? marks : undefined);
