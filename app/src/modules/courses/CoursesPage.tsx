// Cursuri și cursanți (Etapa 8, step 8.17): the groups with their weekly schedule, one group open with its sessions
// of the month (attendance ticked per session), its trainees with what they owe, paid and the rest, payments taken
// or cancelled with a reason, enrolling and leaving; the trainees; the arrears. Everything owed is computed by the
// module from the schedule, the fee and the payments; the page only shows and asks.
// A read-only role sees everything and changes nothing (the core refuses anyway; the buttons say so first).
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.courses";
const KINDS: Array<[string, string]> = [
  ["curs", "curs"],
  ["grupa", "grupă"],
  ["after_school", "after-school"],
  ["atelier", "atelier"],
];
const DAYS: Array<[number, string]> = [
  [1, "L"],
  [2, "Ma"],
  [3, "Mi"],
  [4, "J"],
  [5, "V"],
  [6, "S"],
  [7, "D"],
];
const PAY: Array<[string, string]> = [
  ["numerar", "numerar"],
  ["card", "card"],
  ["transfer", "transfer"],
];

interface Group {
  id: string;
  version: number;
  nume: string;
  fel: string;
  formator: string;
  sala: string;
  de_la: string;
  pana_la: string;
  zile: number[];
  ora: string;
  durata_min: number;
  capacitate: number;
  taxa_fel: "lunar" | "curs";
  taxa: number;
  activ: boolean;
  nota: string;
  inscrisi: number;
}
interface Payment {
  id: string;
  version: number;
  data: string;
  suma: number;
  fel: string;
  document: string;
  anulata: boolean;
  motiv: string;
}
interface Person {
  inscriere: string;
  version: number;
  cursant: string;
  nume: string;
  tutore: string;
  telefon: string;
  de_la: string;
  pana_la: string;
  stare: "activ" | "retras";
  taxa: number;
  sedinte: number;
  prezent: number;
  datorat: number;
  platit: number;
  rest: number;
  plati: Payment[];
}
interface Session {
  data: string;
  planificata: boolean;
  notata: boolean;
  tinuta: boolean;
  prezenti: string[];
}
interface Detail extends Group {
  cursanti: Person[];
  sedinte_luna: Session[];
}
interface Trainee {
  id: string;
  version: number;
  nume: string;
  telefon: string;
  email: string;
  tutore: string;
  nota: string;
}
interface Arrear {
  inscriere: string;
  grupa: string;
  grupa_nume: string;
  nume: string;
  telefon: string;
  tutore: string;
  datorat: number;
  platit: number;
  rest: number;
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
const dayName = (d: string) => DAYS[(new Date(`${d}T12:00:00`).getDay() + 6) % 7]![1];

const blankGroup = { nume: "", fel: "curs", formator: "", sala: "", de_la: "", pana_la: "", zile: [] as number[], ora: "17:00", durata_min: "60", capacitate: "0", taxa_fel: "lunar", taxa: "", nota: "" };
const blankTrainee = { nume: "", telefon: "", email: "", tutore: "", nota: "" };

export function CoursesPage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const today = iso(new Date());
  const [tab, setTab] = useState<"grupe" | "cursanti" | "restante">("grupe");
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState<Detail | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [arrears, setArrears] = useState<{ total: number; restante: Arrear[] } | null>(null);
  const [group, setGroup] = useState(blankGroup);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [trainee, setTrainee] = useState(blankTrainee);
  const [editTrainee, setEditTrainee] = useState<Trainee | null>(null);
  const [enrol, setEnrol] = useState({ cursant: "", de_la: today, taxa: "" });
  const [session, setSession] = useState<{ data: string; tinuta: boolean; prezenti: string[] } | null>(null);
  const [pay, setPay] = useState<Record<string, { suma: string; fel: string; document: string }>>({});
  const [cancel, setCancel] = useState<Record<string, string>>({});
  const [leaveDay, setLeaveDay] = useState(today);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openGroup = useCallback(
    async (id: string, luna = month) => {
      try {
        setOpen(await api.moduleCall<Detail>(ID, "grupa", { id, azi: today, luna }));
      } catch (e) {
        onError(message(e));
      }
    },
    [month, today, onError],
  );
  const load = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([api.moduleCall<Group[]>(ID, "grupe", { azi: today }), api.moduleCall<Trainee[]>(ID, "cursanti", {})]);
      setGroups(g);
      setTrainees(t);
      if (tab === "restante") setArrears(await api.moduleCall<{ total: number; restante: Arrear[] }>(ID, "restante", { azi: today }));
    } catch (e) {
      onError(message(e));
    }
  }, [tab, today, onError]);
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
    if (open) await openGroup(open.id);
  };

  const saveGroup = () =>
    run(async () => {
      const taxa = toBani(group.taxa);
      if (Number.isNaN(taxa)) throw new Error("taxa e un număr");
      const r = await api.moduleCall<{ id: string }>(ID, "grupa_save", {
        ...(editGroup ? { id: editGroup.id, version: editGroup.version, activ: editGroup.activ } : {}),
        nume: group.nume,
        fel: group.fel,
        formator: group.formator,
        sala: group.sala,
        de_la: group.de_la,
        pana_la: group.pana_la,
        zile: group.zile,
        ora: group.ora,
        durata_min: Number(group.durata_min) || 60,
        capacitate: Number(group.capacitate) || 0,
        taxa_fel: group.taxa_fel,
        taxa,
        nota: group.nota,
      });
      setGroup(blankGroup);
      setEditGroup(null);
      await openGroup(r.id);
    }, "Grupa e salvată.");

  const saveTrainee = () =>
    run(async () => {
      await api.moduleCall(ID, "cursant_save", { ...(editTrainee ? { id: editTrainee.id, version: editTrainee.version } : {}), ...trainee });
      setTrainee(blankTrainee);
      setEditTrainee(null);
    }, "Cursantul e salvat.");

  const pickSession = (s: Session) =>
    setSession({ data: s.data, tinuta: s.tinuta, prezenti: s.notata ? s.prezenti : (open?.cursanti ?? []).filter((p) => p.de_la <= s.data && (!p.pana_la || p.pana_la >= s.data)).map((p) => p.cursant) });

  const activeOn = (d: string) => (open?.cursanti ?? []).filter((p) => p.de_la <= d && (!p.pana_la || p.pana_la >= d));

  return (
    <section className="courses">
      {readOnly && <p className="warn">Rolul tău poate doar citi cursurile: nu poate schimba nimic.</p>}
      <div className="sheet-tabs" role="tablist" aria-label="Vederea">
        {(
          [
            ["grupe", "Grupe"],
            ["cursanti", "Cursanți"],
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

      {tab === "grupe" && (
        <>
          <table className="courses-groups">
            <thead>
              <tr>
                <th>Grupa</th>
                <th>Program</th>
                <th>Perioada</th>
                <th className="num">Înscriși</th>
                <th className="num">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className={open?.id === g.id ? "selected" : g.activ ? "" : "muted"}>
                  <td>
                    <button className="link" onClick={() => void openGroup(g.id)}>
                      {g.nume}
                    </button>
                    {g.formator && <span className="muted"> · {g.formator}</span>}
                  </td>
                  <td>
                    {g.zile.map((d) => DAYS[d - 1]![1]).join(", ")} · {g.ora}
                  </td>
                  <td>
                    {ro(g.de_la)} – {ro(g.pana_la)}
                  </td>
                  <td className="num">
                    {g.inscrisi}
                    {g.capacitate > 0 && ` / ${g.capacitate}`}
                  </td>
                  <td className="num">
                    {lei(g.taxa)} {g.taxa_fel === "lunar" ? "/ lună" : "/ curs"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!groups.length && <p className="muted">Nicio grupă încă. Adaugă prima grupă mai jos.</p>}

          {open && (
            <div className="card courses-group" aria-label="Grupa deschisă">
              <h3>
                {open.nume} · {open.zile.map((d) => DAYS[d - 1]![1]).join(", ")} {open.ora}
              </h3>
              <label>
                Luna
                <input
                  type="month"
                  aria-label="Luna"
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setSession(null);
                    void openGroup(open.id, e.target.value);
                  }}
                />
              </label>
              <div className="courses-sessions" aria-label="Ședințele lunii">
                {open.sedinte_luna.map((s) => (
                  <button
                    key={s.data}
                    className={`${session?.data === s.data ? "active" : ""} ${s.notata ? (s.tinuta ? "done" : "cancelled") : ""}`}
                    title={s.planificata ? "" : "ședință în plus"}
                    onClick={() => pickSession(s)}
                  >
                    {dayName(s.data)} {s.data.slice(8)}
                    {s.notata && (s.tinuta ? ` · ${s.prezenti.length}` : " · anulată")}
                  </button>
                ))}
                {!open.sedinte_luna.length && <span className="muted">Nicio ședință în luna aceasta.</span>}
              </div>
              {session && (
                <fieldset className="courses-attendance" disabled={readOnly} aria-label="Prezența">
                  <legend>Prezența din {ro(session.data)}</legend>
                  <label>
                    <input type="checkbox" checked={session.tinuta} onChange={(e) => setSession({ ...session, tinuta: e.target.checked, prezenti: e.target.checked ? session.prezenti : [] })} /> Ședința s-a ținut
                  </label>
                  {activeOn(session.data).map((p) => (
                    <label key={p.cursant}>
                      <input
                        type="checkbox"
                        aria-label={`Prezent: ${p.nume}`}
                        disabled={!session.tinuta}
                        checked={session.prezenti.includes(p.cursant)}
                        onChange={(e) => setSession({ ...session, prezenti: e.target.checked ? [...session.prezenti, p.cursant] : session.prezenti.filter((x) => x !== p.cursant) })}
                      />{" "}
                      {p.nume}
                    </label>
                  ))}
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const r = await api.moduleCall<{ extra: boolean }>(ID, "prezenta_save", { grupa: open.id, data: session.data, prezenti: session.prezenti, tinuta: session.tinuta });
                        setNotice(r.extra ? "Prezența e salvată (ședință în plus față de program)." : "Prezența e salvată.");
                      })
                    }
                  >
                    Salvează prezența
                  </button>
                </fieldset>
              )}

              <table className="courses-people">
                <thead>
                  <tr>
                    <th>Cursant</th>
                    <th>Înscris</th>
                    <th className="num">Prezență</th>
                    <th className="num">Datorat</th>
                    <th className="num">Plătit</th>
                    <th className="num">Rest</th>
                    <th>Încasare</th>
                  </tr>
                </thead>
                <tbody>
                  {open.cursanti.map((p) => {
                    const f = pay[p.inscriere] ?? { suma: "", fel: "numerar", document: "" };
                    return (
                      <tr key={p.inscriere} className={p.stare === "retras" ? "muted" : ""} data-testid="trainee-row">
                        <td>
                          <b>{p.nume}</b>
                          {p.tutore && <div className="muted">părinte: {p.tutore}</div>}
                          {p.telefon && <div className="muted">{p.telefon}</div>}
                        </td>
                        <td>
                          {ro(p.de_la)}
                          {p.pana_la && ` – ${ro(p.pana_la)}`}
                          {p.stare === "retras" && " (retras)"}
                        </td>
                        <td className="num">
                          {p.prezent} / {p.sedinte}
                        </td>
                        <td className="num">{lei(p.datorat)}</td>
                        <td className="num">{lei(p.platit)}</td>
                        <td className={`num ${p.rest > 0 ? "danger-text" : ""}`}>{lei(p.rest)}</td>
                        <td>
                          {!readOnly && (
                            <span className="row">
                              <input aria-label={`Suma de la ${p.nume}`} className="num" size={7} placeholder="suma" value={f.suma} onChange={(e) => setPay({ ...pay, [p.inscriere]: { ...f, suma: e.target.value } })} />
                              <select aria-label={`Felul plății de la ${p.nume}`} value={f.fel} onChange={(e) => setPay({ ...pay, [p.inscriere]: { ...f, fel: e.target.value } })}>
                                {PAY.map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                              <button
                                disabled={busy || !f.suma.trim()}
                                onClick={() =>
                                  void run(async () => {
                                    const suma = toBani(f.suma);
                                    if (Number.isNaN(suma)) throw new Error("suma e un număr");
                                    await api.moduleCall(ID, "plata_save", { inscriere: p.inscriere, data: today, suma, fel: f.fel, document: f.document });
                                    setPay({ ...pay, [p.inscriere]: { suma: "", fel: "numerar", document: "" } });
                                  }, "Încasarea e trecută.")
                                }
                              >
                                Încasează
                              </button>
                              {p.stare === "activ" && (
                                <button className="link" onClick={() => void run(() => api.moduleCall(ID, "retrage", { id: p.inscriere, version: p.version, data: leaveDay }), `${p.nume} e retras(ă) din grupă.`)}>
                                  retrage
                                </button>
                              )}
                            </span>
                          )}
                          {p.plati.map((x) => (
                            <div key={x.id} className={x.anulata ? "muted strike" : "muted"}>
                              {ro(x.data)} · {lei(x.suma)} · {x.fel}
                              {x.anulata && ` · anulată: ${x.motiv}`}
                              {!x.anulata && !readOnly && (
                                <span>
                                  {" "}
                                  <input aria-label="Motivul anulării plății" size={10} placeholder="motivul" value={cancel[x.id] ?? ""} onChange={(e) => setCancel({ ...cancel, [x.id]: e.target.value })} />
                                  <button className="link danger-text" disabled={(cancel[x.id] ?? "").trim().length < 3} onClick={() => void run(() => api.moduleCall(ID, "plata_anuleaza", { id: x.id, version: x.version, motiv: cancel[x.id] }), "Plata e anulată.")}>
                                    anulează
                                  </button>
                                </span>
                              )}
                            </div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!readOnly && (
                <div className="row">
                  <label>
                    Data retragerii (pentru „retrage”)
                    <input type="date" aria-label="Data retragerii" value={leaveDay} onChange={(e) => setLeaveDay(e.target.value)} />
                  </label>
                </div>
              )}
              {!readOnly && (
                <form
                  className="row"
                  aria-label="Înscrie un cursant"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const taxa = enrol.taxa.trim() ? toBani(enrol.taxa) : -1;
                      if (Number.isNaN(taxa)) throw new Error("taxa e un număr");
                      await api.moduleCall(ID, "inscrie", { grupa: open.id, cursant: enrol.cursant, de_la: enrol.de_la, taxa });
                      setEnrol({ cursant: "", de_la: today, taxa: "" });
                    }, "Cursantul e înscris.");
                  }}
                >
                  <select aria-label="Cursantul de înscris" value={enrol.cursant} onChange={(e) => setEnrol({ ...enrol, cursant: e.target.value })} required>
                    <option value="">— alege cursantul —</option>
                    {trainees.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nume}
                      </option>
                    ))}
                  </select>
                  <input type="date" aria-label="Înscris de la" value={enrol.de_la} onChange={(e) => setEnrol({ ...enrol, de_la: e.target.value })} />
                  <input aria-label="Taxa proprie" placeholder="taxa proprie (gol = a grupei)" value={enrol.taxa} onChange={(e) => setEnrol({ ...enrol, taxa: e.target.value })} />
                  <button className="primary" disabled={busy || !enrol.cursant}>
                    Înscrie
                  </button>
                </form>
              )}
              {!readOnly && (
                <div className="actions">
                  <button
                    onClick={() => {
                      setEditGroup(open);
                      setGroup({
                        nume: open.nume,
                        fel: open.fel,
                        formator: open.formator,
                        sala: open.sala,
                        de_la: open.de_la,
                        pana_la: open.pana_la,
                        zile: open.zile,
                        ora: open.ora,
                        durata_min: String(open.durata_min),
                        capacitate: String(open.capacitate),
                        taxa_fel: open.taxa_fel,
                        taxa: lei(open.taxa),
                        nota: open.nota,
                      });
                    }}
                  >
                    Modifică grupa
                  </button>
                  <button onClick={() => void run(() => api.moduleCall(ID, "grupa_save", { ...open, id: open.id, version: open.version, activ: !open.activ, cursanti: undefined, sedinte_luna: undefined, inscrisi: undefined }))}>
                    {open.activ ? "Marchează inactivă" : "Marchează activă"}
                  </button>
                </div>
              )}
            </div>
          )}

          {!readOnly && (
            <form
              className="card"
              aria-label="Grupa"
              onSubmit={(e) => {
                e.preventDefault();
                void saveGroup();
              }}
            >
              <h3>{editGroup ? `Grupa ${editGroup.nume}` : "Grupă nouă"}</h3>
              <div className="row">
                <label>
                  Numele
                  <input aria-label="Numele grupei" value={group.nume} onChange={(e) => setGroup({ ...group, nume: e.target.value })} required />
                </label>
                <label>
                  Felul
                  <select aria-label="Felul grupei" value={group.fel} onChange={(e) => setGroup({ ...group, fel: e.target.value })}>
                    {KINDS.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Formator
                  <input aria-label="Formatorul" value={group.formator} onChange={(e) => setGroup({ ...group, formator: e.target.value })} />
                </label>
                <label>
                  Sala
                  <input aria-label="Sala" value={group.sala} onChange={(e) => setGroup({ ...group, sala: e.target.value })} />
                </label>
              </div>
              <div className="row">
                <label>
                  De la
                  <input type="date" aria-label="Începutul grupei" value={group.de_la} onChange={(e) => setGroup({ ...group, de_la: e.target.value })} required />
                </label>
                <label>
                  Până la
                  <input type="date" aria-label="Sfârșitul grupei" value={group.pana_la} onChange={(e) => setGroup({ ...group, pana_la: e.target.value })} required />
                </label>
                <label>
                  Ora
                  <input type="time" aria-label="Ora" value={group.ora} onChange={(e) => setGroup({ ...group, ora: e.target.value })} />
                </label>
                <label>
                  Durata (minute)
                  <input aria-label="Durata" inputMode="numeric" value={group.durata_min} onChange={(e) => setGroup({ ...group, durata_min: e.target.value })} />
                </label>
              </div>
              <fieldset className="row" aria-label="Zilele">
                <legend>Zilele</legend>
                {DAYS.map(([d, n]) => (
                  <label key={d}>
                    <input
                      type="checkbox"
                      aria-label={`Ziua ${n}`}
                      checked={group.zile.includes(d)}
                      onChange={(e) => setGroup({ ...group, zile: e.target.checked ? [...group.zile, d] : group.zile.filter((x) => x !== d) })}
                    />{" "}
                    {n}
                  </label>
                ))}
              </fieldset>
              <div className="row">
                <label>
                  Locuri (0 = fără limită)
                  <input aria-label="Locurile" inputMode="numeric" value={group.capacitate} onChange={(e) => setGroup({ ...group, capacitate: e.target.value })} />
                </label>
                <label>
                  Taxa
                  <select aria-label="Felul taxei" value={group.taxa_fel} onChange={(e) => setGroup({ ...group, taxa_fel: e.target.value })}>
                    <option value="lunar">pe lună</option>
                    <option value="curs">pe tot cursul</option>
                  </select>
                </label>
                <label>
                  Suma (lei)
                  <input aria-label="Taxa în lei" value={group.taxa} onChange={(e) => setGroup({ ...group, taxa: e.target.value })} />
                </label>
              </div>
              <div className="actions">
                <button className="primary" disabled={busy}>
                  {editGroup ? "Salvează grupa" : "Adaugă grupa"}
                </button>
                {editGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditGroup(null);
                      setGroup(blankGroup);
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

      {tab === "cursanti" && (
        <>
          <table className="courses-trainees">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Părinte / tutore</th>
                <th>Telefon</th>
                <th>E-mail</th>
              </tr>
            </thead>
            <tbody>
              {trainees.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button
                      className="link"
                      onClick={() => {
                        setEditTrainee(t);
                        setTrainee({ nume: t.nume, telefon: t.telefon, email: t.email, tutore: t.tutore, nota: t.nota });
                      }}
                    >
                      {t.nume}
                    </button>
                  </td>
                  <td>{t.tutore}</td>
                  <td>{t.telefon}</td>
                  <td>{t.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && (
            <form
              className="card"
              aria-label="Cursantul"
              onSubmit={(e) => {
                e.preventDefault();
                void saveTrainee();
              }}
            >
              <h3>{editTrainee ? `Cursantul ${editTrainee.nume}` : "Cursant nou"}</h3>
              <div className="row">
                <label>
                  Numele
                  <input aria-label="Numele cursantului" value={trainee.nume} onChange={(e) => setTrainee({ ...trainee, nume: e.target.value })} required />
                </label>
                <label>
                  Părinte sau tutore (pentru copii)
                  <input aria-label="Părintele sau tutorele" value={trainee.tutore} onChange={(e) => setTrainee({ ...trainee, tutore: e.target.value })} />
                </label>
                <label>
                  Telefon
                  <input aria-label="Telefonul cursantului" value={trainee.telefon} onChange={(e) => setTrainee({ ...trainee, telefon: e.target.value })} />
                </label>
                <label>
                  E-mail
                  <input aria-label="E-mailul cursantului" value={trainee.email} onChange={(e) => setTrainee({ ...trainee, email: e.target.value })} />
                </label>
              </div>
              <p className="muted">Se scriu doar datele de care e nevoie pentru curs; nimic nu pleacă din aplicație.</p>
              <div className="actions">
                <button className="primary" disabled={busy}>
                  {editTrainee ? "Salvează cursantul" : "Adaugă cursantul"}
                </button>
                {editTrainee && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditTrainee(null);
                        setTrainee(blankTrainee);
                      }}
                    >
                      Renunță
                    </button>
                    <button type="button" className="danger" onClick={() => void run(() => api.moduleCall(ID, "cursant_delete", { id: editTrainee.id, version: editTrainee.version }).then(() => setEditTrainee(null)))}>
                      Șterge cursantul
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
            Total de încasat: <b>{lei(arrears.total)} lei</b>
          </p>
          {arrears.restante.length ? (
            <table className="courses-arrears">
              <thead>
                <tr>
                  <th>Cursant</th>
                  <th>Grupa</th>
                  <th>Telefon</th>
                  <th className="num">Datorat</th>
                  <th className="num">Plătit</th>
                  <th className="num">Rest</th>
                </tr>
              </thead>
              <tbody>
                {arrears.restante.map((r) => (
                  <tr key={r.inscriere}>
                    <td>
                      {r.nume}
                      {r.tutore && <span className="muted"> · {r.tutore}</span>}
                    </td>
                    <td>
                      <button
                        className="link"
                        onClick={() => {
                          setTab("grupe");
                          void openGroup(r.grupa);
                        }}
                      >
                        {r.grupa_nume}
                      </button>
                    </td>
                    <td>{r.telefon}</td>
                    <td className="num">{lei(r.datorat)}</td>
                    <td className="num">{lei(r.platit)}</td>
                    <td className="num danger-text">{lei(r.rest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Nicio restanță: toți cursanții sunt la zi.</p>
          )}
        </>
      )}
    </section>
  );
}
