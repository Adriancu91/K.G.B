// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Decuparea unei poze din notiță: tragi cu mouse-ul un dreptunghi peste poză și păstrezi doar ce e înăuntru.
import { useEffect, useRef, useState } from 'react';
import { isCurrent } from '../active';

interface Rect { x: number; y: number; w: number; h: number }

/** Partea decupată, ca PNG (coordonatele sunt în pixelii pozei). */
export async function cropImage(src: string, r: Rect): Promise<Blob> {
  const img = new Image();
  await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('poza nu se poate citi')); img.src = src; });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w));
  c.height = Math.max(1, Math.round(r.h));
  c.getContext('2d')!.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('decupare eșuată'))), 'image/png'));
}

/** Poza întoarsă cu un sfert de cerc (1: spre dreapta, -1: spre stânga), ca PNG. */
export async function rotateImage(src: string, dir: 1 | -1): Promise<Blob> {
  const img = new Image();
  await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('poza nu se poate citi')); img.src = src; });
  const c = document.createElement('canvas');
  c.width = img.naturalHeight;
  c.height = img.naturalWidth;
  const g = c.getContext('2d')!;
  g.translate(c.width / 2, c.height / 2);
  g.rotate((dir * Math.PI) / 2);
  g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('rotire eșuată'))), 'image/png'));
}

export default function CropDialog({ src, onDone, onClose }: { src: string; onDone(png: Blob): void; onClose(): void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const start = useRef<[number, number] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isCurrent('note')) return; if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Punctul din poză (în pixelii ei) de sub mouse, ținut în marginile pozei.
  const at = (e: React.PointerEvent): [number, number] => {
    const im = imgRef.current!;
    const r = im.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * im.naturalWidth;
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * im.naturalHeight;
    return [x, y];
  };
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fără captură */ }
    start.current = at(e);
    setRect(null);
  };
  const move = (e: React.PointerEvent) => {
    if (!start.current) return;
    const [x0, y0] = start.current;
    const [x1, y1] = at(e);
    setRect({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });
  };
  const up = () => { start.current = null; setRect((r) => (r && r.w >= 4 && r.h >= 4 ? r : null)); };

  const done = async () => {
    if (!rect) return;
    try { onDone(await cropImage(src, rect)); } catch { onClose(); }
  };

  const im = imgRef.current;
  const pct = (v: number, of: number | undefined) => `${(v / Math.max(1, of ?? 1)) * 100}%`;
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg note-crop" role="dialog" aria-label="Decupează poza">
        <h3>✂ Decupează poza</h3>
        <div className="note-crop-area" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <img ref={imgRef} src={src} alt="Poza de decupat" draggable={false} />
          {rect && im && (
            <div className="note-crop-rect" style={{ left: pct(rect.x, im.naturalWidth), top: pct(rect.y, im.naturalHeight), width: pct(rect.w, im.naturalWidth), height: pct(rect.h, im.naturalHeight) }} />
          )}
        </div>
        <div className="note-draw-actions">
          <span className="muted">{rect ? `Se păstrează ${Math.round(rect.w)} × ${Math.round(rect.h)} px.` : 'Trage cu mouse-ul peste partea pe care vrei s-o păstrezi.'}</span>
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={done} disabled={!rect}>Decupează</button>
        </div>
      </div>
    </div>
  );
}
