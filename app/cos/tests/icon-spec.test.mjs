// Test: pictogramele recolorabile (☺ Pictograme) își păstrează descrierea (pictograma, culoarea, grosimea, rotirile)
// la salvare și redeschidere: citirea descrierii (iconLib.ts parseIconSpec), pozele din Sheets (pics.ts cleanPics, câmpul ic)
// și elementele din Slides (model.ts cleanEls, câmpul icon); descrierile stricate se aruncă.
// Rulare (în suite/): node tests/icon-spec.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-iconspec-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-iconspec-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { parseIconSpec, iconById } from ${src('src/icons/iconLib.ts')};\nexport { cleanPics } from ${src('src/sheets/pics.ts')};\nexport { cleanEls } from ${src('src/slides/model.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const { parseIconSpec, iconById, cleanPics, cleanEls } = await import(pathToFileURL(out).href);
rmSync(entry, { force: true }); rmSync(out, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const J = (v) => JSON.stringify(v);

check(!!iconById('mail') && !iconById('nu-exista'), 'pictogramele se găsesc după nume');
check(J(parseIconSpec({ id: 'mail', c: '#00A000', s: 2.75 })) === '{"id":"mail","c":"#00a000","s":2.75}', 'descrierea bună rămâne (culoarea cu litere mici)');
check(J(parseIconSpec('{"id":"phone","c":"#123456","s":2,"t":"rrh"}')) === '{"id":"phone","c":"#123456","s":2,"t":"rrh"}', 'și ca text, cu rotirile');
check(parseIconSpec({ id: 'nu-exista', c: '#000000', s: 2 }) === null, 'o pictogramă care nu există se aruncă');
check(parseIconSpec('{stricat') === null && parseIconSpec(null) === null && parseIconSpec(7) === null, 'textul stricat se aruncă');
check(J(parseIconSpec({ id: 'mail', c: 'red', s: 99, t: 'rx<9>' })) === '{"id":"mail","c":"#1f4e79","s":4,"t":"r"}', 'culoarea greșită, grosimea prea mare și rotirile greșite se îndreaptă');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const pic = { id: 'a', src: PNG, r: 0, c: 0, dx: 0, dy: 0, w: 96, h: 96, alt: 'Plic', ic: { id: 'mail', c: '#00a000', s: 2.75 } };
const p1 = cleanPics(JSON.parse(J([pic, { ...pic, id: 'b', ic: { id: 'nu-exista', c: '#000000', s: 2 } }])), 100, 26);
check(J(p1[0].ic) === '{"id":"mail","c":"#00a000","s":2.75}', 'Sheets: pictograma rămâne după salvare și redeschidere');
check(p1.length === 2 && !('ic' in p1[1]), 'Sheets: o descriere stricată se aruncă, poza rămâne');

const el = { id: 'e1', kind: 'image', text: '', src: PNG, x: 10, y: 10, w: 180, h: 180, icon: { id: 'phone', c: '#00a000', s: 2 } };
const e1 = cleanEls(JSON.parse(J([el, { ...el, id: 'e2', icon: 'stricat' }, { ...el, id: 'e3', kind: 'text', icon: el.icon }])));
check(J(e1[0]?.icon) === '{"id":"phone","c":"#00a000","s":2}', 'Slides: pictograma rămâne după salvare și redeschidere');
check(e1.length === 3 && !('icon' in e1[1]) && !('icon' in e1[2]), 'Slides: descrierea stricată și cea de pe o casetă de text se aruncă');

console.log(bad ? `GRESELI: ${bad}` : 'Toate verificările au trecut.');
process.exit(bad ? 1 : 0);
