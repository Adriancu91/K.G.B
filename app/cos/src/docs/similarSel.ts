// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Selectare ▾ → Selectare text cu formatare similară: toate bucățile de text care au exact aceeași formatare ca textul de la
// cursor (aldin, cursiv, font, mărime, culoare…) se aleg deodată, chiar dacă sunt în locuri diferite. Butoanele de format
// (aldin, culoare, font) și tastarea lucrează pe toate bucățile, pentru că ProseMirror le primește ca „ranges” ale selecției.
// Bucățile alese se arată cu fundalul selecției (decorare), fiindcă fereastra nu poate arăta singură mai multe selecții.
import { Extension } from '@tiptap/core';
import type { Node as PMNode, Mark } from '@tiptap/pm/model';
import { Plugin, PluginKey, Selection, SelectionRange, TextSelection } from '@tiptap/pm/state';
import type { Mappable } from '@tiptap/pm/transform';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface Span { from: number; to: number }

/** O selecție din mai multe bucăți de text (de la stânga la dreapta, fără suprapuneri). */
export class MultiTextSelection extends Selection {
  constructor(doc: PMNode, spans: Span[]) {
    const rs = spans.map((s) => new SelectionRange(doc.resolve(s.from), doc.resolve(s.to)));
    super(rs[0].$from, rs[rs.length - 1].$to, rs);
    // Fereastra ar arăta o singură selecție mare, de la prima bucată la ultima: o ascundem și desenăm bucățile.
    (this as { visible: boolean }).visible = false;
  }
  map(doc: PMNode, mapping: Mappable): Selection {
    const spans = this.ranges.map((r) => ({ from: mapping.map(r.$from.pos, 1), to: mapping.map(r.$to.pos, -1) })).filter((s) => s.to > s.from);
    return spans.length ? new MultiTextSelection(doc, spans) : TextSelection.near(doc.resolve(mapping.map(this.head)));
  }
  eq(other: Selection): boolean {
    return other instanceof MultiTextSelection && other.ranges.length === this.ranges.length
      && other.ranges.every((r, i) => r.$from.pos === this.ranges[i].$from.pos && r.$to.pos === this.ranges[i].$to.pos);
  }
  toJSON() { return { type: 'multitext', spans: this.ranges.map((r) => [r.$from.pos, r.$to.pos]) }; }
  static fromJSON(doc: PMNode, json: { spans?: [number, number][] }): Selection {
    const spans = (json.spans ?? []).map(([from, to]) => ({ from, to })).filter((s) => s.to > s.from && s.to <= doc.content.size);
    return spans.length ? new MultiTextSelection(doc, spans) : Selection.atStart(doc);
  }
}
Selection.jsonID('multitext', MultiTextSelection);

/** Bucățile de text cu exact aceleași mărci (formatare) ca `marks`; cele lipite una de alta se unesc. */
export function similarSpans(doc: PMNode, marks: readonly Mark[]): Span[] {
  const out: Span[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    if (!sameMarks(node.marks, marks)) return false;
    const last = out[out.length - 1];
    if (last && last.to === pos) last.to = pos + node.nodeSize; else out.push({ from: pos, to: pos + node.nodeSize });
    return false;
  });
  return out;
}

function sameMarks(a: readonly Mark[], b: readonly Mark[]): boolean {
  return a.length === b.length && a.every((m) => b.some((n) => n.eq(m)));
}

/** Formatarea textului de la cursor: la o selecție, a primului caracter din ea; altfel a caracterului dinainte (sau de după). */
export function marksAtCursor(sel: Selection): readonly Mark[] {
  const { $from, empty } = sel;
  if (!empty) {
    const n = $from.nodeAfter;
    if (n?.isText) return n.marks;
  }
  return ($from.nodeBefore?.isText ? $from.nodeBefore : $from.nodeAfter?.isText ? $from.nodeAfter : null)?.marks ?? $from.marks();
}

const key = new PluginKey('similarSel');

export const SimilarSelection = Extension.create({
  name: 'similarSelection',
  addProseMirrorPlugins() {
    return [new Plugin({
      key,
      props: {
        // Tastarea nu are voie să șteargă tot ce e între bucăți (de la prima la ultima): textul nou se scrie la capătul
        // ultimei bucăți, iar Backspace / Delete șterg doar bucățile alese. Săgețile și Esc lasă cursorul la capătul ultimei bucăți.
        handleTextInput(view, _from, _to, text) {
          const s = view.state.selection;
          if (!(s instanceof MultiTextSelection)) return false;
          const end = s.ranges[s.ranges.length - 1].$to.pos;
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)).insertText(text));
          return true;
        },
        handleDOMEvents: {
          // Scrisul obișnuit vine ca „beforeinput” peste selecția din fereastră (de la prima bucată la ultima): îl facem noi.
          beforeinput(view, e) {
            const s = view.state.selection;
            if (!(s instanceof MultiTextSelection)) return false;
            const ev = e as InputEvent;
            const end = s.ranges[s.ranges.length - 1].$to.pos;
            if (ev.inputType.startsWith('delete')) { e.preventDefault(); view.dispatch(view.state.tr.deleteSelection()); return true; }
            if (ev.inputType === 'insertText' || ev.inputType === 'insertReplacementText') {
              e.preventDefault();
              const text = ev.data ?? ev.dataTransfer?.getData('text/plain') ?? '';
              const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, end));
              view.dispatch(text ? tr.insertText(text) : tr);
              return true;
            }
            if (ev.inputType.startsWith('insert')) { e.preventDefault(); view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end))); return true; }
            return false;
          },
        },
        handleKeyDown(view, e) {
          const s = view.state.selection;
          if (!(s instanceof MultiTextSelection)) return false;
          if (e.key === 'Backspace' || e.key === 'Delete') { view.dispatch(view.state.tr.deleteSelection()); return true; }
          if (e.key === 'Escape' || e.key === 'Enter' || e.key.startsWith('Arrow')) {
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, s.ranges[s.ranges.length - 1].$to.pos)));
            return e.key !== 'Enter';
          }
          return false;
        },
        decorations(state) {
          const s = state.selection;
          if (!(s instanceof MultiTextSelection)) return null;
          return DecorationSet.create(state.doc, s.ranges.map((r) => Decoration.inline(r.$from.pos, r.$to.pos, { class: 'pm-multisel' })));
        },
      },
    })];
  },
});

/** Alege tot textul cu formatarea de la cursor. Întoarce câte bucăți s-au ales (0 = nimic de ales). */
export function selectSimilar(view: { state: import('@tiptap/pm/state').EditorState; dispatch: (tr: import('@tiptap/pm/state').Transaction) => void }): number {
  const { state } = view;
  const spans = similarSpans(state.doc, marksAtCursor(state.selection));
  if (!spans.length) return 0;
  const sel = spans.length === 1 ? TextSelection.create(state.doc, spans[0].from, spans[0].to) : new MultiTextSelection(state.doc, spans);
  view.dispatch(state.tr.setSelection(sel).scrollIntoView());
  return spans.length;
}
