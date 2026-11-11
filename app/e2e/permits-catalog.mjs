// 7.9a, end to end in the real window: the catalog of procedures from official sources (D-088). In „Permise și
// autorizații” › Proceduri › „Din catalog…” the 19 procedures are listed with their institution and the day their
// sources were checked; a search finds the ISU ones; the fire-safety approval is added (it becomes the firm's, with
// its documents, steps and dated official sources) and a case file opened on it has its checklist.
//
// Usage: node app/e2e/permits-catalog.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node permits-catalog.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-permcat-"));
const PORT = 9357;
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
  const call = (command, args = {}) => p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.permits", command, args })})`);

  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Permise și autorizații')";
  await p.until(`!!${card}`, 10000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Permise'))", 10000);
  await p.click("Permise", "nav .nav");
  await p.click("Proceduri", ".sheet-tabs button");
  await p.click("Din catalog", "button");
  await p.until("document.querySelectorAll('.catalog-list li').length > 0", 10000);
  const n = await p.eval("document.querySelectorAll('.catalog-list li').length");
  check("catalogul arată cele 19 proceduri", n === 19, `${n}`);
  const first = await p.eval("document.querySelector('.catalog-list li').innerText");
  check("fiecare cu instituția și data verificării surselor", /surse verificate la 2026-11-10/.test(first), first.replace(/\s+/g, " ").slice(0, 160));
  await p.fill("input[aria-label='Caută în catalog']", "ISU");
  await sleep(300);
  const isu = await p.eval("[...document.querySelectorAll('.catalog-list li strong')].map(e => e.innerText)");
  check("căutarea „ISU” găsește avizul și autorizația ISU", isu.some((t) => t.startsWith("Aviz de securitate la incendiu")) && isu.some((t) => t.startsWith("Autorizație de securitate la incendiu")), JSON.stringify(isu));
  await p.eval("[...document.querySelectorAll('.catalog-list li')].find(li => li.innerText.includes('Aviz de securitate la incendiu')).querySelector('button.link').click()");
  await sleep(200);
  const det = await p.eval("[...document.querySelectorAll('.catalog-list li')].find(li => li.innerText.includes('Aviz de securitate la incendiu')).innerText");
  check("detaliile arată sursele oficiale", det.includes("legislatie.just.ro") && det.includes("Legea 307/2006"), det.replace(/\s+/g, " ").slice(0, 200));
  await p.screenshot(join(shots, "01-catalog.png"));
  await p.eval("[...document.querySelectorAll('.catalog-list li')].find(li => li.innerText.includes('Aviz de securitate la incendiu')).querySelector('button.primary').click()");
  await p.until("[...document.querySelectorAll('.catalog-list li')].find(li => li.innerText.includes('Aviz de securitate la incendiu'))?.innerText.includes('adăugată')", 10000);
  check("după „Adaugă” procedura apare ca adăugată", true);
  await p.click("Închide", ".dialog button");

  const procs = await call("proceduri", { azi: "2026-11-10" });
  const isuP = procs.find((x) => x.titlu.startsWith("Aviz de securitate la incendiu"));
  check(
    "procedura e a firmei: documente, pași, surse datate, temeiul legal",
    !!isuP && isuP.documente.length >= 6 && isuP.pasi.length >= 4 && isuP.surse.length >= 2 && isuP.surse.every((s) => s.verificat === "2026-11-10") && isuP.descriere.includes("Temei legal"),
    isuP ? `${isuP.documente.length} documente, ${isuP.pasi.length} pași, ${isuP.surse.length} surse` : "lipsește",
  );
  check("e verificată (nu „fără sursă”)", isuP?.stare_verificare === "verificata", isuP?.stare_verificare);

  // A case file on it: the checklist has its documents.
  await p.click("Dosare", ".sheet-tabs button");
  await p.fill("input[aria-label='Titlul dosarului']", "Aviz ISU – depozit nou");
  await p.eval(`(() => { const s = document.querySelector("select[aria-label='Procedura dosarului']"); s.value = ${JSON.stringify(isuP?.id ?? "")}; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await p.click("Deschide dosarul", "form[aria-label='Dosar nou'] button");
  await p.until("document.querySelectorAll('.checklist li').length > 0", 10000);
  const items = await p.eval("document.querySelectorAll('.checklist li').length");
  check("dosarul are lista de verificare din procedură", items >= 10, `${items} puncte`);
  await p.screenshot(join(shots, "02-dosar.png"));

  // 7.9b: „Exportă dosarul…” — one attached document, then the folder (the page takes the test folder instead of
  // opening the system's folder dialog, which a test can't drive).
  const cases = await call("dosare", { azi: "2026-11-10" });
  const cs = cases[0];
  const scan = join(data, "plan-de-situatie.pdf");
  writeFileSync(scan, "%PDF-1.4\n% plan de test\n");
  await p.eval(`window.__TAURI_INTERNALS__.invoke("module_import_file_with", ${JSON.stringify({ id: "kgb.permits", path: scan, command: "dosar_fisier", args: { id: cs.id, version: cs.version } })})`);
  const out = join(data, "export");
  mkdirSync(out);
  await p.eval(`window.__kgbE2eFolder = ${JSON.stringify(out)}; true`);
  await p.click("Dosare", ".sheet-tabs button");
  await p.click("Permise", "nav .nav");
  await p.until("[...document.querySelectorAll('button')].some(b => b.innerText.includes('Aviz ISU'))", 10000).catch(() => {});
  await p.eval("[...document.querySelectorAll('button, td, li')].find(e => e.innerText?.trim().startsWith('Aviz ISU – depozit nou'))?.click()");
  await p.until("!!document.querySelector('button[aria-label=\"Exportă dosarul\"]')", 10000);
  await p.eval("document.querySelector('button[aria-label=\"Exportă dosarul\"]').click()");
  await p.until("!!document.querySelector('.export-done')", 20000);
  const dir = join(out, "Aviz ISU – depozit nou");
  const files = existsSync(dir) ? readdirSync(dir) : [];
  check("„Exportă dosarul” face folderul cu opisul, adresa de înaintare și documentul atașat", files.includes("00 Opis.pdf") && files.includes("00 Adresa de inaintare.pdf") && files.includes("01 plan-de-situatie.pdf"), JSON.stringify(files));
  const opis = files.includes("00 Opis.pdf") ? readFileSync(join(dir, "00 Opis.pdf")) : Buffer.alloc(0);
  check("opisul e un PDF", opis.subarray(0, 5).toString() === "%PDF-", `${opis.length} octeți`);
  await p.screenshot(join(shots, "03-export.png"));
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
