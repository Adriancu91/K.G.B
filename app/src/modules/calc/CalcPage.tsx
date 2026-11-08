// Calculator and conversions (Etapa 7, step 7.4; D-065): exact arithmetic,
// exact unit factors, and everyday money calculations in whole bani.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, message } from "../../api";

const ID = "kgb.calc";

interface Category {
  id: string;
  nume: string;
  unitati: Array<{ id: string; nume: string }>;
}
interface Hist {
  expresie: string;
  rezultat: string;
  exact: boolean;
}

function Result({ r }: { r: { rezultat: string; exact: boolean } | null }) {
  if (!r) return null;
  return (
    <span className="calc-result" role="status">
      {r.exact ? "= " : "≈ "}
      <strong>{r.rezultat}</strong>
      {!r.exact && <span className="muted small"> (rotunjit la 10 zecimale)</span>}
    </span>
  );
}

export function CalcPage({ onError }: { onError: (e: string | null) => void }) {
  const [tab, setTab] = useState<"calc" | "conv" | "bani">("calc");
  const [expr, setExpr] = useState("");
  const [res, setRes] = useState<{ rezultat: string; exact: boolean } | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [cv, setCv] = useState({ categorie: "lungime", valoare: "1", din: "in", in: "cm" });
  const [cres, setCres] = useState<{ rezultat: string; exact: boolean } | null>(null);
  const [tva, setTva] = useState({ suma: "", cota: "21", din: "net" });
  const [tvaR, setTvaR] = useState<Record<string, string> | null>(null);
  const [ad, setAd] = useState({ cost: "", pret: "", adaos: "" });
  const [adR, setAdR] = useState<Record<string, string> | null>(null);
  const [pc, setPc] = useState({ tip: "din", a: "", b: "" });
  const [pcR, setPcR] = useState<{ rezultat: string; exact: boolean } | null>(null);
  const [db, setDb] = useState({ suma: "", rata: "", zile: "365" });
  const [dbR, setDbR] = useState<Record<string, string> | null>(null);

  const loadHist = useCallback(async () => {
    try {
      setHist(await api.moduleCall<Hist[]>(ID, "istoric"));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void loadHist();
    void api.moduleCall<Category[]>(ID, "unitati").then(setCats, (e) => onError(message(e)));
  }, [loadHist, onError]);

  const call = async <T,>(cmd: string, a: Record<string, unknown>, set: (v: T) => void) => {
    try {
      set(await api.moduleCall<T>(ID, cmd, a));
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  };
  const submit = (f: () => void) => (e: FormEvent) => {
    e.preventDefault();
    f();
  };
  const cat = cats.find((c) => c.id === cv.categorie);

  return (
    <div className="calc">
      <div className="sheet-tabs">
        <button className={tab === "calc" ? "active" : ""} onClick={() => setTab("calc")}>
          Calculator
        </button>
        <button className={tab === "conv" ? "active" : ""} onClick={() => setTab("conv")}>
          Conversii
        </button>
        <button className={tab === "bani" ? "active" : ""} onClick={() => setTab("bani")}>
          TVA, adaos, procente, dobândă
        </button>
      </div>

      {tab === "calc" && (
        <>
          <form className="row" aria-label="Calculator" onSubmit={submit(() => void call("calc", { expresie: expr }, setRes).then(loadHist))}>
            <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="de ex. (1.250 + 18,5%) × 3" aria-label="Expresia" autoFocus />
            <button type="submit" className="primary">
              =
            </button>
          </form>
          <Result r={res} />
          <p className="muted small">Calculul e exact (0,1 + 0,2 = 0,3). Virgula e zecimală, punctul desparte miile; „%” înseamnă împărțit la 100.</p>
          {hist.length > 0 && (
            <>
              <h4>Istoric</h4>
              <ul className="calc-history">
                {hist.map((h, i) => (
                  <li key={i}>
                    <button className="link" onClick={() => setExpr(h.expresie)}>
                      {h.expresie}
                    </button>{" "}
                    {h.exact ? "=" : "≈"} {h.rezultat}
                  </li>
                ))}
              </ul>
              <button className="link" onClick={() => void api.moduleCall(ID, "istoric_sterge").then(loadHist)}>
                golește istoricul
              </button>
            </>
          )}
        </>
      )}

      {tab === "conv" && cat && (
        <form className="row wrap" aria-label="Conversie" onSubmit={submit(() => void call("convert", cv, setCres))}>
          <select
            value={cv.categorie}
            aria-label="Categoria"
            onChange={(e) => {
              const c = cats.find((x) => x.id === e.target.value)!;
              setCv({ ...cv, categorie: c.id, din: c.unitati[0]!.id, in: c.unitati[1]!.id });
              setCres(null);
            }}
          >
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nume}
              </option>
            ))}
          </select>
          <input value={cv.valoare} onChange={(e) => setCv({ ...cv, valoare: e.target.value })} aria-label="Valoarea" size={12} />
          <select value={cv.din} onChange={(e) => setCv({ ...cv, din: e.target.value })} aria-label="Din unitatea">
            {cat.unitati.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nume}
              </option>
            ))}
          </select>
          în
          <select value={cv.in} onChange={(e) => setCv({ ...cv, in: e.target.value })} aria-label="În unitatea">
            {cat.unitati.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nume}
              </option>
            ))}
          </select>
          <button type="submit" className="primary">
            Convertește
          </button>
          <Result r={cres} />
        </form>
      )}

      {tab === "bani" && (
        <div className="money-calcs">
          <p className="muted small">Sumele se socotesc în bani întregi; fiecare rotunjire e la ban, jumătatea în sus.</p>
          <form className="row wrap" aria-label="TVA" onSubmit={submit(() => void call("tva", tva, setTvaR))}>
            <strong>TVA</strong>
            <input placeholder="suma (lei)" value={tva.suma} onChange={(e) => setTva({ ...tva, suma: e.target.value })} aria-label="Suma TVA" size={12} />
            <select value={tva.din} onChange={(e) => setTva({ ...tva, din: e.target.value })} aria-label="Suma este">
              <option value="net">fără TVA</option>
              <option value="brut">cu TVA</option>
            </select>
            <label className="small">
              cota % <input value={tva.cota} onChange={(e) => setTva({ ...tva, cota: e.target.value })} aria-label="Cota TVA" size={4} />
            </label>
            <button type="submit">Calculează</button>
            {tvaR && (
              <span className="calc-result" role="status">
                net {tvaR.net} + TVA {tvaR.tva} = <strong>{tvaR.brut}</strong> lei
              </span>
            )}
          </form>
          <form className="row wrap" aria-label="Adaos" onSubmit={submit(() => void call("adaos", ad, setAdR))}>
            <strong>Adaos și marjă</strong>
            <input placeholder="cost (lei)" value={ad.cost} onChange={(e) => setAd({ ...ad, cost: e.target.value })} aria-label="Costul" size={10} />
            <input placeholder="preț de vânzare" value={ad.pret} onChange={(e) => setAd({ ...ad, pret: e.target.value })} aria-label="Prețul" size={10} />
            <input placeholder="sau adaos %" value={ad.adaos} onChange={(e) => setAd({ ...ad, adaos: e.target.value })} aria-label="Adaosul" size={8} />
            <button type="submit">Calculează</button>
            {adR && (
              <span className="calc-result" role="status">
                preț {adR.pret} lei · profit {adR.profit} lei · adaos <strong>{adR.adaos_pct}%</strong> · marjă <strong>{adR.marja_pct}%</strong>
              </span>
            )}
          </form>
          <form className="row wrap" aria-label="Procente" onSubmit={submit(() => void call("procent", pc, setPcR))}>
            <strong>Procente</strong>
            <select value={pc.tip} onChange={(e) => setPc({ ...pc, tip: e.target.value })} aria-label="Tipul calculului">
              <option value="din">A% din B</option>
              <option value="cat_la_suta">A reprezintă ce % din B</option>
              <option value="variatie">creșterea de la A la B, în %</option>
            </select>
            <input placeholder="A" value={pc.a} onChange={(e) => setPc({ ...pc, a: e.target.value })} aria-label="A" size={8} />
            <input placeholder="B" value={pc.b} onChange={(e) => setPc({ ...pc, b: e.target.value })} aria-label="B" size={8} />
            <button type="submit">Calculează</button>
            <Result r={pcR} />
          </form>
          <form className="row wrap" aria-label="Dobândă" onSubmit={submit(() => void call("dobanda", { ...db, zile: Number(db.zile) || 0 }, setDbR))}>
            <strong>Dobândă simplă</strong>
            <input placeholder="suma (lei)" value={db.suma} onChange={(e) => setDb({ ...db, suma: e.target.value })} aria-label="Suma dobânzii" size={10} />
            <label className="small">
              % pe an <input value={db.rata} onChange={(e) => setDb({ ...db, rata: e.target.value })} aria-label="Rata" size={5} />
            </label>
            <label className="small">
              zile <input value={db.zile} onChange={(e) => setDb({ ...db, zile: e.target.value })} aria-label="Zile" size={5} />
            </label>
            <button type="submit">Calculează</button>
            {dbR && (
              <span className="calc-result" role="status">
                dobânda <strong>{dbR.dobanda}</strong> lei · total {dbR.total} lei
              </span>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
