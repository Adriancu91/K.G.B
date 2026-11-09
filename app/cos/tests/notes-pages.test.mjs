// Test pentru paginile și subpaginile din Notițe (src/notes/pages.ts): ordinea în listă, nivelurile, „Fă subpagină”, „Urcă un nivel”.
// Rulare (în suite/): node tests/notes-pages.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).split(String.fromCharCode(92)).join('/');
const entry = join(tmpdir(), `suite-notespages-entry-${process.pid}.ts`);
writeFileSync(entry, `export * from '${src('src/notes/pages.ts')}';` + String.fromCharCode(10) + `export { parseStore } from '${src('src/notes/store.ts')}';`);
const out = join(tmpdir(), `suite-notespages-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

let bad = 0;
const check = (name, ok, got) => { console.log((ok ? 'OK   ' : 'GREȘIT ') + name + (ok ? '' : '  →  ' + got)); if (!ok) bad++; };
const N = (id, parent) => ({ id, title: id, body: '', created: '', updated: '', ...(parent ? { parent } : {}) });
const show = (sh) => sh.map((x) => '-'.repeat(x.depth) + x.note.id).join(' ');

// Lista vine în ordinea de sortare; subpaginile urcă sub pagina lor.
const list = [N('c', 'a'), N('a'), N('b'), N('d', 'c'), N('e', 'a')];
const sh = m.nestNotes(list);
check('subpaginile stau sub pagina lor, pe niveluri', show(sh) === 'a -c --d -e b', show(sh));
check('numărul de subpagini directe', sh.find((x) => x.note.id === 'a').kids === 2, JSON.stringify(sh.map((x) => x.kids)));
check('pagina de sus lipsă (alt filtru): subpagina apare singură', show(m.nestNotes([N('c', 'a'), N('b')])) === 'c b', show(m.nestNotes([N('c', 'a'), N('b')])));
check('un cerc stricat nu ascunde notițe', m.nestNotes([N('x', 'y'), N('y', 'x')]).length === 2, show(m.nestNotes([N('x', 'y'), N('y', 'x')])));

// „Fă subpagină”: sub cea de deasupra de pe același nivel.
const t1 = m.indentTarget(sh, list, 'b');
check('b devine subpagină a lui a (sare peste subpaginile lui a)', t1.parent === 'a', JSON.stringify(t1));
const t2 = m.indentTarget(sh, list, 'e');
check('e devine subpagină a lui c', t2.parent === 'c', JSON.stringify(t2));
const t3 = m.indentTarget(sh, list, 'a');
check('prima notiță nu are deasupra nicio pagină', 'error' in t3, JSON.stringify(t3));
const l2 = [N('a'), N('b'), N('f', 'b'), N('g', 'f')];
const t4 = m.indentTarget(m.nestNotes(l2), l2, 'b');
check('b are două niveluri sub ea: nu poate coborî (ar fi nivelul 3)', 'error' in t4 && t4.error.includes('2 niveluri'), JSON.stringify(t4));

// „Urcă un nivel”.
check('d urcă sub a', m.outdentParent(list, 'd') === 'a', String(m.outdentParent(list, 'd')));
check('c urcă la nivelul de sus', m.outdentParent(list, 'c') === undefined, String(m.outdentParent(list, 'c')));
check('a e deja sus', m.outdentParent(list, 'a') === null, String(m.outdentParent(list, 'a')));

// Câmpul se păstrează la citirea caietului; unul greșit (spre ea însăși) se scoate.
const st = m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [N('a'), N('b', 'a'), N('z', 'z')] }));
check('caietul păstrează „parent”', st.notes[1].parent === 'a' && !('parent' in st.notes[2]), JSON.stringify(st.notes));

console.log(bad ? `${bad} verificări greșite` : 'Toate verificările au trecut.');
process.exit(bad ? 1 : 0);
