// Test pentru protejarea foii în Sheets: păstrată la export/import .xlsx și la citirea fișierului Suite.
// Rulare (în suite/): node tests/sheet-protect.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-protect-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/format.ts', 'src/sheets/sheetPassword.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { parseSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
const { legacyHash, makeSheetPw, checkSheetPw, sheetPwFrom, bookLockFrom, bookLockXml } = await import(pathToFileURL(join(dir, 'sheetPassword.js')).href);
rmSync(dir, { recursive: true, force: true });

const sheet = { name: 'Foaia 1', colW: {}, protect: true, cells: { A1: 'Total', B1: '5', B2: '7' },
  styles: { B1: { unlock: true }, B2: { unlock: true, align: 'center', b: true } } };
const back = (await readXlsx(await writeXlsx([{ sheet, results: {} }]))).sheets[0];
assert.equal(back.protect, true);
assert.deepEqual(back.styles.B1, { unlock: true });
assert.deepEqual(back.styles.B2, { b: true, unlock: true, align: 'center' });
assert.equal(back.styles.A1, undefined);
const plain = (await readXlsx(await writeXlsx([{ sheet: { ...sheet, protect: undefined }, results: {} }]))).sheets[0];
assert.equal(plain.protect, undefined);
const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [sheet, { ...sheet, name: 'B', protect: 'da' }] }));
assert.equal(doc.sheets[0].protect, true);
assert.equal(doc.sheets[0].styles.B1.unlock, true);
assert.equal(doc.sheets[1].protect, undefined);
// Parola protecției: codul vechi (valoare cunoscută) și hash-ul nou SHA-512.
assert.equal(legacyHash('password'), '83AF');
assert.equal(await checkSheetPw('password', sheetPwFrom({ password: '83af' })), true);
assert.equal(await checkSheetPw('Password', { hash: '83AF' }), false);
const pw = await makeSheetPw('Secret 1', 1000);
assert.equal(pw.alg, 'SHA-512');
assert.equal(Buffer.from(pw.hash, 'base64').length, 64);
assert.equal(await checkSheetPw('Secret 1', pw), true);
assert.equal(await checkSheetPw('secret 1', pw), false);
const pw2 = await makeSheetPw('Secret 1', 1000);
assert.notEqual(pw2.salt, pw.salt, 'sare nouă la fiecare protejare');
// Hash-ul calculat de mână după specificație: H0 = SHA512(sare + parolă UTF-16LE), Hi = SHA512(H + i pe 4 octeți).
const { createHash } = await import('node:crypto');
const salt = Buffer.from(pw.salt, 'base64');
let h = createHash('sha512').update(Buffer.concat([salt, Buffer.from('Secret 1', 'utf16le')])).digest();
for (let i = 0; i < 1000; i++) { const b = Buffer.alloc(4); b.writeUInt32LE(i); h = createHash('sha512').update(Buffer.concat([h, b])).digest(); }
assert.equal(h.toString('base64'), pw.hash);
// Dus-întors prin .xlsx și prin fișierul Suite.
const locked = { ...sheet, protectPw: pw };
const xml = await writeXlsx([{ sheet: locked, results: {} }]);
const back2 = (await readXlsx(xml)).sheets[0];
assert.deepEqual(back2.protectPw, pw);
assert.equal(await checkSheetPw('Secret 1', back2.protectPw), true);
const doc2 = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [locked, { ...locked, name: 'C', protect: undefined }, { ...locked, name: 'D', protectPw: { alg: 5 } }] }));
assert.deepEqual(doc2.sheets[0].protectPw, pw);
assert.equal(doc2.sheets[1].protectPw, undefined, 'fără protecție nu rămâne parola');
assert.equal(doc2.sheets[2].protectPw, undefined, 'parola stricată se ignoră');
// Fișierul din corpus: foi cu SHA-512 și una cu codul vechi.
const { readFileSync, existsSync } = await import('node:fs');
const kyc = '../test-corpus/xlsx/CVLKRA-KYC_Download_File_Structure_V3.1.xlsx';
if (existsSync(kyc)) {
  const ss = (await readXlsx(new Uint8Array(readFileSync(kyc)))).sheets;
  assert.equal(ss[0].protectPw?.alg, 'SHA-512'); assert.equal(ss[0].protectPw?.spin, 100000);
  assert.equal(ss[1].protectPw?.hash, 'B5EC'); assert.equal(ss[1].protectPw?.alg, undefined);
}
// Structura registrului: <workbookProtection>, cu și fără parolă.
const bk = (await readXlsx(await writeXlsx([{ sheet, results: {} }], 0, [], false, undefined, { pw }))).lockBook;
assert.deepEqual(bk, { pw });
assert.deepEqual((await readXlsx(await writeXlsx([{ sheet, results: {} }], 0, [], false, undefined, {}))).lockBook, {});
assert.equal((await readXlsx(await writeXlsx([{ sheet, results: {} }]))).lockBook, undefined);
assert.equal(bookLockXml({ pw: { hash: '83AF' } }), '<workbookProtection workbookPassword="83AF" lockStructure="1"/>');
assert.equal(bookLockFrom({}), undefined, '<workbookProtection/> gol nu blochează nimic');
const doc3 = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [sheet], lockBook: { pw } }));
assert.deepEqual(doc3.lockBook, { pw });
assert.equal(parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [sheet], lockBook: 'da' })).lockBook, undefined);
if (existsSync(kyc)) {
  const lb = (await readXlsx(new Uint8Array(readFileSync(kyc)))).lockBook;
  assert.equal(lb?.pw?.alg, 'SHA-512'); assert.equal(lb?.pw?.spin, 100000);
}
console.log('protejarea foii și a registrului: toate verificările trec');
