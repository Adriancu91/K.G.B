// Etapa 4 step 4.10, end to end in the real window: start page panels.
// Move one by dragging its title, resize one by dragging its corner and one
// with the size button, hide one; after a forced restart the arrangement is
// the same.
//
// Usage: node app/e2e/home.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node home.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-home-"));
const PORT = 9343;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const layout = (p) =>
  p.eval(`[...document.querySelectorAll('.panel')].map(e => e.dataset.panel + ':' + e.style.gridColumn.replace('span ', '') + 'x' + e.style.gridRow.replace('span ', '')).join(' ')`);

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("document.querySelectorAll('.panel').length > 0", 15000);
  return p;
}
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}

try {
  let p = await start();
  const first = await layout(p);
  check("aranjamentul inițial", first === "azi:2x1 notificari:1x1 documente:1x1 module:1x1 despre:1x1", first);
  await p.screenshot(join(shots, "01-initial.png"));

  // Drag „Module active” by its title onto the first panel.
  await p.eval(`(() => {
    const src = document.querySelector(".panel[data-panel='module'] header");
    const dst = document.querySelector(".panel[data-panel='azi']");
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
    dst.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    dst.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    return true; })()`);
  await p.until("document.querySelector('.panel').dataset.panel === 'module'", 8000);
  check("drag-and-drop mută panoul", (await layout(p)).startsWith("module:1x1 azi:2x1"), await layout(p));

  // Resize „Notificări” by dragging its corner: one column wider, one row taller.
  await p.eval(`(() => {
    const panel = document.querySelector(".panel[data-panel='notificari']");
    const handle = panel.querySelector('.panel-resize');
    const r = panel.getBoundingClientRect();
    const grid = document.querySelector('.panel-grid');
    const colW = grid.clientWidth / 3;
    const x = r.right - 4, y = r.bottom - 4;
    handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x + colW, clientY: y + 230, bubbles: true, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: x + colW, clientY: y + 230, bubbles: true, pointerId: 1 }));
    return true; })()`);
  await p.until(`document.querySelector(".panel[data-panel='notificari']").style.gridColumn === 'span 2'`, 8000);
  check("colțul tras redimensionează panoul (2 coloane × 2 rânduri)", (await layout(p)).includes("notificari:2x2"), await layout(p));

  // Width with the keyboard-reachable button; hide „Ce face această versiune”.
  await p.click("", "button[aria-label^='Lățimea „Documente recente”']");
  await p.until(`document.querySelector(".panel[data-panel='documente']").style.gridColumn === 'span 2'`, 8000);
  await p.click("", "button[aria-label='Ascunde „Ce face această versiune”']");
  await p.until("!document.querySelector(\".panel[data-panel='despre']\")", 8000);
  const before = await layout(p);
  check("butoanele schimbă mărimea și ascund un panou", before === "module:1x1 azi:2x1 notificari:2x2 documente:2x1", before);
  await p.screenshot(join(shots, "02-rearanjat.png"));

  // Forced restart: the same arrangement.
  stop(p);
  p = await start();
  await sleep(500);
  const after = await layout(p);
  check("după repornire (forțată) aranjamentul rămâne", after === before, after);
  check("panoul ascuns se poate aduce înapoi", await p.eval("[...document.querySelectorAll('.home button')].some(b => b.innerText.includes('+ Ce face această versiune'))"));
  await p.click("Aranjamentul inițial", ".home button");
  await p.until("document.querySelectorAll('.panel').length === 5", 8000);
  check("„Aranjamentul inițial” readuce totul", (await layout(p)) === "azi:2x1 notificari:1x1 documente:1x1 module:1x1 despre:1x1");
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
