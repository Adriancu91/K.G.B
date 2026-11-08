// Etapa 5 step 5.1, end to end in the real window: Business — products,
// warehouses, a receipt with two lines, an issue above the stock refused, an
// issue that leaves the stock under its minimum, a storno, a forced restart.
//
// Usage: node app/e2e/business.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node business.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-business-"));
const PORT = 9344;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const stockRows = (p) =>
  p.eval("[...document.querySelectorAll('.stock-table tbody tr')].map(r => [...r.cells].map(c => c.innerText.trim()).join('|'))");
const selectByText = (p, sel, text) =>
  p.eval(`(() => { const s = document.querySelector(${JSON.stringify(sel)});
    const o = [...s.options].find(o => o.textContent.includes(${JSON.stringify(text)}));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value);
    s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  return p;
}
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}
const tab = (p, label) => p.eval(`[...document.querySelectorAll('.business .sheet-tabs button')].find(b => b.innerText.startsWith(${JSON.stringify(label)})).click()`);

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Business')";
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Business'))");
  await p.click("Business", "nav .nav");
  await p.until("!!document.querySelector('.business')");
  check("pagina spune clar că e evidență primară", (await p.eval("document.querySelector('.business .warn').innerText")).includes("nu contabilitate certificată"));

  await tab(p, "Depozite");
  for (const n of ["Depozit central", "Șantier Iași"]) {
    await p.fill("input[aria-label='Nume depozit']", n);
    await p.click("Adaugă depozitul");
    await p.until(`document.body.innerText.includes(${JSON.stringify(n)})`);
  }
  await tab(p, "Produse");
  for (const [cod, nume, um, min] of [["CIM-40", "Ciment 40 kg", "sac", "10"], ["SRB-6", "Șurub 6 mm", "kg", ""]]) {
    await p.fill("input[aria-label='Cod produs']", cod);
    await p.fill("input[aria-label='Nume produs']", nume);
    await p.fill("input[aria-label='Unitate de măsură']", um);
    await p.fill("input[aria-label='Stoc minim']", min);
    await p.click("Adaugă produsul");
    await p.until(`document.body.innerText.includes(${JSON.stringify(nume)})`);
  }
  check("2 depozite și 2 produse", (await p.eval("document.querySelectorAll('.business table.audit tbody tr').length")) === 2);

  // Receipt with two lines.
  await tab(p, "Recepție nouă");
  await p.until("!!document.querySelector('.stock-doc')");
  await selectByText(p, "select[aria-label='Depozit']", "Depozit central");
  await p.fill("input[aria-label='Numărul documentului']", "NIR 1");
  await p.fill("input[aria-label='Furnizor']", "Furnizor SRL");
  await selectByText(p, "select[aria-label='Produsul 1']", "CIM-40");
  await p.fill("input[aria-label='Cantitatea 1']", "25");
  await p.fill("input[aria-label='Prețul 1']", "32,50");
  await p.click("+ Adaugă un produs", ".stock-doc button");
  await selectByText(p, "select[aria-label='Produsul 2']", "SRB-6");
  await p.fill("input[aria-label='Cantitatea 2']", "2,5");
  await p.fill("input[aria-label='Prețul 2']", "18");
  await p.screenshot(join(shots, "01-receptie.png"));
  await p.click("Înregistrează recepția", ".stock-doc button");
  await p.until("!!document.querySelector('.stock-table')", 8000);
  const s1 = await stockRows(p);
  check("recepția intră în stoc", JSON.stringify(s1.map((r) => r.split("|").slice(0, 5).join("|"))) === JSON.stringify(["CIM-40|Ciment 40 kg|Depozit central|25|sac", "SRB-6|Șurub 6 mm|Depozit central|2,5|kg"]), JSON.stringify(s1));

  // Issue above the stock: refused, the form stays with the message.
  await tab(p, "Ieșire nouă");
  await p.until("!!document.querySelector('.stock-doc')");
  await selectByText(p, "select[aria-label='Depozit']", "Depozit central");
  await p.fill("input[aria-label='Numărul documentului']", "BC 1");
  await selectByText(p, "select[aria-label='Produsul 1']", "CIM-40");
  await p.fill("input[aria-label='Cantitatea 1']", "30");
  await p.click("Înregistrează ieșirea", ".stock-doc button");
  await p.until("!!document.querySelector('.stock-doc [role=alert]')", 8000);
  const err = await p.eval("document.querySelector('.stock-doc [role=alert]').innerText");
  check("ieșirea peste stoc e refuzată și spune cât e", err.includes("în depozit sunt 25, se cer 30"), err);
  await p.fill("input[aria-label='Cantitatea 1']", "18");
  await p.click("Înregistrează ieșirea", ".stock-doc button");
  await p.until("!!document.querySelector('.stock-table')", 8000);
  const s2 = await stockRows(p);
  check("după ieșire: 7 saci, sub minim", s2[0]?.startsWith("CIM-40|Ciment 40 kg sub minim|Depozit central|7|sac") ?? false, JSON.stringify(s2));
  await p.screenshot(join(shots, "02-stoc.png"));

  // Storno of the issue: visible, the stock comes back.
  await tab(p, "Documente");
  await p.click("", "button[aria-label='Stornează BC 1']");
  await p.until("[...document.querySelectorAll('.stock-docs tbody tr')].length === 3", 8000);
  const docs = await p.eval("[...document.querySelectorAll('.stock-docs tbody tr')].map(r => r.cells[0].innerText + ' ' + r.cells[1].innerText)");
  check("stornoul apare ca document separat; originalul rămâne", docs.includes("Storno STORNO BC 1") && docs.includes("Ieșire BC 1") && docs.includes("Recepție NIR 1"), JSON.stringify(docs));
  await p.screenshot(join(shots, "03-documente.png"));

  // Step 5.2: value at weighted average cost, a transfer and an inventory.
  await tab(p, "Stoc");
  await p.until("!!document.querySelector('.stock-table tbody tr')", 8000);
  const v1 = await p.eval("[...document.querySelectorAll('.stock-table tbody tr')].map(r => r.cells[5].innerText + '|' + r.cells[6].innerText)");
  check("costul mediu și valoarea", JSON.stringify(v1) === JSON.stringify(["32,50|812,50", "18,00|45,00"]), JSON.stringify(v1));
  await tab(p, "Transfer");
  await p.until("!!document.querySelector('.stock-doc')");
  await selectByText(p, "select[aria-label='Din depozitul']", "Depozit central");
  await selectByText(p, "select[aria-label='În depozitul']", "Șantier Iași");
  await p.fill("input[aria-label='Numărul documentului']", "T 1");
  await selectByText(p, "select[aria-label='Produsul 1']", "CIM-40");
  await p.fill("input[aria-label='Cantitatea 1']", "5");
  await p.click("Înregistrează transferul", ".stock-doc button");
  await p.until("!!document.querySelector('.stock-table')", 8000);
  const s4 = await stockRows(p);
  check("transferul mută cantitatea și valoarea", s4.includes("CIM-40|Ciment 40 kg|Depozit central|20|sac|32,50|650,00") && s4.includes("CIM-40|Ciment 40 kg sub minim|Șantier Iași|5|sac|32,50|162,50"), JSON.stringify(s4));
  await tab(p, "Inventar");
  await p.until("!!document.querySelector('.inventory-table')");
  await selectByText(p, "select[aria-label='Depozit']", "Depozit central");
  await p.fill("input[aria-label='Numărul documentului']", "INV 1");
  await p.fill("input[aria-label='Numărat: Ciment 40 kg']", "19");
  await p.click("Înregistrează inventarul", ".stock-doc button");
  await p.until("document.body.innerText.includes('Diferențe: Ciment 40 kg -1')", 8000);
  check("inventarul înregistrează diferența", (await stockRows(p)).includes("CIM-40|Ciment 40 kg|Depozit central|19|sac|32,50|617,50"));
  await p.screenshot(join(shots, "04-valoare.png"));

  // Step 5.3: settings, a series, a client, an invoice that takes goods out
  // of stock, its PDF and its storno.
  await tab(p, "Facturare");
  await p.until("!!document.querySelector('.invoices')");
  const sub = (label) => p.eval(`[...document.querySelectorAll('.invoices .sheet-tabs button')].find(b => b.innerText.startsWith(${JSON.stringify(label)})).click()`);
  await sub("Setări facturare");
  await p.until("!!document.querySelector('.company-form')");
  for (const [k, v] of [["Denumire", "Kronos Global Business SRL"], ["CUI", "RO18547290"], ["Sediu", "Iași, Str. Lăpușneanu 1"], ["IBAN", "RO49AAAA1B31007593840000"]])
    await p.fill(`input[aria-label='Firma: ${k}']`, v);
  await p.click("Salvează setările", ".company-form button");
  await p.until("document.body.innerText.includes('Setările de facturare au fost salvate')", 8000);
  await p.fill("input[aria-label='Cod serie']", "KGB");
  await p.click("Adaugă seria", ".invoices button");
  await p.until("document.body.innerText.includes('KGB — următorul număr: 1')", 8000);
  await sub("Parteneri");
  await p.fill("input[aria-label='Nume partener']", "Client SRL");
  await p.fill("input[aria-label='CUI partener']", "RO12345675");
  await p.click("Adaugă partenerul", ".invoices button");
  await p.until("!!document.querySelector('.invoices [role=alert]')", 8000);
  check("un CUI greșit e refuzat", (await p.eval("document.querySelector('.invoices [role=alert]').innerText")).includes("cifra de control"));
  await p.fill("input[aria-label='CUI partener']", "RO12345674");
  await p.click("Adaugă partenerul", ".invoices button");
  await p.until("document.body.innerText.includes('RO12345674')", 8000);
  await sub("Factură nouă");
  await p.until("!!document.querySelector('.invoice-form')");
  await selectByText(p, "select[aria-label='Scade din stoc']", "Depozit central");
  await selectByText(p, "select[aria-label='Produsul 1']", "CIM-40");
  await p.fill("input[aria-label='Cantitatea 1']", "3");
  await p.fill("input[aria-label='Prețul 1']", "32,50");
  await p.click("+ Adaugă o linie", ".invoice-form button");
  await p.fill("input[aria-label='Descrierea 2']", "Transport");
  await p.fill("input[aria-label='Cantitatea 2']", "1");
  await p.fill("input[aria-label='Prețul 2']", "100");
  await p.fill("select[aria-label='Cota TVA 2']", "11");
  await p.screenshot(join(shots, "05-factura-noua.png"));
  await p.click("Emite factura", ".invoice-form button");
  await p.until("document.body.innerText.includes('Factura KGB 1 a fost emisă')", 10000);
  const emitted = await p.eval("document.querySelector('.invoices [role=status]').innerText");
  check("factura KGB 1: 228,98 lei (calculat de mână)", emitted.includes("228,98 lei"), emitted);
  const invs = await p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", { id: "kgb.business", command: "invoices", args: {} })`);
  const pdfPath = join(shots, "factura-KGB-1.pdf");
  await p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", { id: "kgb.business", command: "invoice_pdf", args: { id: ${JSON.stringify(invs[0].id)}, dest: ${JSON.stringify(pdfPath)} } })`);
  check("PDF-ul facturii se generează", readFileSync(pdfPath).subarray(0, 5).toString("latin1") === "%PDF-");
  await tab(p, "Stoc");
  await p.until("!!document.querySelector('.stock-table tbody tr')", 8000);
  check("factura a scăzut stocul (19 → 16)", (await stockRows(p)).some((r) => r.startsWith("CIM-40|Ciment 40 kg|Depozit central|16|")));
  await tab(p, "Facturare");
  await p.until("!!document.querySelector('.invoice-list')");
  await p.until("!!document.querySelector(\"button[aria-label='Stornează factura KGB 1']\")", 8000);
  await p.click("", "button[aria-label='Stornează factura KGB 1']");
  await p.until("document.body.innerText.includes('stornată prin factura KGB 2')", 10000);
  await p.screenshot(join(shots, "06-facturi.png"));
  await tab(p, "Stoc");
  await p.until("!!document.querySelector('.stock-table tbody tr')", 8000);
  check("stornarea facturii readuce stocul (16 → 19)", (await stockRows(p)).some((r) => r.startsWith("CIM-40|Ciment 40 kg|Depozit central|19|")));

  // Step 5.4: expenses — taken over from the Extract CSV export, then one by hand.
  const csvPath = join(data, "Facturi extrase.csv");
  writeFileSync(
    csvPath,
    "﻿Număr factură;Data emiterii;Scadența;Furnizor;CUI furnizor;Client;Total fără TVA;TVA;Total de plată\r\nF-1;01.11.2026;15.11.2026;Beta Construct SRL;RO18547290;Noi SRL;1000,00;210,00;1210,00\r\n",
  );
  await tab(p, "Cheltuieli");
  await p.until("!!document.querySelector('.purchases')");
  const imp = await p.eval(`window.__TAURI_INTERNALS__.invoke("module_import_file", { id: "kgb.business", path: ${JSON.stringify(csvPath)} })`);
  check("factura din „Extragere date” e preluată, cu furnizor nou", imp.importate === 1, JSON.stringify(imp));
  await tab(p, "Stoc");
  await tab(p, "Cheltuieli");
  await p.until("!!document.querySelector('.purchase-form')", 8000);
  await p.fill("input[aria-label='Numărul documentului primit']", "B 77");
  await p.fill("select[aria-label='Tipul documentului']", "bon");
  await p.fill("input[aria-label='Total fără TVA']", "100");
  await p.fill("input[aria-label='TVA']", "21");
  await p.fill("input[aria-label='Total de plată']", "122");
  await p.click("Înregistrează", ".purchase-form button");
  await p.until("!!document.querySelector('.purchase-form [role=alert]')", 8000);
  check("un total greșit e refuzat", (await p.eval("document.querySelector('.purchase-form [role=alert]').innerText")).includes("nu este egal"));
  await p.fill("input[aria-label='Total de plată']", "121");
  await p.click("Înregistrează", ".purchase-form button");
  await p.until("document.querySelectorAll('.purchase-list tbody tr').length === 2", 8000);
  const pl = await p.eval("[...document.querySelectorAll('.purchase-list tbody tr')].map(r => r.cells[0].innerText + '|' + r.cells[5].innerText)");
  check("cheltuielile apar în listă", pl.includes("Bon fiscal B 77|121,00") && pl.some((x) => x.startsWith("Factură F-1") && x.endsWith("|1.210,00")), JSON.stringify(pl));
  await p.screenshot(join(shots, "07-cheltuieli.png"));

  // Step 5.5: cash and bank — a cash register, a receipt, a payment linked to
  // an expense (refused while the cash is short), a bank statement.
  await p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", { id: "kgb.business", command: "series_save", args: { cod: "CH" } })`);
  await tab(p, "Casă și bancă");
  await p.until("!!document.querySelector('.cash')");
  for (const [tip, nume] of [["casa", "Casa principală"], ["banca", "Banca X"]]) {
    await p.fill("select[aria-label='Tip cont']", tip);
    await p.fill("input[aria-label='Nume cont']", nume);
    await p.click("Adaugă contul", ".cash button");
    await p.until(`document.querySelector('.accounts').innerText.includes(${JSON.stringify(nume)})`, 8000);
  }
  const payForm = async (vals) => {
    for (const [sel, v] of vals) await p.fill(sel, v);
    await p.click("Înregistrează", ".payment-form button");
  };
  await selectByText(p, "select[aria-label='Cont']", "Casa principală");
  await p.fill("select[aria-label='Sens']", "plata");
  await p.until("!!document.querySelector(\"select[aria-label='Documentul achitat']\")");
  await selectByText(p, "select[aria-label='Documentul achitat']", "B 77");
  await payForm([["input[aria-label='Suma']", "121"]]);
  await p.until("!!document.querySelector('.cash [role=alert]')", 8000);
  check("casa nu poate avea sold negativ", (await p.eval("document.querySelector('.cash [role=alert]').innerText")).includes("sold negativ"));
  await p.fill("select[aria-label='Sens']", "incasare");
  await p.until("!!document.querySelector(\"select[aria-label='Seria chitanței']\")");
  await selectByText(p, "select[aria-label='Seria chitanței']", "CH");
  await payForm([["input[aria-label='Suma']", "500"], ["input[aria-label='Explicație']", "aport"]]);
  await p.until("document.body.innerText.includes('Chitanța CH 1')", 8000);
  check("încasarea în casă primește chitanța CH 1", true);
  await p.fill("select[aria-label='Sens']", "plata");
  await p.until("!!document.querySelector(\"select[aria-label='Documentul achitat']\")");
  await selectByText(p, "select[aria-label='Documentul achitat']", "B 77");
  await payForm([["input[aria-label='Suma']", "121"]]);
  await p.until("document.body.innerText.includes('Plata a fost înregistrată')", 8000);
  const bankCsv = join(data, "extras.csv");
  writeFileSync(bankCsv, "Data;Descriere;Debit;Credit\r\n03.11.2026;Plată Beta Construct F-1;1.210,00;\r\n04.11.2026;Încasare;;250,00\r\n");
  const accs = await p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", { id: "kgb.business", command: "accounts", args: {} })`);
  const bank = accs.find((a) => a.tip === "banca");
  const r1 = await p.eval(`window.__TAURI_INTERNALS__.invoke("module_import_file_with", { id: "kgb.business", path: ${JSON.stringify(bankCsv)}, command: "bank_import", args: { cont: ${JSON.stringify(bank.id)} } })`);
  const r2 = await p.eval(`window.__TAURI_INTERNALS__.invoke("module_import_file_with", { id: "kgb.business", path: ${JSON.stringify(bankCsv)}, command: "bank_import", args: { cont: ${JSON.stringify(bank.id)} } })`);
  check("extrasul intră o singură dată", r1.importate === 2 && r2.importate === 0 && r2.sarite === 2, JSON.stringify([r1, r2]));
  await tab(p, "Stoc");
  await tab(p, "Casă și bancă");
  await p.until("document.querySelectorAll('.accounts tbody tr').length === 2", 8000);
  const sold = await p.eval("[...document.querySelectorAll('.accounts tbody tr')].map(r => r.cells[0].innerText + '|' + r.cells[3].innerText)");
  // casa: 500 − 121 = 379; bancă: −1.210 + 250 = −960
  check("soldurile: casa 379,00, banca −960,00", sold.includes("Casa principală|379,00") && sold.includes("Banca X|-960,00"), JSON.stringify(sold));
  await p.screenshot(join(shots, "08-casa-banca.png"));

  // Forced restart: the stock is recomputed from the movements.
  stop(p);
  p = await start();
  await p.click("Business", "nav .nav");
  await p.until("!!document.querySelector('.stock-table tbody tr')", 10000);
  const s3 = await stockRows(p);
  check("după repornire (forțată) stocul și valoarea sunt aceleași", s3.includes("CIM-40|Ciment 40 kg|Depozit central|19|sac|32,50|617,50") && s3.includes("CIM-40|Ciment 40 kg sub minim|Șantier Iași|5|sac|32,50|162,50"), JSON.stringify(s3));
  stop(p);
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
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
