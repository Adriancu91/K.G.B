// Suggestions while typing a client's or supplier's data (Etapa 7, step 7.4c).
// They come from the partner directory and from documents filled in before,
// only from this workspace. One click fills every field of that partner,
// including the ones added by hand (work point, licences, authorizations);
// anything can still be corrected or completed by hand afterwards.
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { Partner } from "../pages/PartnersPage";
import { isoToday } from "./AnafLookup";

/** Field roots in document models that name a party (`client`, `client.cui`…). */
export const PARTY_ROOTS = ["client", "furnizor", "beneficiar", "prestator", "cumparator", "vanzator", "partener", "transportator", "chirias", "locator"];

/** The party a model field belongs to, or null (`client.cui` → `client`). */
export const partyOf = (camp: string) => {
  const root = camp.split(".")[0] ?? "";
  return PARTY_ROOTS.includes(root) ? root : null;
};

export const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .trim();

/** Model sub-field → card field. Anything else goes to the card's extra fields. */
const ALIASES: Record<string, keyof Partner> = {
  "": "denumire",
  nume: "denumire",
  denumire: "denumire",
  cui: "cui",
  cif: "cui",
  reg_com: "nr_reg_com",
  nr_reg_com: "nr_reg_com",
  sediu: "sediu",
  localitate: "localitate",
  oras: "localitate",
  judet: "judet",
  tara: "tara",
  telefon: "telefon",
  email: "email",
  iban: "iban",
  cont: "iban",
  banca: "banca",
  reprezentant: "reprezentant",
  functie_reprezentant: "functie_reprezentant",
  functie: "functie_reprezentant",
};
const ADDRESS = ["adresa", "adresa_sediu"];
const WORK_POINT = ["punct_lucru", "punct_de_lucru", "adresa_punct_lucru"];

export const fullCardAddress = (p: Pick<Partner, "sediu" | "localitate" | "judet">) =>
  [p.sediu, p.localitate, p.judet ? `jud. ${p.judet}` : ""].filter((x) => x?.trim()).join(", ");

const sub = (camp: string) => camp.split(".").slice(1).join(".");
const label = (s: string) => s.replace(/_/g, " ");

/** The values for a party's fields (`camps`) taken from a card. */
export function cardToParty(p: Partner, camps: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const camp of camps) {
    const k = sub(camp);
    let v = "";
    const alias = ALIASES[k];
    if (alias) v = String(p[alias] ?? "");
    else if (ADDRESS.includes(k)) v = fullCardAddress(p);
    else if (WORK_POINT.includes(k)) v = p.puncte_lucru[0] ? [p.puncte_lucru[0].denumire, p.puncte_lucru[0].adresa].filter(Boolean).join(", ") : "";
    else v = p.campuri.find((c) => fold(c.nume) === fold(label(k)))?.valoare ?? "";
    if (v) out[camp] = v;
  }
  return out;
}

/** A card made from a party's values in a form (for "remember" and past documents). */
export function partyToCard(root: string, vals: Record<string, string>): Partner {
  const p: Partner = {
    version: 0,
    tip: root === "furnizor" || root === "prestator" || root === "vanzator" ? "furnizor" : "client",
    denumire: "",
    cui: "",
    nr_reg_com: "",
    sediu: "",
    localitate: "",
    judet: "",
    tara: "",
    telefon: "",
    email: "",
    iban: "",
    banca: "",
    reprezentant: "",
    functie_reprezentant: "",
    platitor_tva: null,
    note: "",
    puncte_lucru: [],
    documente: [],
    campuri: [],
    surse: {},
    activ: true,
  };
  for (const [camp, raw] of Object.entries(vals)) {
    const v = raw.trim();
    if (!v || partyOf(camp) !== root) continue;
    const k = sub(camp);
    const alias = ALIASES[k];
    if (alias) (p as unknown as Record<string, string>)[alias] = v;
    else if (ADDRESS.includes(k)) p.sediu = v;
    else if (WORK_POINT.includes(k)) p.puncte_lucru.push({ denumire: "", adresa: v, contact: "" });
    else p.campuri.push({ nume: label(k), valoare: v });
  }
  return p;
}

export interface Suggestion {
  card: Partner;
  from: "agenda" | "document";
}

/** Does a card match what is typed (start of a word of any value, no diacritics)? */
export function matches(p: Partner, q: string) {
  const f = fold(q);
  if (!f) return false;
  const values = [p.denumire, p.cui, p.nr_reg_com, p.sediu, p.localitate, p.telefon, p.email, p.reprezentant, ...p.campuri.map((c) => c.valoare)];
  return values.some((v) => fold(v ?? "").split(/[^\p{L}\p{N}]+/u).some((w) => w && w.startsWith(f)) || fold(v ?? "").startsWith(f));
}

/** An input that offers partners while typing. */
export function SuggestInput(props: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Partner) => void;
  ariaLabel: string;
  placeholder?: string;
  maxLength?: number;
  /** Extra suggestions (e.g. from documents filled in before). */
  extra?: (q: string) => Partner[];
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const typed = useRef(false);
  const { value, extra } = props;
  useEffect(() => {
    if (!typed.current || fold(value).length < 2) {
      setItems([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      invoke<{ items: Partner[] }>("partners_list", { cauta: value, inactivi: false, azi: isoToday() })
        .then((r) => r.items)
        .catch(() => [] as Partner[])
        .then((cards) => {
          if (!live) return;
          const seen = new Set(cards.map((c) => fold(c.denumire)));
          const fromDocs = (extra?.(value) ?? []).filter((c) => c.denumire && !seen.has(fold(c.denumire)));
          setItems([...cards.slice(0, 6).map((card) => ({ card, from: "agenda" as const })), ...fromDocs.slice(0, 4).map((card) => ({ card, from: "document" as const }))]);
          setOpen(true);
        });
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value, extra]);
  return (
    <span className="suggest">
      <input
        aria-label={props.ariaLabel}
        aria-autocomplete="list"
        placeholder={props.placeholder}
        value={value}
        maxLength={props.maxLength}
        autoComplete="off"
        onChange={(e) => {
          typed.current = true;
          props.onChange(e.target.value);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      {open && items.length > 0 && (
        <ul className="suggest-list" role="listbox" aria-label="Sugestii de parteneri">
          {items.map((s, i) => (
            <li key={i} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  typed.current = false;
                  setOpen(false);
                  props.onPick(s.card);
                }}
              >
                <strong>{s.card.denumire}</strong>
                <span className="muted">
                  {[s.card.cui, s.card.localitate].filter(Boolean).join(" · ")} {s.from === "agenda" ? "· din agendă" : "· dintr-un document"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** Keeps what a form had in the directory; returns a short note, or null. */
export async function rememberPartner(card: Partner, sursa: "document" | "business"): Promise<string | null> {
  if (!card.denumire.trim()) return null;
  try {
    const r = await invoke<{ noua: boolean; completate: string[]; diferite: string[] } | null>("partner_remember", { partner: card, sursa, azi: isoToday() });
    if (!r) return null;
    const parts: string[] = [];
    if (r.noua) parts.push(`„${card.denumire}” a fost adăugat în agenda de parteneri`);
    else if (r.completate.length) parts.push(`fișa „${card.denumire}” a fost completată (${r.completate.length} câmpuri)`);
    if (r.diferite.length) parts.push(`la ${r.diferite.length} câmpuri fișa are altă valoare și a rămas neschimbată (o modifici din „Parteneri”)`);
    return parts.length ? parts.join("; ") + "." : null;
  } catch (e) {
    return `Agenda de parteneri nu a fost actualizată: ${String(e)}`;
  }
}
