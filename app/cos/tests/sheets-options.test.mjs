// Test: Sheets → Fișier → Opțiuni, „Afișează zero” debifat: foaia are noZero, care se scrie în .xlsx (sheetView showZeros="0"),
// se citește înapoi și rămâne în fișierul Suite. Rulare (în suite/): node tests/sheets-options.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-shopt-${process.pid}`);
const entry = join(tmpdir(), `suite-shopt-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { parseSheetDoc } from ${p('src/sheets/format.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx, parseSheetDoc } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

const cells = { A1: '0', A2: '5', A3: '=A1*2' };
const bytes = await writeXlsx([
  { sheet: { name: 'Fără zero', cells, styles: {}, colW: {}, noZero: true }, results: {} },
  { sheet: { name: 'Cu zero', cells, styles: {}, colW: {} }, results: {} },
]);
const zip = await JSZip.loadAsync(bytes);
const s1 = await zip.file('xl/worksheets/sheet1.xml').async('string');
const s2 = await zip.file('xl/worksheets/sheet2.xml').async('string');
ok(/<sheetView[^>]*showZeros="0"/.test(s1), 'foaia 1: showZeros="0" în .xlsx');
ok(!/showZeros/.test(s2), 'foaia 2: fără showZeros');
const back = await readXlsx(bytes);
ok(back.sheets[0].noZero === true, 'noZero citit înapoi din .xlsx');
ok(!back.sheets[1].noZero, 'foaia 2 rămâne cu zero vizibil');
// Și scris de alt program cu showZeros="false".
const zip2 = await JSZip.loadAsync(bytes);
zip2.file('xl/worksheets/sheet2.xml', s2.replace(/<sheetView(?=[ >])/, '<sheetView showZeros="false"'));
const back2 = await readXlsx(await zip2.generateAsync({ type: 'uint8array' }));
ok(back2.sheets[1].noZero === true, 'showZeros="false" se citește la fel');

const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [{ name: 'A', cells: {}, noZero: true }, { name: 'B', cells: {}, noZero: 'da' }] }));
ok(doc.sheets[0].noZero === true, 'noZero păstrat în fișierul Suite');
ok(!doc.sheets[1].noZero, 'o valoare stricată se ignoră');

if (fail) { console.log(`\n${fail} verificări GREȘITE`); process.exit(1); }
console.log('\nToate verificările au trecut');
