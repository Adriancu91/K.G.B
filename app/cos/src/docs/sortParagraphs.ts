// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Sortează paragrafele (Word: Pornire → Sortare): paragrafele sau elementele de listă selectate, A→Z sau Z→A,
// după regulile limbii române (ă după a, ș după s) și cu numerele în ordinea lor (2 înainte de 10). Rândurile goale ajung la sfârșit.
import { Extension } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { TextSelection } from '@tiptap/pm/state';
import { Fragment, type Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sortParagraphs: { sortParagraphs: (desc?: boolean) => ReturnType };
  }
}

const collator = new Intl.Collator('ro', { numeric: true, sensitivity: 'base' });

export function sortNodes(nodes: PMNode[], desc = false): PMNode[] {
  const full = nodes.filter((n) => n.textContent.trim() !== '');
  const empty = nodes.filter((n) => n.textContent.trim() === '');
  // sort() e stabil: paragrafele cu același text își păstrează ordinea.
  full.sort((a, b) => collator.compare(a.textContent.trim(), b.textContent.trim()) * (desc ? -1 : 1));
  return [...full, ...empty];
}

export function sortTr(tr: Transaction, desc = false): boolean {
  const { $from, $to } = tr.selection;
  const range = $from.blockRange($to);
  if (!range || range.endIndex - range.startIndex < 2) return false;
  const nodes: PMNode[] = [];
  for (let i = range.startIndex; i < range.endIndex; i++) nodes.push(range.parent.child(i));
  // Doar paragrafe, titluri și elemente de listă (un tabel sau o poză din mijloc oprește sortarea, ca să nu se strice nimic).
  if (!nodes.every((n) => ['paragraph', 'heading', 'listItem', 'taskItem'].includes(n.type.name))) return false;
  const sorted = sortNodes(nodes, desc);
  if (sorted.every((n, i) => n === nodes[i])) return true;
  tr.replaceWith(range.start, range.end, Fragment.fromArray(sorted));
  const end = range.start + sorted.reduce((s, n) => s + n.nodeSize, 0);
  tr.setSelection(TextSelection.between(tr.doc.resolve(range.start), tr.doc.resolve(end)));
  return true;
}

export const SortParagraphs = Extension.create({
  name: 'sortParagraphs',
  addCommands() {
    return { sortParagraphs: (desc = false) => ({ tr }) => sortTr(tr, desc) };
  },
});
