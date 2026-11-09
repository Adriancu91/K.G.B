// Test pentru Arhiva din Notițe: ce apare în listă, căutarea, salvarea în caiet și importul din Google Keep.
// Rulare (în suite/): node tests/notes-archive.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).replaceAll('\\', '/');
const entry = join(tmpdir(), `suite-notesarch-entry-${process.pid}.ts`);
writeFileSync(entry, `export * from '${src('src/notes/store.ts')}';\nexport { fromKeep } from '${src('src/notes/keep.ts')}';\n`);
const out = join(tmpdir(), `suite-notesarch-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const titles = (l) => l.map((n) => n.title).join(',');

const notes = [
  m.newNote({ title: 'Factura gaz', body: 'de plătit #acte', updated: '2026-10-01T00:00:00Z', archived: true }),
  m.newNote({ title: 'Cumpărături', body: 'lapte', updated: '2026-10-02T00:00:00Z' }),
  m.newNote({ title: 'Idei', body: 'vacanță #acte', updated: '2026-10-03T00:00:00Z' }),
];
check('lista obișnuită nu arată notița arhivată', titles(m.inView(notes, false, '')) === 'Idei,Cumpărături');
check('„Arhivă” arată doar notița arhivată', titles(m.inView(notes, true, '')) === 'Factura gaz');
check('căutarea o găsește și pe cea arhivată', titles(m.inView(notes, false, 'factura')) === 'Factura gaz');
check('eticheta #acte o arată și pe cea arhivată', titles(m.inView(notes, false, '', 'acte')) === 'Idei,Factura gaz');
check('căutare în Arhivă: doar arhivate', titles(m.inView(notes, true, 'lapte')) === '');

// Salvare și citire din caiet.
const s = m.parseStore(m.serializeStore({ format: 'suite-notes', version: 1, notes }));
check('„archived” se păstrează în caiet', s.notes[0].archived === true && !('archived' in s.notes[1]));
const bad = m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [{ title: 'x', archived: 'da' }] }));
check('o valoare greșită nu arhivează', !bad.notes[0].archived);

// Google Keep: notițele arhivate ajung în Arhivă (nu mai primesc #arhivat), iar fixarea nu se păstrează.
const k = m.fromKeep({ title: 'Vechi', textContent: 'ceva', isArchived: true, isPinned: true, labels: [{ name: 'Casa' }] }, 'keep:1');
check('Keep: isArchived → arhivată', k.archived === true);
check('Keep: fără eticheta #arhivat', !k.body.includes('#arhivat') && k.body.includes('#Casa'), JSON.stringify(k.body));
check('Keep: arhivată și nefixată', !k.pinned);
const k2 = m.fromKeep({ title: 'Nouă', textContent: 'x', isPinned: true }, 'keep:2');
check('Keep: notița obișnuită rămâne fixată, nearhivată', k2.pinned === true && !k2.archived);

console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
