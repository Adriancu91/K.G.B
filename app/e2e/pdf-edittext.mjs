// 7.4l-0b, end to end in the real window: editing the text of a PDF page on click, with the "Editează text"
// layer of Cyber Office Studio. A line is changed (the old text leaves the page, the new one keeps its colour),
// a paragraph is rewritten, a line is deleted; every change goes through the preview and becomes a new version,
// the other page keeps its text and the original version stays as it was.
//
// Usage: node app/e2e/pdf-edittext.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR) and a PDF made here; never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node pdf-edittext.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-pdfedit-"));
const PORT = 9347;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// The test PDF: page 1 with a blue line, a three-line paragraph and a line to delete; page 2 untouched.
const app = resolve(import.meta.dirname, "..");
const req = createRequire(join(app, "package.json"));
const { PDFDocument, rgb } = await import(pathToFileURL(req.resolve("pdf-lib")).href);
const fontkit = (await import(pathToFileURL(req.resolve("@pdf-lib/fontkit")).href)).default;
const fonts = join(app, "node_modules/pdfjs-dist/standard_fonts");
const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const f = await doc.embedFont(readFileSync(join(fonts, "LiberationSans-Regular.ttf")), { subset: true });
const p1 = doc.addPage([595, 842]);
p1.drawText("Contract nr. 123 semnat la Brașov.", { x: 72, y: 700, size: 16, font: f, color: rgb(0, 0, 0.7) });
const para = ["Chiria se plătește lunar, până pe data de cinci", "a fiecărei luni, în contul proprietarului indicat", "mai jos, fără alte comisioane bancare."];
para.forEach((l, i) => p1.drawText(l, { x: 72, y: 600 - i * 16, size: 12, font: f }));
p1.drawText("Rând de șters din pagină.", { x: 72, y: 450, size: 12, font: f });
doc.addPage([595, 842]).drawText("Pagina a doua rămâne la fel.", { x: 72, y: 700, size: 14, font: f });
const pdfPath = join(data, "contract-test.pdf");
writeFileSync(pdfPath, await doc.save());

const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const call = (p, command, args) => invoke(p, "module_call", { id: "kgb.pdf", command, args });

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  const mouse = (type, x, y, extra = {}) => p.send("Input.dispatchMouseEvent", { type, x, y, button: "left", ...extra });
  const clickAt = async (x, y, modifiers = 0) => {
    await mouse("mouseMoved", x, y, { button: "none", modifiers });
    await mouse("mousePressed", x, y, { clickCount: 1, buttons: 1, modifiers });
    await mouse("mouseReleased", x, y, { clickCount: 1, modifiers });
    await sleep(300);
  };
  const key = async (k, code, vk, modifiers = 0) => {
    await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
    await sleep(200);
  };
  const box = () =>
    p.eval(`(() => { const e = document.querySelector('.pdf-big .pdf-page-box'); e.scrollIntoView({ block: 'start' });
      const r = e.getBoundingClientRect(); return [r.left, r.top, r.width]; })()`);
  // A point of the page (PDF points from the bottom left, A4) on the screen.
  const at = async (x, y) => {
    const [l, t, w] = await box();
    const z = w / 595;
    return [l + x * z, t + (842 - y) * z];
  };
  const editor = () => p.eval("(() => { const e = document.querySelector('[data-testid=pdf-textedit-input]'); return e ? { value: e.value, para: e.dataset.para === '1' } : null; })()");
  const ready = () => p.until("!!document.querySelector('.pdf-textedit[data-ready]')", 15000);
  const saveVersion = async () => {
    await p.until("!!document.querySelector('.dialog.wide canvas')", 20000);
    const title = await p.eval("document.querySelector('.dialog.wide').innerText");
    await p.click("Salvează ca versiune nouă", ".dialog button");
    await p.until("!document.querySelector('.dialog.wide')", 15000);
    return title;
  };
  const texts = async (version = null) => {
    const docs = await call(p, "list", {});
    return call(p, "text", { id: docs[0].id, version });
  };

  // The PDF module, enabled, and the test document imported.
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Documente PDF'))";
  await p.until(`!!${card}`, 10000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Documente PDF'))");
  await invoke(p, "module_import_file", { id: "kgb.pdf", path: pdfPath });
  await p.click("Documente PDF", "nav .nav");
  await p.until("!!document.querySelector('.pdf-docs button')", 10000);
  await p.click("contract-test.pdf", ".pdf-docs button");
  await p.until("!!document.querySelector('.pdf-pages .thumb')", 10000);
  await p.eval("document.querySelector('.pdf-pages .thumb').click()");
  await p.until("!!document.querySelector('.pdf-big .pdf-page-box canvas')", 10000);

  // Editează text.
  await p.click("Editează text", ".pdf-big button");
  await ready();
  check("„✎ Editează text” pune stratul de editare peste pagină", true);

  // 1) A line: clicked, rewritten, Enter.
  await clickAt(...(await at(150, 705)));
  const e1 = await editor();
  check("clic pe rând: caseta are textul rândului", e1?.value === "Contract nr. 123 semnat la Brașov." && !e1.para, JSON.stringify(e1));
  await p.send("Input.insertText", { text: "Contract nr. 456 semnat la Iași." });
  await key("Enter", "Enter", 13);
  const t1 = await saveVersion();
  check("schimbarea trece prin previzualizare (textul celorlalte pagini păstrat)", t1.includes("Editarea textului") && t1.includes("s-au păstrat"), t1.slice(0, 160));
  let now = await texts();
  check("rândul are textul nou, cel vechi nu mai e în pagină", now[0].includes("Contract nr. 456 semnat la Iași.") && !now[0].includes("123") && !now[0].includes("Brașov"), now[0].slice(0, 120));
  check("pagina a doua are același text", now[1].includes("Pagina a doua rămâne la fel."), now[1]);
  await p.until("!!document.querySelector('.pdf-big .pdf-page-box canvas')", 10000);
  await ready();
  await sleep(500);
  const blue = await p.eval(`(() => { const c = document.querySelector('.pdf-big .pdf-page-box canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, Math.floor(c.height * 0.25)).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 120 && d[i] < 60 && d[i + 1] < 60) n++; return n; })()`);
  check("textul nou păstrează culoarea albastră a rândului", blue > 100, `${blue} pixeli albaștri`);
  await p.screenshot(join(shots, "01-rand-schimbat.png"));

  // 2) The paragraph: one click opens all three lines; the new text is laid out on the paragraph's width.
  await clickAt(...(await at(150, 588)));
  const e2 = await editor();
  check("clic pe paragraf: caseta are tot paragraful", !!e2?.para && e2.value.includes("lunar") && e2.value.includes("comisioane"), JSON.stringify(e2));
  await p.send("Input.insertText", { text: "Chiria se plătește trimestrial, în primele zece zile ale trimestrului, în contul indicat mai jos." });
  await key("Enter", "Enter", 13);
  await saveVersion();
  now = await texts();
  const flat = now[0].replace(/\s+/g, " ");
  check("paragraful are textul nou", flat.includes("trimestrial") && flat.includes("zece zile") && !flat.includes("lunar"), flat.slice(0, 200));

  // 3) A line deleted (Delete with the whole text chosen).
  await ready();
  await clickAt(...(await at(120, 454)));
  const e3 = await editor();
  check("clic pe rândul de șters", e3?.value === "Rând de șters din pagină.", JSON.stringify(e3));
  await key("Delete", "Delete", 46);
  await saveVersion();
  now = await texts();
  check("Delete scoate rândul din pagină", !now[0].includes("Rând de șters"), now[0].slice(-80));

  // Versions: three edits, the original kept.
  const docs = await call(p, "list", {});
  check("trei editări = trei versiuni noi", docs[0].current === 4, `versiunea ${docs[0].current}`);
  const orig = await texts(1);
  check("versiunea 1 (originalul) are textul de la început", orig[0].includes("Contract nr. 123 semnat la Brașov.") && orig[0].includes("lunar"), orig[0].slice(0, 80));
  await p.screenshot(join(shots, "02-dupa-editari.png"));
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
