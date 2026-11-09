// Test: un .csv scris înapoi din Sheets își păstrează codificarea (textImport.ts encodeText): Windows-1250 / 1252, ISO-8859-2,
// UTF-16 cu semnătură, UTF-8 cu sau fără semnătură; literele care nu există în codificarea veche se numără (lost).
// Rulare (în suite/): node tests/csv-encoding.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-csvenc-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/textImport.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { encodeText, decodeText, detectEncoding, hasBom } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GRESIT: ') + m); if (!c) fail++; };
const text = 'Oraș;Țară;Preț\r\nBrașov;România;12,5\r\nÎnsurăței;Ștefănești;3\r\n';

// Windows-1250: dus și întors identic, iar ghicitorul îl recunoaște tot ca Windows-1250.
const w = encodeText(text, 'windows-1250', false);
ok(w.lost === 0 && w.data.length === text.length, 'Windows-1250: fiecare literă pe un octet, nimic pierdut');
const sedila = (t) => t.replace(/ș/g, 'ş').replace(/ț/g, 'ţ').replace(/Ș/g, 'Ş').replace(/Ț/g, 'Ţ');
ok(decodeText(w.data, 'windows-1250') === sedila(text), 'Windows-1250: se citește înapoi la fel (ș / ț cu sedilă, singurele pe care le are)');
ok(detectEncoding(w.data) === 'windows-1250', 'Windows-1250: ghicit la fel la redeschidere: ' + detectEncoding(w.data));
ok(w.data[3] === 0xba, '„ș” e octetul BA (ş) în Windows-1250');

// ISO-8859-2 are „ş” / „ţ” cu sedilă: „ș” cu virgulă se scrie ca ele.
const i2 = encodeText('ș ț Ș Ț', 'iso-8859-2', false);
ok(i2.lost === 0 && decodeText(i2.data, 'iso-8859-2') === 'ş ţ Ş Ţ', 'ISO-8859-2: ș / ț scrise cu sedilă, fără pierderi');

// Windows-1252 n-are „ș”, „ț”, „ă”: se numără, ca Sheets să treacă la UTF-8.
const w2 = encodeText(text, 'windows-1252', false);
ok(w2.lost > 0, 'Windows-1252: literele românești lipsă sunt numărate: ' + w2.lost);
const w3 = encodeText('Café;Größe;€ 5', 'windows-1252', false);
ok(w3.lost === 0 && decodeText(w3.data, 'windows-1252') === 'Café;Größe;€ 5', 'Windows-1252: textul vestic dus și întors la fel (și €)');

// UTF-16 cu semnătură.
const u16 = encodeText(text, 'utf-16le', true);
ok(u16.data[0] === 0xff && u16.data[1] === 0xfe && hasBom(u16.data), 'UTF-16LE: începe cu FF FE');
ok(detectEncoding(u16.data) === 'utf-16le' && decodeText(u16.data, 'utf-16le') === text, 'UTF-16LE: dus și întors la fel');
const u16b = encodeText(text, 'utf-16be', true);
ok(detectEncoding(u16b.data) === 'utf-16be' && decodeText(u16b.data, 'utf-16be') === text, 'UTF-16BE: dus și întors la fel');

// UTF-8: semnătura doar dacă o avea.
const u8 = encodeText(text, 'utf-8', false);
ok(!hasBom(u8.data) && new TextDecoder().decode(u8.data) === text, 'UTF-8 fără semnătură rămâne fără');
const u8b = encodeText(text, 'utf-8', true);
ok(hasBom(u8b.data) && decodeText(u8b.data, 'utf-8') === text, 'UTF-8 cu semnătură rămâne cu ea');

console.log(fail ? `GRESELI: ${fail}` : 'TOATE OK');
process.exit(fail ? 1 : 0);
