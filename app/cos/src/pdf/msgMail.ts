// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// E-mailurile .msg (ce dă programul de e-mail când tragi un mesaj pe desktop sau într-un dosar): un „dosar” binar
// (Compound File, desfăcut cu CFB din SheetJS CE, Apache-2.0) cu proprietățile mesajului în fluxuri __substg1.0_<id><tip>,
// după specificația publică [MS-OXMSG]. Îl facem un .eml (MIME) cu antetul, textul HTML sau simplu, pozele din mesaj și
// atașamentele, ca ⧉ Combină și ⚙ Lot să-l citească pe aceeași cale ca un .eml (emlPage.ts).

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Pagina de cod a textului (PR_INTERNET_CPID) → numele setului de caractere din MIME. */
const CHARSETS: Record<number, string> = { 65001: 'utf-8', 1250: 'windows-1250', 1252: 'windows-1252', 28592: 'iso-8859-2', 28605: 'iso-8859-15', 20127: 'us-ascii', 1200: 'utf-16le' };

function b64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(s).replace(/.{76}/g, (m) => m + '\r\n');
}
/** Un câmp de antet: ASCII rămâne cum e, restul se scrie =?utf-8?B?…?=. */
function word(s: string): string {
  const clean = s.replace(/[\r\n]+/g, ' ').trim();
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;
  return '=?utf-8?B?' + b64(new TextEncoder().encode(clean)).replace(/\r\n/g, '') + '?=';
}
/** Numele unui fișier atașat ca parametru MIME, și cu diacritice (RFC 2231: utf-8''…). */
const pname = (s: string) => "utf-8''" + encodeURIComponent(s.replace(/[\r\n]+/g, ' '));

interface Node { props: Map<string, Uint8Array>; values: Uint8Array | null }

/** Mesajul .msg → octeții unui .eml. Aruncă o eroare dacă fișierul nu e un mesaj .msg. */
export async function msgToEml(data: Uint8Array): Promise<Uint8Array> {
  const { CFB } = await import('xlsx');
  let cfb: ReturnType<typeof CFB.read>;
  try { cfb = CFB.read(data, { type: 'array' }); } catch { throw new Error('Fișierul .msg nu se poate citi.'); }
  // Toate fluxurile, după calea lor (fără „Root Entry”).
  const streams = new Map<string, Uint8Array>();
  cfb.FullPaths.forEach((full: string, i: number) => {
    const e = cfb.FileIndex[i];
    if (e?.content && e.type === 2) streams.set(full.split('/').filter(Boolean).slice(1).join('/'), new Uint8Array(e.content as ArrayLike<number>));
  });
  return messageEml(streams, '', 0);
}

/**
 * Mesajul din „dosarul” `prefix` (gol = mesajul de sus; altfel un mesaj pus ca atașament, __substg1.0_3701000D/) → .eml.
 * `depth` = câte mesaje sunt deasupra lui (antetul fluxului de proprietăți e de 32 de octeți sus și de 24 la cele puse ca atașament).
 */
async function messageEml(streams: Map<string, Uint8Array>, prefix: string, depth: number): Promise<Uint8Array> {
  // Fluxurile, grupate pe „dosarul” lor: mesajul și fiecare atașament __attach_version1.0_#….
  const nodes = new Map<string, Node>();
  const node = (k: string) => { let n = nodes.get(k); if (!n) nodes.set(k, (n = { props: new Map(), values: null })); return n; };
  streams.forEach((bytes, full) => {
    if (!full.startsWith(prefix)) return;
    const parts = full.slice(prefix.length).split('/');
    const name = parts.pop() ?? '';
    // Doar mesajul de sus și atașamentele lui (nu destinatarii și nici mesajele puse ca atașament).
    if (parts.length > 1 || (parts.length === 1 && !/^__attach_version1\.0_#/i.test(parts[0]))) return;
    const key = parts[0] ?? '';
    const m = /^__substg1\.0_([0-9a-f]{4})([0-9a-f]{4})$/i.exec(name);
    if (m) node(key).props.set((m[1] + m[2]).toUpperCase(), bytes);
    else if (/^__properties_version1\.0$/i.test(name)) node(key).values = bytes;
  });
  const root = nodes.get('');
  if (!root || !root.props.size) throw new Error('Fișierul nu pare un mesaj .msg.');
  /** Proprietățile cu valoare fixă (număr, dată), din fluxul __properties_version1.0 (antet de 32 / 8 octeți, apoi câte 16). */
  const fixed = (n: Node, id: number, top: boolean) => {
    const v = n.values;
    if (!v) return null;
    for (let i = top ? (depth ? 24 : 32) : 8; i + 16 <= v.length; i += 16) if (u16(v, i + 2) === id) return { type: u16(v, i), at: i + 8, v };
    return null;
  };
  const cpid = (() => { const f = fixed(root, 0x3fde, true); return f && f.type === 3 ? u32(f.v, f.at) : 0; })();
  const text = (n: Node, id: string) => {
    const w = n.props.get(id + '001F');
    if (w) return new TextDecoder('utf-16le').decode(w).replace(/\0+$/, '');
    const a = n.props.get(id + '001E');
    if (!a) return '';
    let cs = CHARSETS[cpid] ?? 'windows-1252';
    try { return new TextDecoder(cs).decode(a).replace(/\0+$/, ''); } catch { cs = 'windows-1252'; return new TextDecoder(cs).decode(a).replace(/\0+$/, ''); }
  };
  const subject = text(root, '0037');
  const fromName = text(root, '0C1A') || text(root, '0042');
  const fromMail = text(root, '5D01') || text(root, '0C1F') || text(root, '0065');
  const from = fromName && fromMail && fromName !== fromMail ? `${word(fromName)} <${fromMail}>` : word(fromName || fromMail);
  const to = text(root, '0E04'), cc = text(root, '0E03');
  // Data trimiterii (PR_CLIENT_SUBMIT_TIME), altfel a primirii (PR_MESSAGE_DELIVERY_TIME): FILETIME, sute de ns din 1601.
  let date = '';
  for (const id of [0x0039, 0x0e06]) {
    const f = fixed(root, id, true);
    if (f && f.type === 0x40) {
      const ms = (u32(f.v, f.at + 4) * 2 ** 32 + u32(f.v, f.at)) / 10000 - 11644473600000;
      if (ms > 0) { date = new Date(ms).toUTCString(); break; }
    }
  }
  let html = root.props.get('10130102') ?? (root.props.get('1013001F') ? new TextEncoder().encode(text(root, '1013')) : null);
  const htmlCharset = root.props.get('10130102') ? (CHARSETS[cpid] ?? 'utf-8') : 'utf-8';
  const plain = text(root, '1000');
  // Fără HTML: textul RTF (comprimat) al mesajului, cu formatarea lui; dacă nu se poate citi, rămâne textul simplu.
  const rtfBlock = html ? null : root.props.get('10090102');
  if (rtfBlock) {
    const { decompressRtf, htmlFromRtf, isHtmlRtf } = await import('./rtfBody');
    const rtf = decompressRtf(rtfBlock);
    if (rtf?.length) {
      let h = '';
      try {
        if (isHtmlRtf(rtf)) h = htmlFromRtf(rtf);
        else { const { rtfToHtml } = await import('../docs/rtfImport'); h = `<html><body>${(await rtfToHtml(rtf)).html}</body></html>`; }
      } catch { h = ''; }
      if (h.replace(/<[^>]*>/g, '').trim()) html = new TextEncoder().encode(h);
    }
  }
  const B = '----=_suite_msg_' + Math.random().toString(36).slice(2);
  const out: string[] = [];
  out.push('MIME-Version: 1.0');
  if (from) out.push('From: ' + from);
  if (to) out.push('To: ' + word(to));
  if (cc) out.push('Cc: ' + word(cc));
  if (date) out.push('Date: ' + date);
  if (subject) out.push('Subject: ' + word(subject));
  out.push(`Content-Type: multipart/mixed; boundary="${B}"`, '');
  if (html) out.push('--' + B, `Content-Type: text/html; charset=${htmlCharset}`, 'Content-Transfer-Encoding: base64', '', b64(html));
  else out.push('--' + B, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64(new TextEncoder().encode(plain)));
  // Atașamentele, în ordinea numerelor lor; cele cu Content-ID sunt pozele din mesaj (cid:).
  for (const key of [...nodes.keys()].filter(Boolean).sort()) {
    const n = nodes.get(key)!;
    const bytes = n.props.get('37010102');
    if (!bytes) {
      // Un mesaj pus ca atașament (de exemplu redirecționat ca atașament): îl facem și pe el .eml (cel mult 3 niveluri).
      // Altfel (o legătură spre un fișier, un obiect) nu sunt octeți de pus.
      const sub = `${prefix}${key}/__substg1.0_3701000D/`;
      if (depth >= 3 || ![...streams.keys()].some((k) => k.startsWith(sub))) continue;
      let inner: Uint8Array;
      try { inner = await messageEml(streams, sub, depth + 1); } catch { continue; }
      const mname = (text(n, '3001') || 'mesaj').replace(/[<>:"/|?*]+/g, ' ').trim().slice(0, 120) + '.eml';
      out.push('--' + B, `Content-Type: message/rfc822; name*=${pname(mname)}`, 'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename*=${pname(mname)}`, '', b64(inner));
      continue;
    }
    const name = text(n, '3707') || text(n, '3704') || 'atasament';
    const type = text(n, '370E') || 'application/octet-stream';
    const cid = text(n, '3712');
    out.push('--' + B, `Content-Type: ${type.replace(/[\r\n;"]/g, '')}; name*=${pname(name)}`, 'Content-Transfer-Encoding: base64');
    if (cid) out.push(`Content-ID: <${cid.replace(/[<>\r\n]/g, '')}>`, 'Content-Disposition: inline');
    else out.push(`Content-Disposition: attachment; filename*=${pname(name)}`);
    out.push('', b64(bytes));
  }
  out.push('--' + B + '--', '');
  // Antetul e ASCII (cuvintele cu diacritice sunt codate), deci octeții se pot lua direct din coduri.
  return Uint8Array.from(out.join('\r\n'), (c) => c.charCodeAt(0) & 255);
}
