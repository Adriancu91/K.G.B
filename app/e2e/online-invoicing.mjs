// 7.10c (D-089), end to end in the real window: invoices read from the online invoicing program, read only. The
// program is a small server of this test on 127.0.0.1 answering like its API (the app is started with
// KGB_TEST_INVOICING_BASE, a test-only switch read from the environment). The key is typed once and is not on the
// disk in clear; without the program approved in „Surse externe” nothing is asked; approved, the series TST is read
// from 1 without an end: 1, 2 and 4 exist (3 was deleted), and the reading stops after 5 missing numbers in a row;
// every request is a reading one with the right signature; the PDFs go into the vault.
//
// Usage: node app/e2e/online-invoicing.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data or a real account.
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node online-invoicing.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-online-"));
const PORT = 9374;
const CUI = "14399840";
const KEY = "CHEIE-DE-TEST-7Q9Z";
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const call = (p, cmd, args = {}) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);

/** A small real PDF with one line of text. */
function pdf(text) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 12 Tf 72 760 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const at = [];
  objs.forEach((o, i) => {
    at.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((a) => `${String(a).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// The program: invoices TST 1, 2 and 4.
const invoices = { 1: [121000, 121000], 2: [59500, 0], 4: [30000, 10000] };
const asked = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const path = req.url ?? "";
    let j = {};
    try {
      j = body ? JSON.parse(body) : {};
    } catch {
      /* not JSON */
    }
    asked.push({ method: req.method, path, hashOk: j.Hash ? j.Hash === createHash("sha1").update(`${j.CodUnic}${KEY}${j.Numar}`).digest("hex").toUpperCase() : null, codUnic: j.CodUnic });
    const send = (code, v) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(v));
    };
    const n = Number(j.Numar);
    if (req.method === "POST" && (path === "/v1/factura/getstatus" || path === "/v1/factura/print")) {
      if (asked.at(-1).hashOk !== true) return send(200, { Success: false, Message: "Hash invalid" });
      if (!invoices[n] || j.Serie !== "TST") return send(200, { Success: false, Message: "Factura nu exista" });
      if (path.endsWith("getstatus")) return send(200, { Success: true, Message: "", Factura: { Numar: String(n), Serie: "TST", Valoare: invoices[n][0] / 100, ValoareAchitata: invoices[n][1] / 100 } });
      return send(200, { Success: true, Message: "", Factura: { Numar: String(n), Serie: "TST", Link: `http://127.0.0.1:${PORT + 1}/pdf/TST${n}.pdf` } });
    }
    const m = /^\/pdf\/TST(\d+)\.pdf$/.exec(path);
    if (req.method === "GET" && m && invoices[Number(m[1])]) {
      res.writeHead(200, { "Content-Type": "application/pdf" });
      return res.end(pdf(`Factura seria TST nr. ${m[1]} Total de plata ${(invoices[Number(m[1])][0] / 100).toFixed(2)} lei`));
    }
    send(404, { Success: false, Message: "nu exista" });
  });
});
await new Promise((ok) => server.listen(PORT + 1, "127.0.0.1", ok));

try {
  proc = spawn(exe, [], {
    env: {
      ...process.env,
      KGB_DATA_DIR: data,
      KGB_NO_DESKTOP_NOTIFY: "1",
      KGB_TEST_INVOICING_BASE: `http://127.0.0.1:${PORT + 1}`,
      KGB_TEST_NET_LOOPBACK: "1",
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
    },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Depozitul de documente')";
  await p.until(`!!${card}`, 8000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Depozitul de documente'))", 8000);
  const st = await call(p, "get_settings");
  await call(p, "save_settings", { settings: { ...st.settings, internet: true }, version: st.version });
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Depozitul de documente')).click()");
  await p.until("!!document.querySelector('.vault')", 8000);

  // The key, typed once.
  await p.click("Din programul de facturare online…", ".vault button");
  await p.until("!!document.querySelector('form[aria-label=\"Cheia programului\"]')", 8000);
  const setv = (sel, v) => p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
  await setv("[aria-label='CUI-ul firmei din program']", `RO${CUI}`);
  await setv("[aria-label='Cheia API']", KEY);
  await setv("[aria-label='Mediul']", "test");
  await p.screenshot(join(shots, "01-cheia.png"));
  await p.click("Păstrează cheia pe acest calculator", ".online-invoicing button");
  await p.until("(document.querySelector('.online-invoicing')?.innerText ?? '').includes('Cheie pusă pentru CUI')", 8000);
  const keyFile = join(data, "facturare-online.json");
  const onDisk = existsSync(keyFile) ? readFileSync(keyFile, "utf8") : "";
  check("cheia e pe acest calculator, dar nu în clar", onDisk.includes(CUI) && !onDisk.includes(KEY), onDisk ? `${onDisk.length} octeți` : "fișierul lipsește");

  // Not approved in „Surse externe”: nothing is asked.
  await setv("[aria-label='Seria']", "TST");
  await p.click("Citește facturile", ".online-invoicing button");
  await p.until("(document.querySelector('.online-invoicing .error')?.innerText ?? '').includes('Surse externe')", 8000);
  check("fără sursa aprobată, nu pleacă nicio cerere", asked.length === 0, `${asked.length} cereri`);

  // Approved: read from 1 without an end.
  const id = await call(p, "source_save", { source: { nume: "Program de facturare online", url: "https://api.fgo.ro", tip: "api", termeni: "termenii programului, citiți de proprietar", licenta: "contractul cu programul", verificat: "2026-11-12" } });
  await call(p, "source_set_active", { id, active: true });
  await p.click("Citește facturile", ".online-invoicing button");
  await p.until("(document.querySelector('.online-invoicing')?.innerText ?? '').includes('facturi găsite')", 60000);
  const text = await p.eval("document.querySelector('.online-invoicing').innerText");
  check(
    "găsite TST 1, 2 și 4 (3 lipsește), cu valoarea și cât s-a plătit; oprit după 5 numere lipsă la rând",
    /3 facturi găsite/.test(text) && text.includes("TST 1") && text.includes("TST 2") && text.includes("TST 4") && !/TST 3\b/.test(text) && text.includes("1.210,00 lei") && text.includes("5 numere la rând nu există"),
    text.replace(/\s+/g, " ").slice(0, 260),
  );
  const posts = asked.filter((a) => a.method === "POST");
  check(
    "doar cereri de citire (getstatus, print), fiecare cu semnătura corectă și CUI-ul fără RO",
    posts.length > 0 && posts.every((a) => (a.path === "/v1/factura/getstatus" || a.path === "/v1/factura/print") && a.hashOk === true && a.codUnic === CUI),
    JSON.stringify([...new Set(asked.map((a) => `${a.method} ${a.path.replace(/\d+/g, "N")}`))]),
  );
  check("numerele cerute: 1…9 la getstatus, print doar la cele găsite", posts.filter((a) => a.path.endsWith("getstatus")).length === 9 && posts.filter((a) => a.path.endsWith("print")).length === 3);
  await p.screenshot(join(shots, "02-citite.png"));

  // Into the vault.
  await p.click("Pune PDF-urile în depozit", ".online-invoicing button");
  await p.until("(document.querySelector('.vault')?.innerText ?? '').includes('3 documente noi')", 15000);
  const docs = await call(p, "module_call", { id: "kgb.vault", command: "lista", args: {} });
  check("cele 3 PDF-uri sunt în depozit", docs.length === 3 && ["TST 1.pdf", "TST 2.pdf", "TST 4.pdf"].every((n) => docs.some((d) => d.nume === n)), JSON.stringify(docs.map((d) => d.nume)));
  await p.screenshot(join(shots, "03-in-depozit.png"));
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
  server.close();
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
