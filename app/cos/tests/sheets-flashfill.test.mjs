// Test pentru Umplerea rapidă din Sheets (Ctrl+E): din exemple, regula și restul coloanei. Rulare (în suite/): node tests/sheets-flashfill.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-flashfill-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/flashfill.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { flashFill } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };
const one = (src, ...outs) => src.map((s, i) => ({ src: Array.isArray(s) ? s : [s], out: outs[i] ?? null }));
const names = ['Ion Popescu', 'Maria Ionescu', 'Andrei Vasile Georgescu', 'elena dobre'];

eq('prenumele', flashFill(one(names, 'Ion')), ['Ion', 'Maria', 'Andrei', 'elena']);
eq('numele de familie (ultimul cuvânt)', flashFill(one(names, 'Popescu')), ['Popescu', 'Ionescu', 'Georgescu', 'dobre']);
eq('inițialele cu punct', flashFill(one(names, 'I.P.')), ['I.P.', 'M.I.', 'A.G.', 'e.d.']);
eq('NUME, Prenume', flashFill(one(names, 'POPESCU, Ion')), ['POPESCU, Ion', 'IONESCU, Maria', 'GEORGESCU, Andrei', 'DOBRE, elena']);
eq('cu două exemple, Prima Literă Mare', flashFill(one(names, 'Popescu Ion', null, null, 'Dobre Elena')), ['Popescu Ion', 'Ionescu Maria', 'Georgescu Andrei', 'Dobre Elena']);
eq('domeniul din e-mail', flashFill(one(['ion@firma.ro', 'ana.pop@scoala.edu.ro', 'x@y.com'], 'firma.ro')), ['firma.ro', 'scoala.edu.ro', 'y.com']);
eq('codul poștal de la final', flashFill(one(['București, 010011', 'Cluj-Napoca, 400001', 'Iași, 700001'], '010011')), ['010011', '400001', '700001']);
eq('din două coloane', flashFill(one([['Ion', 'Popescu'], ['Ana', 'Pop']], 'ion.popescu@firma.ro')), ['ion.popescu@firma.ro', 'ana.pop@firma.ro']);
eq('fără exemple: nimic', flashFill(one(names)), null);
eq('exemple care se contrazic: nimic', flashFill(one(['Ion Popescu', 'Ana Pop'], 'Ion', 'Pop')), null);
eq('rânduri goale rămân goale', flashFill(one(['Ion Popescu', '', 'Ana Pop'], 'Popescu')), ['Popescu', '', 'Pop']);
eq('text fix doar: nu e regulă', flashFill(one(['a b', 'c d'], 'XYZ')), null);
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
