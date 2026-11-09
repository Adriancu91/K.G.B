// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Ecuație” din Docs: ecuația scrisă pe un rând, modele de pus cu un clic și simboluri, cu previzualizare.
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EQ_MAX, EQ_TEMPLATES, equationLatex, equationSvg, DocEquation } from './equation';

const SYMBOLS = ['±', '×', '÷', '·', '≤', '≥', '≠', '≈', '→', '∞', '∈', '∪', '∩', 'α', 'β', 'γ', 'δ', 'θ', 'λ', 'μ', 'π', 'σ', 'φ', 'ω', 'Δ', 'Σ', 'Ω', '°'];

export default function EquationDialog({ equation, onDone, onClose }: { equation: DocEquation; onDone(e: DocEquation): void; onClose(): void }) {
  const [src, setSrc] = useState(equation.src);
  const [copied, setCopied] = useState<'' | 'ok' | 'err'>('');
  // Ecuația scrisă cu bară inversă, de lipit în alte programe, pe site-uri sau într-un mesaj.
  const copyLatex = () => navigator.clipboard.writeText(equationLatex(src)).then(() => setCopied('ok'), () => setCopied('err')).finally(() => setTimeout(() => setCopied(''), 2000));
  const input = useRef<HTMLTextAreaElement>(null);
  const preview = useMemo(() => (src.trim() ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(equationSvg({ src }).svg) : ''), [src]);
  // Pune textul la cursor (sau în locul textului ales) și lasă cursorul după el.
  const put = (t: string) => {
    const el = input.current;
    const a = el?.selectionStart ?? src.length, b = el?.selectionEnd ?? src.length;
    const next = (src.slice(0, a) + t + src.slice(b)).slice(0, EQ_MAX);
    setSrc(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + t.length, a + t.length); });
  };
  const done = () => { const s = src.split(String.fromCharCode(10)).join(' ').trim(); if (s) onDone({ src: s }); };
  return createPortal(
    <div className="chart-dlg-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chart-dlg" role="dialog" aria-label="Ecuație" onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(); }
      }}>
        <h3>Ecuație</h3>
        <label className="chart-dlg-hint">Scrie ecuația pe un rând: a/b fracție, x^2 putere, x_1 indice, sqrt(x) radical, root(3, x), sum_(i=1)^n, int_0^1, lim_(x-&gt;0), vec(v) / hat(x) / bar(x) / dot(x) accent, (mat(a, b; c, d)) matrice, cases(x+y=5; x-y=1) sistem, braces(1, 2) acolade, box(x) chenar, underline(x) subliniat, underbrace(x)_(text) acoladă,
          alfa / pi / delta pentru litere grecești, &lt;= &gt;= != +- -&gt; pentru semne. Parantezele ( ) grupează; acoladele {'{ }'} grupează fără să se vadă. Merge și lipită o ecuație scrisă cu bară inversă ({'\\frac{a}{b}, \\alpha'}).</label>
        <textarea ref={input} className="diag-text eq-src" rows={2} maxLength={EQ_MAX} value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Textul ecuației" autoFocus spellCheck={false} />
        <div className="chart-dlg-row eq-syms" aria-label="Simboluri">
          {SYMBOLS.map((s) => <button key={s} className="eq-sym" onMouseDown={(e) => e.preventDefault()} onClick={() => put(s)} title={`Pune ${s}`}>{s}</button>)}
        </div>
        <div className="chart-dlg-row">
          <label>Model <select value="" aria-label="Model de ecuație" onChange={(e) => { if (e.target.value) put(e.target.value); }}>
            <option value="">Alege…</option>
            {EQ_TEMPLATES.map(([n, t]) => <option key={n} value={t}>{n}: {t}</option>)}
          </select></label>
        </div>
        {preview && <img className="diag-preview eq-preview" src={preview} alt="Previzualizarea ecuației" />}
        <div className="chart-dlg-row">
          <button disabled={!src.trim()} onClick={copyLatex} title="Copiază ecuația scrisă cu bară inversă, ca s-o lipești în alt program, pe un site sau într-un mesaj">{copied === 'ok' ? '✓ Copiat' : copied === 'err' ? 'Nu am putut copia' : '⧉ Copiază cu bară inversă'}</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>Renunță</button>
          <button className="primary" disabled={!src.trim()} onClick={done}>Gata</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
