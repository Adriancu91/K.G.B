// Start page (Etapa 4, step 4.10; D-047): panels you can move (drag the
// title, or the ← → buttons) and resize (drag the corner, or the size
// buttons), hide and bring back. The arrangement is saved in the workspace
// settings, so it is there after a restart.
import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { api, message, type AppInfo, type HomePanel, type ModulesReply, type NotificationView, type Settings } from "../api";

const TITLES: Record<string, string> = {
  azi: "De făcut azi",
  notificari: "Notificări necitite",
  documente: "Documente recente",
  module: "Module active",
  despre: "Ce face această versiune",
};
const ALL = Object.keys(TITLES);
const DEFAULT: HomePanel[] = [
  { id: "azi", w: 2, h: 1 },
  { id: "notificari", w: 1, h: 1 },
  { id: "documente", w: 1, h: 1 },
  { id: "module", w: 1, h: 1 },
  { id: "despre", w: 1, h: 1 },
];
const COLS = 3;
const ROWS = 3;
const MIME = "application/x-kgb-panel";

interface Task {
  id: string;
  titlu: string;
  termen: string | null;
  stare: string;
  intarziat?: boolean;
}
interface Doc {
  id: string;
  nume: string;
  model_nume: string;
  creat_ms: number;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ro = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "");

function Content(props: { id: string; info: AppInfo; modules: ModulesReply; onOpen: (id: string) => void; onError: (e: string | null) => void }) {
  const { id, modules } = props;
  const enabled = (m: string) => modules.modules.some((x) => x.id === m && x.enabled);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [notes, setNotes] = useState<NotificationView[] | null>(null);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const { onError } = props;

  useEffect(() => {
    const fail = (e: unknown) => onError(message(e));
    if (id === "azi" && enabled("kgb.planner"))
      api
        .moduleCall<Task[]>("kgb.planner", "tasks", { azi: today(), pana_la: today() })
        .then((t) => setTasks(t.filter((x) => x.stare !== "gata")))
        .catch(fail);
    if (id === "notificari") api.notifications().then((r) => setNotes(r.items.filter((n) => !n.citit_ms))).catch(fail);
    if (id === "documente" && enabled("kgb.docs")) api.moduleCall<Doc[]>("kgb.docs", "generated").then(setDocs).catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, modules]);

  const open = (m: string, label: string) => (
    <button className="link" onClick={() => props.onOpen(m)}>
      {label}
    </button>
  );

  switch (id) {
    case "azi":
      if (!enabled("kgb.planner")) return <p className="muted">Activează Planificatorul din {open("catalog", "Catalog module")}.</p>;
      if (!tasks) return <p className="muted">Se încarcă…</p>;
      return tasks.length === 0 ? (
        <p className="muted">Nimic de făcut azi. {open("kgb.planner", "Deschide Planificatorul")}</p>
      ) : (
        <ul className="plain">
          {tasks.slice(0, 12).map((t) => (
            <li key={t.id}>
              {t.titlu} <span className={t.intarziat ? "error small" : "muted small"}>· {t.intarziat ? `întârziat (${ro(t.termen)})` : "azi"}</span>
            </li>
          ))}
          {tasks.length > 12 && <li className="muted">și încă {tasks.length - 12} — {open("kgb.planner", "toate în Planificator")}</li>}
        </ul>
      );
    case "notificari":
      if (!notes) return <p className="muted">Se încarcă…</p>;
      return notes.length === 0 ? (
        <p className="muted">Nicio notificare necitită.</p>
      ) : (
        <ul className="plain">
          {notes.slice(0, 8).map((n) => (
            <li key={n.id}>
              <strong>{n.titlu}</strong>
              {n.text && <div className="muted small">{n.text}</div>}
            </li>
          ))}
        </ul>
      );
    case "documente":
      if (!enabled("kgb.docs")) return <p className="muted">Activează „Documente și modele” din {open("catalog", "Catalog module")}.</p>;
      if (!docs) return <p className="muted">Se încarcă…</p>;
      return docs.length === 0 ? (
        <p className="muted">Niciun document generat încă. {open("kgb.docs", "Alege un model")}</p>
      ) : (
        <ul className="plain">
          {docs.slice(0, 8).map((d) => (
            <li key={d.id}>
              {d.nume} <span className="muted small">· {d.model_nume}</span>
            </li>
          ))}
        </ul>
      );
    case "module": {
      const on = modules.modules.filter((m) => m.enabled);
      return on.length === 0 ? (
        <p className="muted">Niciun modul activat. Deschide {open("catalog", "Catalogul de module")}.</p>
      ) : (
        <ul className="plain">
          {on.map((m) => (
            <li key={m.id}>
              {open(m.id, m.name)} <span className="muted">({m.records} înregistrări)</span>
            </li>
          ))}
        </ul>
      );
    }
    default:
      return (
        <>
          <ul className="plain">
            <li>Datele stau pe acest PC, fără bază de date și fără cloud; fiecare modul are permisiunile lui.</li>
            <li>Documente: PDF, foi de calcul, extragere de date, modele Word și formulare.</li>
            <li>Organizare: taskuri, Kanban, calendar, repetare, memento-uri, notificări și rapoarte.</li>
          </ul>
          <p className="muted">Sincronizarea între PC-uri și partea de business vin în etapele următoare.</p>
        </>
      );
  }
}

export function Home(props: {
  info: AppInfo;
  modules: ModulesReply;
  settings: Settings;
  onSave: (s: Settings) => void;
  onOpen: (id: string) => void;
  onError: (e: string | null) => void;
}) {
  const panels = props.settings.home.panels;
  const grid = useRef<HTMLDivElement>(null);
  // While resizing, the size shown follows the pointer; it is saved on release.
  const [live, setLive] = useState<{ id: string; w: number; h: number } | null>(null);
  const save = (next: HomePanel[]) => props.onSave({ ...props.settings, home: { panels: next } });
  const move = (i: number, to: number) => {
    if (to < 0 || to >= panels.length || to === i) return;
    const next = [...panels];
    const [p] = next.splice(i, 1);
    if (p) next.splice(to, 0, p);
    save(next);
  };
  const resize = (id: string, w: number, h: number) =>
    save(panels.map((p) => (p.id === id ? { ...p, w: Math.min(COLS, Math.max(1, w)), h: Math.min(ROWS, Math.max(1, h)) } : p)));
  const hidden = ALL.filter((id) => !panels.some((p) => p.id === id));

  const onDrop = (e: DragEvent, target: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drop");
    const id = e.dataTransfer.getData(MIME);
    const from = panels.findIndex((p) => p.id === id);
    if (from >= 0) move(from, target);
  };

  const startResize = (e: ReactPointerEvent, p: HomePanel) => {
    e.preventDefault();
    const el = grid.current;
    if (!el) return;
    const colW = el.clientWidth / COLS;
    const rowH = parseFloat(getComputedStyle(el).gridAutoRows) || 200;
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const { clientX: x0, clientY: y0 } = e;
    let cur = { id: p.id, w: p.w, h: p.h };
    const onMove = (ev: PointerEvent) => {
      cur = {
        id: p.id,
        w: Math.min(COLS, Math.max(1, Math.round((box.width + ev.clientX - x0) / colW))),
        h: Math.min(ROWS, Math.max(1, Math.round((box.height + ev.clientY - y0) / rowH))),
      };
      setLive(cur);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setLive(null);
      if (cur.w !== p.w || cur.h !== p.h) resize(p.id, cur.w, cur.h);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <section className="home">
      <div className="row wrap">
        <p className="grow">
          Bun venit, <strong>{props.info.owner?.display_name}</strong>. Lucrezi în <strong>{props.info.workspace?.name}</strong>.
        </p>
        {hidden.map((id) => (
          <button key={id} className="link" onClick={() => save([...panels, { id, w: 1, h: 1 }])}>
            + {TITLES[id]}
          </button>
        ))}
        <button className="link" onClick={() => save(DEFAULT)}>
          Aranjamentul inițial
        </button>
      </div>
      <p className="muted small">Muți un panou trăgându-l de titlu și îl redimensionezi trăgând colțul din dreapta jos. Aranjamentul se păstrează.</p>
      <div className="panel-grid" ref={grid}>
        {panels.map((p, i) => {
          const size = live?.id === p.id ? live : p;
          return (
            <article
              key={p.id}
              className="card panel"
              data-panel={p.id}
              style={{ gridColumn: `span ${size.w}`, gridRow: `span ${size.h}` }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(MIME)) {
                  e.preventDefault();
                  e.currentTarget.classList.add("drop");
                }
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drop")}
              onDrop={(e) => onDrop(e, i)}
            >
              <header
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MIME, p.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                title="Trage pentru a muta"
              >
                <h3>{TITLES[p.id]}</h3>
                <span className="grow" />
                <button className="icon" aria-label={`Mută „${TITLES[p.id]}” înainte`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                  ←
                </button>
                <button className="icon" aria-label={`Mută „${TITLES[p.id]}” după`} disabled={i === panels.length - 1} onClick={() => move(i, i + 1)}>
                  →
                </button>
                <button className="icon" aria-label={`Lățimea „${TITLES[p.id]}”: ${p.w} din ${COLS}`} title="Lățime" onClick={() => resize(p.id, (p.w % COLS) + 1, p.h)}>
                  ↔
                </button>
                <button className="icon" aria-label={`Înălțimea „${TITLES[p.id]}”: ${p.h} din ${ROWS}`} title="Înălțime" onClick={() => resize(p.id, p.w, (p.h % ROWS) + 1)}>
                  ↕
                </button>
                <button className="icon" aria-label={`Ascunde „${TITLES[p.id]}”`} title="Ascunde" onClick={() => save(panels.filter((x) => x.id !== p.id))}>
                  ×
                </button>
              </header>
              <div className="panel-body">
                <Content id={p.id} info={props.info} modules={props.modules} onOpen={props.onOpen} onError={props.onError} />
              </div>
              <div className="panel-resize" aria-hidden="true" onPointerDown={(e) => startResize(e, p)} title="Trage pentru a redimensiona" />
            </article>
          );
        })}
      </div>
      {panels.length === 0 && <p className="muted">Toate panourile sunt ascunse. Le aduci înapoi cu butoanele de mai sus.</p>}
    </section>
  );
}
