// „Echipa pe scurt” (Etapa 7, step 7.4h; D-064): for administrators, every
// member with initials, whether K.G.B. is open on their PC now or when it was
// last, what they say they work on, and their tasks "în lucru" in the
// Planner. Every member sees here exactly what is shown about them. Nothing
// about screens, windows or location is ever recorded.
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { api, message, type ModulesReply } from "../api";

interface Card {
  dispozitiv: string;
  membru: string;
  nume: string;
  initiale: string;
  culoare: string;
  lucrez: string;
  vazut_ms: number;
  activ: boolean;
}
interface Reply {
  admin: boolean;
  carduri: Card[];
  eu: Card | null;
  culori: string[];
  organizatie: boolean;
}
interface Task {
  id: string;
  titlu: string;
  responsabil: string | null;
}
interface Person {
  id: string;
  nume: string;
}

const COLOR_NAMES: Record<string, string> = { grafit: "grafit", otel: "oțel", nisip: "nisip", masliniu: "măsliniu", caramiziu: "cărămiziu", violet: "violet" };
const fold = (s: string) => s.toLowerCase().replace(/[ăâ]/g, "a").replace(/î/g, "i").replace(/[șş]/g, "s").replace(/[țţ]/g, "t").trim();
const seen = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return d.toDateString() === new Date().toDateString() ? `azi la ${time}` : `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} la ${time}`;
};

function MemberCard({ c, tasks }: { c: Card; tasks: Task[] | null }) {
  return (
    <article className="member-card" data-member={c.nume}>
      <span className={`avatar c-${c.culoare}`} aria-hidden="true">
        {c.initiale}
      </span>
      <div className="member-body">
        <strong>{c.nume}</strong>
        <span className={c.activ ? "tag ok" : "tag"}>{c.activ ? "activ acum" : `văzut ultima dată ${seen(c.vazut_ms)}`}</span>
        <p className="small">{c.lucrez ? `La ce lucrez: ${c.lucrez}` : <span className="muted">Nu a scris la ce lucrează.</span>}</p>
        {tasks && tasks.length > 0 && (
          <ul className="plain small">
            {tasks.map((t) => (
              <li key={t.id}>în lucru: {t.titlu}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export function TeamOverviewPage({ modules, onError }: { modules: ModulesReply; onError: (e: string | null) => void }) {
  const [r, setR] = useState<Reply | null>(null);
  const [lucrez, setLucrez] = useState("");
  const [culoare, setCuloare] = useState("grafit");
  const [saved, setSaved] = useState(false);
  const [byName, setByName] = useState<Record<string, Task[]> | null>(null);

  const load = useCallback(async () => {
    try {
      const x = await invoke<Reply>("team_overview");
      setR(x);
      if (x.eu) {
        setLucrez(x.eu.lucrez);
        setCuloare(x.eu.culoare || "grafit");
      }
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Tasks "în lucru" from the Planner, matched to people by name.
  const planner = modules.modules.some((m) => m.id === "kgb.planner" && m.enabled) && modules.access["kgb.planner"] !== "niciunul";
  useEffect(() => {
    if (!planner) return;
    void Promise.all([api.moduleCall<Person[]>("kgb.planner", "persons"), api.moduleCall<Task[]>("kgb.planner", "tasks", { stare: "in_lucru" })])
      .then(([people, tasks]) => {
        const out: Record<string, Task[]> = {};
        for (const t of tasks) {
          const p = people.find((x) => x.id === t.responsabil);
          if (p) (out[fold(p.nume)] ??= []).push(t);
        }
        setByName(out);
      })
      .catch(() => setByName({}));
  }, [planner]);
  const tasksOf = (c: Card) => (byName ? (byName[fold(c.nume)] ?? []) : null);

  if (!r) return <p className="muted">Se încarcă…</p>;
  if (!r.organizatie)
    return <p className="muted">„Echipa pe scurt” apare după ce firma are o organizație cu colegi (pagina „Organizație”).</p>;

  return (
    <section className="team-overview">
      {r.admin ? (
        <>
          <p className="muted">
            Doar administratorii văd această listă. „Activ acum” înseamnă că K.G.B. e deschis pe PC-ul acelui coleg; se vede și ce scrie el că lucrează și
            taskurile lui „în lucru” din Planificator. Nu se urmăresc ecranul, ferestrele, tastatura sau locul.
          </p>
          {r.carduri.length === 0 && <p className="muted">Nimeni încă: colegii apar după prima sincronizare.</p>}
          <div className="member-grid">
            {r.carduri.map((c) => (
              <MemberCard key={c.dispozitiv} c={c} tasks={tasksOf(c)} />
            ))}
          </div>
        </>
      ) : (
        <p className="muted">Lista echipei o văd doar administratorii. Mai jos e exact ce văd ei despre tine.</p>
      )}

      <form
        className="member-self"
        onSubmit={(e) => {
          e.preventDefault();
          void invoke("team_set_mine", { lucrez, culoare }).then(
            () => {
              setSaved(true);
              void load();
            },
            (err) => onError(message(err)),
          );
        }}
      >
        <h3>Ce văd administratorii despre tine</h3>
        {r.eu ? <MemberCard c={r.eu} tasks={tasksOf(r.eu)} /> : <p className="muted">Încă nimic: apare după ce aplicația rulează câteva minute.</p>}
        <label>
          La ce lucrez (scrii tu, cel mult 200 de caractere)
          <input aria-label="La ce lucrez" value={lucrez} maxLength={200} onChange={(e) => (setLucrez(e.target.value), setSaved(false))} />
        </label>
        <label>
          Culoarea pictogramei{" "}
          <select aria-label="Culoarea pictogramei" value={culoare} onChange={(e) => (setCuloare(e.target.value), setSaved(false))}>
            {r.culori.map((c) => (
              <option key={c} value={c}>
                {COLOR_NAMES[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <button className="primary">Salvează</button>
          {saved && <span className="muted small">Salvat.</span>}
        </div>
      </form>
    </section>
  );
}
