// Planner reports (Etapa 4, step 4.6): tasks per person and per project, by
// state, with overdue ones; export as XLSX (three sheets) or CSV (one table).
// The report follows the filters chosen above the list.
import { useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";

const ID = "kgb.planner";

interface Row {
  nume: string;
  de_facut: number;
  in_lucru: number;
  blocat: number;
  gata: number;
  total: number;
  intarziate: number;
}
interface Report {
  pe_persoana: Row[];
  pe_proiect: Row[];
  total: Row;
}

function Table({ first, rows, total }: { first: string; rows: Row[]; total: Row }) {
  return (
    <table className="audit report">
      <thead>
        <tr>
          <th>{first}</th>
          <th>De făcut</th>
          <th>În lucru</th>
          <th>Blocat</th>
          <th>Gata</th>
          <th>Total</th>
          <th>Întârziate</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="muted">
              Niciun task pentru filtrele alese.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.nume}>
            <td>{r.nume}</td>
            <td>{r.de_facut}</td>
            <td>{r.in_lucru}</td>
            <td>{r.blocat}</td>
            <td>{r.gata}</td>
            <td>
              <strong>{r.total}</strong>
            </td>
            <td className={r.intarziate ? "error" : ""}>{r.intarziate}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th>Total</th>
          <th>{total.de_facut}</th>
          <th>{total.in_lucru}</th>
          <th>{total.blocat}</th>
          <th>{total.gata}</th>
          <th>{total.total}</th>
          <th>{total.intarziate}</th>
        </tr>
      </tfoot>
    </table>
  );
}

export function ReportsView({
  azi,
  filtru,
  version,
  onError,
}: {
  azi: string;
  filtru: Record<string, unknown>;
  /** Changes when the tasks change, so the report is recalculated. */
  version: number;
  onError: (e: string | null) => void;
}) {
  const [r, setR] = useState<Report | null>(null);
  const [table, setTable] = useState<"persoane" | "proiecte" | "taskuri">("taskuri");
  const [notice, setNotice] = useState<string | null>(null);
  const key = JSON.stringify(filtru);

  useEffect(() => {
    api
      .moduleCall<Report>(ID, "report", { azi, filtru: JSON.parse(key) as Record<string, unknown> })
      .then((x) => {
        setR(x);
        onError(null);
      })
      .catch((e: unknown) => onError(message(e)));
  }, [azi, key, version, onError]);

  const exportAs = async (format: "xlsx" | "csv") => {
    try {
      const name = format === "xlsx" ? `Raport taskuri ${azi}.xlsx` : `Raport ${table} ${azi}.csv`;
      const dest = await save({
        defaultPath: name,
        filters: [format === "xlsx" ? { name: "Excel", extensions: ["xlsx"] } : { name: "CSV", extensions: ["csv"] }],
      });
      if (!dest) return;
      const args: Record<string, unknown> = { azi, filtru, format, dest };
      if (format === "csv") Object.assign(args, { tabel: table, stil: "ro" });
      const res = await api.moduleCall<{ taskuri: number }>(ID, "export_report", args);
      setNotice(`Salvat: ${dest} (${res.taskuri} taskuri). Fișierul a fost redeschis și verificat celulă cu celulă.`);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  };

  if (!r) return <p className="muted">Se calculează raportul…</p>;
  return (
    <div className="reports">
      <div className="row wrap">
        <button className="primary" onClick={() => void exportAs("xlsx")}>
          Exportă XLSX…
        </button>
        <span className="muted">sau CSV cu tabelul</span>
        <select aria-label="Tabel CSV" value={table} onChange={(e) => setTable(e.target.value as typeof table)}>
          <option value="taskuri">Taskuri</option>
          <option value="persoane">Pe persoane</option>
          <option value="proiecte">Pe proiecte</option>
        </select>
        <button onClick={() => void exportAs("csv")}>Exportă CSV…</button>
      </div>
      {notice && <p className="muted" role="status">{notice}</p>}
      <h2>Pe persoane</h2>
      <Table first="Persoană" rows={r.pe_persoana} total={r.total} />
      <h2>Pe proiecte</h2>
      <Table first="Proiect" rows={r.pe_proiect} total={r.total} />
      <p className="muted small">
        Raportul ține cont de filtrele de deasupra. XLSX conține trei foi: pe persoane, pe proiecte și lista taskurilor. CSV-ul
        e în stil românesc (punct și virgulă, virgulă zecimală).
      </p>
    </div>
  );
}
