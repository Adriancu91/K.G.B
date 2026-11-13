// Cerere 13.11, end to end in the real window: the look of the window (Setări › Stilul) and the „Panouri” menu on
// Home. Choosing „Ocean” puts buttons in relief with a colour gradient at once, it is kept on this PC (desktop.json)
// and comes back after a restart; „Clasic” takes it away. On Home, the links that add panels are in one menu.
//
// Usage: node app/e2e/look.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR); the WebView's storage, shared with the K.G.B. installed on this PC,
// gets its look hint back as it was.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node look.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-look-"));
const PORT = 9383;
let proc;
let page;
let hint = null;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const start = async () => {
  proc = spawn(exe, [], { env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` }, stdio: "ignore" });
  const p = await connect(PORT, 20000);
  await p.until("!!document.querySelector('aside')", 15000);
  return p;
};
const stop = (p) => {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
};

try {
  let p = await start();
  page = p;
  hint = await p.eval("localStorage.getItem('kgb.look')");
  if (hint !== null) {
    await p.eval("localStorage.removeItem('kgb.look'), location.reload(), true");
    await sleep(1500);
    await p.until("!!document.querySelector('aside')", 15000);
  }

  // Home: the „Panouri” menu.
  const closed = await p.eval("document.querySelector('.cc-panels-menu') && !document.querySelector('.cc-panels-menu').open");
  await p.eval("document.querySelector('.cc-panels-menu > summary').click()");
  await sleep(200);
  const items = await p.eval("[...document.querySelectorAll('.cc-panels-list button')].map(b => b.innerText)");
  check("pe Acasă, panourile de adăugat și „Revino la implicit” sunt într-un singur meniu, „Panouri”, închis la început", closed && items.includes("Revino la implicit"), items.join(" | "));
  await p.screenshot(join(shots, "01-meniu-panouri.png"));
  await p.eval("document.querySelector('.cc-panels-menu').open = false");

  // Settings › Style.
  await p.click("Setări", "nav .nav");
  await p.until("!!document.querySelector('.look-picker')", 8000);
  check("Setări arată cele patru stiluri, fiecare cu butoanele lui", (await p.eval("document.querySelectorAll('.look-card').length")) === 4);
  await p.eval("document.querySelector('[data-look-preview=\"ocean\"]').click()");
  await sleep(300);
  const bg = await p.eval("getComputedStyle(document.querySelector('nav .nav.active')).backgroundImage");
  const btn = await p.eval("getComputedStyle(document.querySelector('.lang-switch button')).boxShadow");
  const ro = await p.eval("(() => { const b = document.querySelector('.lang-switch button.on'); return b ? getComputedStyle(b).backgroundImage : 'lipsă'; })()");
  check("„Ocean” se vede imediat: culori în degrade și butoane în relief", (await p.eval("document.documentElement.dataset.look")) === "ocean" && bg.includes("gradient") && btn !== "none", `${bg.slice(0, 60)} · ${btn.slice(0, 40)}`);
  check("butoanele care au culoarea lor (limba aleasă) nu sunt acoperite de relief", ro === "none", ro);
  await p.screenshot(join(shots, "02-ocean.png"));
  await sleep(500);
  const prefs = existsSync(join(data, "desktop.json")) ? JSON.parse(readFileSync(join(data, "desktop.json"), "utf8")) : {};
  check("stilul e ținut minte pe acest PC", prefs.stil === "ocean", JSON.stringify(prefs));

  stop(p);
  // The hint in the WebView's storage is not the source: clear it, the app reads desktop.json.
  p = await start();
  page = p;
  await p.eval("localStorage.removeItem('kgb.look'), location.reload(), true");
  await sleep(1500);
  await p.until("!!document.querySelector('aside')", 15000);
  await p.until("document.documentElement.dataset.look === 'ocean'", 8000);
  check("după repornire, stilul e tot „Ocean”", true);

  await p.click("Setări", "nav .nav");
  await p.until("!!document.querySelector('.look-picker')", 8000);
  await p.eval("document.querySelector('[data-look-preview=\"clasic\"]').click()");
  await sleep(300);
  check("„Clasic” revine la aspectul obișnuit", (await p.eval("document.documentElement.dataset.look ?? ''")) === "");
  stop(p);
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
  // Put the look hint of the shared WebView storage back as it was.
  try {
    proc = spawn(exe, [], { env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` }, stdio: "ignore" });
    const p = await connect(PORT, 20000);
    await p.eval(`(${JSON.stringify(hint)} === null ? localStorage.removeItem('kgb.look') : localStorage.setItem('kgb.look', ${JSON.stringify(hint)}), true)`);
    p.close();
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  } catch {
    /* nothing to restore */
  }
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
