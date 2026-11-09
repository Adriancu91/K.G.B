// Test: pânza liberă din Notițe (▣ Casetă liberă): casetele se păstrează la redeschiderea caietului (cele stricate se curăță),
// se găsesc la căutare, intră în ordinea de citire (de sus în jos, apoi de la stânga) în → Docs, .html și .md.
// Rulare (în suite/): node tests/notes-canvas.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const entry = join(tmpdir(), `suite-notescanvas-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-notescanvas-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), 'src/notes', p).split('\\').join('/'));
writeFileSync(entry, [
  `export * from ${src('store.ts')};`, `export * from ${src('freeCanvas.ts')};`,
  `export { noteToDoc } from ${src('todoc.ts')};`, `export { noteToHtml } from ${src('tohtml.ts')};`, `export { noteToMarkdown } from ${src('markdown.ts')};`,
].join('\n'));
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.svg': 'text' } });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true }); rmSync(entry, { force: true });

const note = (extra) => ({ id: 'a', title: 'Plan', body: 'Text de sus', created: '2026-10-31T00:00:00Z', updated: '2026-10-31T00:00:00Z', ...extra });
const read = (n) => m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [n] })).notes[0];

// 1. Casetele rămân, cu locul și lățimea lor; cele stricate se curăță, valorile ies prinse în margini.
const boxes = [
  { id: 'b1', x: 400, y: 30, w: 200, text: 'Dreapta sus' },
  { id: 'b2', x: 10, y: 40, w: 50, text: 'Stânga sus' },
  { id: 'b3', x: 20, y: 300, w: 5000, text: 'Jos' },
  { id: 'b4', x: 'x', text: 7 },
  { id: 'B<5', x: -40, y: 99999, text: 'Ciudată' },
];
const n = read(note({ boxes }));
assert.equal(n.boxes.length, 4);
assert.deepEqual(n.boxes[0], { id: 'b1', x: 400, y: 30, w: 200, text: 'Dreapta sus' });
assert.equal(n.boxes[1].w, m.BOX_MIN_W);
assert.equal(n.boxes[2].w, m.BOX_MAX_W);
assert.equal(n.boxes[3].x, 0); assert.equal(n.boxes[3].y, m.CANVAS_MAX); assert.match(n.boxes[3].id, /^[a-z0-9]+$/);
assert.equal(read(note({ boxes: [] })).boxes, undefined);
assert.equal(read(note({})).boxes, undefined);

// 2. Ordinea de citire: același rând (sub 24 px diferență) de la stânga la dreapta, apoi mai jos.
assert.deepEqual(m.readingOrder(n.boxes).map((b) => b.text), ['Stânga sus', 'Dreapta sus', 'Jos', 'Ciudată']);
assert.equal(m.boxesText(n.boxes), 'Stânga sus\n\nDreapta sus\n\nJos\n\nCiudată');

// 3. Căutarea găsește textul din casete.
const store = { notes: [n, read(note({ id: 'c', title: 'Alta', body: 'nimic' }))] };
assert.deepEqual(m.search(store.notes, 'dreapta').map((x) => x.id), ['a']);

// 4. O notiță doar cu o casetă nu e goală; una cu casete goale e.
assert.equal(m.isEmpty(note({ title: '', body: '', boxes: [{ id: 'x', x: 0, y: 0, w: 200, text: 'ceva' }] })), false);
assert.equal(m.isEmpty(note({ title: '', body: '', boxes: [{ id: 'x', x: 0, y: 0, w: 200, text: '  ' }] })), true);

// 5. Exporturile au textul casetelor după textul notiței.
const doc = JSON.stringify(JSON.parse(m.noteToDoc(n)));
assert.ok(doc.indexOf('Text de sus') < doc.indexOf('Stânga sus') && doc.indexOf('Stânga sus') < doc.indexOf('Jos'), 'Docs');
const html = m.noteToHtml(n);
assert.ok(html.includes('Dreapta sus') && html.indexOf('Text de sus') < html.indexOf('Dreapta sus'), '.html');
const md = m.noteToMarkdown(n);
assert.ok(md.includes('Text de sus\n\nStânga sus\n\nDreapta sus'), '.md');
// Fără casete, exportul rămâne neschimbat.
assert.equal(m.withBoxes('abc', {}), 'abc');

// 6. Înălțimea pânzei crește cu cea mai de jos casetă.
assert.ok(m.canvasHeight([]) >= 360);
assert.ok(m.canvasHeight([{ id: 'z', x: 0, y: 2000, w: 200, text: 'a' }]) > 2000);


// 7. Casetele cu poză: poza rămâne (cele care nu sunt poze se scot), notița doar cu o poză pe pânză nu e goală, poza intră în exporturi.
const PIC = 'data:image/jpeg;base64,QUJD';
const pn = read(note({ boxes: [{ id: 'p1', x: 10, y: 500, w: 300, text: 'Schița', img: PIC }, { id: 'p2', x: 10, y: 10, w: 200, text: '', img: 'javascript:alert(1)' }, { id: 'p3', x: 0, y: 0, w: 200, text: 'cu poza rea', img: 'data:image/svg+xml;base64,AAAA' }] }));
assert.equal(pn.boxes[0].img, PIC);
assert.equal(pn.boxes[1].img, undefined); assert.equal(pn.boxes[2].img, undefined);
assert.deepEqual(m.boxImages(pn.boxes), [PIC]);
assert.equal(m.isEmpty(note({ title: '', body: '', boxes: [{ id: 'x', x: 0, y: 0, w: 200, text: '', img: PIC }] })), false);
assert.ok(m.noteToDoc(pn).includes(PIC), 'poza în Docs');
assert.ok(m.noteToHtml(pn).includes(PIC), 'poza în .html');
assert.ok(m.noteToMarkdown(pn).includes('](' + PIC + ')'), 'poza în .md');
assert.ok(m.canvasHeight(pn.boxes) > 500 + 300, 'pânza ține loc și pentru poză');

// 8. Desenul de pe pânză își păstrează liniile (doar lângă o poză și doar dacă sunt bune).
const INK = JSON.stringify({ v: 1, paper: 'blank', strokes: [{ tool: 'pen', color: '#000', size: 4, pts: [[1, 2, 0.5], [30, 40, 0.5]] }] });
const dn = read(note({ boxes: [{ id: 'd1', x: 0, y: 0, w: 320, text: '', img: PIC, ink: INK }, { id: 'd2', x: 0, y: 400, w: 320, text: 'x', ink: INK }, { id: 'd3', x: 0, y: 800, w: 320, text: '', img: PIC, ink: '{rau' }] }));
assert.equal(dn.boxes[0].ink, INK); assert.equal(dn.boxes[1].ink, undefined); assert.equal(dn.boxes[2].ink, undefined);

// 9. Grupurile: se păstrează, un grup cu o singură casetă dispare, casetele grupate se mută împreună și rămân în pânză.
const gn = read(note({ boxes: [{ id: 'g1', x: 10, y: 10, w: 200, text: 'a', group: 'gx' }, { id: 'g2', x: 300, y: 10, w: 200, text: 'b', group: 'gx' }, { id: 'g3', x: 0, y: 400, w: 200, text: 'c', group: 'gy' }, { id: 'g4', x: 0, y: 600, w: 200, text: 'd', group: 'R<' }] }));
assert.equal(gn.boxes[0].group, 'gx'); assert.equal(gn.boxes[1].group, 'gx');
assert.equal(gn.boxes[2].group, undefined, 'grup cu o casetă'); assert.equal(gn.boxes[3].group, undefined, 'grup cu nume rău');
assert.deepEqual(m.movingIds(gn.boxes, 'g1'), ['g1', 'g2']);
assert.deepEqual(m.movingIds(gn.boxes, 'g3'), ['g3']);
assert.deepEqual(m.movingIds(gn.boxes, 'g3', new Set(['g3', 'g1'])), ['g1', 'g2', 'g3']);
assert.deepEqual(m.movingIds(gn.boxes, 'g4', new Set(['g3', 'g1'])), ['g4'], 'caseta nealeasă se mută singură');
const sh = m.shiftBoxes(gn.boxes, ['g1', 'g2'], -50, 20);
assert.deepEqual(sh.slice(0, 2).map((b) => [b.x, b.y]), [[0, 30], [290, 30]], 'grupul se oprește la marginea pânzei, tot deodată');
assert.deepEqual(sh[2], gn.boxes[2]);
const g2 = m.groupBoxes(gn.boxes, ['g1', 'g3']);
assert.ok(g2[0].group && g2[0].group === g2[1].group && g2[1].group === g2[2].group, 'grupul vechi intră în cel nou');
assert.equal(g2[3].group, undefined);
assert.equal(m.groupBoxes(gn.boxes, ['g4']), gn.boxes, 'o singură casetă nu face grup');
const u = m.ungroupBox(g2, 'g3');
assert.ok(u.every((b) => !b.group));

console.log('notes-canvas: toate verificările au trecut');
