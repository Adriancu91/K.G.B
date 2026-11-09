// Test pentru raspunsurile la comentarii din Docs: .docx (comentarii legate in commentsExtended.xml, citite inapoi ca fir).
// .odt (style:header-left / style:footer-left), fișierul Suite.
// Rulare (in suite/): node tests/docs-comment-replies.test.mjs
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
const out = join(tmpdir(), `suite-docsreply-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { parseReplies } from './src/docs/comment.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, parseReplies } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });


let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const replies = JSON.stringify([
  { author: 'Ion', date: '2026-10-20T08:00:00.000Z', text: 'De acord.' },
  { author: 'Maria', date: '2026-10-20T09:00:00.000Z', text: 'Am schimbat cifra.' },
]);
const mark = { type: 'comment', attrs: { id: 'c1', text: 'Verifică suma', author: 'Ana', date: '2026-10-20T07:00:00.000Z', replies } };
const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Total ' }, { type: 'text', text: '1.200 lei', marks: [mark] }, { type: 'text', text: ' pe lună.' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Fără răspunsuri', marks: [{ type: 'comment', attrs: { id: 'c2', text: 'Simplu', author: 'Ana', date: '', done: '1' } }] }] },
] };

check('parseReplies: text stricat = fără răspunsuri', parseReplies('{nu') .length === 0 && parseReplies('').length === 0);
check('parseReplies: două răspunsuri', parseReplies(replies).length === 2);

const bytes = await docToDocx(doc);
const zip = await JSZip.loadAsync(bytes);
const comments = await zip.file('word/comments.xml').async('string');
const ext = await zip.file('word/commentsExtended.xml')?.async('string');
const xml = await zip.file('word/document.xml').async('string');
check('.docx: 4 comentarii (2 de sus + 2 răspunsuri)', (comments.match(/<w:comment /g) ?? []).length === 4, comments.slice(0, 300));
check('.docx: răspunsurile au autorul și textul', comments.includes('w:author="Ion"') && comments.includes('Am schimbat cifra.'));
check('.docx: commentsExtended.xml există', !!ext);
check('.docx: două răspunsuri legate de comentariul de sus', (ext?.match(/paraIdParent=/g) ?? []).length === 2, ext);
check('.docx: răspunsurile acoperă același text', (xml.match(/<w:commentRangeStart /g) ?? []).length === 4 && (xml.match(/<w:commentReference /g) ?? []).length === 4);

const back = await docxToHtml(bytes);
const top = back.comments.filter((c) => !c.parent);
check('citit înapoi: 2 comentarii de sus', top.length === 2, JSON.stringify(back.comments));
const c1 = top.find((c) => c.text === 'Verifică suma');
check('citit înapoi: firul are 2 răspunsuri, în ordine', c1?.replies?.length === 2 && c1.replies[0].author === 'Ion' && c1.replies[1].text === 'Am schimbat cifra.', JSON.stringify(c1));
check('citit înapoi: comentariul simplu nu are răspunsuri', !top.find((c) => c.text === 'Simplu')?.replies?.length);

// Rezolvat: comentariul c2 e marcat rezolvat; în .docx are w15:done="1", iar c1 (deschis) nu.
check('.docx: comentariul rezolvat are w15:done="1"', (ext?.match(/w15:done="1"/g) ?? []).length === 1, ext);
check('citit înapoi: „Simplu” e rezolvat, „Verifică suma” nu', top.find((c) => c.text === 'Simplu')?.done === true && !c1?.done);
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
