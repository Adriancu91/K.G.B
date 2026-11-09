// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 📸 Captură de ecran (Docs, Slides, Notițe): alegi o fereastră deschisă (poza ei întreagă) sau ✂ decupezi o bucată din ecran.
// `captureScreen()` întoarce poza (PNG) sau null dacă ai renunțat; `<ScreenshotHost />` stă o singură dată în App, ca la ask.tsx.
import { useEffect, useRef, useState } from 'react';
import { api, type ScreenSource } from './api';
import { dragRect, fitSize, toImageRect, type Rect } from './screenClip';

interface Request { done: (b: Blob | null) => void }
let show: ((r: Request | null) => void) | null = null;

export function captureScreen(): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!show) { resolve(null); return; }
    show({ done: resolve });
  });
}

const png = (data: Uint8Array) => new Blob([data as BlobPart], { type: 'image/png' });

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}

async function crop(img: HTMLImageElement, r: Rect): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = r.w; c.height = r.h;
  c.getContext('2d')!.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

export function ScreenshotHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [list, setList] = useState<ScreenSource[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Decuparea: poza ecranului, mărimea la care se arată și dreptunghiul tras.
  const [clip, setClip] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const [drag, setDrag] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);
  const imgBox = useRef<HTMLImageElement>(null);
  useEffect(() => { show = setReq; return () => { show = null; }; }, []);

  useEffect(() => {
    if (!req) return;
    setList(null); setErr(''); setClip(null); setDrag(null);
    if (!api.screenSources) { setErr('Captura de ecran merge doar în aplicația Cyber Office Studio, nu în browser.'); setList([]); return; }
    api.screenSources().then(setList, () => { setErr('Ferestrele nu au putut fi citite.'); setList([]); });
  }, [req]);

  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  if (!req) return null;
  const finish = (b: Blob | null) => { setReq(null); setClip(null); setDrag(null); req.done(b); };

  const pick = async (s: ScreenSource) => {
    if (!api.screenGrab || busy) return;
    setBusy(true);
    try { finish(png(await api.screenGrab(s.id))); } catch (e) { setErr(e instanceof Error ? e.message : 'Captura nu a mers.'); } finally { setBusy(false); }
  };
  const startClip = async () => {
    if (!api.screenClip || busy) return;
    setBusy(true);
    try {
      const url = URL.createObjectURL(png(await api.screenClip()));
      setClip({ url, img: await loadImage(url) });
    } catch (e) { setErr(e instanceof Error ? e.message : 'Ecranul nu a putut fi fotografiat.'); } finally { setBusy(false); }
  };

  if (clip) {
    const box = fitSize(clip.img.naturalWidth, clip.img.naturalHeight, window.innerWidth, window.innerHeight);
    const at = (e: React.MouseEvent) => {
      const r = imgBox.current!.getBoundingClientRect();
      return { x: Math.max(0, Math.min(r.width, e.clientX - r.left)), y: Math.max(0, Math.min(r.height, e.clientY - r.top)) };
    };
    const sel = drag && dragRect(drag.a, drag.b);
    const done = async (r: Rect | null) => {
      const ir = r ? toImageRect(r, box.w, box.h, clip.img.naturalWidth, clip.img.naturalHeight) : { x: 0, y: 0, w: clip.img.naturalWidth, h: clip.img.naturalHeight };
      if (!ir) { setDrag(null); return; }
      finish(await crop(clip.img, ir));
    };
    return (
      <div className="shot-clip" tabIndex={-1} ref={(el) => el?.focus()} role="dialog" aria-label="Decupează din ecran"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); }
          if (e.key === 'Enter') { e.preventDefault(); void done(null); }
        }}>
        <div className="shot-stage" style={{ width: box.w, height: box.h }}
          onMouseDown={(e) => { e.preventDefault(); const p = at(e); setDrag({ a: p, b: p }); }}
          onMouseMove={(e) => { if (drag && e.buttons) setDrag({ a: drag.a, b: at(e) }); }}
          onMouseUp={() => { if (sel) void done(sel); }}>
          <img ref={imgBox} src={clip.url} alt="" draggable={false} style={{ width: box.w, height: box.h }} />
          {sel ? <div className="shot-sel" style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }} /> : <div className="shot-dim" />}
        </div>
        <div className="shot-hint">Trage un dreptunghi peste ce vrei să păstrezi · Enter: tot ecranul · Esc: renunță</div>
      </div>
    );
  }

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) finish(null); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); } }}>
      <div className="print-dlg shot-dlg" role="dialog" aria-modal="true" aria-label="Captură de ecran">
        <h3>📸 Captură de ecran</h3>
        <p className="shot-help">Alege o fereastră deschisă (se pune poza ei întreagă) sau decupează doar o bucată din ecran.</p>
        <button className="primary shot-clip-btn" disabled={busy || !api.screenClip} onClick={() => void startClip()}
          title="Fereastra Cyber Office Studio se ascunde o clipă, apoi tragi un dreptunghi peste ce vrei să păstrezi">✂ Decupează din ecran</button>
        {err && <p className="shot-err">{err}</p>}
        {list === null ? <p className="shot-help">Se caută ferestrele deschise…</p> : (
          <div className="shot-grid">
            {list.map((s) => (
              <button key={s.id} className="shot-src" disabled={busy} onClick={() => void pick(s)} title={s.name}>
                <img src={s.thumb} alt="" />
                <span>{s.screen ? '🖥 ' : ''}{s.name}</span>
              </button>
            ))}
            {!list.length && !err && <p className="shot-help">Nu e deschisă nicio altă fereastră.</p>}
          </div>
        )}
        <div className="print-actions"><button ref={(b) => b?.focus()} onClick={() => finish(null)}>Renunță</button></div>
      </div>
    </div>
  );
}
