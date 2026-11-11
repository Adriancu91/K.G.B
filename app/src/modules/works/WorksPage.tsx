// Situații de lucrări (Etapa 7, step 7.9e): the estimates with their items (pasted from a spreadsheet, with the
// refused rows shown and why), the supplements with a reason, the monthly statements (previous, current, cumulated,
// remaining, the values, VAT and the retention as the contract says), issued ones that do not change, cancelled ones
// kept with their reason, PDF and .xlsx. Everything is computed by the module; the page only shows and asks.
// A read-only role sees everything and changes nothing (the core refuses anyway; the buttons say so first).
import { useCallback, useEffect, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";

const ID = "kgb.works";

interface Estimate {
  id: string;
  version: number;
  nume: string;
  numar: string;
  data: string;
  beneficiar_nume: string;
  contract_text: string;
  santier: string;
  tva: number;
  garantie: number;
  garantie_baza: "fara_tva" | "cu_tva";
  stare: "ciorna" | "aprobat" | "inchis";
  nota: string;
}
interface Item {
  id: string;
  version: number;
  cod: string;
  denumire: string;
  um: string;
  cantitate: number;
  pret_unitar: number;
  cantitate_deviz: number;
  executat: number;
  suplimentari: Array<{ cantitate: number; motiv: string; data: string }>;
}
interface StatementRow {
  id: string;
  version: number;
  numar: number;
  de_la: string;
  pana_la: string;
  stare: "ciorna" | "emisa" | "anulata";
  motiv_anulare: string;
  valoare: number;
  de_plata: number;
  numar_dublu: boolean;
  depasire: boolean;
}
interface Detail extends Estimate {
  articole: Item[];
  valoare_deviz: number;
  situatii: StatementRow[];
}
interface Line {
  articol: string;
  cod: string;
  denumire: string;
  um: string;
  pret_unitar: number;
  deviz: number;
  anterior: number;
  curent: number;
  cumulat: number;
  rest: number;
  valoare_curent: number;
  valoare_cumulat: number;
  depasire: boolean;
}
interface Statement extends StatementRow {
  deviz: string;
  data: string;
  tva: number;
  garantie: number;
  garantie_baza: "fara_tva" | "cu_tva";
  linii: Line[];
  tva_valoare: number;
  retinere: number;
}
interface Preview {
  randuri: Array<{ cod: string; denumire: string; um: string; cantitate: number; pret_unitar: number }>;
  refuzate: Array<{ rand: number; motiv: string }>;
  adaugate: number;
}

const z = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const ro = (d: string) => (d ? d.split("-").reverse().join(".") : "");
const group = (int: string) => {
  let out = "";
  for (let i = 0; i < int.length; i++) {
    if (i > 0 && (int.length - i) % 3 === 0) out += ".";
    out += int[i];
  }
  return out;
};
/** Bani → „1.234,56”. */
const lei = (b: number) => {
  const a = Math.round(Math.abs(b));
  return `${b < 0 ? "-" : ""}${group(String(Math.floor(a / 100)))},${String(a % 100).padStart(2, "0")}`;
};
/** Thousandths → „1.500,5”. */
const qty = (q: number) => {
  const a = Math.abs(q);
  const f = String(a % 1000).padStart(3, "0").replace(/0+$/, "");
  return `${q < 0 ? "-" : ""}${group(String(Math.floor(a / 1000)))}${f ? "," + f : ""}`;
};
/** A number as written („1.234,56”, „1234.56”, „12”) → an integer with `decimals` decimals; null when it is not one. */
function parseNum(t: string, decimals: number): number | null {
  let s = t.trim().split(" ").join("").split(String.fromCharCode(160)).join("");
  if (!s) return null;
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  const parts = s.split(".");
  const norm = s.includes(",")
    ? parts.join("").replace(",", ".")
    : parts.length > 2 || (parts.length === 2 && parts[1]!.length === 3 && s.length > 4)
      ? parts.join("")
      : s;
  const np = norm.split(".");
  if (np.length > 2) return null;
  const int = np[0] ?? "";
  const frac = np[1] ?? "";
  if ((!int && !frac) || !/^[0-9]*$/.test(int) || !/^[0-9]*$/.test(frac) || frac.length > decimals) return null;
  const v = Number(int || "0") * 10 ** decimals + Number(frac.padEnd(decimals, "0") || "0");
  return neg ? -v : v;
}
const STATE_TEXT: Record<Statement["stare"], string> = { ciorna: "ciornă", emisa: "emisă", anulata: "anulată" };
const EST_STATE: Record<Estimate["stare"], string> = { ciorna: "ciornă", aprobat: "aprobat", inchis: "închis" };

const blankEst = { nume: "", numar: "", data: "", beneficiar_nume: "", contract_text: "", santier: "", tva: "21", garantie: "5", garantie_baza: "fara_tva", nota: "" };
const blankItem = { cod: "", denumire: "", um: "", cantitate: "", pret: "" };
const blankSup = { articol: "", cantitate: "", motiv: "" };

function readExecutant(): string {
  try {
    return localStorage.getItem("kgb.works.executant") ?? "";
  } catch {
    return "";
  }
}

export function WorksPage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const today = iso(new Date());
  const [list, setList] = useState<Estimate[]>([]);
  const [open, setOpen] = useState<Detail | null>(null);
  const [st, setSt] = useState<Statement | null>(null);
  const [cur, setCur] = useState<Record<string, string>>({});
  const [est, setEst] = useState(blankEst);
  const [item, setItem] = useState(blankItem);
  const [sup, setSup] = useState(blankSup);
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [period, setPeriod] = useState({ de_la: "", pana_la: "" });
  const [cancel, setCancel] = useState("");
  const [executant, setExecutant] = useState(readExecutant);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const openId = useRef<string | null>(null);
  const stId = useRef<string | null>(null);

  const openEstimate = useCallback(
    async (id: string) => {
      try {
        const d = await api.moduleCall<Detail>(ID, "deviz", { id });
        if (openId.current !== id) {
          setEst({
            nume: d.nume,
            numar: d.numar,
            data: d.data,
            beneficiar_nume: d.beneficiar_nume,
            contract_text: d.contract_text,
            santier: d.santier,
            tva: String(d.tva),
            garantie: String(d.garantie / 100).replace(".", ","),
            garantie_baza: d.garantie_baza,
            nota: d.nota,
          });
          setPreview(null);
          setPaste("");
        }
        openId.current = id;
        setOpen(d);
      } catch (e) {
        onError(message(e));
      }
    },
    [onError],
  );
  const openStatement = useCallback(
    async (id: string) => {
      try {
        const s = await api.moduleCall<Statement>(ID, "situatie", { id });
        if (stId.current !== id) setCancel("");
        stId.current = id;
        setSt(s);
        setCur(Object.fromEntries(s.linii.map((l) => [l.articol, l.curent ? qty(l.curent) : ""])));
      } catch (e) {
        onError(message(e));
      }
    },
    [onError],
  );
  const load = useCallback(async () => {
    try {
      setList(await api.moduleCall<Estimate[]>(ID, "devize", {}));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
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
    }
    await load();
    if (openId.current) await openEstimate(openId.current);
    if (stId.current) await openStatement(stId.current);
  };

  const newEstimate = () => {
    openId.current = null;
    stId.current = null;
    setOpen(null);
    setSt(null);
    setEst(blankEst);
    setNotice(null);
  };

  const saveEstimate = () =>
    run(async () => {
      const g = parseNum(est.garantie || "0", 2);
      if (g === null) throw new Error("Reținerea de garanție nu e un număr.");
      const r = await api.moduleCall<{ id: string }>(ID, "deviz_save", {
        id: open?.id,
        version: open?.version,
        nume: est.nume,
        numar: est.numar,
        data: est.data || today,
        beneficiar_nume: est.beneficiar_nume,
        contract_text: est.contract_text,
        santier: est.santier,
        tva: Number(est.tva),
        garantie: g,
        garantie_baza: est.garantie_baza,
        nota: est.nota,
      });
      if (!open) {
        stId.current = null;
        setSt(null);
        openId.current = r.id;
      }
      setNotice("Devizul e salvat.");
    });

  const addItem = () =>
    run(async () => {
      if (!open) return;
      const q = parseNum(item.cantitate, 3);
      const p = parseNum(item.pret, 2);
      if (q === null || p === null) throw new Error("Cantitatea și prețul unitar sunt numere (de exemplu 1.500,5 și 12,35).");
      await api.moduleCall(ID, "articol_save", { deviz: open.id, cod: item.cod, denumire: item.denumire, um: item.um, cantitate: q, pret_unitar: p });
      setItem(blankItem);
    });

  const previewPaste = (confirma: boolean) =>
    run(async () => {
      if (!open) return;
      const r = await api.moduleCall<Preview>(ID, "articole_lipire", { deviz: open.id, text: paste, confirma });
      if (confirma) {
        setPreview(null);
        setPaste("");
        setNotice(`Am adăugat ${r.adaugate} articole.`);
      } else setPreview(r);
    });

  const exportFile = async (kind: "pdf" | "xlsx", what: "situatie" | "deviz", id: string, name: string) => {
    const dest = await save({
      defaultPath: `${name}.${kind}`,
      filters: kind === "pdf" ? [{ name: "PDF", extensions: ["pdf"] }] : [{ name: "Foaie de calcul .xlsx", extensions: ["xlsx"] }],
      title: "Unde salvez fișierul?",
    });
    if (!dest) return;
    await api.moduleCall(ID, `${what}_${kind}`, { id, dest, executant });
    setNotice("Fișierul e salvat.");
  };

  const statementLines = () => {
    if (!st) return [];
    return st.linii.map((l) => {
      const t = cur[l.articol] ?? "";
      const q = t.trim() ? parseNum(t, 3) : 0;
      if (q === null) throw new Error(`Cantitatea la „${l.denumire}” nu e un număr.`);
      return { articol: l.articol, cantitate: q };
    });
  };

  const draft = st?.stare === "ciorna";

  return (
    <section className="works">
      {readOnly && <p className="warn">Rolul tău poate doar citi situațiile de lucrări: nu poate schimba nimic.</p>}
      {notice && (
        <p className="muted small" role="status">
          {notice}
        </p>
      )}
      <h3>Devize</h3>
      <table className="audit">
        <tbody>
          {list.length === 0 && (
            <tr>
              <td className="muted">Niciun deviz încă. Scrie unul mai jos, apoi adaugă articolele sau lipește-le dintr-un tabel.</td>
            </tr>
          )}
          {list.map((e) => (
            <tr key={e.id} data-testid="estimate" className={open?.id === e.id ? "selected" : ""}>
              <td>
                <button className="link" onClick={() => void openEstimate(e.id)}>
                  {e.nume}
                </button>
                {e.numar && <span className="muted small">{` · nr. ${e.numar}`}</span>}
              </td>
              <td className="small">{e.beneficiar_nume}</td>
              <td className="small">{e.santier}</td>
              <td className="small">{EST_STATE[e.stare]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        className="contract-card"
        onSubmit={(e) => {
          e.preventDefault();
          void saveEstimate();
        }}
      >
        <h4>{open ? "Datele devizului" : "Deviz nou"}</h4>
        <div className="row wrap">
          <input aria-label="Numele devizului" placeholder="Numele devizului" value={est.nume} onChange={(e) => setEst({ ...est, nume: e.target.value })} />
          <input aria-label="Numărul devizului" placeholder="Numărul" value={est.numar} onChange={(e) => setEst({ ...est, numar: e.target.value })} />
          <input aria-label="Data devizului" type="date" value={est.data || today} onChange={(e) => setEst({ ...est, data: e.target.value })} />
          <input aria-label="Beneficiarul" placeholder="Beneficiarul" value={est.beneficiar_nume} onChange={(e) => setEst({ ...est, beneficiar_nume: e.target.value })} />
          <input aria-label="Contractul" placeholder="Contractul (nr. și data)" value={est.contract_text} onChange={(e) => setEst({ ...est, contract_text: e.target.value })} />
          <input aria-label="Lucrarea" placeholder="Lucrarea / șantierul" value={est.santier} onChange={(e) => setEst({ ...est, santier: e.target.value })} />
        </div>
        <div className="row wrap">
          <label className="small">
            Cota de TVA{" "}
            <select aria-label="Cota de TVA" value={est.tva} onChange={(e) => setEst({ ...est, tva: e.target.value })}>
              <option value="21">21%</option>
              <option value="11">11%</option>
              <option value="0">0% (taxare inversă sau scutit)</option>
            </select>
          </label>
          <label className="small">
            Reținere de garanție %{" "}
            <input aria-label="Reținerea de garanție" className="num" size={5} value={est.garantie} onChange={(e) => setEst({ ...est, garantie: e.target.value })} />
          </label>
          <label className="small">
            calculată pe valoarea{" "}
            <select aria-label="Baza reținerii" value={est.garantie_baza} onChange={(e) => setEst({ ...est, garantie_baza: e.target.value })}>
              <option value="fara_tva">fără TVA</option>
              <option value="cu_tva">cu TVA</option>
            </select>
          </label>
        </div>
        <p className="muted small">Reținerea și baza ei: cum scrie în contract. Cota de TVA o stabilești cu contabilul.</p>
        <div className="row wrap">
          <button type="submit" disabled={busy || readOnly}>
            {open ? "Salvează devizul" : "Adaugă devizul"}
          </button>
          {open && (
            <button type="button" className="small" onClick={newEstimate}>
              Deviz nou
            </button>
          )}
        </div>
      </form>

      {open && (
        <div className="contract-card" data-testid="estimate-card">
          <h3>{open.nume}</h3>
          <p className="small">
            <span>{EST_STATE[open.stare]}</span>
            {open.beneficiar_nume && <span>{` · ${open.beneficiar_nume}`}</span>}
            <span>{" "}<span>{`· valoarea devizului: ${lei(open.valoare_deviz)} lei fără TVA`}</span></span>
          </p>
          <div className="row wrap">
            {(Object.keys(EST_STATE) as Array<Estimate["stare"]>)
              .filter((k) => k !== open.stare)
              .map((k) => (
                <button key={k} className="small" disabled={busy || readOnly} onClick={() => void run(() => api.moduleCall(ID, "deviz_stare", { id: open.id, version: open.version, stare: k }))}>
                  {`Marchează ${EST_STATE[k]}`}
                </button>
              ))}
            <button className="small" disabled={busy || open.articole.length === 0} onClick={() => void run(() => exportFile("xlsx", "deviz", open.id, `deviz-${open.numar || open.nume}`))}>
              Exportă devizul .xlsx
            </button>
            <button
              className="small"
              disabled={busy || readOnly}
              onClick={() =>
                void run(async () => {
                  await api.moduleCall(ID, "deviz_delete", { id: open.id, version: open.version });
                  newEstimate();
                })
              }
            >
              Șterge devizul
            </button>
          </div>

          <h4>Articolele</h4>
          <table className="audit">
            <thead>
              <tr>
                <th>Cod</th>
                <th>Denumire</th>
                <th>UM</th>
                <th className="num">Cantitate</th>
                <th className="num">Preț unitar</th>
                <th className="num">Executat</th>
              </tr>
            </thead>
            <tbody>
              {open.articole.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Niciun articol. Adaugă-le pe rând sau lipește-le dintr-un tabel.
                  </td>
                </tr>
              )}
              {open.articole.map((a) => (
                <tr key={a.id} data-testid="item">
                  <td className="small">{a.cod}</td>
                  <td>
                    {a.denumire}
                    {a.suplimentari.map((s, k) => (
                      <div key={k} className="muted small">
                        {`+ ${qty(s.cantitate)} ${a.um}, ${ro(s.data)}: ${s.motiv}`}
                      </div>
                    ))}
                  </td>
                  <td className="small">{a.um}</td>
                  <td className="num">{qty(a.cantitate_deviz)}</td>
                  <td className="num">{lei(a.pret_unitar)}</td>
                  <td className="num">{qty(a.executat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void addItem();
            }}
          >
            <input aria-label="Codul articolului" placeholder="Cod" size={6} value={item.cod} onChange={(e) => setItem({ ...item, cod: e.target.value })} />
            <input aria-label="Denumirea articolului" placeholder="Denumirea" value={item.denumire} onChange={(e) => setItem({ ...item, denumire: e.target.value })} />
            <input aria-label="Unitatea de măsură" placeholder="UM" size={4} value={item.um} onChange={(e) => setItem({ ...item, um: e.target.value })} />
            <input aria-label="Cantitatea din deviz" placeholder="Cantitatea" size={8} value={item.cantitate} onChange={(e) => setItem({ ...item, cantitate: e.target.value })} />
            <input aria-label="Prețul unitar fără TVA" placeholder="Preț unitar fără TVA" size={10} value={item.pret} onChange={(e) => setItem({ ...item, pret: e.target.value })} />
            <button type="submit" disabled={busy || readOnly}>
              Adaugă articolul
            </button>
          </form>
          <details>
            <summary>Lipește din tabel</summary>
            <p className="muted small">Coloanele: cod, denumire, UM, cantitate, preț unitar fără TVA; separate prin tab (copiate dintr-o foaie de calcul) sau prin „;”.</p>
            <textarea aria-label="Tabelul lipit" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} />
            <div className="row wrap">
              <button disabled={busy || readOnly || !paste.trim()} onClick={() => void previewPaste(false)}>
                Previzualizează
              </button>
              {preview && preview.randuri.length > 0 && (
                <button disabled={busy || readOnly} onClick={() => void previewPaste(true)}>
                  {`Adaugă cele ${preview.randuri.length} articole`}
                </button>
              )}
            </div>
            {preview && (
              <table className="audit" data-testid="paste-preview">
                <tbody>
                  {preview.randuri.map((r, k) => (
                    <tr key={k}>
                      <td className="small">{r.cod}</td>
                      <td>{r.denumire}</td>
                      <td className="small">{r.um}</td>
                      <td className="num">{qty(r.cantitate)}</td>
                      <td className="num">{lei(r.pret_unitar)}</td>
                    </tr>
                  ))}
                  {preview.refuzate.map((r) => (
                    <tr key={`x${r.rand}`} data-testid="paste-refused" className="mnt-depasit">
                      <td className="small">{`rândul ${r.rand}`}</td>
                      <td colSpan={4} className="small">
                        {`nu se adaugă: ${r.motiv}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </details>
          {open.articole.length > 0 && (
            <form
              className="row wrap"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const q = parseNum(sup.cantitate, 3);
                  if (q === null) throw new Error("Cantitatea suplimentată nu e un număr.");
                  await api.moduleCall(ID, "suplimentare_save", { articol: sup.articol || open.articole[0]!.id, cantitate: q, motiv: sup.motiv, data: today });
                  setSup(blankSup);
                });
              }}
            >
              <span className="small">Suplimentare:</span>
              <select aria-label="Articolul suplimentat" value={sup.articol || open.articole[0]!.id} onChange={(e) => setSup({ ...sup, articol: e.target.value })}>
                {open.articole.map((a) => (
                  <option key={a.id} value={a.id}>
                    {`${a.cod} ${a.denumire}`.trim()}
                  </option>
                ))}
              </select>
              <input aria-label="Cantitatea suplimentată" placeholder="Cantitatea în plus" size={8} value={sup.cantitate} onChange={(e) => setSup({ ...sup, cantitate: e.target.value })} />
              <input aria-label="Motivul suplimentării" placeholder="Motivul (obligatoriu)" value={sup.motiv} onChange={(e) => setSup({ ...sup, motiv: e.target.value })} />
              <button type="submit" disabled={busy || readOnly}>
                Adaugă suplimentarea
              </button>
            </form>
          )}

          <h4>Situațiile de plată</h4>
          <table className="audit">
            <tbody>
              {open.situatii.length === 0 && (
                <tr>
                  <td className="muted">Nicio situație încă.</td>
                </tr>
              )}
              {open.situatii.map((s) => (
                <tr key={s.id} data-testid="statement" className={s.numar_dublu || s.depasire ? "mnt-depasit" : ""}>
                  <td>
                    <button className="link" onClick={() => void openStatement(s.id)}>
                      {`Situația nr. ${s.numar}`}
                    </button>
                  </td>
                  <td className="small">{`${ro(s.de_la)} – ${ro(s.pana_la)}`}</td>
                  <td className="small">
                    <strong className={s.stare === "anulata" ? "mnt-state-depasit" : ""}>{STATE_TEXT[s.stare]}</strong>
                    {s.stare === "anulata" && <div className="muted">{s.motiv_anulare}</div>}
                    {s.numar_dublu && <div className="mnt-state-depasit">număr dublu (din alt calculator)</div>}
                    {s.depasire && <div className="mnt-state-depasit">depășește devizul</div>}
                  </td>
                  <td className="num">{`${lei(s.valoare)} lei`}</td>
                  <td className="num">{`de plată ${lei(s.de_plata)} lei`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api.moduleCall<{ id: string }>(ID, "situatie_noua", { deviz: open.id, de_la: period.de_la || today, pana_la: period.pana_la || today, data: today });
                stId.current = r.id;
              });
            }}
          >
            <label className="small">
              Perioada de la{" "}
              <input aria-label="Perioada de la" type="date" value={period.de_la || today} onChange={(e) => setPeriod({ ...period, de_la: e.target.value })} />
            </label>
            <label className="small">
              până la{" "}
              <input aria-label="Perioada până la" type="date" value={period.pana_la || today} onChange={(e) => setPeriod({ ...period, pana_la: e.target.value })} />
            </label>
            <button type="submit" disabled={busy || readOnly || open.articole.length === 0 || open.stare === "inchis"}>
              Situație nouă
            </button>
          </form>
        </div>
      )}

      {open && st && st.deviz === open.id && (
        <div className="contract-card" data-testid="statement-card">
          <h3>{`Situația nr. ${st.numar}`}</h3>
          <p className="small">
            <span className={st.stare === "anulata" ? "mnt-state-depasit" : ""}>{STATE_TEXT[st.stare]}</span>
            <span>{` · perioada ${ro(st.de_la)} – ${ro(st.pana_la)}`}</span>
            {st.stare === "anulata" && <span className="mnt-state-depasit">{` · motivul: ${st.motiv_anulare}`}</span>}
          </p>
          {st.stare === "anulata" && <p className="warn">Situația e anulată: nu mai intră în cantitățile anterioare, iar numărul ei nu se mai folosește.</p>}
          <div className="table-scroll">
            <table className="audit" data-testid="statement-lines">
              <thead>
                <tr>
                  <th>Cod</th>
                  <th>Denumire</th>
                  <th>UM</th>
                  <th className="num">Deviz</th>
                  <th className="num">Anterior</th>
                  <th className="num">Curent</th>
                  <th className="num">Cumulat</th>
                  <th className="num">Rest</th>
                  <th className="num">Valoare curentă</th>
                </tr>
              </thead>
              <tbody>
                {st.linii.map((l) => (
                  <tr key={l.articol} data-testid="line" className={l.depasire ? "mnt-depasit" : ""}>
                    <td className="small">{l.cod}</td>
                    <td>{l.denumire}</td>
                    <td className="small">{l.um}</td>
                    <td className="num">{qty(l.deviz)}</td>
                    <td className="num">{qty(l.anterior)}</td>
                    <td className="num">
                      {draft ? (
                        <input aria-label={`Curent ${l.cod || l.denumire}`} className="num" size={8} value={cur[l.articol] ?? ""} disabled={readOnly} onChange={(e) => setCur({ ...cur, [l.articol]: e.target.value })} />
                      ) : (
                        qty(l.curent)
                      )}
                    </td>
                    <td className="num">{qty(l.cumulat)}</td>
                    <td className="num">{qty(l.rest)}</td>
                    <td className="num">{lei(l.valoare_curent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <table className="audit" data-testid="totals">
            <tbody>
              <tr>
                <td>Valoarea situației (fără TVA)</td>
                <td className="num">{`${lei(st.valoare)} lei`}</td>
              </tr>
              <tr>
                <td>{`TVA ${st.tva}%`}</td>
                <td className="num">{`${lei(st.tva_valoare)} lei`}</td>
              </tr>
              <tr>
                <td>
                  <span>{`Reținere de garanție ${String(st.garantie / 100).replace(".", ",")}%`}</span>{" "}
                  <span className="muted small">{st.garantie_baza === "cu_tva" ? "(pe valoarea cu TVA)" : "(pe valoarea fără TVA)"}</span>
                </td>
                <td className="num">{`− ${lei(st.retinere)} lei`}</td>
              </tr>
              <tr>
                <td>
                  <strong>De plată</strong>
                </td>
                <td className="num">
                  <strong>{`${lei(st.de_plata)} lei`}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          {draft && <p className="muted small">Cât timp e ciornă, TVA și reținerea vin din deviz; la emitere se păstrează cele de atunci.</p>}
          <div className="row wrap">
            {draft && (
              <>
                <button
                  disabled={busy || readOnly}
                  onClick={() => void run(() => api.moduleCall(ID, "situatie_save", { id: st.id, version: st.version, linii: statementLines() }))}
                >
                  Salvează situația
                </button>
                <button
                  disabled={busy || readOnly}
                  onClick={() =>
                    void run(async () => {
                      await api.moduleCall(ID, "situatie_save", { id: st.id, version: st.version, linii: statementLines() });
                      const s = await api.moduleCall<Statement>(ID, "situatie", { id: st.id });
                      await api.moduleCall(ID, "situatie_emite", { id: st.id, version: s.version });
                      setNotice("Situația e emisă. De acum nu se mai schimbă; o greșeală se anulează, cu motiv.");
                    })
                  }
                >
                  Emite situația
                </button>
                <button
                  className="small"
                  disabled={busy || readOnly}
                  onClick={() =>
                    void run(async () => {
                      await api.moduleCall(ID, "situatie_delete", { id: st.id, version: st.version });
                      stId.current = null;
                      setSt(null);
                    })
                  }
                >
                  Șterge ciorna
                </button>
              </>
            )}
            <input
              aria-label="Executantul"
              placeholder="Executantul (firma ta), pentru PDF"
              value={executant}
              onChange={(e) => {
                setExecutant(e.target.value);
                try {
                  localStorage.setItem("kgb.works.executant", e.target.value);
                } catch {
                  /* only a convenience */
                }
              }}
            />
            <button className="small" disabled={busy} onClick={() => void run(() => exportFile("pdf", "situatie", st.id, `situatia-${st.numar}`))}>
              PDF
            </button>
            <button className="small" disabled={busy} onClick={() => void run(() => exportFile("xlsx", "situatie", st.id, `situatia-${st.numar}`))}>
              Exportă .xlsx
            </button>
          </div>
          {st.stare === "emisa" && (
            <form
              className="row wrap"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api.moduleCall(ID, "situatie_anulare", { id: st.id, version: st.version, motiv: cancel });
                  setCancel("");
                });
              }}
            >
              <input aria-label="Motivul anulării" placeholder="Motivul anulării (obligatoriu)" value={cancel} onChange={(e) => setCancel(e.target.value)} />
              <button type="submit" disabled={busy || readOnly || !cancel.trim()}>
                Anulează situația
              </button>
              <span className="muted small">O situație emisă nu se șterge și nu se modifică: se anulează, rămâne vizibilă cu motivul.</span>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
