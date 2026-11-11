// Etapa 2 step 2.9, end to end in the real window: backup, change, verify,
// restore as a new workspace (D-030), reopen the original — nothing lost.
//
// Usage: node app/e2e/backup.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node backup.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-backup-"));
const PORT = 9336;
let proc;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  await p.until("!!document.querySelector('aside')", 15000);
  return p;
}
const go = (p, label) => p.click(label, "nav .nav");
// The notes are written and read through the Notes module's simple commands (kept for the tests since its page
// became the notebook window, 7.4l-2): what matters here is the data that a backup keeps.
const notesCall = (p, command, args = {}) => p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.notes", command, args })})`);
const notes = async (p) => (await notesCall(p, "list")).map((n) => n.text);
async function addNote(p, t) {
  await notesCall(p, "add", { text: t });
}
/** Waits for the page to come back after a workspace switch (full reload). */
async function afterReload(p) {
  await sleep(800);
  await p.until("!!document.querySelector('aside') && !!document.querySelector('.status')", 15000);
}

try {
  let p = await start();
  await go(p, "Catalog module");
  await p.click("Activează");
  await p.click("Acordă și activează");
  await addNote(p, "înainte de backup");

  await go(p, "Date și backup");
  await p.click("Fă un backup acum");
  await p.until("document.body.innerText.includes('Backup creat')");
  // Besides the daily automatic backup (added later), exactly one made by hand.
  const kinds = await p.eval("[...document.querySelectorAll('.audit tbody tr')].map(r => r.children[1]?.innerText.trim())");
  check("backup creat", kinds.filter((k) => k === "manual").length === 1, JSON.stringify(kinds));

  await addNote(p, "după backup");

  await go(p, "Date și backup");
  await p.click("Verifică");
  await p.until("document.body.innerText.includes('Backup verificat')");
  check("backup verificat fișier cu fișier", (await p.text()).includes("toate fișierele intacte"));
  await p.screenshot(join(shots, "01-backup.png"));

  await p.click("Restaurează");
  const dialog = await p.eval("document.querySelector('.dialog')?.innerText ?? ''");
  check("dialogul spune că se creează un spațiu nou", dialog.includes("spațiu de lucru nou"));
  await p.click("Restaurează ca spațiu nou", ".dialog button");
  await afterReload(p);
  check("aplicația a trecut în spațiul restaurat", (await p.text()).includes("(restaurat "));
  check("spațiul restaurat are starea de la backup", JSON.stringify(await notes(p)) === JSON.stringify(["înainte de backup"]), JSON.stringify(await notes(p)));
  await p.screenshot(join(shots, "02-restaurat.png"));

  await go(p, "Date și backup");
  await p.until("document.querySelectorAll('.list li').length >= 2");
  check("ambele spații apar în listă", (await p.eval("document.querySelectorAll('.list li').length")) === 2);
  await p.click("Deschide", ".list button");
  await p.click("Deschide", ".dialog button");
  await afterReload(p);
  check("spațiul original e neatins (ambele note)", JSON.stringify(await notes(p)) === JSON.stringify(["după backup", "înainte de backup"]));
  await p.screenshot(join(shots, "03-original.png"));

  // Forced kill + restart: the last opened workspace (the original) reopens.
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  p = await start();
  check("după repornire se redeschide ultimul spațiu folosit", !(await p.text()).includes("(restaurat "));
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
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
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
