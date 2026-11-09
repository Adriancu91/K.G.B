// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Întreruperea de secțiune (Aspect → Întreruperi, ca în procesorul de text cunoscut): documentul se împarte în secțiuni.
// „Pagina următoare” / „Pagină pară” / „Pagină impară” încep secțiunea nouă pe o pagină nouă, „Continuu” pe aceeași pagină.
// Pe ecran e o linie dublă punctată cu felul ei; în .docx devine w:sectPr (dus-întors), în .odt o rupere de pagină.
import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { HF_LINE, ORIENT_LINE, SECTION_LINE, SECTION_MARK, marginLine, sectionClass, sectionHf, sectionKind, sectionMargin, sectionNewPage, sectionOrient, type SectionKind, type SectionOrient } from './sectionKinds';

export * from './sectionKinds';

/** Banda discretă de pe ecran cu antetul sau subsolul unei secțiuni (la tipărire și PDF nu apare: acolo e pe paginile ei). */
function hfBand(kind: 'top' | 'bottom', sec: number, text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = `doc-sec-hf doc-sec-hf-${kind}`; d.contentEditable = 'false'; d.setAttribute('aria-hidden', 'true');
  d.title = kind === 'top' ? `Antetul secțiunii ${sec}` : `Subsolul secțiunii ${sec}`;
  d.textContent = text;
  return d;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sectionBreak: { setSectionBreak: (kind: SectionKind, orient?: SectionOrient, margin?: number) => ReturnType; setSectionHf: (hdr: string | null, ftr: string | null) => ReturnType; setSectionOrient: (orient: SectionOrient) => ReturnType; setSectionMargin: (mm: number) => ReturnType };
  }
}

/** Locul întreruperii de secțiune dinaintea cursorului (-1 = cursorul e în prima secțiune). */
export function breakBefore(state: import('@tiptap/pm/state').EditorState, name: string): number {
  const { $from } = state.selection;
  const at = $from.depth ? $from.before(1) : $from.pos;
  let pos = -1;
  state.doc.forEach((n, off) => { if (off < at && n.type.name === name) pos = off; });
  return pos;
}

export const SectionBreak = Node.create({
  name: 'sectionBreak',
  group: 'block',
  atom: true,
  selectable: true,

  // Antetul și subsolul documentului (cu câmpurile completate), puse de Docs.tsx: secțiunile legate de anterior le moștenesc.
  addStorage() {
    return { header: '', footer: '', fill: (t: string) => t };
  },

  addAttributes() {
    return {
      kind: {
        default: 'nextPage',
        parseHTML: (el) => sectionKind(el.getAttribute('data-section-break')),
        renderHTML: () => ({}),
      },
      orient: {
        default: '',
        parseHTML: (el) => sectionOrient(el.getAttribute('data-orient')),
        renderHTML: () => ({}),
      },
      margin: {
        default: 0,
        parseHTML: (el) => sectionMargin(el.getAttribute('data-margin')),
        renderHTML: () => ({}),
      },
      // Antetul și subsolul propriu al secțiunii de după (null = legat de anterior).
      hdr: {
        default: null,
        parseHTML: (el) => sectionHf(el.getAttribute('data-hdr')),
        renderHTML: () => ({}),
      },
      ftr: {
        default: null,
        parseHTML: (el) => sectionHf(el.getAttribute('data-ftr')),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    // Înaintea „paginii noi”: elementul are și data-page-break.
    return [{ tag: 'div[data-section-break]', priority: 60 }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = sectionKind(node.attrs.kind);
    const orient = sectionOrient(node.attrs.orient), margin = sectionMargin(node.attrs.margin);
    // data-page-break îl face pagină nouă și pentru numărarea paginilor (pageCount.ts), la fel ca Ctrl+Enter.
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-section-break': kind,
      ...(sectionNewPage(kind) ? { 'data-page-break': '' } : {}),
      'data-txt': SECTION_LINE[kind],
      ...(orient ? { 'data-orient': orient, 'data-otxt': ORIENT_LINE[orient] } : {}),
      ...(margin ? { 'data-margin': String(margin), 'data-mtxt': marginLine(margin) } : {}),
      ...(sectionHf(node.attrs.hdr) !== null ? { 'data-hdr': sectionHf(node.attrs.hdr) } : {}),
      ...(sectionHf(node.attrs.ftr) !== null ? { 'data-ftr': sectionHf(node.attrs.ftr) } : {}),
      ...(sectionHf(node.attrs.hdr) !== null || sectionHf(node.attrs.ftr) !== null ? { 'data-htxt': HF_LINE } : {}),
      class: 'doc-section-break',
    })];
  },

  // Paragrafele unei secțiuni cu orientarea ei primesc clasa doc-sect-landscape / doc-sect-portrait: la tipărire și PDF
  // ajung pe pagina cu numele ei (@page doc-sect-landscape din Docs.tsx), culcată sau în picioare.
  addProseMirrorPlugins() {
    const name = this.name, store = this.storage as { header: string; footer: string; fill: (t: string) => string };
    const build = (doc: import('@tiptap/pm/model').Node) => {
      const decos: Decoration[] = [];
      let orient: SectionOrient = '', margin = 0, sec = 0, ownHf = false, hdr = store.header, ftr = store.footer;
      doc.forEach((n) => { if (n.type.name === name && (sectionHf(n.attrs.hdr) !== null || sectionHf(n.attrs.ftr) !== null)) ownHf = true; });
      doc.forEach((n, off) => {
        // Întreruperea rămâne pe pagina secțiunii dinaintea ei (altfel schimbarea de pagină ar lăsa o pagină goală).
        const cls = sectionClass(orient, margin);
        if (cls) decos.push(Decoration.node(off, off + n.nodeSize, { class: cls }));
        if (n.type.name === name) {
          orient = sectionOrient(n.attrs.orient); margin = sectionMargin(n.attrs.margin); sec++;
          // Pe ecran, la o secțiune nouă pe pagină nouă: subsolul celei care se termină și antetul celei care începe.
          if (ownHf && sectionNewPage(sectionKind(n.attrs.kind))) {
            const endF = ftr, s = sec;
            hdr = sectionHf(n.attrs.hdr) ?? hdr; ftr = sectionHf(n.attrs.ftr) ?? ftr;
            const startH = hdr;
            if (endF.trim()) decos.push(Decoration.widget(off, () => hfBand('bottom', s, store.fill(endF)), { side: -1, key: `sf${s}:${endF}`, ignoreSelection: true }));
            if (startH.trim()) decos.push(Decoration.widget(off + n.nodeSize, () => hfBand('top', s + 1, store.fill(startH)), { side: -2, key: `sh${s}:${startH}`, ignoreSelection: true }));
          } else {
            hdr = sectionHf(n.attrs.hdr) ?? hdr; ftr = sectionHf(n.attrs.ftr) ?? ftr;
          }
          // Antet propriu pe vreo secțiune: semnul de început al secțiunii (vizibil doar la tipărire, ca legătură de 1 px).
          if (ownHf) {
            const href = `${SECTION_MARK}${sec}/${sectionNewPage(sectionKind(n.attrs.kind)) ? 'p' : 'c'}`;
            decos.push(Decoration.widget(off + n.nodeSize, () => {
              const a = document.createElement('a');
              a.className = 'doc-sec-mark'; a.href = href; a.tabIndex = -1; a.setAttribute('aria-hidden', 'true'); a.contentEditable = 'false';
              return a;
            }, { side: -1, key: href, ignoreSelection: true }));
          }
        }
      });
      return DecorationSet.create(doc, decos);
    };
    return [new Plugin({
      state: {
        init: (_c, s) => build(s.doc),
        apply: (tr, old) => (tr.docChanged || tr.getMeta('secHf') ? build(tr.doc) : old),
      },
      props: { decorations(state) { return this.getState(state); } },
    })];
  },

  addCommands() {
    return {
      // Ca la pagina nouă: la sfârșitul documentului mai punem un paragraf gol după ea, ca să ai unde scrie.
      // Nu se pune în tabele sau în liste: acolo nu are sens o secțiune nouă.
      setSectionBreak: (kind, orient = '', margin = 0) => ({ state, chain }) => {
        if (state.selection.$from.depth > 1) return false;
        return chain()
          .insertContent({ type: this.name, attrs: { kind, orient, margin: sectionMargin(margin) } })
          .command(({ tr, dispatch }) => {
            if (tr.doc.lastChild?.type.name === this.name && dispatch) {
              const end = tr.doc.content.size;
              tr.insert(end, tr.doc.type.schema.nodes.paragraph.create());
              tr.setSelection(TextSelection.create(tr.doc, end + 1));
            }
            return true;
          })
          .run();
      },
      // Orientarea doar pentru secțiunea cursorului: se scrie pe întreruperea dinaintea lui. În prima secțiune (fără întrerupere
      // înainte) punem aici o întrerupere „Pagina următoare”, ca în procesorul de text cunoscut („de aici înainte”).
      setSectionOrient: (orient) => ({ state, tr, dispatch, commands }) => {
        const pos = breakBefore(state, this.name);
        if (pos < 0) return orient ? commands.setSectionBreak('nextPage', orient) : false;
        if (dispatch) tr.setNodeMarkup(pos, undefined, { ...state.doc.nodeAt(pos)!.attrs, orient });
        return true;
      },
      // Antetul / subsolul propriu al secțiunii cursorului (null = legat de anterior); doar după o întrerupere de secțiune.
      setSectionHf: (hdr, ftr) => ({ state, tr, dispatch }) => {
        const pos = breakBefore(state, this.name);
        if (pos < 0) return false;
        if (dispatch) tr.setNodeMarkup(pos, undefined, { ...state.doc.nodeAt(pos)!.attrs, hdr: sectionHf(hdr), ftr: sectionHf(ftr) });
        return true;
      },
      // Marginile doar pentru secțiunea cursorului (0 = ca ale documentului), la fel ca orientarea.
      setSectionMargin: (mm) => ({ state, tr, dispatch, commands }) => {
        const margin = sectionMargin(mm), pos = breakBefore(state, this.name);
        if (pos < 0) return margin ? commands.setSectionBreak('nextPage', '', margin) : false;
        if (dispatch) tr.setNodeMarkup(pos, undefined, { ...state.doc.nodeAt(pos)!.attrs, margin });
        return true;
      },
    };
  },
});
