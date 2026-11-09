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
  tip: "receptie" | "document" | "extras";
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

const KIND: Record<Received["tip"], string> = { receptie: "Fișă de recepție", document: "Documente de la șofer", extras: "Extras de cont" };
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
  const ready = wh && pick.every((p) => p) && price.every((p) => p.trim());
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
          Fă recepția în Business…
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
              <input aria-label={`Prețul liniei ${n + 1}`} placeholder="Preț unitar (lei)" size={12} value={price[n]} onChange={(e) => setPrice(price.map((p, j) => (j === n ? e.target.value : p)))} />
            </div>
          ))}
          <div className="row">
            <button
              className="primary"
              disabled={!ready}
              onClick={() =>
                void (async () => {
                  try {
                    const d = new Date();
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
              Înregistrează recepția
            </button>
            <button onClick={() => setOpen(false)}>Renunță</button>
          </div>
          <p className="muted small">Produsul se alege din Business pentru fiecare linie (cel recunoscut pe telefon e deja ales); prețurile se scriu aici, nu pe telefon.</p>
        </div>
      )}
    </>
  );
}

export function PhonePage({ modules, onError }: { modules: ModulesReply; onError: (e: string | null) => void }) {
  const [r, setR] = useState<Reply | null>(null);
  const [who, setWho] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
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
    if (business) void api.moduleCall<Account[]>("kgb.business", "accounts").then((a) => setAccounts(a.filter((x) => x.tip === "banca")), () => setAccounts([]));
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
            {Object.entries(x.campuri).map(([k, v]) => (
              <div key={k} className="small">
                <span className="muted">{FIELD[k] ?? k}:</span> {v}
              </div>
            ))}
            <div className="row wrap">
              {x.fisiere.map((f) => (
                <FileView key={f.id} f={f} />
              ))}
            </div>
            <ReceptionLines x={x} business={business} onDone={(m) => void load().then(() => setNotice(m))} onError={onError} />
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
