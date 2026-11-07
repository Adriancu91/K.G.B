// Etapa 4 step 4.1, end to end in the real window: the planner. Add people
// and a project, create tasks through the form, assign them, change status,
// filter by person and overdue, reopen the app — everything is still there.
//
// Usage: node app/e2e/planner.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
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

  // Kanban: drag a card to another column; move one with the keyboard buttons.
  await p.click("Kanban", ".sheet-tabs button");
  await p.until("document.querySelectorAll('.kanban-col').length === 4");
  const drag = (cardTitle, targetSelector) =>
    p.eval(`(() => {
      const card = [...document.querySelectorAll('.task-card, .cal-task')].find(c => c.innerText.includes(${JSON.stringify(cardTitle)}));
      const target = document.querySelector(${JSON.stringify(targetSelector)});
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
      target.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      return true; })()`);
  const colOf = (title) =>
    p.eval(`[...document.querySelectorAll('.kanban-col')].find(c => [...c.querySelectorAll('.task-card')].some(x => x.innerText.includes(${JSON.stringify(title)})))?.dataset.stare`);
  await drag("Facturile lunii", ".kanban-col[data-stare='in_lucru']");
  await p.until(`[...document.querySelectorAll(".kanban-col[data-stare='in_lucru'] .task-card")].some(x => x.innerText.includes('Facturile lunii'))`, 8000);
  check("drag-and-drop în Kanban schimbă starea", (await colOf("Facturile lunii")) === "in_lucru");
  await p.click("", "button[aria-label='Mută „Comandă etichete” la dreapta']");
  await p.until(`[...document.querySelectorAll(".kanban-col[data-stare='in_lucru'] .task-card")].some(x => x.innerText.includes('Comandă etichete'))`, 8000);
  check("butonul → mută cardul (fără mouse)", (await colOf("Comandă etichete")) === "in_lucru");
  await p.screenshot(join(shots, "03-kanban.png"));

  // Calendar: the task is on its due day; drag it to another day.
  await p.click("Calendar", ".sheet-tabs button");
  await p.until("!!document.querySelector('.cal-grid')");
  await p.click("Săptămână", ".sheet-tabs button");
  await p.click("›", ".calendar button");
  const cellHas = (iso, title) =>
    p.eval(`!![...document.querySelectorAll(".cal-day[data-date='${iso}'] .cal-task")].find(x => x.innerText.includes(${JSON.stringify(title)}))`);
  await p.until(`!!document.querySelector(".cal-day[data-date='${nextWeek}']")`);
  check("taskul apare în calendar la termen", await cellHas(nextWeek, "Facturile lunii"));
  const target = iso(new Date(now.getTime() + 8 * 86400000));
  await drag("Facturile lunii", `.cal-day[data-date='${target}']`);
  await p.until(`!![...document.querySelectorAll(".cal-day[data-date='${target}'] .cal-task")].find(x => x.innerText.includes('Facturile lunii'))`, 8000);
  check("drag-and-drop în calendar mută termenul", !(await cellHas(nextWeek, "Facturile lunii")));
  await p.screenshot(join(shots, "04-calendar.png"));
  await p.click("Lună", ".sheet-tabs button");
  await p.click("Azi", ".calendar button");
  await p.screenshot(join(shots, "05-calendar-luna.png"));
  await p.click("Listă", ".sheet-tabs button");

  // Restart: the data is still there.
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  p = await start();
  await go(p, "Planificator");
  await p.until("document.querySelectorAll('table.tasks tbody tr').length === 3", 10000);
  const sum = await p.eval("document.querySelector('.planner-summary').innerText");
  check("după repornire (forțată) totul e acolo", sum.includes("Gata: 1") && sum.includes("În lucru: 2"), sum);

  // Step 4.3: a weekly task; marking it done creates next week's occurrence.
  // Three days ahead: no reminder (step 4.5) can interfere with the checks.
  const todayIso = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3));
  await p.click("+ Task nou");
  await p.until("!!document.querySelector('.task-form')");
  await p.fill("input[aria-label='Titlu']", "Raport săptămânal");
  await p.fill("input[aria-label='Termen']", todayIso);
  await p.click("+ Adaugă un punct", ".task-form button");
  await p.fill("input[aria-label='Punctul 1']", "trimis la contabil");
  await p.eval("document.querySelector(\"input[aria-label='Bifat: trimis la contabil']\").click()");
  await p.fill("select[aria-label='Repetare']", "saptamanal");
  await p.until("!!document.querySelector(\"[aria-label='Zilele săptămânii']\")");
  await p.screenshot(join(shots, "06-repetare-formular.png"));
  await p.click("Salvează", ".task-form button");
  await p.until("[...document.querySelectorAll('table.tasks tbody tr')].some(r => r.cells[0]?.innerText.includes('Raport săptămânal'))", 8000);
  const mark = await p.eval("[...document.querySelectorAll('table.tasks tbody tr')].find(r => r.cells[0].innerText.includes('Raport săptămânal')).querySelector('.repeats')?.getAttribute('aria-label') ?? ''");
  check("taskul repetat are semnul 🔁 cu regula", mark === "Se repetă: săptămânal", mark);
  await p.fill("select[aria-label='Starea: Raport săptămânal']", "gata");
  await p.until("document.querySelectorAll('table.tasks tbody tr').length === 5", 8000);
  const nextIso = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10));
  const occ = await p.eval(`[...document.querySelectorAll('table.tasks tbody tr')].filter(r => r.cells[0].innerText.includes('Raport săptămânal')).map(r => r.cells[3].innerText.trim() + '|' + r.cells[5].innerText.trim() + '|' + r.querySelector('select').value)`);
  const want = `${nextIso.split("-").reverse().join(".")}|0/1|de_facut`;
  check("„Gata” creează apariția de săptămâna viitoare, checklist debifat", occ.includes(want), JSON.stringify(occ));
  await p.screenshot(join(shots, "07-repetare-urmatorul.png"));

  // Step 4.4: the planner announced the next occurrence; the bell shows it.
  const bell = "document.querySelector('.notif .bell')";
  await p.until(`${bell}?.getAttribute('aria-label') === 'Notificări: 1 necitite'`, 10000);
  check("clopoțelul arată 1 notificare necitită", true);
  await p.eval(`${bell}.click()`);
  await p.until("!!document.querySelector('.notif-panel li')");
  const first = await p.eval("document.querySelector('.notif-panel li').innerText");
  check("notificarea spune ce urmează și de la ce modul", first.includes("Următorul: Raport săptămânal") && first.includes("Planificator"), first);
  await p.screenshot(join(shots, "08-notificari.png"));
  await p.click("", "button[aria-label='Marchează citit: Următorul: Raport săptămânal']");
  await p.until(`${bell}.getAttribute('aria-label') === 'Notificări'`, 8000);
  check("după „Marchează citit” nu mai e nimic necitit", !(await p.eval("!!document.querySelector('.notif .bell .count')")));
  await p.click("Șterge cele citite", ".notif-panel button");
  await p.until("document.querySelector('.notif-panel')?.innerText.includes('Nicio notificare')", 8000);
  check("„Șterge cele citite” golește lista", true);
  await p.eval(`${bell}.click()`);

  // Step 4.6: reports per person and project; exports reopen with the same data.
  await p.click("Rapoarte", ".sheet-tabs button");
  await p.until("document.querySelectorAll('table.report').length === 2", 8000);
  const rowsOf = (i) =>
    p.eval(`[...document.querySelectorAll('table.report')[${i}].querySelectorAll('tbody tr, tfoot tr')].map(r => [...r.cells].map(c => c.innerText.trim()).join('|'))`);
  const byPerson = await rowsOf(0);
  check(
    "raportul pe persoane are totalurile corecte",
    JSON.stringify(byPerson) ===
      JSON.stringify(["Ana Popescu|0|1|0|0|1|0", "Ion Ionescu|0|0|0|1|1|0", "Neatribuit|1|1|0|1|3|0", "Total|1|2|0|2|5|0"]),
    JSON.stringify(byPerson),
  );
  const byProject = await rowsOf(1);
  check("raportul pe proiecte", byProject[0]?.startsWith("Fără proiect|") && byProject.at(-1) === "Total|1|2|0|2|5|0", JSON.stringify(byProject));
  await p.screenshot(join(shots, "09-rapoarte.png"));
  const xlsx = join(data, "raport.xlsx");
  const csv = join(data, "taskuri.csv");
  const az = iso(new Date());
  const ex = (args) => p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", { id: "kgb.planner", command: "export_report", args: ${JSON.stringify(args)} })`);
  const rx = await ex({ azi: az, format: "xlsx", dest: xlsx });
  await ex({ azi: az, format: "csv", tabel: "taskuri", stil: "ro", dest: csv });
  const head = readFileSync(xlsx).subarray(0, 2).toString("latin1");
  check("exportul XLSX e un fișier Excel valid (verificat de aplicație la scriere)", rx.taskuri === 5 && head === "PK", JSON.stringify(rx));
  const csvText = readFileSync(csv, "utf8");
  check(
    "exportul CSV are capul de tabel și taskurile",
    csvText.startsWith("﻿Task;Responsabil;Proiect;Termen;") && csvText.includes("Facturile lunii;Ana Popescu;") && csvText.trim().split("\r\n").length === 6,
    csvText.split("\r\n")[0],
  );
  await p.click("Listă", ".sheet-tabs button");

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
