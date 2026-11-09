// Test: Sheets, numerele scrise ca text (triunghiul verde): isNumText, „Ignorare eroare” (ign) scris în .xlsx ca ignoredErrors,
// citit înapoi și păstrat în fișierul Suite. Rulare (în suite/): node tests/sheets-numtext.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-numtext-${process.pid}`);
const entry = join(tmpdir(), `suite-numtext-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { parseSheetDoc } from ${p('src/sheets/format.ts')};
export { isNumText } from ${p('src/sheets/errcheck.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx, parseSheetDoc, isNumText } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

ok(isNumText("'123") && isNumText("'12,5") && isNumText("' 7"), 'numerele cu apostrof sunt numere scrise ca text');
ok(!isNumText('123') && !isNumText("'abc") && !isNumText("'") && !isNumText(undefined), 'textele și numerele obișnuite nu sunt');

const cells = { A1: "'100", A2: "'200", B1: "'7", C1: 'text' };
const bytes = await writeXlsx([{ sheet: { name: 'F', cells, styles: { A2: { ign: true }, B1: { b: true, ign: true }, C1: { ign: true } }, colW: {} }, results: {} }]);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
ok(/<ignoredErrors><ignoredError sqref="A2 B1" numberStoredAsText="1"\/><\/ignoredErrors>/.test(xml), 'ignoredErrors scris doar pentru A2 și B1: ' + (xml.match(/<ignoredErrors>.*?<\/ignoredErrors>/) ?? [''])[0]);
ok(xml.indexOf('<ignoredErrors>') > xml.indexOf('</sheetData>'), 'ignoredErrors după sheetData');
const back = await readXlsx(bytes);
const st = back.sheets[0].styles;
ok(back.sheets[0].cells.A1 === "'100" && back.sheets[0].cells.A2 === "'200", 'textele rămân text: ' + JSON.stringify(back.sheets[0].cells));
ok(st.A2?.ign === true && st.B1?.ign === true && st.B1?.b === true, 'ign citit înapoi: ' + JSON.stringify(st));
ok(!st.A1?.ign && !st.C1?.ign, 'A1 (neignorată) și C1 (text) fără ign');
// Zone cu $ și intervale, scrise de alt program.
const zip2 = await JSZip.loadAsync(bytes);
zip2.file('xl/worksheets/sheet1.xml', xml.replace(/<ignoredErrors>.*?<\/ignoredErrors>/, '<ignoredErrors><ignoredError sqref="$A$1:A2" numberStoredAsText="1"/></ignoredErrors>'));
const back2 = await readXlsx(await zip2.generateAsync({ type: 'uint8array' }));
ok(back2.sheets[0].styles.A1?.ign === true && back2.sheets[0].styles.A2?.ign === true && !back2.sheets[0].styles.B1?.ign, 'zona $A$1:A2 citită');

const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [{ name: 'A', cells: { A1: "'1" }, styles: { A1: { ign: true }, A2: { ign: 'da' } } }] }));
ok(doc.sheets[0].styles.A1?.ign === true && !doc.sheets[0].styles.A2, 'ign păstrat în fișierul Suite, valoarea stricată ignorată');

if (fail) { console.log(`\n${fail} verificări GREȘITE`); process.exit(1); }
console.log('\nToate verificările au trecut');
