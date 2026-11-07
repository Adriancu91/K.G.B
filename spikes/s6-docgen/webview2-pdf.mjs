// Spike S6, variant C: PDF from an HTML model with the Edge engine (WebView2)
// the app already uses — nothing to add to the installer. Drives the real app
// over DevTools (as the e2e tests do) and calls Page.printToPDF, the same
// engine function as CoreWebView2.PrintToPdfAsync that the app would call.
//
// Usage: node spikes/s6-docgen/webview2-pdf.mjs <kgb-app.exe> <out.pdf>
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, sleep } from "../../app/e2e/cdp.mjs";

const [exe, out] = process.argv.slice(2);
const data = mkdtempSync(join(tmpdir(), "kgb-s6-"));
const PORT = 9350;
const proc = spawn(exe, [], {
  env: { ...process.env, KGB_DATA_DIR: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
  stdio: "ignore",
});
try {
  const p = await connect(PORT, 20000);
  await p.until("!!document.querySelector('aside')", 15000);
  const values = {
    firma: "Kronos Global Business SRL", cui: "RO12345678", numar: '#panic("x") ]* _ <b>nu e bold</b>', data: "07.11.2026",
    client: "Școala Gimnazială „Ion Creangă” Iași", obiect: 'Furnizare <echipamente> & servicii; preț "fix"', total: "1.673,14 lei",
  };
  // The model is HTML; values are put in with textContent, never as HTML.
  const model = `<style>
    @page { size: A4; margin: 2cm 2cm 2.5cm; }
    body { font: 10.5pt Arial, sans-serif; color: #000; }
    .top { display: flex; justify-content: space-between; } .r { text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 1cm; } thead { display: table-header-group; }
    td, th { border: 1px solid #000; padding: 3px 6px; } td.n { text-align: right; } tr { break-inside: avoid; }
  </style>
  <div class="top"><div><b data-f="firma"></b><br>CUI <span data-f="cui"></span></div>
  <div class="r"><b>FACTURĂ</b> nr. <span data-f="numar"></span><br>Data: <span data-f="data"></span></div></div>
  <p style="margin-top:1cm">Cumpărător: <b data-f="client"></b><br>Obiect: <span data-f="obiect"></span></p>
  <table><thead><tr><th>Nr.</th><th>Denumire</th><th>Cant.</th><th>Valoare</th></tr></thead><tbody>
  ${Array.from({ length: 40 }, (_, i) => `<tr><td class="n">${i + 1}</td><td>Serviciu de mentenanță, poziția ${i + 1} — țiglă, șurub, ață</td><td class="n">1</td><td class="n">41,83</td></tr>`).join("")}
  </tbody></table><p class="r"><b>Total de plată: <span data-f="total"></span></b></p>`;
  await p.eval(`(() => { document.open(); document.write(${JSON.stringify(model)}); document.close();
    const v = ${JSON.stringify(values)};
    document.querySelectorAll('[data-f]').forEach(e => e.textContent = v[e.dataset.f]); return true; })()`);
  const times = [];
  let pdf;
  for (let i = 0; i < 2; i++) {
    const t = performance.now();
    pdf = await p.send("Page.printToPDF", {
      preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: '<div style="font:9pt Arial;width:100%;text-align:center">Pagina <span class="pageNumber"></span> din <span class="totalPages"></span></div>',
    });
    times.push(Math.round(performance.now() - t));
  }
  const bytes = Buffer.from(pdf.data, "base64");
  writeFileSync(out, bytes);
  console.log(`PDF ${Math.round(bytes.length / 1024)} KB; prima dată ${times[0]} ms, a doua oară ${times[1]} ms`);
  p.close();
} finally {
  execFileSync("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" });
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
