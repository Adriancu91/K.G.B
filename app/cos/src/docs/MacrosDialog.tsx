// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Docs și Slides → Vizualizare → Macrocomenzi: fereastra de pornire a înregistrării (nume, de la cursor, scurtătură, unde se
// păstrează, descriere) și lista macrocomenzilor (rulează, redenumește, mută, șterge). Logica e în docs/macros.ts și slides/macros.ts.
import { useState } from 'react';
import { docMacroNameError, macroChars, type DocMacro } from './macros';

interface AnyMacro { name: string; steps: unknown[]; note?: string; key?: string; rel?: boolean }

/** Textele care diferă între Docs (`doc`) și Slides (`deck`). */
const WORDS = {
  doc: {
    intro: 'Tot ce scrii, ștergi și formatezi în document de acum se ține minte, până apeși ⏹ Oprește înregistrarea. Pornește de la locul cursorului.',
    inFile: 'Acest document (în fișier)', inAll: 'Toate documentele (pe acest calculator)', here: 'acest document', all: 'toate documentele',
    empty: 'Documentul nu are încă macrocomenzi. Apasă ⏺ Înregistrează macrocomandă, fă pașii în document, apoi ⏹ Oprește înregistrarea.',
    info: 'Rulează pornește de la locul cursorului (la cele care pornesc de la cursor). Cele din „acest document” se păstrează în fișier, cele din „toate documentele” pe acest calculator, pentru orice document deschis.',
    toHere: '⇄ Mută în acest document', toAll: '⇄ Mută în toate documentele',
    toHereTip: 'Mută macrocomanda în fișierul acestui document (nu mai apare în celelalte documente)', toAllTip: 'Mută macrocomanda pe acest calculator, ca să meargă în orice document deschis',
  },
  deck: {
    intro: 'Ce schimbi pe slide de acum se ține minte, până apeși ⏹ Oprește înregistrarea: formatul și textul casetelor alese, mutarea lor, casetele noi, fundalul și tranziția slide-ului.',
    inFile: 'Această prezentare (în fișier)', inAll: 'Toate prezentările (pe acest calculator)', here: 'această prezentare', all: 'toate prezentările',
    empty: 'Prezentarea nu are încă macrocomenzi. Apasă ⏺ Înregistrează macrocomandă, fă pașii pe slide, apoi ⏹ Oprește înregistrarea.',
    info: 'Rulează pune pașii pe slide-ul de acum și pe casetele alese acum. Cele din „această prezentare” se păstrează în fișier, cele din „toate prezentările” pe acest calculator, pentru orice prezentare deschisă.',
    toHere: '⇄ Mută în această prezentare', toAll: '⇄ Mută în toate prezentările',
    toHereTip: 'Mută macrocomanda în fișierul acestei prezentări (nu mai apare în celelalte prezentări)', toAllTip: 'Mută macrocomanda pe acest calculator, ca să meargă în orice prezentare deschisă',
  },
};

export function DocMacroRecordDialog({ list, kind = 'doc', onStart, onClose }: {
  list: AnyMacro[];
  kind?: 'doc' | 'deck';
  onStart(name: string, rel: boolean, note: string, key: string, all: boolean): void;
  onClose(): void;
}) {
  const W = WORDS[kind];
  let n = list.length + 1;
  while (list.some((m) => m.name === `Macrocomandă${n}`)) n++;
  const [name, setName] = useState(`Macrocomandă${n}`);
  const [rel, setRel] = useState(true);
  const [note, setNote] = useState('');
  const [key, setKey] = useState('');
  const [all, setAll] = useState(false);
  const [err, setErr] = useState('');
  const freeKeys = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((k) => !list.some((m) => m.key === k));
  const start = () => {
    const e = docMacroNameError(name, list);
    if (e) { setErr(e); return; }
    onStart(name.trim(), rel, note, key, all);
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg macro-dlg" role="dialog" aria-label="Înregistrare macrocomandă" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); start(); } }}>
        <h3>Înregistrare macrocomandă</h3>
        <p className="print-info">{W.intro}</p>
        <label className="print-row">Nume: <input autoFocus value={name} aria-label="Numele macrocomenzii" maxLength={60} onChange={(e) => { setName(e.target.value); setErr(''); }} /></label>
        {kind === 'doc' && <label className="print-row rb-check" title="Bifat: pașii se repetă de la locul cursorului când rulezi. Nebifat: exact în aceleași locuri din document.">
          <input type="checkbox" checked={rel} aria-label="Pornește de la cursor" onChange={(e) => setRel(e.target.checked)} /> Pornește de la cursor la rulare</label>}
        <label className="print-row" title="Macrocomanda pornește și cu tastele Ctrl+Shift+litera aleasă; are întâietate față de scurtătura obișnuită cu aceeași literă">Scurtătură: Ctrl+Shift+
          <select value={key} aria-label="Scurtătura macrocomenzii" onChange={(e) => setKey(e.target.value)}>
            <option value="">(fără)</option>
            {freeKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label className="print-row">Păstrează în:
          <select value={all ? 'all' : 'doc'} aria-label="Unde se păstrează macrocomanda" onChange={(e) => setAll(e.target.value === 'all')}>
            <option value="doc">{W.inFile}</option>
            <option value="all">{W.inAll}</option>
          </select></label>
        <label className="print-row">Descriere: <input value={note} aria-label="Descrierea macrocomenzii" maxLength={300} onChange={(e) => setNote(e.target.value)} /></label>
        {err && <p className="print-info links-warn" role="alert">{err}</p>}
        <div className="print-actions">
          <button className="primary" onClick={start}>⏺ Pornește înregistrarea</button>
          <button onClick={onClose}>Anulare</button>
        </div>
      </div>
    </div>
  );
}

export function DocMacroListDialog<M extends AnyMacro>({ list, mine, kind = 'doc', onRun, onButton, onChange, onClose }: {
  /** Macrocomenzile fișierului deschis. */
  list: M[];
  /** Macrocomenzile pentru toate fișierele de același fel (păstrate pe acest calculator). */
  mine: M[];
  kind?: 'doc' | 'deck';
  onRun(m: M): void;
  /** Pune în text un buton care rulează macrocomanda la dublu clic (doar în Docs). */
  onButton?(m: M): void;
  onChange(list: M[], mine: M[]): void;
  onClose(): void;
}) {
  const W = WORDS[kind];
  const [sel, setSel] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const items = [...list.map((m) => ({ m, all: false })), ...mine.map((m) => ({ m, all: true }))];
  const all = items.map((x) => x.m);
  const emit = (next: typeof items) => onChange(next.filter((x) => !x.all).map((x) => x.m), next.filter((x) => x.all).map((x) => x.m));
  const i = Math.min(sel, items.length - 1);
  const cur = items[i]?.m;
  const rename = () => {
    if (renaming === null || !cur) return;
    const e = docMacroNameError(renaming, all, i);
    if (e) { setErr(e); return; }
    emit(items.map((x, k) => (k === i ? { ...x, m: { ...x.m, name: renaming.trim() } } : x)));
    setRenaming(null);
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg links-dlg macro-dlg" role="dialog" aria-label="Macrocomenzi" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); if (renaming !== null) setRenaming(null); else onClose(); } }}>
        <h3>Macrocomenzi</h3>
        {!items.length ? (
          <p className="print-info">{W.empty}</p>
        ) : (
          <>
            <p className="print-info">{W.info}</p>
            <table className="links-table">
              <thead><tr><th>Nume</th><th>Pași</th>{kind === 'doc' && <><th>Litere scrise</th><th>Pornește</th></>}<th>Scurtătură</th><th>Unde</th><th>Descriere</th></tr></thead>
              <tbody>
                {items.map(({ m, all: a }, k) => (
                  <tr key={(a ? '*' : '') + m.name} className={k === i ? 'sel' : ''} onClick={() => { setSel(k); setRenaming(null); setErr(''); }} onDoubleClick={() => onRun(m)} aria-selected={k === i}>
                    <td>{m.name}</td><td>{m.steps.length}</td>{kind === 'doc' && <><td>{macroChars(m as unknown as DocMacro)}</td><td>{m.rel ? 'de la cursor' : 'în același loc'}</td></>}<td>{m.key ? `Ctrl+Shift+${m.key}` : ''}</td><td>{a ? W.all : W.here}</td><td>{m.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renaming !== null && (
              <label className="print-row">Nume nou: <input autoFocus value={renaming} aria-label="Numele nou al macrocomenzii" maxLength={60}
                onChange={(e) => { setRenaming(e.target.value); setErr(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); rename(); } }} /></label>
            )}
            {err && <p className="print-info links-warn" role="alert">{err}</p>}
          </>
        )}
        <div className="print-actions">
          {cur && <button className="primary" onClick={() => onRun(cur)} title={`Repetă pașii macrocomenzii „${cur.name}” (Ctrl+Z îi anulează pe toți deodată)`}>▶ Rulează</button>}
          {cur && onButton && <button data-testid="macro-btn-insert" onClick={() => onButton(cur)} title={`Pune la cursor un buton „${cur.name}”: dublu clic pe el rulează macrocomanda (câmpul MACROBUTTON în .docx)`}>⊞ Buton în text</button>}
          {cur && (renaming === null
            ? <button onClick={() => setRenaming(cur.name)}>✎ Redenumește</button>
            : <button onClick={rename}>✓ Salvează numele</button>)}
          {cur && <button onClick={() => emit(items.map((x, k) => (k === i ? { ...x, all: !x.all } : x)))}
            title={items[i].all ? W.toHereTip : W.toAllTip}>{items[i].all ? W.toHere : W.toAll}</button>}
          {cur && <button onClick={() => { emit(items.filter((_, k) => k !== i)); setRenaming(null); }} title={`Șterge macrocomanda „${cur.name}”`}>🗑 Șterge</button>}
          <button onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}
