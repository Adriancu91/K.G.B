// Received invoices and expenses (Etapa 5, step 5.4): typed by hand or taken
// over from the „Extragere date” CSV export. The module checks the totals
// and refuses the same document twice.
import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";

const ID = "kgb.business";

interface Partner {
  id: string;
  nume: string;
  tip: string;
}
interface Purchase {
  id: string;
  tip: "factura" | "bon" | "alt";
  furnizor_nume: string;
  numar: string;
  data: string;
  scadenta: string | null;
  categorie: string | null;
  total_text: string;
  sursa: "manual" | "extragere";
  storno_de: string | null;
  stornat: boolean;
}
const KIND = { factura: "Factură", bon: "Bon fiscal", alt: "Alt document" } as const;
const ro = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PurchasesView({ onError }: { onError: (e: string | null) => void }) {
  const [list, setList] = useState<Purchase[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const empty = { furnizor: "", tip: "factura", numar: "", data: today(), scadenta: "", categorie: "", total_fara_tva: "", tva: "", total: "" };
  const [f, setF] = useState(empty);

  const refresh = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([api.moduleCall<Purchase[]>(ID, "purchases"), api.moduleCall<Partner[]>(ID, "partners")]);
      setList(l);
      setPartners(p.filter((x) => x.tip !== "client"));
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>, inForm = true) => {
    setBusy(true);
    try {
      await fn();
      setFormError(null);
      onError(null);
    } catch (e) {
      if (inForm) setFormError(message(e));
      else onError(message(e));
    } finally {
      setBusy(false);
    }
    await refresh();
  };

  return (
    <div className="purchases">
      <div className="row wrap">
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const path = await open({ multiple: false, filters: [{ name: "CSV din Extragere date", extensions: ["csv"] }] });
              if (typeof path !== "string") return;
              const r = await api.importFile<{ importate: number; duplicate: string[] }>(ID, path);
              setNotice(`Preluate: ${r.importate}.${r.duplicate.length ? ` Deja înregistrate (sărite): ${r.duplicate.join(", ")}.` : ""}`);
            })
          }
        >
          Preia din „Extragere date” (CSV)…
        </button>
        <span className="muted small">În „Extragere date”: Registru → Exportă CSV, apoi alege fișierul aici.</span>
      </div>
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {partners.length === 0 ? (
        <p className="muted">Adaugă mai întâi un furnizor (Facturare → Parteneri, tip „furnizor” sau „client și furnizor”).</p>
      ) : (
        <form
          className="task-form purchase-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.moduleCall(ID, "purchase_save", { ...f, furnizor: f.furnizor || partners[0]?.id });
              setNotice(`Documentul ${f.numar} a fost înregistrat.`);
              setF({ ...empty, furnizor: f.furnizor, tip: f.tip });
            });
          }}
        >
          <div className="row wrap">
            <label>
              Furnizor
              <select aria-label="Furnizor" value={f.furnizor || partners[0]?.id} onChange={(e) => setF({ ...f, furnizor: e.target.value })}>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nume}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tip
              <select aria-label="Tipul documentului" value={f.tip} onChange={(e) => setF({ ...f, tip: e.target.value })}>
                {Object.entries(KIND).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Număr
              <input aria-label="Numărul documentului primit" value={f.numar} maxLength={60} onChange={(e) => setF({ ...f, numar: e.target.value })} />
            </label>
            <label>
              Data
              <input aria-label="Data documentului primit" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
            </label>
            <label>
              Scadența
              <input aria-label="Scadența documentului primit" type="date" value={f.scadenta} onChange={(e) => setF({ ...f, scadenta: e.target.value })} />
            </label>
          </div>
          <div className="row wrap">
            <label>
              Categorie
              <input aria-label="Categorie cheltuială" placeholder="ex. materiale, chirie" value={f.categorie} maxLength={100} onChange={(e) => setF({ ...f, categorie: e.target.value })} />
            </label>
            <label>
              Fără TVA
              <input aria-label="Total fără TVA" className="short" inputMode="decimal" value={f.total_fara_tva} onChange={(e) => setF({ ...f, total_fara_tva: e.target.value })} />
            </label>
            <label>
              TVA
              <input aria-label="TVA" className="short" inputMode="decimal" value={f.tva} onChange={(e) => setF({ ...f, tva: e.target.value })} />
            </label>
            <label>
              Total
              <input aria-label="Total de plată" className="short" inputMode="decimal" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} />
            </label>
          </div>
          {formError && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}
          <div className="dialog-actions">
            <button type="submit" className="primary" disabled={busy || !f.numar.trim() || !f.total.trim()}>
              Înregistrează
            </button>
          </div>
        </form>
      )}
      <table className="audit purchase-list">
        <thead>
          <tr>
            <th>Document</th>
            <th>Furnizor</th>
            <th>Data</th>
            <th>Scadența</th>
            <th>Categorie</th>
            <th>Total (lei)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                Nicio cheltuială înregistrată.
              </td>
            </tr>
          )}
          {list.map((p) => (
            <tr key={p.id} className={p.stornat ? "done" : ""}>
              <td>
                {KIND[p.tip]} {p.numar}
                {p.sursa === "extragere" && <span className="badge"> din Extragere</span>}
                {p.storno_de && <span className="badge"> storno</span>}
              </td>
              <td>{p.furnizor_nume}</td>
              <td>{ro(p.data)}</td>
              <td>{ro(p.scadenta)}</td>
              <td>{p.categorie ?? ""}</td>
              <td className="num">{p.total_text}</td>
              <td>
                {!p.storno_de && !p.stornat && (
                  <button className="danger-text" aria-label={`Stornează ${p.numar}`} disabled={busy} onClick={() => void run(() => api.moduleCall(ID, "purchase_storno", { id: p.id, data: today() }), false)}>
                    Stornează
                  </button>
                )}
                {p.stornat && <span className="muted small">stornat</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
