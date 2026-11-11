// Contracte și abonamente (Etapa 7, step 7.9e): the contracts with clients and suppliers, their lines billed every
// month / quarter / half-year / year, what is due to be invoiced, and a calendar of expiries, notice deadlines
// and automatic renewals. Modules do not call each other: this page asks Business to issue the invoice, then
// marks the period here. If the invoice is issued but the mark fails, the page says so, so it is not lost.
// A read-only role sees everything and changes nothing (the core refuses anyway; the buttons say so first).
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, message } from "../../api";
import { cuiKey, findBusinessPartner } from "./cui";

const ID = "kgb.contracts";
const BIZ = "kgb.business";
const STATES: Array<[string, string]> = [
  ["ciorna", "ciornă"],
  ["activ", "activ"],
  ["suspendat", "suspendat"],
  ["incheiat", "încheiat"],
  ["reziliat", "reziliat"],
];
const PERIODS: Array<[string, string]> = [
  ["lunar", "lunar"],
  ["trimestrial", "trimestrial"],
  ["semestrial", "semestrial"],
  ["anual", "anual"],
];

interface Contract {
  id: string;
  version: number;
  numar: string;
  titlu: string;
  parte: string;
  partener: string;
  partener_nume: string;
  inceput: string;
  sfarsit: string;
  prelungire_auto: boolean;
  prelungire_luni: number;
  preaviz_zile: number;
  stare: string;
  nota: string;
  sfarsit_efectiv: string;
  prelungit: boolean;
  zile_ramase: number | null;
  preaviz_pana: string;
  abonamente: number;
}
interface Line {
  id: string;
  version: number;
  denumire: string;
  um: string;
  cantitate: number;
  pret: number;
  tva: number;
  perioada: string;
  zi_facturare: number;
  de_la: string;
  pana_la: string;
  indexare: number;
  activ: boolean;
}
interface Billing {
  id: string;
  version: number;
  abonament: string;
  perioada: string;
  suma: number;
  stare: string;
  factura: string;
  data: string;
  dubla: boolean;
}
interface Detail extends Contract {
  partener_cui: string;
  linii: Line[];
  facturari: Billing[];
}
interface DueRow {
  contract: string;
  numar: string;
  titlu: string;
  parte: string;
  partener: string;
  partener_nume: string;
  abonament: string;
  denumire: string;
  um: string;
  cantitate: number;
  tva: number;
  perioada: string;
  de_la: string;
  pana_la: string;
  data_facturare: string;
  pret_unitar: number;
  suma: number;
  indexat: boolean;
  intarziata: boolean;
}
interface CalEvent {
  contract: string;
  numar: string;
  titlu: string;
  partener_nume: string;
  fel: string;
  data: string;
}
interface Card {
  id: string;
  denumire: string;
  cui: string;
}
interface BizPartner {
  id: string;
  nume: string;
  cui: string | null;
}

const z = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const ro = (d: string) => (d ? d.split("-").reverse().join(".") : "");
const monthEnd = () => {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
const plusMonths = (n: number) => {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth() + n, d.getDate()));
};
/** Bani → „1.234,50”. */
const lei = (b: number) => {
  const [i, f] = (Math.abs(b) / 100).toFixed(2).split(".");
  return `${b < 0 ? "-" : ""}${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${f}`;
};
/** Thousandths → „1,5” (comma decimals, as Business reads them). */
const qty = (q: number) => String(q / 1000).replace(".", ",");
/** „1.234,50” or „1234.5” → bani; NaN when it is not a number. */
const toBani = (t: string) => {
  const s = t.trim().replace(/\s/g, "");
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const stateText = (s: string) => STATES.find(([k]) => k === s)?.[1] ?? s;
const periodText = (p: string) => PERIODS.find(([k]) => k === p)?.[1] ?? p;

function endText(c: Contract): string {
  if (!c.sfarsit) return "durată nedeterminată";
  if (c.prelungire_auto && c.stare === "activ") {
    const base = c.prelungit ? `prelungit automat până la ${ro(c.sfarsit_efectiv)}` : `până la ${ro(c.sfarsit_efectiv)}, se prelungește automat`;
    return c.preaviz_pana ? `${base} · preaviz până la ${ro(c.preaviz_pana)}` : base;
  }
  if (c.stare === "activ" && c.zile_ramase !== null) {
    if (c.zile_ramase < 0) return `expirat pe ${ro(c.sfarsit_efectiv)}`;
    if (c.zile_ramase <= 60) return `expiră în ${c.zile_ramase} zile (${ro(c.sfarsit_efectiv)})`;
  }
  return `până la ${ro(c.sfarsit_efectiv)}`;
}

const blankContract = { numar: "", titlu: "", parte: "client", partener: "", partener_nume: "", inceput: iso(new Date()), sfarsit: "", prelungire_auto: false, prelungire_luni: "12", preaviz_zile: "30", nota: "" };
const blankLine = { denumire: "", um: "lună", cantitate: "1", pret: "", tva: "21", perioada: "lunar", zi_facturare: "1", de_la: "", pana_la: "", indexare: "" };

export function ContractsPage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const today = iso(new Date());
  const [tab, setTab] = useState<"contracte" | "facturat" | "calendar">("contracte");
  const [list, setList] = useState<Contract[]>([]);
  const [text, setText] = useState("");
  const [side, setSide] = useState("");
  const [open, setOpen] = useState<Detail | null>(null);
  const [form, setForm] = useState(blankContract);
  const [cards, setCards] = useState<Card[]>([]);
  const [line, setLine] = useState(blankLine);
  const [until, setUntil] = useState(monthEnd());
  const [due, setDue] = useState<DueRow[]>([]);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [calTo, setCalTo] = useState(plusMonths(12));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [biz, setBiz] = useState<{ on: boolean; write: boolean }>({ on: false, write: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await api.moduleCall<Contract[]>(ID, "contracte", { azi: today, text, parte: side }));
      if (tab === "facturat") setDue(await api.moduleCall<DueRow[]>(ID, "de_facturat", { pana_la: until, azi: today }));
      if (tab === "calendar") setEvents(await api.moduleCall<CalEvent[]>(ID, "calendar", { de_la: today, pana_la: calTo }));
      const m = await api.listModules();
      setBiz({ on: m.modules.some((x) => x.id === BIZ && x.enabled), write: m.access[BIZ] === "scriere" });
    } catch (e) {
      onError(message(e));
    }
  }, [today, text, side, tab, until, calTo, onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const openContract = async (id: string) => {
    try {
      setOpen(await api.moduleCall<Detail>(ID, "contract", { id, azi: today }));
      setLine({ ...blankLine, de_la: "" });
    } catch (e) {
      onError(message(e));
    }
  };
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
    if (open) await openContract(open.id);
  };
  const lineName = (id: string) => open?.linii.find((l) => l.id === id)?.denumire ?? "?";

  // The partner from the directory: suggestions while typing the name.
  useEffect(() => {
    const q = form.partener ? "" : form.partener_nume.trim();
    if (q.length < 2) {
      setCards([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .moduleCall<Card[]>(ID, "parteneri", { text: q })
        .then(setCards)
        .catch(() => setCards([]));
    }, 200);
    return () => clearTimeout(t);
  }, [form.partener_nume, form.partener]);

  // The lines due grouped per contract and invoice date: one invoice for each group.
  const groups = useMemo(() => {
    const g = new Map<string, DueRow[]>();
    for (const r of due) {
      const k = `${r.contract}|${r.data_facturare}`;
      g.set(k, [...(g.get(k) ?? []), r]);
    }
    return [...g.entries()];
  }, [due]);

  const mark = (r: DueRow, stare: "emisa" | "sarita", factura: string) =>
    api.moduleCall(ID, "facturare_marcheaza", { abonament: r.abonament, perioada: r.perioada, stare, factura, data: today });

  /** Business issues one invoice for the group, then each line's period is marked here. */
  const issue = (rows: DueRow[]) =>
    run(async () => {
      const first = rows[0]!;
      const [detail, partners, series, settings] = await Promise.all([
        api.moduleCall<Detail>(ID, "contract", { id: first.contract, azi: today }),
        api.moduleCall<BizPartner[]>(BIZ, "partners"),
        api.moduleCall<Array<{ id: string; cod: string }>>(BIZ, "series"),
        api.moduleCall<{ cote_tva: number[]; confirmate: boolean }>(BIZ, "settings"),
      ]);
      if (!settings.confirmate || series.length === 0) throw new Error("În Business lipsesc datele firmei sau seria facturilor (fila „Setări facturare”).");
      const cui = cuiKey(detail.partener_cui);
      const partner = findBusinessPartner(partners, detail.partener_cui, first.partener_nume);
      if (!partner) throw new Error(cui ? `Adaugă partenerul în Business (${first.partener_nume}, CUI ${cui}), apoi emite factura.` : `Adaugă partenerul în Business (${first.partener_nume}), apoi emite factura.`);
      const wrong = rows.find((r) => !settings.cote_tva.includes(r.tva));
      if (wrong) throw new Error(`Cota de TVA ${wrong.tva}% a liniei „${wrong.denumire}” nu e în lista din Business.`);
      const r = await api.moduleCall<{ numar: string; total_text: string }>(BIZ, "invoice_issue", {
        serie: series[0]!.id,
        partener: partner.id,
        data: today,
        nota: `Contract ${first.numar || first.titlu}`,
        linii: rows.map((x) => ({
          descriere: `${x.denumire}, ${ro(x.de_la)}–${ro(x.pana_la)}`,
          um: x.um,
          cantitate: qty(x.cantitate),
          pret_unitar: lei(x.pret_unitar).replace(/\./g, ""),
          cota_tva: x.tva,
        })),
      });
      const failed: string[] = [];
      for (const x of rows) {
        try {
          await mark(x, "emisa", r.numar);
        } catch {
          failed.push(`${x.denumire} (${x.perioada})`);
        }
      }
      if (failed.length) throw new Error(`Factura ${r.numar} e emisă, dar nu s-a putut marca aici: ${failed.join(", ")}. Marchează manual cu numărul ${r.numar}.`);
      setNotice(`Factura ${r.numar} a fost emisă: ${r.total_text} lei.`);
    });

  const canIssue = biz.on && biz.write && !readOnly;

  return (
    <section className="contracts">
      {readOnly && <p className="warn">Rolul tău poate doar citi contractele: nu le poate schimba.</p>}
      <div className="sheet-tabs" role="tablist" aria-label="Vederea">
        {(
          [
            ["contracte", "Contracte"],
            ["facturat", "De facturat"],
            ["calendar", "Calendar"],
          ] as const
        ).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {v}
          </button>
        ))}
      </div>

      {tab === "contracte" && (
        <>
          <div className="row wrap">
            <input aria-label="Caută contracte" placeholder="Caută după titlu, număr, partener" value={text} onChange={(e) => setText(e.target.value)} />
            <select aria-label="Partea" value={side} onChange={(e) => setSide(e.target.value)}>
              <option value="">clienți și furnizori</option>
              <option value="client">doar cu clienți</option>
              <option value="furnizor">doar cu furnizori</option>
            </select>
          </div>
          <table className="audit">
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td className="muted">Niciun contract încă. Adaugă unul mai jos.</td>
                </tr>
              )}
              {list.map((c) => (
                <tr key={c.id} data-testid="contract" className={open?.id === c.id ? "selected" : ""}>
                  <td>
                    <button className="link" onClick={() => void openContract(c.id)}>
                      {c.titlu}
                    </button>
                    {c.numar && <span className="muted small"> · nr. {c.numar}</span>}
                  </td>
                  <td>{c.partener_nume}</td>
                  <td className="small">{c.parte === "client" ? "client" : "furnizor"}</td>
                  <td className="small">{stateText(c.stare)}</td>
                  <td className={`small${c.stare === "activ" && c.zile_ramase !== null && c.zile_ramase <= 30 && !c.prelungire_auto ? " contract-soon" : ""}`}>{endText(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {open && (
            <div className="contract-card" data-testid="contract-card">
              <h3>
                {open.titlu} {open.numar && <span className="muted small">nr. {open.numar}</span>}
              </h3>
              <p className="small">
                <span>{open.parte === "client" ? "Client:" : "Furnizor:"}</span> <strong>{open.partener_nume}</strong>
                {open.partener_cui && <span>{` (CUI ${open.partener_cui})`}</span>}
                {" "}<span>{`· contract din ${ro(open.inceput)}`}</span> <span>{`· ${endText(open)}`}</span> <span>{`· ${stateText(open.stare)}`}</span>
              </p>
              {open.nota && <p className="muted small">{open.nota}</p>}
              <div className="row wrap">
                {STATES.filter(([k]) => k !== open.stare && k !== "ciorna").map(([k, label]) => (
                  <button key={k} className="small" disabled={busy || readOnly} onClick={() => void run(() => api.moduleCall(ID, "contract_stare", { id: open.id, version: open.version, stare: k }))}>
                    {k === "activ" ? "Activează" : `Marchează ${label}`}
                  </button>
                ))}
                {open.stare === "ciorna" && (
                  <button
                    className="small"
                    disabled={busy || readOnly}
                    onClick={() =>
                      void run(async () => {
                        await api.moduleCall(ID, "contract_delete", { id: open.id, version: open.version });
                        setOpen(null);
                      })
                    }
                  >
                    Șterge ciorna
                  </button>
                )}
              </div>

              <h4>Ce se facturează</h4>
              <ul className="plain">
                {open.linii.length === 0 && <li className="muted small">Nicio linie. Adaugă abonamentul mai jos.</li>}
                {open.linii.map((l) => (
                  <li key={l.id} data-testid="contract-line">
                    <strong>{l.denumire}</strong>{" "}
                    <span className="small">
                      {`${qty(l.cantitate)} ${l.um} × ${lei(l.pret)} lei + TVA ${l.tva}% · ${periodText(l.perioada)}, în ziua ${l.zi_facturare}`}
                      {" "}<span>{`· facturat din ${ro(l.de_la)}`}</span>
                      {l.pana_la && <span>{` până la ${ro(l.pana_la)}`}</span>}
                      {l.indexare > 0 && <span>{` · indexare ${String(l.indexare / 100).replace(".", ",")}% pe an`}</span>}
                      {!l.activ && <span> · oprită</span>}
                    </span>{" "}
                    {l.activ && (
                      <button
                        className="link small"
                        disabled={busy || readOnly}
                        onClick={() =>
                          void run(() =>
                            api.moduleCall(ID, "abonament_save", {
                              id: l.id,
                              version: l.version,
                              contract: open.id,
                              denumire: l.denumire,
                              um: l.um,
                              cantitate: l.cantitate,
                              pret: l.pret,
                              tva: l.tva,
                              perioada: l.perioada,
                              zi_facturare: l.zi_facturare,
                              de_la: l.de_la,
                              pana_la: l.pana_la,
                              indexare: l.indexare,
                              activ: false,
                            }),
                          )
                        }
                      >
                        oprește
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <form
                className="row wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const pret = toBani(line.pret);
                    const cant = Math.round(Number(line.cantitate.replace(",", ".")) * 1000);
                    if (!Number.isFinite(pret) || pret < 0) throw new Error(`„${line.pret}” nu e un preț.`);
                    if (!Number.isFinite(cant) || cant <= 0) throw new Error(`„${line.cantitate}” nu e o cantitate.`);
                    await api.moduleCall(ID, "abonament_save", {
                      contract: open.id,
                      denumire: line.denumire,
                      um: line.um,
                      cantitate: cant,
                      pret,
                      tva: Number(line.tva),
                      perioada: line.perioada,
                      zi_facturare: Number(line.zi_facturare) || 1,
                      de_la: line.de_la || open.inceput,
                      pana_la: line.pana_la,
                      indexare: line.indexare ? Math.round(Number(line.indexare.replace(",", ".")) * 100) : 0,
                    });
                    setLine(blankLine);
                  });
                }}
              >
                <input aria-label="Denumirea liniei" placeholder="Ce se facturează (Abonament mentenanță)" value={line.denumire} onChange={(e) => setLine({ ...line, denumire: e.target.value })} required />
                <input aria-label="Cantitatea" value={line.cantitate} onChange={(e) => setLine({ ...line, cantitate: e.target.value })} size={4} />
                <input aria-label="Unitatea de măsură" value={line.um} onChange={(e) => setLine({ ...line, um: e.target.value })} size={6} />
                <input aria-label="Prețul fără TVA" placeholder="Preț fără TVA (lei)" value={line.pret} onChange={(e) => setLine({ ...line, pret: e.target.value })} size={10} required />
                <select aria-label="Cota de TVA" value={line.tva} onChange={(e) => setLine({ ...line, tva: e.target.value })}>
                  {["21", "11", "0"].map((v) => (
                    <option key={v} value={v}>{`TVA ${v}%`}</option>
                  ))}
                </select>
                <select aria-label="Perioada" value={line.perioada} onChange={(e) => setLine({ ...line, perioada: e.target.value })}>
                  {PERIODS.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input aria-label="Ziua facturării" type="number" min={1} max={28} title="Ziua din lună în care se emite factura (1–28)" value={line.zi_facturare} onChange={(e) => setLine({ ...line, zi_facturare: e.target.value })} />
                <input aria-label="Facturat de la" type="date" value={line.de_la || open.inceput} onChange={(e) => setLine({ ...line, de_la: e.target.value })} />
                <input aria-label="Facturat până la" type="date" value={line.pana_la} onChange={(e) => setLine({ ...line, pana_la: e.target.value })} />
                <input aria-label="Indexarea pe an (%)" placeholder="indexare % pe an" value={line.indexare} onChange={(e) => setLine({ ...line, indexare: e.target.value })} size={8} />
                <button disabled={busy || readOnly}>Adaugă linia</button>
              </form>

              <h4>Facturări</h4>
              <table className="audit">
                <tbody>
                  {open.facturari.length === 0 && (
                    <tr>
                      <td className="muted small">Nimic facturat încă.</td>
                    </tr>
                  )}
                  {open.facturari.map((f) => (
                    <tr key={f.id} className={f.dubla ? "appt-overlap" : ""} data-testid="billing">
                      <td>{f.perioada}</td>
                      <td>{lineName(f.abonament)}</td>
                      <td>{f.stare === "emisa" ? `factura ${f.factura} · ${lei(f.suma)} lei` : "sărită"}</td>
                      <td className="small">
                        {ro(f.data)}
                        {f.dubla && <strong className="appt-overlap-text"> · facturată de două ori</strong>}
                      </td>
                      <td>
                        <button className="link small" disabled={busy || readOnly} title="Șterge doar marcajul de aici; factura din Business rămâne" onClick={() => void run(() => api.moduleCall(ID, "facturare_sterge", { id: f.id, version: f.version }))}>
                          șterge marcajul
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3>Contract nou</h3>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api.moduleCall<{ id: string }>(ID, "contract_save", {
                  numar: form.numar,
                  titlu: form.titlu,
                  parte: form.parte,
                  ...(form.partener ? { partener: form.partener } : {}),
                  partener_nume: form.partener_nume,
                  inceput: form.inceput,
                  sfarsit: form.sfarsit,
                  prelungire_auto: form.prelungire_auto,
                  prelungire_luni: Number(form.prelungire_luni) || 12,
                  preaviz_zile: Number(form.preaviz_zile) || 0,
                  nota: form.nota,
                });
                setForm(blankContract);
                setNotice("Contractul e salvat ca ciornă. Adaugă ce se facturează, apoi apasă „Activează”.");
                await openContract(r.id);
              });
            }}
          >
            <input aria-label="Titlul contractului" placeholder="Titlu (Mentenanță lunară, Chirie depozit)" value={form.titlu} onChange={(e) => setForm({ ...form, titlu: e.target.value })} required />
            <input aria-label="Numărul contractului" placeholder="Nr." value={form.numar} onChange={(e) => setForm({ ...form, numar: e.target.value })} size={8} />
            <select aria-label="Partea" value={form.parte} onChange={(e) => setForm({ ...form, parte: e.target.value })}>
              <option value="client">cu un client</option>
              <option value="furnizor">cu un furnizor</option>
            </select>
            <span className="contract-partner">
              <input
                aria-label="Partenerul"
                placeholder="Partenerul (din agendă sau scris)"
                value={form.partener_nume}
                onChange={(e) => setForm({ ...form, partener_nume: e.target.value, partener: "" })}
                required
              />
              {form.partener && <span className="small muted"> din agendă</span>}
              {cards.length > 0 && (
                <span className="contract-suggest" role="listbox" aria-label="Parteneri din agendă">
                  {cards.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="small"
                      onClick={() => {
                        setForm({ ...form, partener: c.id, partener_nume: c.denumire });
                        setCards([]);
                      }}
                    >
                      {c.cui ? `${c.denumire} · ${c.cui}` : c.denumire}
                    </button>
                  ))}
                </span>
              )}
            </span>
            <label className="small">
              de la <input aria-label="Începutul contractului" type="date" value={form.inceput} onChange={(e) => setForm({ ...form, inceput: e.target.value })} required />
            </label>
            <label className="small">
              până la <input aria-label="Sfârșitul contractului" type="date" value={form.sfarsit} onChange={(e) => setForm({ ...form, sfarsit: e.target.value })} />
            </label>
            <label className="small">
              <input type="checkbox" checked={form.prelungire_auto} onChange={(e) => setForm({ ...form, prelungire_auto: e.target.checked })} /> se prelungește automat
            </label>
            {form.prelungire_auto && (
              <>
                <label className="small">
                  cu <input aria-label="Prelungirea în luni" type="number" min={1} max={120} value={form.prelungire_luni} onChange={(e) => setForm({ ...form, prelungire_luni: e.target.value })} /> luni
                </label>
                <label className="small">
                  preaviz <input aria-label="Preavizul în zile" type="number" min={0} max={365} value={form.preaviz_zile} onChange={(e) => setForm({ ...form, preaviz_zile: e.target.value })} /> zile
                </label>
              </>
            )}
            <input aria-label="Nota contractului" placeholder="Notă" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
            <button className="primary" disabled={busy || readOnly}>
              Salvează contractul
            </button>
          </form>
        </>
      )}

      {tab === "facturat" && (
        <>
          <div className="row wrap">
            <label className="small">
              cu data facturii până la <input aria-label="Până la" type="date" value={until} onChange={(e) => e.target.value && setUntil(e.target.value)} />
            </label>
            {!canIssue && !readOnly && <span className="muted small">{biz.on ? "Rolul tău nu poate emite facturi în Business: marchează-le manual." : "Business nu e activat: facturile se marchează manual, cu numărul lor."}</span>}
          </div>
          {groups.length === 0 && <p className="muted">Nimic de facturat până la {ro(until)}.</p>}
          {groups.map(([k, rows]) => {
            const f = rows[0]!;
            const total = rows.reduce((a, r) => a + r.suma, 0);
            return (
              <div key={k} className={`contract-due${f.intarziata ? " contract-late" : ""}`} data-testid="due">
                <div>
                  <strong>{f.partener_nume}</strong> <span className="small">{`· ${f.titlu}`}</span>
                  {f.numar && <span className="small">{` (nr. ${f.numar})`}</span>}
                  <span className="small">{` · factura pe ${ro(f.data_facturare)}`}</span>
                  {f.intarziata && <strong className="small"> · întârziată</strong>}
                  {f.parte === "furnizor" && <span className="muted small"> · de primit de la furnizor</span>}
                </div>
                <ul className="plain small">
                  {rows.map((r) => (
                    <li key={r.abonament + r.perioada}>
                      {`${r.denumire}, ${ro(r.de_la)}–${ro(r.pana_la)}: ${qty(r.cantitate)} ${r.um} × ${lei(r.pret_unitar)} = ${lei(r.suma)} lei + TVA ${r.tva}%`}
                      {r.indexat && <span className="muted"> (indexat)</span>}{" "}
                      <button className="link small" disabled={busy || readOnly} onClick={() => void run(() => mark(r, "sarita", ""))}>
                        sari peste
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="row wrap">
                  <span className="small">{`Total fără TVA: ${lei(total)} lei`}</span>
                  {f.parte === "client" && canIssue && (
                    <button className="primary small" disabled={busy} onClick={() => void issue(rows)}>
                      Emite factura
                    </button>
                  )}
                  <input aria-label="Seria și numărul facturii" placeholder="seria și nr. facturii" value={numbers[k] ?? ""} onChange={(e) => setNumbers({ ...numbers, [k]: e.target.value })} size={14} />
                  <button
                    className="small"
                    disabled={busy || readOnly || !(numbers[k] ?? "").trim()}
                    onClick={() =>
                      void run(async () => {
                        for (const r of rows) await mark(r, "emisa", numbers[k]!.trim());
                        setNumbers({ ...numbers, [k]: "" });
                      })
                    }
                  >
                    {f.parte === "client" ? "Marchează emisă" : "Marchează primită"}
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === "calendar" && (
        <>
          <label className="small">
            {`de azi (${ro(today)}) până la `}
            <input aria-label="Calendarul până la" type="date" value={calTo} onChange={(e) => e.target.value && setCalTo(e.target.value)} />
          </label>
          <table className="audit">
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td className="muted">Nicio expirare, niciun preaviz și nicio prelungire în acest interval.</td>
                </tr>
              )}
              {events.map((e, n) => (
                <tr key={n} data-testid="cal-event" className={e.fel === "preaviz" ? "contract-soon" : ""}>
                  <td>{ro(e.data)}</td>
                  <td>{e.fel === "preaviz" ? "ultima zi de preaviz" : e.fel === "prelungire" ? "se prelungește automat" : "expiră"}</td>
                  <td>
                    <button
                      className="link"
                      onClick={() => {
                        setTab("contracte");
                        void openContract(e.contract);
                      }}
                    >
                      {e.titlu}
                    </button>
                  </td>
                  <td>{e.partener_nume}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
