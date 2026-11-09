// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul de culoare din bara Docs (culoarea textului, evidențierea): un clic pe literă pune ultima culoare aleasă,
// ▾ deschide paleta: culorile temei cu nuanțele lor, culorile standard, cele recente, „Automat” / „Fără culoare” și „Mai multe culori…”.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HIGHLIGHT_COLORS, pushRecent, shadesOf, STANDARD_COLORS, themeColumns } from './colorPalette';
import type { DocStyles } from './docStyles';

const RECENT_KEY = 'suite.docs.recentColors';
function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x)) : [];
  } catch { return []; }
}

export default function ColorMenu({ kind, styles, palette, current, last, onPick, children, keytip }: {
  /** Litera de acces (Alt) a listei de culori, de exemplu „FC” pentru culoarea fontului. */
  keytip?: string;
  /** fill = umplerea celulei în Sheets (paleta ca la text, cu „Fără umplere”). */
  kind: 'text' | 'highlight' | 'fill';
  styles: DocStyles | undefined;
  /** Culorile temei date direct (Sheets): coloanele și nuanțele fiecăreia (5 rânduri); lipsă = tema documentului. */
  palette?: { name: string; colors: string[]; shades: string[][] };
  /** Culoarea de acum a textului selectat (pentru bifă). */
  current?: string;
  /** Ultima culoare aleasă: o pune clicul pe literă. */
  last: string;
  /** null = Automat (textul) / Fără culoare (evidențierea). */
  onPick: (c: string | null) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setRecent(loadRecent());
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const pick = (c: string | null) => {
    if (c) {
      const r = pushRecent(loadRecent(), c);
      setRecent(r);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch { /* fără memorie locală */ }
    }
    onPick(c);
    setOpen(false);
  };
  const cur = current?.toLowerCase();
  const sw = (c: string, name: string, key: string) => (
    <button key={key} className={`clr-sw${cur === c.toLowerCase() ? ' on' : ''}`} style={{ background: c }} title={`${name} (${c})`} aria-label={name}
      onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)} />
  );
  const theme = palette ?? themeColumns(styles);
  const shadeAt = (i: number, row: number) => palette ? palette.shades[i][row] : shadesOf(theme.colors[i])[row];
  const label = kind === 'text' ? 'Culoarea textului' : kind === 'fill' ? 'Culoare umplere' : 'Culoarea de evidențiere';
  return (
    <div className="sym-wrap clr-wrap" ref={box}>
      <button className="fmt clr-main" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(last)} title={`${label}: pune ultima culoare aleasă`} aria-label={label}>{children}</button>
      <button className={`fmt clr-drop ${open ? 'active' : ''}`} data-keytip={keytip} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)} title={`${label}: alege din paletă`} aria-label={`Paleta: ${label}`}>▾</button>
      {open && (
        <div className="sym-pop clr-pop" role="dialog" aria-label={`Paleta: ${label}`}>
          <button className="clr-auto" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(null)}>{kind === 'text' ? '■ Automat' : kind === 'fill' ? '▢ Fără umplere' : '▢ Fără culoare'}</button>
          {kind !== 'highlight' ? (
            <>
              <div className="sym-head">Culorile temei ({theme.name})</div>
              <div className="clr-theme" style={{ gridTemplateColumns: `repeat(${theme.colors.length}, 18px)` }}>
                {theme.colors.map((c, i) => sw(c, `Tema, culoarea ${i + 1}`, `t${i}`))}
                {[0, 1, 2, 3, 4].flatMap((row) => theme.colors.map((_, i) => sw(shadeAt(i, row), `Tema, culoarea ${i + 1}, nuanța ${row + 1}`, `t${i}-${row}`)))}
              </div>
              <div className="sym-head">Culori standard</div>
              <div className="clr-row">{STANDARD_COLORS.map(([c, n]) => sw(c, n, 's' + c))}</div>
            </>
          ) : (
            <div className="clr-row">{HIGHLIGHT_COLORS.map(([c, n]) => sw(c, n, 'h' + c))}</div>
          )}
          {recent.length > 0 && (
            <>
              <div className="sym-head">Folosite recent</div>
              <div className="clr-row">{recent.map((c) => sw(c, 'Recent', 'r' + c))}</div>
            </>
          )}
          <button className="clr-more" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); more.current?.click(); }}>🎨 Mai multe culori…</button>
        </div>
      )}
      {/* În afara paletei, ca fereastra de culori să rămână deschisă după ce paleta se închide. Culoarea se pune pe loc;
          în „recente” intră doar cea de la sfârșit. */}
      <input ref={more} type="color" className="clr-native" tabIndex={-1} aria-label={`Altă culoare: ${label}`} defaultValue={last}
        onChange={(e) => onPick(e.target.value)}
        onBlur={(e) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(loadRecent(), e.target.value))); } catch { /* fără memorie locală */ } }} />
    </div>
  );
}
