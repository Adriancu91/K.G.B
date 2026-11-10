// K.G.B. only (7.4m-3, D-082), not copied from COS: an invoice issued in Business becomes e-Factura through the
// COS code (src/sheets/efacturaOut.ts) — the addresses split into pieces, the sums from bani, a storno with negative
// quantities, the XML read back by the COS reader (pdf/efactura.ts) with the same totals; and an invoice whose VAT
// rounded per line differs from the standard's VAT per rate is not written. Made-up firms.
// Use (in app/cos/): node --import ./hooks.mjs tests/kgb-efactura-map.test.mjs
import { DOMParser } from '@xmldom/xmldom';

globalThis.DOMParser = DOMParser;
const probe = new DOMParser().parseFromString('<a><b/></a>', 'application/xml').documentElement;
if (!('children' in probe)) Object.defineProperty(Object.getPrototypeOf(probe), 'children', { get() { return Array.from({ length: this.childNodes.length }, (_, i) => this.childNodes.item(i)).filter((n) => n.nodeType === 1); } });

const M = await import('../../src/modules/business/efacturaMap.ts');
const { parseInvoice } = await import('../src/pdf/efactura.ts');

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`);
  if (!ok) fail++;
};

// Addresses as Business keeps them (one line).
eq('stradă, localitate, județ, cod', M.splitAddress('Str. Memorandumului nr. 1, Cluj-Napoca, jud. Cluj, 400114'), { street: 'Str. Memorandumului nr. 1', city: 'Cluj-Napoca', county: 'Cluj', postal: '400114' });
eq('localitatea întâi, reședința de județ', M.splitAddress('Iași, Str. Lăpușneanu 1'), { street: 'Str. Lăpușneanu 1', city: 'Iași', county: 'Iași', postal: '' });
eq('București, sector', M.splitAddress('Bd. Unirii nr. 10, Sector 3, București'), { street: 'Bd. Unirii nr. 10', city: 'Sector 3', county: 'București', postal: '' });
eq('doar localitatea', M.splitAddress('Iași'), { street: '', city: 'Iași', county: 'Iași', postal: '' });

// The invoice of the Business test (tests/invoices.rs): 3 bags × 32,50 at 21% + transport 100 at 11%.
const f = {
  id: 'x', serie: 'KGB', numar: 100, data: '2026-11-08', scadenta: '2026-11-23',
  client: { nume: 'Client SRL', cui: 'RO12345674', reg_com: '', adresa: 'Iași' },
  furnizor: { firma_nume: 'Kronos Global Business SRL', firma_cui: 'RO18547290', firma_reg_com: 'J22/1/2020', firma_adresa: 'Iași, Str. Lăpușneanu 1', firma_iban: 'RO49AAAA1B31007593840000', firma_banca: 'Banca de test', firma_email: '' },
  linii: [
    { descriere: 'Ciment 40 kg', um: 'sac', cantitate: 3000, pret_unitar: 3250, cota_tva: 21, valoare: 9750, tva: 2048 },
    { descriere: 'Transport', um: 'cursă', cantitate: 1000, pret_unitar: 10000, cota_tva: 11, valoare: 10000, tva: 1100 },
  ],
  total_fara_tva: 19750, total_tva: 3148, total: 22898, storno_de: null, nota: '',
};
const places = { supplier: M.splitAddress(f.furnizor.firma_adresa), customer: { street: 'Str. Palat 1', city: 'Iași', county: 'Iași', postal: '' } };
eq('unitățile pe care e-Factura nu le știe', M.unknownUnits(f), ['sac', 'cursă']);
const noUnits = M.buildEfactura(f, places);
eq('fără unități alese: greșelile COS, în română', noUnits.errors.length === 2 && noUnits.errors.every((e) => e.includes('unitatea de măsură')), true);
const units = { sac: 'buc', cursă: 'serviciu' };
const ok = M.buildEfactura(f, places, units);
eq('factura bună nu are greșeli', ok.errors, []);
const back = parseInvoice(ok.xml);
eq('numărul e seria și numărul facturii', back.id, 'KGB 100');
eq('dus-întors (cititorul COS): totalurile la ban', [back.totals.net, back.totals.vat, back.totals.payable].map((x) => Math.round(x * 100)), [19750, 3148, 22898]);
eq('XML: total de plată 228.98', /<cbc:PayableAmount currencyID="RON">228\.98</.test(ok.xml), true);
eq('XML: TVA 31.48', /<cbc:TaxAmount currencyID="RON">31\.48</.test(ok.xml), true);
eq('XML: furnizorul plătitor de TVA, cu IBAN', ok.xml.includes('<cbc:CompanyID>RO18547290</cbc:CompanyID>') && ok.xml.includes('RO49AAAA1B31007593840000'), true);

// Storno: the same lines with negative quantities and totals (as Business writes it), as an invoice (380).
const st = { ...f, numar: 101, scadenta: null, storno_de: 'x', nota: 'Stornează factura KGB 100',
  linii: f.linii.map((l) => ({ ...l, cantitate: -l.cantitate, valoare: -l.valoare, tva: -l.tva })), total_fara_tva: -19750, total_tva: -3148, total: -22898 };
const sx = M.buildEfactura(st, places, units);
eq('stornarea: fără greșeli', sx.errors, []);
eq('stornarea: total de plată -228.98, tip 380, nota', /<cbc:PayableAmount currencyID="RON">-228\.98</.test(sx.xml ?? '') && (sx.xml ?? '').includes('<cbc:InvoiceTypeCode>380') && (sx.xml ?? '').includes('Stornează factura KGB 100'), true);

// VAT per line (Business) ≠ VAT per rate (e-Factura): 0,03 + 0,03 at 21% → 0,01 + 0,01 per line, 0,01 per rate.
const tiny = { ...f, linii: [
  { descriere: 'Șurub', um: 'buc', cantitate: 1000, pret_unitar: 3, cota_tva: 21, valoare: 3, tva: 1 },
  { descriere: 'Piuliță', um: 'buc', cantitate: 1000, pret_unitar: 3, cota_tva: 21, valoare: 3, tva: 1 },
], total_fara_tva: 6, total_tva: 2, total: 8 };
const tx = M.buildEfactura(tiny, places);
eq('sume diferite: fișierul nu se scrie, cu motivul', tx.xml === null && tx.errors.length === 1 && tx.errors[0].includes('pe fiecare cotă'), true);

console.log(fail ? `${fail} greșite` : 'ok: toate');
process.exit(fail ? 1 : 0);
