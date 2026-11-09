// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Text încadrat pe mai multe rânduri într-o celulă: câte rânduri ocupă și cât de înalt devine rândul tabelului.

/** Înălțimea unui rând de text încadrat și spațiul de sus + jos (cu linia de jos a celulei). */
export const WRAP_LINE = 17;
export const WRAP_PAD = 7;

/** Câte rânduri ocupă textul pe lățimea dată, rupt la spații (un cuvânt prea lung se rupe oriunde, ca în Excel). */
export function countLines(text: string, width: number, measure: (s: string) => number): number {
  if (width <= 0) return 1;
  let lines = 0;
  for (const para of text.split('\n')) {
    let line = 0;
    let used = 0;
    for (const word of para.split(/ +/)) {
      const w = measure(word);
      const space = used ? measure(' ') : 0;
      if (used && used + space + w <= width) { used += space + w; continue; }
      if (used) line++;
      // Cuvânt mai lat decât celula: ocupă singur mai multe rânduri.
      if (w > width) { line += Math.ceil(w / width) - 1; used = w % width || width; } else used = w;
    }
    lines += line + 1;
  }
  return Math.max(1, lines);
}

export function wrapHeight(lines: number): number {
  return lines * WRAP_LINE + WRAP_PAD;
}
