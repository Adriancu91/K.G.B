// 7.4n, end to end in the real window: profiles by kind of activity. In the Catalog the person picks „Comerț”; the
// window lists the modules that fit, with what they ask for; one is unticked; only the ticked ones are enabled.
// 7.9c: „Permise și autorizații” being among them, the procedures of the catalog for commerce are then proposed
// (the construction ones unticked) and only the ticked ones are added. The choice is kept (with the „Depozit” work
// profile) and „Documente și modele” shows the trade models first.
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
  // 7.9c: „Permise și autorizații” is now on, so the procedures of the catalog for commerce are proposed.
  await p.until("!!document.querySelector('#act-procs-title')", 30000);
  const procs = await p.eval("[...document.querySelectorAll('.activity-procs li')].map(li => ({ t: li.querySelector('b').textContent, on: li.querySelector('input').checked }))");
  const on = procs.filter((x) => x.on).map((x) => x.t);
  check(
    "apoi propune avizele pentru comerț: ISU, sanitar-veterinar, acordul de funcționare bifate",
    on.some((t) => t.startsWith("Autorizație de securitate la incendiu")) && on.some((t) => t.includes("sanitar-veterinară")) && on.some((t) => t.startsWith("Acordul / autorizația de funcționare")),
    on.join(" | "),
  );
  const buildOff = procs.filter((x) => /construire|urbanism/i.test(x.t));
  check("cele de construcții sunt arătate, dar nebifate", buildOff.length >= 2 && buildOff.every((x) => !x.on), buildOff.map((x) => `${x.t}:${x.on}`).join(" | "));
  await p.screenshot(join(shots, "01b-proceduri.png"));
  await p.click("Adaugă", ".dialog .dialog-actions button");
  await p.until("!document.querySelector('#act-procs-title')", 30000);
  const added = await p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", { id: "kgb.permits", command: "proceduri", args: { azi: "2026-11-11" } })`);
  check("se adaugă exact cele bifate, ca proceduri ale firmei", added.length === on.length && added.every((x) => on.includes(x.titlu)), `${added.length} din ${on.length}`);
  await p.until("!document.querySelector('.activity-list')", 30000);
  await sleep(800);
  const after = await nav();
  check("modulele bifate sunt activate", ["Business", "Documente și modele", "Documente PDF", "Foi de calcul", "Extragere date", "Permise", "Planificator"].every((n) => after.some((l) => l.includes(n))), `${btn} → ${after.join(", ")}`);
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
