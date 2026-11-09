// Test: Preluare date → Din web — adresa completată, numele registrului, pagina curățată de scripturi / stiluri / comentarii,
// codarea din antet (windows-1250), iar tabelele paginii ajung în foi (docTablesToBook).
// Rulare (în suite/): node tests/sheets-web.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

const entry = join(tmpdir(), `suite-web-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-web-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/sheets/webTables.ts')};\nexport { countTables, docTablesToBook } from ${src('src/sheets/docTables.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { normalizeUrl, nameFromUrl, isTextData, webHtml, countTables, docTablesToBook } = await import(pathToFileURL(out).href);
rmSync(entry, { force: true }); rmSync(out, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };

const u = normalizeUrl('  exemplu.ro/curs/valute.html ');
check(typeof u !== 'string' && u.href === 'https://exemplu.ro/curs/valute.html', 'adresa fără https:// e completată');
check(typeof normalizeUrl('ftp://x.ro/a') === 'string', 'ftp:// e refuzat');
check(typeof normalizeUrl('file:///C:/Windows/win.ini') === 'string', 'file:// e refuzat');
check(typeof normalizeUrl('') === 'string', 'adresa goală dă mesaj');
check(nameFromUrl(new URL('https://exemplu.ro/curs/valute.html')) === 'exemplu.ro valute', 'numele: site + pagină (' + nameFromUrl(new URL('https://exemplu.ro/curs/valute.html')) + ')');
check(nameFromUrl(new URL('https://exemplu.ro/')) === 'exemplu.ro', 'numele: doar site-ul');
check(isTextData('text/csv; charset=utf-8', new URL('https://a.ro/x')), 'text/csv e date simple');
check(isTextData('application/octet-stream', new URL('https://a.ro/date.csv')), '.csv după nume e date simple');
check(!isTextData('text/html', new URL('https://a.ro/pagina')), 'text/html nu e date simple');

const page = `<!doctype html><html><head><meta charset="utf-8"><title>Curs</title>
<style>td{color:red}</style><script>var s = "<table><tr><td>fals</td></tr></table>";</script></head><body>
<!-- <table><tr><td>comentariu</td></tr></table> -->
<h1>Cursul zilei</h1>
<table><tr><th>Moneda</th><th>Curs</th></tr><tr><td>EUR</td><td>4,9765</td></tr><tr><td>USD</td><td>4,5821</td></tr></table>
<noscript><table><tr><td>x</td></tr></table></noscript>
<p>Alt tabel:</p>
<table><tr><th>Oraș</th><th>Temp</th></tr><tr><td>Iași</td><td>12</td></tr></table>
<script>document.write('<table><tr><td>y</td></tr></table>')</script></body></html>`;
const html = webHtml(new TextEncoder().encode(page), 'text/html');
check(!/fals|comentariu|document\.write|<style/i.test(html), 'scripturile, stilurile și comentariile sunt scoase');
check(countTables(html) === 2, 'două tabele adevărate (' + countTables(html) + ')');
const book = docTablesToBook(html, { layout: 'sheets', paragraphs: false });
check(book.sheets.length === 2, 'fiecare tabel pe foaia lui');
const c = book.sheets[0].cells;
check(c.A1 === 'Moneda' && c.A2 === 'EUR' && c.B3 !== undefined, 'primul tabel în celule (A1 ' + c.A1 + ', A2 ' + c.A2 + ', B2 ' + c.B2 + ')');
check(book.sheets[1].cells.A2 === 'Iași', 'al doilea tabel cu diacritice');

// windows-1250 din antetul serverului: „ş” (cu sedilă) = 0xBA, „ă” = 0xE3
const bytes = new Uint8Array([...new TextEncoder().encode('<table><tr><td>Bra'), 0xBA, 0x6F, 0x76, 0x20, 0x70, 0xE3, 0x6D, 0xE2, 0x6E, 0x74, ...new TextEncoder().encode('</td></tr></table>')]);
const h2 = webHtml(bytes, 'text/html; charset=windows-1250');
check(h2.includes('Bra' + String.fromCharCode(0x15F) + 'ov pământ'), 'codarea windows-1250 din antet (' + h2.slice(16, 32) + ')');

console.log(bad ? `ERORI: ${bad}` : 'OK: Din web citește tabelele paginii');
process.exit(bad ? 1 : 0);
