// 7.10b: a receipt of the vault recorded in the cash register of Business, by the person. The vault reads the
// paper (series and number, day, sum, who paid, what for, the issuer's CUI); from the firm's CUI it knows whether
// the firm received the money (its own receipt: „încasare”) or paid it (a supplier's receipt: „plată”). The form
// comes filled in; the person picks the cash account and records it. A payment with the same number and sum
// already in Business is named, and the form is not offered for it.
import { useEffect, useState } from "react";
import { api, message } from "../../api";
import { cuiKey } from "../contracts/cui";

const VAULT = "kgb.vault";
const BIZ = "kgb.business";

interface Found {
  document: string;
  serie: string;
  numar: string;
  data: string;
  suma: number | null;
  de_la: string;
  reprezentand: string;
  emitent_cui: string;
  sens: "" | "incasare" | "plata";
}
interface Account {
  id: string;
  tip: string;
  nume: string;
  sold_text: string;
}
interface Payment {
  numar?: string | null;
  suma: number;
  data: string;
  storno_de?: string | null;
}
interface Partner {
  id: string;
  nume: string;
  cui?: string | null;
}

const money = (b: number) => {
  const [i, f] = (Math.abs(b) / 100).toFixed(2).split(".");
  return `${b < 0 ? "-" : ""}${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${f}`;
};
// „Chitanța BM 0045” and „BM 0045” are the same number: no diacritics, letters and digits only, no „CHITANTA” in front.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/^CHITANTA/, "");

export function ToCash({ docId, onClose, onDone }: { docId: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [found, setFound] = useState<Found | null | undefined>(undefined);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [twin, setTwin] = useState<Payment | null>(null);
  const [f, setF] = useState({ cont: "", sens: "plata", data: "", suma: "", numar: "", explicatie: "", partener: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.moduleCall<Found | null>(VAULT, "chitanta_propunere", { id: docId });
        setFound(r);
        if (!r) return;
        const [acc, pays, parts] = await Promise.all([
          api.moduleCall<Account[]>(BIZ, "accounts"),
          api.moduleCall<Payment[]>(BIZ, "payments"),
          api.moduleCall<Partner[]>(BIZ, "partners"),
        ]);
        const cash = acc.filter((a) => a.tip === "casa");
        setAccounts(cash);
        setPartners(parts);
        const numar = [r.serie, r.numar].filter(Boolean).join(" ");
        const key = norm(numar);
        setTwin(pays.find((p) => !p.storno_de && r.suma !== null && p.suma === r.suma && key !== "" && norm(p.numar ?? "") === key) ?? null);
        const partner = r.sens === "plata" && r.emitent_cui ? parts.find((p) => cuiKey(p.cui ?? "") === cuiKey(r.emitent_cui)) : undefined;
        setF({
          cont: cash[0]?.id ?? "",
          sens: r.sens || "plata",
          data: r.data,
          suma: r.suma !== null ? money(r.suma) : "",
          numar: numar ? `Chitanța ${numar}` : "",
          explicatie: r.reprezentand || (r.de_la ? `de la ${r.de_la}` : ""),
          partener: partner?.id ?? "",
        });
      } catch (e) {
        setErr(message(e));
      }
    })();
  }, [docId]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.moduleCall(BIZ, "payment_save", {
        cont: f.cont,
        data: f.data,
        sens: f.sens,
        suma: f.suma,
        numar: f.numar || undefined,
        explicatie: f.explicatie.slice(0, 300) || undefined,
        partener: f.partener || undefined,
      });
      onDone(`${f.numar || "Chitanța"} e înregistrată în casă.`);
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };

  if (found === undefined) return <p className="muted small">Citesc chitanța…</p>;
  if (found === null)
    return (
      <p className="muted small">
        <span>Documentul nu pare o chitanță: nu are numărul sau suma.</span>{" "}
        <button className="link small" onClick={onClose}>
          Închide
        </button>
      </p>
    );
  return (
    <form
      className="card to-business"
      aria-label="Înregistrează în casă"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h4>Înregistrează în casă</h4>
      {twin && (
        <p className="vault-dup">
          <span>există deja în Business:</span> <span className="no-i18n">{`${twin.numar ?? ""}, ${money(twin.suma)} lei, ${twin.data.split("-").reverse().join(".")}`}</span>
        </p>
      )}
      {accounts.length === 0 ? (
        <p className="muted small">În Business nu e nicio casă. Adaug-o la Business › Casă și bancă, apoi revino.</p>
      ) : (
        <>
          <div className="row wrap">
            <label className="small">
              Casa{" "}
              <select aria-label="Casa" value={f.cont} onChange={(e) => setF({ ...f, cont: e.target.value })}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nume}
                  </option>
                ))}
              </select>
            </label>
            <label className="small">
              Sensul{" "}
              <select aria-label="Sensul" value={f.sens} onChange={(e) => setF({ ...f, sens: e.target.value })}>
                <option value="plata">plată (am dat banii)</option>
                <option value="incasare">încasare (am primit banii)</option>
              </select>
            </label>
            {!found.sens && <span className="muted small">Fără CUI-ul firmei în depozit nu știu dacă ai plătit sau ai încasat; alege tu.</span>}
          </div>
          <div className="row wrap">
            <label className="small">
              Data <input type="date" aria-label="Data chitanței" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
            </label>
            <label className="small">
              Suma <input aria-label="Suma" value={f.suma} onChange={(e) => setF({ ...f, suma: e.target.value })} size={10} />
            </label>
            <label className="small">
              Numărul <input aria-label="Numărul chitanței" value={f.numar} onChange={(e) => setF({ ...f, numar: e.target.value })} size={18} />
            </label>
          </div>
          <div className="row wrap">
            <label className="small">
              Partener{" "}
              <select aria-label="Partenerul" value={f.partener} onChange={(e) => setF({ ...f, partener: e.target.value })}>
                <option value="">(niciunul)</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nume}
                  </option>
                ))}
              </select>
            </label>
            <input aria-label="Explicația" placeholder="Explicația" value={f.explicatie} onChange={(e) => setF({ ...f, explicatie: e.target.value })} size={40} />
          </div>
          <p className="muted small">Verifică datele cu chitanța. Plata din casă nu poate duce soldul sub zero.</p>
        </>
      )}
      {err && <p className="error">{err}</p>}
      <div className="row wrap">
        <button className="primary" disabled={busy || accounts.length === 0 || !f.cont || !f.data || !f.suma.trim()}>
          Înregistrează
        </button>
        <button type="button" disabled={busy} onClick={onClose}>
          Renunță
        </button>
      </div>
    </form>
  );
}
