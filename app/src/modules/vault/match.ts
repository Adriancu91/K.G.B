// The duplicate check between the vault and Business (7.10d, D-089): modules do not call each other, so the page
// compares the invoices with the same rules as the vault (modules/kgb-vault): the key is issuer CUI (no „RO”, no
// spaces) + series + number (upper-case, letters and digits, the number without leading zeros); with the same key,
// the same date and total (where both are known) is surely the same invoice, otherwise „posibil dublură”.
import { cuiKey } from "../contracts/cui";

export interface Inv {
  emitent_cui: string;
  serie: string;
  numar: string;
  data: string;
  total: number | null;
}

/** „KGB 0012” → ["KGB", "12"]: the trailing digits are the number, what is before them the series. */
export function splitNumber(raw: string, hint = ""): [string, string] {
  const t = raw.trim().toUpperCase();
  const m = /(\d+)$/.exec(t);
  const alnum = (x: string) => x.replace(/[^\p{L}\p{N}]/gu, "");
  const digits = m ? m[1]! : "";
  const number = digits ? digits.replace(/^0+/, "") || "0" : "";
  const series = alnum(t.slice(0, t.length - digits.length)) || alnum(hint).toUpperCase();
  return [series, number];
}

export const keyOf = (i: Inv): string | null => (i.numar && i.emitent_cui ? `${i.emitent_cui}|${i.serie}|${i.numar}` : null);
export const sameInvoice = (a: Inv, b: Inv) => (!a.data || !b.data || a.data === b.data) && (a.total === null || b.total === null || a.total === b.total);

/** An invoice issued in Business: the issuer is the firm. */
export function fromIssued(x: { serie: string; numar: number | string; data: string; total: number }, firmCui: string): Inv {
  const [serie, numar] = splitNumber(`${x.serie} ${x.numar}`);
  return { emitent_cui: cuiKey(firmCui), serie, numar, data: x.data, total: x.total };
}

/** A purchase (or an expense) recorded in Business, maybe from e-Factura. */
export function fromPurchase(x: { furnizor_cui?: string | null; numar: string; data: string; total: number }): Inv {
  const [serie, numar] = splitNumber(x.numar);
  return { emitent_cui: cuiKey(x.furnizor_cui ?? ""), serie, numar, data: x.data, total: x.total };
}

export interface Match {
  where: string;
  sure: boolean;
  /** What differs, for „posibil dublură”: the other invoice's date and / or total (this one's are the vault's). */
  otherDate?: string;
  otherTotal?: number;
}

/** A match with what differs. */
export function compared(inv: Inv, other: Inv, where: string): Match {
  const m: Match = { where, sure: sameInvoice(inv, other) };
  if (inv.data && other.data && inv.data !== other.data) m.otherDate = other.data;
  if (inv.total !== null && other.total !== null && inv.total !== other.total) m.otherTotal = other.total;
  return m;
}

/** Where else an invoice of the vault is: each place with whether it is surely the same invoice. */
export function matchesOf(inv: Inv, others: Array<{ inv: Inv; where: string }>): Match[] {
  const k = keyOf(inv);
  if (!k) return [];
  return others.filter((o) => keyOf(o.inv) === k).map((o) => compared(inv, o.inv, o.where));
}
