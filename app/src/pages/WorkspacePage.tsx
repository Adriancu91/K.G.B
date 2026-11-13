// „Spațiu de lucru” (8.21, cerut de Adrian): several documents open at once, in tabs, as in Cyber Office Studio
// (D-071, D-073): spreadsheets and text documents in the COS windows (cos-sheets.html, each tab its own frame), the
// notebook, PDFs (the PDF page showing one document) and the document models. Tabs stay open after a restart
// (kept in this window's storage under the workspace's id, since the storage is shared by every workspace on this PC:
// the documents themselves are in the core). „+” makes a new one; „Alături” puts two
// tabs side by side and „Compară” shows the rows only on the left and only on the right (for two spreadsheets the
// different cells are also coloured in both tables, until the side-by-side view is closed).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, message, type ModulesReply } from "../api";
import { currentLang } from "../i18n/lang";
import { Confirm } from "../components/Confirm";
import { PdfPage } from "../modules/pdf/PdfPage";
import { DocsPage } from "../modules/docs/DocsPage";
import "../components/cosHost";
import { compareLines, diffLines, type DiffLine } from "../../cos/src/versionText";

export type TabKind = "sheets" | "docs" | "notes" | "pdf" | "models";

export interface WsTab {
  key: string;
  kind: TabKind;
  /** The document of the core (null: a new one, not saved yet; notes and models have none). */
  doc: string | null;
  name: string;
  /** The frame's address, fixed when the tab is made (changing it would reload the window). */
  src: string;
  unsaved?: boolean;
}

/** What a COS frame lends the workspace (cosframe/main.tsx). */
interface FrameTab {
  title(): { name: string; path: string } | null;
  unsaved(): boolean;
  content(): string | null;
  text(): Promise<string | null>;
  marks(m: Record<string, string[]> | null): void;
}

const MODULE: Record<TabKind, string> = {
  sheets: "kgb.sheets",
  docs: "kgb.write",
  notes: "kgb.notes",
  pdf: "kgb.pdf",
  models: "kgb.docs",
};
const KIND_LABEL: Record<TabKind, string> = {
  sheets: "Foaie",
  docs: "Text",
  notes: "Note",
  pdf: "PDF",
  models: "Modele",
};
/** Each tab keeps its window in memory (that is what makes switching quick); past this many, the laptop slows down. */
export const MAX_TABS = 10;
const STORE = "kgb.workspace.tabs";
const SHEET_EXT = ["xlsx", "xlsm", "xls", "xlsb", "ods", "csv"];

interface Doc {
  id: string;
  name: string;
  current: number;
}
interface Stored {
  tabs: WsTab[];
  active: string | null;
}

let seq = 0;
const newKey = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

function frameSrc(kind: TabKind, doc: string | null): string {
  if (kind === "notes") return "cos-sheets.html#app=notes";
  if (kind === "docs") return `cos-sheets.html#app=docs&${doc ? `doc=${doc}` : "new"}`;
  return `cos-sheets.html#${doc ? `doc=${doc}` : "new"}`;
}
const isFrame = (k: TabKind) => k === "sheets" || k === "docs" || k === "notes";
const comparable = (k: TabKind) => k === "sheets" || k === "docs" || k === "pdf";

function load(key: string): Stored {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? "null") as Stored | null;
    if (s && Array.isArray(s.tabs)) return s;
  } catch {
    // Nothing kept: an empty workspace.
  }
  return { tabs: [], active: null };
}

/** The cells that differ between two spreadsheets (sheet 1 with sheet 1, the 2nd with the 2nd…), by sheet name. */
export function sheetDiffs(left: string, right: string): [Record<string, string[]>, Record<string, string[]>] | null {
  type Book = { sheets?: { name?: string; cells?: Record<string, unknown> }[] };
  let a: Book, b: Book;
  try {
    a = JSON.parse(left) as Book;
    b = JSON.parse(right) as Book;
  } catch {
    return null;
  }
  const ml: Record<string, string[]> = {};
  const mr: Record<string, string[]> = {};
  const n = Math.max(a.sheets?.length ?? 0, b.sheets?.length ?? 0);
  for (let i = 0; i < n; i++) {
    const sa = a.sheets?.[i];
    const sb = b.sheets?.[i];
    const ca = sa?.cells ?? {};
    const cb = sb?.cells ?? {};
    const diff: string[] = [];
    for (const id of new Set([...Object.keys(ca), ...Object.keys(cb)])) if (String(ca[id] ?? "") !== String(cb[id] ?? "")) diff.push(id);
    if (!diff.length) continue;
    if (sa?.name) ml[sa.name] = diff;
    if (sb?.name) mr[sb.name] = diff;
  }
  return [ml, mr];
}

// `focusNotes`: changes when the app asks for the notebook while a tab here has it open (one window per notebook);
// `onNotesTab`: says whether a tab here holds the notebook.
export function WorkspacePage({
  modules,
  visible,
  onError,
  focusNotes = 0,
  onNotesTab,
  workspaceId,
}: {
  modules: ModulesReply;
  /** The open workspace (its tabs are kept apart from those of another workspace on this PC). */
  workspaceId: string;
  visible: boolean;
  onError: (e: string | null) => void;
  focusNotes?: number;
  onNotesTab?: (open: boolean) => void;
}) {
  const can = useCallback(
    (k: TabKind) => {
      const id = MODULE[k];
      const m = modules.modules.find((x) => x.id === id);
      return !!m?.enabled && (modules.access[id] ?? "scriere") !== "niciunul";
    },
    [modules],
  );
  const writable = useCallback((k: TabKind) => can(k) && (modules.access[MODULE[k]] ?? "scriere") === "scriere", [can, modules]);

  const storeKey = `${STORE}:${workspaceId}`;
  const [tabs, setTabs] = useState<WsTab[]>(() => load(storeKey).tabs.filter((t) => t.doc || t.kind === "notes" || t.kind === "models"));
  const [active, setActive] = useState<string | null>(() => load(storeKey).active);
  const [pair, setPair] = useState<[string, string] | null>(null);
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState<{ docs: { kind: TabKind; doc: Doc }[]; q: string } | null>(null);
  const [toClose, setToClose] = useState<WsTab | null>(null);
  const [cmp, setCmp] = useState<{ left: string; right: string; diff: DiffLine[] | null; cells: boolean; error?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // Tabs of a module that was turned off (or whose document is gone) are dropped.
  useEffect(() => {
    let stop = false;
    void (async () => {
      const gone = new Set<string>();
      for (const k of ["sheets", "docs", "pdf"] as TabKind[]) {
        const mine = tabsRef.current.filter((t) => t.kind === k && t.doc);
        if (!mine.length) continue;
        if (!can(k)) {
          mine.forEach((t) => gone.add(t.key));
          continue;
        }
        try {
          const docs = await api.moduleCall<Doc[]>(MODULE[k], "list");
          for (const t of mine) if (!docs.some((d) => d.id === t.doc)) gone.add(t.key);
        } catch {
          // The list could not be read: the tabs stay; a missing document says so in its own tab.
        }
      }
      for (const t of tabsRef.current) if ((t.kind === "notes" || t.kind === "models") && !can(t.kind)) gone.add(t.key);
      if (!stop && gone.size) setTabs((all) => all.filter((t) => !gone.has(t.key)));
    })();
    return () => {
      stop = true;
    };
  }, [can]);

  // What is kept for the next start: the tabs with a document (a new, unsaved one cannot come back) and the one in front.
  useEffect(() => {
    try {
      const keep = tabs.filter((t) => t.doc || t.kind === "notes" || t.kind === "models").map(({ unsaved: _u, ...t }) => ({ ...t, src: frameSrc(t.kind, t.doc) }));
      localStorage.setItem(storeKey, JSON.stringify({ tabs: keep, active }));
    } catch {
      // Without storage the tabs last until the window closes.
    }
  }, [tabs, active, storeKey]);

  useEffect(() => {
    if (active && tabs.some((t) => t.key === active)) return;
    setActive(tabs[0]?.key ?? null);
  }, [tabs, active]);

  // The COS windows say their file's name (and, once saved, its document) and whether something is unsaved.
  useEffect(() => {
    const iv = window.setInterval(() => {
      let changed = false;
      const next = tabsRef.current.map((t) => {
        if (!isFrame(t.kind)) return t;
        const ft = (frames.current.get(t.key)?.contentWindow as (Window & { kgbTab?: FrameTab }) | null)?.kgbTab;
        if (!ft) return t;
        let title: { name: string; path: string } | null = null;
        let unsaved = false;
        try {
          title = ft.title();
          unsaved = ft.unsaved();
        } catch {
          return t;
        }
        const m = /^kgb:([0-9a-f-]+)\//i.exec(title?.path ?? "");
        const doc = t.kind === "notes" ? null : (m?.[1] ?? t.doc);
        const name = t.kind === "notes" ? t.name : title?.name || t.name;
        if (doc === t.doc && name === t.name && unsaved === !!t.unsaved) return t;
        changed = true;
        return { ...t, doc, name, unsaved };
      });
      if (changed) setTabs(next);
    }, 1000);
    return () => window.clearInterval(iv);
  }, []);

  // The notebook is open in one window only: the app's Note page brings this tab to the front instead.
  const notesKey = tabs.find((t) => t.kind === "notes")?.key ?? null;
  useEffect(() => {
    onNotesTab?.(notesKey !== null);
  }, [notesKey, onNotesTab]);
  useEffect(() => {
    if (!focusNotes || !notesKey) return;
    setActive(notesKey);
    setPair((p) => (p && !p.includes(notesKey) ? null : p));
  }, [focusNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  // A window shown again (or made narrower by the side-by-side view) lays itself out anew.
  const shown = useMemo(() => (pair && active && pair.includes(active) ? pair : active ? [active] : []), [pair, active]);
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => {
      for (const k of shown) frames.current.get(k)?.contentWindow?.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("resize"));
    }, 60);
    return () => window.clearTimeout(id);
  }, [shown, visible]);

  const add = (kind: TabKind, doc: string | null, name: string) => {
    setMenu(false);
    setPicker(null);
    const same = tabsRef.current.find((t) => t.kind === kind && (kind === "notes" || kind === "models" || (doc !== null && t.doc === doc)));
    if (same) {
      setActive(same.key);
      return;
    }
    if (tabsRef.current.length >= MAX_TABS) {
      setNotice(`Sunt deja ${MAX_TABS} taburi deschise: închide unul ca să deschizi altul (fiecare tab ține fereastra lui în memorie).`);
      return;
    }
    setNotice(null);
    const t: WsTab = { key: newKey(), kind, doc, name, src: frameSrc(kind, doc) };
    setTabs((all) => [...all, t]);
    setActive(t.key);
  };

  const close = (t: WsTab, force = false) => {
    if (!force && t.unsaved) {
      setToClose(t);
      return;
    }
    setToClose(null);
    if (pair?.includes(t.key)) unpair();
    frames.current.delete(t.key);
    setTabs((all) => {
      const i = all.findIndex((x) => x.key === t.key);
      const rest = all.filter((x) => x.key !== t.key);
      if (active === t.key) setActive(rest[Math.min(i, rest.length - 1)]?.key ?? null);
      return rest;
    });
  };

  const frameTab = (key: string) => (frames.current.get(key)?.contentWindow as (Window & { kgbTab?: FrameTab }) | null)?.kgbTab ?? null;
  const unpair = () => {
    if (pair) for (const k of pair) frameTab(k)?.marks(null);
    setPair(null);
    setCmp(null);
  };

  const openPicker = async () => {
    setMenu(false);
    const docs: { kind: TabKind; doc: Doc }[] = [];
    try {
      for (const k of ["sheets", "docs", "pdf"] as TabKind[]) {
        if (!can(k)) continue;
        for (const d of await api.moduleCall<Doc[]>(MODULE[k], "list")) docs.push({ kind: k, doc: d });
      }
      docs.sort((a, b) => a.doc.name.localeCompare(b.doc.name, "ro"));
      setPicker({ docs, q: "" });
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  };

  const importFromComputer = async () => {
    const ext = [...(writable("sheets") ? SHEET_EXT : []), ...(writable("docs") ? ["docx"] : []), ...(writable("pdf") ? ["pdf"] : [])];
    if (!ext.length) return;
    const picked = await open({ multiple: false, filters: [{ name: "Documente", extensions: ext }] });
    if (!picked || Array.isArray(picked)) return;
    const e = picked.split(".").pop()?.toLowerCase() ?? "";
    const kind: TabKind = e === "pdf" ? "pdf" : e === "docx" ? "docs" : "sheets";
    try {
      const r = await api.importFile<{ document: Doc }>(MODULE[kind], picked);
      add(kind, r.document.id, r.document.name);
      onError(null);
    } catch (err) {
      onError(message(err));
    }
  };

  /** The rows of a tab for „Compară”: what the window holds now (also unsaved), or the pages' text of a PDF. */
  const linesOf = async (t: WsTab): Promise<string[]> => {
    const en = currentLang() === "en";
    if (t.kind === "pdf") {
      if (!t.doc) return [];
      const pages = await api.moduleCall<unknown>(MODULE.pdf, "text", { id: t.doc });
      const list = Array.isArray(pages) ? pages : [];
      const out: string[] = [];
      list.forEach((p, i) => {
        const text = typeof p === "string" ? p : typeof (p as { text?: unknown })?.text === "string" ? (p as { text: string }).text : "";
        out.push(`— ${en ? "page" : "pagina"} ${i + 1} —`);
        for (const l of text.split(/\r?\n/)) if (l.trim()) out.push(l.trim());
      });
      return out;
    }
    const content = (await frameTab(t.key)?.text()) ?? "";
    return compareLines(content, en);
  };

  const compare = async () => {
    if (!pair) return;
    const [l, r] = pair.map((k) => tabs.find((t) => t.key === k)!);
    if (!l || !r) return;
    const cells = l.kind === "sheets" && r.kind === "sheets";
    if (cells) {
      const d = sheetDiffs(frameTab(l.key)?.content() ?? "", frameTab(r.key)?.content() ?? "");
      if (d) {
        frameTab(l.key)?.marks(Object.keys(d[0]).length ? d[0] : null);
        frameTab(r.key)?.marks(Object.keys(d[1]).length ? d[1] : null);
      }
    }
    setCmp({ left: l.name, right: r.name, diff: null, cells });
    try {
      const [a, b] = await Promise.all([linesOf(l), linesOf(r)]);
      const diff = diffLines(a, b);
      setCmp((c) => (c && c.left === l.name && c.right === r.name ? { ...c, diff, error: diff ? undefined : "Documentele sunt prea mari pentru comparare pe rânduri." } : c));
    } catch (e) {
      setCmp((c) => (c ? { ...c, error: message(e) } : c));
    }
  };

  const activeTab = tabs.find((t) => t.key === active) ?? null;
  const others = tabs.filter((t) => t.key !== active);
  const pairOn = !!pair && !!active && pair.includes(active);
  const pairTabs = pairOn ? pair.map((k) => tabs.find((t) => t.key === k)!) : [];
  const canCompare = pairOn && pairTabs.every((t) => t && comparable(t.kind));
  const nothing = !["sheets", "docs", "notes", "pdf", "models"].some((k) => can(k as TabKind));

  const q = picker?.q.trim().toLowerCase() ?? "";
  const found = picker ? picker.docs.filter((d) => !q || d.doc.name.toLowerCase().includes(q)) : [];

  return (
    <section className="workspace" aria-label="Spațiu de lucru">
      <div className="ws-bar" role="tablist" aria-label="Documentele deschise">
        {tabs.map((t) => (
          <div
            key={t.key}
            role="tab"
            aria-selected={t.key === active}
            data-kind={t.kind}
            className={`ws-tab ${t.key === active ? "active" : ""} ${pairOn && pair!.includes(t.key) ? "paired" : ""}`}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                close(t);
              }
            }}
          >
            <button className="ws-tab-name" onClick={() => setActive(t.key)} title={t.name}>
              <span className="ws-kind">{KIND_LABEL[t.kind]}</span> {t.name}
              {t.unsaved && (
                <span className="ws-dot" title="Are modificări nesalvate">
                  {" "}
                  ●
                </span>
              )}
            </button>
            <button className="ws-close" aria-label={`Închide tabul ${t.name}`} title="Închide tabul" onClick={() => close(t)}>
              ×
            </button>
          </div>
        ))}
        <div className="ws-plus-wrap">
          <button className="ws-plus" aria-haspopup="menu" aria-expanded={menu} title="Deschide sau fă un document nou" onClick={() => setMenu((m) => !m)} disabled={nothing}>
            ＋
          </button>
          {menu && (
            <div className="ws-menu" role="menu" onMouseLeave={() => setMenu(false)}>
              {writable("sheets") && (
                <button role="menuitem" onClick={() => add("sheets", null, "Foaie de calcul nouă")}>
                  Foaie de calcul nouă
                </button>
              )}
              {writable("docs") && (
                <button role="menuitem" onClick={() => add("docs", null, "Document text nou")}>
                  Document text nou
                </button>
              )}
              {can("models") && (
                <button role="menuitem" onClick={() => add("models", null, "Modele de documente")}>
                  Document sau PDF din model
                </button>
              )}
              {can("notes") && (
                <button role="menuitem" onClick={() => add("notes", null, "Caietul de note")}>
                  Caietul de note
                </button>
              )}
              {(can("sheets") || can("docs") || can("pdf")) && (
                <button role="menuitem" onClick={() => void openPicker()}>
                  Deschide un document salvat…
                </button>
              )}
              {(writable("sheets") || writable("docs") || writable("pdf")) && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    void importFromComputer();
                  }}
                >
                  Importă de pe calculator…
                </button>
              )}
            </div>
          )}
        </div>
        <span className="grow" />
        {activeTab && others.length > 0 && !pairOn && (
          <label className="ws-beside">
            Alături:{" "}
            <select
              aria-label="Tabul pus alături"
              value=""
              onChange={(e) => {
                if (e.target.value && active) setPair([active, e.target.value]);
              }}
            >
              <option value="">— alege tabul —</option>
              {others.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {pairOn && (
          <>
            <button onClick={() => void compare()} disabled={!canCompare} title={canCompare ? "Arată rândurile care sunt doar în stânga și cele doar în dreapta" : "Se compară foi de calcul, documente text și PDF-uri"}>
              ⇄ Compară
            </button>
            <button onClick={unpair} title="Închide alăturarea: rămâne doar tabul în care lucrezi">
              ◫ Un singur tab
            </button>
          </>
        )}
      </div>
      {notice && (
        <p className="ws-notice muted" role="status">
          {notice}
        </p>
      )}

      <div className={`ws-content ${pairOn ? "split" : ""}`}>
        {tabs.length === 0 && (
          <div className="ws-empty">
            <h2>Spațiu de lucru</h2>
            <p className="muted">
              Deschide aici mai multe documente deodată, fiecare în tabul lui: foi de calcul, documente text, PDF-uri, caietul de note.
              Treci dintr-unul în altul fără să se închidă, pune două alături și compară-le. Taburile rămân deschise și după repornire.
            </p>
            {nothing ? (
              <p className="muted">Pornește din „Catalog module” Foile de calcul, Documentele text, PDF-urile sau Notele.</p>
            ) : (
              <div className="row wrap">
                {writable("sheets") && (
                  <button className="primary" onClick={() => add("sheets", null, "Foaie de calcul nouă")}>
                    Foaie de calcul nouă
                  </button>
                )}
                {writable("docs") && <button onClick={() => add("docs", null, "Document text nou")}>Document text nou</button>}
                {(can("sheets") || can("docs") || can("pdf")) && <button onClick={() => void openPicker()}>Deschide un document salvat…</button>}
              </div>
            )}
          </div>
        )}
        {tabs.map((t) => {
          const side = pairOn ? pair!.indexOf(t.key) : -1;
          const show = side >= 0 || (!pairOn && t.key === active);
          return (
            <div key={t.key} className={`ws-pane ${side >= 0 && t.key === active ? "focused" : ""}`} data-tab={t.key} data-kind={t.kind} hidden={!show} style={side >= 0 ? { order: side } : undefined} onMouseDown={() => side >= 0 && setActive(t.key)}>
              {isFrame(t.kind) ? (
                <iframe
                  title={t.name}
                  src={t.src}
                  ref={(el) => {
                    if (el) frames.current.set(t.key, el);
                  }}
                  onFocus={() => side >= 0 && setActive(t.key)}
                />
              ) : t.kind === "pdf" && t.doc ? (
                <div className="ws-page">
                  <PdfPage onError={onError} docId={t.doc} active={visible && show && t.key === active} />
                </div>
              ) : (
                <div className="ws-page">
                  <DocsPage onError={onError} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {picker && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setPicker(null)}>
          <div className="dialog ws-picker" role="dialog" aria-label="Deschide un document salvat" onKeyDown={(e) => e.key === "Escape" && setPicker(null)}>
            <h2>Deschide un document salvat</h2>
            <input autoFocus aria-label="Caută documentul" placeholder="caută după nume" value={picker.q} onChange={(e) => setPicker({ ...picker, q: e.target.value })} />
            <ul className="list ws-picker-list">
              {found.length === 0 && <li className="muted">Niciun document găsit.</li>}
              {found.slice(0, 200).map(({ kind, doc }) => (
                <li key={`${kind}:${doc.id}`}>
                  <button className="link grow" onClick={() => add(kind, doc.id, doc.name)}>
                    <span className="ws-kind">{KIND_LABEL[kind]}</span> {doc.name}
                  </button>
                  <span className="muted">v{doc.current}</span>
                </li>
              ))}
            </ul>
            <div className="row">
              {(writable("sheets") || writable("docs") || writable("pdf")) && (
                <button
                  onClick={() => {
                    setPicker(null);
                    void importFromComputer();
                  }}
                >
                  Importă de pe calculator…
                </button>
              )}
              <span className="grow" />
              <button onClick={() => setPicker(null)}>Închide</button>
            </div>
          </div>
        </div>
      )}

      {cmp && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setCmp(null)}>
          <div className="dialog ws-compare" role="dialog" aria-label="Comparare" onKeyDown={(e) => e.key === "Escape" && setCmp(null)}>
            <h2>
              „{cmp.left}” ⇄ „{cmp.right}”
            </h2>
            {cmp.cells && <p className="muted">Celulele diferite sunt colorate în ambele tabele, până închizi alăturarea.</p>}
            {cmp.error ? <p className="error">{cmp.error}</p> : cmp.diff === null ? <p className="muted">Se compară…</p> : <DiffView diff={cmp.diff} />}
            <div className="row">
              <span className="grow" />
              <button autoFocus onClick={() => setCmp(null)}>
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      {toClose && (
        <Confirm title="Închizi tabul fără să salvezi?" confirmLabel="Închide fără să salvez" danger onCancel={() => setToClose(null)} onConfirm={() => close(toClose, true)}>
          „{toClose.name}” are modificări nesalvate. Dacă închizi tabul acum, ele se pierd. Ca să le păstrezi, salvează întâi din fereastra lui.
        </Confirm>
      )}
    </section>
  );
}

/** The rows only on the left (−), only on the right (+); long runs of equal rows are folded. */
function DiffView({ diff }: { diff: DiffLine[] }) {
  const left = diff.filter((d) => d.kind === "old").length;
  const right = diff.filter((d) => d.kind === "new").length;
  if (!left && !right) return <p className="ws-same">Nicio diferență: au același conținut.</p>;
  const rows: (DiffLine | { kind: "fold"; n: number })[] = [];
  for (let i = 0; i < diff.length; ) {
    if (diff[i]!.kind !== "same") {
      rows.push(diff[i]!);
      i++;
      continue;
    }
    let j = i;
    while (j < diff.length && diff[j]!.kind === "same") j++;
    const run = diff.slice(i, j);
    if (run.length > 6) rows.push(...run.slice(0, 2), { kind: "fold", n: run.length - 4 }, ...run.slice(-2));
    else rows.push(...run);
    i = j;
  }
  return (
    <>
      <p>
        <span className="ws-old">− {left} doar în stânga</span> · <span className="ws-new">+ {right} doar în dreapta</span>
      </p>
      <ol className="ws-diff" aria-label="Diferențele">
        {rows.map((r, i) =>
          r.kind === "fold" ? (
            <li key={i} className="ws-fold muted">
              … {r.n} rânduri la fel …
            </li>
          ) : (
            <li key={i} className={r.kind === "old" ? "ws-old" : r.kind === "new" ? "ws-new" : "muted"}>
              {r.kind === "old" ? "− " : r.kind === "new" ? "+ " : "  "}
              {r.text}
            </li>
          ),
        )}
      </ol>
    </>
  );
}
