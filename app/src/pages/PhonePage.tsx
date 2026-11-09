// The phone page, seen from the PC (Etapa 7, step 7.4m; D-068): start or
// stop it, the address and pairing code for phones, the phones (approve,
// remove) and what they sent (photos, reception sheets, bank statements).
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, message, type ModulesReply } from "../api";
import { drawPage, openPdf } from "../modules/pdf/pdfjs";

/** A PDF received from a phone (e.g. a bank statement), shown page by page (7.4m-3). */
function PdfInline({ data }: { data: Uint8Array }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void (async () => {
      try {
        const doc = await openPdf(data.slice());
        const n = Math.min(doc.numPages, 10);
        for (let i = 1; i <= n && !gone; i++) {
          const c = document.createElement("canvas");
          c.setAttribute("aria-label", `Pagina ${i}`);
          box.current?.appendChild(c);
          await drawPage(doc, i, c, 760);
        }
        if (doc.numPages > n && box.current) box.current.append(`… încă ${doc.numPages - n} pagini`);
      } catch (e) {
        setErr(message(e));
      }
    })();
    return () => {
      gone = true;
    };
  }, [data]);
  return err ? <p className="error">PDF-ul nu se poate afișa: {err}</p> : <div className="phone-pdf" ref={box} />;
}

interface Phone {
  id: string;
  nume: string;
  stare: "asteapta" | "aprobat" | "revocat";
  membru_nume: string;
  vazut_ms: number;
}
interface Received {
  id: string;
  tip: "receptie" | "document" | "extras" | "inventar" | "bon" | "pontaj" | "livrare" | "task" | "pontaj_echipa";
  telefon_nume: string;
  membru_nume: string;
  campuri: Record<string, string>;
  fisiere: { id: string; nume: string; mime: string; octeti: number }[];
  procesat: boolean;
  creat_ms: number;
  linii?: Line[];
}
interface Host {
  dispozitiv: string;
  nume: string;
  adrese: string[];
  pornit: boolean;
  ts_ms: number;
}
interface Reply {
  pornit: boolean;
  pornit_org: boolean;
  adresa: string | null;
  comun: string;
  pc_uri: Host[];
  problema: string | null;
  cod: [string, number] | null;
  telefoane: Phone[];
  primite: Received[];
  admin: boolean;
  persoane: string[];
}
interface Account {
  id: string;
  nume: string;
  tip: string;
}

const KIND: Record<Received["tip"], string> = {
  receptie: "Fișă de recepție",
  document: "Documente de la șofer",
  extras: "Extras de cont",
  inventar: "Inventar numărat",
  bon: "Bon de cheltuială",
  pontaj: "Pontaj",
  livrare: "Etapă de livrare",
  task: "Task terminat",
  pontaj_echipa: "Raport de prezență",
};

interface CrewLine {
  angajat: string;
  nume: string;
  prezent: boolean;
  extra: number;
}

/** The team leader's daily report, with colours, recorded in the timesheet (7.4m-7). */
function CrewReport({ x, onDone, onError }: { x: Received; onDone: (msg: string) => void; onError: (e: string | null) => void }) {
  const lines = (x.linii ?? []) as unknown as CrewLine[];
  const state = (l: CrewLine) => (!l.prezent ? "absent" : l.extra > 0 ? "extra" : l.extra < 0 ? "less" : "present");
  const label = (l: CrewLine) => (!l.prezent ? "absent" : `prezent ${l.extra >= 0 ? "+" : "−"}${Math.abs(l.extra)} ore extra`);
  const present = lines.filter((l) => l.prezent).length;
  return (
    <div className="crew-report">
      <p>
        {x.campuri.punct_nume} · {(x.campuri.data ?? "").split("-").reverse().join(".")} · {present === 1 ? "1 prezent" : `${present} prezenți`}, {lines.length - present === 1 ? "1 absent" : `${lines.length - present} absenți`}
      </p>
      <ul className="plain">
        {lines.map((l) => (
          <li key={l.angajat} className={`crew-line ${state(l)}`} data-worker={l.nume}>
            <strong>{l.nume}</strong> {label(l)}
          </li>
        ))}
      </ul>
      {!x.procesat && (
        <button
          onClick={() =>
            void (async () => {
              try {
                const r = await api.moduleCall<{ pontati: number; absenti: number; deja_pontati: string[] }>("kgb.team", "raport_zi", {
                  punct: x.campuri.punct,
                  data: x.campuri.data,
                  de_la: x.membru_nume,
                  linii: lines.map((l) => ({ angajat: l.angajat, nume: l.nume, prezent: l.prezent, extra: l.extra })),
                });
                await invoke("phone_done", { id: x.id, gata: true });
                onDone(
                  `Raportul a fost trecut în pontaj: ${r.pontati} zile pontate, ${r.absenti} absenți${r.deja_pontati.length ? `; deja pontați, lăsați neschimbați: ${r.deja_pontati.join(", ")}` : ""}.`,
                );
              } catch (e) {
                onError(message(e));
              }
            })()
          }
        >
          Trece în pontaj
        </button>
      )}
    </div>
  );
}

/** "I finished this task" from the phone, marked done in the planner (7.4m-6d). */
function TaskDone({ x, onDone, onError }: { x: Received; onDone: (msg: string) => void; onError: (e: string | null) => void }) {
  return (
    <div className="row wrap task-done">
      <span>
        „{x.campuri.titlu}” — terminat, spune {x.membru_nume}
      </span>
      <button
        onClick={() =>
          void (async () => {
            try {
              const all = await api.moduleCall<Array<{ id: string; version: number; stare: string }>>("kgb.planner", "tasks", {});
              const t = all.find((y) => y.id === x.campuri.task);
              if (!t) throw new Error("Taskul nu mai există în Planificator.");
              if (t.stare !== "gata") await api.moduleCall("kgb.planner", "task_status", { id: t.id, version: t.version, stare: "gata" });
              await invoke("phone_done", { id: x.id, gata: true });
              onDone(`„${x.campuri.titlu}” e marcat gata în Planificator.`);
            } catch (e) {
              onError(message(e));
            }
          })()
        }
      >
        Marchează gata în Planificator
      </button>
    </div>
  );
}

const STAGE: Record<string, string> = { in_drum: "în drum", livrat: "livrat" };

/** A driver's stage from the phone, applied to the delivery in Business (7.4m-6c). */
function StageToBusiness({ x, onDone, onError }: { x: Received; onDone: (msg: string) => void; onError: (e: string | null) => void }) {
  const c = x.campuri;
  const etapa = c.etapa ?? "";
  const fields: Record<string, string> = etapa === "in_drum" ? { aviz: c.aviz ?? "" } : { primit_de: c.primit_de ?? "" };
  return (
    <div className="row wrap stage-to-business">
      <span>
        {c.numar} → <strong>{STAGE[etapa] ?? etapa}</strong>
        {etapa === "in_drum" ? ` (aviz ${c.aviz})` : ` (primit de ${c.primit_de})`}
      </span>
      <button
        onClick={() =>
          void (async () => {
            try {
              await api.moduleCall("kgb.business", "delivery_step", { id: c.livrare, etapa, campuri: fields });
              await invoke("phone_done", { id: x.id, gata: true });
              onDone(`${c.numar} e acum „${STAGE[etapa] ?? etapa}” în Business; mesajul șoferului e marcat rezolvat.`);
            } catch (e) {
              onError(message(e));
            }
          })()
        }
      >
        Trece etapa în Business
      </button>
    </div>
  );
}

interface Employee {
  id: string;
  nume: string;
  activ: boolean;
}

/** One person's day from the phone: the first entry and the last exit. */
interface PhoneDay {
  key: string;
  persoana: string;
  data: string;
  intrare: string | null;
  iesire: string | null;
  ids: string[];
}

function phoneDays(items: Received[]): PhoneDay[] {
  const by = new Map<string, PhoneDay>();
  for (const x of items) {
    if (x.tip !== "pontaj" || x.procesat) continue;
    const data = x.campuri.data ?? "";
    const ora = x.campuri.ora ?? "";
    const key = `${x.membru_nume}|${data}`;
    const d = by.get(key) ?? { key, persoana: x.membru_nume, data, intrare: null, iesire: null, ids: [] };
    if (x.campuri.miscare === "intrare" && (!d.intrare || ora < d.intrare)) d.intrare = ora;
    if (x.campuri.miscare === "iesire" && (!d.iesire || ora > d.iesire)) d.iesire = ora;
    d.ids.push(x.id);
    by.set(key, d);
  }
  return [...by.values()].sort((a, b) => (a.data === b.data ? a.persoana.localeCompare(b.persoana) : b.data.localeCompare(a.data)));
}

/** Entries and exits from phones, recorded in the team timesheet (7.4m-6b). */
function PhoneTimesheet({ items, onDone, onError }: { items: Received[]; onDone: (msg: string) => void; onError: (e: string | null) => void }) {
  const days = phoneDays(items);
  const [emps, setEmps] = useState<Employee[] | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [pause, setPause] = useState<Record<string, string>>({});
  useEffect(() => {
    if (days.length === 0) return;
    api.moduleCall<Employee[]>("kgb.team", "angajati").then(
      (e) => setEmps(e.filter((x) => x.activ !== false)),
      () => setEmps([]),
    );
  }, [days.length]);
  if (days.length === 0) return null;
  const empOf = (d: PhoneDay) => pick[d.key] ?? emps?.find((e) => e.nume.trim().toLowerCase() === d.persoana.trim().toLowerCase())?.id ?? "";
  return (
    <div className="card phone-timesheet">
      <h3>Pontaj de pe telefon</h3>
      {emps !== null && emps.length === 0 && <p className="muted">Pentru a-l trece în pontaj, activează modulul Echipă și adaugă angajații.</p>}
      <table className="audit">
        <thead>
          <tr>
            <th>Persoana</th>
            <th>Data</th>
            <th>Intrare</th>
            <th>Ieșire</th>
            <th>Angajatul</th>
            <th>Pauză (min)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.key} data-day={d.key}>
              <td>{d.persoana}</td>
              <td>{d.data.split("-").reverse().join(".")}</td>
              <td>{d.intrare ?? "—"}</td>
              <td>{d.iesire ?? "încă nu"}</td>
              <td>
                <select aria-label={`Angajatul pentru ${d.persoana}`} value={empOf(d)} onChange={(e) => setPick({ ...pick, [d.key]: e.target.value })}>
                  <option value="">alege…</option>
                  {(emps ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nume}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input aria-label={`Pauza pentru ${d.persoana}`} size={4} value={pause[d.key] ?? "0"} onChange={(e) => setPause({ ...pause, [d.key]: e.target.value })} />
              </td>
              <td>
                <button
                  disabled={!d.intrare || !d.iesire || !empOf(d)}
                  onClick={() =>
                    void (async () => {
                      try {
                        await api.moduleCall("kgb.team", "pontaj_save", {
                          angajat: empOf(d),
                          data: d.data,
                          intrare: d.intrare,
                          iesire: d.iesire,
                          pauza_min: Number.parseInt(pause[d.key] ?? "0", 10) || 0,
                          nota: "declarat de pe telefon",
                        });
                        for (const id of d.ids) await invoke("phone_done", { id, gata: true });
                        onDone(`Pontajul lui ${d.persoana} din ${d.data.split("-").reverse().join(".")} (${d.intrare}–${d.iesire}) a fost trecut în Echipă.`);
                      } catch (e) {
                        onError(message(e));
                      }
                    })()
                  }
                >
                  Trece în pontaj
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Orele sunt cele declarate pe telefon (prima intrare și ultima ieșire din zi); nu se urmărește locația (D-064).</p>
    </div>
  );
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** An expense receipt from the phone, recorded as a payment in Business (7.4m-6). */
function ReceiptToBusiness({ x, accounts, onDone, onError }: { x: Received; accounts: Account[]; onDone: (msg: string) => void; onError: (e: string | null) => void }) {
  const [cont, setCont] = useState("");
  const [suma, setSuma] = useState(x.campuri.suma ?? "");
  const [data, setData] = useState(/^\d{4}-\d{2}-\d{2}$/.test(x.campuri.data ?? "") ? (x.campuri.data as string) : todayIso());
  const chosen = cont || accounts[0]?.id || "";
  const what = [x.campuri.furnizor, x.campuri.ce, x.campuri.plata].filter(Boolean).join(", ");
  return (
    <div className="row wrap receipt-to-business">
      <select aria-label="Contul plății" value={chosen} onChange={(e) => setCont(e.target.value)}>
        {accounts.length === 0 && <option value="">niciun cont în Business</option>}
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nume} ({a.tip === "casa" ? "casă" : "bancă"})
          </option>
        ))}
      </select>
      <input aria-label="Suma plății" size={10} value={suma} onChange={(e) => setSuma(e.target.value)} />
      <input aria-label="Data plății" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <button
        disabled={!chosen || !suma.trim()}
        onClick={() =>
          void (async () => {
            try {
              await api.moduleCall("kgb.business", "payment_save", {
                cont: chosen,
                data,
                sens: "plata",
                suma,
                explicatie: `Bon de pe telefon (${x.membru_nume})${what ? `: ${what}` : ""}`.slice(0, 200),
              });
              await invoke("phone_done", { id: x.id, gata: true });
              onDone(`Plata de ${suma} lei a fost înregistrată în Business; bonul e marcat rezolvat.`);
            } catch (e) {
              onError(message(e));
            }
          })()
        }
      >
        Înregistrează plata în Business
      </button>
    </div>
  );
}
const FIELD: Record<string, string> = { furnizor: "Furnizor", document: "Aviz / factură", vehicul: "Vehicul", observatii: "Observații", sofer: "Șofer", nota: "Notă", banca: "Banca" };
const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function FileView({ f }: { f: Received["fisiere"][number] }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const isPdf = f.mime === "application/pdf" || f.nume.toLowerCase().endsWith(".pdf");
  const load = () =>
    invoke<{ nume: string; data: string }>("phone_file", { id: f.id }).then((r) => {
      const bin = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
      if (isPdf) setPdf(bin);
      setUrl(URL.createObjectURL(new Blob([bin], { type: f.mime })));
    });
  if (url && f.mime.startsWith("image/")) return <img className="phone-photo" src={url} alt={f.nume} />;
  if (pdf) return <PdfInline data={pdf} />;
  if (url) return <a href={url} download={f.nume}>{f.nume}</a>;
  return (
    <button className="link" onClick={() => void load()}>
      {f.mime.startsWith("image/") ? "arată poza" : isPdf ? "arată PDF-ul" : "deschide"} {f.nume}
      {f.octeti ? ` (${Math.round(f.octeti / 1024)} KB)` : ""}
    </button>
  );
}

interface Line {
  categorie: string;
  produs: string | null;
  um: string;
  cantitate: number;
  cantitate_text: string;
  brut: string | null;
  tara: string | null;
  foto: string | null;
}
interface BizProduct {
  id: string;
  nume: string;
  um: string;
}
interface Warehouse {
  id: string;
  nume: string;
}

/** Thousandths → "125,5" (no grouping: what Business reads back exactly). */
const plain = (t: number) => {
  const w = Math.trunc(t / 1000);
  const f = String(t % 1000).padStart(3, "0").replace(/0+$/, "");
  return f ? `${w},${f}` : String(w);
};

/** The lines of a reception sheet, and turning it into a Business reception (7.4m-5). */
function ReceptionLines({ x, business, onDone, onError }: { x: Received; business: boolean; onDone: (msg: string) => void; onError: (e: string | null) => void }) {
  const lines = x.linii ?? [];
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<BizProduct[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [wh, setWh] = useState("");
  const [pick, setPick] = useState<string[]>(lines.map((l) => l.produs ?? ""));
  const [price, setPrice] = useState<string[]>(lines.map(() => ""));
  useEffect(() => {
    if (!open) return;
    void Promise.all([api.moduleCall<BizProduct[]>("kgb.business", "products"), api.moduleCall<Warehouse[]>("kgb.business", "warehouses")]).then(
      ([p, w]) => {
        setProducts(p);
        setWarehouses(w);
        setWh((cur) => cur || w[0]?.id || "");
      },
      (e: unknown) => onError(message(e)),
    );
  }, [open, onError]);
  if (lines.length === 0) return null;
  const inventory = x.tip === "inventar";
  const ready = wh && pick.every((p) => p) && (inventory || price.every((p) => p.trim()));
  return (
    <>
      <table className="audit reception-lines">
        <thead>
          <tr>
            <th>Categorie / produs</th>
            <th className="num">Cantitate</th>
            <th>Cântărire</th>
            <th>Poză</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, n) => (
            <tr key={n}>
              <td>{l.categorie}</td>
              <td className="num">
                {l.cantitate_text} {l.um}
              </td>
              <td className="small muted">{l.brut ? `brut ${l.brut} − tară ${l.tara}` : ""}</td>
              <td>{l.foto ? <FileView f={{ id: l.foto, nume: `linia ${n + 1}.jpg`, mime: "image/jpeg", octeti: 0 }} /> : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {business && !x.procesat && !open && (
        <button className="primary" onClick={() => setOpen(true)}>
          {inventory ? "Fă inventarul în Business…" : "Fă recepția în Business…"}
        </button>
      )}
      {open && (
        <div className="card reception-to-business">
          <label>
            Depozitul
            <select aria-label="Depozitul recepției" value={wh} onChange={(e) => setWh(e.target.value)}>
              {warehouses.length === 0 && <option value="">niciun depozit în Business</option>}
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nume}
                </option>
              ))}
            </select>
          </label>
          {lines.map((l, n) => (
            <div className="row wrap" key={n}>
              <span className="grow">
                {l.categorie}: {l.cantitate_text} {l.um}
              </span>
              <select aria-label={`Produsul liniei ${n + 1}`} value={pick[n]} onChange={(e) => setPick(pick.map((p, j) => (j === n ? e.target.value : p)))}>
                <option value="">alege produsul…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nume} ({p.um})
                  </option>
                ))}
              </select>
              {!inventory && (
                <input aria-label={`Prețul liniei ${n + 1}`} placeholder="Preț unitar (lei)" size={12} value={price[n]} onChange={(e) => setPrice(price.map((p, j) => (j === n ? e.target.value : p)))} />
              )}
            </div>
          ))}
          <div className="row">
            <button
              className="primary"
              disabled={!ready}
              onClick={() =>
                void (async () => {
                  try {
                    const iso = todayIso();
                    if (inventory) {
                      const res = await api.moduleCall<{ linii?: Array<{ nume: string; diferenta: string }> }>("kgb.business", "inventory", {
                        depozit: wh,
                        numar: `Inventar telefon ${new Date(x.creat_ms).toLocaleDateString("ro-RO")}`,
                        data: iso,
                        nota: `De pe telefon (${x.membru_nume})${x.campuri.observatii ? `: ${x.campuri.observatii}` : ""}`,
                        linii: lines.map((l, n) => ({ produs: pick[n], cantitate_numarata: plain(l.cantitate) })),
                      });
                      await invoke("phone_done", { id: x.id, gata: true });
                      setOpen(false);
                      const diffs = (res.linii ?? []).filter((d) => d.diferenta !== "0").map((d) => `${d.nume} ${d.diferenta.startsWith("-") ? "" : "+"}${d.diferenta}`);
                      onDone(`Inventarul a fost înregistrat în Business: ${diffs.length ? `diferențe ${diffs.join(", ")}` : "fără diferențe"}; fișa e marcată rezolvată.`);
                      return;
                    }
                    await api.moduleCall("kgb.business", "receive", {
                      depozit: wh,
                      numar: x.campuri.document || `Telefon ${new Date(x.creat_ms).toLocaleDateString("ro-RO")}`,
                      data: iso,
                      ...(x.campuri.furnizor ? { partener: x.campuri.furnizor } : {}),
                      nota: `De pe telefon (${x.membru_nume})${x.campuri.observatii ? `: ${x.campuri.observatii}` : ""}`,
                      linii: lines.map((l, n) => ({ produs: pick[n], cantitate: plain(l.cantitate), pret_unitar: price[n] })),
                    });
                    await invoke("phone_done", { id: x.id, gata: true });
                    setOpen(false);
                    onDone(`Recepția a fost înregistrată în Business (${lines.length} linii); fișa de pe telefon e marcată rezolvată.`);
                  } catch (e) {
                    onError(message(e));
                  }
                })()
              }
            >
              {inventory ? "Înregistrează inventarul" : "Înregistrează recepția"}
            </button>
            <button onClick={() => setOpen(false)}>Renunță</button>
          </div>
          <p className="muted small">
            {inventory
              ? "Business compară cantitățile numărate cu stocul din depozitul ales și înregistrează diferențele."
              : "Produsul se alege din Business pentru fiecare linie (cel recunoscut pe telefon e deja ales); prețurile se scriu aici, nu pe telefon."}
          </p>
        </div>
      )}
    </>
  );
}

export function PhonePage({ modules, onError }: { modules: ModulesReply; onError: (e: string | null) => void }) {
  const [r, setR] = useState<Reply | null>(null);
  const [who, setWho] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [acc, setAcc] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const business = modules.modules.some((m) => m.id === "kgb.business" && m.enabled);

  const load = useCallback(async () => {
    try {
      setR(await invoke<Reply>("phone_status"));
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (business)
      void api.moduleCall<Account[]>("kgb.business", "accounts").then(
        (a) => {
          setAccounts(a.filter((x) => x.tip === "banca"));
          setAllAccounts(a);
        },
        () => setAccounts([]),
      );
  }, [business]);
  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) setNotice(done);
      onError(null);
      await load();
    } catch (e) {
      onError(message(e));
    }
  };

  if (!r) return <p className="muted">Se încarcă…</p>;
  const waiting = r.telefoane.filter((p) => p.stare === "asteapta");
  const list = r.primite.filter((x) => showDone || !x.procesat);
  return (
    <section className="phone-page">
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      <div className="card phone-server">
        {r.pornit_org ? (
          <>
            <p>
              Pagina de telefon e <strong>pornită</strong> pe toate PC-urile firmei cu K.G.B. deschis. Pentru asocierea unui telefon nou, conectat la Wi-Fi-ul
              firmei, deschide în browser adresa acestui PC:
            </p>
            {r.pornit ? <p className="phone-address">{r.adresa}</p> : <p className="error">Pe acest PC pagina nu a pornit{r.problema ? `: ${r.problema}` : "."}</p>}
            <p className="muted small phone-common">
              După aprobare, în Wi-Fi-ul firmei telefonul trece singur la adresa comună <strong>{r.comun}</strong>, la care răspunde oricare PC pornit; dacă un PC
              se stinge, pagina merge mai departe prin altul.
            </p>
            {r.cod ? (
              <p>
                Codul de asociere: <span className="phone-code">{r.cod[0]}</span> <span className="muted small">(încă {Math.ceil(r.cod[1] / 60)} min, o singură dată)</span>
              </p>
            ) : (
              <p className="muted">Niciun cod valabil.</p>
            )}
            {r.admin && (
              <div className="row">
                <button onClick={() => void act(() => invoke("phone_new_code"))}>Cod nou</button>
                <button className="danger-text" onClick={() => void act(() => invoke("phone_stop"), "Pagina de telefon e oprită.")}>
                  Oprește pagina
                </button>
              </div>
            )}
            <p className="muted small">
              Merge doar în rețeaua firmei (sau prin Tailscale, criptat). Pe un Wi-Fi public nu o folosi: legătura nu e criptată. Prima dată, pe fiecare PC,
              Windows poate întreba dacă K.G.B. poate primi conexiuni; răspunde „Permite” doar pentru rețele private.
            </p>
            {r.pc_uri.length > 0 && (
              <table className="audit phone-hosts">
                <thead>
                  <tr>
                    <th>PC</th>
                    <th>Adrese</th>
                    <th>Stare</th>
                  </tr>
                </thead>
                <tbody>
                  {r.pc_uri.map((h) => (
                    <tr key={h.dispozitiv}>
                      <td>{h.nume}</td>
                      <td className="small">{h.adrese.join(" · ") || "—"}</td>
                      <td>{h.pornit ? "servește pagina" : "oprit"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <>
            <p>
              Pagina de telefon e oprită. Pornită, o servesc toate PC-urile firmei cu K.G.B. deschis, iar telefoanele trimit fișe de recepție, poze cu documentele de
              la șoferi și extrase de cont.
            </p>
            {r.admin ? (
              <button className="primary" onClick={() => void act(() => invoke("phone_start"))}>
                Pornește pagina de telefon
              </button>
            ) : (
              <p className="muted">Doar un administrator o pornește.</p>
            )}
          </>
        )}
      </div>

      {waiting.length > 0 && r.admin && (
        <div className="card">
          <h3>Telefoane care așteaptă aprobarea</h3>
          {waiting.map((p) => (
            <div className="row wrap" key={p.id} data-phone={p.nume}>
              <strong>{p.nume}</strong>
              <select aria-label={`Cine folosește ${p.nume}`} value={who[p.id] ?? r.persoane[0] ?? ""} onChange={(e) => setWho({ ...who, [p.id]: e.target.value })}>
                {r.persoane.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button className="primary" onClick={() => void act(() => invoke("phone_approve", { id: p.id, membru: who[p.id] ?? r.persoane[0] ?? "" }), `${p.nume} e aprobat.`)}>
                Aprobă
              </button>
              <button className="danger-text" onClick={() => void act(() => invoke("phone_revoke", { id: p.id }))}>
                Refuză
              </button>
            </div>
          ))}
        </div>
      )}

      <PhoneTimesheet items={r.primite} onDone={(m) => void load().then(() => setNotice(m))} onError={onError} />

      <h3>Primite de pe telefon</h3>
      <label className="small">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> arată și cele rezolvate
      </label>
      {list.length === 0 && <p className="muted">Nimic nou.</p>}
      <ul className="phone-inbox">
        {list.map((x) => (
          <li key={x.id} className={x.procesat ? "card muted" : "card"} data-received={x.tip}>
            <div className="row wrap">
              <strong>{KIND[x.tip]}</strong>
              <span className="muted small">
                {when(x.creat_ms)} · {x.membru_nume} ({x.telefon_nume})
              </span>
              <span className="grow" />
              <button className="link" onClick={() => void act(() => invoke("phone_done", { id: x.id, gata: !x.procesat }))}>
                {x.procesat ? "redeschide" : "rezolvat"}
              </button>
            </div>
            {Object.entries(x.campuri).filter(([k]) => !["punct", "livrare", "task"].includes(k)).map(([k, v]) => (
              <div key={k} className="small">
                <span className="muted">{FIELD[k] ?? k}:</span> {v}
              </div>
            ))}
            <div className="row wrap">
              {x.fisiere.map((f) => (
                <FileView key={f.id} f={f} />
              ))}
            </div>
            {(x.tip === "receptie" || x.tip === "inventar") && <ReceptionLines x={x} business={business} onDone={(m) => void load().then(() => setNotice(m))} onError={onError} />}
            {x.tip === "pontaj_echipa" && <CrewReport x={x} onDone={(m) => void load().then(() => setNotice(m))} onError={onError} />}
            {x.tip === "task" && !x.procesat && <TaskDone x={x} onDone={(m) => void load().then(() => setNotice(m))} onError={onError} />}
            {x.tip === "livrare" && !x.procesat && business && <StageToBusiness x={x} onDone={(m) => void load().then(() => setNotice(m))} onError={onError} />}
            {x.tip === "bon" && !x.procesat && business && (
              <ReceiptToBusiness x={x} accounts={allAccounts} onDone={(m) => void load().then(() => setNotice(m))} onError={onError} />
            )}
            {x.tip === "extras" && !x.procesat && x.fisiere[0] && !/\.csv$/i.test(x.fisiere[0].nume) && (
              <p className="muted small">Extrasul e un {x.fisiere[0].nume.split(".").pop()?.toUpperCase()}: îl deschizi și îl citești de aici. În Business se importă doar extrase CSV (din internet banking: „Export CSV”).</p>
            )}
            {x.tip === "extras" && !x.procesat && x.fisiere[0] && /\.csv$/i.test(x.fisiere[0].nume) && business && (
              <div className="row wrap">
                <select aria-label="Contul bancar" value={acc[x.id] ?? accounts[0]?.id ?? ""} onChange={(e) => setAcc({ ...acc, [x.id]: e.target.value })}>
                  {accounts.length === 0 && <option value="">niciun cont bancar în Business</option>}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nume}
                    </option>
                  ))}
                </select>
                <button
                  disabled={accounts.length === 0}
                  onClick={() =>
                    void act(async () => {
                      const res = await invoke<{ importate: number; sarite: number }>("phone_import_statement", { id: x.id, fisier: x.fisiere[0]!.id, cont: acc[x.id] ?? accounts[0]?.id });
                      setNotice(`Extras importat în Business: ${res.importate} operații noi${res.sarite ? `, ${res.sarite} deja importate` : ""}.`);
                    })
                  }
                >
                  Importă în Business
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {r.telefoane.some((p) => p.stare === "aprobat") && (
        <div className="card">
          <h3>Telefoane asociate</h3>
          {r.telefoane
            .filter((p) => p.stare === "aprobat")
            .map((p) => (
              <div className="row wrap" key={p.id}>
                <span>
                  {p.nume} · {p.membru_nume} <span className="muted small">· văzut {when(p.vazut_ms)}</span>
                </span>
                {r.admin && (
                  <button className="link danger-text" onClick={() => void act(() => invoke("phone_revoke", { id: p.id }), `${p.nume} nu mai are acces.`)}>
                    scoate
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
