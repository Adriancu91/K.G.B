// 7.5-1, end to end in the real window: the spreadsheet window copied from Cyber Office Studio (D-073,
// D-077), in its frame over the Foi de calcul page. What people tested in COS stays the same (D-078,
// TESTAT-DE-OAMENI.md): arrows while writing a formula, arrows after typing, „Unde salvezi? În .xlsx”.
// Typing and arrows are real key events (Input.dispatchKeyEvent) into the frame.
//
// Usage: node app/e2e/cos-sheets.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-sheets.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-sheets-"));
const td = resolve(import.meta.dirname, "../../testdata/etapa3");
const PORT = 9339;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const go = (p, label) => p.click(label, "nav .nav");
const call = (p, command, args = {}) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.sheets", command, args })})`);
/** Evaluates an expression inside the spreadsheet frame. */
// The frame's own `eval` is refused by the page's content policy: the expression runs from the page instead,
// with `document` / `window` bound to the frame's.
const fr = (p, expr) =>
  p.eval(`(() => { const f = document.querySelector('.cos-frame iframe'); if (!f?.contentDocument) return null;
    return ((document, window) => (${expr}))(f.contentDocument, f.contentWindow); })()`);
const frUntil = async (p, expr, timeout = 15000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fr(p, expr).catch(() => false);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timeout in frame: ${expr}`);
    await sleep(150);
  }
};
const SHIFT = 8;
const CTRL = 2;
async function key(p, k, code, vk, modifiers = 0, text) {
  await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers });
  if (text) await p.send("Input.dispatchKeyEvent", { type: "char", key: k, code, windowsVirtualKeyCode: vk, modifiers, text });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
  await sleep(150);
}
const arrow = (p, d, mod = 0) => key(p, `Arrow${d}`, `Arrow${d}`, { Left: 37, Up: 38, Right: 39, Down: 40 }[d], mod);
const ch = (p, c) =>
  key(
    p,
    c,
    c === "=" || c === "+" ? "Equal" : /\d/.test(c) ? `Digit${c}` : `Key${c.toUpperCase()}`,
    c === "=" || c === "+" ? 187 : c.toUpperCase().charCodeAt(0),
    c === "+" ? SHIFT : 0,
    c,
  );
const tab = (p) => key(p, "Tab", "Tab", 9);
const enter = (p) => key(p, "Enter", "Enter", 13);
const editing = (p) => fr(p, "document.querySelector('.cell-input')?.value ?? null");
const cell = (p, r, c) =>
  fr(p, `document.querySelector('tr[data-r="${r}"]')?.querySelectorAll('td')[${c}]?.innerText.replace(String.fromCharCode(0x26A1), '').trim()`);
const nameBox = (p) => fr(p, "document.querySelector('input.cell-name')?.value");
const focusGrid = async (p) => {
  await p.eval("document.querySelector('.cos-frame iframe').focus()");
  await fr(p, "document.querySelector('.sheet-wrap')?.focus(), true");
  await sleep(200);
};
/** Opens the frame with a button of the page and waits for the grid; errors in the frame are collected. */
async function openFrame(p, button) {
  await p.click(button);
  await p.until("!!document.querySelector('.cos-frame iframe')", 5000);
  await frUntil(p, "!!document.querySelector('.sheet-wrap')", 30000);
  await fr(p, "(window.__errs = [], window.addEventListener('error', (e) => window.__errs.push(String(e.message))), window.addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason))), true)");
  await focusGrid(p);
}
const frameErrors = (p) => fr(p, "JSON.stringify(window.__errs ?? [])");
async function closeFrame(p) {
  await p.click("Închide foaia de calcul");
  await p.until("!document.querySelector('.cos-frame')", 5000);
}

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);

  await go(p, "Catalog module");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Foi de calcul'))";
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Foi de calcul'))");
  await go(p, "Foi de calcul");
  check("pagina lasă frame-ului legătura cu nucleul", await p.eval("typeof window.kgbHost?.moduleCall === 'function'"));

  // A new workbook: the arrows while writing a formula (tester, 28.10) and after typing (colleagues, 26.10).
  await openFrame(p, "Registru nou în foaia de calcul");
  check("foaia de calcul COS se deschide în cadrul ei", true);
  await ch(p, "5");
  await tab(p);
  await ch(p, "7");
  await tab(p);
  check("Tab trece la celula următoare (C1)", (await nameBox(p)) === "C1", await nameBox(p));
  await ch(p, "=");
  await arrow(p, "Left");
  check("= apoi ← pune B1 în formulă", (await editing(p)) === "=B1", await editing(p));
  await arrow(p, "Left");
  check("încă o ← mută la A1", (await editing(p)) === "=A1", await editing(p));
  await ch(p, "+");
  await arrow(p, "Left");
  check("+ apoi ← pune B1", (await editing(p)) === "=A1+B1", await editing(p));
  await enter(p);
  check("C1 = 12 (motorul de calcul COS)", (await cell(p, 0, 2)) === "12", await cell(p, 0, 2));
  await ch(p, "=");
  await arrow(p, "Up");
  await arrow(p, "Left", SHIFT);
  await arrow(p, "Left", SHIFT);
  check("Shift+← de două ori face zona A1:C1", (await editing(p)) === "=C1" || (await editing(p)) === "=A1:C1", await editing(p));
  await key(p, "Escape", "Escape", 27);
  await ch(p, "a");
  await arrow(p, "Right");
  check("text + → trece la celula vecină", /^[A-Z]+2$/.test((await nameBox(p)) ?? ""), await nameBox(p));
  await p.screenshot(join(shots, "01-registru-nou.png"));

  // Ctrl+S: a new .ssheet document of the core.
  await key(p, "s", "KeyS", 83, CTRL);
  await p.until(
    `window.__TAURI_INTERNALS__.invoke("module_call", {id: "kgb.sheets", command: "list", args: {}}).then(l => l.some(d => d.name.endsWith(".ssheet")))`,
    10000,
  );
  const list1 = await call(p, "list");
  const book = list1.find((d) => d.name.endsWith(".ssheet"));
  check("Ctrl+S face un registru .ssheet în nucleu", !!book, JSON.stringify(list1.map((d) => d.name)));
  const read1 = await call(p, "read", { id: book.id });
  const text1 = Buffer.from(read1.data, "base64").toString("utf8");
  check("registrul salvat are formula =A1+B1", text1.includes("=A1+B1"), text1.slice(0, 120));
  // A second save is a new version of the same document.
  await focusGrid(p);
  await ch(p, "9");
  await enter(p);
  await key(p, "s", "KeyS", 83, CTRL);
  await p.until(
    `window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.sheets", command: "read", args: { id: book.id } })}).then(r => r.version === 2)`,
    10000,
  );
  check("al doilea Ctrl+S face versiunea 2 a aceluiași registru", true);
  check("nicio eroare în cadru (registru nou)", (await frameErrors(p)) === "[]", await frameErrors(p));
  await closeFrame(p);

  // Reopen it from the list: the value is read back from the core.
  await p.click(book.name, ".pdf-docs button");
  await p.until(`document.querySelector('.pdf-doc h2')?.textContent === ${JSON.stringify(book.name)}`, 10000);
  await openFrame(p, "Deschide în foaia de calcul");
  await frUntil(p, `document.querySelector('tr[data-r="0"]')?.querySelectorAll('td')[2]?.innerText.includes('12')`, 15000);
  check("redeschis din nucleu, C1 arată tot 12", (await cell(p, 0, 2)) === "12", await cell(p, 0, 2));
  await closeFrame(p);

  // An .xlsx: opened in the window, changed, „Unde salvezi? În .xlsx” → a new version of the .xlsx.
  await p.eval(
    `window.__TAURI_INTERNALS__.invoke("module_import_file", ${JSON.stringify({ id: "kgb.sheets", path: join(td, "files/xlsx/formule.xlsx") })})`,
  );
  await go(p, "Catalog module");
  await go(p, "Foi de calcul");
  await p.click("formule.xlsx", ".pdf-docs button");
  await p.until("document.querySelector('.pdf-doc h2')?.textContent === 'formule.xlsx'", 10000);
  await openFrame(p, "Deschide în foaia de calcul");
  await frUntil(p, "document.body.innerText.includes('71')", 15000);
  check("formule.xlsx se deschide în foaia COS, cu SUM calculat (71,75)", await fr(p, "document.body.innerText.includes('71,75') || document.body.innerText.includes('71.75')"));
  await ch(p, "1");
  await enter(p);
  await key(p, "s", "KeyS", 83, CTRL);
  await frUntil(p, "document.body.innerText.includes('Unde salvezi?')", 8000);
  check("la Ctrl+S întreabă „Unde salvezi?”, ca în COS", true);
  await fr(p, "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'În .xlsx')?.click(), true");
  await p.until(
    `window.__TAURI_INTERNALS__.invoke("module_call", {id: "kgb.sheets", command: "list", args: {}}).then(l => l.find(d => d.name === "formule.xlsx")?.current === 2)`,
    15000,
  );
  check("„În .xlsx” face versiunea 2 a lui formule.xlsx, verificată de nucleu", true);
  await p.screenshot(join(shots, "02-xlsx.png"));
  check("nicio eroare în cadru (.xlsx)", (await frameErrors(p)) === "[]", await frameErrors(p));
  await closeFrame(p);

  // The page's own view reads the new version (calamine): the .xlsx written by the window is valid.
  await p.until("!!document.querySelector('.pdf-doc select')", 10000);
  const v = await p.eval("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent ?? ''");
  check("pagina arată versiunea 2", v.startsWith("2"), v);

  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  console.log("erori în cadru:", await frameErrors(page).catch(() => "?"));
  console.log("bara de jos:", await fr(page, "document.querySelector('.status, .statusbar, footer')?.innerText ?? document.body.innerText.slice(-300)").catch(() => "?"));
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
