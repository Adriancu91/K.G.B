// The partner of a contract among the partners of Business (modules do not call each other, so the page matches
// them): by CUI, compared as kgb_core::ids does — without whitespace anywhere, upper-case, without „RO” in front.
// A partner without CUI (a person) is matched by its name, letters folded; when nothing matches, the page asks to
// add it in Business.

/** The CUI as compared: no whitespace, upper-case, no „RO” in front. */
export function cuiKey(code: string | null | undefined): string {
  const s = (code ?? "").replace(/\s+/g, "").toUpperCase();
  return s.startsWith("RO") ? s.slice(2) : s;
}

const fold = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();

export function findBusinessPartner<P extends { nume: string; cui: string | null }>(partners: P[], cui: string, name: string): P | undefined {
  const key = cuiKey(cui);
  if (key) return partners.find((p) => cuiKey(p.cui) === key);
  const n = fold(name);
  return n ? partners.find((p) => !cuiKey(p.cui) && fold(p.nume) === n) : undefined;
}
