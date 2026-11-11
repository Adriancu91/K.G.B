// Programări (Etapa 7, step 7.9e): the day of every resource side by side (or the week), a new appointment chosen
// from the free times, states, and the resources and services. Two PCs offline can book the same time: such
// appointments come marked „suprapusă” (in words, not only in red). A read-only role sees everything and changes
// nothing (the core refuses anyway; the buttons say so first).
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.appointments";
const DAYS: Array<[string, string]> = [
  ["1", "Luni"],
  ["2", "Marți"],
  ["3", "Miercuri"],
  ["4", "Joi"],
  ["5", "Vineri"],
  ["6", "Sâmbătă"],
  ["7", "Duminică"],
];
const STATES: Array<[string, string]> = [
  ["programat", "programat"],
  ["confirmat", "confirmat"],
  ["venit", "a venit"],
  ["anulat", "anulat"],
  ["neprezentat", "nu a venit"],
];
const KINDS: Array<[string, string]> = [
  ["persoana", "Persoană"],
  ["loc", "Loc (sală, masă)"],
  ["echipament", "Echipament"],
];

interface Resource {
  id: string;
  version: number;
  nume: string;
  fel: string;
  program: Record<string, string[]>;
  libere: string[];
  activa: boolean;
  nota: string;
}
interface Service {
  id: string;
  version: number;
  nume: string;
  durata: number;
  pret: number;
  resurse: string[];
}
interface Appointment {
  id: string;
  version: number;
  data: string;
  ora: string;
  sfarsit: string;
  durata: number;
  resursa: string;
  serviciu: string;
  client: string;
  telefon: string;
  nota: string;
  stare: string;
  suprapusa: boolean;
}
interface Day {
  data: string;
  resurse: Array<{ resursa: string; nume: string; activa: boolean; program: string[] }>;
  programari: Appointment[];
}

const z = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const ro = (d: string) => d.split("-").reverse().join(".");
const shift = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return iso(new Date(y!, m! - 1, dd! + n));
};
const stateText = (s: string) => STATES.find(([k]) => k === s)?.[1] ?? s;

export function AppointmentsPage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const [tab, setTab] = useState<"zi" | "saptamana" | "resurse">("zi");
  const [date, setDate] = useState(iso(new Date()));
  const [day, setDay] = useState<Day | null>(null);
  const [week, setWeek] = useState<Appointment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ serviciu: "", resursa: "", ora: "", durata: "30", client: "", telefon: "", nota: "", afara: false });
  const [free, setFree] = useState<Array<{ resursa: string; nume: string; ore: string[] }>>([]);
  const [res, setRes] = useState({ nume: "", fel: "persoana", de_la: "08:00", pana_la: "16:00", pauza: "", zile: "12345" });
  const [srv, setSrv] = useState({ nume: "", durata: "30", pret: "" });

  const load = useCallback(async () => {
    try {
      const [r, s, d] = await Promise.all([
        api.moduleCall<Resource[]>(ID, "resurse"),
        api.moduleCall<Service[]>(ID, "servicii"),
        api.moduleCall<Day>(ID, "zi", { data: date }),
      ]);
      setResources(r);
      setServices(s);
      setDay(d);
      if (tab === "saptamana") setWeek((await api.moduleCall<{ programari: Appointment[] }>(ID, "saptamana", { de_la: date })).programari);
    } catch (e) {
      onError(message(e));
    }
  }, [date, tab, onError]);
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
  };
  const duration = form.serviciu ? (services.find((s) => s.id === form.serviciu)?.durata ?? 30) : Number(form.durata) || 30;
  const findFree = () =>
    run(async () => {
      setFree(
        await api.moduleCall(ID, "libere", {
          data: date,
          ...(form.resursa ? { resursa: form.resursa } : {}),
          ...(form.serviciu ? { serviciu: form.serviciu } : { durata: duration }),
        }),
      );
    });
  const resName = (id: string) => resources.find((r) => r.id === id)?.nume ?? "?";
  const srvName = (id: string) => services.find((s) => s.id === id)?.nume ?? "";
  const overlaps = useMemo(() => (day?.programari ?? []).filter((p) => p.suprapusa).length, [day]);

  const Card = ({ p }: { p: Appointment }) => (
    <div className={`appt appt-${p.stare}${p.suprapusa ? " appt-overlap" : ""}`} data-testid="appt">
      <div>
        <strong>
          {p.ora}–{p.sfarsit}
        </strong>{" "}
        {p.client} <span className="muted small">{srvName(p.serviciu)}</span>
      </div>
      <div className="small">
        {stateText(p.stare)}
        {p.suprapusa && <strong className="appt-overlap-text"> · suprapusă</strong>}
        {p.telefon && <span className="muted"> · {p.telefon}</span>}
      </div>
      <div className="row wrap">
        {STATES.filter(([k]) => k !== p.stare).map(([k, label]) => (
          <button
            key={k}
            className="link small"
            disabled={busy || readOnly}
            title={readOnly ? "Rolul tău poate doar citi programările" : undefined}
            onClick={() => void run(() => api.moduleCall(ID, "programare_stare", { id: p.id, version: p.version, stare: k }))}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="appointments">
      {readOnly && <p className="warn">Rolul tău poate doar citi programările: nu le poate schimba.</p>}
      <div className="row wrap">
        <div className="sheet-tabs" role="tablist" aria-label="Vederea">
          {(
            [
              ["zi", "Ziua"],
              ["saptamana", "Săptămâna"],
              ["resurse", "Resurse și servicii"],
            ] as const
          ).map(([k, v]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
              {v}
            </button>
          ))}
        </div>
        <button onClick={() => setDate(shift(date, tab === "saptamana" ? -7 : -1))} aria-label="Înapoi">
          ◀
        </button>
        <input type="date" aria-label="Data" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button onClick={() => setDate(shift(date, tab === "saptamana" ? 7 : 1))} aria-label="Înainte">
          ▶
        </button>
        <button onClick={() => setDate(iso(new Date()))}>Azi</button>
      </div>
      {overlaps > 0 && tab === "zi" && (
        <p className="error" role="status">
          {`${overlaps} programări se suprapun (făcute pe două calculatoare deodată): mută sau anulează una dintre ele.`}
        </p>
      )}

      {tab === "zi" && day && (
        <>
          <div className="appt-day">
            {day.resurse.filter((r) => r.activa || day.programari.some((p) => p.resursa === r.resursa)).map((r) => (
              <div key={r.resursa} className="appt-col">
                <h4>{r.nume}</h4>
                <p className="muted small">{r.program.length ? r.program.join(", ") : "liber azi"}</p>
                {day.programari
                  .filter((p) => p.resursa === r.resursa)
                  .map((p) => (
                    <Card key={p.id} p={p} />
                  ))}
              </div>
            ))}
            {day.resurse.length === 0 && <p className="muted">Adaugă întâi o resursă (un om, o sală, un echipament) în „Resurse și servicii”.</p>}
          </div>

          <h3>Programare nouă</h3>
          <div className="row wrap">
            <select aria-label="Serviciul" value={form.serviciu} onChange={(e) => setForm({ ...form, serviciu: e.target.value, ora: "" })}>
              <option value="">(fără serviciu)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {`${s.nume} (${s.durata} min)`}
                </option>
              ))}
            </select>
            {!form.serviciu && (
              <input aria-label="Durata în minute" type="number" min={5} max={600} value={form.durata} onChange={(e) => setForm({ ...form, durata: e.target.value })} />
            )}
            <select aria-label="Resursa" value={form.resursa} onChange={(e) => setForm({ ...form, resursa: e.target.value, ora: "" })}>
              <option value="">(oricine)</option>
              {resources
                .filter((r) => r.activa)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nume}
                  </option>
                ))}
            </select>
            <button disabled={busy || readOnly} onClick={() => void findFree()}>
              Caută orele libere
            </button>
          </div>
          {free.map((f) => (
            <div key={f.resursa} className="row wrap appt-free" aria-label={`Ore libere: ${f.nume}`}>
              <span className="small">{f.nume}:</span>
              {f.ore.length === 0 && <span className="muted small">nicio oră liberă</span>}
              {f.ore.map((o) => (
                <button
                  key={o}
                  className={form.ora === o && form.resursa === f.resursa ? "primary small" : "small"}
                  onClick={() => setForm({ ...form, ora: o, resursa: f.resursa, afara: false })}
                >
                  {o}
                </button>
              ))}
            </div>
          ))}
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api.moduleCall<{ start: string; sfarsit: string }>(ID, "programare_save", {
                  start: `${date}T${form.ora}`,
                  resursa: form.resursa,
                  ...(form.serviciu ? { serviciu: form.serviciu } : { durata: duration }),
                  client: form.client,
                  telefon: form.telefon,
                  nota: form.nota,
                  in_afara_programului: form.afara,
                });
                setNotice(`Programare făcută: ${ro(date)}, ${form.ora}–${r.sfarsit}, ${resName(form.resursa)}.`);
                setForm({ ...form, ora: "", client: "", telefon: "", nota: "", afara: false });
                setFree([]);
              });
            }}
          >
            <input aria-label="Ora" placeholder="HH:MM" value={form.ora} onChange={(e) => setForm({ ...form, ora: e.target.value })} size={6} required />
            <input aria-label="Clientul" placeholder="Numele clientului" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} required />
            <input aria-label="Telefonul clientului" placeholder="Telefon" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
            <input aria-label="Nota programării" placeholder="Notă" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
            <label className="small">
              <input type="checkbox" checked={form.afara} onChange={(e) => setForm({ ...form, afara: e.target.checked })} /> în afara programului
            </label>
            <button className="primary" disabled={busy || readOnly || !form.resursa}>
              Programează
            </button>
          </form>
        </>
      )}

      {tab === "saptamana" && (
        <table className="audit">
          <tbody>
            {week.length === 0 && (
              <tr>
                <td className="muted">{`Nicio programare între ${ro(date)} și ${ro(shift(date, 6))}.`}</td>
              </tr>
            )}
            {week.map((p) => (
              <tr key={p.id} className={p.suprapusa ? "appt-overlap" : ""}>
                <td>{ro(p.data)}</td>
                <td>
                  {p.ora}–{p.sfarsit}
                </td>
                <td>{resName(p.resursa)}</td>
                <td>{p.client}</td>
                <td>{srvName(p.serviciu)}</td>
                <td>
                  {stateText(p.stare)}
                  {p.suprapusa && <strong className="appt-overlap-text"> · suprapusă</strong>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "resurse" && (
        <>
          <h3>Resurse</h3>
          <ul className="plain">
            {resources.map((r) => (
              <li key={r.id}>
                <strong>{r.nume}</strong>{" "}
                <span className="muted small">
                  {DAYS.filter(([k]) => (r.program[k] ?? []).length)
                    .map(([k, v]) => `${v} ${(r.program[k] ?? []).join(", ")}`)
                    .join(" · ") || "fără program"}
                  {r.activa ? "" : " · inactivă"}
                </span>
              </li>
            ))}
          </ul>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const day = res.pauza ? [`${res.de_la}-${res.pauza.split("-")[0]}`, `${res.pauza.split("-")[1]}-${res.pana_la}`] : [`${res.de_la}-${res.pana_la}`];
                const program = Object.fromEntries(DAYS.map(([k]) => [k, res.zile.includes(k) ? day : []]));
                await api.moduleCall(ID, "resursa_save", { nume: res.nume, fel: res.fel, program });
                setRes({ ...res, nume: "" });
              });
            }}
          >
            <input aria-label="Numele resursei" placeholder="Nume (Dr. Ionescu, Sala 1, Elevator 2)" value={res.nume} onChange={(e) => setRes({ ...res, nume: e.target.value })} required />
            <select aria-label="Felul resursei" value={res.fel} onChange={(e) => setRes({ ...res, fel: e.target.value })}>
              {KINDS.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input aria-label="Începe la" value={res.de_la} onChange={(e) => setRes({ ...res, de_la: e.target.value })} size={5} />
            <input aria-label="Termină la" value={res.pana_la} onChange={(e) => setRes({ ...res, pana_la: e.target.value })} size={5} />
            <input aria-label="Pauza" placeholder="pauză 12:00-13:00" value={res.pauza} onChange={(e) => setRes({ ...res, pauza: e.target.value })} size={12} />
            <input aria-label="Zilele de lucru" title="1 = luni … 7 = duminică" value={res.zile} onChange={(e) => setRes({ ...res, zile: e.target.value })} size={7} />
            <button disabled={busy || readOnly}>Adaugă resursa</button>
          </form>
          <h3>Servicii</h3>
          <ul className="plain">
            {services.map((s) => (
              <li key={s.id}>{`${s.nume} · ${s.durata} min${s.pret ? ` · ${(s.pret / 100).toFixed(2).replace(".", ",")} lei` : ""}`}</li>
            ))}
          </ul>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const pret = srv.pret ? Math.round(Number(srv.pret.replace(/\./g, "").replace(",", ".")) * 100) : 0;
                await api.moduleCall(ID, "serviciu_save", { nume: srv.nume, durata: Number(srv.durata), pret });
                setSrv({ nume: "", durata: "30", pret: "" });
              });
            }}
          >
            <input aria-label="Numele serviciului" placeholder="Serviciu (Consultație, Schimb ulei)" value={srv.nume} onChange={(e) => setSrv({ ...srv, nume: e.target.value })} required />
            <input aria-label="Durata serviciului" type="number" min={5} max={600} value={srv.durata} onChange={(e) => setSrv({ ...srv, durata: e.target.value })} />
            <input aria-label="Prețul serviciului" placeholder="Preț (lei)" value={srv.pret} onChange={(e) => setSrv({ ...srv, pret: e.target.value })} size={8} />
            <button disabled={busy || readOnly}>Adaugă serviciul</button>
          </form>
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
