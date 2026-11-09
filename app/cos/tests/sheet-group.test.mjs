// Test: gruparea rândurilor și coloanelor din Sheets (niveluri, strângere / desfacere, butoanele 1 2 3, .xlsx dus-întors, inserare).
// Rulare (în suite/): node tests/sheet-group.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

// Pentru citirea .ods în Node (în aplicație e DOMParser-ul ferestrei).
globalThis.DOMParser ??= DOMParser;
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  let p = Object.getPrototypeOf(d.documentElement);
  while (p && !Object.prototype.hasOwnProperty.call(p, 'appendChild')) p = Object.getPrototypeOf(p);
  if (!('children' in d.documentElement)) Object.defineProperty(p ?? Object.getPrototypeOf(d.documentElement), 'children', { get() { return Array.from(this.childNodes).filter((c) => c.nodeType === 1); }, configurable: true });
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}

const dir = join(tmpdir(), `suite-sgroup-${process.pid}`);
await build({ entryPoints: ['src/sheets/group.ts', 'src/sheets/xlsx.ts', 'src/sheets/insert.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error', loader: { '.css': 'empty' } });
const G = await import(pathToFileURL(join(dir, 'group.js')).href);
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const I = await import(pathToFileURL(join(dir, 'insert.js')).href);
const F = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });
let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const J = JSON.stringify;

// Grupare și degrupare: rândurile 2–4 (de la 0: 1..3), apoi 2–3 încă o dată.
let r = G.regroup(undefined, 1, 3, 1);
check(J(r.levels) === J({ 2: 1, 3: 1, 4: 1 }) && r.changed === 3, 'grupează rândurile 2–4 pe nivelul 1');
r = G.regroup(r.levels, 1, 2, 1);
check(J(r.levels) === J({ 2: 2, 3: 2, 4: 1 }), 'grupul din grup: rândurile 2–3 pe nivelul 2');
const lv = r.levels;
check(G.maxLevel(lv) === 2, 'nivelul cel mai mare: 2');
const gs = G.groupsOf(lv);
check(J(gs) === J([{ from: 1, to: 3, level: 1 }, { from: 1, to: 2, level: 2 }]), 'grupurile: 2–4 (nivel 1) și 2–3 (nivel 2)');
check(G.groupAt(gs, 4)?.level === 1 && G.groupAt(gs, 3)?.level === 2 && !G.groupAt(gs, 2), 'butonul: pe rândul 5 pentru grupul mare, pe rândul 4 pentru cel mic');
let full = { ...lv };
for (let i = 0; i < 8; i++) full = G.regroup(full, 1, 1, 1).levels;
check(full['2'] === 7 && G.regroup(full, 1, 1, 1).changed === 0, 'cel mult 7 niveluri');
r = G.regroup(lv, 1, 3, -1);
check(J(r.levels) === J({ 2: 1, 3: 1 }), 'degrupează 2–4: rămâne grupul 2–3 pe nivelul 1');
check(G.regroup({ 2: 1 }, 1, 1, -1).levels === undefined, 'ultimul grup scos: fără niveluri');
check(G.regroup(undefined, 5, 6, -1).changed === 0, 'degrupare fără grup: nimic');
check(J(G.groupsOf({ 2: 1, 3: 1, 6: 1 })) === J([{ from: 1, to: 2, level: 1 }, { from: 5, to: 5, level: 1 }]), 'două grupuri despărțite pe același nivel');

// Strângere / desfacere.
const big = gs[0], small = gs[1];
let hide = G.toggleGroup(undefined, small, true);
check(J(hide) === J([2, 3]) && G.isShut(small, new Set(hide)) && !G.isShut(big, new Set(hide)), 'strânge grupul mic: rândurile 2–3 ascunse');
hide = G.toggleGroup([9, ...hide], big, true);
check(J(hide) === J([2, 3, 4, 9]), 'strânge grupul mare (rândul 9 ascuns de mână rămâne)');
hide = G.toggleGroup(hide, big, false);
check(J(hide) === J([9]), 'desface grupul mare');
check(J(G.showLevel(lv, [9], 1)) === J([2, 3, 4, 9]), 'nivelul 1: toate rândurile grupate ascunse');
check(J(G.showLevel(lv, [9], 2)) === J([2, 3, 9]), 'nivelul 2: se vede rândul 4, cele de nivel 2 nu');
check(J(G.showLevel(lv, [2, 3, 9], 3)) === J([9]), 'nivelul 3: totul desfăcut, rândul 9 rămâne ascuns');

// Citirea din fișier.
check(J(G.cleanLevels({ 2: 1, 3: 9, x: 1, 0: 1, 5: -1, 6: 1.5 }, 100)) === J({ 2: 1, 3: 7 }), 'nivelurile ciudate din fișier se curăță');
const doc = F.parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, sheets: [{ name: 'F', cells: {}, styles: {}, colW: {}, rowLvl: { 2: 1 }, colLvl: { 3: 2 } }] }));
check(J(doc.sheets[0].rowLvl) === J({ 2: 1 }) && J(doc.sheets[0].colLvl) === J({ 3: 2 }), 'fișierul .ssheet păstrează grupurile');

// Inserare / ștergere de rânduri: grupurile se mută.
const base = { name: 'F', cells: { A1: 'x' }, styles: {}, colW: {}, rowLvl: { 3: 1, 4: 1 }, colLvl: { 2: 1 } };
let s = I.shiftSheet(base, 'r', 0, 2);
check(J(s.rowLvl) === J({ 5: 1, 6: 1 }) && J(s.colLvl) === J({ 2: 1 }), 'două rânduri inserate sus: grupul coboară');
s = I.shiftSheet(base, 'r', 2, -1);
check(J(s.rowLvl) === J({ 3: 1 }), 'rândul 3 șters: grupul se micșorează');
s = I.shiftSheet(base, 'c', 0, 1);
check(J(s.colLvl) === J({ 3: 1 }) && J(s.rowLvl) === J({ 3: 1, 4: 1 }), 'coloană inserată: grupul de coloane se mută');

// .xlsx dus-întors.
const sheet = { name: 'Buget', colW: {}, styles: {}, cells: { A1: 'Luna', A2: 'Ian', A3: 'Feb', A4: 'Mar', A5: 'T1', B1: 'Suma', C1: 'Note' }, rowLvl: { 2: 1, 3: 1, 4: 1 }, colLvl: { 2: 1 }, hideRows: [2, 3, 4] };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
check(/<sheetFormatPr defaultRowHeight="15" outlineLevelRow="1" outlineLevelCol="1"\/>/.test(xml), 'în .xlsx: outlineLevelRow / outlineLevelCol');
check(/<row r="2" hidden="1" outlineLevel="1">/.test(xml) && /<row r="4" hidden="1" outlineLevel="1">/.test(xml), 'rândurile grupate și strânse au outlineLevel și hidden');
check(/<col min="2" max="2" width="8.43" outlineLevel="1"\/>/.test(xml), 'coloana B are outlineLevel');
const back = (await readXlsx(bytes)).sheets[0];
check(J(back.rowLvl) === J({ 2: 1, 3: 1, 4: 1 }) && J(back.colLvl) === J({ 2: 1 }) && J(back.hideRows) === J([2, 3, 4]), 'citit înapoi: aceleași grupuri, strânse');
const empty = { name: 'G', colW: {}, styles: {}, cells: { A1: '1' }, rowLvl: { 3: 1 } };
const xml2 = await (await JSZip.loadAsync(await writeXlsx([{ sheet: empty, results: {} }]))).file('xl/worksheets/sheet1.xml').async('string');
check(/<row r="3" outlineLevel="1"><\/row>/.test(xml2), 'un rând gol dar grupat se scrie și el');

// .ods: grupurile din LibreOffice (table-row-group unul în altul, table-column-group), citite ca niveluri.
{
  const odir = join(tmpdir(), `suite-sgroup-ods-${process.pid}`);
  await build({ entryPoints: ['src/sheets/ods.ts'], bundle: true, format: 'esm', platform: 'node', outdir: odir, logLevel: 'error', loader: { '.css': 'empty' } });
  const { readOds } = await import(pathToFileURL(join(odir, 'ods.js')).href);
  rmSync(odir, { recursive: true, force: true });
  const row = (v, extra = '') => `<table:table-row${extra}><table:table-cell office:value-type="string"><text:p>${v}</text:p></table:table-cell></table:table-row>`;
  const content = '<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.3"><office:body><office:spreadsheet><table:table table:name="Foaia1">'
    + '<table:table-column/><table:table-column-group><table:table-column table:number-columns-repeated="2"/></table:table-column-group><table:table-column/>'
    + row('Titlu') + '<table:table-row-group>' + row('Ian') + '<table:table-row-group>' + row('a', ' table:visibility="collapse"') + row('b', ' table:visibility="collapse"') + '</table:table-row-group>' + row('Feb') + '</table:table-row-group>' + row('Total')
    + '</table:table></office:spreadsheet></office:body></office:document-content>';
  const z = new JSZip();
  z.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');
  z.file('content.xml', content);
  const sh = (await readOds(await z.generateAsync({ type: 'uint8array' }))).sheets[0];
  check(J(sh.rowLvl) === J({ 2: 1, 3: 2, 4: 2, 5: 1 }), '.ods: grupurile de rânduri, unul în altul: ' + J(sh.rowLvl));
  check(J(sh.hideRows) === J([3, 4]), '.ods: grupul strâns rămâne strâns');
  check(J(sh.colLvl) === J({ 2: 1, 3: 1 }), '.ods: grupul de coloane B–C');
  check(sh.cells.A6 === 'Total', '.ods: celulele la locul lor');
}

console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
