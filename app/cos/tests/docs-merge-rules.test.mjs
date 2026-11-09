// Test: Îmbinarea de corespondență — regulile «DACĂ … | … | …» (text după o condiție, cu {Coloană} în texte)
// și «SARI DACĂ …» (rândurile care îndeplinesc condiția nu primesc exemplar); comparații pe numere și pe text.
// Rulare (în suite/): node tests/docs-merge-rules.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

const entry = join(tmpdir(), `suite-mrgr-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-mrgr-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { gridToMerge, mergeAll, fillDoc, usedFields, ruleTest, ruleValue, skipRules, skipRow, ifField, skipField, RULE_OPS } from ${src('src/docs/merge.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const M = await import(pathToFileURL(out).href);
rmSync(entry, { force: true }); rmSync(out, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const data = M.gridToMerge([
  ['Nume', 'Oraș', 'Suma', 'Plătit'],
  ['Ion Popescu', 'Brașov', '1.200,50', 'nu'],
  ['Ana Ionescu', 'București', '90', 'DA'],
  ['Mihai Ștefan', 'Bucuresti', '1000', ''],
  ['Elena Dan', '', '10', 'da'],
], 'test.csv');
const text = (doc) => JSON.stringify(doc).match(/"text":"[^"]*"/g)?.map((t) => t.slice(8, -1)).join('') ?? '';
const para = (t) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });

// Comparațiile.
check(M.ruleTest(data, 1, 'Oraș', '=', 'bucuresti') && M.ruleTest(data, 2, 'oras', '=', 'București'), '= fără diacritice și fără litere mari, și în numele coloanei');
check(M.ruleTest(data, 0, 'Suma', '>', '1000') && !M.ruleTest(data, 2, 'Suma', '>', '1000') && M.ruleTest(data, 2, 'Suma', '>=', '1000'), '> și >= pe numere (1.200,50 e mai mare decât 1000)');
check(M.ruleTest(data, 1, 'Suma', '<', '100') && !M.ruleTest(data, 1, 'Suma', '<', '9'), '< pe numere (90 < 100, nu ca text)');
check(M.ruleTest(data, 0, 'Oraș', '<>', 'București') && !M.ruleTest(data, 1, 'Oraș', '<>', 'bucurești'), '<> (diferit)');
check(M.ruleTest(data, 0, 'Nume', 'conține', 'popesc') && !M.ruleTest(data, 1, 'Nume', 'conține', 'popesc'), 'conține');
check(M.ruleTest(data, 3, 'Oraș', '=', '') && M.ruleTest(data, 0, 'Coloană lipsă', '=', ''), 'celula goală și coloana lipsă sunt goale');
check(M.RULE_OPS.length === 7, '7 comparații în listă');

// DACĂ.
const rule = '«DACĂ Oraș = București | Dragă {Nume}, te așteptăm la sediu. | Dragă {Nume}, îți trimitem coletul.»';
check(M.ruleValue(data, 1, rule.slice(1, -1)) === 'Dragă Ana Ionescu, te așteptăm la sediu.', 'DACĂ adevărat: primul text, cu {Nume} completat');
check(M.ruleValue(data, 0, rule.slice(1, -1)) === 'Dragă Ion Popescu, îți trimitem coletul.', 'DACĂ fals: al doilea text');
check(M.ruleValue(data, 0, 'Daca Suma > 500 | Reducere 10%') === 'Reducere 10%' && M.ruleValue(data, 1, 'Daca Suma > 500 | Reducere 10%') === '', 'fără „altfel”: text gol; „Daca” fără diacritice merge');
check(M.ruleValue(data, 0, 'Nume') === null, 'un câmp obișnuit nu e regulă');
check(M.ruleValue(data, 0, 'DACĂ Nume conține Pop | da | nu') === 'da', 'DACĂ cu „conține”');
const filled = text(M.fillDoc(para('Salut! ' + rule + ' Total: «Suma».'), data, 2));
check(filled === 'Salut! Dragă Mihai Ștefan, te așteptăm la sediu. Total: 1000.', 'în document: regula și câmpul obișnuit se completează împreună (' + filled + ')');

// Ce coloane folosește documentul (pentru avertismentul „tabelul nu are coloana”).
const used = M.usedFields(para('«Nume» ' + rule + ' «SARI DACĂ Plătit = da» «DACĂ Lipsă = x | {Alta} | y»'));
check(JSON.stringify(used) === JSON.stringify(['Nume', 'Oraș', 'Plătit', 'Lipsă', 'Alta']), 'coloanele folosite de reguli: ' + JSON.stringify(used));

// SARI DACĂ.
const doc = para('«SARI DACĂ Plătit = da»Factura pentru «Nume»: «Suma» lei.');
const skips = M.skipRules(doc);
check(skips.length === 1 && skips[0][0] === 'Plătit' && skips[0][2] === 'da', 'regula SARI DACĂ e găsită');
check([0, 1, 2, 3].map((r) => M.skipRow(skips, data, r)).join() === 'false,true,false,true', 'sare peste cei care au plătit (DA, da)');
const merged = M.mergeAll(doc, data, [0, 1, 2, 3]);
const pages = merged.content.filter((n) => n.type === 'pageBreak').length + 1;
check(pages === 2 && text(merged) === 'Factura pentru Ion Popescu: 1.200,50 lei.Factura pentru Mihai Ștefan: 1000 lei.', 'exemplare doar pentru Ion și Mihai, fără textul regulii (' + text(merged) + ')');
// Listă / catalog: aceleași exemplare, unul sub altul, fără pagini noi.
const list = M.mergeAll(doc, data, [0, 1, 2, 3], true);
check(!list.content.some((n) => n.type === 'pageBreak') && list.content.filter((n) => n.type === 'paragraph').length === 2 && text(list) === text(merged), 'lista (catalog): două paragrafe, fără sfârșit de pagină');

// Regulile puse din fereastră.
const made = M.ifField('Oraș', '=', 'București', 'la sediu «x»', 'prin | curier');
check(made === '«DACĂ Oraș = București | la sediu  x | prin   curier»' || (made.startsWith('«DACĂ Oraș = București | ') && !/[«»]/.test(made.slice(1, -1)) && made.split('|').length === 3), 'DACĂ din fereastră: fără « » sau | în plus în texte (' + made + ')');
check(M.ruleValue(data, 1, made.slice(1, -1)) === 'la sediu  x', 'regula din fereastră merge');
const sk = M.skipField('Suma', '<', '50');
check(sk === '«SARI DACĂ Suma < 50»' && M.skipRules(para(sk)).length === 1 && M.skipRow(M.skipRules(para(sk)), data, 3), 'SARI DACĂ din fereastră merge');

console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
