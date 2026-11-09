// Test pentru Compară → Document marcat din Docs: diferența cuvânt cu cuvânt și documentul cu text șters / inserat,
// care ajunge în .docx ca modificări urmărite (w:del / w:ins).
// Rulare (în suite/): node tests/docs-compare-marked.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';

const out = join(tmpdir(), `suite-cmpmarked-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { wordDiff, markedDoc, wordTokens, flipDiff } from './src/docs/compareMarked.ts'; export { docxAuthor } from './src/docs/compareFile.ts'; export { diffLines } from './src/versionText.ts'; export { docToDocx } from './src/docs/docx.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { wordDiff, markedDoc, wordTokens, flipDiff, docxAuthor, diffLines, docToDocx } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const show = (parts) => parts.map((p) => (p.kind === 'same' ? p.text : p.kind === 'old' ? `[-${p.text}-]` : `{+${p.text}+}`)).join('');

check('cuvintele și spațiile refac textul', wordTokens('Plata  se face, lunar.').join('') === 'Plata  se face, lunar.');
const w = wordDiff('Plata se face în 30 de zile.', 'Plata se face în 15 zile lucrătoare.');
check('doar cuvintele schimbate', show(w) === 'Plata se face în [-30 de zile.-]{+15 zile lucrătoare.+}', show(w));
check('fără schimbare: totul la fel', show(wordDiff('Același text.', 'Același text.')) === 'Același text.');
check('un cuvânt adăugat', show(wordDiff('Contract de vânzare.', 'Contract de vânzare-cumpărare.')) === 'Contract de [-vânzare.-]{+vânzare-cumpărare.+}', show(wordDiff('Contract de vânzare.', 'Contract de vânzare-cumpărare.')));
check('cuvânt pus la mijloc', show(wordDiff('Părțile semnează azi.', 'Părțile semnează contractul azi.')) === 'Părțile semnează {+contractul +}azi.', show(wordDiff('Părțile semnează azi.', 'Părțile semnează contractul azi.')));

// Fișierul primit (a) → documentul de acum (b).
const a = ['Titlu', 'Plata se face în 30 de zile.', 'Rând scos de tot.', 'Final'];
const b = ['Titlu', 'Plata se face în 15 zile.', 'Final', 'Rând nou la capăt.'];
const doc = markedDoc(diffLines(a, b), 'Ana Pop', '2026-10-28T16:00:00.000Z');
const txt = (p) => (p.content ?? []).map((t) => (t.marks?.[0]?.type === 'deletion' ? `[-${t.text}-]` : t.marks?.[0]?.type === 'insertion' ? `{+${t.text}+}` : t.text)).join('');
const paras = doc.content.map(txt);
check('paragrafele documentului marcat', paras.join(' | ') === 'Titlu | Plata se face în [-30 de-]{+15+} zile. | [-Rând scos de tot.-] | Final | {+Rând nou la capăt.+}', paras.join(' | '));
check('autorul și data pe modificări', doc.content[1].content.find((t) => t.marks)?.marks[0].attrs.author === 'Ana Pop' && doc.content[1].content.find((t) => t.marks).marks[0].attrs.date.startsWith('2026-10-28'));
// Rânduri complet diferite în același loc: paragraf șters + paragraf inserat, nu amestec de cuvinte.
const d2 = markedDoc(diffLines(['Mere și pere.'], ['Contractul începe luni dimineață.']), 'X', '');
check('rânduri fără legătură: șters întreg, apoi inserat întreg', d2.content.map(txt).join(' | ') === '[-Mere și pere.-] | {+Contractul începe luni dimineață.+}', d2.content.map(txt).join(' | '));

const docx = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
check('.docx: textul șters ca w:del cu autorul', /<w:del [^>]*w:author="Ana Pop"[^]*?<w:delText[^>]*>30 de<[/]w:delText>/.test(xml), (xml.match(/<w:del [^]{0,300}/) ?? [''])[0]);
check('.docx: textul nou ca w:ins', /<w:ins [^>]*w:author="Ana Pop"[^]*?<w:t[^>]*>Rând nou la capăt.<[/]w:t>/.test(xml));

// Combină: aceeași diferență privită invers (documentul de acum → fișierul primit), pe numele autorului din fișier.
const comb = markedDoc(flipDiff(diffLines(a, b)), 'Ion Ionescu', '2026-10-27T09:00:00Z');
check('Combină: modificările fișierului peste documentul de acum', comb.content.map(txt).join(' | ') === 'Titlu | Plata se face în [-15 -]{+30 de +}zile. | {+Rând scos de tot.+} | Final | [-Rând nou la capăt.-]', comb.content.map(txt).join(' | '));
const core = new JSZip();
core.file('docProps/core.xml', '<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="y" xmlns:dcterms="z"><dc:creator>Ana Pop</dc:creator><cp:lastModifiedBy>Ion Ionescu</cp:lastModifiedBy><dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-27T09:00:00Z</dcterms:modified></cp:coreProperties>');
const who = await docxAuthor(new Uint8Array(await core.generateAsync({ type: 'uint8array' })));
check('autorul din fișier: cine a lucrat ultimul, cu data', who.author === 'Ion Ionescu' && who.date === '2026-10-27T09:00:00Z', JSON.stringify(who));
const none = await docxAuthor(new Uint8Array([1, 2, 3]));
check('fișier fără autor: gol, fără eroare', none.author === '' && none.date === '');

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
