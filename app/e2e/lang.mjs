// 7.4l-0f, end to end in the real window: the app in English. Every module is enabled, EN is chosen
// under the navigation, then every page is opened and its visible text is searched for Romanian (letters
// ă â î ș ț and common Romanian words), outside the fields where the user writes. The spreadsheet and
// document windows of Cyber Office Studio are opened too and must speak English, and RO must bring the
// Romanian back. The choice is remembered after a restart.
//
// Usage: node app/e2e/lang.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node lang.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-lang-"));
const PORT = 9341;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// Romanian left on screen: the letters, or frequent words. Text the user writes (fields, editors) and the
// names of the user's own files are not ours, so they are skipped.
const SCAN = `(() => {
  const RO = /[ăâîșțşţĂÂÎȘȚŞŢ]|\\b(și|sau|pentru|după|fără|din|nu|este|sunt|aici|alege|apasă|fișier|fișierul|pagina|salvează|deschide|închide|șterge|adaugă|caută|nou|nouă|toate|documentul|modulul|versiunea)\\b/i;
  const skip = 'input, textarea, select, [contenteditable="true"], .no-i18n, .pdf-docs, .ProseMirror, code, pre';
  const out = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.nodeValue.trim();
    const el = n.parentElement;
    if (!t || !el || el.closest(skip)) continue;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || !el.getClientRects().length) continue;
    if (RO.test(t)) out.add(t.slice(0, 120));
  }
  for (const el of document.querySelectorAll('[title], [aria-label], [placeholder]')) {
    if (el.closest(skip) && !el.matches('input, textarea')) continue;
    for (const a of ['title', 'aria-label', 'placeholder']) { const v = el.getAttribute(a); if (v && RO.test(v)) out.add('[' + a + '] ' + v.slice(0, 120)); }
  }
  return [...out];
})()`;
const navLabels = (p) => p.eval("[...document.querySelectorAll('nav .nav')].map(b => b.textContent.trim())");
const fr = (p, expr) =>
  p.eval(`(() => { const f = document.querySelector('.cos-frame iframe'); if (!f?.contentDocument) return null;
    return ((document, window) => (${expr}))(f.contentDocument, f.contentWindow); })()`);
const frUntil = async (p, expr, timeout = 30000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fr(p, expr).catch(() => false);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timeout in frame: ${expr}`);
    await sleep(200);
  }
};
const start = () =>
  spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
const stop = () => {
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
};

const leftovers = {};
try {
  proc = start();
  let p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  // The language is kept in desktop.json of the data folder (new here, so Romanian); the WebView's storage is
  // only a hint for the first paint, shared with the K.G.B. installed on this computer: clear it.
  if (await p.eval("localStorage.getItem('kgb.lang') === 'en'")) {
    await p.eval("localStorage.setItem('kgb.lang', 'ro'), location.reload(), true");
    await sleep(1500);
    await p.until("!!document.querySelector('aside')", 15000);
  }

  // Every module of the catalog, enabled with the permissions it asks for.
  await p.click("Catalog module", "nav .nav");
  await sleep(500);
  for (let i = 0; i < 20; i++) {
    const clicked = await p.eval(`(() => { const b = [...document.querySelectorAll('.card button')].find(b => /Activează/.test(b.textContent) && !b.disabled); if (!b) return false; b.click(); return true; })()`);
    if (!clicked) break;
    await sleep(300);
    await p.click("Acordă și activează").catch(() => {});
    await sleep(500);
  }
  const pages = await navLabels(p);
  check("toate modulele sunt activate", pages.some((l) => /Foi de calcul/.test(l)) && pages.some((l) => /Documente text/.test(l)), pages.join(", "));

  // EN under the navigation.
  await p.click("EN", ".lang-switch button");
  await p.until("document.documentElement.lang === 'en'", 5000);
  await sleep(1500);
  const enPages = await navLabels(p);
  check("navigarea e în engleză", !enPages.some((l) => /[ăâîșț]/i.test(l)), enPages.join(", "));
  for (let i = 0; i < enPages.length; i++) {
    await p.eval(`document.querySelectorAll('nav .nav')[${i}].click()`);
    await sleep(1500);
    const left = await p.eval(SCAN);
    if (left.length) leftovers[enPages[i]] = left;
  }
  await p.screenshot(join(shots, "01-en.png"));
  writeFileSync(join(shots, "ramase.json"), JSON.stringify(leftovers, null, 1));
  const total = Object.values(leftovers).reduce((n, a) => n + a.length, 0);
  check("nicio pagină nu mai are text românesc", total === 0, total ? `${total} texte; vezi ramase.json` : "");
  for (const [pg, a] of Object.entries(leftovers)) console.log(`   ${pg}: ${a.slice(0, 6).join(" | ")}`);

  // The spreadsheet window of COS in English, then back to Romanian.
  await p.eval("[...document.querySelectorAll('nav .nav')].find(b => /Spreadsheets|Foi de calcul/.test(b.textContent))?.click()");
  await sleep(800);
  await p.eval("[...document.querySelectorAll('button')].find(b => /New workbook in the spreadsheet|Registru nou/.test(b.textContent))?.click()");
  await frUntil(p, "!!document.querySelector('.sheet-wrap')");
  await sleep(1500);
  const ribbon = await fr(p, "document.body.innerText.slice(0, 400)");
  check("foaia de calcul COS e în engleză (Home, Insert)", /\bHome\b/.test(ribbon) && /\bInsert\b/.test(ribbon), ribbon.slice(0, 80));
  await p.click("RO", ".lang-switch button").catch(() => {});
  await p.eval("[...document.querySelectorAll('.lang-switch button')].find(b => b.textContent === 'RO')?.click()");
  await sleep(1500);
  const ro = await fr(p, "document.body.innerText.slice(0, 400)");
  check("cu RO, foaia de calcul revine în română (Pornire)", /Pornire/.test(ro), ro.slice(0, 80));
  await p.eval("[...document.querySelectorAll('.lang-switch button')].find(b => b.textContent === 'EN')?.click()");
  // Closed right after the choice: the language must already be in this PC's preferences.
  await sleep(500);
  const limba = () => {
    try {
      return JSON.parse(readFileSync(join(data, "desktop.json"), "utf8")).limba;
    } catch {
      return null;
    }
  };
  check("EN e salvat în preferințele acestui PC (desktop.json)", limba() === "en", String(limba()));
  await p.eval("localStorage.removeItem('kgb.lang'), true");
  p.close();
  stop();
  await sleep(1500);

  // After a restart the app starts in English.
  proc = start();
  p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.until("document.documentElement.lang === 'en'", 8000);
  await sleep(1500);
  const again = await navLabels(p);
  check("după repornire aplicația e tot în engleză", !again.some((l) => /[ăâîșț]/i.test(l)), again.slice(0, 5).join(", "));
  // Leave Romanian behind: the storage is shared with the app installed on this computer.
  await p.eval("[...document.querySelectorAll('.lang-switch button')].find(b => b.textContent === 'RO')?.click()");
  await sleep(500);
  check("la final aplicația revine în română", limba() === "ro", String(limba()));
  p.close();
  stop();
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
  await page?.eval("localStorage.setItem('kgb.lang', 'ro'), true").catch(() => {});
  stop();
} finally {
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
