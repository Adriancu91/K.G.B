// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Elimină fundalul” cu marcarea zonelor (Mark Areas to Keep / Remove), folosită în Docs și în Slides: pornim de la fundalul
// găsit singur (noBackground.ts), arătat cu mov peste poză, iar utilizatorul trage cu pensula ＋ peste ce vrea să rămână
// și cu − peste ce vrea să dispară. Calculul e pe copia de lucru (cel mult 1600 px); la sfârșit masca se pune pe poza mare.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { workCopy } from './background';
import { autoBackground, cutWithMask, loadImg, markedBackground, markRadius, nobgProblem, NOBG_LEVELS, nobgTol, type NobgMark } from './noBackground';

export default function NoBgMarkDialog({ src, onDone, onClose }: { src: string; onDone(url: string): void; onClose(): void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [err, setErr] = useState('');
  const [level, setLevel] = useState('normal');
  const [keep, setKeep] = useState(true);
  const [marks, setMarks] = useState<NobgMark[]>([]);
  const cv = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<NobgMark | null>(null);

  useEffect(() => { loadImg(src).then(setImg, (e: Error) => setErr(e.message)); }, [src]);
  const work = useMemo(() => {
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    const wk = workCopy(c).data;
    c.width = 0;
    return wk;
  }, [img]);
  // Fundalul găsit singur; când nu e unul clar, pornim de la nimic și utilizatorul îl marchează cu −.
  const auto = useMemo(() => {
    if (!work) return null;
    const a = autoBackground(work, nobgTol(level) ?? 18);
    const why = nobgProblem(a.share, a.edge);
    return { mask: why ? new Uint8Array(work.width * work.height) : a.mask, why };
  }, [work, level]);
  const mask = useMemo(() => (work && auto ? markedBackground(work, auto.mask, marks, nobgTol(level) ?? 18) : null), [work, auto, marks, level]);

  const redraw = () => {
    const c = cv.current;
    if (!c || !work || !mask) return;
    c.width = work.width; c.height = work.height;
    const ctx = c.getContext('2d')!;
    const shown = new ImageData(new Uint8ClampedArray(work.data), work.width, work.height);
    const d = shown.data;
    // Ce se elimină: acoperit cu mov (ca la programele cunoscute), ca să se vadă clar ce rămâne.
    for (let i = 0; i < mask.length; i++) if (mask[i]) { d[i * 4] = Math.round(d[i * 4] * 0.35 + 200 * 0.65); d[i * 4 + 1] = Math.round(d[i * 4 + 1] * 0.35); d[i * 4 + 2] = Math.round(d[i * 4 + 2] * 0.35 + 170 * 0.65); d[i * 4 + 3] = 255; }
    ctx.putImageData(shown, 0, 0);
    for (const m of marks) strokeOf(ctx, m);
  };
  const strokeOf = (ctx: CanvasRenderingContext2D, m: NobgMark) => {
    if (!work) return;
    ctx.save();
    ctx.strokeStyle = m.keep ? '#16a34a' : '#dc2626';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Math.max(2, markRadius(work.width, work.height) * 0.6);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    m.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (m.pts.length === 1) ctx.arc(m.pts[0].x, m.pts[0].y, ctx.lineWidth, 0, Math.PI * 2);
    m.pts.length === 1 ? ctx.fill() : ctx.stroke();
    ctx.restore();
  };
  useEffect(redraw, [mask, marks]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * work!.width, y: ((e.clientY - r.top) / r.height) * work!.height };
  };
  const down = (e: React.PointerEvent) => {
    if (!work || e.button !== 0) return;
    e.preventDefault();
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* indicator fără captură */ }
    drawing.current = { keep: e.shiftKey ? !keep : keep, pts: [at(e)] };
  };
  const move = (e: React.PointerEvent) => {
    const m = drawing.current;
    if (!m || !work) return;
    const p = at(e), last = m.pts[m.pts.length - 1];
    const step = markRadius(work.width, work.height) / 2, dist = Math.hypot(p.x - last.x, p.y - last.y);
    if (dist < step) return;
    // Mișcările repezi lasă goluri: punem puncte și între ele.
    for (let k = 1; k <= Math.floor(dist / step); k++) m.pts.push({ x: last.x + ((p.x - last.x) * k * step) / dist, y: last.y + ((p.y - last.y) * k * step) / dist });
    const ctx = cv.current?.getContext('2d');
    if (ctx) strokeOf(ctx, m);
  };
  const up = () => {
    const m = drawing.current;
    drawing.current = null;
    if (m) setMarks((ms) => [...ms, m]);
  };
  const apply = () => {
    if (!img || !work || !mask) return;
    try { onDone(cutWithMask(img, mask, work.width, work.height)); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  return createPortal(
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg nobg-mark-dlg" role="dialog" aria-label="Elimină fundalul: marchează zonele" style={{ maxWidth: 'min(720px, 96vw)' }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setMarks((ms) => ms.slice(0, -1)); } }}>
        <h3>Elimină fundalul: marchează zonele</h3>
        <p className="print-info">Ce e acoperit cu mov dispare. Trage cu ＋ peste ce vrei să rămână și cu − peste ce vrei să dispară (Shift schimbă pensula pe loc).</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '6px 0' }}>
          <button className={keep ? 'on' : ''} aria-pressed={keep} data-nobg="keep" onClick={() => setKeep(true)} title="Pensula verde: zona peste care tragi rămâne în poză">＋ Marchează ce păstrezi</button>
          <button className={!keep ? 'on' : ''} aria-pressed={!keep} data-nobg="remove" onClick={() => setKeep(false)} title="Pensula roșie: zona peste care tragi și culoarea ei legată de ea dispar">− Marchează ce elimini</button>
          <select aria-label="Cât de apropiate sunt culorile fundalului" value={level} onChange={(e) => setLevel(e.target.value)}>
            {NOBG_LEVELS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <button data-nobg="undo" disabled={!marks.length} onClick={() => setMarks((ms) => ms.slice(0, -1))} title="Scoate ultimul semn (Ctrl+Z)">↶ Ultimul semn</button>
          <button data-nobg="clear" disabled={!marks.length} onClick={() => setMarks([])}>Șterge semnele</button>
        </div>
        {auto?.why && !marks.length && <p className="print-info" data-nobg="hint">Nu am găsit singur fundalul. Marchează-l tu cu −.</p>}
        {err && <p className="print-error">{err}</p>}
        <div style={{ display: 'flex', justifyContent: 'center', background: 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 16px 16px' }}>
          {work ? (
            <canvas ref={cv} data-nobg="canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              style={{ maxWidth: '100%', maxHeight: '58vh', cursor: 'crosshair', touchAction: 'none', display: 'block' }} />
          ) : <p className="print-info">{err ? '' : 'Se încarcă poza…'}</p>}
        </div>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" data-nobg="apply" disabled={!mask} onClick={apply}>Păstrează modificările</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
