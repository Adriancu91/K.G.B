// Test: stilurile de celulă cu nume ale utilizatorului se scriu în .xlsx (cellStyleXfs + cellStyles) și se citesc înapoi;
// cele gata făcute (builtinId) și cele goale („Normal 2”) nu se iau ca stiluri noi. Rulare (în suite/): node tests/sheets-cellstyles-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-csxlsx-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const sheet = { name: 'Foaia 1', colW: {}, cells: { A1: '5' }, styles: { A1: { b: true } } };
const cellStyles = [
  { name: 'Preț & taxe', st: { b: true, color: '#c00000', bg: '#fff2cc', fmt: 'lei', dec: 2, align: 'right' } },
  { name: 'Notă mică', st: { i: true, sz: 9 } },
];
const bytes = await writeXlsx([{ sheet, results: {} }], 0, [], false, undefined, undefined, undefined, cellStyles);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/styles.xml').async('string');
let errs = 0;
new DOMParser({ onError: () => { errs++; } }).parseFromString(xml, 'text/xml');
ok(!errs, 'styles.xml rămâne XML valid');
ok(/<cellStyleXfs count="3">/.test(xml) && /<cellStyles count="3">/.test(xml), 'trei stiluri: Normal și cele două noi');
ok(xml.includes('<cellStyle name="Preț &amp; taxe" xfId="1"/>') && xml.includes('<cellStyle name="Notă mică" xfId="2"/>'), 'numele scrise, fără builtinId');
const csx = xml.slice(xml.indexOf('<cellStyleXfs'), xml.indexOf('</cellStyleXfs>'));
ok(!/xfId=/.test(csx), 'xf-urile stilurilor nu au xfId');
const back = await readXlsx(bytes);
ok(back.cellStyles?.length === 2, 'citite înapoi: ' + JSON.stringify(back.cellStyles));
const p = back.cellStyles?.[0];
ok(p?.name === 'Preț & taxe' && p.st.b === true && p.st.color === '#c00000' && p.st.bg === '#fff2cc' && p.st.fmt === 'lei' && p.st.align === 'right', 'primul stil: aldin, culori, monedă, la dreapta');
ok(back.cellStyles?.[1].st.i === true && back.cellStyles?.[1].st.sz === 9, 'al doilea: cursiv, mărimea 9');
ok(back.sheets[0].styles.A1?.b === true, 'formatul celulei rămâne');
const plain = await readXlsx(await writeXlsx([{ sheet, results: {} }]));
ok(plain.cellStyles === undefined, 'fără stiluri noi: câmpul lipsește');

// Un fișier cu stiluri gata făcute (builtinId) și unul gol fără builtinId: nu devin stiluri noi.
const zip = await JSZip.loadAsync(bytes);
zip.file('xl/styles.xml', xml
  .replace('<cellStyle name="Notă mică" xfId="2"/>', '<cellStyle name="Good" xfId="2" builtinId="26"/><cellStyle name="Normal 2" xfId="0"/><cellStyle name="Calculation 2 10 2" xfId="1"/>')
  .replace('<cellStyles count="3">', '<cellStyles count="5">'));
const mixed = await readXlsx(await zip.generateAsync({ type: 'uint8array' }));
ok(mixed.cellStyles?.length === 1 && mixed.cellStyles[0].name === 'Preț & taxe', 'Good (builtinId) și Normal 2 (gol), Calculation 2 10 2 (copie) sărite: ' + JSON.stringify(mixed.cellStyles?.map((s) => s.name)));

// Legătura celulă–stil (✎ Modifică un stil): celula cu sty are xfId spre stilul ei și se citește înapoi cu numele lui.
const linked = { name: 'Foaia 1', colW: {}, cells: { A1: '5', A2: '6' }, styles: { A1: { i: true, sz: 9, sty: 'Notă mică' }, A2: { b: true } } };
const lb = await writeXlsx([{ sheet: linked, results: {} }], 0, [], false, undefined, undefined, undefined, cellStyles);
const lx = await (await JSZip.loadAsync(lb)).file('xl/styles.xml').async('string');
const cellXfs = lx.slice(lx.indexOf('<cellXfs'), lx.indexOf('</cellXfs>'));
ok(/xfId="2"/.test(cellXfs), 'celula legată de „Notă mică” are xfId=2 în cellXfs');
const lback = await readXlsx(lb);
ok(lback.sheets[0].styles.A1?.sty === 'Notă mică' && lback.sheets[0].styles.A1?.i === true, 'A1 citită cu stilul ei: ' + JSON.stringify(lback.sheets[0].styles.A1));
ok(lback.sheets[0].styles.A2?.sty === undefined, 'A2 fără stil cu nume');

console.log(fail ? `${fail} GREȘELI` : 'Toate testele pentru stilurile cu nume în .xlsx trec');
process.exit(fail ? 1 : 0);
