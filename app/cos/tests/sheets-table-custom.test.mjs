// Test: stilurile de tabel proprii (Proiectare tabel → ＋ Stil de tabel nou…): cheia din nume și culori, curățarea,
// păstrarea în fișierul Suite, scrierea în .xlsx (<tableStyles> cu dxf-urile lor, numele în tableStyleInfo) și citirea înapoi.
// Rulare (în suite/): node tests/sheets-table-custom.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-tblcustom-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/table.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx, readTableStyles } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const T = await import(pathToFileURL(join(dir, 'table.js')).href);
const F = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

const look = { label: 'Firma mea', head: '#1f4e79', ink: '#ffffff', band: '#deebf7', total: '#bdd7ee', line: '#1f4e79', grid: 'rows' };
const id = T.customStyleId(look);
assert.match(id, /^u_[0-9a-z]+$/, 'cheia începe cu u_');
assert.equal(T.customStyleId({ ...look }), id, 'aceleași culori, aceeași cheie');
assert.notEqual(T.customStyleId({ ...look, band: '#ffffff' }), id, 'altă culoare, altă cheie');
assert.ok(T.isCustomTheme(id) && !T.isCustomTheme('blue'));

// Curățarea: culori greșite scoase, nume cu semne XML refuzate, numele dublat o singură dată, grila fără linie scoasă.
const clean = T.cleanTableStyles([look, { ...look, head: '#fff' }, { label: 'a<b', head: '', band: '', total: '' }, { label: 'Fără linii', head: '#ff0000', band: 'x', total: '', grid: 'all' }]);
assert.equal(clean.length, 2);
assert.equal(clean[0].id, id);
assert.deepEqual({ ...clean[1], id: undefined }, { id: undefined, label: 'Fără linii', head: '#ff0000', band: '', total: '' });
assert.ok(T.TABLE_THEMES[id], 'stilul e în lista stilurilor după curățare');
assert.deepEqual(T.galleryThemes([clean[0]]).slice(-1), [id], 'galeria: stilul propriu la capăt');
assert.ok(!T.galleryThemes([]).includes(clean[1].id), 'galeria nu arată stilurile altor registre');

// Tabelul cu stilul propriu: celulele primesc culorile lui.
const cells = { A1: 'Nume', B1: 'Suma', A2: 'Ana', B2: '10', A3: 'Ion', B3: '20', A4: 'Dan', B4: '5' };
const out = T.formatAsTable(cells, {}, {}, { r0: 0, c0: 0, r1: 3, c1: 1 }, id, { ...T.DEFAULT_TABLE_OPTS, total: false });
assert.equal(out.styles.A1.bg, '#1f4e79', 'capul are culoarea stilului');
assert.equal(out.styles.A1.color, '#ffffff', 'literele capului');
assert.equal(out.styles.A3.bg, '#deebf7', 'dunga');

// Fișierul Suite: stilul și tabelul rămân la redeschidere (stilul înregistrat înaintea tabelelor).
const table = { name: 'Tabel1', r0: 0, c0: 0, r1: 3, c1: 1, theme: id, opts: { ...T.DEFAULT_TABLE_OPTS, total: false } };
delete T.TABLE_THEMES[id];
const doc = F.parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, tableStyles: [look], sheets: [{ name: 'F', cells, styles: out.styles, colW: {}, tables: [table] }] }));
assert.equal(doc.tableStyles?.[0]?.id, id);
assert.equal(doc.sheets[0].tables[0].theme, id, 'tabelul își păstrează stilul propriu');

// .xlsx: <tableStyles> după <dxfs>, numele în tableStyleInfo.
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: out.styles, tables: [table] }, results: {} }], 0, [], false, undefined, undefined, undefined, [], undefined, [], doc.tableStyles);
const zip = await JSZip.loadAsync(bytes);
const txml = await zip.file('xl/tables/table1.xml').async('string');
assert.match(txml, /<tableStyleInfo name="Firma mea"/);
const st = await zip.file('xl/styles.xml').async('string');
assert.match(st, /<\/dxfs><tableStyles count="1"><tableStyle name="Firma mea" pivot="0" count="4">/);
assert.match(st, /<tableStyleElement type="headerRow" dxfId="\d+"\/>/);
assert.ok(st.indexOf('<dxfs') < st.indexOf('<tableStyles'), 'ordinea din styles.xml');

// Citire înapoi: același stil, aceeași cheie, tabelul îl folosește.
const back = await readXlsx(bytes);
assert.equal(back.tableStyles?.length, 1);
assert.deepEqual(back.tableStyles[0], { id, ...look });
assert.equal(back.sheets[0].tables[0].theme, id);

// Stilul cu grilă pe toate celulele și fără total: tot dus-întors.
const g = { label: 'Grilă verde', head: '', band: '#e2efda', total: '', line: '#70ad47', grid: 'all' };
const gs = T.cleanTableStyles([g]);
const gxml = await JSZip.loadAsync(await writeXlsx([{ sheet: { name: 'F', colW: {}, cells, styles: {}, tables: [{ ...table, theme: gs[0].id }] }, results: {} }], 0, [], false, undefined, undefined, undefined, [], undefined, [], gs));
const gback = readTableStyles(await gxml.file('xl/styles.xml').async('string'));
assert.deepEqual(gback.map((x) => ({ ...x, id: undefined })), [{ id: undefined, label: 'Grilă verde', head: '', band: '#e2efda', total: '', line: '#70ad47', grid: 'all' }]);

console.log('ok: stilurile de tabel proprii (cheie, curățare, fișier Suite, .xlsx dus-întors)');
