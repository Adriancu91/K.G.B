// Test pentru semnarea prin adăugare (salvare incrementală): semnăturile de dinainte rămân valabile.
// Două semnături la rând, certificare + semnătură, fișiere cu tabel de poziții clasic și cu flux /XRef, un formular ANAF real
// (semnat de programul care l-a făcut), deschiderea cu pdf.js și verificarea cu openssl (dacă există).
// Rulare (în suite/): node tests/pdf-digisign-incr.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = join(tmpdir(), `suite-incr-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/pdf/digisign.ts'; export { verifySignature } from './src/pdf/verifySig.ts'; export { readSignatures } from './src/pdf/signatures.ts'; export { addSigField, emptySigFields } from './src/pdf/sign.ts'; export { PDFDocument } from 'pdf-lib';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + extra}`); if (!ok) fail++; };
const allValid = async (pdf) => {
  const sigs = m.readSignatures(pdf);
  const r = await Promise.all(sigs.map((g) => m.verifySignature(pdf, g)));
  return { n: sigs.length, valid: r.filter((x) => x.ok === true).length, kinds: sigs.map((g) => g.kind), why: r.map((x) => x.why) };
};
const pagesWithPdfjs = async (pdf) => {
  const d = await pdfjs.getDocument({ data: pdf.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const n = d.numPages; await d.destroy(); return n;
};
const ossl = (() => { try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const opensslAll = (pdf, only) => {
  const s = Buffer.from(pdf).toString('latin1');
  let ok = 0, n = 0;
  for (const g of m.readSignatures(pdf)) {
    if (only && !only(g)) continue;
    n++;
    const r = g.range;
    let hex = s.slice(r[1] + 1, r[2] - 1);
    while (hex.endsWith('00')) hex = hex.slice(0, -2);
    const dir = mkdtempSync(join(tmpdir(), 'suite-incr-'));
    writeFileSync(join(dir, 's.der'), Buffer.from(hex, 'hex'));
    writeFileSync(join(dir, 'c.bin'), Buffer.concat([Buffer.from(pdf.subarray(0, r[1])), Buffer.from(pdf.subarray(r[2], r[2] + r[3]))]));
    try { execFileSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', join(dir, 's.der'), '-content', join(dir, 'c.bin'), '-noverify', '-out', join(dir, 'o')], { stdio: 'ignore' }); ok++; } catch { /* nevalidă */ }
    rmSync(dir, { recursive: true, force: true });
  }
  return ok === n;
};

const ana = await m.createDigitalId({ name: 'Ana Popescu' });
const ion = await m.createDigitalId({ name: 'Ion Ionescu', org: 'Client SRL' });

for (const objStreams of [true, false]) {
  const label = objStreams ? 'flux /XRef' : 'tabel clasic';
  const d = await m.PDFDocument.create();
  const p = d.addPage([595, 842]);
  p.drawText('Contract');
  m.addSigField(d, p, { x: 50, y: 50, width: 200, height: 60 }, 'Furnizor');
  m.addSigField(d, p, { x: 320, y: 50, width: 200, height: 60 }, 'Client');
  const orig = new Uint8Array(await d.save({ useObjectStreams: objStreams }));
  const one = await m.signPdf(orig, ana, { field: 'Furnizor', certify: 2 });
  check(`${label}: fișierul vechi rămâne neatins la început (doar adăugare)`, one.length > orig.length && Buffer.from(one.subarray(0, orig.length)).equals(Buffer.from(orig)));
  const two = await m.signPdf(one, ion, { field: 'Client' });
  check(`${label}: și a doua semnătură doar adaugă`, Buffer.from(two.subarray(0, one.length)).equals(Buffer.from(one)));
  const v = await allValid(two);
  check(`${label}: amândouă semnăturile valide (certificarea și semnătura clientului)`, v.n === 2 && v.valid === 2 && v.kinds.includes('certify') && v.kinds.includes('sign'), JSON.stringify(v));
  const sigs = m.readSignatures(two);
  check(`${label}: prima e urmată de octeți adăugați, ultima acoperă tot fișierul`, sigs.some((g) => g.after > 0) && sigs.some((g) => g.after === 0));
  check(`${label}: nu mai rămâne niciun câmp gol`, (await m.emptySigFields(two)).length === 0);
  check(`${label}: pdf.js deschide fișierul (1 pagină)`, (await pagesWithPdfjs(two)) === 1);
  const re = await m.PDFDocument.load(two);
  check(`${label}: pdf-lib îl deschide, 2 câmpuri de semnătură`, re.getForm().getFields().filter((f) => f.constructor.name.startsWith('PDFSignature')).length === 2);
  if (ossl) check(`${label}: openssl confirmă ambele semnături`, opensslAll(two));
  // Semnătură invizibilă (câmp nou + pagină schimbată) peste un fișier semnat.
  const three = await m.signPdf(two, ana, {});
  const v3 = await allValid(three);
  check(`${label}: a treia, invizibilă: toate 3 valide`, v3.n === 3 && v3.valid === 3, JSON.stringify(v3));
}

// Formular ANAF real, semnat deja de programul care l-a făcut.
const anaf = '../test-corpus/pdf/anaf_C300_v1.0.1_18122025.pdf';
if (existsSync(anaf)) {
  const b = new Uint8Array(readFileSync(anaf));
  const s = await m.signPdf(b, ana, { reason: 'Depus' });
  const v = await allValid(s);
  check('formular ANAF real: semnătura lui și a noastră, ambele valide', v.n === 2 && v.valid === 2, JSON.stringify(v));
  const hasXfa = async (x) => (await m.PDFDocument.load(x, { updateMetadata: false })).catalog.getAcroForm()?.dict.keys().map(String).includes('/XFA');
  check('formular ANAF real: partea XFA (formularul dinamic) rămâne', (await hasXfa(b)) && (await hasXfa(s)));
  const n1 = await pagesWithPdfjs(b), n2 = await pagesWithPdfjs(s);
  check('formular ANAF real: pdf.js îl deschide cu aceleași pagini', n1 === n2 && n2 > 0, `${n1} / ${n2}`);
  // Semnătura veche a formularului e cu SHA-1, pe care openssl 3 îl refuză din principiu; o verificăm pe a noastră.
  if (ossl) check('formular ANAF real: openssl confirmă semnătura noastră', opensslAll(s, (g) => g.kind === 'sign'));
} else console.log('(corpusul lipsește: formularul ANAF sărit)');

console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
