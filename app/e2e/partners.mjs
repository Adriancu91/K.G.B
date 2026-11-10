// Etapa 7 step 7.4a, end to end in the real window: the partner directory.
// A new card with a work point, a document that expires soon and an extra
// field; a wrong CUI is refused; search ignores diacritics; the expiring
// document shows in the warning list; a forced restart keeps everything.
//
// Usage: node app/e2e/partners.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node partners.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-partners-"));
const PORT = 9351;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const setValue = (p, sel, value) =>
  p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const pageText = (p) => p.eval("document.querySelector('main').innerText");
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const z = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Parteneri", "nav .nav");
  await p.until("!!document.querySelector('.partners-page')");
  return p;
}
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}

try {
  let p = await start();
  check("la început agenda e goală", (await pageText(p)).includes("Niciun partener încă"));
  await p.click("Partener nou");
  await p.until("!!document.querySelector('.partner-editor')");
  await setValue(p, "input[aria-label='Denumire']", "Transport Ștefănescu SRL");
  await setValue(p, "input[aria-label='CUI']", "RO14399841");
  await setValue(p, "input[aria-label='Localitate']", "Cluj-Napoca");
  await p.click("+ punct de lucru");
  await setValue(p, "input[aria-label='Punctul de lucru 1']", "Depozit Turda");
  await p.click("+ document");
  await setValue(p, "input[aria-label='Tipul documentului 1']", "Licență de transport");
  await setValue(p, "input[aria-label='Numărul documentului 1']", "LT-1234");
  await setValue(p, "input[aria-label='Expiră 1']", inDays(10));
  await p.click("+ câmp");
  await setValue(p, "input[aria-label='Numele câmpului 1']", "Cod client intern");
  await setValue(p, "input[aria-label='Valoarea câmpului 1']", "C-0042");
  await p.click("Salvează fișa");
  await p.until("!!document.querySelector('.partner-editor .error')", 5000);
  const err = await p.eval("document.querySelector('.partner-editor .error').innerText");
  check("un CUI greșit e refuzat", err.includes("cifra de control"), err);

  // 7.4m-2: the CUI with spaces is accepted and stored without them; a wrong IBAN is warned about, not refused.
  await setValue(p, "input[aria-label='CUI']", "RO 1439 9840");
  await setValue(p, "input[aria-label='IBAN']", "RO49 AAAA 1B31 0075 9384 0001");
  const ibanWarn = await p
    .until("(document.querySelector('.partner-editor .warn')?.innerText ?? '').includes('IBAN-ul pare greșit')", 5000)
    .then(() => true, () => false);
  check("un IBAN greșit primește avertizare în fișă", ibanWarn);
  await p.click("Salvează fișa");
  await p.until("!!document.querySelector('.partners-table')", 5000);
  check("fișa apare în listă", (await pageText(p)).includes("Transport Ștefănescu SRL"));
  check("CUI-ul scris cu spații e păstrat fără ele, iar fișa cu IBAN greșit se salvează", (await pageText(p)).includes("RO14399840"));
  const warn = await p.eval("document.querySelector('.partners-page .warn')?.innerText ?? ''");
  check("documentul care expiră apare în avertizare", warn.includes("Licență de transport") && warn.includes("în 10 zile"), warn);

  await setValue(p, "input[aria-label='Caută partener']", "stefan");
  await p.until("document.querySelectorAll('.partners-table tbody tr').length === 1", 5000);
  check("căutarea fără diacritice găsește fișa", true);
  await setValue(p, "input[aria-label='Caută partener']", "zzz");
  await p.until("document.querySelector('.partners-page').innerText.includes('Nimic găsit')", 5000);
  check("o căutare fără rezultat spune asta", true);
  await setValue(p, "input[aria-label='Caută partener']", "");
  await p.until("!!document.querySelector('.partners-table')", 5000);
  await p.screenshot(join(shots, "01-parteneri.png"));

  stop(p);
  p = await start();
  await p.until("!!document.querySelector('.partners-table')", 5000);
  await p.eval("document.querySelector('.partners-table tbody tr').click()");
  await p.until("!!document.querySelector('.partner-editor')");
  const kept = await p.eval(`[document.querySelector("input[aria-label='Punctul de lucru 1']")?.value, document.querySelector("input[aria-label='Numărul documentului 1']")?.value, document.querySelector("input[aria-label='Valoarea câmpului 1']")?.value].join('|')`);
  check("după repornire (forțată) fișa are tot: punct de lucru, document, câmp", kept === "Depozit Turda|LT-1234|C-0042", kept);
  await p.screenshot(join(shots, "02-fisa.png"));
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
