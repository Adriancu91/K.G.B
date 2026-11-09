// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Proprietăți tabel (ca fereastra Table Properties): într-un singur loc, așezarea, potrivirea, indentarea și marginile celulelor tabelului, înălțimea rândului,
// antetul repetat și ruperea rândului între pagini, lățimea coloanei, alinierea verticală în celulă și textul alternativ. Schimbările se văd pe loc,
// fiecare cu pasul ei de anulare (Ctrl+Z).
import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { columnWidthAt, setColumnWidth, setTableFit, tableAt } from './tableOps';
import { rowHeightAt, rowNoSplitAt, setRowHeight, setRowNoSplit } from './tableRowHeight';
import { isRepeatOn, toggleRepeatHeader } from './tableHeaderRepeat';
import { altAttr } from './tableBorders';

interface Props { editor: Editor; onClose(): void }

/** „1,5” / „1.5” → 1.5; gol → null; altceva → NaN. */
const cmOf = (t: string): number | null => { const v = t.trim().replace(',', '.'); return v ? Number(v) : null; };
const cmText = (v: number | null) => (v === null ? '' : v.toLocaleString('ro-RO'));

export default function TablePropsDialog({ editor, onClose }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    editor.on('transaction', on);
    return () => { editor.off('transaction', on); };
  }, [editor]);
  const st = editor.state;
  const where = tableAt(st);
  const run = (cmd: (s: typeof st, d?: typeof editor.view.dispatch) => boolean) => cmd(editor.state, editor.view.dispatch);
  const tAttrs = where?.table.attrs ?? {};
  const cell = editor.isActive('tableHeader') ? editor.getAttributes('tableHeader') : editor.getAttributes('tableCell');
  const [rowH, setRowH] = useState(cmText(rowHeightAt(st)));
  const [colW, setColW] = useState(cmText(columnWidthAt(st)));
  const [indent, setIndent] = useState(cmText((where?.table.attrs.indent as number | null) ?? null));
  const [pad, setPad] = useState(cmText((where?.table.attrs.pad as number | null) ?? null));
  const [altTitle, setAltTitle] = useState((where?.table.attrs.altTitle as string | null) ?? '');
  const [altDesc, setAltDesc] = useState((where?.table.attrs.altDesc as string | null) ?? '');
  const [msg, setMsg] = useState('');
  const tableAlt = (key: 'altTitle' | 'altDesc', text: string) => {
    const next = altAttr(text);
    if (next !== ((tableAt(editor.state)?.table.attrs[key] as string | null) ?? null)) editor.chain().updateAttributes('table', { [key]: next }).run();
  };
  const tableCm = (text: string, key: 'indent' | 'pad', bad: string) => {
    const v = cmOf(text);
    if (v !== null && !(v >= 0 && v <= 10)) { setMsg(bad); return; }
    setMsg('');
    const cur = (tableAt(editor.state)?.table.attrs[key] as number | null) ?? null;
    const next = v === null || (key === 'indent' && v === 0) ? null : Math.round(v * 100) / 100;
    if (next !== cur) editor.chain().updateAttributes('table', { [key]: next }).run();
  };
  const applyCm = (text: string, cur: number | null, set: (v: number | null) => boolean, bad: string) => {
    const v = cmOf(text);
    if (v !== null && !(v > 0 && v <= 50)) { setMsg(bad); return; }
    setMsg('');
    if ((v || null) !== cur) set(v);
  };
  if (!where) return null;
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg table-props-dlg" role="dialog" aria-label="Proprietăți tabel" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Proprietăți tabel</h3>
        <div className="print-row">
          <span className="print-label">Tabel</span>
          <div className="print-opts">
            <label>Așezare pe pagină{' '}
              <select aria-label="Așezarea tabelului" value={(tAttrs.align as string) ?? ''} onChange={(e) => editor.chain().updateAttributes('table', { align: e.target.value || null }).run()}>
                <option value="">La stânga</option>
                <option value="center">La centru</option>
                <option value="right">La dreapta</option>
              </select>
            </label>
            <label>Lățime{' '}
              <select aria-label="Lățimea tabelului" value={tAttrs.fit === 'content' ? 'content' : 'window'} onChange={(e) => run(setTableFit(e.target.value === 'content' ? 'content' : 'window'))}>
                <option value="window">Toată lățimea paginii</option>
                <option value="content">Cât textul din el</option>
              </select>
            </label>
            <label>Încadrarea textului{' '}
              <select aria-label="Încadrarea textului în jurul tabelului" value={tAttrs.wrap === 'around' ? 'around' : ''} onChange={(e) => editor.chain().updateAttributes('table', { wrap: e.target.value || null }).run()}>
                <option value="">Fără (textul sub tabel)</option>
                <option value="around">În jurul tabelului</option>
              </select>
            </label>
            <label title="Cât de departe de marginea din stânga a paginii începe tabelul (doar pentru tabelul așezat la stânga)">Indentare de la stânga{' '}
              <input className="fmt row-h" aria-label="Indentarea tabelului" placeholder="0" value={indent} disabled={!!tAttrs.align} onChange={(e) => setIndent(e.target.value)}
                onBlur={() => tableCm(indent, 'indent', 'Indentarea: scrie un număr de centimetri între 0 și 10')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} /> cm
            </label>
            <label title="Spațiul dintre marginea celulei și text, pe toate laturile, în toate celulele tabelului (gol = obișnuit)">Marginile celulelor{' '}
              <input className="fmt row-h" aria-label="Marginile celulelor" placeholder="auto" value={pad} onChange={(e) => setPad(e.target.value)}
                onBlur={() => tableCm(pad, 'pad', 'Marginile celulelor: scrie un număr de centimetri între 0 și 10 (gol = obișnuite)')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} /> cm
            </label>
          </div>
        </div>
        <div className="print-row">
          <span className="print-label">Rând</span>
          <div className="print-opts">
            <label>Înălțime (cel puțin){' '}
              <input className="fmt row-h" aria-label="Înălțimea rândului în dialog" placeholder="auto" value={rowH} onChange={(e) => setRowH(e.target.value)}
                onBlur={() => applyCm(rowH, rowHeightAt(editor.state), (v) => run(setRowHeight(v)), 'Înălțimea: scrie un număr de centimetri între 0,1 și 50 (gol = automată)')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} /> cm
            </label>
            <label><input type="checkbox" aria-label="Nu rupe rândul între pagini" checked={rowNoSplitAt(st)} onChange={(e) => run(setRowNoSplit(e.target.checked))} /> Rândul nu se rupe între pagini</label>
            <label><input type="checkbox" aria-label="Repetă ca rând de antet" checked={isRepeatOn(st)} onChange={() => run(toggleRepeatHeader)} /> Se repetă ca antet pe fiecare pagină (de sus până la rândul acesta)</label>
          </div>
        </div>
        <div className="print-row">
          <span className="print-label">Coloană</span>
          <div className="print-opts">
            <label>Lățime{' '}
              <input className="fmt row-h" aria-label="Lățimea coloanei" placeholder="auto" value={colW} onChange={(e) => setColW(e.target.value)}
                onBlur={() => applyCm(colW, columnWidthAt(editor.state), (v) => run(setColumnWidth(v)), 'Lățimea: scrie un număr de centimetri între 0,1 și 50 (gol = automată)')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} /> cm
            </label>
          </div>
        </div>
        <div className="print-row">
          <span className="print-label">Celulă</span>
          <div className="print-opts">
            <label>Alinierea textului pe înălțime{' '}
              <select aria-label="Alinierea verticală în dialog" value={(cell.verticalAlign as string) ?? ''} onChange={(e) => editor.chain().setCellAttribute('verticalAlign', e.target.value || null).run()}>
                <option value="">Sus</option>
                <option value="middle">La mijloc</option>
                <option value="bottom">Jos</option>
              </select>
            </label>
          </div>
        </div>
        <div className="print-row">
          <span className="print-label">Text alternativ</span>
          <div className="print-opts table-alt">
            <label>Titlu{' '}
              <input className="fmt" aria-label="Titlul tabelului" value={altTitle} onChange={(e) => setAltTitle(e.target.value)}
                onBlur={() => tableAlt('altTitle', altTitle)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
            </label>
            <label>Descriere{' '}
              <textarea aria-label="Descrierea tabelului" rows={3} value={altDesc} onChange={(e) => setAltDesc(e.target.value)} onBlur={() => tableAlt('altDesc', altDesc)} />
            </label>
            <span className="print-info">Ce conține tabelul, pentru cei care folosesc un cititor de ecran.</span>
          </div>
        </div>
        {msg && <p className="print-info merge-warn">{msg}</p>}
        <div className="print-actions">
          <button className="primary" onClick={onClose}>Gata</button>
        </div>
      </div>
    </div>
  );
}
