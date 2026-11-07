// Etapa 4 step 4.1, end to end in the real window: the planner. Add people
// and a project, create tasks through the form, assign them, change status,
// filter by person and overdue, reopen the app — everything is still there.
//
// Usage: node app/e2e/planner.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node planner.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-planner-"));
const PORT = 9340;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const go = (p, label) => p.click(label, "nav .nav");
const rows = (p) =>
  p.eval("[...document.querySelectorAll('table.tasks tbody tr')].filter(r => r.cells.length > 2).map(r => r.cells[0].innerText.trim())");
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  return p;
}

async function newTask(p, { titlu, responsabil, termen, prioritate }) {
  await p.click("+ Task nou");
  await p.until("!!document.querySelector('.task-form')");
  await p.fill("input[aria-label='Titlu']", titlu);
  if (responsabil) await p.eval(`(() => { const s = document.querySelector("select[aria-label='Responsabil']");
      const o = [...s.options].find(o => o.textContent === ${JSON.stringify(responsabil)});
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value);
      s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  if (termen) await p.fill("input[aria-label='Termen']", termen);
  if (prioritate) await p.fill("select[aria-label='Prioritate']", prioritate);
  await p.click("Salvează", ".task-form button");
  await p.until(`[...document.querySelectorAll('table.tasks tbody tr')].some(r => r.cells[0]?.innerText.trim() === ${JSON.stringify(titlu)})`, 8000);
}

try {
  let p = await start();
  await go(p, "Catalog module");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Planificator'))";
  check("modulul Planificator apare în catalog ca beta", await p.eval(`${card}?.innerText.toLowerCase().includes('beta') ?? false`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Planificator'))");
  await go(p, "Planificator");

  // People and a project.
  await p.click("Persoane", ".sheet-tabs button");
  for (const [n, r] of [["Ana Popescu", "Contabil"], ["Ion Ionescu", "Depozit"]]) {
    await p.fill("input[aria-label='Nume persoană']", n);
    await p.fill("input[aria-label='Rol']", r);
    await p.click("Adaugă persoana");
    await p.until(`document.body.innerText.includes(${JSON.stringify(n)})`);
  }
  check("două persoane în echipă", (await p.eval("document.querySelectorAll('.list li').length")) === 2);
  await p.click("Proiecte", ".sheet-tabs button");
  await p.fill("input[aria-label='Nume proiect']", "Inventar decembrie");
  await p.click("Adaugă proiectul");
  await p.until("document.body.innerText.includes('Inventar decembrie')");

  // Tasks through the form.
  await p.click("Taskuri", ".sheet-tabs button");
  const now = new Date();
  const yesterday = iso(new Date(now.getTime() - 86400000));
  const nextWeek = iso(new Date(now.getTime() + 7 * 86400000));
  await newTask(p, { titlu: "Numără paleții", responsabil: "Ion Ionescu", termen: yesterday });
  await newTask(p, { titlu: "Facturile lunii", responsabil: "Ana Popescu", termen: nextWeek, prioritate: "urgenta" });
  await newTask(p, { titlu: "Comandă etichete" });
  check("trei taskuri, ordonate după termen", JSON.stringify(await rows(p)) === JSON.stringify(["Numără paleții", "Facturile lunii", "Comandă etichete"]), JSON.stringify(await rows(p)));
  const late = await p.eval("document.querySelector('table.tasks tbody tr').cells[3].innerText");
  check("taskul de ieri apare întârziat", late.includes("întârziat"), late);
  await p.screenshot(join(shots, "01-taskuri.png"));

  // Filter by person and overdue.
  await p.eval(`(() => { const s = document.querySelector("select[aria-label='Filtru responsabil']");
      const o = [...s.options].find(o => o.textContent === 'Ana Popescu');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value);
      s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await p.until("document.querySelectorAll('table.tasks tbody tr').length === 1");
  check("filtrul pe persoană", JSON.stringify(await rows(p)) === JSON.stringify(["Facturile lunii"]));
  await p.fill("select[aria-label='Filtru responsabil']", "*");
  await p.eval("document.querySelector('.filters input[type=checkbox]').click()");
  await p.until("document.querySelectorAll('table.tasks tbody tr').length === 1");
  check("filtrul „doar întârziate”", JSON.stringify(await rows(p)) === JSON.stringify(["Numără paleții"]));
  await p.eval("document.querySelector('.filters input[type=checkbox]').click()");
  await p.until("document.querySelectorAll('table.tasks tbody tr').length === 3");

  // Mark the overdue one done: it is no longer overdue.
  await p.fill("select[aria-label='Starea: Numără paleții']", "gata");
  await p.until("document.querySelector('.planner-summary')?.innerText.includes('Întârziate: 0')", 8000);
  check("după „Gata” nu mai e întârziat", true);
  await p.screenshot(join(shots, "02-gata.png"));

  // Restart: the data is still there.
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  p = await start();
  await go(p, "Planificator");
  await p.until("document.querySelectorAll('table.tasks tbody tr').length === 3", 10000);
  check("după repornire (forțată) totul e acolo", (await p.eval("document.querySelector('.planner-summary').innerText")).includes("Gata: 1"));

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
