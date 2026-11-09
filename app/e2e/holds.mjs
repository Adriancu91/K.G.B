// Etapa 7 step 7.4k-3, end to end in the real window: reserved and blocked
// stock. 100 bags received; 60 reserved for an order, 30 blocked with a
// reason (required); the stock table shows reserved / blocked / free; an
// issue of more than the free 10 is refused; the order going into delivery
// ends its reservation.
//
// Usage: node app/e2e/holds.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node holds.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-holds-"));
const PORT = 9361;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const biz = (p, command, args = {}) => invoke(p, "module_call", { id: "kgb.business", command, args });
const stockRow = (p) => p.eval("[...document.querySelector('.stock-table tbody tr').cells].map(c => c.innerText.trim()).join('|')");

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
  const prod = await biz(p, "product_save", { cod: "CIM", nume: "Ciment", um: "sac" });
  const wh = await biz(p, "warehouse_save", { nume: "Central" });
  await biz(p, "receive", { depozit: wh.id, numar: "NIR 1", data: "01.11.2026", partener: "F SRL", linii: [{ produs: prod.id, cantitate: "100", pret_unitar: "30" }] });
  const client = await biz(p, "partner_save", { nume: "Client SRL", tip: "client" });
  const order = await biz(p, "order_save", { tip: "vanzare", partener: client.id, data: "2026-11-09", linii: [{ descriere: "Ciment", cantitate: "60", pret_unitar: "40", cota_tva: 21 }] });
  await p.click("Business", "nav .nav");
  await p.until("!!document.querySelector('.holds form')", 8000);

  await p.fill(".holds input[aria-label='Cantitatea rezervată']", "60");
  await p.click("Rezervă", ".holds form button");
  await p.until("document.querySelector('.hold-list')?.innerText.includes('pentru CMD 1')", 5000);
  await p.fill(".holds select[aria-label='Tipul']", "blocare");
  await p.fill(".holds input[aria-label='Cantitatea rezervată']", "30");
  check("blocarea cere motiv", await p.eval("[...document.querySelectorAll('.holds form button')].find(b => b.innerText === 'Blochează').disabled"));
  await p.fill(".holds input[aria-label='Motivul blocării']", "saci deteriorați");
  await p.click("Blochează", ".holds form button");
  await p.until("document.querySelector('.hold-list').innerText.includes('saci deteriorați')", 5000);
  await p.until("document.querySelector('.stock-table tbody tr').innerText.includes('60')", 5000);
  const row = await stockRow(p);
  check("tabelul de stoc arată rezervat 60, blocat 30, liber 10", row.startsWith("CIM|Ciment|Central|100|60|30|10|"), row);
  await p.screenshot(join(shots, "01-rezervari.png"));

  const e = await p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.business", command: "issue", args: { depozit: wh.id, numar: "BC", data: "02.11.2026", linii: [{ produs: prod.id, cantitate: "11" }] } })}).then(() => "trecut", (x) => String(x))`);
  check("o ieșire peste cele 10 libere e refuzată", e.includes("libere 10"), e);

  for (const st of ["asteapta", "aprobata", "livrare"]) await biz(p, "order_move", { id: order.id, stare: st });
  await p.click("Acasă", "nav .nav");
  await p.click("Business", "nav .nav");
  await p.until("document.querySelector('.stock-table tbody tr').cells[6].innerText.trim() === '70'", 5000);
  check("comanda intrată în livrare își eliberează rezervarea (liber 70)", true);

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
