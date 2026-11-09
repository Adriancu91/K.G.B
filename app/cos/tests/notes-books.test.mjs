// Test pentru caietele din Notițe: adăugare, redenumire (și unire), ștergere (notițele trec în caietul principal), mutare, salvare.
// Rulare (în suite/): node tests/notes-books.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-notesbooks-${process.pid}.mjs`);
await build({ entryPoints: ['src/notes/store.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const J = JSON.stringify;

let s = m.emptyStore();
check('la început: doar caietul principal', J(m.booksOf(s)) === '[""]');
let used;
[s, used] = m.addBook(s, '  Serviciu  ');
check('caiet nou, fără spații la capete', used === 'Serviciu' && J(m.booksOf(s)) === '["","Serviciu"]');
const before = s;
[s, used] = m.addBook(s, 'serviciu');
check('același nume (alte litere) nu dublează', s === before && used === 'Serviciu');
check('numele caietului principal nu se poate lua', m.addBook(s, 'caietul meu')[1] === '' && m.addBook(s, '  ')[1] === '');
[s] = m.addBook(s, 'Școală');
s = { ...s, notes: [m.newNote({ title: 'raport', book: 'Serviciu', section: 'Ședințe' }), m.newNote({ title: 'temă', book: 'Școală' }), m.newNote({ title: 'liberă', section: 'Casă' })] };
check('notițele pe caiete', m.inBook(s.notes, '').map((n) => n.title).join() === 'liberă' && m.inBook(s.notes, 'Serviciu').map((n) => n.title).join() === 'raport');
s = { ...s, sections: ['Ședințe', 'Casă', 'Goală'] };
check('secțiunile caietului (și cele goale)', J(m.sectionsIn(s, 'Serviciu')) === '["Ședințe","Goală"]' && J(m.sectionsIn(s, '')) === '["Casă","Goală"]');

// Salvare și citire.
const back = m.parseStore(m.serializeStore(s));
check('caietele se salvează', J(back.books) === '["Serviciu","Școală"]' && back.notes.find((n) => n.title === 'raport').book === 'Serviciu');
const odd = m.parseStore(J({ format: 'suite-notes', version: 1, notes: [{ title: 'x', book: 'Proiect' }, { title: 'y', book: 7 }], books: ['Caietul meu', 3, 'Alt'] }));
check('caiete stricate / lipsă din listă', J(m.booksOf(odd)) === '["","Alt","Proiect"]' && odd.notes[1].book === undefined, J(m.booksOf(odd)));

// Redenumire.
let r = m.renameBook(s, 'Serviciu', 'Birou');
check('redenumire: lista și notițele', J(m.booksOf(r)) === '["","Birou","Școală"]' && r.notes[0].book === 'Birou');
r = m.renameBook(s, 'Serviciu', 'școală');
check('redenumire peste unul existent: se unesc', J(m.booksOf(r)) === '["","Școală"]' && m.inBook(r.notes, 'Școală').length === 2);
r = m.renameBook(s, 'Serviciu', 'Caietul meu');
check('redenumire în caietul principal: notițele trec acolo', J(m.booksOf(r)) === '["","Școală"]' && m.inBook(r.notes, '').length === 2 && !('book' in r.notes[0]));
check('caietul principal nu se redenumește', m.renameBook(s, '', 'X') === s);

// Ștergere.
r = m.removeBook(s, 'Serviciu');
check('ștergere: notițele rămân, în caietul principal', J(m.booksOf(r)) === '["","Școală"]' && r.notes.length === 3 && m.inBook(r.notes, '').length === 2);
r = m.removeBook(m.removeBook(s, 'Serviciu'), 'Școală');
check('fără caiete: câmpul „books” dispare', !('books' in r) && r.notes.every((n) => !('book' in n)));

// Mutare.
r = m.moveToBook(s, new Set([s.notes[2].id]), 'Școală');
check('mutare în alt caiet', m.inBook(r.notes, 'Școală').length === 2 && m.inBook(r.notes, '').length === 0);
r = m.moveToBook(r, new Set([s.notes[2].id]), '');
check('mutare înapoi în caietul principal', !('book' in r.notes[2]));

// Culoarea caietelor.
let c = m.setBookColor(m.setBookColor(s, 'Serviciu', 'verde'), '', 'albastru');
check('culoarea se pune (și pe caietul principal)', c.bookColors?.Serviciu === 'verde' && c.bookColors?.[''] === 'albastru');
check('culoare necunoscută: se scoate', !('Serviciu' in (m.setBookColor(c, 'Serviciu', 'mov-fosforescent').bookColors ?? {})));
const cb = m.parseStore(m.serializeStore({ ...c, bookColors: { ...c.bookColors, Lipsă: 'verde', Școală: 'xx' } }));
check('culorile se salvează (fără caiete lipsă sau culori greșite)', JSON.stringify(cb.bookColors) === JSON.stringify({ Serviciu: 'verde', '': 'albastru' }), JSON.stringify(cb.bookColors));
r = m.renameBook(c, 'Serviciu', 'Birou');
check('redenumirea ia culoarea cu ea', r.bookColors?.Birou === 'verde' && !('Serviciu' in r.bookColors));
r = m.removeBook(c, 'Serviciu');
check('ștergerea scoate culoarea', !('Serviciu' in (r.bookColors ?? {})) && r.bookColors?.[''] === 'albastru');
check('fără culori: câmpul dispare', !('bookColors' in m.setBookColor(m.setBookColor(c, 'Serviciu', undefined), '', undefined)));

console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
