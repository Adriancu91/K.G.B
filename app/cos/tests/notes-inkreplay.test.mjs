// Test: Notițe → Desen de mână → ▶ Reluare: ce se vede după primele n puncte (liniile în ordinea lor, ultima tăiată, formele întregi).
// Rulare (în suite/): node tests/notes-inkreplay.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `suite-inkrp-${process.pid}.mjs`);
await build({ entryPoints: ['src/notes/inkReplay.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { partialStrokes, strokePoints } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const P = (n) => Array.from({ length: n }, (_, i) => [i, i, 0.5]);
const strokes = [{ tool: 'pen', pts: P(5) }, { tool: 'rect', pts: P(2) }, { tool: 'marker', pts: P(4) }, { tool: 'erase', pts: P(3) }];
const show = (n) => partialStrokes(strokes, n).map((s) => s.tool + s.pts.length).join(' ');
check(strokePoints(strokes) === 14, 'tot desenul are 14 puncte');
check(show(0) === '', 'la început: nimic');
check(show(3) === 'pen3', 'prima linie pe jumătate');
check(show(5) === 'pen5', 'prima linie întreagă');
check(show(6) === 'pen5 rect2', 'dreptunghiul apare întreg, nu tăiat');
check(show(9) === 'pen5 rect2 marker2', 'a treia linie începe');
check(show(14) === 'pen5 rect2 marker4 erase3' && show(100) === show(14), 'la sfârșit: tot desenul, cu radiera la locul ei');
check(partialStrokes(strokes, 14)[0] === strokes[0], 'liniile întregi nu se copiază (rămân aceleași)');
check(strokes[0].pts.length === 5, 'desenul original nu se schimbă');
console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
