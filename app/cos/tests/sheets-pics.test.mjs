// Test: Sheets → 🖼 Imagine: mărimea de început, mărirea din colț (cu / fără proporții), curățarea datelor și păstrarea în .ssheet.
// Rulare (în suite/): node tests/sheets-pics.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-shpic-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-shpic-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/sheets/pics.ts')};\nexport { emptySheetDoc, parseSheetDoc } from ${src('src/sheets/format.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const { startSize, resized, cleanPics, MAX_PICS, emptySheetDoc, parseSheetDoc } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };

check(JSON.stringify(startSize(1600, 800)) === '{"w":320,"h":160}', 'o poză mare intră cu latura mare de 320 px, cu proporțiile păstrate');
check(JSON.stringify(startSize(40, 20)) === '{"w":40,"h":20}', 'o poză mică intră cât e');
check(JSON.stringify(resized({ w: 100, h: 50 }, 50, 0, true)) === '{"w":150,"h":75}', 'colțul tras: proporțiile rămân');
check(JSON.stringify(resized({ w: 100, h: 50 }, 50, 10, false)) === '{"w":150,"h":60}', 'cu Shift: fără proporții');
check(JSON.stringify(resized({ w: 100, h: 50 }, -500, -500, false)) === '{"w":8,"h":8}', 'nu se poate face mai mică de 8 px');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const good = { id: 'a', src: PNG, r: 2, c: 1, dx: 5, dy: 3, w: 120, h: 60, alt: ' Sigla firmei ' };
const cleaned = cleanPics([good, { ...good, src: 'javascript:alert(1)' }, { ...good, r: 'x' }, { ...good, w: 'mare' }, null, 7], 1048576, 128);
check(cleaned.length === 1 && cleaned[0].alt === 'Sigla firmei', 'doar poza bună rămâne (sursă greșită, rând lipsă, mărime greșită se aruncă)');
check(cleanPics(Array.from({ length: 80 }, (_, i) => ({ ...good, id: 'x' + i })), 1048576, 128).length === MAX_PICS, `cel mult ${MAX_PICS} de poze pe foaie`);
check(cleanPics([{ ...good, c: 500, w: 99999 }], 1048576, 128)[0].c === 127 && cleanPics([{ ...good, w: 99999 }], 1048576, 128)[0].w === 4000, 'coloana și mărimea limitate');

const doc = emptySheetDoc();
doc.sheets[0].pics = [good];
const back = parseSheetDoc(JSON.stringify(doc));
const p = back.sheets[0].pics?.[0];
check(p && p.src === PNG && p.r === 2 && p.c === 1 && p.dx === 5 && p.dy === 3 && p.w === 120 && p.h === 60, 'poza rămâne în fișierul .ssheet, la locul ei');
check(!parseSheetDoc(JSON.stringify(emptySheetDoc())).sheets[0].pics, 'o foaie fără poze nu primește câmpul');

console.log(bad ? `\n${bad} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(bad ? 1 : 0);
