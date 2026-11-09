// Test: lista principală de surse pentru citări (Docs, citation.ts addToMaster / removeFromMaster / cleanMaster / inMaster).
// Rulare (în suite/): node tests/docs-cite-master.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-citemaster-${process.pid}.mjs`);
await build({ stdin: { contents: "export * from './src/docs/citation.ts';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const M = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const src = (id, author, title, year) => M.cleanSource({ id, kind: 'book', author, title, year });
const a = src('a1', 'Popescu, Ion', 'Istoria orașului', '2020');
const b = src('b1', 'Ionescu, Ana', 'Grădini', '2018');
let m = M.addToMaster([], a);
m = M.addToMaster(m, b);
check('două surse, în ordinea autorilor', m.map((s) => s.id), ['b1', 'a1']);
// Aceeași lucrare cu alt id (din alt document) nu se dublează; păstrează id-ul din listă, cu datele noi.
m = M.addToMaster(m, { ...src('zz', 'Popescu, Ion', 'Istoria orașului', '2020'), publisher: 'Polirom' });
check('aceeași lucrare nu se dublează', m.length, 2);
check('datele noi, id-ul vechi', [m[1].id, m[1].publisher], ['a1', 'Polirom']);
check('inMaster după autor + titlu + an', M.inMaster(m, src('q', 'popescu, ion', 'Istoria orașului', '2020'))?.id, 'a1');
check('alt an = altă sursă', M.inMaster(m, src('q', 'Popescu, Ion', 'Istoria orașului', '2021')), undefined);
check('scoaterea după id', M.removeFromMaster(m, 'a1').map((s) => s.id), ['b1']);
check('citirea din setări sare peste ce nu e sursă', M.cleanMaster([a, { x: 1 }, 'nimic', null, b]).map((s) => s.id), ['b1', 'a1']);
check('setări lipsă = listă goală', M.cleanMaster(undefined), []);
let big = [];
for (let i = 0; i < M.MASTER_MAX + 5; i++) big = [...big, src('s' + i, 'Autor' + i, 'Titlu', '2000')];
check('lista are o limită', M.cleanMaster(big).length, M.MASTER_MAX);
console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
