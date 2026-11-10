// Profiles by kind of activity (7.4n, kgb_core::activities): the person picks what the firm does; the window shows
// the modules that fit, each with the permissions it asks for (already enabled ones marked), and only the ticked
// ones are enabled, with those permissions. The choice is kept in the settings (with the work profile of the
// sidebar); „Documente și modele” then shows the models of that activity first. Nothing is enabled on its own.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api, message, type ModulesReply } from "../api";

export interface Activity {
  id: string;
  name: string;
  description: string;
  modules: string[];
  profile: string;
  models: string[];
}

export function ActivityPicker(props: {
  modules: ModulesReply;
  current: string;
  onDone: (activity: string, profile: string) => Promise<void>;
  onClose: () => void;
}) {
  const [list, setList] = useState<Activity[]>([]);
  const [pick, setPick] = useState<Activity | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    invoke<Activity[]>("activities_list").then(
      (l) => {
        setList(l);
        const cur = l.find((a) => a.id === props.current);
        if (cur) choose(cur);
      },
      (e: unknown) => setErr(message(e)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const byId = new Map(props.modules.modules.map((m) => [m.id, m]));
  const choose = (a: Activity) => {
    setPick(a);
    setTicked(a.modules.filter((id) => byId.get(id) && !byId.get(id)!.enabled && byId.get(id)!.compatible));
  };
  const apply = async () => {
    if (!pick) return;
    setBusy(true);
    setErr(null);
    try {
      for (const id of ticked) {
        const m = byId.get(id);
        if (m && !m.enabled) await api.enableModule(id, m.permissions.map((p) => p.id));
      }
      await props.onDone(pick.id, pick.profile);
      props.onClose();
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="overlay" role="presentation" onClick={() => !busy && props.onClose()}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="act-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="act-title">Ce face firma ta?</h2>
        <p className="muted">
          Alege tipul de activitate: îți propunem modulele potrivite și modelele de documente cele mai folosite. Activezi doar ce
          bifezi; restul rămâne în Catalog, oricând.
        </p>
        <div className="activity-list" role="radiogroup" aria-label="Tipul de activitate">
          {list.map((a) => (
            <button key={a.id} role="radio" aria-checked={pick?.id === a.id} className={pick?.id === a.id ? "activity on" : "activity"} onClick={() => choose(a)}>
              <strong>{a.name}</strong>
              <small>{a.description}</small>
            </button>
          ))}
        </div>
        {pick && (
          <>
            <h3>Module pentru „{pick.name}”</h3>
            <ul className="activity-modules">
              {pick.modules.map((id) => {
                const m = byId.get(id);
                if (!m) return null;
                return (
                  <li key={id}>
                    <label>
                      <input
                        type="checkbox"
                        aria-label={m.name}
                        checked={m.enabled || ticked.includes(id)}
                        disabled={m.enabled || !m.compatible || busy}
                        onChange={() => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))}
                      />{" "}
                      <b>{m.name}</b> {m.enabled ? <span className="muted">(activat deja)</span> : null}
                    </label>
                    {!m.enabled && m.permissions.length > 0 && (
                      <div className="muted small">Cere: {m.permissions.map((p) => p.description).join("; ")}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {err && <p className="error">{err}</p>}
        <div className="dialog-actions">
          <button onClick={props.onClose} disabled={busy}>
            Renunță
          </button>
          <button className="primary" disabled={!pick || busy} onClick={() => void apply()}>
            {ticked.length ? `Activează ${ticked.length === 1 ? "1 modul" : `${ticked.length} module`}` : "Păstrează alegerea"}
          </button>
        </div>
      </div>
    </div>
  );
}
