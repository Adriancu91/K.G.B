// Test: Notițe → Export .mht: pagina și pozele ca părți MIME (MHTML), pozele „data:” scoase din pagină, aceeași poză o dată.
// Rulare (în suite/): node tests/notes-mht.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `suite-mht-${process.pid}.mjs`);
await build({ entryPoints: ['src/notes/tomht.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { htmlToMht } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]).toString('base64');
const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><text>ă & b</text></svg>').replace(/&/g, '&amp;');
const html = `<!doctype html><html><body><h1>Notă ș</h1><img src="data:image/png;base64,${png}"><img src="data:image/png;base64,${png}"><img src="${svg}"><img src="poza.jpg"></body></html>`;
const m = htmlToMht(html, 'Notă ș', 'GRANITA');
const parts = m.split('--GRANITA');
check(m.includes('Content-Type: multipart/related; type="text/html"; boundary="GRANITA"'), 'antetul MIME multipart/related');
check(m.split('\r\n').every((l) => l.length <= 998), 'rânduri MIME scurte');
check(/^[\x00-\x7f]*$/.test(m), 'tot fișierul e ASCII (textul în base64)');
check(m.trimEnd().endsWith('--GRANITA--'), 'se încheie cu granița de final');
check(parts.length === 5, 'pagina + 2 poze diferite (aceeași poză doar o dată) + final: ' + parts.length);
const pageB64 = parts[1].split('\r\n\r\n')[1].replace(/\r\n/g, '');
const page = Buffer.from(pageB64, 'base64').toString('utf8');
check(page.includes('<h1>Notă ș</h1>'), 'pagina, cu diacritice, se citește înapoi');
check(!page.includes('data:image'), 'nu mai rămân poze „data:” în pagină');
check(page.split('src="cid:poza001.png@suite"').length === 3, 'cele două poze la fel trimit la aceeași parte');
check(page.includes('src="poza.jpg"'), 'adresele obișnuite rămân neschimbate');
const imgPart = parts[2];
check(imgPart.includes('Content-Type: image/png') && imgPart.includes('Content-ID: <poza001.png@suite>'), 'poza PNG ca parte separată');
const bytes = Buffer.from(imgPart.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64');
check(bytes.length === 11 && bytes[0] === 137 && bytes[10] === 3, 'octeții pozei se păstrează');
const svgBytes = Buffer.from(parts[3].split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
check(parts[3].includes('image/svg+xml') && svgBytes.includes('<text>ă & b</text>'), 'SVG-ul (nescris în base64) se decodează corect');
check(m.includes('Subject: =?utf-8?B?' + Buffer.from('Notă ș').toString('base64') + '?='), 'titlul în antet, codat pentru diacritice');
console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
