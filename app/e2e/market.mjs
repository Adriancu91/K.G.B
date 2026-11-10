// 7.6 (D-087), end to end in the real window: „Piață” — a symbol added from the page, a quote typed in, a CSV
// of history imported (with its report), the chart on a real time axis, an alert that gives exactly one notice
// in the bell, the warning that this is a record and not investment advice. Nothing goes to the internet.
//
// Usage: node app/e2e/market.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node market.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-market-"));
const PORT = 9350;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clickText = (p, text, scope = "") =>
  p.eval(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); b?.click(); return !!b; })()`);

const csv = join(data, "tlv-istoric.csv");
// A year of history (every weekday), all above the alert's level: still only one notice, for the last quote.
const rows = ["Data;Pret;Sursa"];
for (let d = new Date(Date.UTC(2025, 10, 10)); d < Date.UTC(2026, 10, 7); d = new Date(d.getTime() + 86_400_000)) {
  if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
  const p = 25 + ((d.getTime() / 86_400_000) % 30) / 10;
  rows.push(`${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()};${p.toFixed(2).replace(".", ",")};BVB`);
}
rows.push("aici nu e o data;1;BVB");
writeFileSync(csv, rows.join("\r\n"));

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Piață')";
  check("modulul Piață e în catalog, beta", await p.eval(`${card}?.innerText.toLowerCase().includes('beta') ?? false`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Piață'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Piață')).click()");
  await p.until("!!document.querySelector('.market')", 8000);
  check("sus scrie că e evidență, nu sfaturi de investiții", (await p.eval("document.querySelector('.market .warn')?.innerText ?? ''")).includes("nu sfaturi de investiții"));

  // A symbol from the page's form.
  await setValue(p, "input[aria-label='Simbolul']", "tlv");
  await setValue(p, "input[aria-label='Numele']", "Banca Transilvania");
  await clickText(p, "Adaugă în listă", ".market");
  await p.until("!!document.querySelector('.market-list') && document.querySelector('.market-list').innerText.includes('TLV')", 8000);
  check("simbolul apare în listă (scris cu majuscule)", true);

  // The history from CSV (through the core, as the dialog would hand it), then a quote typed in.
  const list = await invoke(p, "module_call", { id: "kgb.market", command: "list", args: {} });
  const id = list[0].id;
  const rep = await invoke(p, "module_import_file_with", { id: "kgb.market", path: csv, command: "import_csv", args: { instrument: id } });
  check("importul CSV aduce istoricul și refuză rândul greșit", rep.adaugate > 250 && rep.refuzate.length === 1 && rep.separator === "„;”", `${rep.adaugate} adăugate, ${rep.refuzate.length} refuzate`);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Acasă')).click()");
  await sleep(300);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Piață')).click()");
  await p.until("!!document.querySelector('.market-detail')", 8000);
  await setValue(p, "input[aria-label='Momentul cotației']", "2026-11-10T14:30");
  await setValue(p, "input[aria-label='Prețul']", "31,20");
  await setValue(p, "input[aria-label='Sursa cotației']", "telefon de la broker");
  await clickText(p, "Adaugă cotația", ".market");
  await p.until("document.querySelector('.market [role=status]')?.innerText.includes('31,20')", 8000);
  const row = await p.eval("document.querySelector('.market-list tbody tr').innerText");
  check("ultima cotație, cu sursa și ora ei", row.includes("31,20") && row.includes("telefon de la broker") && row.includes("10.11.2026 14:30"), row.replace(/\s+/g, " "));

  // The chart, on a real time axis: „Tot” shows the whole year.
  await clickText(p, "Tot", ".market-detail");
  await p.until("!!document.querySelector('.market-chart path')", 8000);
  const points = await p.eval("document.querySelectorAll('.market-chart circle').length");
  check("graficul are toate cotațiile (axa de timp reală)", points > 250, `${points} puncte`);

  // An alert: exactly one notice for the last quote, even with a year of history above the level.
  await setValue(p, "select[aria-label='Direcția alertei']", "peste");
  await setValue(p, "input[aria-label='Pragul alertei']", "20");
  await clickText(p, "Adaugă alerta", ".market");
  await p.until("document.querySelector('.market-list tbody tr').innerText.includes('peste 20')", 8000);
  const azi = new Date().toLocaleDateString("sv-SE");
  await invoke(p, "reminders_tick", { azi });
  await invoke(p, "reminders_tick", { azi });
  const bell = (await invoke(p, "notifications_list", {})).items.filter((n) => n.module === "kgb.market");
  check("alerta dă o singură notificare, pentru ultima cotație", bell.length === 1 && bell[0].titlu === "TLV: 31,20 peste 20,00" && bell[0].text.includes("nu sfat de investiții"), JSON.stringify(bell.map((b) => b.titlu)));
  await p.screenshot(join(shots, "01-piata.png"));
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
