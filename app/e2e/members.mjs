// 8.17, end to end in the real window: „Membri și cotizații” — the module enabled from the catalog, this year's
// dues of 120 lei for everyone, a member from 1 January (owes 120,00), a payment of 50 (rest 70,00), the year's
// overview, a general assembly with the member present (1 of 1), and the same after a restart.
//
// Usage: node app/e2e/members.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node members.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-members-"));
const PORT = 9380;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
    const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clickText = (p, text, scope = "") =>
  p.eval(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); b?.click(); return !!b; })()`);
const tab = async (p, name) => {
  await p.eval(`[...document.querySelectorAll('.members [role=tab]')].find(b => b.textContent.startsWith(${JSON.stringify(name)})).click()`);
  await sleep(400);
};
const z = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const now = new Date();
const today = iso(now);
const card = (p) => p.eval("document.querySelector('[aria-label=\"Fișa membrului\"]')?.innerText.replace(/\\s+/g, ' ') ?? ''");
const start = async () => {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  return p;
};
const stop = async (p) => {
  p.close();
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  } catch {
    /* gone */
  }
  await sleep(1500);
};
const openModule = async (p) => {
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Membri și cotizații'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Membri și cotizații')).click()");
  await p.until("!!document.querySelector('.members')", 8000);
};

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const cat = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Membri și cotizații')";
  await p.until(`!!${cat}`, 8000);
  check("modulul Membri și cotizații e în catalog, beta", await p.eval(`${cat}.innerText.toLowerCase().includes('beta')`));
  await p.eval(`${cat}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await openModule(p);
  const year = today.slice(0, 4);
  const jan1 = `${year}-01-01`;

  // This year's dues: 120 lei for everyone.
  await tab(p, "Cotizații");
  await setValue(p, "input[aria-label='Anul cotizației noi']", year);
  await setValue(p, "input[aria-label='Suma cotizației']", "120");
  await clickText(p, "Adaugă cotizația", ".members");
  await p.until("document.querySelector('.members-rates tbody')?.innerText.includes('120,00')", 8000);
  check("cotizația anului (120,00 pe an, pentru toți membrii) se salvează", (await p.eval("document.querySelector('.members-rates tbody').innerText")).includes("toți membrii"));

  // A member from 1 January: owes 120,00.
  await tab(p, "Membri");
  await setValue(p, "input[aria-label='Numele membrului']", "Ion Popa");
  await setValue(p, "input[aria-label='Data intrării']", jan1);
  await clickText(p, "Adaugă membrul", ".members");
  await p.until("!!document.querySelector('[aria-label=\"Fișa membrului\"]')", 8000);
  let c = await card(p);
  check(`membrul intrat la 1 ianuarie datorează 120,00 pe ${year}`, c.includes(year) && c.includes("120,00"), c.slice(0, 160));

  // A payment of 50: rest 70,00.
  await setValue(p, "input[aria-label='Suma încasată']", "50");
  await clickText(p, "Încasează", ".members");
  await p.until("document.querySelector('[aria-label=\"Fișa membrului\"]')?.innerText.includes('70,00')", 8000);
  c = await card(p);
  check("după o plată de 50: plătit 50,00, rest 70,00", c.includes("50,00") && c.includes("70,00"), c.slice(0, 200));

  // The year's overview.
  await tab(p, "Situația pe an");
  await p.until("!!document.querySelector('.members-situation tbody tr')", 8000);
  const sit = await p.eval("document.querySelector('.members').innerText");
  check("situația pe an: datorat 120,00, încasat 50,00, rest 70,00, un membru cu restanțe", sit.includes("120,00") && sit.includes("50,00") && sit.includes("70,00 lei") && sit.includes("1 membri cu restanțe"), sit.slice(0, 200));

  // A general assembly with the member present.
  await tab(p, "Ședințe");
  await setValue(p, "textarea[aria-label='Ordinea de zi']", "1. Bugetul anului viitor");
  await p.eval("document.querySelector(\"input[aria-label='Prezent: Ion Popa']\").click()");
  await setValue(p, "textarea[aria-label='Hotărârile']", "Bugetul se aprobă.");
  await clickText(p, "Salvează ședința", ".members");
  await p.until("!!document.querySelector('[data-testid=meeting]')", 8000);
  const m = await p.eval("document.querySelector('[data-testid=meeting]').innerText");
  check("ședința: prezenți 1 din 1 membri, cu hotărârile", m.includes("prezenți 1 din 1 membri") && m.includes("Bugetul se aprobă."), m.slice(0, 160));
  await p.screenshot(join(shots, "01-sedinta.png"));

  // After a restart.
  await stop(p);
  p = await start();
  await openModule(p);
  await p.until("!!document.querySelector('.members-list tbody button.link')", 8000);
  await p.eval("document.querySelector('.members-list tbody button.link').click()");
  await p.until("!!document.querySelector('[aria-label=\"Fișa membrului\"]')", 8000);
  c = await card(p);
  check("după repornire: aceeași situație a membrului (rest 70,00) și încasarea", c.includes("70,00") && c.includes("50,00 lei"), c.slice(0, 200));
  await p.screenshot(join(shots, "02-membru.png"));
  await stop(p);
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
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
