// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tabelul de autorități (ca Mark Citation / Insert Table of Authorities): citările marcate în text (legi, jurisprudență,
// doctrină…; intrări invizibile, care se văd doar cu ¶) și un bloc care le adună singur, pe categorii, în ordine alfabetică,
// cu paginile unde apar („passim” când sunt pe 5 pagini sau mai multe). Clic pe un număr de pagină duce la citarea de acolo.
import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { JSONContent } from '@tiptap/react';
import { pagesFor } from './toc';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    authEntry: {
      /** Marchează o citare la cursor; `all` = după fiecare apariție a textului `find` (citarea scurtă) în document. */
      markCitation: (long: string, short: string, cat: number, all?: boolean, find?: string) => ReturnType;
      insertAuthorities: (cat: number, passim: boolean) => ReturnType;
    };
  }
}

/** Categoriile, în ordinea din tabel (numărul 0 = toate, la inserarea tabelului). */
export const AUTH_CATS = ['Jurisprudență', 'Legi', 'Alte surse', 'Reguli', 'Doctrină', 'Regulamente', 'Prevederi constituționale'];
export const TOA_TITLE = 'Tabel de autorități';
/** De la câte pagini diferite se scrie „passim” în locul numerelor. */
export const PASSIM_FROM = 5;

export const cleanCite = (s: unknown, max = 300) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');
export const cleanCat = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= AUTH_CATS.length ? n : 1; };

export interface AuthHit { long: string; short: string; cat: number; pos: number }

export function authHits(doc: PMNode): AuthHit[] {
  const out: AuthHit[] = [];
  doc.descendants((n, pos) => {
    if (n.type.name === 'authEntry' && cleanCite(n.attrs.long)) out.push({ long: cleanCite(n.attrs.long), short: cleanCite(n.attrs.short, 120), cat: cleanCat(n.attrs.cat), pos });
  });
  return out;
}

const coll = new Intl.Collator('ro', { sensitivity: 'base', numeric: true });

export interface AuthRow { long: string; pages: { page: number | null; pos: number }[]; passim: boolean }
export interface AuthGroup { cat: number; name: string; rows: AuthRow[] }

/**
 * Grupele tabelului: categoriile cu citări (sau doar `only`, dacă nu e 0), în ordinea lor; în fiecare, citările în ordine
 * alfabetică, fără repetări (aceeași citare scrisă cu alte litere mari / mici se adună la prima), cu paginile o singură dată.
 */
export function buildAuthorities(hits: AuthHit[], pages: (number | null)[], only = 0, passim = true): AuthGroup[] {
  const groups: AuthGroup[] = [];
  for (let cat = 1; cat <= AUTH_CATS.length; cat++) {
    if (only && cat !== only) continue;
    const map = new Map<string, AuthRow>();
    hits.forEach((h, i) => {
      if (h.cat !== cat) return;
      const k = h.long.toLocaleLowerCase('ro');
      let r = map.get(k);
      if (!r) map.set(k, (r = { long: h.long, pages: [], passim: false }));
      const p = pages[i] ?? null;
      if (p === null ? !r.pages.length : !r.pages.some((x) => x.page === p)) r.pages.push({ page: p, pos: h.pos });
    });
    if (!map.size) continue;
    const rows = [...map.values()].sort((a, b) => coll.compare(a.long, b.long));
    for (const r of rows) {
      r.pages.sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
      r.passim = passim && r.pages.filter((p) => p.page !== null).length >= PASSIM_FROM;
    }
    groups.push({ cat, name: AUTH_CATS[cat - 1], rows });
  }
  return groups;
}

/** Tabelul ca text simplu (categoriile și citările), pentru exportul .docx / .odt (paginile nu se știu acolo). */
export function authLinesJson(doc: JSONContent, only = 0): { text: string; head: boolean }[] {
  const hits: AuthHit[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === 'authEntry' && cleanCite(n.attrs?.long)) hits.push({ long: cleanCite(n.attrs?.long), short: cleanCite(n.attrs?.short, 120), cat: cleanCat(n.attrs?.cat), pos: hits.length });
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  const out: { text: string; head: boolean }[] = [];
  for (const g of buildAuthorities(hits, hits.map(() => null), only, false)) {
    out.push({ text: g.name, head: true });
    for (const r of g.rows) out.push({ text: r.long, head: false });
  }
  return out;
}

export const AuthEntry = Node.create({
  name: 'authEntry',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      long: { default: '', parseHTML: (el) => cleanCite(el.getAttribute('data-ta')) },
      short: { default: '', parseHTML: (el) => cleanCite(el.getAttribute('data-ta-short'), 120), renderHTML: (a) => (a.short ? { 'data-ta-short': a.short } : {}) },
      cat: { default: 1, parseHTML: (el) => cleanCat(el.getAttribute('data-ta-cat')), renderHTML: (a) => ({ 'data-ta-cat': String(cleanCat(a.cat)) }) },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-ta]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const l = cleanCite(node.attrs.long);
    return ['span', mergeAttributes(HTMLAttributes, { 'data-ta': l, class: 'doc-xe', title: `Citare (${AUTH_CATS[cleanCat(node.attrs.cat) - 1]}): ${l}`, 'data-show': `TA „${cleanCite(node.attrs.short, 120) || l}”` })];
  },

  renderText() {
    return '';
  },

  addCommands() {
    return {
      markCitation: (long, short, cat, all = false, find = '') => ({ state, tr, dispatch }) => {
        const l = cleanCite(long), s = cleanCite(short, 120), c = cleanCat(cat);
        if (!l) return false;
        if (!dispatch) return true;
        const make = () => this.type.create({ long: l, short: s, cat: c });
        if (!all) {
          tr.insert(state.selection.to, make());
          return true;
        }
        // „Marchează toate”: după fiecare apariție a citării (scurte, dacă e scrisă), fără să țină cont de litere mari / mici;
        // locurile care au deja o citare marcată imediat după nu se marchează din nou.
        const word = cleanCite(find, 120) || s || l;
        const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'giu');
        const at: number[] = [];
        state.doc.descendants((n, pos) => {
          if (!n.isTextblock) return true;
          if (n.type.name === 'tableOfContents') return false;
          const text = n.textBetween(0, n.content.size, '\uFFFC', '\uFFFC');
          re.lastIndex = 0;
          for (let m = re.exec(text); m; m = re.exec(text)) {
            const p = pos + 1 + m.index + m[0].length;
            if (state.doc.nodeAt(p)?.type.name !== 'authEntry') at.push(p);
          }
          return false;
        });
        for (const p of at.reverse()) tr.insert(p, make());
        return at.length > 0;
      },
      insertAuthorities: (cat, passim) => ({ state, commands }) => {
        const { $from } = state.selection;
        const node = { type: 'docAuthorities', attrs: { cat: cat ? cleanCat(cat) : 0, passim } };
        if ($from.depth === 0) return commands.insertContent(node);
        const block = $from.node(1);
        const empty = block.type.name === 'paragraph' && block.content.size === 0;
        return commands.insertContentAt(empty ? { from: $from.before(1), to: $from.after(1) } : $from.after(1), node);
      },
    };
  },
});

export const DocAuthorities = Node.create({
  name: 'docAuthorities',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      cat: { default: 0, parseHTML: (el) => { const n = Number(el.getAttribute('data-cat')); return n >= 1 && n <= AUTH_CATS.length ? n : 0; }, renderHTML: (a) => (a.cat ? { 'data-cat': String(a.cat) } : {}) },
      passim: { default: true, parseHTML: (el) => el.getAttribute('data-passim') !== '0', renderHTML: (a) => (a.passim ? {} : { 'data-passim': '0' }) },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-doc-toa]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-doc-toa': '', class: 'doc-toc doc-toa' })];
  },

  addNodeView() {
    return ({ editor, node: first }) => {
      let node = first;
      const dom = document.createElement('div');
      dom.className = 'doc-toc doc-toa';
      dom.setAttribute('data-doc-toa', '');
      dom.contentEditable = 'false';
      let last = '';

      const go = (pos: number) => {
        editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
        requestAnimationFrame(() => (editor.view.domAtPos(pos).node as HTMLElement | null)?.parentElement?.scrollIntoView({ block: 'center' }));
      };
      const render = () => {
        const hits = authHits(editor.state.doc);
        const pages = pagesFor(editor.view, hits.map((h) => h.pos));
        const groups = buildAuthorities(hits, pages, Number(node.attrs.cat) || 0, node.attrs.passim !== false);
        const key = node.attrs.cat + '|' + node.attrs.passim + '\n' + groups.map((g) => g.cat + ':' + g.rows.map((r) => `${r.long}|${r.passim}|${r.pages.map((p) => p.page + ':' + p.pos).join(',')}`).join(';')).join('\n');
        if (key === last && dom.firstChild) return;
        last = key;
        dom.replaceChildren();
        const title = document.createElement('div');
        title.className = 'doc-toc-title';
        title.textContent = TOA_TITLE;
        dom.append(title);
        if (!groups.length) {
          const empty = document.createElement('div');
          empty.className = 'doc-toc-empty';
          empty.textContent = 'Tabelul se completează singur cu citările marcate (alege o citare → Tabel de autorități → Marchează).';
          dom.append(empty);
          return;
        }
        for (const g of groups) {
          const h = document.createElement('div');
          h.className = 'doc-toa-cat';
          h.textContent = g.name;
          dom.append(h);
          for (const r of g.rows) {
            const row = document.createElement('div');
            row.className = 'doc-toa-row';
            const t = document.createElement('span');
            t.className = 'doc-toa-text';
            t.textContent = r.long;
            const dots = document.createElement('span');
            dots.className = 'doc-toa-dots';
            const pg = document.createElement('span');
            pg.className = 'doc-toa-pages';
            if (r.passim) {
              const a = document.createElement('a');
              a.className = 'doc-index-page';
              a.textContent = 'passim';
              a.title = 'Apare pe multe pagini; clic: prima citare';
              a.onmousedown = (ev) => ev.preventDefault();
              a.onclick = (ev) => { ev.preventDefault(); go(r.pages[0].pos); };
              pg.append(a);
            } else {
              r.pages.forEach((p, i) => {
                if (i) pg.append(document.createTextNode(', '));
                const a = document.createElement('a');
                a.className = 'doc-index-page';
                a.textContent = p.page === null ? '→' : String(p.page);
                a.title = 'Du-te la acest loc';
                a.onmousedown = (ev) => ev.preventDefault();
                a.onclick = (ev) => { ev.preventDefault(); go(p.pos); };
                pg.append(a);
              });
            }
            row.append(t, dots, pg);
            dom.append(row);
          }
        }
      };

      let timer = 0;
      const later = () => { window.clearTimeout(timer); timer = window.setTimeout(render, 200); };
      render();
      later();
      editor.on('update', later);
      editor.view.dom.addEventListener('suite-pages', later);
      return {
        dom,
        update: (n) => { if (n.type.name !== 'docAuthorities') return false; node = n; later(); return true; },
        ignoreMutation: () => true,
        stopEvent: (ev) => !!(ev.target as HTMLElement | null)?.closest?.('.doc-index-page'),
        destroy: () => { window.clearTimeout(timer); editor.off('update', later); editor.view.dom.removeEventListener('suite-pages', later); },
      };
    };
  },
});
