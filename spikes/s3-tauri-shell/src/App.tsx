import { useEffect, useState, type FormEvent } from "react";
import {
  addNote,
  deleteNote,
  getTheme,
  listNotes,
  setTheme,
  status,
  type Note,
  type Status,
  type Theme,
} from "./api";
import { MODULES, type ModuleInfo } from "./modules";

export function App() {
  const [active, setActive] = useState<string>("notes");
  const [theme, setThemeState] = useState<Theme>("system");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTheme()
      .then(setThemeState)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  const changeTheme = async (t: Theme) => {
    try {
      await setTheme(t);
      setThemeState(t);
    } catch (e) {
      setError(String(e));
    }
  };

  const mod = MODULES.find((m) => m.id === active) ?? MODULES[0]!;

  return (
    <div className="shell">
      <div className="banner">PROTOTIP Etapa 0 — schiță de spațiu de lucru, nu folosi pentru date reale</div>
      <aside>
        <div className="brand">K.G.B.</div>
        <nav>
          {MODULES.map((m) => (
            <button key={m.id} className={m.id === active ? "nav active" : "nav"} onClick={() => setActive(m.id)}>
              <span>{m.name}</span>
              <Badge m={m} />
            </button>
          ))}
        </nav>
        <label className="theme">
          Temă (salvată în S1)
          <select value={theme} onChange={(e) => void changeTheme(e.target.value as Theme)}>
            <option value="system">Ca sistemul</option>
            <option value="light">Luminoasă</option>
            <option value="dark">Întunecată</option>
          </select>
        </label>
      </aside>
      <main>
        <h1>{mod.name}</h1>
        {error && <p className="error">Eroare: {error}</p>}
        {mod.id === "notes" && <NotesPanel onError={setError} />}
        {mod.id === "storage" && <StoragePanel onError={setError} />}
        {mod.status === "planned" && <Planned m={mod} />}
      </main>
    </div>
  );
}

function Badge({ m }: { m: ModuleInfo }) {
  return m.status === "prototype" ? <small className="badge proto">prototip</small> : <small className="badge planned">{m.stage}</small>;
}

function Planned({ m }: { m: ModuleInfo }) {
  return (
    <div className="planned-box">
      <p>
        <strong>Neimplementat.</strong> Modulul este planificat pentru <strong>{m.stage}</strong>.
      </p>
      <p>{m.note}.</p>
    </div>
  );
}

function NotesPanel({ onError }: { onError: (e: string) => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");

  const refresh = () =>
    listNotes()
      .then(setNotes)
      .catch((e: unknown) => onError(String(e)));

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
      onError(String(err));
    }
  };

  const onDelete = async (n: Note) => {
    try {
      await deleteNote(n.id, n.version);
      await refresh();
    } catch (err) {
      onError(String(err));
    }
  };

  return (
    <>
      <form onSubmit={onAdd}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrie o notă de test…" />
        <button type="submit">Salvează</button>
      </form>
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
    </>
  );
}

function StoragePanel({ onError }: { onError: (e: string) => void }) {
  const [info, setInfo] = useState<Status | null>(null);

  useEffect(() => {
    status()
      .then(setInfo)
      .catch((e: unknown) => onError(String(e)));
  }, []);

  if (!info) return <p>Se încarcă…</p>;
  return (
    <dl>
      <dt>Folder date</dt>
      <dd>{info.store_dir}</dd>
      <dt>Note</dt>
      <dd>{info.records}</dd>
      <dt>Deschidere stocare</dt>
      <dd>
        {info.open_ms} ms ({info.frames} cadre citite)
      </dd>
      <dt>Pornire proces → stocare gata</dt>
      <dd>{info.process_start_to_ready_ms} ms</dd>
      <dt>Memorie proces principal</dt>
      <dd>{info.working_set_mb.toFixed(1)} MB (fără procesele WebView2)</dd>
      <dt>Recuperare la pornire</dt>
      <dd>{info.torn_tail ?? "nimic de reparat"}</dd>
    </dl>
  );
}
