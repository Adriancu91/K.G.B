// Test pentru importul .txt în Docs: codificările (UTF-8 cu și fără BOM, UTF-16, pagina 1250), rândurile goale, caracterele speciale.
// Rulare (în suite/): node tests/docs-txt-import.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-txtin-${process.pid}`);
await build({ entryPoints: ['src/docs/txtImport.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { txtToHtml, decodeText } = await import(pathToFileURL(join(dir, 'txtImport.js')).href);
rmSync(dir, { recursive: true, force: true });
const NB = String.fromCharCode(160);
const CR = String.fromCharCode(13), LF = String.fromCharCode(10), TAB = String.fromCharCode(9);
const utf8 = (s) => new TextEncoder().encode(s);
const utf16le = (s, bom) => { const a = []; if (bom) a.push(0xff, 0xfe); for (const c of s) { const n = c.charCodeAt(0); a.push(n & 255, n >> 8); } return Uint8Array.from(a); };
let n = 0;
const eq = (a, b, m) => { n++; assert.equal(a, b, m); };

const ro = 'Ștefan și Țară: 100 €';
eq((await txtToHtml(utf8(ro + CR + LF + CR + LF + 'Al doilea' + LF))).html, `<p>${ro}</p><p></p><p>Al doilea</p>`, 'UTF-8, rând gol, CRLF');
eq(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8('ăâî')])), 'ăâî', 'UTF-8 cu BOM');
eq(decodeText(utf16le('Șir ț', true)), 'Șir ț', 'UTF-16 LE cu BOM');
eq(decodeText(utf16le('Hello world text', false)), 'Hello world text', 'UTF-16 LE fără BOM');
// Pagina 1250: ș = 0xBA, ț = 0xFE, ă = 0xE3.
eq(decodeText(Uint8Array.from([0x63, 0xe3, 0x73, 0x75, 0x20, 0xba, 0xfe])), 'căsu ' + String.fromCharCode(0x15f, 0x163), 'pagina de cod 1250 (ş ţ cu sedilă, cum sunt în ea)');
eq((await txtToHtml(utf8('<b>a & b</b>'))).html, '<p>&lt;b&gt;a &amp; b&lt;/b&gt;</p>', 'caracterele HTML nu devin formatare');
eq((await txtToHtml(utf8('  cod' + TAB + 'x'))).html, `<p>${NB}${NB}cod    x</p>`, 'spațiile de la început și tab-ul');
eq((await txtToHtml(new Uint8Array())).html, '<p></p>', 'fișier gol');
eq((await txtToHtml(utf8('fără final'))).html, '<p>fără final</p>', 'fără rând nou la final');
n++; await assert.rejects(() => txtToHtml(Uint8Array.from([0x4d, 0x5a, 0, 0, 0, 0, 1, 2])), /nu este text/, 'un fișier binar e refuzat');
console.log(`docs-txt-import: ${n} verificări trecute`);
