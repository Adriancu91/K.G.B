// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { colName, COLS, LAST_COL, parseCellId, ROWS } from './format';
import { DefinedName, nameKey, sheetKey } from './formula';

// Caseta de nume (stânga barei de formule), ca în Excel: scrii „B12”, „A1:C5”, „Vânzări!D4”, „C:C”, „3:5” sau un nume definit
// și Enter te duce acolo; un nume nou scris cu o zonă selectată devine nume definit pentru zona aceea.

export interface GotoTarget {
  kind: 'go';
  /** Foaia, dacă e alta decât cea curentă (numele exact al foii din tabel). */
  sheet?: string;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}
export type GotoResult = GotoTarget | { kind: 'name'; name: string } | { kind: 'error'; msg: string };

const colNum = (s: string) => { let c = 0; for (const ch of s.toUpperCase()) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };

/** O zonă fără foaie: A1, $A$1, A1:C5, C:E, 3:5. */
function parseArea(t: string): Omit<GotoTarget, 'kind' | 'sheet'> | null {
  const s = t.replace(/\$/g, '').toUpperCase();
  let m = /^([A-Z]{1,3})(\d{1,7})(?::([A-Z]{1,3})(\d{1,7}))?$/.exec(s);
  if (m) {
    const a = parseCellId(m[1] + m[2])!;
    const b = m[3] ? parseCellId(m[3] + m[4])! : a;
    if (a.r < 0 || b.r < 0) return null;
    return { r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) };
  }
  m = /^([A-Z]{1,3}):([A-Z]{1,3})$/.exec(s);
  if (m) { const a = colNum(m[1]), b = colNum(m[2]); return { r0: 0, c0: Math.min(a, b), r1: ROWS - 1, c1: Math.max(a, b) }; }
  m = /^(\d{1,7}):(\d{1,7})$/.exec(s);
  if (m) { const a = +m[1] - 1, b = +m[2] - 1; if (a < 0 || b < 0) return null; return { r0: Math.min(a, b), c0: 0, r1: Math.max(a, b), c1: COLS - 1 }; }
  return null;
}

/** Desparte „'Foaia 1'!A1” / „Costuri!A1” în foaie și zonă. */
function splitSheet(t: string): { sheet?: string; area: string } {
  const q = /^'((?:[^']|'')+)'!(.+)$/.exec(t);
  if (q) return { sheet: q[1].replace(/''/g, "'"), area: q[2] };
  const i = t.lastIndexOf('!');
  return i > 0 ? { sheet: t.slice(0, i), area: t.slice(i + 1) } : { area: t };
}

export function parseGoto(text: string, sheets: string[], current: string, names: DefinedName[], depth = 0): GotoResult {
  const t = text.trim().replace(/^=/, '');
  if (!t) return { kind: 'error', msg: 'Scrie o celulă (B12), o zonă (A1:C5) sau un nume' };
  const { sheet, area } = splitSheet(t);
  const found = sheet === undefined ? undefined : sheets.find((s) => sheetKey(s) === sheetKey(sheet));
  if (sheet !== undefined && !found) return { kind: 'error', msg: `Nu există foaia „${sheet}”` };
  const a = parseArea(area);
  if (a) {
    if (a.c1 >= COLS || a.r1 >= ROWS) return { kind: 'error', msg: `Tabelul are ${COLS} de coloane (până la ${LAST_COL}) și ${ROWS.toLocaleString('ro-RO')} de rânduri` };
    return { kind: 'go', ...(found && sheetKey(found) !== sheetKey(current) ? { sheet: found } : {}), ...a };
  }
  if (sheet === undefined) {
    // Un nume definit: întâi cel al foii curente, apoi cel al întregului tabel.
    const k = nameKey(t);
    const d = names.find((n) => n.sheet !== undefined && sheetKey(n.sheet) === sheetKey(current) && nameKey(n.name) === k)
      ?? names.find((n) => n.sheet === undefined && nameKey(n.name) === k);
    if (d) {
      const r = depth < 3 ? parseGoto(d.ref, sheets, d.sheet ?? current, names, depth + 1) : null;
      if (r && r.kind === 'go') {
        // Zona numelui e pe foaia lui (sau pe foaia unde e definit numele local).
        const home = r.sheet ?? d.sheet ?? current;
        return { ...r, ...(sheetKey(home) !== sheetKey(current) ? { sheet: home } : {}) };
      }
      return { kind: 'error', msg: `Numele „${d.name}” nu arată spre o zonă de celule (=${d.ref})` };
    }
    if (/^[\p{L}_][\p{L}\d_.]*$/u.test(t) && !/^(TRUE|FALSE|ADEVARAT|ADEVĂRAT|FALS)$/i.test(t) && !/^[A-Z]{1,3}\d+$/i.test(t) && !/^R\d*C\d*$/i.test(t)) {
      return { kind: 'name', name: t };
    }
  }
  return { kind: 'error', msg: `„${t}” nu e o celulă, o zonă sau un nume` };
}

/** Un text din capul de tabel făcut nume bun pentru formule, ca în Excel: „Preț unitar” → „Preț_unitar”, „2026” → „_2026”. */
export function cleanName(text: string): string | null {
  let n = text.trim().replace(/[^\p{L}\d_.]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 255);
  if (!n) return null;
  if (!/^[\p{L}_]/u.test(n)) n = '_' + n;
  // Un nume care arată ca o celulă (TVA1, R1C1) sau ca ADEVĂRAT / FALS primește „_” la final.
  if (/^[A-Z]{1,3}\d+$/i.test(n) || /^R\d*C\d*$/i.test(n) || /^(TRUE|FALSE|ADEVARAT|ADEVĂRAT|FALS)$/i.test(n)) n += '_';
  return n;
}

/**
 * Creează din selecție (ca în Excel): textele din primul rând numesc coloanele de sub ele („top”) sau textele din prima coloană
 * numesc rândurile din dreapta lor („left”). Numele care există deja se sar (le întoarce separat).
 */
export function namesFromRange(
  g: { r0: number; c0: number; r1: number; c1: number }, where: 'top' | 'left', sheetRefText: string,
  text: (r: number, c: number) => string, existing: DefinedName[],
): { add: DefinedName[]; skipped: string[] } {
  const abs = (r: number, c: number) => `$${colName(c)}$${r + 1}`;
  const add: DefinedName[] = [];
  const skipped: string[] = [];
  const taken = new Set(existing.filter((d) => d.sheet === undefined).map((d) => nameKey(d.name)));
  const lines = where === 'top' ? [g.c0, g.c1] : [g.r0, g.r1];
  for (let k = lines[0]; k <= lines[1]; k++) {
    const name = cleanName(where === 'top' ? text(g.r0, k) : text(k, g.c0));
    if (!name) continue;
    if (taken.has(nameKey(name))) { skipped.push(name); continue; }
    if (where === 'top' ? g.r1 <= g.r0 : g.c1 <= g.c0) continue;
    const ref = where === 'top' ? `${abs(g.r0 + 1, k)}:${abs(g.r1, k)}` : `${abs(k, g.c0 + 1)}:${abs(k, g.c1)}`;
    taken.add(nameKey(name));
    add.push({ name, ref: `${sheetRefText}!${ref.split(':')[0] === ref.split(':')[1] ? ref.split(':')[0] : ref}` });
  }
  return { add, skipped };
}

