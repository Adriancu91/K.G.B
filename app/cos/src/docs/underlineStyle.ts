// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Sublinierea cu stil și culoare (ca în Word: Font → Stil subliniere / Culoare subliniere): simplă, dublă, groasă, punctată,
// cu liniuțe, ondulată, în orice culoare. Ctrl+U rămâne sublinierea simplă. Se păstrează în .docx și .odt.
import UnderlineBase from '@tiptap/extension-underline';
import { mergeAttributes } from '@tiptap/core';

export type UnderlineStyle = 'single' | 'double' | 'thick' | 'dotted' | 'dashed' | 'wavy';

export const UNDERLINE_STYLES: [UnderlineStyle, string][] = [
  ['single', 'Simplă'], ['double', 'Dublă'], ['thick', 'Groasă'], ['dotted', 'Punctată'], ['dashed', 'Cu liniuțe'], ['wavy', 'Ondulată'],
];

export const UNDERLINE_COLORS: [string, string][] = [
  ['', 'Culoarea textului'], ['#c00000', 'Roșu'], ['#0563c1', 'Albastru'], ['#00b050', 'Verde'], ['#ffc000', 'Portocaliu'], ['#7030a0', 'Mov'],
];

/** Stilul de subliniere Word (w:u w:val) pentru stilul nostru, și invers. */
export const WORD_UNDERLINE: Record<UnderlineStyle, string> = { single: 'single', double: 'double', thick: 'thick', dotted: 'dotted', dashed: 'dash', wavy: 'wave' };
export function fromWordUnderline(v: string | null | undefined): UnderlineStyle | null {
  if (!v || v === 'none') return null;
  if (/^double/i.test(v)) return 'double';
  if (/^wav/i.test(v)) return 'wavy';
  if (/^dotted|^dottedHeavy/i.test(v)) return 'dotted';
  if (/^dash|^dotDash|^dotDotDash/i.test(v)) return 'dashed';
  if (/^thick/i.test(v)) return 'thick';
  return 'single';
}

const okColor = (c: unknown) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null);

/** Culoarea din CSS (#rrggbb sau rgb(r, g, b)) ca #rrggbb. */
export function cssColor(v: string): string | null {
  const h = /#([0-9a-f]{6})\b/i.exec(v);
  if (h) return '#' + h[1].toLowerCase();
  const m = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/i.exec(v);
  return m ? '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('') : null;
}

/** Stilul și culoarea din valoarea CSS „text-decoration” (de exemplu „underline double rgb(192, 0, 0)”). */
export function parseDecoration(v: string): { style: UnderlineStyle | null; color: string | null } | null {
  if (!/underline/.test(v)) return null;
  const s = /\b(double|dotted|dashed|wavy)\b/.exec(v)?.[1] as UnderlineStyle | undefined;
  const thick = /\b([2-9]|\d{2,})(\.\d+)?px\b/.test(v);
  return { style: s ?? (thick ? 'thick' : null), color: cssColor(v) };
}

/** CSS-ul pentru o subliniere cu stil și culoare. */
export function decorationCss(style: string | null | undefined, color: string | null | undefined): string {
  const css: string[] = [];
  if (style && style !== 'single' && style !== 'thick') css.push(`text-decoration-style: ${style}`);
  if (style === 'thick') css.push('text-decoration-thickness: 2px');
  if (okColor(color)) css.push(`text-decoration-color: ${color}`);
  return css.join('; ');
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    underlineStyle: { setUnderlineStyle: (style: UnderlineStyle, color?: string | null) => ReturnType };
  }
}

export const Underline = UnderlineBase.extend({
  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (el) => {
          const s = (el as HTMLElement).style?.textDecorationStyle;
          const thick = parseFloat((el as HTMLElement).style?.textDecorationThickness || '') >= 2;
          return ['double', 'dotted', 'dashed', 'wavy'].includes(s) ? s : thick ? 'thick' : null;
        },
        renderHTML: () => ({}),
      },
      color: {
        default: null,
        parseHTML: (el) => cssColor((el as HTMLElement).style?.textDecorationColor || ''),
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [
      { tag: 'u' },
      {
        style: 'text-decoration',
        consuming: false,
        getAttrs: (v) => parseDecoration(String(v)) ?? false,
      },
    ];
  },
  renderHTML({ HTMLAttributes, mark }) {
    const css = decorationCss(mark.attrs.style, mark.attrs.color);
    return ['u', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, css ? { style: css } : {}), 0];
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setUnderlineStyle: (style, color) => ({ commands }) => commands.setMark(this.name, {
        style: style === 'single' ? null : style,
        color: color === undefined ? null : okColor(color),
      }),
    };
  },
});
