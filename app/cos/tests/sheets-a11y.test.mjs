// Test pentru Sheets → ♿ Accesibilitate: contrastul textului, celulele îmbinate, numele foilor, foile ascunse, graficele fără titlu, legăturile.
// Rulare (în suite/): node tests/sheets-a11y.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-sha11y-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/a11y.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { checkSheets } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const J = JSON.stringify;
const sh = (p) => ({ name: 'Vânzări', cells: {}, styles: {}, colW: {}, ...p });

check('foaia curată nu are probleme', checkSheets([sh({ cells: { A1: 'Total', B1: '5' }, styles: { A1: { b: true, color: '#1f2937', bg: '#e5e7eb' } } })]).length === 0);
const low = checkSheets([sh({ cells: { A1: 'Gri pe alb', B2: 'Galben' }, styles: { A1: { color: '#bbbbbb' }, B2: { color: '#ffff00', bg: '#ffffff' } } })]);
check('textul deschis pe alb', low.length === 2 && low[0].cell === 'A1' && /contrast 1,9 : 1/.test(low[0].text), J(low));
check('textul mare are nevoie de mai puțin contrast', checkSheets([sh({ cells: { A1: 'Titlu' }, styles: { A1: { color: '#888888', sz: 20 } } })]).length === 0);
check('celula goală colorată nu contează', checkSheets([sh({ styles: { A1: { color: '#eeeeee' } } })]).length === 0);
const merged = checkSheets([sh({ cells: { A1: 'Titlu' }, merges: ['A1:C1'] })]);
check('celulele îmbinate', merged.length === 1 && merged[0].cell === 'A1' && merged[0].text.includes('A1:C1'), J(merged));
const names = checkSheets([sh({ name: 'Foaia 1', cells: { A1: 'x' } }), sh({ name: 'Date', hidden: true })]);
check('numele de la pornire și foaia ascunsă', names.length === 2 && names[0].sheet === 0 && /Foaia 1/.test(names[0].text) && names[1].sheet === 1 && /ascunsă/.test(names[1].text), J(names));
check('tabelul gol nu se plânge de nume', checkSheets([sh({ name: 'Foaia 1' })]).length === 0);
const ch = checkSheets([sh({ cells: { A1: '1' }, charts: [{ id: 'g', type: 'bar', range: 'A1:B4', title: '' }, { id: 'h', type: 'bar', range: 'C1:D4', title: 'Vânzări' }] })]);
check('graficul fără titlu', ch.length === 1 && ch[0].cell === 'A1' && /fără titlu/.test(ch[0].text), J(ch));
const ln = checkSheets([sh({ cells: { A1: 'https://exemplu.ro/o/adresa/foarte/lunga', A2: 'Pagina firmei' }, styles: { A1: { link: 'https://exemplu.ro/o/adresa/foarte/lunga' }, A2: { link: 'https://exemplu.ro' } } })]);
check('legătura care arată adresa', ln.length === 1 && ln[0].cell === 'A1', J(ln));
const many = { cells: {}, styles: {} };
for (let i = 1; i <= 300; i++) { many.cells['A' + i] = 'x'; many.styles['A' + i] = { color: '#eeeeee' }; }
const m = checkSheets([sh(many)]);
check('cel mult 200 de probleme, în ordinea rândurilor', m.length === 200 && m[0].cell === 'A1' && m[1].cell === 'A2' && m[9].cell === 'A10', m.length + ' ' + m.slice(0, 10).map((x) => x.cell).join());

console.log(fail ? `sheets-a11y: ${fail} GREȘELI` : 'sheets-a11y: toate trec');
process.exit(fail ? 1 : 0);
