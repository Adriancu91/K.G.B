// Test pentru listele proprii la umplerea automată din Sheets (fill.ts): citirea din fereastră și continuarea listei.
// Rulare (în suite/): node tests/sheet-lists.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-lists-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/fill.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { extendLine, parseLists, setCustomLists, customLists, listsText, cleanLists } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };
const NL = String.fromCharCode(10), CR = String.fromCharCode(13);
const same = (f) => f;
eq('citire: virgule, punct și virgulă, spații', parseLists(' Nord, Sud ,Est;Vest ' + CR + NL + 'Mic, Mediu, Mare'), [['Nord', 'Sud', 'Est', 'Vest'], ['Mic', 'Mediu', 'Mare']]);
eq('o singură valoare nu e listă; dublurile ies', parseLists('Singur' + NL + 'a, A, b'), [['a', 'b']]);
eq('date stricate', cleanLists('x'), []);
eq('fără listă proprie, textul se copiază', extendLine(['Sud'], [1, 2], same), ['Sud', 'Sud']);
setCustomLists([['Nord', 'Sud', 'Est', 'Vest']]);
eq('lista e ținută minte', customLists(), [['Nord', 'Sud', 'Est', 'Vest']]);
eq('Sud → Est, Vest, Nord (o ia de la capăt)', extendLine(['Sud'], [1, 2, 3], same), ['Est', 'Vest', 'Nord']);
eq('litere mari ca modelul', extendLine(['NORD'], [1], same), ['SUD']);
eq('cu pas: Nord, Est → Nord, Est…', extendLine(['Nord', 'Est'], [2, 3], same), ['Nord', 'Est']);
eq('în sus', extendLine(['Est'], [-1], same), ['Sud']);
eq('zilele merg în continuare', extendLine(['luni'], [1], same), ['marți']);
eq('textul pentru fereastră', listsText(customLists()), 'Nord, Sud, Est, Vest');
if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut');
