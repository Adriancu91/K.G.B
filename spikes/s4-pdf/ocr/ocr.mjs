// Spike S4 / D-035: OCR cu tesseract.js (Apache-2.0, WASM) și datele pentru română
// (@tesseract.js-data/ron), totul local, fără rețea și fără setări Windows.
//   node spikes/s4-pdf/ocr/ocr.mjs <imagine.png> [ron|eng] [4.0.0|4.0.0_best_int]
import { createWorker } from "tesseract.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [img, lang = "ron", variant = "4.0.0_best_int"] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const t0 = performance.now();
const worker = await createWorker(lang, 1, {
  // Datele limbii din node_modules: nicio descărcare de pe internet.
  langPath: join(here, "node_modules", "@tesseract.js-data", lang, variant),
  cachePath: mkdtempSync(join(tmpdir(), "kgb-ocr-")),
  gzip: true,
});
const t1 = performance.now();
const { data } = await worker.recognize(img);
const t2 = performance.now();
await worker.terminate();
console.log(`limba ${lang} (${variant}); pornire ${(t1 - t0).toFixed(0)} ms; recunoaștere ${(t2 - t1).toFixed(0)} ms; încredere medie ${data.confidence.toFixed(0)}%`);
console.log(data.text);
