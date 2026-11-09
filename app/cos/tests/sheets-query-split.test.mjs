// Test: pașii „Înlocuiește valorile”, „Formatează textul” și „Împarte coloana după separator” din Editorul de interogare (src/sheets/query.ts).
// Rulare (în suite/): node tests/sheets-query-split.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-qsplit-${process.pid}`);
await build({ entryPoints: ['src/sheets/query.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { runQuery, cleanQuery, stepLabel, MAX_SPLIT } = await import(pathToFileURL(join(out, 'query.js')).href);
rmSync(out, { recursive: true, force: true });

let fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'GREȘIT'} ${name}${ok ? '' : `\n   am: ${JSON.stringify(a)}\n   vreau: ${JSON.stringify(b)}`}`);
};

const t = { head: ['Nume', 'Oraș', 'Preț'], rows: [['Pop, Ana', 'Cluj-Napoca', '12,5 lei'], ['Ion, Dan, jr.', 'cluj', 'n/a'], ['Ema', '', 7]] };
const r1 = runQuery(t, [{ k: 'replace', col: 'Oraș', from: 'cluj', to: 'Cluj-Napoca', whole: true }]).table;
eq('toată valoarea, fără majuscule; bucățile nu', r1.rows.map((r) => r[1]), ['Cluj-Napoca', 'Cluj-Napoca', '']);
const r2 = runQuery(t, [{ k: 'replace', col: 'Preț', from: ' LEI', to: '', whole: false }]).table;
eq('bucată din text, fără majuscule; textul care arată a număr devine număr', r2.rows.map((r) => r[2]), [12.5, 'n/a', 7]);
const r3 = runQuery(t, [{ k: 'replace', col: 'Preț', from: 'n/a', to: '0', whole: true }]).table;
eq('n/a → 0 (număr)', r3.rows[1][2], 0);
eq('caută gol = sărit', runQuery(t, [{ k: 'replace', col: 'Preț', from: '', to: 'x', whole: false }]).skipped, [1]);

const s1 = runQuery(t, [{ k: 'split', col: 'Nume', sep: ',' }]).table;
eq('împarte: coloanele noi în locul celei vechi', s1.head, ['Nume.1', 'Nume.2', 'Nume.3', 'Oraș', 'Preț']);
eq('împarte: bucățile fără spații, golurile pline cu gol', s1.rows.map((r) => r.slice(0, 3)), [['Pop', 'Ana', ''], ['Ion', 'Dan', 'jr.'], ['Ema', '', '']]);
const many = { head: ['X'], rows: [[Array.from({ length: 25 }, (_, i) => i + 1).join('-')]] };
const s2 = runQuery(many, [{ k: 'split', col: 'X', sep: '-' }]).table;
eq('cel mult MAX_SPLIT coloane, restul lipit în ultima', [s2.head.length, s2.rows[0][MAX_SPLIT - 1]], [MAX_SPLIT, '20-21-22-23-24-25']);
eq('numerele din bucăți sunt numere', s2.rows[0][0], 1);
eq('separator gol = sărit', runQuery(t, [{ k: 'split', col: 'Nume', sep: '' }]).skipped, [1]);
const s3 = runQuery({ head: ['A', 'A.1'], rows: [['x y', 1]] }, [{ k: 'split', col: 'A', sep: ' ' }]).table;
eq('nume unice față de coloanele existente', s3.head, ['A.1 (2)', 'A.2', 'A.1']);

const words = { head: ['N', 'V'], rows: [['  ion  POP-ionescu ', 3], ['ștefan cel mare', 'x']] };
const cs = (how) => runQuery(words, [{ k: 'case', col: 'N', how }]).table.rows.map((r) => r[0]);
eq('MAJUSCULE (cu diacritice)', cs('upper'), ['  ION  POP-IONESCU ', 'ȘTEFAN CEL MARE']);
eq('litere mici', cs('lower'), ['  ion  pop-ionescu ', 'ștefan cel mare']);
eq('Prima Literă Mare, și după cratimă', cs('title'), ['  Ion  Pop-Ionescu ', 'Ștefan Cel Mare']);
eq('fără spații în plus', cs('trim'), ['ion POP-ionescu', 'ștefan cel mare']);
eq('numerele rămân neatinse', runQuery(words, [{ k: 'case', col: 'V', how: 'upper' }]).table.rows.map((r) => r[1]), [3, 'X']);
eq('stepLabel formatare', stepLabel({ k: 'case', col: 'N', how: 'title' }), 'Formatează N: Prima Literă Mare');
eq('cleanQuery: felul necunoscut scos', cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 1, c1: 0 }, steps: [{ k: 'case', col: 'N', how: 'upper' }, { k: 'case', col: 'N', how: 'x' }] }).steps.length, 1);

const q = cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 2, c1: 1 }, steps: [
  { k: 'replace', col: 'A', from: 'x', to: 'y', whole: false }, { k: 'replace', col: 'A', from: 'x' }, { k: 'split', col: 'A', sep: ';' }, { k: 'split', col: 'A' }] });
eq('cleanQuery păstrează doar pașii întregi', q.steps.map((x) => x.k), ['replace', 'split']);
eq('stepLabel', [stepLabel({ k: 'replace', col: 'Oraș', from: 'cluj', to: 'Cluj-Napoca', whole: true }), stepLabel({ k: 'split', col: 'Nume', sep: ',' })],
  ['Înlocuiește în Oraș valoarea „cluj” cu „Cluj-Napoca”', 'Împarte Nume după „,”']);

console.log(fail ? `${fail} GREȘITE` : 'TOATE OK');
process.exit(fail ? 1 : 0);
