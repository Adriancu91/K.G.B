// Test: câmpurile care calculează din formularele PDF (calc.ts) și câmpul nou „Σ Total (sumă)” (sign.ts).
// Rulare (în suite/): node tests/pdf-calc.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';

const bundle = async (entry, name) => {
  const out = join(tmpdir(), `suite-${name}-${process.pid}.mjs`);
  await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
  const mod = await import(pathToFileURL(out).href);
  rmSync(out, { force: true });
  return mod;
};
globalThis.document ??= { createElement: () => ({}) };
const { parseCalc, parseNum, formatNum, recalcForm } = await bundle('src/pdf/calc.ts', 'calc');
const { stampMarks, sumFields } = await bundle('src/pdf/sign.ts', 'sign-calc');
let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };

// Citirea calculelor standard.
const c1 = parseCalc('AFSimple_Calculate("SUM", new Array ("Pret 1", "Pret 2", "Pret 3"));');
check(c1?.op === 'SUM' && c1.fields.join('|') === 'Pret 1|Pret 2|Pret 3', 'SUM cu new Array');
const c2 = parseCalc("AFSimple_Calculate('AVG', 'A, B,C');");
check(c2?.op === 'AVG' && c2.fields.join('|') === 'A|B|C', 'AVG cu listă într-un singur șir');
check(parseCalc('AFSimple_Calculate("PRD", ["x", "y"]);')?.op === 'PRD', 'PRD cu [..]');
check(parseCalc('event.value = this.getField("A").value * 2;') === null, 'scripturile oarecare nu se rulează');
const c3 = parseCalc('/** BVCALC (Pret\\ unitar * Cantitate) - Reducere EVCALC **/ event.value = 0;');
check(c3 && 'expr' in c3, 'notația simplificată (BVCALC … EVCALC)');
check(parseCalc('/** BVCALC A + * EVCALC **/') === null, 'expresie greșită → nimic');

// Numere scrise de oameni.
check(parseNum('1.234,56') === 1234.56, '1.234,56');
check(parseNum('1,234.56') === 1234.56, '1,234.56');
check(parseNum('12,5') === 12.5, '12,5 (virgulă zecimală)');
check(parseNum('15 lei') === 15, '15 lei');
check(parseNum('-3') === -3 && parseNum('(4)') === -4, 'negative: -3 și (4)');
check(parseNum('') === 0 && parseNum('abc') === 0, 'gol sau fără cifre → 0');

// Formatul afișat.
check(formatNum(1234.5, 'AFNumber_Format(2, 2, 0, 0, "", false);') === '1.234,50', 'format 1.234,50');
check(formatNum(1234.5, 'AFNumber_Format(2, 0, 0, 0, "$", true);') === '$1,234.50', 'format $1,234.50');
check(formatNum(-7, 'AFNumber_Format(0, 1, 1, 0, " lei", false);') === '(7 lei)', 'negativ în paranteze');
check(formatNum(0.256, 'AFPercent_Format(1, 0);') === '25.6%', 'procent');
check(formatNum(2.5) === '2,5' && formatNum(3) === '3', 'fără format: cu virgulă');

// Recalcularea unui formular: Total = Pret 1 + Pret 2; Media; TVA = Total * 0.19 (notație simplificată); total general din totaluri.
const fields = {
  'Pret 1': [{ id: '1R', type: 'text', value: '10' }],
  'Pret 2': [{ id: '2R', type: 'text', value: '' }],
  Total: [{ id: '3R', type: 'text', value: '', actions: { Calculate: ['AFSimple_Calculate("SUM", new Array("Pret 1", "Pret 2"));'], Format: ['AFNumber_Format(2, 2, 0, 0, "", false);'] } }],
  TVA: [{ id: '4R', type: 'text', value: '', actions: { Calculate: ['/** BVCALC Total * 0.19 EVCALC **/'] } }],
  Rand: [{ id: '9R' }],
  'Rand.1': [{ id: '5R', type: 'text', value: '2' }],
  'Rand.2': [{ id: '6R', type: 'text', value: '3' }],
  Produs: [{ id: '7R', type: 'text', value: '', actions: { Calculate: ['AFSimple_Calculate("PRD", "Rand");'] } }],
  Bifa: [{ id: '8R', type: 'checkbox', value: 'Off', exportValues: '5' }],
  'Cu bifa': [{ id: '10R', type: 'text', value: '', actions: { Calculate: ['AFSimple_Calculate("SUM", "Bifa, Pret 1");'] } }],
};
const store = {};
const get = (o) => (o.id in store ? store[o.id] : o.value);
const set = (o, v) => { store[o.id] = v; };
store['2R'] = '1.234,5';
let n = recalcForm(fields, get, set);
check(store['3R'] === '1.244,50', 'totalul: 10 + 1.234,5 = 1.244,50 (' + store['3R'] + ')');
check(store['4R'] === '236,455', 'TVA din total, calculat după el: ' + store['4R']);
check(store['7R'] === '6', 'produsul copiilor „Rand.1” × „Rand.2”: ' + store['7R']);
check(store['10R'] === '10', 'bifa nebifată nu adaugă nimic');
store['8R'] = true;
recalcForm(fields, get, set);
check(store['10R'] === '15', 'bifa bifată adaugă valoarea ei (5)');
n = recalcForm(fields, get, set);
check(n === 0, 'a doua oară nu se mai schimbă nimic');
check(recalcForm({ A: [{ id: '1', type: 'text', value: '1' }] }, get, set) === 0, 'formular fără calcule: nimic');

// Câmpul nou „Σ Total” pus de Suite.
check(sumFields({ opts: 'Pret 1, Pret.2; Pret 1' }).join('|') === 'Pret 1|Pret 2', 'numele adunate: fără dubluri, punctul devine spațiu');
const d = await PDFDocument.create();
d.addPage([595, 842]);
const marks = [
  { id: 1, page: 1, x: 100, y: 100, w: 120, h: 20, kind: 'field', text: 'Pret 1' },
  { id: 2, page: 1, x: 100, y: 130, w: 120, h: 20, kind: 'field', text: 'Pret 2' },
  { id: 3, page: 1, x: 100, y: 160, w: 120, h: 20, kind: 'field', ftype: 'sum', text: 'Total', opts: 'Pret 1, Pret 2' },
];
const back = await PDFDocument.load(await stampMarks(await d.save(), marks));
const form = back.getForm();
const tot = form.getTextField('Total');
check(tot.isReadOnly(), 'totalul e doar de citit');
check(tot.getText() === '0,00', 'pornește de la 0,00');
const aa = tot.acroField.dict.lookup(PDFName.of('AA'));
const js = (k) => aa?.lookup(PDFName.of(k))?.lookup(PDFName.of('JS'))?.decodeText?.() ?? '';
check(js('C') === 'AFSimple_Calculate("SUM", new Array("Pret 1", "Pret 2"));', 'calculul: ' + js('C'));
check(js('F') === 'AFNumber_Format(2, 2, 0, 0, "", false);', 'formatul: ' + js('F'));
const co = form.acroForm.dict.lookup(PDFName.of('CO'));
check(co instanceof PDFArray && co.size() === 1 && co.get(0) === tot.acroField.ref, 'în ordinea de calcul (/CO)');
const c4 = parseCalc(js('C'));
check(c4?.op === 'SUM' && c4.fields.join('|') === 'Pret 1|Pret 2', 'Suite își citește singur totalul');

console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
