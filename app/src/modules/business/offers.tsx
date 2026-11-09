// Offers (Etapa 7, step 7.4k-1): lines with VAT, valid until a date; they
// expire by themselves; accepted, refused or closed with a reason; a new
// version is a copy; PDF for the client.
import { useCallback, useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";

const ID = "kgb.business";

interface Offer {
  id: string;
  numar_text: string;
  data: string;
  valabil_pana: string;
  client: { nume: string };
  total_text: string;
  stare_afisata: "deschisa" | "expirata" | "acceptata" | "respinsa" | "inchisa";
  motiv: string | null;
}
interface Partner {
  id: string;
  nume: string;
  tip: string;
}
interface Line {
  descriere: string;
  cantitate: string;
  pret_unitar: string;
  cota_tva: number;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => iso(new Date());
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const ro = (s: string) => s.split("-").reverse().join(".");
const STATE: Record<Offer["stare_afisata"], [string, string]> = {
  deschisa: ["deschisă", "ok"],
  expirata: ["expirată", "warn"],
  acceptata: ["acceptată", "ok"],
  respinsa: ["respinsă", "bad"],
  inchisa: ["închisă", ""],
};

export function OffersView({ onError }: { onError: (e: string | null) => void }) {
  const [list, setList] = useState<Offer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rates, setRates] = useState<number[]>([21]);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blankLine = (): Line => ({ descriere: "", cantitate: "1", pret_unitar: "", cota_tva: rates[0] ?? 21 });
  const [f, setF] = useState({ partener: "", data: today(), valabil_pana: inDays(14), nota: "" });
  const [lines, setLines] = useState<Line[]>([{ descriere: "", cantitate: "1", pret_unitar: "", cota_tva: 21 }]);
  const [closing, setClosing] = useState<{ id: string; stare: "respinsa" | "inchisa"; motiv: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [o, p, st] = await Promise.all([
        api.moduleCall<Offer[]>(ID, "offers", { azi: today() }),
        api.moduleCall<Partner[]>(ID, "partners"),
        api.moduleCall<{ cote_tva: number[] }>(ID, "settings"),
      ]);
      setList(o);
      setPartners(p.filter((x) => x.tip !== "furnizor"));
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
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="offers">
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
            <th>Data</th>
            <th>Client</th>
            <th>Valabilă până la</th>
            <th className="num">Total (lei)</th>
            <th>Stare</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                Nicio ofertă încă.
              </td>
            </tr>
          )}
          {list.map((o) => {
            const [label, cls] = STATE[o.stare_afisata];
            const open = o.stare_afisata === "deschisa" || o.stare_afisata === "expirata";
            return (
              <tr key={o.id} data-offer={o.numar_text}>
                <td>{o.numar_text}</td>
                <td>{ro(o.data)}</td>
                <td>{o.client.nume}</td>
                <td>{ro(o.valabil_pana)}</td>
                <td className="num">{o.total_text}</td>
                <td>
                  <span className={`tag ${cls}`}>{label}</span>
                  {o.motiv && <span className="muted small"> · {o.motiv}</span>}
                </td>
                <td className="row">
                  {o.stare_afisata === "deschisa" && (
                    <button className="link" disabled={busy} onClick={() => void run(() => api.moduleCall(ID, "offer_close", { id: o.id, stare: "acceptata", azi: today() }))}>
                      Acceptată
                    </button>
                  )}
                  {open && (
                    <>
                      <button className="link" onClick={() => setClosing({ id: o.id, stare: "respinsa", motiv: "" })}>
                        Respinsă…
                      </button>
                      <button className="link" onClick={() => setClosing({ id: o.id, stare: "inchisa", motiv: "" })}>
                        Închide…
                      </button>
                    </>
                  )}
                  <button
                    className="link"
                    disabled={busy}
                    title="O ofertă nu se modifică: o versiune nouă e o copie, cu alte date"
                    onClick={() =>
                      void run(async () => {
                        const r = await api.moduleCall<{ numar: string }>(ID, "offer_copy", { id: o.id, data: today(), valabil_pana: inDays(14) });
                        setNotice(`Copie făcută: ${r.numar}, valabilă 14 zile.`);
                      })
                    }
                  >
                    Copiază
                  </button>
                  <button
                    className="link"
                    onClick={() =>
                      void run(async () => {
                        const dest = await save({ defaultPath: `Oferta ${o.numar_text}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
                        if (!dest) return;
                        await api.moduleCall(ID, "offer_pdf", { id: o.id, dest });
                        setNotice(`Salvat: ${dest}`);
                      })
                    }
                  >
                    PDF…
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {closing && (
        <div className="card">
          <h3>{closing.stare === "respinsa" ? "Ofertă respinsă" : "Închide oferta"}</h3>
          <div className="row wrap">
            <input aria-label="Motivul" placeholder="Motivul (obligatoriu)" value={closing.motiv} maxLength={300} onChange={(e) => setClosing({ ...closing, motiv: e.target.value })} />
            <button
              className="primary"
              disabled={busy || !closing.motiv.trim()}
              onClick={() =>
                void run(async () => {
                  await api.moduleCall(ID, "offer_close", { id: closing.id, stare: closing.stare, motiv: closing.motiv, azi: today() });
                  setClosing(null);
                })
              }
            >
              Salvează
            </button>
            <button onClick={() => setClosing(null)}>Renunță</button>
          </div>
        </div>
      )}

      <h3>Ofertă nouă</h3>
      {partners.length === 0 ? (
        <p className="muted">Adaugă mai întâi un client (Facturare → Parteneri).</p>
      ) : (
        <form
          className="task-form offer-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await api.moduleCall<{ numar: string; total_text: string }>(ID, "offer_save", { ...f, partener: f.partener || partners[0]?.id, linii: lines });
              setNotice(`Oferta ${r.numar} a fost salvată: ${r.total_text} lei.`);
              setLines([blankLine()]);
            });
          }}
        >
          <div className="row wrap">
            <label>
              Client
              <select aria-label="Clientul ofertei" value={f.partener || partners[0]?.id} onChange={(e) => setF({ ...f, partener: e.target.value })}>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nume}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data
              <input aria-label="Data ofertei" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
            </label>
            <label>
              Valabilă până la
              <input aria-label="Valabilă până la" type="date" value={f.valabil_pana} onChange={(e) => setF({ ...f, valabil_pana: e.target.value })} />
            </label>
          </div>
          {lines.map((l, i) => (
            <div className="row wrap" key={i}>
              <input aria-label={`Descrierea ${i + 1}`} placeholder="Descriere" value={l.descriere} onChange={(e) => setLine(i, { descriere: e.target.value })} />
              <input aria-label={`Cantitatea ${i + 1}`} placeholder="Cantitate" size={8} value={l.cantitate} onChange={(e) => setLine(i, { cantitate: e.target.value })} />
              <input aria-label={`Prețul ${i + 1}`} placeholder="Preț fără TVA" size={10} value={l.pret_unitar} onChange={(e) => setLine(i, { pret_unitar: e.target.value })} />
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
          <button type="button" className="link" onClick={() => setLines([...lines, blankLine()])}>
            + linie
          </button>
          <label>
            Notă
            <input aria-label="Nota ofertei" value={f.nota} maxLength={500} onChange={(e) => setF({ ...f, nota: e.target.value })} />
          </label>
          <div className="row">
            <button className="primary" disabled={busy}>
              Salvează oferta
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
