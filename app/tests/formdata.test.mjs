// Test pentru Export / Import date formular din PDF (src/pdf/formdata.ts): .xfdf, .fdf și .csv, dus-întors într-un formular gol.
// Copiat din Cyber Office Studio (tests/pdf-formdata.test.mjs, D-071); schimbat doar felul în care se încarcă codul.
// Rulare (în app/): node tests/formdata.test.mjs
import "./ts-hooks.mjs";
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const { readFormValues, valuesToXfdf, valuesToCsv, parseFormData, fillForm, responsesToCsv, valuesToFdf, parseFdf, isFdf } = await import('../src/modules/pdf/formdata.ts');

let fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };

// Un formular gol: nume, oraș (listă), acord (bifă), sex (radio), adresă.strada (nume cu punct).
const blank = await (async () => {
  const d = await PDFDocument.create();
  const p = d.addPage([400, 400]);
  const f = d.getForm();
  f.createTextField('nume').addToPage(p, { x: 10, y: 350, width: 200, height: 20 });
  const dd = f.createDropdown('oras'); dd.addOptions(['Cluj', 'Iasi', 'Arad']); dd.addToPage(p, { x: 10, y: 320, width: 200, height: 20 });
  f.createCheckBox('acord').addToPage(p, { x: 10, y: 290, width: 15, height: 15 });
  const r = f.createRadioGroup('sex'); r.addOptionToPage('M', p, { x: 10, y: 260, width: 15, height: 15 }); r.addOptionToPage('F', p, { x: 40, y: 260, width: 15, height: 15 });
  f.createTextField('adresa.strada').addToPage(p, { x: 10, y: 230, width: 200, height: 20 });
  return d.save();
})();
eq('formular gol: valori goale', (await readFormValues(blank)).map((v) => v.value), ['', '', false, '', '']);

// Îl completăm prin fillForm (ca la import) și citim înapoi.
const vals = [{ name: 'nume', value: 'Ana "Mia", Pop' }, { name: 'oras', value: 'Iasi' }, { name: 'acord', value: true }, { name: 'sex', value: 'F' }, { name: 'adresa.strada', value: 'Lungă & <Nouă>' }, { name: 'nu-exista', value: 'x' }];
const f1 = await fillForm(blank, vals);
eq('completate 5, unul lipsă', [f1.filled, f1.missing], [5, ['nu-exista']]);
const back = await readFormValues(f1.bytes);
eq('valorile citite înapoi', back, [{ name: 'nume', value: 'Ana "Mia", Pop' }, { name: 'oras', value: 'Iasi' }, { name: 'acord', value: true }, { name: 'sex', value: 'F' }, { name: 'adresa.strada', value: 'Lungă & <Nouă>' }]);

// XFDF: nume cu punct devin câmpuri unul în altul; dus-întors dă aceleași valori.
const x = valuesToXfdf(back, 'cerere.pdf');
eq('XFDF: câmp în câmp', x.includes('<field name="adresa">') && x.includes('<field name="strada">') && x.includes('&lt;Nouă&gt;') && x.includes('<f href="cerere.pdf"/>'), true);
const px = parseFormData(x);
eq('XFDF citit', px, [{ name: 'nume', value: 'Ana "Mia", Pop' }, { name: 'oras', value: 'Iasi' }, { name: 'acord', value: 'Da' }, { name: 'sex', value: 'F' }, { name: 'adresa.strada', value: 'Lungă & <Nouă>' }]);
const f2 = await fillForm(blank, px);
eq('XFDF pus în formularul gol', (await readFormValues(f2.bytes)).map((v) => v.value), ['Ana "Mia", Pop', 'Iasi', true, 'F', 'Lungă & <Nouă>']);

// FDF: sintaxa PDF; diacriticele în UTF-16BE, nume cu punct ca /Kids, bifa ca /Yes; dus-întors dă aceleași valori.
const fdf = valuesToFdf(back, 'cerere.pdf');
const enc = new TextEncoder().encode(fdf);
eq('FDF: antet, câmp în câmp, bifă ca nume', fdf.startsWith('%FDF-1.2') && fdf.includes('<< /T (adresa) /Kids [<< /T (strada) /V <FEFF') && fdf.includes('/T (acord) /V /Yes') && fdf.includes('/F (cerere.pdf)') && isFdf(enc), true);
eq('FDF citit', parseFdf(enc), [{ name: 'nume', value: 'Ana "Mia", Pop' }, { name: 'oras', value: 'Iasi' }, { name: 'acord', value: 'Yes' }, { name: 'sex', value: 'F' }, { name: 'adresa.strada', value: 'Lungă & <Nouă>' }]);
const f5 = await fillForm(blank, parseFdf(enc));
eq('FDF pus în formularul gol', (await readFormValues(f5.bytes)).map((v) => v.value), ['Ana "Mia", Pop', 'Iasi', true, 'F', 'Lungă & <Nouă>']);
eq('FDF: CSV / XFDF nu sunt luate drept .fdf', [isFdf(new TextEncoder().encode(x)), isFdf(new TextEncoder().encode(valuesToCsv(back)))], [false, false]);
// Un .fdf scris de alt program: șiruri cu escape-uri (paranteze, octal, rând nou), nume cu #66, referințe „n 0 R”, liste cu mai multe valori.
const B = String.fromCharCode(92);
const other = ['%FDF-1.2', '%' + String.fromCharCode(0xe2, 0xe3, 0xcf, 0xd3), '1 0 obj', '<< /FDF << /Fields 2 0 R /F (x.pdf) >> /Type /Catalog >>', 'endobj',
  '2 0 obj', `[ << /T (nume) /V (Ion ${B}(Popescu${B}) ${B}351 ${B}${B} fin) >> << /T (acord) /V /Of#66 >> << /T (lista mea) /V [(a) (b)] >> 3 0 R ]`, 'endobj',
  '3 0 obj', '<< /T (adresa) /Kids [ << /T (oras) /V 4 0 R >> ] >>', 'endobj', '4 0 obj', '(Cluj)', 'endobj',
  'trailer', '<< /Root 1 0 R >>', '%%EOF'].join(String.fromCharCode(13, 10));
const bytesOther = Uint8Array.from([...other].map((ch) => ch.charCodeAt(0)));
eq('FDF din alt program', parseFdf(bytesOther), [{ name: 'nume', value: `Ion (Popescu) é ${B} fin` }, { name: 'acord', value: 'Off' }, { name: 'lista mea', value: ['a', 'b'] }, { name: 'adresa.oras', value: 'Cluj' }]);
eq('FDF fără câmpuri sau stricat: listă goală', [parseFdf(new TextEncoder().encode('%FDF-1.2 nimic')), parseFdf(new TextEncoder().encode('%FDF-1.2 /Fields [<< /T (a) /V (b'))], [[], [{ name: 'a', value: 'b' }]]);

// CSV: ghilimele și virgule; punct și virgulă (din programe de calcul tabelar în română); al doilea răspuns.
const c = valuesToCsv(back);
eq('CSV scris', c, 'nume,oras,acord,sex,adresa.strada\r\n"Ana ""Mia"", Pop",Iasi,Da,F,Lungă & <Nouă>\r\n');
const f3 = await fillForm(blank, parseFormData(c));
eq('CSV pus în formularul gol', (await readFormValues(f3.bytes)).map((v) => v.value), ['Ana "Mia", Pop', 'Iasi', true, 'F', 'Lungă & <Nouă>']);
eq('CSV cu ; și al doilea rând', parseFormData('﻿nume;acord\r\nIon;Nu\r\nDan;x\r\n', 2), [{ name: 'nume', value: 'Dan' }, { name: 'acord', value: 'x' }]);
const f4 = await fillForm(f1.bytes, parseFormData('nume;acord\nIon;Off\n'));
eq('bifa scoasă cu „Off”', (await readFormValues(f4.bytes)).find((v) => v.name === 'acord').value, false);
let err = '';
try { await fillForm(await (await PDFDocument.create()).save(), px); } catch (e) { err = e.message; }
eq('PDF fără câmpuri: mesaj clar', err, 'PDF-ul nu are câmpuri de completat.');

// Adună răspunsurile: două formulare, al doilea cu un câmp în plus; câmpurile lipsă rămân goale.
eq('răspunsuri adunate', responsesToCsv([
  { file: 'Ana.pdf', values: [{ name: 'nume', value: 'Ana' }, { name: 'acord', value: true }] },
  { file: 'Ion, Pop.pdf', values: [{ name: 'acord', value: false }, { name: 'nume', value: 'Ion' }, { name: 'oras', value: ['Cluj', 'Arad'] }] },
]), ['Fișier,nume,acord,oras', 'Ana.pdf,Ana,Da,', '"Ion, Pop.pdf",Ion,Off,"Cluj; Arad"', ''].join(String.fromCharCode(13, 10)));
eq('răspunsuri din formulare reale', responsesToCsv([{ file: 'a.pdf', values: await readFormValues(f3.bytes) }]).split(String.fromCharCode(13, 10))[1], 'a.pdf,"Ana ""Mia"", Pop",Iasi,Da,F,Lungă & <Nouă>');

console.log(fail ? `\n${fail} greșeli` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
