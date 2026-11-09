// Original: src/pdf/redactKeep.ts.
// @ts-nocheck — copiat din Cyber Office Studio, aplicația proprietarului (D-071, D-072), fără schimbări de logică;
//   K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine.
//   Testat în tests/redact-keep.test.mjs.
// Redactarea care păstrează pagina ca text: literele care cad în zonele redactate se scot din conținutul paginii (fiecare
// înlocuită cu un spațiu gol de aceeași lățime, ca restul rândului să rămână pe loc), iar restul paginii rămâne text adevărat,
// care se caută, se copiază și se tipărește clar. Peste zone se pune apoi dreptunghiul colorat (în redact.ts).
// Când nu e sigur că sub zonă nu mai rămâne nimic (o imagine sau o formă încorporată atinge zona, un desen e tot în zonă,
// litere cu lățimi necunoscute lângă zonă), funcția spune „nu” și pagina se face imagine, ca înainte. Comentariile și câmpurile
// de formular peste zone se scot întâi cu dropAnnotsIn.
// Testat în tests/pdf-redact-keep.test.mjs.
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFObject, PDFRef, PDFStream } from 'pdf-lib';
import { apply, type Box, fontInfo, type FontInfo, ID, type M, mul, pageContent, tokens, type Tok } from './textRemove';

const fmt = (v: number) => String(Math.round(v * 1000) / 1000);
const hex = (b: number[]) => '<' + b.map((x) => x.toString(16).padStart(2, '0')).join('') + '>';

const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const within = (a: Box, b: Box) => a[0] >= b[0] - 0.5 && a[2] <= b[2] + 0.5 && a[1] >= b[1] - 0.5 && a[3] <= b[3] + 0.5;
const bounds = (pts: [number, number][]): Box => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const norm = (b: Box): Box => [Math.min(b[0], b[2]), Math.min(b[1], b[3]), Math.max(b[0], b[2]), Math.max(b[1], b[3])];

/** Scoate din formular câmpurile ale căror casete s-au scos (altfel valorile, de ex. CNP-ul, ar rămâne în fișier). */
export function dropFields(doc: PDFDocument, gone: Set<string>) {
  const acro = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  const fields = acro?.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (!fields || !gone.size) return;
  const prune = (arr: PDFArray) => {
    for (let i = arr.size() - 1; i >= 0; i--) {
      const r = arr.get(i);
      if (r instanceof PDFRef && gone.has(r.toString())) { arr.remove(i); continue; }
      const f = doc.context.lookup(r);
      const kids = f instanceof PDFDict ? f.lookupMaybe(PDFName.of('Kids'), PDFArray) : undefined;
      if (kids) {
        prune(kids);
        if (kids.size() === 0) arr.remove(i);
      }
    }
  };
  prune(fields);
}

/**
 * Scoate de pe pagină adnotările (comentarii, câmpuri de formular cu valorile lor, legături) care ating zonele, plus
 * ferestrele lor de comentariu. Întoarce câte s-au scos sau null (fără nicio schimbare) dacă o casetă atinsă e a unui câmp
 * care are și alte casete: valoarea lui e comună și ar rămâne în fișier, deci atunci pagina se face imagine.
 */
export function dropAnnotsIn(doc: PDFDocument, pageIndex: number, zones: Box[]): number | null {
  const boxes = zones.map(norm);
  const node = doc.getPage(pageIndex).node;
  const annots = node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) return 0;
  const dict = (r: unknown) => { const a = r instanceof PDFRef ? doc.context.lookup(r) : r; return a instanceof PDFDict ? a : undefined; };
  const gone = new Set<number>();
  const goneRefs = new Set<string>();
  annots.asArray().forEach((r, i) => {
    const rect = dict(r)?.lookupMaybe(PDFName.of('Rect'), PDFArray);
    if (!rect || rect.size() !== 4) return;
    const v = rect.asArray().map((x) => (x instanceof PDFNumber ? x.asNumber() : 0));
    const b = norm([v[0], v[1], v[2], v[3]]);
    if (boxes.some((z) => overlaps(b, z))) { gone.add(i); if (r instanceof PDFRef) goneRefs.add(r.toString()); }
  });
  if (!gone.size) return 0;
  for (const i of gone) {
    const parent = dict(dict(annots.get(i))?.get(PDFName.of('Parent')));
    const kids = parent?.lookupMaybe(PDFName.of('Kids'), PDFArray);
    if (kids && kids.size() > 1 && String(dict(annots.get(i))?.get(PDFName.of('Subtype'))) === '/Widget') return null;
  }
  // Ferestrele de comentariu (Popup) ale adnotărilor scoase pleacă și ele (altfel ar ține adnotarea în fișier prin /Parent).
  annots.asArray().forEach((r, i) => {
    const p = dict(r)?.get(PDFName.of('Parent'));
    if (p instanceof PDFRef && goneRefs.has(p.toString()) && String(dict(r)?.get(PDFName.of('Subtype'))) === '/Popup') {
      gone.add(i);
      if (r instanceof PDFRef) goneRefs.add(r.toString());
    }
  });
  for (const i of [...gone].sort((a, b) => b - a)) annots.remove(i);
  dropFields(doc, goneRefs);
  return gone.size;
}

/**
 * Scoate din pagina `pageIndex` (de la 0) literele care cad în zonele `zones` (coordonatele PDF ale paginii).
 * Întoarce câte litere s-au scos sau null dacă pagina nu se poate redacta sigur așa (atunci nu schimbă nimic).
 */
export function redactKeepText(doc: PDFDocument, pageIndex: number, zones: Box[]): number | null {
  const boxes = zones.map(norm);
  const src = pageContent(doc, pageIndex);
  if (src === null || !boxes.length) return null;
  const page = doc.getPage(pageIndex);
  const hits = (b: Box) => boxes.some((z) => overlaps(b, z));
  const inside = (x: number, y: number) => boxes.some((z) => x >= z[0] && x <= z[2] && y >= z[1] && y <= z[3]);

  // Adnotările (comentarii, câmpuri de formular cu valori) rămase peste zone: pagina se face imagine (dropAnnotsIn le scoate întâi).
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  for (const r of annots?.asArray() ?? []) {
    const a = r instanceof PDFRef ? doc.context.lookup(r) : r;
    const rect = a instanceof PDFDict ? a.lookupMaybe(PDFName.of('Rect'), PDFArray) : undefined;
    if (!rect || rect.size() !== 4) continue;
    const v = rect.asArray().map((x) => (x instanceof PDFNumber ? x.asNumber() : 0));
    if (hits(norm([v[0], v[1], v[2], v[3]]))) return null;
  }

  const res = page.node.Resources();
  const fontsDict = res?.lookup(PDFName.of('Font'));
  const xo = res?.lookup(PDFName.of('XObject'));
  const fonts = new Map<string, FontInfo>();
  const font = (name: string): FontInfo => {
    let f = fonts.get(name);
    if (!f) {
      const d = fontsDict instanceof PDFDict ? fontsDict.lookup(PDFName.of(name)) : undefined;
      f = fontInfo(doc, d instanceof PDFDict ? d : undefined);
      fonts.set(name, f);
    }
    return f;
  };
  /** Dreptunghiul unei imagini (pătratul 0–1) sau al unei forme încorporate (BBox prin Matrix), pe pagină. */
  const xobjBox = (name: string, ctm: M): Box => {
    const raw = xo instanceof PDFDict ? xo.get(PDFName.of(name)) : undefined;
    const obj = raw instanceof PDFRef ? doc.context.lookup(raw) : raw;
    const dict = obj && 'dict' in (obj as object) ? (obj as unknown as { dict: PDFDict }).dict : undefined;
    let m = ctm;
    let bb: Box = [0, 0, 1, 1];
    if (String(dict?.get(PDFName.of('Subtype')) ?? '') === '/Form') {
      const b = dict?.lookupMaybe(PDFName.of('BBox'), PDFArray);
      const mm = dict?.lookupMaybe(PDFName.of('Matrix'), PDFArray);
      const nums = (a: PDFArray) => a.asArray().map((x) => (x instanceof PDFNumber ? x.asNumber() : 0));
      if (b?.size() === 4) { const v = nums(b); bb = [v[0], v[1], v[2], v[3]]; }
      if (mm?.size() === 6) m = mul(nums(mm) as M, ctm);
    }
    return bounds([[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]].map(([x, y]) => apply(m, x, y)));
  };

  interface GS { ctm: M; tc: number; tw: number; th: number; tl: number; font: string; size: number; rise: number }
  let gs: GS = { ctm: ID, tc: 0, tw: 0, th: 1, tl: 0, font: '', size: 0, rise: 0 };
  const stack: GS[] = [];
  let tm: M = ID, tlm: M = ID;
  const edits: { s: number; e: number; text: string }[] = [];
  let ops: Tok[] = [];
  let removed = 0;
  let unsafe = false;
  let path: [number, number][] = [];

  /** O bucată de text, literă cu literă: literele din zonă se înlocuiesc cu un spațiu gol cât lățimea lor. */
  const show = (items: Tok[], s: number, e: number, prefix: string) => {
    const f = font(gs.font);
    const trm = mul(tm, gs.ctm);
    const k = gs.size * gs.th;
    const out: string[] = [];
    let cur: number[] = [];
    let adv = 0, gone = 0;
    const flush = () => { if (cur.length) { out.push(hex(cur)); cur = []; } };
    const step = f.two ? 2 : 1;
    for (const it of items) {
      if (it.k === 'num') { flush(); out.push(fmt(it.v)); adv += (-it.v / 1000) * k; continue; }
      if (it.k !== 'str') continue;
      for (let j = 0; j + step - 1 < it.v.length; j += step) {
        const c = f.two ? (it.v[j] << 8) | it.v[j + 1] : it.v[j];
        const gw = (f.width(c) / 1000) * gs.size;
        const w = (gw + gs.tc + (f.spaceOk && !f.two && c === 32 ? gs.tw : 0)) * gs.th;
        if (f.known === false) {
          // Fără lățimi nu știm unde e litera: dacă rândul poate atinge o zonă, nu riscăm.
          const by = apply(trm, 0, gs.rise)[1];
          const reach = Math.abs(gs.size) * 2 + 2;
          if (boxes.some((z) => by >= z[1] - reach && by <= z[3] + reach)) unsafe = true;
        }
        // Se scoate și o literă aflată cam o treime în zonă (zonele trase de mână sau găsite automat nu sunt exacte).
        const mid = gs.rise + gs.size * 0.35;
        if (k && [0.35, 0.5, 0.65].some((u) => inside(...apply(trm, adv + gw * gs.th * u, mid)))) {
          flush();
          out.push(fmt((-w / k) * 1000));
          gone++;
        } else for (let q = 0; q < step; q++) cur.push(it.v[j + q]);
        adv += w;
      }
    }
    flush();
    if (gone) {
      edits.push({ s, e, text: `${prefix}[${out.join(' ')}] TJ` });
      removed += gone;
    }
    tm = mul([1, 0, 0, 1, adv, 0], tm);
  };
  const num = (t: Tok | undefined) => (t && t.k === 'num' ? t.v : 0);

  for (const t of tokens(src)) {
    if (t.k !== 'op') { ops.push(t); continue; }
    const a = ops;
    ops = [];
    const s = a.length ? a[0].s : t.s;
    switch (t.v) {
      case 'q': stack.push({ ...gs }); break;
      case 'Q': gs = stack.pop() ?? gs; break;
      case 'cm': if (a.length >= 6) gs = { ...gs, ctm: mul(a.slice(-6).map(num) as M, gs.ctm) }; break;
      case 'BT': tm = ID; tlm = ID; break;
      case 'Tf': gs = { ...gs, font: a[a.length - 2]?.k === 'name' ? (a[a.length - 2] as { v: string }).v : gs.font, size: num(a[a.length - 1]) }; break;
      case 'Tc': gs = { ...gs, tc: num(a[0]) }; break;
      case 'Tw': gs = { ...gs, tw: num(a[0]) }; break;
      case 'Tz': gs = { ...gs, th: num(a[0]) / 100 }; break;
      case 'TL': gs = { ...gs, tl: num(a[0]) }; break;
      case 'Ts': gs = { ...gs, rise: num(a[0]) }; break;
      case 'Td': tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], tlm); tm = tlm; break;
      case 'TD': gs = { ...gs, tl: -num(a[1]) }; tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], tlm); tm = tlm; break;
      case 'Tm': if (a.length >= 6) { tlm = a.slice(-6).map(num) as M; tm = tlm; } break;
      case 'T*': tlm = mul([1, 0, 0, 1, 0, -gs.tl], tlm); tm = tlm; break;
      case 'Tj': show(a.filter((x) => x.k === 'str'), s, t.e, ''); break;
      case 'TJ': { const arr = a.find((x) => x.k === 'arr'); show(arr && arr.k === 'arr' ? arr.v : [], s, t.e, ''); break; }
      case "'": tlm = mul([1, 0, 0, 1, 0, -gs.tl], tlm); tm = tlm; show(a.filter((x) => x.k === 'str'), s, t.e, 'T* '); break;
      case '"': {
        gs = { ...gs, tw: num(a[0]), tc: num(a[1]) };
        tlm = mul([1, 0, 0, 1, 0, -gs.tl], tlm); tm = tlm;
        show(a.filter((x) => x.k === 'str'), s, t.e, `${fmt(gs.tw)} Tw ${fmt(gs.tc)} Tc T* `);
        break;
      }
      // Imaginile și formele încorporate care ating o zonă nu se pot tăia aici.
      case 'Do': { const nm = a[a.length - 1]; if (nm?.k === 'name' && hits(xobjBox(nm.v, gs.ctm))) unsafe = true; break; }
      case 'BI': if (hits(bounds([[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => apply(gs.ctm, x, y))))) unsafe = true; break;
      // Desenele: unul aflat tot într-o zonă (de ex. o semnătură desenată) ar rămâne sub dreptunghi, deci pagina se face imagine.
      case 'm': case 'l': path.push(apply(gs.ctm, num(a[a.length - 2]), num(a[a.length - 1]))); break;
      case 'c': for (let j = 0; j < 3; j++) path.push(apply(gs.ctm, num(a[j * 2]), num(a[j * 2 + 1]))); break;
      case 'v': case 'y': for (let j = 0; j < 2; j++) path.push(apply(gs.ctm, num(a[j * 2]), num(a[j * 2 + 1]))); break;
      case 're': {
        const [x, y, w, h] = [num(a[0]), num(a[1]), num(a[2]), num(a[3])];
        path.push(apply(gs.ctm, x, y), apply(gs.ctm, x + w, y), apply(gs.ctm, x, y + h), apply(gs.ctm, x + w, y + h));
        break;
      }
      case 'S': case 's': case 'f': case 'F': case 'f*': case 'B': case 'B*': case 'b': case 'b*':
        if (path.length) { const pb = bounds(path); if (boxes.some((z) => within(pb, z))) unsafe = true; }
        path = [];
        break;
      case 'n': path = []; break;
      default: break;
    }
    if (unsafe) return null;
  }
  if (!edits.length) return 0;
  let out = '';
  let at = 0;
  for (const ed of edits.sort((x, y) => x.s - y.s)) { out += src.slice(at, ed.s) + ed.text; at = ed.e; }
  out += src.slice(at);
  const bytes = new Uint8Array(out.length);
  for (let j = 0; j < out.length; j++) bytes[j] = out.charCodeAt(j) & 255;
  page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.flateStream(bytes)));
  return removed;
}

/** Șterge din fișier obiectele la care nu mai duce nimic (conținutul vechi al paginilor redactate). */
export function dropUnreachable(doc: PDFDocument) {
  const ctx = doc.context;
  const seen = new Set<string>();
  const t = ctx.trailerInfo;
  const stack: PDFObject[] = [t.Root, t.Info, t.Encrypt, t.ID].filter((o): o is PDFObject => !!o);
  while (stack.length) {
    const o = stack.pop()!;
    if (o instanceof PDFRef) {
      const k = o.toString();
      if (seen.has(k)) continue;
      seen.add(k);
      const v = ctx.lookup(o);
      if (v) stack.push(v);
    } else if (o instanceof PDFDict) {
      for (const [, v] of o.entries()) stack.push(v);
    } else if (o instanceof PDFArray) {
      stack.push(...o.asArray());
    } else if (o instanceof PDFStream) {
      stack.push(o.dict);
    }
  }
  for (const [ref] of ctx.enumerateIndirectObjects()) if (!seen.has(ref.toString())) ctx.delete(ref);
}
