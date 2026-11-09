// Test pentru inserarea tabelelor în Docs: despărțitorul ghicit, rândurile egalate și tabelul cu antet.
// Rulare (în suite/): node tests/docs-table-insert.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-tblins-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/tableInsert.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { guessSeparator, textToCells, tableJson } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const T = String.fromCharCode(9);
check('Tab are întâietate', guessSeparator([`a${T}b`, 'c;d']), T);
check('apoi punct și virgulă', guessSeparator(['a;b', 'c,d']), ';');
check('apoi virgulă', guessSeparator(['a,b']), ',');
check('fără despărțitor', guessSeparator(['unu', 'doi']), null);
check('celule cu Tab, rânduri egalate', textToCells([`Nume${T}Vârstă${T}Oraș`, `Ana${T}30`, '', `Ion${T}41${T}Iași`]),
  [['Nume', 'Vârstă', 'Oraș'], ['Ana', '30', ''], ['Ion', '41', 'Iași']]);
check('fără despărțitor: o coloană', textToCells(['unu', 'doi']), [['unu'], ['doi']]);
check('spațiile din jur se taie', textToCells(['a ; b']), [['a', 'b']]);
const t = tableJson([['A', 'B'], ['1', '']], true);
check('antet pe primul rând', t.content.map((r) => r.content.map((c) => c.type)), [['tableHeader', 'tableHeader'], ['tableCell', 'tableCell']]);
check('celula goală are paragraf gol', t.content[1].content[1].content, [{ type: 'paragraph', content: [] }]);
check('fără antet', tableJson([['A']], false).content[0].content[0].type, 'tableCell');
console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
