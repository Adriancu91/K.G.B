// Etapa 1 gate scenario, end to end in the real window:
//   the app starts, saves its configuration, enables/disables the
//   demonstration module and does not lose its data — across forced kills.
//
// Usage: node app/e2e/gate.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node gate.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-gate-"));
const PORT = 9334;
let proc;
let step = 0;
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function start() {
  const t0 = Date.now();
  proc = spawn(exe, [], {
    env: {
      ...process.env,
      KGB_DATA_DIR: data,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
    },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  await p.until("!!document.querySelector('aside') || !!document.querySelector('.fatal')", 15000);
  return { p, ms: Date.now() - t0 };
}

function forceKill(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}

async function shot(p, name) {
  await p.screenshot(join(shots, `${String(++step).padStart(2, "0")}-${name}.png`));
}

const nav = (p) => p.eval("[...document.querySelectorAll('nav .nav span:first-child')].map(e => e.textContent)");
// The notes are read and added through the module: its page is now the notes window of COS (7.4l-2), tested in cos-notes.
const call = (p, command, args = {}) => p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.notes", command, args })})`);
const notes = async (p) => (await call(p, "list")).map((n) => n.text);
const opened = (p) => p.until("!!document.querySelector('main .notes-window iframe')", 10000);
const go = (p, label) => p.click(label, "nav .nav");

try {
  // 1. First start: a default workspace is created.
  let { p, ms } = await start();
  check("pornire și spațiu de lucru implicit", (await p.text()).includes("Spațiul meu"), `${ms} ms până la interfață`);
  check("modulul demonstrativ nu e activ la început", !(await nav(p)).some((n) => n.startsWith("Note")));
  await shot(p, "pornire");

  // 2. Enable the module: the permission dialog is shown first.
  await go(p, "Catalog module");
  await p.click("Activează");
  const dialog = await p.eval("document.querySelector('.dialog')?.innerText ?? ''");
  check("dialogul arată permisiunea cerută", dialog.includes("storage.own"));
  await shot(p, "permisiuni");
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.startsWith('Note'))");
  check("modul activat, apare în meniu", true);

  // 3. Use it.
  await go(p, "Note");
  await opened(p);
  for (const t of ["Prima notă", "A doua notă — ăîșțâ"]) {
    await call(p, "add", { text: t });
    await sleep(5);
  }
  check("două note adăugate", (await notes(p)).length === 2, JSON.stringify(await notes(p)));
  await shot(p, "note");

  // 4. Save configuration: dark theme, compact density, profile Management, narrow sidebar.
  await go(p, "Setări");
  await p.fill("#theme", "dark");
  await p.fill("#density", "compact");
  await p.fill("#profile", "management");
  await sleep(400);
  await shot(p, "setari");
  // Ctrl+B hides the sidebar; the layout is saved like any other setting.
  await p.eval("window.dispatchEvent(new KeyboardEvent('keydown', {key: 'b', ctrlKey: true}))");
  await p.until("!!document.querySelector('aside.collapsed')");

  // 5. Forced kill, restart: configuration and data are back.
  forceKill(p);
  ({ p, ms } = await start());
  const html = await p.eval("({theme: document.documentElement.dataset.theme, density: document.documentElement.dataset.density})");
  check("tema și densitatea păstrate după oprire forțată", html.theme === "dark" && html.density === "compact", JSON.stringify(html));
  check("panoul lateral ascuns (Ctrl+B) rămâne ascuns", await p.eval("!!document.querySelector('aside.collapsed')"));
  await p.eval("window.dispatchEvent(new KeyboardEvent('keydown', {key: 'b', ctrlKey: true}))");
  await p.until("!document.querySelector('aside.collapsed')");
  check("profilul păstrat", (await p.text()).includes("Profil: Management"));
  await go(p, "Note");
  await opened(p);
  check("notele păstrate după oprire forțată", (await notes(p)).length === 2);
  await shot(p, "dupa-oprire");

  // 6. Disable: confirmation explains that data stays; module leaves the menu.
  await go(p, "Catalog module");
  await p.click("Dezactivează", ".card button");
  const confirm = await p.eval("document.querySelector('.dialog')?.innerText ?? ''");
  check("confirmarea spune că datele rămân", confirm.includes("rămân") && confirm.includes("2"));
  await p.click("Dezactivează", ".dialog button");
  await p.until("![...document.querySelectorAll('nav .nav')].some(e => e.textContent.startsWith('Note'))");
  const records = await p.eval("document.querySelector('.card')?.innerText ?? ''");
  check("modul dezactivat, datele numărate în catalog", records.includes("dezactivat") && /Înregistrări\s*2/.test(records));
  await shot(p, "dezactivat");

  // 7. Forced kill while disabled, restart, re-enable: nothing lost.
  forceKill(p);
  ({ p } = await start());
  check("starea „dezactivat” păstrată", !(await nav(p)).some((n) => n.startsWith("Note")));
  await go(p, "Catalog module");
  await p.click("Activează");
  await p.click("Acordă și activează");
  await go(p, "Note");
  await opened(p);
  check("după reactivare notele sunt toate acolo", (await notes(p)).join("|") === "A doua notă — ăîșțâ|Prima notă");
  await shot(p, "reactivat");

  // 8. Audit and diagnostics.
  await go(p, "Diagnostic");
  await p.until("document.querySelectorAll('.audit tbody tr').length > 2");
  const audit = await p.eval("document.querySelector('.audit').innerText");
  check("jurnalul de audit are activările și dezactivarea", audit.includes("enable") && audit.includes("disable"));
  const report = await p.eval("document.querySelector('.report').innerText");
  check("raportul de diagnostic nu conține textul notelor", !report.includes("Prima notă"));
  await shot(p, "diagnostic");
  forceKill(p);
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc?.pid)], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
} finally {
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
