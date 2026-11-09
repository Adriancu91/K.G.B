// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Vizualizare → Aspect pagină: foaia așezată pe paginile de hârtie, una sub alta, exact cum ies la tipărire
// (același PDF ca la Tipărire / Export PDF, cu antetul, subsolul și numerele paginilor). Deasupra se schimbă direct
// antetul, subsolul, numerotarea, orientarea, hârtia și marginile; paginile se refac singure. Clic pe o celulă din pagină
// deschide o casetă de scris chiar pe ea (Enter scrie și coboară, Tab trece la dreapta, Esc renunță); dublu clic pe margine = Normal.
// Celulele se recunosc după legăturile invizibile puse în PDF-ul vederii (CELL_LINK + „A1”), citite cu getAnnotations.
// pdf.js (Apache-2.0) se încarcă doar când se deschide vederea.
import { useEffect, useRef, useState } from 'react';
import { HF_FIELDS, MARGIN_NAMES, PAPERS, type PrintMargin, type PrintPaper, type SheetPrint } from './print';

type PdfDoc = { numPages: number; getPage(n: number): Promise<any>; destroy(): Promise<void> }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Câte pagini se desenează cel mult (memoria laptopului); restul se văd la Tipărire / Export PDF. */
export const LAYOUT_MAX_PAGES = 40;
/** Începutul adresei legăturilor invizibile ale celulelor în PDF-ul din Aspect pagină (domeniul .invalid nu există nicăieri). */
export const CELL_LINK = 'https://cell.invalid/';

/** Locul unei celule pe pagina desenată, în pixeli de ecran (față de colțul paginii). */
export interface CellBox { id: string; x: number; y: number; w: number; h: number }
/** Celula de sub punctul (x, y); la celulele îmbinate sau suprapuse câștigă cea mai mică. */
export function cellAt(boxes: CellBox[], x: number, y: number): CellBox | null {
  let best: CellBox | null = null;
  for (const b of boxes) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h && (!best || b.w * b.h < best.w * best.h)) best = b;
  return best;
}
/** Celula vecină: „B3” mutat cu dr rânduri și dc coloane (null dacă iese din foaie). */
export function cellMove(id: string, dr: number, dc: number): string | null {
  const m = /^([A-Z]+)([0-9]+)$/.exec(id);
  if (!m) return null;
  const col = m[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) + dc, row = Number(m[2]) + dr;
  if (col < 1 || row < 1) return null;
  let name = '';
  for (let k = col; k > 0; k = Math.floor((k - 1) / 26)) name = String.fromCharCode(65 + ((k - 1) % 26)) + name;
  return name + row;
}

export default function PageLayout({ data, busy, error, set, onChange, onNormal, textOf, onWrite }: {
  data: Uint8Array | null; busy: boolean; error: string;
  set: Required<Omit<SheetPrint, 'area' | 'breaks' | 'colBreaks'>>;
  onChange(patch: Partial<SheetPrint>): void; onNormal(): void;
  /** Textul de editat al celulei (formula, data ca dată). */
  textOf?(id: string): string;
  /** Scrie în celulă; false = nu s-a putut (foaie protejată, validare). */
  onWrite?(id: string, text: string): boolean;
}) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [fail, setFail] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const [head, setHead] = useState(set.header ?? '');
  const [foot, setFoot] = useState(set.footer ?? '');
  useEffect(() => setHead(set.header ?? ''), [set.header]);
  useEffect(() => setFoot(set.footer ?? ''), [set.footer]);
  // Celulele fiecărei pagini (după indicele paginii) și caseta de scris deschisă pe una dintre ele.
  const boxes = useRef<CellBox[][]>([]);
  const [ed, setEd] = useState<{ page: number; box: CellBox; text: string } | null>(null);
  const edRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ed) edRef.current?.focus(); }, [ed?.box.id, ed?.page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data) return;
    let alive = true, loaded: PdfDoc | null = null;
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      loaded = (await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise) as unknown as PdfDoc;
      if (alive) { setDoc(loaded); setFail(''); } else void loaded.destroy();
    })().catch(() => { if (alive) setFail('Paginile nu au putut fi pregătite.'); });
    return () => { alive = false; if (loaded) void loaded.destroy(); };
  }, [data]);

  // Paginile, una sub alta, cu lățimea zonei (cel mult mărimea reală a hârtiei), la rezoluția ecranului.
  useEffect(() => {
    const box = boxRef.current;
    if (!doc || !box) return;
    let alive = true;
    (async () => {
      const out: HTMLElement[] = [];
      const found: CellBox[][] = [];
      const n = Math.min(doc.numPages, LAYOUT_MAX_PAGES);
      for (let p = 1; p <= n; p++) {
        const pg = await doc.getPage(p);
        const v1 = pg.getViewport({ scale: 1 });
        const fit = Math.min(96 / 72, (box.clientWidth - 48) / v1.width);
        const dpr = window.devicePixelRatio || 1;
        const v = pg.getViewport({ scale: Math.max(0.1, fit) * dpr });
        const c = document.createElement('canvas');
        c.width = Math.round(v.width); c.height = Math.round(v.height);
        c.style.width = `${Math.round(v.width / dpr)}px`; c.style.height = `${Math.round(v.height / dpr)}px`;
        c.className = 'sh-layout-page';
        c.setAttribute('aria-label', `Pagina ${p}`);
        c.title = 'Clic pe o celulă: scrii în ea direct pe pagină. Dublu clic pe margine: înapoi la Normal';
        c.dataset.page = String(p - 1);
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise;
        // Zonele de legătură ale celulelor, aduse la pixelii de ecran ai paginii.
        const vc = pg.getViewport({ scale: Math.max(0.1, fit) });
        const list: CellBox[] = [];
        for (const a of await pg.getAnnotations({ intent: 'display' }).catch(() => [])) {
          const url = typeof a?.url === 'string' ? a.url : '';
          if (a?.subtype !== 'Link' || !url.startsWith(CELL_LINK) || !Array.isArray(a.rect)) continue;
          const [x0, y0, x1, y1] = vc.convertToViewportRectangle(a.rect) as number[];
          list.push({ id: url.slice(CELL_LINK.length).toUpperCase(), x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });
        }
        found.push(list);
        c.dataset.cells = String(list.length);
        if (!alive) return;
        const wrap = document.createElement('div');
        wrap.className = 'sh-layout-pagebox';
        wrap.appendChild(c);
        out.push(wrap);
      }
      if (doc.numPages > n) {
        const more = document.createElement('p');
        more.className = 'sh-layout-more';
        more.textContent = `Încă ${doc.numPages - n} pagini: le vezi toate la Tipărire sau Export PDF.`;
        out.push(more);
      }
      if (!alive) return;
      boxes.current = found;
      box.replaceChildren(...out);
      // Caseta deschisă rămâne pe aceeași celulă după ce paginile se refac (de exemplu după ce ai scris în ea).
      setEd((e) => { const b = e && found[e.page]?.find((x) => x.id === e.box.id); return e && b ? { ...e, box: b } : null; });
    })().catch(() => { if (alive) setFail('Pagina nu a putut fi desenată.'); });
    return () => { alive = false; };
  }, [doc]);

  const commit = (k: 'header' | 'footer', v: string) => { if ((set[k] ?? '') !== v) onChange({ [k]: v }); };
  const field = (k: 'header' | 'footer', v: string, setV: (s: string) => void, label: string) => (
    <label className="sh-layout-hf">{label}
      <input value={v} aria-label={label} placeholder="(gol)" list="sh-layout-fields"
        onChange={(e) => setV(e.target.value)} onBlur={() => commit(k, v)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(k, v); } else if (e.key === 'Escape') { e.preventDefault(); setV(set[k] ?? ''); } }} />
    </label>
  );
  const n = doc?.numPages ?? 0;
  const save = (x: { box: CellBox; text: string }) => { if ((textOf?.(x.box.id) ?? '') !== x.text) onWrite?.(x.box.id, x.text); };
  // Clic pe pagină: caseta de scris pe celula de sub mouse (ce era scris în caseta de dinainte intră în celula ei).
  const pick = (e: React.MouseEvent) => {
    const c = e.target as HTMLElement;
    if (c.tagName !== 'CANVAS' || !onWrite) return;
    const page = Number(c.dataset.page), r = c.getBoundingClientRect();
    const b = cellAt(boxes.current[page] ?? [], e.clientX - r.left, e.clientY - r.top);
    if (ed) save(ed);
    setEd(b ? { page, box: b, text: textOf?.(b.id) ?? '' } : null);
  };
  // Enter / Tab (cu Shift înapoi): scrie și trece la celula vecină de pe aceeași pagină, dacă e acolo.
  const next = (dr: number, dc: number) => {
    if (!ed) return;
    save(ed);
    const id = cellMove(ed.box.id, dr, dc);
    const to = id ? (boxes.current[ed.page] ?? []).find((b) => b.id === id) : undefined;
    setEd(to ? { page: ed.page, box: to, text: textOf?.(to.id) ?? '' } : null);
  };
  const edCanvas = ed ? boxRef.current?.querySelector<HTMLCanvasElement>('canvas[data-page="' + ed.page + '"]') : null;
  const edPos = ed && edCanvas && scrollRef.current ? (() => {
    const bx = scrollRef.current!, cr = edCanvas.getBoundingClientRect(), br = bx.getBoundingClientRect();
    return { left: cr.left - br.left + bx.scrollLeft + ed.box.x, top: cr.top - br.top + bx.scrollTop + ed.box.y };
  })() : null;

  return (
    <div className="sh-layout" role="region" aria-label="Aspect pagină" onKeyDown={(e) => { if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); onNormal(); } }}>
      <div className="sh-layout-bar">
        <b>📃 Aspect pagină</b>
        {field('header', head, setHead, 'Antet:')}
        {field('footer', foot, setFoot, 'Subsol:')}
        <datalist id="sh-layout-fields">{HF_FIELDS.map((f) => <option key={f} value={f} />)}</datalist>
        <label className="rb-check" title="„Pagina 1 din 3” jos, la mijloc"><input type="checkbox" aria-label="Numerotează paginile" checked={!!set.numbers} onChange={() => onChange({ numbers: !set.numbers })} /> Numerotează paginile</label>
        <select aria-label="Orientare" value={set.landscape ? 'l' : 'p'} onChange={(e) => onChange({ landscape: e.target.value === 'l' })}>
          <option value="p">Portret</option>
          <option value="l">Peisaj</option>
        </select>
        <select aria-label="Hârtie" value={set.paper} onChange={(e) => onChange({ paper: e.target.value as PrintPaper })}>
          {(Object.keys(PAPERS) as PrintPaper[]).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Margini" value={set.margin} onChange={(e) => onChange({ margin: e.target.value as PrintMargin })}>
          {(Object.keys(MARGIN_NAMES) as PrintMargin[]).map((m) => <option key={m} value={m}>{MARGIN_NAMES[m]}</option>)}
        </select>
        <label className="rb-check" title="Micșorează tabelul ca să încapă pe lățimea paginii"><input type="checkbox" aria-label="Potrivește pe lățime" checked={!!set.fit} onChange={() => onChange({ fit: !set.fit })} /> Potrivește pe lățime</label>
        <span className="sh-layout-count" aria-live="polite">{busy ? 'Se refac paginile…' : n ? `${n} ${n === 1 ? 'pagină' : 'pagini'}` : ''}</span>
        <button onClick={onNormal} title="Înapoi la foaia obișnuită (Esc)">▦ Normal</button>
      </div>
      {(error || fail) && <p className="print-info sheet-err-help">{error || fail}</p>}
      <div className="sh-layout-pages" ref={scrollRef} onClick={pick} onDoubleClick={(e) => {
        const c = e.target as HTMLElement;
        if (c.tagName !== 'CANVAS') return;
        const r = c.getBoundingClientRect();
        if (!onWrite || !cellAt(boxes.current[Number(c.dataset.page)] ?? [], e.clientX - r.left, e.clientY - r.top)) onNormal();
      }}>
        <div className="sh-layout-stack" ref={boxRef} />
        {ed && edPos && (
          <div className="sh-layout-edit" style={{ left: edPos.left, top: edPos.top }}>
            <span className="sh-layout-cellname">{ed.box.id}</span>
            <input ref={edRef} className="sh-layout-cell" aria-label={'Celula ' + ed.box.id} value={ed.text}
              style={{ width: Math.max(60, ed.box.w), height: Math.max(18, ed.box.h) }}
              onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
              onChange={(e) => setEd({ ...ed, text: e.target.value })}
              onBlur={(e) => { const to = e.relatedTarget as HTMLElement | null; if (!to?.closest?.('.sh-layout-pages')) { save(ed); setEd(null); } }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); next(e.shiftKey ? -1 : 1, 0); }
                else if (e.key === 'Tab') { e.preventDefault(); next(0, e.shiftKey ? -1 : 1); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEd(null); }
              }} />
          </div>
        )}
      </div>
    </div>
  );
}
