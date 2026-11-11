// 7.4l-4b / 5b, end to end in the real window: several files at once into the folder the person chose — Foi de calcul ›
// Export CSV with „Toate foile”: the first file where the save dialog says, the others beside it; a second export puts
// „ (2)” on the ones already there instead of replacing them (the save dialog itself asked about the first one).
//
// Usage: node app/e2e/cos-folder.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR) and a throw-away output folder.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-folder.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-folder-"));
const out = mkdtempSync(join(tmpdir(), "kgb-cos-folder-out-"));
const PORT = 9371;
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
/** A button of the window by its text (opening the File tab if it is there). */
async function button(p, labels) {
  const click = `(() => { const b = [...document.querySelectorAll('button')].find(b => ${JSON.stringify(labels)}.includes(b.textContent.trim()) && !b.disabled); if (!b) return ''; b.click(); return b.textContent.trim(); })()`;
  const got = await fr(p, click);
  if (got) return got;
  await fr(p, `(() => { const t = [...document.querySelectorAll('button')].find(b => ['Fișier', 'File'].includes(b.textContent.trim())); t?.click(); return !!t; })()`);
  await sleep(400);
  return (await frWait(p, click, 5000)) || "";
}
const DLG = `[role=dialog][aria-label="Export CSV"]`;

async function exportAll(p) {
  await button(p, ["Export CSV…"]);
  await frWait(p, `!!document.querySelector('${DLG}')`, 8000);
  await fr(p, `(() => { const c = document.querySelector('${DLG} input[type=checkbox]'); if (c && !c.checked) c.click(); return !!c; })()`);
  await sleep(200);
  await fr(p, `(() => { const b = [...document.querySelectorAll('${DLG} button')].find(b => b.textContent.trim() === 'Exportă…'); b?.click(); return !!b; })()`);
  return frWait(p, "/Exportate 2 fișiere .csv|celelalte nu s-au putut scrie/.test(document.body.innerText)", 15000);
}

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Foi de calcul'))";
  await p.until(`!!${card}`, 8000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Foi de calcul'))", 8000);
  await p.click("Foi de calcul", "nav .nav");
  await p.click("Registru nou în foaia de calcul");
  await p.until("!!document.querySelector('.cos-frame iframe')", 5000);
  await frWait(p, "!!document.querySelector('.sheet-wrap')", 30000);

  // A second sheet; the save dialog answers with a file in the output folder.
  await fr(p, "(document.querySelector('.sheet-tab-add').click(), true)");
  await sleep(600);
  const first = join(out, "Tabel - Foaie1.csv");
  await p.eval(`(() => { window.kgbHost.save = async () => ${JSON.stringify(first)}; return true; })()`);
  const ok1 = await exportAll(p);
  const files1 = readdirSync(out).sort();
  check("Export CSV › Toate foile: primul unde a spus fereastra Salvează, al doilea lângă el", !!ok1 && files1.length === 2 && files1.includes("Tabel - Foaie1.csv"), files1.join(" | "));
  check("mesajul spune câte fișiere s-au scris", !!(await fr(p, "/Exportate 2 fișiere \\.csv/.test(document.body.innerText)")));
  const second = files1.find((f) => f !== "Tabel - Foaie1.csv");
  check("fișierul scris lângă e un CSV (cu BOM)", !!second && readFileSync(join(out, second)).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])));

  // Again: the save dialog asked about the first one (replaced); the other one is not replaced but gets „ (2)”.
  await exportAll(p);
  const files2 = readdirSync(out).sort();
  check("a doua oară: a doua foaie cu „ (2)”, nimic înlocuit pe tăcute", files2.length === 3 && files2.some((f) => / \(2\)\.csv$/.test(f)), files2.join(" | "));
  await p.screenshot(join(shots, "01-csv-toate-foile.png"));
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
  if (existsSync(out)) rmSync(out, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
