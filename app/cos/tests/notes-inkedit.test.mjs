// Test: Notițe → desenul editabil: liniile se păstrează ca text (ink.ts), se citesc înapoi, iar ce e stricat se aruncă.
// Rulare (în suite/): node tests/notes-inkedit.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `suite-inked-${process.pid}.mjs`);
await build({ entryPoints: ['src/notes/ink.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { packInk, unpackInk, cleanInk, MAX_INK } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const ink = { paper: 'grid', strokes: [
  { tool: 'pen', color: '#1d4ed8', size: 6, pts: [[10.123, 20.456, 0.5012], [30, 40, 0.7]] },
  { tool: 'rect', color: '#dc2626', size: 3, pts: [[1, 2, 0.5], [100, 80, 0.5]], round: true },
  { tool: 'erase', color: '#000000', size: 14, pts: [[5, 5, 0.5]] },
] };
const s = packInk(ink);
check(typeof s === 'string', 'desenul devine text');
const back = unpackInk(s);
check(back?.paper === 'grid' && back.strokes.length === 3, 'se citește înapoi: foaia și cele 3 linii');
check(back.strokes[0].pts[0].join() === '10.1,20.5,0.5', 'punctele se rotunjesc (la o zecime)');
check(back.strokes[1].round === true && back.strokes[0].round === undefined, 'colțurile rotunjite se păstrează doar unde erau');
check(back.strokes[2].tool === 'erase', 'radiera rămâne în ordinea ei');
check(packInk({ paper: 'blank', strokes: [] }) === null, 'desenul gol nu se păstrează');
const huge = { paper: 'blank', strokes: [{ tool: 'pen', color: '#000', size: 3, pts: Array.from({ length: 60000 }, (_, i) => [i, i, 0.5]) }] };
check(packInk(huge) === null, `desenul de peste ${MAX_INK} de caractere rămâne doar poză`);
check(unpackInk('nu e json') === null && unpackInk(null) === null && unpackInk('{"v":2,"strokes":[]}') === null, 'textul stricat sau altă versiune: nimic');
const mixed = JSON.stringify({ v: 1, paper: 'ciudat', strokes: [
  { tool: 'pen', color: 'red; x', size: 3, pts: [[1, 1, 1]] },
  { tool: 'foc', color: '#000', size: 3, pts: [[1, 1, 1]] },
  { tool: 'pen', color: '#000', size: 3, pts: [[1, 'a', 1], [2, 2, 0.5]] },
] });
const m = unpackInk(mixed);
check(m?.strokes.length === 1 && m.strokes[0].pts.length === 1 && m.paper === 'blank', 'liniile și punctele stricate se sar, foaia necunoscută devine albă');
const c = cleanInk([s, 'stricat', s, s], 3);
check(c?.length === 3 && c[0] === s && c[1] === null && c[2] === s, 'în caiet: aceeași lungime ca pozele, cele stricate devin null');
check(cleanInk(['stricat'], 1) === undefined && cleanInk([s], 0) === undefined && cleanInk('x', 2) === undefined, 'fără desene bune: nimic');
console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
