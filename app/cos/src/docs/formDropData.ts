// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Datele listei verticale (formDrop.ts), fără editor: variantele, textul arătat și codarea pentru .docx.
export const DROP_EMPTY = 'Alegeți un element.';

/** Variantele din textul scris de om: despărțite prin „;”, fără spații la capete, fără goluri și fără dubluri. */
export function parseDropItems(s: string): string[] {
  const out: string[] = [];
  for (const p of s.split(';')) {
    const t = p.trim().slice(0, 255);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 100);
}

/** Textul arătat (și scris în .odt / ca text): varianta aleasă sau textul de completat. */
export const dropText = (attrs: { value?: unknown } | undefined) => String(attrs?.value ?? '') || DROP_EMPTY;

/** Variantele și alegerea, codate fără semne care s-ar putea strica în XML (pentru .docx). */
export const encodeDrop = (items: string[], value: string) =>
  [value, ...items].map((s) => encodeURIComponent(s).replace(/['()!*~.]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())).join('.');
export function decodeDrop(s: string): { value: string; items: string[] } | null {
  try {
    const [value = '', ...items] = s.split('.').map((p) => decodeURIComponent(p));
    return { value, items };
  } catch { return null; }
}
