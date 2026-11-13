// 8.17, end to end in the real window: „Spații și chiriași” — the module enabled from the catalog, three premises,
// a lease on one of them, this month's utilities split by people, area and equally (exact to the ban, the free
// premises' part left to the owner), the tenant's month (1.500,00 + 263,33), the payment, and the same after a restart.
//
// Usage: node app/e2e/rentals.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node rentals.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-rentals-"));
const PORT = 9381;
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
  await p.eval(`[...document.querySelectorAll('.rentals [role=tab]')].find(b => b.textContent.startsWith(${JSON.stringify(name)})).click()`);
  await sleep(400);
};
const z = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const now = new Date();
const today = iso(now);
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
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Spații și chiriași'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Spații și chiriași')).click()");
  await p.until("!!document.querySelector('.rentals')", 8000);
};

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const cat = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Spații și chiriași')";
  await p.until(`!!${cat}`, 8000);
  check("modulul Spații și chiriași e în catalog, beta", await p.eval(`${cat}.innerText.toLowerCase().includes('beta')`));
  await p.eval(`${cat}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await openModule(p);
  const first = `${today.slice(0, 7)}-01`;

  // Three premises.
  await tab(p, "Spații");
  for (const [nume, mp, pers] of [["Ap. 1", "52,5", "2"], ["Ap. 2", "70", "3"], ["Birou", "35", "1"]]) {
    await setValue(p, "input[aria-label='Numele spațiului']", nume);
    await setValue(p, "input[aria-label='Clădirea']", "Bloc A");
    await setValue(p, "input[aria-label='Suprafața']", mp);
    await setValue(p, "input[aria-label='Persoanele']", pers);
    await clickText(p, "Adaugă spațiul", ".rentals");
    await p.until(`document.querySelector('.rentals-premises tbody')?.innerText.includes(${JSON.stringify(nume)})`, 8000);
  }
  check("trei spații adăugate, cu suprafața și persoanele", (await p.eval("document.querySelectorAll('.rentals-premises tbody tr').length")) === 3);

  // A lease on Ap. 1 from the first of this month, 1.500 lei a month.
  await tab(p, "Contracte");
  const ap1 = await p.eval("[...document.querySelectorAll(\"select[aria-label='Spațiul contractului'] option\")].find(o => o.textContent.includes('Ap. 1')).value");
  await setValue(p, "select[aria-label='Spațiul contractului']", ap1);
  await setValue(p, "input[aria-label='Chiriașul']", "Popescu Ion");
  await setValue(p, "input[aria-label='Începutul contractului']", first);
  await setValue(p, "input[aria-label='Chiria pe lună']", "1500");
  await clickText(p, "Adaugă contractul", ".rentals");
  await p.until("document.querySelector('.rentals-leases tbody')?.innerText.includes('Popescu Ion')", 8000);
  check("contractul se adaugă", true);

  // This month's utilities: water 600 by people, cleaning 100 by area, administration 90 equally.
  await tab(p, "Luna");
  for (const [fel, suma, cheie] of [["Apă", "600", "persoane"], ["Curățenie", "100", "suprafata"], ["Administrare", "90", "egal"]]) {
    await setValue(p, "input[aria-label='Felul utilității']", fel);
    await setValue(p, "input[aria-label='Suma utilității']", suma);
    await setValue(p, "select[aria-label='Cum se împarte']", cheie);
    await clickText(p, "Adaugă utilitatea", ".rentals");
    await p.until(`document.querySelector('.rentals-split')?.innerText.includes(${JSON.stringify(fel)})`, 8000);
  }
  const split = await p.eval("[...document.querySelectorAll('.rentals-split tbody tr')].map(r => r.innerText.replace(/\\s+/g, ' '))");
  const row = (n) => split.find((r) => r.startsWith(n)) ?? "";
  check("împărțirea: Ap. 1 263,33 (Popescu), Ap. 2 374,45 și Birou 152,22 libere", row("Ap. 1").includes("263,33") && row("Ap. 1").includes("Popescu") && row("Ap. 2").includes("374,45") && row("Birou").includes("152,22") && row("Birou").includes("liber"), JSON.stringify(split));
  const month = await p.eval("document.querySelector('[data-testid=month-row]')?.innerText.replace(/\\s+/g, ' ') ?? ''");
  check("luna: Popescu datorează 1.500,00 chirie + 263,33 utilități = 1.763,33", month.includes("1.500,00") && month.includes("263,33") && month.includes("1.763,33"), month);

  // The payment.
  await setValue(p, "input[aria-label='Suma de la Popescu Ion']", "1763,33");
  await clickText(p, "Încasează", ".rentals");
  await p.until("[...document.querySelectorAll('[data-testid=month-row] td')].some(td => td.innerText === '0,00')", 8000);
  check("după încasare: rest 0,00", true);
  await p.screenshot(join(shots, "01-luna.png"));

  // After a restart.
  await stop(p);
  p = await start();
  await openModule(p);
  await p.until("!!document.querySelector('[data-testid=month-row]')", 8000);
  const again = await p.eval("document.querySelector('.rentals').innerText.replace(/\\s+/g, ' ')");
  check("după repornire: încasat 1.763,33, utilitățile spațiilor libere 526,67 rămân ale proprietarului", again.includes("1.763,33") && again.includes("526,67"), again.slice(0, 240));
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
