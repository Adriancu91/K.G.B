// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Completarea automată din coloană (ca AutoComplete din Excel): cât scrii text într-o celulă, dacă începutul se potrivește
// cu un singur text deja scris în aceeași coloană (în blocul de celule pline de deasupra și de dedesubt), restul apare
// selectat; Enter îl primește, o literă nouă scrie peste el, Backspace îl scoate. Testat în tests/sheets-autocomplete.test.mjs.

/** Textele din coloana c, în blocul de celule pline lipit de rândul r (fără rândul r, fără formule și numere). */
export function columnTexts(get: (r: number, c: number) => string | undefined, r: number, c: number, rows: number, max = 2000): string[] {
  const out = new Set<string>();
  const take = (v: string | undefined) => {
    if (!v || v.startsWith('=') || !/\p{L}/u.test(v) || v.includes('\n')) return;
    out.add(v.startsWith("'") ? v.slice(1) : v);
  };
  for (let i = r - 1, n = 0; i >= 0 && n < max; i--, n++) { const v = get(i, c); if (!v) break; take(v); }
  for (let i = r + 1, n = 0; i < rows && n < max; i++, n++) { const v = get(i, c); if (!v) break; take(v); }
  return [...out];
}

/**
 * Textul completat pentru ce s-a scris (`typed`), sau null: doar când un singur text din listă începe la fel
 * (fără să țină cont de literele mari / mici) și e mai lung. Numerele și formulele nu se completează.
 */
export function autoComplete(typed: string, texts: string[]): string | null {
  if (!typed || typed.startsWith('=') || !/\p{L}/u.test(typed)) return null;
  const low = typed.toLocaleLowerCase('ro');
  let found: string | null = null;
  for (const t of texts) {
    if (t.length <= typed.length || !t.toLocaleLowerCase('ro').startsWith(low)) continue;
    // Două texte diferite cu același început: nu ghicim (ca în Excel), așteptăm încă o literă.
    if (found !== null && found.toLocaleLowerCase('ro') !== t.toLocaleLowerCase('ro')) return null;
    found = t;
  }
  // Un text din listă egal cu ce ai scris (de exemplu „Ion” când există și „Ion Popescu”): nu completăm.
  if (found && texts.some((t) => t.toLocaleLowerCase('ro') === low)) return null;
  return found === null ? null : typed + found.slice(typed.length);
}
