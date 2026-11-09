// Etapa 7 step 7.4k-2, end to end in the real window: orders with approval.
// A sales order is saved as draft, sent for approval, rejected with a reason
// (required), sent again, approved, delivered, done; its history shows every
// step; an order made from an accepted offer takes its lines and total.
//
// Usage: node app/e2e/orders.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node orders.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-orders-"));
const PORT = 9360;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const biz = (p, command, args = {}) => invoke(p, "module_call", { id: "kgb.business", command, args });
const row = (n) => `document.querySelector(".orders tr[data-order='${n}']")`;
const press = (p, n, label) => p.eval(`[...${row(n)}.querySelectorAll('button')].find(b => b.innerText.startsWith(${JSON.stringify(label)})).click()`);
const state = (p, n) => p.eval(`${row(n)}.querySelector('.tag').innerText`);
const iso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

try {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Business'))";
  await p.until(`!!${card}`, 5000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Business'))", 5000);
  await biz(p, "settings_save", { firma: { firma_nume: "Noi SRL", firma_cui: "RO18547290" } });
  const client = await biz(p, "partner_save", { nume: "Client Comandă SRL", tip: "client" });
  await p.click("Business", "nav .nav");
  await p.click("Comenzi", "button");
  await p.until("!!document.querySelector('.orders')", 5000);

  await p.fill("input[aria-label='Descrierea 1']", "Ciment");
  await p.fill("input[aria-label='Cantitatea 1']", "12");
  await p.fill("input[aria-label='Prețul 1']", "32,50");
  await p.click("Salvează ca ciornă", ".order-form button");
  await p.until(`!!${row("CMD 1")}`, 5000);
  check("comanda nouă e ciornă, cu totalul calculat (471,90)", (await state(p, "CMD 1")) === "ciornă" && (await p.eval(`${row("CMD 1")}.innerText`)).includes("471,90"));

  await press(p, "CMD 1", "Trimite la aprobare");
  await p.until(`${row("CMD 1")}.innerText.includes('așteaptă aprobare')`, 5000);
  await press(p, "CMD 1", "Respinge");
  await p.until("!!document.querySelector(\".orders input[aria-label='Motivul']\")", 3000);
  check("respingerea cere motiv", await p.eval("[...document.querySelectorAll('.orders .card button')].find(b => b.innerText === 'Salvează').disabled"));
  await p.fill(".orders input[aria-label='Motivul']", "preț de verificat");
  await p.click("Salvează", ".orders .card button");
  await p.until(`${row("CMD 1")}.innerText.includes('ciornă')`, 5000);
  for (const [b, st] of [["Trimite la aprobare", "așteaptă aprobare"], ["Aprobă", "aprobată"], ["Pornește livrarea", "în livrare"], ["Gata", "gata"]]) {
    await press(p, "CMD 1", b);
    await p.until(`${row("CMD 1")}.querySelector('.tag').innerText === ${JSON.stringify(st)}`, 5000);
  }
  check("aprobată → în livrare → gata; fără butoane după „gata”", (await p.eval(`${row("CMD 1")}.querySelectorAll('td:last-child button').length`)) === 0);
  await p.eval(`${row("CMD 1")}.querySelector('td button.link').click()`);
  await p.until("document.querySelector('.orders ul.plain')?.innerText.includes('preț de verificat')", 3000);
  const hist = await p.eval("document.querySelector('.orders ul.plain').innerText");
  check("istoricul arată toți pașii și motivul", hist.split("\n").length === 7 && hist.includes("așteaptă aprobare → ciornă (preț de verificat)"), hist.replace(/\n/g, " | "));
  await p.screenshot(join(shots, "01-comenzi.png"));

  // From an accepted offer: its lines and total.
  const of = await biz(p, "offer_save", { partener: client.id, data: iso(), valabil_pana: iso(), linii: [{ descriere: "Montaj", cantitate: "3", pret_unitar: "120,50", cota_tva: 21 }] });
  await biz(p, "offer_close", { id: of.id, stare: "acceptata", azi: iso() });
  await p.click("Oferte", "button");
  await p.click("Comenzi", "button");
  await p.until("!!document.querySelector(\".orders select[aria-label='Oferta']\")", 5000);
  await p.fill(".orders select[aria-label='Oferta']", of.id);
  await p.click("Salvează ca ciornă", ".order-form button");
  await p.until(`!!${row("CMD 2")}`, 5000);
  check("comanda din ofertă ia liniile și totalul ofertei (437,42)", (await p.eval(`${row("CMD 2")}.innerText`)).includes("437,42"));

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
