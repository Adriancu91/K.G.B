// Start page as a control centre (Etapa 7, step 7.4d; ideas in
// docs/CERCETARE_CENTRU_CONTROL.md): a band at the top, quick actions,
// money, number tiles that open the right list, one "De rezolvat" list,
// the day's agenda and pages pinned here. Panels are placed freely: drag the
// title to move, drag the right edge, the bottom edge or the corner to resize.
// Horizontal position and width are kept as a share of the page width, so a
// panel never leaves a narrower window; the arrangement is saved in the
// workspace settings. With the keyboard: focus a title, arrows move,
// Shift+arrows resize.
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { api, message, type AppInfo, type HomePanel, type ModulesReply, type NotificationView, type Settings } from "../api";
import { setIntent } from "../intent";
import { useLang } from "../i18n/lang";

const TITLES: Record<string, string> = {
  bani: "Bani",
  cifre: "Pe scurt",
  rezolvat: "De rezolvat",
  azi: "Agenda de azi",
  notificari: "Notificări necitite",
  documente: "Documente recente",
  module: "Module active",
  despre: "Ce face această versiune",
  alerta: "Alertă",
  curs: "Curs BNR",
  vreme: "Vremea",
  media: "Ce se aude acum",
  stiri: "Știri",
  radio: "Radio",
};
const BUILT_IN = Object.keys(TITLES);
const WIDTH = 1000;
const MIN_W = 120;
const MIN_H = 80;
const MAX_H = 2000;
const NARROW = 720;
const HIDDEN_UNTIL = "9999-12-31";

interface NewsFeed {
  stiri: { titlu: string; link: string; ms: number; rezumat: string; sursa: string }[];
  erori: [string, string][];
  surse: number;
}
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
interface AgingRow {
  tip: "de_incasat" | "de_platit";
  id: string;
  eticheta: string;
  partener: string;
  scadenta: string;
  zile_intarziere: number;
  rest: number;
  rest_text: string;
}
interface Aging {
  randuri: AgingRow[];
  rezumat: { tip: string; intervale: { interval: string; suma: number; suma_text: string }[]; total: number; total_text: string }[];
}
interface Account {
  id: string;
  nume: string;
  tip: string;
  sold: number;
}
interface Expiring {
  partener: string;
  denumire: string;
  tip: string;
  numar: string;
  expira: string;
  zile: number;
}
interface Data {
  tasks: Task[] | null;
  notes: NotificationView[] | null;
  docs: Doc[] | null;
  aging: Aging | null;
  accounts: Account[] | null;
  expiring: Expiring[] | null;
}
interface Todo {
  key: string;
  text: string;
  detail: string;
  /** Days late (> 0), due today (0) or days left (< 0). */
  late: number;
  open: () => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ro = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "");
// Money comes from the module in bani (integer); shown with the Romanian separators.
const lei = (bani: number) =>
  (bani / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const state = (late: number) => (late > 0 ? "bad" : late === 0 ? "warn" : "ok");
const when = (late: number) => (late > 0 ? `întârziat ${late} ${late === 1 ? "zi" : "zile"}` : late === 0 ? "azi" : `în ${-late} ${late === -1 ? "zi" : "zile"}`);

/** Loads everything the panels show, once per visit. */
function useData(modules: ModulesReply, onError: (e: string | null) => void): [Data, () => void] {
  const [d, setD] = useState<Data>({ tasks: null, notes: null, docs: null, aging: null, accounts: null, expiring: null });
  const reloadNotes = useCallback(() => {
    api.notifications().then(
      (r) => setD((x) => ({ ...x, notes: r.items.filter((n) => !n.citit_ms) })),
      (e: unknown) => onError(message(e)),
    );
  }, [onError]);
  const on = useCallback((m: string) => modules.modules.some((x) => x.id === m && x.enabled) && modules.access[m] !== "niciunul", [modules]);
  useEffect(() => {
    let live = true;
    const set = (patch: Partial<Data>) => live && setD((x) => ({ ...x, ...patch }));
    const fail = (e: unknown) => live && onError(message(e));
    const t = today();
    if (on("kgb.planner"))
      api
        .moduleCall<Task[]>("kgb.planner", "tasks", { azi: t, pana_la: t })
        .then((r) => set({ tasks: r.filter((x) => x.stare !== "gata") }))
        .catch(fail);
    api.notifications().then((r) => set({ notes: r.items.filter((n) => !n.citit_ms) })).catch(fail);
    if (on("kgb.docs")) api.moduleCall<Doc[]>("kgb.docs", "generated").then((docs) => set({ docs })).catch(fail);
    if (on("kgb.business")) {
      api.moduleCall<Aging>("kgb.business", "aging", { azi: t }).then((aging) => set({ aging })).catch(fail);
      api.moduleCall<Account[]>("kgb.business", "accounts").then((accounts) => set({ accounts })).catch(fail);
    }
    invoke<{ expira: Expiring[] }>("partners_list", { cauta: "", inactivi: false, azi: t })
      .then((r) => set({ expiring: r.expira }))
      .catch(() => set({ expiring: [] }));
    return () => {
      live = false;
    };
  }, [on, onError]);
  return [d, reloadNotes];
}

interface Rates {
  curs: { data: string; cursuri: { moneda: string; text: string; multiplicator: number }[] };
  sursa: string;
}
interface Weather {
  vreme: { oras: string; temperatura: number; vant_ms: number; cer: string; minima: number; maxima: number; precipitatii_6h: number; actualizat: string };
  sursa: string;
}
interface Playing {
  aplicatie: string;
  titlu: string;
  artist: string;
  canta: boolean;
}
const deg = (n: number) => `${n.toLocaleString("ro-RO", { maximumFractionDigits: 1 })} °C`;

/** A source switched off: say so and offer the way to it. */
function Off({ err, onOpen }: { err: string; onOpen: (id: string) => void }) {
  return (
    <p className="muted">
      {err}{" "}
      {err.includes("Surse externe") && (
        <button className="link" onClick={() => onOpen("sources")}>
          Deschide „Surse externe”
        </button>
      )}
    </p>
  );
}

/** EUR/RON and USD/RON, with the day of the rate and the source (7.4e). */
function RatesPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [r, setR] = useState<Rates | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    invoke<Rates>("fx_rates").then(setR, (e) => setErr(message(e)));
  }, []);
  if (err) return <Off err={err} onOpen={onOpen} />;
  if (!r) return <p className="muted">Se încarcă…</p>;
  const row = (m: string) => {
    const x = r.curs.cursuri.find((c) => c.moneda === m);
    return x ? (
      <div className="fx-row" key={m}>
        <span className="k">{m}/RON</span>
        <span className="v">{x.text.replace(".", ",")}</span>
      </div>
    ) : null;
  };
  return (
    <div className="fx">
      {row("EUR")}
      {row("USD")}
      <p className="muted small">
        Cursul din {ro(r.curs.data)}. {r.sursa}.
      </p>
    </div>
  );
}

/** Today's weather in the chosen town (7.4e). */
function WeatherPanel({ town, onTown, onOpen }: { town: string; onTown: (t: string) => void; onOpen: (id: string) => void }) {
  const [towns, setTowns] = useState<[string, string][]>([]);
  const [w, setW] = useState<Weather | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    invoke<[string, string][]>("weather_towns").then(setTowns, () => setTowns([]));
  }, []);
  useEffect(() => {
    if (!town) return;
    setW(null);
    setErr(null);
    invoke<Weather>("weather_today", { azi: today(), offsetMin: -new Date().getTimezoneOffset() }).then(setW, (e) => setErr(message(e)));
  }, [town]);
  const picker = (
    <select aria-label="Orașul pentru vreme" value={town} onChange={(e) => onTown(e.target.value)}>
      <option value="">alege orașul…</option>
      {towns.map(([k, n]) => (
        <option key={k} value={k}>
          {n}
        </option>
      ))}
    </select>
  );
  if (!town) return <div className="weather">{picker}</div>;
  return (
    <div className="weather">
      {err && <Off err={err} onOpen={onOpen} />}
      {!err && !w && <p className="muted">Se încarcă…</p>}
      {w && (
        <>
          <div className="wx-now">
            <span className="v">{deg(w.vreme.temperatura)}</span>
            <span>{w.vreme.cer}</span>
          </div>
          <p className="small">
            Azi între {deg(w.vreme.minima)} și {deg(w.vreme.maxima)} · vânt {w.vreme.vant_ms.toLocaleString("ro-RO")} m/s
            {w.vreme.precipitatii_6h > 0 ? ` · ${w.vreme.precipitatii_6h.toLocaleString("ro-RO")} mm în 6 ore` : ""}
          </p>
          <p className="muted small">{w.sursa}.</p>
        </>
      )}
      {picker}
    </div>
  );
}

/** The latest headlines of the approved news sources (InfoNews, 8.18); a title opens the item in the computer's browser. */
function NewsPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [f, setF] = useState<NewsFeed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    invoke<NewsFeed>("news_feed").then(setF, (e) => setErr(message(e)));
  }, []);
  const go = (url: string) => void invoke("news_open", { url }).catch((e: unknown) => setErr(message(e)));
  if (err) return <Off err={err} onOpen={onOpen} />;
  if (!f) return <p className="muted">Se încarcă…</p>;
  if (f.surse === 0)
    return (
      <p className="muted">
        Nicio sursă de știri pornită.{" "}
        <button className="link" onClick={() => onOpen("sources")}>
          Pornește una din „Surse externe”
        </button>
      </p>
    );
  return (
    <div className="home-news">
      <ul>
        {f.stiri.slice(0, 8).map((i) => (
          <li key={i.link || i.titlu}>
            {i.link ? (
              <button className="link" onClick={() => go(i.link)} title={i.rezumat}>
                {i.titlu}
              </button>
            ) : (
              <span>{i.titlu}</span>
            )}
            <span className="muted small">
              {" "}
              · {i.sursa}
              {i.ms ? ` · ${new Date(i.ms).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {f.stiri.length === 0 && <p className="muted">Nicio știre deocamdată.</p>}
      {f.erori.length > 0 && <p className="muted small">Nu s-au putut citi: {f.erori.map(([n]) => n).join(", ")}.</p>}
      <button className="link small" onClick={() => onOpen("kgb.news")}>
        Toate știrile
      </button>
    </div>
  );
}

interface Station {
  stationuuid: string;
  name: string;
  tags: string;
  codec: string;
  bitrate: number;
  countrycode: string;
}

/** Free internet radio from the public Radio Browser directory (8.19, D-098): search, play, stop, volume. */
function RadioPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [list, setList] = useState<Station[] | null>(null);
  const [now, setNow] = useState<Station | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [vol, setVol] = useState(() => {
    try {
      return Number(localStorage.getItem("kgb.radio.volum") ?? "0.6") || 0.6;
    } catch {
      return 0.6;
    }
  });
  useEffect(() => {
    invoke<Station | null>("radio_now").then(setNow, () => setNow(null));
  }, []);
  const search = (name: string) => {
    setErr(null);
    invoke<Station[]>("radio_search", { nume: name, tara: name ? "" : "RO" }).then(setList, (e) => setErr(message(e)));
  };
  const play = (s: Station) => invoke<Station>("radio_play", { id: s.stationuuid, volum: vol }).then(setNow, (e) => setErr(message(e)));
  const stop = () => invoke("radio_stop").then(() => setNow(null), (e) => setErr(message(e)));
  const volume = (v: number) => {
    setVol(v);
    try {
      localStorage.setItem("kgb.radio.volum", String(v));
    } catch {
      /* the volume is only remembered when storage works */
    }
    void invoke("radio_volume", { volum: v });
  };
  return (
    <div className="radio">
      {now && (
        <div className="row wrap radio-now">
          <strong>▶ {now.name}</strong>
          <button onClick={() => void stop()}>Oprește</button>
          <input type="range" min={0} max={1} step={0.05} value={vol} aria-label="Volumul radioului" onChange={(e) => volume(Number(e.target.value))} />
        </div>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          search(q.trim());
        }}
      >
        <input aria-label="Caută un post de radio" placeholder="numele postului" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit">Caută</button>
        <button type="button" onClick={() => search("")}>
          Posturi din România
        </button>
      </form>
      {err && <Off err={err} onOpen={onOpen} />}
      {list && list.length === 0 && <p className="muted">Niciun post găsit.</p>}
      {list && list.length > 0 && (
        <ul className="radio-list">
          {list.map((s) => (
            <li key={s.stationuuid}>
              <button className="link" onClick={() => void play(s)}>
                {s.name}
              </button>
              <span className="muted small">
                {" "}
                · {[s.countrycode, s.codec, s.bitrate ? `${s.bitrate} kbps` : ""].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Posturi care transmit gratuit pe internet, din catalogul public Radio Browser.</p>
    </div>
  );
}

/** The player in Windows' media controls (Spotify or any other), 7.4e. */
function MediaPanel() {
  const [m, setM] = useState<Playing | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => invoke<Playing | null>("media_now").then(setM, (e) => setErr(message(e))), []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);
  const act = (action: string) => invoke("media_control", { action }).then(() => setTimeout(() => void load(), 400), (e) => setErr(message(e)));
  if (err) return <p className="muted">{err}</p>;
  if (m === undefined) return <p className="muted">Se încarcă…</p>;
  if (!m) return <p className="muted">Nu cântă nimic pe acest PC. Pornește Spotify sau alt player și apare aici.</p>;
  return (
    <div className="media">
      <div className="media-now">
        <strong>{m.titlu || "—"}</strong>
        <span className="muted">{m.artist}</span>
        <span className="muted small">{m.aplicatie}</span>
      </div>
      <div className="row">
        <button onClick={() => void act("previous")} aria-label="Melodia anterioară">
          ⏮
        </button>
        <button className="primary" onClick={() => void act("play_pause")} aria-label={m.canta ? "Pauză" : "Pornește"}>
          {m.canta ? "⏸" : "▶"}
        </button>
        <button onClick={() => void act("next")} aria-label="Melodia următoare">
          ⏭
        </button>
      </div>
    </div>
  );
}

function Content(props: {
  id: string;
  data: Data;
  modules: ModulesReply;
  todos: Todo[];
  pageLabel: (id: string) => string | undefined;
  onOpen: (id: string, intent?: string) => void;
  onSnooze: (key: string, until: string) => void;
  town: string;
  onTown: (t: string) => void;
  onRead: (id: string) => void;
}) {
  const { id, data, modules, onOpen } = props;
  const enabled = (m: string) => modules.modules.some((x) => x.id === m && x.enabled);
  const open = (m: string, label: string, intent?: string) => (
    <button className="link" onClick={() => onOpen(m, intent)}>
      {label}
    </button>
  );
  const loading = <p className="muted">Se încarcă…</p>;

  if (id.startsWith("fix:")) {
    const page = id.slice(4);
    const label = props.pageLabel(page);
    return label ? (
      <div className="pinned">
        <p className="muted small">Pagină fixată pe Acasă.</p>
        <button className="primary" onClick={() => onOpen(page)}>
          Deschide „{label}”
        </button>
      </div>
    ) : (
      <p className="muted">Pagina nu mai e disponibilă (modul oprit sau fără acces).</p>
    );
  }

  switch (id) {
    case "curs":
      return <RatesPanel onOpen={onOpen} />;
    case "vreme":
      return <WeatherPanel town={props.town} onTown={props.onTown} onOpen={onOpen} />;
    case "media":
      return <MediaPanel />;
    case "stiri":
      return <NewsPanel onOpen={onOpen} />;
    case "radio":
      return <RadioPanel onOpen={onOpen} />;
    case "alerta": {
      const notes = data.notes;
      if (!notes) return loading;
      const rank = { urgent: 0, atentie: 1, info: 2 } as const;
      const top = [...notes].sort((a, b) => rank[a.nivel] - rank[b.nivel] || b.creat_ms - a.creat_ms)[0];
      if (!top) return <p className="muted">Nicio alertă. Aici apare cea mai importantă notificare necitită.</p>;
      const label = top.nivel === "urgent" ? "urgent" : top.nivel === "atentie" ? "atenție" : "info";
      return (
        <div className="alert-box">
          <span className={`tag ${top.nivel === "urgent" ? "bad" : top.nivel === "atentie" ? "warn" : "ok"}`}>{label}</span>
          <strong>{top.titlu}</strong>
          {top.text && <p className="small">{top.text}</p>}
          <button className="link small" onClick={() => props.onRead(top.id)}>
            Am văzut
          </button>
          {notes.length > 1 && <span className="muted small">încă {notes.length - 1} necitite</span>}
        </div>
      );
    }
    case "bani": {
      if (!enabled("kgb.business")) return <p className="muted">Sumele apar după ce activezi Business din {open("catalog", "Catalog module")}.</p>;
      if (!data.aging || !data.accounts) return loading;
      const sum = (tip: string) => {
        const r = data.aging?.rezumat.find((x) => x.tip === tip);
        const current = r?.intervale[0]?.suma ?? 0;
        return { total: r?.total ?? 0, late: (r?.total ?? 0) - current };
      };
      const inc = sum("de_incasat");
      const plt = sum("de_platit");
      const bal = (tip: string) => (data.accounts ?? []).filter((a) => a.tip === tip).reduce((s, a) => s + a.sold, 0);
      const cell = (label: string, value: number, note: string, intent: string, cls = "") => (
        <button className={`money ${cls}`} onClick={() => onOpen("kgb.business", intent)}>
          <span className="k">{label}</span>
          <span className="v">{lei(value)}</span>
          <span className="s">{note}</span>
        </button>
      );
      return (
        <div className="money-row">
          {cell("De încasat", inc.total, inc.late ? `lei · restant ${lei(inc.late)}` : "lei · nimic restant", "scadentar", inc.late ? "bad" : "")}
          {cell("De plătit", plt.total, plt.late ? `lei · restant ${lei(plt.late)}` : "lei · nimic restant", "scadentar", plt.late ? "warn" : "")}
          {cell("Casă", bal("casa"), "lei · sold", "casa")}
          {cell("Bancă", bal("banca"), "lei · sold", "casa")}
        </div>
      );
    }
    case "cifre": {
      const lateInvoices = data.aging?.randuri.filter((r) => r.tip === "de_incasat" && r.zile_intarziere > 0).length;
      const tile = (label: string, value: number | undefined, note: string, go: () => void, cls = "") => (
        <button className={`tile-btn ${value ? cls : ""}`} onClick={go} disabled={value === undefined}>
          <span className="v">{value ?? "—"}</span>
          <span className="k">{label}</span>
          <span className="s">{note}</span>
        </button>
      );
      return (
        <div className="tiles-grid">
          {enabled("kgb.business") && tile("facturi restante", lateInvoices, "deschide scadențarul", () => onOpen("kgb.business", "scadentar"), "bad")}
          {enabled("kgb.planner") && tile("taskuri azi", data.tasks?.length, `${data.tasks?.filter((t) => t.intarziat).length ?? 0} întârziate`, () => onOpen("kgb.planner"), "warn")}
          {tile("notificări necitite", data.notes?.length, "deschide clopoțelul", () => document.querySelector<HTMLButtonElement>(".bell")?.click())}
          {tile("acte care expiră", data.expiring?.filter((x) => x.zile <= 30).length, "în 30 de zile, la parteneri", () => onOpen("partners"), "warn")}
        </div>
      );
    }
    case "rezolvat": {
      if (props.todos.length === 0) return <p className="muted">Nimic întârziat și nimic care să expire curând.</p>;
      return (
        <ul className="todo">
          {props.todos.slice(0, 40).map((t) => (
            <li key={t.key} className={state(t.late)}>
              <button className="link todo-text" onClick={t.open}>
                {t.text}
              </button>
              <span className={`tag ${state(t.late)}`}>{when(t.late)}</span>
              <span className="muted small grow">{t.detail}</span>
              <span className="todo-actions">
                <button className="link small" onClick={() => props.onSnooze(t.key, addDays(today(), 1))} title="Nu-l mai arăta până mâine">
                  amână o zi
                </button>
                <button className="link small" onClick={() => props.onSnooze(t.key, addDays(today(), 7))} title="Nu-l mai arăta o săptămână">
                  amână 7 zile
                </button>
                <button className="link small" onClick={() => props.onSnooze(t.key, HIDDEN_UNTIL)} title="Nu-l mai arăta deloc">
                  ascunde
                </button>
              </span>
            </li>
          ))}
          {props.todos.length > 40 && <li className="muted">și încă {props.todos.length - 40}</li>}
        </ul>
      );
    }
    case "azi": {
      if (!enabled("kgb.planner")) return <p className="muted">Activează Planificatorul din {open("catalog", "Catalog module")}.</p>;
      const tasks = data.tasks;
      if (!tasks) return loading;
      return tasks.length === 0 ? (
        <p className="muted">Nimic de făcut azi. {open("kgb.planner", "Deschide Planificatorul")}</p>
      ) : (
        <ul className="plain">
          {tasks.slice(0, 12).map((t) => (
            <li key={t.id}>
              {t.titlu} <span className={t.intarziat ? "error small" : "muted small"}>· {t.intarziat ? `întârziat (${ro(t.termen)})` : "azi"}</span>
            </li>
          ))}
          {tasks.length > 12 && <li className="muted">și încă {tasks.length - 12}: {open("kgb.planner", "toate în Planificator")}</li>}
        </ul>
      );
    }
    case "notificari": {
      const notes = data.notes;
      if (!notes) return loading;
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
    }
    case "documente": {
      if (!enabled("kgb.docs")) return <p className="muted">Activează „Documente și modele” din {open("catalog", "Catalog module")}.</p>;
      const docs = data.docs;
      if (!docs) return loading;
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
    }
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
        <ul className="plain">
          <li>Datele stau pe PC-urile firmei, fără bază de date și fără cloud; fiecare modul are permisiunile lui.</li>
          <li>Documente: PDF, foi de calcul, extragere de date, modele .docx și formulare.</li>
          <li>Business, organizare, echipă, permise și calculator, sincronizate între PC-urile firmei.</li>
        </ul>
      );
  }
}

/** One panel's place in pixels inside a canvas `cw` wide, kept inside it. */
function place(p: HomePanel, cw: number) {
  const minPx = Math.min(cw, 200);
  const width = Math.max(minPx, (p.w / WIDTH) * cw);
  const left = Math.max(0, Math.min(cw - width, (p.x / WIDTH) * cw));
  return { left, top: p.y, width, height: p.h };
}

/** Back from pixels to the stored shape, inside the page. */
function store(id: string, r: { left: number; top: number; width: number; height: number }, cw: number): HomePanel {
  const w = Math.max(MIN_W, Math.min(WIDTH, Math.round((r.width / cw) * WIDTH)));
  const x = Math.max(0, Math.min(WIDTH - w, Math.round((r.left / cw) * WIDTH)));
  const h = Math.max(MIN_H, Math.min(MAX_H, Math.round(r.height)));
  const y = Math.max(0, Math.min(20000, Math.round(r.top)));
  return { id, x, y, w, h };
}

type Edge = "move" | "e" | "s" | "se";

export function Home(props: {
  info: AppInfo;
  modules: ModulesReply;
  settings: Settings;
  implicit: Settings["home"];
  pages: { id: string; label: string }[];
  onSave: (s: Settings) => void;
  onOpen: (id: string) => void;
  onError: (e: string | null) => void;
}) {
  // The date in the language of the window (7.4l-0f); the workspace name is the user's and is not translated.
  const lang = useLang();
  const { panels, amanate } = props.settings.home;
  const [data, reloadNotes] = useData(props.modules, props.onError);
  const canvas = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(1000);
  // While a panel is moved or resized, its place follows the pointer; it is saved on release.
  const [live, setLive] = useState<{ id: string; left: number; top: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth || 1000));
    ro.observe(el);
    setCw(el.clientWidth || 1000);
    return () => ro.disconnect();
  }, []);
  const narrow = cw < NARROW;

  const save = (home: Partial<Settings["home"]>) => props.onSave({ ...props.settings, home: { ...props.settings.home, panels, amanate, ...home } });
  const openAt = (id: string, intent?: string) => {
    if (intent) setIntent(id, intent);
    props.onOpen(id);
  };
  const pageLabel = (id: string) => props.pages.find((p) => p.id === id)?.label;

  // "De rezolvat": everything late or about to be, most urgent first; postponed ones wait.
  const t = today();
  const todos = useMemo(() => {
    const out: Todo[] = [];
    for (const r of data.aging?.randuri ?? [])
      if (r.zile_intarziere > 0 || r.scadenta === t)
        out.push({
          key: `${r.tip}:${r.id}`,
          text: r.tip === "de_incasat" ? `De încasat: ${r.eticheta}` : `De plătit: ${r.eticheta}`,
          detail: `${r.partener} · ${r.rest_text} lei · scadență ${ro(r.scadenta)}`,
          late: r.zile_intarziere,
          open: () => openAt("kgb.business", "scadentar"),
        });
    for (const x of data.tasks ?? [])
      out.push({ key: `task:${x.id}`, text: x.titlu, detail: "task", late: x.intarziat && x.termen ? Math.max(1, Math.round((Date.parse(t) - Date.parse(x.termen)) / 864e5)) : 0, open: () => openAt("kgb.planner") });
    for (const e of data.expiring ?? [])
      if (e.zile <= 30)
        out.push({
          key: `act:${e.partener}:${e.tip}:${e.expira}`,
          text: `${e.tip}${e.numar ? ` nr. ${e.numar}` : ""}`,
          detail: `${e.denumire} · expiră ${ro(e.expira)}`,
          late: -e.zile,
          open: () => openAt("partners"),
        });
    return out.filter((x) => !(amanate[x.key] && amanate[x.key]! > t)).sort((a, b) => b.late - a.late);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, amanate, t]);
  const snooze = (key: string, until: string) => {
    // Postponements that have passed are dropped, so the list stays short.
    const kept = Object.fromEntries(Object.entries(amanate).filter(([, d]) => d > t));
    save({ amanate: { ...kept, [key]: until } });
  };

  const builtInHidden = BUILT_IN.filter((id) => !panels.some((p) => p.id === id));
  const bottom = Math.max(400, ...panels.map((p) => (live?.id === p.id ? live.top + live.height : p.y + p.h) + 24));

  const begin = (e: ReactPointerEvent, p: HomePanel, edge: Edge) => {
    if (narrow || e.button !== 0) return;
    if (edge === "move" && (e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const start = place(p, cw);
    const { clientX: x0, clientY: y0 } = e;
    let cur = { id: p.id, ...start };
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      const r = { ...start };
      if (edge === "move") {
        r.left = Math.max(0, Math.min(cw - start.width, start.left + dx));
        r.top = Math.max(0, start.top + dy);
      }
      if (edge === "e" || edge === "se") r.width = Math.max(Math.min(cw, (MIN_W / WIDTH) * cw), Math.min(cw - start.left, start.width + dx));
      if (edge === "s" || edge === "se") r.height = Math.max(MIN_H, Math.min(MAX_H, start.height + dy));
      cur = { id: p.id, ...r };
      setLive(cur);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setLive(null);
      const next = store(p.id, cur, cw);
      if (next.x !== p.x || next.y !== p.y || next.w !== p.w || next.h !== p.h || panels[panels.length - 1]?.id !== p.id)
        // The panel just touched comes on top (drawn last).
        save({ panels: [...panels.filter((x) => x.id !== p.id), next] });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onKey = (e: KeyboardEvent, p: HomePanel) => {
    const step = e.altKey ? 1 : 10;
    const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    const r = place(p, cw);
    if (e.shiftKey) {
      r.width += v[0] * step;
      r.height += v[1] * step;
    } else {
      r.left += v[0] * step;
      r.top += v[1] * step;
    }
    r.left = Math.max(0, Math.min(cw - r.width, r.left));
    r.top = Math.max(0, r.top);
    r.width = Math.min(cw - r.left, r.width);
    save({ panels: panels.map((x) => (x.id === p.id ? store(p.id, r, cw) : x)) });
  };

  const hour = new Date().getHours();
  const hello = hour < 11 ? "Bună dimineața" : hour < 18 ? "Bună ziua" : "Bună seara";
  const lateCount = todos.filter((x) => x.late > 0).length;
  const expiringSoon = (data.expiring ?? []).filter((x) => x.zile >= 0 && x.zile <= 7).length;
  const on = (m: string) => props.modules.modules.some((x) => x.id === m && x.enabled) && props.modules.access[m] !== "niciunul";
  const actions: [string, string, string?][] = [
    ...(on("kgb.business") ? ([["+ Factură", "kgb.business", "facturare"]] as [string, string, string][]) : []),
    ["+ Partener", "partners"],
    ...(on("kgb.planner") ? ([["+ Task", "kgb.planner"]] as [string, string][]) : []),
    ...(on("kgb.docs") ? ([["+ Document", "kgb.docs"]] as [string, string][]) : []),
    ...(on("kgb.business")
      ? ([
          ["Încasare / plată", "kgb.business", "casa"],
          ["Recepție", "kgb.business", "receptie"],
          ["Rapoarte", "kgb.business", "rapoarte"],
        ] as [string, string, string][])
      : []),
  ];

  return (
    <section className="home cc">
      <div className="cc-band">
        <div className="grow">
          <strong>
            {hello}, {props.info.owner?.display_name}
          </strong>
          <span className="muted">
            {" "}
            · {new Date().toLocaleDateString(lang === "en" ? "en-GB" : "ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ·{" "}
            <span className="no-i18n">{props.info.workspace?.name}</span>
          </span>
        </div>
        <span className={`tag ${lateCount ? "bad" : "ok"}`}>{lateCount ? `${lateCount} întârziate` : "nimic întârziat"}</span>
        {expiringSoon > 0 && <span className="tag warn">{expiringSoon} acte expiră în 7 zile</span>}
      </div>
      <div className="cc-actions" role="toolbar" aria-label="Acțiuni rapide">
        {actions.map(([label, page, intent]) => (
          <button key={label} className={label.startsWith("+") ? "primary" : ""} onClick={() => openAt(page, intent)}>
            {label}
          </button>
        ))}
        <span className="grow" />
        {builtInHidden.map((id) => (
          <button key={id} className="link" onClick={() => save({ panels: [...panels, { id, x: 0, y: bottom, w: 495, h: 260 }] })}>
            + {TITLES[id]}
          </button>
        ))}
        <button className="link" onClick={() => save({ panels: props.implicit.panels })}>
          Revino la implicit
        </button>
      </div>
      <p className="muted small">
        Muți un panou trăgându-l de titlu; îl mărești trăgând de marginea din dreapta, de jos sau de colț. Îl pui deasupra celorlalte atingându-l. Orice
        pagină se fixează aici cu „Fixează pe Acasă”, din titlul ei.
      </p>
      <div ref={canvas} className={narrow ? "cc-canvas narrow" : "cc-canvas"} style={narrow ? undefined : { height: bottom }}>
        {panels.map((p) => {
          const r = live?.id === p.id ? live : place(p, cw);
          const title = p.id.startsWith("fix:") ? (pageLabel(p.id.slice(4)) ?? "Pagină fixată") : TITLES[p.id];
          return (
            <article
              key={p.id}
              className={`card panel free${live?.id === p.id ? " moving" : ""}`}
              data-panel={p.id}
              style={narrow ? { minHeight: Math.min(p.h, 420) } : { left: r.left, top: r.top, width: r.width, height: r.height }}
            >
              <header onPointerDown={(e) => begin(e, p, "move")} onKeyDown={(e) => onKey(e, p)} tabIndex={0} title="Trage pentru a muta" aria-label={`Panoul „${title}”: săgețile îl mută, Shift+săgețile îl redimensionează`}>
                <h3>{title}</h3>
                <span className="grow" />
                <button className="icon" aria-label={`Ascunde „${title}”`} title="Ascunde" onClick={() => save({ panels: panels.filter((x) => x.id !== p.id) })}>
                  ×
                </button>
              </header>
              <div className="panel-body">
                <Content
                  id={p.id}
                  data={data}
                  modules={props.modules}
                  todos={todos}
                  pageLabel={pageLabel}
                  onOpen={openAt}
                  onSnooze={snooze}
                  town={props.settings.home.vreme ?? ""}
                  onTown={(vreme) => save({ vreme })}
                  onRead={(nid) => void api.notificationRead(nid).then(reloadNotes, (e: unknown) => props.onError(message(e)))}
                />
              </div>
              {!narrow && (
                <>
                  <div className="res res-e" aria-hidden="true" onPointerDown={(e) => begin(e, p, "e")} />
                  <div className="res res-s" aria-hidden="true" onPointerDown={(e) => begin(e, p, "s")} />
                  <div className="res res-se" aria-hidden="true" onPointerDown={(e) => begin(e, p, "se")} />
                </>
              )}
            </article>
          );
        })}
      </div>
      {panels.length === 0 && <p className="muted">Toate panourile sunt ascunse. Le aduci înapoi cu butoanele de mai sus sau cu „Revino la implicit”.</p>}
    </section>
  );
}
