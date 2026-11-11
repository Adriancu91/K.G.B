// 7.10b, end to end in the real window: „Autorizațiile firmei” in „Permise și autorizații”. The firm's ISU
// authorization sits in „Depozitul de documente”; „Din depozitul de documente…” shows what was read from it (title,
// number, issue day, institution), „Folosește” fills in the form and the person saves it; it is then shown as added.
// A permit typed by hand that ends in 10 days is marked as expiring, with the days left.
//
// Usage: node app/e2e/permits-held.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR) and a throw-away documents folder, never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node permits-held.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-held-"));
const docs = mkdtempSync(join(tmpdir(), "kgb-held-docs-"));
const PORT = 9372;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const call = (p, id, command, args = {}) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id, command, args })}).then(r => r, e => ({ error: String(e) }))`);
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

mkdirSync(join(docs, "Autorizatii"), { recursive: true });
writeFileSync(
  join(docs, "Autorizatii", "autorizatie ISU depozit.txt"),
  "INSPECTORATUL PENTRU SITUAȚII DE URGENȚĂ AL JUDEȚULUI IAȘI\nAUTORIZAȚIE DE SECURITATE LA INCENDIU\nNr. 123/24/SU-IS din 15.03.2024\nPentru: depozit materiale\n",
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
const nav = (p, name) => p.eval(`[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith(${JSON.stringify(name)})).click()`);

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  for (const m of ["Depozitul de documente", "Permise și autorizații"]) await enable(p, m);

  // The paper into the vault, as „Autorizații și avize”.
  await nav(p, "Depozitul de documente");
  await p.until("!!document.querySelector('.vault')", 8000);
  await p.eval(`window.__kgbE2eFolder = ${JSON.stringify(docs)}`);
  await p.click("Adaugă un folder…", ".vault button");
  await p.until("document.querySelectorAll('[data-testid=vault-doc]').length === 1", 20000);
  const docs1 = await call(p, "kgb.vault", "lista", {});
  if (docs1[0].categorie !== "autorizatii") await call(p, "kgb.vault", "confirma", { id: docs1[0].id, version: docs1[0].version, categorie: "autorizatii" });

  // The permit from the vault.
  await nav(p, "Permise și autorizații");
  await p.click("Autorizațiile firmei", ".sheet-tabs button");
  await p.until("!!document.querySelector('.held-permits')", 8000);
  await p.click("Din depozitul de documente…", ".held-permits button");
  await p.until("!!document.querySelector('[aria-label=\"Autorizații găsite în depozit\"] li')", 10000);
  const li = await p.eval("document.querySelector('[aria-label=\"Autorizații găsite în depozit\"] li').innerText");
  check("depozitul arată ce a citit: titlul, numărul, data", li.includes("AUTORIZAȚIE DE SECURITATE LA INCENDIU") && li.includes("123/24/SU-IS") && li.includes("15.03.2024"), li.replace(/\s+/g, " "));
  await p.screenshot(join(shots, "01-din-depozit.png"));
  await p.click("Folosește", "[aria-label=\"Autorizații găsite în depozit\"] button");
  await p.until("!!document.querySelector('form[aria-label=\"Autorizația\"]')", 5000);
  const form = await p.eval(`(() => { const f = document.querySelector('form[aria-label="Autorizația"]'); const v = (l) => f.querySelector('[aria-label="' + l + '"]').value; return { titlu: v('Titlul autorizației'), numar: v('Numărul autorizației'), emisa: v('Data emiterii'), inst: v('Instituția'), pana: v('Valabilă până la') }; })()`);
  check(
    "formularul vine completat din document",
    form.titlu === "AUTORIZAȚIE DE SECURITATE LA INCENDIU" && form.numar === "123/24/SU-IS" && form.emisa === "2024-03-15" && form.inst.startsWith("INSPECTORATUL") && form.pana === "",
    JSON.stringify(form),
  );
  await p.click("Salvează", "form[aria-label=\"Autorizația\"] button");
  await p.until("document.querySelectorAll('.held-list tbody tr').length === 1", 8000);

  // One by hand, ending in 10 days.
  const in10 = new Date();
  in10.setDate(in10.getDate() + 10);
  await p.click("Adaugă o autorizație…", ".held-permits button");
  await setValue(p, "[aria-label='Titlul autorizației']", "Autorizație sanitară de funcționare");
  await setValue(p, "[aria-label='Valabilă până la']", iso(in10));
  await p.click("Salvează", "form[aria-label=\"Autorizația\"] button");
  await p.until("document.querySelectorAll('.held-list tbody tr').length === 2", 8000);
  const rows = await p.eval("[...document.querySelectorAll('.held-list tbody tr')].map(r => [r.dataset.state, r.innerText.replace(/\\s+/g, ' ')])");
  check("cea care expiră e prima, marcată, cu zilele rămase", rows[0][0] === "expira" && rows[0][1].includes("expiră în 10 zile") && rows[1][0] === "fara_termen", JSON.stringify(rows));
  const held = await call(p, "kgb.permits", "autorizatii", { azi: iso(new Date()) });
  check("autorizația din depozit ține legătura cu documentul", held.some((h) => h.numar === "123/24/SU-IS" && h.document === docs1[0].id), JSON.stringify(held.map((h) => [h.titlu, h.document])));
  await p.click("Din depozitul de documente…", ".held-permits button");
  await p.until("(document.querySelector('[aria-label=\"Autorizații găsite în depozit\"]')?.innerText ?? '').includes('(adăugată)')", 8000);
  check("a doua oară, depozitul o arată ca adăugată", true);
  await p.screenshot(join(shots, "02-autorizatii.png"));
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
