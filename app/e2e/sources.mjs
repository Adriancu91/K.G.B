// Etapa 7 step 7.1, end to end in the real window: the register of external
// sources. Nothing is active at first; a source without terms, licence and
// date cannot be switched on; with them it can; changing its terms switches
// it off again; a forced restart keeps everything.
//
// Usage: node app/e2e/sources.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node sources.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-sources-"));
const PORT = 9349;
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
const row = "[...document.querySelectorAll('.sources-table tbody tr')].find(r => r.innerText.includes('Flux de test'))";
const clickIn = (p, text) => p.eval(`[...${row}.querySelectorAll('button')].find(b => b.innerText === ${JSON.stringify(text)}).click()`);

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Surse externe", "nav .nav");
  await p.until("!!document.querySelector('.sources-page')");
  return p;
}
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}

try {
  let p = await start();
  // K.G.B. adds only ANAF (step 7.4b), filled in but switched off (D-063).
  const first = await p.eval("[...document.querySelectorAll('.sources-table tbody tr')].map(r => r.innerText)");
  check("la început sunt doar sursele adăugate de K.G.B. (ANAF, BNR, MET), toate oprite", first.length === 3 && first.every((r) => r.includes("oprită")), JSON.stringify(first).slice(0, 120));
  await p.click("Adaugă o sursă");
  await p.until("!!document.querySelector('.source-form')");
  await setValue(p, "input[aria-label='Numele sursei']", "Flux de test");
  await setValue(p, "input[aria-label='Adresa sursei']", "https://example.org/feed.xml");
  await p.click("Salvează");
  await p.until(`!!${row}`);
  check("sursa nouă e oprită", (await p.eval(`${row}.innerText`)).includes("oprită"));
  await clickIn(p, "activează");
  await p.until("!!document.querySelector('.error')", 5000);
  const err = await p.eval("document.querySelector('.error').innerText");
  check("fără condiții, licență și dată nu se poate activa", err.includes("condițiile de folosire") && err.includes("licența") && err.includes("data verificării"), err);

  await clickIn(p, "modifică");
  await p.until("!!document.querySelector('.source-form')");
  await setValue(p, "textarea[aria-label='Condițiile de folosire']", "Fluxul public poate fi citit; se afișează sursa și linkul.");
  await setValue(p, "input[aria-label='Licența']", "termenii sursei, cu atribuire");
  await setValue(p, "input[aria-label='Data verificării']", "2026-11-08");
  await p.click("Salvează");
  await p.until("!document.querySelector('.source-form')");
  await clickIn(p, "activează");
  await p.until(`${row}.innerText.includes('activă')`, 5000);
  check("cu condiții, licență și dată se activează, cu numele celui care aprobă", (await p.eval(`${row}.innerText`)).includes("aprobată de Proprietar"));
  await p.screenshot(join(shots, "01-surse.png"));

  // Changing the licence switches it off.
  await clickIn(p, "modifică");
  await p.until("!!document.querySelector('.source-form')");
  await setValue(p, "input[aria-label='Licența']", "alta");
  await p.click("Salvează");
  await p.until(`${row}.innerText.includes('oprită')`, 5000);
  check("schimbarea licenței oprește sursa", true);
  await clickIn(p, "activează");
  await p.until(`${row}.innerText.includes('activă')`, 5000);

  stop(p);
  p = await start();
  await p.until(`!!${row}`, 5000);
  check("după repornire (forțată) sursa e tot activă", (await p.eval(`${row}.innerText`)).includes("activă"));
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
