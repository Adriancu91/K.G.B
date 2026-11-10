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
import { showSnapshot, type Snapshot } from "./printPdf";
import { DOCS, NOTES, SHEETS, installCosBridge, openDocument, type KgbHost } from "../modules/sheets/cosBridge";
import "../../cos/src/styles.css";
import "../../cos/src/theme.css";

const hash = new URLSearchParams(location.hash.slice(1));
const app = hash.get("app");
const docs = app === "docs";
const notes = app === "notes";
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
      <AskHost />
      <ScreenshotHost />
      <SketchHost />
    </>
  );
}

const printJob = hash.get("print");
const root = createRoot(document.getElementById("root")!);
if (printJob) {
  // The hidden print window (D-081): it gets the cleaned snapshot once and says when it is laid out.
  // It reaches nothing else of the app (src-tauri/src/print.rs).
  void (async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      const shot = await invoke<Snapshot>("print_job_take", { id: printJob });
      await showSnapshot(shot);
      await invoke("print_job_ready", { id: printJob, error: null });
    } catch (e) {
      await invoke("print_job_ready", { id: printJob, error: String(e) }).catch(() => {});
    }
  })();
} else if (!host) {
  root.render(<p className="frame-error">Fereastra se deschide doar din aplicația K.G.B.</p>);
} else {
  installCosBridge(host, notes ? NOTES : docs ? DOCS : SHEETS);
  // The window's shortcuts (Ctrl+S, Ctrl+O, Ctrl+Z…) work only in the application "in front" (COS active.ts);
  // in this frame the window is always in front.
  setCurrentModule(notes ? "note" : docs ? "doc" : "sheets");
  // The window speaks the app's language (RO / EN) and changes with it.
  setLang(host.lang());
  host.onLang(setLang);
  root.render(
    <StrictMode>
      <Frame />
    </StrictMode>,
  );
}
