// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Etichete”: textul etichetei (de exemplu o adresă), foaia de etichete și dacă textul se pune pe toată foaia,
// doar pe o etichetă sau câte o etichetă pentru fiecare rând dintr-un tabel (adresele clienților, cu câmpurile «Nume»);
// rezultatul se deschide ca document nou, gata de tipărit.
import { useState } from 'react';
import { LABEL_SHEETS, labelsFile, labelsMergeDoc, MAX_MERGE_LABELS, sheetById } from './labels';
import { ADDRESS_FIELD, type MergeData } from './merge';
import MergeSource, { withField } from './MergeSource';
import { serializeDoc } from './format';

type Where = 'all' | 'one' | 'list';

export default function LabelsDialog({ initial, onCreate, onClose }: { initial: string; onCreate(content: string): void; onClose(): void }) {
  const [text, setText] = useState(initial);
  const [sheetId, setSheetId] = useState(LABEL_SHEETS[0].id);
  const [where, setWhere] = useState<Where>('all');
  const [row, setRow] = useState(1);
  const [col, setCol] = useState(1);
  const [data, setData] = useState<MergeData | null>(null);
  const sheet = sheetById(sheetId);
  const rows = data ? data.rows.map((_, i) => i) : [];
  const count = data ? labelsMergeDoc(text, sheet, data, rows).count : 0;
  const per = sheet.cols * sheet.rows;

  const onData = (d: MergeData) => {
    setData(d); setWhere('list');
    // Fără text scris: blocul de adresă (numele și adresa din coloanele tabelului).
    if (!text.includes('«')) setText(`«${ADDRESS_FIELD}»`);
  };
  const create = () => {
    if (where === 'list' && data) {
      const m = labelsMergeDoc(text, sheet, data, rows);
      onCreate(serializeDoc(m.doc, m.page));
      return;
    }
    onCreate(labelsFile(text, sheet, where === 'one' ? { row: Math.min(row, sheet.rows), col: Math.min(col, sheet.cols) } : undefined));
  };

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Etichete" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Etichete</h3>
        <p className="print-info">Același text pe o foaie de etichete autocolante (adrese, nume, coduri), sau câte o etichetă pentru fiecare rând dintr-un tabel. Se deschide un document nou, gata de tipărit pe A4.</p>
        <div className="print-row">
          <span className="print-label">Textul</span>
          <textarea aria-label="Textul etichetei" rows={4} cols={34} value={text} autoFocus onChange={(e) => setText(e.target.value)} placeholder={'Ion Popescu\nStr. Exemplu nr. 1\n010101 București'} />
        </div>
        <div className="print-row">
          <span className="print-label">Foaia</span>
          <select aria-label="Foaia de etichete" value={sheetId} onChange={(e) => setSheetId(e.target.value)}>
            {LABEL_SHEETS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="print-row">
          <span className="print-label">Unde</span>
          <div className="print-opts">
            <label><input type="radio" name="labels-where" checked={where === 'all'} onChange={() => setWhere('all')} /> Pe toată foaia ({per})</label>
            <label><input type="radio" name="labels-where" checked={where === 'one'} onChange={() => setWhere('one')} /> O singură etichetă: rândul
              <input type="number" aria-label="Rândul etichetei" min={1} max={sheet.rows} value={row} disabled={where !== 'one'} onChange={(e) => setRow(Math.max(1, Number(e.target.value) || 1))} style={{ width: 48 }} />
              coloana <input type="number" aria-label="Coloana etichetei" min={1} max={sheet.cols} value={col} disabled={where !== 'one'} onChange={(e) => setCol(Math.max(1, Number(e.target.value) || 1))} style={{ width: 48 }} />
            </label>
            <label><input type="radio" name="labels-where" checked={where === 'list'} onChange={() => setWhere('list')} /> O etichetă pentru fiecare rând dintr-un tabel</label>
            {where === 'list' && (
              <>
                <MergeSource data={data} onData={onData} onField={(h) => setText((t) => withField(t, h))} />
                {data && <span>{data.source}: {count} {count === 1 ? 'etichetă' : 'etichete'}, {Math.max(1, Math.ceil(count / per))} {Math.ceil(count / per) > 1 ? 'foi' : 'foaie'}</span>}
                {data && rows.length > MAX_MERGE_LABELS && <span className="sheet-err-help">Doar primele {MAX_MERGE_LABELS} rânduri.</span>}
              </>
            )}
          </div>
        </div>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" disabled={!text.trim() || (where === 'list' && (!data || !count))} onClick={create}>Document nou cu etichete</button>
        </div>
      </div>
    </div>
  );
}
