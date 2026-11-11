// 7.10c (D-089): invoices read from the online invoicing program, read only. The key is typed here once and kept
// sealed on this PC only (the core never gives it back); the person names a series and the numbers; the core reads
// each invoice (its value, the amount paid and its PDF), one request a second, and the PDFs go into the vault as
// any file — the duplicate check of the vault then says what is already there. Nothing is written in the program.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { api, message } from "../../api";

const VAULT = "kgb.vault";

interface Status {
  configurat: boolean;
  cod_unic: string;
  platforma_url: string;
  mediu: string;
}
interface Found {
  serie: string;
  numar: string;
  valoare: number | null;
  achitat: number | null;
  pdf: string | null;
  nota: string;
}
interface Run {
  facturi: Found[];
  citite: number;
  oprit: string;
}

const money = (b: number) => {
  const [i, f] = (Math.abs(b) / 100).toFixed(2).split(".");
  return `${b < 0 ? "-" : ""}${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${f}`;
};

export function OnlineInvoicing({ readOnly, onClose, onAdded }: { readOnly: boolean; onClose: () => void; onAdded: (msg: string) => void }) {
  const [st, setSt] = useState<Status | null>(null);
  const [key, setKey] = useState({ cod_unic: "", cheie: "", platforma_url: "", mediu: "productie" });
  const [q, setQ] = useState({ serie: "", de_la: "1", pana_la: "" });
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    invoke<Status>("invoicing_status").then(setSt, (e: unknown) => setErr(message(e)));
    const off = listen<number>("invoicing-progress", (e) => setAt(e.payload));
    return () => {
      void off.then((f) => f());
    };
  }, []);

  const saveKey = async () => {
    setBusy(true);
    setErr(null);
    try {
      setSt(await invoke<Status>("invoicing_key_set", { codUnic: key.cod_unic, cheie: key.cheie, platformaUrl: key.platforma_url, mediu: key.mediu }));
      setKey({ cod_unic: "", cheie: "", platforma_url: "", mediu: "productie" });
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };
  const forget = async () => {
    setBusy(true);
    try {
      await invoke("invoicing_key_forget");
      setSt(await invoke<Status>("invoicing_status"));
      setRun(null);
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };
  const read = async () => {
    setBusy(true);
    setErr(null);
    setRun(null);
    try {
      const de_la = Number(q.de_la);
      const pana_la = q.pana_la.trim() ? Number(q.pana_la) : undefined;
      setRun(await invoke<Run>("invoicing_read", { serie: q.serie, deLa: de_la, panaLa: pana_la }));
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
      setAt(null);
    }
  };
  const addAll = async () => {
    if (!run) return;
    setBusy(true);
    setErr(null);
    let added = 0;
    let there = 0;
    try {
      for (const f of run.facturi.filter((x) => x.pdf)) {
        const r = await api.moduleCall<{ exista: boolean }>(VAULT, "adauga", { name: `${f.serie} ${f.numar}.pdf`, data: f.pdf, cale: `Program de facturare online/${f.serie} ${f.numar}.pdf` });
        if (r.exista) there++;
        else added++;
      }
      const parts = [added === 1 ? "un document nou" : `${added} documente noi`];
      if (there) parts.push(there === 1 ? "unul era deja în depozit" : `${there} erau deja în depozit`);
      onAdded(parts.join(" · "));
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card online-invoicing" role="region" aria-label="Programul de facturare online">
      <h3>Din programul de facturare online</h3>
      <p className="muted small">
        Doar citire: aplicația cere fiecare factură (valoarea, cât s-a plătit și PDF-ul) și le pune în depozit. Nu emite, nu modifică și nu anulează
        nimic în program. Cererile pleacă doar când apeși tu, cu internetul pornit din Setări și cu programul aprobat în „Surse externe”.
      </p>
      {st && !st.configurat && (
        <form
          aria-label="Cheia programului"
          onSubmit={(e) => {
            e.preventDefault();
            void saveKey();
          }}
        >
          <p className="warn small">
            Cheia API a programului poate și anula sau șterge facturi acolo: păstreaz-o ca pe o parolă. K.G.B. o ține criptată doar pe acest calculator,
            pentru utilizatorul tău de Windows, n-o trimite pe alte calculatoare și n-o scrie în jurnal; o folosește doar pentru cererile de citire.
          </p>
          <div className="row wrap">
            <input aria-label="CUI-ul firmei din program" placeholder="CUI-ul firmei" value={key.cod_unic} onChange={(e) => setKey({ ...key, cod_unic: e.target.value })} size={14} />
            <input type="password" autoComplete="off" aria-label="Cheia API" placeholder="Cheia API (din program › Setări › Utilizatori)" value={key.cheie} onChange={(e) => setKey({ ...key, cheie: e.target.value })} size={32} />
            <input aria-label="Adresa aplicației (PlatformaUrl)" placeholder="Adresa aplicației (opțional)" value={key.platforma_url} onChange={(e) => setKey({ ...key, platforma_url: e.target.value })} size={24} />
            <select aria-label="Mediul" value={key.mediu} onChange={(e) => setKey({ ...key, mediu: e.target.value })}>
              <option value="productie">contul real</option>
              <option value="test">contul de test</option>
            </select>
            <button className="primary" disabled={busy || readOnly || !key.cod_unic.trim() || !key.cheie.trim()}>
              Păstrează cheia pe acest calculator
            </button>
          </div>
        </form>
      )}
      {st?.configurat && (
        <>
          <div className="row wrap small">
            <span className="muted">
              <span>Cheie pusă pentru CUI</span> <span className="no-i18n">{st.cod_unic}</span>
              {st.mediu === "test" && (
                <>
                  {" · "}
                  <span>contul de test</span>
                </>
              )}
            </span>
            <button className="link small" disabled={busy || readOnly} onClick={() => void forget()}>
              Șterge cheia de pe acest calculator
            </button>
          </div>
          <form
            className="row wrap"
            aria-label="Ce facturi citesc"
            onSubmit={(e) => {
              e.preventDefault();
              void read();
            }}
          >
            <input aria-label="Seria" placeholder="Seria" value={q.serie} onChange={(e) => setQ({ ...q, serie: e.target.value })} size={8} />
            <label className="small">
              de la nr. <input aria-label="De la numărul" value={q.de_la} onChange={(e) => setQ({ ...q, de_la: e.target.value.replace(/\D/g, "") })} size={6} />
            </label>
            <label className="small">
              până la nr. <input aria-label="Până la numărul" placeholder="gol = până se termină" value={q.pana_la} onChange={(e) => setQ({ ...q, pana_la: e.target.value.replace(/\D/g, "") })} size={14} />
            </label>
            <button className="primary" disabled={busy || readOnly || !q.serie.trim() || !q.de_la}>
              Citește facturile
            </button>
          </form>
          <p className="muted small">Câte o cerere pe secundă, cel mult 500 de numere o dată; fără „până la”, citirea se oprește după 5 numere la rând care nu există.</p>
        </>
      )}
      {busy && at !== null && (
        <p className="muted small" role="status">
          <span>Citesc numărul</span> <span className="no-i18n">{at}</span>…
        </p>
      )}
      {run && (
        <div>
          <p className="small">
            <span>{run.facturi.length === 1 ? "O factură găsită" : `${run.facturi.length} facturi găsite`}</span>
            {run.oprit && (
              <>
                {" · "}
                <span className="muted">oprit:</span> <span className="muted">{run.oprit}</span>
              </>
            )}
          </p>
          <ul className="plain small">
            {run.facturi.map((f) => (
              <li key={f.numar}>
                <b className="no-i18n">{`${f.serie} ${f.numar}`}</b>
                {f.valoare !== null && <span className="no-i18n">{` · ${money(f.valoare)} lei`}</span>}
                {f.achitat !== null && (
                  <>
                    {" · "}
                    <span className="muted">achitat</span> <span className="muted no-i18n">{money(f.achitat)}</span>
                  </>
                )}
                {!f.pdf && (
                  <>
                    {" · "}
                    <span className="muted">fără PDF:</span> <span className="muted">{f.nota}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
          <button className="primary" disabled={busy || readOnly || !run.facturi.some((f) => f.pdf)} onClick={() => void addAll()}>
            Pune PDF-urile în depozit
          </button>
        </div>
      )}
      {err && <p className="error">{err}</p>}
      <button disabled={busy} onClick={onClose}>
        Închide
      </button>
    </div>
  );
}
