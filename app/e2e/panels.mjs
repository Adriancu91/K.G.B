// Etapa 7 step 7.4e, end to end in the real window: the new start-page panels.
// - "Curs BNR" and "Vremea" say their source is switched off and lead to
//   „Surse externe”; once the owner switches them on, ONE real request each
//   shows EUR/RON, USD/RON with the day of the rate and the BNR credit, and
//   today's weather in the chosen town with the MET Norway credit;
// - "Alertă" shows the most important unread notification; "Am văzut" clears it;
// - "Ce se aude acum" shows the player in Windows' media controls, or says
//   nothing is playing (whatever is true on this PC; the test plays nothing).
// No screenshot shows anything but test data and public rates/weather.
//
// Usage: node app/e2e/panels.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node panels.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-panels-"));
const PORT = 9354;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const panel = (p, id) => p.eval(`document.querySelector(".panel[data-panel='${id}']")?.innerText ?? ""`);
const activate = async (p, name) => {
  await p.click("Surse externe", "nav .nav");
  const row = `[...document.querySelectorAll('.sources-table tbody tr')].find(r => r.innerText.includes(${JSON.stringify(name)}))`;
  await p.until(`!!${row}`, 5000);
  await p.eval(`[...${row}.querySelectorAll('button')].find(b => b.innerText === 'activează').click()`);
  await p.until(`${row}.innerText.includes('activă')`, 5000);
};
const home = async (p) => {
  await p.click("Acasă", "nav .nav");
  await p.until("document.querySelectorAll('.panel.free').length > 0", 5000);
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

try {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1100, deviceScaleFactor: 1, mobile: false });
  await p.until("!!document.querySelector(\".panel[data-panel='curs']\")", 15000);

  // The sources are added when „Surse externe” is first opened by the owner.
  await p.click("Surse externe", "nav .nav");
  await p.until("document.querySelectorAll('.sources-table tbody tr').length === 3", 5000);
  const rows = await p.eval("[...document.querySelectorAll('.sources-table tbody tr')].map(r => r.innerText.split('\\n')[0] + ' — ' + (r.innerText.includes('oprită') ? 'oprită' : 'activă')).join(' | ')");
  check("ANAF, BNR și MET Norway sunt în „Surse externe”, toate oprite", rows.split("oprită").length === 4, rows);

  await home(p);
  await p.until("document.querySelector(\".panel[data-panel='curs']\").innerText.includes('oprită')", 8000);
  check("cât e oprită, „Curs BNR” spune asta și duce la „Surse externe”", (await panel(p, "curs")).includes("Deschide „Surse externe”"));

  await activate(p, "BNR");
  await home(p);
  await p.until("/EUR\\/RON\\s+\\d+,\\d{4}/.test(document.querySelector(\".panel[data-panel='curs']\").innerText)", 20000);
  const fx = await panel(p, "curs");
  check("cu sursa pornită: EUR/RON și USD/RON, cu data cursului și sursa", /USD\/RON\s+\d+,\d{4}/.test(fx) && /Cursul din \d\d\.\d\d\.\d{4}/.test(fx) && fx.includes("Banca Națională a României"), fx.replace(/\n/g, " "));

  // Weather: choose a town, source off, then on.
  await p.eval(`(() => { const s = document.querySelector("select[aria-label='Orașul pentru vreme']");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'bucuresti'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await p.until("document.querySelector(\".panel[data-panel='vreme']\").innerText.includes('oprită')", 8000);
  check("vremea: orașul se alege; cu sursa oprită spune asta", (await panel(p, "vreme")).includes("termenii"));
  await activate(p, "MET Norway");
  await home(p);
  await p.until("document.querySelector(\".panel[data-panel='vreme']\").innerText.includes('°C')", 20000);
  const wx = await panel(p, "vreme");
  check("cu sursa pornită: temperatura acum, minima și maxima de azi, sursa", /Azi între .*°C și .*°C/.test(wx) && wx.includes("MET Norway"), wx.replace(/\n/g, " ").slice(0, 120));
  check("orașul ales rămâne în setări", (await p.eval("document.querySelector(\"select[aria-label='Orașul pentru vreme']\").value")) === "bucuresti");

  // Alert: a partner document that expires today makes a notification.
  await p.eval(`window.__TAURI_INTERNALS__.invoke("partner_save", { partner: { version: 0, tip: "ambele", denumire: "Firma Test SRL", cui: "", nr_reg_com: "", sediu: "", localitate: "", judet: "", tara: "", telefon: "", email: "", iban: "", banca: "", reprezentant: "", functie_reprezentant: "", platitor_tva: null, note: "", puncte_lucru: [], campuri: [], surse: {}, activ: true,
    documente: [{ tip: "Licență de test", numar: "T-1", emis: "", expira: "${iso(new Date())}", nota: "" }] } })`);
  await p.eval(`window.__TAURI_INTERNALS__.invoke("reminders_tick", { azi: "${iso(new Date())}" })`);
  await p.click("Parteneri", "nav .nav");
  await home(p);
  await p.until("document.querySelector(\".panel[data-panel='alerta']\") || false", 2000).catch(() => {});
  if (!(await p.eval("!!document.querySelector(\".panel[data-panel='alerta']\")"))) await p.click("+ Alertă", ".cc-actions button");
  await p.until("document.querySelector(\".panel[data-panel='alerta']\").innerText.includes('Licență de test')", 8000);
  check("„Alertă” arată notificarea cea mai importantă", true);
  await p.eval(`[...document.querySelectorAll(".panel[data-panel='alerta'] button")].find(b => b.innerText === 'Am văzut').click()`);
  await p.until("!document.querySelector(\".panel[data-panel='alerta']\").innerText.includes('Licență de test')", 8000);
  check("„Am văzut” o scoate", true);

  // Media: whatever Windows says is true on this PC.
  await p.until("!document.querySelector(\".panel[data-panel='media']\").innerText.includes('Se încarcă')", 10000);
  const media = await panel(p, "media");
  check("„Ce se aude acum” răspunde (un player sau „nu cântă nimic”)", media.includes("Nu cântă nimic") || (await p.eval("!!document.querySelector(\".panel[data-panel='media'] button[aria-label='Melodia următoare']\")")), media.split("\n")[1] ?? "");
  // Screenshot only when nothing is playing (a real title would be personal).
  if (media.includes("Nu cântă nimic")) {
    await p.eval("document.querySelector('main').scrollTop = 0");
    await p.screenshot(join(shots, "01-panouri.png"));
  }

  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
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
