// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Lucruri comune la deschiderea fișierelor Office (.docx, .xlsx, .pptx), găsite cu testul de compatibilitate.
import JSZip from 'jszip';
import type { XmlSigCheck } from './xmlSig';
import { passwordAsker } from './passwordAsk';

/**
 * Fișierele Office protejate cu parolă nu sunt arhive ZIP, ci „containere OLE” (încep cu D0 CF 11 E0), la fel ca
 * formatele vechi .doc/.xls/.ppt. Le recunoaștem ca să spunem clar ce e, în loc de „fișier stricat”.
 */
export function oleKind(data: Uint8Array): 'encrypted' | 'legacy' | null {
  if (data.length < 8 || data[0] !== 0xd0 || data[1] !== 0xcf || data[2] !== 0x11 || data[3] !== 0xe0) return null;
  // Numele fluxului „EncryptionInfo”, scris în UTF-16 în directorul containerului.
  const name = 'EncryptionInfo';
  const max = Math.min(data.length, 2_000_000);
  outer: for (let i = 0; i + name.length * 2 <= max; i++) {
    for (let k = 0; k < name.length; k++) if (data[i + 2 * k] !== name.charCodeAt(k) || data[i + 2 * k + 1] !== 0) continue outer;
    return 'encrypted';
  }
  return 'legacy';
}

const OLD: Record<string, string> = { docx: '.doc', xlsx: '.xls', pptx: '.ppt' };

/** Arhiva unui fișier protejat cu parolă: cere parola (din nou, dacă e greșită) până se potrivește sau până renunți. */
async function openEncrypted(data: Uint8Array, kind: string): Promise<Uint8Array> {
  const { decryptOffice, WrongPassword } = await import('./officeCrypto');
  for (let wrong = false; ;) {
    const pw = await passwordAsker()!(kind, wrong);
    if (pw === null) throw new Error('Fișierul e protejat cu parolă și nu s-a deschis, pentru că n-ai scris parola.');
    try { return await decryptOffice(data, pw); } catch (e) { if (e instanceof WrongPassword) { wrong = true; continue; } throw e; }
  }
}

/** Deschide arhiva unui fișier Office sau aruncă o eroare pe înțeles (parolă, format vechi, stricat). */
export async function openOfficeZip(data: Uint8Array, kind: 'docx' | 'xlsx' | 'pptx', broken: string): Promise<JSZip> {
  const ole = oleKind(data);
  if (ole === 'encrypted' && !passwordAsker()) throw new Error('Fișierul e protejat cu parolă. Deschide-l în programul în care a fost făcut, scoate parola și salvează-l din nou.');
  if (ole === 'encrypted') {
    // Arhiva decriptată se dă mai departe rescrisă (cine citește octeții direct, ca mammoth, nu primește fișierul criptat).
    const zip = fixZipNames(await JSZip.loadAsync(await openEncrypted(data, kind)));
    rewritten.add(zip);
    return zip;
  }
  if (ole === 'legacy') throw new Error(`Fișierul e în formatul vechi ${OLD[kind]} (dinainte de 2007), pe care Cyber Office Studio nu-l deschide încă. Salvează-l ca .${kind} din programul în care a fost făcut.`);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    const saved = await salvageZip(data);
    if (!saved) throw new Error(broken);
    repaired.add(saved);
    zip = saved;
  }
  return fixZipNames(zip);
}

/**
 * Semnăturile digitale dintr-un .docx / .xlsx / .pptx (_xmlsignatures/sig*.xml), verificate (xmlSig.ts): cine a semnat
 * și dacă semnătura mai e bună. Suite nu le păstrează la salvare, deci mesajul spune și asta.
 */
export async function officeSigners(zip: JSZip): Promise<XmlSigCheck[] | undefined> {
  const files = Object.keys(zip.files).filter((n) => /^_xmlsignatures[/]sig[0-9]*[.]xml$/i.test(n));
  if (!files.length) return undefined;
  const { verifyXmlSig } = await import('./xmlSig');
  const names = Object.keys(zip.files);
  const read = async (path: string) => {
    const n = zip.file(path) ? path : names.find((x) => x.toLowerCase() === path.toLowerCase());
    return n ? (await zip.file(n)?.async('uint8array').catch(() => null)) ?? null : null;
  };
  const out: XmlSigCheck[] = [];
  for (const n of files.sort()) {
    const xml = (await zip.file(n)?.async('string').catch(() => '')) ?? '';
    out.push(await verifyXmlSig(xml, read));
  }
  return out;
}
/** Mesajul de la deschidere pentru un document semnat digital (gol dacă nu e semnat). */
export function signedNote(signers?: XmlSigCheck[]): string {
  if (!signers?.length) return '';
  const keep = 'Dacă îl salvezi din Cyber Office Studio, semnătura nu se păstrează. ';
  if (signers.length === 1) {
    const s = signers[0];
    const st = s.stamp ? (s.stamp.ok ? `⏱ Marcă temporală: ${s.stamp.time ?? '?'}, de la ${s.stamp.by ?? '?'} (verificată). ` : '⏱ Marca temporală nu se potrivește cu semnătura. ') : '';
    return (s.ok ? `Documentul e semnat digital de ${s.name}; semnătura e validă. `
      : s.ok === false ? `Documentul e semnat digital de ${s.name}, dar semnătura NU e validă: ${s.why} `
      : `Documentul e semnat digital de ${s.name}; semnătura nu a putut fi verificată: ${s.why} `) + st + keep;
  }
  const who = signers.map((s) => `${s.name} ${s.ok ? '✓' : s.ok === false ? '✗' : '?'}`).join(', ');
  return `Documentul are ${signers.length} semnături digitale (${who}). `
    + (signers.some((s) => s.ok === false) ? 'Semnăturile cu ✗ NU mai sunt valide: documentul s-a schimbat după semnare. ' : '') + keep;
}

/** Arhivele reparate de `salvageZip`; importurile spun atunci „fișierul era deteriorat și a fost reparat”. */
const repaired = new WeakSet<JSZip>();
export const isRepaired = (zip: JSZip) => repaired.has(zip);
/** Arhive reparate sau cu nume schimbate: cine le dă mai departe ca octeți (mammoth) trebuie să le rescrie. */
const rewritten = new WeakSet<JSZip>();
export const needsRewrite = (zip: JSZip) => repaired.has(zip) || rewritten.has(zip);

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;

/** Dezarhivează „deflate” fără niciun octet în plus; null dacă datele nu sunt un flux întreg. */
async function inflateRaw(raw: Uint8Array): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Reparare, ca în Word/Excel/PowerPoint: o arhivă tăiată la final (descărcare întreruptă, stick scos prea repede)
 * nu mai are „cuprinsul” de la sfârșit, dar fișierele din ea sunt încă acolo, unul după altul. Le citim pe rând
 * după antetul fiecăruia și le păstrăm doar pe cele întregi. Null dacă nu găsim niciunul.
 */
async function salvageZip(data: Uint8Array): Promise<JSZip | null> {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sig = (i: number) => (i + 4 <= data.length ? dv.getUint32(i, true) : 0);
  const out = new JSZip();
  const utf8 = new TextDecoder();
  let found = 0;
  let i = 0;
  while (i + 30 <= data.length) {
    if (sig(i) !== LOCAL) { i++; continue; }
    const flags = dv.getUint16(i + 6, true);
    const method = dv.getUint16(i + 8, true);
    const size = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const start = i + 30 + nameLen + dv.getUint16(i + 28, true);
    const name = utf8.decode(data.subarray(i + 30, i + 30 + nameLen)).replace(/\\/g, '/');
    if ((method !== 0 && method !== 8) || start > data.length) { i += 4; continue; }
    let content: Uint8Array | null = null;
    let next = start + size;
    if (!(flags & 8) && size) {
      if (next <= data.length) content = method === 0 ? data.subarray(start, next) : await inflateRaw(data.subarray(start, next));
    } else {
      // Mărimea vine abia după date („data descriptor”): datele țin până la următorul antet, minus descriptorul (12–24 de octeți).
      let j = start;
      while (j + 4 <= data.length && sig(j) !== LOCAL && sig(j) !== CENTRAL) j++;
      if (j + 4 <= data.length && method === 8) {
        for (const tail of [16, 12, 24, 20, 0]) if (j - tail >= start && (content = await inflateRaw(data.subarray(start, j - tail)))) break;
      }
      next = j;
    }
    if (content && name && !name.endsWith('/')) { out.file(name, content); found++; }
    i = Math.max(next, i + 4);
  }
  return found ? out : null;
}

/**
 * Unele programe scriu în arhivă căi cu „\” sau cu alte litere mari/mici („xl\sharedstrings.xml”). Excel și Word
 * le acceptă, deci și noi: redenumim intrările după forma obișnuită, ca să le găsească `zip.file('xl/sharedStrings.xml')`.
 */
export function fixZipNames(zip: JSZip): JSZip {
  const files = zip.files as Record<string, JSZip.JSZipObject>;
  for (const old of Object.keys(files)) {
    if (!old.includes('\\')) continue;
    const name = old.replace(/\\/g, '/');
    if (files[name]) continue;
    rewritten.add(zip);
    files[name] = files[old];
    (files[name] as { name: string }).name = name;
    delete files[old];
  }
  // Pentru literele mari/mici: `zip.file(cale)` caută și fără să țină cont de ele, dacă nu găsește exact.
  const lower = new Map(Object.keys(files).map((n) => [n.toLowerCase(), n]));
  const exact = zip.file.bind(zip) as (p: string) => JSZip.JSZipObject | null;
  (zip as unknown as { file: unknown }).file = function (this: JSZip, ...args: unknown[]) {
    if (args.length === 1 && typeof args[0] === 'string') {
      const p = args[0];
      return exact(p) ?? (lower.has(p.toLowerCase()) ? exact(lower.get(p.toLowerCase())!) : null);
    }
    return (JSZip.prototype.file as (...a: unknown[]) => unknown).apply(zip, args);
  };
  return zip;
}
