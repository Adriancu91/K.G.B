// Etapa 6 step 6.5, end to end: the real app (PC A, window) and a second
// K.G.B. node in another process (PC B, `kgb-sync-node`, no window) on the
// same laptop, over real sockets (loopback, no relay):
// A creates the organization and invites Ion; B answers; A approves; B pulls
// A's data over the network; B writes a note; A clicks "Sincronizează acum"
// and gets it (direct path); B goes away: A reports it without freezing.
// This proves the program works over the network; it proves nothing about a
// LAN or the internet (🔒 6.10, second PC).
//
// Usage: node app/e2e/network.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Needs target/debug/kgb-sync-node.exe (cargo build -p kgb-net).
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node network.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
const nodeExe = join(dirname(exe), "..", "debug", "kgb-sync-node.exe");
mkdirSync(shots, { recursive: true });
const dataA = mkdtempSync(join(tmpdir(), "kgb-net-a-"));
const dataB = mkdtempSync(join(tmpdir(), "kgb-net-b-"));
const wsB = join(dataB, "ws");
const keyB = join(dataB, "key");
const PORT = 9348;
let proc;
let page;
let serving;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const setValue = (p, sel, value) =>
  p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const nodeRun = (...args) => execFileSync(nodeExe, args, { encoding: "utf8", timeout: 120000 });
const memberRow = (name) => `[...document.querySelectorAll('.members-table tbody tr')].find(r => r.cells[0].innerText.startsWith(${JSON.stringify(name)}))`;

async function start() {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST-A", KGB_DATA_DIR: dataA, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.eval("window.confirm = () => true");
  return p;
}

try {
  if (!existsSync(nodeExe)) throw new Error(`lipsește ${nodeExe} (cargo build -p kgb-net)`);
  const p = await start();
  // Notes, and a note on A.
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Note (demonstrativ)')";
  await p.until(`!!${card}`);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Note'))");
  await p.click("Note (demonstrativ)", "nav .nav");
  await p.fill("input[aria-label='Notă nouă']", "Notă de pe PC-ul A");
  await p.click("Adaugă");
  await p.until("[...document.querySelectorAll('.list li')].some(l => l.innerText.includes('PC-ul A'))");

  // Organization: the network starts by itself.
  await p.click("Organizație", "nav .nav");
  await p.until("!!document.querySelector('.net-state')");
  check("fără organizație rețeaua e oprită", (await p.eval("document.querySelector('.net-state').innerText")).includes("oprită"));
  await setValue(p, "form[aria-label='Creează organizația'] input", "Firma Test SRL");
  await p.click("Creează organizația");
  await p.until("!!document.querySelector('.members-table')");
  await p.until("document.querySelector('.net-state')?.innerText.includes('pornită')", 15000);
  check("cu organizație rețeaua pornește singură", true);
  await setValue(p, "input[aria-label='Numele persoanei']", "Ion Test");
  await p.click("Adaugă persoana");
  await p.until(`!!${memberRow("Ion Test")}`);
  await p.eval(`[...${memberRow("Ion Test")}.querySelectorAll('button')].find(b => b.innerText === 'invită un PC').click()`);
  await p.until("!!document.querySelector('.invite-box')");
  await p.click("Creează invitația");
  await p.until("!!document.querySelector(\"textarea[aria-label='Codul invitației']\")");
  const invite = await p.eval("document.querySelector(\"textarea[aria-label='Codul invitației']\").value");
  writeFileSync(join(dataB, "invite.txt"), invite);

  // PC B answers the invitation.
  const fpB = nodeRun("join", wsB, keyB, join(dataB, "invite.txt"), join(dataB, "request.txt")).trim();
  const request = readFileSync(join(dataB, "request.txt"), "utf8");
  await setValue(p, "textarea[aria-label='Codul cererii']", request);
  await p.click("Primește cererea");
  await p.until("!!document.querySelector('.pending-table tbody tr')");
  check("cererea PC-ului B ajunge cu aceeași amprentă", (await p.eval("document.querySelector('.pending-table').innerText")).includes(fpB), fpB);
  await p.click("Aprobă");
  await p.until("!document.querySelector('.pending-table')");

  // PC B pulls from the app over the network.
  const outB = JSON.parse(nodeRun("pull-all", wsB, keyB));
  check("PC B primește datele de la aplicație prin rețea", outB.length === 1 && !outB[0].error && outB[0].summary.create > 0 && outB[0].path === "direct", JSON.stringify(outB[0]).slice(0, 200));
  nodeRun("note", wsB, "Notă de pe PC-ul B");
  nodeRun("file", wsB, "kgb.notes", "anexa-test.bin", "5000000");

  // PC B serves; the app synchronises now.
  serving = spawn(nodeExe, ["serve", wsB, keyB, join(dataB, "addr.json")], { stdio: "ignore" });
  const t0 = Date.now();
  while (!existsSync(join(dataB, "addr.json"))) {
    if (Date.now() - t0 > 30000) throw new Error("nodul B nu a pornit");
    await sleep(100);
  }
  await sleep(300);
  await p.click("Sincronizează acum");
  await p.until("!!document.querySelector('.sync-result')", 30000);
  const res = await p.eval("document.querySelector('.sync-result').innerText");
  check("„Sincronizează acum” aduce schimbările lui Ion", /[1-9]\d* noi/.test(res), res);
  check("fișierul atașat de Ion vine separat, verificat (6.8)", res.includes("1 fișiere primite"), res);
  await p.until("[...document.querySelectorAll('.peers-table tbody tr')].some(r => r.innerText.includes('directă'))", 20000);
  check("starea arată calea directă", true);
  await p.eval("document.querySelector('.invite-box button.link')?.click()");
  await sleep(200);
  await p.eval("document.querySelectorAll('textarea').forEach(t => { if (t.value.startsWith('KGB-')) t.value = '(codul conține adresele de rețea ale laptopului; ascuns în captură)'; })");
  await p.screenshot(join(shots, "01-retea.png"));
  await p.click("Note (demonstrativ)", "nav .nav");
  await p.until("[...document.querySelectorAll('.list li')].some(l => l.innerText.includes('PC-ul B'))", 5000);
  check("nota scrisă pe PC-ul B apare în aplicație", true);

  // PC B goes away: the app says so, and stays usable meanwhile.
  serving.kill();
  serving = null;
  await p.click("Organizație", "nav .nav");
  await p.until("!!document.querySelector('.net-panel button.primary')");
  await p.click("Sincronizează acum");
  await sleep(500);
  const alive = await p.eval("document.querySelector('.net-panel button.primary').innerText");
  check("fereastra rămâne folosibilă cât timp așteaptă", alive.includes("Se sincronizează"), alive);
  await p.until("!!document.querySelector('.sync-result') && document.querySelector('.sync-result').innerText.includes('nu a răspuns')", 40000);
  check("lipsa PC-ului B e spusă clar", true, await p.eval("document.querySelector('.sync-result').innerText"));
  await p.screenshot(join(shots, "02-offline.png"));

  // Step 6.7: the administrator revokes PC B.
  await p.eval("[...document.querySelectorAll('.peers-table button')].find(b => b.innerText === 'revocă').click()");
  await p.until("!document.querySelector('.peers-table')", 5000);
  check("după revocare PC-ul B dispare din listă", (await p.eval("document.querySelector('.net-panel').innerText")).includes("Niciun alt calculator"));
  check("Ion rămâne în organizație, fără dispozitiv", (await p.eval(`${memberRow("Ion Test")}.cells[2].innerText`)).includes("niciunul"));
  const outRev = JSON.parse(nodeRun("pull-all", wsB, keyB));
  check("PC-ul B revocat e refuzat de aplicație", outRev.length === 1 && (outRev[0].error ?? "").includes("nu e aprobat"), JSON.stringify(outRev).slice(0, 200));
  await p.screenshot(join(shots, "03-revocat.png"));
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
} catch (e) {
  check("scenariul a rulat până la capăt", false, e.message);
  await page?.screenshot(join(shots, "eroare.png")).catch(() => {});
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(proc?.pid)], { stdio: "ignore" });
  } catch {
    /* already gone */
  }
} finally {
  serving?.kill();
  await sleep(500);
  rmSync(dataA, { recursive: true, force: true });
  rmSync(dataB, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
