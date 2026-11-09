// Test pentru pagina de gardă din Docs: fiecare model are titlu, subtitlu, autor, dată și pagină nouă; se păstrează în .docx și .odt.
// Rulare (în suite/): node tests/docs-cover.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';

const out = join(tmpdir(), `suite-docscover-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { coverContent, coverText, COVERS, COVER_TITLE } from './src/docs/coverPage.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docToOdt } from './src/docs/odtExport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const t = m.coverText('Raport anual', 'Ana Pop', new Date(2026, 9, 20));
check('textul paginii', t.title === 'Raport anual' && t.author === 'Ana Pop' && t.date === '20 octombrie 2026', JSON.stringify(t));
check('fără titlu: loc de completat', m.coverText(null, null).title === 'Titlul documentului' && m.coverText('  ', '').author === 'Numele autorului');
const words = (nodes) => nodes.map((n) => (n.content ?? []).map((c) => c.text).join('')).join('|');
for (const [kind] of m.COVERS) {
  const c = m.coverContent(kind, t);
  const all = words(c);
  check(`${kind}: are tot textul`, ['Raport anual', 'Subtitlul documentului', 'Ana Pop', '20 octombrie 2026'].every((w) => all.includes(w)), all);
  check(`${kind}: se termină cu pagină nouă`, c[c.length - 1].type === 'pageBreak');
  check(`${kind}: titlul e unde spune COVER_TITLE`, words([c[m.COVER_TITLE[kind]]]) === 'Raport anual');
}
const doc = { type: 'doc', content: [...m.coverContent('banda', t), { type: 'paragraph', content: [{ type: 'text', text: 'Textul raportului' }] }] };
const xml = await (await JSZip.loadAsync(await m.docToDocx(doc))).file('word/document.xml').async('string');
check('Word: titlu, fundal și pagină nouă', xml.includes('Raport anual') && /w:fill="1F3864"/i.test(xml) && xml.includes('w:type="page"') && xml.indexOf('Raport anual') < xml.indexOf('Textul raportului'), xml.slice(0, 600));
check('Word: litere albe de 32 pt pe bandă', /<w:color w:val="FFFFFF"\/>/i.test(xml) && xml.includes('<w:sz w:val="64"/>'));
const c = await (await JSZip.loadAsync(await m.docToOdt({ type: 'doc', content: m.coverContent('clasic', t) }))).file('content.xml').async('string');
check('LibreOffice: pagină nouă după gardă', c.includes('Raport anual') && c.includes('fo:break-after="page"'));

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
