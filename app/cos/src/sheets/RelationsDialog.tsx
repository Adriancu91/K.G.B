// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Date → Instrumente de date → 🔗 Relații: legăturile dintre tabele (Vânzări.Cod client → Clienți.Cod), verificate la adăugare
// (coloane, chei unice în tabelul de căutare, fără cerc), și „tabelul din model”: tabelul de bază cu coloanele alese din
// tabelele legate, pus pe o foaie nouă ca interogare (sau direct într-un rezumat). Logica e în relations.ts.
import { useMemo, useState } from 'react';
import { relTree, sameRel, type SheetRel } from './relations';

export function RelationsDialog({ tables, headOf, problem, detect, rels, onChange, onModel, onClose }: {
  /** Tabelele cu nume și foile cu date, în ordinea din registru. */
  tables: string[];
  headOf(name: string): string[] | undefined;
  problem(r: SheetRel, rels: SheetRel[]): string | null;
  /** 🔍 Găsește singur: relațiile evidente care încă nu sunt în listă. */
  detect(): SheetRel[];
  rels: SheetRel[];
  onChange(rels: SheetRel[]): void;
  onModel(base: string, pick: Record<string, string[]>, pivot: boolean): void;
  onClose(): void;
}) {
  const [sel, setSel] = useState(0);
  const [adding, setAdding] = useState(!rels.length);
  const [nr, setNr] = useState<SheetRel>({ from: tables[0] ?? '', col: headOf(tables[0] ?? '')?.[0] ?? '', to: tables[1] ?? '', col2: headOf(tables[1] ?? '')?.[0] ?? '' });
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const find = () => {
    const found = detect();
    setErr('');
    if (!found.length) { setNote('Nu am găsit alte relații evidente (coloane cu nume asemănătoare, cu toate valorile găsite în tabelul de căutare). Le poți adăuga cu ＋ Relație nouă.'); return; }
    onChange([...rels, ...found]);
    setSel(rels.length);
    setAdding(false);
    setNote(found.length === 1 ? 'Am găsit o relație nouă.' : `Am găsit ${found.length} relații noi.`);
  };
  const bases = useMemo(() => tables.filter((t) => rels.some((r) => r.from.toLocaleLowerCase('ro-RO') === t.toLocaleLowerCase('ro-RO'))), [tables, rels]);
  const [base, setBase] = useState(bases[0] ?? '');
  const [pick, setPick] = useState<Record<string, string[]>>({});
  const curBase = bases.includes(base) ? base : bases[0] ?? '';
  const tree = useMemo(() => (curBase ? relTree(curBase, rels) : []), [curBase, rels]);
  const at = Math.min(sel, rels.length - 1);
  const states = useMemo(() => rels.map((r) => problem(r, rels)), [rels, problem]);

  const setSide = (side: 'from' | 'to', t: string) => {
    const h = headOf(t) ?? [];
    setErr('');
    // La tabelul de căutare, coloana se potrivește singură după nume (Cod client ↔ Cod client), dacă există.
    setNr((x) => (side === 'from' ? { ...x, from: t, col: h.includes(x.col) ? x.col : h[0] ?? '' }
      : { ...x, to: t, col2: h.includes(x.col) ? x.col : h.includes(x.col2) ? x.col2 : h[0] ?? '' }));
  };
  const add = () => {
    if (rels.some((r) => sameRel(r, nr))) { setErr('Relația există deja'); return; }
    const p = problem(nr, rels);
    if (p) { setErr(p); return; }
    onChange([...rels, nr]);
    setSel(rels.length);
    setAdding(false);
    setErr('');
  };
  const toggle = (t: string, c: string) => setPick((p) => {
    const l = p[t] ?? [];
    return { ...p, [t]: l.includes(c) ? l.filter((x) => x !== c) : [...l, c] };
  });
  const chosen = tree.some((n) => (pick[n.table] ?? []).length > 0);
  const pickNow = Object.fromEntries(tree.map((n) => [n.table, pick[n.table] ?? []]));

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg links-dlg rel-dlg" role="dialog" aria-label="Relații între tabele" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Relații între tabele</h3>
        <p className="print-info">O relație leagă un tabel cu multe rânduri (de exemplu Vânzări, cu coloana Cod client) de un tabel de căutare
          (Clienți, unde fiecare cod apare o singură dată). Apoi poți face un tabel sau un rezumat cu coloane din toate tabelele legate.</p>
        {rels.length > 0 && (
          <table className="links-table">
            <thead><tr><th>Tabelul</th><th>Coloana</th><th>Tabelul de căutare</th><th>Coloana</th><th>Stare</th></tr></thead>
            <tbody>
              {rels.map((r, i) => (
                <tr key={`${r.from}|${r.col}|${r.to}|${r.col2}`} className={i === at ? 'sel' : ''} onClick={() => setSel(i)} aria-selected={i === at}>
                  <td>{r.from}</td><td>{r.col}</td><td>{r.to}</td><td>{r.col2}</td>
                  <td title={states[i] ?? ''}>{states[i] ? '⚠ ' + states[i] : 'Bună'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {note && <p className="print-info" role="status">{note}</p>}
        {adding ? (
          <div className="rel-new">
            <label>Tabelul <select value={nr.from} onChange={(e) => setSide('from', e.target.value)} aria-label="Tabelul">
              {tables.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <label>Coloana <select value={nr.col} onChange={(e) => { setErr(''); setNr({ ...nr, col: e.target.value }); }} aria-label="Coloana">
              {(headOf(nr.from) ?? []).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <span aria-hidden>→</span>
            <label>Tabelul de căutare <select value={nr.to} onChange={(e) => setSide('to', e.target.value)} aria-label="Tabelul de căutare">
              {tables.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <label>Coloana <select value={nr.col2} onChange={(e) => { setErr(''); setNr({ ...nr, col2: e.target.value }); }} aria-label="Coloana din tabelul de căutare">
              {(headOf(nr.to) ?? []).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            {err && <p className="print-info links-warn" role="alert">{err}</p>}
          </div>
        ) : null}
        {bases.length > 0 && !adding && (
          <div className="rel-model">
            <h4>Tabel din model</h4>
            <label>Pornesc de la <select value={curBase} onChange={(e) => setBase(e.target.value)} aria-label="Tabelul de bază">
              {bases.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <p className="print-info">{`Bifează ce coloane să vină din tabelele legate (toate coloanele din „${curBase}” rămân).`}</p>
            <div className="rel-cols">
              {tree.map((n) => (
                <fieldset key={n.table}>
                  <legend>{n.table} <small>{`(prin ${n.via.from}.${n.via.col})`}</small></legend>
                  {(headOf(n.table) ?? []).filter((c) => c !== n.via.col2).map((c) => (
                    <label key={c}><input type="checkbox" checked={(pick[n.table] ?? []).includes(c)} onChange={() => toggle(n.table, c)} /> {c}</label>
                  ))}
                </fieldset>
              ))}
            </div>
          </div>
        )}
        <div className="print-actions">
          {adding ? <>
            <button onClick={find} disabled={tables.length < 2} title="Caută singur legăturile evidente: coloane cu nume asemănătoare (Cod client ↔ Cod), unde toate valorile se găsesc o singură dată în celălalt tabel">🔍 Găsește singur</button>
            {rels.length > 0 && <button onClick={() => { setAdding(false); setErr(''); }}>Renunță</button>}
            <button className="primary" disabled={tables.length < 2 || !nr.col || !nr.col2} onClick={add}>Adaugă relația</button>
            {!rels.length && <button onClick={onClose}>Închide</button>}
          </> : <>
            <button onClick={() => { setAdding(true); setNote(''); }} title="Leagă încă două tabele">＋ Relație nouă</button>
            <button onClick={find} disabled={tables.length < 2} title="Caută singur legăturile evidente: coloane cu nume asemănătoare (Cod client ↔ Cod), unde toate valorile se găsesc o singură dată în celălalt tabel">🔍 Găsește singur</button>
            {rels.length > 0 && <button onClick={() => { onChange(rels.filter((_, i) => i !== at)); setSel(0); }} title="Șterge relația aleasă din listă">✕ Șterge</button>}
            {bases.length > 0 && <>
              <button disabled={!chosen} onClick={() => onModel(curBase, pickNow, false)}
                title="Pune pe o foaie nouă tabelul de bază cu coloanele bifate; e o interogare, deci Reîmprospătare totală îl face din nou">▦ Tabel din model</button>
              <button disabled={!chosen} onClick={() => onModel(curBase, pickNow, true)}
                title="Face tabelul din model și deschide imediat Rezumatul (tabelul pivot) pe el">📊 Rezumat din model</button>
            </>}
            <button className="primary" onClick={onClose}>Închide</button>
          </>}
        </div>
      </div>
    </div>
  );
}
