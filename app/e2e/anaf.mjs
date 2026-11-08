// Etapa 7 step 7.4b, end to end in the real window: "Caută la ANAF".
// ANAF is in "Surse externe" filled in but switched off; while it is off the
// lookup is refused with a clear message; once switched on, one real request
// fills the partner card (denumire, Registrul Comerțului, sediu, localitate)
// and marks the values as coming from ANAF; saved, they stay.
// Sends ONE request to the public ANAF service (a public CUI). No screenshot
// shows the company's data.
//
// Usage: node app/e2e/anaf.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node anaf.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-anaf-"));
const PORT = 9352;
const CUI = "14399840";
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const setValue = (p, sel, value) =>
  p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const val = (p, label) => p.eval(`document.querySelector("input[aria-label='${label}']").value`);
const anafRow = "[...document.querySelectorAll('.sources-table tbody tr')].find(r => r.innerText.includes('ANAF'))";

async function newCard(p) {
  await p.click("Parteneri", "nav .nav");
  await p.until("!!document.querySelector('.partners-page')");
  await p.click("Partener nou");
  await p.until("!!document.querySelector('.partner-editor')");
  await setValue(p, "input[aria-label='CUI']", CUI);
}

try {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);

  await p.click("Surse externe", "nav .nav");
  await p.until(`!!${anafRow}`, 5000);
  check("ANAF e în „Surse externe”, completată dar oprită", (await p.eval(`${anafRow}.innerText`)).includes("oprită"));

  await newCard(p);
  await p.click("Caută la ANAF");
  await p.until("!!document.querySelector('.anaf-note.error')", 5000);
  const off = await p.eval("document.querySelector('.anaf-note.error').innerText");
  check("cât e oprită, căutarea e refuzată cu explicație", off.includes("oprită") && off.includes("Surse externe"), off);
  await p.screenshot(join(shots, "01-anaf-oprita.png"));
  await p.click("Renunță");

  await p.click("Surse externe", "nav .nav");
  await p.until(`!!${anafRow}`, 5000);
  await p.eval(`[...${anafRow}.querySelectorAll('button')].find(b => b.innerText === 'activează').click()`);
  await p.until(`${anafRow}.innerText.includes('activă')`, 5000);
  check("proprietarul o pornește", true);

  await newCard(p);
  await p.click("Caută la ANAF");
  await p.until("!!document.querySelector('.anaf-note')", 30000);
  const note = await p.eval("document.querySelector('.anaf-note').innerText");
  check("căutarea reală la ANAF reușește", (await p.eval("!document.querySelector('.anaf-note.error')")) && note.includes("Completat de la ANAF"), note.slice(0, 80));
  const filled = [await val(p, "Denumire"), await val(p, "Nr. Registrul Comerțului"), await val(p, "Sediu"), await val(p, "Localitate")];
  check("denumirea, Registrul Comerțului, sediul și localitatea sunt completate", filled.every((x) => x.trim().length > 0), filled.map((x) => x.length).join(","));
  const marks = await p.eval("[...document.querySelectorAll('.partner-grid .small')].filter(s => s.innerText === 'de la ANAF').length");
  check("valorile sunt marcate „de la ANAF”", marks >= 4, String(marks));

  // A value changed by hand is no longer marked as coming from ANAF.
  await setValue(p, "input[aria-label='Telefon']", "0700 000 000");
  await setValue(p, "input[aria-label='Localitate']", "Altă localitate");
  const marks2 = await p.eval("[...document.querySelectorAll('.partner-grid .small')].filter(s => s.innerText === 'de la ANAF').length");
  check("o valoare schimbată de mână pierde marcajul", marks2 < marks, `${marks} → ${marks2}`);
  await p.click("Salvează fișa");
  await p.until("!!document.querySelector('.partners-table')", 5000);
  await p.eval("document.querySelector('.partners-table tbody tr').click()");
  await p.until("!!document.querySelector('.partner-editor')");
  const kept = await p.eval("[...document.querySelectorAll('.partner-grid .small')].filter(s => s.innerText === 'de la ANAF').length");
  check("după salvare, proveniența rămâne", kept === marks2, String(kept));

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
