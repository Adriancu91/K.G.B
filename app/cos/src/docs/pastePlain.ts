// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Lipește doar textul (Word: Lipire → Se păstrează doar textul): textul copiat ia formatul de la cursor, fără fonturi,
// culori, tabele sau poze din sursă. Ctrl+Alt+V (Ctrl+Shift+V e folosit de pensula de formatare, ca în Word).
import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';

/** Citește textul din clipboard și îl lipește simplu; întoarce false dacă nu e nimic de lipit sau clipboard-ul nu se poate citi. */
export async function pastePlainText(editor: Editor, read: () => Promise<string> = () => navigator.clipboard.readText()): Promise<boolean> {
  let text = '';
  try { text = await read(); } catch { return false; }
  if (!text || editor.isDestroyed) return false;
  editor.commands.focus();
  // pasteText trece prin aceeași cale ca Ctrl+V cu text simplu: rândurile devin paragrafe, formatul vine de la cursor.
  return editor.view.pasteText(text);
}

export const PastePlain = Extension.create({
  name: 'pastePlain',
  addKeyboardShortcuts() {
    return { 'Mod-Alt-v': () => { void pastePlainText(this.editor); return true; } };
  },
});
