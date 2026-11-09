// Orders with approval (Etapa 7, step 7.4k-2): sales, purchases and
// transfers; draft → waiting for approval → approved → in delivery → done,
// or cancelled; rejecting and cancelling need a reason; the history of each
// order is kept; from an accepted offer the lines and prices are taken.
import { Fragment, useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.business";

type State = "ciorna" | "asteapta" | "aprobata" | "livrare" | "gata" | "anulata";
interface Order {
  id: string;
  numar_text: string;
  tip: "vanzare" | "cumparare" | "transfer";
  data: string;
  partener_nume: string | null;
  total_text: string;
  stare: State;
  istoric: { din: State | null; in: State; cand_ms: number; motiv: string | null }[];
  avertismente: string[] | null;
}
interface Partner {
  id: string;
  nume: string;
  tip: string;
}
interface Offer {
  id: string;
  numar_text: string;
  partener: string;
  stare: string;
  total_text: string;
}

const LABEL: Record<State, string> = {
  ciorna: "ciornă",
  asteapta: "așteaptă aprobare",
  aprobata: "aprobată",
  livrare: "în livrare",
  gata: "gata",
  anulata: "anulată",
};
const KIND: Record<Order["tip"], string> = { vanzare: "vânzare", cumparare: "cumpărare", transfer: "transfer" };
/** The buttons each state offers: [target, label, needs a reason]. */
const NEXT: Record<State, [State, string, boolean][]> = {
  ciorna: [
    ["asteapta", "Trimite la aprobare", false],
    ["anulata", "Anulează…", true],
  ],
  asteapta: [
    ["aprobata", "Aprobă", false],
    ["ciorna", "Respinge…", true],
    ["anulata", "Anulează…", true],
  ],
  aprobata: [
    ["livrare", "Pornește livrarea", false],
    ["anulata", "Anulează…", true],
  ],
  livrare: [
    ["gata", "Gata", false],
    ["anulata", "Anulează…", true],
  ],
  gata: [],
  anulata: [],
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ro = (s: string) => s.split("-").reverse().join(".");
const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function OrdersView({ onError }: { onError: (e: string | null) => void }) {
  const [list, setList] = useState<Order[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [rates, setRates] = useState<number[]>([21]);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState<{ id: string; to: State; motiv: string } | null>(null);
  const [f, setF] = useState({ tip: "vanzare" as Order["tip"], partener: "", oferta: "", data: today(), nota: "" });
  const blank = () => ({ descriere: "", cantitate: "1", pret_unitar: "", cota_tva: rates[0] ?? 21 });
  const [lines, setLines] = useState([{ descriere: "", cantitate: "1", pret_unitar: "", cota_tva: 21 }]);
  const setLine = (i: number, patch: Partial<(typeof lines)[number]>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const refresh = useCallback(async () => {
    try {
      const [o, p, of, st] = await Promise.all([
        api.moduleCall<Order[]>(ID, "orders"),
        api.moduleCall<Partner[]>(ID, "partners"),
        api.moduleCall<Offer[]>(ID, "offers", { azi: today() }),
        api.moduleCall<{ cote_tva: number[] }>(ID, "settings"),
      ]);
      setList(o);
      setPartners(p);
      setOffers(of.filter((x) => x.stare === "acceptata"));
      if (st.cote_tva?.length) setRates(st.cote_tva);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setFormError(null);
    } catch (e) {
      setFormError(message(e));
    } finally {
      setBusy(false);
    }
    await refresh();
  };
  const move = (id: string, to: State, motiv?: string) => run(() => api.moduleCall(ID, "order_move", { id, stare: to, ...(motiv ? { motiv } : {}) }));
  const who = f.tip === "cumparare" ? partners.filter((p) => p.tip !== "client") : partners.filter((p) => p.tip !== "furnizor");
  const partnerId = f.partener || who[0]?.id || "";
  const offersFor = offers.filter((o) => o.partener === partnerId);

  return (
    <div className="orders">
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {formError && (
        <p className="error" role="alert">
          {formError}
        </p>
      )}
      <table className="audit">
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Tip</th>
            <th>Data</th>
            <th>Partener</th>
            <th className="num">Total (lei)</th>
            <th>Stare</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                Nicio comandă încă.
              </td>
            </tr>
          )}
          {list.map((o) => (
            <Fragment key={o.id}>
              <tr data-order={o.numar_text}>
                <td>
                  <button className="link" onClick={() => setOpen(open === o.id ? null : o.id)} title="Istoricul comenzii">
                    {o.numar_text}
                  </button>
                </td>
                <td>{KIND[o.tip]}</td>
                <td>{ro(o.data)}</td>
                <td>{o.partener_nume ?? "—"}</td>
                <td className="num">{o.total_text}</td>
                <td>
                  <span className={`tag st-${o.stare}`}>{LABEL[o.stare]}</span>
                  {(o.avertismente?.length ?? 0) > 0 && <span className="tag warn" title={o.avertismente!.join("; ")}> peste ofertă</span>}
                </td>
                <td className="row">
                  {NEXT[o.stare].map(([to, label, needs]) => (
                    <button key={to} className="link" disabled={busy} onClick={() => (needs ? setReason({ id: o.id, to, motiv: "" }) : void move(o.id, to))}>
                      {label}
                    </button>
                  ))}
                </td>
              </tr>
              {open === o.id && (
                <tr>
                  <td colSpan={7}>
                    <ul className="plain small">
                      {o.istoric.map((h, n) => (
                        <li key={n}>
                          {when(h.cand_ms)}: {h.din ? `${LABEL[h.din]} → ` : ""}
                          {LABEL[h.in]}
                          {h.motiv ? ` (${h.motiv})` : ""}
                        </li>
                      ))}
                      {o.avertismente?.map((w) => (
                        <li key={w} className="warn-text">
                          Avertisment: {w}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {reason && (
        <div className="card">
          <h3>{reason.to === "ciorna" ? "Respinge (înapoi la ciornă)" : "Anulează comanda"}</h3>
          <div className="row wrap">
            <input aria-label="Motivul" placeholder="Motivul (obligatoriu)" value={reason.motiv} maxLength={300} onChange={(e) => setReason({ ...reason, motiv: e.target.value })} />
            <button
              className="primary"
              disabled={busy || !reason.motiv.trim()}
              onClick={() =>
                void move(reason.id, reason.to, reason.motiv).then(() => setReason(null))
              }
            >
              Salvează
            </button>
            <button onClick={() => setReason(null)}>Renunță</button>
          </div>
        </div>
      )}

      <h3>Comandă nouă</h3>
      <form
        className="task-form order-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const linii = lines.filter((l) => l.descriere.trim());
            const r = await api.moduleCall<{ numar: string; total_text: string; avertismente: string[] }>(ID, "order_save", {
              tip: f.tip,
              data: f.data,
              nota: f.nota,
              linii,
              ...(f.tip !== "transfer" ? { partener: partnerId } : {}),
              ...(f.oferta ? { oferta: f.oferta } : {}),
            });
            setNotice(`Comanda ${r.numar} (${r.total_text} lei) e salvată ca ciornă.${r.avertismente.length ? ` Atenție: ${r.avertismente.join("; ")}.` : ""}`);
            setLines([blank()]);
          });
        }}
      >
        <div className="row wrap">
          <label>
            Tip
            <select aria-label="Tipul comenzii" value={f.tip} onChange={(e) => setF({ ...f, tip: e.target.value as Order["tip"], partener: "", oferta: "" })}>
              <option value="vanzare">vânzare</option>
              <option value="cumparare">cumpărare</option>
              <option value="transfer">transfer</option>
            </select>
          </label>
          {f.tip !== "transfer" && (
            <label>
              {f.tip === "vanzare" ? "Client" : "Furnizor"}
              <select aria-label="Partenerul comenzii" value={partnerId} onChange={(e) => setF({ ...f, partener: e.target.value, oferta: "" })}>
                {who.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nume}
                  </option>
                ))}
              </select>
            </label>
          )}
          {f.tip === "vanzare" && offersFor.length > 0 && (
            <label>
              Din oferta acceptată
              <select aria-label="Oferta" value={f.oferta} onChange={(e) => setF({ ...f, oferta: e.target.value })}>
                <option value="">— fără ofertă —</option>
                {offersFor.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.numar_text} ({o.total_text} lei)
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Data
            <input aria-label="Data comenzii" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
          </label>
        </div>
        {f.oferta && (
          <p className="muted small">Fără linii, comanda ia toate liniile ofertei. O linie cu prețul gol ia prețul din ofertă; o cantitate peste ofertă dă un avertisment.</p>
        )}
        {lines.map((l, i) => (
          <div className="row wrap" key={i}>
            <input aria-label={`Descrierea ${i + 1}`} placeholder="Descriere" value={l.descriere} onChange={(e) => setLine(i, { descriere: e.target.value })} />
            <input aria-label={`Cantitatea ${i + 1}`} placeholder="Cantitate" size={8} value={l.cantitate} onChange={(e) => setLine(i, { cantitate: e.target.value })} />
            <input aria-label={`Prețul ${i + 1}`} placeholder={f.oferta ? "Preț (gol = din ofertă)" : "Preț fără TVA"} size={14} value={l.pret_unitar} onChange={(e) => setLine(i, { pret_unitar: e.target.value })} />
            <select aria-label={`Cota TVA ${i + 1}`} value={l.cota_tva} onChange={(e) => setLine(i, { cota_tva: Number(e.target.value) })}>
              {rates.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
            {lines.length > 1 && (
              <button type="button" className="link danger-text" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                scoate
              </button>
            )}
          </div>
        ))}
        <button type="button" className="link" onClick={() => setLines([...lines, blank()])}>
          + linie
        </button>
        <div className="row">
          <button className="primary" disabled={busy || (f.tip !== "transfer" && !partnerId)}>
            Salvează ca ciornă
          </button>
        </div>
      </form>
    </div>
  );
}
