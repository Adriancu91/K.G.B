// Etapa 7 step 7.4m-3, end to end: K.G.B. always available on the PC.
// - Settings → „Pe acest PC”: next to the clock (on by default), start with
//   Windows (off by default); switched on, the user's „Run” list gets the
//   entry (a test entry name, never the real one), switched off it is gone;
// - closing the window keeps K.G.B. running (window hidden);
// - starting it again shows the running one instead of a second K.G.B.;
// - started by Windows (--langa-ceas): running, window closed;
// - with „next to the clock” off, closing the window ends K.G.B.
//
// Usage: node app/e2e/desktop.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node desktop.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-desktop-"));
const PORT = 9365;
const RUN = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const TEST_ENTRY = "K.G.B. (test)";
const env = { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` };
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const ps = (cmd) => {
  try {
    return execFileSync("powershell", ["-NoProfile", "-Command", cmd], { encoding: "utf8", timeout: 20000 }).trim();
  } catch {
    return "";
  }
};
const alive = (pid) => ps(`if (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { 'da' } else { 'nu' }`) === "da";
// The "K.G.B." window of the process (window.ps1 finds it by its title).
const HELPER = fileURLToPath(new URL("./window.ps1", import.meta.url));
const win = (pid, close = false) => {
  try {
    return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", HELPER, "-ProcId", String(pid), ...(close ? ["-Close"] : [])], { encoding: "utf8", timeout: 20000 }).trim();
  } catch {
    return "";
  }
};
const windowShown = (pid) => win(pid) === "vizibil";
const closeWindow = (pid) => win(pid, true);
const runEntry = () => ps(`(Get-ItemProperty -Path 'Registry::${RUN}' -Name '${TEST_ENTRY}' -ErrorAction SilentlyContinue).'${TEST_ENTRY}'`);
const waitFor = async (f, ms = 10000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await f()) return true;
    await sleep(300);
  }
  return false;
};
const launch = (args = []) => spawn(exe, args, { env, stdio: "ignore" });
const kill = (pid) => {
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
};

try {
  proc = launch();
  let p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  check("pornit normal: fereastra se vede", await waitFor(() => windowShown(proc.pid)));

  await p.click("Setări", "nav .nav");
  await p.until("!!document.querySelector('.this-pc input')", 5000);
  const boxes = async () => p.eval("[...document.querySelectorAll('.this-pc input')].map(i => i.checked)");
  check("implicit: rămâne lângă ceas da, pornire cu Windows nu", JSON.stringify(await boxes()) === "[true,false]");
  check("înainte de test, nicio intrare de test în lista „Run”", runEntry() === "");
  await p.eval("document.querySelector(\"input[aria-label='Pornește cu Windows']\").click()");
  await p.until("[...document.querySelectorAll('.this-pc input')][1].checked", 5000);
  const cmd = runEntry();
  check("pornire cu Windows: intrarea apare, cu programul și „--langa-ceas”", cmd.toLowerCase().includes("kgb-app.exe") && cmd.endsWith("--langa-ceas"), cmd);
  await p.screenshot(join(shots, "01-setari-pe-acest-pc.png"));

  // Closing the window: K.G.B. stays.
  closeWindow(proc.pid);
  check("închiderea ferestrei o ascunde", await waitFor(() => !windowShown(proc.pid)));
  await sleep(1000);
  check("K.G.B. rulează mai departe, lângă ceas", alive(proc.pid) && (await p.eval("!!document.querySelector('aside')")));

  // A second start shows the first one.
  const second = launch();
  const exited = await new Promise((res) => {
    const t = setTimeout(() => res(false), 15000);
    second.on("exit", () => {
      clearTimeout(t);
      res(true);
    });
  });
  check("pornit a doua oară: nu apare al doilea K.G.B.", exited && alive(proc.pid));
  check("…ci se arată fereastra celui pornit", await waitFor(() => windowShown(proc.pid)));

  // Started by Windows: running, window closed.
  p.close();
  kill(proc.pid);
  await sleep(1500);
  proc = launch(["--langa-ceas"]);
  p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await sleep(1500);
  check("pornit de Windows: rulează, fără fereastră", alive(proc.pid) && !windowShown(proc.pid));

  // Off again; and with „next to the clock” off, closing ends K.G.B.
  await p.click("Setări", "nav .nav");
  await p.until("!!document.querySelector('.this-pc input')", 5000);
  await p.eval("document.querySelector(\"input[aria-label='Pornește cu Windows']\").click()");
  await p.until("![...document.querySelectorAll('.this-pc input')][1].checked", 5000);
  check("oprită pornirea cu Windows: intrarea dispare", runEntry() === "");
  await p.eval("document.querySelector(\"input[aria-label='Rămâne lângă ceas']\").click()");
  await p.until("![...document.querySelectorAll('.this-pc input')][0].checked", 5000);
  p.close();
  const pid = proc.pid;
  const ended = new Promise((res) => proc.on("exit", () => res(true)));
  // Started hidden: show the window first (a second start), then close it.
  const s2 = launch();
  await new Promise((res) => s2.on("exit", res));
  await waitFor(() => windowShown(pid));
  closeWindow(pid);
  check("fără „lângă ceas”, închiderea ferestrei oprește K.G.B.", await Promise.race([ended, sleep(15000).then(() => false)]));
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
} finally {
  if (proc) kill(proc.pid);
  ps(`Remove-ItemProperty -Path 'Registry::${RUN}' -Name '${TEST_ENTRY}' -ErrorAction SilentlyContinue`);
  await sleep(800);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
