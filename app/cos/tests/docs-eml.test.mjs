// Test pentru Docs → Îmbinare → „✉ Câte un e-mail (.eml) pentru fiecare rând”: coloana cu adrese găsită singură, subiectul cu
// câmpuri, antetele cu diacritice (RFC 2047), textul și HTML-ul completate, în base64, rândurile fără adresă sărite.
// Rulare (în suite/): node tests/docs-eml.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-eml-${process.pid}.mjs`);
await build({ entryPoints: [join(process.cwd(), 'src/docs/eml.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { emailColumn, isEmail, encodeHeader, buildEml, fillSubject, mergeEml, base64Lines, attachName } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GRESIT: ') + m); if (!c) bad++; };
const CRLF = String.fromCharCode(13, 10);
const unB64 = (s) => Buffer.from(s.split(CRLF).join(''), 'base64').toString('utf8');
const decodeHeader = (h) => h.split(CRLF + ' ').map((w) => { const m = /^=\?UTF-8\?B\?(.*)\?=$/.exec(w); return m ? Buffer.from(m[1], 'base64').toString('utf8') : w; }).join('');

const data = { source: 't', headers: ['Nume', 'Oraș', 'Contact', 'Sumă'], rows: [
  ['Ion Popescu', 'Brașov', 'ion@exemplu.ro', '120'],
  ['Ana Ștefănescu', 'Iași', 'ana.s@firma.com', '75,50'],
  ['Fără adresă', 'Cluj', '-', '0'],
] };
ok(emailColumn(data) === 2, 'coloana cu adrese găsită după „@” (Contact)');
ok(emailColumn({ ...data, headers: ['Nume', 'E-mail', 'Contact', 'Sumă'] }) === 1, 'coloana găsită după nume (E-mail)');
ok(emailColumn({ source: 't', headers: ['A'], rows: [['x']] }) === -1, 'fără adrese → -1');
ok(isEmail('a.b@c.ro') && !isEmail('ab@c') && !isEmail('a b@c.ro') && !isEmail('a@b.ro' + CRLF + 'Bcc: x@y.ro'), 'adresele bune și cele rele (și un rând nou ascuns)');

ok(encodeHeader('Factura 12') === 'Factura 12', 'subiectul fără diacritice rămâne cum e');
const longRo = 'Înștiințare de plată pentru luna octombrie, Ștefănescu Ana — sumă de achitat';
const eh = encodeHeader(longRo);
ok(eh.startsWith('=?UTF-8?B?') && eh.split(CRLF + ' ').length > 1 && eh.split(CRLF).every((l) => l.length <= 76), 'subiectul cu diacritice: cuvinte codate, rânduri scurte');
ok(decodeHeader(eh) === longRo, 'subiectul cu diacritice se citește înapoi la fel');
ok(base64Lines(new Uint8Array(200)).split(CRLF).every((l) => l.length <= 76), 'base64 pe rânduri de 76');

ok(fillSubject('Factura pentru «Nume» din «Oraș»', data, 1) === 'Factura pentru Ana Ștefănescu din Iași', 'subiectul cu câmpuri completate');
const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Bună ziua, ' }, { type: 'text', text: '«Nume»', marks: [{ type: 'bold' }] }, { type: 'text', text: ',' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Aveți de plată «Sumă» lei.' }] },
] };
const eml = await mergeEml(doc, data, 1, 2, 'Plata «Nume»');
ok(!!eml, 'mesajul pentru rândul 2 se face');
const head = eml.split(CRLF + CRLF)[0];
ok(/^To: ana\.s@firma\.com$/m.test(head) && /^X-Unsent: 1$/m.test(head) && /^MIME-Version: 1\.0$/m.test(head), 'antetele: To, X-Unsent (mesaj de trimis), MIME');
const subj = /^Subject: ([\s\S]*?)\r\nX-Unsent/m.exec(head)?.[1];
ok(decodeHeader(subj ?? '') === 'Plata Ana Ștefănescu', 'Subject completat: ' + decodeHeader(subj ?? ''));
const parts = [...eml.matchAll(/Content-Type: (text\/\w+); charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/g)];
ok(parts.length === 2 && parts[0][1] === 'text/plain' && parts[1][1] === 'text/html', 'două părți: text simplu și HTML');
const text = unB64(parts[0]?.[2] ?? ''), html = unB64(parts[1]?.[2] ?? '');
ok(text.includes('Bună ziua, Ana Ștefănescu,') && text.includes('Aveți de plată 75,50 lei.'), 'textul simplu completat');
ok(html.includes('<strong>Ana Ștefănescu</strong>') && html.includes('<meta charset="utf-8">') && !html.includes('«'), 'HTML-ul completat, cu aldinul');
ok(eml.split(CRLF).every((l) => l.length <= 998) && !/[^\r]\n/.test(eml), 'rânduri CRLF, niciunul prea lung');
ok(eml.trimEnd().endsWith('--'), 'mesajul se încheie cu granița de final');
ok((await mergeEml(doc, data, 2, 2, 'x')) === null, 'rândul fără adresă bună e sărit');
// Exemplarul atașat la mesaj (PDF / .docx): făcut din documentul completat, doar pentru rândurile cu adresă.
const seen = [];
const mk = async (filled) => { seen.push(JSON.stringify(filled)); return { name: 'Ana.pdf', type: 'application/pdf', data: new Uint8Array([37, 80, 68, 70]) }; };
const withPdf = await mergeEml(doc, data, 1, 2, 'Plata', mk);
ok(withPdf.split(CRLF + CRLF)[0].includes('Content-Type: multipart/mixed;') && withPdf.includes('Content-Type: application/pdf') && withPdf.includes('filename="Ana.pdf"'), 'exemplarul atașat ca PDF');
ok(seen.length === 1 && seen[0].includes('Ana Ștefănescu') && !seen[0].includes('«'), 'atașamentul e făcut din documentul completat');
await mergeEml(doc, data, 2, 2, 'x', mk);
ok(seen.length === 1, 'pentru rândul fără adresă nu se face atașament');
ok(buildEml({ to: 'a@b.ro' + CRLF + 'Bcc: x@y.ro', subject: 's', text: '', html: '' }).split(CRLF).filter((l) => l.startsWith('Bcc')).length === 0, 'adresa cu rând nou nu poate adăuga antete');

// Mesajul cu un fișier atașat (Trimite prin e-mail): multipart/mixed, fără destinatar, numele cu diacritice.
const bytes = new Uint8Array([80, 75, 3, 4, 1, 2, 3, 250, 0]);
const att = buildEml({ to: '', subject: 'Ofertă', text: 'x', html: '<p>x</p>', attachments: [{ name: 'Ofertă preț.docx', type: 'application/octet-stream', data: bytes }] }, 'B');
const ah = att.split(CRLF + CRLF)[0];
ok(!/^To:/m.test(ah) && /^Content-Type: multipart\/mixed; boundary="B"$/m.test(ah), 'cu atașament: multipart/mixed, fără To');
ok(att.includes('--B' + CRLF + 'Content-Type: multipart/alternative; boundary="B-alt"') && att.includes('--B-alt--') && att.trimEnd().endsWith('--B--'), 'textul ca parte alternativă în interior, granițele închise');
const ap = /Content-Disposition: attachment; ([^\r]*)\r\n\r\n([\s\S]*?)\r\n--B--/.exec(att);
ok(ap && Buffer.from(ap[2].split(CRLF).join(''), 'base64').equals(Buffer.from(bytes)), 'octeții atașamentului se citesc înapoi la fel');
ok(attachName('Ofertă preț.docx') === `filename="Oferta pret.docx"; filename*=UTF-8''Ofert%C4%83%20pre%C8%9B.docx`, 'numele cu diacritice: ' + attachName('Ofertă preț.docx'));
ok(attachName('a "b".docx') === `filename="a 'b'.docx"`, 'ghilimelele din nume nu strică antetul');

// Pozele din textul mesajului (Notițe): HTML + poze ca multipart/related, pagina întreagă rămâne cum e.
const rel = buildEml({ to: '', subject: 'N', text: 't', html: '<!DOCTYPE html><html><body><img src="cid:p1@suite"></body></html>', inline: [{ cid: 'p1@suite', type: 'image/png', data: bytes }] }, 'R');
ok(/^Content-Type: multipart\/alternative; boundary="R"$/m.test(rel.split(CRLF + CRLF)[0]) && rel.includes('Content-Type: multipart/related; type="text/html"; boundary="R-rel"'), 'cu poze în text: multipart/alternative cu o parte related');
ok(rel.includes('Content-ID: <p1@suite>') && rel.includes('--R-rel--') && rel.trimEnd().endsWith('--R--'), 'poza are Content-ID, granițele închise');
const relHtml = /boundary="R-rel"\r\n\r\n--R-rel\r\nContent-Type: text\/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/.exec(rel)?.[1];
ok(relHtml && unB64(relHtml).startsWith('<!DOCTYPE html><html><body><img'), 'pagina întreagă nu e învelită a doua oară');

console.log(bad ? `${bad} GRESITE` : 'TOATE BUNE');
process.exit(bad ? 1 : 0);
