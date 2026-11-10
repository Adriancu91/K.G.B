// 7.4l-5a, end to end in the real window: the document window copied from Cyber Office Studio (D-080),
// in its frame over the Documente text page. What people tested in COS stays the same (D-078,
// TESTAT-DE-OAMENI.md): Ctrl+S and the other shortcuts, „Unde salvezi? În .docx”, a new version per save.
// Typing is real input (Input.insertText / Input.dispatchKeyEvent) into the frame.
//
// Usage: node app/e2e/cos-docs.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node cos-docs.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-cos-docs-"));
const corpus = resolve(import.meta.dirname, "../test-corpus/docx");
const PORT = 9340;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const go = (p, label) => p.click(label, "nav .nav");
const call = (p, command, args = {}) =>
  p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.write", command, args })})`);
// The frame's own `eval` is refused by the page's content policy: the expression runs from the page instead,
// with `document` / `window` bound to the frame's.
const fr = (p, expr) =>
  p.eval(`(() => { const f = document.querySelector('.cos-frame iframe'); if (!f?.contentDocument) return null;
    return ((document, window) => (${expr}))(f.contentDocument, f.contentWindow); })()`);
const frUntil = async (p, expr, timeout = 15000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fr(p, expr).catch(() => false);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timeout in frame: ${expr}`);
    await sleep(150);
  }
};
const CTRL = 2;
async function key(p, k, code, vk, modifiers = 0) {
  await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
  await sleep(150);
}
const typeText = async (p, text) => {
  await p.send("Input.insertText", { text });
  await sleep(200);
};
const editorText = (p) => fr(p, "document.querySelector('.ProseMirror')?.innerText ?? ''");
const editorHtml = (p) => fr(p, "document.querySelector('.ProseMirror')?.innerHTML ?? ''");
const focusEditor = async (p) => {
  await p.eval("document.querySelector('.cos-frame iframe').focus()");
  await fr(p, "document.querySelector('.ProseMirror')?.focus(), true");
  await sleep(200);
};
const toEnd = (p) => key(p, "End", "End", 35, CTRL);
const ctrlS = (p) => key(p, "s", "KeyS", 83, CTRL);
/** Opens the frame with a button of the page and waits for the editor; errors in the frame are collected. */
async function openFrame(p, button) {
  await p.click(button);
  await p.until("!!document.querySelector('.cos-frame iframe')", 5000);
  await frUntil(p, "!!document.querySelector('.ProseMirror')", 30000);
  await fr(p, "(window.__errs = [], window.addEventListener('error', (e) => window.__errs.push(String(e.message))), window.addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason))), true)");
  await focusEditor(p);
}
const frameErrors = (p) => fr(p, "JSON.stringify(window.__errs ?? [])");
async function closeFrame(p) {
  await p.click("Închide fereastra de documente");
  await p.until("!document.querySelector('.cos-frame')", 5000);
}
const listHas = (pred) =>
  `window.__TAURI_INTERNALS__.invoke("module_call", {id: "kgb.write", command: "list", args: {}}).then(l => l.some(${pred}))`;

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);

  await go(p, "Catalog module");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Documente text'))";
  check("modulul Documente text apare în catalog ca beta", await p.eval(`${card}?.innerText.toLowerCase().includes('beta') ?? false`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Documente text'))");
  await go(p, "Documente text");

  // A new document: typed text, Ctrl+B, Ctrl+S → a new .sdoc of the core; a second Ctrl+S → version 2.
  await openFrame(p, "Document nou");
  check("fereastra de documente COS se deschide în cadrul ei", true);
  await typeText(p, "Contract de vânzare");
  check("textul scris apare în document", (await editorText(p)).includes("Contract de vânzare"), await editorText(p));
  await key(p, "Enter", "Enter", 13);
  await key(p, "b", "KeyB", 66, CTRL);
  await typeText(p, "Părțile");
  check("Ctrl+B scrie îngroșat", (await editorHtml(p)).includes("<strong>Părțile</strong>"), (await editorHtml(p)).slice(0, 200));
  await ctrlS(p);
  await p.until(listHas('d => d.name.endsWith(".sdoc")'), 15000);
  const doc = (await call(p, "list")).find((d) => d.name.endsWith(".sdoc"));
  check("Ctrl+S face un document .sdoc în nucleu", !!doc, doc?.name);
  const saved = Buffer.from((await call(p, "read", { id: doc.id })).data, "base64").toString("utf8");
  check("documentul salvat are textul și îngroșarea", saved.includes("Contract de vânzare") && saved.includes('"bold"'), saved.slice(0, 160));
  await focusEditor(p);
  await toEnd(p);
  await typeText(p, " și cumpărătorul");
  await ctrlS(p);
  await p.until(`window.__TAURI_INTERNALS__.invoke("module_call", ${JSON.stringify({ id: "kgb.write", command: "read", args: { id: doc.id } })}).then(r => r.version === 2)`, 15000);
  check("al doilea Ctrl+S face versiunea 2 a aceluiași document", true);
  await p.screenshot(join(shots, "01-document-nou.png"));
  check("nicio eroare în cadru (document nou)", (await frameErrors(p)) === "[]", await frameErrors(p));
  await closeFrame(p);

  // Reopen it from the list: the text is read back from the core.
  await p.click(doc.name, ".pdf-docs button");
  await p.until(`document.querySelector('.pdf-doc h2')?.textContent === ${JSON.stringify(doc.name)}`, 10000);
  await openFrame(p, "Deschide în fereastra de documente");
  await frUntil(p, "document.querySelector('.ProseMirror')?.innerText.includes('cumpărătorul')", 15000);
  check("redeschis din nucleu, textul e acolo", (await editorText(p)).includes("Părțile și cumpărătorul"), await editorText(p));
  await closeFrame(p);

  // A .docx from the computer: opened, changed, „Unde salvezi? În .docx” → a new version, checked by the core.
  const imp = await p.eval(
    `window.__TAURI_INTERNALS__.invoke("module_import_file", ${JSON.stringify({ id: "kgb.write", path: join(corpus, "52288.docx") })}).then(r => r.document, e => String(e))`,
  );
  check("un .docx de pe calculator se importă", typeof imp === "object", JSON.stringify(imp));
  await go(p, "Catalog module");
  await go(p, "Documente text");
  await p.click("52288.docx", ".pdf-docs button");
  await p.until("document.querySelector('.pdf-doc h2')?.textContent === '52288.docx'", 10000);
  await openFrame(p, "Deschide în fereastra de documente");
  await frUntil(p, "(document.querySelector('.ProseMirror')?.innerText ?? '').trim().length > 0", 20000);
  check(".docx-ul se deschide în fereastra COS, cu textul lui", (await editorText(p)).trim().length > 0);
  await toEnd(p);
  await typeText(p, " Adăugat în K.G.B.");
  await ctrlS(p);
  await frUntil(p, "document.body.innerText.includes('Unde salvezi?')", 8000);
  check("la Ctrl+S întreabă „Unde salvezi?”, ca în COS", true);
  await fr(p, "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'În .docx')?.click(), true");
  await p.until(listHas('d => d.name === "52288.docx" && d.current === 2'), 15000);
  check("„În .docx” face versiunea 2, verificată de nucleu", true);
  const docx2 = Buffer.from((await call(p, "read", { id: imp.id })).data, "base64");
  check("versiunea 2 e un .docx (arhivă zip)", docx2[0] === 0x50 && docx2[1] === 0x4b);
  // 7.4l-5b, importMany: Revizuire › „Combină mai multe .docx…” with the original copy (chosen in the system
  // dialog, replaced here in the page): the difference against the document now shows as a tracked change.
  await p.eval(`(() => { window.kgbHost.open = async (o) => o.multiple ? [${JSON.stringify(join(corpus, "52288.docx"))}] : null; return true; })()`);
  await fr(p, "[...document.querySelectorAll('button, [role=tab]')].find(b => b.textContent.trim() === 'Revizuire')?.click(), true");
  await sleep(400);
  await fr(p, "document.querySelector('[data-testid=docs-combine-many]')?.click(), true");
  const combined = await frUntil(p, "document.querySelectorAll('.ProseMirror .doc-ins, .ProseMirror .doc-del').length", 20000).catch(() => 0);
  check("„Combină mai multe .docx” aduce fișierul ales și arată diferența ca modificare urmărită", combined > 0, `${combined} marcaje`);
  await p.screenshot(join(shots, "02-docx.png"));
  check("nicio eroare în cadru (.docx)", (await frameErrors(p)) === "[]", await frameErrors(p));
  await closeFrame(p);

  // 7.4l-5b: „Folosește în editor” on a model of Documente și modele: a copy (with its {{fields}}) becomes a new
  // document of Documente text and opens in the window; the model stays as it was.
  await go(p, "Catalog module");
  const dcard = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Documente și modele'))";
  await p.eval(`${dcard}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Documente și modele'))", 8000);
  await go(p, "Documente și modele");
  await p.until("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Folosește în editor')", 10000);
  const models = await p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", { id: "kgb.docs", command: "models", args: {} })`);
  const first = models.find((m) => m.format !== "pdf");
  const before = (await call(p, "list")).length;
  await p.eval(
    `(() => { const card = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Folosește în editor')[0]; card.click(); return true; })()`,
  );
  await p.until("!!document.querySelector('.cos-frame iframe')", 15000);
  await frUntil(p, "(document.querySelector('.ProseMirror')?.innerText ?? '').includes('{{')", 25000).catch(() => false);
  const copyText = await editorText(p);
  check("„Folosește în editor” deschide copia modelului în fereastra de documente, cu câmpurile {{…}}", copyText.includes("{{"), copyText.slice(0, 80));
  const after = await call(p, "list");
  check(
    "copia e un document nou în Documente text, cu numele modelului",
    after.length === before + 1 && after.some((d) => d.name === `${first.nume}.docx`),
    after.map((d) => d.name).join(" | "),
  );
  const same = (await p.eval(`window.__TAURI_INTERNALS__.invoke("module_call", { id: "kgb.docs", command: "models", args: {} })`)).find((m) => m.id === first.id);
  check("modelul rămâne neschimbat", same.versiune === first.versiune);
  await p.screenshot(join(shots, "03-din-model.png"));
  await closeFrame(p);

  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  console.log("erori în cadru:", await frameErrors(page).catch(() => "?"));
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
