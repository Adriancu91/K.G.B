// Etapa 6 step 6.4, end to end in the real window, with a real
// synchronisation conflict: a note is written in the app; the helper
// `make_conflict` (crates/kgb-core/examples) makes a second copy of the
// workspace, both copies change the note offline and are synchronised; the
// app shows the conflict with both values; keeping the other PC's value
// changes the note and the conflict is gone, also after a forced restart.
//
// Usage: node app/e2e/conflicts.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

// The demo commands of kgb.notes (the Note page is the COS Notes window since 7.4l-2c).
const demoNotes = (p) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", {id: "kgb.notes", command: "list", args: {}}).then(l => l.map(n => n.text))`);
const demoAdd = (p, text) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.notes", command: "add", args: { text } })}).then(() => "ok", (e) => String(e))`);

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node conflicts.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-conflicts-"));
const PORT = 9347;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

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
const noteTexts = (p) => demoNotes(p);

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Note')";
  await p.until(`!!${card}`);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Note'))");
  await demoAdd(p, "Nota de test");
  await p.until(`window.__TAURI_INTERNALS__.invoke("module_call", {id: "kgb.notes", command: "list", args: {}}).then(l => l.some(n => n.text.includes("Nota de test")))`);
  await p.click("Dispozitive și sincronizare", "nav .nav");
  await p.until("!!document.querySelector('.conflicts-page')");
  check("fără sincronizare: niciun conflict", (await p.eval("document.querySelector('.conflicts-page').innerText")).includes("Niciun conflict"));
  stop(p);
  await sleep(500);

  const out = execFileSync("cargo", ["run", "-q", "-p", "kgb-core", "--example", "make_conflict", "--", data], { encoding: "utf8" });
  check("ajutorul a creat un conflict real (două copii sincronizate)", out.includes("conflicte: 1"), out.trim());

  p = await start();
  await p.click("Dispozitive și sincronizare", "nav .nav");
  await p.until("!!document.querySelector('.conflicts-table tbody tr')", 8000);
  const row = await p.eval("document.querySelector('.conflicts-table tbody tr').innerText");
  check("conflictul apare cu ambele valori", row.includes("Versiunea de pe acest PC") && row.includes("Versiunea de pe celălalt PC") && row.includes("Note"), row);
  await p.screenshot(join(shots, "01-conflict.png"));
  await p.click("Păstrează venit");
  await p.until("document.querySelector('.conflicts-page').innerText.includes('Niciun conflict')", 5000);
  check("după alegere conflictul dispare", true);
  await p.until(`window.__TAURI_INTERNALS__.invoke("module_call", {id: "kgb.notes", command: "list", args: {}}).then(l => l.length > 0)`);
  const notes = await noteTexts(p);
  check("nota are valoarea aleasă", notes.some((n) => n.includes("Versiunea de pe celălalt PC")) && !notes.some((n) => n.includes("acest PC")), notes.join(" | "));
  await p.screenshot(join(shots, "02-ales.png"));
  stop(p);

  p = await start();
  await p.click("Dispozitive și sincronizare", "nav .nav");
  await p.until("!!document.querySelector('.conflicts-page')");
  await sleep(300);
  check("după repornire (forțată) conflictul rămâne rezolvat", (await p.eval("document.querySelector('.conflicts-page').innerText")).includes("Niciun conflict"));
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
