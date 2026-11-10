// 7.4l-0d + 7.4l-1f, end to end in the real window: a scanned page (a picture of text, a little crooked, on grey
// paper with a shadow, as a phone photographs it) becomes a clean page with „Curăță scanarea” (COS enhance.ts) and
// then a searchable PDF with „Fă PDF-ul căutabil” (COS ocrPdf.ts / textlayer.ts / ocr.ts, the language data in the
// app): the text of the new version is found by the module, the page that already had text stays as it was.
// Nothing goes to the internet.
//
// Usage: node app/e2e/cos-ocr.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const { PDFDocument, StandardFonts } = createRequire(import.meta.url)("pdf-lib");
const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-ocr.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-ocr-"));
const PORT = 9349;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const pdfCall = (p, command, args = {}) => invoke(p, "module_call", { id: "kgb.pdf", command, args });

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);

  // The "scan": text drawn in the page, turned 2°, on grey paper with a darker corner (a phone photo of a sheet).
  const png = await p.eval(`(() => { const c = document.createElement('canvas'); c.width = 1654; c.height = 2339; const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, c.width, c.height); bg.addColorStop(0, '#c9c4b8'); bg.addColorStop(1, '#8f897c');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.translate(150, 180); g.rotate(2 * Math.PI / 180);
    g.fillStyle = '#222'; g.font = '56px Arial';
    ['CONTRACT DE VANZARE', 'Vanzatorul livreaza marfa', 'la sediul cumparatorului', 'pana la data de 30 noiembrie'].forEach((t, i) => g.fillText(t, 0, 120 + i * 110));
    return c.toDataURL('image/png').split(',')[1]; })()`);
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(Buffer.from(png, "base64"));
  doc.addPage([595, 842]).drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  // A second page that already has real text: it must stay exactly as it is.
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText("Anexa 1 - pagina cu text adevarat, care nu se schimba deloc", { x: 50, y: 760, size: 14, font });
  const file = join(data, "scanare.pdf");
  writeFileSync(file, await doc.save());

  await p.click("Catalog module", "nav .nav");
  await p.eval("[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Documente PDF')).querySelector('button').click()");
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Documente PDF'))", 8000);
  await invoke(p, "module_import_file", { id: "kgb.pdf", path: file });
  await p.click("Documente PDF", "nav .nav");
  await p.click("scanare.pdf", ".pdf-docs button");
  await p.until("document.querySelector('.pdf-doc h2')?.textContent === 'scanare.pdf'", 10000);
  const id = (await pdfCall(p, "list")).find((d) => d.name === "scanare.pdf").id;
  const before = await pdfCall(p, "text", { id });
  check("pagina scanată nu are text la început", before[0].trim() === "" && before[1].includes("Anexa 1"), JSON.stringify(before));

  // Open the tools.
  await p.until("[...document.querySelectorAll('.pdf-doc button')].some(b => b.textContent.includes('Pagini pe foaie, mărime…') && !b.disabled)", 10000);
  if (!(await p.eval("!!document.querySelector('.pdf-tools')"))) await p.click("Pagini pe foaie, mărime…", ".pdf-doc button");
  await p.until("!!document.querySelector('.pdf-tools')", 5000);

  // 7.4l-0d: Curăță scanarea, after a preview, a new version.
  await p.click("Curăță scanarea", ".pdf-tools button");
  const cleanPrev = await p.until("!!document.querySelector('.dialog.wide canvas')", 60000).then(() => true, () => false);
  const cleanTitle = cleanPrev ? await p.eval("document.querySelector('.dialog.wide').innerText") : await p.eval("document.body.innerText.slice(0, 300)");
  check("„Curăță scanarea” arată previzualizarea", cleanPrev && /scanare curățată: 1 din 2 pagini, 1 îndreptate/.test(cleanTitle), cleanTitle.slice(0, 200));
  await p.screenshot(join(shots, "01-curatata.png"));
  if (cleanPrev) {
    await p.click("Salvează ca versiune nouă", ".dialog button");
    await p.until("!document.querySelector('.dialog.wide')", 20000);
  }

  // 7.4l-1f: Fă PDF-ul căutabil on the cleaned version.
  await p.until("[...document.querySelectorAll('.pdf-tools button')].some(b => b.textContent === 'Fă PDF-ul căutabil' && !b.disabled)", 15000);
  const t0 = Date.now();
  await p.click("Fă PDF-ul căutabil", ".pdf-tools button");
  const ocrPrev = await p.until("!!document.querySelector('.dialog.wide canvas')", 120000).then(() => true, () => false);
  const ocrTitle = ocrPrev ? await p.eval("document.querySelector('.dialog.wide').innerText") : await p.eval("document.body.innerText.slice(0, 400)");
  check(`„Fă PDF-ul căutabil” recunoaște textul (${Math.round((Date.now() - t0) / 1000)} s, fără internet)`, ocrPrev && /text recunoscut \(OCR\) pe 1 pagină, \d+ cuvinte/.test(ocrTitle), ocrTitle.slice(0, 200));
  if (ocrPrev) {
    await p.click("Salvează ca versiune nouă", ".dialog button");
    await p.until("!document.querySelector('.dialog.wide')", 20000);
  }
  const after = await pdfCall(p, "text", { id });
  const words = ["CONTRACT", "VANZARE", "livreaza", "cumparatorului", "noiembrie"].filter((w) => after[0].toLowerCase().includes(w.toLowerCase()));
  check("textul paginii scanate se găsește acum în PDF (cel puțin 4 din 5 cuvinte)", words.length >= 4, `${words.join(", ")} | ${after[0].slice(0, 120)}`);
  check("pagina cu text adevărat a rămas exact cum era", after[1] === before[1]);
  const info = await pdfCall(p, "list");
  const doc2 = info.find((d) => d.id === id);
  check("două versiuni noi (curățată, apoi căutabilă)", doc2?.current === 3 || doc2?.version === 3 || JSON.stringify(doc2).includes('"current":3'), JSON.stringify(doc2).slice(0, 160));
  await p.screenshot(join(shots, "02-cautabil.png"));
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
