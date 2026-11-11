// Depozitul de documente (Etapa 7, step 7.10a): every document of the firm in one place. A whole folder (with its
// subfolders) or chosen files come in unchanged and once per content; each gets a category with a confidence and a
// reason, the uncertain ones are confirmed by the person; invoices show what was recognised (issuer CUI, series and
// number, date, total) for the duplicate check of 7.10d. A read-only role sees everything and changes nothing.
// 7.10b: „Profilul firmei din acte” proposes the firm's data from its papers (FirmProfile.tsx); a purchase invoice
// not yet in Business can be recorded there by the person, from a filled-in form (ToBusiness.tsx).
import { useCallback, useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";
import { compared, fromIssued, fromPurchase, matchesOf, type Inv, type Match } from "./match";
import { FirmProfile } from "./FirmProfile";
import { ToBusiness } from "./ToBusiness";

const ID = "kgb.vault";
const BIZ = "kgb.business";

interface Invoice {
  emitent_cui?: string;
  emitent?: string;
  serie?: string;
  numar?: string;
  data?: string;
  total?: number | null;
}
interface Doc {
  id: string;
  version: number;
  nume: string;
  cale: string;
  tip: string;
  marime: number;
  categorie: string;
  incredere: number;
  motiv: string;
  confirmata: boolean;
  factura: Invoice | null;
}
interface Summary {
  total: number;
  de_confirmat: number;
  cui_firma: string;
  setari_version: number | null;
  categorii: Array<{ id: string; nume: string; documente: number }>;
}
interface Added {
  exista: boolean;
  nume: string;
  categorie: string;
}

const ro = (d?: string) => (d ? d.split("-").reverse().join(".") : "");
const lei = (b: number) => {
  const [i, f] = (Math.abs(b) / 100).toFixed(2).split(".");
  return `${b < 0 ? "-" : ""}${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${f}`;
};
const size = (n: number) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function VaultPage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const [sum, setSum] = useState<Summary | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [cat, setCat] = useState("");
  const [todo, setTodo] = useState(false);
  const [text, setText] = useState("");
  const [cui, setCui] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dupOnly, setDupOnly] = useState(false);
  const [profile, setProfile] = useState(false);
  const [bizOn, setBizOn] = useState(false);
  const [toBiz, setToBiz] = useState<string | null>(null);
  const [twins, setTwins] = useState<Array<{ sigur: boolean; documente: Doc[] }>>([]);
  const [others, setOthers] = useState<Array<{ inv: Inv; where: string }>>([]);

  const load = useCallback(async () => {
    try {
      const [s, l, d] = await Promise.all([
        api.moduleCall<Summary>(ID, "rezumat"),
        api.moduleCall<Doc[]>(ID, "lista", { categorie: dupOnly ? "" : cat, text, de_confirmat: todo && !dupOnly }),
        api.moduleCall<Array<{ sigur: boolean; documente: Doc[] }>>(ID, "dubluri"),
      ]);
      setSum(s);
      setDocs(l);
      setTwins(d);
      setCui((c) => c || s.cui_firma);
      // The invoices of Business (issued, and purchases with those from e-Factura), when it is enabled and readable.
      const m = await api.listModules();
      const biz = m.modules.some((x) => x.id === BIZ && x.enabled) && m.access[BIZ] !== "niciunul";
      setBizOn(biz && m.access[BIZ] !== "citire");
      if (biz) {
        const [issued, bought, settings] = await Promise.all([
          api.moduleCall<Array<{ serie: string; numar: number; data: string; total: number; storno_de: string | null }>>(BIZ, "invoices"),
          api.moduleCall<Array<{ furnizor_cui?: string | null; numar: string; data: string; total: number; storno_de: string | null }>>(BIZ, "purchases"),
          api.moduleCall<{ firma: Array<{ camp: string; valoare: string }> }>(BIZ, "settings"),
        ]);
        const firm = settings.firma.find((f) => f.camp === "firma_cui")?.valoare ?? "";
        setOthers([
          ...issued.filter((x) => !x.storno_de).map((x) => ({ inv: fromIssued(x, firm), where: `Business, factura emisă ${x.serie} ${x.numar}` })),
          ...bought.filter((x) => !x.storno_de).map((x) => ({ inv: fromPurchase(x), where: `Business, cheltuiala ${x.numar}` })),
        ]);
      } else setOthers([]);
    } catch (e) {
      onError(message(e));
    }
  }, [cat, text, todo, dupOnly, onError]);

  const asInv = (f: Invoice): Inv => ({ emitent_cui: f.emitent_cui ?? "", serie: f.serie ?? "", numar: f.numar ?? "", data: f.data ?? "", total: f.total ?? null });
  /** Where else a document's invoice is: another file of the vault, or Business. */
  const elsewhere = (d: Doc): Match[] => {
    if (!d.factura?.numar) return [];
    const inVault = twins
      .filter((g) => g.documente.some((x) => x.id === d.id))
      .flatMap((g) => g.documente.filter((x) => x.id !== d.id).map((x) => compared(asInv(d.factura!), asInv(x.factura ?? {}), `depozit, „${x.nume}”`)));
    return [...inVault, ...matchesOf(asInv(d.factura), others)];
  };
  const shown = dupOnly ? docs.filter((d) => elsewhere(d).length > 0) : docs;
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
    await load();
  };

  /** Sends the files one by one; counts what is new, what was already there and what could not be read. */
  const addAll = async (files: Array<{ path: string; rel: string }>, skipped = 0, tooMany = false) => {
    let added = 0;
    let there = 0;
    const failed: string[] = [];
    for (let k = 0; k < files.length; k++) {
      const f = files[k]!;
      setProgress(`Se adaugă ${k + 1} din ${files.length}: ${f.rel}`);
      try {
        const r = await api.importFileWith<Added>(ID, f.path, "adauga", { cale: f.rel });
        if (r.exista) there++;
        else added++;
      } catch (e) {
        failed.push(`${f.rel} (${message(e)})`);
      }
    }
    const parts = [added === 1 ? "un document nou" : `${added} documente noi`];
    if (there) parts.push(there === 1 ? "unul era deja în depozit" : `${there} erau deja în depozit`);
    if (skipped) parts.push(skipped === 1 ? "un fișier sărit (alt fel de fișier sau prea mare)" : `${skipped} fișiere sărite (alt fel de fișier sau prea mari)`);
    if (tooMany) parts.push("folderul are peste 3000 de fișiere: au intrat primele 3000, alege subfolderele rămase pe rând");
    if (failed.length) parts.push(failed.length === 1 ? `unul nu s-a putut citi: ${failed[0]}` : `${failed.length} nu s-au putut citi: ${failed.slice(0, 5).join("; ")}`);
    setNotice(parts.join(" · "));
  };

  const addFolder = () =>
    run(async () => {
      // The e2e can't drive the system's folder dialog, so it names the folder here; a page script could already
      // call the core directly, so this gives nothing new.
      const folder = (window as { __kgbE2eFolder?: string }).__kgbE2eFolder ?? (await open({ directory: true, multiple: false, title: "Folderul cu documentele firmei" }));
      if (typeof folder !== "string") return;
      const list = await api.folderFiles(folder);
      if (list.files.length === 0) {
        setNotice("În folderul ales nu e niciun document pe care depozitul să-l poată citi.");
        return;
      }
      await addAll(list.files, list.sarite, list.prea_multe);
    });

  const addFiles = () =>
    run(async () => {
      const picked = await open({ multiple: true, title: "Documentele de adăugat" });
      const list = Array.isArray(picked) ? picked : typeof picked === "string" ? [picked] : [];
      await addAll(list.map((p) => ({ path: p, rel: p.split(/[\\/]/).pop() ?? p })));
    });

  return (
    <section className="vault">
      {readOnly && <p className="warn">Rolul tău poate doar citi depozitul: nu poate adăuga, sorta sau șterge documente.</p>}
      <div className="row wrap">
        <button className="primary" disabled={busy || readOnly} onClick={() => void addFolder()}>
          Adaugă un folder…
        </button>
        <button disabled={busy || readOnly} onClick={() => void addFiles()}>
          Adaugă fișiere…
        </button>
        <span className="muted small">Fișierele tale nu se modifică: în depozit intră o copie, o singură dată pentru același conținut.</span>
      </div>
      {progress && (
        <p className="muted small" role="status">
          {progress}
        </p>
      )}
      {notice && !progress && (
        <p className="muted" role="status">
          {notice.split(" · ").map((part, n) => (
            <span key={n}>
              {n > 0 && " · "}
              <span>{part}</span>
            </span>
          ))}
        </p>
      )}

      <form
        className="row wrap"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const r = await api.moduleCall<{ resortate: number }>(ID, "setari_save", { cui_firma: cui, ...(sum?.setari_version ? { version: sum.setari_version } : {}) });
            setNotice(`CUI-ul firmei e salvat. Documente sortate din nou: ${r.resortate}.`);
          });
        }}
      >
        <label className="small">
          CUI-ul firmei <input aria-label="CUI-ul firmei" value={cui} onChange={(e) => setCui(e.target.value)} size={14} placeholder="RO…" />
        </label>
        <button disabled={busy || readOnly}>Salvează</button>
        <span className="muted small">Din el se știe care facturi sunt de vânzare și care de achiziție.</span>
        <button type="button" disabled={busy} onClick={() => setProfile(true)}>
          Profilul firmei din acte…
        </button>
      </form>
      {profile && (
        <FirmProfile
          readOnly={readOnly}
          onClose={() => setProfile(false)}
          onDone={(m) => {
            setProfile(false);
            setNotice(m);
            setCui("");
            void load();
          }}
        />
      )}

      {sum && (
        <div className="vault-cats" role="tablist" aria-label="Categoriile">
          <button role="tab" aria-selected={!cat && !todo && !dupOnly} className={!cat && !todo && !dupOnly ? "active" : ""} onClick={() => (setCat(""), setTodo(false), setDupOnly(false))}>
            {`Toate (${sum.total})`}
          </button>
          {sum.de_confirmat > 0 && (
            <button role="tab" aria-selected={todo && !dupOnly} className={`vault-todo${todo && !dupOnly ? " active" : ""}`} onClick={() => (setCat(""), setTodo(true), setDupOnly(false))}>
              {`De confirmat (${sum.de_confirmat})`}
            </button>
          )}
          {(twins.length > 0 || others.length > 0) && (
            <button role="tab" aria-selected={dupOnly} className={`vault-todo${dupOnly ? " active" : ""}`} onClick={() => (setCat(""), setTodo(false), setDupOnly(true))}>
              Dubluri
            </button>
          )}
          {sum.categorii
            .filter((c) => c.documente > 0)
            .map((c) => (
              <button key={c.id} role="tab" aria-selected={cat === c.id && !dupOnly} className={cat === c.id && !dupOnly ? "active" : ""} data-cat={c.id} onClick={() => (setCat(c.id), setTodo(false), setDupOnly(false))}>
                {`${c.nume} (${c.documente})`}
              </button>
            ))}
        </div>
      )}
      <input aria-label="Caută în depozit" placeholder="Caută după nume, folder sau text" value={text} onChange={(e) => setText(e.target.value)} />

      <table className="audit vault-list">
        <tbody>
          {shown.length === 0 && (
            <tr>
              <td className="muted">{dupOnly ? "Nicio factură găsită de două ori." : sum?.total ? "Niciun document aici." : "Depozitul e gol. Adaugă folderul cu documentele firmei."}</td>
            </tr>
          )}
          {shown.map((d) => (
            <tr key={d.id} data-testid="vault-doc" className={d.confirmata ? "" : "vault-unsure"}>
              <td>
                <strong>{d.nume}</strong>
                {d.cale && d.cale !== d.nume && <div className="muted small">{d.cale}</div>}
                <div className="muted small">{`${d.tip || "fișier"} · ${size(d.marime)}`}</div>
              </td>
              <td>
                <select
                  aria-label={`Categoria pentru ${d.nume}`}
                  value={d.categorie}
                  disabled={busy || readOnly}
                  onChange={(e) => void run(() => api.moduleCall(ID, "confirma", { id: d.id, version: d.version, categorie: e.target.value }))}
                >
                  {(sum?.categorii ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nume}
                    </option>
                  ))}
                </select>
                <div className="small">
                  {d.confirmata ? <span className="muted">{`sigur (${d.incredere}%)`}</span> : <strong className="vault-unsure-text">{`de confirmat (${d.incredere}%)`}</strong>}
                </div>
                <div className="muted small">{d.motiv}</div>
              </td>
              <td className="small">
                {d.factura?.numar && (
                  <div data-testid="vault-invoice">
                    <div>{d.factura.serie ? `Factura ${d.factura.serie} ${d.factura.numar}` : `Factura ${d.factura.numar}`}</div>
                    {d.factura.data && <div>{ro(d.factura.data)}</div>}
                    {typeof d.factura.total === "number" && <div>{`${lei(d.factura.total)} lei`}</div>}
                    {d.factura.emitent_cui && <div className="muted">{`emitent CUI ${d.factura.emitent_cui}`}</div>}
                    {elsewhere(d).map((m, n) => (
                      <div key={n} className={m.sure ? "vault-dup" : "vault-dup vault-dup-maybe"} data-testid="vault-dup">
                        <span>{m.sure ? "există și în:" : "posibil dublură:"}</span> <span>{m.where}</span>
                        {m.otherTotal !== undefined && typeof d.factura?.total === "number" && (
                          <span className="small">{" "}<span>{`(alt total: ${lei(m.otherTotal)} față de ${lei(d.factura.total)} lei)`}</span></span>
                        )}
                        {m.otherDate && <span className="small">{" "}<span>{`(altă dată: ${ro(m.otherDate)} față de ${ro(d.factura?.data)})`}</span></span>}
                      </div>
                    ))}
                    {bizOn && !readOnly && d.categorie === "facturi_achizitie" && !elsewhere(d).some((m) => m.where.startsWith("Business")) && toBiz !== d.id && (
                      <button className="link small" disabled={busy} onClick={() => setToBiz(d.id)}>
                        Înregistrează în Business…
                      </button>
                    )}
                    {toBiz === d.id && (
                      <ToBusiness
                        doc={d.nume}
                        inv={d.factura}
                        onClose={() => setToBiz(null)}
                        onDone={(msg) => {
                          setToBiz(null);
                          setNotice(msg);
                          void load();
                        }}
                      />
                    )}
                  </div>
                )}
              </td>
              <td>
                <div className="row wrap">
                  {!d.confirmata && (
                    <button className="small" disabled={busy || readOnly} onClick={() => void run(() => api.moduleCall(ID, "confirma", { id: d.id, version: d.version, categorie: d.categorie }))}>
                      Confirmă
                    </button>
                  )}
                  <button
                    className="link small"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const dest = await save({ defaultPath: d.nume, title: "Unde salvez copia?" });
                        if (!dest) return;
                        await api.moduleCall(ID, "salveaza_copie", { id: d.id, dest });
                        setNotice(`Copia lui „${d.nume}” e salvată.`);
                      })
                    }
                  >
                    salvează o copie
                  </button>
                  <button className="link small" disabled={busy || readOnly} title="Scoate documentul din depozit (fișierul tău de pe disc rămâne)" onClick={() => void run(() => api.moduleCall(ID, "sterge", { id: d.id, version: d.version }))}>
                    scoate din depozit
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
