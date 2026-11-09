// Test pentru exportul Docs în Text simplu (.txt).
// Rulare (în suite/): node tests/docs-plain.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docsplain-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToText, docToHtmlPage } from './src/docs/plainExport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToText, docToHtmlPage } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}`); if (!ok) fail++; };
const t = (text) => ({ type: 'text', text });
const p = (...c) => ({ type: 'paragraph', content: c });
const li = (...c) => ({ type: 'listItem', content: c });
const doc = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [t('Raport')] },
  p(t('Primul rând'), { type: 'hardBreak' }, t('al doilea'), { type: 'footnote', attrs: { text: 'Sursa: INS' } }),
  { type: 'bulletList', content: [li(p(t('mere'))), li(p(t('pere')), { type: 'orderedList', attrs: { start: 3 }, content: [li(p(t('sub')))] })] },
  { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p(t('A'))] }, { type: 'tableCell', content: [p(t('B'))] }] }] },
  p(t('Șfârșit ăîâșț')),
] };
const txt = docToText(doc);
const L = txt.split('\r\n');
check('titlul pe primul rând', L[0] === 'Raport');
check('ruperea de rând și nota [1]', L[1] === 'Primul rând' && L[2] === 'al doilea[1]');
check('buline', L[3] === '• mere' && L[4] === '• pere');
check('sub-listă numerotată de la 3', L[5] === '    3. sub');
check('tabel cu Tab', L[6] === 'A\tB');
check('diacriticele rămân', txt.includes('Șfârșit ăîâșț'));
check('nota la sfârșit', txt.trimEnd().endsWith('[1] Sursa: INS'));

// Pagina web (.html) se verifică în aplicația reală: tests/cdp/cdp-docs-plain.mjs (are nevoie de DOM).
if (fail) console.log(txt);
console.log(fail ? `${fail} greșite` : 'Toate trec.');
process.exit(fail ? 1 : 0);
