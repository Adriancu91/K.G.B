// 7.10b: the stock from a purchase invoice. For an e-Factura (XML) of „Facturi de achiziție”, the vault reads its
// lines (what was bought, the supplier's code, the quantity and its unit, the price per unit without VAT); here each
// line is matched to a product of Business (by the supplier's code, then by name) or marked to be added as a new
// product, the person picks the warehouse and records the reception (NIR) in Business. A reception with the same
// number already in Business is named. Nothing is written before „Înregistrează recepția”.
import { useEffect, useState } from "react";
import { api, message } from "../../api";

const VAULT = "kgb.vault";
const BIZ = "kgb.business";
const NEW = "__nou";

interface Line {
  nume: string;
  cod: string;
  cantitate: string;
  um: string;
  pret: string;
  tva: string;
}
interface Read {
  document: string;
  factura: { emitent: string; serie: string; numar: string; data: string };
  linii: Line[];
}
interface Product {
  id: string;
  cod: string;
  nume: string;
  um: string;
}
interface Named {
  id: string;
  nume: string;
}
interface StockDocView {
  numar?: string;
  tip?: string;
  storno_de?: string | null;
}
type Row = Line & { produs: string; cantitateText: string; pretText: string; codNou: string; umNou: string };

// UN/ECE unit codes of e-Factura → the units written in Business.
const UNITS: Record<string, string> = { H87: "buc", C62: "buc", XPP: "buc", KGM: "kg", GRM: "g", TNE: "t", LTR: "l", MTR: "m", MTK: "mp", MTQ: "mc", SET: "set", XPK: "pachet", XBX: "cutie", HUR: "ora", DAY: "zi" };
const comma = (n: string) => n.trim().replace(".", ",");
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const code = (l: Line, taken: Set<string>) => {
  let c = (l.cod || fold(l.nume).replace(/[^a-z0-9]+/g, "").slice(0, 12).toUpperCase() || "PROD").slice(0, 36);
  let n = 2;
  const base = c;
  while (taken.has(c.toUpperCase())) c = `${base}-${n++}`;
  taken.add(c.toUpperCase());
  return c;
};

export function ToStock({ docId, onClose, onDone }: { docId: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [read, setRead] = useState<Read | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [houses, setHouses] = useState<Named[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [head, setHead] = useState({ depozit: "", numar: "", data: "", partener: "" });
  const [twin, setTwin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [r, prods, wh, sdocs] = await Promise.all([
          api.moduleCall<Read>(VAULT, "factura_linii", { id: docId }),
          api.moduleCall<Product[]>(BIZ, "products"),
          api.moduleCall<Named[]>(BIZ, "warehouses"),
          api.moduleCall<StockDocView[]>(BIZ, "documents"),
        ]);
        setRead(r);
        setProducts(prods);
        setHouses(wh);
        const numar = `NIR ${[r.factura.serie, r.factura.numar].filter(Boolean).join(" ")}`;
        setHead({ depozit: wh[0]?.id ?? "", numar, data: r.factura.data, partener: r.factura.emitent });
        setTwin(sdocs.some((d) => !d.storno_de && fold(d.numar ?? "") === fold(numar)));
        const taken = new Set(prods.map((p) => p.cod.toUpperCase()));
        setRows(
          r.linii.map((l) => {
            const match = (l.cod && prods.find((p) => p.cod.toUpperCase() === l.cod.toUpperCase())) || prods.find((p) => fold(p.nume) === fold(l.nume));
            return { ...l, produs: match?.id ?? NEW, cantitateText: comma(l.cantitate), pretText: comma(l.pret), codNou: match ? "" : code(l, taken), umNou: UNITS[l.um] ?? (l.um.toLowerCase() || "buc") };
          }),
        );
      } catch (e) {
        setErr(message(e));
      }
    })();
  }, [docId]);

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const linii = [];
      let added = 0;
      for (const r of rows) {
        let produs = r.produs;
        if (produs === NEW) {
          // A product added only now, because the person records the reception.
          produs = (await api.moduleCall<{ id: string }>(BIZ, "product_save", { cod: r.codNou, nume: r.nume, um: r.umNou })).id;
          added++;
        }
        linii.push({ produs, cantitate: r.cantitateText, pret_unitar: r.pretText || undefined });
      }
      await api.moduleCall(BIZ, "receive", { depozit: head.depozit, numar: head.numar, data: head.data, partener: head.partener || undefined, nota: `Din depozitul de documente: ${read?.document ?? ""}`.slice(0, 300), linii });
      const parts = [`Recepția ${head.numar} e înregistrată în Business.`];
      if (added) parts.push(added === 1 ? "Un produs nou adăugat." : `${added} produse noi adăugate.`);
      onDone(parts.join(" · "));
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };

  if (err && !read) return <p className="error">{err}</p>;
  if (!read) return <p className="muted small">Citesc liniile facturii…</p>;
  return (
    <form
      className="card to-business to-stock"
      aria-label="Recepție în stoc"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h4>Recepție în stoc (NIR)</h4>
      {twin && <p className="vault-dup">există deja în Business o recepție cu acest număr</p>}
      {houses.length === 0 ? (
        <p className="muted small">În Business nu e niciun depozit. Adaugă-l la Business › Stoc, apoi revino.</p>
      ) : (
        <div className="row wrap">
          <label className="small">
            Depozitul{" "}
            <select aria-label="Depozitul" value={head.depozit} onChange={(e) => setHead({ ...head, depozit: e.target.value })}>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nume}
                </option>
              ))}
            </select>
          </label>
          <label className="small">
            Numărul <input aria-label="Numărul recepției" value={head.numar} onChange={(e) => setHead({ ...head, numar: e.target.value })} size={16} />
          </label>
          <label className="small">
            Data <input type="date" aria-label="Data recepției" value={head.data} onChange={(e) => setHead({ ...head, data: e.target.value })} />
          </label>
        </div>
      )}
      {read.linii.length === 0 ? (
        <p className="muted small">Factura nu are linii de produse.</p>
      ) : (
        <table className="audit">
          <thead>
            <tr>
              <th>Din factură</th>
              <th>Produsul din Business</th>
              <th>Cantitate</th>
              <th>Preț fără TVA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="small">
                  <span className="no-i18n">{r.nume}</span>
                  {r.cod && <div className="muted no-i18n">{r.cod}</div>}
                </td>
                <td>
                  <select aria-label={`Produsul pentru ${r.nume}`} value={r.produs} onChange={(e) => set(i, { produs: e.target.value })}>
                    <option value={NEW}>(produs nou)</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {`${p.nume} (${p.cod})`}
                      </option>
                    ))}
                  </select>
                  {r.produs === NEW && (
                    <div className="row small">
                      <input aria-label={`Codul produsului nou ${r.nume}`} value={r.codNou} onChange={(e) => set(i, { codNou: e.target.value })} size={10} />
                      <input aria-label={`UM pentru ${r.nume}`} value={r.umNou} onChange={(e) => set(i, { umNou: e.target.value })} size={5} />
                    </div>
                  )}
                </td>
                <td>
                  <input aria-label={`Cantitatea pentru ${r.nume}`} value={r.cantitateText} onChange={(e) => set(i, { cantitateText: e.target.value })} size={7} />
                </td>
                <td>
                  <input aria-label={`Prețul pentru ${r.nume}`} value={r.pretText} onChange={(e) => set(i, { pretText: e.target.value })} size={8} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">Verifică liniile cu factura. Produsele noi se adaugă în Business doar când înregistrezi recepția.</p>
      {err && <p className="error">{err}</p>}
      <div className="row wrap">
        <button className="primary" disabled={busy || houses.length === 0 || rows.length === 0 || !head.numar.trim() || !head.data}>
          Înregistrează recepția
        </button>
        <button type="button" disabled={busy} onClick={onClose}>
          Renunță
        </button>
      </div>
    </form>
  );
}
