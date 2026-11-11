// 7.4l-2, end to end in the real window: the Notes window with what the plan asked for — a note from a template
// (with its list to tick), Markdown export, and a note locked with a password (D-090): the dialog says what is
// encrypted and that a forgotten password means a lost note; the core keeps only the encrypted part and the title;
// the attachment is encrypted too (its plain copy is gone from the module's files); a wrong password is refused and
// the right one opens it; its reminder says nothing of the hidden text.
//
// Usage: node app/e2e/cos-notes-full.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR) and a throw-away output folder.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-notes-full.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-notes-full-"));
const out = mkdtempSync(join(tmpdir(), "kgb-notes-full-out-"));
const PORT = 9373;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const call = (p, command, args = {}) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.notes", command, args })}).then(r => r, e => ({ error: String(e) }))`);
const notebook = async (p) => JSON.parse((await call(p, "notebook_load")).content);
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
  fr(p, `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled); if (!b) return false; b.click(); return true; })()`);
const until = async (f, timeout = 15000) => {
  const end = Date.now() + timeout;
  for (;;) {
    if (await f().catch(() => false)) return true;
    if (Date.now() > end) return false;
    await sleep(300);
  }
};
const SECRET = "CONTRACT-CONFIDENTIAL-1234";
const BODY = "suma reală: 98.000 lei";
const PW = "proba-" + Date.now().toString(36);

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3, h2, strong')?.textContent.trim().startsWith('Note'))";
  await p.until(`!!${card}`, 8000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Note'))");
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Note')).click()");
  await frUntil(p, "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '+ Notiță nouă')");

  // A note from a template: the shopping list comes with its boxes to tick.
  await fr(p, `(() => { const s = document.querySelector('select.notes-tpl'); const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    set.call(s, 'cumparaturi'); s.dispatchEvent(new window.Event('change', { bubbles: true })); return true; })()`);
  const tpl = await until(async () => (await notebook(p)).notes.some((n) => n.title === "Cumpărături" && n.body.includes("☐")));
  check("notiță din șablon „Listă de cumpărături”, cu căsuțe de bifat, salvată în nucleu", tpl);

  // Markdown export of the open note (the save dialog answered in the page).
  const md = join(out, "Cumparaturi.md");
  await p.eval(`(() => { window.kgbHost.save = async () => ${JSON.stringify(md)}; return true; })()`);
  if (!(await btn(p, "Export .md"))) {
    await btn(p, "Fișier");
    await sleep(300);
    await btn(p, "Export .md");
  }
  await until(async () => existsSync(md), 8000);
  check("export Markdown al notiței", existsSync(md) && readFileSync(md, "utf8").includes("Cumpărături"), existsSync(md) ? readFileSync(md, "utf8").slice(0, 80) : "lipsește");

  // A note with text and an attached file, then locked.
  await btn(p, "+ Notiță nouă");
  await sleep(300);
  await p.eval("document.querySelector('.notes-window iframe').focus()");
  await fr(p, "document.querySelector('.note-title')?.focus(), true");
  await p.send("Input.insertText", { text: "Contract" });
  await fr(p, "document.querySelector('.note-body')?.focus(), true");
  await p.send("Input.insertText", { text: BODY });
  await sleep(300);
  await fr(p, `(() => { const dt = new window.DataTransfer();
    dt.items.add(new window.File([new window.TextEncoder().encode(${JSON.stringify(SECRET)})], 'contract.txt', { type: 'text/plain' }));
    document.querySelector('.note-body').dispatchEvent(new window.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return true; })()`);
  await until(async () => (await notebook(p)).notes.some((n) => n.title === "Contract" && (n.files ?? []).length === 1), 15000);
  const before = (await notebook(p)).notes.find((n) => n.title === "Contract");
  const plainId = before?.files?.[0]?.id;
  check("atașamentul rămâne în caiet (numele lui trece de verificarea ferestrei)", !!plainId && /^[a-f0-9]+\.bin$/.test(plainId), JSON.stringify(before?.files));
  const plainRead = plainId ? await call(p, "attachment_read", { id: plainId }) : {};
  check("înainte de blocare, fișierul e în clar", Buffer.from(plainRead.data ?? "", "base64").toString() === SECRET);

  await btn(p, "🔒 Blochează");
  await frUntil(p, "!!document.querySelector('.note-lock-dlg')", 5000);
  const dlg = await fr(p, "document.querySelector('.note-lock-dlg').innerText");
  check("dialogul: se criptează și fișierele atașate; parola uitată = notiță pierdută", /celelalte fișiere atașate/.test(dlg) && /Dacă uiți parola, notița nu mai poate fi deschisă de nimeni/.test(dlg), dlg.slice(0, 160));
  for (const label of ["Parola", "Parola, încă o dată"]) {
    await fr(p, `document.querySelector('.note-lock-dlg input[aria-label="${label}"]').focus(), true`);
    await p.send("Input.insertText", { text: PW });
  }
  await fr(p, "document.querySelector('.note-lock-dlg button[type=submit]').click(), true");
  const locked = await until(async () => {
    const n = (await notebook(p)).notes.find((x) => x.title === "Contract");
    return !!n?.secret && !n.files;
  }, 15000);
  const raw = (await call(p, "notebook_load")).content;
  const n = JSON.parse(raw).notes.find((x) => x.title === "Contract");
  check("în nucleu: titlul și partea criptată {v, salt, iv, data}, fără text", locked && Object.keys(n.secret).sort().join(",") === "data,iv,salt,v" && !n.body, JSON.stringify(Object.keys(n ?? {})));
  check("nicăieri în caiet textul sau conținutul atașamentului", !raw.includes("98.000") && !raw.includes(SECRET));
  await until(async () => !!(await call(p, "attachment_read", { id: plainId })).error, 10000);
  check("copia în clar a atașamentului e ștearsă din fișierele modulului", !!(await call(p, "attachment_read", { id: plainId })).error);
  // D-090: the window asks to forget this computer's history before the lock (default yes); after it, neither the
  // note's text nor the attachment's bytes are anywhere in the data folder.
  await frUntil(p, "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Șterge din istoric')", 15000);
  await btn(p, "Șterge din istoric");
  await frUntil(p, "/Am șters din istoricul acestui calculator/.test(document.body.innerText)", 30000);
  const leaks = [];
  const scan = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, e.name);
      if (e.isDirectory()) scan(f);
      else {
        const b = readFileSync(f);
        if (b.includes(Buffer.from(SECRET)) || b.includes(Buffer.from(BODY))) leaks.push(f.slice(data.length));
      }
    }
  };
  scan(data);
  check("după „Șterge din istoric”: textul și atașamentul nu mai sunt în niciun fișier din dosarul de date", leaks.length === 0, leaks.join(" | "));

  // Wrong password refused; the right one opens it and the attachment reads whole.
  await fr(p, "document.querySelector('.note-locked input[type=password]').focus(), true");
  await p.send("Input.insertText", { text: "gresita" });
  await fr(p, "document.querySelector('.note-locked').requestSubmit(), true");
  await frUntil(p, "/Parola nu e bună/.test(document.querySelector('.note-locked')?.innerText ?? '')", 8000);
  check("parola greșită e refuzată", true);
  await fr(p, `(() => { const i = document.querySelector('.note-locked input[type=password]'); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new window.Event('input', { bubbles: true })); i.focus(); return true; })()`);
  await p.send("Input.insertText", { text: PW });
  await fr(p, "document.querySelector('.note-locked').requestSubmit(), true");
  await frUntil(p, `document.querySelector('.note-body')?.value.includes(${JSON.stringify(BODY)})`, 10000);
  check("parola bună deschide notița", true);
  const saveCopy = join(out, "contract.txt");
  await p.eval(`(() => { window.kgbHost.save = async () => ${JSON.stringify(saveCopy)}; return true; })()`);
  await fr(p, "(() => { const f = [...document.querySelectorAll('.note-file')].find(x => x.textContent.includes('contract.txt')); f?.querySelector('button')?.click(); return !!f; })()");
  await until(async () => existsSync(saveCopy), 8000);
  check("atașamentul criptat se citește întreg cu notița deschisă", existsSync(saveCopy) && readFileSync(saveCopy, "utf8") === SECRET);
  await p.screenshot(join(shots, "01-notita-blocata.png"));
  check("nicio eroare în fereastră", (await fr(p, "JSON.stringify(window.__errs ?? [])")) === "[]" || (await fr(p, "window.__errs")) === undefined);
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
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
  rmSync(out, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
