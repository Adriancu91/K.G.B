// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Gruparea rândurilor și coloanelor (ca Group / Ungroup și schița din Excel): fiecare rând sau coloană are un nivel (1–7),
// rândurile vecine cu nivel cel puțin L formează un grup de nivel L. Butonul ⊟ / ⊞ stă pe rândul de sub grup (rândul de total),
// iar pentru coloane pe coloana din dreapta lui. Strângerea ascunde rândurile grupului (în hideRows / hideCols, ca Ascunde).
// Nivelurile se țin ca la înălțimea rândurilor: cheia e numărul rândului de la 1 („5”: 2 = rândul 5 e pe nivelul 2).

export type Levels = Record<string, number>;
export const MAX_OUTLINE = 7;

export interface Group { from: number; to: number; level: number }

/** Nivelurile citite dintr-un fișier: doar numere întregi între 1 și 7, pe rânduri / coloane care există. */
export function cleanLevels(raw: unknown, max: number): Levels | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Levels = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 1 && i <= max && Number.isInteger(v) && (v as number) >= 1) out[String(i)] = Math.min(MAX_OUTLINE, v as number);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Grupează (by = 1) sau degrupează (by = -1) rândurile a..b (de la 0). Întoarce nivelurile noi (undefined = niciun grup)
 * și câte rânduri s-au schimbat (0 = deja la nivelul maxim / fără grup).
 */
export function regroup(lv: Levels | undefined, a: number, b: number, by: 1 | -1): { levels: Levels | undefined; changed: number } {
  const out: Levels = { ...(lv ?? {}) };
  let changed = 0;
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
    const k = String(i + 1), cur = out[k] ?? 0, nx = Math.max(0, Math.min(MAX_OUTLINE, cur + by));
    if (nx === cur) continue;
    changed++;
    if (nx) out[k] = nx; else delete out[k];
  }
  return { levels: Object.keys(out).length ? out : undefined, changed };
}

/** Nivelul cel mai mare folosit (0 = fără grupuri). */
export const maxLevel = (lv: Levels | undefined) => Object.values(lv ?? {}).reduce((m, v) => Math.max(m, v), 0);

/** Toate grupurile: pe fiecare nivel L, șirurile de rânduri vecine cu nivel ≥ L (de la 0, capete incluse). */
export function groupsOf(lv: Levels | undefined): Group[] {
  const idx = Object.keys(lv ?? {}).map(Number).sort((x, y) => x - y);
  const out: Group[] = [];
  const top = maxLevel(lv);
  for (let L = 1; L <= top; L++) {
    let from = -1, prev = -2;
    for (const k of idx) {
      if (lv![String(k)] < L) continue;
      const i = k - 1;
      if (i !== prev + 1) { if (from >= 0) out.push({ from, to: prev, level: L }); from = i; }
      prev = i;
    }
    if (from >= 0) out.push({ from, to: prev, level: L });
  }
  return out;
}

/** Grupul al cărui buton stă pe rândul i (rândul de sub grup); cel mai din afară, dacă se termină mai multe acolo. */
export const groupAt = (gs: Group[], i: number) => gs.filter((g) => g.to + 1 === i).sort((x, y) => x.level - y.level)[0];

/** Grupul e strâns când toate rândurile lui sunt ascunse. `hidden` = numerele de la 1, ca hideRows. */
export function isShut(g: Group, hidden: Set<number>): boolean {
  for (let i = g.from; i <= g.to; i++) if (!hidden.has(i + 1)) return false;
  return true;
}

/** Strânge (shut) sau desface un grup: lista nouă de rânduri ascunse (de la 1, în ordine). */
export function toggleGroup(hide: number[] | undefined, g: Group, shut: boolean): number[] {
  const set = new Set(hide ?? []);
  for (let i = g.from; i <= g.to; i++) { if (shut) set.add(i + 1); else set.delete(i + 1); }
  return [...set].sort((a, b) => a - b);
}

/**
 * Butoanele 1, 2, 3… din colț: la nivelul n se văd doar rândurile cu nivel mai mic decât n (1 = doar totalurile).
 * Se ating doar rândurile grupate; cele ascunse de mână în afara grupurilor rămân cum erau.
 */
export function showLevel(lv: Levels | undefined, hide: number[] | undefined, n: number): number[] {
  const set = new Set(hide ?? []);
  for (const [k, v] of Object.entries(lv ?? {})) { if (v >= n) set.add(Number(k)); else set.delete(Number(k)); }
  return [...set].sort((a, b) => a - b);
}

/** Nivelurile după inserarea (n > 0) sau ștergerea (n < 0) de rânduri la `at` (de la 0); `shift` e cel din insert.ts. */
export function shiftLevels(lv: Levels | undefined, shift: (i: number) => number | null, max: number): Levels | undefined {
  if (!lv) return undefined;
  const out: Levels = {};
  for (const [k, v] of Object.entries(lv)) {
    const i = shift(Number(k) - 1);
    if (i !== null && i < max) out[String(i + 1)] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
