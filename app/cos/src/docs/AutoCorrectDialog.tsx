// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „AutoCorect” din Docs (ca Opțiuni AutoCorect din Word): ce se corectează singur și lista de înlocuiri.
import { useState } from 'react';
import { AutoCorrectOptions, DEFAULT_LIST, loadAutoCorrect, saveAutoCorrect } from './autoCorrect';

const CHECKS: [keyof AutoCorrectOptions, string][] = [
  ['quotes', 'Ghilimele românești: "text" → „text”, apostrof ’'],
  ['symbols', 'Simboluri: -- → –, --- → —, ... → …, (c) → ©, (e) → €, -> → →'],
  ['cedilla', 'ş și ţ cu sedilă → ș și ț cu virgulă (scrierea corectă)'],
  ['capitals', 'DOuă MAjuscule la început de cuvânt → Două Majuscule'],
  ['sentence', 'Prima literă din propoziție devine majusculă'],
  ['fractions', 'Fracții: 1/2 → ½, 1/4 → ¼, 3/4 → ¾'],
  ['links', 'Adresele web și de e-mail devin legături (https://…, www.…, nume@firma.ro)'],
  ['complete', 'Completare automată: lunile, zilele, data de azi și cuvintele lungi din document (Enter sau Tab o acceptă)'],
  ['replace', 'Înlocuiește în timp ce scrii (lista de mai jos)'],
];

const listText = (l: [string, string][]) => l.map(([a, b]) => `${a} → ${b}`).join('\n');
const parseList = (t: string): [string, string][] => t.split('\n')
  .map((r) => r.split(/\s*(?:→|->|=)\s*/))
  .filter((p) => p.length === 2 && p[0].trim() && p[1].trim())
  .map(([a, b]) => [a.trim(), b.trim()]);

export default function AutoCorrectDialog({ onClose }: { onClose(): void }) {
  const [o, setO] = useState<AutoCorrectOptions>(() => ({ ...loadAutoCorrect() }));
  const [text, setText] = useState(() => listText(loadAutoCorrect().list));
  const save = () => { saveAutoCorrect({ ...o, list: parseList(text) }); onClose(); };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="AutoCorect" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>AutoCorect</h3>
        <p className="print-info">Se aplică în timp ce scrii. Ctrl+Z sau Backspace imediat după o corectură o anulează.</p>
        {CHECKS.map(([k, label], i) => (
          <label key={k} className="print-row">
            <input type="checkbox" autoFocus={i === 0} checked={!!o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} /> {label}
          </label>
        ))}
        <div className="print-row"><span className="print-label">Înlocuiri (câte una pe rând: greșit → corect)</span></div>
        <textarea className="print-area ac-list" rows={9} value={text} aria-label="Lista de înlocuiri" spellCheck={false}
          onChange={(e) => setText(e.target.value)} style={{ width: '100%', fontFamily: 'inherit' }} />
        <div className="print-actions">
          <button onClick={() => setText(listText(DEFAULT_LIST))} title="Pune înapoi lista de la început">Lista inițială</button>
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={save}>Gata</button>
        </div>
      </div>
    </div>
  );
}
