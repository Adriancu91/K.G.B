// Test: câmpul cod de bare al formularului PDF (src/pdf/barcodeField.ts). Un formular cu două câmpuri de text și o bifă primește
// un cod de bare; după completare, refreshBarcodes reface codul, iar desenul lui e exact codul QR al datelor (nume / valori cu Tab).
// Rulare (în suite/): node tests/pdf-barcode-field.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-bcf-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-bcf-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/pdf/barcodeField.ts')};\nexport { makeQr } from ${src('src/qr.ts')};\nexport * as lib from 'pdf-lib';\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', nodePaths: [join(process.cwd(), 'node_modules')] });
const { addBarcodeField, refreshBarcodes, barcodeText, barcodeOps, barcodeFields, makeQr, lib } = await import(pathToFileURL(out).href);
const { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } = lib;

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const TAB = String.fromCharCode(9), NL = String.fromCharCode(10);

check(barcodeText([{ name: 'Nume', value: 'Ion' }, { name: 'Oraș', value: 'Cluj' + TAB + 'Napoca' }]) === 'Nume' + TAB + 'Oraș' + NL + 'Ion' + TAB + 'Cluj Napoca', 'textul codului: nume pe primul rând, valori pe al doilea, Tab-ul din valoare devine spațiu');
check(JSON.stringify(barcodeFields(' Nume, ,Data ')) === '["Nume","Data"]', 'lista câmpurilor din opțiuni');

// Formularul: Nume, Data, o bifă și codul de bare (toate câmpurile).
const doc = await PDFDocument.create();
const page = doc.addPage([595, 842]);
const form = doc.getForm();
form.createTextField('Nume').addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
form.createTextField('Data').addToPage(page, { x: 50, y: 660, width: 200, height: 20 });
form.createCheckBox('Acord').addToPage(page, { x: 50, y: 620, width: 14, height: 14 });
addBarcodeField(doc, page, { x: 400, y: 600, width: 120, height: 120 }, 'Cod de bare', []);
const bc2 = addBarcodeField(doc, page, { x: 400, y: 400, width: 100, height: 100 }, 'Cod doar nume', ['Nume']);
check(!!bc2.acroField.dict.get(PDFName.of('SuiteBarcode')), 'câmpul are dicționarul SuiteBarcode');
check(bc2.isReadOnly(), 'codul de bare e doar de citit');
const empty = await doc.save();

// Completat ca în Suite (pdf.js scrie valorile), apoi refăcut.
const filled = await PDFDocument.load(empty);
filled.getForm().getTextField('Nume').setText('Maria Popescu');
filled.getForm().getTextField('Data').setText('31.10.2026');
filled.getForm().getCheckBox('Acord').check();
const res = await refreshBarcodes(await filled.save());
check(!!res && res.tooLong.length === 0, 'refreshBarcodes găsește codurile și datele încap');

const after = await PDFDocument.load(res.bytes);
const apOps = (name) => {
  const w = after.getForm().getButton(name).acroField.getWidgets()[0];
  const n = w.dict.lookup(PDFName.of('AP')).lookup(PDFName.of('N'));
  const data = n instanceof PDFRawStream ? decodePDFRawStream(n).decode() : n.getContents();
  return { ops: new TextDecoder().decode(data), r: w.getRectangle() };
};
const textAll = 'Nume' + TAB + 'Data' + TAB + 'Acord' + NL + 'Maria Popescu' + TAB + '31.10.2026' + TAB + 'Da';
const a = apOps('Cod de bare');
check(a.ops === barcodeOps(makeQr(textAll, 'M'), a.r.width, a.r.height), 'codul cu toate câmpurile = codul QR al „Nume / Data / Acord” cu valorile completate');
const b = apOps('Cod doar nume');
check(b.ops === barcodeOps(makeQr('Nume' + NL + 'Maria Popescu', 'M'), b.r.width, b.r.height), 'codul cu câmpul ales are doar Nume');
check((a.ops.match(/ re/g) || []).length > 50, 'desenul are pătratele codului (' + (a.ops.match(/ re/g) || []).length + ' dreptunghiuri)');

// Prea mult text: codul vechi rămâne și se spune.
const big = await PDFDocument.load(res.bytes);
big.getForm().getTextField('Nume').setText('x'.repeat(400));
const res2 = await refreshBarcodes(await big.save());
check(res2.tooLong.includes('Cod de bare') && res2.tooLong.includes('Cod doar nume'), 'datele prea lungi sunt raportate');

// Un PDF fără coduri nu se atinge.
const plain = await PDFDocument.create(); plain.addPage();
check((await refreshBarcodes(await plain.save())) === null, 'PDF fără cod de bare: nimic de făcut');

console.log(bad ? `\n${bad} GRESITE` : '\nTOATE OK');
process.exit(bad ? 1 : 0);
