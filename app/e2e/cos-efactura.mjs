// 7.4m-1, end to end in the real window: e-Factura and the Romanian codes in the spreadsheet window copied
// from Cyber Office Studio (D-077, D-078), as they already are in K.G.B.
// - „Import e-Factura (XML)”: an invoice written by the COS code (efactura-fixture.mjs) becomes the Factură sheet;
// - „Export e-Factura (XML)”: the file written through the core (export_file) is read back by K.G.B.'s own
//   reader (kgb.business, efactura.rs) with the same total, to the ban;
// - „Factură PDF”: a PDF;
// - =VALIDCUI / =VALIDIBAN / =VALIDCNP say TRUE / FALSE.
// Nothing is sent anywhere. The system's open / save dialogs are replaced in the page (window.kgbHost.open /
// save), the single point the frame uses; the file still goes through the core. The CNPs are made up (a correct
// check digit, no person) and no screenshot is taken after they are typed.
//
// Usage: node app/e2e/cos-efactura.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-efactura.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-efactura-"));
const files = mkdtempSync(join(tmpdir(), "kgb-cos-efactura-files-"));
const PORT = 9345;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// The invoice, written by the COS code.
const app = resolve(import.meta.dirname, "..");
const inXml = join(files, "Factura ABC 0042 primita.xml");
writeFileSync(
  inXml,
  execFileSync(process.execPath, ["--import", "./cos/hooks.mjs", "e2e/efactura-fixture.mjs"], { cwd: app, encoding: "utf8" }),
);
const outXml = join(files, "export.xml");
const outPdf = join(files, "factura.pdf");

/** A made-up CNP with a correct check digit (the rule of cos/src/sheets/ids.ts). */
const cnpOf = (body12) => {
  const key = "279146358279";
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(body12[i]) * Number(key[i]);
  return body12 + (s % 11 === 10 ? 1 : s % 11);
};
const goodCnp = cnpOf("190010112345");
const badCnp = goodCnp.slice(0, 12) + ((Number(goodCnp[12]) + 1) % 10);

const go = (p, label) => p.click(label, "nav .nav");
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
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
const until = async (f, timeout = 15000) => {
  const end = Date.now() + timeout;
  for (;;) {
    if (await f()) return true;
    if (Date.now() > end) return false;
    await sleep(200);
  }
};
async function key(p, k, code, vk, text) {
  await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk });
  if (text) await p.send("Input.dispatchKeyEvent", { type: "char", key: k, code, windowsVirtualKeyCode: vk, text });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
  await sleep(150);
}
const enter = (p) => key(p, "Enter", "Enter", 13);
const focusGrid = async (p) => {
  await p.eval("document.querySelector('.cos-frame iframe').focus()");
  await fr(p, "document.querySelector('.sheet-wrap')?.focus(), true");
  await sleep(200);
};
/** Clicks a button of the window by its text; if it is in the File tab, opens that first. */
async function button(p, label) {
  const click = `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled); if (!b) return false; b.click(); return true; })()`;
  if (await fr(p, click)) return true;
  await fr(p, `(() => { const t = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Fișier'); t?.click(); return !!t; })()`);
  await sleep(400);
  return frUntil(p, click, 5000).catch(() => false);
}
/** Writes `text` in the cell `ref` (through the name box), as a person would. */
async function writeCell(p, ref, text) {
  await focusGrid(p);
  await fr(p, "(() => { const n = document.querySelector('input.cell-name'); n.focus(); n.select(); return true; })()");
  await p.send("Input.insertText", { text: ref });
  await enter(p);
  await key(p, "=", "Equal", 187, "=");
  await p.send("Input.insertText", { text: text.slice(1) });
  await enter(p);
}
const shown = (p, r, c) =>
  fr(p, `document.querySelector('tr[data-r="${r}"]')?.querySelectorAll('td')[${c}]?.innerText.trim() ?? null`);
const isTrue = (v) => /^(ADEVĂRAT|TRUE)$/i.test(v ?? "");
const isFalse = (v) => /^(FALS|FALSE)$/i.test(v ?? "");

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  for (const name of ["Foi de calcul", "Business"]) {
    await go(p, "Catalog module");
    const card = `[...document.querySelectorAll('.card')].find(c => c.innerText.includes(${JSON.stringify(name)}))`;
    await p.eval(`${card}.querySelector('button').click()`);
    await sleep(300);
    await p.click("Acordă și activează");
    await p.until(`[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes(${JSON.stringify(name)}))`, 8000);
  }
  await go(p, "Foi de calcul");
  // The system dialogs, replaced in the page: the frame asks only window.kgbHost.
  await p.eval(`(() => { const h = window.kgbHost; h.open = async () => ${JSON.stringify(inXml)}; h.save = async (o) => (o.filters?.[0]?.extensions ?? []).includes('pdf') ? ${JSON.stringify(outPdf)} : ${JSON.stringify(outXml)}; return true; })()`);
  await p.click("Registru nou în foaia de calcul");
  await p.until("!!document.querySelector('.cos-frame iframe')", 5000);
  await frUntil(p, "!!document.querySelector('.sheet-wrap')", 30000);
  await fr(p, "(window.__errs = [], window.addEventListener('error', (e) => window.__errs.push(String(e.message))), window.addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason))), true)");

  // Import: the Factură sheet with the invoice's lines and parties.
  check("butonul „Import e-Factura (XML)” e în fereastră", await button(p, "Import e-Factura (XML)"));
  const imported = await frUntil(
    p,
    "(t => t.includes('Laptop') && t.includes('Client & Fiii SA') && t.includes('Montaj') ? t : false)(document.querySelector('.sheet-wrap')?.innerText ?? '')",
    15000,
  ).catch(() => false);
  check("factura primită devine foaia Factură (linii, client)", !!imported);
  await p.screenshot(join(shots, "01-factura-importata.png"));

  // Export XML: written through the core, read back by K.G.B.'s reader with the same total.
  check("butonul „Export e-Factura (XML)” apare pe foaia Factură", await button(p, "Export e-Factura (XML)"));
  const wrote = await until(() => existsSync(outXml), 15000);
  check("e-Factura se scrie prin nucleu în fișierul ales", wrote);
  const xml = wrote ? readFileSync(outXml, "utf8") : "";
  check(
    "XML-ul are totalul facturii (8113.30 RON) și furnizorul",
    /<cbc:PayableAmount currencyID="RON">8113\.30</.test(xml) && xml.includes("Firma Noastră SRL"),
    xml.match(/<cbc:PayableAmount[^<]*/)?.[0] ?? "lipsă",
  );
  if (wrote) {
    const ef = await invoke(p, "module_import_file_with", { id: "kgb.business", path: outXml, command: "efactura_import", args: {} });
    check(
      "cititorul K.G.B. (efactura.rs) citește exportul cu același total",
      ef?.[0]?.ok === true && String(ef[0].total_text).replace(/\./g, "") === "8113,30",
      JSON.stringify(ef),
    );
  }

  // Factură PDF.
  check("butonul „Factură PDF” e în fereastră", await button(p, "Factură PDF"));
  const pdf = await until(() => existsSync(outPdf), 20000);
  check("factura PDF se scrie", pdf && readFileSync(outPdf).subarray(0, 5).toString("latin1") === "%PDF-");
  await p.screenshot(join(shots, "02-exportate.png"));

  // The Romanian codes (no screenshot after this point: the CNPs are on the sheet).
  const cuiOk = (xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:CompanyID>(?:RO)?(\d+)</) ?? [])[1] ?? "18547290";
  const formulas = [
    ["K60", `=VALIDCUI("RO${cuiOk}")`, true],
    ["K61", `=VALIDCUI("${cuiOk.slice(0, -1)}${(Number(cuiOk.at(-1)) + 1) % 10}")`, false],
    ["K62", '=VALIDIBAN("RO49 AAAA 1B31 0075 9384 0000")', true],
    ["K63", '=VALIDIBAN("RO49AAAA1B31007593840001")', false],
    ["K64", `=VALIDCNP("${goodCnp}")`, true],
    ["K65", `=VALIDCNP("${badCnp}")`, false],
  ];
  for (const [ref, f] of formulas) await writeCell(p, ref, f);
  const got = [];
  for (let i = 0; i < formulas.length; i++) got.push(await shown(p, 59 + i, 10));
  const names = ["CUI bun", "CUI greșit", "IBAN bun", "IBAN greșit", "CNP bun", "CNP greșit"];
  formulas.forEach(([, , want], i) => check(`=VALID… ${names[i]} → ${want ? "ADEVĂRAT" : "FALS"}`, want ? isTrue(got[i]) : isFalse(got[i]), String(got[i])));

  check("nicio eroare în fereastră", (await fr(p, "JSON.stringify(window.__errs ?? [])")) === "[]", await fr(p, "JSON.stringify(window.__errs ?? [])"));

  // D-083: 'self' in connect-src reads the app's own files, but the network stays closed.
  const net = await p.eval('fetch("https://example.com").then(() => "deschis", (e) => "refuzat: " + e.message)');
  check("rețeaua rămâne închisă (fetch https://example.com refuzat)", net.startsWith("refuzat"), net);
  const own = await p.eval(
    "(() => { const s = document.querySelector('script[src]')?.getAttribute('src'); return s ? fetch(s).then((r) => r.ok ? 'citit ' + s : 'stare ' + r.status, (e) => 'refuzat: ' + e.message) : 'fără script'; })()",
  );
  check("un fișier din aplicație se citește (connect-src 'self')", own.startsWith("citit"), own);
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
  rmSync(files, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
