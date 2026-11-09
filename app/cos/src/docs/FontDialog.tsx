// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra Font (Ctrl+D sau ⇲ din colțul grupului Font), ca în procesorul de text cunoscut: fontul, stilul, mărimea,
// culoarea, sublinierea și efectele (tăiat, exponent, indice, majuscule mici, toate majusculele), plus spațierea literelor
// efectele de text și ligaturile; jos o previzualizare. Se aplică pe textul ales (sau la cursor) doar la „OK”.
import { useState, type CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import { WORD_SIZES } from './fontSize';
import { LETTER_SPACINGS, LIGATURES, TEXT_EFFECTS, type Ligatures, type TextEffect } from './letterFormat';
import { UNDERLINE_STYLES, type UnderlineStyle } from './underlineStyle';

interface Look {
  font: string; bold: boolean; italic: boolean; size: string; color: string; underline: UnderlineStyle | ''; strike: boolean;
  sup: boolean; sub: boolean; smallCaps: boolean; allCaps: boolean; spacing: string; effect: TextEffect | ''; lig: Ligatures | '';
}

function read(editor: Editor): Look {
  const t = editor.getAttributes('textStyle');
  const u = editor.isActive('underline') ? ((editor.getAttributes('underline').style as UnderlineStyle | undefined) ?? 'single') : '';
  return {
    font: (t.fontFamily as string) ?? '', bold: editor.isActive('bold'), italic: editor.isActive('italic'),
    size: ((t.fontSize as string) ?? '').replace(/pt$/, ''), color: (t.color as string) ?? '', underline: u, strike: editor.isActive('strike'),
    sup: editor.isActive('superscript'), sub: editor.isActive('subscript'), smallCaps: t.fontVariant === 'small-caps', allCaps: t.textTransform === 'uppercase',
    spacing: (t.letterSpacing as string) ?? '', effect: (t.textEffect as TextEffect) ?? '', lig: (t.ligatures as Ligatures) ?? '',
  };
}

export default function FontDialog({ editor, fonts, onClose }: { editor: Editor; fonts: [string, string][]; onClose(): void }) {
  const [start] = useState(() => read(editor));
  const [l, setL] = useState<Look>(start);
  const set = (ch: Partial<Look>) => setL({ ...l, ...ch });
  const style = l.bold && l.italic ? 'bi' : l.bold ? 'b' : l.italic ? 'i' : '';
  const apply = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let c = editor.chain().focus() as any;
    if (l.font !== start.font) c = l.font ? c.setFontFamily(l.font) : c.unsetFontFamily();
    if (l.size !== start.size) c = l.size ? c.setFontSize(l.size + 'pt') : c.unsetFontSize();
    if (l.bold !== start.bold) c = l.bold ? c.setBold() : c.unsetBold();
    if (l.italic !== start.italic) c = l.italic ? c.setItalic() : c.unsetItalic();
    if (l.color !== start.color) c = l.color ? c.setColor(l.color) : c.unsetColor();
    if (l.underline !== start.underline) c = l.underline ? c.setUnderlineStyle(l.underline, null) : c.unsetUnderline();
    if (l.strike !== start.strike) c = l.strike ? c.setStrike() : c.unsetStrike();
    if (l.sup !== start.sup) c = l.sup ? c.setSuperscript() : c.unsetSuperscript();
    if (l.sub !== start.sub) c = l.sub ? c.setSubscript() : c.unsetSubscript();
    if (l.smallCaps !== start.smallCaps) c = c.toggleSmallCaps();
    if (l.allCaps !== start.allCaps) c = c.toggleAllCaps();
    if (l.spacing !== start.spacing) c = c.setLetterSpacing(l.spacing || null);
    if (l.effect !== start.effect) c = c.setTextEffect(l.effect || null);
    if (l.lig !== start.lig) c = c.setLigatures(l.lig || null);
    c.run();
    onClose();
  };
  const preview: CSSProperties = {
    fontFamily: l.font || undefined, fontWeight: l.bold ? 700 : 400, fontStyle: l.italic ? 'italic' : 'normal',
    fontSize: l.size ? Math.min(Number(l.size) || 11, 36) + 'pt' : undefined, color: l.color || undefined,
    textDecorationLine: [l.underline ? 'underline' : '', l.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
    textDecorationStyle: l.underline === 'double' ? 'double' : l.underline === 'dotted' ? 'dotted' : l.underline === 'dashed' ? 'dashed' : l.underline === 'wavy' ? 'wavy' : undefined,
    fontVariant: l.smallCaps ? 'small-caps' : undefined, textTransform: l.allCaps ? 'uppercase' : undefined, letterSpacing: l.spacing || undefined,
    fontVariantLigatures: LIGATURES.find(([k]) => k === l.lig)?.[2],
    verticalAlign: l.sup ? 'super' : l.sub ? 'sub' : undefined,
  };
  const check = (k: 'strike' | 'sup' | 'sub' | 'smallCaps' | 'allCaps', label: string) => (
    <label className="font-dlg-check"><input type="checkbox" checked={l[k]} onChange={(e) => set(k === 'sup' ? { sup: e.target.checked, sub: false } : k === 'sub' ? { sub: e.target.checked, sup: false } : { [k]: e.target.checked })} /> {label}</label>
  );
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg font-dlg" role="dialog" aria-label="Font" onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'SELECT') { e.preventDefault(); apply(); }
      }}>
        <h3>Font</h3>
        <div className="font-dlg-grid">
          <label>Font
            <select autoFocus aria-label="Font" value={l.font} onChange={(e) => set({ font: e.target.value })}>
              {fonts.map(([label, value]) => <option key={label} value={value}>{value ? label : 'Ca stilul paragrafului'}</option>)}
              {l.font && !fonts.some(([, v]) => v === l.font) && <option value={l.font}>{l.font}</option>}
            </select>
          </label>
          <label>Stil font
            <select aria-label="Stil font" value={style} onChange={(e) => set({ bold: e.target.value.includes('b'), italic: e.target.value.includes('i') })}>
              <option value="">Normal</option><option value="i">Cursiv</option><option value="b">Aldin</option><option value="bi">Aldin cursiv</option>
            </select>
          </label>
          <label>Dimensiune
            <select aria-label="Dimensiune" value={l.size} onChange={(e) => set({ size: e.target.value })}>
              <option value="">Ca stilul</option>
              {[...new Set([...WORD_SIZES.map(String), ...(l.size ? [l.size] : [])])].sort((a, b) => Number(a) - Number(b)).map((s) => <option key={s} value={s}>{s.replace('.', ',')}</option>)}
            </select>
          </label>
          <label>Culoare font
            <span className="font-dlg-color">
              <input type="color" aria-label="Culoare font" value={l.color || '#000000'} onChange={(e) => set({ color: e.target.value })} />
              <button type="button" onClick={() => set({ color: '' })} title="Culoarea automată (din stil)">Automat</button>
            </span>
          </label>
          <label>Subliniere
            <select aria-label="Subliniere" value={l.underline} onChange={(e) => set({ underline: e.target.value as UnderlineStyle | '' })}>
              <option value="">(fără)</option>
              {UNDERLINE_STYLES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label>Spațiere litere
            <select aria-label="Spațiere litere" value={l.spacing} onChange={(e) => set({ spacing: e.target.value })}>
              {LETTER_SPACINGS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              {l.spacing && !LETTER_SPACINGS.some(([v]) => v === l.spacing) && <option value={l.spacing}>{l.spacing}</option>}
            </select>
          </label>
          <label>Ligaturi
            <select aria-label="Ligaturi" value={l.lig} onChange={(e) => set({ lig: e.target.value as Ligatures | '' })}>
              <option value="">Cum vrea fontul</option>
              {LIGATURES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="font-dlg-effects">
          <legend>Efecte</legend>
          {check('strike', 'Tăiere')}
          {check('sup', 'Exponent')}
          {check('sub', 'Indice')}
          {check('smallCaps', 'Majuscule mici')}
          {check('allCaps', 'Toate majusculele')}
          <label>Efect text
            <select aria-label="Efect text" value={l.effect} onChange={(e) => set({ effect: e.target.value as TextEffect | '' })}>
              <option value="">(fără)</option>
              {TEXT_EFFECTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
        </fieldset>
        <div className="font-dlg-preview" aria-label="Examinare"><span style={preview}>{editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ').slice(0, 40) || 'AaBbCcȘșȚț'}</span></div>
        <div className="print-actions">
          <button onClick={onClose}>Anulare</button>
          <button className="primary" onClick={apply}>OK</button>
        </div>
      </div>
    </div>
  );
}
