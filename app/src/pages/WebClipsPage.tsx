// Web clips (8.20, D-099): a small window with a web page cut to the part the person chose and frozen there, seen
// live. The page is shown like in a browser, in its own window cut off from K.G.B. (no commands, its own browser
// profile); nothing is read out of it. Clips are kept on this PC.
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { message } from "../api";

interface Clip {
  id: string;
  nume: string;
  url: string;
  x: number;
  y: number;
  zoom: number;
  latime: number;
  inaltime: number;
  pozitie: [number, number] | null;
  deasupra: boolean;
  reincarcare_min: number;
  inghetata: boolean;
}
interface Reply {
  ferestre: Clip[];
  deschise: string[];
}

const blank = (): Clip => ({
  id: "",
  nume: "",
  url: "https://",
  x: 0,
  y: 0,
  zoom: 1,
  latime: 480,
  inaltime: 320,
  pozitie: null,
  deasupra: true,
  reincarcare_min: 0,
  inghetata: false,
});

export function WebClipsPage({ onError, onHome, onToggleHome }: { onError: (e: string | null) => void; onHome: string[]; onToggleHome: (id: string) => void }) {
  const [r, setR] = useState<Reply>({ ferestre: [], deschise: [] });
  const [edit, setEdit] = useState<Clip | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  const load = useCallback(() => invoke<Reply>("clip_list").then(setR, (e: unknown) => onError(message(e))), [onError]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    }
    await load();
  };
  const save = () =>
    edit &&
    void run(async () => {
      const c = await invoke<Clip>("clip_save", { fereastra: edit });
      setEdit(null);
      if (!edit.id) {
        await invoke("clip_open", { id: c.id, alege: true });
        setPicking(c.id);
      }
    });
  const pick = (c: Clip) =>
    void run(async () => {
      await invoke("clip_open", { id: c.id, alege: true });
      setPicking(c.id);
    });
  const freeze = (c: Clip) =>
    void run(async () => {
      await invoke("clip_freeze", { id: c.id });
      setPicking(null);
    });
  const zoom = (c: Clip, d: number) => void run(() => invoke("clip_zoom", { id: c.id, zoom: Math.min(4, Math.max(0.25, c.zoom + d)) }));
  const open = (c: Clip) => void run(() => invoke("clip_open", { id: c.id, alege: false }));
  const close = (c: Clip) =>
    void run(async () => {
      await invoke("clip_close", { id: c.id });
      if (picking === c.id) setPicking(null);
    });
  const remove = (c: Clip) => void run(() => invoke("clip_delete", { id: c.id }));
  const save2 = (c: Clip, patch: Partial<Clip>) => void run(() => invoke("clip_save", { fereastra: { ...c, ...patch } }));

  return (
    <section className="web-clips">
      <p className="muted">
        O fereastră mică cu o parte dintr-o pagină web (curs valutar, bursă, știri), văzută live, fără să deschizi browserul.
        Deschizi pagina, derulezi până la partea dorită și micșorezi fereastra în jurul ei, apoi apeși „Îngheață”. Pagina se
        vede ca într-un browser, într-o fereastră separată, fără acces la datele K.G.B.; nu se copiază nimic din ea.
      </p>
      {!edit && (
        <button className="primary" onClick={() => setEdit(blank())}>
          Fereastră web nouă
        </button>
      )}
      {edit && (
        <div className="card clip-form">
          <label>
            Nume
            <input aria-label="Numele ferestrei" value={edit.nume} onChange={(e) => setEdit({ ...edit, nume: e.target.value })} placeholder="de ex. Curs valutar" />
          </label>
          <label>
            Adresa paginii
            <input aria-label="Adresa paginii" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} />
          </label>
          <label>
            Reîncarcă pagina
            <select aria-label="Reîncărcarea paginii" value={edit.reincarcare_min} onChange={(e) => setEdit({ ...edit, reincarcare_min: Number(e.target.value) })}>
              <option value={0}>niciodată (pagina se actualizează singură)</option>
              <option value={1}>la 1 minut</option>
              <option value={5}>la 5 minute</option>
              <option value={15}>la 15 minute</option>
              <option value={60}>la o oră</option>
            </select>
          </label>
          <label className="row">
            <input type="checkbox" checked={edit.deasupra} onChange={(e) => setEdit({ ...edit, deasupra: e.target.checked })} />
            Mereu deasupra celorlalte ferestre
          </label>
          <div className="row">
            <button className="primary" onClick={save}>
              {edit.id ? "Salvează" : "Salvează și alege zona"}
            </button>
            <button onClick={() => setEdit(null)}>Renunță</button>
          </div>
        </div>
      )}
      {r.ferestre.length === 0 && !edit && <p className="muted">Nicio fereastră web deocamdată.</p>}
      <ul className="clip-list">
        {r.ferestre.map((c) => {
          const isOpen = r.deschise.includes(c.id);
          return (
            <li key={c.id} className="card" data-clip={c.nume}>
              <div className="row wrap">
                <strong>{c.nume}</strong>
                <span className="muted small">{c.url}</span>
                <span className={`tag ${isOpen ? "ok" : ""}`}>{isOpen ? (picking === c.id ? "alegi zona" : "deschisă") : "închisă"}</span>
                {c.inghetata && <span className="tag">înghețată</span>}
              </div>
              {picking === c.id && (
                <p className="small clip-hint">
                  Derulează în fereastra paginii până la partea dorită și micșorează fereastra în jurul ei. Mărimea textului:{" "}
                  <button onClick={() => zoom(c, -0.1)} aria-label="Micșorează pagina">
                    −
                  </button>{" "}
                  {Math.round(c.zoom * 100)}%{" "}
                  <button onClick={() => zoom(c, 0.1)} aria-label="Mărește pagina">
                    +
                  </button>
                </p>
              )}
              <div className="row wrap">
                {picking === c.id ? (
                  <button className="primary" onClick={() => freeze(c)}>
                    Îngheață
                  </button>
                ) : (
                  <button className="primary" onClick={() => open(c)} disabled={!c.inghetata}>
                    Deschide
                  </button>
                )}
                <button onClick={() => pick(c)}>Alege zona</button>
                <button onClick={() => onToggleHome(c.id)} disabled={!c.inghetata && !onHome.includes(c.id)} title="Arată zona înghețată într-un panou pe Acasă">
                  {onHome.includes(c.id) ? "Scoate de pe Acasă" : "Fixează pe Acasă"}
                </button>
                {isOpen && <button onClick={() => close(c)}>Închide</button>}
                <label className="row small">
                  <input type="checkbox" checked={c.deasupra} onChange={(e) => save2(c, { deasupra: e.target.checked })} />
                  deasupra
                </label>
                <button onClick={() => setEdit(c)}>Modifică</button>
                <button className="danger-text" onClick={() => remove(c)}>
                  Șterge
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
