// Test pentru semnarea PDF cu un certificat din .pfx / .p12 (pfx.ts + digisign.ts importPfxId).
// Fișierele .pfx se fac aici cu openssl (o autoritate de test, un certificat RSA emis de ea, unul EC, unul cu criptare veche).
// Fără openssl testul e sărit. Rulare (în suite/): node tests/pdf-pfx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let ossl = false;
try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); ossl = true; } catch { /* lipsește */ }
if (!ossl) { console.log('(openssl lipsește: test sărit)'); process.exit(0); }

const out = join(tmpdir(), `suite-pfx-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/pdf/digisign.ts'; export { verifySignature } from './src/pdf/verifySig.ts'; export { readSignatures } from './src/pdf/signatures.ts'; export { PDFDocument } from 'pdf-lib';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + extra}`); if (!ok) fail++; };
const dir = mkdtempSync(join(tmpdir(), 'suite-pfx-'));
const o = (args) => execFileSync('openssl', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
writeFileSync(join(dir, 'ext.cnf'), ['[v3]', 'basicConstraints=CA:FALSE', 'keyUsage=critical,digitalSignature,nonRepudiation', ''].join(String.fromCharCode(10)));
o(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-subj', '/CN=Autoritate Test/O=Test', '-days', '30']);
o(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'u.key', '-out', 'u.csr', '-subj', '/CN=Maria Ionescu/O=Firma Test SRL/emailAddress=maria@exemplu.ro']);
o(['x509', '-req', '-in', 'u.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'u.pem', '-days', '30', '-extfile', 'ext.cnf', '-extensions', 'v3']);
o(['pkcs12', '-export', '-inkey', 'u.key', '-in', 'u.pem', '-certfile', 'ca.pem', '-out', 'u.pfx', '-passout', 'pass:secret1']);
o(['pkcs12', '-export', '-legacy', '-inkey', 'u.key', '-in', 'u.pem', '-out', 'old.pfx', '-passout', 'pass:secret1']);
o(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', 'e.key', '-out', 'e.pem', '-subj', '/CN=Cheie EC', '-days', '30']);
o(['pkcs12', '-export', '-inkey', 'e.key', '-in', 'e.pem', '-out', 'e.pfx', '-passout', 'pass:secret2']);

const id = await m.importPfxId(new Uint8Array(readFileSync(join(dir, 'u.pfx'))), 'secret1');
check('.pfx citit: numele, organizația și e-mailul din certificat', id.owner.name === 'Maria Ionescu' && id.owner.org === 'Firma Test SRL' && id.owner.email === 'maria@exemplu.ro', JSON.stringify(id.owner));
check('.pfx citit: certificatul semnatarului și lanțul (autoritatea)', id.chain.length === 1 && id.key.algorithm.name === 'RSASSA-PKCS1-v1_5');
let bad = '';
try { await m.importPfxId(new Uint8Array(readFileSync(join(dir, 'u.pfx'))), 'gresit'); } catch (e) { bad = e.message; }
check('parola greșită → mesaj clar', bad.includes('Parola'), bad);
let old = '';
try { await m.importPfxId(new Uint8Array(readFileSync(join(dir, 'old.pfx'))), 'secret1'); } catch (e) { old = e.message; }
check('criptarea veche (3DES / RC2) → mesaj clar', old.includes('criptarea veche'), old);
let notPfx = '';
try { await m.importPfxId(new TextEncoder().encode('nu e pfx'), 'x'); } catch (e) { notPfx = e.message; }
check('alt fișier → mesaj clar', notPfx.includes('nu e un .pfx'), notPfx);

// Păstrat cu parolă și redeschis (ca în aplicație).
const stored = await m.storeId(id, 'parola-mea');
const again = await m.openStoredId(stored, 'parola-mea');
check('ID-ul din .pfx se păstrează cu lanțul', stored.fromPfx === true && again.chain?.length === 1);

const d = await m.PDFDocument.create(); d.addPage([595, 842]).drawText('Contract');
const signed = await m.signPdf(new Uint8Array(await d.save()), again, { reason: 'Test' });
const sg = m.readSignatures(signed)[0];
const v = await m.verifySignature(signed, sg);
check('semnat cu certificatul din .pfx: valid, nu autosemnat', v.ok === true && v.selfSigned === false && sg.cert?.name === 'Maria Ionescu' && sg.cert?.issuer === 'Autoritate Test', JSON.stringify([v, sg.cert]));
// openssl verifică tot lanțul, până la autoritatea de test.
const s = Buffer.from(signed).toString('latin1');
const r = sg.range;
let hex = s.slice(r[1] + 1, r[2] - 1);
while (hex.endsWith('00')) hex = hex.slice(0, -2);
writeFileSync(join(dir, 's.der'), Buffer.from(hex, 'hex'));
writeFileSync(join(dir, 'c.bin'), Buffer.concat([Buffer.from(signed.subarray(0, r[1])), Buffer.from(signed.subarray(r[2]))]));
let chainOk = 'ok';
try { o(['cms', '-verify', '-binary', '-inform', 'DER', '-in', 's.der', '-content', 'c.bin', '-CAfile', 'ca.pem', '-purpose', 'any', '-out', 'o.bin']); } catch (e) { chainOk = String(e.stderr); }
check('openssl: semnătura și lanțul până la autoritate sunt valide', chainOk === 'ok', chainOk);

// Cheie EC (ECDSA P-256).
const ec = await m.importPfxId(new Uint8Array(readFileSync(join(dir, 'e.pfx'))), 'secret2');
check('.pfx cu cheie EC citit', ec.key.algorithm.name === 'ECDSA' && ec.owner.name === 'Cheie EC');
const es = await m.signPdf(new Uint8Array(await d.save()), ec, {});
const ev = await m.verifySignature(es, m.readSignatures(es)[0]);
check('semnat cu ECDSA P-256: valid', ev.ok === true && ev.alg === 'ECDSA P-256 · SHA-256', JSON.stringify(ev));
const es2 = Buffer.from(es).toString('latin1'), r2 = m.readSignatures(es)[0].range;
let h2 = es2.slice(r2[1] + 1, r2[2] - 1);
while (h2.endsWith('00')) h2 = h2.slice(0, -2);
writeFileSync(join(dir, 's2.der'), Buffer.from(h2, 'hex'));
writeFileSync(join(dir, 'c2.bin'), Buffer.concat([Buffer.from(es.subarray(0, r2[1])), Buffer.from(es.subarray(r2[2]))]));
let ecOk = 'ok';
try { o(['cms', '-verify', '-binary', '-inform', 'DER', '-in', 's2.der', '-content', 'c2.bin', '-noverify', '-out', 'o.bin']); } catch (e) { ecOk = String(e.stderr); }
check('openssl: semnătura ECDSA e validă', ecOk === 'ok', ecOk);

rmSync(dir, { recursive: true, force: true });
console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
