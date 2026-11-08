// Documents and models (Etapa 4, step 4.8): Word models with {{fields}},
// company data entered once, generated documents kept with their model.
import { useCallback, useEffect, useState } from "react";
import { SuggestInput, cardToParty, fold, matches, partyOf, partyToCard, rememberPartner } from "../../components/PartnerSuggest";
import type { Partner } from "../../pages/PartnersPage";
import { AnafLookup, fullAddress } from "../../components/AnafLookup";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";
import { FormsView } from "./forms";

const ID = "kgb.docs";
const CATEGORY: Record<string, string> = {
  administrativ: "Administrative",
  comercial: "Comerciale",
  hr: "Resurse umane",
  tehnic: "Tehnice",
  altele: "Altele",
};

interface Field {
  camp: string;
  eticheta: string;
  din_firma: boolean;
}
interface Model {
  id: string;
  nume: string;
  categorie: string;
  sursa: "inclus" | "importat";
  /** `docx` (Word) or `pdf` (built-in Typst model). */
  format: "docx" | "pdf";
  versiune: number;
  campuri: Field[];
}
interface Generated {
  id: string;
  nume: string;
  model_nume: string;
  model_versiune: number;
  format?: "docx" | "pdf";
  creat_ms: number;
  valori?: Record<string, string>;
}
interface Company {
  campuri: { camp: string; eticheta: string; valoare: string }[];
  version: number | null;
}

const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

function GenerateDialog(props: {
  model: Model;
  company: Company;
  busy: boolean;
  error: string | null;
  onGenerate: (valori: Record<string, string>, nume: string) => void;
  onCancel: () => void;
  onCompany: () => void;
  /** Documents generated before: their party values become suggestions (7.4c). */
  past: Generated[];
}) {
  const { model, company, past } = props;
  const own = model.campuri.filter((f) => !f.din_firma);
  const fromCompany = model.campuri.filter((f) => f.din_firma);
  const companyValue = (camp: string) => company.campuri.find((c) => `firma.${c.camp}` === camp)?.valoare ?? "";
  const missingCompany = fromCompany.filter((f) => !companyValue(f.camp));
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(own.map((f) => [f.camp, f.camp === "data" ? today() : ""])),
  );
  const [name, setName] = useState(`${model.nume} ${today()}`);
  const empty = own.filter((f) => !vals[f.camp]?.trim());
  const partyCamps = (root: string) => own.filter((x) => partyOf(x.camp) === root).map((x) => x.camp);
  const fromPast = useCallback(
    (root: string) => (q: string) => {
      const seen = new Set<string>();
      const out: Partner[] = [];
      for (const g of past) {
        if (!g.valori) continue;
        const c = partyToCard(root, g.valori);
        if (c.denumire && !seen.has(fold(c.denumire)) && matches(c, q)) {
          seen.add(fold(c.denumire));
          out.push(c);
        }
      }
      return out;
    },
    [past],
  );
  return (
    <div className="overlay" role="presentation" onClick={props.onCancel}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="gen-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="gen-title">{model.nume}</h2>
        <form
          className="task-form"
          onSubmit={(e) => {
            e.preventDefault();
            props.onGenerate(vals, name);
          }}
        >
          <label>
            Numele documentului
            <input aria-label="Numele documentului" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
          </label>
          {own.map((f) => {
            const root = partyOf(f.camp);
            return (
              <label key={f.camp}>
                {f.eticheta}
                {root ? (
                  <SuggestInput
                    ariaLabel={f.eticheta}
                    value={vals[f.camp] ?? ""}
                    maxLength={2000}
                    onChange={(v) => setVals((x) => ({ ...x, [f.camp]: v }))}
                    onPick={(card) => setVals((x) => ({ ...x, ...cardToParty(card, partyCamps(root)) }))}
                    extra={fromPast(root)}
                  />
                ) : (
                  <input aria-label={f.eticheta} value={vals[f.camp] ?? ""} maxLength={2000} onChange={(e) => setVals({ ...vals, [f.camp]: e.target.value })} />
                )}
              </label>
            );
          })}
          {fromCompany.length > 0 && (
            <fieldset>
              <legend>Din „Date firmă” (nu se schimbă aici)</legend>
              <dl className="facts">
                {fromCompany.map((f) => (
                  <div key={f.camp} className="contents">
                    <dt>{f.eticheta.replace("Firma · ", "")}</dt>
                    <dd className={companyValue(f.camp) ? "" : "error"}>{companyValue(f.camp) || "lipsește"}</dd>
                  </div>
                ))}
              </dl>
              {missingCompany.length > 0 && (
                <p className="warn">
                  Completează mai întâi datele firmei.{" "}
                  <button type="button" className="link" onClick={props.onCompany}>
                    Deschide „Date firmă”
                  </button>
                </p>
              )}
            </fieldset>
          )}
          {props.error && (
            <p className="error" role="alert">
              {props.error}
            </p>
          )}
          <div className="dialog-actions">
            {empty.length > 0 && <span className="muted small grow">Mai ai de completat: {empty.map((f) => f.eticheta).join(", ")}</span>}
            <button type="button" onClick={props.onCancel}>
              Renunță
            </button>
            <button type="submit" className="primary" disabled={props.busy || empty.length > 0 || missingCompany.length > 0 || !name.trim()}>
              Generează documentul
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DocsPage({ onError }: { onError: (e: string | null) => void }) {
  const [tab, setTab] = useState<"modele" | "generate" | "formulare" | "firma">("modele");
  const [models, setModels] = useState<Model[]>([]);
  const [generated, setGenerated] = useState<Generated[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [filling, setFilling] = useState<Model | null>(null);
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [m, g, c] = await Promise.all([
        api.moduleCall<Model[]>(ID, "models"),
        api.moduleCall<Generated[]>(ID, "generated"),
        api.moduleCall<Company>(ID, "company"),
      ]);
      setModels(m);
      setGenerated(g);
      setCompany(c);
      setForm(Object.fromEntries(c.campuri.map((f) => [f.camp, f.valoare])));
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
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

  const importModel = () =>
    run(async () => {
      const path = await open({ multiple: false, filters: [{ name: "Word", extensions: ["docx"] }] });
      if (typeof path !== "string") return;
      const m = await api.importFile<Model>(ID, path);
      setNotice(`Modelul „${m.nume}” a fost adăugat la „Altele”, cu ${m.campuri.length} câmpuri. Îi poți schimba categoria mai jos.`);
    });

  const showPreview = (id: string) =>
    run(async () => {
      const r = await api.moduleCall<{ text: string }>(ID, "text", { id });
      setPreview({ id, text: r.text });
    });

  return (
    <section className="docs">
      <p className="muted">
        Modul beta. Modelele sunt fișiere Word cu câmpuri între acolade duble, de exemplu {"{{client}}"}. Modelul original nu se
        schimbă; fiecare document generat se păstrează separat.
      </p>
      <div className="sheet-tabs" role="tablist">
        {(["modele", "generate", "formulare", "firma"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "modele" ? `Modele (${models.length})` : t === "generate" ? `Documente generate (${generated.length})` : t === "formulare" ? "Formulare" : "Date firmă"}
          </button>
        ))}
      </div>
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}

      {tab === "modele" && (
        <>
          <div className="row">
            <button disabled={busy} onClick={() => void importModel()}>
              Importă un model Word…
            </button>
          </div>
          {Object.entries(CATEGORY).map(([cat, label]) => {
            const list = models.filter((m) => m.categorie === cat);
            if (list.length === 0) return null;
            return (
              <div key={cat}>
                <h2>{label}</h2>
                <div className="cards">
                  {list.map((m) => (
                    <article key={m.id} className="card model-card" data-model={m.nume}>
                      <header>
                        <h3>{m.nume}</h3>
                        <span className="row">
                          <span className="badge">{m.format === "pdf" ? "PDF" : "Word"}</span>
                          <span className={`badge ${m.sursa === "inclus" ? "stable" : "beta"}`}>{m.sursa === "inclus" ? "inclus" : "importat"}</span>
                        </span>
                      </header>
                      <p className="muted small">
                        Versiunea {m.versiune} · {m.campuri.length} câmpuri: {m.campuri.slice(0, 6).map((f) => f.eticheta).join(", ")}
                        {m.campuri.length > 6 ? "…" : ""}
                      </p>
                      <div className="row wrap">
                        <button className="primary" disabled={busy} onClick={() => setFilling(m)}>
                          Completează…
                        </button>
                        {m.sursa === "importat" && (
                          <>
                            <select
                              aria-label={`Categoria: ${m.nume}`}
                              value={m.categorie}
                              onChange={(e) => void run(() => api.moduleCall(ID, "model_set", { id: m.id, categorie: e.target.value }))}
                            >
                              {Object.entries(CATEGORY).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            <button className="danger-text" disabled={busy} onClick={() => void run(() => api.moduleCall(ID, "model_delete", { id: m.id }))}>
                              Șterge modelul
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === "generate" && (
        <>
          <table className="audit generated">
            <thead>
              <tr>
                <th>Document</th>
                <th>Model (versiunea)</th>
                <th>Creat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {generated.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Niciun document încă. Alege un model și apasă „Completează…”.
                  </td>
                </tr>
              )}
              {generated.map((g) => (
                <tr key={g.id}>
                  <td>{g.nume}</td>
                  <td>
                    {g.model_nume} (v{g.model_versiune})
                  </td>
                  <td>{when(g.creat_ms)}</td>
                  <td className="row">
                    <button className="link" onClick={() => void showPreview(g.id)}>
                      Previzualizează
                    </button>
                    <button
                      className="link"
                      onClick={() =>
                        void run(async () => {
                          const pdf = g.format === "pdf";
                          const dest = await save({
                            defaultPath: `${g.nume}.${pdf ? "pdf" : "docx"}`,
                            filters: [pdf ? { name: "PDF", extensions: ["pdf"] } : { name: "Word", extensions: ["docx"] }],
                          });
                          if (!dest) return;
                          await api.moduleCall(ID, "export", { id: g.id, dest });
                          setNotice(`Salvat: ${dest}`);
                        })
                      }
                    >
                      Exportă {g.format === "pdf" ? ".pdf" : ".docx"}…
                    </button>
                    <button className="danger-text" aria-label={`Șterge ${g.nume}`} onClick={() => void run(() => api.moduleCall(ID, "delete_generated", { id: g.id }))}>
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview && (
            <div className="card doc-preview">
              <header>
                <h3>Previzualizare (text)</h3>
                <button className="link" onClick={() => setPreview(null)}>
                  închide
                </button>
              </header>
              <pre>{preview.text}</pre>
              <p className="muted small">Doar textul; aspectul complet îl vezi deschizând fișierul exportat.</p>
            </div>
          )}
        </>
      )}

      {tab === "formulare" && <FormsView onError={onError} />}

      {tab === "firma" && company && (
        <form
          className="task-form company-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.moduleCall(ID, "company_save", { valori: form, ...(company.version ? { version: company.version } : {}) });
              setNotice("Datele firmei au fost salvate. Ele se folosesc în toate documentele noi.");
            });
          }}
        >
          <p className="muted">Aceste date apar în documente prin câmpurile {"{{firma.…}}"}. Se completează doar aici.</p>
          <AnafLookup
            cui={form.cui ?? ""}
            onFound={(c) =>
              setForm((f) => ({
                ...f,
                nume: c.denumire || (f.nume ?? ""),
                reg_com: c.nr_reg_com || (f.reg_com ?? ""),
                adresa: fullAddress(c) || (f.adresa ?? ""),
                telefon: c.telefon || (f.telefon ?? ""),
              }))
            }
          />
          <div className="company-grid">
            {company.campuri.map((f) => (
              <label key={f.camp}>
                {f.eticheta}
                <input aria-label={f.eticheta} value={form[f.camp] ?? ""} maxLength={300} onChange={(e) => setForm({ ...form, [f.camp]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <button type="submit" className="primary" disabled={busy}>
              Salvează datele firmei
            </button>
          </div>
        </form>
      )}

      {filling && company && (
        <GenerateDialog
          model={filling}
          company={company}
          past={generated}
          busy={busy}
          error={dialogError}
          onCancel={() => {
            setFilling(null);
            setDialogError(null);
          }}
          onCompany={() => {
            setFilling(null);
            setTab("firma");
          }}
          onGenerate={(valori, nume) =>
            void (async () => {
              setBusy(true);
              try {
              const r = await api.moduleCall<{ id: string; nume: string; inlocuiri: number }>(ID, "generate", { model: filling.id, valori, nume });
              setFilling(null);
              setTab("generate");
              // What was typed for each party stays in the partner directory (7.4c).
              const roots = [...new Set(Object.keys(valori).map(partyOf).filter((x): x is string => !!x))];
              const kept = (await Promise.all(roots.map((root) => rememberPartner(partyToCard(root, valori), "document")))).filter(Boolean);
              setNotice(`Documentul „${r.nume}” a fost generat (${r.inlocuiri} câmpuri completate) și verificat.${kept.length ? " " + kept.join(" ") : ""}`);
              const t = await api.moduleCall<{ text: string }>(ID, "text", { id: r.id });
              setPreview({ id: r.id, text: t.text });
                setDialogError(null);
              } catch (e) {
                // Shown in the dialog, which stays open with what was typed.
                setDialogError(message(e));
              } finally {
                setBusy(false);
              }
              await refresh();
            })()
          }
        />
      )}
    </section>
  );
}
