// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Semne invizibile puse în text la Import Word (început: START+id+CLOSE, sfârșit: END+id+CLOSE), pe care le
// transformăm apoi în marcaje pe textul dintre ele (comentarii, text adăugat, text șters) și le ștergem.
import type { Editor } from '@tiptap/core';
import type { Mark as PMMark } from '@tiptap/pm/model';
import { trackKey } from './track';

export const MARK_CLOSE = '\uE001';

export function applyMarkers(editor: Editor, start: string, end: string, makeMark: (id: string) => PMMark | null): number {
  const { state } = editor;
  const re = new RegExp(`${start}(\\d+)${MARK_CLOSE}|${end}(\\d+)${MARK_CLOSE}`, 'g');
  const found: { from: number; to: number; id: string; start: boolean }[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    for (const m of node.text.matchAll(re)) {
      found.push({ from: pos + m.index!, to: pos + m.index! + m[0].length, id: m[1] ?? m[2], start: m[1] !== undefined });
    }
    return true;
  });
  if (!found.length) return 0;
  const tr = state.tr;
  let added = 0;
  for (const s of found.filter((f) => f.start)) {
    const e = found.find((f) => !f.start && f.id === s.id && f.from >= s.to);
    const mark = e && e.from > s.to ? makeMark(s.id) : null;
    if (!mark) continue;
    tr.addMark(s.to, e!.from, mark);
    added++;
  }
  // Semnele se șterg de la sfârșit spre început, ca pozițiile celor rămase să nu se miște.
  for (const f of [...found].sort((a, b) => b.from - a.from)) tr.delete(f.from, f.to);
  // Nu e o modificare a utilizatorului: nu se urmărește și nu intră separat în Anulează.
  tr.setMeta(trackKey, true).setMeta('addToHistory', false);
  editor.view.dispatch(tr);
  return added;
}

/** După Import Word: textul adăugat / șters cu „Track Changes” devine modificare urmărită, de acceptat sau respins. */
export function applyImportedChanges(editor: Editor, changes: { id: string; kind: 'insertion' | 'deletion' | 'format' | 'paragraph'; author: string; date: string; ops?: string }[]): number {
  return applyParaChanges(editor, changes) + applyTextChanges(editor, changes);
}

/** Paragrafele cu alinierea / stilul schimbate (w:pPrChange): semnul de la începutul lor devine atributul pchange (track.ts ParaChange). */
function applyParaChanges(editor: Editor, changes: { id: string; kind: string; author: string; date: string; ops?: string }[]): number {
  const byId = new Map(changes.filter((c) => c.kind === 'paragraph').map((c) => [c.id, c]));
  if (!byId.size) return 0;
  const { state } = editor;
  const re = new RegExp(`${String.fromCharCode(0xe009)}(\\d+)${MARK_CLOSE}`, 'g');
  const found: { from: number; to: number; block: number; id: string }[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    for (const m of node.text.matchAll(re)) {
      const at = pos + m.index!;
      found.push({ from: at, to: at + m[0].length, block: state.doc.resolve(at).before(), id: m[1] });
    }
    return true;
  });
  if (!found.length) return 0;
  const tr = state.tr;
  let added = 0;
  for (const f of [...found].sort((a, b) => b.from - a.from)) {
    const c = byId.get(f.id);
    const node = tr.doc.nodeAt(f.block);
    tr.delete(f.from, f.to);
    let old: unknown = null;
    try { old = JSON.parse(c?.ops ?? ''); } catch { /* fără schimbare */ }
    if (!c || !old || !node?.isTextblock || !('pchange' in node.attrs)) continue;
    tr.setNodeMarkup(f.block, undefined, { ...tr.doc.nodeAt(f.block)!.attrs, pchange: JSON.stringify({ author: c.author, date: c.date, old }) });
    added++;
  }
  tr.setMeta(trackKey, true).setMeta('addToHistory', false);
  editor.view.dispatch(tr);
  return added;
}

function applyTextChanges(editor: Editor, changes: { id: string; kind: 'insertion' | 'deletion' | 'format' | 'paragraph'; author: string; date: string; ops?: string }[]): number {
  const byId = new Map(changes.map((c) => [c.id, c]));
  const make = (kind: 'insertion' | 'deletion' | 'formatChange') => (id: string) => {
    const c = byId.get(id);
    if (!c || !editor.schema.marks[kind]) return null;
    return editor.schema.marks[kind].create({ author: c.author, date: c.date, ...(kind === 'formatChange' ? { ops: c.ops ?? '[]' } : {}) });
  };
  const ch = (code: number) => String.fromCharCode(code);
  // Schimbările de format (w:rPrChange): textul rămâne cu formatul nou și primește semnul formatChange.
  return applyMarkers(editor, ch(0xe003), ch(0xe004), make('insertion')) + applyMarkers(editor, ch(0xe005), ch(0xe006), make('deletion'))
    + applyMarkers(editor, ch(0xe007), ch(0xe008), make('formatChange'));
}
