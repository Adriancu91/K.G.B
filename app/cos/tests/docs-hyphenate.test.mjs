// Test pentru despărțirea în silabe din Docs (Aspect → Despărțire în silabe): regulile românești pe cuvinte des folosite,
// cuvintele scurte, cele scrise cu majuscule și „i”-ul de la sfârșit care nu e silabă.
// Rulare (în suite/): node tests/docs-hyphenate.test.mjs
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

const out = join(tmpdir(), `suite-hyph-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { hyphenPoints } from './src/docs/hyphenate.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { parseDoc, serializeDoc } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { hyphenPoints, docToOdt, parseDoc, serializeDoc, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const show = (w) => { let s = '', last = 0; for (const p of hyphenPoints(w)) { s += w.slice(last, p) + '-'; last = p; } return s + w.slice(last); };
const check = (w, want) => { const got = show(w); const ok = got === want; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${w} → ${got}${ok ? '' : ` (trebuia ${want})`}`); if (!ok) fail++; };

check('calculator', 'cal-cu-la-tor');
check('documentul', 'do-cu-men-tul');
check('prezentare', 'pre-zen-ta-re');
check('înțelegere', 'în-țe-le-ge-re');
check('urechile', 'ure-chi-le'); // „ch” e un singur sunet; la început rămân cel puțin 2 litere
check('ochelari', 'oche-lari'); // „i” final după consoană nu e silabă
check('sculptor', 'sculp-tor'); // l-p-t se desparte după a doua consoană
check('capra', 'capra'); // prea scurt
check('cumpărătură', 'cum-pă-ră-tu-ră');
check('abstract', 'abs-tract');
check('suplimentar', 'su-pli-men-tar'); // p + l rămân împreună
check('frumoasă', 'fru-moa-să'); // între vocale nu desparte
check('ABCDEFGH', 'ABCDEFGH'); // prescurtările scrise cu majuscule rămân întregi
check('Contractul', 'Con-trac-tul');

// Fișierele: .docx (w:autoHyphenation, citit și înapoi), .odt (fo:hyphenate), fișierul Suite.
const yes = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] };
const page = { header: '', footer: '', numbers: false, hyphenate: true };
const bytes = await docToDocx(doc, page);
const settings = await (await JSZip.loadAsync(bytes)).file('word/settings.xml').async('string');
yes('.docx are w:autoHyphenation', /<w:autoHyphenation(?: w:val="(?:1|true|on)")? ?[/]>/.test(settings), settings.slice(0, 300));
const off = await (await JSZip.loadAsync(await docToDocx(doc, { ...page, hyphenate: undefined }))).file('word/settings.xml').async('string');
yes('fără despărțire: w:autoHyphenation lipsește', !/<w:autoHyphenation(?: w:val="(?:1|true|on)")? ?[/]>/.test(off));
yes('.docx citit înapoi: despărțirea pornită', (await docxToHtml(bytes)).layout?.hyphenate === true);
yes('.docx fără ea: nu se pornește', (await docxToHtml(await docToDocx(doc, { ...page, hyphenate: undefined }))).layout?.hyphenate !== true);
const odt = await (await JSZip.loadAsync(await docToOdt(doc, page))).file('styles.xml').async('string');
yes('.odt are fo:hyphenate="true"', odt.includes('fo:hyphenate="true"'));
yes('.sdoc păstrează despărțirea', parseDoc(serializeDoc(doc, page)).page.hyphenate === true);
yes('.sdoc: valoare stricată ignorată', parseDoc(JSON.stringify({ format: 'suite-doc', version: 1, content: doc, page: { header: '', footer: '', numbers: false, hyphenate: 'da' } })).page.hyphenate === undefined);

console.log(fail ? `\n${fail} verificări au eșuat` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
