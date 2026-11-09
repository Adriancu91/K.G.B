// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Traseele salvate din .psd (panoul Paths): resursele 2000–2997, câte una pe traseu, cu numele traseului. Fiecare e o listă
// de înregistrări de 26 de octeți: regula de umplere, apoi pentru fiecare bucată de traseu numărul de puncte și punctele
// (mânerul de intrare, ancora, mânerul de ieșire, fiecare ca (y, x) cu virgulă fixă 8.24, ca parte din înălțimea / lățimea pozei).
// Le citim în lista Trasee a uneltei ✒ Traseu și le scriem înapoi la salvarea ca .psd.
import { Anchor, inH, outH } from './pen';

export interface PsdPath { name: string; a: Anchor[]; closed: boolean }

/** Cel mult atâtea trasee citim dintr-un fișier, cu cel mult atâtea puncte în total pe traseu. */
const MAX_PATHS = 64, MAX_KNOTS = 5000;

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

// Numele traseului e în codarea Windows a calculatorului care l-a salvat; pentru română, cea central-europeană (1250), în care
// ș și ț sunt cu sedilă. La citire le punem înapoi cu virgulă; un nume care nu se poate citi (alt alfabet) devine „Traseul N”.
const RO_OUT: Record<string, number> = { ă: 0xe3, Ă: 0xc3, â: 0xe2, Â: 0xc2, î: 0xee, Î: 0xce, ș: 0xba, ş: 0xba, Ș: 0xaa, Ş: 0xaa, ț: 0xfe, ţ: 0xfe, Ț: 0xde, Ţ: 0xde };

/** Numele traseului ca octeți (cel mult 255): ASCII și diacriticele românești; restul literelor fără semne, altfel „_”. */
export function pathNameBytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    if (out.length >= 255) break;
    const c = ch.charCodeAt(0);
    if (c >= 32 && c < 127) { out.push(c); continue; }
    if (RO_OUT[ch]) { out.push(RO_OUT[ch]); continue; }
    const base = ch.normalize('NFD').charCodeAt(0);
    out.push(base >= 32 && base < 127 ? base : 0x5f);
  }
  return out;
}

/** Octeții numelui → text (null dacă nu e un nume de citit). */
export function pathNameText(b: Uint8Array): string | null {
  let t = '';
  try { t = new TextDecoder('windows-1250', { fatal: true }).decode(b); } catch { return null; }
  if (/[\u0000-\u001f\u007f-\u009f�]/.test(t)) return null;
  return t.replace(/ş/g, 'ș').replace(/Ş/g, 'Ș').replace(/ţ/g, 'ț').replace(/Ţ/g, 'Ț').trim() || null;
}

/** Punctul din fișier ca ancoră de-a noastră: fără mânere = colț; mânerul de intrare se ține doar când nu e oglinda celui de ieșire. */
function anchorOf(pin: [number, number], p: [number, number], pout: [number, number]): Anchor {
  const x = p[0], y = p[1];
  const hasOut = !near(pout[0], x) || !near(pout[1], y), hasIn = !near(pin[0], x) || !near(pin[1], y);
  if (!hasOut && !hasIn) return { x, y };
  const a: Anchor = { x, y, hx: pout[0], hy: pout[1] };
  if (!near(pin[0], 2 * x - pout[0]) || !near(pin[1], 2 * y - pout[1])) { a.ix = pin[0]; a.iy = pin[1]; }
  return a;
}

/** Înregistrările unui traseu (datele resursei) → bucățile lui, în pixeli. Bucățile cu sub 2 puncte se sar. */
export function readPathRecords(b: Uint8Array, w: number, h: number): { a: Anchor[]; closed: boolean }[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const fx = (p: number) => v.getInt32(p) / 16777216;
  const out: { a: Anchor[]; closed: boolean }[] = [];
  let cur: Anchor[] = [], left = 0, closed = true, total = 0;
  const flush = () => { if (cur.length >= 2) out.push({ a: cur, closed }); cur = []; };
  for (let p = 0; p + 26 <= b.length; p += 26) {
    const sel = v.getUint16(p);
    if (sel === 0 || sel === 3) { flush(); left = v.getUint16(p + 2); closed = sel === 0; continue; }
    if ((sel === 1 || sel === 2 || sel === 4 || sel === 5) && left > 0 && total < MAX_KNOTS) {
      const pt = (o: number): [number, number] => [fx(p + o + 4) * w, fx(p + o) * h];
      cur.push(anchorOf(pt(2), pt(10), pt(18)));
      total++;
      if (--left === 0) flush();
    }
  }
  flush();
  return out;
}

/** Traseele din resursele pozei (de la s la e). Un traseu cu mai multe bucăți devine mai multe trasee („Nume”, „Nume 2”…). */
export function readPathResources(b: Uint8Array, s: number, e: number, w: number, h: number): PsdPath[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: PsdPath[] = [];
  let p = s;
  while (p + 12 <= e && out.length < MAX_PATHS && b[p] === 0x38 && b[p + 1] === 0x42 && b[p + 2] === 0x49 && b[p + 3] === 0x4d) {
    const id = v.getUint16(p + 4), nl = b[p + 6];
    const name = pathNameText(b.subarray(p + 7, Math.min(e, p + 7 + nl))) ?? '';
    let q = p + 7 + nl;
    if ((1 + nl) % 2) q++;
    if (q + 4 > e) break;
    const len = v.getUint32(q), ds = q + 4, de = Math.min(e, ds + len);
    if (id >= 2000 && id <= 2997) {
      const subs = readPathRecords(b.subarray(ds, de), w, h);
      const base = name || `Traseul ${out.length + 1}`;
      subs.forEach((sp, i) => { if (out.length < MAX_PATHS) out.push({ name: i ? `${base} ${i + 1}` : base, ...sp }); });
    }
    p = ds + len + (len % 2);
  }
  return out;
}

/** Datele resursei pentru un traseu: regula de umplere, umplerea de pornire, apoi o bucată (închisă sau deschisă) cu punctele. */
export function pathRecords(path: { a: Anchor[]; closed: boolean }, w: number, h: number): Uint8Array {
  const n = path.a.length;
  const out = new Uint8Array(26 * (3 + n));
  const v = new DataView(out.buffer);
  v.setUint16(0, 6);
  v.setUint16(26, 8);
  const closed = path.closed && n > 2;
  v.setUint16(52, closed ? 0 : 3);
  v.setUint16(54, n);
  const fix = (x: number) => Math.round(Math.max(-127, Math.min(127, x)) * 16777216);
  path.a.forEach((p, i) => {
    const o = 78 + i * 26, ih = inH(p), oh = outH(p);
    // Legat (mânerele în linie, ca la un punct rotunjit) sau nelegat (colț, ori mânere rupte).
    const linked = p.hx !== undefined && p.ix === undefined;
    v.setUint16(o, closed ? (linked ? 1 : 2) : (linked ? 4 : 5));
    [ih, [p.x, p.y], oh].forEach(([x, y], k) => { v.setInt32(o + 2 + k * 8, fix(y / h)); v.setInt32(o + 6 + k * 8, fix(x / w)); });
  });
  return out;
}
