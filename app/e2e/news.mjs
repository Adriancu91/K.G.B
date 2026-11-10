// 7.5, end to end in the real window: InfoNews. A small local server serves an RSS and an Atom feed (and a
// broken one); they are added and approved in „Surse externe”; the page „Știri” shows their items newest first, with
// source, time and link, text only; one is kept and shows under „Păstrate”; a link that is not of an item shown is
// not opened. Without an approved source the page says so.
//
// Usage: node app/e2e/news.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR); the feeds come from 127.0.0.1. "Deschide în browser" is not pressed.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node news.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-news-"));
const PORT = 9355;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Test RSS</title>
<item><title>Ședință la primărie &amp; consiliu</title><link>https://example.ro/sedinta</link><pubDate>Tue, 10 Nov 2026 09:00:00 +0200</pubDate>
<description><![CDATA[<p>Consiliul se reunește <b>azi</b>.</p><script>document.title='PWNED'</script><img src=x onerror="document.title='PWNED'">]]></description></item>
<item><title>Știre mai veche</title><link>https://example.ro/veche</link><pubDate>Mon, 09 Nov 2026 08:00:00 +0200</pubDate><description>Ieri.</description></item>
</channel></rss>`;
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Test Atom</title>
<entry><title>Cea mai nouă</title><link rel="alternate" href="https://example.org/nou"/><updated>2026-11-10T10:30:00+02:00</updated><summary>Din Atom.</summary></entry></feed>`;
let hits = 0;
const server = createServer((req, res) => {
  hits++;
  if (req.url === "/rss.xml") res.writeHead(200, { "Content-Type": "application/rss+xml" }).end(RSS);
  else if (req.url === "/atom.xml") res.writeHead(200, { "Content-Type": "application/atom+xml" }).end(ATOM);
  else res.writeHead(200, { "Content-Type": "text/html" }).end("<html><body>nu e flux</body></html>");
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  const invoke = (cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);

  // The module „Știri”.
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Știri')";
  await p.until(`!!${card}`, 10000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim() === 'Știri')", 10000);
  await p.click("Știri", "nav .nav");
  await p.until("(document.querySelector('.news')?.innerText ?? '').includes('Nicio sursă RSS')", 15000);
  check("fără surse aprobate pagina o spune și nu citește nimic", hits === 0, `${hits} cereri`);

  // Three sources in the register, approved and switched on.
  const add = async (nume, url) => {
    const id = await invoke("source_save", { source: { nume, url, tip: "rss", termeni: "Doar pentru test.", licenta: "test", verificat: "2026-11-10" } });
    await invoke("source_set_active", { id, active: true });
  };
  await add("Test RSS", `${base}/rss.xml`);
  await add("Test Atom", `${base}/atom.xml`);
  await add("Flux stricat", `${base}/pagina`);
  await p.click("Reîmprospătează", ".news button");
  await p.until("document.querySelectorAll('.news-item').length >= 3", 20000);
  const items = await p.eval("[...document.querySelectorAll('.news-item')].map(e => [e.querySelector('h3').innerText, e.querySelector('.small').innerText])");
  check("știrile din ambele fluxuri, cele mai noi întâi", items[0][0] === "Cea mai nouă" && items[1][0] === "Ședință la primărie & consiliu" && items[2][0] === "Știre mai veche", JSON.stringify(items));
  check("fiecare cu sursa și ora", items[0][1].startsWith("Test Atom ·") && items[1][1].startsWith("Test RSS ·") && !items[1][1].includes("fără oră"), items.map((i) => i[1]).join(" | "));
  const text = await p.eval("document.querySelectorAll('.news-item')[1].innerText");
  check("rezumatul e text simplu, nimic din HTML-ul fluxului nu rulează", text.includes("Consiliul se reunește azi.") && !text.includes("<") && !text.includes("PWNED") && (await p.eval("document.title")) !== "PWNED", text.replace(/\s+/g, " ").slice(0, 120));
  const errs = await p.eval("[...document.querySelectorAll('.news .warn')].map(e => e.innerText).join(' | ')");
  check("fluxul stricat e spus pe nume, celelalte merg", errs.includes("Flux stricat") && /RSS sau Atom/.test(errs), errs);
  await p.screenshot(join(shots, "01-stiri.png"));

  // Keep one; „Păstrate”.
  await p.eval("[...document.querySelectorAll('.news-item')][1].querySelector('button.link:nth-of-type(2)').click()");
  await p.until("(document.querySelector('[role=tab]:nth-child(2)')?.innerText ?? '').includes('(1)')", 5000);
  await p.click("Păstrate", "[role=tab]");
  await sleep(300);
  const keptList = await p.eval("[...document.querySelectorAll('.news-item h3')].map(e => e.innerText)");
  check("știrea păstrată apare la „Păstrate”", keptList.length === 1 && keptList[0].startsWith("Ședință"), JSON.stringify(keptList));

  // Only links of the items shown open; read again only after 30 minutes.
  const refused = await p.eval(`window.__TAURI_INTERNALS__.invoke("news_open", { url: "https://evil.example/" }).then(() => "deschis", (e) => String(e))`);
  check("o legătură care nu e a unei știri afișate nu se deschide", refused.includes("nu e a unei știri afișate"), refused);
  const before = hits;
  await invoke("news_feed", {});
  check("fluxurile citite acum nu se cer din nou (30 de minute)", hits - before <= 1, `${hits - before} cereri noi`);
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
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
