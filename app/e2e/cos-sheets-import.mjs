// 7.4l-4b-1, end to end in the real window: „Import CSV” (the Import din text window) and „Import .docx (tabele)” of
// the spreadsheet window copied from Cyber Office Studio. Tested by people in COS (TESTAT-DE-OAMENI.md §4: at a
// colleague's it did not work), so it must behave the same here (D-078): the encoding guessed (UTF-8, UTF-16,
// Windows-1250), the separator, 1.234,56 as a number, leading zeros kept, fixed width (.prn), the choices changed in
// the window, a large file, Renunță, the tables of a .docx as sheets, and the two windows in English.
// The files are the ones COS's own tests write (cos/tests/sheets-text-import.test.mjs, sheets-doc-tables.test.mjs);
// the system's open dialog is replaced in the page (window.kgbHost.open), the file still goes through the core.
//
// Usage: node app/e2e/cos-sheets-import.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-sheets-import.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-sheets-import-"));
const PORT = 9346;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// The test files, written by the COS tests themselves.
const cos = resolve(import.meta.dirname, "../cos");
for (const t of ["tests/sheets-text-import.test.mjs", "tests/sheets-doc-tables.test.mjs"])
  execFileSync(process.execPath, ["--import", "./hooks.mjs", t], { cwd: cos, stdio: "ignore" });
const files = join(tmpdir(), "suite-textimport-files");
const file = (n) => join(files, n);
if (!existsSync(file("01-ro-punct-virgula.csv")) || !existsSync(file("tabele.docx"))) throw new Error(`lipsesc fișierele de test din ${files}`);

const go = (p, label) => p.click(label, "nav .nav");
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
const pick = (p, path) => p.eval(`(() => { window.kgbHost.open = async () => ${JSON.stringify(path)}; return true; })()`);
/** A button of the window by its text (opening the File tab if it is there). */
async function button(p, labels) {
  const click = `(() => { const b = [...document.querySelectorAll('button')].find(b => ${JSON.stringify(labels)}.includes(b.textContent.trim()) && !b.disabled); if (!b) return ''; b.click(); return b.textContent.trim(); })()`;
  const got = await fr(p, click);
  if (got) return got;
  await fr(p, `(() => { const t = [...document.querySelectorAll('button')].find(b => ['Fișier', 'File'].includes(b.textContent.trim())); t?.click(); return !!t; })()`);
  await sleep(400);
  return (await frWait(p, click, 5000)) || "";
}
const DLG = `[role=dialog][aria-label="Import din text"]`;
const DDLG = `[role=dialog][aria-label="Import tabele din document"]`;
const dlgText = (p, sel = DLG) => fr(p, `document.querySelector('${sel}')?.innerText ?? ''`);
const dlgButton = (p, label, sel = DLG) =>
  fr(p, `(() => { const b = [...document.querySelectorAll('${sel} button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); b?.click(); return !!b; })()`);
const setSelect = (p, aria, value) =>
  fr(p, `(() => { const s = document.querySelector('${DLG} select[aria-label="${aria}"]'); if (!s) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new window.Event('change', { bubbles: true })); return true; })()`);
const setInput = (p, aria, value) =>
  fr(p, `(() => { const s = document.querySelector('${DLG} input[aria-label="${aria}"]'); if (!s) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new window.Event('input', { bubbles: true })); return true; })()`);
const preview = (p, r, c) => fr(p, `document.querySelector('${DLG} [data-testid=ti-preview] tbody')?.rows[${r}]?.cells[${c}]?.textContent ?? ''`);
const cell = (p, r, c) => fr(p, `document.querySelector('tr[data-r="${r}"]')?.querySelectorAll('td')[${c}]?.textContent.trim() ?? ''`);
const bold = (p, r, c) =>
  fr(p, `(() => { const td = document.querySelector('tr[data-r="${r}"]')?.querySelectorAll('td')[${c}]; if (!td) return false; const w = (e) => +window.getComputedStyle(e).fontWeight; return w(td) >= 600 || (td.firstElementChild ? w(td.firstElementChild) >= 600 : false); })()`);
const bodyText = (p) => fr(p, "document.body.innerText");
/** After a first import the table is unsaved: the window asks before replacing it (askDiscard). */
const passDiscard = (p) => fr(p, `(() => { const b = [...document.querySelectorAll('button')].find(b => ['Continui fără să salvez', 'Continue without saving'].includes(b.textContent.trim())); b?.click(); return !!b; })()`);
async function openDialog(p, path, labels, sel) {
  await pick(p, path);
  await button(p, labels);
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await fr(p, `!!document.querySelector('${sel}')`)) return true;
    await passDiscard(p);
    await sleep(200);
  }
  return false;
}
async function importText(p, name, during, timeout = 60000) {
  const shown = await openDialog(p, file(name), ["Import CSV"], DLG);
  if (during) await during();
  if (shown) {
    await dlgButton(p, "Încarcă");
    await frWait(p, `!document.querySelector('${DLG}') && /Importat din ${name.replace(/\./g, "\\\\.")}/.test(document.body.innerText)`, timeout);
    await sleep(400);
  }
  return shown;
}

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await go(p, "Catalog module");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Foi de calcul'))";
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Foi de calcul'))", 8000);
  await go(p, "Foi de calcul");
  await p.click("Registru nou în foaia de calcul");
  await p.until("!!document.querySelector('.cos-frame iframe')", 5000);
  await frWait(p, "!!document.querySelector('.sheet-wrap')", 30000);
  await fr(p, "(window.__errs = [], window.addEventListener('error', (e) => window.__errs.push(String(e.message))), window.addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason))), true)");

  // The Romanian classic: UTF-8, „;”, decimal comma, a header row.
  const shown = await importText(p, "01-ro-punct-virgula.csv", async () => {
    const t = await dlgText(p);
    check("fereastra arată ce s-a ghicit (UTF-8, „;”, virgulă, cap de tabel)", /UTF-8/.test(t) && /„;”/.test(t) && /virgulă/.test(t) && /capul de tabel/.test(t), t.slice(0, 200));
    check("previzualizarea: 1.234,56 ca număr și 007 ca text", (await preview(p, 1, 3)) === "1.234,56" && (await preview(p, 1, 4)) === "007", `${await preview(p, 1, 3)} / ${await preview(p, 1, 4)}`);
    await p.screenshot(join(shots, "01-import-din-text.png"));
  });
  check("„Import CSV” deschide fereastra Import din text", shown);
  const ro = [await cell(p, 1, 0), await cell(p, 1, 1), await cell(p, 1, 3), await cell(p, 1, 4)];
  check("valorile în tabel (dată, diacritice, număr, cod cu zerouri)", ro.join("|") === "28.10.2026|Șurub țeavă|1.234,56|007", ro.join(" | "));
  check("capul de tabel îngroșat", await bold(p, 0, 0));

  await importText(p, "07-win1250-sedile.csv", async () => check("Windows-1250 ghicit", /Windows-1250/.test(await dlgText(p)), (await dlgText(p)).slice(0, 160)));
  check("Windows-1250: Târgu Mureş și Ţăndărei", (await cell(p, 1, 0)) === "Târgu Mureş" && (await cell(p, 2, 0)) === "Ţăndărei", `${await cell(p, 1, 0)} / ${await cell(p, 2, 0)}`);

  await importText(p, "04-text-unicode.txt", async () => check("UTF-16 (Text Unicode) ghicit", /UTF-16/.test(await dlgText(p)), (await dlgText(p)).slice(0, 160)));
  check("UTF-16 cu Tab: Iași și Constanța", /Iași/.test(await bodyText(p)) && /Constanța/.test(await bodyText(p)));

  await importText(p, "13-latime-fixa.prn", async () => check("lățime fixă ghicită (.prn)", /lățime fixă/.test(await dlgText(p)), (await dlgText(p)).slice(0, 160)));
  check("lățime fixă: explicația și suma în coloane separate", (await cell(p, 1, 1)) === "Plata factura 123" && (await cell(p, 1, 2)) === "1.234,56", `${await cell(p, 1, 1)} / ${await cell(p, 1, 2)}`);

  await importText(p, "03-ghilimele-cr.csv", async () => {
    await setInput(p, "Începe de la rândul", "2");
    await sleep(300);
    check("previzualizarea pornește de la rândul 2", (await preview(p, 0, 0)) === "Pop; Ion", await preview(p, 0, 0));
    await setSelect(p, "Separator", ",");
    await sleep(300);
    check("separatorul „,” refă previzualizarea", /Pop; Ion/.test(await preview(p, 0, 0)) && /bună/.test(await preview(p, 0, 0)), await preview(p, 0, 0));
    await setSelect(p, "Separator", ";");
    await sleep(300);
    await setSelect(p, "Coloana 2", "skip");
    await sleep(200);
  });
  check("începe de la rândul 2 și coloana omisă", (await cell(p, 0, 0)) === "Pop; Ion" && (await cell(p, 0, 1)) === "", `${await cell(p, 0, 0)} / ${await cell(p, 0, 1)}`);

  // The large file: how long the core takes to hand it over (peek) is measured apart from the window.
  const tp = Date.now();
  await p.eval(`window.__TAURI_INTERNALS__.invoke("module_import_file_with", { id: "kgb.sheets", path: ${JSON.stringify(file("19-lung.csv"))}, command: "peek", args: {} }).then(r => r.data.length)`);
  console.log(`      (nucleul predă fișierul de 11,6 MB în ${Math.round((Date.now() - tp) / 100) / 10} s)`);
  const t0 = Date.now();
  await importText(p, "19-lung.csv", undefined, 240000);
  const big = (await bodyText(p)).match(/Importat din[^\n]*/)?.[0] ?? "";
  check(`fișier mare (200.001 rânduri) adus în ${Math.round((Date.now() - t0) / 1000)} s`, /200001 rânduri, 6 coloane/.test(big), big);

  await openDialog(p, file("12-bara.txt"), ["Import CSV"], DLG);
  await dlgButton(p, "Renunță");
  await sleep(500);
  check("Renunță închide fereastra", !(await fr(p, `!!document.querySelector('${DLG}')`)));

  // The tables of a .docx, each on its own sheet.
  const dshown = await openDialog(p, file("tabele.docx"), ["Import .docx (tabele)"], DDLG);
  check("„Import .docx (tabele)” găsește 2 tabele", dshown && /2 tabele/.test(await dlgText(p, DDLG)), String(dshown));
  if (dshown) {
    await dlgButton(p, "Încarcă", DDLG);
    await frWait(p, "/Importat din tabele\\.docx/.test(document.body.innerText)", 20000);
    await sleep(500);
  }
  const sheetTabs = await fr(p, "[...document.querySelectorAll('.sheet-tab')].map(t => t.textContent.trim()).join('|')");
  check("două foi: Tabel 1 și Tabel 2", /Tabel 1\|Tabel 2/.test(sheetTabs ?? ""), sheetTabs);
  const t1 = [await cell(p, 0, 0), await cell(p, 1, 1), await cell(p, 1, 2), await cell(p, 1, 3)];
  check("Tabel 1: cap, cod 007, 1.234,56, data", t1.join("|") === "Produs|007|1.234,56|28.10.2026" && (await bold(p, 0, 0)), t1.join(" | "));
  await p.screenshot(join(shots, "02-tabele-docx.png"));

  // In English the two windows have no Romanian left (only the file's own data, in the preview).
  await p.eval("[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'EN')?.click()");
  await sleep(1000);
  const RO = String.raw`/[ăâîșțşţĂÂÎȘȚŞŢ]|\b(și|sau|pentru|după|fără|din|pe|la|cu|de|nu|mai|rândul|coloana|virgulă|zecimale|separator(ul)?|codificare|încarcă|renunță)\b/i`;
  const roLeft = (sel) =>
    fr(p, `(() => { const d = document.querySelector('${sel}'); if (!d) return '(fără fereastră)'; const out = [];
      const w = document.createTreeWalker(d, window.NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.parentElement.closest('tbody, .no-i18n')) continue; const t = n.data.trim(); if (t) out.push(t); }
      for (const o of d.querySelectorAll('option')) out.push(o.textContent.trim());
      return out.filter(t => ${RO}.test(t.replace(/[0-9a-z_.-]+\\.(csv|txt|docx)/gi, ''))).join(' | '); })()`);
  const DLG_EN = `[role=dialog][aria-label="Import from text"]`;
  const DDLG_EN = `[role=dialog][aria-label="Import tables from document"]`;
  await pick(p, file("01-ro-punct-virgula.csv"));
  await button(p, ["Import CSV"]);
  for (let i = 0; i < 50 && !(await fr(p, `!!document.querySelector('${DLG_EN}')`)); i++) {
    await passDiscard(p);
    await sleep(200);
  }
  let left = await roLeft(DLG_EN);
  check("EN: fereastra Import din text fără română", left === "", left);
  await dlgButton(p, "Cancel", DLG_EN);
  await sleep(400);
  await pick(p, file("tabele.docx"));
  const docxBtn = await button(p, ["Import .docx (tables)", "Import .docx (tabele)"]);
  for (let i = 0; i < 75 && !(await fr(p, `!!document.querySelector('${DDLG_EN}')`)); i++) {
    await passDiscard(p);
    await sleep(200);
  }
  left = await roLeft(DDLG_EN);
  check(`EN: fereastra Import tabele fără română (butonul: ${docxBtn})`, left === "" && docxBtn === "Import .docx (tables)", left || docxBtn);
  await dlgButton(p, "Cancel", DDLG_EN);
  await p.eval("[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'RO')?.click()");
  await sleep(500);

  check("nicio eroare în fereastră", (await fr(p, "JSON.stringify(window.__errs ?? [])")) === "[]", await fr(p, "JSON.stringify(window.__errs ?? [])"));
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
