// Etapa 3 step 3.9, end to end in the real window: data extraction.
// The invoice PDF from Edge: fields with source and confidence, import refused
// until the uncertain values are confirmed, then imported and journaled.
//
// Usage: node app/e2e/extract.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node extract.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-extract-"));
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
const row = (p, label) =>
  p.eval(`(() => { const tr = [...document.querySelectorAll('.extract-fields tbody tr')].find(t => t.cells[0].textContent.startsWith(${JSON.stringify(label)}));
    return tr ? { value: tr.querySelector('input').value, level: tr.cells[2].innerText, source: tr.cells[3].innerText } : null; })()`);

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await go(p, "Catalog module");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Extragere date'))";
  check("modulul Extragere date apare în catalog ca beta", await p.eval(`${card}?.innerText.toLowerCase().includes('beta') ?? false`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Extragere date'))");

  const r = await p.eval(
    `window.__TAURI_INTERNALS__.invoke("module_import_file", ${JSON.stringify({ id: "kgb.extract", path: join(td, "files/edge/factura.pdf") })}).then(() => "ok", (e) => String(e))`,
  );
  check("factura PDF importată", r === "ok", r);
  const scan = await p.eval(
    `window.__TAURI_INTERNALS__.invoke("module_import_file", ${JSON.stringify({ id: "kgb.extract", path: join(td, "files/pdf/cu-imagine.pdf") })}).then(() => "ok", (e) => String(e))`,
  );
  check("un PDF fără text e refuzat clar", scan.includes("pare scanat"), scan);

  await go(p, "Extragere date");
  await p.until("document.querySelectorAll('.pdf-docs li button').length === 1", 10000);
  await p.click("factura.pdf", ".pdf-docs button");
  await p.until("document.querySelectorAll('.extract-fields tbody tr').length === 9", 10000);
  const total = await row(p, "Total de plată");
  check("totalul găsit, sigur, cu sursa (pagina și rândul)", total.value === "1673.14" && total.level === "sigur" && total.source.startsWith("pagina 1, rândul"), JSON.stringify(total));
  const nr = await row(p, "Număr factură");
  check("numărul găsit, de verificat", nr.value === "FCT-0042" && nr.level === "de verificat", JSON.stringify(nr));
  check("importul e blocat până la confirmare", await p.eval("[...document.querySelectorAll('button')].find(b => b.textContent === 'Importă în registru').disabled"));
  await p.screenshot(join(shots, "01-extragere.png"));

  // Clear the fictitious CUI, confirm the rest that needs it.
  await p.fill("input[aria-label='CUI furnizor']", "");
  await p.eval("document.querySelectorAll('.extract-fields input[type=checkbox]').forEach(c => { if (!c.checked) c.click(); })");
  await sleep(200);
  await p.click("Importă în registru");
  await p.until("document.querySelector('.sheet-tabs button.active')?.textContent.startsWith('Registru')", 10000);
  const reg = await p.eval("document.querySelector('.audit tbody')?.innerText ?? ''");
  check("factura apare în registru", reg.includes("FCT-0042") && reg.includes("1673.14"), reg);
  await p.screenshot(join(shots, "02-registru.png"));
  await p.click("Jurnal", ".sheet-tabs button");
  const jr = await p.eval("document.querySelector('.audit tbody')?.innerText ?? ''");
  check("importul e în jurnal (automate / confirmate)", jr.includes("total") && jr.includes("numar"), jr.slice(0, 120));

  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
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
