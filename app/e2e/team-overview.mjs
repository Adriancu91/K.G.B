// Etapa 7 step 7.4h, end to end in the real window: „Echipa pe scurt”.
// Without an organization the page explains itself; with one, the
// administrator sees their own card (initials, "activ acum"), writes what
// they work on and picks a colour, and sees it as the others would; a
// planner task "în lucru" assigned to them shows on the card. That a member
// sees only their own card, and that a forged card is refused, is tested
// between two PCs in crates/kgb-net/tests/presence.rs.
//
// Usage: node app/e2e/team-overview.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node team-overview.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-teamov-"));
const PORT = 9357;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const iso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

try {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);

  await p.click("Echipa pe scurt", "nav .nav");
  await p.until("document.querySelector('main').innerText.includes('apare după ce firma are o organizație')", 5000);
  check("fără organizație, pagina spune când apare", true);

  // An organization, a planner person with the same name and a task in progress.
  await invoke(p, "org_create", { name: "Firma Test SRL", admin: "Ana Pop" });
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Planificator'))";
  await p.until(`!!${card}`, 5000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Planificator'))", 5000);
  const person = await invoke(p, "module_call", { id: "kgb.planner", command: "person_save", args: { nume: "Ana Pop" } });
  const task = await invoke(p, "module_call", { id: "kgb.planner", command: "task_save", args: { titlu: "Ofertă pentru Alfa", responsabil: person.id } });
  await invoke(p, "module_call", { id: "kgb.planner", command: "task_status", args: { id: task.id, version: task.version, stare: "in_lucru" } });
  await invoke(p, "reminders_tick", { azi: iso() });

  await p.click("Acasă", "nav .nav");
  await p.click("Echipa pe scurt", "nav .nav");
  await p.until("!!document.querySelector(\".member-grid .member-card[data-member='Ana Pop']\")", 8000);
  const c = await p.eval("document.querySelector(\".member-grid .member-card[data-member='Ana Pop']\").innerText");
  check("administratorul se vede: inițiale, „activ acum”", c.includes("AP") && c.includes("activ acum"), c.replace(/\n/g, " | "));
  check("taskul „în lucru” din Planificator apare pe fișă", c.includes("în lucru: Ofertă pentru Alfa"));

  await p.fill("input[aria-label='La ce lucrez']", "închiderea de lună");
  await p.fill("select[aria-label='Culoarea pictogramei']", "masliniu");
  await p.click("Salvează", ".member-self button");
  await p.until("document.querySelector(\".member-grid .member-card[data-member='Ana Pop']\").innerText.includes('închiderea de lună')", 8000);
  check("„la ce lucrez” scris de membru apare pe fișă", true);
  check("culoarea aleasă se folosește", await p.eval("!!document.querySelector('.member-grid .avatar.c-masliniu')"));
  check("membrul vede ce se arată despre el", (await p.eval("document.querySelector('.member-self').innerText")).includes("Ce văd administratorii despre tine"));
  const text = await p.eval("document.querySelector('.team-overview').innerText");
  check("pagina spune ce NU se urmărește", text.includes("Nu se urmăresc ecranul, ferestrele, tastatura sau locul"));
  await p.screenshot(join(shots, "01-echipa.png"));

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
