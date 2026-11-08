// "Dispozitive și sincronizare" (Etapa 6, step 6.9): everything about the
// organization's computers in one place — the network, every device (this
// PC, the others, the revoked), new devices waiting for approval, answering
// an invitation on a new PC, and the synchronisation conflicts.
// People and roles stay on the "Organizație" page.
import { useCallback, useEffect, useState } from "react";
import { api, message, type DeviceRow, type OrgReply } from "../api";
import { ConflictsPage } from "./ConflictsPage";
import { JoinOrg, Requests } from "./Devices";
import { NetPanel } from "./NetPanel";

const when = (ms: number | null) => {
  if (!ms) return "—";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function AllDevices({ tick }: { tick: number }) {
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void api
        .netStatus()
        .then((s) => alive && setRows(s.dispozitive))
        .catch(() => {});
    load();
    const t = window.setInterval(load, 15000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [tick]);
  if (!rows || rows.length === 0) return null;
  return (
    <section>
      <h3>Toate calculatoarele organizației</h3>
      <table className="audit devices-table">
        <thead>
          <tr>
            <th>Calculatorul</th>
            <th>Persoana</th>
            <th>Amprenta</th>
            <th>Stare</th>
            <th>Ultima sincronizare</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.fingerprint} className={d.revocat || d.persoana_scoasa ? "denied" : ""}>
              <td>{d.label}</td>
              <td>{d.member}</td>
              <td className="fingerprint">{d.fingerprint}</td>
              <td>{d.acesta ? "acest PC" : d.revocat ? "revocat" : d.persoana_scoasa ? "persoana a fost scoasă" : "activ"}</td>
              <td>
                {d.acesta ? "—" : when(d.ok_ms)}
                {d.path && !d.acesta ? ` (${d.path === "direct" ? "directă" : "prin relay"})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        Un calculator revocat nu mai primește și nu mai trimite nimic. Ce a copiat deja rămâne pe el: K.G.B. nu poate șterge date de pe alt PC de la
        distanță.
      </p>
    </section>
  );
}

export function DevicesPage({ onError }: { onError: (e: string | null) => void }) {
  const [org, setOrg] = useState<OrgReply | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      setOrg(await api.org());
    } catch (e) {
      onError(message(e));
    }
    setTick((t) => t + 1);
  }, [onError]);
  useEffect(() => {
    void load();
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

  if (!org) return <p className="muted">Se încarcă…</p>;
  const admin = org.current?.role.admin ?? false;
  return (
    <div className="devices-page org-page">
      {!org.organization && (
        <>
          <p>
            Acest spațiu de lucru nu face parte dintr-o organizație. O poți crea din pagina „Organizație”, sau poți intra în una la care ai fost invitat.
          </p>
          <JoinOrg run={run} />
        </>
      )}
      <NetPanel onError={onError} onSynced={() => void load()} admin={admin} />
      {org.organization && <AllDevices tick={tick} />}
      {admin && <Requests org={org} run={run} />}
      <section>
        <h3>Conflicte</h3>
        <ConflictsPage onError={onError} />
      </section>
    </div>
  );
}
