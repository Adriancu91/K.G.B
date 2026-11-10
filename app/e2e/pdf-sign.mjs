// 7.4l-0c, end to end in the real window: the digital signature of a PDF with COS's "Semnează digital" window.
// (1) A certificate "of this computer": a test certificate made here with openssl and handed to the app through
// KGB_TEST_WINCERT (loaded only in memory, nothing written to Windows; the real path asks Windows / the token for
// the PIN). The place is drawn on the page; the signed PDF is previewed, saved as a new version and its signature
// checks as valid. (2) A digital ID made in the window, with a password: a second visible signature, both valid.
// The original version stays unsigned.
//
// Usage: node app/e2e/pdf-sign.mjs <path-to-kgb-app.exe> <screenshot-dir>   (needs openssl on the PATH)
// Uses a throw-away data folder (KGB_DATA_DIR) and a PDF made here; never the user's real data. The window's own
// storage is shared with the K.G.B. installed on this computer: the keys the signing window uses are put back as
// they were at the end.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node pdf-sign.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-pdfsign-"));
const PORT = 9349;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// The test certificate (RSA 2048, self-signed, 30 days) in a .pfx that Windows' .NET reads.
const ssl = (...a) => execFileSync("openssl", a, { cwd: data, stdio: "ignore" });
ssl("req", "-x509", "-newkey", "rsa:2048", "-keyout", "k.pem", "-out", "c.pem", "-days", "30", "-nodes", "-subj", "/CN=Test Semnatar KGB/O=Firma de Test");
ssl("pkcs12", "-export", "-out", "t.pfx", "-inkey", "k.pem", "-in", "c.pem", "-passout", "pass:test-1234", "-certpbe", "PBE-SHA1-3DES", "-keypbe", "PBE-SHA1-3DES", "-macalg", "sha1");
const pfx = join(data, "t.pfx");

// The test PDF: two pages of text.
const app = resolve(import.meta.dirname, "..");
const req = createRequire(join(app, "package.json"));
const { PDFDocument } = await import(pathToFileURL(req.resolve("pdf-lib")).href);
const fontkit = (await import(pathToFileURL(req.resolve("@pdf-lib/fontkit")).href)).default;
const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const f = await doc.embedFont(readFileSync(join(app, "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf")), { subset: true });
doc.addPage([595, 842]).drawText("Contract de prestări servicii nr. 7 — de semnat.", { x: 72, y: 760, size: 14, font: f });
doc.addPage([595, 842]).drawText("Anexa 1.", { x: 72, y: 760, size: 14, font: f });
const pdfPath = join(data, "contract-semnat.pdf");
writeFileSync(pdfPath, await doc.save());

const KEYS = ["suite.pdf.winCert", "suite.pdf.digitalId", "suite.pdf.sigReason", "suite.pdf.sigPlace", "suite.pdf.tsaOn", "suite.pdf.tsaUrl", "suite.pdf.profil"];
let saved = null;
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const call = (p, command, args) => invoke(p, "module_call", { id: "kgb.pdf", command, args });

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_TEST_WINCERT: `${pfx}|test-1234`, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  saved = await p.eval(`(() => { const o = {}; for (const k of ${JSON.stringify(KEYS)}) o[k] = localStorage.getItem(k); return o; })()`);
  await p.eval(`(() => { for (const k of ${JSON.stringify(KEYS)}) localStorage.removeItem(k); return true; })()`);

  const mouse = (type, x, y, extra = {}) => p.send("Input.dispatchMouseEvent", { type, x, y, button: "left", ...extra });
  const dragBy = async (x, y, dx, dy) => {
    await mouse("mouseMoved", x, y, { button: "none" });
    await mouse("mousePressed", x, y, { clickCount: 1, buttons: 1 });
    for (let i = 1; i <= 6; i++) await mouse("mouseMoved", x + (dx * i) / 6, y + (dy * i) / 6, { buttons: 1 });
    await mouse("mouseReleased", x + dx, y + dy, { clickCount: 1 });
    await sleep(300);
  };
  const box = () =>
    p.eval(`(() => { const e = document.querySelector('.pdf-big .pdf-page-box'); e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
  const dlg = "[role=dialog][aria-label='Semnează digital']";
  const clickIn = (sel, text) =>
    p.eval(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.includes(${JSON.stringify(text)}) && !e.disabled); if (!b) return false; b.click(); return true; })()`);
  const saveVersion = async () => {
    await p.until("!!document.querySelector('.dialog.wide canvas')", 30000);
    const title = await p.eval("document.querySelector('.dialog.wide').innerText");
    await p.click("Salvează ca versiune nouă", ".dialog button");
    await p.until("!document.querySelector('.dialog.wide')", 15000);
    return title;
  };
  const sigLine = () => p.until("document.querySelector('[data-testid=pdf-sigs]')?.innerText", 15000);
  const drawPlace = async (fx, fy) => {
    await p.until("(document.querySelector('.pdf-doc')?.innerText ?? '').includes('Trage pe pagină dreptunghiul')", 10000);
    await p.until("!!document.querySelector('.pdf-big .pdf-mark-catch')", 10000);
    await sleep(500);
    const b = await box();
    await dragBy(b[0] + b[2] * fx, b[1] + b[3] * fy, 200, 70);
  };

  // The PDF module and the test document.
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
  await p.click("contract-semnat.pdf", ".pdf-docs button");
  await p.until("!!document.querySelector('.pdf-pages .thumb')", 10000);
  check("un PDF fără semnături nu arată nicio semnătură", !(await p.eval("!!document.querySelector('[data-testid=pdf-sigs]')")));

  // (1) The certificate of this computer (the test .pfx in place of the store).
  await p.click("Semnează digital…", ".pdf-doc button");
  await p.until(`!!document.querySelector("${dlg}")`, 10000);
  await clickIn(`${dlg} button.link`, "Folosește un certificat de pe calculator sau token");
  await p.until(`[...document.querySelectorAll("${dlg} select[aria-label='Certificatul de pe calculator'] option")].some(o => o.textContent.includes('Test Semnatar KGB'))`, 60000);
  check("lista certificatelor de pe calculator are certificatul (din .NET, prin nucleu)", true);
  await clickIn(`${dlg} button`, "Folosește certificatul");
  await p.until(`!!document.querySelector("${dlg} input[aria-label='Motivul']")`, 10000);
  await p.fill(`${dlg} input[aria-label='Motivul']`, "Sunt de acord");
  await p.fill(`${dlg} input[aria-label='Locul']`, "Cluj-Napoca");
  await clickIn(`${dlg} button.primary`, "Alege locul pe pagină");
  await drawPlace(0.5, 0.7);
  const t1 = await saveVersion();
  check("semnarea trece prin previzualizare, textul paginilor păstrat", t1.includes("Semnătura digitală") && t1.includes("s-au păstrat"), t1.slice(0, 140));
  const s1 = await sigLine();
  check("versiunea nouă e semnată de certificat, semnătura valabilă", s1.includes("Test Semnatar KGB") && s1.includes("valabilă") && !s1.includes("din"), s1);
  await p.screenshot(join(shots, "01-semnat-certificat.png"));

  // (2) A digital ID made in the window (password-protected key, on this PC), a second visible signature.
  await p.click("Semnează digital…", ".pdf-doc button");
  await p.until(`!!document.querySelector("${dlg}")`, 10000);
  await clickIn(`${dlg} button.link`, "Nu mai folosi certificatul de pe calculator");
  await p.until(`!!document.querySelector("${dlg} input[aria-label='Numele']")`, 10000);
  await p.fill(`${dlg} input[aria-label='Numele']`, "Ion Test");
  await p.fill(`${dlg} input[aria-label='Parola ID-ului']`, "parola-de-test-1");
  await p.fill(`${dlg} input[aria-label='Parola din nou']`, "parola-de-test-1");
  await clickIn(`${dlg} button.primary`, "Creează ID-ul digital");
  await p.until(`!!document.querySelector("${dlg} input[aria-label='Parola ID-ului']") && !document.querySelector("${dlg} input[aria-label='Parola din nou']")`, 30000);
  await p.fill(`${dlg} input[aria-label='Parola ID-ului']`, "parola-de-test-1");
  await clickIn(`${dlg} button.primary`, "Alege locul pe pagină");
  await drawPlace(0.15, 0.85);
  await saveVersion();
  await p.until("(document.querySelector('[data-testid=pdf-sigs]')?.innerText ?? '').includes('2 semnături')", 15000);
  const s2 = await sigLine();
  check("a doua semnătură (ID digital făcut aici): ambele valabile", s2.includes("2 semnături") && s2.includes("Ion Test") && s2.includes("valabile") && !s2.includes("din"), s2);
  await p.screenshot(join(shots, "02-doua-semnaturi.png"));

  // Versions: the original unsigned, the text of the pages unchanged.
  const docs = await call(p, "list", {});
  check("două semnări = două versiuni noi", docs[0].current === 3, `versiunea ${docs[0].current}`);
  const orig = await call(p, "read", { id: docs[0].id, version: 1 });
  check("originalul (versiunea 1) nu are semnătură", !atob(orig.data).includes("/ByteRange"));
  const now = await call(p, "text", { id: docs[0].id, version: null });
  check("textul paginilor e același", now[0].includes("Contract de prestări servicii nr. 7") && now[1].includes("Anexa 1."), now[0].slice(0, 60));
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
} finally {
  if (saved && page) {
    await page
      .eval(`(() => { const o = ${JSON.stringify(saved)}; for (const [k, v] of Object.entries(o)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } return true; })()`)
      .catch(() => {});
  }
  page?.close();
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
