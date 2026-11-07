// Etapa 4 step 4.5, end to end in the real window: reminders. Tasks due today
// and tomorrow; after a (forced) restart the app's reminder round puts them in
// the notification centre; another restart does not repeat them.
//
// Usage: node app/e2e/reminders.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
// The Windows pop-ups themselves are not checked here (they belong to Windows
// and depend on its settings); the notification centre is.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node reminders.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-remind-"));
const PORT = 9341;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const call = (p, cmd, args) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", { id: "kgb.planner", command: ${JSON.stringify(cmd)}, args: ${JSON.stringify(args)} })`);
const titles = (p) => p.eval("window.__TAURI_INTERNALS__.invoke('notifications_list').then(r => r.items.map(n => n.titlu))");

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
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}

try {
  let p = await start();
  // Enable the planner (granting what it asks, notifications included).
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Planificator'))";
  const perms = await p.eval(`${card}.querySelector('button').click(), new Promise(r => setTimeout(() => r(document.querySelector('[role=alertdialog]')?.innerText ?? ''), 300))`);
  check("la activare se vede permisiunea de notificări", perms.includes("notify.send"), perms.split("\n").find((l) => l.includes("notify")) ?? "");
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Planificator'))");

  const now = new Date();
  const today = iso(now);
  const tomorrow = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const later = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5));
  await call(p, "task_save", { titlu: "Plata furnizorului", termen: today, prioritate: "urgenta" });
  await call(p, "task_save", { titlu: "Inventar raft A", termen: tomorrow });
  await call(p, "task_save", { titlu: "Peste cinci zile", termen: later });
  const done = await call(p, "task_save", { titlu: "Deja făcut", termen: today });
  await call(p, "task_status", { id: done.id, version: done.version, stare: "gata" });

  // Restart: the first reminder round runs at start.
  stop(p);
  p = await start();
  await p.until("document.querySelector('.notif .bell')?.getAttribute('aria-label') === 'Notificări: 2 necitite'", 15000);
  const t1 = await titles(p);
  check(
    "la pornire: memento pentru azi și pentru mâine, nimic pentru cele făcute sau mai târziu",
    JSON.stringify([...t1].sort()) === JSON.stringify(["Azi: Plata furnizorului", "Mâine: Inventar raft A"]),
    JSON.stringify(t1),
  );
  await p.eval("document.querySelector('.notif .bell').click()");
  await p.until("document.querySelectorAll('.notif-panel li').length === 2");
  await p.screenshot(join(shots, "01-memento.png"));
  await p.click("Marchează toate citite", ".notif-panel button");
  await p.until("document.querySelector('.notif .bell').getAttribute('aria-label') === 'Notificări'", 8000);
  await p.click("Șterge cele citite", ".notif-panel button");
  await p.until("document.querySelector('.notif-panel')?.innerText.includes('Nicio notificare')", 8000);

  // Restart again (forced): the reminders are not repeated, even though the
  // notifications were cleared.
  stop(p);
  p = await start();
  await sleep(3000);
  const t2 = await titles(p);
  check("după încă o repornire nu se repetă (nici după ce le-ai șters)", t2.length === 0, JSON.stringify(t2));
  const bell = await p.eval("document.querySelector('.notif .bell').getAttribute('aria-label')");
  check("clopoțelul nu arată nimic necitit", bell === "Notificări", bell);
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
