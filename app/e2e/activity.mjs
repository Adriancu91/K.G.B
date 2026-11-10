// 7.4n, end to end in the real window: profiles by kind of activity. In the Catalog the person picks „Comerț”; the
// window lists the modules that fit, with what they ask for; one is unticked; only the ticked ones are enabled.
// The choice is kept (with the „Depozit” work profile) and „Documente și modele” shows the trade models first.
//
// Usage: node app/e2e/activity.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node activity.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-activity-"));
const PORT = 9353;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  const nav = () => p.eval("[...document.querySelectorAll('nav .nav')].map(b => b.textContent.trim())");
  const before = await nav();
  check("la început niciun modul de lucru nu e activat", !before.some((l) => /Business|Documente și modele/.test(l)), before.join(", "));

  await p.click("Catalog module", "nav .nav");
  await p.click("Alege după tipul de activitate", "button");
  await p.until("!!document.querySelector('[role=radiogroup][aria-label=\"Tipul de activitate\"]')", 10000);
  const kinds = await p.eval("[...document.querySelectorAll('.activity strong')].map(e => e.textContent)");
  check("fereastra arată tipurile de activitate", kinds.includes("Comerț") && kinds.includes("Construcții") && kinds.length >= 8, kinds.join(", "));
  await p.click("Comerț", ".activity");
  await p.until("!!document.querySelector('.activity-modules')", 5000);
  const mods = await p.eval("[...document.querySelectorAll('.activity-modules li')].map(li => li.innerText.replace(/\\s+/g, ' '))");
  check("modulele propuse pentru comerț, cu ce cer", mods.some((m) => m.includes("Business")) && mods.some((m) => m.includes("Cere:")), mods.slice(0, 3).join(" | "));
  // One module left out.
  await p.eval("document.querySelector(\".activity-modules input[aria-label='Calculator și conversii']\").click()");
  await sleep(200);
  const btn = await p.eval("document.querySelector('.dialog .dialog-actions .primary').textContent");
  await p.screenshot(join(shots, "01-alegere.png"));
  await p.click("Activează", ".dialog .dialog-actions button");
  await p.until("!document.querySelector('.activity-list')", 30000);
  await sleep(800);
  const after = await nav();
  check("modulele bifate sunt activate", ["Business", "Documente și modele", "Documente PDF", "Foi de calcul", "Extragere date", "Planificator"].every((n) => after.some((l) => l.includes(n))), `${btn} → ${after.join(", ")}`);
  check("cel debifat a rămas dezactivat", !after.some((l) => l.includes("Calculator")), after.join(", "));
  const line = await p.eval("document.querySelector('section')?.innerText ?? ''");
  check("Catalogul spune activitatea aleasă", line.includes("Activitatea firmei: Comerț"));
  const st = await p.eval("window.__TAURI_INTERNALS__.invoke('get_settings')");
  check("alegerea e păstrată în setări, cu profilul Depozit", st.settings.activitate === "comert" && st.settings.profile === "depozit", `${st.settings.activitate} / ${st.settings.profile}`);
  check("profilul arătat sub nume e Depozit", (await p.eval("document.querySelector('.profile')?.textContent ?? ''")).includes("Depozit"));

  // Documente și modele: the models of the activity first.
  await p.click("Documente și modele", "nav .nav");
  await p.until("!!document.querySelector('[data-testid=docs-recommended]')", 15000);
  const rec = await p.eval("document.querySelector('[data-testid=docs-recommended]').innerText");
  check("„Documente și modele” arată întâi modelele pentru comerț", rec.includes("Comerț") && /NIR|Notă de intrare/i.test(rec) && rec.includes("Ofertă"), rec);
  await p.screenshot(join(shots, "02-modele-recomandate.png"));
  p.close();
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
