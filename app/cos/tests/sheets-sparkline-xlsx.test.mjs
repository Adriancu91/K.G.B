// Test pentru minigraficele din Sheets în .xlsx (x14:sparklineGroups): scrise, citite înapoi, cele din altă foaie sărite.
// Rulare (în suite/): node tests/sheets-sparkline-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-sxlsx-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const cells = { A1: '10', B1: '30', C1: '20', D1: '-5', A2: '1', B2: '-1', C2: '1', D2: '1' };
const sparks = [{ at: 'E1', range: 'A1:D1', kind: 'line' }, { at: 'E2', range: 'A2:D2', kind: 'winloss', color: '#19a979' }, { at: 'E3', range: 'A1:D1', kind: 'col' }];
const bytes = await writeXlsx([{ sheet: { name: "Foaia lui Ion's", colW: {}, cells, styles: {}, sparks }, results: {} }]);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
let errs = 0;
new DOMParser({ onError: () => { errs++; } }).parseFromString(xml, 'text/xml');
ok(!errs, 'foaia rămâne XML valid');
ok(xml.includes('<extLst><ext uri="{05C60535-1F16-4fd2-B633-F4F36F0B64E0}"') && xml.trim().endsWith('</extLst></worksheet>'), 'extensia e la sfârșitul foii');
ok(xml.includes("<xm:f>'Foaia lui Ion''s'!A1:D1</xm:f><xm:sqref>E1</xm:sqref>"), 'zona cu numele foii între apostrofuri');
ok(xml.includes('type="stacked"') && xml.includes('type="column"') && xml.includes('rgb="FF19A979"'), 'felurile și culoarea');
const back = (await readXlsx(bytes)).sheets[0];
ok(JSON.stringify(back.sparks) === JSON.stringify(sparks), 'citite înapoi la fel: ' + JSON.stringify(back.sparks));
// Un minigrafic care ia datele din altă foaie se sare; fără minigrafice nu apare extensia.
const other = xml.replace("'Foaia lui Ion''s'!A1:D1</xm:f><xm:sqref>E1", 'Alta!A1:D1</xm:f><xm:sqref>E1');
const zip = await JSZip.loadAsync(bytes); zip.file('xl/worksheets/sheet1.xml', other);
const back2 = (await readXlsx(await zip.generateAsync({ type: 'uint8array' }))).sheets[0];
ok(back2.sparks?.length === 2 && !back2.sparks.some((s) => s.at === 'E1'), 'cel din altă foaie e sărit');
const plain = await writeXlsx([{ sheet: { name: 'F', colW: {}, cells, styles: {} }, results: {} }]);
ok(!(await (await JSZip.loadAsync(plain)).file('xl/worksheets/sheet1.xml').async('string')).includes('extLst'), 'fără minigrafice, fără extensie');
console.log(fail ? `${fail} GREȘELI` : 'TOATE OK');
process.exit(fail ? 1 : 0);
