// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Cititorul de fișiere .pfx / .p12 (PKCS #12), scris de noi: cheia privată și certificatele (cu lanțul lor), ca să se poată
// semna PDF-ul cu un certificat primit de la un furnizor sau exportat din alt program. Merg fișierele criptate cu PBES2
// (PBKDF2 + AES, felul de azi, implicit în programele noi); cele cu criptarea veche (3DES / RC2) primesc un mesaj clar.
// Cheia se citește cu WebCrypto; MAC-ul fișierului nu se verifică (o parolă greșită se vede oricum la decriptare).
import { hex, kids, tlv, type Tlv } from './signatures';

const subtle = () => globalThis.crypto.subtle;
const bs = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;

const OID = {
  data: '2a864886f70d010701', encData: '2a864886f70d010706',
  keyBag: '2a864886f70d010c0a0101', shrouded: '2a864886f70d010c0a0102', certBag: '2a864886f70d010c0a0103',
  x509: '2a864886f70d01091601', pbes2: '2a864886f70d01050d', pbkdf2: '2a864886f70d01050c',
  rsa: '2a864886f70d010101', ec: '2a8648ce3d0201',
};
const PRF: Record<string, string> = { '2a864886f70d0207': 'SHA-1', '2a864886f70d0209': 'SHA-256', '2a864886f70d020a': 'SHA-384', '2a864886f70d020b': 'SHA-512' };
const AES: Record<string, number> = { '608648016503040102': 128, '608648016503040116': 192, '60864801650304012a': 256 };

/** Conținutul unui OCTET STRING, și când e „construit” (bucăți, în BER). */
function octets(b: Uint8Array, t: Tlv): Uint8Array {
  if (t.tag === 0x04 || t.tag === 0x80) return b.subarray(t.start, t.end);
  if (t.tag === 0x24 || t.tag === 0xa0) {
    const parts = kids(b, t).map((k) => octets(b, k));
    const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  throw new Error('DER');
}
const num = (b: Uint8Array, t: Tlv) => Array.from(b.subarray(t.start, t.end)).reduce((a, x) => a * 256 + x, 0);

const OLD = 'Fișierul folosește criptarea veche (3DES / RC2), pe care Cyber Office Studio nu o citește. Exportă certificatul din nou, cu criptarea AES-256.';

/** Decriptează PBES2 (PBKDF2 + AES-CBC); parola se folosește ca UTF-8. */
async function pbes2(b: Uint8Array, alg: Tlv, data: Uint8Array, pass: string): Promise<Uint8Array> {
  const [oid, params] = kids(b, alg);
  if (hex(b, oid) !== OID.pbes2) throw new Error(OLD);
  const [kdf, scheme] = kids(b, params);
  const [kdfOid, kdfPar] = kids(b, kdf);
  if (hex(b, kdfOid) !== OID.pbkdf2) throw new Error(OLD);
  const kp = kids(b, kdfPar);
  const salt = b.subarray(kp[0].start, kp[0].end).slice();
  const iter = num(b, kp[1]);
  const prfT = kp.slice(2).find((k) => k.tag === 0x30);
  const hash = prfT ? PRF[hex(b, kids(b, prfT)[0])] : 'SHA-1';
  const [encOid, ivT] = kids(b, scheme);
  const bits = AES[hex(b, encOid)];
  if (!hash || !bits) throw new Error(OLD);
  const base = await subtle().importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle().deriveKey({ name: 'PBKDF2', hash, salt: bs(salt), iterations: iter }, base, { name: 'AES-CBC', length: bits }, false, ['decrypt']);
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-CBC', iv: bs(b.subarray(ivT.start, ivT.end).slice()) }, key, bs(data.slice())));
  } catch {
    throw new Error('Parola fișierului .pfx nu e bună.');
  }
}

export interface PfxContent {
  /** Cheia privată (PKCS #8, DER) și felul ei. */
  pkcs8: Uint8Array;
  keyType: 'rsa' | 'ec';
  /** Toate certificatele din fișier (DER): semnatarul și lanțul lui. */
  certs: Uint8Array[];
}

/** Cheia și certificatele dintr-un .pfx / .p12. */
export async function readPfx(file: Uint8Array, pass: string): Promise<PfxContent> {
  let pfx: Tlv;
  try { pfx = tlv(file, 0); if (pfx.tag !== 0x30) throw new Error(); } catch { throw new Error('Fișierul nu e un .pfx / .p12.'); }
  const [, authSafe] = kids(file, pfx);
  const [ctype, wrap] = kids(file, authSafe);
  if (hex(file, ctype) !== OID.data) throw new Error('Fișierul .pfx e semnat cu o cheie publică (fel rar), pe care Cyber Office Studio nu îl citește.');
  const asBytes = octets(file, kids(file, wrap)[0]);
  const keys: Uint8Array[] = [], certs: Uint8Array[] = [];
  const bags = async (b: Uint8Array) => {
    for (const bag of kids(b, tlv(b, 0))) {
      const [idT, valWrap] = kids(b, bag);
      const id = hex(b, idT);
      const val = kids(b, valWrap)[0];
      if (id === OID.keyBag) keys.push(b.subarray(val.off, val.end).slice());
      else if (id === OID.shrouded) {
        const [alg, enc] = kids(b, val);
        keys.push(await pbes2(b, alg, octets(b, enc), pass));
      } else if (id === OID.certBag) {
        const [cid, cv] = kids(b, val);
        if (hex(b, cid) === OID.x509) certs.push(octets(b, kids(b, cv)[0]).slice());
      }
    }
  };
  for (const ci of kids(asBytes, tlv(asBytes, 0))) {
    const [t, w] = kids(asBytes, ci);
    const type = hex(asBytes, t);
    if (type === OID.data) await bags(octets(asBytes, kids(asBytes, w)[0]).slice());
    else if (type === OID.encData) {
      const ed = kids(asBytes, w)[0];
      const eci = kids(asBytes, ed)[1];
      const [, alg, content] = kids(asBytes, eci);
      await bags(await pbes2(asBytes, alg, octets(asBytes, content), pass));
    }
  }
  if (!keys.length) throw new Error('Fișierul .pfx nu conține cheia privată (doar certificate).');
  if (!certs.length) throw new Error('Fișierul .pfx nu conține certificatul.');
  const k = keys[0];
  const pki = kids(k, tlv(k, 0));
  const keyAlg = hex(k, kids(k, pki[1])[0]);
  if (keyAlg !== OID.rsa && keyAlg !== OID.ec) throw new Error('Tipul cheii din .pfx nu e cunoscut.');
  return { pkcs8: k, keyType: keyAlg === OID.rsa ? 'rsa' : 'ec', certs };
}

/** Certificatul semnatarului din listă: cel care nu e emitentul niciunui alt certificat din fișier. */
export function leafCert(certs: Uint8Array[]): Uint8Array {
  const names = certs.map((c) => {
    const f = kids(c, kids(c, tlv(c, 0))[0]);
    const i = f[0].tag === 0xa0 ? 1 : 0;
    return { c, issuer: hex(c, f[i + 2]), subject: hex(c, f[i + 4]) };
  });
  return (names.find((n) => !names.some((o) => o !== n && o.issuer === n.subject && o.subject !== n.subject)) ?? names[0]).c;
}
