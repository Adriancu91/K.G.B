// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// AutoCorect în casetele de text și în celulele tabelelor din Slides: aceleași reguli și aceeași listă ca în Docs
// (docs/autoCorrect.ts, fereastra Opțiuni AutoCorect…): ghilimele „”, simboluri, ș/ț cu virgulă, DOuă MAjuscule,
// prima literă din propoziție și înlocuirile. Backspace imediat după o corectură o anulează (revine textul scris).
import { autoCorrect, loadAutoCorrect } from '../docs/autoCorrect';

interface Last { node: Text; start: number; end: number; original: string }
let last: Last | null = null;
let busy = false;

/** Textul rândului de la începutul lui până la cursor (rândul = punctul de listă, sau textul de după ultimul rând nou). */
function lineBefore(root: HTMLElement, node: Node, offset: number): string {
  const block = (node.parentElement?.closest('li') as HTMLElement | null) ?? root;
  if (!root.contains(block)) return '';
  const r = document.createRange();
  r.setStart(block, 0);
  r.setEnd(node, offset);
  // Rândurile din casetele fără listă sunt despărțite de <br>: se ia doar bucata de după ultimul.
  const frag = r.cloneContents();
  const brs = frag.querySelectorAll('br');
  if (brs.length) {
    const tail = document.createRange();
    tail.setStartAfter(brs[brs.length - 1]);
    tail.setEnd(frag, frag.childNodes.length);
    return tail.toString();
  }
  return r.toString();
}

function onBeforeInput(e: InputEvent) {
  if (busy || e.isComposing || e.inputType !== 'insertText' || !e.data || e.data.length !== 1) return;
  const root = e.currentTarget as HTMLElement;
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || !sel.anchorNode || !root.contains(sel.anchorNode)) return;
  const node = sel.anchorNode, offset = sel.anchorOffset;
  const before = lineBefore(root, node, offset).slice(-60);
  const fix = autoCorrect(before, e.data, loadAutoCorrect());
  if (!fix) { last = null; return; }
  // Caracterele de șters dinainte de cursor (fără cel tastat acum) trebuie să fie în același nod de text.
  const back = fix.del - 1;
  if (back > 0 && (node.nodeType !== Node.TEXT_NODE || offset < back)) { last = null; return; }
  e.preventDefault();
  const original = (back > 0 ? (node as Text).data.slice(offset - back, offset) : '') + e.data;
  busy = true;
  try {
    if (back > 0) {
      const r = document.createRange();
      r.setStart(node, offset - back);
      r.setEnd(node, offset);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    document.execCommand('insertText', false, fix.text);
  } finally { busy = false; }
  const at = window.getSelection();
  last = at?.anchorNode?.nodeType === Node.TEXT_NODE
    ? { node: at.anchorNode as Text, start: at.anchorOffset - fix.text.length, end: at.anchorOffset, original }
    : null;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Backspace' || e.ctrlKey || e.altKey || !last) { if (e.key !== 'Shift') last = null; return; }
  const sel = window.getSelection();
  const l = last;
  last = null;
  if (!sel || !sel.isCollapsed || sel.anchorNode !== l.node || sel.anchorOffset !== l.end || l.start < 0) return;
  e.preventDefault();
  e.stopPropagation();
  const r = document.createRange();
  r.setStart(l.node, l.start);
  r.setEnd(l.node, l.end);
  sel.removeAllRanges();
  sel.addRange(r);
  busy = true;
  try { document.execCommand('insertText', false, l.original); } finally { busy = false; }
}

/** Pune corectura automată pe un element editabil; întoarce funcția care o scoate. */
export function attachAutoCorrect(el: HTMLElement): () => void {
  el.addEventListener('beforeinput', onBeforeInput);
  el.addEventListener('keydown', onKeyDown, true);
  return () => { el.removeEventListener('beforeinput', onBeforeInput); el.removeEventListener('keydown', onKeyDown, true); };
}
