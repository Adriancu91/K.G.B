// 7.9e, end to end in the real window: „Rețete și costuri” — ingredients with prices, the cleaning loss and the
// allergens ticked, a semi-finished sauce, mashed potatoes with the net quantity (0,800 kg → 1,000 kg gross), the
// cost per portion, the proposed price rounded once, the allergens through the sauce, an old price warned, a recipe
// with nothing ticked shown as „nebifat”, and the consumption for 8 portions exported as CSV.
//
// Usage: node app/e2e/recipes.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node recipes.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-recipes-"));
const out = mkdtempSync(join(tmpdir(), "kgb-recipes-out-"));
const PORT = 9370;
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
const tab = async (p, name) => {
  await p.eval(`[...document.querySelectorAll('.recipes [role=tab]')].find(b => b.textContent.trim() === ${JSON.stringify(name)}).click()`);
  await sleep(300);
};
const tick = (p, label) => p.eval(`(() => { const c = document.querySelector('input[type=checkbox][aria-label=${JSON.stringify(label)}]'); if (c && !c.checked) c.click(); return !!c; })()`);
const selectByText = (p, sel, part) =>
  p.eval(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); const o = [...s.options].find(o => o.textContent.includes(${JSON.stringify(part)})); if (!o) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
const card = (p) => p.eval("document.querySelector('[data-testid=recipe-card]')?.innerText.replace(/\\s+/g, ' ') ?? ''");

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const cat = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Rețete și costuri')";
  await p.until(`!!${cat}`, 8000);
  check("modulul Rețete și costuri e în catalog, beta", await p.eval(`${cat}.innerText.toLowerCase().includes('beta')`));
  await p.eval(`${cat}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Rețete și costuri'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Rețete și costuri')).click()");
  await p.until("!!document.querySelector('.recipes')", 8000);

  // The ingredients, from the page: the butter's price is from long ago.
  await tab(p, "Ingrediente");
  for (const [name, um, price, loss, date, allergens] of [
    ["Cartofi", "kg", "2,50", "20", "", []],
    ["Lapte", "l", "6", "", "", ["Lapte și produse derivate (inclusiv lactoză)"]],
    ["Unt", "kg", "40", "", "2025-01-01", ["Lapte și produse derivate (inclusiv lactoză)"]],
    ["Făină", "kg", "3", "", "", ["Cereale care conțin gluten"]],
  ]) {
    await setValue(p, "input[aria-label='Numele ingredientului']", name);
    await setValue(p, "select[aria-label='Unitatea ingredientului']", um);
    await setValue(p, "input[aria-label='Prețul fără TVA pe unitate']", price);
    await setValue(p, "input[aria-label='Pierderea la curățare (%)']", loss);
    if (date) await setValue(p, "input[aria-label='Data prețului']", date);
    for (const a of allergens) await tick(p, a);
    await clickText(p, "Adaugă ingredientul", ".recipes");
    await p.until(`[...document.querySelectorAll('[data-testid=ingredient]')].some(r => r.innerText.startsWith(${JSON.stringify(name)}))`, 8000);
  }
  check("4 ingrediente, cu prețul pe unitate și alergenii bifați", (await p.eval("document.querySelectorAll('[data-testid=ingredient]').length")) === 4 && (await p.eval("[...document.querySelectorAll('[data-testid=ingredient]')].find(r => r.innerText.startsWith('Cartofi')).innerText.includes('2,50 lei/kg')")));

  // The sauce (semi-finished, 1 l) and the mashed potatoes (4 portions).
  const newRecipe = async (name, kind, lot, unit) => {
    await setValue(p, "input[aria-label='Numele rețetei']", name);
    await setValue(p, "select[aria-label='Felul rețetei']", kind);
    await setValue(p, "input[aria-label='Cât iese din rețetă']", lot);
    await setValue(p, "input[aria-label='Unitatea rețetei']", unit);
    await clickText(p, "Adaugă rețeta", ".recipes");
    await p.until(`document.querySelector('[data-testid=recipe-card] h3')?.innerText === ${JSON.stringify(name)}`, 8000);
  };
  const addLine = async (part, q) => {
    const n = await p.eval("document.querySelectorAll('[data-testid=recipe-line]').length");
    await selectByText(p, "select[aria-label='Ce adaugi în rețetă']", part);
    await setValue(p, "input[aria-label='Cantitatea netă']", q);
    await clickText(p, "Adaugă linia", "[data-testid=recipe-card]");
    await p.until(`document.querySelectorAll('[data-testid=recipe-line]').length === ${n + 1}`, 8000);
  };
  await tab(p, "Rețete");
  await newRecipe("Sos alb", "semipreparat", "1", "l");
  await addLine("Lapte", "1");
  await addLine("Unt", "0,05");
  await addLine("Făină", "0,05");
  await newRecipe("Piure", "preparat", "4", "porție");
  await addLine("Cartofi", "0,8");
  await addLine("Sos alb", "0,2");
  check("cartofii: 0,800 kg net → 1,000 kg brut, 2,50 lei", await p.eval("[...document.querySelectorAll('[data-testid=recipe-line]')].some(r => r.innerText.includes('0,800 kg net') && r.innerText.includes('1,000 kg brut') && r.innerText.includes('2,50 lei'))"));
  await setValue(p, "input[aria-label='Adaosul (%)']", "100");
  await setValue(p, "select[aria-label='Cota de TVA']", "11");
  await setValue(p, "input[aria-label='Randamentul la preparare (%)']", "90");
  await clickText(p, "Salvează rețeta", "[data-testid=recipe-card]");
  await p.until("document.querySelector('[data-testid=recipe-sum]')?.innerText.includes('Preț propus: 2,29 lei')", 8000);
  const c = await card(p);
  check("costul pe porție 1,03 lei, prețul propus 2,29 lei (rotunjit o dată), greutatea după preparare 0,720 kg", c.includes("pe porție: 1,03 lei") && c.includes("Preț propus: 2,29 lei cu TVA") && c.includes("0,720 kg"), c.slice(0, 300));
  check("alergenii prin sos: gluten și lapte, „după ingredientele bifate de tine”", c.includes("Cereale care conțin gluten") && c.includes("Lapte și produse derivate") && c.includes("după ingredientele bifate de tine"));
  check("avertisment: prețul untului e vechi", await p.eval("[...document.querySelectorAll('[data-testid=recipe-warning]')].some(w => w.innerText.includes('Unt') && w.innerText.includes('mai vechi'))"));
  check("lângă TVA: „cota o stabilești cu contabilul”", c.includes("cota o stabilești cu contabilul"));
  await p.screenshot(join(shots, "01-reteta.png"));

  // Nothing ticked: „nebifat”, never „fără alergeni”.
  await newRecipe("Cartofi fierți", "preparat", "1", "porție");
  await addLine("Cartofi", "0,3");
  check("fără alergeni bifați: „nebifat”", await p.eval("document.querySelector('[data-testid=recipe-allergens]').innerText.includes('nebifat') && !document.body.innerText.includes('fără alergeni')"));

  // The consumption for 8 portions of mashed potatoes, through the sauce; exported as CSV.
  await tab(p, "Consum");
  await selectByText(p, "select[aria-label='Rețeta pentru consum']", "Piure");
  await setValue(p, "input[aria-label='Câte porții']", "8");
  await clickText(p, "Calculează consumul", ".recipes");
  await p.until("!!document.querySelector('[data-testid=use]')", 8000);
  const use = await p.eval("document.querySelector('[data-testid=use]').innerText.replace(/\\s+/g, ' ')");
  check("consumul pentru 8 porții: 2,000 kg cartofi, 0,400 l lapte, 0,020 kg unt", use.includes("Cartofi 2,000 kg") && use.includes("Lapte 0,400 l") && use.includes("Unt 0,020 kg"), use);
  const recipes = await invoke(p, "module_call", { id: "kgb.recipes", command: "retete", args: {} });
  const dish = recipes.find((r) => r.nume === "Piure").id;
  const dest = join(out, "consum.csv");
  await invoke(p, "module_call", { id: "kgb.recipes", command: "consum_export", args: { linii: [{ reteta: dish, portii: 8000 }], dest } });
  const csv = readFileSync(dest, "utf8");
  check("exportul .csv: cu BOM, „;”, virgulă zecimală, diacritice", csv.charCodeAt(0) === 0xfeff && csv.includes('"Cartofi";2,000;"kg";5,00') && csv.includes("Făină"), csv.slice(0, 120));
  await p.screenshot(join(shots, "02-consum.png"));
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
  rmSync(out, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
