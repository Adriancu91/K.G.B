// Partner directory (Etapa 7, step 7.4a; D-066): one card per client or
// supplier, shared by every module. Base data, work points, documents with
// dates (reminders before they expire) and extra fields added by hand.
import { invoke } from "@tauri-apps/api/core";
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { message } from "../api";
import { takeIntent } from "../intent";
import { AnafLookup, type AnafCompany } from "../components/AnafLookup";

interface WorkPoint {
  denumire: string;
  adresa: string;
  contact: string;
}
interface Doc {
  tip: string;
  numar: string;
  emis: string;
  expira: string;
  nota: string;
}
interface Extra {
  nume: string;
  valoare: string;
}
export interface Partner {
  id?: string | null;
  version: number;
  tip: string;
  denumire: string;
  cui: string;
  nr_reg_com: string;
  sediu: string;
  localitate: string;
  judet: string;
  tara: string;
  telefon: string;
  email: string;
  iban: string;
  banca: string;
  reprezentant: string;
  functie_reprezentant: string;
  platitor_tva: boolean | null;
  note: string;
  puncte_lucru: WorkPoint[];
  documente: Doc[];
  campuri: Extra[];
  surse: Record<string, unknown>;
  activ: boolean | null;
}
interface Expiring {
  partener: string;
  denumire: string;
  tip: string;
  numar: string;
  expira: string;
  zile: number;
}

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const ro = (d: string) => (d ? d.split("-").reverse().join(".") : "—");

const blank = (): Partner => ({
  version: 0,
  tip: "ambele",
  denumire: "",
  cui: "",
  nr_reg_com: "",
  sediu: "",
  localitate: "",
  judet: "",
  tara: "România",
  telefon: "",
  email: "",
  iban: "",
  banca: "",
  reprezentant: "",
  functie_reprezentant: "",
  platitor_tva: null,
  note: "",
  puncte_lucru: [],
  documente: [],
  campuri: [],
  surse: {},
  activ: true,
});

const BASE: Array<[keyof Partner, string]> = [
  ["denumire", "Denumire"],
  ["cui", "CUI"],
  ["nr_reg_com", "Nr. Registrul Comerțului"],
  ["sediu", "Sediu"],
  ["localitate", "Localitate"],
  ["judet", "Județ"],
  ["tara", "Țara"],
  ["telefon", "Telefon"],
  ["email", "E-mail"],
  ["iban", "IBAN"],
  ["banca", "Banca"],
  ["reprezentant", "Reprezentant legal"],
  ["functie_reprezentant", "Funcția reprezentantului"],
];

function Editor({ start, onSave, onCancel }: { start: Partner; onSave: (p: Partner) => Promise<string | null>; onCancel: () => void }) {
  const [p, setP] = useState(start);
  const [err, setErr] = useState<string | null>(null);
  const up = (patch: Partial<Partner>) => setP((x) => ({ ...x, ...patch }));
  // A base field typed by hand is marked "manual" (it may have come from ANAF).
  const upBase = (k: keyof Partner, v: string) =>
    setP((x) => ({ ...x, [k]: v, surse: x.surse[k as string] ? { ...x.surse, [k as string]: { sursa: "manual", data: today() } } : x.surse }));
  const fromAnaf = (c: AnafCompany) =>
    setP((x) => {
      const vals: Partial<Partner> = {
        denumire: c.denumire,
        nr_reg_com: c.nr_reg_com,
        sediu: c.sediu,
        localitate: c.localitate,
        judet: c.judet,
        telefon: c.telefon,
      };
      const filled = Object.fromEntries(Object.entries(vals).filter(([, v]) => String(v ?? "").trim())) as Partial<Partner>;
      const surse = { ...x.surse };
      for (const k of [...Object.keys(filled), "platitor_tva"]) surse[k] = { sursa: "anaf", data: c.data || today() };
      return { ...x, ...filled, tara: x.tara || "România", platitor_tva: c.platitor_tva, surse };
    });
  return (
    <form
      className="partner-editor"
      aria-label="Fișa partenerului"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(p).then(setErr);
      }}
    >
      {err && <p className="error">{err}</p>}
      <label>
        Tip{" "}
        <select value={p.tip} onChange={(e) => up({ tip: e.target.value })} aria-label="Tipul partenerului">
          <option value="client">client</option>
          <option value="furnizor">furnizor</option>
          <option value="ambele">client și furnizor</option>
        </select>
      </label>
      <div className="row wrap">
        <AnafLookup cui={p.cui} onFound={fromAnaf} />
      </div>
      <div className="partner-grid">
        {BASE.map(([k, l]) => (
          <label key={k}>
            {l}
            <input value={String(p[k] ?? "")} onChange={(e) => upBase(k, e.target.value)} aria-label={l} required={k === "denumire"} />
            {(p.surse[k as string] as { sursa?: string } | undefined)?.sursa === "anaf" && <span className="small muted">de la ANAF</span>}
          </label>
        ))}
      </div>
      <fieldset>
        <legend>Puncte de lucru</legend>
        {p.puncte_lucru.map((w, i) => (
          <div className="row wrap" key={i}>
            <input placeholder="Denumire" value={w.denumire} aria-label={`Punctul de lucru ${i + 1}`} onChange={(e) => up({ puncte_lucru: p.puncte_lucru.map((x, j) => (j === i ? { ...x, denumire: e.target.value } : x)) })} />
            <input placeholder="Adresa" value={w.adresa} aria-label={`Adresa punctului ${i + 1}`} onChange={(e) => up({ puncte_lucru: p.puncte_lucru.map((x, j) => (j === i ? { ...x, adresa: e.target.value } : x)) })} />
            <input placeholder="Persoană de contact" value={w.contact} aria-label={`Contactul punctului ${i + 1}`} onChange={(e) => up({ puncte_lucru: p.puncte_lucru.map((x, j) => (j === i ? { ...x, contact: e.target.value } : x)) })} />
            <button type="button" className="link danger-text" onClick={() => up({ puncte_lucru: p.puncte_lucru.filter((_, j) => j !== i) })}>
              scoate
            </button>
          </div>
        ))}
        <button type="button" className="link" onClick={() => up({ puncte_lucru: [...p.puncte_lucru, { denumire: "", adresa: "", contact: "" }] })}>
          + punct de lucru
        </button>
      </fieldset>
      <fieldset>
        <legend>Documente și autorizații (cu data expirării sau a revizuirii primești memento)</legend>
        {p.documente.map((d, i) => (
          <div className="row wrap" key={i}>
            <input placeholder="Tip (de ex. Autorizație de mediu)" value={d.tip} aria-label={`Tipul documentului ${i + 1}`} onChange={(e) => up({ documente: p.documente.map((x, j) => (j === i ? { ...x, tip: e.target.value } : x)) })} />
            <input placeholder="Număr" value={d.numar} aria-label={`Numărul documentului ${i + 1}`} size={12} onChange={(e) => up({ documente: p.documente.map((x, j) => (j === i ? { ...x, numar: e.target.value } : x)) })} />
            <label className="small">
              emis <input type="date" value={d.emis} aria-label={`Emis ${i + 1}`} onChange={(e) => up({ documente: p.documente.map((x, j) => (j === i ? { ...x, emis: e.target.value } : x)) })} />
            </label>
            <label className="small">
              expiră / revizuire <input type="date" value={d.expira} aria-label={`Expiră ${i + 1}`} onChange={(e) => up({ documente: p.documente.map((x, j) => (j === i ? { ...x, expira: e.target.value } : x)) })} />
            </label>
            <button type="button" className="link danger-text" onClick={() => up({ documente: p.documente.filter((_, j) => j !== i) })}>
              scoate
            </button>
          </div>
        ))}
        <button type="button" className="link" onClick={() => up({ documente: [...p.documente, { tip: "", numar: "", emis: "", expira: "", nota: "" }] })}>
          + document
        </button>
      </fieldset>
      <fieldset>
        <legend>Alte câmpuri (orice informație vrei să păstrezi)</legend>
        {p.campuri.map((f, i) => (
          <div className="row" key={i}>
            <input placeholder="Nume câmp" value={f.nume} aria-label={`Numele câmpului ${i + 1}`} onChange={(e) => up({ campuri: p.campuri.map((x, j) => (j === i ? { ...x, nume: e.target.value } : x)) })} />
            <input placeholder="Valoare" value={f.valoare} aria-label={`Valoarea câmpului ${i + 1}`} onChange={(e) => up({ campuri: p.campuri.map((x, j) => (j === i ? { ...x, valoare: e.target.value } : x)) })} />
            <button type="button" className="link danger-text" onClick={() => up({ campuri: p.campuri.filter((_, j) => j !== i) })}>
              scoate
            </button>
          </div>
        ))}
        <button type="button" className="link" onClick={() => up({ campuri: [...p.campuri, { nume: "", valoare: "" }] })}>
          + câmp
        </button>
      </fieldset>
      <label>
        Note <textarea rows={2} value={p.note} onChange={(e) => up({ note: e.target.value })} aria-label="Note" />
      </label>
      <div className="row">
        <button type="submit" className="primary">
          Salvează fișa
        </button>
        <button type="button" onClick={onCancel}>
          Renunță
        </button>
      </div>
    </form>
  );
}

export function PartnersPage({ onError }: { onError: (e: string | null) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Partner[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [exp, setExp] = useState<Expiring[]>([]);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [report, setReport] = useState<{ adaugate: number; completate: number; neschimbate: number; erori: [number, string][] } | null>(null);

  const importFile = async () => {
    const path = await open({ multiple: false, filters: [{ name: "Tabele", extensions: ["xlsx", "xls", "ods", "csv"] }] });
    if (typeof path !== "string") return;
    try {
      setReport(await invoke("partners_import", { path, azi: today() }));
      onError(null);
      await load();
    } catch (e) {
      onError(message(e));
    }
  };
  const saveModel = async () => {
    const dest = await saveDialog({ defaultPath: "model-import-parteneri.xlsx", filters: [{ name: "Excel", extensions: ["xlsx"] }] });
    if (!dest) return;
    try {
      await invoke("partners_import_model", { dest });
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  };

  const load = useCallback(async () => {
    try {
      const r = await invoke<{ items: Partner[]; poate_modifica: boolean; expira: Expiring[] }>("partners_list", { cauta: q, inactivi: false, azi: today() });
      setItems(r.items);
      setCanEdit(r.poate_modifica);
      setExp(r.expira);
    } catch (e) {
      onError(message(e));
    }
  }, [q, onError]);
  useEffect(() => {
    void load();
  }, [load]);
  // Ctrl+K may ask for a new card or a given one (7.4j).
  useEffect(() => {
    const want = takeIntent("partners");
    if (want === "nou") setEditing(blank());
    else if (want?.startsWith("fisa:"))
      void invoke<{ items: Partner[] }>("partners_list", { cauta: "", inactivi: true, azi: today() }).then((r) => {
        const p = r.items.find((x) => x.id === want.slice(5));
        if (p) setEditing(p);
      });
  }, []);

  const save = async (p: Partner): Promise<string | null> => {
    try {
      await invoke("partner_save", { partner: p });
      setEditing(null);
      onError(null);
      await load();
      return null;
    } catch (e) {
      return message(e);
    }
  };

  if (editing) return <Editor start={editing} onSave={save} onCancel={() => setEditing(null)} />;
  return (
    <div className="partners-page">
      <p className="muted">
        Agenda comună a clienților și furnizorilor. O fișă completată o dată se folosește peste tot: în documente, în facturi și, mai departe, la
        completarea automată.
      </p>
      {exp.length > 0 && (
        <div className="warn" role="status">
          <strong>Expiră curând sau au expirat:</strong>
          <ul>
            {exp.map((x, i) => (
              <li key={i}>
                {x.denumire}: {x.tip}
                {x.numar ? ` nr. ${x.numar}` : ""} — {ro(x.expira)} ({x.zile < 0 ? `expirat de ${-x.zile} zile` : x.zile === 0 ? "azi" : `în ${x.zile} zile`})
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="row wrap">
        <input placeholder="Caută după nume, CUI, oraș, telefon…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Caută partener" />
        {canEdit && (
          <>
            <button className="primary" onClick={() => setEditing(blank())}>
              Partener nou
            </button>
            <button onClick={() => void importFile()}>Importă din Excel…</button>
            <button className="link" onClick={() => void saveModel()}>
              Descarcă modelul de import
            </button>
          </>
        )}
      </div>
      {report && (
        <div className="import-report" role="status">
          <strong>Import terminat:</strong> {report.adaugate} parteneri noi, {report.completate} fișe completate, {report.neschimbate} neschimbate
          {report.erori.length > 0 ? `, ${report.erori.length} rânduri sărite:` : "."}
          {report.erori.length > 0 && (
            <ul>
              {report.erori.slice(0, 30).map(([row, why]) => (
                <li key={row}>
                  rândul {row}: {why}
                </li>
              ))}
              {report.erori.length > 30 && <li>și încă {report.erori.length - 30}</li>}
            </ul>
          )}
          <p className="muted small">Fișele care existau deja au primit doar câmpurile goale; ce aveau rămâne neschimbat.</p>
          <button className="link" onClick={() => setReport(null)}>
            închide
          </button>
        </div>
      )}
      {items && items.length === 0 && <p role="status">{q ? "Nimic găsit." : "Niciun partener încă."}</p>}
      {items && items.length > 0 && (
        <table className="audit partners-table">
          <thead>
            <tr>
              <th>Denumire</th>
              <th>Tip</th>
              <th>CUI</th>
              <th>Localitate</th>
              <th>Telefon</th>
              <th>Documente</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id ?? p.denumire} onClick={() => canEdit && setEditing(p)} style={{ cursor: canEdit ? "pointer" : "default" }}>
                <td>{p.denumire}</td>
                <td>{p.tip === "ambele" ? "client și furnizor" : p.tip}</td>
                <td>{p.cui || "—"}</td>
                <td>{p.localitate || "—"}</td>
                <td>{p.telefon || "—"}</td>
                <td className="num">{p.documente.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
