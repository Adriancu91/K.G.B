// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { emptySheet, Sheet } from './format';
import { renameSheetInFormula } from './formula';

// Foile unui tabel (filele de jos, ca în Excel): nume, adăugare, mutare, ștergere.
// Numele urmează regulile Excel, ca fișierele exportate să se deschidă fără reparații.

export const MAX_SHEETS = 50;
export const MAX_NAME = 31;

const same = (a: string, b: string) => a.trim().toLocaleLowerCase('ro-RO') === b.trim().toLocaleLowerCase('ro-RO');

/** De ce nu e bun numele (sau null dacă e bun). `except` = poziția foii redenumite. */
export function sheetNameError(name: string, sheets: Sheet[], except = -1): string | null {
  const n = name.trim();
  if (!n) return 'Numele foii nu poate fi gol';
  if (n.length > MAX_NAME) return `Numele foii poate avea cel mult ${MAX_NAME} de caractere`;
  if (/[\\/?*:[\]]/.test(n)) return 'Numele foii nu poate conține \\ / ? * : [ ]';
  if (n.startsWith("'") || n.endsWith("'")) return 'Numele foii nu poate începe sau se termina cu apostrof';
  if (sheets.some((s, i) => i !== except && same(s.name, n))) return `Există deja o foaie numită „${n}”`;
  return null;
}

/** Numele implicit al foii N: „Foaia N” în română, „SheetN” în engleză (ca în programele cunoscute). */
export function sheetBaseName(n: number): string {
  return typeof document !== 'undefined' && document.documentElement.lang === 'en' ? `Sheet${n}` : `Foaia ${n}`;
}

/** „Foaia N” cu primul N liber. */
export function nextSheetName(sheets: Sheet[]): string {
  for (let n = sheets.length + 1; ; n++) {
    const name = sheetBaseName(n);
    if (!sheets.some((s) => same(s.name, name))) return name;
  }
}

/** Numele copiei: „Vânzări (2)”, „Vânzări (3)”… scurtat cât să încapă în 31 de caractere. */
export function copyName(name: string, sheets: Sheet[]): string {
  const base = name.replace(/ \(\d+\)$/, '');
  for (let n = 2; ; n++) {
    const tail = ` (${n})`;
    const cand = base.slice(0, MAX_NAME - tail.length) + tail;
    if (!sheets.some((s) => same(s.name, cand))) return cand;
  }
}

export function addSheet(sheets: Sheet[], at: number): { sheets: Sheet[]; active: number } {
  const next = [...sheets];
  next.splice(at + 1, 0, emptySheet(nextSheetName(sheets)));
  return { sheets: next, active: at + 1 };
}

export function duplicateSheet(sheets: Sheet[], i: number): { sheets: Sheet[]; active: number } {
  const copy: Sheet = JSON.parse(JSON.stringify(sheets[i]));
  copy.name = copyName(sheets[i].name, sheets);
  const next = [...sheets];
  next.splice(i + 1, 0, copy);
  return { sheets: next, active: i + 1 };
}

/** Redenumește foaia i; formulele din toate foile care o foloseau (=Vechi!A1) primesc numele nou. */
export function renameSheet(sheets: Sheet[], i: number, name: string): Sheet[] {
  const from = sheets[i].name;
  const to = name.trim();
  return sheets.map((s, j) => {
    let cells = s.cells;
    for (const [id, v] of Object.entries(s.cells)) {
      const nv = renameSheetInFormula(v, from, to);
      if (nv === v) continue;
      if (cells === s.cells) cells = { ...s.cells };
      cells[id] = nv;
    }
    // Graficele cu datele pe foaia redenumită își schimbă și ele foaia datelor.
    const charts = s.charts?.some((c) => c.src === from) ? s.charts.map((c) => (c.src === from ? { ...c, src: to } : c)) : s.charts;
    const next = charts === s.charts ? s : { ...s, charts };
    return j === i ? { ...next, name: to, cells } : cells === s.cells ? next : { ...next, cells };
  });
}

/** Mută foaia i cu `by` poziții (-1 = la stânga, 1 = la dreapta). */
export function moveSheet(sheets: Sheet[], i: number, by: number): { sheets: Sheet[]; active: number } {
  const to = Math.max(0, Math.min(sheets.length - 1, i + by));
  const next = [...sheets];
  const [s] = next.splice(i, 1);
  next.splice(to, 0, s);
  return { sheets: next, active: to };
}

/**
 * Mutare sau copiere: foaia i ajunge înaintea foii `before` (numărată în lista de acum; sheets.length = la sfârșit).
 * Cu `copy`, foaia rămâne pe loc și o copie a ei ajunge acolo.
 */
export function placeSheet(sheets: Sheet[], i: number, before: number, copy: boolean): { sheets: Sheet[]; active: number } {
  let list = sheets, from = i, b = before;
  if (copy) { const d = duplicateSheet(sheets, i); list = d.sheets; from = d.active; if (b > i) b++; }
  const s = list[from];
  const next = list.filter((_, j) => j !== from);
  const to = b > from ? b - 1 : b;
  next.splice(to, 0, s);
  return { sheets: next, active: to };
}

/** Șterge foaia i; trebuie să rămână cel puțin una. */
export function removeSheet(sheets: Sheet[], i: number): { sheets: Sheet[]; active: number } {
  if (sheets.length <= 1) return { sheets, active: 0 };
  const next = sheets.filter((_, j) => j !== i);
  return { sheets: next, active: Math.min(i, next.length - 1) };
}

export function sheetIsEmpty(s: Sheet): boolean {
  return !Object.keys(s.cells).length && !s.charts?.length;
}
