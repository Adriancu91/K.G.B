// Etapa 7 step 7.4k-1, end to end in the real window: offers.
// A new offer with two lines (total computed like an invoice), shown
// "deschisă"; a copy is a new offer; the first is refused with a reason
// (the reason is required); a forced restart keeps everything.
//
// Usage: node app/e2e/offers.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node offers.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-offers-"));
const PORT = 9359;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const biz = (p, command, args = {}) => invoke(p, "module_call", { id: "kgb.business", command, args });
const row = (n) => `document.querySelector(".offers tr[data-offer='${n}']")`;

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  return p;
}
async function openOffers(p) {
  await p.click("Business", "nav .nav");
  await p.click("Oferte", "button");
  await p.until("!!document.querySelector('.offers')", 5000);
}
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Business'))";
  await p.until(`!!${card}`, 5000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Business'))", 5000);
  await biz(p, "settings_save", { firma: { firma_nume: "Noi SRL", firma_cui: "RO18547290" } });
  await biz(p, "partner_save", { nume: "Client Ofertă SRL", tip: "client" });
  await openOffers(p);
  check("la început nu e nicio ofertă", (await p.eval("document.querySelector('.offers').innerText")).includes("Nicio ofertă încă"));

  await p.fill("input[aria-label='Descrierea 1']", "Montaj");
  await p.fill("input[aria-label='Cantitatea 1']", "3");
  await p.fill("input[aria-label='Prețul 1']", "120,50");
  await p.click("+ linie", ".offer-form button");
  await p.fill("input[aria-label='Descrierea 2']", "Transport");
  await p.fill("input[aria-label='Prețul 2']", "200");
  await p.click("Salvează oferta", ".offer-form button");
  await p.until(`!!${row("OF 1")}`, 5000);
  const r1 = await p.eval(`${row("OF 1")}.innerText`);
  check("oferta nouă: total ca la factură (679,42), „deschisă”", r1.includes("679,42") && r1.includes("deschisă"), r1.replace(/\s+/g, " "));

  await p.eval(`[...${row("OF 1")}.querySelectorAll('button')].find(b => b.innerText === 'Copiază').click()`);
  await p.until(`!!${row("OF 2")}`, 5000);
  check("„Copiază” face o ofertă nouă cu aceleași linii", (await p.eval(`${row("OF 2")}.innerText`)).includes("679,42"));

  await p.eval(`[...${row("OF 1")}.querySelectorAll('button')].find(b => b.innerText.startsWith('Respinsă')).click()`);
  await p.until("!!document.querySelector(\"input[aria-label='Motivul']\")", 3000);
  check("fără motiv nu se poate salva", await p.eval("[...document.querySelectorAll('.offers .card button')].find(b => b.innerText === 'Salvează').disabled"));
  await p.fill("input[aria-label='Motivul']", "preț prea mare");
  await p.click("Salvează", ".offers .card button");
  await p.until(`${row("OF 1")}.innerText.includes('respinsă')`, 5000);
  check("oferta respinsă, cu motivul afișat", (await p.eval(`${row("OF 1")}.innerText`)).includes("preț prea mare"));
  await p.screenshot(join(shots, "01-oferte.png"));

  stop(p);
  p = await start();
  await openOffers(p);
  await p.until(`!!${row("OF 2")}`, 5000);
  check("după repornire (forțată) ofertele și stările rămân", (await p.eval(`${row("OF 1")}.innerText`)).includes("respinsă"));
  stop(p);
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
