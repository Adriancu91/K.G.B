// D-086, end to end in the real window: „Din web…” of the spreadsheet window reads a page through the core
// (net_fetch), only after the person allows the site; with Settings › Internet off nothing goes out.
// The "internet" is a small server of this test on 127.0.0.1, reachable only because the app is started with
// KGB_TEST_NET_LOOPBACK=1 in its environment (never from a page); nothing leaves the PC.
//
// Usage: node app/e2e/cos-web.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-web.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-web-"));
const PORT = 9348;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// The page "on the internet": a price list with a table.
const seen = [];
const site = createServer((req, res) => {
  seen.push({ method: req.method, url: req.url, cookie: req.headers.cookie ?? "", agent: req.headers["user-agent"] ?? "" });
  if (req.url === "/preturi.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<html><body><h1>Prețuri</h1><table><tr><th>Produs</th><th>Preț</th></tr><tr><td>Ciment 40 kg</td><td>32,50</td></tr><tr><td>Nisip</td><td>120,00</td></tr></table></body></html>");
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => site.listen(0, "127.0.0.1", r));
const sitePort = site.address().port;
const url = `http://127.0.0.1:${sitePort}/preturi.html`;

const go = (p, label) => p.click(label, "nav .nav");
const fr = (p, expr) =>
  p.eval(`(() => { const f = document.querySelector('.cos-frame iframe'); if (!f?.contentDocument) return null;
    return ((document, window) => (${expr}))(f.contentDocument, f.contentWindow); })()`);
const frWait = async (p, expr, timeout = 15000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fr(p, expr).catch(() => false);
    if (v) return v;
    if (Date.now() > end) return false;
    await sleep(150);
  }
};
const frButton = (p, label, scope = "") =>
  fr(p, `(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); b?.click(); return !!b; })()`);
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", KGB_TEST_NET_LOOPBACK: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await go(p, "Catalog module");
  await p.eval("[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Foi de calcul')).querySelector('button').click()");
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Foi de calcul'))", 8000);
  await go(p, "Foi de calcul");
  await p.click("Registru nou în foaia de calcul");
  await p.until("!!document.querySelector('.cos-frame iframe')", 5000);
  await frWait(p, "!!document.querySelector('.sheet-wrap')", 30000);

  // Date › Preluare date › Din web…: the address, then the person allows the site (http:// is said plainly).
  await frButton(p, "Date");
  await sleep(400);
  await fr(p, "[...document.querySelectorAll('button.ribbon-menu-item')].find(b => b.textContent.trim() === 'Din web…')?.click(), true");
  check("fereastra „Din web” se deschide", !!(await frWait(p, "!!document.querySelector('[data-testid=web-dlg]')", 8000)));
  await fr(p, `(() => { const i = document.querySelector('[data-testid=web-url]'); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(url)}); i.dispatchEvent(new window.Event('input', { bubbles: true })); return true; })()`);
  await fr(p, "document.querySelector('[data-testid=web-ok]').click(), true");
  const asked = await frWait(p, "(t => /vrea să citească de pe internet/.test(t) && /necriptată/.test(t) ? t : false)(document.body.innerText)", 8000);
  check("întâi întreabă: site-ul nou, legătură necriptată", !!asked);
  check("nimic n-a plecat înainte de răspunsul omului", seen.length === 0, `${seen.length} cereri`);
  await p.screenshot(join(shots, "01-intrebarea.png"));
  await frButton(p, "Permite");
  const tablesDlg = await frWait(p, "!!document.querySelector('[role=dialog][aria-label=\"Import tabele din document\"]')", 15000);
  check("pagina e adusă prin nucleu și are tabelul", !!tablesDlg);
  if (tablesDlg) {
    await frButton(p, "Încarcă", '[role=dialog][aria-label="Import tabele din document"]');
    const got = await frWait(p, "/Ciment 40 kg/.test(document.querySelector('.sheet-wrap')?.innerText ?? '') && /(^|\\s)32,5(\\s|$)/.test(document.querySelector('.sheet-wrap')?.innerText ?? '')", 15000);
    check("tabelul paginii ajunge în foaie (Ciment 40 kg, 32,5 ca număr)", !!got);
  }
  const last = seen[seen.length - 1];
  check("o singură cerere GET, fără cookie-uri, cu numele aplicației", seen.length === 1 && last.method === "GET" && !last.cookie && /^K\.G\.B\.\//.test(last.agent), JSON.stringify(seen));
  await p.screenshot(join(shots, "02-tabel-din-web.png"));

  // Settings › Internet off: the same request is refused by the core, with the reason.
  const st = await invoke(p, "get_settings", {});
  await invoke(p, "save_settings", { settings: { ...st.settings, internet: false }, version: st.version });
  const off = await invoke(p, "net_fetch", { url, purpose: "page", body: null, http: true });
  check("cu Internet oprit în Setări, cererea e refuzată", typeof off?.error === "string" && /oprite/.test(off.error), JSON.stringify(off).slice(0, 160));
  check("și nu pleacă nimic", seen.length === 1);
  const st2 = await invoke(p, "get_settings", {});
  await invoke(p, "save_settings", { settings: { ...st2.settings, internet: true }, version: st2.version });
  // An address of the local network stays refused even in tests (only the test loopback is let through).
  const lan = await invoke(p, "net_fetch", { url: "http://192.168.1.1/", purpose: "page", body: null, http: true });
  check("o adresă din rețeaua locală e refuzată", typeof lan?.error === "string" && /rețeaua locală/.test(lan.error), JSON.stringify(lan).slice(0, 160));
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
  site.close();
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
