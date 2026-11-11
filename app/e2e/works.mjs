// 7.9e, end to end in the real window: „Situații de lucrări” — an estimate written on the page, its items pasted
// from a spreadsheet (a bad row shown with the reason, not added), statement 1 with the figures worked out by hand
// (18.413,09 lei, VAT 3.866,75, retention 920,65, to pay 21.359,19), issued; statement 2 past the estimate refused
// until a supplement with a reason; statement 1 cancelled with its reason, kept, out of the previous quantities, its
// number not used again; PDF and .xlsx written.
//
// Usage: node app/e2e/works.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node works.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-works-"));
const out = mkdtempSync(join(tmpdir(), "kgb-works-out-"));
const PORT = 9374;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
    const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clickText = (p, text, scope = "") =>
  p.eval(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); b?.click(); return !!b; })()`);
const text = (p, sel) => p.eval(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g, ' ') ?? ''`);
const line = (p, cod) => p.eval(`[...document.querySelectorAll('[data-testid=line]')].find(r => r.cells[0].innerText.trim() === ${JSON.stringify(cod)})?.innerText.replace(/\\s+/g, ' ') ?? ''`);
const cell = (p, cod, i) => p.eval(`[...document.querySelectorAll('[data-testid=line]')].find(r => r.cells[0].innerText.trim() === ${JSON.stringify(cod)})?.cells[${i}].innerText.trim() ?? ''`);
const TAB = String.fromCharCode(9);
const NL = String.fromCharCode(10);
const TABLE = [
  ["Cod", "Denumire", "UM", "Cantitate", "Preț unitar"].join(TAB),
  ["A", "Săpătură", "m3", "100", "250,00"].join(TAB),
  "B;Tencuială;m2;1.500,5;12,35",
  ["C", "Ușă", "buc", "3", "1.000,00"].join(TAB),
  ["D", "Gard", "m", "mult", "10"].join(TAB),
].join(NL);
const openStatement = async (p, n) => {
  await p.eval(`[...document.querySelectorAll('[data-testid=statement] button')].find(b => b.textContent.trim() === 'Situația nr. ${n}').click()`);
  await p.until(`document.querySelector('[data-testid=statement-card] h3')?.innerText === 'Situația nr. ${n}'`, 8000);
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
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Situații de lucrări')";
  await p.until(`!!${card}`, 8000);
  check("modulul Situații de lucrări e în catalog, beta", await p.eval(`${card}.innerText.toLowerCase().includes('beta')`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Situații de lucrări'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Situații de lucrări')).click()");
  await p.until("!!document.querySelector('.works')", 8000);

  // The estimate, from the page: VAT 21%, retention 5% on the value without VAT.
  await setValue(p, "input[aria-label='Numele devizului']", "Hală");
  await setValue(p, "input[aria-label='Numărul devizului']", "D-7");
  await setValue(p, "input[aria-label='Beneficiarul']", "Beneficiar Test SRL");
  await setValue(p, "input[aria-label='Contractul']", "Contract 12/2030");
  await setValue(p, "input[aria-label='Lucrarea']", "Hala de depozitare");
  check("nota: reținerea „cum scrie în contract”, TVA „cu contabilul”", (await text(p, ".works")).includes("cum scrie în contract") && (await text(p, ".works")).includes("o stabilești cu contabilul"));
  await clickText(p, "Adaugă devizul", ".works");
  await p.until("document.querySelector('[data-testid=estimate-card] h3')?.innerText === 'Hală'", 8000);

  // The items pasted from a spreadsheet: the preview shows the bad row and why; nothing is added before confirming.
  await p.eval("document.querySelector('.works details').open = true");
  await setValue(p, "textarea[aria-label='Tabelul lipit']", TABLE);
  await clickText(p, "Previzualizează", ".works");
  await p.until("!!document.querySelector('[data-testid=paste-preview]')", 8000);
  const refused = await text(p, "[data-testid=paste-refused]");
  check("previzualizarea: 3 rânduri bune, rândul 5 refuzat cu motivul", (await p.eval("document.querySelectorAll('[data-testid=paste-preview] tr').length")) === 4 && refused.includes("rândul 5") && refused.includes("mult"), refused);
  check("nimic adăugat înainte de confirmare", (await p.eval("document.querySelectorAll('[data-testid=item]').length")) === 0);
  await clickText(p, "Adaugă cele 3 articole", ".works");
  await p.until("document.querySelectorAll('[data-testid=item]').length === 3", 8000);
  check("devizul: 46.531,18 lei fără TVA", (await text(p, "[data-testid=estimate-card] p.small")).includes("46.531,18 lei fără TVA"), await text(p, "[data-testid=estimate-card] p.small"));

  // Statement 1: A 40, B 600,25, C 1.
  await clickText(p, "Situație nouă", ".works");
  await p.until("document.querySelector('[data-testid=statement-card] h3')?.innerText === 'Situația nr. 1'", 8000);
  await setValue(p, "input[aria-label='Curent A']", "40");
  await setValue(p, "input[aria-label='Curent B']", "600,25");
  await setValue(p, "input[aria-label='Curent C']", "1");
  await clickText(p, "Salvează situația", ".works");
  await p.until("document.querySelector('[data-testid=totals]')?.innerText.includes('18.413,09')", 8000);
  const t1 = await text(p, "[data-testid=totals]");
  check("situația 1: 18.413,09 · TVA 3.866,75 · reținere 920,65 · de plată 21.359,19", ["18.413,09", "3.866,75", "920,65", "21.359,19"].every((x) => t1.includes(x)), t1);
  check("tencuiala: 741.308,75 bani → 7.413,09 lei, rest 900,25", (await cell(p, "B", 8)) === "7.413,09" && (await cell(p, "B", 7)) === "900,25", await line(p, "B"));
  await p.screenshot(join(shots, "01-situatia-1.png"));
  await clickText(p, "Emite situația", ".works");
  await p.until("document.querySelector('[data-testid=statement-card] p.small')?.innerText.startsWith('emisă')", 8000);
  check("emisă: cantitățile nu se mai pot scrie", (await p.eval("document.querySelectorAll('[data-testid=statement-card] input[aria-label^=Curent]').length")) === 0);

  // Statement 2: one cubic metre of A more than the estimate is refused, until a supplement with a reason.
  await clickText(p, "Situație nouă", ".works");
  await p.until("document.querySelector('[data-testid=statement-card] h3')?.innerText === 'Situația nr. 2'", 8000);
  await setValue(p, "input[aria-label='Curent A']", "61");
  await setValue(p, "input[aria-label='Curent B']", "900,25");
  await setValue(p, "input[aria-label='Curent C']", "2");
  await clickText(p, "Salvează situația", ".works");
  await p.until("!!document.querySelector('p.error[role=alert]')", 8000);
  const err = await text(p, "p.error[role=alert]");
  check("depășirea e refuzată: „depășește devizul la Săpătură cu 1 m3”", err.includes("depășește devizul") && err.includes("Săpătură") && err.includes("1 m3"), err);
  await setValue(p, "select[aria-label='Articolul suplimentat']", await p.eval("document.querySelector(\"select[aria-label='Articolul suplimentat']\").options[0].value"));
  await setValue(p, "input[aria-label='Cantitatea suplimentată']", "5");
  await setValue(p, "input[aria-label='Motivul suplimentării']", "teren mai moale decât în studiu");
  await clickText(p, "Adaugă suplimentarea", ".works");
  await p.until("[...document.querySelectorAll('[data-testid=item]')][0]?.innerText.includes('teren mai moale')", 8000);
  // The typed quantities are still there; saving now passes.
  await setValue(p, "input[aria-label='Curent A']", "61");
  await setValue(p, "input[aria-label='Curent B']", "900,25");
  await setValue(p, "input[aria-label='Curent C']", "2");
  await clickText(p, "Salvează situația", ".works");
  await p.until("document.querySelector('[data-testid=totals]')?.innerText.includes('28.368,09')", 8000);
  const t2 = await text(p, "[data-testid=totals]");
  check("situația 2 după suplimentare: 28.368,09 · TVA 5.957,30 · reținere 1.418,40 · de plată 32.906,99", ["28.368,09", "5.957,30", "1.418,40", "32.906,99"].every((x) => t2.includes(x)), t2);
  check("săpătura: deviz 105, anterior 40, cumulat 101, rest 4", (await cell(p, "A", 3)) === "105" && (await cell(p, "A", 4)) === "40" && (await cell(p, "A", 6)) === "101" && (await cell(p, "A", 7)) === "4", await line(p, "A"));
  await clickText(p, "Emite situația", ".works");
  await p.until("document.querySelector('[data-testid=statement-card] p.small')?.innerText.startsWith('emisă')", 8000);

  // Statement 1 was wrong: cancelled with its reason, kept in the list, out of the previous quantities.
  await openStatement(p, 1);
  await setValue(p, "input[aria-label='Motivul anulării']", "cantități greșite la tencuială");
  await clickText(p, "Anulează situația", ".works");
  await p.until("document.querySelector('[data-testid=statement-card] p.small')?.innerText.startsWith('anulată')", 8000);
  const row1 = await p.eval("[...document.querySelectorAll('[data-testid=statement]')].find(r => r.innerText.includes('Situația nr. 1'))?.innerText.replace(/\\s+/g, ' ') ?? ''");
  check("situația 1 rămâne în listă, „anulată”, cu motivul", row1.includes("anulată") && row1.includes("cantități greșite la tencuială"), row1);
  await p.screenshot(join(shots, "02-anulata.png"));
  await openStatement(p, 2);
  check("în situația 2, anteriorul tencuielii devine 0", (await cell(p, "B", 4)) === "0", await line(p, "B"));
  await clickText(p, "Situație nouă", ".works");
  await p.until("[...document.querySelectorAll('[data-testid=statement] button')].some(b => b.textContent.trim() === 'Situația nr. 3')", 8000);
  check("numărul situației anulate nu se refolosește: următoarea e nr. 3", (await p.eval("document.querySelectorAll('[data-testid=statement]').length")) === 3);

  // PDF and .xlsx, written where the person chose (here, through the command the save dialog leads to).
  const sid = await p.eval("(async () => { const d = await window.__TAURI_INTERNALS__.invoke('module_call', { id: 'kgb.works', command: 'devize', args: {} }); const one = await window.__TAURI_INTERNALS__.invoke('module_call', { id: 'kgb.works', command: 'deviz', args: { id: d[0].id } }); return one.situatii.find(s => s.numar === 2).id; })()");
  const pdf = join(out, "situatia-2.pdf");
  const xlsx = join(out, "situatia-2.xlsx");
  const r1 = await invoke(p, "module_call", { id: "kgb.works", command: "situatie_pdf", args: { id: sid, dest: pdf, executant: "Firma Test SRL" } });
  const r2 = await invoke(p, "module_call", { id: "kgb.works", command: "situatie_xlsx", args: { id: sid, dest: xlsx } });
  check("PDF-ul situației 2", !r1?.error && existsSync(pdf) && readFileSync(pdf).subarray(0, 5).toString() === "%PDF-", JSON.stringify(r1));
  check(".xlsx-ul situației 2", !r2?.error && existsSync(xlsx) && readFileSync(xlsx).subarray(0, 2).toString() === "PK", JSON.stringify(r2));
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
