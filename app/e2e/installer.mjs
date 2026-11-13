// 8.3 (D-095, D-097): the installer, end to end — ONLY in a clean test environment (Windows Sandbox, a virtual
// machine or a spare PC, step 8.4). It installs, upgrades and uninstalls K.G.B. for the current Windows user, so on
// the owner's PC it would touch his own K.G.B.: it refuses to run unless KGB_CLEAN_ENV=1 is set and no K.G.B. data
// folder exists yet.
//
// Scenario: install the old version → write test data (a note) → install the new version over it (upgrade) → the
// note is there and the version is the new one → uninstall (silent, default choice) → the data folder is still there
// → install again → the note opens.
//
// Usage (in the clean environment):
//   set KGB_CLEAN_ENV=1
//   node app/e2e/installer.mjs <old-setup.exe> <new-setup.exe> <screenshot-dir>
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [oldSetup, newSetup, shots] = process.argv.slice(2);
if (!oldSetup || !newSetup || !shots) {
  console.error("usage: node installer.mjs <old-setup.exe> <new-setup.exe> <screenshot-dir>");
  process.exit(2);
}
const local = process.env.LOCALAPPDATA ?? "";
const dataDir = join(local, "ro.kronos.kgb");
const appDir = join(local, "KGB");
const exe = join(appDir, "KGB.exe");
if (process.env.KGB_CLEAN_ENV !== "1" || existsSync(dataDir) || existsSync(appDir)) {
  console.error("Refuz: rulează doar într-un mediu curat de test (KGB_CLEAN_ENV=1 și fără K.G.B. instalat înainte).");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const PORT = 9381;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const install = (setup) => execFileSync(setup, ["/S"], { stdio: "ignore", timeout: 300000 });
const NOTE = "Notă de test pentru installer";

async function run(fn) {
  const proc = spawn(exe, [], {
    env: { ...process.env, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  try {
    const p = await connect(PORT, 60000);
    await p.until("!!document.querySelector('aside')", 30000);
    const invoke = (cmd, args = {}) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
    const r = await fn(p, invoke);
    p.close();
    return r;
  } finally {
    try {
      execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
    } catch {
      /* already gone */
    }
    await sleep(1500);
  }
}

try {
  install(oldSetup);
  check("versiunea veche se instalează fără drepturi de administrator, pentru utilizatorul curent", existsSync(exe), exe);
  const oldVersion = await run(async (p, invoke) => {
    await invoke("module_call", { id: "kgb.notes", command: "add", args: { text: NOTE } });
    return (await invoke("app_info")).app_version;
  });

  install(newSetup);
  const after = await run(async (p, invoke) => {
    const notes = await invoke("module_call", { id: "kgb.notes", command: "list", args: {} });
    await p.screenshot(join(shots, "01-dupa-upgrade.png"));
    return { version: (await invoke("app_info")).app_version, notes };
  });
  check("upgrade-ul păstrează datele: nota e acolo", JSON.stringify(after.notes).includes(NOTE));
  check("după upgrade rulează versiunea nouă", after.version !== oldVersion, `${oldVersion} → ${after.version}`);

  const uninstaller = join(appDir, "uninstall.exe");
  execFileSync(uninstaller, ["/S"], { stdio: "ignore", timeout: 300000 });
  await sleep(5000);
  check("dezinstalarea scoate programul", !existsSync(exe));
  check("dezinstalarea păstrează datele implicit (D-097)", existsSync(dataDir), dataDir);

  install(newSetup);
  const again = await run(async (p, invoke) => JSON.stringify(await invoke("module_call", { id: "kgb.notes", command: "list", args: {} })));
  check("după reinstalare, datele de dinainte se deschid", again.includes(NOTE));
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
