// The frame that shows a window of Cyber Office Studio inside K.G.B.: the spreadsheet (D-073, D-077) or
// the document window (D-080). It has its own page (cos-sheets.html) so the window's styles
// (app/cos/src/styles.css, theme.css) stay apart from the app's. The app opens it as
// `cos-sheets.html#doc=<id>` / `#new` (Sheets) or `#app=docs&doc=<id>` / `#app=docs&new` (Docs) and lends
// it the core through `window.kgbHost` (see modules/sheets/SheetsPage, modules/write/WritePage).
import { StrictMode, Suspense, lazy, useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import type { OpenedFile } from "../../cos/src/api";
import { setCurrentModule } from "../../cos/src/active";
import { AskHost } from "../../cos/src/ask";
import { setLang } from "../../cos/src/i18n";
import { ScreenshotHost } from "../../cos/src/screenshot";
import { SketchHost } from "../../cos/src/sketch";
import { setTabMarks, tabContent, tabText, tabTitleOf } from "../../cos/src/tabs";
import { unsavedAll } from "../../cos/src/unsaved";
import { showPdf, showSnapshot, type Snapshot } from "./printPdf";
import { DOCS, NOTES, SHEETS, installCosBridge, openDocument, setNotesReadOnly, type KgbHost } from "../modules/sheets/cosBridge";
import "../../cos/src/styles.css";
import "../../cos/src/theme.css";

const hash = new URLSearchParams(location.hash.slice(1));
const app = hash.get("app");
const docs = app === "docs";
const notes = app === "notes";
// The person's role may only read the notes (7.4l-2b-rem): a band says so, the note cannot be typed into
// and nothing is saved; the list, the search and the notebooks can still be browsed.
const readOnly = notes && hash.get("citire") === "1";
type CosWindow = ComponentType<{ initial: OpenedFile | null; onConsumed(): void }>;
// One lazy() per window, each with its own import(): the bundler works out what to load before a window
// (its code and its stylesheet) per import() call; a single import() picked by a condition got only the
// Sheets list, so the Notes stylesheet was never loaded.
type Loaded = Promise<{ default: CosWindow }>;
const Window = notes
  ? lazy(() => import("../../cos/src/notes/Notes") as Loaded)
  : docs
    ? lazy(() => import("../../cos/src/docs/Docs") as Loaded)
    : lazy(() => import("../../cos/src/sheets/Sheets") as Loaded);
const what = notes ? "caietul" : docs ? "documentul" : "registrul";

const host = (window.parent as Window & { kgbHost?: KgbHost }).kgbHost;

function Frame() {
  const id = hash.get("doc");
  const doc = id && /^[0-9a-f-]+$/i.test(id) ? id : null;
  const [initial, setInitial] = useState<OpenedFile | null>(null);
  const [ready, setReady] = useState(doc === null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!doc) return;
    openDocument(doc).then(
      (f) => {
        setInitial(f);
        setReady(true);
      },
      (e) => setError(String(e)),
    );
  }, [doc]);
  if (error) return <p className="frame-error">Nu s-a putut deschide {what}: {error}</p>;
  if (!ready) return <p className="frame-wait">Se deschide {what}…</p>;
  // The window's own dialogs (questions, screen clip, sketch), mounted by the COS app around its modules;
  // without AskHost a question would fall back to the system confirm(), which the app does not allow.
  return (
    <>
      <Suspense fallback={<p className="frame-wait">Se pregătește fereastra…</p>}>
        <Window initial={initial} onConsumed={() => setInitial(null)} />
      </Suspense>
      {readOnly && (
        <p
          className="frame-readonly"
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 40,
            transform: "translateX(-50%)",
            margin: 0,
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid var(--accent)",
            background: "var(--panel)",
            color: "var(--text)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            fontSize: 13,
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          Rolul tău poate doar citi notele: ce schimbi aici nu se salvează.
        </p>
      )}
      <AskHost />
      <ScreenshotHost />
      <SketchHost />
    </>
  );
}

async function fixViewports(): Promise<void> {
  const [pdfjs, { default: workerUrl }, { viewportCompat }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    import("../modules/pdf/pdfjs"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc ||= workerUrl;
  const tiny =
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";
  const task = pdfjs.getDocument({ data: new TextEncoder().encode(tiny) });
  try {
    const doc = await task.promise;
    viewportCompat((await doc.getPage(1)).getViewport({ scale: 1 }));
  } catch {
    /* the page keeps working; only clicking a cell on the page would not */
  } finally {
    void task.destroy();
  }
}

const printJob = hash.get("print");
const root = createRoot(document.getElementById("root")!);
if (printJob) {
  // The hidden print window (D-081): it gets the cleaned snapshot once and says when it is laid out.
  // It reaches nothing else of the app (src-tauri/src/print.rs).
  void (async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      const shot = await invoke<Snapshot | { pdf: string }>("print_job_take", { id: printJob });
      // Paper (D-084): the finished PDF, drawn page by page; otherwise the document's snapshot (D-081).
      if ("pdf" in shot) await showPdf(shot.pdf);
      else await showSnapshot(shot);
      await invoke("print_job_ready", { id: printJob, error: null });
    } catch (e) {
      await invoke("print_job_ready", { id: printJob, error: String(e) }).catch(() => {});
    }
  })();
} else if (!host) {
  root.render(<p className="frame-error">Fereastra se deschide doar din aplicația K.G.B.</p>);
} else {
  installCosBridge(host, notes ? NOTES : docs ? DOCS : SHEETS);
  // pdf.js 6 no longer has PageViewport.convertToViewportRectangle, which the COS code (pdf.js 4) still uses
  // (Sheets › Aspect pagină: clicking a cell on the page). The frame is its own document, with its own pdf.js,
  // and the class is not exported: a viewport of a one-page PDF made here gives it, once, a moment after the
  // window is up (viewportCompat, the PDF page's fix); the document and its worker are closed right after.
  if (!notes && !docs) window.setTimeout(() => void fixViewports(), 1500);
  if (readOnly) {
    setNotesReadOnly(true);
    // Typing, pasting and dropping into the open note are stopped before they change it.
    const stop = (e: Event) => {
      if ((e.target as Element | null)?.closest?.(".notes-main")) e.preventDefault();
    };
    for (const ev of ["beforeinput", "paste", "drop"]) document.addEventListener(ev, stop, true);
  }
  // The window's shortcuts (Ctrl+S, Ctrl+O, Ctrl+Z…) work only in the application "in front" (COS active.ts);
  // in this frame the window is always in front.
  setCurrentModule(notes ? "note" : docs ? "doc" : "sheets");
  // The workspace with tabs (8.21, pages/WorkspacePage) reads each frame through this: the file's name and path
  // (kgb:<id>/<name> once it is in the core), whether something is unsaved, the content and text for „Compară”,
  // and the cells it found different, coloured in the table while the two tabs stay side by side.
  const key = notes ? "note" : docs ? "doc" : "sheets";
  (window as Window & { kgbTab?: unknown }).kgbTab = {
    title: () => tabTitleOf(key),
    unsaved: () => unsavedAll().length > 0,
    content: () => tabContent(key),
    text: () => tabText(key),
    marks: (m: Record<string, string[]> | null) =>
      setTabMarks(key, m ? new Map(Object.entries(m).map(([sheet, cells]) => [sheet, new Set(cells)])) : null),
  };
  // The window speaks the app's language (RO / EN) and changes with it.
  setLang(host.lang());
  host.onLang(setLang);
  root.render(
    <StrictMode>
      <Frame />
    </StrictMode>,
  );
}
