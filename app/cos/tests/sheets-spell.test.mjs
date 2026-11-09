// Test: Sheets → ABC Ortografie (F7): cuvintele din celule, următorul cuvânt greșit, Schimbă / Schimbă tot.
// Rulare (în suite/): node tests/sheets-spell.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const out = join(tmpdir(), `suite-spell-${process.pid}.mjs`);
const entry = join(tmpdir(), `suite-spell-entry-${process.pid}.ts`);
writeFileSync(entry, `export * from ${JSON.stringify(join(process.cwd(), 'src/spell.ts'))}; export * from ${JSON.stringify(join(process.cwd(), 'src/sheets/spell.ts'))};`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { wordsIn, spellCells, nextIssue, replaceEverywhere, spellPatch } = await import(pathToFileURL(out).href);

let bad = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : `: ${JSON.stringify(got)} în loc de ${JSON.stringify(want)}`}`);
};

eq('cuvinte cu diacritice și cratimă', wordsIn('Vânzări într-o lună, ștergeți!').map((w) => w.word), ['Vânzări', 'într-o', 'lună', 'ștergeți']);
eq('fără adrese, e-mailuri și cuvinte lipite de cifre', wordsIn('vezi www.exemplu.ro sau ana@firma.ro, 3kg A1 bine').map((w) => w.word), ['vezi', 'sau', 'bine']);
eq('locul cuvântului', wordsIn('  casa mare')[1], { word: 'mare', start: 7, end: 11 });

const cells = { A1: 'Produs', B1: '=SUM(B2:B3)', A2: 'mere verzzi', B2: '12', A3: 'pere galbne', A4: "'0123 telefn", C1: '1.250,50', D9: 'verzzi' };
const list = spellCells(cells);
eq('doar celulele cu text, rând cu rând (fără formule și numere)', list.map((x) => x.id), ['A1', 'A2', 'A3', 'A4', 'D9']);
eq('textul fără apostroful de la început', list[3].text, '0123 telefn');
eq('de la celula aleasă, apoi de sus', spellCells(cells, { r: 2, c: 0 }).map((x) => x.id), ['A3', 'A4', 'D9', 'A1', 'A2']);
eq('rândurile ascunse se sar', spellCells(cells, undefined, new Set([1])).map((x) => x.id), ['A1', 'A3', 'A4', 'D9']);

const dict = new Set(['produs', 'mere', 'pere', 'verzi', 'galbene', 'telefon']);
const wrong = (w) => !dict.has(w.toLowerCase());
const i1 = nextIssue(list, 0, 0, wrong, new Set());
eq('primul cuvânt greșit', i1, { cell: 1, id: 'A2', word: 'verzzi', start: 5, end: 11 });
eq('următorul, după el', nextIssue(list, i1.cell, i1.end, wrong, new Set())?.word, 'galbne');
eq('Ignoră tot sare cuvântul peste tot', nextIssue(list, 0, 0, wrong, new Set(['verzzi']))?.word, 'galbne');
eq('prescurtările cu majuscule nu se verifică', nextIssue([{ id: 'A1', r: 0, c: 0, text: 'TVA SRL' }], 0, 0, wrong, new Set()), null);
eq('la final: null', nextIssue(list, 4, 99, wrong, new Set()), null);
eq('Schimbă păstrează apostroful', spellPatch(cells, { A4: '0123 telefon', A2: 'mere verzi' }), { A4: "'0123 telefon", A2: 'mere verzi' });
eq('Schimbă tot', replaceEverywhere(list, 'verzzi', 'verzi'), { patch: { A2: 'mere verzi', D9: 'verzi' }, n: 2 });

console.log(bad ? `${bad} greșeli` : 'Toate verificările au trecut.');
process.exit(bad ? 1 : 0);
