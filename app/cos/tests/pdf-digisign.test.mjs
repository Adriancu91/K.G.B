// Test pentru PDF → semnătura digitală cu certificat: ID digital autosemnat, semnarea PDF-ului (CMS detached) și verificarea
// independentă a semnăturii (certificatul citit de Node, amprenta din /ByteRange, openssl dacă există).
// Rulare (în suite/): node tests/pdf-digisign.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';

const out = join(tmpdir(), `suite-digisign-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/pdf/digisign.ts'; export { readSignatures } from './src/pdf/signatures.ts'; export { emptySigFields, addSigField } from './src/pdf/sign.ts'; export { PDFDocument as Doc } from 'pdf-lib';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + extra}`); if (!ok) fail++; };

// 1) ID digital
const id = await m.createDigitalId({ name: 'Ana Popescu', org: 'Firma Mea SRL', email: 'ana@exemplu.ro' }, 5);
const x = new crypto.X509Certificate(Buffer.from(id.cert));
check('certificatul se citește de un cititor independent (Node X509)', x.subject.includes('CN=Ana Popescu') && x.subject.includes('O=Firma Mea SRL'), x.subject);
check('autosemnat: emitentul = subiectul și semnătura certificatului e bună', x.issuer === x.subject && x.verify(x.publicKey));
const years = (new Date(x.validTo) - new Date(x.validFrom)) / (365.25 * 864e5);
check('valabil 5 ani', Math.abs(years - 5) < 0.01, String(years));
check('cheie RSA 2048', x.publicKey.asymmetricKeyDetails?.modulusLength === 2048);
check('nume cu diacritice în certificat', new crypto.X509Certificate(Buffer.from((await m.createDigitalId({ name: 'Ștefan Țurcanu' })).cert)).subject.includes('Ștefan'));
let noName = '';
try { await m.createDigitalId({ name: '  ' }); } catch (e) { noName = e.message; }
check('fără nume → mesaj clar', noName.includes('numele'), noName);

// 2) Cheia criptată cu parola
const locked = await m.lockKey(id.pkcs8, 'parola mea');
const key2 = await m.unlockKey(locked, 'parola mea');
check('cheia se deschide cu parola bună', key2.type === 'private');
let bad = '';
try { await m.unlockKey(locked, 'alta'); } catch (e) { bad = e.message; }
check('parola greșită → mesaj clar', bad.includes('Parola'), bad);
check('cheia criptată nu conține cheia privată la vedere', !JSON.stringify(locked).includes(Buffer.from(id.pkcs8).toString('base64').slice(40, 80)));

// 3) Semnarea unui PDF
const src = await PDFDocument.create();
src.addPage([595, 842]).drawText('Contract de test');
src.addPage([595, 842]);
const bytes = await src.save();
const signed = await m.signPdf(new Uint8Array(bytes), { ...id, key: key2 }, { reason: 'Sunt de acord', location: 'Cluj-Napoca', when: new Date('2026-10-21T08:00:00Z') });

function parts(pdf, label) {
  const s = Buffer.from(pdf).toString('latin1');
  const i = s.lastIndexOf('/ByteRange');
  const r = s.slice(s.indexOf('[', i) + 1, s.indexOf(']', i)).trim().split(/[^0-9]+/).map(Number);
  check(`${label}: /ByteRange acoperă tot fișierul în afară de /Contents`, r[0] === 0 && r[2] + r[3] === pdf.length && s[r[1]] === '<' && s[r[2] - 1] === '>', r.join(' '));
  let hex = s.slice(r[1] + 1, r[2] - 1);
  while (hex.endsWith('00')) hex = hex.slice(0, -2);
  const cms = Buffer.from(hex, 'hex');
  const content = Buffer.concat([Buffer.from(pdf.subarray(0, r[1])), Buffer.from(pdf.subarray(r[2]))]);
  return { cms, content };
}
const { cms, content } = parts(signed, 'semnat');
const digest = crypto.createHash('sha256').update(content).digest();
check('amprenta SHA-256 a octeților semnați se află în semnătură (messageDigest)', cms.includes(digest));
const sigs = m.readSignatures(signed);
check('panoul Semnături o vede: o semnătură, semnatarul și organizația din certificat', sigs.length === 1 && sigs[0].cert?.name === 'Ana Popescu' && sigs[0].cert?.org === 'Firma Mea SRL', JSON.stringify(sigs[0]));
check('motivul, locul și data', sigs[0].reason === 'Sunt de acord' && sigs[0].location === 'Cluj-Napoca' && (sigs[0].date ?? '').startsWith('2026-10-21'), JSON.stringify(sigs[0]));
check('fișierul nu s-a schimbat după semnare, /ByteRange bun', sigs[0].after === 0 && sigs[0].rangeOk && sigs[0].subFilter === 'adbe.pkcs7.detached', JSON.stringify(sigs[0]));
const re = await PDFDocument.load(signed);
check('PDF-ul semnat se deschide, 2 pagini, are câmp de semnătură', re.getPageCount() === 2 && re.getForm().getFields().some((f) => f.constructor.name === 'PDFSignature'));

// 4) Verificare completă cu openssl (dacă există pe calculator)
let ossl = '';
try { ossl = execFileSync('openssl', ['version'], { encoding: 'utf8' }); } catch { /* lipsește */ }
if (ossl) {
  const dir = mkdtempSync(join(tmpdir(), 'suite-sig-'));
  const run = () => execFileSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', join(dir, 'sig.der'), '-content', join(dir, 'content.bin'), '-noverify', '-out', join(dir, 'o.bin')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  writeFileSync(join(dir, 'sig.der'), cms); writeFileSync(join(dir, 'content.bin'), content);
  let res = 'ok';
  try { run(); } catch (e) { res = String(e.stderr || e.message); }
  check('openssl: semnătura CMS e validă', res === 'ok', res);
  const bad2 = Buffer.from(content); bad2[100] ^= 1; writeFileSync(join(dir, 'content.bin'), bad2);
  let rej = false;
  try { run(); } catch { rej = true; }
  check('openssl: după o modificare de un octet semnătura e respinsă', rej);
  rmSync(dir, { recursive: true, force: true });
} else console.log('(openssl lipsește: verificarea completă sărită)');

// 5) Semnarea într-un câmp de semnătură gol, cu aspect vizibil
const d2 = await m.Doc.create();
const p2 = d2.addPage([595, 842]);
m.addSigField(d2, p2, { x: 50, y: 50, width: 200, height: 60 }, 'Client');
const withField = new Uint8Array(await d2.save());
check('înainte: un câmp gol', (await m.emptySigFields(withField)).length === 1);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const s2 = await m.signPdf(withField, id, { field: 'Client', appearance: new Uint8Array(png) });
check('după: câmpul nu mai e gol, e semnat', (await m.emptySigFields(s2)).length === 0 && m.readSignatures(s2).length === 1);
parts(s2, 'în câmp');
let twice = '';
try { await m.signPdf(s2, id, { field: 'Client' }); } catch (e) { twice = e.message; }
check('a doua oară în același câmp → mesaj clar', twice.includes('deja semnat'), twice);
let none = '';
try { await m.signPdf(withField, id, { field: 'Lipsă' }); } catch (e) { none = e.message; }
check('câmp inexistent → mesaj clar', none.includes('nu există'), none);

// 6) Certificarea documentului (DocMDP)
const cert = await m.signPdf(new Uint8Array(bytes), id, { certify: 2, reason: 'Autor' });
const cs = m.readSignatures(cert);
check('certificare: panoul o vede ca „certificat”, cu formular și semnături permise', cs.length === 1 && cs[0].kind === 'certify' && cs[0].perm === 2, JSON.stringify(cs[0]));
const cdoc = await m.Doc.load(cert);
check('certificare: /Perms /DocMDP în catalog', !!cdoc.catalog.get(cdoc.context.obj('Perms')));
const c1 = m.readSignatures(await m.signPdf(new Uint8Array(bytes), id, { certify: 1 }))[0];
check('certificare fără nicio modificare permisă (P 1)', c1.kind === 'certify' && c1.perm === 1, JSON.stringify(c1));
let again = '';
try { await m.signPdf(cert, id, { certify: 2 }); } catch (e) { again = e.message; }
check('a doua certificare → mesaj clar', again.includes('deja certificat'), again);
const after = m.readSignatures(await m.signPdf(cert, id, {}));
check('după certificare se mai poate semna obișnuit', after.length >= 1 && after.some((g) => g.kind === 'sign'), JSON.stringify(after.map((g) => g.kind)));

console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
