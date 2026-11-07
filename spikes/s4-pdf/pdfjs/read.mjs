// Spike S4: pdf.js (Apache-2.0) pe setul testdata/etapa3 — pagini, text, timp.
// Rulează în Node (build „legacy”: Node nu are încă Uint8Array.toHex); în aplicație ar rula în fereastră (WebView2), cu aceleași setări.
//   node spikes/s4-pdf/pdfjs/read.mjs testdata/etapa3
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const td = process.argv[2];
const manifest = JSON.parse(readFileSync(join(td, "MANIFEST.json"), "utf8"));
const norm = (s) => s.split(/\s+/).filter(Boolean).join(" ");
let good = 0, total = 0;

for (const f of manifest.files.filter((f) => f.kind === "pdf")) {
  const p = join(td, f.path);
  if (!existsSync(p)) continue;
  total++;
  const data = new Uint8Array(readFileSync(p));
  const t0 = performance.now();
  let pages = null, text = "", err = "";
  try {
    // Setări de siguranță: fără eval, fără fonturi de sistem, fără rețea.
    const task = pdfjs.getDocument({
      data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false,
      stopAtErrors: false, verbosity: 0,
    });
    const doc = await task.promise;
    pages = doc.numPages;
    const sample = [...Array(Math.min(pages, 50)).keys()].map((i) => i + 1);
    if (pages > 50) sample.push(pages);
    for (const i of sample) {
      const tc = await (await doc.getPage(i)).getTextContent();
      text += tc.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join("") + "\n";
    }
    await task.destroy();
  } catch (e) {
    err = String(e?.message ?? e).slice(0, 70);
  }
  const ms = (performance.now() - t0).toFixed(1);
  const broken = f.broken && !f.recoverable;
  const ok = broken ? pages === null : pages === f.pages;
  const t = norm(text);
  const textOk = pages === null ? "-" : String((f.text ?? []).every((s) => t.includes(norm(s))) &&
    (f.text_absent ?? []).every((s) => !t.includes(s)));
  if (ok) good++;
  console.log(`${f.path.padEnd(45)} ${(ok ? "corect" : "GREȘIT").padEnd(7)} pagini=${String(pages).padEnd(5)} text=${textOk.padEnd(6)} ${ms.padStart(8)} ms ${err}`);
}
const mem = process.memoryUsage();
console.log(`\n${good}/${total} corecte; memorie la final: ${(mem.rss / 1048576).toFixed(0)} MB RSS`);
