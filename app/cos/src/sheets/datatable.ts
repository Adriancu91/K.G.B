// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Analiză „Ce-ar fi dacă” → Tabel de date (Data Table, ca în Excel): aceeași formulă calculată pentru mai multe valori
// ale uneia sau a două celule de intrare (de exemplu rata lunară pentru dobânzi de 4%, 5%, 6% și perioade de 10, 20, 30 de ani).
// Zona aleasă are forma din Excel:
// - cu o variabilă, pe coloană: valorile în prima coloană (sub primul rând), formulele în primul rând (la dreapta primei celule);
// - cu o variabilă, pe rând: valorile în primul rând, formulele în prima coloană;
// - cu două variabile: formula în colțul din stânga sus, valorile pentru „celula din rând” în primul rând, pentru „celula din coloană” în prima coloană.
// Rezultatul se scrie ca valori (nu se recalculează singur; se reface din fereastră).

export interface DTZone { r0: number; c0: number; r1: number; c1: number }

/** Ce trebuie calculat: pentru fiecare celulă de rezultat, ce formulă și ce valori primesc celulele de intrare. */
export interface DTJob { r: number; c: number; formula: { r: number; c: number }; inputs: { cell: string; value: { r: number; c: number } }[] }

/** Cele mai multe celule calculate dintr-o dată (fiecare cere o recalculare). */
export const MAX_DT_CELLS = 5000;

/**
 * Hotărăște ce se calculează. `rowInput` = celula care primește valorile din primul rând, `colInput` = cea care primește
 * valorile din prima coloană. Întoarce lista de lucru sau un mesaj de eroare (în română).
 */
export function planDataTable(z: DTZone, rowInput: string | null, colInput: string | null): DTJob[] | string {
  if (!rowInput && !colInput) return 'Scrie cel puțin o celulă de intrare (din rând sau din coloană).';
  if (z.r1 <= z.r0 || z.c1 <= z.c0) return 'Selectează o zonă de cel puțin 2 × 2 celule: valorile pe margine și formula sus sau în stânga.';
  const jobs: DTJob[] = [];
  if (rowInput && colInput) {
    // Două variabile: o singură formulă, în colț.
    for (let r = z.r0 + 1; r <= z.r1; r++)
      for (let c = z.c0 + 1; c <= z.c1; c++)
        jobs.push({ r, c, formula: { r: z.r0, c: z.c0 }, inputs: [{ cell: rowInput, value: { r: z.r0, c } }, { cell: colInput, value: { r, c: z.c0 } }] });
  } else if (colInput) {
    // Valorile pe coloană (prima coloană), formulele în primul rând.
    for (let r = z.r0 + 1; r <= z.r1; r++)
      for (let c = z.c0 + 1; c <= z.c1; c++)
        jobs.push({ r, c, formula: { r: z.r0, c }, inputs: [{ cell: colInput, value: { r, c: z.c0 } }] });
  } else {
    // Valorile pe rând (primul rând), formulele în prima coloană.
    for (let r = z.r0 + 1; r <= z.r1; r++)
      for (let c = z.c0 + 1; c <= z.c1; c++)
        jobs.push({ r, c, formula: { r, c: z.c0 }, inputs: [{ cell: rowInput!, value: { r: z.r0, c } }] });
  }
  if (jobs.length > MAX_DT_CELLS) return `Zona e prea mare: ${jobs.length} de celule de calculat (cel mult ${MAX_DT_CELLS}).`;
  return jobs;
}

/**
 * Tabelul de date păstrat în foaie, ca rezultatele să se recalculeze singure când se schimbă formula sau datele ei:
 * zona (D1:E4) și celulele de intrare (din rând / din coloană).
 */
export interface SheetDataTable { zone: string; row?: string; col?: string }

/** Cel mult atâtea tabele de date într-o foaie. */
export const MAX_DATA_TABLES = 20;

const CELL = /^[A-Z]{1,3}[1-9]\d{0,6}$/;

/** Tabelele de date bune dintr-un fișier (zonă A1:B2 și cel puțin o celulă de intrare). */
export function cleanDataTables(v: unknown): SheetDataTable[] {
  if (!Array.isArray(v)) return [];
  const out: SheetDataTable[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const { zone, row, col } = x as Record<string, unknown>;
    if (typeof zone !== 'string' || !/^[A-Z]{1,3}[1-9]\d{0,6}:[A-Z]{1,3}[1-9]\d{0,6}$/.test(zone)) continue;
    const r = typeof row === 'string' && CELL.test(row) ? row : undefined;
    const c = typeof col === 'string' && CELL.test(col) ? col : undefined;
    if (!r && !c) continue;
    out.push({ zone, ...(r ? { row: r } : {}), ...(c ? { col: c } : {}) });
    if (out.length >= MAX_DATA_TABLES) break;
  }
  return out;
}
