// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Desen → forme (ca Ink to Shape): o linie trasă de mână care seamănă cu o linie dreaptă, un dreptunghi sau un cerc
// devine forma curată. Doar geometrie simplă: cât de departe sunt punctele de forma potrivită (în fracțiuni din mărimea ei).

export type Pt = [number, number, number];
export type InkShape = { tool: 'line' | 'rect' | 'ellipse'; pts: [Pt, Pt] };

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Forma recunoscută sau null (scrisul obișnuit, mâzgăliturile și formele prea mici rămân cum sunt). */
export function recognize(pts: Pt[]): InkShape | null {
  if (pts.length < 5) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, path = 0;
  pts.forEach(([x, y], i) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    if (i) path += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
  });
  const w = x1 - x0, h = y1 - y0, diag = Math.hypot(w, h);
  if (diag < 30) return null;
  const a = pts[0], b = pts[pts.length - 1];
  const p = a[2];
  // Linie: toate punctele aproape de dreapta dintre capete, iar drumul nu se întoarce.
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (span > 30 && path < span * 1.15) {
    const far = Math.max(...pts.map(([x, y]) => segDist(x, y, a[0], a[1], b[0], b[1])));
    if (far < Math.max(6, span * 0.06)) return { tool: 'line', pts: [[a[0], a[1], p], [b[0], b[1], p]] };
  }
  // Formă închisă: capetele aproape unul de altul și drumul cam cât un contur întreg.
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) > Math.max(25, diag * 0.25) || Math.min(w, h) < 20) return null;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = w / 2, ry = h / 2;
  let eErr = 0, rErr = 0;
  for (const [x, y] of pts) {
    eErr += Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1);
    // Distanța până la cea mai apropiată latură a dreptunghiului, raportată la jumătatea laturii mici.
    rErr += Math.min(Math.abs(x - x0), Math.abs(x - x1), Math.abs(y - y0), Math.abs(y - y1)) / Math.min(rx, ry);
  }
  eErr /= pts.length;
  rErr /= pts.length;
  const corners: [Pt, Pt] = [[x0, y0, p], [x1, y1, p]];
  if (rErr < eErr && rErr < 0.1) return { tool: 'rect', pts: corners };
  if (eErr <= rErr && eErr < 0.12) return { tool: 'ellipse', pts: corners };
  return null;
}
