// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inserare → Pictograme (Docs și Slides): fereastra cu biblioteca de pictograme (iconLib.ts), cu căutare, categorii,
// culoare și grosimea liniei. Se pot alege mai multe deodată (clic = bifat / debifat, dublu clic = pune doar pictograma aceea).
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { findIcons, Icon, ICON_CATS, ICON_STROKES as STROKES, iconPng, IconSpec, iconSvg } from './iconLib';

export default function IconsDialog({ color: color0 = '#1f4e79', onInsert, onClose }: { color?: string; onInsert(blobs: Blob[], names: string[], specs: IconSpec[]): void; onClose(): void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [color, setColor] = useState(color0);
  const [stroke, setStroke] = useState(2);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => findIcons(q, cat), [q, cat]);
  const insert = async (icons: Icon[]) => {
    if (!icons.length || busy) return;
    setBusy(true);
    try { onInsert(await Promise.all(icons.map((ic) => iconPng(ic, color, stroke))), icons.map((ic) => ic.name), icons.map((ic) => ({ id: ic.id, c: color.toLowerCase(), s: stroke }))); }
    finally { setBusy(false); }
  };
  const picked = sel.map((id) => list.find((ic) => ic.id === id) ?? findIcons('').find((ic) => ic.id === id)!).filter(Boolean);
  return createPortal(
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg icons-dlg" role="dialog" aria-label="Pictograme" style={{ maxWidth: 'min(640px, 96vw)', width: 640 }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } if (e.key === 'Enter' && picked.length && (e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); void insert(picked); } }}>
        <h3>Pictograme</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input autoFocus type="search" aria-label="Caută pictograme" placeholder="Caută (de exemplu: telefon, bani, săgeată)" value={q}
            onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px' }} />
          <label>Culoare <input type="color" aria-label="Culoarea pictogramelor" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          <select aria-label="Grosimea liniei" value={stroke} onChange={(e) => setStroke(Number(e.target.value))} title="Grosimea liniei">
            {STROKES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </div>
        <div role="tablist" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '8px 0' }}>
          {['', ...ICON_CATS].map((c) => (
            <button key={c || 'all'} role="tab" aria-selected={cat === c} className={cat === c ? 'on' : ''} data-icon-cat={c} onClick={() => setCat(c)}>{c || 'Toate'}</button>
          ))}
        </div>
        <div className="icons-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6, maxHeight: 320, overflowY: 'auto', padding: 2 }}>
          {list.map((ic) => {
            const on = sel.includes(ic.id);
            return (
              <button key={ic.id} data-icon={ic.id} aria-pressed={on} title={ic.name} className={on ? 'on' : ''}
                onClick={() => setSel((s) => (on ? s.filter((x) => x !== ic.id) : [...s, ic.id]))}
                onDoubleClick={() => void insert([ic])}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 6, height: 'auto', outline: on ? '2px solid var(--accent, #2b6cb0)' : undefined }}>
                <span style={{ width: 36, height: 36, display: 'block' }} dangerouslySetInnerHTML={{ __html: iconSvg(ic, color, stroke, 36) }} />
                <span style={{ fontSize: 11, lineHeight: 1.15, textAlign: 'center' }}>{ic.name}</span>
              </button>
            );
          })}
          {!list.length && <p className="print-info" style={{ gridColumn: '1 / -1' }}>Nicio pictogramă nu se potrivește. Încearcă alt cuvânt.</p>}
        </div>
        <p className="print-info">{sel.length ? `Alese: ${sel.length}` : 'Clic pe una sau mai multe pictograme, apoi Inserează (dublu clic pune doar una).'}</p>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" data-icon-insert disabled={!picked.length || busy} onClick={() => void insert(picked)}>Inserează</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
