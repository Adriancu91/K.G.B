// Business (Etapa 5, step 5.1): products, warehouses, receipts, issues,
// stock. Primary records, not certified accounting (D-052); recorded
// documents never change, a storno reverses them visibly (D-051).
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";
import { InvoicesView } from "./invoices";

const ID = "kgb.business";

interface Product {
  id: string;
  version: number;
  cod: string;
  nume: string;
  um: string;
  categorie: string | null;
  cod_bare: string | null;
  stoc_minim_text: string | null;
  activ: boolean;
}
interface Warehouse {
  id: string;
  version: number;
  nume: string;
  activ: boolean;
}
interface StockRow {
  produs: string;
  cod: string;
  nume: string;
  um: string;
  depozit: string;
  depozit_nume: string;
  cantitate_text: string;
  sub_minim: boolean;
  valoare: number;
  valoare_text: string;
  cost_mediu_text: string | null;
}
interface Doc {
  id: string;
  tip: "receptie" | "iesire" | "storno" | "transfer" | "inventar";
  depozit_destinatie: string | null;
  numar: string;
  data: string;
  depozit: string;
  partener: string | null;
  nota: string | null;
  stornat: boolean;
}
interface LineDraft {
  produs: string;
  cantitate: string;
  pret_unitar: string;
}

const TIP: Record<Doc["tip"], string> = { receptie: "Recepție", iesire: "Ieșire", storno: "Storno", transfer: "Transfer", inventar: "Inventar" };
const lei = (bani: number) => {
  const neg = bani < 0;
  const a = Math.abs(bani);
  const int = Math.floor(a / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${int},${String(a % 100).padStart(2, "0")}`;
};
const ro = (iso: string) => iso.split("-").reverse().join(".");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function StockDocForm(props: {
  kind: "receptie" | "iesire";
  products: Product[];
  warehouses: Warehouse[];
  busy: boolean;
  error: string | null;
  onSave: (doc: Record<string, unknown>) => void;
}) {
  const receipt = props.kind === "receptie";
  const active = props.products.filter((p) => p.activ);
  const [depozit, setDepozit] = useState(props.warehouses.find((w) => w.activ)?.id ?? "");
  const [numar, setNumar] = useState("");
  const [data, setData] = useState(today());
  const [partener, setPartener] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ produs: active[0]?.id ?? "", cantitate: "", pret_unitar: "" }]);
  const set = (i: number, patch: Partial<LineDraft>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  if (props.warehouses.length === 0 || active.length === 0)
    return <p className="muted">Adaugă mai întâi cel puțin un depozit și un produs (filele „Depozite” și „Produse”).</p>;
  return (
    <form
      className="task-form stock-doc"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave({
          depozit,
          numar,
          data,
          ...(receipt && partener.trim() ? { partener } : {}),
          linii: lines.map((l) => ({ produs: l.produs, cantitate: l.cantitate, ...(receipt ? { pret_unitar: l.pret_unitar } : {}) })),
        });
      }}
    >
      <div className="row wrap">
        <label>
          Depozit
          <select aria-label="Depozit" value={depozit} onChange={(e) => setDepozit(e.target.value)}>
            {props.warehouses
              .filter((w) => w.activ)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nume}
                </option>
              ))}
          </select>
        </label>
        <label>
          {receipt ? "Nr. NIR / factură" : "Nr. bon de consum / aviz"}
          <input aria-label="Numărul documentului" value={numar} maxLength={40} onChange={(e) => setNumar(e.target.value)} />
        </label>
        <label>
          Data
          <input aria-label="Data documentului" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        {receipt && (
          <label>
            Furnizor
            <input aria-label="Furnizor" value={partener} maxLength={200} onChange={(e) => setPartener(e.target.value)} />
          </label>
        )}
      </div>
      <fieldset>
        <legend>Produse</legend>
        {lines.map((l, i) => {
          const p = props.products.find((x) => x.id === l.produs);
          return (
            <div key={i} className="row wrap doc-line">
              <select aria-label={`Produsul ${i + 1}`} value={l.produs} onChange={(e) => set(i, { produs: e.target.value })}>
                {active.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.cod} · {x.nume}
                  </option>
                ))}
              </select>
              <input aria-label={`Cantitatea ${i + 1}`} className="short" inputMode="decimal" placeholder="cantitate" value={l.cantitate} onChange={(e) => set(i, { cantitate: e.target.value })} />
              <span className="muted">{p?.um}</span>
              {receipt && (
                <input aria-label={`Prețul ${i + 1}`} className="short" inputMode="decimal" placeholder="preț / unitate" value={l.pret_unitar} onChange={(e) => set(i, { pret_unitar: e.target.value })} />
              )}
              {receipt && <span className="muted">lei</span>}
              <button type="button" className="link" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                Scoate
              </button>
            </div>
          );
        })}
        <button type="button" className="link" onClick={() => setLines([...lines, { produs: active[0]?.id ?? "", cantitate: "", pret_unitar: "" }])}>
          + Adaugă un produs
        </button>
      </fieldset>
      {props.error && (
        <p className="error" role="alert">
          {props.error}
        </p>
      )}
      <p className="muted small">După înregistrare documentul nu se mai modifică; o greșeală se corectează cu „Stornează”, care rămâne vizibil.</p>
      <div className="dialog-actions">
        <button type="submit" className="primary" disabled={props.busy || !numar.trim()}>
          {receipt ? "Înregistrează recepția" : "Înregistrează ieșirea"}
        </button>
      </div>
    </form>
  );
}

function TransferForm(props: { products: Product[]; warehouses: Warehouse[]; busy: boolean; error: string | null; onSave: (doc: Record<string, unknown>) => void }) {
  const wh = props.warehouses.filter((w) => w.activ);
  const active = props.products.filter((p) => p.activ);
  const [from, setFrom] = useState(wh[0]?.id ?? "");
  const [to, setTo] = useState(wh[1]?.id ?? "");
  const [numar, setNumar] = useState("");
  const [data, setData] = useState(today());
  const [lines, setLines] = useState<{ produs: string; cantitate: string }[]>([{ produs: active[0]?.id ?? "", cantitate: "" }]);
  if (wh.length < 2 || active.length === 0) return <p className="muted">Un transfer are nevoie de cel puțin două depozite și un produs.</p>;
  return (
    <form
      className="task-form stock-doc"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave({ depozit: from, depozit_destinatie: to, numar, data, linii: lines });
      }}
    >
      <div className="row wrap">
        <label>
          Din depozitul
          <select aria-label="Din depozitul" value={from} onChange={(e) => setFrom(e.target.value)}>
            {wh.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nume}
              </option>
            ))}
          </select>
        </label>
        <label>
          În depozitul
          <select aria-label="În depozitul" value={to} onChange={(e) => setTo(e.target.value)}>
            {wh.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nume}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nr. aviz / bon de transfer
          <input aria-label="Numărul documentului" value={numar} maxLength={40} onChange={(e) => setNumar(e.target.value)} />
        </label>
        <label>
          Data
          <input aria-label="Data documentului" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
      </div>
      <fieldset>
        <legend>Produse</legend>
        {lines.map((l, i) => (
          <div key={i} className="row wrap doc-line">
            <select aria-label={`Produsul ${i + 1}`} value={l.produs} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, produs: e.target.value } : x)))}>
              {active.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.cod} · {x.nume}
                </option>
              ))}
            </select>
            <input aria-label={`Cantitatea ${i + 1}`} className="short" inputMode="decimal" placeholder="cantitate" value={l.cantitate} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, cantitate: e.target.value } : x)))} />
            <button type="button" className="link" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
              Scoate
            </button>
          </div>
        ))}
        <button type="button" className="link" onClick={() => setLines([...lines, { produs: active[0]?.id ?? "", cantitate: "" }])}>
          + Adaugă un produs
        </button>
      </fieldset>
      {props.error && (
        <p className="error" role="alert">
          {props.error}
        </p>
      )}
      <div className="dialog-actions">
        <button type="submit" className="primary" disabled={props.busy || !numar.trim()}>
          Înregistrează transferul
        </button>
      </div>
    </form>
  );
}

function InventoryForm(props: { stock: StockRow[]; warehouses: Warehouse[]; busy: boolean; error: string | null; onSave: (doc: Record<string, unknown>) => void }) {
  const wh = props.warehouses.filter((w) => w.activ);
  const [depozit, setDepozit] = useState(wh[0]?.id ?? "");
  const [numar, setNumar] = useState("");
  const [data, setData] = useState(today());
  const [counted, setCounted] = useState<Record<string, string>>({});
  const rows = props.stock.filter((r) => r.depozit === depozit);
  return (
    <form
      className="task-form stock-doc"
      onSubmit={(e) => {
        e.preventDefault();
        const linii = rows.filter((r) => (counted[r.produs] ?? "").trim() !== "").map((r) => ({ produs: r.produs, cantitate_numarata: counted[r.produs] }));
        props.onSave({ depozit, numar, data, linii });
      }}
    >
      <div className="row wrap">
        <label>
          Depozit
          <select aria-label="Depozit" value={depozit} onChange={(e) => setDepozit(e.target.value)}>
            {wh.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nume}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nr. listă de inventar
          <input aria-label="Numărul documentului" value={numar} maxLength={40} onChange={(e) => setNumar(e.target.value)} />
        </label>
        <label>
          Data
          <input aria-label="Data documentului" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
      </div>
      <table className="audit inventory-table">
        <thead>
          <tr>
            <th>Produs</th>
            <th>Scriptic</th>
            <th>Faptic (numărat)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                Niciun produs în acest depozit.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.produs}>
              <td>
                {r.cod} · {r.nume}
              </td>
              <td className="num">
                {r.cantitate_text} {r.um}
              </td>
              <td>
                <input aria-label={`Numărat: ${r.nume}`} className="short" inputMode="decimal" value={counted[r.produs] ?? ""} onChange={(e) => setCounted({ ...counted, [r.produs]: e.target.value })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Produsele lăsate necompletate nu se schimbă. Diferențele devin mișcări de corecție, vizibile în documente.</p>
      {props.error && (
        <p className="error" role="alert">
          {props.error}
        </p>
      )}
      <div className="dialog-actions">
        <button type="submit" className="primary" disabled={props.busy || !numar.trim()}>
          Înregistrează inventarul
        </button>
      </div>
    </form>
  );
}

export function BusinessPage({ onError }: { onError: (e: string | null) => void }) {
  const [tab, setTab] = useState<"stoc" | "documente" | "receptie" | "iesire" | "transfer" | "inventar" | "produse" | "depozite" | "facturare">("stoc");
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [prod, setProd] = useState({ cod: "", nume: "", um: "buc", categorie: "", cod_bare: "", stoc_minim: "" });
  const [whName, setWhName] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [p, w, s, d] = await Promise.all([
        api.moduleCall<Product[]>(ID, "products"),
        api.moduleCall<Warehouse[]>(ID, "warehouses"),
        api.moduleCall<StockRow[]>(ID, "stock"),
        api.moduleCall<Doc[]>(ID, "documents"),
      ]);
      setProducts(p);
      setWarehouses(w);
      setStock(s);
      setDocs(d);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (f: () => Promise<unknown>, inForm = false) => {
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
  };
  const whName_ = (id: string) => warehouses.find((w) => w.id === id)?.nume ?? "—";
  const low = stock.filter((s) => s.sub_minim).length;

  return (
    <section className="business">
      <p className="warn">Evidență primară, nu contabilitate certificată. Ce înregistrezi nu se mai modifică; greșelile se corectează prin storno, vizibil.</p>
      <div className="sheet-tabs" role="tablist">
        {(
          [
            ["stoc", `Stoc${low ? ` (${low} sub minim)` : ""}`],
            ["documente", `Documente (${docs.length})`],
            ["receptie", "Recepție nouă"],
            ["iesire", "Ieșire nouă"],
            ["transfer", "Transfer"],
            ["inventar", "Inventar"],
            ["produse", `Produse (${products.length})`],
            ["depozite", `Depozite (${warehouses.length})`],
            ["facturare", "Facturare"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => {
              setTab(t);
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

      {tab === "stoc" && (
        <table className="audit stock-table">
          <thead>
            <tr>
              <th>Cod</th>
              <th>Produs</th>
              <th>Depozit</th>
              <th>Cantitate</th>
              <th>UM</th>
              <th>Cost mediu</th>
              <th>Valoare (lei)</th>
            </tr>
          </thead>
          <tbody>
            {stock.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Niciun produs în stoc. Înregistrează o recepție.
                </td>
              </tr>
            )}
            {stock.map((s) => (
              <tr key={`${s.produs}-${s.depozit}`} className={s.sub_minim ? "low" : ""}>
                <td>{s.cod}</td>
                <td>
                  {s.nume}
                  {s.sub_minim && <span className="badge lvl-atentie"> sub minim</span>}
                </td>
                <td>{s.depozit_nume}</td>
                <td className="num">{s.cantitate_text}</td>
                <td>{s.um}</td>
                <td className="num">{s.cost_mediu_text ?? ""}</td>
                <td className="num">{s.valoare_text}</td>
              </tr>
            ))}
          </tbody>
          {stock.length > 0 && (
            <tfoot>
              <tr>
                <th colSpan={6}>Valoarea stocului, la cost mediu ponderat</th>
                <th className="num">{lei(stock.reduce((a, r) => a + r.valoare, 0))}</th>
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {tab === "documente" && (
        <table className="audit stock-docs">
          <thead>
            <tr>
              <th>Tip</th>
              <th>Număr</th>
              <th>Data</th>
              <th>Depozit</th>
              <th>Partener</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className={d.stornat ? "done" : ""}>
                <td>{TIP[d.tip]}</td>
                <td>{d.numar}</td>
                <td>{ro(d.data)}</td>
                <td>
                  {whName_(d.depozit)}
                  {d.depozit_destinatie ? ` → ${whName_(d.depozit_destinatie)}` : ""}
                </td>
                <td>{d.partener ?? ""}</td>
                <td>
                  {d.tip !== "storno" && !d.stornat && (
                    <button
                      className="danger-text"
                      aria-label={`Stornează ${d.numar}`}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api.moduleCall(ID, "storno", { document: d.id, data: today() });
                          setNotice(`Documentul ${d.numar} a fost stornat; originalul rămâne în listă.`);
                        })
                      }
                    >
                      Stornează
                    </button>
                  )}
                  {d.stornat && <span className="muted small">stornat</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(tab === "receptie" || tab === "iesire") && (
        <StockDocForm
          key={`${tab}-${formKey}`}
          kind={tab}
          products={products}
          warehouses={warehouses}
          busy={busy}
          error={formError}
          onSave={(doc) =>
            void run(async () => {
              const r = await api.moduleCall<{ linii: number }>(ID, tab === "receptie" ? "receive" : "issue", doc);
              setNotice(`${tab === "receptie" ? "Recepția" : "Ieșirea"} a fost înregistrată (${r.linii} linii).`);
              setFormKey((k) => k + 1);
              setTab("stoc");
            }, true)
          }
        />
      )}

      {tab === "transfer" && (
        <TransferForm
          key={`t-${formKey}`}
          products={products}
          warehouses={warehouses}
          busy={busy}
          error={formError}
          onSave={(doc) =>
            void run(async () => {
              const r = await api.moduleCall<{ linii: number }>(ID, "transfer", doc);
              setNotice(`Transferul a fost înregistrat (${r.linii} linii).`);
              setFormKey((k) => k + 1);
              setTab("stoc");
            }, true)
          }
        />
      )}

      {tab === "inventar" && (
        <InventoryForm
          key={`i-${formKey}`}
          stock={stock}
          warehouses={warehouses}
          busy={busy}
          error={formError}
          onSave={(doc) =>
            void run(async () => {
              const r = await api.moduleCall<{ linii: { nume: string; diferenta: string }[] }>(ID, "inventory", doc);
              const diffs = r.linii.filter((l) => l.diferenta !== "0");
              setNotice(diffs.length ? `Inventar înregistrat. Diferențe: ${diffs.map((d) => `${d.nume} ${d.diferenta}`).join(", ")}.` : "Inventar înregistrat, fără diferențe.");
              setFormKey((k) => k + 1);
              setTab("stoc");
            }, true)
          }
        />
      )}

      {tab === "facturare" && <InvoicesView products={products} warehouses={warehouses} onError={onError} onChanged={() => void refresh()} />}

      {tab === "produse" && (
        <>
          <form
            className="row wrap product-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api.moduleCall(ID, "product_save", prod);
                setProd({ cod: "", nume: "", um: prod.um, categorie: "", cod_bare: "", stoc_minim: "" });
              }, true);
            }}
          >
            <input aria-label="Cod produs" placeholder="Cod" value={prod.cod} maxLength={40} onChange={(e) => setProd({ ...prod, cod: e.target.value })} />
            <input aria-label="Nume produs" placeholder="Nume" value={prod.nume} maxLength={200} onChange={(e) => setProd({ ...prod, nume: e.target.value })} />
            <input aria-label="Unitate de măsură" className="short" placeholder="UM" value={prod.um} maxLength={10} onChange={(e) => setProd({ ...prod, um: e.target.value })} />
            <input aria-label="Categorie" placeholder="Categorie" value={prod.categorie} maxLength={100} onChange={(e) => setProd({ ...prod, categorie: e.target.value })} />
            <input aria-label="Cod de bare" placeholder="Cod de bare" value={prod.cod_bare} maxLength={40} onChange={(e) => setProd({ ...prod, cod_bare: e.target.value })} />
            <input aria-label="Stoc minim" className="short" placeholder="stoc minim" value={prod.stoc_minim} onChange={(e) => setProd({ ...prod, stoc_minim: e.target.value })} />
            <button className="primary" disabled={busy || !prod.cod.trim() || !prod.nume.trim()}>
              Adaugă produsul
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
                <th>Cod</th>
                <th>Nume</th>
                <th>UM</th>
                <th>Categorie</th>
                <th>Cod de bare</th>
                <th>Stoc minim</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.cod}</td>
                  <td>{p.nume}</td>
                  <td>{p.um}</td>
                  <td>{p.categorie ?? ""}</td>
                  <td>{p.cod_bare ?? ""}</td>
                  <td className="num">{p.stoc_minim_text ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "depozite" && (
        <>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api.moduleCall(ID, "warehouse_save", { nume: whName });
                setWhName("");
              }, true);
            }}
          >
            <input aria-label="Nume depozit" placeholder="Numele depozitului" value={whName} maxLength={100} onChange={(e) => setWhName(e.target.value)} />
            <button className="primary" disabled={busy || !whName.trim()}>
              Adaugă depozitul
            </button>
          </form>
          {formError && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}
          <ul className="list">
            {warehouses.map((w) => (
              <li key={w.id}>{w.nume}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
