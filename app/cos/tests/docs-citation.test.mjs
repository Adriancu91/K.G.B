// Test: citări și bibliografie din Docs: textul citării în cele 3 stiluri (APA, MLA, ISO 690), rândurile bibliografiei,
// ordinea alfabetică fără dubluri și exportul în .docx, .odt și text.
// Rulare (în suite/): node tests/docs-citation.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const out = join(tmpdir(), `suite-docscite-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/docs/citation.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { docToText } from './src/docs/plainExport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
const { citeText, refText, cleanSource, sortSources, docSourcesJson } = m;

const book = cleanSource({ id: 'b1', kind: 'book', author: 'Popescu, Ion', title: 'Istoria Moldovei', year: '2020', publisher: 'Polirom', city: 'Iași' });
const two = cleanSource({ id: 'a1', kind: 'article', author: 'Ionescu, Ana; Marin, Dan', title: 'Satele din Bărăgan', year: '2018', journal: 'Revista de Istorie', pages: '12-30' });
const web = cleanSource({ id: 'w1', kind: 'web', author: 'Institutul Național de Statistică', title: 'Populația României', year: '2023', url: 'https://insse.ro' });
const many = cleanSource({ id: 'm1', kind: 'book', author: 'Albu, Radu; Barbu, Ilie; Cazacu, Vlad', title: 'Ghid', year: '2021', publisher: 'Humanitas', city: 'București' });

// Citările din text.
assert.equal(citeText(book, 'apa', '45'), '(Popescu, 2020, p. 45)');
assert.equal(citeText(two, 'apa'), '(Ionescu & Marin, 2018)');
assert.equal(citeText(many, 'apa'), '(Albu et al., 2021)');
assert.equal(citeText(book, 'mla', '45'), '(Popescu 45)');
assert.equal(citeText(two, 'mla'), '(Ionescu and Marin)');
assert.equal(citeText(book, 'iso', '45'), '(POPESCU 2020, p. 45)');
assert.equal(citeText(web, 'iso'), '(Institutul Național de Statistică 2023)', 'instituția nu se scrie cu majuscule');
assert.equal(citeText(cleanSource({ id: 'x', title: 'Fără autor', year: '' }), 'apa'), '(Fără autor, f.a.)');

// Bibliografia.
assert.equal(refText(book, 'apa'), 'Popescu, I. (2020). Istoria Moldovei. Polirom.');
assert.equal(refText(two, 'apa'), 'Ionescu, A., & Marin, D. (2018). Satele din Bărăgan. Revista de Istorie, 12-30.');
assert.equal(refText(web, 'apa'), 'Institutul Național de Statistică. (2023). Populația României. https://insse.ro');
assert.equal(refText(book, 'mla'), 'Popescu, Ion. Istoria Moldovei. Polirom, 2020.');
assert.equal(refText(two, 'mla'), 'Ionescu, Ana, and Dan Marin. „Satele din Bărăgan.” Revista de Istorie, 2018, pp. 12-30.');
assert.equal(refText(book, 'iso'), 'POPESCU, Ion. Istoria Moldovei. Iași: Polirom, 2020.');
assert.equal(refText(web, 'iso'), 'Institutul Național de Statistică. Populația României [online]. 2023. Disponibil la: https://insse.ro');
assert.equal(refText(many, 'mla'), 'Albu, Radu, et al. Ghid. Humanitas, 2021.');

// Ordinea alfabetică (ca în română), fără dubluri.
assert.deepEqual(sortSources([book, two, book, web, many]).map((s) => s.id), ['m1', 'w1', 'a1', 'b1']);

// Documentul: două citări ale aceleiași cărți, una a articolului, apoi bibliografia în stilul MLA.
const cite = (s, page = '', style = 'mla') => ({ type: 'citation', attrs: { src: JSON.stringify(s), page, style } });
const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Așa scrie ' }, cite(book, '45'), { type: 'text', text: ' și ' }, cite(two), { type: 'text', text: '.' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Din nou ' }, cite(book, '50')] },
  { type: 'bibliography', attrs: { style: 'mla' } },
] };
assert.equal(docSourcesJson(doc).length, 2, 'două surse');
const z = await JSZip.loadAsync(await m.docToDocx(doc));
const xml = await z.file('word/document.xml').async('string');
assert.ok(xml.includes('(Popescu 45)') && xml.includes('(Ionescu and Marin)') && xml.includes('(Popescu 50)'), '.docx: citările');
assert.ok(xml.includes('Bibliografie') && xml.includes('Popescu, Ion. ') && xml.indexOf('Ionescu, Ana') < xml.indexOf('Popescu, Ion. '), '.docx: bibliografia, alfabetic');
assert.ok(/<w:i\/>[\s\S]{0,200}Istoria Moldovei/.test(xml) || /<w:i\/>.*?Istoria Moldovei/.test(xml), '.docx: titlul cărții cursiv');
const odt = await JSZip.loadAsync(await m.docToOdt(doc));
const content = await odt.file('content.xml').async('string');
assert.ok(content.includes('(Popescu 45)') && content.includes('Bibliografie') && content.includes('Istoria Moldovei'), '.odt');
const txt = m.docToText(doc);
assert.ok(txt.includes('Așa scrie (Popescu 45) și (Ionescu and Marin).') && txt.includes('Popescu, Ion. Istoria Moldovei. Polirom, 2020.'), 'text: ' + txt);
console.log('citări și bibliografie: toate verificările trec');
