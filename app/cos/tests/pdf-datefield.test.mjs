// Test: câmpurile de formular noi din PDF (▭ Câmp de completat → Tipul câmpului): „📅 Dată” (text cu formatul zz.ll.aaaa)
// și butoanele radio (așezarea lor).
// Rulare (în suite/): node tests/pdf-datefield.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { PDFDocument, PDFName, PDFTextField } from 'pdf-lib';

const out = join(tmpdir(), `suite-datefield-${process.pid}.mjs`);
await build({ entryPoints: ['src/pdf/sign.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
// Câmpurile nu se desenează pe pânză; stampMarks face totuși una la început.
globalThis.document ??= { createElement: () => ({}) };
const { stampMarks, radioLayout, fieldOptions } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };

const d = await PDFDocument.create();
d.addPage([595, 842]);
const src = await d.save();
const marks = [
  { id: 1, page: 1, x: 100, y: 100, w: 120, h: 20, kind: 'field', ftype: 'date', text: 'Data nașterii' },
  { id: 2, page: 1, x: 100, y: 140, w: 120, h: 20, kind: 'field', ftype: 'date' },
  { id: 3, page: 1, x: 100, y: 180, w: 160, h: 20, kind: 'field', text: 'Nume' },
];
const bytes = await stampMarks(src, marks);
const back = await PDFDocument.load(bytes);
const form = back.getForm();
const names = form.getFields().map((f) => f.getName());
check(names.includes('Data nașterii') && names.includes('Data') && names.includes('Nume'), 'trei câmpuri: ' + names.join(', '));
const f = form.getField('Data nașterii');
check(f instanceof PDFTextField, 'câmpul de dată e un câmp de text');
check(f.getMaxLength() === 10, 'cel mult 10 caractere (zz.ll.aaaa)');
const aa = f.acroField.dict.lookup(PDFName.of('AA'));
const js = (k) => aa?.lookup(PDFName.of(k))?.lookup(PDFName.of('JS'))?.decodeText?.() ?? '';
check(js('F') === 'AFDate_FormatEx("dd.mm.yyyy");', 'formatul afișat: ' + js('F'));
check(js('K') === 'AFDate_KeystrokeEx("dd.mm.yyyy");', 'verificarea la scriere: ' + js('K'));
check(aa?.lookup(PDFName.of('F'))?.lookup(PDFName.of('S'))?.toString() === '/JavaScript', 'acțiunea e de tip JavaScript (cum o cer programele de PDF)');
check(f.acroField.dict.lookup(PDFName.of('TU'))?.decodeText() === 'Data (zz.ll.aaaa)', 'indiciul câmpului: Data (zz.ll.aaaa)');
const n = form.getField('Nume');
check(!n.acroField.dict.lookup(PDFName.of('AA')), 'câmpul de text obișnuit n-are format de dată');
f.setText('20.10.2026');
const again = await PDFDocument.load(await back.save());
check(again.getForm().getTextField('Data nașterii').getText() === '20.10.2026', 'câmpul se completează și se salvează');

// Butoanele radio: așezarea lor în dreptunghi (crearea în PDF, cu etichetele desenate, se verifică în cdp-pdf-field).
check(fieldOptions({ opts: 'Da, Nu, Da;  Poate ' }).join('|') === 'Da|Nu|Poate', 'opțiunile: fără dubluri și spații');
check(fieldOptions({}).join('|') === 'Da|Nu', 'fără opțiuni: Da, Nu');
const rl = radioLayout({ id: 7, page: 2, x: 100, y: 50, w: 300, h: 20, kind: 'field', ftype: 'radio', opts: 'Masculin, Feminin, Altul' });
check(rl.length === 3 && rl.map((b) => b.x).join(',') === '100,200,300', 'trei butoane, unul lângă altul');
check(rl.every((b) => b.s === 16 && b.y === 52), 'butoane de 16 pt, la mijlocul înălțimii');
check(rl[1].label.kind === 'text' && rl[1].label.text === 'Feminin' && rl[1].label.page === 2 && rl[1].label.x === 219, 'eticheta fiecăruia e un text în dreapta lui');
check(new Set(rl.map((b) => b.label.id)).size === 3 && !rl.some((b) => b.label.id === 7), 'etichetele au id-uri proprii');
const tiny = radioLayout({ id: 1, page: 1, x: 0, y: 0, w: 40, h: 10, kind: 'field', ftype: 'radio' });
check(tiny.every((b) => b.s >= 6 && b.s <= 10), 'în dreptunghi mic butoanele se micșorează');

console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
