// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Trimiteri (cross-reference): „vezi Capitolul 2”, „vezi pagina 4”, „mai jos”. O trimitere e o legătură spre un semn de carte
// (#nume) care ține minte ce arată (`xref`): textul locului, numărul paginii sau „mai sus / mai jos”. Spre un titlu se pune
// singur un semn ascuns (_Ref…, ca în Word). F9 sau „Actualizează” rescrie toate trimiterile după ce documentul s-a schimbat.
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { isHiddenBookmark, listBookmarks } from './bookmark';
import { pageMap } from './pageCount';

export type XrefKind = 'text' | 'label' | 'page' | 'pos';
export const XREF_KINDS: [XrefKind, string][] = [['text', 'Textul'], ['label', 'Doar eticheta și numărul (Figura 1)'], ['page', 'Numărul paginii'], ['pos', 'mai sus / mai jos']];

export interface XrefTarget { kind: 'heading' | 'bookmark' | 'caption'; label: string; level?: number; pos: number; name?: string }

/** Titlurile și legendele (cu semnul lor, dacă au deja unul la început) și semnele de carte vizibile. */
export function xrefTargets(doc: PMNode): XrefTarget[] {
  const out: XrefTarget[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const text = node.textContent.trim();
      const first = node.firstChild;
      if (text) out.push({ kind: 'heading', label: text, level: Number(node.attrs.level) || 1, pos, name: first?.type.name === 'bookmark' ? String(first.attrs.name) : undefined });
      return false;
    }
    if (node.type.name === 'paragraph' && node.attrs.pstyle === 'caption') {
      const first = node.firstChild;
      const text = node.textContent.trim();
      if (text) out.push({ kind: 'caption', label: text, pos, name: first?.type.name === 'bookmark' ? String(first.attrs.name) : undefined });
      return false;
    }
    return true;
  });
  for (const b of listBookmarks(doc)) if (!isHiddenBookmark(b.name)) out.push({ kind: 'bookmark', label: b.name, pos: b.pos, name: b.name });
  return out;
}

/** Textul blocului în care stă semnul (paragraful sau titlul); la `label`, într-o legendă, doar „Figura 3”. */
function blockText(doc: PMNode, pos: number, label = false): string {
  const $p = doc.resolve(Math.min(pos + 1, doc.content.size));
  const block = $p.parent;
  if (label) {
    let upTo = '';
    let found = false;
    block.forEach((ch) => {
      if (found) return;
      if (ch.type.name === 'captionNum') { upTo += String(ch.attrs.n); found = true; } else upTo += ch.textContent;
    });
    if (found) return upTo.trim();
  }
  return block.textContent.trim();
}

/** Ce arată trimiterea spre semnul `name`, pusă la poziția `at`. */
export function xrefText(doc: PMNode, name: string, kind: XrefKind, at: number, pageOf: (pos: number) => number): string | null {
  const b = listBookmarks(doc).find((x) => x.name === name);
  if (!b) return null;
  if (kind === 'pos') return b.pos < at ? 'mai sus' : 'mai jos';
  if (kind === 'page') return String(pageOf(b.pos));
  return blockText(doc, b.pos, kind === 'label') || name;
}

/** Pagina unei poziții, măsurată pe ecran ca „Pagina X din Y”. */
export const pageMeter = (editor: Editor, pageH: number) => { const at = pageMap(editor.view, pageH); return (pos: number) => at(pos).page; };

const newRefName = (doc: PMNode) => {
  const used = new Set(listBookmarks(doc).map((b) => b.name));
  let n: string;
  do n = '_Ref' + String(Math.floor(1e8 + Math.random() * 9e8)); while (used.has(n));
  return n;
};

/** Pune trimiterea la cursor. Spre un titlu fără semn, întâi se pune semnul ascuns la începutul lui. */
export function insertXref(editor: Editor, t: XrefTarget, kind: XrefKind, pageH: number): boolean {
  let name = t.name;
  if (!name) {
    name = newRefName(editor.state.doc);
    const tr = editor.state.tr.insert(t.pos + 1, editor.schema.nodes.bookmark.create({ name }));
    editor.view.dispatch(tr);
  }
  const at = editor.state.selection.from;
  const text = xrefText(editor.state.doc, name, kind, at, pageMeter(editor, pageH));
  if (!text) return false;
  return editor.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href: '#' + name, xref: kind } }] }).run();
}

/** Rescrie toate trimiterile (F9). Întoarce câte s-au schimbat și câte duc la un semn care nu mai există. */
export function updateXrefs(editor: Editor, pageH: number): { changed: number; broken: number } {
  const { doc } = editor.state;
  const type = editor.schema.marks.link;
  // Bucățile de text cu aceeași trimitere, una după alta, sunt o singură trimitere.
  const runs: { from: number; to: number; href: string; kind: XrefKind; text: string }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const m = node.marks.find((x) => x.type === type && x.attrs.xref);
    if (!m) return false;
    const last = runs[runs.length - 1];
    if (last && last.to === pos && last.href === m.attrs.href && last.kind === m.attrs.xref) { last.to = pos + node.nodeSize; last.text += node.text; }
    else runs.push({ from: pos, to: pos + node.nodeSize, href: String(m.attrs.href), kind: m.attrs.xref as XrefKind, text: node.text ?? '' });
    return false;
  });
  const meter = pageMeter(editor, pageH);
  let changed = 0, broken = 0;
  const tr = editor.state.tr;
  for (const r of runs.reverse()) {
    const text = xrefText(doc, r.href.slice(1), r.kind, r.from, meter);
    if (text === null) { broken++; continue; }
    if (text === r.text) continue;
    const marks = doc.resolve(r.from + 1).marks();
    tr.replaceWith(r.from, r.to, editor.schema.text(text, marks));
    changed++;
  }
  if (changed) editor.view.dispatch(tr);
  return { changed, broken };
}
