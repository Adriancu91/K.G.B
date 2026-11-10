import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The OCR language data (D-075, 7.4l-4b): the COS code (cos/src/pdf/ocr.ts) asks tesseract.js for
// `tessdata/<lang>.traineddata.gz` next to the page, so recognising text works without the internet and nothing
// is downloaded while the app runs. The files come from the @tesseract.js-data packages (MIT; the data Apache-2.0).
const require = createRequire(import.meta.url);
const OCR_LANGS = ["ron", "eng", "hun", "deu", "fra"];
const langData = (l: string) => readFileSync(require.resolve(`@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`));
function tessdata(): Plugin {
  return {
    name: "kgb-tessdata",
    configureServer(server) {
      for (const l of OCR_LANGS)
        server.middlewares.use(`/tessdata/${l}.traineddata.gz`, (_req, res) => {
          res.setHeader("Content-Type", "application/octet-stream");
          res.end(langData(l));
        });
    },
    generateBundle() {
      for (const l of OCR_LANGS) this.emitFile({ type: "asset", fileName: `tessdata/${l}.traineddata.gz`, source: langData(l) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tessdata()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    target: "es2022",
    // The spreadsheet window copied from Cyber Office Studio has its own page (D-073, D-077).
    rollupOptions: { input: { main: here("./index.html"), "cos-sheets": here("./cos-sheets.html") } },
  },
  resolve: {
    // libheif-js (LGPL-3.0) is not shipped until the owner decides on it (D-071): .heic photos are refused.
    alias: [{ find: /^libheif-js\/.*$/, replacement: here("./src/cosframe/noHeic.ts") }],
  },
});
