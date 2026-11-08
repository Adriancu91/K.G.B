// Due dates and partner statements (Etapa 5, step 5.6).
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.business";

interface Bucket {
  interval: string;
  suma_text: string;
}
interface Summary {
  tip: "de_incasat" | "de_platit";
  intervale: Bucket[];
  total_text: string;
}
interface Row {
  tip: "de_incasat" | "de_platit";
  id: string;
  eticheta: string;
  scadenta: string;
  zile_intarziere: number;
  interval: string;
  rest_text: string;
}
interface Partner {
  id: string;
  nume: string;
}
interface SheetRow {
  data: string;
  document: string;
  de_incasat: number;
  de_platit: number;
  sold_incasat_text: string;
  sold_platit_text: string;
}
interface Sheet {
  partener: string;
  randuri: SheetRow[];
  de_incasat_text: string;
  de_platit_text: string;
}

const ro = (iso: string) => iso.split("-").reverse().join(".");
const lei = (bani: number) =>
  bani === 0
    ? ""
    : `${bani < 0 ? "-" : ""}${Math.floor(Math.abs(bani) / 100)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(Math.abs(bani) % 100).padStart(2, "0")}`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function AgingView({ onError }: { onError: (e: string | null) => void }) {
  const [summary, setSummary] = useState<Summary[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partner, setPartner] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([api.moduleCall<{ rezumat: Summary[]; randuri: Row[] }>(ID, "aging", { azi: today() }), api.moduleCall<Partner[]>(ID, "partners")]);
      setSummary(a.rezumat);
      setRows(a.randuri);
      setPartners(p);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!partner) {
      setSheet(null);
      return;
    }
    api
      .moduleCall<Sheet>(ID, "partner_sheet", { id: partner })
      .then(setSheet)
      .catch((e: unknown) => onError(message(e)));
  }, [partner, onError]);

  const intervals = summary[0]?.intervale.map((b) => b.interval) ?? [];
  return (
    <div className="aging">
      <h3>Scadențar (la data de azi)</h3>
      <div className="table-scroll">
        <table className="audit aging-summary">
          <thead>
            <tr>
              <th />
              {intervals.map((i) => (
                <th key={i}>{i}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.tip}>
                <th>{s.tip === "de_incasat" ? "De încasat" : "De plătit"}</th>
                {s.intervale.map((b) => (
                  <td key={b.interval} className="num">
                    {b.suma_text}
                  </td>
                ))}
                <td className="num">
                  <strong>{s.total_text}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="audit aging-rows">
        <thead>
          <tr>
            <th>Document</th>
            <th>Scadența</th>
            <th>Zile de întârziere</th>
            <th>Rest (lei)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Nimic de încasat sau de plătit.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className={r.zile_intarziere > 0 ? "low" : ""}>
              <td>
                {r.tip === "de_incasat" ? "↘ " : "↗ "}
                {r.eticheta}
              </td>
              <td>{ro(r.scadenta)}</td>
              <td className="num">{r.zile_intarziere > 0 ? r.zile_intarziere : ""}</td>
              <td className="num">{r.rest_text}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Fișa partenerului</h3>
      <select aria-label="Partenerul pentru fișă" value={partner} onChange={(e) => setPartner(e.target.value)}>
        <option value="">— alege un partener —</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nume}
          </option>
        ))}
      </select>
      {sheet && (
        <>
          <table className="audit partner-sheet">
            <thead>
              <tr>
                <th>Data</th>
                <th>Document</th>
                <th>De încasat</th>
                <th>De plătit</th>
                <th>Sold de încasat</th>
                <th>Sold de plătit</th>
              </tr>
            </thead>
            <tbody>
              {sheet.randuri.map((r, i) => (
                <tr key={i}>
                  <td>{ro(r.data)}</td>
                  <td>{r.document}</td>
                  <td className="num">{lei(r.de_incasat)}</td>
                  <td className="num">{lei(r.de_platit)}</td>
                  <td className="num">{r.sold_incasat_text}</td>
                  <td className="num">{r.sold_platit_text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <strong>{sheet.partener}</strong>: de încasat <strong>{sheet.de_incasat_text} lei</strong>, de plătit <strong>{sheet.de_platit_text} lei</strong>.
          </p>
        </>
      )}
    </div>
  );
}
