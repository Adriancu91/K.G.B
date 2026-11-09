// Test: ⚡ Analiză rapidă din Sheets (quick.ts): filele și butoanele, partea cu numere a zonei (fără cap și etichete),
// totalul pe rânduri.
// Rulare (în suite/): node tests/sheets-quick.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `suite-quick-${process.pid}.mjs`);
await build({ entryPoints: [join(process.cwd(), 'src/sheets/quick.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { QUICK_TABS, QUICK_ITEMS, colShares, numericPart, rowTotals } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };

check(QUICK_TABS.length === 5 && QUICK_TABS.every(([t]) => QUICK_ITEMS[t]?.length >= 2), '5 file, fiecare cu butoane');
const all = Object.values(QUICK_ITEMS).flat();
check(all.every((i) => i.key && i.icon && i.name && i.title), 'fiecare buton are cheie, pictogramă, nume și explicație');
check(Object.values(QUICK_ITEMS).every((l) => new Set(l.map((i) => i.key)).size === l.length), 'cheile nu se repetă într-o filă');
check(!JSON.stringify(QUICK_ITEMS).match(/Excel|Microsoft/), 'fără nume de produse în texte');

// Tabelul: A1:D4, cap pe rândul 0, etichete în coloana A, numere în B–D (C3 gol).
const grid = [
  ['Lună', 'Vânzări', 'Costuri', 'Note'],
  ['Ian', 10, 4, 'ok'],
  ['Feb', 12, '', 'x'],
  ['Mar', 9, 5, ''],
];
const look = (g) => ({
  filled: (r, c) => g[r]?.[c] !== undefined && g[r][c] !== '',
  num: (r, c) => typeof g[r]?.[c] === 'number',
});
const s = look(grid);
const np = numericPart({ r0: 0, c0: 0, r1: 3, c1: 3 }, s);
check(np && np.r0 === 1 && np.c0 === 1 && np.r1 === 3 && np.c1 === 2, `partea cu numere: fără cap, fără etichete, fără coloana de note (${JSON.stringify(np)})`);
check(numericPart({ r0: 0, c0: 0, r1: 0, c1: 3 }, s) === null, 'doar capul de tabel: nicio parte cu numere');
const same = numericPart({ r0: 1, c0: 1, r1: 3, c1: 2 }, s);
check(same.r0 === 1 && same.c0 === 1 && same.r1 === 3 && same.c1 === 2, 'o zonă doar cu numere rămâne la fel');

const t = rowTotals(np, look(grid.map((row) => row.slice(0, 3))));
check(JSON.stringify(rowTotals(np, s)) === JSON.stringify({ D4: "=SUM(B4:C4)" }), "coloana de note nu se suprascrie (doar rândul cu nota goală)");
check(JSON.stringify(t) === JSON.stringify({ D2: '=SUM(B2:C2)', D3: '=SUM(B3:C3)', D4: '=SUM(B4:C4)' }), `totalul pe rând în coloana din dreapta: ${JSON.stringify(t)}`);
// Coloana din dreapta deja scrisă pe un rând: acel rând se sare.
const g2 = grid.map((row) => row.slice(0, 3));
g2[2][3] = 'scris';
const t2 = rowTotals({ r0: 1, c0: 1, r1: 3, c1: 2 }, look(g2), 'AVERAGE');
check(JSON.stringify(t2) === JSON.stringify({ D2: '=AVERAGE(B2:C2)', D4: '=AVERAGE(B4:C4)' }), 'celula deja scrisă nu se atinge; merge și cu Medie');
const g3 = [['a', 'b'], ['', 'c']];
check(Object.keys(rowTotals({ r0: 0, c0: 0, r1: 1, c1: 1 }, look(g3))).length === 0, 'fără numere: niciun total');

const sh = look(grid.map((row) => row.slice(0, 3)));
const pc = colShares(np, sh, 'pct');
check(JSON.stringify(pc) === JSON.stringify({ B5: '=SUM(B2:B4)/SUM($B$2:$C$4)', C5: '=SUM(C2:C4)/SUM($B$2:$C$4)' }), `% din total sub zonă: ${JSON.stringify(pc)}`);
const rn = colShares(np, sh, 'run');
check(JSON.stringify(rn) === JSON.stringify({ B5: '=SUM($B$2:B4)', C5: '=SUM($B$2:C4)' }), `total cumulat: ${JSON.stringify(rn)}`);
const g4 = grid.map((row) => row.slice(0, 3)); g4.push(['', 'scris']);
check(Object.keys(colShares(np, look(g4), 'pct')).join() === 'C5', 'celula de sub zonă deja scrisă nu se atinge');

console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut.');
process.exit(bad ? 1 : 0);
