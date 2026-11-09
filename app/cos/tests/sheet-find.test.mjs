// Test pentru Găsește / Înlocuiește din Sheets: litere mari / mici, celula întreagă, „*” și „?”, unde se caută.
// Rulare (în suite/): node tests/sheet-find.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-shfind-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/find.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const { textHas, findCells, replaceText } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + info}`); if (!ok) fail++; };
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`);
const o = (x = {}) => ({ matchCase: false, ...x });

eq('fără diacritice și litere mari', textHas('Sărbătoare', 'sarbatoare', o()), true);
eq('Aa: contează literele', textHas('Sărbătoare', 'sarbatoare', o({ matchCase: true })), false);
eq('celula întreagă: doar textul exact', [textHas('Cluj', 'cluj', o({ whole: true })), textHas('Cluj-Napoca', 'cluj', o({ whole: true }))], [true, false]);
eq('* ține locul oricâtor litere', [textHas('Ion Popescu', 'i*cu', o()), textHas('Ion Pop', 'i*cu', o())], [true, false]);
eq('? ține locul unei litere', [textHas('cod A7', 'a?', o({ whole: false })), textHas('B12', 'b?', o({ whole: true })), textHas('B1', 'b?', o({ whole: true }))], [true, false, true]);
eq('~* caută chiar steluța', [textHas('5*3', '5~*3', o()), textHas('513', '5~*3', o())], [true, false]);
eq('~? caută chiar semnul întrebării', [textHas('Ce?', 'ce~?', o({ whole: true })), textHas('Cex', 'ce~?', o({ whole: true }))], [true, false]);
eq('semne speciale fără sens de expresie', textHas('1+1=2 (cam)', '(cam)', o()), true);
eq('* singur nu găsește celule goale', [textHas('', '*', o()), textHas('x', '*', o())], [false, true]);
eq('căutare goală', textHas('abc', '', o()), false);

eq('înlocuire cu diacritice', replaceText('Ședința și ȘEDINȚA', 'sedinta', 'Întâlnirea', o()), { text: 'Întâlnirea și Întâlnirea', n: 2 });
eq('înlocuire cu *', replaceText('Factura 123/2026', 'f*a', 'Bon', o()), { text: 'Bon 123/2026', n: 1 });
eq('înlocuire cu ?', replaceText('A1 B2 C3', '?2', 'X', o()), { text: 'A1 X C3', n: 1 });
eq('înlocuire celula întreagă', [replaceText('da', 'DA', 'Nu', o({ whole: true })), replaceText('dar', 'da', 'Nu', o({ whole: true }))],
  [{ text: 'Nu', n: 1 }, { text: 'dar', n: 0 }]);
eq('înlocuirea conține textul căutat', replaceText('aa', 'a', 'aa', o()), { text: 'aaaa', n: 2 });

const cells = { A1: '=B1*2', B1: '21', A2: 'total 42', C3: '42' };
const R = (v) => ({ text: String(v), num: true, value: v });
const results = { A1: R(42), B1: R(21), C3: R(42) };
const ids = (l) => l.map((p) => String.fromCharCode(65 + p.c) + (p.r + 1));
eq('implicit: în formule și în valori', ids(findCells(cells, results, {}, '42', o())), ['A1', 'A2', 'C3']);
eq('doar în valori', ids(findCells(cells, results, {}, 'B1', o({ lookIn: 'values' }))), []);
eq('doar în formule', ids(findCells(cells, results, {}, 'B1', o({ lookIn: 'formulas' }))), ['A1']);
eq('valori + celula întreagă', ids(findCells(cells, results, {}, '42', o({ lookIn: 'values', whole: true }))), ['A1', 'C3']);
eq('rândurile ascunse se sar', ids(findCells(cells, results, {}, '42', o(), new Set([0]))), ['A2', 'C3']);

if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut');
