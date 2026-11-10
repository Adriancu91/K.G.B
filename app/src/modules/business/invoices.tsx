// Invoices, partners and settings (Etapa 5, step 5.3). The module computes
// every amount (whole bani, VAT per line) and numbers the invoices; the page
// only collects what is typed and shows the result.
import { useCallback, useEffect, useState } from "react";
import { SuggestInput, fullCardAddress, partyToCard, rememberPartner } from "../../components/PartnerSuggest";
import { AnafLookup, fullAddress } from "../../components/AnafLookup";
import { save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";
import { EfacturaPanel } from "./efactura";
import type { IssuedInvoice } from "./efacturaMap";

const ID = "kgb.business";

interface Partner {
  id: string;
  version: number;
  nume: string;
  cui: string | null;
  adresa: string | null;
  tip: string;
}
interface Series {
  id: string;
  cod: string;
  urmator: number;
}
interface Settings {
  cote_tva: number[];
  firma: { camp: string; eticheta: string; valoare: string }[];
  version: number | null;
  confirmate: boolean;
}
interface Invoice {
  id: string;
  numar_text: string;
  data: string;
  scadenta: string | null;
  client: { nume: string };
  total_text: string;
  storno_de: string | null;
  stornata: boolean;
}
interface ProductLite {
  id: string;
  cod: string;
  nume: string;
  um: string;
  activ: boolean;
}
interface WarehouseLite {
  id: string;
  nume: string;
  activ: boolean;
}
interface LineDraft {
  produs: string;
  descriere: string;
  um: string;
  cantitate: string;
  pret_unitar: string;
  cota_tva: number;
}

const ro = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function InvoicesView(props: { products: ProductLite[]; warehouses: WarehouseLite[]; onError: (e: string | null) => void; onChanged: () => void }) {
  const { onError, onChanged } = props;
  const [sub, setSub] = useState<"facturi" | "noua" | "parteneri" | "setari">("facturi");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The invoice whose e-Factura is being prepared (7.4m-3).
  const [efactura, setEfactura] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, s, st, inv] = await Promise.all([
        api.moduleCall<Partner[]>(ID, "partners"),
        api.moduleCall<Series[]>(ID, "series"),
        api.moduleCall<Settings>(ID, "settings"),
        api.moduleCall<Invoice[]>(ID, "invoices"),
      ]);
      setPartners(p);
      setSeries(s);
      setSettings(st);
      setInvoices(inv);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (f: () => Promise<unknown>, inForm = true) => {
    setBusy(true);
    try {
      await f();
      onError(null);
      setFormError(null);
    } catch (e) {
      if (inForm) setFormError(message(e));
      else onError(message(e));
    } finally {
      setBusy(false);
    }
    await refresh();
    onChanged();
  };

  // New invoice.
  const [serie, setSerie] = useState("");
  const [partener, setPartener] = useState("");
  const [data, setData] = useState(today());
  const [scadenta, setScadenta] = useState("");
  const [depozit, setDepozit] = useState("");
  const firstRate = settings?.cote_tva[0] ?? 21;
  const blank = (): LineDraft => ({ produs: "", descriere: "", um: "buc", cantitate: "", pret_unitar: "", cota_tva: firstRate });
  const [lines, setLines] = useState<LineDraft[]>([blank()]);
  const setLine = (i: number, patch: Partial<LineDraft>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  // Partner and settings forms.
  const [pf, setPf] = useState({ nume: "", cui: "", adresa: "", tip: "client" });
  const [firma, setFirma] = useState<Record<string, string>>({});
  const [rates, setRates] = useState("");
  const [newSeries, setNewSeries] = useState({ cod: "", primul_numar: "1" });
  useEffect(() => {
    if (settings) {
      setFirma(Object.fromEntries(settings.firma.map((f) => [f.camp, f.valoare])));
      setRates(settings.cote_tva.join(", "));
    }
  }, [settings]);

  const tabs: [typeof sub, string][] = [
    ["facturi", `Facturi (${invoices.length})`],
    ["noua", "Factură nouă"],
    ["parteneri", `Parteneri (${partners.length})`],
    ["setari", "Setări facturare"],
  ];

  return (
    <div className="invoices">
      <div className="sheet-tabs" role="tablist" aria-label="Facturare">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={sub === t}
            className={sub === t ? "active" : ""}
            onClick={() => {
              setSub(t);
              setFormError(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}

      {sub === "facturi" && (
        <table className="audit invoice-list">
          <thead>
            <tr>
              <th>Factura</th>
              <th>Data</th>
              <th>Scadența</th>
              <th>Client</th>
              <th>Total (lei)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Nicio factură încă.
                </td>
              </tr>
            )}
            {invoices.map((f) => (
              <tr key={f.id} className={f.stornata ? "done" : ""}>
                <td>
                  {f.numar_text}
                  {f.storno_de && <span className="badge"> stornare</span>}
                </td>
                <td>{ro(f.data)}</td>
                <td>{ro(f.scadenta)}</td>
                <td>{f.client.nume}</td>
                <td className="num">{f.total_text}</td>
                <td className="row">
                  <button
                    className="link"
                    onClick={() =>
                      void run(async () => {
                        const dest = await save({ defaultPath: `Factura ${f.numar_text}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
                        if (!dest) return;
                        await api.moduleCall(ID, "invoice_pdf", { id: f.id, dest });
                        setNotice(`Salvat: ${dest}`);
                      }, false)
                    }
                  >
                    PDF…
                  </button>
                  <button className="link" aria-label={`e-Factura pentru factura ${f.numar_text}`} onClick={() => setEfactura(efactura === f.id ? null : f.id)}>
                    e-Factura…
                  </button>
                  {!f.storno_de && !f.stornata && (
                    <button
                      className="danger-text"
                      aria-label={`Stornează factura ${f.numar_text}`}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const r = await api.moduleCall<{ numar: string }>(ID, "invoice_storno", { id: f.id, data: today() });
                          setNotice(`Factura ${f.numar_text} a fost stornată prin factura ${r.numar}; amândouă rămân în listă.`);
                        }, false)
                      }
                    >
                      Stornează
                    </button>
                  )}
                  {f.stornata && <span className="muted small">stornată</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sub === "facturi" && efactura && invoices.some((f) => f.id === efactura) && (
        <EfacturaPanel
          key={efactura}
          invoice={invoices.find((f) => f.id === efactura) as unknown as IssuedInvoice}
          onClose={() => setEfactura(null)}
          onDone={(t) => {
            setEfactura(null);
            setNotice(t);
          }}
        />
      )}

      {sub === "noua" &&
        (series.length === 0 || partners.length === 0 || !settings?.confirmate ? (
          <p className="muted">Pentru o factură ai nevoie de datele firmei și de o serie (fila „Setări facturare”) și de cel puțin un partener.</p>
        ) : (
          <form
            className="task-form stock-doc invoice-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api.moduleCall<{ numar: string; total_text: string }>(ID, "invoice_issue", {
                  serie: serie || series[0]?.id,
                  partener: partener || partners[0]?.id,
                  data,
                  ...(scadenta ? { scadenta } : {}),
                  ...(depozit ? { depozit } : {}),
                  linii: lines.map((l) => ({
                    ...(l.produs ? { produs: l.produs } : {}),
                    ...(l.descriere ? { descriere: l.descriere } : {}),
                    ...(l.um ? { um: l.um } : {}),
                    cantitate: l.cantitate,
                    pret_unitar: l.pret_unitar,
                    cota_tva: l.cota_tva,
                  })),
                });
                setNotice(`Factura ${r.numar} a fost emisă: ${r.total_text} lei.`);
                setLines([blank()]);
                setSub("facturi");
              });
            }}
          >
            <div className="row wrap">
              <label>
                Seria
                <select aria-label="Seria" value={serie || series[0]?.id} onChange={(e) => setSerie(e.target.value)}>
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.cod} (următorul nr. {s.urmator})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Client
                <select aria-label="Client" value={partener || partners[0]?.id} onChange={(e) => setPartener(e.target.value)}>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nume}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data
                <input aria-label="Data facturii" type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </label>
              <label>
                Scadența
                <input aria-label="Scadența" type="date" value={scadenta} onChange={(e) => setScadenta(e.target.value)} />
              </label>
              <label>
                Scade din stoc
                <select aria-label="Scade din stoc" value={depozit} onChange={(e) => setDepozit(e.target.value)}>
                  <option value="">— nu (servicii) —</option>
                  {props.warehouses
                    .filter((w) => w.activ)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nume}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Linii (prețuri fără TVA)</legend>
              {lines.map((l, i) => (
                <div key={i} className="row wrap doc-line">
                  <select aria-label={`Produsul ${i + 1}`} value={l.produs} onChange={(e) => {
                    const p = props.products.find((x) => x.id === e.target.value);
                    setLine(i, { produs: e.target.value, um: p?.um ?? l.um, descriere: p ? "" : l.descriere });
                  }}>
                    <option value="">— serviciu / altceva —</option>
                    {props.products
                      .filter((p) => p.activ)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.cod} · {p.nume}
                        </option>
                      ))}
                  </select>
                  {!l.produs && <input aria-label={`Descrierea ${i + 1}`} placeholder="descriere" value={l.descriere} maxLength={300} onChange={(e) => setLine(i, { descriere: e.target.value })} />}
                  <input aria-label={`UM ${i + 1}`} className="tiny" value={l.um} maxLength={10} onChange={(e) => setLine(i, { um: e.target.value })} />
                  <input aria-label={`Cantitatea ${i + 1}`} className="short" inputMode="decimal" placeholder="cantitate" value={l.cantitate} onChange={(e) => setLine(i, { cantitate: e.target.value })} />
                  <input aria-label={`Prețul ${i + 1}`} className="short" inputMode="decimal" placeholder="preț fără TVA" value={l.pret_unitar} onChange={(e) => setLine(i, { pret_unitar: e.target.value })} />
                  <select aria-label={`Cota TVA ${i + 1}`} value={l.cota_tva} onChange={(e) => setLine(i, { cota_tva: Number(e.target.value) })}>
                    {settings.cote_tva.map((c) => (
                      <option key={c} value={c}>
                        TVA {c}%
                      </option>
                    ))}
                  </select>
                  <button type="button" className="link" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    Scoate
                  </button>
                </div>
              ))}
              <button type="button" className="link" onClick={() => setLines([...lines, blank()])}>
                + Adaugă o linie
              </button>
            </fieldset>
            <p className="muted small">Totalurile și TVA-ul le calculează aplicația la emitere, pe fiecare linie, rotunjite la ban. Numărul se alocă la emitere, fără goluri.</p>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <div className="dialog-actions">
              <button type="submit" className="primary" disabled={busy}>
                Emite factura
              </button>
            </div>
          </form>
        ))}

      {sub === "parteneri" && (
        <>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api.moduleCall(ID, "partner_save", pf);
                // Also kept in the partner directory for next time (7.4c).
                const card = partyToCard("client", { client: pf.nume, "client.cui": pf.cui, "client.adresa": pf.adresa });
                const kept = await rememberPartner({ ...card, tip: pf.tip }, "business");
                setNotice(kept ?? `Partenerul „${pf.nume.trim()}” a fost adăugat.`);
                setPf({ nume: "", cui: "", adresa: "", tip: pf.tip });
              });
            }}
          >
            <SuggestInput
              ariaLabel="Nume partener"
              placeholder="Nume"
              value={pf.nume}
              maxLength={200}
              onChange={(v) => setPf((x) => ({ ...x, nume: v }))}
              onPick={(c) => setPf((x) => ({ ...x, nume: c.denumire, cui: c.cui, adresa: fullCardAddress(c) }))}
            />
            <input aria-label="CUI partener" placeholder="CUI (opțional)" value={pf.cui} maxLength={20} onChange={(e) => setPf({ ...pf, cui: e.target.value })} />
            <AnafLookup cui={pf.cui} onFound={(c) => setPf((x) => ({ ...x, nume: c.denumire || x.nume, adresa: fullAddress(c) || x.adresa }))} />
            <input aria-label="Adresă partener" placeholder="Adresă" value={pf.adresa} maxLength={300} onChange={(e) => setPf({ ...pf, adresa: e.target.value })} />
            <select aria-label="Tip partener" value={pf.tip} onChange={(e) => setPf({ ...pf, tip: e.target.value })}>
              <option value="client">client</option>
              <option value="furnizor">furnizor</option>
              <option value="ambele">client și furnizor</option>
            </select>
            <button className="primary" disabled={busy || !pf.nume.trim()}>
              Adaugă partenerul
            </button>
          </form>
          {formError && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}
          <table className="audit">
            <thead>
              <tr>
                <th>Nume</th>
                <th>CUI</th>
                <th>Adresă</th>
                <th>Tip</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id}>
                  <td>{p.nume}</td>
                  <td>{p.cui ?? ""}</td>
                  <td>{p.adresa ?? ""}</td>
                  <td>{p.tip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {sub === "setari" && settings && (
        <>
          <form
            className="task-form company-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const cote = rates.split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x));
                await api.moduleCall(ID, "settings_save", { firma, cote_tva: cote, ...(settings.version ? { version: settings.version } : {}) });
                setNotice("Setările de facturare au fost salvate.");
              });
            }}
          >
            <p className="warn">Cotele de TVA implicite (21%, 11%, 0%) trebuie confirmate de tine sau de contabil. Aplicația nu ține evidența schimbărilor legislative.</p>
            <label>
              Cote de TVA (%), separate prin virgulă
              <input aria-label="Cote TVA" value={rates} onChange={(e) => setRates(e.target.value)} />
            </label>
            <AnafLookup
              cui={firma.firma_cui ?? ""}
              onFound={(c) =>
                setFirma((x) => ({ ...x, firma_nume: c.denumire || (x.firma_nume ?? ""), firma_reg_com: c.nr_reg_com || (x.firma_reg_com ?? ""), firma_adresa: fullAddress(c) || (x.firma_adresa ?? "") }))
              }
            />
            <div className="company-grid">
              {settings.firma.map((f) => (
                <label key={f.camp}>
                  {f.eticheta}
                  <input aria-label={`Firma: ${f.eticheta}`} value={firma[f.camp] ?? ""} maxLength={300} onChange={(e) => setFirma({ ...firma, [f.camp]: e.target.value })} />
                </label>
              ))}
            </div>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <div className="dialog-actions">
              <button type="submit" className="primary" disabled={busy}>
                Salvează setările
              </button>
            </div>
          </form>
          <h3>Serii de facturi</h3>
          <ul className="list">
            {series.map((s) => (
              <li key={s.id}>
                {s.cod} — următorul număr: {s.urmator}
              </li>
            ))}
          </ul>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api.moduleCall(ID, "series_save", { cod: newSeries.cod, primul_numar: Number(newSeries.primul_numar) || 1 });
                setNewSeries({ cod: "", primul_numar: "1" });
              });
            }}
          >
            <input aria-label="Cod serie" placeholder="Serie (ex. KGB)" value={newSeries.cod} maxLength={10} onChange={(e) => setNewSeries({ ...newSeries, cod: e.target.value })} />
            <input aria-label="Primul număr" className="short" value={newSeries.primul_numar} onChange={(e) => setNewSeries({ ...newSeries, primul_numar: e.target.value })} />
            <button disabled={busy || !newSeries.cod.trim()}>Adaugă seria</button>
          </form>
        </>
      )}
    </div>
  );
}
