// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Numerele rândurilor (Aspect → Numere de rând): fiecare rând de text primește un număr în marginea din stânga, ca în contracte
// și textele juridice. Rândurile se găsesc pe ecran (dreptunghiurile textului din fiecare paragraf); tabelele nu se numerotează.

export interface LineBox { top: number; height: number }

/** Grupează dreptunghiurile textului unui paragraf în rânduri: un dreptunghi care începe sub jumătatea rândului de acum e rând nou. */
export function groupLines(rects: LineBox[]): LineBox[] {
  const lines: LineBox[] = [];
  for (const r of [...rects].filter((x) => x.height > 0).sort((a, b) => a.top - b.top)) {
    const cur = lines[lines.length - 1];
    if (cur && r.top < cur.top + cur.height / 2) {
      const bottom = Math.max(cur.top + cur.height, r.top + r.height);
      cur.top = Math.min(cur.top, r.top);
      cur.height = bottom - cur.top;
    } else lines.push({ ...r });
  }
  return lines;
}

/**
 * Numărul fiecărui rând (după `tops`, în ordinea din document): continuu sau de la 1 pe fiecare pagină (`starts` = unde începe fiecare
 * pagină). Se afișează doar multiplii lui `by` (din 5 în 5 etc.); celelalte primesc 0 (fără număr).
 */
export function numberLines(tops: number[], starts: number[], page: boolean, by = 1): number[] {
  let n = 0, pg = 0;
  return tops.map((t) => {
    if (page) {
      let p = 0;
      for (let i = 1; i < starts.length; i++) if (starts[i] <= t + 0.5) p = i;
      if (p !== pg) { pg = p; n = 0; }
    }
    n++;
    return n % Math.max(1, by) === 0 ? n : 0;
  });
}
