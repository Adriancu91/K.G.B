// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Notele 🗒 de pe poză în .psd: blocul „Anno” de la finalul secțiunii straturi (Photoshop 6+). Fiecare notă are felul
// („txtA” = text), dreptunghiul iconiței și al ferestrei ei, culoarea, autorul, numele, data și textul (UTF-16 cu FE FF).
// Doar octeți: notele din editor (x, y = colțul iconiței) se transformă aici în / din bloc.

export interface PsdNote { x: number; y: number; text: string; author?: string; color?: string }

/** Cel mult atâtea note citite dintr-un fișier (un bloc stricat nu umple ecranul). */
const MAX_NOTES = 500;

/** Șir Pascal (un octet lungimea), în octeți simpli: fără diacritice (ă → a), restul „_”. Completat la număr par. */
function pascal(s: string): number[] {
  let o = '';
  for (const ch of s.normalize('NFD')) {
    const c = ch.charCodeAt(0);
    if (c >= 0x300 && c <= 0x36f) continue;
    o += c >= 32 && c < 127 ? ch : '_';
  }
  const b = [...o.slice(0, 255)].map((c) => c.charCodeAt(0));
  const out = [b.length, ...b];
  if (out.length % 2) out.push(0);
  return out;
}

const u16 = (x: number) => [(x >> 8) & 255, x & 255];
const u32 = (x: number) => { x >>>= 0; return [x >>> 24, (x >>> 16) & 255, (x >>> 8) & 255, x & 255]; };
const i32 = (x: number) => u32(Math.round(x) | 0);

/** #rrggbb → [r, g, b] (0–255); altfel galbenul notelor. */
function rgbOf(c: string | undefined): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(c ?? '');
  if (!m) return [255, 230, 128];
  const v = parseInt(m[1], 16);
  return [v >> 16, (v >> 8) & 255, v & 255];
}
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

/** Data notei în felul din fișiere: D:AAAALLZZOOMMSS. */
function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Corpul blocului „Anno” (fără „8BIM”, cheie și lungime). */
export function encodeAnno(notes: PsdNote[], now = new Date()): Uint8Array {
  const out: number[] = [...u16(2), ...u16(1), ...u32(notes.length)];
  for (const n of notes) {
    // Rândurile noi sunt CR în fișier.
    const t = n.text.replace(/\r\n?|\n/g, '\r');
    const data = [0xfe, 0xff];
    for (let i = 0; i < t.length; i++) data.push(...u16(t.charCodeAt(i)));
    const [r, g, b] = rgbOf(n.color);
    const body = [
      ...[...'txtA'].map((c) => c.charCodeAt(0)),
      0, // fereastra notei închisă
      0x1c, // steaguri (ca în fișierele salvate de programul de origine)
      ...u16(0),
      ...i32(n.y), ...i32(n.x), ...i32(n.y + 24), ...i32(n.x + 24),
      ...i32(n.y), ...i32(n.x + 30), ...i32(n.y + 160), ...i32(n.x + 270),
      ...u16(0), ...u16(r * 257), ...u16(g * 257), ...u16(b * 257), ...u16(0),
      ...pascal(n.author ?? ''),
      ...pascal(''),
      ...pascal(stamp(now)),
      ...u32(12 + data.length),
      ...[...'txtC'].map((c) => c.charCodeAt(0)),
      ...u32(data.length),
      ...data,
    ];
    while ((body.length + 4) % 4) body.push(0);
    out.push(...u32(body.length + 4), ...body);
  }
  return Uint8Array.from(out);
}

/** Notele text din corpul unui bloc „Anno” (cele cu sunet se sar). Un bloc stricat dă notele citite până acolo. */
export function decodeAnno(b: Uint8Array, width = Infinity, height = Infinity): PsdNote[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const notes: PsdNote[] = [];
  if (b.length < 8) return notes;
  const count = v.getUint32(4);
  let p = 8;
  for (let k = 0; k < count && notes.length < MAX_NOTES && p + 4 <= b.length; k++) {
    const len = v.getUint32(p);
    const end = p + len;
    if (len < 48 || end > b.length) break;
    try {
      let q = p + 4;
      const kind = String.fromCharCode(b[q], b[q + 1], b[q + 2], b[q + 3]);
      q += 8;
      const top = v.getInt32(q), left = v.getInt32(q + 4);
      q += 32;
      const space = v.getUint16(q);
      const color = space === 0 ? hex(b[q + 2], b[q + 4], b[q + 6]) : undefined;
      q += 10;
      const str = () => {
        const n = b[q];
        let s = '';
        for (let i = 1; i <= n && q + i < end; i++) s += String.fromCharCode(b[q + i]);
        q += 1 + n + ((1 + n) % 2);
        return s;
      };
      const author = str();
      str(); // numele
      str(); // data
      q += 4;
      const marker = String.fromCharCode(b[q], b[q + 1], b[q + 2], b[q + 3]);
      const dl = v.getUint32(q + 4);
      q += 8;
      if (kind === 'txtA' && marker === 'txtC' && q + dl <= end) {
        const d = b.subarray(q, q + dl);
        let text = '';
        if (d[0] === 0xfe && d[1] === 0xff) for (let i = 2; i + 1 < d.length; i += 2) text += String.fromCharCode((d[i] << 8) | d[i + 1]);
        else for (const c of d) text += String.fromCharCode(c);
        text = text.replace(/\0+$/, '').replace(/\r\n?/g, '\n');
        // Nota pusă în afara pozei se aduce la marginea ei, ca să se poată vedea și deschide.
        const x = Math.max(0, Math.min(left, width - 1)), y = Math.max(0, Math.min(top, height - 1));
        notes.push({ x, y, text, ...(author ? { author } : {}), ...(color ? { color } : {}) });
      }
    } catch { break; }
    p = end;
  }
  return notes;
}
