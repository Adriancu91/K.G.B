// Test pentru tabelele din câmpul de scris al Notițelor (src/notes/table.ts): găsirea celulei, Tab, Enter, rânduri / coloane, sortare.
// Rulare (în suite/): node tests/notes-table.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-ntable-${process.pid}.mjs`);
await build({ entryPoints: ['src/notes/table.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { tableAt, tableOp } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };
const N = '\n';
/** Aplică modificarea și întoarce textul nou, cu „‸” la cursor. */
const run = (v, op) => {
  const pos = v.indexOf('‸'); v = v.replace('‸', '');
  const e = tableOp(v, pos, op);
  if (!e) return null;
  const nv = v.slice(0, e.from) + e.text + v.slice(e.to);
  return nv.slice(0, e.caret) + '‸' + nv.slice(e.caret);
};

const T = ['Început', '| Nume | Vârstă |', '|---|---|', '| Ana | 30 |', '| Ion | 5 |', 'Sfârșit'].join(N);
const at = (s) => { const p = T.indexOf(s); const t = tableAt(T, p); return t && [t.row, t.col]; };
eq('în afara tabelului', tableAt(T, 2), null);
eq('celula Nume', at('Nume'), [0, 0]);
eq('celula 30', at('30'), [2, 1]);
eq('celula Ion', at('Ion'), [3, 0]);
eq('rândul cu ---', tableAt(T, T.indexOf('|---')).sep, 1);

const A = ['| Nume | Vârstă |', '| ---- | ------ |', '| Ana  | 30     |', '| Ion  | 5      |'].join(N);
eq('Aliniază', run(T.replace('| Ana', '| ‸Ana'), 'align'), ['Început', A.replace('| Ana', '| ‸Ana'), 'Sfârșit'].join(N));
eq('Tab: celula următoare', run(T.replace('| Ana', '| ‸Ana'), 'next'), ['Început', A.replace('| 30', '| ‸30'), 'Sfârșit'].join(N));
eq('Tab la capăt: rând nou', run(T.replace('| 5 |', '| 5‸ |'), 'next').split(N)[5], '| ‸     |        |');
eq('Shift+Tab: celula de dinainte (rândul de sus)', run(T.replace('| Ion', '| ‸Ion'), 'prev').split(N)[3], '| Ana  | ‸30     |');
eq('Enter: rând nou dedesubt', run(T.replace('| Ana', '| ‸Ana'), 'enter').split(N).slice(3, 6), ['| Ana  | 30     |', '| ‸     |        |', '| Ion  | 5      |']);
eq('Enter pe capul tabelului: rând nou după ---', run(T.replace('| Nume', '| ‸Nume'), 'enter').split(N)[3], '| ‸     |        |');
const E = ['| a | b |', '|---|---|', '| 1 | 2 |', '| ‸ |  |', 'după'].join(N);
eq('Enter pe ultimul rând gol iese din tabel', run(E, 'enter'), ['| a   | b   |', '| --- | --- |', '| 1   | 2   |', '‸', 'după'].join(N));
eq('＋ Coloană la dreapta', run(T.replace('| Ana', '| ‸Ana'), 'colRight').split(N).slice(1, 4), ['| Nume | Coloana 2 | Vârstă |', '| ---- | --------- | ------ |', '| Ana  | ‸          | 30     |']);
eq('− Coloană', run(T.replace('| Ana', '| ‸Ana'), 'delCol').split(N).slice(1, 5), ['| Vârstă |', '| ------ |', '| ‸30     |', '| 5      |']);
eq('− Rând', run(T.replace('| Ana', '| ‸Ana'), 'delRow').split(N).slice(1, 4), ['| Nume | Vârstă |', '| ---- | ------ |', '| ‸Ion  | 5      |']);
eq('− Rând pe capul tabelului: nu', run(T.replace('| Nume', '| ‸Nume'), 'delRow'), null);
eq('Sortare după Vârstă (numere)', run(T.replace('| 30', '| ‸30'), 'sortAsc').split(N).slice(3, 5).map((l) => l.replace('‸', '')), ['| Ion  | 5      |', '| Ana  | 30     |']);
eq('Sortare Z→A după Nume', run(T.replace('| Ana', '| ‸Ana'), 'sortDesc').split(N).slice(3, 5).map((l) => l.replace('‸', '')), ['| Ion  | 5      |', '| Ana  | 30     |']);
const S = ['| Oraș |', '|---|', '| Ștei |', '| Arad |', '| Satu Mare |', '| ‸ |'].join(N);
eq('Sortare cu diacritice, celulele goale la sfârșit', run(S, 'sortAsc').split(N).slice(2).map((l) => l.replace('‸', '').trim()), ['| Arad      |', '| Satu Mare |', '| Ștei      |', '|           |']);
eq('Ultima coloană ștearsă = tabel șters', run(['x', '| ‸a |', '|---|', '| 1 |', 'y'].join(N), 'delCol'), ['x', '‸y'].join(N));

console.log(fail ? `\n${fail} greșeli` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
