// Test: ✎ Creion pe pânza liberă din Notițe: liniile scrise direct pe pânză devin o casetă pusă așa încât poza să cadă
// exact unde s-a scris, iar desenul păstrat (pentru ✎) are foaia de 1200 de puncte lățime, cu înălțimea pozei.
// Rulare (în suite/): node tests/notes-canvas-ink.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const entry = join(tmpdir(), `suite-canvasink-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-canvasink-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), 'src/notes', p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, [`export * from ${src('freeCanvas.ts')};`, `export * from ${src('ink.ts')};`].join('\n'));
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true }); rmSync(entry, { force: true });

// 1. O linie de la (100, 200) la (400, 260), grosimea 4: poza o cuprinde, caseta stă cu rama și bara deasupra ei.
const pl = m.inkBoxPlace([{ tool: 'pen', color: '#1f2328', size: 4, pts: [[100, 200, 0.5], [250, 230, 0.5], [400, 260, 0.5]] }]);
assert.ok(pl.x0 <= 97 && pl.x0 >= 90 && pl.y0 <= 197 && pl.y0 >= 190, 'colțul pozei e chiar lângă linie');
assert.ok(pl.x0 + pl.w >= 403 && pl.y0 + pl.h >= 263, 'poza cuprinde toată linia');
assert.deepEqual(pl.box, { x: pl.x0 - 1, y: pl.y0 - 17, w: pl.w + 2 }, 'caseta: rama de 1 px și bara de 16 px deasupra pozei');
// Foaia de desen: lățimea 1200, liniile mutate și mărite la fel.
const k = 1200 / pl.w;
assert.equal(pl.sheetH, Math.round(pl.h * k));
assert.ok(Math.abs(pl.sheet[0].pts[0][0] - (100 - pl.x0) * k) < 1e-9 && Math.abs(pl.sheet[0].size - 4 * k) < 1e-9);
const last = pl.sheet[0].pts[2];
assert.ok(last[0] < 1200 && last[1] < pl.sheetH, 'liniile încap în foaie');

// 2. O liniuță mică: caseta are cel puțin lățimea cea mai mică; lângă marginea pânzei caseta nu iese din ea.
const dot = m.inkBoxPlace([{ tool: 'pen', color: '#dc2626', size: 3, pts: [[5, 5, 0.5]] }]);
assert.equal(dot.box.w, m.BOX_MIN_W);
assert.ok(dot.box.x >= 0 && dot.box.y >= 0);
assert.equal(m.inkBoxPlace([]), null, 'fără linii nu se face casetă');

// 3. Markerul de evidențiere are marginea mai lată (linia lui e mai groasă).
const mk = m.inkBoxPlace([{ tool: 'marker', color: '#f59e0b', size: 6, pts: [[300, 300, 0.5], [500, 300, 0.5]] }]);
assert.ok(mk.y0 <= 300 - 16 && mk.y0 + mk.h >= 300 + 16);

// 4. Desenul păstrat ține minte înălțimea foii; una nepotrivită se ignoră.
const ink = m.unpackInk(m.packInk({ paper: 'blank', strokes: pl.sheet, h: pl.sheetH }));
assert.equal(ink.h, pl.sheetH);
assert.equal(ink.strokes.length, 1);
const bad = JSON.parse(m.packInk({ paper: 'blank', strokes: pl.sheet })); bad.h = 99999;
assert.equal(m.unpackInk(JSON.stringify(bad)).h, undefined);
assert.equal(m.unpackInk(m.packInk({ paper: 'lines', strokes: pl.sheet })).h, undefined, 'desenele obișnuite rămân fără înălțime');

console.log('notes-canvas-ink: toate verificările au trecut');
