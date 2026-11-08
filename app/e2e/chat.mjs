// Etapa 7 step 7.4f, end to end in the real window: team messages.
// A text message (Enter sends), a voice message recorded with the
// microphone (the test uses Chromium's fake microphone, a beep, and its
// fake permission prompt), played back from the app; the author deletes
// their own message; a forced restart keeps the rest. Between two PCs the
// messages are tested in crates/kgb-net/tests/chat.rs and, with two real
// PCs, in step 🔒 6.10.
//
// Usage: node app/e2e/chat.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node chat.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-chat-"));
const PORT = 9355;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const type = (p, value) =>
  p.eval(`(() => { const el = document.querySelector("textarea[aria-label='Mesaj nou']");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const list = (p) => p.eval("document.querySelector('.chat-list').innerText");

async function start() {
  proc = spawn(exe, [], {
    env: {
      ...process.env,
      COMPUTERNAME: "PC-TEST",
      KGB_DATA_DIR: data,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT} --use-fake-device-for-media-stream --use-fake-ui-for-media-stream`,
    },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Mesaje", "nav .nav");
  await p.until("!!document.querySelector('.chat-list')", 5000);
  return p;
}
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}

try {
  let p = await start();
  check("fără organizație, pagina spune că mesajele rămân pe acest PC", (await p.eval("document.querySelector('.chat').innerText")).includes("mesajele rămân doar aici"));
  check("la început nu e niciun mesaj", (await list(p)).includes("Niciun mesaj încă"));

  await type(p, "Bună dimineața! Camionul vine la 10.");
  await sleep(150);
  await p.eval(`document.querySelector("textarea[aria-label='Mesaj nou']").dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  await p.until("document.querySelector('.chat-list').innerText.includes('Camionul vine la 10')", 5000);
  check("Enter trimite mesajul, afișat ca „Eu”", (await list(p)).includes("Eu"));

  // Voice: record ~2 s with the fake microphone, stop, it is sent.
  await p.click("Mesaj vocal", ".chat-input button");
  await p.until("[...document.querySelectorAll('.chat-input button')].some(b => b.innerText.includes('Oprește și trimite'))", 8000);
  await sleep(2200);
  await p.click("Oprește și trimite", ".chat-input button");
  await p.until("[...document.querySelectorAll('.chat-list button')].some(b => b.innerText.includes('Ascultă'))", 8000);
  const label = await p.eval("[...document.querySelectorAll('.chat-list button')].find(b => b.innerText.includes('Ascultă')).innerText");
  check("mesajul vocal e trimis, cu durata", /Ascultă \(\d+ s\)/.test(label), label);
  await p.click("Ascultă", ".chat-list button");
  await p.until("!!document.querySelector('.chat-list audio')", 5000);
  await p.until("document.querySelector('.chat-list audio').readyState >= 1", 8000);
  const audio = await p.eval("(() => { const a = document.querySelector('.chat-list audio'); return { src: a.src.slice(0, 5), err: a.error ? a.error.code : 0 }; })()");
  check("înregistrarea se redă în aplicație", audio.src === "blob:" && audio.err === 0, JSON.stringify(audio));
  await p.screenshot(join(shots, "01-mesaje.png"));

  // A third message, then the author deletes it.
  await type(p, "Mesaj de șters");
  await sleep(150);
  await p.click("Trimite", ".chat-input button");
  await p.until("document.querySelector('.chat-list').innerText.includes('Mesaj de șters')", 5000);
  await p.eval("[...document.querySelectorAll('.msg')].find(m => m.innerText.includes('Mesaj de șters')).querySelector('button.link').click()");
  await p.until("!document.querySelector('.chat-list').innerText.includes('Mesaj de șters')", 5000);
  check("autorul își șterge mesajul", true);

  stop(p);
  p = await start();
  await p.until("document.querySelector('.chat-list').innerText.includes('Camionul vine la 10')", 5000);
  check("după repornire (forțată) mesajele rămân, cu cel vocal", (await p.eval("document.querySelectorAll('.msg').length")) === 2);
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
