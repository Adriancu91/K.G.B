// Etapa 5 step 5.1, end to end in the real window: Business — products,
// warehouses, a receipt with two lines, an issue above the stock refused, an
// issue that leaves the stock under its minimum, a storno, a forced restart.
//
// Usage: node app/e2e/business.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node business.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-business-"));
const PORT = 9344;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const stockRows = (p) =>
  p.eval("[...document.querySelectorAll('.stock-table tbody tr')].map(r => [...r.cells].map(c => c.innerText.trim()).join('|'))");
const selectByText = (p, sel, text) =>
  p.eval(`(() => { const s = document.querySelector(${JSON.stringify(sel)});
    const o = [...s.options].find(o => o.textContent.includes(${JSON.stringify(text)}));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value);
    s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  return p;
}
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}
const tab = (p, label) => p.eval(`[...document.querySelectorAll('.business .sheet-tabs button')].find(b => b.innerText.startsWith(${JSON.stringify(label)})).click()`);

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Business')";
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Business'))");
  await p.click("Business", "nav .nav");
  await p.until("!!document.querySelector('.business')");
  check("pagina spune clar că e evidență primară", (await p.eval("document.querySelector('.business .warn').innerText")).includes("nu contabilitate certificată"));

  await tab(p, "Depozite");
  for (const n of ["Depozit central", "Șantier Iași"]) {
    await p.fill("input[aria-label='Nume depozit']", n);
    await p.click("Adaugă depozitul");
    await p.until(`document.body.innerText.includes(${JSON.stringify(n)})`);
  }
  await tab(p, "Produse");
  for (const [cod, nume, um, min] of [["CIM-40", "Ciment 40 kg", "sac", "10"], ["SRB-6", "Șurub 6 mm", "kg", ""]]) {
    await p.fill("input[aria-label='Cod produs']", cod);
    await p.fill("input[aria-label='Nume produs']", nume);
    await p.fill("input[aria-label='Unitate de măsură']", um);
    await p.fill("input[aria-label='Stoc minim']", min);
    await p.click("Adaugă produsul");
    await p.until(`document.body.innerText.includes(${JSON.stringify(nume)})`);
  }
  check("2 depozite și 2 produse", (await p.eval("document.querySelectorAll('.business table.audit tbody tr').length")) === 2);

  // Receipt with two lines.
  await tab(p, "Recepție nouă");
  await p.until("!!document.querySelector('.stock-doc')");
  await selectByText(p, "select[aria-label='Depozit']", "Depozit central");
  await p.fill("input[aria-label='Numărul documentului']", "NIR 1");
  await p.fill("input[aria-label='Furnizor']", "Furnizor SRL");
  await selectByText(p, "select[aria-label='Produsul 1']", "CIM-40");
  await p.fill("input[aria-label='Cantitatea 1']", "25");
  await p.fill("input[aria-label='Prețul 1']", "32,50");
  await p.click("+ Adaugă un produs", ".stock-doc button");
  await selectByText(p, "select[aria-label='Produsul 2']", "SRB-6");
  await p.fill("input[aria-label='Cantitatea 2']", "2,5");
  await p.fill("input[aria-label='Prețul 2']", "18");
  await p.screenshot(join(shots, "01-receptie.png"));
  await p.click("Înregistrează recepția", ".stock-doc button");
  await p.until("!!document.querySelector('.stock-table')", 8000);
  const s1 = await stockRows(p);
  check("recepția intră în stoc", JSON.stringify(s1.map((r) => r.split("|").slice(0, 5).join("|"))) === JSON.stringify(["CIM-40|Ciment 40 kg|Depozit central|25|sac", "SRB-6|Șurub 6 mm|Depozit central|2,5|kg"]), JSON.stringify(s1));

  // Issue above the stock: refused, the form stays with the message.
  await tab(p, "Ieșire nouă");
  await p.until("!!document.querySelector('.stock-doc')");
  await selectByText(p, "select[aria-label='Depozit']", "Depozit central");
  await p.fill("input[aria-label='Numărul documentului']", "BC 1");
  await selectByText(p, "select[aria-label='Produsul 1']", "CIM-40");
  await p.fill("input[aria-label='Cantitatea 1']", "30");
  await p.click("Înregistrează ieșirea", ".stock-doc button");
  await p.until("!!document.querySelector('.stock-doc [role=alert]')", 8000);
  const err = await p.eval("document.querySelector('.stock-doc [role=alert]').innerText");
  check("ieșirea peste stoc e refuzată și spune cât e", err.includes("în depozit sunt 25, se cer 30"), err);
  await p.fill("input[aria-label='Cantitatea 1']", "18");
  await p.click("Înregistrează ieșirea", ".stock-doc button");
  await p.until("!!document.querySelector('.stock-table')", 8000);
  const s2 = await stockRows(p);
  check("după ieșire: 7 saci, sub minim", s2[0]?.startsWith("CIM-40|Ciment 40 kg sub minim|Depozit central|7|sac") ?? false, JSON.stringify(s2));
  await p.screenshot(join(shots, "02-stoc.png"));

  // Storno of the issue: visible, the stock comes back.
  await tab(p, "Documente");
  await p.click("", "button[aria-label='Stornează BC 1']");
  await p.until("[...document.querySelectorAll('.stock-docs tbody tr')].length === 3", 8000);
  const docs = await p.eval("[...document.querySelectorAll('.stock-docs tbody tr')].map(r => r.cells[0].innerText + ' ' + r.cells[1].innerText)");
  check("stornoul apare ca document separat; originalul rămâne", docs.includes("Storno STORNO BC 1") && docs.includes("Ieșire BC 1") && docs.includes("Recepție NIR 1"), JSON.stringify(docs));
  await p.screenshot(join(shots, "03-documente.png"));

  // Step 5.2: value at weighted average cost, a transfer and an inventory.
  await tab(p, "Stoc");
  await p.until("!!document.querySelector('.stock-table tbody tr')", 8000);
  const v1 = await p.eval("[...document.querySelectorAll('.stock-table tbody tr')].map(r => r.cells[5].innerText + '|' + r.cells[6].innerText)");
  check("costul mediu și valoarea", JSON.stringify(v1) === JSON.stringify(["32,50|812,50", "18,00|45,00"]), JSON.stringify(v1));
  await tab(p, "Transfer");
  await p.until("!!document.querySelector('.stock-doc')");
  await selectByText(p, "select[aria-label='Din depozitul']", "Depozit central");
  await selectByText(p, "select[aria-label='În depozitul']", "Șantier Iași");
  await p.fill("input[aria-label='Numărul documentului']", "T 1");
  await selectByText(p, "select[aria-label='Produsul 1']", "CIM-40");
  await p.fill("input[aria-label='Cantitatea 1']", "5");
  await p.click("Înregistrează transferul", ".stock-doc button");
  await p.until("!!document.querySelector('.stock-table')", 8000);
  const s4 = await stockRows(p);
  check("transferul mută cantitatea și valoarea", s4.includes("CIM-40|Ciment 40 kg|Depozit central|20|sac|32,50|650,00") && s4.includes("CIM-40|Ciment 40 kg sub minim|Șantier Iași|5|sac|32,50|162,50"), JSON.stringify(s4));
  await tab(p, "Inventar");
  await p.until("!!document.querySelector('.inventory-table')");
  await selectByText(p, "select[aria-label='Depozit']", "Depozit central");
  await p.fill("input[aria-label='Numărul documentului']", "INV 1");
  await p.fill("input[aria-label='Numărat: Ciment 40 kg']", "19");
  await p.click("Înregistrează inventarul", ".stock-doc button");
  await p.until("document.body.innerText.includes('Diferențe: Ciment 40 kg -1')", 8000);
  check("inventarul înregistrează diferența", (await stockRows(p)).includes("CIM-40|Ciment 40 kg|Depozit central|19|sac|32,50|617,50"));
  await p.screenshot(join(shots, "04-valoare.png"));

  // Forced restart: the stock is recomputed from the movements.
  stop(p);
  p = await start();
  await p.click("Business", "nav .nav");
  await p.until("!!document.querySelector('.stock-table tbody tr')", 10000);
  const s3 = await stockRows(p);
  check("după repornire (forțată) stocul și valoarea sunt aceleași", s3.includes("CIM-40|Ciment 40 kg|Depozit central|19|sac|32,50|617,50") && s3.includes("CIM-40|Ciment 40 kg sub minim|Șantier Iași|5|sac|32,50|162,50"), JSON.stringify(s3));
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
