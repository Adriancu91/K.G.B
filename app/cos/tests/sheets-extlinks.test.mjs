// Test pentru legăturile spre alte registre (=[Buget.xlsx]Foaie1!B2): calculul din valorile păstrate,
// scrierea în .xlsx ([1]Foaie1!B2 + xl/externalLinks/externalLink1.xml) și citirea înapoi.
// Rulare (în suite/): node tests/sheets-extlinks.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-extlinks-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/formula.ts', 'src/sheets/extLinks.ts', 'src/sheets/format.ts', 'src/sheets/odsExport.ts', 'src/sheets/ods.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
const { extFromExcel, extToExcel, cleanLinks } = await import(pathToFileURL(join(dir, 'extLinks.js')).href);
const { parseSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href).catch(() => ({}));
const dir2 = dir;

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const BS = String.fromCharCode(92);

// 1) Calculul: foile registrului extern, cu valorile păstrate.
const links = [{ name: 'Prețuri 2026.xlsx', path: `C:${BS}Date${BS}Prețuri 2026.xlsx`, sheets: [
  { name: 'Lista', cells: { A1: 'Mere', B1: '4,5', A2: 'Pere', B2: '6', A3: 'Prune', B3: '7,25' } },
  { name: 'Foaia mea', cells: { A1: '10', A2: '20', A3: '30' } },
] }];
const cells = {
  A1: "='[Prețuri 2026.xlsx]Lista'!B2*2",
  A2: "=SUM('[Prețuri 2026.xlsx]Foaia mea'!A1:A3)",
  A3: `=VLOOKUP("Prune";'C:${BS}Date${BS}[Prețuri 2026.xlsx]Lista'!A1:B3;2;0)`,
  A4: '=[Alt.xlsx]Foaie1!A1',
  A5: "=SUM('[prețuri 2026.xlsx]LISTA'!B:B)",
};
const res = evaluateAll(cells, { self: 'Calcul', sheets: [], ext: links });
ok(res.A1.value === 12, 'o celulă din alt registru: ' + res.A1.text);
ok(res.A2.value === 60, 'o zonă dintr-o foaie cu spațiu în nume: ' + res.A2.text);
ok(res.A3.value === 7.25, 'VLOOKUP cu dosarul fișierului în față: ' + res.A3.text);
ok(res.A4.err === '#REF!', 'registru necunoscut → #REF!: ' + res.A4.text);
ok(Math.abs(res.A5.value - 17.75) < 1e-9, 'numele fișierului și al foii nu țin cont de litere mari / mici, coloană întreagă: ' + res.A5.text);

// 2) Formula din .xlsx ↔ formula Suite.
const names = { 1: 'Prețuri 2026.xlsx', 2: 'Buget.xlsx' };
ok(extFromExcel("SUM('[1]Foaia mea'!A1:A3)+[2]Total!B2", (n) => names[n] ?? null) === "SUM('[Prețuri 2026.xlsx]Foaia mea'!A1:A3)+'[Buget.xlsx]Total'!B2", 'din .xlsx: [1] devine numele fișierului');
ok(extFromExcel('"[1]Text!A1"&[3]X!A1', (n) => names[n] ?? null) === '"[1]Text!A1"&[3]X!A1', 'textele și registrele fără nume rămân neatinse');
const ls = structuredClone(links);
ok(extToExcel("'[Prețuri 2026.xlsx]Lista'!B2+[Nou.xlsx]Foaie1!A1", ls) === '[1]Lista!B2+[2]Foaie1!A1', 'spre .xlsx: numele devine numărul registrului');
ok(ls.length === 2 && ls[1].name === 'Nou.xlsx' && ls[1].sheets[0].name === 'Foaie1', 'registrul scris de mână se adaugă la listă');

// 3) Scris în .xlsx și citit înapoi.
const results = evaluateAll(cells, { self: 'Calcul', sheets: [], ext: links });
const bytes = await writeXlsx([{ sheet: { name: 'Calcul', colW: {}, cells, styles: {} }, results }], 0, [{ name: 'Lista', ref: "='[Prețuri 2026.xlsx]Lista'!$A$1:$A$3" }],
  false, undefined, undefined, undefined, [], undefined, links);
const zip = await JSZip.loadAsync(bytes);
const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
const wb = await zip.file('xl/workbook.xml').async('string');
const ext1 = await zip.file('xl/externalLinks/externalLink1.xml')?.async('string');
const rels1 = await zip.file('xl/externalLinks/_rels/externalLink1.xml.rels')?.async('string');
const types = await zip.file('[Content_Types].xml').async('string');
let errs = 0;
for (const x of [sheet, wb, ext1 ?? '', rels1 ?? '']) new DOMParser({ onError: () => { errs++; } }).parseFromString(x, 'text/xml');
ok(!errs, 'părțile rămân XML valid');
ok(sheet.includes("<f>'[1]Foaia mea'!A1:A3</f>") || sheet.includes("SUM('[1]Foaia mea'!A1:A3)"), 'formula din foaie scrie [1]');
ok(/<externalReferences><externalReference r:id="rIdExt1"\/><externalReference r:id="rIdExt2"\/><\/externalReferences><definedNames>/.test(wb), 'workbook.xml are externalReferences înaintea numelor');
ok(wb.includes('>[1]Lista!$A$1:$A$3<'), 'numele definit trimite tot la [1]');
ok(!!ext1 && ext1.includes('<sheetName val="Lista"/>') && ext1.includes('<cell r="B1"><v>4.5</v></cell>') && ext1.includes('<cell r="A1" t="str"><v>Mere</v></cell>'), 'externalLink1.xml are foile și valorile');
ok(!!rels1 && rels1.includes('Target="file:///C:/Date/Pre%C8%9Buri%202026.xlsx"') && rels1.includes('TargetMode="External"'), 'legătura spre fișier: ' + (rels1 ?? '').match(/Target="[^"]*"/)?.[0]);
ok(types.includes('/xl/externalLinks/externalLink2.xml'), 'tipurile de conținut le cunosc');
const back = await readXlsx(bytes);
ok(back.sheets[0].cells.A1 === "='[Prețuri 2026.xlsx]Lista'!B2*2", 'citit înapoi, formula are numele fișierului: ' + back.sheets[0].cells.A1);
ok(back.sheets[0].cells.A3.includes("'[Prețuri 2026.xlsx]Lista'!A1:B3"), 'și VLOOKUP: ' + back.sheets[0].cells.A3);
ok(back.links?.length === 2 && back.links[0].name === 'Prețuri 2026.xlsx' && back.links[0].path === 'C:/Date/Prețuri 2026.xlsx', 'registrele citite înapoi: ' + JSON.stringify(back.links?.map((l) => [l.name, l.path])));
ok(back.links?.[0].sheets[0].cells.B3 === '7,25' && back.links[0].sheets[0].cells.A1 === 'Mere', 'cu valorile păstrate');
ok(back.names?.find((n) => n.name === 'Lista')?.ref.includes("'[Prețuri 2026.xlsx]Lista'!"), 'numele definit are tot numele fișierului');
const again = evaluateAll(back.sheets[0].cells, { self: 'Calcul', sheets: [], ext: back.links });
ok(again.A1.value === 12 && again.A2.value === 60 && again.A3.value === 7.25, 'formulele se calculează la fel după redeschidere');
ok(back.asValues === 0 && back.sheets[0].cells.A4 === "='[Alt.xlsx]Foaie1'!A1", 'nicio formulă nu devine valoare (cea spre registrul fără valori rămâne formulă, cu #REF!): ' + back.sheets[0].cells.A4);

// 3b) Editare legături: schimbarea sursei și valorile unui registru citit din fișier.
const { renameExtBook, linkSheetsFrom, extBooksIn } = await import(pathToFileURL(join(dir2, 'extLinks.js')).href);
ok(renameExtBook(`=SUM('[Prețuri 2026.xlsx]Foaia mea'!A1:A3)+[Alt.xlsx]X!A1+'C:${BS}D${BS}[prețuri 2026.xlsx]Lista'!B2`, 'Prețuri 2026.xlsx', 'Prețuri 2027.xlsx')
  === "=SUM('[Prețuri 2027.xlsx]Foaia mea'!A1:A3)+[Alt.xlsx]X!A1+'[Prețuri 2027.xlsx]Lista'!B2", 'Schimbă sursa: doar registrul ales primește numele nou');
ok(JSON.stringify(extBooksIn(`=[A.xlsx]X!A1+'[B c.xlsx]Y'!A1&"[C.xlsx]Z!A1"`)) === '["a.xlsx","b c.xlsx"]', 'registrele pomenite într-o formulă (fără cele din texte)');
const vals = linkSheetsFrom([{ name: 'F', cells: { A1: '2', A2: '=A1*3+1', A3: '="0123"', A4: '=1/0', A5: 'text' } }]);
ok(vals[0].cells.A2 === '7' && vals[0].cells.A3 === "'0123" && vals[0].cells.A4 === '#DIV/0!' && vals[0].cells.A5 === 'text', 'valorile unui registru citit: formulele calculate: ' + JSON.stringify(vals[0].cells));

// 3c) .ods: referințele spre alte registre în forma OpenDocument ['file:///…'#$Foaie.A1].
const { toOdsFormula } = await import(pathToFileURL(join(dir2, 'odsExport.js')).href);
ok(toOdsFormula("=[Prețuri 2026.xlsx]Lista!B2*2", links) === "of:=['file:///C:/Date/Pre%C8%9Buri%202026.xlsx'#$Lista.B2]*2", 'în .ods, fără apostrofuri: ' + toOdsFormula("=[Prețuri 2026.xlsx]Lista!B2*2", links));
ok(toOdsFormula("=SUM('[Prețuri 2026.xlsx]Foaia mea'!A1:A3)+A1", links) === "of:=SUM(['file:///C:/Date/Pre%C8%9Buri%202026.xlsx'#$'Foaia mea'.A1:.A3])+[.A1]", 'în .ods, zonă și foaie cu spațiu: ' + toOdsFormula("=SUM('[Prețuri 2026.xlsx]Foaia mea'!A1:A3)+A1", links));
ok(toOdsFormula("=[Nou.xlsx]F!A1") === "of:=['Nou.xlsx'#$F.A1]", 'registru fără cale: numele, lângă fișier');

// 3d) .ods citit înapoi: formulele spre alt fișier rămân formule, iar valorile păstrate în foaia ascunsă
// (<table:table-source table:mode="copy-results-only">, cum o scriu programele OpenDocument) devin valorile legăturii.
globalThis.DOMParser ??= DOMParser;
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}
const { writeOds } = await import(pathToFileURL(join(dir2, 'odsExport.js')).href);
const { readOds } = await import(pathToFileURL(join(dir2, 'ods.js')).href);
const odsCells = { A1: "='[Prețuri 2026.xlsx]Lista'!B2*2", A2: "=SUM('[Prețuri 2026.xlsx]Foaia mea'!A1:A3)", A3: '=[Nou.xlsx]F!A1+1' };
const odsRes = evaluateAll(odsCells, { self: 'Calcul', sheets: [], ext: links });
const odsBytes = await writeOds([{ sheet: { name: 'Calcul', colW: {}, cells: odsCells, styles: {} }, results: odsRes }], 0, links);
const oz = await JSZip.loadAsync(odsBytes);
let content = await oz.file('content.xml').async('string');
const cache = '<table:table table:name="&apos;file:///C:/Date/Pre%C8%9Buri%202026.xlsx&apos;#$Lista" table:print="false"><table:table-source xlink:type="simple" xlink:href="file:///C:/Date/Pre%C8%9Buri%202026.xlsx" table:table-name="Lista" table:mode="copy-results-only"/>'
  + '<table:table-column table:number-columns-repeated="2"/><table:table-row><table:table-cell office:value-type="string"><text:p>Mere</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="4.5"><text:p>4.5</text:p></table:table-cell></table:table-row>'
  + '<table:table-row><table:table-cell office:value-type="string"><text:p>Pere</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="9"><text:p>9</text:p></table:table-cell></table:table-row></table:table>';
if (!content.includes('xmlns:xlink=')) content = content.replace('<office:document-content ', '<office:document-content xmlns:xlink="http://www.w3.org/1999/xlink" ');
const cache2 = '<table:table table:name="&apos;file:///C:/Date/Pre%C8%9Buri%202026.xlsx&apos;#$&apos;Foaia mea&apos;"><table:table-source xlink:href="file:///C:/Date/Pre%C8%9Buri%202026.xlsx" table:table-name="Foaia mea" table:mode="copy-results-only"/><table:table-column/><table:table-row><table:table-cell office:value-type="float" office:value="10"><text:p>10</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell office:value-type="float" office:value="20"><text:p>20</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell office:value-type="float" office:value="30"><text:p>30</text:p></table:table-cell></table:table-row></table:table>';
content = content.replace('</office:spreadsheet>', cache + cache2 + '</office:spreadsheet>');
oz.file('content.xml', content);
const odsBack = await readOds(new Uint8Array(await oz.generateAsync({ type: 'uint8array' })));
const bc = odsBack.sheets[0]?.cells ?? {};
ok(odsBack.sheets.length === 1, 'foaia ascunsă cu valori nu apare ca foaie: ' + odsBack.sheets.map((x) => x.name).join(', '));
ok(bc.A1 === "='[Prețuri 2026.xlsx]Lista'!B2*2" && bc.A2 === "=SUM('[Prețuri 2026.xlsx]Foaia mea'!A1:A3)" && bc.A3 === "='[Nou.xlsx]F'!A1+1", 'formulele spre alt fișier citite din .ods: ' + JSON.stringify(bc));
const bl = odsBack.links ?? [];
const pl = bl.find((l) => l.name === 'Prețuri 2026.xlsx');
ok(bl.length === 2 && pl?.path === 'C:/Date/Prețuri 2026.xlsx' && !bl.find((l) => l.name === 'Nou.xlsx')?.path, 'legăturile din .ods: ' + JSON.stringify(bl.map((l) => [l.name, l.path])));
ok(pl?.sheets[0]?.name === 'Lista' && pl.sheets[0].cells.B2 === '9' && pl.sheets[0].cells.A1 === 'Mere', 'valorile păstrate în .ods: ' + JSON.stringify(pl?.sheets));
const odsBr = evaluateAll(bc, { self: 'Calcul', sheets: [], ext: bl });
ok(odsBr.A1?.value === 18 && odsBr.A2?.value === 60, 'formula din .ods se calculează din valorile păstrate: ' + JSON.stringify([odsBr.A1, odsBr.A2]));


