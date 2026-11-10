// Test pentru panoul 🖋: verificarea criptografică a semnăturilor din PDF (verifySig.ts).
// Semnăturile noastre, una stricată, una ECDSA făcută de openssl (dacă există) și semnăturile reale din corpus (formulare ANAF, IRS).
// Rulare (în suite/): node tests/pdf-verifysig.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readFileSync, readdirSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = join(tmpdir(), `suite-verifysig-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/pdf/verifySig.ts'; export { readSignatures } from './src/pdf/signatures.ts'; export { createDigitalId, signPdf, SIG_SPACE } from './src/pdf/digisign.ts'; export { PDFDocument } from 'pdf-lib';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + extra}`); if (!ok) fail++; };
const verify1 = async (pdf) => m.verifySignature(pdf, m.readSignatures(pdf)[0]);

const id = await m.createDigitalId({ name: 'Ana Popescu' });
const d = await m.PDFDocument.create(); d.addPage([595, 842]).drawText('Contract');
const signed = await m.signPdf(new Uint8Array(await d.save()), id, { reason: 'Test' });
const v1 = await verify1(signed);
check('semnătura noastră: validă, autosemnată, RSA 2048 · SHA-256', v1.ok === true && v1.selfSigned === true && v1.alg === 'RSA 2048 · SHA-256', JSON.stringify(v1));

// Un octet schimbat în conținutul semnat (în afara lui /Contents) → amprenta nu se mai potrivește.
const s = Buffer.from(signed).toString('latin1');
const bad = signed.slice(); const pos = s.indexOf('/MediaBox'); bad[pos + 1] = 'm'.charCodeAt(0);
const v2 = await verify1(bad);
check('un octet schimbat → nevalidă, „s-a schimbat după semnare”', v2.ok === false && v2.why.includes('schimbat'), JSON.stringify(v2));
// Semnătura stricată (un octet din valoarea RSA) → nu se potrivește cu certificatul.
const r = m.readSignatures(signed)[0].range;
const hx = s.slice(r[1] + 1, r[2] - 1).replace(/(00)+$/, '');
const forged = signed.slice();
const p = r[1] + 1 + hx.length - 10; forged[p] = forged[p] === 0x61 ? 0x62 : 0x61;
const v3 = await verify1(forged);
check('semnătura modificată → nevalidă, „nu se potrivește cu certificatul”', v3.ok === false && v3.why.includes('certificatul'), JSON.stringify(v3));
// Format pe care nu-l putem verifica.
const v4 = await m.verifySignature(signed, { ...m.readSignatures(signed)[0], subFilter: 'adbe.x509.rsa_sha1' });
check('adbe.x509.rsa_sha1 → „nu poate fi verificat încă” (null)', v4.ok === null, JSON.stringify(v4));
const v5 = await m.verifySignature(signed, { ...m.readSignatures(signed)[0], range: undefined });
check('/ByteRange stricat → nevalidă', v5.ok === false);

// ECDSA P-384 / SHA-384 făcută de openssl peste aceiași octeți (alt program decât al nostru).
let ossl = false;
try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); ossl = true; } catch { /* lipsește */ }
if (ossl) {
  const dir = mkdtempSync(join(tmpdir(), 'suite-ec-'));
  const content = Buffer.concat([Buffer.from(signed.subarray(0, r[1])), Buffer.from(signed.subarray(r[2]))]);
  writeFileSync(join(dir, 'c.bin'), content);
  const o = (args) => execFileSync('openssl', args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: dir });
  o(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-384', '-nodes', '-keyout', 'k.pem', '-out', 'c.pem', '-subj', '/CN=Test EC', '-days', '30']);
  o(['cms', '-sign', '-binary', '-in', 'c.bin', '-signer', 'c.pem', '-inkey', 'k.pem', '-md', 'sha384', '-outform', 'DER', '-out', 's.der']);
  const der = readFileSync(join(dir, 's.der'));
  const ec = signed.slice();
  const hexs = der.toString('hex').padEnd(r[2] - r[1] - 2, '0');
  for (let i = 0; i < hexs.length; i++) ec[r[1] + 1 + i] = hexs.charCodeAt(i);
  const v6 = await verify1(ec);
  check('ECDSA P-384 · SHA-384 de la openssl: validă', v6.ok === true && v6.alg === 'ECDSA P-384 · SHA-384', JSON.stringify(v6));
  rmSync(dir, { recursive: true, force: true });
} else console.log('(openssl lipsește: ECDSA sărit)');

// Semnăturile reale din corpus: niciuna nu dă eroare; cele din fișierele nemodificate ies valide.
const dir = '../test-corpus/pdf/';
let n = 0, valid = 0;
const bad2 = [];
if (existsSync(dir)) for (const f of readdirSync(dir)) {
  if (!f.endsWith('.pdf')) continue;
  const b = new Uint8Array(readFileSync(dir + f));
  if (!Buffer.from(b.buffer, b.byteOffset, b.byteLength).includes('/ByteRange')) continue;
  for (const sg of m.readSignatures(b)) {
    n++;
    const v = await m.verifySignature(b, sg);
    if (v.ok === true) valid++; else bad2.push(`${f}: ${v.why}`);
  }
}
console.log(`corpus: ${n} semnături, ${valid} valide`, bad2.length ? '\n  ' + bad2.join('\n  ') : '');
check('corpus: semnăturile reale (ANAF, IRS) sunt verificate ca valide', n > 0 && valid === n, bad2.join('; '));

console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
