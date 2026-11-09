// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Titluri pliabile și modul Schiță (Word: „Expand/Collapse” la titluri și vederea Outline).
// Un clic pe ▾ din fața unui titlu ascunde tot ce urmează după el, până la următorul titlu de același nivel sau mai mare.
// În Schiță se văd doar titlurile, până la nivelul ales (sau și textul, cu titlurile pliabile).
// Doar pe ecran: documentul nu se schimbă, iar la tipărire și în PDF se vede tot (vezi .pm-collapsed din styles.css).
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, EditorState, Selection, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapse: {
      /** Strânge / desface titlul de la poziția dată (începutul nodului). */
      toggleHeadingCollapse: (pos: number) => ReturnType;
      /** Strânge toate titlurile (true) sau le desface pe toate (false). */
      collapseAllHeadings: (on: boolean) => ReturnType;
      /** Schița: 0 = oprită, 1–6 = titlurile până la nivelul acesta, 9 = tot textul (cu titlurile pliabile mereu vizibile). */
      setOutlineLevel: (level: number) => ReturnType;
      /** Mută blocul în care e cursorul (un titlu: cu tot ce e sub el) mai sus (-1) sau mai jos (1). */
      moveOutlineBlock: (dir: -1 | 1) => ReturnType;
      /** Ridică (-1) sau coboară (1) nivelul titlului; un paragraf ridicat devine titlu, la nivelul titlului de deasupra. */
      shiftOutlineLevel: (delta: -1 | 1) => ReturnType;
    };
  }
}

interface CollapseState { collapsed: number[]; outline: number }
type Meta = { toggle: number } | { all: boolean } | { outline: number };
const key = new PluginKey<CollapseState>('collapse');

/** Titlurile de sus din document: poziția și nivelul. */
function headings(doc: PMNode): { pos: number; level: number }[] {
  const out: { pos: number; level: number }[] = [];
  doc.forEach((node, pos) => { if (node.type.name === 'heading') out.push({ pos, level: Number(node.attrs.level) || 1 }); });
  return out;
}

/** Ce blocuri de sus se ascund: cele de sub un titlu strâns și, în Schiță, textul și titlurile de sub nivelul ales. */
export function hiddenBlocks(doc: PMNode, collapsed: Set<number>, outline: number): Set<number> {
  const hidden = new Set<number>();
  let under = 0; // nivelul titlului strâns sub care suntem (0 = niciunul)
  doc.forEach((node, pos) => {
    const level = node.type.name === 'heading' ? Number(node.attrs.level) || 1 : 0;
    if (level && under && level <= under) under = 0;
    const byOutline = outline > 0 && outline < 9 && (!level || level > outline);
    if (under || byOutline) hidden.add(pos);
    else if (level && collapsed.has(pos)) under = level;
  });
  return hidden;
}

/**
 * Ce se mută la Alt+Shift+↑/↓ pentru blocul de sus cu indicele `i`: un titlu cu tot ce e sub el, peste titlul vecin de același nivel
 * (cu tot ce e sub acela); alt bloc, peste blocul vecin. `at` = unde se pune (în documentul de dinainte). Fără vecin: null.
 */
export function moveRange(doc: PMNode, i: number, dir: -1 | 1): { from: number; to: number; at: number } | null {
  const blocks: { pos: number; level: number }[] = [];
  doc.forEach((node, pos) => blocks.push({ pos, level: node.type.name === 'heading' ? Number(node.attrs.level) || 1 : 0 }));
  if (i < 0 || i >= blocks.length) return null;
  const posOf = (k: number) => (k < blocks.length ? blocks[k].pos : doc.content.size);
  const L = blocks[i].level;
  const endOf = (k: number, lv: number) => { let j = k + 1; if (lv) while (j < blocks.length && !(blocks[j].level && blocks[j].level <= lv)) j++; return j; };
  const j = endOf(i, L);
  if (dir < 0) {
    let k = i - 1;
    if (L) { while (k >= 0 && !(blocks[k].level && blocks[k].level <= L)) k--; if (k < 0 || blocks[k].level !== L) return null; }
    if (k < 0) return null;
    return { from: posOf(i), to: posOf(j), at: posOf(k) };
  }
  if (j >= blocks.length || (L && blocks[j].level !== L)) return null;
  return { from: posOf(i), to: posOf(j), at: posOf(L ? endOf(j, L) : j + 1) };
}

function decorations(state: EditorState): DecorationSet | null {
  const st = key.getState(state);
  if (!st) return null;
  const { doc } = state;
  const list = headings(doc);
  if (!list.length) return null;
  const collapsed = new Set(st.collapsed);
  const hidden = hiddenBlocks(doc, collapsed, st.outline);
  const decos: Decoration[] = [];
  const levels = new Map(list.map((h) => [h.pos, h.level]));
  doc.forEach((node, pos) => {
    if (hidden.has(pos)) { decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'pm-collapsed' })); return; }
    if (!levels.has(pos)) return;
    // Un titlu are ce strânge doar dacă după el urmează ceva până la următorul titlu de același nivel sau mai mare.
    const next = doc.childAfter(pos + node.nodeSize).node;
    if (!next || (next.type.name === 'heading' && (Number(next.attrs.level) || 1) <= levels.get(pos)!)) return;
    const shut = collapsed.has(pos);
    if (shut) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'pm-heading-collapsed' }));
    decos.push(Decoration.widget(pos + 1, (view) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pm-fold' + (shut ? ' shut' : '');
      b.contentEditable = 'false';
      b.textContent = shut ? '▸' : '▾';
      b.title = shut ? 'Desface: arată ce e sub acest titlu' : 'Strânge: ascunde ce e sub acest titlu (doar pe ecran)';
      b.setAttribute('aria-label', shut ? 'Desface titlul' : 'Strânge titlul');
      b.setAttribute('aria-expanded', String(!shut));
      b.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        view.dispatch(view.state.tr.setMeta(key, { toggle: pos } satisfies Meta));
      });
      return b;
    }, { side: -1, ignoreSelection: true, key: `fold-${pos}-${shut ? 1 : 0}` }));
  });
  return DecorationSet.create(doc, decos);
}

export const Collapse = Extension.create({
  name: 'collapse',
  addCommands() {
    return {
      toggleHeadingCollapse: (pos: number) => ({ tr, dispatch }) => { dispatch?.(tr.setMeta(key, { toggle: pos } satisfies Meta)); return true; },
      collapseAllHeadings: (on: boolean) => ({ tr, dispatch }) => { dispatch?.(tr.setMeta(key, { all: on } satisfies Meta)); return true; },
      setOutlineLevel: (level: number) => ({ tr, dispatch }) => { dispatch?.(tr.setMeta(key, { outline: level } satisfies Meta)); return true; },
      moveOutlineBlock: (dir: -1 | 1) => ({ state, tr, dispatch }) => {
        const r = moveRange(state.doc, state.selection.$from.index(0), dir);
        if (!r) return false;
        if (dispatch) {
          const { from, to, at } = r;
          const content = state.doc.slice(from, to).content;
          const off = state.selection.from - from, len = state.selection.to - state.selection.from;
          let start: number;
          if (dir < 0) { tr.delete(from, to); tr.insert(at, content); start = at; }
          else { tr.insert(at, content); tr.delete(from, to); start = at - (to - from); }
          try { tr.setSelection(TextSelection.create(tr.doc, start + off, Math.min(start + off + len, tr.doc.content.size))); }
          catch { tr.setSelection(Selection.near(tr.doc.resolve(Math.min(start + 1, tr.doc.content.size)))); }
          dispatch(tr.scrollIntoView());
        }
        return true;
      },
      shiftOutlineLevel: (delta: -1 | 1) => ({ state, tr, dispatch }) => {
        const i = state.selection.$from.index(0);
        let pos = 0;
        for (let k = 0; k < i; k++) pos += state.doc.child(k).nodeSize;
        const node = state.doc.child(i);
        const heading = state.schema.nodes.heading;
        if (!heading) return false;
        let level: number;
        if (node.type === heading) {
          level = (Number(node.attrs.level) || 1) + delta;
          if (level < 1 || level > 6) return false;
        } else if (node.type.name === 'paragraph' && delta < 0) {
          // Ca în schița din Word: textul ridicat devine titlu la nivelul titlului de deasupra.
          level = 1;
          for (let k = i - 1; k >= 0; k--) { const n = state.doc.child(k); if (n.type === heading) { level = Number(n.attrs.level) || 1; break; } }
        } else return false;
        dispatch?.(tr.setNodeMarkup(pos, heading, { ...node.attrs, level }));
        return true;
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      'Alt-Shift-ArrowUp': () => this.editor.commands.moveOutlineBlock(-1),
      'Alt-Shift-ArrowDown': () => this.editor.commands.moveOutlineBlock(1),
      'Alt-Shift-ArrowLeft': () => this.editor.commands.shiftOutlineLevel(-1),
      'Alt-Shift-ArrowRight': () => this.editor.commands.shiftOutlineLevel(1),
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin<CollapseState>({
      key,
      state: {
        init: () => ({ collapsed: [], outline: 0 }),
        apply: (tr, st, _old, next) => {
          let { collapsed, outline } = st;
          if (tr.docChanged && collapsed.length) {
            // Titlurile strânse își urmează locul când se scrie în document; cele șterse sau schimbate în text se uită.
            collapsed = [...new Set(collapsed.map((p) => tr.mapping.map(p)))].filter((p) => next.doc.nodeAt(p)?.type.name === 'heading');
          }
          const m = tr.getMeta(key) as Meta | undefined;
          if (m && 'toggle' in m) collapsed = collapsed.includes(m.toggle) ? collapsed.filter((p) => p !== m.toggle) : [...collapsed, m.toggle];
          if (m && 'all' in m) collapsed = m.all ? headings(next.doc).map((h) => h.pos) : [];
          if (m && 'outline' in m) outline = m.outline;
          return collapsed === st.collapsed && outline === st.outline ? st : { collapsed, outline };
        },
      },
      props: {
        attributes: (state): Record<string, string> => (key.getState(state)?.outline ? { class: 'pm-outline' } : {}),
        decorations,
      },
    })];
  },
});

export const outlineLevel = (state: EditorState) => key.getState(state)?.outline ?? 0;
export const collapsedCount = (state: EditorState) => key.getState(state)?.collapsed.length ?? 0;
