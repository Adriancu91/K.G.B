// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Text în coloane (Date → Text to Columns din Excel): textul dintr-o coloană se împarte în mai multe coloane
// după un separator (virgulă, punct și virgulă, Tab, spațiu sau altul ales de tine).

export type Delim = ',' | ';' | '\t' | ' ' | string;

export const DELIMS: [string, string][] = [
  [';', 'Punct și virgulă ( ; )'],
  [',', 'Virgulă ( , )'],
  ['\t', 'Tab'],
  [' ', 'Spațiu'],
];

/** Împarte un rând de text. Textul dintre ghilimele rămâne întreg („Popescu, Ion”), ca în Excel. */
export function splitText(text: string, delim: Delim, merge = false): string[] {
  if (!delim) return [text];
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cur += '"'; i++; continue; }
      if (quoted || cur === '') { quoted = !quoted; continue; }
    }
    if (!quoted && text.startsWith(delim, i)) {
      out.push(cur);
      cur = '';
      i += delim.length - 1;
      if (merge) while (text.startsWith(delim, i + 1)) i += delim.length;
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return delim === ' ' || merge ? out.map((s) => s.trim()) : out;
}

/** Separatorul cel mai probabil pentru câteva rânduri de text: cel care apare de același număr de ori (cel puțin o dată) pe toate. */
export function guessDelim(lines: string[]): Delim {
  const sample = lines.filter((l) => l.trim()).slice(0, 50);
  if (!sample.length) return ';';
  for (const d of ['\t', ';', ',', '|']) {
    const counts = sample.map((l) => splitText(l, d).length - 1);
    if (counts.every((n) => n > 0)) return d;
  }
  return sample.every((l) => l.trim().includes(' ')) ? ' ' : ';';
}
