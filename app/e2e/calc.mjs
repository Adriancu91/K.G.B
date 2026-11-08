// Etapa 7 step 7.4, end to end in the real window: Calculator and
// conversions — exact arithmetic, an inexact result marked, Romanian number
// notation, a conversion, VAT and markup in bani; the history survives a
// forced restart.
//
// Usage: node app/e2e/calc.mjs <path-to-kgb-app.exe> <screenshot-dir>
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node calc.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-calc-"));
const PORT = 9352;
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
const tab = (p, label) => p.eval(`[...document.querySelectorAll('.calc .sheet-tabs button')].find(b => b.innerText.startsWith(${JSON.stringify(label)})).click()`);
const status = (p, form) => p.eval(`document.querySelector("form[aria-label='${form}'] [role=status]")?.innerText ?? document.querySelector('.calc [role=status]')?.innerText ?? ''`);

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
async function compute(p, expr) {
  await setValue(p, "input[aria-label='Expresia']", expr);
  await p.click("=");
  await p.until(`(document.querySelector('.calc .calc-result')?.innerText ?? '').length > 0 && document.querySelector('.calc-history')?.innerText.includes(${JSON.stringify(expr)})`, 5000);
  return p.eval("document.querySelector('.calc .calc-result').innerText");
}

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Calculator și conversii')";
  await p.until(`!!${card}`);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Calculator'))");
  await p.click("Calculator și conversii", "nav .nav");
  await p.until("!!document.querySelector(\"input[aria-label='Expresia']\")");

  check("0,1 + 0,2 = 0,3 exact", (await compute(p, "0,1 + 0,2")) === "= 0,3");
  const third = await compute(p, "1/3");
  check("1/3 apare rotunjit și marcat „≈”", third.startsWith("≈ 0,3333333333"), third);
  check("punctul desparte miile: 10.000 × 3 = 30.000", (await compute(p, "10.000 × 3")) === "= 30.000");

  await tab(p, "Conversii");
  await p.until("!!document.querySelector(\"form[aria-label='Conversie']\")");
  await p.click("Convertește");
  await p.until("!!document.querySelector(\"form[aria-label='Conversie'] [role=status]\")", 5000);
  check("1 țol = 2,54 centimetri", (await status(p, "Conversie")).includes("2,54"));

  await tab(p, "TVA");
  await setValue(p, "input[aria-label='Suma TVA']", "121");
  await setValue(p, "select[aria-label='Suma este']", "brut");
  await p.eval("document.querySelector(\"form[aria-label='TVA'] button\").click()");
  await p.until("!!document.querySelector(\"form[aria-label='TVA'] [role=status]\")", 5000);
  check("121 lei cu TVA 21% = 100 net + 21 TVA", (await status(p, "TVA")).includes("net 100,00 + TVA 21,00"), await status(p, "TVA"));
  await setValue(p, "input[aria-label='Costul']", "80");
  await setValue(p, "input[aria-label='Prețul']", "100");
  await p.eval("document.querySelector(\"form[aria-label='Adaos'] button\").click()");
  await p.until("!!document.querySelector(\"form[aria-label='Adaos'] [role=status]\")", 5000);
  const ad = await status(p, "Adaos");
  check("cost 80, preț 100: adaos 25%, marjă 20%", ad.includes("adaos 25%") && ad.includes("marjă 20%"), ad);
  await p.screenshot(join(shots, "01-calcule.png"));

  stop(p);
  p = await start();
  await p.click("Calculator și conversii", "nav .nav");
  await p.until("!!document.querySelector('.calc-history')", 8000);
  const h = await p.eval("document.querySelector('.calc-history').innerText");
  check("după repornire (forțată) istoricul rămâne", h.includes("10.000 × 3") && h.includes("0,1 + 0,2"), h);
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
