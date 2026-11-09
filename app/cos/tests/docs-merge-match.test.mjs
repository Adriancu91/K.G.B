// Test: Îmbinarea de corespondență — Potrivește câmpurile: un câmp din document fără coloană cu același nume
// se completează din coloana aleasă; potrivirea se poate scoate; merge și în reguli. Plus Verifică erorile (checkMerge). Rulare (în suite/): node tests/docs-merge-match.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

const entry = join(tmpdir(), `suite-mrgm-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-mrgm-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { gridToMerge, fillDoc, usedFields, fieldValue, unmatchedFields, withMatch, ruleValue, checkMerge } from ${src('src/docs/merge.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const M = await import(pathToFileURL(out).href);
rmSync(entry, { force: true }); rmSync(out, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const data = M.gridToMerge([['Client', 'Localitate', 'Suma'], ['Ion Popescu', 'Brașov', '1200'], ['Ana Ionescu', 'Cluj', '90']], 'test');
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stimate «Nume» din «Oraș», suma «suma». «Bloc de adresă»' }] }] };
const fields = M.usedFields(doc);
check(JSON.stringify(M.unmatchedFields(data, fields)) === JSON.stringify(['Nume', 'Oraș']), 'nepotrivite: Nume și Oraș (suma are coloana, blocul de adresă se face singur): ' + JSON.stringify(M.unmatchedFields(data, fields)));
check(M.fieldValue(data, 0, 'Nume') === null, 'fără potrivire, «Nume» lipsește');
const d1 = M.withMatch(M.withMatch(data, 'Nume', 'Client'), 'oras', 'Localitate');
check(M.fieldValue(d1, 1, 'Nume') === 'Ana Ionescu' && M.fieldValue(d1, 0, 'Oraș') === 'Brașov', 'potrivite: «Nume» = Client, «Oraș» = Localitate (fără diacritice la potrivire)');
check(JSON.stringify(M.unmatchedFields(d1, fields)) === JSON.stringify(['Nume', 'Oraș']), 'câmpurile potrivite rămân în listă, ca potrivirea să se poată schimba');
check(M.fillDoc(doc, d1, 0).content[0].content[0].text.startsWith('Stimate Ion Popescu din Brașov, suma 1200.'), 'exemplarul completat: ' + M.fillDoc(doc, d1, 0).content[0].content[0].text.slice(0, 50));
check(M.ruleValue(d1, 1, 'DACĂ Oraș = cluj | ardelean {Nume} | altul') === 'ardelean Ana Ionescu', 'potrivirea merge și în reguli');
const d2 = M.withMatch(d1, 'Nume', '');
check(M.fieldValue(d2, 0, 'Nume') === null && M.fieldValue(d2, 0, 'Oraș') === 'Brașov', '(nepotrivit) scoate doar potrivirea aleasă');
check(M.fieldValue(M.withMatch(data, 'Nume', 'Nu există'), 0, 'Nume') === null, 'o coloană care nu e în tabel nu se ia');
check(data.match === undefined, 'datele de la început nu se schimbă');

// Verifică erorile: câmpurile fără coloană și cele goale, pe rândurile alese.
const d3 = M.gridToMerge([['Nume', 'Adresa'], ['Ion', 'Str. A'], ['Ana', ''], ['Dan', '  ']], 'test');
const r1 = M.checkMerge(d3, ['Nume', 'Adresa', 'Telefon'], [0, 1, 2]);
check(JSON.stringify(r1.missing) === '["Telefon"]', 'lipsește coloana Telefon');
check(r1.empty.length === 1 && r1.empty[0].field === 'Adresa' && JSON.stringify(r1.empty[0].rows) === '[1,2]', 'Adresa e goală la rândurile 2 și 3 (și doar cu spații): ' + JSON.stringify(r1.empty));
const r2 = M.checkMerge(d3, ['Nume', 'Adresa'], [0]);
check(!r2.missing.length && !r2.empty.length, 'doar Ion ales: nicio eroare');
const r3 = M.checkMerge(M.withMatch(d3, 'Telefon', 'Nume'), ['Telefon'], [0, 1, 2]);
check(!r3.missing.length && !r3.empty.length, 'cu potrivire, Telefon nu mai lipsește');

console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
