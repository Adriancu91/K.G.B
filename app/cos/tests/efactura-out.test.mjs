// Test rapid pentru facturi → e-Factura (src/sheets/efacturaOut.ts): sumele pe cote de TVA, verificarea locală (CUI, județ,
// sector, unități, scutiri) și dus-întors: XML-ul scris de noi e citit identic de cititorul din modulul PDF (pdf/efactura.ts).
// Rulare (în suite/): node tests/efactura-out.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';

const stub = { name: 'stub', setup(b) {
  b.onResolve({ filter: /\?url$|^pdf-lib$|^@pdf-lib\/fontkit$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default ""; export const PDFDocument = {}; export const rgb = () => 0;', loader: 'js' }));
} };
const out = join(tmpdir(), `suite-efo-${process.pid}.mjs`);
await build({ stdin: { contents: "export * from './src/sheets/efacturaOut.ts'; export { parseInvoice } from './src/pdf/efactura.ts'; export { validCui } from './src/sheets/ids.ts'; export { amountWords } from './src/sheets/words.ts'; export { readUbl } from './src/sheets/efacturaIn.ts'; export { invoiceToCells, readInvoice } from './src/sheets/invoiceSheet.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', plugins: [stub] });
const M = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// Cititorul folosește DOMParser și `children` (din browser); în Node le dăm din @xmldom/xmldom.
globalThis.DOMParser = DOMParser;
const probe = new DOMParser().parseFromString('<a><b/></a>', 'application/xml').documentElement;
const ElProto = Object.getPrototypeOf(probe);
if (!('children' in probe)) Object.defineProperty(ElProto, 'children', { get() { return Array.from({ length: this.childNodes.length }, (_, i) => this.childNodes.item(i)).filter((n) => n.nodeType === 1); } });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GRESIT: ') + m); if (!c) fail++; };

// Un CUI cu cifra de control corectă, pentru furnizor și client.
const cuiWith = (base) => { for (let d = 0; d < 10; d++) if (M.validCui(base + d)) return base + d; };
const cuiA = cuiWith('1854729'), cuiB = cuiWith('3062580');
ok(M.validCui(cuiA) && M.validCui(cuiB), `CUI-uri de test valide: ${cuiA}, ${cuiB}`);

const inv = {
  series: 'ABC', number: '0042', issueDate: '2026-10-26', dueDate: '2026-11-25',
  supplier: { name: 'Firma Noastră SRL', cui: cuiA, vatPayer: true, regCom: 'J12/345/2020', street: 'Str. Memorandumului nr. 1', city: 'Cluj-Napoca', county: 'Cluj', postal: '400114', phone: '0264 000 000', email: 'office@firma.ro', iban: 'RO49 AAAA 1B31 0075 9384 0000', bank: 'Banca de test' },
  customer: { name: 'Client & Fiii SA', cui: 'RO' + cuiB, vatPayer: true, street: 'Bd. Unirii nr. 10', city: 'Sector 3', county: 'București' },
  lines: [
    { name: 'Laptop', unit: 'buc', qty: 2, price: 3199.99, vat: 21 },
    { name: 'Carte tehnică', unit: 'buc', qty: 3, price: 45.5, vat: 11 },
    { name: 'Montaj', description: 'Instalare la sediu', unit: 'ore', qty: 1.5, price: 120, vat: 21 },
  ],
  notes: ['Mulțumim pentru colaborare!'],
};

// Sumele: 6399,98 + 180 = 6579,98 la 21%; 136,50 la 11%.
const t = M.invoiceTotals(inv);
ok(t.net === 6716.48, 'total fără TVA 6716,48: ' + t.net);
const v21 = t.vat.find((g) => g.pct === 21), v11 = t.vat.find((g) => g.pct === 11);
ok(v21.base === 6579.98 && v21.amount === 1381.80, 'TVA 21%: bază 6579,98, TVA 1381,80: ' + JSON.stringify(v21));
ok(v11.base === 136.5 && v11.amount === 15.02, 'TVA 11%: bază 136,50, TVA 15,02: ' + JSON.stringify(v11));
ok(t.gross === 8113.3, 'total de plată 8113,30: ' + t.gross);

ok(M.validateInvoice(inv).length === 0, 'factura bună nu are greșeli: ' + JSON.stringify(M.validateInvoice(inv)));
const bad = structuredClone(inv);
bad.supplier.cui = '18547291' === cuiA ? '18547292' : '18547291';
bad.customer.city = 'București';
bad.customer.county = 'Atlantida';
bad.lines[0].unit = 'cutiuțe';
bad.lines[1].vat = 'E';
bad.issueDate = '26.10.2026';
const errs = M.validateInvoice(bad);
console.log(errs.join('\n'));
ok(errs.some((e) => e.startsWith('Furnizor: CUI-ul')), 'CUI greșit prins');
ok(errs.some((e) => e.includes('județul „Atlantida”')), 'județ necunoscut prins');
ok(errs.some((e) => e.includes('unitatea de măsură „cutiuțe”')), 'unitate necunoscută prinsă');
ok(errs.some((e) => e.includes('motivul scutirii')), 'scutire fără motiv prinsă');
ok(errs.some((e) => e.includes('AAAA-LL-ZZ')), 'data greșită prinsă');
const buc = structuredClone(inv); buc.customer.city = 'București';
ok(M.validateInvoice(buc).some((e) => e.includes('sector')), 'în București se cere sectorul');

// XML-ul și dus-întors.
const xml = M.invoiceUbl(inv);
ok(xml.includes('CIUS-RO:1.0.1') && xml.includes('<cbc:CountrySubentity>RO-CJ</cbc:CountrySubentity>') && xml.includes('<cbc:CityName>SECTOR3</cbc:CityName>'), 'XML: CIUS-RO, RO-CJ, SECTOR3');
ok(xml.includes(`<cbc:CompanyID>RO${cuiA}</cbc:CompanyID>`) && xml.includes('Client &amp; Fiii SA'), 'XML: cod TVA cu RO, caractere speciale scăpate');
ok(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length === 0, 'XML-ul e bine format');
const back = M.parseInvoice(xml);
ok(back.id === 'ABC 0042' && back.issueDate === '26.10.2026' && back.dueDate === '25.11.2026', 'citit înapoi: număr și date');
ok(back.supplier.name === 'Firma Noastră SRL' && back.supplier.cui === 'RO' + cuiA && back.supplier.regCom === 'J12/345/2020', 'citit înapoi: furnizorul');
ok(back.supplier.address.join(' | ') === 'Str. Memorandumului nr. 1 | Cluj-Napoca, jud. Cluj, 400114', 'citit înapoi: adresa furnizorului: ' + back.supplier.address.join(' | '));
ok(back.customer.address.join(' | ') === 'Bd. Unirii nr. 10 | Sector 3, București', 'citit înapoi: clientul din București: ' + back.customer.address.join(' | '));
ok(back.lines.length === 3 && back.lines[2].unit === 'ore' && back.lines[2].qty === 1.5 && back.lines[2].value === 180 && back.lines[2].description === 'Instalare la sediu', 'citit înapoi: liniile');
ok(back.lines[0].price === 3199.99 && back.lines[0].vat === '21%' && back.lines[1].vat === '11%', 'citit înapoi: prețuri și cote');
ok(back.vat.map((g) => g.label).join(',') === 'TVA 21%,TVA 11%' && back.totals.vat === 1396.82 && back.totals.payable === 8113.3, 'citit înapoi: TVA și total de plată: ' + JSON.stringify(back.totals));
ok(back.payment[0] === 'IBAN RO49AAAA1B31007593840000, Banca de test' && back.notes[0] === 'Mulțumim pentru colaborare!', 'citit înapoi: IBAN și nota');

// Neplătitor de TVA: categoria O, fără cod de TVA, fără TVA.
const novat = structuredClone(inv); novat.supplier.vatPayer = false;
const x2 = M.invoiceUbl(novat), b2 = M.parseInvoice(x2);
ok(!x2.includes('<cac:PartyTaxScheme>\n      <cbc:CompanyID>RO' + cuiA) && x2.includes('<cbc:ID>O</cbc:ID>') && b2.totals.vat === 0 && b2.totals.payable === 6716.48, 'neplătitor de TVA: categoria O, total 6716,48');
ok(b2.supplier.cui === cuiA, 'neplătitor de TVA: CUI fără RO: ' + b2.supplier.cui);

// Factură în euro: moneda, cursul BNR, TVA-ul și în lei (TaxCurrencyCode RON + al doilea TaxTotal).
const eur = structuredClone(inv); eur.currency = 'EUR';
ok(M.validateInvoice(eur).some((e) => e.includes('cursul BNR')), 'în EUR fără curs: se cere cursul BNR');
eur.exchangeRate = 4.9751;
ok(M.validateInvoice(eur).length === 0, 'în EUR cu curs: fără greșeli');
const usd = structuredClone(inv); usd.currency = 'XYZ';
ok(M.validateInvoice(usd).some((e) => e.includes('Moneda „XYZ”')), 'monedă necunoscută prinsă');
const x3 = M.invoiceUbl(eur), b3 = M.parseInvoice(x3);
ok(new DOMParser().parseFromString(x3, 'application/xml').getElementsByTagName('parsererror').length === 0, 'EUR: XML bine format');
ok(x3.includes('<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n  <cbc:TaxCurrencyCode>RON</cbc:TaxCurrencyCode>'), 'EUR: TaxCurrencyCode RON după moneda facturii');
ok(x3.includes('<cbc:TaxAmount currencyID="RON">6949.32</cbc:TaxAmount>'), 'EUR: TVA în lei 1396,82 × 4,9751 = 6949,32');
ok(b3.currency === 'EUR' && b3.totals.vat === 1396.82 && b3.totals.payable === 8113.3 && b3.vatInLei === 6949.32, 'EUR citit înapoi: moneda, TVA, total, TVA în lei: ' + b3.vatInLei);
ok(b3.notes.includes('Curs BNR: 1 EUR = 4,9751 lei'), 'EUR: nota cu cursul');

// XML → foaie Factură → XML: aceleași sume, aceiași parteneri (Import e-Factura în Sheets).
for (const [nm, src] of [['RON', inv], ['EUR', eur]]) {
  const r = M.readUbl(M.invoiceUbl(src));
  const again = M.readInvoice(M.invoiceToCells(r.invoice));
  ok(r.warnings.length === 0, nm + ': citit fără avertismente: ' + JSON.stringify(r.warnings));
  ok(again.series === 'ABC' && again.number === '0042' && again.issueDate === '2026-10-26' && again.dueDate === '2026-11-25', nm + ': serie, număr, date: ' + JSON.stringify([again.series, again.number, again.issueDate, again.dueDate]));
  ok(again.customer.city === 'Sector 3' && again.customer.county === 'B' && again.supplier.county === 'CJ' && again.supplier.regCom === 'J12/345/2020', nm + ': adrese (Sector 3, B, CJ) și Reg. Com.');
  ok(again.supplier.iban === 'RO49AAAA1B31007593840000' && again.supplier.vatPayer && again.customer.cui === 'RO' + cuiB, nm + ': IBAN, plătitor de TVA, CUI client');
  ok(M.validateInvoice(again).length === 0, nm + ': foaia adusă trece verificarea: ' + JSON.stringify(M.validateInvoice(again)));
  const t2 = M.invoiceTotals(again), t1 = M.invoiceTotals(src);
  ok(t2.net === t1.net && t2.vatSum === t1.vatSum && t2.gross === t1.gross, nm + ': aceleași totaluri ' + t2.gross);
  ok(again.currency === nm && (nm === 'RON' || again.exchangeRate === 4.9751), nm + ': moneda și cursul');
  ok(JSON.stringify(again.notes) === JSON.stringify(['Mulțumim pentru colaborare!']), nm + ': nota păstrată, fără nota cursului: ' + JSON.stringify(again.notes));
}
// O factură din altă parte: cotă veche 19%, reducere pe total, fără spațiu în număr.
const old = M.invoiceUbl(inv).replace('<cbc:ID>ABC 0042</cbc:ID>', '<cbc:ID>FCT123</cbc:ID>').replace(/<cbc:Percent>21<\/cbc:Percent>/g, '<cbc:Percent>19</cbc:Percent>')
  .replace('<cac:TaxTotal>', '<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:Amount currencyID="RON">10</cbc:Amount></cac:AllowanceCharge>\n  <cac:TaxTotal>');
const ro = M.readUbl(old);
ok(ro.invoice.series === 'FCT' && ro.invoice.number === '123', 'FCT123 → seria FCT, numărul 123');
ok(ro.warnings.some((w) => w.includes('19%')) && ro.warnings.some((w) => w.includes('reduceri sau taxe pe total')), 'avertismente: cota 19% și reducerea pe total: ' + JSON.stringify(ro.warnings));
let thrown = ''; try { M.readUbl('<a/>'); } catch (e) { thrown = e.message; }
ok(thrown.includes('nu e o factură electronică'), 'XML care nu e factură: mesaj clar');

// Suma în litere în alte monede.
ok(M.amountWords(125.5) === 'o sută douăzeci și cinci de lei și cincizeci de bani' || M.amountWords(125.5) === 'o sută douăzeci și cinci lei și cincizeci de bani', 'lei: ' + M.amountWords(125.5));
ok(M.amountWords(1, 'EUR') === 'un euro' && M.amountWords(21.01, 'EUR') === 'douăzeci și unu de euro și un eurocent', 'EUR: ' + M.amountWords(21.01, 'EUR'));
ok(M.amountWords(2, 'GBP') === 'două lire sterline' && M.amountWords(1, 'GBP') === 'o liră sterlină', 'GBP la feminin: ' + M.amountWords(2, 'GBP'));
ok(M.amountWords(1, 'XYZ') === null, 'monedă necunoscută → null');

console.log(fail ? `ESUAT (${fail})` : 'TOTUL OK');
process.exit(fail ? 1 : 0);
