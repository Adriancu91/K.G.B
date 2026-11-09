// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Lucruri comune pentru fișierele OpenDocument (LibreOffice / OpenOffice): .odt (Docs) și .ods (Sheets).
// Un fișier ODF e o arhivă ZIP cu content.xml și styles.xml; varianta „plată” (.fodt, .fods) e un singur XML.
import JSZip from 'jszip';

export const isEl = (n: Node): n is Element => n.nodeType === 1;
export const els = (n: Element | Document, name?: string) => [...n.childNodes].filter(isEl).filter((e) => !name || e.localName === name);
export const el = (n: Element | Document | null | undefined, name: string) => (n ? els(n, name)[0] : undefined);
/** Atributul după numele fără prefix („office:value-type” → „value-type”), oricare ar fi spațiul de nume. */
export function attr(e: Element, name: string): string | null {
  for (const a of e.attributes) if (a.localName === name) return a.value;
  return null;
}
export function deep(n: Element | Document, name: string): Element | undefined {
  for (const k of els(n)) {
    if (k.localName === name) return k;
    const f = deep(k, name);
    if (f) return f;
  }
  return undefined;
}

/** O lungime ODF („2.258cm”, „0.5in”, „12pt”) în pixeli de ecran; null dacă nu se înțelege. */
export function odfLength(v: string | null): number | null {
  const m = v ? /^(-?[\d.]+)(cm|mm|in|pt|pc|px)$/.exec(v.trim()) : null;
  if (!m) return null;
  const k = { cm: 96 / 2.54, mm: 96 / 25.4, in: 96, pt: 96 / 72, pc: 16, px: 1 }[m[2] as 'cm'] ?? 1;
  return Number(m[1]) * k;
}

export interface OdfFile {
  content: Document;
  /** styles.xml (în varianta plată stilurile sunt în content). */
  styles: Document | null;
  zip: JSZip | null;
}

/** Deschide un fișier ODF (arhivă sau XML plat) sau aruncă o eroare pe înțeles (parolă, stricat). */
export async function openOdf(data: Uint8Array, bad: string): Promise<OdfFile> {
  const parse = (xml: string) => {
    const d = new DOMParser().parseFromString(xml, 'application/xml');
    if (d.getElementsByTagName('parsererror').length && !deep(d, 'body')) throw new Error(bad);
    return d;
  };
  const head = new TextDecoder().decode(data.subarray(0, 512));
  if (/^\s*</.test(head)) return { content: parse(new TextDecoder().decode(data)), styles: null, zip: null };
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error(bad);
  }
  const manifest = await zip.file('META-INF/manifest.xml')?.async('string');
  if (manifest && /encryption-data/.test(manifest)) {
    throw new Error('Fișierul e protejat cu parolă. Deschide-l în programul în care a fost făcut, scoate parola și salvează-l din nou.');
  }
  const xml = await zip.file('content.xml')?.async('string');
  if (!xml) throw new Error(bad);
  const st = await zip.file('styles.xml')?.async('string');
  return { content: parse(xml), styles: st ? parse(st) : null, zip };
}

/** Rădăcinile cu stiluri, în ordinea în care se aplică: stilurile obișnuite, apoi cele automate. */
export function styleRoots(f: OdfFile): Element[] {
  return [
    f.styles ? deep(f.styles, 'styles') : deep(f.content, 'styles'),
    f.styles ? deep(f.styles, 'automatic-styles') : undefined,
    deep(f.content, 'automatic-styles'),
  ].filter((x): x is Element => !!x);
}
