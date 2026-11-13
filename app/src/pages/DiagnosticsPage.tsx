// Diagnostics: versions, storage recovery, recent problems, audit journal.
// The report never contains notes or other user content.
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api, message, type Diagnostics } from "../api";

/** „Probleme cunoscute” (8.10): what does not work yet, or works with a limit, in this version. */
const KNOWN: string[] = [
  "Programul nu e încă semnat digital: Windows avertizează la instalare („editor necunoscut”).",
  "Pe unele calculatoare cu Windows 10 lipsește WebView2, de care K.G.B. are nevoie; se instalează de la Microsoft.",
  "Sincronizarea între calculatoare e verificată doar cu noduri de test pe același PC; proba cu un al doilea PC urmează.",
  "„Ferestre web”: paginile care se derulează într-o zonă interioară, nu în pagina întreagă, nu se pot îngheța pe o poziție.",
  "Radio: apar doar posturile care transmit pe adrese https.",
  "Știrile de la Guvernul României au ora fără fus orar și pot apărea cu două ore decalaj.",
  "Cotele de TVA (21 / 11 / 0) trebuie confirmate cu un contabil.",
];

const when = (ms: unknown) => (typeof ms === "number" ? new Date(ms).toLocaleString("ro-RO") : "");

export function DiagnosticsPage({ onError }: { onError: (e: string | null) => void }) {
  const [d, setD] = useState<Diagnostics | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [notices, setNotices] = useState<string | null>(null);
  const showNotices = () => void invoke<string>("third_party_notices").then(setNotices, (e: unknown) => onError(message(e)));

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
      <h2>Probleme cunoscute</h2>
      <ul className="known-issues">
        {KNOWN.map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ul>
      <p className="muted">
        Pentru ajutor: „Trimite o observație” (din stânga jos) și „Salvează raportul într-un fișier” de mai sus. Raportul nu conține CNP-uri, numere de card
        sau de telefon, IBAN-uri, adrese de e-mail, chei sau numele tău de utilizator Windows; îl trimiți tu, dacă vrei.
      </p>
      <h2>Componente terțe și licențe</h2>
      <p className="muted">K.G.B. folosește componente open source. Lista lor, cu licența fiecăreia și textele licențelor, e livrată cu programul (fișierul THIRD-PARTY-NOTICES.txt de lângă K.G.B.).</p>
      {notices === null ? (
        <button onClick={showNotices}>Arată licențele</button>
      ) : (
        <pre className="report notices">{notices}</pre>
      )}
    </section>
  );
}
