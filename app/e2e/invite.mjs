// Etapa 6 step 6.2, end to end in the real window, with two "PCs" on the
// same laptop (two data folders, so two device keys), run one after the
// other: PC A creates the organization and invites Ion; PC B answers the
// invitation; PC A receives the request, sees the same fingerprint, approves;
// the same request cannot be used twice; a forced restart keeps everything.
//
// Usage: node app/e2e/invite.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses throw-away data folders (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node invite.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const dataA = mkdtempSync(join(tmpdir(), "kgb-pc-a-"));
const dataB = mkdtempSync(join(tmpdir(), "kgb-pc-b-"));
const PORT = 9346;
let proc;
let page;
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

async function start(data) {
  proc = spawn(exe, [], {
    // A test computer name, so screenshots never show the real one.
    env: { ...process.env, COMPUTERNAME: data === dataA ? "PC-TEST-A" : "PC-TEST-B", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.eval("window.confirm = () => true");
  await p.click("Organizație", "nav .nav");
  return p;
}
function stop(p) {
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
}
const memberRow = (name) => `[...document.querySelectorAll('.members-table tbody tr')].find(r => r.cells[0].innerText.startsWith(${JSON.stringify(name)}))`;

try {
  // ---- PC A: organization and invitation.
  let p = await start(dataA);
  await p.until("!!document.querySelector('form[aria-label=\"Creează organizația\"]')");
  await setValue(p, "form[aria-label='Creează organizația'] input", "Firma Test SRL");
  await p.click("Creează organizația");
  await p.until("!!document.querySelector('.members-table')");
  await setValue(p, "input[aria-label='Numele persoanei']", "Ion Test");
  await p.click("Adaugă persoana");
  await p.until(`!!${memberRow("Ion Test")}`);
  await p.eval(`[...${memberRow("Ion Test")}.querySelectorAll('button')].find(b => b.innerText === 'invită un PC').click()`);
  await p.until("!!document.querySelector('.invite-box')");
  await p.click("Creează invitația");
  await p.until("!!document.querySelector(\"textarea[aria-label='Codul invitației']\")");
  const invite = await p.eval("document.querySelector(\"textarea[aria-label='Codul invitației']\").value");
  check("invitația are formatul așteptat", invite.startsWith("KGB-INVITATIE-1:"), invite.slice(0, 20));
  await p.eval("document.querySelectorAll('textarea').forEach(t => { if (t.value.startsWith('KGB-')) t.value = '(codul conține adresele de rețea ale laptopului; ascuns în captură)'; })");
  await p.screenshot(join(shots, "01-invitatie.png"));
  const fpA = await p.eval("document.querySelector('.org-current').innerText.split('amprenta PC-ului: ')[1].trim()");
  stop(p);

  // ---- PC B: answer the invitation.
  p = await start(dataB);
  await p.click("Dispozitive și sincronizare", "nav .nav");
  await p.until("!!document.querySelector(\"textarea[aria-label='Codul invitației primite']\")");
  await setValue(p, "textarea[aria-label='Codul invitației primite']", invite.slice(0, -6) + "AAAAAA");
  await p.click("Verifică invitația");
  await p.until("!!document.querySelector('.error')", 5000);
  check("o invitație modificată e refuzată", (await p.eval("document.querySelector('.error').innerText")).includes("invitația"));
  await setValue(p, "textarea[aria-label='Codul invitației primite']", invite);
  await p.click("Verifică invitația");
  await p.until("!!document.querySelector('.join-answer')");
  const answer = await p.eval("document.querySelector('.join-answer').innerText");
  check("PC-ul nou vede organizația, persoana și amprenta administratorului", answer.includes("Firma Test SRL") && answer.includes("Ion Test") && answer.includes(fpA), answer.slice(0, 160));
  const request = await p.eval("document.querySelector(\"textarea[aria-label='Codul cererii']\").value");
  const fpB = await p.eval("document.querySelector('.join-answer strong.fingerprint').innerText.trim()");
  check("cererea are formatul așteptat", request.startsWith("KGB-CERERE-1:"));
  await p.eval("document.querySelectorAll('textarea').forEach(t => { if (t.value.startsWith('KGB-')) t.value = '(codul conține adresele de rețea ale laptopului; ascuns în captură)'; })");
  await p.screenshot(join(shots, "02-pc-nou.png"));
  stop(p);

  // ---- PC A: receive, compare, approve.
  p = await start(dataA);
  await p.click("Dispozitive și sincronizare", "nav .nav");
  await p.until("!!document.querySelector(\"textarea[aria-label='Codul cererii']\")");
  await setValue(p, "textarea[aria-label='Codul cererii']", request);
  await p.click("Primește cererea");
  await p.until("!!document.querySelector('.pending-table tbody tr')");
  const pend = await p.eval("document.querySelector('.pending-table tbody tr').innerText");
  check("administratorul vede aceeași amprentă ca PC-ul nou", pend.includes(fpB) && pend.includes("Ion Test"), pend);
  check("invitația apare ca folosită", (await p.eval("document.querySelector('.invites-table').innerText")).includes("folosită"));
  await p.screenshot(join(shots, "03-cerere.png"));
  await p.click("Aprobă");
  await p.until("!document.querySelector('.pending-table')");
  await p.until("[...document.querySelectorAll('.devices-table tbody tr')].some(r => r.innerText.includes('Ion Test') && r.innerText.includes('activ'))", 20000);
  check("după aprobare calculatorul lui Ion apare activ în listă", true);
  await p.click("Organizație", "nav .nav");
  await p.until("!!document.querySelector('.members-table')");
  check("după aprobare Ion are un dispozitiv", (await p.eval(`${memberRow("Ion Test")}.cells[2].innerText.trim()`)) === "1");
  check("registrul semnat se potrivește", !(await p.eval("document.body.innerText.includes('Registrul semnat al organizației nu se potrivește')")));
  await p.click("Dispozitive și sincronizare", "nav .nav");
  await p.until("!!document.querySelector(\"textarea[aria-label='Codul cererii']\")");

  await setValue(p, "textarea[aria-label='Codul cererii']", request);
  await p.click("Primește cererea");
  await p.until("!!document.querySelector('.error')", 5000);
  const err = await p.eval("document.querySelector('.error').innerText");
  check("aceeași cerere nu se poate folosi de două ori", err.includes("deja folosită"), err);
  await p.screenshot(join(shots, "04-aprobat.png"));
  stop(p);

  p = await start(dataA);
  await p.until("!!document.querySelector('.members-table')");
  check("după repornire (forțată) dispozitivul rămâne aprobat", (await p.eval(`${memberRow("Ion Test")}.cells[2].innerText.trim()`)) === "1");
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
  rmSync(dataA, { recursive: true, force: true });
  rmSync(dataB, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
