// Test pentru TRIMRANGE (zona fără rândurile / coloanele goale de la margini) și INFO.
// Rulare (în suite/): node tests/formula-trimrange.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-trim-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// Date în B2:D3 (cu un gol în C2), restul zonei A1:F6 e gol.
const cells = { B2: '1', C3: '2', D2: 'x',
  H1: '=ROWS(TRIMRANGE(A1:F6))', H2: '=COLUMNS(TRIMRANGE(A1:F6))', H3: '=SUM(TRIMRANGE(A1:F6))', H4: '=ROWS(TRIMRANGE(A1:F6;2))',
  H5: '=COLUMNS(TRIMRANGE(A1:F6;3;1))', H6: '=ROWS(TRIMRANGE(A1:F6;0;0))', H7: '=TRIMRANGE(N1:N5)', H8: '=TRIMRANGE(A1:F6;4)',
  H9: '=INDEX(TRIMRANGE(A1:F6);1;3)', H10: '=INFO("system")', H11: '=INFO("numfile")', H12: '=INFO("RECALC")', H13: '=INFO("abc")',
  H14: '=INFO("directory")', H15: '=INFO("release")',
  J1: '=TRIMRANGE(B2:D3)' };
const want = { H1: '2', H2: '3', H3: '3', H4: '3', H5: '5', H6: '6', H7: '#REF!', H8: '#VALUE!', H9: 'x', H10: 'pcdos', H11: '2',
  H12: 'Automatic', H13: '#VALUE!', H14: '#N/A', H15: '16.0', J1: '1', L1: 'x', K2: '2' };
const r = evaluateAll(cells, { self: 'Foaia1', sheets: [{ name: 'Foaia1', cells }, { name: 'Foaia2', cells: {} }] });
let fail = 0;
for (const [k, w] of Object.entries(want)) {
  const got = r[k]?.text;
  const ok = got === w;
  console.log(`${ok ? 'ok ' : 'GREȘIT'} ${k} ${cells[k] ?? '(vărsat din J1)'} = ${got}${ok ? '' : ` (trebuia ${w})`}`);
  if (!ok) fail++;
}
if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut');
