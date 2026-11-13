// 8.8 (D-096) and 8.10, end to end in the real window.
// - No telemetry: the app is started with HTTP(S)_PROXY pointing at a small proxy of this test that records every
//   connection the program's web client tries. With the default settings, opening the app and walking through its
//   pages for a while sends nothing. Control: switching on the BNR source and opening the start page does go
//   through the proxy (so the proxy really sees the requests), but only with „Setări › Internet” on; the proxy
//   refuses it, nothing reaches the internet.
// - The diagnostic package, saved to a file, has no Windows user name, no CNP and no e-mail address.
//
// Usage: node app/e2e/privacy.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node privacy.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-privacy-"));
const PORT = 9380;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// The proxy: records CONNECT (https) and plain requests, answers 403 to all.
const seen = [];
const proxy = createServer((req, res) => {
  seen.push(`${req.method} ${req.url}`);
  res.writeHead(403).end();
});
proxy.on("connect", (req, socket) => {
  seen.push(`CONNECT ${req.url}`);
  socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
});
await new Promise((ok) => proxy.listen(0, "127.0.0.1", ok));
const proxyUrl = `http://127.0.0.1:${proxy.address().port}`;

try {
  proc = spawn(exe, [], {
    env: {
      ...process.env,
      KGB_DATA_DIR: data,
      KGB_NO_DESKTOP_NOTIFY: "1",
      HTTPS_PROXY: proxyUrl,
      HTTP_PROXY: proxyUrl,
      ALL_PROXY: proxyUrl,
      NO_PROXY: "",
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
    },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  const invoke = (cmd, args = {}) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);

  // Walk through the pages, wait.
  for (const name of ["Parteneri", "Mesaje", "Ferestre web", "Surse externe", "Setări", "Date și backup", "Diagnostic", "Acasă"]) {
    await p.click(name, "nav .nav");
    await sleep(1500);
  }
  await sleep(8000);
  check("fără niciun clic care cere internetul, nu pleacă nicio cerere (fără telemetrie)", seen.length === 0, JSON.stringify(seen));

  // Control: BNR switched on → the start page asks for the rate, through the proxy.
  const src = await invoke("sources_list");
  const bnr = src.items.find((s) => s.url.includes("bnr.ro"));
  await invoke("source_set_active", { id: bnr.id, active: true });
  // With „Setări › Internet” off, not even an active source is read.
  let st = await invoke("get_settings");
  await invoke("save_settings", { settings: { ...st.settings, internet: false }, version: st.version });
  await p.click("Setări", "nav .nav");
  await sleep(300);
  await p.click("Acasă", "nav .nav");
  await sleep(4000);
  check("cu „Setări › Internet” oprit, nici o sursă pornită nu e citită", seen.length === 0, JSON.stringify(seen));
  st = await invoke("get_settings");
  await invoke("save_settings", { settings: { ...st.settings, internet: true }, version: st.version });
  await p.click("Setări", "nav .nav");
  await sleep(300);
  await p.click("Acasă", "nav .nav");
  const t0 = Date.now();
  while (!seen.length && Date.now() - t0 < 15000) await sleep(250);
  check("controlul: cu sursa BNR pornită, cererea cursului trece prin proxy-ul testului (proxy-ul vede cererile)", seen.some((s) => s.includes("bnr.ro")), JSON.stringify(seen));

  // The diagnostic package.
  await p.click("Diagnostic", "nav .nav");
  await p.click("Salvează raportul într-un fișier");
  await p.until("(document.querySelector('section')?.innerText ?? '').includes('Raport salvat în')", 8000);
  const path = await p.eval("document.querySelector('section code').innerText");
  const text = readFileSync(path.replace(/\[utilizator\]/, userInfo().username), "utf8");
  const user = userInfo().username;
  check(
    "pachetul de diagnostic e pe calculator și nu conține numele utilizatorului Windows, CNP-uri sau e-mailuri",
    text.includes("K.G.B. — raport de diagnostic") && !text.toLowerCase().includes(`\\users\\${user.toLowerCase()}`) && text.includes("[utilizator]") && !/\b[1-8]\d{12}\b/.test(text) && !/@\w+\./.test(text),
    `${text.length} caractere`,
  );
  const shown = await p.eval("document.querySelector('pre.report').innerText");
  check("și raportul arătat pe pagină e la fel de curat", !shown.toLowerCase().includes(`\\users\\${user.toLowerCase()}`));
  check("pagina arată „Probleme cunoscute”", (await p.eval("document.querySelectorAll('.known-issues li').length")) >= 5);
  await p.screenshot(join(shots, "01-diagnostic.png"));
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
  proxy.close();
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
