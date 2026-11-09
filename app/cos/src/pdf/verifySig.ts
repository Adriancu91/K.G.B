// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Verificarea criptografică a unei semnături digitale din PDF (panoul 🖋): amprenta octeților din /ByteRange se recalculează,
// se compară cu cea din semnătură (messageDigest) și semnătura se verifică cu cheia publică din certificatul semnatarului,
// cu WebCrypto. Merg PKCS #7 / CMS „detached” (adbe.pkcs7.detached, ETSI.CAdES.detached) și adbe.pkcs7.sha1,
// cu RSA (PKCS #1 v1.5) sau ECDSA și SHA-1 / SHA-256 / SHA-384 / SHA-512.
// Nu se verifică încă dacă emitentul certificatului e de încredere (lista autorităților) și dacă certificatul a fost revocat.
import { hex, hexBytes, kids, signerCert, tlv, type SigInfo, type Tlv } from './signatures';

export interface SigCheck {
  /** true = semnătura e bună pentru octeții semnați; false = nu se potrivește; null = nu se poate verifica (format necunoscut). */
  ok: boolean | null;
  /** Explicația, în română. */
  why: string;
  /** Certificatul semnatarului e autosemnat (identitatea nu e confirmată de cineva). */
  selfSigned?: boolean;
  /** Algoritmul, de exemplu „RSA 2048 · SHA-256”. */
  alg?: string;
}

const DIGESTS: Record<string, string> = {
  '2b0e03021a': 'SHA-1', '608648016503040201': 'SHA-256', '608648016503040202': 'SHA-384', '608648016503040203': 'SHA-512',
};
const RSA_HASH: Record<string, string> = {
  '2a864886f70d010105': 'SHA-1', '2a864886f70d01010b': 'SHA-256', '2a864886f70d01010c': 'SHA-384', '2a864886f70d01010d': 'SHA-512',
};
const EC_HASH: Record<string, string> = {
  '2a8648ce3d0401': 'SHA-1', '2a8648ce3d040302': 'SHA-256', '2a8648ce3d040303': 'SHA-384', '2a8648ce3d040304': 'SHA-512',
};
const CURVES: Record<string, string> = { '2a8648ce3d030107': 'P-256', '2b81040022': 'P-384', '2b81040023': 'P-521' };
const OID_RSA = '2a864886f70d010101', OID_EC = '2a8648ce3d0201', OID_PSS = '2a864886f70d01010a';
const OID_MD = '2a864886f70d010904';

const subtle = () => globalThis.crypto.subtle;
const bs = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const whole = (b: Uint8Array, t: Tlv) => b.subarray(t.off, t.end);
const body = (b: Uint8Array, t: Tlv) => b.subarray(t.start, t.end);

interface Cert { serial: string; issuer: string; subject: string; spki: Uint8Array; keyAlg: string; curve?: string; bits?: number }

function readCert(b: Uint8Array, c: Tlv): Cert {
  const tbs = kids(b, c)[0];
  const f = kids(b, tbs);
  const i = f[0]?.tag === 0xa0 ? 1 : 0;
  const spkiT = f[i + 5];
  const [algT, keyT] = kids(b, spkiT);
  const [kOid, kPar] = kids(b, algT);
  const keyAlg = hex(b, kOid);
  let bits: number | undefined;
  if (keyAlg === OID_RSA) {
    try {
      const rsa = kids(b, tlv(b, keyT.start + 1))[0];
      const n = body(b, rsa);
      bits = (n.length - (n[0] === 0 ? 1 : 0)) * 8;
    } catch { /* fără mărime */ }
  }
  return {
    serial: hex(b, f[i]), issuer: hex(b, f[i + 2]), subject: hex(b, f[i + 4]), spki: whole(b, spkiT).slice(), keyAlg,
    ...(keyAlg === OID_EC && kPar?.tag === 0x06 ? { curve: CURVES[hex(b, kPar)] } : {}),
    ...(bits ? { bits } : {}),
  };
}

/** Semnătura ECDSA din DER (SEQUENCE { r, s }) → r || s de lungime fixă, cum o cere WebCrypto. */
function ecRaw(b: Uint8Array, size: number): Uint8Array {
  const [r, s] = kids(b, tlv(b, 0));
  const fix = (t: Tlv) => {
    let v = body(b, t);
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    const out = new Uint8Array(size);
    out.set(v, size - v.length);
    return out;
  };
  const out = new Uint8Array(size * 2);
  out.set(fix(r), 0); out.set(fix(s), size);
  return out;
}

async function verifyWith(cert: Cert, sigAlg: string, hash: string, sig: Uint8Array, data: Uint8Array, rawEc = false): Promise<boolean | null> {
  if (cert.keyAlg === OID_RSA && (sigAlg === OID_RSA || RSA_HASH[sigAlg])) {
    const h = RSA_HASH[sigAlg] ?? hash;
    const key = await subtle().importKey('spki', bs(cert.spki), { name: 'RSASSA-PKCS1-v1_5', hash: h }, false, ['verify']);
    return subtle().verify('RSASSA-PKCS1-v1_5', key, bs(sig), bs(data));
  }
  if (cert.keyAlg === OID_EC && cert.curve) {
    const h = EC_HASH[sigAlg] ?? hash;
    const key = await subtle().importKey('spki', bs(cert.spki), { name: 'ECDSA', namedCurve: cert.curve }, false, ['verify']);
    const size = cert.curve === 'P-256' ? 32 : cert.curve === 'P-384' ? 48 : 66;
    return subtle().verify({ name: 'ECDSA', hash: h }, key, bs(rawEc ? sig : ecRaw(sig, size)), bs(data));
  }
  return null;
}

/** Semnătura `sig` peste `data` cu cheia din certificatul X.509 `certDer` (semnăturile XML: ECDSA e r || s, nu DER).
 *  Întoarce și algoritmul („RSA 2048 · SHA-256”); ok = null când tipul cheii nu se poate verifica. */
export async function verifyCertSig(certDer: Uint8Array, hash: string, sig: Uint8Array, data: Uint8Array): Promise<{ ok: boolean | null; alg: string; selfSigned: boolean }> {
  const cert = readCert(certDer, tlv(certDer, 0));
  const ok = await verifyWith(cert, OID_RSA, hash, sig, data, true).catch(() => false);
  const alg = `${cert.keyAlg === OID_EC ? `ECDSA ${cert.curve}` : `RSA${cert.bits ? ' ' + cert.bits : ''}`} · ${hash}`;
  return { ok, alg, selfSigned: cert.issuer === cert.subject };
}

/** Verifică semnătura `s` (citită cu readSignatures) din PDF-ul `pdf`. */
export async function verifySignature(pdf: Uint8Array, s: SigInfo): Promise<CmsCheck> {
  if (!s.range) return { ok: false, why: '/ByteRange nu se potrivește cu fișierul: a fost rescris după semnare.' };
  const sub = s.subFilter ?? '';
  if (!/pkcs7\.detached|CAdES\.detached|pkcs7\.sha1/i.test(sub)) return { ok: null, why: `Formatul semnăturii (${sub || 'necunoscut'}) nu poate fi verificat încă.` };
  const [a, b, c, d] = s.range;
  const text = new TextDecoder('latin1').decode(pdf.subarray(b, c));
  const der = hexBytes(text.trim());
  const content = new Uint8Array(b - a + d);
  content.set(pdf.subarray(a, b), 0); content.set(pdf.subarray(c, c + d), b - a);
  return verifyCms(der, content, true);
}

export interface CmsCheck extends SigCheck {
  /** Conținutul din interiorul semnăturii (la .p7m: fișierul semnat). */
  inner?: Uint8Array;
  /** Semnătura e separată (.p7s) și nu i s-a dat fișierul semnat. */
  detached?: true;
  /** Marca temporală (RFC 3161) de pe semnătură: ora serverului, numele lui și dacă se potrivește cu semnătura. */
  stamp?: { time?: string; by?: string; ok: boolean };
  /** Ora semnării scrisă în semnătură (signingTime), „2026-10-27 01:21”. */
  when?: string;
}
const OID_TIME = '2a864886f70d010905';

/** Verifică o semnătură CMS / PKCS #7 (DER). `content` = octeții semnați când semnătura e separată (PDF, .p7s);
 *  null = conținutul e în semnătură (.p7m). `pdf` schimbă doar textul mesajelor. */
export async function verifyCms(der: Uint8Array, content: Uint8Array | null, pdf = false): Promise<CmsCheck> {
  const changed = pdf ? 'Amprenta din semnătură nu se potrivește cu fișierul: PDF-ul s-a schimbat după semnare.' : 'Amprenta din semnătură nu se potrivește cu fișierul: fișierul s-a schimbat după semnare.';
  try {
    const ci = tlv(der, 0);
    const sd = kids(der, kids(der, ci)[1])[0];
    const parts = kids(der, sd);
    const certsT = parts.find((k) => k.tag === 0xa0);
    const encap = parts[2];
    const signerInfos = parts[parts.length - 1];
    const si = kids(der, signerInfos)[0];
    if (!si) return { ok: null, why: 'Semnătura nu are semnatar.' };
    const f = kids(der, si);
    const digAlg = DIGESTS[hex(der, kids(der, f[2])[0])];
    if (!digAlg) return { ok: null, why: 'Algoritmul amprentei nu e cunoscut.' };
    let k = 3;
    const attrs = f[k]?.tag === 0xa0 ? f[k++] : undefined;
    const sigAlg = hex(der, kids(der, f[k++])[0]);
    const sig = body(der, f[k]).slice();
    const unsigned = f[k + 1]?.tag === 0xa1 ? f[k + 1] : undefined;
    if (sigAlg === OID_PSS) return { ok: null, why: 'Semnătura RSA-PSS nu poate fi verificată încă.' };

    // Ce s-a semnat: amprenta octeților separați (din /ByteRange sau fișierul de lângă .p7s); la adbe.pkcs7.sha1 conținutul
    // încapsulat e SHA-1 al lor, iar la .p7m conținutul încapsulat e chiar fișierul.
    const eWrap = kids(der, encap).find((x) => x.tag === 0xa0);
    const eContent = eWrap ? octets(der, kids(der, eWrap)[0]) : undefined;
    if (!content && !eContent) return { ok: null, why: 'Semnătura e separată: îi trebuie și fișierul semnat.', detached: true };
    let signed: Uint8Array = content ?? eContent!;
    if (content && eContent) {
      const sha1 = new Uint8Array(await subtle().digest('SHA-1', bs(content)));
      if (!same(eContent, sha1)) return { ok: false, why: changed };
      signed = eContent;
    }
    const signedDigest = new Uint8Array(await subtle().digest(digAlg, bs(signed)));
    let data: Uint8Array;
    let when: string | undefined;
    if (attrs) {
      let md: Uint8Array | undefined;
      for (const at of kids(der, attrs)) {
        const [o, vals] = kids(der, at);
        if (o && hex(der, o) === OID_MD) md = body(der, kids(der, vals)[0]).slice();
        if (o && hex(der, o) === OID_TIME) when = derTimeFull(der, kids(der, vals)[0]);
      }
      if (!md) return { ok: false, why: 'Semnătura nu conține amprenta documentului.' };
      if (!same(md, signedDigest)) return { ok: false, why: changed, ...(when ? { when } : {}) };
      data = whole(der, attrs).slice();
      data[0] = 0x31;
    } else data = signed;
    let stamp: CmsCheck['stamp'];
    if (unsigned) for (const at of kids(der, unsigned)) {
      const [o, vals] = kids(der, at);
      if (o && vals && hex(der, o) === OID_TST) stamp = await checkStamp(whole(der, kids(der, vals)[0]).slice(), sig);
    }
    const extra = { ...(when ? { when } : {}), ...(stamp ? { stamp } : {}), ...(!content && eContent ? { inner: eContent } : {}) };

    const certs = certsT ? kids(der, certsT).filter((x) => x.tag === 0x30).map((x) => readCert(der, x)) : [];
    if (!certs.length) return { ok: null, why: 'Semnătura nu conține certificatul semnatarului.' };
    // Semnatarul: întâi certificatul cu numărul de serie din semnătură, apoi celelalte.
    const sid = f[1];
    const serial = sid.tag === 0x30 ? hex(der, kids(der, sid)[1]) : '';
    const order = [...certs].sort((x, y) => Number(y.serial === serial) - Number(x.serial === serial));
    let unknown = false;
    for (const cert of order) {
      const r = await verifyWith(cert, sigAlg, digAlg, sig, data).catch(() => false);
      if (r === null) { unknown = true; continue; }
      if (r) {
        const alg = `${cert.keyAlg === OID_EC ? `ECDSA ${cert.curve}` : `RSA${cert.bits ? ' ' + cert.bits : ''}`} · ${RSA_HASH[sigAlg] ?? EC_HASH[sigAlg] ?? digAlg}`;
        return { ok: true, why: 'Semnătura e validă: octeții semnați sunt exact cei din fișier.', selfSigned: cert.issuer === cert.subject, alg, ...extra };
      }
    }
    if (unknown) return { ok: null, why: 'Tipul cheii din certificat nu poate fi verificat încă.', ...extra };
    return { ok: false, why: 'Semnătura nu se potrivește cu certificatul: a fost falsificată sau stricată.', ...extra };
  } catch {
    return { ok: null, why: 'Semnătura nu a putut fi citită (structură necunoscută).' };
  }
}

/** Marca temporală: jetonul e tot o semnătură CMS (a serverului), cu TSTInfo înăuntru: amprenta semnăturii noastre și ora. */
export async function checkStamp(token: Uint8Array, sig: Uint8Array): Promise<NonNullable<CmsCheck['stamp']>> {
  try {
    const r = await verifyCms(token, null);
    let by: string | undefined;
    try { by = signerCert(token)?.name; } catch { by = undefined; }
    const t = r.inner;
    if (!t) return { ok: false, ...(by ? { by } : {}) };
    const info = kids(t, tlv(t, 0));
    const imp = kids(t, info[2]);
    const alg = DIGESTS[hex(t, kids(t, imp[0])[0])];
    const want = alg ? new Uint8Array(await subtle().digest(alg, bs(sig))) : undefined;
    const time = derTimeFull(t, info[4]);
    const ok = r.ok === true && !!want && same(body(t, imp[1]), want);
    return { ok, ...(time ? { time } : {}), ...(by ? { by } : {}) };
  } catch { return { ok: false }; }
}
const OID_TST = '2a864886f70d010910020e';

/** OCTET STRING-ul conținutului; în BER poate fi „construit” (0x24), din mai multe bucăți lipite. */
function octets(b: Uint8Array, t: Tlv): Uint8Array {
  if (t.tag !== 0x24) return body(b, t).slice();
  const parts = kids(b, t).map((k) => octets(b, k));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** UTCTime / GeneralizedTime (UTC) → ora acestui calculator, „2026-10-27 01:21”. */
function derTimeFull(b: Uint8Array, t: Tlv): string | undefined {
  const s = String.fromCharCode(...b.subarray(t.start, t.end));
  const m = t.tag === 0x17 ? /^([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})/.exec(s) : /^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})/.exec(s);
  if (!m) return undefined;
  const y = t.tag === 0x17 ? (Number(m[1]) < 50 ? 2000 : 1900) + Number(m[1]) : Number(m[1]);
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Semnătura dintr-un fișier .p7s / .p7m: DER sau text Base64 (cu sau fără „-----BEGIN PKCS7-----”). */
export function cmsBytes(file: Uint8Array): Uint8Array | null {
  if (file[0] === 0x30) return file;
  const t = new TextDecoder('latin1').decode(file.subarray(0, Math.min(file.length, 64 * 1024 * 1024)));
  const b64 = t.replace(/-----(BEGIN|END)[^-]*-----/g, '').replace(/[\s]/g, '');
  if (!b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return null;
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out[0] === 0x30 ? out : null;
  } catch { return null; }
}
