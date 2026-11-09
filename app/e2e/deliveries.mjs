// Etapa 7 step 7.4k-4, end to end in the real window: tracked deliveries.
// A delivery from an approved order goes through every stage; each stage's
// button stays disabled until its fields are filled; the client confirms a
// smaller quantity on one line and the delivery shows "diferențe"; the
// history lists every stage with its fields.
//
// Usage: node app/e2e/deliveries.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node deliveries.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-deliv-"));
const PORT = 9362;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const biz = (p, command, args = {}) => invoke(p, "module_call", { id: "kgb.business", command, args });
const row = "document.querySelector(\".deliveries tr[data-delivery='LIV 1']\")";
const saveDisabled = (p) => p.eval("[...document.querySelectorAll('.delivery-step button')].find(b => b.innerText === 'Salvează').disabled");

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
  const client = await biz(p, "partner_save", { nume: "Client SRL", tip: "client" });
  const order = await biz(p, "order_save", { tip: "vanzare", partener: client.id, data: "2026-11-09", linii: [{ descriere: "Ciment", um: "sac", cantitate: "60", pret_unitar: "40", cota_tva: 21 }] });
  for (const st of ["asteapta", "aprobata"]) await biz(p, "order_move", { id: order.id, stare: st });
  await p.click("Business", "nav .nav");
  await p.click("Livrări", "button");
  await p.until("!!document.querySelector('.delivery-form')", 5000);
  await p.fill(".delivery-form select[aria-label='Comanda livrată']", order.id);
  await p.fill(".delivery-form input[aria-label='Adresa de livrare']", "Str. Șantierului 1, Iași");
  await p.click("Creează livrarea", ".delivery-form button");
  await p.until(`!!${row}`, 5000);
  check("livrarea din comandă e în „pregătire”", (await p.eval(`${row}.innerText`)).includes("pregătire"));

  const steps = [
    ["încărcat", { "Numărul vehiculului": "IS-01-KGB", Șoferul: "Ion Pop" }],
    ["în drum", { "Avizul / documentul de transport": "AV-123" }],
    ["livrat", { "Cine a primit marfa": "Maria Ionescu" }],
  ];
  let gated = true;
  for (const [label, fields] of steps) {
    await p.eval(`[...${row}.querySelectorAll('button')].find(b => b.innerText.includes(${JSON.stringify(label)})).click()`);
    await p.until("!!document.querySelector('.delivery-step')", 3000);
    gated = gated && (await saveDisabled(p));
    for (const [k, v] of Object.entries(fields)) await p.fill(`.delivery-step input[aria-label='${k}']`, v);
    await p.click("Salvează", ".delivery-step button");
    await p.until(`${row}.querySelector('.tag').innerText === ${JSON.stringify(label)}`, 5000);
  }
  check("fiecare etapă cere câmpurile ei (butonul e oprit până sunt completate)", gated);
  await p.eval(`[...${row}.querySelectorAll('button')].find(b => b.innerText.includes('confirmat')).click()`);
  await p.until("!!document.querySelector(\".delivery-step input[aria-label='Confirmat 1']\")", 3000);
  await p.fill(".delivery-step input[aria-label='Confirmat 1']", "58");
  await p.click("Salvează", ".delivery-step button");
  await p.until(`${row}.innerText.includes('confirmat') && ${row}.innerText.includes('diferențe')`, 5000);
  check("clientul confirmă 58 din 60: livrarea arată „diferențe”", true);
  await p.eval(`${row}.querySelector('button.link').click()`);
  await p.until("document.querySelector('.deliveries ul.plain')?.innerText.includes('AV-123')", 3000);
  const hist = await p.eval("document.querySelector('.deliveries ul.plain').innerText");
  check("istoricul are toate etapele și câmpurile", hist.includes("confirmat 58") && hist.includes("IS-01-KGB") && hist.includes("Maria Ionescu"), hist.replace(/\n/g, " | "));
  await p.screenshot(join(shots, "01-livrari.png"));

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
