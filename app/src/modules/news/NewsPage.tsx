// InfoNews (7.5), the page of kgb.news: the items of the RSS / Atom sources approved and switched on in
// „Surse externe” (the core reads them, at most every 30 minutes per feed), newest first, each with its source,
// time and link; plain text only. An item can be kept to be found later. A link opens in the computer's browser.
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api, message } from "../../api";

const ID = "kgb.news";

interface Item {
  titlu: string;
  link: string;
  ms: number;
  rezumat: string;
  sursa: string;
}
interface Kept extends Item {
  id: string;
  version: number;
  pastrat_ms: number;
}
interface Feed {
  stiri: Item[];
  erori: [string, string][];
  surse: number;
}

const when = (ms: number) => (ms ? new Date(ms).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" }) : "fără oră");

export function NewsPage({ onError, onOpen }: { onError: (e: string | null) => void; onOpen?: (page: string) => void }) {
  const [tab, setTab] = useState<"stiri" | "pastrate">("stiri");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [kept, setKept] = useState<Kept[]>([]);
  const [source, setSource] = useState("");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [f, k] = await Promise.all([invoke<Feed>("news_feed"), api.moduleCall<Kept[]>(ID, "pastrate")]);
      setFeed(f);
      setKept(k);
      onError(null);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  }, [onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const keep = (i: Item) =>
    void api
      .moduleCall<Kept>(ID, "pastreaza", { titlu: i.titlu, link: i.link, ms: i.ms, sursa: i.sursa, rezumat: i.rezumat })
      .then((k) => setKept((all) => (all.some((x) => x.id === k.id) ? all : [k, ...all])), (e: unknown) => onError(message(e)));
  const forget = (k: Kept) =>
    void api.moduleCall(ID, "uita", { id: k.id, version: k.version }).then(
      () => setKept((all) => all.filter((x) => x.id !== k.id)),
      (e: unknown) => onError(message(e)),
    );
  const openLink = (url: string) => void invoke("news_open", { url }).catch((e: unknown) => onError(message(e)));

  const keptLinks = new Set(kept.map((k) => k.link));
  const q = find.trim().toLowerCase();
  const list: Item[] = (tab === "stiri" ? feed?.stiri ?? [] : kept).filter(
    (i) => (!source || i.sursa === source) && (!q || i.titlu.toLowerCase().includes(q) || i.rezumat.toLowerCase().includes(q)),
  );
  const sources = [...new Set((feed?.stiri ?? []).map((i) => i.sursa))].sort();

  return (
    <section className="news">
      <p className="muted">
        Știrile vin doar din sursele RSS / Atom aprobate și pornite în „Surse externe”, fiecare cu sursa, ora și legătura. Nimic nu
        se citește din alte locuri.
      </p>
      <div className="row wrap">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "stiri"} className={tab === "stiri" ? "on" : ""} onClick={() => setTab("stiri")}>
            Știri ({feed?.stiri.length ?? 0})
          </button>
          <button role="tab" aria-selected={tab === "pastrate"} className={tab === "pastrate" ? "on" : ""} onClick={() => setTab("pastrate")}>
            Păstrate ({kept.length})
          </button>
        </div>
        <select aria-label="Sursa" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Toate sursele</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input aria-label="Caută în știri" placeholder="Caută în titluri și rezumate…" value={find} onChange={(e) => setFind(e.target.value)} />
        <button disabled={busy} onClick={() => void load()}>
          Reîmprospătează
        </button>
      </div>
      {feed && feed.surse === 0 && tab === "stiri" && (
        <p className="warn">
          Nicio sursă RSS nu e aprobată și pornită.{" "}
          {onOpen && (
            <button className="link" onClick={() => onOpen("sources")}>
              Adaugă una în „Surse externe”
            </button>
          )}
        </p>
      )}
      {feed?.erori.map(([s, e]) => (
        <p key={s} className="warn">
          {s}: {e}
        </p>
      ))}
      <ul className="news-list">
        {list.map((i) => (
          <li key={`${i.sursa}-${i.link}-${i.titlu}`} className="card news-item">
            <h3 className="no-i18n">{i.titlu}</h3>
            <p className="muted small">
              <span className="no-i18n">{i.sursa}</span> · {when(i.ms)}
            </p>
            {i.rezumat && <p className="no-i18n">{i.rezumat}</p>}
            <div className="row wrap">
              {i.link && (
                <button className="link" onClick={() => openLink(i.link)} title={i.link}>
                  Deschide în browser
                </button>
              )}
              {tab === "stiri" && i.link && (
                <button className="link" disabled={keptLinks.has(i.link)} onClick={() => keep(i)}>
                  {keptLinks.has(i.link) ? "Păstrată" : "Păstrează"}
                </button>
              )}
              {tab === "pastrate" && (
                <button className="link" onClick={() => forget(i as Kept)}>
                  Uită
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {feed && list.length === 0 && (feed.surse > 0 || tab === "pastrate") && <p className="muted">Nicio știre de arătat.</p>}
    </section>
  );
}
