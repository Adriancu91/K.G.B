// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Schimbă literele” în Docs (Word: Home → Aa, Shift+F3). Textul se rescrie pe loc, bucată cu bucată,
// deci aldinul, culorile și legăturile rămân pe aceleași litere. Fără selecție se schimbă cuvântul de la cursor.
import { Extension } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { TextSelection } from '@tiptap/pm/state';
import { changeCase, nextCase, type TextCase } from '../textCase';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    changeCase: {
      /** Fără argument: următorul pas din ciclul Shift+F3 (MAJUSCULE → litere mici → Propoziție / Fiecare Cuvânt). */
      changeCase: (c?: TextCase) => ReturnType;
    };
  }
}

const NL = String.fromCharCode(10);
const OBJ = String.fromCharCode(0xfffc); // locul unei imagini în text, ca pozițiile să rămână aceleași

/** Zona [de la, până la] pe care se aplică: selecția sau cuvântul de la cursor. */
function range(tr: Transaction): [number, number] | null {
  const { from, to, empty, $from } = tr.selection;
  if (!empty) return [from, to];
  const text = $from.parent.textBetween(0, $from.parent.content.size, undefined, OBJ);
  const off = $from.parentOffset;
  const isW = (ch: string | undefined) => !!ch && /[\p{L}\p{N}'’-]/u.test(ch);
  let a = off, b = off;
  while (a > 0 && isW(text[a - 1])) a--;
  while (b < text.length && isW(text[b])) b++;
  if (a === b) return null;
  const start = $from.start();
  return [start + a, start + b];
}

export function changeCaseTr(tr: Transaction, c?: TextCase): boolean {
  const r = range(tr);
  if (!r) return false;
  const [from, to] = r;
  const cursor = tr.selection.empty ? tr.selection.from : -1;
  // Textul întreg al zonei (paragrafele despărțite prin rând nou), ca regula „propoziție” să vadă unde începe fraza.
  const parts: { pos: number; off: number; text: string }[] = [];
  let joined = '';
  let last = -1;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const a = Math.max(from, pos), b = Math.min(to, pos + node.nodeSize);
    if (a >= b) return;
    if (last >= 0 && a !== last) joined += NL;
    const text = node.text!.slice(a - pos, b - pos);
    parts.push({ pos: a, off: joined.length, text });
    joined += text;
    last = b;
  });
  if (!parts.length) return false;
  const out = changeCase(joined, c ?? nextCase(joined));
  if (out === joined) return true;
  // changeCase păstrează lungimea, deci fiecare bucată își ia literele noi de la același loc.
  for (const p of parts) {
    const next = out.slice(p.off, p.off + p.text.length);
    if (next === p.text) continue;
    const node = tr.doc.nodeAt(p.pos)!;
    tr.replaceWith(p.pos, p.pos + next.length, tr.doc.type.schema.text(next, node.marks));
  }
  // Selecția rămâne pe același text (ca în Word, unde Shift+F3 se poate apăsa din nou); fără selecție, cursorul rămâne pe loc.
  tr.setSelection(cursor >= 0 ? TextSelection.create(tr.doc, cursor) : TextSelection.create(tr.doc, from, to));
  return true;
}

export const ChangeCase = Extension.create({
  name: 'changeCase',
  addCommands() {
    return { changeCase: (c) => ({ tr }) => changeCaseTr(tr, c) };
  },
  addKeyboardShortcuts() {
    return { 'Shift-F3': () => this.editor.commands.changeCase() };
  },
});
