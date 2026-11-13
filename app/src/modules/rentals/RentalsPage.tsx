// Spații și chiriași (Etapa 8, step 8.17): one month at a time — the common utilities and how they are split (by
// area, people or equally, exact to the ban; a free premises' part stays the owner's), what every lease owes for the
// month (rent and utilities), the payments taken or cancelled with a reason; the leases; the premises; the arrears.
// Everything owed is computed by the module; the page only shows and asks.
// A read-only role sees everything and changes nothing (the core refuses anyway; the buttons say so first).
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.rentals";
const KINDS: Array<[string, string]> = [
  ["apartament", "apartament"],
  ["birou", "birou"],
  ["comercial", "spațiu comercial"],
  ["depozit", "depozit"],
  ["teren", "teren"],
  ["altul", "altul"],
];
const KEYS: Array<[string, string]> = [
  ["suprafata", "pe suprafață"],
  ["persoane", "pe persoane"],
  ["egal", "în părți egale"],
];

interface Premises {
  id: string;
  version: number;
  nume: string;
  cladire: string;
  fel: string;
  suprafata: number;
  persoane: number;
  activ: boolean;
  nota: string;
  chirias: string;
}
interface Lease {
  id: string;
  version: number;
  spatiu: string;
  spatiu_nume: string;
  chirias_nume: string;
  numar: string;
  de_la: string;
  pana_la: string;
  chirie: number;
  garantie: number;
  zi_plata: number;
  stare: string;
}
interface MonthRow extends Lease {
  chirie_luna: number;
  utilitati_luna: number;
  total: number;
  incasat: number;
  rest: number;
}
interface Situation {
  luna: string;
  total: number;
  incasat: number;
  rest: number;
  utilitati_proprietar: number;
  contracte: MonthRow[];
}
interface Utility {
  id: string;
  version: number;
  fel: string;
  suma: number;
  cheie: string;
  document: string;
}
interface SplitView {
  utilitati: Array<{ fel: string; suma: number; cheie: string }>;
  spatii: Array<{ spatiu: string; nume: string; chirias: string; liber: boolean; parti: number[]; total: number }>;
}
interface Arrears {
  total: number;
  restante: Array<Lease & { datorat: number; incasat: number; rest: number }>;
}

const z = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const ro = (d: string) => (d ? d.split("-").reverse().join(".") : "");
const lei = (b: number) => {
  const [i, f] = (Math.abs(b) / 100).toFixed(2).split(".");
  return `${b < 0 ? "-" : ""}${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${f}`;
};
const toBani = (t: string) => {
  const s = t.trim().replace(/\s/g, "");
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const label = (list: Array<[string, string]>, k: string) => list.find(([x]) => x === k)?.[1] ?? k;
const mp = (h: number) => (h / 100).toLocaleString("ro-RO", { maximumFractionDigits: 2 });

const blankPremises = { nume: "", cladire: "", fel: "apartament", suprafata: "", persoane: "", nota: "" };
const blankLease = { spatiu: "", chirias_nume: "", numar: "", de_la: "", pana_la: "", chirie: "", garantie: "", zi_plata: "5" };

export function RentalsPage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const today = iso(new Date());
  const [tab, setTab] = useState<"luna" | "contracte" | "spatii" | "restante">("luna");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [situation, setSituation] = useState<Situation | null>(null);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [splitView, setSplitView] = useState<SplitView | null>(null);
  const [premises, setPremises] = useState<Premises[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [arrears, setArrears] = useState<Arrears | null>(null);
  const [util, setUtil] = useState({ fel: "", suma: "", cheie: "suprafata", document: "" });
  const [pay, setPay] = useState<Record<string, string>>({});
  const [place, setPlace] = useState(blankPremises);
  const [editPlace, setEditPlace] = useState<Premises | null>(null);
  const [lease, setLease] = useState({ ...blankLease, de_la: today });
  const [endDay, setEndDay] = useState(today);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([api.moduleCall<Premises[]>(ID, "spatii", {}), api.moduleCall<Lease[]>(ID, "inchirieri", {})]);
      setPremises(p);
      setLeases(l);
      if (tab === "luna") {
        const [s, u, r] = await Promise.all([
          api.moduleCall<Situation>(ID, "situatie", { luna: month }),
          api.moduleCall<Utility[]>(ID, "utilitati", { luna: month }),
          api.moduleCall<SplitView>(ID, "repartizare", { luna: month }),
        ]);
        setSituation(s);
        setUtilities(u);
        setSplitView(r);
      }
      if (tab === "restante") setArrears(await api.moduleCall<Arrears>(ID, "restante", { azi: today }));
    } catch (e) {
      onError(message(e));
    }
  }, [tab, month, today, onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (f: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await f();
      onError(null);
      if (done) setNotice(done);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
    await load();
  };

  return (
    <section className="rentals">
      {readOnly && <p className="warn">Rolul tău poate doar citi chiriile: nu poate schimba nimic.</p>}
      <div className="sheet-tabs" role="tablist" aria-label="Vederea">
        {(
          [
            ["luna", "Luna"],
            ["contracte", "Contracte"],
            ["spatii", "Spații"],
            ["restante", "Restanțe"],
          ] as const
        ).map(([k, v]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? "active" : ""}
            onClick={() => {
              setTab(k);
              setNotice(null);
            }}
          >
            {v}
          </button>
        ))}
      </div>
      {notice && <p className="ok">{notice}</p>}

      {tab === "luna" && (
        <>
          <label>
            Luna
            <input type="month" aria-label="Luna" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          {situation && (
            <>
              <p>
                De încasat <b>{lei(situation.total)}</b> · încasat <b>{lei(situation.incasat)}</b> · rest <b>{lei(situation.rest)} lei</b>
                {situation.utilitati_proprietar > 0 && <span> · utilitățile spațiilor libere (ale proprietarului): {lei(situation.utilitati_proprietar)} lei</span>}
              </p>
              <table className="rentals-month">
                <thead>
                  <tr>
                    <th>Spațiul</th>
                    <th>Chiriaș</th>
                    <th className="num">Chirie</th>
                    <th className="num">Utilități</th>
                    <th className="num">Total</th>
                    <th className="num">Încasat</th>
                    <th className="num">Rest</th>
                    <th>Încasare</th>
                  </tr>
                </thead>
                <tbody>
                  {situation.contracte.map((r) => (
                    <tr key={r.id} data-testid="month-row">
                      <td>{r.spatiu_nume}</td>
                      <td>{r.chirias_nume}</td>
                      <td className="num">{lei(r.chirie_luna)}</td>
                      <td className="num">{lei(r.utilitati_luna)}</td>
                      <td className="num">{lei(r.total)}</td>
                      <td className="num">{lei(r.incasat)}</td>
                      <td className={`num ${r.rest > 0 ? "danger-text" : ""}`}>{lei(r.rest)}</td>
                      <td>
                        {!readOnly && (
                          <span className="row">
                            <input aria-label={`Suma de la ${r.chirias_nume}`} className="num" size={8} placeholder={lei(Math.max(r.rest, 0))} value={pay[r.id] ?? ""} onChange={(e) => setPay({ ...pay, [r.id]: e.target.value })} />
                            <button
                              disabled={busy || !(pay[r.id] ?? "").trim()}
                              onClick={() =>
                                void run(async () => {
                                  const suma = toBani(pay[r.id] ?? "");
                                  if (Number.isNaN(suma)) throw new Error("suma e un număr");
                                  await api.moduleCall(ID, "incasare_save", { inchiriere: r.id, luna: month, data: today, suma });
                                  setPay({ ...pay, [r.id]: "" });
                                }, "Încasarea e trecută.")
                              }
                            >
                              Încasează
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!situation.contracte.length && <p className="muted">Niciun contract în luna aceasta.</p>}
            </>
          )}

          <h3>Utilitățile lunii</h3>
          {splitView && splitView.utilitati.length > 0 && (
            <table className="rentals-split">
              <thead>
                <tr>
                  <th>Spațiul</th>
                  {splitView.utilitati.map((u, k) => (
                    <th key={k} className="num">
                      {u.fel} ({lei(u.suma)}, {label(KEYS, u.cheie)})
                    </th>
                  ))}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {splitView.spatii.map((s) => (
                  <tr key={s.spatiu} className={s.liber ? "muted" : ""}>
                    <td>
                      {s.nume} · {s.liber ? "liber (proprietarul)" : s.chirias}
                    </td>
                    {s.parti.map((x, k) => (
                      <td key={k} className="num">
                        {lei(x)}
                      </td>
                    ))}
                    <td className="num">
                      <b>{lei(s.total)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!utilities.length && <p className="muted">Nicio utilitate trecută pentru luna aceasta.</p>}
          {utilities.length > 0 && !readOnly && (
            <ul className="rentals-utilities">
              {utilities.map((u) => (
                <li key={u.id}>
                  {u.fel} · {lei(u.suma)} lei · {label(KEYS, u.cheie)}{" "}
                  <button className="link danger-text" onClick={() => void run(() => api.moduleCall(ID, "utilitate_delete", { id: u.id, version: u.version }))}>
                    șterge
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!readOnly && (
            <form
              className="row"
              aria-label="Utilitate nouă"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const suma = toBani(util.suma);
                  if (Number.isNaN(suma)) throw new Error("suma e un număr");
                  await api.moduleCall(ID, "utilitate_save", { luna: month, fel: util.fel, suma, cheie: util.cheie, document: util.document });
                  setUtil({ ...util, fel: "", suma: "", document: "" });
                }, "Utilitatea e trecută și împărțită.");
              }}
            >
              <input aria-label="Felul utilității" placeholder="de ex. apă, curățenie" value={util.fel} onChange={(e) => setUtil({ ...util, fel: e.target.value })} required />
              <input aria-label="Suma utilității" placeholder="suma (lei)" value={util.suma} onChange={(e) => setUtil({ ...util, suma: e.target.value })} required />
              <select aria-label="Cum se împarte" value={util.cheie} onChange={(e) => setUtil({ ...util, cheie: e.target.value })}>
                {KEYS.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input aria-label="Factura utilității" placeholder="factura nr." value={util.document} onChange={(e) => setUtil({ ...util, document: e.target.value })} />
              <button className="primary" disabled={busy}>
                Adaugă utilitatea
              </button>
            </form>
          )}
          <p className="muted">Împărțirea e exactă la ban: părțile se rotunjesc în jos, iar banii rămași merg pe rând la cele mai mari resturi. Chiria se datorează întreagă pentru fiecare lună în care contractul ține măcar o zi.</p>
        </>
      )}

      {tab === "contracte" && (
        <>
          <table className="rentals-leases">
            <thead>
              <tr>
                <th>Spațiul</th>
                <th>Chiriaș</th>
                <th>Perioada</th>
                <th className="num">Chirie</th>
                <th className="num">Garanție</th>
                <th>Plata</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => (
                <tr key={l.id} className={l.stare === "activ" ? "" : "muted"}>
                  <td>{l.spatiu_nume}</td>
                  <td>
                    {l.chirias_nume}
                    {l.numar && <span className="muted"> · nr. {l.numar}</span>}
                  </td>
                  <td>
                    {ro(l.de_la)} – {l.pana_la ? ro(l.pana_la) : "nedeterminat"}
                  </td>
                  <td className="num">{lei(l.chirie)}</td>
                  <td className="num">{lei(l.garantie)}</td>
                  <td>în ziua {l.zi_plata}</td>
                  <td>
                    {l.stare === "activ" && !readOnly && (
                      <button className="link" onClick={() => void run(() => api.moduleCall(ID, "inchiriere_incheie", { id: l.id, version: l.version, data: endDay }), "Contractul e încheiat.")}>
                        încheie la {ro(endDay)}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!leases.length && <p className="muted">Niciun contract încă.</p>}
          {!readOnly && (
            <>
              <label>
                Data încheierii (pentru „încheie”)
                <input type="date" aria-label="Data încheierii" value={endDay} onChange={(e) => setEndDay(e.target.value)} />
              </label>
              <form
                className="card"
                aria-label="Contract nou"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const chirie = toBani(lease.chirie);
                    const garantie = toBani(lease.garantie);
                    if (Number.isNaN(chirie) || Number.isNaN(garantie)) throw new Error("chiria și garanția sunt numere");
                    await api.moduleCall(ID, "inchiriere_save", { ...lease, chirie, garantie, zi_plata: Number(lease.zi_plata) || 1 });
                    setLease({ ...blankLease, de_la: today });
                  }, "Contractul e salvat.");
                }}
              >
                <h3>Contract nou</h3>
                <div className="row">
                  <label>
                    Spațiul
                    <select aria-label="Spațiul contractului" value={lease.spatiu} onChange={(e) => setLease({ ...lease, spatiu: e.target.value })} required>
                      <option value="">— alege spațiul —</option>
                      {premises.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.cladire ? `${p.cladire} · ` : ""}
                          {p.nume}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Chiriaș
                    <input aria-label="Chiriașul" value={lease.chirias_nume} onChange={(e) => setLease({ ...lease, chirias_nume: e.target.value })} required />
                  </label>
                  <label>
                    Nr. contract
                    <input aria-label="Numărul contractului" value={lease.numar} onChange={(e) => setLease({ ...lease, numar: e.target.value })} />
                  </label>
                </div>
                <div className="row">
                  <label>
                    De la
                    <input type="date" aria-label="Începutul contractului" value={lease.de_la} onChange={(e) => setLease({ ...lease, de_la: e.target.value })} required />
                  </label>
                  <label>
                    Până la (gol = nedeterminat)
                    <input type="date" aria-label="Sfârșitul contractului" value={lease.pana_la} onChange={(e) => setLease({ ...lease, pana_la: e.target.value })} />
                  </label>
                  <label>
                    Chiria pe lună (lei)
                    <input aria-label="Chiria pe lună" value={lease.chirie} onChange={(e) => setLease({ ...lease, chirie: e.target.value })} required />
                  </label>
                  <label>
                    Garanția (lei)
                    <input aria-label="Garanția" value={lease.garantie} onChange={(e) => setLease({ ...lease, garantie: e.target.value })} />
                  </label>
                  <label>
                    Ziua de plată
                    <input aria-label="Ziua de plată" inputMode="numeric" size={3} value={lease.zi_plata} onChange={(e) => setLease({ ...lease, zi_plata: e.target.value })} />
                  </label>
                </div>
                <button className="primary" disabled={busy}>
                  Adaugă contractul
                </button>
              </form>
            </>
          )}
        </>
      )}

      {tab === "spatii" && (
        <>
          <table className="rentals-premises">
            <thead>
              <tr>
                <th>Spațiul</th>
                <th>Fel</th>
                <th className="num">Suprafață (mp)</th>
                <th className="num">Persoane</th>
                <th>Chiriaș acum</th>
                <th>Utilități</th>
              </tr>
            </thead>
            <tbody>
              {premises.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="link"
                      onClick={() => {
                        setEditPlace(p);
                        setPlace({ nume: p.nume, cladire: p.cladire, fel: p.fel, suprafata: mp(p.suprafata), persoane: String(p.persoane), nota: p.nota });
                      }}
                    >
                      {p.nume}
                    </button>
                    {p.cladire && <span className="muted"> · {p.cladire}</span>}
                  </td>
                  <td>{label(KINDS, p.fel)}</td>
                  <td className="num">{mp(p.suprafata)}</td>
                  <td className="num">{p.persoane}</td>
                  <td>{p.chirias || <span className="muted">liber</span>}</td>
                  <td>{p.activ ? "da" : "nu"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && (
            <form
              className="card"
              aria-label="Spațiul"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const suprafata = toBani(place.suprafata);
                  if (Number.isNaN(suprafata)) throw new Error("suprafața e un număr");
                  await api.moduleCall(ID, "spatiu_save", {
                    ...(editPlace ? { id: editPlace.id, version: editPlace.version, activ: editPlace.activ } : {}),
                    nume: place.nume,
                    cladire: place.cladire,
                    fel: place.fel,
                    suprafata,
                    persoane: Number(place.persoane) || 0,
                    nota: place.nota,
                  });
                  setPlace(blankPremises);
                  setEditPlace(null);
                }, "Spațiul e salvat.");
              }}
            >
              <h3>{editPlace ? `Spațiul ${editPlace.nume}` : "Spațiu nou"}</h3>
              <div className="row">
                <label>
                  Numele
                  <input aria-label="Numele spațiului" placeholder="de ex. Ap. 3" value={place.nume} onChange={(e) => setPlace({ ...place, nume: e.target.value })} required />
                </label>
                <label>
                  Clădirea
                  <input aria-label="Clădirea" value={place.cladire} onChange={(e) => setPlace({ ...place, cladire: e.target.value })} />
                </label>
                <label>
                  Fel
                  <select aria-label="Felul spațiului" value={place.fel} onChange={(e) => setPlace({ ...place, fel: e.target.value })}>
                    {KINDS.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Suprafața (mp)
                  <input aria-label="Suprafața" value={place.suprafata} onChange={(e) => setPlace({ ...place, suprafata: e.target.value })} />
                </label>
                <label>
                  Persoane
                  <input aria-label="Persoanele" inputMode="numeric" value={place.persoane} onChange={(e) => setPlace({ ...place, persoane: e.target.value })} />
                </label>
              </div>
              <div className="actions">
                <button className="primary" disabled={busy}>
                  {editPlace ? "Salvează spațiul" : "Adaugă spațiul"}
                </button>
                {editPlace && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        void run(async () => {
                          await api.moduleCall(ID, "spatiu_save", { id: editPlace.id, version: editPlace.version, nume: editPlace.nume, cladire: editPlace.cladire, fel: editPlace.fel, suprafata: editPlace.suprafata, persoane: editPlace.persoane, nota: editPlace.nota, activ: !editPlace.activ });
                          setEditPlace(null);
                          setPlace(blankPremises);
                        })
                      }
                    >
                      {editPlace.activ ? "Scoate-l de la utilități" : "Pune-l la utilități"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditPlace(null);
                        setPlace(blankPremises);
                      }}
                    >
                      Renunță
                    </button>
                  </>
                )}
              </div>
            </form>
          )}
        </>
      )}

      {tab === "restante" && arrears && (
        <>
          <p>
            Total restant: <b>{lei(arrears.total)} lei</b>
          </p>
          {arrears.restante.length ? (
            <table className="rentals-arrears">
              <thead>
                <tr>
                  <th>Chiriaș</th>
                  <th>Spațiul</th>
                  <th className="num">Datorat</th>
                  <th className="num">Încasat</th>
                  <th className="num">Rest</th>
                </tr>
              </thead>
              <tbody>
                {arrears.restante.map((r) => (
                  <tr key={r.id}>
                    <td>{r.chirias_nume}</td>
                    <td>{r.spatiu_nume}</td>
                    <td className="num">{lei(r.datorat)}</td>
                    <td className="num">{lei(r.incasat)}</td>
                    <td className="num danger-text">{lei(r.rest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Nicio restanță: toți chiriașii sunt la zi.</p>
          )}
        </>
      )}
    </section>
  );
}
