// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Diacritice automate” (Revizuire › Diacritice): pune ă, â, î, ș, ț în textele scrise fără ele. Schimbările sigure
// se fac direct; cuvintele cu mai multe forme corecte („fata” = fată / față) se arată în listă, cu propoziția lor, ca să se aleagă.
// Textele vin din modul (paragrafe, casete, notițe); modulul aplică rezultatul dintr-un singur pas de anulare.
import { useMemo, useState } from 'react';
import { api } from './api';
import { DiacriticChange, findDiacritics } from './diacritics';

export interface DiaItem { id: string; text: string }
export interface DiaResult { id: string; changes: DiacriticChange[] }

interface Props {
  items: DiaItem[];
  /** „documentul”, „selecția”… (apare în fereastră). */
  where: string;
  onApply: (res: DiaResult[]) => void;
  onClose: () => void;
}

interface Row { item: number; ch: DiacriticChange }

export default function DiacriticsDialog({ items, where, onApply, onClose }: Props) {
  const valid = useMemo(() => (api.spellWrong ? (w: string) => !api.spellWrong!(w) : null), []);
  const found = useMemo(() => {
    if (!valid) return null;
    const rows: Row[] = [];
    items.forEach((it, i) => { for (const ch of findDiacritics(it.text, valid)) rows.push({ item: i, ch }); });
    return rows;
  }, [items, valid]);
  const sure = found?.filter((r) => r.ch.sure) ?? [];
  const unsure = found?.filter((r) => !r.ch.sure) ?? [];
  // Alegerea pentru fiecare cuvânt nesigur (implicit, forma propusă).
  const [pick, setPick] = useState<Record<number, string>>({});
  const [onlySure, setOnlySure] = useState(false);

  const apply = () => {
    if (!found) return;
    const byItem = new Map<number, DiacriticChange[]>();
    const add = (r: Row, to: string) => { if (to !== r.ch.from) (byItem.get(r.item) ?? byItem.set(r.item, []).get(r.item)!).push({ ...r.ch, to }); };
    for (const r of sure) add(r, r.ch.to);
    if (!onlySure) unsure.forEach((r, k) => add(r, pick[k] ?? r.ch.to));
    onApply([...byItem].map(([i, changes]) => ({ id: items[i].id, changes })));
  };

  const context = (r: Row) => {
    const t = items[r.item].text;
    const a = Math.max(0, r.ch.start - 30), b = Math.min(t.length, r.ch.end + 30);
    return <>{a > 0 ? '…' : ''}{t.slice(a, r.ch.start)}<b>{t.slice(r.ch.start, r.ch.end)}</b>{t.slice(r.ch.end, b)}{b < t.length ? '…' : ''}</>;
  };
  const nChanged = sure.filter((r) => r.ch.to !== r.ch.from).length + (onlySure ? 0 : unsure.filter((r, k) => (pick[k] ?? r.ch.to) !== r.ch.from).length);

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg dia-dlg" role="dialog" aria-label="Diacritice automate" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Diacritice automate</h3>
        {!found && <p className="print-info">Dicționarul românesc nu e disponibil aici, așa că diacriticele nu se pot pune.</p>}
        {found && (
          <>
            <p className="print-info">{`În ${where}: ${sure.length} cuvinte primesc sigur diacritice.`}</p>
            <p className="print-info">{unsure.length ? `${unsure.length} cuvinte au mai multe forme corecte: alege forma potrivită.` : 'Niciun cuvânt nu are nevoie de verificare.'}</p>
            {unsure.length > 0 && (
              <>
                <label className="print-row"><input type="checkbox" checked={onlySure} onChange={(e) => setOnlySure(e.target.checked)} /> Schimbă doar cuvintele sigure (lasă-le pe acestea cum sunt)</label>
                <div className="dia-list" aria-label="Cuvinte de verificat">
                  {unsure.map((r, k) => (
                    <div key={k} className="dia-row">
                      <span className="dia-ctx">{context(r)}</span>
                      <select aria-label={`Forma pentru „${r.ch.from}”`} disabled={onlySure} value={pick[k] ?? r.ch.to} onChange={(e) => setPick({ ...pick, [k]: e.target.value })}>
                        {[...new Set([...r.ch.options, r.ch.from])].map((o) => <option key={o} value={o}>{o === r.ch.from ? `${o} (cum e scris)` : o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" autoFocus disabled={!found || !nChanged} onClick={apply} title="Pune diacriticele; Ctrl+Z le scoate pe toate dintr-un pas">{`Pune diacriticele (${nChanged})`}</button>
        </div>
      </div>
    </div>
  );
}
