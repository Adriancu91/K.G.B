// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Factura românească → fișierul e-Factura (XML UBL 2.1, după regulile CIUS-RO), gata de încărcat de utilizator în SPV.
// Tot aici: calculul sumelor (pe linii, pe cote de TVA, totaluri, cu rotunjire la bani) și o verificare locală după regulile
// pe care le cunoaștem (câmpuri obligatorii, CUI cu cifra de control, județ, sector în București, TVA pe categorii, totaluri).
// Nu se trimite nimic pe internet. Cititorul din modulul PDF (pdf/efactura.ts) trebuie să citească identic ce scriem aici.
import { validCui, validIban } from './ids';

export interface PartyIn {
  name: string;
  /** Codul fiscal, cu sau fără „RO”. */
  cui: string;
  /** Plătitor de TVA: CUI-ul apare cu „RO” în față, ca cod de TVA. */
  vatPayer: boolean;
  /** Numărul de la Registrul Comerțului (de exemplu J40/123/2020). */
  regCom?: string;
  street: string;
  city: string;
  /** Județul: codul (B, CJ, IS…) sau numele („Cluj”, „București”). */
  county: string;
  postal?: string;
  /** Țara, cod de 2 litere (RO dacă lipsește). */
  country?: string;
  phone?: string;
  email?: string;
  iban?: string;
  bank?: string;
}

/** Cota de TVA: 21, 11, 0 (cota zero) sau „E” (scutit, cu motivul în `exempt`). La neplătitorii de TVA nu contează. */
export type VatRate = 21 | 11 | 0 | 'E';

export interface LineIn {
  name: string;
  description?: string;
  /** Unitatea de măsură, ca pe factură: buc, kg, ore, l, m, mp, zile, luni, set, serviciu… */
  unit: string;
  qty: number;
  /** Prețul unitar fără TVA. */
  price: number;
  vat: VatRate;
}

export interface InvoiceIn {
  series: string;
  number: string;
  /** AAAA-LL-ZZ */
  issueDate: string;
  dueDate?: string;
  /** Moneda facturii (RON dacă lipsește; altfel EUR, USD…). */
  currency?: string;
  /** La facturile în altă monedă: câți lei face o unitate (cursul BNR din ziua facturii). TVA-ul se declară și în lei. */
  exchangeRate?: number;
  supplier: PartyIn;
  customer: PartyIn;
  lines: LineIn[];
  /** Motivul scutirii, pentru liniile cu TVA „E” (de exemplu „Scutit conform art. 292 Cod fiscal”). */
  exempt?: string;
  notes?: string[];
}

export const UNIT_CODES: Record<string, string> = {
  buc: 'H87', bucăți: 'H87', bucata: 'H87', bucată: 'H87', set: 'SET', kg: 'KGM', g: 'GRM', t: 'TNE', m: 'MTR', km: 'KMT', mp: 'MTK',
  'm2': 'MTK', mc: 'MTQ', 'm3': 'MTQ', l: 'LTR', ore: 'HUR', ora: 'HUR', oră: 'HUR', h: 'HUR', zile: 'DAY', zi: 'DAY', luni: 'MON',
  luna: 'MON', lună: 'MON', ani: 'ANN', an: 'ANN', kwh: 'KWH', perechi: 'PR', cutii: 'XBX', pachete: 'XPK', role: 'XRO', sticle: 'XBO',
  serviciu: 'C62', servicii: 'C62', activitate: 'ACT',
};

const COUNTY_CODES: Record<string, string> = {
  alba: 'AB', arad: 'AR', arges: 'AG', bacau: 'BC', bihor: 'BH', 'bistrita-nasaud': 'BN', botosani: 'BT', brasov: 'BV', braila: 'BR',
  bucuresti: 'B', buzau: 'BZ', 'caras-severin': 'CS', calarasi: 'CL', cluj: 'CJ', constanta: 'CT', covasna: 'CV', dambovita: 'DB',
  dolj: 'DJ', galati: 'GL', giurgiu: 'GR', gorj: 'GJ', harghita: 'HR', hunedoara: 'HD', ialomita: 'IL', iasi: 'IS', ilfov: 'IF',
  maramures: 'MM', mehedinti: 'MH', mures: 'MS', neamt: 'NT', olt: 'OT', prahova: 'PH', 'satu mare': 'SM', salaj: 'SJ', sibiu: 'SB',
  suceava: 'SV', teleorman: 'TR', timis: 'TM', tulcea: 'TL', vaslui: 'VS', valcea: 'VL', vrancea: 'VN',
};
const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/^jud(e[tț]ul)?\.?\s*/, '').trim();

/** „Cluj”, „cj”, „RO-CJ” → „CJ”; necunoscut → ''. */
export function countyCode(county: string): string {
  const c = county.trim().replace(/^RO-/i, '');
  if (Object.values(COUNTY_CODES).includes(c.toUpperCase())) return c.toUpperCase();
  return COUNTY_CODES[plain(c)] ?? '';
}

/** Monedele acceptate (codurile ISO 4217 cele mai folosite în facturile românești). */
export const CURRENCIES = ['RON', 'EUR', 'USD', 'GBP', 'CHF', 'MDL', 'HUF', 'PLN', 'CZK', 'SEK', 'DKK', 'NOK', 'JPY', 'CNY', 'CAD', 'AUD', 'TRY'];

const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const cuiDigits = (c: string) => c.replace(/\s+/g, '').toUpperCase().replace(/^RO/, '');

export interface Totals {
  lines: { value: number; code: string; pct: number }[];
  vat: { code: string; pct: number; base: number; amount: number }[];
  net: number;
  vatSum: number;
  gross: number;
}

/** Categoria de TVA din standard: S (cotă normală / redusă), Z (cota zero), E (scutit), O (neplătitor de TVA). */
function category(inv: InvoiceIn, l: LineIn): { code: string; pct: number } {
  if (!inv.supplier.vatPayer) return { code: 'O', pct: 0 };
  if (l.vat === 'E') return { code: 'E', pct: 0 };
  if (l.vat === 0) return { code: 'Z', pct: 0 };
  return { code: 'S', pct: l.vat };
}

/** Sumele facturii: valoarea fiecărei linii, TVA pe fiecare cotă, total fără TVA, TVA, total de plată. */
export function invoiceTotals(inv: InvoiceIn): Totals {
  const lines = inv.lines.map((l) => ({ value: r2(l.qty * l.price), ...category(inv, l) }));
  const groups = new Map<string, { code: string; pct: number; base: number; amount: number }>();
  for (const l of lines) {
    const k = `${l.code}|${l.pct}`;
    const g = groups.get(k) ?? { code: l.code, pct: l.pct, base: 0, amount: 0 };
    g.base = r2(g.base + l.value);
    groups.set(k, g);
  }
  const vat = [...groups.values()].map((g) => ({ ...g, amount: r2((g.base * g.pct) / 100) }));
  const net = r2(lines.reduce((s, l) => s + l.value, 0));
  const vatSum = r2(vat.reduce((s, g) => s + g.amount, 0));
  return { lines, vat, net, vatSum, gross: r2(net + vatSum) };
}

/**
 * Verificarea locală (după regulile EN 16931 și CIUS-RO pe care le cunoaștem). Întoarce greșelile, în română, de rezolvat
 * înainte de încărcarea în SPV; lista goală = fișierul e bun din ce putem verifica aici.
 */
export function validateInvoice(inv: InvoiceIn): string[] {
  const err: string[] = [];
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!inv.number.trim()) err.push('Lipsește numărul facturii.');
  if (!/\d/.test(inv.number)) err.push('Numărul facturii trebuie să conțină cel puțin o cifră.');
  if (!date.test(inv.issueDate)) err.push('Data facturii trebuie să fie de forma AAAA-LL-ZZ.');
  if (inv.dueDate && !date.test(inv.dueDate)) err.push('Data scadenței trebuie să fie de forma AAAA-LL-ZZ.');
  if (inv.dueDate && date.test(inv.issueDate) && inv.dueDate < inv.issueDate) err.push('Scadența nu poate fi înaintea datei facturii.');
  const cur = (inv.currency ?? 'RON').trim().toUpperCase() || 'RON';
  if (!CURRENCIES.includes(cur)) err.push(`Moneda „${inv.currency}” nu e cunoscută (scrie codul ei: RON, EUR, USD, GBP, CHF…).`);
  else if (cur !== 'RON' && !(Number.isFinite(inv.exchangeRate) && (inv.exchangeRate ?? 0) > 0)) err.push(`Factura e în ${cur}: lipsește cursul BNR (câți lei face 1 ${cur}), ca TVA-ul să fie declarat și în lei.`);
  const party = (p: PartyIn, who: string) => {
    if (!p.name.trim()) err.push(`${who}: lipsește numele.`);
    if (p.name.length > 200) err.push(`${who}: numele are mai mult de 200 de caractere.`);
    const ro = (p.country ?? 'RO').toUpperCase() === 'RO';
    if (ro && !cuiDigits(p.cui)) err.push(`${who}: lipsește codul fiscal (CUI).`);
    else if (ro && /^\d+$/.test(cuiDigits(p.cui)) && !validCui(p.cui)) err.push(`${who}: CUI-ul ${p.cui} nu e corect (cifra de control nu se potrivește).`);
    if (!p.street.trim()) err.push(`${who}: lipsește strada din adresă.`);
    if (!p.city.trim()) err.push(`${who}: lipsește localitatea.`);
    if (ro) {
      const cc = countyCode(p.county);
      if (!cc) err.push(`${who}: județul „${p.county}” nu e cunoscut (scrie numele județului sau codul, de exemplu CJ).`);
      if (cc === 'B' && !/^sector\s*[1-6]$/i.test(p.city.trim())) err.push(`${who}: în București, localitatea se scrie ca sector (Sector 1 … Sector 6).`);
    }
    if (p.iban && !validIban(p.iban)) err.push(`${who}: IBAN-ul ${p.iban} nu e corect.`);
  };
  party(inv.supplier, 'Furnizor');
  party(inv.customer, 'Client');
  if (!inv.lines.length) err.push('Factura nu are niciun produs sau serviciu.');
  inv.lines.forEach((l, i) => {
    const n = `Linia ${i + 1}`;
    if (!l.name.trim()) err.push(`${n}: lipsește denumirea.`);
    if (!Number.isFinite(l.qty) || l.qty === 0) err.push(`${n}: cantitatea trebuie să fie un număr diferit de 0.`);
    if (!Number.isFinite(l.price) || l.price < 0) err.push(`${n}: prețul trebuie să fie un număr pozitiv.`);
    if (!UNIT_CODES[l.unit.trim().toLowerCase()]) err.push(`${n}: unitatea de măsură „${l.unit}” nu e cunoscută (de exemplu buc, kg, ore, l, m, mp, zile, serviciu).`);
    if (inv.supplier.vatPayer && l.vat === 'E' && !inv.exempt?.trim()) err.push(`${n}: e scutită de TVA, dar lipsește motivul scutirii.`);
  });
  return err;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const amt = (x: number) => r2(x).toFixed(2);
const qty = (x: number) => String(Math.round(x * 10000) / 10000);

function partyXml(p: PartyIn, tag: string, ind: string) {
  const ro = (p.country ?? 'RO').toUpperCase() === 'RO';
  const cc = ro ? countyCode(p.county) : '';
  // În București, localitatea e „SECTOR1”…„SECTOR6” (regula CIUS-RO).
  const city = cc === 'B' ? p.city.trim().toUpperCase().replace(/\s+/g, '') : p.city.trim();
  const cui = cuiDigits(p.cui);
  const L: string[] = [];
  L.push(`${ind}<cac:${tag}>`, `${ind}  <cac:Party>`);
  L.push(`${ind}    <cac:PostalAddress>`);
  L.push(`${ind}      <cbc:StreetName>${esc(p.street.trim())}</cbc:StreetName>`);
  L.push(`${ind}      <cbc:CityName>${esc(city)}</cbc:CityName>`);
  if (p.postal?.trim()) L.push(`${ind}      <cbc:PostalZone>${esc(p.postal.trim())}</cbc:PostalZone>`);
  if (cc) L.push(`${ind}      <cbc:CountrySubentity>RO-${cc}</cbc:CountrySubentity>`);
  else if (p.county.trim()) L.push(`${ind}      <cbc:CountrySubentity>${esc(p.county.trim())}</cbc:CountrySubentity>`);
  L.push(`${ind}      <cac:Country><cbc:IdentificationCode>${esc((p.country ?? 'RO').toUpperCase())}</cbc:IdentificationCode></cac:Country>`);
  L.push(`${ind}    </cac:PostalAddress>`);
  if (p.vatPayer) {
    L.push(`${ind}    <cac:PartyTaxScheme>`, `${ind}      <cbc:CompanyID>${esc(ro ? 'RO' + cui : p.cui.trim())}</cbc:CompanyID>`,
      `${ind}      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`, `${ind}    </cac:PartyTaxScheme>`);
  }
  L.push(`${ind}    <cac:PartyLegalEntity>`, `${ind}      <cbc:RegistrationName>${esc(p.name.trim())}</cbc:RegistrationName>`);
  // Fără cod de TVA, CUI-ul stă aici; altfel aici stă numărul de la Registrul Comerțului, dacă există.
  const legalId = p.vatPayer ? (p.regCom?.trim() ?? '') : cui;
  if (legalId) L.push(`${ind}      <cbc:CompanyID>${esc(legalId)}</cbc:CompanyID>`);
  L.push(`${ind}    </cac:PartyLegalEntity>`);
  if (p.phone?.trim() || p.email?.trim()) {
    L.push(`${ind}    <cac:Contact>`);
    if (p.phone?.trim()) L.push(`${ind}      <cbc:Telephone>${esc(p.phone.trim())}</cbc:Telephone>`);
    if (p.email?.trim()) L.push(`${ind}      <cbc:ElectronicMail>${esc(p.email.trim())}</cbc:ElectronicMail>`);
    L.push(`${ind}    </cac:Contact>`);
  }
  L.push(`${ind}  </cac:Party>`, `${ind}</cac:${tag}>`);
  return L;
}

function taxCategory(code: string, pct: number, exempt: string, ind: string, tag: string) {
  const L = [`${ind}<cac:${tag}>`, `${ind}  <cbc:ID>${code}</cbc:ID>`];
  if (code !== 'O') L.push(`${ind}  <cbc:Percent>${qty(pct)}</cbc:Percent>`);
  if (tag === 'TaxCategory' && code === 'E') L.push(`${ind}  <cbc:TaxExemptionReason>${esc(exempt)}</cbc:TaxExemptionReason>`);
  if (tag === 'TaxCategory' && code === 'O') L.push(`${ind}  <cbc:TaxExemptionReasonCode>VATEX-EU-O</cbc:TaxExemptionReasonCode>`);
  L.push(`${ind}  <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`, `${ind}</cac:${tag}>`);
  return L;
}

/** XML-ul e-Factura (UBL 2.1 Invoice, CIUS-RO 1.0.1). Elementele sunt în ordinea cerută de schema UBL. */
export function invoiceUbl(inv: InvoiceIn): string {
  const t = invoiceTotals(inv);
  const cur = (inv.currency ?? 'RON').trim().toUpperCase() || 'RON';
  const rate = cur !== 'RON' ? inv.exchangeRate ?? 0 : 0;
  const A = (x: number) => `currencyID="${cur}">${amt(x)}`;
  const L: string[] = [];
  L.push('<?xml version="1.0" encoding="UTF-8"?>');
  L.push('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">');
  L.push('  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>');
  L.push(`  <cbc:ID>${esc((inv.series.trim() + ' ' + inv.number.trim()).trim())}</cbc:ID>`);
  L.push(`  <cbc:IssueDate>${inv.issueDate}</cbc:IssueDate>`);
  if (inv.dueDate) L.push(`  <cbc:DueDate>${inv.dueDate}</cbc:DueDate>`);
  L.push('  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
  for (const n of inv.notes ?? []) if (n.trim()) L.push(`  <cbc:Note>${esc(n.trim())}</cbc:Note>`);
  if (rate) L.push(`  <cbc:Note>Curs BNR: 1 ${cur} = ${String(rate).replace('.', ',')} lei</cbc:Note>`);
  L.push(`  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>`);
  // În altă monedă, TVA-ul se declară și în lei (regula CIUS-RO: moneda de TVA e RON).
  if (rate) L.push('  <cbc:TaxCurrencyCode>RON</cbc:TaxCurrencyCode>');
  L.push(...partyXml(inv.supplier, 'AccountingSupplierParty', '  '));
  L.push(...partyXml(inv.customer, 'AccountingCustomerParty', '  '));
  if (inv.supplier.iban?.trim()) {
    L.push('  <cac:PaymentMeans>', '    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>', '    <cac:PayeeFinancialAccount>',
      `      <cbc:ID>${esc(inv.supplier.iban.replace(/\s+/g, '').toUpperCase())}</cbc:ID>`);
    if (inv.supplier.bank?.trim()) L.push(`      <cbc:Name>${esc(inv.supplier.bank.trim())}</cbc:Name>`);
    L.push('    </cac:PayeeFinancialAccount>', '  </cac:PaymentMeans>');
  }
  L.push('  <cac:TaxTotal>', `    <cbc:TaxAmount ${A(t.vatSum)}</cbc:TaxAmount>`);
  for (const g of t.vat) {
    L.push('    <cac:TaxSubtotal>', `      <cbc:TaxableAmount ${A(g.base)}</cbc:TaxableAmount>`, `      <cbc:TaxAmount ${A(g.amount)}</cbc:TaxAmount>`,
      ...taxCategory(g.code, g.pct, inv.exempt?.trim() ?? '', '      ', 'TaxCategory'), '    </cac:TaxSubtotal>');
  }
  L.push('  </cac:TaxTotal>');
  if (rate) L.push('  <cac:TaxTotal>', `    <cbc:TaxAmount currencyID="RON">${amt(t.vatSum * rate)}</cbc:TaxAmount>`, '  </cac:TaxTotal>');
  L.push('  <cac:LegalMonetaryTotal>', `    <cbc:LineExtensionAmount ${A(t.net)}</cbc:LineExtensionAmount>`,
    `    <cbc:TaxExclusiveAmount ${A(t.net)}</cbc:TaxExclusiveAmount>`, `    <cbc:TaxInclusiveAmount ${A(t.gross)}</cbc:TaxInclusiveAmount>`,
    `    <cbc:PayableAmount ${A(t.gross)}</cbc:PayableAmount>`, '  </cac:LegalMonetaryTotal>');
  inv.lines.forEach((l, i) => {
    const tl = t.lines[i];
    L.push('  <cac:InvoiceLine>', `    <cbc:ID>${i + 1}</cbc:ID>`,
      `    <cbc:InvoicedQuantity unitCode="${UNIT_CODES[l.unit.trim().toLowerCase()] ?? 'H87'}">${qty(l.qty)}</cbc:InvoicedQuantity>`,
      `    <cbc:LineExtensionAmount ${A(tl.value)}</cbc:LineExtensionAmount>`, '    <cac:Item>');
    if (l.description?.trim()) L.push(`      <cbc:Description>${esc(l.description.trim())}</cbc:Description>`);
    L.push(`      <cbc:Name>${esc(l.name.trim())}</cbc:Name>`, ...taxCategory(tl.code, tl.pct, '', '      ', 'ClassifiedTaxCategory'), '    </cac:Item>',
      `    <cac:Price><cbc:PriceAmount currencyID="${cur}">${qty(l.price)}</cbc:PriceAmount></cac:Price>`, '  </cac:InvoiceLine>');
  });
  L.push('</Invoice>', '');
  return L.join('\n');
}
