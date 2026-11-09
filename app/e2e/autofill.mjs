// Etapa 7 step 7.4c, end to end in the real window: suggestions while
// typing a client in a document. A card in the partner directory is offered
// after a few letters (without diacritics); one click fills every client
// field of the model; a client typed by hand is kept in the directory after
// the document is generated and is offered next time.
//
// Usage: node app/e2e/autofill.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node autofill.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-autofill-"));
const PORT = 9353;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const val = (p, sel) => p.eval(`document.querySelector(${JSON.stringify(sel)})?.value ?? null`);
const pick = (p, text) =>
  p.eval(`[...document.querySelectorAll('.suggest-list button')].find(b => b.innerText.includes(${JSON.stringify(text)})).click()`);
const openContract = async (p) => {
  await p.click("Modele (14)", ".sheet-tabs button");
  await p.eval("[...document.querySelectorAll('.model-card')].find(c => c.dataset.model === 'Contract de prestări servicii').querySelector('button.primary').click()");
  await p.until("!!document.querySelector('#gen-title')");
};

try {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);

  // A card in the directory, with a field added by hand.
  await p.click("Parteneri", "nav .nav");
  await p.until("!!document.querySelector('.partners-page')");
  await p.click("Partener nou");
  await p.until("!!document.querySelector('.partner-editor')");
  await p.fill("input[aria-label='Denumire']", "Transport Ștefănescu SRL");
  await p.fill("input[aria-label='CUI']", "RO14399840");
  await p.fill("input[aria-label='Sediu']", "Str. Fabricii 1");
  await p.fill("input[aria-label='Localitate']", "Cluj-Napoca");
  await p.fill("input[aria-label='Reprezentant legal']", "Ion Pop");
  await p.click("Salvează fișa");
  await p.until("!!document.querySelector('.partners-table')", 5000);

  // The documents module, with the company's data.
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Documente și modele'))";
  await p.until(`!!${card}`);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Documente și modele'))");
  await p.click("Documente și modele", "nav .nav");
  await p.until("document.querySelectorAll('.model-card').length === 14", 10000);
  await p.click("Date firmă", ".sheet-tabs button");
  const company = {
    Denumire: "Firma Mea de Test SRL", CUI: "RO14399840", "Nr. Registrul Comerțului": "J22/1/2020", Sediu: "Iași", IBAN: "RO49AAAA1B31007593840000",
    Banca: "Banca Test", Telefon: "0700 000 000", "E-mail": "office@exemplu.ro", "Reprezentant legal": "Test Testescu", "Funcția reprezentantului": "administrator",
  };
  for (const [k, v] of Object.entries(company)) await p.fill(`.company-form input[aria-label='${k}']`, v);
  await p.click("Salvează datele firmei", ".company-form button");
  await p.until("document.body.innerText.includes('Datele firmei au fost salvate')", 8000);

  // 1. From the directory: a few letters, no diacritics.
  await openContract(p);
  await p.fill(".dialog input[aria-label='Client']", "stef");
  await p.until("!!document.querySelector('.suggest-list')", 5000);
  const list = await p.eval("document.querySelector('.suggest-list').innerText");
  check("după câteva litere (fără diacritice) apare sugestia din agendă", list.includes("Transport Ștefănescu SRL") && list.includes("din agendă"), list.replace(/\n/g, " "));
  await p.screenshot(join(shots, "01-sugestie.png"));
  await pick(p, "Transport Ștefănescu SRL");
  await p.until("!document.querySelector('.suggest-list')", 3000);
  const got = {
    nume: await val(p, ".dialog input[aria-label='Client']"),
    cui: await val(p, ".dialog input[aria-label='Client · CUI']"),
    adresa: await val(p, ".dialog input[aria-label='Client · adresa']"),
    rep: await val(p, ".dialog input[aria-label='Client · reprezentant']"),
  };
  check(
    "un clic completează toate câmpurile clientului",
    got.nume === "Transport Ștefănescu SRL" && got.cui === "RO14399840" && got.adresa === "Str. Fabricii 1, Cluj-Napoca" && got.rep === "Ion Pop",
    JSON.stringify(got),
  );
  await p.fill(".dialog input[aria-label='Client · reprezentant']", "Ana Pop");
  check("după completare, un câmp se poate corecta de mână", (await val(p, ".dialog input[aria-label='Client · reprezentant']")) === "Ana Pop");
  await p.screenshot(join(shots, "02-completat.png"));
  await p.click("Renunță", ".dialog button");

  // 2. A client typed by hand stays in the directory.
  await openContract(p);
  const vals = {
    Număr: "7", Client: "Beta Servicii SRL", "Client · adresa": "Str. Morii 2, Iași", "Client · CUI": "", "Client · reprezentant": "Dan Beta",
    Obiectul: "test", Preț: "100 lei", "Termen de plată": "15 zile", Durata: "1 lună",
  };
  for (const [k, v] of Object.entries(vals)) if (v) await p.fill(`.dialog input[aria-label='${k}']`, v);
  // The CUI is optional in the directory but required by the model: use a valid test one.
  await p.fill(".dialog input[aria-label='Client · CUI']", "RO18547290");
  await p.click("Generează documentul", ".dialog button");
  await p.until("!!document.querySelector('.doc-preview pre')", 10000);
  const notice = await p.eval("document.body.innerText");
  check("după generare, clientul nou intră în agenda de parteneri", notice.includes("„Beta Servicii SRL” a fost adăugat în agenda de parteneri"));
  await p.click("Parteneri", "nav .nav");
  await p.until("document.querySelector('.partners-page')?.innerText.includes('Beta Servicii SRL')", 5000);
  check("fișa „Beta Servicii SRL” e în pagina Parteneri", true);

  await p.click("Documente și modele", "nav .nav");
  await p.until("document.querySelectorAll('.model-card').length === 14", 10000);
  await openContract(p);
  await p.fill(".dialog input[aria-label='Client']", "beta");
  await p.until("!!document.querySelector('.suggest-list')", 5000);
  await pick(p, "Beta Servicii SRL");
  const rep = await val(p, ".dialog input[aria-label='Client · reprezentant']");
  check("data viitoare e sugerat și completat, cu reprezentantul", rep === "Dan Beta" && (await val(p, ".dialog input[aria-label='Client · adresa']")) === "Str. Morii 2, Iași", rep ?? "");

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
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
