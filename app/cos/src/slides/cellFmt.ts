// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formatarea fiecărei celule dintr-un tabel de slide (peste stilul tabelului): fundalul, culoarea textului, aldin, cursiv,
// subliniat și alinierea. Vine din Inserare → ▦ Foaie de calcul… (sheetTable.ts), ca tabelul să arate ca în Sheets; se
// scrie în .pptx pe fiecare celulă (pptx.ts). Grila are aceeași mărime ca celulele; 0 = celula fără formatare proprie.
import type { CSSProperties } from 'react';

export interface CellFmt { bg?: string; fg?: string; b?: boolean; i?: boolean; u?: boolean; al?: 'left' | 'center' | 'right' }
export type CellFmtGrid = (CellFmt | 0)[][];

const HEX = /^#[0-9a-f]{6}$/i;

function cleanOne(f: unknown): CellFmt | 0 {
  if (!f || typeof f !== 'object') return 0;
  const x = f as Record<string, unknown>;
  const o: CellFmt = {
    ...(typeof x.bg === 'string' && HEX.test(x.bg) ? { bg: x.bg.toLowerCase() } : {}),
    ...(typeof x.fg === 'string' && HEX.test(x.fg) ? { fg: x.fg.toLowerCase() } : {}),
    ...(x.b === true ? { b: true } : {}),
    ...(x.i === true ? { i: true } : {}),
    ...(x.u === true ? { u: true } : {}),
    ...(x.al === 'left' || x.al === 'center' || x.al === 'right' ? { al: x.al } : {}),
  };
  return Object.keys(o).length ? o : 0;
}

/** Grila adusă la rows × cols (ce lipsește = 0); undefined dacă nicio celulă nu are formatare. */
export function cleanCellFmt(g: unknown, rows: number, cols: number): CellFmtGrid | undefined {
  if (!Array.isArray(g)) return undefined;
  const out = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => cleanOne(Array.isArray(g[r]) ? g[r][c] : 0)));
  return out.some((row) => row.some(Boolean)) ? out : undefined;
}

/** Rând / coloană nouă (d = 1, goală) sau scoasă (d = −1) la poziția `at`; axis 0 = rânduri, 1 = coloane. */
export function shiftCellFmt(g: CellFmtGrid | undefined, axis: 0 | 1, at: number, d: 1 | -1): CellFmtGrid | undefined {
  if (!g) return g;
  if (axis === 0) {
    const x = g.map((row) => [...row]);
    if (d === 1) x.splice(at, 0, Array(g[0]?.length ?? 0).fill(0));
    else x.splice(at, 1);
    return x;
  }
  return g.map((row) => { const y = [...row]; if (d === 1) y.splice(at, 0, 0); else y.splice(at, 1); return y; });
}

/** Stilul de pe ecran al celulei. */
export function cellFmtCss(f: CellFmt | 0 | undefined): CSSProperties | undefined {
  if (!f) return undefined;
  return {
    ...(f.bg ? { background: f.bg } : {}),
    ...(f.fg ? { color: f.fg } : {}),
    ...(f.b ? { fontWeight: 700 } : {}),
    ...(f.i ? { fontStyle: 'italic' } : {}),
    ...(f.u ? { textDecoration: 'underline' } : {}),
    ...(f.al ? { textAlign: f.al } : {}),
  };
}

/** Ce s-a citit dintr-o celulă a unui tabel adus din fișier (null = celulă acoperită de o îmbinare). */
export interface CellSeen { bg?: string; fg?: string; b: boolean; i: boolean; u: boolean; al?: 'left' | 'center' | 'right' }

/**
 * Formatarea proprie a celulelor unui tabel adus dintr-un fișier: doar ce se abate de la celelalte celule cu același rol
 * (capul, rândurile alternate, restul…), fiindcă multe programe scriu culorile stilului tabelului pe fiecare celulă.
 */
export function cellFmtFromSeen(seen: (CellSeen | null)[][], roleOf: (r: number, c: number) => string): CellFmtGrid | undefined {
  const groups = new Map<string, CellSeen[]>();
  seen.forEach((row, r) => row.forEach((s, c) => { if (s) { const k = roleOf(r, c); (groups.get(k) ?? groups.set(k, []).get(k)!).push(s); } }));
  // La egalitate în grup câștigă valoarea mai deasă în tot tabelul, apoi cea „goală” (fără fundal, fără aldin).
  const all = [...groups.values()].flat();
  const count = <T,>(xs: T[]) => { const n = new Map<T, number>(); for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1); return n; };
  const most = <T,>(xs: T[], pick: (s: CellSeen) => T): T | undefined => {
    const n = count(xs), g = count(all.map(pick));
    let best: T | undefined, bn = -1, bg = -1;
    for (const [x, k] of n) {
      const gk = g.get(x) ?? 0;
      if (k > bn || k === bn && (gk > bg || gk === bg && !x)) { best = x; bn = k; bg = gk; }
    }
    return best;
  };
  const usual = new Map([...groups].map(([k, xs]) => [k, {
    bg: most(xs.map((x) => x.bg ?? ''), (x) => x.bg ?? ''), fg: most(xs.map((x) => x.fg ?? ''), (x) => x.fg ?? ''), al: most(xs.map((x) => x.al ?? ''), (x) => x.al ?? ''),
    b: most(xs.map((x) => x.b), (x) => x.b), i: most(xs.map((x) => x.i), (x) => x.i), u: most(xs.map((x) => x.u), (x) => x.u),
  }]));
  const out = seen.map((row, r) => row.map((s, c): CellFmt | 0 => {
    if (!s) return 0;
    const u = usual.get(roleOf(r, c))!;
    const f: CellFmt = {
      ...(s.bg && s.bg !== u.bg ? { bg: s.bg } : {}),
      ...(s.fg && s.fg !== u.fg ? { fg: s.fg } : {}),
      ...(s.b && !u.b ? { b: true } : {}),
      ...(s.i && !u.i ? { i: true } : {}),
      ...(s.u && !u.u ? { u: true } : {}),
      ...(s.al && s.al !== u.al ? { al: s.al } : {}),
    };
    return Object.keys(f).length ? f : 0;
  }));
  return cleanCellFmt(out, seen.length, Math.max(0, ...seen.map((x) => x.length)));
}
