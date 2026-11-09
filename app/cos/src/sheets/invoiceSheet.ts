// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Modelul „Factură” din Sheets: celule fixe pentru serie, număr, date, furnizor, client și până la 20 de linii, cu totalurile
// calculate pe cote de TVA (ca în e-Factura) și suma în litere. Tot aici, citirea foii înapoi în datele facturii (pentru
// Export e-Factura și PDF) și ținerea minte a furnizorului și a ultimului număr, ca factura următoare să vină completată.
import type { CellStyle, Sheet } from './format';
import type { InvoiceIn, LineIn, PartyIn, VatRate } from './efacturaOut';

export const FIRST_LINE = 21;
export const LAST_LINE = 40;
const KEY = 'suite.factura';

// Rândurile blocurilor Furnizor (coloanele A–C) și Client (coloanele E–G).
const PARTY_ROWS: [keyof PartyIn, string][] = [
  ['name', 'Nume'], ['cui', 'CUI'], ['vatPayer', 'Plătitor de TVA'], ['regCom', 'Reg. Com.'], ['street', 'Strada, nr.'],
  ['city', 'Localitatea'], ['county', 'Județul'], ['postal', 'Cod poștal'], ['phone', 'Telefon'], ['email', 'E-mail'],
  ['iban', 'IBAN'], ['bank', 'Banca'],
];
const PARTY_TOP = 7;

/** Rândul unui câmp din blocul furnizorului / clientului. */
export const partyRow = (k: keyof PartyIn) => PARTY_TOP + PARTY_ROWS.findIndex(([f]) => f === k);

interface Remembered { supplier?: Partial<Record<keyof PartyIn, string>>; series?: string; number?: string }
function loadRemembered(): Remembered {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Remembered; } catch { return {}; }
}

/** Numărul următor: „0042” → „0043” (păstrează zerourile din față). */
export function nextNumber(n: string): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(n.trim());
  if (!m) return n ? n + '1' : '1';
  const v = String(Number(m[2]) + 1).padStart(m[2].length, '0');
  return m[1] + v + m[3];
}

/** Ține minte furnizorul și numărul facturii exportate (pentru factura următoare). */
export function rememberInvoice(cells: Record<string, string>) {
  const supplier: Partial<Record<keyof PartyIn, string>> = {};
  for (const [k] of PARTY_ROWS) supplier[k] = cells[`B${partyRow(k)}`] ?? '';
  try { localStorage.setItem(KEY, JSON.stringify({ supplier, series: cells.B3 ?? '', number: cells.D3 ?? '' })); } catch { /* fără memorie */ }
}

/** E foaia făcută din modelul Factură? */
export function isInvoiceSheet(sheet: Sheet) {
  return sheet.cells.A1 === 'FACTURĂ' && sheet.cells[`A${FIRST_LINE - 1}`] === 'Nr.';
}

/** Foaia „Factură”: valorile, formulele, stilurile, listele și lățimile (Grid-ul din templates.ts le pune pe foaie). */
export function invoiceCells() {
  const cells: Record<string, string> = {};
  const styles: Record<string, CellStyle> = {};
  const set = (id: string, v: string, st?: CellStyle) => { if (v !== '') cells[id] = v; if (st) styles[id] = { ...styles[id], ...st }; };
  const IN: CellStyle = { bg: '#fff59d' };
  // Sumele cu două zecimale, fără „lei”: factura poate fi și în EUR, USD…
  const MONEY: CellStyle = { fmt: 'number', dec: 2 };
  const L: CellStyle = { b: true };
  const mem = loadRemembered();
  set('A1', 'FACTURĂ', { b: true, align: 'center', bg: '#dde7f5' });
  set('A3', 'Seria', L); set('B3', mem.series ?? '', IN);
  set('C3', 'Numărul', L); set('D3', mem.number ? nextNumber(mem.number) : '0001', IN);
  set('E3', 'Data (AAAA-LL-ZZ)', L); set('F3', new Date().toISOString().slice(0, 10), IN);
  set('A4', 'Scadența', L); set('B4', '', IN);
  set('C4', 'Moneda', L); set('D4', 'RON', IN);
  set('E4', 'Curs BNR (lei, la alte monede)', L); set('F4', '', IN);
  set('A6', 'FURNIZOR', { b: true, bg: '#eef2f7' }); set('E6', 'CLIENT', { b: true, bg: '#eef2f7' });
  for (const [k, label] of PARTY_ROWS) {
    const r = partyRow(k);
    set(`A${r}`, label, L);
    set(`B${r}`, k === 'vatPayer' ? (mem.supplier?.vatPayer || 'Da') : (mem.supplier?.[k] ?? ''), IN);
    if (k === 'iban' || k === 'bank') continue;
    set(`E${r}`, label, L);
    set(`F${r}`, k === 'vatPayer' ? 'Da' : '', IN);
  }
  const head = ['Nr.', 'Denumire', 'UM', 'Cantitate', 'Preț unitar (fără TVA)', 'Cota TVA (%)', 'Valoare'];
  head.forEach((t, i) => set(String.fromCharCode(65 + i) + (FIRST_LINE - 1), t, { b: true, bg: '#dde7f5', align: 'center' }));
  for (let r = FIRST_LINE; r <= LAST_LINE; r++) {
    set(`A${r}`, `=IF(B${r}="";"";COUNT(A$${FIRST_LINE - 1}:A${r - 1})+1)`, { align: 'center' });
    for (const c of ['B', 'C', 'D', 'E', 'F']) set(`${c}${r}`, '', IN);
    set(`E${r}`, '', MONEY);
    set(`G${r}`, `=IF(OR(D${r}="";E${r}="");"";ROUND(D${r}*E${r};2))`, MONEY);
  }
  const t = LAST_LINE + 2;
  const rng = (c: string) => `${c}${FIRST_LINE}:${c}${LAST_LINE}`;
  // TVA pe fiecare cotă, rotunjit o dată pe cotă (la fel ca în e-Factura).
  set(`F${t}`, 'Total fără TVA', { b: true, align: 'right' }); set(`G${t}`, `=SUM(${rng('G')})`, { b: true, ...MONEY });
  set(`F${t + 1}`, 'TVA', { align: 'right' });
  set(`G${t + 1}`, `=IF(B${partyRow('vatPayer')}="Nu";0;ROUND(SUMIF(${rng('F')};21;${rng('G')})*21/100;2)+ROUND(SUMIF(${rng('F')};11;${rng('G')})*11/100;2))`, MONEY);
  set(`F${t + 2}`, 'TOTAL DE PLATĂ', { b: true, bg: '#eef2f7', align: 'right' }); set(`G${t + 2}`, `=G${t}+G${t + 1}`, { b: true, bg: '#eef2f7', ...MONEY });
  set(`A${t + 3}`, `="Adică: "&SUMAINLITERE(G${t + 2};D4)`, { i: true });
  set(`F${t + 4}`, '=IF(OR(D4="";D4="RON");"";"TVA în lei")', { align: 'right' });
  set(`G${t + 4}`, `=IF(OR(D4="";D4="RON";F4="");"";ROUND(G${t + 1}*F4;2))`, MONEY);
  set(`A${t + 5}`, 'Motivul scutirii de TVA', L); set(`B${t + 5}`, '', IN);
  set(`A${t + 6}`, 'Mențiuni', L); set(`B${t + 6}`, '', IN);
  set(`A${t + 8}`, 'Completezi celulele galbene. Fișier → Export e-Factura (XML) face fișierul pentru SPV; Factură PDF face factura pentru client.', { i: true, color: '#666666' });
  const lists = [
    { range: `B${partyRow('vatPayer')}`, values: ['Da', 'Nu'] },
    { range: `F${partyRow('vatPayer')}`, values: ['Da', 'Nu'] },
    { range: rng('C'), values: ['buc', 'kg', 'ore', 'l', 'm', 'mp', 'mc', 'zile', 'luni', 'set', 'serviciu'] },
    { range: rng('F'), values: ['21', '11', '0', 'scutit'] },
    { range: 'D4', values: ['RON', 'EUR', 'USD', 'GBP', 'CHF'] },
  ];
  const colW = { A: 120, B: 260, C: 80, D: 90, E: 150, F: 160, G: 130 };
  return { cells, styles, lists, colW, merges: ['A1:G1', `A${t + 3}:G${t + 3}`, `A${t + 8}:G${t + 8}`] };
}

/** „3.199,99”, „3199.99”, „3199,99” → 3199.99. */
export function parseNum(s: string | undefined): number {
  const t = (s ?? '').replace(/\s|lei|ron/gi, '');
  if (!t) return NaN;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(norm);
}

/** „26.10.2026”, „2026-10-26” sau numărul de zi al foii de calcul → „2026-10-26”. */
export function parseDate(s: string | undefined): string {
  const t = (s ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{5}(\.\d+)?$/.test(t)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000).toISOString().slice(0, 10);
  return t;
}

const yes = (s: string | undefined) => !/^(nu|no|0|false)$/i.test((s ?? '').trim());

/** Datele facturii din foaie (valorile scrise de utilizator, nu formulele). */
export function readInvoice(cells: Record<string, string>): InvoiceIn {
  const party = (col: string): PartyIn => {
    const g = (k: keyof PartyIn) => (cells[`${col}${partyRow(k)}`] ?? '').trim();
    return {
      name: g('name'), cui: g('cui'), vatPayer: yes(g('vatPayer')), regCom: g('regCom'), street: g('street'), city: g('city'),
      county: g('county'), postal: g('postal'), phone: g('phone'), email: g('email'),
      ...(col === 'B' ? { iban: g('iban'), bank: g('bank') } : {}),
    };
  };
  const lines: LineIn[] = [];
  for (let r = FIRST_LINE; r <= LAST_LINE; r++) {
    const name = (cells[`B${r}`] ?? '').trim();
    if (!name) continue;
    const rate = (cells[`F${r}`] ?? '').trim().toLowerCase();
    const vat: VatRate = rate.startsWith('scut') ? 'E' : rate.startsWith('11') ? 11 : /^0/.test(rate) ? 0 : 21;
    lines.push({ name, unit: (cells[`C${r}`] ?? '').trim() || 'buc', qty: parseNum(cells[`D${r}`]), price: parseNum(cells[`E${r}`]), vat });
  }
  const t = LAST_LINE + 2;
  const due = parseDate(cells.B4);
  const note = (cells[`B${t + 6}`] ?? '').trim();
  const rate = parseNum(cells.F4);
  return {
    series: (cells.B3 ?? '').trim(), number: (cells.D3 ?? '').trim(), issueDate: parseDate(cells.F3), ...(due ? { dueDate: due } : {}),
    currency: (cells.D4 ?? 'RON').trim().toUpperCase() || 'RON', ...(rate > 0 ? { exchangeRate: rate } : {}), supplier: party('B'), customer: party('F'), lines,
    exempt: (cells[`B${t + 5}`] ?? '').trim(), ...(note ? { notes: [note] } : {}),
  };
}

/** Valorile foii Factură pentru o factură citită (din XML-ul e-Factura); se pun peste modelul gol din invoiceCells(). */
export function invoiceToCells(inv: InvoiceIn): Record<string, string> {
  const cells: Record<string, string> = {};
  const put = (id: string, v: string | undefined) => { cells[id] = v ?? ''; };
  // Numerele ca în celulele scrise de mână (cu punct zecimal în valoarea păstrată).
  const dec = (x: number) => String(x);
  put('B3', inv.series); put('D3', inv.number);
  put('F3', inv.issueDate); put('B4', inv.dueDate);
  put('D4', inv.currency ?? 'RON'); put('F4', inv.exchangeRate ? dec(inv.exchangeRate) : '');
  const party = (col: string, p: PartyIn) => {
    for (const [k] of PARTY_ROWS) {
      if (col === 'F' && (k === 'iban' || k === 'bank')) continue;
      put(`${col}${partyRow(k)}`, k === 'vatPayer' ? (p.vatPayer ? 'Da' : 'Nu') : String(p[k] ?? ''));
    }
  };
  party('B', inv.supplier);
  party('F', inv.customer);
  inv.lines.slice(0, LAST_LINE - FIRST_LINE + 1).forEach((l, i) => {
    const r = FIRST_LINE + i;
    put(`B${r}`, l.description ? `${l.name} (${l.description})` : l.name);
    put(`C${r}`, l.unit);
    put(`D${r}`, dec(l.qty));
    put(`E${r}`, dec(l.price));
    put(`F${r}`, l.vat === 'E' ? 'scutit' : String(l.vat));
  });
  const t = LAST_LINE + 2;
  put(`B${t + 5}`, inv.exempt);
  put(`B${t + 6}`, (inv.notes ?? []).join(' '));
  return cells;
}

