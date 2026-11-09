// Test pentru câmpurile din antet / subsol în Docs: {data}, {fisier}, {autor}, {titlu} se înlocuiesc (și pe prima pagină și
// pe cele pare), un câmp gol dispare cu tot cu „ · ”, iar textul fără câmpuri rămâne neschimbat.
// Rulare (în suite/): node tests/docs-hffields.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-hffields-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/format.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const { expandHf, withHfFields, HF_FIELDS, HF_GALLERY, hfSlots } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const ctx = { date: '21.10.2026', file: 'Contract.sdoc', author: 'Ana Pop', title: 'Contract de închiriere' };
assert.equal(HF_FIELDS.length, 4);
assert.equal(expandHf('{titlu} · {data}', ctx), 'Contract de închiriere · 21.10.2026');
assert.equal(expandHf('Fișier: {fisier}, autor {autor}', ctx), 'Fișier: Contract.sdoc, autor Ana Pop');
assert.equal(expandHf('{autor} · {data}', { ...ctx, author: '' }), '21.10.2026', 'câmpul gol dispare cu tot cu separator');
assert.equal(expandHf('A · {autor} · B', { ...ctx, author: '' }), 'A · B', 'separatorul dublu se strânge');
assert.equal(expandHf('Fără câmpuri {altceva}', ctx), 'Fără câmpuri {altceva}', 'acoladele necunoscute rămân');
const page = { header: '{titlu}', footer: 'Tipărit la {data}', numbers: true, landscape: false, margin: 20, props: { title: 'Raport', author: 'Ion' },
  firstPage: { header: '', footer: '{autor}', numbers: false }, evenPage: { header: '{fisier}', footer: '' } };
const x = withHfFields(page, 'Raport.sdoc', new Date(2026, 9, 21));
assert.equal(x.header, 'Raport');
assert.equal(x.footer, 'Tipărit la 21.10.2026');
assert.equal(x.firstPage.footer, 'Ion');
assert.equal(x.evenPage.header, 'Raport.sdoc');
assert.equal(page.header, '{titlu}', 'setarea salvată păstrează câmpurile (doar afișarea le înlocuiește)');
// Galeria Antet / Subsol: Tab-urile împart textul în stânga / mijloc / dreapta, câmpurile se completează pe fiecare loc.
const TAB = String.fromCharCode(9);
assert.equal(expandHf('{titlu}' + TAB + TAB + '{data}', ctx), 'Contract de închiriere' + TAB + TAB + '21.10.2026');
assert.equal(expandHf('{titlu}', { ...ctx, title: '' }), 'Contract', 'fără titlu în proprietăți, titlul e numele fișierului');
assert.deepEqual(hfSlots('A' + TAB + 'B' + TAB + 'C', true, false, 'br').map((x) => x.text), ['A', 'B', 'C']);
assert.deepEqual(hfSlots(TAB + 'Confidențial', false, false, 'br').map((x) => x.text), ['', 'Confidențial', '']);
assert.deepEqual(hfSlots('A' + TAB + TAB + 'B', false, true, 'bc').map((x) => [x.text, x.num]), [['A', false], ['', true], ['B', false]]);
assert.deepEqual(hfSlots('Doar text', true, false, 'br').map((x) => x.text), ['', 'Doar text', ''], 'fără Tab antetul rămâne la mijloc');
assert.ok(HF_GALLERY.header.length >= 4 && HF_GALLERY.footer.length >= 4);
for (const [, t] of [...HF_GALLERY.header, ...HF_GALLERY.footer]) assert.ok(expandHf(t, ctx).replaceAll(TAB, '').length > 0, 'modelul are text: ' + t);
const plain = { header: 'SC Exemplu SRL', footer: '', numbers: false, landscape: false, margin: 20 };
assert.equal(withHfFields(plain, 'x'), plain, 'fără câmpuri: același obiect');
console.log('câmpurile din antet: toate verificările trec');
