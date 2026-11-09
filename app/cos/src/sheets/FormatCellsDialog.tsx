// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Formatare celule” (Ctrl+1): toate formatările celulelor într-un singur loc, pe file:
// Număr, Aliniere, Font, Chenar, Umplere, Protecție; jos se vede pe loc cum arată celula curentă.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FONTS, FONT_SIZES, MAX_IND, ROTATIONS, STACKED, type CellStyle } from './format';
import { NUM_FORMATS, DEFAULT_DEC, type NumFmt } from './numfmt';
import { BORDER_KINDS, LINE_STYLES, type BorderKind, type LineStyle } from './border';
import { styleChanges, type StyleChanges } from './cellsFormat';

const TABS = [['num', 'Număr'], ['align', 'Aliniere'], ['font', 'Font'], ['border', 'Chenar'], ['fill', 'Umplere'], ['prot', 'Protecție']] as const;
export type FormatTab = typeof TABS[number][0];
const FILLS = ['#ffffff', '#f2f2f2', '#d9d9d9', '#fff2cc', '#ffe699', '#fce4d6', '#f8cbad', '#e2efda', '#c6e0b4', '#ddebf7', '#bdd7ee', '#e4dfec', '#ffc7ce', '#c00000', '#ffc000', '#00b050', '#0070c0', '#7030a0'];
const WITH_DEC: NumFmt[] = ['number', 'lei', 'acct', 'eur', 'percent', 'sci'];

export default function FormatCellsDialog({ start, where, tab: tab0 = 'num', preview, onOk, onClose }: {
  start: CellStyle; where: string; tab?: FormatTab;
  /** Textul celulei curente cu formatul dat. */
  preview(st: CellStyle): string;
  onOk(ch: StyleChanges, border: { kind: BorderKind; look: { st?: LineStyle; col?: string } } | null): void;
  onClose(): void;
}) {
  const [tab, setTab] = useState<FormatTab>(tab0);
  // Focusul intră în fereastră (deschisă cu Ctrl+1 din tabel), ca Esc și Enter să meargă imediat.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  const [st, setSt] = useState<CellStyle>({ ...start });
  const [bKind, setBKind] = useState<BorderKind | ''>('');
  const [bLine, setBLine] = useState<LineStyle | ''>(start.bdStyle ?? '');
  const [bCol, setBCol] = useState<string>(start.bdColor ?? '');
  const set = (p: Partial<CellStyle>) => setSt((s) => ({ ...s, ...p }));
  const fmtSel = st.code !== undefined ? 'custom' : st.fmt ?? 'general';
  const ok = () => onOk(styleChanges(start, st), bKind ? { kind: bKind, look: { st: bLine || undefined, col: bCol || undefined } } : null);

  const look: CSSProperties = {
    fontFamily: st.font, fontSize: st.sz ? `${st.sz}pt` : undefined, fontWeight: st.b ? 700 : undefined, fontStyle: st.i ? 'italic' : undefined,
    textDecoration: [st.u && 'underline', st.s && 'line-through'].filter(Boolean).join(' ') || undefined,
    color: st.color, background: st.bg, textAlign: st.align === 'across' ? 'center' : st.align,
  };
  const check = (k: 'b' | 'i' | 'u' | 's' | 'wrap', label: string) => (
    <label className="print-check"><input type="checkbox" checked={!!st[k]} onChange={(e) => set({ [k]: e.target.checked || undefined })} /> {label}</label>
  );

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg fmtcells-dlg" role="dialog" aria-label="Formatare celule" ref={box} tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'Enter' && !(e.target instanceof HTMLSelectElement) && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); ok(); }
        }}>
        <h3>Formatare celule <small className="print-info">({where})</small></h3>
        <div className="fmtcells-tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} data-tab={k} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div className="fmtcells-body">
          {tab === 'num' && (
            <>
              <label>Categoria
                <select size={8} aria-label="Formatul numerelor" value={fmtSel}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'custom') set({ code: st.code ?? '', fmt: undefined, dec: undefined });
                    else set({ fmt: v === 'general' ? undefined : v as NumFmt, dec: undefined, code: undefined });
                  }}>
                  {NUM_FORMATS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  <option value="custom">Particularizat (cod)</option>
                </select>
              </label>
              {fmtSel !== 'custom' && WITH_DEC.includes(fmtSel as NumFmt) && (
                <label>Zecimale
                  <input type="number" min={0} max={10} aria-label="Zecimale" value={st.dec ?? DEFAULT_DEC[fmtSel as NumFmt]}
                    onChange={(e) => set({ dec: Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0))) })} />
                </label>
              )}
              {fmtSel === 'custom' && (
                <label>Codul formatului
                  <input aria-label="Codul formatului" value={st.code ?? ''} maxLength={200} placeholder='de exemplu #,##0.00 "buc."' onChange={(e) => set({ code: e.target.value })} />
                </label>
              )}
            </>
          )}
          {tab === 'align' && (
            <>
              <label>Orizontal
                <select aria-label="Aliniere orizontală" value={st.align ?? ''} onChange={(e) => set({ align: (e.target.value || undefined) as CellStyle['align'] })}>
                  <option value="">Implicit (textul la stânga, numerele la dreapta)</option>
                  <option value="left">Stânga</option><option value="center">Centru</option><option value="right">Dreapta</option>
                  <option value="across">Centrat pe selecție</option>
                </select>
              </label>
              <label>Vertical
                <select aria-label="Aliniere verticală" value={st.va ?? ''} onChange={(e) => set({ va: (e.target.value || undefined) as CellStyle['va'] })}>
                  <option value="">Implicit</option><option value="top">Sus</option><option value="middle">Mijloc</option><option value="bottom">Jos</option>
                </select>
              </label>
              <label>Retragere
                <input type="number" min={0} max={MAX_IND} aria-label="Retragere" value={st.ind ?? 0}
                  onChange={(e) => { const n = Math.max(0, Math.min(MAX_IND, Math.round(Number(e.target.value) || 0))); set({ ind: n || undefined }); }} />
              </label>
              <label>Orientare
                <select aria-label="Orientare" value={ROTATIONS.some(([r]) => r === (st.rot ?? 0)) ? String(st.rot ?? 0) : 'x'}
                  onChange={(e) => { if (e.target.value !== 'x') { const r = Number(e.target.value); set({ rot: r || undefined }); } }}>
                  {ROTATIONS.map(([r, label]) => <option key={r} value={r}>{label}</option>)}
                  {!ROTATIONS.some(([r]) => r === (st.rot ?? 0)) && <option value="x">{st.rot}°</option>}
                </select>
              </label>
              <label>Grade
                <input type="number" min={-90} max={90} aria-label="Grade" disabled={st.rot === STACKED} value={st.rot === STACKED ? 0 : st.rot ?? 0}
                  onChange={(e) => { const r = Math.max(-90, Math.min(90, Math.round(Number(e.target.value) || 0))); set({ rot: r || undefined }); }} />
              </label>
              {check('wrap', 'Încadrează textul (pe mai multe rânduri)')}
            </>
          )}
          {tab === 'font' && (
            <>
              <label>Font
                <select aria-label="Font" value={st.font ?? ''} onChange={(e) => set({ font: e.target.value || undefined })}>
                  <option value="">Implicit</option>
                  {[...FONTS, ...(st.font && !FONTS.includes(st.font) ? [st.font] : [])].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label>Mărime
                <select aria-label="Mărime" value={st.sz ?? ''} onChange={(e) => set({ sz: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Implicită</option>
                  {[...new Set([...FONT_SIZES, ...(st.sz ? [st.sz] : [])])].sort((a, b) => a - b).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className="fmtcells-row">{check('b', 'Aldin')}{check('i', 'Cursiv')}{check('u', 'Subliniat')}{check('s', 'Tăiat')}</div>
              <label>Efect
                <select aria-label="Efect" value={st.pos ?? ''} onChange={(e) => set({ pos: (e.target.value || undefined) as CellStyle['pos'] })}>
                  <option value="">Normal</option><option value="sup">Exponent (x²)</option><option value="sub">Indice (x₂)</option>
                </select>
              </label>
              <label>Culoare
                <span className="fmtcells-row">
                  <input type="color" aria-label="Culoarea textului" value={st.color ?? '#000000'} onChange={(e) => set({ color: e.target.value })} />
                  <button onClick={() => set({ color: undefined })} disabled={!st.color}>Automată</button>
                </span>
              </label>
            </>
          )}
          {tab === 'border' && (
            <>
              <label>Chenar
                <select aria-label="Chenar" value={bKind} onChange={(e) => setBKind(e.target.value as BorderKind | '')}>
                  <option value="">Neschimbat</option>
                  {BORDER_KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </label>
              <label>Linia
                <select aria-label="Linia chenarului" value={bLine} onChange={(e) => setBLine(e.target.value as LineStyle | '')}>
                  {LINE_STYLES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </label>
              <label>Culoarea liniei
                <span className="fmtcells-row">
                  <input type="color" aria-label="Culoarea chenarului" value={bCol || '#000000'} onChange={(e) => setBCol(e.target.value)} />
                  <button onClick={() => setBCol('')} disabled={!bCol}>Automată</button>
                </span>
              </label>
              <p className="print-info">Chenarul se pune pe toată selecția când apeși OK.</p>
            </>
          )}
          {tab === 'fill' && (
            <>
              <div className="fmtcells-fills" aria-label="Culori de umplere">
                {FILLS.map((c) => <button key={c} className={st.bg === c ? 'on' : ''} style={{ background: c }} title={c} aria-label={`Umplere ${c}`} onClick={() => set({ bg: c })} />)}
              </div>
              <label>Altă culoare
                <span className="fmtcells-row">
                  <input type="color" aria-label="Culoarea de umplere" value={st.bg ?? '#ffffff'} onChange={(e) => set({ bg: e.target.value })} />
                  <button onClick={() => set({ bg: undefined })} disabled={!st.bg}>Fără umplere</button>
                </span>
              </label>
            </>
          )}
          {tab === 'prot' && (
            <>
              <label className="print-check"><input type="checkbox" aria-label="Blocată" checked={!st.unlock} onChange={(e) => set({ unlock: e.target.checked ? undefined : true })} /> Blocată</label>
              <p className="print-info">Celulele blocate nu se pot schimba când foaia e protejată (🔒 Protejează foaia). Debifează pentru celulele de completat.</p>
            </>
          )}
        </div>
        <div className="fmtcells-prev" aria-label="Previzualizare" style={look}>{preview(st) || 'Exemplu'}</div>
        <div className="print-actions">
          <button onClick={onClose}>Anulează</button>
          <button className="primary" onClick={ok}>OK</button>
        </div>
      </div>
    </div>
  );
}
