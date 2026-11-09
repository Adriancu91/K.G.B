// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Zoom-ul din bara de jos (Docs, Sheets, Notițe): − / glisorul / procentul (click = 100%) / + / opțional „▯ O pagină” și „↔ Lățime”,
// plus Ctrl + rotița mouse-ului.
import { RefObject, useEffect, useRef, useState } from 'react';
import { clampZoom, loadZoom, nextZoom, saveZoom, ZOOM_MAX, ZOOM_MIN } from './zoom';

/** Zoom-ul ținut minte sub `key` și Ctrl + rotița peste elementul `area` (rotița fără Ctrl derulează ca de obicei). */
export function useZoom(key: string, area: RefObject<HTMLElement>): [number, (z: number) => void] {
  const [zoom, setZoomState] = useState(() => loadZoom(key));
  const ref = useRef(zoom);
  ref.current = zoom;
  const setZoom = (z: number) => { const v = clampZoom(z); ref.current = v; setZoomState(v); saveZoom(v, key); };
  const setRef = useRef(setZoom);
  setRef.current = setZoom;
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setRef.current(nextZoom(ref.current, e.deltaY < 0 ? 1 : -1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // area.current: și elementele care apar abia după încărcare (de exemplu Notițele, după ce se citește caietul).
  }, [area, area.current]); // eslint-disable-line react-hooks/exhaustive-deps
  return [zoom, setZoom];
}

export default function ZoomControl({ zoom, setZoom, what, onFit, fitLabel, fitTitle, onFitPage }: { zoom: number; setZoom(z: number): void; what: string; onFit?(): void; fitLabel?: string; fitTitle?: string; onFitPage?(): void }) {
  return (
    <span className="doc-zoom" role="group" aria-label="Zoom">
      <button className="status-link" onClick={() => setZoom(nextZoom(zoom, -1))} disabled={zoom <= ZOOM_MIN} title={`Micșorează ${what} pe ecran (Ctrl + rotița mouse-ului)`} aria-label="Micșorează">−</button>
      <input className="zoom-slider" type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Glisorul de zoom" title={`Trage ca să mărești sau să micșorezi ${what} (între ${ZOOM_MIN}% și ${ZOOM_MAX}%)`} />
      <button className="status-link" onClick={() => setZoom(100)} title="Înapoi la 100%">{zoom}%</button>
      <button className="status-link" onClick={() => setZoom(nextZoom(zoom, 1))} disabled={zoom >= ZOOM_MAX} title={`Mărește ${what} pe ecran (Ctrl + rotița mouse-ului)`} aria-label="Mărește">+</button>
      {onFitPage && <button className="status-link zoom-fit" onClick={onFitPage} title="O pagină: toată pagina încape pe ecran, de sus până jos">▯ O pagină</button>}
      {onFit && <button className="status-link zoom-fit" onClick={onFit} title={fitTitle ?? 'Pagina cât toată lățimea ferestrei'}>{fitLabel ?? '↔ Lățime'}</button>}
    </span>
  );
}
