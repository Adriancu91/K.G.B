// Test pentru plicurile din Docs: pagina cât plicul (culcată), expeditorul sus cu litere mici, destinatarul spre dreapta jos; .docx.
// Rulare (în suite/): node tests/docs-envelope.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';

const out = join(tmpdir(), `suite-docsenv-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { envelopeDoc, envelopeFile, ENVELOPES } from './src/docs/envelope.ts'; export { parseDoc, paperSize, paperFrom } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const NL = String.fromCharCode(10);
const to = ['Maria Ionescu', 'Bd. Unirii 10, ap. 5', '030167 București'].join(NL);
const from = ['Ion Popescu', 'Str. Florilor 3, Cluj-Napoca'].join(NL);
for (const s of m.ENVELOPES) {
  const { doc, page } = m.envelopeDoc(to, from, s);
  const size = m.paperSize(page);
  check(`${s}: pagina culcată, cât plicul`, size.w > size.h && m.paperFrom(size.w, size.h) === s, JSON.stringify(size));
  const p = doc.content;
  check(`${s}: expeditorul sus, cu 9 pt`, p[0].content[0].text === 'Ion Popescu' && p[0].content[0].marks[0].attrs.fontSize === '9pt' && !p[0].attrs.indent);
  check(`${s}: destinatarul retras și mai jos`, p[2].content[0].text === 'Maria Ionescu' && p[2].attrs.indent >= 4 && p[2].attrs.spaceBefore > 40 && p[4].attrs.indent === p[2].attrs.indent, JSON.stringify(p[2].attrs));
}
const noFrom = m.envelopeDoc(to, '', 'DL').doc.content;
check('fără expeditor: doar destinatarul', noFrom.length === 3 && noFrom[0].content[0].text === 'Maria Ionescu');
const back = m.parseDoc(m.envelopeFile(to, from, 'C5'));
check('fișierul Suite păstrează plicul', back.page.paper === 'C5' && back.page.landscape === true, JSON.stringify(back.page));
const xml = await (await JSZip.loadAsync(await m.docToDocx(back.content, back.page))).file('word/document.xml').async('string');
const sz = /<w:pgSz[^>]*>/.exec(xml)?.[0] ?? '';
check('Word: pagina C5 culcată', /w:w="12983"/.test(sz) && /w:h="918[45]"/.test(sz) && sz.includes('landscape'), sz);
console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
