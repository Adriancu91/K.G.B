// Test pentru Docs → Modifică stilul: stilurile documentului în .sdoc, în foaia de stil a editorului și în .docx (styles.xml).
// Rulare (în suite/): node tests/docs-styles.test.mjs
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
const out = join(tmpdir(), `suite-docstyles-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { NO_PAGE_SETUP, parseDoc, serializeDoc } from './src/docs/format.ts'; export * from './src/docs/docStyles.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, NO_PAGE_SETUP, parseDoc, serializeDoc, cleanStyles, stylesCss, styleFromMarks } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const styles = { normal: { font: 'Georgia', size: 12 }, h1: { color: '#C00000', size: 20, bold: true }, title: { italic: true } };
const content = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Capitol' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] };
const back = parseDoc(serializeDoc(content, { ...NO_PAGE_SETUP, styles }));
check('stilurile se păstrează în .sdoc', back.page?.styles?.normal?.font === 'Georgia' && back.page.styles.h1.color === '#c00000' && back.page.styles.title.italic === true, JSON.stringify(back.page?.styles));
check('fără stiluri schimbate, nu se scrie nimic', !JSON.parse(serializeDoc(content, NO_PAGE_SETUP)).page);
const bad = cleanStyles({ normal: { font: 'x"}; body{', size: 500, color: 'red' }, h9: { bold: true }, h2: { bold: false } });
check('valorile greșite se ignoră (font cu acolade, mărime 500, culoare fără #, stil necunoscut)', JSON.stringify(bad) === '{"h2":{"bold":false}}', JSON.stringify(bad));
const css = stylesCss(cleanStyles(styles), '[data-docstyles="d1"]');
check('foaia de stil: Text normal pe tot editorul', css.includes('[data-docstyles="d1"] .ProseMirror { font-family: "Georgia", sans-serif; font-size: 12pt; }'), css);
check('foaia de stil: Titlu 1 roșu, 20 pt, aldin', css.includes('.ProseMirror h1 { font-size: 20pt; color: #c00000; font-weight: 700; }'), css);
check('foaia de stil: Titlu document cursiv', css.includes('p[data-pstyle="title"] { font-style: italic; }'), css);
const sel = styleFromMarks({ fontFamily: '"Times New Roman", serif', fontSize: '14pt', color: 'rgb(31, 78, 121)', bold: true, italic: false });
check('stilul luat din textul selectat', sel.font === 'Times New Roman' && sel.size === 14 && sel.color === '#1f4e79' && sel.bold === true && sel.italic === false, JSON.stringify(sel));
const zip = await JSZip.loadAsync(await docToDocx(content, { ...NO_PAGE_SETUP, styles }));
const xml = await zip.file('word/styles.xml').async('string');
const h1 = xml.slice(xml.indexOf('w:styleId="Heading1"'), xml.indexOf('</w:style>', xml.indexOf('w:styleId="Heading1"')));
check('.docx: Normal cu Georgia, 12 pt', /<w:docDefaults>[\s\S]*w:ascii="Georgia"[\s\S]*<w:sz w:val="24"\/>[\s\S]*<\/w:docDefaults>/.test(xml), xml.slice(0, 600));
check('.docx: Titlu 1 roșu, 20 pt, aldin', h1.includes('w:val="C00000"') && h1.includes('<w:sz w:val="40"/>') && h1.includes('<w:b/>'), h1);
if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');
