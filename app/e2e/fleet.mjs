// Etapa 7 step 7.4k-6, end to end in the real window: fleet and drivers.
// A vehicle and a driver are added with their documents; what expires in
// the next 30 days is listed at the top (soonest first); the reminders
// arrive in the notification centre, once; renewing a document takes it off.
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
  console.error("usage: node fleet.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-fleet-"));
const PORT = 9366;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const biz = (p, command, args = {}) => invoke(p, "module_call", { id: "kgb.business", command, args });
const plus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
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
  await p.click("Business", "nav .nav");
  await p.click("Parc auto", "button");
  await p.until("!!document.querySelector('.fleet-new-vehicle')", 5000);
  check("parcul gol: nimic nu expiră", (await p.eval("document.querySelector('.fleet').innerText")).includes("Nimic nu expiră"));

  // A vehicle: ITP in 7 days, RCA in 200 days.
  await p.fill(".fleet-new-vehicle input[aria-label='Numărul de înmatriculare']", "is 01 abc");
  await p.fill(".fleet-new-vehicle input[aria-label='Marca']", "Iveco");
  await p.fill("input[aria-label='Expirarea actului 1 (vehicul nou)']", plus(7));
  await p.fill("input[aria-label='Expirarea actului 2 (vehicul nou)']", plus(200));
  await p.click("Adaugă vehiculul", ".fleet-new-vehicle button");
  await p.until("!!document.querySelector(\".fleet [data-vehicle='IS 01 ABC']\")", 5000);
  check("vehiculul e adăugat, cu numărul scris corect", true);
  // A driver: licence expires today.
  await p.fill(".fleet-new-driver input[aria-label='Numele șoferului']", "Vasile Pop");
  await p.fill(".fleet-new-driver input[aria-label='Categoriile permisului']", "B, C, CE");
  await p.fill("input[aria-label='Expirarea actului 1 (șofer nou)']", plus(0));
  await p.click("Adaugă șoferul", ".fleet-new-driver button");
  await p.until("!!document.querySelector(\".fleet [data-driver='Vasile Pop']\")", 5000);
  await p.until("document.querySelectorAll('.fleet-soon tbody tr').length === 2", 5000);
  const soon = await p.eval("[...document.querySelectorAll('.fleet-soon tbody tr')].map(r => r.innerText.replace(/\\s+/g, ' ')).join(' | ')");
  check("sus: ce expiră în 30 de zile, cel mai apropiat întâi (RCA-ul de peste 200 de zile nu)", soon.startsWith("șofer Vasile Pop Permis de conducere") && soon.includes("expiră azi") && soon.includes("ITP") && soon.includes("în 7 zile") && !soon.includes("RCA"), soon);
  await p.screenshot(join(shots, "01-parc-auto.png"));

  // Reminders, once.
  const tick = await invoke(p, "reminders_tick", { azi: plus(0) });
  const notes = await invoke(p, "notifications_list", {});
  const titles = JSON.stringify(notes);
  check("memento-urile ajung în notificări", titles.includes("Expiră azi: Permis de conducere — Vasile Pop") && titles.includes("Expiră în 7 zile: ITP — IS 01 ABC"), `${tick} noi`);
  check("…o singură dată", (await invoke(p, "reminders_tick", { azi: plus(0) })) === 0);

  // The licence is renewed: off the list.
  await p.eval("document.querySelector(\".fleet [data-driver='Vasile Pop'] button.link\").click()");
  await p.until("!!document.querySelector(\"input[aria-label='Expirarea actului 1 (Vasile Pop)']\")", 3000);
  await p.fill("input[aria-label='Expirarea actului 1 (Vasile Pop)']", plus(3650));
  await p.click("Salvează actele", ".fleet button");
  await p.until("document.querySelectorAll('.fleet-soon tbody tr').length === 1", 5000);
  check("permisul reînnoit iese din listă", (await p.eval("document.querySelector('.fleet-soon').innerText")).includes("ITP"));

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
