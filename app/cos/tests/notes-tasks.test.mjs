// Test pentru „Export sarcini (.ics)” din Notițe (src/notes/tasks.ts): rândurile ☐ / ☑ devin VTODO, sub-elementele legate de
// sarcina de deasupra, cele bifate terminate, mementoul ca termen, semnele de format scoase, caracterele speciale scăpate,
// rândurile lungi rupte la 75 de octeți fără să taie o literă, și notița fără rânduri de bifat.
// Rulare (în suite/): node tests/notes-tasks.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-tasks-${process.pid}.mjs`);
await build({ entryPoints: [join(process.cwd(), 'src/notes/tasks.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { noteTasks, noteTasksIcs, foldLine, parseIcsTasks, applyIcsTasks } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
const B = String.fromCharCode(92);
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

const body = ['Lista mea', '☐ Cumpără **pâine**, lapte; ouă', '    ☑ Pâine', '    ☐ Lapte', '☑ Sună la bancă', 'text obișnuit', '☐ ', '• bulină'].join('\n');
const t = noteTasks(body);
ok(t.length === 4, 'patru sarcini (rândul gol și bulina sărite)');
ok(t[0].text === 'Cumpără pâine, lapte; ouă' && !t[0].done, 'semnele de format scoase');
ok(t[1].parent === 0 && t[2].parent === 0 && t[3].parent === null, 'sub-elementele legate de sarcina de deasupra');
ok(t[1].done && t[3].done, 'cele bifate sunt terminate');

const now = new Date(Date.UTC(2026, 9, 28, 6, 0, 0));
const note = { id: 'n1', title: 'Cumpărături', body, created: '', updated: '', remind: '2026-10-29T09:30:00.000Z' };
const ics = noteTasksIcs(note, now);
const lines = ics.split('\r\n');
ok(lines[0] === 'BEGIN:VCALENDAR' && ics.endsWith('END:VCALENDAR\r\n'), 'calendar întreg, rânduri CRLF');
ok((ics.match(/BEGIN:VTODO/g) ?? []).length === 4, '4 VTODO');
ok(ics.includes('SUMMARY:Cumpără pâine'+B+', lapte'+B+'; ouă'), 'virgula și punctul și virgula scăpate');
ok(ics.includes('RELATED-TO;RELTYPE=PARENT:n1-1@suite-notite'), 'RELATED-TO la sub-elemente');
ok((ics.match(/DUE:20261029T093000Z/g) ?? []).length === 2, 'termenul doar la cele nebifate');
ok((ics.match(/STATUS:COMPLETED/g) ?? []).length === 2 && ics.includes('DTSTAMP:20261028T060000Z'), 'cele bifate COMPLETED, DTSTAMP');
ok(ics.includes('DESCRIPTION:Din notița „Cumpărături”'), 'descrierea cu titlul notiței');
ok(noteTasksIcs({ ...note, body: 'fără liste' }, now) === null, 'fără rânduri de bifat: nimic');

const long = 'SUMMARY:' + 'ăș'.repeat(60);
const folded = foldLine(long);
const enc = new TextEncoder();
ok(folded.split('\r\n').every((l) => enc.encode(l).length <= 75), 'rânduri de cel mult 75 de octeți');
ok(folded.split('\r\n ').join('') === long, 'rândul rupt se lipește înapoi exact');

// Legătura înapoi: fișierul exportat, cu sarcinile bifate / debifate „în calendar”, adus înapoi în notiță.
const back = ics.replace('STATUS:NEEDS-ACTION', 'STATUS:COMPLETED')
  .replace(/(UID:n1-2@suite-notite[\s\S]*?)STATUS:COMPLETED\r\nPERCENT-COMPLETE:100/, '$1STATUS:NEEDS-ACTION\r\nPERCENT-COMPLETE:0');
const parsed = parseIcsTasks(back);
ok(parsed.length === 4 && parsed[0].done && !parsed[1].done && parsed[0].summary === 'Cumpără pâine, lapte; ouă', 'citirea .ics: textul fără caracterele scăpate, starea schimbată');
const r1 = applyIcsTasks(body, 'n1', parsed);
const nb = r1.body.split('\n');
ok(nb[1].startsWith('☑ Cumpără') && nb[2] === '    ☐ Pâine' && nb[3] === '    ☐ Lapte' && nb[4].startsWith('☑ Sună'), 'rândurile bifate / debifate ca în calendar, cu spațiile păstrate');
ok(r1.checked === 1 && r1.unchecked === 1 && r1.matched === 4, 'numărătoarea: 1 bifată, 1 redeschisă, 4 găsite');
// Rândurile mutate între timp: se găsesc după text.
const moved = ['☐ Rând nou', body].join('\n');
const r2 = applyIcsTasks(moved, 'n1', parsed);
ok(r2.body.split('\n')[0] === '☐ Rând nou' && r2.body.split('\n')[2].startsWith('☑ Cumpără') && r2.matched === 4, 'rândurile mutate se găsesc după text');
const r3 = applyIcsTasks(body, 'alta', parsed);
ok(r3.matched === 0 && r3.others === 4 && r3.body === body, 'sarcinile altei notițe nu se ating');
ok(parseIcsTasks('BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:x\r\nSUMMARY:Lung\r\n  rupt\r\nPERCENT-COMPLETE:100\r\nEND:VTODO\r\nEND:VCALENDAR')[0].done === true
  && parseIcsTasks('BEGIN:VTODO\nUID:x\nSUMMARY:Lung\n  rupt\nEND:VTODO')[0].summary === 'Lung rupt', 'rânduri rupte lipite, 100% = terminată');

console.log(fail ? `\n${fail} GREȘITE` : '\nTOATE OK');
process.exit(fail ? 1 : 0);
