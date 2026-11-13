// 8.9, end to end in the real window: „Ajutor”, the user's guide.
// - The general chapters are there, with a table of contents whose links lead to them.
// - Every module has its chapter; an active module's chapter opens the module, and the module's page has an
//   „Ajutor” link back to its chapter.
// - The search finds the chapter about backups.
// - In English, the guide's chapters have no Romanian left.
// - „Salvează ghidul ca PDF” writes a real PDF (the save dialog is replaced by a test hook).
//
// Usage: node app/e2e/help.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node help.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-help-"));
const PORT = 9382;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const RO = /[ăâîșțĂÂÎȘȚ]|\b(și|sau|pentru|din|pe|la|cu|de)\b/;

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  const invoke = (cmd, args = {}) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
  // One module switched on, as a person would (a new data folder has none).
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Știri')";
  await p.until(`!!${card}`, 10000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim() === 'Știri')", 10000);
  const mods = (await invoke("list_modules")).modules;

  await p.click("Ajutor", "nav .nav");
  await p.until("document.querySelectorAll('.help-chapter').length > 0", 8000);
  const ids = await p.eval("[...document.querySelectorAll('.help-chapter')].map(e => e.dataset.chapter)");
  const general = ["primii-pasi", "backup", "fisiere", "doua-pc", "telefon", "internet", "intrebari"];
  check("capitolele generale sunt în ghid", general.every((g) => ids.includes(g)), ids.slice(0, 8).join(", "));
  check("fiecare modul are capitolul lui", mods.every((m) => ids.includes(`modul-${m.id}`)), `${mods.length} module`);
  const toc = await p.eval("[...document.querySelectorAll('.help-toc a')].every(a => !!document.getElementById(a.getAttribute('href').slice(1)))");
  check("fiecare legătură din cuprins duce la un capitol", toc);
  await p.screenshot(join(shots, "01-ajutor.png"));

  // An active module: its chapter opens it, its page leads back.
  const on = mods.find((m) => m.enabled);
  check("există cel puțin un modul pornit", !!on);
  await p.eval(`[...document.querySelector('[data-chapter="modul-${on.id}"]').querySelectorAll('button')].find(b => b.innerText.startsWith('Deschide')).click()`);
  await p.until(`document.querySelector('main .page-head h1')?.innerText === ${JSON.stringify(on.name)}`, 8000);
  check("din capitolul modulului se deschide modulul", true, on.name);
  await p.click("Ajutor", "main .page-head button");
  await p.until(`!!document.querySelector('[data-chapter="modul-${on.id}"]')`, 8000);
  const near = await p.eval(`(() => { const r = document.querySelector('[data-chapter="modul-${on.id}"]').getBoundingClientRect(); return r.top >= -5 && r.top < window.innerHeight; })()`);
  check("„Ajutor” din pagina modulului duce la capitolul lui", near);

  // Search.
  await p.fill("input[aria-label='Caută în ghid']", "backup");
  await sleep(300);
  const found = await p.eval("[...document.querySelectorAll('.help-chapter')].map(e => e.dataset.chapter)");
  check("căutarea „backup” găsește capitolul despre backup", found.includes("backup") && found.length < ids.length, found.join(", "));
  for (const word of ["semnătura", "OCR", "ștampila"]) {
    await p.fill("input[aria-label='Caută în ghid']", word);
    await sleep(300);
    const hit = await p.eval("[...document.querySelectorAll('.help-chapter')].map(e => e.dataset.chapter)");
    check(`căutarea „${word}” găsește modulul Documente PDF`, hit.includes("modul-kgb.pdf"), hit.join(", "));
  }
  await p.fill("input[aria-label='Caută în ghid']", "");

  // PDF.
  const pdfPath = join(data, "ghid.pdf");
  await p.eval(`window.__kgbE2eSave = ${JSON.stringify(pdfPath)}`);
  await p.click("Salvează ghidul ca PDF", ".help button");
  await p.until("(document.querySelector('.help')?.innerText ?? '').includes('Ghid salvat în')", 15000);
  const pdf = existsSync(pdfPath) ? readFileSync(pdfPath) : Buffer.alloc(0);
  check("„Salvează ghidul ca PDF” face un PDF", pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 5000, `${pdf.length} octeți`);

  // English.
  const hint = await p.eval("localStorage.getItem('kgb.lang')");
  await p.click("EN", ".lang-switch button");
  await sleep(800);
  const left = await p.eval(`[...document.querySelectorAll('.help-chapter h2, .help-chapter p')].map(e => e.innerText).filter(t => ${RO}.test(t))`);
  check("în engleză, capitolele ghidului nu mai au text românesc", left.length === 0, JSON.stringify(left).slice(0, 300));
  await p.screenshot(join(shots, "02-help-en.png"));
  await p.click("RO", ".lang-switch button");
  // The WebView's storage is shared with the K.G.B. installed on this PC: leave the language hint as it was.
  await p.eval(`(${JSON.stringify(hint)} === null ? localStorage.removeItem('kgb.lang') : localStorage.setItem('kgb.lang', ${JSON.stringify(hint)}), true)`);
  p.close();
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
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
