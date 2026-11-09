// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul „❝ Citare” din Docs: alegi o sursă citată deja sau scrii una nouă (carte, articol, pagină web), pui citarea la cursor,
// schimbi stilul (APA / MLA / ISO 690) pentru tot documentul și pui bibliografia. O sursă schimbată aici se schimbă la toate citările ei.
// Lista principală (în setări) ține sursele între documente: o sursă nouă citată intră singură în ea și se poate alege în alt document.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { api } from '../api';
import { addToMaster, CITE_STYLES, citeText, cleanMaster, cleanSource, docSources, docStyle, inMaster, refText, removeFromMaster, SOURCE_KINDS, type CiteStyle, type Source } from './citation';

const EMPTY: Source = { id: '', kind: 'book', author: '', title: '', year: '', publisher: '', city: '', journal: '', pages: '', url: '' };

export default function CitationPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Source[]>([]);
  const [master, setMaster] = useState<Source[]>([]);
  const [pick, setPick] = useState('');
  const [src, setSrc] = useState<Source>(EMPTY);
  const [page, setPage] = useState('');
  const [style, setStyle] = useState<CiteStyle>('apa');
  const [msg, setMsg] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const show = () => {
    const l = docSources(editor.state.doc);
    setList(l);
    setStyle(docStyle(editor.state.doc));
    setPick('');
    setSrc(EMPTY);
    setPage('');
    setMsg('');
    setOpen(true);
    void api.getSettings().then((st) => setMaster(cleanMaster(st.citeSources)));
  };
  const saveMaster = (next: Source[]) => { setMaster(next); void api.setSettings({ citeSources: next }); };
  // Sursele din lista principală care nu sunt deja citate în document.
  const others = master.filter((m) => !list.some((s) => s.id === m.id || inMaster([m], s)));
  const choose = (id: string) => {
    setPick(id);
    setSrc(list.find((s) => s.id === id) ?? master.find((s) => s.id === id) ?? EMPTY);
    setMsg('');
  };
  const set = (k: keyof Source, v: string) => setSrc((s) => ({ ...s, [k]: v }));
  const ready = cleanSource({ ...src, id: src.id || 'x' });
  const insert = () => {
    const s = cleanSource({ ...src, id: src.id || Math.random().toString(36).slice(2, 10) });
    if (!s) { setMsg('Scrie cel puțin autorul sau titlul.'); return; }
    editor.chain().focus().insertCitation(s, page, style).run();
    // O sursă nouă intră și în lista principală (ca să poată fi citată și în alte documente).
    if (!inMaster(master, s)) saveMaster(addToMaster(master, s));
    setOpen(false);
  };
  const save = () => {
    const s = cleanSource(src);
    if (!s) return;
    editor.chain().updateSource(s).run();
    setList(docSources(editor.state.doc));
    if (inMaster(master, s)) saveMaster(addToMaster(master, s));
    setMsg('Am schimbat sursa la toate citările ei.');
  };
  const changeStyle = (st: CiteStyle) => {
    setStyle(st);
    editor.chain().setCiteStyle(st).run();
  };
  const field = (k: keyof Source, label: string, ph: string) => (
    <label>{label} <input value={src[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} aria-label={label}
      onKeyDown={(e) => { if (e.key === 'Enter' && ready) insert(); }} /></label>
  );

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => (open ? setOpen(false) : show())}
        title="Citare și bibliografie: pui sursa (carte, articol, pagină web) la cursor, în stilul APA, MLA sau ISO 690, iar bibliografia se face singură">❝ Citare</button>
      {open && (
        <div className="sym-pop sign-pop doc-cite-pop" role="dialog" aria-label="Citare">
          <div className="sym-head">Citare</div>
          <label>Stilul (pentru tot documentul)
            <select value={style} onChange={(e) => changeStyle(e.target.value as CiteStyle)} aria-label="Stilul citărilor">
              {CITE_STYLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label>Sursa
            <select value={pick} onChange={(e) => choose(e.target.value)} aria-label="Sursa">
              <option value="">— sursă nouă —</option>
              {list.length > 0 && <optgroup label="În document">{list.map((s) => <option key={s.id} value={s.id}>{refText(s, style).slice(0, 90)}</option>)}</optgroup>}
              {others.length > 0 && <optgroup label="Lista principală">{others.map((s) => <option key={s.id} value={s.id}>{refText(s, style).slice(0, 90)}</option>)}</optgroup>}
            </select>
          </label>
          <label>Fel
            <select value={src.kind} onChange={(e) => set('kind', e.target.value)} aria-label="Felul sursei">
              {SOURCE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {field('author', 'Autori', 'Popescu, Ion; Ionescu, Ana')}
          {field('title', 'Titlu', 'Titlul cărții, articolului sau paginii')}
          {field('year', 'Anul', '2024')}
          {src.kind === 'book' && field('publisher', 'Editura', 'Editura Polirom')}
          {src.kind === 'book' && field('city', 'Orașul', 'Iași')}
          {src.kind === 'article' && field('journal', 'Revista', 'Revista de Istorie')}
          {src.kind === 'article' && field('pages', 'Paginile', '12-30')}
          {src.kind !== 'book' && field('url', 'Adresa web', 'https://…')}
          <label>Pagina citată <input value={page} onChange={(e) => setPage(e.target.value)} placeholder="opțional, de ex. 45" aria-label="Pagina citată"
            onKeyDown={(e) => { if (e.key === 'Enter' && ready) insert(); }} /></label>
          {ready && <div className="doc-index-hint">În text: {citeText(ready, style, page)}<br />În bibliografie: {refText(ready, style)}</div>}
          {msg && <div className="doc-index-hint" role="status">{msg}</div>}
          <div className="sign-actions">
            <button onClick={() => { editor.chain().focus().insertBibliography(style).run(); setOpen(false); }}
              title="Lista surselor citate, în ordine alfabetică; se completează singură">☰ Inserează bibliografia</button>
            {pick && list.some((s) => s.id === pick) && <button onClick={save} disabled={!ready} title="Scrie schimbările sursei la toate citările ei din document">Salvează sursa</button>}
            {ready && !inMaster(master, ready) && <button onClick={() => { const s = cleanSource({ ...src, id: src.id || Math.random().toString(36).slice(2, 10) }); if (s) { saveMaster(addToMaster(master, s)); setMsg('Am pus sursa în lista principală.'); } }}
              title="Lista principală: sursele păstrate pentru toate documentele, de ales din „Sursa” și în alte documente">＋ În lista principală</button>}
            {pick && master.some((m) => m.id === pick) && <button onClick={() => { saveMaster(removeFromMaster(master, pick)); setMsg('Am scos sursa din lista principală (citările din document rămân).'); }}
              title="Scoate sursa din lista principală; citările din documente rămân">Scoate din lista principală</button>}
            <button className="primary" onClick={insert} disabled={!ready}>Inserează citarea</button>
          </div>
        </div>
      )}
    </div>
  );
}
