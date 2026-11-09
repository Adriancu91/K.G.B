// Test: Statistici descriptive în Sheets (descstats.ts): valorile comparate cu cele calculate de mână / din tabele statistice.
// Rulare (în suite/): node tests/sheets-descstats.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-descstats-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-descstats-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/sheets/descstats.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { describe, columnsOf, tInv2T, NA, DIV0 } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const near = (a, b, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

// Valorile critice t din tabele (ambele cozi).
check(near(tInv2T(0.05, 9), 2.262157, 1e-5), 't(0,05; 9) = 2,262157: ' + tInv2T(0.05, 9));
check(near(tInv2T(0.05, 1), 12.706205, 1e-5), 't(0,05; 1) = 12,706205: ' + tInv2T(0.05, 1));
check(near(tInv2T(0.01, 30), 2.749996, 1e-5), 't(0,01; 30) = 2,749996: ' + tInv2T(0.01, 30));
check(near(tInv2T(0.05, 1000), 1.962339, 1e-5), 't(0,05; 1000) = 1,962339: ' + tInv2T(0.05, 1000));

// 2, 4, 4, 4, 5, 5, 7, 9: media 5, varianța (eșantion) 32/7, mediana 4,5, modul 4.
const t = describe([{ name: 'Note', values: [2, 4, 4, 4, 5, 5, 7, 9] }]);
const val = (label) => t.find((r) => String(r[0]).startsWith(label))?.[1];
check(t[0][1] === 'Note' && t.length === 17, 'capul: numele coloanei și 16 statistici');
check(near(val('Media'), 5), 'media 5');
check(near(val('Varianța'), 32 / 7), 'varianța 32/7');
check(near(val('Abaterea standard'), Math.sqrt(32 / 7)), 'abaterea standard');
check(near(val('Eroarea standard'), Math.sqrt(32 / 7) / Math.sqrt(8)), 'eroarea standard');
check(near(val('Mediana'), 4.5) && val('Modul') === 4, 'mediana 4,5, modul 4');
check(near(val('Asimetria'), 0.818487553, 1e-6), 'asimetria 0,8185 (ca ASIMETRIE): ' + val('Asimetria'));
check(near(val('Boltirea'), 0.940625, 1e-6), 'boltirea 0,940625 (ca BOLTIRE): ' + val('Boltirea'));
check(val('Amplitudinea') === 7 && val('Minimul') === 2 && val('Maximul') === 9 && val('Suma') === 40 && val('Numărul') === 8, 'amplitudine, minim, maxim, sumă, număr');
check(near(val('Quartila 1'), 4) && near(val('Quartila 3'), 5.5), 'quartilele 4 și 5,5');
check(near(val('Nivel de încredere'), tInv2T(0.05, 7) * Math.sqrt(32 / 7) / Math.sqrt(8)), 'nivelul de încredere 95%: ' + val('Nivel de încredere'));
// Cazuri mici: fără mod (toate diferite), o singură valoare, coloană goală.
const t2 = describe([{ name: 'A', values: [1, 2, 3] }, { name: 'B', values: [7] }, { name: 'C', values: [] }]);
const row = (label) => t2.find((r) => String(r[0]).startsWith(label));
check(row('Modul')[1] === NA, 'fără valori repetate: modul #N/A');
check(row('Boltirea')[1] === DIV0 && near(row('Asimetria')[1], 0), 'trei valori: boltirea #DIV/0!, asimetria 0');
check(row('Abaterea standard')[2] === DIV0 && row('Media')[2] === 7 && row('Numărul')[2] === 1, 'o singură valoare: media 7, abaterea #DIV/0!');
check(row('Media')[3] === DIV0 && row('Numărul')[3] === 0, 'coloană goală: media #DIV/0!, număr 0');

// Coloanele zonei: capul de tabel din primul rând, textul sărit.
const L = (i) => String.fromCharCode(65 + i);
const z = columnsOf([['Preț', 'Cant.'], [10, 1], [12, 'x'], [null, 3]], L);
check(z.cols.length === 2 && z.cols[0].name === 'Preț' && z.cols[0].values.join() === '10,12' && z.cols[1].values.join() === '1,3' && z.skipped === 1, 'cap de tabel, celula goală și textul sărite');
const z2 = columnsOf([[1, 2], [3, 4]], L);
check(z2.cols[0].name === 'Coloana A' && z2.cols[1].values.join() === '2,4', 'fără cap: „Coloana A”, „Coloana B”');
const z3 = columnsOf([['2024', '2025'], [1, 2]], L);
check(z3.cols[0].name === 'Coloana A' && z3.cols[0].values.length === 1, 'un prim rând cu numere scrise ca text nu e luat drept cap');
console.log(bad ? `\n${bad} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(bad ? 1 : 0);
