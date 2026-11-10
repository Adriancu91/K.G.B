// The windows of Cyber Office Studio (Sheets D-077, Docs D-080) run in their own frame
// (cos-sheets.html) and reach the core through this host, which the app lends them on its own window.
// Imported by every page that opens such a frame.
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { currentLang, onLang } from "../i18n/lang";
import type { KgbHost } from "../modules/sheets/cosBridge";

const host: KgbHost = {
  moduleCall: (id, command, args) => api.moduleCall(id, command, args),
  importFile: (id, path) => api.importFile(id, path),
  importFileWith: (id, path, command, args) => api.importFileWith(id, path, command, args),
  open: (o) => open(o),
  save: (o) => save(o),
  lang: () => currentLang(),
  onLang: (f) => onLang(f),
  printPdf: (snapshot, paper) => invoke<string>("print_pdf", { snapshot, paper }),
  printPaper: (pdf, paper, pages) => invoke("print_paper", { pdf, paper, pages, toPdf: false }),
};
(window as Window & { kgbHost?: KgbHost }).kgbHost = host;

export {};
