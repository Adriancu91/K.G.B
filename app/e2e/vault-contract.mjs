// 7.10b, end to end in the real window: a contract kept in the vault becomes a proposal in „Contracte și
// abonamente” — „Propune contractul…” opens the new contract's form filled from its text (number, start, end from the
// length, automatic renewal, notice, the partner found in the directory by CUI); nothing is saved until the person
// presses „Salvează contractul”.
//
// Usage: node app/e2e/vault-contract.mjs <path-to-kgb-app.exe> <screenshot-dir>
// Uses a throw-away data folder (KGB_DATA_DIR) and a throw-away documents folder.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "./cdp.mjs";

const [exe, shots] = process.argv.slice(2);
if (!exe || !shots) {
  console.error("usage: node vault-contract.mjs <kgb-app.exe> <screenshot-dir>");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "kgb-vault-contract-"));
const docs = mkdtempSync(join(tmpdir(), "kgb-vault-contract-docs-"));
mkdirSync(join(docs, "Contracte"));
writeFileSync(
  join(docs, "Contracte", "Contract Beta.txt"),
  "CONTRACT DE PRESTĂRI SERVICII nr. 12/2026 din 05.01.2026\n" +
    "Prestator: ALFA CONSTRUCT S.R.L., cu sediul în Iași, CUI RO14399840\n" +
    "Beneficiar: BETA SERVICII S.R.L., cu sediul în Cluj, CUI 18547290\n" +
    "Art. 3. Contractul se încheie pe o durată de 12 (douăsprezece) luni, începând cu data de 01.02.2026.\n" +
    "Art. 4. Contractul se prelungește automat dacă niciuna dintre părți nu îl denunță cu un preaviz de 30 de zile.\n",
);
const PORT = 9374;
let proc;
let page;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const invoke = (p, cmd, args) => p.eval(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(r => r, e => ({ error: String(e) }))`);
const enable = async (p, title) => {
  await p.click("Catalog module", "nav .nav");
  const card = `[...document.querySelectorAll('.card')].find(c => c.querySelector('h3')?.innerText.trim() === ${JSON.stringify(title)})`;
  await p.until(`!!${card}`, 8000);
  await p.eval(`${card}.querySelector('button').click()`);
  await sleep(300);
  await p.click("Acordă și activează");
  await p.until(`[...document.querySelectorAll('nav .nav')].some(e => e.textContent.trim().startsWith(${JSON.stringify(title)}))`, 8000);
};
const val = (p, aria) => p.eval(`document.querySelector(${JSON.stringify(`[aria-label="${aria}"]`)})?.${aria === "se prelungește automat" ? "checked" : "value"}`);

try {
  proc = spawn(exe, [], {
    env: { ...process.env, KGB_DATA_DIR: data, KGB_NO_DESKTOP_NOTIFY: "1", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: "ignore",
  });
  const p = await connect(PORT, 20000);
  page = p;
  await p.until("!!document.querySelector('aside')", 15000);
  await enable(p, "Contracte și abonamente");
  await enable(p, "Depozitul de documente");
  // The partner in the directory, the firm's CUI in the vault, the contract in the vault.
  await invoke(p, "partner_save", {
    partner: { version: 0, tip: "client", denumire: "Beta Servicii SRL", cui: "RO18547290", nr_reg_com: "", sediu: "", localitate: "", judet: "", tara: "", telefon: "", email: "", iban: "", banca: "", reprezentant: "", functie_reprezentant: "", platitor_tva: null, note: "", puncte_lucru: [], documente: [], campuri: [], surse: {}, activ: true },
  });
  await invoke(p, "module_call", { id: "kgb.vault", command: "setari_save", args: { cui_firma: "RO14399840" } });
  await p.eval("[...document.querySelectorAll('nav .nav')].find(e => e.textContent.trim().startsWith('Depozitul de documente')).click()");
  await p.until("!!document.querySelector('.vault')", 8000);
  await p.eval(`window.__kgbE2eFolder = ${JSON.stringify(docs)}`);
  await p.eval("[...document.querySelectorAll('.vault button')].find(b => b.textContent.trim() === 'Adaugă un folder…').click()");
  await p.until("[...document.querySelectorAll('[data-testid=vault-doc]')].some(r => r.innerText.includes('Contract Beta.txt'))", 20000);
  const cat = await p.eval("[...document.querySelectorAll('[data-testid=vault-doc]')].find(r => r.innerText.includes('Contract Beta.txt')).querySelector('select').value");
  check("contractul e sortat ca un contract cu un client (firma e prestatorul)", cat === "contracte_clienti", cat);

  // „Propune contractul…” opens Contracts with the form filled.
  await p.eval("[...[...document.querySelectorAll('[data-testid=vault-doc]')].find(r => r.innerText.includes('Contract Beta.txt')).querySelectorAll('button')].find(b => b.textContent.trim() === 'Propune contractul…').click()");
  await p.until("!!document.querySelector('[data-testid=contract-proposed]')", 10000);
  check("se deschide Contracte și abonamente, cu „Propus din documentul …”", await p.eval("document.querySelector('[data-testid=contract-proposed]').innerText.includes('Contract Beta.txt')"));
  await p.until(`document.querySelector('[aria-label="Partenerul"]')?.value === 'Beta Servicii SRL'`, 8000);
  const form = {
    numar: await val(p, "Numărul contractului"),
    partener: await val(p, "Partenerul"),
    inceput: await val(p, "Începutul contractului"),
    sfarsit: await val(p, "Sfârșitul contractului"),
    luni: await val(p, "Prelungirea în luni"),
    preaviz: await val(p, "Preavizul în zile"),
  };
  check(
    "formularul: nr. 12/2026, partenerul din agendă (după CUI), 01.02.2026–31.01.2027, prelungire 12 luni, preaviz 30 zile",
    form.numar === "12/2026" && form.partener === "Beta Servicii SRL" && form.inceput === "2026-02-01" && form.sfarsit === "2027-01-31" && form.luni === "12" && form.preaviz === "30",
    JSON.stringify(form),
  );
  check("nimic salvat încă în Contracte", (await invoke(p, "module_call", { id: "kgb.contracts", command: "contracte", args: { azi: "2026-11-11" } })).length === 0);
  await p.screenshot(join(shots, "01-propunere.png"));

  // The person saves it: a draft contract with the partner's card and the document named in the note.
  await p.eval("[...document.querySelectorAll('.contracts button')].find(b => b.textContent.trim() === 'Salvează contractul').click()");
  await p.until("!!document.querySelector('[data-testid=contract-card]')", 8000);
  const list = await invoke(p, "module_call", { id: "kgb.contracts", command: "contracte", args: { azi: "2026-11-11" } });
  const c = list[0] ?? {};
  check(
    "salvat de om: ciornă cu partenerul din agendă, prelungire automată și nota „Din depozit: …”",
    list.length === 1 && c.stare === "ciorna" && !!c.partener && c.prelungire_auto === true && c.preaviz_zile === 30 && /Din depozit: Contract Beta\.txt/.test(c.nota),
    JSON.stringify({ n: list.length, stare: c.stare, partener: c.partener, nota: c.nota }),
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
  rmSync(docs, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verificări trecute`);
process.exit(failed ? 1 : 0);
