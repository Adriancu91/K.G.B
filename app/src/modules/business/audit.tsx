// Audit (Etapa 5, step 5.8): the verification recomputes everything from the
// records; the journal lists every recorded operation.
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.business";

interface Check {
  verificare: string;
  verificate: number;
  ok: boolean;
  probleme: string[];
  numar_probleme: number;
}
interface Entry {
  tip: string;
  document: string;
  data: string;
  suma: string | null;
  creat_ms: number;
}

const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function AuditView({ onError }: { onError: (e: string | null) => void }) {
  const [checks, setChecks] = useState<{ verificari: Check[]; probleme: number } | null>(null);
  const [journal, setJournal] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setJournal(await api.moduleCall<Entry[]>(ID, "journal", { limit: 300 }));
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="audit-view">
      <div className="row wrap">
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void (async () => {
              setBusy(true);
              try {
                setChecks(await api.moduleCall(ID, "verify"));
                onError(null);
              } catch (e) {
                onError(message(e));
              } finally {
                setBusy(false);
              }
            })()
          }
        >
          Verifică acum
        </button>
        <span className="muted small">Reface din înregistrări stocurile, valorile, facturile, numerotarea, soldurile și plățile, și le compară cu regulile.</span>
      </div>
      {checks && (
        <>
          <p className={checks.probleme === 0 ? "ok-text" : "error"} role="status">
            {checks.probleme === 0 ? "Totul e în regulă: 0 probleme." : `${checks.probleme} probleme găsite.`}
          </p>
          <table className="audit verify-table">
            <thead>
              <tr>
                <th>Verificare</th>
                <th>Înregistrări verificate</th>
                <th>Rezultat</th>
              </tr>
            </thead>
            <tbody>
              {checks.verificari.map((c) => (
                <tr key={c.verificare}>
                  <td>{c.verificare}</td>
                  <td className="num">{c.verificate}</td>
                  <td className={c.ok ? "" : "error"}>
                    {c.ok ? "în regulă" : `${c.numar_probleme} probleme`}
                    {c.probleme.map((p) => (
                      <div key={p} className="small">
                        {p}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>Jurnal (ultimele operații)</h3>
      <table className="audit journal-table">
        <thead>
          <tr>
            <th>Înregistrat</th>
            <th>Operație</th>
            <th>Document</th>
            <th>Data documentului</th>
            <th>Suma (lei)</th>
          </tr>
        </thead>
        <tbody>
          {journal.map((e, i) => (
            <tr key={i}>
              <td>{when(e.creat_ms)}</td>
              <td>{e.tip}</td>
              <td>{e.document}</td>
              <td>{e.data.split("-").reverse().join(".")}</td>
              <td className="num">{e.suma ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
