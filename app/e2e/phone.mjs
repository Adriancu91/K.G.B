// Etapa 7 step 7.4m, end to end: the phone page. The real app starts the
// page from its „Telefon” screen; this script then plays the phone, with the
// same HTTP requests the phone page makes (from this PC, 127.0.0.1):
// - the page is served; a wrong code is refused; the right one pairs;
// - the phone waits until it is approved on the PC, with a person chosen;
// - it sends driver documents with a photo, and a bank statement;
// - on the PC both appear; the photo opens; the statement is imported into
//   Business; a removed phone can no longer send.
// - 7.4m-4: the page answers other PCs' pages (CORS), tells the phone the
//   addresses of the PCs that serve it and the common name; this PC answers
//   to kgb.local; the switch is remembered: after a restart the page is back
//   by itself and the phone still works.
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

const launch = async () => {
  proc = spawn(exe, [], {
    env: { ...process.env, COMPUTERNAME: "PC-TEST", KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  return p;
};

try {
  let p = await launch();
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
  // Team, for the timesheet from the phone (7.4m-6b).
  await p.click("Catalog module", "nav .nav");
  const teamCard = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Echipă și pontaj')";
  await p.until(`!!${teamCard}`, 5000);
  await p.eval(`${teamCard}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Echipă'))", 5000);
  await invoke(p, "module_call", { id: "kgb.team", command: "angajat_save", args: { nume: "Proprietar" } });

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

  // 7.4m-6: an inventory counted on the phone, then a photographed receipt.
  const inv = await phone("/m/api/trimite", {
    tip: "inventar",
    campuri: { depozit: "Curte" },
    fisiere: [],
    linii: [
      { categorie: "Fier vechi", produs: prod.id, um: "kg", cantitate: "4.200" },
      { categorie: "Cupru", produs: cu.id, um: "kg", cantitate: "125,5" },
    ],
  });
  check("telefonul trimite un inventar numărat", inv.status === 200, JSON.stringify(inv.json));
  check("un inventar fără produs din listă e refuzat", (await phone("/m/api/trimite", { tip: "inventar", campuri: {}, fisiere: [], linii: [{ categorie: "Ceva", cantitate: "1" }] })).status === 400);
  await p.until("[...document.querySelectorAll('.phone-inbox button')].some(b => b.innerText.startsWith('Fă inventarul în Business'))", 8000);
  await p.click("Fă inventarul în Business", ".phone-inbox button");
  await p.until("[...document.querySelectorAll('.reception-to-business button')].some(b => b.innerText === 'Înregistrează inventarul' && !b.disabled)", 5000);
  await p.click("Înregistrează inventarul", ".reception-to-business button");
  await p.until("document.querySelector('.phone-page').innerText.includes('Inventarul a fost înregistrat în Business')", 8000);
  const invMsg = await p.eval("[...document.querySelectorAll('.phone-page p, .phone-page div')].map(e => e.innerText).find(t => t.startsWith('Inventarul a fost')) ?? ''");
  const stock2 = await biz("stock", {});
  const q2 = (name) => stock2.find((r) => r.nume === name)?.cantitate_text;
  check("inventarul ajunge în Business: diferența la fier, stocul corectat", invMsg.includes("Fier vechi -50") && q2("Fier vechi") === "4.200" && q2("Cupru") === "125,5", `${invMsg} / ${q2("Fier vechi")}`);

  const bon = await phone("/m/api/trimite", { tip: "bon", campuri: { furnizor: "Benzinăria X", suma: "250,40", data: "2026-11-09", ce: "motorină" }, fisiere: [{ nume: "bon.png", mime: "image/png", date: PNG }] });
  check("telefonul trimite poza unui bon de cheltuială, cu suma", bon.status === 200, JSON.stringify(bon.json));
  check("un bon fără poză e refuzat", (await phone("/m/api/trimite", { tip: "bon", campuri: { suma: "10" }, fisiere: [] })).status === 400);
  await p.until("[...document.querySelectorAll('.phone-inbox button')].some(b => b.innerText === 'Înregistrează plata în Business')", 8000);
  await p.click("Înregistrează plata în Business", ".phone-inbox button");
  await p.until("document.querySelector('.phone-page').innerText.includes('Plata de 250,40 lei a fost înregistrată în Business')", 8000);
  const pays = await biz("payments", {});
  check("bonul devine o plată în Business, cu explicația", JSON.stringify(pays).includes("Benzinăria X") && JSON.stringify(pays).includes("motorină"), JSON.stringify(pays).slice(0, 300));

  // 7.4m-6c: the driver's deliveries on the phone; stages applied on the PC.
  const mine = await biz("delivery_save", { destinatar: "Client Test SRL", adresa: "Str. Fabricii 1, Iași", data: "2026-11-09", linii: [{ descriere: "Fier vechi", cantitate: "2.000", um: "kg" }] });
  const other = await biz("delivery_save", { destinatar: "Alt Client", adresa: "Bacău", data: "2026-11-09", linii: [{ descriere: "Cupru", cantitate: "10", um: "kg" }] });
  await biz("delivery_step", { id: mine.id, etapa: "incarcat", campuri: { vehicul: "IS-01-ABC", sofer: "Proprietar" } });
  await biz("delivery_step", { id: other.id, etapa: "incarcat", campuri: { vehicul: "BC-02-XYZ", sofer: "Alt Șofer" } });
  const trips = (await phone("/m/api/livrari")).json?.livrari ?? [];
  check("telefonul vede doar livrările în care persoana lui e șofer", trips.length === 1 && trips[0].numar === mine.numar && trips[0].linii[0].cantitate === "2.000", JSON.stringify(trips));
  const go = await phone("/m/api/trimite", { tip: "livrare", campuri: { livrare: mine.id, numar: mine.numar, etapa: "in_drum", aviz: "AV-901" }, fisiere: [] });
  check("șoferul trimite „am plecat”, cu avizul", go.status === 200, JSON.stringify(go.json));
  await p.until("[...document.querySelectorAll('.stage-to-business button')].length === 1", 8000);
  await p.click("Trece etapa în Business", ".stage-to-business button");
  await p.until("document.querySelector('.phone-page').innerText.includes('e acum „în drum” în Business')", 8000);
  const done1 = await phone("/m/api/trimite", { tip: "livrare", campuri: { livrare: mine.id, numar: mine.numar, etapa: "livrat", primit_de: "Ion Client" }, fisiere: [{ nume: "aviz-semnat.png", mime: "image/png", date: PNG }] });
  check("…apoi „am livrat”, cu poza avizului semnat", done1.status === 200);
  await p.until("[...document.querySelectorAll('.stage-to-business button')].length === 1", 8000);
  await p.click("Trece etapa în Business", ".stage-to-business button");
  await p.until("document.querySelector('.phone-page').innerText.includes('e acum „livrat” în Business')", 8000);
  const dl = (await biz("deliveries", {})).find((d) => d.id === mine.id);
  check("în Business livrarea e „livrat”, cu avizul și cine a primit", dl?.etapa === "livrat" && dl?.campuri?.aviz === "AV-901" && dl?.campuri?.primit_de === "Ion Client", JSON.stringify(dl?.campuri));
  check("o livrare predată nu mai apare pe telefon", ((await phone("/m/api/livrari")).json?.livrari ?? []).length === 0);

  // 7.4m-6d: my tasks for today, and the team's messages.
  await p.click("Catalog module", "nav .nav");
  const planCard = "[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText === 'Planificator')";
  await p.until(`!!${planCard}`, 5000);
  await p.eval(`${planCard}.querySelector('button').click()`);
  await sleep(200);
  await p.click("Acordă și activează");
  await p.until("[...document.querySelectorAll('nav .nav')].some(e => e.textContent.includes('Planificator'))", 5000);
  const plan = (command, args = {}) => invoke(p, "module_call", { id: "kgb.planner", command, args });
  const me3 = await plan("person_save", { nume: "Proprietar" });
  const other3 = await plan("person_save", { nume: "Altcineva" });
  const pid3 = me3.id ?? me3;
  const t1 = await plan("task_save", { titlu: "Sună furnizorul de cupru", responsabil: pid3, termen: "2026-11-09" });
  await plan("task_save", { titlu: "Inventar lunar", responsabil: pid3, termen: "2026-11-30" });
  await plan("task_save", { titlu: "Taskul altcuiva", responsabil: other3.id ?? other3, termen: "2026-11-09" });
  const tasks = (await phone("/m/api/taskuri?azi=2026-11-09")).json?.taskuri ?? [];
  check("telefonul vede doar taskurile persoanei lui, cu termen azi", tasks.length === 1 && tasks[0].titlu === "Sună furnizorul de cupru", JSON.stringify(tasks));
  const td = await phone("/m/api/trimite", { tip: "task", campuri: { task: tasks[0]?.id, titlu: tasks[0]?.titlu }, fisiere: [] });
  check("„Am terminat” ajunge pe PC", td.status === 200);
  await p.click("Telefon", "nav .nav");
  await p.until("[...document.querySelectorAll('.task-done button')].length === 1", 8000);
  await p.click("Marchează gata în Planificator", ".task-done button");
  await p.until("document.querySelector('.phone-page').innerText.includes('e marcat gata în Planificator')", 8000);
  const after = await plan("tasks", {});
  check("în Planificator taskul e gata", after.find((t) => t.id === (t1.id ?? t1))?.stare === "gata");
  const sentMsg = await phone("/m/api/mesaj", { text: "Am ajuns la client, descarc." });
  check("telefonul trimite un mesaj echipei", sentMsg.status === 200);
  const msgs = (await phone("/m/api/mesaje")).json?.mesaje ?? [];
  check("și citește mesajele echipei", msgs.some((m) => m.autor === "Proprietar (telefon)" && m.text === "Am ajuns la client, descarc."), JSON.stringify(msgs));
  const pcChat = await invoke(p, "chat_list", {});
  check("mesajul apare și pe PC, în Mesaje", JSON.stringify(pcChat).includes("Am ajuns la client, descarc."));
  check("un mesaj gol e refuzat", (await phone("/m/api/mesaj", { text: "  " })).status === 400);

  // 7.4m-6b: entry and exit from the phone, into the team timesheet.
  const clockIn = await phone("/m/api/trimite", { tip: "pontaj", campuri: { miscare: "intrare", ora: "07:58", data: "2026-11-09" }, fisiere: [] });
  const clockOut = await phone("/m/api/trimite", { tip: "pontaj", campuri: { miscare: "iesire", ora: "16:30", data: "2026-11-09" }, fisiere: [] });
  check("telefonul trimite intrarea și ieșirea (ora declarată)", clockIn.status === 200 && clockOut.status === 200);
  check("o oră greșită e refuzată", (await phone("/m/api/trimite", { tip: "pontaj", campuri: { miscare: "intrare", ora: "25:00", data: "2026-11-09" }, fisiere: [] })).status === 400);
  await p.until("!!document.querySelector('.phone-timesheet tbody tr')", 8000);
  const row = await p.eval("document.querySelector('.phone-timesheet tbody tr').innerText");
  check("pe PC: ziua cu prima intrare și ultima ieșire", row.includes("09.11.2026") && row.includes("07:58") && row.includes("16:30"), row.replace(/\s+/g, " "));
  await p.until("[...document.querySelectorAll('.phone-timesheet button')].some(b => b.innerText === 'Trece în pontaj' && !b.disabled)", 5000);
  await p.fill("input[aria-label='Pauza pentru Proprietar']", "30");
  await p.click("Trece în pontaj", ".phone-timesheet button");
  await p.until("document.querySelector('.phone-page').innerText.includes('a fost trecut în Echipă')", 8000);
  const days = await invoke(p, "module_call", { id: "kgb.team", command: "pontaj", args: { luna: "2026-11" } }).catch((e) => String(e));
  const dayText = JSON.stringify(days);
  check("pontajul e în Echipă: 07:58–16:30, 30 min pauză (8 h 2 min lucrate)", dayText.includes("07:58") && dayText.includes("16:30") && dayText.includes('"lucrat_min":482'), dayText.slice(0, 300));
  check("și dispare din „Pontaj de pe telefon”", await p.eval("!document.querySelector('.phone-timesheet')"));

  // 7.4m-7: the team leader's attendance report, with colours, into the timesheet.
  const team = (command, args = {}) => invoke(p, "module_call", { id: "kgb.team", command, args });
  const w = {};
  for (const n of ["Ankit", "Tahir", "Tofiq"]) w[n] = (await team("angajat_save", { nume: n })).id;
  await team("punct_save", { nume: "Curte Iași", sef: "Proprietar", inceput: "07:00", angajati: [w.Ankit, w.Tahir, w.Tofiq] });
  await team("punct_save", { nume: "Șantier Bacău", sef: "Alt Șef", angajati: [w.Tofiq] });
  const sites = (await phone("/m/api/echipa")).json?.puncte ?? [];
  check("șeful vede doar punctul lui de lucru, cu muncitorii", sites.length === 1 && sites[0].nume === "Curte Iași" && sites[0].muncitori.length === 3, JSON.stringify(sites));
  const crew = await phone("/m/api/trimite", { tip: "pontaj_echipa", campuri: { punct: sites[0]?.id, punct_nume: "Curte Iași", data: "2026-11-10" }, fisiere: [], linii: [
    { angajat: w.Ankit, nume: "Ankit", prezent: true, extra: 2 },
    { angajat: w.Tahir, nume: "Tahir", prezent: true, extra: 0 },
    { angajat: w.Tofiq, nume: "Tofiq", prezent: false, extra: 0 },
  ] });
  check("raportul zilei ajunge la birou", crew.status === 200, JSON.stringify(crew.json));
  await p.until("!!document.querySelector('.crew-report')", 8000);
  const colours = await p.eval("Object.fromEntries([...document.querySelectorAll('.crew-line')].map(l => [l.dataset.worker, l.className.replace('crew-line ', '') + ' · ' + l.innerText]))");
  check("la birou: Ankit albastru (+2), Tahir verde (+0), Tofiq roșu (absent)", colours.Ankit?.startsWith("extra") && colours.Ankit.includes("+2 ore extra") && colours.Tahir?.startsWith("present") && colours.Tahir.includes("+0 ore extra") && colours.Tofiq?.startsWith("absent"), JSON.stringify(colours));
  await p.screenshot(join(shots, "05-raport-prezenta.png"));
  await p.click("Trece în pontaj", ".crew-report button");
  await p.until("document.querySelector('.phone-page').innerText.includes('Raportul a fost trecut în pontaj')", 8000);
  const crewDays = JSON.stringify(await team("pontaj", { luna: "2026-11" }));
  check("în pontaj: Ankit 07:00–17:00 (10 h), Tahir 07:00–15:00, Tofiq nimic", crewDays.includes('"iesire":"17:00"') && crewDays.includes('"lucrat_min":600') && crewDays.includes('"iesire":"15:00"') && !crewDays.includes(w.Tofiq), crewDays.slice(0, 200));

  // 7.4m-3: a PDF statement from the phone is shown on the PC.
  const pdf = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<<>>>>endobj",
    "4 0 obj<</Length 40>>stream",
    "0 0 1 rg 20 20 260 160 re f",
    "endstream endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join(String.fromCharCode(10));
  const sentPdf = await phone("/m/api/trimite", { tip: "extras", campuri: { banca: "ING" }, fisiere: [{ nume: "extras-ing.pdf", mime: "application/pdf", date: Buffer.from(pdf).toString("base64") }] });
  check("telefonul trimite un extras PDF", sentPdf.status === 200, JSON.stringify(sentPdf.json));
  await p.until("[...document.querySelectorAll('.phone-inbox button')].some(b => b.innerText.startsWith('arată PDF-ul'))", 8000);
  await p.eval("[...document.querySelectorAll('.phone-inbox button')].find(b => b.innerText.startsWith('arată PDF-ul')).click()");
  await p.until("!!document.querySelector('.phone-pdf canvas')", 8000);
  check("pe PC, extrasul PDF se vede pagină cu pagină", await p.eval("document.querySelector('.phone-pdf canvas').width > 100"));

  // 7.4m-4: every PC serves the page.
  const pre = await fetch(BASE + "/m/api/eu", { method: "OPTIONS", headers: { Origin: "http://192.168.1.50:8737", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-kgb-token" } });
  check(
    "pagina altui PC poate întreba acest PC (CORS, cheia doar în antet)",
    pre.status === 204 && pre.headers.get("access-control-allow-origin") === "*" && (pre.headers.get("access-control-allow-headers") ?? "").includes("x-kgb-token"),
  );
  const ping = await fetch(BASE + "/m/api/ping");
  check("verificarea „răspunzi?” (fără cheie)", ping.status === 200 && (await ping.json()).kgb === true);
  await p.until("!!document.querySelector('.phone-hosts')", 12000);
  const hostsText = await p.eval("document.querySelector('.phone-hosts').innerText");
  check("PC-ul își publică adresele și apare ca „servește pagina”", hostsText.includes("PC-TEST") && hostsText.includes(":8737/m") && hostsText.includes("servește pagina"), hostsText.replace(/\n/g, " | "));
  const me2 = (await phone("/m/api/eu")).json;
  check("telefonul află adresa comună și adresele PC-urilor", me2?.comun === "http://kgb.local:8737/m" && Array.isArray(me2?.adrese) && me2.adrese.some((a) => a.endsWith(":8737/m")), JSON.stringify(me2));
  const resolved = (() => {
    try {
      return execFileSync("powershell", ["-NoProfile", "-Command", "[System.Net.Dns]::GetHostAddresses('kgb.local') | ForEach-Object { $_.IPAddressToString }"], { encoding: "utf8", timeout: 20000 }).trim();
    } catch {
      return "";
    }
  })();
  const lanIp = addr.replace("http://", "").split(":")[0];
  check("în rețea, numele kgb.local duce la acest PC", resolved.split(/\s+/).includes(lanIp), `${resolved || "nerezolvat"} (aștept ${lanIp})`);
  await p.screenshot(join(shots, "04-toate-pc-urile.png"));

  // Restart: the switch is remembered, the page comes back by itself.
  p.close();
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  await sleep(1500);
  check("K.G.B. închis: pagina nu mai răspunde", (await fetch(BASE + "/m").then(() => "răspunde", () => "închis")) === "închis");
  p = await launch();
  await p.until("!!document.querySelector('aside')", 15000);
  let back = false;
  for (let i = 0; i < 30 && !back; i++) {
    back = await fetch(BASE + "/m/api/ping").then((r) => r.ok, () => false);
    if (!back) await sleep(500);
  }
  check("repornit: pagina de telefon pornește singură", back);
  check("și telefonul aprobat merge mai departe", (await phone("/m/api/eu")).json?.stare === "aprobat");
  await p.click("Telefon", "nav .nav");
  await p.until("(document.querySelector('.phone-page')?.innerText ?? '').includes('Telefoane asociate')", 8000);

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
