// @ts-nocheck
// Din Cyber Office Studio (src/pdf/erase.ts, D-071, D-078), neschimbat.
// Radiera pentru desenul liber (ca „Eraser” din Acrobat): șterge doar bucata atinsă dintr-o linie; ce rămâne de o parte
// și de alta devin linii separate, cu aceeași culoare și grosime.
import { DRAW_WIDTH, drawMark, type Mark } from './sign';

/** Raza radierei, în puncte la 100%. */
export const ERASE_RADIUS = 6;
/** Pasul cu care se reîmparte o linie atinsă (puncte), ca tăietura să fie precisă. */
const STEP = 1.5;

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Cât de aproape e punctul de urma radierei (o polilinie; un singur punct dacă e doar un click). */
function distToPath(px: number, py: number, path: number[]): number {
  if (path.length < 4) return Math.hypot(px - path[0], py - path[1]);
  let d = Infinity;
  for (let i = 0; i + 3 < path.length; i += 2) d = Math.min(d, distToSeg(px, py, path[i], path[i + 1], path[i + 2], path[i + 3]));
  return d;
}

/**
 * Trece radiera (urma `path`, puncte pe pagina `page`) peste desenele libere. Întoarce lista nouă de elemente sau null
 * dacă n-a atins nimic. `nextId` dă id-uri pentru bucățile noi.
 */
export function eraseStrokes(marks: Mark[], page: number, path: number[], nextId: () => number, radius = ERASE_RADIUS): Mark[] | null {
  if (path.length < 2) return null;
  let px0 = Infinity, py0 = Infinity, px1 = -Infinity, py1 = -Infinity;
  for (let i = 0; i < path.length; i += 2) {
    px0 = Math.min(px0, path[i]); px1 = Math.max(px1, path[i]);
    py0 = Math.min(py0, path[i + 1]); py1 = Math.max(py1, path[i + 1]);
  }
  let changed = false;
  const out: Mark[] = [];
  for (const m of marks) {
    const pts = m.pts;
    if (m.kind !== 'draw' || m.page !== page || !pts || pts.length < 2) { out.push(m); continue; }
    const r = radius + (DRAW_WIDTH * (m.thick ?? 1)) / 2;
    // Departe de urma radierei: rămâne cum e.
    if (m.x > px1 + r || m.y > py1 + r || m.x + m.w < px0 - r || m.y + m.h < py0 - r) { out.push(m); continue; }
    const abs: number[] = [];
    for (let i = 0; i < pts.length; i += 2) abs.push(m.x + pts[i] * m.w, m.y + pts[i + 1] * m.h);
    // Linia reîmpărțită în puncte dese; fiecare punct e păstrat sau șters.
    const dense: number[] = [abs[0], abs[1]];
    for (let i = 2; i < abs.length; i += 2) {
      const ax = abs[i - 2], ay = abs[i - 1], bx = abs[i], by = abs[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STEP));
      for (let k = 1; k <= n; k++) dense.push(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
    }
    const runs: number[][] = [];
    let cur: number[] = [];
    let hit = false;
    for (let i = 0; i < dense.length; i += 2) {
      if (distToPath(dense[i], dense[i + 1], path) < r) { hit = true; if (cur.length) runs.push(cur); cur = []; }
      else cur.push(dense[i], dense[i + 1]);
    }
    if (cur.length) runs.push(cur);
    if (!hit) { out.push(m); continue; }
    changed = true;
    for (const run of runs) {
      // Bucățile de un singur punct (mai mici decât grosimea liniei) nu se mai văd: le lăsăm deoparte.
      if (run.length < 4) continue;
      // Doar punctele la cel puțin un pas unul de altul, ca bucata să nu aibă mai multe puncte decât linia de la început.
      const thin: number[] = [run[0], run[1]];
      for (let i = 2; i < run.length; i += 2) {
        const last = i + 2 >= run.length;
        if (last || Math.hypot(run[i] - thin[thin.length - 2], run[i + 1] - thin[thin.length - 1]) >= STEP * 2) thin.push(run[i], run[i + 1]);
      }
      // Culoarea, grosimea și opacitatea rămân; chenarul și punctele vin din bucata nouă.
      out.push({ ...m, id: nextId(), ...drawMark(thin) });
    }
  }
  return changed ? out : null;
}
