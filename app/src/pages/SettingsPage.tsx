// Workspace settings. Every change is validated and saved by the core.
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, type FormEvent } from "react";
import { api, message, type AppInfo, type Density, type Settings, type SettingsReply, type Theme } from "../api";
import { setLang, useLang } from "../i18n/lang";

export const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl + B", "ascunde / arată panoul lateral"],
  ["Ctrl + ,", "deschide setările"],
  ["Ctrl + 1 … 9", "deschide elementul 1 … 9 din panoul lateral"],
  ["Esc", "închide o fereastră de confirmare"],
];

interface Desktop {
  cu_windows: boolean;
  langa_ceas: boolean;
  comanda: string | null;
}

/** This PC: next to the clock, start with Windows (7.4m-3). */
function ThisPc({ onError }: { onError: (e: string | null) => void }) {
  const [d, setD] = useState<Desktop | null>(null);
  useEffect(() => {
    invoke<Desktop>("desktop_get").then(setD, (e: unknown) => onError(message(e)));
  }, [onError]);
  if (!d) return null;
  const set = (next: Partial<Desktop>) =>
    void invoke<Desktop>("desktop_set", { cuWindows: next.cu_windows ?? d.cu_windows, langaCeas: next.langa_ceas ?? d.langa_ceas }).then(
      (r) => {
        setD(r);
        onError(null);
      },
      (e: unknown) => onError(message(e)),
    );
  return (
    <div className="this-pc">
      <label className="row">
        <input type="checkbox" aria-label="Rămâne lângă ceas" checked={d.langa_ceas} onChange={(e) => set({ langa_ceas: e.target.checked })} />
        La închiderea ferestrei, K.G.B. rămâne pornit lângă ceas (telefoanele și sincronizarea merg mai departe); „Ieșire” din meniul iconiței îl oprește.
      </label>
      <label className="row">
        <input type="checkbox" aria-label="Pornește cu Windows" checked={d.cu_windows} onChange={(e) => set({ cu_windows: e.target.checked })} />
        Pornește odată cu Windows, direct lângă ceas (pentru PC-ul care servește telefoanele).
      </label>
      <small className="muted">
        Se aplică doar acestui PC și utilizatorului Windows curent; se poate opri oricând de aici sau din Setările Windows (Aplicații → Pornire).
      </small>
    </div>
  );
}

export function SettingsPage(props: {
  reply: SettingsReply;
  info: AppInfo;
  onSave: (s: Settings) => Promise<void>;
  onInfoChanged: () => Promise<void>;
  onError: (e: string | null) => void;
}) {
  const s = props.reply.settings;
  const lang = useLang();
  const [owner, setOwner] = useState(props.info.owner?.display_name ?? "");
  const [wsName, setWsName] = useState(props.info.workspace?.name ?? "");

  useEffect(() => setOwner(props.info.owner?.display_name ?? ""), [props.info.owner]);
  useEffect(() => setWsName(props.info.workspace?.name ?? ""), [props.info.workspace]);

  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
      props.onError(null);
    } catch (e) {
      props.onError(message(e));
    }
    await props.onInfoChanged();
  };

  const saveOwner = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.renameOwner(owner, props.info.owner?.version ?? 0));
  };
  const saveWs = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.renameWorkspace(wsName));
  };

  return (
    <section className="settings">
      <h2>Aspect</h2>
      <div className="field">
        <label htmlFor="theme">Temă</label>
        <select
          id="theme"
          value={s.theme}
          onChange={(e) => void props.onSave({ ...s, theme: e.target.value as Theme })}
        >
          <option value="system">Ca sistemul</option>
          <option value="light">Luminoasă</option>
          <option value="dark">Întunecată</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="density">Densitate</label>
        <select
          id="density"
          value={s.density}
          onChange={(e) => void props.onSave({ ...s, density: e.target.value as Density })}
        >
          <option value="compact">Compactă</option>
          <option value="normal">Normală</option>
          <option value="comfortable">Aerisită</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="profile">Profil de lucru</label>
        <select id="profile" value={s.profile} onChange={(e) => void props.onSave({ ...s, profile: e.target.value })}>
          {props.reply.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <small className="muted">Profilul decide ce module activate apar în panoul lateral (alegi din Catalog).</small>
      </div>
      <div className="field">
        <label htmlFor="limba">Limbă</label>
        <select id="limba" value={lang} onChange={(e) => setLang(e.target.value as "ro" | "en")}>
          <option value="ro">Română</option>
          <option value="en">English</option>
        </select>
        <small className="muted">Aceeași alegere ca butoanele RO / EN de sub navigare; se păstrează pe acest calculator.</small>
      </div>

      <h2>Identitate</h2>
      <form className="field" onSubmit={saveOwner}>
        <label htmlFor="owner">Numele proprietarului</label>
        <div className="row">
          <input id="owner" value={owner} maxLength={80} onChange={(e) => setOwner(e.target.value)} />
          <button type="submit" disabled={!owner.trim() || owner.trim() === props.info.owner?.display_name}>
            Salvează
          </button>
        </div>
      </form>
      <form className="field" onSubmit={saveWs}>
        <label htmlFor="ws">Numele spațiului de lucru</label>
        <div className="row">
          <input id="ws" value={wsName} maxLength={80} onChange={(e) => setWsName(e.target.value)} />
          <button type="submit" disabled={!wsName.trim() || wsName.trim() === props.info.workspace?.name}>
            Salvează
          </button>
        </div>
      </form>
      <div className="field">
        <label>Amprenta acestui PC</label>
        <code>{props.info.device_fingerprint}</code>
        <small className="muted">
          Cheia dispozitivului a fost generată pe acest PC și e protejată de Windows. Va fi folosită la asocierea
          altor PC-uri (Etapa 6).
        </small>
      </div>

      <h2>Internet</h2>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={s.internet !== false}
            onChange={(e) => void props.onSave({ ...s, internet: e.target.checked })}
          />{" "}
          Permite cereri către internet făcute de tine
        </label>
        <small className="muted">
          Doar când le ceri: „Din web…” în foile de calcul și marca temporală la semnătura PDF. Aplicația nu trimite
          nimic singură și nu ajunge la calculatoarele din rețeaua firmei. Într-o organizație, doar administratorul
          schimbă setarea.
        </small>
      </div>

      <h2>Pe acest PC</h2>
      <ThisPc onError={props.onError} />

      <h2>Comenzi rapide</h2>
      <dl className="facts">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} className="contents">
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
