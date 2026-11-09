// Test pentru PDF → formulare: Golește formularul și Aplatizează formularul (src/pdf/forms.ts), pe un formular făcut aici
// și pe toate PDF-urile cu câmpuri din test-corpus/pdf (dacă există).
// Copiat din Cyber Office Studio (tests/pdf-forms.test.mjs, D-071); schimbat doar felul în care se încarcă codul.
// Rulare (în app/): node tests/forms.test.mjs
import "./ts-hooks.mjs";
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const { clearForm, flattenForm } = await import('../src/modules/pdf/forms.ts');

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + info}`); if (!ok) fail++; };

// Un formular: un câmp de text completat, unul gol, o bifă bifată, o listă cu alegere, butoane radio.
const d = await PDFDocument.create();
const p = d.addPage([400, 400]);
const f = d.getForm();
const t = f.createTextField('nume'); t.setText('Ion Popescu'); t.addToPage(p, { x: 20, y: 340, width: 200, height: 24 });
const e = f.createTextField('gol'); e.addToPage(p, { x: 20, y: 300, width: 200, height: 24 });
const c = f.createCheckBox('acord'); c.addToPage(p, { x: 20, y: 260, width: 16, height: 16 }); c.check();
const l = f.createDropdown('oras'); l.addOptions(['Cluj', 'Iași']); l.select('Cluj'); l.addToPage(p, { x: 20, y: 220, width: 120, height: 22 });
const r = f.createRadioGroup('gen'); r.addOptionToPage('a', p, { x: 20, y: 180, width: 14, height: 14 }); r.addOptionToPage('b', p, { x: 50, y: 180, width: 14, height: 14 }); r.select('b');
const form = await d.save();

const cl = await clearForm(form);
check('golire: 4 câmpuri aveau ceva', cl.cleared === 4, String(cl.cleared));
{
  const g = (await PDFDocument.load(cl.bytes)).getForm();
  check('golire: textul e gol, bifa scoasă, lista și radio fără alegere',
    !g.getTextField('nume').getText() && !g.getCheckBox('acord').isChecked() && g.getDropdown('oras').getSelected().length === 0 && !g.getRadioGroup('gen').getSelected());
  check('golire: câmpurile rămân (se pot completa din nou)', g.getFields().length === 5);
}
const fl = await flattenForm(form);
{
  const x = await PDFDocument.load(fl.bytes);
  check('aplatizare: nu mai are câmpuri', x.getForm().getFields().length === 0 && fl.fields === 5);
  const res = x.getPage(0).node.Resources();
  const xobj = res && [...res.entries()].find(([k]) => k.asString() === '/XObject')?.[1];
  const n = xobj ? x.context.lookup(xobj).entries().length : 0;
  check('aplatizare: ce era în câmpuri e desenat pe pagină', n >= 4, String(n));
  const annots = x.getPage(0).node.Annots();
  const kinds = annots ? annots.asArray().map((a) => String(x.context.lookup(a).get(x.context.obj('Subtype')))) : [];
  check('aplatizare: pagina nu mai are câmpuri de formular (fără widget-uri)', !kinds.includes('/Widget'), JSON.stringify(kinds));
}
let msg = '';
try { await flattenForm(await (await PDFDocument.create()).save().then(async (b) => { const q = await PDFDocument.load(b); q.addPage(); return q.save(); })); } catch (er) { msg = er.message; }
check('PDF fără câmpuri: mesaj clar', /nu are câmpuri/.test(msg), msg);

// Corpusul: fiecare PDF cu câmpuri (necriptat) se golește și se aplatizează fără eroare.
const dir = join('..', 'test-corpus', 'pdf');
if (existsSync(dir)) {
  let n = 0;
  const bad = [];
  for (const name of readdirSync(dir).filter((x) => x.endsWith('.pdf'))) {
    let doc;
    try { doc = await PDFDocument.load(readFileSync(join(dir, name)), { updateMetadata: false }); } catch { continue; }
    let k = 0;
    try { k = doc.getForm().getFields().length; } catch { continue; }
    if (!k) continue;
    n++;
    const b = new Uint8Array(readFileSync(join(dir, name)));
    try {
      await clearForm(b);
      const fb = await flattenForm(b);
      await PDFDocument.load(fb.bytes);
    } catch (er) { bad.push(`${name}: ${er.message}`); }
  }
  console.log(`corpus: ${n} PDF-uri cu câmpuri`);
  for (const b of bad) console.log('   ' + b);
  check('corpus: toate se golesc și se aplatizează fără eroare', bad.length === 0, bad.length + ' probleme');
}

console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
