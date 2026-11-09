// @ts-nocheck
// Din Cyber Office Studio (src/pdf/Marks.tsx, D-071, D-078), neschimbat.
// Elementele „Completează și semnează” peste o pagină: se pun cu un click, se mută trăgându-le, se șterg cu ✕.
import { useEffect, useRef, useState } from 'react';
import { ARROW_HEAD, buttonAction, buttonOpts, DRAW_WIDTH, FieldType, LINE_KINDS, Mark, MARK_COLOR, MARK_FONT, MarkKind, measureText, NOTE_FONT, NOTE_LINE, NOTE_PAD, noteHeight, paintMark, POLY_KINDS, RECT_KINDS, calloutEdge, REDACT_COLOR, REDACT_COLORS, SHAPE_WIDTH, STAMP_COLORS, STAMP_RED, stampSize, textStyle, today } from './sign';
import { ERASE_RADIUS } from './erase';
import { snapEdge, type SnapLines } from './Guides';

export type SignTool = 'text' | 'date' | 'check' | 'cross' | 'sign' | 'stamp' | 'highlight' | 'note' | 'draw' | 'redact' | 'crop'
  | 'underline' | 'strike' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'image' | 'link' | 'polyline' | 'polygon' | 'cloud' | 'snap' | 'erase' | 'field' | 'callout' | 'caret' | 'replace' | 'fileatt' | 'sigbox' | 'mediabox' | 'beadbox';

interface LayerProps {
  marks: Mark[];
  zoom: number;
  /** Mărimea paginii la 100% (puncte). */
  pw: number;
  ph: number;
  /** Unealta aleasă: cu ea, un click pe pagină pune un element. */
  tool: SignTool | null;
  selected: number | null;
  /** Culoarea cu care se trage acum (pentru urma de pe ecran). */
  color?: string;
  onPlace(x: number, y: number): void;
  /** Evidențierea: dreptunghiul tras cu mouse-ul (puncte). */
  onPlaceRect(x: number, y: number, w: number, h: number): void;
  /** Desenul liber: punctele liniei trase (x, y, x, y…, în puncte). */
  onPlaceDraw(points: number[]): void;
  /** Radiera: bucata de urmă trasă acum (x, y, x, y…, în puncte), peste desenele libere. */
  onErase?(path: number[]): void;
  onChange(m: Mark): void;
  onRemove(id: number): void;
  onSelect(id: number | null): void;
  /** Ghidajele și grila de care se lipesc elementele mutate (vezi Guides.tsx). */
  snap?: SnapLines;
  /** Ștampila deschisă pentru schimbare (textul, culoarea, opacitatea) și cererea de a o deschide / închide. */
  editing?: number | null;
  onEdit?(id: number | null): void;
}

/** Rotirea vederii paginii (0 / 90 / 180 / 270), din cadrul ei. */
const rotOf = (el: Element | null) => Number((el?.closest('.pdf-page-box') as HTMLElement | null)?.dataset.rot ?? 0);
/** O mișcare de pe ecran întoarsă înapoi în sensul paginii, când vederea e rotită (CSS rotește în sensul acelor de ceas). */
export function unrotate(dx: number, dy: number, rot: number): [number, number] {
  if (rot === 90) return [dy, -dx];
  if (rot === 180) return [-dx, -dy];
  if (rot === 270) return [-dy, dx];
  return [dx, dy];
}

export function MarkLayer({ marks, zoom, pw, ph, tool, selected, color, onPlace, onPlaceRect, onPlaceDraw, onErase, onChange, onRemove, onSelect, snap, editing, onEdit }: LayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Evidențierea se trage ca un dreptunghi: colțul de pornire și cel de acum (puncte).
  const [rect, setRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // Desenul liber în curs: punctele de până acum (puncte).
  const [path, setPath] = useState<number[] | null>(null);
  // Polilinia / poligonul / norul în curs: colțurile puse + la urmă punctul de sub mouse (puncte).
  const [poly, setPoly] = useState<number[] | null>(null);
  useEffect(() => { setPoly(null); }, [tool]);
  const finishPoly = () => {
    if (!poly) return;
    // Fără punctul de sub mouse și fără colțurile puse de două ori în același loc (dublu-clickul pune două).
    const raw = poly.slice(0, -2), pts: number[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      if (!pts.length || Math.hypot(raw[i] - pts[pts.length - 2], raw[i + 1] - pts[pts.length - 1]) * zoom > 4) pts.push(raw[i], raw[i + 1]);
    }
    setPoly(null);
    if (pts.length >= (tool === 'polyline' ? 4 : 6)) onPlaceDraw(pts);
  };
  const pos = (e: React.PointerEvent) => {
    // Față de centrul paginii, ca să meargă și cu vederea rotită.
    const r = ref.current!.getBoundingClientRect();
    const [lx, ly] = unrotate(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), rotOf(ref.current));
    return [Math.max(0, Math.min(pw, lx / zoom + pw / 2)), Math.max(0, Math.min(ph, ly / zoom + ph / 2))];
  };
  const box = rect && { x: Math.min(rect.x0, rect.x1), y: Math.min(rect.y0, rect.y1), w: Math.abs(rect.x1 - rect.x0), h: Math.abs(rect.y1 - rect.y0) };
  return (
    <>
      {tool && (
        <div
          className="pdf-mark-catch"
          ref={ref}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            const [x, y] = pos(e);
            if (tool === 'erase') {
              e.currentTarget.setPointerCapture(e.pointerId);
              setPath([x, y]);
              onErase?.([x, y]);
            } else if (POLY_KINDS.includes(tool as MarkKind)) {
              // Fiecare click pune un colț; dublu-click încheie forma.
              setPoly(poly ? [...poly.slice(0, -2), x, y, x, y] : [x, y, x, y]);
            } else if (RECT_KINDS.includes(tool as MarkKind) || tool === 'snap' || tool === 'sigbox' || tool === 'mediabox' || tool === 'beadbox') {
              e.currentTarget.setPointerCapture(e.pointerId);
              setRect({ x0: x, y0: y, x1: x, y1: y });
            } else if (tool === 'draw' || tool === 'callout' || LINE_KINDS.includes(tool as MarkKind)) {
              e.currentTarget.setPointerCapture(e.pointerId);
              setPath([x, y]);
            } else onPlace(x, y);
          }}
          onDoubleClick={finishPoly}
          onPointerMove={(e) => {
            if (poly) { const [x, y] = pos(e); setPoly([...poly.slice(0, -2), x, y]); }
            else if (rect) { const [x, y] = pos(e); setRect({ ...rect, x1: x, y1: y }); }
            else if (path && tool === 'erase') {
              // Radiera șterge pe loc, bucată cu bucată, cât trage mouse-ul.
              const [x, y] = pos(e);
              const lx = path[path.length - 2], ly = path[path.length - 1];
              if (Math.hypot(x - lx, y - ly) * zoom >= 1) { setPath([...path, x, y]); onErase?.([lx, ly, x, y]); }
            } else if (path && tool !== 'draw') {
              // Linia dreaptă: doar capătul de pornire și cel de acum.
              const [x, y] = pos(e);
              setPath([path[0], path[1], x, y]);
            } else if (path) {
              // Sărim peste mișcările foarte mici, ca linia să nu aibă mii de puncte.
              const [x, y] = pos(e);
              if (Math.hypot(x - path[path.length - 2], y - path[path.length - 1]) * zoom >= 2) setPath([...path, x, y]);
            }
          }}
          onPointerUp={() => {
            if (box && box.w > 3 && box.h > 3) onPlaceRect(box.x, box.y, box.w, box.h);
            if (path && tool !== 'erase' && (tool === 'draw' || (path.length >= 4 && Math.hypot(path[2] - path[0], path[3] - path[1]) > 3))) onPlaceDraw(path);
            setRect(null);
            setPath(null);
          }}
        >
          {path && tool === 'erase' && (
            <svg className="pdf-mark-path" width={pw * zoom} height={ph * zoom}>
              <polyline points={path.map((v) => v * zoom).join(' ')} fill="none" stroke="rgba(120, 120, 120, 0.35)" strokeWidth={2 * ERASE_RADIUS * zoom} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {path && tool !== 'erase' && (
            <svg className="pdf-mark-path" width={pw * zoom} height={ph * zoom}>
              <polyline points={path.map((v) => v * zoom).join(' ')} fill="none" stroke={color ?? MARK_COLOR} strokeWidth={(tool === 'draw' ? DRAW_WIDTH : SHAPE_WIDTH) * zoom} strokeLinecap="round" strokeLinejoin="round" />
              {tool === 'arrow' && path.length >= 4 && <circle cx={path[2] * zoom} cy={path[3] * zoom} r={(ARROW_HEAD / 3) * zoom} fill={color ?? MARK_COLOR} />}
            </svg>
          )}
          {poly && (
            <svg className="pdf-mark-path" width={pw * zoom} height={ph * zoom}>
              {tool === 'polyline'
                ? <polyline points={poly.map((v) => v * zoom).join(' ')} fill="none" stroke={color ?? MARK_COLOR} strokeWidth={SHAPE_WIDTH * zoom} strokeLinejoin="round" />
                : <polygon points={poly.map((v) => v * zoom).join(' ')} fill="none" stroke={color ?? MARK_COLOR} strokeWidth={SHAPE_WIDTH * zoom} strokeLinejoin="round" strokeDasharray={tool === 'cloud' ? `${3 * zoom} ${3 * zoom}` : undefined} />}
            </svg>
          )}
          {box && <div className={`pdf-mark-rect${tool === 'redact' ? ' redact' : tool === 'crop' || tool === 'snap' || tool === 'sigbox' || tool === 'mediabox' || tool === 'beadbox' ? ' crop' : tool === 'highlight' ? '' : ' shape'}`} style={{ left: box.x * zoom, top: box.y * zoom, width: box.w * zoom, height: box.h * zoom }} />}
        </div>
      )}
      {marks.map((m) => (
        <MarkView
          key={m.id} m={m} zoom={zoom} pw={pw} ph={ph} active={selected === m.id} snap={snap}
          editing={selected === m.id && editing === m.id} onEdit={(on) => onEdit?.(on ? m.id : null)}
          onChange={onChange} onRemove={() => onRemove(m.id)} onSelect={() => onSelect(m.id)}
        />
      ))}
    </>
  );
}

interface ViewProps {
  m: Mark;
  zoom: number;
  pw: number;
  ph: number;
  active: boolean;
  snap?: SnapLines;
  onChange(m: Mark): void;
  onRemove(): void;
  onSelect(): void;
  editing?: boolean;
  onEdit?(on: boolean): void;
}

/** Colțul de unde se mărește o ștampilă (nord-vest, nord-est, sud-vest, sud-est). */
type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** Comentariul audio ales: playerul lui, ca să se asculte înainte de salvare. */
function AudioPlay({ data, name }: { data: Uint8Array; name: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([data as BlobPart], { type: /.webm$/i.test(name) ? 'audio/webm' : '' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data, name]);
  return url ? <audio className="pdf-audio-play" controls src={url} aria-label={`Ascultă: ${name}`} onPointerDown={(e) => e.stopPropagation()} /> : null;
}

function MarkView({ m, zoom, pw, ph, active, snap, onChange, onRemove, onSelect, editing, onEdit }: ViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  // Mutarea (sau, de la colțul din dreapta-jos, mărirea) cu mouse-ul; ștampila se mărește din oricare colț.
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; w: number; h: number; size: number; resize: boolean; corner: Corner } | null>(null);
  // Ștampila cu text: eticheta sau rândul de sub ea schimbat → lățimea după textul nou, la aceeași înălțime, centrată pe loc.
  const restamp = (text: string, sub: string) => {
    const base = stampSize(text || ' ', sub);
    const w = Math.min(pw, base.w * (m.h / base.h));
    const x = Math.max(0, Math.min(pw - w, m.x + m.w / 2 - w / 2));
    onChange({ ...m, text, sub, w, x });
  };

  useEffect(() => {
    if (m.kind !== 'text' && m.kind !== 'note' && m.kind !== 'callout' && canvasRef.current) paintMark(m, canvasRef.current, zoom * (window.devicePixelRatio || 1)).catch(() => {});
  }, [m, zoom]);
  useEffect(() => {
    if (active && !m.text) (m.kind === 'text' || m.kind === 'link' || m.kind === 'caret' || m.kind === 'replace' || m.kind === 'fileatt' ? inputRef.current : m.kind === 'note' || m.kind === 'callout' ? noteRef.current : null)?.focus();
  }, [m.kind, m.text, active]);

  const down = (e: React.PointerEvent, resize: boolean, corner: Corner = 'se') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();
    if ((e.target === inputRef.current || e.target === noteRef.current) && !resize) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, x: m.x, y: m.y, w: m.w, h: m.h, size: m.size ?? 12, resize, corner };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const [ux, uy] = unrotate(e.clientX - d.sx, e.clientY - d.sy, rotOf(e.currentTarget as Element));
    const dx = ux / zoom, dy = uy / zoom;
    if (d.resize && m.kind === 'stamp') {
      // Ștampila se mărește din oricare colț, cu colțul opus pe loc; proporțiile rămân (cu Shift, liber).
      const sx = d.corner === 'nw' || d.corner === 'sw' ? -1 : 1, sy = d.corner === 'nw' || d.corner === 'ne' ? -1 : 1;
      let w = d.w + sx * dx, h = d.h + sy * dy;
      const maxW = sx > 0 ? pw - d.x : d.x + d.w, maxH = sy > 0 ? ph - d.y : d.y + d.h;
      if (e.shiftKey) {
        w = Math.max(12, Math.min(maxW, w));
        h = Math.max(8, Math.min(maxH, h));
      } else {
        // Colțul tras, proiectat pe diagonala ștampilei; nu iese din pagină și nu ajunge mai mică de 12 puncte.
        let k = (w * d.w + h * d.h) / (d.w * d.w + d.h * d.h);
        k = Math.min(k, maxW / d.w, maxH / d.h);
        k = Math.max(k, 12 / Math.min(d.w, d.h));
        w = d.w * k;
        h = d.h * k;
      }
      onChange({ ...m, w, h, x: sx > 0 ? d.x : d.x + d.w - w, y: sy > 0 ? d.y : d.y + d.h - h });
      return;
    }
    if (d.resize) {
      // Mărirea păstrează forma; textul își schimbă mărimea literelor.
      const w = Math.max(10, Math.min(pw - m.x, d.w + dx));
      const k = w / d.w;
      if (m.kind === 'text') {
        const size = Math.max(6, Math.min(72, Math.round(d.size * k * 10) / 10));
        onChange({ ...m, size, ...measureText(m.text ?? '', size, textStyle(m)) });
      } else if (m.kind === 'note' || m.kind === 'callout') {
        // Nota se lățește sau se îngustează; înălțimea urmează textul.
        const nw = Math.max(60, w);
        onChange({ ...m, w: nw, h: noteHeight(m.text ?? '', nw) });
      } else if (RECT_KINDS.includes(m.kind)) {
        // Evidențierea, redactarea și formele se măresc liber, în lățime și în înălțime.
        onChange({ ...m, w, h: Math.max(4, Math.min(ph - m.y, d.h + dy)) });
      } else onChange({ ...m, w, h: d.h * k });
      return;
    }
    // Lângă un ghidaj (sau o linie a grilei) marginea elementului se lipește de el; Alt mută liber.
    let nx = d.x + dx, ny = d.y + dy;
    if (snap && !e.altKey) { const tol = 6 / zoom; nx = snapEdge(nx, m.w, snap.v, snap.grid, tol); ny = snapEdge(ny, m.h, snap.h, snap.grid, tol); }
    onChange({ ...m, x: Math.max(0, Math.min(pw - m.w, nx)), y: Math.max(0, Math.min(ph - m.h, ny)) });
  };
  const up = () => { drag.current = null; };

  return (
    <div
      className={`pdf-mark${active ? ' on' : ''}`}
      data-mark={m.kind}
      data-id={m.id}
      style={{ left: m.x * zoom, top: m.y * zoom, width: m.w * zoom, height: m.h * zoom }}
      onPointerDown={(e) => down(e, false)}
      onPointerMove={move}
      onPointerUp={up}
      onDoubleClick={m.kind === 'stamp' ? (e) => { e.stopPropagation(); onSelect(); onEdit?.(true); } : undefined}
      title={m.kind === 'stamp' ? 'Trage ca să muți; dublu-clic ca să schimbi ștampila' : 'Trage ca să muți'}
    >
      {m.kind === 'callout' && (() => {
        // Săgeata callout-ului: de pe marginea casetei până la locul arătat (vârful rămâne pe loc când muți caseta).
        const e = calloutEdge(m);
        if (!e || !m.pts) return null;
        const [tx, ty] = [(m.pts[0] - m.x) * zoom, (m.pts[1] - m.y) * zoom], [ex, ey] = [(e[0] - m.x) * zoom, (e[1] - m.y) * zoom];
        const a = Math.atan2(ty - ey, tx - ex), head = 7 * zoom;
        const col = m.color ?? MARK_COLOR;
        return (
          <svg className="pdf-callout-line" width="1" height="1" aria-hidden="true">
            <line x1={ex} y1={ey} x2={tx} y2={ty} stroke={col} strokeWidth={1.2 * zoom} />
            <polygon fill={col} points={`${tx},${ty} ${tx - Math.cos(a - 0.45) * head},${ty - Math.sin(a - 0.45) * head} ${tx - Math.cos(a + 0.45) * head},${ty - Math.sin(a + 0.45) * head}`} />
          </svg>
        );
      })()}
      {m.kind === 'text' ? (
        <input
          ref={inputRef}
          value={m.text ?? ''}
          placeholder="Scrie aici"
          style={{ fontSize: (m.size ?? 12) * zoom, fontFamily: MARK_FONT, color: m.color ?? MARK_COLOR, fontWeight: m.bold ? 'bold' : undefined, fontStyle: m.italic ? 'italic' : undefined, opacity: m.opacity }}
          onChange={(e) => onChange({ ...m, text: e.target.value, ...measureText(e.target.value, m.size ?? 12, textStyle(m)) })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
          onBlur={() => { if (!m.text?.trim()) onRemove(); }}
        />
      ) : m.kind === 'note' || m.kind === 'callout' ? (
        <textarea
          ref={noteRef}
          className={m.kind === 'callout' ? 'pdf-note pdf-callout' : 'pdf-note'}
          value={m.text ?? ''}
          placeholder="Scrie nota…"
          style={{ fontSize: NOTE_FONT * zoom, lineHeight: `${NOTE_LINE * zoom}px`, padding: NOTE_PAD * zoom, fontFamily: MARK_FONT }}
          onChange={(e) => {
            // Înălțimea: cât îi trebuie textului pe ecran (măsurat chiar în căsuță) și la desenarea în PDF, oricare e mai mare.
            const t = e.target, old = t.style.height;
            t.style.height = '0px';
            const shown = (t.scrollHeight + 2) / zoom;
            t.style.height = old;
            onChange({ ...m, text: t.value, h: Math.min(ph - m.y, Math.max(shown, noteHeight(t.value, m.w))) });
          }}
          onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); }}
          onBlur={() => { if (!m.text?.trim()) onRemove(); }}
        />
      ) : (
        <canvas ref={canvasRef} />
      )}
      {m.kind === 'fileatt' && active && m.fdata && /.(webm|mp3|m4a|wav|ogg|opus)$/i.test(m.fname ?? '') && <AudioPlay data={m.fdata} name={m.fname ?? ''} />}
      {m.kind === 'fileatt' && active && (
        <input
          ref={inputRef}
          className="pdf-link-input"
          value={m.text ?? ''}
          placeholder={`📎 ${m.fname ?? ''}: descriere (opțional)`}
          title={`Fișierul „${m.fname ?? ''}” intră în PDF, la agrafa de pe pagină. Poți scrie și o descriere.`}
          aria-label="Descrierea fișierului atașat"
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ ...m, text: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
        />
      )}
      {(m.kind === 'caret' || m.kind === 'replace') && (active || !m.text?.trim()) && (
        <input
          ref={inputRef}
          className="pdf-link-input"
          value={m.text ?? ''}
          placeholder={m.kind === 'caret' ? 'Textul de adăugat aici' : 'Textul nou (în locul celui tăiat)'}
          title={m.kind === 'caret' ? 'Ce trebuie adăugat în locul semnului ‸ (se salvează ca un comentariu de inserare)' : 'Ce trebuie scris în locul textului tăiat (se salvează ca un comentariu de înlocuire)'}
          aria-label={m.kind === 'caret' ? 'Text de inserat' : 'Text nou'}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ ...m, text: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
          onBlur={() => { if (m.kind === 'caret' && !m.text?.trim()) onRemove(); }}
        />
      )}
      {m.kind === 'link' && (active || !m.text?.trim()) && (
        <input
          ref={inputRef}
          className="pdf-link-input"
          value={m.text ?? ''}
          placeholder="Adresa web, e-mail sau nr. paginii"
          title="Unde duce legătura: o adresă (exemplu.ro), un e-mail sau numărul unei pagini din acest PDF"
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ ...m, text: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
        />
      )}
      {m.kind === 'redact' && active && (
        <div className="pdf-redact-props" onPointerDown={(e) => e.stopPropagation()}>
          <input
            value={m.text ?? ''}
            placeholder="Text peste (de ex. [CNP])"
            title="Text scris peste zona redactată (opțional), ca să se știe ce a fost scos"
            aria-label="Text peste redactare"
            onChange={(e) => onChange({ ...m, text: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
          />
          {REDACT_COLORS.map(([c, label]) => (
            <button
              key={c} className={(m.color ?? REDACT_COLOR) === c ? 'on' : ''} style={{ background: c }}
              title={`Culoarea redactării: ${label}`} aria-label={label}
              onClick={() => onChange({ ...m, color: c })}
            />
          ))}
        </div>
      )}
      {m.kind === 'field' && active && (
        <div className="pdf-redact-props pdf-field-props" onPointerDown={(e) => e.stopPropagation()}>
          <select
            value={m.ftype ?? 'text'} aria-label="Tipul câmpului" title="Tipul câmpului de formular"
            onChange={(e) => onChange({ ...m, ftype: e.target.value === 'text' ? undefined : (e.target.value as FieldType) })}
          >
            <option value="text">Text</option>
            <option value="check">☑ Bifă</option>
            <option value="list">▾ Listă</option>
            <option value="date">📅 Dată (zz.ll.aaaa)</option>
            <option value="radio">◉ Butoane radio</option>
            <option value="sum">Σ Total (sumă)</option>
            <option value="sig">✍ Semnătură (de semnat cu certificat)</option>
            <option value="barcode">▣ Cod de bare (datele formularului)</option>
            <option value="button">▭ Buton (golește, tipărește, adresă, pagină)</option>
          </select>
          <input
            value={m.text ?? ''}
            placeholder="Numele câmpului (de ex. Nume)"
            title="Numele câmpului de formular (se vede în programele de PDF și la completarea din profil); poate rămâne gol"
            aria-label="Numele câmpului"
            onChange={(e) => onChange({ ...m, text: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
          />
          {m.ftype === 'button' && (() => {
            const a = buttonAction(m.opts);
            return (
              <>
                <select
                  value={a.kind} aria-label="Ce face butonul" title="Ce se întâmplă când cineva apasă butonul în PDF"
                  onChange={(e) => {
                    const k = e.target.value;
                    onChange({ ...m, opts: buttonOpts(k === 'url' ? { kind: 'url', url: '' } : k === 'page' ? { kind: 'page', page: 1 } : { kind: k as 'reset' | 'print' }) });
                  }}
                >
                  <option value="reset">Golește formularul</option>
                  <option value="print">Tipărește</option>
                  <option value="url">Deschide o adresă web / e-mail</option>
                  <option value="page">Mergi la pagina…</option>
                </select>
                {a.kind === 'url' && (
                  <input
                    value={a.url} placeholder="www.exemplu.ro sau nume@exemplu.ro" aria-label="Adresa butonului"
                    onChange={(e) => onChange({ ...m, opts: buttonOpts({ kind: 'url', url: e.target.value }) })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
                  />
                )}
                {a.kind === 'page' && (
                  <input
                    type="number" min={1} value={a.page} aria-label="Pagina butonului" style={{ width: 60 }}
                    onChange={(e) => onChange({ ...m, opts: buttonOpts({ kind: 'page', page: Math.max(1, parseInt(e.target.value, 10) || 1) }) })}
                  />
                )}
              </>
            );
          })()}
          {m.ftype === 'barcode' && (
            <input
              value={m.opts ?? ''}
              placeholder="Câmpurile din cod, cu virgulă (gol = toate)"
              title="Numele câmpurilor puse în codul QR, despărțite prin virgulă; gol = toate câmpurile. Codul se reface cu ce s-a completat la fiecare salvare"
              aria-label="Câmpurile din cod"
              onChange={(e) => onChange({ ...m, opts: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
            />
          )}
          {m.ftype === 'sum' && (
            <input
              value={m.opts ?? ''}
              placeholder="Câmpurile adunate, cu virgulă: Preț 1, Preț 2"
              title="Numele câmpurilor de adunat, despărțite prin virgulă (cum le-ai scris la fiecare câmp); totalul se recalculează singur când le completezi"
              aria-label="Câmpurile adunate"
              onChange={(e) => onChange({ ...m, opts: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
            />
          )}
          {(m.ftype === 'list' || m.ftype === 'radio') && (
            <input
              value={m.opts ?? ''}
              placeholder="Opțiunile, cu virgulă: Da, Nu"
              title={m.ftype === 'radio' ? 'Butoanele radio (se alege doar unul), despărțite prin virgulă; stau unul lângă altul în dreptunghi' : 'Ce se poate alege din listă, despărțite prin virgulă'}
              aria-label="Opțiunile listei"
              onChange={(e) => onChange({ ...m, opts: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
            />
          )}
        </div>
      )}
      {m.kind === 'stamp' && editing && (
        <div className="pdf-redact-props pdf-stamp-props" data-testid="pdf-stamp-props" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'range')) { e.preventDefault(); onEdit?.(false); } }}>
          {!m.img && (
            <>
              <input
                autoFocus value={m.text ?? ''} placeholder="Textul ștampilei" aria-label="Textul ștampilei puse" title="Textul mare al ștampilei (de exemplu PLĂTIT)"
                onChange={(e) => restamp(e.target.value, m.sub ?? today())}
              />
              <input
                value={m.sub ?? today()} placeholder="Data, numele…" aria-label="Rândul de sub ștampilă" title="Rândul mic de sub text (data, ora, numele); poate rămâne gol"
                onChange={(e) => restamp(m.text ?? '', e.target.value)}
              />
              {STAMP_COLORS.map(([c, label]) => (
                <button
                  key={c} className={(m.color ?? STAMP_RED) === c ? 'on' : ''} style={{ background: c }}
                  title={`Culoarea ștampilei: ${label}`} aria-label={label}
                  onClick={() => onChange({ ...m, color: c })}
                />
              ))}
            </>
          )}
          <label className="pdf-stamp-op" title="Cât de opacă e ștampila (mai puțin = se vede textul de sub ea)">
            Opacitate
            <input type="range" min={20} max={100} step={5} value={Math.round((m.opacity ?? 1) * 100)} aria-label="Opacitatea ștampilei"
              onChange={(e) => { const v = Number(e.target.value) / 100; onChange({ ...m, opacity: v >= 1 ? undefined : v }); }} />
          </label>
          <button className="pdf-stamp-done" onClick={() => onEdit?.(false)}>Gata</button>
        </div>
      )}
      {active && (
        <>
          <button className="pdf-mark-del" title="Șterge" onPointerDown={(e) => e.stopPropagation()} onClick={onRemove}>✕</button>
          {m.kind === 'stamp' && (['nw', 'ne', 'sw'] as Corner[]).map((c) => (
            <span key={c} className={`pdf-mark-corner ${c}`} data-corner={c} title="Trage ca să mărești sau să micșorezi (cu Shift, fără proporții)"
              onPointerDown={(e) => down(e, true, c)} onPointerMove={move} onPointerUp={up} />
          ))}
          <span className={`pdf-mark-size${m.kind === 'stamp' ? ' pdf-mark-corner se' : ''}`} data-corner="se"
            title={m.kind === 'stamp' ? 'Trage ca să mărești sau să micșorezi (cu Shift, fără proporții)' : 'Trage ca să mărești sau să micșorezi'}
            onPointerDown={(e) => down(e, true)} onPointerMove={move} onPointerUp={up} />
        </>
      )}
    </div>
  );
}

/** Fonturile de mână care vin cu Windows 10/11 (semnătura scrisă devine imagine, deci nu se pun în PDF). */
const SIGN_FONTS = ['Segoe Script', 'Ink Free', 'Lucida Handwriting', 'Gabriola', 'Segoe Print'];

/** Fereastra în care desenezi semnătura cu mouse-ul (sau cu degetul / creionul pe ecran tactil) ori o scrii de la tastatură. */
export function SignatureDialog({ onDone, onCancel }: { onDone(png: string, ratio: number): void; onCancel(): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<[number, number] | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    c.width = 520 * 2;
    c.height = 200 * 2;
  }, []);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * ref.current!.width, ((e.clientY - r.top) / r.height) * ref.current!.height];
  };
  const line = (a: [number, number], b: [number, number]) => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.strokeStyle = MARK_COLOR;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  };
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setEmpty(true); };
  // Semnătura scrisă de la tastatură, cu un font de mână din Windows (ca „Type” din Acrobat); merge și pentru inițiale.
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typed, setTyped] = useState('');
  const [font, setFont] = useState(SIGN_FONTS[0]);
  const writeTyped = (text: string, f: string) => {
    const c = ref.current!, ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    const t = text.trim();
    setEmpty(!t);
    if (!t) return;
    let size = 120;
    ctx.font = `${size}px "${f}", cursive`;
    const w = ctx.measureText(t).width;
    if (w > c.width * 0.9) { size *= (c.width * 0.9) / w; ctx.font = `${size}px "${f}", cursive`; }
    ctx.fillStyle = MARK_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, c.width / 2, c.height / 2);
  };

  // Păstrăm doar partea desenată (fără marginile goale), ca semnătura să se așeze unde dai click.
  const done = () => {
    const c = ref.current!;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (data[(y * c.width + x) * 4 + 3] > 0) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return;
    const pad = 6;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1;
    out.height = y1 - y0 + 1;
    out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    onDone(out.toDataURL('image/png'), out.height / out.width);
  };

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="print-dlg pdf-sign-dlg" role="dialog" aria-label="Semnătura ta" onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}>
        <h3>Semnătura ta</h3>
        <div className="pdf-sign-modes" role="tablist">
          <button role="tab" aria-selected={mode === 'draw'} className={mode === 'draw' ? 'on' : ''} onClick={() => { setMode('draw'); clear(); }}>✍ Desenează</button>
          <button role="tab" aria-selected={mode === 'type'} className={mode === 'type' ? 'on' : ''} onClick={() => { setMode('type'); writeTyped(typed, font); }}>⌨ Scrie</button>
        </div>
        <p className="print-info">
          {mode === 'draw' ? 'Semnează cu mouse-ul în chenar.' : 'Scrie-ți numele (sau inițialele) și alege scrisul.'} Semnătura rămâne doar pe acest calculator.
        </p>
        {mode === 'type' && (
          <div className="pdf-sign-type">
            <input
              autoFocus value={typed} placeholder="Numele tău, de ex. Ion Popescu sau I.P." aria-label="Numele pentru semnătură"
              onChange={(e) => { setTyped(e.target.value); writeTyped(e.target.value, font); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) done(); }}
            />
            <select value={font} aria-label="Scrisul" onChange={(e) => { setFont(e.target.value); writeTyped(typed, e.target.value); }}>
              {SIGN_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: `"${f}", cursive` }}>{f}</option>)}
            </select>
          </div>
        )}
        <canvas
          ref={ref}
          className="pdf-sign-pad"
          onPointerDown={(e) => { if (mode !== 'draw') return; e.currentTarget.setPointerCapture(e.pointerId); last.current = point(e); line(last.current, last.current); setEmpty(false); }}
          onPointerMove={(e) => { if (!last.current) return; const p = point(e); line(last.current, p); last.current = p; }}
          onPointerUp={() => { last.current = null; }}
        />
        <div className="print-actions">
          <button onClick={() => { clear(); setTyped(''); }}>Șterge</button>
          <button onClick={onCancel}>Anulează</button>
          <button className="primary" onClick={done} disabled={empty}>Folosește semnătura</button>
        </div>
      </div>
    </div>
  );
}
