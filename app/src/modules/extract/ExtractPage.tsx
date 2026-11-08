// Interface of the kgb.extract module (Etapa 3, step 3.9; Master Plan §6.4).
// Choose a file → see each found value with its source and confidence →
// confirm or correct the uncertain ones → import into the invoice register;
// every import is journaled. Nothing uncertain is imported silently.
import { useCallback, useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";
import { Confirm } from "../../components/Confirm";

const ID = "kgb.extract";

interface Doc {
  id: string;
  name: string;
  current: number;
}
interface Source {
  kind: "pagina" | "celula";
  page?: number;
  line?: number;
  sheet?: string;
  cell?: string;
}
interface FieldView {
  key: string;
  label: string;
  required: boolean;
  value: string;
  level: "sigur" | "de verificat" | "incert" | "lipsă";
  confidence: number;
  note: string;
  context?: string;
  source?: Source;
}
interface Extraction {
  document: string;
  version: number;
  fields: FieldView[];
}
type Rec = Record<string, string | number | null>;

const where = (s?: Source) =>
  !s ? "—" : s.kind === "pagina" ? `pagina ${s.page}, rândul ${s.line}` : `${s.sheet}!${s.cell}`;
const levelClass: Record<string, string> = { sigur: "stable", "de verificat": "beta", incert: "disabled", lipsă: "planned" };
const when = (ms: number) => new Date(ms).toLocaleString("ro-RO");

export function ExtractPage({ onError }: { onError: (e: string | null) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [x, setX] = useState<Extraction | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [records, setRecords] = useState<Rec[]>([]);
  const [journal, setJournal] = useState<Rec[]>([]);
  const [tab, setTab] = useState<"extragere" | "registru" | "jurnal">("extragere");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Doc | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await api.moduleCall<Doc[]>(ID, "list"));
      setRecords(await api.moduleCall<Rec[]>(ID, "records"));
      setJournal(await api.moduleCall<Rec[]>(ID, "journal"));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!current) return;
    void (async () => {
      try {
        const r = await api.moduleCall<Extraction>(ID, "extract", { id: current });
        setX(r);
        setValues(Object.fromEntries(r.fields.map((f) => [f.key, f.value])));
        setConfirmed({});
        onError(null);
      } catch (e) {
        setX(null);
        onError(message(e));
      }
    })();
  }, [current, onError]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const onImportFile = () =>
    run(async () => {
      const picked = await open({ multiple: false, filters: [{ name: "Facturi", extensions: ["pdf", "xlsx", "xlsm", "xls", "ods", "csv"] }] });
      if (!picked || Array.isArray(picked)) return;
      const r = await api.importFile<{ document: Doc }>(ID, picked);
      await refresh();
      setTab("extragere");
      setCurrent(r.document.id);
    });

  const changed = (f: FieldView) => (values[f.key] ?? "") !== f.value;
  const needsConfirm = (f: FieldView) => (values[f.key] ?? "").trim() !== "" && (f.level !== "sigur" || changed(f));

  const onConfirm = () =>
    run(async () => {
      if (!x || !current) return;
      const conf = x.fields.filter((f) => confirmed[f.key]).map((f) => f.key);
      const r = await api.moduleCall<{ record: Rec; corectate: string[] }>(ID, "confirm", { id: current, values, confirmed: conf });
      setNotice(`Factura ${r.record.numar} a fost importată în registru${r.corectate.length ? ` (corectate: ${r.corectate.join(", ")})` : ""}.`);
      await refresh();
      setTab("registru");
    });

  const onExport = () =>
    run(async () => {
      const dest = await save({ defaultPath: "Facturi extrase.csv", filters: [{ name: "CSV", extensions: ["csv"] }] });
      if (!dest) return;
      const r = await api.moduleCall<{ records: number }>(ID, "export_records", { dest, style: "ro" });
      setNotice(`${r.records} facturi salvate în ${dest}`);
    });

  const missingConfirm = x?.fields.filter((f) => needsConfirm(f) && !confirmed[f.key]).length ?? 0;

  return (
    <section className="extract">
      <p className="muted">
        Modul beta. Găsește datele facturilor în PDF-uri cu text și în foi de calcul. Fiecare valoare arată de unde vine
        și cât de sigură e; ce nu e „sigur” se importă doar după ce îl confirmi. PDF-urile scanate (fără text) nu sunt încă
        acceptate.
      </p>
      <div className="row wrap">
        <button className="primary" disabled={busy} onClick={() => void onImportFile()}>
          Alege o factură…
        </button>
        <div className="sheet-tabs" role="tablist">
          {(["extragere", "registru", "jurnal"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t === "extragere" ? "Extragere" : t === "registru" ? `Registru facturi (${records.length})` : `Jurnal (${journal.length})`}
            </button>
          ))}
        </div>
        {notice && <span className="muted grow">{notice}</span>}
      </div>

      {toDelete && (
        <Confirm
          title={`Ștergi „${toDelete.name}”?`}
          confirmLabel="Șterge"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const d = toDelete;
            setToDelete(null);
            void run(async () => {
              await api.moduleCall(ID, "delete", { id: d.id });
              if (current === d.id) {
                setCurrent(null);
                setX(null);
              }
              await refresh();
              setNotice(`Șters: ${d.name}`);
            });
          }}
        >
          Documentul dispare din listă. Facturile deja importate în registru rămân acolo.
        </Confirm>
      )}

      {tab === "extragere" && (
        <div className="pdf-layout">
          <ul className="list pdf-docs" aria-label="Documente">
            {docs.length === 0 && <li className="muted">Niciun document ales.</li>}
            {docs.map((d) => (
              <li key={d.id} className={d.id === current ? "active" : ""}>
                <button className="link grow" onClick={() => setCurrent(d.id)}>
                  {d.name}
                </button>
                <button className="danger-text" aria-label={`Șterge ${d.name}`} title="Șterge documentul" onClick={() => setToDelete(d)}>
                  Șterge
                </button>
              </li>
            ))}
          </ul>
          {x && (
            <div className="grow">
              <h2>{x.document}</h2>
              <table className="audit extract-fields">
                <thead>
                  <tr>
                    <th>Câmp</th>
                    <th>Valoare</th>
                    <th>Încredere</th>
                    <th>Sursa</th>
                    <th>Confirm</th>
                  </tr>
                </thead>
                <tbody>
                  {x.fields.map((f) => (
                    <tr key={f.key} className={needsConfirm(f) && !confirmed[f.key] ? "to-confirm" : ""}>
                      <td>
                        {f.label}
                        {f.required && " *"}
                      </td>
                      <td>
                        <input
                          aria-label={f.label}
                          value={values[f.key] ?? ""}
                          onChange={(e) => {
                            setValues((v) => ({ ...v, [f.key]: e.target.value }));
                            setConfirmed((c) => ({ ...c, [f.key]: false }));
                          }}
                        />
                        {f.note && <div className="muted small">{f.note}</div>}
                      </td>
                      <td>
                        <span className={`badge ${levelClass[changed(f) ? "de verificat" : f.level]}`}>
                          {changed(f) ? "corectat" : f.level}
                        </span>
                      </td>
                      <td title={f.context}>
                        {where(f.source)}
                        {f.context && <div className="muted small">{f.context.slice(0, 80)}</div>}
                      </td>
                      <td>
                        {needsConfirm(f) ? (
                          <input
                            type="checkbox"
                            aria-label={`Confirm ${f.label}`}
                            checked={!!confirmed[f.key]}
                            onChange={(e) => setConfirmed((c) => ({ ...c, [f.key]: e.target.checked }))}
                          />
                        ) : (
                          <span className="muted">{(values[f.key] ?? "").trim() ? "—" : ""}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row wrap">
                <button className="primary" disabled={busy || missingConfirm > 0} onClick={() => void onConfirm()}>
                  Importă în registru
                </button>
                {missingConfirm > 0 && <span className="warn">Mai ai de confirmat {missingConfirm} valori (bifează după ce le verifici).</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "registru" && (
        <div>
          <div className="row">
            <button disabled={busy || !records.length} onClick={() => void onExport()}>
              Exportă registrul ca CSV…
            </button>
          </div>
          <table className="audit">
            <thead>
              <tr>
                <th>Număr</th>
                <th>Data</th>
                <th>Furnizor</th>
                <th>Client</th>
                <th>Fără TVA</th>
                <th>TVA</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={String(r.id)}>
                  <td>{r.numar}</td>
                  <td>{r.data}</td>
                  <td>{r.furnizor}</td>
                  <td>{r.client}</td>
                  <td className="num">{r.total_fara_tva ?? ""}</td>
                  <td className="num">{r.tva ?? ""}</td>
                  <td className="num">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "jurnal" && (
        <table className="audit">
          <thead>
            <tr>
              <th>Când</th>
              <th>Factura</th>
              <th>Automate</th>
              <th>Confirmate</th>
              <th>Corectate</th>
            </tr>
          </thead>
          <tbody>
            {journal.map((j, i) => (
              <tr key={i}>
                <td>{when(Number(j.la_ms))}</td>
                <td>{String(records.find((r) => r.id === j.factura)?.numar ?? j.factura)}</td>
                <td>{(j.automate as unknown as string[]).join(", ")}</td>
                <td>{(j.confirmate as unknown as string[]).join(", ")}</td>
                <td>{(j.corectate as unknown as string[]).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
