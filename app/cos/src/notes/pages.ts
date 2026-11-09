// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Pagini și subpagini (ca în caietele cu pagini): o notiță poate sta sub alta (câmpul `parent`), pe cel mult două niveluri.
// În listă subpaginile vin imediat sub pagina lor, mai la dreapta. Dacă pagina de sus nu se vede (alt filtru, coș, arhivă),
// subpagina apare singură, la locul ei.
import type { Note } from './store';

export const MAX_DEPTH = 2;

export type Nested = { note: Note; depth: number; kids: number };

/** Lista în ordinea de afișare: fiecare pagină urmată de subpaginile ei (în ordinea din listă), cu nivelul fiecăreia. */
export function nestNotes(list: Note[]): Nested[] {
  const ids = new Set(list.map((n) => n.id));
  const kids = new Map<string, Note[]>();
  for (const n of list) {
    if (!n.parent || !ids.has(n.parent) || n.parent === n.id) continue;
    kids.set(n.parent, [...(kids.get(n.parent) ?? []), n]);
  }
  const out: Nested[] = [];
  const seen = new Set<string>();
  const walk = (n: Note, depth: number) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    const ch = kids.get(n.id) ?? [];
    out.push({ note: n, depth: Math.min(depth, MAX_DEPTH), kids: ch.length });
    for (const c of ch) walk(c, depth + 1);
  };
  for (const n of list) if (!n.parent || !ids.has(n.parent) || n.parent === n.id) walk(n, 0);
  // Un cerc stricat (A sub B și B sub A) nu trebuie să ascundă notițe: ce a rămas apare la nivelul de sus.
  for (const n of list) walk(n, 0);
  return out;
}

/** Câte niveluri de subpagini are notița sub ea (0 = niciuna). */
function heightOf(notes: Note[], id: string, guard = 0): number {
  if (guard > 10) return 0;
  const ch = notes.filter((n) => n.parent === id && n.id !== id);
  return ch.length ? 1 + Math.max(...ch.map((c) => heightOf(notes, c.id, guard + 1))) : 0;
}

/**
 * „→ Subpagină”: notița devine subpagina celei de deasupra ei din listă, de pe același nivel (ca Ctrl+Alt+] în caiete).
 * Întoarce noul părinte sau un mesaj de ce nu se poate.
 */
export function indentTarget(shown: Nested[], notes: Note[], id: string): { parent: string } | { error: string } {
  const i = shown.findIndex((x) => x.note.id === id);
  if (i < 0) return { error: 'Notița nu e în listă.' };
  const depth = shown[i].depth;
  let j = i - 1;
  while (j >= 0 && shown[j].depth > depth) j--;
  if (j < 0 || shown[j].depth < depth) return { error: 'Deasupra ei nu e nicio pagină sub care s-o pun.' };
  if (depth + 1 + heightOf(notes, id) > MAX_DEPTH) return { error: `Subpaginile pot avea cel mult ${MAX_DEPTH} niveluri.` };
  return { parent: shown[j].note.id };
}

/** „← Pagină”: subpagina urcă un nivel (sub pagina de deasupra părintelui, sau la nivelul de sus). */
export function outdentParent(notes: Note[], id: string): string | undefined | null {
  const n = notes.find((x) => x.id === id);
  if (!n?.parent) return null;
  const p = notes.find((x) => x.id === n.parent);
  return p?.parent && p.parent !== p.id ? p.parent : undefined;
}

/** Subpaginile directe ale notiței (pentru mutarea lor odată cu ea, de exemplu în altă secțiune). */
export const childrenOf = (notes: Note[], id: string) => notes.filter((n) => n.parent === id && n.id !== id);
