// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Despărțirea automată în silabe la capăt de rând (Word: Aspect → Despărțire în silabe → Automat), după regulile românești.
// Editorul nu schimbă textul: pune doar, pe ecran, câte o cratimă „moale” (se vede numai dacă rândul se rupe acolo) între silabele
// cuvintelor lungi. Tipărirea și PDF-ul pornesc din aceeași pagină, deci au aceleași despărțiri; în .docx se scrie
// w:autoHyphenation, ca programul care îl deschide să despartă și el.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

import { hyphenPoints } from '../hyphenRo';

export { hyphenPoints };

const SHY = String.fromCharCode(173);
const key = new PluginKey<{ on: boolean; set: DecorationSet }>('hyphenation');

function blockDecos(node: PMNode, pos: number, out: Decoration[]) {
  node.descendants((t, p) => {
    if (!t.isText) return;
    const text = t.text!;
    for (const m of text.matchAll(/\p{L}{6,}/gu)) {
      for (const at of hyphenPoints(m[0])) {
        out.push(Decoration.widget(pos + 1 + p + m.index! + at, () => {
          const s = document.createElement('span');
          s.className = 'doc-shy';
          s.textContent = SHY;
          return s;
        }, { side: -1, key: 'shy', marks: [] }));
      }
    }
  });
}

function fullSet(doc: PMNode): DecorationSet {
  const out: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) { blockDecos(node, pos, out); return false; }
    return true;
  });
  return DecorationSet.create(doc, out);
}

/** La o modificare refacem doar paragrafele atinse (documentele lungi rămân ușoare). */
function update(set: DecorationSet, tr: Transaction): DecorationSet {
  let next = set.map(tr.mapping, tr.doc);
  const ranges: [number, number][] = [];
  tr.mapping.maps.forEach((m, i) => m.forEach((_a, _b, from, to) => {
    const rest = tr.mapping.slice(i + 1);
    ranges.push([rest.map(from, -1), rest.map(to, 1)]);
  }));
  const done = new Set<number>();
  for (const [a, b] of ranges) {
    const from = Math.max(0, Math.min(a, tr.doc.content.size)), to = Math.max(from, Math.min(b, tr.doc.content.size));
    tr.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isTextblock) return true;
      if (done.has(pos)) return false;
      done.add(pos);
      const out: Decoration[] = [];
      blockDecos(node, pos, out);
      next = next.remove(next.find(pos, pos + node.nodeSize)).add(tr.doc, out);
      return false;
    });
  }
  return next;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hyphenation: { setHyphenation: (on: boolean) => ReturnType };
  }
}

export const Hyphenation = Extension.create({
  name: 'hyphenation',
  addCommands() {
    return {
      setHyphenation: (on: boolean) => ({ tr, dispatch }) => {
        dispatch?.(tr.setMeta(key, on).setMeta('addToHistory', false));
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      key,
      state: {
        init: () => ({ on: false, set: DecorationSet.empty }),
        apply: (tr, v, _old, state) => {
          const m = tr.getMeta(key);
          if (typeof m === 'boolean' && m !== v.on) return { on: m, set: m ? fullSet(state.doc) : DecorationSet.empty };
          if (!v.on || !tr.docChanged) return v;
          return { on: true, set: update(v.set, tr) };
        },
      },
      props: {
        decorations: (state) => key.getState(state)?.set ?? null,
        attributes: (state): Record<string, string> => (key.getState(state)?.on ? { class: 'doc-hyph' } : {}),
      },
    })];
  },
});

export const hyphenationOn = (state: EditorState) => !!key.getState(state)?.on;
