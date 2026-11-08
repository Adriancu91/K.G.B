// Etapa 7 step 7.2, end to end in the real window: Permits and
// authorizations. A procedure with a dated official source shows as
// verified, one without as unverified; a case file follows the procedure's
// documents and steps; ticking and the state survive a forced restart.
// (Attaching documents goes through the system file dialog; it is covered by
// the module's Rust tests.)
//
// Usage: node app/e2e/permits.mjs <path-to-kgb-app.exe> <screenshot-dir>
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node permits.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-permits-"));
const PORT = 9350;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const setValue = (p, sel, value) =>
  p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const tab = (p, label) => p.eval(`[...document.querySelectorAll('.permits .sheet-tabs button')].find(b => b.innerText.startsWith(${JSON.stringify(label)})).click()`);

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
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
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Permise și autorizații')";
  await p.until(`!!${card}`);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Permise'))");
  await p.click("Permise și autorizații", "nav .nav");
  await p.until("!!document.querySelector('.permits')");
  check("pagina spune clar că e informație orientativă", (await p.eval("document.querySelector('.permits .warn').innerText")).includes("nu înlocuiește consultanța juridică"));

  // A procedure with a dated official source.
  await tab(p, "Proceduri");
  await p.click("Procedură nouă");
  await p.until("!!document.querySelector('.permit-editor')");
  await setValue(p, "input[aria-label='Titlul procedurii']", "Autorizație de test");
  await setValue(p, "input[aria-label='Instituția']", "Instituție de test");
  await setValue(p, "input[aria-label='Condiția 1']", "spațiu potrivit");
  await setValue(p, "input[aria-label='Documentul 1']", "cerere tip");
  await p.click("+ document");
  await setValue(p, "input[aria-label='Documentul 2']", "act de proprietate");
  await setValue(p, "textarea[aria-label='Pașii']", "depunere\nplata taxei");
  await setValue(p, "input[aria-label='Titlul sursei 1']", "Pagina oficială de test");
  await setValue(p, "input[aria-label='Linkul sursei 1']", "https://example.org/procedura");
  await p.click("Salvează procedura");
  await p.until("!!document.querySelector('.procedures-table tbody tr')");
  check("procedura cu sursă oficială datată apare „verificată”", (await p.eval("document.querySelector('.procedures-table tbody tr').innerText")).includes("verificată"));
  // One without a source.
  await p.click("Procedură nouă");
  await p.until("!!document.querySelector('.permit-editor')");
  await setValue(p, "input[aria-label='Titlul procedurii']", "Altă autorizație");
  await setValue(p, "input[aria-label='Data verificării sursei 1']", "");
  await p.click("Salvează procedura");
  await p.until("document.querySelectorAll('.procedures-table tbody tr').length === 2");
  const rows = await p.eval("[...document.querySelectorAll('.procedures-table tbody tr')].map(r => r.innerText).join(' | ')");
  check("procedura fără sursă apare „fără sursă oficială datată”", rows.includes("fără sursă oficială datată"), rows);
  await p.screenshot(join(shots, "01-proceduri.png"));

  // A case file.
  await tab(p, "Dosare");
  await setValue(p, "input[aria-label='Titlul dosarului']", "Magazin de test");
  await p.eval(`(() => { const s = document.querySelector("select[aria-label='Procedura dosarului']");
    const o = [...s.options].find(o => o.textContent === 'Autorizație de test');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value);
    s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await setValue(p, "input[aria-label='Termenul dosarului']", "2030-01-15");
  await p.click("Deschide dosarul");
  await p.until("!!document.querySelector('.case-detail')");
  const items = await p.eval("[...document.querySelectorAll('.checklist li')].map(l => l.innerText.trim())");
  check("checklistul vine din procedură (2 documente + 2 pași)", items.length === 4, items.join(" | "));
  await p.eval("document.querySelector(\"input[aria-label='cerere tip']\").click()");
  await p.until("[...document.querySelectorAll('.case-detail h4')].some(h => h.innerText.includes('(1/4)'))", 5000);
  await setValue(p, "select[aria-label='Starea dosarului']", "depus");
  await p.until("document.querySelector('.cases-table tbody tr').innerText.includes('depus la instituție')", 5000);
  check("bifarea și starea se salvează", true);
  await p.screenshot(join(shots, "02-dosar.png"));

  stop(p);
  p = await start();
  await p.click("Permise și autorizații", "nav .nav");
  await p.until("!!document.querySelector('.cases-table tbody tr')", 8000);
  const row = await p.eval("document.querySelector('.cases-table tbody tr').innerText");
  check("după repornire (forțată) dosarul păstrează starea și progresul", row.includes("depus la instituție") && row.includes("1/4") && row.includes("15.01.2030"), row);
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
