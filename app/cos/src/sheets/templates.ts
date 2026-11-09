// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Șabloane românești gata de completat: capul de tabel, formulele, formatul lei/dată,
// listele și evidențierile sunt deja puse. Se deschid ca tabel nou, nesalvat.

import { CellStyle, colName, emptySheet, parseCellId, Sheet, SheetDoc, emptySheetDoc } from './format';
import { borderPatch, BorderKind } from './border';
import type { SheetList } from './lists';
import type { SheetRule } from './cond';
import { invoiceCells } from './invoiceSheet';

export interface Template {
  id: string;
  name: string;
  desc: string;
  build(): SheetDoc;
}

const HEAD: CellStyle = { b: true, bg: '#dde7f5', align: 'center' };
const TOTAL: CellStyle = { b: true, bg: '#eef2f7' };
const LEI: CellStyle = { fmt: 'lei' };
const DATE: CellStyle = { fmt: 'date', align: 'center' };
const PCT: CellStyle = { fmt: 'percent' };

/** Un tabel în construcție: scrii valori și stiluri pe celule, apoi îl transformi în foaie. */
class Grid {
  cells: Record<string, string> = {};
  styles: Record<string, CellStyle> = {};
  colW: Record<string, number> = {};
  lists: SheetList[] = [];
  rules: SheetRule[] = [];
  merges: string[] = [];

  set(id: string, v: string, st?: CellStyle) {
    if (v !== '') this.cells[id] = v;
    if (st) this.styles[id] = { ...this.styles[id], ...st };
  }

  /** Același stil pe o coloană, între rândurile r0 și r1. */
  col(col: string, r0: number, r1: number, st: CellStyle) {
    for (let r = r0; r <= r1; r++) this.styles[col + r] = { ...this.styles[col + r], ...st };
  }

  /** Capul de tabel pe rândul r, începând cu coloana A. */
  head(r: number, titles: string[]) {
    titles.forEach((t, i) => this.set(colName(i) + r, t, HEAD));
  }

  widths(w: Record<string, number>) { Object.assign(this.colW, w); }

  /** Chenar pe o zonă („A1:F31”): toate liniile, contur sau doar jos. */
  box(area: string, kind: BorderKind) {
    const [a, b = a] = area.split(':');
    const p = parseCellId(a)!;
    const q = parseCellId(b)!;
    const g = { r0: p.r, c0: p.c, r1: q.r, c1: q.c };
    Object.assign(this.styles, borderPatch(this.styles, g, kind));
  }

  /** Celule îmbinate („A1:B1”). */
  merge(area: string) { this.merges.push(area); }

  sheet(name: string, freeze = true): Sheet {
    return {
      ...emptySheet(name), cells: this.cells, styles: this.styles, colW: this.colW,
      ...(freeze ? { freeze: 1 } : {}),
      ...(this.lists.length ? { lists: this.lists } : {}),
      ...(this.rules.length ? { rules: this.rules } : {}),
      ...(this.merges.length ? { merges: this.merges } : {}),
    };
  }
}

function doc(title: string, sheet: Sheet): SheetDoc {
  return { ...emptySheetDoc(), title, sheets: [sheet] };
}

// Registru de casă: încasări și plăți în numerar, cu soldul după fiecare operațiune.
function registruCasa(): SheetDoc {
  const g = new Grid();
  const last = 41;
  g.head(1, ['Nr.', 'Data', 'Document', 'Explicație', 'Încasări', 'Plăți', 'Sold']);
  g.set('D2', 'Sold inițial (reportat din ziua precedentă)', { i: true });
  g.set('G2', '0', { ...LEI, b: true });
  for (let r = 3; r <= last; r++) {
    g.set(`A${r}`, `=IF(COUNTA(B${r}:F${r})=0;"";COUNT(A$2:A${r - 1})+1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(COUNTA(E${r}:F${r})=0;"";G$2+SUM(E$3:E${r})-SUM(F$3:F${r}))`);
  }
  g.col('B', 3, last, DATE);
  for (const c of 'EFG') g.col(c, 3, last + 2, LEI);
  const t = last + 2;
  g.set(`D${t}`, 'Total / sold final', TOTAL);
  g.set(`E${t}`, `=SUM(E3:E${last})`, TOTAL);
  g.set(`F${t}`, `=SUM(F3:F${last})`, TOTAL);
  g.set(`G${t}`, `=G2+E${t}-F${t}`, TOTAL);
  g.rules.push({ range: `G3:G${t}`, op: 'lt', v1: '0', look: 'red' });
  g.widths({ A: 50, B: 95, C: 130, D: 280, E: 110, F: 110, G: 120 });
  return doc('Registru de casă', g.sheet('Registru'));
}

// Evidența facturilor emise: TVA calculat, starea încasării, ce mai ai de încasat.
function facturi(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Nr. factură', 'Data', 'Client', 'CUI', 'Valoare fără TVA', 'TVA', 'Total', 'Scadență', 'Stare', 'Încasat', 'Rest de încasat']);
  for (let r = 2; r <= last; r++) {
    g.set(`F${r}`, `=IF(E${r}="";"";ROUND(E${r}*$N$2;2))`);
    g.set(`G${r}`, `=IF(E${r}="";"";E${r}+F${r})`);
    g.set(`K${r}`, `=IF(G${r}="";"";G${r}-J${r})`);
  }
  g.col('B', 2, last, DATE);
  g.col('H', 2, last, DATE);
  for (const c of 'EFGJK') g.col(c, 2, last, LEI);
  g.set('M1', 'Setări și totaluri', { b: true });
  g.set('M2', 'Cota TVA (o schimbi aici)');
  g.set('N2', '0,21', { ...PCT, b: true, bg: '#fff59d' });
  g.set('M4', 'Total facturat');
  g.set('N4', `=SUM(G2:G${last})`, { ...LEI, b: true });
  g.set('M5', 'Încasat');
  g.set('N5', `=SUM(J2:J${last})`, LEI);
  g.set('M6', 'De încasat');
  g.set('N6', `=SUM(K2:K${last})`, { ...LEI, b: true, color: '#c00000' });
  g.set('M7', 'Facturi neîncasate');
  g.set('N7', `=COUNTIF(I2:I${last};"Neîncasat")`);
  g.lists.push({ range: `I2:I${last}`, values: ['Neîncasat', 'Parțial', 'Încasat'] });
  g.rules.push(
    { range: `I2:I${last}`, op: 'eq', v1: 'Neîncasat', look: 'red' },
    { range: `I2:I${last}`, op: 'eq', v1: 'Parțial', look: 'yellow' },
    { range: `I2:I${last}`, op: 'eq', v1: 'Încasat', look: 'green' },
  );
  g.widths({ A: 90, B: 90, C: 200, D: 100, E: 120, F: 100, G: 110, H: 90, I: 100, J: 110, K: 120, L: 30, M: 170, N: 120 });
  return doc('Evidență facturi emise', g.sheet('Facturi'));
}

// Buget lunar pe familie: planificat față de real, pe categorii.
function buget(): SheetDoc {
  const g = new Grid();
  g.head(1, ['Categorie', 'Planificat', 'Real', 'Diferență']);
  const section = (r: number, title: string, bg: string) => g.set(`A${r}`, title, { b: true, bg });
  const line = (r: number, name: string, income: boolean) => {
    g.set(`A${r}`, name);
    // La venituri e bine să iasă mai mult, la cheltuieli mai puțin: diferența pozitivă e mereu „bine”.
    g.set(`D${r}`, `=IF(AND(B${r}="";C${r}="");"";${income ? `C${r}-B${r}` : `B${r}-C${r}`})`);
  };
  section(2, 'VENITURI', '#c6efce');
  ['Salariu', 'Salariu partener', 'Alte venituri', ''].forEach((n, i) => line(3 + i, n, true));
  g.set('A7', 'Total venituri', TOTAL);
  g.set('B7', '=SUM(B3:B6)', TOTAL);
  g.set('C7', '=SUM(C3:C6)', TOTAL);
  g.set('D7', '=C7-B7', TOTAL);
  section(9, 'CHELTUIELI', '#ffc7ce');
  const out = ['Chirie / rată', 'Utilități (curent, gaz, apă)', 'Mâncare', 'Transport / mașină', 'Telefon și internet',
    'Sănătate', 'Copii / școală', 'Haine', 'Ieșiri și distracție', 'Economii', 'Altele'];
  out.forEach((n, i) => line(10 + i, n, false));
  const te = 10 + out.length;
  g.set(`A${te}`, 'Total cheltuieli', TOTAL);
  g.set(`B${te}`, `=SUM(B10:B${te - 1})`, TOTAL);
  g.set(`C${te}`, `=SUM(C10:C${te - 1})`, TOTAL);
  g.set(`D${te}`, `=B${te}-C${te}`, TOTAL);
  const rest = te + 2;
  g.set(`A${rest}`, 'Rămâne (venituri − cheltuieli)', { b: true });
  g.set(`B${rest}`, `=B7-B${te}`, { ...LEI, b: true });
  g.set(`C${rest}`, `=C7-C${te}`, { ...LEI, b: true });
  for (const c of 'BCD') g.col(c, 3, te, LEI);
  g.rules.push({ range: `D3:D${te}`, op: 'lt', v1: '0', look: 'red' }, { range: `B${rest}:C${rest}`, op: 'lt', v1: '0', look: 'red' },
    { range: `B${rest}:C${rest}`, op: 'gt', v1: '0', look: 'green' });
  g.widths({ A: 240, B: 120, C: 120, D: 120 });
  return doc('Buget lunar', g.sheet('Buget'));
}

// Inventar / stoc: valoarea stocului și ce trebuie comandat.
function inventar(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Cod', 'Produs', 'UM', 'Cantitate', 'Preț unitar', 'Valoare', 'Stoc minim', 'Stare']);
  for (let r = 2; r <= last; r++) {
    g.set(`F${r}`, `=IF(OR(D${r}="";E${r}="");"";ROUND(D${r}*E${r};2))`);
    g.set(`H${r}`, `=IF(OR(D${r}="";G${r}="");"";IF(D${r}<=G${r};"De comandat";"OK"))`, { align: 'center' });
  }
  g.col('E', 2, last, LEI);
  g.col('F', 2, last, LEI);
  g.set('J1', 'Valoarea stocului', { b: true });
  g.set('K1', `=SUM(F2:F${last})`, { ...LEI, b: true });
  g.set('J2', 'Produse de comandat');
  g.set('K2', `=COUNTIF(H2:H${last};"De comandat")`, { b: true, color: '#c00000' });
  g.lists.push({ range: `C2:C${last}`, values: ['buc', 'kg', 'g', 'l', 'm', 'mp', 'set', 'cutie', 'pachet'] });
  g.rules.push({ range: `H2:H${last}`, op: 'eq', v1: 'De comandat', look: 'red' }, { range: `H2:H${last}`, op: 'eq', v1: 'OK', look: 'green' });
  g.widths({ A: 80, B: 240, C: 60, D: 90, E: 110, F: 120, G: 90, H: 110, I: 30, J: 160, K: 130 });
  return doc('Inventar', g.sheet('Stoc'));
}

// Deviz: lucrări și materiale, cu total, TVA și total de plată.
function deviz(): SheetDoc {
  const g = new Grid();
  const last = 31;
  g.head(1, ['Nr.', 'Lucrare / material', 'UM', 'Cantitate', 'Preț unitar (fără TVA)', 'Valoare']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";COUNT(A$1:A${r - 1})+1)`, { align: 'center' });
    g.set(`F${r}`, `=IF(OR(D${r}="";E${r}="");"";ROUND(D${r}*E${r};2))`);
  }
  g.col('E', 2, last, LEI);
  g.col('F', 2, last + 4, LEI);
  const t = last + 2;
  g.set(`E${t}`, 'Total fără TVA', { b: true, align: 'right' });
  g.set(`F${t}`, `=SUM(F2:F${last})`, { b: true });
  g.set(`G${t}`, 'Cota TVA', { i: true });
  g.set(`E${t + 1}`, 'TVA', { align: 'right' });
  g.set(`F${t + 1}`, `=ROUND(F${t}*G${t + 1};2)`);
  g.set(`G${t + 1}`, '0,21', { ...PCT, bg: '#fff59d' });
  g.set(`E${t + 2}`, 'TOTAL DE PLATĂ', { ...TOTAL, align: 'right' });
  g.set(`F${t + 2}`, `=F${t}+F${t + 1}`, TOTAL);
  g.set(`B${t + 4}`, `="Adică: "&SUMAINLITERE(F${t + 2})`, { i: true, wrap: true });
  g.merge(`B${t + 4}:F${t + 4}`);
  // Chenare: tabelul de lucrări și caseta cu totalurile, ca pe un deviz tipărit.
  g.box(`A1:F${last}`, 'all');
  g.box(`E${t}:F${t + 2}`, 'all');
  g.lists.push({ range: `C2:C${last}`, values: ['buc', 'mp', 'ml', 'mc', 'kg', 'oră', 'zi', 'set', 'lucrare'] });
  g.widths({ A: 50, B: 320, C: 70, D: 90, E: 170, F: 130, G: 80 });
  return doc('Deviz', g.sheet('Deviz', true));
}

// Salariu net din brut, cu procentele scrise în celule (se schimbă ușor dacă se schimbă legea).
function salariu(): SheetDoc {
  const g = new Grid();
  g.set('A1', 'Calcul salariu net (din brut)', { b: true });
  g.set('A3', 'Salariu brut', { b: true });
  g.set('B3', '5000', { ...LEI, b: true, bg: '#fff59d' });
  g.set('A5', 'Procente (le poți schimba)', { b: true, bg: '#eef2f7' });
  g.set('A6', 'CAS (pensie)');
  g.set('B6', '0,25', PCT);
  g.set('A7', 'CASS (sănătate)');
  g.set('B7', '0,1', PCT);
  g.set('A8', 'Impozit pe venit');
  g.set('B8', '0,1', PCT);
  g.set('A9', 'Deducere personală (lei)');
  g.set('B9', '0', LEI);
  g.set('A11', 'Calcul', { b: true, bg: '#eef2f7' });
  g.set('A12', 'CAS');
  g.set('B12', '=ROUND(B3*B6;0)', LEI);
  g.set('A13', 'CASS');
  g.set('B13', '=ROUND(B3*B7;0)', LEI);
  g.set('A14', 'Venit impozabil');
  g.set('B14', '=MAX(B3-B12-B13-B9;0)', LEI);
  g.set('A15', 'Impozit');
  g.set('B15', '=ROUND(B14*B8;0)', LEI);
  g.set('A17', 'Salariu net', { b: true, bg: '#c6efce' });
  g.set('B17', '=B3-B12-B13-B15', { ...LEI, b: true, bg: '#c6efce' });
  g.set('A19', 'Procentele sunt cele uzuale (CAS 25%, CASS 10%, impozit 10%). Verifică-le dacă se schimbă legea.', { i: true, color: '#666666' });
  g.set('A20', 'Deducerea personală depinde de salariu și de persoanele în întreținere; o scrii tu în B9.', { i: true, color: '#666666' });
  g.widths({ A: 260, B: 130 });
  return doc('Salariu net', g.sheet('Salariu', false));
}

// Pontaj lunar: ore pe zile (1–31), cu totaluri și zilele de concediu.
function pontaj(): SheetDoc {
  const g = new Grid();
  const last = 31;
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  g.head(1, ['Nume și prenume', ...days, 'Total ore', 'Zile lucrate', 'CO', 'CM']);
  const [d0, d1] = [colName(1), colName(31)];
  const [tot, zile, co, cm] = [32, 33, 34, 35].map(colName);
  for (let r = 2; r <= last; r++) {
    g.set(`${tot}${r}`, `=IF(COUNTA(${d0}${r}:${d1}${r})=0;"";SUM(${d0}${r}:${d1}${r}))`, { b: true });
    g.set(`${zile}${r}`, `=IF(COUNTA(${d0}${r}:${d1}${r})=0;"";COUNT(${d0}${r}:${d1}${r}))`);
    g.set(`${co}${r}`, `=IF(COUNTA(${d0}${r}:${d1}${r})=0;"";COUNTIF(${d0}${r}:${d1}${r};"CO"))`);
    g.set(`${cm}${r}`, `=IF(COUNTA(${d0}${r}:${d1}${r})=0;"";COUNTIF(${d0}${r}:${d1}${r};"CM"))`);
    for (let c = 1; c <= 31; c++) g.set(`${colName(c)}${r}`, '', { align: 'center' });
  }
  const t = last + 1;
  g.set(`A${t}`, 'Total', TOTAL);
  g.set(`${tot}${t}`, `=SUM(${tot}2:${tot}${last})`, TOTAL);
  g.set(`A${t + 2}`, 'Luna și anul:', { b: true });
  g.set(`B${t + 2}`, '', { bg: '#fff59d' });
  g.set(`A${t + 3}`, 'În fiecare zi scrii orele lucrate (de exemplu 8) sau CO = concediu de odihnă, CM = concediu medical.', { i: true, color: '#666666' });
  g.rules.push(
    { range: `${d0}2:${d1}${last}`, op: 'eq', v1: 'CO', look: 'blue' },
    { range: `${d0}2:${d1}${last}`, op: 'eq', v1: 'CM', look: 'yellow' },
  );
  g.widths({ A: 200, ...Object.fromEntries(days.map((_, i) => [colName(i + 1), 34])), [tot]: 80, [zile]: 90, [co]: 45, [cm]: 45 });
  return doc('Pontaj', g.sheet('Pontaj'));
}

// Chitanță: suma se scrie singură și în litere.
function chitanta(): SheetDoc {
  const g = new Grid();
  const L = { b: true };
  const IN = { bg: '#fff59d' };
  g.set('A1', 'CHITANȚĂ', { b: true, align: 'center', bg: '#dde7f5' });
  g.merge('A1:B1');
  g.set('A3', 'Seria și numărul', L);
  g.set('B3', '', IN);
  g.set('A4', 'Data', L);
  g.set('B4', '', { ...IN, ...DATE });
  g.set('A6', 'Am primit de la', L);
  g.set('B6', '', IN);
  g.set('A7', 'CNP / CUI', L);
  g.set('B7', '', IN);
  g.set('A8', 'Adresa', L);
  g.set('B8', '', IN);
  g.set('A10', 'Suma', L);
  g.set('B10', '', { ...IN, ...LEI, b: true });
  g.set('A11', 'Adică', L);
  g.set('B11', '=IF(B10="";"";SUMAINLITERE(B10))', { i: true, wrap: true });
  g.set('A12', 'Reprezentând', L);
  g.set('B12', '', IN);
  g.set('A15', 'Casier', L);
  g.set('B15', '', IN);
  g.set('A16', 'Semnătura', L);
  g.set('A18', 'Completezi doar celulele galbene; suma în litere se scrie singură.', { i: true, color: '#666666' });
  // Linii de completat sub fiecare câmp și un contur în jurul chitanței.
  for (const id of ['B3', 'B4', 'B6', 'B7', 'B8', 'B10', 'B11', 'B12', 'B15', 'B16']) g.box(id, 'bottom');
  g.box('A1:B16', 'outline');
  g.widths({ A: 160, B: 460 });
  return doc('Chitanță', g.sheet('Chitanță', false));
}

// Decont de deplasare: cheltuielile drumului pe categorii, avansul primit și ce mai e de dat înapoi sau de primit.
function decont(): SheetDoc {
  const g = new Grid();
  const IN: CellStyle = { bg: '#fff59d' };
  g.set('A1', 'DECONT DE DEPLASARE', { b: true, sz: 14 });
  const info = ['Nume și prenume', 'Destinația', 'Perioada', 'Scopul deplasării'];
  info.forEach((t, i) => { g.set(`A${2 + i}`, t, { b: true }); g.set(`B${2 + i}`, '', IN); g.merge(`B${2 + i}:D${2 + i}`); });
  const h = 7, first = 8, last = 37;
  g.head(h, ['Data', 'Categorie', 'Document', 'Explicație', 'Sumă']);
  g.col('A', first, last, DATE);
  g.col('E', first, last, LEI);
  const cats = ['Transport', 'Cazare', 'Diurnă', 'Masă', 'Taxe și parcări', 'Altele'];
  g.lists.push({ range: `B${first}:B${last}`, values: cats });
  g.box(`A${h}:E${last}`, 'all');
  g.set('G7', 'Pe categorii', HEAD);
  g.set('H7', 'Total', HEAD);
  cats.forEach((c, i) => {
    g.set(`G${8 + i}`, c);
    g.set(`H${8 + i}`, `=SUMIF(B$${first}:B$${last};G${8 + i};E$${first}:E$${last})`, LEI);
  });
  const t = 8 + cats.length;
  g.set(`G${t}`, 'Total cheltuieli', TOTAL);
  g.set(`H${t}`, `=SUM(E${first}:E${last})`, { ...TOTAL, ...LEI });
  g.set(`G${t + 1}`, 'Avans primit');
  g.set(`H${t + 1}`, '0', { ...LEI, ...IN });
  g.set(`G${t + 2}`, 'De primit (+) / de restituit (−)', { b: true });
  g.set(`H${t + 2}`, `=H${t}-H${t + 1}`, { ...LEI, b: true });
  g.rules.push({ range: `H${t + 2}`, op: 'lt', v1: '0', look: 'red' }, { range: `H${t + 2}`, op: 'gt', v1: '0', look: 'green' });
  g.set(`G${t + 4}`, 'Completezi celulele galbene și tabelul; categoria se alege din listă.', { i: true, color: '#666666' });
  g.widths({ A: 150, B: 130, C: 120, D: 240, E: 110, F: 30, G: 220, H: 120 });
  return doc('Decont de deplasare', g.sheet('Decont', false));
}

// Plan de proiect: sarcini cu început și durată, sfârșitul calculat, starea din listă și bara pe săptămâni (12 săptămâni).
function planProiect(): SheetDoc {
  const g = new Grid();
  const last = 31, weeks = 12;
  g.head(1, ['Nr.', 'Sarcina', 'Responsabil', 'Început', 'Durată (zile)', 'Sfârșit', 'Progres', 'Stare']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`F${r}`, `=IF(OR(D${r}="";E${r}="");"";D${r}+E${r}-1)`);
  }
  g.col('D', 2, last, DATE);
  g.col('F', 2, last, DATE);
  g.col('G', 2, last, PCT);
  g.lists.push({ range: `H2:H${last}`, values: ['De făcut', 'În lucru', 'Gata', 'Blocat'] });
  g.rules.push(
    { range: `H2:H${last}`, op: 'eq', v1: 'Gata', look: 'green' },
    { range: `H2:H${last}`, op: 'eq', v1: 'În lucru', look: 'yellow' },
    { range: `H2:H${last}`, op: 'eq', v1: 'Blocat', look: 'red' },
  );
  // Săptămânile: prima pornește de la cea mai devreme dată de început (sau de azi, cât timp tabelul e gol).
  const c0 = 9;
  for (let w = 0; w < weeks; w++) {
    const col = colName(c0 + w);
    g.set(`${col}1`, w === 0 ? `=IF(MIN(D2:D${last})=0;TODAY();MIN(D2:D${last}))` : `=${colName(c0 + w - 1)}1+7`, { ...HEAD, fmt: 'date' });
    for (let r = 2; r <= last; r++) g.set(`${col}${r}`, `=IF(OR($D${r}="";$F${r}="");"";IF(AND($D${r}<=${col}$1+6;$F${r}>=${col}$1);"■";""))`, { align: 'center' });
    g.colW[col] = 82;
  }
  const lastCol = colName(c0 + weeks - 1);
  g.rules.push({ range: `${colName(c0)}2:${lastCol}${last}`, op: 'eq', v1: '■', look: 'blue' });
  g.box(`A1:H${last}`, 'all');
  g.widths({ A: 45, B: 240, C: 130, D: 95, E: 95, F: 95, G: 75, H: 95 });
  return doc('Plan de proiect', g.sheet('Plan'));
}

// Evidența concediilor: zilele cuvenite, cele luate (zile lucrătoare, fără sărbătorile legale din listă) și cele rămase.
function concedii(): SheetDoc {
  const g = new Grid();
  const lastP = 21, lastC = 101;
  g.head(1, ['Angajat', 'Zile cuvenite', 'Reportate', 'Luate (odihnă)', 'Rămase']);
  for (let r = 2; r <= lastP; r++) {
    g.set(`D${r}`, `=IF(A${r}="";"";SUMIFS(J$2:J$${lastC};G$2:G$${lastC};A${r};K$2:K$${lastC};"Odihnă"))`);
    g.set(`E${r}`, `=IF(A${r}="";"";B${r}+C${r}-D${r})`, { b: true });
  }
  g.rules.push({ range: `E2:E${lastP}`, op: 'lt', v1: '0', look: 'red' });
  g.set('G1', 'Angajat', HEAD);
  g.set('H1', 'De la', HEAD);
  g.set('I1', 'Până la', HEAD);
  g.set('J1', 'Zile lucrătoare', HEAD);
  g.set('K1', 'Tip', HEAD);
  for (let r = 2; r <= lastC; r++) g.set(`J${r}`, `=IF(OR(H${r}="";I${r}="");"";NETWORKDAYS(H${r};I${r};M$2:M$30))`, { align: 'center' });
  g.col('H', 2, lastC, DATE);
  g.col('I', 2, lastC, DATE);
  g.lists.push({ range: `K2:K${lastC}`, values: ['Odihnă', 'Medical', 'Fără plată', 'Eveniment familial'] });
  // Sărbătorile legale din România pentru 2026 (Paștele și Rusaliile ortodoxe se schimbă în fiecare an).
  g.set('M1', 'Sărbători legale 2026', HEAD);
  const hol: [number, number][] = [[1, 1], [1, 2], [1, 6], [1, 7], [1, 24], [4, 10], [4, 12], [4, 13], [5, 1], [5, 31], [6, 1], [8, 15], [11, 30], [12, 1], [12, 25], [12, 26]];
  hol.forEach(([m, d], i) => g.set(`M${2 + i}`, `=DATE(2026;${m};${d})`, DATE));
  g.set(`M${3 + hol.length}`, 'Schimbă lista în fiecare an.', { i: true, color: '#666666' });
  g.widths({ A: 200, B: 100, C: 90, D: 110, E: 90, F: 30, G: 200, H: 95, I: 95, J: 115, K: 150, L: 30, M: 170 });
  return doc('Evidență concedii', g.sheet('Concedii'));
}

// Calculator de credit: rata lunară (rate egale) și graficul de rambursare, lună de lună, până la 30 de ani.
function credit(): SheetDoc {
  const g = new Grid();
  const IN: CellStyle = { bg: '#fff59d' };
  g.set('A1', 'CALCULATOR DE CREDIT (rate egale)', { b: true, sz: 14 });
  g.set('A2', 'Suma împrumutată', { b: true }); g.set('B2', '100000', { ...LEI, ...IN });
  g.set('A3', 'Dobânda pe an', { b: true }); g.set('B3', '0.08', { ...PCT, ...IN });
  g.set('A4', 'Numărul de luni', { b: true }); g.set('B4', '120', IN);
  g.set('A5', 'Data primei rate', { b: true }); g.set('B5', '=TODAY()', { ...DATE, ...IN });
  g.set('A6', 'Rata lunară', TOTAL); g.set('B6', '=IF(B3=0;B2/B4;PMT(B3/12;B4;-B2))', { ...TOTAL, ...LEI });
  g.set('A7', 'Total de plată'); g.set('B7', `=SUM(C10:C369)`, LEI);
  g.set('A8', 'Din care dobândă'); g.set('B8', `=SUM(D10:D369)`, LEI);
  const h = 9, first = 10, last = 369;
  g.head(h, ['Nr.', 'Data', 'Rata', 'Dobânda', 'Din credit', 'Rămas de plată']);
  for (let r = first; r <= last; r++) {
    const prev = r === first ? '$B$2' : `F${r - 1}`;
    g.set(`A${r}`, `=IF(${r - h}>$B$4;"";${r - h})`, { align: 'center' });
    g.set(`B${r}`, `=IF(A${r}="";"";EDATE($B$5;A${r}-1))`);
    g.set(`D${r}`, `=IF(A${r}="";"";ROUND(${prev}*$B$3/12;2))`);
    g.set(`C${r}`, `=IF(A${r}="";"";IF(A${r}=$B$4;${prev}+D${r};ROUND($B$6;2)))`);
    g.set(`E${r}`, `=IF(A${r}="";"";C${r}-D${r})`);
    g.set(`F${r}`, `=IF(A${r}="";"";ROUND(${prev}-E${r};2))`);
  }
  g.col('B', first, last, DATE);
  for (const c of 'CDEF') g.col(c, first, last, LEI);
  g.set('D2', 'Schimbi celulele galbene; tabelul se reface singur (ultima rată închide creditul la zero).', { i: true, color: '#666666' });
  g.widths({ A: 150, B: 120, C: 110, D: 110, E: 110, F: 130 });
  return doc('Calculator de credit', g.sheet('Credit', false));
}

// Consumul de carburant: la fiecare plin, kilometrii de la bord și litrii; ies kilometrii parcurși, consumul la 100 km și costul.
function carburant(): SheetDoc {
  const g = new Grid();
  const last = 201;
  g.head(1, ['Data', 'Km la bord', 'Litri', 'Preț / litru', 'Cost', 'Km parcurși', 'Consum (l / 100 km)']);
  for (let r = 2; r <= last; r++) {
    g.set(`E${r}`, `=IF(OR(C${r}="";D${r}="");"";ROUND(C${r}*D${r};2))`);
    if (r > 2) {
      g.set(`F${r}`, `=IF(OR(B${r}="";B${r - 1}="");"";B${r}-B${r - 1})`);
      g.set(`G${r}`, `=IF(OR(F${r}="";C${r}="";F${r}<=0);"";ROUND(C${r}/F${r}*100;2))`);
    }
  }
  g.col('A', 2, last, DATE);
  g.col('D', 2, last, LEI);
  g.col('E', 2, last, LEI);
  g.box(`A1:G${last}`, 'all');
  g.set('I1', 'Pe scurt', HEAD); g.set('J1', '', HEAD);
  g.set('I2', 'Km parcurși'); g.set('J2', `=IF(COUNT(B2:B${last})<2;0;MAX(B2:B${last})-MIN(B2:B${last}))`);
  g.set('I3', 'Litri (fără primul plin)'); g.set('J3', `=SUM(C3:C${last})`);
  g.set('I4', 'Consum mediu (l / 100 km)', { b: true }); g.set('J4', `=IF(J2=0;"";ROUND(J3/J2*100;2))`, { b: true });
  g.set('I5', 'Cost total'); g.set('J5', `=SUM(E2:E${last})`, LEI);
  g.set('I6', 'Cost pe km'); g.set('J6', `=IF(J2=0;"";ROUND(SUM(E3:E${last})/J2;2))`, LEI);
  g.set('I8', 'Fă de fiecare dată plinul; primul rând e plinul de pornire.', { i: true, color: '#666666' });
  g.widths({ A: 95, B: 100, C: 70, D: 95, E: 95, F: 100, G: 140, H: 30, I: 200, J: 110 });
  return doc('Consum carburant', g.sheet('Carburant'));
}

// Abonamente: ce servicii plătești (telefon, internet, streaming, sală, asigurări), cât te costă pe lună și pe an și când e
// următoarea plată, calculată din data primei plăți și din cât de des se plătește; plățile din următoarele 7 zile ies în roșu.
function abonamente(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Serviciu', 'Categorie', 'Preț', 'Se plătește', 'Prima plată', 'Următoarea plată', 'Zile rămase', 'Cost pe lună', 'Cost pe an', 'Activ']);
  for (let r = 2; r <= last; r++) {
    const m = `IF(D${r}="Lunar";1;IF(D${r}="Trimestrial";3;IF(D${r}="Semestrial";6;12)))`;
    const on = `AND(C${r}<>"";D${r}<>"";J${r}<>"Nu")`;
    // Următoarea plată: prima plată dacă n-a trecut; altfel prima plată + un număr întreg de perioade, cel puțin azi.
    const k = `ROUNDUP(DATEDIF(E${r};TODAY();"m")/${m};0)*${m}`;
    g.set(`F${r}`, `=IF(OR(E${r}="";D${r}="";J${r}="Nu");"";IF(E${r}>=TODAY();E${r};IF(EDATE(E${r};${k})>=TODAY();EDATE(E${r};${k});EDATE(E${r};${k}+${m}))))`);
    g.set(`G${r}`, `=IF(F${r}="";"";F${r}-TODAY())`);
    g.set(`H${r}`, `=IF(${on};ROUND(C${r}/${m};2);"")`);
    g.set(`I${r}`, `=IF(${on};ROUND(C${r}*12/${m};2);"")`);
  }
  g.col('C', 2, last, LEI);
  g.col('E', 2, last, DATE);
  g.col('F', 2, last, DATE);
  g.col('G', 2, last, { align: 'center' });
  g.col('H', 2, last, LEI);
  g.col('I', 2, last, LEI);
  g.col('J', 2, last, { align: 'center' });
  g.box(`A1:J${last}`, 'all');
  g.lists.push(
    { range: `B2:B${last}`, values: ['Telefon și internet', 'Televiziune și streaming', 'Muzică', 'Programe și cloud', 'Sport și sănătate', 'Asigurări', 'Presă și cursuri', 'Altele'] },
    { range: `D2:D${last}`, values: ['Lunar', 'Trimestrial', 'Semestrial', 'Anual'] },
    { range: `J2:J${last}`, values: ['Da', 'Nu'] },
  );
  g.rules.push({ range: `G2:G${last}`, op: 'between', v1: '0', v2: '7', look: 'red' }, { range: `J2:J${last}`, op: 'eq', v1: 'Nu', look: 'yellow' });
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Abonamente active'); g.set('M2', `=COUNTIF(H2:H${last};">0")`);
  g.set('L3', 'Cost pe lună', { b: true }); g.set('M3', `=SUM(H2:H${last})`, { ...LEI, b: true });
  g.set('L4', 'Cost pe an', { b: true }); g.set('M4', `=SUM(I2:I${last})`, { ...LEI, b: true, color: '#c00000' });
  g.set('L5', 'De plătit în 7 zile'); g.set('M5', `=COUNTIFS(G2:G${last};">=0";G2:G${last};"<=7")`);
  g.set('L7', 'La „Activ” alege Nu pentru un abonament oprit: rămâne în listă, dar nu se mai adună.', { i: true, color: '#666666' });
  g.widths({ A: 170, B: 170, C: 90, D: 95, E: 95, F: 120, G: 90, H: 100, I: 100, J: 60, K: 30, L: 170, M: 110 });
  return doc('Abonamente', g.sheet('Abonamente'));
}

// Acte și scadențe: actele care expiră (ITP, RCA, rovinieta, buletinul, pașaportul, permisul, extinctorul), cu zilele rămase
// și starea calculată; ce a expirat iese în roșu, ce expiră în 30 de zile în galben.
function scadente(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Actul', 'Pentru', 'Emis la', 'Valabil până la', 'Zile rămase', 'Starea', 'Cost', 'Unde se reînnoiește']);
  for (let r = 2; r <= last; r++) {
    g.set(`E${r}`, `=IF(D${r}="";"";D${r}-TODAY())`);
    g.set(`F${r}`, `=IF(E${r}="";"";IF(E${r}<0;"Expirat";IF(E${r}<=30;"Expiră curând";"Valabil")))`);
  }
  g.col('C', 2, last, DATE);
  g.col('D', 2, last, DATE);
  g.col('E', 2, last, { align: 'center' });
  g.col('F', 2, last, { align: 'center' });
  g.col('G', 2, last, LEI);
  g.box(`A1:H${last}`, 'all');
  g.lists.push({ range: `A2:A${last}`, values: ['ITP', 'RCA', 'CASCO', 'Rovinieta', 'Revizie auto', 'Carte de identitate', 'Pașaport', 'Permis de conducere', 'Asigurarea locuinței (PAD)', 'Verificarea centralei', 'Extinctor', 'Trusa medicală auto', 'Altul'] });
  g.rules.push(
    { range: `F2:F${last}`, op: 'eq', v1: 'Expirat', look: 'red' },
    { range: `F2:F${last}`, op: 'eq', v1: 'Expiră curând', look: 'yellow' },
    { range: `F2:F${last}`, op: 'eq', v1: 'Valabil', look: 'green' },
  );
  g.set('J1', 'Pe scurt', HEAD); g.set('K1', '', HEAD);
  g.set('J2', 'Acte în listă'); g.set('K2', `=COUNTIF(D2:D${last};">0")`);
  g.set('J3', 'Expirate', { b: true, color: '#c00000' }); g.set('K3', `=COUNTIF(F2:F${last};"Expirat")`, { b: true, color: '#c00000' });
  g.set('J4', 'Expiră în 30 de zile', { b: true }); g.set('K4', `=COUNTIF(F2:F${last};"Expiră curând")`, { b: true });
  g.set('J5', 'Următoarea scadență'); g.set('K5', `=IF(COUNTIF(E2:E${last};">=0")=0;"";MINIFS(D2:D${last};E2:E${last};">=0"))`, DATE);
  g.set('J6', 'Costul tuturor reînnoirilor'); g.set('K6', `=SUM(G2:G${last})`, LEI);
  g.set('J8', 'Scrie data până la care e valabil actul; zilele rămase și starea se calculează singure.', { i: true, color: '#666666' });
  g.widths({ A: 190, B: 150, C: 95, D: 120, E: 90, F: 110, G: 90, H: 190, I: 30, J: 190, K: 110 });
  return doc('Acte și scadențe', g.sheet('Scadențe'));
}

// Împărțirea cheltuielilor (o excursie, o casă de vacanță, un cadou comun): cine a plătit ce; pentru fiecare persoană ies
// cât a plătit, partea ei egală și cât are de primit (verde) sau de dat (roșu).
function impartire(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Data', 'Ce s-a plătit', 'Cine a plătit', 'Suma']);
  g.col('A', 2, last, DATE);
  g.col('D', 2, last, LEI);
  g.box(`A1:D${last}`, 'all');
  ['Persoana', 'A plătit', 'Partea lui', 'De primit / de dat'].forEach((h, i) => g.set(`${'FGHI'[i]}1`, h, HEAD));
  for (let r = 2; r <= 9; r++) {
    g.set(`G${r}`, `=IF(F${r}="";"";SUMIF(C$2:C${last};F${r};D$2:D${last}))`, LEI);
    g.set(`H${r}`, `=IF(F${r}="";"";$G$12)`, LEI);
    g.set(`I${r}`, `=IF(F${r}="";"";G${r}-H${r})`, { ...LEI, b: true });
  }
  g.box('F1:I9', 'all');
  g.rules.push({ range: 'I2:I9', op: 'lt', v1: '0', look: 'red' }, { range: 'I2:I9', op: 'gt', v1: '0', look: 'green' });
  g.set('F11', 'Total cheltuit', { b: true }); g.set('G11', `=SUM(D2:D${last})`, { ...LEI, b: true });
  g.set('F12', 'Pe persoană'); g.set('G12', '=IF(COUNTA(F2:F9)=0;"";ROUND(G11/COUNTA(F2:F9);2))', LEI);
  g.set('F13', 'Plătit de cineva din afara listei'); g.set('G13', '=G11-SUM(G2:G9)', LEI);
  g.set('F15', 'Scrie numele în coloana Persoana, exact ca în coloana Cine a plătit. Plus = are de primit, minus = are de dat.', { i: true, color: '#666666' });
  g.widths({ A: 95, B: 210, C: 130, D: 95, E: 30, F: 190, G: 100, H: 100, I: 130 });
  return doc('Împărțirea cheltuielilor', g.sheet('Cheltuieli comune'));
}

// Foaie de parcurs: fiecare drum cu mașina (de unde, până unde, de ce, kilometrii de la bord); ies km parcurși,
// totalul pe serviciu și personal, procentul de serviciu și cât costă drumurile de serviciu la un cost pe km ales.
function parcurs(): SheetDoc {
  const g = new Grid();
  const last = 201;
  g.head(1, ['Data', 'Traseul (de la – până la)', 'Scopul deplasării', 'Km la plecare', 'Km la sosire', 'Km parcurși', 'Tipul']);
  for (let r = 2; r <= last; r++) g.set(`F${r}`, `=IF(OR(D${r}="";E${r}="");"";E${r}-D${r})`);
  g.col('A', 2, last, DATE);
  g.box(`A1:G${last}`, 'all');
  g.lists.push({ range: `G2:G${last}`, values: ['Serviciu', 'Personal'] });
  g.rules.push({ range: `F2:F${last}`, op: 'lt', v1: '0', look: 'red' });
  g.set('I1', 'Pe scurt', HEAD); g.set('J1', '', HEAD);
  g.set('I2', 'Km în total'); g.set('J2', `=SUM(F2:F${last})`);
  g.set('I3', 'Km de serviciu', { b: true }); g.set('J3', `=SUMIF(G2:G${last};"Serviciu";F2:F${last})`, { b: true });
  g.set('I4', 'Km personali'); g.set('J4', `=SUMIF(G2:G${last};"Personal";F2:F${last})`);
  g.set('I5', 'Partea de serviciu'); g.set('J5', '=IF(J2=0;"";ROUND(J3/J2;4))', PCT);
  g.set('I6', 'Cost pe km'); g.set('J6', '1,5', { ...LEI, bg: '#fff59d' });
  g.set('I7', 'Costul drumurilor de serviciu', { b: true }); g.set('J7', '=ROUND(J3*J6;2)', { ...LEI, b: true });
  g.set('I9', 'Alege la Tipul: Serviciu sau Personal. Costul pe km îl schimbi tu; km negativi ies în roșu.', { i: true, color: '#666666' });
  g.widths({ A: 95, B: 220, C: 200, D: 105, E: 105, F: 95, G: 90, H: 30, I: 210, J: 110 });
  return doc('Foaie de parcurs', g.sheet('Parcurs'));
}

// Note școlare: notele pe materii; ies media fiecărei materii (cu două zecimale și rotunjită), media generală și
// materiile sub 5 (în roșu), ca să vezi din timp unde trebuie să mai înveți.
function note(): SheetDoc {
  const g = new Grid();
  const subjects = ['Limba și literatura română', 'Matematică', 'Limba engleză', 'Istorie', 'Geografie', 'Biologie', 'Fizică', 'Chimie', 'Educație fizică', 'Religie'];
  const last = 16;
  g.head(1, ['Materia', 'Nota 1', 'Nota 2', 'Nota 3', 'Nota 4', 'Nota 5', 'Nota 6', 'Media', 'Media rotunjită']);
  subjects.forEach((m, i) => g.set(`A${i + 2}`, m));
  for (let r = 2; r <= last; r++) {
    g.set(`H${r}`, `=IF(COUNT(B${r}:G${r})=0;"";ROUND(AVERAGE(B${r}:G${r});2))`);
    g.set(`I${r}`, `=IF(H${r}="";"";ROUND(H${r};0))`, { b: true, align: 'center' });
  }
  for (const c of 'BCDEFG') g.col(c, 2, last, { align: 'center' });
  g.box(`A1:I${last}`, 'all');
  g.lists.push({ range: `B2:G${last}`, values: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] });
  g.rules.push({ range: `I2:I${last}`, op: 'lt', v1: '5', look: 'red' }, { range: `H2:H${last}`, op: 'lt', v1: '5', look: 'red' });
  const t = last + 2;
  g.set(`A${t}`, 'Media generală', TOTAL); g.set(`I${t}`, `=IF(COUNT(I2:I${last})=0;"";ROUND(AVERAGE(I2:I${last});2))`, { ...TOTAL, align: 'center' });
  g.set(`A${t + 1}`, 'Materii sub 5'); g.set(`I${t + 1}`, `=COUNTIF(I2:I${last};"<5")`, { align: 'center' });
  g.set(`A${t + 3}`, 'Scrie notele de la 1 la 10; media generală se face din mediile rotunjite. Rândurile goale de jos sunt pentru alte materii.', { i: true, color: '#666666' });
  g.widths({ A: 230, B: 70, C: 70, D: 70, E: 70, F: 70, G: 70, H: 80, I: 120 });
  return doc('Note școlare', g.sheet('Note'));
}

// Factură românească: din ea ies fișierul e-Factura (XML pentru SPV) și PDF-ul pentru client (invoiceSheet.ts).
function factura(): SheetDoc {
  return doc('Factură', { ...emptySheet('Factură'), ...invoiceCells() });
}

// Listă de invitați (nuntă, botez, aniversare): cine a confirmat, câți adulți și copii vin, la ce masă stau și cât costă
// mesele; cei care au confirmat ies în verde, cei care au refuzat în roșu, cei fără răspuns în galben.
function invitati(): SheetDoc {
  const g = new Grid();
  const last = 201;
  g.head(1, ['Nume', 'Telefon', 'Din partea', 'Invitație trimisă', 'Răspuns', 'Adulți', 'Copii', 'Persoane', 'Masa', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`H${r}`, `=IF(OR(A${r}="";E${r}="Nu");"";IF(F${r}="";1;F${r})+N(G${r}))`);
  }
  for (const c of 'DEFGHI') g.col(c, 2, last, { align: 'center' });
  g.box(`A1:J${last}`, 'all');
  g.lists.push(
    { range: `C2:C${last}`, values: ['Familie', 'Prieteni', 'Colegi', 'Vecini', 'Altele'] },
    { range: `D2:D${last}`, values: ['Da', 'Nu'] },
    { range: `E2:E${last}`, values: ['Da', 'Nu', 'Poate', 'Fără răspuns'] },
  );
  g.rules.push(
    { range: `E2:E${last}`, op: 'eq', v1: 'Da', look: 'green' },
    { range: `E2:E${last}`, op: 'eq', v1: 'Fără răspuns', look: 'yellow' },
    { range: `E2:E${last}`, op: 'eq', v1: 'Nu', look: 'red' },
  );
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Invitați pe listă'); g.set('M2', `=COUNTA(A2:A${last})`);
  g.set('L3', 'Persoane confirmate', { b: true }); g.set('M3', `=SUMIF(E2:E${last};"Da";H2:H${last})`, { b: true });
  g.set('L4', 'din care copii'); g.set('M4', `=SUMIF(E2:E${last};"Da";G2:G${last})`);
  g.set('L5', 'Poate / fără răspuns (persoane)'); g.set('M5', `=SUMIF(E2:E${last};"Poate";H2:H${last})+SUMIF(E2:E${last};"Fără răspuns";H2:H${last})`);
  g.set('L6', 'Au refuzat'); g.set('M6', `=COUNTIF(E2:E${last};"Nu")`);
  g.set('L7', 'Invitații netrimise'); g.set('M7', `=COUNTIFS(A2:A${last};"<>";D2:D${last};"<>Da")`);
  g.set('L9', 'Preț meniu adult (îl scrii aici)'); g.set('M9', '0', { ...LEI, b: true, bg: '#fff59d' });
  g.set('L10', 'Preț meniu copil'); g.set('M10', '0', { ...LEI, b: true, bg: '#fff59d' });
  g.set('L11', 'Cost mese (confirmați)', { b: true }); g.set('M11', '=(M3-M4)*M9+M4*M10', { ...LEI, b: true, color: '#c00000' });
  g.set('L13', 'La „Adulți” scrie câte persoane mari vin (gol = 1). Cei cu „Nu” la răspuns nu se mai numără.', { i: true, color: '#666666' });
  g.widths({ A: 200, B: 110, C: 100, D: 110, E: 110, F: 60, G: 60, H: 80, I: 60, J: 200, K: 30, L: 220, M: 110 });
  return doc('Listă de invitați', g.sheet('Invitați'));
}

// Revizii și reparații auto: fiecare vizită la service (data, km, ce s-a făcut, piese și manoperă); ies cât ai dat în total
// și anul acesta, la ce km a fost ultimul schimb de ulei, la ce km vine următorul și câți km mai ai (roșu sub 1000).
function revizii(): SheetDoc {
  const g = new Grid();
  const last = 151;
  g.head(1, ['Data', 'Km la bord', 'Ce s-a făcut', 'Service-ul', 'Piese', 'Manopera', 'Total', 'Observații']);
  for (let r = 2; r <= last; r++) g.set(`G${r}`, `=IF(AND(E${r}="";F${r}="");"";N(E${r})+N(F${r}))`);
  g.col('A', 2, last, DATE);
  for (const c of 'EFG') g.col(c, 2, last, LEI);
  g.box(`A1:H${last}`, 'all');
  g.lists.push({ range: `C2:C${last}`, values: ['Schimb ulei și filtre', 'Revizie completă', 'Distribuție', 'Frâne', 'Anvelope', 'Baterie', 'ITP', 'Caroserie', 'Altele'] });
  g.set('J1', 'Pe scurt', HEAD); g.set('K1', '', HEAD);
  g.set('J2', 'Cheltuieli în total', { b: true }); g.set('K2', `=SUM(G2:G${last})`, { ...LEI, b: true });
  g.set('J3', 'Cheltuieli anul acesta'); g.set('K3', `=SUMIFS(G2:G${last};A2:A${last};">="&DATE(YEAR(TODAY());1;1);A2:A${last};"<"&DATE(YEAR(TODAY())+1;1;1))`, LEI);
  g.set('J4', 'Vizite la service'); g.set('K4', `=COUNT(G2:G${last})`);
  g.set('J6', 'Km acum (îi scrii de la bord)'); g.set('K6', '', { b: true, bg: '#fff59d' });
  g.set('J7', 'Schimb de ulei la fiecare (km)'); g.set('K7', '15000', { bg: '#fff59d' });
  g.set('J8', 'Ultimul schimb de ulei la km'); g.set('K8', `=MAX(MAXIFS(B2:B${last};C2:C${last};"Schimb ulei și filtre");MAXIFS(B2:B${last};C2:C${last};"Revizie completă"))`);
  g.set('J9', 'Următorul schimb de ulei la km', { b: true }); g.set('K9', '=IF(K8=0;"";K8+K7)', { b: true });
  g.set('J10', 'Km rămași până atunci', { b: true }); g.set('K10', '=IF(OR(K6="";K9="");"";K9-K6)', { b: true });
  g.rules.push({ range: 'K10', op: 'lt', v1: '1000', look: 'red' });
  g.set('J12', 'Alege din listă ce s-a făcut; „Schimb ulei și filtre” și „Revizie completă” mută următorul schimb de ulei. Sub 1000 km rămași iese în roșu.', { i: true, color: '#666666' });
  g.widths({ A: 95, B: 95, C: 170, D: 160, E: 95, F: 95, G: 100, H: 200, I: 30, J: 230, K: 110 });
  return doc('Revizii și reparații auto', g.sheet('Service'));
}

// Evidența chiriilor (pentru cine dă o locuință cu chirie): pe fiecare lună chiria, utilitățile refacturate, cât s-a încasat
// și când; ies restul de plată, starea (Plătit / Parțial / Neplătit), restanțele și un impozit estimat la un procent ales.
function chirii(): SheetDoc {
  const g = new Grid();
  const last = 121;
  g.head(1, ['Luna', 'Chiriașul / locuința', 'Chiria', 'Utilități', 'De plată', 'Încasat', 'Data încasării', 'Rest de plată', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`E${r}`, `=IF(AND(C${r}="";D${r}="");"";N(C${r})+N(D${r}))`);
    g.set(`H${r}`, `=IF(E${r}="";"";E${r}-N(F${r}))`);
    g.set(`I${r}`, `=IF(E${r}="";"";IF(H${r}<=0;"Plătit";IF(N(F${r})>0;"Parțial";"Neplătit")))`, { align: 'center' });
  }
  g.col('A', 2, last, { fmt: 'date', align: 'center' });
  g.col('G', 2, last, DATE);
  for (const c of 'CDEFH') g.col(c, 2, last, LEI);
  g.box(`A1:I${last}`, 'all');
  g.rules.push(
    { range: `I2:I${last}`, op: 'eq', v1: 'Plătit', look: 'green' },
    { range: `I2:I${last}`, op: 'eq', v1: 'Parțial', look: 'yellow' },
    { range: `I2:I${last}`, op: 'eq', v1: 'Neplătit', look: 'red' },
  );
  g.set('K1', 'Pe scurt', HEAD); g.set('L1', '', HEAD);
  g.set('K2', 'De încasat în total'); g.set('L2', `=SUM(E2:E${last})`, LEI);
  g.set('K3', 'Încasat'); g.set('L3', `=SUM(F2:F${last})`, LEI);
  g.set('K4', 'Restanțe', { b: true, color: '#c00000' }); g.set('L4', `=SUMIF(H2:H${last};">0")`, { ...LEI, b: true, color: '#c00000' });
  g.set('K5', 'Luni neplătite sau parțiale'); g.set('L5', `=COUNTIF(I2:I${last};"Neplătit")+COUNTIF(I2:I${last};"Parțial")`);
  g.set('K7', 'Chirii (fără utilități)'); g.set('L7', `=SUM(C2:C${last})`, LEI);
  g.set('K8', 'Procent impozit (verifică-l la ANAF)'); g.set('L8', '0,1', { ...PCT, bg: '#fff59d' });
  g.set('K9', 'Impozit estimat', { b: true }); g.set('L9', '=ROUND(L7*L8;0)', { ...LEI, b: true });
  g.set('K11', 'Un rând pe lună. Utilitățile sunt cele pe care chiriașul ți le dă înapoi; impozitul e doar o estimare pe chirii.', { i: true, color: '#666666' });
  g.widths({ A: 95, B: 200, C: 95, D: 95, E: 100, F: 100, G: 110, H: 110, I: 90, J: 30, K: 240, L: 110 });
  return doc('Evidența chiriilor', g.sheet('Chirii'));
}

// Citiri contoare (curent, gaz, apă): o dată pe lună indexul de pe fiecare contor; consumul e diferența față de luna trecută,
// costul se estimează cu prețurile din dreapta, iar lunile cu peste 20% peste costul mediu ies în roșu.
function contoare(): SheetDoc {
  const g = new Grid();
  const last = 61;
  g.head(1, ['Luna', 'Index curent', 'Curent (kWh)', 'Index gaz', 'Gaz (m³)', 'Index apă', 'Apă (m³)', 'Cost estimat']);
  for (let r = 3; r <= last; r++) {
    for (const [i, c] of [['B', 'C'], ['D', 'E'], ['F', 'G']]) g.set(`${c}${r}`, `=IF(OR(${i}${r}="";${i}${r - 1}="");"";${i}${r}-${i}${r - 1})`);
  }
  for (let r = 2; r <= last; r++) {
    g.set(`H${r}`, `=IF(AND(C${r}="";E${r}="";G${r}="");"";ROUND(N(C${r})*$L$3+N(E${r})*$L$4+N(G${r})*$L$5;2))`);
  }
  g.col('A', 2, last, { fmt: 'date', align: 'center' });
  g.col('H', 2, last, LEI);
  for (const c of 'CEG') g.col(c, 2, last, { bg: '#f3f6fa' });
  g.box(`A1:H${last}`, 'all');
  g.rules.push({ range: `H2:H${last}`, op: 'formula', v1: '=AND(H2<>"";$L$12<>"";H2>$L$12*6/5)', look: 'red' });
  g.set('K1', 'Pe scurt', HEAD); g.set('L1', '', HEAD);
  g.set('K2', 'Prețuri pe unitate (lei, cu TVA)', { b: true });
  g.set('K3', 'Curent (lei / kWh)'); g.set('L3', '1,3', { bg: '#fff59d' });
  g.set('K4', 'Gaz (lei / m³)'); g.set('L4', '3,3', { bg: '#fff59d' });
  g.set('K5', 'Apă și canal (lei / m³)'); g.set('L5', '8', { bg: '#fff59d' });
  g.set('K7', 'Curent consumat (kWh)'); g.set('L7', `=SUM(C2:C${last})`);
  g.set('K8', 'Gaz consumat (m³)'); g.set('L8', `=SUM(E2:E${last})`);
  g.set('K9', 'Apă consumată (m³)'); g.set('L9', `=SUM(G2:G${last})`);
  g.set('K11', 'Cost total', { b: true }); g.set('L11', `=SUM(H2:H${last})`, { ...LEI, b: true });
  g.set('K12', 'Cost mediu pe lună'); g.set('L12', `=IF(COUNT(H2:H${last})=0;"";ROUND(AVERAGE(H2:H${last});2))`, LEI);
  g.set('K14', 'Scrie o dată pe lună indexul de pe fiecare contor; consumul e diferența față de luna trecută.', { i: true, color: '#666666' });
  g.set('K15', 'Lunile cu costul cu peste 20% mai mare decât media ies în roșu. Prețurile din celulele galbene le iei de pe factură.', { i: true, color: '#666666' });
  g.widths({ A: 95, B: 105, C: 100, D: 95, E: 85, F: 95, G: 85, H: 110, I: 20, J: 20, K: 260, L: 100 });
  return doc('Citiri contoare', g.sheet('Contoare'));
}

// Medicamente acasă: câte pastile iei pe zi și câte mai ai; ies zilele rămase, data la care se termină și starea
// (Expirat în roșu, De cumpărat în galben cu 7 zile înainte, OK în verde).
function medicamente(): SheetDoc {
  const g = new Grid();
  const last = 41;
  g.head(1, ['Medicamentul', 'Pentru ce / cine', 'Doza și când', 'Pastile pe zi', 'Pastile rămase', 'Zile rămase', 'Se termină pe', 'Expiră pe', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`F${r}`, `=IF(OR(D${r}="";E${r}="");"";IF(N(D${r})<=0;"";INT(N(E${r})/N(D${r}))))`, { align: 'center' });
    g.set(`G${r}`, `=IF(F${r}="";"";TODAY()+F${r})`);
    g.set(`I${r}`, `=IF(A${r}="";"";IF(AND(H${r}<>"";H${r}<TODAY());"Expirat";IF(AND(F${r}<>"";F${r}<=7);"De cumpărat";"OK")))`, { align: 'center' });
  }
  for (const c of 'GH') g.col(c, 2, last, DATE);
  for (const c of 'DE') g.col(c, 2, last, { align: 'center' });
  g.box(`A1:I${last}`, 'all');
  g.rules.push(
    { range: `I2:I${last}`, op: 'eq', v1: 'Expirat', look: 'red' },
    { range: `I2:I${last}`, op: 'eq', v1: 'De cumpărat', look: 'yellow' },
    { range: `I2:I${last}`, op: 'eq', v1: 'OK', look: 'green' },
  );
  g.set('K1', 'Pe scurt', HEAD); g.set('L1', '', HEAD);
  g.set('K2', 'De cumpărat (ajung cel mult 7 zile)'); g.set('L2', `=COUNTIF(I2:I${last};"De cumpărat")`, { align: 'center' });
  g.set('K3', 'Expirate (de aruncat la farmacie)', { color: '#c00000' }); g.set('L3', `=COUNTIF(I2:I${last};"Expirat")`, { align: 'center', color: '#c00000', b: true });
  g.set('K4', 'Cel mai repede se termină pe'); g.set('L4', `=IF(COUNT(G2:G${last})=0;"";MIN(G2:G${last}))`, DATE);
  g.set('K6', 'Scrie în fiecare săptămână câte pastile mai ai; restul se calculează singur.', { i: true, color: '#666666' });
  g.set('K7', 'Tabelul nu înlocuiește sfatul medicului sau al farmacistului.', { i: true, color: '#666666' });
  g.widths({ A: 170, B: 150, C: 170, D: 90, E: 100, F: 90, G: 110, H: 100, I: 105, J: 30, K: 250, L: 100 });
  return doc('Medicamente', g.sheet('Medicamente'));
}

// Garanții: ce ai cumpărat, când și pe câte luni e garanția; ies data la care expiră, zilele rămase și starea
// (Expirată în roșu, Expiră curând în galben cu 30 de zile înainte, În garanție în verde).
function garantii(): SheetDoc {
  const g = new Grid();
  const last = 41;
  g.head(1, ['Produsul', 'Magazinul', 'Cumpărat pe', 'Preț (lei)', 'Garanție (luni)', 'Expiră pe', 'Zile rămase', 'Starea', 'Unde e bonul']);
  for (let r = 2; r <= last; r++) {
    g.set(`F${r}`, `=IF(OR(C${r}="";E${r}="");"";EDATE(C${r};E${r}))`);
    g.set(`G${r}`, `=IF(F${r}="";"";F${r}-TODAY())`, { align: 'center' });
    g.set(`H${r}`, `=IF(A${r}="";"";IF(G${r}="";"";IF(G${r}<0;"Expirată";IF(G${r}<=30;"Expiră curând";"În garanție"))))`, { align: 'center' });
  }
  for (const c of 'CF') g.col(c, 2, last, DATE);
  g.col('D', 2, last, LEI);
  g.col('E', 2, last, { align: 'center' });
  g.box(`A1:I${last}`, 'all');
  g.rules.push(
    { range: `H2:H${last}`, op: 'eq', v1: 'Expirată', look: 'red' },
    { range: `H2:H${last}`, op: 'eq', v1: 'Expiră curând', look: 'yellow' },
    { range: `H2:H${last}`, op: 'eq', v1: 'În garanție', look: 'green' },
  );
  g.set('K1', 'Pe scurt', HEAD); g.set('L1', '', HEAD);
  g.set('K2', 'Produse în garanție'); g.set('L2', `=COUNTIF(H2:H${last};"În garanție")+COUNTIF(H2:H${last};"Expiră curând")`, { align: 'center' });
  g.set('K3', 'Valoarea lor'); g.set('L3', `=SUMIF(H2:H${last};"În garanție";D2:D${last})+SUMIF(H2:H${last};"Expiră curând";D2:D${last})`, LEI);
  g.set('K4', 'Expiră în următoarele 30 de zile', { color: '#9c5700' }); g.set('L4', `=COUNTIF(H2:H${last};"Expiră curând")`, { align: 'center', b: true });
  g.set('K6', 'Păstrează bonul și certificatul de garanție: fără ele reclamația e mai grea.', { i: true, color: '#666666' });
  g.set('K7', 'La produsele noi, vânzătorul răspunde pentru defecte cel puțin 2 ani (garanția legală).', { i: true, color: '#666666' });
  g.widths({ A: 180, B: 140, C: 105, D: 95, E: 105, F: 105, G: 90, H: 115, I: 160, J: 30, K: 260, L: 110 });
  return doc('Garanții', g.sheet('Garanții'));
}

// Împrumuturi între prieteni sau rude: cui ai dat și de la cine ai luat bani, cât s-a dat înapoi; ies restul, starea
// (Achitat în verde, Întârziat în roșu după scadență, În curs) și cât ai de primit și de dat în total.
function imprumuturi(): SheetDoc {
  const g = new Grid();
  const last = 41;
  g.head(1, ['Persoana', 'Dat sau primit', 'Suma (lei)', 'Data', 'Scadența', 'Returnat (lei)', 'Rămas (lei)', 'Starea', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`G${r}`, `=IF(C${r}="";"";C${r}-N(F${r}))`, LEI);
    g.set(`H${r}`, `=IF(OR(A${r}="";C${r}="");"";IF(G${r}<=0;"Achitat";IF(AND(E${r}<>"";E${r}<TODAY());"Întârziat";"În curs")))`, { align: 'center' });
  }
  for (const c of 'DE') g.col(c, 2, last, DATE);
  for (const c of 'CF') g.col(c, 2, last, LEI);
  g.col('B', 2, last, { align: 'center' });
  g.lists.push({ range: `B2:B${last}`, values: ['Dat', 'Primit'] });
  g.box(`A1:I${last}`, 'all');
  g.rules.push(
    { range: `H2:H${last}`, op: 'eq', v1: 'Întârziat', look: 'red' },
    { range: `H2:H${last}`, op: 'eq', v1: 'Achitat', look: 'green' },
  );
  g.set('K1', 'Pe scurt', HEAD); g.set('L1', '', HEAD);
  g.set('K2', 'Am de primit (ce am dat)'); g.set('L2', `=SUMIF(B2:B${last};"Dat";G2:G${last})`, LEI);
  g.set('K3', 'Am de dat (ce am primit)'); g.set('L3', `=SUMIF(B2:B${last};"Primit";G2:G${last})`, LEI);
  g.set('K4', 'Împrumuturi întârziate', { color: '#c00000' }); g.set('L4', `=COUNTIF(H2:H${last};"Întârziat")`, { align: 'center', color: '#c00000', b: true });
  g.set('K6', 'Alege în coloana B „Dat” (ai dat tu bani) sau „Primit” (ți s-au dat ție).', { i: true, color: '#666666' });
  g.set('K7', 'La sume mari, un contract de împrumut scris (Docs → Din șablon…) vă ferește de neînțelegeri.', { i: true, color: '#666666' });
  g.widths({ A: 170, B: 110, C: 100, D: 100, E: 100, F: 110, G: 100, H: 100, I: 170, J: 30, K: 270, L: 110 });
  return doc('Împrumuturi', g.sheet('Împrumuturi'));
}

// Bugetul nunții: fiecare cheltuială cu furnizorul, cât e estimat, prețul din contract și avansul dat; ies restul de plată,
// starea (Plătit în verde, Avans, Neplătit în galben), cât ați depășit estimarea și totalurile, cu darul estimat de la invitați.
function bugetNunta(): SheetDoc {
  const g = new Grid();
  const last = 31;
  g.head(1, ['Cheltuiala', 'Furnizorul', 'Estimat (lei)', 'Contract (lei)', 'Plătit (lei)', 'Rest de plată (lei)', 'Starea', 'Termen de plată', 'Observații']);
  ['Restaurant (meniu × invitați)', 'Formația / DJ', 'Fotograf și video', 'Rochia de mireasă', 'Costumul mirelui', 'Verighetele',
    'Aranjamente florale', 'Tortul', 'Invitațiile și mărturiile', 'Biserica și cununia civilă', 'Cadoul pentru nași', 'Mașina mirilor',
    'Coafura și machiajul', 'Luna de miere'].forEach((n, i) => g.set(`A${2 + i}`, n));
  for (let r = 2; r <= last; r++) {
    g.set(`F${r}`, `=IF(D${r}="";"";D${r}-N(E${r}))`, LEI);
    g.set(`G${r}`, `=IF(D${r}="";"";IF(F${r}<=0;"Plătit";IF(N(E${r})>0;"Avans";"Neplătit")))`, { align: 'center' });
  }
  for (const c of 'CDEF') g.col(c, 2, last, LEI);
  g.col('H', 2, last, DATE);
  g.box(`A1:I${last}`, 'all');
  g.rules.push(
    { range: `G2:G${last}`, op: 'eq', v1: 'Plătit', look: 'green' },
    { range: `G2:G${last}`, op: 'eq', v1: 'Neplătit', look: 'yellow' },
  );
  g.set('K1', 'Pe scurt', HEAD); g.set('L1', '', HEAD);
  g.set('K2', 'Total estimat'); g.set('L2', `=SUM(C2:C${last})`, LEI);
  g.set('K3', 'Total din contracte'); g.set('L3', `=SUM(D2:D${last})`, LEI);
  g.set('K4', 'Plătit până acum'); g.set('L4', `=SUM(E2:E${last})`, LEI);
  g.set('K5', 'Rest de plată', { b: true }); g.set('L5', `=SUM(F2:F${last})`, { ...LEI, b: true });
  g.set('K6', 'Peste estimare'); g.set('L6', `=MAX(0;L3-SUMIF(D2:D${last};"<>";C2:C${last}))`, LEI);
  g.set('K8', 'Invitați (adulți)'); g.set('L8', '', { align: 'center' });
  g.set('K9', 'Darul estimat de persoană (lei)'); g.set('L9', '', LEI);
  g.set('K10', 'Darul estimat în total', { b: true }); g.set('L10', '=N(L8)*N(L9)', { ...LEI, b: true });
  g.set('K11', 'Diferența (dar − contracte)', { b: true }); g.set('L11', '=L10-L3', { ...LEI, b: true });
  g.rules.push({ range: 'L6', op: 'gt', v1: '0', look: 'red' }, { range: 'L11', op: 'lt', v1: '0', look: 'red' }, { range: 'L11', op: 'gt', v1: '0', look: 'green' });
  g.set('K13', 'Câți invitați vin aflați din Șabloane → Listă de invitați.', { i: true, color: '#666666' });
  g.set('K14', '„Peste estimare” compară doar cheltuielile care au deja contract.', { i: true, color: '#666666' });
  g.widths({ A: 220, B: 150, C: 100, D: 105, E: 95, F: 120, G: 90, H: 115, I: 160, J: 30, K: 240, L: 110 });
  return doc('Bugetul nunții', g.sheet('Bugetul nunții'));
}

// Bugetul sărbătorilor: cadourile, masa, decorul și ieșirile, cu bugetul pe categorii și ce mai e de cumpărat.
function bugetSarbatori(): SheetDoc {
  const g = new Grid();
  const last = 31;
  const cats = ['Cadouri', 'Masa', 'Decor', 'Ieșiri', 'Altele'];
  g.head(1, ['Pentru cine / ce', 'Categoria', 'Ce cumpăr', 'Buget (lei)', 'Cost real (lei)', 'Diferența (lei)', 'Cumpărat', 'Unde / observații']);
  ([['Mama', 0], ['Tata', 0], ['Copiii', 0], ['Nașii', 0], ['Colegii', 0], ['Masa de Ajun', 1], ['Masa de Crăciun', 1], ['Bradul și ornamentele', 2],
    ['Luminițele', 2], ['Revelionul', 3], ['Felicitările', 4]] as [string, number][]).forEach(([n, c], i) => {
    g.set(`A${2 + i}`, n);
    g.set(`B${2 + i}`, cats[c]);
  });
  for (let r = 2; r <= last; r++) {
    g.set(`F${r}`, `=IF(AND(D${r}="";E${r}="");"";N(D${r})-N(E${r}))`, LEI);
  }
  for (const c of 'DEF') g.col(c, 2, last, LEI);
  g.col('G', 2, last, { align: 'center' });
  g.box(`A1:H${last}`, 'all');
  g.lists.push({ range: `B2:B${last}`, values: cats }, { range: `G2:G${last}`, values: ['Da', 'Nu'] });
  g.rules.push(
    { range: `F2:F${last}`, op: 'lt', v1: '0', look: 'red' },
    { range: `G2:G${last}`, op: 'eq', v1: 'Da', look: 'green' },
    { range: `G2:G${last}`, op: 'eq', v1: 'Nu', look: 'yellow' },
  );
  g.set('J1', 'Pe categorii', HEAD); g.set('K1', 'Buget', HEAD); g.set('L1', 'Cheltuit', HEAD);
  cats.forEach((c, i) => {
    const r = 2 + i;
    g.set(`J${r}`, c);
    g.set(`K${r}`, `=SUMIF(B2:B${last};J${r};D2:D${last})`, LEI);
    g.set(`L${r}`, `=SUMIF(B2:B${last};J${r};E2:E${last})`, LEI);
  });
  g.set('J7', 'Total', TOTAL); g.set('K7', '=SUM(K2:K6)', { ...LEI, ...TOTAL }); g.set('L7', '=SUM(L2:L6)', { ...LEI, ...TOTAL });
  g.box('J1:L7', 'all');
  g.set('J9', 'Cât vrei să cheltui în total (lei)'); g.set('K9', '', { ...LEI, b: true, bg: '#fff59d' });
  g.set('J10', 'Cheltuit până acum'); g.set('K10', `=SUM(E2:E${last})`, LEI);
  g.set('J11', 'Rămas din buget', { b: true }); g.set('K11', '=IF(K9="";"";K9-K10)', { ...LEI, b: true });
  g.set('J12', 'De cumpărat încă'); g.set('K12', `=COUNTIFS(A2:A${last};"<>";G2:G${last};"<>Da")`, { align: 'center' });
  g.rules.push({ range: 'K11', op: 'lt', v1: '0', look: 'red' }, { range: 'K11', op: 'gt', v1: '0', look: 'green' });
  g.set('J14', 'Pune „Da” la Cumpărat când ai luat lucrul respectiv.', { i: true, color: '#666666' });
  g.widths({ A: 200, B: 100, C: 200, D: 100, E: 115, F: 110, G: 85, H: 180, I: 30, J: 230, K: 110, L: 110 });
  return doc('Bugetul sărbătorilor', g.sheet('Sărbători'));
}

// Evidența orelor de voluntariat: fiecare zi de activitate, orele pe voluntari, ce e confirmat și cheltuielile decontate.
function voluntariat(): SheetDoc {
  const g = new Grid();
  const last = 41;
  g.head(1, ['Data', 'Voluntarul', 'Activitatea / proiectul', 'Ore', 'Cheltuieli decontate (lei)', 'Confirmat', 'Observații']);
  g.col('A', 2, last, DATE);
  g.col('D', 2, last, { align: 'center' });
  g.col('E', 2, last, LEI);
  g.col('F', 2, last, { align: 'center' });
  g.box(`A1:G${last}`, 'all');
  g.lists.push({ range: `F2:F${last}`, values: ['Da', 'Nu'] });
  g.rules.push(
    { range: `F2:F${last}`, op: 'eq', v1: 'Da', look: 'green' },
    { range: `F2:F${last}`, op: 'eq', v1: 'Nu', look: 'yellow' },
  );
  g.set('I1', 'Pe voluntari', HEAD); g.set('J1', 'Ore', HEAD); g.set('K1', 'Ore confirmate', HEAD); g.set('L1', 'Cheltuieli (lei)', HEAD);
  for (let r = 2; r <= 11; r++) {
    g.set(`J${r}`, `=IF(I${r}="";"";SUMIF(B2:B${last};I${r};D2:D${last}))`, { align: 'center' });
    g.set(`K${r}`, `=IF(I${r}="";"";SUMIFS(D2:D${last};B2:B${last};I${r};F2:F${last};"Da"))`, { align: 'center' });
    g.set(`L${r}`, `=IF(I${r}="";"";SUMIF(B2:B${last};I${r};E2:E${last}))`, LEI);
  }
  g.box('I1:L11', 'all');
  g.set('I13', 'Total ore', { b: true }); g.set('J13', `=SUM(D2:D${last})`, { align: 'center', b: true });
  g.set('I14', 'Ore confirmate'); g.set('J14', `=SUMIF(F2:F${last};"Da";D2:D${last})`, { align: 'center' });
  g.set('I15', 'Ore de confirmat încă'); g.set('J15', '=J13-J14', { align: 'center' });
  g.set('I16', 'Cheltuieli decontate'); g.set('J16', `=SUM(E2:E${last})`, LEI);
  g.set('I17', 'Zile de activitate'); g.set('J17', `=COUNT(A2:A${last})`, { align: 'center' });
  g.rules.push({ range: 'J15', op: 'gt', v1: '0', look: 'yellow' });
  g.set('I19', 'Scrie numele voluntarilor în coloana „Pe voluntari”, la fel ca în tabel.', { i: true, color: '#666666' });
  g.set('I20', 'Orele confirmate de coordonator intră în certificatul de voluntariat.', { i: true, color: '#666666' });
  g.widths({ A: 100, B: 180, C: 240, D: 70, E: 110, F: 95, G: 200, H: 30, I: 200, J: 80, K: 120, L: 120 });
  return doc('Evidența orelor de voluntariat', g.sheet('Voluntariat'));
}

// Mutare: fiecare cutie cu camera și ce e în ea, fragilă sau nu, ajunsă sau nu; pe camere și cheltuielile mutării.
function mutare(): SheetDoc {
  const g = new Grid();
  const last = 61;
  const rooms = ['Bucătărie', 'Sufragerie', 'Dormitor', 'Camera copiilor', 'Baie', 'Hol', 'Birou', 'Debara / boxă'];
  g.head(1, ['Cutia nr.', 'Camera', 'Ce e în cutie', 'Fragil', 'Ajunsă']);
  for (let r = 2; r <= last; r++) g.set(`A${r}`, String(r - 1), { align: 'center' });
  g.col('D', 2, last, { align: 'center' });
  g.col('E', 2, last, { align: 'center' });
  g.box(`A1:E${last}`, 'all');
  g.lists.push(
    { range: `B2:B${last}`, values: rooms },
    { range: `D2:D${last}`, values: ['Da', 'Nu'] },
    { range: `E2:E${last}`, values: ['Da', 'Nu'] },
  );
  g.rules.push(
    { range: `D2:D${last}`, op: 'eq', v1: 'Da', look: 'red' },
    { range: `E2:E${last}`, op: 'eq', v1: 'Da', look: 'green' },
    { range: `E2:E${last}`, op: 'eq', v1: 'Nu', look: 'yellow' },
  );
  g.set('G1', 'Pe camere', HEAD); g.set('H1', 'Cutii', HEAD); g.set('I1', 'Ajunse', HEAD); g.set('J1', 'Fragile', HEAD);
  rooms.forEach((name, i) => {
    const r = i + 2;
    g.set(`G${r}`, name);
    g.set(`H${r}`, `=IF(G${r}="";"";COUNTIF(B2:B${last};G${r}))`, { align: 'center' });
    g.set(`I${r}`, `=IF(G${r}="";"";COUNTIFS(B2:B${last};G${r};E2:E${last};"Da"))`, { align: 'center' });
    g.set(`J${r}`, `=IF(G${r}="";"";COUNTIFS(B2:B${last};G${r};D2:D${last};"Da"))`, { align: 'center' });
  });
  g.box('G1:J9', 'all');
  g.set('G11', 'Total cutii', { b: true }); g.set('H11', `=COUNTA(B2:B${last})`, { align: 'center', b: true });
  g.set('G12', 'Ajunse'); g.set('H12', `=COUNTIF(E2:E${last};"Da")`, { align: 'center' });
  g.set('G13', 'Încă lipsesc'); g.set('H13', '=H11-H12', { align: 'center' });
  g.set('G14', 'Fragile'); g.set('H14', `=COUNTIF(D2:D${last};"Da")`, { align: 'center' });
  g.rules.push({ range: 'H13', op: 'gt', v1: '0', look: 'yellow' });
  g.set('G16', 'Cheltuielile mutării', HEAD); g.set('H16', 'Estimat (lei)', HEAD); g.set('I16', 'Real (lei)', HEAD); g.set('J16', 'Diferența (lei)', HEAD);
  const costs = ['Firma de mutări / transportul', 'Cutii, bandă, folie', 'Curățenia', 'Garanția și prima chirie', 'Mutarea internetului și a contractelor', 'Mobilă și lucruri noi', 'Altele'];
  costs.forEach((name, i) => {
    const r = i + 17;
    g.set(`G${r}`, name);
    g.set(`H${r}`, '', LEI); g.set(`I${r}`, '', LEI);
    g.set(`J${r}`, `=IF(AND(H${r}="";I${r}="");"";H${r}-I${r})`, LEI);
  });
  g.rules.push({ range: 'J17:J23', op: 'lt', v1: '0', look: 'red' });
  g.set('G24', 'Total', { b: true }); g.set('H24', '=SUM(H17:H23)', { ...LEI, b: true }); g.set('I24', '=SUM(I17:I23)', { ...LEI, b: true }); g.set('J24', '=H24-I24', { ...LEI, b: true });
  g.box('G16:J24', 'all');
  g.set('G26', 'Scrie numărul cutiei pe ea cu markerul, la fel ca în tabel.', { i: true, color: '#666666' });
  g.set('G27', 'La sosire, treci „Da” la Ajunsă: în galben rămân cutiile care încă lipsesc.', { i: true, color: '#666666' });
  g.widths({ A: 80, B: 150, C: 280, D: 70, E: 75, F: 30, G: 260, H: 100, I: 90, J: 110 });
  return doc('Mutare', g.sheet('Mutare'));
}

// Instruiri SSM și PSI: fiecare instruire a unui salariat, cu data, cât de des se repetă, următoarea dată, zilele rămase și semnătura în fișă.
function instruiri(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Nr.', 'Numele și prenumele', 'Funcția / locul de muncă', 'Felul instruirii', 'Data instruirii', 'Se repetă la (luni)', 'Următoarea instruire', 'Zile rămase', 'Starea', 'Semnat în fișă']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(E${r}="";F${r}="");"";EDATE(E${r};F${r}))`, DATE);
    g.set(`H${r}`, `=IF(G${r}="";"";G${r}-TODAY())`, { align: 'center' });
    g.set(`I${r}`, `=IF(H${r}="";"";IF(H${r}<0;"Restantă";IF(H${r}<=30;"Curând";"La zi")))`, { align: 'center' });
  }
  g.col('E', 2, last, DATE);
  g.col('F', 2, last, { align: 'center' });
  g.col('J', 2, last, { align: 'center' });
  g.box(`A1:J${last}`, 'all');
  g.lists.push(
    { range: `D2:D${last}`, values: ['Introductiv-generală', 'La locul de muncă', 'Periodică', 'Suplimentară', 'PSI (situații de urgență)', 'Prim ajutor'] },
    { range: `F2:F${last}`, values: ['1', '3', '6', '12'] },
    { range: `J2:J${last}`, values: ['Da', 'Nu'] },
  );
  g.rules.push(
    { range: `I2:I${last}`, op: 'eq', v1: 'Restantă', look: 'red' },
    { range: `I2:I${last}`, op: 'eq', v1: 'Curând', look: 'yellow' },
    { range: `I2:I${last}`, op: 'eq', v1: 'La zi', look: 'green' },
    { range: `J2:J${last}`, op: 'eq', v1: 'Nu', look: 'red' },
  );
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Instruiri în listă'); g.set('M2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('L3', 'Restante', { b: true, color: '#c00000' }); g.set('M3', `=COUNTIF(I2:I${last};"Restantă")`, { b: true, color: '#c00000', align: 'center' });
  g.set('L4', 'De făcut în 30 de zile', { b: true }); g.set('M4', `=COUNTIF(I2:I${last};"Curând")`, { b: true, align: 'center' });
  g.set('L5', 'Nesemnate în fișă'); g.set('M5', `=COUNTIF(J2:J${last};"Nu")`, { align: 'center' });
  g.set('L6', 'Următoarea instruire'); g.set('M6', `=IF(COUNTIF(H2:H${last};">=0")=0;"";MINIFS(G2:G${last};H2:H${last};">=0"))`, DATE);
  g.box('L1:M6', 'all');
  g.set('L8', 'Scrie data instruirii și la câte luni se repetă; următoarea dată și starea se calculează singure.', { i: true, color: '#666666' });
  g.set('L9', 'Periodica se face de obicei la 6 luni (la 12 luni pentru personalul de birou), după tematica firmei.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 190, C: 180, D: 170, E: 105, F: 110, G: 130, H: 90, I: 90, J: 105, K: 30, L: 190, M: 110 });
  return doc('Instruiri SSM', g.sheet('Instruiri'));
}

// Echipamente date angajaților: ce a primit fiecare (laptop, telefon, chei, card), când l-a primit și când l-a dat înapoi, cu valoarea și procesul-verbal.
function echipamente(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Nr.', 'Angajatul', 'Echipamentul', 'Seria / nr. de inventar', 'Valoarea (lei)', 'Data predării', 'Data restituirii', 'Starea la restituire', 'Unde e acum', 'Proces-verbal semnat']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(C${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(C${r}="";"";IF(G${r}<>"";"Restituit";IF(F${r}<>"";"La angajat";"În depozit")))`, { align: 'center' });
  }
  g.col('E', 2, last, LEI);
  g.col('F', 2, last, DATE);
  g.col('G', 2, last, DATE);
  g.col('H', 2, last, { align: 'center' });
  g.col('J', 2, last, { align: 'center' });
  g.box(`A1:J${last}`, 'all');
  g.lists.push(
    { range: `C2:C${last}`, values: ['Laptop', 'Calculator', 'Monitor', 'Telefon', 'Tabletă', 'Cheie', 'Card de acces', 'Mașină de serviciu', 'Echipament de protecție', 'Altul'] },
    { range: `H2:H${last}`, values: ['Bună', 'Uzată normal', 'Deteriorată', 'Lipsă'] },
    { range: `J2:J${last}`, values: ['Da', 'Nu'] },
  );
  g.rules.push(
    { range: `I2:I${last}`, op: 'eq', v1: 'La angajat', look: 'yellow' },
    { range: `I2:I${last}`, op: 'eq', v1: 'Restituit', look: 'green' },
    { range: `H2:H${last}`, op: 'eq', v1: 'Deteriorată', look: 'red' },
    { range: `H2:H${last}`, op: 'eq', v1: 'Lipsă', look: 'red' },
    { range: `J2:J${last}`, op: 'eq', v1: 'Nu', look: 'red' },
  );
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Echipamente în listă'); g.set('M2', `=COUNTA(C2:C${last})`, { align: 'center' });
  g.set('L3', 'La angajați', { b: true }); g.set('M3', `=COUNTIF(I2:I${last};"La angajat")`, { b: true, align: 'center' });
  g.set('L4', 'Valoarea la angajați', { b: true }); g.set('M4', `=SUMIF(I2:I${last};"La angajat";E2:E${last})`, { ...LEI, b: true });
  g.set('L5', 'Restituite'); g.set('M5', `=COUNTIF(I2:I${last};"Restituit")`, { align: 'center' });
  g.set('L6', 'Deteriorate sau lipsă', { b: true, color: '#c00000' }); g.set('M6', `=COUNTIF(H2:H${last};"Deteriorată")+COUNTIF(H2:H${last};"Lipsă")`, { b: true, color: '#c00000', align: 'center' });
  g.set('L7', 'Fără proces-verbal'); g.set('M7', `=COUNTIF(J2:J${last};"Nu")`, { align: 'center' });
  g.box('L1:M7', 'all');
  g.set('L9', 'Când un coleg pleacă, filtrează coloana Angajatul după numele lui: vezi tot ce are de predat.', { i: true, color: '#666666' });
  g.set('L10', 'Scrie data restituirii și starea; „Unde e acum” se schimbă singur în Restituit.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 180, C: 160, D: 160, E: 110, F: 110, G: 115, H: 140, I: 110, J: 140, K: 30, L: 190, M: 110 });
  return doc('Echipamente', g.sheet('Echipamente'));
}

// Evaluările anuale ale echipei: notele de la 1 la 5 pe cele 6 criterii din Docs → Fișa de evaluare, media și calificativul fiecăruia.
function evaluari(): SheetDoc {
  const g = new Grid();
  const last = 51;
  g.head(1, ['Nr.', 'Numele și prenumele', 'Postul', 'Cunoștințe', 'Calitate', 'Termene', 'Echipă', 'Inițiativă', 'Regulament', 'Media', 'Calificativul', 'Discuția făcută']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`J${r}`, `=IF(COUNT(D${r}:I${r})=0;"";ROUND(AVERAGE(D${r}:I${r});2))`, { align: 'center', b: true });
    g.set(`K${r}`, `=IF(J${r}="";"";IF(J${r}*10>=45;"Foarte bine";IF(J${r}*10>=35;"Bine";IF(J${r}*10>=25;"Satisfăcător";"Nesatisfăcător"))))`, { align: 'center' });
  }
  for (const c of ['D', 'E', 'F', 'G', 'H', 'I', 'L']) g.col(c, 2, last, { align: 'center' });
  g.box(`A1:L${last}`, 'all');
  g.lists.push(
    ...['D', 'E', 'F', 'G', 'H', 'I'].map((c) => ({ range: `${c}2:${c}${last}`, values: ['1', '2', '3', '4', '5'] })),
    { range: `L2:L${last}`, values: ['Da', 'Nu'] },
  );
  g.rules.push(
    { range: `K2:K${last}`, op: 'eq', v1: 'Foarte bine', look: 'green' },
    { range: `K2:K${last}`, op: 'eq', v1: 'Nesatisfăcător', look: 'red' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Nu', look: 'yellow' },
  );
  g.set('N1', 'Pe scurt', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Evaluați'); g.set('O2', `=COUNT(J2:J${last})`, { align: 'center' });
  g.set('N3', 'Media echipei', { b: true }); g.set('O3', `=IF(COUNT(J2:J${last})=0;"";ROUND(AVERAGE(J2:J${last});2))`, { b: true, align: 'center' });
  g.set('N4', 'Foarte bine'); g.set('O4', `=COUNTIF(K2:K${last};"Foarte bine")`, { align: 'center' });
  g.set('N5', 'Bine'); g.set('O5', `=COUNTIF(K2:K${last};"Bine")`, { align: 'center' });
  g.set('N6', 'Satisfăcător'); g.set('O6', `=COUNTIF(K2:K${last};"Satisfăcător")`, { align: 'center' });
  g.set('N7', 'Nesatisfăcător', { b: true, color: '#c00000' }); g.set('O7', `=COUNTIF(K2:K${last};"Nesatisfăcător")`, { b: true, color: '#c00000', align: 'center' });
  g.set('N8', 'Discuții de făcut'); g.set('O8', `=COUNTIF(L2:L${last};"Nu")`, { align: 'center' });
  g.box('N1:O8', 'all');
  g.set('N10', 'Notele: 1 = nesatisfăcător … 5 = foarte bine, ca în Docs → Fișa de evaluare a performanțelor.', { i: true, color: '#666666' });
  g.set('N11', 'Calificativul: de la 4,5 Foarte bine, de la 3,5 Bine, de la 2,5 Satisfăcător.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 190, C: 160, D: 95, E: 85, F: 85, G: 80, H: 90, I: 100, J: 75, K: 120, L: 120, M: 30, N: 170, O: 90 });
  return doc('Evaluări anuale', g.sheet('Evaluări'));
}

// Zilele de naștere ale colegilor: din data nașterii ies următoarea aniversare, câți ani împlinește și în câte zile;
// cei care au ziua azi (în verde) sau în 7 zile (în galben) ies în față, ca să nu uite nimeni de felicitări.
function aniversari(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Nr.', 'Numele și prenumele', 'Departamentul', 'Data nașterii', 'Următoarea aniversare', 'Împlinește (ani)', 'Zile rămase', 'Când', 'Cadoul / ce facem', 'Felicitat']);
  for (let r = 2; r <= last; r++) {
    const d = `DATE(YEAR(TODAY());MONTH(D${r});DAY(D${r}))`;
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`E${r}`, `=IF(D${r}="";"";IF(${d}<TODAY();DATE(YEAR(TODAY())+1;MONTH(D${r});DAY(D${r}));${d}))`, DATE);
    g.set(`F${r}`, `=IF(E${r}="";"";YEAR(E${r})-YEAR(D${r}))`, { align: 'center' });
    g.set(`G${r}`, `=IF(E${r}="";"";E${r}-TODAY())`, { align: 'center' });
    g.set(`H${r}`, `=IF(G${r}="";"";IF(G${r}=0;"Azi";IF(G${r}<=7;"În 7 zile";IF(G${r}<=30;"În 30 de zile";""))))`, { align: 'center' });
  }
  g.col('D', 2, last, DATE);
  g.col('J', 2, last, { align: 'center' });
  g.box(`A1:J${last}`, 'all');
  g.lists.push({ range: `J2:J${last}`, values: ['Da', 'Nu'] });
  g.rules.push(
    { range: `H2:H${last}`, op: 'eq', v1: 'Azi', look: 'green' },
    { range: `H2:H${last}`, op: 'eq', v1: 'În 7 zile', look: 'yellow' },
  );
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Colegi în listă'); g.set('M2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('L3', 'Au ziua azi', { b: true, color: '#2e7d32' }); g.set('M3', `=COUNTIF(H2:H${last};"Azi")`, { b: true, color: '#2e7d32', align: 'center' });
  g.set('L4', 'În următoarele 7 zile', { b: true }); g.set('M4', `=COUNTIF(H2:H${last};"Azi")+COUNTIF(H2:H${last};"În 7 zile")`, { b: true, align: 'center' });
  g.set('L5', 'În următoarele 30 de zile'); g.set('M5', `=M4+COUNTIF(H2:H${last};"În 30 de zile")`, { align: 'center' });
  g.set('L6', 'Următorul sărbătorit'); g.set('M6', `=IF(COUNT(G2:G${last})=0;"";INDEX(B2:B${last};MATCH(MIN(G2:G${last});G2:G${last};0)))`);
  g.set('L7', 'La data'); g.set('M7', `=IF(COUNT(E2:E${last})=0;"";MIN(E2:E${last}))`, DATE);
  g.box('L1:M7', 'all');
  g.set('L9', 'Scrie data nașterii; următoarea aniversare, vârsta și zilele rămase se calculează singure.', { i: true, color: '#666666' });
  g.set('L10', 'Pentru un film de felicitare: Video → Carton → stilul Aniversare.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 190, C: 150, D: 110, E: 150, F: 110, G: 95, H: 110, I: 200, J: 85, K: 30, L: 190, M: 150 });
  return doc('Zile de naștere', g.sheet('Zile de naștere'));
}

// Facturile primite de la furnizori: cât s-a plătit și cât mai e, câte zile până la scadență; ies cele întârziate (în roșu),
// cele de plătit în 7 zile (în galben) și cele plătite (în verde), ca să nu treacă nicio scadență.
function furnizori(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Nr.', 'Furnizorul', 'CUI', 'Nr. factură', 'Data facturii', 'Scadența', 'Total de plată', 'Plătit', 'Data plății', 'Rest de plată', 'Zile până la scadență', 'Stare']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`J${r}`, `=IF(G${r}="";"";G${r}-H${r})`);
    g.set(`K${r}`, `=IF(G${r}="";"";IF(J${r}<=0;"";IF(F${r}="";"";F${r}-TODAY())))`, { align: 'center' });
    g.set(`L${r}`, `=IF(G${r}="";"";IF(J${r}<=0;"Plătită";IF(F${r}="";"De plată";IF(F${r}<TODAY();"Întârziată";IF(F${r}-TODAY()<=7;"În 7 zile";"De plată")))))`, { align: 'center' });
  }
  for (const c of 'EFI') g.col(c, 2, last, DATE);
  for (const c of 'GHJ') g.col(c, 2, last, LEI);
  g.box(`A1:L${last}`, 'all');
  g.rules.push(
    { range: `L2:L${last}`, op: 'eq', v1: 'Întârziată', look: 'red' },
    { range: `L2:L${last}`, op: 'eq', v1: 'În 7 zile', look: 'yellow' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Plătită', look: 'green' },
  );
  g.set('N1', 'Pe scurt', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Facturi în listă'); g.set('O2', `=COUNT(G2:G${last})`, { align: 'center' });
  g.set('N3', 'Total facturat'); g.set('O3', `=SUM(G2:G${last})`, LEI);
  g.set('N4', 'Plătit'); g.set('O4', `=SUM(H2:H${last})`, LEI);
  g.set('N5', 'Rest de plată', { b: true }); g.set('O5', `=SUM(J2:J${last})`, { ...LEI, b: true });
  g.set('N6', 'Facturi întârziate', { b: true, color: '#c00000' }); g.set('O6', `=COUNTIF(L2:L${last};"Întârziată")`, { b: true, color: '#c00000', align: 'center' });
  g.set('N7', 'Suma întârziată', { b: true, color: '#c00000' }); g.set('O7', `=SUMIF(L2:L${last};"Întârziată";J2:J${last})`, { ...LEI, b: true, color: '#c00000' });
  g.set('N8', 'De plătit în 7 zile'); g.set('O8', `=SUMIF(L2:L${last};"În 7 zile";J2:J${last})`, LEI);
  g.set('N9', 'Cea mai mare întârziere (zile)'); g.set('O9', `=IF(O6=0;0;-MIN(K2:K${last}))`, { align: 'center' });
  g.box('N1:O9', 'all');
  g.set('N11', 'Scrie totalul facturii și scadența; la fiecare plată adaugă suma în Plătit. Restul și starea se calculează singure.', { i: true, color: '#666666' });
  g.set('N12', 'Facturile tale către clienți: șablonul Evidență facturi emise.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 200, C: 100, D: 100, E: 100, F: 100, G: 120, H: 110, I: 100, J: 120, K: 100, L: 110, M: 30, N: 210, O: 130 });
  return doc('Facturi de la furnizori', g.sheet('Furnizori'));
}

// Fluxul de numerar pe 12 luni: încasările și plățile estimate pe fiecare lună, soldul de la sfârșitul lunii trece în luna
// următoare; lunile cu sold negativ ies în roșu, ca să se vadă din timp când nu ajung banii.
function fluxNumerar(): SheetDoc {
  const g = new Grid();
  const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
  const cols = months.map((_, i) => colName(i + 1));
  const inc = ['Încasări de la clienți', 'Încasări în numerar', 'Alte încasări', 'Împrumuturi primite'];
  const pay = ['Furnizori (mărfuri, materiale)', 'Salarii nete', 'Contribuții și impozit pe salarii', 'TVA de plată', 'Impozit pe profit / venit', 'Chirie și utilități', 'Transport și carburant', 'Rate la bancă', 'Alte plăți'];
  g.head(1, ['Categoria', ...months, 'Total']);
  const r0 = 4, rInc = r0 + inc.length, p0 = rInc + 2, rPay = p0 + pay.length, rNet = rPay + 1, rEnd = rNet + 1;
  g.set('A2', 'Sold la început de lună', { b: true });
  g.set('A3', 'Încasări', { b: true, color: '#2e7d32' });
  inc.forEach((t, i) => g.set(`A${r0 + i}`, t));
  g.set(`A${rInc}`, 'Total încasări', TOTAL);
  g.set(`A${rInc + 1}`, 'Plăți', { b: true, color: '#c00000' });
  pay.forEach((t, i) => g.set(`A${p0 + i}`, t));
  g.set(`A${rPay}`, 'Total plăți', TOTAL);
  g.set(`A${rNet}`, 'Fluxul lunii (încasări − plăți)', TOTAL);
  g.set(`A${rEnd}`, 'Sold la sfârșit de lună', { ...TOTAL, b: true });
  cols.forEach((c, i) => {
    if (i === 0) g.set(`${c}2`, '0', { ...LEI, b: true, bg: '#fff59d' });
    else g.set(`${c}2`, `=${cols[i - 1]}${rEnd}`, { ...LEI, b: true });
    g.set(`${c}${rInc}`, `=SUM(${c}${r0}:${c}${rInc - 1})`, { ...TOTAL, ...LEI });
    g.set(`${c}${rPay}`, `=SUM(${c}${p0}:${c}${rPay - 1})`, { ...TOTAL, ...LEI });
    g.set(`${c}${rNet}`, `=${c}${rInc}-${c}${rPay}`, { ...TOTAL, ...LEI });
    g.set(`${c}${rEnd}`, `=${c}2+${c}${rNet}`, { ...TOTAL, ...LEI });
  });
  for (const c of cols) { g.col(c, r0, rInc - 1, LEI); g.col(c, p0, rPay - 1, LEI); }
  g.set('N2', '=B2', { ...LEI, b: true });
  for (let r = r0; r <= rNet; r++) if (r !== rInc + 1) g.set(`N${r}`, `=SUM(B${r}:M${r})`, { ...LEI, b: true });
  g.set(`N${rEnd}`, `=M${rEnd}`, { ...TOTAL, ...LEI });
  g.box(`A1:N${rEnd}`, 'all');
  g.rules.push({ range: `B${rEnd}:N${rEnd}`, op: 'lt', v1: '0', look: 'red' }, { range: `B${rNet}:N${rNet}`, op: 'lt', v1: '0', look: 'yellow' });
  g.set('P1', 'Pe scurt', HEAD); g.set('Q1', '', HEAD);
  g.set('P2', 'Sold la începutul anului'); g.set('Q2', '=B2', LEI);
  g.set('P3', 'Total încasări pe an'); g.set('Q3', `=N${rInc}`, LEI);
  g.set('P4', 'Total plăți pe an'); g.set('Q4', `=N${rPay}`, LEI);
  g.set('P5', 'Sold la sfârșitul anului', { b: true }); g.set('Q5', `=M${rEnd}`, { ...LEI, b: true });
  g.set('P6', 'Cel mai mic sold'); g.set('Q6', `=MIN(B${rEnd}:M${rEnd})`, LEI);
  g.set('P7', 'În luna'); g.set('Q7', `=INDEX(B1:M1;MATCH(MIN(B${rEnd}:M${rEnd});B${rEnd}:M${rEnd};0))`, { align: 'center' });
  g.set('P8', 'Luni cu sold negativ', { b: true, color: '#c00000' }); g.set('Q8', `=COUNTIF(B${rEnd}:M${rEnd};"<0")`, { b: true, color: '#c00000', align: 'center' });
  g.box('P1:Q8', 'all');
  g.set('P10', 'Scrie soldul de la începutul anului (în galben) și sumele estimate pe fiecare lună; soldul trece singur în luna următoare.', { i: true, color: '#666666' });
  g.set('P11', 'Plățile către furnizori le iei din șablonul Facturi de la furnizori.', { i: true, color: '#666666' });
  g.widths({ A: 240, ...Object.fromEntries(cols.map((c) => [c, 90])), N: 110, O: 30, P: 200, Q: 120 });
  return doc('Flux de numerar', g.sheet('Flux de numerar'));
}

// Evidența TVA pe luni: din vânzări și achiziții ies TVA-ul colectat și deductibil, cât e de plată sau de recuperat și termenul
// decontului (25 ale lunii următoare); declarațiile nedepuse cu termenul trecut ies în roșu.
function tvaLunar(): SheetDoc {
  const g = new Grid();
  const months = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
  const last = 13, tot = 14;
  g.head(1, ['Luna', 'Vânzări fără TVA', 'TVA colectat', 'Achiziții fără TVA', 'TVA deductibil', 'Diferența', 'Rezultat', 'Termen de depunere', 'Depus și plătit', 'Zile până la termen']);
  months.forEach((m, i) => {
    const r = i + 2;
    g.set(`A${r}`, m, { b: true });
    g.set(`C${r}`, `=IF(B${r}="";"";ROUND(B${r}*$M$2;2))`);
    g.set(`E${r}`, `=IF(D${r}="";"";ROUND(D${r}*$M$2;2))`);
    g.set(`F${r}`, `=IF(COUNT(B${r};D${r})=0;"";SUM(C${r})-SUM(E${r}))`);
    g.set(`G${r}`, `=IF(F${r}="";"";IF(F${r}>0;"De plată";IF(F${r}<0;"De recuperat";"Zero")))`, { align: 'center' });
    g.set(`H${r}`, `=DATE($M$3;${i + 2};25)`, DATE);
    g.set(`J${r}`, `=IF(OR(F${r}="";I${r}="Da");"";H${r}-TODAY())`, { align: 'center' });
  });
  for (const c of 'BCDEF') { g.col(c, 2, last, LEI); g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...TOTAL, ...LEI }); }
  g.set(`A${tot}`, 'Total pe an', TOTAL);
  g.col('I', 2, last, { align: 'center' });
  g.box(`A1:J${tot}`, 'all');
  g.lists.push({ range: `I2:I${last}`, values: ['Da', 'Nu'] });
  g.rules.push(
    { range: `J2:J${last}`, op: 'lt', v1: '0', look: 'red' },
    { range: `G2:G${last}`, op: 'eq', v1: 'De recuperat', look: 'green' },
    { range: `I2:I${last}`, op: 'eq', v1: 'Da', look: 'green' },
  );
  g.set('L1', 'Setări și totaluri', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Cota TVA (o schimbi aici)'); g.set('M2', '0,21', { ...PCT, b: true, bg: '#fff59d' });
  g.set('L3', 'Anul'); g.set('M3', '=YEAR(TODAY())', { b: true, bg: '#fff59d', align: 'center' });
  g.set('L4', 'TVA de plată pe an'); g.set('M4', `=SUMIF(F2:F${last};">0")`, LEI);
  g.set('L5', 'TVA de recuperat pe an'); g.set('M5', `=-SUMIF(F2:F${last};"<0")`, LEI);
  g.set('L6', 'Diferența pe an', { b: true }); g.set('M6', `=SUM(F2:F${last})`, { ...LEI, b: true });
  g.set('L7', 'Deconturi întârziate', { b: true, color: '#c00000' }); g.set('M7', `=COUNTIF(J2:J${last};"<0")`, { b: true, color: '#c00000', align: 'center' });
  g.box('L1:M7', 'all');
  g.set('L9', 'TVA-ul se calculează cu cota din M2; dacă o factură are altă cotă, scrie TVA-ul direct peste formulă.', { i: true, color: '#666666' });
  g.set('L10', 'Dacă depui decontul pe trimestru, completează doar ultima lună a trimestrului.', { i: true, color: '#666666' });
  g.widths({ A: 110, B: 130, C: 115, D: 135, E: 115, F: 110, G: 110, H: 130, I: 115, J: 130, K: 30, L: 200, M: 120 });
  return doc('Evidența TVA', g.sheet('TVA'));
}

// Registrul mijloacelor fixe: amortizarea liniară, din luna următoare punerii în funcțiune; la data din setări ies lunile
// amortizate, amortizarea cumulată, valoarea rămasă și amortizarea din anul curent. Ultima lună preia rotunjirile.
function mijloaceFixe(): SheetDoc {
  const g = new Grid();
  const last = 61;
  g.head(1, ['Nr.', 'Denumirea', 'Nr. inventar', 'Cod de clasificare', 'Data punerii în funcțiune', 'Valoare de intrare', 'Durata (luni)', 'Amortizare lunară', 'Luni amortizate', 'Amortizare cumulată', 'Valoare rămasă', 'Amortizare în anul curent', 'Stare']);
  for (let r = 2; r <= last; r++) {
    const months = `MAX(0;MIN(G${r};(YEAR($P$2)-YEAR(E${r}))*12+MONTH($P$2)-MONTH(E${r})-IF($P$2=EOMONTH($P$2;0);0;1)))`;
    const prev = `MAX(0;MIN(G${r};(YEAR($P$2)-1-YEAR(E${r}))*12+12-MONTH(E${r})))`;
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`H${r}`, `=IF(OR(F${r}="";G${r}="");"";ROUND(F${r}/G${r};2))`);
    g.set(`I${r}`, `=IF(OR(E${r}="";F${r}="";G${r}="");"";${months})`, { align: 'center' });
    g.set(`J${r}`, `=IF(I${r}="";"";IF(I${r}>=G${r};F${r};ROUND(H${r}*I${r};2)))`);
    g.set(`K${r}`, `=IF(J${r}="";"";F${r}-J${r})`);
    g.set(`L${r}`, `=IF(J${r}="";"";J${r}-IF(${prev}>=G${r};F${r};ROUND(H${r}*${prev};2)))`);
    g.set(`M${r}`, `=IF(I${r}="";"";IF(I${r}>=G${r};"Amortizat complet";IF(I${r}=0;"Neînceput";"În amortizare")))`, { align: 'center' });
  }
  g.col('E', 2, last, DATE);
  g.col('G', 2, last, { align: 'center' });
  for (const c of 'FHJKL') g.col(c, 2, last, LEI);
  g.box(`A1:M${last}`, 'all');
  g.rules.push(
    { range: `M2:M${last}`, op: 'eq', v1: 'Amortizat complet', look: 'green' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Neînceput', look: 'yellow' },
  );
  g.set('O1', 'Setări și totaluri', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Calculat la data (o schimbi aici)'); g.set('P2', '=TODAY()', { ...DATE, b: true, bg: '#fff59d' });
  g.set('O3', 'Mijloace fixe în listă'); g.set('P3', `=COUNT(F2:F${last})`, { align: 'center' });
  g.set('O4', 'Valoare de intrare totală'); g.set('P4', `=SUM(F2:F${last})`, LEI);
  g.set('O5', 'Amortizare cumulată'); g.set('P5', `=SUM(J2:J${last})`, LEI);
  g.set('O6', 'Valoare rămasă', { b: true }); g.set('P6', `=SUM(K2:K${last})`, { ...LEI, b: true });
  g.set('O7', 'Amortizare în anul curent'); g.set('P7', `=SUM(L2:L${last})`, LEI);
  g.set('O8', 'Amortizare pe lună (cele în amortizare)'); g.set('P8', `=SUMIF(M2:M${last};"În amortizare";H2:H${last})`, LEI);
  g.set('O9', 'Amortizate complet', { color: '#2e7d32' }); g.set('P9', `=COUNTIF(M2:M${last};"Amortizat complet")`, { color: '#2e7d32', align: 'center' });
  g.box('O1:P9', 'all');
  g.set('O11', 'Amortizare liniară: începe din luna următoare punerii în funcțiune; se numără lunile încheiate până la data din P2.', { i: true, color: '#666666' });
  g.set('O12', 'Durata în luni o iei din catalogul mijloacelor fixe (de exemplu: un calculator 36 de luni, un autoturism 60).', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 210, C: 100, D: 110, E: 120, F: 120, G: 90, H: 115, I: 90, J: 130, K: 120, L: 130, M: 130, N: 30, O: 240, P: 120 });
  return doc('Mijloace fixe', g.sheet('Mijloace fixe'));
}

// Lista de inventariere: stocul din evidență (scriptic) față de cel numărat (faptic), pe fiecare articol; ies diferențele în
// cantitate și în lei, plusurile (în verde) și lipsurile (în roșu), ca bază pentru procesul-verbal de inventariere.
function listaInventariere(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Nr.', 'Denumirea', 'Cod', 'UM', 'Stoc scriptic', 'Stoc faptic', 'Preț unitar', 'Valoare scriptică', 'Valoare faptică', 'Diferență cantitate', 'Diferență valoare', 'Rezultat']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`H${r}`, `=IF(OR(E${r}="";G${r}="");"";ROUND(E${r}*G${r};2))`);
    g.set(`I${r}`, `=IF(OR(F${r}="";G${r}="");"";ROUND(F${r}*G${r};2))`);
    g.set(`J${r}`, `=IF(OR(E${r}="";F${r}="");"";F${r}-E${r})`, { align: 'center' });
    g.set(`K${r}`, `=IF(OR(H${r}="";I${r}="");"";I${r}-H${r})`);
    g.set(`L${r}`, `=IF(J${r}="";"";IF(J${r}>0;"Plus";IF(J${r}<0;"Lipsă";"Concordă")))`, { align: 'center' });
  }
  g.col('D', 2, last, { align: 'center' });
  for (const c of 'EF') g.col(c, 2, last, { align: 'center' });
  for (const c of 'GHIK') g.col(c, 2, last, LEI);
  g.box(`A1:L${last}`, 'all');
  g.lists.push({ range: `D2:D${last}`, values: ['buc', 'kg', 'l', 'm', 'mp', 'set', 'cutie'] });
  g.rules.push(
    { range: `L2:L${last}`, op: 'eq', v1: 'Plus', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Lipsă', look: 'red' },
  );
  g.set('N1', 'Pe scurt', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Data inventarierii'); g.set('O2', '=TODAY()', { ...DATE, b: true, bg: '#fff59d' });
  g.set('N3', 'Gestiunea'); g.set('O3', '', { bg: '#fff59d' });
  g.set('N4', 'Articole numărate'); g.set('O4', `=COUNT(F2:F${last})`, { align: 'center' });
  g.set('N5', 'Valoare scriptică'); g.set('O5', `=SUM(H2:H${last})`, LEI);
  g.set('N6', 'Valoare faptică'); g.set('O6', `=SUM(I2:I${last})`, LEI);
  g.set('N7', 'Plusuri', { color: '#2e7d32' }); g.set('O7', `=SUMIF(K2:K${last};">0")`, { ...LEI, color: '#2e7d32' });
  g.set('N8', 'Lipsuri', { b: true, color: '#c00000' }); g.set('O8', `=-SUMIF(K2:K${last};"<0")`, { ...LEI, b: true, color: '#c00000' });
  g.set('N9', 'Diferența totală', { b: true }); g.set('O9', `=SUM(K2:K${last})`, { ...LEI, b: true });
  g.set('N10', 'Articole cu diferențe'); g.set('O10', `=COUNTIF(L2:L${last};"Plus")+COUNTIF(L2:L${last};"Lipsă")`, { align: 'center' });
  g.box('N1:O10', 'all');
  g.set('N12', 'Scrie stocul din evidență (scriptic) și ce ai numărat pe raft (faptic); diferențele se calculează singure.', { i: true, color: '#666666' });
  g.set('N13', 'Pentru lista de pași: Notițe → Din șablon → Inventarierea anuală.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 220, C: 90, D: 60, E: 100, F: 100, G: 110, H: 125, I: 125, J: 115, K: 125, L: 100, M: 30, N: 200, O: 130 });
  return doc('Listă de inventariere', g.sheet('Inventariere'));
}

// Statul de plată pe o lună: pentru fiecare angajat, din brut ies CAS, CASS, venitul impozabil, impozitul, netul și restul de
// plată după avans, plus contribuția angajatorului (CAM) și costul total; procentele sunt în celule, ca la Salariu net.
function statPlata(): SheetDoc {
  const g = new Grid();
  const last = 41, tot = 42;
  g.head(1, ['Nr.', 'Numele și prenumele', 'Funcția', 'Zile lucrate', 'Salariu brut', 'CAS', 'CASS', 'Deducere personală', 'Venit impozabil', 'Impozit', 'Salariu net', 'Avans', 'Rest de plată', 'CAM (angajator)', 'Cost total']);
  for (let r = 2; r <= last; r++) {
    const e = `IF(E${r}="";"";`;
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`F${r}`, `=${e}ROUND(E${r}*$R$2;0))`);
    g.set(`G${r}`, `=${e}ROUND(E${r}*$R$3;0))`);
    g.set(`I${r}`, `=${e}MAX(E${r}-F${r}-G${r}-N(H${r});0))`);
    g.set(`J${r}`, `=${e}ROUND(I${r}*$R$4;0))`);
    g.set(`K${r}`, `=${e}E${r}-F${r}-G${r}-J${r})`, { b: true });
    g.set(`M${r}`, `=${e}K${r}-N(L${r}))`, { b: true });
    g.set(`N${r}`, `=${e}ROUND(E${r}*$R$5;0))`);
    g.set(`O${r}`, `=${e}E${r}+N${r})`);
  }
  g.col('D', 2, last, { align: 'center' });
  for (const c of 'EFGHIJKLMNO') { g.col(c, 2, last, LEI); g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...TOTAL, ...LEI }); }
  g.set(`B${tot}`, 'Total', TOTAL);
  g.col('H', 2, last, { bg: '#fff59d' });
  g.box(`A1:O${tot}`, 'all');
  g.rules.push({ range: `M2:M${last}`, op: 'lt', v1: '0', look: 'red' });
  g.set('Q1', 'Setări și totaluri', HEAD); g.set('R1', '', HEAD);
  g.set('Q2', 'CAS (pensie)'); g.set('R2', '0,25', { ...PCT, bg: '#fff59d' });
  g.set('Q3', 'CASS (sănătate)'); g.set('R3', '0,1', { ...PCT, bg: '#fff59d' });
  g.set('Q4', 'Impozit pe venit'); g.set('R4', '0,1', { ...PCT, bg: '#fff59d' });
  g.set('Q5', 'CAM (contribuția angajatorului)'); g.set('R5', '0,0225', { ...PCT, bg: '#fff59d' });
  g.set('Q6', 'Luna'); g.set('R6', '=TODAY()', { fmt: 'date', align: 'center', bg: '#fff59d' });
  g.set('Q7', 'Angajați'); g.set('R7', `=COUNT(E2:E${last})`, { align: 'center' });
  g.set('Q8', 'De plătit angajaților (rest)', { b: true }); g.set('R8', `=M${tot}`, { ...LEI, b: true });
  g.set('Q9', 'Contribuții și impozit la stat', { b: true }); g.set('R9', `=F${tot}+G${tot}+J${tot}+N${tot}`, { ...LEI, b: true });
  g.set('Q10', 'Costul total al salariilor'); g.set('R10', `=O${tot}`, LEI);
  g.box('Q1:R10', 'all');
  g.set('Q12', 'Procentele sunt cele uzuale; verifică-le dacă se schimbă legea. Deducerea personală (în galben) o scrii pentru fiecare angajat.', { i: true, color: '#666666' });
  g.set('Q13', 'Contribuțiile și impozitul se plătesc până pe 25 ale lunii următoare. Pentru un singur salariu: șablonul Salariu net.', { i: true, color: '#666666' });
  g.widths({ A: 45, B: 200, C: 130, D: 80, E: 110, F: 90, G: 90, H: 105, I: 110, J: 90, K: 110, L: 90, M: 110, N: 100, O: 110, P: 30, Q: 240, R: 120 });
  return doc('Stat de plată', g.sheet('Stat de plată'));
}

// Registrul de intrări-ieșiri: corespondența firmei (scrisori, adrese, notificări, cereri), cu număr de înregistrare care
// crește singur, emitentul sau destinatarul, termenul de răspuns și starea: cele nerezolvate cu termenul trecut ies în roșu.
function registruIntrariIesiri(): SheetDoc {
  const g = new Grid();
  const last = 201;
  g.head(1, ['Nr. înregistrare', 'Data', 'Intrare / ieșire', 'De la / către', 'Nr. și data documentului', 'Conținutul pe scurt', 'Repartizat la', 'Termen de răspuns', 'Rezolvat', 'Stare']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(D${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`J${r}`, `=IF(D${r}="";"";IF(I${r}="Da";"Rezolvat";IF(H${r}="";"Fără termen";IF(H${r}<TODAY();"Întârziat";IF(H${r}-TODAY()<=3;"Termen aproape";"În lucru")))))`, { align: 'center' });
  }
  for (const c of 'BH') g.col(c, 2, last, DATE);
  for (const c of 'CI') g.col(c, 2, last, { align: 'center' });
  g.box(`A1:J${last}`, 'all');
  g.lists.push({ range: `C2:C${last}`, values: ['Intrare', 'Ieșire'] }, { range: `I2:I${last}`, values: ['Da', 'Nu'] });
  g.rules.push(
    { range: `J2:J${last}`, op: 'eq', v1: 'Întârziat', look: 'red' },
    { range: `J2:J${last}`, op: 'eq', v1: 'Termen aproape', look: 'yellow' },
    { range: `J2:J${last}`, op: 'eq', v1: 'Rezolvat', look: 'green' },
  );
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Anul registrului'); g.set('M2', '=YEAR(TODAY())', { align: 'center', b: true, bg: '#fff59d' });
  g.set('L3', 'Documente intrate'); g.set('M3', `=COUNTIF(C2:C${last};"Intrare")`, { align: 'center' });
  g.set('L4', 'Documente ieșite'); g.set('M4', `=COUNTIF(C2:C${last};"Ieșire")`, { align: 'center' });
  g.set('L5', 'Nerezolvate'); g.set('M5', `=COUNTA(D2:D${last})-COUNTIF(I2:I${last};"Da")`, { align: 'center' });
  g.set('L6', 'Întârziate', { b: true, color: '#c00000' }); g.set('M6', `=COUNTIF(J2:J${last};"Întârziat")`, { align: 'center', b: true, color: '#c00000' });
  g.set('L7', 'Cu termenul în 3 zile'); g.set('M7', `=COUNTIF(J2:J${last};"Termen aproape")`, { align: 'center' });
  g.box('L1:M7', 'all');
  g.set('L9', 'Numărul de înregistrare se pune singur când scrii De la / către; trece-l pe document.', { i: true, color: '#666666' });
  g.set('L10', 'Când răspunzi, scrie Da la Rezolvat; întârziatele ies în roșu, cele cu termenul în 3 zile în galben.', { i: true, color: '#666666' });
  g.widths({ A: 110, B: 95, C: 105, D: 200, E: 160, F: 260, G: 140, H: 115, I: 80, J: 120, K: 30, L: 180, M: 90 });
  return doc('Registru de intrări-ieșiri', g.sheet('Registru'));
}

// Evidența contractelor: cu clienții, furnizorii, chiria, asigurările; câte zile mai are fiecare și ce trebuie reînnoit.
// „De reînnoit” = sfârșitul e mai aproape decât preavizul (sau 30 de zile, dacă preavizul nu e scris).
function evidentaContracte(): SheetDoc {
  const g = new Grid();
  const last = 151;
  g.head(1, ['Nr.', 'Partener', 'Obiectul contractului', 'Nr. și data contractului', 'Început', 'Sfârșit', 'Valoare', 'Prelungire automată', 'Preaviz (zile)', 'Zile rămase', 'Stare']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`J${r}`, `=IF(OR(B${r}="";F${r}="");"";F${r}-TODAY())`, { align: 'center' });
    g.set(`K${r}`, `=IF(B${r}="";"";IF(F${r}="";"Nedeterminat";IF(F${r}<TODAY();IF(H${r}="Da";"Prelungit automat";"Expirat");IF(F${r}-TODAY()<=IF(I${r}="";30;I${r});"De reînnoit";"Activ"))))`, { align: 'center' });
  }
  for (const c of 'EF') g.col(c, 2, last, DATE);
  g.col('G', 2, last, LEI);
  for (const c of 'HI') g.col(c, 2, last, { align: 'center' });
  g.box(`A1:K${last}`, 'all');
  g.lists.push({ range: `H2:H${last}`, values: ['Da', 'Nu'] });
  g.rules.push(
    { range: `K2:K${last}`, op: 'eq', v1: 'Expirat', look: 'red' },
    { range: `K2:K${last}`, op: 'eq', v1: 'De reînnoit', look: 'yellow' },
    { range: `K2:K${last}`, op: 'eq', v1: 'Activ', look: 'green' },
  );
  g.set('M1', 'Pe scurt', HEAD); g.set('N1', '', HEAD);
  g.set('M2', 'Contracte în vigoare'); g.set('N2', `=COUNTIF(K2:K${last};"Activ")+COUNTIF(K2:K${last};"De reînnoit")+COUNTIF(K2:K${last};"Nedeterminat")+COUNTIF(K2:K${last};"Prelungit automat")`, { align: 'center' });
  g.set('M3', 'Valoarea lor'); g.set('N3', `=SUMIF(K2:K${last};"Activ";G2:G${last})+SUMIF(K2:K${last};"De reînnoit";G2:G${last})+SUMIF(K2:K${last};"Nedeterminat";G2:G${last})+SUMIF(K2:K${last};"Prelungit automat";G2:G${last})`, LEI);
  g.set('M4', 'De reînnoit', { b: true, color: '#9c6500' }); g.set('N4', `=COUNTIF(K2:K${last};"De reînnoit")`, { align: 'center', b: true, color: '#9c6500' });
  g.set('M5', 'Expirate', { b: true, color: '#c00000' }); g.set('N5', `=COUNTIF(K2:K${last};"Expirat")`, { align: 'center', b: true, color: '#c00000' });
  g.set('M6', 'Prelungite automat'); g.set('N6', `=COUNTIF(K2:K${last};"Prelungit automat")`, { align: 'center' });
  g.box('M1:N6', 'all');
  g.set('M8', 'Lasă Sfârșit gol la contractele pe perioadă nedeterminată.', { i: true, color: '#666666' });
  g.set('M9', 'La Prelungire automată = Da, după sfârșit contractul nu iese Expirat; scrie noua dată de sfârșit când îl verifici.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 180, C: 240, D: 160, E: 95, F: 95, G: 115, H: 135, I: 105, J: 95, K: 130, L: 30, M: 180, N: 120 });
  return doc('Evidența contractelor', g.sheet('Contracte'));
}

// Compararea ofertelor: aceleași produse cerute la trei furnizori (de exemplu după Docs → Cerere de ofertă). Pe fiecare rând
// iese cel mai mic preț (în verde) și furnizorul lui; jos totalul fiecărei oferte, câte prețuri lipsesc și condițiile.
// „Cea mai mică ofertă completă” ia doar furnizorii care au dat preț la toate produsele.
function comparareOferte(): SheetDoc {
  const g = new Grid();
  const last = 31, tot = last + 1, miss = last + 2;
  g.head(1, ['Nr.', 'Produsul / serviciul', 'Cantitatea', 'U.M.', 'Furnizor A', 'Furnizor B', 'Furnizor C', 'Cel mai mic preț', 'Cel mai ieftin la', 'Valoare la cel mai mic preț']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`H${r}`, `=IF(COUNT(E${r}:G${r})=0;"";MIN(E${r}:G${r}))`, LEI);
    g.set(`I${r}`, `=IF(H${r}="";"";INDEX($E$1:$G$1;MATCH(H${r};E${r}:G${r};0)))`, { align: 'center' });
    g.set(`J${r}`, `=IF(H${r}="";"";C${r}*H${r})`, LEI);
  }
  for (const c of 'EFG') g.col(c, 2, last, LEI);
  for (const c of 'CD') g.col(c, 2, last, { align: 'center' });
  g.set(`B${tot}`, 'Total ofertă (fără TVA)', { b: true });
  for (const c of 'EFG') g.set(`${c}${tot}`, `=SUMPRODUCT($C$2:$C${last};${c}2:${c}${last})`, { ...LEI, b: true });
  g.set(`J${tot}`, `=SUM(J2:J${last})`, { ...LEI, b: true });
  g.set(`B${miss}`, 'Prețuri lipsă');
  for (const c of 'EFG') g.set(`${c}${miss}`, `=COUNTA($B$2:$B${last})-COUNT(${c}2:${c}${last})`, { align: 'center' });
  g.set(`B${miss + 1}`, 'Termen de livrare (zile)');
  g.set(`B${miss + 2}`, 'Plata la (zile de la factură)');
  g.set(`B${miss + 3}`, 'Garanția (luni)');
  for (const c of 'EFG') g.col(c, miss + 1, miss + 3, { align: 'center' });
  g.box(`A1:J${miss + 3}`, 'all');
  g.rules.push(
    { range: `E2:G${last}`, op: 'formula', v1: '=AND(E2<>"";E2=MIN($E2:$G2))', look: 'green' },
    { range: `E${miss}:G${miss}`, op: 'gt', v1: '0', look: 'red' },
  );
  const big = '1E+99';
  const best = `MIN(IF(E${miss}=0;E${tot};${big});IF(F${miss}=0;F${tot};${big});IF(G${miss}=0;G${tot};${big}))`;
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Produse cerute'); g.set('M2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('L3', 'Cea mai mică ofertă completă', { b: true, color: '#006100' }); g.set('M3', `=IF(OR(M2=0;${best}=${big});"";${best})`, { ...LEI, b: true, color: '#006100' });
  g.set('L4', 'De la', { b: true, color: '#006100' }); g.set('M4', `=IF(M3="";"";INDEX(E1:G1;MATCH(M3;E${tot}:G${tot};0)))`, { align: 'center', b: true, color: '#006100' });
  g.set('L5', 'Luând fiecare produs de la cel mai ieftin'); g.set('M5', `=J${tot}`, LEI);
  g.set('L6', 'Economia față de oferta completă'); g.set('M6', `=IF(M3="";"";M3-M5)`, LEI);
  g.box('L1:M6', 'all');
  g.set('L8', 'Scrie numele furnizorilor în E1, F1 și G1, apoi prețul pe unitate, fără TVA.', { i: true, color: '#666666' });
  g.set('L9', 'Cel mai mic preț de pe fiecare rând iese în verde; o ofertă cu prețuri lipsă nu intră la „completă”.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 240, C: 90, D: 70, E: 120, F: 120, G: 120, H: 125, I: 130, J: 165, K: 30, L: 270, M: 130 });
  return doc('Compararea ofertelor', g.sheet('Oferte'));
}

function notaReceptie(): SheetDoc {
  const g = new Grid();
  const last = 31, tot = last + 1;
  g.head(1, ['Nr.', 'Produsul', 'U.M.', 'Cantitatea din factură', 'Cantitatea recepționată', 'Diferența', 'Preț unitar (fără TVA)', 'Valoarea din factură', 'Valoarea recepționată', 'Valoarea diferenței', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`F${r}`, `=IF(OR(D${r}="";E${r}="");"";E${r}-D${r})`, { align: 'center' });
    g.set(`H${r}`, `=IF(OR(D${r}="";G${r}="");"";D${r}*G${r})`, LEI);
    g.set(`I${r}`, `=IF(OR(E${r}="";G${r}="");"";E${r}*G${r})`, LEI);
    g.set(`J${r}`, `=IF(OR(F${r}="";G${r}="");"";F${r}*G${r})`, LEI);
  }
  for (const c of 'CDE') g.col(c, 2, last, { align: 'center' });
  g.col('G', 2, last, LEI);
  g.lists.push({ range: `C2:C${last}`, values: ['buc', 'kg', 'g', 'l', 'm', 'mp', 'set', 'cutie', 'pachet'] });
  g.set(`B${tot}`, 'Total (fără TVA)', TOTAL);
  for (const c of 'HIJ') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:K${tot}`, 'all');
  g.rules.push(
    { range: `F2:F${last}`, op: 'lt', v1: '0', look: 'red' },
    { range: `F2:F${last}`, op: 'gt', v1: '0', look: 'yellow' },
  );
  const IN: CellStyle = { bg: '#fff59d' };
  g.set('M1', 'Pe scurt', HEAD); g.set('N1', '', HEAD);
  g.set('M2', 'Furnizorul'); g.set('N2', '', IN);
  g.set('M3', 'Factura / avizul nr.'); g.set('N3', '', { ...IN, align: 'center' });
  g.set('M4', 'Data recepției'); g.set('N4', '=TODAY()', { ...DATE, ...IN });
  g.set('M5', 'Cota TVA (o schimbi aici)'); g.set('N5', '0,21', { ...PCT, ...IN });
  g.set('M6', 'Produse recepționate'); g.set('N6', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('M7', 'Cu lipsuri', { color: '#9c0006' }); g.set('N7', `=COUNTIF(F2:F${last};"<0")`, { align: 'center', color: '#9c0006' });
  g.set('M8', 'Cu plusuri', { color: '#9c5700' }); g.set('N8', `=COUNTIF(F2:F${last};">0")`, { align: 'center', color: '#9c5700' });
  g.set('M9', 'Valoarea lipsurilor (fără TVA)', { color: '#9c0006' }); g.set('N9', `=-SUMIF(J2:J${last};"<0")`, { ...LEI, color: '#9c0006' });
  g.set('M10', 'Total recepționat fără TVA'); g.set('N10', `=I${tot}`, LEI);
  g.set('M11', 'TVA'); g.set('N11', '=ROUND(N10*N5;2)', LEI);
  g.set('M12', 'Total recepționat cu TVA', { b: true }); g.set('N12', '=N10+N11', { ...LEI, b: true });
  g.set('M13', 'Diferența față de factură (cu TVA)', { b: true }); g.set('N13', `=ROUND(J${tot}*(1+N5);2)`, { ...LEI, b: true });
  g.box('M1:N13', 'all');
  g.set('M15', 'Scrie cantitatea din factură și pe cea numărată la primire: lipsurile ies în roșu, plusurile în galben.', { i: true, color: '#666666' });
  g.set('M16', 'Pentru diferențe faci proces-verbal cu furnizorul (Docs → Proces-verbal de recepție) și ceri factură de corecție.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 230, C: 70, D: 120, E: 135, F: 90, G: 140, H: 140, I: 150, J: 140, K: 200, L: 30, M: 250, N: 140 });
  return doc('Notă de recepție', g.sheet('Recepție'));
}

function evidentaArhivei(): SheetDoc {
  const g = new Grid();
  const last = 61;
  g.head(1, ['Nr.', 'Dosarul (ce conține)', 'Felul documentelor', 'Anul', 'Se păstrează (ani)', 'Locul (dulap / raft)', 'Nr. de file', 'Se poate elimina din', 'Starea', 'Eliminat']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`H${r}`, `=IF(OR(D${r}="";E${r}="");"";IF(E${r}="Permanent";"Permanent";D${r}+E${r}+1))`, { align: 'center' });
    g.set(`I${r}`, `=IF(B${r}="";"";IF(J${r}="Da";"Eliminat";IF(H${r}="";"Fără termen";IF(H${r}="Permanent";"Permanent";IF(H${r}<=YEAR(TODAY());"De eliminat";"Păstrat")))))`, { align: 'center' });
  }
  for (const c of 'DEGJ') g.col(c, 2, last, { align: 'center' });
  g.lists.push(
    { range: `C2:C${last}`, values: ['Contabile', 'Personal și salarii', 'Contracte', 'Corespondență', 'Fiscale', 'Juridice', 'Altele'] },
    { range: `E2:E${last}`, values: ['1', '3', '5', '10', '50', 'Permanent'] },
    { range: `J2:J${last}`, values: ['Da', 'Nu'] },
  );
  g.box(`A1:J${last}`, 'all');
  g.rules.push(
    { range: `I2:I${last}`, op: 'eq', v1: 'De eliminat', look: 'red' },
    { range: `I2:I${last}`, op: 'eq', v1: 'Fără termen', look: 'yellow' },
    { range: `I2:I${last}`, op: 'eq', v1: 'Păstrat', look: 'green' },
  );
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Dosare în evidență'); g.set('M2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('L3', 'Păstrate', { color: '#006100' }); g.set('M3', `=COUNTIF(I2:I${last};"Păstrat")`, { align: 'center', color: '#006100' });
  g.set('L4', 'Permanente'); g.set('M4', `=COUNTIF(I2:I${last};"Permanent")`, { align: 'center' });
  g.set('L5', 'De eliminat (termenul a trecut)', { b: true, color: '#9c0006' }); g.set('M5', `=COUNTIF(I2:I${last};"De eliminat")`, { align: 'center', b: true, color: '#9c0006' });
  g.set('L6', 'Fără termen de păstrare', { color: '#9c5700' }); g.set('M6', `=COUNTIF(I2:I${last};"Fără termen")`, { align: 'center', color: '#9c5700' });
  g.set('L7', 'Eliminate'); g.set('M7', `=COUNTIF(I2:I${last};"Eliminat")`, { align: 'center' });
  g.set('L8', 'File în arhivă (fără cele eliminate)'); g.set('M8', `=SUM(G2:G${last})-SUMIF(J2:J${last};"Da";G2:G${last})`, { align: 'center' });
  g.box('L1:M8', 'all');
  g.set('L10', 'Un dosar se poate elimina de la 1 ianuarie după anul lui plus anii de păstrare.', { i: true, color: '#666666' });
  g.set('L11', 'Termene uzuale: documentele contabile 5 ani, registrul-jurnal și inventarul 10 ani, statele de plată 50 de ani.', { i: true, color: '#666666' });
  g.set('L12', 'Eliminarea se face cu proces-verbal; apoi scrie „Da” la Eliminat.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 260, C: 150, D: 70, E: 120, F: 150, G: 90, H: 140, I: 110, J: 80, K: 30, L: 290, M: 90 });
  return doc('Evidența arhivei', g.sheet('Arhivă'));
}

function urmarireObiective(): SheetDoc {
  const g = new Grid();
  const last = 31;
  g.head(1, ['Nr.', 'Obiectivul', 'Unitatea', 'Pornire', 'Ținta', 'Realizat acum', 'Progres', 'Cine răspunde', 'Început', 'Termen', 'Ar trebui să fie', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    // Progresul merge și la obiectivele care scad (costuri, reclamații): de la pornire spre țintă.
    g.set(`G${r}`, `=IF(OR(B${r}="";E${r}="";F${r}="");"";IF(E${r}=D${r};IF(F${r}=E${r};1;0);MAX(0;(F${r}-D${r})/(E${r}-D${r}))))`, { ...PCT, align: 'center' });
    g.set(`K${r}`, `=IF(OR(B${r}="";I${r}="";J${r}="";J${r}<=I${r});"";MAX(0;MIN(1;(TODAY()-I${r})/(J${r}-I${r}))))`, { ...PCT, align: 'center' });
    g.set(`L${r}`, `=IF(B${r}="";"";IF(G${r}="";"Fără date";IF(G${r}>=1;"Atins";IF(AND(J${r}<>"";J${r}<TODAY());"Întârziat";IF(AND(K${r}<>"";K${r}-G${r}>1/10);"În urmă";"Pe drum")))))`, { align: 'center' });
  }
  for (const c of 'IJ') g.col(c, 2, last, DATE);
  for (const c of 'CDEF') g.col(c, 2, last, { align: 'center' });
  g.box(`A1:L${last}`, 'all');
  g.rules.push(
    { range: `L2:L${last}`, op: 'eq', v1: 'Atins', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'În urmă', look: 'yellow' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Întârziat', look: 'red' },
  );
  g.set('N1', 'Pe scurt', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Obiective'); g.set('O2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('N3', 'Atinse', { color: '#006100' }); g.set('O3', `=COUNTIF(L2:L${last};"Atins")`, { align: 'center', color: '#006100' });
  g.set('N4', 'Pe drum'); g.set('O4', `=COUNTIF(L2:L${last};"Pe drum")`, { align: 'center' });
  g.set('N5', 'În urmă', { color: '#9c5700' }); g.set('O5', `=COUNTIF(L2:L${last};"În urmă")`, { align: 'center', color: '#9c5700' });
  g.set('N6', 'Întârziate (termenul a trecut)', { b: true, color: '#9c0006' }); g.set('O6', `=COUNTIF(L2:L${last};"Întârziat")`, { align: 'center', b: true, color: '#9c0006' });
  g.set('N7', 'Fără date încă'); g.set('O7', `=COUNTIF(L2:L${last};"Fără date")`, { align: 'center' });
  g.set('N8', 'Progresul mediu', { b: true }); g.set('O8', `=IF(COUNT(G2:G${last})=0;"";AVERAGE(G2:G${last}))`, { ...PCT, align: 'center', b: true });
  g.box('N1:O8', 'all');
  g.set('N10', 'Progresul = cât s-a făcut din drumul de la pornire până la țintă; merge și când ținta e mai mică (costuri, reclamații).', { i: true, color: '#666666' });
  g.set('N11', '„Ar trebui să fie” = cât din timp a trecut între început și termen; un obiectiv rămas în urmă cu peste 10% iese în galben.', { i: true, color: '#666666' });
  g.set('N12', 'Actualizează coloana „Realizat acum” o dată pe lună, înainte de ședință.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 260, C: 100, D: 80, E: 80, F: 110, G: 80, H: 150, I: 100, J: 100, K: 120, L: 100, M: 30, N: 300, O: 90 });
  return doc('Urmărirea obiectivelor', g.sheet('Obiective'));
}

function vechimeCreante(): SheetDoc {
  const g = new Grid();
  const last = 51, tot = last + 1;
  g.head(1, ['Nr.', 'Clientul', 'Nr. factură', 'Data facturii', 'Scadența', 'Total factură', 'Încasat', 'Rest de încasat', 'Zile de întârziere', 'Nescadent', '1–30 zile', '31–60 zile', '61–90 zile', 'Peste 90 zile']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`H${r}`, `=IF(F${r}="";"";F${r}-G${r})`, LEI);
    // Zilele de întârziere numără doar la facturile cu rest; fără scadență, factura e socotită nescadentă.
    g.set(`I${r}`, `=IF(OR(H${r}="";H${r}<=0);"";IF(E${r}="";0;MAX(0;TODAY()-E${r})))`, { align: 'center' });
    g.set(`J${r}`, `=IF(I${r}="";"";IF(I${r}=0;H${r};""))`, LEI);
    g.set(`K${r}`, `=IF(I${r}="";"";IF(AND(I${r}>=1;I${r}<=30);H${r};""))`, LEI);
    g.set(`L${r}`, `=IF(I${r}="";"";IF(AND(I${r}>=31;I${r}<=60);H${r};""))`, LEI);
    g.set(`M${r}`, `=IF(I${r}="";"";IF(AND(I${r}>=61;I${r}<=90);H${r};""))`, LEI);
    g.set(`N${r}`, `=IF(I${r}="";"";IF(I${r}>90;H${r};""))`, LEI);
  }
  for (const c of 'DE') g.col(c, 2, last, DATE);
  for (const c of 'FG') g.col(c, 2, last, LEI);
  g.col('C', 2, last, { align: 'center' });
  g.set(`B${tot}`, 'Total', { b: true });
  for (const c of 'FGHJKLMN') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, b: true });
  g.box(`A1:N${tot}`, 'all');
  g.rules.push(
    { range: `J2:J${last}`, op: 'gt', v1: '0', look: 'green' },
    { range: `L2:M${last}`, op: 'gt', v1: '0', look: 'yellow' },
    { range: `N2:N${last}`, op: 'gt', v1: '0', look: 'red' },
  );
  g.set('P1', 'Pe scurt', HEAD); g.set('Q1', '', HEAD); g.set('R1', 'Din total', HEAD);
  const pct = (r: number) => g.set(`R${r}`, `=IF(Q$2=0;"";Q${r}/Q$2)`, { ...PCT, align: 'center' });
  g.set('P2', 'De încasat în total', { b: true }); g.set('Q2', `=H${tot}`, { ...LEI, b: true });
  g.set('P3', 'Nescadent', { color: '#006100' }); g.set('Q3', `=J${tot}`, { ...LEI, color: '#006100' }); pct(3);
  g.set('P4', 'Întârziat 1–30 de zile'); g.set('Q4', `=K${tot}`, LEI); pct(4);
  g.set('P5', 'Întârziat 31–60 de zile', { color: '#9c5700' }); g.set('Q5', `=L${tot}`, { ...LEI, color: '#9c5700' }); pct(5);
  g.set('P6', 'Întârziat 61–90 de zile', { color: '#9c5700' }); g.set('Q6', `=M${tot}`, { ...LEI, color: '#9c5700' }); pct(6);
  g.set('P7', 'Întârziat peste 90 de zile', { b: true, color: '#9c0006' }); g.set('Q7', `=N${tot}`, { ...LEI, b: true, color: '#9c0006' }); pct(7);
  g.set('P8', 'Facturi întârziate'); g.set('Q8', `=COUNTIF(I2:I${last};">0")`, { align: 'center' });
  g.set('P9', 'Întârzierea cea mai mare (zile)'); g.set('Q9', `=IF(COUNT(I2:I${last})=0;"";MAX(I2:I${last}))`, { align: 'center' });
  g.box('P1:R9', 'all');
  g.set('P11', 'Scrie fiecare factură emisă și cât s-a încasat din ea: restul se pune singur în coloana după vechime.', { i: true, color: '#666666' });
  g.set('P12', 'Pentru întârzierile mari trimite o notificare (Docs → Notificare de plată) sau propune o eșalonare.', { i: true, color: '#666666' });
  g.set('P13', 'Facturile încasate complet nu mai apar în coloanele de vechime.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 220, C: 100, D: 100, E: 100, F: 120, G: 120, H: 130, I: 110, J: 120, K: 110, L: 110, M: 110, N: 120, O: 30, P: 250, Q: 130, R: 90 });
  return doc('Vechimea creanțelor', g.sheet('Creanțe'));
}

function comisioaneAgenti(): SheetDoc {
  const g = new Grid();
  const last = 41, tot = last + 1;
  g.head(1, ['Nr.', 'Agentul', 'Luna', 'Vânzări (fără TVA)', 'Ținta lunii', 'Realizare', 'Procent comision', 'Comision', 'Bonus', 'Total de plată']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`F${r}`, `=IF(OR(D${r}="";E${r}="";E${r}=0);"";D${r}/E${r})`, { ...PCT, align: 'center' });
    // Procentul mare se dă de la ținta atinsă; fără țintă se socotește procentul mic.
    g.set(`G${r}`, `=IF(D${r}="";"";IF(AND(F${r}<>"";F${r}>=1);$N$3;$N$2))`, { ...PCT, align: 'center' });
    g.set(`H${r}`, `=IF(D${r}="";"";ROUND(D${r}*G${r};2))`, LEI);
    g.set(`I${r}`, `=IF(OR(F${r}="";F${r}<$N$4);"";$N$5)`, LEI);
    g.set(`J${r}`, `=IF(D${r}="";"";H${r}+IF(I${r}="";0;I${r}))`, { ...LEI, b: true });
  }
  for (const c of 'DE') g.col(c, 2, last, LEI);
  g.col('C', 2, last, { align: 'center' });
  g.set(`B${tot}`, 'Total', { b: true });
  for (const c of 'DEHIJ') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, b: true });
  g.box(`A1:J${tot}`, 'all');
  g.rules.push(
    { range: `F2:F${last}`, op: 'lt', v1: '0.8', look: 'red' },
    { range: `F2:F${last}`, op: 'gt', v1: '0.9999', look: 'green' },
  );
  g.set('M1', 'Regulile comisionului', HEAD); g.set('N1', '', HEAD);
  g.set('M2', 'Procent sub țintă'); g.set('N2', '0,03', { ...PCT, align: 'center' });
  g.set('M3', 'Procent de la ținta atinsă'); g.set('N3', '0,05', { ...PCT, align: 'center' });
  g.set('M4', 'Bonus de la realizarea de'); g.set('N4', '1,2', { ...PCT, align: 'center' });
  g.set('M5', 'Bonusul (lei)'); g.set('N5', '500', LEI);
  g.box('M1:N5', 'all');
  g.set('M7', 'Pe scurt', HEAD); g.set('N7', '', HEAD);
  g.set('M8', 'Vânzări în total'); g.set('N8', `=D${tot}`, LEI);
  g.set('M9', 'Realizarea medie'); g.set('N9', `=IF(COUNT(F2:F${last})=0;"";AVERAGE(F2:F${last}))`, { ...PCT, align: 'center' });
  g.set('M10', 'Rânduri cu ținta atinsă', { color: '#006100' }); g.set('N10', `=COUNTIF(F2:F${last};">=1")`, { align: 'center', color: '#006100' });
  g.set('M11', 'Rânduri sub 80% din țintă', { color: '#9c0006' }); g.set('N11', `=COUNTIF(F2:F${last};"<0,8")`, { align: 'center', color: '#9c0006' });
  g.set('M12', 'Comisioane și bonusuri de plată', { b: true }); g.set('N12', `=J${tot}`, { ...LEI, b: true });
  g.set('M13', 'Cât din vânzări merge pe comisioane'); g.set('N13', `=IF(N8=0;"";N12/N8)`, { ...PCT, align: 'center' });
  g.box('M7:N13', 'all');
  g.set('M15', 'Un rând pe agent și lună: scrie vânzările fără TVA și ținta; comisionul și bonusul ies singure.', { i: true, color: '#666666' });
  g.set('M16', 'Schimbă procentele și bonusul din „Regulile comisionului”: se recalculează tot tabelul.', { i: true, color: '#666666' });
  g.set('M17', 'Comisionul se plătește de obicei odată cu salariul (Sheets → Stat de plată), ca venit din salarii.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 200, C: 90, D: 140, E: 120, F: 100, G: 120, H: 120, I: 100, J: 130, K: 30, L: 10, M: 260, N: 120 });
  return doc('Comisioanele agenților', g.sheet('Comisioane'));
}

function vizite(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  g.head(1, ['Nr.', 'Data vizitei', 'Agentul', 'Clientul', 'Localitatea', 'Scopul', 'Rezultatul', 'Valoarea comenzii', 'Următoarea vizită', 'Zile până atunci']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(D${r}="";"";ROW()-1)`, { align: 'center' });
    // Zilele până la următoarea vizită: negative = vizita trebuia făcută deja (în roșu), până la 7 = săptămâna asta (în galben).
    g.set(`J${r}`, `=IF(I${r}="";"";I${r}-TODAY())`, { align: 'center' });
  }
  g.col('B', 2, last, DATE); g.col('I', 2, last, DATE);
  g.col('H', 2, last, LEI);
  g.lists.push({ range: `F2:F${last}`, values: ['Prezentare', 'Ofertă', 'Comandă', 'Încasare', 'Reclamație', 'Altele'] });
  g.lists.push({ range: `G2:G${last}`, values: ['Comandă', 'Ofertă cerută', 'De revenit', 'Fără rezultat'] });
  g.set(`D${tot}`, 'Total', { b: true });
  g.set(`H${tot}`, `=SUM(H2:H${last})`, { ...LEI, b: true });
  g.box(`A1:J${tot}`, 'all');
  g.rules.push(
    { range: `J2:J${last}`, op: 'lt', v1: '0', look: 'red' },
    { range: `J2:J${last}`, op: 'between', v1: '0', v2: '7', look: 'yellow' },
    { range: `G2:G${last}`, op: 'eq', v1: 'Comandă', look: 'green' },
  );
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Vizite trecute în tabel'); g.set('M2', `=COUNTA(D2:D${last})`, { align: 'center' });
  g.set('L3', 'Vizite cu comandă', { color: '#006100' }); g.set('M3', `=COUNTIF(G2:G${last};"Comandă")`, { align: 'center', color: '#006100' });
  g.set('L4', 'Din vizite, cu comandă'); g.set('M4', '=IF(M2=0;"";M3/M2)', { ...PCT, align: 'center' });
  g.set('L5', 'Valoarea comenzilor'); g.set('M5', `=H${tot}`, LEI);
  g.set('L6', 'Comanda medie'); g.set('M6', '=IF(M3=0;"";M5/M3)', LEI);
  g.set('L7', 'Clienți de revenit', { color: '#9c5700' }); g.set('M7', `=COUNTIF(G2:G${last};"De revenit")+COUNTIF(G2:G${last};"Ofertă cerută")`, { align: 'center', color: '#9c5700' });
  g.set('L8', 'Vizite întârziate', { b: true, color: '#9c0006' }); g.set('M8', `=COUNTIF(J2:J${last};"<0")`, { align: 'center', b: true, color: '#9c0006' });
  g.box('L1:M8', 'all');
  g.set('L10', 'Un rând pe vizită: data, agentul, clientul și ce s-a ales; valoarea doar la comenzi.', { i: true, color: '#666666' });
  g.set('L11', 'Scrie data următoarei vizite: cele întârziate ies în roșu, cele din săptămâna asta în galben.', { i: true, color: '#666666' });
  g.set('L12', 'Comenzile se trec apoi la vânzările agentului (Sheets → Comisioanele agenților).', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 110, C: 160, D: 200, E: 130, F: 120, G: 130, H: 140, I: 130, J: 110, K: 30, L: 240, M: 120 });
  return doc('Planul vizitelor la clienți', g.sheet('Vizite'));
}

function reclamatii(): SheetDoc {
  const g = new Grid();
  const last = 61;
  g.head(1, ['Nr.', 'Data primirii', 'Clientul', 'Factura / comanda', 'Produsul', 'Ce reclamă', 'Cauza', 'Rezolvarea', 'Termen de răspuns', 'Data închiderii', 'Zile de rezolvare', 'Zile până la termen', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(C${r}="";"";ROW()-1)`, { align: 'center' });
    // Termenul: 30 de zile de la primire (se poate scrie altă dată peste formulă).
    g.set(`I${r}`, `=IF(B${r}="";"";B${r}+30)`, DATE);
    g.set(`K${r}`, `=IF(J${r}="";"";J${r}-B${r})`, { align: 'center' });
    // Cât mai e până la termen, doar la cele deschise: negativ = termenul a trecut (în roșu), până la 5 zile = în galben.
    g.set(`L${r}`, `=IF(OR(C${r}="";J${r}<>"");"";I${r}-TODAY())`, { align: 'center' });
    g.set(`M${r}`, `=IF(C${r}="";"";IF(J${r}<>"";"Închisă";"Deschisă"))`, { align: 'center' });
  }
  g.col('B', 2, last, DATE); g.col('J', 2, last, DATE);
  g.lists.push({ range: `G2:G${last}`, values: ['Transport', 'Furnizor', 'Produs defect', 'Greșeala noastră', 'Nejustificată'] });
  g.lists.push({ range: `H2:H${last}`, values: ['Reparare', 'Înlocuire', 'Banii înapoi', 'Reducere de preț', 'Respinsă'] });
  g.box(`A1:M${last}`, 'all');
  g.rules.push(
    { range: `L2:L${last}`, op: 'lt', v1: '0', look: 'red' },
    { range: `L2:L${last}`, op: 'between', v1: '0', v2: '5', look: 'yellow' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Închisă', look: 'green' },
  );
  g.set('O1', 'Pe scurt', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Reclamații trecute în tabel'); g.set('P2', `=COUNTA(C2:C${last})`, { align: 'center' });
  g.set('O3', 'Închise', { color: '#006100' }); g.set('P3', `=COUNTIF(M2:M${last};"Închisă")`, { align: 'center', color: '#006100' });
  g.set('O4', 'Deschise'); g.set('P4', `=COUNTIF(M2:M${last};"Deschisă")`, { align: 'center' });
  g.set('O5', 'Cu termenul trecut', { b: true, color: '#9c0006' }); g.set('P5', `=COUNTIF(L2:L${last};"<0")`, { align: 'center', b: true, color: '#9c0006' });
  g.set('O6', 'Zile de rezolvare, în medie'); g.set('P6', `=IF(P3=0;"";SUM(K2:K${last})/P3)`, { align: 'center' });
  g.set('O7', 'Din vina noastră sau a produsului'); g.set('P7', `=IF(P2=0;"";(COUNTIF(G2:G${last};"Greșeala noastră")+COUNTIF(G2:G${last};"Produs defect"))/P2)`, { ...PCT, align: 'center' });
  g.set('O8', 'Nejustificate'); g.set('P8', `=COUNTIF(G2:G${last};"Nejustificată")`, { align: 'center' });
  g.box('O1:P8', 'all');
  g.set('O10', 'Un rând pe reclamație: data primirii, clientul, ce reclamă; cauza și rezolvarea din listă.', { i: true, color: '#666666' });
  g.set('O11', 'Termenul de răspuns e la 30 de zile; cele cu termenul trecut ies în roșu, cele cu cel mult 5 zile rămase în galben.', { i: true, color: '#666666' });
  g.set('O12', 'Când scrii data închiderii, reclamația trece singură la Închisă (pașii, în Notițe → Reclamația unui client).', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 110, C: 180, D: 130, E: 160, F: 220, G: 130, H: 130, I: 120, J: 120, K: 100, L: 120, M: 100, N: 30, O: 260, P: 110 });
  return doc('Registrul reclamațiilor', g.sheet('Reclamații'));
}

// Termenele de protecția muncii: tot ce trebuie verificat sau refăcut la termen (instruirea periodică, controlul medical,
// stingătoarele, instalația electrică, trusa de prim ajutor); din data ultimei verificări și din câte în câte luni se face ies
// data următoare, zilele rămase și starea (Expirat în roșu, În curând în galben cu 30 de zile înainte, La zi în verde).
function termeneSsm(): SheetDoc {
  const g = new Grid();
  const last = 61;
  g.head(1, ['Nr.', 'Ce se verifică', 'Pentru cine / unde', 'Ultima verificare', 'La câte luni', 'Următoarea', 'Zile rămase', 'Starea', 'Cine răspunde', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`F${r}`, `=IF(OR(D${r}="";E${r}="");"";EDATE(D${r};E${r}))`, DATE);
    g.set(`G${r}`, `=IF(F${r}="";"";F${r}-TODAY())`, { align: 'center' });
    g.set(`H${r}`, `=IF(B${r}="";"";IF(G${r}="";"Fără dată";IF(G${r}<0;"Expirat";IF(G${r}<=30;"În curând";"La zi"))))`, { align: 'center' });
  }
  g.col('D', 2, last, DATE);
  g.col('E', 2, last, { align: 'center' });
  g.lists.push({ range: `B2:B${last}`, values: ['Instruire periodică', 'Control medical', 'Stingător', 'Instalația electrică', 'Trusa de prim ajutor', 'Echipament de protecție', 'Hidrant', 'Instalația de gaze', 'Alta'] });
  g.box(`A1:J${last}`, 'all');
  g.rules.push(
    { range: `H2:H${last}`, op: 'eq', v1: 'Expirat', look: 'red' },
    { range: `H2:H${last}`, op: 'eq', v1: 'În curând', look: 'yellow' },
    { range: `H2:H${last}`, op: 'eq', v1: 'La zi', look: 'green' },
  );
  g.set('L1', 'Pe scurt', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Verificări trecute în tabel'); g.set('M2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('L3', 'La zi', { color: '#006100' }); g.set('M3', `=COUNTIF(H2:H${last};"La zi")`, { align: 'center', color: '#006100' });
  g.set('L4', 'În următoarele 30 de zile', { color: '#9c5700' }); g.set('M4', `=COUNTIF(H2:H${last};"În curând")`, { align: 'center', b: true });
  g.set('L5', 'Expirate', { b: true, color: '#9c0006' }); g.set('M5', `=COUNTIF(H2:H${last};"Expirat")`, { align: 'center', b: true, color: '#9c0006' });
  g.set('L6', 'Fără dată'); g.set('M6', `=COUNTIF(H2:H${last};"Fără dată")`, { align: 'center' });
  g.box('L1:M6', 'all');
  g.set('L8', 'Un rând pe verificare: ce, pentru cine sau unde, data ultimei verificări și din câte în câte luni se face.', { i: true, color: '#666666' });
  g.set('L9', 'De obicei: instruirea periodică la 6 sau 12 luni, controlul medical la 12 luni, stingătoarele la 12 luni (vezi ce cere firma ta de protecția muncii).', { i: true, color: '#666666' });
  g.set('L10', 'Ce e expirat iese în roșu, ce expiră în 30 de zile în galben; verificarea pe loc, în Notițe → Verificarea de protecția muncii.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 180, C: 180, D: 120, E: 95, F: 110, G: 95, H: 100, I: 150, J: 200, K: 30, L: 280, M: 90 });
  return doc('Termenele de protecția muncii', g.sheet('Termene'));
}

// Plan de mentenanță a utilajelor: stivuitoarele, cântarele, compresoarele și celelalte utilaje, cu fiecare lucrare care se
// repetă (revizie, verificare ISCIR, verificare metrologică, schimb de ulei); din ultima intervenție și din câte în câte zile se
// face ies data următoare, zilele rămase și starea (Depășită în roșu, În curând în galben cu 14 zile înainte, La zi în verde).
function mentenanta(): SheetDoc {
  const g = new Grid();
  const last = 61;
  g.head(1, ['Nr.', 'Utilajul', 'Nr. de inventar / serie', 'Lucrarea', 'Ultima intervenție', 'La câte zile', 'Următoarea', 'Zile rămase', 'Starea', 'Cine o face', 'Costul ultimei (lei)', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(E${r}="";F${r}="");"";E${r}+F${r})`, DATE);
    g.set(`H${r}`, `=IF(G${r}="";"";G${r}-TODAY())`, { align: 'center' });
    g.set(`I${r}`, `=IF(B${r}="";"";IF(H${r}="";"Fără dată";IF(H${r}<0;"Depășită";IF(H${r}<=14;"În curând";"La zi"))))`, { align: 'center' });
  }
  g.col('E', 2, last, DATE);
  g.col('F', 2, last, { align: 'center' });
  g.col('K', 2, last, LEI);
  g.lists.push({ range: `D2:D${last}`, values: ['Revizie periodică', 'Verificare ISCIR', 'Verificare metrologică', 'Schimb de ulei și filtre', 'Anvelope / roți', 'Baterie / încărcare', 'Curățenie și ungere', 'Verificare electrică', 'Alta'] });
  g.box(`A1:L${last}`, 'all');
  g.rules.push(
    { range: `I2:I${last}`, op: 'eq', v1: 'Depășită', look: 'red' },
    { range: `I2:I${last}`, op: 'eq', v1: 'În curând', look: 'yellow' },
    { range: `I2:I${last}`, op: 'eq', v1: 'La zi', look: 'green' },
  );
  g.set('N1', 'Pe scurt', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Lucrări trecute în tabel'); g.set('O2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('N3', 'La zi', { color: '#006100' }); g.set('O3', `=COUNTIF(I2:I${last};"La zi")`, { align: 'center', color: '#006100' });
  g.set('N4', 'În următoarele 14 zile', { color: '#9c5700' }); g.set('O4', `=COUNTIF(I2:I${last};"În curând")`, { align: 'center', b: true });
  g.set('N5', 'Depășite', { b: true, color: '#9c0006' }); g.set('O5', `=COUNTIF(I2:I${last};"Depășită")`, { align: 'center', b: true, color: '#9c0006' });
  g.set('N6', 'Fără dată'); g.set('O6', `=COUNTIF(I2:I${last};"Fără dată")`, { align: 'center' });
  g.set('N7', 'Costul ultimelor intervenții'); g.set('O7', `=SUM(K2:K${last})`, { ...LEI, b: true });
  g.box('N1:O7', 'all');
  g.set('N9', 'Un rând pe fiecare lucrare care se repetă: utilajul, lucrarea, data ultimei intervenții și din câte în câte zile se face.', { i: true, color: '#666666' });
  g.set('N10', 'De exemplu: revizia stivuitorului la 180 de zile, verificarea ISCIR la 365, cântarul la verificarea metrologică la 365 (vezi cartea tehnică a utilajului).', { i: true, color: '#666666' });
  g.set('N11', 'Ce e depășit iese în roșu, ce vine în 14 zile în galben; după intervenție scrii data nouă în „Ultima intervenție”.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 170, C: 140, D: 170, E: 120, F: 90, G: 110, H: 90, I: 100, J: 150, K: 120, L: 180, M: 30, N: 260, O: 100 });
  return doc('Plan de mentenanță a utilajelor', g.sheet('Mentenanță'));
}

// Programări clienți: pentru saloane, cabinete și service-uri; din oră și durată iese ora de sfârșit, din preț și avans restul de
// plată, iar „Când” arată dacă programarea e azi, a trecut sau urmează. În dreapta: câte sunt azi și de acum încolo, cât s-a încasat.
function programari(): SheetDoc {
  const g = new Grid();
  const last = 201;
  const TIME: CellStyle = { fmt: 'time', align: 'center' };
  g.head(1, ['Nr.', 'Data', 'Ora', 'Clientul', 'Telefonul', 'Serviciul', 'Durata (min)', 'Se termină la', 'Prețul (lei)', 'Avans (lei)', 'Rest de plată', 'Starea', 'Când', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(D${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`H${r}`, `=IF(OR(C${r}="";G${r}="");"";C${r}+G${r}/1440)`, TIME);
    g.set(`K${r}`, `=IF(OR(I${r}="";L${r}="Anulată";L${r}="Nu a venit");"";MAX(0;I${r}-J${r}))`, LEI);
    g.set(`M${r}`, `=IF(B${r}="";"";IF(B${r}=TODAY();"Azi";IF(B${r}<TODAY();"A trecut";"Urmează")))`, { align: 'center' });
  }
  g.col('B', 2, last, DATE);
  g.col('C', 2, last, TIME);
  g.col('G', 2, last, { align: 'center' });
  g.col('I', 2, last, LEI);
  g.col('J', 2, last, LEI);
  g.lists.push({ range: `L2:L${last}`, values: ['Programată', 'Confirmată', 'Realizată', 'Anulată', 'Nu a venit'] });
  g.box(`A1:N${last}`, 'all');
  g.rules.push(
    { range: `M2:M${last}`, op: 'eq', v1: 'Azi', look: 'yellow' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Realizată', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Anulată', look: 'red' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Nu a venit', look: 'red' },
  );
  g.set('P1', 'Pe scurt', HEAD); g.set('Q1', '', HEAD);
  g.set('P2', 'Programări trecute în tabel'); g.set('Q2', `=COUNTA(D2:D${last})`, { align: 'center' });
  g.set('P3', 'Azi (fără cele anulate)', { b: true, color: '#9c5700' }); g.set('Q3', `=COUNTIFS(M2:M${last};"Azi";L2:L${last};"<>Anulată")`, { align: 'center', b: true });
  g.set('P4', 'De acum încolo (fără cele anulate)'); g.set('Q4', `=COUNTIFS(M2:M${last};"Urmează";L2:L${last};"<>Anulată")`, { align: 'center' });
  g.set('P5', 'Realizate', { color: '#006100' }); g.set('Q5', `=COUNTIF(L2:L${last};"Realizată")`, { align: 'center', color: '#006100' });
  g.set('P6', 'Anulate sau neveniți', { color: '#9c0006' }); g.set('Q6', `=COUNTIF(L2:L${last};"Anulată")+COUNTIF(L2:L${last};"Nu a venit")`, { align: 'center', color: '#9c0006' });
  g.set('P7', 'Încasat din cele realizate'); g.set('Q7', `=SUMIF(L2:L${last};"Realizată";I2:I${last})`, { ...LEI, b: true });
  g.set('P8', 'Avansuri luate'); g.set('Q8', `=SUM(J2:J${last})`, LEI);
  g.set('P9', 'Rest de încasat (programate și confirmate)'); g.set('Q9', `=SUMIF(L2:L${last};"Programată";K2:K${last})+SUMIF(L2:L${last};"Confirmată";K2:K${last})`, LEI);
  g.box('P1:Q9', 'all');
  g.set('P11', 'Un rând pe fiecare programare: data, ora (de exemplu 14:30), clientul, serviciul, cât durează în minute și prețul.', { i: true, color: '#666666' });
  g.set('P12', 'Programările de azi ies în galben; după ce clientul a plecat, alegi „Realizată” la Starea.', { i: true, color: '#666666' });
  g.set('P13', 'Ca să vezi doar o zi: Date → Filtru pe coloana Data; ca să le ai în ordine: Date → Sortare după Data, apoi Ora.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 105, C: 70, D: 170, E: 120, F: 170, G: 90, H: 100, I: 100, J: 95, K: 100, L: 110, M: 85, N: 180, O: 30, P: 280, Q: 100 });
  return doc('Programări clienți', g.sheet('Programări'));
}

// Ore lucrate pe clienți (consultanți, avocați, contabili, programatori, meseriași pe oră): fiecare bucată de lucru cu data,
// clientul, de la ce oră până la ce oră și pauza; ies orele, valoarea după tariful rândului sau cel obișnuit din dreapta și dacă
// mai e de facturat. În dreapta: orele, partea facturabilă, cât e facturat și cât mai e de facturat, în total și pentru un client.
function oreClienti(): SheetDoc {
  const g = new Grid();
  const last = 201;
  const TIME: CellStyle = { fmt: 'time', align: 'center' };
  g.head(1, ['Nr.', 'Data', 'Clientul', 'Proiectul / dosarul', 'Ce s-a lucrat', 'De la', 'Până la', 'Pauză (min)', 'Ore lucrate', 'Facturabil', 'Tariful (lei / oră)', 'Valoarea (lei)', 'Facturat', 'Factura nr.', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(C${r}="";"";ROW()-1)`, { align: 'center' });
    // Lucrul trecut de miezul nopții (22:00 – 01:00) se numără pe aceeași zi.
    g.set(`I${r}`, `=IF(OR(F${r}="";G${r}="");"";ROUND(MAX(0;(G${r}-F${r}+IF(G${r}<F${r};1;0))*24-N(H${r})/60);2))`, { align: 'center', fmt: 'number', dec: 2 });
    g.set(`L${r}`, `=IF(OR(I${r}="";J${r}="Nu");"";ROUND(I${r}*IF(K${r}="";N($R$2);N(K${r}));2))`, LEI);
    g.set(`O${r}`, `=IF(L${r}="";"";IF(M${r}="Da";"Facturat";"De facturat"))`, { align: 'center' });
  }
  g.col('B', 2, last, DATE);
  g.col('F', 2, last, TIME);
  g.col('G', 2, last, TIME);
  g.col('H', 2, last, { align: 'center' });
  g.col('J', 2, last, { align: 'center' });
  g.col('K', 2, last, LEI);
  g.col('M', 2, last, { align: 'center' });
  g.lists.push({ range: `J2:J${last}`, values: ['Da', 'Nu'] }, { range: `M2:M${last}`, values: ['Da', 'Nu'] });
  g.box(`A1:O${last}`, 'all');
  g.rules.push(
    { range: `O2:O${last}`, op: 'eq', v1: 'Facturat', look: 'green' },
    { range: `O2:O${last}`, op: 'eq', v1: 'De facturat', look: 'yellow' },
  );
  g.set('Q1', 'Pe scurt', HEAD); g.set('R1', '', HEAD);
  g.set('Q2', 'Tariful obișnuit (lei / oră)', { b: true }); g.set('R2', '150', { ...LEI, b: true, bg: '#fff2cc' });
  g.set('Q3', 'Ore lucrate în total'); g.set('R3', `=SUM(I2:I${last})`, { align: 'center', fmt: 'number', dec: 2 });
  g.set('Q4', 'Din care facturabile'); g.set('R4', `=R3-SUMIF(J2:J${last};"Nu";I2:I${last})`, { align: 'center', fmt: 'number', dec: 2 });
  g.set('Q5', 'Partea facturabilă'); g.set('R5', '=IF(N(R3)=0;"";R4/R3)', PCT);
  g.set('Q6', 'Valoarea orelor facturabile'); g.set('R6', `=SUM(L2:L${last})`, LEI);
  g.set('Q7', 'Facturat deja', { color: '#006100' }); g.set('R7', `=SUMIF(M2:M${last};"Da";L2:L${last})`, { ...LEI, color: '#006100' });
  g.set('Q8', 'De facturat', { b: true, color: '#9c5700' }); g.set('R8', '=R6-R7', { ...LEI, b: true });
  g.set('Q10', 'Clientul ales', { b: true }); g.set('R10', '', { bg: '#fff2cc' });
  g.set('Q11', 'Ore lucrate pentru el'); g.set('R11', `=IF(R10="";"";SUMIF(C2:C${last};R10;I2:I${last}))`, { align: 'center', fmt: 'number', dec: 2 });
  g.set('Q12', 'De facturat pentru el', { b: true }); g.set('R12', `=IF(R10="";"";SUMIF(C2:C${last};R10;L2:L${last})-SUMIFS(L2:L${last};C2:C${last};R10;M2:M${last};"Da"))`, { ...LEI, b: true });
  g.box('Q1:R8', 'all'); g.box('Q10:R12', 'all');
  g.set('Q14', 'Un rând pe fiecare bucată de lucru: data, clientul, orele (de exemplu 9:00 și 12:30) și pauza în minute.', { i: true, color: '#666666' });
  g.set('Q15', 'Tariful rândului se scrie doar când e altul decât cel obișnuit; „Nu” la Facturabil = ore care nu se plătesc.', { i: true, color: '#666666' });
  g.set('Q16', 'După ce ai emis factura, alegi „Da” la Facturat și scrii numărul ei; la Clientul ales vezi cât mai ai de facturat cuiva.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 105, C: 170, D: 160, E: 220, F: 75, G: 75, H: 85, I: 90, J: 85, K: 120, L: 110, M: 80, N: 100, O: 105, P: 30, Q: 260, R: 120 });
  return doc('Ore lucrate pe clienți', g.sheet('Ore'));
}

// Termene de valabilitate pe loturi (farmacii, magazine, restaurante, depozite): fiecare lot cu produsul, lotul, raftul,
// cantitatea, prețul de achiziție și data expirării; ies zilele rămase, valoarea lotului și starea: expirat (în roșu), expiră în
// 30 de zile (în galben), în 90 de zile (în albastru), valabil (în verde) sau retras. În dreapta: ce valoare e expirată și ce
// expiră curând, plus cel mai apropiat termen, cu produsul și lotul lui.
function valabilitateLoturi(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Nr.', 'Produsul', 'Lotul', 'Raftul / locul', 'Cantitatea', 'Preț de achiziție', 'Valoarea lotului', 'Data expirării', 'Zile rămase', 'Retras', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(B${r}="";"";E${r}*F${r})`, LEI);
    g.set(`I${r}`, `=IF(OR(B${r}="";H${r}="";J${r}="Da");"";H${r}-TODAY())`, { align: 'center' });
    g.set(`K${r}`, `=IF(B${r}="";"";IF(J${r}="Da";"Retras";IF(H${r}="";"Fără dată";IF(H${r}<TODAY();"Expirat";IF(H${r}-TODAY()<=30;"În 30 de zile";IF(H${r}-TODAY()<=90;"În 90 de zile";"Valabil"))))))`, { align: 'center' });
  }
  g.col('E', 2, last, { align: 'center' });
  g.col('F', 2, last, LEI);
  g.col('H', 2, last, DATE);
  g.col('J', 2, last, { align: 'center' });
  g.lists.push({ range: `J2:J${last}`, values: ['Da', 'Nu'] });
  g.box(`A1:K${last}`, 'all');
  g.rules.push(
    { range: `K2:K${last}`, op: 'eq', v1: 'Expirat', look: 'red' },
    { range: `K2:K${last}`, op: 'eq', v1: 'În 30 de zile', look: 'yellow' },
    { range: `K2:K${last}`, op: 'eq', v1: 'În 90 de zile', look: 'blue' },
    { range: `K2:K${last}`, op: 'eq', v1: 'Valabil', look: 'green' },
  );
  g.set('M1', 'Pe scurt', HEAD); g.set('N1', '', HEAD);
  g.set('M2', 'Loturi în raft'); g.set('N2', `=COUNTA(B2:B${last})-COUNTIF(J2:J${last};"Da")`, { align: 'center' });
  g.set('M3', 'Loturi expirate', { b: true, color: '#c00000' }); g.set('N3', `=COUNTIF(K2:K${last};"Expirat")`, { align: 'center', b: true, color: '#c00000' });
  g.set('M4', 'Valoarea expirată', { b: true, color: '#c00000' }); g.set('N4', `=SUMIF(K2:K${last};"Expirat";G2:G${last})`, { ...LEI, b: true, color: '#c00000' });
  g.set('M5', 'Loturi în 30 de zile', { b: true, color: '#9c6500' }); g.set('N5', `=COUNTIF(K2:K${last};"În 30 de zile")`, { align: 'center', b: true, color: '#9c6500' });
  g.set('M6', 'Valoarea în 30 de zile', { b: true, color: '#9c6500' }); g.set('N6', `=SUMIF(K2:K${last};"În 30 de zile";G2:G${last})`, { ...LEI, b: true, color: '#9c6500' });
  g.set('M7', 'Valoarea în raft'); g.set('N7', `=SUMIF(J2:J${last};"<>Da";G2:G${last})`, LEI);
  g.set('M8', 'Cel mai apropiat termen', { b: true }); g.set('N8', `=IF(COUNTIF(I2:I${last};">=0")=0;"";MINIFS(H2:H${last};I2:I${last};">=0"))`, { ...DATE, b: true });
  g.set('M9', 'Produsul'); g.set('N9', `=IF(N8="";"";INDEX(B2:B${last};MATCH(N8;H2:H${last};0)))`);
  g.set('M10', 'Lotul'); g.set('N10', `=IF(N8="";"";INDEX(C2:C${last};MATCH(N8;H2:H${last};0)))`);
  g.box('M1:N10', 'all');
  g.set('M12', 'Ce expiră în 30 de zile iese în galben: pune-l în față la raft, la promoție sau cere returul la furnizor.', { i: true, color: '#666666' });
  g.set('M13', 'Lotul scos din raft (expirat, distrus sau returnat) primește Retras = Da și nu mai intră la valoarea din raft.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 220, C: 110, D: 120, E: 85, F: 110, G: 120, H: 110, I: 90, J: 65, K: 120, L: 30, M: 190, N: 140 });
  return doc('Termene de valabilitate pe loturi', g.sheet('Loturi'));
}

// Evidența stingătoarelor (firme, magazine, asociații de proprietari, școli): fiecare stingător cu seria, tipul, locul, anul
// fabricației și data ultimei verificări; ies verificarea următoare (după câte luni scrie în dreapta, de obicei 12), zilele rămase
// și starea: expirat sau defect (în roșu), în 30 de zile (în galben), la zi (în verde), fără verificare sau scos din uz.
function stingatoare(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Nr.', 'Seria / numărul', 'Tipul', 'Locul (etaj, încăperea)', 'Anul fabricației', 'Ultima verificare', 'Verificarea următoare', 'Zile rămase', 'Presiune și sigiliu în regulă', 'Scos din uz', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(B${r}="";F${r}="");"";EDATE(F${r};$N$2))`, DATE);
    g.set(`H${r}`, `=IF(OR(B${r}="";F${r}="";J${r}="Da");"";G${r}-TODAY())`, { align: 'center' });
    g.set(`K${r}`, `=IF(B${r}="";"";IF(J${r}="Da";"Scos din uz";IF(I${r}="Nu";"Defect";IF(F${r}="";"Fără verificare";IF(G${r}<TODAY();"Expirat";IF(G${r}-TODAY()<=30;"În 30 de zile";"La zi"))))))`, { align: 'center' });
  }
  g.col('C', 2, last, { align: 'center' });
  g.col('E', 2, last, { align: 'center' });
  g.col('F', 2, last, DATE);
  g.col('I', 2, last, { align: 'center' });
  g.col('J', 2, last, { align: 'center' });
  g.lists.push(
    { range: `C2:C${last}`, values: ['P1', 'P2', 'P6', 'P9', 'P50', 'CO2 2 kg', 'CO2 5 kg', 'Spumă 6 l', 'Apă 6 l'] },
    { range: `I2:I${last}`, values: ['Da', 'Nu'] },
    { range: `J2:J${last}`, values: ['Da', 'Nu'] },
  );
  g.box(`A1:K${last}`, 'all');
  g.rules.push(
    { range: `K2:K${last}`, op: 'eq', v1: 'Expirat', look: 'red' },
    { range: `K2:K${last}`, op: 'eq', v1: 'Defect', look: 'red' },
    { range: `K2:K${last}`, op: 'eq', v1: 'În 30 de zile', look: 'yellow' },
    { range: `K2:K${last}`, op: 'eq', v1: 'La zi', look: 'green' },
  );
  g.set('M1', 'Pe scurt', HEAD); g.set('N1', '', HEAD);
  g.set('M2', 'Verificare la (luni)', { b: true }); g.set('N2', '12', { align: 'center', b: true });
  g.set('M3', 'Stingătoare în uz'); g.set('N3', `=COUNTA(B2:B${last})-COUNTIF(J2:J${last};"Da")`, { align: 'center' });
  g.set('M4', 'Expirate', { b: true, color: '#c00000' }); g.set('N4', `=COUNTIF(K2:K${last};"Expirat")`, { align: 'center', b: true, color: '#c00000' });
  g.set('M5', 'Defecte', { b: true, color: '#c00000' }); g.set('N5', `=COUNTIF(K2:K${last};"Defect")`, { align: 'center', b: true, color: '#c00000' });
  g.set('M6', 'În 30 de zile', { b: true, color: '#9c6500' }); g.set('N6', `=COUNTIF(K2:K${last};"În 30 de zile")`, { align: 'center', b: true, color: '#9c6500' });
  g.set('M7', 'Fără verificare'); g.set('N7', `=COUNTIF(K2:K${last};"Fără verificare")`, { align: 'center' });
  g.set('M8', 'Cea mai apropiată verificare', { b: true }); g.set('N8', `=IF(COUNTIF(H2:H${last};">=0")=0;"";MINIFS(G2:G${last};H2:H${last};">=0"))`, { ...DATE, b: true });
  g.set('M9', 'Stingătorul'); g.set('N9', `=IF(N8="";"";INDEX(B2:B${last};MATCH(N8;G2:G${last};0)))`);
  g.set('M10', 'Locul'); g.set('N10', `=IF(N8="";"";INDEX(D2:D${last};MATCH(N8;G2:G${last};0)))`);
  g.box('M1:N10', 'all');
  g.set('M12', 'Câte luni trec între verificări scrie firma autorizată care le verifică; schimbă 12 din N2 dacă e altfel.', { i: true, color: '#666666' });
  g.set('M13', 'Un stingător descărcat, cu sigiliul rupt sau cu acul presiunii în afara zonei verzi: Presiune și sigiliu = Nu (iese Defect).', { i: true, color: '#666666' });
  g.set('M14', 'Pe planul de evacuare: Docs → Inserare → ☺ Pictograme → Protecția muncii (stingătorul) și Pompieri și urgențe.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 140, C: 90, D: 200, E: 90, F: 110, G: 120, H: 85, I: 120, J: 80, K: 120, L: 30, M: 210, N: 140 });
  return doc('Evidența stingătoarelor', g.sheet('Stingătoare'));
}

// Comenzi de mobilier (ateliere și magazine de mobilă la comandă): fiecare comandă cu clientul, telefonul, produsul, dimensiunile,
// data comenzii, termenul de livrare, prețul și cât s-a încasat; ies restul de plată, zilele până la termen și starea: întârziat
// (în roșu), în 7 zile (în galben), livrat dar de încasat (în galben), gata (în verde), fără termen sau în lucru.
function comenziMobilier(): SheetDoc {
  const g = new Grid();
  const last = 101;
  g.head(1, ['Nr.', 'Clientul', 'Telefonul', 'Produsul', 'Dimensiuni, material, culoare', 'Data comenzii', 'Termenul de livrare', 'Prețul', 'Încasat până acum', 'Rest de plată', 'Livrat și montat', 'Zile până la termen', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`J${r}`, `=IF(B${r}="";"";H${r}-I${r})`, LEI);
    g.set(`L${r}`, `=IF(OR(B${r}="";G${r}="";K${r}="Da");"";G${r}-TODAY())`, { align: 'center' });
    g.set(`M${r}`, `=IF(B${r}="";"";IF(K${r}="Da";IF(J${r}>0;"De încasat";"Gata");IF(G${r}="";"Fără termen";IF(G${r}<TODAY();"Întârziat";IF(G${r}-TODAY()<=7;"În 7 zile";"În lucru")))))`, { align: 'center' });
  }
  g.col('F', 2, last, DATE);
  g.col('G', 2, last, DATE);
  g.col('H', 2, last, LEI);
  g.col('I', 2, last, LEI);
  g.col('K', 2, last, { align: 'center' });
  g.lists.push({ range: `K2:K${last}`, values: ['Da', 'Nu'] });
  g.box(`A1:M${last}`, 'all');
  g.rules.push(
    { range: `M2:M${last}`, op: 'eq', v1: 'Întârziat', look: 'red' },
    { range: `M2:M${last}`, op: 'eq', v1: 'În 7 zile', look: 'yellow' },
    { range: `M2:M${last}`, op: 'eq', v1: 'De încasat', look: 'yellow' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Gata', look: 'green' },
  );
  g.set('O1', 'Pe scurt', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Comenzi în lucru', { b: true }); g.set('P2', `=COUNTA(B2:B${last})-COUNTIF(K2:K${last};"Da")`, { align: 'center', b: true });
  g.set('O3', 'Întârziate', { b: true, color: '#c00000' }); g.set('P3', `=COUNTIF(M2:M${last};"Întârziat")`, { align: 'center', b: true, color: '#c00000' });
  g.set('O4', 'În 7 zile', { b: true, color: '#9c6500' }); g.set('P4', `=COUNTIF(M2:M${last};"În 7 zile")`, { align: 'center', b: true, color: '#9c6500' });
  g.set('O5', 'Valoarea comenzilor în lucru'); g.set('P5', `=SUMIF(K2:K${last};"<>Da";H2:H${last})`, LEI);
  g.set('O6', 'Încasat în total'); g.set('P6', `=SUM(I2:I${last})`, LEI);
  g.set('O7', 'Rest de încasat', { b: true }); g.set('P7', `=SUM(J2:J${last})`, { ...LEI, b: true });
  g.set('O8', 'Cel mai apropiat termen', { b: true }); g.set('P8', `=IF(COUNTIF(L2:L${last};">=0")=0;"";MINIFS(G2:G${last};L2:L${last};">=0"))`, { ...DATE, b: true });
  g.set('O9', 'Clientul'); g.set('P9', `=IF(P8="";"";INDEX(B2:B${last};MATCH(P8;G2:G${last};0)))`);
  g.set('O10', 'Produsul'); g.set('P10', `=IF(P8="";"";INDEX(D2:D${last};MATCH(P8;G2:G${last};0)))`);
  g.box('O1:P10', 'all');
  g.set('O12', 'La fiecare plată a clientului mărește „Încasat până acum”; o comandă livrată rămâne „De încasat” până se plătește tot.', { i: true, color: '#666666' });
  g.set('O13', 'Măsurătorile de la client: Notițe → 📋 Din șablon → 📐 Măsurători pentru mobilă la comandă.', { i: true, color: '#666666' });
  g.set('O14', 'Pe oferte și pliante: Docs → Inserare → ☺ Pictograme → Mobilier.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 150, C: 110, D: 160, E: 220, F: 110, G: 120, H: 100, I: 120, J: 110, K: 110, L: 120, M: 110, N: 30, O: 210, P: 140 });
  return doc('Comenzi de mobilier', g.sheet('Comenzi'));
}

// Termenele dosarelor (avocați, consilieri juridici, firme cu procese): fiecare dosar cu numărul, instanța, clientul, partea
// adversă, obiectul, stadiul și termenul următor; ies zilele până la termen și starea: în 7 zile (în galben), de actualizat după
// un termen trecut (în roșu), fără termen, închis sau în lucru. În dreapta: dosarele active și cel mai apropiat termen.
function termeneDosare(): SheetDoc {
  const g = new Grid();
  const last = 61;
  g.head(1, ['Nr.', 'Numărul dosarului', 'Instanța', 'Clientul', 'Partea adversă', 'Obiectul', 'Stadiul', 'Termenul următor', 'Ora', 'Zile până la termen', 'De pregătit până atunci', 'Închis', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`J${r}`, `=IF(OR(B${r}="";H${r}="";L${r}="Da");"";H${r}-TODAY())`, { align: 'center' });
    g.set(`M${r}`, `=IF(B${r}="";"";IF(L${r}="Da";"Închis";IF(H${r}="";"Fără termen";IF(H${r}<TODAY();"De actualizat";IF(H${r}-TODAY()<=7;"În 7 zile";"În lucru")))))`, { align: 'center' });
  }
  g.col('G', 2, last, { align: 'center' });
  g.col('H', 2, last, DATE);
  g.col('I', 2, last, { fmt: 'time', align: 'center' });
  g.col('L', 2, last, { align: 'center' });
  g.lists.push(
    { range: `G2:G${last}`, values: ['Fond', 'Apel', 'Recurs', 'Executare', 'Mediere', 'Contestație'] },
    { range: `L2:L${last}`, values: ['Da', 'Nu'] },
  );
  g.box(`A1:M${last}`, 'all');
  g.rules.push(
    { range: `M2:M${last}`, op: 'eq', v1: 'De actualizat', look: 'red' },
    { range: `M2:M${last}`, op: 'eq', v1: 'În 7 zile', look: 'yellow' },
    { range: `M2:M${last}`, op: 'eq', v1: 'În lucru', look: 'green' },
  );
  g.set('O1', 'Pe scurt', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Dosare active'); g.set('P2', `=COUNTA(B2:B${last})-COUNTIF(L2:L${last};"Da")`, { align: 'center' });
  g.set('O3', 'Termene în 7 zile', { b: true, color: '#9c6500' }); g.set('P3', `=COUNTIF(M2:M${last};"În 7 zile")`, { align: 'center', b: true, color: '#9c6500' });
  g.set('O4', 'De actualizat', { b: true, color: '#c00000' }); g.set('P4', `=COUNTIF(M2:M${last};"De actualizat")`, { align: 'center', b: true, color: '#c00000' });
  g.set('O5', 'Fără termen'); g.set('P5', `=COUNTIF(M2:M${last};"Fără termen")`, { align: 'center' });
  g.set('O6', 'Cel mai apropiat termen', { b: true }); g.set('P6', `=IF(COUNTIF(J2:J${last};">=0")=0;"";MINIFS(H2:H${last};J2:J${last};">=0"))`, { ...DATE, b: true });
  g.set('O7', 'Dosarul'); g.set('P7', `=IF(P6="";"";INDEX(B2:B${last};MATCH(P6;H2:H${last};0)))`);
  g.set('O8', 'Instanța'); g.set('P8', `=IF(P6="";"";INDEX(C2:C${last};MATCH(P6;H2:H${last};0)))`);
  g.box('O1:P8', 'all');
  g.set('O10', 'După fiecare termen scrie data următorului; un termen trecut și neschimbat iese „De actualizat” (în roșu).', { i: true, color: '#666666' });
  g.set('O11', 'La Închis = Da dosarul nu mai intră la cele active; la De pregătit treci actele, martorii sau taxa de timbru.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 150, C: 190, D: 170, E: 170, F: 200, G: 95, H: 110, I: 60, J: 95, K: 240, L: 65, M: 115, N: 30, O: 190, P: 150 });
  return doc('Termenele dosarelor', g.sheet('Dosare'));
}

// Compararea locuințelor (cine cumpără sau închiriază): fiecare anunț cu prețul, suprafața, camerele, etajul, cheltuielile
// lunare și drumul până la serviciu; ies prețul pe mp, un scor (nota ta, prețul pe mp față de cel mai mic și drumul față de cel
// mai scurt) și starea: peste buget, cea mai bună, vizitată sau de vizitat. În dreapta: media și cea mai ieftină pe mp.
function locuinte(): SheetDoc {
  const g = new Grid();
  const last = 21;
  const NUM0: CellStyle = { fmt: 'number', dec: 0, align: 'right' };
  g.head(1, ['Nr.', 'Locuința / anunțul', 'Zona', 'Prețul (€)', 'Suprafața utilă (mp)', 'Preț pe mp (€)', 'Camere', 'Etaj', 'Anul construcției', 'Cheltuieli lunare (lei)', 'Minute până la serviciu', 'Nota mea (1–10)', 'Scorul', 'Am vizitat-o', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`F${r}`, `=IF(OR(D${r}="";N(E${r})=0);"";ROUND(D${r}/E${r};0))`, NUM0);
    // Scorul din 10: 40% nota ta, 40% prețul pe mp (cel mai mic = 10), 20% drumul (cel mai scurt = 10; necompletat = 10).
    g.set(`M${r}`, `=IF(F${r}="";"";ROUND(0.4*N(L${r})+4*MIN($F$2:$F${last})/F${r}+0.2*IF(N(K${r})=0;10;10*MAX(1;MIN($K$2:$K${last}))/K${r});1))`, { align: 'center', fmt: 'number', dec: 1, b: true });
    g.set(`O${r}`, `=IF(F${r}="";"";IF(AND(N($R$2)>0;D${r}>N($R$2));"Peste buget";IF(M${r}=MAX($M$2:$M${last});"Cea mai bună";IF(N${r}="Da";"Vizitată";"De vizitat"))))`, { align: 'center' });
  }
  g.col('D', 2, last, NUM0);
  g.col('E', 2, last, { align: 'center' });
  g.col('G', 2, last, { align: 'center' });
  g.col('H', 2, last, { align: 'center' });
  g.col('I', 2, last, { align: 'center' });
  g.col('J', 2, last, LEI);
  g.col('K', 2, last, { align: 'center' });
  g.col('L', 2, last, { align: 'center' });
  g.col('N', 2, last, { align: 'center' });
  g.lists.push({ range: `N2:N${last}`, values: ['Da', 'Nu'] });
  g.box(`A1:O${last}`, 'all');
  g.rules.push(
    { range: `O2:O${last}`, op: 'eq', v1: 'Cea mai bună', look: 'green' },
    { range: `O2:O${last}`, op: 'eq', v1: 'Peste buget', look: 'red' },
    { range: `O2:O${last}`, op: 'eq', v1: 'De vizitat', look: 'yellow' },
  );
  g.set('Q1', 'Pe scurt', HEAD); g.set('R1', '', HEAD);
  g.set('Q2', 'Bugetul meu (€)', { b: true }); g.set('R2', '', { ...NUM0, b: true, bg: '#fff2cc' });
  g.set('Q3', 'Locuințe trecute'); g.set('R3', `=COUNT(F2:F${last})`, { align: 'center' });
  g.set('Q4', 'Prețul mediu pe mp (€)'); g.set('R4', `=IF(R3=0;"";ROUND(AVERAGE(F2:F${last});0))`, NUM0);
  g.set('Q5', 'Cel mai mic preț pe mp (€)'); g.set('R5', `=IF(R3=0;"";MIN(F2:F${last}))`, NUM0);
  g.set('Q6', 'Cea mai ieftină pe mp', { color: '#006100' }); g.set('R6', `=IF(R3=0;"";INDEX(B2:B${last};MATCH(R5;F2:F${last};0)))`, { color: '#006100' });
  g.set('Q7', 'Cea mai bună după scor', { b: true, color: '#006100' }); g.set('R7', `=IF(R3=0;"";INDEX(B2:B${last};MATCH(MAX(M2:M${last});M2:M${last};0)))`, { b: true, color: '#006100' });
  g.set('Q8', 'În buget'); g.set('R8', `=IF(N(R2)=0;"";COUNTIF(D2:D${last};"<="&R2))`, { align: 'center' });
  g.box('Q1:R8', 'all');
  g.set('Q10', 'Un rând pe fiecare anunț: prețul, suprafața utilă și, dacă vrei, cheltuielile lunare (întreținerea, căldura) și drumul.', { i: true, color: '#666666' });
  g.set('Q11', 'Nota ta (1–10) e părerea ta după poze sau vizionare; scorul o pune lângă prețul pe mp și drumul până la serviciu.', { i: true, color: '#666666' });
  g.set('Q12', 'Cu bugetul scris sus, anunțurile mai scumpe apar „Peste buget” (în roșu). La chirie scrii chiria lunară la Prețul.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 220, C: 140, D: 100, E: 110, F: 100, G: 75, H: 65, I: 100, J: 120, K: 110, L: 100, M: 75, N: 95, O: 110, P: 30, Q: 240, R: 170 });
  return doc('Compararea locuințelor', g.sheet('Locuințe'));
}

// Lista de plată a întreținerii (asociație de proprietari): fiecare apartament cu persoanele, cota-parte indiviză și apa
// consumată; cheltuielile lunii (pe persoane, pe cota-parte, prețul apei, fondul de reparații) se trec o dată în dreapta și se
// împart singure, apoi ies totalul lunii, restanța, totalul de plată, restul și starea fiecărui apartament.
function listaIntretinere(): SheetDoc {
  const g = new Grid();
  const last = 41, tot = last + 1;
  g.head(1, ['Nr.', 'Apartamentul', 'Proprietarul', 'Persoane', 'Cota-parte indiviză (%)', 'Apă rece (mc)', 'Apă caldă (mc)', 'Pe persoane (lei)', 'Pe cota-parte (lei)', 'Apa (lei)', 'Fond de reparații (lei)', 'Total luna (lei)', 'Restanțe (lei)', 'Total de plată (lei)', 'Plătit (lei)', 'Rest de plată (lei)', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`H${r}`, `=IF(B${r}="";"";IF(N($T$9)=0;0;ROUND(N(D${r})*N($T$3)/$T$9;2)))`, LEI);
    g.set(`I${r}`, `=IF(B${r}="";"";IF(N($T$10)=0;0;ROUND(N(E${r})*N($T$4)/$T$10;2)))`, LEI);
    g.set(`J${r}`, `=IF(B${r}="";"";ROUND(N(F${r})*N($T$5)+N(G${r})*N($T$6);2))`, LEI);
    g.set(`K${r}`, `=IF(B${r}="";"";N($T$7))`, LEI);
    g.set(`L${r}`, `=IF(B${r}="";"";H${r}+I${r}+J${r}+K${r})`, { ...LEI, b: true });
    g.set(`N${r}`, `=IF(B${r}="";"";L${r}+N(M${r}))`, LEI);
    g.set(`P${r}`, `=IF(B${r}="";"";ROUND(N${r}-N(O${r});2))`, { ...LEI, b: true });
    g.set(`Q${r}`, `=IF(B${r}="";"";IF(P${r}<=0;"Plătit";IF(N(M${r})>0;"Restanță";"De plată")))`, { align: 'center' });
  }
  for (const c of ['B', 'D', 'E', 'F', 'G']) g.col(c, 2, last, { align: 'center' });
  for (const c of ['M', 'O']) g.col(c, 2, last, LEI);
  g.set(`B${tot}`, 'Total', TOTAL);
  for (const c of ['D', 'E', 'F', 'G']) g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...TOTAL, align: 'center' });
  for (const c of ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']) g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:Q${tot}`, 'all');
  g.rules.push(
    { range: `Q2:Q${last}`, op: 'eq', v1: 'Plătit', look: 'green' },
    { range: `Q2:Q${last}`, op: 'eq', v1: 'De plată', look: 'yellow' },
    { range: `Q2:Q${last}`, op: 'eq', v1: 'Restanță', look: 'red' },
  );
  g.set('S1', 'Cheltuielile lunii', HEAD); g.set('T1', '', HEAD);
  g.set('S2', 'Luna', { b: true }); g.set('T2', '', { bg: '#fff2cc' });
  g.set('S3', 'Pe persoane: lift, salubritate, iluminat (lei)', { b: true }); g.set('T3', '', { ...LEI, bg: '#fff2cc' });
  g.set('S4', 'Pe cota-parte: curățenie, administrator, reparații (lei)', { b: true }); g.set('T4', '', { ...LEI, bg: '#fff2cc' });
  g.set('S5', 'Prețul apei reci (lei / mc)', { b: true }); g.set('T5', '', { ...LEI, bg: '#fff2cc' });
  g.set('S6', 'Prețul apei calde (lei / mc)', { b: true }); g.set('T6', '', { ...LEI, bg: '#fff2cc' });
  g.set('S7', 'Fondul de reparații pe apartament (lei)', { b: true }); g.set('T7', '', { ...LEI, bg: '#fff2cc' });
  g.set('S9', 'Persoane în bloc'); g.set('T9', `=D${tot}`, { align: 'center' });
  g.set('S10', 'Cote-părți adunate (%)'); g.set('T10', `=E${tot}`, { align: 'center' });
  g.set('S11', 'Lei pe persoană'); g.set('T11', '=IF(N(T9)=0;"";ROUND(T3/T9;2))', LEI);
  g.set('S12', 'De încasat de la toți', { b: true }); g.set('T12', `=N${tot}`, { ...LEI, b: true });
  g.set('S13', 'Încasat'); g.set('T13', `=O${tot}`, LEI);
  g.set('S14', 'Rest de încasat', { b: true }); g.set('T14', '=T12-T13', { ...LEI, b: true });
  g.set('S15', 'Apartamente cu restanțe'); g.set('T15', `=COUNTIF(Q2:Q${last};"Restanță")`, { align: 'center', b: true });
  g.box('S1:T15', 'all');
  g.set('S17', 'Treci cheltuielile o dată pe lună în căsuțele galbene; ele se împart singure pe apartamente.', { i: true, color: '#666666' });
  g.set('S18', 'Cotele-părți sunt cele din actele apartamentelor; adunate ar trebui să dea 100%.', { i: true, color: '#666666' });
  g.set('S19', 'La sfârșitul lunii, restul de plată al fiecărui apartament se trece la Restanțe în lista lunii următoare.', { i: true, color: '#666666' });
  g.widths({ A: 45, B: 95, C: 170, D: 75, E: 110, F: 85, G: 85, H: 100, I: 105, J: 85, K: 105, L: 100, M: 95, N: 110, O: 90, P: 105, Q: 90, R: 30, S: 330, T: 110 });
  return doc('Lista de plată a întreținerii', g.sheet('Întreținerea'));
}

// Rețetă cu costul pe porție (cafenea, patiserie, restaurant, catering): ingredientele cu cantitatea netă, prețul de achiziție și
// pierderile la curățare; ies cantitatea brută și costul fiecărui ingredient, iar în dreapta costul pe porție, cât din prețul de
// vânzare (fără TVA) se duce pe ingrediente, marja și prețul recomandat pentru ținta aleasă.
function retetaCost(): SheetDoc {
  const g = new Grid();
  const last = 41, tot = last + 1;
  g.head(1, ['Nr.', 'Ingredientul', 'U.M.', 'Cantitatea netă (în rețetă)', 'Pierderi la curățare (%)', 'Cantitatea brută', 'Prețul de achiziție (lei / U.M.)', 'Costul (lei)', 'Din costul rețetei']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    // Brut = net / (1 − pierderi): 1 kg de cartofi curățați cu 20% pierderi cere 1,25 kg cumpărați.
    g.set(`F${r}`, `=IF(D${r}="";"";IF(N(E${r})>=100;"";ROUND(D${r}/(1-N(E${r})/100);3)))`, { align: 'center', fmt: 'number', dec: 3 });
    g.set(`H${r}`, `=IF(OR(F${r}="";G${r}="");"";ROUND(F${r}*G${r};2))`, LEI);
    g.set(`I${r}`, `=IF(OR(H${r}="";H$${tot}=0);"";H${r}/H$${tot})`, PCT);
  }
  g.col('C', 2, last, { align: 'center' });
  g.col('D', 2, last, { align: 'center' });
  g.col('E', 2, last, { align: 'center' });
  g.col('G', 2, last, LEI);
  g.lists.push({ range: `C2:C${last}`, values: ['kg', 'g', 'l', 'ml', 'buc', 'legătură', 'pachet'] });
  g.set(`B${tot}`, 'Totalul rețetei', TOTAL);
  g.set(`H${tot}`, `=SUM(H2:H${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:I${tot}`, 'all');
  g.set('K1', 'Pe scurt', HEAD); g.set('L1', '', HEAD);
  g.set('K2', 'Numele rețetei', { b: true }); g.set('L2', '', { bg: '#fff2cc' });
  g.set('K3', 'Porții din rețetă', { b: true }); g.set('L3', '10', { align: 'center', b: true, bg: '#fff2cc' });
  g.set('K4', 'Costul ingredientelor'); g.set('L4', `=H${tot}`, LEI);
  g.set('K5', 'Costul pe porție', { b: true }); g.set('L5', '=IF(N(L3)<=0;"";ROUND(L4/L3;2))', { ...LEI, b: true });
  g.set('K6', 'Prețul de vânzare pe porție (cu TVA)', { b: true }); g.set('L6', '', { ...LEI, bg: '#fff2cc' });
  g.set('K7', 'Cota TVA (%)', { b: true }); g.set('L7', '11', { align: 'center', bg: '#fff2cc' });
  g.set('K8', 'Prețul fără TVA'); g.set('L8', '=IF(L6="";"";ROUND(L6/(1+N(L7)/100);2))', LEI);
  g.set('K9', 'Ingredientele, din prețul fără TVA'); g.set('L9', '=IF(OR(L5="";L8="";N(L8)=0);"";L5/L8)', { ...PCT, b: true });
  g.set('K10', 'Marja pe porție (lei)'); g.set('L10', '=IF(OR(L5="";L8="");"";L8-L5)', LEI);
  g.set('K11', 'Ținta: ingredientele din preț (%)', { b: true }); g.set('L11', '30', { align: 'center', bg: '#fff2cc' });
  g.set('K12', 'Prețul recomandat (cu TVA)', { b: true }); g.set('L12', '=IF(OR(L5="";N(L11)<=0);"";ROUNDUP(ROUND(L5/(N(L11)/100)*(1+N(L7)/100)*10;6);0)/10)', { ...LEI, b: true });
  g.set('K13', 'Starea'); g.set('L13', '=IF(L9="";"";IF(L10<0;"În pierdere";IF(L9*100>N(L11);"Peste țintă";"Bun")))', { align: 'center', b: true });
  g.box('K1:L13', 'all');
  g.rules.push(
    { range: 'L13', op: 'eq', v1: 'Bun', look: 'green' },
    { range: 'L13', op: 'eq', v1: 'Peste țintă', look: 'yellow' },
    { range: 'L13', op: 'eq', v1: 'În pierdere', look: 'red' },
  );
  g.set('K15', 'Cantitatea netă e cea care intră în rețetă (după curățare); la pierderi treci cât se aruncă (coji, oase, cotor), în procente.', { i: true, color: '#666666' });
  g.set('K16', 'Prețul de achiziție e pe aceeași unitate ca și cantitatea (de exemplu lei pe kg, dacă scrii kg).', { i: true, color: '#666666' });
  g.set('K17', 'Cota TVA se verifică cu contabilul; prețul recomandat e rotunjit în sus la 10 bani.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 200, C: 80, D: 120, E: 115, F: 105, G: 135, H: 100, I: 105, J: 30, K: 260, L: 130 });
  return doc('Rețetă cu costul pe porție', g.sheet('Rețeta'));
}

// Abonamentele clienților (sală de sport, cursuri, salon, spălătorie auto): fiecare abonament vândut, cu data începerii, câte
// zile e valabil și câte ședințe include; ies data expirării, ședințele rămase, restul de plată și starea (activ, expiră în
// 7 zile, expirat, epuizat), iar în dreapta câte abonamente sunt active și cât mai e de încasat.
function abonamenteClienti(): SheetDoc {
  const g = new Grid();
  const last = 201;
  g.head(1, ['Nr.', 'Clientul', 'Telefonul', 'Abonamentul', 'Data începerii', 'Valabil (zile)', 'Expiră la', 'Ședințe incluse', 'Ședințe folosite', 'Ședințe rămase', 'Prețul (lei)', 'Plătit (lei)', 'Rest de plată', 'Starea', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(E${r}="";F${r}="");"";E${r}+F${r})`, DATE);
    g.set(`J${r}`, `=IF(H${r}="";"";MAX(0;H${r}-I${r}))`, { align: 'center' });
    g.set(`M${r}`, `=IF(K${r}="";"";MAX(0;K${r}-L${r}))`, LEI);
    // Întâi data (expirat), apoi ședințele (epuizat), apoi ultimele 7 zile (expiră curând).
    g.set(`N${r}`, `=IF(B${r}="";"";IF(G${r}="";"Fără dată";IF(G${r}<TODAY();"Expirat";IF(AND(H${r}<>"";J${r}=0);"Epuizat";IF(G${r}-TODAY()<=7;"Expiră curând";"Activ")))))`, { align: 'center' });
  }
  g.col('E', 2, last, DATE);
  g.col('F', 2, last, { align: 'center' });
  g.col('H', 2, last, { align: 'center' });
  g.col('I', 2, last, { align: 'center' });
  g.col('K', 2, last, LEI);
  g.col('L', 2, last, LEI);
  g.lists.push({ range: `D2:D${last}`, values: ['Lunar', 'Trimestrial', 'Anual', '8 ședințe', '12 ședințe', 'Nelimitat', 'Altul'] });
  g.box(`A1:O${last}`, 'all');
  g.rules.push(
    { range: `N2:N${last}`, op: 'eq', v1: 'Activ', look: 'green' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Expiră curând', look: 'yellow' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Expirat', look: 'red' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Epuizat', look: 'red' },
    { range: `M2:M${last}`, op: 'gt', v1: '0', look: 'yellow' },
  );
  g.set('Q1', 'Pe scurt', HEAD); g.set('R1', '', HEAD);
  g.set('Q2', 'Abonamente trecute în tabel'); g.set('R2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('Q3', 'Active', { color: '#006100' }); g.set('R3', `=COUNTIF(N2:N${last};"Activ")+COUNTIF(N2:N${last};"Expiră curând")`, { align: 'center', color: '#006100', b: true });
  g.set('Q4', 'Expiră în următoarele 7 zile', { color: '#9c5700' }); g.set('R4', `=COUNTIF(N2:N${last};"Expiră curând")`, { align: 'center', b: true });
  g.set('Q5', 'Expirate', { color: '#9c0006' }); g.set('R5', `=COUNTIF(N2:N${last};"Expirat")`, { align: 'center', color: '#9c0006' });
  g.set('Q6', 'Cu ședințele terminate', { color: '#9c0006' }); g.set('R6', `=COUNTIF(N2:N${last};"Epuizat")`, { align: 'center', color: '#9c0006' });
  g.set('Q7', 'Vândute (prețul tuturor)'); g.set('R7', `=SUM(K2:K${last})`, LEI);
  g.set('Q8', 'Încasat'); g.set('R8', `=SUM(L2:L${last})`, { ...LEI, b: true });
  g.set('Q9', 'Rest de încasat'); g.set('R9', `=SUM(M2:M${last})`, LEI);
  g.box('Q1:R9', 'all');
  g.set('Q11', 'Un rând pe fiecare abonament vândut: clientul, felul, data începerii, câte zile e valabil (30 pentru lunar) și câte ședințe include.', { i: true, color: '#666666' });
  g.set('Q12', 'La fiecare venire crești „Ședințe folosite” cu 1; la abonamentele fără limită de ședințe lași „Ședințe incluse” gol.', { i: true, color: '#666666' });
  g.set('Q13', 'Cei care expiră în 7 zile ies în galben: e momentul să-i suni pentru reînnoire (fișa clientului: Notițe → Din șablon → Fișa unui client).', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 170, C: 120, D: 120, E: 110, F: 90, G: 105, H: 95, I: 95, J: 95, K: 95, L: 95, M: 100, N: 115, O: 180, P: 30, Q: 300, R: 100 });
  return doc('Abonamentele clienților', g.sheet('Abonamente'));
}

// Evidența echipamentului de protecție: fiecare bucată dată unui angajat, cu data primirii și durata de folosire; data de
// înlocuire iese singură (EDATE), iar starea arată ce e de înlocuit (expirat), ce expiră în 30 de zile și ce nu e semnat în fișă.
function echipProtectie(): SheetDoc {
  const g = new Grid();
  const last = 81;
  g.head(1, ['Nr.', 'Angajatul', 'Echipamentul', 'Mărimea', 'Cantitatea', 'Data primirii', 'Durata (luni)', 'Se înlocuiește la', 'Zile rămase', 'Starea', 'Semnat în fișă', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`H${r}`, `=IF(OR(F${r}="";G${r}="");"";EDATE(F${r};G${r}))`, DATE);
    g.set(`I${r}`, `=IF(H${r}="";"";H${r}-TODAY())`, { align: 'center' });
    g.set(`J${r}`, `=IF(B${r}="";"";IF(H${r}="";"Fără dată";IF(I${r}<0;"De înlocuit";IF(I${r}<=30;"În curând";"În uz"))))`, { align: 'center' });
  }
  g.col('D', 2, last, { align: 'center' });
  g.col('E', 2, last, { align: 'center' });
  g.col('F', 2, last, DATE);
  g.col('G', 2, last, { align: 'center' });
  g.col('K', 2, last, { align: 'center' });
  g.lists.push(
    { range: `C2:C${last}`, values: ['Cască de protecție', 'Mănuși de protecție', 'Bocanci de protecție', 'Vestă reflectorizantă', 'Ochelari de protecție', 'Antifoane', 'Mască de protecție', 'Salopetă', 'Geacă de iarnă', 'Ham de siguranță', 'Altul'] },
    { range: `K2:K${last}`, values: ['Da', 'Nu'] },
  );
  g.box(`A1:L${last}`, 'all');
  g.rules.push(
    { range: `J2:J${last}`, op: 'eq', v1: 'De înlocuit', look: 'red' },
    { range: `J2:J${last}`, op: 'eq', v1: 'În curând', look: 'yellow' },
    { range: `J2:J${last}`, op: 'eq', v1: 'În uz', look: 'green' },
    { range: `K2:K${last}`, op: 'eq', v1: 'Nu', look: 'red' },
  );
  g.set('N1', 'Pe scurt', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Bucăți date (rânduri în tabel)'); g.set('O2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('N3', 'În uz', { color: '#006100' }); g.set('O3', `=COUNTIF(J2:J${last};"În uz")`, { align: 'center', color: '#006100' });
  g.set('N4', 'De înlocuit în următoarele 30 de zile', { color: '#9c5700' }); g.set('O4', `=COUNTIF(J2:J${last};"În curând")`, { align: 'center', b: true });
  g.set('N5', 'De înlocuit acum (durata trecută)', { b: true, color: '#9c0006' }); g.set('O5', `=COUNTIF(J2:J${last};"De înlocuit")`, { align: 'center', b: true, color: '#9c0006' });
  g.set('N6', 'Nesemnate în fișă', { color: '#9c0006' }); g.set('O6', `=COUNTIF(K2:K${last};"Nu")`, { align: 'center', color: '#9c0006' });
  g.set('N7', 'Fără dată sau durată'); g.set('O7', `=COUNTIF(J2:J${last};"Fără dată")`, { align: 'center' });
  g.box('N1:O7', 'all');
  g.set('N9', 'Un rând pe fiecare bucată dată: angajatul, echipamentul, mărimea, data primirii și câte luni se folosește.', { i: true, color: '#666666' });
  g.set('N10', 'Duratele le stabilește firma (de obicei în normativul intern); echipamentul de protecție se dă gratuit.', { i: true, color: '#666666' });
  g.set('N11', 'Procesul-verbal pentru fiecare predare: Docs → Din șablon → Proces-verbal de predare-primire a echipamentului de protecție.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 170, C: 170, D: 75, E: 80, F: 110, G: 90, H: 120, I: 90, J: 105, K: 95, L: 180, M: 30, N: 280, O: 70 });
  return doc('Evidența echipamentului de protecție', g.sheet('Echipament'));
}

// Repartizarea profitului și dividendele: din profitul net scade rezerva legală (5% din profitul înainte de impozit, până la
// 20% din capital), pierderile de acoperit și ce rămâne în firmă; restul se împarte asociaților după părțile sociale, cu
// impozitul pe dividende reținut la plată (procentul se schimbă într-un singur loc) și termenul lui, pe 25 ale lunii următoare.
function dividende(): SheetDoc {
  const g = new Grid();
  const last = 21, tot = last + 1;
  g.head(1, ['Nr.', 'Asociatul', 'Părți sociale', 'Procent din capital', 'Dividend brut', 'Impozit pe dividende', 'Dividend net', 'Data plății', 'Impozitul se plătește până la', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`D${r}`, `=IF(OR(B${r}="";C${r}="";$C$${tot}=0);"";C${r}/$C$${tot})`, { ...PCT, align: 'center' });
    g.set(`E${r}`, `=IF(D${r}="";"";ROUND($M$9*D${r};2))`, LEI);
    g.set(`F${r}`, `=IF(E${r}="";"";ROUND(E${r}*$M$10;2))`, LEI);
    g.set(`G${r}`, `=IF(E${r}="";"";E${r}-F${r})`, { ...LEI, b: true });
    // Impozitul reținut se declară și se plătește până pe 25 ale lunii de după plata dividendelor.
    g.set(`I${r}`, `=IF(H${r}="";"";EDATE(H${r}-DAY(H${r})+25;1))`, DATE);
    g.set(`J${r}`, `=IF(B${r}="";"";IF(H${r}<>"";"Plătit";"De plătit"))`, { align: 'center' });
  }
  g.col('C', 2, last, { align: 'center' });
  g.col('H', 2, last, DATE);
  g.set(`B${tot}`, 'Total', { b: true });
  g.set(`C${tot}`, `=SUM(C2:C${last})`, { align: 'center', b: true });
  g.set(`D${tot}`, `=SUM(D2:D${last})`, { ...PCT, align: 'center', b: true });
  for (const c of 'EFG') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, b: true });
  g.box(`A1:J${tot}`, 'all');
  g.rules.push(
    { range: `J2:J${last}`, op: 'eq', v1: 'Plătit', look: 'green' },
    { range: `J2:J${last}`, op: 'eq', v1: 'De plătit', look: 'yellow' },
    { range: 'M15', op: 'lt', v1: '0.9999', look: 'red' },
  );
  g.set('L1', 'Profitul de repartizat', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Profitul înainte de impozit'); g.set('M2', '', LEI);
  g.set('L3', 'Profitul net al anului', { b: true }); g.set('M3', '', { ...LEI, b: true });
  g.set('L4', 'Capitalul social'); g.set('M4', '', LEI);
  g.set('L5', 'Rezerva legală pe care o ai deja'); g.set('M5', '0', LEI);
  g.set('L6', 'Rezerva legală de constituit (5%, cel mult 20% din capital)');
  g.set('M6', '=IF(M2="";0;MAX(0;IF(M4="";ROUND(M2*0,05;2);MIN(ROUND(M2*0,05;2);M4*0,2-M5))))', LEI);
  g.set('L7', 'Pierderi din anii trecuți de acoperit'); g.set('M7', '0', LEI);
  g.set('L8', 'Rămâne în firmă (alte rezerve, nerepartizat)'); g.set('M8', '0', LEI);
  g.set('L9', 'Profitul împărțit ca dividende', { b: true, color: '#006100' }); g.set('M9', '=IF(M3="";0;MAX(0;M3-M6-M7-M8))', { ...LEI, b: true, color: '#006100' });
  g.set('L10', 'Impozitul pe dividende'); g.set('M10', '0,16', { ...PCT, align: 'center' });
  g.set('L11', 'Valoarea unei părți sociale'); g.set('M11', `=IF(OR(M4="";C${tot}=0);"";M4/C${tot})`, LEI);
  g.box('L1:M11', 'all');
  g.set('L13', 'Pe scurt', HEAD); g.set('M13', '', HEAD);
  g.set('L14', 'Asociați trecuți în tabel'); g.set('M14', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('L15', 'Din capital, în tabel (trebuie 100%)'); g.set('M15', `=D${tot}`, { ...PCT, align: 'center' });
  g.set('L16', 'Dividende brute'); g.set('M16', `=E${tot}`, LEI);
  g.set('L17', 'Impozit de reținut și de plătit la stat', { color: '#9c0006' }); g.set('M17', `=F${tot}`, { ...LEI, color: '#9c0006' });
  g.set('L18', 'Dividende nete pentru asociați', { b: true }); g.set('M18', `=G${tot}`, { ...LEI, b: true });
  g.set('L19', 'Plătite deja', { color: '#006100' }); g.set('M19', `=SUMIF(J2:J${last};"Plătit";G2:G${last})`, { ...LEI, color: '#006100' });
  g.set('L20', 'Rămase de plătit', { b: true }); g.set('M20', '=M18-M19', { ...LEI, b: true });
  g.box('L13:M20', 'all');
  g.set('L22', 'Scrie profitul din situațiile financiare și ce rămâne în firmă; dividendele se împart singure după părțile sociale.', { i: true, color: '#666666' });
  g.set('L23', 'Impozitul se reține la plată și se declară și se plătește până pe 25 ale lunii următoare; procentul îl verifici cu contabilul.', { i: true, color: '#666666' });
  g.set('L24', 'Repartizarea o aprobă asociații: Docs → Hotărârea adunării generale a asociaților sau Decizia asociatului unic.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 220, C: 100, D: 110, E: 130, F: 130, G: 130, H: 110, I: 150, J: 100, K: 30, L: 340, M: 130 });
  return doc('Repartizarea profitului și dividendele', g.sheet('Dividende'));
}

// Registrul asociaților: fiecare asociat cu aportul, părțile sociale și cum a intrat (la înființare, majorare, cesiune,
// moștenire); la ieșire rândul rămâne, cu data ieșirii, și nu mai intră la procent. În dreapta capitalul din tabel față
// de cel din actul constitutiv (diferența în roșu) și valoarea unei părți sociale.
function registruAsociati(): SheetDoc {
  const g = new Grid();
  const last = 31;
  g.head(1, ['Nr.', 'Asociatul', 'CNP / CUI', 'Domiciliul / sediul', 'Data intrării', 'Cum a intrat', 'Aportul (lei)', 'Părți sociale', 'Din capital', 'Data ieșirii', 'Starea', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    // Procentul se socotește doar între asociații de acum (fără data ieșirii).
    g.set(`I${r}`, `=IF(OR(B${r}="";H${r}="";J${r}<>"";$O$4=0);"";H${r}/$O$4)`, { ...PCT, align: 'center' });
    g.set(`K${r}`, `=IF(B${r}="";"";IF(J${r}<>"";"Ieșit";"Asociat"))`, { align: 'center' });
  }
  g.col('E', 2, last, DATE); g.col('J', 2, last, DATE);
  g.col('G', 2, last, LEI);
  g.col('H', 2, last, { align: 'center' });
  g.lists.push({ range: `F2:F${last}`, values: ['La înființare', 'Majorare de capital', 'Cesiune de părți sociale', 'Moștenire', 'Altfel'] });
  g.box(`A1:L${last}`, 'all');
  g.rules.push(
    { range: `K2:K${last}`, op: 'eq', v1: 'Asociat', look: 'green' },
    { range: `K2:K${last}`, op: 'eq', v1: 'Ieșit', look: 'yellow' },
    { range: 'O7', op: 'ne', v1: '0', look: 'red' },
  );
  g.set('N1', 'Pe scurt', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Asociați acum', { b: true }); g.set('O2', `=COUNTIF(K2:K${last};"Asociat")`, { align: 'center', b: true });
  g.set('N3', 'Ieșiți din firmă'); g.set('O3', `=COUNTIF(K2:K${last};"Ieșit")`, { align: 'center' });
  g.set('N4', 'Părți sociale ale asociaților de acum'); g.set('O4', `=SUMIF(K2:K${last};"Asociat";H2:H${last})`, { align: 'center' });
  g.set('N5', 'Capitalul din tabel'); g.set('O5', `=SUMIF(K2:K${last};"Asociat";G2:G${last})`, LEI);
  g.set('N6', 'Capitalul din actul constitutiv'); g.set('O6', '', LEI);
  g.set('N7', 'Diferența (trebuie 0)', { color: '#9c0006' }); g.set('O7', '=IF(O6="";0;O5-O6)', { ...LEI, color: '#9c0006' });
  g.set('N8', 'Valoarea unei părți sociale'); g.set('O8', '=IF(O4=0;"";IF(O6="";O5;O6)/O4)', LEI);
  g.set('N9', 'Din capital, la asociații de acum'); g.set('O9', `=SUM(I2:I${last})`, { ...PCT, align: 'center' });
  g.box('N1:O9', 'all');
  g.set('N11', 'Un rând pe asociat; la o cesiune scrii data ieșirii la cel care vinde și un rând nou pentru cel care cumpără.', { i: true, color: '#666666' });
  g.set('N12', 'Rândurile asociaților ieșiți rămân în registru, dar nu mai intră la procent și la capital.', { i: true, color: '#666666' });
  g.set('N13', 'Scrie capitalul din actul constitutiv: dacă nu se potrivește cu tabelul, diferența iese în roșu. Dividendele: Sheets → Repartizarea profitului și dividendele.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 220, C: 130, D: 240, E: 110, F: 170, G: 120, H: 100, I: 100, J: 110, K: 90, L: 200, M: 30, N: 300, O: 130 });
  return doc('Registrul asociaților', g.sheet('Asociați'));
}

// Evidența sponsorizărilor: fiecare contract de sponsorizare cu beneficiarul, valoarea, dacă beneficiarul era în registrul
// entităților de la ANAF la data contractului, plata și dovada folosirii. În dreapta cât se poate scădea din impozitul pe
// profit (cel mai mic dintre 0,75% din cifra de afaceri și 20% din impozit) și ce rămâne pentru anii următori.
// Penalitățile pentru facturile plătite târziu sau neplătite: din contract (procent pe zi) sau, fără clauză, dobânda legală
// penalizatoare (dobânda de referință BNR + 8 puncte între profesioniști, OG 13/2011), plus 40 de euro în lei pe factură (Legea 72/2013).
function penalitati(): SheetDoc {
  const g = new Grid();
  const last = 41, tot = last + 1;
  g.head(1, ['Nr.', 'Clientul', 'Nr. factură', 'Scadența', 'Suma plătită târziu / neplătită', 'Data plății (gol = neplătită)', 'Zile de întârziere', 'Penalități din contract', 'Dobânda legală', 'Recuperare (40 €)', 'De cerut', 'Total cu suma datorată']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    // Factura neplătită se socotește până la data din O7 (gol = azi).
    g.set(`G${r}`, `=IF(OR(E${r}="";D${r}="");"";MAX(0;IF(F${r}="";IF($O$7="";TODAY();$O$7);F${r})-D${r}))`, { align: 'center' });
    g.set(`H${r}`, `=IF(G${r}="";"";IF($O$3="Da";MIN(E${r};ROUND(E${r}*$O$2*G${r};2));ROUND(E${r}*$O$2*G${r};2)))`, LEI);
    g.set(`I${r}`, `=IF(OR(G${r}="";$O$4="");"";ROUND(E${r}*($O$4+$O$5)*G${r}/365;2))`, LEI);
    g.set(`J${r}`, `=IF(G${r}="";"";IF(G${r}>0;ROUND(40*$O$6;2);0))`, LEI);
    g.set(`K${r}`, `=IF(G${r}="";"";IF($O$2>0;H${r};IF(I${r}="";0;I${r}))+J${r})`, LEI);
    g.set(`L${r}`, `=IF(G${r}="";"";IF(F${r}="";E${r};0)+K${r})`, LEI);
  }
  g.col('D', 2, last, DATE); g.col('F', 2, last, DATE);
  g.col('E', 2, last, LEI);
  g.col('C', 2, last, { align: 'center' });
  g.set(`B${tot}`, 'Total', { b: true });
  for (const c of 'EHIJKL') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, b: true });
  g.box(`A1:L${tot}`, 'all');
  g.rules.push(
    { range: `G2:G${last}`, op: 'between', v1: '1', v2: '30', look: 'yellow' },
    { range: `G2:G${last}`, op: 'gt', v1: '30', look: 'red' },
  );
  g.set('N1', 'Reglaje', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Penalitatea din contract, pe zi (0 = fără clauză)'); g.set('O2', '0,001', { ...PCT, dec: 2, align: 'center' });
  g.set('N3', 'Penalitățile nu trec de suma datorată'); g.set('O3', 'Da', { align: 'center' });
  g.set('N4', 'Dobânda de referință BNR, pe an'); g.set('O4', '', { ...PCT, dec: 2, align: 'center' });
  g.set('N5', 'Puncte peste ea (8% între firme, 4% în rest)'); g.set('O5', '0,08', { ...PCT, align: 'center' });
  g.set('N6', 'Cursul euro (lei), pentru cei 40 €'); g.set('O6', '', { fmt: 'number', dec: 4, align: 'center' });
  g.set('N7', 'Calculez până la (gol = azi)'); g.set('O7', '', DATE);
  g.set('N8', 'Ce se cere', { b: true }); g.set('O8', '=IF(O2>0;"Penalitățile din contract";"Dobânda legală")', { b: true, align: 'center' });
  g.lists.push({ range: 'O3:O3', values: ['Da', 'Nu'] });
  g.box('N1:O8', 'all');
  g.set('N10', 'Pe scurt', HEAD); g.set('O10', '', HEAD);
  g.set('N11', 'Facturi întârziate'); g.set('O11', `=COUNTIF(G2:G${last};">0")`, { align: 'center' });
  g.set('N12', 'Încă neplătit'); g.set('O12', `=L${tot}-K${tot}`, LEI);
  g.set('N13', 'Penalități sau dobândă'); g.set('O13', `=IF(O2>0;H${tot};I${tot})`, LEI);
  g.set('N14', 'Recuperare (40 € pe factură)'); g.set('O14', `=J${tot}`, LEI);
  g.set('N15', 'Total de cerut în somație', { b: true, color: '#9c0006' }); g.set('O15', `=O12+O13+O14`, { ...LEI, b: true, color: '#9c0006' });
  g.set('N16', 'Întârzierea cea mai mare (zile)'); g.set('O16', `=IF(COUNT(G2:G${last})=0;"";MAX(G2:G${last}))`, { align: 'center' });
  g.box('N10:O16', 'all');
  g.set('N18', 'Penalitățile se cer doar dacă sunt scrise în contract; altfel se cere dobânda legală (scrie la O4 dobânda de referință de pe site-ul BNR).', { i: true, color: '#666666' });
  g.set('N19', 'Cei 40 € pe factură se cer doar de la firme sau instituții, pentru facturile plătite după termen.', { i: true, color: '#666666' });
  g.set('N20', 'Facturile plătite târziu intră cu data plății: rămân de cerut doar penalitățile. Somația: Docs → Șabloane → Somație de plată.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 220, C: 100, D: 100, E: 140, F: 140, G: 100, H: 130, I: 120, J: 120, K: 120, L: 140, M: 30, N: 340, O: 160 });
  return doc('Penalități de întârziere', g.sheet('Penalități'));
}

function sponsorizari(): SheetDoc {
  const g = new Grid();
  const last = 31;
  g.head(1, ['Nr.', 'Data contractului', 'Nr. contract', 'Beneficiarul', 'Cod fiscal', 'Felul', 'Pentru ce', 'Valoarea (lei)', 'În registrul ANAF', 'Data plății / predării', 'Dovada folosirii primită', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(D${r}="";"";ROW()-1)`, { align: 'center' });
    // Fără beneficiar în registru la data contractului sponsorizarea nu se scade din impozit.
    g.set(`L${r}`, `=IF(D${r}="";"";IF(I${r}="Nu";"Nu se scade";IF(J${r}="";"De plătit";IF(K${r}="Da";"Încheiat";"Așteaptă dovada"))))`, { align: 'center' });
  }
  g.col('B', 2, last, DATE); g.col('J', 2, last, DATE);
  g.col('H', 2, last, LEI);
  g.col('I', 2, last, { align: 'center' }); g.col('K', 2, last, { align: 'center' });
  g.lists.push(
    { range: `F2:F${last}`, values: ['Bani', 'Produse', 'Servicii'] },
    { range: `I2:I${last}`, values: ['Da', 'Nu'] },
    { range: `K2:K${last}`, values: ['Da', 'Nu'] },
  );
  g.box(`A1:L${last}`, 'all');
  g.rules.push(
    { range: `L2:L${last}`, op: 'eq', v1: 'Încheiat', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Așteaptă dovada', look: 'yellow' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Nu se scade', look: 'red' },
  );
  g.set('N1', 'Cât se scade din impozit', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Cifra de afaceri a anului'); g.set('O2', '', LEI);
  g.set('N3', 'Impozitul pe profit, înainte de sponsorizări'); g.set('O3', '', LEI);
  g.set('N4', 'Plafonul din cifra de afaceri'); g.set('O4', '0,0075', { ...PCT, align: 'center' });
  g.set('N5', 'Plafonul din impozit'); g.set('O5', '0,2', { ...PCT, align: 'center' });
  g.set('N6', 'Se poate scădea cel mult', { b: true }); g.set('O6', '=IF(OR(O2="";O3="");0;MIN(ROUND(O2*O4;2);ROUND(O3*O5;2)))', { ...LEI, b: true });
  g.set('N7', 'Sponsorizări plătite, cu beneficiarul în registru'); g.set('O7', `=SUMIF(L2:L${last};"Încheiat";H2:H${last})+SUMIF(L2:L${last};"Așteaptă dovada";H2:H${last})`, LEI);
  g.set('N8', 'Se scade din impozit anul acesta', { b: true, color: '#006100' }); g.set('O8', '=MIN(O6;O7)', { ...LEI, b: true, color: '#006100' });
  g.set('N9', 'Rămâne de scăzut în anii următori'); g.set('O9', '=MAX(0;O7-O6)', LEI);
  g.set('N10', 'Impozitul de plătit după sponsorizări', { b: true }); g.set('O10', '=IF(O3="";"";O3-O8)', { ...LEI, b: true });
  g.box('N1:O10', 'all');
  g.set('N12', 'Pe scurt', HEAD); g.set('O12', '', HEAD);
  g.set('N13', 'Contracte în tabel'); g.set('O13', `=COUNTA(D2:D${last})`, { align: 'center' });
  g.set('N14', 'Total sponsorizări'); g.set('O14', `=SUM(H2:H${last})`, LEI);
  g.set('N15', 'Încă de plătit'); g.set('O15', `=SUMIF(L2:L${last};"De plătit";H2:H${last})`, LEI);
  g.set('N16', 'Așteaptă dovada folosirii'); g.set('O16', `=COUNTIF(L2:L${last};"Așteaptă dovada")`, { align: 'center' });
  g.set('N17', 'Nu se scad (beneficiarul nu e în registru)', { color: '#9c0006' }); g.set('O17', `=SUMIF(L2:L${last};"Nu se scade";H2:H${last})`, { ...LEI, color: '#9c0006' });
  g.box('N12:O17', 'all');
  g.set('N19', 'Un rând pe contract, un tabel pe an. La „În registrul ANAF” verifici beneficiarul pe site-ul ANAF la data contractului.', { i: true, color: '#666666' });
  g.set('N20', 'Plafoanele sunt cele pentru impozitul pe profit; la microîntreprinderi și pentru anii următori le verifici cu contabilul.', { i: true, color: '#666666' });
  g.set('N21', 'Contractul: Docs → Șabloane → Contract de sponsorizare.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 110, C: 90, D: 230, E: 110, F: 90, G: 220, H: 120, I: 110, J: 130, K: 130, L: 130, M: 30, N: 320, O: 130 });
  return doc('Evidența sponsorizărilor', g.sheet('Sponsorizări'));
}

// Fișa de magazie: un produs dintr-o gestiune, cu fiecare intrare și ieșire și stocul după fiecare mișcare.
function fisaMagazie(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  g.head(1, ['Nr.', 'Data', 'Documentul', 'Nr. document', 'De la cine / la cine', 'Intrări', 'Ieșiri', 'Stocul', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(AND(F${r}="";G${r}="");"";ROW()-1)`, { align: 'center' });
    // Stocul se socotește din stocul inițial și din toate mișcările de până la rând, ca să meargă și cu rânduri goale între ele.
    g.set(`H${r}`, `=IF(AND(F${r}="";G${r}="");"";$L$6+SUM(F$2:F${r})-SUM(G$2:G${r}))`, { align: 'center', b: true });
  }
  g.col('B', 2, last, DATE);
  for (const c of 'DFG') g.col(c, 2, last, { align: 'center' });
  g.lists.push({ range: `C2:C${last}`, values: ['Notă de recepție', 'Aviz de însoțire', 'Factură', 'Bon de consum', 'Bon de transfer', 'Retur', 'Proces-verbal de inventariere'] });
  g.set(`E${tot}`, 'Total', TOTAL);
  for (const c of 'FG') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...TOTAL, align: 'center' });
  g.set(`H${tot}`, '=L6+F' + tot + '-G' + tot, { ...TOTAL, align: 'center' });
  g.box(`A1:I${tot}`, 'all');
  g.rules.push({ range: `H2:H${last}`, op: 'lt', v1: '0', look: 'red' });
  const IN: CellStyle = { bg: '#fff59d' };
  g.set('K1', 'Produsul', HEAD); g.set('L1', '', HEAD);
  g.set('K2', 'Denumirea'); g.set('L2', '', IN);
  g.set('K3', 'Codul'); g.set('L3', '', { ...IN, align: 'center' });
  g.set('K4', 'U.M.'); g.set('L4', 'buc', { ...IN, align: 'center' });
  g.set('K5', 'Gestiunea (depozit, magazin)'); g.set('L5', '', IN);
  g.set('K6', 'Stocul inițial'); g.set('L6', '0', { ...IN, align: 'center' });
  g.set('K7', 'Stocul minim (sub el se comandă)'); g.set('L7', '', { ...IN, align: 'center' });
  g.set('K8', 'Prețul unitar (fără TVA)'); g.set('L8', '', { ...LEI, ...IN });
  g.lists.push({ range: 'L4:L4', values: ['buc', 'kg', 'g', 'l', 'm', 'mp', 'set', 'cutie', 'pachet'] });
  g.box('K1:L8', 'all');
  g.set('K10', 'Pe scurt', HEAD); g.set('L10', '', HEAD);
  g.set('K11', 'Mișcări în fișă'); g.set('L11', `=COUNT(A2:A${last})`, { align: 'center' });
  g.set('K12', 'Total intrări'); g.set('L12', `=F${tot}`, { align: 'center' });
  g.set('K13', 'Total ieșiri'); g.set('L13', `=G${tot}`, { align: 'center' });
  g.set('K14', 'Stocul la zi', { b: true }); g.set('L14', `=H${tot}`, { align: 'center', b: true });
  g.set('K15', 'Valoarea stocului (fără TVA)'); g.set('L15', '=IF(L8="";"";ROUND(L14*L8;2))', LEI);
  g.set('K16', 'Ultima mișcare'); g.set('L16', `=IF(COUNT(B2:B${last})=0;"";MAX(B2:B${last}))`, DATE);
  g.set('K17', 'Starea', { b: true });
  g.set('L17', '=IF(L14<0;"Stoc negativ: verifică";IF(AND(L7<>"";L14<=L7);"De comandat";"Suficient"))', { b: true, align: 'center' });
  g.box('K10:L17', 'all');
  g.rules.push(
    { range: 'L17:L17', op: 'eq', v1: 'Suficient', look: 'green' },
    { range: 'L17:L17', op: 'eq', v1: 'De comandat', look: 'yellow' },
    { range: 'L17:L17', op: 'eq', v1: 'Stoc negativ: verifică', look: 'red' },
  );
  g.set('K19', 'O fișă pentru fiecare produs din gestiune (fă o copie a foii pentru produsul următor).', { i: true, color: '#666666' });
  g.set('K20', 'Intrările vin din nota de recepție (Sheets → Notă de recepție), ieșirile din aviz, factură sau bonul de consum.', { i: true, color: '#666666' });
  g.set('K21', 'La inventariere, stocul la zi e cel din evidență (Sheets → Listă de inventariere); diferențele intră cu procesul-verbal.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 100, C: 190, D: 100, E: 230, F: 90, G: 90, H: 100, I: 200, J: 30, K: 260, L: 170 });
  return doc('Fișa de magazie', g.sheet('Fișa de magazie'));
}

// Bon de consum: materialele scoase din gestiune pentru o lucrare sau o secție, cerut față de eliberat.
function bonConsum(): SheetDoc {
  const g = new Grid();
  const last = 26, tot = last + 1;
  g.head(1, ['Nr.', 'Codul', 'Materialul', 'U.M.', 'Cantitatea cerută', 'Cantitatea eliberată', 'Neeliberat', 'Preț unitar (fără TVA)', 'Valoarea eliberată', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(C${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(E${r}="";F${r}="");"";MAX(0;E${r}-F${r}))`, { align: 'center' });
    g.set(`I${r}`, `=IF(OR(F${r}="";H${r}="");"";ROUND(F${r}*H${r};2))`, LEI);
  }
  for (const c of 'BDEF') g.col(c, 2, last, { align: 'center' });
  g.col('H', 2, last, LEI);
  g.lists.push({ range: `D2:D${last}`, values: ['buc', 'kg', 'g', 'l', 'm', 'mp', 'set', 'cutie', 'pachet'] });
  g.set(`C${tot}`, 'Total', TOTAL);
  g.set(`I${tot}`, `=SUM(I2:I${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:J${tot}`, 'all');
  g.rules.push({ range: `G2:G${last}`, op: 'gt', v1: '0', look: 'yellow' });
  const IN: CellStyle = { bg: '#fff59d' };
  g.set('L1', 'Bonul', HEAD); g.set('M1', '', HEAD);
  g.set('L2', 'Nr. bon'); g.set('M2', '', { ...IN, align: 'center' });
  g.set('L3', 'Data'); g.set('M3', '=TODAY()', { ...DATE, ...IN });
  g.set('L4', 'Gestiunea (de unde se dă)'); g.set('M4', '', IN);
  g.set('L5', 'Locul de consum (secția, șantierul)'); g.set('M5', '', IN);
  g.set('L6', 'Pentru (comanda, lucrarea)'); g.set('M6', '', IN);
  g.set('L7', 'A cerut'); g.set('M7', '', IN);
  g.set('L8', 'A eliberat (gestionarul)'); g.set('M8', '', IN);
  g.set('L9', 'A primit'); g.set('M9', '', IN);
  g.box('L1:M9', 'all');
  g.set('L11', 'Pe scurt', HEAD); g.set('M11', '', HEAD);
  g.set('L12', 'Materiale pe bon'); g.set('M12', `=COUNTA(C2:C${last})`, { align: 'center' });
  g.set('L13', 'Eliberate doar în parte', { color: '#9c5700' }); g.set('M13', `=COUNTIF(G2:G${last};">0")`, { align: 'center', color: '#9c5700' });
  g.set('L14', 'Valoarea neeliberată (fără TVA)'); g.set('M14', `=SUMPRODUCT(G2:G${last};H2:H${last})`, LEI);
  g.set('L15', 'Valoarea eliberată (fără TVA)', { b: true }); g.set('M15', `=I${tot}`, { ...LEI, b: true });
  g.box('L11:M15', 'all');
  g.set('L17', 'Scrie cât s-a cerut și cât s-a dat din magazie: ce nu s-a putut da iese în galben, cu valoarea lui.', { i: true, color: '#666666' });
  g.set('L18', 'Fiecare material eliberat se scade în fișa lui (Sheets → Fișa de magazie, documentul „Bon de consum”).', { i: true, color: '#666666' });
  g.set('L19', 'Bonul se semnează de cine a cerut, de gestionar și de cine a primit; un exemplar merge la contabilitate.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 90, C: 230, D: 70, E: 120, F: 130, G: 100, H: 140, I: 140, J: 180, K: 30, L: 260, M: 170 });
  return doc('Bon de consum', g.sheet('Bon de consum'));
}

// Bon de transfer: marfa mutată dintr-o gestiune în alta, trimis față de primit.
function bonTransfer(): SheetDoc {
  const g = new Grid();
  const last = 26, tot = last + 1;
  g.head(1, ['Nr.', 'Codul', 'Produsul', 'U.M.', 'Cantitatea trimisă', 'Cantitatea primită', 'Diferența', 'Preț unitar (fără TVA)', 'Valoarea trimisă', 'Valoarea diferenței', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(C${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(E${r}="";F${r}="");"";F${r}-E${r})`, { align: 'center' });
    g.set(`I${r}`, `=IF(OR(E${r}="";H${r}="");"";ROUND(E${r}*H${r};2))`, LEI);
    g.set(`J${r}`, `=IF(OR(G${r}="";H${r}="");"";ROUND(G${r}*H${r};2))`, LEI);
  }
  for (const c of 'BDEF') g.col(c, 2, last, { align: 'center' });
  g.col('H', 2, last, LEI);
  g.lists.push({ range: `D2:D${last}`, values: ['buc', 'kg', 'g', 'l', 'm', 'mp', 'set', 'cutie', 'pachet'] });
  g.set(`C${tot}`, 'Total', TOTAL);
  for (const c of 'IJ') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:K${tot}`, 'all');
  g.rules.push(
    { range: `G2:G${last}`, op: 'lt', v1: '0', look: 'red' },
    { range: `G2:G${last}`, op: 'gt', v1: '0', look: 'yellow' },
  );
  const IN: CellStyle = { bg: '#fff59d' };
  g.set('M1', 'Transferul', HEAD); g.set('N1', '', HEAD);
  g.set('M2', 'Nr. bon'); g.set('N2', '', { ...IN, align: 'center' });
  g.set('M3', 'Data'); g.set('N3', '=TODAY()', { ...DATE, ...IN });
  g.set('M4', 'Din gestiunea'); g.set('N4', '', IN);
  g.set('M5', 'În gestiunea'); g.set('N5', '', IN);
  g.set('M6', 'A predat'); g.set('N6', '', IN);
  g.set('M7', 'A transportat'); g.set('N7', '', IN);
  g.set('M8', 'A primit'); g.set('N8', '', IN);
  g.box('M1:N8', 'all');
  g.set('M10', 'Pe scurt', HEAD); g.set('N10', '', HEAD);
  g.set('M11', 'Produse pe bon'); g.set('N11', `=COUNTA(C2:C${last})`, { align: 'center' });
  g.set('M12', 'Primite cu lipsuri', { color: '#9c0006' }); g.set('N12', `=COUNTIF(G2:G${last};"<0")`, { align: 'center', color: '#9c0006' });
  g.set('M13', 'Primite cu plusuri', { color: '#9c5700' }); g.set('N13', `=COUNTIF(G2:G${last};">0")`, { align: 'center', color: '#9c5700' });
  g.set('M14', 'Valoarea trimisă (fără TVA)', { b: true }); g.set('N14', `=I${tot}`, { ...LEI, b: true });
  g.set('M15', 'Valoarea lipsurilor (fără TVA)', { color: '#9c0006' }); g.set('N15', `=-SUMIF(J2:J${last};"<0")`, { ...LEI, color: '#9c0006' });
  g.set('M16', 'Starea', { b: true });
  g.set('N16', `=IF(N11=0;"";IF(COUNT(F2:F${last})<N11;"Neprimit încă";IF(AND(N12=0;N13=0);"Primit complet";"Primit cu diferențe")))`, { b: true, align: 'center' });
  g.box('M10:N16', 'all');
  g.rules.push(
    { range: 'N16:N16', op: 'eq', v1: 'Primit complet', look: 'green' },
    { range: 'N16:N16', op: 'eq', v1: 'Neprimit încă', look: 'yellow' },
    { range: 'N16:N16', op: 'eq', v1: 'Primit cu diferențe', look: 'red' },
  );
  g.set('M18', 'Cine predă scrie cantitatea trimisă; cine primește scrie ce a numărat la sosire: diferențele ies singure.', { i: true, color: '#666666' });
  g.set('M19', 'În fișa de magazie (Sheets → Fișa de magazie) e ieșire la gestiunea care predă și intrare la cea care primește.', { i: true, color: '#666666' });
  g.set('M20', 'Pentru lipsuri se face proces-verbal și se cere nota explicativă (Docs → Notă explicativă a gestionarului).', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 90, C: 230, D: 70, E: 125, F: 125, G: 90, H: 140, I: 130, J: 140, K: 180, L: 30, M: 250, N: 170 });
  return doc('Bon de transfer', g.sheet('Bon de transfer'));
}

// Perisabilități: lipsa de la inventar față de lipsa admisă (cota din normă × ieșirile perioadei); ce trece peste normă se impută.
function perisabilitati(): SheetDoc {
  const g = new Grid();
  const last = 26, tot = last + 1;
  g.head(1, ['Nr.', 'Produsul', 'Grupa', 'U.M.', 'Ieșirile din perioadă', 'Cota admisă (%)', 'Lipsa admisă', 'Lipsa constatată', 'Lipsa peste normă', 'Preț unitar (fără TVA)', 'În limita normei (lei)', 'De imputat (lei)', 'Observații']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(E${r}="";F${r}="");"";ROUND(E${r}*F${r}/100;3))`, { align: 'center' });
    g.set(`I${r}`, `=IF(OR(G${r}="";H${r}="");"";ROUND(MAX(0;H${r}-G${r});3))`, { align: 'center' });
    g.set(`K${r}`, `=IF(OR(G${r}="";H${r}="";J${r}="");"";ROUND(MIN(H${r};G${r})*J${r};2))`, LEI);
    g.set(`L${r}`, `=IF(OR(I${r}="";J${r}="");"";ROUND(I${r}*J${r};2))`, LEI);
  }
  for (const c of 'DEFH') g.col(c, 2, last, { align: 'center' });
  g.col('J', 2, last, LEI);
  g.lists.push(
    { range: `C2:C${last}`, values: ['Alimente', 'Băuturi', 'Legume și fructe', 'Carne și pește', 'Materiale de construcții', 'Combustibili', 'Chimicale', 'Altele'] },
    { range: `D2:D${last}`, values: ['buc', 'kg', 'g', 'l', 'm', 'mp', 'mc', 't', 'set', 'pachet'] },
  );
  g.set(`B${tot}`, 'Total', TOTAL);
  for (const c of 'KL') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:M${tot}`, 'all');
  g.rules.push({ range: `I2:I${last}`, op: 'gt', v1: '0', look: 'red' });
  const IN: CellStyle = { bg: '#fff59d' };
  g.set('O1', 'Inventarul', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Gestiunea (depozit, magazin)'); g.set('P2', '', IN);
  g.set('O3', 'Gestionarul'); g.set('P3', '', IN);
  g.set('O4', 'Perioada de la'); g.set('P4', '', { ...DATE, ...IN });
  g.set('O5', 'Până la (data inventarului)'); g.set('P5', '=TODAY()', { ...DATE, ...IN });
  g.set('O6', 'Nr. procesului-verbal'); g.set('P6', '', { ...IN, align: 'center' });
  g.box('O1:P6', 'all');
  g.set('O8', 'Pe scurt', HEAD); g.set('P8', '', HEAD);
  g.set('O9', 'Produse cu lipsuri'); g.set('P9', `=COUNTIF(H2:H${last};">0")`, { align: 'center' });
  g.set('O10', 'Peste normă', { color: '#9c0006' }); g.set('P10', `=COUNTIF(I2:I${last};">0")`, { align: 'center', color: '#9c0006' });
  g.set('O11', 'Lipsuri în limita normei (pe cheltuieli)'); g.set('P11', `=K${tot}`, LEI);
  g.set('O12', 'De imputat gestionarului', { b: true, color: '#9c0006' }); g.set('P12', `=L${tot}`, { ...LEI, b: true, color: '#9c0006' });
  g.set('O13', 'Starea', { b: true });
  g.set('P13', '=IF(P9=0;"";IF(P10=0;"În limita normei";"De imputat"))', { b: true, align: 'center' });
  g.box('O8:P13', 'all');
  g.rules.push(
    { range: 'P13:P13', op: 'eq', v1: 'În limita normei', look: 'green' },
    { range: 'P13:P13', op: 'eq', v1: 'De imputat', look: 'red' },
  );
  g.set('O15', 'Ieșirile din perioadă se iau din fișa de magazie (Sheets → Fișa de magazie), de la ultimul inventar până azi.', { i: true, color: '#666666' });
  g.set('O16', 'Lipsa constatată vine din lista de inventariere (Sheets → Listă de inventariere); cotele sunt cele din normele firmei, verificate cu contabilul.', { i: true, color: '#666666' });
  g.set('O17', 'Ce trece peste normă (în roșu) se trece în procesul-verbal de inventariere, cu nota explicativă a gestionarului (Docs).', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 210, C: 150, D: 70, E: 140, F: 120, G: 110, H: 125, I: 125, J: 140, K: 150, L: 130, M: 170, N: 30, O: 280, P: 160 });
  return doc('Perisabilități', g.sheet('Perisabilități'));
}

// Garanțiile gestionarilor: garanția materială stabilită la numire, ce s-a depus și ce s-a reținut lunar, ce mai e de constituit.
function garantiiGestionari(): SheetDoc {
  const g = new Grid();
  const last = 21, tot = last + 1;
  g.head(1, ['Nr.', 'Gestionarul', 'Gestiunea', 'Data numirii', 'Garanția stabilită', 'Depus la început', 'Reținere lunară', 'Luni reținute', 'Constituit până acum', 'Rămas de constituit', 'Luni rămase', 'Contul (banca, IBAN)', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(OR(B${r}="";E${r}="");"";MIN(E${r};N(F${r})+N(G${r})*N(H${r})))`, LEI);
    g.set(`J${r}`, `=IF(I${r}="";"";MAX(0;E${r}-I${r}))`, LEI);
    g.set(`K${r}`, `=IF(J${r}="";"";IF(J${r}=0;0;IF(N(G${r})>0;ROUNDUP(J${r}/G${r};0);"")))`, { align: 'center' });
    g.set(`M${r}`, `=IF(J${r}="";"";IF(J${r}=0;"Constituită";IF(I${r}>0;"În curs";"Neîncepută")))`, { align: 'center' });
  }
  g.col('D', 2, last, DATE);
  for (const c of 'EFG') g.col(c, 2, last, LEI);
  g.col('H', 2, last, { align: 'center' });
  g.set(`B${tot}`, 'Total', TOTAL);
  for (const c of 'EIJ') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:M${tot}`, 'all');
  g.rules.push(
    { range: `M2:M${last}`, op: 'eq', v1: 'Constituită', look: 'green' },
    { range: `M2:M${last}`, op: 'eq', v1: 'În curs', look: 'yellow' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Neîncepută', look: 'red' },
  );
  g.set('O1', 'Pe scurt', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Gestionari'); g.set('P2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('O3', 'Garanții constituite', { color: '#006100' }); g.set('P3', `=COUNTIF(M2:M${last};"Constituită")`, { align: 'center', color: '#006100' });
  g.set('O4', 'În curs (prin rețineri)', { color: '#9c5700' }); g.set('P4', `=COUNTIF(M2:M${last};"În curs")`, { align: 'center', color: '#9c5700' });
  g.set('O5', 'Neîncepute', { color: '#9c0006' }); g.set('P5', `=COUNTIF(M2:M${last};"Neîncepută")`, { align: 'center', color: '#9c0006' });
  g.set('O6', 'Garanțiile stabilite'); g.set('P6', `=E${tot}`, LEI);
  g.set('O7', 'Constituit până acum', { b: true }); g.set('P7', `=I${tot}`, { ...LEI, b: true });
  g.set('O8', 'Rămas de constituit'); g.set('P8', `=J${tot}`, LEI);
  g.box('O1:P8', 'all');
  g.set('O10', 'Garanția stabilită e cea din decizia de numire (Docs → Decizie de numire a gestionarului).', { i: true, color: '#666666' });
  g.set('O11', 'La „Luni reținute” scrii câte rețineri s-au făcut din salariu; constituitul și lunile rămase ies singure.', { i: true, color: '#666666' });
  g.set('O12', 'Suma, reținerile și contul se stabilesc după lege și contractul de garanție: verifică-le cu contabilul.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 190, C: 170, D: 110, E: 130, F: 120, G: 120, H: 100, I: 150, J: 140, K: 100, L: 200, M: 120, N: 30, O: 250, P: 150 });
  return doc('Garanțiile gestionarilor', g.sheet('Garanțiile gestionarilor'));
}

// Necesar de aprovizionare: din consumul lunar, termenul de livrare și stocul de siguranță ies punctul de comandă și cât de comandat.
function necesarAprovizionare(): SheetDoc {
  const g = new Grid();
  const last = 26, tot = last + 1;
  g.head(1, ['Nr.', 'Produsul', 'Furnizorul', 'U.M.', 'Stoc la zi', 'Comandat (pe drum)', 'Consum mediu pe lună', 'Termen de livrare (zile)', 'Stoc de siguranță (zile)', 'Zile acoperite', 'Punctul de comandă', 'De comandat', 'Preț unitar (fără TVA)', 'Valoarea comenzii', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`J${r}`, `=IF(OR(B${r}="";N(G${r})<=0);"";ROUNDDOWN((N(E${r})+N(F${r}))*30/G${r};0))`, { align: 'center' });
    g.set(`K${r}`, `=IF(OR(B${r}="";G${r}="");"";ROUNDUP(G${r}*(N(H${r})+N(I${r}))/30;0))`, { align: 'center' });
    g.set(`L${r}`, `=IF(K${r}="";"";IF(N(E${r})+N(F${r})<=K${r};ROUNDUP(K${r}+G${r}-N(E${r})-N(F${r});0);0))`, { align: 'center', b: true });
    g.set(`N${r}`, `=IF(OR(L${r}="";M${r}="");"";ROUND(L${r}*M${r};2))`, LEI);
    g.set(`O${r}`, `=IF(K${r}="";"";IF(N(E${r})<=0;"Lipsă din stoc";IF(L${r}>0;"De comandat";"Suficient")))`, { align: 'center' });
  }
  for (const c of 'DEFGHI') g.col(c, 2, last, { align: 'center' });
  g.col('M', 2, last, LEI);
  g.lists.push({ range: `D2:D${last}`, values: ['buc', 'kg', 'g', 'l', 'm', 'mp', 'mc', 't', 'set', 'pachet', 'cutie', 'bax'] });
  g.set(`B${tot}`, 'Total', TOTAL);
  g.set(`N${tot}`, `=SUM(N2:N${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:O${tot}`, 'all');
  g.rules.push(
    { range: `O2:O${last}`, op: 'eq', v1: 'Suficient', look: 'green' },
    { range: `O2:O${last}`, op: 'eq', v1: 'De comandat', look: 'yellow' },
    { range: `O2:O${last}`, op: 'eq', v1: 'Lipsă din stoc', look: 'red' },
  );
  g.set('Q1', 'Pe scurt', HEAD); g.set('R1', '', HEAD);
  g.set('Q2', 'Produse urmărite'); g.set('R2', `=COUNTA(B2:B${last})`, { align: 'center' });
  g.set('Q3', 'De comandat acum', { color: '#9c5700' }); g.set('R3', `=COUNTIF(L2:L${last};">0")`, { align: 'center', color: '#9c5700' });
  g.set('Q4', 'Lipsă din stoc', { color: '#9c0006' }); g.set('R4', `=COUNTIF(O2:O${last};"Lipsă din stoc")`, { align: 'center', color: '#9c0006' });
  g.set('Q5', 'Valoarea comenzilor (fără TVA)', { b: true }); g.set('R5', `=N${tot}`, { ...LEI, b: true });
  g.set('Q6', 'Cel mai puțin acoperit (zile)'); g.set('R6', `=IF(COUNT(J2:J${last})=0;"";MIN(J2:J${last}))`, { align: 'center' });
  g.box('Q1:R6', 'all');
  g.set('Q8', 'Stocul la zi se ia din fișa de magazie (Sheets → Fișa de magazie); consumul mediu, din ieșirile ultimelor luni.', { i: true, color: '#666666' });
  g.set('Q9', 'Punctul de comandă = consumul pe zilele de livrare plus zilele de siguranță; când stocul cu ce e pe drum ajunge la el, se comandă.', { i: true, color: '#666666' });
  g.set('Q10', 'Cantitatea de comandat ajunge până la punctul de comandă plus consumul pe încă o lună; prețurile se pot compara în Sheets → Compararea ofertelor.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 210, C: 170, D: 70, E: 100, F: 130, G: 150, H: 160, I: 160, J: 110, K: 140, L: 110, M: 150, N: 140, O: 130, P: 30, Q: 260, R: 150 });
  return doc('Necesar de aprovizionare', g.sheet('Necesar de aprovizionare'));
}

// Evaluarea furnizorilor: livrările la termen și fără probleme, plus notele pentru preț și colaborare, dau punctajul și clasa A / B / C.
function evaluareFurnizori(): SheetDoc {
  const g = new Grid();
  const last = 21, tot = last + 1;
  g.head(1, ['Nr.', 'Furnizorul', 'Ce livrează', 'Livrări în perioadă', 'Livrări la termen', 'Livrări fără neconformități', 'Nota pentru preț (1–5)', 'Nota pentru colaborare (1–5)', 'La termen (%)', 'Conforme (%)', 'Punctaj (din 100)', 'Clasa', 'Decizia']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(OR(B${r}="";N(D${r})<=0);"";ROUND(MIN(N(E${r});D${r})*100/D${r};0))`, { align: 'center' });
    g.set(`J${r}`, `=IF(OR(B${r}="";N(D${r})<=0);"";ROUND(MIN(N(F${r});D${r})*100/D${r};0))`, { align: 'center' });
    g.set(`K${r}`, `=IF(OR(I${r}="";G${r}="";H${r}="");"";ROUND(0,35*I${r}+0,35*J${r}+4*MIN(MAX(G${r};1);5)+2*MIN(MAX(H${r};1);5);0))`, { align: 'center', b: true });
    g.set(`L${r}`, `=IF(K${r}="";"";IF(K${r}>=85;"A";IF(K${r}>=70;"B";"C")))`, { align: 'center', b: true });
    g.set(`M${r}`, `=IF(L${r}="";"";IF(L${r}="A";"Preferat";IF(L${r}="B";"Acceptat";"De înlocuit")))`, { align: 'center' });
  }
  for (const c of 'DEFGH') g.col(c, 2, last, { align: 'center' });
  g.lists.push({ range: `G2:H${last}`, values: ['1', '2', '3', '4', '5'] });
  g.set(`B${tot}`, 'Total', TOTAL);
  for (const c of 'DEF') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...TOTAL, align: 'center' });
  g.set(`I${tot}`, `=IF(N(D${tot})<=0;"";ROUND(E${tot}*100/D${tot};0))`, { ...TOTAL, align: 'center' });
  g.set(`J${tot}`, `=IF(N(D${tot})<=0;"";ROUND(F${tot}*100/D${tot};0))`, { ...TOTAL, align: 'center' });
  g.box(`A1:M${tot}`, 'all');
  g.rules.push(
    { range: `L2:M${last}`, op: 'eq', v1: 'A', look: 'green' },
    { range: `L2:M${last}`, op: 'eq', v1: 'B', look: 'yellow' },
    { range: `L2:M${last}`, op: 'eq', v1: 'C', look: 'red' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Preferat', look: 'green' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Acceptat', look: 'yellow' },
    { range: `M2:M${last}`, op: 'eq', v1: 'De înlocuit', look: 'red' },
  );
  g.set('O1', 'Pe scurt', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Furnizori evaluați'); g.set('P2', `=COUNT(K2:K${last})`, { align: 'center' });
  g.set('O3', 'Clasa A (preferați)', { color: '#006100' }); g.set('P3', `=COUNTIF(L2:L${last};"A")`, { align: 'center', color: '#006100' });
  g.set('O4', 'Clasa B (acceptați)', { color: '#9c5700' }); g.set('P4', `=COUNTIF(L2:L${last};"B")`, { align: 'center', color: '#9c5700' });
  g.set('O5', 'Clasa C (de înlocuit)', { color: '#9c0006' }); g.set('P5', `=COUNTIF(L2:L${last};"C")`, { align: 'center', color: '#9c0006' });
  g.set('O6', 'Punctajul mediu'); g.set('P6', `=IF(COUNT(K2:K${last})=0;"";ROUND(AVERAGE(K2:K${last});0))`, { align: 'center' });
  g.set('O7', 'Cel mai bun furnizor', { b: true }); g.set('P7', `=IF(COUNT(K2:K${last})=0;"";INDEX(B2:B${last};MATCH(MAX(K2:K${last});K2:K${last};0)))`, { b: true });
  g.box('O1:P7', 'all');
  g.set('O9', 'Punctajul: 35% livrările la termen, 35% livrările fără neconformități, 20% prețul și 10% colaborarea (răspunsuri, documente, rezolvarea reclamațiilor).', { i: true, color: '#666666' });
  g.set('O10', 'Clasa A de la 85 de puncte, clasa B de la 70; sub 70 furnizorul e clasa C și se caută altul (Sheets → Compararea ofertelor).', { i: true, color: '#666666' });
  g.set('O11', 'Livrările și întârzierile se iau din notele de recepție (Sheets → Notă de recepție); neconformitățile, din notificările trimise furnizorilor.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 210, C: 190, D: 130, E: 130, F: 170, G: 150, H: 180, I: 110, J: 110, K: 130, L: 70, M: 120, N: 30, O: 260, P: 190 });
  return doc('Evaluarea furnizorilor', g.sheet('Evaluarea furnizorilor'));
}

// Retururi către furnizori: marfa dată înapoi (neconformă, deteriorată, greșit livrată), valoarea cu TVA, nota de credit primită și ce mai e de recuperat.
function retururiFurnizori(): SheetDoc {
  const g = new Grid();
  const last = 41, tot = last + 1;
  g.head(1, ['Nr.', 'Data returului', 'Furnizorul', 'Produsul', 'Documentul de intrare (NIR / factură)', 'Cantitatea returnată', 'U.M.', 'Preț unitar (fără TVA)', 'Cota TVA (%)', 'Valoarea cu TVA', 'Motivul', 'Răspunsul furnizorului', 'Nota de credit (nr.)', 'Suma creditată', 'Rest de recuperat', 'Zile de la retur', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(D${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`J${r}`, `=IF(OR(D${r}="";F${r}="";H${r}="");"";ROUND(F${r}*H${r}*(1+N(I${r})/100);2))`, LEI);
    g.set(`O${r}`, `=IF(J${r}="";"";IF(L${r}="Refuzat";0;ROUND(MAX(J${r}-N(N${r});0);2)))`, { ...LEI, b: true });
    g.set(`P${r}`, `=IF(OR(J${r}="";B${r}="";Q${r}="Recuperat";Q${r}="Refuzat");"";TODAY()-B${r})`, { align: 'center' });
    g.set(`Q${r}`, `=IF(J${r}="";"";IF(L${r}="Refuzat";"Refuzat";IF(O${r}<=0;"Recuperat";IF(N(N${r})>0;"Recuperat parțial";IF(L${r}="Acceptat";"Așteaptă nota de credit";"Fără răspuns")))))`, { align: 'center' });
  }
  g.col('B', 2, last, DATE);
  for (const c of 'FGI') g.col(c, 2, last, { align: 'center' });
  for (const c of 'HN') g.col(c, 2, last, LEI);
  g.lists.push(
    { range: `G2:G${last}`, values: ['buc', 'kg', 'g', 'l', 'm', 'mp', 'mc', 't', 'set', 'pachet', 'cutie', 'bax'] },
    { range: `I2:I${last}`, values: ['21', '11', '0'] },
    { range: `K2:K${last}`, values: ['Neconform calitativ', 'Deteriorat la transport', 'Livrat în plus', 'Greșit livrat', 'Expirat sau cu termen scurt', 'Altul'] },
    { range: `L2:L${last}`, values: ['În așteptare', 'Acceptat', 'Refuzat'] },
  );
  g.set(`D${tot}`, 'Total', TOTAL);
  for (const c of 'JNO') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:Q${tot}`, 'all');
  g.rules.push(
    { range: `Q2:Q${last}`, op: 'eq', v1: 'Recuperat', look: 'green' },
    { range: `Q2:Q${last}`, op: 'eq', v1: 'Recuperat parțial', look: 'yellow' },
    { range: `Q2:Q${last}`, op: 'eq', v1: 'Așteaptă nota de credit', look: 'yellow' },
    { range: `Q2:Q${last}`, op: 'eq', v1: 'Refuzat', look: 'red' },
    { range: `P2:P${last}`, op: 'gt', v1: '30', look: 'red' },
  );
  g.set('S1', 'Pe scurt', HEAD); g.set('T1', '', HEAD);
  g.set('S2', 'Retururi în listă'); g.set('T2', `=COUNT(J2:J${last})`, { align: 'center' });
  g.set('S3', 'Valoarea returnată (cu TVA)'); g.set('T3', `=J${tot}`, LEI);
  g.set('S4', 'Recuperat (note de credit)', { color: '#006100' }); g.set('T4', `=N${tot}`, { ...LEI, color: '#006100' });
  g.set('S5', 'Rest de recuperat', { b: true }); g.set('T5', `=O${tot}`, { ...LEI, b: true });
  g.set('S6', 'Refuzate de furnizor (valoarea)', { color: '#9c0006' }); g.set('T6', `=SUMIF(Q2:Q${last};"Refuzat";J2:J${last})`, { ...LEI, color: '#9c0006' });
  g.set('S7', 'Nerezolvate de peste 30 de zile', { color: '#9c0006' }); g.set('T7', `=COUNTIF(P2:P${last};">30")`, { align: 'center', color: '#9c0006' });
  g.box('S1:T7', 'all');
  g.set('S9', 'Marfa returnată pleacă cu aviz de însoțire sau cu factură de retur; furnizorul trimite apoi nota de credit (factura cu minus), trecută aici cu numărul și suma.', { i: true, color: '#666666' });
  g.set('S10', 'Neconformitățile se anunță prin Docs → Notificare de neconformitate la livrare; cantitățile primite se văd în Sheets → Notă de recepție.', { i: true, color: '#666666' });
  g.set('S11', 'Retururile refuzate și cele nerezolvate de peste 30 de zile contează la Sheets → Evaluarea furnizorilor.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 110, C: 190, D: 200, E: 230, F: 140, G: 70, H: 150, I: 100, J: 130, K: 190, L: 170, M: 140, N: 130, O: 130, P: 110, Q: 180, R: 30, S: 260, T: 150 });
  return doc('Retururi către furnizori', g.sheet('Retururi către furnizori'));
}

// Ambalaje returnabile: paleții, navetele și lăzile primite de la parteneri sau date lor, cu soldul pe partener și pe fel de ambalaj și garanția în lei.
function ambalajeReturnabile(): SheetDoc {
  const g = new Grid();
  const last = 101, tot = last + 1;
  const kinds = ['Palet EUR', 'Palet industrial', 'Navetă', 'Ladă', 'Butelie', 'Cutie returnabilă', 'Altul'];
  g.head(1, ['Nr.', 'Data', 'Partenerul', 'Ambalajul', 'Documentul (aviz / factură)', 'Primite de la partener', 'Date partenerului', 'Garanția pe bucată (lei)', 'Valoarea mișcării', 'Soldul partenerului pe ambalaj', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(OR(C${r}="";D${r}="");"";ROW()-1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(OR(C${r}="";D${r}="";H${r}="");"";ROUND((N(F${r})-N(G${r}))*H${r};2))`, LEI);
    g.set(`J${r}`, `=IF(OR(C${r}="";D${r}="");"";SUMIFS(F$2:F${r};C$2:C${r};C${r};D$2:D${r};D${r})-SUMIFS(G$2:G${r};C$2:C${r};C${r};D$2:D${r};D${r}))`, { align: 'center', b: true });
    g.set(`K${r}`, `=IF(J${r}="";"";IF(J${r}>0;"De dat înapoi";IF(J${r}<0;"De primit înapoi";"Închis")))`, { align: 'center' });
  }
  g.col('B', 2, last, DATE);
  for (const c of 'FG') g.col(c, 2, last, { align: 'center' });
  g.col('H', 2, last, LEI);
  g.lists.push({ range: `D2:D${last}`, values: kinds });
  g.set(`C${tot}`, 'Total', TOTAL);
  for (const c of 'FG') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...TOTAL, align: 'center' });
  g.set(`I${tot}`, `=SUM(I2:I${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:K${tot}`, 'all');
  g.rules.push(
    { range: `K2:K${last}`, op: 'eq', v1: 'De dat înapoi', look: 'yellow' },
    { range: `K2:K${last}`, op: 'eq', v1: 'De primit înapoi', look: 'red' },
    { range: `K2:K${last}`, op: 'eq', v1: 'Închis', look: 'green' },
  );
  g.set('M1', 'Pe fel de ambalaj', HEAD); g.set('N1', 'Sold (bucăți)', HEAD); g.set('O1', 'Garanția (lei)', HEAD);
  kinds.forEach((k, i) => {
    const r = i + 2;
    g.set(`M${r}`, k);
    g.set(`N${r}`, `=SUMIF(D2:D${last};M${r};F2:F${last})-SUMIF(D2:D${last};M${r};G2:G${last})`, { align: 'center' });
    g.set(`O${r}`, `=SUMIF(D2:D${last};M${r};I2:I${last})`, LEI);
  });
  const kt = kinds.length + 2;
  g.set(`M${kt}`, 'Total', TOTAL); g.set(`N${kt}`, `=SUM(N2:N${kt - 1})`, { ...TOTAL, align: 'center' }); g.set(`O${kt}`, `=SUM(O2:O${kt - 1})`, { ...LEI, ...TOTAL });
  g.box(`M1:O${kt}`, 'all');
  g.rules.push({ range: `N2:N${kt}`, op: 'lt', v1: '0', look: 'red' });
  const p = kt + 2;
  g.set(`M${p}`, 'Soldul unui partener', HEAD); g.set(`N${p}`, '', HEAD); g.set(`O${p}`, '', HEAD);
  g.set(`M${p + 1}`, 'Partenerul (scrie numele)'); g.set(`N${p + 1}`, '', { b: true });
  g.set(`M${p + 2}`, 'Sold (bucăți, toate ambalajele)'); g.set(`N${p + 2}`, `=IF(N${p + 1}="";"";SUMIF(C2:C${last};N${p + 1};F2:F${last})-SUMIF(C2:C${last};N${p + 1};G2:G${last}))`, { align: 'center' });
  g.set(`M${p + 3}`, 'Garanția (lei)'); g.set(`N${p + 3}`, `=IF(N${p + 1}="";"";SUMIF(C2:C${last};N${p + 1};I2:I${last}))`, LEI);
  g.box(`M${p}:O${p + 3}`, 'all');
  g.set(`M${p + 5}`, 'Soldul pozitiv înseamnă ambalaje ale partenerului aflate la noi (de dat înapoi); cel negativ, ambalaje ale noastre aflate la el (de primit înapoi).', { i: true, color: '#666666' });
  g.set(`M${p + 6}`, 'Ambalajele circulă cu avizul de însoțire; garanția se facturează sau se scade la returnare, după înțelegerea cu partenerul.', { i: true, color: '#666666' });
  g.set(`M${p + 7}`, 'Ambalajele cu marfă primită se trec și în Sheets → Notă de recepție; cele date clienților, pe avizul de livrare.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 100, C: 200, D: 160, E: 210, F: 160, G: 150, H: 170, I: 140, J: 210, K: 150, L: 30, M: 250, N: 160, O: 140 });
  return doc('Ambalaje returnabile', g.sheet('Ambalaje returnabile'));
}

// Retururi de la clienți: marfa primită înapoi, factura storno de emis, banii de dat înapoi și ce se face cu marfa (repusă în vânzare, reparată, casată).
function retururiClienti(): SheetDoc {
  const g = new Grid();
  const last = 41, tot = last + 1;
  g.head(1, ['Nr.', 'Data returului', 'Clientul', 'Factura inițială', 'Produsul', 'Cantitatea', 'Preț unitar (fără TVA)', 'Cota TVA (%)', 'Valoarea cu TVA', 'Motivul', 'Ce facem cu marfa', 'Factura storno (nr.)', 'Suma restituită', 'Rest de restituit', 'Zile de la retur', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(E${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(OR(E${r}="";F${r}="";G${r}="");"";ROUND(F${r}*G${r}*(1+N(H${r})/100);2))`, LEI);
    g.set(`N${r}`, `=IF(I${r}="";"";ROUND(MAX(I${r}-N(M${r});0);2))`, { ...LEI, b: true });
    g.set(`O${r}`, `=IF(OR(I${r}="";B${r}="";P${r}="Închis");"";TODAY()-B${r})`, { align: 'center' });
    g.set(`P${r}`, `=IF(I${r}="";"";IF(L${r}="";"De emis storno";IF(N${r}<=0;"Închis";"De restituit banii")))`, { align: 'center' });
  }
  g.col('B', 2, last, DATE);
  for (const c of 'FH') g.col(c, 2, last, { align: 'center' });
  for (const c of 'GM') g.col(c, 2, last, LEI);
  g.lists.push(
    { range: `H2:H${last}`, values: ['21', '11', '0'] },
    { range: `J2:J${last}`, values: ['Neconform', 'Deteriorat', 'Greșit livrat', 'Retragere în 14 zile (online)', 'În garanție', 'Altul'] },
    { range: `K2:K${last}`, values: ['Repusă în vânzare', 'De reparat', 'Returnată la furnizor', 'De casat'] },
  );
  g.set(`E${tot}`, 'Total', TOTAL);
  for (const c of 'IMN') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:P${tot}`, 'all');
  g.rules.push(
    { range: `P2:P${last}`, op: 'eq', v1: 'Închis', look: 'green' },
    { range: `P2:P${last}`, op: 'eq', v1: 'De emis storno', look: 'yellow' },
    { range: `P2:P${last}`, op: 'eq', v1: 'De restituit banii', look: 'yellow' },
    { range: `O2:O${last}`, op: 'gt', v1: '14', look: 'red' },
  );
  g.set('R1', 'Pe scurt', HEAD); g.set('S1', '', HEAD);
  g.set('R2', 'Retururi în listă'); g.set('S2', `=COUNT(I2:I${last})`, { align: 'center' });
  g.set('R3', 'Valoarea returnată (cu TVA)'); g.set('S3', `=I${tot}`, LEI);
  g.set('R4', 'Restituit clienților', { color: '#006100' }); g.set('S4', `=M${tot}`, { ...LEI, color: '#006100' });
  g.set('R5', 'Rest de restituit', { b: true }); g.set('S5', `=N${tot}`, { ...LEI, b: true });
  g.set('R6', 'Facturi storno de emis', { color: '#9c5700' }); g.set('S6', `=COUNTIF(P2:P${last};"De emis storno")`, { align: 'center', color: '#9c5700' });
  g.set('R7', 'Nerezolvate de peste 14 zile', { color: '#9c0006' }); g.set('S7', `=COUNTIF(O2:O${last};">14")`, { align: 'center', color: '#9c0006' });
  g.set('R8', 'Marfă de casat (valoarea)', { color: '#9c0006' }); g.set('S8', `=SUMIF(K2:K${last};"De casat";I2:I${last})`, { ...LEI, color: '#9c0006' });
  g.box('R1:S8', 'all');
  g.set('R10', 'Pentru fiecare retur se emite factura storno (cu minus) către client; banii se dau înapoi pe același drum pe care au venit (cont, card, numerar).', { i: true, color: '#666666' });
  g.set('R11', 'La cumpărăturile online, clientul are 14 zile să se răzgândească, iar banii i se dau înapoi în cel mult 14 zile de la anunțul lui.', { i: true, color: '#666666' });
  g.set('R12', 'Marfa repusă în vânzare intră înapoi în Sheets → Fișa de magazie; cea defectă de la furnizor merge în Sheets → Retururi către furnizori.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 110, C: 190, D: 130, E: 200, F: 100, G: 150, H: 100, I: 130, J: 200, K: 180, L: 140, M: 130, N: 130, O: 110, P: 160, Q: 30, R: 250, S: 150 });
  return doc('Retururi de la clienți', g.sheet('Retururi de la clienți'));
}

// Calculul prețului de vânzare: din prețul de achiziție și adaosul comercial ies prețul fără TVA, TVA, prețul cu TVA rotunjit în sus la 10 bani, adaosul în lei și marja.
function pretVanzare(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  g.head(1, ['Nr.', 'Produsul', 'U.M.', 'Preț de achiziție (fără TVA)', 'Adaos comercial (%)', 'Cota TVA (%)', 'Preț de vânzare fără TVA', 'TVA', 'Preț de vânzare cu TVA', 'Prețul rotunjit (cu TVA)', 'Adaosul pe bucată (lei)', 'Marja (din vânzare)', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(OR(B${r}="";D${r}="");"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(B${r}="";D${r}="");"";ROUND(D${r}*(1+N(E${r})/100);2))`, LEI);
    g.set(`H${r}`, `=IF(G${r}="";"";ROUND(G${r}*N(F${r})/100;2))`, LEI);
    g.set(`I${r}`, `=IF(G${r}="";"";G${r}+H${r})`, LEI);
    g.set(`J${r}`, `=IF(I${r}="";"";ROUNDUP(ROUND(I${r}*10;6);0)/10)`, { ...LEI, b: true });
    g.set(`K${r}`, `=IF(J${r}="";"";ROUND(J${r}/(1+N(F${r})/100)-D${r};2))`, LEI);
    g.set(`L${r}`, `=IF(OR(J${r}="";J${r}=0);"";K${r}/(J${r}/(1+N(F${r})/100)))`, PCT);
    g.set(`M${r}`, `=IF(K${r}="";"";IF(K${r}<0;"În pierdere";IF(N(E${r})<P$3;"Sub adaosul minim";"Bun")))`, { align: 'center' });
  }
  g.col('C', 2, last, { align: 'center' });
  for (const c of 'EF') g.col(c, 2, last, { align: 'center' });
  g.col('D', 2, last, LEI);
  g.lists.push(
    { range: `C2:C${last}`, values: ['buc', 'kg', 'l', 'm', 'mp', 'set', 'cutie'] },
    { range: `F2:F${last}`, values: ['21', '11', '0'] },
  );
  g.set(`B${tot}`, 'Media', TOTAL);
  g.set(`E${tot}`, `=IF(COUNT(G2:G${last})=0;"";AVERAGE(E2:E${last}))`, { ...TOTAL, align: 'center', fmt: 'number', dec: 2 });
  g.set(`L${tot}`, `=IF(COUNT(L2:L${last})=0;"";AVERAGE(L2:L${last}))`, { ...PCT, ...TOTAL });
  g.box(`A1:M${tot}`, 'all');
  g.rules.push(
    { range: `M2:M${last}`, op: 'eq', v1: 'Bun', look: 'green' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Sub adaosul minim', look: 'yellow' },
    { range: `M2:M${last}`, op: 'eq', v1: 'În pierdere', look: 'red' },
  );
  g.set('O1', 'Pe scurt', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Produse în listă'); g.set('P2', `=COUNT(G2:G${last})`, { align: 'center' });
  g.set('O3', 'Adaosul minim dorit (%)', { b: true }); g.set('P3', '10', { align: 'center', b: true, bg: '#fff2cc' });
  g.set('O4', 'Adaosul mediu (%)'); g.set('P4', `=E${tot}`, { align: 'center', fmt: 'number', dec: 2 });
  g.set('O5', 'Marja medie'); g.set('P5', `=L${tot}`, PCT);
  g.set('O6', 'Sub adaosul minim', { color: '#9c5700' }); g.set('P6', `=COUNTIF(M2:M${last};"Sub adaosul minim")`, { align: 'center', color: '#9c5700' });
  g.set('O7', 'În pierdere', { color: '#9c0006' }); g.set('P7', `=COUNTIF(M2:M${last};"În pierdere")`, { align: 'center', color: '#9c0006' });
  g.box('O1:P7', 'all');
  g.set('O9', 'Adaosul se pune la prețul de achiziție fără TVA; TVA se calculează la urmă, la prețul de vânzare fără TVA.', { i: true, color: '#666666' });
  g.set('O10', 'Marja e partea din prețul de vânzare (fără TVA) care rămâne după costul mărfii: un adaos de 25% înseamnă o marjă de 20%.', { i: true, color: '#666666' });
  g.set('O11', 'Prețul rotunjit e cel de pe etichetă; adaosul și marja se calculează din el. Prețurile noi se trec și în Sheets → Notă de recepție.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 220, C: 70, D: 170, E: 150, F: 100, G: 170, H: 100, I: 160, J: 170, K: 170, L: 150, M: 160, N: 30, O: 230, P: 120 });
  return doc('Calculul prețului de vânzare', g.sheet('Prețul de vânzare'));
}

// Listă de prețuri pentru clienți: prețul de listă și prețurile cu reducere pentru clienții A / B / C (reducerile se aleg în dreapta), cu verificarea față de prețul de achiziție.
function listaPreturi(): SheetDoc {
  const g = new Grid();
  const last = 81;
  g.head(1, ['Nr.', 'Codul', 'Produsul', 'U.M.', 'Prețul de listă (fără TVA)', 'Cota TVA (%)', 'Prețul de listă cu TVA', 'Clienți A (fără TVA)', 'Clienți B (fără TVA)', 'Clienți C (fără TVA)', 'Prețul de achiziție (fără TVA)', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(OR(C${r}="";E${r}="");"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(C${r}="";E${r}="");"";ROUND(E${r}*(1+N(F${r})/100);2))`, { ...LEI, b: true });
    g.set(`H${r}`, `=IF(G${r}="";"";ROUND(E${r}*(1-N(O$3)/100);2))`, LEI);
    g.set(`I${r}`, `=IF(G${r}="";"";ROUND(E${r}*(1-N(O$4)/100);2))`, LEI);
    g.set(`J${r}`, `=IF(G${r}="";"";ROUND(E${r}*(1-N(O$5)/100);2))`, LEI);
    g.set(`L${r}`, `=IF(OR(G${r}="";K${r}="");"";IF(J${r}<K${r};"Sub cost la toți";IF(H${r}<K${r};"Sub cost la clienții A";"Bun")))`, { align: 'center' });
  }
  for (const c of 'BDF') g.col(c, 2, last, { align: 'center' });
  for (const c of 'EK') g.col(c, 2, last, LEI);
  g.lists.push(
    { range: `D2:D${last}`, values: ['buc', 'kg', 'l', 'm', 'mp', 'set', 'cutie'] },
    { range: `F2:F${last}`, values: ['21', '11', '0'] },
  );
  g.box(`A1:L${last}`, 'all');
  g.rules.push(
    { range: `L2:L${last}`, op: 'eq', v1: 'Bun', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Sub cost la clienții A', look: 'yellow' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Sub cost la toți', look: 'red' },
  );
  g.set('N1', 'Reducerile pe categorii', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Valabilă de la data'); g.set('O2', '', DATE);
  g.set('N3', 'Clienți A: reducere (%)', { b: true }); g.set('O3', '10', { align: 'center', b: true, bg: '#fff2cc' });
  g.set('N4', 'Clienți B: reducere (%)', { b: true }); g.set('O4', '5', { align: 'center', b: true, bg: '#fff2cc' });
  g.set('N5', 'Clienți C: reducere (%)', { b: true }); g.set('O5', '0', { align: 'center', b: true, bg: '#fff2cc' });
  g.box('N1:O5', 'all');
  g.set('N7', 'Pe scurt', HEAD); g.set('O7', '', HEAD);
  g.set('N8', 'Produse în listă'); g.set('O8', `=COUNT(G2:G${last})`, { align: 'center' });
  g.set('N9', 'Sub cost la clienții A', { color: '#9c5700' }); g.set('O9', `=COUNTIF(L2:L${last};"Sub cost la clienții A")`, { align: 'center', color: '#9c5700' });
  g.set('N10', 'Sub cost la toți', { color: '#9c0006' }); g.set('O10', `=COUNTIF(L2:L${last};"Sub cost la toți")`, { align: 'center', color: '#9c0006' });
  g.box('N7:O10', 'all');
  g.set('N12', 'Categoriile: A sunt clienții mari sau cu contract, B cei care cumpără des, C restul (prețul de listă). Reducerile le schimbi în căsuțele galbene.', { i: true, color: '#666666' });
  g.set('N13', 'Prețul de achiziție nu se trimite clienților: înainte să trimiți lista, ascunde coloana K sau șterge-o dintr-o copie.', { i: true, color: '#666666' });
  g.set('N14', 'Prețurile de listă le poți lua din Sheets → Calculul prețului de vânzare; o schimbare de prețuri se anunță din timp clienților cu contract.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 90, C: 230, D: 70, E: 170, F: 100, G: 170, H: 150, I: 150, J: 150, K: 190, L: 180, M: 30, N: 250, O: 120 });
  return doc('Listă de prețuri pentru clienți', g.sheet('Lista de prețuri'));
}

// Promoții: prețul redus din prețul normal și reducere, perioada, marja rămasă în promoție (față de prețul de achiziție) și starea după data de azi.
function promotii(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  g.head(1, ['Nr.', 'Produsul', 'De la data', 'Până la data', 'Prețul normal (cu TVA)', 'Reducerea (%)', 'Prețul promoțional (cu TVA)', 'Cota TVA (%)', 'Prețul de achiziție (fără TVA)', 'Marja în promoție', 'Bucăți vândute', 'Încasat în promoție', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(OR(B${r}="";E${r}="");"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(B${r}="";E${r}="");"";ROUND(E${r}*(1-N(F${r})/100);2))`, { ...LEI, b: true });
    g.set(`J${r}`, `=IF(OR(G${r}="";I${r}="";N(G${r})=0);"";(G${r}/(1+N(H${r})/100)-I${r})/(G${r}/(1+N(H${r})/100)))`, PCT);
    g.set(`L${r}`, `=IF(G${r}="";"";ROUND(G${r}*N(K${r});2))`, LEI);
    g.set(`M${r}`, `=IF(G${r}="";"";IF(AND(I${r}<>"";N(J${r})<0);"Sub cost";IF(AND(C${r}<>"";TODAY()<C${r});"Viitoare";IF(AND(D${r}<>"";TODAY()>D${r});"Încheiată";"Activă"))))`, { align: 'center' });
  }
  for (const c of 'CD') g.col(c, 2, last, DATE);
  for (const c of 'FHK') g.col(c, 2, last, { align: 'center' });
  for (const c of 'EI') g.col(c, 2, last, LEI);
  g.lists.push({ range: `H2:H${last}`, values: ['21', '11', '0'] });
  g.set(`B${tot}`, 'Total', TOTAL);
  g.set(`K${tot}`, `=SUM(K2:K${last})`, { ...TOTAL, align: 'center' });
  g.set(`L${tot}`, `=SUM(L2:L${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:M${tot}`, 'all');
  g.rules.push(
    { range: `M2:M${last}`, op: 'eq', v1: 'Activă', look: 'green' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Viitoare', look: 'blue' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Sub cost', look: 'red' },
  );
  g.set('O1', 'Pe scurt', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Produse în promoție'); g.set('P2', `=COUNT(G2:G${last})`, { align: 'center' });
  g.set('O3', 'Active azi', { color: '#006100' }); g.set('P3', `=COUNTIF(M2:M${last};"Activă")`, { align: 'center', color: '#006100' });
  g.set('O4', 'Viitoare'); g.set('P4', `=COUNTIF(M2:M${last};"Viitoare")`, { align: 'center' });
  g.set('O5', 'Încheiate'); g.set('P5', `=COUNTIF(M2:M${last};"Încheiată")`, { align: 'center' });
  g.set('O6', 'Sub cost', { color: '#9c0006' }); g.set('P6', `=COUNTIF(M2:M${last};"Sub cost")`, { align: 'center', color: '#9c0006' });
  g.set('O7', 'Reducerea medie'); g.set('P7', `=IF(COUNT(G2:G${last})=0;"";SUMIF(A2:A${last};">0";F2:F${last})/COUNT(G2:G${last})/100)`, PCT);
  g.set('O8', 'Încasat în promoție'); g.set('P8', `=L${tot}`, LEI);
  g.box('O1:P8', 'all');
  g.set('O10', 'Prețul promoțional e cel de pe eticheta de promoție; marja se calculează din el fără TVA, față de prețul de achiziție.', { i: true, color: '#666666' });
  g.set('O11', 'Un produs sub cost se vinde în pierdere: e în regulă doar la lichidări, cu acordul administratorului.', { i: true, color: '#666666' });
  g.set('O12', 'Prețul de achiziție și prețul normal le poți lua din Sheets → Calculul prețului de vânzare; la sfârșitul promoției prețurile revin pe etichete și în casa de marcat.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 220, C: 110, D: 110, E: 170, F: 110, G: 200, H: 100, I: 190, J: 150, K: 120, L: 160, M: 120, N: 30, O: 230, P: 130 });
  return doc('Promoții și reduceri', g.sheet('Promoții'));
}

// Rapoartele Z: vânzările zilei pe cote de TVA din raportul Z, plățile cu numerar și card, numerarul predat; diferențele ies colorate.
function rapoarteZ(): SheetDoc {
  const g = new Grid();
  const last = 32, tot = last + 1;
  g.head(1, ['Nr.', 'Data', 'Nr. raportului Z', 'Vânzări cota 21% (cu TVA)', 'Vânzări cota 11% (cu TVA)', 'Vânzări fără TVA (0%)', 'Total vânzări', 'TVA 21%', 'TVA 11%', 'Încasat numerar', 'Încasat card', 'Diferența la plăți', 'Numerar predat', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(B${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(B${r}="";"";N(D${r})+N(E${r})+N(F${r}))`, { ...LEI, b: true });
    g.set(`H${r}`, `=IF(B${r}="";"";ROUND(N(D${r})*21/121;2))`, LEI);
    g.set(`I${r}`, `=IF(B${r}="";"";ROUND(N(E${r})*11/111;2))`, LEI);
    g.set(`L${r}`, `=IF(B${r}="";"";ROUND(G${r}-N(J${r})-N(K${r});2))`, LEI);
    g.set(`N${r}`, `=IF(B${r}="";"";IF(L${r}<>0;"Diferență la plăți";IF(AND(M${r}="";N(J${r})>0);"Numerar nepredat";IF(ROUND(N(M${r})-N(J${r});2)<>0;"Predat altă sumă";"În regulă"))))`, { align: 'center' });
  }
  g.col('B', 2, last, DATE);
  g.col('C', 2, last, { align: 'center' });
  for (const c of 'DEFJKM') g.col(c, 2, last, LEI);
  g.set(`B${tot}`, 'Total', TOTAL);
  for (const c of 'DEFGHIJKLM') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:N${tot}`, 'all');
  g.rules.push(
    { range: `N2:N${last}`, op: 'eq', v1: 'În regulă', look: 'green' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Numerar nepredat', look: 'yellow' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Diferență la plăți', look: 'red' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Predat altă sumă', look: 'red' },
  );
  g.set('P1', 'Pe scurt', HEAD); g.set('Q1', '', HEAD);
  g.set('P2', 'Zile cu raport Z'); g.set('Q2', `=COUNT(G2:G${last})`, { align: 'center' });
  g.set('P3', 'Total vânzări'); g.set('Q3', `=G${tot}`, LEI);
  g.set('P4', 'TVA colectat'); g.set('Q4', `=H${tot}+I${tot}`, LEI);
  g.set('P5', 'Încasat numerar'); g.set('Q5', `=J${tot}`, LEI);
  g.set('P6', 'Încasat card'); g.set('Q6', `=K${tot}`, LEI);
  g.set('P7', 'Zile cu diferențe', { color: '#9c0006' }); g.set('Q7', `=COUNTIF(N2:N${last};"Diferență la plăți")+COUNTIF(N2:N${last};"Predat altă sumă")`, { align: 'center', color: '#9c0006' });
  g.set('P8', 'Numerar nepredat', { color: '#9c5700' }); g.set('Q8', `=COUNTIF(N2:N${last};"Numerar nepredat")`, { align: 'center', color: '#9c5700' });
  g.box('P1:Q8', 'all');
  g.set('P10', 'Sumele le iei din raportul Z scos la închiderea zilei: totalul pe fiecare cotă de TVA și plățile cu numerar și card.', { i: true, color: '#666666' });
  g.set('P11', 'Diferența la plăți trebuie să fie 0: vânzările zilei sunt egale cu numerarul plus cardul. Dacă primești și tichete sau vouchere, trece-le la card sau adaugă o coloană.', { i: true, color: '#666666' });
  g.set('P12', 'Numerarul predat în casierie se trece și în Sheets → Registru de casă; cel depus la bancă apare în extrasul de cont.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 110, C: 140, D: 190, E: 190, F: 170, G: 140, H: 110, I: 110, J: 140, K: 130, L: 150, M: 140, N: 160, O: 30, P: 200, Q: 130 });
  return doc('Rapoartele Z ale casei de marcat', g.sheet('Rapoarte Z'));
}

// Avansuri de trezorerie: banii dați angajaților din casierie, justificați cu documente în termen; restul de restituit sau de plătit iese singur.
function avansuri(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  g.head(1, ['Nr.', 'Data acordării', 'Angajatul', 'Scopul', 'Suma acordată', 'Termenul de justificare', 'Data decontului', 'Cheltuieli justificate', 'Restituit în casierie', 'De restituit de angajat', 'De plătit angajatului', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(OR(C${r}="";E${r}="");"";ROW()-1)`, { align: 'center' });
    g.set(`J${r}`, `=IF(OR(C${r}="";E${r}="");"";MAX(0;ROUND(N(E${r})-N(H${r})-N(I${r});2)))`, { ...LEI, b: true });
    g.set(`K${r}`, `=IF(OR(C${r}="";E${r}="");"";MAX(0;ROUND(N(H${r})-N(E${r});2)))`, LEI);
    g.set(`L${r}`, `=IF(OR(C${r}="";E${r}="");"";IF(K${r}>0;"De plătit angajatului";IF(J${r}=0;"Decontat";IF(AND(F${r}<>"";TODAY()>F${r});"Termen depășit";IF(G${r}<>"";"Rest de restituit";"În termen")))))`, { align: 'center' });
  }
  for (const c of 'BFG') g.col(c, 2, last, DATE);
  for (const c of 'EHI') g.col(c, 2, last, LEI);
  g.lists.push({ range: `D2:D${last}`, values: ['Deplasare', 'Achiziție de materiale', 'Plăți mărunte', 'Combustibil', 'Altele'] });
  g.set(`C${tot}`, 'Total', TOTAL);
  for (const c of 'EHIJK') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:L${tot}`, 'all');
  g.rules.push(
    { range: `L2:L${last}`, op: 'eq', v1: 'Decontat', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'În termen', look: 'blue' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Rest de restituit', look: 'yellow' },
    { range: `L2:L${last}`, op: 'eq', v1: 'De plătit angajatului', look: 'yellow' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Termen depășit', look: 'red' },
  );
  g.set('N1', 'Pe scurt', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Avansuri acordate'); g.set('O2', `=COUNT(J2:J${last})`, { align: 'center' });
  g.set('N3', 'Total acordat'); g.set('O3', `=E${tot}`, LEI);
  g.set('N4', 'Justificat cu documente'); g.set('O4', `=H${tot}`, LEI);
  g.set('N5', 'De restituit de angajați'); g.set('O5', `=J${tot}`, LEI);
  g.set('N6', 'De plătit angajaților'); g.set('O6', `=K${tot}`, LEI);
  g.set('N7', 'Cu termen depășit', { color: '#9c0006' }); g.set('O7', `=COUNTIF(L2:L${last};"Termen depășit")`, { align: 'center', color: '#9c0006' });
  g.set('N8', 'Nedecontate încă'); g.set('O8', `=COUNTIF(L2:L${last};"În termen")+COUNTIF(L2:L${last};"Termen depășit")+COUNTIF(L2:L${last};"Rest de restituit")`, { align: 'center' });
  g.box('N1:O8', 'all');
  g.set('N10', 'Un angajat ales', HEAD); g.set('O10', '', HEAD);
  g.set('N11', 'Angajatul'); g.set('O11', '', { bg: '#fff2cc' });
  g.set('N12', 'Are de restituit'); g.set('O12', `=IF(O11="";"";SUMIF(C2:C${last};O11;J2:J${last}))`, LEI);
  g.set('N13', 'Are de primit'); g.set('O13', `=IF(O11="";"";SUMIF(C2:C${last};O11;K2:K${last}))`, LEI);
  g.box('N10:O13', 'all');
  g.set('N15', 'Avansul se justifică în cel mult 3 zile lucrătoare de la întoarcerea din deplasare sau de la termenul stabilit, cu documentele cheltuielilor (Sheets → Decont de deplasare).', { i: true, color: '#666666' });
  g.set('N16', 'Un angajat nu primește un avans nou până nu l-a justificat pe cel vechi; suma nejustificată la termen se poate reține, cu acordul lui, sau se recuperează pe calea legii.', { i: true, color: '#666666' });
  g.set('N17', 'Avansul dat și suma restituită trec și în Sheets → Registru de casă, cu dispoziția de plată sau de încasare.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 120, C: 200, D: 180, E: 140, F: 170, G: 140, H: 170, I: 160, J: 180, K: 170, L: 170, M: 30, N: 220, O: 140 });
  return doc('Avansuri de trezorerie', g.sheet('Avansuri'));
}

// 04.11: biletele la ordin și cecurile primite de la clienți sau date furnizorilor, cu scadența și starea.
function efecte(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  g.head(1, ['Nr.', 'Tipul', 'Sensul', 'Partenerul', 'Seria și numărul', 'Data emiterii', 'Scadența', 'Suma', 'Banca', 'Depus la bancă', 'Încasat sau plătit', 'Refuzat la plată', 'Rest', 'Zile până la scadență', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(OR(D${r}="";H${r}="");"";ROW()-1)`, { align: 'center' });
    g.set(`M${r}`, `=IF(OR(D${r}="";H${r}="");"";MAX(0;ROUND(N(H${r})-N(K${r});2)))`, { ...LEI, b: true });
    g.set(`N${r}`, `=IF(OR(D${r}="";H${r}="";G${r}="";L${r}="Da");"";IF(M${r}=0;"";G${r}-TODAY()))`, { align: 'center' });
    g.set(`O${r}`, `=IF(OR(D${r}="";H${r}="");"";IF(L${r}="Da";"Refuzat la plată";IF(M${r}=0;IF(C${r}="Emis către furnizor";"Plătit";"Încasat");IF(AND(G${r}<>"";TODAY()>G${r});"Scadență depășită";IF(AND(G${r}<>"";G${r}-TODAY()<=7);"Scadent în 7 zile";IF(C${r}="Emis către furnizor";"De plătit";"În portofoliu"))))))`, { align: 'center' });
  }
  for (const c of 'FGJ') g.col(c, 2, last, DATE);
  for (const c of 'HK') g.col(c, 2, last, LEI);
  g.lists.push(
    { range: `B2:B${last}`, values: ['Bilet la ordin', 'Cec'] },
    { range: `C2:C${last}`, values: ['Primit de la client', 'Emis către furnizor'] },
    { range: `L2:L${last}`, values: ['Da', 'Nu'] },
  );
  g.set(`D${tot}`, 'Total', TOTAL);
  for (const c of 'HKM') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:O${tot}`, 'all');
  g.rules.push(
    { range: `O2:O${last}`, op: 'eq', v1: 'Încasat', look: 'green' },
    { range: `O2:O${last}`, op: 'eq', v1: 'Plătit', look: 'green' },
    { range: `O2:O${last}`, op: 'eq', v1: 'În portofoliu', look: 'blue' },
    { range: `O2:O${last}`, op: 'eq', v1: 'De plătit', look: 'blue' },
    { range: `O2:O${last}`, op: 'eq', v1: 'Scadent în 7 zile', look: 'yellow' },
    { range: `O2:O${last}`, op: 'eq', v1: 'Scadență depășită', look: 'red' },
    { range: `O2:O${last}`, op: 'eq', v1: 'Refuzat la plată', look: 'red' },
  );
  g.set('Q1', 'Pe scurt', HEAD); g.set('R1', '', HEAD);
  g.set('Q2', 'Bilete și cecuri trecute'); g.set('R2', `=COUNT(M2:M${last})`, { align: 'center' });
  g.set('Q3', 'De încasat de la clienți'); g.set('R3', `=ROUND(M${tot}-SUMIF(C2:C${last};"Emis către furnizor";M2:M${last});2)`, LEI);
  g.set('Q4', 'De plătit furnizorilor'); g.set('R4', `=SUMIF(C2:C${last};"Emis către furnizor";M2:M${last})`, LEI);
  g.set('Q5', 'Scadente în 7 zile'); g.set('R5', `=COUNTIF(O2:O${last};"Scadent în 7 zile")`, { align: 'center' });
  g.set('Q6', 'Cu scadența depășită', { color: '#9c0006' }); g.set('R6', `=COUNTIF(O2:O${last};"Scadență depășită")`, { align: 'center', color: '#9c0006' });
  g.set('Q7', 'Refuzate la plată', { color: '#9c0006' }); g.set('R7', `=COUNTIF(O2:O${last};"Refuzat la plată")`, { align: 'center', color: '#9c0006' });
  g.set('Q8', 'Suma refuzată', { color: '#9c0006' }); g.set('R8', `=SUMIF(L2:L${last};"Da";M2:M${last})`, { ...LEI, color: '#9c0006' });
  g.box('Q1:R8', 'all');
  g.set('Q10', 'Un partener ales', HEAD); g.set('R10', '', HEAD);
  g.set('Q11', 'Partenerul'); g.set('R11', '', { bg: '#fff2cc' });
  g.set('Q12', 'Rest pe bilete și cecuri'); g.set('R12', `=IF(R11="";"";SUMIF(D2:D${last};R11;M2:M${last}))`, LEI);
  g.set('Q13', 'Refuzate la plată'); g.set('R13', `=IF(R11="";"";COUNTIFS(D2:D${last};R11;L2:L${last};"Da"))`, { align: 'center' });
  g.box('Q10:R13', 'all');
  g.set('Q15', 'Cecul se prezintă la bancă în cel mult 8 zile de la data emiterii: la cecuri, scrie la „Scadența” data emiterii plus 8 zile.', { i: true, color: '#666666' });
  g.set('Q16', 'Biletul la ordin se prezintă la plată în ziua scadenței sau în următoarele 2 zile lucrătoare; depus mai târziu, îți pierzi o parte din drepturi față de giranți.', { i: true, color: '#666666' });
  g.set('Q17', 'Un bilet la ordin sau un cec refuzat din lipsă de disponibil e titlu executoriu: banii se pot cere prin executorul judecătoresc, fără proces; păstrează originalul și refuzul băncii.', { i: true, color: '#666666' });
  g.set('Q18', 'Încasarea trece și în Sheets → Evidență facturi emise (sau Facturi de la furnizori, la plată), la factura pentru care s-a dat biletul.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 130, C: 170, D: 200, E: 140, F: 120, G: 120, H: 130, I: 150, J: 130, K: 150, L: 130, M: 130, N: 170, O: 160, P: 30, Q: 230, R: 140 });
  return doc('Bilete la ordin și cecuri', g.sheet('Bilete și cecuri'));
}

// 04.11: tichetele de masă pe o lună: cele cuvenite din zilele lucrate efectiv, cele date și diferența de regularizat.
function tichete(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  g.head(1, ['Nr.', 'Angajatul', 'Zile lucrătoare în lună', 'Concediu de odihnă', 'Concediu medical', 'Delegații și alte absențe', 'Zile lucrate', 'Tichete cuvenite', 'Tichete date', 'Diferența', 'Valoarea cuvenită', 'Valoarea dată', 'Starea']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(OR(B${r}="";C${r}="");"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(B${r}="";C${r}="");"";MAX(0;N(C${r})-N(D${r})-N(E${r})-N(F${r})))`, { align: 'center' });
    g.set(`H${r}`, `=IF(G${r}="";"";G${r})`, { align: 'center', b: true });
    g.set(`J${r}`, `=IF(OR(H${r}="";I${r}="");"";H${r}-I${r})`, { align: 'center' });
    g.set(`K${r}`, `=IF(H${r}="";"";ROUND(H${r}*N($P$3);2))`, LEI);
    g.set(`L${r}`, `=IF(OR(H${r}="";I${r}="");"";ROUND(N(I${r})*N($P$3);2))`, LEI);
    g.set(`M${r}`, `=IF(H${r}="";"";IF(I${r}="";IF(H${r}=0;"În regulă";"De dat");IF(J${r}=0;"În regulă";IF(J${r}>0;"De dat în plus";"Date în plus"))))`, { align: 'center' });
  }
  for (const c of 'CDEFI') g.col(c, 2, last, { align: 'center' });
  g.set(`B${tot}`, 'Total', TOTAL);
  for (const c of 'GHI') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { align: 'center', ...TOTAL });
  for (const c of 'KL') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:M${tot}`, 'all');
  g.rules.push(
    { range: `M2:M${last}`, op: 'eq', v1: 'În regulă', look: 'green' },
    { range: `M2:M${last}`, op: 'eq', v1: 'De dat', look: 'blue' },
    { range: `M2:M${last}`, op: 'eq', v1: 'De dat în plus', look: 'yellow' },
    { range: `M2:M${last}`, op: 'eq', v1: 'Date în plus', look: 'red' },
  );
  g.set('O1', 'Luna', HEAD); g.set('P1', '', HEAD);
  g.set('O2', 'Luna și anul'); g.set('P2', '', { bg: '#fff2cc' });
  g.set('O3', 'Valoarea unui tichet'); g.set('P3', '40', { ...LEI, bg: '#fff2cc' });
  g.box('O1:P3', 'all');
  g.set('O5', 'Pe scurt', HEAD); g.set('P5', '', HEAD);
  g.set('O6', 'Angajați'); g.set('P6', `=COUNT(G2:G${last})`, { align: 'center' });
  g.set('O7', 'Tichete cuvenite'); g.set('P7', `=H${tot}`, { align: 'center' });
  g.set('O8', 'Tichete date'); g.set('P8', `=I${tot}`, { align: 'center' });
  g.set('O9', 'Valoarea tichetelor cuvenite'); g.set('P9', `=K${tot}`, LEI);
  g.set('O10', 'De dat în plus luna viitoare'); g.set('P10', `=SUMIF(J2:J${last};">0")`, { align: 'center' });
  g.set('O11', 'Date în plus, de scăzut', { color: '#9c0006' }); g.set('P11', `=-SUMIF(J2:J${last};"<0")`, { align: 'center', color: '#9c0006' });
  g.set('O12', 'Angajați cu diferențe'); g.set('P12', `=COUNTIF(M2:M${last};"De dat în plus")+COUNTIF(M2:M${last};"Date în plus")`, { align: 'center' });
  g.box('O5:P12', 'all');
  g.set('O14', 'Tichetele se dau doar pentru zilele lucrate efectiv: nu pentru concediul de odihnă, concediul medical sau zilele de delegație în care angajatul primește diurnă.', { i: true, color: '#666666' });
  g.set('O15', 'Valoarea maximă a unui tichet o stabilește legea și se schimbă: verifică valoarea de anul acesta înainte să o scrii în celula galbenă.', { i: true, color: '#666666' });
  g.set('O16', 'Tichetele date în plus se scad din cele de luna viitoare, iar cele date în minus se adaugă; zilele de concediu le iei din Sheets → Evidență concedii sau din Pontaj lunar.', { i: true, color: '#666666' });
  g.set('O17', 'CASS și impozitul pe tichete se rețin în statul de plată, împreună cu salariul (Sheets → Stat de plată).', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 200, C: 150, D: 140, E: 130, F: 170, G: 110, H: 130, I: 110, J: 100, K: 140, L: 130, M: 140, N: 30, O: 230, P: 140 });
  return doc('Tichete de masă', g.sheet('Tichete'));
}

// 04.11: cheltuielile de protocol, cu limita deductibilă de 2% din diferența dintre venituri și cheltuieli (fără impozitul pe profit și protocol).
function protocol(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  const kinds = ['Masă de afaceri', 'Cadouri pentru parteneri', 'Băuturi și gustări la întâlniri', 'Altele'];
  g.head(1, ['Nr.', 'Data', 'Documentul', 'Furnizorul', 'Felul cheltuielii', 'Ocazia sau partenerul', 'Valoarea fără TVA', 'TVA', 'Total']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(G${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(G${r}="";"";ROUND(N(G${r})+N(H${r});2))`, { ...LEI, b: true });
  }
  g.col('B', 2, last, DATE);
  for (const c of 'GH') g.col(c, 2, last, LEI);
  g.lists.push({ range: `E2:E${last}`, values: kinds });
  g.set(`F${tot}`, 'Total', TOTAL);
  for (const c of 'GHI') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:I${tot}`, 'all');
  g.set('K1', 'Limita deductibilă', HEAD); g.set('L1', '', HEAD);
  g.set('K2', 'Venituri impozabile (de la începutul anului)'); g.set('L2', '', { ...LEI, bg: '#fff2cc' });
  g.set('K3', 'Cheltuieli totale (de la începutul anului)'); g.set('L3', '', { ...LEI, bg: '#fff2cc' });
  g.set('K4', 'Din care impozitul pe profit'); g.set('L4', '', { ...LEI, bg: '#fff2cc' });
  g.set('K5', 'Cheltuieli de protocol (din tabel)'); g.set('L5', `=G${tot}`, LEI);
  g.set('K6', 'Baza de calcul'); g.set('L6', `=IF(L2="";"";ROUND(N(L2)-(N(L3)-N(L4)-L5);2))`, LEI);
  g.set('K7', 'Limita (2%)'); g.set('L7', `=IF(L6="";"";ROUND(MAX(0;L6)*0.02;2))`, { ...LEI, b: true });
  g.set('K8', 'Deductibil'); g.set('L8', `=IF(L7="";"";MIN(L5;L7))`, LEI);
  g.set('K9', 'Nedeductibil', { color: '#9c0006' }); g.set('L9', `=IF(L7="";"";ROUND(MAX(0;L5-L7);2))`, { ...LEI, color: '#9c0006' });
  g.set('K10', 'Starea'); g.set('L10', `=IF(L7="";"";IF(L5<=L7;"În limită";"Peste limită"))`, { align: 'center' });
  g.box('K1:L10', 'all');
  g.rules.push(
    { range: 'L10', op: 'eq', v1: 'În limită', look: 'green' },
    { range: 'L10', op: 'eq', v1: 'Peste limită', look: 'red' },
  );
  g.set('K12', 'Pe feluri (fără TVA)', HEAD); g.set('L12', '', HEAD);
  kinds.forEach((k, i) => { g.set(`K${13 + i}`, k); g.set(`L${13 + i}`, `=SUMIF(E2:E${last};"${k}";G2:G${last})`, LEI); });
  g.set('K17', 'Cheltuieli trecute'); g.set('L17', `=COUNT(I2:I${last})`, { align: 'center' });
  g.box('K12:L17', 'all');
  g.set('K19', 'Cheltuielile de protocol se scad din profit doar până la 2% din diferența dintre veniturile impozabile și cheltuielile lor, fără impozitul pe profit și fără protocolul însuși; restul e nedeductibil.', { i: true, color: '#666666' });
  g.set('K20', 'Limita contează doar la impozitul pe profit; verificați calculul și TVA-ul cheltuielilor de protocol cu contabilul.', { i: true, color: '#666666' });
  g.set('K21', 'Pe fiecare factură sau bon păstrați scopul: cu ce partener, la ce întâlnire sau ocazie; cadourile de valoare mică pentru parteneri se trec tot aici.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 110, C: 160, D: 200, E: 220, F: 220, G: 150, H: 110, I: 130, J: 30, K: 300, L: 150 });
  return doc('Cheltuieli de protocol', g.sheet('Protocol'));
}

// 04.11: facturile în valută: cursul la factură și la plată, diferența de curs ca venit sau cheltuială, după felul facturii.
function valuta(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  const CURS: CellStyle = { fmt: 'number', dec: 4, align: 'center' };
  g.head(1, ['Nr.', 'Data facturii', 'Factura', 'Partenerul', 'Felul', 'Moneda', 'Valoarea în valută', 'Cursul la factură', 'Valoarea în lei la factură', 'Data plății', 'Cursul la plată', 'Valoarea în lei la plată', 'Diferența de curs', 'Starea', 'Efectul (+ venit, − cheltuială)']);
  for (let r = 2; r <= last; r++) {
    g.set(`A${r}`, `=IF(G${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(OR(G${r}="";H${r}="");"";ROUND(N(G${r})*N(H${r});2))`, LEI);
    g.set(`L${r}`, `=IF(OR(I${r}="";K${r}="");"";ROUND(N(G${r})*N(K${r});2))`, LEI);
    g.set(`M${r}`, `=IF(L${r}="";"";ROUND(L${r}-I${r};2))`, LEI);
    g.set(`N${r}`, `=IF(I${r}="";"";IF(L${r}="";"Deschisă";IF(M${r}=0;"Fără diferență";IF(OR(AND(E${r}="Emisă către client";M${r}>0);AND(E${r}="Primită de la furnizor";M${r}<0));"Venit din curs";"Cheltuială din curs"))))`, { align: 'center' });
    g.set(`O${r}`, `=IF(N${r}="Venit din curs";ABS(M${r});IF(N${r}="Cheltuială din curs";-ABS(M${r});""))`, { ...LEI, b: true });
  }
  for (const c of 'BJ') g.col(c, 2, last, DATE);
  g.col('G', 2, last, { fmt: 'number', dec: 2 });
  for (const c of 'HK') g.col(c, 2, last, CURS);
  g.lists.push(
    { range: `E2:E${last}`, values: ['Emisă către client', 'Primită de la furnizor'] },
    { range: `F2:F${last}`, values: ['EUR', 'USD', 'GBP', 'CHF', 'HUF', 'MDL'] },
  );
  g.rules.push(
    { range: `N2:N${last}`, op: 'eq', v1: 'Venit din curs', look: 'green' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Cheltuială din curs', look: 'red' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Deschisă', look: 'yellow' },
  );
  g.set(`H${tot}`, 'Total', TOTAL);
  for (const c of 'ILO') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:O${tot}`, 'all');
  g.set('Q1', 'Pe scurt', HEAD); g.set('R1', '', HEAD);
  g.set('Q2', 'Facturi trecute'); g.set('R2', `=COUNT(I2:I${last})`, { align: 'center' });
  g.set('Q3', 'Facturi deschise (neîncasate sau neplătite)', { color: '#9c5700' }); g.set('R3', `=COUNTIF(N2:N${last};"Deschisă")`, { align: 'center', color: '#9c5700' });
  g.set('Q4', 'Valoarea deschisă, în lei la cursul facturii'); g.set('R4', `=SUMIF(N2:N${last};"Deschisă";I2:I${last})`, LEI);
  g.set('Q5', 'Venituri din diferențe de curs', { color: '#006100' }); g.set('R5', `=SUMIF(O2:O${last};">0")`, { ...LEI, color: '#006100' });
  g.set('Q6', 'Cheltuieli din diferențe de curs', { color: '#9c0006' }); g.set('R6', `=ABS(SUMIF(O2:O${last};"<0"))`, { ...LEI, color: '#9c0006' });
  g.set('Q7', 'Rezultatul net'); g.set('R7', '=ROUND(R5-R6;2)', { ...LEI, b: true });
  g.box('Q1:R7', 'all');
  g.set('Q9', 'Cursul îl iei de pe site-ul BNR, din ziua facturii și din ziua plății; dacă se plătește în mai multe tranșe, trece fiecare tranșă pe un rând.', { i: true, color: '#666666' });
  g.set('Q10', 'La o factură emisă, un curs mai mare la încasare e venit; la o factură primită, un curs mai mare la plată e cheltuială.', { i: true, color: '#666666' });
  g.set('Q11', 'Facturile deschise se reevaluează la sfârșitul lunii la cursul BNR; ce curs se folosește pentru TVA și reevaluare verificați cu contabilul.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 110, C: 130, D: 200, E: 180, F: 80, G: 140, H: 120, I: 160, J: 110, K: 120, L: 160, M: 140, N: 150, O: 170, P: 30, Q: 300, R: 150 });
  return doc('Facturi în valută și diferențe de curs', g.sheet('Valută'));
}

// 04.11: cheltuielile cu mașinile firmei: la folosința mixtă se deduce 50% din TVA și 50% din cheltuială (cu TVA-ul nededus), la cea exclusiv pentru firmă 100%.
function cheltauto(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  const kinds = ['Carburant', 'Reparații și piese', 'Asigurări', 'Taxe și rovinietă', 'Spălătorie și parcare', 'Altele'];
  g.head(1, ['Nr.', 'Data', 'Documentul', 'Mașina (nr. de înmatriculare)', 'Felul cheltuielii', 'Folosința', 'Valoarea fără TVA', 'TVA', 'Total', 'TVA deductibil', 'TVA nedeductibil', 'Cheltuiala (cu TVA nededus)', 'Cheltuială deductibilă', 'Cheltuială nedeductibilă']);
  for (let r = 2; r <= last; r++) {
    const p = `IF(F${r}="Exclusiv pentru firmă";1;0.5)`;
    g.set(`A${r}`, `=IF(G${r}="";"";ROW()-1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(G${r}="";"";ROUND(N(G${r})+N(H${r});2))`, { ...LEI, b: true });
    g.set(`J${r}`, `=IF(G${r}="";"";ROUND(N(H${r})*${p};2))`, LEI);
    g.set(`K${r}`, `=IF(G${r}="";"";ROUND(N(H${r})-J${r};2))`, LEI);
    g.set(`L${r}`, `=IF(G${r}="";"";ROUND(N(G${r})+K${r};2))`, LEI);
    g.set(`M${r}`, `=IF(G${r}="";"";ROUND(L${r}*${p};2))`, LEI);
    g.set(`N${r}`, `=IF(G${r}="";"";ROUND(L${r}-M${r};2))`, { ...LEI, color: '#9c0006' });
  }
  g.col('B', 2, last, DATE);
  for (const c of 'GH') g.col(c, 2, last, LEI);
  g.lists.push(
    { range: `E2:E${last}`, values: kinds },
    { range: `F2:F${last}`, values: ['Mixtă (50%)', 'Exclusiv pentru firmă'] },
  );
  g.set(`F${tot}`, 'Total', TOTAL);
  for (const c of 'GHIJKLMN') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:N${tot}`, 'all');
  g.set('P1', 'Pe scurt', HEAD); g.set('Q1', '', HEAD);
  g.set('P2', 'Documente trecute'); g.set('Q2', `=COUNT(I2:I${last})`, { align: 'center' });
  g.set('P3', 'Total plătit'); g.set('Q3', `=I${tot}`, LEI);
  g.set('P4', 'TVA de dedus', { color: '#006100' }); g.set('Q4', `=J${tot}`, { ...LEI, color: '#006100' });
  g.set('P5', 'TVA nedeductibil', { color: '#9c0006' }); g.set('Q5', `=K${tot}`, { ...LEI, color: '#9c0006' });
  g.set('P6', 'Cheltuieli deductibile', { color: '#006100' }); g.set('Q6', `=M${tot}`, { ...LEI, color: '#006100' });
  g.set('P7', 'Cheltuieli nedeductibile', { color: '#9c0006' }); g.set('Q7', `=N${tot}`, { ...LEI, color: '#9c0006' });
  g.box('P1:Q7', 'all');
  g.set('P9', 'Pe feluri (fără TVA)', HEAD); g.set('Q9', '', HEAD);
  kinds.forEach((k, i) => { g.set(`P${10 + i}`, k); g.set(`Q${10 + i}`, `=SUMIF(E2:E${last};"${k}";G2:G${last})`, LEI); });
  g.box(`P9:Q${9 + kinds.length}`, 'all');
  g.set('P17', 'Folosința goală se socotește mixtă: la o mașină folosită și în scop personal se deduce doar jumătate din TVA, iar cheltuiala (cu TVA-ul nededus) e deductibilă tot pe jumătate.', { i: true, color: '#666666' });
  g.set('P18', 'Exclusiv pentru firmă se alege doar pentru mașinile cu foaie de parcurs pentru fiecare drum (Sheets → Foaie de parcurs) sau pentru cele care intră în excepțiile legii (de exemplu agenți de vânzări, transport, taxi).', { i: true, color: '#666666' });
  g.set('P19', 'Regulile și excepțiile se schimbă: verificați cu contabilul felul în care se trec mașinile firmei.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 110, C: 150, D: 200, E: 190, F: 170, G: 140, H: 110, I: 130, J: 130, K: 140, L: 190, M: 170, N: 180, O: 30, P: 300, Q: 150 });
  return doc('Cheltuieli auto', g.sheet('Auto'));
}

// Concedii medicale: fiecare certificat cu codul indemnizației, perioada și media zilnică a veniturilor; ies zilele lucrătoare,
// procentul (la boala obișnuită după durata concediului), indemnizația și împărțirea ei între angajator (zilele 1–5) și FNUASS.
function concediiMedicale(): SheetDoc {
  const g = new Grid();
  const last = 41, tot = last + 1;
  const codes: [string, number, string][] = [
    ['02 Accident în afara muncii', 0.75, 'Da'],
    ['05 Boală infectocontagioasă (grupa A)', 1, 'Da'],
    ['06 Urgență medico-chirurgicală', 1, 'Da'],
    ['07 Carantină', 0.75, 'Nu'],
    ['08 Sarcină și lăuzie', 0.85, 'Nu'],
    ['09 Îngrijirea copilului bolnav', 0.85, 'Nu'],
    ['10 Reducerea timpului de muncă', 0.25, 'Nu'],
    ['12 Tuberculoză', 1, 'Da'],
    ['13 Boală cardiovasculară', 0.75, 'Da'],
    ['14 Neoplazie, SIDA', 1, 'Da'],
    ['15 Risc maternal', 0.75, 'Nu'],
  ];
  const c0 = 13, c1 = c0 + codes.length - 1;
  const hol: [number, number][] = [[1, 1], [1, 2], [1, 6], [1, 7], [1, 24], [4, 10], [4, 12], [4, 13], [5, 1], [5, 31], [6, 1], [8, 15], [11, 30], [12, 1], [12, 25], [12, 26]];
  const H = `$W$2:$W${1 + hol.length}`;
  g.head(1, ['Nr.', 'Angajatul', 'Seria și nr. certificatului', 'Codul indemnizației', 'Felul certificatului', 'De la', 'Până la', 'Zile calendaristice', 'Zile lucrătoare', 'Media zilnică a veniturilor', 'Procentul', 'Indemnizația', 'Zile de la angajator', 'Suma de la angajator', 'Zile din FNUASS', 'Suma din FNUASS']);
  for (let r = 2; r <= last; r++) {
    const e = `OR(D${r}="";F${r}="";G${r}="")`;
    g.set(`A${r}`, `=IF(${e};"";ROW()-1)`, { align: 'center' });
    g.set(`H${r}`, `=IF(${e};"";G${r}-F${r}+1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(${e};"";NETWORKDAYS(F${r};G${r};${H}))`, { align: 'center', b: true });
    g.set(`K${r}`, `=IF(${e};"";IF(D${r}="01 Boală obișnuită";IF(H${r}<=7;$T$10;IF(H${r}<=14;$T$11;$T$12));VLOOKUP(D${r};$S${c0}:$U${c1};2;0)))`, { ...PCT, align: 'center' });
    g.set(`L${r}`, `=IF(${e};"";ROUND(I${r}*N(J${r})*K${r};0))`, { ...LEI, b: true });
    g.set(`M${r}`, `=IF(${e};"";IF(OR(E${r}="În continuare";IFERROR(VLOOKUP(D${r};$S${c0}:$U${c1};3;0);"Da")="Nu");0;MIN(I${r};NETWORKDAYS(F${r};MIN(G${r};F${r}+4);${H}))))`, { align: 'center' });
    g.set(`N${r}`, `=IF(${e};"";ROUND(M${r}*N(J${r})*K${r};0))`, LEI);
    g.set(`O${r}`, `=IF(${e};"";I${r}-M${r})`, { align: 'center' });
    g.set(`P${r}`, `=IF(${e};"";L${r}-N${r})`, LEI);
  }
  for (const c of 'FG') g.col(c, 2, last, DATE);
  g.col('J', 2, last, LEI);
  g.lists.push(
    { range: `D2:D${last}`, values: ['01 Boală obișnuită', ...codes.map((c) => c[0])] },
    { range: `E2:E${last}`, values: ['Inițial', 'În continuare'] },
  );
  g.rules.push({ range: `H2:H${last}`, op: 'lt', v1: '1', look: 'red' });
  g.set(`H${tot}`, 'Total', TOTAL);
  for (const c of 'ILMNOP') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, c === 'I' || c === 'M' || c === 'O' ? { ...TOTAL, align: 'center' } : { ...LEI, ...TOTAL });
  g.box(`A1:P${tot}`, 'all');
  g.set('S1', 'Pe scurt', HEAD); g.set('T1', '', HEAD);
  g.set('S2', 'Certificate trecute'); g.set('T2', `=COUNT(I2:I${last})`, { align: 'center' });
  g.set('S3', 'Zile lucrătoare de concediu'); g.set('T3', `=I${tot}`, { align: 'center' });
  g.set('S4', 'Indemnizații în total'); g.set('T4', `=L${tot}`, { ...LEI, b: true });
  g.set('S5', 'Plătite de angajator'); g.set('T5', `=N${tot}`, LEI);
  g.set('S6', 'Din FNUASS (se recuperează)', { color: '#006100' }); g.set('T6', `=P${tot}`, { ...LEI, color: '#006100' });
  g.box('S1:T6', 'all');
  g.set('S9', 'Codul indemnizației', HEAD); g.set('T9', 'Procentul', HEAD); g.set('U9', 'Angajatorul plătește zilele 1–5', HEAD);
  g.set('S10', '01 Boală obișnuită, până la 7 zile'); g.set('T10', '0.55', { ...PCT, bg: '#fff59d' }); g.set('U10', 'Da', { align: 'center' });
  g.set('S11', '01 Boală obișnuită, 8–14 zile'); g.set('T11', '0.65', { ...PCT, bg: '#fff59d' }); g.set('U11', 'Da', { align: 'center' });
  g.set('S12', '01 Boală obișnuită, de la 15 zile'); g.set('T12', '0.75', { ...PCT, bg: '#fff59d' }); g.set('U12', 'Da', { align: 'center' });
  codes.forEach(([n, p, a], i) => {
    g.set(`S${c0 + i}`, n); g.set(`T${c0 + i}`, String(p), { ...PCT, bg: '#fff59d' }); g.set(`U${c0 + i}`, a, { align: 'center' });
  });
  g.box(`S9:U${c1}`, 'all');
  const n0 = c1 + 2;
  g.set(`S${n0}`, 'Media zilnică: veniturile brute din ultimele 6 luni (cel mult 12 salarii minime pe lună) împărțite la zilele lucrătoare din acele luni.', { i: true, color: '#666666' });
  g.set(`S${n0 + 1}`, 'Angajatorul plătește primele 5 zile calendaristice (din care se numără doar cele lucrătoare); restul se recuperează din FNUASS. La certificatele „În continuare” și la codurile cu „Nu” plătește totul FNUASS.', { i: true, color: '#666666' });
  g.set(`S${n0 + 2}`, 'La boala obișnuită procentul se ia după zilele calendaristice ale certificatului; la un certificat în continuare se poate scrie direct procentul după durata totală. Procentele (în galben) se schimbă prin lege: verificați-le cu contabilul.', { i: true, color: '#666666' });
  g.set('W1', 'Sărbători legale 2026', HEAD);
  hol.forEach(([m, d], i) => g.set(`W${2 + i}`, `=DATE(2026;${m};${d})`, DATE));
  g.set(`W${3 + hol.length}`, 'Schimbă lista în fiecare an.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 190, C: 170, D: 250, E: 150, F: 100, G: 100, H: 110, I: 110, J: 150, K: 90, L: 120, M: 130, N: 150, O: 120, P: 140, Q: 30, R: 10, S: 300, T: 110, U: 200, V: 30, W: 170 });
  return doc('Concedii medicale', g.sheet('Concedii medicale'));
}

// Ore suplimentare: fiecare zi cu ore peste program, compensată cu timp liber (în termenul legal) sau plătită cu spor;
// ies termenul, orele rămase de compensat, suma de plată și starea, cu totalurile și orele unui angajat ales în dreapta.
function oreSuplimentare(): SheetDoc {
  const g = new Grid();
  const last = 61, tot = last + 1;
  const IN: CellStyle = { bg: '#fff59d' };
  g.head(1, ['Nr.', 'Angajatul', 'Data', 'Ore suplimentare', 'Felul compensării', 'Ore compensate cu timp liber', 'Termenul de compensare', 'Ore rămase de compensat', 'Salariul orar brut', 'Suma de plată', 'Starea']);
  for (let r = 2; r <= last; r++) {
    const e = `OR(C${r}="";D${r}="")`;
    const paid = `E${r}="Plătite cu spor"`;
    g.set(`A${r}`, `=IF(${e};"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(OR(${e};${paid});"";C${r}+$O$3)`, DATE);
    g.set(`H${r}`, `=IF(${e};"";IF(${paid};0;MAX(0;N(D${r})-N(F${r}))))`, { align: 'center', b: true });
    g.set(`J${r}`, `=IF(${e};"";IF(${paid};ROUND(N(D${r})*N(I${r})*(1+$O$2);2);IF(AND(H${r}>0;TODAY()>G${r});ROUND(H${r}*N(I${r})*(1+$O$2);2);0)))`, LEI);
    g.set(`K${r}`, `=IF(${e};"";IF(${paid};"Plătite cu spor";IF(H${r}=0;"Compensate";IF(TODAY()>G${r};"Termen depășit";"De compensat"))))`, { align: 'center' });
  }
  g.col('C', 2, last, DATE);
  g.col('I', 2, last, LEI);
  g.lists.push({ range: `E2:E${last}`, values: ['Timp liber', 'Plătite cu spor'] });
  g.rules.push(
    { range: `K2:K${last}`, op: 'eq', v1: 'Compensate', look: 'green' },
    { range: `K2:K${last}`, op: 'eq', v1: 'De compensat', look: 'yellow' },
    { range: `K2:K${last}`, op: 'eq', v1: 'Termen depășit', look: 'red' },
  );
  g.set(`C${tot}`, 'Total', TOTAL);
  for (const c of 'DFH') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...TOTAL, align: 'center' });
  g.set(`J${tot}`, `=SUM(J2:J${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:K${tot}`, 'all');
  g.set('N1', 'Reguli', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'Sporul pentru orele plătite'); g.set('O2', '0.75', { ...PCT, ...IN });
  g.set('N3', 'Termenul de compensare (zile)'); g.set('O3', '60', { ...IN, align: 'center' });
  g.box('N1:O3', 'all');
  g.set('N5', 'Pe scurt', HEAD); g.set('O5', '', HEAD);
  g.set('N6', 'Ore suplimentare în total'); g.set('O6', `=D${tot}`, { align: 'center' });
  g.set('N7', 'Ore compensate cu timp liber', { color: '#006100' }); g.set('O7', `=F${tot}`, { align: 'center', color: '#006100' });
  g.set('N8', 'Ore de compensat încă'); g.set('O8', `=SUMIF(K2:K${last};"De compensat";H2:H${last})`, { align: 'center' });
  g.set('N9', 'Ore cu termenul depășit', { color: '#9c0006' }); g.set('O9', `=SUMIF(K2:K${last};"Termen depășit";H2:H${last})`, { align: 'center', color: '#9c0006' });
  g.set('N10', 'Suma de plată (brut)'); g.set('O10', `=J${tot}`, { ...LEI, b: true });
  g.box('N5:O10', 'all');
  g.set('N12', 'Un angajat', HEAD); g.set('O12', '', HEAD);
  g.set('N13', 'Angajatul'); g.set('O13', '', IN);
  g.set('N14', 'Ore suplimentare'); g.set('O14', `=IF(O13="";"";SUMIF(B2:B${last};O13;D2:D${last}))`, { align: 'center' });
  g.set('N15', 'Ore rămase de compensat'); g.set('O15', `=IF(O13="";"";SUMIF(B2:B${last};O13;H2:H${last}))`, { align: 'center' });
  g.set('N16', 'Suma de plată'); g.set('O16', `=IF(O13="";"";SUMIF(B2:B${last};O13;J2:J${last}))`, LEI);
  g.box('N12:O16', 'all');
  g.set('N18', 'Orele suplimentare se compensează întâi cu timp liber plătit, în termenul din „Reguli”; dacă nu se poate, se plătesc cu spor (cel puțin 75% din salariul de bază).', { i: true, color: '#666666' });
  g.set('N19', 'Durata muncii, cu orele suplimentare, nu poate trece de 48 de ore pe săptămână în medie; orele suplimentare se fac doar cu acordul angajatului (în afară de cazurile urgente).', { i: true, color: '#666666' });
  g.set('N20', 'La „Termen depășit” suma se socotește cu spor pentru orele necompensate. Regulile se schimbă prin lege și prin contractul colectiv: verificați-le cu contabilul.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 190, C: 100, D: 120, E: 150, F: 170, G: 150, H: 160, I: 140, J: 130, K: 140, L: 30, M: 10, N: 300, O: 150 });
  return doc('Ore suplimentare', g.sheet('Ore suplimentare'));
}

// 04.11: contribuția lunară pentru locurile de muncă neocupate de persoane cu dizabilități (firmele cu cel puțin 50 de salariați):
// locurile obligatorii = partea întreagă din 4% din numărul mediu de salariați, 50% din salariul minim pe fiecare loc neocupat,
// din care se scad achizițiile de la unitățile protejate; termenul pe 25 ale lunii următoare. Pragul și procentele stau în „Reguli”.
function contributieDizabilitati(): SheetDoc {
  const g = new Grid();
  const last = 25, tot = last + 1;
  const IN: CellStyle = { bg: '#fff59d' };
  g.head(1, ['Luna', 'Număr mediu de salariați', 'Persoane cu dizabilități angajate', 'Salariul minim brut', 'Achiziții de la unități protejate', 'Locuri obligatorii', 'Locuri neocupate', 'Suma datorată', 'Rămas de plată', 'Termenul de plată', 'Plătit', 'Starea']);
  for (let r = 2; r <= last; r++) {
    const e = `OR(A${r}="";B${r}="")`;
    g.set(`F${r}`, `=IF(${e};"";IF(N(B${r})<$O$2;0;INT(N(B${r})*$O$3)))`, { align: 'center' });
    g.set(`G${r}`, `=IF(${e};"";MAX(0;F${r}-N(C${r})))`, { align: 'center', b: true });
    g.set(`H${r}`, `=IF(${e};"";ROUND(G${r}*N(D${r})*$O$4;0))`, LEI);
    g.set(`I${r}`, `=IF(${e};"";MAX(0;H${r}-N(E${r})))`, { ...LEI, b: true });
    g.set(`J${r}`, `=IF(${e};"";DATE(YEAR(A${r});MONTH(A${r})+1;25))`, DATE);
    g.set(`L${r}`, `=IF(${e};"";IF(N(B${r})<$O$2;"Nu e cazul";IF(G${r}=0;"Locuri ocupate";IF(I${r}=0;"Acoperit prin achiziții";IF(K${r}="Da";"Plătit";IF(TODAY()>J${r};"Termen depășit";"De plată"))))))`, { align: 'center' });
  }
  g.col('A', 2, last, DATE);
  g.col('D', 2, last, LEI);
  g.col('E', 2, last, LEI);
  g.lists.push({ range: `K2:K${last}`, values: ['Da', 'Nu'] });
  g.rules.push(
    { range: `L2:L${last}`, op: 'eq', v1: 'Nu e cazul', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Locuri ocupate', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Acoperit prin achiziții', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Plătit', look: 'green' },
    { range: `L2:L${last}`, op: 'eq', v1: 'De plată', look: 'yellow' },
    { range: `L2:L${last}`, op: 'eq', v1: 'Termen depășit', look: 'red' },
  );
  g.set(`A${tot}`, 'Total', TOTAL);
  g.set(`E${tot}`, `=SUM(E2:E${last})`, { ...LEI, ...TOTAL });
  g.set(`G${tot}`, `=SUM(G2:G${last})`, { ...TOTAL, align: 'center' });
  for (const c of 'HI') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:L${tot}`, 'all');
  g.set('N1', 'Reguli', HEAD); g.set('O1', '', HEAD);
  g.set('N2', 'De la câți salariați se aplică'); g.set('O2', '50', { ...IN, align: 'center' });
  g.set('N3', 'Procentul de locuri obligatorii'); g.set('O3', '0.04', { ...PCT, ...IN });
  g.set('N4', 'Din salariul minim, pe loc neocupat'); g.set('O4', '0.5', { ...PCT, ...IN });
  g.box('N1:O4', 'all');
  g.set('N6', 'Pe scurt', HEAD); g.set('O6', '', HEAD);
  g.set('N7', 'Suma datorată în total'); g.set('O7', `=H${tot}`, LEI);
  g.set('N8', 'Acoperit prin achiziții', { color: '#006100' }); g.set('O8', `=H${tot}-I${tot}`, { ...LEI, color: '#006100' });
  g.set('N9', 'Plătit', { color: '#006100' }); g.set('O9', `=SUMIF(L2:L${last};"Plătit";I2:I${last})`, { ...LEI, color: '#006100' });
  g.set('N10', 'De plată încă'); g.set('O10', `=SUMIF(L2:L${last};"De plată";I2:I${last})+SUMIF(L2:L${last};"Termen depășit";I2:I${last})`, { ...LEI, b: true });
  g.set('N11', 'Cu termenul depășit', { color: '#9c0006' }); g.set('O11', `=SUMIF(L2:L${last};"Termen depășit";I2:I${last})`, { ...LEI, color: '#9c0006' });
  g.box('N6:O11', 'all');
  g.set('N13', 'Firmele cu cel puțin 50 de salariați trebuie să aibă angajate persoane cu dizabilități în cel puțin 4% din numărul mediu de salariați; altfel plătesc lunar, pentru fiecare loc neocupat, 50% din salariul minim brut.', { i: true, color: '#666666' });
  g.set('N14', 'Locurile obligatorii sunt luate aici ca partea întreagă din 4% (rotunjire în jos). Achizițiile de produse sau servicii de la unitățile protejate autorizate se scad din suma datorată.', { i: true, color: '#666666' });
  g.set('N15', 'Suma se declară și se plătește până pe 25 ale lunii următoare. Pragul, procentele și felul rotunjirii se schimbă prin lege: verificați-le cu contabilul.', { i: true, color: '#666666' });
  g.widths({ A: 100, B: 170, C: 210, D: 140, E: 210, F: 130, G: 130, H: 130, I: 130, J: 140, K: 70, L: 180, M: 10, N: 300, O: 140 });
  return doc('Contribuția pentru persoanele cu dizabilități', g.sheet('Contribuția'));
}

// 04.11: impozitele locale pe clădiri, terenuri și mijloace de transport: două rate (31 martie, 30 septembrie), bonificația dacă
// se plătește tot până pe 31 martie, ce a rămas și majorările estimate (1% pe fiecare lună începută după termen, pe fiecare rată).
function impoziteLocale(): SheetDoc {
  const g = new Grid();
  const last = 31, tot = last + 1;
  const IN: CellStyle = { bg: '#fff59d' };
  g.head(1, ['Nr.', 'Bunul', 'Felul', 'Adresa sau numărul', 'Anul', 'Impozitul pe an', 'Plătit până pe 31 martie', 'Plătit după', 'Cu bonificația', 'Rata 1 (31 martie)', 'Rata 2 (30 septembrie)', 'Bonificația obținută', 'Rămas de plată', 'Majorări estimate', 'Starea']);
  for (let r = 2; r <= last; r++) {
    const e = `OR(B${r}="";E${r}="";F${r}="")`;
    const months = (m: number) => `MAX(0;(YEAR(TODAY())-E${r})*12+MONTH(TODAY())-${m})`;
    const unpaid1 = `MAX(0;J${r}-N(G${r})-N(H${r}))`;
    g.set(`A${r}`, `=IF(${e};"";ROW()-1)`, { align: 'center' });
    g.set(`I${r}`, `=IF(${e};"";ROUND(N(F${r})*(1-$R$2);0))`, LEI);
    g.set(`J${r}`, `=IF(${e};"";ROUND(N(F${r})/2;0))`, LEI);
    g.set(`K${r}`, `=IF(${e};"";N(F${r})-J${r})`, LEI);
    g.set(`L${r}`, `=IF(${e};"";IF(N(G${r})>=I${r};N(F${r})-I${r};0))`, LEI);
    g.set(`M${r}`, `=IF(${e};"";IF(N(G${r})>=I${r};0;MAX(0;N(F${r})-N(G${r})-N(H${r}))))`, { ...LEI, b: true });
    g.set(`N${r}`, `=IF(${e};"";IF(M${r}=0;0;ROUND((${unpaid1}*${months(3)}+MAX(0;M${r}-${unpaid1})*${months(9)})*$R$3;0)))`, LEI);
    g.set(`O${r}`, `=IF(${e};"";IF(M${r}=0;"Plătit";IF(TODAY()>DATE(E${r};9;30);"Restant";IF(AND(TODAY()>DATE(E${r};3;31);N(G${r})<J${r});"Rata 1 restantă";"De plată"))))`, { align: 'center' });
  }
  g.col('E', 2, last, { align: 'center' });
  g.col('F', 2, last, LEI);
  g.col('G', 2, last, LEI);
  g.col('H', 2, last, LEI);
  g.lists.push({ range: `C2:C${last}`, values: ['Clădire', 'Teren', 'Mijloc de transport', 'Altă taxă locală'] });
  g.rules.push(
    { range: `O2:O${last}`, op: 'eq', v1: 'Plătit', look: 'green' },
    { range: `O2:O${last}`, op: 'eq', v1: 'De plată', look: 'yellow' },
    { range: `O2:O${last}`, op: 'eq', v1: 'Rata 1 restantă', look: 'red' },
    { range: `O2:O${last}`, op: 'eq', v1: 'Restant', look: 'red' },
  );
  g.set(`B${tot}`, 'Total', TOTAL);
  for (const c of 'FGHLMN') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:O${tot}`, 'all');
  g.set('Q1', 'Reguli', HEAD); g.set('R1', '', HEAD);
  g.set('Q2', 'Bonificația la plata întreagă până pe 31 martie'); g.set('R2', '0.1', { ...PCT, ...IN });
  g.set('Q3', 'Majorări pe fiecare lună de întârziere'); g.set('R3', '0.01', { ...PCT, ...IN });
  g.box('Q1:R3', 'all');
  g.set('Q5', 'Pe scurt', HEAD); g.set('R5', '', HEAD);
  g.set('Q6', 'Impozite pe an, în total'); g.set('R6', `=F${tot}`, LEI);
  g.set('Q7', 'Plătit'); g.set('R7', `=G${tot}+H${tot}`, LEI);
  g.set('Q8', 'Bonificația obținută', { color: '#006100' }); g.set('R8', `=L${tot}`, { ...LEI, color: '#006100' });
  g.set('Q9', 'Rămas de plată'); g.set('R9', `=M${tot}`, { ...LEI, b: true });
  g.set('Q10', 'Din care restant', { color: '#9c0006' }); g.set('R10', `=SUMIF(O2:O${last};"Restant";M2:M${last})+SUMIF(O2:O${last};"Rata 1 restantă";M2:M${last})`, { ...LEI, color: '#9c0006' });
  g.set('Q11', 'Majorări estimate', { color: '#9c0006' }); g.set('R11', `=N${tot}`, { ...LEI, color: '#9c0006' });
  g.box('Q5:R11', 'all');
  g.set('Q13', 'Impozitul pe an se plătește în două rate egale, până pe 31 martie și până pe 30 septembrie; cine plătește tot până pe 31 martie primește bonificația hotărâtă de consiliul local (cel mult 10%).', { i: true, color: '#666666' });
  g.set('Q14', 'Majorările sunt doar estimate: câte 1% pe fiecare lună începută după termen, pe fiecare rată; plățile de după 31 martie sunt luate întâi pentru prima rată. Suma exactă o dă primăria.', { i: true, color: '#666666' });
  g.set('Q15', 'Bonificația și majorările se schimbă prin hotărârea consiliului local și prin lege: verificați-le pe decizia de impunere și cu contabilul.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 190, C: 150, D: 200, E: 70, F: 130, G: 170, H: 110, I: 120, J: 130, K: 160, L: 150, M: 130, N: 140, O: 140, P: 10, Q: 320, R: 130 });
  return doc('Impozite și taxe locale', g.sheet('Impozite locale'));
}

// 04.11: garanțiile de bună execuție reținute din facturi (de client la noi sau de noi la subcontractori): suma reținută,
// data la care se eliberează (recepția la terminarea lucrărilor + lunile de garanție), ce s-a restituit și starea.
function garantiiBunaExecutie(): SheetDoc {
  const g = new Grid();
  const last = 31, tot = last + 1;
  const IN: CellStyle = { bg: '#fff59d' };
  g.head(1, ['Nr.', 'Contractul', 'Partenerul', 'Cine a reținut', 'Valoarea facturată', 'Procentul reținut', 'Garanția reținută', 'Recepția la terminare', 'Luni de garanție', 'Se eliberează la', 'Restituit', 'Rămas', 'Zile până la eliberare', 'Starea']);
  for (let r = 2; r <= last; r++) {
    const e = `OR(B${r}="";E${r}="")`;
    g.set(`A${r}`, `=IF(${e};"";ROW()-1)`, { align: 'center' });
    g.set(`G${r}`, `=IF(${e};"";ROUND(N(E${r})*IF(F${r}="";$Q$2;N(F${r}));2))`, LEI);
    g.set(`J${r}`, `=IF(OR(${e};H${r}="");"";EDATE(H${r};IF(I${r}="";$Q$3;N(I${r}))))`, DATE);
    g.set(`L${r}`, `=IF(${e};"";MAX(0;G${r}-N(K${r})))`, { ...LEI, b: true });
    g.set(`M${r}`, `=IF(OR(${e};J${r}="");"";J${r}-TODAY())`, { align: 'center' });
    g.set(`N${r}`, `=IF(${e};"";IF(L${r}=0;"Restituită";IF(J${r}="";"Lucrare în curs";IF(M${r}<=0;IF(D${r}="Reținută de noi";"De restituit";"De cerut înapoi");IF(M${r}<=30;"Se eliberează curând";"În garanție")))))`, { align: 'center' });
  }
  g.col('E', 2, last, LEI);
  g.col('F', 2, last, PCT);
  g.col('H', 2, last, DATE);
  g.col('I', 2, last, { align: 'center' });
  g.col('K', 2, last, LEI);
  g.lists.push({ range: `D2:D${last}`, values: ['Reținută de client', 'Reținută de noi'] });
  g.rules.push(
    { range: `N2:N${last}`, op: 'eq', v1: 'Restituită', look: 'green' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Lucrare în curs', look: 'blue' },
    { range: `N2:N${last}`, op: 'eq', v1: 'În garanție', look: 'blue' },
    { range: `N2:N${last}`, op: 'eq', v1: 'Se eliberează curând', look: 'yellow' },
    { range: `N2:N${last}`, op: 'eq', v1: 'De cerut înapoi', look: 'red' },
    { range: `N2:N${last}`, op: 'eq', v1: 'De restituit', look: 'red' },
  );
  g.set(`B${tot}`, 'Total', TOTAL);
  for (const c of 'EGKL') g.set(`${c}${tot}`, `=SUM(${c}2:${c}${last})`, { ...LEI, ...TOTAL });
  g.box(`A1:N${tot}`, 'all');
  g.set('P1', 'Reguli', HEAD); g.set('Q1', '', HEAD);
  g.set('P2', 'Procentul reținut, când nu e scris pe rând'); g.set('Q2', '0.05', { ...PCT, ...IN });
  g.set('P3', 'Luni de garanție, când nu sunt scrise pe rând'); g.set('Q3', '24', { ...IN, align: 'center' });
  g.box('P1:Q3', 'all');
  g.set('P5', 'Pe scurt', HEAD); g.set('Q5', '', HEAD);
  g.set('P6', 'De primit înapoi de la clienți'); g.set('Q6', `=SUMIF(D2:D${last};"Reținută de client";L2:L${last})`, { ...LEI, b: true });
  g.set('P7', 'Din care de cerut acum', { color: '#9c0006' }); g.set('Q7', `=SUMIF(N2:N${last};"De cerut înapoi";L2:L${last})`, { ...LEI, color: '#9c0006' });
  g.set('P8', 'De dat înapoi subcontractorilor'); g.set('Q8', `=SUMIF(D2:D${last};"Reținută de noi";L2:L${last})`, { ...LEI, b: true });
  g.set('P9', 'Din care de restituit acum', { color: '#9c0006' }); g.set('Q9', `=SUMIF(N2:N${last};"De restituit";L2:L${last})`, { ...LEI, color: '#9c0006' });
  g.set('P10', 'Se eliberează în 30 de zile'); g.set('Q10', `=SUMIF(N2:N${last};"Se eliberează curând";L2:L${last})`, LEI);
  g.set('P11', 'Restituit până acum', { color: '#006100' }); g.set('Q11', `=K${tot}`, { ...LEI, color: '#006100' });
  g.box('P5:Q11', 'all');
  g.set('P13', 'Garanția de bună execuție e partea din fiecare factură pe care clientul o păstrează până la sfârșitul perioadei de garanție a lucrării; la fel o reține firma din facturile subcontractorilor.', { i: true, color: '#666666' });
  g.set('P14', 'Data eliberării se socotește aici de la recepția la terminarea lucrărilor plus lunile de garanție; contractul poate cere și recepția finală sau o scrisoare de garanție bancară în loc de reținere.', { i: true, color: '#666666' });
  g.set('P15', 'Procentul și durata sunt cele din contract: scrieți-le pe fiecare rând, iar cele din „Reguli” se folosesc doar când rândul e gol.', { i: true, color: '#666666' });
  g.widths({ A: 50, B: 170, C: 190, D: 150, E: 140, F: 120, G: 140, H: 150, I: 110, J: 130, K: 120, L: 120, M: 150, N: 170, O: 10, P: 300, Q: 130 });
  return doc('Garanții de bună execuție', g.sheet('Garanții'));
}

export const TEMPLATES: Template[] = [
  { id: 'factura', name: 'Factură (e-Factura)', desc: 'Factură cu TVA pe cote, sumă în litere și număr care crește singur; de aici ies XML-ul e-Factura pentru SPV și PDF-ul pentru client.', build: factura },
  { id: 'casa', name: 'Registru de casă', desc: 'Încasări și plăți în numerar, cu soldul după fiecare operațiune.', build: registruCasa },
  { id: 'facturi', name: 'Evidență facturi emise', desc: 'TVA calculat, starea încasării (listă), ce mai ai de încasat.', build: facturi },
  { id: 'buget', name: 'Buget lunar', desc: 'Venituri și cheltuieli pe categorii: planificat față de real.', build: buget },
  { id: 'inventar', name: 'Inventar / stoc', desc: 'Valoarea stocului și produsele care trebuie comandate.', build: inventar },
  { id: 'chitanta', name: 'Chitanță', desc: 'Chitanță de completat, cu suma scrisă singură și în litere.', build: chitanta },
  { id: 'deviz', name: 'Deviz', desc: 'Lucrări și materiale, cu total, TVA și total de plată.', build: deviz },
  { id: 'pontaj', name: 'Pontaj lunar', desc: 'Ore pe zile (1–31) pentru fiecare persoană, total ore, zile lucrate, CO și CM.', build: pontaj },
  { id: 'salariu', name: 'Salariu net', desc: 'Din brut în net, cu CAS, CASS și impozit (procente editabile).', build: salariu },
  { id: 'decont', name: 'Decont de deplasare', desc: 'Cheltuielile unei deplasări pe categorii, avansul primit și ce mai e de primit sau de restituit.', build: decont },
  { id: 'proiect', name: 'Plan de proiect', desc: 'Sarcini cu responsabil, început și durată, starea din listă și bara pe 12 săptămâni.', build: planProiect },
  { id: 'concedii', name: 'Evidență concedii', desc: 'Zile cuvenite, luate și rămase pentru fiecare angajat; zilele lucrătoare se numără singure, fără sărbătorile legale.', build: concedii },
  { id: 'credit', name: 'Calculator de credit', desc: 'Rata lunară pentru rate egale și graficul de rambursare lună de lună: dobânda, cât scade creditul, totalul de plată.', build: credit },
  { id: 'carburant', name: 'Consum carburant', desc: 'La fiecare plin: kilometrii și litrii; ies consumul la 100 km, costul total și costul pe kilometru.', build: carburant },
  { id: 'abonamente', name: 'Abonamente', desc: 'Ce abonamente plătești, cât te costă pe lună și pe an și când e următoarea plată; plățile din următoarele 7 zile ies în roșu.', build: abonamente },
  { id: 'scadente', name: 'Acte și scadențe', desc: 'ITP, RCA, rovinieta, buletinul, pașaportul: până când e valabil fiecare, câte zile mai sunt; cele expirate ies în roșu, cele care expiră în 30 de zile în galben.', build: scadente },
  { id: 'impartire', name: 'Împărțirea cheltuielilor', desc: 'Cheltuieli făcute împreună (excursie, casă de vacanță, cadou comun): cine cât a plătit, partea fiecăruia și cine cui mai are de dat.', build: impartire },
  { id: 'parcurs', name: 'Foaie de parcurs', desc: 'Fiecare drum cu mașina: traseul, scopul și kilometrii de la bord; ies km de serviciu și personali, procentul de serviciu și costul drumurilor de serviciu.', build: parcurs },
  { id: 'note', name: 'Note școlare', desc: 'Notele pe fiecare materie: media cu două zecimale și rotunjită, media generală și materiile sub 5, în roșu.', build: note },
  { id: 'invitati', name: 'Listă de invitați', desc: 'Nuntă, botez sau aniversare: cine a confirmat, câți adulți și copii vin, la ce masă stau și cât costă mesele; cei fără răspuns ies în galben.', build: invitati },
  { id: 'revizii', name: 'Revizii și reparații auto', desc: 'Fiecare vizită la service: km, ce s-a făcut, piese și manoperă; ies cheltuielile pe total și pe anul acesta și câți km mai ai până la următorul schimb de ulei.', build: revizii },
  { id: 'chirii', name: 'Evidența chiriilor', desc: 'Pentru o locuință dată cu chirie: chiria și utilitățile pe fiecare lună, cât s-a încasat și când; ies restanțele (în roșu) și un impozit estimat.', build: chirii },
  { id: 'contoare', name: 'Citiri contoare', desc: 'Curent, gaz și apă: indexul lunar de pe fiecare contor; ies consumul pe lună, costul estimat cu prețurile tale și lunile mult peste medie, în roșu.', build: contoare },
  { id: 'medicamente', name: 'Medicamente', desc: 'Medicamentele din casă: câte pastile iei pe zi și câte mai ai; ies zilele rămase, când se termină, ce e de cumpărat (în galben) și ce a expirat (în roșu).', build: medicamente },
  { id: 'garantii', name: 'Garanții', desc: 'Ce ai cumpărat, de unde și pe câte luni e garanția; ies data la care expiră, zilele rămase, ce expiră curând (în galben) și ce nu mai e în garanție (în roșu).', build: garantii },
  { id: 'imprumuturi', name: 'Împrumuturi', desc: 'Bani dați sau luați cu împrumut de la prieteni și rude: cât, când și până când; ies restul de dat înapoi, cele întârziate (în roșu) și cât ai de primit și de dat în total.', build: imprumuturi },
  { id: 'nunta', name: 'Bugetul nunții', desc: 'Toate cheltuielile nunții, cu furnizorul, estimarea, contractul și avansul: ies restul de plată, ce e plătit (în verde) sau neplătit (în galben), cât ați depășit și darul estimat de la invitați.', build: bugetNunta },
  { id: 'sarbatori', name: 'Bugetul sărbătorilor', desc: 'Cadourile, masa, decorul și ieșirile de sărbători: bugetul și costul real pe fiecare rând și pe categorii, cât mai rămâne din buget și ce mai e de cumpărat.', build: bugetSarbatori },
  { id: 'voluntariat', name: 'Evidența orelor de voluntariat', desc: 'Pentru asociații și coordonatorii de voluntari: fiecare zi de activitate cu orele și cheltuielile decontate; ies orele pe fiecare voluntar, cele confirmate (în verde) și cele de confirmat încă (în galben).', build: voluntariat },
  { id: 'mutare', name: 'Mutare: cutii și cheltuieli', desc: 'Fiecare cutie cu numărul ei, camera și ce e în ea, fragilă sau nu: ies cutiile pe camere, cele ajunse (în verde) și cele care încă lipsesc (în galben), plus cheltuielile mutării, estimat față de real.', build: mutare },
  { id: 'instruiri', name: 'Evidența instruirilor SSM', desc: 'Instruirile de securitate a muncii și PSI ale fiecărui salariat: data, cât de des se repetă și următoarea dată; ies instruirile restante (în roșu), cele de făcut în 30 de zile (în galben) și cele nesemnate în fișă.', build: instruiri },
  { id: 'echipamente', name: 'Echipamente date angajaților', desc: 'Laptopurile, telefoanele, cheile și cardurile date fiecărui angajat: valoarea, data predării și a restituirii; ies cele aflate la angajați (în galben) cu valoarea lor, cele restituite (în verde), cele deteriorate sau lipsă și cele fără proces-verbal (în roșu).', build: echipamente },
  { id: 'evaluari', name: 'Evaluările anuale ale echipei', desc: 'Notele de la 1 la 5 ale fiecărui coleg pe cele 6 criterii din fișa de evaluare: media și calificativul se calculează singure; ies media echipei, câți au fiecare calificativ (Foarte bine în verde, Nesatisfăcător în roșu) și câte discuții mai sunt de făcut.', build: evaluari },
  { id: 'aniversari', name: 'Zilele de naștere ale colegilor', desc: 'Data nașterii fiecărui coleg: ies următoarea aniversare, câți ani împlinește și în câte zile; cei care au ziua azi (în verde) sau în următoarele 7 zile (în galben) și următorul sărbătorit, ca să nu uite nimeni de felicitări.', build: aniversari },
  { id: 'furnizori', name: 'Facturi de la furnizori', desc: 'Facturile primite: totalul, cât ai plătit și scadența; ies restul de plată, zilele până la scadență, facturile întârziate (în roșu) cu suma lor, cele de plătit în 7 zile (în galben) și cele plătite (în verde).', build: furnizori },
  { id: 'fluxnumerar', name: 'Flux de numerar pe 12 luni', desc: 'Încasările și plățile estimate ale firmei pe fiecare lună, pe categorii: soldul de la sfârșitul lunii trece singur în luna următoare; lunile pe minus ies în roșu, cu cel mai mic sold și luna în care cade.', build: fluxNumerar },
  { id: 'tvalunar', name: 'Evidența TVA pe luni', desc: 'Vânzările și achizițiile fiecărei luni: ies TVA-ul colectat și deductibil, cât e de plată sau de recuperat (în verde) și termenul decontului, pe 25 ale lunii următoare; deconturile nedepuse cu termenul trecut ies în roșu.', build: tvaLunar },
  { id: 'mijloacefixe', name: 'Registrul mijloacelor fixe', desc: 'Calculatoarele, mașinile și utilajele firmei, cu valoarea de intrare și durata în luni: ies amortizarea lunară (liniară, din luna următoare punerii în funcțiune), cea cumulată, valoarea rămasă și amortizarea din anul curent; cele amortizate complet ies în verde.', build: mijloaceFixe },
  { id: 'inventariere', name: 'Listă de inventariere', desc: 'Stocul din evidență față de cel numărat pe raft, pentru fiecare articol: ies valoarea scriptică și faptică, diferențele în cantitate și în lei, plusurile (în verde) și lipsurile (în roșu), cu totalurile pentru procesul-verbal de inventariere.', build: listaInventariere },
  { id: 'statplata', name: 'Stat de plată', desc: 'Salariile tuturor angajaților pe o lună: din brut ies CAS, CASS, impozitul, netul și restul de plată după avans, contribuția angajatorului și costul total; jos totalurile, în dreapta cât plătești angajaților și cât la stat.', build: statPlata },
  { id: 'registratura', name: 'Registru de intrări-ieșiri', desc: 'Corespondența firmei (scrisori, adrese, notificări, cereri), intrată și ieșită: numărul de înregistrare se pune singur, cu termenul de răspuns; cele nerezolvate cu termenul trecut ies în roșu, cele cu termenul în 3 zile în galben.', build: registruIntrariIesiri },
  { id: 'contracte', name: 'Evidența contractelor', desc: 'Contractele firmei (clienți, furnizori, chirie, asigurări, abonamente): partenerul, perioada, valoarea, prelungirea automată și preavizul; zilele rămase ies singure, cele expirate în roșu, cele de reînnoit în galben.', build: evidentaContracte },
  { id: 'oferte', name: 'Compararea ofertelor', desc: 'Aceleași produse sau servicii cerute la trei furnizori: pe fiecare rând iese cel mai mic preț (în verde) și cine îl dă; jos totalul fiecărei oferte, prețurile lipsă și condițiile (livrare, plată, garanție), în dreapta cea mai mică ofertă completă.', build: comparareOferte },
  { id: 'receptie', name: 'Notă de recepție', desc: 'Marfa primită de la furnizor, produs cu produs: cantitatea din factură față de cea numărată la primire; ies diferențele în cantitate și în lei, lipsurile (în roșu), plusurile (în galben), totalul recepționat cu TVA și diferența față de factură.', build: notaReceptie },
  { id: 'arhiva', name: 'Evidența arhivei', desc: 'Dosarele arhivei firmei: ce conține fiecare, anul, câți ani se păstrează și unde stă; ies anul din care se poate elimina, dosarele de eliminat (în roșu), cele fără termen (în galben), cele păstrate (în verde) și câte file sunt în arhivă.', build: evidentaArhivei },
  { id: 'obiective', name: 'Urmărirea obiectivelor', desc: 'Obiectivele anului cu pornirea, ținta și cât s-a realizat: ies progresul (merge și când ținta e mai mică, la costuri), cât ar trebui să fie după timpul trecut și starea: atins (în verde), în urmă (în galben), întârziat (în roșu); în dreapta progresul mediu.', build: urmarireObiective },
  { id: 'creante', name: 'Vechimea creanțelor', desc: 'Facturile emise și cât s-a încasat din fiecare: restul de încasat se împarte singur după întârziere (nescadent, 1–30, 31–60, 61–90 și peste 90 de zile), cu sumele vechi în galben și roșu; în dreapta totalul pe fiecare grupă, procentul din total și întârzierea cea mai mare.', build: vechimeCreante },
  { id: 'comisioane', name: 'Comisioanele agenților', desc: 'Vânzările fiecărui agent pe lună față de țintă: ies realizarea, comisionul cu procentul mic sub țintă și cel mare de la ținta atinsă, bonusul peste un prag și totalul de plată; procentele și bonusul se schimbă într-un singur loc, în dreapta.', build: comisioaneAgenti },
  { id: 'vizite', name: 'Planul vizitelor la clienți', desc: 'Fiecare vizită a agenților: data, clientul, scopul și rezultatul din listă, valoarea comenzii și data următoarei vizite; cele întârziate ies în roșu, cele din săptămâna asta în galben, iar în dreapta câte vizite s-au încheiat cu comandă.', build: vizite },
  { id: 'reclamatii', name: 'Registrul reclamațiilor', desc: 'Fiecare reclamație primită de la clienți: data, clientul, factura, ce reclamă, cauza și rezolvarea din listă; termenul de răspuns de 30 de zile se pune singur, cele cu termenul trecut ies în roșu, iar în dreapta câte sunt deschise și în câte zile se rezolvă, în medie.', build: reclamatii },
  { id: 'termenessm', name: 'Termenele de protecția muncii', desc: 'Tot ce trebuie verificat la termen: instruirea periodică, controlul medical, stingătoarele, instalația electrică, trusa de prim ajutor; din ultima verificare și din câte în câte luni ies data următoare și zilele rămase, cele expirate în roșu și cele din următoarele 30 de zile în galben.', build: termeneSsm },
  { id: 'echipprotectie', name: 'Evidența echipamentului de protecție', desc: 'Căștile, mănușile, bocancii și celelalte echipamente de protecție date fiecărui angajat: din data primirii și durata în luni ies data de înlocuire și zilele rămase; ce e de înlocuit acum iese în roșu, ce expiră în 30 de zile în galben, iar în dreapta și bucățile nesemnate în fișă.', build: echipProtectie },
  { id: 'mentenanta', name: 'Plan de mentenanță a utilajelor', desc: 'Stivuitoarele, cântarele, compresoarele și celelalte utilaje, cu fiecare lucrare care se repetă (revizie, verificare ISCIR sau metrologică, schimb de ulei): din ultima intervenție și din câte în câte zile ies data următoare și zilele rămase; cele depășite ies în roșu, cele din următoarele 14 zile în galben, iar în dreapta și costul intervențiilor.', build: mentenanta },
  { id: 'dividende', name: 'Repartizarea profitului și dividendele', desc: 'Profitul net al anului împărțit asociaților: scade singură rezerva legală (5%, cel mult 20% din capital), pierderile de acoperit și ce rămâne în firmă; pe fiecare asociat ies procentul din capital, dividendul brut, impozitul reținut, netul și termenul impozitului, iar în dreapta cât mai e de plătit.', build: dividende },
  { id: 'asociati', name: 'Registrul asociaților', desc: 'Asociații firmei cu datele lor, data și felul intrării (la înființare, majorare, cesiune, moștenire), aportul și părțile sociale: ies procentul din capital și starea; cei ieșiți rămân în registru, iar în dreapta capitalul din tabel față de cel din actul constitutiv (diferența în roșu) și valoarea unei părți sociale.', build: registruAsociati },
  { id: 'sponsorizari', name: 'Evidența sponsorizărilor', desc: 'Contractele de sponsorizare ale anului cu beneficiarul, valoarea, plata și dovada folosirii; iese starea fiecăruia (cele cu beneficiarul care nu e în registrul ANAF în roșu), iar în dreapta cât se poate scădea din impozitul pe profit (cel mai mic dintre 0,75% din cifra de afaceri și 20% din impozit) și ce rămâne pentru anii următori.', build: sponsorizari },
  { id: 'fisamagazie', name: 'Fișa de magazie', desc: 'Un produs dintr-un depozit sau magazin, cu fiecare intrare și ieșire (documentul, data, de la cine sau la cine): stocul după fiecare mișcare se calculează singur din stocul inițial, iar în dreapta ies stocul la zi, valoarea lui și starea: suficient (în verde), de comandat sub stocul minim (în galben) sau stoc negativ (în roșu).', build: fisaMagazie },
  { id: 'bonconsum', name: 'Bon de consum', desc: 'Materialele date din magazie pentru o lucrare, o comandă sau o secție: cantitatea cerută față de cea eliberată, cu prețul; ies valoarea pe fiecare rând și totalul, ce nu s-a putut da (în galben) și valoarea lui, iar în dreapta datele bonului: gestiunea, locul de consum și cine a cerut, a eliberat și a primit.', build: bonConsum },
  { id: 'bontransfer', name: 'Bon de transfer', desc: 'Marfa mutată dintr-un depozit sau magazin în altul: cantitatea trimisă față de cea numărată la primire, cu prețul; ies diferențele în cantitate și în lei, lipsurile (în roșu), plusurile (în galben), valoarea trimisă și starea transferului: primit complet, neprimit încă sau primit cu diferențe.', build: bonTransfer },
  { id: 'perisabilitati', name: 'Perisabilități', desc: 'La inventarierea unei gestiuni: pentru fiecare produs, ieșirile din perioadă și cota admisă din normă dau lipsa admisă; lipsa constatată se împarte singură în partea din limita normei (trece pe cheltuieli) și partea peste normă (în roșu), de imputat gestionarului, cu valorile în lei și starea inventarului.', build: perisabilitati },
  { id: 'garantiigest', name: 'Garanțiile gestionarilor', desc: 'Garanția materială a fiecărui gestionar: suma stabilită la numire, ce a depus la început și reținerea lunară din salariu; ies constituitul până acum, ce mai e de constituit, în câte luni și starea: constituită (în verde), în curs (în galben) sau neîncepută (în roșu), cu totalurile în dreapta.', build: garantiiGestionari },
  { id: 'aprovizionare', name: 'Necesar de aprovizionare', desc: 'Ce trebuie comandat și cât: din stocul la zi, ce e deja pe drum, consumul mediu pe lună, termenul de livrare și zilele de siguranță ies câte zile mai ajunge stocul, punctul de comandă și cantitatea de comandat, cu valoarea; starea: suficient (în verde), de comandat (în galben) sau lipsă din stoc (în roșu).', build: necesarAprovizionare },
  { id: 'evalfurnizori', name: 'Evaluarea furnizorilor', desc: 'Furnizorii notați la sfârșit de an sau de trimestru: din livrările la termen și cele fără neconformități, plus notele pentru preț și colaborare, iese punctajul din 100 și clasa: A preferat (în verde), B acceptat (în galben) sau C de înlocuit (în roșu), cu cel mai bun furnizor în dreapta.', build: evaluareFurnizori },
  { id: 'retururi', name: 'Retururi către furnizori', desc: 'Marfa dată înapoi furnizorilor (neconformă, deteriorată, livrată în plus sau greșit): valoarea cu TVA, motivul, răspunsul furnizorului și nota de credit primită; ies restul de recuperat și starea: recuperat (în verde), parțial sau în așteptarea notei de credit (în galben), refuzat sau nerezolvat de peste 30 de zile (în roșu).', build: retururiFurnizori },
  { id: 'ambalaje', name: 'Ambalaje returnabile', desc: 'Paleții, navetele, lăzile și buteliile primite de la parteneri sau date lor, cu avizul și garanția pe bucată: soldul fiecărui partener pe fiecare ambalaj se calculează singur (de dat înapoi în galben, de primit înapoi în roșu, închis în verde), iar în dreapta ies soldurile pe fel de ambalaj, garanția în lei și soldul unui partener ales.', build: ambalajeReturnabile },
  { id: 'retururiclienti', name: 'Retururi de la clienți', desc: 'Marfa primită înapoi de la clienți: factura inițială, valoarea cu TVA, motivul (și retragerea în 14 zile la cumpărăturile online) și ce se face cu marfa; după factura storno și suma dată înapoi ies restul de restituit și starea: de emis storno sau de restituit banii (în galben), închis (în verde), iar cele nerezolvate de peste 14 zile în roșu.', build: retururiClienti },
  { id: 'pretvanzare', name: 'Calculul prețului de vânzare', desc: 'Din prețul de achiziție și adaosul comercial ies prețul fără TVA, TVA și prețul cu TVA, rotunjit în sus la 10 bani pentru etichetă; apoi adaosul în lei și marja, iar starea arată produsele vândute în pierdere (în roșu) și cele sub adaosul minim pe care îl alegi (în galben).', build: pretVanzare },
  { id: 'listapreturi', name: 'Listă de prețuri pentru clienți', desc: 'Prețul de listă fără și cu TVA și prețurile cu reducere pentru clienții A, B și C (reducerile le alegi o dată, în dreapta); după prețul de achiziție, starea arată produsele vândute sub cost clienților A (în galben) sau tuturor (în roșu).', build: listaPreturi },
  { id: 'promotii', name: 'Promoții și reduceri', desc: 'Produsele puse în promoție, cu perioada, prețul normal și reducerea: ies prețul promoțional, marja rămasă față de prețul de achiziție și încasările din bucățile vândute; starea arată promoțiile active azi (în verde), cele viitoare (în albastru), cele încheiate și cele vândute sub cost (în roșu).', build: promotii },
  { id: 'rapoartez', name: 'Rapoartele Z ale casei de marcat', desc: 'Raportul Z de la închiderea fiecărei zile: vânzările pe cote de TVA, plățile cu numerar și card și numerarul predat; ies totalul zilei, TVA-ul pe cote și starea: în regulă (în verde), numerar nepredat (în galben), diferență între vânzări și plăți sau numerar predat greșit (în roșu), cu totalurile lunii în dreapta.', build: rapoarteZ },
  { id: 'avansuri', name: 'Avansuri de trezorerie', desc: 'Banii dați angajaților din casierie pentru deplasări sau cumpărături, cu termenul de justificare: din cheltuielile justificate și suma restituită ies ce mai are de dat înapoi angajatul sau ce trebuie să primească în plus și starea: decontat (în verde), în termen (în albastru), rest de restituit sau de plătit (în galben), termen depășit (în roșu), cu soldul unui angajat ales în dreapta.', build: avansuri },
  { id: 'penalitati', name: 'Penalități de întârziere', desc: 'Facturile plătite târziu sau încă neplătite, cu scadența: din zilele de întârziere ies penalitățile din contract (procentul pe zi, cel mult cât suma) sau, fără clauză, dobânda legală (dobânda BNR plus 8 puncte între firme), cei 40 € pe factură pentru recuperare și totalul de cerut în somație.', build: penalitati },
  { id: 'efecte', name: 'Bilete la ordin și cecuri', desc: 'Biletele la ordin și cecurile primite de la clienți sau date furnizorilor: suma, scadența și ce s-a încasat sau plătit; ies restul, zilele până la scadență și starea: încasat sau plătit (în verde), în portofoliu sau de plătit (în albastru), scadent în 7 zile (în galben), scadență depășită sau refuzat la plată (în roșu), cu restul pe un partener ales.', build: efecte },
  { id: 'tichete', name: 'Tichete de masă', desc: 'Tichetele de masă pe o lună, pentru fiecare angajat: din zilele lucrătoare scazi concediile și delegațiile și ies zilele lucrate, tichetele cuvenite și valoarea lor; cu tichetele date se vede diferența de regularizat luna viitoare: în regulă (în verde), de dat în plus (în galben), date în plus (în roșu).', build: tichete },
  { id: 'protocol', name: 'Cheltuieli de protocol', desc: 'Mesele de afaceri, cadourile și gustările pentru parteneri, cu documentul, ocazia și TVA-ul; din veniturile și cheltuielile de la începutul anului iese limita deductibilă de 2%, cât se scade din profit și cât e nedeductibil: în limită (în verde) sau peste limită (în roșu), cu totalul pe feluri de cheltuieli.', build: protocol },
  { id: 'valuta', name: 'Facturi în valută și diferențe de curs', desc: 'Facturile emise sau primite în euro ori altă valută: din cursul de la factură și cel de la plată ies valoarea în lei și diferența de curs: venit (în verde) sau cheltuială (în roșu), după felul facturii; facturile încă deschise ies în galben, cu valoarea lor și rezultatul net.', build: valuta },
  { id: 'cheltauto', name: 'Cheltuieli auto (TVA și deductibilitate)', desc: 'Carburantul, reparațiile, asigurările și taxele mașinilor firmei, cu documentul și TVA-ul: la folosința mixtă ies 50% TVA de dedus și 50% cheltuială deductibilă, la cea exclusiv pentru firmă 100%; în dreapta TVA-ul de dedus și cel nedeductibil, cheltuielile deductibile și nedeductibile și totalul pe feluri.', build: cheltauto },
  { id: 'concmed', name: 'Concedii medicale', desc: 'Certificatele de concediu medical ale angajaților: din codul indemnizației, perioada și media zilnică a veniturilor ies zilele lucrătoare, procentul (la boala obișnuită după durata concediului), indemnizația și împărțirea ei: zilele 1–5 de la angajator, restul din FNUASS, de recuperat; procentele stau într-un tabel de schimbat, în dreapta.', build: concediiMedicale },
  { id: 'oresupl', name: 'Ore suplimentare', desc: 'Orele lucrate peste program de fiecare angajat, compensate cu timp liber sau plătite cu spor: ies termenul de compensare (60 de zile, de schimbat), orele rămase, suma de plată cu sporul de 75% și starea: compensate (în verde), de compensat (în galben), termen depășit (în roșu); în dreapta totalurile și orele unui angajat ales.', build: oreSuplimentare },
  { id: 'dizabilitati', name: 'Contribuția pentru persoanele cu dizabilități', desc: 'Pentru firmele cu cel puțin 50 de salariați, lună de lună: din numărul mediu de salariați ies locurile obligatorii (4%), cele neocupate și suma datorată (50% din salariul minim pe loc), din care se scad achizițiile de la unitățile protejate; starea: nu e cazul, locuri ocupate, acoperit sau plătit (în verde), de plată (în galben), termen depășit (în roșu).', build: contributieDizabilitati },
  { id: 'impozitelocale', name: 'Impozite și taxe locale', desc: 'Impozitele pe clădiri, terenuri și mașini, cu suma pe an și ce ai plătit: ies cele două rate (31 martie și 30 septembrie), suma cu bonificație dacă plătești tot până pe 31 martie, bonificația obținută, ce a rămas de plată, majorările estimate și starea: plătit (în verde), de plată (în galben), rată restantă sau restant (în roșu).', build: impoziteLocale },
  { id: 'programari', name: 'Programări clienți', desc: 'Pentru saloane, cabinete și service-uri: data, ora, clientul, serviciul, durata și prețul fiecărei programări; ies ora de sfârșit, restul de plată după avans și dacă e azi (în galben), a trecut sau urmează; în dreapta câte programări sunt azi și de acum încolo, câte s-au anulat și cât s-a încasat.', build: programari },
  { id: 'abonamenteclienti', name: 'Abonamentele clienților', desc: 'Pentru săli de sport, cursuri, saloane și spălătorii auto: fiecare abonament vândut, cu data începerii, zilele de valabilitate și ședințele incluse; ies data expirării, ședințele rămase, restul de plată și starea (activ, expiră în 7 zile în galben, expirat, epuizat); în dreapta câte sunt active și cât mai e de încasat.', build: abonamenteClienti },
  { id: 'intretinere', name: 'Lista de plată a întreținerii', desc: 'Pentru asociațiile de proprietari: apartamentele cu persoanele, cota-parte indiviză și apa consumată; cheltuielile lunii se trec o dată și se împart singure pe persoane și pe cota-parte, apoi ies totalul lunii, restanțele, restul de plată și starea fiecărui apartament.', build: listaIntretinere },
  { id: 'retetacost', name: 'Rețetă cu costul pe porție', desc: 'Pentru cafenele, patiserii, restaurante și catering: ingredientele cu cantitatea netă, pierderile la curățare și prețul de achiziție; ies cantitatea brută, costul fiecărui ingredient și costul pe porție, cât din prețul de vânzare se duce pe ingrediente, marja și prețul recomandat pentru ținta aleasă.', build: retetaCost },
  { id: 'garantiibe', name: 'Garanții de bună execuție', desc: 'Partea din facturi reținută ca garanție de bună execuție, de clienți sau de firmă la subcontractori: din valoarea facturată și procent ies garanția, data la care se eliberează (recepția plus lunile de garanție), ce a rămas și starea: restituită (în verde), în lucru sau în garanție (în albastru), se eliberează în 30 de zile (în galben), de cerut înapoi sau de restituit (în roșu).', build: garantiiBunaExecutie },
  { id: 'oreclienti', name: 'Ore lucrate pe clienți', desc: 'Pentru consultanți, avocați, contabili, programatori și cei care lucrează cu ora: fiecare bucată de lucru cu data, clientul, proiectul și orele de la – până la, cu pauza; ies orele lucrate, valoarea după tariful obișnuit sau al rândului și dacă mai e de facturat (în galben); în dreapta orele facturabile, cât s-a facturat și cât mai e de facturat, în total și pentru un client ales.', build: oreClienti },
  { id: 'locuinte', name: 'Compararea locuințelor', desc: 'Pentru cine cumpără sau închiriază o locuință: fiecare anunț cu prețul, suprafața, camerele, etajul, cheltuielile lunare și drumul până la serviciu; ies prețul pe mp, un scor din nota ta, prețul pe mp și drum, și starea: cea mai bună (în verde), peste buget (în roșu), de vizitat (în galben) sau vizitată; în dreapta prețul mediu și cea mai ieftină pe mp.', build: locuinte },
  { id: 'termenedosare', name: 'Termenele dosarelor', desc: 'Pentru avocați, consilieri juridici și firmele cu procese: fiecare dosar cu numărul, instanța, clientul, partea adversă, obiectul, stadiul și termenul următor, cu ora și ce e de pregătit; ies zilele până la termen și starea: în 7 zile (în galben), de actualizat după un termen trecut (în roșu), în lucru (în verde), fără termen sau închis; în dreapta dosarele active și cel mai apropiat termen, cu instanța lui.', build: termeneDosare },
  { id: 'valabilitate', name: 'Termene de valabilitate pe loturi', desc: 'Pentru farmacii, magazine, restaurante și depozite: fiecare lot cu produsul, lotul, raftul, cantitatea, prețul de achiziție și data expirării; ies zilele rămase, valoarea lotului și starea: expirat (în roșu), expiră în 30 de zile (în galben), în 90 de zile (în albastru), valabil (în verde) sau retras; în dreapta valoarea expirată, ce expiră curând și cel mai apropiat termen, cu produsul și lotul lui.', build: valabilitateLoturi },
  { id: 'stingatoare', name: 'Evidența stingătoarelor', desc: 'Pentru firme, magazine, școli și asociații de proprietari: fiecare stingător cu seria, tipul, locul, anul fabricației și data ultimei verificări; ies verificarea următoare (după câte luni scrii, de obicei 12), zilele rămase și starea: expirat sau defect (în roșu), în 30 de zile (în galben), la zi (în verde), fără verificare sau scos din uz; în dreapta câte sunt de verificat și cea mai apropiată verificare, cu locul stingătorului.', build: stingatoare },
  { id: 'mobilier', name: 'Comenzi de mobilier', desc: 'Pentru ateliere și magazine de mobilă la comandă: fiecare comandă cu clientul, telefonul, produsul, dimensiunile, termenul de livrare, prețul și cât s-a încasat; ies restul de plată, zilele până la termen și starea: întârziat (în roșu), în 7 zile sau livrat dar de încasat (în galben), gata (în verde); în dreapta comenzile în lucru, banii de încasat și cel mai apropiat termen, cu clientul.', build: comenziMobilier },
];
