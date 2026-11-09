// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 👓 Lectură în Docs (ca Cititorul imersiv din Word): documentul doar de citit, pe o coloană aleasă (îngustă / medie / lată),
// cu literă mare, spațiere largă, fundal liniștit, evidențierea paragrafului curent (restul se estompează) și citire cu voce tare
// paragraf cu paragraf (cel citit se evidențiază). Conținutul e o copie a paginii din editor, deci formatarea și pozele rămân.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { speak, stopSpeaking } from '../speak';

type Width = 'narrow' | 'medium' | 'wide';
type Tone = 'plain' | 'sepia' | 'dark';
const WIDTHS: [Width, string][] = [['narrow', 'Coloană îngustă'], ['medium', 'Coloană medie'], ['wide', 'Coloană lată']];
const TONES: [Tone, string][] = [['plain', 'Fundal obișnuit'], ['sepia', 'Fundal sepia'], ['dark', 'Fundal întunecat']];
export const IMM_SIZES = [16, 18, 20, 24, 28, 32, 40];

const KEY = 'suite.docs.immersive';
type Prefs = { width: Width; tone: Tone; size: number; wide: boolean; focus: boolean };
const DEF: Prefs = { width: 'medium', tone: 'sepia', size: 24, wide: true, focus: false };
const load = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      width: WIDTHS.some(([k]) => k === p.width) ? p.width : DEF.width,
      tone: TONES.some(([k]) => k === p.tone) ? p.tone : DEF.tone,
      size: IMM_SIZES.includes(p.size) ? p.size : DEF.size,
      wide: typeof p.wide === 'boolean' ? p.wide : DEF.wide,
      focus: typeof p.focus === 'boolean' ? p.focus : DEF.focus,
    };
  } catch { return DEF; }
};

/** Bucățile de citit: paragrafele, titlurile, citatele, tabelele și fiecare element de listă (nu lista întreagă). */
export function readingUnits(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of [...root.children] as HTMLElement[]) {
    if (el.matches('ul, ol')) out.push(...([...el.querySelectorAll(':scope > li')] as HTMLElement[]));
    else if ((el.textContent ?? '').trim() || el.querySelector('img')) out.push(el);
  }
  return out;
}

export default function Immersive({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const set = (p: Partial<Prefs>) => setPrefs((old) => { const n = { ...old, ...p }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* fără memorie locală */ } return n; });
  const body = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const [count, setCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const speakRun = useRef(0);

  // Cât timp citești, documentul nu se poate modifica (tastele nu ajung în el).
  useEffect(() => { const was = editor.isEditable; editor.setEditable(false); (document.activeElement as HTMLElement | null)?.blur?.(); return () => { if (was) editor.setEditable(true); }; }, [editor]);
  // Copia paginii: fără editare, fără marcajele editorului (cursorul, selecția, ghidajele).
  useEffect(() => {
    const host = body.current;
    if (!host) return;
    const copy = editor.view.dom.cloneNode(true) as HTMLElement;
    copy.removeAttribute('contenteditable');
    copy.querySelectorAll('[contenteditable]').forEach((e) => e.removeAttribute('contenteditable'));
    copy.querySelectorAll('.ProseMirror-gapcursor, .ProseMirror-separator, .ProseMirror-trailingBreak, button, input, select, textarea').forEach((e) => e.remove());
    copy.className = 'imm-doc';
    host.replaceChildren(copy);
    setCount(readingUnits(copy).length);
  }, [editor]);

  const units = useCallback(() => {
    const d = body.current?.querySelector<HTMLElement>('.imm-doc');
    return d ? readingUnits(d) : [];
  }, []);
  // Paragraful curent: evidențiat, adus în mijlocul ecranului.
  useEffect(() => {
    const list = units();
    list.forEach((u, i) => u.classList.toggle('imm-cur', i === cur));
    list[cur]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [cur, count, units]);

  const stop = () => { speakRun.current++; stopSpeaking(); setSpeaking(false); };
  const readFrom = (i: number) => {
    const list = units();
    const run = ++speakRun.current;
    const next = (k: number) => {
      if (run !== speakRun.current) return;
      if (k >= list.length) { setSpeaking(false); return; }
      setCur(k);
      const t = (list[k].textContent ?? '').trim();
      if (!t) { next(k + 1); return; }
      if (!speak(t, () => next(k + 1))) { setSpeaking(false); speakRun.current++; }
    };
    setSpeaking(true);
    next(i);
  };
  useEffect(() => () => { speakRun.current++; stopSpeaking(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Doar în tabul care se vede (un alt tab Docs sau altă aplicație nu primește tastele de aici).
      if (!body.current?.offsetParent) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if ((e.target as HTMLElement)?.closest?.('select')) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); setCur((c) => Math.min(count - 1, c + 1)); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); setCur((c) => Math.max(0, c - 1)); }
      else if (e.key === 'Home') { e.preventDefault(); setCur(0); }
      else if (e.key === 'End') { e.preventDefault(); setCur(Math.max(0, count - 1)); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [count, onClose]);

  const si = IMM_SIZES.indexOf(prefs.size);
  return (
    <div className={`imm tone-${prefs.tone} w-${prefs.width}${prefs.wide ? ' space-wide' : ''}${prefs.focus ? ' imm-focus' : ''}`} role="document" aria-label="Lectură">
      <div className="imm-bar" role="toolbar" aria-label="Setările lecturii">
        <button className={speaking ? 'on' : ''} onClick={() => (speaking ? stop() : readFrom(cur))} title={speaking ? 'Oprește citirea' : 'Citește cu voce tare de la paragraful evidențiat (vocile instalate în sistem, fără internet)'}>
          {speaking ? '⏹ Oprește' : '🔊 Citește cu voce'}
        </button>
        <button onClick={() => set({ size: IMM_SIZES[Math.max(0, si - 1)] })} disabled={si <= 0} title="Literă mai mică" aria-label="Literă mai mică">A−</button>
        <span className="imm-size" aria-live="polite">{prefs.size} px</span>
        <button onClick={() => set({ size: IMM_SIZES[Math.min(IMM_SIZES.length - 1, si + 1)] })} disabled={si >= IMM_SIZES.length - 1} title="Literă mai mare" aria-label="Literă mai mare">A+</button>
        <select value={prefs.width} onChange={(e) => set({ width: e.target.value as Width })} aria-label="Lățimea coloanei">
          {WIDTHS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={prefs.tone} onChange={(e) => set({ tone: e.target.value as Tone })} aria-label="Fundalul">
          {TONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label title="Mai mult spațiu între litere, cuvinte și rânduri (mai ușor de citit)"><input type="checkbox" checked={prefs.wide} onChange={(e) => set({ wide: e.target.checked })} /> Spațiere largă</label>
        <label title="Doar paragraful curent se vede clar, restul se estompează (↑ ↓ trec la altul)"><input type="checkbox" checked={prefs.focus} onChange={(e) => set({ focus: e.target.checked })} /> Doar paragraful curent</label>
        <span className="imm-pos" role="status">{count ? `Paragraful ${cur + 1} din ${count}` : 'Documentul nu are text'}</span>
        <button onClick={onClose} title="Înapoi la scris (Esc)">✕ Ieși din Lectură</button>
      </div>
      <div className="imm-scroll" onClick={(e) => {
        const list = units();
        const k = list.findIndex((u) => u.contains(e.target as Node));
        if (k >= 0) { if (speaking) stop(); setCur(k); }
      }}>
        <article className="imm-page" style={{ fontSize: prefs.size + 'px' }}>
          <div ref={body} />
        </article>
      </div>
    </div>
  );
}
