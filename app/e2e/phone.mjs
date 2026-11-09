// Etapa 7 step 7.4m, end to end: the phone page. The real app starts the
// page from its „Telefon” screen; this script then plays the phone, with the
// same HTTP requests the phone page makes (from this PC, 127.0.0.1):
// - the page is served; a wrong code is refused; the right one pairs;
// - the phone waits until it is approved on the PC, with a person chosen;
// - it sends driver documents with a photo, and a bank statement;
// - on the PC both appear; the photo opens; the statement is imported into
//   Business; a removed phone can no longer send.
//
// Usage: node app/e2e/phone.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR), never the user's real data.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node phone.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-phone-"));
const PORT = 9363;
const BASE = "http://127.0.0.1:8737";
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
let token = "";
const phone = async (path, body) => {
  const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-KGB-Token": token }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};
// A 1×1 PNG.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

try {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  // Business with a bank account, for the statement.
  await p.click("Catalog module", "nav .nav");
  const card = "[...document.querySelectorAll('.card')].find(c => c.innerText.includes('Business'))";
  await p.until(`!!${card}`, 5000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Business'))", 5000);
  await invoke(p, "module_call", { id: "kgb.business", command: "account_save", args: { tip: "banca", nume: "Banca X" } });

  await p.click("Telefon", "nav .nav");
  await p.until("!!document.querySelector('.phone-page')", 5000);
  check("la început pagina de telefon e oprită", (await p.eval("document.querySelector('.phone-server').innerText")).includes("e oprită"));
  const before = await fetch(BASE + "/m").then(() => "răspunde", () => "închis");
  check("oprită, nu răspunde nimic în rețea", before === "închis");
  await p.click("Pornește pagina de telefon", ".phone-page button");
  await p.until("!!document.querySelector('.phone-code')", 8000);
  const code = await p.eval("document.querySelector('.phone-code').innerText");
  const addr = await p.eval("document.querySelector('.phone-address').innerText");
  check("pornită: adresa din rețea și codul de asociere", /^http:\/\/[\d.]+:8737\/m$/.test(addr) && /^\d{4}-\d{4}$/.test(code), `${addr} · ${code}`);
  await p.screenshot(join(shots, "01-pc-pornit.png"));

  const html = await fetch(BASE + "/m").then((r) => r.text());
  check("telefonul primește pagina", html.includes("Asociază telefonul") && html.includes("Fișă de recepție"));
  const bad = await phone("/m/api/asociere", { cod: "0000-0000", nume: "Telefon depozit" });
  check("un cod greșit e refuzat", bad.status === 403);
  const ok = await phone("/m/api/asociere", { cod: code, nume: "Telefon depozit" });
  token = ok.json?.token ?? "";
  check("codul corect asociază telefonul", ok.status === 200 && token.length === 64);
  check("codul se folosește o singură dată", (await phone("/m/api/asociere", { cod: code, nume: "Alt telefon" })).status === 403);
  check("telefonul așteaptă aprobarea", (await phone("/m/api/eu")).json?.stare === "asteapta");
  check("neaprobat, nu poate trimite", (await phone("/m/api/trimite", { tip: "document", campuri: { nota: "x" }, fisiere: [] })).status !== 200);

  await p.until("!!document.querySelector(\".phone-page [data-phone='Telefon depozit']\")", 8000);
  await p.click("Aprobă", ".phone-page button");
  await p.until("(document.querySelector('.phone-page').innerText).includes('Telefoane asociate')", 8000);
  const me = (await phone("/m/api/eu")).json;
  check("aprobat pe PC, cu persoana aleasă", me?.stare === "aprobat" && me?.membru === "Proprietar", JSON.stringify(me));

  const sent = await phone("/m/api/trimite", { tip: "document", campuri: { sofer: "Vasile Pop", vehicul: "IS-01-ABC", nota: "aviz și CMR" }, fisiere: [{ nume: "aviz.png", mime: "image/png", date: PNG }] });
  check("telefonul trimite documentele de la șofer, cu poza", sent.status === 200, JSON.stringify(sent.json));
  const csv = Buffer.from("Data;Descriere;Debit;Credit\r\n05.11.2026;Încasare client;;500,00\r\n").toString("base64");
  check("și un extras de cont", (await phone("/m/api/trimite", { tip: "extras", campuri: { banca: "Banca X" }, fisiere: [{ nume: "extras.csv", mime: "text/csv", date: csv }] })).status === 200);

  await p.until("document.querySelectorAll('.phone-inbox li').length === 2", 8000);
  const inbox = await p.eval("document.querySelector('.phone-inbox').innerText");
  check("pe PC apar amândouă, cu cine le-a trimis", inbox.includes("Documente de la șofer") && inbox.includes("Vasile Pop") && inbox.includes("Proprietar (Telefon depozit)"), inbox.split("\n").slice(0, 4).join(" | "));
  await p.eval("[...document.querySelectorAll('.phone-inbox button')].find(b => b.innerText.startsWith('arată poza')).click()");
  await p.until("!!document.querySelector('.phone-inbox img.phone-photo')", 5000);
  check("poza se deschide pe PC", await p.eval("document.querySelector('.phone-inbox img.phone-photo').src.startsWith('blob:')"));
  await p.click("Importă în Business", ".phone-inbox button");
  await p.until("document.querySelector('.phone-page').innerText.includes('Extras importat în Business: 1 operații noi')", 8000);
  check("extrasul de pe telefon se importă în Business", true);
  await p.screenshot(join(shots, "02-pc-primite.png"));

  // 7.4m-5: a reception sheet with lines, turned into a Business reception.
  const biz = (command, args = {}) => invoke(p, "module_call", { id: "kgb.business", command, args });
  const prod = await biz("product_save", { cod: "FE", nume: "Fier vechi", um: "kg" });
  const cu = await biz("product_save", { cod: "CU", nume: "Cupru", um: "kg" });
  await biz("warehouse_save", { nume: "Curte" });
  const plist = (await phone("/m/api/produse")).json?.produse ?? [];
  check("telefonul primește lista de produse din Business", plist.some((x) => x.nume === "Fier vechi" && x.um === "kg"), JSON.stringify(plist));
  const rec = await phone("/m/api/trimite", {
    tip: "receptie",
    campuri: { furnizor: "Fier Vechi SRL", document: "AV-77", vehicul: "IS-02-XYZ" },
    fisiere: [{ nume: "linia1.png", mime: "image/png", date: PNG }],
    linii: [
      { categorie: "Fier vechi", produs: prod.id, um: "kg", brut: "12.450", tara: "8.200", foto: 0 },
      { categorie: "cupru curat", um: "kg", cantitate: "125,5" },
    ],
  });
  check("telefonul trimite o fișă de recepție pe linii (cântărire, poză pe linie)", rec.status === 200, JSON.stringify(rec.json));
  await p.until("!!document.querySelector('.reception-lines')", 8000);
  const lt = await p.eval("document.querySelector('.reception-lines').innerText");
  check("pe PC: liniile, cu netul calculat (12.450 − 8.200 = 4.250 kg)", lt.includes("4.250 kg") && lt.includes("125,5 kg") && lt.includes("brut 12.450"), lt.replace(/\n/g, " | "));
  await p.click("Fă recepția în Business", ".phone-inbox button");
  await p.until("!!document.querySelector(\"select[aria-label='Produsul liniei 2']\")", 5000);
  await p.fill("select[aria-label='Produsul liniei 2']", cu.id);
  await p.fill("input[aria-label='Prețul liniei 1']", "1,20");
  await p.fill("input[aria-label='Prețul liniei 2']", "35");
  await p.click("Înregistrează recepția", ".reception-to-business button");
  await p.until("document.querySelector('.phone-page').innerText.includes('Recepția a fost înregistrată în Business')", 8000);
  const stock = await biz("stock", {});
  const q = (name) => stock.find((r) => r.nume === name)?.cantitate_text;
  check("recepția e în stocul din Business: 4.250 kg fier, 125,5 kg cupru", q("Fier vechi") === "4.250" && q("Cupru") === "125,5", `${q("Fier vechi")} / ${q("Cupru")}`);
  await p.screenshot(join(shots, "03-receptie-linii.png"));

  await p.eval("[...document.querySelectorAll('.phone-page button')].find(b => b.innerText === 'scoate').click()");
  await p.until("!document.querySelector('.phone-page').innerText.includes('Telefoane asociate')", 5000);
  check("scos de pe PC, telefonul nu mai poate trimite", (await phone("/m/api/trimite", { tip: "document", campuri: { nota: "y" }, fisiere: [] })).status !== 200 && (await phone("/m/api/eu")).json?.stare === "revocat");
  await p.click("Oprește pagina", ".phone-page button");
  await sleep(500);
  check("oprită, nu mai răspunde", (await fetch(BASE + "/m").then(() => "răspunde", () => "închis")) === "închis");

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
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
