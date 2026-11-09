// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Diacritice automate în Docs: textul fiecărui paragraf (cu locul fiecărei litere în document) pentru fereastra Diacritice
// și punerea rezultatului înapoi, literă cu literă, ca formatarea (îngroșat, culori, legături) să rămână neatinsă.
import type { Editor } from '@tiptap/core';
import type { DiaItem, DiaResult } from '../DiacriticsDialog';

export interface DiaBlocks { items: DiaItem[]; pos: Map<string, number[]>; from: number; to: number }

/** Paragrafele din selecție (sau din tot documentul, dacă nu e nimic selectat). */
export function diaBlocks(editor: Editor): DiaBlocks {
  const { state } = editor;
  const sel = state.selection;
  const from = sel.empty ? 0 : sel.from, to = sel.empty ? state.doc.content.size : sel.to;
  const items: DiaItem[] = [];
  const pos = new Map<string, number[]>();
  state.doc.nodesBetween(from, to, (node, p) => {
    if (!node.isTextblock) return true;
    let text = '';
    const at: number[] = [];
    node.forEach((child, off) => {
      if (child.isText) { const t = child.text ?? ''; for (let k = 0; k < t.length; k++) at.push(p + 1 + off + k); text += t; }
      else { text += String.fromCharCode(0xfffc); at.push(-1); }
    });
    if (/[a-z]/i.test(text)) { const id = String(p); items.push({ id, text }); pos.set(id, at); }
    return false;
  });
  return { items, pos, from, to };
}

/** Pune diacriticele alese; totul într-un singur pas (Ctrl+Z le scoate pe toate). Întoarce câte cuvinte s-au schimbat. */
export function applyDia(editor: Editor, blocks: DiaBlocks, res: DiaResult[]) {
  const tr = editor.state.tr;
  let n = 0;
  for (const r of res) {
    const at = blocks.pos.get(r.id);
    if (!at) continue;
    for (const c of r.changes) {
      // Doar cuvintele din selecție (paragraful poate ieși puțin din ea).
      if (at[c.start] < blocks.from || at[c.end - 1] >= blocks.to) continue;
      let changed = false;
      for (let k = 0; k < c.to.length; k++) {
        if (c.to[k] === c.from[k]) continue;
        const p = at[c.start + k];
        if (p < 0) continue;
        tr.insertText(c.to[k], p, p + 1);
        changed = true;
      }
      if (changed) n++;
    }
  }
  if (n) editor.view.dispatch(tr.scrollIntoView());
  return n;
}
