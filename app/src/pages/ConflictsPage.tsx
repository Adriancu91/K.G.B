// Synchronisation conflicts (Etapa 6, step 6.4): the same thing changed on
// two PCs. Nothing was overwritten: K.G.B. shows one value for now and waits
// for a person to choose. The choice goes to every PC.
import { useCallback, useEffect, useState } from "react";
import { api, message, type ConflictView } from "../api";

export function ConflictsPage({ onError }: { onError: (e: string | null) => void }) {
  const [items, setItems] = useState<ConflictView[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const r = await api.conflicts();
      setItems(r.items);
      setNames(Object.fromEntries(r.modules));
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, keepHere: boolean) => {
    try {
      await api.conflictDecide(id, keepHere);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
    await load();
  };

  if (!items) return <p className="muted">Se încarcă…</p>;
  return (
    <div className="conflicts-page">
      <p className="muted">
        Un conflict apare când același lucru a fost schimbat pe două calculatoare înainte să se sincronizeze. Nimic nu s-a pierdut: până alegi, se
        vede valoarea marcată „acum”. Alegerea ta ajunge pe toate calculatoarele.
      </p>
      {items.length === 0 ? (
        <p role="status">Niciun conflict.</p>
      ) : (
        <table className="audit conflicts-table">
          <thead>
            <tr>
              <th>Modul</th>
              <th>Ce</th>
              <th>Pe acest PC</th>
              <th>Venit de pe alt PC</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.modul ? (names[c.modul] ?? c.modul) : "Organizația"}</td>
                <td>{c.camp === null ? "înregistrare ștearsă pe un PC, modificată pe altul" : `câmpul „${c.camp}”`}</td>
                <td>
                  {c.aici}
                  {c.provizoriu === "aici" && <span className="badge planned"> acum</span>}
                </td>
                <td>
                  {c.venit}
                  {c.provizoriu === "venit" && <span className="badge planned"> acum</span>}
                </td>
                <td>
                  {c.poate_decide ? (
                    <>
                      <button onClick={() => void decide(c.id, true)}>Păstrează de aici</button>{" "}
                      <button onClick={() => void decide(c.id, false)}>Păstrează venit</button>
                    </>
                  ) : (
                    <span className="muted small">rolul tău nu poate decide</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
