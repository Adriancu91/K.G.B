// Etapa 7 step 7.4j, end to end in the real window: the tools taken from the
// owner's ERP (ideas only, code written in K.G.B.).
// - Ctrl+K opens the quick search; a few letters and Enter open the page;
// - partners imported from the XLSX import model (the Windows file dialogs
//   are skipped: the commands they lead to are called directly);
// - bank payments matched to invoices: the sure one is selected and confirmed;
// - an e-Factura XML becomes an expense;
// - the monthly package for the accountant is written as a ZIP;
// - the daily backup is made once and shown in „Date și backup”.
//
// Usage: node app/e2e/tools.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node tools.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-tools-"));
const files = mkdtempSync(join(tmpdir(), "kgb-tools-files-"));
const PORT = 9358;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const biz = (p, command, args = {}) => invoke(p, "module_call", { id: "kgb.business", command, args });
const iso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const UBL = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:ID>FT-77</cbc:ID><cbc:IssueDate>2026-11-04</cbc:IssueDate><cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyTaxScheme><cbc:CompanyID>RO18547290</cbc:CompanyID></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>Furnizor e-Factura SRL</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
<cac:TaxTotal><cbc:TaxAmount currencyID="RON">21.00</cbc:TaxAmount></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID="RON">100.00</cbc:TaxExclusiveAmount><cbc:PayableAmount currencyID="RON">121.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;

try {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);

  // Ctrl+K.
  await p.eval("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))");
  await p.until("!!document.querySelector('.quick-search input')", 3000);
  await p.fill(".quick-search input", "surse");
  await p.until("document.querySelector('.qs-list').innerText.includes('Surse externe')", 3000);
  await p.screenshot(join(shots, "01-ctrl-k.png"));
  await p.eval("document.querySelector('.quick-search input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))");
  await p.until("document.querySelector('.page-head h1')?.innerText === 'Surse externe'", 3000);
  check("Ctrl+K, câteva litere și Enter deschid pagina", !(await p.eval("!!document.querySelector('.quick-search')")));

  // Partner import from the model.
  const model = join(files, "model.xlsx");
  await invoke(p, "partners_import_model", { dest: model });
  check("modelul de import se descarcă (XLSX)", readFileSync(model).subarray(0, 2).toString("latin1") === "PK");
  const rep = await invoke(p, "partners_import", { path: model, azi: iso() });
  check("importul din model: 1 partener nou, câmpul în plus păstrat", rep.adaugate === 1 && rep.erori.length === 0, JSON.stringify(rep));
  await p.eval("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))");
  await p.until("!!document.querySelector('.quick-search input')", 3000);
  await p.fill(".quick-search input", "exemplu");
  await p.until("document.querySelector('.qs-list').innerText.includes('Exemplu Client SRL')", 5000);
  await p.eval("[...document.querySelectorAll('.qs-list button')].find(b => b.innerText.includes('Exemplu Client SRL')).click()");
  await p.until("document.querySelector(\"input[aria-label='Denumire']\")?.value === 'Exemplu Client SRL'", 5000);
  check("Ctrl+K găsește partenerul și îi deschide fișa", true);
  await p.click("Renunță");

  // Business: enable, an invoice, a bank statement, matching.
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Business'))";
  await p.until(`!!${card}`, 5000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Business'))", 5000);
  await biz(p, "settings_save", { firma: { firma_nume: "Noi SRL", firma_cui: "RO14399840", firma_adresa: "Iași" } });
  const series = await biz(p, "series_save", { cod: "F" });
  const client = await biz(p, "partner_save", { nume: "Alfa Construct SRL", cui: "RO18547290", tip: "ambele" });
  await biz(p, "invoice_issue", { serie: series.id, partener: client.id, data: "2026-11-02", linii: [{ descriere: "Servicii", cantitate: "1", pret_unitar: "1000", cota_tva: 21 }] });
  const bank = await biz(p, "account_save", { tip: "banca", nume: "Banca X" });
  const csv = join(files, "extras.csv");
  writeFileSync(csv, "Data;Descriere;Debit;Credit\r\n05.11.2026;OP 18547290 Alfa Construct factura F 1;;1.210,00\r\n");
  await invoke(p, "module_import_file_with", { id: "kgb.business", path: csv, command: "bank_import", args: { cont: bank.id } });
  await p.click("Business", "nav .nav");
  await p.click("Casă și bancă", "button");
  await p.until("!!document.querySelector('.match-panel')", 8000);
  const panel = await p.eval("document.querySelector('.match-panel').innerText");
  check("potrivirea propune factura, „sigură”, cu scor și motive", panel.includes("sigură") && panel.includes("scor") && panel.includes("numărul documentului"), panel.split("\n").slice(3, 6).join(" | "));
  await p.screenshot(join(shots, "02-potrivire.png"));
  await p.click("Selectează potrivirile sigure", ".match-panel button");
  await p.click("Confirmă selectatele", ".match-panel button");
  await p.until("!document.querySelector('.match-panel') || document.body.innerText.includes('plăți legate de documente')", 5000);
  const open = await biz(p, "open_documents");
  check("după confirmare factura e încasată", open.filter((d) => d.tip === "factura").length === 0, JSON.stringify(open));

  // One payment split over two invoices (7.4j-2): 1.000 lei for F 2 (605) and F 3 (395 of 1.210).
  const f2 = await biz(p, "invoice_issue", { serie: series.id, partener: client.id, data: "2026-11-06", linii: [{ descriere: "A", cantitate: "1", pret_unitar: "500", cota_tva: 21 }] });
  const f3 = await biz(p, "invoice_issue", { serie: series.id, partener: client.id, data: "2026-11-07", linii: [{ descriere: "B", cantitate: "1", pret_unitar: "1000", cota_tva: 21 }] });
  const pay = await biz(p, "payment_save", { cont: bank.id, data: "2026-11-08", sens: "incasare", suma: "1.000,00" });
  await biz(p, "payment_link", { plata: pay.id, document: { tip: "factura", id: f2.id }, suma: "605,00" });
  await biz(p, "payment_link", { plata: pay.id, document: { tip: "factura", id: f3.id } });
  const rest = (await biz(p, "open_documents")).find((d) => d.id === f3.id)?.rest;
  check("o plată împărțită pe două facturi: F 2 achitată, F 3 cu restul", rest === 81_500 && !(await biz(p, "open_documents")).some((d) => d.id === f2.id), String(rest));
  await p.click("Stoc", ".sheet-tabs button, button");
  await p.click("Casă și bancă", "button");
  await p.until("document.body.innerText.includes('achită 2 documente')", 8000);
  check("lista plăților arată „achită 2 documente”", true);

  // e-Factura.
  const xml = join(files, "FT-77.xml");
  writeFileSync(xml, UBL);
  const ef = await invoke(p, "module_import_file_with", { id: "kgb.business", path: xml, command: "efactura_import", args: {} });
  check("factura e-Factura devine cheltuială", ef[0]?.ok === true && ef[0].total_text === "121,00", JSON.stringify(ef));

  // The monthly package.
  const zip = join(files, "pachet.zip");
  const pk = await biz(p, "accountant_package", { luna: "2026-11", dest: zip });
  check("pachetul lunar pentru contabil se scrie (ZIP)", existsSync(zip) && readFileSync(zip).subarray(0, 2).toString("latin1") === "PK" && pk.facturi === 3 && pk.cheltuieli === 1, JSON.stringify(pk));

  // The daily backup.
  await invoke(p, "reminders_tick", { azi: iso() });
  await invoke(p, "reminders_tick", { azi: iso() });
  await p.click("Date și backup", "nav .nav");
  await p.until("document.querySelector('main').innerText.includes('zilnic')", 8000);
  const n = await p.eval("(document.querySelector('main').innerText.match(/zilnic/g) || []).length");
  check("copia zilnică apare o singură dată pe zi", n === 1, String(n));

  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc?.pid)], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
} finally {
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
  rmSync(files, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
