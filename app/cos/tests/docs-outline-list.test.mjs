// Test: lista numerotată pe niveluri din Docs (1. / 1.1. / 1.1.1.): export .docx (numbering.xml cu %1.%2.) și .odt (display-levels).
// Rulare (în suite/): node tests/docs-outline-list.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';

const out = join(tmpdir(), `suite-docsoutline-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { NUMBER_STYLES } from './src/docs/listStyle.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docToOdt, NUMBER_STYLES } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const para = (t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
const li = (t, kids = []) => ({ type: 'listItem', content: [para(t), ...kids] });
const ol = (items, attrs = {}) => ({ type: 'orderedList', attrs: { start: 1, ...attrs }, content: items });
const doc = { type: 'doc', content: [ol([
  li('Dispoziții generale', [ol([li('Scopul', [ol([li('Detaliu')])]), li('Definiții')])]),
  li('Obligații'),
], { listStyle: 'outline' })] };

check('„Pe niveluri” e în lista de numerotări', NUMBER_STYLES.some(([s]) => s === 'outline'));

const z = await JSZip.loadAsync(await docToDocx(doc));
const num = await z.file('word/numbering.xml').async('string');
const abs = num.split('<w:abstractNum ').slice(1).find((a) => a.includes('%1.%2.')) ?? '';
check('.docx: nivelurile %1. / %1.%2. / %1.%2.%3.', abs.includes('w:val="%1."') && abs.includes('w:val="%1.%2.%3."'), abs.slice(0, 300));
check('.docx: toate nivelurile cu cifre', abs && !abs.includes('lowerLetter') && !abs.includes('lowerRoman'));
const xml = await z.file('word/document.xml').async('string');
const paras = xml.split('<w:p>').concat(xml.split('<w:p ')).filter((p) => p.includes('<w:t'));
const attr = (p, tag) => { const i = p.indexOf(`<w:${tag} w:val="`); return i < 0 ? undefined : p.slice(i + tag.length + 11).split('"')[0]; };
const of = (t) => paras.find((p) => p.includes(t) && p.includes('<w:numPr>')) ?? '';
check('.docx: sublistele sunt nivelurile 1 și 2', attr(of('Dispoziții'), 'ilvl') === '0' && attr(of('Scopul'), 'ilvl') === '1' && attr(of('Detaliu'), 'ilvl') === '2',
  ['Dispoziții', 'Scopul', 'Detaliu'].map((t) => attr(of(t), 'ilvl')).join(','));
check('.docx: aceeași numerotare pe toate nivelurile', new Set(['Dispoziții', 'Scopul', 'Detaliu', 'Obligații'].map((t) => attr(of(t), 'numId'))).size === 1);

const odt = await docToOdt(doc);
const oz = await JSZip.loadAsync(odt);
const content = await oz.file('content.xml').async('string');
const styles = (await oz.file('styles.xml')?.async('string')) ?? '';
check('.odt: lista și sublistele folosesc stilul pe niveluri', content.split('text:style-name="Numerotare_20_niveluri"').length - 1 === 3);
check('.odt: stilul are display-levels', (content + styles).includes('text:display-levels="3"'));
// O listă numerotată obișnuită rămâne cu stilul obișnuit.
const plain = await JSZip.loadAsync(await docToOdt({ type: 'doc', content: [ol([li('a', [ol([li('b')])])])] }));
check('.odt: lista obișnuită neschimbată', !(await plain.file('content.xml').async('string')).includes('Numerotare_20_niveluri"'));

console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
