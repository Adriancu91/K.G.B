// Service auto (Etapa 8, step 8.17): the work orders still in the workshop, every order with its car, the clients'
// cars with their history, and one order open for editing: what the client says, what the workshop finds, labour and
// parts, the values, VAT and the total computed by the module, the steps up to delivered, cancelling with a reason.
// A read-only role sees everything and changes nothing (the core refuses anyway; the buttons say so first).
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.autoservice";
const FUELS: Array<[string, string]> = [
  ["", "—"],
  ["benzina", "benzină"],
  ["motorina", "motorină"],
  ["hibrid", "hibrid"],
  ["electric", "electric"],
  ["gpl", "GPL"],
  ["altul", "altul"],
];
const STATE_TEXT: Record<string, string> = {
  deschisa: "deschisă",
  in_lucru: "în lucru",
  gata: "gata",
  predata: "predată",
  anulata: "anulată",
};
const NEXT: Record<string, Array<[string, string]>> = {
  deschisa: [["in_lucru", "Începe lucrul"]],
  in_lucru: [
    ["gata", "Gata"],
    ["deschisa", "Înapoi la deschisă"],
  ],
  gata: [
    ["predata", "Predă clientului"],
    ["in_lucru", "Înapoi în lucru"],
  ],
};

interface Car {
  id: string;
  version: number;
  client: string;
  client_nume: string;
  telefon: string;
  nr: string;
  vin: string;
  marca: string;
  model: string;
  an: number;
  combustibil: string;
  nota: string;
  comenzi: number;
  ultima_intrare: string;
  km_maxim: number;
}
interface OrderLine {
  fel: "manopera" | "piesa";
  cod: string;
  denumire: string;
  um: string;
  cantitate: number;
  pret: number;
  valoare?: number;
}
interface Order {
  id: string;
  version: number;
  vehicul: string;
  numar: number;
  data_intrare: string;
  km: number;
  reclamatie: string;
  constatari: string;
  linii: OrderLine[];
  cota_tva: number;
  garantie_luni: number;
  garantie_pana: string;
  stare: string;
  data_predare: string;
  motiv_anulare: string;
  nota: string;
  manopera: number;
  piese: number;
  fara_tva: number;
  tva: number;
  total: number;
  nr: string;
  masina: string;
  client_nume: string;
}
interface CarDetail extends Car {
  istoric: Order[];
}
interface Partner {
  id: string;
  denumire: string;
  cui: string;
  telefon: string;
}

const z = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const ro = (d: string) => (d ? d.split("-").reverse().join(".") : "");
const lei = (b: number) => {
  const [i, f] = (Math.abs(b) / 100).toFixed(2).split(".");
  return `${b < 0 ? "-" : ""}${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${f}`;
};
/** „1.234,5” or „1234.5” → thousandths (quantities) or hundredths (prices), NaN when not a number. */
const scaled = (t: string, k: number) => {
  const s = t.trim().replace(/\s/g, "");
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * k) : NaN;
};
const qty = (m: number) => (m / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 3 });

interface LineDraft {
  fel: "manopera" | "piesa";
  cod: string;
  denumire: string;
  um: string;
  cantitate: string;
  pret: string;
}
const blankCar = { client: "", client_nume: "", telefon: "", nr: "", vin: "", marca: "", model: "", an: "", combustibil: "", nota: "" };
const blankLine = (fel: "manopera" | "piesa"): LineDraft => ({ fel, cod: "", denumire: "", um: "", cantitate: fel === "manopera" ? "1" : "1", pret: "" });

export function AutoServicePage({ onError, access }: { onError: (e: string | null) => void; access?: string }) {
  const readOnly = access === "citire";
  const today = iso(new Date());
  const [tab, setTab] = useState<"deschise" | "toate" | "masini">("deschise");
  const [orders, setOrders] = useState<Order[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [search, setSearch] = useState("");
  const [car, setCar] = useState(blankCar);
  const [editCar, setEditCar] = useState<Car | null>(null);
  const [openCar, setOpenCar] = useState<CarDetail | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [draft, setDraft] = useState({ data_intrare: today, km: "", reclamatie: "", constatari: "", cota_tva: "21", garantie_luni: "0", nota: "" });
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [newFor, setNewFor] = useState<Car | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deliver, setDeliver] = useState(today);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      if (tab === "masini") setCars(await api.moduleCall<Car[]>(ID, "vehicule", { text: search }));
      else setOrders(await api.moduleCall<Order[]>(ID, "comenzi", { stare: tab === "deschise" ? "deschise" : "", text: search }));
    } catch (e) {
      onError(message(e));
    }
  }, [tab, search, onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const showCar = async (id: string) => {
    try {
      setOpenCar(await api.moduleCall<CarDetail>(ID, "vehicul", { id }));
    } catch (e) {
      onError(message(e));
    }
  };

  const edit = (o: Order) => {
    setNewFor(null);
    setOrder(o);
    setDraft({
      data_intrare: o.data_intrare,
      km: o.km >= 0 ? String(o.km) : "",
      reclamatie: o.reclamatie,
      constatari: o.constatari,
      cota_tva: String(o.cota_tva),
      garantie_luni: String(o.garantie_luni),
      nota: o.nota,
    });
    setLines(o.linii.map((l) => ({ fel: l.fel, cod: l.cod, denumire: l.denumire, um: l.um, cantitate: qty(l.cantitate), pret: lei(l.pret) })));
    setNotice(null);
  };
  const startNew = (c: Car) => {
    setOrder(null);
    setNewFor(c);
    setDraft({ data_intrare: today, km: "", reclamatie: "", constatari: "", cota_tva: "21", garantie_luni: "0", nota: "" });
    setLines([]);
    setNotice(null);
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
    if (openCar) await showCar(openCar.id);
  };

  const saveCar = () =>
    run(async () => {
      const args = {
        ...(editCar ? { id: editCar.id, version: editCar.version } : {}),
        ...(car.client ? { client: car.client } : { client_nume: car.client_nume }),
        telefon: car.telefon,
        nr: car.nr,
        vin: car.vin,
        marca: car.marca,
        model: car.model,
        an: Number(car.an) || 0,
        combustibil: car.combustibil,
        nota: car.nota,
      };
      const r = await api.moduleCall<{ id: string }>(ID, "vehicul_save", args);
      setCar(blankCar);
      setEditCar(null);
      setPartners([]);
      await showCar(r.id);
    });

  const saveOrder = () =>
    run(async () => {
      const vehicul = order?.vehicul ?? newFor?.id;
      if (!vehicul) return;
      const linii = lines.map((l, n) => {
        const cantitate = scaled(l.cantitate, 1000);
        const pret = scaled(l.pret, 100);
        if (Number.isNaN(cantitate) || Number.isNaN(pret)) throw new Error(`linia ${n + 1}: cantitatea și prețul sunt numere`);
        return { fel: l.fel, cod: l.cod, denumire: l.denumire, um: l.um, cantitate, pret };
      });
      const km = draft.km.trim() ? Number(draft.km.replace(/\D/g, "")) : -1;
      const r = await api.moduleCall<{ id: string; atentie: string }>(ID, "comanda_save", {
        ...(order ? { id: order.id, version: order.version } : {}),
        vehicul,
        data_intrare: draft.data_intrare,
        km,
        reclamatie: draft.reclamatie,
        constatari: draft.constatari,
        linii,
        cota_tva: Number(draft.cota_tva),
        garantie_luni: Number(draft.garantie_luni) || 0,
        nota: draft.nota,
      });
      setNotice(r.atentie ? `Salvată. Atenție: ${r.atentie}.` : "Comanda e salvată.");
      edit(await api.moduleCall<Order>(ID, "comanda", { id: r.id }));
    });

  const step = (stare: string, extra: Record<string, string> = {}) =>
    run(async () => {
      if (!order) return;
      await api.moduleCall(ID, "comanda_stare", { id: order.id, version: order.version, stare, ...extra });
      const o = await api.moduleCall<Order>(ID, "comanda", { id: order.id });
      edit(o);
      setReason("");
      setNotice(`Comanda nr. ${o.numar} e acum: ${STATE_TEXT[o.stare] ?? o.stare}.`);
    });

  const findPartners = async (text: string) => {
    setCar({ ...car, client: "", client_nume: text });
    try {
      setPartners(text.trim().length >= 2 ? await api.moduleCall<Partner[]>(ID, "parteneri", { text }) : []);
    } catch {
      setPartners([]);
    }
  };

  const locked = readOnly || (order !== null && (order.stare === "predata" || order.stare === "anulata"));
  const editing = order !== null || newFor !== null;
  const ordersTable = (list: Order[]) => (
    <table className="autoservice-orders">
      <thead>
        <tr>
          <th>Nr.</th>
          <th>Intrare</th>
          <th>Mașina</th>
          <th>Client</th>
          <th>Starea</th>
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {list.map((o) => (
          <tr key={o.id} className={order?.id === o.id ? "selected" : ""}>
            <td>
              <button className="link" onClick={() => edit(o)}>
                {o.numar}
              </button>
            </td>
            <td>{ro(o.data_intrare)}</td>
            <td>
              <b>{o.nr}</b> {o.masina}
            </td>
            <td>{o.client_nume}</td>
            <td>{STATE_TEXT[o.stare] ?? o.stare}</td>
            <td className="num">{lei(o.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <section className="autoservice">
      {readOnly && <p className="warn">Rolul tău poate doar citi service-ul auto: nu poate schimba nimic.</p>}
      <div className="sheet-tabs" role="tablist" aria-label="Vederea">
        {(
          [
            ["deschise", "Comenzi în lucru"],
            ["toate", "Toate comenzile"],
            ["masini", "Mașini"],
          ] as const
        ).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {v}
          </button>
        ))}
      </div>
      <input aria-label="Caută" placeholder="Caută după număr, client, marcă…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {tab !== "masini" && (orders.length ? ordersTable(orders) : <p className="muted">{tab === "deschise" ? "Nicio mașină în atelier acum." : "Nicio comandă încă."}</p>)}

      {tab === "masini" && (
        <>
          <table className="autoservice-cars">
            <thead>
              <tr>
                <th>Număr</th>
                <th>Mașina</th>
                <th>Client</th>
                <th>Telefon</th>
                <th className="num">Comenzi</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((c) => (
                <tr key={c.id} className={openCar?.id === c.id ? "selected" : ""}>
                  <td>
                    <button className="link" onClick={() => void showCar(c.id)}>
                      {c.nr}
                    </button>
                  </td>
                  <td>
                    {c.marca} {c.model} {c.an ? `(${c.an})` : ""}
                  </td>
                  <td>{c.client_nume}</td>
                  <td>{c.telefon}</td>
                  <td className="num">{c.comenzi}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && (
            <form
              className="card"
              aria-label="Mașina"
              onSubmit={(e) => {
                e.preventDefault();
                void saveCar();
              }}
            >
              <h3>{editCar ? `Mașina ${editCar.nr}` : "Mașină nouă"}</h3>
              <div className="row">
                <label>
                  Client (partener sau nume)
                  <input aria-label="Clientul" value={car.client_nume} onChange={(e) => void findPartners(e.target.value)} />
                </label>
                <label>
                  Telefon
                  <input aria-label="Telefonul" value={car.telefon} onChange={(e) => setCar({ ...car, telefon: e.target.value })} />
                </label>
              </div>
              {partners.length > 0 && (
                <ul className="suggest" aria-label="Parteneri găsiți">
                  {partners.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="link"
                        onClick={() => {
                          setCar({ ...car, client: p.id, client_nume: p.denumire, telefon: car.telefon || p.telefon });
                          setPartners([]);
                        }}
                      >
                        {p.denumire} {p.cui && `· ${p.cui}`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="row">
                <label>
                  Număr de înmatriculare
                  <input aria-label="Numărul de înmatriculare" value={car.nr} onChange={(e) => setCar({ ...car, nr: e.target.value })} required />
                </label>
                <label>
                  VIN (seria de șasiu)
                  <input aria-label="VIN" value={car.vin} maxLength={20} onChange={(e) => setCar({ ...car, vin: e.target.value })} />
                </label>
              </div>
              <div className="row">
                <label>
                  Marca
                  <input aria-label="Marca" value={car.marca} onChange={(e) => setCar({ ...car, marca: e.target.value })} />
                </label>
                <label>
                  Modelul
                  <input aria-label="Modelul" value={car.model} onChange={(e) => setCar({ ...car, model: e.target.value })} />
                </label>
                <label>
                  Anul
                  <input aria-label="Anul fabricației" inputMode="numeric" value={car.an} onChange={(e) => setCar({ ...car, an: e.target.value })} />
                </label>
                <label>
                  Combustibil
                  <select aria-label="Combustibilul" value={car.combustibil} onChange={(e) => setCar({ ...car, combustibil: e.target.value })}>
                    {FUELS.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="actions">
                <button className="primary" disabled={busy}>
                  {editCar ? "Salvează mașina" : "Adaugă mașina"}
                </button>
                {editCar && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditCar(null);
                      setCar(blankCar);
                    }}
                  >
                    Renunță
                  </button>
                )}
              </div>
            </form>
          )}
          {openCar && (
            <div className="card" aria-label="Fișa mașinii">
              <h3>
                {openCar.nr} · {openCar.marca} {openCar.model}
              </h3>
              <p>
                {openCar.client_nume} {openCar.telefon && `· ${openCar.telefon}`} {openCar.vin && `· VIN ${openCar.vin}`}
                {openCar.km_maxim >= 0 && ` · ultimul kilometraj: ${openCar.km_maxim.toLocaleString("ro-RO")} km`}
              </p>
              {!readOnly && (
                <div className="actions">
                  <button className="primary" onClick={() => startNew(openCar)}>
                    Comandă nouă
                  </button>
                  <button
                    onClick={() => {
                      setEditCar(openCar);
                      setCar({
                        client: openCar.client,
                        client_nume: openCar.client_nume,
                        telefon: openCar.telefon,
                        nr: openCar.nr,
                        vin: openCar.vin,
                        marca: openCar.marca,
                        model: openCar.model,
                        an: openCar.an ? String(openCar.an) : "",
                        combustibil: openCar.combustibil,
                        nota: openCar.nota,
                      });
                    }}
                  >
                    Modifică mașina
                  </button>
                  {openCar.comenzi === 0 && (
                    <button className="danger" onClick={() => void run(() => api.moduleCall(ID, "vehicul_delete", { id: openCar.id, version: openCar.version }).then(() => setOpenCar(null)))}>
                      Șterge mașina
                    </button>
                  )}
                </div>
              )}
              <h4>Istoricul ({openCar.istoric.length})</h4>
              {openCar.istoric.length ? ordersTable(openCar.istoric) : <p className="muted">Nicio comandă pentru mașina aceasta.</p>}
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="card autoservice-order" aria-label="Comanda de lucru">
          <h3>
            {order ? `Comanda nr. ${order.numar} · ${STATE_TEXT[order.stare] ?? order.stare}` : "Comandă nouă"} · {order?.nr ?? newFor?.nr} {order?.masina ?? `${newFor?.marca ?? ""} ${newFor?.model ?? ""}`}
          </h3>
          {notice && <p className="ok">{notice}</p>}
          {order?.stare === "anulata" && <p className="warn">Anulată: {order.motiv_anulare}</p>}
          {order?.stare === "predata" && (
            <p className="muted">
              {`Predată la ${ro(order.data_predare)}`}
              {order.garantie_pana && " "}
              {order.garantie_pana && <span>{`· garanția lucrării până la ${ro(order.garantie_pana)}`}</span>}{" "}
              <span>O comandă predată nu se mai schimbă.</span>
            </p>
          )}
          <fieldset disabled={locked}>
            <div className="row">
              <label>
                Data intrării
                <input type="date" aria-label="Data intrării" value={draft.data_intrare} onChange={(e) => setDraft({ ...draft, data_intrare: e.target.value })} />
              </label>
              <label>
                Kilometraj
                <input aria-label="Kilometrajul" inputMode="numeric" value={draft.km} onChange={(e) => setDraft({ ...draft, km: e.target.value })} />
              </label>
              <label>
                Cota TVA
                <select aria-label="Cota TVA" value={draft.cota_tva} onChange={(e) => setDraft({ ...draft, cota_tva: e.target.value })}>
                  {["21", "11", "0"].map((c) => (
                    <option key={c} value={c}>
                      {c}%
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Garanția lucrării (luni)
                <input aria-label="Garanția lucrării" inputMode="numeric" value={draft.garantie_luni} onChange={(e) => setDraft({ ...draft, garantie_luni: e.target.value })} />
              </label>
            </div>
            <label>
              Ce spune clientul
              <textarea aria-label="Reclamația clientului" rows={2} value={draft.reclamatie} onChange={(e) => setDraft({ ...draft, reclamatie: e.target.value })} />
            </label>
            <label>
              Ce s-a constatat
              <textarea aria-label="Constatările" rows={2} value={draft.constatari} onChange={(e) => setDraft({ ...draft, constatari: e.target.value })} />
            </label>
            <table className="autoservice-lines">
              <thead>
                <tr>
                  <th>Fel</th>
                  <th>Cod</th>
                  <th>Denumire</th>
                  <th>U.M.</th>
                  <th className="num">Cantitate</th>
                  <th className="num">Preț fără TVA</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, n) => (
                  <tr key={n}>
                    <td>{l.fel === "manopera" ? "manoperă" : "piesă"}</td>
                    <td>
                      <input aria-label={`Codul liniei ${n + 1}`} value={l.cod} onChange={(e) => setLines(lines.map((x, k) => (k === n ? { ...x, cod: e.target.value } : x)))} />
                    </td>
                    <td>
                      <input aria-label={`Denumirea liniei ${n + 1}`} value={l.denumire} onChange={(e) => setLines(lines.map((x, k) => (k === n ? { ...x, denumire: e.target.value } : x)))} />
                    </td>
                    <td>
                      <input aria-label={`U.M. a liniei ${n + 1}`} size={4} placeholder={l.fel === "manopera" ? "ore" : "buc"} value={l.um} onChange={(e) => setLines(lines.map((x, k) => (k === n ? { ...x, um: e.target.value } : x)))} />
                    </td>
                    <td>
                      <input aria-label={`Cantitatea liniei ${n + 1}`} className="num" size={6} value={l.cantitate} onChange={(e) => setLines(lines.map((x, k) => (k === n ? { ...x, cantitate: e.target.value } : x)))} />
                    </td>
                    <td>
                      <input aria-label={`Prețul liniei ${n + 1}`} className="num" size={8} value={l.pret} onChange={(e) => setLines(lines.map((x, k) => (k === n ? { ...x, pret: e.target.value } : x)))} />
                    </td>
                    <td>
                      <button type="button" className="link danger-text" onClick={() => setLines(lines.filter((_, k) => k !== n))}>
                        scoate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="actions">
              <button type="button" onClick={() => setLines([...lines, blankLine("manopera")])}>
                + Manoperă
              </button>
              <button type="button" onClick={() => setLines([...lines, blankLine("piesa")])}>
                + Piesă
              </button>
              <button type="button" className="primary" disabled={busy} onClick={() => void saveOrder()}>
                {order ? "Salvează comanda" : "Deschide comanda"}
              </button>
            </div>
          </fieldset>
          {order && (
            <table className="autoservice-totals">
              <tbody>
                <tr>
                  <td>Manoperă</td>
                  <td className="num">{lei(order.manopera)}</td>
                </tr>
                <tr>
                  <td>Piese</td>
                  <td className="num">{lei(order.piese)}</td>
                </tr>
                <tr>
                  <td>Total fără TVA</td>
                  <td className="num">{lei(order.fara_tva)}</td>
                </tr>
                <tr>
                  <td>TVA {order.cota_tva}%</td>
                  <td className="num">{lei(order.tva)}</td>
                </tr>
                <tr>
                  <td>
                    <b>Total de plată</b>
                  </td>
                  <td className="num">
                    <b>{lei(order.total)} lei</b>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {order && !locked && (
            <div className="actions">
              {(NEXT[order.stare] ?? []).map(([to, text]) =>
                to === "predata" ? (
                  <span key={to}>
                    <input type="date" aria-label="Data predării" value={deliver} onChange={(e) => setDeliver(e.target.value)} />{" "}
                    <button className="primary" disabled={busy} onClick={() => void step(to, { data: deliver })}>
                      {text}
                    </button>
                  </span>
                ) : (
                  <button key={to} disabled={busy} onClick={() => void step(to)}>
                    {text}
                  </button>
                ),
              )}
              <input aria-label="Motivul anulării" placeholder="motivul anulării" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="danger" disabled={busy || reason.trim().length < 3} onClick={() => void step("anulata", { motiv: reason })}>
                Anulează comanda
              </button>
            </div>
          )}
          <p className="muted">Valorile, TVA-ul și totalul le calculează aplicația după salvare; o linie se rotunjește la ban.</p>
        </div>
      )}
    </section>
  );
}
