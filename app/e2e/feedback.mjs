// 7.4l-0e, end to end in the real window: "Trimite o observație" from any page, with COS's window. The text is
// typed, the picture of the window is kept, the note is saved only on this computer (here: <data>\Observatii, the
// tests' throw-away folder; for people: Documents\K.G.B\Observații) and the window says where.
//
// Usage: node app/e2e/feedback.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data. "Deschide dosarul" is not pressed (it
// would open Explorer on the screen).
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node feedback.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-feedback-"));
const PORT = 9351;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  const dlg = "[role=dialog][aria-label='Trimite o observație']";

  // From a page other than the start page.
  await p.click("Parteneri", "nav .nav");
  await p.until("document.querySelector('.page-head h1')?.textContent === 'Parteneri'", 10000);
  check("butonul „Trimite o observație” e sub navigare", await p.eval("!!document.querySelector('aside .feedback-btn')"));
  await p.click("Trimite o observație", "aside button");
  await p.until(`!!document.querySelector("${dlg}")`, 15000);
  const where = await p.eval(`document.querySelector("${dlg} .feedback-where")?.innerText ?? ''`);
  check("fereastra spune pagina", where.includes("Parteneri"), where);
  const pic = await p.eval(`(() => { const i = document.querySelector("${dlg} .feedback-pic img"); return i ? [i.naturalWidth, i.naturalHeight] : null; })()`);
  check("poza ferestrei e făcută (înainte de fereastră)", !!pic && pic[0] > 400 && pic[1] > 300, JSON.stringify(pic));
  await p.eval(`document.querySelector("${dlg} textarea").focus()`);
  await p.send("Input.insertText", { text: "Am apăsat Salvează și nu s-a întâmplat nimic.\nA doua linie." });
  await sleep(200);
  await p.click("Salvează observația", `${dlg} button`);
  await p.until(`(document.querySelector("${dlg}")?.innerText ?? '').includes('Am salvat observația')`, 10000);
  const done = await p.eval(`document.querySelector("${dlg}").innerText`);
  check("fereastra spune unde s-a salvat", done.includes("Observatii"), done.replace(/\s+/g, " ").slice(0, 160));
  await p.screenshot(join(shots, "01-observatie-salvata.png"));

  // The files, only on this computer.
  const dir = join(data, "Observatii");
  const files = readdirSync(dir);
  const txt = files.find((f) => /^Observație \d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}\.txt$/.test(f));
  const png = files.find((f) => f.endsWith(".png"));
  check("textul și poza sunt în dosarul observațiilor", !!txt && !!png, files.join(", "));
  const body = txt ? readFileSync(join(dir, txt), "utf8") : "";
  check(
    "fișierul text are pagina, versiunea, poza și ce s-a scris",
    body.includes("Pagina: Parteneri") && body.includes("Versiunea K.G.B.:") && body.includes(`Captura: ${png}`) && body.includes("Am apăsat Salvează și nu s-a întâmplat nimic.\r\nA doua linie."),
    body.slice(0, 200),
  );
  const head = png ? readFileSync(join(dir, png)).subarray(0, 8) : Buffer.alloc(0);
  check("poza e un PNG", head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && statSync(join(dir, png)).size > 10000);
  await p.click("Închide", `${dlg} button`);
  await p.until(`!document.querySelector("${dlg}")`, 5000);
  check("„Închide” închide fereastra", true);
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
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
