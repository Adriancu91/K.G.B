// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Relațiile dintre tabele (Date → Instrumente de date → 🔗 Relații, ca Relationships / Data Model): un tabel cu multe rânduri
// (de exemplu Vânzări, cu coloana Cod client) e legat de un tabel de căutare (Clienți, unde fiecare Cod apare o singură dată).
// Din relații se face „tabelul din model”: tabelul de bază cu coloanele alese din tabelele legate, chiar și peste două
// legături (Vânzări → Produse → Categorii). Tabelul e o interogare cu pași Îmbină (query.ts), deci se reface la Reîmprospătare
// totală. Testat în tests/sheets-relations.test.mjs.

import { runQuery, type QOther, type QStep, type QVal } from './query';

export interface SheetRel {
  /** Tabelul cu multe rânduri (sau foaia) și coloana lui cu cheia. */
  from: string;
  col: string;
  /** Tabelul de căutare și coloana în care fiecare cheie apare o singură dată. */
  to: string;
  col2: string;
}

export const MAX_RELS = 40;

const key = (n: string) => n.trim().toLocaleLowerCase('ro-RO');
const keyOf = (v: QVal) => (typeof v === 'number' ? String(v) : v.trim().toLocaleLowerCase('ro-RO'));

/** Relațiile din fișier, curățate: câmpuri text nevide, fără dubluri, cel mult MAX_RELS. */
export function cleanRels(v: unknown): SheetRel[] {
  if (!Array.isArray(v)) return [];
  const out: SheetRel[] = [];
  for (const x of v) {
    const r = x as Partial<SheetRel> | null;
    const ok = (s: unknown): s is string => typeof s === 'string' && s.trim() !== '' && s.length <= 255;
    if (!r || !ok(r.from) || !ok(r.col) || !ok(r.to) || !ok(r.col2) || key(r.from) === key(r.to)) continue;
    if (out.some((o) => sameRel(o, r as SheetRel))) continue;
    out.push({ from: r.from, col: r.col, to: r.to, col2: r.col2 });
    if (out.length >= MAX_RELS) break;
  }
  return out;
}

export function sameRel(a: SheetRel, b: SheetRel): boolean {
  return key(a.from) === key(b.from) && key(a.col) === key(b.col) && key(a.to) === key(b.to) && key(a.col2) === key(b.col2);
}

/**
 * Ce nu merge la o relație (null = e bună): tabelele lipsă, coloanele lipsă, cheile repetate în tabelul de căutare
 * (atunci un rând de vânzare ar avea doi clienți) sau un drum înapoi la același tabel.
 */
export function relProblem(r: SheetRel, other: QOther, rels: SheetRel[] = []): string | null {
  if (key(r.from) === key(r.to)) return 'Un tabel nu se poate lega de el însuși';
  const a = other(r.from), b = other(r.to);
  if (!a) return `Nu găsesc tabelul „${r.from}”`;
  if (!b) return `Nu găsesc tabelul „${r.to}”`;
  if (!a.head.includes(r.col)) return `Tabelul „${r.from}” nu are coloana „${r.col}”`;
  const k = b.head.indexOf(r.col2);
  if (k < 0) return `Tabelul „${r.to}” nu are coloana „${r.col2}”`;
  const seen = new Set<string>();
  for (const row of b.rows) {
    const v = row[k] ?? '';
    if (String(v).trim() === '') continue;
    const s = keyOf(v);
    if (seen.has(s)) return `În „${r.to}”, coloana „${r.col2}” are valoarea „${v}” de mai multe ori: acolo fiecare cheie trebuie să apară o singură dată`;
    seen.add(s);
  }
  // Un drum în cerc (A → B → A) ar face tabelul din model fără sfârșit.
  const others = rels.filter((x) => !sameRel(x, r));
  const reach = new Set([key(r.to)]);
  for (let grew = true; grew;) {
    grew = false;
    for (const x of others) if (reach.has(key(x.from)) && !reach.has(key(x.to))) { reach.add(key(x.to)); grew = true; }
  }
  if (reach.has(key(r.from))) return `Relația ar face un cerc: din „${r.to}” se ajunge deja înapoi la „${r.from}”`;
  return null;
}

/** Tabelele la care se ajunge din `base` prin relații (în ordinea în care se îmbină), cu relația prin care se ajunge la fiecare. */
export function relTree(base: string, rels: SheetRel[]): { table: string; via: SheetRel }[] {
  const out: { table: string; via: SheetRel }[] = [];
  const seen = new Set([key(base)]);
  const queue = [base];
  while (queue.length) {
    const t = queue.shift()!;
    for (const r of rels) {
      if (key(r.from) !== key(t) || seen.has(key(r.to))) continue;
      seen.add(key(r.to));
      out.push({ table: r.to, via: r });
      queue.push(r.to);
    }
  }
  return out;
}

/**
 * Pașii interogării pentru tabelul din model: pornind de la `base`, câte un Îmbină (toate rândurile de aici) pentru fiecare
 * tabel legat din care s-a ales ceva (`pick`: tabel → coloane) sau prin care trece drumul spre unul ales. Cheile de legătură
 * spre nivelul următor se aduc și ele. Numele coloanelor aduse se iau exact cum le face pasul Îmbină (Sumă (2) etc.).
 */
export function modelSteps(base: string, rels: SheetRel[], pick: Record<string, string[]>, other: QOther): QStep[] {
  const tree = relTree(base, rels);
  const picked = (t: string) => Object.entries(pick).some(([k, v]) => key(k) === key(t) && v.length > 0);
  const colsOf = (t: string) => Object.entries(pick).find(([k]) => key(k) === key(t))?.[1] ?? [];
  // Un tabel intră dacă e ales sau dacă un tabel ales e mai departe pe drumul lui.
  const need = new Set<string>();
  for (let i = tree.length - 1; i >= 0; i--) {
    const n = tree[i];
    if (picked(n.table) || tree.some((m) => need.has(key(m.table)) && key(m.via.from) === key(n.table))) need.add(key(n.table));
  }
  const t0 = other(base);
  if (!t0) return [];
  let head = [...t0.head];
  // Numele pe care le are fiecare coloană din fiecare tabel în tabelul din model (cele de bază rămân la fel).
  const names = new Map<string, Map<string, string>>([[key(base), new Map(head.map((h) => [h, h]))]]);
  const steps: QStep[] = [];
  for (const n of tree) {
    if (!need.has(key(n.table))) continue;
    const t2 = other(n.table);
    const at = names.get(key(n.via.from))?.get(n.via.col);
    if (!t2 || !at) continue;
    const links = tree.filter((m) => need.has(key(m.table)) && key(m.via.from) === key(n.table)).map((m) => m.via.col);
    let cols = [...new Set([...colsOf(n.table), ...links])].filter((c) => t2.head.includes(c) && c !== n.via.col2);
    // O listă goală la Îmbină înseamnă „toate coloanele”: le scriem pe față, ca numele lor să fie știute.
    if (!cols.length) cols = t2.head.filter((c) => c !== n.via.col2);
    const step: QStep = { k: 'merge', src: n.table, col: at, col2: n.via.col2, how: 'left', cols };
    // Pasul rulat pe un tabel fără rânduri arată numele exacte ale coloanelor aduse.
    const after = runQuery({ head, rows: [] }, [step], (s) => (key(s) === key(n.table) ? { head: t2.head, rows: [] } : undefined)).table.head;
    const added = after.slice(head.length);
    names.set(key(n.table), new Map(cols.map((c, i) => [c, added[i]])));
    // Cheia din tabelul de căutare are aceeași valoare ca cheia de aici, deci tot pe ea se leagă nivelul următor.
    names.get(key(n.table))!.set(n.via.col2, at);
    head = after;
    steps.push(step);
  }
  return steps;
}

/**
 * 🔍 Găsește singur: relațiile care par evidente între tabele. O coloană A.x se leagă de B.y când numele lor seamănă (la fel,
 * sau unul îl cuprinde pe celălalt: „Cod client” ↔ „Cod”), în B fiecare valoare apare o singură dată, în A cel puțin o valoare
 * se repetă sau A are mai multe rânduri, și toate valorile nevide din A.x se găsesc în B.y (cel puțin două diferite).
 * Cele care există deja sau nu trec de relProblem nu se propun.
 */
export function detectRels(tables: string[], other: QOther, rels: SheetRel[] = []): SheetRel[] {
  const out: SheetRel[] = [];
  const vals = (t: { rows: QVal[][] }, k: number) => t.rows.map((r) => r[k] ?? '').filter((v) => String(v).trim() !== '').map(keyOf);
  for (const a of tables) for (const b of tables) {
    if (key(a) === key(b)) continue;
    const ta = other(a), tb = other(b);
    if (!ta || !tb) continue;
    ta.head.forEach((ca, i) => tb.head.forEach((cb, j) => {
      const na = key(ca), nb = key(cb);
      if (!na || !nb || !(na === nb || na.includes(nb) || nb.includes(na))) return;
      const va = vals(ta, i), vb = vals(tb, j);
      const sb = new Set(vb), sa = new Set(va);
      if (sb.size !== vb.length || sa.size < 2 || !(sa.size < va.length || ta.rows.length > tb.rows.length)) return;
      if (![...sa].every((v) => sb.has(v))) return;
      const r = { from: a, col: ca, to: b, col2: cb };
      if ([...rels, ...out].some((x) => sameRel(x, r) || (key(x.from) === key(a) && key(x.col) === key(ca)))) return;
      if (!relProblem(r, other, [...rels, ...out])) out.push(r);
    }));
  }
  return out.slice(0, MAX_RELS - rels.length);
}
