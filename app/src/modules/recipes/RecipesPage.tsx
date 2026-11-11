// Rețete și costuri (Etapa 7, step 7.9e): recipes with net quantities (the gross comes from the cleaning loss),
// semi-finished parts, the cost per portion, the proposed price (mark-up and the VAT rate the person chooses), the
// margin and food cost, the allergens ticked on the ingredients (the 14 of Reg. (EU) 1169/2011, annex II), and the
// consumption list exported as CSV. Everything is computed by the module; nothing goes to Business by itself.
// A read-only role sees everything and changes nothing.
import { useCallback, useEffect, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";

const ID = "kgb.recipes";
/** Reg. (EU) 1169/2011, annex II: the 14 substances or products causing allergies or intolerances. */
export const ALLERGENS: Array<[string, string]> = [
  ["gluten", "Cereale care conțin gluten"],
  ["crustacee", "Crustacee și produse derivate"],
  ["oua", "Ouă și produse derivate"],
  ["peste", "Pește și produse derivate"],
  ["arahide", "Arahide și produse derivate"],
  ["soia", "Soia și produse derivate"],
  ["lapte", "Lapte și produse derivate (inclusiv lactoză)"],
  ["fructe_coaja", "Fructe cu coajă"],
  ["telina", "Țelină și produse derivate"],
  ["mustar", "Muștar și produse derivate"],
  ["susan", "Semințe de susan și produse derivate"],
  ["sulfiti", "Dioxid de sulf și sulfiți"],
  ["lupin", "Lupin și produse derivate"],
  ["moluste", "Moluște și produse derivate"],
];
const KINDS: Array<[string, string]> = [
  ["preparat", "preparat"],
  ["produs", "produs"],
  ["semipreparat", "semipreparat"],
];

interface Ingredient {
  id: string;
  version: number;
  nume: string;
  um: string;
  pret: number;
  pret_data: string;
  furnizor_nume: string;
  pierdere: number;
  alergeni: string[];
  activ: boolean;
}
interface RecipeRow {
  id: string;
  version: number;
  nume: string;
  fel: string;
  categorie: string;
  lot: number;
  unitate_lot: string;
  activ: boolean;
}
interface Line {
  tip: "ingredient" | "reteta";
  id: string;
  cantitate: number;
}
interface Recipe extends RecipeRow {
  linii: Line[];
  randament_preparare: number;
  adaos: number;
  tva: number;
  pret_vanzare: number;
  preparare: string;
  calcul: {
    linii: Array<{ tip: string; id: string; nume: string; um: string; net: number; brut: number; cost: number }>;
    cost_lot: number;
    cost_unitate: number;
    pret_propus: number;
    pret: number;
    pret_scris: boolean;
    marja: number | null;
    food_cost: number | null;
    alergeni: string[];
    avertismente: string[];
    net_dupa_preparare_kg: number | null;
    cost_kg_preparat: number | null;
  };
}
interface UseRow {
  nume: string;
  um: string;
  cantitate: number;
  cost: number;
}

const z = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const lei = (b: number) => {
  const [i, f] = (Math.abs(Math.round(b)) / 100).toFixed(2).split(".");
  return `${b < 0 ? "-" : ""}${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${f}`;
};
const qty = (x: number) => x.toFixed(3).replace(".", ",");
const pct = (x: number) => (x / 100).toFixed(2).replace(".", ",");
/** „2,5” or „0.8” → thousandths; NaN when it is not a number. */
const milli = (t: string) => Math.round(Number(t.trim().replace(",", ".")) * 1000);
const toBani = (t: string) => {
  const s = t.trim().replace(/\s/g, "");
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const toPct100 = (t: string) => Math.round(Number(t.trim().replace(",", ".") || "0") * 100);

const blankIng = { nume: "", um: "kg", pret: "", pret_data: "", furnizor_nume: "", pierdere: "", alergeni: [] as string[] };
const blankRecipe = { nume: "", fel: "preparat", categorie: "", lot: "1", unitate_lot: "porție" };

export function RecipesPage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const today = iso(new Date());
  const [tab, setTab] = useState<"retete" | "ingrediente" | "consum">("retete");
  const [ings, setIngs] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [open, setOpen] = useState<Recipe | null>(null);
  const openId = useRef<string | null>(null);
  const [draft, setDraft] = useState<{ linii: Line[]; lot: string; unitate_lot: string; adaos: string; tva: number; pret_vanzare: string; randament: string; preparare: string } | null>(null);
  const [newLine, setNewLine] = useState({ ref: "", cantitate: "" });
  const [ing, setIng] = useState(blankIng);
  const [rec, setRec] = useState(blankRecipe);
  const [uses, setUses] = useState<Array<{ reteta: string; portii: string }>>([{ reteta: "", portii: "1" }]);
  const [useRows, setUseRows] = useState<UseRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const openRecipe = useCallback(
    async (id: string) => {
      try {
        openId.current = id;
        const r = await api.moduleCall<Recipe>(ID, "reteta", { id, azi: today });
        setOpen(r);
        setDraft({
          linii: r.linii,
          lot: String(r.lot / 1000).replace(".", ","),
          unitate_lot: r.unitate_lot,
          adaos: pct(r.adaos),
          tva: r.tva,
          pret_vanzare: r.pret_vanzare ? lei(r.pret_vanzare) : "",
          randament: r.randament_preparare ? pct(r.randament_preparare) : "",
          preparare: r.preparare,
        });
      } catch (e) {
        onError(message(e));
      }
    },
    [today, onError],
  );
  const load = useCallback(async () => {
    try {
      const [i, r] = await Promise.all([api.moduleCall<Ingredient[]>(ID, "ingrediente", {}), api.moduleCall<RecipeRow[]>(ID, "retete", {})]);
      setIngs(i);
      setRecipes(r);
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
    if (openId.current) await openRecipe(openId.current);
  };

  const saveRecipe = (lines: Line[]) =>
    run(async () => {
      if (!open || !draft) return;
      const lot = milli(draft.lot);
      const sale = toBani(draft.pret_vanzare);
      if (!Number.isFinite(lot) || lot <= 0) throw new Error(`„${draft.lot}” nu e o cantitate.`);
      if (!Number.isFinite(sale) || sale < 0) throw new Error(`„${draft.pret_vanzare}” nu e un preț.`);
      await api.moduleCall(ID, "reteta_save", {
        id: open.id,
        version: open.version,
        nume: open.nume,
        fel: open.fel,
        categorie: open.categorie,
        lot,
        unitate_lot: draft.unitate_lot,
        linii: lines,
        adaos: toPct100(draft.adaos),
        tva: draft.tva,
        pret_vanzare: sale,
        randament_preparare: draft.randament.trim() ? toPct100(draft.randament) : 0,
        preparare: draft.preparare,
        activ: open.activ,
      });
    });

  const allergenText = (codes: string[]) => codes.map((c) => ALLERGENS.find(([k]) => k === c)?.[1] ?? c);
  const c = open?.calcul;

  return (
    <section className="recipes">
      {readOnly && <p className="warn">Rolul tău poate doar citi rețetele: nu le poate schimba.</p>}
      <div className="sheet-tabs" role="tablist" aria-label="Vederea">
        {(
          [
            ["retete", "Rețete"],
            ["ingrediente", "Ingrediente"],
            ["consum", "Consum"],
          ] as const
        ).map(([k, v]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? "active" : ""}
            onClick={() => {
              setTab(k);
              setNotice(null);
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {tab === "retete" && (
        <>
          <table className="audit">
            <tbody>
              {recipes.length === 0 && (
                <tr>
                  <td className="muted">Nicio rețetă. Adaugă întâi ingredientele, apoi rețeta mai jos.</td>
                </tr>
              )}
              {recipes.map((r) => (
                <tr key={r.id} data-testid="recipe">
                  <td>
                    <button className="link" onClick={() => void openRecipe(r.id)}>
                      {r.nume}
                    </button>
                  </td>
                  <td className="small">{r.fel}</td>
                  <td className="small">{r.categorie}</td>
                  <td className="small">{`${String(r.lot / 1000).replace(".", ",")} ${r.unitate_lot}`}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {open && draft && c && (
            <div className="contract-card" data-testid="recipe-card">
              <h3>{open.nume}</h3>
              <table className="audit">
                <tbody>
                  {c.linii.map((l, n) => (
                    <tr key={n} data-testid="recipe-line">
                      <td>{l.nume}</td>
                      <td className="small">{`${qty(l.net)} ${l.um} net`}</td>
                      <td className="small">{l.tip === "ingredient" && l.brut !== l.net ? `${qty(l.brut)} ${l.um} brut` : ""}</td>
                      <td>{`${lei(l.cost)} lei`}</td>
                      <td>
                        <button className="link small" disabled={busy || readOnly} onClick={() => void saveRecipe(draft.linii.filter((_, k) => k !== n))}>
                          scoate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <form
                className="row wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  const [tip, id] = newLine.ref.split(":") as ["ingredient" | "reteta", string];
                  const q = milli(newLine.cantitate);
                  if (!id || !Number.isFinite(q) || q <= 0) {
                    onError("Alege ce adaugi și scrie cantitatea netă.");
                    return;
                  }
                  setNewLine({ ref: "", cantitate: "" });
                  void saveRecipe([...draft.linii, { tip, id, cantitate: q }]);
                }}
              >
                <select aria-label="Ce adaugi în rețetă" value={newLine.ref} onChange={(e) => setNewLine({ ...newLine, ref: e.target.value })}>
                  <option value="">(alege)</option>
                  <optgroup label="Ingrediente">
                    {ings.map((x) => (
                      <option key={x.id} value={`ingredient:${x.id}`}>
                        {`${x.nume} (${x.um})`}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Semipreparate">
                    {recipes
                      .filter((r) => r.fel === "semipreparat" && r.id !== open.id)
                      .map((r) => (
                        <option key={r.id} value={`reteta:${r.id}`}>
                          {`${r.nume} (${r.unitate_lot})`}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <input aria-label="Cantitatea netă" placeholder="cantitate netă (după curățare)" value={newLine.cantitate} onChange={(e) => setNewLine({ ...newLine, cantitate: e.target.value })} size={14} />
                <button disabled={busy || readOnly}>Adaugă linia</button>
              </form>

              <div className="row wrap">
                <label className="small">
                  iese <input aria-label="Cât iese" value={draft.lot} onChange={(e) => setDraft({ ...draft, lot: e.target.value })} size={5} />
                </label>
                <input aria-label="Unitatea lotului" value={draft.unitate_lot} onChange={(e) => setDraft({ ...draft, unitate_lot: e.target.value })} size={7} />
                <label className="small">
                  adaos <input aria-label="Adaosul (%)" value={draft.adaos} onChange={(e) => setDraft({ ...draft, adaos: e.target.value })} size={5} /> %
                </label>
                <label className="small">
                  TVA{" "}
                  <select aria-label="Cota de TVA" value={draft.tva} onChange={(e) => setDraft({ ...draft, tva: Number(e.target.value) })}>
                    {[21, 11, 0].map((v) => (
                      <option key={v} value={v}>{`${v}%`}</option>
                    ))}
                  </select>
                </label>
                <span className="muted small">cota o stabilești cu contabilul</span>
                <label className="small">
                  preț de vânzare <input aria-label="Prețul de vânzare cu TVA" placeholder="gol = cel propus" value={draft.pret_vanzare} onChange={(e) => setDraft({ ...draft, pret_vanzare: e.target.value })} size={9} /> lei
                </label>
                <label className="small">
                  randament la preparare <input aria-label="Randamentul la preparare (%)" placeholder="opțional" value={draft.randament} onChange={(e) => setDraft({ ...draft, randament: e.target.value })} size={5} /> %
                </label>
                <button className="primary" disabled={busy || readOnly} onClick={() => void saveRecipe(draft.linii)}>
                  Salvează rețeta
                </button>
              </div>

              <div className="recipe-sum" data-testid="recipe-sum">
                <div>{`Cost pe lot: ${lei(c.cost_lot)} lei · pe ${open.unitate_lot}: ${lei(c.cost_unitate)} lei (fără TVA)`}</div>
                <div>
                  <span>{`Preț propus: ${lei(c.pret_propus)} lei cu TVA`}</span>
                  {c.pret_scris && <span>{" "}<span>{`· preț scris: ${lei(c.pret)} lei`}</span></span>}
                </div>
                {c.marja !== null && c.food_cost !== null && <div>{`Marja: ${pct(c.marja)}% · food cost: ${pct(c.food_cost)}%`}</div>}
                {c.net_dupa_preparare_kg !== null && (
                  <div>
                    <span>{`Greutate netă după preparare: ${qty(c.net_dupa_preparare_kg)} kg`}</span>
                    {c.cost_kg_preparat !== null && <span>{" "}<span>{`· ${lei(c.cost_kg_preparat)} lei/kg gata preparat`}</span></span>}
                  </div>
                )}
                <div data-testid="recipe-allergens">
                  <strong>Alergeni: </strong>
                  {c.alergeni.length ? <span>{allergenText(c.alergeni).join(", ")}</span> : <span>nebifat</span>}
                  <span className="muted small"> (după ingredientele bifate de tine)</span>
                </div>
                {c.avertismente.map((w, n) => (
                  <div key={n} className="mnt-state-curand small" data-testid="recipe-warning">
                    {w}
                  </div>
                ))}
              </div>
              <div className="row wrap">
                <button
                  className="small"
                  disabled={busy || readOnly}
                  onClick={() =>
                    void run(async () => {
                      const r = await api.moduleCall<{ id: string }>(ID, "reteta_copie", { id: open.id });
                      openId.current = r.id;
                    })
                  }
                >
                  Copiază rețeta
                </button>
              </div>
            </div>
          )}

          <h3>Rețetă nouă</h3>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const lot = milli(rec.lot);
                if (!Number.isFinite(lot) || lot <= 0) throw new Error(`„${rec.lot}” nu e o cantitate.`);
                const r = await api.moduleCall<{ id: string }>(ID, "reteta_save", { nume: rec.nume, fel: rec.fel, categorie: rec.categorie, lot, unitate_lot: rec.unitate_lot });
                openId.current = r.id;
                setRec(blankRecipe);
              });
            }}
          >
            <input aria-label="Numele rețetei" placeholder="Nume (Piure, Sos alb, Cozonac)" value={rec.nume} onChange={(e) => setRec({ ...rec, nume: e.target.value })} required />
            <select aria-label="Felul rețetei" value={rec.fel} onChange={(e) => setRec({ ...rec, fel: e.target.value })}>
              {KINDS.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input aria-label="Categoria rețetei" placeholder="Categorie (Ciorbe, Patiserie)" value={rec.categorie} onChange={(e) => setRec({ ...rec, categorie: e.target.value })} size={14} />
            <label className="small">
              iese <input aria-label="Cât iese din rețetă" value={rec.lot} onChange={(e) => setRec({ ...rec, lot: e.target.value })} size={5} />
            </label>
            <input aria-label="Unitatea rețetei" value={rec.unitate_lot} onChange={(e) => setRec({ ...rec, unitate_lot: e.target.value })} size={7} />
            <button className="primary" disabled={busy || readOnly}>
              Adaugă rețeta
            </button>
          </form>
        </>
      )}

      {tab === "ingrediente" && (
        <>
          <table className="audit">
            <tbody>
              {ings.length === 0 && (
                <tr>
                  <td className="muted">Niciun ingredient încă.</td>
                </tr>
              )}
              {ings.map((x) => (
                <tr key={x.id} data-testid="ingredient">
                  <td>{x.nume}</td>
                  <td className="small">{x.pret ? `${lei(x.pret)} lei/${x.um}` : "fără preț"}</td>
                  <td className="small">{x.pret_data ? x.pret_data.split("-").reverse().join(".") : ""}</td>
                  <td className="small">{x.pierdere ? `pierdere ${pct(x.pierdere)}%` : ""}</td>
                  <td className="small">{x.alergeni.length ? allergenText(x.alergeni).join(", ") : <span className="muted">alergeni nebifați</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Ingredient nou</h3>
          <form
            className="vault-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const pret = toBani(ing.pret);
                if (!Number.isFinite(pret) || pret < 0) throw new Error(`„${ing.pret}” nu e un preț.`);
                await api.moduleCall(ID, "ingredient_save", {
                  nume: ing.nume,
                  um: ing.um,
                  pret,
                  pret_data: ing.pret_data || today,
                  furnizor_nume: ing.furnizor_nume,
                  pierdere: toPct100(ing.pierdere),
                  alergeni: ing.alergeni,
                });
                setIng(blankIng);
              });
            }}
          >
            <div className="row wrap">
              <input aria-label="Numele ingredientului" placeholder="Nume (Cartofi, Lapte)" value={ing.nume} onChange={(e) => setIng({ ...ing, nume: e.target.value })} required />
              <select aria-label="Unitatea ingredientului" value={ing.um} onChange={(e) => setIng({ ...ing, um: e.target.value })}>
                <option value="kg">kg</option>
                <option value="l">l</option>
                <option value="buc">buc</option>
              </select>
              <input aria-label="Prețul fără TVA pe unitate" placeholder="preț fără TVA (lei)" value={ing.pret} onChange={(e) => setIng({ ...ing, pret: e.target.value })} size={10} />
              <input aria-label="Data prețului" type="date" value={ing.pret_data || today} onChange={(e) => setIng({ ...ing, pret_data: e.target.value })} />
              <input aria-label="Furnizorul" placeholder="furnizor" value={ing.furnizor_nume} onChange={(e) => setIng({ ...ing, furnizor_nume: e.target.value })} size={14} />
              <label className="small">
                pierdere la curățare <input aria-label="Pierderea la curățare (%)" value={ing.pierdere} onChange={(e) => setIng({ ...ing, pierdere: e.target.value })} size={4} /> %
              </label>
            </div>
            <fieldset className="recipe-allergens">
              <legend className="small">Alergeni (Reg. UE 1169/2011, anexa II): bifează-i pe cei pe care îi conține</legend>
              {ALLERGENS.map(([k, v]) => (
                <label key={k} className="small">
                  <input
                    type="checkbox"
                    aria-label={v}
                    checked={ing.alergeni.includes(k)}
                    onChange={(e) => setIng({ ...ing, alergeni: e.target.checked ? [...ing.alergeni, k] : ing.alergeni.filter((x) => x !== k) })}
                  />{" "}
                  {v}
                </label>
              ))}
            </fieldset>
            <button className="primary" disabled={busy || readOnly}>
              Adaugă ingredientul
            </button>
          </form>
        </>
      )}

      {tab === "consum" && (
        <>
          <p className="muted small">Ce iese din magazie (cantitatea brută) pentru rețetele și porțiile alese. Nu scade nimic din stoc: exporți lista și o folosești unde vrei.</p>
          {uses.map((u, n) => (
            <div key={n} className="row wrap">
              <select aria-label="Rețeta pentru consum" value={u.reteta} onChange={(e) => setUses(uses.map((x, k) => (k === n ? { ...x, reteta: e.target.value } : x)))}>
                <option value="">(alege rețeta)</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nume}
                  </option>
                ))}
              </select>
              <input aria-label="Câte porții" value={u.portii} onChange={(e) => setUses(uses.map((x, k) => (k === n ? { ...x, portii: e.target.value } : x)))} size={5} />
            </div>
          ))}
          <div className="row wrap">
            <button className="small" onClick={() => setUses([...uses, { reteta: "", portii: "1" }])}>
              + încă o rețetă
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const linii = uses.filter((u) => u.reteta).map((u) => ({ reteta: u.reteta, portii: milli(u.portii) }));
                  setUseRows(await api.moduleCall<UseRow[]>(ID, "consum", { linii }));
                })
              }
            >
              Calculează consumul
            </button>
            {useRows && useRows.length > 0 && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const dest = await save({ defaultPath: `consum-${today}.csv`, filters: [{ name: "CSV", extensions: ["csv"] }], title: "Unde salvez lista de consum?" });
                    if (!dest) return;
                    const linii = uses.filter((u) => u.reteta).map((u) => ({ reteta: u.reteta, portii: milli(u.portii) }));
                    await api.moduleCall(ID, "consum_export", { linii, dest });
                    setNotice("Lista de consum e salvată.");
                  })
                }
              >
                Exportă .csv
              </button>
            )}
          </div>
          {useRows && (
            <table className="audit" data-testid="use">
              <tbody>
                {useRows.map((r) => (
                  <tr key={r.nume}>
                    <td>{r.nume}</td>
                    <td>{`${qty(r.cantitate)} ${r.um}`}</td>
                    <td>{`${lei(r.cost)} lei`}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td />
                  <td>
                    <strong>{`${lei(useRows.reduce((a, r) => a + r.cost, 0))} lei`}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </>
      )}
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
