// Test pentru câmpul de semnătură gol din PDF (Semnează… → câmp de formular → ✍ Semnătură): după salvare, PDF-ul are un câmp
// /FT /Sig cu numele ales, pe pagina potrivită, în formular și în lista de adnotări a paginii, cu aspect; nu apare ca semnătură făcută.
// Rulare (în suite/): node tests/pdf-sigfield.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { PDFDocument, PDFName, PDFArray, PDFSignature, PDFTextField } from 'pdf-lib';

// pdf-lib rămâne în afara pachetului (o singură copie), ca obiectele PDF făcute în sign.ts să fie recunoscute de documentul din test.
const out = join(process.cwd(), 'node_modules', `.suite-sigfield-${process.pid}`);
await build({ entryPoints: ['src/pdf/sign.ts', 'src/pdf/signatures.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, external: ['pdf-lib'], logLevel: 'error' });
const { addSigField, fieldName, emptySigFields } = await import(pathToFileURL(join(out, 'sign.js')).href);
const { readSignatures } = await import(pathToFileURL(join(out, 'signatures.js')).href);
rmSync(out, { recursive: true, force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

const doc = await PDFDocument.create();
doc.addPage([595, 842]);
const p2 = doc.addPage([595, 842]);
// Un câmp de text deja existent, ca să vedem că numele nu se dublează și că restul formularului rămâne.
const tf = doc.getForm().createTextField('Nume');
tf.addToPage(doc.getPage(0), { x: 50, y: 700, width: 200, height: 20 });
const taken = new Set(doc.getForm().getFields().map((f) => f.getName()));
addSigField(doc, p2, { x: 100, y: 120, width: 180, height: 50 }, fieldName('Semnătura directorului', taken));
addSigField(doc, p2, { x: 320, y: 120, width: 180, height: 50 }, fieldName('Nume', taken));
const bytes = await doc.save();

const back = await PDFDocument.load(bytes);
const fields = back.getForm().getFields();
const sigs = fields.filter((f) => f instanceof PDFSignature);
check('două câmpuri de semnătură', sigs.length === 2, String(sigs.length));
check('câmpul de text rămâne', fields.some((f) => f instanceof PDFTextField && f.getName() === 'Nume'));
check('numele cu diacritice se păstrează', sigs.some((f) => f.getName() === 'Semnătura directorului'), sigs.map((f) => f.getName()).join());
check('numele ocupat devine „Nume 2”', sigs.some((f) => f.getName() === 'Nume 2'));
const s0 = sigs.find((f) => f.getName() === 'Semnătura directorului');
const w = s0.acroField.getWidgets()[0];
const r = w.getRectangle();
check('locul câmpului e cel ales', Math.round(r.x) === 100 && Math.round(r.y) === 120 && Math.round(r.width) === 180 && Math.round(r.height) === 50, JSON.stringify(r));
check('câmpul are aspect (se vede și la tipărire)', !!w.getAppearances()?.normal);
const annots = back.getPage(1).node.lookup(PDFName.of('Annots'), PDFArray);
check('câmpurile sunt în adnotările paginii 2', annots?.size() === 2, String(annots?.size()));
check('pagina 1 are doar câmpul de text', back.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray)?.size() === 1);
check('/FT /Sig', s0.acroField.dict.get(PDFName.of('FT'))?.toString() === '/Sig');
check('nu e o semnătură făcută (fără /V)', !s0.acroField.dict.get(PDFName.of('V')));
check('panoul Semnături nu-l arată ca semnat', readSignatures(bytes).length === 0, String(readSignatures(bytes).length));
const empty = await emptySigFields(bytes);
check('lista câmpurilor goale: amândouă, pe pagina 2', empty.length === 2 && empty.every((f) => f.page === 2) && empty.some((f) => f.name === 'Nume 2'), JSON.stringify(empty));

console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
