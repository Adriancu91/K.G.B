// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Indice / exponent (H₂O, m²) și formatul paragrafului: spațierea rândurilor și retragerea de la stânga.
import { Extension, Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    scriptMarks: {
      toggleSuperscript: () => ReturnType;
      toggleSubscript: () => ReturnType;
    };
    paragraphFormat: {
      setLineHeight: (value: string | null) => ReturnType;
      changeIndent: (delta: number) => ReturnType;
      /** Spațiul înainte / după (pt) și prima linie (cm; negativ = agățată); null = ca de obicei. */
      setParagraphSpacing: (attrs: ParagraphSpacing) => ReturnType;
    };
  }
}

/** O retragere = 1,25 cm (ca tasta „Mărire indent” din Word). */
export const INDENT_CM = 1.25;
export const MAX_INDENT = 8;
export const LINE_HEIGHTS = ['1', '1.15', '1.5', '2', '2.5', '3'];
/** Un rând „simplu” din Word e cam 1,2 din mărimea fontului, deci „1,5 rânduri” = line-height 1,8 pe ecran. */
const WORD_LINE = 1.2;

export const Superscript = Mark.create({
  name: 'superscript',
  excludes: 'subscript',
  parseHTML: () => [{ tag: 'sup' }, { style: 'vertical-align', getAttrs: (v) => (v === 'super' ? null : false) }],
  renderHTML: ({ HTMLAttributes }) => ['sup', mergeAttributes(HTMLAttributes), 0],
  addCommands() {
    return { toggleSuperscript: () => ({ commands }) => commands.toggleMark(this.name) };
  },
  // Ctrl+. ca în Google Docs, Ctrl+Shift+= ca în Word.
  addKeyboardShortcuts() {
    return { 'Mod-.': () => this.editor.commands.toggleSuperscript(), 'Mod-Shift-=': () => this.editor.commands.toggleSuperscript() };
  },
});

export const Subscript = Mark.create({
  name: 'subscript',
  excludes: 'superscript',
  parseHTML: () => [{ tag: 'sub' }, { style: 'vertical-align', getAttrs: (v) => (v === 'sub' ? null : false) }],
  renderHTML: ({ HTMLAttributes }) => ['sub', mergeAttributes(HTMLAttributes), 0],
  addCommands() {
    return { toggleSubscript: () => ({ commands }) => commands.toggleMark(this.name) };
  },
  addKeyboardShortcuts() {
    return { 'Mod-,': () => this.editor.commands.toggleSubscript(), 'Mod-=': () => this.editor.commands.toggleSubscript() };
  },
});

const TYPES = ['paragraph', 'heading'];

/** Limitele din Word: spațiere 0…1584 pt; prima linie până la ~55 cm (o păstrăm sub 10 cm, cât încape pe pagină). */
export const MAX_SPACE = 1584;
export const MAX_FIRST = 10;
/** Retragerea la dreapta, cel mult (cm). */
export const MAX_RIGHT = 15;
/** Variantele din fereastra „¶ Paragraf”. */
export const SPACE_STEPS = [0, 3, 6, 8, 12, 18, 24, 36];
export const FIRST_LINE_STEPS = [0.5, 0.63, 1, 1.25, 1.5, 2];

function readNum(v: string | null, min: number, max: number): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : null;
}

export interface ParagraphSpacing { spaceBefore?: number | null; spaceAfter?: number | null; firstLine?: number | null; keepNext?: boolean; keepLines?: boolean; noWidow?: boolean; indent?: number; indentRight?: number | null }

export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',
  addGlobalAttributes() {
    return [{
      types: TYPES,
      attributes: {
        lineHeight: {
          default: null,
          // Valoarea e în „rânduri” Word (1; 1,15; 1,5…), ca la export și în listă.
          parseHTML: (el) => {
            const own = el.getAttribute('data-line-height');
            if (own && /^\d+(\.\d+)?$/.test(own)) return own;
            const v = el.style.lineHeight;
            return v && /^\d+(\.\d+)?$/.test(v) ? String(Math.round((Number(v) / WORD_LINE) * 100) / 100) : null;
          },
          renderHTML: (a) => (a.lineHeight
            ? { 'data-line-height': a.lineHeight, style: `line-height: ${Math.round(Number(a.lineHeight) * WORD_LINE * 100) / 100}` }
            : {}),
        },
        // Retragerea la stânga, în trepte de 1,25 cm (⇤ ⇥ merg din treaptă în treaptă); poate fi și fracționară, pentru cm exacți.
        indent: {
          default: 0,
          parseHTML: (el) => Math.min(MAX_INDENT, Math.max(0, Math.round((Number(el.getAttribute('data-indent')) || 0) * 100) / 100)),
          renderHTML: (a) => (a.indent > 0 ? { 'data-indent': a.indent, style: `margin-left: ${Math.round(a.indent * INDENT_CM * 100) / 100}cm` } : {}),
        },
        // Retragerea la dreapta, în cm (Word: Paragraf → Retragere → Dreapta).
        indentRight: {
          default: null,
          parseHTML: (el) => readNum(el.getAttribute('data-indent-right'), 0, MAX_RIGHT) || null,
          renderHTML: (a) => (a.indentRight > 0 ? { 'data-indent-right': a.indentRight, style: `margin-right: ${a.indentRight}cm` } : {}),
        },
        // Spațiul înainte / după paragraf, în puncte (Word: Paragraf → Spațiere). null = cel obișnuit.
        spaceBefore: {
          default: null,
          parseHTML: (el) => readNum(el.getAttribute('data-space-before'), 0, MAX_SPACE),
          renderHTML: (a) => (a.spaceBefore !== null ? { 'data-space-before': a.spaceBefore, style: `margin-top: ${a.spaceBefore}pt` } : {}),
        },
        spaceAfter: {
          default: null,
          parseHTML: (el) => readNum(el.getAttribute('data-space-after'), 0, MAX_SPACE),
          renderHTML: (a) => (a.spaceAfter !== null ? { 'data-space-after': a.spaceAfter, style: `margin-bottom: ${a.spaceAfter}pt` } : {}),
        },
        // Word: Paragraf → Sfârșituri de linie și de pagină. „Păstrează cu următorul”: paragraful nu rămâne singur la capătul paginii
        // (de exemplu un titlu despărțit de textul lui); „Păstrează liniile împreună”: paragraful nu se rupe pe două pagini.
        keepNext: {
          default: false,
          parseHTML: (el) => el.hasAttribute('data-keep-next'),
          renderHTML: (a) => (a.keepNext ? { 'data-keep-next': '', style: 'break-after: avoid' } : {}),
        },
        keepLines: {
          default: false,
          parseHTML: (el) => el.hasAttribute('data-keep-lines'),
          renderHTML: (a) => (a.keepLines ? { 'data-keep-lines': '', style: 'break-inside: avoid' } : {}),
        },
        // Controlul rândurilor văduve / orfane: pornit de la sine (nu rămâne un singur rând al paragrafului singur sus sau jos
        // pe pagină). noWidow = oprit pentru paragraful acesta (w:widowControl w:val="0", fo:widows="1").
        noWidow: {
          default: false,
          parseHTML: (el) => el.hasAttribute('data-no-widow'),
          renderHTML: (a) => (a.noWidow ? { 'data-no-widow': '', style: 'widows: 1; orphans: 1' } : {}),
        },
        // Prima linie, în cm: pozitiv = retrasă (ca la romane), negativ = agățată (prima linie iese în stânga, restul rândurilor sunt retrase).
        firstLine: {
          default: null,
          parseHTML: (el) => readNum(el.getAttribute('data-first-line'), -MAX_FIRST, MAX_FIRST),
          renderHTML: (a) => {
            const v = Number(a.firstLine);
            if (!v) return {};
            return { 'data-first-line': v, style: v > 0 ? `text-indent: ${v}cm` : `text-indent: ${v}cm; padding-left: ${-v}cm` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineHeight: (value) => ({ commands }) =>
        TYPES.map((t) => commands.updateAttributes(t, { lineHeight: value })).some(Boolean),
      setParagraphSpacing: (attrs) => ({ commands }) =>
        TYPES.map((t) => commands.updateAttributes(t, attrs)).some(Boolean),
      changeIndent: (delta) => ({ state, tr, dispatch }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!TYPES.includes(node.type.name)) return;
          // De la o retragere fracționară (cm exacți) se sare la treapta următoare / anterioară.
          const cur = Number(node.attrs.indent) || 0;
          const next = Math.min(MAX_INDENT, Math.max(0, delta > 0 ? Math.floor(cur + 1e-6) + delta : Math.ceil(cur - 1e-6) + delta));
          if (next === node.attrs.indent) return false;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
          return false;
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      },
    };
  },
});
