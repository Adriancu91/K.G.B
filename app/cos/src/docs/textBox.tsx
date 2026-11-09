// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Caseta de text (Word: Inserare → Casetă text): un chenar cu text propriu, pus la stânga sau la dreapta paginii,
// cu textul documentului curgând pe lângă el, ori pe un rând separat. Bună pentru citate scoase în evidență, note laterale, avertismente.
// În .docx ajunge ca un cadru de text (w:framePr) cu chenar și fundal; în .odt și în text simplu, ca paragrafe obișnuite.
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import './textBox.css';

export type TextBoxAlign = 'wrapLeft' | 'wrapRight' | 'left' | 'center' | 'right';
const ALIGNS: TextBoxAlign[] = ['wrapLeft', 'wrapRight', 'left', 'center', 'right'];
const HEX = /^#[0-9a-f]{6}$/i;
export const TEXTBOX_MIN = 80;
export const TEXTBOX_MAX = 650;

/** Culorile de fundal din bara casetei (deschise, ca textul negru să se citească și la tipărire). */
export const TEXTBOX_FILLS: [string, string][] = [
  ['', 'Fără fundal'], ['#f1f1f4', 'Gri'], ['#fef9c3', 'Galben'], ['#dbeafe', 'Albastru'], ['#dcfce7', 'Verde'], ['#fce7f3', 'Roz'],
];
/** Culorile chenarului; '' = fără chenar. */
export const TEXTBOX_BORDERS: [string, string][] = [
  ['#6b6b80', 'Chenar gri'], ['#000000', 'Chenar negru'], ['#2563eb', 'Chenar albastru'], ['#dc2626', 'Chenar roșu'], ['', 'Fără chenar'],
];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textBox: {
      /** Pune o casetă de text la cursor; textul ales intră în ea. */
      insertTextBox: (attrs?: { align?: TextBoxAlign; width?: number }) => ReturnType;
    };
  }
}

export const TextBox = Node.create({
  name: 'textBox',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  draggable: true,

  addAttributes() {
    return {
      align: {
        default: 'wrapRight',
        parseHTML: (el) => { const a = el.getAttribute('data-align') as TextBoxAlign | null; return a && ALIGNS.includes(a) ? a : 'wrapRight'; },
        renderHTML: (a) => ({ 'data-align': a.align }),
      },
      width: {
        default: 240,
        parseHTML: (el) => { const w = parseInt(el.getAttribute('data-width') ?? '', 10); return Number.isFinite(w) ? clampWidth(w) : 240; },
        renderHTML: (a) => ({ 'data-width': a.width }),
      },
      border: {
        default: '#6b6b80',
        parseHTML: (el) => { const v = el.getAttribute('data-border'); return v === null ? '#6b6b80' : HEX.test(v) ? v.toLowerCase() : ''; },
        renderHTML: (a) => ({ 'data-border': a.border ?? '' }),
      },
      fill: {
        default: '',
        parseHTML: (el) => { const v = el.getAttribute('data-fill') ?? ''; return HEX.test(v) ? v.toLowerCase() : ''; },
        renderHTML: (a) => (a.fill ? { 'data-fill': a.fill } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-textbox]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-textbox': '', class: `doc-textbox align-${node.attrs.align}`, style: boxStyle(node.attrs) }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TextBoxView);
  },

  addCommands() {
    return {
      insertTextBox: (attrs = {}) => ({ state, chain }) => {
        const { from, to, empty } = state.selection;
        const picked = empty ? '' : state.doc.textBetween(from, to, '\n').trim();
        const paras = (picked || 'Scrie aici textul casetei').split('\n').filter((l) => l.trim()).slice(0, 50)
          .map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] }));
        const box = { type: this.name, attrs: { align: attrs.align ?? 'wrapRight', width: clampWidth(attrs.width ?? 240) }, content: paras };
        // Paragrafe alese în întregime (sau cursorul într-un paragraf gol): caseta le ia locul, fără să lase rânduri goale în urmă.
        const { $from, $to } = state.selection;
        const whole = $from.parent.isTextblock && $to.parent.isTextblock && $from.parentOffset === 0 && $to.parentOffset === $to.parent.content.size
          && $from.depth === $to.depth && (!empty || $from.parent.content.size === 0);
        if (whole) return chain().insertContentAt({ from: $from.before(), to: $to.after() }, box).run();
        return chain().insertContent(box).run();
      },
    };
  },
});

export function clampWidth(w: number): number {
  return Math.round(Math.min(TEXTBOX_MAX, Math.max(TEXTBOX_MIN, w)));
}

function boxStyle(a: Record<string, unknown>): string {
  const parts = [`width: ${clampWidth(Number(a.width) || 240)}px`];
  if (a.border) parts.push(`border-color: ${a.border}`);
  else parts.push('border-color: transparent');
  if (a.fill) parts.push(`background-color: ${a.fill}`);
  return parts.join('; ');
}

function TextBoxView({ node, updateAttributes, deleteNode, editor, getPos }: NodeViewProps) {
  const align: TextBoxAlign = node.attrs.align ?? 'wrapRight';
  const width = clampWidth(Number(node.attrs.width) || 240);
  const editable = editor.isEditable;

  // Tragerea marginii din dreapta (sau din stânga, la casetele puse în dreapta) schimbă lățimea.
  const startResize = (e: React.PointerEvent, dir: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const box = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    let w = width;
    const move = (ev: PointerEvent) => {
      w = clampWidth(width + (ev.clientX - startX) * dir * (align === 'center' ? 2 : 1));
      box.style.width = `${w}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      updateAttributes({ width: w });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const remove = () => {
    deleteNode();
    editor.commands.focus();
  };
  // „Scoate textul”: caseta dispare, dar paragrafele ei rămân în document, pe locul ei.
  const unwrap = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, node.content);
    editor.view.dispatch(tr);
    editor.commands.focus();
  };

  return (
    <NodeViewWrapper
      className={`doc-textbox align-${align}`}
      data-textbox=""
      style={{ width, borderColor: node.attrs.border || 'transparent', backgroundColor: node.attrs.fill || undefined }}
    >
      {editable && (
        <div className="tb-bar" contentEditable={false}>
          <span className="tb-grip" data-drag-handle draggable title="Trage caseta în alt loc din document">⠿</span>
          <select
            value={align}
            title="Locul casetei"
            aria-label="Locul casetei"
            onChange={(e) => updateAttributes({ align: e.target.value })}
          >
            <option value="wrapLeft">Stânga, cu textul în jur</option>
            <option value="wrapRight">Dreapta, cu textul în jur</option>
            <option value="left">Stânga, pe rândul ei</option>
            <option value="center">Centru, pe rândul ei</option>
            <option value="right">Dreapta, pe rândul ei</option>
          </select>
          <select
            value={node.attrs.border ?? ''}
            title="Chenarul casetei"
            aria-label="Chenarul casetei"
            onChange={(e) => updateAttributes({ border: e.target.value })}
          >
            {TEXTBOX_BORDERS.map(([v, l]) => <option key={v || 'none'} value={v}>{l}</option>)}
          </select>
          <select
            value={node.attrs.fill ?? ''}
            title="Fundalul casetei"
            aria-label="Fundalul casetei"
            onChange={(e) => updateAttributes({ fill: e.target.value })}
          >
            {TEXTBOX_FILLS.map(([v, l]) => <option key={v || 'none'} value={v}>{l}</option>)}
          </select>
          <button className="fmt" title="Scoate textul din casetă (caseta dispare, textul rămâne)" onClick={unwrap}>⇱</button>
          <button className="fmt" title="Șterge caseta cu tot textul ei" onClick={remove}>🗑</button>
        </div>
      )}
      <NodeViewContent className="tb-content" />
      {editable && (
        <span
          className={`tb-resize ${align === 'wrapRight' || align === 'right' ? 'left' : 'right'}`}
          contentEditable={false}
          title="Trage ca să schimbi lățimea casetei"
          onPointerDown={(e) => startResize(e, align === 'wrapRight' || align === 'right' ? -1 : 1)}
        />
      )}
    </NodeViewWrapper>
  );
}
