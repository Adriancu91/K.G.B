// 8.17, end to end in the real window: „Cursuri și cursanți” — the module enabled from the catalog, a trainee with
// her parent, a group every day of the week from the first of last month at 250 lei a month, the trainee enrolled
// from that day (owes 2 months = 500,00 lei), a payment of 200 (rest 300,00), today's attendance ticked, the arrears
// tab with the total, and the same after a restart.
//
// Usage: node app/e2e/courses.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node courses.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-courses-"));
const PORT = 9379;
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
  await p.eval(`[...document.querySelectorAll('.courses [role=tab]')].find(b => b.textContent.startsWith(${JSON.stringify(name)})).click()`);
  await sleep(400);
};
const z = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const now = new Date();
const today = iso(now);
const firstOfLast = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
const later = iso(new Date(now.getFullYear(), now.getMonth() + 6, 1));
const row = (p, name) => p.eval(`[...document.querySelectorAll('[data-testid=trainee-row]')].find(r => r.innerText.includes(${JSON.stringify(name)}))?.innerText.replace(/\\s+/g, ' ') ?? ''`);
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
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Cursuri și cursanți'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Cursuri și cursanți')).click()");
  await p.until("!!document.querySelector('.courses')", 8000);
};

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Cursuri și cursanți')";
  await p.until(`!!${card}`, 8000);
  check("modulul Cursuri și cursanți e în catalog, beta", await p.eval(`${card}.innerText.toLowerCase().includes('beta')`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await openModule(p);

  // A trainee with her parent.
  await tab(p, "Cursanți");
  await setValue(p, "input[aria-label='Numele cursantului']", "Ana Ionescu");
  await setValue(p, "input[aria-label='Părintele sau tutorele']", "Elena Ionescu");
  await setValue(p, "input[aria-label='Telefonul cursantului']", "0744 111 222");
  await clickText(p, "Adaugă cursantul", ".courses");
  await p.until("document.querySelector('.courses-trainees tbody')?.innerText.includes('Ana Ionescu')", 8000);
  check("cursantul se adaugă, cu părintele", (await p.eval("document.querySelector('.courses-trainees tbody').innerText")).includes("Elena Ionescu"));

  // A group every day, 250 lei a month, from the first of last month.
  await tab(p, "Grupe");
  await setValue(p, "input[aria-label='Numele grupei']", "Engleză A1");
  await setValue(p, "input[aria-label='Formatorul']", "Maria Pop");
  await setValue(p, "input[aria-label='Începutul grupei']", firstOfLast);
  await setValue(p, "input[aria-label='Sfârșitul grupei']", later);
  for (const d of ["L", "Ma", "Mi", "J", "V", "S", "D"]) await p.eval(`document.querySelector("input[aria-label='Ziua ${d}']").click()`);
  await setValue(p, "input[aria-label='Taxa în lei']", "250");
  await clickText(p, "Adaugă grupa", ".courses");
  await p.until("!!document.querySelector('[aria-label=\"Grupa deschisă\"]')", 8000);
  check("grupa se adaugă și se deschide, cu ședințele lunii", (await p.eval("document.querySelectorAll('.courses-sessions button').length")) >= 28);

  // Enrolled from the first of last month: owes 2 × 250,00.
  await setValue(p, "select[aria-label='Cursantul de înscris']", await p.eval("[...document.querySelectorAll(\"select[aria-label='Cursantul de înscris'] option\")].find(o => o.textContent === 'Ana Ionescu').value"));
  await setValue(p, "input[aria-label='Înscris de la']", firstOfLast);
  await clickText(p, "Înscrie", ".courses");
  await p.until("!!document.querySelector('[data-testid=trainee-row]')", 8000);
  let r = await row(p, "Ana Ionescu");
  check("înscrisă de luna trecută: datorează 500,00 (2 luni × 250)", r.includes("500,00"), r);

  // A payment of 200: rest 300,00.
  await setValue(p, "input[aria-label='Suma de la Ana Ionescu']", "200");
  await clickText(p, "Încasează", ".courses");
  await p.until("[...document.querySelectorAll('[data-testid=trainee-row]')].some(r => r.innerText.includes('300,00'))", 8000);
  r = await row(p, "Ana Ionescu");
  check("după o plată de 200: plătit 200,00, rest 300,00", r.includes("200,00") && r.includes("300,00"), r);

  // Today's attendance.
  const dd = today.slice(8);
  await p.eval(`[...document.querySelectorAll('.courses-sessions button')].find(b => b.textContent.trim().endsWith(' ${dd}')).click()`);
  await p.until("!!document.querySelector('.courses-attendance')", 5000);
  const ticked = await p.eval("document.querySelector(\"input[aria-label='Prezent: Ana Ionescu']\").checked");
  await clickText(p, "Salvează prezența", ".courses");
  await p.until(`[...document.querySelectorAll('.courses-sessions button')].some(b => b.textContent.includes(' ${dd} · 1'))`, 8000);
  r = await row(p, "Ana Ionescu");
  check("prezența de azi: bifată din oficiu, salvată (1 / 1)", ticked && r.includes("1 / 1"), r);
  await p.screenshot(join(shots, "01-grupa.png"));

  // Arrears.
  await tab(p, "Restanțe");
  await p.until("document.querySelector('.courses')?.innerText.includes('Total de încasat')", 8000);
  const arr = await p.eval("document.querySelector('.courses').innerText.replace(/\\s+/g, ' ')");
  check("restanțele: total de încasat 300,00 lei, cu Ana Ionescu", arr.includes("300,00 lei") && arr.includes("Ana Ionescu"), arr.slice(0, 200));
  await p.screenshot(join(shots, "02-restante.png"));

  // After a restart.
  await stop(p);
  p = await start();
  await openModule(p);
  await p.until("!!document.querySelector('.courses-groups tbody button.link')", 8000);
  await p.eval("document.querySelector('.courses-groups tbody button.link').click()");
  await p.until("!!document.querySelector('[data-testid=trainee-row]')", 8000);
  r = await row(p, "Ana Ionescu");
  check("după repornire: aceleași sume și prezența (500,00 / 200,00 / 300,00, 1 / 1)", r.includes("500,00") && r.includes("300,00") && r.includes("1 / 1"), r);
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
