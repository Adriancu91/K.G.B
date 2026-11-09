// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Datele graficului” din Docs: un tabel mic (rândul 1 = numele seriilor, coloana A = etichetele), cu rânduri și coloane
// adăugate sau scoase, și lipire directă din Sheets sau dintr-o foaie de calcul (Ctrl+V în orice celulă).
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CHART_KINDS, CHART_MAX_COLS, CHART_MAX_ROWS, cellsFromText, DocChart } from './chart';
import { CHART_FILLS, CHART_INKS, CHART_LINES, LEGEND_POS, PALETTES, type ChartType, type LegendPos } from '../sheets/chartSvg';

export default function ChartDialog({ chart, onDone, onClose }: { chart: DocChart; onDone(c: DocChart): void; onClose(): void }) {
  const [c, setC] = useState<DocChart>(() => ({ ...chart, cells: chart.cells.map((r) => [...r]) }));
  const cols = c.cells[0]?.length ?? 2;
  const set = (r: number, k: number, v: string) => setC((x) => ({ ...x, cells: x.cells.map((row, i) => (i === r ? row.map((t, j) => (j === k ? v.slice(0, 60) : t)) : row)) }));
  const addRow = () => setC((x) => (x.cells.length >= CHART_MAX_ROWS ? x : { ...x, cells: [...x.cells, Array(cols).fill('')] }));
  const addCol = () => setC((x) => (cols >= CHART_MAX_COLS ? x : { ...x, cells: x.cells.map((r, i) => [...r, i === 0 ? `Seria ${cols}` : '']) }));
  const delRow = () => setC((x) => (x.cells.length <= 2 ? x : { ...x, cells: x.cells.slice(0, -1) }));
  const delCol = () => setC((x) => (cols <= 2 ? x : { ...x, cells: x.cells.map((r) => r.slice(0, -1)) }));
  const paste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\n')) return;
    const cells = cellsFromText(text);
    if (!cells) return;
    e.preventDefault();
    setC((x) => ({ ...x, cells }));
  };
  return createPortal(
    <div className="chart-dlg-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chart-dlg" role="dialog" aria-label="Datele graficului"
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}>
        <h3>Datele graficului</h3>
        <div className="chart-dlg-row">
          <label>Fel <select value={c.t} onChange={(e) => setC({ ...c, t: e.target.value as ChartType })}>
            {CHART_KINDS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select></label>
          <label>Titlu <input value={c.title} maxLength={120} onChange={(e) => setC({ ...c, title: e.target.value })} /></label>
        </div>
        <div className="chart-dlg-row chart-dlg-look">
          <label>Culori <select aria-label="Culorile graficului" value={c.pal ?? 0} onChange={(e) => setC({ ...c, pal: Number(e.target.value) || undefined })}>
            {PALETTES.map(([n], i) => <option key={n} value={i}>{n}</option>)}
          </select></label>
          <label>Legenda <select aria-label="Locul legendei" value={c.leg ?? 'b'} onChange={(e) => setC({ ...c, leg: e.target.value === 'b' ? undefined : e.target.value as LegendPos })}>
            {LEGEND_POS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select></label>
          <label>Umplere <select aria-label="Umplere formă" value={c.bg ?? '#ffffff'} onChange={(e) => setC({ ...c, bg: e.target.value === '#ffffff' ? undefined : e.target.value })}>
            {CHART_FILLS.map(([n, v]) => <option key={v} value={v}>{n}</option>)}
          </select></label>
          <label>Contur <select aria-label="Contur formă" value={c.ln ?? ''} onChange={(e) => setC({ ...c, ln: e.target.value || undefined })}>
            <option value="">Fără contur</option>
            {CHART_LINES.map(([n, v]) => <option key={v} value={v}>{n}</option>)}
          </select></label>
          <label>Font <select aria-label="Fontul graficului" value={c.fn ?? ''} onChange={(e) => setC({ ...c, fn: e.target.value || undefined })}>
            <option value="">Segoe UI</option>
            {['Arial', 'Calibri', 'Cambria', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'].map((f) => <option key={f} value={f}>{f}</option>)}
          </select></label>
          <label>Text <select aria-label="Culoarea textului din grafic" value={c.ink ?? ''} onChange={(e) => setC({ ...c, ink: e.target.value || undefined })}>
            {CHART_INKS.map(([n, v]) => <option key={v} value={v}>{n}</option>)}
          </select></label>
          <label title="Scrie valoarea fiecărui punct pe grafic"><input type="checkbox" aria-label="Valori pe grafic" checked={!!c.lab} onChange={(e) => setC({ ...c, lab: e.target.checked || undefined })} /> Valori</label>
          <label title="Liniile gri deschis dintre valori, pe toată lățimea graficului"><input type="checkbox" aria-label="Linii de grilă" checked={!c.ng} onChange={(e) => setC({ ...c, ng: e.target.checked ? undefined : true })} /> Grilă</label>
        </div>
        <p className="chart-dlg-hint">Primul rând: numele seriilor. Prima coloană: etichetele. Poți lipi (Ctrl+V) un tabel copiat din Sheets.</p>
        <div className="chart-dlg-grid">
          <table><tbody>
            {c.cells.map((row, r) => (
              <tr key={r}>{row.map((t, k) => (
                <td key={k}><input value={t} aria-label={`Rândul ${r + 1}, coloana ${k + 1}`} className={r === 0 || k === 0 ? 'head' : ''}
                  onChange={(e) => set(r, k, e.target.value)} onPaste={paste} /></td>
              ))}</tr>
            ))}
          </tbody></table>
        </div>
        <div className="chart-dlg-row">
          <button onClick={addRow} disabled={c.cells.length >= CHART_MAX_ROWS}>＋ Rând</button>
          <button onClick={delRow} disabled={c.cells.length <= 2}>− Rând</button>
          <button onClick={addCol} disabled={cols >= CHART_MAX_COLS}>＋ Serie</button>
          <button onClick={delCol} disabled={cols <= 2}>− Serie</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={() => onDone(c)}>Gata</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
