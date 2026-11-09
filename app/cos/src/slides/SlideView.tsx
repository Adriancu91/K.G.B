// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Desenarea unui slide: aceeași componentă pentru editor (casete editabile, mutare, mărire), miniaturi și prezentare.
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cellFmtCss } from './cellFmt';
import { chartUrl } from './chart';
import { animDirVars, byPara, cleanPfmt, gapPx, isMediaFx, isPlay, paraGroups, type ParaFmt } from './model';
import { boxOf, scaleGroup } from './group';
import { deletePoint, editPoints, fitPath, insertPoint, movePoint } from './points';
import { moveGuide, type Guides } from './guides';
import Ruler from './Ruler';
import { shapeFillCss, OPEN_PATHS, slideBackground, isLine, isNumbered, colFractions, rowFractions, dragColW, dashArray, withTransp, tableLook, ElKind, fillOf, fontSize, ListStyle, lineLevel, lineText, listNumbers, MAX_LEVEL, normRot, numberType, PLACEHOLDER, Size, Slide, SLIDE_H, SLIDE_W, SlideEl, textOn, Theme, turnCss, POLYGONS, animTimes, isExit, isMotionPath, waitsVisible } from './model';
import { clipCss, cropImgStyle, fullBox } from './crop';
import { adjFilter } from './adjust';
import { cellSides, cleanMerges, isCovered, mergeAt, padOf } from './tableMerge';
import { tableColors } from './tableStyle';
import { BEVEL_FILTER, fxCss, fxMask, textFxCss, textGradCss, rot3dCss } from './fx';
import { warpLength, warpPath, warpText } from './warp';
import { pathBackground, polygonPath } from './geom';
import { isVideo } from './media';
import { cleanMarks, markCss, marksFromDom, marksHtml, segments, type TextMark } from './marks';
import { attachAutoCorrect } from './autoCorrectText';
import { hasBend, lineBox, lineEnds, routeGeom, sites } from './connectors';
import { CameoView } from './cameo';

type Geom = Pick<SlideEl, 'x' | 'y' | 'w' | 'h'>;

interface Props {
  slide: Slide;
  /** Numărul slide-ului, scris în colțul din dreapta jos (lipsă = fără număr). */
  num?: number;
  /** Textul de subsol (jos, la mijloc) și data (stânga jos), ca Antet și subsol din PowerPoint. */
  footer?: string;
  date?: string;
  theme: Theme;
  /** Cât se micșorează pânza (1 = mărime reală). */
  scale: number;
  /** Mărimea pânzei (lipsă = 1280 × 720, formatul lat). */
  size?: Size;
  /** Cu `onText`, casetele se pot scrie (editorul); fără, slide-ul doar se arată. */
  /** `pfmt` null = rândurile din casetă nu se pot potrivi cu textul (formatul paragrafelor rămâne cel de dinainte). */
  onText?: (elId: string, text: string, marks?: TextMark[], pfmt?: (ParaFmt | null)[] | null) => void;
  /** Prezentare: casetele cu animație care n-au apărut încă (cele apărute își joacă animația). */
  hidden?: Set<string>;
  /** În prezentare: casetele cu ieșire care pleacă (sau au plecat) de pe slide. */
  gone?: Set<string>;
  /** În prezentare: când începe și cât ține animația fiecărei casete (lipsă = calculate din slide); vezi showState. */
  times?: Map<string, { at: number; dur: number }>;
  /** Editor: textul unei celule de tabel s-a schimbat. */
  onCell?: (elId: string, row: number, col: number, text: string) => void;
  /** Editor: text cu mai multe celule lipit (din Sheets / Excel), pus începând cu celula dată. */
  onPasteGrid?: (elId: string, row: number, col: number, text: string) => void;
  /** Editor: lățimile coloanelor unui tabel, trase cu mausul de marginea dintre ele (first = începutul tragerii, pentru Anulează). */
  onColW?: (elId: string, w: number[], first: boolean) => void;
  /** Editor: înălțimile rândurilor unui tabel, trase de marginea dintre ele. */
  onRowH?: (elId: string, h: number[], first: boolean) => void;
  /** Editor: graficul ale cărui date se scriu acum (se arată ca tabel în loc de desen). */
  dataEdit?: string | null;
  /** Editor: caseta aleasă, alegerea ei, mutarea / mărirea (onGeomStart vine o dată, la începutul tragerii, pentru Anulează). */
  selected?: string | null;
  onSelect?: (elId: string | null, add?: boolean) => void;
  /** Poza care se decupează acum: colțurile nu mai păstrează proporțiile (taie din laturi). */
  cropping?: string | null;
  onGeomStart?: () => void;
  onGeom?: (elId: string, g: Geom) => void;
  /** Editor: celelalte casete alese (Shift+click), care se mută împreună cu cea trasă. */
  group?: string[];
  onGeoms?: (moves: { id: string; g: Geom }[]) => void;
  /** Editor: rotirea casetei din mânerul rotund de deasupra ei (în grade). */
  onRot?: (elId: string, deg: number) => void;
  /** Prezentare pe două ecrane: ecranul prezentatorului nu pornește clipurile și nu scoate sunet (le redă fereastra publicului). */
  quiet?: boolean;
  /** Poză nemișcată după un click (video din prezentare): fără cameră, clipuri și sunete pornite. */
  still?: boolean;
  /** Editor: ghidajele arătate (Ghidaje, Alt+F9); casetele se lipesc de ele. onGuides le mută (first = începutul tragerii). */
  userGuides?: Guides | null;
  onGuides?: (g: Guides, first: boolean) => void;
  /** Editor: rigla în centimetri, sus și în stânga (📏 Riglă), cu locul casetei alese. */
  ruler?: boolean;
  /** Un strat peste slide, în ramă (de exemplu desenarea sau arătarea căii de mișcare). */
  overlay?: ReactNode;
  /** Casetele coordonatorului de diapozitive (deck.master), desenate în spatele celor ale slide-ului; vezi masterEls. */
  master?: SlideEl[];
  /** Editor (Fișier → Opțiuni): grid = pasul grilei de care se lipesc casetele (pixeli ai slide-ului, 0 = fără); smart = ghidajele
   *  inteligente (alinierea cu celelalte casete). Marginile și mijlocul slide-ului și ghidajele trase rămân mereu. */
  snap?: { grid: number; smart: boolean };
  /** Editor: forma liberă ale cărei puncte se editează acum (Editare puncte); onPath primește traseul și caseta noi
   *  (first = începutul tragerii sau ștergerea, pentru Anulează). */
  pointsEdit?: string | null;
  onPath?: (elId: string, p: Pick<SlideEl, 'path' | 'x' | 'y' | 'w' | 'h'>, first: boolean) => void;
  /** Editor: mânerul galben al conectorului frânt / curbat mută segmentul din mijloc (bend, 0…1). */
  onBend?: (elId: string, bend: number, first: boolean) => void;
}

/** Cât de aproape (în pixelii slide-ului) trebuie să fie centrul casetei de mijlocul slide-ului ca să se „lipească”. */
const SNAP = 10;
const MIN = 40;

/** Cea mai apropiată lipire a unei laturi (început, mijloc, sfârșit) de una din linii: cât se mută caseta și unde e linia. */
function snap1(pos: number, size: number, lines: number[]): { d: number; at: number } | null {
  let best: { d: number; at: number } | null = null;
  for (const p of [pos, pos + size / 2, pos + size]) {
    for (const l of lines) {
      const d = l - p;
      if (Math.abs(d) < SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: l };
    }
  }
  return best;
}

/** Întârzierea (până atunci caseta rămâne ascunsă: fill backwards) și durata aleasă a animației. */
function animStyle(el: SlideEl, t?: { at: number; dur: number }): CSSProperties {
  if (!t) return {};
  // Ieșirea rămâne ascunsă după ce s-a terminat (forwards) și vizibilă cât așteaptă (backwards).
  // Crește rămâne mărită, ca în PowerPoint.
  // Căile (Linie, Arc) lasă caseta la capătul drumului.
  const stays = isExit(el.anim) || el.anim === 'grow' || isMotionPath(el.anim);
  const fill = stays ? 'both' : 'backwards';
  return { ...animDirVars(el), ...(t.at || stays ? { animationDelay: `${t.at}s`, animationFillMode: fill } : {}), ...(el.animDur && el.anim !== 'appear' && el.anim !== 'exit' ? { animationDuration: `${t.dur}s` } : {}) };
}

export default function SlideView({ slide, num, footer, date, theme, scale, size = { w: SLIDE_W, h: SLIDE_H }, hidden, gone, times: timesIn, onText, onCell, onPasteGrid, onColW, onRowH, dataEdit, selected, onSelect, onGeomStart, onGeom, group = [], onGeoms, onRot, quiet, still, cropping, userGuides, onGuides, ruler, master, snap, pointsEdit, onPath, onBend, overlay }: Props) {
  const editing = !!onText;
  // Ghidajul arătat la mutare (poziția liniei verticale / orizontale pe slide).
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  /** Tragere: mutare (din mâner sau din poză) sau mărire (din colțuri). La poze, colțurile păstrează proporțiile. */
  const startDrag = (e: React.PointerEvent, el: SlideEl, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    if (!onGeom || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.shiftKey) onSelect?.(el.id);
    onGeomStart?.();
    // Grupul (Shift+click) se mută cu aceeași distanță ca și caseta trasă.
    const mates = mode === 'move' && onGeoms ? slide.els.filter((o) => o.id !== el.id && (group.includes(o.id) || (group.includes(el.id) && o.id === selected))) : [];
    const sx = e.clientX, sy = e.clientY, g0: Geom = { x: el.x, y: el.y, w: el.w, h: el.h };
    const ratio = g0.w / g0.h;
    // Liniile de care se poate lipi caseta: marginile și mijlocul slide-ului și ale celorlalte casete.
    const others = snap?.smart === false ? [] : slide.els.filter((o) => o.id !== el.id && !mates.includes(o));
    // Lipirea de grilă: colțul casetei sare la cea mai apropiată linie a grilei (unde nu s-a lipit deja de un ghidaj).
    const step = snap?.grid ?? 0;
    const onGrid = (v: number) => Math.round(Math.round(v / step) * step);
    const xLines = [0, size.w / 2, size.w, ...(userGuides?.v ?? []), ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
    const yLines = [0, size.h / 2, size.h, ...(userGuides?.h ?? []), ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
      let g: Geom;
      if (mode === 'move') {
        g = { ...g0, x: Math.round(g0.x + dx), y: Math.round(g0.y + dy) };
        // Ghidaje: marginile și mijlocul casetei se lipesc de marginile și mijlocul slide-ului sau al altor casete (Alt ține liber).
        const sx = ev.altKey ? null : snap1(g.x, g.w, xLines);
        const sy = ev.altKey ? null : snap1(g.y, g.h, yLines);
        if (sx) g.x = Math.round(g.x + sx.d);
        if (sy) g.y = Math.round(g.y + sy.d);
        if (step > 0 && !ev.altKey) {
          if (!sx) g.x = onGrid(g.x);
          if (!sy) g.y = onGrid(g.y);
        }
        setGuides({ x: sx?.at ?? null, y: sy?.at ?? null });
      } else {
        let { x, y, w, h } = g0;
        // Liniile pot ajunge la lățime / înălțime 0 (orizontale, verticale).
        const mn = isLine(el) ? 0 : MIN;
        if (mode.includes('e')) w = Math.max(mn, g0.w + dx); else { w = Math.max(mn, g0.w - dx); x = g0.x + g0.w - w; }
        if (mode.includes('s')) h = Math.max(mn, g0.h + dy); else { h = Math.max(mn, g0.h - dy); y = g0.y + g0.h - h; }
        // Latura trasă se lipește de grilă (pozele își păstrează proporțiile mai jos, deci doar la celelalte casete).
        if (step > 0 && !ev.altKey && el.kind !== 'image') {
          if (mode.includes('e')) w = Math.max(mn, onGrid(x + w) - x); else { const nx = Math.min(onGrid(x), g0.x + g0.w - mn); w = g0.x + g0.w - nx; x = nx; }
          if (mode.includes('s')) h = Math.max(mn, onGrid(y + h) - y); else { const ny = Math.min(onGrid(y), g0.y + g0.h - mn); h = g0.y + g0.h - ny; y = ny; }
        }
        if (el.kind === 'image' && el.id !== cropping) {
          // Proporțiile pozei rămân aceleași: hotărăște latura trasă mai mult.
          if (w / h > ratio) h = w / ratio; else w = h * ratio;
          if (!mode.includes('e')) x = g0.x + g0.w - w;
          if (!mode.includes('s')) y = g0.y + g0.h - h;
        }
        g = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
      }
      if (mates.length) onGeoms!([{ id: el.id, g }, ...mates.map((o) => ({ id: o.id, g: { x: o.x + g.x - g0.x, y: o.y + g.y - g0.y, w: o.w, h: o.h } }))]);
      else onGeom(el.id, g);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setGuides({ x: null, y: null });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /** Capătul unei linii: se mută doar el (celălalt rămâne), poate trece peste celălalt (linia se întoarce); grila îl prinde (Alt = liber). */
  const startLineEnd = (e: React.PointerEvent, el: SlideEl, end: 0 | 1) => {
    if (!onGeom || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onGeomStart?.();
    const sx = e.clientX, sy = e.clientY, [a0, b0] = lineEnds(el), p0 = end ? b0 : a0, fixed = end ? a0 : b0;
    const step = snap?.grid ?? 0;
    const onMove = (ev: PointerEvent) => {
      let p = { x: p0.x + (ev.clientX - sx) / scale, y: p0.y + (ev.clientY - sy) / scale };
      if (step > 0 && !ev.altKey) p = { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
      onGeom(el.id, lineBox(end ? fixed : p, end ? p : fixed));
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  /** Mânerul galben al conectorului: segmentul din mijloc se mută de-a lungul liniei (orizontal sau, la cel vertical, în sus / jos). */
  const startBend = (e: React.PointerEvent, el: SlideEl) => {
    if (!onBend || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const vv = el.axes === 'vv', len = vv ? el.h : el.w, flip = vv ? el.flipV : el.flipH;
    const s0 = vv ? e.clientY : e.clientX, b0 = el.bend ?? 0.5;
    let first = true;
    const onMove = (ev: PointerEvent) => {
      const dp = ((vv ? ev.clientY : ev.clientX) - s0) / scale / (len || 1);
      onBend(el.id, b0 + (flip ? -dp : dp), first);
      first = false;
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  /** Tragerea unui ghidaj: se mută cu mouse-ul; scos în afara slide-ului, dispare. */
  const startGuide = (e: React.PointerEvent, dir: 'v' | 'h', i: number) => {
    if (!onGuides || !userGuides || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const g0 = userGuides, start = dir === 'v' ? e.clientX : e.clientY, p0 = g0[dir][i];
    let first = true;
    const onMove = (ev: PointerEvent) => {
      const pos = p0 + ((dir === 'v' ? ev.clientX : ev.clientY) - start) / scale;
      onGuides(moveGuide(g0, dir, i, pos, size), first);
      first = false;
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const cm = (px: number) => (px / 37.795).toFixed(2).replace('.', ',');

  // Grupul ales întreg (Ctrl+G): chenarul lui, cu mânere care măresc sau micșorează toate casetele deodată.
  const selG = slide.els.find((o) => o.id === selected)?.grp;
  const grpEls = selG ? slide.els.filter((o) => o.grp === selG) : [];
  const grpBox = grpEls.length > 1 && grpEls.every((o) => o.id === selected || group.includes(o.id)) ? boxOf(grpEls) : null;
  const startGroupResize = (e: React.PointerEvent, corner: string) => {
    if (!onGeoms || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onGeomStart?.();
    const sx = e.clientX, sy = e.clientY, start = grpEls.map((o) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h }));
    const onMove = (ev: PointerEvent) => onGeoms(scaleGroup(start, corner, (ev.clientX - sx) / scale, (ev.clientY - sy) / scale, ev.shiftKey));
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /** Rotire din mânerul ⟳: unghiul dintre centrul casetei și mouse; se lipește de 0 / 90 / 180 / 270, iar Shift merge din 15 în 15 grade. */
  /** Editare puncte: tragerea unui punct al traseului (în coordonatele casetei, ținând cont de rotire și oglindire);
   *  la sfârșit caseta se potrivește din nou pe puncte. */
  const startPoint = (e: React.PointerEvent, el: SlideEl, i: number, u0: number, v0: number, cont = false) => {
    if (!onPath || !el.path || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const d0 = el.path, sx = e.clientX, sy = e.clientY, r = ((el.rot ?? 0) * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
    const g = { x: el.x, y: el.y, w: el.w, h: el.h };
    let last = d0, first = !cont;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
      let lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
      if (el.flipH) lx = -lx;
      if (el.flipV) ly = -ly;
      last = movePoint(d0, i, u0 + lx / Math.max(1, el.w), v0 + ly / Math.max(1, el.h));
      onPath(el.id, { path: last, ...g }, first); first = false;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      if (last !== d0) onPath(el.id, fitPath(last, g), false);
    };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  };
  /** Editare puncte: apăsarea pe contur adaugă acolo un punct nou, care se trage mai departe din aceeași mișcare. */
  const addPoint = (e: React.PointerEvent, el: SlideEl) => {
    if (!onPath || !el.path || e.button !== 0) return;
    const box = (e.currentTarget as Element).closest('.sl-selbox')?.getBoundingClientRect();
    if (!box) return;
    const dx = (e.clientX - (box.x + box.width / 2)) / scale, dy = (e.clientY - (box.y + box.height / 2)) / scale;
    const r = ((el.rot ?? 0) * Math.PI) / 180;
    let lx = dx * Math.cos(r) + dy * Math.sin(r), ly = -dx * Math.sin(r) + dy * Math.cos(r);
    if (el.flipH) lx = -lx;
    if (el.flipV) ly = -ly;
    const ins = insertPoint(el.path, 0.5 + lx / Math.max(1, el.w), 0.5 + ly / Math.max(1, el.h), el.w, el.h);
    if (!ins) return;
    const pt = editPoints(ins.path).find((q) => q.i === ins.i);
    onPath(el.id, { path: ins.path, x: el.x, y: el.y, w: el.w, h: el.h }, true);
    if (pt) startPoint(e, { ...el, path: ins.path }, ins.i, pt.u, pt.v, true);
  };
  const startRotate = (e: React.PointerEvent, el: SlideEl) => {
    if (!onRot || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onGeomStart?.();
    const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const onMove = (ev: PointerEvent) => {
      let deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      else {
        deg = Math.round(deg);
        const near = Math.round(deg / 90) * 90;
        if (Math.abs(deg - near) <= 3) deg = near;
      }
      onRot(el.id, normRot(deg));
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // În prezentare: când începe fiecare animație (odată cu / după precedenta, întârziere) și cât ține.
  const times = hidden ? timesIn ?? animTimes(slide) : null;
  /** O casetă a slide-ului; `live` = se poate alege și scrie (editorul), null = a coordonatorului (în spate, fără animații, nu se alege). */
  const renderEl = (el: SlideEl, live: boolean | null) => (
          <div
            key={el.id}
            className={`sl-el ${live === null ? 'sl-master-el' : ''} sl-k-${el.kind} ${el.flipH ? 'fh' : ''} ${el.flipV ? 'fv' : ''} ${selected === el.id ? 'sel' : ''} ${group.includes(el.id) && selected !== el.id ? 'sel-more' : ''} ${hidden && live !== null ? (hidden.has(el.id) ? 'sl-hidden' : el.anim && !byPara(el) && (!waitsVisible(el.anim) || gone?.has(el.id)) ? `sl-in-${el.anim}` : '') : ''} ${el.link || el.linkSnd ? 'sl-linked' : ''} ${el.crop ? 'sl-cropped' : ''} ${el.clip ? 'sl-clipped' : ''} ${el.id === cropping ? 'sl-cropping' : ''}`}
            data-link={el.link}
            data-snd={el.linkSnd}
            data-hover={el.linkHover ? '' : undefined}
            data-el={el.id}
            data-gap={el.spb || el.spa ? '' : undefined}
            data-zoom={el.szoom ? (el.szsec ? 'sec' : '') : undefined}
            data-tfx={el.tfx === 'reflect' ? 'reflect' : undefined}
            data-tgrad={el.tgrad ? '' : undefined}
            data-warp={el.warp && warpText(el.text) ? el.warp : undefined}
            onPointerDownCapture={live ? (e) => onSelect?.(el.id, e.shiftKey) : undefined}
            // Click pe golul casetei (nu doar pe text) mută cursorul în ea.
            onMouseDown={live && el.kind !== 'image' && el.kind !== 'table' && el.kind !== 'chart' && el.kind !== 'media' ? (e) => { if (e.target === e.currentTarget) { e.preventDefault(); (e.currentTarget.firstElementChild as HTMLElement | null)?.focus(); } } : undefined}
            style={{
              left: el.x, top: el.y, width: el.w, height: el.h,
              fontSize: fontSize(el.kind, slide.layout),
              ...(el.kind === 'title' ? { color: theme.title, fontFamily: theme.titleFont } : {}),
              ...(el.kind === 'shape' ? shapeStyle(el, theme) : {}),
              ...(el.size ? { fontSize: fontSize(el.kind, slide.layout) * el.size } : {}),
              ...(el.color ? { color: el.color } : {}),
              ...(times && live !== null && el.anim && !byPara(el) && !hidden?.has(el.id) && (!waitsVisible(el.anim) || gone?.has(el.id)) ? animStyle(el, times.get(el.id)) : {}),
              ...(el.bold !== undefined ? { fontWeight: el.bold ? 700 : 400 } : {}),
              ...(el.italic ? { fontStyle: 'italic' } : {}),
              // Rândul simplu are 1,25 din mărimea literei (ca .sl-el din slides.css).
              ...(el.spacing ? { lineHeight: 1.25 * el.spacing } : {}),
              // Spațierea înainte / după paragraf (slides.css, pe fiecare rând sau punct al casetei).
              ...(el.spb ? { ['--sl-spb' as string]: gapPx(el.spb) + 'px' } : {}),
              ...(el.spa ? { ['--sl-spa' as string]: gapPx(el.spa) + 'px' } : {}),
              ...(el.underline || el.strike ? { textDecoration: [el.underline ? 'underline' : '', el.strike ? 'line-through' : ''].filter(Boolean).join(' ') } : {}),
              ...(el.font ? { fontFamily: `"${el.font}", ${el.kind === 'title' ? theme.titleFont : theme.bodyFont}` } : {}),
              ...(el.align ? { textAlign: el.align } : {}),
              ...(el.valign ? { justifyContent: { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.valign] } : {}),
              // Marginile interioare ale casetei (sus, dreapta, jos, stânga), peste cele obișnuite ale felului ei.
              ...(el.inset ? { padding: el.inset.map((v) => v + 'px').join(' '), boxSizing: 'border-box' as const } : {}),
              ...(turnCss(el) || rot3dCss(el.rot3d) ? { transform: [rot3dCss(el.rot3d), turnCss(el)].filter(Boolean).join(' ') } : {}),
              ...(el.tfx && el.tfx !== 'reflect' ? textFxCss(el.tfx, theme.accent) : {}),
              // Literele umplute cu gradient: fundalul textului decupat după litere (slides.css, data-tgrad).
              ...(el.tgrad ? { ['--sl-tg' as string]: textGradCss(el.tgrad) } : {}),
              ...(el.fx && (el.kind === 'shape' || el.kind === 'image') ? { filter: fxCss(el.fx, theme.accent), ...fxMask(el.fx) } : {}),
              // Chenarul pozei: desenat deasupra ei (::before din slides.css), ca să nu schimbe mărimea pozei.
              ...(el.kind === 'image' && el.line ? { ['--sl-pb' as string]: `${el.lineW ?? 2}px ${el.lineDash === 'dot' ? 'dotted' : el.lineDash ? 'dashed' : 'solid'} ${el.line}` } : {}),
              // La poza decupată în cerc sau cu colțuri rotunjite, chenarul urmează forma.
              ...(el.kind === 'image' && el.line && (el.clip === 'ellipse' || el.clip === 'roundRect') && el.id !== cropping ? { ['--sl-pr' as string]: el.clip === 'ellipse' ? '50%' : '16%' } : {}),
            }}
          >
            {el.kind === 'shape' && el.cam && !isLine(el) && (
              // Cameo: camera pornește doar pe slide-ul din editor și în prezentare, nu în miniaturi.
              <CameoView on={(live === true && editing) || (!!hidden && live !== null && !still)}
                clip={{ borderRadius: el.shape === 'ellipse' ? '50%' : el.shape === 'round' ? 24 : 0, ...(el.shape && POLYGONS[el.shape] ? { clipPath: `polygon(${POLYGONS[el.shape]})` } : {}) }} />
            )}
            {el.kind === 'image' ? (
              (() => {
                const img = <img src={el.src} alt={el.alt ?? ''} draggable={false} style={el.crop || el.transp || el.adj ? { ...(el.crop ? cropImgStyle(el.crop) : {}), ...(el.transp ? { opacity: (100 - el.transp) / 100 } : {}), ...(el.adj ? { filter: adjFilter(el.adj) } : {}) } : undefined} onPointerDown={live ? (e) => startDrag(e, el, 'move') : undefined} />;
                // Decupată la formă: poza se vede doar în formă; la decupare (mânere) se vede toată, ca să știi ce tai.
                return el.clip && el.id !== cropping ? <div className="sl-clip" style={{ clipPath: clipCss(el.clip) }}>{img}</div> : img;
              })()
            ) : el.kind === 'table' || (el.kind === 'chart' && live && dataEdit === el.id && onCell) ? (
              <TableView
                el={el}
                theme={theme}
                onCell={live && onCell ? ((r, c, t) => onCell(el.id, r, c, t)) : undefined}
                onPasteGrid={live && onPasteGrid ? ((r, c, t) => onPasteGrid(el.id, r, c, t)) : undefined}
                onColW={live && el.kind === 'table' && onColW ? (w, first) => onColW(el.id, w, first) : undefined}
                onRowH={live && el.kind === 'table' && onRowH ? (h, first) => onRowH(el.id, h, first) : undefined}
              />
            ) : el.kind === 'media' ? (
              <MediaView el={el} live={!!live || (!!hidden && !el.across && !still)} auto={!!hidden && !quiet && !hidden.has(el.id) && (!!el.autoplay || (isPlay(el.anim) && !!gone?.has(el.id)))} delay={isMediaFx(el.anim) ? times?.get(el.id)?.at : undefined} halt={!!hidden && !quiet && !!gone?.has(el.id) && (el.anim === 'pause' || el.anim === 'stop') ? el.anim : undefined} quiet={quiet} show={!!hidden && !editing && !still} />
            ) : el.kind === 'chart' ? (
              <img className="sl-chart" src={chartUrl(el)} alt={el.text || 'Grafic'} draggable={false} />
            ) : isLine(el) ? (
              <LineView el={el} theme={theme} />
            ) : live && onText ? <EditableText el={el} onChange={(t, m, p) => onText(el.id, t, m, p)} /> : <StaticText kind={el.kind} text={el.text} list={el.list} start={el.listStart} marks={el.marks} pfmt={el.pfmt} rows={!!(el.spb || el.spa)} paras={hidden && times && live !== null && byPara(el) ? { el, hidden, times } : undefined} />}
            {el.warp && warpText(el.text) && el.kind !== 'image' && el.kind !== 'table' && el.kind !== 'chart' && el.kind !== 'media' && !isLine(el) && (
              // Textul transformat: desenat pe cale peste caseta (ascunsă din slides.css cât nu se scrie în ea).
              <svg className="sl-warp" viewBox={`0 0 ${el.w} ${el.h}`} width={el.w} height={el.h} aria-hidden="true">
                <defs>
                  <path id={`sl-warp-${el.id}`} d={warpPath(el.warp, el.w, el.h, fontSize(el.kind, slide.layout) * (el.size ?? 1))} />
                  {el.tgrad && <linearGradient id={`sl-warpg-${el.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={el.tgrad[0]} /><stop offset="1" stopColor={el.tgrad[1]} /></linearGradient>}
                </defs>
                <text fill={el.tgrad ? `url(#sl-warpg-${el.id})` : 'currentColor'}>
                  {/* Literele întinse pe toată calea (pe cerc aproape tot ocolul), ca la textul transformat din .pptx. */}
                  <textPath href={`#sl-warp-${el.id}`} startOffset="50%" textAnchor="middle" lengthAdjust="spacing"
                    textLength={Math.round(warpLength(warpPath(el.warp, el.w, el.h, fontSize(el.kind, slide.layout) * (el.size ?? 1))) * (el.warp === 'circle' ? 0.96 : 0.9))}>{warpText(el.text)}</textPath>
                </text>
              </svg>
            )}
          </div>
  );
  return (
    <div className={`sl-frame ${ruler ? 'sl-frame-ruled' : ''}`} style={{ width: size.w * scale, height: size.h * scale }}>
      {slide.els.some((o) => o.fx === 'bevel') && (
        // Teșirea: marginile formei luminate din stânga-sus (lumină speculară pe conturul estompat), apoi puse peste formă.
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <filter id={BEVEL_FILTER} x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b" />
            <feSpecularLighting in="b" surfaceScale="4" specularConstant="0.9" specularExponent="16" lightingColor="#ffffff" result="s">
              <feDistantLight azimuth="225" elevation="40" />
            </feSpecularLighting>
            <feComposite in="s" in2="SourceAlpha" operator="in" result="lit" />
            <feComposite in="SourceGraphic" in2="lit" operator="arithmetic" k1="0" k2="1" k3="0.7" k4="0" />
          </filter>
        </svg>
      )}
      {ruler && (() => {
        const sel = slide.els.find((o) => o.id === selected);
        return (
          <>
            <Ruler dir="h" len={size.w} scale={scale} mark={sel ? [sel.x, sel.x + sel.w] : null} />
            <Ruler dir="v" len={size.h} scale={scale} mark={sel ? [sel.y, sel.y + sel.h] : null} />
          </>
        );
      })()}
      <div
        className={`sl-slide sl-l-${slide.layout}`}
        style={{
          width: size.w, height: size.h, transform: `scale(${scale})`,
          background: slideBackground(slide, theme.bg), color: theme.fg, fontFamily: theme.bodyFont,
          ['--sl-accent' as string]: theme.accent,
          ['--sl-ui' as string]: 1 / scale,
          // Mărimea slide-ului, pentru tranzițiile de conținut dinamic (cât drum fac casetele).
          ['--sl-w' as string]: size.w + 'px', ['--sl-h' as string]: size.h + 'px',
        }}
        onPointerDown={editing ? (e) => { if (e.target === e.currentTarget) onSelect?.(null); } : undefined}
      >
        {['section', 'content', 'two'].includes(slide.layout) && <div className="sl-bar" style={barStyle(slide.layout, size)} />}
        {/* Ghidajele se prind cu mouse-ul doar unde nu e nicio casetă (zona de prindere e sub casete, linia se vede deasupra). */}
        {editing && userGuides && (['v', 'h'] as const).flatMap((dir) => userGuides[dir].map((p, i) => (
          <div key={'hit' + dir + i} className={`sl-uguide-hit ${dir}`} style={dir === 'v' ? { left: p } : { top: p }} onPointerDown={(e) => startGuide(e, dir, i)}
            title={`Ghidaj la ${cm(p)} cm de la ${dir === 'v' ? 'stânga' : 'marginea de sus'}: trage-l ca să-l muți, scoate-l din slide ca să-l ștergi`} />
        )))}
        {master?.map((el) => renderEl(el, null))}
        {slide.els.filter((el) => !el.hide).map((el) => renderEl(el, editing))}
        {num !== undefined && <div className="sl-pgnum" aria-label={`Slide ${num}`}>{num}</div>}
        {footer && <div className="sl-pgnum sl-footer">{footer}</div>}
        {date && <div className="sl-pgnum sl-date">{date}</div>}
        {editing && slide.els.filter((el) => el.id === selected).map((el) => (
          <div key={el.id} className="sl-selbox" style={{ left: el.x, top: el.y, width: el.w, height: el.h, ...(el.rot ? { transform: `rotate(${el.rot}deg)` } : {}) }}>
            {onRot && el.kind !== 'table' && el.kind !== 'chart' && el.kind !== 'media' && (
              <span className="sl-rot" title={`Trage ca să rotești caseta (Shift: din 15 în 15 grade)${el.rot ? ` · acum ${String(el.rot).replace('.', ',')}°` : ''}`} onPointerDown={(e) => startRotate(e, el)}>⟳</span>
            )}
            {el.id === cropping && el.kind === 'image' && (() => {
              // Cât decupezi: poza întreagă, ștearsă, în spatele ferestrei (ca în PowerPoint).
              const f = fullBox(el);
              return <img className="sl-crop-ghost" src={el.src} alt="" draggable={false} style={{ left: f.x - el.x, top: f.y - el.y, width: f.w, height: f.h }} />;
            })()}
            {el.kind !== 'image' && (
              <span className="sl-grip" title="Trage ca să muți caseta" onPointerDown={(e) => startDrag(e, el, 'move')}>✥</span>
            )}
            {isLine(el) ? ([0, 1] as const).map((end) => {
              // Liniile au doar două mânere, la capete: fiecare mută capătul lui (și îl lipește de o formă, connectors.ts).
              const atRight = end ? !el.flipH : !!el.flipH, atBottom = end ? !el.flipV : !!el.flipV;
              return <span key={end} className={`sl-handle lend lend${end}`} style={{ left: atRight ? '100%' : 0, top: atBottom ? '100%' : 0 }}
                title="Trage capătul liniei; lângă mijlocul laturii unei forme se lipește de ea" onPointerDown={(e) => startLineEnd(e, el, end)} />;
            }).concat(hasBend(el) && onBend ? [(() => {
              // Mânerul galben: la mijlocul segmentului din mijloc al conectorului cu două coturi.
              const vv = el.axes === 'vv', b = el.bend ?? 0.5;
              const u = vv ? 0.5 : el.flipH ? 1 - b : b, v = vv ? (el.flipV ? 1 - b : b) : 0.5;
              return <span key="bend" className={`sl-handle lbend ${vv ? 'vv' : ''}`} style={{ left: `${u * 100}%`, top: `${v * 100}%` }}
                title="Trage ca să muți segmentul din mijloc al conectorului" onPointerDown={(e) => startBend(e, el)} />;
            })()] : []) : el.id !== pointsEdit && (['nw', 'ne', 'sw', 'se'] as const).map((m) => (
              <span key={m} className={`sl-handle ${m}`} title="Trage ca să mărești sau să micșorezi" onPointerDown={(e) => startDrag(e, el, m)} />
            ))}
            {el.id === pointsEdit && el.path && (
              <svg className="sl-pt-line" viewBox="0 0 1 1" preserveAspectRatio="none" style={el.flipH || el.flipV ? { transform: `scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})` } : undefined}>
                <path className="vis" d={el.path} vectorEffect="non-scaling-stroke" />
                <path className="hit" d={el.path} vectorEffect="non-scaling-stroke" onPointerDown={(e) => addPoint(e, el)}>
                  <title>Trage de contur ca să adaugi un punct nou</title>
                </path>
              </svg>
            )}
            {el.id === pointsEdit && el.path && editPoints(el.path).map(({ i, u, v }) => (
              <span
                key={i}
                className="sl-pt"
                style={{ left: `${(el.flipH ? 1 - u : u) * 100}%`, top: `${(el.flipV ? 1 - v : v) * 100}%` }}
                title="Trage ca să muți punctul; dublu-clic îl șterge"
                onPointerDown={(e) => startPoint(e, el, i, u, v)}
                onDoubleClick={(e) => { e.stopPropagation(); const d = deletePoint(el.path!, i); if (d) onPath?.(el.id, fitPath(d, el), true); }}
              />
            ))}
          </div>
        ))}
        {editing && grpBox && (
          <div className="sl-selbox sl-grpbox" style={{ left: grpBox.x, top: grpBox.y, width: grpBox.w, height: grpBox.h }}>
            {(['nw', 'ne', 'sw', 'se'] as const).map((m) => (
              <span key={m} className={`sl-handle ${m}`} title="Trage ca să mărești sau să micșorezi tot grupul (Shift: aceleași proporții)" onPointerDown={(e) => startGroupResize(e, m)} />
            ))}
          </div>
        )}
        {editing && userGuides && (['v', 'h'] as const).flatMap((dir) => userGuides[dir].map((p, i) => (
          <div key={dir + i} className={`sl-uguide ${dir}`} style={dir === 'v' ? { left: p } : { top: p }} />
        )))}
        {guides.x !== null && <div className="sl-guide v" style={{ left: guides.x }} />}
        {guides.y !== null && <div className="sl-guide h" style={{ top: guides.y }} />}
        {editing && (() => {
          // Cu o linie aleasă: punctele de conexiune ale formelor (mijlocul laturilor); cele de care e lipită linia sunt pline.
          const ln = slide.els.find((o) => o.id === selected);
          if (!ln || !isLine(ln)) return null;
          const on = (id: string, i: number) => (ln.stCxn?.id === id && ln.stCxn.idx === i) || (ln.endCxn?.id === id && ln.endCxn.idx === i);
          return slide.els.filter((o) => o.id !== ln.id && !isLine(o) && o.w > 0 && o.h > 0).flatMap((o) => sites(o).map((p, i) => (
            <span key={o.id + i} className={`sl-cxn ${on(o.id, i) ? 'on' : ''}`} style={{ left: p.x, top: p.y }} />
          )));
        })()}
      </div>
      {overlay}
    </div>
  );
}

/**
 * Clip video sau sunet. În editor și în prezentare are butoanele de redare (click pe el nu trece la slide-ul următor);
 * în miniaturi se vede doar primul cadru (sau difuzorul, la sunete).
 */
/** Cât din volum / vizibilitate are clipul la secunda t: crește în primele `fadeIn` secunde, scade în ultimele `fadeOut`. */
export function fadeLevel(t: number, dur: number, fadeIn?: number, fadeOut?: number): number {
  let k = 1;
  if (fadeIn) k = Math.min(k, t / fadeIn);
  if (fadeOut && Number.isFinite(dur) && dur > 0) k = Math.min(k, (dur - t) / fadeOut);
  return Math.max(0, Math.min(1, k));
}

function MediaView({ el, live, auto, delay, halt, quiet, show }: { el: SlideEl; live: boolean; auto: boolean; delay?: number; halt?: 'pause' | 'stop'; quiet?: boolean; show?: boolean }) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  // Pornește singur: când slide-ul (sau, cu animație, caseta) apare în prezentare; cu „Media: Redare”, la pasul lui (după întârzierea lui).
  useEffect(() => {
    if (!auto) return;
    const go = () => ref.current?.play().catch(() => { /* fără voie de redare: rămâne butonul Play */ });
    if (!delay) { go(); return; }
    const t = setTimeout(go, delay * 1000);
    return () => clearTimeout(t);
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps
  // „Media: Pauză” / „Media: Oprire” la pasul lor: clipul stă pe loc (Oprire: și se întoarce la începutul lui, decupat).
  useEffect(() => {
    if (!halt) return;
    const go = () => { const m = ref.current; if (!m) return; m.pause(); if (halt === 'stop') m.currentTime = el.trimA ?? 0; };
    if (!delay) { go(); return; }
    const t = setTimeout(go, delay * 1000);
    return () => clearTimeout(t);
  }, [halt]); // eslint-disable-line react-hooks/exhaustive-deps
  // Volumul ales și apariția / stingerea treptată (sunetul; la video și imaginea, doar în prezentare), pe fiecare cadru cât rulează.
  const fades = !!(el.fadeIn || el.fadeOut), trimmed = !!(el.trimA || el.trimB);
  // Decuparea: clipul pornește de la trimA și se oprește la trimB (sau o ia de la trimA, dacă se repetă).
  useEffect(() => {
    const m = ref.current;
    if (!m || !trimmed) return;
    const A = el.trimA ?? 0;
    const toStart = () => { if (m.currentTime < A - 0.05 || (el.trimB && m.currentTime >= el.trimB)) m.currentTime = A; };
    // Oprirea la sfârșitul decupat (și pe evenimentul timeupdate, care vine și când fereastra nu desenează cadre).
    const atEnd = () => { if (el.trimB && m.currentTime >= el.trimB && !m.paused) { if (el.loop) m.currentTime = A; else { m.pause(); m.currentTime = el.trimB; } } };
    m.addEventListener('loadedmetadata', toStart);
    m.addEventListener('play', toStart);
    m.addEventListener('timeupdate', atEnd);
    if (m.readyState >= 1) toStart();
    return () => { m.removeEventListener('loadedmetadata', toStart); m.removeEventListener('play', toStart); m.removeEventListener('timeupdate', atEnd); };
  }, [trimmed, el.trimA, el.trimB, el.loop]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const A = el.trimA ?? 0;
    const apply = () => {
      const end = el.trimB && m.duration ? Math.min(el.trimB, m.duration) : m.duration;
      if (el.trimB && m.currentTime >= el.trimB && !m.paused) {
        if (el.loop) m.currentTime = A; else { m.pause(); m.currentTime = el.trimB; }
      }
      // Repetarea clipului o ia de la 0: sare la începutul decupat.
      if (el.trimA && !m.paused && m.currentTime < A - 0.3) m.currentTime = A;
      const k = fades ? fadeLevel(m.currentTime - A, end - A, el.fadeIn, el.fadeOut) : 1;
      m.volume = Math.max(0, Math.min(1, (el.vol ?? 1) * k));
      if (isVideo(el)) m.style.opacity = show && fades ? String(k) : '';
    };
    apply();
    if (!playing || (!fades && !trimmed)) return;
    let raf = requestAnimationFrame(function tick() { apply(); raf = requestAnimationFrame(tick); });
    return () => cancelAnimationFrame(raf);
  }, [playing, fades, trimmed, el.vol, el.fadeIn, el.fadeOut, el.trimA, el.trimB, el.loop, show, el]);
  const events = { onPlay: () => setPlaying(true), onPause: () => setPlaying(false), onEnded: () => setPlaying(false) };
  if (isVideo(el)) {
    // În prezentare: „Pe tot ecranul” acoperă tot slide-ul cât rulează; „Ascuns cât nu rulează” îl arată doar atunci.
    // (La sunete, difuzorul ascuns nu se vede deloc în prezentare, dar sunetul merge.)
    const cls = 'sl-video' + (show && el.full && playing ? ' sl-video-full' : '') + (show && el.hideIdle && !playing ? ' sl-video-idle' : '');
    return <video ref={ref} className={cls} src={el.src} poster={el.poster} controls={live && !(show && el.full && playing)} loop={el.loop} muted={quiet || el.vol === 0} preload="metadata" playsInline onClick={live ? stop : undefined} title={el.text} data-bmk={el.bmk?.join(' ')} {...events} />;
  }
  return (
    <div className={'sl-audio' + (show && el.hideIdle ? ' sl-video-idle' : '')} title={el.text}>
      <span className="sl-audio-icon">🔊</span>
      {live ? <audio ref={ref} src={el.src} controls loop={el.loop} muted={quiet || el.vol === 0} preload="metadata" onClick={stop} data-bmk={el.bmk?.join(' ')} {...events} /> : <span className="sl-audio-name">{el.text}</span>}
    </div>
  );
}

/** Linia (cu săgeți la capete, dacă are): din colțul stânga-sus în cel dreapta-jos al casetei; oglindirea casetei o întoarce.
 *  O linie lată și transparentă de dedesubt o face ușor de prins cu mouse-ul, chiar dacă e subțire. */
function LineView({ el, theme }: { el: SlideEl; theme: Theme }) {
  const color = el.line ?? fillOf(el.fill, theme);
  const w = el.lineW ?? 3;
  // Vârful săgeții: lungimea crește cu grosimea liniei, ca în programele de prezentări.
  const a = Math.max(10, w * 3.2), hw = a * 0.55;
  const head = (x: number, y: number, dx: number, dy: number) =>
    `${x},${y} ${x - a * dx - hw * dy},${y - a * dy + hw * dx} ${x - a * dx + hw * dy},${y - a * dy - hw * dx}`;
  const atStart = el.ends === 'start' || el.ends === 'both', atEnd = el.ends === 'end' || el.ends === 'both';
  // Linia se oprește în spatele vârfului, ca să nu iasă pe lângă el. Traseul poate fi drept, frânt sau curbat (connectors.ts).
  const { d, da, db } = routeGeom(el.w, el.h, el.route, atStart ? a * 0.8 : 0, atEnd ? a * 0.8 : 0, el.axes, el.bend);
  return (
    <svg className="sl-line-svg" width={Math.max(1, el.w)} height={Math.max(1, el.h)} overflow="visible" aria-hidden="true">
      <path d={routeGeom(el.w, el.h, el.route, 0, 0, el.axes, el.bend).d} fill="none" stroke="transparent" strokeWidth={Math.max(16, w + 12)} pointerEvents="stroke" />
      <path className="sl-line-path" d={d} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dashArray(el.lineDash, w)} />
      {atEnd && <polygon points={head(el.w, el.h, db.x, db.y)} fill={color} />}
      {atStart && <polygon points={head(0, 0, -da.x, -da.y)} fill={color} />}
    </svg>
  );
}

/** Bara colorată a temei, mutată odată cu titlul pe formatele pătrat / vertical. */
function barStyle(layout: Slide['layout'], size: Size): React.CSSProperties | undefined {
  if (size.w === SLIDE_W && size.h === SLIDE_H) return undefined;
  const kx = size.w / SLIDE_W, ky = size.h / SLIDE_H;
  return layout === 'section' ? { left: 100 * kx, top: 460 * ky } : { left: 70 * kx, top: 156 * ky };
}

/** Forma: culoarea, colțurile și textul centrat, alb sau închis după cât de deschisă e culoarea. */
function shapeStyle(el: SlideEl, theme: Theme): React.CSSProperties {
  if (isLine(el)) return { background: 'transparent', padding: 0, overflow: 'visible' };
  const bg = fillOf(el.fill, theme);
  const line = el.line ? { color: el.line, w: el.lineW ?? 2, dash: dashArray(el.lineDash, el.lineW ?? 2) } : undefined;
  // Parantezele, acoladele și arcul: doar linia (conturul formei sau, fără contur, culoarea ei), textul în culoarea slide-ului.
  const open = el.shape ? OPEN_PATHS[el.shape] : undefined;
  // Desenul e strâns cu o grosime de linie, ca linia de pe marginea casetei să nu fie tăiată pe jumătate.
  const stroke = line ?? { color: bg, w: 2 };
  if (open) return { background: pathBackground(open, 'none', stroke).replace('100% 100%', `calc(100% - ${stroke.w}px) calc(100% - ${stroke.w}px)`), ...(Math.min(el.w, el.h) < 40 ? { padding: 0 } : {}) };
  const poly = el.shape ? POLYGONS[el.shape] : undefined;
  // O formă foarte subțire (linia de legătură dintr-o diagramă) nu are loc pentru marginea interioară a textului: fără ea, ar ieși mai groasă.
  if (Math.min(el.w, el.h) < 40) return { ...shapeLook(el, bg, line, poly), padding: 0 };
  return shapeLook(el, bg, line, poly);
}

function shapeLook(el: SlideEl, bg: string, line: { color: string; w: number; dash?: string } | undefined, poly: string | undefined): React.CSSProperties {
  // Transparența atinge doar umplerea; culoarea textului se alege tot după culoarea plină.
  const fill = shapeFillCss(bg, el.fill2, el.fillDir, el.transp, el.fillImg);
  // Formele libere, poligoanele cu contur și liniile linie-punct se desenează ca imagine SVG (clip-path ar tăia conturul).
  // Poza cu transparență tot ca SVG (în CSS doar culoarea ar deveni transparentă, nu și poza).
  if (el.path || (poly && line) || (line && el.lineDash === 'dashDot' && el.shape !== 'ellipse' && el.shape !== 'round') || (el.fillImg && el.transp)) {
    return { borderRadius: el.fillImg && !el.path && !poly ? (el.shape === 'ellipse' ? '50%' : el.shape === 'round' ? 24 : 0) : undefined, background: pathBackground(el.path ?? (poly ? polygonPath(poly) : 'M0 0 L1 0 L1 1 L0 1 Z'), withTransp(bg, el.transp), line, el.fill2 ? { b: withTransp(el.fill2, el.transp), dir: el.fillDir } : undefined, el.fillImg ? { src: el.fillImg, alpha: el.transp ? (100 - el.transp) / 100 : undefined } : undefined), color: textOn(bg) };
  }
  return { background: fill, color: textOn(bg), borderRadius: el.shape === 'ellipse' ? '50%' : el.shape === 'round' ? 24 : 0,
    ...(poly ? { clipPath: `polygon(${poly})` } : {}),
    ...(line ? { border: `${line.w}px ${el.lineDash === 'dot' ? 'dotted' : el.lineDash ? 'dashed' : 'solid'} ${line.color}` } : {}) };
}

/** Tabelul: capul în culoarea temei, rândurile la fel de înalte și liniile subțiri. În editor, fiecare celulă se scrie. */
function TableView({ el, theme, onCell, onPasteGrid, onColW, onRowH }: {
  el: SlideEl; theme: Theme;
  onCell?: (r: number, c: number, t: string) => void;
  onPasteGrid?: (r: number, c: number, t: string) => void;
  onColW?: (w: number[], first: boolean) => void;
  onRowH?: (h: number[], first: boolean) => void;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const fr = colFractions(el), hr = rowFractions(el);
  const merges = el.kind === 'table' ? cleanMerges(el.merge, el.cells?.length ?? 0, el.cells?.[0]?.length ?? 1) : undefined;
  // Laturile fără chenar (Chenare: doar conturul, fără chenare…).
  const noSides = (r: number, c: number): React.CSSProperties | undefined => {
    const pad = el.tpad ? { padding: `${padOf(el.tpad).v}px ${padOf(el.tpad).h}px` } : undefined;
    if (!el.tborder) return pad;
    const s = cellSides(el.tborder, merges, r, c, el.cells?.length ?? 0, el.cells?.[0]?.length ?? 1);
    const o: React.CSSProperties = { ...pad };
    if (!s[0]) o.borderTopStyle = 'none';
    if (!s[1]) o.borderRightStyle = 'none';
    if (!s[2]) o.borderBottomStyle = 'none';
    if (!s[3]) o.borderLeftStyle = 'none';
    return o;
  };
  // Marginea dintre coloana c și c+1, trasă cu mausul: coloana se lățește, vecina se îngustează (lățimea tabelului rămâne).
  // La fel marginea dintre rândurile r și r+1 (vert = true): rândul de sus se înalță, cel de jos scade.
  const startCol = (e: React.PointerEvent, c: number, vert = false) => {
    e.preventDefault(); e.stopPropagation();
    const r = tableRef.current?.getBoundingClientRect(), size = (vert ? r?.height : r?.width) || 1, p0 = vert ? e.clientY : e.clientX, w0 = vert ? hr : fr;
    let first = true;
    const onMove = (ev: PointerEvent) => { (vert ? onRowH : onColW)?.(dragColW(w0, c, ((vert ? ev.clientY : ev.clientX) - p0) / size), first); first = false; };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const cells = el.cells ?? [];
  // Culorile după stilul ales din galerie (vezi tableStyle.ts); aceleași și la exportul .pptx.
  const tc = tableColors(el.tstyle, theme, el.tcolor);
  const head: React.CSSProperties = { ...(tc.head.bg ? { background: tc.head.bg } : {}), color: tc.head.fg, ...(tc.head.line ? { borderBottom: `2px solid ${tc.head.line}` } : {}) };
  const look = tableLook(el);
  // Alinierea verticală a textului din celule (lipsă = la mijloc).
  const va = el.valign && el.kind === 'table' ? { verticalAlign: el.valign } as React.CSSProperties : undefined;
  // Tab / Shift+Tab trec la celula următoare / anterioară, ca în PowerPoint.
  const onKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab') return;
    const all = [...(e.currentTarget.closest('table')?.querySelectorAll<HTMLElement>('.sl-cell') ?? [])];
    const to = all[all.indexOf(e.currentTarget) + (e.shiftKey ? -1 : 1)];
    if (to) { e.preventDefault(); to.focus(); }
  };
  return (
    <>
    <table ref={tableRef} className="sl-table" style={{ background: tc.body, color: el.color ?? tc.fg, ['--sl-line' as string]: tc.fg, ['--sl-band' as string]: tc.band ?? 'transparent', ...(el.tlineW ? { ['--sl-tw' as string]: el.tlineW + 'px' } : {}), ...(el.tlineC ? { ['--sl-tc' as string]: el.tlineC } : {}) }}>
      {el.colW && <colgroup>{fr.map((w, c) => <col key={c} style={{ width: `${w * 100}%` }} />)}</colgroup>}
      <tbody>
        {cells.map((row, r) => (
          <tr key={r} style={el.rowH ? { height: hr[r] * el.h } : undefined} className={[r === 0 && look.head ? 'head' : '', look.band && (r - (look.head ? 1 : 0)) % 2 === 1 && !(look.last && r === cells.length - 1) ? 'band' : '', look.last && r === cells.length - 1 && r > 0 ? 'total' : ''].filter(Boolean).join(' ') || undefined}>
            {row.map((t, c) => isCovered(merges, r, c) ? null : (
              <td key={c} data-r={r} data-c={c} rowSpan={mergeAt(merges, r, c)?.[2]} colSpan={mergeAt(merges, r, c)?.[3]} style={{ ...(r === 0 && look.head ? head : {}), ...va, ...noSides(r, c), ...cellFmtCss(el.cfmt?.[r]?.[c]) }} className={look.first && c === 0 ? 'first' : undefined}>
                {onCell ? <EditableCell text={t} dir={el.tdir} onChange={(v) => onCell(r, c, v)} onKeyDown={onKey} onGrid={onPasteGrid && ((v) => onPasteGrid(r, c, v))} /> : <div className="sl-cell" style={dirStyle(el.tdir)}>{t}</div>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {onColW && fr.slice(0, -1).map((_, c) => (
      <div key={c} className="sl-colgrip" style={{ left: `${fr.slice(0, c + 1).reduce((a, v) => a + v, 0) * 100}%` }}
        onPointerDown={(e) => startCol(e, c)} title="Trage ca să schimbi lățimea coloanelor" aria-hidden="true" />
    ))}
    {onRowH && hr.slice(0, -1).map((_, r) => (
      <div key={'r' + r} className="sl-rowgrip" style={{ top: `${hr.slice(0, r + 1).reduce((a, v) => a + v, 0) * 100}%` }}
        onPointerDown={(e) => startCol(e, r, true)} title="Trage ca să schimbi înălțimea rândurilor" aria-hidden="true" />
    ))}
    </>
  );
}

/** Textul rotit din celule: 90° (citit de sus în jos) sau 270° (de jos în sus). */
const dirStyle = (d: SlideEl['tdir']): React.CSSProperties | undefined =>
  d === 'vert' ? { writingMode: 'vertical-rl' } : d === 'vert270' ? { writingMode: 'sideways-lr' as React.CSSProperties['writingMode'] } : undefined;

/** Celulă editabilă necontrolată (ca EditableText): textul se pune din afară doar când nu scrii în ea. */
function EditableCell({ text, dir, onChange, onKeyDown, onGrid }: {
  text: string; dir?: SlideEl['tdir']; onChange(t: string): void; onKeyDown(e: React.KeyboardEvent<HTMLElement>): void;
  /** Text lipit cu mai multe celule (Tab între coloane, rând nou între rânduri): se întinde peste celulele vecine. */
  onGrid?: (t: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const n = ref.current;
    if (n && document.activeElement !== n && textOf(n) !== text) n.innerText = text;
  });
  useEffect(() => { const n = ref.current; return n ? attachAutoCorrect(n) : undefined; });
  return (
    <div
      ref={ref}
      className="sl-cell sl-edit"
      style={dirStyle(dir)}
      contentEditable
      suppressContentEditableWarning
      lang="ro"
      onInput={(e) => onChange(textOf(e.currentTarget))}
      onKeyDown={onKeyDown}
      onPaste={(e) => {
        const t = e.clipboardData.getData('text/plain');
        e.preventDefault();
        e.stopPropagation();
        if (onGrid && /\t|\n./.test(t.replace(/\r/g, ''))) { e.currentTarget.blur(); onGrid(t); } else if (t) document.execCommand('insertText', false, t);
      }}
    />
  );
}

/** Textul dintre `from` și `to`, cu formatul pe bucăți (vezi marks.ts). */
function Runs({ text, from, to, marks }: { text: string; from: number; to: number; marks?: TextMark[] }) {
  if (!marks) return <>{text.slice(from, to)}</>;
  return <>{segments(text, from, to, marks).map((g, i) => (Object.keys(g.f).length ? <span key={i} style={markCss(g.f)}>{g.t}</span> : g.t))}</>;
}

function StaticText({ kind, text, list, start, marks: raw, pfmt, rows, paras }: { kind: ElKind; text: string; list?: ListStyle; start?: number; marks?: TextMark[]; pfmt?: (ParaFmt | null)[]; rows?: boolean;
  /** În prezentare, la caseta animată pe paragrafe: ce paragrafe sunt încă ascunse și când intră fiecare. */
  paras?: { el: SlideEl; hidden: Set<string>; times: Map<string, { at: number; dur: number }> } }) {
  const marks = cleanMarks(raw, text.length);
  if (kind !== 'body') {
    if (!pfmt && !rows) return <div className="sl-text"><Runs text={text} from={0} to={text.length} marks={marks} /></div>;
    // Rândurile cu alinierea / spațierea lor: câte un bloc pe rând.
    let at = 0;
    return <div className="sl-text">{text.split('\n').map((l, n) => { const from = at; at += l.length + 1; return <div key={n} style={paraCss(pfmt?.[n])}>{l ? <Runs text={text} from={from} to={from + l.length} marks={marks} /> : <br />}</div>; })}</div>;
  }
  // Fiecare rând își știe locul în text (pentru formatul pe bucăți); cele goale nu apar.
  let at = 0;
  const all = text.split('\n').map((l, n) => { const start = at + l.length - lineText(l).length; at += l.length + 1; return { l, start, n }; });
  const kept = all.filter(({ l }) => l.trim());
  const lines = kept.map(({ l }) => l);
  const levels = lines.map(lineLevel), nums = listNumbers(levels, start), numbered = isNumbered(list);
  const groups = paras ? paraGroups(text) : [];
  const paraKey = (i: number) => paras!.el.id + '#' + groups[i];
  const items = lines.map((l, i) => (
    <li key={i} data-lvl={levels[i] || undefined} value={numbered ? nums[i] : undefined}
      className={paras ? (paras.hidden.has(paraKey(i)) ? 'sl-para sl-hidden' : `sl-para sl-in-${paras.el.anim}`) : undefined}
      style={{ ...(numbered ? { listStyleType: numberType(list, levels[i]) } : {}), ...paraCss(pfmt?.[kept[i].n]), ...(paras && !paras.hidden.has(paraKey(i)) ? animStyle(paras.el, paras.times.get(paraKey(i))) : {}) }}><Runs text={text} from={kept[i].start} to={kept[i].start + lineText(l).length} marks={marks} /></li>
  ));
  return numbered
    ? <ol className="sl-text" type={olType(list)}>{items}</ol>
    : <ul className={`sl-text ${list === 'none' ? 'nobul' : ''}`}>{items}</ul>;
}

/** Alinierea și spațierea proprii ale unui paragraf din listă (peste cele ale casetei). */
// Centrat / la dreapta: bulina vine lângă text, ca în PowerPoint.
const paraCss = (p: ParaFmt | null | undefined): React.CSSProperties => ({ ...(p?.a ? { textAlign: p.a } : {}), ...(p?.a === 'center' || p?.a === 'right' ? { listStylePosition: 'inside' } : {}), ...(p?.sp ? { lineHeight: 1.25 * p.sp } : {}), ...(p?.b !== undefined ? { marginTop: gapPx(p.b) } : {}), ...(p?.af !== undefined ? { marginBottom: gapPx(p.af) } : {}) });
/** Blocurile de pe primul nivel al casetei editabile (fără textul gol dintre ele). */
const blocksOf = (n: HTMLElement) => [...n.childNodes].filter((c) => c.nodeType === 1 || c.textContent);
/** Rândurile din text ale unui bloc (un <br> din mijloc = încă un rând; cel de la sfârșit ține doar locul rândului gol). */
const rowsOf = (d: HTMLElement) => d.querySelectorAll('br').length - (d.lastChild?.nodeName === 'BR' ? 1 : 0) + 1;
/**
 * Formatul paragrafelor citit din punctele listei sau din rândurile casetei editabile (data-pa / data-sp), în ordinea rândurilor
 * din text. null = rândurile nu se pot potrivi cu textul (atunci rămâne formatul de dinainte).
 */
const pfmtOf = (n: HTMLElement, lines: number): (ParaFmt | null)[] | undefined | null => {
  const num = (v: string | undefined) => (v === undefined || v === '' ? undefined : Number(v));
  const fmt = (d: HTMLElement) => ({ a: d.dataset.pa, sp: Number(d.dataset.sp) || undefined, b: num(d.dataset.b), af: num(d.dataset.af) });
  const lis = [...n.children].filter((c): c is HTMLLIElement => c.localName === 'li');
  if (lis.length && lis.length === n.children.length) return cleanPfmt(lis.map(fmt), lines);
  const kids = blocksOf(n);
  if (!kids.length || !kids.every((c) => c.nodeName === 'DIV')) return n.querySelector('[data-pa], [data-sp], [data-b], [data-af]') ? null : undefined;
  const rows = (kids as HTMLElement[]).flatMap((d) => Array.from({ length: rowsOf(d) }, () => fmt(d)));
  return rows.length === lines ? cleanPfmt(rows, lines) : null;
};
/** Pune pe rândurile casetei simple alinierea și spațierea din data-pa / data-sp. */
function paint(n: HTMLElement) {
  for (const d of n.children) if (d instanceof HTMLDivElement) {
    d.style.textAlign = d.dataset.pa ?? '';
    d.style.lineHeight = Number(d.dataset.sp) ? String(1.25 * Number(d.dataset.sp)) : '';
    gapStyle(d);
  }
}
const gapAttrs = (p: ParaFmt | null | undefined) => (p?.b !== undefined ? ` data-b="${p.b}"` : '') + (p?.af !== undefined ? ` data-af="${p.af}"` : '');
/** Spațierea înainte / după paragraf a unui rând sau punct, din data-b / data-af (în puncte). */
function gapStyle(d: HTMLElement) {
  d.style.marginTop = d.dataset.b ? gapPx(Number(d.dataset.b)) + 'px' : '';
  d.style.marginBottom = d.dataset.af ? gapPx(Number(d.dataset.af)) + 'px' : '';
}
/** Cursorul în blocul `d`, după `col` litere. */
function placeCaret(d: HTMLElement | undefined, col: number) {
  const sel = window.getSelection();
  if (!d || !sel) return;
  const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  r.setStart(d, 0);
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    if (col <= t.data.length) { r.setStart(t, Math.max(0, col)); break; }
    col -= t.data.length;
    r.setStart(t, t.data.length);
  }
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}
/**
 * Paragrafele (punctele listei sau rândurile casetei) atinse de cursorul / selecția `r` din caseta editabilă `n`. Caseta simplă
 * se rescrie întâi câte un bloc pe rând (cu formatul pe bucăți și cu cursorul la locul lui), ca fiecare rând să-și țină alinierea.
 */
export function paraBlocks(n: HTMLElement, r: Range): HTMLElement[] {
  const blocks = () => [...n.children] as HTMLElement[];
  if (n.matches('ul.sl-edit, ol.sl-edit')) return blocks().every((b) => b.localName === 'li') ? blocks().filter((b) => r.intersectsNode(b)) : [];
  const kids = blocksOf(n);
  if (kids.length && kids.every((c) => c.nodeName === 'DIV' && rowsOf(c as HTMLElement) === 1)) return blocks().filter((b) => r.intersectsNode(b));
  // Două semne puse la capetele selecției arată pe ce rânduri e ea în textul simplu; apoi se scot.
  const A = String.fromCharCode(0xe000), B = String.fromCharCode(0xe001);
  const a = document.createTextNode(A), b = document.createTextNode(B);
  const end = r.cloneRange(); end.collapse(false); end.insertNode(b);
  const start = r.cloneRange(); start.collapse(true); start.insertNode(a);
  const marked = plainOf(n);
  a.remove(); b.remove(); n.normalize();
  const text = plainOf(n), marks = marksFromDom(n, text);
  const s = Math.max(0, marked.indexOf(A)), e = Math.max(s, marked.split(A).join('').indexOf(B));
  let at = 0;
  n.innerHTML = text.split('\n').map((l) => { const from = at; at += l.length + 1; return `<div>${marksHtml(text, from, from + l.length, marks) || '<br>'}</div>`; }).join('');
  const lineOf = (x: number) => text.slice(0, x).split('\n').length - 1;
  placeCaret(blocks()[lineOf(s)], s - (text.lastIndexOf('\n', s - 1) + 1));
  return blocks().slice(lineOf(s), lineOf(e) + 1);
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plainOf = (n: HTMLElement) => n.innerText.replace(/\n+$/, '').replace(/ /g, ' ');

/** Textul unei casete: la liste, fiecare punct e un rând (cu câte un tab în față pentru fiecare nivel). */
const textOf = (n: HTMLElement) => {
  const lis = [...n.children].filter((c): c is HTMLLIElement => c.localName === 'li');
  if (!lis.length || lis.length !== n.children.length) return plainOf(n);
  return lis.map((li) => '\t'.repeat(Number(li.dataset.lvl) || 0) + plainOf(li)).join('\n');
};
/** Atributul type al listei (pentru cititoarele de ecran și copiere); numerele se desenează din list-style-type. */
const olType = (list: ListStyle | undefined) => (list === 'alpha' ? 'a' : list === 'upper' ? 'A' : list === 'roman' ? 'I' : '1') as '1' | 'a' | 'A' | 'I';
/** Pune pe punctele unei liste editabile retragerea și numerele după nivel (Enter copiază nivelul punctului pe cel nou). */
function decorate(n: HTMLElement, list: ListStyle | undefined, start?: number) {
  const lis = [...n.children].filter((c): c is HTMLLIElement => c.localName === 'li');
  const numbered = isNumbered(list);
  const levels = lis.map((li) => Math.min(MAX_LEVEL, Number(li.dataset.lvl) || 0)), nums = listNumbers(levels, start);
  lis.forEach((li, i) => {
    if (levels[i]) li.dataset.lvl = String(levels[i]); else delete li.dataset.lvl;
    if (numbered) li.value = nums[i]; else li.removeAttribute('value');
    li.style.listStyleType = numbered ? numberType(list, levels[i]) : '';
    li.style.textAlign = li.dataset.pa ?? '';
    li.style.listStylePosition = li.dataset.pa === 'center' || li.dataset.pa === 'right' ? 'inside' : '';
    li.style.lineHeight = Number(li.dataset.sp) ? String(1.25 * Number(li.dataset.sp)) : '';
    gapStyle(li);
  });
}
/** Cursorul la sfârșitul elementului dat. */
function caretIn(x: HTMLElement | null) {
  const sel = window.getSelection();
  if (!x || !sel) return;
  const r = document.createRange();
  r.selectNodeContents(x);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}
/** Punctele (indicii lor) atinse de selecția din lista editabilă `n`; toate, dacă selecția nu e în ea. */
function selectedItems(n: HTMLElement): number[] {
  const lis = [...n.children];
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !n.contains(sel.anchorNode)) return lis.map((_, i) => i);
  const r = sel.getRangeAt(0);
  const out = lis.map((li, i) => (r.intersectsNode(li) ? i : -1)).filter((i) => i >= 0);
  return out.length ? out : lis.map((_, i) => i);
}
/**
 * Mărește (+1) / micșorează (−1) nivelul punctelor selectate dintr-o listă editabilă, ca Tab / Shift+Tab din PowerPoint.
 * Întoarce false dacă `n` nu e o listă editabilă. Textul nou ajunge la editor prin evenimentul `input`.
 */
export function shiftListLevel(n: Element | null, by: number): boolean {
  if (!(n instanceof HTMLElement) || !n.matches('ul.sl-edit, ol.sl-edit')) return false;
  // Text scris în afara punctelor (de exemplu după ce s-a șters tot): întâi îl facem puncte, cu cursorul la sfârșit.
  if ([...n.childNodes].some((c) => c.nodeName !== 'LI' && (c.nodeType === 1 || c.textContent?.trim()))) {
    n.innerHTML = plainOf(n).split('\n').map((l) => `<li>${esc(l) || '<br>'}</li>`).join('');
    caretIn(n.lastElementChild as HTMLElement);
  }
  const lis = [...n.children] as HTMLElement[];
  for (const i of selectedItems(n)) {
    const li = lis[i];
    if (li?.localName === 'li') li.dataset.lvl = String(Math.max(0, Math.min(MAX_LEVEL, (Number(li.dataset.lvl) || 0) + by)));
  }
  n.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/**
 * Casetă editabilă „necontrolată”: React nu-i rescrie conținutul cât scrii în ea (altfel cursorul ar sări);
 * textul se pune din afară doar când caseta nu e activă (deschidere de fișier, Anulează).
 * Listele sunt un <ul> editabil: Enter face singur un punct nou.
 */
function EditableText({ el, onChange }: { el: SlideEl; onChange(t: string, marks?: TextMark[], pfmt?: (ParaFmt | null)[] | null): void }) {
  const ref = useRef<HTMLElement>(null);
  // AutoCorect cât scrii (elementul se poate schimba odată cu felul listei, deci se leagă din nou la fiecare desenare).
  useEffect(() => { const n = ref.current; return n ? attachAutoCorrect(n) : undefined; });
  const bullets = el.kind === 'body';
  const fill = (n: HTMLElement, text: string, marks = cleanMarks(el.marks, text.length)) => {
    if (bullets) {
      let at = 0;
      n.innerHTML = (text ? text.split('\n') : ['']).map((l, i) => {
        const start = at + l.length - lineText(l).length, p = el.pfmt?.[i];
        at += l.length + 1;
        return `<li${lineLevel(l) ? ` data-lvl="${lineLevel(l)}"` : ''}${p?.a ? ` data-pa="${p.a}"` : ''}${p?.sp ? ` data-sp="${p.sp}"` : ''}${gapAttrs(p)}>${marksHtml(text, start, start + lineText(l).length, marks) || '<br>'}</li>`;
      }).join('');
      decorate(n, el.list, el.listStart);
    } else if (el.pfmt || el.spb || el.spa) {
      // Rândurile cu alinierea / spațierea lor (sau cu spațiere înainte / după paragraf): câte un bloc pe rând.
      let at = 0;
      n.innerHTML = text.split('\n').map((l, i) => {
        const from = at, p = el.pfmt?.[i];
        at += l.length + 1;
        return `<div${p?.a ? ` data-pa="${p.a}"` : ''}${p?.sp ? ` data-sp="${p.sp}"` : ''}${gapAttrs(p)}>${marksHtml(text, from, from + l.length, marks) || '<br>'}</div>`;
      }).join('');
      paint(n);
    } else if (marks) n.innerHTML = text.split('\n').map((_, i, a) => {
      const start = a.slice(0, i).reduce((s, x) => s + x.length + 1, 0);
      return marksHtml(text, start, start + a[i].length, marks);
    }).join('<br>');
    else n.innerText = text;
  };
  // Textul și formatul pe bucăți se rescriu din afară doar când caseta nu e activă (altfel cursorul ar sări).
  const marksKey = JSON.stringify([el.marks ?? null, el.pfmt ?? null, !!(el.spb || el.spa)]);
  const shown = useRef(marksKey);
  useLayoutEffect(() => {
    const n = ref.current;
    if (n && document.activeElement !== n && (textOf(n) !== el.text || shown.current !== marksKey)) { fill(n, el.text); shown.current = marksKey; }
  });
  // „Începe de la” schimbat din bară: numerele punctelor se pun din nou, fără să rescrie textul.
  useLayoutEffect(() => { if (bullets && ref.current) decorate(ref.current, el.list, el.listStart); }, [bullets, el.list, el.listStart]);
  const props = {
    ref: ref as never,
    className: `sl-text sl-edit ${el.text ? '' : 'empty'}`,
    contentEditable: true,
    suppressContentEditableWarning: true,
    lang: el.lang && el.lang !== 'none' ? el.lang : 'ro',
    ...(el.lang === 'none' ? { spellCheck: false } : {}),
    'data-ph': PLACEHOLDER[el.kind],
    onInput: (e: React.FormEvent<HTMLElement>) => {
      const n = e.currentTarget;
      if (bullets) decorate(n, el.list, el.listStart); else paint(n);
      const t = textOf(n), m = marksFromDom(n, t), p = pfmtOf(n, t.split('\n').length);
      shown.current = JSON.stringify([m ?? null, p ?? null]);
      onChange(t, m, p);
    },
    // Tab / Shift+Tab (sau Alt+Shift+→ / ←) mută punctele selectate cu un nivel, ca în PowerPoint.
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (!bullets) return;
      const by = e.key === 'Tab' && !e.ctrlKey && !e.altKey ? (e.shiftKey ? -1 : 1)
        : e.altKey && e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') ? (e.key === 'ArrowRight' ? 1 : -1) : 0;
      if (by && shiftListLevel(e.currentTarget, by)) { e.preventDefault(); e.stopPropagation(); }
    },
    // Lipirea aduce doar textul (fără fonturi și culori străine de temă).
    onPaste: (e: React.ClipboardEvent) => {
      const t = e.clipboardData.getData('text/plain');
      // O poză lipită nu intră în text: merge mai departe, la slide (se pune ca imagine).
      if (!t) { e.preventDefault(); return; }
      e.preventDefault();
      e.stopPropagation();
      document.execCommand('insertText', false, t);
    },
    // O listă goală primește un punct gol, ca textul scris să intre în el (și să poată avea nivel).
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const n = e.currentTarget;
      if (bullets && !n.children.length && !n.textContent) { n.innerHTML = '<li><br></li>'; caretIn(n.firstElementChild as HTMLElement); }
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => { const n = e.currentTarget; if (bullets && !n.querySelector('li')) fill(n, textOf(n)); },
  };
  if (!bullets) return <div {...props} />;
  // Lista numerotată e un <ol> (React o pune din nou când se schimbă felul listei, iar textul se rescrie mai sus).
  if (isNumbered(el.list)) return <ol key={el.list} {...props} type={olType(el.list)} />;
  return <ul key="ul" {...props} className={`${props.className} ${el.list === 'none' ? 'nobul' : ''}`} />;
}
