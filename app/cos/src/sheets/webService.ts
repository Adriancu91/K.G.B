// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// WEBSERVICE(adresă): textul adus de la o adresă http / https. Formulele se calculează pe loc, așa că prima dată celula
// arată #BUSY!, adresa se aduce în fundal (în aplicație prin procesul principal: web:get, doar citit, fără cookie-uri),
// iar când sosește răspunsul foaia se recalculează singură. Răspunsurile se țin minte, deci aceeași adresă se aduce o dată
// (Shift+F9 / Ctrl+Alt+F9 nu le aduce din nou; doar o adresă nouă sau o pornire nouă).

export type WebFetch = (url: string) => Promise<{ data: Uint8Array; type: string }>;
type Got = { text: string } | { err: string };

/** Cel mult atâtea caractere într-o celulă, ca în programele cunoscute. */
export const MAX_WEB_TEXT = 32767;
const MAX_KEPT = 300;
const got = new Map<string, Got>();
const waiting = new Set<string>();
const listeners = new Set<() => void>();
let fetcher: WebFetch | null = null;

export function setWebFetcher(f: WebFetch | null) { fetcher = f; }
/** Funcția primită e chemată după fiecare răspuns sosit (foaia se recalculează). Întoarce oprirea. */
export function onWebData(cb: () => void): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }

function charsetOf(type: string): string {
  const m = /charset=([^;]+)/i.exec(type);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : 'utf-8';
}

async function fetchText(url: string): Promise<Got> {
  try {
    const r = await fetcher!(url);
    let dec: TextDecoder;
    try { dec = new TextDecoder(charsetOf(r.type)); } catch { dec = new TextDecoder('utf-8'); }
    const text = dec.decode(r.data);
    return text.length > MAX_WEB_TEXT ? { err: '#VALUE!' } : { text };
  } catch {
    return { err: '#VALUE!' };
  }
}

/**
 * Răspunsul pentru adresă: { text } sau { err } dacă a sosit, undefined dacă abia acum pornește aducerea
 * (sau încă se așteaptă). Fără cine să aducă (de exemplu în teste fără aplicație): { err: '#VALUE!' }.
 */
export function webText(url: string): Got | undefined {
  const have = got.get(url);
  if (have) return have;
  if (!fetcher) return { err: '#VALUE!' };
  if (!waiting.has(url)) {
    waiting.add(url);
    void fetchText(url).then((g) => {
      waiting.delete(url);
      if (got.size >= MAX_KEPT) got.delete(got.keys().next().value as string);
      got.set(url, g);
      for (const cb of [...listeners]) cb();
    });
  }
  return undefined;
}
