// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Previzualizare înaintea imprimării (Ctrl+F2): paginile documentului exact cum ies la tipărire și în PDF
// (același PDF făcut de aplicație, cu antet, subsol și numere), câte una, două alăturate sau toate ca într-o grilă („Mai multe
// pagini” din Zoom; clic pe o pagină duce cursorul la ea în document). De aici: Tipărește sau Export PDF.
// pdf.js (Apache-2.0) se încarcă doar când se deschide fereastra.
import { useEffect, useRef, useState } from 'react';

type PdfDoc = { numPages: number; getPage(n: number): Promise<any>; loadingTask: { destroy(): Promise<void> } }; // eslint-disable-line @typescript-eslint/no-explicit-any

type Mode = 'one' | 'two' | 'many';
/** Câte pagini pe rând în grila „Mai multe pagini”. */
const PER_ROW = [2, 3, 4, 6];

export default function PrintPreview({ data, onPrint, onPdf, onClose, startMany, onPick }: {
  data: Uint8Array; onPrint(): void; onPdf(): void; onClose(): void;
  /** Deschide direct grila cu toate paginile. */
  startMany?: boolean;
  /** Clic pe o pagină din grilă: documentul se duce la ea (fereastra se închide). */
  onPick?(page: number): void;
}) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState('');
  const [at, setAt] = useState(1);
  const [mode, setMode] = useState<Mode>(startMany ? 'many' : 'one');
  const [perRow, setPerRow] = useState(4);
  const two = mode === 'two';
  const boxRef = useRef<HTMLDivElement>(null);
  const dlgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true, loaded: PdfDoc | null = null;
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      loaded = (await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise) as unknown as PdfDoc;
      if (alive) setDoc(loaded); else void loaded.loadingTask.destroy();
    })().catch(() => { if (alive) setError('Paginile nu au putut fi pregătite.'); });
    return () => { alive = false; if (loaded) void loaded.loadingTask.destroy(); };
  }, [data]);
  useEffect(() => { dlgRef.current?.focus(); }, []);

  const n = doc?.numPages ?? 0;
  const step = two ? 2 : 1;
  // Cu două pagini, prima din pereche e impară (1–2, 3–4…).
  const first = two ? at - ((at - 1) % 2) : at;
  const go = (p: number) => setAt(Math.max(1, Math.min(n || 1, p)));

  // Paginile se desenează cât încap în fereastră (înălțimea zonei), la rezoluția ecranului.
  useEffect(() => {
    const box = boxRef.current;
    if (!doc || !box || mode === 'many') return;
    let alive = true;
    (async () => {
      const pages = [first, first + 1].filter((p, i) => p <= doc.numPages && (two || i === 0));
      const canvases: HTMLCanvasElement[] = [];
      for (const p of pages) {
        const pg = await doc.getPage(p);
        const v1 = pg.getViewport({ scale: 1 });
        const fit = Math.min((box.clientHeight - 16) / v1.height, (box.clientWidth / pages.length - 24) / v1.width);
        const dpr = window.devicePixelRatio || 1;
        const v = pg.getViewport({ scale: Math.max(0.1, fit) * dpr });
        const c = document.createElement('canvas');
        c.width = Math.round(v.width); c.height = Math.round(v.height);
        c.style.width = `${Math.round(v.width / dpr)}px`; c.style.height = `${Math.round(v.height / dpr)}px`;
        c.className = 'pp-page';
        c.setAttribute('aria-label', `Pagina ${p}`);
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        // Ca la tipar: fără așteptarea cadrelor de animație (care se opresc când fereastra e ascunsă).
        await pg.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise;
        canvases.push(c);
      }
      if (alive) box.replaceChildren(...canvases);
    })().catch(() => { if (alive) setError('Pagina nu a putut fi desenată.'); });
    return () => { alive = false; };
  }, [doc, first, two, mode]);

  // Grila: toate paginile, mici, desenate una după alta (cele de sus apar primele); fiecare e un buton.
  useEffect(() => {
    const box = boxRef.current;
    if (!doc || !box || mode !== 'many') return;
    let alive = true;
    box.replaceChildren();
    (async () => {
      const dpr = window.devicePixelRatio || 1;
      // Loc pentru marginea grilei, golurile dintre pagini, rama fiecărei pagini și bara de derulare care apare după.
      const cellW = Math.max(80, Math.floor((box.clientWidth - 24 - (perRow - 1) * 16 - perRow * 4 - 18) / perRow));
      for (let p = 1; p <= doc.numPages && alive; p++) {
        const pg = await doc.getPage(p);
        const v1 = pg.getViewport({ scale: 1 });
        const v = pg.getViewport({ scale: (cellW / v1.width) * dpr });
        const c = document.createElement('canvas');
        c.width = Math.round(v.width); c.height = Math.round(v.height);
        c.style.width = `${Math.round(v.width / dpr)}px`; c.style.height = `${Math.round(v.height / dpr)}px`;
        c.className = 'pp-page';
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise;
        if (!alive) break;
        const b = document.createElement('button');
        b.className = 'pp-thumb';
        b.dataset.page = String(p);
        b.title = onPick ? `Pagina ${p}: clic ca să mergi la ea în document` : `Pagina ${p}: clic ca s-o vezi mare`;
        b.setAttribute('aria-label', `Pagina ${p}`);
        const cap = document.createElement('span');
        cap.textContent = String(p);
        b.append(c, cap);
        b.onclick = () => { if (onPick) onPick(p); else { setAt(p); setMode('one'); } };
        box.append(b);
      }
    })().catch(() => { if (alive) setError('Paginile nu au putut fi desenate.'); });
    return () => { alive = false; };
  }, [doc, mode, perRow, onPick]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (mode === 'many') return;
    else if (e.key === 'PageDown' || e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(first + step); }
    else if (e.key === 'PageUp' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(first - step); }
    else if (e.key === 'Home') { e.preventDefault(); go(1); }
    else if (e.key === 'End') { e.preventDefault(); go(n); }
  };
  const shown = two && first + 1 <= n ? `${first}–${first + 1}` : String(first);

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg pp-dlg" role="dialog" aria-label="Previzualizare înaintea imprimării" tabIndex={-1} ref={dlgRef} onKeyDown={onKey}>
        <div className="pp-bar">
          <h3>Previzualizare înaintea imprimării</h3>
          {mode !== 'many' ? <>
            <button onClick={() => go(first - step)} disabled={first <= 1} title="Pagina anterioară (PageUp)" aria-label="Pagina anterioară">‹</button>
            <span className="pp-count">{n ? `Pagina ${shown} din ${n}` : 'Se pregătesc paginile…'}</span>
            <button onClick={() => go(first + step)} disabled={!n || first + step > n} title="Pagina următoare (PageDown)" aria-label="Pagina următoare">›</button>
          </> : <>
            <span className="pp-count">{n ? `${n} pagini` : 'Se pregătesc paginile…'}</span>
            <label title="Câte pagini se văd pe un rând">Pe rând <select value={perRow} onChange={(e) => setPerRow(Number(e.target.value))}>
              {PER_ROW.map((k) => <option key={k} value={k}>{k}</option>)}
            </select></label>
          </>}
          <button className={mode === 'one' ? 'active' : ''} onClick={() => setMode('one')} title="O pagină">▯ O pagină</button>
          <button className={two ? 'active' : ''} onClick={() => setMode('two')} title="Două pagini alăturate, ca într-o carte deschisă">▯▯ Două pagini</button>
          <button className={mode === 'many' ? 'active' : ''} onClick={() => setMode('many')} title="Toate paginile, mici, una lângă alta">▦ Mai multe pagini</button>
        </div>
        <div className={mode === 'many' ? 'pp-pages pp-grid' : 'pp-pages'} ref={boxRef} />
        {error && <p className="print-info sheet-err-help">{error}</p>}
        <div className="print-actions">
          <button onClick={onPrint} title="Ctrl+P">🖨 Tipărește…</button>
          <button onClick={onPdf}>Export PDF</button>
          <button onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}
