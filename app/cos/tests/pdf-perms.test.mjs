// Test pentru PDF → Pune parolă → parola de permisiuni: biții P, deschiderea fără parolă, parola de proprietar, parola de deschidere.
// Rulare (în suite/): node tests/pdf-perms.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pdfperms-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { addPassword, removePassword, permBits } from './src/pdf/decrypt.ts'; export { PDFDocument, PDFName, PDFNumber, PDFDict } from 'pdf-lib';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { addPassword, removePassword, permBits, PDFDocument, PDFName, PDFNumber, PDFDict } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const errors = [];
const ok = (c, m) => { if (!c) errors.push(m); };

ok(permBits() === -4, 'totul permis: -4');
const p = permBits({ print: true, copy: true });
ok((p & 4) === 0 && (p & 2048) === 0 && (p & 16) === 0 && (p & 8) === 8 && (p & 32) === 32 && (p & 256) === 256, 'fără tipărire și copiere: ' + p);
ok((permBits({ edit: true, annot: true, forms: true }) & (8 | 32 | 256 | 1024)) === 0, 'fără modificare, comentarii, formulare');
ok((permBits({ print: true, copy: true, edit: true, annot: true, forms: true }) & 0xffffff00 & ~0x0f00) === (0xfffff000 | 0), 'biții rezervați 13–32 rămân 1');

const doc = await PDFDocument.create();
doc.setTitle('Contract de test');
doc.addPage([200, 200]).drawText('Salut', { x: 20, y: 100 });
const plain = await doc.save();

// Doar restricții: se deschide fără parolă (parola de utilizator goală), proprietarul are „secret”.
const enc = await addPassword(plain, '', { owner: 'secret', deny: { print: true, copy: true } });
const raw = await PDFDocument.load(enc, { ignoreEncryption: true });
const encDict = raw.context.lookup(raw.context.trailerInfo.Encrypt);
ok(encDict instanceof PDFDict && encDict.lookup(PDFName.of('P'), PDFNumber).asNumber() === p, 'P scris în dicționarul de criptare');
const openNoPw = await PDFDocument.load(await removePassword(enc, ''));
ok(openNoPw.getTitle() === 'Contract de test' && openNoPw.getPageCount() === 1, 'se deschide fără parolă');
const asOwner = await PDFDocument.load(await removePassword(enc, 'secret'));
ok(asOwner.getTitle() === 'Contract de test', 'parola de proprietar merge');
let bad = false;
try { await removePassword(enc, 'gresit'); } catch { bad = true; }
ok(bad, 'o parolă greșită e refuzată');

// Parolă de deschidere + parolă de permisiuni diferită.
const both = await addPassword(plain, 'deschide', { owner: 'proprietar', deny: { edit: true } });
let needs = false;
try { await removePassword(both, ''); } catch { needs = true; }
ok(needs, 'cu parolă de deschidere nu se deschide fără ea');
ok((await PDFDocument.load(await removePassword(both, 'deschide'))).getTitle() === 'Contract de test', 'parola de deschidere merge');
ok((await PDFDocument.load(await removePassword(both, 'proprietar'))).getTitle() === 'Contract de test', 'parola de proprietar merge și ea');
// Ca înainte: o singură parolă, totul permis.
const old = await addPassword(plain, 'abcd');
const oldRaw = await PDFDocument.load(old, { ignoreEncryption: true });
ok(oldRaw.context.lookup(oldRaw.context.trailerInfo.Encrypt).lookup(PDFName.of('P'), PDFNumber).asNumber() === -4, 'parola simplă: totul permis (-4)');
console.log(errors.length ? 'ERORI:\n' + errors.join('\n') : 'OK');
process.exit(errors.length ? 1 : 0);
