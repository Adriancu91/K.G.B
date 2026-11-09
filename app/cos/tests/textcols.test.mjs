// Test pentru Text în coloane din Sheets.
// Rulare (în suite/): node tests/textcols.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-textcols-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/textcols.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { splitText, guessDelim } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

assert.deepEqual(splitText('Ion;Popescu;35', ';'), ['Ion', 'Popescu', '35']);
assert.deepEqual(splitText('"Popescu, Ion",12,"a ""b"""', ','), ['Popescu, Ion', '12', 'a "b"']);
assert.deepEqual(splitText('a,,b', ','), ['a', '', 'b']);
assert.deepEqual(splitText('a,,b', ',', true), ['a', 'b']);
assert.deepEqual(splitText('Ion   Popescu', ' '), ['Ion', '', '', 'Popescu']);
assert.deepEqual(splitText('Ion   Popescu', ' ', true), ['Ion', 'Popescu']);
assert.deepEqual(splitText('a--b--c', '--'), ['a', 'b', 'c']);
assert.deepEqual(splitText('fără separator', ';'), ['fără separator']);
assert.equal(guessDelim(['a;b;c', 'd;e;f']), ';');
assert.equal(guessDelim(['a,b', 'c,d']), ',');
assert.equal(guessDelim(['a\tb', 'c\td']), '\t');
assert.equal(guessDelim(['Ion Popescu', 'Ana Ionescu']), ' ');
assert.equal(guessDelim(['1,5;2', '3,25;4']), ';');
console.log('text în coloane: toate verificările trec');
