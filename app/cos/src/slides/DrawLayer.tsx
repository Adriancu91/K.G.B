// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MARK_COLORS, PEN_COLORS } from './Show';
import { addPoint, eraseAt, inkBox, inkSegs, lassoPick, MARK_WIDTHS, MAX_LINES, moveLines, PEN_WIDTHS, type InkLine } from './ink';
import { recognizeInk, shapeLine } from './inkShape';
import { newRuler, rotateRuler, rulerHit, rulerSize, snapToEdge, type Ruler } from './drawRuler';

// ✏ Desenează: un strat peste slide-ul din editor, cu creionul, markerul și radiera (ca fila Draw).
// Liniile se țin aici până la „✓ Gata”; abia atunci devin o poză pe slide (un singur pas de Anulează).
// Cu ◇ În formă, fiecare linie terminată care seamănă cu o linie dreaptă, un dreptunghi, o elipsă sau un triunghi se îndreaptă
// pe loc (inkShape.ts) și la „✓ Gata” devine o formă adevărată pe slide.

export type DrawTool = 'pen' | 'marker' | 'eraser' | 'lasso';
const NAMES: Record<string, string> = { '#e11d48': 'roșu', '#2563eb': 'albastru', '#16a34a': 'verde', '#111111': 'negru', '#ffffff': 'alb', '#facc15': 'galben', '#4ade80': 'verde deschis', '#38bdf8': 'bleu', '#f472b6': 'roz' };

/** Liniile ca poză PNG transparentă, cât dreptunghiul dat (în coordonatele slide-ului). */
export function inkPng(lines: InkLine[], box: { x: number; y: number; w: number; h: number }): string | null {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(box.w)); c.height = Math.max(1, Math.round(box.h));
  const g = c.getContext('2d');
  if (!g) return null;
  g.translate(-box.x, -box.y);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const l of lines) for (const s of inkSegs(l)) { g.globalAlpha = l.o; g.strokeStyle = l.c; g.lineWidth = s.w; g.stroke(new Path2D(s.d)); }
  return c.toDataURL('image/png');
}

interface Props {
  size: { w: number; h: number };
  /** Liniile cu care începe (când schimbi un desen făcut înainte). */
  start: InkLine[];
  /** lines = liniile la „✓ Gata”; null = „Renunță” (nu se schimbă nimic pe slide). */
  onDone(lines: InkLine[] | null): void;
  /** Aici se țin liniile de acum (dacă treci la alt slide cât desenezi, desenul nu se pierde). */
  out?: { current: InkLine[] };
  /** Unde ajunge desenul (în titlurile butoanelor): implicit slide-ul. */
  onPage?: boolean;
  children: ReactNode;
}

export default function DrawLayer({ size, start, onDone, out, onPage, children }: Props) {
  const [tool, setTool] = useState<DrawTool>('pen');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [markColor, setMarkColor] = useState(MARK_COLORS[0]);
  const [penW, setPenW] = useState(5);
  const [markW, setMarkW] = useState(24);
  const [toShape, setToShape] = useState(false);
  // 🖊 Apăsarea creionului (Pen Pressure): cu creionul unei tablete, apăsarea ușoară face linia subțire, cea tare o face cât grosimea aleasă.
  const [press, setPress] = useState(true);
  const toShapeRef = useRef(toShape);
  toShapeRef.current = toShape;
  const [lines, setLines] = useState<InkLine[]>(start);
  // Pașii de anulare din interiorul desenului (Ctrl+Z / Ctrl+Y), fără să atingă istoria prezentării.
  const past = useRef<InkLine[][]>([]);
  const future = useRef<InkLine[][]>([]);
  const drawing = useRef(false);
  // ⬚ Lasoul: bucla trasă acum, liniile alese (indicii) și locul de unde a pornit mutarea lor.
  const [loop, setLoop] = useState<number[] | null>(null);
  const [pick, setPick] = useState<number[]>([]);
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const moveFrom = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { if (tool !== 'lasso') { setPick([]); setLoop(null); } }, [tool]);
  // 📏 Rigla: unde stă; mutarea ei (punctul de unde a pornit) și marginea de care se lipește linia trasă acum.
  const [ruler, setRuler] = useState<Ruler | null>(null);
  const rulerRef = useRef(ruler);
  rulerRef.current = ruler;
  const rulerFrom = useRef<{ x: number; y: number } | null>(null);
  const edge = useRef<{ side: 1 | -1; x: number; y: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  if (out) out.current = lines;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const remember = () => { past.current.push(linesRef.current); future.current = []; };
  const undo = () => { const p = past.current.pop(); if (p) { future.current.push(linesRef.current); setLines(p); setPick([]); } };
  const redo = () => { const f = future.current.pop(); if (f) { past.current.push(linesRef.current); setLines(f); setPick([]); } };
  const delPicked = () => {
    const set = new Set(pickRef.current);
    if (!set.size) return false;
    remember();
    setLines(linesRef.current.filter((_, k) => !set.has(k)));
    setPick([]);
    return true;
  };

  // Tastele cât desenezi: Esc / Enter termină, Ctrl+Z / Ctrl+Y anulează linia, P / M / E schimbă unealta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable="true"]') && e.key !== 'Escape') return;
      const k = e.key.toLowerCase();
      let used = true;
      if ((e.key === 'Delete' || e.key === 'Backspace') && pickRef.current.length) delPicked();
      else if (e.key === 'Escape' && pickRef.current.length) setPick([]);
      else if (e.key === 'Escape' || e.key === 'Enter') doneRef.current(linesRef.current);
      else if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) undo();
      else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) redo();
      else if (e.ctrlKey || e.metaKey || e.altKey) used = false;
      else if (k === 'p') setTool('pen');
      else if (k === 'm') setTool('marker');
      else if (k === 'e') setTool('eraser');
      else if (k === 'l') setTool('lasso');
      else if (k === 's') setToShape((v) => !v);
      else if (k === 'r') setRuler((r) => (r ? null : newRuler(size.w, size.h)));
      else used = false;
      if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const at = (e: { clientX: number; clientY: number }) => {
    const r = svg.current?.getBoundingClientRect();
    return r && r.width ? { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h } : null;
  };
  const eraseR = () => 10 * (size.w / ((svg.current?.getBoundingClientRect().width) || size.w));
  // Rotița mausului peste riglă o rotește (ascultător fără „passive”, ca pagina să nu se deruleze).
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const r = rulerRef.current, p = at(e);
      if (!r || !p || rulerHit(r, size.w, size.h, p.x, p.y, 0) !== 'body') return;
      e.preventDefault();
      setRuler({ ...r, a: rotateRuler(r.a, e.deltaY > 0 ? 1 : -1, e.shiftKey) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = at(e);
    if (!p) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    // Pe riglă = o muți; lângă marginea ei (cu creionul sau markerul) = linia merge de-a lungul marginii.
    const hit = ruler ? rulerHit(ruler, size.w, size.h, p.x, p.y, eraseR() * 2) : null;
    if (hit === 'body') { rulerFrom.current = p; return; }
    edge.current = null;
    if (ruler && hit && (tool === 'pen' || tool === 'marker')) {
      const q = snapToEdge(ruler, size.w, size.h, hit, p.x, p.y, tool === 'marker' ? markW : penW);
      edge.current = { side: hit, ...q };
      p.x = q.x; p.y = q.y;
    }
    if (tool === 'lasso') {
      // În dreptunghiul liniilor alese = le muți; în altă parte = o buclă nouă.
      const b = pick.length ? inkBox(pick.map((k) => lines[k]), size.w, size.h) : null;
      if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { remember(); moveFrom.current = p; }
      else { setPick([]); setLoop([p.x, p.y]); }
      return;
    }
    remember();
    if (tool === 'eraser') { setLines((l) => eraseAt(l, p.x, p.y, eraseR())); return; }
    if (linesRef.current.length >= MAX_LINES) { drawing.current = false; past.current.pop(); return; }
    const pr = tool === 'pen' && press && e.pointerType === 'pen' && !edge.current ? (e.pressure || 0.5) : undefined;
    const l: InkLine = tool === 'marker' ? { p: [p.x, p.y], c: markColor, w: markW, o: 0.4 } : { p: [p.x, p.y], c: penColor, w: penW, o: 1, ...(pr !== undefined ? { q: [] } : {}) };
    setLines((ls) => [...ls, addPoint({ ...l, p: [] }, p.x, p.y, pr)]);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = at(e);
    if (!p) return;
    const rf = rulerFrom.current;
    if (rf) { rulerFrom.current = p; setRuler((r) => (r ? { ...r, x: Math.round((r.x + p.x - rf.x) * 10) / 10, y: Math.round((r.y + p.y - rf.y) * 10) / 10 } : r)); return; }
    const ed = edge.current;
    if (ed && rulerRef.current) {
      const q = snapToEdge(rulerRef.current, size.w, size.h, ed.side, p.x, p.y, linesRef.current[linesRef.current.length - 1]?.w ?? penW);
      setLines((ls) => { if (!ls.length) return ls; const { q: _q, ...z } = ls[ls.length - 1]; return [...ls.slice(0, -1), { ...z, p: [ed.x, ed.y, q.x, q.y] }]; });
      return;
    }
    if (tool === 'lasso') {
      const f = moveFrom.current;
      if (f) { moveFrom.current = p; setLines((ls) => moveLines(ls, pickRef.current, p.x - f.x, p.y - f.y)); }
      else setLoop((o) => (o ? [...o, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] : o));
      return;
    }
    if (tool === 'eraser') { setLines((l) => eraseAt(l, p.x, p.y, eraseR())); return; }
    const pr = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
    setLines((ls) => { if (!ls.length) return ls; const z = ls[ls.length - 1], n = addPoint(z, p.x, p.y, pr); return n === z ? ls : [...ls.slice(0, -1), n]; });
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (rulerFrom.current) { rulerFrom.current = null; return; }
    const byRuler = !!edge.current;
    edge.current = null;
    if (tool === 'lasso') {
      if (moveFrom.current) {
        moveFrom.current = null;
        // Un clic fără mutare nu lasă un pas gol de anulare.
        if (past.current[past.current.length - 1] === linesRef.current) past.current.pop();
        return;
      }
      const o = loopRef.current;
      setLoop(null);
      if (o) setPick(lassoPick(linesRef.current, o));
      return;
    }
    // ◇ În formă: linia abia terminată, dacă seamănă cu o formă, se înlocuiește cu forma îndreptată.
    if (toShapeRef.current && tool !== 'eraser' && !byRuler) {
      setLines((ls) => {
        const z = ls[ls.length - 1];
        const sh = z && !z.sh ? recognizeInk(z.p) : null;
        if (!sh) return ls;
        const { q: _q, ...plain } = z;
        return [...ls.slice(0, -1), { ...plain, p: shapeLine(sh), sh }];
      });
    }
    // Radiera care n-a atins nimic nu lasă un pas gol de anulare.
    if (past.current[past.current.length - 1] === linesRef.current) past.current.pop();
  };

  const pickSet = new Set(pick);
  const pickBox = pick.length ? inkBox(pick.map((k) => lines[k]).filter(Boolean), size.w, size.h) : null;
  const colors = tool === 'marker' ? MARK_COLORS : PEN_COLORS;
  const color = tool === 'marker' ? markColor : penColor;
  const widths = tool === 'marker' ? MARK_WIDTHS : PEN_WIDTHS;
  const width = tool === 'marker' ? markW : penW;
  const box = inkBox(lines, size.w, size.h);
  return (
    <div className="sl-draw-wrap">
      <div className="sl-draw-bar" role="toolbar" aria-label="Desenează" onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('select')) e.preventDefault(); }}>
        <button className={tool === 'pen' ? 'on' : ''} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} title="Creion (P): linii subțiri, cu mâna liberă">✏ Creion</button>
        <button className={tool === 'marker' ? 'on' : ''} aria-pressed={tool === 'marker'} onClick={() => setTool('marker')} title="Marker (M): linii groase, pe jumătate transparente, pentru evidențiere">🖍 Marker</button>
        <button className={tool === 'eraser' ? 'on' : ''} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')} title="Radieră (E): treci peste o linie și dispare toată">🧽 Radieră</button>
        <button className={tool === 'lasso' ? 'on' : ''} aria-pressed={tool === 'lasso'} onClick={() => setTool('lasso')} title="Lasou (L): încercuiește liniile ca să le alegi, apoi trage de ele ca să le muți; Delete le șterge">⬚ Lasou</button>
        {tool === 'lasso' && <button disabled={!pick.length} onClick={() => delPicked()} title="Șterge liniile alese (Delete)">✕ Alese</button>}
        {tool !== 'eraser' && tool !== 'lasso' && (
          <>
            <span className="sl-draw-colors">
              {colors.map((c) => (
                <button key={c} className={c === color ? 'on' : ''} style={{ background: c }} aria-pressed={c === color} aria-label={'Culoarea ' + NAMES[c]} title={'Culoarea: ' + NAMES[c]}
                  onClick={() => (tool === 'marker' ? setMarkColor(c) : setPenColor(c))} />
              ))}
            </span>
            {tool === 'pen' && (
              <button className={press ? 'on' : ''} aria-pressed={press} data-testid="sl-draw-press" onClick={() => setPress((v) => !v)}
                title="Apăsarea creionului: cu creionul unei tablete, apăsarea ușoară face linia subțire, iar cea tare o face cât grosimea aleasă">🖊 Apăsare</button>
            )}
            <select value={width} aria-label="Grosimea" title="Grosimea liniei" onChange={(e) => (tool === 'marker' ? setMarkW(+e.target.value) : setPenW(+e.target.value))}>
              {widths.map(([w, n]) => <option key={w} value={w}>{n}</option>)}
            </select>
          </>
        )}
        <button className={toShape ? 'on' : ''} aria-pressed={toShape} data-testid="sl-draw-toshape" onClick={() => setToShape((v) => !v)}
          title="În formă (S): liniile trase care seamănă cu o linie dreaptă, un dreptunghi, o elipsă sau un triunghi devin forme adevărate">◇ În formă</button>
        <button className={ruler ? 'on' : ''} aria-pressed={!!ruler} data-testid="sl-draw-ruler" onClick={() => setRuler((r) => (r ? null : newRuler(size.w, size.h)))}
          title="Riglă (R): o riglă peste desen; trage de ea ca s-o muți, rotița mausului o rotește (cu Shift câte 15°); liniile începute lângă marginea ei ies drepte">📏 Riglă</button>
        <span className="sl-sep" />
        <button onClick={undo} title="Anulează ultima linie (Ctrl+Z)">↶</button>
        <button onClick={redo} title="Refă (Ctrl+Y)">↷</button>
        <button disabled={!lines.length} onClick={() => { remember(); setLines([]); }} title="Șterge tot desenul">🗑 Tot</button>
        <span className="sl-sep" />
        <button className="primary" onClick={() => onDone(lines)} title={onPage ? 'Pune desenul ca poză (Esc sau Enter)' : 'Pune desenul pe slide, ca poză (Esc sau Enter)'}>✓ Gata</button>
        <button onClick={() => onDone(null)} title={onPage ? 'Închide fără să pui desenul' : 'Ieși fără să schimbi nimic pe slide'}>Renunță</button>
      </div>
      <div className="sl-draw-area">
        {children}
        <svg ref={svg} className={`sl-draw-ink sl-draw-${tool}`} viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
          {box && <rect className="sl-draw-box" x={box.x} y={box.y} width={box.w} height={box.h} />}
          {lines.map((l, k) => inkSegs(l).map((s, j) => <path key={k + '.' + j} className={pickSet.has(k) ? 'sl-draw-picked' : undefined} d={s.d} style={{ stroke: l.c, strokeWidth: s.w, strokeOpacity: l.o }} />))}
          {pickBox && <rect className="sl-draw-pick" x={pickBox.x} y={pickBox.y} width={pickBox.w} height={pickBox.h} />}
          {loop && loop.length >= 4 && <polyline className="sl-draw-loop" points={loop.join(' ')} />}
          {ruler && (() => {
            const { len, th } = rulerSize(size.w, size.h), n = 40, ticks: string[] = [];
            for (let k = 1; k < n; k++) { const x = -len / 2 + (len * k) / n, t = k % 10 === 0 ? th * 0.45 : k % 5 === 0 ? th * 0.32 : th * 0.2; ticks.push(`M${x} ${-th / 2}v${t}M${x} ${th / 2}v${-t}`); }
            return (
              <g className="sl-draw-ruler" transform={`translate(${ruler.x} ${ruler.y}) rotate(${ruler.a})`}>
                <rect x={-len / 2} y={-th / 2} width={len} height={th} rx={3} />
                <path d={ticks.join('')} />
                <text x={0} y={th * 0.12} textAnchor="middle" fontSize={th * 0.32}>{Math.round(((ruler.a + 180) % 360) - 180)}°</text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
