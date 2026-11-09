// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Imagine în document: se selectează cu click, se redimensionează din colțuri,
// se aliniază sau se pune cu textul în jur, se mută prin tragere și se șterge.
// Legenda („Figura 1. …”) face parte din imagine, deci nu se poate despărți de ea pe altă pagină (plângere frecventă la Word).
import { artisticImage, correctImage, PIC_CORRECTIONS } from './picFx';
import { NOBG_LEVELS, nobgTol, removeBackground } from '../images/noBackground';
import NoBgMarkDialog from '../images/NoBgMarkDialog';
import { ART_FX } from '../slides/artistic';
import { compressDocImages, COMPRESS_PPI } from './compress';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { RGroup } from '../ribbon/Ribbon';
import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps, Editor } from '@tiptap/react';
import './image.css';
import { parseWordArt, renderWordArt, WORDART_FONTS, WORDART_GLOWS, WORDART_LINES, WORDART_MAX, WORDART_STYLES, WordArtSpec } from './wordArt';
import { CHART_KINDS, chartAlt, chartToPng, DocChart, parseChart } from './chart';
import ChartDialog from './ChartDialog';
import { DOC_DIAGRAMS, diagramAlt, diagramToPng, DocDiagram, DocDiagramKind, parseDiagram } from './diagram';
import DiagramDialog from './DiagramDialog';
import { equationAlt, equationSvg, equationToPng, DocEquation, parseEquation } from './equation';
import EquationDialog from './EquationDialog';
import Model3DDialog, { type Model3DSource } from '../Model3DDialog';
import { cleanM3d, keepModel, keptModel } from '../model3d';
import type { ChartType } from '../sheets/chartSvg';
import { iconById, iconPng, IconSpec, parseIconSpec } from '../icons/iconLib';
import { IconColor, IconStroke } from '../icons/IconRecolor';
import { parseShape, SHAPE_FX, type ShapeFx, shapeSize, shapeToPng, ShapeSpec } from './shapes';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import { clampOffset, isFloating, pointOnGlyph, reorderZ, zIndexOf, ZMove } from './floating';
import { addOp, applyOps, clampInsets, cropImage, ImageOp, Insets, PICTURE_STYLES, PictureStyle, styleImage, transformImage } from './imageTransform';

export type ImageAlign = 'left' | 'center' | 'right' | 'wrapLeft' | 'wrapRight' | 'front' | 'behind';
const ALIGNS: ImageAlign[] = ['left', 'center', 'right', 'wrapLeft', 'wrapRight', 'front', 'behind'];
const MIN_WIDTH = 40;

export const DocImage = Image.extend({
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = parseInt(el.getAttribute('width') || el.style.width || '', 10);
          return Number.isFinite(w) && w > 0 ? w : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      align: {
        default: 'center',
        parseHTML: (el) => {
          const a = el.getAttribute('data-align') as ImageAlign | null;
          return a && ALIGNS.includes(a) ? a : 'center';
        },
        renderHTML: (attrs) => ({ 'data-align': attrs.align }),
      },
      caption: {
        default: '',
        parseHTML: (el) => (el.getAttribute('data-caption') ?? '').slice(0, 300),
        renderHTML: (attrs) => (attrs.caption ? { 'data-caption': attrs.caption } : {}),
      },
      // Formele (shapes.ts): descrierea lor rămâne pe imagine, ca să poată fi recolorate.
      shape: {
        default: null,
        parseHTML: (el) => { const s = parseShape(el.getAttribute('data-shape')); return s ? JSON.stringify(s) : null; },
        renderHTML: (attrs) => (attrs.shape ? { 'data-shape': attrs.shape } : {}),
      },
      // Pictogramele (icons/iconLib.ts): pictograma, culoarea și grosimea liniei, ca să poată fi recolorate.
      icon: {
        default: null,
        parseHTML: (el) => { const s = parseIconSpec(el.getAttribute('data-icon')); return s ? JSON.stringify(s) : null; },
        renderHTML: (attrs) => (attrs.icon ? { 'data-icon': attrs.icon } : {}),
      },
      // Textul artistic (wordArt.ts): textul și stilul, ca să poată fi schimbate.
      wordart: {
        default: null,
        parseHTML: (el) => { const s = parseWordArt(el.getAttribute('data-wordart')); return s ? JSON.stringify(s) : null; },
        renderHTML: (attrs) => (attrs.wordart ? { 'data-wordart': attrs.wordart } : {}),
      },
      // Graficele (chart.ts): felul, titlul și datele, ca să poată fi schimbate și redesenate.
      chart: {
        default: null,
        parseHTML: (el) => { const c = parseChart(el.getAttribute('data-chart')); return c ? JSON.stringify(c) : null; },
        renderHTML: (attrs) => (attrs.chart ? { 'data-chart': attrs.chart } : {}),
      },
      // Diagramele (diagram.ts): felul, elementele și culoarea.
      diagram: {
        default: null,
        parseHTML: (el) => { const d = parseDiagram(el.getAttribute('data-diagram')); return d ? JSON.stringify(d) : null; },
        renderHTML: (attrs) => (attrs.diagram ? { 'data-diagram': attrs.diagram } : {}),
      },
      // Ecuațiile (equation.ts): textul ecuației, ca să poată fi schimbată și redesenată.
      equation: {
        default: null,
        parseHTML: (el) => { const e = parseEquation(el.getAttribute('data-equation')); return e ? JSON.stringify(e) : null; },
        renderHTML: (attrs) => (attrs.equation ? { 'data-equation': attrs.equation } : {}),
      },
      // Modelele 3D (model3d.ts): fișierul modelului și unghiul, ca modelul să poată fi rotit din nou.
      model3d: {
        default: null,
        parseHTML: (el) => { try { const k = cleanM3d(JSON.parse(el.getAttribute('data-model3d') ?? 'null')); return k ? JSON.stringify(k) : null; } catch { return null; } },
        renderHTML: (attrs) => (attrs.model3d ? { 'data-model3d': attrs.model3d } : {}),
      },
      // „În fața / în spatele textului”: deplasarea față de locul imaginii (px) și ordinea între imagini (floating.ts).
      dx: { default: 0, parseHTML: (el) => clampOffset(el.getAttribute('data-dx')), renderHTML: (a) => (a.dx ? { 'data-dx': a.dx } : {}) },
      dy: { default: 0, parseHTML: (el) => clampOffset(el.getAttribute('data-dy')), renderHTML: (a) => (a.dy ? { 'data-dy': a.dy } : {}) },
      z: { default: 0, parseHTML: (el) => Math.max(0, Math.min(9999, parseInt(el.getAttribute('data-z') || '0', 10) || 0)), renderHTML: (a) => (a.z ? { 'data-z': a.z } : {}) },
    };
  },

  // O imagine din spatele textului se alege cu clic pe un loc fără litere de deasupra ei.
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        handleDOMEvents: {
          mousedown: (view, e) => {
            if (!view.editable || e.button !== 0) return false;
            const hit = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.matches('.doc-image.align-behind > img'));
            const wrap = hit?.parentElement;
            if (!wrap || (e.target as HTMLElement).closest('.doc-image') || pointOnGlyph(e.clientX, e.clientY)) return false;
            let found = -1;
            view.state.doc.descendants((n, p) => { if (found < 0 && n.type.name === 'image' && view.nodeDOM(p) === wrap) found = p; return found < 0; });
            if (found < 0) return false;
            e.preventDefault();
            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, found)));
            view.focus();
            return true;
          },
        },
      },
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
}).configure({ allowBase64: true });

// Fila contextuală Imagine din panglica Docs: bara imaginii alese se desenează acolo (portal), nu sub poză.
// Fiecare editor are locul lui (mai multe documente în taburi); fără panglică (de exemplu la tipărire) bara rămâne sub poză.
const slots = new Map<Editor, HTMLElement>();
const slotSubs = new Set<() => void>();
const slotChanged = () => slotSubs.forEach((f) => f());
function useImageSlot(editor: Editor): HTMLElement | null {
  return useSyncExternalStore((f) => { slotSubs.add(f); return () => { slotSubs.delete(f); }; }, () => slots.get(editor) ?? null);
}
/** Locul din fila Imagine a panglicii unde intră bara imaginii alese. */
export function ImageRibbonSlot({ editor }: { editor: Editor }) {
  return (
    <div className="ribbon-slot img-ribbon-slot" ref={(el) => {
      if (el) { if (slots.get(editor) !== el) { slots.set(editor, el); slotChanged(); } }
      else if (slots.has(editor)) { slots.delete(editor); slotChanged(); }
    }} />
  );
}

function ImageView({ node, updateAttributes, deleteNode, selected, editor, getPos }: NodeViewProps) {
  const slot = useImageSlot(editor);
  const img = useRef<HTMLImageElement>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const width: number | null = liveWidth ?? node.attrs.width;
  const align: ImageAlign = node.attrs.align ?? 'center';
  const caption: string = node.attrs.caption ?? '';
  const floating = isFloating(align);
  // Mutarea liberă (doar „în fața / în spatele textului”): deplasarea de acum, cât timp se trage.
  const [liveOff, setLiveOff] = useState<{ dx: number; dy: number } | null>(null);
  const dx: number = liveOff?.dx ?? (Number(node.attrs.dx) || 0);
  const dy: number = liveOff?.dy ?? (Number(node.attrs.dy) || 0);
  const startMove = (e: React.PointerEvent) => {
    if (!floating || !editor.isEditable || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    select();
    const x0 = e.clientX, y0 = e.clientY, sx = Number(node.attrs.dx) || 0, sy = Number(node.attrs.dy) || 0;
    // La zoom, deplasarea pe ecran e mai mare sau mai mică decât în pagină.
    const page = (editor.view.dom as HTMLElement).closest('.page') as HTMLElement | null;
    const k = Number(page?.style.zoom) || 1;
    let cur = { dx: sx, dy: sy };
    const mv = (ev: PointerEvent) => { cur = { dx: clampOffset(sx + (ev.clientX - x0) / k), dy: clampOffset(sy + (ev.clientY - y0) / k) }; setLiveOff(cur); };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      setLiveOff(null);
      if (cur.dx !== sx || cur.dy !== sy) updateAttributes(cur);
      select();
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  // Poziția exactă (Aranjare → Poziție): în .docx dx e față de marginea din stânga a coloanei, dy față de paragraf.
  // Aliniată la margini: stânga = 0, centru / dreapta după lățimea coloanei și a pozei (aceleași unități ca marginLeft).
  const place = (h: 'left' | 'center' | 'right') => {
    const dom = editor.view.dom as HTMLElement;
    const cs = getComputedStyle(dom);
    const col = dom.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const w = img.current?.offsetWidth ?? 0;
    updateAttributes({ dx: clampOffset(h === 'left' ? 0 : h === 'center' ? (col - w) / 2 : col - w) });
  };
  const setPos = (axis: 'dx' | 'dy', cm: number) => { if (Number.isFinite(cm)) updateAttributes({ [axis]: clampOffset(cmToPx(cm)) }); };
  // Ordinea între imaginile din același grup (față / spate): z nou pentru toate, într-o singură modificare (un singur Ctrl+Z).
  const order = (how: ZMove) => {
    const pos = getPos();
    if (typeof pos !== 'number' || !floating) return;
    const group: { p: number; z: number }[] = [];
    editor.state.doc.descendants((n, p) => { if (n.type.name === 'image' && n.attrs.align === align) group.push({ p, z: Number(n.attrs.z) || 0 }); return true; });
    const zs = reorderZ(group.map((g) => g.z), group.findIndex((g) => g.p === pos), how);
    const tr = editor.state.tr;
    group.forEach((g, i) => { if (zs[i] !== g.z) tr.setNodeAttribute(g.p, 'z', zs[i]); });
    if (tr.docChanged) editor.view.dispatch(tr);
    select();
  };
  const [editCaption, setEditCaption] = useState(false);
  const [editAlt, setEditAlt] = useState(false);
  const shape = parseShape(node.attrs.shape);
  // Recolorarea unei forme: desenul se face din nou, cu aceeași mărime de bază.
  const recolor = async (patch: Partial<ShapeSpec>) => {
    if (!shape) return;
    const next = { ...shape, ...patch };
    const { w, h } = shapeSize(next.k);
    updateAttributes({ src: await applyOps(await shapeToPng(next, w, h), next.t ?? ''), shape: JSON.stringify(next) });
  };
  // Recolorarea unei pictograme: desenată din nou din bibliotecă, cu rotirile făcute până acum.
  const icon = parseIconSpec(node.attrs.icon);
  const recolorIcon = async (patch: Partial<IconSpec>) => {
    const ic = icon && iconById(icon.id);
    if (!icon || !ic) return;
    const next = { ...icon, ...patch };
    const src = await imageForDoc(new File([await iconPng(ic, next.c, next.s)], ic.name + '.png', { type: 'image/png' }));
    updateAttributes({ src: await applyOps(src, next.t ?? ''), icon: JSON.stringify(next) });
  };
  // Decuparea: marginile tăiate se trag cu mouse-ul pe chenarul de peste poză; ✓ taie poza, ✕ renunță.
  const [crop, setCrop] = useState<Insets | null>(null);
  const startCrop = (e: React.PointerEvent, h: string) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = (e.currentTarget as HTMLElement).closest('.crop-layer') as HTMLElement | null;
    if (!layer || !crop) return;
    const R = layer.getBoundingClientRect();
    const x0 = e.clientX, y0 = e.clientY, start = crop;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / R.width, dy = (ev.clientY - y0) / R.height;
      const n = { ...start };
      if (h.includes('w')) n.l = start.l + dx;
      if (h.includes('e')) n.r = start.r - dx;
      if (h.includes('n')) n.t = start.t + dy;
      if (h.includes('s')) n.b = start.b - dy;
      setCrop(clampInsets(n));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const applyCrop = async () => {
    if (!crop) return;
    const c = clampInsets(crop);
    setCrop(null);
    if (c.l + c.t + c.r + c.b < 0.001) return;
    const res = await cropImage(node.attrs.src, c);
    const w: number | null = node.attrs.width ? Math.max(MIN_WIDTH, Math.round(node.attrs.width * (1 - c.l - c.r))) : null;
    // O formă decupată devine poză obișnuită: redesenarea după recolorare ar pierde tăietura.
    updateAttributes({ src: res.src, width: w, shape: null, icon: null, chart: null, diagram: null, equation: null });
    select();
  };
  // Enter taie, Esc renunță (prinse înaintea editorului, ca Enter să nu înlocuiască poza cu un rând nou).
  useEffect(() => {
    if (!crop) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void applyCrop(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setCrop(null); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });
  const chart = parseChart(node.attrs.chart);
  const [editChart, setEditChart] = useState(false);
  const redraw = async (c: DocChart) => { updateAttributes({ src: await chartToPng(c), chart: JSON.stringify(c), alt: chartAlt(c) }); };
  const diagram = parseDiagram(node.attrs.diagram);
  const [editDiagram, setEditDiagram] = useState(false);
  const redrawDiagram = async (d: DocDiagram) => { updateAttributes({ src: await diagramToPng(d), diagram: JSON.stringify(d), alt: diagramAlt(d) }); };
  const equation = parseEquation(node.attrs.equation);
  const [editEquation, setEditEquation] = useState(false);
  const redrawEquation = async (e: DocEquation) => {
    const res = await equationToPng(e);
    // Lățimea se păstrează în aceeași proporție față de desenul nou (dacă ecuația a fost mărită sau micșorată).
    const old = parseEquation(node.attrs.equation), oldW = old ? equationSvg(old).w : res.w;
    const w = node.attrs.width && oldW ? Math.min(pageWidth(), Math.round((node.attrs.width * res.w) / oldW)) : res.w;
    updateAttributes({ src: res.src, width: w, equation: JSON.stringify(e), alt: equationAlt(e) });
  };
  const model3d = (() => { try { const k = cleanM3d(JSON.parse(node.attrs.model3d ?? 'null')); return k ? keptModel(k) : null; } catch { return null; } })();
  const [editModel, setEditModel] = useState(false);
  const redrawModel = async (blob: Blob, src: Model3DSource) => {
    const keep = keepModel(src.name, src.data, src.view);
    updateAttributes({ src: await imageForDoc(new File([blob], 'model.png', { type: 'image/png' })), shape: null, icon: null, chart: null, diagram: null, equation: null, wordart: null, model3d: keep ? JSON.stringify(keep) : null });
  };
  const wordart = parseWordArt(node.attrs.wordart);
  const rewrite = (patch: Partial<WordArtSpec>) => {
    if (!wordart) return;
    const next = parseWordArt({ ...wordart, ...patch });
    if (!next || JSON.stringify(next) === JSON.stringify(wordart)) return;
    const res = renderWordArt(next);
    updateAttributes({ src: res.src, width: Math.min(pageWidth(), res.width), alt: next.text, wordart: JSON.stringify(next) });
  };
  // Stilul de poză: ramă, umbră, colțuri rotunjite… Poza însăși rămâne la aceeași mărime pe pagină (rama și umbra se adaugă în jur).
  const applyStyle = async (style: PictureStyle, border?: { color: string; px: number }) => {
    const res = await styleImage(node.attrs.src, style, border && { ...border, shownW: node.attrs.width ?? undefined });
    const inner = res.w - 2 * res.pad;
    const w: number | null = node.attrs.width ? Math.round(Math.min(pageWidth(), (node.attrs.width * res.w) / inner)) : null;
    updateAttributes({ src: res.src, width: w, shape: null, icon: null, chart: null, diagram: null, equation: null });
  };
  // Corecții (claritate, lumină, culoare) și efecte artistice: pe pixelii pozei, la aceeași mărime; Ctrl+Z le anulează.
  // „Elimină fundalul”: culoarea de pe marginile pozei devine transparentă (images/noBackground.ts); Ctrl+Z îl pune înapoi.
  const [nobgMark, setNobgMark] = useState(false);
  const picFx = async (kind: 'corr' | 'art' | 'nobg', key: string) => {
    if (kind === 'nobg' && key === 'mark') { setNobgMark(true); return; }
    try {
      const src = kind === 'art' ? await artisticImage(node.attrs.src, key) : kind === 'nobg' ? await removeBackground(node.attrs.src, nobgTol(key) ?? 18) : await correctImage(node.attrs.src, key);
      updateAttributes({ src, shape: null, icon: null, chart: null, diagram: null, equation: null, wordart: null });
    } catch (e) { alert(kind === 'nobg' && e instanceof Error ? e.message : `Poza nu s-a putut schimba: ${e instanceof Error ? e.message : String(e)}`); }
  };
  // Comprimare imagini: poza aceasta sau toate pozele din document, la rezoluția aleasă; rezultatul se vede câteva secunde sub poză.
  const [note, setNote] = useState('');
  const compress = async (all: boolean, ppi: number) => {
    const pos = getPos();
    try {
      const r = await compressDocImages(editor, ppi, all || typeof pos !== 'number' ? undefined : pos);
      setNote(r.count ? `Comprimate: ${r.count} (−${Math.max(1, Math.round(r.saved / 1024))} KB)` : 'Pozele sunt deja destul de mici.');
    } catch (e) { setNote(`Poza nu s-a putut comprima: ${e instanceof Error ? e.message : String(e)}`); }
    window.setTimeout(() => setNote(''), 5000);
  };
  // Rotire / oglindire: poza se redesenează; la rotire lățimea nouă = înălțimea de dinainte, ca imaginea să rămână la fel de mare.
  const turn = async (op: ImageOp) => {
    const res = await transformImage(node.attrs.src, op);
    let w: number | null = node.attrs.width;
    if (w && (op === 'r' || op === 'l')) w = Math.round(Math.min(pageWidth(), Math.max(MIN_WIDTH, (w * res.w) / res.h)));
    updateAttributes({ src: res.src, width: w, chart: null, diagram: null, equation: null, shape: shape ? JSON.stringify({ ...shape, t: addOp(shape.t ?? '', op) }) : node.attrs.shape,
      icon: icon ? JSON.stringify({ ...icon, t: addOp(icon.t ?? '', op) }) : node.attrs.icon });
  };

  // Legendă nouă: „Figura N. ”, cu N = a câta imagine e în document.
  const addCaption = () => {
    if (!caption) {
      const pos = getPos();
      let n = 0;
      editor.state.doc.descendants((child, p) => { if (child.type.name === 'image' && typeof pos === 'number' && p <= pos) n++; return true; });
      updateAttributes({ caption: `Figura ${Math.max(1, n)}. ` });
    }
    setEditCaption(true);
  };

  const pageWidth = () => (editor.view.dom as HTMLElement).clientWidth || 650;

  const select = () => {
    const pos = getPos();
    if (typeof pos === 'number') editor.commands.setNodeSelection(pos);
  };

  // Tragerea unui colț: dir = 1 pentru colțurile din dreapta, -1 pentru cele din stânga.
  const startResize = (e: React.PointerEvent, dir: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    const el = img.current;
    if (!el) return;
    const startX = e.clientX;
    const startW = el.getBoundingClientRect().width;
    // La imaginile centrate, trasul unui colț mărește în ambele părți, deci dublăm deplasarea.
    const factor = align === 'center' ? 2 : 1;
    const max = pageWidth();
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = Math.round(Math.min(max, Math.max(MIN_WIDTH, startW + (ev.clientX - startX) * dir * factor)));
      setLiveWidth(w);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setLiveWidth(null);
      updateAttributes({ width: Math.round(w) });
      select();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const setPercent = (p: number) => updateAttributes({ width: Math.round((pageWidth() * p) / 100) });

  // Mută imaginea cu un paragraf mai sus (-1) sau mai jos (1). Alternativă la tragerea cu mouse-ul.
  const move = (dir: -1 | 1) => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const { state } = editor;
    const $pos = state.doc.resolve(pos);
    const index = $pos.index();
    const parent = $pos.parent;
    if (dir === -1 && index === 0) return;
    if (dir === 1 && index >= parent.childCount - 1) return;
    const self = state.doc.nodeAt(pos);
    if (!self) return;
    const tr = state.tr.delete(pos, pos + self.nodeSize);
    const target = dir === -1 ? pos - parent.child(index - 1).nodeSize : pos + parent.child(index + 1).nodeSize;
    tr.insert(target, self);
    editor.view.dispatch(tr);
    editor.commands.setNodeSelection(target);
  };

  return (
    <NodeViewWrapper className={`doc-image align-${align} ${selected ? 'is-selected' : ''}`}
      style={{ ...(width ? { width } : {}), ...(floating ? { marginLeft: dx, marginTop: dy } : {}) }}>
      <img
        ref={img}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ''}
        title={node.attrs.title ?? undefined}
        draggable={!floating}
        data-drag-handle={floating ? undefined : ''}
        onClick={select}
        onPointerDown={floating ? startMove : undefined}
        style={{ width: width ? '100%' : undefined, ...(floating ? { zIndex: zIndexOf(align, Number(node.attrs.z) || 0) } : {}) }}
      />
      {floating && selected && editor.isEditable && !crop && (
        <span className="img-grip" contentEditable={false} onPointerDown={startMove} title="Trage ca să muți imaginea oriunde pe pagină">✥</span>
      )}
      {crop && editor.isEditable && (
        <div className="crop-layer" contentEditable={false} style={{ height: img.current?.offsetHeight }}>
          <div className="crop-box" style={{ left: `${crop.l * 100}%`, top: `${crop.t * 100}%`, right: `${crop.r * 100}%`, bottom: `${crop.b * 100}%` }}>
            {['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map((h) => (
              <span key={h} className={`crop-h ${h}`} data-h={h} onPointerDown={(e) => startCrop(e, h)} title="Trage ca să tai din margine" />
            ))}
          </div>
          <div className="crop-bar">
            <button className="fmt" onMouseDown={(e) => e.preventDefault()} onClick={() => void applyCrop()} title="Taie poza după chenar (Enter)">✓ Decupează</button>
            <button className="fmt" onMouseDown={(e) => e.preventDefault()} onClick={() => setCrop(null)} title="Renunță la decupare (Esc)">✕ Renunță</button>
          </div>
        </div>
      )}
      {editChart && chart && (
        <ChartDialog chart={chart} onClose={() => { setEditChart(false); select(); }} onDone={(c) => { setEditChart(false); void redraw(c).then(select); }} />
      )}
      {nobgMark && (
        <NoBgMarkDialog src={node.attrs.src} onClose={() => { setNobgMark(false); select(); }}
          onDone={(src) => { setNobgMark(false); updateAttributes({ src, shape: null, icon: null, chart: null, diagram: null, equation: null, wordart: null }); select(); }} />
      )}
      {editDiagram && diagram && (
        <DiagramDialog diagram={diagram} onClose={() => { setEditDiagram(false); select(); }} onDone={(d) => { setEditDiagram(false); void redrawDiagram(d).then(select); }} />
      )}
      {editEquation && equation && (
        <EquationDialog equation={equation} onClose={() => { setEditEquation(false); select(); }} onDone={(e) => { setEditEquation(false); void redrawEquation(e).then(select); }} />
      )}
      {editModel && model3d && (
        <Model3DDialog initial={model3d} onClose={() => { setEditModel(false); select(); }} onInsert={(blob, _name, src) => { setEditModel(false); void redrawModel(blob, src).then(select); }} />
      )}
      {(caption || editCaption) && (
        <figcaption className="img-caption" contentEditable={false} onDoubleClick={() => setEditCaption(true)}>
          {editCaption && editor.isEditable ? (
            <input
              autoFocus
              value={caption}
              maxLength={300}
              placeholder="Scrie legenda imaginii"
              onChange={(e) => updateAttributes({ caption: e.target.value })}
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              onBlur={() => { setEditCaption(false); if (!caption.trim()) updateAttributes({ caption: '' }); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); (e.target as HTMLInputElement).blur(); editor.commands.focus(); } }}
            />
          ) : caption}
        </figcaption>
      )}
      {selected && editor.isEditable && !crop && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((c) => (
            <span
              key={c}
              className={`img-handle ${c}`}
              onPointerDown={(e) => startResize(e, c.endsWith('e') ? 1 : -1)}
              title="Trage ca să mărești sau să micșorezi"
            />
          ))}
          {liveWidth && <span className="img-size">{liveWidth} px</span>}
          {note && !liveWidth && <span className="img-size img-note">{note}</span>}
          {editAlt && (
            <div className="img-alt" contentEditable={false}>
              <label>Text alternativ (descrie poza pentru cine nu o vede; se salvează și în .docx, .odt și pagina web):
                <textarea
                  autoFocus
                  rows={2}
                  maxLength={1000}
                  value={node.attrs.alt ?? ''}
                  placeholder="de exemplu: Graficul vânzărilor pe 2026, în creștere din martie"
                  onChange={(e) => updateAttributes({ alt: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); setEditAlt(false); select(); editor.commands.focus(); } }}
                />
              </label>
            </div>
          )}
          {(() => { const bar = <ImageToolbar
            inRibbon={!!slot}
            alt={!!String(node.attrs.alt ?? '').trim()}
            toggleAlt={() => setEditAlt(!editAlt)}
            align={align}
            setAlign={(a) => updateAttributes(isFloating(a) && !floating ? { align: a, dx: 0, dy: 0, z: nextZ(editor, a) } : { align: a })}
            order={order}
            pos={{ dx: Number(node.attrs.dx) || 0, dy: Number(node.attrs.dy) || 0 }}
            place={place}
            setPos={setPos}
            chart={chart}
            setChartKind={(t) => { if (chart) void redraw({ ...chart, t }); }}
            openChart={() => setEditChart(true)}
            diagram={diagram}
            setDiagramKind={(k) => { if (diagram) void redrawDiagram({ ...diagram, k }); }}
            openDiagram={() => setEditDiagram(true)}
            equation={!!equation}
            openEquation={() => setEditEquation(true)}
            model3d={!!model3d}
            openModel3d={() => setEditModel(true)}
            setPercent={setPercent}
            reset={() => updateAttributes({ width: null })}
            move={move}
            addCaption={addCaption}
            shape={shape}
            recolor={recolor}
            icon={icon}
            recolorIcon={(p) => void recolorIcon(p)}
            turn={(op) => void turn(op)}
            startCrop={() => setCrop({ l: 0, t: 0, r: 0, b: 0 })}
            applyStyle={(s, b) => void applyStyle(s, b)}
            picFx={(k, key) => void picFx(k, key)}
            compress={(all, ppi) => void compress(all, ppi)}
            wordart={wordart}
            rewrite={rewrite}
            remove={() => { deleteNode(); editor.commands.focus(); }}
          />; return slot ? createPortal(bar, slot) : bar; })()}
        </>
      )}
    </NodeViewWrapper>
  );
}

/** O imagine trecută în fața / în spatele textului ajunge deasupra celorlalte din grupul ei. */
function nextZ(editor: Editor, mode: ImageAlign): number {
  let max = 0;
  editor.state.doc.descendants((n) => { if (n.type.name === 'image' && n.attrs.align === mode) max = Math.max(max, Number(n.attrs.z) || 0); return true; });
  return max + 1;
}

/** Un grup al barei imaginii: în panglică cu nume (Aranjare, Mărime…); sub poză, butoanele pe rând, cu o linie după. */
function IGroup({ ribbon, label, children }: { ribbon?: boolean; label: string; children: React.ReactNode }) {
  return ribbon ? <RGroup label={label}>{children}</RGroup> : <>{children}<span className="sep" /></>;
}

/** Chenarul pozei cu culoarea și grosimea alese (se pune la clic pe ▭ Chenar; Ctrl+Z îl scoate). */
const CM = 96 / 2.54;
const cmToPx = (cm: number) => cm * CM;

/** Câmpul cu poziția în cm (o zecimală); Enter sau ieșirea din câmp o aplică. */
function PosInput({ label, px, title, set }: { label: string; px: number; title: string; set(cm: number): void }) {
  const [v, setV] = useState((px / CM).toFixed(1).replace('.', ','));
  const apply = () => { const n = Number(v.trim().replace(',', '.')); if (v.trim() && Number.isFinite(n) && Math.abs(n - px / CM) >= 0.05) set(n); };
  return (
    <label className="img-pos" title={title}>
      {label}
      <input value={v} size={4} aria-label={title} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => setV(e.target.value)} onBlur={apply}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); apply(); } }} />
      cm
    </label>
  );
}

function PicBorder({ apply }: { apply(b: { color: string; px: number }): void }) {
  const [color, setColor] = useState('#33333d');
  const [px, setPx] = useState(2);
  return (
    <>
      <input type="color" aria-label="Culoarea chenarului pozei" title="Culoarea chenarului pozei" value={color} onChange={(e) => setColor(e.target.value)} />
      <select className="shape-sw" aria-label="Grosimea chenarului pozei" title="Grosimea chenarului pozei" value={px} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => setPx(Number(e.target.value))}>
        {[1, 2, 3, 5, 8].map((v) => <option key={v} value={v}>{v} px</option>)}
      </select>
      <button className="fmt" onMouseDown={(e) => e.preventDefault()} onClick={() => apply({ color, px })} title="Pune chenarul cu culoarea și grosimea alese (Ctrl+Z îl scoate)">▭ Chenar</button>
    </>
  );
}

function ImageToolbar({ inRibbon, equation, openEquation, model3d, openModel3d, diagram, setDiagramKind, openDiagram, chart, setChartKind, openChart, order, pos, place, setPos, alt, toggleAlt, align, setAlign, setPercent, reset, move, addCaption, shape, recolor, icon, recolorIcon, turn, startCrop, applyStyle, picFx, compress, wordart, rewrite, remove }: {
  inRibbon?: boolean;
  icon: IconSpec | null;
  recolorIcon(p: Partial<IconSpec>): void;
  picFx(kind: 'corr' | 'art' | 'nobg', key: string): void;
  compress(all: boolean, ppi: number): void;
  shape: ShapeSpec | null;
  recolor(p: Partial<ShapeSpec>): void;
  turn(op: ImageOp): void;
  startCrop(): void;
  applyStyle(s: PictureStyle, border?: { color: string; px: number }): void;
  order(how: ZMove): void;
  /** Deplasarea de acum (px) a imaginii din fața / spatele textului. */
  pos: { dx: number; dy: number };
  place(h: 'left' | 'center' | 'right'): void;
  setPos(axis: 'dx' | 'dy', cm: number): void;
  chart: DocChart | null;
  setChartKind(t: ChartType): void;
  openChart(): void;
  equation: boolean;
  openEquation(): void;
  model3d: boolean;
  openModel3d(): void;
  diagram: DocDiagram | null;
  setDiagramKind(k: DocDiagramKind): void;
  openDiagram(): void;
  wordart: WordArtSpec | null;
  rewrite(p: Partial<WordArtSpec>): void;
  alt: boolean;
  toggleAlt(): void;
  align: ImageAlign;
  setAlign(a: ImageAlign): void;
  setPercent(p: number): void;
  reset(): void;
  move(dir: -1 | 1): void;
  addCaption(): void;
  remove(): void;
}) {
  // onMouseDown oprit: altfel click-ul pe bară ar pierde selecția imaginii.
  const B = ({ on, active, title, children }: { on(): void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button className={`fmt ${active ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={on} title={title}>{children}</button>
  );
  // În panglică: grupuri cu nume (Aranjare, Mărime, Stil…); sub poză: aceleași butoane pe un rând, cu linii între ele.
  return (
    <div className={inRibbon ? 'img-toolbar in-ribbon' : 'img-toolbar'} contentEditable={false}>
      {/* Ordinea grupurilor din fila „Format imagine” a procesorului de text cunoscut: Ajustare, Stiluri imagine, Accesibilitate, Aranjare, Dimensiune. */}
      <IGroup ribbon={inRibbon} label="Ajustare">
      <select className="shape-sw" aria-label="Corecții și culoare" title="Corecții și culoare: claritate, înmuiere, luminozitate, contrast, saturație, sepia, tonuri calde / reci, recolorare (Ctrl+Z le scoate)" value=""
        onChange={(e) => { if (e.target.value) picFx('corr', e.target.value); }}>
        <option value="">☀ Corecții…</option>
        {(['Claritate', 'Lumină', 'Culoare'] as const).map((g) => <optgroup key={g} label={g}>{PIC_CORRECTIONS.filter((c) => c.group === g).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</optgroup>)}
      </select>
      <select className="shape-sw" aria-label="Efect artistic" title="Efect artistic: schiță în creion, acuarelă, pictură în ulei, margini strălucitoare… (Ctrl+Z îl scoate)" value=""
        onChange={(e) => { if (e.target.value) picFx('art', e.target.value); }}>
        <option value="">🎨 Efect…</option>
        {ART_FX.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
      </select>
      <select className="shape-sw" aria-label="Elimină fundalul" title="Elimină fundalul: culoarea de pe marginile pozei devine transparentă (sigle, produse, poze pe fundal simplu; Ctrl+Z îl pune înapoi)" value=""
        onChange={(e) => { if (e.target.value) picFx('nobg', e.target.value); }}>
        <option value="">⬚ Fundal…</option>
        {NOBG_LEVELS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        <option value="mark">Marchează zonele de păstrat / de eliminat…</option>
      </select>
      <select className="shape-sw" aria-label="Comprimare imagini" title="Comprimare imagini: pozele se micșorează după cât de mari sunt în pagină, ca fișierul să fie mai mic (Ctrl+Z le pune înapoi)" value=""
        onChange={(e) => { const [w, p] = e.target.value.split(':'); if (p) compress(w === 'all', Number(p)); }}>
        <option value="">🗜 Comprimare…</option>
        <optgroup label="Doar această imagine">{COMPRESS_PPI.map(([p, n]) => <option key={p} value={`one:${p}`}>{n}</option>)}</optgroup>
        <optgroup label="Toate imaginile din document">{COMPRESS_PPI.map(([p, n]) => <option key={p} value={`all:${p}`}>{n}</option>)}</optgroup>
      </select>
      </IGroup>
      <IGroup ribbon={inRibbon} label="Stiluri imagine">
      <select className="shape-sw" aria-label="Stilul pozei" title="Stilul pozei: chenar, ramă albă, umbră, colțuri rotunjite, oval, strălucire, margini estompate, reflexie, chenar întrerupt, relief, perspectivă (Ctrl+Z îl scoate)" value=""
        onChange={(e) => { if (e.target.value) applyStyle(e.target.value as PictureStyle); }}>
        <option value="">Stil…</option>
        {PICTURE_STYLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {!shape && <PicBorder apply={(b) => applyStyle('thin', b)} />}
      </IGroup>
      <IGroup ribbon={inRibbon} label="Accesibilitate">
      <B on={addCaption} title="Legendă sub imagine (rămâne mereu lângă ea, și pe hârtie)">Legendă</B>
      <B on={toggleAlt} active={alt} title="Text alternativ: descrierea pozei pentru cititoarele de ecran (se salvează și în .docx / .odt)">Alt</B>
      </IGroup>
      <IGroup ribbon={inRibbon} label="Aranjare">
      <B on={() => setAlign('left')} active={align === 'left'} title="Aliniere stânga">⯇</B>
      <B on={() => setAlign('center')} active={align === 'center'} title="Centrat">≡</B>
      <B on={() => setAlign('right')} active={align === 'right'} title="Aliniere dreapta">⯈</B>
      <span className="sep" />
      <B on={() => setAlign('wrapLeft')} active={align === 'wrapLeft'} title="Imagine în stânga, textul curge în dreapta ei">▧ ←</B>
      <B on={() => setAlign('wrapRight')} active={align === 'wrapRight'} title="Imagine în dreapta, textul curge în stânga ei">→ ▧</B>
      <B on={() => setAlign('front')} active={align === 'front'} title="În fața textului: imaginea stă peste text și se mută oriunde, trăgând-o">▣ Față</B>
      <B on={() => setAlign('behind')} active={align === 'behind'} title="În spatele textului: textul se scrie peste imagine; o alegi cu clic între rânduri">▢ Spate</B>
      {isFloating(align) && (
        <>
          <B on={() => order('front')} title="Adu în față (deasupra tuturor imaginilor)">⤒</B>
          <B on={() => order('forward')} title="Adu mai în față (cu un loc)">↥</B>
          <B on={() => order('backward')} title="Trimite mai în spate (cu un loc)">↧</B>
          <B on={() => order('back')} title="Trimite în spate (sub toate imaginile)">⤓</B>
          <span className="sep" />
          <B on={() => place('left')} title="Lipită de marginea din stânga a paginii">⇤</B>
          <B on={() => place('center')} title="Centrată între marginile paginii">⇹</B>
          <B on={() => place('right')} title="Lipită de marginea din dreapta a paginii">⇥</B>
          <PosInput key={`x${pos.dx}`} label="↔" px={pos.dx} title="Poziția pe orizontală, în cm de la marginea din stânga a paginii" set={(cm) => setPos('dx', cm)} />
          <PosInput key={`y${pos.dy}`} label="↕" px={pos.dy} title="Poziția pe verticală, în cm de la paragraful de care e prinsă imaginea" set={(cm) => setPos('dy', cm)} />
        </>
      )}
      <B on={() => move(-1)} title="Mută imaginea mai sus (sau trage-o cu mouse-ul)">↑</B>
      <B on={() => move(1)} title="Mută imaginea mai jos (sau trage-o cu mouse-ul)">↓</B>
      <span className="sep" />
      <B on={() => turn('l')} title="Rotește 90° spre stânga">⟲</B>
      <B on={() => turn('r')} title="Rotește 90° spre dreapta">⟳</B>
      <B on={() => turn('h')} title="Oglindește stânga ↔ dreapta">⇋</B>
      <B on={() => turn('v')} title="Oglindește sus ↕ jos">⇅</B>
      </IGroup>
      <IGroup ribbon={inRibbon} label="Dimensiune">
      <B on={() => setPercent(25)} title="25% din lățimea paginii">25%</B>
      <B on={() => setPercent(50)} title="50% din lățimea paginii">50%</B>
      <B on={() => setPercent(100)} title="Toată lățimea paginii">100%</B>
      <B on={reset} title="Mărimea originală">1:1</B>
      <B on={startCrop} title="Decupează: tai marginile pozei trăgând de chenar">✂</B>
      </IGroup>
      {equation && (
        <IGroup ribbon={inRibbon} label="Ecuație">
          <B on={openEquation} title="Schimbă ecuația: textul ei, cu modele și simboluri">✎ Ecuație</B>
        </IGroup>
      )}
      {model3d && (
        <IGroup ribbon={inRibbon} label="Model 3D">
          <B on={openModel3d} title="Rotește din nou modelul 3D, schimbă-i culoarea sau unghiul">🧊 Rotește modelul</B>
        </IGroup>
      )}
      {diagram && (
        <IGroup ribbon={inRibbon} label="Diagramă">
          <select className="shape-sw" aria-label="Felul diagramei" value={diagram.k} onChange={(e) => setDiagramKind(e.target.value as DocDiagramKind)}>
            {DOC_DIAGRAMS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <B on={openDiagram} title="Textul diagramei: elementele, câte unul pe rând, felul și culoarea">✎ Text</B>
        </IGroup>
      )}
      {chart && (
        <IGroup ribbon={inRibbon} label="Grafic">
          <select className="shape-sw" aria-label="Felul graficului" value={chart.t} onChange={(e) => setChartKind(e.target.value as ChartType)}>
            {CHART_KINDS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <B on={openChart} title="Datele graficului: tabelul cu valorile, titlul, seriile (poți lipi un tabel din Sheets)">✎ Date</B>
        </IGroup>
      )}
      {wordart && (
        <IGroup ribbon={inRibbon} label="Text artistic">
          <input key={wordart.text} className="wordart-text" aria-label="Textul artistic" defaultValue={wordart.text} maxLength={WORDART_MAX}
            title="Textul: scrie și apasă Enter"
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); rewrite({ text: e.currentTarget.value }); } }}
            onBlur={(e) => rewrite({ text: e.currentTarget.value })} />
          <select className="shape-sw" aria-label="Stilul textului artistic" title="Stilul: culorile, conturul și umbra gata alese (culorile alese de mână se scot)" value={wordart.s}
            onChange={(e) => rewrite({ s: e.target.value, fill: undefined, line: undefined, lw: undefined, shadow: undefined, glow: undefined })}>
            {WORDART_STYLES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="wa-color" title="Culoarea literelor">A<input type="color" aria-label="Culoarea literelor" value={wordart.fill ?? '#1d4ed8'} onChange={(e) => rewrite({ fill: e.target.value })} /></label>
          <label className="wa-color" title="Culoarea conturului">◌<input type="color" aria-label="Culoarea conturului" value={wordart.line ?? '#111111'} onChange={(e) => rewrite({ line: e.target.value, lw: wordart.lw || 8 })} /></label>
          <select className="shape-sw" aria-label="Conturul textului artistic" title="Grosimea conturului" value={wordart.lw ?? ''} onChange={(e) => rewrite({ lw: e.target.value === '' ? undefined : +e.target.value })}>
            <option value="">Contur din stil</option>
            {WORDART_LINES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
          <select className="shape-sw" aria-label="Fontul textului artistic" title="Fontul" value={wordart.font ?? 'black'} onChange={(e) => rewrite({ font: e.target.value })}>
            {WORDART_FONTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <B active={wordart.shadow ?? wordart.s === 'gold'} on={() => rewrite({ shadow: !(wordart.shadow ?? wordart.s === 'gold') })} title="Umbră sub text">▣ Umbră</B>
          <select className="shape-sw" aria-label="Strălucirea textului artistic" title="Strălucire în jurul literelor" value={wordart.glow ?? ''} onChange={(e) => rewrite({ glow: e.target.value || undefined })}>
            <option value="">Fără strălucire</option>
            {WORDART_GLOWS.map(([c, n]) => <option key={c} value={c}>✦ {n}</option>)}
          </select>
        </IGroup>
      )}
      {shape && (
        <IGroup ribbon={inRibbon} label="Formă">
          {shape.k !== 'line' && (
            <label className="shape-col" title="Culoarea de umplere a formei">Umplere
              <input type="color" aria-label="Umplerea formei" value={shape.fill || '#ffffff'} onChange={(e) => recolor({ fill: e.target.value })} />
            </label>
          )}
          {shape.k !== 'line' && <B on={() => recolor({ fill: '' })} active={!shape.fill} title="Fără umplere (doar conturul)">∅</B>}
          <label className="shape-col" title={shape.k === 'line' ? 'Culoarea liniei' : 'Culoarea conturului'}>{shape.k === 'line' ? 'Culoare' : 'Contur'}
            <input type="color" aria-label="Conturul formei" value={shape.stroke || '#000000'} onChange={(e) => recolor({ stroke: e.target.value, sw: shape.sw || 3 })} />
          </label>
          <select className="shape-sw" aria-label="Grosimea conturului" title="Grosimea conturului" value={shape.stroke ? shape.sw : 0} onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => { const v = Number(e.target.value); recolor(v ? { sw: v, stroke: shape.stroke || '#000000' } : { sw: 0, stroke: '' }); }}>
            {shape.k !== 'line' && <option value={0}>Fără contur</option>}
            {[1, 2, 3, 5, 8].map((v) => <option key={v} value={v}>{v} px</option>)}
          </select>
          <select className="shape-sw" aria-label="Efectul formei" title="Efectul formei: umbră, strălucire în culoarea ei sau margini estompate" value={shape.fx ?? ''} onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => recolor({ fx: (e.target.value || undefined) as ShapeFx | undefined })}>
            <option value="">Fără efect</option>
            {SHAPE_FX.map(([f, name]) => <option key={f} value={f}>{name}</option>)}
          </select>
        </IGroup>
      )}
      {icon && (
        <IGroup ribbon={inRibbon} label="Pictogramă">
          <label className="shape-col" title="Culoarea pictogramei (se desenează din nou, la fel de clară)">Culoare
            <IconColor value={icon.c} onPick={(c) => recolorIcon({ c })} />
          </label>
          <IconStroke value={icon.s} onPick={(s) => recolorIcon({ s })} />
        </IGroup>
      )}
      {inRibbon ? <RGroup label="Șterge"><B on={remove} title="Șterge imaginea (sau tasta Delete)">🗑</B></RGroup> : <B on={remove} title="Șterge imaginea (sau tasta Delete)">🗑</B>}
    </div>
  );
}

// Imaginile trase din Explorer sau lipite (Ctrl+V) intră direct în document.
export function imageFilesFrom(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => /^image\/(png|jpe?g|gif|webp)$/.test(f.type));
}

/** Latura cea mai lungă a unei poze în document: 2000 px ajung pentru tipărire la ~300 dpi pe lățimea paginii A4. */
const MAX_SIDE = 2000;

const readDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/**
 * Pozele mari (de telefon, 4000 px, 5–10 MB) se micșorează la MAX_SIDE înainte să intre în document, ca fișierul să rămână
 * mic și rapid (Word păstrează poza întreagă și documentul ajunge la zeci de MB). Capturile PNG rămân PNG (text clar,
 * transparență), fotografiile devin JPEG; GIF-urile (pot fi animate) și pozele mici rămân neatinse.
 */
export async function imageForDoc(file: File): Promise<string> {
  if (file.type === 'image/gif') return readDataUrl(file);
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (k === 1 && file.size <= 1.5 * 1024 * 1024) { bmp.close(); return readDataUrl(file); }
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const png = file.type === 'image/png';
  if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const url = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88);
  c.width = 0;
  return url;
}

export async function insertImageFiles(editor: Editor, files: File[], pos?: number, width?: number, extra?: Record<string, unknown> | ((i: number) => Record<string, unknown>)) {
  const tooBig = files.filter((f) => f.size > 60 * 1024 * 1024);
  if (tooBig.length) alert(`Prea mari (maximum 60 MB): ${tooBig.map((f) => f.name).join(', ')}`);
  // Toate pozele se pregătesc întâi, apoi intră deodată și în ordinea aleasă (altfel una gata mai repede ar fi înlocuită de următoarea).
  // `extra` ca funcție: atribute diferite pentru fiecare fișier (după locul lui în `files`), de exemplu pictogramele.
  const ready = await Promise.all(files.map((f, i) => ({ f, i })).filter(({ f }) => !tooBig.includes(f)).map(({ f, i }) => imageForDoc(f).then(
    (src) => ({ type: 'image', attrs: { src, alt: f.name, ...(width ? { width } : {}), ...(typeof extra === 'function' ? extra(i) : extra) } }),
    () => { alert(`Imaginea „${f.name}” nu a putut fi deschisă.`); return null; },
  )));
  const content = ready.filter((x) => x !== null);
  if (!content.length) return;
  if (typeof pos === 'number') editor.chain().focus().insertContentAt(pos, content).run();
  else editor.chain().focus().insertContent(content).run();
}
