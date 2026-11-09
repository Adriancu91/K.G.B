// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Îmbinare”: alegi tabelul cu date, pui câmpurile în document, vezi cum arată un rând,
// apoi faci toate exemplarele (un document cu pagini separate, câte un fișier Word sau câte un mesaj de e-mail .eml pentru fiecare rând).
import { useState } from 'react';
import type { Editor, JSONContent } from '@tiptap/react';
import { api, fileName } from '../api';
import { safeFileName } from '../notes/format';
import { emailColumn, mergeEml } from './eml';
import { ADDRESS_FIELD, GREETING_FIELD, csvFileToMerge, fieldValue, FILTER_OPS, FilterOp, fillDoc, ifField, MergeData, RecipientPick, recipientRows, RULE_OPS, RuleOp, sheetFileToMerge, skipField, skipRow, skipRules, unmatchedFields, usedFields, checkMerge, withMatch, xlsxFileToMerge, fieldKey } from './merge';

interface Props {
  editor: Editor;
  data: MergeData | null;
  setData(d: MergeData | null): void;
  /** `rows`: rândurile din tabel alese în lista de destinatari, în ordinea lor. */
  onCombined(doc: JSONContent, rows: number[], list?: boolean): void;
  /** Tipărește direct exemplarele rândurilor date (documentul rămâne modelul cu câmpuri). */
  onPrint(doc: JSONContent, rows: number[]): void;
  /** PDF-ul unui exemplar completat, cu aspectul paginii documentului (doar în aplicația instalată). */
  pdfOf?(filled: JSONContent): Promise<Uint8Array>;
  onClose(): void;
}

export default function MergeDialog({ editor, data, setData, onCombined, onPrint, pdfOf, onClose }: Props) {
  const [row, setRow] = useState(0);
  const [nameCol, setNameCol] = useState(0);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [pick, setPick] = useState<RecipientPick>({});
  const [showList, setShowList] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  // Tipărirea directă: toate exemplarele, doar cel din previzualizare sau de la … până la … (numerele din lista destinatarilor).
  const [prRange, setPrRange] = useState<'all' | 'cur' | 'range'>('all');
  const [prFrom, setPrFrom] = useState(1);
  const [prTo, setPrTo] = useState(1);
  // Mesajele de e-mail: coloana cu adresele (null = găsită singură) și subiectul (cu câmpuri «…» dacă vrei).
  const [mailCol, setMailCol] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  // Atașat la fiecare mesaj: exemplarul lui, ca PDF sau .docx. Cât se fac PDF-urile, modelul e ținut aici (editorul arată pe rând exemplarele).
  const [attachKind, setAttachKind] = useState<'' | 'pdf' | 'docx'>('');
  const [frozen, setFrozen] = useState<JSONContent | null>(null);
  // Câte un fișier pentru fiecare rând: .docx sau PDF (de exemplu diplome sau facturi de trimis ca PDF).
  const [fileKind, setFileKind] = useState<'docx' | 'pdf'>('docx');

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
      if (d) { setData(d); setRow(0); setNameCol(0); setPick({}); }
    } catch (e) {
      setErr('Tabelul nu a putut fi citit: ' + (e as Error).message);
    }
  };

  const doc = frozen ?? editor.getJSON();
  const fields = usedFields(doc);
  const missing = data ? fields.filter((f) => fieldValue(data, 0, f) === null) : [];
  // Câmpurile fără coloană cu același nume: omul alege coloana potrivită (Potrivește câmpurile).
  const unmatched = data ? unmatchedFields(data, fields) : [];
  const total = data?.rows.length ?? 0;
  // Destinatarii aleși: filtrați, sortați, fără cei debifați; `row` e poziția în lista lor.
  const listed = data ? recipientRows(data, pick, true) : [];
  // Fără cei debifați și fără rândurile sărite de regulile «SARI DACĂ …» din document.
  const skips = data ? skipRules(doc) : [];
  const skipped = data ? listed.filter((i) => skipRow(skips, data, i)).length : 0;
  const rows = listed.filter((i) => !(pick.excluded ?? []).includes(i) && !(data && skipRow(skips, data, i)));
  const n = rows.length;
  const pos = Math.min(row, Math.max(0, n - 1));
  const cur = rows[pos] ?? 0;
  const upd = (p: Partial<RecipientPick>) => { setPick((o) => ({ ...o, ...p })); setRow(0); };
  const toggle = (i: number) => { setPick((o) => { const ex = o.excluded ?? []; return { ...o, excluded: ex.includes(i) ? ex.filter((x) => x !== i) : [...ex, i] }; }); setRow(0); };

  const insertField = (h: string) => { editor.chain().focus().insertContent(`«${h}»`).run(); };
  // Fereastra mică pentru reguli: DACĂ (text după o condiție) sau SARI DACĂ (fără exemplar pentru rândurile acelea).
  const [rule, setRule] = useState<{ kind: 'if' | 'skip'; field: string; op: RuleOp; value: string; yes: string; no: string } | null>(null);
  const insertRule = () => {
    if (!rule || !rule.field) return;
    editor.chain().focus().insertContent(rule.kind === 'if' ? ifField(rule.field, rule.op, rule.value, rule.yes, rule.no) : skipField(rule.field, rule.op, rule.value)).run();
    setRule(null);
  };

  const separateFiles = async () => {
    if (!data) return;
    const dir = await api.pickFolder('Unde salvez documentele?');
    if (!dir) return;
    const pdf = fileKind === 'pdf' && !!pdfOf;
    const { docToDocx } = await import('./docx');
    let done = 0;
    // Cât se fac PDF-urile, modelul e ținut aici și fereastra nu intră în PDF (merge-pdf-busy).
    if (pdf) { setFrozen(doc); await new Promise((r) => window.setTimeout(r, 50)); }
    try {
      for (let k = 0; k < n; k++) {
        const r = rows[k];
        setBusy(`Se scrie documentul ${k + 1} din ${n}…`);
        const filled = fillDoc(doc, data, r);
        const bytes = pdf ? await pdfOf!(filled) : await docToDocx(filled);
        const name = safeFileName(data.rows[r][nameCol] || `Document ${r + 1}`);
        await api.writeToFolder(dir, `${name}.${pdf ? 'pdf' : 'docx'}`, bytes);
        done++;
      }
      setBusy(pdf ? `Gata: ${done} documente PDF în ${dir}` : `Gata: ${done} documente .docx în ${dir}`);
    } catch (e) {
      setBusy('');
      setErr(`S-au scris ${done} documente, apoi a apărut o eroare: ${(e as Error).message}`);
    } finally {
      setFrozen(null);
    }
  };

  const emailCol = data ? (mailCol !== null && mailCol < data.headers.length ? mailCol : emailColumn(data)) : -1;
  const emailFiles = async () => {
    if (!data || emailCol < 0) return;
    const dir = await api.pickFolder('Unde salvez mesajele?');
    if (!dir) return;
    let done = 0, noAddr = 0;
    const enc = new TextEncoder();
    const kind = attachKind === 'pdf' && !pdfOf ? '' : attachKind;
    const { docToDocx } = kind === 'docx' ? await import('./docx') : { docToDocx: null };
    // Fereastra se ascunde din PDF-uri (merge-pdf-busy) înainte de primul exemplar.
    if (kind === 'pdf') { setFrozen(doc); await new Promise((r) => window.setTimeout(r, 50)); }
    try {
      for (let k = 0; k < n; k++) {
        const r = rows[k];
        setBusy(`Se scrie mesajul ${k + 1} din ${n}…`);
        const base = safeFileName(data.rows[r][nameCol] || `Document ${r + 1}`);
        const attach = kind === 'pdf' ? async (f: JSONContent) => ({ name: `${base}.pdf`, type: 'application/pdf', data: await pdfOf!(f) })
          : kind === 'docx' && docToDocx ? async (f: JSONContent) => ({ name: `${base}.docx`, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: await docToDocx(f) })
          : undefined;
        const eml = await mergeEml(doc, data, r, emailCol, subject, attach);
        if (!eml) { noAddr++; continue; }
        // Două rânduri cu același nume nu se scriu unul peste altul (writeToFolder pune „ (2)”).
        await api.writeToFolder(dir, `${safeFileName(data.rows[r][nameCol] || `Mesaj ${r + 1}`)}.eml`, enc.encode(eml));
        done++;
      }
      const what = kind === 'pdf' ? (done === 1 ? 'mesaj .eml cu PDF-ul atașat' : 'mesaje .eml cu PDF-ul atașat')
        : kind === 'docx' ? (done === 1 ? 'mesaj .eml cu fișierul .docx atașat' : 'mesaje .eml cu fișierul .docx atașat') : done === 1 ? 'mesaj .eml' : 'mesaje .eml';
      setBusy(`Gata: ${done} ${what} în ${dir}${noAddr ? ` (${noAddr} ${noAddr === 1 ? 'rând fără adresă bună, sărit' : 'rânduri fără adresă bună, sărite'})` : ''}. Deschide-le cu programul de e-mail și apasă Trimite`);
    } catch (e) {
      setBusy('');
      setErr(`S-au scris ${done} mesaje, apoi a apărut o eroare: ${(e as Error).message}`);
    } finally {
      setFrozen(null);
    }
  };

  const printRows = prRange === 'all' ? rows : prRange === 'cur' ? rows.slice(pos, pos + 1)
    : rows.slice(Math.max(1, Math.min(prFrom, prTo)) - 1, Math.max(prFrom, prTo));

  // Previzualizare: valoarea fiecărui câmp din document pentru rândul ales.
  // Verifică erorile: pe toți destinatarii aleși, nu doar pe cel din previzualizare.
  const report = data && showCheck ? checkMerge(data, fields, rows) : null;
  const preview = data ? fields.map((f) => [f, fieldValue(data, cur, f)] as const) : [];

  return (
    <div className={`print-overlay${frozen ? " merge-pdf-busy" : ""}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg merge-dlg" role="dialog" aria-label="Îmbinare de corespondență" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Îmbinare de corespondență</h3>
        <p className="print-info">
          Același document, completat pentru fiecare rând dintr-un tabel (contracte, adeverințe, invitații).
          Primul rând al tabelului are numele coloanelor; în document, câmpurile se scriu între « », de exemplu «Nume».
        </p>
        <div className="print-row">
          <span className="print-label">1. Datele</span>
          <div className="print-opts">
            <div className="merge-src">
              <button onClick={() => load('sheets')}>Tabel Cyber Office Studio…</button>
              <button onClick={() => load('xlsx')}>Tabel .xlsx…</button>
              <button onClick={() => load('csv')}>CSV…</button>
            </div>
            {data && <span>{data.source}: {total} {total === 1 ? 'rând' : 'rânduri'}, {data.headers.length} coloane</span>}
            {data && (
              <div className="merge-src merge-pick">
                <label>Doar unde <select aria-label="Coloana filtrului" value={pick.filterCol ?? -1} onChange={(e) => upd({ filterCol: Number(e.target.value), op: pick.op ?? 'contine' })}>
                  <option value={-1}>(toate rândurile)</option>
                  {data.headers.map((h, i) => <option key={h} value={i}>{h}</option>)}
                </select></label>
                {(pick.filterCol ?? -1) >= 0 && (<>
                  <select aria-label="Condiția filtrului" value={pick.op ?? 'contine'} onChange={(e) => upd({ op: e.target.value as FilterOp })}>
                    {FILTER_OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  {pick.op !== 'gol' && pick.op !== 'negol' && <input aria-label="Textul filtrului" value={pick.text ?? ''} onChange={(e) => upd({ text: e.target.value })} placeholder="text" size={12} />}
                </>)}
                <label>Ordonează după <select aria-label="Coloana sortării" value={pick.sortCol ?? -1} onChange={(e) => upd({ sortCol: Number(e.target.value) })}>
                  <option value={-1}>(ordinea din tabel)</option>
                  {data.headers.map((h, i) => <option key={h} value={i}>{h}</option>)}
                </select></label>
                {(pick.sortCol ?? -1) >= 0 && <button onClick={() => upd({ desc: !pick.desc })} title="Schimbă sensul ordonării">{pick.desc ? '↓ Z→A' : '↑ A→Z'}</button>}
                <button onClick={() => setShowList((v) => !v)} aria-expanded={showList} title="Lista destinatarilor: debifează pe cine nu vrei">☑ Destinatari: {n} din {total}</button>
              </div>
            )}
            {data && showList && (
              <div className="merge-list" role="group" aria-label="Lista destinatarilor">
                <table>
                  <thead><tr>
                    <th><input type="checkbox" aria-label="Toți" checked={!(pick.excluded ?? []).length} onChange={(e) => setPick((o) => ({ ...o, excluded: e.target.checked ? [] : data.rows.map((_, i) => i) }))} /></th>
                    {data.headers.slice(0, 4).map((h) => <th key={h}>{h}</th>)}
                  </tr></thead>
                  <tbody>{listed.slice(0, 500).map((i) => (
                    <tr key={i}>
                      <td><input type="checkbox" aria-label={`Rândul ${i + 1}`} checked={!(pick.excluded ?? []).includes(i)} onChange={() => toggle(i)} /></td>
                      {data.headers.slice(0, 4).map((h, c) => <td key={h}>{data.rows[i][c]}</td>)}
                    </tr>
                  ))}</tbody>
                </table>
                {listed.length > 500 && <span className="muted">Se văd primele 500 de rânduri din {listed.length}.</span>}
              </div>
            )}
          </div>
        </div>
        {data && (
          <div className="print-row">
            <span className="print-label">2. Câmpuri</span>
            <div className="print-opts">
              <span className="muted">Click pe o coloană o pune în document, unde e cursorul:</span>
              <div className="merge-fields">
                {data.headers.map((h) => <button key={h} onClick={() => insertField(h)} title={`Pune «${h}» în document`}>«{h}»</button>)}
                <button onClick={() => insertField(ADDRESS_FIELD)} title="Numele, firma, strada, codul și localitatea, județul, țara, fiecare pe rândul lui (din coloanele cu aceste nume)">📮 «{ADDRESS_FIELD}»</button>
                <button onClick={() => setRule({ kind: 'if', field: data.headers[0] ?? '', op: '=', value: '', yes: '', no: '' })} title="Regulă: un text dacă o coloană are o anumită valoare și altul dacă nu (de exemplu „Stimate client din București” / „Stimate client”). În texte, {Nume} pune valoarea coloanei.">❓ Regulă «DACĂ…»</button>
                <button onClick={() => setRule({ kind: 'skip', field: data.headers[0] ?? '', op: '=', value: '', yes: '', no: '' })} title="Regulă: rândurile care îndeplinesc condiția nu primesc exemplar (de exemplu cei care au plătit deja)">⏭ Regulă «SARI DACĂ…»</button>
                <button onClick={() => insertField(GREETING_FIELD)} title="„Stimate domnule Popescu,” / „Stimată doamnă Ionescu,” după coloana Titlu sau Gen; altfel „Bună ziua, Ion Popescu,”">👋 «{GREETING_FIELD}»</button>
              </div>
              {rule && (
                <div className="merge-rule" role="group" aria-label={rule.kind === 'if' ? 'Regulă DACĂ' : 'Regulă SARI DACĂ'}>
                  <span>{rule.kind === 'if' ? 'DACĂ' : 'SARI rândul DACĂ'}</span>
                  <select aria-label="Coloana" value={rule.field} onChange={(e) => setRule({ ...rule, field: e.target.value })}>
                    {data.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select aria-label="Comparația" value={rule.op} onChange={(e) => setRule({ ...rule, op: e.target.value as RuleOp })}>
                    {RULE_OPS.map((o) => <option key={o} value={o}>{o === '<>' ? '≠ (diferit de)' : o}</option>)}
                  </select>
                  <input aria-label="Valoarea" placeholder="valoarea" value={rule.value} onChange={(e) => setRule({ ...rule, value: e.target.value })} />
                  {rule.kind === 'if' && (<>
                    <input aria-label="Textul dacă da" placeholder="atunci textul…" value={rule.yes} onChange={(e) => setRule({ ...rule, yes: e.target.value })} />
                    <input aria-label="Textul dacă nu" placeholder="altfel textul… (poate rămâne gol)" value={rule.no} onChange={(e) => setRule({ ...rule, no: e.target.value })} />
                  </>)}
                  <button className="primary" onClick={insertRule} disabled={!rule.field}>Pune în document</button>
                  <button onClick={() => setRule(null)}>Renunță</button>
                </div>
              )}
              {skipped > 0 && <span className="muted">Regulile «SARI DACĂ…» sar peste {skipped} {skipped === 1 ? 'rând' : 'rânduri'}.</span>}
              {data && unmatched.length > 0 && (
                <div className="merge-match">
                  {missing.length > 0
                    ? <span className="merge-warn">Tabelul nu are coloana pentru: {missing.map((f) => `«${f}»`).join(', ')}. Alege mai jos coloana potrivită (altfel rămân neschimbate).</span>
                    : <span className="muted">Potrivește câmpurile: toate au coloana lor.</span>}
                  {unmatched.map((f) => (
                    <label key={f} title={`Coloana din tabel care completează «${f}»`}>
                      <span>«{f}» →</span>
                      <select aria-label={`Coloana pentru «${f}»`} value={data.match?.[fieldKey(f)] ?? ''} onChange={(e) => setData(withMatch(data, f, e.target.value))}>
                        <option value="">(nepotrivit)</option>
                        {data.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {data && fields.length > 0 && (
          <div className="print-row">
            <span className="print-label">3. Verifică</span>
            <div className="print-opts merge-preview">
              <div>
                <button onClick={() => setRow((r) => Math.max(0, r - 1))} disabled={pos === 0}>◀</button>
                <span> {n ? <>destinatarul {pos + 1} din {n} (rândul {cur + 1} din tabel)</> : 'niciun destinatar ales'} </span>
                <button onClick={() => setRow((r) => Math.min(n - 1, r + 1))} disabled={pos >= n - 1}>▶</button>
                <button onClick={() => setShowCheck((v) => !v)} className={showCheck ? 'active' : ''} disabled={!n}
                  title="Verifică toți destinatarii aleși: câmpurile fără coloană în tabel și câmpurile goale, cu rândurile lor">🔍 Verifică erorile</button>
              </div>
              {report && (
                <div className="merge-check">
                  {!report.missing.length && !report.empty.length && <span className="merge-ok">✓ Nicio eroare: toate cele {n} exemplare au toate câmpurile completate.</span>}
                  {report.missing.length > 0 && <span className="merge-warn">Câmpuri fără coloană în tabel: {report.missing.map((f) => `«${f}»`).join(', ')} (rămân neschimbate în toate exemplarele).</span>}
                  {report.empty.map((e) => (
                    <span key={e.field}>«{e.field}» e gol la {e.rows.length} din {n} {n === 1 ? 'destinatar' : 'destinatari'}: {e.rows.slice(0, 8).map((r) => (
                      <button key={r} className="link" onClick={() => setRow(rows.indexOf(r))} title="Arată destinatarul în previzualizare">rândul {r + 1}</button>
                    ))}{e.rows.length > 8 ? ' …' : ''}</span>
                  ))}
                </div>
              )}
              <table><tbody>
                {preview.map(([f, v]) => <tr key={f}><td>«{f}»</td><td style={{ whiteSpace: 'pre-line' }}>{v === null ? <i>lipsește</i> : v || <i>gol</i>}</td></tr>)}
              </tbody></table>
            </div>
          </div>
        )}
        {data && fields.length > 0 && (
          <div className="print-row">
            <span className="print-label">4. Fă</span>
            <div className="print-opts">
              <button className="primary" onClick={() => onCombined(doc, rows)} disabled={!n || (!!busy && !busy.startsWith('Gata'))}>
                Un document cu toate ({n} {n === 1 ? 'exemplar' : 'exemplare'}, fiecare pe pagina lui)
              </button>
              <button onClick={() => onCombined(doc, rows, true)} disabled={!n || (!!busy && !busy.startsWith('Gata'))}
                title="Catalog: exemplarele unul sub altul, fără pagină nouă între ele (o listă de prețuri, o agendă, un tabel de prezență). Pune în document doar rândul sau paragraful care se repetă.">
                Listă / catalog (unul sub altul, fără pagini noi)
              </button>
              <div className="merge-src">
                <button onClick={() => onPrint(doc, printRows)} disabled={!printRows.length || (!!busy && !busy.startsWith('Gata'))}
                  title="Tipărește exemplarele direct, fără să le pui în document: modelul cu câmpuri rămâne cum e">🖨 Tipărește exemplarele</button>
                <label>care <select aria-label="Ce exemplare tipărești" value={prRange} onChange={(e) => setPrRange(e.target.value as 'all' | 'cur' | 'range')}>
                  <option value="all">toate</option>
                  <option value="cur">doar cel din previzualizare</option>
                  <option value="range">de la … până la …</option>
                </select></label>
                {prRange === 'range' && <>
                  <input type="number" className="merge-num" aria-label="De la exemplarul" min={1} max={n} value={prFrom} onChange={(e) => setPrFrom(Math.max(1, Math.min(n, Number(e.target.value) || 1)))} />
                  <span>–</span>
                  <input type="number" className="merge-num" aria-label="Până la exemplarul" min={1} max={n} value={prTo} onChange={(e) => setPrTo(Math.max(1, Math.min(n, Number(e.target.value) || 1)))} />
                </>}
                <span className="merge-count">{printRows.length} {printRows.length === 1 ? 'exemplar' : 'exemplare'}</span>
              </div>
              <div className="merge-src">
                <button onClick={separateFiles} disabled={!n || (!!busy && !busy.startsWith('Gata'))}>{fileKind === 'pdf' && pdfOf ? 'Câte un fișier PDF pentru fiecare rând…' : 'Câte un fișier .docx pentru fiecare rând…'}</button>
                {pdfOf && <label>ca <select aria-label="Felul fișierelor" value={fileKind} onChange={(e) => setFileKind(e.target.value as 'docx' | 'pdf')}>
                  <option value="docx">.docx</option>
                  <option value="pdf">PDF</option>
                </select></label>}
                <label>numit după <select value={nameCol} onChange={(e) => setNameCol(Number(e.target.value))}>
                  {data.headers.map((h, i) => <option key={h} value={i}>{h}</option>)}
                </select></label>
              </div>
              <div className="merge-src">
                <button onClick={emailFiles} disabled={!n || emailCol < 0 || (!!busy && !busy.startsWith('Gata'))}
                  title={emailCol < 0 ? 'Tabelul nu are o coloană cu adrese de e-mail' : 'Câte un mesaj de e-mail (.eml) pentru fiecare rând, cu adresa, subiectul și textul completate. Le deschizi cu programul de e-mail și apeși Trimite: Cyber Office Studio nu trimite nimic singur'}>✉ Câte un e-mail (.eml) pentru fiecare rând…</button>
                <label>către <select aria-label="Coloana cu adresele de e-mail" value={emailCol} onChange={(e) => setMailCol(Number(e.target.value))}>
                  {emailCol < 0 && <option value={-1}>(nicio coloană cu adrese)</option>}
                  {data.headers.map((h, i) => <option key={h} value={i}>{h}</option>)}
                </select></label>
                <label>subiect <input type="text" aria-label="Subiectul mesajelor" value={subject} placeholder="de exemplu Factura «Număr»" onChange={(e) => setSubject(e.target.value)} /></label>
                <label title="Exemplarul fiecărui destinatar, pus ca fișier atașat la mesajul lui (de exemplu factura sau contractul lui)">atașat <select aria-label="Fișierul atașat la mesaje" value={attachKind} onChange={(e) => setAttachKind(e.target.value as '' | 'pdf' | 'docx')}>
                  <option value="">nimic</option>
                  {pdfOf && <option value="pdf">documentul lui, ca PDF</option>}
                  <option value="docx">documentul lui, ca .docx</option>
                </select></label>
              </div>
            </div>
          </div>
        )}
        {data && !fields.length && <p className="print-info">Documentul nu are încă niciun câmp. Pune-le din lista de mai sus.</p>}
        {(busy || err) && <p className={`print-info ${err ? 'merge-warn' : ''}`}>{err || busy}</p>}
        <div className="print-actions">
          <button onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}
