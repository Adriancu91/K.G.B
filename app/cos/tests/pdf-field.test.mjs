// Test pentru numele câmpurilor de formular noi din PDF: fără puncte, „Câmp” dacă e gol, unice (Nume, Nume 2…).
// Rulare (în suite/): node tests/pdf-field.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pdffield-${process.pid}.mjs`);
await build({ entryPoints: ['src/pdf/sign.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { fieldName } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const taken = new Set(['Nume']);
check('nume ocupat → „Nume 2”', fieldName('Nume', taken) === 'Nume 2');
check('încă unul → „Nume 3”', fieldName(' Nume ', taken) === 'Nume 3');
check('gol → „Câmp”', fieldName('', taken) === 'Câmp' && fieldName(undefined, taken) === 'Câmp 2');
check('fără puncte', fieldName('Nume.complet', taken) === 'Nume complet');
check('diacritice păstrate', fieldName('Județ', taken) === 'Județ');

console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
