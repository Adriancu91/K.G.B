// Test: schemele din Notițe (◇ Schemă) se țin minte lângă poza lor (imageDiagram) și rămân la redeschiderea caietului,
// ca să se poată schimba din nou; schemele stricate și pozele fără schemă rămân fără ea.
// Rulare (în suite/): node tests/notes-diagram-store.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-notesdiagram-${process.pid}.mjs`);
await build({ entryPoints: ['src/notes/store.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const IMG = 'data:image/jpeg;base64,AAAA';
const scheme = JSON.stringify({ k: 'funnel', items: ['Vizitatori', 'Clienți', 'Comenzi'], color: '#4f6bed' });
const note = (extra) => ({ id: 'a', title: 't', body: '', created: '2026-10-31T00:00:00Z', updated: '2026-10-31T00:00:00Z', images: [IMG, IMG], ...extra });
const read = (n) => m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [n] })).notes[0];

let n = read(note({ imageDiagram: [null, scheme] }));
assert.equal(n.images.length, 2);
assert.deepEqual(n.imageDiagram.map((x) => x && JSON.parse(x).k), [null, 'funnel'], 'schema rămâne lângă a doua poză');
assert.deepEqual(JSON.parse(n.imageDiagram[1]).items, ['Vizitatori', 'Clienți', 'Comenzi']);
n = read(note({ imageDiagram: ['{stricat', 42] }));
assert.equal(n.imageDiagram, undefined, 'schemele stricate se scot');
n = read(note({ images: [IMG], imageDiagram: [scheme, scheme] }));
assert.equal(n.imageDiagram.length, 1, 'cel mult câte o schemă pe poză');
n = read(note({ images: undefined, imageDiagram: [scheme] }));
assert.equal(n.imageDiagram, undefined, 'fără poze, fără scheme');
console.log('Notițe, scheme ținute minte: toate verificările trec');
