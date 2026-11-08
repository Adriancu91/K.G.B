// Permits and authorizations (Etapa 7, step 7.2; Master Plan §6.6): a
// library of procedures, each with dated official sources, and case files
// that follow a procedure with a checklist, attached documents and a
// deadline. Guidance only — never a substitute for legal advice or the
// institution's confirmation.
import { open, save } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.permits";

const DOMAINS: Array<[string, string]> = [
  ["constructii", "Construcții"],
  ["mediu", "Mediu"],
  ["isu", "ISU / incendiu"],
  ["functionare", "Funcționare"],
  ["sanitar", "Sanitar"],
  ["transport", "Transport"],
  ["comercial", "Activități comerciale"],
  ["altul", "Altele"],
];
const STATES: Array<[string, string]> = [
  ["deschis", "deschis"],
  ["depus", "depus la instituție"],
  ["aprobat", "aprobat"],
  ["respins", "respins"],
  ["inchis", "închis"],
];
const VERIF: Record<string, string> = { verificata: "verificată", veche: "verificată acum peste un an", neverificata: "fără sursă oficială datată" };

interface Cond {
  text: string;
  obligatoriu: boolean;
}
interface Doc {
  nume: string;
  obligatoriu: boolean;
  nota: string;
}
interface Src {
  titlu: string;
  url: string;
  verificat: string;
}
interface Procedure {
  id: string;
  version: number;
  titlu: string;
  domeniu: string;
  institutie: string | null;
  descriere: string | null;
  conditii: Cond[];
  documente: Doc[];
  pasi: string[];
  taxe: string | null;
  termen_legal: string | null;
  surse: Src[];
  verificat: string | null;
  stare_verificare: string;
  dosare: number;
}
interface Item {
  cheie: string;
  text: string;
  obligatoriu: boolean;
  bifat: boolean;
}
interface Case {
  id: string;
  version: number;
  titlu: string;
  procedura: string;
  procedura_titlu: string;
  client: string | null;
  deschis: string;
  termen: string | null;
  stare: string;
  note: string | null;
  elemente: Item[];
  gata: number;
  obligatorii_lipsa: number;
  intarziat: boolean;
  fisiere: Array<{ id: string; nume: string; marime: number }>;
}

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const ro = (d: string | null) => (d ? d.split("-").reverse().join(".") : "—");

interface Draft {
  id?: string;
  version: number;
  titlu: string;
  domeniu: string;
  institutie: string;
  descriere: string;
  conditii: Cond[];
  documente: Doc[];
  pasi: string;
  taxe: string;
  termen_legal: string;
  surse: Src[];
}

const blank = (): Draft => ({
  version: 0,
  titlu: "",
  domeniu: "functionare",
  institutie: "",
  descriere: "",
  conditii: [{ text: "", obligatoriu: true }],
  documente: [{ nume: "", obligatoriu: true, nota: "" }],
  pasi: "",
  taxe: "",
  termen_legal: "",
  surse: [{ titlu: "", url: "", verificat: today() }],
});

const fromProc = (p: Procedure): Draft => ({
  id: p.id,
  version: p.version,
  titlu: p.titlu,
  domeniu: p.domeniu,
  institutie: p.institutie ?? "",
  descriere: p.descriere ?? "",
  conditii: p.conditii.length ? p.conditii : [{ text: "", obligatoriu: true }],
  documente: p.documente.length ? p.documente : [{ nume: "", obligatoriu: true, nota: "" }],
  pasi: p.pasi.join("\n"),
  taxe: p.taxe ?? "",
  termen_legal: p.termen_legal ?? "",
  surse: p.surse.length ? p.surse : [{ titlu: "", url: "", verificat: today() }],
});

function ProcedureEditor({ draft, onSave, onCancel }: { draft: Draft; onSave: (d: Draft) => Promise<string | null>; onCancel: () => void }) {
  const [d, setD] = useState(draft);
  const [err, setErr] = useState<string | null>(null);
  const up = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  return (
    <form
      className="permit-editor"
      aria-label="Procedură"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(d).then(setErr);
      }}
    >
      {err && <p className="error">{err}</p>}
      <label>
        Titlu <input value={d.titlu} onChange={(e) => up({ titlu: e.target.value })} required aria-label="Titlul procedurii" />
      </label>
      <label>
        Domeniu{" "}
        <select value={d.domeniu} onChange={(e) => up({ domeniu: e.target.value })} aria-label="Domeniul">
          {DOMAINS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Instituția <input value={d.institutie} onChange={(e) => up({ institutie: e.target.value })} aria-label="Instituția" />
      </label>
      <label>
        Descriere <textarea rows={2} value={d.descriere} onChange={(e) => up({ descriere: e.target.value })} />
      </label>
      <fieldset>
        <legend>Condiții</legend>
        {d.conditii.map((c, i) => (
          <div className="row" key={i}>
            <input
              value={c.text}
              aria-label={`Condiția ${i + 1}`}
              onChange={(e) => up({ conditii: d.conditii.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
            />
            <label className="small">
              <input
                type="checkbox"
                checked={c.obligatoriu}
                onChange={(e) => up({ conditii: d.conditii.map((x, j) => (j === i ? { ...x, obligatoriu: e.target.checked } : x)) })}
              />{" "}
              obligatorie
            </label>
          </div>
        ))}
        <button type="button" className="link" onClick={() => up({ conditii: [...d.conditii, { text: "", obligatoriu: true }] })}>
          + condiție
        </button>
      </fieldset>
      <fieldset>
        <legend>Documente necesare</legend>
        {d.documente.map((c, i) => (
          <div className="row" key={i}>
            <input
              value={c.nume}
              aria-label={`Documentul ${i + 1}`}
              onChange={(e) => up({ documente: d.documente.map((x, j) => (j === i ? { ...x, nume: e.target.value } : x)) })}
            />
            <label className="small">
              <input
                type="checkbox"
                checked={c.obligatoriu}
                onChange={(e) => up({ documente: d.documente.map((x, j) => (j === i ? { ...x, obligatoriu: e.target.checked } : x)) })}
              />{" "}
              obligatoriu
            </label>
          </div>
        ))}
        <button type="button" className="link" onClick={() => up({ documente: [...d.documente, { nume: "", obligatoriu: true, nota: "" }] })}>
          + document
        </button>
      </fieldset>
      <label>
        Pași (câte unul pe rând) <textarea rows={3} value={d.pasi} onChange={(e) => up({ pasi: e.target.value })} aria-label="Pașii" />
      </label>
      <label>
        Taxe <input value={d.taxe} onChange={(e) => up({ taxe: e.target.value })} aria-label="Taxe" />
      </label>
      <label>
        Termen legal <input value={d.termen_legal} onChange={(e) => up({ termen_legal: e.target.value })} aria-label="Termen legal" />
      </label>
      <fieldset>
        <legend>Surse oficiale (link și data verificării)</legend>
        {d.surse.map((s, i) => (
          <div className="row wrap" key={i}>
            <input
              placeholder="Titlu (de ex. pagina instituției)"
              value={s.titlu}
              aria-label={`Titlul sursei ${i + 1}`}
              onChange={(e) => up({ surse: d.surse.map((x, j) => (j === i ? { ...x, titlu: e.target.value } : x)) })}
            />
            <input
              placeholder="https://…"
              value={s.url}
              aria-label={`Linkul sursei ${i + 1}`}
              onChange={(e) => up({ surse: d.surse.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
            />
            <input
              type="date"
              value={s.verificat}
              aria-label={`Data verificării sursei ${i + 1}`}
              onChange={(e) => up({ surse: d.surse.map((x, j) => (j === i ? { ...x, verificat: e.target.value } : x)) })}
            />
          </div>
        ))}
        <button type="button" className="link" onClick={() => up({ surse: [...d.surse, { titlu: "", url: "", verificat: today() }] })}>
          + sursă
        </button>
      </fieldset>
      <div className="row">
        <button type="submit" className="primary">
          Salvează procedura
        </button>
        <button type="button" onClick={onCancel}>
          Renunță
        </button>
      </div>
    </form>
  );
}

function CaseDetail({ c, procs, reload, onError }: { c: Case; procs: Procedure[]; reload: () => Promise<void>; onError: (e: string | null) => void }) {
  const proc = procs.find((p) => p.id === c.procedura);
  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    }
    await reload();
  };
  return (
    <div className="case-detail">
      <h3>{c.titlu}</h3>
      <p className="muted">
        {c.procedura_titlu}
        {c.client ? ` · ${c.client}` : ""} · deschis {ro(c.deschis)} · termen {ro(c.termen)}
      </p>
      <label>
        Stare{" "}
        <select value={c.stare} aria-label="Starea dosarului" onChange={(e) => void run(() => api.moduleCall(ID, "dosar_stare", { id: c.id, version: c.version, stare: e.target.value }))}>
          {STATES.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {proc && proc.conditii.length > 0 && (
        <>
          <h4>Condiții</h4>
          <ul>
            {proc.conditii.map((x, i) => (
              <li key={i}>
                {x.text} <span className="muted small">({x.obligatoriu ? "obligatorie" : "recomandată"})</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <h4>
        Checklist ({c.gata}/{c.elemente.length})
      </h4>
      <ul className="checklist">
        {c.elemente.map((it) => (
          <li key={it.cheie}>
            <label>
              <input
                type="checkbox"
                checked={it.bifat}
                aria-label={it.text}
                onChange={(e) => void run(() => api.moduleCall(ID, "dosar_bifeaza", { id: c.id, version: c.version, cheie: it.cheie, bifat: e.target.checked }))}
              />{" "}
              {it.text} {!it.obligatoriu && <span className="muted small">(opțional)</span>}
            </label>
          </li>
        ))}
      </ul>
      <h4>Documente atașate</h4>
      <ul>
        {c.fisiere.map((f) => (
          <li key={f.id}>
            {f.nume}{" "}
            <button
              className="link"
              onClick={() =>
                void run(async () => {
                  const dest = await save({ defaultPath: f.nume });
                  if (dest) await api.moduleCall(ID, "fisier_salveaza", { fisier: f.id, dest, overwrite: true });
                })
              }
            >
              salvează o copie…
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() =>
          void run(async () => {
            const path = await open({ multiple: false });
            if (typeof path === "string") await api.importFileWith(ID, path, "dosar_fisier", { id: c.id, version: c.version });
          })
        }
      >
        Atașează un document…
      </button>
    </div>
  );
}

export function PermitsPage({ onError }: { onError: (e: string | null) => void }) {
  const [tab, setTab] = useState<"dosare" | "proceduri">("dosare");
  const [procs, setProcs] = useState<Procedure[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nc, setNc] = useState({ titlu: "", procedura: "", client: "", deschis: today(), termen: "" });

  const load = useCallback(async () => {
    try {
      const azi = today();
      setProcs(await api.moduleCall<Procedure[]>(ID, "proceduri", { azi }));
      setCases(await api.moduleCall<Case[]>(ID, "dosare", { azi }));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const saveProc = async (d: Draft): Promise<string | null> => {
    try {
      await api.moduleCall(ID, "procedura_save", {
        ...(d.id ? { id: d.id, version: d.version } : {}),
        titlu: d.titlu,
        domeniu: d.domeniu,
        institutie: d.institutie,
        descriere: d.descriere,
        conditii: d.conditii,
        documente: d.documente,
        pasi: d.pasi.split("\n"),
        taxe: d.taxe,
        termen_legal: d.termen_legal,
        surse: d.surse,
      });
      setEditing(null);
      await load();
      return null;
    } catch (e) {
      return message(e);
    }
  };

  const current = cases.find((c) => c.id === selected);
  return (
    <div className="permits">
      <p className="warn">
        Informație orientativă: nu înlocuiește consultanța juridică sau confirmarea instituției. Fiecare procedură arată sursele oficiale și data la care
        au fost verificate; verifică la sursă înainte să depui.
      </p>
      <div className="sheet-tabs">
        <button className={tab === "dosare" ? "active" : ""} onClick={() => setTab("dosare")}>
          Dosare
        </button>
        <button className={tab === "proceduri" ? "active" : ""} onClick={() => setTab("proceduri")}>
          Proceduri ({procs.length})
        </button>
      </div>

      {tab === "proceduri" &&
        (editing ? (
          <ProcedureEditor draft={editing} onSave={saveProc} onCancel={() => setEditing(null)} />
        ) : (
          <>
            {procs.length === 0 ? (
              <p className="muted">
                Nicio procedură încă. Aplicația nu vine cu proceduri gata făcute: informația juridică trebuie luată dintr-o sursă oficială pe care ai
                verificat-o.
              </p>
            ) : (
              <table className="audit procedures-table">
                <thead>
                  <tr>
                    <th>Procedura</th>
                    <th>Domeniu</th>
                    <th>Instituția</th>
                    <th>Verificare</th>
                    <th>Dosare</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {procs.map((p) => (
                    <tr key={p.id}>
                      <td>{p.titlu}</td>
                      <td>{DOMAINS.find(([k]) => k === p.domeniu)?.[1]}</td>
                      <td>{p.institutie ?? "—"}</td>
                      <td className={p.stare_verificare === "verificata" ? "" : "error"}>
                        {VERIF[p.stare_verificare]}
                        {p.verificat ? ` (${ro(p.verificat)})` : ""}
                      </td>
                      <td className="num">{p.dosare}</td>
                      <td>
                        <button className="link" onClick={() => setEditing(fromProc(p))}>
                          modifică
                        </button>
                        {p.dosare === 0 && (
                          <button
                            className="link danger-text"
                            onClick={() =>
                              void api
                                .moduleCall(ID, "procedura_delete", { id: p.id, version: p.version })
                                .then(load)
                                .catch((e) => onError(message(e)))
                            }
                          >
                            {" "}
                            șterge
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="primary" onClick={() => setEditing(blank())}>
              Procedură nouă
            </button>
          </>
        ))}

      {tab === "dosare" && (
        <div className="cases">
          {cases.length > 0 && (
            <table className="audit cases-table">
              <thead>
                <tr>
                  <th>Dosar</th>
                  <th>Procedura</th>
                  <th>Termen</th>
                  <th>Stare</th>
                  <th>Progres</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className={c.id === selected ? "selected" : ""} onClick={() => setSelected(c.id)} style={{ cursor: "pointer" }}>
                    <td>{c.titlu}</td>
                    <td>{c.procedura_titlu}</td>
                    <td className={c.intarziat ? "error" : ""}>
                      {ro(c.termen)}
                      {c.intarziat ? " (depășit)" : ""}
                    </td>
                    <td>{STATES.find(([k]) => k === c.stare)?.[1]}</td>
                    <td>
                      {c.gata}/{c.elemente.length}
                      {c.obligatorii_lipsa > 0 && <span className="muted small"> · {c.obligatorii_lipsa} obligatorii lipsă</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {current && <CaseDetail c={current} procs={procs} reload={load} onError={onError} />}
          {procs.length === 0 ? (
            <p className="muted">Ca să deschizi un dosar, adaugă întâi o procedură.</p>
          ) : (
            <form
              className="row wrap"
              aria-label="Dosar nou"
              onSubmit={(e) => {
                e.preventDefault();
                void api
                  .moduleCall<{ id: string }>(ID, "dosar_save", { ...nc, termen: nc.termen || null })
                  .then(async (r) => {
                    setNc({ titlu: "", procedura: "", client: "", deschis: today(), termen: "" });
                    setSelected(r.id);
                    onError(null);
                    await load();
                  })
                  .catch((err) => onError(message(err)));
              }}
            >
              <input placeholder="Titlul dosarului" value={nc.titlu} onChange={(e) => setNc({ ...nc, titlu: e.target.value })} required aria-label="Titlul dosarului" />
              <select value={nc.procedura} onChange={(e) => setNc({ ...nc, procedura: e.target.value })} required aria-label="Procedura dosarului">
                <option value="">— procedura —</option>
                {procs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titlu}
                  </option>
                ))}
              </select>
              <input placeholder="Client sau proiect" value={nc.client} onChange={(e) => setNc({ ...nc, client: e.target.value })} aria-label="Clientul" />
              <label className="small">
                Termen <input type="date" value={nc.termen} onChange={(e) => setNc({ ...nc, termen: e.target.value })} aria-label="Termenul dosarului" />
              </label>
              <button type="submit">Deschide dosarul</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
