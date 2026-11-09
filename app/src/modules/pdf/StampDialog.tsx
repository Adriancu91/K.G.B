// Copiat din Cyber Office Studio (src/pdf/StampDialog.tsx), aplicația proprietarului (D-071); schimbat doar unde K.G.B.
// lucrează altfel: ștampila se păstrează în modulul PDF („Ștampilele mele”, pe acest spațiu de lucru), nu în localStorage,
// iar ferestrele folosesc stilurile K.G.B.
// „Ștampilă nouă din imagine”: poza unei ștampile sau a unei semnături pe hârtie devine PNG fără fundal,
// tăiat pe desen, și intră în „Ștampilele mele”. Previzualizarea e pe un fond în carouri (ce se vede prin ea e transparent).
import { useEffect, useRef, useState } from 'react';
import { BG_TOL, contentBox, hasAlpha, removePaper } from './stampBg';

/** Ștampila gata de păstrat: numele, PNG-ul (base64, fără antet) și raportul înălțime / lățime. */
export interface CustomStamp { name: string; png: string; ratio: number }

/** Numele ștampilei, din numele fișierului: fără extensie, cu spații în loc de _ și - (din stamps.ts). */
export function stampName(file: string): string {
  const base = file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return (base || 'Ștampilă').slice(0, 40);
}

/** Latura lungă a pozei cât se lucrează pe ea (destul pentru o ștampilă clară, repede pe un laptop) și a ștampilei păstrate. */
const WORK_SIDE = 1200;
const KEEP_SIDE = 600;

interface Props {
  file: File;
  onDone(stamp: CustomStamp): void;
  onCancel(): void;
}

export function StampDialog({ file, onDone, onCancel }: Props) {
  const [src, setSrc] = useState<{ px: Uint8ClampedArray; w: number; h: number } | null>(null);
  const [err, setErr] = useState('');
  const [removeBg, setRemoveBg] = useState(true);
  const [tol, setTol] = useState(Math.round(BG_TOL * 100));
  const [name, setName] = useState(stampName(file.name));
  const [result, setResult] = useState<{ px: Uint8ClampedArray; w: number; h: number } | null>(null);
  const prevRef = useRef<HTMLCanvasElement>(null);

  // Poza se citește o dată, micșorată la mărimea de lucru.
  useEffect(() => {
    let gone = false;
    const url = URL.createObjectURL(file);
    (async () => {
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const k = Math.min(1, WORK_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height);
        c.width = 0;
        if (gone) return;
        // O poză care are deja transparență (PNG fără fundal) rămâne cum e, dacă nu ceri altfel.
        setRemoveBg(!hasAlpha(d.data));
        setSrc({ px: d.data, w: d.width, h: d.height });
      } catch {
        if (!gone) setErr('Imaginea nu s-a putut citi. Încearcă un fișier PNG sau JPG.');
      } finally {
        URL.revokeObjectURL(url);
      }
    })();
    return () => { gone = true; };
  }, [file]);

  // Fundalul scos și tăierea pe desen, din nou la fiecare schimbare (puțin după ce se oprește glisorul).
  useEffect(() => {
    if (!src) return;
    const t = window.setTimeout(() => {
      const px = removeBg ? removePaper(src.px, src.w, src.h, tol / 100) : src.px;
      const box = contentBox(px, src.w, src.h, removeBg ? 40 : 8) ?? { x: 0, y: 0, w: src.w, h: src.h };
      const out = new Uint8ClampedArray(box.w * box.h * 4);
      for (let y = 0; y < box.h; y++) out.set(px.subarray(((box.y + y) * src.w + box.x) * 4, ((box.y + y) * src.w + box.x + box.w) * 4), y * box.w * 4);
      setResult({ px: out, w: box.w, h: box.h });
    }, 120);
    return () => window.clearTimeout(t);
  }, [src, removeBg, tol]);

  useEffect(() => {
    const c = prevRef.current;
    if (!c || !result) return;
    c.width = result.w;
    c.height = result.h;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(result.px), result.w, result.h), 0, 0);
  }, [result]);

  const save = () => {
    if (!result) return;
    const full = document.createElement('canvas');
    full.width = result.w;
    full.height = result.h;
    full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(result.px), result.w, result.h), 0, 0);
    const k = Math.min(1, KEEP_SIDE / Math.max(result.w, result.h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(result.w * k));
    c.height = Math.max(1, Math.round(result.h * k));
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(full, 0, 0, c.width, c.height);
    const stamp = { name: (name.trim() || 'Ștampilă').slice(0, 40), png: c.toDataURL('image/png').split(',')[1] ?? '', ratio: c.height / c.width };
    full.width = 0;
    c.width = 0;
    onDone(stamp);
  };

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog pdf-stamp-dlg" role="dialog" aria-label="Ștampilă nouă din imagine" data-testid="pdf-stamp-dlg"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }}>
        <h3>Ștampilă nouă din imagine</h3>
        <p className="muted">Fotografiază sau scanează ștampila (ori semnătura) pe o foaie albă. Hârtia devine transparentă, cerneala își păstrează culoarea, iar imaginea se taie pe desen. Ștampila rămâne în „Ștampilele mele”, în acest spațiu de lucru.</p>
        {err && <p className="error">{err}</p>}
        {!err && (
          <div className="pdf-stamp-prev" title="Ce se vede prin carouri e transparent">
            {result ? <canvas ref={prevRef} data-testid="pdf-stamp-prev" aria-label="Previzualizarea ștampilei" /> : <span>Se pregătește imaginea…</span>}
          </div>
        )}
        <label className="row">
          <input type="checkbox" checked={removeBg} disabled={!src} onChange={(e) => setRemoveBg(e.target.checked)} data-testid="pdf-stamp-nobg" />
          Scoate fundalul (hârtia)
        </label>
        <label className="row" title="Mai mult: scoate și umbrele sau hârtia mai închisă; mai puțin: păstrează și cerneala foarte deschisă">
          Toleranță
          <input type="range" min={2} max={45} step={1} value={tol} disabled={!src || !removeBg} aria-label="Toleranța fundalului"
            data-testid="pdf-stamp-tol" onChange={(e) => setTol(Number(e.target.value))} />
          <span>{tol}%</span>
        </label>
        <label className="row">Numele:
          <input value={name} maxLength={40} aria-label="Numele ștampilei" onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
        </label>
        <div className="dialog-actions">
          <button onClick={onCancel}>Renunță</button>
          <button className="primary" disabled={!result} onClick={save} data-testid="pdf-stamp-save">Salvează ștampila</button>
        </div>
      </div>
    </div>
  );
}
