// External sources and licences (Etapa 7, step 7.1; D-062, D-063). Every
// source a module may read from outside — a news feed, a quotes service, an
// official page — is listed here with its terms of use, licence and the date
// they were checked. Nothing is active by default; a source is used only
// after it is switched on, and only with terms, licence and date.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, message, type Source, type SourceInput } from "../api";

const empty = (): SourceInput => ({
  nume: "",
  url: "",
  tip: "rss",
  termeni: "",
  termeni_url: "",
  licenta: "",
  verificat: "",
  note: "",
  version: 0,
});

const toInput = (s: Source): SourceInput => ({
  id: s.id,
  nume: s.nume,
  url: s.url,
  tip: s.tip,
  termeni: s.termeni,
  termeni_url: s.termeni_url,
  licenta: s.licenta,
  verificat: s.verificat,
  note: s.note,
  version: s.version,
});

export function SourcesPage({ onError }: { onError: (e: string | null) => void }) {
  const [items, setItems] = useState<Source[] | null>(null);
  const [kinds, setKinds] = useState<Array<[string, string]>>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [form, setForm] = useState<SourceInput | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.sources();
      setItems(r.items);
      setKinds(r.kinds);
      setCanEdit(r.poate_modifica);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
      onError(null);
      await load();
      return true;
    } catch (e) {
      onError(message(e));
      return false;
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    void run(() => api.sourceSave(form)).then((ok) => ok && setForm(null));
  };

  if (!items) return <p className="muted">Se încarcă…</p>;
  const kindName = (k: string) => kinds.find(([id]) => id === k)?.[1] ?? k;
  const set = (k: keyof SourceInput) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  return (
    <div className="sources-page">
      <p className="muted">
        Aici sunt toate sursele din afara aplicației: fluxuri de știri, servicii de cotații, pagini oficiale. Un modul folosește o sursă doar după ce
        e activată, iar activarea cere condițiile de folosire, licența și data la care le-ai verificat. Aplicația nu vine cu nicio sursă activă.
      </p>
      {!canEdit && <p className="muted">Doar un administrator poate schimba registrul de surse.</p>}
      {items.length === 0 ? (
        <p role="status">Nicio sursă în registru.</p>
      ) : (
        <table className="audit sources-table">
          <thead>
            <tr>
              <th>Sursa</th>
              <th>Tip</th>
              <th>Condiții de folosire</th>
              <th>Licență</th>
              <th>Verificat</th>
              <th>Stare</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.nume}
                  <div className="muted small">{s.url}</div>
                </td>
                <td>{kindName(s.tip)}</td>
                <td className="small">
                  {s.termeni}
                  {s.termeni_url && <div className="muted">{s.termeni_url}</div>}
                </td>
                <td className="small">{s.licenta || <span className="muted">—</span>}</td>
                <td>{s.verificat ? s.verificat.split("-").reverse().join(".") : <span className="muted">—</span>}</td>
                <td>{s.activa ? `activă (aprobată de ${s.aprobata_de || "—"})` : "oprită"}</td>
                {canEdit && (
                  <td>
                    <button className="link" onClick={() => void run(() => api.sourceSetActive(s.id, !s.activa))}>
                      {s.activa ? "oprește" : "activează"}
                    </button>{" "}
                    <button className="link" onClick={() => setForm(toInput(s))}>
                      modifică
                    </button>{" "}
                    {!s.activa && (
                      <button className="link danger-text" onClick={() => void run(() => api.sourceDelete(s.id))}>
                        șterge
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canEdit && !form && (
        <button className="primary" onClick={() => setForm(empty())}>
          Adaugă o sursă
        </button>
      )}
      {form && (
        <form className="source-form" onSubmit={submit} aria-label="Sursă">
          <label>
            Nume <input value={form.nume} onChange={set("nume")} required aria-label="Numele sursei" />
          </label>
          <label>
            Adresa (https://…) <input value={form.url} onChange={set("url")} required aria-label="Adresa sursei" />
          </label>
          <label>
            Tip{" "}
            <select value={form.tip} onChange={set("tip")} aria-label="Tipul sursei">
              {kinds.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Condițiile de folosire, pe scurt
            <textarea value={form.termeni} onChange={set("termeni")} rows={3} aria-label="Condițiile de folosire" />
          </label>
          <label>
            Linkul condițiilor <input value={form.termeni_url} onChange={set("termeni_url")} aria-label="Linkul condițiilor" />
          </label>
          <label>
            Licența <input value={form.licenta} onChange={set("licenta")} aria-label="Licența" />
          </label>
          <label>
            Data verificării <input type="date" value={form.verificat} onChange={set("verificat")} aria-label="Data verificării" />
          </label>
          <label>
            Note <input value={form.note} onChange={set("note")} aria-label="Note" />
          </label>
          <p className="muted small">Dacă schimbi adresa, condițiile, licența sau data unei surse active, ea se oprește și trebuie activată din nou.</p>
          <div className="row">
            <button type="submit" className="primary">
              Salvează
            </button>
            <button type="button" onClick={() => setForm(null)}>
              Renunță
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
