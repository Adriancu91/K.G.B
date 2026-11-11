// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Trimite o observație” (mereu la vedere, jos în bara din stânga): scrii ce nu merge; se păstrează o poză a ferestrei,
// aplicația și fișierul de acum. Totul se salvează doar pe calculator (Documente\Suite\Observații); utilizatorul trimite el fișierele.
import { useEffect, useRef, useState } from 'react';
import { api } from './api';

interface Props { where: string; file: string; onClose: () => void; png: Uint8Array | null }

// Capturile atașate de om (lipite cu Ctrl+V sau alese din fișiere): PNG sau JPEG, cel mult 5.
const MAX_IMAGES = 5;
type Shot = { name: string; data: Uint8Array; url: string };

export default function Feedback({ where, file, onClose, png }: Props) {
  const [text, setText] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const shotsRef = useRef<Shot[]>([]);
  shotsRef.current = shots;
  const pick = useRef<HTMLInputElement>(null);
  const addFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type === 'image/png' || f.type === 'image/jpeg');
    const read = await Promise.all(imgs.map(async (f, i) => {
      const data = new Uint8Array(await f.arrayBuffer());
      return { name: f.name || `captura-${i + 1}.${f.type === 'image/png' ? 'png' : 'jpg'}`, data, url: URL.createObjectURL(f) };
    }));
    setShots((s) => {
      const next = [...s, ...read];
      next.slice(MAX_IMAGES).forEach((x) => URL.revokeObjectURL(x.url));
      return next.slice(0, MAX_IMAGES);
    });
  };
  const [withPic, setWithPic] = useState(!!png);
  const [saved, setSaved] = useState<{ dir: string; txt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const url = useRef<string | null>(null);
  if (png && !url.current) url.current = URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' }));
  useEffect(() => { box.current?.focus(); return () => { if (url.current) URL.revokeObjectURL(url.current); shotsRef.current.forEach((x) => URL.revokeObjectURL(x.url)); }; }, []);

  const save = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api.feedbackSave({ text: text.trim(), module: where, file, png: withPic ? png : null, images: shots.map(({ name, data }) => ({ name, data })) });
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
              onPaste={(e) => {
                const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
                if (files.length) { e.preventDefault(); void addFiles(files); }
              }}
              placeholder="De exemplu: am apăsat Salvează și n-a apărut fereastra…" aria-label="Observația" />
            <div className="feedback-where">Aplicația: <b>{where}</b>{file ? <> · Fișierul: <b>{file}</b></> : null}</div>
            {png && (
              <label className="feedback-pic">
                <input type="checkbox" checked={withPic} onChange={(e) => setWithPic(e.target.checked)} />
                <span>Pune și poza ferestrei</span>
                {url.current && <img src={url.current} alt="Poza ferestrei" />}
              </label>
            )}
            <div className="feedback-shots">
              <button type="button" disabled={shots.length >= MAX_IMAGES} onClick={() => pick.current?.click()}>Adaugă o captură…</button>
              <span className="muted small">sau lipește una în text cu Ctrl+V (de exemplu după Win+Shift+S); cel mult 5</span>
              <input ref={pick} type="file" accept="image/png,image/jpeg" multiple hidden aria-label="Capturi de atașat"
                onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
              {shots.length > 0 && (
                <ul aria-label="Capturi atașate">
                  {shots.map((x, i) => (
                    <li key={x.url}>
                      <img src={x.url} alt={x.name} />
                      <button type="button" className="link" onClick={() => { URL.revokeObjectURL(x.url); setShots((s) => s.filter((_, j) => j !== i)); }}>scoate</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
