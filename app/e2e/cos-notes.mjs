// 7.4l-2c, end to end in the real window: the Notes window copied from Cyber Office Studio, filling the Note
// page, with the notebook kept note by note in kgb.notes (7.4l-2b). A note typed with real input is saved on
// its own; a note that arrives "from another PC" while the window is open is not lost by the window's next
// save; after a restart everything is there.
//
// Usage: node app/e2e/cos-notes.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-notes.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-notes-"));
const PORT = 9344;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const start = () =>
  spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
const stop = () => {
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
};
const go = (p, label) => p.click(label, "nav .nav");
const call = (p, command, args = {}) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.notes", command, args })})`);
const notebook = async (p) => JSON.parse((await call(p, "notebook_load")).content);
// The window's frame fills the Note page.
const fr = (p, expr) =>
  p.eval(`(() => { const f = document.querySelector('.notes-window iframe'); if (!f?.contentDocument) return null;
    return ((document, window) => (${expr}))(f.contentDocument, f.contentWindow); })()`);
const frUntil = async (p, expr, timeout = 30000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fr(p, expr).catch(() => false);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timeout in frame: ${expr}`);
    await sleep(200);
  }
};
const btn = (p, label) =>
  fr(p, `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`);
async function typeInBody(p, text) {
  await p.eval("document.querySelector('.notes-window iframe').focus()");
  await fr(p, "document.querySelector('.note-body')?.focus(), true");
  await p.send("Input.insertText", { text });
  await sleep(300);
}
const until = async (f, timeout = 15000) => {
  const end = Date.now() + timeout;
  for (;;) {
    if (await f().catch(() => false)) return true;
    if (Date.now() > end) return false;
    await sleep(300);
  }
};

try {
  proc = start();
  let p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await go(p, "Catalog module");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3, h2, strong')?.textContent.trim().startsWith('Note'))";
  check("modulul Note apare în catalog, cu numele nou", await p.eval(`!!${card}`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Note'))");
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Note')).click()");
  await frUntil(p, "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '+ Notiță nouă')");
  check("fereastra Note din COS umple pagina", true);
  await fr(p, "(window.__errs = [], window.addEventListener('error', (e) => window.__errs.push(String(e.message))), window.addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason))), true)");

  // A note typed with real input: saved on its own, note by note.
  await btn(p, "+ Notiță nouă");
  await sleep(400);
  await typeInBody(p, "Lista de cumpărături: lapte, pâine, ouă");
  const saved = await until(async () => (await notebook(p)).notes.some((n) => /lapte, pâine, ouă/.test(n.body)));
  check("nota scrisă e salvată în nucleu", saved);

  // "Another PC" adds a note while the window is open (its own load and save, as a second PC's window would).
  const other = await call(p, "notebook_load");
  const book = JSON.parse(other.content);
  book.notes.push({ id: "alt-pc-1", title: "De pe celălalt PC", body: "scrisă în altă parte", created: "2026-11-10T09:00:00.000Z", updated: "2026-11-10T09:00:00.000Z" });
  await call(p, "notebook_save", { content: JSON.stringify(book), seen: other.seen });
  // The window, which never saw it, saves again after a change: the other PC's note must stay.
  await typeInBody(p, " și cafea");
  await until(async () => (await notebook(p)).notes.some((n) => /și cafea/.test(n.body)));
  const now = await notebook(p);
  check("nota de pe celălalt PC nu se pierde la salvarea ferestrei", now.notes.some((n) => n.id === "alt-pc-1"), now.notes.map((n) => n.title || n.body.slice(0, 20)).join(" | "));
  check("nota din fereastră are tot textul", now.notes.some((n) => /lapte, pâine, ouă și cafea/.test(n.body)));
  // The window looks as in COS: its stylesheet is loaded (the list on the left of the note, the drawn layer
  // under the writing field placed over it, so the text shows once) and it fills the page's height.
  const look = JSON.parse(
    await fr(
      p,
      `JSON.stringify((() => {
        const side = document.querySelector('.notes-side')?.getBoundingClientRect();
        const main = document.querySelector('.notes-main')?.getBoundingClientRect();
        const live = document.querySelector('.note-live');
        const ed = document.querySelector('.editor')?.getBoundingClientRect();
        return { side: side && { r: side.right, h: side.height }, main: main && { l: main.left },
          live: live ? getComputedStyle(live).position : null, editor: ed ? ed.height : 0, inner: window.innerHeight };
      })())`,
    ),
  );
  const outer = await p.eval(
    "(() => { const f = document.querySelector('.notes-window iframe').getBoundingClientRect(); return { top: f.top, h: f.height, vh: window.innerHeight }; })()",
  );
  check(
    "lista notițelor e în stânga notei (stilurile Notelor sunt încărcate)",
    !!look.side && !!look.main && look.side.r <= look.main.l + 1 && look.side.h > 200,
    JSON.stringify(look),
  );
  check("textul notei apare o singură dată (stratul desenat stă sub câmpul de scris)", look.live === "absolute", String(look.live));
  check(
    "fereastra umple înălțimea paginii",
    outer.top + outer.h >= outer.vh - 60 && look.editor >= look.inner - 2,
    `${JSON.stringify(outer)} editor ${look.editor}/${look.inner}`,
  );
  await p.screenshot(join(shots, "01-note.png"));
  check("nicio eroare în fereastră", (await fr(p, "JSON.stringify(window.__errs ?? [])")) === "[]", await fr(p, "JSON.stringify(window.__errs ?? [])"));
  p.close();
  await sleep(1500);
  stop();
  await sleep(1500);

  // After a restart: both notes are in the window.
  proc = start();
  p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Note')).click()");
  await frUntil(p, "document.body.innerText.includes('cafea')", 30000);
  const text = await fr(p, "document.body.innerText");
  check("după repornire notele sunt în fereastră", /cafea/.test(text) && /De pe celălalt PC/.test(text));
  await p.screenshot(join(shots, "02-dupa-repornire.png"));

  // 7.4l-2b-rem: a note with a reminder a minute ago is announced in the bell, once (the app's round of
  // reminders; KGB_NO_DESKTOP_NOTIFY keeps the Windows notification off the screen).
  const cur = await call(p, "notebook_load");
  const withRem = JSON.parse(cur.content);
  withRem.notes.push({ id: "memento-1", title: "Sună la bancă", body: "până la ora 12", created: "2026-11-10T09:00:00.000Z", updated: "2026-11-10T09:00:00.000Z", remind: new Date(Date.now() - 60000).toISOString() });
  await call(p, "notebook_save", { content: JSON.stringify(withRem), seen: cur.seen });
  const azi = new Date().toLocaleDateString("sv-SE");
  const tick = () => p.eval(`window.__TAURI_INTERNALS__.invoke("reminders_tick", { azi: ${JSON.stringify(azi)} })`);
  await tick();
  const bell = async () => (await p.eval('window.__TAURI_INTERNALS__.invoke("notifications_list")')).items.filter((n) => n.titlu === "Memento: Sună la bancă");
  const first = await bell();
  check("memento-ul notei apare o dată în clopoțel", first.length === 1 && first[0].text === "până la ora 12", JSON.stringify(first));
  await tick();
  check("runda următoare nu-l mai repetă", (await bell()).length === 1);
  p.close();
  stop();
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
  stop();
} finally {
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
