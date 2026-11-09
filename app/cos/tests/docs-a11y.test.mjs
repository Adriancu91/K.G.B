// Test pentru „Verifică accesibilitatea” din Docs: poze fără text alternativ, titluri sărite sau goale, tabele fără antet,
// contrast slab (și pe evidențiere / pagină colorată), legături care arată adresa întreagă.
// Rulare (în suite/): node tests/docs-a11y.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docsa11y-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/docs/accessibility.ts'; export { getSchema } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit'; export { default as Image } from '@tiptap/extension-image';
export { default as Table } from '@tiptap/extension-table'; export { default as TableRow } from '@tiptap/extension-table-row';
export { default as TableHeader } from '@tiptap/extension-table-header'; export { default as TableCell } from '@tiptap/extension-table-cell';
export { default as TextStyle } from '@tiptap/extension-text-style'; export { default as Color } from '@tiptap/extension-color';
export { default as Highlight } from '@tiptap/extension-highlight'; export { DocLink } from './src/docs/link.ts';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const schema = m.getSchema([m.StarterKit, m.Image, m.Table, m.TableRow, m.TableHeader, m.TableCell, m.TextStyle, m.Color, m.Highlight.configure({ multicolor: true }), m.DocLink]);
const doc = (content) => schema.nodeFromJSON({ type: 'doc', content });
const p = (text, marks) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] });
const h = (level, text) => ({ type: 'heading', attrs: { level }, ...(text ? { content: [{ type: 'text', text }] } : {}) });
const png = 'data:image/png;base64,AAAA';
const cell = (t, type = 'tableCell') => ({ type, content: [p(t)] });
const kinds = (d, bg) => m.checkAccessibility(d, bg).map((x) => x.kind);

check('contrast negru pe alb', Math.round(m.contrast('#000000', '#ffffff')), 21);
check('document bun: nimic', kinds(doc([h(1, 'Raport'), h(2, 'Cifre'), p('Text'), { type: 'image', attrs: { src: png, alt: 'Grafic' } },
  { type: 'table', content: [{ type: 'tableRow', content: [cell('An', 'tableHeader'), cell('Sumă', 'tableHeader')] }, { type: 'tableRow', content: [cell('2026'), cell('5')] }] }])), []);
check('poză fără alt', kinds(doc([p('a'), { type: 'image', attrs: { src: png } }])), ['alt']);
check('titlu sărit 1 → 3', kinds(doc([h(1, 'A'), h(3, 'B')])), ['heading']);
check('titlu gol', kinds(doc([h(1, 'A'), h(2, '')])), ['emptyHeading']);
check('tabel fără antet', kinds(doc([{ type: 'table', content: [{ type: 'tableRow', content: [cell('a'), cell('b')] }] }])), ['tableHeader']);
const grey = [{ type: 'textStyle', attrs: { color: '#bbbbbb' } }];
check('text gri deschis', kinds(doc([p('greu de citit', grey)])), ['contrast']);
check('un singur avertisment pe paragraf', kinds(doc([{ type: 'paragraph', content: [{ type: 'text', text: 'a', marks: grey }, { type: 'text', text: 'b' }, { type: 'text', text: 'c', marks: grey }] }])), ['contrast']);
check('alb pe evidențiere închisă: bine', kinds(doc([p('ok', [{ type: 'textStyle', attrs: { color: '#ffffff' } }, { type: 'highlight', attrs: { color: '#1f3864' } }])])), []);
check('text închis pe pagină închisă', kinds(doc([p('x', [{ type: 'textStyle', attrs: { color: '#333333' } }])]), '#222222'), ['contrast']);
check('legătură cu adresa întreagă', kinds(doc([p('https://www.exemplu.ro/pagina/foarte/lunga/document.pdf', [{ type: 'link', attrs: { href: 'https://www.exemplu.ro/pagina/foarte/lunga/document.pdf' } }])])), ['link']);
check('legătură cu text: bine', kinds(doc([p('Formularul ANAF', [{ type: 'link', attrs: { href: 'https://www.anaf.ro/x' } }])])), []);

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
