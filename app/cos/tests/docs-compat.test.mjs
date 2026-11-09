// Test pentru „Verifică compatibilitatea” din Docs: ce se schimbă la salvarea în .docx, .odt și .txt.
// Rulare (în suite/): node tests/docs-compat.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docscompat-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/docs/compat.ts';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { countDoc, compatIssues } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };
const keys = (doc, page, f) => compatIssues(countDoc(doc), page, f).map((i) => i.key);
const P = (...content) => ({ type: 'doc', content });
const para = (text, marks) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] });

check('document simplu: .docx fără pierderi', keys(P(para('Salut')), {}, 'docx'), []);
check('document simplu: .odt fără pierderi', keys(P(para('Salut')), {}, 'odt'), []);
check('document simplu: .txt fără pierderi', keys(P(para('Salut')), {}, 'txt'), []);
check('aldin: doar .txt pierde', [keys(P(para('A', [{ type: 'bold' }])), {}, 'docx'), keys(P(para('A', [{ type: 'bold' }])), {}, 'txt')], [[], ['fmt']]);
check('legătura nu e formatare pierdută', keys(P(para('A', [{ type: 'link', attrs: { href: 'x' } }])), {}, 'txt'), []);
const rich = P(
  { type: 'tableOfContents' },
  { type: 'image', attrs: { src: 'x', equation: '{}' } },
  { type: 'image', attrs: { src: 'x', chart: '{}' } },
  { type: 'image', attrs: { src: 'x' } },
  { type: 'textBox', content: [para('cutie')] },
  para('a', [{ type: 'comment', attrs: { id: 'c1' } }]),
  para('b', [{ type: 'comment', attrs: { id: 'c1' } }]),
  para('c', [{ type: 'insertion', attrs: {} }]),
);
check('.docx: grafic (ecuația rămâne ecuație, cuprinsul e câmp, nu se pierd)', keys(rich, {}, 'docx'), ['chart']);
check('.odt: plus casete, comentarii, modificări', keys(rich, {}, 'odt'), ['chart', 'toc', 'box', 'cmt', 'trk']);
check('.txt: imaginile numărate împreună', compatIssues(countDoc(rich), {}, 'txt').find((i) => i.key === 'img')?.count, 3);
check('comentariul pe două bucăți se numără o dată', countDoc(rich).comments, 1);
check('.odt: filigran și restricții', keys(P(para('x')), { watermark: 'CONFIDENȚIAL', restrict: { mode: 'read' } }, 'odt'), ['wm', 'lock']);
check('.docx: filigranul trece', keys(P(para('x')), { watermark: 'CONFIDENȚIAL' }, 'docx'), []);
check('nod în tabel găsit', countDoc(P({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'image', attrs: { diagram: '{}' } }] }] }] })).diagrams, 1);

console.log(fail ? `\n${fail} GREȘITE` : '\nToate trec.');
process.exit(fail ? 1 : 0);
