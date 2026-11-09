// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inserare simbol (Ω): caracterele speciale folosite des în acte, grupate, cu cele folosite recent primele.
// Literele românești sunt aici cu virgulă (ș, ț), nu cu sedilă (ş, ţ), pentru tastaturile fără română.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

const NBSP = String.fromCharCode(160); // spațiul care nu se rupe (ține „10 lei” pe același rând)

/** Grupurile de simboluri: [caracter, nume] (numele apare când ții mouse-ul pe el). */
export const SYMBOL_GROUPS: { name: string; items: [string, string][] }[] = [
  { name: 'Română', items: [['ă', 'a cu căciulă'], ['â', 'a cu accent circumflex'], ['î', 'i cu accent circumflex'], ['ș', 's cu virgulă'], ['ț', 't cu virgulă'],
    ['Ă', 'A cu căciulă'], ['Â', 'A cu accent circumflex'], ['Î', 'I cu accent circumflex'], ['Ș', 'S cu virgulă'], ['Ț', 'T cu virgulă']] },
  { name: 'Ghilimele și liniuțe', items: [['„', 'ghilimele jos'], ['”', 'ghilimele sus'], ['«', 'ghilimele franțuzești'], ['»', 'ghilimele franțuzești'], ['’', 'apostrof'],
    ['–', 'linie de pauză scurtă'], ['—', 'linie de pauză lungă'], ['…', 'puncte de suspensie'], ['•', 'bulină'], ['·', 'punct la mijloc'], [NBSP, 'spațiu care nu se rupe']] },
  { name: 'Acte și comerț', items: [['§', 'paragraf (lege)'], ['¶', 'sfârșit de paragraf'], ['©', 'drept de autor'], ['®', 'marcă înregistrată'], ['™', 'marcă'],
    ['€', 'euro'], ['$', 'dolar'], ['£', 'liră'], ['№', 'număr'], ['°', 'grad'], ['‰', 'la mie'], ['✓', 'bifă'], ['✗', 'x'], ['☐', 'căsuță goală'], ['☑', 'căsuță bifată'], ['☎', 'telefon'], ['✉', 'plic']] },
  { name: 'Matematică', items: [['±', 'plus-minus'], ['×', 'înmulțit'], ['÷', 'împărțit'], ['≈', 'aproximativ'], ['≠', 'diferit'], ['≤', 'mai mic sau egal'], ['≥', 'mai mare sau egal'],
    ['∞', 'infinit'], ['√', 'radical'], ['∑', 'sumă'], ['∆', 'delta'], ['π', 'pi'], ['µ', 'micro'], ['Ω', 'ohm'], ['²', 'la pătrat'], ['³', 'la cub'],
    ['½', 'o doime'], ['¼', 'o pătrime'], ['¾', 'trei pătrimi'], ['⅓', 'o treime']] },
  { name: 'Săgeți', items: [['→', 'săgeată dreapta'], ['←', 'săgeată stânga'], ['↑', 'săgeată sus'], ['↓', 'săgeată jos'], ['↔', 'săgeată dublă'], ['⇒', 'rezultă'], ['⇔', 'echivalent'], ['▶', 'triunghi'], ['★', 'stea'], ['♥', 'inimă']] },
  { name: 'Greacă', items: [['α', 'alfa'], ['β', 'beta'], ['γ', 'gama'], ['δ', 'delta'], ['ε', 'epsilon'], ['λ', 'lambda'], ['σ', 'sigma'], ['φ', 'fi'], ['ω', 'omega'], ['Σ', 'Sigma mare'], ['Φ', 'Fi mare']] },
];

const RECENT_KEY = 'suite.docs.symbols';
const readRecent = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 10) : []; } catch { return []; }
};
const nameOf = (ch: string) => SYMBOL_GROUPS.flatMap((g) => g.items).find(([c]) => c === ch)?.[1] ?? '';

/** În Docs primește editorul; în alte module (de exemplu Notițe) primește `onInsert`, care scrie caracterul la cursor. */
export default function SymbolPicker({ editor, onInsert, className = 'fmt', keytip }: { editor?: Editor; onInsert?: (ch: string) => void; className?: string; keytip?: string }) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  // Butonul e lângă marginea din dreapta (de exemplu în bara din Slides): fereastra se mută spre stânga ca să încapă.
  useLayoutEffect(() => {
    const p = pop.current;
    if (!open || !p) return;
    p.style.left = '';
    const over = p.getBoundingClientRect().right - (window.innerWidth - 8);
    if (over > 0) p.style.left = `${-over}px`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor?.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const insert = (ch: string) => {
    if (onInsert) onInsert(ch);
    else editor?.chain().focus().insertContent(ch).run();
    const next = [ch, ...recent.filter((x) => x !== ch)].slice(0, 10);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* fără memorie locală: lista recentă nu se păstrează */ }
    setOpen(false);
  };

  const cell = ([ch, name]: [string, string]) => (
    <button key={ch} className="sym-cell" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ch)} title={name}>
      {ch === NBSP ? '⍽' : ch}
    </button>
  );

  return (
    <div className="sym-wrap" ref={box}>
      <button data-keytip={keytip} className={`${className} ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}
        title="Inserează simbol: ©, €, °, ±, „ ”, –, ș, ț și altele">Ω</button>
      {open && (
        <div className="sym-pop" ref={pop} role="dialog" aria-label="Inserează simbol">
          {recent.length > 0 && <>
            <div className="sym-head">Folosite recent</div>
            <div className="sym-grid">{recent.map((ch) => cell([ch, nameOf(ch)]))}</div>
          </>}
          {SYMBOL_GROUPS.map((g) => (
            <div key={g.name}>
              <div className="sym-head">{g.name}</div>
              <div className="sym-grid">{g.items.map(cell)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
