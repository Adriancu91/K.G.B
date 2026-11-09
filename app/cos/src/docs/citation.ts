// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Citări și bibliografie (ca References → Insert Citation / Manage Sources / Style / Bibliography): fiecare citare din text
// ține sursa ei (carte, articol, pagină web) și se scrie după stilul ales (APA, MLA sau ISO 690), iar blocul „Bibliografie”
// adună singur sursele citate, fără dubluri, în ordine alfabetică. Schimbarea stilului sau a unei surse se vede peste tot.
import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { JSONContent } from '@tiptap/react';

export type CiteStyle = 'apa' | 'mla' | 'iso';
export const CITE_STYLES: [CiteStyle, string][] = [['apa', 'APA (ediția a 7-a)'], ['mla', 'MLA (ediția a 9-a)'], ['iso', 'ISO 690 (autor–an)']];
export type SourceKind = 'book' | 'article' | 'web';
export const SOURCE_KINDS: [SourceKind, string][] = [['book', 'Carte'], ['article', 'Articol din revistă'], ['web', 'Pagină web']];

export interface Source {
  id: string;
  kind: SourceKind;
  /** Autorii, despărțiți prin „;”, fiecare „Nume, Prenume” (sau doar numele unei instituții). */
  author: string;
  title: string;
  year: string;
  publisher: string;
  city: string;
  journal: string;
  pages: string;
  url: string;
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
export const cleanStyle = (v: unknown): CiteStyle => (v === 'mla' || v === 'iso' ? v : 'apa');

/** Sursa citită din fișier (orice câmp lipsă devine gol). */
export function cleanSource(v: unknown): Source | null {
  let o: Record<string, unknown> = {};
  try { o = typeof v === 'string' ? JSON.parse(v) : v && typeof v === 'object' ? (v as Record<string, unknown>) : {}; } catch { return null; }
  const s: Source = {
    id: str(o.id, 40) || Math.random().toString(36).slice(2, 10),
    kind: o.kind === 'article' || o.kind === 'web' ? o.kind : 'book',
    author: str(o.author), title: str(o.title, 500), year: str(o.year, 20), publisher: str(o.publisher), city: str(o.city, 100),
    journal: str(o.journal), pages: str(o.pages, 40), url: str(o.url, 1000),
  };
  return s.author || s.title ? s : null;
}

interface Person { last: string; first: string; org: boolean }
function people(author: string): Person[] {
  return author.split(';').map((a) => a.trim()).filter(Boolean).map((a) => {
    const k = a.indexOf(',');
    if (k > 0) return { last: a.slice(0, k).trim(), first: a.slice(k + 1).trim(), org: false };
    // Fără virgulă: o instituție („Institutul Național de Statistică”) sau un singur nume.
    return { last: a, first: '', org: true };
  });
}
const initials = (first: string) => first.split(/[\s-]+/).filter(Boolean).map((w) => w[0].toLocaleUpperCase('ro') + '.').join(' ');
const upper = (s: string) => s.toLocaleUpperCase('ro');
const endDot = (s: string) => (/[.?!]$/.test(s) ? s : s + '.');

/** Textul citării din text, de exemplu „(Popescu, 2020, p. 12)”. */
export function citeText(src: Source | null, style: CiteStyle, page = ''): string {
  if (!src) return '(sursă lipsă)';
  const ps = people(src.author);
  const short = src.title.length > 30 ? src.title.slice(0, 28).trim() + '…' : src.title;
  const and = style === 'apa' ? ' & ' : style === 'mla' ? ' and ' : ' și ';
  const who = !ps.length ? (style === 'mla' ? `„${short}”` : short)
    : ps.length === 1 ? (style === 'iso' && !ps[0].org ? upper(ps[0].last) : ps[0].last)
      : ps.length === 2 ? ps.map((p) => (style === 'iso' && !p.org ? upper(p.last) : p.last)).join(and)
        : `${style === 'iso' && !ps[0].org ? upper(ps[0].last) : ps[0].last} et al.`;
  const pg = page.trim();
  if (style === 'mla') return `(${who}${pg ? ' ' + pg : ''})`;
  const year = src.year || 'f.a.';
  if (style === 'apa') return `(${who}, ${year}${pg ? `, p. ${pg}` : ''})`;
  return `(${who} ${year}${pg ? `, p. ${pg}` : ''})`;
}

/** O bucată din rândul de bibliografie (cursiv = titlul cărții / revistei). */
export interface Piece { t: string; i?: boolean }

function authorsRef(ps: Person[], style: CiteStyle): string {
  if (!ps.length) return '';
  if (style === 'apa') {
    const one = (p: Person) => (p.org || !p.first ? p.last : `${p.last}, ${initials(p.first)}`);
    if (ps.length === 1) return one(ps[0]);
    return ps.slice(0, -1).map(one).join(', ') + ', & ' + one(ps[ps.length - 1]);
  }
  if (style === 'mla') {
    const first = ps[0].org || !ps[0].first ? ps[0].last : `${ps[0].last}, ${ps[0].first}`;
    if (ps.length === 1) return first;
    if (ps.length === 2) return `${first}, and ${ps[1].first ? ps[1].first + ' ' : ''}${ps[1].last}`;
    return `${first}, et al.`;
  }
  const one = (p: Person) => (p.org || !p.first ? p.last : `${upper(p.last)}, ${p.first}`);
  return ps.length <= 3 ? ps.map(one).join(' și ') : `${one(ps[0])} et al.`;
}

/** Rândul sursei din bibliografie, în stilul ales. */
export function refPieces(s: Source, style: CiteStyle): Piece[] {
  const a = authorsRef(people(s.author), style);
  const year = s.year || (style === 'apa' ? 'f.a.' : '');
  const out: Piece[] = [];
  const add = (t: string, i = false) => { if (t) out.push(i ? { t, i } : { t }); };
  if (style === 'apa') {
    add(a ? `${endDot(a)} (${year}). ` : '');
    if (s.kind === 'article') {
      add(`${endDot(s.title)} `);
      if (!a) add(`(${year}). `);
      add(s.journal, true);
      add(s.pages ? `, ${s.pages}.` : s.journal ? '.' : '');
    } else {
      add(endDot(s.title), true);
      if (!a) add(` (${year}).`);
      add(s.kind === 'book' && s.publisher ? ` ${endDot(s.publisher)}` : '');
    }
    add(s.url ? ` ${s.url}` : '');
  } else if (style === 'mla') {
    add(a ? `${endDot(a)} ` : '');
    if (s.kind === 'book') {
      add(endDot(s.title), true);
      add(s.publisher || year ? ` ${[s.publisher, year].filter(Boolean).join(', ')}.` : '');
    } else {
      add(`„${endDot(s.title)}” `);
      if (s.kind === 'article') {
        add(s.journal, true);
        add(`${year ? `, ${year}` : ''}${s.pages ? `, pp. ${s.pages}` : ''}.`);
      } else add(`${[year, s.url].filter(Boolean).join(', ')}.`);
    }
  } else {
    add(a ? `${endDot(a)} ` : '');
    if (s.kind === 'article') {
      add(`${endDot(s.title)} `);
      add(s.journal, true);
      add(`. ${[year, s.pages ? `pp. ${s.pages}` : ''].filter(Boolean).join(', ')}.`);
    } else {
      add(s.title, true);
      add(s.kind === 'web' ? ' [online]. ' : '. ');
      if (s.kind === 'book') add([s.city && s.publisher ? `${s.city}: ${s.publisher}` : s.city || s.publisher, year].filter(Boolean).join(', ') + '.');
      else add(`${year ? year + '. ' : ''}${s.url ? `Disponibil la: ${s.url}` : ''}`);
    }
  }
  return out.map((p) => ({ ...p, t: p.t.replace(/\.\./g, '.') }));
}
export const refText = (s: Source, style: CiteStyle) => refPieces(s, style).map((p) => p.t).join('').trim();

const coll = new Intl.Collator('ro', { sensitivity: 'base', numeric: true });
const sortKey = (s: Source) => (people(s.author)[0]?.last ?? '') || s.title;
/** Sursele citate (fără dubluri, după id), în ordinea alfabetică a primului autor (sau a titlului). */
export function sortSources(list: Source[]): Source[] {
  const seen = new Map<string, Source>();
  for (const s of list) if (!seen.has(s.id)) seen.set(s.id, s);
  return [...seen.values()].sort((a, b) => coll.compare(sortKey(a), sortKey(b)) || coll.compare(a.year, b.year) || coll.compare(a.title, b.title));
}

// Lista principală de surse (ca Manage Sources → Master List): sursele păstrate în setări, aceleași în toate documentele.
export const MASTER_MAX = 500;
const sameWork = (a: Source, b: Source) => coll.compare(a.author, b.author) === 0 && coll.compare(a.title, b.title) === 0 && a.year === b.year;
/** Sursa pusă în lista principală: înlocuiește aceeași sursă (după id sau după autor + titlu + an), altfel se adaugă. */
export function addToMaster(list: Source[], s: Source): Source[] {
  const i = list.findIndex((m) => m.id === s.id || sameWork(m, s));
  const next = i >= 0 ? list.map((m, k) => (k === i ? { ...s, id: m.id } : m)) : [...list, s];
  return sortSources(next).slice(0, MASTER_MAX);
}
export const removeFromMaster = (list: Source[], id: string) => list.filter((m) => m.id !== id);
/** Lista principală citită din setări (doar sursele întregi). */
export const cleanMaster = (v: unknown): Source[] => sortSources((Array.isArray(v) ? v : []).map(cleanSource).filter((s): s is Source => !!s)).slice(0, MASTER_MAX);
/** Sursa din lista principală care e aceeași cu una din document (după id sau după autor + titlu + an). */
export const inMaster = (list: Source[], s: Source) => list.find((m) => m.id === s.id || sameWork(m, s));

/** Sursele citate în document (cea mai nouă scriere a fiecărei surse, după id). */
export function docSources(doc: PMNode): Source[] {
  const out: Source[] = [];
  doc.descendants((n) => { if (n.type.name === 'citation') { const s = cleanSource(n.attrs.src); if (s) out.push(s); } });
  return sortSources(out);
}
export function docSourcesJson(doc: JSONContent): Source[] {
  const out: Source[] = [];
  const walk = (n: JSONContent) => { if (n.type === 'citation') { const s = cleanSource(n.attrs?.src); if (s) out.push(s); } (n.content ?? []).forEach(walk); };
  walk(doc);
  return sortSources(out);
}
/** Stilul documentului: al primei citări sau al bibliografiei (implicit APA). */
export function docStyle(doc: PMNode): CiteStyle {
  let st: CiteStyle | null = null;
  doc.descendants((n) => { if (!st && (n.type.name === 'citation' || n.type.name === 'bibliography')) st = cleanStyle(n.attrs.style); return !st; });
  return st ?? 'apa';
}
/** Textul unei citări salvate ca JSON (pentru exporturi). */
export const citeTextJson = (n: JSONContent) => citeText(cleanSource(n.attrs?.src), cleanStyle(n.attrs?.style), str(n.attrs?.page, 40));
export const BIB_TITLE = 'Bibliografie';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (src: Source, page?: string, style?: CiteStyle) => ReturnType;
      /** Schimbă stilul tuturor citărilor și al bibliografiei. */
      setCiteStyle: (style: CiteStyle) => ReturnType;
      /** Scrie sursa schimbată la toate citările ei. */
      updateSource: (src: Source) => ReturnType;
      insertBibliography: (style?: CiteStyle) => ReturnType;
    };
  }
}

export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '', parseHTML: (el) => el.getAttribute('data-cite') ?? '', renderHTML: (a) => ({ 'data-cite': a.src }) },
      page: { default: '', parseHTML: (el) => str(el.getAttribute('data-page'), 40), renderHTML: (a) => (a.page ? { 'data-page': a.page } : {}) },
      style: { default: 'apa', parseHTML: (el) => cleanStyle(el.getAttribute('data-style')), renderHTML: (a) => ({ 'data-style': a.style }) },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-cite]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const s = cleanSource(node.attrs.src);
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-cite', title: s ? refText(s, cleanStyle(node.attrs.style)) : '' }), citeText(s, cleanStyle(node.attrs.style), node.attrs.page)];
  },

  renderText({ node }) {
    return citeText(cleanSource(node.attrs.src), cleanStyle(node.attrs.style), node.attrs.page);
  },

  addCommands() {
    return {
      insertCitation: (src, page = '', style) => ({ state, tr, dispatch }) => {
        const s = cleanSource(src);
        if (!s) return false;
        if (dispatch) {
          // Aceeași sursă, scrisă din nou: se schimbă și la citările ei de dinainte.
          const json = JSON.stringify(s);
          state.doc.descendants((n, pos) => {
            if (n.type.name === 'citation' && cleanSource(n.attrs.src)?.id === s.id && n.attrs.src !== json) tr.setNodeMarkup(pos, undefined, { ...n.attrs, src: json });
          });
          const node = this.type.create({ src: json, page: str(page, 40), style: style ?? docStyle(state.doc) });
          tr.replaceSelectionWith(node, false);
        }
        return true;
      },
      setCiteStyle: (style) => ({ state, tr, dispatch }) => {
        if (dispatch) state.doc.descendants((n, pos) => {
          if ((n.type.name === 'citation' || n.type.name === 'bibliography') && n.attrs.style !== style) tr.setNodeMarkup(pos, undefined, { ...n.attrs, style });
        });
        return true;
      },
      updateSource: (src) => ({ state, tr, dispatch }) => {
        const s = cleanSource(src);
        if (!s) return false;
        const json = JSON.stringify(s);
        let found = false;
        state.doc.descendants((n, pos) => {
          if (n.type.name === 'citation' && cleanSource(n.attrs.src)?.id === s.id) { found = true; if (dispatch) tr.setNodeMarkup(pos, undefined, { ...n.attrs, src: json }); }
        });
        return found;
      },
      insertBibliography: (style) => ({ state, commands }) => {
        const { $from } = state.selection;
        const node = { type: 'bibliography', attrs: { style: style ?? docStyle(state.doc) } };
        if ($from.depth === 0) return commands.insertContent(node);
        const block = $from.node(1);
        const empty = block.type.name === 'paragraph' && block.content.size === 0;
        return commands.insertContentAt(empty ? { from: $from.before(1), to: $from.after(1) } : $from.after(1), node);
      },
    };
  },
});

export const Bibliography = Node.create({
  name: 'bibliography',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { style: { default: 'apa', parseHTML: (el) => cleanStyle(el.getAttribute('data-style')), renderHTML: (a) => ({ 'data-style': a.style }) } };
  },

  parseHTML() {
    return [{ tag: 'div[data-bibliography]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-bibliography': '', class: 'doc-toc doc-bib' })];
  },

  addNodeView() {
    return ({ editor, node }) => {
      let style = cleanStyle(node.attrs.style);
      const dom = document.createElement('div');
      dom.className = 'doc-toc doc-bib';
      dom.setAttribute('data-bibliography', '');
      dom.contentEditable = 'false';
      let last = '';
      const render = () => {
        const list = docSources(editor.state.doc);
        const key = style + JSON.stringify(list);
        if (key === last && dom.firstChild) return;
        last = key;
        dom.replaceChildren();
        const title = document.createElement('div');
        title.className = 'doc-toc-title';
        title.textContent = BIB_TITLE;
        dom.append(title);
        if (!list.length) {
          const empty = document.createElement('div');
          empty.className = 'doc-toc-empty';
          empty.textContent = 'Bibliografia se completează singură cu sursele citate (❝ Citare → Inserează citarea).';
          dom.append(empty);
          return;
        }
        for (const s of list) {
          const p = document.createElement('div');
          p.className = 'doc-bib-row';
          for (const piece of refPieces(s, style)) {
            if (piece.i) { const em = document.createElement('i'); em.textContent = piece.t; p.append(em); } else p.append(document.createTextNode(piece.t));
          }
          dom.append(p);
        }
      };
      let timer = 0;
      const later = () => { window.clearTimeout(timer); timer = window.setTimeout(render, 150); };
      render();
      editor.on('update', later);
      return {
        dom,
        update: (n) => { if (n.type.name !== 'bibliography') return false; style = cleanStyle(n.attrs.style); render(); return true; },
        ignoreMutation: () => true,
        destroy: () => { window.clearTimeout(timer); editor.off('update', later); },
      };
    };
  },
});
