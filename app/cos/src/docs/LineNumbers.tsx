// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { groupLines, numberLines, type LineBox } from './lineNumMath';
import { pageLayout } from './pageCount';
import type { LineNums } from './format';

// Numerele rândurilor în marginea din stânga a textului. Stau în cutia editorului (nu peste pagină), ca să rămână lângă rânduri
// și la tipărire / PDF. Se măsoară din nou după fiecare schimbare a textului sau a mărimii (cu o mică întârziere, ca să nu încetinească scrisul).
export function LineNumbers({ editor, setup, pageH, columns }: { editor: Editor; setup: LineNums; pageH: number; columns: number }) {
  const [rows, setRows] = useState<{ y: number; h: number; x: number; n: number }[]>([]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const view = editor.view;
    const dom = view.dom as HTMLElement;
    const box = dom.parentElement;
    setHost(box);
    if (!box) return;
    const measure = () => {
      const hr = box.getBoundingClientRect(), dr = dom.getBoundingClientRect();
      const scale = (dom.offsetHeight ? dr.height / dom.offsetHeight : 1) || 1;
      const colW = dr.width / Math.max(1, columns);
      const blocks = [...dom.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6, pre')]
        .filter((el) => !el.closest('table') && !el.parentElement?.closest('p, h1, h2, h3, h4, h5, h6, pre'));
      const lines: (LineBox & { x: number })[] = [];
      const range = document.createRange();
      for (const el of blocks) {
        range.selectNodeContents(el);
        const er = el.getBoundingClientRect();
        let ls = groupLines([...range.getClientRects()].map((r) => ({ top: (r.top - hr.top) / scale, height: r.height / scale })));
        if (!ls.length) ls = [{ top: (er.top - hr.top) / scale, height: er.height / scale }];
        const ci = Math.min(columns - 1, Math.max(0, Math.floor((er.left - dr.left + 1) / colW)));
        const x = (dr.left - hr.left + ci * colW) / scale;
        for (const l of ls) lines.push({ ...l, x });
      }
      const { starts, base } = pageLayout(view, pageH);
      const nums = numberLines(lines.map((l) => l.top - base), starts, !!setup.page, setup.by ?? 1);
      setRows(lines.map((l, i) => ({ y: l.top, h: l.height, x: l.x, n: nums[i] })).filter((r) => r.n > 0));
    };
    let timer = 0;
    const later = () => { window.clearTimeout(timer); timer = window.setTimeout(measure, 120); };
    measure();
    editor.on('update', later);
    window.addEventListener('resize', later);
    dom.addEventListener('suite-pages', later);
    const ro = new ResizeObserver(later);
    ro.observe(dom);
    return () => {
      window.clearTimeout(timer);
      editor.off('update', later);
      window.removeEventListener('resize', later);
      dom.removeEventListener('suite-pages', later);
      ro.disconnect();
    };
  }, [editor, setup.page, setup.by, pageH, columns]);
  if (!host) return null;
  return createPortal(
    <div className="doc-linenums" aria-hidden="true">
      {rows.map((r, i) => <span key={i} style={{ top: r.y, height: r.h, lineHeight: `${r.h}px`, left: r.x - 44 }}>{r.n}</span>)}
    </div>,
    host,
  );
}
