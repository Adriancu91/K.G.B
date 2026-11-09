// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Chenar și fundal pentru paragrafe (Word: „Borduri și umbrire”): casete pentru note importante, avertismente, citate.
// Paragrafele vecine cu chenar se văd ca o singură casetă (ca în Word), din CSS.
import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphBox: {
      toggleParagraphBox: () => ReturnType;
      toggleDropCap: () => ReturnType;
      /** Culoarea de fundal a paragrafelor alese („#fef9c3”); null = fără. */
      setParagraphShade: (color: string | null) => ReturnType;
      /** Chenarul paragrafelor alese: laturile, linia și culoarea („tb-double-2563eb”); null = fără chenar. */
      setParagraphBorder: (look: BoxLook | null) => ReturnType;
    };
  }
}

/** Culorile din lista „Fundal paragraf”: deschise, ca textul negru să se citească bine și la tipărire. */
export const PARAGRAPH_SHADES: [string, string][] = [
  ['', 'Fundal'], ['#f1f1f4', 'Gri'], ['#fef9c3', 'Galben'], ['#dbeafe', 'Albastru'], ['#dcfce7', 'Verde'], ['#fce7f3', 'Roz'], ['#ffedd5', 'Portocaliu'],
  ['#ede9fe', 'Mov'], ['#ccfbf1', 'Turcoaz'], ['#fee2e2', 'Roșu'], ['#d9d9d9', 'Gri mai închis'],
];

/**
 * Cum arată chenarul (Borders and Shading): laturile (tot, sus, jos, sus și jos, bară în stânga), linia și culoarea.
 * Se ține ca un singur text, „laturi-linie-culoare”, de exemplu „tb-double-2563eb”; lipsă = chenar complet, subțire, gri.
 */
export type BoxSides = 'all' | 'top' | 'bottom' | 'tb' | 'left';
export type BoxLine = 'single' | 'thick' | 'double' | 'dashed' | 'dotted';
export interface BoxLook { sides: BoxSides; line: BoxLine; color: string }
export const BOX_SIDES: [BoxSides, string][] = [['all', 'Chenar complet'], ['top', 'Linie sus'], ['bottom', 'Linie jos'], ['tb', 'Sus și jos'], ['left', 'Bară în stânga']];
export const BOX_LINES: [BoxLine, string][] = [['single', 'Subțire'], ['thick', 'Groasă'], ['double', 'Dublă'], ['dashed', 'Întreruptă'], ['dotted', 'Punctată']];
export const BOX_DEFAULT: BoxLook = { sides: 'all', line: 'single', color: '#6b6b80' };
const LOOK = /^(all|top|bottom|tb|left)-(single|thick|double|dashed|dotted)-([0-9a-f]{6})$/;
/** „tb-double-2563eb” → { sides, line, color }; orice altceva → chenarul obișnuit. */
export function parseBoxLook(v: unknown): BoxLook {
  const m = typeof v === 'string' ? LOOK.exec(v.toLowerCase()) : null;
  return m ? { sides: m[1] as BoxSides, line: m[2] as BoxLine, color: '#' + m[3] } : { ...BOX_DEFAULT };
}
/** Textul păstrat în document; null pentru chenarul obișnuit (ca fișierele vechi să rămână la fel). */
export function boxLookText(l: BoxLook): string | null {
  const c = l.color.replace('#', '').toLowerCase();
  const t = `${l.sides}-${l.line}-${/^[0-9a-f]{6}$/.test(c) ? c : '6b6b80'}`;
  return t === 'all-single-6b6b80' ? null : t;
}

const TYPES = ['paragraph', 'heading'];
const HEX = /^#[0-9a-f]{6}$/i;

export const ParagraphBox = Extension.create({
  name: 'paragraphBox',
  addGlobalAttributes() {
    return [{
      types: TYPES,
      attributes: {
        box: {
          default: false,
          parseHTML: (el) => el.getAttribute('data-box') === '1',
          renderHTML: (a) => (a.box ? { 'data-box': '1' } : {}),
        },
        boxLook: {
          default: null,
          parseHTML: (el) => { const v = (el.getAttribute('data-box-look') ?? '').toLowerCase(); return LOOK.test(v) ? v : null; },
          renderHTML: (a) => {
            if (!a.box || !a.boxLook) return {};
            const l = parseBoxLook(a.boxLook);
            return { 'data-box-look': a.boxLook, 'data-box-sides': l.sides, 'data-box-line': l.line, style: `--box-c: ${l.color}` };
          },
        },
        // Letrina (Word: Inserare → Letrină): prima literă a paragrafului mare, pe 3 rânduri, cu textul în jurul ei.
        dropCap: {
          default: false,
          parseHTML: (el) => el.hasAttribute('data-dropcap'),
          renderHTML: (a) => (a.dropCap ? { 'data-dropcap': '' } : {}),
        },
        shade: {
          default: null,
          parseHTML: (el) => { const v = el.getAttribute('data-shade') ?? ''; return HEX.test(v) ? v.toLowerCase() : null; },
          renderHTML: (a) => (a.shade ? { 'data-shade': a.shade, style: `background-color: ${a.shade}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      toggleDropCap: () => ({ state, tr, dispatch }) => {
        const { $from } = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name !== 'paragraph') continue;
          if (dispatch) dispatch(tr.setNodeMarkup($from.before(d), undefined, { ...node.attrs, dropCap: !node.attrs.dropCap }));
          return true;
        }
        return false;
      },
      toggleParagraphBox: () => ({ state, tr, dispatch }) => {
        const { from, to } = state.selection;
        const blocks: { pos: number; attrs: Record<string, unknown> }[] = [];
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!TYPES.includes(node.type.name)) return;
          blocks.push({ pos, attrs: node.attrs });
          return false;
        });
        if (!blocks.length) return false;
        // Dacă toate au deja chenar, îl scoatem; altfel îl punem tuturor.
        const on = !blocks.every((b) => b.attrs.box);
        if (dispatch) {
          for (const b of blocks) tr.setNodeMarkup(b.pos, undefined, { ...b.attrs, box: on });
          dispatch(tr);
        }
        return true;
      },
      setParagraphBorder: (look) => ({ state, tr, dispatch }) => {
        const { from, to } = state.selection;
        let any = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!TYPES.includes(node.type.name)) return;
          any = true;
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, box: !!look, boxLook: look ? boxLookText(look) : null });
          return false;
        });
        if (any && dispatch) dispatch(tr);
        return any;
      },
      setParagraphShade: (color) => ({ commands }) =>
        TYPES.map((t) => commands.updateAttributes(t, { shade: color && HEX.test(color) ? color.toLowerCase() : null })).some(Boolean),
    };
  },
});
