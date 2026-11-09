// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fișierele .docx / .xlsx / .pptx protejate cu parolă: le deschidem cu parola dată de utilizator.
// Un astfel de fișier e un container OLE (desfăcut cu CFB din SheetJS CE, Apache-2.0) cu două fluxuri: EncryptionInfo
// (cum e criptat) și EncryptedPackage (arhiva .docx criptată cu AES). Codul e scris de noi după specificația publică
// [MS-OFFCRYPTO]: criptarea „agilă” (Office 2010 și mai noi: AES + SHA-1 / SHA-256 / SHA-512, cheia din 100.000 de pași)
// și cea „standard” (Office 2007: AES-128 + SHA-1). Totul se face cu WebCrypto, din browser; parola nu se păstrează.

/** Eroarea pentru parola greșită (aplicația o mai cere o dată). */
export class WrongPassword extends Error {
  constructor() { super('Parola nu e bună.'); }
}

const subtle = () => globalThis.crypto.subtle;
const HASHES: Record<string, string> = { SHA1: 'SHA-1', 'SHA-1': 'SHA-1', SHA256: 'SHA-256', 'SHA-256': 'SHA-256', SHA384: 'SHA-384', 'SHA-384': 'SHA-384', SHA512: 'SHA-512', 'SHA-512': 'SHA-512' };
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const u32le = (n: number) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
function cat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
/** Parola în UTF-16 (litere mici întâi), cum o folosește formatul; cel mult 255 de caractere. */
function utf16(pw: string): Uint8Array {
  const s = pw.slice(0, 255), out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); out[2 * i] = c & 255; out[2 * i + 1] = c >> 8; }
  return out;
}
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function hash(alg: string, ...parts: Uint8Array[]): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest(alg, cat(...parts) as BufferSource));
}
/** Hash-ul parolei repetat de `count` ori (H = hash(i + H)), ca să fie greu de ghicit parola prin încercări. */
async function spin(alg: string, salt: Uint8Array, pw: string, count: number): Promise<Uint8Array> {
  let h = await hash(alg, salt, utf16(pw));
  const buf = new Uint8Array(4 + h.length);
  for (let i = 0; i < count; i++) {
    buf.set(u32le(i), 0); buf.set(h, 4);
    h = new Uint8Array(await subtle().digest(alg, buf));
  }
  return h;
}
/** Taie sau completează (cu 0x36, cum cere formatul) la `n` octeți. */
const fit = (b: Uint8Array, n: number) => (b.length >= n ? b.slice(0, n) : cat(b, new Uint8Array(n - b.length).fill(0x36)));

const aesKey = (key: Uint8Array) => subtle().importKey('raw', key as BufferSource, 'AES-CBC', false, ['encrypt', 'decrypt']);
/**
 * AES-CBC fără completare (datele au lungimea multiplu de 16). WebCrypto cere completare, așa că adăugăm la sfârșit blocul
 * care se decriptează exact în completarea așteptată (16 octeți de 0x10) și îl lăsăm deoparte.
 */
async function aesDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const n = data.length - (data.length % 16);
  if (!n) return new Uint8Array(0);
  const k = await aesKey(key);
  const last = data.subarray(n - 16, n);
  const pad = new Uint8Array(16).map((_, i) => 16 ^ last[i]);
  const extra = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, k, pad)).subarray(0, 16);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-CBC', iv: iv.slice(0, 16) as BufferSource }, k, cat(data.subarray(0, n), extra) as BufferSource));
}
/** AES-ECB (criptarea standard): decriptarea CBC cu IV zero, apoi fiecare bloc „desfăcut” de blocul criptat de dinaintea lui. */
async function aesDecryptEcb(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const out = await aesDecrypt(key, new Uint8Array(16), data);
  for (let i = out.length - 1; i >= 16; i--) out[i] ^= data[i - 16];
  return out;
}

/** Valoarea unui atribut din XML-ul EncryptionInfo (primul element `tag` care îl are). */
function attr(xml: string, tag: string, name: string): string {
  const el = new RegExp('<(?:[a-zA-Z]+:)?' + tag + '[ ][^>]*').exec(xml)?.[0] ?? '';
  return new RegExp('[ ]' + name + '="([^"]*)"').exec(el)?.[1] ?? '';
}

// Cheile blocurilor din specificație: fiecare parte a cheii se face din hash-ul parolei + alt bloc.
const VERIFIER_INPUT = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
const VERIFIER_VALUE = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);
const KEY_VALUE = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);
const SEGMENT = 4096;

/** Lungimea arhivei, scrisă pe 8 octeți la începutul fluxului EncryptedPackage. */
const packageSize = (pkg: Uint8Array) => u32(pkg, 0) + u32(pkg, 4) * 2 ** 32;

async function decryptAgile(info: Uint8Array, pkg: Uint8Array, pw: string): Promise<Uint8Array> {
  const xml = new TextDecoder().decode(info.subarray(8));
  if (!/keyEncryptor[/]password/.test(xml)) throw new Error('Fișierul e protejat cu un certificat, nu cu o parolă, și nu se poate deschide aici.');
  const alg = HASHES[attr(xml, 'encryptedKey', 'hashAlgorithm')], dataAlg = HASHES[attr(xml, 'keyData', 'hashAlgorithm')];
  if (!alg || !dataAlg || attr(xml, 'keyData', 'cipherAlgorithm') !== 'AES') throw new Error('Fișierul e criptat cu un algoritm pe care Cyber Office Studio nu-l cunoaște.');
  const spinCount = Math.min(10_000_000, Number(attr(xml, 'encryptedKey', 'spinCount')) || 100000);
  const keyBytes = (Number(attr(xml, 'encryptedKey', 'keyBits')) || 256) / 8;
  const salt = b64(attr(xml, 'encryptedKey', 'saltValue'));
  const h = await spin(alg, salt, pw, spinCount);
  const partKey = async (block: Uint8Array) => fit(await hash(alg, h, block), keyBytes);
  const input = (await aesDecrypt(await partKey(VERIFIER_INPUT), salt, b64(attr(xml, 'encryptedKey', 'encryptedVerifierHashInput')))).subarray(0, salt.length);
  const value = await aesDecrypt(await partKey(VERIFIER_VALUE), salt, b64(attr(xml, 'encryptedKey', 'encryptedVerifierHashValue')));
  const want = await hash(alg, input);
  if (!same(want, value.subarray(0, want.length))) throw new WrongPassword();
  const dataKeyBytes = (Number(attr(xml, 'keyData', 'keyBits')) || 256) / 8;
  const key = (await aesDecrypt(await partKey(KEY_VALUE), salt, b64(attr(xml, 'encryptedKey', 'encryptedKeyValue')))).subarray(0, dataKeyBytes);
  const dataSalt = b64(attr(xml, 'keyData', 'saltValue'));
  const blockSize = Number(attr(xml, 'keyData', 'blockSize')) || 16;
  const size = packageSize(pkg);
  const parts: Uint8Array[] = [];
  for (let i = 0, o = 8; o < pkg.length && i * SEGMENT < size; i++, o += SEGMENT) {
    const iv = fit(await hash(dataAlg, dataSalt, u32le(i)), blockSize);
    parts.push(await aesDecrypt(key, iv, pkg.subarray(o, Math.min(pkg.length, o + SEGMENT))));
  }
  return cat(...parts).subarray(0, size);
}

async function decryptStandard(info: Uint8Array, pkg: Uint8Array, pw: string): Promise<Uint8Array> {
  const headerSize = u32(info, 8);
  const head = info.subarray(12, 12 + headerSize);
  const algId = u32(head, 8), keyBits = u32(head, 16);
  // 0x660E / 0x660F / 0x6610 = AES-128 / 192 / 256; RC4 (0x6801, fișiere foarte vechi) nu.
  if (algId !== 0x660e && algId !== 0x660f && algId !== 0x6610) throw new Error('Fișierul e criptat cu un algoritm vechi pe care Cyber Office Studio nu-l cunoaște.');
  const v = info.subarray(12 + headerSize);
  const salt = v.subarray(4, 4 + u32(v, 0));
  const verifier = v.subarray(4 + salt.length, 20 + salt.length);
  const verifierHash = v.subarray(24 + salt.length, 56 + salt.length);
  const h = await spin('SHA-1', salt, pw, 50000);
  const final = await hash('SHA-1', h, u32le(0));
  const xor = (c: number) => { const b = new Uint8Array(64).fill(c); final.forEach((x, i) => { b[i] ^= x; }); return b; };
  const key = cat(await hash('SHA-1', xor(0x36)), await hash('SHA-1', xor(0x5c))).subarray(0, (keyBits || 128) / 8);
  const plain = await aesDecryptEcb(key, verifier);
  const got = (await aesDecryptEcb(key, verifierHash)).subarray(0, 20);
  if (!same(await hash('SHA-1', plain), got)) throw new WrongPassword();
  return (await aesDecryptEcb(key, pkg.subarray(8))).subarray(0, packageSize(pkg));
}

/**
 * Arhiva (.docx / .xlsx / .pptx) dintr-un fișier protejat cu parolă. Aruncă WrongPassword la parola greșită și o eroare
 * pe înțeles dacă fișierul e criptat altfel (certificat, RC4).
 */
export async function decryptOffice(data: Uint8Array, password: string): Promise<Uint8Array> {
  const { CFB } = await import('xlsx');
  const cfb = CFB.read(data, { type: 'array' });
  const stream = (name: string) => { const e = CFB.find(cfb, name); return e?.content ? new Uint8Array(e.content as ArrayLike<number>) : null; };
  const info = stream('EncryptionInfo'), pkg = stream('EncryptedPackage');
  if (!info || !pkg || info.length < 12 || pkg.length < 8) throw new Error('Fișierul protejat cu parolă e deteriorat.');
  const major = info[0] | (info[1] << 8), minor = info[2] | (info[3] << 8);
  if (major === 4 && minor === 4) return decryptAgile(info, pkg, password);
  if ((major === 2 || major === 3 || major === 4) && minor === 2) return decryptStandard(info, pkg, password);
  throw new Error('Fișierul e criptat într-un fel pe care Cyber Office Studio nu-l cunoaște.');
}

// ——— Salvarea cu parolă (criptarea agilă: AES-256 + SHA-512, 100.000 de pași, ca programele de birou de acum) ———

const HMAC_KEY = new Uint8Array([0x5f, 0xb2, 0xad, 0x01, 0x0c, 0xb9, 0xe1, 0xf6]);
const HMAC_VALUE = new Uint8Array([0xa0, 0x67, 0x7f, 0x02, 0xb2, 0x2c, 0x84, 0x33]);
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));
/** Completează cu zerouri până la un multiplu de 16 (AES lucrează pe blocuri). */
const pad16 = (b: Uint8Array) => (b.length % 16 ? cat(b, new Uint8Array(16 - (b.length % 16))) : b);
const toB64 = (b: Uint8Array) => btoa(Array.from(b, (x) => String.fromCharCode(x)).join(''));
async function aesEncrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const d = pad16(data);
  if (!d.length) return d;
  // WebCrypto adaugă mereu un bloc de completare la sfârșit; îl tăiem (formatul nu-l are).
  return new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: iv.slice(0, 16) as BufferSource }, await aesKey(key), d as BufferSource)).subarray(0, d.length);
}
async function hmac(alg: string, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await subtle().importKey('raw', key as BufferSource, { name: 'HMAC', hash: alg }, false, ['sign']);
  return new Uint8Array(await subtle().sign('HMAC', k, data as BufferSource));
}

/** Un text UTF-16 cu lungimea în față (4 octeți) și completat la multiplu de 4, cum îl cer fluxurile DataSpaces. */
function lpp4(s: string): Uint8Array {
  const t = utf16(s);
  return cat(u32le(t.length), t, new Uint8Array((4 - (t.length % 4)) % 4));
}
const VERSION_1 = cat(new Uint8Array([1, 0, 0, 0]), new Uint8Array([1, 0, 0, 0]), new Uint8Array([1, 0, 0, 0]));
/**
 * Fluxurile fixe din dosarul „DataSpaces” (spun cititorului că pachetul e criptat): versiunea, harta (EncryptedPackage →
 * StrongEncryptionDataSpace), spațiul de date (→ StrongEncryptionTransform) și transformarea (ID-ul ei din specificație).
 */
export function dataSpaces(): Record<string, Uint8Array> {
  const space = 'StrongEncryptionDataSpace', transform = 'StrongEncryptionTransform';
  const entry = cat(u32le(1), u32le(0), lpp4('EncryptedPackage'), lpp4(space));
  const id = lpp4('{FF9A3F03-56EF-4613-BDD5-5A41C1D07246}');
  return {
    Version: cat(lpp4('Microsoft.Container.DataSpaces'), VERSION_1),
    DataSpaceMap: cat(u32le(8), u32le(1), u32le(entry.length + 4), entry),
    [`DataSpaceInfo/${space}`]: cat(u32le(8), u32le(1), lpp4(transform)),
    [`TransformInfo/${transform}/${String.fromCharCode(6)}Primary`]: cat(u32le(8 + id.length), u32le(1), id, lpp4('Microsoft.Container.EncryptionTransform'), VERSION_1,
      u32le(0), u32le(0), u32le(0), u32le(4)),
  };
}

/** Pachetul criptat: lungimea arhivei pe 8 octeți, apoi bucăți de 4096 de octeți, fiecare cu IV-ul ei. */
async function encryptPackage(zip: Uint8Array, key: Uint8Array, dataSalt: Uint8Array): Promise<Uint8Array> {
  const parts: Uint8Array[] = [cat(u32le(zip.length % 2 ** 32), u32le(Math.floor(zip.length / 2 ** 32)))];
  for (let i = 0, o = 0; o < zip.length; i++, o += SEGMENT) {
    const iv = fit(await hash('SHA-512', dataSalt, u32le(i)), 16);
    parts.push(await aesEncrypt(key, iv, zip.subarray(o, o + SEGMENT)));
  }
  return cat(...parts);
}

/**
 * Fișierul protejat cu parolă (container OLE) pentru o arhivă .docx / .xlsx / .pptx: se deschide doar cu parola,
 * în orice program de birou de acum (și în Suite). `spinCount` mai mic doar în teste.
 */
export async function encryptOffice(zip: Uint8Array, password: string, spinCount = 100000): Promise<Uint8Array> {
  const alg = 'SHA-512';
  const key = random(32), keySalt = random(16), dataSalt = random(16), verifier = random(16);
  const h = await spin(alg, keySalt, password, spinCount);
  const partKey = async (block: Uint8Array) => fit(await hash(alg, h, block), 32);
  const encVerifierInput = await aesEncrypt(await partKey(VERIFIER_INPUT), keySalt, verifier);
  const encVerifierValue = await aesEncrypt(await partKey(VERIFIER_VALUE), keySalt, await hash(alg, verifier));
  const encKey = await aesEncrypt(await partKey(KEY_VALUE), keySalt, key);
  const pkg = await encryptPackage(zip, key, dataSalt);
  // Integritatea: o cheie HMAC la întâmplare și HMAC-ul întregului flux EncryptedPackage, amândouă criptate cu cheia fișierului.
  const hmacKey = random(64);
  const encHmacKey = await aesEncrypt(key, fit(await hash(alg, dataSalt, HMAC_KEY), 16), hmacKey);
  const encHmacValue = await aesEncrypt(key, fit(await hash(alg, dataSalt, HMAC_VALUE), 16), await hmac(alg, hmacKey, pkg));
  const common = 'saltSize="16" blockSize="16" keyBits="256" hashSize="64" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512"';
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + String.fromCharCode(13, 10)
    + '<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption" xmlns:p="http://schemas.microsoft.com/office/2006/keyEncryptor/password">'
    + `<keyData ${common} saltValue="${toB64(dataSalt)}"/>`
    + `<dataIntegrity encryptedHmacKey="${toB64(encHmacKey)}" encryptedHmacValue="${toB64(encHmacValue)}"/>`
    + '<keyEncryptors><keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password">'
    + `<p:encryptedKey spinCount="${spinCount}" ${common} saltValue="${toB64(keySalt)}" encryptedVerifierHashInput="${toB64(encVerifierInput)}"`
    + ` encryptedVerifierHashValue="${toB64(encVerifierValue)}" encryptedKeyValue="${toB64(encKey)}"/></keyEncryptor></keyEncryptors></encryption>`;
  const info = cat(new Uint8Array([4, 0, 4, 0]), u32le(0x40), new TextEncoder().encode(xml));
  const { CFB } = await import('xlsx');
  const cfb = CFB.utils.cfb_new();
  const DS = String.fromCharCode(6) + 'DataSpaces/';
  for (const [name, data] of Object.entries(dataSpaces())) CFB.utils.cfb_add(cfb, DS + name, data);
  CFB.utils.cfb_add(cfb, 'EncryptionInfo', info);
  CFB.utils.cfb_add(cfb, 'EncryptedPackage', pkg);
  return new Uint8Array(CFB.write(cfb, { type: 'array', fileType: 'cfb' }) as ArrayLike<number>);
}

/** Verifică integritatea (HMAC) unui fișier criptat agil, cu parola dată: true = pachetul n-a fost atins. Pentru teste. */
export async function checkIntegrity(data: Uint8Array, password: string): Promise<boolean> {
  const { CFB } = await import('xlsx');
  const cfb = CFB.read(data, { type: 'array' });
  const stream = (name: string) => new Uint8Array(CFB.find(cfb, name)!.content as ArrayLike<number>);
  const info = stream('EncryptionInfo'), pkg = stream('EncryptedPackage');
  const xml = new TextDecoder().decode(info.subarray(8));
  const alg = HASHES[attr(xml, 'encryptedKey', 'hashAlgorithm')], dataAlg = HASHES[attr(xml, 'keyData', 'hashAlgorithm')];
  const salt = b64(attr(xml, 'encryptedKey', 'saltValue'));
  const keyBytes = Number(attr(xml, 'encryptedKey', 'keyBits')) / 8;
  const h = await spin(alg, salt, password, Number(attr(xml, 'encryptedKey', 'spinCount')));
  const key = (await aesDecrypt(fit(await hash(alg, h, KEY_VALUE), keyBytes), salt, b64(attr(xml, 'encryptedKey', 'encryptedKeyValue')))).subarray(0, keyBytes);
  const dataSalt = b64(attr(xml, 'keyData', 'saltValue'));
  const hashSize = Number(attr(xml, 'keyData', 'hashSize'));
  const hk = (await aesDecrypt(key, fit(await hash(dataAlg, dataSalt, HMAC_KEY), 16), b64(attr(xml, 'dataIntegrity', 'encryptedHmacKey')))).subarray(0, hashSize);
  const hv = (await aesDecrypt(key, fit(await hash(dataAlg, dataSalt, HMAC_VALUE), 16), b64(attr(xml, 'dataIntegrity', 'encryptedHmacValue')))).subarray(0, hashSize);
  return same(await hmac(dataAlg, hk, pkg), hv);
}
