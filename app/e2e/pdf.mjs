// Etapa 3 step 3.5, end to end in the real window: the PDF module.
// Import (the system file dialog cannot be driven from here, so the test
// calls the same `module_import_file` command the dialog's result goes to),
// thumbnails, pdf.js view, rotate / remove / extract / merge with preview, a
// damaged PDF read-only, versions and restore, export of a copy.
//
// Usage: node app/e2e/pdf.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node pdf.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-pdf-"));
const td = resolve(import.meta.dirname, "../../testdata/etapa3/files");
const PORT = 9337;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const go = (p, label) => p.click(label, "nav .nav");
const invoke = (p, cmd, args) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const importFile = (p, rel) => invoke(p, "module_import_file", { id: "kgb.pdf", path: join(td, rel) });
const docNames = (p) => p.eval("[...document.querySelectorAll('.pdf-docs li .grow')].map(e => e.textContent)");
const openDoc = async (p, name) => {
  await p.click(name, ".pdf-docs button");
  await p.until(`document.querySelector('.pdf-doc h2')?.textContent === ${JSON.stringify(name)}`, 10000);
};
const thumbsLoaded = (p, n) =>
  p.until(`[...document.querySelectorAll('.pdf-pages img')].filter(i => i.complete && i.naturalWidth > 0).length >= ${n}`, 15000);
const selectPages = (p, pages) =>
  p.eval(`(() => { const boxes = [...document.querySelectorAll('.pdf-pages li input[type=checkbox]')];
    for (const n of ${JSON.stringify(pages)}) boxes[n - 1].click(); return true; })()`);
const versionLabel = (p) => p.eval("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent ?? ''");
/** Fraction of non-white pixels in the first canvas matching `selector`. */
const ink = (p, selector) =>
  p.eval(`(() => { const c = document.querySelector(${JSON.stringify(selector)}); if (!c || !c.width) return 0;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i+1] < 200 || d[i+2] < 200) n++;
    return n / (d.length / 4); })()`);
async function previewAndApply(p, button, applyLabel) {
  await p.click(button, ".pdf-doc button");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 10000);
  await sleep(500);
  const ok = (await ink(p, ".dialog.wide canvas")) > 0.001;
  await p.click(applyLabel, ".dialog button");
  await p.until("!document.querySelector('.dialog.wide')", 10000);
  return ok;
}

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);

  // Enable the PDF module from the catalog (its card, not the first one).
  await go(p, "Catalog module");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Documente PDF'))";
  check("modulul PDF apare în catalog ca beta", await p.eval(`${card}?.innerText.toLowerCase().includes('beta') ?? false`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  check("activarea arată permisiunea cerută", (await p.eval("document.querySelector('.dialog')?.innerText ?? ''")).includes("files.own"));
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Documente PDF'))");

  // Import four files, one of them damaged.
  for (const f of ["pdf/multipagina-50.pdf", "pdf/rotite-si-formate.pdf", "edge/factura.pdf", "pdf/stricat-trunchiat.pdf"]) {
    await importFile(p, f);
  }
  const bad = await p.eval(
    `window.__TAURI_INTERNALS__.invoke("module_import_file", ${JSON.stringify({ id: "kgb.pdf", path: join(td, "pdf/nu-e-pdf.pdf") })}).then(() => "acceptat", (e) => String(e))`,
  );
  check("un fișier care nu e PDF e refuzat clar", String(bad).includes("nu este un PDF"), String(bad));
  await go(p, "Documente PDF");
  await p.until("document.querySelectorAll('.pdf-docs li .grow').length === 4", 10000);
  check("cele 4 PDF-uri apar în listă", (await docNames(p)).length === 4, JSON.stringify(await docNames(p)));

  // Invoice from Edge: thumbnails (hayro) and the big pdf.js view.
  await openDoc(p, "factura.pdf");
  await thumbsLoaded(p, 1);
  check("miniatura facturii e desenată", true);
  await p.click("", ".pdf-pages button.thumb");
  await p.until("!!document.querySelector('.pdf-big canvas')", 10000);
  await sleep(800);
  const inkBig = await ink(p, ".pdf-big canvas");
  check("pdf.js afișează pagina mare (conține text și tabel)", inkBig > 0.01, `cerneală ${(inkBig * 100).toFixed(1)}%`);
  await p.screenshot(join(shots, "01-factura.png"));
  await p.click("Înapoi la pagini");

  // Rotate pages 1 and 2 of the 4-page file → version 2, after a preview.
  await openDoc(p, "rotite-si-formate.pdf");
  await thumbsLoaded(p, 4);
  await selectPages(p, [1, 2]);
  check("previzualizarea rotirii arată paginile", await previewAndApply(p, "Rotește ↻", "Salvează ca versiune nouă"));
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('2 —')", 10000);
  check("rotirea a creat versiunea 2", (await versionLabel(p)).includes("2 pagini rotite cu 90°"), await versionLabel(p));
  check("rotirile se văd pe pagini", (await p.eval("document.querySelector('.pdf-pages').innerText")).includes("· 90°"));
  await p.screenshot(join(shots, "02-rotire.png"));

  // Remove pages 2..49 from the 50-page file.
  await openDoc(p, "multipagina-50.pdf");
  await thumbsLoaded(p, 10);
  await selectPages(p, Array.from({ length: 48 }, (_, i) => i + 2));
  check("previzualizarea scoaterii paginilor", await previewAndApply(p, "Scoate paginile", "Salvează ca versiune nouă"));
  await p.until("document.querySelectorAll('.pdf-pages li').length === 2", 10000);
  check("rămân 2 pagini (1 și 50)", (await p.eval("document.querySelector('.pdf-doc').innerText")).includes("2 pagini"));

  // Look at the original again, then restore it as version 3.
  await p.fill(".pdf-doc select", "1");
  await p.until("document.querySelectorAll('.pdf-pages li').length >= 50", 10000);
  check("originalul (versiunea 1) are în continuare 50 de pagini", true);
  await p.click("Restaurează această versiune");
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('3 —')", 10000);
  check("restaurarea a creat versiunea 3", (await versionLabel(p)).includes("restaurat din versiunea 1"), await versionLabel(p));

  // Extract page 1 of the invoice into a new document.
  await openDoc(p, "factura.pdf");
  await thumbsLoaded(p, 1);
  await selectPages(p, [1]);
  check("previzualizarea extragerii", await previewAndApply(p, "Extrage în document nou", "Creează documentul"));
  await p.until("document.querySelectorAll('.pdf-docs li .grow').length === 5", 10000);
  check("documentul extras apare în listă", (await docNames(p)).includes("factura - extras.pdf"), JSON.stringify(await docNames(p)));

  // 7.4l-1a: watermark, header and page numbers over the invoice.
  await openDoc(p, "factura.pdf");
  await thumbsLoaded(p, 1);
  await p.eval("[...document.querySelectorAll('.pdf-doc button')].find(b => b.textContent === 'Deselectează')?.click()");
  await p.click("Filigran, antet, subsol…", ".pdf-doc button");
  await p.until("!!document.querySelector('.pdf-stamp')", 3000);
  await p.fill("input[aria-label='Filigranul']", "COPIE — NEPLĂTITĂ");
  await p.fill("input[aria-label='Antetul']", "Fier Vechi SRL · Iași");
  await p.click("numerotează paginile", ".pdf-stamp button");
  check("„numerotează paginile” completează subsolul", (await p.eval("document.querySelector(\"input[aria-label='Subsolul']\").value")) === "Pagina {n} din {total}");
  const inkBefore = await p.eval("(() => { const i = document.querySelector('.pdf-pages img'); return i ? i.src.length : 0; })()");
  await p.eval("document.querySelector('.pdf-stamp button.primary').click()");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 15000);
  await sleep(500);
  const stampTitle = await p.eval("document.querySelector('.dialog.wide').innerText");
  check("previzualizarea arată ce se pune și că textul paginilor s-a păstrat", stampTitle.includes("filigran, antet, subsol pe 1 pagină") && stampTitle.includes("textul lor s-au păstrat"), stampTitle.slice(0, 160));
  await p.screenshot(join(shots, "02b-filigran.png"));
  await p.click("Salvează ca versiune nouă", ".dialog button");
  await p.until("!document.querySelector('.dialog.wide')", 10000);
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('2 —')", 10000);
  check("filigranul, antetul și subsolul au creat versiunea 2", (await versionLabel(p)).includes("filigran, antet, subsol"), await versionLabel(p));
  await thumbsLoaded(p, 1);
  const inkAfter = await p.eval("(() => { const i = document.querySelector('.pdf-pages img'); return i ? i.src.length : 0; })()");
  check("miniatura paginii s-a schimbat", inkBefore > 0 && inkAfter > 0 && inkAfter !== inkBefore, `${inkBefore} → ${inkAfter}`);

  // Merge the invoice and the 4-page file.
  await p.eval(`(() => { for (const li of document.querySelectorAll('.pdf-docs li'))
    if (['factura.pdf','rotite-si-formate.pdf'].includes(li.querySelector('.grow').textContent)) li.querySelector('input').click(); return true; })()`);
  await p.click("Unește documentele bifate (2)");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 10000);
  const mergeText = await p.eval("document.querySelector('.dialog.wide').innerText");
  check("unirea anunță ce nu se preia", mergeText.includes("Semnele de carte"), mergeText.slice(0, 120));
  await p.click("Creează documentul", ".dialog button");
  await p.until("document.querySelectorAll('.pdf-docs li .grow').length === 6", 10000);
  await p.until("document.querySelectorAll('.pdf-pages li').length === 5", 10000);
  check("documentul unit are 1 + 4 pagini", true);
  await p.screenshot(join(shots, "03-unire.png"));

  // The damaged file: read-only, with the reason, every action disabled.
  await openDoc(p, "stricat-trunchiat.pdf");
  const txt = await p.eval("document.querySelector('.pdf-doc').innerText");
  check("PDF-ul deteriorat e marcat și explicat", txt.includes("deteriorat") && txt.includes("trunchiat"), txt.slice(0, 160));
  const disabled = await p.eval(
    "['Rotește ↻','Rotește ↺','Scoate paginile','Extrage în document nou'].every(t => [...document.querySelectorAll('.pdf-doc button')].find(b => b.textContent.includes(t))?.disabled)",
  );
  check("toate modificările sunt dezactivate pentru el", disabled);
  await p.screenshot(join(shots, "04-deteriorat.png"));

  // Export a copy (the save dialog's result goes to the same command).
  const list = await invoke(p, "module_call", { id: "kgb.pdf", command: "list", args: {} });
  const merged = list.find((d) => d.name === "Documente unite.pdf");
  const dest = join(data, "export.pdf");
  await invoke(p, "module_call", { id: "kgb.pdf", command: "export", args: { id: merged.id, dest, overwrite: true } });
  check("exportul scrie o copie PDF", existsSync(dest) && readFileSync(dest).subarray(0, 5).toString() === "%PDF-");

  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
  console.log(await page?.text().catch(() => ""));
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
