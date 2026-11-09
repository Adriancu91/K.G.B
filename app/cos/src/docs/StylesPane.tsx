// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Panoul Stiluri (Word: Pornire → Stiluri → panoul Stiluri, plus Proiectare → Seturi de stiluri): toate stilurile de paragraf,
// fiecare arătat cum arată în document; clic pune stilul pe paragrafele selectate, stilul de la cursor e evidențiat.
// Sus se alege un set de stiluri pentru tot documentul; jos: câte paragrafe au stilul și ștergerea formatării.
import { useState, type CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import { MAX_CUSTOM, STYLE_SETS, THEMES, THEME_COLORS, THEME_FONTS, applyTheme, newStyleId, styleFromMarks, styleSet, styleSetOf, themeColorsOf, themeFontsOf, themeOf, withThemeColors, withThemeFonts, type DocStyles, type StyleDef, type StyleKey } from './docStyles';
import { BLOCK_STYLES, applyBlock, currentBlock } from './paraStyle';

// Cum arată fiecare stil în panou (mărimi mici, pe potriva panoului), peste care se pun fontul / culoarea stilurilor documentului.
const BASE: Record<string, CSSProperties> = {
  p: { fontSize: 13 }, title: { fontSize: 20 }, subtitle: { fontSize: 15, color: '#5a5a5a' }, caption: { fontSize: 12, fontStyle: 'italic', color: '#44546a' },
  quote: { fontSize: 13, fontStyle: 'italic', opacity: 0.75 }, h1: { fontSize: 18, fontWeight: 700 }, h2: { fontSize: 16, fontWeight: 700 },
  h3: { fontSize: 14, fontWeight: 700 }, h4: { fontSize: 13, fontWeight: 700 }, h5: { fontSize: 12, fontWeight: 700 }, h6: { fontSize: 12, fontWeight: 700, fontStyle: 'italic' },
};
const KEY_OF: Record<string, StyleKey> = { p: 'normal', title: 'title', h1: 'h1', h2: 'h2', h3: 'h3' };

export function previewStyle(v: string, styles: DocStyles | undefined): CSSProperties {
  if (v.startsWith('c:')) {
    const d: StyleDef = styles?.custom?.find((c) => c.id === v.slice(2))?.def ?? {};
    const n = styles?.normal;
    return { fontSize: 13, fontFamily: (d.font ?? n?.font) ? `"${d.font ?? n?.font}", sans-serif` : undefined, color: d.color ?? n?.color,
      fontWeight: d.bold ? 700 : undefined, fontStyle: d.italic ? 'italic' : undefined };
  }
  const s = { ...BASE[v] };
  const normal = styles?.normal, own = KEY_OF[v] ? styles?.[KEY_OF[v]] : undefined;
  // Fontul și culoarea vin din „Text normal” (ca în document), apoi din stilul propriu; aldinul / cursivul doar din stilul propriu.
  for (const d of [normal, own]) {
    if (d?.font) s.fontFamily = '"' + d.font + '", sans-serif';
    if (d?.color) s.color = d.color;
  }
  if (own?.bold !== undefined) s.fontWeight = own.bold ? 700 : 400;
  if (own?.italic !== undefined) s.fontStyle = own.italic ? 'italic' : 'normal';
  return s;
}

/** Câte paragrafe din document au fiecare stil. */
export function countBlocks(editor: Editor): Record<string, number> {
  const n: Record<string, number> = {};
  editor.state.doc.descendants((node, _pos, parent) => {
    let v: string | null = null;
    if (node.type.name === 'heading') v = `h${Number(node.attrs.level) || 1}`;
    else if (node.type.name === 'paragraph' && node.attrs.cstyle) v = 'c:' + node.attrs.cstyle;
    else if (node.type.name === 'paragraph') v = (node.attrs.pstyle as string | null) ?? (parent?.type.name === 'blockquote' ? 'quote' : 'p');
    if (v) n[v] = (n[v] ?? 0) + 1;
    return node.type.name !== 'paragraph' && node.type.name !== 'heading';
  });
  return n;
}

export default function StylesPane({ editor, styles, onStyles, onClose }: {
  editor: Editor; styles?: DocStyles; onStyles(s: DocStyles | undefined): void; onClose(): void;
}) {
  const cur = currentBlock(editor);
  const counts = countBlocks(editor);
  const set = styleSetOf(styles);
  const custom = styles?.custom ?? [];
  const theme = themeOf(styles), tFonts = themeFontsOf(styles), tColors = themeColorsOf(styles);
  // Stilurile tale (custom) rămân când se schimbă tema, fonturile sau culorile.
  const keep = (st: DocStyles | undefined) => onStyles(custom.length ? { ...(st ?? {}), custom } : st);
  const [naming, setNaming] = useState<string | null>(null);
  // Stil nou: ia fontul, mărimea, culoarea, aldinul și cursivul textului de la cursor și îl pune pe paragraful curent.
  const create = () => {
    const name = (naming ?? '').trim().replace(/[<>"&]/g, '').slice(0, 40);
    if (!name || custom.length >= MAX_CUSTOM) return;
    const t = editor.getAttributes('textStyle');
    const def = styleFromMarks({ fontFamily: t.fontFamily, fontSize: t.fontSize, color: t.color, bold: editor.isActive('bold'), italic: editor.isActive('italic') });
    const id = newStyleId(custom);
    onStyles({ ...(styles ?? {}), custom: [...custom, { id, name, def }] });
    setNaming(null);
    // Textul paragrafului ia aspectul stilului (formatul direct de pe el se scoate, ca să nu-l acopere).
    requestAnimationFrame(() => { editor.chain().focus().selectParentNode().unsetAllMarks().run(); applyBlock(editor, 'c:' + id); });
  };
  const remove = (id: string) => {
    const rest = custom.filter((c) => c.id !== id);
    const next: DocStyles = { ...(styles ?? {}) };
    if (rest.length) next.custom = rest; else delete next.custom;
    onStyles(Object.keys(next).length ? next : undefined);
    // Paragrafele cu stilul șters rămân Text normal.
    const tr = editor.state.tr;
    editor.state.doc.descendants((n, pos) => { if (n.attrs.cstyle === id) tr.setNodeMarkup(pos, undefined, { ...n.attrs, cstyle: null }); });
    if (tr.docChanged) editor.view.dispatch(tr);
  };
  return (
    <aside className="doc-nav doc-styles" aria-label="Panoul Stiluri">
      <div className="doc-nav-head">
        <b>Stiluri</b>
        <button className="doc-nav-x" onClick={onClose} title="Închide panoul" aria-label="Închide panoul Stiluri">×</button>
      </div>
      <label className="doc-styles-set">Setul de stiluri
        <select aria-label="Setul de stiluri" value={set} onChange={(e) => { const st = styleSet(e.target.value); onStyles(custom.length ? { ...(st ?? {}), custom } : st); }}
          title="Schimbă dintr-o dată fontul, mărimea și culoarea textului și a titlurilor din tot documentul">
          {set === '' && <option value="">Particularizat</option>}
          {STYLE_SETS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <label className="doc-styles-set">Tema
        <select aria-label="Tema documentului" value={theme} onChange={(e) => keep(applyTheme(e.target.value))}
          title="Tema: setul de stiluri, fonturile și culorile titlurilor, alese dintr-o dată pentru tot documentul">
          {theme === '' && <option value="">Fără temă / particularizată</option>}
          {THEMES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <label className="doc-styles-set">Fonturile temei
        <select aria-label="Fonturile temei" value={tFonts} onChange={(e) => keep(withThemeFonts(styles, e.target.value))}
          title="Un font pentru titluri și unul pentru text, puse în tot documentul (titluri / text)">
          {tFonts === '' && <option value="">Particularizate</option>}
          {THEME_FONTS.map(([k, label, h, b]) => <option key={k} value={k} style={{ fontFamily: `"${h}", "${b}", sans-serif` }}>{label}</option>)}
        </select>
      </label>
      <label className="doc-styles-set">Culorile temei
        <select aria-label="Culorile temei" value={tColors} onChange={(e) => keep(withThemeColors(styles, e.target.value))}
          title="Culorile titlurilor din tot documentul (Titlu document, Titlu 1, 2, 3)">
          {tColors === '' && <option value="">Particularizate</option>}
          {THEME_COLORS.map(([k, label, a]) => <option key={k} value={k} style={{ color: a }}>■ {label}</option>)}
        </select>
      </label>
      <ul className="doc-nav-list" role="listbox" aria-label="Stilurile de paragraf">
        {BLOCK_STYLES.map(([v, label]) => (
          <li key={v}>
            <button className={`doc-nav-row doc-style-row ${v === cur ? 'on' : ''}`} data-style={v} role="option" aria-selected={v === cur}
              onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock(editor, v)}
              title={`Pune stilul „${label}” pe paragrafele selectate${counts[v] ? ` (în document: ${counts[v]})` : ''}`}>
              <span style={previewStyle(v, styles)}>{label}</span>
              {counts[v] ? <small className="doc-style-n">{counts[v]}</small> : null}
            </button>
          </li>
        ))}
        {custom.map((c) => {
          const v = 'c:' + c.id;
          return (
            <li key={v} className="doc-style-custom">
              <button className={`doc-nav-row doc-style-row ${v === cur ? 'on' : ''}`} data-style={v} role="option" aria-selected={v === cur}
                onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock(editor, v)}
                title={`Stilul tău „${c.name}”: clic îl pune pe paragrafele selectate${counts[v] ? ` (în document: ${counts[v]})` : ''}`}>
                <span style={previewStyle(v, styles)}>{c.name}</span>
                {counts[v] ? <small className="doc-style-n">{counts[v]}</small> : null}
              </button>
              <button className="doc-style-del" onClick={() => remove(c.id)} title={`Șterge stilul „${c.name}” (paragrafele lui rămân Text normal)`} aria-label={`Șterge stilul ${c.name}`}>×</button>
            </li>
          );
        })}
      </ul>
      {naming === null ? (
        <button className="fmt" onClick={() => setNaming('Stilul meu ' + (custom.length + 1))} disabled={custom.length >= MAX_CUSTOM}
          title="Stil nou, cu numele tău: ia fontul, mărimea, culoarea, aldinul și cursivul textului de la cursor">＋ Stil nou</button>
      ) : (
        <div className="doc-style-new">
          <input autoFocus value={naming} maxLength={40} aria-label="Numele stilului nou" onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); else if (e.key === 'Escape') setNaming(null); }} />
          <button className="fmt" onClick={create} disabled={!naming.trim()}>Creează</button>
          <button className="fmt" onClick={() => setNaming(null)} title="Renunță">✕</button>
        </div>
      )}
      <button className="fmt" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="Scoate aldinul, culorile, fonturile și stilurile din textul selectat; rămâne Text normal">⌫ Șterge formatarea</button>
      <p className="doc-nav-empty">Stilul de la cursor e evidențiat. Numărul din dreapta arată câte paragrafe au stilul. „Stil…” din bară schimbă cum arată un stil.</p>
    </aside>
  );
}
