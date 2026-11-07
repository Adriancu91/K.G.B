// Kanban and calendar views of the planner (Etapa 4, step 4.2). Tasks move
// by drag-and-drop or, for the keyboard, with the ← → buttons on each card.
import { useState, type DragEvent } from "react";
import { PRIORITY, Repeats, STATUS, ro, today, type Person, type Task } from "./PlannerPage";

type Status = Task["stare"];
const ORDER: Status[] = ["de_facut", "in_lucru", "blocat", "gata"];
const MIME = "application/x-kgb-task";

interface Actions {
  people: Person[];
  busy: boolean;
  onStatus: (t: Task, s: Status) => void;
  onEdit: (t: Task) => void;
}

function who(people: Person[], id: string | null) {
  return people.find((p) => p.id === id)?.nume ?? "neatribuit";
}

function onDragStart(e: DragEvent, t: Task) {
  e.dataTransfer.setData(MIME, t.id);
  e.dataTransfer.effectAllowed = "move";
}

function dropTarget(onTask: (id: string) => void) {
  return {
    onDragOver: (e: DragEvent) => {
      if (e.dataTransfer.types.includes(MIME)) {
        e.preventDefault();
        e.currentTarget.classList.add("drop");
      }
    },
    onDragLeave: (e: DragEvent) => e.currentTarget.classList.remove("drop"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.currentTarget.classList.remove("drop");
      const id = e.dataTransfer.getData(MIME);
      if (id) onTask(id);
    },
  };
}

export function KanbanView({ tasks, people, busy, onStatus, onEdit }: Actions & { tasks: Task[] }) {
  return (
    <div className="kanban" aria-label="Kanban">
      {ORDER.map((s, i) => {
        const col = tasks.filter((t) => t.stare === s);
        return (
          <section
            key={s}
            className="kanban-col"
            data-stare={s}
            aria-label={STATUS[s]}
            {...dropTarget((id) => {
              const t = tasks.find((x) => x.id === id);
              if (t && t.stare !== s) onStatus(t, s);
            })}
          >
            <h3>
              {STATUS[s]} <span className="muted">({col.length})</span>
            </h3>
            {col.map((t) => (
              <article key={t.id} className={`card task-card${t.intarziat ? " late" : ""}`} draggable={!busy} onDragStart={(e) => onDragStart(e, t)} data-id={t.id}>
                <button className="link" onClick={() => onEdit(t)}>
                  {t.titlu}
                </button>
                {t.repetare && <Repeats text={t.repetare} />}
                <div className="muted small">
                  {who(people, t.responsabil)} · {ro(t.termen)}
                  {t.intarziat && <span className="error"> · întârziat</span>}
                </div>
                <div className="row">
                  <span className={`badge prio-${t.prioritate}`}>{PRIORITY[t.prioritate]}</span>
                  {t.checklist.length > 0 && (
                    <span className="muted small">
                      {t.checklist.filter((c) => c.gata).length}/{t.checklist.length}
                    </span>
                  )}
                  <span className="grow" />
                  <button className="icon" aria-label={`Mută „${t.titlu}” la stânga`} disabled={busy || i === 0} onClick={() => { const to = ORDER[i - 1]; if (to) onStatus(t, to); }}>
                    ←
                  </button>
                  <button className="icon" aria-label={`Mută „${t.titlu}” la dreapta`} disabled={busy || i === ORDER.length - 1} onClick={() => { const to = ORDER[i + 1]; if (to) onStatus(t, to); }}>
                    →
                  </button>
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const DAYS = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday of the week containing `d`. */
const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export function CalendarView({
  tasks,
  people,
  busy,
  onEdit,
  onMoveDate,
  onNew,
}: Actions & { tasks: Task[]; onMoveDate: (t: Task, iso: string) => void; onNew: (iso: string) => void }) {
  const [mode, setMode] = useState<"luna" | "saptamana">("luna");
  const [anchor, setAnchor] = useState(() => new Date());
  const first = mode === "luna" ? monday(new Date(anchor.getFullYear(), anchor.getMonth(), 1)) : monday(anchor);
  const count = mode === "luna" ? 42 : 7;
  const days = Array.from({ length: count }, (_, i) => addDays(first, i));
  const now = today();
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) if (t.termen) byDay.set(t.termen, [...(byDay.get(t.termen) ?? []), t]);
  const noDate = tasks.filter((t) => !t.termen && t.stare !== "gata").length;
  const step = (n: number) =>
    setAnchor((a) => (mode === "luna" ? new Date(a.getFullYear(), a.getMonth() + n, 1) : addDays(a, 7 * n)));
  const title =
    mode === "luna"
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : `${ro(isoOf(first))} – ${ro(isoOf(addDays(first, 6)))}`;

  return (
    <div className="calendar">
      <div className="row wrap">
        <button aria-label="Înapoi" onClick={() => step(-1)}>
          ‹
        </button>
        <button onClick={() => setAnchor(new Date())}>Azi</button>
        <button aria-label="Înainte" onClick={() => step(1)}>
          ›
        </button>
        <h2 className="cal-title">{title}</h2>
        <span className="grow" />
        <div className="sheet-tabs" role="tablist">
          <button role="tab" aria-selected={mode === "luna"} className={mode === "luna" ? "active" : ""} onClick={() => setMode("luna")}>
            Lună
          </button>
          <button role="tab" aria-selected={mode === "saptamana"} className={mode === "saptamana" ? "active" : ""} onClick={() => setMode("saptamana")}>
            Săptămână
          </button>
        </div>
      </div>
      {noDate > 0 && (
        <p className="muted">
          {noDate === 1 ? "Un task deschis nu are termen și nu apare" : `${noDate} taskuri deschise nu au termen și nu apar`} în calendar.
        </p>
      )}
      <div className={`cal-grid ${mode}`}>
        {DAYS.map((d) => (
          <div key={d} className="cal-head">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const iso = isoOf(d);
          const list = byDay.get(iso) ?? [];
          const outside = mode === "luna" && d.getMonth() !== anchor.getMonth();
          return (
            <div
              key={iso}
              className={`cal-day${outside ? " outside" : ""}${iso === now ? " today" : ""}`}
              data-date={iso}
              {...dropTarget((id) => {
                const t = tasks.find((x) => x.id === id);
                if (t && t.termen !== iso) onMoveDate(t, iso);
              })}
            >
              <div className="row">
                <span className="cal-num">{d.getDate()}</span>
                <span className="grow" />
                <button className="icon add" aria-label={`Task nou pe ${ro(iso)}`} disabled={busy} onClick={() => onNew(iso)}>
                  +
                </button>
              </div>
              {list.map((t) => (
                <button
                  key={t.id}
                  className={`cal-task prio-${t.prioritate}${t.stare === "gata" ? " done" : ""}${t.intarziat ? " late" : ""}`}
                  draggable={!busy}
                  onDragStart={(e) => onDragStart(e, t)}
                  onClick={() => onEdit(t)}
                  title={`${t.titlu} — ${who(people, t.responsabil)} · ${STATUS[t.stare]}${t.repetare ? ` · se repetă ${t.repetare}` : ""}`}
                  data-id={t.id}
                >
                  {t.repetare ? "🔁 " : ""}
                  {t.titlu}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
