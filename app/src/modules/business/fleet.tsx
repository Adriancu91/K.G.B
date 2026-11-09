// Fleet and drivers (Etapa 7, step 7.4k-6): vehicles and drivers with the
// documents that expire (ITP, RCA, licence…), what expires in the next 30
// days at the top, reminders from the core (30 / 7 days, on the day, after).
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";

const ID = "kgb.business";
const VEHICLE_DOCS = ["ITP", "RCA", "CASCO", "Rovinietă", "Revizie", "Licență de transport", "Verificare tahograf", "Extinctor", "Trusă medicală"];
const DRIVER_DOCS = ["Permis de conducere", "Atestat profesional", "Card tahograf", "Aviz medical", "Aviz psihologic"];

interface Doc {
  tip: string;
  numar: string | null;
  emis: string | null;
  expira: string;
  nota: string | null;
}
interface Vehicle {
  id: string;
  version: number;
  numar: string;
  marca: string | null;
  model: string | null;
  an: number | null;
  sofer: string | null;
  activ: boolean;
  acte: Doc[];
}
interface Driver {
  id: string;
  version: number;
  nume: string;
  telefon: string | null;
  categorii: string | null;
  activ: boolean;
  acte: Doc[];
}
interface Soon {
  ce: "vehicul" | "sofer";
  id: string;
  nume: string;
  tip: string;
  expira: string;
  zile: number;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ro = (iso: string) => iso.split("-").reverse().join(".");
const left = (z: number) => (z < 0 ? `expirat de ${-z} zile` : z === 0 ? "expiră azi" : `în ${z} zile`);

/** The documents of one vehicle or driver, editable. */
function DocsEditor({ docs, kinds, onChange, owner }: { docs: Doc[]; kinds: string[]; onChange: (d: Doc[]) => void; owner: string }) {
  const set = (n: number, k: keyof Doc, v: string) => onChange(docs.map((d, j) => (j === n ? { ...d, [k]: v } : d)));
  return (
    <div className="fleet-docs">
      <datalist id={`kinds-${owner}`}>
        {kinds.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      {docs.map((d, n) => (
        <div className="row wrap" key={n}>
          <input aria-label={`Actul ${n + 1} (${owner})`} list={`kinds-${owner}`} placeholder="Tipul (ITP, RCA…)" value={d.tip} onChange={(e) => set(n, "tip", e.target.value)} />
          <input aria-label={`Numărul actului ${n + 1} (${owner})`} placeholder="Număr / serie" size={12} value={d.numar ?? ""} onChange={(e) => set(n, "numar", e.target.value)} />
          <label className="small">
            expiră{" "}
            <input aria-label={`Expirarea actului ${n + 1} (${owner})`} type="date" value={d.expira} onChange={(e) => set(n, "expira", e.target.value)} />
          </label>
          <button className="link" onClick={() => onChange(docs.filter((_, j) => j !== n))}>
            scoate
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...docs, { tip: "", numar: null, emis: null, expira: "", nota: null }])}>+ act</button>
    </div>
  );
}

const clean = (docs: Doc[]) => docs.filter((d) => d.tip.trim() || d.expira).map((d) => ({ tip: d.tip, numar: d.numar || null, emis: d.emis || null, expira: d.expira, nota: d.nota || null }));

export function FleetView({ onError }: { onError: (e: string | null) => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [soon, setSoon] = useState<Soon[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [nv, setNv] = useState({ numar: "", marca: "", model: "", sofer: "" });
  const [nvDocs, setNvDocs] = useState<Doc[]>([{ tip: "ITP", numar: null, emis: null, expira: "", nota: null }, { tip: "RCA", numar: null, emis: null, expira: "", nota: null }]);
  const [nd, setNd] = useState({ nume: "", telefon: "", categorii: "" });
  const [ndDocs, setNdDocs] = useState<Doc[]>([{ tip: "Permis de conducere", numar: null, emis: null, expira: "", nota: null }]);
  const [editing, setEditing] = useState<Record<string, Doc[]>>({});

  const load = useCallback(async () => {
    try {
      const [v, d, s] = await Promise.all([api.moduleCall<Vehicle[]>(ID, "vehicles"), api.moduleCall<Driver[]>(ID, "drivers"), api.moduleCall<Soon[]>(ID, "fleet_expiring", { azi: today() })]);
      setVehicles(v);
      setDrivers(d);
      setSoon(s);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => void load(), [load]);

  const run = async (f: () => Promise<unknown>, msg: string) => {
    try {
      await f();
      onError(null);
      setNotice(msg);
      await load();
    } catch (e) {
      onError(message(e));
    }
  };

  return (
    <div className="fleet">
      {notice && <p className="ok">{notice}</p>}
      <h3>Expiră în următoarele 30 de zile</h3>
      {soon.length === 0 ? (
        <p className="muted">Nimic nu expiră în următoarele 30 de zile.</p>
      ) : (
        <table className="audit fleet-soon">
          <thead>
            <tr>
              <th>Al cui</th>
              <th>Actul</th>
              <th>Data</th>
              <th>Când</th>
            </tr>
          </thead>
          <tbody>
            {soon.map((x) => (
              <tr key={`${x.id}-${x.tip}-${x.expira}`} className={x.zile <= 0 ? "error" : undefined}>
                <td>
                  {x.ce === "vehicul" ? "vehicul" : "șofer"} {x.nume}
                </td>
                <td>{x.tip}</td>
                <td>{ro(x.expira)}</td>
                <td>{left(x.zile)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">Memento-urile vin singure: cu 30 și 7 zile înainte, în ziua expirării și apoi săptămânal, patru săptămâni.</p>

      <h3>Vehicule</h3>
      {vehicles.map((v) => (
        <div key={v.id} className={v.activ ? "card" : "card muted"} data-vehicle={v.numar}>
          <div className="row wrap">
            <strong>{v.numar}</strong>
            <span>{[v.marca, v.model, v.an].filter(Boolean).join(" ")}</span>
            {v.sofer && <span className="muted">șofer: {v.sofer}</span>}
            {!v.activ && <span className="muted">(scos din folosință)</span>}
          </div>
          {editing[v.id] ? (
            <>
              <DocsEditor docs={editing[v.id] ?? []} kinds={VEHICLE_DOCS} owner={v.numar} onChange={(d) => setEditing({ ...editing, [v.id]: d })} />
              <div className="row">
                <button
                  className="primary"
                  onClick={() =>
                    void run(async () => {
                      await api.moduleCall(ID, "vehicle_save", { id: v.id, version: v.version, numar: v.numar, marca: v.marca, model: v.model, an: v.an, sofer: v.sofer, activ: v.activ, acte: clean(editing[v.id] ?? []) });
                      setEditing(Object.fromEntries(Object.entries(editing).filter(([k]) => k !== v.id)));
                    }, `Actele vehiculului ${v.numar} au fost salvate.`)
                  }
                >
                  Salvează actele
                </button>
                <button onClick={() => setEditing(Object.fromEntries(Object.entries(editing).filter(([k]) => k !== v.id)))}>Renunță</button>
              </div>
            </>
          ) : (
            <div className="row wrap">
              <span className="small">{v.acte.map((d) => `${d.tip} ${ro(d.expira)}`).join(" · ") || "fără acte"}</span>
              <button className="link" onClick={() => setEditing({ ...editing, [v.id]: v.acte })}>
                actele
              </button>
              <button
                className="link"
                onClick={() =>
                  void run(
                    () => api.moduleCall(ID, "vehicle_save", { id: v.id, version: v.version, numar: v.numar, marca: v.marca, model: v.model, an: v.an, sofer: v.sofer, activ: !v.activ, acte: v.acte }),
                    v.activ ? `${v.numar} e scos din folosință (fără memento-uri).` : `${v.numar} e din nou în folosință.`,
                  )
                }
              >
                {v.activ ? "scoate din folosință" : "repune în folosință"}
              </button>
            </div>
          )}
        </div>
      ))}
      <div className="card fleet-new-vehicle">
        <h4>Vehicul nou</h4>
        <div className="row wrap">
          <input aria-label="Numărul de înmatriculare" placeholder="IS-01-ABC" value={nv.numar} onChange={(e) => setNv({ ...nv, numar: e.target.value })} />
          <input aria-label="Marca" placeholder="Marca" value={nv.marca} onChange={(e) => setNv({ ...nv, marca: e.target.value })} />
          <input aria-label="Modelul" placeholder="Modelul" value={nv.model} onChange={(e) => setNv({ ...nv, model: e.target.value })} />
          <input aria-label="Șoferul obișnuit" placeholder="Șoferul obișnuit" list="fleet-drivers" value={nv.sofer} onChange={(e) => setNv({ ...nv, sofer: e.target.value })} />
          <datalist id="fleet-drivers">
            {drivers.map((d) => (
              <option key={d.id} value={d.nume} />
            ))}
          </datalist>
        </div>
        <DocsEditor docs={nvDocs} kinds={VEHICLE_DOCS} owner="vehicul nou" onChange={setNvDocs} />
        <button
          className="primary"
          disabled={!nv.numar.trim()}
          onClick={() =>
            void run(async () => {
              await api.moduleCall(ID, "vehicle_save", { numar: nv.numar, marca: nv.marca || null, model: nv.model || null, sofer: nv.sofer || null, acte: clean(nvDocs) });
              setNv({ numar: "", marca: "", model: "", sofer: "" });
              setNvDocs([]);
            }, `Vehiculul ${nv.numar.toUpperCase()} a fost adăugat.`)
          }
        >
          Adaugă vehiculul
        </button>
      </div>

      <h3>Șoferi</h3>
      {drivers.map((d) => (
        <div key={d.id} className={d.activ ? "card" : "card muted"} data-driver={d.nume}>
          <div className="row wrap">
            <strong>{d.nume}</strong>
            {d.categorii && <span>categorii {d.categorii}</span>}
            {d.telefon && <span className="muted">{d.telefon}</span>}
          </div>
          {editing[d.id] ? (
            <>
              <DocsEditor docs={editing[d.id] ?? []} kinds={DRIVER_DOCS} owner={d.nume} onChange={(x) => setEditing({ ...editing, [d.id]: x })} />
              <div className="row">
                <button
                  className="primary"
                  onClick={() =>
                    void run(async () => {
                      await api.moduleCall(ID, "driver_save", { id: d.id, version: d.version, nume: d.nume, telefon: d.telefon, categorii: d.categorii, activ: d.activ, acte: clean(editing[d.id] ?? []) });
                      setEditing(Object.fromEntries(Object.entries(editing).filter(([k]) => k !== d.id)));
                    }, `Actele lui ${d.nume} au fost salvate.`)
                  }
                >
                  Salvează actele
                </button>
                <button onClick={() => setEditing(Object.fromEntries(Object.entries(editing).filter(([k]) => k !== d.id)))}>Renunță</button>
              </div>
            </>
          ) : (
            <div className="row wrap">
              <span className="small">{d.acte.map((x) => `${x.tip} ${ro(x.expira)}`).join(" · ") || "fără acte"}</span>
              <button className="link" onClick={() => setEditing({ ...editing, [d.id]: d.acte })}>
                actele
              </button>
            </div>
          )}
        </div>
      ))}
      <div className="card fleet-new-driver">
        <h4>Șofer nou</h4>
        <div className="row wrap">
          <input aria-label="Numele șoferului" placeholder="Numele" value={nd.nume} onChange={(e) => setNd({ ...nd, nume: e.target.value })} />
          <input aria-label="Telefonul șoferului" placeholder="Telefon" value={nd.telefon} onChange={(e) => setNd({ ...nd, telefon: e.target.value })} />
          <input aria-label="Categoriile permisului" placeholder="Categorii (B, C, CE)" value={nd.categorii} onChange={(e) => setNd({ ...nd, categorii: e.target.value })} />
        </div>
        <DocsEditor docs={ndDocs} kinds={DRIVER_DOCS} owner="șofer nou" onChange={setNdDocs} />
        <button
          className="primary"
          disabled={!nd.nume.trim()}
          onClick={() =>
            void run(async () => {
              await api.moduleCall(ID, "driver_save", { nume: nd.nume, telefon: nd.telefon || null, categorii: nd.categorii || null, acte: clean(ndDocs) });
              setNd({ nume: "", telefon: "", categorii: "" });
              setNdDocs([]);
            }, `Șoferul ${nd.nume} a fost adăugat.`)
          }
        >
          Adaugă șoferul
        </button>
      </div>
    </div>
  );
}
