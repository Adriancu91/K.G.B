// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Rigla de deasupra paginii din Docs: marginile, retragerile paragrafului cu cursorul (trase cu mouse-ul) și opririle lui de tabulator.
// Clic pe riglă = oprire nouă (de felul ales în pătrățelul din stânga), tragere = mutare, tras în jos de pe riglă = scoasă.
import { useEffect, useReducer, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ALIGN_NAMES, parseStops, TabAlign } from './tabStops';
import { firstLineFor, indentFor, indentMarks, moveStop, rightFor, snapCm, TAB_GLYPH, TAB_ORDER } from './rulerMath';

const CM = 96 / 2.54;
const BLOCKS = ['paragraph', 'heading'];

/** Paragraful (sau titlul) în care e cursorul. */
function currentBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (BLOCKS.includes(n.type.name)) return n;
  }
  return null;
}

type Drag = { kind: 'tab'; from: number; cm: number; off: boolean } | { kind: 'first' | 'body' | 'right'; cm: number };

export default function Ruler({ editor, areaRef }: { editor: Editor; areaRef: React.RefObject<HTMLDivElement | null> }) {
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [align, setAlign] = useState<TabAlign>('l');
  const [drag, setDrag] = useState<Drag | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Se redesenează la orice schimbare din document sau din cursor și la redimensionarea paginii.
  useEffect(() => {
    const on = () => redraw();
    editor.on('transaction', on);
    const area = areaRef.current;
    const ro = new ResizeObserver(on);
    const page = area?.querySelector('.page');
    if (page) ro.observe(page);
    if (area) ro.observe(area);
    return () => { editor.off('transaction', on); ro.disconnect(); };
  }, [editor, areaRef]);

  const pm = areaRef.current?.querySelector<HTMLElement>('.page .ProseMirror');
  const page = areaRef.current?.querySelector<HTMLElement>('.page');
  const box = wrap.current?.getBoundingClientRect();
  if (!pm || !page || !box) return <div className="doc-ruler-wrap" ref={wrap} />;
  const scale = pm.offsetWidth ? pm.getBoundingClientRect().width / pm.offsetWidth : 1;
  const cs = getComputedStyle(pm);
  const pr = page.getBoundingClientRect(), r = pm.getBoundingClientRect();
  const x0 = r.left + (parseFloat(cs.paddingLeft) || 0) * scale - box.left; // 0 cm: marginea textului
  const x1 = r.right - (parseFloat(cs.paddingRight) || 0) * scale - box.left;
  const pageL = pr.left - box.left, pageR = pr.right - box.left;
  const pxCm = CM * scale;
  const toCm = (clientX: number) => (clientX - box.left - x0) / pxCm;
  const at = (cm: number) => x0 + cm * pxCm;

  const width = (x1 - x0) / pxCm;
  const node = currentBlock(editor);
  const stops = parseStops(node?.attrs.tabStops);
  const marks = indentMarks(node?.attrs.indent, node?.attrs.firstLine);

  // Gradațiile: din jumătate în jumătate de cm, cu numere la fiecare cm (și în margini, numărate de la marginea textului).
  const ticks: React.ReactNode[] = [];
  for (let k = Math.ceil(-(x0 - pageL) / pxCm * 2) / 2; at(k) <= pageR; k += 0.5) {
    const whole = Math.abs(k - Math.round(k)) < 0.01;
    ticks.push(whole && k !== 0
      ? <span key={k} className="doc-ruler-num" style={{ left: at(k) }}>{Math.abs(Math.round(k))}</span>
      : <span key={k} className={whole ? 'doc-ruler-tick zero' : 'doc-ruler-tick'} style={{ left: at(k) }} />);
  }

  const setStops = (next: ReturnType<typeof moveStop>) => editor.chain().focus().setTabStops(next).run();
  const update = (attrs: Record<string, unknown>) => {
    if (!node) return;
    editor.chain().focus().updateAttributes(node.type.name, attrs).run();
  };

  // Tragerea unui marcaj: urmărim mouse-ul pe toată fereastra, iar la eliberare aplicăm.
  const start = (e: React.MouseEvent, d: Drag) => {
    e.preventDefault();
    e.stopPropagation();
    let cur = d;
    setDrag(cur);
    const move = (ev: MouseEvent) => {
      const cm = toCm(ev.clientX);
      cur = cur.kind === 'tab' ? { ...cur, cm, off: ev.clientY - box.bottom > 24 } : { ...cur, cm };
      setDrag(cur);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setDrag(null);
      if (cur.kind === 'tab') setStops(moveStop(stops, cur.from, cur.off ? null : cur.cm));
      else if (cur.kind === 'first') update({ firstLine: firstLineFor(cur.cm, marks.body) });
      else if (cur.kind === 'right') update({ indentRight: rightFor(cur.cm, width) });
      else update(indentFor(cur.cm, node?.attrs.firstLine));
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const shownFirst = drag?.kind === 'first' ? snapCm(drag.cm) : marks.first;
  const shownBody = drag?.kind === 'body' ? snapCm(drag.cm) : marks.body;
  const shownRight = drag?.kind === 'right' ? snapCm(drag.cm) : width - (Number(node?.attrs.indentRight) || 0);
  const next = TAB_ORDER[(TAB_ORDER.indexOf(align) + 1) % TAB_ORDER.length];

  return (
    <div className="doc-ruler-wrap" ref={wrap}>
      <div
        className="doc-ruler"
        role="group"
        aria-label="Riglă"
        style={{ left: pageL, width: pageR - pageL }}
        onMouseDown={(e) => {
          if (e.button !== 0 || !node) return;
          const cm = toCm(e.clientX);
          if (cm <= 0 || at(cm) > x1 + 1) return;
          e.preventDefault();
          setStops(moveStop(stops, null, cm, align));
        }}
        title="Clic pe riglă: oprire de tabulator nouă; trage o oprire ca s-o muți sau în jos ca s-o scoți"
      >
        <span className="doc-ruler-margin" style={{ left: 0, width: Math.max(0, x0 - pageL) }} />
        <span className="doc-ruler-margin" style={{ left: x1 - pageL, width: Math.max(0, pageR - x1) }} />
      </div>
      <div className="doc-ruler-marks" style={{ left: 0, right: 0 }} aria-hidden="false">
        {ticks}
        <button
          className="doc-ruler-type"
          style={{ left: Math.max(2, pageL + 2) }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAlign(next)}
          title={`Felul opririi puse cu clic pe riglă: ${ALIGN_NAMES[align]} (clic: ${ALIGN_NAMES[next]})`}
          aria-label={`Felul opririi: ${ALIGN_NAMES[align]}`}
        >{TAB_GLYPH[align]}</button>
        {node && <>
          <span
            className="doc-ruler-indent first"
            style={{ left: at(shownFirst) }}
            onMouseDown={(e) => start(e, { kind: 'first', cm: marks.first })}
            title="Retragerea primului rând (trage)"
            aria-label="Retragerea primului rând"
            role="slider"
            aria-valuenow={Math.round(shownFirst * 100) / 100}
          />
          <span
            className="doc-ruler-indent body"
            style={{ left: at(shownBody) }}
            onMouseDown={(e) => start(e, { kind: 'body', cm: marks.body })}
            title="Retragerea la stânga (trage)"
            aria-label="Retragerea la stânga"
            role="slider"
            aria-valuenow={Math.round(shownBody * 100) / 100}
          />
          <span
            className="doc-ruler-indent body right"
            style={{ left: at(shownRight) }}
            onMouseDown={(e) => start(e, { kind: 'right', cm: shownRight })}
            title="Retragerea la dreapta (trage)"
            aria-label="Retragerea la dreapta"
            role="slider"
            aria-valuenow={Math.round((width - shownRight) * 100) / 100}
          />
          {stops.map((t) => {
            const d = drag?.kind === 'tab' && Math.abs(drag.from - t.pos) < 0.01 ? drag : null;
            return (
              <span
                key={t.pos}
                className={`doc-ruler-tab${d?.off ? ' off' : ''}`}
                style={{ left: at(d ? snapCm(d.cm) : t.pos) }}
                onMouseDown={(e) => start(e, { kind: 'tab', from: t.pos, cm: t.pos, off: false })}
                title={`Oprire ${ALIGN_NAMES[t.align].toLowerCase()} la ${String(t.pos).replace('.', ',')} cm (trage ca s-o muți, în jos ca s-o scoți)`}
                aria-label={`Oprire de tabulator ${ALIGN_NAMES[t.align].toLowerCase()} la ${String(t.pos).replace('.', ',')} cm`}
                data-pos={t.pos}
              >{TAB_GLYPH[t.align]}</span>
            );
          })}
        </>}
      </div>
    </div>
  );
}
