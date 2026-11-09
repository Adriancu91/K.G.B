import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
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
