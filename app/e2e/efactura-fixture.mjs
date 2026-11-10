// The e-Factura of cos-efactura.mjs (7.4m-1): a made-up invoice (no real firm, the CUIs only have a correct
// check digit) written as UBL by the COS code itself (cos/src/sheets/efacturaOut.ts, the same invoice as
// cos/tests/efactura-out.test.mjs). Prints the XML.
// Use (in app/): node --import ./cos/hooks.mjs e2e/efactura-fixture.mjs
const { invoiceUbl, validateInvoice } = await import("../cos/src/sheets/efacturaOut.ts");
const { validCui } = await import("../cos/src/sheets/ids.ts");

const cuiWith = (base) => {
  for (let d = 0; d < 10; d++) if (validCui(base + d)) return base + d;
  throw new Error(`no check digit for ${base}`);
};
const inv = {
  series: "ABC",
  number: "0042",
  issueDate: "2026-10-26",
  dueDate: "2026-11-25",
  supplier: {
    name: "Firma Noastră SRL",
    cui: cuiWith("1854729"),
    vatPayer: true,
    regCom: "J12/345/2020",
    street: "Str. Memorandumului nr. 1",
    city: "Cluj-Napoca",
    county: "Cluj",
    postal: "400114",
    iban: "RO49 AAAA 1B31 0075 9384 0000",
    bank: "Banca de test",
  },
  customer: { name: "Client & Fiii SA", cui: "RO" + cuiWith("3062580"), vatPayer: true, street: "Bd. Unirii nr. 10", city: "Sector 3", county: "București" },
  lines: [
    { name: "Laptop", unit: "buc", qty: 2, price: 3199.99, vat: 21 },
    { name: "Carte tehnică", unit: "buc", qty: 3, price: 45.5, vat: 11 },
    { name: "Montaj", description: "Instalare la sediu", unit: "ore", qty: 1.5, price: 120, vat: 21 },
  ],
  notes: ["Mulțumim pentru colaborare!"],
};
const errs = validateInvoice(inv);
if (errs.length) throw new Error(errs.join("; "));
process.stdout.write(invoiceUbl(inv));
