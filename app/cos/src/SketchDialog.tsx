// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra ✏ Desen: stratul de desen din Slides peste o foaie albă. Liniile devin poză doar la „✓ Gata”.
import DrawLayer, { inkPng } from './slides/DrawLayer';
import { inkBox, type InkLine } from './slides/ink';
import { useEffect, useRef } from 'react';
import './sketch.css';

export const SKETCH = { w: 720, h: 420 };

/** O formă recunoscută cu ◇ În formă: felul, culoarea și grosimea conturului (ale creionului) și mărimea, în pixelii foii. */
export interface SketchShape { k: 'rect' | 'ellipse' | 'triangle'; stroke: string; sw: number; w: number; h: number }

/** Forma, dacă desenul e o singură linie recunoscută ca dreptunghi, elipsă sau triunghi obișnuit; altfel null (rămâne poză). */
export function sketchShape(lines: InkLine[]): SketchShape | null {
  if (lines.length !== 1) return null;
  const l = lines[0], sh = l.sh;
  if (!sh || sh.path || l.o < 1 || !/^#[0-9a-f]{6}$/i.test(l.c)) return null;
  if (sh.shape !== 'rect' && sh.shape !== 'ellipse' && sh.shape !== 'triangle') return null;
  if (sh.w < 8 || sh.h < 8) return null;
  return { k: sh.shape, stroke: l.c.toLowerCase(), sw: Math.min(20, Math.max(1, Math.round(l.w))), w: Math.round(sh.w), h: Math.round(sh.h) };
}

/** Liniile ca poză PNG transparentă, tăiată cât desenul; null dacă nu e nimic desenat. */
export function sketchBlob(lines: InkLine[]): Promise<Blob | null> {
  const box = inkBox(lines, SKETCH.w, SKETCH.h);
  const url = box && inkPng(lines, box);
  if (!url) return Promise.resolve(null);
  // Din data: URL direct în Blob (fetch pe data: e oprit de regulile de securitate ale paginii).
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const a = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
  return Promise.resolve(new Blob([a], { type: 'image/png' }));
}

export default function SketchDialog({ onDone }: { onDone(r: { blob: Blob; shape?: SketchShape } | null): void }) {
  // Fereastra ia tastatura, ca Ctrl+Z, Esc și Enter să ajungă la desen, nu la documentul de dedesubt.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  const done = (lines: InkLine[] | null) => {
    if (!lines?.length) { onDone(null); return; }
    const shape = sketchShape(lines);
    void sketchBlob(lines).then((blob) => onDone(blob ? { blob, ...(shape ? { shape } : {}) } : null));
  };
  return (
    <div className="print-overlay sketch-overlay">
      <div ref={box} tabIndex={-1} className="print-dlg sketch-dlg" role="dialog" aria-modal="true" aria-label="Desen">
        <h3>✏ Desen</h3>
        <p className="sketch-help">Desenează cu mouse-ul, cu creionul tabletei sau cu degetul. La „✓ Gata” desenul se pune ca poză (doar liniile, fără fundal).</p>
        <DrawLayer size={SKETCH} start={[]} onDone={done} onPage>
          <div className="sketch-paper" style={{ aspectRatio: `${SKETCH.w} / ${SKETCH.h}` }} />
        </DrawLayer>
      </div>
    </div>
  );
}
