// Interface of the kgb.notes demonstration module. All data goes through
// `module_call`; the core checks the module's permissions on every call.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, message } from "../../api";
import { Confirm } from "../../components/Confirm";

const ID = "kgb.notes";
const MAX = 2000;

interface Note {
  id: string;
  version: number;
  text: string;
  created_ms: number;
  updated_ms: number;
}

const when = (ms: number) => new Date(ms).toLocaleString("ro-RO");

export function NotesPage({ onError }: { onError: (e: string | null) => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ note: Note; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<Note | null>(null);

  const refresh = useCallback(async () => {
    try {
      setNotes(await api.moduleCall<Note[]>(ID, "list"));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    }
    await refresh();
  };

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    void run(async () => {
      await api.moduleCall(ID, "add", { text });
      setText("");
    });
  };

  const onSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const { note, text: t } = editing;
    void run(async () => {
      await api.moduleCall(ID, "update", { id: note.id, version: note.version, text: t });
      setEditing(null);
    });
  };

  return (
    <section>
      <p className="muted">
        Modul demonstrativ al Etapei 1. Notele se salvează în spațiul de lucru și rămân acolo când modulul e
        dezactivat.
      </p>
      <form className="row" onSubmit={onAdd}>
        <input
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrie o notă…"
          aria-label="Notă nouă"
        />
        <button type="submit" className="primary" disabled={!text.trim()}>
          Adaugă
        </button>
      </form>
      <ul className="list">
        {notes.map((n) =>
          editing?.note.id === n.id ? (
            <li key={n.id}>
              <form className="row grow" onSubmit={onSaveEdit}>
                <input
                  autoFocus
                  value={editing.text}
                  maxLength={MAX}
                  onChange={(e) => setEditing({ note: n, text: e.target.value })}
                  aria-label="Editează nota"
                />
                <button type="submit" className="primary" disabled={!editing.text.trim()}>
                  Salvează
                </button>
                <button type="button" onClick={() => setEditing(null)}>
                  Renunță
                </button>
              </form>
            </li>
          ) : (
            <li key={n.id}>
              <span className="grow">{n.text}</span>
              <small className="muted" title={`Creată ${when(n.created_ms)}`}>
                {when(n.updated_ms)}
              </small>
              <button onClick={() => setEditing({ note: n, text: n.text })}>Editează</button>
              <button className="danger-text" onClick={() => setToDelete(n)}>
                Șterge
              </button>
            </li>
          ),
        )}
        {notes.length === 0 && <li className="muted">Nicio notă încă.</li>}
      </ul>
      {toDelete && (
        <Confirm
          title="Ștergi nota?"
          confirmLabel="Șterge"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const n = toDelete;
            setToDelete(null);
            void run(() => api.moduleCall(ID, "delete", { id: n.id, version: n.version }));
          }}
        >
          <p>„{toDelete.text.length > 80 ? `${toDelete.text.slice(0, 80)}…` : toDelete.text}”</p>
          <p className="muted">Nota dispare din listă. În Etapa 1 nu există încă un coș de gunoi în interfață.</p>
        </Confirm>
      )}
    </section>
  );
}
