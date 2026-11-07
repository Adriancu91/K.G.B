// Forms (Etapa 4, step 4.9): define fields, fill them in, keep and export
// the answers. The module checks every answer against the form's definition.
import { useCallback, useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";

const ID = "kgb.docs";
type Kind = "text" | "numar" | "data" | "lista";
const KIND: Record<Kind, string> = {
  text: "Text",
  numar: "Număr",
  data: "Dată",
  lista: "Listă",
};

interface FieldDef {
  cheie?: string;
  eticheta: string;
  tip: Kind;
  obligatoriu: boolean;
  optiuni: string[];
  min?: number | null;
  max?: number | null;
}
interface Form {
  id: string;
  version: number;
  nume: string;
  descriere: string | null;
  versiune: number;
  campuri: FieldDef[];
  raspunsuri: number;
}
interface Answer {
  id: string;
  formular_versiune: number;
  valori: Record<string, string | number | null>;
  creat_ms: number;
}

const roDate = (iso: string) => iso.split("-").reverse().join(".");
const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function Editor(props: {
  form: Form | null;
  busy: boolean;
  error: string | null;
  onSave: (f: { nume: string; descriere: string; campuri: FieldDef[] }) => void;
  onCancel: () => void;
}) {
  const [nume, setNume] = useState(props.form?.nume ?? "");
  const [descriere, setDescriere] = useState(props.form?.descriere ?? "");
  const [fields, setFields] = useState<FieldDef[]>(
    props.form?.campuri ?? [
      { eticheta: "", tip: "text", obligatoriu: true, optiuni: [] },
    ],
  );
  const [opts, setOpts] = useState<string[]>(() =>
    fields.map((f) => f.optiuni.join(", ")),
  );
  const set = (i: number, patch: Partial<FieldDef>) =>
    setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const num = (s: string) =>
    s.trim() === "" ? null : Number(s.replace(",", "."));
  return (
    <div className="overlay" role="presentation" onClick={props.onCancel}>
      <div
        className="dialog wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-ed-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="form-ed-title">
          {props.form ? "Modifică formularul" : "Formular nou"}
        </h2>
        {props.form && props.form.raspunsuri > 0 && (
          <p className="muted small">
            Formularul are deja {props.form.raspunsuri} răspunsuri: modificarea
            câmpurilor creează versiunea {props.form.versiune + 1}. Răspunsurile
            vechi rămân cu versiunea lor.
          </p>
        )}
        <form
          className="task-form"
          onSubmit={(e) => {
            e.preventDefault();
            props.onSave({
              nume,
              descriere,
              campuri: fields.map((f, i) => ({
                ...f,
                optiuni:
                  f.tip === "lista"
                    ? (opts[i] ?? "")
                        .split(",")
                        .map((o) => o.trim())
                        .filter(Boolean)
                    : [],
              })),
            });
          }}
        >
          <label>
            Numele formularului
            <input
              aria-label="Numele formularului"
              value={nume}
              maxLength={200}
              onChange={(e) => setNume(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            Descriere
            <input
              aria-label="Descrierea formularului"
              value={descriere}
              maxLength={2000}
              onChange={(e) => setDescriere(e.target.value)}
            />
          </label>
          <fieldset>
            <legend>Câmpuri</legend>
            {fields.map((f, i) => (
              <div key={i} className="row wrap form-field">
                <input
                  aria-label={`Eticheta câmpului ${i + 1}`}
                  placeholder="Eticheta"
                  value={f.eticheta}
                  maxLength={200}
                  onChange={(e) => set(i, { eticheta: e.target.value })}
                />
                <select
                  aria-label={`Tipul câmpului ${i + 1}`}
                  value={f.tip}
                  onChange={(e) => set(i, { tip: e.target.value as Kind })}
                >
                  {Object.entries(KIND).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={f.obligatoriu}
                    onChange={(e) => set(i, { obligatoriu: e.target.checked })}
                  />{" "}
                  obligatoriu
                </label>
                {f.tip === "lista" && (
                  <input
                    aria-label={`Opțiunile câmpului ${i + 1}`}
                    placeholder="Opțiuni, separate prin virgulă"
                    value={opts[i] ?? ""}
                    onChange={(e) =>
                      setOpts(
                        opts
                          .map((o, j) => (j === i ? e.target.value : o))
                          .concat(i >= opts.length ? [e.target.value] : []),
                      )
                    }
                  />
                )}
                {f.tip === "numar" && (
                  <>
                    <input
                      aria-label={`Minimul câmpului ${i + 1}`}
                      className="short"
                      placeholder="min"
                      defaultValue={f.min ?? ""}
                      onChange={(e) => set(i, { min: num(e.target.value) })}
                    />
                    <input
                      aria-label={`Maximul câmpului ${i + 1}`}
                      className="short"
                      placeholder="max"
                      defaultValue={f.max ?? ""}
                      onChange={(e) => set(i, { max: num(e.target.value) })}
                    />
                  </>
                )}
                <button
                  type="button"
                  className="link"
                  disabled={fields.length === 1}
                  onClick={() => {
                    setFields(fields.filter((_, j) => j !== i));
                    setOpts(opts.filter((_, j) => j !== i));
                  }}
                >
                  Scoate
                </button>
              </div>
            ))}
            <button
              type="button"
              className="link"
              onClick={() => {
                setFields([
                  ...fields,
                  {
                    eticheta: "",
                    tip: "text",
                    obligatoriu: false,
                    optiuni: [],
                  },
                ]);
                setOpts([...opts, ""]);
              }}
            >
              + Adaugă un câmp
            </button>
          </fieldset>
          {props.error && (
            <p className="error" role="alert">
              {props.error}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" onClick={props.onCancel}>
              Renunță
            </button>
            <button
              type="submit"
              className="primary"
              disabled={
                props.busy ||
                !nume.trim() ||
                fields.some((f) => !f.eticheta.trim())
              }
            >
              Salvează formularul
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Fill(props: {
  form: Form;
  busy: boolean;
  error: string | null;
  onSave: (v: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  return (
    <div className="overlay" role="presentation" onClick={props.onCancel}>
      <div
        className="dialog wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fill-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="fill-title">{props.form.nume}</h2>
        {props.form.descriere && (
          <p className="muted">{props.form.descriere}</p>
        )}
        <form
          className="task-form"
          onSubmit={(e) => {
            e.preventDefault();
            props.onSave(vals);
          }}
        >
          {props.form.campuri.map((f) => {
            const k = f.cheie ?? "";
            const label = `${f.eticheta}${f.obligatoriu ? " *" : ""}`;
            const common = { "aria-label": f.eticheta, value: vals[k] ?? "" };
            return (
              <label key={k}>
                {label}
                {f.tip === "lista" ? (
                  <select
                    {...common}
                    onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
                  >
                    <option value="">— alege —</option>
                    {f.optiuni.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...common}
                    type={f.tip === "data" ? "date" : "text"}
                    inputMode={f.tip === "numar" ? "decimal" : undefined}
                    maxLength={2000}
                    placeholder={
                      f.tip === "numar"
                        ? [
                            f.min != null ? `min ${f.min}` : "",
                            f.max != null ? `max ${f.max}` : "",
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : undefined
                    }
                    onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
                  />
                )}
              </label>
            );
          })}
          <p className="muted small">* obligatoriu</p>
          {props.error && (
            <p className="error" role="alert">
              {props.error}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" onClick={props.onCancel}>
              Renunță
            </button>
            <button type="submit" className="primary" disabled={props.busy}>
              Salvează răspunsul
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function FormsView({
  onError,
}: {
  onError: (e: string | null) => void;
}) {
  const [forms, setForms] = useState<Form[]>([]);
  const [editing, setEditing] = useState<Form | "new" | null>(null);
  const [filling, setFilling] = useState<Form | null>(null);
  const [showing, setShowing] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Errors of an open dialog are shown inside it (the page's banner is behind it).
  const [dialogError, setDialogError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const f = await api.moduleCall<Form[]>(ID, "forms");
      setForms(f);
      if (showing)
        setAnswers(
          await api.moduleCall<Answer[]>(ID, "answers", { id: showing }),
        );
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError, showing]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Errors stay on screen and the dialog stays open, so nothing typed is lost.
  const run = async (f: () => Promise<unknown>, inDialog = false) => {
    setBusy(true);
    try {
      await f();
      onError(null);
      setDialogError(null);
    } catch (e) {
      if (inDialog) setDialogError(message(e));
      else onError(message(e));
    } finally {
      setBusy(false);
    }
    await refresh();
  };

  const current = forms.find((f) => f.id === showing) ?? null;
  const exportAs = (format: "xlsx" | "csv") =>
    current &&
    run(async () => {
      const dest = await save({
        defaultPath: `${current.nume}.${format}`,
        filters: [
          format === "xlsx"
            ? { name: "Excel", extensions: ["xlsx"] }
            : { name: "CSV", extensions: ["csv"] },
        ],
      });
      if (!dest) return;
      const r = await api.moduleCall<{ raspunsuri: number }>(
        ID,
        "export_answers",
        { formular: current.id, format, stil: "ro", dest },
      );
      setNotice(
        `Salvat: ${dest} (${r.raspunsuri} răspunsuri). Fișierul a fost redeschis și verificat celulă cu celulă.`,
      );
    });

  return (
    <div className="forms">
      <div className="row">
        <button
          className="primary"
          disabled={busy}
          onClick={() => setEditing("new")}
        >
          + Formular nou
        </button>
      </div>
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {forms.length === 0 && (
        <p className="muted">
          Niciun formular încă. Un formular are câmpuri de tip text, număr, dată
          sau listă.
        </p>
      )}
      <div className="cards">
        {forms.map((f) => (
          <article key={f.id} className="card form-card" data-form={f.nume}>
            <header>
              <h3>{f.nume}</h3>
              <span className="badge">v{f.versiune}</span>
            </header>
            {f.descriere && <p className="muted small">{f.descriere}</p>}
            <p className="muted small">
              {f.campuri.length} câmpuri · {f.raspunsuri} răspunsuri
            </p>
            <div className="row wrap">
              <button
                className="primary"
                disabled={busy}
                onClick={() => setFilling(f)}
              >
                Completează…
              </button>
              <button onClick={() => setShowing(f.id)}>Răspunsuri</button>
              <button className="link" onClick={() => setEditing(f)}>
                Modifică
              </button>
              <button
                className="danger-text"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    api.moduleCall(ID, "form_delete", { id: f.id }),
                  )
                }
              >
                Șterge
              </button>
            </div>
          </article>
        ))}
      </div>

      {current && (
        <section className="answers">
          <div className="row wrap">
            <h2 className="grow">Răspunsuri: {current.nume}</h2>
            <button
              disabled={answers.length === 0}
              onClick={() => void exportAs("xlsx")}
            >
              Exportă XLSX…
            </button>
            <button
              disabled={answers.length === 0}
              onClick={() => void exportAs("csv")}
            >
              Exportă CSV…
            </button>
          </div>
          <div className="table-scroll">
            <table className="audit answers-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>v</th>
                  {current.campuri.map((c) => (
                    <th key={c.cheie}>{c.eticheta}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {answers.length === 0 && (
                  <tr>
                    <td colSpan={current.campuri.length + 3} className="muted">
                      Niciun răspuns încă.
                    </td>
                  </tr>
                )}
                {answers.map((a) => (
                  <tr key={a.id}>
                    <td>{when(a.creat_ms)}</td>
                    <td>{a.formular_versiune}</td>
                    {current.campuri.map((c) => {
                      const v = a.valori[c.cheie ?? ""];
                      return (
                        <td key={c.cheie}>
                          {v == null
                            ? ""
                            : c.tip === "data"
                              ? roDate(String(v))
                              : c.tip === "numar"
                                ? Number(v).toLocaleString("ro-RO")
                                : String(v)}
                        </td>
                      );
                    })}
                    <td>
                      <button
                        className="danger-text"
                        aria-label="Șterge răspunsul"
                        onClick={() =>
                          void run(() =>
                            api.moduleCall(ID, "answer_delete", { id: a.id }),
                          )
                        }
                      >
                        Șterge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <Editor
          form={editing === "new" ? null : editing}
          busy={busy}
          error={dialogError}
          onCancel={() => {
            setEditing(null);
            setDialogError(null);
          }}
          onSave={(f) =>
            void run(async () => {
              const ed = editing;
              const r = await api.moduleCall<Form>(ID, "form_save", {
                ...(ed !== "new" && ed
                  ? { id: ed.id, version: ed.version }
                  : {}),
                nume: f.nume,
                descriere: f.descriere,
                campuri: f.campuri,
              });
              setEditing(null);
              setNotice(
                `Formularul „${r.nume}” a fost salvat (versiunea ${r.versiune}).`,
              );
            }, true)
          }
        />
      )}
      {filling && (
        <Fill
          form={filling}
          busy={busy}
          error={dialogError}
          onCancel={() => {
            setFilling(null);
            setDialogError(null);
          }}
          onSave={(valori) =>
            void run(async () => {
              await api.moduleCall(ID, "answer_save", {
                formular: filling.id,
                valori,
              });
              setShowing(filling.id);
              setFilling(null);
              setNotice("Răspunsul a fost verificat și salvat.");
            }, true)
          }
        />
      )}
    </div>
  );
}
