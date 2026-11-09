// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mini-bara de formatare (INTERFATA.md): apare deasupra textului ales cu mouse-ul (tras sau dublu clic) și are
// comenzile folosite cel mai des (font, mărime, B I U, culori, legătură, comentariu, pensula). Dispare la tastare,
// la un clic în text, la derulare sau cu Esc. Se desenează doar cât se vede, deci nu dublează butoanele panglicii.
// Într-un câmp de scris simplu (textarea, Notițe) textul ales nu are dreptunghi: bara apare deasupra locului unde ai ridicat mouse-ul.
// Cu `onContext` (Sheets) apare la clic dreapta pe o celulă, deasupra meniului, și rămâne până la un clic, o tastă sau Esc.
// Fără temporizatoare: în ferestrele ascunse ele sunt încetinite mult; selecția se citește direct la ridicarea mouse-ului.
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ribbon.css';

interface Props {
  /** Zona în care se alege textul (de exemplu editorul). */
  target: HTMLElement | null;
  /** Bara nu apare (document protejat, pensula pornită…). */
  disabled?: boolean;
  /** Bara apare la clic dreapta (lângă meniu), nu la textul ales: pentru tabel, unde celulele nu au text de ales.
   *  Funcția spune dacă locul clicului e potrivit (de exemplu o celulă, nu capul coloanei). */
  onContext?: (e: MouseEvent) => boolean;
  children: ReactNode;
}

/** Dreptunghiul textului ales din `target`, sau null dacă nu e ales nimic acolo. */
function selectionRect(target: HTMLElement): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!target.contains(r.commonAncestorContainer)) return null;
  if (!sel.toString().trim()) return null;
  const rects = [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
  return rects[0] ? rects.reduce((a, b) => (b.top < a.top ? b : a)) : r.getBoundingClientRect();
}

export default function MiniBar({ target, disabled, onContext, children }: Props) {
  const [at, setAt] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const ctxRef = useRef(onContext);
  ctxRef.current = onContext;

  useEffect(() => {
    if (!target) return;
    const up = (e: MouseEvent) => {
      if (e.button !== 0 || disabledRef.current || ctxRef.current) return;
      if (target instanceof HTMLTextAreaElement) {
        const t = target;
        setAt(t.selectionEnd > t.selectionStart && t.value.slice(t.selectionStart, t.selectionEnd).trim() ? new DOMRect(e.clientX - 20, e.clientY - 12, 0, 24) : null);
        return;
      }
      setAt(selectionRect(target));
    };
    const hide = () => setAt(null);
    const key = (e: KeyboardEvent) => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) hide(); };
    const ctx = (e: MouseEvent) => {
      if (!ctxRef.current || disabledRef.current) return;
      setAt(ctxRef.current(e) ? new DOMRect(e.clientX, e.clientY - 4, 0, 0) : null);
    };
    const selChange = () => {
      if (ctxRef.current) return;
      if (target instanceof HTMLTextAreaElement) { if (target.selectionStart === target.selectionEnd) hide(); return; }
      const sel = window.getSelection();
      if (sel?.isCollapsed && sel.anchorNode && target.contains(sel.anchorNode)) hide();
    };
    const scroll = (e: Event) => { if (!bar.current?.contains(e.target as Node)) hide(); };
    target.addEventListener('mouseup', up);
    target.addEventListener('mousedown', hide);
    target.addEventListener('contextmenu', ctx);
    target.addEventListener('keydown', key);
    document.addEventListener('selectionchange', selChange);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', hide);
    return () => {
      target.removeEventListener('mouseup', up);
      target.removeEventListener('mousedown', hide);
      target.removeEventListener('contextmenu', ctx);
      target.removeEventListener('keydown', key);
      document.removeEventListener('selectionchange', selChange);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', hide);
    };
  }, [target]);

  useEffect(() => { if (disabled) setAt(null); }, [disabled]);

  // Esc închide bara (doar când se vede).
  useEffect(() => {
    if (!at) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAt(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [at]);

  // Deasupra textului ales; dacă nu încape sus, dedesubt. Rămâne în fereastră.
  useLayoutEffect(() => {
    if (!at || !bar.current) { setPos(null); return; }
    const w = bar.current.offsetWidth, h = bar.current.offsetHeight;
    let top = at.top - h - 8;
    if (top < 8) top = at.bottom + 8;
    const left = Math.max(8, Math.min(at.left, window.innerWidth - w - 8));
    setPos({ left, top });
  }, [at]);

  if (!at) return null;
  return createPortal(
    <div className="minibar" ref={bar} role="toolbar" aria-label="Mini-bara de formatare"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
      onMouseDown={(e) => { if (!(e.target as Element).closest('select, input')) e.preventDefault(); }}>
      {children}
    </div>,
    document.body,
  );
}
