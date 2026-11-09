// Test: Notițe → 🔍 Previzualizare legături: titlul, descrierea și site-ul din og: / twitter: / <title> / description,
// cu entitățile HTML și textul prea lung scurtat; fișele păstrate în caiet (parseStore) și curățate.
// Rulare (în suite/): node tests/notes-linkpreview.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

const entry = join(tmpdir(), `suite-lp-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-lp-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { linkPreviewOf } from ${src('src/notes/linkPreview.ts')};\nexport { parseStore, search, snippet } from ${src('src/notes/store.ts')};\nexport { decodePage } from ${src('src/sheets/webTables.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const { linkPreviewOf, parseStore, search, snippet, decodePage } = await import(pathToFileURL(out).href);
rmSync(entry, { force: true }); rmSync(out, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };

const og = linkPreviewOf(`<html><head><title>Titlu simplu</title>
<meta property="og:title" content="Rețete de toamnă &amp; iarnă">
<meta name="description" content="Descriere obișnuită">
<meta property='og:description' content='Plăcinte, &#x219;arlote &quot;bune&quot;'>
<meta property="og:site_name" content="Bucătăria Mea"></head></html>`, 'https://www.exemplu.ro/retete');
check(og.title === 'Rețete de toamnă & iarnă', 'og:title cu &amp; (' + og.title + ')');
check(og.desc === 'Plăcinte, șarlote "bune"', 'og:description cu entități (' + og.desc + ')');
check(og.site === 'Bucătăria Mea', 'og:site_name');
const plain = linkPreviewOf('<title>\n  Pagina   mea \n</title><meta content="Despre noi" name="description">', 'https://www.firma.ro/despre');
check(plain.title === 'Pagina mea' && plain.desc === 'Despre noi' && plain.site === 'firma.ro', '<title> și description, site din adresă (' + JSON.stringify(plain) + ')');
const none = linkPreviewOf('', 'https://site.ro/x');
check(none.title === 'site.ro' && !none.desc, 'fără pagină: titlul e site-ul');
const long = linkPreviewOf(`<meta name="description" content="${'a'.repeat(500)}">`, 'https://s.ro');
check(long.desc.length === 300 && long.desc.endsWith('…'), 'descrierea lungă scurtată la 300 cu …');
const tw = linkPreviewOf('<meta name="twitter:title" content="Din twitter"><title>Alt</title>', 'https://s.ro');
check(tw.title === 'Din twitter', 'twitter:title înaintea <title>');
const cp = decodePage(new Uint8Array([0x3c,0x74,0x69,0x74,0x6c,0x65,0x3e,0x42,0x72,0x61,0xBA,0x6f,0x76,0x3c,0x2f,0x74,0x69,0x74,0x6c,0x65,0x3e]), 'text/html; charset=windows-1250');
check(linkPreviewOf(cp, 'https://b.ro').title === 'Bra' + String.fromCharCode(0x15F) + 'ov', 'codarea windows-1250');

// Poza paginii și clipurile video online.
const im = linkPreviewOf('<meta property="og:image" content="/poze/coperta.jpg?a=1&amp;b=2"><meta property="og:type" content="video.other">', 'https://www.clipuri.ro/v/123');
check(im.image === 'https://www.clipuri.ro/poze/coperta.jpg?a=1&b=2', 'og:image relativ, făcut complet (' + im.image + ')');
check(im.video === true, 'og:type video: fișă de clip');
const tw2 = linkPreviewOf('<meta name="twitter:image" content="https://cdn.s.ro/p.png"><meta name="twitter:player" content="https://s.ro/embed/1">', 'https://s.ro/a');
check(tw2.image === 'https://cdn.s.ro/p.png' && tw2.video === true, 'twitter:image și twitter:player');
const li = linkPreviewOf('<link rel="image_src" href="//img.s.ro/x.webp"><title>T</title>', 'https://s.ro/a');
check(li.image === 'https://img.s.ro/x.webp' && !li.video, '<link rel="image_src"> fără video (' + li.image + ')');
const js = linkPreviewOf('<meta property="og:image" content="javascript:alert(1)">', 'https://s.ro/a');
check(!js.image, 'adresa javascript: nu e poză');
const thumbStore = parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [{ id: 'b', title: 'T', body: 's.ro', created: '2026-10-30T10:00:00Z', updated: '2026-10-30T10:00:00Z',
  previews: [{ url: 's.ro', title: 'A', thumb: 'data:image/jpeg;base64,AAAA', video: true, image: 'https://s.ro/x.jpg' }, { url: 't.ro', title: 'B', thumb: 'https://rau.ro/x.jpg', video: 'da' }] }] }));
const tp = thumbStore.notes[0].previews;
check(tp[0].thumb === 'data:image/jpeg;base64,AAAA' && tp[0].video === true && !tp[0].image, 'poza micșorată și „video” se păstrează, adresa pozei nu');
check(!tp[1].thumb && !tp[1].video, 'poza care nu e data:image și video stricat se scot');

const store = parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [{ id: 'a', title: 'T', body: 'vezi exemplu.ro', created: '2026-10-30T10:00:00Z', updated: '2026-10-30T10:00:00Z',
  previews: [{ url: 'exemplu.ro', title: 'Exemplu', desc: 'd', site: 's' }, { url: 5, title: 'rău' }, { url: 'x.ro', title: 'X'.repeat(400) }] }] }));
const pv = store.notes[0].previews;
check(pv?.length === 2 && pv[0].title === 'Exemplu' && pv[1].title.length === 300, 'fișele se păstrează în caiet, cele stricate se scot (' + pv?.length + ')');

// Căutarea găsește notița după titlul / descrierea paginii din fișă (fără diacritice) și arată bucata din fișă.
const n2 = { ...store.notes[0], body: 'vezi exemplu.ro', previews: [{ url: 'exemplu.ro', title: 'Plăcintă cu mere', desc: 'Rețeta bunicii' }] };
check(search([n2], 'placinta').length === 1, 'căutarea găsește titlul din fișă');
check(search([n2], 'reteta bunicii').length === 1, 'căutarea găsește descrierea din fișă');
check(search([n2], 'pere').length === 0, 'căutarea nu găsește ce nu e');
check(snippet(n2, 'placinta').startsWith('🔗 Plăcintă cu mere'), 'fragmentul arată fișa (' + snippet(n2, 'placinta') + ')');

console.log(bad ? `ERORI: ${bad}` : 'OK: previzualizarea legăturilor citește titlul și descrierea');
process.exit(bad ? 1 : 0);
