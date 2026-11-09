// Test pentru locul și forma numărului paginii din Docs (sus / jos, stânga / mijloc / dreapta; „Pagina 1 din 3”, „Pagina 1”, „1”, „1 / 3”):
// .docx (câmpurile PAGE / NUMPAGES în antet sau subsol), .odt (text:page-number), fișierul Suite.
// Rulare (în suite/): node tests/docs-pagenum.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

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

const out = join(tmpdir(), `suite-docsnum-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { parseDoc, serializeDoc, hfSlots, numTokens } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, parseDoc, serializeDoc, hfSlots, numTokens, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] };
const J = JSON.stringify;

// Locurile.
check('subsol obișnuit: text în stânga, număr în dreapta', J(hfSlots('Intern', false, true, 'br')) === J([{ text: 'Intern', num: false }, { text: '', num: false }, { text: '', num: true }]));
check('antet cu număr sus la mijloc: după textul antetului', J(hfSlots('Raport', true, true, 'tc')) === J([{ text: '', num: false }, { text: 'Raport', num: true }, { text: '', num: false }]));
check('numărul sus nu apare în subsol', !hfSlots('Intern', false, true, 'tr').some((s) => s.num));
check('formele numărului', J(numTokens('slash')) === J(['P', ' / ', 'T']) && J(numTokens('num')) === J(['P']) && J(numTokens('page')) === J(['Pagina ', 'P']));

const files = async (bytes, re) => { const z = await JSZip.loadAsync(bytes); return Promise.all(Object.keys(z.files).filter((f) => re.test(f)).map((f) => z.file(f).async('string'))); };
// .docx: numărul sus, „1 / 3”.
const top = { header: 'Raport', footer: 'Intern', numbers: true, numAt: 'tc', numStyle: 'slash' };
let bytes = await docToDocx(doc, top);
const heads = await files(bytes, /^word\/header\d*\.xml$/), foots = await files(bytes, /^word\/footer\d*\.xml$/);
check('.docx: numărul e în antet, cu PAGE și NUMPAGES', heads.some((h) => h.includes('Raport') && /PAGE/.test(h) && /NUMPAGES/.test(h) && h.includes(' / ')), heads.join('\n').slice(0, 600));
check('.docx: subsolul fără număr', foots.every((f) => !/\bPAGE\b/.test(f)) && foots.some((f) => f.includes('Intern')));
// .docx: doar numărul, jos la mijloc.
bytes = await docToDocx(doc, { header: '', footer: '', numbers: true, numAt: 'bc', numStyle: 'num' });
const f2 = await files(bytes, /^word\/footer\d*\.xml$/);
check('.docx: „1” jos la mijloc (un tab înainte, fără „Pagina”, fără NUMPAGES)', f2.some((f) => /PAGE/.test(f) && !/NUMPAGES/.test(f) && !f.includes('Pagina') && (f.match(/<w:tab\/>/g) ?? []).length === 1), f2.map((f) => f.slice(f.indexOf('<w:p>'), f.indexOf('<w:p>') + 900)).join('\n'));
// .docx obișnuit: tot „Pagina 1 din 3” în dreapta.
bytes = await docToDocx(doc, { header: '', footer: 'Intern', numbers: true });
const f3 = await files(bytes, /^word\/footer\d*\.xml$/);
check('.docx implicit: „Pagina … din …” în subsol', f3.some((f) => f.includes('Pagina') && f.includes(' din ') && /NUMPAGES/.test(f)));

// Înapoi din .docx: locul și forma se citesc (și dintr-un subsol obișnuit, unde rămân implicite).
for (const [at, style] of [['tc', 'slash'], ['bc', 'num'], ['bl', 'page'], ['tr', 'full'], ['br', 'full']]) {
  const lay = (await docxToHtml(await docToDocx(doc, { header: 'Raport', footer: '', numbers: true, numAt: at, numStyle: style }))).layout;
  check(`.docx citit înapoi: ${at} / ${style}`, (lay?.numAt ?? 'br') === at && (lay?.numStyle ?? 'full') === style && lay?.numbers === true, JSON.stringify(lay));
}
const withText = (await docxToHtml(await docToDocx(doc, { header: '', footer: 'Intern', numbers: true, numAt: 'bc', numStyle: 'slash' }))).layout;
check('.docx citit înapoi: text în stânga și „1 / 3” la mijloc', withText?.numAt === 'bc' && withText?.numStyle === 'slash' && withText?.footer === 'Intern', JSON.stringify(withText));

// .odt.
const odt = await JSZip.loadAsync(await docToOdt(doc, top));
const master = (await odt.file('styles.xml').async('string')).match(/<style:master-page[\s\S]*<\/style:master-page>/)?.[0] ?? '';
check('.odt: numărul în antet, „1 / 3”', /<style:header><text:p text:style-name="PHF"><text:tab\/>Raport · <text:page-number[^>]*>1<\/text:page-number>(?: |<text:s\/>)\/ <text:page-count>1<\/text:page-count><\/text:p><\/style:header>/.test(master), master);
check('.odt: subsolul fără număr', /<style:footer>[\s\S]*Intern[\s\S]*<\/style:footer>/.test(master) && !/<style:footer>[\s\S]*page-number[\s\S]*<\/style:footer>/.test(master));

// Fișierul Suite.
const back = parseDoc(serializeDoc(doc, top)).page;
check('.sdoc păstrează locul și forma', back.numAt === 'tc' && back.numStyle === 'slash');
const def = parseDoc(serializeDoc(doc, { header: '', footer: '', numbers: true, numAt: 'br', numStyle: 'full' })).page;
check('valorile implicite nu se scriu', !('numAt' in def) && !('numStyle' in def));
const bad = parseDoc(J({ format: 'suite-doc', version: 1, content: doc, page: { header: '', footer: '', numbers: true, numAt: 'xx', numStyle: 7 } })).page;
check('valori stricate se ignoră', !('numAt' in bad) && !('numStyle' in bad));

console.log(fail ? `${fail} GREȘELI` : 'Toate verificările au trecut.');
process.exit(fail ? 1 : 0);
