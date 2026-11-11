// 7.9e, end to end in the real window: „Programări” — a resource with its hours and lunch break, a service, the free
// times of tomorrow, an appointment booked from a free time, the same time refused for a second client, a state
// changed, and the reminder „Mâine: …” in the bell without the client's name or phone.
//
// Usage: node app/e2e/appointments.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node appointments.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-appointments-"));
const PORT = 9352;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
const setValue = (p, sel, v) =>
  p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clickText = (p, text, scope = "") =>
  p.eval(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); b?.click(); return !!b; })()`);
const z = (n) => String(n).padStart(2, "0");
const t = new Date(Date.now() + 86_400_000);
const tomorrow = `${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())}`;
const today = new Date().toLocaleDateString("sv-SE");

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === 'Programări')";
  check("modulul Programări e în catalog, beta", await p.eval(`${card}?.innerText.toLowerCase().includes('beta') ?? false`));
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith('Programări'))", 8000);
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Programări')).click()");
  await p.until("!!document.querySelector('.appointments')", 8000);

  // A resource every day 08:00–16:00 with a lunch break, and a 30-minute service, from the page.
  await clickText(p, "Resurse și servicii", ".appointments");
  await p.until("!!document.querySelector(\"input[aria-label='Numele resursei']\")", 5000);
  await setValue(p, "input[aria-label='Numele resursei']", "Dr. Ionescu");
  await setValue(p, "input[aria-label='Pauza']", "12:00-13:00");
  await setValue(p, "input[aria-label='Zilele de lucru']", "1234567");
  await clickText(p, "Adaugă resursa", ".appointments");
  await p.until("document.querySelector('.appointments').innerText.includes('Dr. Ionescu')", 8000);
  await setValue(p, "input[aria-label='Numele serviciului']", "Consultație");
  await setValue(p, "input[aria-label='Prețul serviciului']", "150");
  await clickText(p, "Adaugă serviciul", ".appointments");
  await p.until("document.querySelector('.appointments').innerText.includes('Consultație · 30 min · 150,00 lei')", 8000);
  check("resursa cu programul și pauza, serviciul cu durata și prețul", true);

  // Tomorrow's free times, a time chosen, the appointment booked.
  await clickText(p, "Ziua", ".appointments");
  await setValue(p, "input[aria-label='Data']", tomorrow);
  await p.until("!!document.querySelector(\"select[aria-label='Serviciul']\") && document.querySelector(\"select[aria-label='Serviciul']\").options.length > 1", 8000);
  await p.eval("(() => { const s = document.querySelector(\"select[aria-label='Serviciul']\"); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()");
  await clickText(p, "Caută orele libere", ".appointments");
  await p.until("!!document.querySelector('.appt-free button')", 8000);
  const times = await p.eval("[...document.querySelectorAll('.appt-free button')].map(b => b.textContent.trim())");
  check("orele libere: de la 08:00, fără pauza de masă, ultima 15:30", times[0] === "08:00" && !times.includes("12:00") && times.includes("13:00") && times.includes("15:30") && !times.includes("15:35"), times.slice(0, 5).join(",") + "…");
  await clickText(p, "09:00", ".appt-free");
  await setValue(p, "input[aria-label='Clientul']", "Popescu Maria");
  await setValue(p, "input[aria-label='Telefonul clientului']", "0722 000 111");
  await clickText(p, "Programează", ".appointments");
  await p.until("document.querySelector('.appointments [role=status]')?.innerText.includes('Programare făcută')", 8000);
  await p.until("[...document.querySelectorAll('[data-testid=appt]')].some(a => a.innerText.includes('09:00–09:30') && a.innerText.includes('Popescu Maria'))", 8000);
  check("programarea apare în coloana resursei, 09:00–09:30", true);

  // The same time for another client: refused by the module, with the reason.
  const day = await invoke(p, "module_call", { id: "kgb.appointments", command: "zi", args: { data: tomorrow } });
  const res = day.resurse[0].resursa;
  const twice = await invoke(p, "module_call", { id: "kgb.appointments", command: "programare_save", args: { start: `${tomorrow}T09:15`, resursa: res, durata: 30, client: "Altcineva" } });
  check("aceeași oră pentru alt client e refuzată", /are deja o programare/.test(twice.error ?? ""), JSON.stringify(twice).slice(0, 140));

  // A state from the card.
  await p.eval("[...document.querySelectorAll('[data-testid=appt] button')].find(b => b.textContent.trim() === 'confirmat').click()");
  await p.until("[...document.querySelectorAll('[data-testid=appt]')].some(a => a.innerText.includes('confirmat'))", 8000);
  check("starea se schimbă din card (confirmat)", true);
  await p.screenshot(join(shots, "01-programari.png"));

  // The reminder for tomorrow: a count, no name or phone.
  await invoke(p, "reminders_tick", { azi: today });
  await invoke(p, "reminders_tick", { azi: today });
  const bell = (await invoke(p, "notifications_list", {})).items.filter((n) => n.module === "kgb.appointments");
  check(
    "memento „Mâine: o programare”, o singură dată, fără nume și telefon",
    bell.length === 1 && bell[0].titlu === "Mâine: o programare" && !JSON.stringify(bell).includes("Popescu") && !JSON.stringify(bell).includes("0722"),
    JSON.stringify(bell.map((b) => b.titlu)),
  );
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
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
