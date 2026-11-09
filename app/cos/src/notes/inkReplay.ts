// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Reluarea desenului de mână din Notițe: ce se vede după primele n puncte. Testat în tests/notes-inkreplay.test.mjs.

/** Reluarea desenului (ca Ink Replay din OneNote): liniile până la al n-lea punct, în ordinea în care au fost trase
 *  (ultima poate fi tăiată la jumătate). Formele (linie, dreptunghi, cerc) apar întregi, nu se pot tăia. */
export function partialStrokes<T extends { tool: string; pts: unknown[] }>(strokes: T[], n: number): T[] {
  const out: T[] = [];
  let left = Math.max(0, Math.floor(n));
  for (const st of strokes) {
    if (left <= 0) break;
    const whole = st.tool === 'line' || st.tool === 'rect' || st.tool === 'ellipse' || st.pts.length <= left;
    out.push(whole ? st : { ...st, pts: st.pts.slice(0, left) });
    left -= st.pts.length;
  }
  return out;
}
/** Câte puncte are tot desenul (pentru reluare). */
export const strokePoints = (strokes: { pts: unknown[] }[]) => strokes.reduce((n, st) => n + st.pts.length, 0);
