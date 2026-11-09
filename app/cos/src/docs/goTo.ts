// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Mergi la” (Word: Ctrl+G): locurile din document de un anumit fel (titluri, tabele, imagini, comentarii, note de subsol),
// în ordine, ca să sari la următorul, la anteriorul sau la al N-lea. Paginile se măsoară pe ecran (pagePositions din pageCount.ts).
import type { Node as PMNode } from '@tiptap/pm/model';

export type GoKind = 'page' | 'heading' | 'table' | 'image' | 'comment' | 'footnote';
export const GO_KINDS: [GoKind, string][] = [
  ['page', 'Pagină'], ['heading', 'Titlu'], ['table', 'Tabel'], ['image', 'Imagine'], ['comment', 'Comentariu'], ['footnote', 'Notă de subsol'],
];

/** Pozițiile (în ordine) ale elementelor de felul ales. La comentarii: începutul fiecărui comentariu. */
export function goTargets(doc: PMNode, kind: GoKind): number[] {
  const out: number[] = [];
  const seen = new Set<string>();
  doc.descendants((node, pos) => {
    if (kind === 'heading' && node.type.name === 'heading') out.push(pos);
    else if (kind === 'table' && node.type.name === 'table') out.push(pos);
    else if (kind === 'image' && node.type.name === 'image') out.push(pos);
    else if (kind === 'footnote' && node.type.name === 'footnote') out.push(pos);
    else if (kind === 'comment' && node.isText) {
      for (const m of node.marks) {
        const id = String(m.attrs.id ?? '');
        if (m.type.name === 'comment' && id && !seen.has(id)) { seen.add(id); out.push(pos); }
      }
    }
  });
  return out;
}

/** Ținta în care stă cursorul (titlul, tabelul… care îl conține), ca „anteriorul” să fie cel dinaintea ei. */
export function containingTarget(doc: PMNode, targets: number[], from: number): number | null {
  return targets.find((p) => p <= from && from < p + (doc.nodeAt(p)?.nodeSize ?? 1)) ?? null;
}

/** Ținta următoare (dir 1) sau anterioară (dir -1) față de cursor; se reia de la capăt, ca în Word. null dacă nu e niciuna. */
export function stepTarget(targets: number[], from: number, dir: 1 | -1): number | null {
  if (!targets.length) return null;
  if (dir > 0) return targets.find((p) => p > from) ?? targets[0];
  return [...targets].reverse().find((p) => p < from) ?? targets[targets.length - 1];
}
