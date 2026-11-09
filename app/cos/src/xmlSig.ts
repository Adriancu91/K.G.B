// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Semnăturile digitale din .docx / .xlsx / .pptx (_xmlsignatures/sig*.xml, XML-DSig cum îl cere standardul pachetelor OPC):
// verificarea lor, scrisă de noi. Pașii:
//  1. Fiecare <Reference> din <SignedInfo> are amprenta unei bucăți: obiectele din semnătură (#idPackageObject cu lista
//     părților din pachet, #idOfficeObject, #idSignedProperties) sau, în <Manifest>, părțile din arhivă (/word/document.xml…).
//     Amprenta se recalculează: pentru elementele XML peste forma lor canonică (C14N), pentru părți peste octeții lor, iar
//     pentru fișierele .rels după „transformarea relațiilor” (doar relațiile semnate, ordonate după Id).
//  2. <SignedInfo>, în forma canonică, se verifică cu cheia publică din certificatul din <KeyInfo>.
// Forma canonică (C14N 1.0, cu sau fără „exclusive”) e scrisă aici de la zero, pe DOM-ul din DOMParser.
// Nu se verifică încă dacă emitentul certificatului e de încredere și nici revocarea (ca la PDF).

export interface XmlSigCheck {
  /** Numele semnatarului din certificat. */
  name: string;
  /** true = validă; false = documentul s-a schimbat sau semnătura e falsă; null = nu s-a putut verifica. */
  ok: boolean | null;
  why: string;
  /** Ora semnării scrisă în semnătură, „2026-10-27 01:21”. */
  when?: string;
  alg?: string;
  selfSigned?: boolean;
  /** Marca temporală (XAdES-T): ora serverului, numele lui și dacă se potrivește cu semnătura. */
  stamp?: { time?: string; by?: string; ok: boolean };
}

/** Ce trebuie din arhivă: octeții unei părți după calea ei („word/document.xml”), sau null dacă lipsește. */
export type PartReader = (path: string) => Promise<Uint8Array | null>;

const DS = 'http://www.w3.org/2000/09/xmldsig#';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const C14N_C = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments';
const EXC = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const EXC_C = 'http://www.w3.org/2001/10/xml-exc-c14n#WithComments';
const REL_T = 'http://schemas.openxmlformats.org/package/2006/RelationshipTransform';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const DIGEST: Record<string, string> = {
  'http://www.w3.org/2000/09/xmldsig#sha1': 'SHA-1',
  'http://www.w3.org/2001/04/xmlenc#sha256': 'SHA-256',
  'http://www.w3.org/2001/04/xmldsig-more#sha384': 'SHA-384',
  'http://www.w3.org/2001/04/xmlenc#sha512': 'SHA-512',
};
/** Algoritmul semnăturii → amprenta folosită (RSA PKCS #1 v1.5 sau ECDSA, cheia spune care). */
const SIGN: Record<string, string> = {
  'http://www.w3.org/2000/09/xmldsig#rsa-sha1': 'SHA-1',
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256': 'SHA-256',
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384': 'SHA-384',
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512': 'SHA-512',
  'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha1': 'SHA-1',
  'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256': 'SHA-256',
  'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384': 'SHA-384',
  'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha512': 'SHA-512',
};

// ---------- forma canonică ----------

const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\r]/g, '&#xD;');
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  .replace(/[\t]/g, '&#x9;').replace(/[\n]/g, '&#xA;').replace(/[\r]/g, '&#xD;');
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Declarațiile de spații de nume scrise pe un element: prefix ('' = implicit) → adresă. */
function ownDecls(el: Element): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of Array.from(el.attributes)) {
    if (a.name === 'xmlns') m.set('', a.value);
    else if (a.name.startsWith('xmlns:')) m.set(a.name.slice(6), a.value);
  }
  return m;
}

/** Spațiile de nume valabile pe un element (inclusiv cele moștenite de la părinți). */
function inScope(el: Element): Map<string, string> {
  const chain: Element[] = [];
  for (let n: Node | null = el; n && n.nodeType === 1; n = n.parentNode) chain.unshift(n as Element);
  const m = new Map<string, string>();
  for (const e of chain) for (const [p, u] of ownDecls(e)) m.set(p, u);
  return m;
}

/** Forma canonică a elementului `el` cu tot ce e în el (C14N 1.0; `exclusive` = C14N exclusiv, cu prefixele din `inclusive`). */
export function canonicalize(el: Element, opts: { exclusive?: boolean; comments?: boolean; inclusive?: string[] } = {}): string {
  const out: string[] = [];
  const incl = new Set(opts.inclusive ?? []);
  // Atributele xml:* ale strămoșilor (xml:lang, xml:space) se moștenesc pe elementul de sus (doar C14N inclusiv).
  const xmlInherited = new Map<string, string>();
  if (!opts.exclusive) {
    for (let n = el.parentNode; n && n.nodeType === 1; n = n.parentNode) {
      for (const a of Array.from((n as Element).attributes)) if (a.name.startsWith('xml:') && !xmlInherited.has(a.name)) xmlInherited.set(a.name, a.value);
    }
  }
  const walk = (e: Element, scope: Map<string, string>, rendered: Map<string, string>, top: boolean) => {
    const here = new Map(scope);
    for (const [p, u] of ownDecls(e)) here.set(p, u);
    const attrs = Array.from(e.attributes).filter((a) => a.name !== 'xmlns' && !a.name.startsWith('xmlns:') && a.namespaceURI !== XMLNS);
    // Ce declarații se scriu: la C14N inclusiv toate cele valabile; la exclusiv doar cele folosite de element / atribute.
    let want: string[];
    if (opts.exclusive) {
      const used = new Set<string>([e.prefix ?? '']);
      for (const a of attrs) if (a.prefix && a.prefix !== 'xml') used.add(a.prefix);
      for (const p of incl) if (here.has(p === '#default' ? '' : p)) used.add(p === '#default' ? '' : p);
      want = [...used];
    } else want = [...here.keys()];
    const ns: [string, string][] = [];
    const next = new Map(rendered);
    for (const p of want) {
      if (p === 'xml' || (p !== '' && !here.has(p))) continue;
      const u = here.get(p) ?? '';
      // Se scrie doar ce diferă de ce s-a scris deja mai sus; xmlns="" doar dacă mai sus era un spațiu implicit.
      if (p === '' && u === '' ? !(rendered.get('') ?? '') : rendered.get(p) === u) continue;
      ns.push([p, u]);
      next.set(p, u);
    }
    ns.sort((a, b) => cmp(a[0], b[0]));
    const list = attrs.map((a) => ({ name: a.name, uri: a.namespaceURI ?? '', local: a.localName ?? a.name, value: a.value }));
    if (top) for (const [n, v] of xmlInherited) if (!list.some((a) => a.name === n)) list.push({ name: n, uri: 'http://www.w3.org/XML/1998/namespace', local: n.slice(4), value: v });
    list.sort((a, b) => cmp(a.uri, b.uri) || cmp(a.local, b.local));
    out.push('<', e.tagName);
    for (const [p, u] of ns) out.push(' ', p ? 'xmlns:' + p : 'xmlns', '="', escAttr(u), '"');
    for (const a of list) out.push(' ', a.name, '="', escAttr(a.value), '"');
    out.push('>');
    for (let c = e.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) walk(c as Element, here, next, false);
      else if (c.nodeType === 3 || c.nodeType === 4) out.push(escText(c.nodeValue ?? ''));
      else if (c.nodeType === 7) { const pi = c as ProcessingInstruction; out.push('<?', pi.target, pi.data ? ' ' + pi.data : '', '?>'); }
      else if (c.nodeType === 8 && opts.comments) out.push('<!--', c.nodeValue ?? '', '-->');
    }
    out.push('</', e.tagName, '>');
  };
  walk(el, inScope(el), new Map(), true);
  return out.join('');
}

/** „Transformarea relațiilor” din standardul pachetelor: doar relațiile alese (după Id sau tip), ordonate după Id,
 *  cu TargetMode pus mereu, în forma canonică. */
export function relationshipTransform(relsXml: string, ids: string[], types: string[]): string {
  const doc = parseXml(relsXml);
  const rels = Array.from(doc.getElementsByTagNameNS(REL_NS, 'Relationship'))
    .filter((r) => ids.includes(r.getAttribute('Id') ?? '') || types.includes(r.getAttribute('Type') ?? ''))
    .map((r) => ({ id: r.getAttribute('Id') ?? '', target: r.getAttribute('Target') ?? '', mode: r.getAttribute('TargetMode') || 'Internal', type: r.getAttribute('Type') ?? '' }))
    .sort((a, b) => cmp(a.id, b.id));
  return `<Relationships xmlns="${REL_NS}">`
    + rels.map((r) => `<Relationship Id="${escAttr(r.id)}" Target="${escAttr(r.target)}" TargetMode="${escAttr(r.mode)}" Type="${escAttr(r.type)}"></Relationship>`).join('')
    + '</Relationships>';
}

// ---------- verificarea ----------

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML stricat');
  return doc;
}

const utf8 = (s: string) => new TextEncoder().encode(s);
const b64bytes = (s: string) => Uint8Array.from(atob(s.replace(/[^A-Za-z0-9+/=]/g, '')), (c) => c.charCodeAt(0));
const bytesB64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const kidsNS = (e: Element, local: string) => Array.from(e.childNodes).filter((c): c is Element => c.nodeType === 1 && (c as Element).localName === local && (c as Element).namespaceURI === DS);
const kid = (e: Element | undefined, local: string) => (e ? kidsNS(e, local)[0] : undefined);

async function digest(alg: string, data: Uint8Array): Promise<string> {
  return bytesB64(new Uint8Array(await globalThis.crypto.subtle.digest(alg, data as Uint8Array<ArrayBuffer>)));
}

/** Forma canonică cerută de o listă de <Transform> (pentru un element XML). */
function canonFor(el: Element, transforms: Element[]): string {
  let mode: { exclusive?: boolean; comments?: boolean; inclusive?: string[] } = {};
  for (const t of transforms) {
    const a = t.getAttribute('Algorithm') ?? '';
    if (a === EXC || a === EXC_C) {
      const inc = Array.from(t.getElementsByTagName('*')).find((x) => x.localName === 'InclusiveNamespaces')?.getAttribute('PrefixList') ?? '';
      mode = { exclusive: true, comments: a === EXC_C, inclusive: inc.split(/\s+/).filter(Boolean) };
    } else if (a === C14N || a === C14N_C) mode = { comments: a === C14N_C };
  }
  return canonicalize(el, mode);
}

/** Calea părții din URI-ul unei referințe din Manifest: „/word/document.xml?ContentType=…” → „word/document.xml”. */
function partPath(uri: string): string {
  let p = uri.split('?')[0].replace(/^[/]+/, '');
  try { p = decodeURIComponent(p); } catch { /* rămâne cum e */ }
  return p;
}

class Changed extends Error {}

/** Verifică o referință: amprenta din <DigestValue> față de ce e acum în semnătură sau în pachet. */
async function checkReference(ref: Element, doc: Document, read: PartReader): Promise<void> {
  const uri = ref.getAttribute('URI') ?? '';
  const alg = DIGEST[kid(ref, 'DigestMethod')?.getAttribute('Algorithm') ?? ''];
  if (!alg) throw new Error('Algoritmul amprentei nu e cunoscut.');
  const want = (kid(ref, 'DigestValue')?.textContent ?? '').replace(/\s+/g, '');
  const transforms = kid(ref, 'Transforms') ? kidsNS(kid(ref, 'Transforms')!, 'Transform') : [];
  let data: Uint8Array;
  if (uri.startsWith('#')) {
    const id = uri.slice(1);
    const el = Array.from(doc.getElementsByTagName('*')).find((x) => x.getAttribute('Id') === id || x.getAttribute('ID') === id || x.getAttribute('id') === id);
    if (!el) throw new Changed('Lipsește o parte semnată din semnătură.');
    data = utf8(canonFor(el, transforms));
  } else {
    const path = partPath(uri);
    const raw = await read(path);
    if (!raw) throw new Changed('Lipsește o parte semnată din document.');
    const rel = transforms.find((t) => t.getAttribute('Algorithm') === REL_T);
    if (rel) {
      const all = Array.from(rel.getElementsByTagName('*'));
      const ids = all.filter((x) => x.localName === 'RelationshipReference').map((x) => x.getAttribute('SourceId') ?? '');
      const types = all.filter((x) => x.localName === 'RelationshipsGroupReference').map((x) => x.getAttribute('SourceType') ?? '');
      data = utf8(relationshipTransform(new TextDecoder().decode(raw), ids, types));
    } else if (transforms.some((t) => [C14N, C14N_C, EXC, EXC_C].includes(t.getAttribute('Algorithm') ?? ''))) {
      data = utf8(canonFor(parseXml(new TextDecoder().decode(raw)).documentElement, transforms));
    } else data = raw;
  }
  if (await digest(alg, data) !== want) throw new Changed('Documentul s-a schimbat după semnare.');
}

/** Ora semnării din semnătură (SignatureTime din pachet sau SigningTime XAdES), în ora calculatorului. */
function signTime(doc: Document): string | undefined {
  const all = Array.from(doc.getElementsByTagName('*'));
  const v = all.find((x) => x.localName === 'SigningTime')?.textContent
    ?? all.find((x) => x.localName === 'SignatureTime')?.getElementsByTagNameNS('*', 'Value')[0]?.textContent;
  if (!v) return undefined;
  const d = new Date(v.trim());
  if (isNaN(d.getTime())) return undefined;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** XAdES SigningCertificate (dacă există): amprenta certificatului semnată odată cu documentul. */
async function certMatches(doc: Document, cert: Uint8Array): Promise<boolean> {
  const sc = Array.from(doc.getElementsByTagName('*')).find((x) => x.localName === 'SigningCertificate' || x.localName === 'SigningCertificateV2');
  if (!sc) return true;
  const digests = Array.from(sc.getElementsByTagName('*')).filter((x) => x.localName === 'CertDigest');
  for (const d of digests) {
    const alg = DIGEST[Array.from(d.getElementsByTagName('*')).find((x) => x.localName === 'DigestMethod')?.getAttribute('Algorithm') ?? ''];
    const want = (Array.from(d.getElementsByTagName('*')).find((x) => x.localName === 'DigestValue')?.textContent ?? '').replace(/\s+/g, '');
    if (alg && want === await digest(alg, cert)) return true;
  }
  return !digests.length;
}

/** Verifică o semnătură (conținutul unui _xmlsignatures/sigN.xml) față de părțile pachetului. */
export async function verifyXmlSig(xml: string, read: PartReader): Promise<XmlSigCheck> {
  const { certInfo } = await import('./pdf/signatures');
  const { verifyCertSig, checkStamp } = await import('./pdf/verifySig');
  let name = '(fără nume)';
  try {
    const doc = parseXml(xml);
    const sig = doc.documentElement;
    if (sig.localName !== 'Signature' || sig.namespaceURI !== DS) return { name, ok: null, why: 'Semnătura nu a putut fi citită (structură necunoscută).' };
    const certs = Array.from(sig.getElementsByTagNameNS(DS, 'X509Certificate')).map((c) => b64bytes(c.textContent ?? ''));
    if (certs[0]) name = certInfo(certs[0])?.name ?? name;
    const when = signTime(doc);
    const extra: Partial<XmlSigCheck> = when ? { when } : {};
    const si = kid(sig, 'SignedInfo');
    if (!si) return { name, ok: null, why: 'Semnătura nu a putut fi citită (structură necunoscută).', ...extra };
    const hash = SIGN[kid(si, 'SignatureMethod')?.getAttribute('Algorithm') ?? ''];
    if (!hash) return { name, ok: null, why: 'Algoritmul semnăturii nu e cunoscut.', ...extra };
    if (!certs.length) return { name, ok: null, why: 'Semnătura nu conține certificatul semnatarului.', ...extra };
    // Referințele din SignedInfo și, prin #idPackageObject, cele din Manifest (părțile pachetului).
    const refs = kidsNS(si, 'Reference');
    if (!refs.length) return { name, ok: null, why: 'Semnătura nu a putut fi citită (structură necunoscută).', ...extra };
    try {
      for (const r of refs) {
        await checkReference(r, doc, read);
        const target = (r.getAttribute('URI') ?? '').slice(1);
        const obj = target && Array.from(doc.getElementsByTagNameNS(DS, 'Object')).find((o) => o.getAttribute('Id') === target);
        if (obj) for (const m of kidsNS(obj, 'Manifest')) for (const mr of kidsNS(m, 'Reference')) await checkReference(mr, doc, read);
      }
    } catch (e) {
      if (e instanceof Changed) return { name, ok: false, why: e.message, ...extra };
      throw e;
    }
    const cm = kid(si, 'CanonicalizationMethod');
    const signed = utf8(canonFor(si, cm ? [cm] : []));
    const sv = kid(sig, 'SignatureValue');
    const value = b64bytes(sv?.textContent ?? '');
    // Marca temporală: jetonul RFC 3161 pentru forma canonică a lui <SignatureValue>.
    const tst = Array.from(sig.getElementsByTagName('*')).find((x) => x.localName === 'EncapsulatedTimeStamp');
    const stamp = tst && sv ? await checkStamp(b64bytes(tst.textContent ?? ''), utf8(canonicalize(sv))) : undefined;
    if (stamp) Object.assign(extra, { stamp });
    let unknown = false;
    for (const c of certs) {
      const r = await verifyCertSig(c, hash, value, signed).catch(() => ({ ok: false as boolean | null, alg: '', selfSigned: false }));
      if (r.ok === null) { unknown = true; continue; }
      if (r.ok && !(await certMatches(doc, c))) return { name: certInfo(c)?.name ?? name, ok: false, why: 'Certificatul din semnătură nu e cel ales la semnare: a fost înlocuit.', ...extra };
      if (r.ok) return { name: certInfo(c)?.name ?? name, ok: true, why: 'Semnătura e validă: documentul nu s-a schimbat după semnare.', alg: r.alg, selfSigned: r.selfSigned, ...extra };
    }
    if (unknown) return { name, ok: null, why: 'Tipul cheii din certificat nu poate fi verificat încă.', ...extra };
    return { name, ok: false, why: 'Semnătura nu se potrivește cu certificatul: a fost falsificată sau stricată.', ...extra };
  } catch {
    return { name, ok: null, why: 'Semnătura nu a putut fi citită (structură necunoscută).' };
  }
}
