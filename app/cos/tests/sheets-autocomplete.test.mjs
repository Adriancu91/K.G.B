// Test pentru completarea automată din coloană (Sheets, autocomplete.ts).
// Rulare (în suite/): node tests/sheets-autocomplete.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-autocomplete-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/autocomplete.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { autoComplete, columnTexts } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

const list = ['București', 'Brașov', 'Cluj-Napoca', 'Constanța', 'Iași'];
ok(autoComplete('Bu', list) === 'București', 'Bu → București');
ok(autoComplete('bu', list) === 'bucurești', 'literele scrise rămân cum le-ai scris: bu → bucurești');
ok(autoComplete('B', list) === null, 'B: două orașe încep așa, nu ghicim');
ok(autoComplete('Br', list) === 'Brașov', 'Br → Brașov');
ok(autoComplete('C', list) === null && autoComplete('Co', list) === 'Constanța', 'C: nimic; Co → Constanța');
ok(autoComplete('iaș', list) === 'iași', 'diacriticele: iaș → iași');
ok(autoComplete('Iași', list) === null, 'textul scris întreg: nimic de adăugat');
ok(autoComplete('X', list) === null, 'niciun text potrivit');
ok(autoComplete('=SU', ['=SUM(A1)', 'SUMA']) === null, 'formulele nu se completează');
ok(autoComplete('12', ['123', '12 mere']) === null, 'numerele nu se completează');
ok(autoComplete('Ion', ['Ion', 'Ion Popescu']) === null, '„Ion” există singur: nu se completează spre „Ion Popescu”');
ok(autoComplete('ma', ['Mere', 'mere', 'MERE']) === null && autoComplete('me', ['Mere', 'mere']) === 'mere', 'același text scris diferit nu încurcă');

// Coloana: blocul lipit de rândul editat, în sus și în jos, până la prima celulă goală.
const grid = { '0,0': 'Oraș', '1,0': 'București', '2,0': 'Brașov', '3,0': '=A2', '4,0': '15', '6,0': 'Constanța', '8,0': 'Iași', '1,1': 'Altă coloană' };
const get = (r, c) => grid[`${r},${c}`];
const t5 = columnTexts(get, 5, 0, 100);
ok(JSON.stringify(t5.sort()) === JSON.stringify(['Brașov', 'București', 'Constanța', 'Oraș'].sort()), 'rândul 6: textele din bloc (fără formule și numere, fără ce e după un gol): ' + JSON.stringify(t5));
ok(!columnTexts(get, 10, 0, 100).length, 'după un gol: nimic');
ok(columnTexts(get, 7, 0, 100).includes('Iași') && columnTexts(get, 7, 0, 100).includes('Constanța'), 'și de dedesubt');
ok(!columnTexts(get, 5, 0, 100).includes('Altă coloană'), 'doar din aceeași coloană');
console.log(fail ? `${fail} GREȘELI` : 'Toate testele trec.');
process.exit(fail ? 1 : 0);
