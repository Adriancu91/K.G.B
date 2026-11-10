// „e-Factura…” on an issued invoice (7.4m-3, D-082): the address pieces and the units that e-Factura needs are
// proposed from what the invoice kept and can be corrected here; the file is checked with the COS rules as you
// type, written by the COS code and, before it is saved, read back by the module (efactura_export). Only a file
// is written: the owner uploads it in SPV.
import { useMemo, useState } from "react";
import { api } from "../../api";
// The save dialog through the app's one host (also what the e2e tests replace).
import "../../components/cosHost";
import type { KgbHost } from "../sheets/cosBridge";
import {
  KNOWN_UNITS,
  buildEfactura,
  splitAddress,
  unknownUnits,
  type IssuedInvoice,
  type Place,
} from "./efacturaMap";

const ID = "kgb.business";
const host = () => (window as Window & { kgbHost?: KgbHost }).kgbHost!;

function PlaceFields({
  who,
  value,
  onChange,
}: {
  who: string;
  value: Place;
  onChange: (p: Place) => void;
}) {
  const field = (k: keyof Place, label: string) => (
    <label>
      {label}
      <input
        value={value[k]}
        aria-label={`${who}: ${label}`}
        onChange={(e) => onChange({ ...value, [k]: e.target.value })}
      />
    </label>
  );
  return (
    <fieldset>
      <legend>{who}</legend>
      <div className="partner-grid">
        {field("street", "Strada și numărul")}
        {field("city", "Localitatea (în București: Sector 1–6)")}
        {field("county", "Județul")}
        {field("postal", "Cod poștal")}
      </div>
    </fieldset>
  );
}

export function EfacturaPanel({
  invoice,
  onDone,
  onClose,
}: {
  invoice: IssuedInvoice;
  onDone: (text: string) => void;
  onClose: () => void;
}) {
  const [supplier, setSupplier] = useState<Place>(() =>
    splitAddress(invoice.furnizor.firma_adresa ?? ""),
  );
  const [customer, setCustomer] = useState<Place>(() =>
    splitAddress(invoice.client.adresa ?? ""),
  );
  const odd = useMemo(() => unknownUnits(invoice), [invoice]);
  const [units, setUnits] = useState<Record<string, string>>(() =>
    Object.fromEntries(odd.map((u) => [u, "buc"])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const built = useMemo(
    () => buildEfactura(invoice, { supplier, customer }, units),
    [invoice, supplier, customer, units],
  );
  const numar = `${invoice.serie} ${invoice.numar}`;

  const write = async () => {
    if (!built.xml) return;
    setBusy(true);
    setError(null);
    try {
      const dest = await host().save({
        defaultPath: `e-Factura ${numar}.xml`,
        filters: [{ name: "e-Factura (XML)", extensions: ["xml"] }],
      });
      if (!dest) return;
      await api.moduleCall(ID, "efactura_export", {
        id: invoice.id,
        dest,
        xml: built.xml,
      });
      onDone(
        `e-Factura pentru factura ${numar} a fost salvată: ${dest}. O încarci tu în SPV; din aplicație nu se trimite nimic.`,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="efactura-panel"
      aria-label={`e-Factura pentru factura ${numar}`}
    >
      <h3>{`e-Factura pentru factura ${numar}`}</h3>
      <p className="muted small">
        Fișierul XML (UBL 2.1, CIUS-RO) pe care îl încarci tu în SPV.
        Completează ce lipsește din adrese; verificarea se face pe loc, iar
        fișierul se scrie doar dacă sumele și numărul sunt aceleași ca pe
        factură.
      </p>
      <PlaceFields who="Furnizor" value={supplier} onChange={setSupplier} />
      <PlaceFields who="Client" value={customer} onChange={setCustomer} />
      {odd.length > 0 && (
        <fieldset>
          <legend>Unitățile de măsură în e-Factura</legend>
          {odd.map((u) => (
            <label key={u}>
              {`„${u}” înseamnă`}
              <select
                value={units[u]}
                aria-label={`Unitatea pentru ${u}`}
                onChange={(e) => setUnits({ ...units, [u]: e.target.value })}
              >
                {KNOWN_UNITS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}
      {built.errors.length > 0 && (
        <ul className="efactura-errors warn" role="status">
          {built.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button
          className="primary"
          disabled={!built.xml || busy}
          onClick={() => void write()}
        >
          Salvează e-Factura (XML)…
        </button>
        <button onClick={onClose}>Închide</button>
      </div>
    </section>
  );
}
