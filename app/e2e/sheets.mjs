// Etapa 3 step 3.6, end to end in the real window: the spreadsheet module.
// Import (through the same command the file dialog's result goes to), grid,
// sheet tabs, an edit with recalculated formulas after a preview, versions,
// a read-only CSV, a refused zip bomb, and a 100k-row sheet that scrolls.
//
// Usage: node app/e2e/sheets.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node sheets.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-sheets-"));
const td = resolve(import.meta.dirname, "../../testdata/etapa3");
const PORT = 9338;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const go = (p, label) => p.click(label, "nav .nav");
const tryImport = (p, rel) =>
  p.eval(
    `window.__TAURI_INTERNALS__.invoke("module_import_file", ${JSON.stringify({ id: "kgb.sheets", path: join(td, rel) })}).then(() => "ok", (e) => String(e))`,
  );
const openDoc = async (p, name) => {
  await p.click(name, ".pdf-docs button");
  await p.until(`document.querySelector('.pdf-doc h2')?.textContent === ${JSON.stringify(name)}`, 10000);
  await p.until("document.querySelectorAll('.grid-row').length > 2", 10000);
};
/** Text of the cell at (row, col), 1-based, as displayed in the grid. */
const cellText = (p, r, c) =>
  p.eval(`(() => { const rows = [...document.querySelectorAll('.grid-row:not(.grid-head)')];
    const row = rows.find(x => x.querySelector('.rh')?.textContent === '${r}');
    return row ? row.children[${c}].textContent : null; })()`);
const clickCell = (p, r, c) =>
  p.eval(`(() => { const row = [...document.querySelectorAll('.grid-row:not(.grid-head)')].find(x => x.querySelector('.rh')?.textContent === '${r}');
    row.children[${c}].click(); return true; })()`);
async function typeInto(p, text) {
  await p.fill("input[aria-label='Conținutul celulei']", text);
  await p.eval(`document.querySelector("input[aria-label='Conținutul celulei']").dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))`);
  await sleep(150);
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
  check("modulul Foi de calcul apare în catalog ca beta", await p.eval(`${card}?.innerText.toLowerCase().includes('beta') ?? false`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Foi de calcul'))");

  for (const f of ["files/xlsx/formule.xlsx", "files/xlsx/diacritice-foi-multiple.xlsx", "files/csv/windows-1250.csv"]) {
    check(`import ${f}`, (await tryImport(p, f)) === "ok");
  }
  const bad = await tryImport(p, "files/xlsx/stricat-trunchiat.xlsx");
  check("un fișier XLSX stricat e refuzat clar", bad.includes("deteriorat"), bad);
  if (existsSync(join(td, "large/ostil-bomba-zip.xlsx"))) {
    const bomb = await tryImport(p, "large/ostil-bomba-zip.xlsx");
    check("bomba zip e refuzată înainte de citire", bomb.includes("bombă zip"), bomb);
  }

  await go(p, "Foi de calcul");
  await p.until("document.querySelectorAll('.pdf-docs li .grow').length === 3", 10000);

  // Formulas: values and the formula bar.
  await openDoc(p, "formule.xlsx");
  check("SUM afișat cu valoarea din fișier", (await cellText(p, 8, 2)) === "71.75", await cellText(p, 8, 2));
  await clickCell(p, 8, 2);
  const bar = await p.eval("document.querySelector(\"input[aria-label='Conținutul celulei']\").value");
  check("bara de formulă arată formula", bar === "=SUM(B2:B6)", bar);

  // Edit B2 and add a formula in C2; preview, save, check recalculated values.
  await clickCell(p, 2, 2);
  await typeInto(p, "22");
  await clickCell(p, 2, 3);
  await typeInto(p, "=B2*2");
  check("modificările sunt marcate în tabel", (await p.eval("document.querySelectorAll('.grid-row span.edited').length")) === 2);
  await p.click("Previzualizează salvarea (2)");
  await p.until("!!document.querySelector('.dialog.wide')", 10000);
  const pv = await p.eval("document.querySelector('.dialog.wide').innerText");
  check("previzualizarea spune ce se recalculează, fără pierderi", pv.includes("2 celule modificate") && pv.includes("recalculate") && !pv.includes("ar pierde"), pv.slice(0, 160));
  await p.screenshot(join(shots, "01-previzualizare.png"));
  await p.click("Salvează ca versiune nouă", ".dialog button");
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('2 —')", 10000);
  await p.until("document.querySelectorAll('.grid-row').length > 2", 10000);
  check("SUM recalculat după salvare", (await cellText(p, 8, 2)) === "81.75", await cellText(p, 8, 2));
  check("formula nouă calculată", (await cellText(p, 2, 3)) === "44", await cellText(p, 2, 3));
  await p.screenshot(join(shots, "02-salvat.png"));

  // The original (version 1) still has the old values.
  await p.fill(".pdf-doc select", "1");
  await p.until("document.querySelectorAll('.grid-row').length > 2", 10000);
  await sleep(300);
  check("originalul are valorile vechi", (await cellText(p, 8, 2)) === "71.75" && (await cellText(p, 2, 2)) === "12");

  // Sheet tabs with diacritics.
  await openDoc(p, "diacritice-foi-multiple.xlsx");
  await p.click("Sumar ș ț", ".sheet-tabs button");
  await p.until("document.querySelector('.sheet-tabs button.active')?.textContent === 'Sumar ș ț'");
  await p.until("document.querySelectorAll('.grid-row').length > 2", 10000);
  await sleep(300);
  check("foaia „Sumar ș ț” arată totalul între foi", (await cellText(p, 1, 2)) === "2180.75", await cellText(p, 1, 2));

  // CSV in the old Windows code page: read-only.
  await openDoc(p, "windows-1250.csv");
  check("CSV Windows-1250 cu diacritice corecte", (await cellText(p, 2, 2)) === "Ţăndărei", await cellText(p, 2, 2));
  check("CSV-ul e doar pentru citire", (await p.eval("document.querySelector('.pdf-doc').innerText")).includes("doar pentru citire"));

  // Templates: use the invoice template, check its totals, edit the copy.
  await p.click("Șabloane de calcul…");
  await p.until("!!document.querySelector('.templates')", 10000);
  check("biblioteca are 5 șabloane", (await p.eval("document.querySelectorAll('.templates li').length")) === 5);
  await p.screenshot(join(shots, "04-sabloane.png"));
  await p.eval("[...document.querySelectorAll('.templates li')].find(li => li.innerText.includes('Factură')).querySelector('button').click()");
  await p.until("document.querySelector('.pdf-doc h2')?.textContent === 'Factură.xlsx'", 10000);
  await p.until("document.querySelectorAll('.grid-row').length > 20", 10000);
  await sleep(400);
  check("factura din șablon: total de plată 1701.26", (await cellText(p, 22, 6)) === "1701.26", await cellText(p, 22, 6));
  await clickCell(p, 11, 4);
  await typeInto(p, "100");
  await p.click("Previzualizează salvarea (1)");
  await p.until("!!document.querySelector('.dialog.wide')", 10000);
  await p.click("Salvează ca versiune nouă", ".dialog button");
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('2 —')", 10000);
  await p.until("document.querySelectorAll('.grid-row').length > 20", 10000);
  await sleep(400);
  check("copia recalculată: 100 × 85,50 = 8550", (await cellText(p, 11, 6)) === "8550", await cellText(p, 11, 6));
  await p.screenshot(join(shots, "05-factura-din-sablon.png"));

  // A 100k-row sheet: import, scroll to the end.
  if (existsSync(join(td, "large/100k-randuri.xlsx"))) {
    const t0 = Date.now();
    check("import 100.000 de rânduri", (await tryImport(p, "large/100k-randuri.xlsx")) === "ok", `${Date.now() - t0} ms`);
    await go(p, "Acasă");
    await go(p, "Foi de calcul");
    await p.until("document.querySelectorAll('.pdf-docs li .grow').length === 5", 10000);
    const t1 = Date.now();
    await openDoc(p, "100k-randuri.xlsx");
    const openMs = Date.now() - t1;
    await p.eval("document.querySelector('.grid').scrollTop = 99995 * 26");
    const t2 = Date.now();
    await p.until("[...document.querySelectorAll('.grid-row .rh')].some(e => e.textContent === '100001')", 10000);
    await sleep(300);
    const last = await cellText(p, 100001, 1);
    check("derulare până la ultimul rând", last === "100000", `deschidere ${openMs} ms, salt la final ${Date.now() - t2} ms`);
    await p.screenshot(join(shots, "03-100k.png"));
  }

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
