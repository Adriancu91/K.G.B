// Cash and bank (Etapa 5, step 5.5): accounts with balances, money in and
// out linked to invoices and expenses, receipts, bank statements, advances.
// The module checks every amount; the page collects and shows.
import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";

const ID = "kgb.business";

interface Account {
  id: string;
  tip: "casa" | "banca";
  nume: string;
  iban: string | null;
  sold_text: string;
}
interface Payment {
  id: string;
  cont: string;
  data: string;
  sens: "incasare" | "plata";
  suma_text: string;
  partener_nume: string | null;
  avans_persoana: string | null;
  numar: string | null;
  explicatie: string | null;
  sursa: "manual" | "extras";
  storno_de: string | null;
  stornata: boolean;
  legata_de: string | null;
  decontat: boolean;
}
interface OpenDoc {
  tip: "factura" | "cheltuiala";
  id: string;
  eticheta: string;
  rest_text: string;
}
interface Series {
  id: string;
  cod: string;
}

const ro = (iso: string) => iso.split("-").reverse().join(".");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function CashView({ onError }: { onError: (e: string | null) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [openDocs, setOpenDocs] = useState<OpenDoc[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acc, setAcc] = useState({ tip: "casa", nume: "", iban: "" });
  const blank = { cont: "", sens: "incasare", suma: "", data: today(), document: "", chitanta: "", avans: "", explicatie: "" };
  const [pf, setPf] = useState(blank);
  const [settle, setSettle] = useState<{ avans: string; cheltuieli: string[]; restituit: string } | null>(null);
  const [linking, setLinking] = useState<{ plata: string; document: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, p, o, s] = await Promise.all([
        api.moduleCall<Account[]>(ID, "accounts"),
        api.moduleCall<Payment[]>(ID, "payments"),
        api.moduleCall<OpenDoc[]>(ID, "open_documents"),
        api.moduleCall<Series[]>(ID, "series"),
      ]);
      setAccounts(a);
      setPayments(p);
      setOpenDocs(o);
      setSeries(s);
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
      onError(null);
    } catch (e) {
      setFormError(message(e));
    } finally {
      setBusy(false);
    }
    await refresh();
  };

  const cont = accounts.find((a) => a.id === (pf.cont || accounts[0]?.id));
  const docsFor = (sens: string) => openDocs.filter((d) => (sens === "incasare" ? d.tip === "factura" : d.tip === "cheltuiala"));
  const accName = (id: string) => accounts.find((a) => a.id === id)?.nume ?? "";
  const docLabel = (ref: string | null) => (ref?.startsWith("factura") ? "factură" : "cheltuială");

  return (
    <div className="cash">
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
      <h3>Conturi</h3>
      <table className="audit accounts">
        <thead>
          <tr>
            <th>Cont</th>
            <th>Tip</th>
            <th>IBAN</th>
            <th>Sold (lei)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td>{a.nume}</td>
              <td>{a.tip === "casa" ? "casă" : "bancă"}</td>
              <td>{a.iban ?? ""}</td>
              <td className="num">{a.sold_text}</td>
              <td>
                {a.tip === "banca" && (
                  <button
                    className="link"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const path = await open({ multiple: false, filters: [{ name: "Extras CSV", extensions: ["csv"] }] });
                        if (typeof path !== "string") return;
                        const r = await api.importFileWith<{ importate: number; sarite: number }>(ID, path, "bank_import", { cont: a.id });
                        setNotice(`Extras importat în ${a.nume}: ${r.importate} operații noi${r.sarite ? `, ${r.sarite} deja importate` : ""}.`);
                      })
                    }
                  >
                    Importă extras CSV…
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="row wrap"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api.moduleCall(ID, "account_save", acc);
            setAcc({ tip: acc.tip, nume: "", iban: "" });
          });
        }}
      >
        <select aria-label="Tip cont" value={acc.tip} onChange={(e) => setAcc({ ...acc, tip: e.target.value })}>
          <option value="casa">casă</option>
          <option value="banca">bancă</option>
        </select>
        <input aria-label="Nume cont" placeholder="Nume (ex. Casa principală)" value={acc.nume} maxLength={100} onChange={(e) => setAcc({ ...acc, nume: e.target.value })} />
        {acc.tip === "banca" && <input aria-label="IBAN cont" placeholder="IBAN" value={acc.iban} maxLength={40} onChange={(e) => setAcc({ ...acc, iban: e.target.value })} />}
        <button disabled={busy || !acc.nume.trim()}>Adaugă contul</button>
      </form>

      {accounts.length > 0 && (
        <>
          <h3>Încasare sau plată nouă</h3>
          <form
            className="task-form payment-form"
            onSubmit={(e) => {
              e.preventDefault();
              const doc = openDocs.find((d) => d.id === pf.document);
              void run(async () => {
                const r = await api.moduleCall<{ numar: string | null }>(ID, "payment_save", {
                  cont: pf.cont || accounts[0]?.id,
                  data: pf.data,
                  sens: pf.sens,
                  suma: pf.suma,
                  ...(doc ? { document: { tip: doc.tip, id: doc.id } } : {}),
                  ...(pf.chitanta ? { chitanta_serie: pf.chitanta } : {}),
                  ...(pf.avans.trim() ? { avans_persoana: pf.avans } : {}),
                  ...(pf.explicatie.trim() ? { explicatie: pf.explicatie } : {}),
                });
                setNotice(`${pf.sens === "incasare" ? "Încasarea" : "Plata"} a fost înregistrată${r.numar ? ` (${r.numar})` : ""}.`);
                setPf({ ...blank, cont: pf.cont, sens: pf.sens });
              });
            }}
          >
            <div className="row wrap">
              <label>
                Cont
                <select aria-label="Cont" value={pf.cont || accounts[0]?.id} onChange={(e) => setPf({ ...pf, cont: e.target.value, chitanta: "", avans: "" })}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nume}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sens
                <select aria-label="Sens" value={pf.sens} onChange={(e) => setPf({ ...pf, sens: e.target.value, document: "", chitanta: "", avans: "" })}>
                  <option value="incasare">încasare</option>
                  <option value="plata">plată</option>
                </select>
              </label>
              <label>
                Suma (lei)
                <input aria-label="Suma" className="short" inputMode="decimal" value={pf.suma} onChange={(e) => setPf({ ...pf, suma: e.target.value })} />
              </label>
              <label>
                Data
                <input aria-label="Data plății" type="date" value={pf.data} onChange={(e) => setPf({ ...pf, data: e.target.value })} />
              </label>
            </div>
            <div className="row wrap">
              {!pf.avans && (
                <label>
                  Achită documentul
                  <select aria-label="Documentul achitat" value={pf.document} onChange={(e) => setPf({ ...pf, document: e.target.value })}>
                    <option value="">— niciunul —</option>
                    {docsFor(pf.sens).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.eticheta} (rest {d.rest_text})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {cont?.tip === "casa" && pf.sens === "incasare" && (
                <label>
                  Chitanță din seria
                  <select aria-label="Seria chitanței" value={pf.chitanta} onChange={(e) => setPf({ ...pf, chitanta: e.target.value })}>
                    <option value="">— fără chitanță —</option>
                    {series.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.cod}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {cont?.tip === "casa" && pf.sens === "plata" && !pf.document && (
                <label>
                  Avans către (persoană)
                  <input aria-label="Avans către" placeholder="lasă gol dacă nu e avans" value={pf.avans} maxLength={100} onChange={(e) => setPf({ ...pf, avans: e.target.value })} />
                </label>
              )}
              <label className="grow">
                Explicație
                <input aria-label="Explicație" value={pf.explicatie} maxLength={300} onChange={(e) => setPf({ ...pf, explicatie: e.target.value })} />
              </label>
            </div>
            <div className="dialog-actions">
              <button type="submit" className="primary" disabled={busy || !pf.suma.trim()}>
                Înregistrează
              </button>
            </div>
          </form>
        </>
      )}

      <h3>Operații</h3>
      <table className="audit payment-list">
        <thead>
          <tr>
            <th>Data</th>
            <th>Cont</th>
            <th>Încasare</th>
            <th>Plată</th>
            <th>Detalii</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                Nicio operație.
              </td>
            </tr>
          )}
          {payments.map((p) => (
            <tr key={p.id} className={p.stornata ? "done" : ""}>
              <td>{ro(p.data)}</td>
              <td>{accName(p.cont)}</td>
              <td className="num">{p.sens === "incasare" ? p.suma_text : ""}</td>
              <td className="num">{p.sens === "plata" ? p.suma_text : ""}</td>
              <td>
                {[p.numar, p.partener_nume, p.explicatie, p.avans_persoana ? `avans: ${p.avans_persoana}` : null].filter(Boolean).join(" · ")}
                {p.legata_de && <span className="badge"> achită {docLabel(p.legata_de)}</span>}
                {p.sursa === "extras" && <span className="badge"> extras</span>}
                {p.storno_de && <span className="badge"> storno</span>}
              </td>
              <td className="row">
                {!p.legata_de && !p.storno_de && !p.stornata && !p.avans_persoana && docsFor(p.sens).length > 0 && (
                  <button className="link" onClick={() => setLinking({ plata: p.id, document: docsFor(p.sens)[0]?.id ?? "" })}>
                    Leagă de document
                  </button>
                )}
                {p.avans_persoana && !p.decontat && !p.stornata && (
                  <button className="link" onClick={() => setSettle({ avans: p.id, cheltuieli: [], restituit: "0" })}>
                    Decont…
                  </button>
                )}
                {p.decontat && <span className="muted small">decontat</span>}
                {!p.storno_de && !p.stornata && !p.decontat && (
                  <button className="danger-text" aria-label={`Stornează operația din ${ro(p.data)}`} disabled={busy} onClick={() => void run(() => api.moduleCall(ID, "payment_storno", { id: p.id, data: today() }))}>
                    Stornează
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {linking && (
        <div className="card link-card">
          <h3>Leagă plata de un document</h3>
          <div className="row wrap">
            <select aria-label="Documentul de legat" value={linking.document} onChange={(e) => setLinking({ ...linking, document: e.target.value })}>
              {docsFor(payments.find((p) => p.id === linking.plata)?.sens ?? "incasare").map((d) => (
                <option key={d.id} value={d.id}>
                  {d.eticheta} (rest {d.rest_text})
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                const doc = openDocs.find((d) => d.id === linking.document);
                if (!doc) return;
                void run(async () => {
                  await api.moduleCall(ID, "payment_link", { plata: linking.plata, document: { tip: doc.tip, id: doc.id } });
                  setLinking(null);
                  setNotice("Plata a fost legată de document.");
                });
              }}
            >
              Leagă
            </button>
            <button onClick={() => setLinking(null)}>Renunță</button>
          </div>
        </div>
      )}

      {settle && (
        <div className="card settle-card">
          <h3>Decontul avansului</h3>
          <p className="muted small">Bifează cheltuielile plătite din avans și scrie cât s-a restituit în casă. Suma lor trebuie să fie exact avansul.</p>
          {openDocs
            .filter((d) => d.tip === "cheltuiala")
            .map((d) => (
              <label key={d.id} className="check">
                <input
                  type="checkbox"
                  aria-label={`Din avans: ${d.eticheta}`}
                  checked={settle.cheltuieli.includes(d.id)}
                  onChange={(e) => setSettle({ ...settle, cheltuieli: e.target.checked ? [...settle.cheltuieli, d.id] : settle.cheltuieli.filter((x) => x !== d.id) })}
                />
                {d.eticheta} — {d.rest_text} lei
              </label>
            ))}
          <div className="row">
            <label>
              Restituit în casă (lei)
              <input aria-label="Restituit" className="short" inputMode="decimal" value={settle.restituit} onChange={(e) => setSettle({ ...settle, restituit: e.target.value })} />
            </label>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api.moduleCall(ID, "settle", { avans: settle.avans, data: today(), cheltuieli: settle.cheltuieli, restituit: settle.restituit });
                  setSettle(null);
                  setNotice("Avansul a fost decontat.");
                })
              }
            >
              Înregistrează decontul
            </button>
            <button onClick={() => setSettle(null)}>Renunță</button>
          </div>
        </div>
      )}
    </div>
  );
}
