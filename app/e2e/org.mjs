// Etapa 6 step 6.1, end to end in the real window: create the organization,
// add a person and a custom role, then put the person on this PC on that
// role: a module without access disappears, a read-only module refuses
// writes, the organization page no longer allows changes; a forced restart
// keeps all of it.
//
// Usage: node app/e2e/org.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

// The demo commands of kgb.notes (the Note page is the COS Notes window since 7.4l-2c).
const demoNotes = (p) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", {id: "kgb.notes", command: "list", args: {}}).then(l => l.map(n => n.text))`);
const demoAdd = (p, text) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.notes", command: "add", args: { text } })}).then(() => "ok", (e) => String(e))`);

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node org.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-org-"));
const PORT = 9345;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const navLabels = (p) => p.eval("[...document.querySelectorAll('nav .nav')].map(e => e.innerText.trim())");
const setSelect = (p, sel, text) =>
  p.eval(`(() => { const s = document.querySelector(${JSON.stringify(sel)});
    const o = [...s.options].find(o => o.textContent.trim() === ${JSON.stringify(text)});
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value);
    s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

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
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}
async function enable(p, name) {
  await p.click("Catalog module", "nav .nav");
  const card = `[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === ${JSON.stringify(name)})`;
  await p.until(`!!${card}`);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until(`[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes(${JSON.stringify(name)}))`);
}

try {
  let p = await start();
  await enable(p, "Note");
  await enable(p, "Business");

  await p.click("Organizație", "nav .nav");
  await p.until("!!document.querySelector('form[aria-label=\"Creează organizația\"]')");
  check("fără organizație, pagina explică modul o-singură-persoană", (await p.eval("document.querySelector('.org-page').innerText")).includes("unei singure persoane"));
  await p.fill("form[aria-label='Creează organizația'] input", "Firma Test SRL");
  await p.eval(`(() => { const i = document.querySelectorAll("form[aria-label='Creează organizația'] input")[1];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Ana Test');
    i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await p.click("Creează organizația");
  await p.until("!!document.querySelector('.org-current')");
  const cur = await p.eval("document.querySelector('.org-current').innerText");
  check("acest PC e al administratorului", cur.includes("Ana Test") && cur.includes("Administrator"), cur);
  const roles = await p.eval("[...document.querySelectorAll('.roles-table thead th')].map(t => t.innerText.trim())");
  check("rolurile implicite", roles.join("|").startsWith("Modul|Administrator|Membru|Doar citire"), roles.join("|"));
  const memberBusiness = await p.eval("[...document.querySelectorAll('.roles-table tbody tr')].find(r => r.cells[0].innerText === 'Business').cells[2].innerText");
  check("Membru nu are acces la Business", memberBusiness.includes("fără acces"), memberBusiness);

  // A second administrator and a custom role.
  await p.fill("input[aria-label='Numele persoanei']", "Ion Test");
  await setSelect(p, "select[aria-label='Rolul persoanei']", "Administrator");
  await p.click("Adaugă persoana");
  await p.until("[...document.querySelectorAll('.members-table tbody tr')].length === 2");
  await p.fill("input[aria-label='Numele rolului nou']", "Contabil");
  await p.click("Adaugă rolul");
  await p.until("[...document.querySelectorAll('.roles-table thead th')].some(t => t.innerText.startsWith('Contabil'))");
  await setSelect(p, "select[aria-label='Contabil: kgb.notes']", "doar citire");
  await p.until("document.querySelector(\"select[aria-label='Contabil: kgb.notes']\").value === 'citire'");
  await p.screenshot(join(shots, "01-organizatie.png"));

  // The last administrator cannot step down… but with Ion as admin, Ana can.
  await setSelect(p, "select[aria-label='Rolul lui Ana Test']", "Contabil");
  await p.until("document.querySelector('.org-current').innerText.includes('Contabil')", 5000);
  const nav = await navLabels(p);
  check("modulul fără acces dispare din meniu", !nav.some((l) => l.startsWith("Business")), nav.join("|"));
  check("modulul doar-citire e marcat în meniu", nav.some((l) => l.startsWith("Note") && l.includes("citire")), nav.join("|"));
  // The relay choice in the network panel is this PC's own setting, not the organization's.
  check("pagina organizației nu mai permite schimbări", (await p.eval("[...document.querySelectorAll('.org-page select, .org-page form')].filter(e => !e.closest('.net-panel')).length")) === 0);

  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Note')).click()");
  await p.until("(document.querySelector('.page-head')?.innerText ?? '').includes('Note')", 5000);
  check("antetul spune „doar citire”", (await p.eval("document.querySelector('.page-head').innerText")).includes("doar citire"));
  const err = await demoAdd(p, "nu ar trebui salvată");
  check("scrierea e refuzată cu motivul", err.includes("poate doar citi"), err);
  await p.screenshot(join(shots, "02-doar-citire.png"));

  // Forced restart: everything stays.
  stop(p);
  p = await start();
  const nav2 = await navLabels(p);
  check("după repornire (forțată) rolul se aplică la fel", !nav2.some((l) => l.startsWith("Business")) && nav2.some((l) => l.startsWith("Note") && l.includes("citire")), nav2.join("|"));
  await p.click("Organizație", "nav .nav");
  await p.until("!!document.querySelector('.org-current')");
  const cur2 = await p.eval("document.querySelector('.org-current').innerText");
  check("organizația și persoanele rămân", cur2.includes("Ana Test") && (await p.eval("document.querySelectorAll('.members-table tbody tr').length")) === 2, cur2);
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
