// D-081, end to end in the real window: the pages of the COS windows as PDF, made in a hidden window with
// WebView2. A Docs document of several pages with a header, a footer and page numbers; the PDF is read
// back with pdf.js (pages, the header on every page, "Pagina 1 din N"). A snapshot that carries
// <script>, <img onerror>, an <iframe> and an SVG <set> must run none of them: if any ran, the page would
// read "PWNED". Page layout in Sheets: the PDF of a workbook. And the hidden windows close after each job.
//
// Usage: node app/e2e/cos-print.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-print.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-print-"));
const PORT = 9342;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const go = (p, label) => p.click(label, "nav .nav");
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
/** The PDF of the frame's pages with these page settings, read back as text per page. */
async function pdfOf(p, settings) {
  const b64 = await fr(
    p,
    `window.kgbDocPdf(${JSON.stringify(settings)}).then((u) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }, (e) => 'ERR:' + String(e))`,
  );
  if (String(b64).startsWith('ERR:')) throw new Error(b64);
  const bytes = Buffer.from(b64, "base64");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(" "));
  await doc.loadingTask.destroy();
  return { bytes, pages };
}
const printWindows = async () => (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).filter((t) => /print=/.test(t.url)).length;

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await go(p, "Catalog module");
  for (const name of ["Documente text", "Foi de calcul"]) {
    await p.eval(`[...document.querySelectorAll('.card')].find(c => c.innerText.includes(${JSON.stringify(name)})).querySelector('button').click()`);
    await sleep(300);
    await p.click("Acordă și activează");
    await p.until(`[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes(${JSON.stringify(name)}))`);
  }

  // Docs: a document of several pages.
  await go(p, "Documente text");
  await p.click("Document nou");
  await frUntil(p, "!!document.querySelector('.ProseMirror')");
  await fr(
    p,
    `(() => { const ed = document.querySelector('.ProseMirror').editor; const para = Array.from({ length: 140 }, (_, i) => '<p>Rândul ' + (i + 1) + ' al contractului de vânzare, cu ș, ț, ă, î și â.</p>').join(''); ed.commands.setContent('<h1>Contract de vânzare</h1>' + para); return true; })()`,
  );
  await sleep(800);
  // What a hostile document could carry: none of it may run in the hidden window. (innerHTML leaves the
  // script inert here; in the snapshot it is a real <script> element.)
  const HOSTILE =
    `<img src="x" onerror="document.body.textContent='PWNED-IMG'">` +
    `<svg width="10" height="10"><a><set attributeName="href" to="javascript:document.body.textContent='PWNED-SVG'"/><text y="9">.</text></a></svg>` +
    '<iframe src="https://example.com/"></iframe><object data="https://example.com/x.swf"></object>' +
    "<script>document.body.textContent='PWNED-SCRIPT'</script>";
  await fr(p, `(() => { const box = document.createElement('div'); box.innerHTML = ${JSON.stringify(HOSTILE)}; document.body.appendChild(box); return true; })()`);
  const settings = { header: "Antet de test KGB", footer: "Subsol de test", numbers: true, numAt: "bc" };
  const t0 = Date.now();
  const { bytes, pages } = await pdfOf(p, settings);
  writeFileSync(join(shots, "docs.pdf"), bytes);
  check("Docs: PDF-ul are mai multe pagini", pages.length >= 3, `${pages.length} pagini în ${Date.now() - t0} ms`);
  check("textul documentului e în PDF, cu diacritice", pages.join(" ").includes("Contract de vânzare") && /Rândul 1 al contractului/.test(pages[0] ?? ""));
  check("antetul e pe fiecare pagină", pages.every((t) => t.includes("Antet de test KGB")));
  check("subsolul e pe fiecare pagină", pages.every((t) => t.includes("Subsol de test")));
  check("numerotarea: „Pagina 1 din N” … „Pagina N din N”", pages[0]?.includes(`Pagina 1 din ${pages.length}`) && pages[pages.length - 1]?.includes(`Pagina ${pages.length} din ${pages.length}`));
  check("nimic din fotografie nu a rulat (fără PWNED)", !pages.join(" ").includes("PWNED"));
  // First page different, as Docs asks for it.
  const first = await pdfOf(p, { ...settings, firstPage: { header: "Prima pagină", footer: "", numbers: false } });
  check("prima pagină diferită", first.pages[0]?.includes("Prima pagină") && !first.pages[0]?.includes("Antet de test KGB") && first.pages[1]?.includes("Antet de test KGB"));
  await sleep(1000);
  check("ferestrele ascunse de tipărire s-au închis", (await printWindows()) === 0);
  check("nicio eroare în cadru", (await fr(p, "JSON.stringify(window.__errs ?? [])")) === "[]");
  await p.click("Închide fereastra de documente");

  // Sheets: Page layout = the PDF of the workbook.
  await go(p, "Foi de calcul");
  await p.click("Registru nou în foaia de calcul");
  await frUntil(p, "!!document.querySelector('.sheet-wrap')");
  await p.eval("document.querySelector('.cos-frame iframe').focus()");
  await fr(p, "document.querySelector('.sheet-wrap')?.focus(), true");
  // Typed key by key, as a person types into a cell.
  for (const c of "Total vanzari") {
    const code = c === " " ? "Space" : `Key${c.toUpperCase()}`;
    await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: c, code, windowsVirtualKeyCode: c === " " ? 32 : c.toUpperCase().charCodeAt(0) });
    await p.send("Input.dispatchKeyEvent", { type: "char", key: c, code, text: c });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: c, code, windowsVirtualKeyCode: c === " " ? 32 : c.toUpperCase().charCodeAt(0) });
  }
  await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await sleep(500);
  // Page layout, as a person opens it: View → Page layout. COS lays out its print pages and asks for their PDF.
  await fr(p, "[...document.querySelectorAll('button, [role=tab]')].find(b => b.textContent.trim() === 'Vizualizare')?.click(), true");
  await sleep(400);
  await fr(p, "[...document.querySelectorAll('button')].find(b => (b.title || '').startsWith('Aspect pagină'))?.click(), true");
  await frUntil(p, "/\\d+ pagin/.test(document.querySelector('.sh-layout-count')?.textContent ?? '') || !!document.querySelector('.sh-layout .sheet-err-help')", 40000);
  const count = await fr(p, "document.querySelector('.sh-layout-count')?.textContent ?? ''");
  const err = await fr(p, "document.querySelector('.sh-layout .sheet-err-help')?.textContent ?? ''");
  check("Sheets: Aspect pagină arată paginile foii", /\d+ pagin/.test(count) && !err, count || err);
  await sleep(500);
  check("Sheets: paginile sunt desenate", (await fr(p, "document.querySelectorAll('.sh-layout-pages canvas').length")) >= 1);
  // Writing straight on the page (7.4l-4b): the cells' link areas reach the PDF (printPdf keeps the cell anchors)
  // and are read back with pdf.js 6 (viewportCompat in the frame); a click on A1 opens its box, with its text.
  const cells = await fr(p, "Number(document.querySelector('.sh-layout-pages canvas')?.dataset.cells ?? 0)");
  check("Sheets: Aspect pagină găsește celulele pe pagină", cells >= 1, `${cells} celule`);
  let a1 = "";
  const pos = await fr(p, "(() => { const r = document.querySelector('.sh-layout-pages canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()");
  const frameAt = await p.eval("(() => { const r = document.querySelector('.cos-frame iframe').getBoundingClientRect(); return { x: r.left, y: r.top }; })()");
  for (let i = 1; i <= 40 && !a1; i++) {
    // Down the page's top-left corner, where A1 is, until the box opens on it.
    const x = frameAt.x + pos.x + pos.w * (0.04 + 0.006 * i);
    const y = frameAt.y + pos.y + pos.h * (0.03 + 0.004 * i);
    for (const type of ["mousePressed", "mouseReleased"]) await p.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    await sleep(150);
    a1 = (await fr(p, "document.querySelector('.sh-layout-edit .sh-layout-cellname')?.textContent ?? ''")) ?? "";
  }
  const a1text = await fr(p, "document.querySelector('.sh-layout-edit input')?.value ?? ''");
  check("Sheets: un clic pe pagină deschide caseta celulei, cu textul ei", a1 === "A1" && a1text === "Total vanzari", `${a1 || "(nicio casetă)"} = ${a1text}`);
  await p.screenshot(join(shots, "01-print.png"));

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
