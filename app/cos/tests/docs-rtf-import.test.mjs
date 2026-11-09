// Test pentru importul .rtf în Docs: dus-întors cu exportul nostru, pagina de cod 1250, u-escape, grupuri sărite, tabele.
// Rulare (în suite/): node tests/docs-rtf-import.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

// În proiect (nu în %TEMP%), ca @tiptap/* lăsat în afara pachetului să se găsească în node_modules.
const dir = join(process.cwd(), 'node_modules', '.cache', `suite-rtfin-${process.pid}`);
await build({ entryPoints: ['src/docs/plainExport.ts', 'src/docs/rtfImport.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error', external: ['@tiptap/*'] });
const { docJsonToRtf } = await import(pathToFileURL(join(dir, 'plainExport.js')).href);
const { rtfToHtml } = await import(pathToFileURL(join(dir, 'rtfImport.js')).href);
rmSync(dir, { recursive: true, force: true });
const B = String.fromCharCode(92);
const enc = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);
let n = 0;
const has = (h, part, m) => { n++; assert.ok(h.includes(part), m + ': lipsește ' + part + ' în ' + h); };

// 1. Dus-întors cu exportul nostru.
const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Ștefan are ' }, { type: 'text', text: 'aldin', marks: [{ type: 'bold' }] }, { type: 'text', text: ' și 100 €' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'cursiv', marks: [{ type: 'italic' }] }, { type: 'hardBreak' }, { type: 'text', text: 'rând' }] },
  { type: 'table', content: [
    { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] }, { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] }] },
    { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }] }, { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '2' }] }] }] },
  ] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Gata' }] },
] };
const back = (await rtfToHtml(enc(docJsonToRtf(doc)))).html;
has(back, '<p>Ștefan are <strong>aldin</strong> și 100 €</p>', 'paragraf cu aldin și diacritice');
has(back, '<p><em>cursiv</em><br>rând</p>', 'cursiv și rând nou');
has(back, '<table><tbody><tr><td><p>A</p></td><td><p>B</p></td></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>', 'tabelul');
has(back, '<p>Gata</p>', 'paragraful de după tabel');
n++; assert.ok(!back.includes('Calibri') && !back.includes('Suite;'), 'tabela de fonturi și generatorul nu apar ca text');
// 2. Un fișier ca de la alte programe: pagina de cod 1250 cu octeți hex, grupuri ignorabile, \plain, \ul, simboluri.
const ro = '{' + B + 'rtf1' + B + 'ansi' + B + 'ansicpg1250' + B + 'deff0{' + B + 'fonttbl{' + B + 'f0 Arial;}}{' + B + 'colortbl;' + B + 'red255' + B + 'green0' + B + 'blue0;}'
  + '{' + B + '*' + B + 'themedata 0102}{' + B + 'info{' + B + 'title Secret}}'
  + B + 'pard ' + B + "'aa" + 'coal' + B + "'e3" + ' {' + B + 'ul sub' + B + 'ulnone liniat} ' + B + 'ldblquote x' + B + 'rdblquote ' + B + 'emdash' + B + 'par'
  + B + 'pard' + B + 'plain ' + B + 'uc1' + B + 'u351?i ' + B + 'b gros' + B + 'b0  normal' + B + 'par}';
const h2 = (await rtfToHtml(enc(ro))).html;
// 0xAA în pagina 1250 și u351 sunt Ş / ş cu sedilă (cum le scriu programele vechi); spațiul de după un cuvânt de control nu e text.
const S = String.fromCharCode(0x15e), s = String.fromCharCode(0x15f);
assert.equal(h2, '<p>' + S + 'coală <u>sub</u>liniat “x”—</p><p>' + s + 'i <strong>gros</strong> normal</p>'); n++;
// 3. Nu e RTF: mesaj clar.
await assert.rejects(() => rtfToHtml(enc('nu e rtf')), /nu este un document .rtf/); n++;
// 4. Poze: PNG în shppict (rezerva WMF din nonshppict se sare), mărimea din picwgoal, bin, DIB → .bmp, EMF sărit, poză în tabel.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const pngBytes = Buffer.from(PNG, 'base64');
const hex = pngBytes.toString('hex').replace(/(.{40})/g, '$1' + String.fromCharCode(13, 10));
const pr = '{' + B + 'rtf1' + B + 'ansi ' + B + 'pard Sus' + B + 'par' + B + 'pard {' + B + '*' + B + 'shppict{' + B + 'pict{' + B + '*' + B + 'picprop{' + B + 'sp{' + B + 'sn x}{' + B + 'sv 1}}}' + B + 'pngblip' + B + 'picw1' + B + 'pich1' + B + 'picwgoal600' + B + 'pichgoal450 ' + hex + '}}'
  + '{' + B + 'nonshppict{' + B + 'pict' + B + 'wmetafile8 0102}}' + B + 'par'
  + B + 'pard {' + B + 'pict' + B + 'pngblip' + B + 'picwgoal300' + B + 'picscalex50' + B + 'bin' + pngBytes.length + ' ' + pngBytes.toString('latin1') + '}' + B + 'par'
  + B + 'pard {' + B + 'pict' + B + 'emfblip 01000000}' + B + 'par'
  + B + 'trowd' + B + 'cellx2000' + B + 'pard' + B + 'intbl {' + B + 'pict' + B + 'jpegblip' + B + 'picwgoal150 ffd8ffe000}' + B + 'cell' + B + 'row' + B + 'pard Jos' + B + 'par}';
const r4 = await rtfToHtml(enc(pr));
const img = (w) => '<img src="data:image/png;base64,' + PNG + '" width="' + w + '" alt="">';
has(r4.html, '<p>Sus</p><p>' + img(40) + '</p>', 'poza din shppict, 600 twips = 40 px, fără rezerva WMF');
has(r4.html, '<p>' + img(10) + '</p>', 'poza cu bin, 300 twips la 50% = 10 px');
has(r4.html, '<td><p><img src="data:image/jpeg;base64,/9j/4AA=" width="10" alt=""></p></td>', 'JPEG în celula tabelului');
has(r4.html, '<p>Jos</p>', 'textul de după poze');
n++; assert.equal((r4.html.match(/<img/g) ?? []).length, 3, 'exact trei poze (EMF și WMF sărite)');
n++; assert.ok(r4.warnings >= 1, 'EMF sărit cu avertisment');
// DIB de 2×1 pixeli pe 24 de biți → fișier .bmp cu antetul de 14 octeți și pixelii la 54.
const dib = Buffer.alloc(40 + 8); dib.writeUInt32LE(40, 0); dib.writeInt32LE(2, 4); dib.writeInt32LE(1, 8); dib.writeUInt16LE(1, 12); dib.writeUInt16LE(24, 14);
const r5 = await rtfToHtml(enc('{' + B + 'rtf1 {' + B + 'pict' + B + 'dibitmap0' + B + 'picw2' + B + 'pich1 ' + dib.toString('hex') + '}}'));
const bmp = Buffer.from(/base64,([^"]+)/.exec(r5.html)[1], 'base64');
n++; assert.ok(r5.html.includes('data:image/bmp;base64,') && r5.html.includes('width="2"'), 'DIB ca .bmp, 2 px: ' + r5.html.slice(0, 80));
n++; assert.equal(bmp.toString('latin1', 0, 2) + bmp.readUInt32LE(2) + ',' + bmp.readUInt32LE(10), 'BM' + (14 + dib.length) + ',54', 'antetul .bmp');
// Dus-întors: poza din document ajunge în .rtf și înapoi, cu lățimea ei.
const withImg = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Poza:' }] }, { type: 'image', attrs: { src: 'data:image/png;base64,' + PNG, width: 120, caption: 'Figura 1' } }] };
const rtfOut = docJsonToRtf(withImg);
n++; assert.ok(rtfOut.includes(B + 'pict' + B + 'pngblip' + B + 'picw1' + B + 'pich1' + B + 'picwgoal1800' + B + 'pichgoal1800'), 'exportul scrie poza');
const back2 = (await rtfToHtml(enc(rtfOut))).html;
has(back2, img(120), 'poza revine cu lățimea 120');
has(back2, '<em>Figura 1</em>', 'legenda rămâne');
console.log(`OK: ${n} verificări pentru importul .rtf`);
