// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Scindare (Vizualizare › Fereastră › ⊟ Scindare), ca în Docs (docs/SplitPane.tsx): aceeași foaie în două părți ale ferestrei,
// fiecare derulată separat (și pe orizontală). Sus rămâne foaia adevărată; jos e o copie a ei, ținută la zi la fiecare schimbare
// (MutationObserver), ca să vezi de exemplu totalurile de la rândul 500 în timp ce scrii la rândul 3.
// Clic pe o celulă din copie deschide o casetă de scris chiar pe ea (Enter / Tab scriu și trec la vecina, Esc renunță), deci se scrie
// direct și în a doua parte; dublu clic = celula aceea se alege în foaia adevărată. Bara dintre ele se trage (20%–80%); dublu clic pe bară
// = Eliminare scindare.
// Cu dir = 'v' (⫴ Scindare stânga-dreapta) a doua parte stă în dreapta foii, ca vecin în rândul flex al .sheet-body.
// Cu dir = 'q' (⊞ Patru panouri, ca Split-ul din Excel cu ambele bare): foaia adevărată sus în stânga, trei copii în jurul ei.
// Panourile de sus se derulează împreună în jos și în sus, cele din stânga împreună spre stânga și dreapta (la fel jos / dreapta).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cellMove } from './PageLayout';

/** Rândul și coloana celulei de sub punctul dat dintr-o copie a foii (tr[data-r], prima celulă e capul rândului). */
export function cellOf(el: Element | null): { r: number; c: number } | null {
  const td = el?.closest('td');
  const tr = td?.parentElement;
  const r = Number(tr?.getAttribute('data-r'));
  if (!td || !tr || !Number.isInteger(r) || tr.getAttribute('data-r') === null) return null;
  const c = Array.prototype.indexOf.call(tr.children, td) - 1;
  return c >= 0 ? { r, c } : null;
}

/** Numele celulei (A1) din rândul și coloana de la 0. */
const nameOf = (r: number, c: number) => { let s = ''; for (let k = c + 1; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s; return s + (r + 1); };

/** Copiile: 0 = a doua parte (h / v) sau dreapta sus (q), 1 = dreapta jos (q), 2 = stânga jos (q). */
type View = 0 | 1 | 2;

export default function SheetSplit({ gridRef, ratio, setRatio, ratioX = 0.5, setRatioX, onPick, onClose, onView, rowPx, dir = 'h', textOf, onWrite }: {
  /** 'h' = sus / jos (implicit), 'v' = stânga / dreapta, 'q' = patru panouri. */
  dir?: 'h' | 'v' | 'q';
  gridRef: React.RefObject<HTMLDivElement | null>; ratio: number; setRatio(r: number): void; onPick(r: number, c: number): void; onClose(): void;
  /** La patru panouri: partea din lățime a foii adevărate (ratio e partea din înălțime). */
  ratioX?: number; setRatioX?(r: number): void;
  /** Unde e derulată partea de jos: foaia desenează și rândurile de acolo (altfel copia ar avea doar rândurile de sus). */
  onView(v: { top: number; h: number }): void; rowPx: number;
  /** Textul de editat al celulei (formula, data ca dată). */
  textOf?(id: string): string;
  /** Scrie în celulă; false = nu s-a putut (foaie protejată, validare). */
  onWrite?(id: string, text: string): boolean;
}) {
  const quad = dir === 'q';
  const boxRef = useRef<HTMLDivElement>(null);
  const boxBLRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const viewBRRef = useRef<HTMLDivElement>(null);
  const viewBLRef = useRef<HTMLDivElement>(null);
  const viewEl = (k: View) => (k === 0 ? viewRef : k === 1 ? viewBRRef : viewBLRef).current;
  const boxOf = (k: View) => (k === 2 ? boxBLRef : boxRef).current;
  const [rect, setRect] = useState({ left: 0, width: 0 });
  // Caseta de scris deschisă pe o celulă a unei copii: copia, locul casetei (față de panoul ei), celula și textul.
  const [ed, setEd] = useState<{ k: View; r: number; c: number; x: number; y: number; w: number; h: number; text: string } | null>(null);
  const edRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ed) edRef.current?.focus(); }, [ed?.r, ed?.c, ed?.k]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Deschide caseta pe celula (r, c) a copiei k, dacă e desenată acolo. */
  const openAt = (k: View, r: number, c: number) => {
    const td = viewEl(k)?.querySelector('tr[data-r="' + r + '"]')?.children[c + 1] as HTMLElement | undefined;
    const box = boxOf(k);
    if (!td || !box || td.tagName !== 'TD') { setEd(null); return; }
    const a = td.getBoundingClientRect(), b = box.getBoundingClientRect();
    setEd({ k, r, c, x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height, text: textOf?.(nameOf(r, c)) ?? '' });
  };
  const save = (x: { r: number; c: number; text: string }) => { const id = nameOf(x.r, x.c); if ((textOf?.(id) ?? '') !== x.text) onWrite?.(id, x.text); };
  const next = (dr: number, dc: number) => {
    if (!ed) return;
    save(ed);
    const to = cellMove(nameOf(ed.r, ed.c), dr, dc);
    if (!to) { setEd(null); return; }
    const k = ed.k, r = ed.r + dr, c = ed.c + dc;
    // Copia se reface puțin după scriere; caseta se mută pe vecina din copia nouă.
    setEd(null);
    window.setTimeout(() => openAt(k, r, c), 260);
  };
  const last = useRef({ top: -1e9, h: 0 });
  const report = (el: HTMLElement) => {
    if (Math.abs(el.scrollTop - last.current.top) < rowPx * 3 && el.clientHeight === last.current.h) return;
    last.current = { top: el.scrollTop, h: el.clientHeight };
    onView(last.current);
  };

  // Panoul de jos stă exact sub foaie (panourile laterale rămân pe loc).
  useLayoutEffect(() => {
    const wrap = gridRef.current;
    if (!wrap || dir === 'v') return;
    const measure = () => setRect({ left: wrap.offsetLeft, width: wrap.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    if (wrap.parentElement) ro.observe(wrap.parentElement);
    return () => ro.disconnect();
  }, [gridRef, dir]);

  // Copiile foii: la pornire și după fiecare schimbare (cu o mică întârziere, ca scrisul să nu încetinească).
  useEffect(() => {
    const wrap = gridRef.current;
    const views = (quad ? [0, 1, 2] : [0]).map((k) => viewEl(k as View));
    if (!wrap || views.some((v) => !v)) return;
    const copyOf = (k: View) => viewEl(k)?.firstElementChild as HTMLElement | null | undefined;
    // Patru panouri: la derularea unui panou, vecinii lui se mută la fel pe direcția comună (sus = foaia + dreapta sus,
    // jos = stânga jos + dreapta jos; stânga = foaia + stânga jos, dreapta = dreapta sus + dreapta jos).
    const follow = (k: View, el: HTMLElement) => {
      if (!quad) return;
      const tr = copyOf(0), br = copyOf(1), bl = copyOf(2);
      if (k === 0) { wrap.scrollTop = el.scrollTop; if (br) br.scrollLeft = el.scrollLeft; }
      if (k === 1) { if (bl) bl.scrollTop = el.scrollTop; if (tr) tr.scrollLeft = el.scrollLeft; }
      if (k === 2) { wrap.scrollLeft = el.scrollLeft; if (br) br.scrollTop = el.scrollTop; }
    };
    let timer = 0, first = true;
    const copy = () => {
      timer = 0;
      const pos = views.map((v) => {
        const old = v!.firstElementChild as HTMLElement | null;
        // La pornire copiile arată locul foii; după aceea fiecare își păstrează derularea.
        return first || !old ? { top: wrap.scrollTop, left: wrap.scrollLeft } : { top: old.scrollTop, left: old.scrollLeft };
      });
      first = false;
      views.forEach((v, i) => {
        const k = i as View;
        const c = wrap.cloneNode(true) as HTMLElement;
        c.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
        c.querySelectorAll('input, textarea, [contenteditable]').forEach((e) => { e.setAttribute('tabindex', '-1'); if (e.hasAttribute('contenteditable')) e.setAttribute('contenteditable', 'false'); });
        c.removeAttribute('tabindex');
        c.classList.add('sh-split-copy');
        // Mărimea foii de sus (înălțimea sau lățimea ei din scindare) nu se ia în copie: copia umple partea ei.
        c.style.height = ''; c.style.width = ''; c.style.flex = '';
        c.setAttribute('aria-hidden', 'true');
        v!.replaceChildren(c);
        // Dreapta sus stă mereu la înălțimea foii adevărate, stânga jos la poziția ei pe orizontală.
        c.scrollTop = quad && k === 0 ? wrap.scrollTop : pos[i].top;
        c.scrollLeft = quad && k === 2 ? wrap.scrollLeft : pos[i].left;
        // Copia care arată alte rânduri decât foaia spune foii unde e (h / v: singura copie; q: stânga jos).
        const reports = !quad || k === 2;
        c.addEventListener('scroll', () => { if (reports) report(c); follow(k, c); setEd(null); });
        if (reports) report(c);
      });
    };
    copy();
    const mo = new MutationObserver(() => { if (!timer) timer = window.setTimeout(copy, 200); });
    mo.observe(wrap, { subtree: true, childList: true, characterData: true, attributes: true });
    const onWrapScroll = () => {
      if (!quad) return;
      const tr = copyOf(0), bl = copyOf(2);
      if (tr) tr.scrollTop = wrap.scrollTop;
      if (bl) bl.scrollLeft = wrap.scrollLeft;
    };
    wrap.addEventListener('scroll', onWrapScroll);
    return () => { mo.disconnect(); wrap.removeEventListener('scroll', onWrapScroll); if (timer) clearTimeout(timer); };
  }, [gridRef, quad]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Trage o bară: 'x' = bara verticală (lățimea foii), 'y' = bara orizontală (înălțimea ei). */
  const dragBar = (axis: 'x' | 'y') => (e: React.MouseEvent) => {
    e.preventDefault();
    const body = boxRef.current?.parentElement, wrap = gridRef.current, box = boxRef.current;
    if (!body || !wrap || !box) return;
    const r = body.getBoundingClientRect();
    // Stânga / dreapta: partea foii din rândul flex = de la marginea stângă a foii până la marginea dreaptă a copiei.
    const x0 = wrap.getBoundingClientRect().left, xw = box.getBoundingClientRect().right - x0;
    const clamp = (v: number) => Math.min(0.8, Math.max(0.2, v));
    const move = (ev: MouseEvent) => {
      if (axis === 'y') setRatio(clamp((ev.clientY - r.top) / r.height));
      else (quad ? setRatioX ?? setRatio : setRatio)(clamp((ev.clientX - x0) / xw));
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const pickHere = (e: React.MouseEvent) => {
    const at = cellOf(e.target as Element);
    if (at) onPick(at.r, at.c);
  };
  const editHere = (k: View) => (e: React.MouseEvent) => {
    if (!onWrite) return;
    const at = cellOf(e.target as Element);
    if (ed) save(ed);
    if (at) openAt(k, at.r, at.c); else setEd(null);
  };
  const editor = (inBL: boolean) => ed && (ed.k === 2) === inBL && (
    <div className="sh-layout-edit" style={{ left: ed.x, top: ed.y }}>
      <span className="sh-layout-cellname">{nameOf(ed.r, ed.c)}</span>
      <input ref={edRef} className="sh-layout-cell sh-split-cell" aria-label={'Celula ' + nameOf(ed.r, ed.c)} value={ed.text}
        style={{ width: Math.max(60, ed.w), height: Math.max(18, ed.h) }}
        title="Enter scrie și coboară, Tab trece la dreapta, Esc renunță; dublu clic = alegi celula în foaie"
        onChange={(e) => setEd({ ...ed, text: e.target.value })}
        onDoubleClick={() => { save(ed); setEd(null); onPick(ed.r, ed.c); }}
        onBlur={() => { save(ed); setEd(null); }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); next(e.shiftKey ? -1 : 1, 0); }
          else if (e.key === 'Tab') { e.preventDefault(); next(0, e.shiftKey ? -1 : 1); }
          else if (e.key === 'Escape') { e.preventDefault(); setEd(null); }
        }} />
    </div>
  );
  const barTitle = 'Trage ca să schimbi cât ocupă fiecare parte; dublu clic = Eliminare scindare';
  const hBar = <div className="doc-split-bar" role="separator" aria-orientation="horizontal" onMouseDown={dragBar('y')} onDoubleClick={onClose} title={barTitle} />;
  const vBar = <div className="doc-split-bar" role="separator" aria-orientation="vertical" onMouseDown={dragBar('x')} onDoubleClick={onClose} title={barTitle} />;

  if (quad) return (
    <>
      <div ref={boxRef} className="sh-split-pane sh-split-v sh-split-q" style={{ flex: `${1 - ratioX} 1 0` }}>
        {vBar}
        <div className="sh-split-col">
          <div ref={viewRef} className="sh-split-view" style={{ flex: `0 0 ${ratio * 100}%` }} onClick={editHere(0)} onDoubleClick={pickHere}
            title="Dreapta sus: aceleași rânduri ca foaia din stânga, alte coloane; clic pe o celulă = scrii în ea aici, dublu clic = o alegi în foaie" />
          {hBar}
          <div ref={viewBRRef} className="sh-split-view" onClick={editHere(1)} onDoubleClick={pickHere}
            title="Dreapta jos: rândurile din stânga jos și coloanele din dreapta sus; clic pe o celulă = scrii în ea aici, dublu clic = o alegi în foaie" />
        </div>
        {editor(false)}
      </div>
      <div ref={boxBLRef} className="doc-split-pane sh-split-pane" style={{ left: rect.left, width: rect.width, top: `${ratio * 100}%` }}>
        {hBar}
        <div ref={viewBLRef} className="sh-split-view" onClick={editHere(2)} onDoubleClick={pickHere}
          title="Stânga jos: aceleași coloane ca foaia de sus, alte rânduri; clic pe o celulă = scrii în ea aici, dublu clic = o alegi sus" />
        {editor(true)}
      </div>
    </>
  );
  if (dir === 'v') return (
    <div ref={boxRef} className="sh-split-pane sh-split-v" style={{ flex: `${1 - ratio} 1 0` }}>
      {vBar}
      <div ref={viewRef} className="sh-split-view" onClick={editHere(0)} onDoubleClick={pickHere}
        title="A doua parte a foii: se derulează separat și arată imediat ce scrii în stânga; clic pe o celulă = scrii în ea aici, dublu clic = o alegi în stânga" />
      {editor(false)}
    </div>
  );
  return (
    <div ref={boxRef} className="doc-split-pane sh-split-pane" style={{ left: rect.left, width: rect.width, top: `${ratio * 100}%` }}>
      {hBar}
      <div ref={viewRef} className="sh-split-view" onClick={editHere(0)} onDoubleClick={pickHere}
        title="A doua parte a foii: se derulează separat și arată imediat ce scrii sus; clic pe o celulă = scrii în ea aici, dublu clic = o alegi sus" />
      {editor(false)}
    </div>
  );
}
