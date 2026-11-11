// 7.10b: a purchase invoice of the vault recorded in Business, by the person. The form comes filled in with what the
// vault recognised (the supplier found among Business's partners by its CUI, the series and number, the date, the
// total with VAT); the person checks it, adds the net amount and the VAT if they want, and records it. Business
// itself refuses the same supplier with the same number (purchase_save), so an invoice is never recorded twice;
// a supplier missing from Business is added only when the person asks.
import { useEffect, useState } from "react";
import { api, message } from "../../api";
import { cuiKey } from "../contracts/cui";

const BIZ = "kgb.business";

interface Partner {
  id: string;
  nume: string;
  cui?: string | null;
}
export interface VaultInvoice {
  emitent_cui?: string;
  emitent?: string;
  serie?: string;
  numar?: string;
  data?: string;
  total?: number | null;
}

const money = (b: number) => {
  const [i, f] = (Math.abs(b) / 100).toFixed(2).split(".");
  return `${b < 0 ? "-" : ""}${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${f}`;
};

export function ToBusiness({ doc, inv, onClose, onDone }: { doc: string; inv: VaultInvoice; onClose: () => void; onDone: (msg: string) => void }) {
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [f, setF] = useState({
    furnizor: "",
    numar: [inv.serie, inv.numar].filter(Boolean).join(" "),
    data: inv.data ?? "",
    scadenta: "",
    total_fara_tva: "",
    tva: "",
    total: typeof inv.total === "number" ? money(inv.total) : "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = cuiKey(inv.emitent_cui ?? "");

  useEffect(() => {
    api.moduleCall<Partner[]>(BIZ, "partners").then(
      (l) => {
        setPartners(l);
        const p = key ? l.find((x) => cuiKey(x.cui ?? "") === key) : undefined;
        if (p) setF((x) => ({ ...x, furnizor: p.id }));
      },
      (e: unknown) => setErr(message(e)),
    );
  }, [key]);

  const known = partners?.find((p) => p.id === f.furnizor);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      let furnizor = f.furnizor;
      if (!furnizor) {
        // The supplier from the invoice, added to Business only now, because the person records the invoice.
        const r = await api.moduleCall<{ id: string }>(BIZ, "partner_save", { nume: inv.emitent || `Furnizor ${key}`, cui: key || undefined, tip: "furnizor" });
        furnizor = r.id;
      }
      const opt = (v: string) => (v.trim() ? v.trim() : undefined);
      await api.moduleCall(BIZ, "purchase_save", {
        furnizor,
        tip: "factura",
        numar: f.numar,
        data: f.data,
        scadenta: opt(f.scadenta),
        total_fara_tva: opt(f.total_fara_tva),
        tva: opt(f.tva),
        total: f.total,
        nota: `Din depozitul de documente: ${doc}`.slice(0, 500),
      });
      onDone(`Factura ${f.numar} e înregistrată în Business, la cheltuieli.`);
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="card to-business"
      aria-label="Înregistrează în Business"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h4>Înregistrează în Business, la cheltuieli</h4>
      {partners === null && !err && <p className="muted small">Caut furnizorul în Business…</p>}
      {partners !== null && (
        <div className="row wrap">
          <label className="small">
            Furnizor{" "}
            <select aria-label="Furnizorul în Business" value={f.furnizor} onChange={(e) => setF({ ...f, furnizor: e.target.value })}>
              <option value="">{inv.emitent || key ? "(îl adaug în Business din factură)" : "(alege)"}</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nume}
                </option>
              ))}
            </select>
          </label>
          {!known && (inv.emitent || key) && (
            <span className="muted small">
              <span>Furnizorul nu e în Business; se adaugă cu</span> <span className="no-i18n">{[inv.emitent, key && `CUI ${key}`].filter(Boolean).join(", ")}</span>
            </span>
          )}
        </div>
      )}
      <div className="row wrap">
        <label className="small">
          Număr <input aria-label="Numărul facturii" value={f.numar} onChange={(e) => setF({ ...f, numar: e.target.value })} size={14} />
        </label>
        <label className="small">
          Data <input type="date" aria-label="Data facturii" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        </label>
        <label className="small">
          Scadența <input type="date" aria-label="Scadența" value={f.scadenta} onChange={(e) => setF({ ...f, scadenta: e.target.value })} />
        </label>
      </div>
      <div className="row wrap">
        <label className="small">
          Fără TVA <input aria-label="Total fără TVA" value={f.total_fara_tva} onChange={(e) => setF({ ...f, total_fara_tva: e.target.value })} size={10} placeholder="opțional" />
        </label>
        <label className="small">
          TVA <input aria-label="TVA" value={f.tva} onChange={(e) => setF({ ...f, tva: e.target.value })} size={10} placeholder="opțional" />
        </label>
        <label className="small">
          Total cu TVA <input aria-label="Total cu TVA" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} size={10} />
        </label>
      </div>
      <p className="muted small">Verifică datele cu factura. Business nu primește aceeași factură de două ori (același furnizor și același număr).</p>
      {err && <p className="error">{err}</p>}
      <div className="row wrap">
        <button className="primary" disabled={busy || partners === null || !f.numar.trim() || !f.data || !f.total.trim() || (!f.furnizor && !inv.emitent && !key)}>
          Înregistrează
        </button>
        <button type="button" disabled={busy} onClick={onClose}>
          Renunță
        </button>
      </div>
    </form>
  );
}
