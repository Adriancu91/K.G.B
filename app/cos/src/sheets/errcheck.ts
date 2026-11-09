// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Sheets → ⚠ Erori (Error Checking + Circular References din Excel): lista celulelor cu formule care dau eroare pe foaia curentă,
// în ordinea rândurilor, cu explicația în română; separat, referințele circulare. Eroarea „de la sursă” e cea a cărei formulă
// nu folosește nicio altă celulă cu eroare (acolo trebuie reparat); celelalte doar o primesc mai departe.
import { isNumber, parseCellId } from './format';
import { ERROR_HELP, formulaRanges, type Result } from './formula';

export interface ErrItem {
  id: string;
  err: string;
  formula: string;
  help: string;
  /** Formula nu folosește alte celule cu eroare: greșeala e chiar aici. */
  source: boolean;
}

export interface ErrReport { items: ErrItem[]; circular: string[]; counts: [string, number][] }

const order = (a: string, b: string) => {
  const p = parseCellId(a), q = parseCellId(b);
  return p && q ? p.r - q.r || p.c - q.c : a.localeCompare(b);
};

export function sheetErrors(cells: Record<string, string>, results: Record<string, Result | undefined>): ErrReport {
  const bad = new Set(Object.keys(cells).filter((id) => cells[id]?.startsWith('=') && results[id]?.err));
  const pos = new Map([...bad].map((id) => [id, parseCellId(id)!] as const).filter(([, p]) => !!p));
  const items: ErrItem[] = [...bad].sort(order).map((id) => {
    const err = results[id]!.err!;
    // Folosește formula alte celule cu eroare (de pe aceeași foaie)? Ne uităm doar la celulele cu eroare, nu la toată zona.
    let uses = false;
    try {
      const zones = formulaRanges(cells[id]);
      // La foarte multe erori nu mai căutăm sursa (ar dura prea mult); toate rămân „de verificat”.
      if (bad.size <= 2000) uses = [...pos].some(([o, p]) => o !== id && zones.some((g) => p.r >= g.r0 && p.r <= g.r1 && p.c >= g.c0 && p.c <= g.c1));
    } catch { /* formulă necitibilă: o lăsăm ca sursă */ }
    return { id, err, formula: cells[id], help: ERROR_HELP[err] ?? 'Eroare în formulă.', source: !uses };
  });
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.err, (counts.get(it.err) ?? 0) + 1);
  return { items, circular: items.filter((i) => i.err === '#CIRC!').map((i) => i.id), counts: [...counts].sort((a, b) => b[1] - a[1]) };
}

/** Număr scris ca text (cu apostrof în față, de exemplu dintr-un import): în colț apare triunghiul verde, ca în programele cunoscute. */
export function isNumText(raw: string | undefined): boolean {
  return !!raw && raw.startsWith("'") && isNumber(raw.slice(1));
}
