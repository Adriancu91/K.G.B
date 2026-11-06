// Diagnostics: versions, storage recovery, recent problems, audit journal.
// The report never contains notes or other user content.
import { useCallback, useEffect, useState } from "react";
import { api, message, type Diagnostics } from "../api";

const when = (ms: unknown) => (typeof ms === "number" ? new Date(ms).toLocaleString("ro-RO") : "");

export function DiagnosticsPage({ onError }: { onError: (e: string | null) => void }) {
  const [d, setD] = useState<Diagnostics | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setD(await api.diagnostics());
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exportReport = async () => {
    try {
      setSaved(await api.exportDiagnostics());
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  };

  if (!d) return <p>Se încarcă…</p>;
  return (
    <section>
      <div className="row">
        <button onClick={() => void refresh()}>Reîmprospătează</button>
        <button className="primary" onClick={() => void exportReport()}>
          Salvează raportul într-un fișier
        </button>
      </div>
      {saved && (
        <p>
          Raport salvat în <code>{saved}</code>
        </p>
      )}
      <h2>Raport</h2>
      <pre className="report">{d.report}</pre>
      <h2>Jurnal de audit (ultimele {d.audit.length})</h2>
      <table className="audit">
        <thead>
          <tr>
            <th>Când</th>
            <th>Modul</th>
            <th>Acțiune</th>
            <th>Rezultat</th>
            <th>Detalii</th>
          </tr>
        </thead>
        <tbody>
          {d.audit.map((a, i) => (
            <tr key={i} className={a.outcome === "refuzat" ? "denied" : undefined}>
              <td>{when(a.ts_ms)}</td>
              <td>{String(a.module ?? "")}</td>
              <td>{String(a.action ?? "")}</td>
              <td>{String(a.outcome ?? "")}</td>
              <td>{String(a.detail ?? "")}</td>
            </tr>
          ))}
          {d.audit.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Nicio intrare încă.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
