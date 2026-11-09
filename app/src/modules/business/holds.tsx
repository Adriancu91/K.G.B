// Reserved and blocked stock (Etapa 7, step 7.4k-3): a quantity kept for an
// order, or kept aside with a reason; it does not leave the warehouse while
// active; an order's reservations end when it goes into delivery or is
// cancelled; anything can be released by hand (a block with a reason).
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.business";

interface Hold {
  id: string;
  tip: "rezervare" | "blocare";
  produs_nume: string;
  depozit_nume: string;
  cantitate_text: string;
  comanda_text: string | null;
  motiv: string | null;
  activa: boolean;
  istoric: { actiune: string; cand_ms: number; motiv: string | null }[];
}
interface Order {
  id: string;
  numar_text: string;
  stare: string;
  partener_nume: string | null;
}
export interface StockPos {
  produs: string;
  nume: string;
  depozit: string;
  depozit_nume: string;
}

const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function HoldsPanel({ stock, onChanged, onError }: { stock: StockPos[]; onChanged: () => void; onError: (e: string | null) => void }) {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [f, setF] = useState({ pos: "", tip: "rezervare" as Hold["tip"], cantitate: "", comanda: "", motiv: "" });
  const [rel, setRel] = useState<{ id: string; motiv: string; block: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, o] = await Promise.all([api.moduleCall<Hold[]>(ID, "holds"), api.moduleCall<Order[]>(ID, "orders")]);
      setHolds(h);
      setOrders(o.filter((x) => x.stare !== "gata" && x.stare !== "anulata"));
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
      onChanged();
    } catch (e) {
      setErr(message(e));
    }
  };
  const pos = stock.find((s) => `${s.produs}|${s.depozit}` === f.pos) ?? stock[0];
  const visible = showAll ? holds : holds.filter((h) => h.activa);

  return (
    <section className="holds">
      <h3>Rezervări și blocări</h3>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      {stock.length > 0 && (
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pos) return;
            void act(() =>
              api.moduleCall(ID, "hold_save", {
                produs: pos.produs,
                depozit: pos.depozit,
                cantitate: f.cantitate,
                tip: f.tip,
                ...(f.tip === "rezervare" ? { comanda: f.comanda || orders[0]?.id } : {}),
                ...(f.motiv.trim() ? { motiv: f.motiv } : {}),
              }).then(() => setF({ ...f, cantitate: "", motiv: "" })),
            );
          }}
        >
          <select aria-label="Tipul" value={f.tip} onChange={(e) => setF({ ...f, tip: e.target.value as Hold["tip"] })}>
            <option value="rezervare">rezervă pentru o comandă</option>
            <option value="blocare">blochează (cu motiv)</option>
          </select>
          <select aria-label="Produsul și depozitul" value={f.pos || (pos ? `${pos.produs}|${pos.depozit}` : "")} onChange={(e) => setF({ ...f, pos: e.target.value })}>
            {stock.map((s) => (
              <option key={`${s.produs}|${s.depozit}`} value={`${s.produs}|${s.depozit}`}>
                {s.nume} · {s.depozit_nume}
              </option>
            ))}
          </select>
          <input aria-label="Cantitatea rezervată" placeholder="Cantitate" size={8} value={f.cantitate} onChange={(e) => setF({ ...f, cantitate: e.target.value })} />
          {f.tip === "rezervare" ? (
            <select aria-label="Comanda" value={f.comanda || orders[0]?.id || ""} onChange={(e) => setF({ ...f, comanda: e.target.value })}>
              {orders.length === 0 && <option value="">nicio comandă deschisă</option>}
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.numar_text} {o.partener_nume ? `· ${o.partener_nume}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input aria-label="Motivul blocării" placeholder="Motivul (obligatoriu)" value={f.motiv} maxLength={300} onChange={(e) => setF({ ...f, motiv: e.target.value })} />
          )}
          <button className="primary" disabled={!f.cantitate.trim() || (f.tip === "rezervare" ? orders.length === 0 : !f.motiv.trim())}>
            {f.tip === "rezervare" ? "Rezervă" : "Blochează"}
          </button>
        </form>
      )}
      <label className="small">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> arată și cele eliberate
      </label>
      {visible.length === 0 ? (
        <p className="muted">Nimic rezervat sau blocat.</p>
      ) : (
        <ul className="hold-list">
          {visible.map((h) => (
            <li key={h.id} className={h.activa ? "" : "muted"}>
              <span className={`tag ${h.tip === "blocare" ? "bad" : "warn"}`}>{h.tip === "blocare" ? "blocat" : "rezervat"}</span> {h.cantitate_text} {h.produs_nume} ·{" "}
              {h.depozit_nume}
              {h.comanda_text && ` · pentru ${h.comanda_text}`}
              {h.motiv && ` · ${h.motiv}`}
              {h.activa && (
                <button className="link small" onClick={() => setRel({ id: h.id, motiv: "", block: h.tip === "blocare" })}>
                  eliberează
                </button>
              )}
              <div className="muted small">{h.istoric.map((x) => `${when(x.cand_ms)} ${x.actiune}${x.motiv ? ` (${x.motiv})` : ""}`).join(" · ")}</div>
            </li>
          ))}
        </ul>
      )}
      {rel && (
        <div className="row wrap">
          <input aria-label="Motivul eliberării" placeholder={rel.block ? "Motivul (obligatoriu)" : "Motivul (opțional)"} value={rel.motiv} maxLength={300} onChange={(e) => setRel({ ...rel, motiv: e.target.value })} />
          <button className="primary" disabled={rel.block && !rel.motiv.trim()} onClick={() => void act(() => api.moduleCall(ID, "hold_release", { id: rel.id, ...(rel.motiv.trim() ? { motiv: rel.motiv } : {}) })).then(() => setRel(null))}>
            Eliberează
          </button>
          <button onClick={() => setRel(null)}>Renunță</button>
        </div>
      )}
    </section>
  );
}
