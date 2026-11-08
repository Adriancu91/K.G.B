// Network and synchronisation state (Etapa 6, step 6.5). The network starts
// on its own when the workspace belongs to an organization; it synchronises
// every minute while the app runs, and on "Sincronizează acum".
import { useCallback, useEffect, useState } from "react";
import { api, message, type NetStatus, type SyncOutcome } from "../api";

const when = (ms: number | null) => {
  if (!ms) return "niciodată";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function NetPanel({ onError, onSynced, admin = false }: { onError: (e: string | null) => void; onSynced?: () => void; admin?: boolean }) {
  const [st, setSt] = useState<NetStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SyncOutcome[] | null>(null);

  const load = useCallback(async () => {
    try {
      setSt(await api.netStatus());
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(t);
  }, [load]);

  if (!st) return null;
  const relayChoice = st.relay === "off" || st.relay === "n0" ? st.relay : "custom";
  return (
    <section className="net-panel">
      <h3>Rețea și sincronizare</h3>
      <p role="status" className="net-state">
        {st.pornita ? (
          <>
            Rețeaua e <strong>pornită</strong>
            {st.port ? ` (port ${st.port})` : ""}. Ultima rundă: {when(st.ultima_runda_ms)}.
          </>
        ) : (
          <>Rețeaua e oprită{st.motiv ? `: ${st.motiv}` : "."}</>
        )}
        <span className="muted small"> · amprenta acestui PC: {st.amprenta}</span>
      </p>
      <div className="row wrap">
        <label>
          Relay{" "}
          <select
            value={relayChoice}
            aria-label="Relay"
            onChange={(e) =>
              void (async () => {
                try {
                  await api.netSetRelay(e.target.value === "custom" ? st.relay : e.target.value);
                  onError(null);
                } catch (err) {
                  onError(message(err));
                }
                await load();
              })()
            }
          >
            <option value="off">fără relay (doar conexiuni directe)</option>
            <option value="n0">relay public n0 — doar pentru teste</option>
            {relayChoice === "custom" && <option value="custom">{st.relay}</option>}
          </select>
        </label>
        <button
          className="primary"
          disabled={busy || !st.pornita}
          onClick={() =>
            void (async () => {
              setBusy(true);
              try {
                setLast(await api.syncNow());
                onError(null);
                onSynced?.();
              } catch (e) {
                onError(message(e));
              } finally {
                setBusy(false);
                await load();
              }
            })()
          }
        >
          {busy ? "Se sincronizează…" : "Sincronizează acum"}
        </button>
      </div>
      {st.relay === "n0" && (
        <p className="warn small">
          Relay-ul public n0 e folosit doar pentru teste: datele trec criptate, dar serverul vede adresele IP. Pentru folosire reală e nevoie de un relay
          propriu.
        </p>
      )}
      {st.peers.length === 0 ? (
        <p className="muted small">Niciun alt calculator în organizație deocamdată.</p>
      ) : (
        <table className="audit peers-table">
          <thead>
            <tr>
              <th>Persoana</th>
              <th>Calculatorul</th>
              <th>Amprenta</th>
              <th>Ultima sincronizare</th>
              <th>Cale</th>
              <th>Problemă</th>
              {admin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {st.peers.map((p) => (
              <tr key={p.key}>
                <td>{p.member}</td>
                <td>{p.label}</td>
                <td className="fingerprint">{p.fingerprint}</td>
                <td>{when(p.ok_ms)}</td>
                <td>{p.path === "direct" ? "directă" : p.path === "relay" ? "prin relay" : "—"}</td>
                <td className={p.error ? "error small" : "muted small"}>
                  {p.error && (p.tried_ms ?? 0) >= (p.ok_ms ?? 0) ? p.error : p.addr ? "" : "adresă necunoscută încă"}
                </td>
                {admin && (
                  <td>
                    <button
                      className="link danger-text"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Revoci calculatorul „${p.label}” al lui ${p.member}? Nu va mai putea primi sau trimite nimic. Ce a copiat deja rămâne pe el: K.G.B. nu poate șterge date de pe alt PC de la distanță.`,
                          )
                        )
                          void (async () => {
                            try {
                              await api.deviceRevoke(p.fingerprint);
                              onError(null);
                              onSynced?.();
                            } catch (e) {
                              onError(message(e));
                            }
                            await load();
                          })();
                      }}
                    >
                      revocă
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {last && (
        <ul className="sync-result small">
          {last.map((o) => (
            <li key={o.key}>
              {o.member} ({o.label}):{" "}
              {o.summary
                ? `${o.summary.create} noi, ${o.summary.actualizate} actualizate${o.summary.refuzate ? `, ${o.summary.refuzate} refuzate` : ""}${o.summary.conflicte ? `, ${o.summary.conflicte} conflicte` : ""}`
                : o.error}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
