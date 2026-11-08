// Desktop shell (Etapa 1, step 1.10): sidebar with the active profile's
// modules, resizable and collapsible; main area; status bar; shortcuts.
import { useCallback, useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";
import { api, message, type AppInfo, type ModulesReply, type Settings, type SettingsReply } from "./api";
import { NotesPage } from "./modules/notes/NotesPage";
import { PdfPage } from "./modules/pdf/PdfPage";
import { SheetsPage } from "./modules/sheets/SheetsPage";
import { ExtractPage } from "./modules/extract/ExtractPage";
import { PlannerPage } from "./modules/planner/PlannerPage";
import { DocsPage } from "./modules/docs/DocsPage";
import { BusinessPage } from "./modules/business/BusinessPage";
import { NotificationBell } from "./components/Notifications";
import { Catalog } from "./pages/Catalog";
import { DataPage } from "./pages/DataPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { Home } from "./pages/Home";
import { SettingsPage } from "./pages/SettingsPage";
import { OrgPage } from "./pages/OrgPage";
import { ConflictsPage } from "./pages/ConflictsPage";

/// Interfaces of the built-in modules, by module id.
const MODULE_PAGES: Record<string, ComponentType<{ onError: (e: string | null) => void }>> = {
  "kgb.notes": NotesPage,
  "kgb.pdf": PdfPage,
  "kgb.sheets": SheetsPage,
  "kgb.extract": ExtractPage,
  "kgb.planner": PlannerPage,
  "kgb.docs": DocsPage,
  "kgb.business": BusinessPage,
};

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 480;

interface NavItem {
  id: string;
  label: string;
  badge?: string;
}

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<SettingsReply | null>(null);
  const [modules, setModules] = useState<ModulesReply | null>(null);
  const [page, setPage] = useState("home");
  const [error, setError] = useState<string | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const loadInfo = useCallback(async () => setInfo(await api.appInfo()), []);
  const loadModules = useCallback(async () => {
    try {
      setModules(await api.listModules());
    } catch (e) {
      setError(message(e));
    }
  }, []);
  const loadSettings = useCallback(async () => {
    try {
      setSettings(await api.getSettings());
    } catch (e) {
      setError(message(e));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const i = await api.appInfo();
        setInfo(i);
        if (!i.startup_error) await Promise.all([loadSettings(), loadModules()]);
      } catch (e) {
        setError(message(e));
      }
    })();
  }, [loadModules, loadSettings]);

  const saveSettings = useCallback(
    async (next: Settings) => {
      if (!settings) return;
      setSettings({ ...settings, settings: next });
      try {
        const version = await api.saveSettings(next, settings.version);
        setSettings({ ...settings, settings: next, version });
        setError(null);
      } catch (e) {
        setError(message(e));
        await loadSettings();
      }
      if (next.profile !== settings.settings.profile) await loadModules();
    },
    [settings, loadSettings, loadModules],
  );

  // Theme and density are applied to <html>.
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const { theme, density } = settings.settings;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    root.dataset.density = density;
  }, [settings]);

  const s = settings?.settings;
  const nav: NavItem[] = [{ id: "home", label: "Acasă" }];
  for (const m of modules?.modules ?? []) {
    const access = modules?.access[m.id] ?? "scriere";
    if (m.enabled && !modules?.hidden.includes(m.id) && access !== "niciunul") {
      nav.push({
        id: m.id,
        label: m.name,
        badge: access === "citire" ? "citire" : m.status === "experimental" ? "exp." : undefined,
      });
    }
  }
  nav.push({ id: "catalog", label: "Catalog module" }, { id: "org", label: "Organizație" }, { id: "conflicts", label: "Conflicte" }, { id: "settings", label: "Setări" }, { id: "data", label: "Date și backup" }, { id: "diagnostics", label: "Diagnostic" });

  // If the open module was disabled or hidden, fall back to the start page.
  useEffect(() => {
    if (modules && !nav.some((n) => n.id === page)) setPage("home");
  });

  const toggleSidebar = useCallback(() => {
    if (s) void saveSettings({ ...s, layout: { ...s.layout, sidebar_collapsed: !s.layout.sidebar_collapsed } });
  }, [s, saveSettings]);

  const navRef = useRef(nav);
  navRef.current = nav;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === ",") {
        e.preventDefault();
        setPage("settings");
      } else if (/^[1-9]$/.test(e.key)) {
        const item = navRef.current[Number(e.key) - 1];
        if (item) {
          e.preventDefault();
          setPage(item.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const startDrag = (e: ReactPointerEvent) => {
    if (!s) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = s.layout.sidebar_width;
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + ev.clientX - startX));
      setDragWidth(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragWidth(null);
      if (w !== startW) void saveSettings({ ...s, layout: { ...s.layout, sidebar_width: w } });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!info) return <div className="loading">Se pornește K.G.B.…</div>;

  if (info.startup_error) {
    return (
      <div className="fatal">
        <h1>K.G.B. nu a putut deschide spațiul de lucru</h1>
        <p className="error">{info.startup_error}</p>
        <p>Nimic nu a fost șters. Detaliile sunt în jurnal:</p>
        <code>{info.log_dir}</code>
      </div>
    );
  }

  if (!s || !modules || !settings) return <div className="loading">Se încarcă…</div>;

  const collapsed = s.layout.sidebar_collapsed;
  const width = dragWidth ?? s.layout.sidebar_width;
  const current = nav.find((n) => n.id === page) ?? nav[0]!;
  const profileName = settings.profiles.find((p) => p.id === s.profile)?.name ?? s.profile;
  const ModulePage = MODULE_PAGES[page];

  return (
    <div className="shell" style={{ gridTemplateColumns: collapsed ? "48px 1fr" : `${width}px 1fr` }}>
      {info.pre_release && (
        <div className="banner">
          Versiune de dinainte de lansare (Etapa 6 în lucru). Nu folosi încă pentru date importante.
        </div>
      )}
      <aside className={collapsed ? "collapsed" : undefined}>
        <div className="brand">
          <button className="icon" onClick={toggleSidebar} title="Ascunde / arată panoul (Ctrl+B)" aria-label="Ascunde sau arată panoul lateral">
            ☰
          </button>
          {!collapsed && <span>K.G.B.</span>}
        </div>
        {!collapsed && (
          <>
            <div className="profile muted">Profil: {profileName}</div>
            <nav>
              {nav.map((n, i) => (
                <button
                  key={n.id}
                  className={n.id === current.id ? "nav active" : "nav"}
                  onClick={() => setPage(n.id)}
                  title={i < 9 ? `Ctrl+${i + 1}` : undefined}
                >
                  <span>{n.label}</span>
                  {n.badge && <small className="badge experimental">{n.badge}</small>}
                </button>
              ))}
            </nav>
          </>
        )}
        {!collapsed && <div className="resizer" onPointerDown={startDrag} title="Trage pentru a redimensiona" />}
      </aside>
      <main>
        <div className="page-head">
          <h1>{current.label}</h1>
          {modules.access[current.id] === "citire" && (
            <span className="badge planned" title="Rolul tău poate doar citi în acest modul">
              doar citire
            </span>
          )}
          <NotificationBell moduleName={(id) => modules.modules.find((m) => m.id === id)?.name ?? id} onError={setError} />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}{" "}
            <button className="link" onClick={() => setError(null)}>
              închide
            </button>
          </p>
        )}
        {page === "home" && <Home info={info} modules={modules} settings={s} onSave={(next) => void saveSettings(next)} onOpen={setPage} onError={setError} />}
        {page === "catalog" && (
          <Catalog modules={modules} profileName={profileName} onChanged={loadModules} onError={setError} />
        )}
        {page === "settings" && (
          <SettingsPage reply={settings} info={info} onSave={saveSettings} onInfoChanged={loadInfo} onError={setError} />
        )}
        {page === "conflicts" && <ConflictsPage onError={setError} />}
        {page === "org" && <OrgPage onError={setError} onChanged={() => void loadModules()} />}
        {page === "diagnostics" && <DiagnosticsPage onError={setError} />}
        {page === "data" && <DataPage onError={setError} onSwitched={() => window.location.reload()} />}
        {ModulePage && <ModulePage onError={setError} />}
        {!ModulePage && modules.modules.some((m) => m.id === page) && (
          <p className="muted">Acest modul nu are încă interfață.</p>
        )}
      </main>
      <footer className="status">
        <span>{info.workspace?.name}</span>
        <span title={info.workspace?.dir}>
          Stocare: {info.recovery?.note ?? "în regulă"} · deschisă în {info.recovery?.open_ms} ms
        </span>
        <span>Lucru local · sincronizarea între PC-uri vine în Etapa 6</span>
        <span className="grow" />
        <span>
          v{info.app_version}
          {info.pre_release ? " · pre-lansare" : ""}
        </span>
      </footer>
    </div>
  );
}
