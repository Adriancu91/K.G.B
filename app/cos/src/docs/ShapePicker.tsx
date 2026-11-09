// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Meniul „Forme” din Docs: dreptunghiuri, cercuri, săgeți, stea, balon de vorbire. Alegi culoarea de umplere și pe cea a conturului,
// apoi forma intră la cursor ca imagine (shapes.ts); din bara ei o poți recolora, mări, alinia sau pune cu textul în jur.
// Tot aici: textul artistic (wordArt.ts), un titlu desenat cu degrade, contur sau umbră.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { SHAPES, ShapeKind, shapeToPng } from './shapes';
import { renderWordArt, WORDART_MAX, WORDART_STYLES } from './wordArt';

const FILL_KEY = 'suite.docs.shapeFill';
const STROKE_KEY = 'suite.docs.shapeStroke';
const read = (k: string, d: string) => { try { const v = localStorage.getItem(k); return v && /^#[0-9a-f]{6}$/i.test(v) ? v : d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* fără memorie locală: culoarea nu se ține minte */ } };

export async function insertShape(editor: Editor, k: ShapeKind, fill: string, stroke: string) {
  const s = SHAPES.find((x) => x.k === k);
  if (!s) return;
  const spec = { k, fill: k === 'line' ? '' : fill, stroke, sw: k === 'line' ? 4 : 2 };
  const src = await shapeToPng(spec, s.w, s.h);
  editor.chain().focus().insertContent({
    type: 'image',
    attrs: { src, alt: `Formă: ${s.name.toLowerCase()}`, width: s.w, align: 'center', shape: JSON.stringify(spec) },
  }).run();
}

/** Pune un text artistic la cursor. */
export function insertWordArt(editor: Editor, text: string, s: string) {
  const t = text.trim().slice(0, WORDART_MAX);
  if (!t) return;
  const res = renderWordArt({ text: t, s });
  const page = (editor.view.dom as HTMLElement).clientWidth || 650;
  editor.chain().focus().insertContent({
    type: 'image', attrs: { src: res.src, alt: t, width: Math.min(page, res.width), align: 'center', wordart: JSON.stringify({ text: t, s }) },
  }).run();
}

export default function ShapePicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [fill, setFill] = useState(() => read(FILL_KEY, '#5b8def'));
  const [stroke, setStroke] = useState(() => read(STROKE_KEY, '#1e3a8a'));
  const box = useRef<HTMLDivElement>(null);
  const [art, setArt] = useState('Titlu');

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const pick = async (k: ShapeKind) => {
    setOpen(false);
    await insertShape(editor, k, fill, stroke);
  };

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}
        title="Forme și text artistic: dreptunghi, cerc, săgeți, stea, balon de vorbire, titluri cu degrade sau contur (apoi le poți recolora, mări și pune cu textul în jur)">⬠ Forme</button>
      {open && (
        <div className="sym-pop shape-pop" role="dialog" aria-label="Inserează formă">
          <div className="sym-head">Culori</div>
          <div className="shape-colors">
            <label>Umplere <input type="color" aria-label="Umplerea formei noi" value={fill} onChange={(e) => { setFill(e.target.value); save(FILL_KEY, e.target.value); }} /></label>
            <label>Contur <input type="color" aria-label="Conturul formei noi" value={stroke} onChange={(e) => { setStroke(e.target.value); save(STROKE_KEY, e.target.value); }} /></label>
          </div>
          <div className="sym-head">Forme</div>
          <div className="sym-grid">
            {SHAPES.map((s) => (
              <button key={s.k} className="sym-cell" data-shape={s.k} title={s.name} onMouseDown={(e) => e.preventDefault()} onClick={() => void pick(s.k)}>{s.icon}</button>
            ))}
          </div>
          <div className="sym-head">Text artistic</div>
          <input className="wordart-new" aria-label="Textul artistic nou" value={art} maxLength={WORDART_MAX} onChange={(e) => setArt(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()} placeholder="Scrie titlul" />
          <div className="wordart-styles">
            {WORDART_STYLES.map((s) => (
              <button key={s.id} className={`wordart-btn wa-${s.id}`} data-wordart={s.id} title={s.name} disabled={!art.trim()}
                onClick={() => { setOpen(false); insertWordArt(editor, art, s.id); }}>Aa</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
