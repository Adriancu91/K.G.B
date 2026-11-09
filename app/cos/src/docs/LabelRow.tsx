// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Rândul „Clasificare” din fereastra Proprietăți (Docs, Sheets) și eticheta colorată din bara de jos.
import { DOC_LABELS, type DocLabel } from './format';

export function LabelRow({ value, onChange }: { value?: DocLabel; onChange(v: DocLabel | undefined): void }) {
  return (
    <div className="print-row">
      <span className="print-label">Clasificare</span>
      <select className="print-area" aria-label="Clasificare" value={value ?? ''} title="Cât de confidențial e documentul: se vede în bara de jos și se păstrează în .docx / .xlsx"
        onChange={(e) => onChange((e.target.value || undefined) as DocLabel | undefined)}>
        <option value="">Fără clasificare</option>
        {DOC_LABELS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
      </select>
    </div>
  );
}

export function LabelBadge({ value, onClick }: { value?: DocLabel; onClick(): void }) {
  const l = DOC_LABELS.find(([k]) => k === value);
  if (!l) return null;
  return (
    <button className="status-link doc-label" data-doc-label={l[0]} style={{ color: l[2], fontWeight: 600 }} onClick={onClick}
      title="Clasificarea documentului. Click: o schimbi în Proprietăți">🏷 {l[1]}</button>
  );
}
