// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Date → Preluare date → Din imagine: un tabel fotografiat sau scanat devine foaie. Cuvintele recunoscute (OCR, cu pozițiile
// lor) se strâng în rânduri după înălțime, apoi în coloane după benzile verticale în care cad; tabelul iese ca HTML și trece
// prin același drum ca tabelele din documente (docTables.ts: capul de tabel, numerele și datele ca numere, lățimile).
// Celulele cu un cuvânt recunoscut nesigur (încrederea sub UNSURE) se țin minte, ca să fie colorate pentru verificare.

export interface OcrBox { text: string; x0: number; y0: number; x1: number; y1: number; /** Încrederea recunoașterii, 0–100 (lipsă = sigur). */ conf?: number }

/** Sub această încredere (din 100), un cuvânt e „nesigur” și celula lui se arată pentru verificare. */
export const UNSURE = 75;

type Seg = { text: string; x0: number; x1: number; conf: number };

/** Cuvintele cu pozițiile lor → rândurile tabelului (toate cu același număr de coloane). */
export function boxesToRows(words: OcrBox[]): string[][] {
  return boxesToGrid(words).rows;
}

/** Ca boxesToRows, plus celulele [rând, coloană] în care cel puțin un cuvânt are încrederea sub UNSURE. */
export function boxesToGrid(words: OcrBox[]): { rows: string[][]; unsure: [number, number][] } {
  const ws = words.filter((w) => w.text.trim() && w.x1 > w.x0 && w.y1 > w.y0).sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  // Rândurile: un cuvânt intră în rândul cu care se suprapune pe verticală cel puțin pe jumătate din înălțimea lui.
  const lines: { y0: number; y1: number; ws: OcrBox[] }[] = [];
  for (const w of ws) {
    const h = w.y1 - w.y0;
    const l = lines.find((q) => Math.min(q.y1, w.y1) - Math.max(q.y0, w.y0) >= 0.5 * Math.min(h, q.y1 - q.y0));
    if (l) { l.ws.push(w); l.y0 = Math.min(l.y0, w.y0); l.y1 = Math.max(l.y1, w.y1); } else lines.push({ y0: w.y0, y1: w.y1, ws: [w] });
  }
  lines.sort((a, b) => a.y0 - b.y0);
  // În fiecare rând, cuvintele apropiate (cel mult cât înălțimea literelor) sunt aceeași celulă; între coloane e loc mai mult.
  const segLines: Seg[][] = lines.map((l) => {
    const hs = l.ws.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
    const h = hs[hs.length >> 1];
    const segs: Seg[] = [];
    for (const w of [...l.ws].sort((a, b) => a.x0 - b.x0)) {
      const s = segs[segs.length - 1];
      const conf = w.conf ?? 100;
      if (s && w.x0 - s.x1 < 1.1 * h) { s.text += ' ' + w.text.trim(); s.x1 = Math.max(s.x1, w.x1); s.conf = Math.min(s.conf, conf); }
      else segs.push({ text: w.text.trim(), x0: w.x0, x1: w.x1, conf });
    }
    return segs;
  });
  // Coloanele: benzile verticale ale celulelor din rândurile cu mai multe celule (titlurile pe o singură celulă nu le unesc).
  const multi = segLines.filter((s) => s.length > 1).flat().sort((a, b) => a.x0 - b.x0);
  const bands: { x0: number; x1: number }[] = [];
  for (const s of multi) {
    const b = bands[bands.length - 1];
    if (b && s.x0 <= b.x1) b.x1 = Math.max(b.x1, s.x1); else bands.push({ x0: s.x0, x1: s.x1 });
  }
  const unsure: [number, number][] = [];
  if (!bands.length) {
    segLines.forEach((segs, r) => { if (segs.some((s) => s.conf < UNSURE)) unsure.push([r, 0]); });
    return { rows: segLines.map((segs) => [segs.map((s) => s.text).join(' ')]), unsure };
  }
  const rows = segLines.map((segs, r) => {
    const row: string[] = bands.map(() => '');
    for (const s of segs) {
      // Banda cu care se suprapune cel mai mult; fără suprapunere, cea mai apropiată.
      let best = 0, score = -Infinity;
      bands.forEach((b, i) => {
        const ov = Math.min(b.x1, s.x1) - Math.max(b.x0, s.x0);
        const v = ov > 0 ? ov : -Math.min(Math.abs(s.x0 - b.x1), Math.abs(b.x0 - s.x1));
        if (v > score) { score = v; best = i; }
      });
      row[best] = row[best] ? row[best] + ' ' + s.text : s.text;
      if (s.conf < UNSURE && !unsure.some(([a, b]) => a === r && b === best)) unsure.push([r, best]);
    }
    return row;
  });
  return { rows, unsure };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Rândurile → un tabel HTML, pentru docTablesToBook. */
export function rowsToHtml(rows: string[][]): string {
  return '<table>' + rows.map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</table>';
}
