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
/** Opens a panel whose button opens and closes it (does nothing if it is open already). */
async function openPanel(p, button, selector) {
  await p.until(`[...document.querySelectorAll('.pdf-doc button')].some(b => b.textContent.includes(${JSON.stringify(button)}) && !b.disabled)`, 10000);
  if (!(await p.eval(`!!document.querySelector(${JSON.stringify(selector)})`))) await p.click(button, ".pdf-doc button");
  await p.until(`!!document.querySelector(${JSON.stringify(selector)})`, 5000);
}
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

  // 7.4l-0a (D-078): the stamp as in Cyber Office Studio, put with a click and editable on the page — moved,
  // resized, changed on double-click, deleted — and still editable after saving (cdp-pdf-stamp-edit in COS).
  // Clicks, drags and keys are real input events (Input.dispatchMouseEvent / dispatchKeyEvent).
  const mouse = (type, x, y, extra = {}) => p.send("Input.dispatchMouseEvent", { type, x, y, button: "left", ...extra });
  const clickAt = async (x, y, count = 1) => {
    await mouse("mouseMoved", x, y, { button: "none" });
    for (let c = 1; c <= count; c++) {
      await mouse("mousePressed", x, y, { clickCount: c, buttons: 1 });
      await mouse("mouseReleased", x, y, { clickCount: c });
    }
    await sleep(250);
  };
  const dragBy = async (x, y, dx, dy) => {
    await mouse("mouseMoved", x, y, { button: "none" });
    await mouse("mousePressed", x, y, { clickCount: 1, buttons: 1 });
    for (let i = 1; i <= 6; i++) await mouse("mouseMoved", x + (dx * i) / 6, y + (dy * i) / 6, { buttons: 1 });
    await mouse("mouseReleased", x + dx, y + dy, { clickCount: 1 });
    await sleep(250);
  };
  const key = async (k, code, vk, modifiers = 0) => {
    await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
    await sleep(250);
  };
  /** [left, top, width, height] of the n-th element matching `sel`, scrolled into view. */
  const rectOf = (sel, n = 0) =>
    p.eval(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; if (!e) return null;
      e.scrollIntoView({ block: 'center', inline: 'center' }); const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
  const styleOf = (n = 0) => p.eval(`(() => { const e = document.querySelectorAll('.pdf-mark[data-mark=stamp]')[${n}]; const b = document.querySelector('.pdf-big .pdf-page-box');
    return e ? [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight, b.offsetWidth, e.style.cssText] : null; })()`);
  const stamps = () => p.eval("document.querySelectorAll('.pdf-mark[data-mark=stamp]').length");
  /** Pixels of a colour in the n-th stamp's own drawing. */
  const stampPixels = (test, n = 0) =>
    p.eval(`(() => { const c = document.querySelectorAll('.pdf-mark[data-mark=stamp] canvas')[${n}]; if (!c || !c.width) return 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0;
      for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3]; if (a > 100 && (${test})) k++; } return k; })()`);
  const BLUE = "b > 90 && r < 80 && g < 80";
  const GREEN = "g > 90 && r < 80 && b < 90";
  const RED = "r > 150 && g < 80 && b < 80";

  await openPanel(p, "Ștampilă…", ".pdf-stamps");
  await p.click("APROBAT", ".pdf-stamps button");
  await p.eval("document.querySelector(\"input[aria-label='Numele sub ștampilă']\").click()");
  await p.until("!!document.querySelector(\"input[aria-label='Numele de pe ștampilă']\")", 2000);
  await p.fill("input[aria-label='Numele de pe ștampilă']", "Ion Pop");
  await p.eval("document.querySelector(\"button[aria-label='Culoarea albastru']\").click()");
  const line = await p.eval("document.querySelector('.pdf-stamps').innerText");
  check("rândul de sub ștampilă: numele și data de azi", /Ion Pop · \d{2}\.\d{2}\.\d{4}/.test(line), line.match(/sub ștampilă: .*/)?.[0] ?? "");
  await p.click("Pune cu clic pe pagină", ".pdf-stamps button");
  await p.until("!!document.querySelector('.pdf-big .pdf-mark-catch')", 10000);
  await sleep(800);
  const box = await rectOf(".pdf-big .pdf-page-box");
  await clickAt(box[0] + box[2] * 0.35, box[1] + box[3] * 0.3);
  check("clic pe pagină: ștampila e pusă (și unealta se oprește)", (await stamps()) === 1 && !(await p.eval("!!document.querySelector('.pdf-mark-catch')")), `${await stamps()} ștampile`);
  check("ștampila e albastră", (await stampPixels(BLUE)) > 50, `${await stampPixels(BLUE)} pixeli`);

  const r0 = await rectOf(".pdf-mark[data-mark=stamp]");
  const s0 = await styleOf();
  await dragBy(r0[0] + r0[2] / 2, r0[1] + r0[3] / 2, 90, 50);
  const s1 = await styleOf();
  const r1 = await rectOf(".pdf-mark[data-mark=stamp]");
  check("ștampila se mută trăgând de ea", Math.abs(s1[0] - s0[0] - 90) < 6 && Math.abs(s1[1] - s0[1] - 50) < 6, `${s1[0] - s0[0]}, ${s1[1] - s0[1]}`);
  const se = await rectOf(".pdf-mark[data-mark=stamp] .pdf-mark-corner.se");
  await dragBy(se[0] + se[2] / 2, se[1] + se[3] / 2, 60, 0);
  const r2 = await rectOf(".pdf-mark[data-mark=stamp]");
  check("ștampila se mărește din colț (cu proporții)", r2[2] > r1[2] + 40 && r2[3] > r1[3] + 10, `${Math.round(r1[2])}×${Math.round(r1[3])} → ${Math.round(r2[2])}×${Math.round(r2[3])}`);

  await clickAt(r2[0] + r2[2] / 2, r2[1] + r2[3] / 2, 2);
  await p.until("!!document.querySelector('[data-testid=pdf-stamp-props]')", 3000);
  await p.fill("input[aria-label='Textul ștampilei puse']", "VERIFICAT ȘI APROBAT");
  await p.eval("document.querySelector('[data-testid=pdf-stamp-props] button[aria-label=Verde]').click()");
  await sleep(300);
  await p.click("Gata", "[data-testid=pdf-stamp-props] button");
  const edited = await styleOf();
  check("dublu-clic schimbă textul și culoarea (verde)", (await stampPixels(GREEN)) > 50 && (await stampPixels(BLUE)) < 10, `${await stampPixels(GREEN)} verzi`);

  // A second one with „Pune pe toate paginile”, then chosen with a click and deleted with the Delete key.
  await p.click("COPIE", ".pdf-stamps button");
  await p.fill("select[aria-label='Locul ștampilei']", "jos-stanga");
  await p.click("Pune pe toate paginile", ".pdf-stamps button");
  await p.until("document.querySelectorAll('.pdf-mark[data-mark=stamp]').length === 2", 5000);
  check("„Pune pe toate paginile” pune ștampila la locul ales", true);
  const r3 = await rectOf(".pdf-mark[data-mark=stamp]", 1);
  await clickAt(r3[0] + r3[2] / 2, r3[1] + r3[3] / 2);
  await key("Delete", "Delete", 46);
  check("Delete șterge ștampila aleasă", (await stamps()) === 1, `${await stamps()} rămase`);
  await p.screenshot(join(shots, "02c-stampila.png"));

  await key("s", "KeyS", 83, 2);
  await p.until("!!document.querySelector('.dialog.wide canvas')", 15000);
  await sleep(800);
  const green = await p.eval(`(() => { const c = document.querySelector('.dialog.wide canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i+1] > 90 && d[i] < 80 && d[i+2] < 90) n++; return n; })()`);
  const stTitle = await p.eval("document.querySelector('.dialog.wide').innerText");
  check("Ctrl+S: previzualizarea arată ștampila verde, textul paginii păstrat", stTitle.includes("1 ștampilă pe pagini") && stTitle.includes("textul lor s-au păstrat") && green > 10, `${green} pixeli verzi`);
  await p.click("Salvează ca versiune nouă", ".dialog button");
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('3 —')", 10000);
  check("ștampila a creat versiunea 3", (await versionLabel(p)).includes("1 ștampilă"), await versionLabel(p));

  // Reopened: the saved stamp is editable again, with its text, and the page under it has no second copy.
  // (After a new version of the same pages the open page stays open, 7.4l-0b.)
  await p.until("!!document.querySelector('.pdf-big .pdf-page-box canvas')", 10000);
  check("după salvare pagina rămâne deschisă", !(await p.eval("!!document.querySelector('.pdf-pages')")));
  await p.until("document.querySelectorAll('.pdf-mark[data-mark=stamp]').length === 1", 10000);
  await sleep(800);
  const r4 = await rectOf(".pdf-mark[data-mark=stamp]");
  const reopened = await styleOf();
  await clickAt(r4[0] + r4[2] / 2, r4[1] + r4[3] / 2, 2);
  await p.until("!!document.querySelector('[data-testid=pdf-stamp-props]')", 3000);
  const again = await p.eval("document.querySelector(\"input[aria-label='Textul ștampilei puse']\").value");
  check("după salvare ștampila se deschide iar pentru schimbare", again === "VERIFICAT ȘI APROBAT" && reopened.slice(0, 4).every((v, i) => Math.abs(v - edited[i]) <= 2), `„${again}”, ${JSON.stringify(reopened.slice(0, 4))} față de ${JSON.stringify(edited.slice(0, 4))}`);
  await key("Escape", "Escape", 27);
  const under = await p.eval(`(() => { const c = document.querySelector('.pdf-big .pdf-page-box > canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i+1] > 90 && d[i] < 80 && d[i+2] < 90) n++; return n; })()`);
  check("pagina de sub ea nu mai are o a doua ștampilă", under < 10, `${under} pixeli verzi pe pagină`);

  // „Ștampilele mele”: a red ring drawn as PNG (what StampDialog saves), chosen and put with a click.
  const { deflateSync, crc32 } = await import("node:zlib");
  const chunk = (ty, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(ty, 4, "latin1"); d.copy(b, 8); b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(ty, "latin1"), d])), 8 + d.length); return b; };
  const S = 64, raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; for (let x = 0; x < S; x++) { const o = y * (S * 4 + 1) + 1 + x * 4; const d = Math.hypot(x - 32, y - 32); if (d > 22 && d < 30) { raw[o] = 200; raw[o + 1] = 20; raw[o + 2] = 20; raw[o + 3] = 255; } } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(S, 0); ih.writeUInt32BE(S, 4); ih[8] = 8; ih[9] = 6;
  const ring = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
  await invoke(p, "module_call", { id: "kgb.pdf", command: "stampila_save", args: { nume: "Ștampila firmei", date: ring } });
  await p.click("Ștampilă…", ".pdf-doc button");
  await openPanel(p, "Ștampilă…", ".pdf-stamps");
  await p.until("!!document.querySelector(\".pdf-mystamps [data-mystamp='Ștampila firmei']\")", 5000);
  check("„Ștampilele mele” arată ștampila salvată", true);
  await p.eval("document.querySelector(\".pdf-mystamps [data-mystamp='Ștampila firmei'] button.link\").click()");
  await p.fill("input[aria-label='Lățimea ștampilei mele']", "30");
  await p.click("Pune cu clic pe pagină", ".pdf-stamps button");
  await p.until("!!document.querySelector('.pdf-big .pdf-mark-catch')", 5000);
  const box2 = await rectOf(".pdf-big .pdf-page-box");
  await clickAt(box2[0] + box2[2] * 0.7, box2[1] + box2[3] * 0.7);
  check("ștampila mea apare pe pagină (inelul roșu)", (await stamps()) === 2 && (await stampPixels(RED, 1)) > 10, `${await stampPixels(RED, 1)} pixeli roșii`);
  await p.click("Salvează ștampilele", ".pdf-stamp-bar button");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 15000);
  await p.click("Salvează ca versiune nouă", ".dialog button");
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('4 —')", 10000);
  check("ambele ștampile salvate în versiunea 4", (await versionLabel(p)).includes("2 ștampile"), await versionLabel(p));

  // 7.4l-1c: hiding data for good — a word found by „Caută”, a zone drawn with the mouse.
  await openPanel(p, "Ascunde date…", ".pdf-redact");
  await p.until("!!document.querySelector('.pdf-redact canvas')", 10000);
  await p.fill("input[aria-label='Cuvinte de ascuns']", "fiscala");
  await p.click("Caută", ".pdf-redact button");
  await p.until("(document.querySelector('.pdf-redact')?.innerText ?? '').includes('Găsite:')", 10000);
  const foundTxt = await p.eval("document.querySelector('.pdf-redact').innerText.match(/Găsite: [^.]*/)?.[0] ?? ''");
  check("„Caută” găsește cuvântul (fără diacritice, litere mari)", /Găsite: [1-9]/.test(foundTxt), foundTxt);
  const drawAt = (t, x, y) => p.eval(`(() => { const el = document.querySelector('.redact-page'); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('${t}', { bubbles: true, clientX: r.left + ${x}, clientY: r.top + ${y} })); return true; })()`);
  await drawAt("mousedown", 40, 300);
  await sleep(100);
  await drawAt("mousemove", 300, 360);
  await sleep(100);
  await drawAt("mouseup", 300, 360);
  await sleep(200);
  const zonesTxt = await p.eval("document.querySelector('.pdf-redact').innerText.match(/\\d+ zone aici/)?.[0] ?? ''");
  check("zona trasă cu mouse-ul se adaugă (lângă cea găsită)", zonesTxt.startsWith("2 "), zonesTxt);
  await p.eval("[...document.querySelectorAll('.pdf-redact button.primary')].find(b => b.textContent.startsWith('Previzualizează ascunderea')).click()");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 20000);
  const redTitle = await p.eval("document.querySelector('.dialog.wide').innerText");
  check("previzualizarea ascunderii", redTitle.includes("2 zone ascunse pe 1 pagină"), redTitle.slice(0, 120));
  await p.screenshot(join(shots, "02d-ascuns.png"));
  await p.click("Salvează ca versiune nouă", ".dialog button");
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('5 —')", 15000);
  const fact = (await invoke(p, "module_call", { id: "kgb.pdf", command: "list", args: {} })).find((d) => d.name === "factura.pdf");
  const texts = await invoke(p, "module_call", { id: "kgb.pdf", command: "text", args: { id: fact.id } });
  const plainTxt = (texts[0] ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const kept = plainTxt.includes("fct-0042");
  check(`după ascundere, cuvântul nu mai e în fișier (${kept ? "restul paginii a rămas text" : "pagina a devenit imagine"})`, texts.length === 1 && !plainTxt.includes("fiscala"), JSON.stringify(texts).slice(0, 120));
  // The finer way (COS redactKeep): on a plain page only the letters under the zones go, the rest stays text.
  await openDoc(p, "multipagina-50.pdf");
  await thumbsLoaded(p, 1);
  // The panel stays open from the invoice (the button opens and closes it).
  if (!(await p.eval("!!document.querySelector('.pdf-redact')"))) await p.click("Ascunde date…", ".pdf-doc button");
  await p.until("!!document.querySelector('.pdf-redact canvas')", 5000);
  await p.eval("document.querySelector(\"input[aria-label='Caută CNP']\").checked && document.querySelector(\"input[aria-label='Caută CNP']\").click()");
  await p.fill("input[aria-label='Cuvinte de ascuns']", "unic");
  await p.click("Caută", ".pdf-redact button");
  await p.until("(document.querySelector('.pdf-redact')?.innerText ?? '').includes('Găsite:')", 20000);
  await p.eval("[...document.querySelectorAll('.pdf-redact button.primary')].find(b => b.textContent.startsWith('Previzualizează ascunderea')).click()");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 30000);
  const keepTitle = await p.eval("document.querySelector('.dialog.wide').innerText");
  check("calea fină: restul paginilor rămâne text", keepTitle.includes("50 zone ascunse pe 50 pagini (restul paginii rămâne text)"), keepTitle.slice(0, 160));
  await p.click("Salvează ca versiune nouă", ".dialog button");
  await p.until("!document.querySelector('.dialog.wide')", 20000);
  const multi = (await invoke(p, "module_call", { id: "kgb.pdf", command: "list", args: {} })).find((d) => d.name === "multipagina-50.pdf");
  const mt = await invoke(p, "module_call", { id: "kgb.pdf", command: "text", args: { id: multi.id } });
  check("„unic” nu mai e în fișier, „Pagina 1 din 50” da", mt.length === 50 && !mt.some((t) => t.includes("unic")) && mt[0].includes("Pagina 1 din 50"), JSON.stringify(mt.slice(0, 2)));
  await p.screenshot(join(shots, "02e-ascuns-text.png"));
  await openDoc(p, "factura.pdf");
  // 7.4l-1d: the invoice page is an image now: the COS compression makes the file smaller, as a new version.
  await thumbsLoaded(p, 1);
  await openPanel(p, "Pagini pe foaie, mărime…", ".pdf-tools");
  await p.fill("select[aria-label='Cât de tare se comprimă pozele']", "2");
  await p.click("Comprimă pozele", ".pdf-tools button");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 30000);
  const compTitle = await p.eval("document.querySelector('.dialog.wide').innerText");
  check("comprimarea pozelor (din COS) micșorează fișierul", /1 poză micșorată: [\d,]+ (KB|MB) → [\d,]+ (KB|MB)/.test(compTitle), compTitle.slice(0, 160));
  await p.click("Salvează ca versiune nouă", ".dialog button");
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('6 —')", 15000);

  // Merge the invoice and the 4-page file.
  await p.eval(`(() => { for (const li of document.querySelectorAll('.pdf-docs li'))
    if (['factura.pdf','rotite-si-formate.pdf'].includes(li.querySelector('.grow').textContent)) li.querySelector('input').click(); return true; })()`);
  // The redacted page (an image) is still being drawn in the window: let it finish before merging.
  await sleep(1500);
  await p.click("Unește documentele bifate (2)");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 30000);
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

  // 7.4l-1d: 4 pages on a sheet (COS nup.ts) → a new document of 13 sheets from the 50 pages.
  await openDoc(p, "multipagina-50.pdf");
  await thumbsLoaded(p, 1);
  await openPanel(p, "Pagini pe foaie, mărime…", ".pdf-tools");
  await p.fill("select[aria-label='Pagini pe foaie']", "4");
  await p.eval("[...document.querySelectorAll('.pdf-tools button')].find(b => b.textContent === 'Previzualizează').click()");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 30000);
  const nupTitle = await p.eval("document.querySelector('.dialog.wide').innerText");
  check("4 pe foaie: previzualizarea are 13 foi (50 de pagini)", nupTitle.includes("4 pagini pe foaie") && nupTitle.includes("are 13 pagini"), nupTitle.slice(0, 200));
  await p.click("Creează documentul", ".dialog button");
  await p.until("[...document.querySelectorAll('.pdf-docs li .grow')].some(e => e.textContent === 'multipagina-50 - 4 pe foaie.pdf')", 15000);
  check("documentul nou „4 pe foaie” apare în listă", true);

  // 7.4l-1e: a PDF form filled in the window (COS formdata.ts), as a new version.
  await importFile(p, "pdf/formular.pdf");
  // Imported from here, not from the page: open the page again so the list is read anew.
  await go(p, "Acasă");
  await go(p, "Documente PDF");
  await p.until("[...document.querySelectorAll('.pdf-docs li .grow')].some(e => e.textContent === 'formular.pdf')", 10000);
  await openDoc(p, "formular.pdf");
  await openPanel(p, "Formular…", ".pdf-form");
  await p.until("!!document.querySelector('.pdf-form input')", 10000);
  const firstField = await p.eval("document.querySelector('.pdf-form input:not([type=checkbox])')?.getAttribute('aria-label') ?? ''");
  check("formularul își arată câmpurile", firstField.startsWith("Câmpul "), firstField);
  await p.fill(`.pdf-form input[aria-label='${firstField}']`, "Ion Popescu");
  await p.click("Salvează valorile", ".pdf-form button");
  await p.until("!!document.querySelector('.dialog.wide canvas')", 20000);
  check("previzualizarea completării", (await p.eval("document.querySelector('.dialog.wide').innerText")).includes("formular completat"));
  await p.click("Salvează ca versiune nouă", ".dialog button");
  await p.until("document.querySelector('.pdf-doc select')?.selectedOptions[0]?.textContent.startsWith('2 —')", 15000);
  await p.until(`document.querySelector(".pdf-form input[aria-label='${firstField}']")?.value === "Ion Popescu"`, 10000);
  check("valoarea e în versiunea nouă (recitită din fișier)", true);

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
