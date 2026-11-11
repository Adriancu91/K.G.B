// Mentenanța echipamentelor (Etapa 7, step 7.9e): what is due (overdue in red, soon in orange, a counter plan
// without a reading said so), the equipment with its plans, history, readings and costs, and the costs per year.
// What is due is computed by the module, never written; with days and a counter, it says which one decides.
// A read-only role sees everything and changes nothing (the core refuses anyway; the buttons say so first).
import { useCallback, useEffect, useRef, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.maintenance";
const CATEGORIES: Array<[string, string]> = [
  ["utilaj", "Utilaj"],
  ["vehicul", "Vehicul"],
  ["instalatie", "Instalație"],
  ["aparat", "Aparat"],
  ["it", "IT"],
  ["altul", "Altul"],
];
const STATES: Array<[string, string]> = [
  ["functional", "funcțional"],
  ["defect", "defect"],
  ["in_reparatie", "în reparație"],
  ["scos", "scos din uz"],
];
const PLAN_KINDS: Array<[string, string]> = [
  ["preventiv", "preventiv"],
  ["verificare_legala", "verificare legală"],
  ["calibrare", "calibrare"],
];
const WORK_KINDS: Array<[string, string]> = [
  ["planificata", "planificată"],
  ["reparatie", "reparație"],
  ["verificare", "verificare"],
];

interface Due {
  plan: string;
  denumire: string;
  fel: string;
  echipament: string;
  echipament_nume: string;
  categorie: string;
  unitate: string;
  la_zile: number;
  la_contor: number;
  ultima: string;
  urmatoarea_data: string;
  urmatorul_contor: number | null;
  contor_actual: number | null;
  zile_ramase: number | null;
  stare: "depasit" | "curand" | "fara_citire" | "ok";
  din: string;
  partener_nume: string;
}
interface Equipment {
  id: string;
  version: number;
  nume: string;
  cod_inventar: string;
  categorie: string;
  loc: string;
  serie: string;
  model: string;
  producator: string;
  garantie_pana: string;
  contor_unitate: string;
  stare: string;
  responsabil: string;
}
interface Detail extends Equipment {
  planuri: Array<{ id: string; version: number; denumire: string; fel: string; la_zile: number; la_contor: number; activ: boolean; partener_nume: string; scadenta: Due | null }>;
  interventii: Array<{ id: string; version: number; data: string; fel: string; descriere: string; cine: string; cost: number; contor: number; oprire_ore: number; stare: string; plan: string }>;
  citiri: Array<{ id: string; data: string; valoare: number; mai_mica: boolean }>;
  cost_an: number;
  oprire_an: number;
}
interface Costs {
  an: number;
  total: number;
  echipamente: Array<{ echipament: string; nume: string; categorie: string; cost: number; oprire_ore: number; interventii: number; reparatii: number }>;
  categorii: Array<{ categorie: string; cost: number; oprire_ore: number; interventii: number }>;
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
const STATE_TEXT: Record<Due["stare"], string> = { depasit: "depășit", curand: "în curând", fara_citire: "fără citire", ok: "în regulă" };

/** Where a plan's due comes from, in words: „la 12.03.2027” or „la 250 ore”. */
function dueWhen(d: Due): string {
  const byCounter = d.urmatorul_contor !== null ? `la ${d.urmatorul_contor} ${d.unitate}` : "";
  const byDate = d.urmatoarea_data ? `la ${ro(d.urmatoarea_data)}` : "";
  if (d.din === "contor") return byCounter;
  return byDate || byCounter;
}

const blankEq = { nume: "", cod_inventar: "", categorie: "utilaj", loc: "", producator: "", model: "", serie: "", garantie_pana: "", contor_unitate: "", responsabil: "" };
const blankPlan = { denumire: "", fel: "preventiv", la_zile: "", la_contor: "", de_la: "", avertizare_zile: "14", partener_nume: "" };
const blankWork = { plan: "", fel: "planificata", data: "", descriere: "", cine: "", cost: "", contor: "", oprire_ore: "", stare: "facuta" };

export function MaintenancePage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const today = iso(new Date());
  const [tab, setTab] = useState<"scadente" | "echipamente" | "costuri">("scadente");
  const [due, setDue] = useState<Due[]>([]);
  const [list, setList] = useState<Equipment[]>([]);
  const [open, setOpen] = useState<Detail | null>(null);
  const [costs, setCosts] = useState<Costs | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [eq, setEq] = useState(blankEq);
  const [plan, setPlan] = useState(blankPlan);
  const [work, setWork] = useState(blankWork);
  const [reading, setReading] = useState("");
  const [busy, setBusy] = useState(false);
  const openId = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [askWorking, setAskWorking] = useState(false);

  const openEquipment = useCallback(
    async (id: string) => {
      try {
        openId.current = id;
      setOpen(await api.moduleCall<Detail>(ID, "echipament", { id, azi: today }));
      } catch (e) {
        onError(message(e));
      }
    },
    [today, onError],
  );
  const load = useCallback(async () => {
    try {
      const [d, l] = await Promise.all([api.moduleCall<Due[]>(ID, "scadente", { azi: today }), api.moduleCall<Equipment[]>(ID, "echipamente", {})]);
      setDue(d);
      setList(l);
      if (tab === "costuri") setCosts(await api.moduleCall<Costs>(ID, "costuri", { an: year }));
    } catch (e) {
      onError(message(e));
    }
  }, [today, tab, year, onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
    await load();
    // The card shown now (a save may have opened another one meanwhile).
    if (openId.current) await openEquipment(openId.current);
  };

  /** „Marchează făcută” from the due list: the equipment opens with the intervention ready. */
  const markDone = async (d: Due) => {
    setTab("echipamente");
    await openEquipment(d.echipament);
    setWork({ ...blankWork, plan: d.plan, descriere: d.denumire, data: today, cine: d.partener_nume });
  };

  const overdue = due.filter((d) => d.stare === "depasit").length;

  return (
    <section className="maintenance">
      {readOnly && <p className="warn">Rolul tău poate doar citi mentenanța: nu poate schimba nimic.</p>}
      <div className="sheet-tabs" role="tablist" aria-label="Vederea">
        {(
          [
            ["scadente", overdue ? `Scadențe (${overdue} depășite)` : "Scadențe"],
            ["echipamente", "Echipamente"],
            ["costuri", "Costuri pe an"],
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

      {tab === "scadente" && (
        <table className="audit">
          <tbody>
            {due.length === 0 && (
              <tr>
                <td className="muted">Niciun plan de mentenanță. Adaugă un echipament și ce i se face periodic, în „Echipamente”.</td>
              </tr>
            )}
            {due.map((d) => (
              <tr key={d.plan} data-testid="due" className={`mnt-${d.stare}`}>
                <td>
                  <strong>{d.echipament_nume}</strong>
                  <div className="small">{d.denumire}</div>
                </td>
                <td className="small">
                  <strong className={`mnt-state-${d.stare}`}>{STATE_TEXT[d.stare]}</strong>
                  {d.stare !== "fara_citire" && <span>{` · ${dueWhen(d)}`}</span>}
                  {d.stare === "fara_citire" && <span className="muted"> · scrie o citire a contorului</span>}
                  {d.contor_actual !== null && d.la_contor > 0 && <div className="muted">{`contorul acum: ${d.contor_actual} ${d.unitate}`}</div>}
                  {d.ultima && <div className="muted">{`ultima: ${ro(d.ultima)}`}</div>}
                </td>
                <td>
                  <button className="small" disabled={busy || readOnly} onClick={() => void markDone(d)}>
                    Marchează făcută
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "echipamente" && (
        <>
          <table className="audit">
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td className="muted">Niciun echipament încă. Adaugă unul mai jos.</td>
                </tr>
              )}
              {list.map((e) => (
                <tr key={e.id} data-testid="equipment">
                  <td>
                    <button className="link" onClick={() => void openEquipment(e.id)}>
                      {e.nume}
                    </button>
                    {e.cod_inventar && <span className="muted small">{` · ${e.cod_inventar}`}</span>}
                  </td>
                  <td className="small">{label(CATEGORIES, e.categorie)}</td>
                  <td className="small">{e.loc}</td>
                  <td className={`small${e.stare === "defect" ? " mnt-state-depasit" : ""}`}>{label(STATES, e.stare)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {open && (
            <div className="contract-card" data-testid="equipment-card">
              <h3>{open.nume}</h3>
              <p className="small">
                <span>{label(CATEGORIES, open.categorie)}</span>
                {open.serie && <span>{` · seria ${open.serie}`}</span>}
                {open.model && <span>{` · ${open.producator} ${open.model}`}</span>}
                {open.loc && <span>{` · ${open.loc}`}</span>}
                {open.garantie_pana && <span>{" "}<span>{`· garanție până la ${ro(open.garantie_pana)}`}</span></span>}
                <span>{` · ${label(STATES, open.stare)}`}</span>
              </p>
              {open.categorie === "vehicul" && <p className="muted small">ITP, RCA, rovinieta: în „Permise și autorizații”.</p>}
              <p className="small">{`Anul acesta: ${lei(open.cost_an)} lei fără TVA, ${open.oprire_an} ore de oprire.`}</p>
              <div className="row wrap">
                {STATES.filter(([k]) => k !== open.stare).map(([k, v]) => (
                  <button key={k} className="small" disabled={busy || readOnly} onClick={() => void run(() => api.moduleCall(ID, "echipament_stare", { id: open.id, version: open.version, stare: k }))}>
                    {`Marchează ${v}`}
                  </button>
                ))}
              </div>
              {askWorking && open.stare !== "functional" && (
                <p className="warn" role="status">
                  <span>Reparația e făcută.</span>{" "}
                  <button
                    className="small"
                    disabled={busy || readOnly}
                    onClick={() =>
                      void run(async () => {
                        await api.moduleCall(ID, "echipament_stare", { id: open.id, version: open.version, stare: "functional" });
                        setAskWorking(false);
                      })
                    }
                  >
                    Îl trec funcțional
                  </button>
                </p>
              )}

              <h4>Ce se face periodic</h4>
              <ul className="plain">
                {open.planuri.length === 0 && <li className="muted small">Niciun plan.</li>}
                {open.planuri.map((p) => (
                  <li key={p.id} data-testid="plan">
                    <strong>{p.denumire}</strong> <span className="small">{label(PLAN_KINDS, p.fel)}</span>
                    {p.la_zile > 0 && <span className="small">{" "}<span>{`· la ${p.la_zile} zile`}</span></span>}
                    {p.la_contor > 0 && <span className="small">{" "}<span>{`· la fiecare ${p.la_contor} ${open.contor_unitate}`}</span></span>}
                    {p.partener_nume && <span className="muted small">{` · ${p.partener_nume}`}</span>}
                    {!p.activ && <span className="muted small"> · oprit</span>}
                    {p.scadenta && (
                      <span className={`small mnt-state-${p.scadenta.stare}`}>
                        {` · ${STATE_TEXT[p.scadenta.stare]}`}
                        {p.scadenta.stare !== "fara_citire" && ` ${dueWhen(p.scadenta)}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <form
                className="row wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await api.moduleCall(ID, "plan_save", {
                      echipament: open.id,
                      denumire: plan.denumire,
                      fel: plan.fel,
                      la_zile: Number(plan.la_zile) || 0,
                      la_contor: Number(plan.la_contor) || 0,
                      de_la: plan.de_la || today,
                      avertizare_zile: Number(plan.avertizare_zile) || 0,
                      partener_nume: plan.partener_nume,
                    });
                    setPlan(blankPlan);
                  });
                }}
              >
                <input aria-label="Denumirea planului" placeholder="Ce se face (Revizie anuală, Schimb ulei)" value={plan.denumire} onChange={(e) => setPlan({ ...plan, denumire: e.target.value })} required />
                <select aria-label="Felul planului" value={plan.fel} onChange={(e) => setPlan({ ...plan, fel: e.target.value })}>
                  {PLAN_KINDS.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <label className="small">
                  la <input aria-label="La câte zile" type="number" min={0} max={3650} value={plan.la_zile} onChange={(e) => setPlan({ ...plan, la_zile: e.target.value })} /> zile
                </label>
                {open.contor_unitate && (
                  <label className="small">
                    și/sau la <input aria-label="La cât contor" type="number" min={0} value={plan.la_contor} onChange={(e) => setPlan({ ...plan, la_contor: e.target.value })} /> {open.contor_unitate}
                  </label>
                )}
                <label className="small">
                  de la <input aria-label="Numărat de la" type="date" value={plan.de_la || today} onChange={(e) => setPlan({ ...plan, de_la: e.target.value })} />
                </label>
                <input aria-label="Firma de service" placeholder="Cine o face (firmă, tehnician)" value={plan.partener_nume} onChange={(e) => setPlan({ ...plan, partener_nume: e.target.value })} />
                <button disabled={busy || readOnly}>Adaugă planul</button>
              </form>
              {plan.fel === "verificare_legala" && <p className="muted small">Scrie tu ce verificare e și la cât timp: aplicația nu propune termene legale.</p>}

              <h4>Intervenții</h4>
              <form
                className="row wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const cost = toBani(work.cost);
                    if (!Number.isFinite(cost) || cost < 0) throw new Error(`„${work.cost}” nu e o sumă.`);
                    const r = await api.moduleCall<{ propune_functional: boolean }>(ID, "interventie_save", {
                      echipament: open.id,
                      ...(work.plan ? { plan: work.plan } : {}),
                      fel: work.fel,
                      data: work.data || today,
                      descriere: work.descriere,
                      cine: work.cine,
                      cost,
                      contor: work.contor.trim() ? Number(work.contor) : -1,
                      oprire_ore: Number(work.oprire_ore) || 0,
                      stare: work.stare,
                      azi: today,
                    });
                    setAskWorking(r.propune_functional);
                    setWork(blankWork);
                    setNotice("Intervenția e salvată.");
                  });
                }}
              >
                <select aria-label="Planul intervenției" value={work.plan} onChange={(e) => setWork({ ...work, plan: e.target.value, fel: e.target.value ? "planificata" : work.fel })}>
                  <option value="">(fără plan)</option>
                  {open.planuri.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.denumire}
                    </option>
                  ))}
                </select>
                <select aria-label="Felul intervenției" value={work.fel} onChange={(e) => setWork({ ...work, fel: e.target.value })}>
                  {WORK_KINDS.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input aria-label="Data intervenției" type="date" value={work.data || today} onChange={(e) => setWork({ ...work, data: e.target.value })} />
                <input aria-label="Ce s-a făcut" placeholder="Ce s-a făcut" value={work.descriere} onChange={(e) => setWork({ ...work, descriere: e.target.value })} />
                <input aria-label="Cine a făcut-o" placeholder="Cine" value={work.cine} onChange={(e) => setWork({ ...work, cine: e.target.value })} size={12} />
                <input aria-label="Costul fără TVA" placeholder="Cost fără TVA (lei)" value={work.cost} onChange={(e) => setWork({ ...work, cost: e.target.value })} size={10} />
                {open.contor_unitate && <input aria-label="Contorul la intervenție" placeholder={`contor (${open.contor_unitate})`} value={work.contor} onChange={(e) => setWork({ ...work, contor: e.target.value })} size={8} />}
                <input aria-label="Ore de oprire" placeholder="ore de oprire" value={work.oprire_ore} onChange={(e) => setWork({ ...work, oprire_ore: e.target.value })} size={6} />
                <select aria-label="Starea intervenției" value={work.stare} onChange={(e) => setWork({ ...work, stare: e.target.value })}>
                  <option value="facuta">făcută</option>
                  <option value="programata">programată</option>
                </select>
                <button className="primary" disabled={busy || readOnly}>
                  Salvează intervenția
                </button>
              </form>
              <table className="audit">
                <tbody>
                  {open.interventii.map((w) => (
                    <tr key={w.id} data-testid="work">
                      <td>{ro(w.data)}</td>
                      <td className="small">{label(WORK_KINDS, w.fel)}</td>
                      <td>{w.descriere}</td>
                      <td className="small">{w.cine}</td>
                      <td className="small">{w.cost ? `${lei(w.cost)} lei` : ""}</td>
                      <td className="small">{w.oprire_ore ? `${w.oprire_ore} ore oprit` : ""}</td>
                      <td className="small">{w.stare === "facuta" ? "făcută" : w.stare === "programata" ? "programată" : "anulată"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {open.contor_unitate && (
                <>
                  <h4>Contorul</h4>
                  <form
                    className="row wrap"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await api.moduleCall(ID, "citire_save", { echipament: open.id, data: today, valoare: Number(reading) });
                        setReading("");
                      });
                    }}
                  >
                    <input aria-label="Citirea de azi" placeholder={`citirea de azi (${open.contor_unitate})`} value={reading} onChange={(e) => setReading(e.target.value)} size={10} required />
                    <button disabled={busy || readOnly}>Salvează citirea</button>
                  </form>
                  <ul className="plain small">
                    {open.citiri.slice(-10).map((c) => (
                      <li key={c.id} className={c.mai_mica ? "mnt-state-depasit" : ""}>
                        {`${ro(c.data)}: ${c.valoare} ${open.contor_unitate}`}
                        {c.mai_mica && <strong> · citire mai mică decât înainte</strong>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <h3>Echipament nou</h3>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api.moduleCall<{ id: string }>(ID, "echipament_save", eq);
                setEq(blankEq);
                await openEquipment(r.id);
              });
            }}
          >
            <input aria-label="Numele echipamentului" placeholder="Nume (Stivuitor 2, Centrala termică)" value={eq.nume} onChange={(e) => setEq({ ...eq, nume: e.target.value })} required />
            <select aria-label="Categoria echipamentului" value={eq.categorie} onChange={(e) => setEq({ ...eq, categorie: e.target.value })}>
              {CATEGORIES.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input aria-label="Codul de inventar" placeholder="Cod inventar" value={eq.cod_inventar} onChange={(e) => setEq({ ...eq, cod_inventar: e.target.value })} size={10} />
            <input aria-label="Seria" placeholder={eq.categorie === "vehicul" ? "Nr. înmatriculare" : "Seria"} value={eq.serie} onChange={(e) => setEq({ ...eq, serie: e.target.value })} size={12} />
            <input aria-label="Locul" placeholder="Loc" value={eq.loc} onChange={(e) => setEq({ ...eq, loc: e.target.value })} size={12} />
            <select aria-label="Contorul" value={eq.contor_unitate} onChange={(e) => setEq({ ...eq, contor_unitate: e.target.value })}>
              <option value="">fără contor</option>
              <option value="ore">contor în ore</option>
              <option value="km">contor în km</option>
              <option value="cicluri">contor în cicluri</option>
            </select>
            <label className="small">
              garanție până la <input aria-label="Garanția până la" type="date" value={eq.garantie_pana} onChange={(e) => setEq({ ...eq, garantie_pana: e.target.value })} />
            </label>
            <button className="primary" disabled={busy || readOnly}>
              Adaugă echipamentul
            </button>
          </form>
        </>
      )}

      {tab === "costuri" && (
        <>
          <label className="small">
            anul <input aria-label="Anul" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
          </label>
          {costs && (
            <>
              <p>{`Total: ${lei(costs.total)} lei fără TVA`}</p>
              <table className="audit" data-testid="costs">
                <tbody>
                  {costs.echipamente.length === 0 && (
                    <tr>
                      <td className="muted">Nicio intervenție făcută în acest an.</td>
                    </tr>
                  )}
                  {costs.echipamente.map((r) => (
                    <tr key={r.echipament}>
                      <td>{r.nume}</td>
                      <td className="small">{label(CATEGORIES, r.categorie)}</td>
                      <td>{`${lei(r.cost)} lei`}</td>
                      <td className="small">{`${r.interventii} intervenții, din care ${r.reparatii} reparații`}</td>
                      <td className="small">{`${r.oprire_ore} ore de oprire`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
