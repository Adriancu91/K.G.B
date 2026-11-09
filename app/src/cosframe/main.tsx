// The frame that shows the spreadsheet window of Cyber Office Studio inside K.G.B. (D-073, D-077).
// It has its own page (cos-sheets.html) so the window's styles (app/cos/src/styles.css, theme.css) stay
// apart from the app's. The app opens it as `cos-sheets.html#doc=<id>` (a workbook of the core) or
// `cos-sheets.html#new` and lends it the core through `window.kgbHost` (see modules/sheets/SheetsPage).
import { StrictMode, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { OpenedFile } from "../../cos/src/api";
import { setCurrentModule } from "../../cos/src/active";
import { AskHost } from "../../cos/src/ask";
import { ScreenshotHost } from "../../cos/src/screenshot";
import { SketchHost } from "../../cos/src/sketch";
import { installCosBridge, openDocument, type KgbHost } from "../modules/sheets/cosBridge";
import "../../cos/src/styles.css";
import "../../cos/src/theme.css";

const Sheets = lazy(() => import("../../cos/src/sheets/Sheets"));

const host = (window.parent as Window & { kgbHost?: KgbHost }).kgbHost;

function Frame() {
  const doc = /^#doc=([0-9a-f-]+)$/i.exec(location.hash)?.[1] ?? null;
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
  if (error) return <p className="frame-error">Registrul nu s-a putut deschide: {error}</p>;
  if (!ready) return <p className="frame-wait">Se deschide registrul…</p>;
  // The window's own dialogs (questions, screen clip, sketch), mounted by the COS app around its modules;
  // without AskHost a question would fall back to the system confirm(), which the app does not allow.
  return (
    <>
      <Suspense fallback={<p className="frame-wait">Se pregătește foaia de calcul…</p>}>
        <Sheets initial={initial} onConsumed={() => setInitial(null)} />
      </Suspense>
      <AskHost />
      <ScreenshotHost />
      <SketchHost />
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
if (!host) {
  root.render(<p className="frame-error">Foaia de calcul se deschide doar din aplicația K.G.B.</p>);
} else {
  installCosBridge(host);
  // The window's shortcuts (Ctrl+S, Ctrl+O, Ctrl+Z…) work only in the application "in front" (COS active.ts);
  // in this frame the spreadsheet is always in front.
  setCurrentModule("sheets");
  root.render(
    <StrictMode>
      <Frame />
    </StrictMode>,
  );
}
