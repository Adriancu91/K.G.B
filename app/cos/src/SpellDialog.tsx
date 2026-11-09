// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ABC Ortografie (F7, în Sheets și Slides): trece prin texte (celule, casete, notițe), de la locul ales, și arată fiecare
// cuvânt care nu e în dicționarul românesc, cu sugestii: Schimbă, Schimbă tot, Ignoră, Ignoră tot, Adaugă în dicționar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { nextIssue, replaceAt, replaceEverywhere, type SpellCell, type SpellIssue } from './spell';

// „Ignoră tot” ține cât e deschisă aplicația.
const ignoredAll = new Set<string>();

interface Props {
  /** Textele de verificat, în ordine (începând cu locul ales). */
  items: SpellCell[];
  /** Unde e cuvântul, pentru fereastră: „celula A2”, „slide-ul 3, titlul”. */
  where: (it: SpellCell) => string;
  /** Textele care nu se pot schimba (de exemplu celulele blocate ale unei foi protejate). */
  locked?: (id: string) => boolean;
  onGo: (it: SpellCell) => void;
  /** Textele noi (după id), dintr-un singur pas de anulare. */
  onApply: (patch: Record<string, string>) => void;
  onClose: (msg?: string) => void;
}

export default function SpellDialog({ items, where, locked = () => false, onGo, onApply, onClose }: Props) {
  const wrong = useMemo(() => (api.spellWrong ? (w: string) => api.spellWrong!(w) : null), []);
  const [list, setList] = useState<SpellCell[]>(items);
  const [issue, setIssue] = useState<SpellIssue | null>(null);
  const [done, setDone] = useState(false);
  const [repl, setRepl] = useState('');
  const [sugg, setSugg] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const seek = (l: SpellCell[], cell: number, pos: number) => {
    const it = wrong ? nextIssue(l, cell, pos, wrong, ignoredAll) : null;
    setIssue(it);
    setDone(!it);
    if (!it) return;
    const s = api.spellSuggest?.(it.word) ?? [];
    setSugg(s.slice(0, 8));
    setRepl(s[0] ?? it.word);
    onGo(l[it.cell]);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { seek(list, 0, 0); }, []);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, [issue]);

  const withPatch = (patch: Record<string, string>) => list.map((y) => (patch[y.id] !== undefined ? { ...y, text: patch[y.id] } : y));
  const skip = () => issue && seek(list, issue.cell, issue.end);
  const change = (to = repl) => {
    if (!issue) return;
    const x = list[issue.cell];
    if (to === issue.word || locked(x.id)) { skip(); return; }
    const patch = { [x.id]: replaceAt(x.text, issue.start, issue.end, to) };
    onApply(patch);
    setCount((n) => n + 1);
    const l = withPatch(patch);
    setList(l);
    seek(l, issue.cell, issue.start + to.length);
  };
  const changeAll = () => {
    if (!issue) return;
    const { patch, n } = replaceEverywhere(list.filter((x) => !locked(x.id)), issue.word, repl);
    if (n) { onApply(patch); setCount((k) => k + n); }
    const l = withPatch(patch);
    setList(l);
    ignoredAll.add(issue.word.toLowerCase());
    seek(l, issue.cell, issue.start);
  };
  const ignoreAll = () => { if (!issue) return; ignoredAll.add(issue.word.toLowerCase()); seek(list, issue.cell, issue.end); };
  const addWord = () => {
    if (!issue) return;
    void api.spellAdd?.(issue.word);
    ignoredAll.add(issue.word.toLowerCase());
    seek(list, issue.cell, issue.end);
  };
  const close = () => onClose(done ? (count ? `Ortografia: am schimbat ${count} ${count === 1 ? 'cuvânt' : 'cuvinte'} (Ctrl+Z anulează)` : 'Ortografia: nicio greșeală găsită') : undefined);

  const ctx = issue ? list[issue.cell].text : '';
  return (
    <div className="print-overlay sh-spell-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="print-dlg sh-spell-dlg" role="dialog" aria-label="Ortografie"
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } }}>
        <h3>ABC Ortografie</h3>
        {!wrong ? <p className="print-info">Verificarea ortografiei merge doar în aplicația Cyber Office Studio, nu în browser.</p>
          : done ? <p className="print-info sh-spell-done">Verificarea ortografiei s-a terminat.{count ? ` Am schimbat ${count} ${count === 1 ? 'cuvânt' : 'cuvinte'}.` : ''}</p>
          : issue && (
            <>
              <div className="print-info">Nu e în dicționar, în <b>{where(list[issue.cell])}</b>:</div>
              <div className="sh-spell-ctx" aria-label="Textul">
                {ctx.slice(Math.max(0, issue.start - 60), issue.start)}<mark>{ctx.slice(issue.start, issue.end)}</mark>{ctx.slice(issue.end, issue.end + 60)}
              </div>
              <label className="sh-spell-row">Schimbă în
                <input ref={input} value={repl} onChange={(e) => setRepl(e.target.value)} aria-label="Schimbă în" spellCheck={false}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); change(); } }} />
              </label>
              <div className="sh-spell-sugg" role="listbox" aria-label="Sugestii">
                {sugg.length ? sugg.map((s) => (
                  <button key={s} role="option" aria-selected={s === repl} className={s === repl ? 'on' : ''} onClick={() => setRepl(s)} onDoubleClick={() => change(s)}>{s}</button>
                )) : <span className="print-info">Nicio sugestie</span>}
              </div>
              <div className="print-actions sh-spell-actions">
                <button onClick={skip}>Ignoră</button>
                <button onClick={ignoreAll}>Ignoră tot</button>
                <button onClick={addWord} title="Cuvântul nu mai e arătat ca greșit nicăieri în Cyber Office Studio">Adaugă în dicționar</button>
                <button onClick={changeAll}>Schimbă tot</button>
                <button className="primary" onClick={() => change()}>Schimbă</button>
              </div>
            </>
          )}
        <div className="print-actions"><button onClick={close} autoFocus={done || !wrong}>Închide</button></div>
      </div>
    </div>
  );
}
