// Business reports (Etapa 5, step 5.7): sales, expenses, cost of goods sold,
// a simple result and the stock value, for a period; export XLSX or CSV.
import { useCallback, useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";

const ID = "kgb.business";

interface Sums {
  net_text: string;
  tva_text: string;
  total_text: string;
}
interface Named {
  nume: string;
  valori: Sums;
}
interface Report {
  vanzari: Sums;
  pe_clienti: Named[];
  pe_produse: { nume: string; cantitate_text: string; net_text: string }[];
  cheltuieli: Sums;
  pe_categorii: Named[];
  pe_furnizori: Named[];
  cost_marfuri_text: string;
  profit: number;
  profit_text: string;
  stoc_valoare_text: string;
}
const TABLES = ["Rezumat", "Vânzări pe clienți", "Vânzări pe produse", "Cheltuieli pe categorii", "Cheltuieli pe furnizori", "Stoc"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function SumsTable({ title, first, rows }: { title: string; first: string; rows: Named[] }) {
  return (
    <>
      <h3>{title}</h3>
      <table className="audit">
        <thead>
          <tr>
            <th>{first}</th>
            <th>Fără TVA</th>
            <th>TVA</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Nimic în perioada aleasă.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.nume}>
              <td>{r.nume}</td>
              <td className="num">{r.valori.net_text}</td>
              <td className="num">{r.valori.tva_text}</td>
              <td className="num">{r.valori.total_text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function BusinessReports({ onError }: { onError: (e: string | null) => void }) {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [r, setR] = useState<Report | null>(null);
  const [csvTable, setCsvTable] = useState(TABLES[0] ?? "Rezumat");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setR(await api.moduleCall<Report>(ID, "report", { de_la: from, pana_la: to }));
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [from, to, onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const exportAs = async (format: "xlsx" | "csv") => {
    try {
      const dest = await save({
        defaultPath: format === "xlsx" ? `Raport business ${from} – ${to}.xlsx` : `${csvTable} ${from} – ${to}.csv`,
        filters: [format === "xlsx" ? { name: "Excel", extensions: ["xlsx"] } : { name: "CSV", extensions: ["csv"] }],
      });
      if (!dest) return;
      await api.moduleCall(ID, "report_export", { de_la: from, pana_la: to, format, ...(format === "csv" ? { tabel: csvTable } : {}), dest });
      setNotice(`Salvat: ${dest}. Fișierul a fost redeschis și verificat celulă cu celulă.`);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  };

  // The monthly package for the accountant (7.4j): last month by default.
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [month, setMonth] = useState(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
  const pack = async () => {
    try {
      const dest = await save({ defaultPath: `Pachet contabil ${month}.zip`, filters: [{ name: "Arhivă ZIP", extensions: ["zip"] }] });
      if (!dest) return;
      const p = await api.moduleCall<{ facturi: number; cheltuieli: number; plati: number }>(ID, "accountant_package", { luna: month, dest });
      setNotice(`Pachetul pentru ${month} e salvat în ${dest}: ${p.facturi} facturi emise (PDF), ${p.cheltuieli} cheltuieli, ${p.plati} încasări și plăți, scadențarul și raportul lunii.`);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  };

  return (
    <div className="business-reports">
      <div className="row wrap package-row">
        <strong>Pachetul lunar pentru contabil</strong>
        <input aria-label="Luna pachetului" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button onClick={() => void pack()}>Creează pachetul (ZIP)…</button>
        <span className="muted small">Facturile emise în PDF, jurnalele de vânzări și cumpărări, încasările și plățile, scadențarul și raportul lunii.</span>
      </div>
      <div className="row wrap">
        <label>
          De la
          <input aria-label="Raport de la" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Până la
          <input aria-label="Raport până la" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <span className="grow" />
        <button className="primary" onClick={() => void exportAs("xlsx")}>
          Exportă XLSX…
        </button>
        <select aria-label="Tabelul CSV" value={csvTable} onChange={(e) => setCsvTable(e.target.value)}>
          {TABLES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button onClick={() => void exportAs("csv")}>Exportă CSV…</button>
      </div>
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {r && (
        <>
          <table className="audit report-summary">
            <tbody>
              <tr>
                <td>Vânzări fără TVA</td>
                <td className="num">{r.vanzari.net_text}</td>
              </tr>
              <tr>
                <td>− Costul mărfurilor vândute (cost mediu)</td>
                <td className="num">{r.cost_marfuri_text}</td>
              </tr>
              <tr>
                <td>− Cheltuieli fără TVA</td>
                <td className="num">{r.cheltuieli.net_text}</td>
              </tr>
              <tr className={r.profit < 0 ? "low" : ""}>
                <th>Rezultat simplu</th>
                <th className="num">{r.profit_text}</th>
              </tr>
              <tr>
                <td>Valoarea stocului la sfârșitul perioadei</td>
                <td className="num">{r.stoc_valoare_text}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">Rezultatul simplu e un indicator pentru tine, nu rezultatul contabil al firmei (fără amortizări, salarii înregistrate în altă parte, impozite etc.).</p>
          <SumsTable title="Vânzări pe clienți" first="Client" rows={r.pe_clienti} />
          <h3>Vânzări pe produse</h3>
          <table className="audit">
            <thead>
              <tr>
                <th>Produs / serviciu</th>
                <th>Cantitate</th>
                <th>Fără TVA</th>
              </tr>
            </thead>
            <tbody>
              {r.pe_produse.map((p) => (
                <tr key={p.nume}>
                  <td>{p.nume}</td>
                  <td className="num">{p.cantitate_text}</td>
                  <td className="num">{p.net_text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <SumsTable title="Cheltuieli pe categorii" first="Categorie" rows={r.pe_categorii} />
          <SumsTable title="Cheltuieli pe furnizori" first="Furnizor" rows={r.pe_furnizori} />
        </>
      )}
    </div>
  );
}
