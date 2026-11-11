// 7.10a / 7.10d, end to end in the real window: „Depozitul de documente” — a folder with subfolders added at once, each
// document sorted (labour contract, company certificate, an e-Factura invoice, a scan by its folder's name), the
// same file a second time not added again, the firm's CUI turning the invoice into a sale, a category confirmed;
// the same invoice in another file and in Business shown as a duplicate, another total as „posibil dublură”.
//
// Usage: node app/e2e/vault.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR) and a throw-away documents folder, never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node vault.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-vault-"));
const docs = mkdtempSync(join(tmpdir(), "kgb-vault-docs-"));
const PORT = 9368;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clickText = (p, text, scope = "") =>
  p.eval(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); b?.click(); return !!b; })()`);
const rows = (p) => p.eval("[...document.querySelectorAll('[data-testid=vault-doc]')].map(r => ({ t: r.innerText, cat: r.querySelector('select').value }))");

// The firm's documents, as they sit on a disk: subfolders, a copy of the same file, a file of another kind.
const ubl = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:cac" xmlns:cbc="urn:cbc">
  <cbc:ID>KGB 0012</cbc:ID><cbc:IssueDate>2026-11-05</cbc:IssueDate>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Noi SRL</cbc:RegistrationName><cbc:CompanyID>RO14399840</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Alfa SRL</cbc:RegistrationName><cbc:CompanyID>RO18547290</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="RON">1210.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;
const cim = "CONTRACT INDIVIDUAL DE MUNCĂ nr. 7\nAngajator: Noi SRL\nSalariat: Popescu Ion, CNP 1960101123456\n";
for (const [rel, body] of [
  ["Acte firma/certificat constatator.txt", "OFICIUL REGISTRULUI COMERȚULUI\nCERTIFICAT CONSTATATOR\nCod unic de înregistrare 14399840\n"],
  ["Personal/cim popescu.txt", cim],
  ["Personal/copie/cim popescu (1).txt", cim],
  ["Facturi/emise/KGB 12.xml", ubl],
  ["Autorizatii/scan ISU.png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])],
  ["Diverse/notite.exe", "nu"],
]) {
  const f = join(docs, rel);
  mkdirSync(join(f, ".."), { recursive: true });
  writeFileSync(f, body);
}

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Depozitul de documente')";
  await p.until(`!!${card}`, 8000);
  check("modulul Depozitul de documente e în catalog, beta", await p.eval(`${card}.innerText.toLowerCase().includes('beta')`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Depozitul de documente'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Depozitul de documente')).click()");
  await p.until("!!document.querySelector('.vault')", 8000);

  // The whole folder at once (the system's folder dialog replaced by the folder's path).
  await p.eval(`window.__kgbE2eFolder = ${JSON.stringify(docs)}`);
  await clickText(p, "Adaugă un folder…", ".vault");
  await p.until("document.querySelector('.vault [role=status]')?.innerText.includes('documente noi')", 20000);
  const note = await p.eval("document.querySelector('.vault [role=status]').innerText");
  check("folderul: 4 documente noi, unul era deja (copia), un fișier sărit (.exe)", /4 documente noi/.test(note) && /unul era deja/.test(note) && /un fișier sărit/.test(note), note);
  await p.until("document.querySelectorAll('[data-testid=vault-doc]').length === 4", 8000);
  const r = await rows(p);
  const cat = (part) => r.find((x) => x.t.includes(part))?.cat;
  check(
    "sortate: contract de muncă, actele firmei, factură de vânzare (după folderul „emise”), autorizație (după folder)",
    cat("cim popescu") === "contracte_munca" && cat("certificat constatator") === "identitate" && cat("KGB 12.xml") === "facturi_vanzare" && cat("scan ISU") === "autorizatii",
    JSON.stringify(r.map((x) => x.cat)),
  );
  check(
    "factura recunoscută din XML: KGB 12, 05.11.2026, 1.210,00 lei, emitent 14399840",
    await p.eval("[...document.querySelectorAll('[data-testid=vault-invoice]')].some(e => /Factura KGB 12/.test(e.innerText) && e.innerText.includes('05.11.2026') && e.innerText.includes('1.210,00 lei') && e.innerText.includes('14399840'))"),
  );
  check("scanarea, sortată doar după nume, e „de confirmat”", (r.find((x) => x.t.includes("scan ISU"))?.t ?? "").includes("de confirmat"));
  await p.screenshot(join(shots, "01-depozit.png"));

  // The firm's CUI: the invoice becomes a sale.
  await setValue(p, "input[aria-label='CUI-ul firmei']", "RO 14399840");
  await clickText(p, "Salvează", ".vault");
  await p.until("document.querySelector('.vault [role=status]')?.innerText.includes('sortate din nou')", 8000);
  await p.until("[...document.querySelectorAll('[data-testid=vault-doc]')].some(r => r.innerText.includes('KGB 12.xml') && r.querySelector('select').value === 'facturi_vanzare')", 8000);
  check("cu CUI-ul firmei, factura emisă de firmă e de vânzare", true);

  // A category confirmed by the person; the CNP is nowhere on screen.
  await p.eval("[...document.querySelectorAll('[data-testid=vault-doc]')].find(r => r.innerText.includes('scan ISU')).querySelectorAll('button')[0].click()");
  await p.until("![...document.querySelectorAll('[data-testid=vault-doc]')].find(r => r.innerText.includes('scan ISU'))?.innerText.includes('de confirmat')", 8000);
  const sum = await invoke(p, "module_call", { id: "kgb.vault", command: "rezumat", args: {} });
  check("confirmată: nu mai e de confirmat", sum.de_confirmat === 0 || !JSON.stringify(await invoke(p, "module_call", { id: "kgb.vault", command: "lista", args: { de_confirmat: true } })).includes("scan ISU"), JSON.stringify(sum).slice(0, 120));
  await setValue(p, "input[aria-label='Caută în depozit']", "popescu");
  await p.until("document.querySelectorAll('[data-testid=vault-doc]').length === 1", 8000);
  const all = await invoke(p, "module_call", { id: "kgb.vault", command: "lista", args: {} });
  check("căutarea găsește după text; CNP-ul nu e păstrat în text", !JSON.stringify(all).includes("1960101123456") && !(await p.eval("document.body.innerText.includes('1960101123456')")));
  await setValue(p, "input[aria-label='Caută în depozit']", "");

  // 7.10d: the same invoice in another file (other spaces in the number), and a third one with another total.
  const more = mkdtempSync(join(tmpdir(), "kgb-vault-more-"));
  writeFileSync(join(more, "KGB 12 copie.xml"), ubl.replace("KGB 0012", "KGB12"));
  writeFileSync(join(more, "KGB 12 alta.xml"), ubl.replace("KGB 0012", "KGB 12").replace("1210.00", "999.00"));
  await p.eval(`window.__kgbE2eFolder = ${JSON.stringify(more)}`);
  await clickText(p, "Adaugă un folder…", ".vault");
  await p.until("document.querySelector('.vault [role=status]')?.innerText.includes('2 documente noi')", 20000);
  rmSync(more, { recursive: true, force: true });
  // Business: the same invoice issued there (series KGB from number 12, 1.000 + 21% VAT = 1.210,00).
  await p.click("Catalog module", "nav .nav");
  const biz = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Business')";
  await p.until(`!!${biz}`, 8000);
  await p.eval(`${biz}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim() === 'Business')", 8000);
  const b = (command, args) => invoke(p, "module_call", { id: "kgb.business", command, args });
  await b("settings_save", { firma: { firma_nume: "Noi SRL", firma_cui: "RO14399840", firma_adresa: "Iași" } });
  const series = await b("series_save", { cod: "KGB", primul_numar: 12 });
  const client = await b("partner_save", { nume: "Alfa SRL", cui: "RO18547290", tip: "client" });
  const issued = await b("invoice_issue", { serie: series.id, partener: client.id, data: "2026-11-05", linii: [{ descriere: "Servicii", cantitate: "1", pret_unitar: "1000", cota_tva: 21 }] });
  check("în Business: factura KGB 12 emisă", issued.numar === "KGB 12" || String(issued.numar).includes("12"), JSON.stringify(issued).slice(0, 120));
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Depozitul de documente')).click()");
  await p.until("!!document.querySelector('.vault')", 8000);
  // The tab appears once the invoices of Business are read.
  await p.until("[...document.querySelectorAll('.vault-cats button')].some(b => b.textContent.trim() === 'Dubluri')", 10000);
  await clickText(p, "Dubluri", ".vault-cats");
  await p.until("document.querySelectorAll('[data-testid=vault-doc]').length === 3", 10000);
  const dups = await p.eval("[...document.querySelectorAll('[data-testid=vault-doc]')].map(r => ({ n: r.querySelector('strong').innerText, d: [...r.querySelectorAll('[data-testid=vault-dup]')].map(x => x.innerText.replace(/\\s+/g, ' ')) }))");
  const of = (n) => dups.find((x) => x.n === n)?.d ?? [];
  check(
    "dublurile: factura și copia ei se văd una pe alta și în Business",
    of("KGB 12.xml").some((t) => t.includes("există și în") && t.includes("KGB 12 copie.xml")) &&
      of("KGB 12.xml").some((t) => t.includes("există și în") && t.includes("Business, factura emisă KGB 12")) &&
      of("KGB 12 copie.xml").some((t) => t.includes("Business")),
    JSON.stringify(dups),
  );
  check("același număr cu alt total: „posibil dublură”", of("KGB 12 alta.xml").length > 0 && of("KGB 12 alta.xml").every((t) => t.startsWith("posibil dublură")), JSON.stringify(of("KGB 12 alta.xml")));
  await p.screenshot(join(shots, "02-dubluri.png"));
  p.close();
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
} finally {
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
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
