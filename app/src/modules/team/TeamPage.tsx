// Team and timesheet (Etapa 7, step 7.3; Master Plan §6.8; D-064):
// employees, shifts, declared daily hours, overtime, leave with approval and
// a monthly report. Hours are entered by people; nothing is tracked.
import { save } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.team";
const KINDS: Array<[string, string]> = [
  ["odihna", "concediu de odihnă"],
  ["medical", "concediu medical"],
  ["fara_plata", "concediu fără plată"],
  ["alt", "altă absență"],
];

interface Emp {
  id: string;
  version: number;
  nume: string;
  functie: string | null;
  norma_min: number;
  activ: boolean;
}
interface Shift {
  id: string;
  version: number;
  nume: string;
  inceput: string;
  sfarsit: string;
  pauza_min: number;
}
interface Day {
  id: string;
  version: number;
  angajat: string;
  data: string;
  intrare: string;
  iesire: string;
  pauza_min: number;
  lucrat_min: number;
  nota: string | null;
}
interface Leave {
  id: string;
  version: number;
  angajat: string;
  tip: string;
  de_la: string;
  pana_la: string;
  stare: string;
}
interface Row {
  angajat: string;
  nume: string;
  functie: string;
  zile: number;
  lucrat_min: number;
  suplimentar_min: number;
  concediu: Record<string, number>;
}

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const ro = (d: string) => d.split("-").reverse().join(".");
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function TeamPage({ onError }: { onError: (e: string | null) => void }) {
  const [tab, setTab] = useState<"pontaj" | "concedii" | "raport" | "angajati" | "ture">("pontaj");
  const [luna, setLuna] = useState(today().slice(0, 7));
  const [emps, setEmps] = useState<Emp[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ angajat: "", data: today(), intrare: "08:00", iesire: "16:30", pauza_min: "30" });
  const [lv, setLv] = useState({ angajat: "", tip: "odihna", de_la: today(), pana_la: today() });
  const [ne, setNe] = useState({ nume: "", functie: "", ore: "8" });
  const [ns, setNs] = useState({ nume: "", inceput: "08:00", sfarsit: "16:30", pauza_min: "30" });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEmps(await api.moduleCall<Emp[]>(ID, "angajati"));
      setShifts(await api.moduleCall<Shift[]>(ID, "ture"));
      setDays(await api.moduleCall<Day[]>(ID, "pontaj", { luna }));
      setLeaves(await api.moduleCall<Leave[]>(ID, "concedii"));
      setRows(await api.moduleCall<Row[]>(ID, "raport", { luna }));
    } catch (e) {
      onError(message(e));
    }
  }, [luna, onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    }
    await load();
  };
  const name = (id: string) => emps.find((e) => e.id === id)?.nume ?? "—";
  const active = emps.filter((e) => e.activ);

  return (
    <div className="team">
      <p className="muted">
        Orele se introduc de mână: aplicația nu urmărește calculatorul, ecranul sau locația nimănui. Datele sunt personale: le văd doar rolurile cărora
        le dai acces la acest modul.
      </p>
      <div className="sheet-tabs">
        {(
          [
            ["pontaj", "Pontaj"],
            ["concedii", "Concedii"],
            ["raport", "Raport lunar"],
            ["angajati", "Angajați"],
            ["ture", "Ture"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {(tab === "pontaj" || tab === "raport") && (
        <label className="row">
          Luna <input type="month" value={luna} onChange={(e) => setLuna(e.target.value)} aria-label="Luna" />
        </label>
      )}

      {tab === "pontaj" && (
        <>
          {active.length === 0 ? (
            <p className="muted">Adaugă întâi angajații (fila „Angajați”).</p>
          ) : (
            <form
              className="row wrap"
              aria-label="Pontaj nou"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => api.moduleCall(ID, "pontaj_save", { ...form, pauza_min: Number(form.pauza_min) || 0 }));
              }}
            >
              <select value={form.angajat} onChange={(e) => setForm({ ...form, angajat: e.target.value })} required aria-label="Angajatul">
                <option value="">— angajat —</option>
                {active.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nume}
                  </option>
                ))}
              </select>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} aria-label="Ziua" />
              {shifts.length > 0 && (
                <select
                  aria-label="Tura"
                  value=""
                  onChange={(e) => {
                    const s = shifts.find((x) => x.id === e.target.value);
                    if (s) setForm({ ...form, intrare: s.inceput, iesire: s.sfarsit, pauza_min: String(s.pauza_min) });
                  }}
                >
                  <option value="">— tură —</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nume}
                    </option>
                  ))}
                </select>
              )}
              <input value={form.intrare} onChange={(e) => setForm({ ...form, intrare: e.target.value })} aria-label="Intrare" size={5} />
              <input value={form.iesire} onChange={(e) => setForm({ ...form, iesire: e.target.value })} aria-label="Ieșire" size={5} />
              <label className="small">
                pauză (min) <input value={form.pauza_min} onChange={(e) => setForm({ ...form, pauza_min: e.target.value })} aria-label="Pauza" size={3} />
              </label>
              <button type="submit">Pontează</button>
            </form>
          )}
          <table className="audit timesheet-table">
            <thead>
              <tr>
                <th>Ziua</th>
                <th>Angajat</th>
                <th>Intrare</th>
                <th>Ieșire</th>
                <th>Pauză</th>
                <th>Lucrat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.id}>
                  <td>{ro(d.data)}</td>
                  <td>{name(d.angajat)}</td>
                  <td>{d.intrare}</td>
                  <td>{d.iesire}</td>
                  <td className="num">{d.pauza_min} min</td>
                  <td className="num">{hm(d.lucrat_min)}</td>
                  <td>
                    <button className="link danger-text" onClick={() => void run(() => api.moduleCall(ID, "pontaj_delete", { id: d.id, version: d.version }))}>
                      șterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "concedii" && (
        <>
          <form
            className="row wrap"
            aria-label="Cerere de concediu"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api.moduleCall(ID, "concediu_cere", lv));
            }}
          >
            <select value={lv.angajat} onChange={(e) => setLv({ ...lv, angajat: e.target.value })} required aria-label="Angajatul concediului">
              <option value="">— angajat —</option>
              {active.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nume}
                </option>
              ))}
            </select>
            <select value={lv.tip} onChange={(e) => setLv({ ...lv, tip: e.target.value })} aria-label="Tipul concediului">
              {KINDS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <input type="date" value={lv.de_la} onChange={(e) => setLv({ ...lv, de_la: e.target.value })} aria-label="De la" />
            <input type="date" value={lv.pana_la} onChange={(e) => setLv({ ...lv, pana_la: e.target.value })} aria-label="Până la" />
            <button type="submit">Cere concediul</button>
          </form>
          <table className="audit leave-table">
            <thead>
              <tr>
                <th>Angajat</th>
                <th>Tip</th>
                <th>Perioada</th>
                <th>Stare</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td>{name(l.angajat)}</td>
                  <td>{KINDS.find(([k]) => k === l.tip)?.[1]}</td>
                  <td>
                    {ro(l.de_la)} – {ro(l.pana_la)}
                  </td>
                  <td>{l.stare}</td>
                  <td>
                    {l.stare === "cerut" && (
                      <>
                        <button onClick={() => void run(() => api.moduleCall(ID, "concediu_decide", { id: l.id, version: l.version, stare: "aprobat" }))}>Aprobă</button>{" "}
                        <button className="link" onClick={() => void run(() => api.moduleCall(ID, "concediu_decide", { id: l.id, version: l.version, stare: "respins" }))}>
                          respinge
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "raport" && (
        <>
          <table className="audit team-report">
            <thead>
              <tr>
                <th>Angajat</th>
                <th>Zile lucrate</th>
                <th>Ore lucrate</th>
                <th>Ore suplimentare</th>
                {KINDS.map(([k, l]) => (
                  <th key={k}>Zile {l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.angajat}>
                  <td>{r.nume}</td>
                  <td className="num">{r.zile}</td>
                  <td className="num">{hm(r.lucrat_min)}</td>
                  <td className="num">{hm(r.suplimentar_min)}</td>
                  {KINDS.map(([k]) => (
                    <td key={k} className="num">
                      {r.concediu[k] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() =>
              void run(async () => {
                const dest = await save({ defaultPath: `pontaj-${luna}.xlsx`, filters: [{ name: "Excel", extensions: ["xlsx"] }] });
                if (!dest) return;
                await api.moduleCall(ID, "raport_export", { luna, dest, overwrite: true });
                setNotice(`Salvat: ${dest}`);
              })
            }
          >
            Exportă .xlsx…
          </button>
          {notice && <p className="muted small">{notice}</p>}
        </>
      )}

      {tab === "angajati" && (
        <>
          <table className="audit employees-table">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Funcție</th>
                <th>Normă</th>
                <th>Activ</th>
              </tr>
            </thead>
            <tbody>
              {emps.map((e) => (
                <tr key={e.id}>
                  <td>{e.nume}</td>
                  <td>{e.functie ?? "—"}</td>
                  <td className="num">{hm(e.norma_min)}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={e.activ}
                      aria-label={`${e.nume} activ`}
                      onChange={(x) =>
                        void run(() =>
                          api.moduleCall(ID, "angajat_save", { id: e.id, version: e.version, nume: e.nume, functie: e.functie ?? "", norma_min: e.norma_min, activ: x.target.checked }),
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form
            className="row wrap"
            aria-label="Angajat nou"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api.moduleCall(ID, "angajat_save", { nume: ne.nume, functie: ne.functie, norma_min: Math.round(Number(ne.ore.replace(",", ".")) * 60) || 480 });
                setNe({ nume: "", functie: "", ore: "8" });
              });
            }}
          >
            <input placeholder="Nume" value={ne.nume} onChange={(e) => setNe({ ...ne, nume: e.target.value })} required aria-label="Numele angajatului" />
            <input placeholder="Funcție" value={ne.functie} onChange={(e) => setNe({ ...ne, functie: e.target.value })} aria-label="Funcția" />
            <label className="small">
              normă (ore/zi) <input value={ne.ore} onChange={(e) => setNe({ ...ne, ore: e.target.value })} aria-label="Norma" size={3} />
            </label>
            <button type="submit">Adaugă angajatul</button>
          </form>
        </>
      )}

      {tab === "ture" && (
        <>
          <ul>
            {shifts.map((s) => (
              <li key={s.id}>
                {s.nume}: {s.inceput}–{s.sfarsit}, pauză {s.pauza_min} min{" "}
                <button className="link danger-text" onClick={() => void run(() => api.moduleCall(ID, "tura_delete", { id: s.id, version: s.version }))}>
                  șterge
                </button>
              </li>
            ))}
          </ul>
          <form
            className="row wrap"
            aria-label="Tură nouă"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api.moduleCall(ID, "tura_save", { ...ns, pauza_min: Number(ns.pauza_min) || 0 }));
            }}
          >
            <input placeholder="Nume (de ex. Tura 1)" value={ns.nume} onChange={(e) => setNs({ ...ns, nume: e.target.value })} required aria-label="Numele turei" />
            <input value={ns.inceput} onChange={(e) => setNs({ ...ns, inceput: e.target.value })} aria-label="Începutul turei" size={5} />
            <input value={ns.sfarsit} onChange={(e) => setNs({ ...ns, sfarsit: e.target.value })} aria-label="Sfârșitul turei" size={5} />
            <label className="small">
              pauză (min) <input value={ns.pauza_min} onChange={(e) => setNs({ ...ns, pauza_min: e.target.value })} aria-label="Pauza turei" size={3} />
            </label>
            <button type="submit">Adaugă tura</button>
          </form>
        </>
      )}
    </div>
  );
}
