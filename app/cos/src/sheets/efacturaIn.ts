// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fișierul e-Factura (XML UBL 2.1 / CIUS-RO, primit în SPV sau făcut de noi) → datele facturii, ca să fie puse într-o foaie
// „Factură” (invoiceSheet.ts) și refolosite: corectate, refăcute ca factură nouă, exportate din nou. Spre deosebire de cititorul
// din modulul PDF (care arată factura), aici păstrăm câmpurile separate: stradă, localitate, județ, CUI, cote ca numere.
// Ce nu încape în foaie (reduceri pe factură, mai mult de 20 de linii, cote vechi) se spune în `warnings`.
import { CURRENCIES, UNIT_CODES } from './efacturaOut';
import type { InvoiceIn, LineIn, PartyIn, VatRate } from './efacturaOut';

const kids = (el: Element | null | undefined, name: string): Element[] =>
  el ? [...el.children].filter((c) => c.localName === name) : [];
const kid = (el: Element | null | undefined, ...path: string[]): Element | null => {
  let cur: Element | null | undefined = el;
  for (const p of path) { cur = kids(cur, p)[0]; if (!cur) return null; }
  return cur ?? null;
};
const txt = (el: Element | null | undefined, ...path: string[]) => (kid(el, ...path)?.textContent ?? '').trim();
const num = (el: Element | null | undefined, ...path: string[]) => {
  const v = parseFloat(txt(el, ...path));
  return Number.isFinite(v) ? v : 0;
};

// Codurile de unitate → prescurtarea de pe factură (prima din UNIT_CODES pentru fiecare cod).
const UNIT_NAMES: Record<string, string> = {};
for (const [name, code] of Object.entries(UNIT_CODES)) UNIT_NAMES[code] ??= name;

function party(p: Element | null): PartyIn {
  const party = kid(p, 'Party');
  const addr = kid(party, 'PostalAddress');
  const tax = kids(party, 'PartyTaxScheme').find((t) => txt(t, 'TaxScheme', 'ID').toUpperCase() === 'VAT');
  const vatId = txt(tax, 'CompanyID');
  const legalId = txt(party, 'PartyLegalEntity', 'CompanyID');
  const country = txt(addr, 'Country', 'IdentificationCode').toUpperCase() || 'RO';
  const sub = txt(addr, 'CountrySubentity');
  const county = /^RO-[A-Z]{1,2}$/i.test(sub) ? sub.slice(3).toUpperCase() : sub;
  // „SECTOR3” → „Sector 3”, cum se scrie pe foaie.
  const cityRaw = txt(addr, 'CityName');
  const sector = /^sector\s*([1-6])$/i.exec(cityRaw);
  const street = [txt(addr, 'StreetName'), txt(addr, 'AdditionalStreetName')].filter(Boolean).join(', ');
  return {
    name: txt(party, 'PartyLegalEntity', 'RegistrationName') || txt(party, 'PartyName', 'Name'),
    // Plătitorul de TVA are codul cu „RO” în PartyTaxScheme; altfel CUI-ul stă în PartyLegalEntity.
    cui: vatId || legalId || txt(party, 'PartyIdentification', 'ID'),
    vatPayer: !!vatId,
    regCom: vatId ? legalId : '',
    street: street || txt(addr, 'AddressLine', 'Line'),
    city: sector ? `Sector ${sector[1]}` : cityRaw,
    county,
    postal: txt(addr, 'PostalZone'),
    country,
    phone: txt(party, 'Contact', 'Telephone'),
    email: txt(party, 'Contact', 'ElectronicMail'),
  };
}

export interface InvoiceRead { invoice: InvoiceIn; warnings: string[] }

/** XML-ul e-Factura → datele facturii (cu avertismente pentru ce nu se poate pune pe foaie). Aruncă o eroare dacă nu e factură. */
export function readUbl(xml: string): InvoiceRead {
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  if (dom.getElementsByTagName('parsererror').length) throw new Error('Fișierul nu e un XML valid.');
  const root = dom.documentElement;
  if (root.localName !== 'Invoice' && root.localName !== 'CreditNote') {
    throw new Error('Fișierul XML nu e o factură electronică (e-Factura / UBL). Poate e fișierul cu semnătura din arhivă?');
  }
  const warnings: string[] = [];
  const credit = root.localName === 'CreditNote';
  if (credit) warnings.push('E o factură de stornare (notă de credit): pe foaie apare ca factură obișnuită.');
  const currency = (txt(root, 'DocumentCurrencyCode') || 'RON').toUpperCase();
  if (!CURRENCIES.includes(currency)) warnings.push(`Moneda ${currency} nu e în lista noastră; verifică sumele.`);
  const supplier = party(kid(root, 'AccountingSupplierParty'));
  // IBAN-ul furnizorului e în PaymentMeans (frate cu AccountingSupplierParty).
  const acc = kid(root, 'PaymentMeans', 'PayeeFinancialAccount');
  if (acc) { supplier.iban = txt(acc, 'ID'); supplier.bank = txt(acc, 'Name') || txt(acc, 'FinancialInstitutionBranch', 'Name'); }
  const customer = party(kid(root, 'AccountingCustomerParty'));

  let exempt = '';
  const odd = new Set<string>();
  const lines: LineIn[] = kids(root, credit ? 'CreditNoteLine' : 'InvoiceLine').map((l) => {
    const q = kid(l, credit ? 'CreditedQuantity' : 'InvoicedQuantity');
    const item = kid(l, 'Item');
    const cat = kid(item, 'ClassifiedTaxCategory');
    const code = txt(cat, 'ID').toUpperCase();
    const pct = num(cat, 'Percent');
    let vat: VatRate = 21;
    if (code === 'E' || code === 'AE' || code === 'K' || code === 'G') vat = 'E';
    else if (code === 'Z' || code === 'O' || (code === 'S' && pct === 0)) vat = 0;
    else if (pct === 21 || pct === 11) vat = pct;
    else odd.add(`${pct}%`);
    if (vat === 'E' && !exempt) exempt = txt(cat, 'TaxExemptionReason');
    const base = num(l, 'Price', 'BaseQuantity') || 1;
    const unitCode = q?.getAttribute('unitCode') ?? '';
    if (kids(l, 'AllowanceCharge').length) odd.add('reduceri pe linie');
    const qty = parseFloat(q?.textContent ?? '') || 0;
    let price = num(l, 'Price', 'PriceAmount') / base;
    // Dacă prețul cu reducerile de pe linie nu dă valoarea liniei, folosim prețul care o dă.
    const value = num(l, 'LineExtensionAmount');
    if (qty && Math.abs(qty * price - value) > 0.01) price = Math.round((value / qty) * 10000) / 10000;
    return {
      name: txt(item, 'Name'),
      description: txt(item, 'Description'),
      unit: UNIT_NAMES[unitCode] ?? (unitCode || 'buc'),
      qty,
      price,
      vat,
    };
  });
  for (const o of odd) {
    warnings.push(o === 'reduceri pe linie'
      ? 'Unele linii au reduceri: pe foaie apare prețul după reducere.'
      : `Cota de TVA ${o} nu mai e în vigoare; pe foaie liniile ei au cota 21%. Verifică-le.`);
  }
  if (lines.length > 20) warnings.push(`Factura are ${lines.length} linii; pe foaie încap primele 20.`);
  if (kids(root, 'AllowanceCharge').length) warnings.push('Factura are reduceri sau taxe pe total, care nu apar pe foaie.');
  if (num(root, 'LegalMonetaryTotal', 'PrepaidAmount')) warnings.push('Factura are o sumă plătită în avans, care nu apare pe foaie.');

  // Cursul: din nota „Curs BNR: 1 EUR = 4,9751 lei” sau din TVA-ul în lei împărțit la TVA-ul în moneda facturii.
  const notes = kids(root, 'Note').map((n) => (n.textContent ?? '').trim()).filter(Boolean);
  let exchangeRate: number | undefined;
  const rateNote = notes.findIndex((n) => /^curs\s+bnr/i.test(n));
  if (currency !== 'RON') {
    const m = rateNote >= 0 ? /=\s*([\d.,]+)/.exec(notes[rateNote]) : null;
    if (m) exchangeRate = parseFloat(m[1].replace(',', '.'));
    else {
      const totals = kids(root, 'TaxTotal');
      const inCur = num(totals.find((t) => kid(t, 'TaxAmount')?.getAttribute('currencyID') === currency), 'TaxAmount');
      const inLei = num(totals.find((t) => kid(t, 'TaxAmount')?.getAttribute('currencyID') === 'RON'), 'TaxAmount');
      if (inCur && inLei) exchangeRate = Math.round((inLei / inCur) * 10000) / 10000;
    }
  }
  const id = txt(root, 'ID');
  // „ABC 0042” → seria ABC, numărul 0042; fără spațiu, literele din față sunt seria („FCT123” → FCT, 123).
  const sp = /^(.*\S)\s+(\S*\d\S*)$/.exec(id) ?? /^([A-Za-z]+[-/]?)(\d.*)$/.exec(id);
  const invoice: InvoiceIn = {
    series: sp ? sp[1].replace(/[-/]$/, '') : '',
    number: sp ? sp[2] : id,
    issueDate: txt(root, 'IssueDate'),
    dueDate: txt(root, 'DueDate') || txt(root, 'PaymentMeans', 'PaymentDueDate') || undefined,
    currency,
    ...(exchangeRate ? { exchangeRate } : {}),
    supplier,
    customer,
    lines,
    exempt,
    notes: notes.filter((_, i) => i !== rateNote),
  };
  return { invoice, warnings };
}
