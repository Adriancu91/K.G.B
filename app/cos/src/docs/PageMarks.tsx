// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Granițele paginilor pe ecran (Aspect imprimare): documentul e o singură foaie lungă, așa că unde începe o pagină nouă
// la tipărire se vede o linie punctată cu „Pagina 2”, „Pagina 3”… Pozițiile vin din aceeași măsurare ca „Pagina X din Y”
// (pageCount.ts). Doar pe ecran: la tipărire și în PDF liniile nu apar.
import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { pageLayout } from './pageCount';

export default function PageMarks({ editor, pageH }: { editor: Editor; pageH: number }) {
  const [marks, setMarks] = useState<number[]>([]);
  useEffect(() => {
    let t = 0;
    const run = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        let next: number[] = [];
        try {
          const dom = editor.view.dom as HTMLElement;
          const { starts, base } = pageLayout(editor.view, pageH);
          // Pozițiile blocurilor sunt față de foaie, sau față de editor dacă el e cel poziționat.
          const pg = dom.closest('.page') as HTMLElement | null;
          let origin = 0;
          if (pg && (dom.firstElementChild as HTMLElement | null)?.offsetParent === dom) {
            const scale = pg.offsetHeight ? pg.getBoundingClientRect().height / pg.offsetHeight || 1 : 1;
            origin = (dom.getBoundingClientRect().top - pg.getBoundingClientRect().top) / scale - pg.clientTop;
          }
          next = starts.slice(1).map((s) => Math.round(origin + base + s));
        } catch { /* editorul s-a închis */ }
        setMarks((old) => (old.length === next.length && old.every((v, i) => v === next[i]) ? old : next));
      }, 200);
    };
    run();
    editor.on('transaction', run);
    window.addEventListener('resize', run);
    return () => { window.clearTimeout(t); editor.off('transaction', run); window.removeEventListener('resize', run); };
  }, [editor, pageH]);
  return <>{marks.map((y, i) => <div key={i} className="doc-page-mark" style={{ top: y }} aria-hidden="true"><span>{`Pagina ${i + 2}`}</span></div>)}</>;
}
