// 7.10b, end to end in the real window: a supplier's receipt (chitanță) of „Depozitul de documente” recorded in the
// cash register of Business. The vault reads the series and number, the day, the sum and what it was for; since the
// issuer's CUI is not the firm's, it is a payment; the form comes filled in and the person records it. Opened a
// second time, the form says the receipt is already in Business. Then the stock: the lines of a purchase
// e-Factura become a reception (NIR) in Business — one line matched to a product already there by the supplier's
// code, the other added as a new product — and opened again, the form says the reception is already there.
//
// Usage: node app/e2e/vault-cash.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR) and a throw-away documents folder, never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node vault-cash.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-vcash-"));
const docs = mkdtempSync(join(tmpdir(), "kgb-vcash-docs-"));
const PORT = 9373;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const call = (p, id, command, args = {}) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id, command, args })}).then(r => r, e => ({ error: String(e) }))`);

mkdirSync(join(docs, "Chitante"), { recursive: true });
mkdirSync(join(docs, "Facturi", "primite"), { recursive: true });
writeFileSync(
  join(docs, "Facturi", "primite", "F 77.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:cac" xmlns:cbc="urn:cbc">
  <cbc:ID>F 0077</cbc:ID><cbc:IssueDate>2026-11-03</cbc:IssueDate>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Beta Materiale SRL</cbc:RegistrationName><cbc:CompanyID>RO18547290</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Noi Construct SRL</cbc:RegistrationName><cbc:CompanyID>RO14399840</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="RON">381.15</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="KGM">25.5</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="RON">255.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Ciment vrac</cbc:Name><cac:SellersItemIdentification><cbc:ID>CIM40</cbc:ID></cac:SellersItemIdentification></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="RON">10.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
  <cac:InvoiceLine><cbc:ID>2</cbc:ID><cbc:InvoicedQuantity unitCode="H87">3</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="RON">60.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Mistrie inox</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="RON">20.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
</Invoice>`,
);
writeFileSync(
  join(docs, "Chitante", "chitanta BM 45.txt"),
  "BETA MATERIALE SRL\nCUI RO18547290\nCHITANȚĂ seria BM nr. 0045 din 05.11.2026\nAm primit de la NOI CONSTRUCT S.R.L., CUI 14399840,\nsuma de 595,00 lei\nreprezentând contravaloarea facturii F 77\n",
);

async function enable(p, name) {
  await p.click("Catalog module", "nav .nav");
  const card = `[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === ${JSON.stringify(name)})`;
  await p.until(`!!${card}`, 8000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until(`[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith(${JSON.stringify(name)}))`, 8000);
}

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  for (const m of ["Depozitul de documente", "Business"]) await enable(p, m);
  // A cash register with money in it (a payment cannot take it below zero) and the firm's CUI in the vault.
  const acc = await call(p, "kgb.business", "account_save", { tip: "casa", nume: "Casa principală" });
  await call(p, "kgb.business", "payment_save", { cont: acc.id, data: "2026-11-01", sens: "incasare", suma: "1.000,00", explicatie: "sold inițial de test" });
  await call(p, "kgb.vault", "setari_save", { cui_firma: "14399840" });
  // A warehouse and one product already known by the supplier's code.
  await call(p, "kgb.business", "warehouse_save", { nume: "Depozit central" });
  await call(p, "kgb.business", "product_save", { cod: "CIM40", nume: "Ciment 40 kg", um: "kg" });

  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Depozitul de documente')).click()");
  await p.until("!!document.querySelector('.vault')", 8000);
  await p.eval(`window.__kgbE2eFolder = ${JSON.stringify(docs)}`);
  await p.click("Adaugă un folder…", ".vault button");
  await p.until("document.querySelectorAll('[data-testid=vault-doc]').length === 2", 20000);
  const l = await call(p, "kgb.vault", "lista", {});
  const receipt = l.find((d) => d.nume.startsWith("chitanta"));
  const inv = l.find((d) => d.nume.startsWith("F 77"));
  if (receipt.categorie !== "chitante_nir" || inv.categorie !== "facturi_achizitie") {
    if (receipt.categorie !== "chitante_nir") await call(p, "kgb.vault", "confirma", { id: receipt.id, version: receipt.version, categorie: "chitante_nir" });
    if (inv.categorie !== "facturi_achizitie") await call(p, "kgb.vault", "confirma", { id: inv.id, version: inv.version, categorie: "facturi_achizitie" });
    // The page reads the list again when it is opened again.
    await p.click("Catalog module", "nav .nav");
    await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Depozitul de documente')).click()");
    await p.until("document.querySelectorAll('[data-testid=vault-doc]').length === 2", 8000);
  }
  const row = "[...document.querySelectorAll('[data-testid=vault-doc]')].find(r => r.innerText.includes('chitanta'))";
  await p.until(`[...${row}.querySelectorAll('button')].some(b => b.textContent.includes('Înregistrează în casă'))`, 10000);
  await p.eval(`[...${row}.querySelectorAll('button')].find(b => b.textContent.includes('Înregistrează în casă')).click()`);
  await p.until("!!document.querySelector('form[aria-label=\"Înregistrează în casă\"] [aria-label=\"Suma\"]')", 10000);
  const form = await p.eval(`(() => { const f = document.querySelector('form[aria-label="Înregistrează în casă"]'); const v = (l) => f.querySelector('[aria-label="' + l + '"]').value; return { sens: v('Sensul'), data: v('Data chitanței'), suma: v('Suma'), numar: v('Numărul chitanței'), expl: v('Explicația'), dup: !!f.querySelector('.vault-dup') }; })()`);
  check(
    "formularul vine completat: plată (chitanța e a furnizorului), data, suma, numărul, explicația",
    form.sens === "plata" && form.data === "2026-11-05" && form.suma === "595,00" && form.numar === "Chitanța BM 0045" && form.expl === "contravaloarea facturii F 77" && !form.dup,
    JSON.stringify(form),
  );
  await p.screenshot(join(shots, "01-chitanta.png"));
  await p.click("Înregistrează", "form[aria-label=\"Înregistrează în casă\"] button");
  await p.until("(document.querySelector('.vault')?.innerText ?? '').includes('e înregistrată în casă')", 10000);
  const pays = await call(p, "kgb.business", "payments");
  const paid = pays.filter((x) => x.sens === "plata");
  check("casa are plata de 595,00 lei, cu numărul chitanței", paid.length === 1 && paid[0].suma === 59500 && paid[0].numar === "Chitanța BM 0045" && paid[0].data === "2026-11-05", JSON.stringify(paid.map((x) => [x.numar, x.suma, x.data])));
  await p.eval(`[...${row}.querySelectorAll('button')].find(b => b.textContent.includes('Înregistrează în casă')).click()`);
  await p.until("!!document.querySelector('form[aria-label=\"Înregistrează în casă\"] .vault-dup')", 10000);
  check("a doua oară, formularul spune că e deja în Business", (await p.eval("document.querySelector('form[aria-label=\"Înregistrează în casă\"] .vault-dup').innerText")).includes("Chitanța BM 0045"));
  await p.screenshot(join(shots, "02-deja.png"));
  await p.click("Renunță", "form[aria-label=\"Înregistrează în casă\"] button");

  // The stock from the purchase e-Factura.
  const invRow = "[...document.querySelectorAll('[data-testid=vault-doc]')].find(r => r.innerText.includes('F 77'))";
  await p.until(`[...${invRow}.querySelectorAll('button')].some(b => b.textContent.includes('Recepție în stoc'))`, 10000);
  await p.eval(`[...${invRow}.querySelectorAll('button')].find(b => b.textContent.includes('Recepție în stoc')).click()`);
  await p.until("!!document.querySelector('form[aria-label=\"Recepție în stoc\"] tbody tr')", 10000);
  const stock = await p.eval(`(() => { const f = document.querySelector('form[aria-label="Recepție în stoc"]'); const sel = [...f.querySelectorAll(':scope table tbody select')].map(s => s.options[s.selectedIndex].text); const q = (l) => f.querySelector('[aria-label="' + l + '"]')?.value; return { sel, nr: q('Numărul recepției'), data: q('Data recepției'), q1: q('Cantitatea pentru Ciment vrac'), p1: q('Prețul pentru Ciment vrac'), cod2: q('Codul produsului nou Mistrie inox'), um2: q('UM pentru Mistrie inox') }; })()`);
  check(
    "liniile facturii: cimentul găsit după codul furnizorului, mistria ca produs nou (cod, UM buc), cantitățile și prețurile",
    stock.sel[0] === "Ciment 40 kg (CIM40)" && stock.sel[1] === "(produs nou)" && stock.nr === "NIR F 77" && stock.data === "2026-11-03" && stock.q1 === "25,5" && stock.p1 === "10,00" && stock.cod2 === "MISTRIEINOX" && stock.um2 === "buc",
    JSON.stringify(stock),
  );
  await p.screenshot(join(shots, "03-receptie.png"));
  await p.click("Înregistrează recepția", "form[aria-label=\"Recepție în stoc\"] button");
  await p.until("(document.querySelector('.vault')?.innerText ?? '').includes('e înregistrată în Business')", 10000);
  const prods = await call(p, "kgb.business", "products");
  const sdocs = await call(p, "kgb.business", "documents");
  check(
    "Business are recepția NIR F 77 și produsul nou",
    sdocs.some((d) => d.numar === "NIR F 77") && prods.length === 2 && prods.some((x) => x.cod === "MISTRIEINOX" && x.nume === "Mistrie inox" && x.um === "buc"),
    JSON.stringify({ docs: sdocs.map((d) => d.numar), prods: prods.map((x) => [x.cod, x.um]) }),
  );
  await p.eval(`[...${invRow}.querySelectorAll('button')].find(b => b.textContent.includes('Recepție în stoc')).click()`);
  await p.until("!!document.querySelector('form[aria-label=\"Recepție în stoc\"] .vault-dup')", 10000);
  check("a doua oară, formularul spune că recepția e deja în Business", true);
  p.close();
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
} finally {
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc?.pid)], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
  rmSync(docs, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
