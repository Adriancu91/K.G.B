// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Panoul „Semnături” din PDF: semnăturile digitale din fișier (cine a semnat, când, de ce, cu ce certificat) și dacă
// documentul s-a mai schimbat după semnare. Dicționarul unei semnături stă mereu direct în fișier (nu comprimat), fiindcă
// /ByteRange arată octeții semnați din jurul lui /Contents; de aceea îl citim din octeții fișierului, fără bibliotecă.
// Certificatul semnatarului se scoate din /Contents (PKCS #7 / CMS, DER) cu un cititor DER mic, scris aici.
// Atenție: aici NU se verifică criptografic semnătura (dacă amprenta se potrivește și dacă certificatul e de încredere).

export interface CertInfo {
  /** Numele (CN) și organizația (O) celui căruia i s-a dat certificatul. */
  name: string;
  org?: string;
  /** Cine a emis certificatul (CN-ul emitentului). */
  issuer?: string;
  /** Perioada de valabilitate, „2024-01-31”. */
  from?: string;
  to?: string;
}

export interface SigInfo {
  /** Felul: semnătură obișnuită, certificare (DocMDP) sau drepturi de folosire puse de programul care a făcut formularul (UR3). */
  kind: 'sign' | 'certify' | 'rights';
  /** Numele scris în semnătură (/Name), data (/M, ca „2024-05-13 14:02”), motivul, locul, contactul. */
  name?: string;
  date?: string;
  reason?: string;
  location?: string;
  contact?: string;
  /** Formatul semnăturii: adbe.pkcs7.detached, ETSI.CAdES.detached (PAdES), adbe.x509.rsa_sha1… */
  subFilter?: string;
  cert?: CertInfo;
  /** Câți octeți s-au adăugat în fișier după această semnătură (0 = semnătura acoperă tot fișierul). */
  after: number;
  /** /ByteRange se potrivește cu locul lui /Contents și nu iese din fișier. */
  rangeOk: boolean;
  /** /ByteRange (doar când e bun), pentru verificarea criptografică (verifySig.ts). */
  range?: [number, number, number, number];
  /** La certificare (DocMDP): ce se mai poate schimba (1 = nimic, 2 = formular și semnături, 3 = și comentarii). */
  perm?: 1 | 2 | 3;
}

const latin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)));
  return s;
};

/** Un șir PDF: (literal, cu \n, \( și coduri octale) sau <hex>; cu FE FF la început e UTF-16. */
export function pdfString(raw: string): string {
  let bytes: number[] = [];
  if (raw.startsWith('<')) {
    const h = raw.slice(1, -1).replace(/[^0-9a-fA-F]/g, '');
    for (let i = 0; i < h.length; i += 2) bytes.push(parseInt((h.slice(i, i + 2) + '0').slice(0, 2), 16));
  } else {
    const s = raw.slice(1, -1);
    const BS = String.fromCharCode(92);
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c !== BS) { bytes.push(c.charCodeAt(0) & 255); continue; }
      const n = s[++i];
      if (n === undefined) break;
      if (n >= '0' && n <= '7') {
        let o = n;
        while (o.length < 3 && s[i + 1] >= '0' && s[i + 1] <= '7') o += s[++i];
        bytes.push(parseInt(o, 8) & 255);
      } else if (n === '\r' || n === '\n') { if (n === '\r' && s[i + 1] === '\n') i++; }
      else bytes.push(({ n: 10, r: 13, t: 9, b: 8, f: 12 } as Record<string, number>)[n] ?? n.charCodeAt(0));
    }
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return out;
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(new Uint8Array(bytes.slice(3)));
  return String.fromCharCode(...bytes);
}

/** Data PDF „D:20240513140210+03'00'” → „2024-05-13 14:02”. */
export function pdfDate(s: string): string | undefined {
  const m = /D:(\d{4})(\d\d)?(\d\d)?(\d\d)?(\d\d)?/.exec(s);
  if (!m) return undefined;
  return `${m[1]}-${m[2] ?? '01'}-${m[3] ?? '01'}` + (m[4] ? ` ${m[4]}:${m[5] ?? '00'}` : '');
}

/** Valoarea unei chei de șir dintr-un dicționar (textul lui): (…) cu paranteze echilibrate sau <…>. */
function strKey(dict: string, key: string): string | undefined {
  const re = new RegExp('/' + key + '(?![A-Za-z])\\s*');
  const m = re.exec(dict);
  if (!m) return undefined;
  let i = m.index + m[0].length;
  if (dict[i] === '<' && dict[i + 1] !== '<') { const e = dict.indexOf('>', i); return e > 0 ? pdfString(dict.slice(i, e + 1)) : undefined; }
  if (dict[i] !== '(') return undefined;
  const BS = String.fromCharCode(92);
  let depth = 0;
  const start = i;
  for (; i < dict.length; i++) {
    const c = dict[i];
    if (c === BS) { i++; continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return pdfString(dict.slice(start, i + 1));
  }
  return undefined;
}

/** Toate semnăturile digitale din fișier, în ordinea în care au fost puse. */
export function readSignatures(bytes: Uint8Array): SigInfo[] {
  const text = latin1(bytes);
  const out: SigInfo[] = [];
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const [a, b, c, d] = [1, 2, 3, 4].map((k) => Number(m![k]));
    const key = `${a} ${b} ${c} ${d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Dicționarul semnăturii: de la „obj” dinainte până la „endobj” de după, cuprinzând și /Contents (între b și c).
    const lo = Math.min(m.index, b);
    const objAt = text.lastIndexOf(' obj', lo);
    const endAt = text.indexOf('endobj', Math.max(m.index, c));
    const dict = text.slice(objAt >= 0 ? objAt : Math.max(0, lo - 4000), endAt >= 0 ? endAt : Math.min(text.length, c + 4000));
    const hole = text.slice(b, c).trim();
    const rangeOk = a === 0 && b < c && c + d <= bytes.length && hole.startsWith('<') && hole.endsWith('>');
    const kind: SigInfo['kind'] = /\/TransformMethod\s*\/UR3?\b/.test(dict) ? 'rights' : /\/TransformMethod\s*\/DocMDP\b/.test(dict) ? 'certify' : 'sign';
    const sub = /\/SubFilter\s*\/([A-Za-z0-9.#_-]+)/.exec(dict)?.[1];
    const tp = dict.indexOf('/TransformParams'), seg = tp >= 0 ? dict.slice(tp, dict.indexOf('>>', tp)) : '';
    const pm = kind === 'certify' ? Number(/[/]P[^0-9A-Za-z/]*([123])(?![0-9])/.exec(seg)?.[1] ?? 2) as 1 | 2 | 3 : undefined;
    const M = strKey(dict, 'M');
    let cert: CertInfo | undefined;
    if (rangeOk) { try { cert = signerCert(hexBytes(hole)); } catch { cert = undefined; } }
    out.push({
      kind, rangeOk, after: Math.max(0, bytes.length - (c + d)),
      ...(pm ? { perm: pm } : {}),
      ...(rangeOk ? { range: [a, b, c, d] as [number, number, number, number] } : {}),
      ...(strKey(dict, 'Name') ? { name: strKey(dict, 'Name') } : {}),
      ...(M && pdfDate(M) ? { date: pdfDate(M) } : {}),
      ...(strKey(dict, 'Reason') ? { reason: strKey(dict, 'Reason') } : {}),
      ...(strKey(dict, 'Location') ? { location: strKey(dict, 'Location') } : {}),
      ...(strKey(dict, 'ContactInfo') ? { contact: strKey(dict, 'ContactInfo') } : {}),
      ...(sub ? { subFilter: sub } : {}),
      ...(cert ? { cert } : {}),
    });
  }
  return out.sort((x, y) => y.after - x.after);
}

export function hexBytes(hole: string): Uint8Array {
  const h = hole.slice(1, -1).replace(/[^0-9a-fA-F]/g, '');
  const b = new Uint8Array(h.length >> 1);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
  return b;
}

// ---- Cititorul DER (doar cât trebuie pentru certificate) ----
export interface Tlv { tag: number; off: number; start: number; end: number; next: number }
export function tlv(b: Uint8Array, off: number): Tlv {
  const tag = b[off];
  let len = b[off + 1], p = off + 2;
  if (off + 2 > b.length) throw new Error('DER');
  if (len === 0x80) {
    // Lungime nedefinită (BER, des folosită în PKCS #7): copiii până la marcajul de sfârșit 00 00.
    let q = p;
    while (q + 1 < b.length && !(b[q] === 0 && b[q + 1] === 0)) q = tlv(b, q).next;
    if (q + 1 >= b.length) throw new Error('DER');
    return { tag, off, start: p, end: q, next: q + 2 };
  }
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error('DER');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[p++];
  }
  if (p + len > b.length) throw new Error('DER');
  return { tag, off, start: p, end: p + len, next: p + len };
}
export function kids(b: Uint8Array, t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let p = t.start; p < t.end;) { const k = tlv(b, p); out.push(k); p = k.next; }
  return out;
}
export const hex = (b: Uint8Array, t: Tlv) => Array.from(b.subarray(t.start, t.end), (x) => x.toString(16).padStart(2, '0')).join('');

function derString(b: Uint8Array, t: Tlv): string {
  const v = b.subarray(t.start, t.end);
  if (t.tag === 0x1e) { let s = ''; for (let i = 0; i + 1 < v.length; i += 2) s += String.fromCharCode((v[i] << 8) | v[i + 1]); return s; }
  if (t.tag === 0x0c) return new TextDecoder('utf-8').decode(v);
  return String.fromCharCode(...v);
}

/** Din numele X.500 (Name): CN și O. */
function nameParts(b: Uint8Array, t: Tlv): { cn?: string; o?: string } {
  const r: { cn?: string; o?: string } = {};
  for (const set of kids(b, t)) for (const atv of kids(b, set)) {
    const [oid, val] = kids(b, atv);
    if (!oid || !val) continue;
    const id = hex(b, oid);
    if (id === '550403') r.cn = derString(b, val);
    else if (id === '55040a') r.o = derString(b, val);
  }
  return r;
}

function derTime(b: Uint8Array, t: Tlv): string | undefined {
  const s = String.fromCharCode(...b.subarray(t.start, t.end));
  const m = t.tag === 0x17 ? /^(\d\d)(\d\d)(\d\d)/.exec(s) : /^(\d{4})(\d\d)(\d\d)/.exec(s);
  if (!m) return undefined;
  const y = t.tag === 0x17 ? (Number(m[1]) < 50 ? '20' : '19') + m[1] : m[1];
  return `${y}-${m[2]}-${m[3]}`;
}

/** Numele, emitentul și valabilitatea dintr-un singur certificat X.509 (DER), de exemplu cel din semnăturile .docx / .xlsx / .pptx. */
export function certInfo(der: Uint8Array): CertInfo | undefined {
  try {
    const f = kids(der, kids(der, tlv(der, 0))[0]);
    const i = f[0]?.tag === 0xa0 ? 1 : 0;
    const [issuer, validity, subject] = [f[i + 2], f[i + 3], f[i + 4]];
    const sub = nameParts(der, subject), iss = nameParts(der, issuer);
    const times = kids(der, validity);
    const from = times[0] && derTime(der, times[0]), to = times[1] && derTime(der, times[1]);
    return {
      name: sub.cn ?? sub.o ?? '(fără nume)',
      ...(sub.o && sub.cn ? { org: sub.o } : {}),
      ...(iss.cn ?? iss.o ? { issuer: iss.cn ?? iss.o } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
  } catch { return undefined; }
}

/** Certificatul semnatarului din PKCS #7 / CMS: cel al cărui subiect nu a emis niciun alt certificat din listă. */
export function signerCert(der: Uint8Array): CertInfo | undefined {
  const ci = tlv(der, 0);
  const [, wrap] = kids(der, ci);
  if (!wrap) return undefined;
  const sd = kids(der, wrap)[0];
  const certsTag = kids(der, sd).find((k) => k.tag === 0xa0);
  if (!certsTag) return undefined;
  const certs = kids(der, certsTag).filter((k) => k.tag === 0x30).map((c) => {
    const tbs = kids(der, c)[0];
    const f = kids(der, tbs);
    const i = f[0]?.tag === 0xa0 ? 1 : 0;
    const [issuer, validity, subject] = [f[i + 2], f[i + 3], f[i + 4]];
    const times = validity ? kids(der, validity) : [];
    return { issuer: hex(der, issuer), subject: hex(der, subject), iss: nameParts(der, issuer), sub: nameParts(der, subject), from: times[0] && derTime(der, times[0]), to: times[1] && derTime(der, times[1]) };
  });
  if (!certs.length) return undefined;
  const leaf = certs.find((c) => !certs.some((o) => o !== c && o.issuer === c.subject)) ?? certs[0];
  return {
    name: leaf.sub.cn ?? leaf.sub.o ?? '(fără nume)',
    ...(leaf.sub.o && leaf.sub.cn ? { org: leaf.sub.o } : {}),
    ...(leaf.iss.cn ?? leaf.iss.o ? { issuer: leaf.iss.cn ?? leaf.iss.o } : {}),
    ...(leaf.from ? { from: leaf.from } : {}),
    ...(leaf.to ? { to: leaf.to } : {}),
  };
}
