// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Stratul de sub câmpul de scris al notiței: același text, desenat cu formatarea lui (vezi live.ts). Câmpul de deasupra are
// literele transparente și doar cursorul / selecția, așa că scrii ca înainte, dar vezi aldinul, cursivul, culorile, mărimile
// și fonturile pe loc, iar ecuațiile desenate.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { equationSvg } from '../docs/equation';
import { liveLines, type LivePart } from './live';

const NL = String.fromCharCode(10);
const ZW = String.fromCharCode(8203); // ține ultimul rând gol la înălțimea lui, ca în câmpul de scris
const HIGHLIGHT = '#fff176';
const COPY = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'wordSpacing', 'tabSize', 'textIndent',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;

const upright = new Map<string, Promise<string | null>>();
const SAMPLE = 'Așa scriu cursiv: WMil 0123 ăîșțâ';
/**
 * Cursivul se poate arăta doar dacă nu schimbă lățimea literelor. Fontul fără formă cursivă (cum e cel implicit) e doar înclinat,
 * deci merge direct; altfel fontul notiței e încărcat a doua oară, numai cu forma dreaptă, iar cursivul lui e făcut prin înclinare.
 * Dacă măsurătoarea arată altă lățime, cursivul nu se arată (semnele lui rămân estompate).
 */
function italicFamily(stack: string): Promise<string | null> {
  let p = upright.get(stack);
  if (!p) {
    p = (async () => {
      try {
        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) return null;
        const w = (font: string) => { ctx.font = font; return ctx.measureText(SAMPLE).width; };
        const plain = w(`16px ${stack}`);
        if (Math.abs(w(`italic 16px ${stack}`) - plain) < 0.01) return stack;
        const first = stack.split(',')[0].trim().replace(/^["']|["']$/g, '').replace(/["\\]/g, '');
        if (!first || /^(system-ui|sans-serif|serif|monospace|cursive|inherit)$/i.test(first)) return null;
        const alias = 'SuiteDrept ' + first;
        const st = document.createElement('style');
        st.textContent = `@font-face { font-family: "${alias}"; src: local("${first}"); font-style: normal; font-weight: 400; }`;
        document.head.appendChild(st);
        await document.fonts.load(`16px "${alias}"`);
        if (!document.fonts.check(`16px "${alias}"`)) return null;
        const same = w(`16px "${alias}", ${stack}`), slant = w(`italic 16px "${alias}", ${stack}`);
        return Math.abs(plain - same) < 0.01 && Math.abs(plain - slant) < 0.01 ? `"${alias}", ${stack}` : null;
      } catch { return null; }
    })();
    upright.set(stack, p);
  }
  return p;
}

/** Mărimea pe text arătată ca înălțime a literelor, între limite, ca să nu acopere prea mult rândurile vecine. */
export const fitHeight = (em?: number) => (em ? Math.min(1.6, Math.max(0.7, em)) : 1);

/**
 * Textul cu mărime sau font: fiecare cuvânt își ține locul cu literele fontului notiței (transparente, deci nimic nu se mută),
 * iar peste el se desenează același cuvânt în fontul lui și cu înălțimea mărimii, strâns sau lărgit cât să încapă exact în loc.
 */
function fitWords(p: LivePart, st: CSSProperties | undefined, key: number) {
  const hold: CSSProperties = { ...st, WebkitTextFillColor: 'transparent' };
  if (p.b) hold.WebkitTextStroke = '0.035em transparent';
  const draw: CSSProperties = { WebkitTextFillColor: 'currentColor' };
  if (p.f) draw.fontFamily = p.f;
  if (p.b) draw.WebkitTextStroke = '0.035em currentColor';
  const sy = fitHeight(p.sz);
  return (
    <Fragment key={key}>
      {p.s.split(/(\s+)/).filter(Boolean).map((w, k) => /^\s/.test(w)
        ? <span key={k} style={st}>{w}</span>
        : <span key={k} className="fit" style={hold} data-sy={sy}>{w}<span className="fit-in" style={draw} data-t={w} /></span>)}
    </Fragment>
  );
}

const eqUrls = new Map<string, string>();
/** Ecuația desenată (SVG) în culoarea textului; ținută minte, ca să nu fie desenată din nou la fiecare literă scrisă. */
function eqUrl(src: string, ink: string) {
  const k = ink + '|' + src;
  let u = eqUrls.get(k);
  if (!u) {
    if (eqUrls.size > 200) eqUrls.clear();
    try { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(equationSvg({ src }, undefined, ink).svg); } catch { u = ''; }
    eqUrls.set(k, u);
  }
  return u;
}

/**
 * Ecuația: textul ei își ține locul (transparent), iar peste el se vede ecuația desenată, încăpută în locul acela.
 * Cât cursorul e în ea, se vede textul, ca să poată fi schimbat.
 */
function eqFit(p: LivePart, st: CSSProperties | undefined, key: number, ink: string) {
  const url = p.eq ? eqUrl(p.eq, ink) : '';
  if (!url) return <span key={key} className="eq" style={st}>{p.s}</span>;
  return <span key={key} className="eq fit eqfit" style={{ ...st, WebkitTextFillColor: 'transparent' }}>{p.s}<img className="fit-in" alt="" src={url} /></span>;
}

/** Potrivește fiecare cuvânt desenat peste locul lui (vezi fitWords); cuvântul rupt pe două rânduri se arată simplu. */
function fitAll(d: HTMLElement | null) {
  if (!d) return;
  for (const o of d.querySelectorAll<HTMLElement>('.fit')) {
    const i = o.lastElementChild as HTMLElement | null;
    if (!i) continue;
    const one = o.getClientRects().length === 1;
    o.classList.toggle('split', !one);
    if (o.classList.contains('eqfit')) {
      const r = o.getBoundingClientRect();
      i.style.width = r.width + 'px'; i.style.height = r.height * 1.2 + 'px'; i.style.top = -r.height * 0.1 + 'px';
      continue;
    }
    const w = o.getBoundingClientRect().width, iw = i.offsetWidth;
    i.style.transform = one && iw ? `scale(${(w / iw).toFixed(4)}, ${o.dataset.sy})` : 'none';
  }
}

function partStyle(p: LivePart, italicFont: string | null): CSSProperties | undefined {
  const st: CSSProperties = {};
  if (p.b) st.WebkitTextStroke = '0.035em currentColor';
  if (p.i && italicFont) { st.fontFamily = italicFont; st.fontStyle = 'italic'; }
  const deco = [p.u && 'underline', p.x && 'line-through'].filter(Boolean).join(' ');
  if (deco) st.textDecoration = deco;
  if (p.c) st.color = p.c;
  else if (p.hd) st.color = 'var(--accent)';
  if (p.hc || p.h) { st.backgroundColor = p.hc ?? HIGHLIGHT; if (!p.c) st.color = '#1a1a1a'; }
  return Object.keys(st).length ? st : undefined;
}

export function LiveBody({ area, text }: { area: RefObject<HTMLTextAreaElement | null>; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stack, setStack] = useState('');
  const [italicFont, setItalicFont] = useState<string | null>(null);
  const [ink, setInk] = useState('#000');
  const [caret, setCaret] = useState<number | null>(null);
  const lines = useMemo(() => liveLines(text), [text]);
  const starts = useMemo(() => { const s: number[] = []; let at = 0; for (const ln of lines) { s.push(at); for (const p of ln) at += p.s.length; at += 1; } return s; }, [lines]);

  // Stratul stă exact peste caseta câmpului (fără bara de derulare), cu același font, aceleași margini și aceeași derulare.
  const sync = () => {
    const t = area.current, d = ref.current;
    if (!t || !d) return;
    const cs = getComputedStyle(t);
    for (const k of COPY) d.style[k] = cs[k];
    d.style.left = t.offsetLeft + t.clientLeft + 'px';
    d.style.top = t.offsetTop + t.clientTop + 'px';
    d.style.width = t.clientWidth + 'px';
    d.style.height = t.clientHeight + 'px';
    d.scrollTop = t.scrollTop;
    if (cs.fontFamily !== stack) setStack(cs.fontFamily);
    const col = getComputedStyle(d).color;
    if (col && col !== ink) setInk(col);
  };
  useLayoutEffect(() => { sync(); fitAll(ref.current); });
  useEffect(() => {
    const t = area.current;
    if (!t) return;
    const onScroll = () => { if (ref.current) ref.current.scrollTop = t.scrollTop; };
    t.addEventListener('scroll', onScroll);
    const ro = new ResizeObserver(() => { sync(); fitAll(ref.current); });
    ro.observe(t);
    const onFonts = () => fitAll(ref.current);
    document.fonts?.addEventListener('loadingdone', onFonts);
    return () => { t.removeEventListener('scroll', onScroll); ro.disconnect(); document.fonts?.removeEventListener('loadingdone', onFonts); };
  });
  useEffect(() => {
    const onSel = () => { const t = area.current; setCaret(t && document.activeElement === t ? t.selectionStart : null); };
    document.addEventListener('selectionchange', onSel);
    onSel();
    return () => document.removeEventListener('selectionchange', onSel);
  }, [area]);
  useEffect(() => {
    let live = true;
    setItalicFont(null);
    if (stack) void italicFamily(stack).then((f) => { if (live) setItalicFont(f); });
    return () => { live = false; };
  }, [stack]);

  return (
    <div ref={ref} className="note-live" aria-hidden="true">
      {lines.map((ln, k) => (
        <Fragment key={k}>
          {k > 0 && NL}
          {ln.map((p, j) => {
            const st = partStyle(p, italicFont);
            const from = starts[k] + ln.slice(0, j).reduce((n, q) => n + q.s.length, 0);
            if (p.eq && !p.m && (caret === null || caret < from || caret > from + p.s.length)) return eqFit(p, st, j, ink);
            if ((p.sz || p.f) && !p.m) return fitWords(p, st, j);
            return st || p.m || p.eq ? <span key={j} className={p.m ? 'm' : p.eq ? 'eq' : undefined} style={st}>{p.s}</span> : p.s;
          })}
        </Fragment>
      ))}
      {ZW}
    </div>
  );
}
