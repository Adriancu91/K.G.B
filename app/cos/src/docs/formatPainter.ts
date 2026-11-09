// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Pensula de formatare, ca în Word: ia formatul textului de la cursor (font, mărime, culoare, aldin, evidențiere…)
// și îl pune pe textul pe care îl alegi apoi cu mouse-ul. Un click pe pensulă = o singură dată; dublu click = rămâne
// pornită până apeși Esc sau din nou pe pensulă. Ctrl+Shift+C copiază formatul, Ctrl+Shift+V îl pune pe textul ales.
import { Extension, type Editor } from '@tiptap/core';
import { pastePlainText } from './pastePlain';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { Mark } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formatPainter: {
      /** Ia formatul de la cursor; `sticky` = pensula rămâne pornită pentru mai multe locuri. */
      pickFormat: (sticky?: boolean) => ReturnType;
      /** Pune formatul luat pe textul ales (sau pe cuvântul de la cursor). */
      applyFormat: () => ReturnType;
      stopFormatPainter: () => ReturnType;
    };
  }
}

/** Formatul de caracter care se copiază; legăturile, comentariile, notele și modificările urmărite rămân pe loc. */
export const PAINT_MARKS = ['bold', 'italic', 'underline', 'strike', 'textStyle', 'highlight', 'superscript', 'subscript', 'code'];

export interface PainterState { marks: Mark[] | null; sticky: boolean }
export const painterKey = new PluginKey<PainterState>('formatPainter');

export const painterOf = (editor: Editor | null): PainterState => (editor && painterKey.getState(editor.state)) || { marks: null, sticky: false };

/** Formatul de la începutul selecției (sau de la cursor, inclusiv ce ai pornit de la tastatură fără să scrii încă). */
function marksAt(state: EditorState): Mark[] {
  const { selection } = state;
  const marks = selection.empty ? state.storedMarks ?? selection.$from.marks()
    : (state.doc.nodeAt(selection.from)?.marks ?? selection.$from.marks());
  return marks.filter((m) => PAINT_MARKS.includes(m.type.name));
}

/** Zona pe care se pune formatul: selecția sau, dacă e doar cursorul, cuvântul în care stă (ca în Word). */
function targetRange(state: EditorState): { from: number; to: number } | null {
  const { selection } = state;
  if (!selection.empty) return { from: selection.from, to: selection.to };
  const $p = selection.$from;
  const text = $p.parent.textContent;
  const at = $p.parentOffset;
  const word = /[\p{L}\p{N}_-]/u;
  let a = at, b = at;
  while (a > 0 && word.test(text[a - 1])) a--;
  while (b < text.length && word.test(text[b])) b++;
  if (a === b) return null;
  return { from: $p.start() + a, to: $p.start() + b };
}

function paint(tr: Transaction, from: number, to: number, marks: Mark[]) {
  const schema = tr.doc.type.schema;
  for (const name of PAINT_MARKS) {
    const type = schema.marks[name];
    if (type) tr.removeMark(from, to, type);
  }
  for (const m of marks) tr.addMark(from, to, m);
}

export const FormatPainter = Extension.create({
  name: 'formatPainter',

  addCommands() {
    return {
      pickFormat: (sticky = false) => ({ state, tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(painterKey, { marks: marksAt(state), sticky }));
        return true;
      },
      applyFormat: () => ({ state, tr, dispatch }) => {
        const p = painterKey.getState(state);
        const range = targetRange(state);
        if (!p?.marks || !range) return false;
        if (dispatch) {
          paint(tr, range.from, range.to, p.marks);
          if (!p.sticky) tr.setMeta(painterKey, { marks: null, sticky: false });
          dispatch(tr);
        }
        return true;
      },
      stopFormatPainter: () => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(painterKey, { marks: null, sticky: false }));
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Ctrl+Shift+C / Ctrl+Shift+V: formatul rămâne ținut minte, se poate pune de mai multe ori.
      'Mod-Shift-c': () => { this.editor.commands.pickFormat(true); return true; },
      'Mod-Shift-v': () => {
        const p = painterKey.getState(this.editor.state);
        // Fără format ținut minte, Ctrl+Shift+V lipește doar textul (ca în procesorul de text cunoscut, din 2022).
        if (!p?.marks) { void pastePlainText(this.editor); return true; }
        this.editor.commands.applyFormat();
        return true;
      },
      Escape: () => (painterKey.getState(this.editor.state)?.marks ? this.editor.commands.stopFormatPainter() : false),
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin<PainterState>({
      key: painterKey,
      state: {
        init: () => ({ marks: null, sticky: false }),
        apply: (tr, prev) => (tr.getMeta(painterKey) as PainterState | undefined) ?? prev,
      },
      props: {
        attributes: (state): Record<string, string> => (painterKey.getState(state)?.marks ? { class: 'painting' } : {}),
        handleDOMEvents: {
          // După ce ai ales textul cu mouse-ul (sau ai dat click într-un cuvânt), formatul se pune pe el.
          mouseup: () => {
            if (!painterKey.getState(editor.state)?.marks) return false;
            setTimeout(() => {
              if (!editor.isDestroyed && painterKey.getState(editor.state)?.marks) editor.commands.applyFormat();
            }, 0);
            return false;
          },
        },
      },
    })];
  },
});

