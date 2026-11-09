// Interface of the kgb.write module (D-080): the list of text documents, their versions, and the document
// window copied from Cyber Office Studio, in its own frame over the page. Every save in the window is a
// new version of the document; the old ones stay and can be restored.
import { useCallback, useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";
import { Confirm } from "../../components/Confirm";
// The document window runs in its own frame; this lends it the core.
import "../../components/cosHost";

const ID = "kgb.write";

interface Doc {
  id: string;
  name: string;
  current: number;
}
interface Version {
  number: number;
  note: string;
  size: number;
  created_ms: number;
}
interface Info {
  id: string;
  name: string;
  format: string;
  version: number;
  versions: Version[];
}

const when = (ms: number) => new Date(ms).toLocaleString("ro-RO");
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function WritePage({ onError }: { onError: (e: string | null) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  // The document shown in the window: "doc=<id>" or "new"; null = the window is closed.
  const [frame, setFrame] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await api.moduleCall<Doc[]>(ID, "list"));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const load = useCallback(
    async (id: string, version: number | null) => {
      try {
        setInfo({ ...(await api.moduleCall<Omit<Info, "id">>(ID, "info", { id, version })), id });
        onError(null);
      } catch (e) {
        onError(message(e));
      }
    },
    [onError],
  );
  useEffect(() => {
    if (current) void load(current, null);
    else setInfo(null);
  }, [current, load]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const onImport = () =>
    run(async () => {
      const picked = await open({ multiple: true, filters: [{ name: "Documente", extensions: ["docx", "sdoc"] }] });
      if (!picked) return;
      const paths = Array.isArray(picked) ? picked : [picked];
      let last: string | null = null;
      for (const path of paths) last = (await api.importFile<{ document: Doc }>(ID, path)).document.id;
      setNotice(`${paths.length} document(e) importat(e).`);
      await refresh();
      if (last) setCurrent(last);
    });

  const onExport = () =>
    run(async () => {
      if (!info) return;
      const dest = await save({ defaultPath: info.name, filters: [{ name: "Document", extensions: [info.format] }] });
      if (!dest) return;
      await api.moduleCall(ID, "export", { id: info.id, version: info.version, dest, overwrite: true });
      setNotice(`Salvat pe calculator: ${dest}`);
    });

  const doc = docs.find((d) => d.id === current);
  const isCurrent = info !== null && info.version === doc?.current;

  return (
    <section className="sheets">
      <p className="muted">
        Modul beta. Scrie documente în fereastra de documente; deschide și salvează înapoi și fișiere .docx. Fiecare
        salvare devine o versiune nouă; versiunile vechi rămân și se pot readuce.
      </p>
      <div className="row wrap">
        <button className="primary" onClick={() => setFrame("app=docs&new")} disabled={busy}>
          Document nou
        </button>
        <button onClick={() => void onImport()} disabled={busy}>
          Importă documente…
        </button>
        {notice && <span className="muted grow">{notice}</span>}
      </div>

      <div className="pdf-layout">
        <ul className="list pdf-docs" aria-label="Documente text">
          {docs.length === 0 && <li className="muted">Niciun document încă.</li>}
          {docs.map((d) => (
            <li key={d.id} className={d.id === current ? "active" : ""}>
              <button className="link grow" onClick={() => setCurrent(d.id)}>
                {d.name}
              </button>
              <span className="muted">v{d.current}</span>
            </li>
          ))}
        </ul>

        {doc && info && info.id === doc.id && (
          <div className="pdf-doc grow">
            <header className="row wrap">
              <h2 className="grow">{info.name}</h2>
              {isCurrent && (
                <button className="primary" disabled={busy} onClick={() => setFrame(`app=docs&doc=${doc.id}`)}>
                  Deschide în fereastra de documente
                </button>
              )}
              <label>
                Versiunea{" "}
                <select value={info.version} onChange={(e) => void load(doc.id, Number(e.target.value))}>
                  {[...info.versions].reverse().map((v) => (
                    <option key={v.number} value={v.number}>
                      {v.number} — {v.note} ({when(v.created_ms)}, {kb(v.size)})
                    </option>
                  ))}
                </select>
              </label>
              {!isCurrent && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api.moduleCall(ID, "restore", { id: doc.id, version: info.version });
                      await refresh();
                      await load(doc.id, null);
                    })
                  }
                >
                  Readu această versiune
                </button>
              )}
              <button disabled={busy} onClick={() => void onExport()}>
                Salvează pe calculator…
              </button>
              <button className="danger-text" disabled={busy} onClick={() => setToDelete(doc)}>
                Șterge
              </button>
            </header>
            {!isCurrent && <p className="muted">Vezi o versiune mai veche: se deschide și se modifică doar versiunea curentă.</p>}
          </div>
        )}
      </div>

      {frame && (
        <div className="cos-frame" role="dialog" aria-label="Fereastra de documente">
          <div className="row cos-frame-bar">
            <span className="grow muted">
              Fereastra de documente: fiecare salvare devine o versiune nouă a documentului. Salvează înainte de a închide.
            </span>
            <button
              onClick={() => {
                setFrame(null);
                void refresh();
                if (current) void load(current, null);
              }}
            >
              Închide fereastra de documente
            </button>
          </div>
          <iframe title="Fereastra de documente" src={`cos-sheets.html#${frame}`} />
        </div>
      )}

      {toDelete && (
        <Confirm
          title="Ștergi documentul?"
          confirmLabel="Șterge"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() =>
            void run(async () => {
              await api.moduleCall(ID, "delete", { id: toDelete.id });
              setToDelete(null);
              setCurrent(null);
              await refresh();
            })
          }
        >
          „{toDelete.name}” și toate cele {toDelete.current} versiuni dispar din listă. Conținutul rămâne pe disc până la
          colectarea fișierelor din „Date și backup” (și în backupurile făcute până acum).
        </Confirm>
      )}
    </section>
  );
}
