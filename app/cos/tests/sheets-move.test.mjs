// Test: mutarea celulelor prin tragere în Sheets (move.ts): conținutul, formatarea și referințele formulelor.
// Rulare (în suite/): node tests/sheets-move.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-move-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-move-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/sheets/move.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { moveFormulaRefs, moveCells, moveTarget } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const eq = (a, b, what) => check(a === b, `${what}: ${a}${a === b ? '' : ' (trebuia ' + b + ')'}`);

// Zona A1:B2 mutată cu 2 rânduri în jos și o coloană la dreapta (→ B3:C4).
const g = { r0: 0, c0: 0, r1: 1, c1: 1 };
eq(moveFormulaRefs('=A1+B2+C1', g, 2, 1, true, 'Foaie1'), '=B3+C4+C1', 'referințele din zonă se mută, C1 rămâne');
eq(moveFormulaRefs('=SUM(A1:B2)', g, 2, 1, true, 'Foaie1'), '=SUM(B3:C4)', 'zona toată în interior se mută');
eq(moveFormulaRefs('=SUM(A1:A9)', g, 2, 1, true, 'Foaie1'), '=SUM(A1:A9)', 'zona care iese din zona mutată rămâne');
eq(moveFormulaRefs('=$A$1*2', g, 2, 1, true, 'Foaie1'), '=$B$3*2', 'referința absolută urmează și ea celula');
eq(moveFormulaRefs('=C4', g, 2, 1, true, 'Foaie1'), '=#REF!', 'celula acoperită de mutare devine #REF!');
eq(moveFormulaRefs('="A1"&A1', g, 2, 1, true, 'Foaie1'), '="A1"&B3', 'textul dintre ghilimele nu se schimbă');
eq(moveFormulaRefs('=Foaie1!A1+A1', g, 2, 1, false, 'Foaie1'), '=Foaie1!B3+A1', 'din altă foaie: doar referința cu numele foii');
eq(moveFormulaRefs("='Foaie 1'!A1:B2", g, 2, 1, false, 'Foaie 1'), "='Foaie 1'!B3:C4", 'numele de foaie între apostrofuri');
eq(moveFormulaRefs('=SUM(A1)', g, 0, 0, true, 'Foaie1'), '=SUM(A1)', 'fără deplasare nu se schimbă nimic');
const t = moveTarget({ r0: 2, c0: 2, r1: 4, c1: 3 }, -10, -10);
check(t.r0 === 0 && t.c0 === 0 && t.r1 === 2 && t.c1 === 1, 'ținta rămâne în tabel: ' + JSON.stringify(t));

// Foaia: A1 = 5, A2 = 7 (aldin), A3 = =A1+A2, D1 = =SUM(A1:A2), iar Foaia 2 are =Foaie1!A2.
const mk = () => [
  { name: 'Foaie1', cells: { A1: '5', A2: '7', A3: '=A1+A2', D1: '=SUM(A1:A2)', C2: 'vechi' }, styles: { A2: { b: true } }, colW: {} },
  { name: 'Foaia 2', cells: { A1: '=Foaie1!A2*2' }, styles: {}, colW: {} },
];
// Mută A1:A2 la C1:C2 (peste „vechi” din C2).
let res = moveCells(mk(), 0, { r0: 0, c0: 0, r1: 1, c1: 0 }, { r0: 0, c0: 2, r1: 1, c1: 2 }, false);
let s = res.sheets[0];
check(s.cells.C1 === '5' && s.cells.C2 === '7' && !s.cells.A1 && !s.cells.A2, 'valorile s-au mutat: ' + JSON.stringify(s.cells));
check(s.styles.C2?.b && !s.styles.A2, 'formatarea s-a mutat');
eq(s.cells.A3, '=C1+C2', 'formula care arăta spre ele');
eq(s.cells.D1, '=SUM(C1:C2)', 'zona din SUM');
eq(res.sheets[1].cells.A1, '=Foaie1!C2*2', 'formula din altă foaie');
eq(res.overwritten, 1, 'o celulă cu date acoperită');
// Mută formula singură: A3 → B5; își păstrează referințele.
res = moveCells(mk(), 0, { r0: 2, c0: 0, r1: 2, c1: 0 }, { r0: 4, c0: 1, r1: 4, c1: 1 }, false);
eq(res.sheets[0].cells.B5, '=A1+A2', 'formula mutată își păstrează referințele');
// Mută tot blocul A1:A3 cu un rând în jos (se suprapune cu el însuși).
res = moveCells(mk(), 0, { r0: 0, c0: 0, r1: 2, c1: 0 }, { r0: 1, c0: 0, r1: 3, c1: 0 }, false);
s = res.sheets[0];
check(!s.cells.A1 && s.cells.A2 === '5' && s.cells.A3 === '7' && s.cells.A4 === '=A2+A3', 'blocul suprapus: ' + JSON.stringify(s.cells));
eq(s.cells.D1, '=SUM(A2:A3)', 'SUM urmează blocul');
eq(res.overwritten, 0, 'nimic acoperit în afara blocului');
// Copiere (Ctrl): originalul rămâne, formula copiată se deplasează.
res = moveCells(mk(), 0, { r0: 0, c0: 0, r1: 2, c1: 0 }, { r0: 0, c0: 1, r1: 2, c1: 1 }, true);
s = res.sheets[0];
check(s.cells.A1 === '5' && s.cells.B1 === '5' && s.cells.B3 === '=B1+B2' && s.cells.A3 === '=A1+A2', 'copierea: ' + JSON.stringify(s.cells));
eq(s.cells.D1, '=SUM(A1:A2)', 'la copiere celelalte formule nu se schimbă');
check(res.sheets[1] === mk()[1] || res.sheets[1].cells.A1 === '=Foaie1!A2*2', 'la copiere cealaltă foaie rămâne');

console.log(bad ? `${bad} GRESELI` : 'Toate testele de mutare trec');
process.exit(bad ? 1 : 0);
