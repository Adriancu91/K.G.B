// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Recuperează documentele nesalvate”: ciornele păstrate automat cât scrii într-un document fără fișier
// (și după „Nu salva” sau o oprire bruscă), cel mult 7 zile. Deschide aduce ciorna într-un document nou, nesalvat.
import { useEffect, useRef, useState } from 'react';
import { api, DraftInfo, FileKind } from './api';

// Ciorna fiecărui tab: numele ei ține de tab, ca întoarcerea în modul să n-o dubleze; un document nou în același tab
// primește o ciornă nouă, ca cea veche (renunțată cu „Nu salva”) să rămână de recuperat.
const DRAFT_MS = 5000;
const RUN = Date.now().toString(36);
const ids = new Map<string, string>();
// Taburile deschise acum: ciornele lor nu apar la Recuperează (documentul e chiar acolo).
const live = new Set<string>();
const prefix = (kind: FileKind) => (kind === 'sheets' || kind === 'slides' ? kind : 'doc');

/** Ciorna tabului; `fresh` = un document nou în același tab. */
export function draftOf(tab: string, kind: FileKind, fresh = false): string {
  if (fresh || !ids.has(tab)) ids.set(tab, `${prefix(kind)}-${RUN}${Math.random().toString(36).slice(2, 8)}`);
  return ids.get(tab) as string;
}
/** Documentul deschis din ciorna asta continuă în ea până la salvare. */
export const adoptDraft = (tab: string, id: string) => { ids.set(tab, id); };
/** Ciornele documentelor deschise acum (pentru `exclude`). */
export const openDraftIds = () => [...live].map((t) => ids.get(t) ?? '');
/** După salvarea unui document fără fișier: ciorna lui nu mai trebuie. */
export const dropDraft = (tab: string, kind: FileKind) => { void api.delDraft(draftOf(tab, kind)).catch(() => {}); };

/**
 * Păstrează documentul tabului ca ciornă la câteva secunde, cât `active` (nesalvat și fără fișier), doar când s-a schimbat.
 * `get`: titlul și conținutul; null = document gol (ciorna se șterge); undefined = încă nimic de citit.
 * `restored`: tabul s-a întors din alt modul (își păstrează ciorna); altfel pornește cu una nouă.
 */
export function useDraft(tab: string, kind: FileKind, restored: boolean, active: boolean, get: () => { title: string; content: string } | null | undefined) {
  const getRef = useRef(get);
  getRef.current = get;
  useEffect(() => {
    if (!restored) draftOf(tab, kind, true);
    live.add(tab);
    return () => { live.delete(tab); };
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!active) return;
    let last = '';
    const put = () => {
      let d: { title: string; content: string } | null | undefined;
      try { d = getRef.current(); } catch { return; }
      if (d === undefined) return;
      const id = draftOf(tab, kind);
      if (d === null) { if (last) { last = ''; void api.delDraft(id).catch(() => {}); } return; }
      if (d.content === last) return;
      last = d.content;
      void api.putDraft({ id, kind, title: d.title.trim().slice(0, 80), content: d.content }).catch(() => {});
    };
    const t = window.setInterval(put, DRAFT_MS);
    return () => window.clearInterval(t);
  }, [active, tab, kind]);
}

const pad = (n: number) => String(n).padStart(2, '0');
function when(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const size = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default function DraftsDialog({ kind, exclude, onOpen, onClose }: {
  kind: FileKind;
  /** Ciornele documentelor deschise acum (nu se arată în listă). */
  exclude?: string[];
  onOpen(id: string, content: string): void;
  onClose(): void;
}) {
  const [list, setList] = useState<DraftInfo[] | null>(null);
  const [error, setError] = useState('');
  const reload = () => api.listDrafts(kind).then((l) => setList(l.filter((d) => !exclude?.includes(d.id))), () => setList([]));
  useEffect(() => { void reload(); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = async (d: DraftInfo) => {
    try { onOpen(d.id, await api.readDraft(d.id)); } catch { setError('Ciorna nu a putut fi citită.'); }
  };
  const del = async (d: DraftInfo) => {
    try { await api.delDraft(d.id); } catch { setError('Ciorna nu a putut fi ștearsă.'); }
    void reload();
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg versions-dlg drafts-dlg"
        role="dialog"
        aria-label="Documente nesalvate"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      >
        <h3>Recuperează documentele nesalvate</h3>
        <p className="print-info">
          Cât scrii într-un document care n-a fost încă salvat, o copie se păstrează automat pe acest calculator, la câteva secunde.
          Rămâne 7 zile, chiar dacă ai închis documentul fără să-l salvezi. După ce îl salvezi, copia se șterge.
        </p>
        {list === null ? (
          <p className="print-info">Se încarcă…</p>
        ) : list.length ? (
          <ul className="versions-list">
            {list.map((d) => (
              <li key={d.id}>
                <span className="drafts-title" title={d.title}>{d.title || 'Document nou'}</span>
                <span>{when(d.time)}</span>
                <span className="versions-size">{size(d.size)}</span>
                <button onClick={() => open(d)} title="Deschide ciorna într-un document nou, nesalvat">Deschide</button>
                <button onClick={() => del(d)} title="Șterge ciorna (nu se mai poate recupera)" aria-label="Șterge ciorna">🗑</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="print-info">Niciun document nesalvat din ultimele 7 zile.</p>
        )}
        {error && <p className="print-info sheet-err-help">{error}</p>}
        <div className="print-actions">
          <button autoFocus onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}
