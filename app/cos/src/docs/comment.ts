// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Comentarii pe text (ca în Word): textul comentat e colorat, iar comentariul (autor, dată, text) stă în marcajul lui,
// deci se salvează odată cu documentul. Pot fi mai multe comentarii peste același text.
import { Mark, mergeAttributes } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { applyMarkers } from './markers';
import type { MarkType, Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      addComment: (attrs: { id: string; author: string }) => ReturnType;
      updateComment: (id: string, text: string) => ReturnType;
      removeComment: (id: string) => ReturnType;
      /** Marchează comentariul ca rezolvat (rămâne în document, cu tot firul, dar fără culoare pe text) sau îl redeschide. */
      setCommentDone: (id: string, done: boolean) => ReturnType;
      /** Adaugă un răspuns gol la comentariu (firul de discuție de sub el). */
      addReply: (id: string, author: string) => ReturnType;
      updateReply: (id: string, index: number, text: string) => ReturnType;
      removeReply: (id: string, index: number) => ReturnType;
    };
  }
}

export interface DocComment {
  id: string;
  text: string;
  author: string;
  date: string;
  from: number;
  to: number;
  /** Textul comentat (începutul lui). */
  quote: string;
  /** Răspunsurile la comentariu, în ordine (firul de discuție). */
  replies: CommentReply[];
  /** Rezolvat (✓ Rezolvă): rămâne în document, dar nu mai colorează textul. */
  done: boolean;
}

export interface CommentReply { author: string; date: string; text: string }

/** Răspunsurile se țin în marcaj ca text JSON; un text stricat înseamnă „fără răspunsuri”. */
export function parseReplies(raw: unknown): CommentReply[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((r) => r && typeof r === 'object').map((r) => ({ author: String(r.author ?? ''), date: String(r.date ?? ''), text: String(r.text ?? '') })) : [];
  } catch { return []; }
}
const writeReplies = (r: CommentReply[]) => (r.length ? JSON.stringify(r) : '');

/** Comentariile documentului, în ordinea în care apar în text. */
export function listComments(doc: PMNode): DocComment[] {
  const map = new Map<string, DocComment>();
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    for (const m of node.marks) {
      if (m.type.name !== 'comment') continue;
      const id = String(m.attrs.id);
      const c = map.get(id);
      if (c) { c.to = pos + node.nodeSize; if (c.quote.length < 80) c.quote += node.text; }
      else map.set(id, { id, text: m.attrs.text ?? '', author: m.attrs.author ?? '', date: m.attrs.date ?? '', from: pos, to: pos + node.nodeSize, quote: node.text ?? '', replies: parseReplies(m.attrs.replies), done: m.attrs.done === '1' });
    }
    return true;
  });
  return [...map.values()];
}

/**
 * După Import Word: semnele invizibile de început/sfârșit (puse de docxImport) devin comentarii pe textul dintre ele,
 * apoi semnele se șterg. Un comentariu fără pereche se pierde, dar textul rămâne curat.
 */
export function applyImportedComments(editor: Editor, comments: { id: string; author: string; date: string; text: string; replies?: CommentReply[]; parent?: string; done?: boolean }[]) {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const type = editor.schema.marks.comment;
  const stamp = Date.now().toString(36);
  return applyMarkers(editor, '\uE000', '\uE002', (id) => {
    const c = byId.get(id);
    // Răspunsurile au în Word aceleași semne ca și comentariul lor; aici stau în comentariul de sus, deci semnele lor se scot.
    return c && !c.parent ? type.create({ id: `w${id}-${stamp}`, text: c.text, author: c.author, date: c.date, replies: writeReplies(c.replies ?? []), done: c.done ? '1' : '' }) : null;
  });
}

// Schimbă atributele comentariului pe toate bucățile lui de text.
function changeComment(tr: Transaction, doc: PMNode, type: MarkType, id: string, patch: (attrs: Record<string, unknown>) => Record<string, unknown>) {
  doc.descendants((node, pos) => {
    const m = node.isText && node.marks.find((x) => x.type === type && x.attrs.id === id);
    if (!m) return true;
    tr.removeMark(pos, pos + node.nodeSize, m);
    tr.addMark(pos, pos + node.nodeSize, type.create({ ...m.attrs, ...patch(m.attrs) }));
    return true;
  });
}

export const Comment = Mark.create({
  name: 'comment',
  // Comentariile se pot suprapune; textul scris la marginea lor nu intră în comentariu.
  excludes: '',
  inclusive: false,

  addAttributes() {
    const attr = (name: string) => ({
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-comment-${name}`) ?? '',
      renderHTML: (a: Record<string, string>) => ({ [`data-comment-${name}`]: a[name] }),
    });
    return { id: attr('id'), text: attr('text'), author: attr('author'), date: attr('date'), replies: attr('replies'), done: attr('done') };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-comment' }), 0];
  },

  addCommands() {
    return {
      addComment: ({ id, author }) => ({ commands }) =>
        commands.setMark(this.name, { id, author, text: '', date: new Date().toISOString() }),

      updateComment: (id, text) => ({ tr, state, dispatch }) => {
        changeComment(tr, state.doc, state.schema.marks.comment, id, () => ({ text }));
        dispatch?.(tr);
        return true;
      },

      addReply: (id, author) => ({ tr, state, dispatch }) => {
        changeComment(tr, state.doc, state.schema.marks.comment, id, (a) => ({ replies: writeReplies([...parseReplies(a.replies), { author, date: new Date().toISOString(), text: '' }]) }));
        dispatch?.(tr);
        return true;
      },

      updateReply: (id, index, text) => ({ tr, state, dispatch }) => {
        changeComment(tr, state.doc, state.schema.marks.comment, id, (a) => ({ replies: writeReplies(parseReplies(a.replies).map((r, i) => (i === index ? { ...r, text } : r))) }));
        dispatch?.(tr);
        return true;
      },

      removeReply: (id, index) => ({ tr, state, dispatch }) => {
        changeComment(tr, state.doc, state.schema.marks.comment, id, (a) => ({ replies: writeReplies(parseReplies(a.replies).filter((_r, i) => i !== index)) }));
        dispatch?.(tr);
        return true;
      },

      setCommentDone: (id, done) => ({ tr, state, dispatch }) => {
        changeComment(tr, state.doc, state.schema.marks.comment, id, () => ({ done: done ? '1' : '' }));
        dispatch?.(tr);
        return true;
      },

      removeComment: (id) => ({ tr, state, dispatch }) => {
        const type = state.schema.marks.comment;
        state.doc.descendants((node, pos) => {
          const m = node.isText && node.marks.find((x) => x.type === type && x.attrs.id === id);
          if (m) tr.removeMark(pos, pos + node.nodeSize, m);
          return true;
        });
        dispatch?.(tr);
        return true;
      },
    };
  },
});
