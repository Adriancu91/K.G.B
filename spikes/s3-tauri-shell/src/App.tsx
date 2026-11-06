import { useEffect, useState, type FormEvent } from "react";
import { addNote, deleteNote, listNotes, status, type Note, type Status } from "./api";

export function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [info, setInfo] = useState<Status | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [n, s] = await Promise.all([listNotes(), status()]);
      setNotes(n);
      setInfo(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await addNote(text.trim());
      setText("");
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  };

  const onDelete = async (n: Note) => {
    try {
      await deleteNote(n.id, n.version);
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <main>
      <div className="banner">PROTOTIP S3 — nu folosi pentru date reale</div>
      <h1>K.G.B. — test fereastră + stocare</h1>

      <form onSubmit={onAdd}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrie o notă de test…" />
        <button type="submit">Salvează</button>
      </form>

      {error && <p className="error">Eroare: {error}</p>}

      <ul>
        {notes.map((n) => (
          <li key={n.id}>
            <span>{n.text}</span>
            <small>{new Date(n.created_ms).toLocaleString("ro-RO")}</small>
            <button onClick={() => void onDelete(n)}>Șterge</button>
          </li>
        ))}
        {notes.length === 0 && <li className="empty">Nicio notă încă.</li>}
      </ul>

      {info && (
        <dl>
          <dt>Folder date</dt>
          <dd>{info.store_dir}</dd>
          <dt>Înregistrări</dt>
          <dd>{info.records}</dd>
          <dt>Deschidere stocare</dt>
          <dd>{info.open_ms} ms ({info.frames} cadre citite)</dd>
          <dt>Pornire proces → stocare gata</dt>
          <dd>{info.process_start_to_ready_ms} ms</dd>
          <dt>Memorie proces principal</dt>
          <dd>{info.working_set_mb.toFixed(1)} MB (fără procesele WebView2)</dd>
          <dt>Recuperare la pornire</dt>
          <dd>{info.torn_tail ?? "nimic de reparat"}</dd>
        </dl>
      )}
    </main>
  );
}
