// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul „Stil…” din Docs: Modifică stilul (Text normal, Titlu document, Titlu 1–3) pentru tot documentul:
// font, mărime, culoare, aldin, cursiv; „Ca textul selectat” ia formatul de la cursor; „Implicit” scoate schimbările.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { STYLE_KEYS, cleanStyle, styleFromMarks, type DocStyles, type StyleDef, type StyleKey } from './docStyles';
import { WORD_SIZES } from './fontSize';

export default function StylePicker({ editor, styles, fonts, onChange }: {
  editor: Editor; styles?: DocStyles; fonts: [string, string][]; onChange(s: DocStyles | undefined): void;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<StyleKey>('normal');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);
  // La deschidere, stilul ales e cel al paragrafului de la cursor.
  const here = (): StyleKey => {
    if (editor.isActive('heading')) { const l = Number(editor.getAttributes('heading').level) || 1; return l <= 3 ? (`h${l}` as StyleKey) : 'normal'; }
    return editor.getAttributes('paragraph').pstyle === 'title' ? 'title' : 'normal';
  };
  const cur: StyleDef = styles?.[key] ?? {};
  const put = (def: StyleDef | undefined) => {
    const next: DocStyles = { ...(styles ?? {}) };
    const clean = cleanStyle(def);
    if (clean) next[key] = clean; else delete next[key];
    onChange(Object.keys(next).length ? next : undefined);
  };
  const set = (ch: Partial<StyleDef>) => put({ ...cur, ...ch });
  const fromSelection = () => {
    const t = editor.getAttributes('textStyle');
    put(styleFromMarks({ fontFamily: t.fontFamily, fontSize: t.fontSize, color: t.color, bold: editor.isActive('bold'), italic: editor.isActive('italic') }));
  };
  const tri = (v: boolean | undefined) => (v === undefined ? '' : v ? 'da' : 'nu');
  const fromTri = (v: string) => (v === '' ? undefined : v === 'da');

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (!open) setKey(here()); setOpen(!open); }}
        title="Modifică stilul: cum arată Text normal, Titlu document și Titlu 1–3 în tot documentul (font, mărime, culoare)">Stil…</button>
      {open && (
        <div className="sym-pop para-pop style-pop" role="dialog" aria-label="Modifică stilul">
          <div className="sym-head">Modifică stilul (în tot documentul)</div>
          <label>Stilul
            <select aria-label="Stilul de modificat" value={key} onChange={(e) => setKey(e.target.value as StyleKey)}>
              {STYLE_KEYS.map(([k, label]) => <option key={k} value={k}>{label}{styles?.[k] ? ' •' : ''}</option>)}
            </select>
          </label>
          <label>Font
            <select aria-label="Fontul stilului" value={cur.font ?? ''} onChange={(e) => set({ font: e.target.value || undefined })}>
              {fonts.map(([label, value]) => <option key={label} value={value}>{value ? label : 'Neschimbat'}</option>)}
              {cur.font && !fonts.some(([, v]) => v === cur.font) && <option value={cur.font}>{cur.font}</option>}
            </select>
          </label>
          <label>Mărime
            <select aria-label="Mărimea stilului" value={cur.size ?? ''} onChange={(e) => set({ size: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Neschimbată</option>
              {[...new Set([...WORD_SIZES, ...(cur.size ? [cur.size] : [])])].sort((a, b) => a - b).map((s) => <option key={s} value={s}>{String(s).replace('.', ',')} pt</option>)}
            </select>
          </label>
          <label>Culoare
            <input type="color" aria-label="Culoarea stilului" value={cur.color ?? '#000000'} onChange={(e) => set({ color: e.target.value })} />
            {cur.color && <button className="fmt" onClick={() => set({ color: undefined })} title="Culoarea neschimbată">✕</button>}
          </label>
          <label>Aldin
            <select aria-label="Aldin" value={tri(cur.bold)} onChange={(e) => set({ bold: fromTri(e.target.value) })}>
              <option value="">Neschimbat</option><option value="da">Da</option><option value="nu">Nu</option>
            </select>
          </label>
          <label>Cursiv
            <select aria-label="Cursiv" value={tri(cur.italic)} onChange={(e) => set({ italic: fromTri(e.target.value) })}>
              <option value="">Neschimbat</option><option value="da">Da</option><option value="nu">Nu</option>
            </select>
          </label>
          <div className="style-pop-row">
            <button className="fmt" onMouseDown={(e) => e.preventDefault()} onClick={fromSelection} title="Stilul ia fontul, mărimea, culoarea, aldinul și cursivul textului de la cursor">Ca textul selectat</button>
            <button className="fmt" onClick={() => put(undefined)} disabled={!styles?.[key]} title="Stilul revine cum era la început">↺ Implicit</button>
          </div>
        </div>
      )}
    </div>
  );
}
