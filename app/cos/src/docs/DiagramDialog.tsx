// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Diagramă” din Docs: felul, culoarea și elementele (câte unul pe rând, cel mult 8), cu previzualizare.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DIAGRAM_MAX, diagramSvg, diagramText, DOC_DIAGRAMS, DocDiagram, DocDiagramKind, itemsFromText, levelsFromText } from './diagram';

export default function DiagramDialog({ diagram, onDone, onClose }: { diagram: DocDiagram; onDone(d: DocDiagram): void; onClose(): void }) {
  const [k, setK] = useState<DocDiagramKind>(diagram.k);
  const [color, setColor] = useState(diagram.color);
  const [text, setText] = useState(diagramText(diagram));
  const items = itemsFromText(text);
  // La ierarhie, rândurile începute cu spații (sau tab) coboară sub elementul de deasupra.
  const lv = k === 'hierarchy' ? levelsFromText(text) : [];
  const made: DocDiagram = { k, color, items, ...(lv.some((l) => l > 1) ? { lv } : {}) };
  const preview = useMemo(() => (items.length ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(diagramSvg(made).svg) : ''), [k, color, text]);
  return createPortal(
    <div className="chart-dlg-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chart-dlg" role="dialog" aria-label="Diagramă" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}>
        <h3>Diagramă</h3>
        <div className="chart-dlg-row">
          <label>Fel <select value={k} onChange={(e) => setK(e.target.value as DocDiagramKind)}>
            {DOC_DIAGRAMS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select></label>
          <label>Culoare <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Culoarea diagramei" /></label>
        </div>
        <label className="chart-dlg-hint">Elementele, câte unul pe rând (cel mult {DIAGRAM_MAX}{k === 'hierarchy' ? '; primul stă sus; un rând început cu două spații stă sub cel de deasupra lui' : ''}):</label>
        <textarea className="diag-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="Elementele diagramei" autoFocus />
        {preview && <img className="diag-preview" src={preview} alt="Previzualizarea diagramei" />}
        <div className="chart-dlg-row">
          <span className="chart-dlg-hint">{items.length > DIAGRAM_MAX - 1 && text.split('\n').filter((t) => t.trim()).length > DIAGRAM_MAX ? `Se folosesc doar primele ${DIAGRAM_MAX}.` : ''}</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>Renunță</button>
          <button className="primary" disabled={!items.length} onClick={() => onDone(made)}>Gata</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
