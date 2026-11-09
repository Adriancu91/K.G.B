// Test: Sheets → ⬠ Forme / ▤ Casetă de text: citirea descrierii formei, împărțirea textului pe rânduri și păstrarea în .ssheet.
// Rulare (în suite/): node tests/sheets-shapes.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-shshape-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-shshape-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/sheets/shapeBox.ts')};\nexport { cleanPics } from ${src('src/sheets/pics.ts')};\nexport { emptySheetDoc, parseSheetDoc } from ${src('src/sheets/format.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const { parseShapeBox, wrapText, textInset, TEXT_BOX, cleanPics, emptySheetDoc, parseSheetDoc } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };

const ok1 = parseShapeBox({ k: 'ellipse', fill: '#FF0000', stroke: '', sw: 3, text: 'Total\r\nlunar', tc: '#00FF00', fs: 200, b: true, al: 'r' });
check(ok1 && ok1.k === 'ellipse' && ok1.fill === '#ff0000' && ok1.stroke === '' && ok1.text === 'Total\nlunar' && ok1.tc === '#00ff00' && ok1.fs === 72 && ok1.b === true && ok1.al === 'r',
  'descrierea formei: culori mici, rânduri noi păstrate, mărimea textului cel mult 72: ' + JSON.stringify(ok1));
check(parseShapeBox({ k: 'nimic', fill: '#ff0000' }) === null, 'o formă necunoscută e refuzată');
check(parseShapeBox(null) === null && parseShapeBox('text') === null, 'date stricate: nimic');
const d = parseShapeBox({ k: 'rect' });
check(d && d.text === '' && d.tc === '#000000' && d.fs === 14 && d.al === 'c' && !d.b, 'lipsurile primesc valori obișnuite');
check(parseShapeBox({ k: 'star', text: 'x'.repeat(5000) }).text.length === 2000, 'textul e tăiat la 2000 de caractere');
check(TEXT_BOX.k === 'rect' && TEXT_BOX.al === 'l' && TEXT_BOX.fill === '#ffffff', 'caseta de text: dreptunghi alb, text la stânga');
check(textInset('ellipse').x > textInset('rect').x && textInset('triangle').y > textInset('rect').y, 'formele rotunde și triunghiul lasă mai puțin loc textului');

// Fiecare literă are 10 px lățime.
const m = (s) => s.length * 10;
check(JSON.stringify(wrapText('unu doi trei patru', 80, m)) === '["unu doi","trei","patru"]', 'textul se împarte pe rânduri care încap');
check(JSON.stringify(wrapText('a\n\nb', 80, m)) === '["a","","b"]', 'rândurile goale rămân');
check(JSON.stringify(wrapText('abcdefghijkl', 50, m)) === '["abcde","fghij","kl"]', 'un cuvânt prea lung se rupe pe litere');
check(JSON.stringify(wrapText('', 50, m)) === '[""]', 'fără text: un rând gol');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const pics = cleanPics([{ id: 'f1', src: PNG, r: 1, c: 2, w: 200, h: 120, sh: { k: 'callout', fill: '#ffeeaa', stroke: '#333333', sw: 2, text: 'Atenție!', tc: '#aa0000', fs: 18, al: 'c' } },
  { id: 'f2', src: PNG, r: 0, c: 0, w: 50, h: 50, sh: { k: 'necunoscut' } }], 100, 26);
check(pics.length === 2 && pics[0].sh?.k === 'callout' && pics[0].sh.text === 'Atenție!' && pics[1].sh === undefined, 'pozele-formă își păstrează descrierea; una stricată rămâne doar poză');

const doc = emptySheetDoc();
doc.sheets[0].pics = pics;
const back = parseSheetDoc(JSON.stringify(doc));
const sh = back.sheets[0].pics?.[0]?.sh;
check(sh && sh.k === 'callout' && sh.text === 'Atenție!' && sh.fs === 18 && sh.tc === '#aa0000', 'forma cu textul ei se păstrează în .ssheet');

console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
