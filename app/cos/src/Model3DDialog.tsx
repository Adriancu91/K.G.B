// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inserare → 🧊 Model 3D: alegi un .obj, .stl, .glb / .gltf sau .ply, îl rotești cu mouse-ul (sau cu glisoarele), alegi culoarea și îl pui
// ca poză transparentă, tăiată cât modelul. Desenul e în model3d.ts.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { drawModel, readModel, type Mesh, type View3D } from './model3d';

/** Fișierul modelului și cum a fost rotit, ținute lângă poză ca modelul să poată fi rotit din nou (🧊 Rotește modelul). */
export interface Model3DSource { name: string; data: Uint8Array; view: View3D }

const VIEWS: [string, number, number][] = [['Față', 0, 0], ['Din lateral', 90, 0], ['De sus', 0, 89], ['În perspectivă', -35, 25]];

/** Poza finală: modelul desenat mare, tăiat cât pixelii lui (fără marginea goală). */
async function modelPng(mesh: Mesh, view: View3D): Promise<Blob> {
  const S = 1000;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  drawModel(g, mesh, view, S, S);
  const d = g.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const out = document.createElement('canvas');
  if (x1 < 0) { out.width = out.height = 1; }
  else {
    out.width = x1 - x0 + 3; out.height = y1 - y0 + 3;
    out.getContext('2d')!.drawImage(c, x0 - 1, y0 - 1, out.width, out.height, 0, 0, out.width, out.height);
  }
  c.width = 0;
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Poza modelului nu a putut fi făcută.'))), 'image/png'));
}

export default function Model3DDialog({ color: color0 = '#4a90d9', initial, onInsert, onClose }: { color?: string; initial?: Model3DSource; onInsert(blob: Blob, name: string, src: Model3DSource): void; onClose(): void }) {
  const [err, setErr] = useState('');
  const [mesh, setMesh] = useState<{ m: Mesh; name: string; data: Uint8Array } | null>(() => {
    if (!initial) return null;
    try { return { m: readModel(initial.name, initial.data), name: initial.name, data: initial.data }; } catch { return null; }
  });
  const [view, setView] = useState<View3D>(initial?.view ?? { yaw: -35, pitch: 25, color: color0 });
  const [busy, setBusy] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  useEffect(() => {
    const c = cv.current;
    if (c && mesh) drawModel(c.getContext('2d')!, mesh.m, view, c.width, c.height);
  }, [mesh, view]);
  const pick = async () => {
    setErr('');
    const f = await api.importFile('model3d');
    if (!f) return;
    try {
      const name = f.path.split(/[\\/]/).pop() ?? 'model';
      setMesh({ m: readModel(name, f.data), name, data: f.data });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const insert = async () => {
    if (!mesh || busy) return;
    setBusy(true);
    try { onInsert(await modelPng(mesh.m, view), mesh.name, { name: mesh.name, data: mesh.data, view }); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const wrap = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;
  return createPortal(
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Model 3D" data-testid="model3d-dlg" style={{ width: 'min(520px, 96vw)' }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Model 3D</h3>
        <p className="print-info">Alege un model 3D (.obj, .stl, .glb / .gltf sau .ply, de exemplu o piesă proiectată, un obiect pentru imprimanta 3D sau o scanare), rotește-l cu mouse-ul și pune-l ca poză.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button autoFocus={!mesh} onClick={() => void pick()} data-testid="model3d-pick">📂 Alege fișierul…</button>
          {mesh && <span className="muted" data-testid="model3d-name">{mesh.name} · {mesh.m.count.toLocaleString('ro-RO')} fețe</span>}
        </div>
        {err && <p className="print-info" style={{ color: '#b91c1c' }} data-testid="model3d-err">{err}</p>}
        {mesh && <>
          <canvas ref={cv} width={480} height={320} data-testid="model3d-canvas" title="Trage cu mouse-ul ca să rotești modelul"
            style={{ display: 'block', margin: '8px auto', width: '100%', maxWidth: 480, aspectRatio: '3 / 2', cursor: 'grab', border: '1px solid var(--border)', borderRadius: 6,
              background: 'repeating-conic-gradient(#0000000a 0 25%, transparent 0 50%) 0 0 / 16px 16px' }}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; }}
            onPointerMove={(e) => { const d = drag.current; if (d) setView({ ...view, yaw: wrap(Math.round(d.yaw + (e.clientX - d.x) * 0.6)), pitch: Math.max(-89, Math.min(89, Math.round(d.pitch + (e.clientY - d.y) * 0.6))) }); }}
            onPointerUp={() => { drag.current = null; }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {VIEWS.map(([label, yaw, pitch]) => <button key={label} onClick={() => setView({ ...view, yaw, pitch })}>{label}</button>)}
          </div>
          <label className="print-row"><span className="print-label">Rotire</span>
            <input type="range" min={-180} max={180} value={view.yaw} aria-label="Rotire orizontală" onChange={(e) => setView({ ...view, yaw: +e.target.value })} /> {view.yaw}°</label>
          <label className="print-row"><span className="print-label">Înclinare</span>
            <input type="range" min={-89} max={89} value={view.pitch} aria-label="Înclinare" onChange={(e) => setView({ ...view, pitch: +e.target.value })} /> {view.pitch}°</label>
          <label className="print-row"><span className="print-label">Culoare</span>
            <input type="color" value={view.color} aria-label="Culoarea modelului" onChange={(e) => setView({ ...view, color: e.target.value })} /></label>
          <label className="print-row"><input type="checkbox" checked={!!view.zUp} onChange={(e) => setView({ ...view, zUp: e.target.checked })} /> Modelul e culcat (sus pe axa Z, ca la piesele proiectate)</label>
        </>}
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" data-testid="model3d-ok" disabled={!mesh || busy} onClick={() => void insert()}>{initial ? 'Gata' : 'Inserează'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
