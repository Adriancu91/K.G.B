// 7.4l-5b, end to end in the real window: Documente text › Îmbinare de corespondență › „Câte un fișier .docx pentru
// fiecare rând…” — a CSV of three people (two with the same name), the field «Nume» put in the letter, the folder
// chosen; three .docx files written there, the second „Ion Pop” as „Ion Pop (2).docx” (nothing replaced).
//
// Usage: node app/e2e/cos-merge.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR) and throw-away input / output folders.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-merge.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-merge-"));
const work = mkdtempSync(join(tmpdir(), "kgb-cos-merge-in-"));
const out = join(work, "scrisori");
mkdirSync(out);
const csv = join(work, "destinatari.csv");
writeFileSync(csv, "\ufeffNume;Oraș\r\nIon Pop;Cluj-Napoca\r\nAna Pop;Iași\r\nIon Pop;Arad\r\n");
const PORT = 9372;
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
const frUntil = async (p, expr, timeout = 15000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fr(p, expr).catch(() => false);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timeout in frame: ${expr}`);
    await sleep(150);
  }
};
const frClick = (p, pred) => fr(p, `(() => { const b = [...document.querySelectorAll('button')].find(b => (${pred})(b.textContent.trim()) && !b.disabled); b?.click(); return !!b; })()`);
const DLG = `[role=dialog][aria-label="Îmbinare de corespondență"]`;

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Documente text'))";
  await p.until(`!!${card}`, 8000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Documente text'))", 8000);
  await p.click("Documente text", "nav .nav");
  await p.click("Document nou");
  await p.until("!!document.querySelector('.cos-frame iframe')", 5000);
  await frUntil(p, "!!document.querySelector('.ProseMirror')", 30000);
  await p.eval("document.querySelector('.cos-frame iframe').focus()");
  await fr(p, "document.querySelector('.ProseMirror')?.focus(), true");
  await sleep(200);
  await p.send("Input.insertText", { text: "Stimate " });
  await sleep(200);

  // Îmbinare…: from the Corespondență tab when it is not on the first one.
  if (!(await frClick(p, "(t) => t === 'Îmbinare…' || t.endsWith('Începere îmbinare')"))) {
    await frClick(p, "(t) => t === 'Corespondență'");
    await sleep(400);
    await frClick(p, "(t) => t === 'Îmbinare…' || t.endsWith('Începere îmbinare')");
  }
  await frUntil(p, `!!document.querySelector('${DLG}')`, 8000);
  // The table: the system's open dialog is replaced here; the file still goes through the core.
  await p.eval(`(() => { window.kgbHost.open = async () => ${JSON.stringify(csv)}; window.kgbHost.openFolder = async () => ${JSON.stringify(out)}; return true; })()`);
  await frClick(p, "(t) => t === 'CSV…'");
  await frUntil(p, `[...document.querySelectorAll('${DLG} button')].some(b => b.textContent.trim() === '«Nume»')`, 10000);
  await frClick(p, "(t) => t === '«Nume»'");
  await frUntil(p, `[...document.querySelectorAll('${DLG} button')].some(b => b.textContent.startsWith('Câte un fișier .docx'))`, 8000);
  check("tabelul CSV e citit și câmpul «Nume» e în scrisoare", true);

  // One .docx per row, into the folder chosen.
  await frClick(p, "(t) => t.startsWith('Câte un fișier .docx')");
  await frUntil(p, `/Gata: 3 documente \\.docx/.test(document.querySelector('${DLG}').innerText)`, 30000);
  const files = readdirSync(out).sort();
  check("trei fișiere .docx în dosarul ales, al doilea „Ion Pop” cu „ (2)”", files.join("|") === "Ana Pop.docx|Ion Pop (2).docx|Ion Pop.docx", files.join(" | "));
  check("fișierele sunt .docx adevărate", files.every((f) => readFileSync(join(out, f)).subarray(0, 2).toString("latin1") === "PK"));
  check("nimic scris în afara dosarului ales", readdirSync(work).sort().join("|") === "destinatari.csv|scrisori", readdirSync(work).join(" | "));
  await p.screenshot(join(shots, "01-imbinare.png"));
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
  rmSync(work, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
