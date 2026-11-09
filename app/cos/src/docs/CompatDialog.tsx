// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Verifică compatibilitatea”: pentru fiecare format (.docx, .odt, .txt) arată ce se schimbă la salvare,
// ca să alegi formatul potrivit înainte să trimiți fișierul. Nu modifică nimic în document.
import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { PageSetup } from './format';
import { COMPAT_FORMATS, compatIssues, countDoc, type CompatFormat } from './compat';

export default function CompatDialog({ editor, page, onClose }: { editor: Editor; page: PageSetup; onClose(): void }) {
  const [fmt, setFmt] = useState<CompatFormat>('docx');
  const counts = countDoc(editor.getJSON());
  const issues = compatIssues(counts, page, fmt);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg inspect-dlg" role="dialog" aria-label="Verifică compatibilitatea" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Verifică compatibilitatea</h3>
        <p className="print-info">Ce se schimbă când salvezi documentul în alt format. Fișierul Cyber Office Studio păstrează tot.</p>
        <div className="compat-tabs" role="tablist">
          {COMPAT_FORMATS.map((f) => {
            const n = compatIssues(counts, page, f.id).length;
            return (
              <button key={f.id} role="tab" aria-selected={fmt === f.id} className={fmt === f.id ? 'active' : ''} data-compat={f.id} onClick={() => setFmt(f.id)}>
                {f.name} {n ? `(${n})` : '✓'}
              </button>
            );
          })}
        </div>
        {issues.length ? (
          <ul className="inspect-list compat-list">
            {issues.map((i) => (
              <li key={i.key} className="found" data-issue={i.key}>
                <span className="inspect-mark" aria-hidden>!</span>
                <div className="inspect-text"><b>{i.what}{i.count > 1 ? ` (${i.count})` : ''}</b><span>{i.note}.</span></div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="inspect-list compat-list">
            <li data-issue="none">
              <span className="inspect-mark" aria-hidden>✓</span>
              <div className="inspect-text"><b>Nicio pierdere știută</b><span>Documentul se salvează în acest format fără să se schimbe ceva important.</span></div>
            </li>
          </ul>
        )}
        <div className="print-actions">
          <button className="primary" autoFocus onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}
