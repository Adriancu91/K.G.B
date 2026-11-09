// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ⚡ Analiză rapidă (Quick Analysis din Excel, Ctrl+Q): pe zona selectată, o fereastră mică cu ce se face des cu un tabel:
// evidențieri (bare, scală de culori, pictograme…), grafice, totaluri, tabel / rezumat și minigrafice. Fiecare buton
// folosește funcțiile care există deja în Sheets; aici sunt lista și calculele care nu țin de ecran.
import { cellId } from './format';
import type { Range } from './fill';
import type { AutoFn, Cellish } from './autosum';

export type QuickTab = 'fmt' | 'chart' | 'total' | 'table' | 'spark';
export interface QuickItem { key: string; icon: string; name: string; title: string }

export const QUICK_TABS: [QuickTab, string][] = [['fmt', 'Formatare'], ['chart', 'Grafice'], ['total', 'Totaluri'], ['table', 'Tabele'], ['spark', 'Minigrafice']];

export const QUICK_ITEMS: Record<QuickTab, QuickItem[]> = {
  fmt: [
    { key: 'databar', icon: '▬', name: 'Bare de date', title: 'O bară în fiecare celulă, lungă cât numărul' },
    { key: 'scale', icon: '🌈', name: 'Scală de culori', title: 'Numerele mici roșii, cele mari verzi' },
    { key: 'icons', icon: '⬆', name: 'Pictograme', title: 'Săgeți: sus pentru cele mari, jos pentru cele mici' },
    { key: 'above', icon: '⇡', name: 'Peste medie', title: 'Colorează numerele mai mari decât media' },
    { key: 'top', icon: '🔝', name: 'Primele 10', title: 'Colorează cele mai mari 10 numere' },
    { key: 'dup', icon: '⧉', name: 'Dubluri', title: 'Colorează valorile care se repetă' },
    { key: 'clear', icon: '✕', name: 'Fără evidențieri', title: 'Scoate evidențierile de pe zona aleasă' },
  ],
  chart: [
    { key: 'col', icon: '📊', name: 'Coloane', title: 'Grafic cu coloane' },
    { key: 'bar', icon: '☰', name: 'Bare', title: 'Grafic cu bare orizontale' },
    { key: 'line', icon: '📈', name: 'Linie', title: 'Grafic cu linie' },
    { key: 'pie', icon: '◔', name: 'Plăcintă', title: 'Grafic plăcintă (o singură serie)' },
    { key: 'scatter', icon: '⁘', name: 'Puncte', title: 'Grafic cu puncte (X și Y)' },
    { key: 'rec', icon: '✨', name: 'Recomandate…', title: 'Graficele potrivite pentru aceste date' },
  ],
  total: [
    { key: 'SUM', icon: 'Σ', name: 'Sumă', title: 'Totalul fiecărei coloane, sub zonă' },
    { key: 'AVERAGE', icon: 'x̄', name: 'Medie', title: 'Media fiecărei coloane, sub zonă' },
    { key: 'COUNT', icon: '#', name: 'Număr', title: 'Câte numere are fiecare coloană, sub zonă' },
    { key: 'MAX', icon: '⤒', name: 'Maxim', title: 'Cel mai mare număr din fiecare coloană, sub zonă' },
    { key: 'MIN', icon: '⤓', name: 'Minim', title: 'Cel mai mic număr din fiecare coloană, sub zonă' },
    { key: 'pct', icon: '%', name: '% din total', title: 'Cât din totalul zonei are fiecare coloană, sub zonă' },
    { key: 'run', icon: '∑+', name: 'Total cumulat', title: 'Totalul adunat de la prima coloană până la fiecare, sub zonă' },
    { key: 'row', icon: 'Σ→', name: 'Sumă pe rând', title: 'Totalul fiecărui rând, în coloana din dreapta zonei' },
  ],
  table: [
    { key: 'table', icon: '▦', name: 'Tabel', title: 'Cap de tabel, rânduri alternate și filtru' },
    { key: 'pivot', icon: '⊞', name: 'Rezumat', title: 'Tabel de rezumat (pivot) pe o foaie nouă' },
  ],
  spark: [
    { key: 'line', icon: '〰', name: 'Linie', title: 'Un minigrafic cu linie pentru fiecare rând, în celula din dreapta' },
    { key: 'col', icon: '▁▃▅', name: 'Coloane', title: 'Un minigrafic cu coloane pentru fiecare rând' },
    { key: 'winloss', icon: '▀▄', name: 'Câștig / pierdere', title: 'Plus în sus, minus în jos, pentru fiecare rând' },
  ],
};

/** Partea cu numere a zonei: fără rândurile de cap (de sus, fără niciun număr) și fără coloanele de etichete (din stânga). */
export function numericPart(g: Range, s: Cellish): Range | null {
  const rowHas = (r: number) => { for (let c = g.c0; c <= g.c1; c++) if (s.num(r, c)) return true; return false; };
  const colHas = (c: number, r0: number) => { for (let r = r0; r <= g.r1; r++) if (s.num(r, c)) return true; return false; };
  let r0 = g.r0;
  while (r0 <= g.r1 && !rowHas(r0)) r0++;
  if (r0 > g.r1) return null;
  let c0 = g.c0;
  while (c0 <= g.c1 && !colHas(c0, r0)) c0++;
  let r1 = g.r1;
  while (r1 > r0 && !rowHas(r1)) r1--;
  let c1 = g.c1;
  while (c1 > c0 && !colHas(c1, r0)) c1--;
  return { r0, c0, r1, c1 };
}

/** Totalul fiecărui rând cu numere, în coloana din dreapta zonei (celulele deja scrise nu se ating). */
export function rowTotals(g: Range, s: Cellish, fn: AutoFn = 'SUM'): Record<string, string> {
  const out: Record<string, string> = {};
  const target = g.c1 + 1;
  for (let r = g.r0; r <= g.r1; r++) {
    let any = false;
    for (let c = g.c0; c <= g.c1; c++) if (s.num(r, c)) any = true;
    if (!any || s.filled(r, target)) continue;
    out[cellId(r, target)] = `=${fn}(${cellId(r, g.c0)}:${cellId(r, g.c1)})`;
  }
  return out;
}

/**
 * Pe rândul de sub zonă, pentru fiecare coloană cu numere: „% din total” (partea coloanei din totalul zonei)
 * sau „total cumulat” (de la prima coloană până la ea). Celulele deja scrise nu se ating.
 */
export function colShares(g: Range, s: Cellish, kind: 'pct' | 'run'): Record<string, string> {
  const out: Record<string, string> = {};
  const r = g.r1 + 1;
  const abs = (rr: number, cc: number) => '$' + cellId(rr, cc).replace(/(\d+)$/, '$$$1');
  for (let c = g.c0; c <= g.c1; c++) {
    let any = false;
    for (let rr = g.r0; rr <= g.r1; rr++) if (s.num(rr, c)) any = true;
    if (!any || s.filled(r, c)) continue;
    out[cellId(r, c)] = kind === 'pct'
      ? `=SUM(${cellId(g.r0, c)}:${cellId(g.r1, c)})/SUM(${abs(g.r0, g.c0)}:${abs(g.r1, g.c1)})`
      : `=SUM(${abs(g.r0, g.c0)}:${cellId(g.r1, c)})`;
  }
  return out;
}
