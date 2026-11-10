// "Caută la ANAF" (Etapa 7, step 7.4b): fills a form from the free public
// ANAF service by CUI. Works only while the ANAF source is switched on in
// "Surse externe"; otherwise, or without internet, the form is filled by hand.
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { message, type Source } from "../api";
import { Confirm } from "./Confirm";

/** The address of the ANAF service, as the register knows its source (kgb_core::anaf::ANAF_URL). */
const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";

export interface AnafCompany {
  cui: string;
  denumire: string;
  nr_reg_com: string;
  sediu: string;
  localitate: string;
  judet: string;
  cod_postal: string;
  telefon: string;
  cod_caen: string;
  stare: string;
  platitor_tva: boolean;
  tva_la_incasare: boolean;
  inactiv: boolean;
  radiat: boolean;
  e_factura: boolean;
  iban: string;
  data: string;
}

export const isoToday = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** The registered office in one line: street, town, county. */
export const fullAddress = (c: AnafCompany) =>
  [c.sediu, c.localitate, c.judet ? `jud. ${c.judet}` : ""].filter((x) => x.trim()).join(", ");

/** What to tell the user beside the filled form (inactive, struck off, VAT). */
export function anafNotes(c: AnafCompany): string {
  const n: string[] = [];
  if (c.radiat) n.push("ATENȚIE: firma e radiată");
  else if (c.inactiv) n.push("ATENȚIE: firma e declarată inactivă fiscal");
  n.push(c.platitor_tva ? "plătitoare de TVA" : "neplătitoare de TVA");
  if (c.tva_la_incasare) n.push("TVA la încasare");
  if (c.e_factura) n.push("în Registrul RO e-Factura");
  return n.join(" · ");
}

export function AnafLookup({ cui, onFound }: { cui: string; onFound: (c: AnafCompany) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // The ANAF source switched off or not yet in the register: it can be switched on here, after its terms are shown
  // (the same as in „Surse externe”; D-063: the owner approves it).
  const [enable, setEnable] = useState<Source | null>(null);
  const lookup = () => {
    setBusy(true);
    setNote(null);
    invoke<AnafCompany>("anaf_lookup", { cui, azi: isoToday() })
      .then((c) => {
        onFound(c);
        setNote({ ok: true, text: `Completat de la ANAF (date pentru ${c.data || isoToday()}): ${anafNotes(c)}. Verifică și completează restul de mână.` });
      })
      .catch((e) => setNote({ ok: false, text: message(e) }))
      .finally(() => setBusy(false));
  };
  const offerSource = () =>
    void invoke<{ items: Source[] }>("sources_list").then(
      (r) => {
        const s = r.items.find((x) => x.url === ANAF_URL);
        if (s) setEnable(s);
        else setNote({ ok: false, text: "Sursa ANAF o poate porni doar un administrator, din „Surse externe”." });
      },
      (e: unknown) => setNote({ ok: false, text: message(e) }),
    );
  const sourceOff = !!note && !note.ok && note.text.includes("Surse externe");
  return (
    <span className="anaf-lookup">
      <button
        type="button"
        disabled={busy || !cui.trim()}
        title="Completează datele firmei din serviciul public ANAF (doar CUI-ul și data se trimit)"
        onClick={lookup}
      >
        {busy ? "Caut la ANAF…" : "Caută la ANAF"}
      </button>
      {note && (
        <span className={note.ok ? "anaf-note" : "anaf-note error"} role={note.ok ? "status" : "alert"}>
          {note.text}
        </span>
      )}
      {sourceOff && (
        <button type="button" className="link" onClick={offerSource}>
          Pornește sursa ANAF…
        </button>
      )}
      {enable && (
        <Confirm
          title="Pornești sursa ANAF?"
          confirmLabel="Pornește și caută"
          onCancel={() => setEnable(null)}
          onConfirm={() => {
            const s = enable;
            setEnable(null);
            void invoke("source_set_active", { id: s.id, active: true }).then(lookup, (e: unknown) => setNote({ ok: false, text: message(e) }));
          }}
        >
          <p>
            „Caută la ANAF” folosește serviciul web public și gratuit al ANAF. Se trimit doar CUI-ul și data; răspunsul completează
            datele firmei. O poți opri oricând din „Surse externe”.
          </p>
          <p className="muted small">{s_terms(enable)}</p>
        </Confirm>
      )}
    </span>
  );
}

const s_terms = (s: Source) => [s.termeni, s.licenta ? `Licență: ${s.licenta}` : "", s.verificat ? `Condiții verificate: ${s.verificat}` : ""].filter(Boolean).join(" · ");
