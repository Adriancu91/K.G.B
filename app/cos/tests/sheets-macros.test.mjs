// Test: macrocomenzile din Sheets (Vizualizare → Macrocomenzi): pasul înregistrat ca diferență față de celula de start,
// redarea cu referințe relative (formulele mutate) și absolute, formatarea adăugată peste cea existentă, cleanMacros.
// Rulare (în suite/): node tests/sheets-macros.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-macros-${process.pid}`);
await build({ entryPoints: ['src/sheets/macros.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { diffStep, runMacro, cleanMacros, macroNameError, macroSize, macroForKey, macroSegments, insAt, sortStep, sortAt, filterStep, filterAt, layoutStep, runLayout } = await import(pathToFileURL(join(out, 'macros.js')).href);
rmSync(out, { recursive: true, force: true });

let fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'GREȘIT'} ${name}${ok ? '' : `\n   am: ${JSON.stringify(a)}\n   vreau: ${JSON.stringify(b)}`}`);
};

// Înregistrare pornită din B2: scriu un titlu, o formulă sub el, apoi aldin pe titlu și scot culoarea.
const s0 = { cells: { A1: 'x' }, styles: { B2: { color: '#f00', i: true } } };
const s1 = { cells: { A1: 'x', B2: 'Total', B3: '=A3*2' }, styles: s0.styles };
const s2 = { cells: s1.cells, styles: { B2: { i: true, b: true } } };
const at = { r: 1, c: 1 };
const st1 = diffStep(s0, s1, at, true);
const st2 = diffStep(s1, s2, at, true);
eq('pasul 1: celulele față de B2', st1, { cells: { '0,0': 'Total', '1,0': '=A3*2' } });
eq('pasul 2: doar proprietățile schimbate (culoarea scoasă = null)', st2, { styles: { '0,0': { color: null, b: true } } });
eq('nimic schimbat → null', diffStep(s1, s1, at, true), null);
eq('absolut: cheile sunt adresele', diffStep(s0, s1, at, false), { cells: { B2: 'Total', B3: '=A3*2' } });

const m = { name: 'Titlu', rel: true, steps: [st1, st2], from: 'B2' };
// Redare din D5: titlul în D5, formula în D6 mutată (=C6*2), aldin adăugat peste sublinierea existentă.
const r = runMacro(m, { cells: { D6: 'vechi' }, styles: { D5: { u: true, color: '#00f' } } }, { r: 4, c: 3 });
eq('relativ: valorile la noua celulă', r.cells, { D6: '=C6*2', D5: 'Total' });
eq('relativ: formatul adăugat, culoarea scoasă', r.styles, { D5: { u: true, b: true } });
eq('relativ: nimic în afara foii', r.outside, 0);
// Din A1 rândul de deasupra ar ieși din foaie: un pas cu „-1,0” e numărat ca în afara foii.
const up = { name: 'Sus', rel: true, from: 'B2', steps: [{ cells: { '-1,0': 'sus', '0,0': 'aici' } }] };
const ru = runMacro(up, { cells: {}, styles: {} }, { r: 0, c: 0 });
eq('în afara foii: sărită și numărată', [ru.cells, ru.outside], [{ A1: 'aici' }, 1]);
// Absolut: aceleași celule, oriunde ar fi cursorul; o celulă golită se șterge.
const ab = { name: 'Abs', rel: false, from: 'B2', steps: [{ cells: { C3: '=A1', A1: '' } }] };
eq('absolut: aceleași celule, formula nemutată', runMacro(ab, { cells: { A1: '5' }, styles: {} }, { r: 9, c: 9 }).cells, { C3: '=A1' });

eq('macroSize', macroSize(m), 2);
eq('nume gol', macroNameError('  ', []), 'Scrie un nume pentru macrocomandă.');
eq('nume folosit (fără să conteze literele mari)', macroNameError('titlu', [m]), 'Există deja o macrocomandă „titlu”.');
eq('același nume la redenumirea ei', macroNameError('Titlu', [m], 0), null);

const cl = cleanMacros([m, { name: 'Titlu', rel: true, steps: [st1] }, { name: 'Rea', rel: true, steps: [{ cells: { B2: 'x', '0,0': 5 } }] },
  { name: ' Bună ', rel: false, from: 'zz', steps: [{ cells: { A1: 'a', '0,0': 'b' }, styles: { A2: { b: true }, A3: [1] } }] }, 'gunoi']);
eq('cleanMacros: dublura și pașii răi scoși, from implicit A1', cl, [m, { name: 'Bună', rel: false, steps: [{ cells: { A1: 'a' }, styles: { A2: { b: true } } }], from: 'A1' }]);
eq('cleanMacros pe altceva decât listă', cleanMacros({}), []);
const ks = cleanMacros([{ ...m, key: 'J' }, { ...m, name: 'Doi', key: 'J' }, { ...m, name: 'Trei', key: 'jj' }]);
eq('cleanMacros: scurtătura păstrată o singură dată, cea greșită scoasă', ks.map((x) => x.key ?? '-'), ['J', '-', '-']);
eq('macroForKey: Ctrl+Shift+J', macroForKey(ks, 'KeyJ')?.name, 'Titlu');
eq('macroForKey: altă tastă sau fără listă', [macroForKey(ks, 'KeyK'), macroForKey(undefined, 'KeyJ'), macroForKey(ks, 'Digit1')], [undefined, undefined, undefined]);

// Inserările de rânduri: bucățile macrocomenzii și locul inserării la rulare.
const mi = { name: 'Ins', rel: true, from: 'A5', steps: [{ cells: { '0,0': 'x' } }, { ins: { axis: 'r', at: 0, n: 1 } }, { cells: { '0,0': 'y' } }, { cells: { '1,0': 'z' } }] };
eq('macroSegments: celule / inserare / celule', macroSegments(mi).map((s) => ('ins' in s ? 'ins' : s.steps.length)), [1, 'ins', 2]);
eq('insAt relativ (de la rândul 10 → 10), absolut, în afara foii', [insAt(mi, { axis: 'r', at: 0, n: 1 }, { r: 9, c: 0 }), insAt({ ...mi, rel: false }, { axis: 'c', at: 3, n: -1 }, { r: 9, c: 9 }), insAt(mi, { axis: 'r', at: -2, n: 1 }, { r: 0, c: 0 })], [9, 3, null]);
eq('cleanMacros păstrează inserarea, scoate una greșită', cleanMacros([{ ...mi, steps: [...mi.steps, { ins: { axis: 'x', at: 0, n: 1 } }, { ins: { axis: 'c', at: 1, n: 0 } }] }])[0].steps.length, 4);


const g = { r0: 2, r1: 9, c0: 1, c1: 3 };
const ss = sortStep(g, true, [{ col: 2, desc: true }, { col: 1, desc: false }], false, { r: 2, c: 1 }, true);
eq('sortStep relativ: tabelul din jur, coloanele 1 și 0', ss, { sort: { at: '0,0', head: true, levels: [{ col: 1, desc: true }, { col: 0, desc: false }] } });
eq('sortStep absolut, zona aleasă de mână', sortStep(g, false, [{ col: 1, desc: false }], true, { r: 0, c: 0 }, false), { sort: { at: 'B3', head: false, levels: [{ col: 0, desc: false }], size: { h: 8, w: 3 } } });
eq('sortStep fără niveluri → null', sortStep(g, false, [], false, { r: 0, c: 0 }, true), null);
const ms = { name: 'Sort', rel: true, from: 'B3', steps: [{ cells: { '0,0': 'x' } }, ss, { cells: { '1,0': 'y' } }] };
eq('macroSegments: celule / sortare / celule', macroSegments(ms).map((x) => ('sort' in x ? 'sort' : 'ins' in x ? 'ins' : x.steps.length)), [1, 'sort', 1]);
eq('sortAt relativ (din E10 → E10), absolut, în afara foii', [sortAt(ms, ss.sort, { r: 9, c: 4 }), sortAt({ ...ms, rel: false }, { at: 'B3', head: false, levels: [] }, { r: 9, c: 9 }), sortAt(ms, { at: '-5,0', head: false, levels: [] }, { r: 0, c: 0 })], [{ r: 9, c: 4 }, { r: 2, c: 1 }, null]);
eq('macroSize nu numără sortarea', macroSize(ms), 2);
const cs = cleanMacros([{ ...ms, steps: [...ms.steps, { sort: { at: '0,0', head: 1, levels: [{ col: -1 }, { col: 2, desc: true, on: 'bg', color: '#ff0', list: ['a', 3] }], size: { h: 0, w: 2 } } }, { sort: { at: 'B3', levels: [{ col: 0 }] } }] }]);
eq('cleanMacros păstrează sortarea bună, curăță nivelurile, scoate cheia greșită', cs[0].steps.slice(3), [{ sort: { at: '0,0', head: false, levels: [{ col: 2, desc: true, on: 'bg', color: '#ff0', list: ['a'] }] } }]);

// Filtrul: pus, schimbat și oprit, ținut față de start și cu coloanele după locul lor în filtru.
const f0 = { r: 2, c0: 1, c1: 3, hidden: {} };
const f1 = { r: 2, c0: 1, c1: 3, hidden: { C: ['Nord'] }, cond: { D: { op: 'gt', v1: '100' } }, color: { B: { kind: 'bg', color: '#ff0' } } };
eq('filterStep: filtrul pus', filterStep(undefined, f0, { r: 2, c: 1 }, true), { filt: { at: '0,0', w: 2 } });
eq('filterStep: valori, condiție și culoare pe coloanele 1, 2, 0', filterStep(f0, f1, { r: 2, c: 1 }, true), { filt: { at: '0,0', w: 2, hidden: { 1: ['Nord'] }, cond: { 2: { op: 'gt', v1: '100' } }, color: { 0: { kind: 'bg', color: '#ff0' } } } });
eq('filterStep: oprit / neschimbat / niciodată pus', [filterStep(f1, undefined, { r: 0, c: 0 }, true), filterStep(f1, { ...f1 }, { r: 0, c: 0 }, true), filterStep(undefined, undefined, { r: 0, c: 0 }, true)], [{ filt: { off: true } }, null, null]);
const mf = { name: 'Filtru', rel: true, from: 'B3', steps: [filterStep(f0, f1, { r: 2, c: 1 }, true)] };
eq('filterAt relativ: din E10 filtrul pe E10:G, coloanele mutate', filterAt(mf, mf.steps[0].filt, { r: 9, c: 4 }), { r: 9, c0: 4, c1: 6, hidden: { F: ['Nord'] }, cond: { G: { op: 'gt', v1: '100' } }, color: { E: { kind: 'bg', color: '#ff0' } } });
eq('filterAt: oprit, în afara foii', [filterAt(mf, { off: true }, { r: 0, c: 0 }), filterAt(mf, { at: '-3,0', w: 1 }, { r: 0, c: 0 })], [null, 'out']);
eq('macroSegments: filtrul e bucată separată', macroSegments({ ...mf, steps: [{ cells: { '0,0': 'x' } }, ...mf.steps] }).map((x) => ('filt' in x ? 'filt' : 'steps' in x ? x.steps.length : '?')), [1, 'filt']);
const cf = cleanMacros([{ ...mf, steps: [...mf.steps, { filt: { off: true } }, { filt: { at: '0,0', w: 99 } }, { filt: { at: '0,0', w: 1, hidden: { 0: ['a', 5], 7: ['b'], x: ['c'] }, cond: { 1: { op: 'rău', v1: '1' } } } }] }]);
eq('cleanMacros: filtrul bun păstrat, cel cu lățime greșită scos, coloanele din afară scoase', cf[0].steps, [...mf.steps, { filt: { off: true } }, { filt: { at: '0,0', w: 1, hidden: { 0: ['a'] } } }]);

// Așezarea: lățimi, înălțimi, rânduri / coloane ascunse, față de start.
const L0 = { colW: { B: 90 }, rowH: { 3: 40 }, hideRows: [7] };
const L1 = { colW: { B: 90, C: 150 }, rowH: {}, hideRows: [7, 4], hideCols: [4] };
const ly = layoutStep(L0, L1, { r: 1, c: 1 }, true);
eq('layoutStep relativ: C mai lată, rândul 3 obișnuit, rândul 4 și coloana D ascunse', ly, { lay: { colW: { 1: 150 }, rowH: { 1: null }, hideR: { 2: true }, hideC: { 2: true } } });
eq('layoutStep absolut / neschimbat', [layoutStep(L0, L1, { r: 1, c: 1 }, false)?.lay.hideR, layoutStep(L0, { ...L0 }, { r: 0, c: 0 }, true)], [{ 3: true }, null]);
const ml = { name: 'Asez', rel: true, from: 'B2', steps: [ly] };
const rl = runLayout(ml, ly.lay, { colW: {}, hideRows: [2] }, { r: 4, c: 2 });
eq('runLayout din C5: D mai lată, rândul 6 la înălțimea obișnuită, rândul 7 și coloana E ascunse', rl, { colW: { D: 150 }, hideRows: [2, 7], hideCols: [5], outside: 0 });
eq('runLayout: rândul de arătat iese din foaie de sus', runLayout(ml, { hideR: { '-5': false } }, { colW: {} }, { r: 0, c: 0 }).outside, 1);
eq('macroSegments: așezarea e bucată separată', macroSegments(ml).map((x) => Object.keys(x)[0]), ['lay']);
const cy = cleanMacros([{ ...ml, steps: [ly, { lay: { colW: { 1: 'lat', x: 5, 2: 9999 }, hideR: { 3: 1 } } }, { lay: { rowH: { '-1': 20 }, hideC: { 0: false } } }] }]);
eq('cleanMacros: așezarea curățată (valori greșite scoase, pasul gol scos)', cy[0].steps, [ly, { lay: { rowH: { '-1': 20 }, hideC: { 0: false } } }]);

console.log(fail ? `\n${fail} GREȘITE` : '\nTOATE BUNE');
process.exit(fail ? 1 : 0);
