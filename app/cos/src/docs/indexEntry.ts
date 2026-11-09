// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Index alfabetic (ca Mark Entry / Insert Index): cuvintele marcate în text (intrări invizibile, care se văd doar cu ¶)
// și un bloc „Index” care le adună singur, în ordine alfabetică, grupate pe litere, cu paginile unde apar.
// Clic pe un număr de pagină duce la intrarea de acolo. În fișier se păstrează intrările și locul indexului.
import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { JSONContent } from '@tiptap/react';
import { pagesFor } from './toc';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indexEntry: {
      /** Marchează o intrare la cursor (după textul ales); `all` = la fiecare apariție a textului ales în document. */
      markIndexEntry: (term: string, sub?: string, all?: boolean) => ReturnType;
      insertIndex: () => ReturnType;
    };
  }
}

/** Textul unei intrări: fără spații în plus, cel mult 120 de litere. */
export const cleanTerm = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 120) : '');

export interface IndexHit { term: string; sub: string; pos: number }

export function indexHits(doc: PMNode): IndexHit[] {
  const out: IndexHit[] = [];
  doc.descendants((n, pos) => {
    if (n.type.name === 'indexEntry' && cleanTerm(n.attrs.term)) out.push({ term: cleanTerm(n.attrs.term), sub: cleanTerm(n.attrs.sub), pos });
  });
  return out;
}

const coll = new Intl.Collator('ro', { sensitivity: 'base', numeric: true });
/** Litera grupei: prima literă fără diacritice (Ă, Â → A; Ș → S), cifrele și semnele la „#”. */
export function groupLetter(term: string): string {
  const c = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
  return /\p{L}/u.test(c) ? c : '#';
}

export interface IndexRow { term: string; sub: string; pages: { page: number | null; pos: number }[] }

/**
 * Rândurile indexului, în ordine alfabetică (ca în română: „ș” după „s”), cu subintrările sub intrarea lor și paginile
 * fără repetări. Intrările care diferă doar prin litere mari / mici se adună la prima scriere.
 */
export function buildIndex(hits: IndexHit[], pages: (number | null)[]): IndexRow[] {
  const map = new Map<string, IndexRow>();
  hits.forEach((h, i) => {
    const k = h.term.toLocaleLowerCase('ro') + '\u0000' + h.sub.toLocaleLowerCase('ro');
    let r = map.get(k);
    if (!r) map.set(k, (r = { term: h.term, sub: h.sub, pages: [] }));
    const p = pages[i] ?? null;
    if (p === null ? !r.pages.length : !r.pages.some((x) => x.page === p)) r.pages.push({ page: p, pos: h.pos });
  });
  const rows = [...map.values()];
  // O subintrare fără intrarea ei principală primește un rând principal gol (fără pagini), ca în Word.
  for (const r of rows) {
    if (r.sub && !rows.some((x) => !x.sub && coll.compare(x.term, r.term) === 0)) rows.push({ term: r.term, sub: '', pages: [] });
  }
  rows.sort((a, b) => coll.compare(a.term, b.term) || (a.sub ? (b.sub ? coll.compare(a.sub, b.sub) : 1) : b.sub ? -1 : 0));
  for (const r of rows) r.pages.sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
  return rows;
}

/** Rândurile ca text simplu („termen, 3, 7”), pentru exportul .docx / .odt / text (paginile nu se știu acolo). */
export function indexLinesJson(doc: JSONContent): { text: string; sub: boolean; letter?: string }[] {
  const hits: IndexHit[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === 'indexEntry' && cleanTerm(n.attrs?.term)) hits.push({ term: cleanTerm(n.attrs?.term), sub: cleanTerm(n.attrs?.sub), pos: hits.length });
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  const out: { text: string; sub: boolean; letter?: string }[] = [];
  let letter = '';
  for (const r of buildIndex(hits, hits.map(() => null))) {
    const L = groupLetter(r.term);
    if (L !== letter) { letter = L; out.push({ text: L, sub: false, letter: L }); }
    out.push({ text: r.sub || r.term, sub: !!r.sub });
  }
  return out;
}

export const IndexEntry = Node.create({
  name: 'indexEntry',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      term: { default: '', parseHTML: (el) => cleanTerm(el.getAttribute('data-xe')) },
      sub: { default: '', parseHTML: (el) => cleanTerm(el.getAttribute('data-xe-sub')), renderHTML: (a) => (a.sub ? { 'data-xe-sub': a.sub } : {}) },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-xe]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const t = cleanTerm(node.attrs.term), s = cleanTerm(node.attrs.sub);
    return ['span', mergeAttributes(HTMLAttributes, { 'data-xe': t, class: 'doc-xe', title: `Intrare în index: ${t}${s ? ' › ' + s : ''}`, 'data-show': `XE „${t}${s ? ': ' + s : ''}”` })];
  },

  renderText() {
    return '';
  },

  addCommands() {
    return {
      markIndexEntry: (term, sub = '', all = false) => ({ state, tr, dispatch }) => {
        const t = cleanTerm(term), s = cleanTerm(sub);
        if (!t) return false;
        if (!dispatch) return true;
        const make = () => this.type.create({ term: t, sub: s });
        if (!all) {
          tr.insert(state.selection.to, make());
          return true;
        }
        // „Marchează toate”: după fiecare apariție a textului ales (cuvânt întreg, fără să țină cont de litere mari / mici),
        // o singură intrare pe paragraf, ca în Word.
        const word = state.doc.textBetween(state.selection.from, state.selection.to, ' ').trim() || t;
        const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'giu');
        const at: number[] = [];
        state.doc.descendants((n, pos) => {
          if (!n.isTextblock) return true;
          if (n.type.name === 'tableOfContents') return false;
          const text = n.textBetween(0, n.content.size, '\uFFFC', '\uFFFC');
          re.lastIndex = 0;
          const m = re.exec(text);
          if (m) {
            // Poziția din text → poziția în document (nodurile inline ocupă câte un caracter, ca în textBetween).
            at.push(pos + 1 + m.index + m[0].length);
          }
          return false;
        });
        for (const p of at.reverse()) tr.insert(p, make());
        return at.length > 0;
      },
      insertIndex: () => ({ state, commands }) => {
        const { $from } = state.selection;
        const node = { type: 'docIndex' };
        if ($from.depth === 0) return commands.insertContent(node);
        const block = $from.node(1);
        const empty = block.type.name === 'paragraph' && block.content.size === 0;
        return commands.insertContentAt(empty ? { from: $from.before(1), to: $from.after(1) } : $from.after(1), node);
      },
    };
  },
});

export const DocIndex = Node.create({
  name: 'docIndex',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-doc-index]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-doc-index': '', class: 'doc-toc doc-index' })];
  },

  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement('div');
      dom.className = 'doc-toc doc-index';
      dom.setAttribute('data-doc-index', '');
      dom.contentEditable = 'false';
      let last = '';

      const go = (pos: number) => {
        editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
        requestAnimationFrame(() => (editor.view.domAtPos(pos).node as HTMLElement | null)?.parentElement?.scrollIntoView({ block: 'center' }));
      };
      const render = () => {
        const hits = indexHits(editor.state.doc);
        const pages = pagesFor(editor.view, hits.map((h) => h.pos));
        const rows = buildIndex(hits, pages);
        const key = rows.map((r) => `${r.term}|${r.sub}|${r.pages.map((p) => p.page + ':' + p.pos).join(',')}`).join('\n');
        if (key === last && dom.firstChild) return;
        last = key;
        dom.replaceChildren();
        const title = document.createElement('div');
        title.className = 'doc-toc-title';
        title.textContent = 'Index';
        dom.append(title);
        if (!rows.length) {
          const empty = document.createElement('div');
          empty.className = 'doc-toc-empty';
          empty.textContent = 'Indexul se completează singur cu cuvintele marcate (alege un cuvânt → Index → Marchează).';
          dom.append(empty);
          return;
        }
        const cols = document.createElement('div');
        cols.className = 'doc-index-cols';
        let letter = '';
        for (const r of rows) {
          const L = groupLetter(r.term);
          if (L !== letter) {
            letter = L;
            const h = document.createElement('div');
            h.className = 'doc-index-letter';
            h.textContent = L;
            cols.append(h);
          }
          const row = document.createElement('div');
          row.className = r.sub ? 'doc-index-row doc-index-sub' : 'doc-index-row';
          row.append(document.createTextNode(r.sub || r.term));
          r.pages.forEach((p, i) => {
            row.append(document.createTextNode(i ? ', ' : r.pages.length ? ', ' : ''));
            const a = document.createElement('a');
            a.className = 'doc-index-page';
            a.textContent = p.page === null ? '→' : String(p.page);
            a.title = 'Du-te la acest loc';
            a.onmousedown = (ev) => ev.preventDefault();
            a.onclick = (ev) => { ev.preventDefault(); go(p.pos); };
            row.append(a);
          });
          cols.append(row);
        }
        dom.append(cols);
      };

      let timer = 0;
      const later = () => { window.clearTimeout(timer); timer = window.setTimeout(render, 200); };
      render();
      later();
      editor.on('update', later);
      editor.view.dom.addEventListener('suite-pages', later);
      return {
        dom,
        update: (node) => node.type.name === 'docIndex',
        ignoreMutation: () => true,
        stopEvent: (ev) => !!(ev.target as HTMLElement | null)?.closest?.('.doc-index-page'),
        destroy: () => { window.clearTimeout(timer); editor.off('update', later); editor.view.dom.removeEventListener('suite-pages', later); },
      };
    };
  },
});
