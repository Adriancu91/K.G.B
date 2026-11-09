// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Versiuni”: variantele vechi ale fișierului, păstrate automat la salvare.
// Alegi una și se deschide în locul celei de acum (Ctrl+Z te întoarce; nimic nu se pierde la salvare).
import { type ReactNode, useEffect, useState } from 'react';
import { api, FileVersion } from './api';
import { compareLines, DiffLine, diffLines } from './versionText';
import { currentLang } from './i18n';

function when(time: string): string {
  const [d, t] = time.split('T');
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}, ${t.slice(0, 5)}`;
}

function size(n: number): string {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function VersionsDialog({ path, onRestore, onClose, current }: {
  path: string | null; onRestore(content: string, label: string): void; onClose(): void;
  /** Conținutul de acum (cum ar fi salvat), pentru „Compară”. */
  current?: () => string;
}) {
  const [cmp, setCmp] = useState<{ v: FileVersion; diff: DiffLine[] | null } | null>(null);
  const compare = async (v: FileVersion) => {
    if (!path || !current) return;
    try { setCmp({ v, diff: diffLines(compareLines(await api.readVersion(path, v.id), currentLang() === 'en'), compareLines(current(), currentLang() === 'en')) }); } catch { setError('Versiunea nu a putut fi citită.'); }
  };
  const [list, setList] = useState<FileVersion[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!path) { setList([]); return; }
    api.listVersions(path).then(setList, () => setList([]));
  }, [path]);
  const restore = async (v: FileVersion) => {
    if (!path) return;
    try { onRestore(await api.readVersion(path, v.id), when(v.time)); } catch { setError('Versiunea nu a putut fi citită.'); }
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg versions-dlg"
        role="dialog"
        aria-label="Versiuni"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      >
        {cmp ? <Compare title={`Ce s-a schimbat din ${when(cmp.v.time)} până acum`} diff={cmp.diff} onBack={() => setCmp(null)} onOpen={() => restore(cmp.v)} /> : <>
        <h3>Versiunile mai vechi</h3>
        <p className="print-info">
          La salvare se păstrează automat varianta de dinainte (cel mult una la 10 minute, ultimele 30), pe acest calculator.
          Deschide una ca s-o vezi; dacă o salvezi, varianta de acum rămâne și ea în listă.
        </p>
        {!path ? (
          <p className="print-info">Fișierul nu e salvat încă. Versiunile apar după ce îl salvezi de câteva ori.</p>
        ) : list === null ? (
          <p className="print-info">Se încarcă…</p>
        ) : list.length ? (
          <ul className="versions-list">
            {list.map((v) => (
              <li key={v.id}>
                <span>{when(v.time)}</span>
                <span className="versions-size">{size(v.size)}</span>
                {current && <button onClick={() => compare(v)} title="Arată ce s-a schimbat de atunci: rândurile scoase (roșu) și cele adăugate (verde)">Compară</button>}
                <button onClick={() => restore(v)}>Deschide</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="print-info">Nicio versiune veche încă. Prima apare la următoarea salvare.</p>
        )}
        {error && <p className="print-info sheet-err-help">{error}</p>}
        <div className="print-actions">
          <button autoFocus onClick={onClose}>Închide</button>
        </div>
        </>}
      </div>
    </div>
  );
}

/** Ce s-a schimbat între versiune și acum: doar rândurile schimbate, cu câte un rând neschimbat în jur ca reper. */
export function Compare({ title, diff, onBack, onOpen, backLabel = 'Înapoi la listă', other, here, hint, actions }: {
  title: string; diff: DiffLine[] | null; onBack(): void; onOpen?(): void; backLabel?: string;
  /** Butoane în plus, lângă Închide (de exemplu raportul ca PDF). */
  actions?: ReactNode;
  /** O explicație sub titlu (la două tabele: celulele diferite sunt colorate). */
  hint?: string;
  /** La compararea cu alt fișier: numele lui (rândurile roșii sunt doar în el, cele verzi doar aici). */
  other?: string;
  /** Numele celuilalt fișier, la compararea a două taburi (rândurile verzi sunt doar în el); altfel „aici”. */
  here?: string;
}) {
  const removed = diff?.filter((d) => d.kind === 'old').length ?? 0;
  const added = diff?.filter((d) => d.kind === 'new').length ?? 0;
  const near = (i: number) => !!diff && [i - 1, i, i + 1].some((k) => diff[k] && diff[k].kind !== 'same');
  const rows: (DiffLine | null)[] = [];
  diff?.forEach((d, i) => { if (near(i)) rows.push(d); else if (rows[rows.length - 1] !== null) rows.push(null); });
  return (
    <>
      <h3>{title}</h3>
      {hint && diff && <p className="print-info cmp-hint">{hint}</p>}
      {!diff ? (
        <p className="print-info">Textul e prea lung pentru o comparare rapidă. Deschide versiunea ca s-o vezi întreagă.</p>
      ) : !removed && !added ? (
        <p className="print-info">Textul e la fel (s-au schimbat poate doar formatarea, culorile sau pozele).</p>
      ) : (
        <>
          <p className="print-info">{other ? (
            <><span className="diff-old">{removed} {removed === 1 ? 'rând' : 'rânduri'} doar în „{other}”</span> · <span className="diff-new">{added} {added === 1 ? 'rând' : 'rânduri'} doar {here ? <>în „{here}”</> : 'aici'}</span></>
          ) : (
            <><span className="diff-old">{removed} {removed === 1 ? 'rând scos' : 'rânduri scoase'}</span> · <span className="diff-new">{added} {added === 1 ? 'rând adăugat' : 'rânduri adăugate'}</span></>
          )}</p>
          <div className="diff-list">
            {rows.map((d, i) => d === null
              ? <div key={i} className="diff-gap">…</div>
              : <div key={i} className={`diff-line ${d.kind}`}><span className="diff-mark">{d.kind === 'old' ? '−' : d.kind === 'new' ? '+' : ''}</span>{d.text}</div>)}
          </div>
        </>
      )}
      <div className="print-actions">
        {actions}
        {onOpen && <button onClick={onOpen} title="Readuce această versiune (Ctrl+Z te întoarce)">Deschide versiunea</button>}
        <button autoFocus onClick={onBack}>{backLabel}</button>
      </div>
    </>
  );
}
