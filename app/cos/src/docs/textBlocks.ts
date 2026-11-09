// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Blocurile de text din Docs (🧩 Blocuri): bucata aleasă se ține ca JSON de noduri, gata de pus înapoi cu insertContent.
import type { EditorState } from '@tiptap/pm/state';
import type { JSONContent } from '@tiptap/react';

export interface DocBlock {
  name: string;
  /** Nodurile blocului: paragrafe / tabele întregi, sau doar textul (cu formatarea lui) când s-a ales o bucată dintr-un rând. */
  content: JSONContent[];
  /** Textul simplu al blocului (pentru previzualizare). */
  text: string;
}

const MARKS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
const plain = (s: string) => s.normalize('NFD').replace(MARKS, '').toLocaleLowerCase('ro').trim();

/** Blocul cu numele dat (fără să conteze diacriticele și literele mari). */
export function findBlock(blocks: DocBlock[], name: string): DocBlock | null {
  const k = plain(name);
  return blocks.find((b) => plain(b.name) === k) ?? null;
}

/** Face un bloc din textul ales; numele lipsă = primele cuvinte. Fără selecție: null. */
export function blockFromSelection(state: EditorState, name: string): DocBlock | null {
  const sel = state.selection;
  if (sel.empty) return null;
  const slice = sel.content();
  const text = state.doc.textBetween(sel.from, sel.to, ' ', ' ').replace(/\s+/g, ' ').trim();
  let content = slice.content.toJSON() as JSONContent[] | null;
  if (!content?.length) return null;
  // O bucată dintr-un singur paragraf: se păstrează doar textul ei (ca să intre în rândul în care o pui, nu ca paragraf nou).
  if (content.length === 1 && slice.openStart > 0 && slice.openEnd > 0 && content[0].type === 'paragraph') content = content[0].content ?? [];
  if (!content.length) return null;
  const nm = name.trim().replace(/\s+/g, ' ').slice(0, 40) || text.split(' ').slice(0, 3).join(' ').slice(0, 40) || 'Bloc';
  return { name: nm, content, text: text.slice(0, 2000) };
}

export function blockPreview(b: DocBlock): string {
  const t = b.text || '';
  return t.length > 60 ? t.slice(0, 58) + '…' : t;
}
