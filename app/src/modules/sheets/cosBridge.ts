// The bridge between the spreadsheet window copied from Cyber Office Studio (app/cos/src/sheets, D-073,
// D-077) and the K.G.B. core. The copied code talks to the outside only through its `api` object
// (app/cos/src/api.ts); here its file functions are replaced with calls to the `kgb.sheets` module, so
// the code stays unchanged and every workbook is a versioned document of the core (D-067). Files the
// user picks or saves outside the workspace go through the system dialog and the module (`peek`,
// `export_file`); the window never touches the disk itself.
//
// The window runs in its own frame (cos-sheets.html), so its styles stay apart from the app's; it reaches
// the core through the host the app puts on its own window (`window.kgbHost`, see SheetsPage).
//
// Paths seen by the window: `kgb:<document id>/<name>` for workbooks kept in the core (the name keeps
// the extension, which the window reads to know the format), the plain name for a file only read once.
import { api as cos } from "../../../cos/src/api";
import type { ExportFormat, FileKind, OpenedFile, Settings } from "../../../cos/src/api";
import { FORMATS } from "../../../cos/src/web/disk";
import type { PagePrint } from "../../../cos/src/api";
import { pageCount, snapshot, stamp, type Paper, type Snapshot } from "../../cosframe/printPdf";

/** What differs between the copied windows (Sheets, Docs): their module, their own format and its words. */
export interface BridgeKind {
  /** The K.G.B. module that keeps the window's documents. */
  id: string;
  kind: FileKind;
  /** The window's own format (JSON): "ssheet", "sdoc". */
  own: string;
  /** The other formats it opens and saves back ("xlsx", "docx"). */
  office: string[];
  label: string;
  savedNote: string;
  newNote: string;
  /** The module's commands for a new version / a new document. */
  save: string;
  saveNew: string;
}
export const SHEETS: BridgeKind = {
  id: "kgb.sheets",
  kind: "sheets",
  own: "ssheet",
  office: ["xlsx"],
  label: "Registre",
  savedNote: "Salvat din foaia de calcul",
  newNote: "Registru nou din foaia de calcul",
  save: "save_book",
  saveNew: "save_new_book",
};
export const DOCS: BridgeKind = {
  id: "kgb.write",
  kind: "doc",
  own: "sdoc",
  office: ["docx"],
  label: "Documente",
  savedNote: "Salvat din fereastra de documente",
  newNote: "Document nou din fereastra de documente",
  save: "save_doc",
  saveNew: "save_new_doc",
};
export const NOTES: BridgeKind = {
  id: "kgb.notes",
  kind: "note",
  own: "snote",
  office: [],
  label: "Note",
  savedNote: "Salvat din fereastra Note",
  newNote: "Note",
  save: "notebook_save",
  saveNew: "notebook_save",
};
/** What the Notes window read from the core (7.4l-2b): its next save may delete only what it saw. */
let notesSeen: unknown = {};
/** The person's role may only read the notes (7.4l-2b-rem): the window saves nothing (the core would refuse). */
let notesReadOnly = false;
export function setNotesReadOnly(v: boolean): void {
  notesReadOnly = v;
}
let cfg: BridgeKind = SHEETS;

type DialogFilter = { name: string; extensions: string[] };
/** What the app lends the frame: module calls and the system dialogs. */
export interface KgbHost {
  moduleCall<T>(id: string, command: string, args?: Record<string, unknown>): Promise<T>;
  importFile<T>(id: string, path: string): Promise<T>;
  importFileWith<T>(id: string, path: string, command: string, args: Record<string, unknown>): Promise<T>;
  open(o: { multiple: false; filters: DialogFilter[] }): Promise<string | string[] | null>;
  save(o: { defaultPath: string; filters: DialogFilter[] }): Promise<string | null>;
  /** The app's language (RO / EN) and its changes: the window follows it. */
  lang(): "ro" | "en";
  onLang(f: (l: "ro" | "en") => void): () => void;
  /** The PDF of a snapshot of the window, made in a hidden window of the app (D-081), as base64. */
  printPdf(snapshot: Snapshot, paper: Paper): Promise<string>;
  /** Prints a finished PDF (base64) on paper, through Windows' print dialog (D-084); `printed` false = cancelled. */
  printPaper(pdf: string, paper: Paper, pages: number): Promise<{ printed: boolean; pdf?: string }>;
}
let kgb: KgbHost;
const open: KgbHost["open"] = (o) => kgb.open(o);
const save: KgbHost["save"] = (o) => kgb.save(o);
const PREFIX = "kgb:";
const SETTINGS_KEY = "kgb.cos.settings";

/** The version each open workbook was read at: a save is refused if someone saved in between. */
const versions = new Map<string, number>();

const b64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const utf8 = new TextEncoder();

export const pathOf = (id: string, name: string) => `${PREFIX}${id}/${name}`;
const idOf = (path: string): string | null => (path.startsWith(PREFIX) ? path.slice(PREFIX.length).split("/")[0] ?? null : null);
const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;
const isOwnFile = (name: string) => name.toLowerCase().endsWith(`.${cfg.own}`);

interface Read {
  version: number;
  name: string;
  data: string;
}

/** A workbook of the core as the window opens it: .ssheet as text, everything else as bytes to import. */
export async function openDocument(id: string, version?: number): Promise<OpenedFile> {
  const r = await kgb.moduleCall<Read>(cfg.id, "read", { id, version });
  const path = pathOf(id, r.name);
  versions.set(id, r.version);
  const data = unb64(r.data);
  return isOwnFile(r.name) ? { path, content: new TextDecoder().decode(data) } : { path, content: "", imported: data };
}

async function saveBook(path: string, data: Uint8Array, summary: string): Promise<{ path: string }> {
  const id = idOf(path);
  if (!id) throw new Error("registrul nu este în spațiul de lucru");
  const based_on = versions.get(id);
  if (based_on === undefined) throw new Error("registrul nu a fost deschis din spațiul de lucru");
  const r = await kgb.moduleCall<{ version: number }>(cfg.id, cfg.save, { id, based_on, data: b64(data), summary });
  versions.set(id, r.version);
  return { path };
}

async function saveNew(name: string, data: Uint8Array, summary: string): Promise<{ path: string }> {
  const r = await kgb.moduleCall<{ document: { id: string; current?: number } }>(cfg.id, cfg.saveNew, { name, data: b64(data), summary });
  versions.set(r.document.id, r.document.current ?? 1);
  return { path: pathOf(r.document.id, name) };
}

/** The extensions of an import / export format, as the window names them (same list as the web page). */
const extOf = (format: ExportFormat): string[] => FORMATS[format]?.ext ?? [];
const filtersOf = (format: ExportFormat) => {
  const f = FORMATS[format];
  return f && f.ext.length ? [{ name: f.name, extensions: f.ext }] : [];
};

function loadSettings(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
  } catch {
    return {};
  }
}

const unsupported = (what: string) => async (): Promise<never> => {
  throw new Error(`${what} nu este încă disponibil în K.G.B.`);
};

let installed = false;

/** Puts the K.G.B. file functions over the copied window's `api`, once, before the window is shown. */
export function installCosBridge(host: KgbHost, kind: BridgeKind = SHEETS): void {
  if (installed) return;
  installed = true;
  kgb = host;
  cfg = kind;
  // The pages as PDF, also for the end-to-end tests of printing (e2e/cos-print.mjs), which call it with page settings.
  (window as Window & { kgbDocPdf?: (page?: PagePrint) => Promise<Uint8Array> }).kgbDocPdf = (page) => cos.docPdfBytes!(page);
  const base = { ...cos };
  Object.assign(cos, {
    // Small preferences of the window (zoom, last choices); the workbooks themselves are in the core.
    getSettings: async () => ({ ...(await base.getSettings()), ...loadSettings() }),
    setSettings: async (patch: Partial<Settings>) => {
      const next = { ...loadSettings(), ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Preferences only: without storage they last until the window closes.
      }
      return { ...(await base.getSettings()), ...next };
    },
    // Opening: a workbook from the computer becomes a document of the core, then opens from there.
    openFile: async (kind: FileKind): Promise<OpenedFile | null> => {
      if (kind !== cfg.kind) return null;
      const picked = await open({ multiple: false, filters: [{ name: cfg.label, extensions: [cfg.own, ...cfg.office] }] });
      if (!picked || Array.isArray(picked)) return null;
      const name = nameOf(picked);
      const r = isOwnFile(name)
        ? await kgb.importFileWith<{ document: { id: string } }>(cfg.id, picked, cfg.saveNew, { summary: "Deschis de pe calculator" })
        : await kgb.importFile<{ document: { id: string } }>(cfg.id, picked);
      return openDocument(r.document.id);
    },
    readFile: async (path: string): Promise<OpenedFile> => {
      const id = idOf(path);
      if (!id) throw new Error("fișierul nu este în spațiul de lucru");
      return openDocument(id);
    },
    saveFile: async (req: { path: string | null; content: string; kind: FileKind; suggestedName?: string }) => {
      const data = utf8.encode(req.content);
      if (req.path && idOf(req.path) && isOwnFile(req.path)) return saveBook(req.path, data, cfg.savedNote);
      const stem = (req.suggestedName ?? "").replace(/\.[^.]+$/, "").replace(/[.\s]+$/, "") || "Fără titlu";
      return saveNew(`${stem}.${cfg.own}`, data, cfg.newNote);
    },
    // „În .xlsx”: the workbook opened from an .xlsx gets a new version in the same format.
    overwriteFile: async (req: { path: string; format: ExportFormat; data: Uint8Array }) => {
      if (!idOf(req.path)) throw new Error("fișierul nu este în spațiul de lucru");
      return saveBook(req.path, req.data, `Salvat în .${req.format}`);
    },
    // A file read once (Import CSV / from text, tables from a document): nothing is kept.
    importFile: async (format: ExportFormat) => {
      const picked = await open({ multiple: false, filters: filtersOf(format) });
      if (!picked || Array.isArray(picked)) return null;
      const r = await kgb.importFileWith<{ name: string; data: string }>(cfg.id, picked, "peek", {});
      const data = unb64(r.data);
      return { path: r.name, data, size: data.length };
    },
    exportFile: async (req: { format: ExportFormat; suggestedName: string; data: Uint8Array }) => {
      const ext = extOf(req.format)[0];
      const name = ext && !req.suggestedName.toLowerCase().endsWith(`.${ext}`) ? `${req.suggestedName}.${ext}` : req.suggestedName;
      const dest = await save({ defaultPath: name, filters: filtersOf(req.format) });
      if (!dest) return null;
      await kgb.moduleCall(cfg.id, "export_file", { dest, data: b64(req.data) });
      return { path: dest };
    },
    // Paper (D-084): the same pages as Export PDF, then Windows' print dialog. window.print() opened the browser's
    // own preview, in English, blocking the app and printing the page's title and address on every sheet.
    print: async (page?: PagePrint) => {
      const { snapshot: shot, paper } = await snapshot(document, page);
      const pdf = await stamp(unb64(await kgb.printPdf(shot, paper)), page);
      return (await kgb.printPaper(b64(pdf), paper, await pageCount(pdf))).printed;
    },
    // The pages as PDF (preview, Page layout, Export PDF), as COS's printToPDF made them (D-081).
    docPdfBytes: async (page?: PagePrint) => {
      const { snapshot: shot, paper } = await snapshot(document, page);
      return stamp(unb64(await kgb.printPdf(shot, paper)), page);
    },
    exportPdf: async (suggestedName?: string, page?: PagePrint) => {
      const { snapshot: shot, paper } = await snapshot(document, page);
      const data = await stamp(unb64(await kgb.printPdf(shot, paper)), page);
      const stem = (suggestedName ?? "").replace(/\.[^.]+$/, "") || "Document";
      const dest = await save({ defaultPath: `${stem}.pdf`, filters: filtersOf("pdf") });
      if (!dest) return null;
      await kgb.moduleCall(cfg.id, "export_file", { dest, data: b64(data) });
      return { path: dest };
    },
    webGet: unsupported("Aducerea de date de pe internet"),
    pickFolder: async () => null,
    listTables: async () => [],
    writeToFolder: unsupported("Scrierea într-un dosar"),
    // The document window: sending by e-mail and bringing several files at once are not there yet.
    composeMail: unsupported("Trimiterea pe e-mail"),
    openMail: unsupported("Deschiderea unui e-mail"),
    importMany: unsupported("Aducerea mai multor fișiere deodată"),
    // The notebook of the Notes window, kept note by note in kgb.notes (7.4l-2b).
    loadNotes: async () => {
      const r = await kgb.moduleCall<{ content: string; seen: unknown; empty: boolean }>("kgb.notes", "notebook_load", {});
      notesSeen = r.seen;
      return { path: "kgb:notes", content: r.empty ? null : r.content };
    },
    saveNotes: async (content: string) => {
      if (notesReadOnly) return { path: "kgb:notes" };
      const r = await kgb.moduleCall<{ seen: unknown }>("kgb.notes", "notebook_save", { content, seen: notesSeen });
      notesSeen = r.seen;
      return { path: "kgb:notes" };
    },
    addAttachment: async (data: Uint8Array, ext?: "pdf" | "webm" | "bin") => {
      if (notesReadOnly) throw new Error("Rolul tău poate doar citi notele.");
      return (await kgb.moduleCall<{ id: string }>("kgb.notes", "attachment_add", { data: b64(data), ext: ext ?? "bin" })).id;
    },
    readAttachment: async (id: string) => unb64((await kgb.moduleCall<{ data: string }>("kgb.notes", "attachment_read", { id })).data),
  });
}
