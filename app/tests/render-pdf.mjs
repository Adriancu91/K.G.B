// Draws the pages of a PDF to PNG files with pdf.js (as the window does, with
// annotations), for looking at a result by eye during development.
// Usage (in app/): node tests/render-pdf.mjs <file.pdf> <out-dir> [scale]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const [file, out, scale = "0.8"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: false, verbosity: 0 }).promise;
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: Number(scale) });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
  writeFileSync(join(out, `pagina-${n}.png`), canvas.toBuffer("image/png"));
}
console.log(`${doc.numPages} pagini desenate în ${out}`);
