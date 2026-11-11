// 7.9e, end to end in the real window: „Mentenanța echipamentelor” — a forklift with an hours counter, a plan
// every 250 hours („fără citire” until a reading), a yearly check (soon, with its date), a reading past 250
// (overdue, „la 250 ore”), „Marchează făcută” filling the intervention, the next due at 512 hours, a repair
// proposing „funcțional”, the vehicle's note about ITP / RCA, the costs of the year, a reminder without names.
//
// Usage: node app/e2e/maintenance.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node maintenance.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-maintenance-"));
const PORT = 9369;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clickText = (p, text, scope = "") =>
  p.eval(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); b?.click(); return !!b; })()`);
const z = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const now = new Date();
const today = iso(now);
const daysAgo = (n) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
const dueRow = (p, name) => p.eval(`[...document.querySelectorAll('[data-testid=due]')].find(r => r.innerText.includes(${JSON.stringify(name)}))?.innerText.replace(/\\s+/g, ' ') ?? ''`);
const tab = async (p, name) => {
  await p.eval(`[...document.querySelectorAll('.maintenance [role=tab]')].find(b => b.textContent.startsWith(${JSON.stringify(name)})).click()`);
  await sleep(300);
};

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Mentenanța echipamentelor')";
  await p.until(`!!${card}`, 8000);
  check("modulul Mentenanța echipamentelor e în catalog, beta", await p.eval(`${card}.innerText.toLowerCase().includes('beta')`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Mentenanța echipamentelor'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Mentenanța echipamentelor')).click()");
  await p.until("!!document.querySelector('.maintenance')", 8000);

  // A forklift with an hours counter, from the page.
  await tab(p, "Echipamente");
  await setValue(p, "input[aria-label='Numele echipamentului']", "Stivuitor 2");
  await setValue(p, "select[aria-label='Contorul']", "ore");
  await clickText(p, "Adaugă echipamentul", ".maintenance");
  await p.until("!!document.querySelector('[data-testid=equipment-card]') && document.querySelector('[data-testid=equipment-card] h3').innerText === 'Stivuitor 2'", 8000);
  // Every 250 hours; a yearly check counted from 360 days ago.
  await setValue(p, "input[aria-label='Denumirea planului']", "Schimb ulei");
  await setValue(p, "input[aria-label='La cât contor']", "250");
  await clickText(p, "Adaugă planul", ".maintenance");
  await p.until("[...document.querySelectorAll('[data-testid=plan]')].some(x => x.innerText.includes('Schimb ulei'))", 8000);
  await setValue(p, "input[aria-label='Denumirea planului']", "Verificare anuală");
  await setValue(p, "select[aria-label='Felul planului']", "verificare_legala");
  await setValue(p, "input[aria-label='La câte zile']", "365");
  await setValue(p, "input[aria-label='Numărat de la']", daysAgo(360));
  await clickText(p, "Adaugă planul", ".maintenance");
  await p.until("[...document.querySelectorAll('[data-testid=plan]')].some(x => x.innerText.includes('Verificare anuală'))", 8000);
  await tab(p, "Scadențe");
  await p.until("document.querySelectorAll('[data-testid=due]').length === 2", 8000);
  const oil0 = await dueRow(p, "Schimb ulei");
  const year0 = await dueRow(p, "Verificare anuală");
  check("planul pe contor fără nicio citire: „fără citire”, nu „în regulă”", oil0.includes("fără citire"), oil0);
  check("verificarea anuală: „în curând”, cu data", year0.includes("în curând") && year0.includes(`la ${daysAgo(-5).split("-").reverse().join(".")}`), year0);

  // A reading of 260 hours: the oil change is overdue, „la 250 ore”.
  await tab(p, "Echipamente");
  await setValue(p, "input[aria-label='Citirea de azi']", "260");
  await clickText(p, "Salvează citirea", ".maintenance");
  await sleep(500);
  await tab(p, "Scadențe");
  await p.until("document.querySelector('[data-testid=due]')?.innerText.includes('depășit')", 8000);
  const oil1 = await dueRow(p, "Schimb ulei");
  check("după citirea 260: „depășit · la 250 ore”, primul în listă", oil1.includes("depășit") && oil1.includes("la 250 ore") && (await p.eval("document.querySelector('[data-testid=due]').innerText.includes('Schimb ulei')")), oil1);
  await p.screenshot(join(shots, "01-scadente.png"));

  // „Marchează făcută”: the intervention opens filled; at 262 hours, 450 lei, 2 hours down.
  await p.eval("[...document.querySelectorAll('[data-testid=due]')].find(r => r.innerText.includes('Schimb ulei')).querySelector('button').click()");
  await p.until("document.querySelector(\"input[aria-label='Ce s-a făcut']\")?.value === 'Schimb ulei'", 8000);
  await setValue(p, "input[aria-label='Contorul la intervenție']", "262");
  await setValue(p, "input[aria-label='Costul fără TVA']", "450");
  await setValue(p, "input[aria-label='Ore de oprire']", "2");
  await clickText(p, "Salvează intervenția", ".maintenance");
  await p.until("[...document.querySelectorAll('[data-testid=work]')].some(r => r.innerText.includes('Schimb ulei'))", 8000);
  await tab(p, "Scadențe");
  await p.until("(document.querySelector('[data-testid=due]') && [...document.querySelectorAll('[data-testid=due]')].find(r => r.innerText.includes('Schimb ulei'))?.innerText.includes('512'))", 8000);
  check("după intervenție: următoarea la 512 ore, în regulă", (await dueRow(p, "Schimb ulei")).includes("în regulă"), await dueRow(p, "Schimb ulei"));

  // A repair of a broken machine proposes „funcțional”.
  await tab(p, "Echipamente");
  await clickText(p, "Marchează defect", "[data-testid=equipment-card]");
  await p.until("document.querySelector('[data-testid=equipment-card] p.small').innerText.includes('defect')", 8000);
  await setValue(p, "select[aria-label='Felul intervenției']", "reparatie");
  await setValue(p, "input[aria-label='Ce s-a făcut']", "Pompă hidraulică");
  await setValue(p, "input[aria-label='Costul fără TVA']", "1.200,00");
  await setValue(p, "input[aria-label='Ore de oprire']", "16");
  await clickText(p, "Salvează intervenția", ".maintenance");
  await p.until("[...document.querySelectorAll('.maintenance button')].some(b => b.textContent.trim() === 'Îl trec funcțional')", 8000);
  await clickText(p, "Îl trec funcțional", ".maintenance");
  await p.until("document.querySelector('[data-testid=equipment-card] p.small').innerText.includes('funcțional')", 8000);
  check("reparația făcută propune „Îl trec funcțional”, iar starea devine funcțional", true);
  check("anul acesta: 1.650,00 lei fără TVA, 18 ore de oprire", await p.eval("document.querySelector('[data-testid=equipment-card]').innerText.includes('Anul acesta: 1.650,00 lei fără TVA, 18 ore de oprire')"));

  // A vehicle: its papers are in Permits.
  await setValue(p, "input[aria-label='Numele echipamentului']", "Duba Ford");
  await setValue(p, "select[aria-label='Categoria echipamentului']", "vehicul");
  await setValue(p, "input[aria-label='Seria']", "CJ 10 ABC");
  await clickText(p, "Adaugă echipamentul", ".maintenance");
  await p.until("document.querySelector('[data-testid=equipment-card] h3')?.innerText === 'Duba Ford'", 8000);
  check("la vehicul: „ITP, RCA, rovinieta: în Permise și autorizații”", await p.eval("document.querySelector('[data-testid=equipment-card]').innerText.includes('ITP, RCA, rovinieta')"));

  // The costs of the year.
  await tab(p, "Costuri pe an");
  await p.until("!!document.querySelector('[data-testid=costs]')", 8000);
  check("costurile anului: Stivuitor 2, 1.650,00 lei, 2 intervenții din care o reparație, 18 ore", await p.eval("document.querySelector('[data-testid=costs]').innerText.includes('Stivuitor 2') && document.querySelector('[data-testid=costs]').innerText.includes('1.650,00 lei') && document.querySelector('[data-testid=costs]').innerText.includes('18 ore de oprire')"));
  await p.screenshot(join(shots, "02-costuri.png"));

  // The reminder: the yearly check is soon; a count, no names.
  await invoke(p, "reminders_tick", { azi: today });
  await invoke(p, "reminders_tick", { azi: today });
  const bell = (await invoke(p, "notifications_list", {})).items.filter((n) => n.module === "kgb.maintenance");
  check(
    "memento „O mentenanță în curând”, o singură dată, fără numele echipamentului",
    bell.length === 1 && bell[0].titlu === "O mentenanță în curând" && !JSON.stringify(bell).includes("Stivuitor") && !JSON.stringify(bell).includes("Verificare"),
    JSON.stringify(bell.map((b) => b.titlu)),
  );
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
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
