// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Scurtăturile procesorului de text cunoscut (INTERFATA-FAMILIARA.md, 3.3 și pasul D2), prinse înaintea celor implicite
// ale editorului: Ctrl+L / E / R / J aliniere (implicit erau cu Shift, iar Ctrl+E făcea text „cod”), Ctrl+1 / 2 / 5 spațierea
// rândurilor, Ctrl+M / Ctrl+Shift+M retragerea, Ctrl+T / Ctrl+Shift+T retragerea agățată, Ctrl+Shift+L listă cu marcatori,
// Ctrl+Shift+8 semnele de formatare, Ctrl+Shift+N stilul Normal, Ctrl+Space / Ctrl+Q golirea formatării caracterelor / paragrafului,
// Ctrl+0 spațiul de 12 pt înaintea paragrafului (pus / scos), Shift+F5 înapoi la locurile ultimelor modificări,
// Ctrl+Alt+P / O vizualizările Aspect imprimare / Schiță, Ctrl+Alt+S Scindare (le schimbă Docs.tsx, la evenimentul suite-docs-view),
// F4 repetă ultima comandă de format dată de la tastatură (de aici sau Ctrl+B / I / U), pe textul ales acum.
// Tastele se potrivesc după tasta fizică (src/keys.ts), deci merg și pe tastatura românească.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { matches } from '../keys';
import { applyBlock } from './paraStyle';
import { INDENT_CM } from './paragraphFormat';

/** Locurile ultimelor modificări (cel mai nou primul), ținute la zi când documentul se schimbă; Shift+F5 trece prin ele. */
const editsKey = new PluginKey<{ spots: number[]; at: number }>('familiarEdits');

export const FamiliarKeys = Extension.create({
  name: 'familiarKeys',
  // Înaintea scurtăturilor din StarterKit și din alinierea textului.
  priority: 1000,
  addProseMirrorPlugins() {
    const editor = this.editor;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = () => editor.chain().focus() as any;
    const keys: [string, () => void][] = [
      ['Ctrl+L', () => c().setTextAlign('left').run()],
      ['Ctrl+E', () => c().setTextAlign('center').run()],
      ['Ctrl+R', () => c().setTextAlign('right').run()],
      ['Ctrl+J', () => c().setTextAlign('justify').run()],
      ['Ctrl+1', () => c().setLineHeight('1').run()],
      ['Ctrl+2', () => c().setLineHeight('2').run()],
      ['Ctrl+5', () => c().setLineHeight('1.5').run()],
      ['Ctrl+M', () => c().changeIndent(1).run()],
      ['Ctrl+Shift+M', () => c().changeIndent(-1).run()],
      // Retragerea agățată: primul rând rămâne în stânga, celelalte se retrag cu o treaptă.
      ['Ctrl+T', () => c().changeIndent(1).setParagraphSpacing({ firstLine: -INDENT_CM }).run()],
      ['Ctrl+Shift+T', () => c().changeIndent(-1).setParagraphSpacing({ firstLine: null }).run()],
      ['Ctrl+Shift+L', () => { if (!editor.isActive('bulletList')) c().toggleBulletList().run(); }],
      ['Ctrl+Shift+8', () => c().toggleFormattingMarks().run()],
      ['Ctrl+Shift+N', () => applyBlock(editor, 'p')],
      ['Ctrl+Space', () => c().unsetAllMarks().run()],
      // Ctrl+D: fereastra Font (o deschide bara de format, care ascultă evenimentul pe editor).
      ['Ctrl+D', () => { editor.view.dom.dispatchEvent(new CustomEvent('suite-font-dialog')); }],
      ['Ctrl+Q', () => c().unsetTextAlign().setLineHeight(null).setParagraphSpacing({ spaceBefore: null, spaceAfter: null, firstLine: null, indent: 0, indentRight: null }).run()],
      // Cu Shift, alinierile nu mai fac nimic (erau scurtăturile implicite ale editorului); Ctrl+Shift+E e urmărirea modificărilor.
      ['Ctrl+Shift+R', () => {}], ['Ctrl+Shift+J', () => {}],
      // Ctrl+0: 12 pt înaintea paragrafului, sau nimic dacă avea deja spațiu.
      ['Ctrl+0', () => { const sb = editor.getAttributes('paragraph').spaceBefore ?? editor.getAttributes('heading').spaceBefore; c().setParagraphSpacing({ spaceBefore: sb ? null : 12 }).run(); }],
      // Ctrl+Alt+N (Ciornă) rămâne „notiță nouă” din orice loc din Windows (scurtătura globală a Notițelor).
      ['Ctrl+Alt+P', () => view('print')], ['Ctrl+Alt+O', () => view('outline')], ['Ctrl+Alt+S', () => view('split')],
      ['Shift+F5', () => {
        const st = editsKey.getState(editor.state);
        if (!st || !st.spots.length) return;
        const v = editor.view, size = v.state.doc.content.size;
        // Locul următor din listă care nu e chiar cel unde stă acum cursorul.
        let at = st.at;
        for (let k = 0; k < st.spots.length; k++) {
          at = (at + 1) % st.spots.length;
          if (Math.abs(st.spots[at] - v.state.selection.head) > 1 || st.spots.length === 1) break;
        }
        const pos = Math.max(0, Math.min(size, st.spots[at]));
        v.dispatch(v.state.tr.setSelection(TextSelection.near(v.state.doc.resolve(pos))).setMeta(editsKey, at).scrollIntoView());
        v.focus();
      }],
    ];
    // Comenzile care nu se repetă cu F4: mutări, vizualizări, ferestre.
    const once = new Set(['Shift+F5', 'Ctrl+Alt+P', 'Ctrl+Alt+O', 'Ctrl+Alt+S', 'Ctrl+D', 'Ctrl+Shift+8', 'Ctrl+Shift+R', 'Ctrl+Shift+J']);
    let last: (() => void) | null = null;
    const marks: [string, () => void][] = [
      ['Ctrl+B', () => c().toggleBold().run()], ['Ctrl+I', () => c().toggleItalic().run()], ['Ctrl+U', () => c().toggleUnderline().run()],
    ];
    const view = (to: string) => { editor.view.dom.dispatchEvent(new CustomEvent('suite-docs-view', { detail: to })); };
    const edits = new Plugin<{ spots: number[]; at: number }>({
      key: editsKey,
      state: {
        init: () => ({ spots: [], at: -1 }),
        apply(tr, prev) {
          const meta = tr.getMeta(editsKey);
          if (typeof meta === 'number') return { ...prev, at: meta };
          if (!tr.docChanged) return prev;
          const spots = prev.spots.map((p) => tr.mapping.map(p));
          // Locul modificării: capătul ultimei bucăți schimbate, dus până în documentul de acum.
          let here = tr.selection.head;
          tr.mapping.maps.forEach((m, i) => m.forEach((_a, _b, _c, end) => { here = tr.mapping.slice(i + 1).map(end); }));
          // O modificare lângă cea mai nouă (scrisul continuu) doar o mută; altfel e un loc nou (cel mult 4, ca în procesorul cunoscut).
          if (spots.length && Math.abs(spots[0] - here) < 40) spots[0] = here; else spots.unshift(here);
          return { spots: spots.slice(0, 4), at: -1 };
        },
      },
    });
    return [edits, new Plugin({
      key: new PluginKey('familiarKeys'),
      props: {
        handleKeyDown(_view, e) {
          if (!editor.isEditable) return false;
          if (matches(e, 'F4')) { last?.(); return true; }
          for (const [k, run] of keys) if (matches(e, k)) { run(); if (!once.has(k)) last = run; return true; }
          // Aldin / cursiv / subliniat rămân la editor; doar le ținem minte pentru F4.
          for (const [k, run] of marks) if (matches(e, k)) { last = run; return false; }
          // Ctrl+Shift+E nu ajunge la alinierea implicită: îl prinde documentul (urmărirea modificărilor).
          if (matches(e, 'Ctrl+Shift+E')) return true;
          return false;
        },
      },
    })];
  },
});
