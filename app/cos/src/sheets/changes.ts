// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Revizuire → Afișare modificări: lista celulelor schimbate în registru (ce era, ce e acum, când și cine), cele mai noi sus.
// Se ține minte în fișierul Suite (cel mult MAX_CHANGES), ca să se vadă și după redeschidere. O schimbare = o celulă;
// o lipire mare se ține minte doar cu primele MAX_PER_EDIT celule, plus un rând „și încă N celule”.
import { cellId, parseCellId } from './format';
import type { Range } from './fill';

export interface CellChange {
  /** Ora (milisecunde), autorul (gol = necunoscut), foaia, celula, valoarea de dinainte și cea nouă (textul scris, cu formula). */
  t: number; who: string; sheet: string; id: string; o: string; n: string;
  /** Câte alte celule s-au schimbat odată cu aceasta și nu au rând propriu (lipiri mari). */
  more?: number;
}

export const MAX_CHANGES = 1000;
export const MAX_PER_EDIT = 200;
const MAX_TEXT = 300;

const cut = (s: string) => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + '…' : s);

/** Celulele diferite între două stări ale unei foi, în ordinea rândurilor; goale = celulă golită / nouă. */
export function diffCells(sheet: string, a: Record<string, string>, b: Record<string, string>, t: number, who: string): CellChange[] {
  if (a === b) return [];
  const ids: { id: string; r: number; c: number }[] = [];
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[id] ?? '') === (b[id] ?? '')) continue;
    const p = parseCellId(id);
    if (p) ids.push({ id, ...p });
  }
  ids.sort((x, y) => x.r - y.r || x.c - y.c);
  const out: CellChange[] = ids.slice(0, MAX_PER_EDIT).map(({ id }) => ({ t, who, sheet, id, o: cut(a[id] ?? ''), n: cut(b[id] ?? '') }));
  if (ids.length > MAX_PER_EDIT) out[out.length - 1].more = ids.length - MAX_PER_EDIT;
  return out;
}

/** Jurnalul cu schimbările noi puse sus, tăiat la MAX_CHANGES. */
export function addChanges(log: CellChange[] | undefined, more: CellChange[]): CellChange[] {
  return [...more.slice().reverse(), ...(log ?? [])].slice(0, MAX_CHANGES);
}

/** Schimbările unei foi (sau ale tuturor, cu sheet = null), doar din zona dată, dacă e dată. */
export function changesIn(log: CellChange[] | undefined, sheet: string | null, g?: Range): CellChange[] {
  const key = (s: string) => s.toLocaleLowerCase('ro-RO');
  return (log ?? []).filter((x) => {
    if (sheet !== null && key(x.sheet) !== key(sheet)) return false;
    if (!g) return true;
    const p = parseCellId(x.id);
    return !!p && p.r >= g.r0 && p.r <= g.r1 && p.c >= g.c0 && p.c <= g.c1;
  });
}

/** Jurnalul citit dintr-un fișier, curățat. */
export function cleanChanges(raw: unknown): CellChange[] {
  if (!Array.isArray(raw)) return [];
  const str = (v: unknown) => typeof v === 'string';
  return raw.filter((x) => x && typeof x === 'object' && Number.isFinite(x.t) && str(x.who) && str(x.sheet) && str(x.id) && parseCellId(x.id) && str(x.o) && str(x.n))
    .slice(0, MAX_CHANGES)
    .map((x) => ({ t: x.t, who: cut(x.who).slice(0, 80), sheet: x.sheet, id: cellId(parseCellId(x.id)!.r, parseCellId(x.id)!.c), o: cut(x.o), n: cut(x.n),
      ...(Number.isInteger(x.more) && x.more > 0 ? { more: x.more } : {}) }));
}
