// Piață, part 1 (Etapa 7, step 7.6; D-087): a watch list kept by hand — quotes typed in or imported from CSV,
// each with its source and time, a chart on a real time axis (plain SVG) and alerts on the last quote.
// A record, not investment advice: the page says so at the top and K.G.B. fetches no prices.
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.market";
const KINDS: Array<[string, string]> = [
  ["actiune", "Acțiune"],
  ["fond", "Fond"],
  ["valuta", "Valută"],
  ["marfa", "Marfă"],
  ["altul", "Altul"],
];
const RANGES: Array<[string, string, number]> = [
  ["1l", "1 lună", 31],
  ["3l", "3 luni", 92],
  ["1a", "1 an", 366],
  ["tot", "Tot", 0],
];

interface Quote {
  id: string;
  version: number;
  moment: string;
  pret: number;
  pret_text: string;
  sursa: string;
}
interface Alert {
  id: string;
  version: number;
  directie: "peste" | "sub";
  nivel_text: string;
  activa: boolean;
}
interface Instrument {
  id: string;
  version: number;
  simbol: string;
  nume: string;
  fel: string;
  moneda: string;
  nota: string;
  cotatii: number;
  ultima: Quote | null;
  variatie: number | null;
  alerte: Alert[];
}
interface CsvReport {
  adaugate: number;
  existente: Array<{ rand: number; moment: string; motiv: string }>;
  refuzate: Array<{ rand: number; motiv: string }>;
  separator: string;
}

const when = (m: string) => {
  const [d, t] = m.split("T");
  const [y, mo, da] = (d ?? "").split("-");
  return `${da}.${mo}.${y}${t && t !== "00:00" ? " " + t : ""}`;
};
const pct = (v: number | null) => (v === null ? "" : `${v > 0 ? "+" : ""}${(v / 100).toFixed(2).replace(".", ",")} %`);
const nowLocal = () => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};
/** Days since 1970 of a local moment, with the time as a fraction: the chart's real time axis. */
const dayOf = (m: string) => {
  const [d, t] = m.split("T");
  const [y, mo, da] = (d ?? "").split("-").map(Number);
  const [h, mi] = (t ?? "00:00").split(":").map(Number);
  return Date.UTC(y!, mo! - 1, da!) / 86_400_000 + ((h ?? 0) * 60 + (mi ?? 0)) / 1440;
};

/** The quotes as a line on a real time axis (the gaps between days show), with the levels of the alerts. */
function Chart({ quotes, alerts }: { quotes: Quote[]; alerts: Alert[] }) {
  if (quotes.length < 2) return <p className="muted small">Graficul apare de la două cotații.</p>;
  const W = 640;
  const H = 220;
  const pad = { l: 64, r: 12, t: 12, b: 28 };
  const xs = quotes.map((q) => dayOf(q.moment));
  const levels = alerts.filter((a) => a.activa).map((a) => Number(a.nivel_text.replace(/\./g, "").replace(",", ".")));
  const ys = quotes.map((q) => q.pret / 10_000);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const all = [...ys, ...levels.filter((l) => Number.isFinite(l))];
  let [y0, y1] = [Math.min(...all), Math.max(...all)];
  if (y0 === y1) [y0, y1] = [y0 - 1, y1 + 1];
  const X = (x: number) => pad.l + ((x - x0) / Math.max(x1 - x0, 1e-9)) * (W - pad.l - pad.r);
  const Y = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const path = quotes.map((_, k) => `${k ? "L" : "M"}${X(xs[k]!).toFixed(1)},${Y(ys[k]!).toFixed(1)}`).join(" ");
  const fmt = (v: number) => v.toLocaleString("ro-RO", { maximumFractionDigits: 4 });
  return (
    <svg className="market-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Graficul cotațiilor">
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="currentColor" opacity="0.3" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="currentColor" opacity="0.3" />
      {[y0, (y0 + y1) / 2, y1].map((v) => (
        <text key={v} x={pad.l - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor">
          {fmt(v)}
        </text>
      ))}
      <text x={pad.l} y={H - 8} fontSize="11" fill="currentColor">
        {when(quotes[0]!.moment)}
      </text>
      <text x={W - pad.r} y={H - 8} fontSize="11" textAnchor="end" fill="currentColor">
        {when(quotes[quotes.length - 1]!.moment)}
      </text>
      {levels.map((l, k) =>
        Number.isFinite(l) ? <line key={k} x1={pad.l} x2={W - pad.r} y1={Y(l)} y2={Y(l)} stroke="var(--warn, #c60)" strokeDasharray="4 3" /> : null,
      )}
      <path d={path} fill="none" stroke="var(--accent, #36c)" strokeWidth="2" />
      {quotes.map((q, k) => (
        <circle key={q.id} cx={X(xs[k]!)} cy={Y(ys[k]!)} r="2.5" fill="var(--accent, #36c)">
          <title>{`${when(q.moment)}: ${q.pret_text} (${q.sursa})`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function MarketPage({ onError }: { onError: (e: string | null) => void }) {
  const [list, setList] = useState<Instrument[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [range, setRange] = useState("3l");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [report, setReport] = useState<CsvReport | null>(null);
  const [form, setForm] = useState({ simbol: "", nume: "", fel: "actiune", moneda: "RON", nota: "" });
  const [q, setQ] = useState({ moment: nowLocal(), pret: "", sursa: "" });
  const [al, setAl] = useState({ directie: "peste", nivel: "" });

  const refresh = useCallback(async () => {
    try {
      const l = await api.moduleCall<Instrument[]>(ID, "list");
      setList(l);
      setSel((s) => (s && l.some((x) => x.id === s) ? s : (l[0]?.id ?? null)));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const cur = list.find((x) => x.id === sel) ?? null;
  const loadQuotes = useCallback(async () => {
    if (!sel) return setQuotes([]);
    const days = RANGES.find((r) => r[0] === range)?.[2] ?? 0;
    const from = days ? new Date(Date.now() - days * 86_400_000) : null;
    const z = (n: number) => String(n).padStart(2, "0");
    try {
      setQuotes(
        await api.moduleCall<Quote[]>(ID, "quotes", {
          instrument: sel,
          ...(from ? { de_la: `${from.getFullYear()}-${z(from.getMonth() + 1)}-${z(from.getDate())}` } : {}),
        }),
      );
    } catch (e) {
      onError(message(e));
    }
  }, [sel, range, onError]);
  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes, list]);

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
  const newest = useMemo(() => [...quotes].reverse().slice(0, 30), [quotes]);

  return (
    <section className="market">
      <p className="warn">Evidență, nu sfaturi de investiții: cotațiile sunt cele scrise sau aduse de tine, cu sursa lor; aplicația nu recomandă nimic.</p>

      <form
        className="row wrap market-new"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const r = await api.moduleCall<{ id: string }>(ID, "instrument_save", form);
            setForm({ ...form, simbol: "", nume: "", nota: "" });
            setSel(r.id);
          });
        }}
      >
        <input aria-label="Simbolul" placeholder="Simbol (TLV, EURRON…)" value={form.simbol} onChange={(e) => setForm({ ...form, simbol: e.target.value })} required />
        <input aria-label="Numele" placeholder="Nume" value={form.nume} onChange={(e) => setForm({ ...form, nume: e.target.value })} required />
        <select aria-label="Felul" value={form.fel} onChange={(e) => setForm({ ...form, fel: e.target.value })}>
          {KINDS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input aria-label="Moneda" value={form.moneda} maxLength={3} size={4} onChange={(e) => setForm({ ...form, moneda: e.target.value })} />
        <button className="primary" disabled={busy}>
          Adaugă în listă
        </button>
      </form>

      {list.length === 0 ? (
        <p className="muted">Lista de urmărire e goală. Adaugă un simbol, apoi cotațiile lui (scrise de mână sau dintr-un CSV).</p>
      ) : (
        <table className="audit market-list">
          <thead>
            <tr>
              <th>Simbol</th>
              <th>Nume</th>
              <th>Ultima cotație</th>
              <th>Variație</th>
              <th>Sursa și ora</th>
              <th>Alerte</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id} className={x.id === sel ? "active" : ""} onClick={() => setSel(x.id)} style={{ cursor: "pointer" }}>
                <td>
                  <strong>{x.simbol}</strong>
                </td>
                <td>{x.nume}</td>
                <td className="num">{x.ultima ? `${x.ultima.pret_text} ${x.moneda}` : "—"}</td>
                <td className="num">{pct(x.variatie)}</td>
                <td className="small muted">{x.ultima ? `${x.ultima.sursa}, ${when(x.ultima.moment)}` : ""}</td>
                <td className="small">{x.alerte.filter((a) => a.activa).map((a) => `${a.directie} ${a.nivel_text}`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {cur && (
        <div className="card market-detail">
          <h3>
            {cur.simbol} · {cur.nume} <span className="muted small">{`(${cur.cotatii} cotații)`}</span>
          </h3>
          <div className="sheet-tabs" role="tablist" aria-label="Perioada">
            {RANGES.map(([k, v]) => (
              <button key={k} role="tab" aria-selected={range === k} className={range === k ? "active" : ""} onClick={() => setRange(k)}>
                {v}
              </button>
            ))}
          </div>
          <Chart quotes={quotes} alerts={cur.alerte} />

          <h4>Cotație nouă</h4>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api.moduleCall<{ pret_text: string }>(ID, "quote_add", { instrument: cur.id, ...q });
                setNotice(`Cotația ${r.pret_text} a fost adăugată.`);
                setQ({ ...q, pret: "" });
              });
            }}
          >
            <input type="datetime-local" aria-label="Momentul cotației" value={q.moment} onChange={(e) => setQ({ ...q, moment: e.target.value })} required />
            <input aria-label="Prețul" placeholder="Preț (32,50)" value={q.pret} onChange={(e) => setQ({ ...q, pret: e.target.value })} required />
            <input aria-label="Sursa cotației" placeholder="Sursa (de unde e prețul)" value={q.sursa} onChange={(e) => setQ({ ...q, sursa: e.target.value })} />
            <button disabled={busy}>Adaugă cotația</button>
            <button
              type="button"
              disabled={busy}
              title="Un fișier .csv cu data (și ora), prețul și, opțional, sursa pe fiecare rând; separatorul și zecimalele se recunosc singure"
              onClick={() =>
                void run(async () => {
                  const path = await open({ multiple: false, filters: [{ name: "CSV", extensions: ["csv", "txt"] }] });
                  if (!path || Array.isArray(path)) return;
                  const r = await api.importFileWith<CsvReport>(ID, path, "import_csv", { instrument: cur.id });
                  setReport(r);
                  setNotice(`Din CSV: ${r.adaugate} cotații adăugate, ${r.existente.length} existau deja, ${r.refuzate.length} rânduri refuzate.`);
                })
              }
            >
              Import CSV…
            </button>
          </form>
          {report && (report.existente.length > 0 || report.refuzate.length > 0) && (
            <ul className="small muted market-report">
              {[...report.refuzate.map((r) => `Rândul ${r.rand}: ${r.motiv}`), ...report.existente.map((r) => `Rândul ${r.rand} (${when(r.moment)}): ${r.motiv}`)]
                .slice(0, 20)
                .map((t) => (
                  <li key={t}>{t}</li>
                ))}
            </ul>
          )}

          <h4>Alerte (pe ultima cotație)</h4>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api.moduleCall(ID, "alert_save", { instrument: cur.id, ...al });
                setAl({ ...al, nivel: "" });
              });
            }}
          >
            <select aria-label="Direcția alertei" value={al.directie} onChange={(e) => setAl({ ...al, directie: e.target.value })}>
              <option value="peste">peste</option>
              <option value="sub">sub</option>
            </select>
            <input aria-label="Pragul alertei" placeholder="Prag" value={al.nivel} onChange={(e) => setAl({ ...al, nivel: e.target.value })} required />
            <button disabled={busy}>Adaugă alerta</button>
          </form>
          <ul className="plain">
            {cur.alerte.map((a) => (
              <li key={a.id} className="row">
                <span>
                  {`${a.directie} ${a.nivel_text} ${cur.moneda}`}
                </span>
                <button className="danger-text" aria-label={`Șterge alerta ${a.directie} ${a.nivel_text}`} onClick={() => void run(() => api.moduleCall(ID, "alert_delete", { id: a.id, version: a.version }))}>
                  Șterge
                </button>
              </li>
            ))}
          </ul>

          <h4>Ultimele cotații</h4>
          <table className="audit">
            <tbody>
              {newest.map((x) => (
                <tr key={x.id}>
                  <td>{when(x.moment)}</td>
                  <td className="num">{x.pret_text}</td>
                  <td className="small muted">{x.sursa}</td>
                  <td>
                    <button className="danger-text" aria-label={`Șterge cotația din ${when(x.moment)}`} onClick={() => void run(() => api.moduleCall(ID, "quote_delete", { id: x.id, version: x.version }))}>
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="danger-text" disabled={busy} onClick={() => void run(() => api.moduleCall(ID, "instrument_delete", { id: cur.id, version: cur.version }))}>
            {`Scoate ${cur.simbol} din listă (cu cotațiile și alertele lui)`}
          </button>
        </div>
      )}
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
