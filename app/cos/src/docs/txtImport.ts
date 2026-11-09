// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import .txt (text simplu) în Docs, scris de noi: fiecare rând devine un paragraf. Codificarea se ghicește:
// semnul BOM (UTF-8, UTF-16 LE/BE), altfel UTF-8 dacă octeții sunt valizi, altfel pagina de cod 1250 (programele vechi românești).

const NBSP = String.fromCharCode(160);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Textul din octeți, cu codificarea ghicită. */
export function decodeText(data: Uint8Array): string {
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) return new TextDecoder('utf-8').decode(data.subarray(3));
  if (data[0] === 0xff && data[1] === 0xfe) return new TextDecoder('utf-16le').decode(data.subarray(2));
  if (data[0] === 0xfe && data[1] === 0xff) return new TextDecoder('utf-16be').decode(data.subarray(2));
  // UTF-16 fără BOM: multe zerouri pe pozițiile impare (text latin scris cu 2 octeți pe literă).
  const probe = data.subarray(0, 2000);
  let zOdd = 0, zEven = 0;
  for (let k = 0; k < probe.length; k++) if (probe[k] === 0) (k % 2 ? zOdd++ : zEven++);
  if (probe.length >= 4 && zOdd > probe.length / 4 && zEven === 0) return new TextDecoder('utf-16le').decode(data);
  if (probe.length >= 4 && zEven > probe.length / 4 && zOdd === 0) return new TextDecoder('utf-16be').decode(data);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    return new TextDecoder('windows-1250').decode(data);
  }
}

/** Un fișier mai mare de atât se aduce doar până aici (editorul rămâne ușor pe 8 GB). */
const MAX_CHARS = 5_000_000;

export async function txtToHtml(data: Uint8Array): Promise<{ html: string; warnings: number; comments: never[]; changes: never[]; simplified?: boolean; repaired?: boolean }> {
  if (data.subarray(0, 8000).some((b, k) => b === 0 && k % 2 === 0 && data[k + 1] === 0)) throw new Error('Fișierul nu este text (pare un program sau o arhivă).');
  let text = decodeText(data);
  let warnings = 0;
  if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); warnings++; }
  const lines = text.replace(/\r\n?/g, '\n').replace(/\f/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  // Tab-urile se păstrează ca spații (editorul nu are taburi în paragraf); spațiile de la început rămân vizibile.
  const html = lines.map((l) => {
    const t = esc(l.replace(/\t/g, '    ')).replace(/^ +/, (m) => NBSP.repeat(m.length));
    return t ? `<p>${t}</p>` : '<p></p>';
  }).join('');
  return { html: html || '<p></p>', warnings, comments: [], changes: [] };
}
