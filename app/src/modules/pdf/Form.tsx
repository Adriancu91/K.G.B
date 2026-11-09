// PDF forms (Etapa 7, step 7.4l-1e): fill the fields, empty them, flatten
// them, and move the values in and out as XFDF / FDF / CSV — the code of
// Cyber Office Studio (forms.ts, formdata.ts, D-071/D-072). Every change is
// checked by the PDF module and becomes a new version after a preview.
import { useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { api } from "../../api";
import { fromBase64 } from "./pdfjs";
import { clearForm, flattenForm } from "./forms";
import { fillForm, type FormValue, isFdf, parseFdf, parseFormData, readFormValues, valuesToCsv, valuesToFdf, valuesToXfdf } from "./formdata";

const toB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

export function FormPanel(props: {
  docId: string;
  version: number;
  name: string;
  pages: number;
  busy: boolean;
  ask: (title: string, command: string, args: Record<string, unknown>) => Promise<void>;
  onError: (e: string | null) => void;
  onNotice: (m: string) => void;
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [values, setValues] = useState<FormValue[] | null>(null);
  const all = Array.from({ length: props.pages }, (_, i) => i + 1);
  const base = props.name.replace(/\.pdf$/i, "");

  useEffect(() => {
    let gone = false;
    void (async () => {
      try {
        const r = await api.moduleCall<{ data: string }>("kgb.pdf", "read", { id: props.docId, version: props.version });
        const b = fromBase64(r.data);
        const v = await readFormValues(b);
        if (!gone) {
          setBytes(b);
          setValues(v);
        }
      } catch (e) {
        if (!gone) props.onError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.docId, props.version]);

  if (!values || !bytes) return <div className="card pdf-form muted">Se citește formularul…</div>;
  if (values.length === 0) return <div className="card pdf-form muted">Documentul nu are câmpuri de formular.</div>;

  const set = (i: number, v: FormValue["value"]) => setValues(values.map((x, j) => (j === i ? { ...x, value: v } : x)));
  const asVersion = (title: string, summary: string, out: Uint8Array, sameText: boolean) =>
    props.ask(title, "save_edit", { id: props.docId, based_on: props.version, data: toB64(out), summary, same_text_pages: sameText ? all : [] });
  const exportAs = async (ext: "xfdf" | "fdf" | "csv") => {
    const dest = await save({ defaultPath: `${base}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!dest) return;
    const text = ext === "xfdf" ? valuesToXfdf(values, props.name) : ext === "fdf" ? valuesToFdf(values, props.name) : valuesToCsv(values);
    await api.moduleCall("kgb.pdf", "save_text", { dest, text, overwrite: true });
    props.onNotice(`Datele formularului (${values.length} câmpuri) au fost salvate: ${dest}`);
  };

  return (
    <div className="card pdf-form">
      <table className="audit">
        <tbody>
          {values.map((f, i) => (
            <tr key={f.name}>
              <td className="small">{f.name}</td>
              <td>
                {typeof f.value === "boolean" ? (
                  <input type="checkbox" aria-label={`Câmpul ${f.name}`} checked={f.value} onChange={(e) => set(i, e.target.checked)} />
                ) : Array.isArray(f.value) ? (
                  <input aria-label={`Câmpul ${f.name}`} value={f.value.join(", ")} onChange={(e) => set(i, e.target.value.split(/,\s*/).filter(Boolean))} />
                ) : (
                  <input aria-label={`Câmpul ${f.name}`} value={f.value} onChange={(e) => set(i, e.target.value)} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row wrap">
        <button
          className="primary"
          disabled={props.busy}
          onClick={() =>
            void (async () => {
              const r = await fillForm(bytes, values);
              await asVersion("Formular completat", `formular completat (${r.filled} câmpuri)`, r.bytes, true);
            })().catch((e: unknown) => props.onError(e instanceof Error ? e.message : String(e)))
          }
        >
          Salvează valorile
        </button>
        <button
          disabled={props.busy}
          onClick={() =>
            void (async () => {
              const r = await clearForm(bytes);
              await asVersion("Formular golit", `formular golit (${r.cleared} câmpuri)`, r.bytes, true);
            })().catch((e: unknown) => props.onError(e instanceof Error ? e.message : String(e)))
          }
        >
          Golește formularul
        </button>
        <button
          disabled={props.busy}
          onClick={() =>
            void (async () => {
              const r = await flattenForm(bytes);
              await asVersion("Formular aplatizat", `formular aplatizat: ${r.fields} câmpuri devin text fix`, r.bytes, false);
            })().catch((e: unknown) => props.onError(e instanceof Error ? e.message : String(e)))
          }
        >
          Aplatizează (câmpurile devin text fix)
        </button>
      </div>
      <div className="row wrap">
        <span className="small">Datele formularului:</span>
        <button onClick={() => void exportAs("xfdf").catch((e: unknown) => props.onError(String(e)))}>Exportă XFDF</button>
        <button onClick={() => void exportAs("fdf").catch((e: unknown) => props.onError(String(e)))}>Exportă FDF</button>
        <button onClick={() => void exportAs("csv").catch((e: unknown) => props.onError(String(e)))}>Exportă CSV</button>
        <label className="small">
          Importă (XFDF, FDF sau CSV):{" "}
          <input
            type="file"
            aria-label="Importă datele formularului"
            accept=".xfdf,.fdf,.csv,.xml,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void f
                .arrayBuffer()
                .then((buf) => {
                  const data = new Uint8Array(buf);
                  const got = isFdf(data) ? parseFdf(data) : parseFormData(new TextDecoder().decode(data));
                  const byName = new Map(got.map((g) => [g.name, g.value]));
                  setValues(values.map((v) => (byName.has(v.name) ? { ...v, value: byName.get(v.name)! } : v)));
                  props.onNotice(`Din „${f.name}”: ${got.length} valori citite; verifică-le, apoi „Salvează valorile”.`);
                })
                .catch((err: unknown) => props.onError(err instanceof Error ? err.message : String(err)));
            }}
          />
        </label>
      </div>
      <p className="muted small">Codul formularelor e cel din Cyber Office Studio. Fiecare schimbare e verificată și devine o versiune nouă, după previzualizare.</p>
    </div>
  );
}
