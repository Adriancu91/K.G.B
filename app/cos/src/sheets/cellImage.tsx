// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Poza unei formule =IMAGE(…) în celulă. Adresele http / https se aduc prin procesul principal (web:get, doar citit,
// fără cookie-uri), pentru că fereastra nu are voie să încarce singură poze de pe internet. Poza adusă se ține minte
// (aceeași adresă în mai multe celule = o singură descărcare); data:image/… se folosește direct.

import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CellImage } from './formula';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_KEPT = 200;
type Got = { url: string } | { err: string };
const got = new Map<string, Got>();
const waiting = new Map<string, Promise<Got>>();

async function fetchImage(src: string): Promise<Got> {
  try {
    const r = api.webGet ? await api.webGet(src) : await (async () => {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      return { data: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '', url: src };
    })();
    const type = r.type.split(';')[0].trim().toLowerCase();
    if (!/^image\/(png|jpeg|jpg|gif|webp|bmp|avif|x-icon|vnd\.microsoft\.icon)$/.test(type)) return { err: 'Adresa nu e o poză (merg PNG, JPG, GIF, WebP, BMP, AVIF, ICO).' };
    if (r.data.length > MAX_BYTES) return { err: 'Poza e prea mare (peste 8 MB).' };
    return { url: URL.createObjectURL(new Blob([r.data as BlobPart], { type })) };
  } catch {
    return { err: 'Poza nu a putut fi adusă (verifică adresa și legătura la internet).' };
  }
}

function load(src: string): Promise<Got> {
  const have = got.get(src);
  if (have) return Promise.resolve(have);
  let p = waiting.get(src);
  if (!p) {
    p = fetchImage(src).then((g) => {
      waiting.delete(src);
      if (got.size >= MAX_KEPT) {
        const [old, v] = got.entries().next().value as [string, Got];
        if ('url' in v) URL.revokeObjectURL(v.url);
        got.delete(old);
      }
      got.set(src, g);
      return g;
    });
    waiting.set(src, p);
  }
  return p;
}

/** Cheia după care rândul tabelului știe că s-a schimbat poza. */
export const imageKey = (img: CellImage | undefined) => (img ? `${img.sizing}|${img.h ?? ''}|${img.w ?? ''}|${img.alt}|${img.src}` : '');

export function CellImageView({ img }: { img: CellImage }) {
  const direct = img.src.startsWith('data:');
  const [g, setG] = useState<Got | undefined>(() => (direct ? { url: img.src } : got.get(img.src)));
  useEffect(() => {
    if (direct) { setG({ url: img.src }); return; }
    let live = true;
    const have = got.get(img.src);
    setG(have);
    if (!have) void load(img.src).then((x) => { if (live) setG(x); });
    return () => { live = false; };
  }, [img.src, direct]);
  if (!g) return <span className="cell-img-wait" title="Se aduce poza…">⋯</span>;
  if ('err' in g) return <span className="cell-img-err" title={g.err}>🖼✕</span>;
  // 0: încape în celulă, cu proporțiile; 1: umple celula; 2: mărimea pozei; 3: înălțimea / lățimea date.
  const style: React.CSSProperties = img.sizing === 0 ? { width: '100%', height: '100%', objectFit: 'contain' }
    : img.sizing === 1 ? { width: '100%', height: '100%', objectFit: 'fill' }
    : img.sizing === 2 ? {}
    : { ...(img.h ? { height: img.h } : {}), ...(img.w ? { width: img.w } : {}), ...(img.h && img.w ? { objectFit: 'fill' } : {}) };
  return (
    <span className={`cell-img cell-img-s${img.sizing}`}>
      <img src={g.url} alt={img.alt} title={img.alt || undefined} draggable={false} style={style} />
    </span>
  );
}
