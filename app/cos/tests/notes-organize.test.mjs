// Test pentru organizarea notițelor: copie (duplicare), sortare, etichete.
// Rulare (în suite/): node tests/notes-organize.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).replaceAll('\\', '/');
const entry = join(tmpdir(), `suite-notesorg-entry-${process.pid}.ts`);
writeFileSync(entry, `export * from '${src('src/notes/store.ts')}';\nexport { fromKeep } from '${src('src/notes/keep.ts')}';\n`);
const out = join(tmpdir(), `suite-notesorg-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

let fail = 0;
const J = (...a) => a.join(String.fromCharCode(10));
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const a = m.newNote({ title: 'Rețetă', body: 'făină #bucătărie', section: 'Casă', color: 'verde', images: ['data:x'], imageText: ['ok'], remind: '2026-10-20T08:00:00Z', source: 'C:/x.snote', pinned: true });
const c = m.duplicateNote(a);
check('copie: id nou', c.id !== a.id);
check('copie: titlul cu „(copie)”', c.title === 'Rețetă (copie)', c.title);
check('copie: textul, secțiunea, culoarea, pozele rămân', c.body === a.body && c.section === 'Casă' && c.color === 'verde' && c.images[0] === 'data:x' && c.imageText[0] === 'ok');
check('copie: fără memento și fără fișierul sursă', !c.remind && !c.source);
c.images.push('y');
check('copie: pozele nu sunt aceeași listă cu originalul', a.images.length === 1);
check('copie fără titlu rămâne fără titlu', m.duplicateNote(m.newNote({ body: 'x' })).title === '');

// Sortarea.
const L = [m.newNote({ title: 'zebră', created: '2026-01-03', updated: '2026-01-04' }), m.newNote({ title: 'Ăla', created: '2026-01-01', updated: '2026-01-06' }),
  m.newNote({ title: 'ac', created: '2026-01-05', updated: '2026-01-02' }), m.newNote({ title: 'Fixată', created: '2026-01-02', updated: '2026-01-01', pinned: true }), m.newNote({ body: 'Banane' + String.fromCharCode(10) + 'x', created: '2026-01-04', updated: '2026-01-03' })];
const T = (l) => l.map((n) => m.shownTitle(n)).join(',');
check('sortare: după modificare (ca până acum)', T(m.sortNotes(m.search(L, ''), 'updated')) === 'Fixată,Ăla,zebră,Banane,ac', T(m.sortNotes(m.search(L, ''), 'updated')));
check('sortare: după creare', T(m.sortNotes(L, 'created')) === 'Fixată,ac,Banane,zebră,Ăla', T(m.sortNotes(L, 'created')));
check('sortare: după titlu, ca în română (ă după a, fără majuscule)', T(m.sortNotes(L, 'title')) === 'Fixată,ac,Ăla,Banane,zebră', T(m.sortNotes(L, 'title')));

// Etichetele: redenumire și scoatere.
let st = { format: 'suite-notes', version: 1, notes: [m.newNote({ title: 'Acte #Ședință', body: 'de citit #ședință, apoi #acte și #sedinta2 (#ședință)', updated: '2026-01-01' }), m.newNote({ title: 'x', body: 'fără' }), m.newNote({ title: 'Blocată #sedinta', body: '', secret: { a: 1 } })] };
let r = m.retag(st, 'sedinta', 'Întâlnire lunară');
check('redenumire: în titlu și text, toate scrierile', r.notes[0].title === 'Acte #Întâlnire-lunară' && r.notes[0].body === 'de citit #Întâlnire-lunară, apoi #acte și #sedinta2 (#Întâlnire-lunară)', JSON.stringify(r.notes[0]));
check('redenumire: notița blocată doar în titlu', r.notes[2].title === 'Blocată #Întâlnire-lunară');
check('redenumire: data nu se schimbă, notițele neatinse rămân aceleași', r.notes[0].updated === '2026-01-01' && r.notes[1] === st.notes[1]);
check('redenumire: eticheta veche dispare, cea nouă apare', !m.allTags(r.notes).some(([t]) => t === 'sedinta') && m.allTags(r.notes).some(([t, c]) => t === 'intalnire-lunara' && c === 2), JSON.stringify(m.allTags(r.notes)));
r = m.retag(st, 'sedinta', '');
check('scoatere: cuvântul rămâne fără #', r.notes[0].body === 'de citit ședință, apoi #acte și #sedinta2 (ședință)' && r.notes[0].title === 'Acte Ședință', JSON.stringify(r.notes[0]));
check('nume fără litere: nu se schimbă nimic', m.retag(st, 'sedinta', '###') === st);
check('etichetă inexistentă: același caiet', m.retag(st, 'nimic', 'x') === st);
check('cleanTag', m.cleanTag(' #Rețete de post! ') === 'Rețete-de-post', m.cleanTag(' #Rețete de post! '));

// Coșul de gunoi.
let k = { format: 'suite-notes', version: 1, notes: [m.newNote({ id: 'a', title: 'Unu', section: 'Casă' }), m.newNote({ id: 'b', title: 'Doi' })] };
k = m.trashNote(k, 'a', new Date('2026-10-19T10:00:00Z'));
check('coș: notița iese din caiet și intră în coș', k.notes.length === 1 && k.trash.length === 1 && k.trash[0].deleted === '2026-10-19T10:00:00.000Z');
const kb = m.parseStore(m.serializeStore(k));
check('coș: se păstrează în caiet (fișier)', kb.trash?.length === 1 && kb.trash[0].title === 'Unu' && kb.trash[0].section === 'Casă');
const kr = m.restoreNote(k, 'a');
check('coș: Readu o pune înapoi, fără data ștergerii, coșul gol dispare', kr.notes.length === 2 && !kr.notes[1].deleted && !('trash' in kr));
check('coș: Șterge definitiv', !('trash' in m.purgeNote(k, 'a')) && m.purgeNote(m.trashNote(k, 'b'), 'a').trash.length === 1);
check('coș: Golește coșul', !('trash' in m.purgeNote(m.trashNote(k, 'b'))));
check('coș: după 30 de zile se golește singur', m.purgeTrash(k.trash, new Date('2026-11-17T09:00:00Z')).length === 1 && m.purgeTrash(k.trash, new Date('2026-11-19T11:00:00Z')).length === 0);
check('coș: notițele din coș nu apar la căutare și etichete', m.search(k.notes, 'unu').length === 0);

// Mementourile care se repetă (ora locală).
const loc = (y, mo, d, h = 9, mi = 0) => new Date(y, mo - 1, d, h, mi);
const D = (x) => x ? x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate() + ' ' + x.getHours() + ':' + x.getMinutes() : null;
const r0 = loc(2026, 1, 31).toISOString();
check('lunar din 31: februarie are 28', D(m.occurrence(r0, 'lunar', 1)) === '2026-2-28 9:0' && D(m.occurrence(r0, 'lunar', 2)) === '2026-3-31 9:0');
check('anual din 29 februarie', D(m.occurrence(loc(2028, 2, 29).toISOString(), 'anual', 1)) === '2029-2-28 9:0');
let rt = m.remindTimes({ remind: loc(2026, 10, 1).toISOString(), repeat: 'zilnic' }, loc(2026, 10, 19, 10));
check('zilnic: ultima azi la 9, următoarea mâine la 9', D(rt.last) === '2026-10-19 9:0' && D(rt.next) === '2026-10-20 9:0', JSON.stringify([D(rt.last), D(rt.next)]));
rt = m.remindTimes({ remind: loc(2026, 10, 5).toISOString(), repeat: 'saptamanal' }, loc(2026, 10, 19, 8));
check('săptămânal: luni 5 → luni 19 (încă nu a venit)', D(rt.last) === '2026-10-12 9:0' && D(rt.next) === '2026-10-19 9:0', JSON.stringify([D(rt.last), D(rt.next)]));
rt = m.remindTimes({ remind: loc(2020, 3, 15).toISOString(), repeat: 'lunar' }, loc(2026, 10, 19));
check('lunar de ani de zile: următoarea pe 15 noiembrie', D(rt.next) === '2026-11-15 9:0' && D(rt.last) === '2026-10-15 9:0');
rt = m.remindTimes({ remind: loc(2026, 12, 1).toISOString(), repeat: 'zilnic' }, loc(2026, 10, 19));
check('în viitor: următoarea e chiar data aleasă', D(rt.next) === '2026-12-1 9:0' && rt.last === null);
const dn = [m.newNote({ title: 'zi', remind: loc(2026, 10, 1).toISOString(), repeat: 'zilnic' }), m.newNote({ title: 'sapt', remind: loc(2026, 10, 6).toISOString(), repeat: 'saptamanal' }), m.newNote({ title: 'trecut', remind: loc(2026, 10, 2).toISOString() })];
check('Azi: cea zilnică da, cea de marți nu (azi e luni), cea trecută fără repetare da', m.dueToday(dn, loc(2026, 10, 19, 12)).map((n) => n.title).join(',') === 'trecut,zi', m.dueToday(dn, loc(2026, 10, 19, 12)).map((n) => n.title).join(','));
check('repetarea se păstrează în caiet; fără memento se pierde', m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [dn[0], { title: 'x', repeat: 'zilnic' }, { title: 'y', remind: dn[0].remind, repeat: 'orar' }] })).notes.map((n) => n.repeat ?? '-').join(',') === 'zilnic,-,-');
check('copia nu ia repetarea', !m.duplicateNote(dn[0]).repeat);

// Filtrul după tip și culoare.
const F = [m.newNote({ title: 'a', body: '☐ lapte' }), m.newNote({ title: 'b', body: 'x', images: ['data:i'], color: 'verde' }), m.newNote({ title: 'c', body: 'vezi www.anaf.ro', files: [{ id: 'f', name: 'x.pdf', size: 1 }] }), m.newNote({ title: 'd', remind: '2026-10-20T06:00:00Z', secret: { a: 1 } })];
const K = (k) => F.filter((n) => m.matchesKind(n, k)).map((n) => n.title).join('');
check('filtru: tipuri', K('') === 'abcd' && K('bifat') === 'a' && K('poze') === 'b' && K('pdf') === 'c' && K('memento') === 'd' && K('legaturi') === 'c' && K('blocate') === 'd', ['bifat', 'poze', 'pdf', 'memento', 'legaturi', 'blocate'].map(K).join(','));
check('filtru: culoare', K('culoare:verde') === 'b' && K('culoare:rosu') === '');

const R = [m.newNote({ title: 'azi', updated: loc(2026, 10, 19, 8).toISOString() }), m.newNote({ title: 'ieri', updated: loc(2026, 10, 18, 23).toISOString() }), m.newNote({ title: 'acum6', updated: loc(2026, 10, 13, 0, 1).toISOString() }), m.newNote({ title: 'acum8', updated: loc(2026, 10, 11).toISOString() }), m.newNote({ title: 'vechi', updated: loc(2026, 8, 1).toISOString() })];
const RK = (k) => R.filter((n) => m.matchesKind(n, k, loc(2026, 10, 19, 12))).map((n) => n.title).join(',');
check('modificări recente: azi / 7 zile / 30 de zile', RK('azi') === 'azi' && RK('7zile') === 'azi,ieri,acum6' && RK('30zile') === 'azi,ieri,acum6,acum8', [RK('azi'), RK('7zile'), RK('30zile')].join(' | '));

// Găsește în notiță.
const txt = 'Ședința de luni: ședinta, SEDINȚA și altceva';
const fa = m.findAll(txt, 'sedinta');
check('găsește în notiță: fără diacritice și litere mari, de 3 ori', fa.length === 3 && fa.every(([a, b]) => m.plain(txt.slice(a, b)) === 'sedinta'), JSON.stringify(fa));
check('găsește: căutare goală', m.findAll(txt, '  ').length === 0);

// Rezumatul etichetelor.
const TS = [m.newNote({ id: 'x', title: 'Proiect #client', body: J('☐ ofertă #urgent', '    ☐ preț', '☑ gata #urgent', 'altceva') }), m.newNote({ id: 'y', title: 'Casă', body: 'zugrăvit #urgent' }), m.newNote({ id: 'z', title: 'Vechi', body: '☐ nimic #urgent', archived: true })];
const sum = m.tagSummary(TS);
const SG = sum.map((g) => g.name + ':' + g.lines.map((l) => l.line).join('/')).join(' | ');
check('rezumat: De făcut, apoi etichetele, fără arhivate', SG === 'Ă De făcut:ofertă #urgent/preț | #urgent:☐ ofertă #urgent/☑ gata #urgent/zugrăvit #urgent | #client:Proiect #client'.replace('Ă', '☐'), SG);
check('rezumat: fiecare rând știe notița', sum[1].lines[2].id === 'y' && sum[1].lines[2].title === 'Casă');

const TM = m.tagSummary([m.newNote({ id: 'q', title: 'Q', body: J('⭐ contractul', '❓ cine plătește?', 'text') })]);
check('rezumat: semnele pe rând au grupul lor', TM.map((g) => g.name + ':' + g.lines.map((l) => l.line).join('/')).join(' | ') === '⭐ Important:contractul | ❓ Întrebare:cine plătește?', JSON.stringify(TM));

// K.G.B.: partea de mai jos compară cu fișierul Electron al COS (electron/main.cjs), care în K.G.B. nu există;
// memento-urile notelor se socotesc în nucleul K.G.B. și se testează acolo. Rulează doar dacă fișierul e de față.
if ((await import('node:fs')).existsSync('electron/main.cjs')) {
// Electron (main.cjs) socotește la fel următoarea notificare.
const mainSrc = (await import('node:fs')).readFileSync('electron/main.cjs', 'utf8');
const fnSrc = mainSrc.slice(mainSrc.indexOf('function nextReminder'), mainSrc.indexOf('function scheduleReminders'));
const nextReminder = new Function(fnSrc + '; return nextReminder;')();
const cases = [[loc(2020, 3, 15), 'lunar'], [loc(2026, 10, 1), 'zilnic'], [loc(2026, 10, 5), 'saptamanal'], [loc(2024, 2, 29), 'anual'], [loc(2026, 1, 31), 'lunar'], [loc(2026, 12, 1), 'zilnic'], [loc(2026, 10, 1), undefined]];
const nowT = loc(2026, 10, 19, 10);
check('main.cjs: aceeași următoare notificare ca în Notițe', cases.every(([d, r]) => { const n = { remind: d.toISOString(), repeat: r }; const a = nextReminder(n, nowT.getTime()); const b = r ? m.remindTimes(n, nowT).next.getTime() : d.getTime(); return a === b; }));
}

// Mărimea pozelor: se păstrează la salvare doar „s” sau „l” și doar dacă notița are poze.
const sz = (n) => m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [n] })).notes[0].imageSize;
check('mărimea pozelor: mici se păstrează', sz({ title: 'a', body: '', images: ['data:image/png;base64,AA'], imageSize: 's' }) === 's');
check('mărimea pozelor: valoare greșită se ignoră', sz({ title: 'a', body: '', images: ['data:image/png;base64,AA'], imageSize: 'xl' }) === undefined);
check('mărimea pozelor: fără poze nu se păstrează', sz({ title: 'a', body: '', imageSize: 'l' }) === undefined);

// Foaia notiței (linii / pătrățele): se păstrează doar valorile cunoscute.
const pp = (paper) => m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [{ title: 'a', body: '', paper }] })).notes[0].paper;
check('foaia: cu linii și cu pătrățele se păstrează', pp('lines') === 'lines' && pp('grid') === 'grid');
check('foaia: valoare necunoscută se ignoră', pp('dots') === undefined && pp(undefined) === undefined);

// Fundalul ilustrat: se păstrează doar cheile cunoscute.
const bgOf = (bg) => m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [{ title: 'a', body: '', bg }] })).notes[0].bg;
check('fundal: cheie cunoscută se păstrează', bgOf('muzica') === 'muzica');
check('fundal: cheie necunoscută se ignoră', bgOf('url(x)') === undefined && bgOf(5) === undefined);

// Ordinea mea: tragerea mută notița în locul celei peste care cade; cele fixate rămân sus; cele noi apar deasupra.
{
  const mk = (title, updated, extra = {}) => ({ ...m.newNote({ title, ...extra }), updated });
  let N = [mk('A', '2026-01-04'), mk('B', '2026-01-03'), mk('C', '2026-01-02'), mk('D', '2026-01-01')];
  const O = () => m.sortNotes(N, 'manual').map((n) => n.title).join('');
  check('ordinea mea: fără mutări, după modificare', O() === 'ABCD', O());
  const id = (t) => N.find((n) => n.title === t).id;
  N = m.moveNote(N, id('D'), id('B'));
  check('ordinea mea: D tras peste B ajunge al doilea', O() === 'ADBC', O());
  N = m.moveNote(N, id('A'), id('C'));
  check('ordinea mea: A tras în jos peste C', O() === 'DBCA', O());
  N = [...N, mk('Nouă', '2026-01-05')];
  check('ordinea mea: notița nouă apare sus', O() === 'NouăDBCA', O());
  N = N.map((n) => (n.title === 'C' ? { ...n, pinned: true } : n));
  check('ordinea mea: cea fixată rămâne prima', O().startsWith('C'), O());
  check('ordinea mea: locul se păstrează la salvare', m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: N })).notes.find((n) => n.title === 'A').pos === N.find((n) => n.title === 'A').pos);
  check('ordinea mea: tras peste el însuși nu schimbă nimic', m.moveNote(N, id('B'), id('B')) === N);
}

console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
