// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Panoul de navigare (Word: Vizualizare → Panou de navigare), cu cele trei file cunoscute:
// - Titluri: titlurile documentului, cu cel în care ești evidențiat; la căutare se marchează titlurile care au rezultate în ele.
// - Pagini: paginile de tipărire, cu începutul textului de pe fiecare; la căutare rămân doar paginile cu rezultate.
// - Rezultate: fiecare potrivire cu câteva cuvinte în jur; click te duce la ea.
// Căsuța de sus caută în tot documentul (aceeași căutare ca bara Ctrl+F, cu evidențierea în text).
import { useEffect, useReducer, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { tocEntries } from './toc';
import { getSearch, searchKey } from './search';
import { TextSelection } from '@tiptap/pm/state';
import { pageHeight, pageMap, pagePositions } from './pageCount';

type Tab = 'titles' | 'pages' | 'results';

/** Câteva cuvinte în jurul unei potriviri, din paragraful ei: [înainte, potrivirea, după]. */
export function snippet(editor: Editor, from: number, to: number, around = 28): [string, string, string] {
  const doc = editor.state.doc;
  const $a = doc.resolve(from);
  const start = $a.start(), end = $a.end();
  const txt = (a: number, b: number) => doc.textBetween(Math.max(start, a), Math.min(end, b), ' ', ' ');
  let before = txt(from - around, from), after = txt(to, to + around);
  if (from - around > start) before = '…' + before.replace(/^\S*\s/, '');
  if (to + around < end) after = after.replace(/\s\S*$/, '') + '…';
  return [before, txt(from, to), after];
}

export default function NavPane({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [tab, setTabState] = useState<Tab>(() => { try { const t = localStorage.getItem('suite.docs.navTab'); return t === 'pages' || t === 'results' ? t : 'titles'; } catch { return 'titles'; } });
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem('suite.docs.navTab', t); } catch { /* fără memorie locală */ } };
  const [term, setTerm] = useState(() => getSearch(editor.state).term);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  // Paginile se măsoară pe ecran, deci doar puțin după ultima modificare (scrisul rămâne rapid).
  const [pages, setPages] = useState<{ pos: number; text: string }[]>([]);
  const pageOfPos = useRef<(pos: number) => number>(() => 1);
  useEffect(() => {
    let t = 0;
    const measure = () => {
      const view = editor.view;
      const doc = editor.state.doc;
      // Prima pagină începe la începutul documentului; celelalte la începutul cuvântului de pe primul rând.
      const starts = pagePositions(view).map((pos, i) => (i === 0 ? 0 : wordStart(doc, pos)));
      setPages(starts.map((pos, i) => {
        const end = i + 1 < starts.length ? starts[i + 1] : doc.content.size;
        const text = doc.textBetween(pos, Math.min(end, pos + 400), ' ', ' ').replace(/\s+/g, ' ').trim();
        return { pos, text: text.length > 90 ? text.slice(0, 90).replace(/\s\S*$/, '') + '…' : text };
      }));
      const map = pageMap(view, pageHeight(view));
      pageOfPos.current = (pos) => map(pos).page;
    };
    const onTr = () => { redraw(); window.clearTimeout(t); t = window.setTimeout(measure, 300); };
    measure();
    editor.on('transaction', onTr);
    return () => { window.clearTimeout(t); editor.off('transaction', onTr); };
  }, [editor]);

  const s = getSearch(editor.state);
  const searching = !!term.trim() && s.term === term;
  const matches = searching ? s.matches : [];
  const runSearch = (v: string) => {
    setTerm(v);
    editor.commands.setSearch(v, s.caseSensitive, { wholeWord: s.wholeWord, wildcards: s.wildcards, format: s.format });
    if (v.trim()) setTab(tab === 'titles' ? 'results' : tab);
  };
  const step = (dir: 1 | -1) => { editor.chain().focus().findNext(dir).run(); };
  const goMatch = (i: number) => {
    const m = matches[i];
    if (!m) return;
    // Potrivirea aleasă devine cea curentă (pentru ▲ ▼ și pentru bara Ctrl+F).
    const tr = editor.state.tr.setMeta(searchKey, { current: i }).setMeta('addToHistory', false);
    editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, m.from, m.to)).scrollIntoView());
    editor.commands.focus();
  };
  const go = (pos: number) => {
    editor.chain().focus().setTextSelection(pos + 1).run();
    requestAnimationFrame(() => (editor.view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const goPage = (pos: number) => {
    editor.chain().focus().setTextSelection(Math.max(1, Math.min(pos, editor.state.doc.content.size))).run();
    requestAnimationFrame(() => {
      try {
        const c = editor.view.coordsAtPos(editor.state.selection.from);
        const scroller = findScroller(editor.view.dom as HTMLElement);
        if (scroller) scroller.scrollBy({ top: c.top - scroller.getBoundingClientRect().top - 24 });
      } catch { /* fără coordonate */ }
    });
  };

  const all = tocEntries(editor.state.doc);
  const here = editor.state.selection.from;
  let current = -1;
  all.forEach((e, i) => { if (e.pos <= here) current = i; });
  // Titlurile cu rezultate: au o potrivire între ele și titlul următor.
  const titleHit = all.map((e, i) => {
    const end = i + 1 < all.length ? all[i + 1].pos : Infinity;
    return matches.some((m) => m.from >= e.pos && m.from < end);
  });
  const curPage = pages.length ? pageOfPos.current(here) : 1;
  const pageHits = pages.map((p, i) => {
    const end = i + 1 < pages.length ? pages[i + 1].pos : Infinity;
    return matches.filter((m) => m.from >= p.pos && m.from < end).length;
  });
  const shownPages = pages.map((p, i) => ({ ...p, i })).filter((p) => !searching || pageHits[p.i] > 0);

  return (
    <aside className="doc-nav" aria-label="Panoul de navigare">
      <div className="doc-nav-head">
        <b>Navigare</b>
        <button className="doc-nav-x" onClick={onClose} title="Închide panoul" aria-label="Închide panoul de navigare">×</button>
      </div>
      <div className="doc-nav-search">
        <input className="doc-nav-filter" value={term} onChange={(e) => runSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape' && term) { e.preventDefault(); runSearch(''); } }}
          placeholder="Caută în document" aria-label="Caută în document" />
        {term && <button className="doc-nav-x" onClick={() => runSearch('')} title="Șterge căutarea" aria-label="Șterge căutarea">×</button>}
      </div>
      {searching && (
        <div className="doc-nav-count">
          {matches.length ? <span><span>Rezultatul</span> {s.current + 1} <span>din</span> {matches.length}</span> : <span>Niciun rezultat</span>}
          <span className="doc-nav-steps">
            <button onClick={() => step(-1)} disabled={!matches.length} title="Rezultatul anterior (Shift+Enter)" aria-label="Rezultatul anterior">▲</button>
            <button onClick={() => step(1)} disabled={!matches.length} title="Rezultatul următor (Enter)" aria-label="Rezultatul următor">▼</button>
          </span>
        </div>
      )}
      <div className="doc-nav-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'titles'} className={tab === 'titles' ? 'on' : ''} onClick={() => setTab('titles')} title="Titlurile documentului">Titluri</button>
        <button role="tab" aria-selected={tab === 'pages'} className={tab === 'pages' ? 'on' : ''} onClick={() => setTab('pages')} title="Paginile de tipărire, cu începutul textului de pe fiecare">Pagini</button>
        <button role="tab" aria-selected={tab === 'results'} className={tab === 'results' ? 'on' : ''} onClick={() => setTab('results')} title="Rezultatele căutării, cu textul din jur">Rezultate</button>
      </div>
      {tab === 'titles' && (all.length === 0 ? (
        <p className="doc-nav-empty">Documentul nu are titluri. Alege „Titlu 1”, „Titlu 2” sau „Titlu 3” din lista de stiluri ca să apară aici.</p>
      ) : (
        <ul className="doc-nav-list">
          {all.map((e, i) => (
            <li key={e.pos}>
              <button className={`doc-nav-row l${e.level} ${i === current ? 'on' : ''} ${titleHit[i] ? 'hit' : ''}`} onClick={() => go(e.pos)} title={e.text}>{e.text}</button>
            </li>
          ))}
        </ul>
      ))}
      {tab === 'pages' && (shownPages.length === 0 ? (
        <p className="doc-nav-empty">Nicio pagină nu are rezultate.</p>
      ) : (
        <ul className="doc-nav-list doc-nav-pages">
          {shownPages.map((p) => (
            <li key={p.i}>
              <button className={`doc-nav-page ${p.i + 1 === curPage ? 'on' : ''}`} onClick={() => goPage(p.pos)} title="Mergi la pagină">
                <b><span>Pagina</span> {p.i + 1}</b>
                {searching && <span className="doc-nav-badge">{pageHits[p.i]}</span>}
                <span className="doc-nav-snip">{p.text || '(pagină goală)'}</span>
              </button>
            </li>
          ))}
        </ul>
      ))}
      {tab === 'results' && (!searching ? (
        <p className="doc-nav-empty">Scrie mai sus ce cauți: aici apar toate locurile în care apare, cu textul din jur.</p>
      ) : matches.length === 0 ? (
        <p className="doc-nav-empty">Textul nu apare în document.</p>
      ) : (
        <ul className="doc-nav-list doc-nav-results">
          {matches.slice(0, 500).map((m, i) => {
            const [a, b, c] = snippet(editor, m.from, m.to);
            return (
              <li key={m.from}>
                <button className={`doc-nav-result ${i === s.current ? 'on' : ''}`} onClick={() => goMatch(i)}>
                  {a}<mark>{b}</mark>{c}
                </button>
              </li>
            );
          })}
        </ul>
      ))}
    </aside>
  );
}

/** Începutul cuvântului în care cade poziția (în același paragraf). */
function wordStart(doc: Editor['state']['doc'], pos: number): number {
  const $p = doc.resolve(Math.min(pos, doc.content.size));
  if (!$p.parent.isTextblock) return pos;
  const before = $p.parent.textBetween(0, $p.parentOffset, undefined, ' ');
  const m = /[^\s]+$/.exec(before);
  return m ? pos - m[0].length : pos;
}

/** Primul părinte care derulează (în el stă pagina documentului). */
function findScroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}
