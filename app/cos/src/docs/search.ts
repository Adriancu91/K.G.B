// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Căutare și înlocuire în document: evidențiază potrivirile și permite trecerea de la una la alta.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, EditorState, TextSelection, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { SearchOpts, textMatches } from './searchMatch';

export interface Match { from: number; to: number }

interface SearchState {
  term: string;
  caseSensitive: boolean;
  wholeWord?: boolean;
  wildcards?: boolean;
  /** Doar textul cu această formatare (de exemplu „bold”); gol = orice text. */
  format?: string;
  matches: Match[];
  current: number;
}

export const searchKey = new PluginKey<SearchState>('suite-search');

function findMatches(doc: PMNode, term: string, opts: SearchOpts & { format?: string }): Match[] {
  if (!term) return [];
  const fmt = opts.format || '';
  const out: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Textul paragrafului, cu poziția fiecărui caracter în document.
    let text = '';
    const at: number[] = [];
    // Pentru căutarea după formatare: fiecare literă are sau nu formatarea cerută.
    const has: boolean[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        const t = child.text ?? '';
        const yes = !fmt || child.marks.some((m) => m.type.name === fmt);
        for (let i = 0; i < t.length; i++) { at.push(start + i); has.push(yes); }
        text += t;
      } else {
        at.push(start);
        has.push(false);
        text += '￼';
      }
    });
    for (const [i, j] of textMatches(text, term, opts)) if (!fmt || has.slice(i, j).every(Boolean)) out.push({ from: at[i], to: at[j - 1] + 1 });
    return false;
  });
  return out;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearch: (term: string, caseSensitive?: boolean, opts?: { wholeWord?: boolean; wildcards?: boolean; format?: string }) => ReturnType;
      findNext: (dir?: 1 | -1) => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

export function getSearch(state: EditorState): SearchState {
  return searchKey.getState(state) ?? { term: '', caseSensitive: false, matches: [], current: 0 };
}

function selectCurrent(tr: Transaction, m: Match | undefined) {
  // Mutăm cursorul pe potrivire, ca pagina să deruleze până la ea.
  if (m) tr.setSelection(TextSelection.create(tr.doc, m.from, m.to)).scrollIntoView();
}

export const Search = Extension.create({
  name: 'search',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ term: '', caseSensitive: false, matches: [], current: 0 }),
          apply(tr, prev) {
            const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            if (!meta && !tr.docChanged) return prev;
            const next = { ...prev, ...meta };
            if (meta?.term !== undefined || meta?.caseSensitive !== undefined || tr.docChanged) {
              next.matches = findMatches(tr.doc, next.term, next);
            }
            if (next.current >= next.matches.length) next.current = 0;
            return next;
          },
        },
        props: {
          decorations(state) {
            const s = searchKey.getState(state);
            if (!s || !s.matches.length) return DecorationSet.empty;
            return DecorationSet.create(state.doc, s.matches.map((m, i) =>
              Decoration.inline(m.from, m.to, { class: i === s.current ? 'search-hit current' : 'search-hit' })));
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearch: (term, caseSensitive = false, opts = {}) => ({ state, tr, dispatch }) => {
        if (dispatch) {
          // Prima potrivire de după cursor devine cea curentă.
          const o = { caseSensitive, wholeWord: !!opts.wholeWord, wildcards: !!opts.wildcards, format: opts.format ?? '' };
          const matches = findMatches(state.doc, term, o);
          const from = state.selection.from;
          const idx = Math.max(0, matches.findIndex((m) => m.from >= from));
          tr.setMeta(searchKey, { term, ...o, current: idx });
          tr.setMeta('addToHistory', false);
        }
        return true;
      },
      findNext: (dir = 1) => ({ state, tr, dispatch }) => {
        const s = getSearch(state);
        if (!s.matches.length) return false;
        const current = (s.current + dir + s.matches.length) % s.matches.length;
        if (dispatch) {
          tr.setMeta(searchKey, { current });
          selectCurrent(tr, s.matches[current]);
        }
        return true;
      },
      replaceCurrent: (replacement) => ({ state, tr, dispatch }) => {
        const s = getSearch(state);
        const m = s.matches[s.current];
        if (!m) return false;
        if (dispatch) {
          if (replacement) tr.insertText(replacement, m.from, m.to);
          else tr.delete(m.from, m.to);
          // După înlocuire, aceeași poziție indică potrivirea următoare.
          tr.setMeta(searchKey, { current: s.current });
        }
        return true;
      },
      replaceAll: (replacement) => ({ state, tr, dispatch }) => {
        const s = getSearch(state);
        if (!s.matches.length) return false;
        if (dispatch) {
          // De la coadă spre început, ca pozițiile rămase să nu se schimbe.
          for (const m of [...s.matches].reverse()) {
            if (replacement) tr.insertText(replacement, m.from, m.to);
            else tr.delete(m.from, m.to);
          }
          tr.setMeta(searchKey, { current: 0 });
        }
        return true;
      },
    };
  },
});
