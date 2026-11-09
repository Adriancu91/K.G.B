// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Parola la protejarea foii: în .xlsx se păstrează doar un hash (nu parola), ca să nu poată fi citită din fișier.
// Felul nou: SHA-512 cu sare și 100.000 de repetări; felul vechi (fișiere din 1997–2007): un cod de 4 cifre hexa.

/** Hash-ul parolei unei foi, cum se scrie în <sheetProtection>. Fără `alg` = felul vechi (`hash` = 4 cifre hexa). */
export type SheetPw = { alg?: string; hash: string; salt?: string; spin?: number };

const ALGS: Record<string, string> = { 'SHA-512': 'SHA-512', 'SHA-384': 'SHA-384', 'SHA-256': 'SHA-256', 'SHA-1': 'SHA-1' };

const utf16 = (pw: string) => {
  const out = new Uint8Array(pw.length * 2);
  for (let i = 0; i < pw.length; i++) { const c = pw.charCodeAt(i); out[2 * i] = c & 255; out[2 * i + 1] = c >> 8; }
  return out;
};
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Codul vechi de 16 biți (atributul `password`), de exemplu „password” → 83AF. */
export function legacyHash(pw: string): string {
  let h = 0;
  for (let i = pw.length - 1; i >= 0; i--) { h = ((h >> 14) & 1) | ((h << 1) & 0x7fff); h ^= pw.charCodeAt(i) & 0xff; }
  h = ((h >> 14) & 1) | ((h << 1) & 0x7fff);
  h ^= pw.length;
  h ^= 0xce4b;
  return h.toString(16).toUpperCase().padStart(4, '0');
}

/** H0 = hash(sare + parolă), apoi Hi = hash(H(i-1) + i), cu i pe 4 octeți (little-endian). */
async function spinHash(alg: string, salt: Uint8Array, pw: string, count: number): Promise<Uint8Array> {
  const sub = globalThis.crypto.subtle;
  const first = new Uint8Array(salt.length + pw.length * 2);
  first.set(salt); first.set(utf16(pw), salt.length);
  let h = new Uint8Array(await sub.digest(alg, first));
  const buf = new Uint8Array(h.length + 4);
  for (let i = 0; i < count; i++) {
    buf.set(h, 0);
    buf[h.length] = i & 255; buf[h.length + 1] = (i >>> 8) & 255; buf[h.length + 2] = (i >>> 16) & 255; buf[h.length + 3] = (i >>> 24) & 255;
    h = new Uint8Array(await sub.digest(alg, buf));
  }
  return h;
}

/** Hash-ul nou pentru o parolă (sare nouă la fiecare protejare). */
export async function makeSheetPw(pw: string, spin = 100000, salt?: Uint8Array): Promise<SheetPw> {
  const s = salt ?? globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { alg: 'SHA-512', hash: toB64(await spinHash('SHA-512', s, pw, spin)), salt: toB64(s), spin };
}

/** Parola se potrivește cu hash-ul din foaie? */
export async function checkSheetPw(pw: string, p: SheetPw): Promise<boolean> {
  if (!p.alg) return legacyHash(pw) === p.hash.toUpperCase().padStart(4, '0');
  const alg = ALGS[p.alg.toUpperCase().replace(/^SHA(\d)/, 'SHA-$1')];
  if (!alg || !p.salt) return false;
  try { return toB64(await spinHash(alg, fromB64(p.salt), pw, p.spin ?? 0)) === p.hash; } catch { return false; }
}

/** Atributele din <sheetProtection> (citire). */
export function sheetPwFrom(a: Record<string, string> | undefined): SheetPw | undefined {
  if (!a) return undefined;
  if (a.hashValue && a.saltValue && a.algorithmName) {
    const spin = Number(a.spinCount);
    return { alg: a.algorithmName, hash: a.hashValue, salt: a.saltValue, spin: Number.isFinite(spin) && spin >= 0 && spin <= 10000000 ? spin : 0 };
  }
  if (a.password && /^[0-9a-f]{1,4}$/i.test(a.password)) return { hash: a.password.toUpperCase().padStart(4, '0') };
  return undefined;
}

/** Atributele de scris în <sheetProtection> (cu spațiu în față), sau ''. */
export const sheetPwAttrs = (p: SheetPw | undefined, esc: (s: string) => string = (s) => s) => !p ? ''
  : p.alg ? ` algorithmName="${esc(p.alg)}" hashValue="${esc(p.hash)}" saltValue="${esc(p.salt ?? '')}" spinCount="${p.spin ?? 0}"`
  : ` password="${esc(p.hash)}"`;

/** Curăță valoarea citită dintr-un fișier Suite. */
export function cleanSheetPw(v: unknown): SheetPw | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.hash !== 'string' || !o.hash) return undefined;
  if (typeof o.alg !== 'string') return /^[0-9A-F]{4}$/.test(o.hash) ? { hash: o.hash } : undefined;
  if (typeof o.salt !== 'string') return undefined;
  const spin = typeof o.spin === 'number' && o.spin >= 0 && o.spin <= 10000000 ? Math.floor(o.spin) : 0;
  return { alg: o.alg, hash: o.hash, salt: o.salt, spin };
}

/** <workbookProtection lockStructure="1" …>: structura registrului e blocată (cu parola, dacă are). */
export function bookLockFrom(a: Record<string, string> | undefined): { pw?: SheetPw } | undefined {
  if (!a || !/^(1|true)$/i.test(a.lockStructure ?? '')) return undefined;
  const pw = sheetPwFrom({ algorithmName: a.workbookAlgorithmName, hashValue: a.workbookHashValue, saltValue: a.workbookSaltValue, spinCount: a.workbookSpinCount, password: a.workbookPassword });
  return pw ? { pw } : {};
}

/** Elementul <workbookProtection> de scris, sau ''. */
export const bookLockXml = (lock: { pw?: SheetPw } | undefined, esc: (s: string) => string = (s) => s) => !lock ? ''
  : `<workbookProtection${sheetPwAttrs(lock.pw, esc).replace(/ (algorithmName|hashValue|saltValue|spinCount)=/g, (_m, k: string) => ` workbook${k[0].toUpperCase()}${k.slice(1)}=`).replace(' password=', ' workbookPassword=')} lockStructure="1"/>`;

/** Curăță valoarea din fișierul Suite. */
export function cleanBookLock(v: unknown): { pw?: SheetPw } | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const pw = cleanSheetPw((v as Record<string, unknown>).pw);
  return pw ? { pw } : {};
}
