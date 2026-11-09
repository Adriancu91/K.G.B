// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Semnele de formatare (Word: Afișare / ascundere ¶): ¶ la sfârșitul paragrafelor, ↵ la ruperile de rând, · în locul spațiilor
// și → la Tab. Se văd doar pe ecran (nu se tipăresc și nu se salvează). Spațiile se desenează doar cât e pornit, ca editorul să rămână ușor.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formattingMarks: { toggleFormattingMarks: () => ReturnType };
  }
}

const key = new PluginKey<boolean>('formattingMarks');
const SPACE = ' ';
const NBSP = String.fromCharCode(160);
const TAB = String.fromCharCode(9);

/** Decorațiile pentru spații, spații care nu se rup și Tab-uri. */
export function markDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const t = node.text!;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      const cls = c === SPACE ? 'fm-space' : c === NBSP ? 'fm-nbsp' : c === TAB ? 'fm-tab' : '';
      if (cls) decos.push(Decoration.inline(pos + i, pos + i + 1, { class: cls }));
    }
  });
  return DecorationSet.create(doc, decos);
}

export const FormattingMarks = Extension.create({
  name: 'formattingMarks',
  addCommands() {
    return {
      toggleFormattingMarks: () => ({ tr, state, dispatch }) => {
        dispatch?.(tr.setMeta(key, !key.getState(state)));
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin<boolean>({
      key,
      state: {
        init: () => false,
        apply: (tr, on) => { const m = tr.getMeta(key); return typeof m === 'boolean' ? m : on; },
      },
      props: {
        // Clasa de pe editor aduce ¶ și ↵ din CSS; spațiile au nevoie de decorații.
        attributes: (state): Record<string, string> => (key.getState(state) ? { class: 'show-marks' } : {}),
        decorations: (state) => (key.getState(state) ? markDecorations(state.doc) : null),
      },
    })];
  },
});

export const marksShown = (state: Parameters<typeof key.getState>[0]) => !!key.getState(state);
