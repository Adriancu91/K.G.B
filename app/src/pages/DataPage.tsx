// Data, backups and maintenance (Etapa 2, step 2.9). Restoring never
// overwrites the current workspace: it creates a new one (D-030).
import { useCallback, useEffect, useState } from "react";
import { api, message, type BackupReason, type BackupView, type DataInfo } from "../api";
import { Confirm } from "../components/Confirm";

const when = (ms: number) => new Date(ms).toLocaleString("ro-RO");
const mb = (b: number) => `${(b / (1024 * 1024)).toFixed(1)} MB`;
const REASON: Record<BackupReason, string> = {
  manual: "manual",
  before_migration: "automat, înainte de o migrare",
  before_format_upgrade: "automat, înainte de conversia formatului",
  daily: "automat, zilnic (se păstrează ultimele 14)",
};

type Pending = { kind: "restore"; b: BackupView } | { kind: "purge" } | { kind: "open"; id: string; name: string };

export function DataPage({ onError, onSwitched }: { onError: (e: string | null) => void; onSwitched: () => void }) {
  const [d, setD] = useState<DataInfo | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const refresh = useCallback(async () => {
    try {
      setD(await api.dataInfo());
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (f: () => Promise<string | null>) => {
    setBusy(true);
    try {
      setNote(await f());
      onError(null);
    } catch (e) {
      setNote(null);
      onError(message(e));
    }
    setBusy(false);
    await refresh();
  };

  if (!d) return <p>Se încarcă…</p>;
  return (
    <section>
      <h2>Spațiul de lucru</h2>
      <dl className="facts">
        <dt>Date pe disc</dt>
        <dd>{mb(d.disk_bytes)}</dd>
        <dt>Format jurnal</dt>
        <dd>{d.format}</dd>
        <dt>Resturi (carantină, generația anterioară)</dt>
        <dd>{mb(d.leftover_bytes)}</dd>
      </dl>

      <h2>Backup</h2>
      <p className="muted">
        Un backup e o copie completă, verificată fișier cu fișier. Restaurarea creează un spațiu de lucru nou, alături de
        cel curent; nu suprascrie nimic.
      </p>
      <div className="row">
        <button
          className="primary"
          disabled={busy}
          onClick={() => void run(async () => `Backup creat: ${await api.createBackup()}`)}
        >
          Fă un backup acum
        </button>
      </div>
      <table className="audit">
        <thead>
          <tr>
            <th>Când</th>
            <th>Tip</th>
            <th>Înregistrări</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {d.backups.map((b) => (
            <tr key={b.id}>
              <td>{when(b.meta.created_ms)}</td>
              <td>
                {REASON[b.meta.reason]}
                {b.meta.detail ? ` (${b.meta.detail})` : ""}
              </td>
              <td>{b.meta.records}</td>
              <td className="row">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => `Backup verificat: ${await api.verifyBackup(b.id)} înregistrări, toate fișierele intacte.`)
                  }
                >
                  Verifică
                </button>
                <button disabled={busy} onClick={() => setPending({ kind: "restore", b })}>
                  Restaurează…
                </button>
              </td>
            </tr>
          ))}
          {d.backups.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Niciun backup încă.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Întreținere</h2>
      <div className="row">
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await api.compactNow();
              return r.steps === 0
                ? "Nimic de compactat."
                : `Compactare: ${r.steps} pași, ${mb(r.bytes_freed)} eliberați, ${r.ms} ms.`;
            })
          }
        >
          Compactează jurnalul
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await api.collectFiles();
              return `Fișiere fără referință mutate deoparte: ${r.blobs_retired} (${mb(r.bytes_retired)}).`;
            })
          }
        >
          Adună fișierele șterse
        </button>
        <button disabled={busy || d.leftover_bytes === 0} onClick={() => setPending({ kind: "purge" })}>
          Șterge resturile…
        </button>
      </div>
      {note && <p>{note}</p>}

      <h2>Spații de lucru pe acest PC</h2>
      <ul className="list">
        {d.workspaces.map((w) => (
          <li key={w.id}>
            <span className="grow">{w.name}</span>
            {w.id === d.current ? (
              <span className="badge stable">deschis</span>
            ) : (
              <button disabled={busy} onClick={() => setPending({ kind: "open", id: w.id, name: w.name })}>
                Deschide
              </button>
            )}
          </li>
        ))}
      </ul>

      {pending?.kind === "restore" && (
        <Confirm
          title="Restaurezi acest backup?"
          confirmLabel="Restaurează ca spațiu nou"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const id = pending.b.id;
            setPending(null);
            void run(async () => {
              await api.restoreBackup(id);
              onSwitched();
              return null;
            });
          }}
        >
          <p>
            Backupul din {when(pending.b.meta.created_ms)} ({pending.b.meta.records} înregistrări) va fi verificat și
            deschis ca un <strong>spațiu de lucru nou</strong>. Spațiul curent rămâne neschimbat și îl poți redeschide din
            această pagină.
          </p>
        </Confirm>
      )}
      {pending?.kind === "open" && (
        <Confirm
          title={`Deschizi „${pending.name}”?`}
          confirmLabel="Deschide"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const id = pending.id;
            setPending(null);
            void run(async () => {
              await api.openWorkspace(id);
              onSwitched();
              return null;
            });
          }}
        >
          <p>Spațiul curent se închide (datele lui rămân salvate).</p>
        </Confirm>
      )}
      {pending?.kind === "purge" && (
        <Confirm
          title="Ștergi definitiv resturile?"
          confirmLabel="Șterge definitiv"
          danger
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            void run(async () => {
              const r = await api.purgeLeftovers();
              return `Șterse: ${r.files} fișiere (${mb(r.bytes)}).`;
            });
          }}
        >
          <p>
            Se șterg {mb(d.leftover_bytes)}: bucăți tăiate la recuperarea după opriri bruște, generația anterioară a
            jurnalului și fișierele adunate deoparte. Datele vii nu sunt atinse.
          </p>
          <p className="warn">Operația nu se poate anula. Fă întâi un backup dacă ai dubii.</p>
        </Confirm>
      )}
    </section>
  );
}
