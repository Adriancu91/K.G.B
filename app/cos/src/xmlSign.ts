// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Semnarea digitală a unui .docx / .xlsx / .pptx (XML-DSig în pachet, cum îl cere standardul pachetelor OPC), scrisă de noi.
// Se semnează toate părțile pachetului (în afară de [Content_Types].xml și de semnături): părțile obișnuite după octeții lor,
// fișierele .rels după „transformarea relațiilor” (relațiile de acum, fără cea către semnături, ca să se poată adăuga
// semnături noi fără s-o strice pe asta). Semnătura e _xmlsignatures/sigN.xml, legată din _rels/.rels prin origin.sigs.
// Formele canonice se scriu direct (ce se semnează e exact ce se scrie), iar verificarea e în xmlSig.ts.
import type { DigitalId, TsaClient } from './pdf/digisign';
import { hex, kids, tlv } from './pdf/signatures';
import { relationshipTransform } from './xmlSig';

const DS = 'http://www.w3.org/2000/09/xmldsig#';
const MD = 'http://schemas.openxmlformats.org/package/2006/digital-signature';
const XD = 'http://uri.etsi.org/01903/v1.3.2#';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const REL_T = 'http://schemas.openxmlformats.org/package/2006/RelationshipTransform';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const ORIGIN_REL = 'http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/origin';
const SIG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/signature';
const ORIGIN_CT = 'application/vnd.openxmlformats-package.digital-signature-origin';
const SIG_CT = 'application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml';
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const b64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const sha = async (b: Uint8Array) => b64(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', b as Uint8Array<ArrayBuffer>)));
const utf8 = (s: string) => new TextEncoder().encode(s);

// Numele X.500 ca text (RFC 4514: ultimul element primul, „CN=…,O=…,C=RO”), pentru X509IssuerName din XAdES.
const DN_NAMES: Record<string, string> = { '550403': 'CN', '55040a': 'O', '55040b': 'OU', '550406': 'C', '550407': 'L', '550408': 'ST', '550409': 'STREET', '550405': 'SERIALNUMBER', '550461': 'organizationIdentifier', '2a864886f70d010901': 'E' };
function dnText(b: Uint8Array, name: ReturnType<typeof tlv>): string {
  const rdns = kids(b, name).map((set) => kids(b, set).map((atv) => {
    const [o, v] = kids(b, atv);
    const id = hex(b, o);
    let val: string;
    if (!DN_NAMES[id] || ![0x0c, 0x13, 0x16, 0x14, 0x1e].includes(v.tag)) return `${oidText(b.subarray(o.start, o.end))}=#${Array.from(b.subarray(v.off, v.end), (x) => x.toString(16).padStart(2, '0')).join('')}`;
    const raw = b.subarray(v.start, v.end);
    if (v.tag === 0x1e) { val = ''; for (let i = 0; i + 1 < raw.length; i += 2) val += String.fromCharCode((raw[i] << 8) | raw[i + 1]); }
    else val = new TextDecoder(v.tag === 0x0c ? 'utf-8' : 'latin1').decode(raw);
    val = val.replace(/[,+"<>;=]/g, (c) => '\\' + c).replace(/^[ #]/, (c) => '\\' + c).replace(/ $/, '\\ ');
    return `${DN_NAMES[id]}=${val}`;
  }).join('+'));
  return rdns.reverse().join(',');
}
function oidText(o: Uint8Array): string {
  const out = [Math.floor(o[0] / 40), o[0] % 40];
  let n = 0;
  for (const x of o.subarray(1)) { n = n * 128 + (x & 0x7f); if (!(x & 0x80)) { out.push(n); n = 0; } }
  return out.join('.');
}
/** Emitentul și numărul de serie (zecimal) ale certificatului. */
function issuerSerial(cert: Uint8Array): { issuer: string; serial: string } {
  const f = kids(cert, kids(cert, tlv(cert, 0))[0]);
  const i = f[0]?.tag === 0xa0 ? 1 : 0;
  return { issuer: dnText(cert, f[i + 2]), serial: BigInt('0x' + (hex(cert, f[i]) || '0')).toString() };
}

function xmlDoc(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

/** Semnează pachetul `data` cu ID-ul digital (cheia din .pfx / ID-ul Suite sau certificatul din Windows / token).
 *  `tsa` = marca temporală pe semnătură (XAdES-T): serverului i se trimite doar amprenta valorii semnăturii. */
export async function signOfficePackage(data: Uint8Array, id: DigitalId, when = new Date(), o: { tsa?: TsaClient } = {}): Promise<Uint8Array> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(data);
  const ctXml = await zip.file('[Content_Types].xml')?.async('string');
  if (!ctXml || !zip.file('_rels/.rels')) throw new Error('Fișierul nu e un document .docx / .xlsx / .pptx.');
  const ct = xmlDoc(ctXml);
  const defaults = new Map(Array.from(ct.getElementsByTagName('Default')).map((d) => [(d.getAttribute('Extension') ?? '').toLowerCase(), d.getAttribute('ContentType') ?? '']));
  const overrides = new Map(Array.from(ct.getElementsByTagName('Override')).map((d) => [(d.getAttribute('PartName') ?? '').toLowerCase(), d.getAttribute('ContentType') ?? '']));
  const typeOf = (n: string) => overrides.get('/' + n.toLowerCase()) ?? defaults.get(n.split('.').pop()!.toLowerCase()) ?? 'application/octet-stream';

  // Referințele către părțile pachetului.
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && n !== '[Content_Types].xml' && !/^_xmlsignatures[/]/i.test(n)).sort();
  const refs: string[] = [];
  for (const n of names) {
    const uri = esc('/' + n.split('/').map(encodeURIComponent).join('/') + '?ContentType=' + typeOf(n));
    const bytes = await zip.file(n)!.async('uint8array');
    if (/[.]rels$/i.test(n)) {
      const text = new TextDecoder().decode(bytes);
      const ids = Array.from(xmlDoc(text).getElementsByTagNameNS(RELS_NS, 'Relationship'))
        .filter((r) => r.getAttribute('Type') !== ORIGIN_REL).map((r) => r.getAttribute('Id') ?? '').filter(Boolean);
      if (!ids.length) continue;
      const sel = ids.map((i) => `<mdssi:RelationshipReference xmlns:mdssi="${MD}" SourceId="${esc(i)}"></mdssi:RelationshipReference>`).join('');
      refs.push(`<Reference URI="${uri}"><Transforms><Transform Algorithm="${REL_T}">${sel}</Transform><Transform Algorithm="${C14N}"></Transform></Transforms>`
        + `<DigestMethod Algorithm="${SHA256}"></DigestMethod><DigestValue>${await sha(utf8(relationshipTransform(text, ids, [])))}</DigestValue></Reference>`);
    } else refs.push(`<Reference URI="${uri}"><DigestMethod Algorithm="${SHA256}"></DigestMethod><DigestValue>${await sha(bytes)}</DigestValue></Reference>`);
  }

  const time = when.toISOString().replace(/[.][0-9]+Z$/, 'Z');
  // Obiectele semnate, în forma canonică (cu spațiul de nume moștenit de la <Signature> scris pe ele).
  const objBody = `<Manifest>${refs.join('')}</Manifest><SignatureProperties><SignatureProperty Id="idSignatureTime" Target="#idPackageSignature">`
    + `<mdssi:SignatureTime xmlns:mdssi="${MD}"><mdssi:Format>YYYY-MM-DDThh:mm:ssTZD</mdssi:Format><mdssi:Value>${time}</mdssi:Value></mdssi:SignatureTime></SignatureProperty></SignatureProperties>`;
  const objC = `<Object xmlns="${DS}" Id="idPackageObject">${objBody}</Object>`;
  // XAdES: ora și certificatul semnatarului (amprenta lui, emitentul și numărul de serie), semnate odată cu documentul.
  const is = issuerSerial(id.cert);
  const txt = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const spBody = `<xd:SignedSignatureProperties><xd:SigningTime>${time}</xd:SigningTime><xd:SigningCertificate><xd:Cert><xd:CertDigest>`
    + `<DigestMethod Algorithm="${SHA256}"></DigestMethod><DigestValue>${await sha(id.cert)}</DigestValue></xd:CertDigest>`
    + `<xd:IssuerSerial><X509IssuerName>${txt(is.issuer)}</X509IssuerName><X509SerialNumber>${is.serial}</X509SerialNumber></xd:IssuerSerial></xd:Cert></xd:SigningCertificate></xd:SignedSignatureProperties>`;
  const spC = `<xd:SignedProperties xmlns="${DS}" xmlns:xd="${XD}" Id="idSignedProperties">${spBody}</xd:SignedProperties>`;
  const ec = id.signer ? !!id.ec : id.key?.algorithm.name === 'ECDSA';
  const sigAlg = ec ? 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256' : 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  const siBody = `<CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod><SignatureMethod Algorithm="${sigAlg}"></SignatureMethod>`
    + `<Reference Type="http://www.w3.org/2000/09/xmldsig#Object" URI="#idPackageObject"><DigestMethod Algorithm="${SHA256}"></DigestMethod><DigestValue>${await sha(utf8(objC))}</DigestValue></Reference>`
    + `<Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#idSignedProperties"><Transforms><Transform Algorithm="${C14N}"></Transform></Transforms><DigestMethod Algorithm="${SHA256}"></DigestMethod><DigestValue>${await sha(utf8(spC))}</DigestValue></Reference>`;
  const siC = utf8(`<SignedInfo xmlns="${DS}">${siBody}</SignedInfo>`);
  const value = id.signer ? await id.signer(siC)
    : new Uint8Array(await globalThis.crypto.subtle.sign(ec ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5', id.key!, siC as Uint8Array<ArrayBuffer>));
  let unsigned = '';
  if (o.tsa) {
    const { timeStamp } = await import('./pdf/digisign');
    const token = await timeStamp(o.tsa, utf8(`<SignatureValue xmlns="${DS}">${b64(value)}</SignatureValue>`));
    unsigned = `<xd:UnsignedProperties><xd:UnsignedSignatureProperties><xd:SignatureTimeStamp><CanonicalizationMethod Algorithm="${C14N}"/>`
      + `<xd:EncapsulatedTimeStamp>${b64(token)}</xd:EncapsulatedTimeStamp></xd:SignatureTimeStamp></xd:UnsignedSignatureProperties></xd:UnsignedProperties>`;
  }
  const certs = [id.cert, ...(id.chain ?? [])].map((c) => `<X509Certificate>${b64(c)}</X509Certificate>`).join('');
  const sigXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Signature xmlns="${DS}" Id="idPackageSignature"><SignedInfo>${siBody}</SignedInfo>`
    + `<SignatureValue>${b64(value)}</SignatureValue><KeyInfo><X509Data>${certs}</X509Data></KeyInfo>`
    + `<Object Id="idPackageObject">${objBody}</Object>`
    + `<Object><xd:QualifyingProperties xmlns:xd="${XD}" Target="#idPackageSignature"><xd:SignedProperties Id="idSignedProperties">${spBody}</xd:SignedProperties>${unsigned}</xd:QualifyingProperties></Object></Signature>`;

  // Locul semnăturii în pachet: sigN.xml, legat din origin.sigs, iar origin.sigs din _rels/.rels.
  const taken = Object.keys(zip.files).map((n) => /^_xmlsignatures[/]sig([0-9]+)[.]xml$/i.exec(n)?.[1]).filter(Boolean).map(Number);
  const num = taken.length ? Math.max(...taken) + 1 : 1;
  const sigName = `sig${num}.xml`;
  zip.file(`_xmlsignatures/${sigName}`, sigXml);
  if (!zip.file('_xmlsignatures/origin.sigs')) zip.file('_xmlsignatures/origin.sigs', '');
  const oRels = '_xmlsignatures/_rels/origin.sigs.rels';
  const oText = (await zip.file(oRels)?.async('string')) ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="${RELS_NS}"></Relationships>`;
  const freeId = (text: string, base: string) => { let i = 1; while (text.includes(`Id="${base}${i}"`)) i++; return `${base}${i}`; };
  zip.file(oRels, oText.replace(/<[/]Relationships>|<Relationships([^>]*)[/]>/, (_m, a) => `${a !== undefined ? `<Relationships${a}>` : ''}<Relationship Id="${freeId(oText, 'rId')}" Type="${SIG_REL}" Target="${sigName}"/></Relationships>`));
  const rels = await zip.file('_rels/.rels')!.async('string');
  if (!rels.includes(ORIGIN_REL)) zip.file('_rels/.rels', rels.replace('</Relationships>', `<Relationship Id="${freeId(rels, 'rIdSig')}" Type="${ORIGIN_REL}" Target="_xmlsignatures/origin.sigs"/></Relationships>`));
  let types = ctXml;
  if (!defaults.has('sigs')) types = types.replace('</Types>', `<Default Extension="sigs" ContentType="${ORIGIN_CT}"/></Types>`);
  types = types.replace('</Types>', `<Override PartName="/_xmlsignatures/${sigName}" ContentType="${SIG_CT}"/></Types>`);
  zip.file('[Content_Types].xml', types);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
