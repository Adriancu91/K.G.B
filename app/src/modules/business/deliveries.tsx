// Tracked deliveries (Etapa 7, step 7.4k-4): stages in order, each with the
// fields it needs (vehicle and driver, transport document, who received
// it), then the quantity the client confirms on every line; history kept.
import { Fragment, useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.business";

type Stage = "pregatire" | "incarcat" | "in_drum" | "livrat" | "confirmat" | "anulata";
interface Line {
  descriere: string;
  um: string;
  cantitate_text: string;
  confirmat_text: string | null;
}
interface Delivery {
  id: string;
  numar_text: string;
  comanda_text: string | null;
  destinatar: string | null;
  adresa: string;
  data: string;
  linii: Line[];
  etapa: Stage;
  campuri: Record<string, string>;
  istoric: { etapa: Stage; cand_ms: number; campuri: Record<string, string>; motiv: string | null }[];
  diferente: boolean;
}
interface Order {
  id: string;
  numar_text: string;
  stare: string;
  partener_nume: string | null;
}

const LABEL: Record<Stage, string> = { pregatire: "pregătire", incarcat: "încărcat", in_drum: "în drum", livrat: "livrat", confirmat: "confirmat", anulata: "anulată" };
const NEXT: Partial<Record<Stage, Stage>> = { pregatire: "incarcat", incarcat: "in_drum", in_drum: "livrat", livrat: "confirmat" };
const FIELDS: Partial<Record<Stage, [string, string][]>> = {
  incarcat: [
    ["vehicul", "Numărul vehiculului"],
    ["sofer", "Șoferul"],
  ],
  in_drum: [["aviz", "Avizul / documentul de transport"]],
  livrat: [["primit_de", "Cine a primit marfa"]],
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function DeliveriesView({ onError }: { onError: (e: string | null) => void }) {
  const [list, setList] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [stepping, setStepping] = useState<{ id: string; to: Stage; values: Record<string, string>; confirm: string[] } | null>(null);
  const [cancel, setCancel] = useState<{ id: string; motiv: string } | null>(null);
  const [f, setF] = useState({ comanda: "", destinatar: "", adresa: "", data: today(), descriere: "", cantitate: "" });

  const load = useCallback(async () => {
    try {
      const [d, o] = await Promise.all([api.moduleCall<Delivery[]>(ID, "deliveries"), api.moduleCall<Order[]>(ID, "orders")]);
      setList(d);
      setOrders(o.filter((x) => x.stare === "aprobata" || x.stare === "livrare"));
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setErr(null);
      await load();
    } catch (e) {
      setErr(message(e));
    }
  };

  return (
    <div className="deliveries">
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      <table className="audit">
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Destinatar</th>
            <th>Adresa</th>
            <th>Data</th>
            <th>Etapa</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                Nicio livrare încă.
              </td>
            </tr>
          )}
          {list.map((d) => {
            const next = NEXT[d.etapa];
            return (
              <Fragment key={d.id}>
                <tr data-delivery={d.numar_text}>
                  <td>
                    <button className="link" onClick={() => setOpen(open === d.id ? null : d.id)}>
                      {d.numar_text}
                    </button>
                    {d.comanda_text && <span className="muted small"> · {d.comanda_text}</span>}
                  </td>
                  <td>{d.destinatar}</td>
                  <td>{d.adresa}</td>
                  <td>{d.data.split("-").reverse().join(".")}</td>
                  <td>
                    <span className={`tag st-${d.etapa}`}>{LABEL[d.etapa]}</span>
                    {d.diferente && <span className="tag warn"> diferențe</span>}
                  </td>
                  <td className="row">
                    {next && (
                      <button className="link" onClick={() => setStepping({ id: d.id, to: next, values: {}, confirm: d.linii.map((l) => l.cantitate_text) })}>
                        → {LABEL[next]}
                      </button>
                    )}
                    {["pregatire", "incarcat", "in_drum"].includes(d.etapa) && (
                      <button className="link danger-text" onClick={() => setCancel({ id: d.id, motiv: "" })}>
                        Anulează…
                      </button>
                    )}
                  </td>
                </tr>
                {open === d.id && (
                  <tr>
                    <td colSpan={6}>
                      <ul className="plain small">
                        {d.linii.map((l, n) => (
                          <li key={n}>
                            {l.descriere}: {l.cantitate_text} {l.um}
                            {l.confirmat_text !== null && (
                              <span className={l.confirmat_text === l.cantitate_text ? "" : "warn-text"}> · confirmat {l.confirmat_text}</span>
                            )}
                          </li>
                        ))}
                        {d.istoric.map((h, n) => (
                          <li key={`h${n}`} className="muted">
                            {when(h.cand_ms)}: {LABEL[h.etapa]}
                            {Object.entries(h.campuri).map(([k, v]) => ` · ${k.replace("_", " ")}: ${v}`)}
                            {h.motiv ? ` (${h.motiv})` : ""}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {stepping && (
        <div className="card delivery-step">
          <h3>→ {LABEL[stepping.to]}</h3>
          {(FIELDS[stepping.to] ?? []).map(([k, label]) => (
            <label key={k}>
              {label}
              <input aria-label={label} value={stepping.values[k] ?? ""} maxLength={200} onChange={(e) => setStepping({ ...stepping, values: { ...stepping.values, [k]: e.target.value } })} />
            </label>
          ))}
          {stepping.to === "confirmat" &&
            list
              .find((d) => d.id === stepping.id)
              ?.linii.map((l, n) => (
                <label key={n}>
                  Confirmat de client: {l.descriere} (livrat {l.cantitate_text} {l.um})
                  <input
                    aria-label={`Confirmat ${n + 1}`}
                    value={stepping.confirm[n] ?? ""}
                    onChange={(e) => setStepping({ ...stepping, confirm: stepping.confirm.map((c, j) => (j === n ? e.target.value : c)) })}
                  />
                </label>
              ))}
          <div className="row">
            <button
              className="primary"
              disabled={(FIELDS[stepping.to] ?? []).some(([k]) => !(stepping.values[k] ?? "").trim())}
              onClick={() =>
                void act(() =>
                  api.moduleCall(ID, "delivery_step", { id: stepping.id, etapa: stepping.to, campuri: stepping.values, confirmat: stepping.to === "confirmat" ? stepping.confirm : [] }),
                ).then(() => setStepping(null))
              }
            >
              Salvează
            </button>
            <button onClick={() => setStepping(null)}>Renunță</button>
          </div>
        </div>
      )}
      {cancel && (
        <div className="row wrap">
          <input aria-label="Motivul anulării" placeholder="Motivul (obligatoriu)" value={cancel.motiv} maxLength={300} onChange={(e) => setCancel({ ...cancel, motiv: e.target.value })} />
          <button className="primary" disabled={!cancel.motiv.trim()} onClick={() => void act(() => api.moduleCall(ID, "delivery_step", { id: cancel.id, etapa: "anulata", motiv: cancel.motiv })).then(() => setCancel(null))}>
            Anulează livrarea
          </button>
          <button onClick={() => setCancel(null)}>Renunță</button>
        </div>
      )}

      <h3>Livrare nouă</h3>
      <form
        className="task-form delivery-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act(() =>
            api.moduleCall(ID, "delivery_save", {
              adresa: f.adresa,
              data: f.data,
              ...(f.comanda ? { comanda: f.comanda } : { destinatar: f.destinatar, linii: [{ descriere: f.descriere, cantitate: f.cantitate }] }),
            }),
          );
        }}
      >
        <div className="row wrap">
          <label>
            Din comanda
            <select aria-label="Comanda livrată" value={f.comanda} onChange={(e) => setF({ ...f, comanda: e.target.value })}>
              <option value="">— fără comandă —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.numar_text} {o.partener_nume ? `· ${o.partener_nume}` : ""}
                </option>
              ))}
            </select>
          </label>
          {!f.comanda && (
            <label>
              Destinatar
              <input aria-label="Destinatarul" value={f.destinatar} onChange={(e) => setF({ ...f, destinatar: e.target.value })} />
            </label>
          )}
          <label>
            Adresa de livrare
            <input aria-label="Adresa de livrare" value={f.adresa} onChange={(e) => setF({ ...f, adresa: e.target.value })} />
          </label>
          <label>
            Data
            <input aria-label="Data livrării" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
          </label>
        </div>
        {!f.comanda && (
          <div className="row wrap">
            <input aria-label="Ce se livrează" placeholder="Ce se livrează" value={f.descriere} onChange={(e) => setF({ ...f, descriere: e.target.value })} />
            <input aria-label="Cantitatea livrată" placeholder="Cantitate" size={8} value={f.cantitate} onChange={(e) => setF({ ...f, cantitate: e.target.value })} />
          </div>
        )}
        <p className="muted small">{f.comanda ? "Liniile se iau din comandă." : "Fără comandă: o linie."}</p>
        <div className="row">
          <button className="primary">Creează livrarea</button>
        </div>
      </form>
    </div>
  );
}
