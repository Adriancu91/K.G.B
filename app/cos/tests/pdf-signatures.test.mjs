// Test: panoul Semnături din PDF: citirea semnăturii (nume, dată, motiv, loc, format), certificatul semnatarului din PKCS #7
// (și cu lungimi nedefinite BER), starea „nemodificat / s-a adăugat ceva după / rescris”, șirurile PDF și corpusul.
// Rulare (în suite/): node tests/pdf-signatures.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-pdfsig-${process.pid}`);
await build({ entryPoints: ['src/pdf/signatures.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readSignatures, pdfString, pdfDate } = await import(pathToFileURL(join(dir, 'signatures.js')).href);
rmSync(dir, { recursive: true, force: true });

// DER mic: tag + lungime + conținut.
const B = String.fromCharCode(92);
const der = (tag, ...kids) => {
  const body = Buffer.concat(kids.map((k) => (Buffer.isBuffer(k) ? k : Buffer.from(k))));
  const n = body.length;
  const len = n < 128 ? Buffer.from([n]) : n < 256 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 255]);
  return Buffer.concat([Buffer.from([tag]), len, body]);
};
const oid = (hex) => der(0x06, Buffer.from(hex, 'hex'));
const name = (cn, o) => der(0x30, ...(o ? [der(0x31, der(0x30, oid('55040a'), der(0x0c, Buffer.from(o, 'utf8'))))] : []), der(0x31, der(0x30, oid('550403'), der(0x0c, Buffer.from(cn, 'utf8')))));
const cert = (subj, iss, o) => der(0x30, der(0x30,
  der(0xa0, der(0x02, [2])), der(0x02, [1]), der(0x30, oid('2a864886f70d01010b')), name(iss), der(0x30, der(0x17, Buffer.from('240131120000Z')), der(0x18, Buffer.from('20300131120000Z'))), name(subj, o)));
const p7 = der(0x30, oid('2a864886f70d010702'), der(0xa0, der(0x30, der(0x02, [1]), der(0x31), der(0x30, oid('2a864886f70d010701')),
  der(0xa0, cert('Autoritatea Test', 'Rădăcina Test'), cert('Ion Popescu', 'Autoritatea Test', 'Firma Mea SRL')))));

// Un PDF mic semnat: /Contents (hex, cu zerouri la coadă) între octeții b și c din /ByteRange.
const makeSigned = (extra = '') => {
  const hex = p7.toString('hex').toUpperCase().padEnd(8192, '0');
  const head = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n5 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /Name (Ion Popescu) /M (D:20240513140210+03\'00\') /Reason <FEFF004100700072006F0062006100740020> /Location (Bucure' + B + 'billegal ' + B + '(sediu' + B + ')) /ByteRange [0 BBBBBBBBBB CCCCCCCCCC DDDDDDDDDD] /Contents ';
  const tail = '>\n>>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n';
  const b = head.length;
  const c = b + 1 + hex.length + 1;
  const total = c + tail.length - 1;
  const pad = (n) => String(n).padEnd(10, ' ');
  const h2 = head.replace('BBBBBBBBBB', pad(b)).replace('CCCCCCCCCC', pad(c)).replace('DDDDDDDDDD', pad(total - c));
  return Buffer.from(h2 + '<' + hex + tail.slice(0, -1) + '\n' + extra, 'latin1');
};
const f1 = makeSigned();
const [s] = readSignatures(new Uint8Array(f1));
assert.equal(s.kind, 'sign');
assert.equal(s.name, 'Ion Popescu');
assert.equal(s.date, '2024-05-13 14:02', 'data din /M');
assert.equal(s.reason, 'Aprobat ', 'motivul în UTF-16');
assert.equal(s.location, 'Bucure' + String.fromCharCode(8) + 'illegal (sediu)', 'șirul literal cu backspace și paranteze');
assert.equal(s.subFilter, 'ETSI.CAdES.detached');
assert.deepEqual(s.cert, { name: 'Ion Popescu', org: 'Firma Mea SRL', issuer: 'Autoritatea Test', from: '2024-01-31', to: '2030-01-31' }, 'certificatul semnatarului (nu al autorității)');
assert.equal(s.rangeOk, true);
assert.equal(s.after, 0, 'semnătura acoperă tot fișierul');
// Modificare adăugată după semnare (o actualizare la coadă).
const [s2] = readSignatures(new Uint8Array(makeSigned('3 0 obj\n<< /Annot 1 >>\nendobj\n%%EOF\n')));
assert.ok(s2.after > 20 && s2.rangeOk, 'după semnare s-au adăugat octeți: ' + s2.after);
// Fișier rescris (octeții mutați): ByteRange nu mai cade pe /Contents.
const moved = Buffer.concat([Buffer.from('%PDF-1.7\n% rescris\n'), f1.subarray(9)]);
assert.equal(readSignatures(new Uint8Array(moved))[0].rangeOk, false, 'rescris: semnătura nu mai acoperă fișierul');
assert.deepEqual(readSignatures(new Uint8Array(Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n'))), [], 'fără semnături');
assert.equal(pdfString('(a' + B + '051b' + B + B + 'c)'), 'a)b' + B + 'c', 'octal și backslash');
assert.equal(pdfDate("D:2023"), '2023-01-01');

// Corpusul: formularele semnate (drepturi de folosire), cu certificatul citit (PKCS #7 cu lungimi nedefinite).
const corp = join('..', 'test-corpus', 'pdf', '160F-2019.pdf');
if (existsSync(corp)) {
  const [g] = readSignatures(new Uint8Array(readFileSync(corp)));
  assert.equal(g.kind, 'rights');
  assert.ok(g.cert?.name && g.cert.issuer && g.after === 0 && g.rangeOk, JSON.stringify(g));
}
console.log('semnăturile PDF: toate verificările trec');
