// Etapa 7 step 7.3, end to end in the real window: Team and timesheet.
// An employee, a shift used to fill a day, a night shift past midnight,
// a leave requested and approved, pontaj refused on a leave day, the monthly
// report with the hand-computed totals; a forced restart keeps everything.
//
// Usage: node app/e2e/team.mjs <path-to-kgb-app.exe> <screenshot-dir>
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node team.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-team-"));
const PORT = 9351;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const setValue = (p, sel, value) =>
  p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const selectText = (p, sel, text) =>
  p.eval(`(() => { const s = document.querySelector(${JSON.stringify(sel)});
    const o = [...s.options].find(o => o.textContent === ${JSON.stringify(text)});
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value);
    s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
const tab = (p, label) => p.eval(`[...document.querySelectorAll('.team .sheet-tabs button')].find(b => b.innerText === ${JSON.stringify(label)}).click()`);

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
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Echipă și pontaj')";
  await p.until(`!!${card}`);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Echipă'))");
  await p.click("Echipă și pontaj", "nav .nav");
  await p.until("!!document.querySelector('.team')");
  check("pagina spune că nu urmărește pe nimeni", (await p.eval("document.querySelector('.team').innerText")).includes("nu urmărește calculatorul"));

  await tab(p, "Angajați");
  await setValue(p, "input[aria-label='Numele angajatului']", "Ana Test");
  await p.click("Adaugă angajatul");
  await p.until("!!document.querySelector('.employees-table tbody tr')");
  await tab(p, "Ture");
  await setValue(p, "input[aria-label='Numele turei']", "Tura de zi");
  await p.click("Adaugă tura");
  await p.until("document.querySelector('.team').innerText.includes('Tura de zi')");

  await tab(p, "Pontaj");
  await setValue(p, "input[aria-label='Luna']", "2026-11");
  await p.until("!!document.querySelector(\"select[aria-label='Angajatul']\")");
  await selectText(p, "select[aria-label='Angajatul']", "Ana Test");
  await setValue(p, "input[aria-label='Ziua']", "2026-11-02");
  await selectText(p, "select[aria-label='Tura']", "Tura de zi");
  await p.click("Pontează");
  await p.until("document.querySelectorAll('.timesheet-table tbody tr').length === 1", 5000);
  await setValue(p, "input[aria-label='Ziua']", "2026-11-03");
  await setValue(p, "input[aria-label='Intrare']", "22:00");
  await setValue(p, "input[aria-label='Ieșire']", "06:00");
  await p.click("Pontează");
  await p.until("document.querySelectorAll('.timesheet-table tbody tr').length === 2", 5000);
  const ts = await p.eval("[...document.querySelectorAll('.timesheet-table tbody tr')].map(r => r.innerText).join(' | ')");
  check("tura de zi = 8:00, tura de noapte (peste miezul nopții) = 7:30", ts.includes("8:00") && ts.includes("7:30"), ts);

  // Leave 5–11 Nov, approved; pontaj on 6 Nov refused.
  await tab(p, "Concedii");
  await selectText(p, "select[aria-label='Angajatul concediului']", "Ana Test");
  await setValue(p, "input[aria-label='De la']", "2026-11-05");
  await setValue(p, "input[aria-label='Până la']", "2026-11-11");
  await p.click("Cere concediul");
  await p.until("!!document.querySelector('.leave-table tbody tr')");
  await p.click("Aprobă");
  await p.until("document.querySelector('.leave-table tbody tr').innerText.includes('aprobat')", 5000);
  await tab(p, "Pontaj");
  await p.until("!!document.querySelector(\"select[aria-label='Angajatul']\")");
  await selectText(p, "select[aria-label='Angajatul']", "Ana Test");
  await setValue(p, "input[aria-label='Ziua']", "2026-11-06");
  await p.click("Pontează");
  await p.until("!!document.querySelector('.error')", 5000);
  check("pontajul pe o zi de concediu aprobat e refuzat", (await p.eval("document.querySelector('.error').innerText")).includes("concediu aprobat"));

  await tab(p, "Raport lunar");
  await p.until("!!document.querySelector('.team-report tbody tr')");
  const row = await p.eval("document.querySelector('.team-report tbody tr').innerText");
  check("raportul lunar: 2 zile, 15:30 ore, 5 zile de odihnă", row.includes("Ana Test") && row.includes("15:30") && /\b5\b/.test(row), row);
  await p.screenshot(join(shots, "01-raport.png"));

  stop(p);
  p = await start();
  await p.click("Echipă și pontaj", "nav .nav");
  await p.until("!!document.querySelector('.team')");
  await tab(p, "Raport lunar");
  await setValue(p, "input[aria-label='Luna']", "2026-11");
  await p.until("!!document.querySelector('.team-report tbody tr') && document.querySelector('.team-report tbody tr').innerText.includes('15:30')", 8000);
  check("după repornire (forțată) totalurile sunt aceleași", true);
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
