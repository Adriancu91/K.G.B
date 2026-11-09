// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Plic”: adresa destinatarului, a expeditorului și mărimea plicului; rezultatul se deschide ca document nou.
// Cu „Un plic pentru fiecare rând dintr-un tabel”, destinatarul se completează din câmpurile tabelului («Bloc de adresă»…).
import { useState } from 'react';
import { ENVELOPES, envelopeFile, envelopeName, envelopesMergeDoc, type EnvelopeSize } from './envelope';
import { serializeDoc } from './format';
import { ADDRESS_FIELD, type MergeData } from './merge';
import MergeSource, { withField } from './MergeSource';

const SENDER = 'suite.docs.envelopeFrom';
const remembered = () => { try { return localStorage.getItem(SENDER) ?? ''; } catch { return ''; } };

export default function EnvelopeDialog({ initial, onCreate, onClose }: { initial: string; onCreate(content: string): void; onClose(): void }) {
  const [to, setTo] = useState(initial);
  const [from, setFrom] = useState(remembered);
  const [size, setSize] = useState<EnvelopeSize>('DL');
  const [fromList, setFromList] = useState(false);
  const [data, setData] = useState<MergeData | null>(null);
  const rows = data ? data.rows.map((_, i) => i) : [];
  const count = fromList && data ? envelopesMergeDoc(to, from, size, data, rows).count : 0;
  const onData = (d: MergeData) => { setData(d); if (!to.includes('«')) setTo(`«${ADDRESS_FIELD}»`); };
  const create = () => {
    // Expeditorul se ține minte pentru data viitoare (de obicei e mereu același).
    try { localStorage.setItem(SENDER, from); } catch { /* fără memorie locală */ }
    if (fromList && data) { const m = envelopesMergeDoc(to, from, size, data, rows); onCreate(serializeDoc(m.doc, m.page)); return; }
    onCreate(envelopeFile(to, from, size));
  };

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Plic" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Plic</h3>
        <p className="print-info">Adresele puse pe un plic: destinatarul spre dreapta jos, expeditorul sus în stânga. Se deschide un document nou cât plicul, gata de tipărit.</p>
        <div className="print-row">
          <span className="print-label">Destinatar</span>
          <textarea aria-label="Adresa destinatarului" rows={4} cols={34} value={to} autoFocus onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="print-row">
          <span className="print-label">Din tabel</span>
          <div className="print-opts">
            <label><input type="checkbox" checked={fromList} onChange={(e) => setFromList(e.target.checked)} /> Un plic pentru fiecare rând dintr-un tabel</label>
            {fromList && <MergeSource data={data} onData={onData} onField={(h) => setTo((t) => withField(t, h))} />}
            {fromList && data && <span>{data.source}: {count} {count === 1 ? 'plic' : 'plicuri'}</span>}
          </div>
        </div>
        <div className="print-row">
          <span className="print-label">Expeditor</span>
          <textarea aria-label="Adresa expeditorului" rows={3} cols={34} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="(opțional)" />
        </div>
        <div className="print-row">
          <span className="print-label">Plicul</span>
          <select aria-label="Mărimea plicului" value={size} onChange={(e) => setSize(e.target.value as EnvelopeSize)}>
            {ENVELOPES.map((s) => <option key={s} value={s}>{envelopeName(s)}</option>)}
          </select>
        </div>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" disabled={!to.trim() || (fromList && !count)} onClick={create}>{fromList ? 'Document nou cu plicurile' : 'Document nou cu plicul'}</button>
        </div>
      </div>
    </div>
  );
}
