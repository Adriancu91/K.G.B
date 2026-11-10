// Interface of kgb.notes (7.4l-2c): the Notes window copied from Cyber Office Studio, in its own frame
// (cos-sheets.html#app=notes), filling the page. The notebook is kept note by note in the core
// (modules/kgb-notes/src/notebook.rs); the window saves on its own after every change. The demonstration
// page of Etapa 1 is gone; its commands (list, add, update, delete) stay for the existing tests.
// The window reaches the core through the host the app lends it.
import "../../components/cosHost";

// A role that may only read the module (D-056) opens the window for reading (7.4l-2b-rem).
export function NotesPage({
  access,
}: {
  onError: (e: string | null) => void;
  access?: string;
}) {
  const readOnly = access === "citire";
  return (
    <section className="notes-window">
      <iframe
        key={String(readOnly)}
        title="Note"
        src={`cos-sheets.html#app=notes${readOnly ? "&citire=1" : ""}`}
      />
    </section>
  );
}
