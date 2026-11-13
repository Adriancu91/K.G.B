// Membri și cotizații (Etapa 8, step 8.17): the members (people or firms) with their category, coming in and leaving,
// one member open with what they owe per year and their payments (cancelled with a reason, never deleted), the dues
// per year and category, the year's situation with the arrears, the meetings with who was present and what was
// decided. What is owed is computed by the module; the quorum rules are the statute's, the page only counts.
// A read-only role sees everything and changes nothing (the core refuses anyway; the buttons say so first).
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.members";
const MEETING_KINDS: Array<[string, string]> = [
  ["adunare_generala", "adunare generală"],
  ["consiliu_director", "consiliu director"],
  ["alta", "altă ședință"],
];
const PAY: Array<[string, string]> = [
  ["numerar", "numerar"],
  ["card", "card"],
  ["transfer", "transfer"],
];
const STATE_TEXT: Record<string, string> = { activ: "activ", retras: "retras", exclus: "exclus" };

interface Member {
  id: string;
  version: number;
  nume: string;
  fel: "persoana" | "firma";
  categorie: string;
  telefon: string;
  email: string;
  adresa: string;
  intrat: string;
  iesit: string;
  stare: string;
  nota: string;
}
interface Year {
  an: number;
  datorat: number;
  platit: number;
  rest: number;
  fara_tarif: boolean;
  tarif: number | null;
  perioada: string | null;
}
interface Payment {
  id: string;
  version: number;
  an: number;
  data: string;
  suma: number;
  fel: string;
  document: string;
  anulata: boolean;
  motiv: string;
}
interface MemberDetail extends Member {
  ani: Year[];
  plati: Payment[];
}
interface Rate {
  id: string;
  version: number;
  an: number;
  categorie: string;
  suma: number;
  perioada: "anual" | "lunar";
}
interface Situation {
  an: number;
  datorat: number;
  platit: number;
  rest: number;
  cu_restante: number;
  fara_tarif: number;
  membri: Array<Year & { membru: string; nume: string; categorie: string; stare: string }>;
}
interface Meeting {
  id: string;
  version: number;
  data: string;
  fel: string;
  ordine_de_zi: string;
  hotarari: string;
  prezenti: string[];
  membri_activi: number;
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
const activeOn = (m: Member, d: string) => m.intrat <= d && (!m.iesit || m.iesit >= d);

const blankMember = { nume: "", fel: "persoana", categorie: "", telefon: "", email: "", adresa: "", intrat: "", nota: "" };

export function MembersPage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const today = iso(new Date());
  const thisYear = Number(today.slice(0, 4));
  const [tab, setTab] = useState<"membri" | "situatie" | "cotizatii" | "sedinte">("membri");
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<MemberDetail | null>(null);
  const [member, setMember] = useState({ ...blankMember, intrat: today });
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [rate, setRate] = useState({ an: String(thisYear), categorie: "", suma: "", perioada: "anual" });
  const [year, setYear] = useState(thisYear);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meeting, setMeeting] = useState({ data: today, fel: "adunare_generala", ordine_de_zi: "", hotarari: "", prezenti: [] as string[] });
  const [pay, setPay] = useState({ an: String(thisYear), suma: "", fel: "numerar", document: "" });
  const [leave, setLeave] = useState({ stare: "retras", data: today });
  const [cancel, setCancel] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openMember = useCallback(
    async (id: string) => {
      try {
        setOpen(await api.moduleCall<MemberDetail>(ID, "membru", { id, azi: today }));
      } catch (e) {
        onError(message(e));
      }
    },
    [today, onError],
  );
  const load = useCallback(async () => {
    try {
      setMembers(await api.moduleCall<Member[]>(ID, "membri", { text: search }));
      if (tab === "cotizatii") setRates(await api.moduleCall<Rate[]>(ID, "tarife", {}));
      if (tab === "situatie") setSituation(await api.moduleCall<Situation>(ID, "situatie", { an: year, azi: today }));
      if (tab === "sedinte") setMeetings(await api.moduleCall<Meeting[]>(ID, "sedinte", {}));
    } catch (e) {
      onError(message(e));
    }
  }, [tab, search, year, today, onError]);
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
    if (open) await openMember(open.id);
  };

  const names = new Map(members.map((m) => [m.id, m.nume]));

  return (
    <section className="members">
      {readOnly && <p className="warn">Rolul tău poate doar citi membrii: nu poate schimba nimic.</p>}
      <div className="sheet-tabs" role="tablist" aria-label="Vederea">
        {(
          [
            ["membri", "Membri"],
            ["situatie", "Situația pe an"],
            ["cotizatii", "Cotizații"],
            ["sedinte", "Ședințe"],
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

      {tab === "membri" && (
        <>
          <input aria-label="Caută membri" placeholder="Caută după nume sau categorie…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <table className="members-list">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Categoria</th>
                <th>Intrat</th>
                <th>Starea</th>
                <th>Telefon</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className={open?.id === m.id ? "selected" : m.stare === "activ" ? "" : "muted"}>
                  <td>
                    <button className="link" onClick={() => void openMember(m.id)}>
                      {m.nume}
                    </button>
                    {m.fel === "firma" && <span className="muted"> (firmă)</span>}
                  </td>
                  <td>{m.categorie}</td>
                  <td>{ro(m.intrat)}</td>
                  <td>
                    {STATE_TEXT[m.stare] ?? m.stare}
                    {m.iesit && ` (${ro(m.iesit)})`}
                  </td>
                  <td>{m.telefon}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!members.length && <p className="muted">Niciun membru încă. Adaugă primul membru mai jos.</p>}

          {open && (
            <div className="card" aria-label="Fișa membrului">
              <h3>
                {open.nume} · {STATE_TEXT[open.stare] ?? open.stare}
              </h3>
              <table className="members-years">
                <thead>
                  <tr>
                    <th>Anul</th>
                    <th className="num">Datorat</th>
                    <th className="num">Plătit</th>
                    <th className="num">Rest</th>
                  </tr>
                </thead>
                <tbody>
                  {open.ani.map((y) => (
                    <tr key={y.an}>
                      <td>
                        {y.an}
                        {y.fara_tarif && <span className="muted"> · fără cotizație stabilită</span>}
                      </td>
                      <td className="num">{lei(y.datorat)}</td>
                      <td className="num">{lei(y.platit)}</td>
                      <td className={`num ${y.rest > 0 ? "danger-text" : ""}`}>{lei(y.rest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!readOnly && (
                <form
                  className="row"
                  aria-label="Încasează cotizația"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const suma = toBani(pay.suma);
                      if (Number.isNaN(suma)) throw new Error("suma e un număr");
                      await api.moduleCall(ID, "plata_save", { membru: open.id, an: Number(pay.an), data: today, suma, fel: pay.fel, document: pay.document });
                      setPay({ ...pay, suma: "", document: "" });
                    }, "Cotizația e încasată.");
                  }}
                >
                  <label>
                    Pentru anul
                    <input aria-label="Anul cotizației" inputMode="numeric" size={5} value={pay.an} onChange={(e) => setPay({ ...pay, an: e.target.value })} />
                  </label>
                  <label>
                    Suma (lei)
                    <input aria-label="Suma încasată" value={pay.suma} onChange={(e) => setPay({ ...pay, suma: e.target.value })} />
                  </label>
                  <select aria-label="Felul plății" value={pay.fel} onChange={(e) => setPay({ ...pay, fel: e.target.value })}>
                    {PAY.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <input aria-label="Documentul" placeholder="chitanța nr." value={pay.document} onChange={(e) => setPay({ ...pay, document: e.target.value })} />
                  <button className="primary" disabled={busy || !pay.suma.trim()}>
                    Încasează
                  </button>
                </form>
              )}
              <h4>Încasări</h4>
              {open.plati.length ? (
                <ul className="members-payments">
                  {open.plati.map((p) => (
                    <li key={p.id} className={p.anulata ? "muted strike" : ""}>
                      {ro(p.data)} · {p.an} · {lei(p.suma)} lei · {label(PAY, p.fel)}
                      {p.document && ` · ${p.document}`}
                      {p.anulata && ` · anulată: ${p.motiv}`}
                      {!p.anulata && !readOnly && (
                        <span>
                          {" "}
                          <input aria-label="Motivul anulării" size={12} placeholder="motivul" value={cancel[p.id] ?? ""} onChange={(e) => setCancel({ ...cancel, [p.id]: e.target.value })} />
                          <button className="link danger-text" disabled={(cancel[p.id] ?? "").trim().length < 3} onClick={() => void run(() => api.moduleCall(ID, "plata_anuleaza", { id: p.id, version: p.version, motiv: cancel[p.id] }), "Încasarea e anulată.")}>
                            anulează
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nicio încasare.</p>
              )}
              {!readOnly && (
                <div className="actions">
                  <button
                    onClick={() => {
                      setEditMember(open);
                      setMember({ nume: open.nume, fel: open.fel, categorie: open.categorie, telefon: open.telefon, email: open.email, adresa: open.adresa, intrat: open.intrat, nota: open.nota });
                    }}
                  >
                    Modifică membrul
                  </button>
                  {open.stare === "activ" && (
                    <span className="row">
                      <select aria-label="Felul ieșirii" value={leave.stare} onChange={(e) => setLeave({ ...leave, stare: e.target.value })}>
                        <option value="retras">retras</option>
                        <option value="exclus">exclus</option>
                      </select>
                      <input type="date" aria-label="Data ieșirii" value={leave.data} onChange={(e) => setLeave({ ...leave, data: e.target.value })} />
                      <button onClick={() => void run(() => api.moduleCall(ID, "membru_iesire", { id: open.id, version: open.version, ...leave }), "Ieșirea e trecută.")}>Trece ieșirea</button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {!readOnly && (
            <form
              className="card"
              aria-label="Membrul"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await api.moduleCall<{ id: string }>(ID, "membru_save", { ...(editMember ? { id: editMember.id, version: editMember.version } : {}), ...member });
                  setMember({ ...blankMember, intrat: today });
                  setEditMember(null);
                  await openMember(r.id);
                }, "Membrul e salvat.");
              }}
            >
              <h3>{editMember ? `Membrul ${editMember.nume}` : "Membru nou"}</h3>
              <div className="row">
                <label>
                  Numele
                  <input aria-label="Numele membrului" value={member.nume} onChange={(e) => setMember({ ...member, nume: e.target.value })} required />
                </label>
                <label>
                  Fel
                  <select aria-label="Felul membrului" value={member.fel} onChange={(e) => setMember({ ...member, fel: e.target.value })}>
                    <option value="persoana">persoană</option>
                    <option value="firma">firmă</option>
                  </select>
                </label>
                <label>
                  Categoria
                  <input aria-label="Categoria" placeholder="de ex. membru fondator" value={member.categorie} onChange={(e) => setMember({ ...member, categorie: e.target.value })} />
                </label>
                <label>
                  Intrat la
                  <input type="date" aria-label="Data intrării" value={member.intrat} onChange={(e) => setMember({ ...member, intrat: e.target.value })} required />
                </label>
              </div>
              <div className="row">
                <label>
                  Telefon
                  <input aria-label="Telefonul membrului" value={member.telefon} onChange={(e) => setMember({ ...member, telefon: e.target.value })} />
                </label>
                <label>
                  E-mail
                  <input aria-label="E-mailul membrului" value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} />
                </label>
                <label>
                  Adresa
                  <input aria-label="Adresa membrului" value={member.adresa} onChange={(e) => setMember({ ...member, adresa: e.target.value })} />
                </label>
              </div>
              <div className="actions">
                <button className="primary" disabled={busy}>
                  {editMember ? "Salvează membrul" : "Adaugă membrul"}
                </button>
                {editMember && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMember(null);
                      setMember({ ...blankMember, intrat: today });
                    }}
                  >
                    Renunță
                  </button>
                )}
              </div>
            </form>
          )}
        </>
      )}

      {tab === "situatie" && (
        <>
          <label>
            Anul
            <input aria-label="Anul situației" inputMode="numeric" size={5} value={year} onChange={(e) => setYear(Number(e.target.value) || thisYear)} />
          </label>
          {situation && (
            <>
              <p>
                Datorat <b>{lei(situation.datorat)}</b> · încasat <b>{lei(situation.platit)}</b> · rest <b>{lei(situation.rest)} lei</b> · {situation.cu_restante} membri cu restanțe
              </p>
              {situation.fara_tarif > 0 && <p className="warn">{situation.fara_tarif} membri nu au cotizație stabilită pentru anul acesta (vezi „Cotizații”).</p>}
              <table className="members-situation">
                <thead>
                  <tr>
                    <th>Membru</th>
                    <th>Categoria</th>
                    <th className="num">Datorat</th>
                    <th className="num">Plătit</th>
                    <th className="num">Rest</th>
                  </tr>
                </thead>
                <tbody>
                  {situation.membri.map((m) => (
                    <tr key={m.membru}>
                      <td>
                        <button
                          className="link"
                          onClick={() => {
                            setTab("membri");
                            void openMember(m.membru);
                          }}
                        >
                          {m.nume}
                        </button>
                      </td>
                      <td>{m.categorie}</td>
                      <td className="num">{lei(m.datorat)}</td>
                      <td className="num">{lei(m.platit)}</td>
                      <td className={`num ${m.rest > 0 ? "danger-text" : ""}`}>{lei(m.rest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {tab === "cotizatii" && (
        <>
          <table className="members-rates">
            <thead>
              <tr>
                <th>Anul</th>
                <th>Categoria</th>
                <th className="num">Suma</th>
                <th>Pe</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td>{r.an}</td>
                  <td>{r.categorie || "toți membrii"}</td>
                  <td className="num">{lei(r.suma)}</td>
                  <td>{r.perioada === "lunar" ? "lună" : "an"}</td>
                  <td>
                    {!readOnly && (
                      <button className="link danger-text" onClick={() => void run(() => api.moduleCall(ID, "tarif_delete", { id: r.id, version: r.version }))}>
                        șterge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rates.length && <p className="muted">Nicio cotizație stabilită. Fără ea, membrii nu datorează nimic în anul acela.</p>}
          {!readOnly && (
            <form
              className="card row"
              aria-label="Cotizația"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const suma = toBani(rate.suma);
                  if (Number.isNaN(suma)) throw new Error("suma e un număr");
                  await api.moduleCall(ID, "tarif_save", { an: Number(rate.an), categorie: rate.categorie, suma, perioada: rate.perioada });
                  setRate({ ...rate, categorie: "", suma: "" });
                }, "Cotizația e salvată.");
              }}
            >
              <label>
                Anul
                <input aria-label="Anul cotizației noi" inputMode="numeric" size={5} value={rate.an} onChange={(e) => setRate({ ...rate, an: e.target.value })} />
              </label>
              <label>
                Categoria (gol = toți)
                <input aria-label="Categoria cotizației" value={rate.categorie} onChange={(e) => setRate({ ...rate, categorie: e.target.value })} />
              </label>
              <label>
                Suma (lei)
                <input aria-label="Suma cotizației" value={rate.suma} onChange={(e) => setRate({ ...rate, suma: e.target.value })} required />
              </label>
              <label>
                Pe
                <select aria-label="Perioada cotizației" value={rate.perioada} onChange={(e) => setRate({ ...rate, perioada: e.target.value })}>
                  <option value="anual">an</option>
                  <option value="lunar">lună</option>
                </select>
              </label>
              <button className="primary" disabled={busy}>
                Adaugă cotizația
              </button>
            </form>
          )}
        </>
      )}

      {tab === "sedinte" && (
        <>
          {meetings.map((m) => (
            <div key={m.id} className="card" data-testid="meeting">
              <h4>
                {ro(m.data)} · {label(MEETING_KINDS, m.fel)} · prezenți {m.prezenti.length} din {m.membri_activi} membri
              </h4>
              {m.ordine_de_zi && <p className="pre">{m.ordine_de_zi}</p>}
              {m.hotarari && (
                <p className="pre">
                  <b>Hotărâri:</b> {m.hotarari}
                </p>
              )}
              <p className="muted">{m.prezenti.map((p) => names.get(p) ?? "").join(", ")}</p>
            </div>
          ))}
          {!meetings.length && <p className="muted">Nicio ședință încă.</p>}
          {!readOnly && (
            <form
              className="card"
              aria-label="Ședința"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await api.moduleCall<{ prezenti: number; membri_activi: number }>(ID, "sedinta_save", meeting);
                  setMeeting({ data: today, fel: "adunare_generala", ordine_de_zi: "", hotarari: "", prezenti: [] });
                  setNotice(`Ședința e salvată: prezenți ${r.prezenti} din ${r.membri_activi} membri. Cvorumul se judecă după statut.`);
                });
              }}
            >
              <h3>Ședință nouă</h3>
              <div className="row">
                <label>
                  Data
                  <input type="date" aria-label="Data ședinței" value={meeting.data} onChange={(e) => setMeeting({ ...meeting, data: e.target.value, prezenti: [] })} />
                </label>
                <label>
                  Felul
                  <select aria-label="Felul ședinței" value={meeting.fel} onChange={(e) => setMeeting({ ...meeting, fel: e.target.value })}>
                    {MEETING_KINDS.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Ordinea de zi
                <textarea aria-label="Ordinea de zi" rows={3} value={meeting.ordine_de_zi} onChange={(e) => setMeeting({ ...meeting, ordine_de_zi: e.target.value })} />
              </label>
              <fieldset aria-label="Prezenți">
                <legend>Prezenți (membrii din ziua ședinței)</legend>
                {members
                  .filter((m) => activeOn(m, meeting.data))
                  .map((m) => (
                    <label key={m.id}>
                      <input
                        type="checkbox"
                        aria-label={`Prezent: ${m.nume}`}
                        checked={meeting.prezenti.includes(m.id)}
                        onChange={(e) => setMeeting({ ...meeting, prezenti: e.target.checked ? [...meeting.prezenti, m.id] : meeting.prezenti.filter((x) => x !== m.id) })}
                      />{" "}
                      {m.nume}
                    </label>
                  ))}
              </fieldset>
              <label>
                Hotărârile
                <textarea aria-label="Hotărârile" rows={3} value={meeting.hotarari} onChange={(e) => setMeeting({ ...meeting, hotarari: e.target.value })} />
              </label>
              <button className="primary" disabled={busy}>
                Salvează ședința
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
