// Work sites (Etapa 7, step 7.4m-7): each with its team leader — the person
// whose phone sends the daily attendance report — the hour work starts and
// its workers.
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.team";

interface Emp {
  id: string;
  nume: string;
  activ: boolean;
}
interface Site {
  id: string;
  version: number;
  nume: string;
  sef: string | null;
  inceput: string;
  angajati: string[];
  activ: boolean;
  muncitori: { id: string; nume: string }[];
}

export function SitesView({ emps, onError }: { emps: Emp[]; onError: (e: string | null) => void }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [ns, setNs] = useState({ nume: "", sef: "", inceput: "08:00" });
  const [pick, setPick] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    try {
      setSites(await api.moduleCall<Site[]>(ID, "puncte"));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => void load(), [load]);

  const save = async (s: Partial<Site> & { nume: string }, workers: string[], msg: string) => {
    try {
      await api.moduleCall(ID, "punct_save", { ...(s.id ? { id: s.id, version: s.version } : {}), nume: s.nume, sef: s.sef ?? "", inceput: s.inceput ?? "08:00", angajati: workers, activ: s.activ ?? true });
      onError(null);
      setNotice(msg);
      await load();
    } catch (e) {
      onError(message(e));
    }
  };
  const active = emps.filter((e) => e.activ);

  return (
    <div className="sites">
      {notice && <p className="ok">{notice}</p>}
      <p className="muted">
        Șeful de echipă trimite de pe telefon, la sfârșitul zilei, cine a fost prezent și orele extra; raportul apare la birou, în pagina „Telefon”. Numele
        șefului trebuie să fie cel ales pentru telefonul lui.
      </p>
      {sites.map((s) => {
        const chosen = pick[s.id] ?? s.angajati;
        const changed = pick[s.id] !== undefined;
        return (
          <div key={s.id} className="card" data-site={s.nume}>
            <div className="row wrap">
              <strong>{s.nume}</strong>
              <span>șef de echipă: {s.sef || "—"}</span>
              <span className="muted">începe la {s.inceput}</span>
            </div>
            <div className="row wrap">
              {active.map((e) => (
                <label key={e.id} className="small">
                  <input
                    type="checkbox"
                    aria-label={`${e.nume} la ${s.nume}`}
                    checked={chosen.includes(e.id)}
                    onChange={(x) => setPick({ ...pick, [s.id]: x.target.checked ? [...chosen, e.id] : chosen.filter((y) => y !== e.id) })}
                  />{" "}
                  {e.nume}
                </label>
              ))}
            </div>
            {changed && (
              <div className="row">
                <button
                  className="primary"
                  onClick={() =>
                    void save(s, chosen, `Muncitorii de la ${s.nume} au fost salvați.`).then(() => setPick(Object.fromEntries(Object.entries(pick).filter(([k]) => k !== s.id))))
                  }
                >
                  Salvează muncitorii
                </button>
                <button onClick={() => setPick(Object.fromEntries(Object.entries(pick).filter(([k]) => k !== s.id)))}>Renunță</button>
              </div>
            )}
          </div>
        );
      })}
      <form
        className="row wrap sites-new"
        aria-label="Punct de lucru nou"
        onSubmit={(e) => {
          e.preventDefault();
          void save({ nume: ns.nume, sef: ns.sef, inceput: ns.inceput }, [], `Punctul de lucru ${ns.nume} a fost adăugat; bifează-i muncitorii.`).then(() => setNs({ nume: "", sef: "", inceput: "08:00" }));
        }}
      >
        <input placeholder="Punctul de lucru" required value={ns.nume} onChange={(e) => setNs({ ...ns, nume: e.target.value })} aria-label="Numele punctului de lucru" />
        <input placeholder="Șeful de echipă" value={ns.sef} onChange={(e) => setNs({ ...ns, sef: e.target.value })} aria-label="Șeful de echipă" />
        <label className="small">
          începe la <input type="time" value={ns.inceput} onChange={(e) => setNs({ ...ns, inceput: e.target.value })} aria-label="Ora de început" />
        </label>
        <button type="submit">Adaugă punctul de lucru</button>
      </form>
    </div>
  );
}
