// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Alegerea tabelului cu date pentru Etichete și Plic din tabel: Tabel Suite…, Tabel .xlsx… sau CSV…,
// apoi butoanele cu câmpurile lui («Bloc de adresă» și coloanele), care se pun în textul de completat.
import { useState } from 'react';
import { api, fileName } from '../api';
import { ADDRESS_FIELD, csvFileToMerge, sheetFileToMerge, xlsxFileToMerge, type MergeData } from './merge';

export default function MergeSource({ data, onData, onField }: { data: MergeData | null; onData(d: MergeData): void; onField(field: string): void }) {
  const [err, setErr] = useState('');
  const load = async (kind: 'sheets' | 'xlsx' | 'csv') => {
    setErr('');
    try {
      let d: MergeData | null = null;
      if (kind === 'sheets') {
        const f = await api.openFile('sheets');
        if (f) d = sheetFileToMerge(f.content, fileName(f.path));
      } else {
        const f = await api.importFile(kind);
        if (f) d = kind === 'csv' ? await csvFileToMerge(f.data, fileName(f.path)) : await xlsxFileToMerge(f.data, fileName(f.path));
      }
      if (d) onData(d);
    } catch (e) {
      setErr('Tabelul nu a putut fi citit: ' + (e as Error).message);
    }
  };
  return (
    <>
      <div className="merge-src">
        <button onClick={() => void load('sheets')}>Tabel Cyber Office Studio…</button>
        <button onClick={() => void load('xlsx')}>Tabel .xlsx…</button>
        <button onClick={() => void load('csv')}>CSV…</button>
      </div>
      {data && (
        <div className="merge-src" aria-label="Câmpurile tabelului">
          <span>Pune în text:</span>
          <button onClick={() => onField(ADDRESS_FIELD)} title="Numele și adresa din coloanele tabelului, pe rânduri">«{ADDRESS_FIELD}»</button>
          {data.headers.filter(Boolean).slice(0, 30).map((h) => <button key={h} onClick={() => onField(h)}>«{h}»</button>)}
        </div>
      )}
      {err && <span className="sheet-err-help">{err}</span>}
    </>
  );
}

/** Câmpul pus la capătul textului, despărțit de un spațiu. */
export const withField = (t: string, field: string) => (t && !t.endsWith('\n') && !t.endsWith(' ') ? t + ' ' : t) + `«${field}»`;
