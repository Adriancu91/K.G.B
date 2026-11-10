// Interface of kgb.notes (7.4l-2c): the Notes window copied from Cyber Office Studio, in its own frame
// (cos-sheets.html#app=notes), filling the page. The notebook is kept note by note in the core
// (modules/kgb-notes/src/notebook.rs); the window saves on its own after every change. The demonstration
// page of Etapa 1 is gone; its commands (list, add, update, delete) stay for the existing tests.
// The window reaches the core through the host the app lends it.
import "../../components/cosHost";

export function NotesPage(_: { onError: (e: string | null) => void }) {
  return (
    <section className="notes-window">
      <iframe title="Note" src="cos-sheets.html#app=notes" />
    </section>
  );
}
