// Test pentru secțiunile din Notițe: adăugare, redenumire (și unire), ștergere, salvare în caiet.
// Rulare (în suite/): node tests/notes-sections.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-notessec-${process.pid}.mjs`);
await build({ entryPoints: ['src/notes/store.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

let s = m.emptyStore();
let used;
[s, used] = m.addSection(s, '  Serviciu  ');
check('secțiune nouă, fără spații la capete', used === 'Serviciu' && JSON.stringify(m.sectionsOf(s)) === '["Serviciu"]');
const before = s;
[s, used] = m.addSection(s, 'serviciu');
check('același nume (alte litere) nu dublează', s === before && used === 'Serviciu');
[s] = m.addSection(s, 'Casă');
check('nume gol → nimic', m.addSection(s, '   ')[1] === '');
s = { ...s, notes: [m.newNote({ title: 'raport', section: 'Serviciu' }), m.newNote({ title: 'chirie', section: 'Casă' }), m.newNote({ title: 'liberă' })] };

// Redenumire.
let r = m.renameSection(s, 'Serviciu', 'Birou');
check('redenumire: lista și notițele', JSON.stringify(m.sectionsOf(r)) === '["Birou","Casă"]' && r.notes[0].section === 'Birou');
// Redenumire spre un nume existent: se unesc.
r = m.renameSection(s, 'Serviciu', 'casă');
check('redenumire spre un nume existent: secțiunile se unesc', JSON.stringify(m.sectionsOf(r)) === '["Casă"]' && r.notes[0].section === 'Casă' && r.notes[1].section === 'Casă', JSON.stringify(m.sectionsOf(r)));

// Ștergere: notițele rămân, fără secțiune.
r = m.removeSection(s, 'Casă');
check('ștergere: secțiunea dispare', JSON.stringify(m.sectionsOf(r)) === '["Serviciu"]');
check('ștergere: notița rămâne în caiet, fără secțiune', r.notes.length === 3 && !('section' in r.notes[1]));

// Salvare și citire.
const back = m.parseStore(m.serializeStore(s));
check('secțiunile se păstrează în caiet (și cea goală, în ordine)', JSON.stringify(back.sections) === '["Serviciu","Casă"]' && back.notes[0].section === 'Serviciu' && !back.notes[2].section);
const odd = m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, sections: [5, '  A  ', ''], notes: [{ title: 'x', section: 'B' }, { title: 'y', section: 7 }] }));
check('valori ciudate în fișier: curățate; secțiunea folosită de o notiță apare și ea', JSON.stringify(odd.sections) === '["A","B"]' && odd.notes[0].section === 'B' && !odd.notes[1].section, JSON.stringify(odd.sections));
const old = m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [{ title: 'x' }] }));
check('caiet vechi (fără secțiuni): merge ca înainte', !('sections' in old) && !old.notes[0].section);

// Culorile secțiunilor.
let c = m.setSectionColor(s, 'Serviciu', 'verde');
check('culoare: se pune', c.sectionColors?.Serviciu === 'verde');
check('culoare: o cheie necunoscută nu se pune', !m.setSectionColor(s, 'Casă', 'turcoaz').sectionColors);
check('culoare: redenumirea o mută', m.renameSection(c, 'Serviciu', 'Birou').sectionColors?.Birou === 'verde' && !('Serviciu' in (m.renameSection(c, 'Serviciu', 'Birou').sectionColors ?? {})));
check('culoare: ștergerea secțiunii o scoate', !m.removeSection(c, 'Serviciu').sectionColors);
check('culoare: „fără culoare” o scoate', !m.setSectionColor(c, 'Serviciu', undefined).sectionColors);
const cb = m.parseStore(m.serializeStore(c));
check('culoare: se păstrează în caiet', cb.sectionColors?.Serviciu === 'verde');
const cbad = m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, sections: ['A'], sectionColors: { A: 'mov', B: 'rosu', C: 5 }, notes: [] }));
check('culoare: din fișier se păstrează doar cele valide', JSON.stringify(cbad.sectionColors) === '{"A":"mov"}', JSON.stringify(cbad.sectionColors));

console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
