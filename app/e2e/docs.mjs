// Etapa 4 step 4.8, end to end in the real window: the document library.
// Fill the company data, generate a contract from a built-in model through the
// form, preview and export it, import an own Word model, restart.
//
// Usage: node app/e2e/docs.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node docs.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-docs-"));
const PORT = 9342;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);

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

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Documente și modele'))";
  check("modulul apare în catalog ca beta", await p.eval(`${card}?.innerText.toLowerCase().includes('beta') ?? false`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Documente și modele'))");
  await p.click("Documente și modele", "nav .nav");
  await p.until("document.querySelectorAll('.model-card').length === 5", 10000);
  const cats = await p.eval("[...document.querySelectorAll('.docs h2')].map(h => h.innerText)");
  check("5 modele incluse, pe categorii", JSON.stringify(cats) === JSON.stringify(["Administrative", "Comerciale", "Resurse umane", "Tehnice"]), JSON.stringify(cats));
  await p.screenshot(join(shots, "01-modele.png"));

  // Company data.
  await p.click("Date firmă", ".sheet-tabs button");
  const company = {
    Denumire: "Kronos Global Business SRL", CUI: "RO12345678", "Nr. Registrul Comerțului": "J22/123/2020",
    Sediu: "Iași, Str. Lăpușneanu 1", IBAN: "RO49AAAA1B31007593840000", Banca: "Banca Test",
    Telefon: "0700 000 000", "E-mail": "office@exemplu.ro", "Reprezentant legal": "Adrian Popescu", "Funcția reprezentantului": "administrator",
  };
  for (const [k, v] of Object.entries(company)) await p.fill(`.company-form input[aria-label='${k}']`, v);
  await p.click("Salvează datele firmei", ".company-form button");
  await p.until("document.body.innerText.includes('Datele firmei au fost salvate')", 8000);
  check("datele firmei se salvează", true);

  // Generate a contract through the form.
  await p.click("Modele (5)", ".sheet-tabs button");
  await p.eval("[...document.querySelectorAll('.model-card')].find(c => c.dataset.model === 'Contract de prestări servicii').querySelector('button.primary').click()");
  await p.until("!!document.querySelector('#gen-title')");
  const fromCompany = await p.eval("document.querySelector('.dialog fieldset')?.innerText ?? ''");
  check("câmpurile firmei vin din „Date firmă”, nu se scriu în formular", fromCompany.includes("RO49AAAA1B31007593840000") && !(await p.eval("!!document.querySelector(\".dialog input[aria-label='Firma · IBAN']\")")));
  const vals = {
    Număr: "12", Client: "Școala Gimnazială „Ion Creangă” Iași", "Client · adresa": "Iași, Str. Școlii 5", "Client · CUI": "RO87654321",
    "Client · reprezentant": "Maria Ionescu", Obiectul: "mentenanța echipamentelor IT & rețea", Preț: "1.673,14 lei", "Termen de plată": "15 zile", Durata: "12 luni",
  };
  for (const [k, v] of Object.entries(vals)) await p.fill(`.dialog input[aria-label='${k}']`, v);
  await p.screenshot(join(shots, "02-formular.png"));
  await p.click("Generează documentul", ".dialog button");
  await p.until("!!document.querySelector('.doc-preview pre')", 10000);
  const text = await p.eval("document.querySelector('.doc-preview pre').innerText");
  check(
    "documentul generat are valorile corecte",
    ["Kronos Global Business SRL", "Școala Gimnazială „Ion Creangă” Iași", "1.673,14 lei", "RO49AAAA1B31007593840000", "Maria Ionescu"].every((t) => text.includes(t)) && !text.includes("{{"),
    text.split("\n").find((l) => l.includes("Școala")) ?? "",
  );
  await p.screenshot(join(shots, "03-generat.png"));

  // Export (the save dialog belongs to Windows; the command it leads to is called directly).
  const gen = await invoke(p, "module_call", { id: "kgb.docs", command: "generated", args: {} });
  const dest = join(data, "contract.docx");
  await invoke(p, "module_call", { id: "kgb.docs", command: "export", args: { id: gen[0].id, dest } });
  const head = readFileSync(dest).subarray(0, 2).toString("latin1");
  check("exportul .docx e un fișier Word", head === "PK" && gen[0].model_versiune === 1, `${gen[0].nume} · v${gen[0].model_versiune}`);

  // Import an own Word model (the dialog's result is a path).
  const own = resolve("modules/kgb-docs/models/hr-adeverinta-salariat.docx");
  await invoke(p, "module_import_file", { id: "kgb.docs", path: own });
  // The import button reloads the page itself; here the command was called directly, so reopen the page.
  await p.click("Acasă", "nav .nav");
  await p.click("Documente și modele", "nav .nav");
  await p.until("document.querySelectorAll('.model-card').length === 6", 8000);
  check("un model Word propriu se importă la „Altele”", await p.eval("[...document.querySelectorAll('.docs h2')].some(h => h.innerText === 'Altele')"));

  // Restart (forced): everything is still there.
  stop(p);
  p = await start();
  await p.click("Documente și modele", "nav .nav");
  await p.until("document.querySelectorAll('.model-card').length === 6", 10000);
  const tabs = await p.eval("[...document.querySelectorAll('.sheet-tabs button')].map(b => b.innerText).join(' | ')");
  check("după repornire: modelele și documentul generat sunt acolo", tabs.includes("Modele (6)") && tabs.includes("Documente generate (1)"), tabs);
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
