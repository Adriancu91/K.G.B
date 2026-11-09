// Test pentru tabelele cu nume din Sheets (Inserare → Tabel): numele, stilul, scrierea în .xlsx (xl/tables/tableN.xml +
// <tableParts>) și citirea înapoi; cazurile care nu se scriu ca tabel (cap gol, cap repetat), ca fișierul să nu fie „reparat”.
// Rulare (în suite/): node tests/sheets-tables.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-tables-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/table.ts', 'src/sheets/format.ts', 'src/sheets/insert.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const T = await import(pathToFileURL(join(dir, 'table.js')).href);
const F = await import(pathToFileURL(join(dir, 'format.js')).href);
const I = await import(pathToFileURL(join(dir, 'insert.js')).href);
rmSync(dir, { recursive: true, force: true });

// Numele.
assert.equal(T.nextTableName([]), 'Tabel1');
assert.equal(T.nextTableName(['tabel1', 'Tabel2']), 'Tabel3');
assert.ok(T.validTableName('Vânzări_2026'));
assert.ok(!T.validTableName('AB12'), 'arată ca o celulă');
assert.ok(!T.validTableName('1Tabel') && !T.validTableName('Tabel 1') && !T.validTableName('R1C1'));
// Stilurile.
assert.equal(T.themeFromStyle('TableStyleMedium2'), 'blue');
assert.equal(T.themeFromStyle('TableStyleMedium16'), 'blueFrame', 'Medium15–21: cap plin și grilă');
assert.equal(T.themeFromStyle('TableStyleMedium23'), 'blueTint', 'Medium22–28: umplute cu grilă');
assert.equal(T.themeFromStyle('TableStyleMedium1'), 'black', 'Medium1 = negru');
assert.equal(T.themeFromStyle('TableStyleMedium8'), 'blackDark', 'Medium8 = negru intens');
assert.equal(T.themeFromStyle('TableStyleMedium28'), 'greenTint');
for (const c of ['black', 'blue', 'orange', 'gray', 'yellow', 'teal', 'green']) for (const k of [c + 'Frame', c + 'Tint']) assert.equal(T.themeFromStyle(T.tableStyleName({ theme: k })), k, k + ' dus-întors');
for (const k of ['black', 'blackDark']) assert.equal(T.themeFromStyle(T.tableStyleName({ theme: k })), k, k + ' dus-întors');
assert.equal(Object.keys(T.TABLE_THEMES).length, 58, '58 de stiluri');
{
  const lc = { A1: 'Nume', B1: 'Sumă', A2: 'a', B2: '1', A3: 'b', B3: '2' };
  const fo = T.formatAsTable(lc, {}, {}, { r0: 0, c0: 0, r1: 2, c1: 1 }, 'orangeFrame');
  assert.ok(fo.styles.A1.bg === '#ed7d31' && fo.styles.A1.color === '#ffffff' && fo.styles.A1.bd.length === 4 && fo.styles.A3.bg === '#fce4d6' && fo.styles.B2.bd.length === 4 && fo.styles.B2.bdColor === '#ed7d31', 'cap plin portocaliu, grilă portocalie');
  const to = T.formatAsTable(lc, {}, {}, { r0: 0, c0: 0, r1: 2, c1: 1 }, 'greenTint');
  assert.ok(to.styles.A2.bg === '#e2efda' && to.styles.A3.bg === '#c6e0b4' && to.styles.A2.bd.length === 4 && to.styles.A2.bdColor === '#a9d08e' && to.styles.B5.bg === '#c6e0b4', 'tot tabelul verde deschis, dungi mai închise, grilă');
}
assert.equal(T.themeFromStyle('TableStyleMedium9'), 'blueDark', 'al doilea rând al stilurilor medii: albastru intens');
assert.equal(T.themeFromStyle('TableStyleMedium12'), 'yellowDark', 'auriul intens');
assert.equal(T.themeFromStyle('TableStyleMedium13'), 'tealDark', 'turcoazul intens');
assert.equal(T.tableStyleName({ theme: 'yellowDark' }), 'TableStyleMedium12', 'galbenul intens se scrie ca Medium12');
assert.equal(T.tableStyleName({ theme: 'tealDark' }), 'TableStyleMedium13', 'turcoazul intens se scrie ca Medium13');
assert.equal(T.themeFromStyle('TableStyleMedium5'), 'yellow', 'auriul deschis rămâne deschis');
assert.equal(T.tableStyleName({ theme: 'blueDark' }), 'TableStyleMedium9');
assert.equal(T.themeFromStyle(T.tableStyleName({ theme: 'greenDark' })), 'greenDark', 'verde intens dus-întors');
assert.equal(T.themeFromStyle('TableStyleLight14'), 'greenBar', 'Light8–14 = cap plin cu chenar');
assert.equal(T.tableStyleName({ theme: 'green', style: 'TableStyleMedium2' }), 'TableStyleMedium7', 'culoarea schimbată → alt stil');
assert.equal(T.tableStyleName({ theme: 'blueBar', style: 'TableStyleLight9' }), 'TableStyleLight9', 'stilul din fișier se păstrează');
// Stilurile deschise cu linii (cap fără fundal, linie colorată sub cap și deasupra totalului): TableStyleLight1–7 și 15–21.
assert.equal(T.themeFromStyle('TableStyleLight1'), 'blackLine', 'Light1 = negru cu linii');
assert.equal(T.themeFromStyle('TableStyleLight2'), 'blueLine');
assert.equal(T.themeFromStyle('TableStyleLight7'), 'greenLine');
assert.equal(T.themeFromStyle('TableStyleLight16'), 'blueGrid', 'al treilea rând al celor deschise: cu grilă');
assert.equal(T.themeFromStyle('TableStyleLight15'), 'blackGrid');
assert.equal(T.themeFromStyle('TableStyleLight8'), 'blackBar');
for (const k of ['blackLine', 'blueLine', 'orangeLine', 'grayLine', 'yellowLine', 'tealLine', 'greenLine', 'blackBar', 'blueBar', 'orangeBar', 'grayBar', 'yellowBar', 'tealBar', 'greenBar', 'blackGrid', 'blueGrid', 'orangeGrid', 'grayGrid', 'yellowGrid', 'tealGrid', 'greenGrid']) assert.equal(T.themeFromStyle(T.tableStyleName({ theme: k })), k, k + ' dus-întors');
{
  const lc = { A1: 'Nume', B1: 'Sumă', A2: 'a', B2: '1', A3: 'b', B3: '2' };
  const lo = T.formatAsTable(lc, {}, {}, { r0: 0, c0: 0, r1: 2, c1: 1 }, 'blueLine');
  assert.ok(!lo.styles.A1.bg && lo.styles.A1.b && lo.styles.A1.bd.includes('t') && lo.styles.A1.bd.includes('b') && lo.styles.A1.bdColor === '#4472c4', 'capul: fără fundal, aldin, linii albastre sus și jos');
  assert.ok(!lo.styles.A2.bg && lo.styles.A3.bg === '#d9e1f2', 'dungile rămân, deschise');
  assert.ok(lo.totalRow === 4 && !lo.styles.B5.bg && lo.styles.B5.bd === 't' && lo.styles.B5.bdColor === '#4472c4', 'totalul: fără fundal, linie albastră deasupra');
  const look = T.tableLook({ r0: 0, c0: 0, r1: 2, c1: 1, theme: 'blueLine', opts: T.DEFAULT_TABLE_OPTS, style: 'TableStyleLight2' }, {});
  assert.ok(!look.A1.bg && look.A1.bd === 'tb' && look.A1.bdColor === '#4472c4' && look.A3.bg === '#d9e1f2', 'tabelul din .xlsx cu Light2 arată la fel');
}
{
  // Cu cap plin și chenar (Light9): cap albastru cu litere albe, contur în jurul tabelului și o linie sub fiecare rând.
  const lc = { A1: 'Nume', B1: 'Sumă', A2: 'a', B2: '1', A3: 'b', B3: '2' };
  const bo = T.formatAsTable(lc, {}, {}, { r0: 0, c0: 0, r1: 2, c1: 1 }, 'blueBar');
  assert.ok(bo.styles.A1.bg === '#4472c4' && bo.styles.A1.color === '#ffffff' && /t/.test(bo.styles.A1.bd) && /l/.test(bo.styles.A1.bd) && !/r/.test(bo.styles.A1.bd), 'capul plin, alb, contur sus și stânga');
  assert.ok(!bo.styles.A2.bg && bo.styles.A2.bd === 'bl' && bo.styles.B3.bd === 'br' && bo.styles.B2.bdColor === '#4472c4', 'rândurile fără fundal, linie dedesubt, contur pe margini');
  assert.ok(bo.styles.A5.bd.includes('t') && bo.styles.A5.bd.includes('l'), 'totalul închide conturul');
  // Cu grilă (Light16): linii în jurul fiecărei celule, dungi deschise, cap fără fundal.
  const go = T.formatAsTable(lc, { B2: { bd: 'b', bdColor: '#ff0000' } }, {}, { r0: 0, c0: 0, r1: 2, c1: 1 }, 'blueGrid');
  assert.ok(!go.styles.A1.bg && go.styles.A1.b && go.styles.A1.bd.length === 4 && go.styles.A3.bg === '#d9e1f2' && go.styles.B2.bd.length === 4 && go.styles.B2.bdColor === '#8ea9db', 'grilă pe toate celulele');
  const gl = T.tableLook({ r0: 0, c0: 0, r1: 2, c1: 1, theme: 'blueGrid', opts: T.DEFAULT_TABLE_OPTS, style: 'TableStyleLight16' }, {});
  assert.ok(gl.A1.bd.length === 4 && gl.A2.bd.length === 4 && !gl.A2.bg && gl.A3.bg === '#d9e1f2', 'tabelul din .xlsx cu Light16 arată la fel');
  const bl = T.tableLook({ r0: 0, c0: 0, r1: 2, c1: 1, theme: 'blueBar', opts: T.DEFAULT_TABLE_OPTS, style: 'TableStyleLight9' }, {});
  assert.ok(bl.A1.bg === '#4472c4' && bl.B3.bd === 'br' && bl.B3.bdColor === '#4472c4', 'tabelul din .xlsx cu Light9 arată la fel');
  const gr = T.growTables([{ name: 'T', r0: 0, c0: 0, r1: 2, c1: 1, theme: 'blueGrid', opts: T.DEFAULT_TABLE_OPTS }], { ...lc, A4: 'c' }, {}, ['A4']);
  assert.ok(gr && gr.styles.A4.bd.length === 4 && gr.styles.B4.bdColor === '#8ea9db', 'rândul nou primește grila');
}
// Stilurile întunecate (tot tabelul colorat, litere albe): TableStyleDark1–7 dus-întors.
assert.equal(T.themeFromStyle('TableStyleDark1'), 'grayNight', 'Dark1 = negru');
assert.equal(T.themeFromStyle('TableStyleDark2'), 'blueNight');
assert.equal(T.themeFromStyle('TableStyleDark3'), 'orangeNight');
assert.equal(T.themeFromStyle('TableStyleDark7'), 'greenNight');
assert.equal(T.themeFromStyle('TableStyleDark5'), 'yellowNight', 'Dark5 = auriu întunecat');
assert.equal(T.themeFromStyle('TableStyleDark4'), 'silverNight', 'Dark4 = gri întunecat');
assert.equal(T.themeFromStyle('TableStyleDark6'), 'tealNight', 'Dark6 = turcoaz întunecat');
assert.equal(T.themeFromStyle('TableStyleDark9'), 'blueDark', 'Dark8–11: corp deschis, cap închis → intens');
for (const k of ['grayNight', 'blueNight', 'orangeNight', 'greenNight', 'silverNight', 'yellowNight', 'tealNight']) assert.equal(T.themeFromStyle(T.tableStyleName({ theme: k })), k, k + ' dus-întors');
assert.equal(T.tableStyleName({ theme: 'blueNight' }), 'TableStyleDark2');
{
  const cells = { A1: 'Nume', B1: 'Suma', A2: 'a', B2: '1', A3: 'b', B3: '2', A4: 'c', B4: '3' };
  const g = { r0: 0, c0: 0, r1: 3, c1: 1 };
  const out = T.formatAsTable(cells, {}, {}, g, 'blueNight');
  const th = T.TABLE_THEMES.blueNight;
  assert.equal(out.styles.A1.bg, th.head); assert.equal(out.styles.A1.color, '#ffffff', 'capul alb');
  assert.equal(out.styles.A2.bg, th.body, 'rândul fără dungă are culoarea corpului');
  assert.equal(out.styles.A3.bg, th.band, 'dunga');
  assert.equal(out.styles.B2.color, '#ffffff', 'literele albe în corp');
  assert.equal(out.styles.A6.color, '#ffffff', 'și la total'); assert.equal(out.styles.A6.bg, th.total);
  // Înapoi la un stil deschis: albul pus de stilul întunecat dispare, fundalul corpului la fel.
  const back = T.formatAsTable(cells, out.styles, {}, g, 'blue');
  assert.equal(back.styles.B2.color, undefined); assert.equal(back.styles.A2.bg, undefined); assert.equal(back.styles.A1.color, undefined);
  // Tabelul citit din .xlsx (tableLook) și lungit (growTables) primesc tot culorile corpului.
  const t = { name: 'T', r0: 0, c0: 0, r1: 3, c1: 1, theme: 'greenNight', opts: T.DEFAULT_TABLE_OPTS };
  const look = T.tableLook(t, {});
  assert.equal(look.A2.bg, T.TABLE_THEMES.greenNight.body); assert.equal(look.A2.color, '#ffffff'); assert.equal(look.A3.bg, T.TABLE_THEMES.greenNight.band);
  const gr = T.growTables([t], { ...cells, A5: 'd' }, {}, ['A5']);
  assert.equal(gr.tables[0].r1, 4); assert.equal(gr.styles.A5.bg, T.TABLE_THEMES.greenNight.band, 'rândul nou e dungă'); assert.equal(gr.styles.B5.color, '#ffffff');
}

const opts = { ...T.DEFAULT_TABLE_OPTS, total: false };
const cells = { A1: 'Nume', B1: 'Suma', C1: 'Oraș', A2: 'Ana', B2: '10', C2: 'Cluj', A3: 'Ion', B3: '20', C3: 'Iași', A4: 'Dan', B4: '5', C4: 'Arad' };
const table = { name: 'Tabel1', r0: 0, c0: 0, r1: 3, c1: 2, theme: 'blue', opts };
// Curățarea la deschiderea fișierului Suite.
assert.deepEqual(T.cleanTables([table, { ...table, name: 'tabel1' }, { ...table, name: 'A1' }, { ...table, r1: -1, name: 'X' }]).map((t) => t.name), ['Tabel1']);
const doc = F.parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, sheets: [{ name: 'F', cells, styles: {}, colW: {}, tables: [table] }] }));
assert.equal(doc.sheets[0].tables?.[0]?.name, 'Tabel1', 'tabelul rămâne la redeschiderea fișierului Suite');

// Scriere .xlsx.
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, tables: [table], filter: { r: 0, c0: 0, c1: 2, hidden: {} } }, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
const txml = await zip.file('xl/tables/table1.xml')?.async('string');
assert.ok(txml, 'xl/tables/table1.xml există');
assert.match(txml, /displayName="Tabel1" ref="A1:C4"/);
assert.match(txml, /<autoFilter ref="A1:C4"\/>/);
assert.match(txml, /<tableColumn id="1" name="Nume"\/><tableColumn id="2" name="Suma"\/><tableColumn id="3" name="Oraș"\/>/);
assert.match(txml, /TableStyleMedium2/);
const sxml = await zip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(sxml, /<tableParts count="1"><tablePart r:id="rIdT1"\/><\/tableParts>/);
assert.ok(!sxml.includes('<autoFilter'), 'filtrul foii nu se dublează peste tabel');
assert.match(await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string'), /Id="rIdT1"[^>]*Target="\.\.\/tables\/table1\.xml"/);
assert.match(await zip.file('[Content_Types].xml').async('string'), /\/xl\/tables\/table1\.xml/);

// Citire înapoi: tabelul, numele, filtrul, culoarea; capul colorat pus în celule.
const back = (await readXlsx(bytes)).sheets[0];
assert.equal(back.tables?.length, 1);
assert.deepEqual({ ...back.tables[0], opts: undefined }, { name: 'Tabel1', r0: 0, c0: 0, r1: 3, c1: 2, theme: 'blue', style: 'TableStyleMedium2', opts: undefined });
assert.equal(back.tables[0].opts.filter, true);
assert.equal(back.tables[0].opts.bandRows, true);
assert.ok(back.styles.A1?.bg && back.styles.A1?.b, 'capul e colorat și aldin');
assert.ok(back.styles.A3?.bg && !back.styles.A2?.bg, 'rândurile alternante');

// Cap repetat sau gol: nu se scrie ca tabel (doar culorile), ca fișierul să se deschidă fără „reparare”.
for (const bad of [{ ...cells, C1: 'nume' }, { ...cells, B1: '' }]) {
  const z = await JSZip.loadAsync(await writeXlsx([{ sheet: { name: 'F', colW: {}, cells: bad, styles: {}, tables: [table] }, results: {} }]));
  assert.ok(!z.file('xl/tables/table1.xml'), 'tabel nescris');
  assert.ok(!(await z.file('xl/worksheets/sheet1.xml').async('string')).includes('tableParts'));
}
// Două foi cu câte un tabel: numere diferite.
const two = await JSZip.loadAsync(await writeXlsx([
  { sheet: { name: 'A', colW: {}, cells, styles: {}, tables: [table] }, results: {} },
  { sheet: { name: 'B', colW: {}, cells, styles: {}, tables: [{ ...table, name: 'Tabel2', theme: 'green' }] }, results: {} },
]));
assert.match(await two.file('xl/tables/table2.xml').async('string'), /id="2" name="Tabel2"[^>]*>.*TableStyleMedium7/s);
// Tabelul se lungește cu rândul scris imediat sub el (cu dunga și formatul de deasupra).
const st = { B4: { fmt: 'money', dec: 2 } };
let g = T.growTables([table], { ...cells, A5: 'Eva' }, st, ['A5']);
assert.equal(g?.tables[0].r1, 4, 'A5 scris sub tabel → tabelul ajunge la rândul 5');
assert.deepEqual(g.grown, ['Tabel1']);
assert.ok(g.styles.A5?.bg && g.styles.B5?.fmt === 'money', 'dunga (rândul 4 de date) și formatul lei');
g = T.growTables([table], { ...cells, A5: 'Eva', A6: 'Ivo', B6: '3' }, {}, ['A5', 'A6', 'B6']);
assert.equal(g?.tables[0].r1, 5, 'două rânduri lipite deodată');
assert.equal(T.growTables([table], { ...cells, A6: 'x' }, {}, ['A6']), null, 'un rând mai jos (cu gol între) nu intră');
assert.equal(T.growTables([table], { ...cells, D5: 'x' }, {}, ['D5']), null, 'în afara coloanelor tabelului nu intră');
assert.equal(T.growTables([table], { ...cells, A5: 'x', C5: 'vechi' }, {}, ['A5']), null, 'rândul avea deja date (alt tabel / alt text)');
assert.equal(T.growTables([table], { ...cells, A5: 'x', A6: 'Total', B6: '=SUBTOTAL(9;B2:B4)' }, {}, ['A5']), null, 'deasupra rândului de total nu se lungește');
assert.equal(T.growTables([{ ...table, style: 'TableStyleNone' }], { ...cells, A5: 'Eva' }, {}, ['A5']).styles.A5, undefined, 'fără stil: fără culori');
// Inserarea / ștergerea de rânduri și coloane mută tabelul.
const sh = { name: 'F', cells, styles: {}, colW: {}, tables: [table] };
assert.deepEqual(I.shiftSheet(sh, 'r', 0, 2).tables[0], { ...table, r0: 2, r1: 5 }, 'două rânduri inserate deasupra');
assert.deepEqual(I.shiftSheet(sh, 'r', 2, 1).tables[0], { ...table, r1: 4 }, 'un rând inserat în tabel îl lungește');
assert.deepEqual(I.shiftSheet(sh, 'r', 1, -1).tables[0], { ...table, r1: 2 }, 'un rând șters îl scurtează');
assert.deepEqual(I.shiftSheet(sh, 'c', 1, -1).tables[0], { ...table, c1: 1 }, 'o coloană ștearsă');
assert.equal(I.shiftSheet(sh, 'r', 0, -4).tables, undefined, 'tabelul șters de tot dispare');
// Coloanele calculate: formula scrisă într-o coloană goală a tabelului se completează pe toată coloana (mutată rând cu rând).
{
  const t = { name: 'Calc', r0: 0, c0: 0, r1: 3, c1: 2, theme: 'blue', opts: { ...T.DEFAULT_TABLE_OPTS } };
  const base = { A1: 'Nume', B1: 'Ore', C1: 'Dublu', A2: 'Ana', B2: '2', A3: 'Ion', B3: '5', A4: 'Eva', B4: '7' };
  let k = T.calcColumns([t], [t], base, { ...base, C3: '=B3*2' }, ['C3']);
  assert.deepEqual(k.cells, { C2: '=B2*2', C4: '=B4*2' }, 'toată coloana, cu referințele mutate');
  assert.deepEqual(k.filled, ['Calc']);
  k = T.calcColumns([t], [t], base, { ...base, C2: '=B2*$B$2' }, ['C2']);
  assert.deepEqual(k.cells, { C3: '=B3*$B$2', C4: '=B4*$B$2' }, 'referințele cu $ rămân');
  // Coloana avea deja formula calculată: o formulă nouă le înlocuiește pe toate.
  const calc = { ...base, C2: '=B2*2', C3: '=B3*2', C4: '=B4*2' };
  k = T.calcColumns([t], [t], calc, { ...calc, C4: '=B4*3' }, ['C4']);
  assert.deepEqual(k.cells, { C2: '=B2*3', C3: '=B3*3' }, 'coloana calculată primește formula nouă');
  // Coloana are valori scrise de mână: nu se atinge nimic.
  const mixed = { ...base, C2: '4', C4: '=B4*2' };
  assert.deepEqual(T.calcColumns([t], [t], mixed, { ...mixed, C3: '=B3*2' }, ['C3']).cells, {}, 'valorile de mână rămân');
  assert.deepEqual(T.calcColumns([t], [t], base, { ...base, C3: '10' }, ['C3']).cells, {}, 'un număr nu e formulă');
  assert.deepEqual(T.calcColumns([t], [t], base, { ...base, C1: '=B1' }, ['C1']).cells, {}, 'capul tabelului nu se completează');
  assert.deepEqual(T.calcColumns([t], [t], base, { ...base, C3: '=B3', C4: '=B4' }, ['C3', 'C4']).cells, {}, 'lipirea mai multor celule nu completează');
  // Tabelul se lungește: rândul nou primește formula coloanei calculate.
  const g2 = T.growTables([t], { ...calc, A5: 'Dan' }, {}, ['A5']);
  k = T.calcColumns([t], g2.tables, calc, { ...calc, A5: 'Dan' }, ['A5']);
  assert.deepEqual(k.cells, { C5: '=B5*2' }, 'rândul nou primește formula');
  assert.deepEqual(k.filled, [], 'fără mesaj la rândul nou');
  const g3 = T.growTables([t], { ...base, A5: 'Dan' }, {}, ['A5']);
  assert.deepEqual(T.calcColumns([t], g3.tables, base, { ...base, A5: 'Dan' }, ['A5']).cells, {}, 'fără coloane calculate: nimic');
}
console.log('tabele cu nume: toate verificările trec');
