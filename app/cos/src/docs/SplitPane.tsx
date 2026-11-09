// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Scindare (Vizualizare › Fereastră): același document în două părți ale ferestrei, fiecare derulată separat.
// Sus rămâne editorul; jos e a doua vedere a aceluiași document, în care se scrie direct: fiecare schimbare de jos
// trece în editorul de sus (cu Ctrl+Z, urmărirea modificărilor și regulile lui), iar orice schimbare de sus apare jos.
// În jurul textului (antet, subsol, filigran, numerele paginilor) e o copie a paginii, ținută la zi (MutationObserver).
// Bara dintre ele se trage (20%–80%); dublu clic pe bară = Eliminare scindare.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { EditorState, Selection, TextSelection, type Transaction } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { keymap } from '@tiptap/pm/keymap';
import { baseKeymap, toggleMark } from '@tiptap/pm/commands';

/** Selecția de jos pusă pe documentul nou (aceleași poziții, ținute în document). */
function selectionOn(doc: EditorState['doc'], sel: Selection): Selection {
  try { return Selection.fromJSON(doc, sel.toJSON()); } catch { /* pozițiile nu mai există */ }
  const pos = Math.max(0, Math.min(sel.head, doc.content.size));
  return TextSelection.near(doc.resolve(pos));
}

export default function SplitPane({ editor, areaRef, ratio, setRatio, onClose }: {
  editor: Editor; areaRef: React.RefObject<HTMLDivElement | null>; ratio: number; setRatio(r: number): void; onClose(): void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const area = areaRef.current, host = viewRef.current;
    const page = area?.querySelector('.page');
    if (!area || !host || !page) return;
    const main = editor.view;
    const schema = editor.schema;

    // A doua vedere a documentului: tastele de bază, aldin / cursiv / subliniat / tăiat, iar Ctrl+Z / Ctrl+Y în editorul de sus.
    const marks: Record<string, (s: EditorState, d?: (tr: Transaction) => void) => boolean> = {};
    for (const [key, name] of [['Mod-b', 'bold'], ['Mod-i', 'italic'], ['Mod-u', 'underline'], ['Mod-Shift-x', 'strike']] as const) {
      if (schema.marks[name]) marks[key] = toggleMark(schema.marks[name]);
    }
    const history = {
      'Mod-z': () => { editor.commands.undo(); return true; },
      'Mod-y': () => { editor.commands.redo(); return true; },
      'Shift-Mod-z': () => { editor.commands.redo(); return true; },
    };
    const plugins = [keymap({ ...history, ...marks }), keymap(baseKeymap)];
    let pending: Selection | null = null;
    const pm = document.createElement('div');
    const bottom: EditorView = new EditorView({ mount: pm }, {
      state: EditorState.create({ doc: main.state.doc, plugins }),
      editable: () => editor.isEditable,
      attributes: () => ({
        class: [...main.dom.classList].filter((c) => c !== 'ProseMirror' && c !== 'ProseMirror-focused').join(' '),
        spellcheck: main.dom.getAttribute('spellcheck') ?? 'true',
        lang: main.dom.getAttribute('lang') ?? '',
        'aria-label': 'A doua parte a documentului',
      }),
      dispatchTransaction(tr) {
        if (!tr.docChanged) { bottom.updateState(bottom.state.apply(tr)); return; }
        // Schimbarea trece sus; vederea de jos se reface din documentul de sus (vezi sync), cu selecția de aici.
        pending = bottom.state.apply(tr).selection;
        const up = main.state.tr;
        const back = () => bottom.updateState(EditorState.create({ doc: main.state.doc, selection: selectionOn(main.state.doc, bottom.state.selection), plugins }));
        for (const step of tr.steps) if (up.maybeStep(step).failed) { pending = null; back(); return; }
        if (tr.storedMarks) up.setStoredMarks(tr.storedMarks);
        main.dispatch(up);
        pending = null;
        // Sus schimbarea a fost refuzată (de exemplu o zonă protejată): jos rămâne documentul de sus.
        if (bottom.state.doc !== main.state.doc) back();
      },
    });

    // Orice schimbare a documentului de sus (scris sus, scris jos, Ctrl+Z) ajunge jos.
    const sync = ({ transaction }: { transaction: Transaction }) => {
      const doc = main.state.doc, cur = bottom.state;
      if (cur.doc === doc) return;
      const sel = pending ? selectionOn(doc, pending)
        : transaction.before === cur.doc ? cur.selection.map(doc, transaction.mapping) : selectionOn(doc, cur.selection);
      bottom.updateState(EditorState.create({ doc, selection: sel, plugins: cur.plugins, storedMarks: cur.storedMarks }));
    };
    editor.on('transaction', sync);

    // Copia paginii în jurul textului: la pornire și după schimbările din afara textului (cu o mică întârziere).
    // Partea cu textul rămâne mereu aceeași (vederea de jos), ca să nu piardă cursorul când se reface restul.
    const holder = (main.dom.parentElement && page.contains(main.dom.parentElement) && main.dom.parentElement !== page)
      ? main.dom.parentElement.cloneNode(false) as HTMLElement : document.createElement('div');
    holder.appendChild(pm);
    const frame = page.cloneNode(false) as HTMLElement;
    let timer = 0;
    const copy = () => {
      timer = 0;
      for (const a of [...frame.attributes]) frame.removeAttribute(a.name);
      for (const a of [...page.attributes]) if (a.name !== 'id') frame.setAttribute(a.name, a.value);
      for (const c of [...frame.childNodes]) if (c !== holder) c.remove();
      let after = false;
      for (const c of [...page.childNodes]) {
        if (c.contains(main.dom)) { if (holder.parentNode !== frame) frame.appendChild(holder); after = true; continue; }
        const k = c.cloneNode(true) as HTMLElement;
        if (k.nodeType === 1) {
          k.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
          k.removeAttribute?.('id');
          k.querySelectorAll('[contenteditable]').forEach((e) => e.setAttribute('contenteditable', 'false'));
        }
        if (after) frame.appendChild(k); else frame.insertBefore(k, holder.parentNode === frame ? holder : null);
      }
      if (holder.parentNode !== frame) frame.appendChild(holder);
    };
    copy();
    host.replaceChildren(frame);
    host.scrollTop = area.scrollTop;
    const mo = new MutationObserver((recs) => {
      if (timer || recs.every((r) => main.dom.contains(r.target))) return;
      timer = window.setTimeout(copy, 200);
    });
    mo.observe(page, { subtree: true, childList: true, characterData: true, attributes: true });
    return () => { mo.disconnect(); if (timer) clearTimeout(timer); editor.off('transaction', sync); bottom.destroy(); };
  }, [areaRef, editor]);

  // Panoul de jos stă exact sub zona paginii (panourile laterale rămân pe loc).
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const measure = () => setRect({ left: area.offsetLeft, width: area.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(area);
    if (area.parentElement) ro.observe(area.parentElement);
    return () => ro.disconnect();
  }, [areaRef]);

  const dragBar = (e: React.MouseEvent) => {
    e.preventDefault();
    const body = boxRef.current?.parentElement;
    if (!body) return;
    const r = body.getBoundingClientRect();
    const move = (ev: MouseEvent) => setRatio(Math.min(0.8, Math.max(0.2, (ev.clientY - r.top) / r.height)));
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div ref={boxRef} className="doc-split-pane" style={{ left: rect.left, width: rect.width, top: `${ratio * 100}%` }}>
      <div className="doc-split-bar" role="separator" aria-orientation="horizontal" onMouseDown={dragBar} onDoubleClick={onClose}
        title="Trage ca să schimbi cât ocupă fiecare parte; dublu clic = Eliminare scindare" />
      <div ref={viewRef} className="page-area doc-split-view"
        title="A doua parte a documentului: se derulează separat, iar ce scrii aici apare imediat și sus (și invers)" />
    </div>
  );
}
