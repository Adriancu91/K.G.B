// The catalog of procedures (7.9a, D-088): avize, autorizații and approvals taken from the official pages of the
// institutions, each with its sources and the day they were read. The person picks one and adds it to the firm's
// procedures (then it is theirs to correct); the kind of activity chosen in the Catalog of modules (7.4n) is
// offered as the first filter.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api, message } from "../../api";

const ID = "kgb.permits";

interface Entry {
  cheie: string;
  titlu: string;
  domeniu: string;
  institutie: string;
  descriere: string;
  activitati: string[];
  documente: number;
  pasi: number;
  surse: { titlu: string; url: string; verificat: string }[];
  verificat: string;
  adaugata: boolean;
}

export function CatalogDialog(props: {
  domains: Array<[string, string]>;
  onAdded: (titlu: string) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<Entry[]>([]);
  const [activity, setActivity] = useState<{ id: string; name: string } | null>(null);
  const [onlyMine, setOnlyMine] = useState(true);
  const [domain, setDomain] = useState("");
  const [find, setFind] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api.moduleCall<Entry[]>(ID, "catalog").then(setList, (e: unknown) => setErr(message(e)));
  useEffect(() => {
    void load();
    void Promise.all([api.getSettings(), invoke<{ id: string; name: string }[]>("activities_list")]).then(
      ([st, acts]) => {
        const a = acts.find((x) => x.id === st.settings.activitate);
        setActivity(a ? { id: a.id, name: a.name } : null);
      },
      () => setActivity(null),
    );
  }, []);
  const add = async (e: Entry) => {
    setBusy(true);
    setErr(null);
    try {
      await api.moduleCall(ID, "catalog_adauga", { cheie: e.cheie });
      await load();
      props.onAdded(e.titlu);
    } catch (x) {
      setErr(message(x));
    } finally {
      setBusy(false);
    }
  };
  const q = find.trim().toLowerCase();
  const shown = list.filter(
    (e) =>
      (!activity || !onlyMine || e.activitati.includes(activity.id)) &&
      (!domain || e.domeniu === domain) &&
      (!q || e.titlu.toLowerCase().includes(q) || e.institutie.toLowerCase().includes(q) || e.descriere.toLowerCase().includes(q)),
  );
  const domainName = (d: string) => props.domains.find(([k]) => k === d)?.[1] ?? d;
  return (
    <div className="overlay" role="presentation" onClick={() => !busy && props.onClose()}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="cat-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="cat-title">Proceduri din catalog</h2>
        <p className="muted small">
          Luate din paginile oficiale ale instituțiilor și din legislatie.just.ro, cu data verificării. Procedurile se schimbă: verifică la instituție
          înainte de depunere. O procedură adăugată devine a firmei tale și o poți corecta.
        </p>
        <div className="row wrap">
          {activity && (
            <label className="small">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> doar pentru {activity.name}
            </label>
          )}
          <select aria-label="Domeniul" value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="">Toate domeniile</option>
            {props.domains.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input aria-label="Caută în catalog" placeholder="Caută: autorizație, ISU, DSV…" value={find} onChange={(e) => setFind(e.target.value)} />
        </div>
        {err && <p className="error">{err}</p>}
        <ul className="catalog-list">
          {shown.map((e) => (
            <li key={e.cheie} className="card" data-procedure={e.cheie}>
              <div className="row wrap">
                <strong className="grow no-i18n">{e.titlu}</strong>
                <span className="badge">{domainName(e.domeniu)}</span>
                {e.adaugata ? (
                  <span className="badge stable">adăugată</span>
                ) : (
                  <button className="primary" disabled={busy} onClick={() => void add(e)}>
                    Adaugă
                  </button>
                )}
              </div>
              <p className="muted small">
                <span className="no-i18n">{e.institutie}</span> · {e.documente} documente, {e.pasi} pași · surse verificate la {e.verificat}
              </p>
              <button className="link small" onClick={() => setOpen(open === e.cheie ? null : e.cheie)}>
                {open === e.cheie ? "Ascunde detaliile" : "Detalii și surse"}
              </button>
              {open === e.cheie && (
                <div className="small no-i18n">
                  <p style={{ whiteSpace: "pre-line" }}>{e.descriere}</p>
                  <ul>
                    {e.surse.map((s) => (
                      <li key={s.url}>
                        {s.titlu} — <span className="no-i18n muted">{s.url}</span> (verificat {s.verificat})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="muted">Nicio procedură pentru alegerea de acum.</p>}
        <div className="dialog-actions">
          <button onClick={props.onClose} disabled={busy}>
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}
