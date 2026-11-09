// Test: Grupează după pe larg (mai multe coloane și calcule), pașii „Îmbină coloanele”, „Extrage din text”, unirea dintr-un dosar, „Umple celulele goale”, „Anulează pivotarea coloanelor” și „Coloană index”, „Pivotează”, „Transpune”, „Primul rând ca antet”, „Elimină primele rânduri” din Editorul de interogare (src/sheets/query.ts).
// Rulare (în suite/): node tests/sheets-query-fill.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-qfill-${process.pid}`);
await build({ entryPoints: ['src/sheets/query.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { runQuery, cleanQuery, stepLabel, combineTables, parseQExpr } = await import(pathToFileURL(join(out, 'query.js')).href);
rmSync(out, { recursive: true, force: true });

let fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'GREȘIT'} ${name}${ok ? '' : `\n   am: ${JSON.stringify(a)}\n   vreau: ${JSON.stringify(b)}`}`);
};

// Umple în jos / în sus
const t = { head: ['Zonă', 'Produs', 'Sumă'], rows: [['Nord', 'mere', 10], ['', 'pere', 5], [' ', 'prune', 3], ['Sud', 'mere', 7], ['', 'pere', '']] };
const f1 = runQuery(t, [{ k: 'fill', col: 'Zonă', up: false }]).table;
eq('umple în jos', f1.rows.map((r) => r[0]), ['Nord', 'Nord', 'Nord', 'Sud', 'Sud']);
eq('umple în jos nu atinge alte coloane', f1.rows.map((r) => r[2]), [10, 5, 3, 7, '']);
const f2 = runQuery(t, [{ k: 'fill', col: 'Zonă', up: true }]).table;
eq('umple în sus (ultimul gol rămâne gol)', f2.rows.map((r) => r[0]), ['Nord', 'Sud', 'Sud', 'Sud', '']);
eq('sursa rămâne neatinsă', t.rows[1][0], '');
eq('umple numerele', runQuery({ head: ['A'], rows: [[1], [''], [2], ['']] }, [{ k: 'fill', col: 'A', up: false }]).table.rows.flat(), [1, 1, 2, 2]);
eq('coloană lipsă = sărit', runQuery(t, [{ k: 'fill', col: 'X', up: false }]).skipped, [1]);

// Anulează pivotarea
const p = { head: ['Produs', 'Ian', 'Feb', 'Mar'], rows: [['mere', 10, 12, ''], ['pere', 4, '', 6]] };
const u1 = runQuery(p, [{ k: 'unpivot', cols: ['Ian', 'Feb', 'Mar'] }]).table;
eq('cap după anulare', u1.head, ['Produs', 'Atribut', 'Valoare']);
eq('rânduri după anulare (golurile sărite)', u1.rows, [['mere', 'Ian', 10], ['mere', 'Feb', 12], ['pere', 'Ian', 4], ['pere', 'Mar', 6]]);
const u2 = runQuery({ head: ['Atribut', 'X', 'Y'], rows: [['a', 1, 2]] }, [{ k: 'unpivot', cols: ['X', 'Y'] }]).table;
eq('nume unice când Atribut există', u2.head, ['Atribut', 'Atribut (2)', 'Valoare']);
eq('coloanele lipsă = sărit', runQuery(p, [{ k: 'unpivot', cols: ['Apr'] }]).skipped, [1]);
const u3 = runQuery(p, [{ k: 'unpivot', cols: ['Ian', 'Feb', 'Mar'] }, { k: 'group', col: 'Atribut', agg: 'sum', of: 'Valoare' }]).table;
eq('apoi grupează după lună', u3.rows, [['Ian', 14], ['Feb', 12], ['Mar', 6]]);

// Coloană index
const i1 = runQuery(t, [{ k: 'index', from: 1 }]).table;
eq('index de la 1', i1.rows.map((r) => r[3]), [1, 2, 3, 4, 5]);
eq('numele coloanei index', i1.head[3], 'Index');
const i2 = runQuery(t, [{ k: 'index', from: 0 }, { k: 'index', from: 100 }]).table;
eq('al doilea index, nume unic', i2.head.slice(3), ['Index', 'Index (2)']);
eq('index de la 100', i2.rows[4][4], 104);
eq('index după filtru', runQuery(t, [{ k: 'filter', col: 'Produs', op: 'eq', v: 'pere' }, { k: 'index', from: 1 }]).table.rows.map((r) => r[3]), [1, 2]);

// Pivotează coloana (inversul anulării)
const v1 = runQuery(p, [{ k: 'unpivot', cols: ['Ian', 'Feb', 'Mar'] }, { k: 'pivot', col: 'Atribut', val: 'Valoare', agg: 'sum' }]).table;
eq('pivotare: cap', v1.head, ['Produs', 'Ian', 'Feb', 'Mar']);
eq('pivotare: înapoi la tabelul inițial (golurile rămân goale)', v1.rows, [['mere', 10, 12, ''], ['pere', 4, '', 6]]);
const sales = { head: ['Zonă', 'Lună', 'Sumă'], rows: [['Nord', 'Ian', 5], ['nord', 'Ian', 2], ['Sud', 'Feb', 3], ['Nord', 'Feb', 'x']] };
eq('pivotare cu sumă (Nord = nord)', runQuery(sales, [{ k: 'pivot', col: 'Lună', val: 'Sumă', agg: 'sum' }]).table.rows, [['Nord', 7, ''], ['Sud', '', 3]]);
eq('pivotare cu număr de rânduri', runQuery(sales, [{ k: 'pivot', col: 'Lună', val: 'Sumă', agg: 'count' }]).table.rows, [['Nord', 2, 1], ['Sud', '', 1]]);
eq('pivotare pe aceeași coloană = sărit', runQuery(sales, [{ k: 'pivot', col: 'Lună', val: 'Lună', agg: 'sum' }]).skipped, [1]);
// Transpune
const tr = runQuery({ head: ['Indicator', '2024', '2025'], rows: [['Venit', 10, 12], ['Cost', 4, 5]] }, [{ k: 'transpose' }]).table;
eq('transpune: cap', tr.head, ['Indicator', 'Venit', 'Cost']);
eq('transpune: rânduri', tr.rows, [['2024', 10, 4], ['2025', 12, 5]]);
// Primul rând ca nume de coloane, elimină primele rânduri
const raw = { head: ['Coloana 1', 'Coloana 2', 'Coloana 3'], rows: [['Raport lunar', '', ''], ['Nume', 'Sumă', 'Nume'], ['Ana', 5, 'x']] };
const pr = runQuery(raw, [{ k: 'skip', n: 1 }, { k: 'promote' }]).table;
eq('elimină 1 rând, apoi primul rând ca antet', pr.head, ['Nume', 'Sumă', 'Nume (2)']);
eq('rândurile rămase', pr.rows, [['Ana', 5, 'x']]);
eq('antet fără rânduri = sărit', runQuery({ head: ['A'], rows: [] }, [{ k: 'promote' }]).skipped, [1]);
eq('elimină mai multe decât sunt', runQuery(raw, [{ k: 'skip', n: 9 }]).table.rows.length, 0);

// Coloană condițională, Schimbă tipul
const sc = { head: ['Nume', 'Scor', 'Notă'], rows: [['Ana', 9, '9,5'], ['Dan', 4, 'x'], ['Ema', '', '7.4']] };
const c1 = runQuery(sc, [{ k: 'cond', name: 'Rezultat', col: 'Scor', op: 'ge', v: '5', then: 'admis', else: 'respins' }]).table;
eq('condițională: dacă Scor ≥ 5', c1.rows.map((r) => r[3]), ['admis', 'respins', 'respins']);
eq('condițională: numele coloanei', c1.head[3], 'Rezultat');
eq('condițională: atunci număr', runQuery(sc, [{ k: 'cond', name: 'Bonus', col: 'Scor', op: 'empty', v: '', then: '0', else: '10' }]).table.rows.map((r) => r[3]), [10, 10, 0]);
eq('condițională: nume deja folosit = sărit', runQuery(sc, [{ k: 'cond', name: 'Scor', col: 'Nume', op: 'eq', v: 'Ana', then: '1', else: '0' }]).skipped, [1]);
eq('tip: număr zecimal', runQuery(sc, [{ k: 'type', col: 'Notă', to: 'dec' }]).table.rows.map((r) => r[2]), [9.5, '', 7.4]);
eq('tip: număr întreg', runQuery(sc, [{ k: 'type', col: 'Notă', to: 'int' }]).table.rows.map((r) => r[2]), [10, '', 7]);
eq('tip: text', runQuery(sc, [{ k: 'type', col: 'Scor', to: 'text' }]).table.rows.map((r) => r[1]), ['9', '4', '']);

// Citire din fișier și etichete
const q = cleanQuery({ src: 'Foaia 1', range: { r0: 0, c0: 0, r1: 4, c1: 2 }, steps: [
  { k: 'fill', col: 'Zonă', up: false }, { k: 'fill', col: 'Zonă' }, { k: 'unpivot', cols: [] }, { k: 'unpivot', cols: ['Ian'] }, { k: 'index', from: 1 }, { k: 'index', from: 'x' }, { k: 'pivot', col: 'A', val: 'B', agg: 'sum' }, { k: 'pivot', col: 'A', agg: 'sum' }, { k: 'transpose' }, { k: 'promote' }, { k: 'skip', n: 2 }, { k: 'skip' }, { k: 'cond', name: 'R', col: 'A', op: 'ge', v: '5', then: 'da', else: 'nu' }, { k: 'cond', name: 'R', col: 'A', op: 'zz', v: '', then: '', else: '' }, { k: 'type', col: 'A', to: 'int' }, { k: 'type', col: 'A', to: 'date' }] });
eq('pașii păstrați la citire', q.steps.map((s) => s.k), ['fill', 'unpivot', 'index', 'pivot', 'transpose', 'promote', 'skip', 'cond', 'type']);
eq('etichete', [stepLabel({ k: 'fill', col: 'Zonă', up: false }), stepLabel({ k: 'fill', col: 'Zonă', up: true }), stepLabel({ k: 'unpivot', cols: ['Ian', 'Feb'] }), stepLabel({ k: 'index', from: 1 }), stepLabel({ k: 'pivot', col: 'Lună', val: 'Sumă', agg: 'sum' }), stepLabel({ k: 'skip', n: 2 }), stepLabel({ k: 'cond', name: 'R', col: 'Scor', op: 'ge', v: '5', then: 'admis', else: 'respins' }), stepLabel({ k: 'type', col: 'Notă', to: 'int' })],
  ['Umple în jos: Zonă', 'Umple în sus: Zonă', 'Anulează pivotarea coloanelor: Ian, Feb', 'Coloană index de la 1', 'Pivotează Lună, valorile din Sumă (sumă)', 'Elimină primele 2 rânduri', 'Coloană condițională R: dacă Scor mai mare sau egal cu „5” atunci „admis”, altfel „respins”', 'Schimbă tipul: Notă → Număr întreg']);

eq('sursa fișier păstrată la citire', cleanQuery({ src: 'v.csv', file: 'C:/d/v.csv', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [] }).file, 'C:/d/v.csv');
eq('fișier greșit scos', cleanQuery({ src: 'v.csv', file: 5, range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [] }).file, undefined);

// Din dosar: tabelele unite, coloanele după nume, numele fișierului în față
const cb = combineTables([{ name: 'ian.csv', t: { head: ['Zonă', 'Sumă'], rows: [['Nord', 1], ['Sud', 2]] } }, { name: 'feb.csv', t: { head: ['sumă', 'Zonă', 'Notă'], rows: [[3, 'Est', 'x']] } }]);
eq('dosar: capul', cb.head, ['Fișier', 'Zonă', 'Sumă', 'Notă']);
eq('dosar: rândurile', cb.rows, [['ian.csv', 'Nord', 1, ''], ['ian.csv', 'Sud', 2, ''], ['feb.csv', 'Est', 3, 'x']]);
eq('dosar: coloana Fișier deja folosită', combineTables([{ name: 'a', t: { head: ['Fișier'], rows: [['x']] } }]).head, ['Fișier (2)', 'Fișier']);
eq('dosar: filtrul merge pe rezultat', runQuery(cb, [{ k: 'filter', col: 'Fișier', op: 'eq', v: 'feb.csv' }]).table.rows.length, 1);
eq('dosar: sursa păstrată la citire', cleanQuery({ src: 'Lunar', file: 'C:\\d\\Lunar\\', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [] }).file, 'C:\\d\\Lunar\\');

// Îmbină coloanele: valorile lipite cu separatorul, coloana nouă în locul primei, cele goale sar
const pe = { head: ['Id', 'Prenume', 'Nume', 'Oraș'], rows: [[1, 'Ana', 'Pop', 'Cluj'], [2, 'Ion', '', 'Iași'], [3, '', '', 'Arad']] };
const m1 = runQuery(pe, [{ k: 'mcols', cols: ['Nume', 'Prenume'], sep: ' ', name: 'Nume complet' }]).table;
eq('îmbină: capul', m1.head, ['Id', 'Nume complet', 'Oraș']);
eq('îmbină: valorile (ordinea aleasă, golurile sar)', m1.rows.map((r) => r[1]), ['Pop Ana', 'Ion', '']);
eq('îmbină: coloana lipsă = sărit', runQuery(pe, [{ k: 'mcols', cols: ['Nume', 'X'], sep: ' ', name: 'N' }]).skipped, [1]);
eq('îmbină: numele deja folosit de altă coloană = sărit', runQuery(pe, [{ k: 'mcols', cols: ['Nume', 'Prenume'], sep: ' ', name: 'Oraș' }]).skipped, [1]);
eq('îmbină: numele uneia din coloanele îmbinate e voie', runQuery(pe, [{ k: 'mcols', cols: ['Prenume', 'Nume'], sep: '-', name: 'Nume' }]).table.head, ['Id', 'Nume', 'Oraș']);
// Extrage din text
const tx = { head: ['Cod', 'Email'], rows: [['RO-1234', 'ana@firma.ro'], ['BG-77', 'fara'], ['', 'ion@x.com']] };
eq('extrage: primele 2', runQuery(tx, [{ k: 'extract', col: 'Cod', how: 'first', v: '2' }]).table.rows.map((r) => r[0]), ['RO', 'BG', '']);
eq('extrage: ultimele 2 (numere)', runQuery(tx, [{ k: 'extract', col: 'Cod', how: 'last', v: '2' }]).table.rows.map((r) => r[0]), [34, 77, '']);
eq('extrage: după @', runQuery(tx, [{ k: 'extract', col: 'Email', how: 'after', v: '@' }]).table.rows.map((r) => r[1]), ['firma.ro', '', 'x.com']);
eq('extrage: înainte de @', runQuery(tx, [{ k: 'extract', col: 'Email', how: 'before', v: '@' }]).table.rows.map((r) => r[1]), ['ana', '', 'ion']);
eq('extrage: lungimea (diacritice = un caracter)', runQuery({ head: ['T'], rows: [['ăîș'], [''], [12345]] }, [{ k: 'extract', col: 'T', how: 'len', v: '' }]).table.rows.flat(), [3, 0, 5]);
eq('extrage: separator gol = sărit', runQuery(tx, [{ k: 'extract', col: 'Email', how: 'after', v: '' }]).skipped, [1]);
eq('pașii noi păstrați la citire', cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [{ k: 'mcols', cols: ['A', 'B'], sep: ' ', name: 'C' }, { k: 'mcols', cols: ['A'], sep: ' ', name: 'C' }, { k: 'extract', col: 'A', how: 'first', v: '2' }, { k: 'extract', col: 'A', how: 'zz', v: '2' }] }).steps.map((x) => x.k), ['mcols', 'extract']);
eq('etichete noi', [stepLabel({ k: 'mcols', cols: ['Nume', 'Prenume'], sep: ' ', name: 'Tot' }), stepLabel({ k: 'extract', col: 'Cod', how: 'first', v: '2' }), stepLabel({ k: 'extract', col: 'E', how: 'after', v: '@' }), stepLabel({ k: 'extract', col: 'E', how: 'len', v: '' })],
  ['Îmbină coloanele Nume, Prenume în Tot (cu „ ”)', 'Extrage din Cod: primele 2 caractere', 'Extrage din E: textul de după „@”', 'Extrage din E: lungimea textului']);

// Grupează după pe larg: după Zonă și Lună, cu sumă, număr de rânduri și maxim
const gv = { head: ['Zonă', 'Lună', 'Sumă'], rows: [['Nord', 'ian', 5], ['nord ', 'ian', 2], ['Nord', 'feb', 4], ['Sud', 'ian', 3], ['Sud', 'ian', 'x']] };
const g1 = runQuery(gv, [{ k: 'group', col: 'Zonă', agg: 'sum', of: 'Sumă', by: ['Lună'], more: [{ agg: 'count' }, { agg: 'max', of: 'Sumă' }] }]).table;
eq('grupare pe larg: capul', g1.head, ['Zonă', 'Lună', 'Sumă Sumă', 'Număr de rânduri', 'Maxim Sumă']);
eq('grupare pe larg: rândurile', g1.rows, [['Nord', 'ian', 7, 2, 5], ['Nord', 'feb', 4, 1, 4], ['Sud', 'ian', 3, 2, 3]]);
eq('grupare: același calcul de două ori = nume (2)', runQuery(gv, [{ k: 'group', col: 'Zonă', agg: 'count', more: [{ agg: 'count' }] }]).table.head, ['Zonă', 'Număr de rânduri', 'Număr de rânduri (2)']);
eq('grupare: coloană lipsă în by = sărit', runQuery(gv, [{ k: 'group', col: 'Zonă', agg: 'count', by: ['X'] }]).skipped, [1]);
eq('grupare: coloană lipsă într-un calcul = sărit', runQuery(gv, [{ k: 'group', col: 'Zonă', agg: 'count', more: [{ agg: 'sum', of: 'X' }] }]).skipped, [1]);
eq('grupare simplă neschimbată', runQuery(gv, [{ k: 'group', col: 'Zonă', agg: 'sum', of: 'Sumă' }]).table.rows, [['Nord', 11], ['Sud', 3]]);
eq('grupare pe larg: eticheta', stepLabel({ k: 'group', col: 'Zonă', agg: 'sum', of: 'Sumă', by: ['Lună'], more: [{ agg: 'count' }] }), 'Grupează după Zonă, Lună: sumă din Sumă; număr de rânduri');
eq('grupare pe larg păstrată la citire', cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [{ k: 'group', col: 'A', agg: 'count', by: ['B'], more: [{ agg: 'sum', of: 'C' }] }, { k: 'group', col: 'A', agg: 'count', by: [3] }, { k: 'group', col: 'A', agg: 'count', more: [{ agg: 'zz' }] }] }).steps.length, 1);

// Duplică coloana și Rotunjește
const rd = { head: ['Preț', 'Notă'], rows: [[2.675, 'a'], [-1.25, 'b'], ['x', 'c'], ['', 'd'], [1234, 'e']] };
const d1 = runQuery(rd, [{ k: 'dup', col: 'Preț' }, { k: 'dup', col: 'Preț' }]).table;
eq('duplică: capul', d1.head, ['Preț', 'Preț - Copie (2)', 'Preț - Copie', 'Notă']);
eq('duplică: valorile', d1.rows[0], [2.675, 2.675, 2.675, 'a']);
eq('rotunjește la 2 zecimale', runQuery(rd, [{ k: 'round', col: 'Preț', how: 'round', n: 2 }]).table.rows.map((r) => r[0]), [2.68, -1.25, 'x', '', 1234]);
eq('rotunjește la întreg (jumătatea departe de zero)', runQuery(rd, [{ k: 'round', col: 'Preț', how: 'round', n: 0 }]).table.rows.map((r) => r[0]), [3, -1, 'x', '', 1234]);
eq('rotunjește în sus / în jos', [runQuery(rd, [{ k: 'round', col: 'Preț', how: 'up', n: 1 }]).table.rows[0][0], runQuery(rd, [{ k: 'round', col: 'Preț', how: 'down', n: 1 }]).table.rows[1][0]], [2.7, -1.3]);
eq('rotunjește la sute', runQuery(rd, [{ k: 'round', col: 'Preț', how: 'round', n: -2 }]).table.rows[4][0], 1200);
eq('etichete dup / round', [stepLabel({ k: 'dup', col: 'Preț' }), stepLabel({ k: 'round', col: 'Preț', how: 'up', n: 2 }), stepLabel({ k: 'round', col: 'Preț', how: 'round', n: 0 })], ['Duplică coloana Preț', 'Rotunjește Preț în sus la 2 zecimale', 'Rotunjește Preț la 0 zecimale']);
eq('dup / round păstrate la citire', cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [{ k: 'dup', col: 'A' }, { k: 'dup' }, { k: 'round', col: 'A', how: 'up', n: 1 }, { k: 'round', col: 'A', how: 'zz', n: 1 }] }).steps.map((x) => x.k), ['dup', 'round']);

// Din dată: coloana nouă după coloana cu date; numere de zi, text 31.10.2026 / 2026-01-04 cu oră; ce nu e dată rămâne gol.
const ser = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
const dt = { head: ['Data', 'Sumă'], rows: [[ser(2026, 10, 31), 1], ['29.02.2024', 2], ['2026-01-04 10:30', 3], ['nu e dată', 4], ['', 5], ['31.02.2026', 6]] };
const dcol = (how) => runQuery(dt, [{ k: 'date', col: 'Data', how }]).table.rows.map((r) => r[1]);
eq('din dată: capul', runQuery(dt, [{ k: 'date', col: 'Data', how: 'year' }, { k: 'date', col: 'Data', how: 'year' }]).table.head, ['Data', 'An (2)', 'An', 'Sumă']);
eq('din dată: anul', dcol('year'), [2026, 2024, 2026, '', '', '']);
eq('din dată: luna / numele lunii', [dcol('month'), dcol('mname').slice(0, 3)], [[10, 2, 1, '', '', ''], ['octombrie', 'februarie', 'ianuarie']]);
eq('din dată: ziua / trimestrul', [dcol('day').slice(0, 3), dcol('quarter').slice(0, 3)], [[31, 29, 4], [4, 1, 1]]);
eq('din dată: ziua săptămânii (sâmbătă, joi, duminică)', [dcol('wday').slice(0, 3), dcol('dname').slice(0, 3)], [[6, 4, 7], ['sâmbătă', 'joi', 'duminică']]);
eq('din dată: săptămâna ISO (4.01.2026 e în săpt. 1, 31.10.2026 în 44, 1.01.2027 în 53)', runQuery({ head: ['D'], rows: [['04.01.2026'], ['31.10.2026'], ['01.01.2027'], ['29.12.2025']] }, [{ k: 'date', col: 'D', how: 'week' }]).table.rows.map((r) => r[1]), [1, 44, 53, 1]);
eq('din dată: an-lună, începutul / sfârșitul lunii', [dcol('ym')[1], dcol('som')[0], dcol('eom')[1], dcol('eom')[0]], ['2024-02', '01.10.2026', '29.02.2024', '31.10.2026']);
eq('din dată: eticheta', stepLabel({ k: 'date', col: 'Data', how: 'quarter' }), 'Din dată: Data → Trimestrul');
eq('din dată păstrat la citire', cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [{ k: 'date', col: 'A', how: 'week' }, { k: 'date', col: 'A', how: 'zz' }, { k: 'date', how: 'year' }] }).steps.map((x) => x.how), ['week']);

// Calcul pe coloană (în locul valorilor), Elimină ultimele rânduri, Inversează rândurile.
const mt = { head: ['N', 'T'], rows: [[10, 'a'], [-4, 'b'], ['x', 'c'], ['', 'd'], [2.5, 'e']] };
const mcol = (op, v = '') => runQuery(mt, [{ k: 'math', col: 'N', op, v }]).table.rows.map((r) => r[0]);
eq('calcul: adună / scade', [mcol('add', '1,5'), mcol('sub', '0.1')], [[11.5, -2.5, 'x', '', 4], [9.9, -4.1, 'x', '', 2.4]]);
eq('calcul: înmulțește / împarte / împarte la 0', [mcol('mul', '3'), mcol('div', '4'), mcol('div', '0')], [[30, -12, 'x', '', 7.5], [2.5, -1, 'x', '', 0.625], ['', '', 'x', '', '']]);
eq('calcul: procent / putere / restul', [mcol('pct', '19'), mcol('pow', '2'), mcol('mod', '3')], [[1.9, -0.76, 'x', '', 0.475], [100, 16, 'x', '', 6.25], [1, 2, 'x', '', 2.5]]);
eq('calcul: absolută / rădăcina / semnul', [mcol('abs'), mcol('sqrt'), mcol('neg')], [[10, 4, 'x', '', 2.5], [3.16227766016838, '', 'x', '', 1.58113883008419], [-10, 4, 'x', '', -2.5]]);
eq('calcul: prefix / sufix (golurile rămân goale)', [mcol('prefix', 'RO'), mcol('suffix', ' lei')], [['RO10', 'RO-4', 'ROx', '', 'RO2.5'], ['10 lei', '-4 lei', 'x lei', '', '2.5 lei']]);
eq('calcul cu un număr greșit e sărit', runQuery(mt, [{ k: 'math', col: 'N', op: 'mul', v: 'abc' }]).skipped, [1]);
eq('elimină ultimele 2 rânduri / mai multe decât sunt', [runQuery(mt, [{ k: 'skipb', n: 2 }]).table.rows.map((r) => r[1]), runQuery(mt, [{ k: 'skipb', n: 9 }]).table.rows.length], [['a', 'b', 'c'], 0]);
eq('inversează rândurile', runQuery(mt, [{ k: 'reverse' }]).table.rows.map((r) => r[1]), ['e', 'd', 'c', 'b', 'a']);
eq('etichete math / skipb / reverse', [stepLabel({ k: 'math', col: 'N', op: 'pct', v: '19' }), stepLabel({ k: 'math', col: 'N', op: 'abs', v: '' }), stepLabel({ k: 'skipb', n: 3 }), stepLabel({ k: 'reverse' })], ['Calcul pe N: procent din valoare (%) „19”', 'Calcul pe N: valoarea absolută', 'Elimină ultimele 3 rânduri', 'Inversează ordinea rândurilor']);
eq('math / skipb / reverse păstrate la citire', cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [{ k: 'math', col: 'A', op: 'add', v: '1' }, { k: 'math', col: 'A', op: 'zz', v: '1' }, { k: 'skipb', n: 1 }, { k: 'skipb' }, { k: 'reverse' }] }).steps.map((x) => x.k), ['math', 'skipb', 'reverse']);

// Mută coloana, Păstrează doar dublurile, Păstrează un interval de rânduri.
const mv = { head: ['A', 'B', 'C', 'D'], rows: [[1, 'x', 'Ana', 5], [2, 'y', 'ana', 6], [3, 'z', 'Dan', 7], [4, 'w', 'Ion', 8], [5, 'v', 'Dan', 9]] };
const mh = (col, to) => runQuery(mv, [{ k: 'move', col, to }]).table;
eq('mută la început / la sfârșit', [mh('C', 'first').head, mh('B', 'last').head], [['C', 'A', 'B', 'D'], ['A', 'C', 'D', 'B']]);
eq('mută la stânga / la dreapta (la margine rămâne)', [mh('C', 'left').head, mh('C', 'right').head, mh('A', 'left').head, mh('D', 'right').head], [['A', 'C', 'B', 'D'], ['A', 'B', 'D', 'C'], ['A', 'B', 'C', 'D'], ['A', 'B', 'C', 'D']]);
eq('mută: valorile merg cu coloana', mh('C', 'first').rows[0], ['Ana', 1, 'x', 5]);
eq('păstrează doar dublurile (fără deosebire de litere mari)', runQuery(mv, [{ k: 'keepdup', col: 'C' }]).table.rows.map((r) => r[0]), [1, 2, 3, 5]);
eq('păstrează doar dublurile: niciunul', runQuery(mv, [{ k: 'keepdup', col: 'A' }]).table.rows.length, 0);
eq('interval de rânduri', [runQuery(mv, [{ k: 'range', from: 2, n: 3 }]).table.rows.map((r) => r[0]), runQuery(mv, [{ k: 'range', from: 4, n: 10 }]).table.rows.map((r) => r[0]), runQuery(mv, [{ k: 'range', from: 9, n: 2 }]).table.rows.length], [[2, 3, 4], [4, 5], 0]);
eq('etichete move / keepdup / range', [stepLabel({ k: 'move', col: 'C', to: 'left' }), stepLabel({ k: 'keepdup', col: 'C' }), stepLabel({ k: 'range', from: 2, n: 3 })], ['Mută coloana C: un loc la stânga', 'Păstrează doar dublurile din C', 'Păstrează 3 rânduri de la rândul 2']);
eq('move / keepdup / range păstrate la citire', cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [{ k: 'move', col: 'A', to: 'last' }, { k: 'move', col: 'A', to: 'sus' }, { k: 'keepdup', col: 'A' }, { k: 'keepdup' }, { k: 'range', from: 1, n: 2 }, { k: 'range', from: 1 }] }).steps.map((x) => x.k), ['move', 'keepdup', 'range']);

// Elimină coloanele, Elimină rândurile cu erori.
const er = { head: ['A', 'B', 'C'], rows: [[1, '#DIV/0!', 'x'], [2, 'ok', '#N/A'], [3, 'bine', 'y'], [4, ' #value! ', 'z'], [5, '#hashtag', 'w']] };
eq('elimină coloanele', runQuery(er, [{ k: 'drop', cols: ['B', 'Z'] }]).table.head, ['A', 'C']);
eq('elimină toate coloanele: pasul e sărit', runQuery(er, [{ k: 'drop', cols: ['A', 'B', 'C'] }]).skipped, [1]);
eq('elimină rândurile cu erori (#hashtag nu e eroare)', runQuery(er, [{ k: 'noerr' }]).table.rows.map((r) => r[0]), [3, 5]);
eq('etichete drop / noerr', [stepLabel({ k: 'drop', cols: ['B', 'C'] }), stepLabel({ k: 'noerr' })], ['Elimină coloanele: B, C', 'Elimină rândurile cu erori']);
eq('drop / noerr păstrate la citire', cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [{ k: 'drop', cols: ['A'] }, { k: 'drop', cols: [] }, { k: 'noerr' }] }).steps.map((x) => x.k), ['drop', 'noerr']);

// Coloană personalizată (formulă cu [coloane]).
const cu = { head: ['Preț', 'Cant', 'Nume'], rows: [[10, 3, 'Ana'], [2.5, 4, 'Dan'], ['x', 1, 'Ion'], [5, '', ''], [8, 0, 'Eva']] };
const cx = (expr) => runQuery(cu, [{ k: 'custom', name: 'R', expr }]).table.rows.map((r) => r[3]);
eq('personalizată: [Preț] * [Cant] * 1,19', cx('[Preț] * [Cant] * 1,19'), [35.7, 11.9, '', 0, 0]);
eq('personalizată: ordinea operațiilor și paranteze', [cx('[Preț] + [Cant] * 2')[0], cx('([Preț] + [Cant]) * 2')[0], cx('2 ^ 3 ^ 2')[0], cx('-[Preț] + 1')[0], cx('10 - 2 - 3')[0]], [16, 26, 512, -9, 5]);
eq('personalizată: împărțire la 0 → gol', cx('[Preț] / [Cant]'), [3.33333333333333, 0.625, '', '', '']);
eq('personalizată: text cu &', cx('[Nume] & " - " & [Cant]'), ['Ana - 3', 'Dan - 4', 'Ion - 1', ' - ', 'Eva - 0']);
eq('personalizată: ghilimele românești', cx('„Dl. ” & [Nume]')[0], 'Dl. Ana');
eq('personalizată: erori de scriere', ['[Preț] *', '([Preț]', '[Preț', '[Preț] $ 2', ''].map((e) => parseQExpr(e).err), ['Formula se termină prea devreme', 'Lipsește „)”', 'Lipsește „]”', 'Nu înțeleg „$”', 'Scrie formula']);
eq('personalizată: coloană lipsă sau nume ocupat → sărit', [runQuery(cu, [{ k: 'custom', name: 'R', expr: '[Zzz] + 1' }]).skipped, runQuery(cu, [{ k: 'custom', name: 'Nume', expr: '1' }]).skipped], [[1], [1]]);
eq('personalizată: eticheta și citirea', [stepLabel({ k: 'custom', name: 'T', expr: '[A] * 2' }), cleanQuery({ src: 'F', range: { r0: 0, c0: 0, r1: 3, c1: 1 }, steps: [{ k: 'custom', name: 'T', expr: '1' }, { k: 'custom', name: 'T' }] }).steps.length], ['Coloană personalizată T = [A] * 2', 1]);

console.log(fail ? `\n${fail} GREȘELI` : '\nTOATE BUNE');
process.exit(fail ? 1 : 0);
