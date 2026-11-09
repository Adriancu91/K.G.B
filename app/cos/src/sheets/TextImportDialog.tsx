// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra Import din text (pentru .csv, .txt, .tsv, .prn): arată ce s-a ghicit (codificarea, separatorul, zecimalele,
// datele, capul de tabel) și primele rânduri cum vor arăta în tabel. De obicei ajunge un clic pe Încarcă; altfel se schimbă
// alegerile și previzualizarea se reface pe loc. Felul fiecărei coloane (general, text, dată, omisă) se alege deasupra ei.
import { useMemo, useState } from 'react';
import { convertValue, decodeText, ENCODINGS, guessOptions, sepName, splitText, type ColType, type TextEncoding, type TextOptions } from './textImport';
import { formatValue } from './numfmt';

const PREVIEW = 15;
const SEPS: [string, string][] = [[';', 'Punct și virgulă ( ; )'], [',', 'Virgulă ( , )'], ['\t', 'Tab'], ['|', 'Bară verticală ( | )'], [' ', 'Spațiu'], ['fixed', 'Lățime fixă (coloane aliniate)'], ['other', 'Alt caracter']];

/** Cum arată valoarea în tabel (pentru previzualizare). */
function shown(v: string, type: ColType, o: TextOptions, head: boolean): { text: string; right: boolean; kind: string } {
  if (head) return { text: v, right: false, kind: 'cap' };
  const c = convertValue(v, type, o);
  if (!c) return { text: '', right: false, kind: '' };
  const raw = c.raw.startsWith("'") ? c.raw.slice(1) : c.raw;
  if (!c.raw.startsWith("'") && /^-?\d+(,\d+)?$/.test(c.raw)) {
    const n = Number(c.raw.replace(',', '.'));
    return { text: c.fmt ? formatValue(n, c.fmt, c.dec) : raw, right: true, kind: c.fmt === 'date' || c.fmt === 'datetime' ? 'dată' : 'număr' };
  }
  return { text: raw, right: false, kind: 'text' };
}

export default function TextImportDialog({ name, size, data, initial, onImport, onClose }: {
  name: string; size: number; data: Uint8Array; initial: { text: string; options: TextOptions };
  onImport(o: TextOptions, text: string): void; onClose(): void;
}) {
  const [text, setText] = useState(initial.text);
  const [o, setO] = useState<TextOptions>(initial.options);
  const [other, setOther] = useState(() => (SEPS.some(([s]) => s === initial.options.sep) ? '' : initial.options.sep));
  const set = (p: Partial<TextOptions>) => setO((x) => ({ ...x, ...p }));
  const sepChoice = SEPS.some(([s]) => s === o.sep && s !== 'other') ? o.sep : 'other';
  const rows = useMemo(() => splitText(text, o, PREVIEW), [text, o]);
  const width = Math.min(60, rows.reduce((w, r) => Math.max(w, r.length), 0));
  const setEncoding = (enc: TextEncoding) => {
    const t = decodeText(data, enc);
    setText(t);
    set({ encoding: enc });
  };
  const guessAgain = () => { setO(guessOptions(text, o.encoding)); setOther(''); };
  const setType = (c: number, t: ColType) => setO((x) => { const types = [...x.types]; types[c] = t; return { ...x, types }; });
  const go = () => onImport(o, text);
  const kb = size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Import din text" style={{ width: 'min(920px, 96vw)', maxHeight: '92vh', overflow: 'auto' }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'Enter' && !(e.target instanceof HTMLSelectElement)) { e.preventDefault(); go(); }
        }}>
        <h3>Import din text</h3>
        <p className="print-info" data-testid="ti-guess">
          {name} ({kb}). Am recunoscut: {ENCODINGS.find(([k]) => k === o.encoding)?.[1] ?? o.encoding}, separator {sepName(o.sep)}, zecimale cu {o.decimal === ',' ? 'virgulă' : 'punct'}
          {o.header ? ', primul rând e capul de tabel' : ''}. Dacă previzualizarea arată bine, apasă Încarcă.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '6px 16px' }}>
          <label className="print-row"><span className="print-label">Codificare</span>
            <select value={o.encoding} onChange={(e) => setEncoding(e.target.value as TextEncoding)} aria-label="Codificare">
              {ENCODINGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="print-row"><span className="print-label">Separator</span>
            <select value={sepChoice} aria-label="Separator" onChange={(e) => {
              const v = e.target.value;
              if (v === 'other') set({ sep: other || ':' });
              else set({ sep: v, ...(v === 'fixed' && !o.breaks.length ? { breaks: [10] } : {}) });
            }}>
              {SEPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {sepChoice === 'other' && <input style={{ width: 40 }} maxLength={1} value={o.sep} aria-label="Alt separator"
              onChange={(e) => { const v = e.target.value.slice(-1); setOther(v); if (v) set({ sep: v }); }} />}
          </label>
          {o.sep === 'fixed' ? (
            <label className="print-row"><span className="print-label">Coloanele încep la</span>
              <input className="print-area" aria-label="Coloanele încep la" title="Pozițiile (în caractere de la începutul rândului) unde începe fiecare coloană, despărțite prin virgulă"
                defaultValue={o.breaks.join(', ')} onChange={(e) => set({ breaks: e.target.value.split(/[^\d]+/).filter(Boolean).map(Number).filter((n) => n > 0) })} />
            </label>
          ) : (
            <label className="print-row"><span className="print-label">Ghilimele</span>
              <select value={o.quote} onChange={(e) => set({ quote: e.target.value })} aria-label="Ghilimele">
                <option value={'"'}>" (obișnuite)</option>
                <option value="'">' (apostrof)</option>
                <option value="">Fără</option>
              </select>
            </label>
          )}
          <label className="print-row"><span className="print-label">Începe de la rândul</span>
            <input type="number" min={1} style={{ width: 80 }} value={o.start + 1} aria-label="Începe de la rândul"
              onChange={(e) => set({ start: Math.max(0, (parseInt(e.target.value, 10) || 1) - 1) })} />
          </label>
          <label className="print-row"><span className="print-label">Zecimale</span>
            <select value={o.decimal} onChange={(e) => set({ decimal: e.target.value as ',' | '.' })} aria-label="Zecimale">
              <option value=",">Virgulă (1.234,56)</option>
              <option value=".">Punct (1,234.56)</option>
            </select>
          </label>
          <label className="print-row"><span className="print-label">Date</span>
            <select value={o.dates} onChange={(e) => set({ dates: e.target.value as TextOptions['dates'] })} aria-label="Date">
              <option value="dmy">zi.lună.an (28.10.2026)</option>
              <option value="mdy">lună/zi/an (10/28/2026)</option>
              <option value="ymd">an-lună-zi (2026-10-28)</option>
            </select>
          </label>
          <label className="print-row"><input type="checkbox" checked={o.header} onChange={(e) => set({ header: e.target.checked })} /> Primul rând e capul de tabel (îngroșat)</label>
          {o.sep !== 'fixed' && <label className="print-row"><input type="checkbox" checked={o.mergeSeps} onChange={(e) => set({ mergeSeps: e.target.checked })} /> Separatoarele la rând contează ca unul singur</label>}
        </div>
        <div style={{ overflow: 'auto', maxHeight: 340, border: '1px solid var(--border, #ccc)', marginTop: 8 }}>
          <table data-testid="ti-preview" style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                {Array.from({ length: width }, (_, c) => (
                  <th key={c} style={{ padding: 2, position: 'sticky', top: 0, background: 'var(--panel, #f3f3f3)' }}>
                    <select value={o.types[c] ?? 'general'} onChange={(e) => setType(c, e.target.value as ColType)} aria-label={`Coloana ${c + 1}`} title="Felul coloanei: General recunoaște numerele și datele; Text le lasă exact cum sunt (de exemplu codurile); Omite nu aduce coloana">
                      <option value="general">General</option>
                      <option value="text">Text</option>
                      <option value="date">Dată</option>
                      <option value="skip">Omite</option>
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {Array.from({ length: width }, (_, c) => {
                    const skip = o.types[c] === 'skip';
                    const s = shown(r[c] ?? '', o.types[c] ?? 'general', o, o.header && ri === 0);
                    return (
                      <td key={c} title={s.kind} style={{ border: '1px solid var(--border, #ddd)', padding: '1px 6px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
                        textAlign: s.right ? 'right' : 'left', fontWeight: o.header && ri === 0 ? 600 : undefined, opacity: skip ? 0.35 : 1, textDecoration: skip ? 'line-through' : undefined }}>
                        {skip ? (r[c] ?? '') : s.text.replace(/\r?\n|\r/g, ' ⏎ ')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="print-info" style={{ padding: 8 }}>Fișierul e gol (sau nu are rânduri de la rândul ales).</p>}
        </div>
        <p className="print-info">Previzualizare: primele {PREVIEW} rânduri. Numerele sunt aliniate la dreapta; codurile cu zero în față, CNP-urile și telefoanele rămân text.</p>
        <div className="print-actions">
          <button onClick={guessAgain} title="Refă alegerile ghicite automat">Ghicește din nou</button>
          <button onClick={onClose}>Renunță</button>
          <button className="primary" autoFocus onClick={go}>Încarcă</button>
        </div>
      </div>
    </div>
  );
}

/** Fereastra Import .docx (tabele): unde se pun tabelele și dacă vine și textul dintre ele. */
export function DocTablesDialog({ name, tables, onImport, onClose }: {
  name: string; tables: number; onImport(o: { layout: 'sheets' | 'stack'; paragraphs: boolean }): void; onClose(): void;
}) {
  const [layout, setLayout] = useState<'sheets' | 'stack'>(tables > 1 ? 'sheets' : 'stack');
  const [paragraphs, setParagraphs] = useState(false);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Import tabele din document" onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter') { e.preventDefault(); onImport({ layout, paragraphs }); }
      }}>
        <h3>Import tabele din document</h3>
        <p className="print-info">{name}: {tables === 1 ? 'un tabel' : `${tables} tabele`}. Celulele unite rămân unite, numerele și datele devin numere și date.</p>
        <label className="print-row"><input type="radio" name="dt-layout" checked={layout === 'sheets'} onChange={() => setLayout('sheets')} /> Fiecare tabel pe foaia lui</label>
        <label className="print-row"><input type="radio" name="dt-layout" checked={layout === 'stack'} onChange={() => setLayout('stack')} /> Toate pe o foaie, unul sub altul</label>
        <label className="print-row"><input type="checkbox" checked={paragraphs} onChange={(e) => setParagraphs(e.target.checked)} /> Și textul dintre tabele (ca rânduri)</label>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" autoFocus onClick={() => onImport({ layout, paragraphs })}>Încarcă</button>
        </div>
      </div>
    </div>
  );
}
