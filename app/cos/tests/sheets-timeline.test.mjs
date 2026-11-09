// Test: cronologia din Sheets (Timeline): datele din coloană, perioadele pe ani / trimestre / luni / zile, numele perioadei
// alese, nivelul potrivit și păstrarea în fișierul .ssheet.
// Rulare (în suite/): node tests/sheets-timeline.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-tl-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-tl-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/sheets/timeline.ts')};\nexport { dateToSerial } from ${src('src/sheets/numfmt.ts')};\nexport { parseSheetDoc as parseSheet } from ${src('src/sheets/format.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const M = await import(pathToFileURL(out).href);
rmSync(entry, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const d = (s) => M.dateToSerial(s);

// Celulele: dată (format de dată), dată cu cod propriu, număr obișnuit, text, formulă cu rezultat de dată.
check(M.cellSerial(String(d('15.03.2026')), undefined, { fmt: 'date' }) === d('15.03.2026'), 'dată cu formatul de dată');
check(M.cellSerial(String(d('15.03.2026')), undefined, { code: 'dd mmm yyyy' }) === d('15.03.2026'), 'dată cu cod propriu');
check(M.cellSerial('46000', undefined, undefined) === null, 'număr fără format de dată: nu e dată');
check(M.cellSerial('Cluj', undefined, { fmt: 'date' }) === null, 'text: nu e dată');
check(M.cellSerial('46000', undefined, { code: '#,##0 "lei"' }) === null, 'cod de bani: nu e dată');
check(M.cellSerial('=A1+1', { value: 46001.5, num: true, text: '' }, { fmt: 'datetime' }) === 46001, 'formulă cu dată și oră: ziua');

const cells = {}, styles = {};
const dates = ['15.01.2026', '20.01.2026', '03.03.2026', '30.04.2026', '01.07.2026', '31.12.2026', '02.01.2027'];
dates.forEach((t, i) => { cells['A' + (i + 2)] = String(d(t)); styles['A' + (i + 2)] = { fmt: 'date' }; });
cells.A1 = 'Data';
const ser = M.columnSerials(cells, {}, styles, 0, 1, 7);
check(ser.length === 7, 'columnSerials: 7 date');
check(M.columnSerials(cells, {}, styles, 0, 1, 7, new Set([1, 2])).length === 5, 'columnSerials: rândurile ascunse lipsesc');

const months = M.periods(ser, 'm');
check(months.length === 13, 'luni: ian. 2026 … ian. 2027 = 13 (cu cele goale), ' + months.length);
check(months[0].label === 'ian.' && months[0].group === '2026' && months[0].count === 2, 'prima lună: ian. 2026 cu 2 rânduri');
check(months[1].count === 0 && months[2].count === 1, 'feb. goală, mar. cu 1');
check(months[12].label === 'ian.' && months[12].group === '2027' && months[12].count === 1, 'ultima: ian. 2027');
check(months.reduce((a, p) => a + p.count, 0) === 7, 'toate rândurile numărate o dată');
check(months[1].from === d('01.02.2026') && months[1].to === d('28.02.2026'), 'februarie: 1–28');
const q = M.periods(ser, 'q');
check(q.length === 5 && q.map((p) => p.label).join(',') === 'T1,T2,T3,T4,T1' && q[0].count === 3, 'trimestre: ' + q.map((p) => p.label + p.count).join(','));
const y = M.periods(ser, 'y');
check(y.length === 2 && y[0].label === '2026' && y[0].count === 6 && y[1].count === 1, 'ani: 2026 (6), 2027 (1)');
const days = M.periods(ser, 'd');
check(days.length === d('02.01.2027') - d('15.01.2026') + 1 && days[0].label === '15' && days[0].group === 'ian. 2026', 'zile: una după alta');
check(M.periods([d('01.01.2000'), d('01.01.2026')], 'd') === null, 'zile pe 26 de ani: prea multe');
check(M.periods([], 'm').length === 0, 'fără date: nicio perioadă');
check(M.periods([d('10.05.2026')], 'm', [d('01.01.2026')]).length === 5, 'perioada aleasă rămâne în listă (keep)');

check(M.rangeLabel(d('01.03.2026'), d('30.06.2026'), 'm') === 'mar. 2026 – iun. 2026', 'numele: ' + M.rangeLabel(d('01.03.2026'), d('30.06.2026'), 'm'));
check(M.rangeLabel(d('01.04.2026'), d('30.06.2026'), 'q') === 'T2 2026', 'numele unui trimestru');
check(M.rangeLabel(d('01.01.2025'), d('31.12.2026'), 'y') === '2025 – 2026', 'numele anilor');
check(M.rangeLabel(d('05.03.2026'), d('05.03.2026'), 'd') === '5 mar. 2026', 'numele unei zile');

check(M.bestLevel(ser) === 'm', 'nivelul potrivit: luni');
check(M.bestLevel([d('01.01.2010'), d('01.01.2026')]) === 'y', 'pe mulți ani: ani');
check(M.bestLevel([d('01.05.2026'), d('20.05.2026')]) === 'd', 'o singură lună: zile');

// Fișierul .ssheet: cronologiile se păstrează, cele greșite se scot.
const doc = M.parseSheet(JSON.stringify({ format: 'suite-sheet', version: 1, title: 't', updatedAt: '', sheets: [{ name: 'F', cells, timelines: [{ col: 'A', level: 'q' }, { col: 'A', level: 'm' }, { col: 'b', level: 'm' }, { col: 'C', level: 'x' }, 5] }] }));
const tl = doc.sheets[0].timelines;
check(JSON.stringify(tl) === JSON.stringify([{ col: 'A', level: 'q' }, { col: 'C', level: 'm' }]), 'citire .ssheet: ' + JSON.stringify(tl));

rmSync(out, { force: true });
console.log(bad ? `${bad} GRESITE` : 'TOATE BUNE');
process.exit(bad ? 1 : 0);
