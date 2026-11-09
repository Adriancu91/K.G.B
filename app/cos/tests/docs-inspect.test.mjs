// Test pentru „Inspectează documentul” din Docs: datele ascunse din poze (EXIF / XMP / comentarii în JPEG, tEXt / eXIf în PNG)
// se găsesc și se scot fără să se atingă restul pozei; antetul, subsolul și filigranul se scot din pagină.
// Rulare (în suite/): node tests/docs-inspect.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docsinsp-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/docs/inspect.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { imageHasMeta, stripImageMeta, dataUrlBytes, bytesDataUrl, withoutHeadFoot } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };

const seg = (marker, payload) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const jfif = seg(0xe0, ascii('JFIF\0\x01\x01'));
const exif = seg(0xe1, ascii('Exif\0\0GPS 44.43N 26.10E'));
const icc = seg(0xe2, ascii('ICC_PROFILE\0x'));
const com = seg(0xfe, ascii('Telefonul lui Ion'));
const dqt = seg(0xdb, [0, 1, 2, 3]);
const scan = [0xff, 0xda, 0, 4, 1, 2, 9, 9, 9, 0xff, 0xd9];
const jpeg = new Uint8Array([0xff, 0xd8, ...jfif, ...exif, ...icc, ...com, ...dqt, ...scan]);
check('JPEG cu EXIF: are date', imageHasMeta(jpeg));
const clean = stripImageMeta(jpeg);
check('JPEG curățat: fără date', !imageHasMeta(clean));
check('JPEG curățat: rămân JFIF, culorile (ICC), tabelele și imaginea', JSON.stringify([...clean]) === JSON.stringify([0xff, 0xd8, ...jfif, ...icc, ...dqt, ...scan]));
check('JPEG curățat: GPS-ul nu mai e în fișier', !Buffer.from(clean).toString('latin1').includes('GPS'));
check('JPEG fără date rămâne la fel', stripImageMeta(clean) === clean);

const chunk = (type, data) => [0, 0, 0, data.length, ...ascii(type), ...data, 1, 2, 3, 4];
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]), ...chunk('tEXt', ascii('Author\0Ion')), ...chunk('IDAT', [1, 2]), ...chunk('IEND', [])]);
check('PNG cu tEXt: are date', imageHasMeta(png));
const pclean = stripImageMeta(png);
check('PNG curățat: fără tEXt, cu IHDR / IDAT / IEND', !imageHasMeta(pclean) && pclean.length === png.length - 22 && Buffer.from(pclean).toString('latin1').includes('IDAT') && Buffer.from(pclean).toString('latin1').includes('IEND'));

const url = bytesDataUrl('image/jpeg', jpeg);
const back = dataUrlBytes(url);
check('data URL dus și întors', back.mime === 'image/jpeg' && back.bytes.length === jpeg.length && back.bytes.every((v, i) => v === jpeg[i]));
check('altceva decât JPEG / PNG: nu se atinge', dataUrlBytes('data:image/gif;base64,R0lGOD') === null);

const page = withoutHeadFoot({ header: 'Firma SRL', footer: 'Confidențial', numbers: true, margin: 20, watermark: 'CIORNĂ', watermarkColor: '#c62828', firstPage: { header: 'x', footer: '', numbers: false }, props: { author: 'Ion' } });
check('pagina fără antet, subsol, prima pagină și filigran; restul rămâne', page.header === '' && page.footer === '' && !page.watermark && !page.watermarkColor && !page.firstPage && page.numbers === true && page.margin === 20 && page.props.author === 'Ion');
const even = withoutHeadFoot({ header: 'A', footer: 'B', numbers: false, margin: 20, evenPage: { header: 'Par', footer: 'Stânga' } });
check('scoate și antetul / subsolul paginilor pare', !even.evenPage && even.header === '');
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
