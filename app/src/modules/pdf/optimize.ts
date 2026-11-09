// Original: src/pdf/optimize.ts din Cyber Office Studio, aplicația proprietarului (D-071, D-072), fără schimbări de logică.
// @ts-nocheck — K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine; testat în tests/.
// Optimizarea structurii PDF-ului (ca „PDF Optimizer” → Discard objects / Clean up): fără să atingă ce se vede pe pagină,
// scoate obiectele la care nu mai duce nimic, unește fluxurile identice (aceeași siglă, același font sau aceeași poză puse
// de mai multe ori de programul care a făcut PDF-ul), comprimă fluxurile lăsate necomprimate și, la alegere, scoate
// miniaturile vechi ale paginilor și datele private ale programelor. Salvarea folosește fluxuri de obiecte (mai mici).
// Testat în tests/pdf-optimize.test.mjs.
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFObject, PDFRawStream, PDFRef } from 'pdf-lib';
import { open } from './edit';
import { dropUnreachable } from './redactKeep';
import { pageContent, tokens } from './textRemove';

export interface OptimizeOptions { duplicates: boolean; compress: boolean; extras: boolean }
export const OPTIMIZE_DEFAULT: OptimizeOptions = { duplicates: true, compress: true, extras: true };
export interface OptimizeReport { unused: number; duplicates: number; compressed: number; extras: number; before: number; after: number }

const N = (s: string) => PDFName.of(s);

/** Amprenta unui flux: dicționarul lui (fără /Length) și octeții. */
function fingerprint(s: PDFRawStream): string {
  const parts: string[] = [];
  for (const [k, v] of s.dict.entries()) if (k !== N('Length')) parts.push(`${k}${v}`);
  let h = 0x811c9dc5;
  const b = s.contents;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619);
  return `${parts.sort().join('')}#${b.length}#${h >>> 0}`;
}

const same = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

export async function optimizePdf(bytes: Uint8Array, o: OptimizeOptions): Promise<{ bytes: Uint8Array; report: OptimizeReport }> {
  const doc = await open(bytes);
  const ctx = doc.context;
  const report: OptimizeReport = { unused: 0, duplicates: 0, compressed: 0, extras: 0, before: bytes.length, after: 0 };

  if (o.extras) {
    for (const k of ['PieceInfo']) if (doc.catalog.has(N(k))) { doc.catalog.delete(N(k)); report.extras++; }
    for (const p of doc.getPages()) for (const k of ['Thumb', 'PieceInfo']) if (p.node.has(N(k))) { p.node.delete(N(k)); report.extras++; }
  }

  dropUnusedResources(doc);

  const count = () => { let n = 0; for (const _ of ctx.enumerateIndirectObjects()) n++; return n; };
  const n0 = count();
  dropUnreachable(doc);
  report.unused = n0 - count();

  if (o.duplicates) {
    // Fluxurile identice: primul rămâne, celelalte trimiteri se mută pe el.
    const first = new Map<string, { ref: PDFRef; s: PDFRawStream }[]>();
    const alias = new Map<string, PDFRef>();
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const t = obj.dict.get(N('Type'));
      if (t === N('XRef') || t === N('ObjStm')) continue;
      const fp = fingerprint(obj);
      const list = first.get(fp) ?? [];
      const hit = list.find((x) => same(x.s.contents, obj.contents));
      if (hit) alias.set(ref.toString(), hit.ref);
      else { list.push({ ref, s: obj }); first.set(fp, list); }
    }
    if (alias.size) {
      const fix = (v: PDFObject | undefined): PDFObject | undefined => (v instanceof PDFRef ? alias.get(v.toString()) : undefined);
      const walk = (x: PDFObject | undefined, seen: Set<PDFObject>) => {
        if (!x || seen.has(x)) return;
        seen.add(x);
        if (x instanceof PDFDict) {
          for (const [k, v] of x.entries()) { const r = fix(v); if (r) x.set(k, r); else walk(v, seen); }
        } else if (x instanceof PDFArray) {
          for (let i = 0; i < x.size(); i++) { const v = x.get(i); const r = fix(v); if (r) x.set(i, r); else walk(v, seen); }
        } else if (x instanceof PDFRawStream) walk(x.dict, seen);
      };
      const seen = new Set<PDFObject>();
      for (const [, obj] of ctx.enumerateIndirectObjects()) walk(obj, seen);
      const t = ctx.trailerInfo;
      for (const k of ['Root', 'Info'] as const) { const r = fix(t[k]); if (r) t[k] = r; }
      report.duplicates = alias.size;
      for (const k of alias.keys()) {
        const [num, gen] = k.split(' ').map(Number);
        ctx.delete(PDFRef.of(num, gen));
      }
    }
  }

  if (o.compress) {
    for (const [ref, obj] of [...ctx.enumerateIndirectObjects()]) {
      if (!(obj instanceof PDFRawStream) || obj.dict.has(N('Filter')) || obj.contents.length < 64) continue;
      // Metadatele XMP rămân necomprimate (unele programe și PDF/A le vor citibile).
      if (obj.dict.get(N('Type')) === N('Metadata')) continue;
      const z = ctx.flateStream(obj.contents);
      if (z.contents.length > obj.contents.length * 0.9) continue;
      for (const [k, v] of obj.dict.entries()) if (k !== N('Length') && k !== N('DecodeParms')) z.dict.set(k, v);
      z.dict.set(N('Filter'), N('FlateDecode'));
      ctx.assign(ref, z);
      report.compressed++;
    }
  }

  const out = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
  report.after = out.length;
  return { bytes: out, report };
}

/**
 * Fonturile și obiectele (poze, forme) trecute în resursele paginilor, dar la care conținutul paginilor nu ajunge niciodată
 * (unele programe pun toate fonturile documentului pe fiecare pagină). O listă de resurse folosită de mai multe pagini se
 * curăță doar de ce nu folosește niciuna; dacă o pagină nu se poate citi sau desenează o formă care împrumută resursele
 * paginii, lista ei rămâne neatinsă. Ce rămâne fără nicio trimitere pleacă apoi cu dropUnreachable.
 */
function dropUnusedResources(doc: PDFDocument) {
  const used = new Map<PDFDict, Set<string> | null>();
  for (const [i, page] of doc.getPages().entries()) {
    const res = page.node.Resources();
    if (!res) continue;
    let names: Set<string> | null = new Set();
    try {
      const src = pageContent(doc, i);
      if (src === null) names = null;
      else for (const t of tokens(src)) if (t.k === 'name') names.add(t.v);
    } catch { names = null; }
    // O formă fără resurse proprii folosește resursele paginii: nu știm ce nume cere.
    const xo = res.lookupMaybe(N('XObject'), PDFDict);
    if (names && xo) for (const n of names) {
      const x = xo.lookup(N(n));
      if (x instanceof PDFRawStream && x.dict.get(N('Subtype')) === N('Form') && !x.dict.has(N('Resources'))) { names = null; break; }
    }
    // La fel un font desenat (Type3) fără resurse proprii.
    const fo = res.lookupMaybe(N('Font'), PDFDict);
    if (names && fo) for (const n of names) {
      const f = fo.lookup(N(n));
      if (f instanceof PDFDict && f.get(N('Subtype')) === N('Type3') && !f.has(N('Resources'))) { names = null; break; }
    }
    const prev = used.get(res);
    if (prev === null) continue;
    if (!names) used.set(res, null);
    else used.set(res, prev ? new Set([...prev, ...names]) : names);
  }
  for (const [res, names] of used) {
    if (!names) continue;
    for (const kind of ['Font', 'XObject']) {
      const d = res.lookupMaybe(N(kind), PDFDict);
      if (!d) continue;
      for (const k of d.keys()) if (!names.has(k.asString().slice(1))) d.delete(k);
    }
  }
}
