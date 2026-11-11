// 7.10b: the firm's data from its papers. The vault reads, from the documents of „Actele firmei” (a certificat
// constatator, a certificat de înregistrare), the name, the CUI, the trade register number and the registered office;
// here they are shown next to what „Documente și modele” and Business say now. The person chooses, field by field,
// and where to write them; nothing is written without that, and a value already there is never replaced unless
// the person picks the new one.
import { useEffect, useState } from "react";
import { api, message } from "../../api";

const VAULT = "kgb.vault";
const DOCS = "kgb.docs";
const BIZ = "kgb.business";

type Field = "nume" | "cui" | "reg_com" | "adresa";
const FIELDS: Array<[Field, string]> = [
  ["nume", "Denumirea"],
  ["cui", "CUI"],
  ["reg_com", "Nr. Registrul Comerțului"],
  ["adresa", "Sediul social"],
];
interface Proposal {
  camp: Field;
  valoare: string;
  din: string[];
}
interface Company {
  campuri: Array<{ camp: string; valoare: string }>;
  version: number | null;
}
interface BizSettings {
  firma: Array<{ camp: string; valoare: string }>;
  version: number | null;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function FirmProfile({ readOnly, onClose, onDone }: { readOnly: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const [props, setProps] = useState<Proposal[] | null>(null);
  const [papers, setPapers] = useState(0);
  const [docs, setDocs] = useState<Company | null>(null);
  const [biz, setBiz] = useState<BizSettings | null>(null);
  const [pick, setPick] = useState<Partial<Record<Field, string>>>({});
  const [toDocs, setToDocs] = useState(true);
  const [toBiz, setToBiz] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const p = await api.moduleCall<{ documente: number; propuneri: Proposal[] }>(VAULT, "profil_firma");
        const m = await api.listModules();
        const on = (id: string) => m.modules.some((x) => x.id === id && x.enabled) && m.access[id] !== "niciunul";
        const d = on(DOCS) ? await api.moduleCall<Company>(DOCS, "company") : null;
        const b = on(BIZ) ? await api.moduleCall<BizSettings>(BIZ, "settings") : null;
        setProps(p.propuneri);
        setPapers(p.documente);
        setDocs(d);
        setBiz(b);
        // A field empty everywhere gets the only proposal it has; anything else waits for the person.
        const first: Partial<Record<Field, string>> = {};
        for (const [f] of FIELDS) {
          const mine = p.propuneri.filter((x) => x.camp === f);
          const now = [cur(d, f), curBiz(b, f)].filter(Boolean);
          if (mine.length === 1 && now.length === 0) first[f] = mine[0]!.valoare;
        }
        setPick(first);
      } catch (e) {
        setErr(message(e));
      }
    })();
  }, []);

  const cur = (d: Company | null, f: Field) => d?.campuri.find((c) => c.camp === f)?.valoare ?? "";
  const curBiz = (b: BizSettings | null, f: Field) => b?.firma.find((c) => c.camp === `firma_${f}`)?.valoare ?? "";
  const chosen = FIELDS.filter(([f]) => pick[f]);

  const write = async () => {
    setBusy(true);
    setErr(null);
    try {
      const done: string[] = [];
      if (toDocs && docs) {
        const valori: Record<string, string> = {};
        for (const c of docs.campuri) valori[c.camp] = c.valoare;
        for (const [f] of chosen) valori[f] = pick[f]!;
        await api.moduleCall(DOCS, "company_save", { valori, ...(docs.version ? { version: docs.version } : {}) });
        done.push("Scris în „Date firmă” (Documente și modele)");
      }
      if (toBiz && biz) {
        const firma: Record<string, string> = {};
        for (const [f] of chosen) firma[`firma_${f}`] = pick[f]!;
        await api.moduleCall(BIZ, "settings_save", { firma, ...(biz.version ? { version: biz.version } : {}) });
        done.push("Scris în datele firmei din Business");
      }
      if (pick.cui) {
        const s = await api.moduleCall<{ cui_firma: string; version: number | null }>(VAULT, "setari");
        if (!s.cui_firma) {
          await api.moduleCall(VAULT, "setari_save", { cui_firma: pick.cui, ...(s.version ? { version: s.version } : {}) });
          done.push("CUI-ul firmei e salvat și în depozit");
        }
      }
      onDone(done.length ? done.join(" · ") : "Nimic de scris.");
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card firm-profile" role="region" aria-label="Profilul firmei din acte">
      <h3>Profilul firmei din acte</h3>
      {props === null && !err && <p className="muted">Citesc actele firmei…</p>}
      {props !== null && papers === 0 && <p className="muted">În „Actele firmei” nu e niciun document. Adaugă certificatul constatator sau certificatul de înregistrare și confirmă-le categoria.</p>}
      {props !== null && papers > 0 && (
        <>
          <p className="muted small">
            {papers === 1 ? "Dintr-un document al firmei." : `Din ${papers} documente ale firmei.`}{" "}Alege pentru fiecare câmp ce scrii; ce e deja completat se
            schimbă doar dacă alegi altă valoare.
          </p>
          <table className="audit">
            <tbody>
              {FIELDS.map(([f, label]) => {
                const mine = props.filter((x) => x.camp === f);
                const d = cur(docs, f);
                const b = curBiz(biz, f);
                return (
                  <tr key={f} data-field={f}>
                    <th>{label}</th>
                    <td className="small">
                      {docs && <div className="muted">{`Documente și modele: ${d || "—"}`}</div>}
                      {biz && <div className="muted">{`Business: ${b || "—"}`}</div>}
                    </td>
                    <td>
                      {mine.length === 0 && <span className="muted small">negăsit în acte</span>}
                      {mine.map((x) => (
                        <label key={x.valoare} className="small" style={{ display: "block" }}>
                          <input type="radio" name={`firm-${f}`} aria-label={`${label}: ${x.valoare}`} checked={pick[f] === x.valoare} disabled={busy || readOnly} onChange={() => setPick((p) => ({ ...p, [f]: x.valoare }))} />{" "}
                          <b className="no-i18n">{x.valoare}</b>
                          {(same(x.valoare, d) || same(x.valoare, b)) && (
                            <>
                              {" "}
                              <span className="muted">(la fel)</span>
                            </>
                          )}
                          {" · "}
                          <span className="muted">găsit în</span> <span className="muted no-i18n">{x.din.join(", ")}</span>
                        </label>
                      ))}
                      {mine.length > 0 && (
                        <label className="small" style={{ display: "block" }}>
                          <input type="radio" name={`firm-${f}`} checked={!pick[f]} disabled={busy || readOnly} onChange={() => setPick((p) => ({ ...p, [f]: undefined }))} /> nu schimba
                        </label>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="row wrap">
            {docs && (
              <label className="small">
                <input type="checkbox" checked={toDocs} onChange={(e) => setToDocs(e.target.checked)} /> în „Date firmă” (Documente și modele)
              </label>
            )}
            {biz && (
              <label className="small">
                <input type="checkbox" checked={toBiz} onChange={(e) => setToBiz(e.target.checked)} /> în datele firmei din Business
              </label>
            )}
            {!docs && !biz && <span className="muted small">Activează „Documente și modele” sau Business ca să ai unde scrie datele.</span>}
          </div>
        </>
      )}
      {err && <p className="error">{err}</p>}
      <div className="row wrap">
        <button className="primary" disabled={busy || readOnly || chosen.length === 0 || (!(toDocs && docs) && !(toBiz && biz) && !pick.cui)} onClick={() => void write()}>
          {chosen.length === 1 ? "Scrie câmpul ales" : `Scrie cele ${chosen.length} câmpuri alese`}
        </button>
        <button disabled={busy} onClick={onClose}>
          Închide
        </button>
      </div>
    </div>
  );
}
