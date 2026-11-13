// 8.17, end to end in the real window: „Service auto” — the module enabled from the catalog, a client's car added
// (number typed „is 12 abc” kept as IS12ABC), a work order with labour and two parts whose totals match the
// figures computed by hand (593,48 + TVA 21 % 124,63 = 718,11 lei), the steps up to delivered with the warranty
// date, the delivered order locked, the car's history, and the same after a restart.
//
// Usage: node app/e2e/autoservice.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node autoservice.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-autoservice-"));
const PORT = 9378;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
    const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clickText = (p, text, scope = "") =>
  p.eval(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); b?.click(); return !!b; })()`);
const tab = async (p, name) => {
  await p.eval(`[...document.querySelectorAll('.autoservice [role=tab]')].find(b => b.textContent.startsWith(${JSON.stringify(name)})).click()`);
  await sleep(300);
};
const totals = (p) => p.eval("document.querySelector('.autoservice-totals')?.innerText.replace(/\\s+/g, ' ') ?? ''");
const start = async () => {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  return p;
};
const stop = async (p) => {
  p.close();
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  } catch {
    /* gone */
  }
  await sleep(1500);
};
const openModule = async (p) => {
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Service auto'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Service auto')).click()");
  await p.until("!!document.querySelector('.autoservice')", 8000);
};

try {
  let p = await start();
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Service auto')";
  await p.until(`!!${card}`, 8000);
  check("modulul Service auto e în catalog, beta", await p.eval(`${card}.innerText.toLowerCase().includes('beta')`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await openModule(p);
  check("la început nicio mașină în atelier", (await p.eval("document.querySelector('.autoservice').innerText")).includes("Nicio mașină în atelier acum."));

  // A car from the page.
  await tab(p, "Mașini");
  await setValue(p, "input[aria-label='Clientul']", "Popescu Ion");
  await setValue(p, "input[aria-label='Telefonul']", "0722 000 000");
  await setValue(p, "input[aria-label='Numărul de înmatriculare']", "is 12 abc");
  await setValue(p, "input[aria-label='VIN']", "wvwzzz1kz8w123456");
  await setValue(p, "input[aria-label='Marca']", "Dacia");
  await setValue(p, "input[aria-label='Modelul']", "Logan");
  await setValue(p, "input[aria-label='Anul fabricației']", "2018");
  await clickText(p, "Adaugă mașina", ".autoservice");
  await p.until("document.querySelector('[aria-label=\"Fișa mașinii\"] h3')?.innerText.includes('IS12ABC')", 8000);
  check("mașina se adaugă cu numărul fără spații, cu majuscule", (await p.eval("document.querySelector('.autoservice-cars tbody')?.innerText ?? ''")).includes("IS12ABC"));
  // The same number again is refused.
  await setValue(p, "input[aria-label='Clientul']", "Altcineva");
  await setValue(p, "input[aria-label='Numărul de înmatriculare']", "IS-12-ABC");
  await clickText(p, "Adaugă mașina", ".autoservice");
  await p.until("[...document.querySelectorAll('.error, [role=alert]')].some(e => e.innerText.includes('e deja la altă mașină'))", 8000);
  check("același număr la altă mașină e refuzat", true);

  // A work order: labour 2,5 h × 150; filter 45,99; oil 4,5 l × 38,33.
  await clickText(p, "Comandă nouă", ".autoservice");
  await p.until("!!document.querySelector('[aria-label=\"Comanda de lucru\"]')", 8000);
  await setValue(p, "input[aria-label='Kilometrajul']", "152300");
  await setValue(p, "textarea[aria-label='Reclamația clientului']", "zgomot la frânare, revizie");
  await clickText(p, "+ Manoperă", ".autoservice");
  await clickText(p, "+ Piesă", ".autoservice");
  await clickText(p, "+ Piesă", ".autoservice");
  const lines = [
    ["Schimb ulei și filtre", "", "2,5", "150"],
    ["Filtru ulei", "", "1", "45,99"],
    ["Ulei 5W30", "l", "4,5", "38,33"],
  ];
  for (const [n, [name, um, q, pr]] of lines.entries()) {
    await setValue(p, `input[aria-label='Denumirea liniei ${n + 1}']`, name);
    if (um) await setValue(p, `input[aria-label='U.M. a liniei ${n + 1}']`, um);
    await setValue(p, `input[aria-label='Cantitatea liniei ${n + 1}']`, q);
    await setValue(p, `input[aria-label='Prețul liniei ${n + 1}']`, pr);
  }
  await clickText(p, "Deschide comanda", ".autoservice");
  await p.until("!!document.querySelector('.autoservice-totals')", 8000);
  const t = await totals(p);
  check("totalurile ca la mână: manoperă 375,00, piese 218,48, fără TVA 593,48, TVA 124,63, total 718,11", ["375,00", "218,48", "593,48", "124,63", "718,11"].every((x) => t.includes(x)), t);
  await p.screenshot(join(shots, "01-comanda.png"));

  // Steps up to delivered.
  for (const step of ["Începe lucrul", "Gata"]) {
    await clickText(p, step, ".autoservice");
    await sleep(600);
  }
  await setValue(p, "input[aria-label='Garanția lucrării']", "3");
  await clickText(p, "Salvează comanda", ".autoservice");
  await sleep(600);
  const z = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const today = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  await setValue(p, "input[aria-label='Data predării']", today);
  await clickText(p, "Predă clientului", ".autoservice");
  await p.until("document.querySelector('[aria-label=\"Comanda de lucru\"] h3')?.innerText.includes('predată')", 8000);
  const box = await p.eval("document.querySelector('[aria-label=\"Comanda de lucru\"]').innerText.replace(/\\s+/g, ' ')");
  check("predată, cu garanția lucrării calculată", box.includes("Predată la") && box.includes("garanția lucrării până la"), box.slice(0, 200));
  check("o comandă predată e blocată (câmpurile nu se mai schimbă)", await p.eval("document.querySelector('[aria-label=\"Comanda de lucru\"] fieldset').disabled"));
  await tab(p, "Comenzi în lucru");
  check("nu mai apare în „Comenzi în lucru”", (await p.eval("document.querySelector('.autoservice').innerText")).includes("Nicio mașină în atelier acum."));
  await p.screenshot(join(shots, "02-predata.png"));

  // After a restart: the car with its history.
  await stop(p);
  p = await start();
  await openModule(p);
  await tab(p, "Mașini");
  await p.until("!!document.querySelector('.autoservice-cars tbody tr')", 8000);
  await p.eval("document.querySelector('.autoservice-cars tbody button.link').click()");
  await p.until("!!document.querySelector('[aria-label=\"Fișa mașinii\"]')", 8000);
  const card2 = await p.eval("document.querySelector('[aria-label=\"Fișa mașinii\"]').innerText.replace(/\\s+/g, ' ')");
  check("după repornire: fișa mașinii cu istoricul (o comandă predată, 718,11)", card2.includes("Istoricul (1)") && card2.includes("718,11") && card2.includes("152.300 km"), card2.slice(0, 220));
  await p.screenshot(join(shots, "03-istoric.png"));
  await stop(p);
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
} finally {
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc?.pid)], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
