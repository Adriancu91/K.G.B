// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ▣ Pânza liberă: casete de text puse oriunde pe pagină (dublu clic pe un loc gol face una), mutate trăgând de bara lor,
// lățite trăgând de marginea din dreapta, șterse cu ✕ sau golite. Pozele trase pe pânză sau lipite cu Ctrl+V într-o casetă
// devin casete cu poză (textul e descrierea de sub ea). Shift + clic pe bara casetelor le alege, ⧉ Grupează le leagă
// (se mută apoi împreună), ⛓ de pe bară desparte grupul. În Lectură se arată la locul lor, doar de citit.
// ✎ Creion: se scrie de mână direct pe pânză; după o scurtă pauză liniile devin o casetă cu desen, exact unde au fost scrise
// (se mută, se redeschide cu ✎ și intră în exporturi ca celelalte desene).
import { useEffect, useRef, useState } from 'react';
import { BOX_MAX_W, BOX_MIN_W, CanvasBox, canvasHeight, groupBoxes, inkBoxPlace, makeBox, movingIds, shiftBoxes, soloUngrouped, ungroupBox, WetStroke } from './freeCanvas';
import { drawStroke } from './Draw';
import { packInk } from './ink';
import { fontCss } from './inline';
import { Inline } from './Reader';
import { imageFiles, shrinkImage } from './images';

type Drag = { id: string; kind: 'move' | 'size'; px: number; py: number; x: number; y: number; w: number; ids: string[] };

/** Cât se așteaptă după ultima linie scrisă pe pânză până se face caseta cu desen (o literă nouă scrisă repede intră în aceeași casetă). */
export const INK_SETTLE_MS = 1200;

export default function Canvas({ boxes, font, focusId, onChange, onDraw, pen }: {
  boxes: CanvasBox[]; font?: string; focusId?: string | null; onChange(next: CanvasBox[]): void;
  /** Culoarea, grosimea și unealta stiloului (din fila Desenare), pentru scrisul direct pe pânză. */
  pen?: { color: string; size: number; tool: string };
  /** ✎ pe un desen de pe pânză: îl redeschide cu liniile lui. */
  onDraw?(id: string): void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [live, setLive] = useState<{ id: string; x: number; y: number; w: number; dx: number; dy: number } | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const latest = useRef(boxes);
  latest.current = boxes;
  const [focus, setFocus] = useState<string | null>(focusId ?? null);
  const area = useRef<HTMLDivElement>(null);
  // ✎ Creion: liniile scrise acum („ude”), desenate pe un strat peste pânză până se fac casetă.
  const [inking, setInking] = useState(false);
  const wet = useRef<WetStroke[]>([]);
  const wetCur = useRef<WetStroke | null>(null);
  const wetLayer = useRef<HTMLCanvasElement>(null);
  const settle = useRef(0);
  // Punctul în pixelii pânzei; apăsarea doar de la creionul tabletei (mouse-ul scrie cu grosimea aleasă).
  const at = (e: { clientX: number; clientY: number; pressure: number }, pointerType: string) => {
    const a = area.current!, r = a.getBoundingClientRect();
    return [e.clientX - r.left - a.clientLeft + a.scrollLeft, e.clientY - r.top - a.clientTop + a.scrollTop, pointerType === 'pen' ? e.pressure || 0.5 : 0.5] as [number, number, number];
  };
  const paintWet = () => {
    const c = wetLayer.current, a = area.current;
    if (!c || !a) return;
    const w = a.scrollWidth, h = a.scrollHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    for (const s of [...wet.current, ...(wetCur.current ? [wetCur.current] : [])]) drawStroke(g, s);
  };
  useEffect(() => { if (focusId) setFocus(focusId); }, [focusId]);
  useEffect(() => {
    if (!focus) return;
    const t = area.current?.querySelector<HTMLTextAreaElement>(`[data-box="${focus}"] textarea`);
    if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); setFocus(null); }
  }, [focus, boxes]);

  // Liniile ude devin o casetă cu poza lor (fundal transparent, de două ori mai clară) și cu desenul păstrat, pentru ✎.
  const settleInk = () => {
    clearTimeout(settle.current);
    const list = wet.current;
    wet.current = [];
    paintWet();
    const pl = inkBoxPlace(list);
    if (!pl) return;
    const c = document.createElement('canvas');
    c.width = pl.w * 2; c.height = pl.h * 2;
    const g = c.getContext('2d')!;
    g.scale(2, 2); g.translate(-pl.x0, -pl.y0);
    for (const s of list) drawStroke(g, s);
    const ink = packInk({ paper: 'blank', strokes: pl.sheet, h: pl.sheetH });
    onChange([...latest.current, { ...makeBox(pl.box.x, pl.box.y), w: pl.box.w, img: c.toDataURL('image/png'), ...(ink ? { ink } : {}) }]);
  };
  const inkDown = (e: React.PointerEvent) => {
    if (!inking || e.button !== 0 || e.target !== area.current) return;
    e.preventDefault();
    clearTimeout(settle.current);
    area.current!.setPointerCapture?.(e.pointerId);
    const tool = pen?.tool === 'marker' ? 'marker' : 'pen';
    wetCur.current = { tool, color: pen?.color ?? '#1f2328', size: pen?.size ?? 3, pts: [at(e, e.pointerType)] };
    paintWet();
  };
  const inkMove = (e: React.PointerEvent) => {
    const s = wetCur.current;
    if (!s) return false;
    const ev = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    for (const p of ev.length > 1 ? ev : [e]) s.pts.push(at(p, e.pointerType));
    paintWet();
    return true;
  };
  const inkUp = () => {
    const s = wetCur.current;
    if (!s) return false;
    wetCur.current = null;
    wet.current.push(s);
    paintWet();
    clearTimeout(settle.current);
    settle.current = window.setTimeout(settleInk, INK_SETTLE_MS);
    return true;
  };
  // Oprirea creionului (sau ieșirea din notiță) face pe loc caseta din liniile rămase.
  const settleRef = useRef(settleInk);
  settleRef.current = settleInk;
  useEffect(() => { if (!inking && wet.current.length) settleRef.current(); }, [inking]);
  useEffect(() => () => { clearTimeout(settle.current); if (wet.current.length) settleRef.current(); }, []);

  const update = (id: string, patch: Partial<CanvasBox>) => onChange(boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const remove = (id: string) => onChange(soloUngrouped(boxes.filter((b) => b.id !== id)));
  const toggle = (id: string) => setChosen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const group = () => { onChange(groupBoxes(boxes, chosen)); setChosen(new Set()); };
  const pickedIds = [...chosen].filter((id) => boxes.some((b) => b.id === id));

  const start = (e: React.PointerEvent, b: CanvasBox, kind: Drag['kind']) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    if (kind === 'move' && (e.shiftKey || e.ctrlKey)) { toggle(b.id); return; }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const ids = kind === 'move' ? movingIds(boxes, b.id, chosen) : [b.id];
    setDrag({ id: b.id, kind, px: e.clientX, py: e.clientY, x: b.x, y: b.y, w: b.w, ids });
    setLive({ id: b.id, x: b.x, y: b.y, w: b.w, dx: 0, dy: 0 });
  };
  const move = (e: React.PointerEvent) => {
    if (inkMove(e)) return;
    if (!drag) return;
    const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
    const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)));
    if (drag.kind === 'move') {
      // Grupul se mută tot, cât încape în pânză (aceleași limite ca la mutarea finală).
      const s = shiftBoxes(boxes, drag.ids, dx, dy).find((b) => b.id === drag.id)!;
      setLive({ id: drag.id, x: s.x, y: s.y, w: drag.w, dx: s.x - drag.x, dy: s.y - drag.y });
    } else setLive({ id: drag.id, x: drag.x, y: drag.y, w: clamp(drag.w + dx, BOX_MIN_W, BOX_MAX_W), dx: 0, dy: 0 });
  };
  const end = () => {
    if (inkUp()) return;
    if (drag && live) {
      if (drag.kind === 'move') { if (live.dx || live.dy) onChange(shiftBoxes(boxes, drag.ids, live.dx, live.dy)); }
      else update(drag.id, { w: live.w });
    }
    setDrag(null); setLive(null);
  };

  const addAt = (e: React.MouseEvent) => {
    if (e.target !== area.current || inking) return;
    setChosen(new Set());
    const r = area.current.getBoundingClientRect();
    const b = makeBox(e.clientX - r.left - 8, e.clientY - r.top - 12);
    onChange([...boxes, b]);
    setFocus(b.id);
  };

  // Pozele puse pe pânză: fiecare într-o casetă a ei, una sub alta de la locul dat, lată de cel mult 320 px.
  const addPics = async (files: File[], x: number, y: number) => {
    const made: CanvasBox[] = [];
    for (const f of files.slice(0, 10)) {
      try {
        const img = await shrinkImage(f);
        const bmp = await createImageBitmap(f);
        const w = Math.max(BOX_MIN_W, Math.min(320, bmp.width)); const h = Math.round(w * bmp.height / Math.max(1, bmp.width)); bmp.close();
        made.push({ ...makeBox(x, y), w, img });
        y += h + 60;
      } catch { /* poză care nu se poate citi: rămâne pe dinafară */ }
    }
    if (made.length) onChange([...latest.current, ...made]);
  };
  const onDrop = (e: React.DragEvent) => {
    const f = imageFiles(e.dataTransfer?.files);
    if (!f.length || !area.current) return;
    e.preventDefault(); e.stopPropagation();
    const r = area.current.getBoundingClientRect();
    void addPics(f, e.clientX - r.left - 8, e.clientY - r.top - 12);
  };
  const onPaste = (e: React.ClipboardEvent, b: CanvasBox) => {
    const f = imageFiles(e.clipboardData?.files);
    if (!f.length) return;
    e.preventDefault();
    void addPics(f, b.x + 24, b.y + 48 + (b.img ? b.w : 0) + b.text.split('\n').length * 20);
  };

  return (
    <div ref={area} className={`note-canvas${inking ? ' inking' : ''}`} role="region" aria-label="Pânză liberă"
      title="Pânză liberă: dublu clic pe un loc gol pune o casetă de text; o muți trăgând de bara ei (sau cu Alt + săgeți), o lățești trăgând de marginea din dreapta"
      style={{ height: canvasHeight(boxes), fontFamily: fontCss(font) }}
      onDoubleClick={addAt} onPointerDown={inkDown} onMouseDown={(e) => { if (inking && e.target === area.current) e.preventDefault(); }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      onDragOver={(e) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); } }} onDrop={onDrop}>
      <canvas ref={wetLayer} className="note-canvas-wet" aria-hidden />
      <div className="note-canvas-tools" role="toolbar" aria-label="Pânza liberă">
        <button className={inking ? 'on' : ''} aria-pressed={inking} onClick={() => setInking((v) => !v)}
          title="Creion: scrie sau desenează de mână direct pe pânză (cu mouse-ul sau cu creionul tabletei); după o scurtă pauză scrisul devine o casetă pe care o muți oriunde. Culoarea și grosimea se aleg din fila Desenare.">✎ Creion</button>
      </div>
      {pickedIds.length > 0 && (
        <div className="note-canvas-pick" role="toolbar" aria-label="Casetele alese">
          <span>{pickedIds.length} alese</span>
          <button onClick={group} disabled={movingIds(boxes, pickedIds[0], chosen).length < 2}
            title="Leagă casetele alese: se mută apoi împreună">⧉ Grupează</button>
          <button onClick={() => setChosen(new Set())} title="Nu mai alege nicio casetă">✕</button>
        </div>
      )}
      {!boxes.length && !inking && <p className="note-canvas-hint">Dublu clic oriunde aici pune o casetă de text; pozele trase aici rămân unde le lași.</p>}
      {boxes.map((b) => {
        const moving = !!live && !!drag?.ids.includes(b.id);
        const p = live?.id === b.id ? live : moving ? { x: b.x + live!.dx, y: b.y + live!.dy, w: b.w } : b;
        return (
          <div key={b.id} data-box={b.id} className={`note-box${moving ? ' dragging' : ''}${chosen.has(b.id) ? ' chosen' : ''}${b.group ? ' grouped' : ''}`} style={{ left: p.x, top: p.y, width: p.w }}>
            <div className="note-box-bar" onPointerDown={(e) => start(e, b, 'move')} title="Trage ca să muți caseta (Shift + clic o alege, pentru grup)">
              <span aria-hidden>⠿</span>
              {b.group && <button className="note-box-ungroup" onPointerDown={(e) => e.stopPropagation()} onClick={() => onChange(ungroupBox(boxes, b.id))}
                title="Desparte grupul (casetele se mută din nou fiecare singură)" aria-label="Desparte grupul">⛓</button>}
              {b.ink && onDraw && <button className="note-box-draw" onPointerDown={(e) => e.stopPropagation()} onClick={() => onDraw(b.id)}
                title="Editează desenul (liniile se pot muta, șterge sau completa)" aria-label="Editează desenul">✎</button>}
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(b.id)} title="Șterge caseta" aria-label="Șterge caseta">✕</button>
            </div>
            {b.img && <img src={b.img} alt={b.text.trim() || 'Poză pe pânză'} draggable={false} />}
            <textarea value={b.text} rows={Math.max(b.img ? 1 : 2, b.text.split('\n').length)} aria-label="Textul casetei" placeholder={b.img ? 'Descriere…' : 'Scrie aici…'}
              onChange={(e) => update(b.id, { text: e.target.value })}
              onPaste={(e) => onPaste(e, b)}
              onBlur={(e) => { if (!e.target.value.trim() && !b.img) remove(b.id); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); return; }
                // Alt + săgeți: mută caseta cu 10 px (Alt+Shift: 1 px), fără mouse.
                const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
                if (d && e.altKey && !e.ctrlKey) {
                  e.preventDefault(); e.stopPropagation();
                  const s = e.shiftKey ? 1 : 10;
                  onChange(shiftBoxes(boxes, movingIds(boxes, b.id, chosen), d[0] * s, d[1] * s));
                }
              }} />
            <div className="note-box-size" onPointerDown={(e) => start(e, b, 'size')} title="Trage ca să schimbi lățimea" aria-hidden />
          </div>
        );
      })}
    </div>
  );
}

/** Pânza doar de citit (Lectură): casetele la locul lor, cu formatarea textului. */
export function CanvasView({ boxes }: { boxes: CanvasBox[] }) {
  return (
    <div className="note-canvas readonly" role="region" aria-label="Pânză liberă" style={{ height: canvasHeight(boxes) }}>
      {boxes.map((b) => (
        <div key={b.id} className="note-box" style={{ left: b.x, top: b.y, width: b.w }}>
          {b.img && <img src={b.img} alt={b.text.trim() || 'Poză pe pânză'} />}
          {b.text.split('\n').map((l, i) => <p key={i}><Inline text={l} /></p>)}
        </div>
      ))}
    </div>
  );
}
