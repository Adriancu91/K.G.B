// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Trimite o observație” (mereu la vedere, jos în bara din stânga): scrii ce nu merge; se păstrează o poză a ferestrei,
// aplicația și fișierul de acum. Totul se salvează doar pe calculator (Documente\Suite\Observații); utilizatorul trimite el fișierele.
import { useEffect, useRef, useState } from 'react';
import { api } from './api';

interface Props { where: string; file: string; onClose: () => void; png: Uint8Array | null }

export default function Feedback({ where, file, onClose, png }: Props) {
  const [text, setText] = useState('');
  const [withPic, setWithPic] = useState(!!png);
  const [saved, setSaved] = useState<{ dir: string; txt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const url = useRef<string | null>(null);
  if (png && !url.current) url.current = URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' }));
  useEffect(() => { box.current?.focus(); return () => { if (url.current) URL.revokeObjectURL(url.current); }; }, []);

  const save = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api.feedbackSave({ text: text.trim(), module: where, file, png: withPic ? png : null });
      setSaved(res);
    } catch (e) {
      alert('Observația nu s-a putut salva: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="print-overlay ask-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !text.trim()) onClose(); }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter' && e.ctrlKey && !saved) { e.preventDefault(); save(); }
      }}>
      <div className="print-dlg feedback-dlg" role="dialog" aria-modal="true" aria-label="Trimite o observație">
        <h3>💬 Trimite o observație</h3>
        {!saved ? (
          <>
            <p className="ask-msg">Scrie ce nu merge sau ce ai vrea altfel. Se salvează doar pe calculatorul tău, cu o poză a ferestrei; nimic nu pleacă singur pe internet.</p>
            <textarea ref={box} className="feedback-text" rows={6} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="De exemplu: am apăsat Salvează și n-a apărut fereastra…" aria-label="Observația" />
            <div className="feedback-where">Aplicația: <b>{where}</b>{file ? <> · Fișierul: <b>{file}</b></> : null}</div>
            {png && (
              <label className="feedback-pic">
                <input type="checkbox" checked={withPic} onChange={(e) => setWithPic(e.target.checked)} />
                <span>Pune și poza ferestrei</span>
                {url.current && <img src={url.current} alt="Poza ferestrei" />}
              </label>
            )}
            <div className="print-actions">
              <button onClick={onClose}>Renunță</button>
              <button className="primary" disabled={!text.trim() || busy} onClick={save} title="Ctrl+Enter">Salvează observația</button>
            </div>
          </>
        ) : (
          <>
            <p className="ask-msg feedback-done">Am salvat observația în dosarul{'\n'}{saved.dir}{'\n\n'}Când ai timp, trimite fișierele de acolo (le poți pune într-un e-mail).</p>
            <div className="print-actions">
              <button onClick={() => { api.feedbackOpenDir().catch(() => {}); }}>Deschide dosarul</button>
              <button className="primary" autoFocus onClick={onClose}>Închide</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
