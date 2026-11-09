// Test pentru Buline și numerotare în Docs: export Word cu bulina aleasă (✓) și numerotarea aleasă (I., a.), listele obișnuite neschimbate.
// Rulare (în suite/): node tests/docs-liststyle.test.mjs
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
const out = join(tmpdir(), `suite-docsls-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const item = (t) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const doc = { type: 'doc', content: [
  { type: 'bulletList', attrs: { listStyle: 'check' }, content: [item('Bifat unu'), item('Bifat doi')] },
  { type: 'orderedList', attrs: { start: 1, listStyle: 'upper-roman' }, content: [item('Capitolul unu'), item('Capitolul doi')] },
  { type: 'orderedList', attrs: { start: 1, listStyle: 'lower-alpha' }, content: [item('litera a')] },
  { type: 'bulletList', content: [item('Bulină obișnuită')] },
  { type: 'orderedList', attrs: { start: 1 }, content: [item('Număr obișnuit')] },
] };
const zip = await JSZip.loadAsync(await docToDocx(doc));
const num = await zip.file('word/numbering.xml').async('string');
const xml = await zip.file('word/document.xml').async('string');
// Fiecare abstractNum cu primul nivel: [format, text].
const firsts = [...num.matchAll(/<w:abstractNum\b[\s\S]*?<\/w:abstractNum>/g)].map((m) => {
  const l0 = /<w:lvl w:ilvl="0"[\s\S]*?<\/w:lvl>/.exec(m[0])?.[0] ?? '';
  return [/<w:numFmt w:val="([^"]+)"/.exec(l0)?.[1], /<w:lvlText w:val="([^"]*)"/.exec(l0)?.[1]];
});
const has = (fmt, text) => firsts.some(([f, t]) => f === fmt && t === text);
check('bulina aleasă (✓) ajunge în numbering.xml', has('bullet', '✓'), JSON.stringify(firsts));
check('numerotarea cu cifre romane mari: I.', has('upperRoman', '%1.'), JSON.stringify(firsts));
check('numerotarea cu litere mici: a.', has('lowerLetter', '%1.'), JSON.stringify(firsts));
check('lista numerotată obișnuită rămâne 1.', has('decimal', '%1.'), JSON.stringify(firsts));
const paras = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
const numIdOf = (t) => /<w:numId w:val="(\d+)"/.exec(paras.find((p) => p.includes(t)) ?? '')?.[1];
check('fiecare listă are numerotarea ei', new Set(['Bifat unu', 'Capitolul unu', 'litera a', 'Bulină obișnuită', 'Număr obișnuit'].map(numIdOf)).size === 5 && numIdOf('Bifat unu') === numIdOf('Bifat doi'), ['Bifat unu', 'Bifat doi', 'Capitolul unu', 'litera a', 'Bulină obișnuită', 'Număr obișnuit'].map(numIdOf).join(','));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
