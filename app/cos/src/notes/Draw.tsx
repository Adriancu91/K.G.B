// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Desen de mână în notițe: o foaie (albă, cu linii sau cu pătrățele) pe care scrii sau desenezi cu mouse-ul, creionul (cu apăsare) sau degetul.
// Unelte: creion, marker transparent, linie, dreptunghi, cerc și radieră. La „Pune în notiță” desenul devine o poză a notiței.
// Desenul poate porni și peste o poză din notiță (✎ pe poză): poza ține locul foii, iar rezultatul o înlocuiește.
// Fără biblioteci: Canvas 2D. Liniile stau pe un strat separat (ink), ca radiera să nu șteargă liniile foii sau poza.
import { useEffect, useRef, useState } from 'react';
import { isCurrent } from '../active';
import { askYes } from '../ask';
import { recognize } from './inkShape';
import { partialStrokes, strokePoints } from './inkReplay';
import type { Ink } from './ink';

const W = 1200;
const H0 = 800;
export const COLORS: [string, string][] = [['#1f2328', 'Negru'], ['#1d4ed8', 'Albastru'], ['#dc2626', 'Roșu'], ['#16a34a', 'Verde'], ['#f59e0b', 'Galben']];
export const SIZES: [number, string][] = [[3, 'Subțire'], [6, 'Mediu'], [14, 'Gros']];
export type Tool = 'pen' | 'marker' | 'line' | 'rect' | 'ellipse' | 'erase' | 'lasso';
export const TOOLS: [Tool, string, string][] = [
  ['pen', '✎ Creion', 'Creion: scris și desen liber'],
  ['marker', '🖍 Marker', 'Marker transparent: evidențiază peste scris'],
  ['line', '╱ Linie', 'Linie dreaptă: trage de la un capăt la altul'],
  ['rect', '▭ Dreptunghi', 'Dreptunghi: trage dintr-un colț în celălalt'],
  ['ellipse', '◯ Cerc', 'Cerc sau elipsă: trage dintr-un colț în celălalt (cu Shift: cerc rotund)'],
  ['erase', 'Radieră', 'Radieră: șterge unde treci'],
  ['lasso', '➰ Lasou', 'Lasou: încercuiește liniile, apoi trage-le în alt loc; Delete le șterge, Esc renunță la alegere'],
];
export type Paper = 'blank' | 'lines' | 'grid';
export const PAPERS: [Paper, string][] = [['blank', 'Foaie albă'], ['lines', 'Foaie cu linii'], ['grid', 'Foaie cu pătrățele']];
const SHAPES: Tool[] = ['line', 'rect', 'ellipse'];

export interface Stroke { tool: Tool; color: string; size: number; pts: [number, number, number][]; round?: boolean }
/** Rigla: cu ea pornită, creionul și markerul trag linii drepte paralele cu ea, din punctul unde ai început (unghiul în grade). */
export function alongRuler(start: [number, number, number], p: [number, number, number], deg: number): [number, number, number] {
  const a = (deg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  const d = (p[0] - start[0]) * ux + (p[1] - start[1]) * uy;
  return [start[0] + d * ux, start[1] + d * uy, p[2]];
}
/** Raportorul: cu el pornit, creionul și markerul trag arce de cerc în jurul mijlocului lui (cx, cy), la distanța punctului de început. */
export function alongArc(cx: number, cy: number, start: [number, number, number], p: [number, number, number]): [number, number, number] {
  const r = Math.hypot(start[0] - cx, start[1] - cy);
  const a = Math.atan2(p[1] - cy, p[0] - cx);
  return r < 1 ? start : [cx + r * Math.cos(a), cy + r * Math.sin(a), p[2]];
}
/** Desenează raportorul (doar pe ecran): un semicerc în mijlocul foii, cu gradații din 10 în 10° și numere din 30 în 30°. */
function drawProtractor(g: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3;
  g.save();
  g.fillStyle = 'rgba(100, 116, 139, 0.15)';
  g.strokeStyle = 'rgba(71, 85, 105, 0.7)';
  g.lineWidth = 1;
  g.beginPath(); g.arc(cx, cy, R, Math.PI, 2 * Math.PI); g.closePath(); g.fill(); g.stroke();
  g.beginPath();
  for (let d = 0; d <= 180; d += 10) {
    const a = Math.PI + (d * Math.PI) / 180, k = d % 30 === 0 ? 18 : 9;
    g.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); g.lineTo(cx + (R - k) * Math.cos(a), cy + (R - k) * Math.sin(a));
  }
  g.moveTo(cx - 6, cy); g.lineTo(cx + 6, cy); g.moveTo(cx, cy - 6); g.lineTo(cx, cy + 6);
  g.stroke();
  g.fillStyle = 'rgba(30, 41, 59, 0.85)';
  g.font = '12px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let d = 0; d <= 180; d += 30) { const a = Math.PI + (d * Math.PI) / 180; g.fillText(`${180 - d}°`, cx + (R - 32) * Math.cos(a), cy + (R - 32) * Math.sin(a)); }
  g.restore();
}
/** Desenează rigla (doar pe ecran, nu și în desenul pus în notiță): o bandă prin mijlocul foii, cu gradații din 10 în 10 px. */
function drawRuler(g: CanvasRenderingContext2D, w: number, h: number, deg: number) {
  const len = Math.hypot(w, h);
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate((deg * Math.PI) / 180);
  g.fillStyle = 'rgba(100, 116, 139, 0.18)';
  g.strokeStyle = 'rgba(71, 85, 105, 0.7)';
  g.lineWidth = 1;
  g.fillRect(-len / 2, -28, len, 56);
  g.strokeRect(-len / 2, -28, len, 56);
  g.beginPath();
  for (let x = -Math.floor(len / 20) * 10; x <= len / 2; x += 10) { const big = Math.round(x) % 50 === 0; g.moveTo(x, -28); g.lineTo(x, -28 + (big ? 14 : 7)); }
  g.stroke();
  g.fillStyle = 'rgba(30, 41, 59, 0.85)';
  g.font = '13px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillText(`${Math.round(((deg % 360) + 360) % 360)}°`, 0, 16);
  g.restore();
}

/** Punctul e în poligonul lasoului (regula razei: câte laturi taie o linie orizontală spre dreapta). */
export function inPoly(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Liniile prinse de lasou: cel puțin 60% din punctele lor sunt în interior (radiera nu se alege). */
export function lassoPick(strokes: Stroke[], poly: [number, number][]): number[] {
  if (poly.length < 3) return [];
  const out: number[] = [];
  strokes.forEach((st, i) => {
    if (st.tool === 'erase' || !st.pts.length) return;
    const n = st.pts.filter(([x, y]) => inPoly(x, y, poly)).length;
    if (n / st.pts.length >= 0.6) out.push(i);
  });
  return out;
}

/** Dreptunghiul care cuprinde liniile alese (cu grosimea lor). */
function selBox(strokes: Stroke[], sel: number[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of sel) {
    const st = strokes[i];
    if (!st) continue;
    const pad = st.tool === 'marker' ? st.size * 2 + 6 : st.size;
    for (const [x, y] of st.pts) { x0 = Math.min(x0, x - pad); y0 = Math.min(y0, y - pad); x1 = Math.max(x1, x + pad); y1 = Math.max(y1, y + pad); }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

function drawPaper(g: CanvasRenderingContext2D, paper: Paper, H: number, bg: HTMLImageElement | null) {
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  if (bg) { g.drawImage(bg, 0, 0, W, H); return; }
  if (paper === 'blank') return;
  const step = paper === 'lines' ? 40 : 32;
  g.strokeStyle = paper === 'lines' ? '#c7d7ef' : '#dde3ea';
  g.lineWidth = 1;
  g.beginPath();
  for (let y = step; y < H; y += step) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
  if (paper === 'grid') for (let x = step; x < W; x += step) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
  g.stroke();
  if (paper === 'lines') {
    // Marginea roșie din stânga, ca la caiet.
    g.strokeStyle = '#f2a7a7';
    g.beginPath(); g.moveTo(80.5, 0); g.lineTo(80.5, H); g.stroke();
  }
}

/** Dreptunghiul formei (cu Shift, cercul rotund are latura cea mai mică). */
function box(s: Stroke) {
  const [x0, y0] = s.pts[0];
  const [x1, y1] = s.pts[s.pts.length - 1];
  let w = x1 - x0;
  let h = y1 - y0;
  if (s.round) { const m = Math.min(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
  return { x0, y0, w, h };
}

export function drawStroke(g: CanvasRenderingContext2D, s: Stroke) {
  g.save();
  g.strokeStyle = s.color;
  g.fillStyle = s.color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (s.tool === 'erase') { g.globalCompositeOperation = 'destination-out'; g.strokeStyle = g.fillStyle = '#000'; }
  const [x0, y0, p0] = s.pts[0];
  if (SHAPES.includes(s.tool)) {
    g.lineWidth = s.size;
    const b = box(s);
    g.beginPath();
    if (s.tool === 'line') { const [x1, y1] = s.pts[s.pts.length - 1]; g.moveTo(x0, y0); g.lineTo(x1, y1); }
    else if (s.tool === 'rect') g.rect(b.x0, b.y0, b.w, b.h);
    else g.ellipse(b.x0 + b.w / 2, b.y0 + b.h / 2, Math.abs(b.w) / 2, Math.abs(b.h) / 2, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    return;
  }
  if (s.tool === 'marker') {
    // O singură cale, cu transparență: unde linia trece peste ea însăși nu se înnegrește.
    g.globalAlpha = 0.35;
    g.lineCap = 'square';
    g.lineWidth = s.size * 4 + 8;
    g.beginPath();
    g.moveTo(x0, y0);
    if (s.pts.length === 1) g.lineTo(x0 + 0.1, y0);
    for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i][0], s.pts[i][1]);
    g.stroke();
    g.restore();
    return;
  }
  const w = (p: number) => (s.tool === 'erase' ? s.size * 4 : s.size * (0.5 + p));
  if (s.pts.length === 1) {
    g.beginPath();
    g.arc(x0, y0, w(p0) / 2, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  // Bucăți scurte, fiecare cu grosimea după apăsarea creionului; mijloacele dintre puncte fac linia netedă.
  for (let i = 1; i < s.pts.length; i++) {
    const [ax, ay] = i > 1 ? [(s.pts[i - 2][0] + s.pts[i - 1][0]) / 2, (s.pts[i - 2][1] + s.pts[i - 1][1]) / 2] : [x0, y0];
    const [cx, cy, cp] = s.pts[i - 1];
    const [bx, by] = [(cx + s.pts[i][0]) / 2, (cy + s.pts[i][1]) / 2];
    g.lineWidth = w(cp);
    g.beginPath();
    g.moveTo(ax, ay);
    g.quadraticCurveTo(cx, cy, bx, by);
    g.stroke();
  }
  g.restore();
}

/** Cu ce pornește pânza (din fila Desenare a panglicii): unealta, culoarea, grosimea și foaia. */
export interface DrawStart { tool?: Tool; color?: string; size?: number; paper?: Paper }

export default function DrawDialog({ onDone, onClose, background, start, ink: startInk, autoReplay }: { onDone(png: Blob, ink?: Ink): void; onClose(): void; background?: string; start?: DrawStart; ink?: Ink | null; autoReplay?: boolean }) {
  // Peste o poză: foaia are proporțiile pozei (lățimea rămâne 1200 de puncte).
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!background) return;
    const img = new Image();
    img.onload = () => setBg(img);
    img.onerror = () => onClose();
    img.src = background;
  }, [background]);
  const H = bg ? Math.max(150, Math.min(2400, Math.round((W * bg.naturalHeight) / Math.max(1, bg.naturalWidth)))) : Math.max(150, Math.min(2400, startInk?.h ?? H0));
  const canvas = useRef<HTMLCanvasElement>(null);
  const ink = useRef<HTMLCanvasElement | null>(null);
  const before = useRef<HTMLCanvasElement | null>(null);
  // Un desen pus mai demult în notiță se redeschide cu liniile lui (se pot muta, șterge sau completa).
  const [strokes, setStrokes] = useState<Stroke[]>(() => startInk?.strokes ?? []);
  const [color, setColor] = useState(start?.color ?? COLORS[0][0]);
  const [size, setSize] = useState(start?.size ?? SIZES[0][0]);
  const [tool, setTool] = useState<Tool>(start?.tool ?? 'pen');
  const [paper, setPaper] = useState<Paper>(startInk?.paper ?? start?.paper ?? 'blank');
  const cur = useRef<Stroke | null>(null);
  // Lasoul: liniile alese, conturul tras acum și mutarea în curs (punctul de plecare și liniile de dinainte).
  const [sel, setSel] = useState<number[]>([]);
  /** Unghiul riglei, în grade; null = rigla e ascunsă. */
  const [ruler, setRuler] = useState<number | null>(null);
  const rulerRef = useRef(ruler);
  rulerRef.current = ruler;
  /** Raportorul (arce de cerc în jurul mijlocului foii); nu merge deodată cu rigla. */
  const [prot, setProt] = useState(false);
  const protRef = useRef(prot);
  protRef.current = prot;
  // ◇ Forme: liniile de creion care seamănă cu o linie, un dreptunghi sau un cerc devin forme curate (ținut minte).
  const [autoShape, setAutoShape] = useState(() => { try { return localStorage.getItem('suite.notes.inkShape') === '1'; } catch { return false; } });
  const toggleShape = () => { const v = !autoShape; setAutoShape(v); try { localStorage.setItem('suite.notes.inkShape', v ? '1' : '0'); } catch { /* fără loc */ } };
  const lasso = useRef<[number, number][] | null>(null);
  const drag = useRef<{ x: number; y: number; orig: Stroke[] } | null>(null);
  const hist = useRef<Stroke[][]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  const remember = () => { hist.current.push(strokesRef.current); if (hist.current.length > 100) hist.current.shift(); };
  useEffect(() => { if (tool !== 'lasso') setSel([]); }, [tool]);
  const count = useRef(0);
  count.current = strokes.length;

  const layer = () => {
    if (!ink.current || ink.current.height !== H) { ink.current = document.createElement('canvas'); ink.current.width = W; ink.current.height = H; }
    return ink.current;
  };
  const compose = () => {
    const g = canvas.current?.getContext('2d');
    if (!g) return;
    drawPaper(g, paper, H, bg);
    g.drawImage(layer(), 0, 0);
    // Conturul lasoului (în timp ce îl tragi) sau chenarul liniilor alese.
    const lp = lasso.current;
    const b = !lp && sel.length ? selBox(strokesRef.current, sel) : null;
    if (lp || b) {
      g.save();
      g.setLineDash([8, 6]);
      g.lineWidth = 2;
      g.strokeStyle = '#2563eb';
      g.beginPath();
      if (lp) { lp.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); }
      else if (b) g.rect(b.x0 - 4, b.y0 - 4, b.x1 - b.x0 + 8, b.y1 - b.y0 + 8);
      g.stroke();
      g.restore();
    }
    if (rulerRef.current !== null) drawRuler(g, W, H, rulerRef.current);
    if (protRef.current) drawProtractor(g, W, H);
  };
  useEffect(() => {
    const k = layer().getContext('2d')!;
    k.clearRect(0, 0, W, H);
    for (const s of strokes) drawStroke(k, s);
    compose();
  }, [strokes, paper, bg, sel, ruler, prot]);

  // ▶ Reluare: desenul se redesenează linie cu linie, în ordinea în care a fost făcut (cel mult ~8 secunde); clic din nou oprește.
  const [replaying, setReplaying] = useState(false);
  const replayRaf = useRef(0);
  const stopReplay = () => {
    cancelAnimationFrame(replayRaf.current);
    setReplaying(false);
    const k = layer().getContext('2d')!;
    k.clearRect(0, 0, W, H);
    for (const st of strokesRef.current) drawStroke(k, st);
    compose();
  };
  const replay = () => {
    if (replaying) { stopReplay(); return; }
    const all = strokesRef.current, total = strokePoints(all);
    if (!total) return;
    setSel([]);
    setReplaying(true);
    const ms = Math.min(8000, Math.max(1200, total * 6));
    const t0 = performance.now();
    const k = layer().getContext('2d')!;
    const frame = (t: number) => {
      const n = Math.ceil((total * Math.min(1, (t - t0) / ms)));
      k.clearRect(0, 0, W, H);
      for (const st of partialStrokes(all, n)) drawStroke(k, st);
      compose();
      if (n < total) replayRaf.current = requestAnimationFrame(frame);
      else setReplaying(false);
    };
    replayRaf.current = requestAnimationFrame(frame);
  };
  useEffect(() => () => cancelAnimationFrame(replayRaf.current), []);
  // ▶ Reluare pe un desen deja pus în notiță: pânza se deschide și pornește singură reluarea.
  useEffect(() => { if (!autoReplay) return; const t = setTimeout(replay, 60); return () => clearTimeout(t); }, []);

  const point = (e: React.PointerEvent): [number, number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    // Mouse-ul nu are apăsare (0,5 implicit); creionul da.
    const p = e.pointerType === 'pen' ? e.pressure : 0.5;
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H, p];
  };
  // Markerul și formele se redesenează întregi la fiecare mișcare, peste stratul de dinainte (păstrat în `before`).
  const whole = (t: Tool) => t === 'marker' || SHAPES.includes(t);

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fără captură: linia se oprește la marginea foii */ }
    if (tool === 'lasso') {
      const [x, y] = point(e);
      const b = sel.length ? selBox(strokes, sel) : null;
      if (b && x >= b.x0 - 6 && x <= b.x1 + 6 && y >= b.y0 - 6 && y <= b.y1 + 6) { remember(); drag.current = { x, y, orig: strokes }; return; }
      setSel([]);
      lasso.current = [[x, y]];
      return;
    }
    const s: Stroke = { tool, color, size, pts: [point(e)] };
    cur.current = s;
    if (whole(tool)) {
      const b = before.current ?? document.createElement('canvas');
      b.width = W; b.height = H;
      b.getContext('2d')!.drawImage(layer(), 0, 0);
      before.current = b;
    }
    if (!SHAPES.includes(tool)) drawStroke(layer().getContext('2d')!, s);
    compose();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.current) {
      const [x, y] = point(e);
      const d = drag.current, dx = x - d.x, dy = y - d.y;
      setStrokes(d.orig.map((st, i) => (sel.includes(i) ? { ...st, pts: st.pts.map(([px, py, pp]) => [px + dx, py + dy, pp] as [number, number, number]) } : st)));
      return;
    }
    if (lasso.current) {
      const [x, y] = point(e);
      lasso.current.push([x, y]);
      compose();
      return;
    }
    const s = cur.current;
    if (!s) return;
    const k = layer().getContext('2d')!;
    if (SHAPES.includes(s.tool)) {
      s.pts = [s.pts[0], point(e)];
      s.round = e.shiftKey;
    } else {
      // Punctele intermediare (creionul trimite multe între două cadre) fac scrisul mai fidel.
      const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
      const events = coalesced.length ? coalesced : [e.nativeEvent];
      // Cu rigla, creionul și markerul merg drept, paralel cu ea.
      const free = s.tool !== 'pen' && s.tool !== 'marker';
      for (const ev of events) {
        const q = point(ev as unknown as React.PointerEvent);
        s.pts.push(free ? q : ruler !== null ? alongRuler(s.pts[0], q, ruler) : prot ? alongArc(W / 2, H / 2, s.pts[0], q) : q);
      }
      if (!whole(s.tool)) drawStroke(k, { ...s, pts: s.pts.slice(-events.length - 2) });
    }
    if (whole(s.tool)) {
      k.clearRect(0, 0, W, H);
      k.drawImage(before.current!, 0, 0);
      drawStroke(k, s);
    }
    compose();
  };
  const up = () => {
    if (drag.current) { drag.current = null; return; }
    if (lasso.current) {
      const poly = lasso.current;
      lasso.current = null;
      setSel(lassoPick(strokes, poly));
      compose();
      return;
    }
    const s = cur.current;
    cur.current = null;
    if (s) {
      remember();
      const r = s.tool === 'pen' && autoShape && ruler === null && !prot ? recognize(s.pts) : null;
      setStrokes((l) => [...l, r ? { ...s, tool: r.tool, pts: r.pts } : s]);
    }
  };
  const delSel = () => {
    if (!sel.length) return;
    remember();
    setStrokes((l) => l.filter((_, i) => !sel.includes(i)));
    setSel([]);
  };

  const selRef = useRef(sel);
  selRef.current = sel;
  const delRef = useRef(delSel);
  delRef.current = delSel;
  const undo = () => { setSel([]); const p = hist.current.pop(); setStrokes((l) => p ?? l.slice(0, -1)); };
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (!isCurrent('note')) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current.length) { e.preventDefault(); delRef.current(); }
      else if (e.key === 'Escape' && selRef.current.length) { e.preventDefault(); setSel([]); }
      else if (e.key === 'Escape' && (!count.current || (await askYes('Renunți la desen?', 'Renunț la desen')))) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const done = () => {
    if (!strokes.length) { onClose(); return; }
    // Desenul pus în notiță: foaia și liniile, fără riglă și fără chenarul alegerii (care se văd doar aici).
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const g = out.getContext('2d')!;
    drawPaper(g, paper, H, bg);
    g.drawImage(layer(), 0, 0);
    // Liniile se dau și ele, ca desenul să rămână editabil (doar pe foaia goală; peste o poză rămâne poză).
    out.toBlob((b) => { if (b) onDone(b, bg ? undefined : { paper, strokes, ...(H !== H0 ? { h: H } : {}) }); }, 'image/png');
  };

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !strokes.length) onClose(); }}>
      <div className="print-dlg note-draw" role="dialog" aria-label="Desen de mână">
        <div className="note-draw-bar">
          {TOOLS.map(([t, label, title]) => (
            <button key={t} data-tool={t} className={tool === t ? 'on' : ''} title={title} onClick={() => setTool(t)}>{label}</button>
          ))}
        </div>
        <div className="note-draw-bar">
          {COLORS.map(([c, name]) => (
            <button key={c} className={`swatch ${tool !== 'erase' && color === c ? 'on' : ''}`} style={{ background: c }} title={name} aria-label={name}
              onClick={() => { setColor(c); if (tool === 'erase' || tool === 'lasso') setTool('pen'); }} />
          ))}
          <span className="sep" />
          {SIZES.map(([s, name]) => (
            <button key={s} className={size === s ? 'on' : ''} title={name} onClick={() => setSize(s)}>
              <span className="dot" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
          <span className="sep" />
          {!background && <select className="note-draw-paper" value={paper} onChange={(e) => setPaper(e.target.value as Paper)} title="Foaia: albă, cu linii sau cu pătrățele">
            {PAPERS.map(([p, name]) => <option key={p} value={p}>{name}</option>)}
          </select>}
          <span className="sep" />
          <button className={autoShape ? 'on' : ''} aria-pressed={autoShape} onClick={toggleShape}
            title="Desen → forme: o linie, un dreptunghi sau un cerc trase de mână cu creionul devin forme curate">◇ Forme</button>
          <button className={ruler !== null ? 'on' : ''} aria-pressed={ruler !== null} onClick={() => { setRuler(ruler === null ? 0 : null); setProt(false); }}
            title="Riglă: creionul și markerul trag linii drepte, paralele cu rigla (rigla nu apare în desenul pus în notiță)">📏 Riglă</button>
          {ruler !== null && <>
            <button onClick={() => setRuler((ruler + 345) % 360)} title="Rotește rigla cu 15° spre stânga" aria-label="Rotește rigla spre stânga">↺</button>
            <span className="note-draw-angle" aria-label="Unghiul riglei">{ruler}°</span>
            <button onClick={() => setRuler((ruler + 15) % 360)} title="Rotește rigla cu 15° spre dreapta" aria-label="Rotește rigla spre dreapta">↻</button>
          </>}
          <button className={prot ? 'on' : ''} aria-pressed={prot} onClick={() => { setProt(!prot); setRuler(null); }}
            title="Raportor: unghiurile din 10 în 10°; creionul și markerul trag arce de cerc în jurul mijlocului lui (raportorul nu apare în desenul pus în notiță)">◠ Raportor</button>
          {sel.length > 0 && <button onClick={delSel} title="Șterge liniile alese cu lasoul (Delete)">✕ Șterge alegerea ({sel.length})</button>}
          <button onClick={replay} disabled={!strokes.length} className={replaying ? 'on' : ''} aria-pressed={replaying} title="Reluare: desenul se redesenează linie cu linie, în ordinea în care l-ai făcut (clic din nou oprește)">{replaying ? '⏹ Oprește' : '▶ Reluare'}</button>
          <button onClick={undo} disabled={!strokes.length && !hist.current.length} title="Anulează ultima linie (Ctrl+Z)">↶ Anulează</button>
          <button onClick={async () => { if ((await askYes('Ștergi tot desenul?', 'Șterge tot'))) { remember(); setSel([]); setStrokes([]); } }} disabled={!strokes.length}>Șterge tot</button>
        </div>
        {background && !bg ? <p className="muted">Se încarcă poza…</p> : <canvas
          ref={canvas}
          width={W}
          height={H}
          className={tool === 'erase' ? 'erasing' : tool === 'lasso' ? 'lassoing' : ''}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ aspectRatio: `${W} / ${H}`, ...(replaying ? { pointerEvents: 'none' as const } : {}) }}
        />}
        <div className="note-draw-actions">
          <span className="muted">{background ? 'Desenează peste poză; la „Pune în notiță” poza se înlocuiește cu cea desenată.' : 'Desenează cu mouse-ul, creionul sau degetul. Desenul se pune în notiță ca poză.'}</span>
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={done}>Pune în notiță</button>
        </div>
      </div>
    </div>
  );
}
