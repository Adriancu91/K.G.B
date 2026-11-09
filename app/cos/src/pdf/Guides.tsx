// @ts-nocheck
// Din Cyber Office Studio (src/pdf/Guides.tsx, D-071, D-078), neschimbat.
// 📏 Grilă și rigle peste pagină (doar pe ecran, nu intră în fișier): pătrățele de 1 cm (linie mai groasă la 5 cm) și rigle în
// centimetri sus și în stânga paginii, cu numerele lor. Ajută la măsurat și la pus semnături, ștampile și text la locul lor.
// Ghidajele: tragi din riglă o linie albastră pe pagină (din rigla de sus una orizontală, din cea din stânga una verticală);
// o linie pusă se mută trăgând de ea și se scoate trăgând-o înapoi pe riglă sau cu dublu clic. Sunt aceleași pe toate paginile.
import { useState } from 'react';

export type GuideMode = '' | 'grid' | 'rulers' | 'both';
/** Ghidajele, în puncte PDF de la marginea de sus (h) și din stânga (v) a paginii. */
export interface GuideLines { h: number[]; v: number[] }

/** Un centimetru în puncte PDF (1 pt = 1/72 inch). */
export const CM = 72 / 2.54;
/** Grosimea riglei pe ecran (px): o linie lăsată peste ea se scoate. */
const RULER = 14;

/** Mută ghidajul `i` de pe axa `axis` la `pos` (sau îl scoate dacă `pos` e null); i = -1 adaugă unul nou. */
export function moveGuide(lines: GuideLines, axis: 'h' | 'v', i: number, pos: number | null): GuideLines {
  const list = [...lines[axis]];
  if (i < 0) { if (pos !== null) list.push(pos); }
  else if (pos === null) list.splice(i, 1);
  else list[i] = pos;
  return { ...lines, [axis]: list };
}

interface Props {
  pw: number;
  ph: number;
  zoom: number;
  mode: GuideMode;
  lines?: GuideLines;
  onLines?(next: GuideLines): void;
}

export default function Guides({ pw, ph, zoom, mode, lines = { h: [], v: [] }, onLines }: Props) {
  // Linia trasă acum (din riglă sau mutată): axa, al câtelea ghidaj (-1 = nou) și locul ei pe ecran, în pixeli.
  const [drag, setDrag] = useState<{ axis: 'h' | 'v'; i: number; px: number } | null>(null);
  if (!mode) return null;
  const cm = CM * zoom;
  const grid = mode === 'grid' || mode === 'both';
  const rulers = mode === 'rulers' || mode === 'both';
  // Numerele pe riglă: la fiecare centimetru dacă e loc, altfel din 2 în 2 sau din 5 în 5.
  const every = cm >= 22 ? 1 : cm >= 11 ? 2 : 5;
  const nums = (len: number) => Array.from({ length: Math.floor(len / CM) + 1 }, (_, i) => i).filter((i) => i > 0 && i % every === 0);

  const start = (e: React.MouseEvent, axis: 'h' | 'v', i: number) => {
    if (e.button !== 0 || !onLines) return;
    e.preventDefault();
    e.stopPropagation();
    const box = (e.currentTarget as HTMLElement).closest('.pdf-guides')!.getBoundingClientRect();
    const at = (ev: MouseEvent) => (axis === 'h' ? ev.clientY - box.top : ev.clientX - box.left);
    const max = (axis === 'h' ? ph : pw) * zoom;
    const move = (ev: MouseEvent) => setDrag({ axis, i, px: Math.max(0, Math.min(max, at(ev))) });
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setDrag(null);
      const px = at(ev);
      // Lăsată pe riglă (sau în afara paginii): ghidajul se scoate; altfel rămâne acolo, în puncte PDF (rotunjite la 0,1).
      const pos = px < RULER || px > max ? null : Math.round((px / zoom) * 10) / 10;
      if (i < 0 && pos === null) return;
      onLines(moveGuide(lines, axis, i, pos));
    };
    setDrag({ axis, i, px: at(e.nativeEvent) });
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const line = (axis: 'h' | 'v', i: number, px: number, live = false) => (
    <div
      key={`${axis}${i}${live ? 'x' : ''}`}
      className={`pdf-guide ${axis}${live ? ' live' : ''}`}
      style={axis === 'h' ? { top: px } : { left: px }}
      title="Ghidaj: trage-l ca să-l muți; trage-l pe riglă sau dublu clic ca să-l scoți"
      data-pos={axis === 'h' ? lines.h[i] : lines.v[i]}
      onMouseDown={live ? undefined : (e) => start(e, axis, i)}
      onDoubleClick={live || !onLines ? undefined : () => onLines(moveGuide(lines, axis, i, null))}
    />
  );

  return (
    <div className="pdf-guides" aria-hidden="true">
      {grid && (
        <div
          className="pdf-grid"
          style={{ backgroundSize: `${cm * 5}px ${cm * 5}px, ${cm * 5}px ${cm * 5}px, ${cm}px ${cm}px, ${cm}px ${cm}px` }}
        />
      )}
      {lines.h.map((y, i) => (drag && drag.axis === 'h' && drag.i === i ? null : line('h', i, y * zoom)))}
      {lines.v.map((x, i) => (drag && drag.axis === 'v' && drag.i === i ? null : line('v', i, x * zoom)))}
      {drag && line(drag.axis, drag.i, drag.px, true)}
      {rulers && (
        <>
          <div className="pdf-ruler top" style={{ backgroundSize: `${cm}px 100%, ${cm / 2}px 6px` }}
            title={onLines ? 'Trage de aici în jos un ghidaj orizontal' : undefined} onMouseDown={(e) => start(e, 'h', -1)}>
            {nums(pw).map((i) => <span key={i} style={{ left: i * cm }}>{i}</span>)}
          </div>
          <div className="pdf-ruler left" style={{ backgroundSize: `100% ${cm}px, 6px ${cm / 2}px`, height: ph * zoom }}
            title={onLines ? 'Trage de aici spre dreapta un ghidaj vertical' : undefined} onMouseDown={(e) => start(e, 'v', -1)}>
            {nums(ph).map((i) => <span key={i} style={{ top: i * cm }}>{i}</span>)}
          </div>
        </>
      )}
    </div>
  );
}

/** Liniile de care se lipesc elementele mutate pe pagină: ghidajele și, cu grila pornită, liniile ei (la fiecare cm). */
export interface SnapLines { h: number[]; v: number[]; grid: boolean }

/**
 * Lipirea unui element mutat: dacă marginea lui (început sau sfârșit) e la mai puțin de `tol` puncte de o linie,
 * se mută exact pe ea. Întoarce poziția nouă a începutului.
 */
export function snapEdge(pos: number, size: number, lines: number[], grid: boolean, tol: number): number {
  let best = pos, dist = tol;
  const near = (target: number, edge: number) => { const d = Math.abs(target - edge); if (d < dist) { dist = d; best = pos + (target - edge); } };
  for (const l of lines) { near(l, pos); near(l, pos + size); }
  if (grid) for (const edge of [pos, pos + size]) near(Math.round(edge / CM) * CM, edge);
  return best;
}
