// 7.9e, end to end in the real window: „Contracte și abonamente” — a contract with a partner picked from the
// directory, a monthly line, the periods due, „Emite factura” issuing the invoice in Business and marking the
// period, a manual mark, the same period refused twice, the calendar of notice and renewal, and the reminder in
// the bell without the partner's name.
//
// Usage: node app/e2e/contracts.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node contracts.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-contracts-"));
const PORT = 9367;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
const biz = (p, command, args) => invoke(p, "module_call", { id: "kgb.business", command, args });
const con = (p, command, args) => invoke(p, "module_call", { id: "kgb.contracts", command, args });
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clickText = (p, text, scope = "") =>
  p.eval(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); b?.click(); return !!b; })()`);
const z = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const now = new Date();
const today = iso(now);
const prevMonth = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
const plus = (n) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));
const enable = async (p, title) => {
  await p.click("Catalog module", "nav .nav");
  const card = `[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === ${JSON.stringify(title)})`;
  await p.until(`!!${card}`, 8000);
  const beta = await p.eval(`${card}.innerText.toLowerCase().includes('beta')`);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until(`[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith(${JSON.stringify(title)}))`, 8000);
  return beta;
};

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);

  // Business ready to invoice; the same firm in the directory and among the partners of Business.
  await enable(p, "Business");
  await biz(p, "settings_save", { firma: { firma_nume: "Noi SRL", firma_cui: "RO14399840", firma_adresa: "Iași" } });
  await biz(p, "series_save", { cod: "F" });
  await biz(p, "partner_save", { nume: "Alfa Construct SRL", cui: "RO18547290", tip: "client" });
  await invoke(p, "partner_save", {
    partner: { version: 0, tip: "client", denumire: "Alfa Construct SRL", cui: "RO18547290", nr_reg_com: "", sediu: "", localitate: "", judet: "", tara: "", telefon: "", email: "", iban: "", banca: "", reprezentant: "", functie_reprezentant: "", platitor_tva: null, note: "", puncte_lucru: [], documente: [], campuri: [], surse: {}, activ: true },
  });

  check("modulul Contracte și abonamente e în catalog, beta", await enable(p, "Contracte și abonamente"));
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Contracte și abonamente')).click()");
  await p.until("!!document.querySelector('.contracts')", 8000);

  // A contract from the page, the partner picked from the directory's suggestions.
  await setValue(p, "input[aria-label='Titlul contractului']", "Mentenanță lunară");
  await setValue(p, "input[aria-label='Numărul contractului']", "12");
  await setValue(p, "input[aria-label='Partenerul']", "Alfa");
  await p.until("!!document.querySelector('.contract-suggest button')", 8000);
  await p.eval("document.querySelector('.contract-suggest button').click()");
  await setValue(p, "input[aria-label='Începutul contractului']", prevMonth);
  await clickText(p, "Salvează contractul", ".contracts");
  await p.until("!!document.querySelector('[data-testid=contract-card]')", 8000);
  check(
    "contractul e salvat ca ciornă, cu partenerul și CUI-ul din agendă",
    await p.eval("document.querySelector('[data-testid=contract-card]').innerText.includes('CUI RO18547290') && document.querySelector('[data-testid=contract-card]').innerText.includes('ciornă')"),
  );

  // A monthly line of 1.000,00 lei, invoiced on the 1st; then the contract is activated.
  await setValue(p, "input[aria-label='Denumirea liniei']", "Abonament mentenanță");
  await setValue(p, "input[aria-label='Prețul fără TVA']", "1.000,00");
  await clickText(p, "Adaugă linia", ".contracts");
  await p.until("!!document.querySelector('[data-testid=contract-line]')", 8000);
  check("linia: 1 lună × 1.000,00 lei + TVA 21%, lunar", await p.eval("document.querySelector('[data-testid=contract-line]').innerText.includes('1 lună × 1.000,00 lei + TVA 21% · lunar')"));
  await clickText(p, "Activează", "[data-testid=contract-card]");
  await p.until("document.querySelector('[data-testid=contract-card]').innerText.includes('· activ')", 8000);
  await p.screenshot(join(shots, "01-contract.png"));

  // What is due: last month (late) and this month.
  await clickText(p, "De facturat", ".contracts");
  await p.until("document.querySelectorAll('[data-testid=due]').length === 2", 8000);
  check("de facturat: luna trecută (întârziată) și luna aceasta", await p.eval("document.querySelectorAll('[data-testid=due]')[0].innerText.includes('întârziată')"));
  await p.screenshot(join(shots, "02-de-facturat.png"));
  await p.eval("[...document.querySelectorAll('[data-testid=due]')[0].querySelectorAll('button')].find(b => b.textContent.trim() === 'Emite factura').click()");
  await p.until("document.querySelector('.contracts [role=status]')?.innerText.includes('a fost emisă')", 10000);
  const invoices = await biz(p, "invoices", {});
  const list = Array.isArray(invoices) ? invoices : (invoices.facturi ?? invoices.items ?? []);
  check(
    "„Emite factura” face factura în Business (1.210,00 lei) și scoate perioada din listă",
    JSON.stringify(list).includes("1.210,00") && (await p.eval("document.querySelectorAll('[data-testid=due]').length")) === 1,
    JSON.stringify(list).slice(0, 160),
  );

  // The other period marked by hand; then the same period again is refused.
  await setValue(p, "input[aria-label='Seria și numărul facturii']", "MAN 1");
  await clickText(p, "Marchează emisă", "[data-testid=due]");
  await p.until("document.querySelectorAll('[data-testid=due]').length === 0", 8000);
  const lines = (await con(p, "contracte", { azi: today }))[0];
  const detail = await con(p, "contract", { id: lines.id, azi: today });
  const again = await con(p, "facturare_marcheaza", { abonament: detail.linii[0].id, perioada: detail.facturari[0].perioada, stare: "emisa", factura: "X 9", data: today });
  check(
    "marcată manual; aceeași perioadă a doua oară e refuzată",
    detail.facturari.length === 2 && /deja marcată/.test(again.error ?? ""),
    JSON.stringify(again).slice(0, 120),
  );

  // A rent renewed automatically, with 15 days of notice: the calendar and the reminder.
  await con(p, "contract_save", { numar: "C-7", titlu: "Chirie depozit", parte: "furnizor", partener_nume: "Imobil Vest SRL", inceput: prevMonth, sfarsit: plus(20), prelungire_auto: true, prelungire_luni: 12, preaviz_zile: 15, stare: "activ" });
  await clickText(p, "Calendar", ".contracts");
  await p.until("document.querySelectorAll('[data-testid=cal-event]').length >= 2", 8000);
  const ev = await p.eval("[...document.querySelectorAll('[data-testid=cal-event]')].map(r => r.innerText.replace(/\\s+/g, ' '))");
  check("calendarul: ultima zi de preaviz, apoi prelungirea automată", ev[0].includes("ultima zi de preaviz") && ev[1].includes("se prelungește automat"), ev.slice(0, 2).join(" | "));
  await p.screenshot(join(shots, "03-calendar.png"));
  await invoke(p, "reminders_tick", { azi: today });
  await invoke(p, "reminders_tick", { azi: today });
  const bell = (await invoke(p, "notifications_list", {})).items.filter((n) => n.module === "kgb.contracts");
  check(
    "memento „Ultima zi de preaviz …”, o singură dată, fără numele partenerului",
    bell.length === 1 && bell[0].titlu.startsWith("Ultima zi de preaviz") && !JSON.stringify(bell).includes("Imobil") && !JSON.stringify(bell).includes("Alfa"),
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
