// 7.10b: „Autorizațiile firmei” — the permits the firm already has, with what has expired and what ends soon
// (reminders come from the module). „Din depozitul de documente…” lists what the vault read from the papers of
// „Autorizații și avize” (title, number, issue day, end of validity, institution); „Folosește” fills in the form
// and the person checks and saves it. Nothing is written without that.
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.permits";
const VAULT = "kgb.vault";

interface Held {
  id: string;
  version: number;
  titlu: string;
  institutie: string;
  numar: string;
  emisa: string | null;
  valabila_pana: string | null;
  procedura: string | null;
  document: string | null;
  nota: string;
  stare: "fara_termen" | "valabila" | "expira" | "expirata";
  zile: number | null;
}
interface Found {
  doc: string;
  nume: string;
  titlu: string;
  numar: string;
  emisa: string;
  valabila_pana: string;
  institutie: string;
}
type Draft = { id?: string; version?: number; titlu: string; institutie: string; numar: string; emisa: string; valabila_pana: string; procedura: string; document: string; nota: string };

const empty: Draft = { titlu: "", institutie: "", numar: "", emisa: "", valabila_pana: "", procedura: "", document: "", nota: "" };
const ro = (d?: string | null) => (d ? d.split("-").reverse().join(".") : "");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function HeldPermits({ procs, onError }: { procs: Array<{ id: string; titlu: string }>; onError: (e: string | null) => void }) {
  const [list, setList] = useState<Held[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const [vaultOn, setVaultOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await api.moduleCall<Held[]>(ID, "autorizatii", { azi: today() }));
      const m = await api.listModules();
      setVaultOn(m.modules.some((x) => x.id === VAULT && x.enabled) && m.access[VAULT] !== "niciunul");
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
    await load();
  };
  const save = (d: Draft) =>
    run(async () => {
      await api.moduleCall(ID, "autorizatie_save", {
        ...(d.id ? { id: d.id, version: d.version } : {}),
        titlu: d.titlu,
        institutie: d.institutie,
        numar: d.numar,
        emisa: d.emisa || undefined,
        valabila_pana: d.valabila_pana || undefined,
        procedura: d.procedura || undefined,
        document: d.document,
        nota: d.nota,
      });
      setNotice(`„${d.titlu}” e salvată.`);
      setDraft(null);
    });
  const fromVault = () =>
    run(async () => {
      setFound(await api.moduleCall<Found[]>(VAULT, "autorizatii_propuse"));
    });
  const known = (f: Found) => list.some((h) => h.document === f.doc);
  const state = (h: Held) =>
    h.stare === "expirata"
      ? `expirată de ${-(h.zile ?? 0)} zile`
      : h.stare === "expira"
        ? h.zile === 0
          ? "expiră azi"
          : `expiră în ${h.zile} zile`
        : h.stare === "valabila"
          ? "valabilă"
          : "fără termen";

  return (
    <div className="held-permits">
      <div className="row wrap">
        <button className="primary" disabled={busy} onClick={() => setDraft({ ...empty })}>
          Adaugă o autorizație…
        </button>
        {vaultOn && (
          <button disabled={busy} onClick={() => void fromVault()}>
            Din depozitul de documente…
          </button>
        )}
        <span className="muted small">Ce are firma deja: memento-uri cu 30 de zile înainte de expirare, în ultima săptămână și în ziua expirării.</span>
      </div>
      {notice && <p className="muted">{notice}</p>}

      {found && (
        <div className="card" role="region" aria-label="Autorizații găsite în depozit">
          <h3>Găsite în depozit</h3>
          {found.length === 0 && <p className="muted">În „Autorizații și avize” din depozit nu e niciun document.</p>}
          <ul className="plain">
            {found.map((f) => (
              <li key={f.doc} data-doc={f.doc}>
                <b className="no-i18n">{f.titlu || f.nume}</b>
                <span className="muted small no-i18n">{` · ${[f.numar && `nr. ${f.numar}`, f.emisa && `din ${ro(f.emisa)}`, f.valabila_pana && `până la ${ro(f.valabila_pana)}`].filter(Boolean).join(", ")}`}</span>{" "}
                <span className="muted small">din</span> <span className="muted small no-i18n">{f.nume}</span>{" "}
                {known(f) ? (
                  <span className="muted small">(adăugată)</span>
                ) : (
                  <button
                    className="link small"
                    onClick={() => {
                      setDraft({ ...empty, titlu: f.titlu || f.nume.replace(/\.[^.]+$/, ""), numar: f.numar, emisa: f.emisa, valabila_pana: f.valabila_pana, institutie: f.institutie, document: f.doc });
                      setFound(null);
                    }}
                  >
                    Folosește
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button onClick={() => setFound(null)}>Închide</button>
        </div>
      )}

      {draft && (
        <form
          className="card"
          aria-label="Autorizația"
          onSubmit={(e) => {
            e.preventDefault();
            void save(draft);
          }}
        >
          <h3>{draft.id ? "Autorizația" : "Autorizație nouă"}</h3>
          {draft.document && !draft.id && <p className="muted small">Completat din depozit; verifică datele cu documentul.</p>}
          <div className="row wrap">
            <input aria-label="Titlul autorizației" placeholder="Titlul (de exemplu Autorizație de securitate la incendiu)" value={draft.titlu} onChange={(e) => setDraft({ ...draft, titlu: e.target.value })} size={40} />
            <input aria-label="Numărul autorizației" placeholder="Numărul" value={draft.numar} onChange={(e) => setDraft({ ...draft, numar: e.target.value })} size={14} />
          </div>
          <input aria-label="Instituția" placeholder="Instituția care a emis-o" value={draft.institutie} onChange={(e) => setDraft({ ...draft, institutie: e.target.value })} />
          <div className="row wrap">
            <label className="small">
              Emisă la <input type="date" aria-label="Data emiterii" value={draft.emisa} onChange={(e) => setDraft({ ...draft, emisa: e.target.value })} />
            </label>
            <label className="small">
              Valabilă până la <input type="date" aria-label="Valabilă până la" value={draft.valabila_pana} onChange={(e) => setDraft({ ...draft, valabila_pana: e.target.value })} />
            </label>
            <span className="muted small">gol = fără termen</span>
          </div>
          <label className="small">
            Procedura{" "}
            <select aria-label="Procedura autorizației" value={draft.procedura} onChange={(e) => setDraft({ ...draft, procedura: e.target.value })}>
              <option value="">(niciuna)</option>
              {procs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titlu}
                </option>
              ))}
            </select>
          </label>
          <textarea aria-label="Nota autorizației" placeholder="Notă (condiții, vize anuale…)" value={draft.nota} onChange={(e) => setDraft({ ...draft, nota: e.target.value })} rows={2} />
          <div className="row wrap">
            <button className="primary" disabled={busy || !draft.titlu.trim()}>
              Salvează
            </button>
            <button type="button" disabled={busy} onClick={() => setDraft(null)}>
              Renunță
            </button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p className="muted">Nicio autorizație înregistrată încă.</p>
      ) : (
        <table className="audit held-list">
          <thead>
            <tr>
              <th>Autorizația</th>
              <th>Nr.</th>
              <th>Emisă</th>
              <th>Valabilă până la</th>
              <th>Stare</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.id} data-state={h.stare} className={h.stare === "expirata" ? "held-expired" : h.stare === "expira" ? "held-soon" : ""}>
                <td>
                  <b className="no-i18n">{h.titlu}</b>
                  {h.institutie && <div className="muted small no-i18n">{h.institutie}</div>}
                </td>
                <td className="no-i18n">{h.numar}</td>
                <td>{ro(h.emisa)}</td>
                <td>{ro(h.valabila_pana) || "—"}</td>
                <td>{state(h)}</td>
                <td className="row">
                  <button
                    className="link small"
                    disabled={busy}
                    onClick={() =>
                      setDraft({
                        id: h.id,
                        version: h.version,
                        titlu: h.titlu,
                        institutie: h.institutie,
                        numar: h.numar,
                        emisa: h.emisa ?? "",
                        valabila_pana: h.valabila_pana ?? "",
                        procedura: h.procedura ?? "",
                        document: h.document ?? "",
                        nota: h.nota,
                      })
                    }
                  >
                    modifică
                  </button>
                  <button className="link small" disabled={busy} onClick={() => void run(() => api.moduleCall(ID, "autorizatie_delete", { id: h.id, version: h.version }).then(() => setNotice(`„${h.titlu}” e ștearsă.`)))}>
                    șterge
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
