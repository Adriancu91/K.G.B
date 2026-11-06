// Module catalog: enable (after showing the permissions), disable (after a
// confirmation that the data stays), show/hide in the active profile.
import { useState } from "react";
import { api, message, type ModulesReply, type ModuleView } from "../api";
import { Confirm } from "../components/Confirm";

const STATUS_LABEL: Record<ModuleView["status"], string> = {
  stable: "stabil",
  beta: "beta",
  experimental: "experimental",
  disabled: "retras",
};

export function Catalog(props: {
  modules: ModulesReply;
  profileName: string;
  onChanged: () => Promise<void>;
  onError: (e: string | null) => void;
}) {
  const [enabling, setEnabling] = useState<ModuleView | null>(null);
  const [disabling, setDisabling] = useState<ModuleView | null>(null);

  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
      props.onError(null);
    } catch (e) {
      props.onError(message(e));
    }
    await props.onChanged();
  };

  return (
    <section>
      <p className="muted">
        Modulele se activează doar după ce vezi ce permisiuni cer. Dezactivarea nu șterge datele unui modul.
      </p>
      <div className="cards">
        {props.modules.modules.map((m) => {
          const visible = !props.modules.hidden.includes(m.id);
          return (
            <article key={m.id} className="card">
              <header>
                <h3>{m.name}</h3>
                <span className={`badge ${m.status}`}>{STATUS_LABEL[m.status]}</span>
              </header>
              <p>{m.description}</p>
              <dl className="facts">
                <dt>Versiune</dt>
                <dd>{m.version}</dd>
                <dt>Stare</dt>
                <dd>{m.enabled ? "activat" : "dezactivat"}</dd>
                <dt>Înregistrări</dt>
                <dd>{m.records}</dd>
              </dl>
              {!m.compatible && <p className="error">Incompatibil cu această versiune a nucleului.</p>}
              <div className="row">
                {m.enabled ? (
                  <button onClick={() => setDisabling(m)}>Dezactivează</button>
                ) : (
                  <button
                    className="primary"
                    disabled={!m.compatible || m.status === "disabled"}
                    onClick={() => setEnabling(m)}
                  >
                    Activează…
                  </button>
                )}
                {m.enabled && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) => void run(() => api.setModuleVisible(m.id, e.target.checked))}
                    />
                    Arată în profilul „{props.profileName}”
                  </label>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <h2>În plan</h2>
      <ul className="list">
        {props.modules.planned.map((p) => (
          <li key={p.id}>
            <span className="grow">{p.name}</span>
            <span className="badge planned">Neimplementat — {p.stage}</span>
          </li>
        ))}
      </ul>

      {enabling && (
        <Confirm
          title={`Activezi „${enabling.name}”?`}
          confirmLabel="Acordă și activează"
          onCancel={() => setEnabling(null)}
          onConfirm={() => {
            const m = enabling;
            setEnabling(null);
            void run(() =>
              api.enableModule(
                m.id,
                m.permissions.map((p) => p.id),
              ),
            );
          }}
        >
          {enabling.permissions.length === 0 ? (
            <p>Modulul nu cere nicio permisiune.</p>
          ) : (
            <>
              <p>Modulul cere aceste permisiuni:</p>
              <ul>
                {enabling.permissions.map((p) => (
                  <li key={p.id}>
                    <code>{p.id}</code> — {p.description}
                  </li>
                ))}
              </ul>
            </>
          )}
          {enabling.status === "experimental" && (
            <p className="warn">Modul experimental: e inclus pentru demonstrație, nu pentru date reale.</p>
          )}
        </Confirm>
      )}
      {disabling && (
        <Confirm
          title={`Dezactivezi „${disabling.name}”?`}
          confirmLabel="Dezactivează"
          onCancel={() => setDisabling(null)}
          onConfirm={() => {
            const m = disabling;
            setDisabling(null);
            void run(() => api.disableModule(m.id));
          }}
        >
          <p>{disabling.on_disable}</p>
          <p className="muted">Înregistrări păstrate: {disabling.records}.</p>
        </Confirm>
      )}
    </section>
  );
}
