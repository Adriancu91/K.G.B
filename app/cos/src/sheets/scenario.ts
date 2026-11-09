// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Analiză „Ce-ar fi dacă” → Manager de scenarii (Scenario Manager, ca în Excel): seturi de valori cu nume pentru aceleași celule
// (de exemplu „Optimist”, „Pesimist”), puse în foaie cu un clic, plus un rezumat cu rezultatele fiecărui scenariu.

export interface SheetScenario {
  name: string;
  /** Celula schimbată → valoarea ei în scenariu (text sau număr, cum se scrie în celulă). */
  cells: Record<string, string>;
  note?: string;
}

/** Cele mai multe celule schimbate într-un scenariu (ca în Excel) și cele mai multe scenarii pe foaie. */
export const MAX_SC_CELLS = 32;
export const MAX_SCENARIOS = 100;

const CELL = /^[A-Z]{1,3}[1-9]\d{0,6}$/;

export function cleanScenarios(v: unknown): SheetScenario[] {
  if (!Array.isArray(v)) return [];
  const out: SheetScenario[] = [];
  for (const s of v) {
    if (!s || typeof s.name !== 'string' || !s.name.trim() || !s.cells || typeof s.cells !== 'object') continue;
    const cells = Object.fromEntries(Object.entries(s.cells as Record<string, unknown>)
      .filter(([k, x]) => CELL.test(k) && typeof x === 'string').slice(0, MAX_SC_CELLS)) as Record<string, string>;
    if (!Object.keys(cells).length) continue;
    out.push({ name: s.name.trim().slice(0, 255), cells, ...(typeof s.note === 'string' && s.note ? { note: s.note.slice(0, 255) } : {}) });
    if (out.length >= MAX_SCENARIOS) break;
  }
  return out;
}

/**
 * Celulele scrise de utilizator: „B1”, „B1:B3”, „B1;C4” sau „B1, C2:C3” (cu sau fără $). Întoarce lista în ordine
 * (fără dubluri) sau un mesaj de eroare.
 */
export function parseCellList(text: string, rows: number, cols: number): string[] | string {
  const parts = text.toUpperCase().replace(/\$/g, '').split(/[;,\s]+/).filter(Boolean);
  if (!parts.length) return 'Scrie celulele care se schimbă, de exemplu B1:B3.';
  const out: string[] = [];
  const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const colName = (c: number) => { let s = ''; for (c++; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };
  for (const p of parts) {
    const m = /^([A-Z]{1,3})(\d{1,7})(?::([A-Z]{1,3})(\d{1,7}))?$/.exec(p);
    if (!m) return `„${p}” nu e o celulă sau o zonă (de exemplu B1 sau B1:B3).`;
    const c0 = colNum(m[1]), r0 = +m[2] - 1, c1 = m[3] ? colNum(m[3]) : c0, r1 = m[4] ? +m[4] - 1 : r0;
    if (r0 < 0 || r1 < 0) return `„${p}” nu e o celulă.`;
    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++)
      for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) {
        if (r >= rows || c >= cols) return `„${p}” iese din foaie.`;
        const id = colName(c) + (r + 1);
        if (!out.includes(id)) out.push(id);
        if (out.length > MAX_SC_CELLS) return `Un scenariu poate schimba cel mult ${MAX_SC_CELLS} de celule.`;
      }
  }
  return out;
}

/**
 * Tabelul rezumatului (ca „Scenario Summary”): pe rânduri celulele schimbate, apoi celulele cu rezultate; pe coloane
 * valorile de acum și fiecare scenariu. `resultOf(over, id)` = textul celulei `id` când celulele din `over` au acele valori.
 */
export function scenarioSummary(list: SheetScenario[], current: (id: string) => string, results: string[],
  resultOf: (over: Record<string, string>, id: string) => string): string[][] {
  const changing: string[] = [];
  for (const s of list) for (const id of Object.keys(s.cells)) if (!changing.includes(id)) changing.push(id);
  const head = ['Rezumat scenarii', 'Valori actuale', ...list.map((s) => s.name)];
  const rows: string[][] = [head, ['Celule schimbate:', '', ...list.map(() => '')]];
  for (const id of changing) rows.push([id, current(id), ...list.map((s) => s.cells[id] ?? current(id))]);
  if (results.length) {
    rows.push(['Celule rezultat:', '', ...list.map(() => '')]);
    for (const id of results) rows.push([id, resultOf({}, id), ...list.map((s) => resultOf(s.cells, id))]);
  }
  return rows;
}
