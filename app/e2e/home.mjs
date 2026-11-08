// Etapa 7 step 7.4d (after Etapa 4 step 4.10), end to end in the real
// window, with real mouse movements: the start page as a control centre.
// - band, quick actions and the money-first panels for the owner;
// - a panel moved with the mouse by its title and resized from its corner
//   and its right edge stays where it was put, also after a forced restart;
// - in a narrower window every panel stays inside the page; in a very narrow
//   one they are stacked;
// - "De rezolvat" shows a partner document that expires soon; "amână o zi"
//   takes it off the list, also after a restart;
// - any page can be pinned to the start page and opened from there;
// - a hidden panel comes back; "Revino la implicit" restores the start page.
//
// Usage: node app/e2e/home.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node home.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-home-"));
const PORT = 9343;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const ids = (p) => p.eval("[...document.querySelectorAll('.panel.free')].map(e => e.dataset.panel).join(' ')");
const box = (p, id) =>
  p.eval(`(() => { const e = document.querySelector(".panel[data-panel='${id}']"); e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
const rel = (p, id) =>
  p.eval(`(() => { const e = document.querySelector(".panel[data-panel='${id}']"); return { l: Math.round(parseFloat(e.style.left)), t: Math.round(parseFloat(e.style.top)), w: Math.round(parseFloat(e.style.width)), h: Math.round(parseFloat(e.style.height)) }; })()`);
const near = (a, b, tol = 4) => Math.abs(a - b) <= tol;

/** A real mouse drag (pressed, moved in steps, released). */
async function drag(p, x0, y0, dx, dy) {
  const m = (type, x, y, extra = {}) => p.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, ...extra });
  await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0 });
  await m("mousePressed", x0, y0, { clickCount: 1 });
  for (let i = 1; i <= 8; i++) await m("mouseMoved", x0 + (dx * i) / 8, y0 + (dy * i) / 8);
  await m("mouseReleased", x0 + dx, y0 + dy, { clickCount: 1 });
  await sleep(500);
}
async function scrollToTop(p) {
  await p.eval("document.querySelector('main').scrollTop = 0; window.scrollTo(0, 0)");
}

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await p.until("document.querySelectorAll('.panel.free').length > 0", 15000);
  return p;
}
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}

try {
  let p = await start();
  // A partner document that expires in 3 days, for "De rezolvat".
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const z = (n) => String(n).padStart(2, "0");
  await p.eval(`window.__TAURI_INTERNALS__.invoke("partner_save", { partner: { version: 0, tip: "ambele", denumire: "Eco Test SRL", cui: "", nr_reg_com: "", sediu: "", localitate: "", judet: "", tara: "", telefon: "", email: "", iban: "", banca: "", reprezentant: "", functie_reprezentant: "", platitor_tva: null, note: "", puncte_lucru: [], campuri: [], surse: {}, activ: true,
    documente: [{ tip: "Autorizație de mediu", numar: "AM-7", emis: "", expira: "${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}", nota: "" }] } })`);
  await p.click("Parteneri", "nav .nav");
  await p.click("Acasă", "nav .nav");
  await p.until("document.querySelector(\".panel[data-panel='rezolvat']\")?.innerText.includes('Autorizație de mediu')", 8000);

  const first = await ids(p);
  check("pornirea pentru proprietar: întâi banii", first === "bani cifre rezolvat azi notificari documente", first);
  const band = await p.eval("document.querySelector('.cc-band').innerText");
  check("banda de sus: salut, data, spațiul de lucru, ce e urgent", band.includes("Proprietar") && /\d{4}/.test(band) && band.includes("acte expiră în 7 zile"), band.replace(/\n/g, " "));
  const acts = await p.eval("document.querySelector('.cc-actions').innerText");
  check("bara de acțiuni rapide", acts.includes("+ Partener") && acts.includes("Revino la implicit"), acts.replace(/\n/g, " ").slice(0, 80));
  const todo = await p.eval("document.querySelector(\".panel[data-panel='rezolvat']\").innerText");
  check("„De rezolvat” arată actul care expiră, cu termenul scris", todo.includes("Autorizație de mediu nr. AM-7") && todo.includes("în 3 zile"), todo.split("\n").slice(0, 3).join(" | "));
  await scrollToTop(p);
  await p.screenshot(join(shots, "01-centru.png"));

  // Move "notificari" by its title, with the mouse.
  const before = await rel(p, "notificari");
  let b = await box(p, "notificari");
  const h3 = await p.eval(`(() => { const r = document.querySelector(".panel[data-panel='notificari'] header h3").getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  await drag(p, h3.x, h3.y, 180, -90);
  const moved = await rel(p, "notificari");
  check("panoul se mută cu mouse-ul, oriunde (nu pe grilă)", near(moved.l, before.l + 180) && near(moved.t, before.t - 90), `${JSON.stringify(before)} → ${JSON.stringify(moved)}`);
  check("panoul atins vine deasupra celorlalte", (await ids(p)).endsWith("notificari"));

  // Resize "documente" from the corner, then from the right edge.
  const r0 = await rel(p, "documente");
  b = await box(p, "documente");
  await drag(p, b.x + b.w - 5, b.y + b.h - 5, -120, 70);
  const r1 = await rel(p, "documente");
  check("colțul îl redimensionează în ambele direcții", near(r1.w, r0.w - 120) && near(r1.h, r0.h + 70), `${JSON.stringify(r0)} → ${JSON.stringify(r1)}`);
  b = await box(p, "documente");
  await drag(p, b.x + b.w - 3, b.y + 40, 60, 0);
  const r2 = await rel(p, "documente");
  check("marginea din dreapta schimbă doar lățimea", near(r2.w, r1.w + 60) && near(r2.h, r1.h), `${JSON.stringify(r1)} → ${JSON.stringify(r2)}`);
  // A panel cannot be dragged out of the page.
  b = await box(p, "cifre");
  await drag(p, b.x + 40, b.y + 14, 2000, 0);
  const cw = await p.eval("document.querySelector('.cc-canvas').clientWidth");
  const c = await rel(p, "cifre");
  check("un panou nu poate fi scos din pagină", c.l + c.w <= cw + 1, `${c.l}+${c.w} ≤ ${cw}`);
  await scrollToTop(p);
  await p.screenshot(join(shots, "02-mutat.png"));

  // "amână o zi" on the expiring document.
  await p.eval(`[...document.querySelectorAll(".panel[data-panel='rezolvat'] li")].find(l => l.innerText.includes('AM-7')).querySelector('button[title="Nu-l mai arăta până mâine"]').click()`);
  await p.until("!document.querySelector(\".panel[data-panel='rezolvat']\").innerText.includes('AM-7')", 5000);
  check("„amână o zi” îl scoate din listă", true);

  // Pin a page.
  await p.click("Parteneri", "nav .nav");
  await p.click("Fixează pe Acasă", ".page-head button");
  await p.click("Acasă", "nav .nav");
  await p.until("!!document.querySelector(\".panel[data-panel='fix:partners']\")", 5000);
  await p.click("Deschide „Parteneri”", ".panel button");
  await p.until("!!document.querySelector('.partners-page')", 5000);
  check("o pagină fixată pe Acasă se deschide de acolo", true);
  await p.click("Acasă", "nav .nav");
  await p.until("document.querySelectorAll('.panel.free').length === 7", 5000);

  // Everything is kept after a forced restart.
  const kept = { n: await rel(p, "notificari"), d: await rel(p, "documente") };
  stop(p);
  p = await start();
  await p.until("document.querySelectorAll('.panel.free').length === 7", 8000);
  const after = { n: await rel(p, "notificari"), d: await rel(p, "documente") };
  check("după repornire (forțată) pozițiile și mărimile sunt aceleași", JSON.stringify(after) === JSON.stringify(kept), JSON.stringify(after));
  check("după repornire elementul amânat rămâne ascuns", !(await p.eval("document.querySelector(\".panel[data-panel='rezolvat']\").innerText")).includes("AM-7"));

  // A narrower window: everything stays inside; very narrow: stacked.
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(600);
  const inside = await p.eval(`(() => { const c = document.querySelector('.cc-canvas'); const cr = c.getBoundingClientRect();
    return [...c.querySelectorAll('.panel.free')].every(e => { const r = e.getBoundingClientRect(); return r.left >= cr.left - 1 && r.right <= cr.right + 1; }); })()`);
  check("într-o fereastră mai îngustă toate panourile rămân în pagină", inside);
  await scrollToTop(p);
  await p.screenshot(join(shots, "03-ingust.png"));
  await p.send("Emulation.setDeviceMetricsOverride", { width: 640, height: 900, deviceScaleFactor: 1, mobile: false });
  await p.until("!!document.querySelector('.cc-canvas.narrow')", 5000);
  check("într-o fereastră foarte îngustă panourile se așază unul sub altul", true);
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await p.until("!document.querySelector('.cc-canvas.narrow')", 5000);

  // Hide, bring back, back to the default.
  await p.eval(`document.querySelector(".panel[data-panel='notificari'] button[aria-label^='Ascunde']").click()`);
  await p.until("!document.querySelector(\".panel[data-panel='notificari']\")", 5000);
  check("un panou ascuns se poate aduce înapoi", await p.eval("[...document.querySelectorAll('.cc-actions button')].some(b => b.innerText === '+ Notificări necitite')"));
  await p.click("Revino la implicit", ".cc-actions button");
  await p.until("[...document.querySelectorAll('.panel.free')].map(e => e.dataset.panel).join(' ') === 'bani cifre rezolvat azi notificari documente'", 5000);
  check("„Revino la implicit” aduce pornirea pentru rolul tău", true);
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
