// Test: relațiile dintre tabele (Date → 🔗 Relații) și tabelul din model: verificarea relațiilor (tabele / coloane lipsă,
// chei repetate în tabelul de căutare, cerc), drumul peste două legături, numele coloanelor aduse, cleanRels.
// Rulare (în suite/): node tests/sheets-relations.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-rels-${process.pid}`);
await build({ entryPoints: ['src/sheets/relations.ts', 'src/sheets/query.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { relProblem, modelSteps, cleanRels, relTree, detectRels } = await import(pathToFileURL(join(out, 'relations.js')).href);
const { runQuery } = await import(pathToFileURL(join(out, 'query.js')).href);
rmSync(out, { recursive: true, force: true });

let fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'GREȘIT'} ${name}${ok ? '' : `\n   am: ${JSON.stringify(a)}\n   vreau: ${JSON.stringify(b)}`}`);
};

const vanzari = { head: ['Data', 'Client', 'Produs', 'Sumă'], rows: [['01.10', 'C1', 'P1', 100], ['02.10', 'C2', 'P2', 50], ['03.10', 'c1 ', 'P3', 30], ['04.10', 'C9', 'P1', 5]] };
const clienti = { head: ['Cod', 'Nume', 'Oraș'], rows: [['C1', 'Ana', 'Iași'], ['C2', 'Bogdan', 'Cluj']] };
const produse = { head: ['Cod', 'Denumire', 'Categorie', 'Sumă'], rows: [['P1', 'Pix', 'K1', 2], ['P2', 'Caiet', 'K2', 7], ['P3', 'Creion', 'K1', 1]] };
const categorii = { head: ['Id', 'Categorie'], rows: [['K1', 'Papetărie'], ['K2', 'Hârtie']] };
const dubluri = { head: ['Cod', 'Nume'], rows: [['C1', 'Ana'], ['c1', 'Alta']] };
const T = { vanzari, clienti, produse, categorii, dubluri };
const other = (n) => T[n.toLowerCase()];

const rC = { from: 'Vanzari', col: 'Client', to: 'Clienti', col2: 'Cod' };
const rP = { from: 'Vanzari', col: 'Produs', to: 'Produse', col2: 'Cod' };
const rK = { from: 'Produse', col: 'Categorie', to: 'Categorii', col2: 'Id' };
const rels = [rC, rP, rK];

eq('relație bună', relProblem(rC, other, rels), null);
eq('tabel lipsă', relProblem({ ...rC, to: 'Furnizori' }, other), 'Nu găsesc tabelul „Furnizori”');
eq('coloană lipsă', relProblem({ ...rC, col: 'Clientul' }, other), 'Tabelul „Vanzari” nu are coloana „Clientul”');
eq('chei repetate (fără majuscule)', relProblem({ ...rC, to: 'Dubluri' }, other)?.includes('de mai multe ori'), true);
eq('cerc', relProblem({ from: 'Categorii', col: 'Id', to: 'Vanzari', col2: 'Data' }, other, rels)?.startsWith('Relația ar face un cerc'), true);
eq('drumul din Vânzări', relTree('Vanzari', rels).map((x) => x.table), ['Clienti', 'Produse', 'Categorii']);

const steps = modelSteps('Vanzari', rels, { Clienti: ['Nume'], Categorii: ['Categorie'] }, other);
eq('pașii: Clienți, Produse (doar cheia), Categorii', steps, [
  { k: 'merge', src: 'Clienti', col: 'Client', col2: 'Cod', how: 'left', cols: ['Nume'] },
  { k: 'merge', src: 'Produse', col: 'Produs', col2: 'Cod', how: 'left', cols: ['Categorie'] },
  { k: 'merge', src: 'Categorii', col: 'Categorie', col2: 'Id', how: 'left', cols: ['Categorie'] },
]);
const t = runQuery(vanzari, steps, other).table;
eq('tabelul din model: capul', t.head, ['Data', 'Client', 'Produs', 'Sumă', 'Nume', 'Categorie', 'Categorie (2)']);
eq('tabelul din model: rândurile (cheia fără majuscule, C9 fără pereche rămâne)', t.rows, [
  ['01.10', 'C1', 'P1', 100, 'Ana', 'K1', 'Papetărie'], ['02.10', 'C2', 'P2', 50, 'Bogdan', 'K2', 'Hârtie'],
  ['03.10', 'c1 ', 'P3', 30, 'Ana', 'K1', 'Papetărie'], ['04.10', 'C9', 'P1', 5, '', 'K1', 'Papetărie']]);

const s2 = modelSteps('Vanzari', rels, { Produse: ['Sumă', 'Denumire'] }, other);
eq('Sumă din Produse devine Sumă (2), Categorii nu intră', [s2.length, runQuery(vanzari, s2, other).table.head], [1, ['Data', 'Client', 'Produs', 'Sumă', 'Sumă (2)', 'Denumire']]);
eq('nimic ales = niciun pas', modelSteps('Vanzari', rels, {}, other), []);
eq('cleanRels: scoate dublurile, tabelul legat de el însuși și câmpurile goale', cleanRels([rC, { ...rC }, { from: 'A', col: 'x', to: 'a', col2: 'y' }, { from: 'A', col: '', to: 'B', col2: 'y' }, null, rK]), [rC, rK]);
eq('cleanRels: altceva decât listă', cleanRels('x'), []);

// 🔍 Găsește singur: Vânzări.Client nu seamănă ca nume cu Clienti.Cod, deci doar cu numele potrivite.
const v2 = { head: ['Data', 'Cod client', 'Cod produs', 'Sumă'], rows: [['1', 'C1', 'P1', 1], ['2', 'C2', 'P2', 2], ['3', 'C1', 'P2', 3]] };
const T2 = { v2, clienti, produse, categorii, scurt: { head: ['Cod'], rows: [['C1']] } };
const o2 = (n) => T2[n.toLowerCase()];
eq('detectRels: Cod client → Clienti.Cod, Cod produs → Produse.Cod', detectRels(['v2', 'clienti', 'produse', 'categorii', 'scurt'], o2),
  [{ from: 'v2', col: 'Cod client', to: 'clienti', col2: 'Cod' }, { from: 'v2', col: 'Cod produs', to: 'produse', col2: 'Cod' }]);
eq('detectRels: nu propune ce există deja', detectRels(['v2', 'clienti'], o2, [{ from: 'v2', col: 'Cod client', to: 'clienti', col2: 'Cod' }]), []);
eq('detectRels: o valoare negăsită oprește propunerea', detectRels(['vanzari', 'clienti'], (n) => ({ vanzari: { head: ['Cod'], rows: [['C1'], ['C1'], ['C9']] }, clienti })[n]), []);

console.log(fail ? `\n${fail} GREȘITE` : '\nTOATE OK');
process.exit(fail ? 1 : 0);
