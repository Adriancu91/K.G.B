// Test: Îmbinarea de corespondență — câmpurile compuse (Bloc de adresă, Formulă de salut) și lista destinatarilor (filtru pe o coloană, ordonare, rânduri debifate) și exemplarele doar pentru cei aleși.
// Rulare (în suite/): node tests/docs-merge-recipients.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-mrg-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-mrg-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { gridToMerge, recipientRows, passesFilter, mergeAll, fillDoc, fieldValue } from ${src('src/docs/merge.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const { gridToMerge, recipientRows, mergeAll, fillDoc, fieldValue } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const data = gridToMerge([
  ['Nume', 'Oraș', 'Suma'],
  ['Ion Popescu', 'Brașov', '1.200,50'],
  ['Ana Ionescu', 'București', '90'],
  ['Mihai Ștefan', 'Brasov', '1000'],
  ['Elena Dan', '', '10'],
  ['Șerban Pop', 'Cluj', '2'],
], 'test.csv');
const names = (rows) => rows.map((i) => data.rows[i][0].split(' ')[0]).join(',');

check(names(recipientRows(data, {})) === 'Ion,Ana,Mihai,Elena,Șerban', 'fără alegeri: toți, în ordinea din tabel');
check(names(recipientRows(data, { filterCol: 1, op: 'contine', text: 'brasov' })) === 'Ion,Mihai', 'filtrul „conține brasov” prinde și „Brașov” (fără diacritice)');
check(names(recipientRows(data, { filterCol: 1, op: 'egal', text: 'Cluj' })) === 'Șerban', 'filtrul „este egal cu”');
check(names(recipientRows(data, { filterCol: 1, op: 'gol' })) === 'Elena', 'filtrul „e gol”');
check(names(recipientRows(data, { filterCol: 1, op: 'negol' })) === 'Ion,Ana,Mihai,Șerban', 'filtrul „nu e gol”');
check(names(recipientRows(data, { filterCol: 0, op: 'nu-contine', text: 'pop' })) === 'Ana,Mihai,Elena', 'filtrul „nu conține”');
check(names(recipientRows(data, { filterCol: 0, op: 'incepe', text: 'ser' })) === 'Șerban', 'filtrul „începe cu” fără diacritice');
check(names(recipientRows(data, { sortCol: 2 })) === 'Șerban,Elena,Ana,Mihai,Ion', 'ordonare după sumă, ca numere (2 < 10 < 90 < 1000 < 1.200,50)');
check(names(recipientRows(data, { sortCol: 2, desc: true })) === 'Ion,Mihai,Ana,Elena,Șerban', 'ordonare descrescătoare');
check(names(recipientRows(data, { sortCol: 0 })) === 'Ana,Elena,Ion,Mihai,Șerban', 'ordonare alfabetică românească (Ș după S)');
check(names(recipientRows(data, { excluded: [1, 3] })) === 'Ion,Mihai,Șerban', 'rândurile debifate nu intră');
check(names(recipientRows(data, { excluded: [1, 3] }, true)) === 'Ion,Ana,Mihai,Elena,Șerban', 'lista completă (pentru bife) le arată și pe cele debifate');
const rows = recipientRows(data, { filterCol: 1, op: 'contine', text: 'bras', sortCol: 0 });
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stimate «Nume», din «Oraș»' }] }] };
const merged = mergeAll(doc, data, rows);
const texts = merged.content.filter((n) => n.type === 'paragraph').map((p) => p.content[0].text);
check(texts.join(' | ') === 'Stimate Ion Popescu, din Brașov | Stimate Mihai Ștefan, din Brasov' && merged.content.filter((n) => n.type === 'pageBreak').length === 1,
  'exemplarele se fac doar pentru destinatarii aleși, în ordinea lor: ' + texts.join(' | '));

// Câmpurile compuse: «Bloc de adresă» și «Formulă de salut».
const adr = gridToMerge([
  ['Titlu', 'Prenume', 'Nume', 'Firma', 'Adresa', 'Cod poștal', 'Localitate', 'Județ'],
  ['Dl.', 'Ion', 'Popescu', 'Exemplu SRL', 'Str. Lungă nr. 5', '500001', 'Brașov', 'Brașov'],
  ['Dna', 'Ana', 'Ionescu', '', 'Bd. Unirii 10', '', 'București', ''],
  ['', 'Elena', 'Dan', '', '', '', '', ''],
], 'adrese.csv');
check(fieldValue(adr, 0, 'Bloc de adresă') === 'Dl. Ion Popescu\nExemplu SRL\nStr. Lungă nr. 5\n500001 Brașov\njud. Brașov', 'blocul de adresă, rând cu toate: ' + JSON.stringify(fieldValue(adr, 0, 'Bloc de adresă')));
check(fieldValue(adr, 1, 'bloc de adresa') === 'Dna Ana Ionescu\nBd. Unirii 10\nBucurești', 'blocul de adresă sare rândurile goale (și se scrie fără diacritice)');
check(fieldValue(adr, 0, 'Formulă de salut') === 'Stimate domnule Popescu,', 'salut: Dl. → Stimate domnule Popescu,');
check(fieldValue(adr, 1, 'Formulă de salut') === 'Stimată doamnă Ionescu,', 'salut: Dna → Stimată doamnă Ionescu,');
check(fieldValue(adr, 2, 'Formulă de salut') === 'Bună ziua, Elena Dan,', 'salut fără titlu: Bună ziua, Elena Dan,');
check(fieldValue(gridToMerge([['Gen', 'Nume complet'], ['F', 'Maria Pop']], 'x'), 0, 'Formulă de salut') === 'Stimată doamnă Maria Pop,', 'salut după coloana Gen și Nume complet');
check(fieldValue(gridToMerge([['Bloc de adresă'], ['scris de mână']], 'x'), 0, 'Bloc de adresă') === 'scris de mână', 'o coloană cu același nume are întâietate');
const letter = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '«Bloc de adresă»', marks: [{ type: 'bold' }] }] }, { type: 'paragraph', content: [{ type: 'text', text: '«Formulă de salut»' }] }] };
const f1 = fillDoc(letter, adr, 1);
const p0 = f1.content[0].content;
check(p0.map((n) => n.type === 'hardBreak' ? '↵' : n.text).join('') === 'Dna Ana Ionescu↵Bd. Unirii 10↵București' && p0.filter((n) => n.type === 'text').every((n) => n.marks?.[0]?.type === 'bold'),
  'în document, blocul de adresă are rânduri despărțite (Shift+Enter) și păstrează aldinul');
check(f1.content[1].content[0].text === 'Stimată doamnă Ionescu,', 'salutul în document');
console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
