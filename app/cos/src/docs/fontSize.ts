// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mărimea textului, ca atribut al stilului de text (TipTap 2 nu o are inclusă).
// Plus „Mărește / Micșorează fontul” ca în Word: Ctrl+Shift+> / Ctrl+Shift+< sar pe lista de mărimi,
// Ctrl+] / Ctrl+[ schimbă cu câte 1 punct. Fiecare bucată din selecție crește de la mărimea ei.
import { Extension } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
      /** dir = 1 mărește, -1 micșorează; fine = câte 1 punct (altfel pe lista de mărimi, ca în Word). */
      growFontSize: (dir: 1 | -1, fine?: boolean) => ReturnType;
    };
  }
}

/** Lista de mărimi din Word, pe care sar butoanele A⁺ / A⁻. */
export const WORD_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

/** Următoarea mărime pe lista Word (peste 72 din 10 în 10, sub 8 câte 1), între 1 și 1638 de puncte. */
export function nextFontSize(pt: number, dir: 1 | -1, fine = false): number {
  let n: number;
  if (fine) n = dir > 0 ? Math.floor(pt) + 1 : Math.ceil(pt) - 1;
  else if (dir > 0) n = pt >= 72 ? Math.floor(pt / 10) * 10 + 10 : pt < 8 ? Math.floor(pt) + 1 : WORD_SIZES.find((s) => s > pt)!;
  else n = pt > 80 ? Math.ceil(pt / 10) * 10 - 10 : pt <= 8 ? Math.ceil(pt) - 1 : [...WORD_SIZES].reverse().find((s) => s < pt)!;
  return Math.min(1638, Math.max(1, n));
}

/** Mărimea în puncte scrisă pe text („12pt”, „16px”); null = mărimea implicită a paragrafului. */
export function sizePt(v: unknown): number | null {
  const m = /^(\d+(?:\.\d+)?)(pt|px)?$/.exec(String(v ?? '').trim());
  if (!m) return null;
  return m[2] === 'px' ? Number(m[1]) * 0.75 : Number(m[1]);
}

/** Mărimea implicită (în puncte) a textului fără mărime scrisă, după tipul paragrafului (ca în styles.css). */
function defaultPt(parent: PMNode | null): number {
  if (parent?.type.name === 'heading') return ({ 1: 21, 2: 16.5, 3: 13.5 } as Record<number, number>)[parent.attrs.level as number] ?? 11;
  return 11;
}

/** Mărește / micșorează fontul în selecția tranzacției (sau pentru textul scris de acum, dacă nu e nimic selectat).
 *  Lucrează pe tranzacția primită, ca să meargă și în lanțurile TipTap (chain().focus().growFontSize()). */
export function growFontTr(tr: Transaction, dir: 1 | -1, fine = false): boolean {
  const type = tr.doc.type.schema.marks.textStyle;
  if (!type) return false;
  const { from, to, empty, $from } = tr.selection;
  if (empty) {
    const marks = tr.storedMarks ?? $from.marks();
    const old = marks.find((m) => m.type === type);
    const cur = sizePt(old?.attrs.fontSize) ?? defaultPt($from.parent);
    tr.addStoredMark(type.create({ ...(old?.attrs ?? {}), fontSize: `${nextFontSize(cur, dir, fine)}pt` }));
    return true;
  }
  const before = tr.steps.length;
  tr.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isText) return;
    const a = Math.max(from, pos);
    const b = Math.min(to, pos + node.nodeSize);
    if (a >= b) return;
    const old = node.marks.find((m) => m.type === type);
    const cur = sizePt(old?.attrs.fontSize) ?? defaultPt(parent);
    tr.addMark(a, b, type.create({ ...(old?.attrs ?? {}), fontSize: `${nextFontSize(cur, dir, fine)}pt` }));
  });
  return tr.steps.length > before;
}

export const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => el.style.fontSize || null,
          renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size) => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
      growFontSize: (dir, fine = false) => ({ tr }) => growFontTr(tr, dir, fine),
    };
  },
  addKeyboardShortcuts() {
    // Aceleași scurtături ca în Word.
    return {
      'Mod->': () => this.editor.commands.growFontSize(1),
      'Mod-<': () => this.editor.commands.growFontSize(-1),
      'Mod-]': () => this.editor.commands.growFontSize(1, true),
      'Mod-[': () => this.editor.commands.growFontSize(-1, true),
    };
  },
});
