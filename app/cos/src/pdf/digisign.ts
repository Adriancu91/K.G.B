// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Semnătura digitală cu certificat (ID digital) în PDF, scrisă de noi, fără bibliotecă de criptografie:
// - ID-ul digital autosemnat: o pereche de chei RSA 2048 (WebCrypto) și un certificat X.509 v3 scris în DER aici;
// - semnătura: PKCS #7 / CMS „detached” (adbe.pkcs7.detached), cu atributele semnate contentType, signingTime și messageDigest
//   (SHA-256 peste octeții din /ByteRange), semnate cu RSA PKCS #1 v1.5;
// - în PDF: dicționarul /Sig cu /Contents rezervat (zerouri) și /ByteRange, pus în câmpul de semnătură ales sau într-unul nou.
// Cheia privată se ține criptată cu parola (PBKDF2 + AES-GCM). Fișierul se rescrie la semnare, deci semnăturile mai vechi
// din el nu mai rămân valabile (Suite avertizează înainte).
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFObject, PDFAcroSignature, PDFRef, PDFStream, PDFString } from 'pdf-lib';
import { open } from './edit';
import { leafCert, readPfx } from './pfx';
import { toPdfPoint } from './sign';

const subtle = () => globalThis.crypto.subtle;
/** Octeții noștri pentru WebCrypto (tipurile TypeScript cer un ArrayBuffer obișnuit). */
const bs = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;

// ---------- DER (scriere) ----------
function lenBytes(n: number): number[] {
  if (n < 128) return [n];
  const b: number[] = [];
  while (n > 0) { b.unshift(n & 255); n = Math.floor(n / 256); }
  return [0x80 | b.length, ...b];
}
function cat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
export function tlv(tag: number, ...parts: Uint8Array[]): Uint8Array {
  const body = cat(parts);
  return cat([new Uint8Array([tag, ...lenBytes(body.length)]), body]);
}
export const seq = (...p: Uint8Array[]) => tlv(0x30, ...p);
/** SET OF în DER: elementele în ordinea octeților lor. */
function setOf(...p: Uint8Array[]): Uint8Array {
  const sorted = [...p].sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  });
  return tlv(0x31, ...sorted);
}
export function oid(s: string): Uint8Array {
  const n = s.split('.').map(Number);
  const out = [40 * n[0] + n[1]];
  for (const v of n.slice(2)) {
    const b = [v & 127];
    let x = Math.floor(v / 128);
    while (x > 0) { b.unshift((x & 127) | 128); x = Math.floor(x / 128); }
    out.push(...b);
  }
  return tlv(0x06, new Uint8Array(out));
}
function intBytes(b: Uint8Array): Uint8Array {
  let i = 0;
  while (i < b.length - 1 && b[i] === 0 && b[i + 1] < 128) i++;
  const v = b.subarray(i);
  return tlv(0x02, v[0] >= 128 ? cat([new Uint8Array([0]), v]) : v);
}
const int = (n: number) => intBytes(new Uint8Array([n]));
const NULL = new Uint8Array([5, 0]);
const utf8 = (s: string) => tlv(0x0c, new TextEncoder().encode(s));
const ia5 = (s: string) => tlv(0x16, new TextEncoder().encode(s));
const octets = (b: Uint8Array) => tlv(0x04, b);
const bits = (b: Uint8Array) => tlv(0x03, new Uint8Array([0]), b);
function derTime(d: Date): Uint8Array {
  const p = (n: number) => String(n).padStart(2, '0');
  const y = d.getUTCFullYear();
  const rest = `${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  // Până în 2049 UTCTime (2 cifre pentru an), după aceea GeneralizedTime.
  return y < 2050 ? tlv(0x17, new TextEncoder().encode(String(y).slice(2) + rest)) : tlv(0x18, new TextEncoder().encode(String(y) + rest));
}
const algo = (o: string) => seq(oid(o), NULL);

const OID = {
  rsa: '1.2.840.113549.1.1.1', sha256rsa: '1.2.840.113549.1.1.11', sha256: '2.16.840.1.101.3.4.2.1',
  data: '1.2.840.113549.1.7.1', signedData: '1.2.840.113549.1.7.2',
  contentType: '1.2.840.113549.1.9.3', messageDigest: '1.2.840.113549.1.9.4', signingTime: '1.2.840.113549.1.9.5', signingCertV2: '1.2.840.113549.1.9.16.2.47', timeStampToken: '1.2.840.113549.1.9.16.2.14', email: '1.2.840.113549.1.9.1',
  ecdsa256: '1.2.840.10045.4.3.2', ecKey: '1.2.840.10045.2.1',
  cn: '2.5.4.3', o: '2.5.4.10', keyUsage: '2.5.29.15', basic: '2.5.29.19', ski: '2.5.29.14',
};

export interface IdOwner { name: string; org?: string; email?: string }

function x500Name(w: IdOwner): Uint8Array {
  const rdn = (o: string, v: Uint8Array) => setOf(seq(oid(o), v));
  return seq(
    ...(w.org?.trim() ? [rdn(OID.o, utf8(w.org.trim()))] : []),
    rdn(OID.cn, utf8(w.name.trim() || 'Fără nume')),
    ...(w.email?.trim() ? [rdn(OID.email, ia5(w.email.trim()))] : []),
  );
}

// ---------- ID digital ----------
export interface DigitalId {
  owner: IdOwner;
  /** Certificatul X.509 (DER). */
  cert: Uint8Array;
  /** Cheia privată: RSA (RSASSA-PKCS1-v1_5) sau EC (ECDSA). Lipsește când semnează Windows (certificat din Windows / token). */
  key?: CryptoKey;
  /** Semnarea în afara aplicației (Windows, tokenul): primește octeții, întoarce semnătura (la EC: r||s). */
  signer?: (data: Uint8Array) => Promise<Uint8Array>;
  /** Cheia de la signer e EC (ECDSA), nu RSA. */
  ec?: boolean;
  /** Certificatele emitenților (lanțul), puse și ele în semnătură; doar la ID-urile din .pfx. */
  chain?: Uint8Array[];
}

const RSA = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

/** ID digital nou, autosemnat: chei RSA 2048 și certificat valabil `years` ani, pentru semnare (digitalSignature, nonRepudiation). */
export async function createDigitalId(owner: IdOwner, years = 5, now = new Date()): Promise<DigitalId & { pkcs8: Uint8Array }> {
  if (!owner.name.trim()) throw new Error('Scrie numele pentru ID-ul digital.');
  const pair = await subtle().generateKey({ ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['sign', 'verify']) as CryptoKeyPair;
  const spki = new Uint8Array(await subtle().exportKey('spki', pair.publicKey));
  const serial = globalThis.crypto.getRandomValues(new Uint8Array(16));
  serial[0] = (serial[0] & 0x7f) | 0x01;
  const until = new Date(now);
  until.setUTCFullYear(until.getUTCFullYear() + years);
  const ski = new Uint8Array(await subtle().digest('SHA-1', spki));
  const name = x500Name(owner);
  const ext = (o: string, critical: boolean, val: Uint8Array) => seq(oid(o), ...(critical ? [tlv(0x01, new Uint8Array([255]))] : []), octets(val));
  const tbs = seq(
    tlv(0xa0, int(2)),
    intBytes(serial),
    algo(OID.sha256rsa),
    name,
    seq(derTime(now), derTime(until)),
    name,
    spki,
    tlv(0xa3, seq(
      ext(OID.basic, true, seq()),
      // digitalSignature (bitul 0) + nonRepudiation (bitul 1): 0b11000000, 6 biți nefolosiți.
      ext(OID.keyUsage, true, tlv(0x03, new Uint8Array([6, 0xc0]))),
      ext(OID.ski, false, octets(ski)),
    )),
  );
  const sig = new Uint8Array(await subtle().sign(RSA, pair.privateKey, bs(tbs)));
  const cert = seq(tbs, algo(OID.sha256rsa), bits(sig));
  const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
  return { owner: { ...owner }, cert, key: pair.privateKey, pkcs8 };
}

/** Cheia privată criptată cu parola: PBKDF2-SHA-256 (200.000 de pași) → AES-GCM 256. */
export interface LockedKey { salt: string; iv: string; data: string }

const b64 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function passKey(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: bs(salt), iterations: 200000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function lockKey(pkcs8: Uint8Array, pass: string): Promise<LockedKey> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16)), iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, await passKey(pass, salt), bs(pkcs8)));
  return { salt: b64(salt), iv: b64(iv), data: b64(data) };
}
/** Cheia privată din forma criptată; parolă greșită → eroare cu mesaj clar. */
export async function unlockKey(l: LockedKey, pass: string): Promise<CryptoKey> {
  return importPrivate(await unlockPkcs8(l, pass));
}
/** Octeții cheii (PKCS #8), pentru deschiderea PDF-urilor criptate cu certificat (RSA scris de noi, nu WebCrypto). */
export async function unlockPkcs8(l: LockedKey, pass: string): Promise<Uint8Array> {
  try { return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(l.iv) }, await passKey(pass, unb64(l.salt)), unb64(l.data))); }
  catch { throw new Error('Parola ID-ului digital nu e bună.'); }
}

/** ID-ul digital păstrat (în setările acestui calculator): proprietarul, certificatul și cheia criptată. */
export interface StoredId { owner: IdOwner; cert: string; key: LockedKey; created: string; chain?: string[]; fromPfx?: boolean }
const KEY = 'suite.pdf.digitalId';
export function loadStoredId(): StoredId | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
}
export function saveStoredId(s: StoredId | null) {
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* fără loc */ }
}
export async function storeId(id: DigitalId & { pkcs8: Uint8Array; fromPfx?: boolean }, pass: string): Promise<StoredId> {
  return {
    owner: id.owner, cert: b64(id.cert), key: await lockKey(id.pkcs8, pass), created: new Date().toISOString(),
    ...(id.chain?.length ? { chain: id.chain.map(b64) } : {}), ...(id.fromPfx ? { fromPfx: true } : {}),
  };
}
export async function openStoredId(s: StoredId, pass: string): Promise<DigitalId> {
  return { owner: s.owner, cert: unb64(s.cert), key: await unlockKey(s.key, pass), ...(s.chain?.length ? { chain: s.chain.map(unb64) } : {}) };
}

// ---------- DER (citire, doar cât ne trebuie din certificatul nostru) ----------
function readTlv(b: Uint8Array, at: number): { tag: number; at: number; start: number; end: number; next: number } {
  const tag = b[at];
  let len = b[at + 1], p = at + 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = len * 256 + b[p++]; }
  return { tag, at, start: p, end: p + len, next: p + len };
}
function children(b: Uint8Array, t: { start: number; end: number }) {
  const out: ReturnType<typeof readTlv>[] = [];
  for (let p = t.start; p < t.end;) { const k = readTlv(b, p); out.push(k); p = k.next; }
  return out;
}
/** Emitentul (DER, cu tot cu antet) și numărul de serie (DER) ale certificatului, pentru IssuerAndSerialNumber. */
export function issuerSerial(cert: Uint8Array): Uint8Array {
  const tbs = children(cert, readTlv(cert, 0))[0];
  const f = children(cert, tbs);
  const i = f[0].tag === 0xa0 ? 1 : 0;
  return seq(cert.subarray(f[i + 2].at, f[i + 2].end), cert.subarray(f[i].at, f[i].end));
}

// ---------- CMS / PKCS #7 ----------
/** Serverul de marcă temporală: primește cererea RFC 3161 (DER) și întoarce răspunsul lui (DER). */
export type TsaClient = (request: Uint8Array) => Promise<Uint8Array>;
export interface CmsOptions {
  /** PAdES / CAdES (ETSI): atributul signingCertificateV2 în locul orei scrise de semnatar. */
  etsi?: boolean;
  /** Marca temporală pe semnătură (atributul nesemnat signatureTimeStampToken). */
  tsa?: TsaClient;
}

/** Semnătura CMS „detached” pentru amprenta SHA-256 dată (`digest`), cu certificatul inclus. */
export async function cmsSign(digest: Uint8Array, id: DigitalId, when = new Date(), o: CmsOptions = {}): Promise<Uint8Array> {
  const certHash = new Uint8Array(await subtle().digest('SHA-256', bs(id.cert)));
  const attrs = [
    seq(oid(OID.contentType), setOf(oid(OID.data))),
    o.etsi ? seq(oid(OID.signingCertV2), setOf(seq(seq(seq(octets(certHash)))))) : seq(oid(OID.signingTime), setOf(derTime(when))),
    seq(oid(OID.messageDigest), setOf(octets(digest))),
  ];
  const signedSet = setOf(...attrs);
  const ec = id.signer ? !!id.ec : id.key!.algorithm.name === 'ECDSA';
  const sig = id.signer
    ? (ec ? ecDer(await id.signer(signedSet)) : await id.signer(signedSet))
    : ec
    ? ecDer(new Uint8Array(await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, id.key!, bs(signedSet))))
    : new Uint8Array(await subtle().sign(RSA, id.key!, bs(signedSet)));
  const signerInfo = seq(
    int(1),
    issuerSerial(id.cert),
    algo(OID.sha256),
    tlv(0xa0, signedSet.subarray(headerLenOf(signedSet))),
    ec ? seq(oid(OID.ecdsa256)) : algo(OID.rsa),
    octets(sig),
    ...(o.tsa ? [tlv(0xa1, seq(oid(OID.timeStampToken), setOf(await timeStamp(o.tsa, sig))))] : []),
  );
  const signedData = seq(int(1), setOf(algo(OID.sha256)), seq(oid(OID.data)), tlv(0xa0, id.cert, ...(id.chain ?? [])), setOf(signerInfo));
  return seq(oid(OID.signedData), tlv(0xa0, signedData));
}
const headerLenOf = (b: Uint8Array) => readTlv(b, 0).start;

// ---------- Marca temporală (RFC 3161) ----------
/** Cererea pentru amprenta SHA-256 dată: versiunea 1, amprenta, un număr la întâmplare (nonce) și certificatul serverului. */
export function tsaRequest(hash: Uint8Array, nonce = globalThis.crypto.getRandomValues(new Uint8Array(8))): Uint8Array {
  return seq(int(1), seq(algo(OID.sha256), octets(hash)), intBytes(nonce), tlv(0x01, new Uint8Array([0xff])));
}
/** Jetonul de marcă temporală din răspunsul serverului, după ce verificăm starea, amprenta și numărul cererii. */
export function tsaToken(resp: Uint8Array, hash: Uint8Array, nonce?: Uint8Array): Uint8Array {
  let parts: ReturnType<typeof readTlv>[];
  let st: ReturnType<typeof readTlv> | undefined;
  try {
    const top = readTlv(resp, 0);
    if (top.tag !== 0x30 || top.end > resp.length) throw new Error();
    parts = children(resp, top);
    st = parts[0]?.tag === 0x30 ? children(resp, parts[0])[0] : undefined;
    if (st?.tag !== 0x02 || st.end - st.start > 4) throw new Error();
  } catch { throw new Error('Serverul de marcă temporală a trimis un răspuns care nu se poate citi.'); }
  const status = st ? resp.subarray(st.start, st.end).reduce((a, x) => a * 256 + x, 0) : -1;
  if (status !== 0 && status !== 1) throw new Error(`Serverul de marcă temporală a refuzat cererea (starea ${status}).`);
  if (!parts[1]) throw new Error('Serverul de marcă temporală nu a trimis marca.');
  const token = resp.slice(parts[1].at, parts[1].end);
  try {
    // ContentInfo → SignedData → encapContentInfo → [0] → OCTET STRING cu TSTInfo { versiune, politică, amprentă, … }.
    const sd = children(token, children(token, children(token, readTlv(token, 0))[1])[0]);
    // tst = conținutul OCTET STRING-ului: TSTInfo.
    const tst = children(token, children(token, children(token, sd[2])[1])[0]);
    const info = children(token, tst[0]);
    const imprint = children(token, info[2]);
    const got = token.subarray(imprint[1].start, imprint[1].end);
    if (got.length !== hash.length || got.some((x, i) => x !== hash[i])) throw new Error('amprenta');
    const n = info.find((t, i) => i > 4 && t.tag === 0x02);
    if (nonce && n) {
      const v = token.subarray(n.start, n.end), w = nonce.subarray(nonce.findIndex((x) => x !== 0));
      const vv = v[0] === 0 ? v.subarray(1) : v;
      if (vv.length !== w.length || vv.some((x, i) => x !== w[i])) throw new Error('nonce');
    }
  } catch { throw new Error('Marca temporală primită nu e pentru această semnătură.'); }
  return token;
}
/** Jetonul de marcă temporală pentru octeții `sig` (amprenta lor SHA-256 merge la server). */
export async function timeStamp(tsa: TsaClient, sig: Uint8Array): Promise<Uint8Array> {
  const hash = new Uint8Array(await subtle().digest('SHA-256', bs(sig)));
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(8));
  nonce[0] = (nonce[0] & 0x7f) | 0x01;
  return tsaToken(await tsa(tsaRequest(hash, nonce)), hash, nonce);
}

/** Semnătura ECDSA de la WebCrypto (r || s) → DER (SEQUENCE { r, s }), cum o cere CMS. */
function ecDer(raw: Uint8Array): Uint8Array {
  const h = raw.length / 2;
  return seq(intBytes(raw.subarray(0, h)), intBytes(raw.subarray(h)));
}

const CURVE_OIDS: Record<string, string> = { '2a8648ce3d030107': 'P-256', '2b81040022': 'P-384', '2b81040023': 'P-521' };
const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
/** Cheia privată PKCS #8 (RSA sau EC, după algoritmul scris în ea), pentru semnare. */
export async function importPrivate(pkcs8: Uint8Array): Promise<CryptoKey> {
  const pki = children(pkcs8, readTlv(pkcs8, 0));
  const [algOid, par] = children(pkcs8, pki[1]);
  const o = hexOf(pkcs8.subarray(algOid.start, algOid.end));
  if (o === '2a8648ce3d0201') {
    const curve = par ? CURVE_OIDS[hexOf(pkcs8.subarray(par.start, par.end))] : undefined;
    if (!curve) throw new Error('Curba cheii EC nu e cunoscută.');
    return subtle().importKey('pkcs8', bs(pkcs8), { name: 'ECDSA', namedCurve: curve }, false, ['sign']);
  }
  return subtle().importKey('pkcs8', bs(pkcs8), RSA, false, ['sign']);
}

/** Numele (CN), organizația (O) și e-mailul din subiectul certificatului. */
export function certOwner(cert: Uint8Array): IdOwner {
  const f = children(cert, children(cert, readTlv(cert, 0))[0]);
  const i = f[0].tag === 0xa0 ? 1 : 0;
  const r: IdOwner = { name: '' };
  for (const set of children(cert, f[i + 4])) for (const atv of children(cert, set)) {
    const [o, v] = children(cert, atv);
    const id = hexOf(cert.subarray(o.start, o.end)), raw = cert.subarray(v.start, v.end);
    let val = '';
    if (v.tag === 0x1e) for (let k = 0; k + 1 < raw.length; k += 2) val += String.fromCharCode((raw[k] << 8) | raw[k + 1]);
    else val = new TextDecoder(v.tag === 0x0c ? 'utf-8' : 'latin1').decode(raw);
    if (id === '550403') r.name = val;
    else if (id === '55040a') r.org = val;
    else if (id === '2a864886f70d010901') r.email = val;
  }
  if (!r.name) r.name = r.org ?? 'Fără nume';
  return r;
}

/** ID-ul digital dintr-un .pfx / .p12 (certificat de la un furnizor sau exportat din alt program). */
export async function importPfxId(file: Uint8Array, pass: string): Promise<DigitalId & { pkcs8: Uint8Array; fromPfx: true }> {
  const p = await readPfx(file, pass);
  const cert = leafCert(p.certs);
  const key = await importPrivate(p.pkcs8);
  return { owner: certOwner(cert), cert, key, pkcs8: p.pkcs8, chain: p.certs.filter((c) => c !== cert), fromPfx: true };
}

// ---------- PDF ----------
/** Câți octeți rezervăm pentru semnătură în /Contents (ajunge pentru RSA 4096 și un lanț scurt de certificate). */
export const SIG_SPACE = 8192;
const BR_PLACEHOLDER = 1111111111;

export interface SignOptions {
  /** Numele semnatarului scris în semnătură (/Name); implicit numele din certificat. */
  name?: string;
  reason?: string;
  location?: string;
  contact?: string;
  /** Câmpul de semnătură gol în care se pune semnătura; fără el se face un câmp nou, invizibil, pe prima pagină. */
  field?: string;
  /** Aspectul vizibil al câmpului (o poză PNG desenată de interfață), întins pe tot câmpul. */
  appearance?: Uint8Array;
  /** Câmp nou, vizibil, în locul ales pe pagină (pagina de la 1; x, y, w, h în punctele paginii văzute, y de sus în jos). */
  place?: { page: number; x: number; y: number; w: number; h: number };
  when?: Date;
  /**
   * Certificarea documentului (DocMDP): ce se mai poate schimba după semnare fără să se strice certificarea.
   * 1 = nimic, 2 = completarea formularului și alte semnături, 3 = și comentarii. Doar prima semnătură poate certifica.
   */
  certify?: 1 | 2 | 3;
  /** Marca temporală de la serverul ales: semnătura devine PAdES (ETSI.CAdES.detached) cu marcă, adică nivelul B-T. */
  tsa?: TsaClient;
}

const latin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)));
  return s;
};

// ---------- Salvarea prin adăugare (incrementală) ----------
// Semnăturile de dinainte acoperă octeții vechi ai fișierului, deci nu-l rescriem: lăsăm fișierul neatins și adăugăm la sfârșit
// doar obiectele noi sau schimbate, un tabel nou de poziții (xref, același fel ca ultimul din fișier) și /Prev spre cel vechi.
type Snapshot = Map<string, string>;
const refKey = (r: PDFRef) => `${r.objectNumber} ${r.generationNumber}`;
const objKey = (o: PDFObject) => (o instanceof PDFStream ? `S${o.dict.toString()}|${o.getContentsSize()}` : o.toString());
function snapshot(doc: PDFDocument): Snapshot {
  const m: Snapshot = new Map();
  for (const [r, o] of doc.context.enumerateIndirectObjects()) m.set(refKey(r), objKey(o));
  return m;
}
/** Poziția ultimului tabel de poziții (startxref) și dacă e un flux (/Type /XRef) sau un tabel clasic. */
function lastXref(b: Uint8Array): { at: number; stream: boolean } | null {
  const tail = latin1(b.subarray(Math.max(0, b.length - 2048)));
  const i = tail.lastIndexOf('startxref');
  if (i < 0) return null;
  const at = parseInt(tail.slice(i + 9).trim(), 10);
  if (!(at >= 0 && at < b.length)) return null;
  return { at, stream: !latin1(b.subarray(at, at + 4)).startsWith('xref') };
}
function incremental(orig: Uint8Array, doc: PDFDocument, before: Snapshot): Uint8Array | null {
  const x = lastXref(orig);
  const tr = doc.context.trailerInfo;
  if (!x || !tr.Root || tr.Encrypt) return null;
  const NL = String.fromCharCode(10);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let pos = orig.length;
  const push = (b: Uint8Array) => { parts.push(b); pos += b.length; };
  const lastByte = orig[orig.length - 1];
  if (lastByte !== 10 && lastByte !== 13) push(enc.encode(NL));
  const offsets: [number, number, number][] = [];
  for (const [r, o] of doc.context.enumerateIndirectObjects()) {
    if (before.get(refKey(r)) === objKey(o)) continue;
    offsets.push([r.objectNumber, r.generationNumber, pos]);
    push(enc.encode(`${r.objectNumber} ${r.generationNumber} obj${NL}`));
    const body = new Uint8Array(o.sizeInBytes());
    o.copyBytesInto(body, 0);
    push(body);
    push(enc.encode(`${NL}endobj${NL}`));
  }
  const extra = `/Root ${tr.Root.toString()}${tr.Info ? ` /Info ${tr.Info.toString()}` : ''}${tr.ID ? ` /ID ${tr.ID.toString()}` : ''} /Prev ${x.at}`;
  // Subsecțiunile: numerele de obiect consecutive stau împreună.
  const groups = (list: [number, number, number][]) => {
    const sorted = [...list].sort((a, b) => a[0] - b[0]);
    const g: [number, number, number][][] = [];
    for (const e of sorted) { const last = g[g.length - 1]; if (last && last[last.length - 1][0] === e[0] - 1) last.push(e); else g.push([e]); }
    return g;
  };
  if (!x.stream) {
    const xrefAt = pos;
    const size = doc.context.largestObjectNumber + 1;
    let t = `xref${NL}`;
    for (const g of groups(offsets)) {
      t += `${g[0][0]} ${g.length}${NL}`;
      for (const [, gen, off] of g) t += `${String(off).padStart(10, '0')} ${String(gen).padStart(5, '0')} n${String.fromCharCode(13, 10)}`;
    }
    t += `trailer${NL}<< /Size ${size} ${extra} >>${NL}startxref${NL}${xrefAt}${NL}%%EOF${NL}`;
    push(enc.encode(t));
  } else {
    // Fluxul de poziții e și el un obiect (nou), cu propria intrare; datele stau necomprimate: W [1 4 2].
    const n = doc.context.largestObjectNumber + 1;
    const xrefAt = pos;
    const all = [...offsets, [n, 0, xrefAt] as [number, number, number]];
    const gs = groups(all);
    const data = new Uint8Array(all.length * 7);
    let k = 0;
    for (const g of gs) for (const [, gen, off] of g) {
      data[k++] = 1;
      data[k++] = (off >>> 24) & 255; data[k++] = (off >>> 16) & 255; data[k++] = (off >>> 8) & 255; data[k++] = off & 255;
      data[k++] = (gen >>> 8) & 255; data[k++] = gen & 255;
    }
    const index = gs.map((g) => `${g[0][0]} ${g.length}`).join(' ');
    push(enc.encode(`${n} 0 obj${NL}<< /Type /XRef /Size ${n + 1} /W [1 4 2] /Index [${index}] ${extra} /Length ${data.length} >>${NL}stream${NL}`));
    push(data);
    push(enc.encode(`${NL}endstream${NL}endobj${NL}startxref${NL}${xrefAt}${NL}%%EOF${NL}`));
  }
  return cat([orig, ...parts]);
}

/**
 * PDF-ul semnat cu ID-ul digital. Semnătura se adaugă la sfârșitul fișierului (salvare incrementală), deci semnăturile și
 * certificarea de dinainte rămân valabile; doar la fișierele pe care nu le putem completa așa (fără startxref) se rescrie tot.
 */
export async function signPdf(bytes: Uint8Array, id: DigitalId, o: SignOptions = {}): Promise<Uint8Array> {
  const doc: PDFDocument = await open(bytes);
  const before = snapshot(doc);
  // pdf-lib nu păstrează fluxurile de obiecte și de poziții citite, deci ar refolosi numerele lor pentru obiectele noi;
  // la adăugare, un număr refolosit ar acoperi fluxul vechi (și obiectele din el). Numerele noi încep după /Size din fișier.
  const lx = lastXref(bytes);
  if (lx) {
    const sz = /[/]Size[^0-9]*([0-9]+)/.exec(latin1(bytes.subarray(lx.at, Math.min(bytes.length, lx.at + 4096))))?.[1];
    if (sz) doc.context.largestObjectNumber = Math.max(doc.context.largestObjectNumber, Number(sz) - 1);
  }
  const ctx = doc.context, when = o.when ?? new Date();
  // Marca temporală aduce încă o semnătură (a serverului) și certificatele lui: rezervăm mai mult loc.
  const space = o.tsa ? SIG_SPACE * 3 : SIG_SPACE;
  const text = (s?: string) => (s?.trim() ? PDFHexString.fromText(s.trim()) : undefined);
  const sigDict: Record<string, unknown> = {
    Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: o.tsa ? 'ETSI.CAdES.detached' : 'adbe.pkcs7.detached',
    ByteRange: [0, BR_PLACEHOLDER, BR_PLACEHOLDER, BR_PLACEHOLDER],
    Contents: PDFHexString.of('0'.repeat(space * 2)),
    M: PDFString.fromDate(when),
    Prop_Build: { App: { Name: PDFName.of('Cyber Office Studio') } },
  };
  if (o.certify) {
    if (doc.catalog.get(PDFName.of('Perms'))) throw new Error('PDF-ul e deja certificat sau are drepturi speciale: nu mai poate fi certificat încă o dată.');
    sigDict.Reference = [{ Type: 'SigRef', TransformMethod: 'DocMDP', TransformParams: { Type: 'TransformParams', P: o.certify, V: PDFName.of('1.2') } }];
  }
  for (const [k, v] of [['Name', text(o.name ?? id.owner.name)], ['Reason', text(o.reason)], ['Location', text(o.location)], ['ContactInfo', text(o.contact)]] as const) if (v) sigDict[k] = v;
  const sigRef = ctx.register(ctx.obj(sigDict as Parameters<typeof ctx.obj>[0]));
  if (o.certify) doc.catalog.set(PDFName.of('Perms'), ctx.obj({ DocMDP: sigRef }));

  // Direct prin AcroForm: doc.getForm() ar șterge partea XFA a formularelor dinamice (de exemplu cele ANAF).
  const acro = doc.catalog.getOrCreateAcroForm();
  const fields = acro.getAllFields().map(([fl]) => fl);
  let widget: PDFDict | undefined;
  if (o.field) {
    const f = fields.find((x) => x.getFullyQualifiedName() === o.field);
    if (!(f instanceof PDFAcroSignature)) throw new Error(`Câmpul de semnătură „${o.field}” nu există.`);
    if (f.dict.get(PDFName.of('V'))) throw new Error(`Câmpul „${o.field}” e deja semnat.`);
    f.dict.set(PDFName.of('V'), sigRef);
    widget = f.getWidgets()[0]?.dict;
  } else {
    const pl = o.place && o.place.page >= 1 && o.place.page <= doc.getPageCount() ? o.place : undefined;
    const page = doc.getPage(pl ? pl.page - 1 : 0);
    const taken = new Set(fields.map((x) => x.getFullyQualifiedName()));
    let n = 1;
    while (taken.has(`Semnatura${n}`)) n++;
    // Fără loc ales: câmp invizibil (F 132 = ascuns la vedere și la tipărire); cu loc: vizibil și tipărit (F 4).
    let rect = [0, 0, 0, 0];
    if (pl) {
      const rot = ((page.getRotation().angle % 360) + 360) % 360, box = page.getCropBox();
      const [ax, ay] = toPdfPoint(pl.x, pl.y, box, rot), [bx, by] = toPdfPoint(pl.x + pl.w, pl.y + pl.h, box, rot);
      rect = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
    }
    const dict = ctx.obj({
      Type: 'Annot', Subtype: 'Widget', FT: 'Sig', T: PDFHexString.fromText(`Semnatura${n}`), Rect: rect, F: pl ? 4 : 132, P: page.ref, V: sigRef,
    } as Parameters<typeof ctx.obj>[0]);
    const ref = ctx.register(dict);
    acro.addField(ref);
    page.node.addAnnot(ref);
    if (pl) widget = dict as unknown as PDFDict;
  }
  if (widget && o.appearance) {
    const r = widget.lookup(PDFName.of('Rect'), PDFArray).asArray().map((x) => (x as PDFNumber).asNumber());
    const w = Math.abs(r[2] - r[0]), h = Math.abs(r[3] - r[1]);
    const img = await doc.embedPng(o.appearance);
    const ap = ctx.register(ctx.stream(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`, {
      Type: 'XObject', Subtype: 'Form', BBox: [0, 0, w, h], Resources: { XObject: { Im0: img.ref } },
    }));
    widget.set(PDFName.of('AP'), ctx.obj({ N: ap }));
  }
  // SigFlags 3: documentul are semnături și se modifică doar prin adăugare.
  acro.dict.set(PDFName.of('SigFlags'), PDFNumber.of(3));

  // Pozele (aspectul câmpului) se scriu în obiecte abia acum; apoi adăugăm doar ce s-a schimbat.
  await doc.flush();
  const out = incremental(bytes, doc, before) ?? await doc.save({ useObjectStreams: false });
  const s = latin1(out);
  const hole = '<' + '0'.repeat(space * 2) + '>';
  const at = s.lastIndexOf(hole);
  if (at < 0) throw new Error('Locul semnăturii nu s-a găsit în fișier.');
  const end = at + hole.length;
  const brText = `${BR_PLACEHOLDER} ${BR_PLACEHOLDER} ${BR_PLACEHOLDER}`;
  const br = s.lastIndexOf(brText, at + hole.length + 2000);
  const brAt = br >= 0 ? br : s.indexOf(brText);
  if (brAt < 0) throw new Error('/ByteRange nu s-a găsit în fișier.');
  const range = [0, at, end, out.length - end];
  const filled = `${range[1]} ${range[2]} ${range[3]}`.padEnd(brText.length, ' ');
  for (let i = 0; i < filled.length; i++) out[brAt + i] = filled.charCodeAt(i);

  const signed = cat([out.subarray(0, at), out.subarray(end)]);
  const digest = new Uint8Array(await subtle().digest('SHA-256', bs(signed)));
  const cms = await cmsSign(digest, id, when, o.tsa ? { etsi: true, tsa: o.tsa } : {});
  if (cms.length > space) throw new Error('Semnătura e prea mare pentru locul rezervat.');
  let hex = '';
  for (const x of cms) hex += x.toString(16).padStart(2, '0');
  for (let i = 0; i < hex.length; i++) out[at + 1 + i] = hex.charCodeAt(i);
  return out;
}
