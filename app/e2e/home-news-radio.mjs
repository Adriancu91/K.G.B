// 8.18 and 8.19, end to end in the real window: the „Știri” and „Radio” panels on the start page.
// - The proposed news feeds are in „Surse externe”, filled in and switched off; the panel says no source is on.
//   With a test feed (a small server of this test) approved, the panel shows its newest titles.
// - Radio: with the directory off nothing is asked; switched on (the directory is the test server, through the
//   test-only KGB_TEST_RADIO_BASE), „Posturi din România” lists the stations, a click reports the click to the
//   directory and plays the stream in a hidden window (the server sees the stream asked for), „Oprește” stops it.
//
// Usage: node app/e2e/home-news-radio.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node home-news-radio.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-homenr-"));
const PORT = 9376;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Test</title>
<item><title>Titlu de test unu</title><link>https://example.ro/unu</link><pubDate>Fri, 13 Nov 2026 09:00:00 +0200</pubDate><description>Unu.</description></item>
<item><title>Titlu de test doi</title><link>https://example.ro/doi</link><pubDate>Thu, 12 Nov 2026 08:00:00 +0200</pubDate><description>Doi.</description></item>
</channel></rss>`;
const UUID = "96062a7b-0601-11e8-ae97-52543be04c81";
/** One second of silence, as WAV. */
function wav() {
  const n = 8000;
  const b = Buffer.alloc(44 + n);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(8000, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write("data", 36);
  b.writeUInt32LE(n, 40);
  b.fill(128, 44);
  return b;
}
const asked = [];
const server = createServer((req, res) => {
  const u = req.url ?? "";
  asked.push({ path: u, ua: req.headers["user-agent"] ?? "" });
  if (u === "/rss.xml") return res.writeHead(200, { "Content-Type": "application/rss+xml" }).end(RSS);
  if (u.startsWith("/json/stations/search")) {
    const base = `http://127.0.0.1:${server.address().port}`;
    return res.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify([
        { stationuuid: UUID, name: "Radio de test", url_resolved: `${base}/stream.wav`, codec: "WAV", bitrate: 64, votes: 9, countrycode: "RO", tags: "test", homepage: "" },
        { stationuuid: "nu-e-uuid", name: "Fără id", url_resolved: `${base}/x` },
      ]),
    );
  }
  if (u === `/json/url/${UUID}`) return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
  if (u === "/stream.wav") return res.writeHead(200, { "Content-Type": "audio/wav" }).end(wav());
  res.writeHead(404).end();
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  proc = spawn(exe, [], {
    env: {
      ...process.env,
      KGB_DATA_DIR: data,
      KGB_NO_DESKTOP_NOTIFY: "1",
      KGB_TEST_RADIO_BASE: base,
      KGB_TEST_WEB_LOCAL: "1",
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
    },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  const invoke = (cmd, args = {}) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
  const panel = (title) => `document.querySelector('[data-panel="${title === "Știri" ? "stiri" : "radio"}"]')`;
  const text = (title) => p.eval(`(${panel(title)})?.innerText ?? ''`);

  // The proposed sources, off.
  const src = await invoke("sources_list");
  const rss = src.items.filter((s) => s.tip === "rss");
  const radio = src.items.find((s) => s.url === "https://all.api.radio-browser.info");
  check(
    "sursele propuse sunt în „Surse externe”, completate și oprite (5 fluxuri de știri și catalogul de radiouri)",
    rss.length === 5 && rss.every((s) => !s.activa && s.termeni && s.licenta && s.verificat === "2026-11-13") && radio && !radio.activa,
    JSON.stringify(src.items.map((s) => [s.nume, s.activa])).slice(0, 300),
  );

  // Știri on the start page.
  await p.until(`(${panel("Știri")})?.innerText.includes('Nicio sursă de știri pornită') ?? false`, 15000);
  check("panoul „Știri” e pe Acasă și spune că nicio sursă nu e pornită", true);
  const st = await invoke("get_settings");
  await invoke("save_settings", { settings: { ...st.settings, internet: true }, version: st.version });
  const id = await invoke("source_save", { source: { nume: "Flux de test", url: `${base}/rss.xml`, tip: "rss", termeni: "Doar pentru test.", licenta: "test", verificat: "2026-11-13" } });
  await invoke("source_set_active", { id, active: true });
  await p.click("Catalog module", "nav .nav");
  await sleep(300);
  await p.click("Acasă", "nav .nav");
  await p.until(`(${panel("Știri")})?.innerText.includes('Titlu de test unu') ?? false`, 15000);
  const news = await text("Știri");
  check("cu o sursă pornită, panoul arată titlurile, cel mai nou primul, cu sursa", news.indexOf("Titlu de test unu") < news.indexOf("Titlu de test doi") && news.includes("Flux de test"), news.replace(/\s+/g, " ").slice(0, 200));

  // Radio: off → nothing asked.
  const before = asked.filter((a) => a.path.startsWith("/json")).length;
  await p.eval(`[...(${panel("Radio")}).querySelectorAll('button')].find(b => b.innerText === 'Posturi din România').click()`);
  await p.until(`(${panel("Radio")})?.innerText.includes('Surse externe') ?? false`, 10000);
  check("cu catalogul de radiouri oprit, nu pleacă nicio cerere", asked.filter((a) => a.path.startsWith("/json")).length === before);

  // On: search, play, stop.
  await invoke("source_set_active", { id: radio.id, active: true });
  await p.eval(`[...(${panel("Radio")}).querySelectorAll('button')].find(b => b.innerText === 'Posturi din România').click()`);
  await p.until(`(${panel("Radio")})?.innerText.includes('Radio de test') ?? false`, 10000);
  const list = await text("Radio");
  const search = asked.find((a) => a.path.startsWith("/json/stations/search"));
  check(
    "„Posturi din România” cere posturile din RO, cele mai votate, cu un User-Agent care numește programul; doar posturile valide apar",
    !!search && search.path.includes("countrycode=RO") && search.path.includes("order=votes") && /^KGB\//.test(search.ua) && !list.includes("Fără id"),
    search ? `${search.path} · ${search.ua}` : "nicio cerere",
  );
  await p.eval(`[...(${panel("Radio")}).querySelectorAll('button.link')].find(b => b.innerText === 'Radio de test').click()`);
  await p.until(`(${panel("Radio")})?.innerText.includes('▶ Radio de test') || !!(${panel("Radio")})?.querySelector('.muted')?.innerText.includes('nu') `, 10000).catch(() => {});
  if (!(await text("Radio")).includes("▶ Radio de test")) throw new Error(`radioul nu a pornit: ${(await text("Radio")).replace(/\s+/g, " ").slice(0, 300)}`);
  const t0 = Date.now();
  while (!asked.some((a) => a.path === "/stream.wav") && Date.now() - t0 < 15000) await sleep(250);
  check("un clic pe post semnalează clicul catalogului și pornește fluxul audio", asked.some((a) => a.path === `/json/url/${UUID}`) && asked.some((a) => a.path === "/stream.wav"), JSON.stringify(asked.map((a) => a.path)));
  const ipcFromRadio = await p.eval("window.__TAURI_INTERNALS__.invoke('radio_now').then(r => r?.name ?? null)");
  check("K.G.B. știe ce post cântă", ipcFromRadio === "Radio de test", String(ipcFromRadio));
  await p.screenshot(join(shots, "01-acasa-stiri-radio.png"));
  await p.eval(`[...(${panel("Radio")}).querySelectorAll('button')].find(b => b.innerText === 'Oprește').click()`);
  await p.until(`!(${panel("Radio")})?.innerText.includes('▶ Radio de test')`, 10000);
  check("„Oprește” oprește radioul", (await invoke("radio_now")) === null);
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
