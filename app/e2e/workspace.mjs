// 8.21, end to end in the real window: „Spațiu de lucru” — the page appears once an office module is on, two
// spreadsheets (two CSV files imported, one value different) open in two tabs from „Deschide un document salvat…”,
// side by side, „Compară” finds the one row only on the left and the one only on the right and colours the different
// cell in both tables, „+ › Foaie de calcul nouă” makes a third tab, the two saved ones come back after a restart
// (the new, unsaved one does not) and a tab closes with ×. The notebook is open in one window only: with it in a
// tab, the Note page leads to that tab instead of opening a second window on the same notebook.
//
// Usage: node app/e2e/workspace.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node workspace.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-workspace-"));
const files = mkdtempSync(join(tmpdir(), "kgb-workspace-files-"));
const PORT = 9384;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const clickText = (p, text, scope = "") =>
  p.eval(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); b?.click(); return !!b; })()`);
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
    const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
/** An expression inside the n-th tab's frame (the frame's own eval is refused by its content policy). */
const fr = (p, n, expr) =>
  p.eval(`(() => { const f = document.querySelectorAll('.ws-pane iframe')[${n}]; if (!f?.contentDocument) return null;
    return ((document, window) => (${expr}))(f.contentDocument, f.contentWindow); })()`);
const frUntil = async (p, n, expr, timeout = 30000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fr(p, n, expr).catch(() => false);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timeout in frame ${n}: ${expr}`);
    await sleep(200);
  }
};
const tabNames = (p) => p.eval("[...document.querySelectorAll('.ws-tab .ws-tab-name')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())");
const start = async () => {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  return p;
};
const stop = async (p) => {
  p.close();
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  } catch {
    /* gone */
  }
  await sleep(1500);
};
const openWorkspace = async (p) => {
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Spațiu de lucru'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Spațiu de lucru')).click()");
  await p.until("!!document.querySelector('.workspace')", 8000);
};
const pick = async (p, name) => {
  await p.until("!!document.querySelector('.ws-picker')", 8000);
  await p.until(`[...document.querySelectorAll('.ws-picker li button')].some(b => b.innerText.includes(${JSON.stringify(name)}))`, 8000);
  await p.eval(`[...document.querySelectorAll('.ws-picker li button')].find(b => b.innerText.includes(${JSON.stringify(name)})).click()`);
};

writeFileSync(join(files, "preturi-ianuarie.csv"), "Produs,Pret\nCafea,25\nZahar,8\nLapte,7\n");
writeFileSync(join(files, "preturi-februarie.csv"), "Produs,Pret\nCafea,27\nZahar,8\nLapte,7\n");

try {
  let p = await start();
  check(
    "fără modulele de birou, „Spațiu de lucru” nu e în meniu",
    !(await p.eval("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Spațiu de lucru'))")),
  );
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Foi de calcul')";
  await p.until(`!!${card}`, 8000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await sleep(500);
  const notesCard = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Note')";
  await p.until(`!!${notesCard}`, 8000);
  await p.eval(`${notesCard}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await sleep(500);
  for (const f of ["preturi-ianuarie.csv", "preturi-februarie.csv"]) {
    const r = await p.eval(`window.__TAURI_INTERNALS__.invoke("module_import_file", ${JSON.stringify({ id: "kgb.sheets", path: join(files, f) })}).then(r => r.document?.name ?? '', e => 'ERR ' + e)`);
    if (r !== f) throw new Error(`import ${f}: ${r}`);
  }
  await openWorkspace(p);
  check("cu Foile de calcul pornite, „Spațiu de lucru” se deschide gol, cu îndemnul", await p.eval("!!document.querySelector('.ws-empty')"));

  // Two saved spreadsheets, each in its tab.
  await clickText(p, "Deschide un document salvat…", ".ws-empty");
  await pick(p, "preturi-ianuarie.csv");
  await p.until("document.querySelectorAll('.ws-pane iframe').length === 1", 8000);
  await frUntil(p, 0, "!!document.querySelector('.sheet-wrap')");
  await p.eval("document.querySelector('.ws-plus').click()");
  await sleep(200);
  await clickText(p, "Deschide un document salvat…", ".ws-menu");
  await pick(p, "preturi-februarie.csv");
  await p.until("document.querySelectorAll('.ws-pane iframe').length === 2", 8000);
  await frUntil(p, 1, "!!document.querySelector('.sheet-wrap')");
  await p.until("[...document.querySelectorAll('.ws-tab-name')].filter(b => b.innerText.includes('preturi-')).length === 2", 8000);
  const names = await tabNames(p);
  check("două taburi, fiecare cu numele fișierului", names.length === 2 && names[0].includes("preturi-ianuarie.csv") && names[1].includes("preturi-februarie.csv"), JSON.stringify(names));
  check("se vede doar tabul din față", (await p.eval("[...document.querySelectorAll('.ws-pane')].filter(e => !e.hidden).length")) === 1);

  // The first one in front, the second beside it, then „Compară”.
  await p.eval("document.querySelectorAll('.ws-tab-name')[0].click()");
  await sleep(300);
  const second = await p.eval("document.querySelector(\"select[aria-label='Tabul pus alături'] option:nth-child(2)\").value");
  await setValue(p, "select[aria-label='Tabul pus alături']", second);
  await p.until("[...document.querySelectorAll('.ws-pane')].filter(e => !e.hidden).length === 2", 5000);
  check("„Alături” arată cele două taburi unul lângă altul", await p.eval("document.querySelector('.ws-content').classList.contains('split')"));
  await clickText(p, "⇄ Compară", ".ws-bar");
  await p.until("!!document.querySelector('.ws-diff')", 15000);
  const diff = await p.eval("document.querySelector('.ws-compare').innerText.replace(/\\s+/g, ' ')");
  // The rows that differ: the workbooks' names and the price in B2.
  check("„Compară”: B2 25 doar în stânga, B2 27 doar în dreapta", diff.includes("− 2 doar în stânga") && diff.includes("+ 2 doar în dreapta") && diff.includes("− Foaia 1 › B2: 25") && diff.includes("+ Foaia 1 › B2: 27"), diff.slice(0, 400));
  const marked = await Promise.all([0, 1].map((n) => frUntil(p, n, "document.querySelectorAll('td.cmp-diff').length", 8000).catch(() => 0)));
  check("celula diferită e colorată în ambele tabele", marked[0] === 1 && marked[1] === 1, JSON.stringify(marked));
  await p.screenshot(join(shots, "01-compara.png"));
  await clickText(p, "Închide", ".ws-compare");
  await clickText(p, "◫ Un singur tab", ".ws-bar");
  await sleep(400);
  check("„Un singur tab” închide alăturarea și culorile", (await p.eval("[...document.querySelectorAll('.ws-pane')].filter(e => !e.hidden).length")) === 1 && (await fr(p, 0, "document.querySelectorAll('td.cmp-diff').length")) === 0);

  // A new spreadsheet from „+”.
  await p.eval("document.querySelector('.ws-plus').click()");
  await sleep(200);
  await clickText(p, "Foaie de calcul nouă", ".ws-menu");
  await p.until("document.querySelectorAll('.ws-pane iframe').length === 3", 8000);
  await frUntil(p, 2, "!!document.querySelector('.sheet-wrap')");
  check("„+ › Foaie de calcul nouă” deschide al treilea tab, în față", (await tabNames(p)).length === 3 && (await p.eval("document.querySelectorAll('.ws-tab')[2].classList.contains('active')")));
  await p.screenshot(join(shots, "02-taburi.png"));

  // The notebook in a tab; then the Note page leads to it (one window on the notebook, not two).
  await p.eval("document.querySelector('.ws-plus').click()");
  await sleep(200);
  await clickText(p, "Caietul de note", ".ws-menu");
  await p.until("[...document.querySelectorAll('iframe')].some(f => f.getAttribute('src')?.includes('app=notes'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Note')).click()");
  await sleep(1200);
  const one = await p.eval(`({ ws: !document.querySelector('.workspace-host')?.hidden,
    frames: [...document.querySelectorAll('iframe')].filter(f => f.getAttribute('src')?.includes('app=notes')).length,
    page: !!document.querySelector('.notes-window'),
    active: document.querySelector('.ws-tab.active')?.dataset.kind ?? '' })`);
  check("cu caietul într-un tab, pagina Note duce la tabul lui (o singură fereastră pe caiet)", one.ws && one.frames === 1 && !one.page && one.active === "notes", JSON.stringify(one));

  // After a restart: the two saved ones come back.
  // The tabs are kept in the window's storage, written a moment after a change.
  await sleep(4000);
  await stop(p);
  p = await start();
  await openWorkspace(p);
  await p.until("document.querySelectorAll('.ws-tab').length === 3", 8000).catch(() => {});
  const again = await tabNames(p);
  check("după repornire revin cele două foi salvate și caietul (foaia nouă, nesalvată, nu)", again.length === 3 && again[0].includes("preturi-ianuarie.csv") && again[1].includes("preturi-februarie.csv") && again[2].includes("Caietul de note"), JSON.stringify(again));
  // The imported .csv counts as unsaved (it is not a workbook of the app yet): closing it asks first.
  await p.until("!!document.querySelectorAll('.ws-tab')[0]?.querySelector('.ws-dot')", 30000).catch(() => {});
  await p.eval("document.querySelectorAll('.ws-close')[0].click()");
  await sleep(400);
  check("un tab cu ceva nesalvat întreabă înainte să se închidă", await p.eval("!!document.querySelector('.dialog[role=alertdialog]')"));
  await clickText(p, "Închide fără să salvez");
  await sleep(400);
  const left = await tabNames(p);
  check("× închide tabul", left.length === 2 && left[0].includes("preturi-februarie.csv"), JSON.stringify(left));
  await stop(p);
} catch (e) {
  check("scenariul a rulat până la capăt", false, String(e?.stack ?? e));
  if (page) await page.screenshot(join(shots, "eroare.png")).catch(() => {});
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc?.pid)], { stdio: "ignore" });
  } catch {
    /* gone */
  }
} finally {
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
  rmSync(files, { recursive: true, force: true });
}
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} verificări trecute`);
process.exit(ok === results.length ? 0 : 1);
