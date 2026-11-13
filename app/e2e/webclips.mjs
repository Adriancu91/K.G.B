// 8.20 (D-099), end to end in the real window: „Ferestre web”, a small window with part of a web page, frozen there.
// The page is served by a small server of this test (a long page); in the page's window a script of the test plays
// the person: the first time it scrolls to 1200 px (choosing the part) and tries to call K.G.B.; afterwards it
// tells the server where the page stands. Checks: with „Setări › Internet” off nothing loads; the page's window
// cannot call K.G.B.; „Îngheață” keeps the position, and the window reopens live
// at that position with the scrollbars hidden; „Închide” closes it.
//
// Usage: node app/e2e/webclips.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node webclips.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-clips-"));
const PORT = 9377;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

let loads = 0;
const asked = [];
const server = createServer((req, res) => {
  const u = req.url ?? "";
  asked.push(u);
  if (u === "/lung.html") {
    loads++;
    const first = loads === 1;
    const script = first
      ? `window.addEventListener('load', () => {
           setTimeout(() => window.scrollTo(0, 1200), 300);
           const t = window.__TAURI_INTERNALS__;
           if (!t) { fetch('/ipc?ok=0&why=lipsa'); return; }
           try { t.invoke('app_info').then(() => fetch('/ipc?ok=1'), (e) => fetch('/ipc?ok=0&why=' + encodeURIComponent(String(e)).slice(0, 80))); }
           catch (e) { fetch('/ipc?ok=0&why=exceptie'); }
         });`
      : `window.addEventListener('load', () => { let last = -1; setInterval(() => { const y = Math.round(window.scrollY); if (y !== last) { last = y; fetch('/pos?y=' + y + '&ov=' + getComputedStyle(document.documentElement).overflowY); } }, 300); });`;
    return res
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(`<!doctype html><html><head><title>Pagina lunga</title></head><body style="margin:0"><div style="height:1200px;background:#ddd">sus</div><div id="tinta" style="height:200px;background:#2a7;color:#fff;font:40px sans-serif">CURS 4,9765</div><div style="height:2000px">jos</div><script>${script}</script></body></html>`);
  }
  res.writeHead(204).end();
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;
const waitFor = async (pred, ms) => {
  const t0 = Date.now();
  while (!pred() && Date.now() - t0 < ms) await sleep(200);
  return pred();
};

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", KGB_TEST_WEB_LOCAL: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  const invoke = (cmd, args = {}) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
  const setv = (sel, v) => p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);

  const st0 = await invoke("get_settings");
  await invoke("save_settings", { settings: { ...st0.settings, internet: false }, version: st0.version });
  await p.click("Ferestre web", "nav .nav");
  await p.until("!!document.querySelector('.web-clips')", 8000);
  await p.click("Fereastră web nouă", ".web-clips button");
  await setv("[aria-label='Numele ferestrei']", "Curs de test");
  await setv("[aria-label='Adresa paginii']", `${base}/lung.html`);
  await p.screenshot(join(shots, "01-fereastra-noua.png"));

  // Internet off: saved, but the page is not loaded.
  await p.click("Salvează și alege zona", ".web-clips button");
  await p.until("(document.querySelector('.error')?.innerText ?? '').includes('Internet')", 8000);
  check("cu internetul oprit, pagina nu se încarcă", loads === 0, `${asked.length} cereri`);

  const st = await invoke("get_settings");
  await invoke("save_settings", { settings: { ...st.settings, internet: true }, version: st.version });
  // The settings were changed behind the page's back (as the test does): the page reads them again.
  await p.eval("location.reload(), true");
  await sleep(1500);
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Ferestre web", "nav .nav");
  await p.until("!!document.querySelector('.web-clips')", 8000);
  await p.until("[...document.querySelectorAll('.web-clips button')].some(b => b.innerText === 'Alege zona')", 8000);
  await p.click("Alege zona", ".web-clips button");
  await waitFor(() => asked.some((a) => a.startsWith("/ipc")), 15000);
  check("„Alege zona” deschide pagina într-o fereastră separată", loads === 1);
  const ipc = asked.find((a) => a.startsWith("/ipc")) ?? "";
  check("pagina din fereastra web nu poate chema K.G.B.", ipc.startsWith("/ipc?ok=0"), ipc);
  await sleep(2000);
  await p.screenshot(join(shots, "02-alege-zona.png"));

  // Freeze.
  await p.click("Îngheață", ".web-clips button");
  await p.until("(document.querySelector('.web-clips')?.innerText ?? '').includes('înghețată')", 8000);
  const list = await invoke("clip_list");
  const c = list.ferestre[0];
  check("„Îngheață” ține minte poziția aleasă (1200 px), mărimea și locul ferestrei", c && c.inghetata && c.y === 1200 && c.latime >= 120 && !!c.pozitie, JSON.stringify(c));
  await waitFor(() => asked.some((a) => a.startsWith("/pos")), 15000);
  const pos = asked.find((a) => a.startsWith("/pos")) ?? "";
  check("apoi pagina se redeschide live pe partea înghețată, fără bare de derulare", loads === 2 && pos.includes("y=1200") && pos.includes("ov=hidden"), pos);
  check("fereastra apare deschisă în listă", list.deschise.includes(c.id));
  await p.screenshot(join(shots, "03-inghetata.png"));

  // Pinned on Home: the frozen part, live, inside a panel that moves like the others.
  await p.click("Fixează pe Acasă", ".web-clips button");
  await p.until("[...document.querySelectorAll('.web-clips button')].some(b => b.innerText === 'Scoate de pe Acasă')", 8000);
  await p.click("Acasă", "nav .nav");
  await p.until(`!!document.querySelector('.panel[data-panel="web:${c.id}"]')`, 8000);
  await p.eval(`document.querySelector('.panel[data-panel="web:${c.id}"]').scrollIntoView({ block: "center" })`);
  const before = asked.filter((a) => a.startsWith("/pos")).length;
  const t1 = Date.now();
  while (asked.filter((a) => a.startsWith("/pos")).length <= before && Date.now() - t1 < 20000) await sleep(250);
  const homePos = asked.filter((a) => a.startsWith("/pos")).at(-1) ?? "";
  const title = await p.eval(`document.querySelector('.panel[data-panel="web:${c.id}"] h3').innerText`);
  check("„Fixează pe Acasă” pune pe Acasă un panou cu numele ferestrei, cu pagina live pe partea înghețată", title === "Curs de test" && asked.filter((a) => a.startsWith("/pos")).length > before && homePos.includes("y=1200") && homePos.includes("ov=hidden"), `${title} · ${homePos}`);
  await p.screenshot(join(shots, "04-pe-acasa.png"));
  // Scrolling Home so the top 100 px of the panel's page are hidden: it stays shown, the page inside moves by 100.
  const panelSel = `.panel[data-panel="web:${c.id}"] .web-clip-box`;
  await p.eval("document.querySelector('.cc-canvas').style.marginBottom = '1500px', true");
  await sleep(300);
  await p.eval(`(() => { const m = document.querySelector('main'); const r = document.querySelector('${panelSel}').getBoundingClientRect(); m.scrollTop += r.top - m.getBoundingClientRect().top + 100; return true; })()`);
  const t2 = Date.now();
  while (!asked.some((a) => a.startsWith("/pos?y=1300")) && Date.now() - t2 < 10000) await sleep(250);
  check("derulând Acasă, panoul tăiat sus rămâne afișat, iar pagina din el se mută cu partea ascunsă", asked.some((a) => a.startsWith("/pos?y=1300")), JSON.stringify(asked.filter((a) => a.startsWith("/pos")).slice(-3)));
  await p.eval(`document.querySelector('.panel[data-panel="web:${c.id}"]').scrollIntoView({ block: "center" })`);
  await p.eval(`document.querySelector('.panel[data-panel="web:${c.id}"] button[aria-label="Micșorează pagina"]').click()`);
  await p.until(`document.querySelector('.panel[data-panel="web:${c.id}"] .web-clip-tools').innerText.includes('90%')`, 8000);
  check("butoanele −/+ din panou micșorează pagina și țin minte mărimea", (await invoke("clip_list")).ferestre[0].zoom === 0.9);
  const kept = await invoke("get_settings");
  check("panoul rămâne pe Acasă (e în setări)", kept.settings.home.panels.some((x) => x.id === `web:${c.id}`));
  await p.click("Ferestre web", "nav .nav");
  await p.until("!!document.querySelector('.web-clips')", 8000);
  await p.click("Scoate de pe Acasă", ".web-clips button");
  await p.until("[...document.querySelectorAll('.web-clips button')].some(b => b.innerText === 'Fixează pe Acasă')", 8000);
  check("„Scoate de pe Acasă” îl scoate", !(await invoke("get_settings")).settings.home.panels.some((x) => x.id === `web:${c.id}`));

  await p.click("Închide", ".web-clips button");
  await p.until("!(document.querySelector('.web-clips')?.innerText ?? '').includes('deschisă')", 8000);
  check("„Închide” închide fereastra web", (await invoke("clip_list")).deschise.length === 0);
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
  server.close();
  await sleep(800);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
