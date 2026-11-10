// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 📖 Lectură (ca Immersive Reader din OneNote): notița doar de citit, pe o coloană îngustă, cu literă mare, spațiere aleasă,
// fundal liniștit (obișnuit, sepia, întunecat) și citire cu voce tare (vocile din Windows, fără internet). Esc iese.
import { Fragment, useEffect, useState } from 'react';
import { speak, stopSpeaking } from '../speak';
import { isCurrent } from '../active';
import { fontCss, parseBlocks, parseInline, plainInline, Span } from './inline';
import { equationAlt, equationSvg } from '../docs/equation';
import { CanvasView } from './Canvas';
import { boxesText, CanvasBox } from './freeCanvas';

/** Ecuația desenată (SVG), la mărimea textului din jur. */
export const equationUrl = (src: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(equationSvg({ src }).svg);

/** Bucățile formatate ale unui rând: aldin, cursiv, subliniat, tăiat, evidențiat, colorat, cu mărime și font. */
export function Inline({ text }: { text: string }) {
  const one = (p: Span, i: number) => {
    if (p.eq) return <img key={i} className="note-eq" src={equationUrl(p.eq)} alt={equationAlt({ src: p.eq })} title={p.eq} />;
    let el: JSX.Element | string = p.s;
    if (p.c) el = <span style={{ color: p.c }}>{el}</span>;
    if (p.sz || p.f) el = <span style={{ fontSize: p.sz ? p.sz + 'em' : undefined, fontFamily: p.f }}>{el}</span>;
    if (p.hc) el = <mark style={{ background: p.hc, color: 'inherit' }}>{el}</mark>;
    if (p.h) el = <mark>{el}</mark>;
    if (p.u) el = <u>{el}</u>;
    if (p.x) el = <s>{el}</s>;
    if (p.i) el = <em>{el}</em>;
    if (p.b) el = <strong>{el}</strong>;
    return <Fragment key={i}>{el}</Fragment>;
  };
  return <>{parseInline(text).map(one)}</>;
}

type Spacing = 'normal' | 'wide';
type Tone = 'plain' | 'sepia' | 'dark';
const SPACINGS: [Spacing, string][] = [['normal', 'Spațiere normală'], ['wide', 'Spațiere largă']];
const TONES: [Tone, string][] = [['plain', 'Fundal obișnuit'], ['sepia', 'Fundal sepia'], ['dark', 'Fundal întunecat']];

const load = <T extends string>(key: string, ok: readonly T[], def: T): T => {
  try { const v = localStorage.getItem(key) as T; return ok.includes(v) ? v : def; } catch { return def; }
};
const save = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* fără memorie locală */ } };

export default function Reader({ title, body, font, boxes, onClose }: { title: string; body: string; font?: string; boxes?: CanvasBox[]; onClose(): void }) {
  const [spacing, setSpacing] = useState<Spacing>(() => load('suite.notes.readerSpacing', ['normal', 'wide'], 'wide'));
  const [tone, setTone] = useState<Tone>(() => load('suite.notes.readerTone', ['plain', 'sepia', 'dark'], 'sepia'));
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isCurrent('note')) return; if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Citirea se oprește când ieși din Lectură sau treci la altă notiță.
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { stopSpeaking(); setSpeaking(false); }, [title, body]);

  const readAloud = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    setSpeaking(speak([title, plainInline(body), plainInline(boxesText(boxes))].filter((x) => x.trim()).join('.\n'), () => setSpeaking(false)));
  };

  const blocks = parseBlocks(body);
  return (
    <div className={`note-reader tone-${tone} space-${spacing}`} role="document" aria-label="Lectură">
      <div className="note-reader-bar">
        <button className={speaking ? 'on' : ''} onClick={readAloud} title={speaking ? 'Oprește citirea' : 'Citește notița cu voce tare (vocile instalate în sistem, fără internet)'}>
          {speaking ? '⏹ Oprește' : '🔊 Citește cu voce'}
        </button>
        <select value={spacing} onChange={(e) => { const v = e.target.value as Spacing; setSpacing(v); save('suite.notes.readerSpacing', v); }} aria-label="Spațierea textului">
          {SPACINGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={tone} onChange={(e) => { const v = e.target.value as Tone; setTone(v); save('suite.notes.readerTone', v); }} aria-label="Fundalul">
          {TONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button onClick={onClose} title="Înapoi la scris (Esc)">✕ Ieși din Lectură</button>
      </div>
      <article className="note-reader-page" style={{ fontFamily: fontCss(font) }}>
        {title.trim() && <h1>{title}</h1>}
        {blocks.length ? blocks.map((b, i) => {
          if (b.kind === 'h') { const H = (['h2', 'h3', 'h4', 'h5', 'h6', 'h6'] as const)[b.level - 1]; return <H key={i} style={b.align ? { textAlign: b.align as 'center' } : undefined}><Inline text={b.text} /></H>; }
          if (b.kind === 'table') return (
            <table key={i}>
              {b.head && <thead><tr>{b.head.map((c, j) => <th key={j}><Inline text={c} /></th>)}</tr></thead>}
              <tbody>{b.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>)}</tbody>
            </table>
          );
          return <p key={i} style={b.align ? { textAlign: b.align as 'center' } : undefined}><Inline text={b.text} /></p>;
        }) : boxes?.length ? null : <p className="muted">Notița nu are text.</p>}
        {boxes?.length ? <CanvasView boxes={boxes} /> : null}
      </article>
    </div>
  );
}
