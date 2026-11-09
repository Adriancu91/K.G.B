// Test: grupurile de secțiuni din Notițe („Grup / Secțiune”, redenumire, ștergere, citire din fișier).
// Rulare (în suite/): node tests/notes-section-groups.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
const out = join(tmpdir(), `suite-nsg-${process.pid}.mjs`);
await build({ entryPoints: ['src/notes/store.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const S = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const J = JSON.stringify;

check(J(S.splitSectionPath('Școală / Mate')) === J({ group: 'Școală', name: 'Mate', grouped: true }), '„Școală / Mate”: grupul și secțiunea');
check(J(S.splitSectionPath('Mate')) === J({ group: '', name: 'Mate', grouped: false }), 'fără „/”: fără grup');
check(J(S.splitSectionPath(' / Mate')) === J({ group: '', name: 'Mate', grouped: true }), '„/ Mate”: scoate din grup');

let s = S.emptyStore();
[s] = S.addSection(s, 'Casa');
[s] = S.addSection(s, 'Mate');
[s] = S.addSection(s, 'Rețete');
[s] = S.addSection(s, 'Istorie');
s = S.setSectionGroup(s, 'Mate', 'Școală');
s = S.setSectionGroup(s, 'Istorie', 'Școală');
s = S.setSectionGroup(s, 'Rețete', 'Bucătărie');
check(J(s.sectionGroups) === J({ Mate: 'Școală', Istorie: 'Școală', Rețete: 'Bucătărie' }), 'trei secțiuni în două grupuri');
const tree = S.sectionTree(s, S.sectionsOf(s));
check(J(tree) === J([{ group: '', sections: ['Casa'] }, { group: 'Școală', sections: ['Mate', 'Istorie'] }, { group: 'Bucătărie', sections: ['Rețete'] }]), 'lista pe grupuri: întâi cele libere, apoi grupurile în ordine');
check(S.sectionPath(s, 'Mate') === 'Școală / Mate' && S.sectionPath(s, 'Casa') === 'Casa', 'numele cu grupul în față, pentru redenumire');

// Redenumirea secțiunii păstrează grupul; ștergerea îl scoate.
let r = S.renameSection(s, 'Mate', 'Matematică');
check(r.sectionGroups.Matematică === 'Școală' && !('Mate' in r.sectionGroups), 'secțiunea redenumită rămâne în grup');
r = S.removeSection(s, 'Istorie');
check(!('Istorie' in r.sectionGroups) && r.sectionGroups.Mate === 'Școală', 'secțiunea ștearsă iese din grup');
r = S.setSectionGroup(s, 'Rețete', '');
check(!('Rețete' in r.sectionGroups), 'grup gol: secțiunea iese din grup');
check(S.setSectionGroup(S.setSectionGroup(S.emptyStore(), 'A', 'G'), 'A', '').sectionGroups === undefined, 'ultimul grup scos: fără câmp');

// Grupul redenumit / desfăcut.
r = S.renameGroup(s, 'Școală', 'Liceu');
check(r.sectionGroups.Mate === 'Liceu' && r.sectionGroups.Istorie === 'Liceu' && r.sectionGroups.Rețete === 'Bucătărie', 'grupul redenumit, pentru toate secțiunile lui');
r = S.renameGroup(s, 'Școală', 'bucatarie');
check(r.sectionGroups.Mate === 'Bucătărie', 'nume de grup existent (fără diacritice): grupurile se unesc');
r = S.renameGroup(s, 'Școală', '  ');
check(J(r.sectionGroups) === J({ Rețete: 'Bucătărie' }), 'nume gol: grupul se desface, secțiunile rămân');
check(S.sectionsOf(r).length === 4, 'nicio secțiune pierdută');

// Fișierul.
const back = S.parseStore(S.serializeStore(s));
check(J(back.sectionGroups) === J(s.sectionGroups), 'grupurile se salvează și se citesc');
const odd = S.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [], sections: ['A'], sectionGroups: { A: '  Grup  ', B: 'X', C: 5 } }));
check(J(odd.sectionGroups) === J({ A: 'Grup' }), 'din fișier: doar secțiunile care există și nume curate');

console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
