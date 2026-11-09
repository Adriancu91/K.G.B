// Test pentru redactarea care păstrează pagina ca text (redactKeep.ts): literele din zonă dispar din conținut (nu se mai
// citesc), restul rândului rămâne text, exact pe loc; cu imagine, desen sau câmp sub zonă funcția refuză (pagina se face imagine).
// Cu un font de bază (Helvetica) și cu un font încorporat cu coduri de 2 octeți (Liberation Sans).
// Copiat din Cyber Office Studio (tests/pdf-redact-keep.test.mjs, D-071); schimbat doar felul în care se încarcă codul
// (Node 24 citește TypeScript direct, fără esbuild). Rulare (în app/): node tests/redact-keep.test.mjs
import "./ts-hooks.mjs";
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const { redactKeepText, dropAnnotsIn, dropUnreachable } = await import('../src/modules/pdf/redactKeep.ts');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const fontsUrl = pathToFileURL(join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/')).href;

const items = async (bytes) => {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, useSystemFonts: false }).promise;
  const tc = await (await doc.getPage(1)).getTextContent();
  return tc.items.filter((it) => it.str.trim()).map((it) => ({ str: it.str.trim(), x: Math.round(it.transform[4] * 10) / 10, y: Math.round(it.transform[5] * 10) / 10 }));
};

async function make(kind, extra) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([400, 300]);
  const font = kind === 'Helvetica' ? await doc.embedFont(StandardFonts.Helvetica)
    : await doc.embedFont(readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf'), { subset: true });
  // Un singur rând, o singură comandă de text: „CNP: 1850101123456 Nume Pop”; CNP-ul e la mijloc.
  page.drawText('CNP: 1850101123456 Nume Pop', { x: 50, y: 200, size: 14, font });
  page.drawText('Randul doi ramane', { x: 50, y: 170, size: 14, font });
  const x0 = 50 + font.widthOfTextAtSize('CNP: ', 14);
  const x1 = x0 + font.widthOfTextAtSize('1850101123456', 14);
  if (extra) await extra(doc, page, x0, x1);
  // Recitit din octeți, ca un fișier adevărat (conținutul paginii e atunci un flux obișnuit).
  return { doc: await PDFDocument.load(await doc.save()), zone: [x0 - 1, 196, x1 + 1, 212], x0, x1 };
}

for (const kind of ['Helvetica', 'Liberation']) {
  const { doc, zone } = await make(kind);
  const before = await items(await doc.save());
  const n = redactKeepText(doc, 0, [zone]);
  // Cele 13 cifre (plus, cel mult, spațiul de lângă zonă: zona are 1 punct în plus pe margini).
  assert.ok(n >= 13 && n <= 15, `${kind}: 13 cifre scoase (au fost ${n})`);
  const after = await items(await doc.save());
  const all = after.map((i) => i.str).join(' ');
  assert.ok(!/\d{3}/.test(all), `${kind}: cifrele nu se mai citesc: ${all}`);
  assert.ok(all.includes('CNP:') && all.includes('Nume Pop'), `${kind}: restul rândului e text: ${all}`);
  // „Nume Pop” rămâne exact pe loc (aceeași poziție ca litera N înainte).
  const nume = after.find((i) => i.str.startsWith('Nume'));
  const first = before[0];
  const expectX = first.x + 0; // începutul rândului rămâne la 50
  assert.equal(after[0].x, expectX, `${kind}: începutul rândului pe loc`);
  assert.ok(nume && nume.x > zone[2] - 1 && nume.x < zone[2] + 12, `${kind}: „Nume” rămâne după zonă (x=${nume?.x})`);
  assert.ok(after.some((i) => i.y === 170), `${kind}: rândul doi neatins`);
  console.log(`${kind}: OK (${after.map((i) => `${i.str}@${i.x}`).join(' | ')})`);
}

// Imagine sub zonă → refuză (null), nimic schimbat.
{
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const { doc, zone } = await make('Helvetica', async (d, p, x0) => { const img = await d.embedPng(png); p.drawImage(img, { x: x0, y: 190, width: 30, height: 30 }); });
  const before = await doc.save();
  assert.equal(redactKeepText(doc, 0, [zone]), null, 'imagine sub zonă → null');
  assert.ok((await items(await doc.save())).map((i) => i.str).join(' ').includes('1850101123456'), 'nimic schimbat');
  void before;
  console.log('Imagine sub zonă: refuză, OK');
}
// O imagine departe de zonă nu încurcă.
{
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const { doc, zone } = await make('Helvetica', async (d, p) => { const img = await d.embedPng(png); p.drawImage(img, { x: 300, y: 20, width: 30, height: 30 }); });
  assert.ok(redactKeepText(doc, 0, [zone]) >= 13, 'imagine departe → merge');
  console.log('Imagine departe: OK');
}
// Un desen aflat tot în zonă (de ex. semnătură) → refuză; o linie lungă care doar trece prin zonă nu.
{
  const { doc, zone } = await make('Helvetica', async (d, p, x0) => { p.drawLine({ start: { x: x0 + 5, y: 199 }, end: { x: x0 + 40, y: 208 }, thickness: 1, color: rgb(0, 0, 0) }); });
  assert.equal(redactKeepText(doc, 0, [zone]), null, 'desen în zonă → null');
  const b = await make('Helvetica', async (d, p) => { p.drawLine({ start: { x: 20, y: 205 }, end: { x: 380, y: 205 }, thickness: 0.5, color: rgb(0, 0, 0) }); });
  assert.ok(redactKeepText(b.doc, 0, [b.zone]) >= 13, 'linie lungă prin zonă → merge');
  console.log('Desene: OK');
}
// Câmp de formular peste zonă → refuză.
{
  const { doc, zone } = await make('Helvetica', async (d, p, x0) => { const f = d.getForm().createTextField('cnp'); f.setText('123'); f.addToPage(p, { x: x0, y: 195, width: 60, height: 18 }); });
  assert.equal(redactKeepText(doc, 0, [zone]), null, 'câmp peste zonă → null');
  console.log('Câmp: OK');
}
// Câmp de formular peste zonă: dropAnnotsIn îl scoate cu tot cu valoare (din pagină și din formular), alt câmp rămâne; apoi textul merge.
{
  const { doc, zone } = await make('Helvetica', async (d, p, x0) => {
    const form = d.getForm();
    const f = form.createTextField('cnp'); f.setText('1850101123456'); f.addToPage(p, { x: x0, y: 195, width: 60, height: 18 });
    const g = form.createTextField('oras'); g.setText('Cluj'); g.addToPage(p, { x: 50, y: 40, width: 80, height: 18 });
  });
  assert.equal(dropAnnotsIn(doc, 0, [zone]), 1, 'un câmp scos');
  assert.ok(redactKeepText(doc, 0, [zone]) >= 13, 'apoi textul se redactează');
  dropUnreachable(doc);
  const saved = await doc.save();
  const names = (await PDFDocument.load(saved)).getForm().getFields().map((f) => f.getName());
  assert.deepEqual(names, ['oras'], 'în formular rămâne doar câmpul de departe');
  // Fără fluxuri de obiecte, ca valorile câmpurilor să fie scrise deschis în fișier (și să le putem căuta).
  const plain = Buffer.from(await doc.save({ useObjectStreams: false })).toString('latin1');
  // pdf-lib scrie valorile ca UTF-16 în hex.
  const u16 = (t) => [...t].map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join('');
  assert.ok(plain.includes(u16('Cluj')) && !plain.includes(u16('1850101123456')), 'valoarea câmpului nu mai e în fișier, cea a câmpului de departe da');
  console.log('Câmp scos: OK');
}
// Câmp cu două casete (valoare comună), una peste zonă → null, nimic schimbat.
{
  const { doc, zone } = await make('Helvetica', async (d, p, x0) => {
    const f = d.getForm().createTextField('cnp'); f.setText('123');
    f.addToPage(p, { x: x0, y: 195, width: 60, height: 18 }); f.addToPage(p, { x: 50, y: 40, width: 60, height: 18 });
  });
  assert.equal(dropAnnotsIn(doc, 0, [zone]), null, 'câmp cu două casete → null');
  assert.equal(doc.getPage(0).node.Annots().size(), 2, 'nimic scos');
  console.log('Câmp cu două casete: refuză, OK');
}
console.log('TOATE TRECUTE');
