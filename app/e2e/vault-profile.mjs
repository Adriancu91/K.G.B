// 7.10b, end to end in the real window: the firm's profile from its papers. In „Depozitul de documente” a folder
// with the certificat constatator and a purchase e-Factura is added; „Profilul firmei din acte” proposes the name,
// the CUI, the trade register number and the seat, and writes the chosen ones in „Date firmă” (Documente și
// modele), in Business and as the vault's CUI. The purchase invoice is then recorded in Business from a filled-in
// form (its supplier added from the invoice), shown afterwards as „există și în: Business”, and Business refuses
// the same invoice a second time.
//
// Usage: node app/e2e/vault-profile.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR) and a throw-away documents folder, never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node vault-profile.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-vprof-"));
const docs = mkdtempSync(join(tmpdir(), "kgb-vprof-docs-"));
const PORT = 9371;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const call = (p, id, command, args = {}) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id, command, args })}).then(r => r, e => ({ error: String(e) }))`);

const cert =
  "OFICIUL NAȚIONAL AL REGISTRULUI COMERȚULUI\nCERTIFICAT CONSTATATOR\nDenumire: NOI CONSTRUCT S.R.L.\n" +
  "Cod unic de înregistrare: 14399840 din data de 01.03.2002\nNumăr de ordine în registrul comerţului: J22/1234/2002\n" +
  "Sediul social: Iaşi, Str. Lăpuşneanu nr. 1\n";
const ubl = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:cac" xmlns:cbc="urn:cbc">
  <cbc:ID>F 0077</cbc:ID><cbc:IssueDate>2026-11-03</cbc:IssueDate>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Beta Materiale SRL</cbc:RegistrationName><cbc:CompanyID>RO18547290</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Noi Construct SRL</cbc:RegistrationName><cbc:CompanyID>RO14399840</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="RON">595.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;
for (const [rel, body] of [
  ["Acte firma/certificat constatator.txt", cert],
  ["Facturi/primite/F 77.xml", ubl],
]) {
  const f = join(docs, rel);
  mkdirSync(join(f, ".."), { recursive: true });
  writeFileSync(f, body);
}

/** Enables a module from the Catalog, granting what it asks. */
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
  for (const m of ["Depozitul de documente", "Documente și modele", "Business"]) await enable(p, m);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Depozitul de documente')).click()");
  await p.until("!!document.querySelector('.vault')", 8000);
  await p.eval(`window.__kgbE2eFolder = ${JSON.stringify(docs)}`);
  await p.click("Adaugă un folder…", ".vault button");
  await p.until("document.querySelectorAll('[data-testid=vault-doc]').length === 2", 20000);

  // The certificate among the firm's papers (confirmed if the sorting was not sure).
  const certRow = "[...document.querySelectorAll('[data-testid=vault-doc]')].find(r => r.innerText.includes('certificat constatator'))";
  if ((await p.eval(`${certRow}.querySelector('select').value`)) !== "identitate") {
    await p.eval(`(() => { const s = ${certRow}.querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'identitate'); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await sleep(500);
  }

  // The profile: four fields found, ticked because empty everywhere.
  await p.click("Profilul firmei din acte…", ".vault button");
  await p.until("!!document.querySelector('[aria-label=\"Profilul firmei din acte\"] table')", 10000);
  const found = await p.eval("[...document.querySelectorAll('[aria-label=\"Profilul firmei din acte\"] tr')].map(r => [r.dataset.field, [...r.querySelectorAll('input[type=radio]')].find(i => i.checked)?.getAttribute('aria-label') ?? ''])");
  check(
    "din certificat: denumirea, CUI-ul, nr. Reg. Com. și sediul, alese pentru că lipsesc",
    JSON.stringify(found) === JSON.stringify([
      ["nume", "Denumirea: NOI CONSTRUCT S.R.L."],
      ["cui", "CUI: 14399840"],
      ["reg_com", "Nr. Registrul Comerțului: J22/1234/2002"],
      ["adresa", "Sediul social: Iaşi, Str. Lăpuşneanu nr. 1"],
    ]),
    JSON.stringify(found),
  );
  await p.screenshot(join(shots, "01-profil.png"));
  await p.click("Scrie cele 4 câmpuri alese", "[aria-label=\"Profilul firmei din acte\"] button");
  await p.until("!document.querySelector('[aria-label=\"Profilul firmei din acte\"]') && (document.querySelector('.vault')?.innerText ?? '').includes('Scris în')", 10000);
  const company = await call(p, "kgb.docs", "company");
  const v = (k) => company.campuri?.find((c) => c.camp === k)?.valoare;
  check("„Date firmă” are datele din certificat", v("nume") === "NOI CONSTRUCT S.R.L." && v("cui") === "14399840" && v("reg_com") === "J22/1234/2002" && v("adresa")?.startsWith("Iaşi"), JSON.stringify(company.campuri?.slice(0, 4)));
  const biz = await call(p, "kgb.business", "settings");
  const b = (k) => biz.firma?.find((c) => c.camp === k)?.valoare;
  check("Business are aceleași date", b("firma_nume") === "NOI CONSTRUCT S.R.L." && b("firma_cui") === "14399840" && b("firma_reg_com") === "J22/1234/2002", JSON.stringify(biz.firma?.slice(0, 3)));
  const vs = await call(p, "kgb.vault", "setari");
  check("depozitul știe CUI-ul firmei, deci factura primită e de achiziție", vs.cui_firma === "14399840", JSON.stringify(vs));

  // The purchase invoice into Business, from the filled-in form.
  const invRow = "[...document.querySelectorAll('[data-testid=vault-doc]')].find(r => r.innerText.includes('F 77'))";
  await p.until(`${invRow}?.querySelector('select').value === 'facturi_achizitie'`, 10000);
  await p.eval(`[...${invRow}.querySelectorAll('button')].find(b => b.textContent.includes('Înregistrează în Business')).click()`);
  await p.until("!!document.querySelector('form[aria-label=\"Înregistrează în Business\"] select') ", 10000);
  const form = await p.eval(`(() => { const f = document.querySelector('form[aria-label="Înregistrează în Business"]'); return { furnizor: f.querySelector('select').value, numar: f.querySelector('[aria-label="Numărul facturii"]').value, data: f.querySelector('[aria-label="Data facturii"]').value, total: f.querySelector('[aria-label="Total cu TVA"]').value, text: f.innerText }; })()`);
  check(
    "formularul vine completat: furnizorul de adăugat din factură, numărul, data, totalul",
    form.furnizor === "" && form.numar === "F 77" && form.data === "2026-11-03" && form.total === "595,00" && form.text.includes("Beta Materiale SRL, CUI 18547290"),
    JSON.stringify({ ...form, text: form.text.replace(/\s+/g, " ").slice(0, 160) }),
  );
  await p.screenshot(join(shots, "02-in-business.png"));
  await p.click("Înregistrează", "form[aria-label=\"Înregistrează în Business\"] button");
  await p.until("(document.querySelector('.vault')?.innerText ?? '').includes('e înregistrată în Business')", 10000);
  const bought = await call(p, "kgb.business", "purchases");
  const partners = await call(p, "kgb.business", "partners");
  check(
    "Business are cheltuiala, cu furnizorul adăugat din factură",
    bought.length === 1 && bought[0].numar === "F 77" && bought[0].total === 59500 && bought[0].data === "2026-11-03" && partners.some((x) => x.nume === "Beta Materiale SRL" && x.cui === "18547290"),
    JSON.stringify({ bought: bought.map((x) => [x.numar, x.total, x.data]), partners: partners.map((x) => [x.nume, x.cui]) }),
  );
  await p.until(`(${invRow}?.innerText ?? '').includes('există și în:')`, 10000);
  const rowText = await p.eval(`${invRow}.innerText`);
  check("în depozit factura arată „există și în: Business” și nu mai oferă înregistrarea", rowText.includes("Business, cheltuiala F 77") && !rowText.includes("Înregistrează în Business"), rowText.replace(/\s+/g, " ").slice(0, 200));
  const again = await call(p, "kgb.business", "purchase_save", { furnizor: partners.find((x) => x.cui === "18547290").id, numar: "F 77", data: "2026-11-03", total: "595,00" });
  check("Business refuză aceeași factură a doua oară", typeof again.error === "string", JSON.stringify(again).slice(0, 160));
  await p.screenshot(join(shots, "03-dupa.png"));
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
