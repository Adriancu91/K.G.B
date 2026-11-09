// Test pentru „🔐 Restricționează editarea” din Docs: w:documentProtection w:edit="readOnly" / "comments" (cu hash-ul parolei)
// în settings.xml, citit înapoi (și parola verificată), păstrat în fișierul Suite.
// Rulare (în suite/): node tests/docs-restrict.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';

globalThis.DOMParser ??= DOMParser;
{
  const d = new DOMParser().parseFromString('<a><b/></a>', 'text/xml');
  let p = Object.getPrototypeOf(d.documentElement);
  while (p && !Object.prototype.hasOwnProperty.call(p, 'appendChild')) p = Object.getPrototypeOf(p);
  if (!('children' in d.documentElement)) Object.defineProperty(p ?? Object.getPrototypeOf(d.documentElement), 'children', { get() { return Array.from(this.childNodes).filter((c) => c.nodeType === 1); }, configurable: true });
}
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}
const out = join(tmpdir(), `suite-docsrestrict-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { parseDoc, serializeDoc } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { makeSheetPw, checkSheetPw } from './src/sheets/sheetPassword.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { parseDoc, serializeDoc, docToDocx, docxToHtml, makeSheetPw, checkSheetPw } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Regulament intern' }] }] };
const base = { header: '', footer: '', numbers: false };
const settingsOf = async (bytes) => (await JSZip.loadAsync(bytes)).file('word/settings.xml').async('string');

// Doar citire, fără parolă
let bytes = await docToDocx(doc, { ...base, restrict: { mode: 'read' } });
let s = await settingsOf(bytes);
check('doar citire: w:edit="readOnly" pornit', s.includes('<w:documentProtection w:edit="readOnly" w:enforcement="1"/>'), s.slice(-300));
check('doar citire: fără w:trackRevisions', !s.includes('<w:trackRevisions'));
const i = (t) => s.indexOf(t);
check('ordinea din settings.xml', i('<w:documentProtection') < i('<w:evenAndOddHeaders') && i('<w:evenAndOddHeaders') < i('<w:compat'));
let back = await docxToHtml(bytes);
check('înapoi: doar citire', back.layout?.restrict?.mode === 'read' && !back.layout?.restrict?.pw && !back.layout?.trackLock, JSON.stringify(back.layout));
check('înapoi: textul', back.html.includes('Regulament intern'));

// Doar comentarii, cu parolă
const pw = await makeSheetPw('secret 123', 1000);
bytes = await docToDocx(doc, { ...base, restrict: { mode: 'comments', pw } });
s = await settingsOf(bytes);
check('comentarii: w:edit="comments" cu hash SHA-512', /<w:documentProtection w:edit="comments" w:enforcement="1" w:algorithmName="SHA-512" w:hashValue="[^"]+" w:saltValue="[^"]+" w:spinCount="1000"\/>/.test(s), s.slice(-400));
check('parola nu apare în fișier', !s.includes('secret'));
back = await docxToHtml(bytes);
const rp = back.layout?.restrict;
check('înapoi: doar comentarii, cu parolă', rp?.mode === 'comments' && rp?.pw?.alg === 'SHA-512', JSON.stringify(back.layout));
check('parola bună se potrivește', !!rp?.pw && (await checkSheetPw('secret 123', rp.pw)));
check('parola greșită nu', !!rp?.pw && !(await checkSheetPw('secret 124', rp.pw)));

// Cu blocarea urmăririi în același timp: restricționarea are întâietate, urmărirea rămâne pornită
bytes = await docToDocx(doc, { ...base, trackLock: true, restrict: { mode: 'read' } });
s = await settingsOf(bytes);
check('cu urmărirea: w:trackRevisions + readOnly', s.includes('<w:trackRevisions/><w:documentProtection w:edit="readOnly"'));

// Hash-ul vechi (cryptProviderType): protecția se citește, fără parolă
const zip = await JSZip.loadAsync(await docToDocx(doc, base));
const plain = await zip.file('word/settings.xml').async('string');
zip.file('word/settings.xml', plain.replace('<w:evenAndOddHeaders', '<w:documentProtection w:edit="comments" w:enforcement="1" w:cryptProviderType="rsaAES" w:cryptAlgorithmClass="hash" w:cryptAlgorithmType="typeAny" w:cryptAlgorithmSid="14" w:cryptSpinCount="100000" w:hash="abc=" w:salt="def="/><w:evenAndOddHeaders'));
back = await docxToHtml(await zip.generateAsync({ type: 'uint8array' }));
check('hash vechi: doar comentarii, fără parolă', back.layout?.restrict?.mode === 'comments' && !back.layout?.restrict?.pw, JSON.stringify(back.layout));
// Protecția oprită (enforcement 0) nu contează
zip.file('word/settings.xml', plain.replace('<w:evenAndOddHeaders', '<w:documentProtection w:edit="readOnly" w:enforcement="0"/><w:evenAndOddHeaders'));
back = await docxToHtml(await zip.generateAsync({ type: 'uint8array' }));
check('protecție oprită: nimic', !back.layout?.restrict);

// Fișierul Suite
const saved = parseDoc(serializeDoc(doc, { ...base, restrict: { mode: 'comments', pw } }));
check('fișierul Suite păstrează protecția și hash-ul', saved.page?.restrict?.mode === 'comments' && saved.page.restrict.pw?.hash === pw.hash, JSON.stringify(saved.page));
const bad = parseDoc(JSON.stringify({ format: 'suite-doc', version: 1, content: doc, page: { ...base, restrict: { mode: 'tot' } } }));
check('mod necunoscut: ignorat', !bad.page?.restrict);
console.log(fail ? `\n${fail} GREȘELI` : '\nTOATE TESTELE AU TRECUT');
process.exit(fail ? 1 : 0);
