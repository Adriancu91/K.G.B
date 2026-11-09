// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Pagina X din Y” din bara de stare (ca în Word). Pe ecran documentul e o singură foaie lungă, așa că paginile se calculează
// din înălțimea blocurilor: fiecare pagină are loc pentru înălțimea hârtiei minus marginile de sus și de jos, iar „Pagină nouă”
// (Ctrl+Enter) începe una nouă. Un paragraf mai lung decât locul rămas trece pe pagina următoare, ca la tipărire.
import type { EditorView } from '@tiptap/pm/view';

export interface Block { top: number; height: number; pageBreak?: boolean }

/** Unde începe fiecare pagină (în pixeli de la începutul textului); prima pagină începe la 0. */
export function pageStarts(blocks: Block[], pageH: number): number[] {
  const starts = [0];
  if (pageH <= 0) return starts;
  let used = 0;
  let breakNext = false;
  for (const b of blocks) {
    if (b.pageBreak) { breakNext = true; continue; }
    if (breakNext) { starts.push(b.top); used = 0; breakNext = false; }
    if (used + b.height <= pageH + 0.5) { used += b.height; continue; }
    if (b.height <= pageH && used > 0) { starts.push(b.top); used = b.height; continue; }
    // Bloc mai înalt decât pagina: se rupe peste pagini (rândurile curg mai departe).
    let y = b.top + (pageH - used);
    const end = b.top + b.height;
    while (y < end) { starts.push(y); y += pageH; }
    used = end - starts[starts.length - 1];
  }
  return starts;
}

/** Pe ce pagină e un punct (pixeli de la începutul textului) și câte pagini sunt. */
export function pageOf(starts: number[], y: number): { page: number; pages: number } {
  let page = 1;
  for (let i = 1; i < starts.length; i++) if (starts[i] <= y) page = i + 1;
  return { page, pages: starts.length };
}

/** Măsoară editorul de pe ecran: pagina cursorului (sau a poziției `at`) și numărul de pagini. `pageH` e înălțimea de scris a paginii, în px la 100%. */
export function measurePages(view: EditorView, pageH: number, at?: number): { page: number; pages: number } {
  return pageMap(view, pageH)(at ?? view.state.selection.head);
}

/** O singură măsurare a paginilor, apoi pagina oricărei poziții (pentru cuprins, lista figurilor, trimiteri). */
export function pageMap(view: EditorView, pageH: number): (pos: number) => { page: number; pages: number } {
  const dom = view.dom as HTMLElement;
  const { starts, base } = pageLayout(view, pageH);
  const rect = dom.getBoundingClientRect();
  const scale = (dom.offsetHeight ? rect.height / dom.offsetHeight : 1) || 1;
  return (pos: number) => {
    let y = 0;
    try {
      y = (view.coordsAtPos(Math.min(pos, view.state.doc.content.size)).top - rect.top) / scale - base;
    } catch { /* poziția nu are coordonate (editor ascuns) */ }
    return pageOf(starts, y);
  };
}

/** Unde începe fiecare pagină (pixeli de la începutul textului) și unde e începutul textului în editor (`base`, față de marginea lui de sus). */
export function pageLayout(view: EditorView, pageH: number): { starts: number[]; base: number } {
  const dom = view.dom as HTMLElement;
  const kids = [...dom.children] as HTMLElement[];
  const box = dom.getBoundingClientRect();
  const zoom = dom.offsetHeight ? box.height / dom.offsetHeight || 1 : 1;
  const blocks: Block[] = kids.flatMap((el, i) => {
    const next = kids[i + 1];
    const height = next ? next.offsetTop - el.offsetTop : el.offsetHeight;
    // Tabelele se rup între rânduri la tipărire, deci fiecare rând e un bloc al lui (un rând nu se rupe în două).
    const rows = el.querySelector('table')?.rows;
    if (rows && rows.length > 1) {
      const top0 = el.getBoundingClientRect().top;
      const tops = [...rows].map((r) => el.offsetTop + (r.getBoundingClientRect().top - top0) / zoom);
      return tops.map((t, k) => ({ top: k ? t : el.offsetTop, height: Math.max(0, (k + 1 < tops.length ? tops[k + 1] : el.offsetTop + height) - (k ? t : el.offsetTop)) }));
    }
    return [{ top: el.offsetTop, height: Math.max(0, height), pageBreak: el.hasAttribute('data-page-break') }];
  });
  const base = kids[0]?.offsetTop ?? 0;
  for (const b of blocks) b.top -= base;
  return { starts: pageStarts(blocks, pageH), base };
}

// Înălțimea de scris a paginii pentru fiecare editor (o pune Docs.tsx după hârtie și margini), ca blocurile care arată numere de
// pagină (cuprinsul, lista figurilor) să le poată calcula. La schimbare, editorul primește evenimentul „suite-pages”.
const heights = new WeakMap<EditorView, number>();
/** A4 cu margini de 2,5 cm, dacă Docs nu a spus altceva. */
const DEFAULT_PAGE_H = (297 - 50) * 3.78;

export function setPageHeight(view: EditorView, h: number): void {
  if (heights.get(view) === h) return;
  heights.set(view, h);
  view.dom.dispatchEvent(new CustomEvent('suite-pages'));
}

export function pageHeight(view: EditorView): number {
  return heights.get(view) ?? DEFAULT_PAGE_H;
}

/** Începutul fiecărei pagini ca poziție în document (pentru „Mergi la” → Pagină): primul loc de text de pe pagină. */
export function pagePositions(view: EditorView): number[] {
  const dom = view.dom as HTMLElement;
  const { starts, base } = pageLayout(view, pageHeight(view));
  const rect = dom.getBoundingClientRect();
  const scale = (dom.offsetHeight ? rect.height / dom.offsetHeight : 1) || 1;
  const out: number[] = [];
  for (const y of starts) {
    const hit = view.posAtCoords({ left: rect.left + Math.min(40, rect.width / 2), top: rect.top + (base + y) * scale + 4 });
    const pos = hit ? hit.pos : out.length ? view.state.doc.content.size : 0;
    out.push(Math.max(out[out.length - 1] ?? 0, pos));
  }
  return out;
}
