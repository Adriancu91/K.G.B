// Adrian's observation (10.11, the installed app, Foi de calcul): „lista de șabloane nu pare să încapă și nu se vede
// niciun buton de închide”. On a small laptop screen the COS windows' dialogs must fit in their frame: the dialog
// inside the visible area, scrolling inside if needed, its close button always visible, Esc closing it.
// The screen is made small here (1366 × 650, a laptop with the taskbar) and the big dialogs are opened: Sheets ›
// Șabloane, Sheets › Tipărire (Ctrl+P), Docs › Șabloane.
//
// Usage: node app/e2e/cos-dialogs.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-dialogs.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-dialogs-"));
const PORT = 9351;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const fr = (p, expr) =>
  p.eval(`(() => { const f = document.querySelector('.cos-frame iframe'); if (!f?.contentDocument) return null;
    return ((document, window) => (${expr}))(f.contentDocument, f.contentWindow); })()`);
const frWait = async (p, expr, timeout = 15000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fr(p, expr).catch(() => false);
    if (v) return v;
    if (Date.now() > end) return false;
    await sleep(150);
  }
};
/** A button of the window by its text or title; opens the File tab first if it is there. */
async function button(p, label) {
  const click = `(() => { const b = [...document.querySelectorAll('button')].find(b => (b.textContent.trim() === ${JSON.stringify(label)} || (b.title || '').startsWith(${JSON.stringify(label)})) && !b.disabled && b.offsetParent); if (!b) return false; b.click(); return true; })()`;
  if (await fr(p, click)) return true;
  for (const tab of ["Fișier", "Pornire", "Inserare"]) {
    await fr(p, `(() => { const t = [...document.querySelectorAll('button, [role=tab]')].find(b => b.textContent.trim() === ${JSON.stringify(tab)}); t?.click(); return true; })()`);
    await sleep(300);
    if (await fr(p, click)) return true;
  }
  return false;
}
/** Where the open dialog and its close button are, against the frame's visible area. */
const fits = (p, sel, close) =>
  fr(
    p,
    `(() => { const d = document.querySelector(${JSON.stringify(sel)}); if (!d) return { open: false };
      const r = d.getBoundingClientRect(); const b = [...d.querySelectorAll('button')].find(x => ${JSON.stringify(close)}.includes(x.textContent.trim()));
      const c = b?.getBoundingClientRect(); const H = window.innerHeight, W = window.innerWidth;
      const at = c ? document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2) : null;
      return { open: true, top: Math.round(r.top), bottom: Math.round(r.bottom), H, inside: r.top >= 0 && r.bottom <= H + 1 && r.left >= 0 && r.right <= W + 1,
        close: !!c && c.top >= 0 && c.bottom <= H + 1 && c.height > 0, onTop: !!at && (at === b || b.contains(at)) }; })()`,
  );
async function escCloses(p, sel) {
  await fr(p, `(() => { const d = document.querySelector(${JSON.stringify(sel)}); (d.querySelector('button, input, select') ?? d).focus(); return true; })()`);
  await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  return !!(await frWait(p, `!document.querySelector(${JSON.stringify(sel)})`, 4000));
}
async function verify(p, what, sel, close, shot) {
  const shown = await frWait(p, `!!document.querySelector(${JSON.stringify(sel)})`, 8000);
  const f = shown ? await fits(p, sel, close) : { open: false };
  check(`${what}: fereastra încape în cadru`, !!f.inside, JSON.stringify(f));
  check(`${what}: butonul de închidere se vede întreg și se poate apăsa`, !!(f.close && f.onTop), JSON.stringify(f));
  await p.screenshot(join(shots, shot));
  check(`${what}: Esc o închide`, shown ? await escCloses(p, sel) : false);
}

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  // A small laptop screen with the taskbar.
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 650, deviceScaleFactor: 1, mobile: false });
  await p.until("!!document.querySelector('aside')", 15000);
  for (const name of ["Foi de calcul", "Documente text"]) {
    await p.click("Catalog module", "nav .nav");
    await p.eval(`[...document.querySelectorAll('.card')].find(c => c.innerText.includes(${JSON.stringify(name)})).querySelector('button').click()`);
    await sleep(300);
    await p.click("Acordă și activează");
    await p.until(`[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes(${JSON.stringify(name)}))`, 8000);
  }

  // Sheets.
  await p.click("Foi de calcul", "nav .nav");
  await p.click("Registru nou în foaia de calcul");
  await p.until("!!document.querySelector('.cos-frame iframe')", 5000);
  await frWait(p, "!!document.querySelector('.sheet-wrap')", 30000);
  check("Sheets: butonul „Șabloane” se găsește", await button(p, "Șabloane"));
  await verify(p, "Sheets › Șabloane", "[role=dialog][aria-label='Șabloane']", ["Închide"], "01-sheets-sabloane.png");
  await fr(p, "document.querySelector('.sheet-wrap')?.focus(), true");
  await p.eval("document.querySelector('.cos-frame iframe').focus()");
  await fr(p, "document.querySelector('.sheet-wrap')?.focus(), true");
  await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "p", code: "KeyP", windowsVirtualKeyCode: 80, modifiers: 2 });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "p", code: "KeyP", windowsVirtualKeyCode: 80, modifiers: 2 });
  await verify(p, "Sheets › Tipărire", "[role=dialog][aria-label='Tipărire']", ["Renunță", "Închide"], "02-sheets-tiparire.png");
  await p.click("Închide foaia de calcul");
  await p.until("!document.querySelector('.cos-frame')", 5000);

  // Docs.
  await p.click("Documente text", "nav .nav");
  await p.until("[...document.querySelectorAll('button')].some(b => b.textContent.trim().startsWith('Document nou'))", 8000);
  await p.eval("[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Document nou')).click()");
  await p.until("!!document.querySelector('.cos-frame iframe')", 5000);
  await frWait(p, "!!document.querySelector('.ProseMirror')", 30000);
  check("Docs: butonul „Șabloane” se găsește", await button(p, "Șabloane"));
  await verify(p, "Docs › Șabloane", "[role=dialog].tpl-dlg", ["Închide", "Renunță"], "03-docs-sabloane.png");
  p.close();
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
} finally {
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
