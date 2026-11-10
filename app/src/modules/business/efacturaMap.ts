// e-Factura of an issued invoice (7.4m-3, D-082): the invoice of Business, as the core keeps it, becomes the
// invoice of the COS code (cos/src/sheets/efacturaOut.ts, unchanged: the same checks and the same XML as the
// spreadsheet window's „Export e-Factura (XML)”). Only a file is written; the owner uploads it in SPV.
// What Business does not keep in pieces (street / locality / county, the unit codes of e-Factura) the person
// completes in the dialog; splitAddress only proposes it.
import {
  UNIT_CODES,
  countyCode,
  invoiceTotals,
  invoiceUbl,
  validateInvoice,
  type InvoiceIn,
  type PartyIn,
  type VatRate,
} from "../../../cos/src/sheets/efacturaOut";

/** An issued invoice as `invoices` returns it (money in bani, quantities in thousandths). */
export interface IssuedInvoice {
  id: string;
  serie: string;
  numar: number;
  data: string;
  scadenta: string | null;
  client: { nume: string; cui: string; reg_com: string; adresa: string };
  furnizor: Record<string, string>;
  linii: {
    descriere: string;
    um: string;
    cantitate: number;
    pret_unitar: number;
    cota_tva: number;
    valoare: number;
    tva: number;
  }[];
  total_fara_tva: number;
  total_tva: number;
  total: number;
  storno_de: string | null;
  nota?: string | null;
}

export interface Place {
  street: string;
  city: string;
  county: string;
  postal: string;
}

const STREET =
  /^(str\.?|strada|bd\.?|b-dul|bulevardul|calea|șos\.?|sos\.?|șoseaua|soseaua|aleea|piața|piata|intrarea|splaiul|nr\.?)\s/i;

/** „Str. Lăpușneanu 1, Iași, jud. Iași, 700057” → its pieces, as far as they can be told apart. */
export function splitAddress(address: string): Place {
  const parts = address
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: Place = { street: "", city: "", county: "", postal: "" };
  const street: string[] = [];
  for (const p of parts) {
    if (!out.postal && /^\d{6}$/.test(p)) out.postal = p;
    else if (!out.county && /^jud(e[tț]ul)?\.?\s/i.test(p))
      out.county = p.replace(/^jud(e[tț]ul)?\.?\s*/i, "");
    else if (!out.city && /^sector\s*[1-6]$/i.test(p)) {
      out.city = p.replace(/^sector\s*/i, "Sector ");
      if (!out.county) out.county = "București";
    } else if (/^(municipiul\s+|mun\.\s*)?bucure[sș]ti$/i.test(p)) {
      if (!out.county) out.county = "București";
    } else if (!out.city && !STREET.test(p) && !/\d/.test(p))
      out.city = p.replace(
        /^(municipiul|mun\.|orașul|oras|or\.|comuna|com\.|satul|sat)\s*/i,
        "",
      );
    else street.push(p);
  }
  out.street = street.join(", ");
  // A county town named like its county (Iași, Cluj → Cluj-Napoca is not, but „Cluj” is understood).
  if (!out.county && out.city && countyCode(out.city)) out.county = out.city;
  return out;
}

const compact = (s: string) => s.replace(/\s+/g, "").toUpperCase();
/** The units of the invoice that e-Factura does not know (the person picks one for each). */
export const unknownUnits = (f: IssuedInvoice): string[] => [
  ...new Set(
    f.linii.map((l) => l.um.trim()).filter((u) => !UNIT_CODES[u.toLowerCase()]),
  ),
];
export const KNOWN_UNITS = Object.keys(UNIT_CODES);

/** The COS invoice: the parties as they were at issue, every amount from bani / thousandths. */
export function toInvoiceIn(
  f: IssuedInvoice,
  places: { supplier: Place; customer: Place },
  units: Record<string, string> = {},
): InvoiceIn {
  const s = f.furnizor;
  const party = (
    name: string,
    cui: string,
    regCom: string,
    p: Place,
    extra: Partial<PartyIn> = {},
  ): PartyIn => ({
    name: name.trim(),
    cui: compact(cui),
    vatPayer: compact(cui).startsWith("RO"),
    regCom: regCom.trim() || undefined,
    street: p.street,
    city: p.city,
    county: p.county,
    postal: p.postal || undefined,
    ...extra,
  });
  return {
    series: f.serie,
    number: String(f.numar),
    issueDate: f.data,
    dueDate: f.scadenta ?? undefined,
    supplier: party(
      s.firma_nume ?? "",
      s.firma_cui ?? "",
      s.firma_reg_com ?? "",
      places.supplier,
      {
        iban: s.firma_iban?.trim() || undefined,
        bank: s.firma_banca?.trim() || undefined,
        email: s.firma_email?.trim() || undefined,
      },
    ),
    customer: party(
      f.client.nume,
      f.client.cui ?? "",
      f.client.reg_com ?? "",
      places.customer,
    ),
    lines: f.linii.map((l) => ({
      name: l.descriere,
      unit: units[l.um.trim()] ?? l.um.trim(),
      qty: l.cantitate / 1000,
      price: l.pret_unitar / 100,
      vat: l.cota_tva as VatRate,
    })),
    notes: f.nota?.trim() ? [f.nota.trim()] : [],
  };
}

const lei = (bani: number) => (bani / 100).toFixed(2).replace(".", ",");

/**
 * The e-Factura sums are the standard's (VAT per rate, rounded once); Business rounds VAT per line (D-049). When
 * the two differ the file would not match the issued invoice, so it is not written.
 */
export function totalsDiffer(inv: InvoiceIn, f: IssuedInvoice): string | null {
  const t = invoiceTotals(inv);
  const [gn, gv, gt] = [
    Math.round(t.net * 100),
    Math.round(t.vatSum * 100),
    Math.round(t.gross * 100),
  ] as const;
  if (gn === f.total_fara_tva && gv === f.total_tva && gt === f.total)
    return null;
  return (
    `Sumele din e-Factura (fără TVA ${lei(gn)}, TVA ${lei(gv)}, total ${lei(gt)}) diferă de cele ale facturii (fără TVA ${lei(f.total_fara_tva)}, TVA ${lei(f.total_tva)}, total ${lei(f.total)}): în e-Factura TVA-ul se calculează pe fiecare cotă, iar factura l-a rotunjit pe fiecare linie. Fișierul nu se scrie; întreabă contabilul cum se corectează factura.`
  );
}

/** The XML, or what has to be completed first (the COS checks, then the sums). */
export function buildEfactura(
  f: IssuedInvoice,
  places: { supplier: Place; customer: Place },
  units: Record<string, string> = {},
): { xml: string | null; errors: string[] } {
  const inv = toInvoiceIn(f, places, units);
  const errors = validateInvoice(inv);
  if (errors.length) return { xml: null, errors };
  const diff = totalsDiffer(inv, f);
  if (diff) return { xml: null, errors: [diff] };
  return { xml: invoiceUbl(inv), errors: [] };
}
