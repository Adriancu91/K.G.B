// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tabulatorul și opririle de tabulator (Word: Paragraf → Tabulatori). Tasta Tab pune în text un tabulator (nodul „tabChar”),
// iar lățimea lui se calculează după opririle paragrafului: la stânga, centrat, la dreapta sau la virgulă, cu puncte / linii
// de umplere (ca în cuprinsuri și formulare: „Nume ........ Semnătura”). Fără opriri proprii, tabulatorul sare din 1,25 în 1,25 cm.
import { Extension, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export type TabAlign = 'l' | 'c' | 'r' | 'd';
/** Umplerea până la oprire: nimic, puncte, liniuțe sau linie continuă. */
export type TabLeader = '' | '.' | '-' | '_';
export interface TabStop { pos: number; align: TabAlign; leader: TabLeader }

export const TAB = String.fromCharCode(9);
/** Opririle implicite (ca în Word cu centimetri). */
export const DEFAULT_TAB_CM = 1.25;
export const MAX_TAB_CM = 55;
const CM = 96 / 2.54;
const TYPES = ['paragraph', 'heading'];

export const ALIGN_NAMES: Record<TabAlign, string> = { l: 'La stânga', c: 'Centrat', r: 'La dreapta', d: 'La virgulă' };
export const LEADER_NAMES: Record<string, string> = { '': 'Fără', '.': 'Puncte ……', '-': 'Liniuțe – – –', '_': 'Linie ____' };

/** „3.5l 15r.” → opririle, sortate și fără dubluri (aceeași poziție o dată). */
export function parseStops(v: string | null | undefined): TabStop[] {
  const out: TabStop[] = [];
  for (const part of String(v ?? '').trim().split(/\s+/)) {
    const m = /^(\d+(?:\.\d+)?)([lcrd])([._-])?$/.exec(part);
    if (!m) continue;
    const pos = Math.round(Number(m[1]) * 100) / 100;
    if (!(pos > 0 && pos <= MAX_TAB_CM) || out.some((t) => Math.abs(t.pos - pos) < 0.01)) continue;
    out.push({ pos, align: m[2] as TabAlign, leader: (m[3] ?? '') as TabLeader });
  }
  return out.sort((a, b) => a.pos - b.pos).slice(0, 64);
}

export function formatStops(stops: TabStop[]): string | null {
  const s = parseStops(stops.map((t) => `${Math.round(t.pos * 100) / 100}${t.align}${t.leader}`).join(' '));
  return s.length ? s.map((t) => `${t.pos}${t.align}${t.leader}`).join(' ') : null;
}

/** Unde ajunge un tabulator pornit de la x cm: prima oprire proprie de după x, apoi cele implicite, din 1,25 în 1,25 cm. */
export function nextStop(stops: TabStop[], x: number): TabStop {
  const own = stops.find((t) => t.pos > x + 0.02);
  if (own) return own;
  return { pos: (Math.floor((x + 0.02) / DEFAULT_TAB_CM) + 1) * DEFAULT_TAB_CM, align: 'l', leader: '' };
}

/** Lățimea tabulatorului (cm), când textul de după el (până la următorul tabulator) are `seg` cm, iar `dec` cm până la virgulă. */
export function tabWidth(stop: TabStop, x: number, seg: number, dec: number): number {
  const room = stop.pos - x;
  const used = stop.align === 'c' ? seg / 2 : stop.align === 'r' ? seg : stop.align === 'd' ? dec : 0;
  return Math.max(0, room - used);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabStops: {
      insertTab: () => ReturnType;
      setTabStops: (stops: TabStop[]) => ReturnType;
    };
  }
}

/** Tabulatorul din text: un semn de sine stătător, care se șterge cu o apăsare de Backspace. */
export const TabChar = Node.create({
  name: 'tabChar',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  parseHTML: () => [{ tag: 'span[data-tab]' }],
  renderHTML: () => ['span', { 'data-tab': '', class: 'doc-tab' }],
  renderText: () => TAB,
});

function textWidth(r: Range, scale: number): number {
  const rects = Array.from(r.getClientRects()).filter((b) => b.width > 0 || b.height > 0);
  if (!rects.length) return 0;
  // Doar primul rând: dacă textul trece pe rândul următor, nu socotim și ce e acolo.
  const top = rects[0].top;
  let left = Infinity, right = -Infinity;
  for (const b of rects) if (Math.abs(b.top - top) < 3) { left = Math.min(left, b.left); right = Math.max(right, b.right); }
  return right > left ? (right - left) / scale : 0;
}

/** Textul de după tabulator până la primul punct sau virgulă (pentru oprirea „la virgulă”); null dacă nu e niciunul. */
function rangeToDecimal(from: HTMLElement, end: Range): Range | null {
  const root = end.commonAncestorContainer;
  const walk = document.createTreeWalker(root.nodeType === 1 ? root : root.parentNode!, NodeFilter.SHOW_TEXT);
  let n: globalThis.Node | null;
  while ((n = walk.nextNode())) {
    if (!end.intersectsNode(n) || !(from.compareDocumentPosition(n) & 4)) continue;
    const i = (n.nodeValue ?? '').search(/[.,]/);
    if (i < 0) continue;
    const r = document.createRange();
    r.setStartAfter(from);
    r.setEnd(n, i);
    return r;
  }
  return null;
}

const BLOCK = 'p, h1, h2, h3, h4, h5, h6';

/** Așază tabulatorii dintr-un paragraf (pagina e deja desenată). */
function layoutBlock(p: HTMLElement, spans: HTMLElement[], scale: number) {
  const stops = parseStops(p.getAttribute('data-tabs'));
  for (const s of spans) s.style.width = '0px';
  // Pozițiile se măsoară de la marginea paginii (sau a celulei), nu de la retragerea paragrafului, ca în Word.
  const origin = p.getBoundingClientRect().left - (parseFloat(getComputedStyle(p).marginLeft) || 0) * scale;
  spans.forEach((s, i) => {
    const x = (s.getBoundingClientRect().left - origin) / scale / CM;
    const stop = nextStop(stops, x);
    let seg = 0, dec = 0;
    if (stop.align !== 'l') {
      const r = document.createRange();
      r.setStartAfter(s);
      if (spans[i + 1]) r.setEndBefore(spans[i + 1]); else r.setEnd(p, p.childNodes.length);
      seg = textWidth(r, scale) / CM;
      if (stop.align === 'd') { const d = rangeToDecimal(s, r); dec = d ? textWidth(d, scale) / CM : seg; }
    }
    s.style.width = `${(tabWidth(stop, x, seg, dec) * CM).toFixed(2)}px`;
    if (stop.leader) s.setAttribute('data-leader', stop.leader); else s.removeAttribute('data-leader');
  });
}

/** Așază tabulatorii din paragrafele date (sau din tot documentul). */
export function layoutTabs(root: HTMLElement, only?: Set<HTMLElement>) {
  const all = Array.from(root.querySelectorAll<HTMLElement>('span.doc-tab'));
  if (!all.length || !root.getBoundingClientRect().width) return;
  const groups = new Map<HTMLElement, HTMLElement[]>();
  for (const s of all) {
    const p = s.closest<HTMLElement>(BLOCK);
    if (!p) continue;
    const g = groups.get(p);
    if (g) g.push(s); else groups.set(p, [s]);
  }
  // Doar paragrafele schimbate și cele desenate din nou (tabulatori fără lățime).
  if (only) for (const [p, spans] of groups) if (!only.has(p) && spans.every((s) => s.style.width)) groups.delete(p);
  if (!groups.size) return;
  // Zoom-ul paginii: cât ocupă pe ecran 100 px din pagină.
  const probe = groups.values().next().value![0];
  probe.style.width = '100px';
  const scale = probe.getBoundingClientRect().width / 100 || 1;
  for (const [p, spans] of groups) layoutBlock(p, spans, scale);
}

function changedBlocks(view: EditorView, prev: PMNode): Set<HTMLElement> | null {
  const doc = view.state.doc;
  const start = doc.content.findDiffStart(prev.content);
  if (start === null) return null;
  const end = doc.content.findDiffEnd(prev.content)?.a ?? start;
  const out = new Set<HTMLElement>();
  const to = Math.min(doc.content.size, Math.max(start, end) + 1);
  doc.nodesBetween(Math.max(0, start - 1), to, (node, pos) => {
    if (!node.isTextblock) return true;
    let has = false;
    node.forEach((c) => { if (c.type.name === 'tabChar') has = true; });
    const dom = has ? view.nodeDOM(pos) : null;
    if (dom instanceof HTMLElement) out.add(dom);
    return false;
  });
  return out;
}

const key = new PluginKey('tabStops');

export const TabStops = Extension.create({
  name: 'tabStops',
  // După liste (Tab = sub-listă) și tabele (Tab = celula următoare).
  priority: 50,
  addGlobalAttributes() {
    return [{
      types: TYPES,
      attributes: {
        tabStops: {
          default: null,
          parseHTML: (el) => formatStops(parseStops(el.getAttribute('data-tabs'))),
          renderHTML: (a) => (a.tabStops ? { 'data-tabs': a.tabStops } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      insertTab: () => ({ commands }) => commands.insertContent({ type: 'tabChar' }),
      setTabStops: (stops) => ({ commands }) => {
        const v = formatStops(stops);
        return TYPES.map((t) => commands.updateAttributes(t, { tabStops: v })).some(Boolean);
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { $from } = this.editor.state.selection;
        if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false;
        return this.editor.commands.insertTab();
      },
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      key,
      view: (view) => {
        let width = 0, destroyed = false;
        const all = () => layoutTabs(view.dom as HTMLElement);
        const raf = requestAnimationFrame(all);
        document.fonts?.ready.then(() => { if (!destroyed) all(); }).catch(() => {});
        // Tabul ascuns (alt document în față) are pagina fără lățime: tabulatorii se așază când pagina apare.
        const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
          const w = (view.dom as HTMLElement).offsetWidth;
          if (w && w !== width) { width = w; all(); }
        });
        ro?.observe(view.dom);
        return {
          update(v, prevState) {
            if (v.state.doc === prevState.doc) return;
            const blocks = changedBlocks(v, prevState.doc);
            layoutTabs(v.dom as HTMLElement, blocks ?? new Set());
          },
          destroy() { destroyed = true; cancelAnimationFrame(raf); ro?.disconnect(); },
        };
      },
    })];
  },
});
