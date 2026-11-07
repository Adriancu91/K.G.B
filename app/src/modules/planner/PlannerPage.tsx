// Interface of the kgb.planner module (Etapa 4, step 4.1): tasks with a
// responsible person, project, due date, priority, status and checklist;
// the team's people and the projects. All data goes through `module_call`.
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";
import { Confirm } from "../../components/Confirm";
import { ReportsView } from "./reports";
import { CalendarView, KanbanView } from "./views";

const ID = "kgb.planner";

export interface Person {
  id: string;
  version: number;
  nume: string;
  rol: string | null;
  email: string | null;
  activ: boolean;
}
export interface Project {
  id: string;
  version: number;
  nume: string;
  descriere: string | null;
  arhivat: boolean;
}
export interface CheckItem {
  text: string;
  gata: boolean;
}
export interface Task {
  id: string;
  version: number;
  titlu: string;
  descriere: string | null;
  responsabil: string | null;
  proiect: string | null;
  termen: string | null;
  prioritate: Priority;
  stare: Status;
  checklist: CheckItem[];
  recurenta?: Rule | null;
  /** Romanian description of the rule, e.g. „lunar”. */
  repetare?: string;
  intarziat?: boolean;
}
export interface Rule {
  frecventa: "zilnic" | "saptamanal" | "lunar" | "anual";
  interval: number;
  zile: number[];
  zi?: number | null;
  pana_la?: string | null;
}
const FREQ: Record<Rule["frecventa"], [string, string]> = {
  zilnic: ["Zilnic", "zile"],
  saptamanal: ["Săptămânal", "săptămâni"],
  lunar: ["Lunar", "luni"],
  anual: ["Anual", "ani"],
};
const WEEKDAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
type Status = "de_facut" | "in_lucru" | "blocat" | "gata";
type Priority = "scazuta" | "normala" | "ridicata" | "urgenta";

export const STATUS: Record<Status, string> = { de_facut: "De făcut", in_lucru: "În lucru", blocat: "Blocat", gata: "Gata" };
export const PRIORITY: Record<Priority, string> = { scazuta: "Scăzută", normala: "Normală", ridicata: "Ridicată", urgenta: "Urgentă" };
const PRIO_CLASS: Record<Priority, string> = { scazuta: "planned", normala: "stable", ridicata: "prio-ridicata", urgenta: "prio-urgenta" };

/** Today on the user's computer, as YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const ro = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "—");

interface Draft {
  id?: string;
  version?: number;
  titlu: string;
  descriere: string;
  responsabil: string;
  proiect: string;
  termen: string;
  prioritate: Priority;
  stare: Status;
  checklist: CheckItem[];
  recurenta: Rule | null;
}
const empty: Draft = { titlu: "", descriere: "", responsabil: "", proiect: "", termen: "", prioritate: "normala", stare: "de_facut", checklist: [], recurenta: null };

export function TaskEditor(props: {
  draft: Draft;
  people: Person[];
  projects: Project[];
  busy: boolean;
  onSave: (d: Draft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(props.draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <div className="overlay" role="presentation" onClick={props.onCancel}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="task-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="task-title">{d.id ? "Modifică taskul" : "Task nou"}</h2>
        <form
          className="task-form"
          onSubmit={(e) => {
            e.preventDefault();
            props.onSave(d);
          }}
        >
          <label>
            Titlu
            <input aria-label="Titlu" value={d.titlu} maxLength={200} onChange={(e) => set("titlu", e.target.value)} autoFocus />
          </label>
          <label>
            Descriere
            <textarea aria-label="Descriere" value={d.descriere} maxLength={4000} rows={3} onChange={(e) => set("descriere", e.target.value)} />
          </label>
          <div className="row wrap">
            <label>
              Responsabil
              <select aria-label="Responsabil" value={d.responsabil} onChange={(e) => set("responsabil", e.target.value)}>
                <option value="">— neatribuit —</option>
                {props.people
                  .filter((p) => p.activ || p.id === d.responsabil)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nume}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Proiect
              <select aria-label="Proiect" value={d.proiect} onChange={(e) => set("proiect", e.target.value)}>
                <option value="">— fără proiect —</option>
                {props.projects
                  .filter((p) => !p.arhivat || p.id === d.proiect)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nume}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Termen
              <input aria-label="Termen" type="date" value={d.termen} onChange={(e) => set("termen", e.target.value)} />
            </label>
            <label>
              Prioritate
              <select aria-label="Prioritate" value={d.prioritate} onChange={(e) => set("prioritate", e.target.value as Priority)}>
                {Object.entries(PRIORITY).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stare
              <select aria-label="Stare" value={d.stare} onChange={(e) => set("stare", e.target.value as Status)}>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Checklist</legend>
            {d.checklist.map((c, i) => (
              <div key={i} className="row">
                <input
                  type="checkbox"
                  aria-label={`Bifat: ${c.text}`}
                  checked={c.gata}
                  onChange={(e) => set("checklist", d.checklist.map((x, j) => (j === i ? { ...x, gata: e.target.checked } : x)))}
                />
                <input
                  aria-label={`Punctul ${i + 1}`}
                  className="grow"
                  value={c.text}
                  maxLength={300}
                  onChange={(e) => set("checklist", d.checklist.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                />
                <button type="button" className="link" onClick={() => set("checklist", d.checklist.filter((_, j) => j !== i))}>
                  Scoate
                </button>
              </div>
            ))}
            <button type="button" className="link" onClick={() => set("checklist", [...d.checklist, { text: "", gata: false }])}>
              + Adaugă un punct
            </button>
          </fieldset>
          <fieldset className="repeat">
            <legend>Se repetă</legend>
            <div className="row wrap">
              <select
                aria-label="Repetare"
                value={d.recurenta?.frecventa ?? ""}
                onChange={(e) => {
                  const f = e.target.value as Rule["frecventa"] | "";
                  set("recurenta", f ? { frecventa: f, interval: d.recurenta?.interval ?? 1, zile: [], pana_la: d.recurenta?.pana_la ?? null } : null);
                }}
              >
                <option value="">Nu se repetă</option>
                {Object.entries(FREQ).map(([k, [label]]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              {d.recurenta && (
                <>
                  <label className="inline">
                    la fiecare
                    <input
                      aria-label="Interval"
                      type="number"
                      min={1}
                      max={366}
                      value={d.recurenta.interval}
                      onChange={(e) => d.recurenta && set("recurenta", { ...d.recurenta, interval: Math.min(366, Math.max(1, Number(e.target.value) || 1)) })}
                    />
                    {FREQ[d.recurenta.frecventa][1]}
                  </label>
                  <label className="inline">
                    până la
                    <input
                      aria-label="Se repetă până la"
                      type="date"
                      value={d.recurenta.pana_la ?? ""}
                      onChange={(e) => d.recurenta && set("recurenta", { ...d.recurenta, pana_la: e.target.value || null })}
                    />
                  </label>
                </>
              )}
            </div>
            {d.recurenta?.frecventa === "saptamanal" && (
              <div className="row wrap" role="group" aria-label="Zilele săptămânii">
                {WEEKDAYS.map((w, i) => (
                  <label key={w} className="check">
                    <input
                      type="checkbox"
                      aria-label={`Ziua ${w}`}
                      checked={d.recurenta?.zile.includes(i + 1) ?? false}
                      onChange={(e) =>
                        d.recurenta &&
                        set("recurenta", {
                          ...d.recurenta,
                          zile: e.target.checked ? [...d.recurenta.zile, i + 1].sort((a, b) => a - b) : d.recurenta.zile.filter((z) => z !== i + 1),
                        })
                      }
                    />{" "}
                    {w}
                  </label>
                ))}
                <span className="muted small">(nicio zi bifată = aceeași zi ca termenul)</span>
              </div>
            )}
            {d.recurenta && (
              <p className={d.termen ? "muted small" : "error small"}>
                {d.termen
                  ? "Când taskul e marcat „Gata”, următorul apare singur, cu checklistul debifat."
                  : "Alege un termen: repetarea pornește de la el."}
              </p>
            )}
          </fieldset>
          <div className="dialog-actions">
            <button type="button" onClick={props.onCancel}>
              Renunță
            </button>
            <button type="submit" className="primary" disabled={props.busy || !d.titlu.trim() || (!!d.recurenta && !d.termen)}>
              Salvează
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** The 🔁 mark on repeating tasks, with the rule as tooltip and screen-reader text. */
export function Repeats({ text }: { text: string }) {
  return (
    <span className="repeats" title={`Se repetă: ${text}`} aria-label={`Se repetă: ${text}`} role="img">
      {" "}
      🔁
    </span>
  );
}

export function PlannerPage({ onError }: { onError: (e: string | null) => void }) {
  const [tab, setTab] = useState<"taskuri" | "persoane" | "proiecte">("taskuri");
  const [view, setView] = useState<"lista" | "kanban" | "calendar" | "rapoarte">("lista");
  const [rev, setRev] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<{ pe_stare: Record<Status, number>; intarziate: number } | null>(null);
  const [filter, setFilter] = useState({ responsabil: "*", stare: "", proiect: "", text: "", intarziate: false });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const args: Record<string, unknown> = { azi: today(), intarziate: filter.intarziate };
      if (filter.responsabil !== "*") args.responsabil = filter.responsabil;
      if (filter.stare) args.stare = filter.stare;
      if (filter.proiect) args.proiect = filter.proiect;
      if (filter.text.trim()) args.text = filter.text;
      const [t, p, pr, s] = await Promise.all([
        api.moduleCall<Task[]>(ID, "tasks", args),
        api.moduleCall<Person[]>(ID, "persons"),
        api.moduleCall<Project[]>(ID, "projects"),
        api.moduleCall<{ pe_stare: Record<Status, number>; intarziate: number }>(ID, "summary", { azi: today() }),
      ]);
      setTasks(t);
      setRev((x) => x + 1);
      setPeople(p);
      setProjects(pr);
      setSummary(s);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [filter, onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    await refresh();
  };

  const reportFilter: Record<string, unknown> = { intarziate: filter.intarziate };
  if (filter.responsabil !== "*") reportFilter.responsabil = filter.responsabil;
  if (filter.stare) reportFilter.stare = filter.stare;
  if (filter.proiect) reportFilter.proiect = filter.proiect;
  if (filter.text.trim()) reportFilter.text = filter.text;

  const name = (id: string | null, list: { id: string; nume: string }[]) => list.find((x) => x.id === id)?.nume ?? "—";
  const draftOf = (t: Task): Draft => ({
    id: t.id,
    version: t.version,
    titlu: t.titlu,
    descriere: t.descriere ?? "",
    responsabil: t.responsabil ?? "",
    proiect: t.proiect ?? "",
    termen: t.termen ?? "",
    prioritate: t.prioritate,
    stare: t.stare,
    checklist: t.checklist,
    recurenta: t.recurenta ?? null,
  });
  const setStatus = (t: Task, stare: Status) => void run(() => api.moduleCall(ID, "task_status", { id: t.id, version: t.version, stare }));
  const moveDate = (t: Task, termen: string) => void save({ ...draftOf(t), termen }, false);

  const save = (d: Draft, close = true) =>
    run(async () => {
      await api.moduleCall(ID, "task_save", {
        ...(d.id ? { id: d.id, version: d.version } : {}),
        titlu: d.titlu,
        descriere: d.descriere,
        responsabil: d.responsabil,
        proiect: d.proiect,
        termen: d.termen,
        prioritate: d.prioritate,
        stare: d.stare,
        checklist: d.checklist,
        recurenta: d.recurenta,
      });
      if (close) setEditing(null);
    });

  return (
    <section className="planner">
      <p className="muted">
        Modul beta. Taskurile se atribuie persoanelor din lista echipei (pe acest calculator; partajarea între PC-uri vine
        în Etapa 6).
      </p>
      <div className="row wrap">
        <div className="sheet-tabs" role="tablist">
          {(["taskuri", "persoane", "proiecte"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t === "taskuri" ? "Taskuri" : t === "persoane" ? `Persoane (${people.length})` : `Proiecte (${projects.length})`}
            </button>
          ))}
        </div>
        {summary && (
          <span className="planner-summary">
            {(Object.keys(STATUS) as Status[]).map((s) => (
              <span key={s} className="badge">
                {STATUS[s]}: {summary.pe_stare[s]}
              </span>
            ))}
            <span className={`badge ${summary.intarziate ? "disabled" : ""}`}>Întârziate: {summary.intarziate}</span>
          </span>
        )}
      </div>

      {tab === "taskuri" && (
        <>
          <div className="row wrap filters">
            <button className="primary" disabled={busy} onClick={() => setEditing({ ...empty })}>
              + Task nou
            </button>
            <select aria-label="Filtru responsabil" value={filter.responsabil} onChange={(e) => setFilter({ ...filter, responsabil: e.target.value })}>
              <option value="*">Toate persoanele</option>
              <option value="">Neatribuite</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nume}
                </option>
              ))}
            </select>
            <select aria-label="Filtru stare" value={filter.stare} onChange={(e) => setFilter({ ...filter, stare: e.target.value })}>
              <option value="">Toate stările</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select aria-label="Filtru proiect" value={filter.proiect} onChange={(e) => setFilter({ ...filter, proiect: e.target.value })}>
              <option value="">Toate proiectele</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nume}
                </option>
              ))}
            </select>
            <input aria-label="Caută" placeholder="Caută în titlu și descriere…" value={filter.text} onChange={(e) => setFilter({ ...filter, text: e.target.value })} />
            <label className="check">
              <input type="checkbox" checked={filter.intarziate} onChange={(e) => setFilter({ ...filter, intarziate: e.target.checked })} /> Doar
              întârziate
            </label>
            <span className="grow" />
            <div className="sheet-tabs" role="tablist" aria-label="Vedere">
              {(["lista", "kanban", "calendar", "rapoarte"] as const).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
                  {v === "lista" ? "Listă" : v === "kanban" ? "Kanban" : v === "calendar" ? "Calendar" : "Rapoarte"}
                </button>
              ))}
            </div>
          </div>
          {view === "rapoarte" && <ReportsView azi={today()} filtru={reportFilter} version={rev} onError={onError} />}
          {view === "kanban" && <KanbanView tasks={tasks} people={people} busy={busy} onStatus={setStatus} onEdit={(t) => setEditing(draftOf(t))} />}
          {view === "calendar" && (
            <CalendarView
              tasks={tasks}
              people={people}
              busy={busy}
              onStatus={setStatus}
              onEdit={(t) => setEditing(draftOf(t))}
              onMoveDate={moveDate}
              onNew={(iso) => setEditing({ ...empty, termen: iso })}
            />
          )}
          {view === "lista" && (
          <table className="audit tasks">
            <thead>
              <tr>
                <th>Task</th>
                <th>Responsabil</th>
                <th>Proiect</th>
                <th>Termen</th>
                <th>Prioritate</th>
                <th>Checklist</th>
                <th>Stare</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    Niciun task pentru filtrele alese.
                  </td>
                </tr>
              )}
              {tasks.map((t) => (
                <tr key={t.id} className={t.stare === "gata" ? "done" : ""}>
                  <td>
                    <button
                      className="link"
                      onClick={() => setEditing(draftOf(t))}
                    >
                      {t.titlu}
                    </button>
                    {t.repetare && <Repeats text={t.repetare} />}
                  </td>
                  <td>{name(t.responsabil, people)}</td>
                  <td>{name(t.proiect, projects)}</td>
                  <td className={t.intarziat ? "error" : ""}>
                    {ro(t.termen)}
                    {t.intarziat && " · întârziat"}
                  </td>
                  <td>
                    <span className={`badge ${PRIO_CLASS[t.prioritate]}`}>{PRIORITY[t.prioritate]}</span>
                  </td>
                  <td>{t.checklist.length ? `${t.checklist.filter((c) => c.gata).length}/${t.checklist.length}` : "—"}</td>
                  <td>
                    <select
                      aria-label={`Starea: ${t.titlu}`}
                      value={t.stare}
                      disabled={busy}
                      onChange={(e) => void run(() => api.moduleCall(ID, "task_status", { id: t.id, version: t.version, stare: e.target.value }))}
                    >
                      {Object.entries(STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="danger-text" aria-label={`Șterge ${t.titlu}`} onClick={() => setToDelete(t)}>
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </>
      )}

      {tab === "persoane" && (
        <>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              if (!personName.trim()) return;
              void run(async () => {
                await api.moduleCall(ID, "person_save", { nume: personName, rol: personRole });
                setPersonName("");
                setPersonRole("");
              });
            }}
          >
            <input aria-label="Nume persoană" placeholder="Nume și prenume" value={personName} maxLength={100} onChange={(e) => setPersonName(e.target.value)} />
            <input aria-label="Rol" placeholder="Rol (opțional)" value={personRole} maxLength={100} onChange={(e) => setPersonRole(e.target.value)} />
            <button className="primary" disabled={busy || !personName.trim()}>
              Adaugă persoana
            </button>
          </form>
          <ul className="list">
            {people.map((p) => (
              <li key={p.id} className={p.activ ? "" : "muted"}>
                <span className="grow">
                  <strong>{p.nume}</strong> {p.rol && <span className="muted">· {p.rol}</span>} {!p.activ && <span className="badge">inactivă</span>}
                </span>
                <button className="link" onClick={() => void run(() => api.moduleCall(ID, "person_save", { id: p.id, version: p.version, nume: p.nume, rol: p.rol, email: p.email, activ: !p.activ }))}>
                  {p.activ ? "Marchează inactivă" : "Reactivează"}
                </button>
                <button className="danger-text" onClick={() => void run(() => api.moduleCall(ID, "person_delete", { id: p.id, version: p.version }))}>
                  Șterge
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "proiecte" && (
        <>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              if (!projectName.trim()) return;
              void run(async () => {
                await api.moduleCall(ID, "project_save", { nume: projectName });
                setProjectName("");
              });
            }}
          >
            <input aria-label="Nume proiect" placeholder="Nume proiect" value={projectName} maxLength={150} onChange={(e) => setProjectName(e.target.value)} />
            <button className="primary" disabled={busy || !projectName.trim()}>
              Adaugă proiectul
            </button>
          </form>
          <ul className="list">
            {projects.map((p) => (
              <li key={p.id} className={p.arhivat ? "muted" : ""}>
                <span className="grow">
                  <strong>{p.nume}</strong> {p.arhivat && <span className="badge">arhivat</span>}
                </span>
                <button className="link" onClick={() => void run(() => api.moduleCall(ID, "project_save", { id: p.id, version: p.version, nume: p.nume, descriere: p.descriere, arhivat: !p.arhivat }))}>
                  {p.arhivat ? "Dezarhivează" : "Arhivează"}
                </button>
                <button className="danger-text" onClick={() => void run(() => api.moduleCall(ID, "project_delete", { id: p.id, version: p.version }))}>
                  Șterge
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && <TaskEditor draft={editing} people={people} projects={projects} busy={busy} onSave={(d) => void save(d)} onCancel={() => setEditing(null)} />}
      {toDelete && (
        <Confirm
          title="Ștergi taskul?"
          confirmLabel="Șterge"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() =>
            void run(async () => {
              await api.moduleCall(ID, "task_delete", { id: toDelete.id, version: toDelete.version });
              setToDelete(null);
            })
          }
        >
          „{toDelete.titlu}” dispare din listă. Jurnalul spațiului de lucru îl păstrează (se poate recupera din backup).
        </Confirm>
      )}
    </section>
  );
}
