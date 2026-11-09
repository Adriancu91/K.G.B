// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Legături (hyperlink-uri) în text: adrese web, e-mail și semne de carte din document (#nume). Ctrl+clic pe legătură o deschide în browser.
import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    docLink: {
      setDocLink: (href: string) => ReturnType;
      unsetDocLink: () => ReturnType;
    };
  }
}

/** „exemplu.ro” → „https://exemplu.ro”, „nume@firma.ro” → „mailto:nume@firma.ro”, „#Capitol_2” rămâne (semn de carte);
 *  altceva → null. */
export function normalizeHref(raw: string): string | null {
  const t = raw.trim();
  if (!t || /[ <>"]/.test(t)) return null;
  if (/^(https?:[/][/]|mailto:)/i.test(t)) return t;
  if (/^#[\p{L}_][\p{L}\p{N}_]*$/u.test(t)) return t;
  if (/^[^@/:]+@[^@/:]+[.][a-z]{2,}$/i.test(t)) return 'mailto:' + t;
  if (/^(www[.])?[a-z0-9-]+([.][a-z0-9-]+)*[.][a-z]{2,}([/?#].*)?$/i.test(t)) return 'https://' + t;
  return null;
}

export const DocLink = Mark.create({
  name: 'link',
  inclusive: false,
  priority: 1000,

  addAttributes() {
    return {
      href: { default: null },
      // Trimiterile (crossRef.ts) țin minte ce arată: textul locului, pagina sau „mai sus / mai jos”.
      xref: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-xref'),
        renderHTML: (a) => (a.xref ? { 'data-xref': a.xref } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[href]', getAttrs: (el) => (normalizeHref(String((el as HTMLElement).getAttribute('href') ?? '')) ? null : false) }];
  },

  renderHTML({ HTMLAttributes }) {
    const href = String(HTMLAttributes.href ?? '');
    const inside = href.startsWith('#');
    return ['a', mergeAttributes(HTMLAttributes, {
      // Trimiterile spre semnele ascunse (#_Toc… din cuprinsurile Word) arată ca textul din jur, ca în Word.
      class: href.startsWith('#_') ? 'doc-link doc-link-plain' : 'doc-link', target: '_blank', rel: 'noopener noreferrer',
      title: inside ? `Semnul de carte ${href.slice(1)} (Ctrl+clic: mergi la el)` : `${href} (Ctrl+clic: deschide)`,
    }), 0];
  },

  addCommands() {
    return {
      // Fără text ales, adresa se scrie în text și devine legătură.
      setDocLink: (href) => ({ state, chain }) => {
        if (state.selection.empty && !state.selection.$from.marks().some((m) => m.type.name === this.name)) {
          const label = href.startsWith('#') ? href.slice(1).split('_').join(' ') : href.replace(/^mailto:/i, '');
          return chain().insertContent({ type: 'text', text: label, marks: [{ type: this.name, attrs: { href } }] }).run();
        }
        return chain().extendMarkRange(this.name).setMark(this.name, { href }).run();
      },
      unsetDocLink: () => ({ chain }) => chain().extendMarkRange(this.name).unsetMark(this.name).run(),
    };
  },
});
