// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Editare puncte (Edit Points din PowerPoint): forma devine traseu liber, iar colțurile ei se mută trăgând de ele
// sau se șterg (dublu-clic). Traseul e în 0..1 față de casetă (ca SlideEl.path); după mutare caseta se potrivește
// din nou pe toate punctele (punctele scoase din casetă o lărgesc).
import { POLYGONS, type SlideEl } from './model';
import { pathCommands, polygonPath } from './geom';

const f4 = (v: number) => String(Math.round(v * 10000) / 10000);
const K = 0.5523; // brațele curbei care desenează un sfert de cerc

/** Traseul formei (din forma de catalog dacă nu e deja liberă). Elipsa: 4 curbe; dreptunghiul rotunjit: linii + colțuri curbe. */
export function shapeToPath(e: Pick<SlideEl, 'shape' | 'path' | 'w' | 'h'>): string {
  if (e.path) return e.path;
  if (e.shape === 'ellipse') {
    const c = (a: number, b: number) => `${f4(a)} ${f4(b)}`;
    return `M${c(0.5, 0)} C${c(0.5 + K / 2, 0)} ${c(1, 0.5 - K / 2)} ${c(1, 0.5)} C${c(1, 0.5 + K / 2)} ${c(0.5 + K / 2, 1)} ${c(0.5, 1)} `
      + `C${c(0.5 - K / 2, 1)} ${c(0, 0.5 + K / 2)} ${c(0, 0.5)} C${c(0, 0.5 - K / 2)} ${c(0.5 - K / 2, 0)} ${c(0.5, 0)} Z`;
  }
  if (e.shape === 'round') {
    const rad = Math.min(24, e.w / 2, e.h / 2), rx = e.w ? rad / e.w : 0, ry = e.h ? rad / e.h : 0, p = (a: number, b: number) => `${f4(a)} ${f4(b)}`;
    return `M${p(rx, 0)} L${p(1 - rx, 0)} Q${p(1, 0)} ${p(1, ry)} L${p(1, 1 - ry)} Q${p(1, 1)} ${p(1 - rx, 1)} L${p(rx, 1)} Q${p(0, 1)} ${p(0, 1 - ry)} L${p(0, ry)} Q${p(0, 0)} ${p(rx, 0)} Z`;
  }
  if (e.shape && POLYGONS[e.shape]) return polygonPath(POLYGONS[e.shape]!);
  return 'M0 0 L1 0 L1 1 L0 1 Z';
}

type Cmd = { c: string; n: number[] };
const write = (cmds: Cmd[]) => cmds.map(({ c, n }) => c + n.map(f4).join(' ')).join(' ');

/** Punctele care se pot trage: capătul fiecărei comenzi M / L / C / Q (fără capătul care închide conturul în punctul de start). */
export function editPoints(d: string): { i: number; u: number; v: number }[] {
  const cmds = pathCommands(d), out: { i: number; u: number; v: number }[] = [];
  let start = -1;
  cmds.forEach(({ c, n }, i) => {
    if (c === 'Z' || n.length < 2) return;
    const u = n[n.length - 2], v = n[n.length - 1];
    if (c === 'M') start = out.length;
    // Ultimul punct al conturului, identic cu primul (cum închid curbele elipsei), nu se arată de două ori.
    const next = cmds[i + 1];
    if (c !== 'M' && (!next || next.c === 'Z' || next.c === 'M') && start >= 0 && Math.abs(out[start].u - u) < 1e-6 && Math.abs(out[start].v - v) < 1e-6) return;
    out.push({ i, u, v });
  });
  return out;
}

/** Mută capătul comenzii `i` în (u, v); la curbe, brațul de lângă punct se mută odată cu el (forma curbei se păstrează). */
export function movePoint(d: string, i: number, u: number, v: number): string {
  const cmds = pathCommands(d);
  const c = cmds[i];
  if (!c || c.c === 'Z' || c.n.length < 2) return d;
  const du = u - c.n[c.n.length - 2], dv = v - c.n[c.n.length - 1];
  c.n[c.n.length - 2] = u; c.n[c.n.length - 1] = v;
  if (c.c === 'C') { c.n[2] += du; c.n[3] += dv; }
  const nx = cmds[i + 1];
  if (nx?.c === 'C') { nx.n[0] += du; nx.n[1] += dv; }
  // Punctul de start al unui contur care se închide cu o curbă în el: și capătul curbei se mută.
  if (c.c === 'M') {
    let j = i + 1;
    while (j < cmds.length && cmds[j].c !== 'Z' && cmds[j].c !== 'M') j++;
    const last = cmds[j - 1];
    if (last && last !== c && last.n.length >= 2 && Math.abs(last.n[last.n.length - 2] - (u - du)) < 1e-6 && Math.abs(last.n[last.n.length - 1] - (v - dv)) < 1e-6) {
      last.n[last.n.length - 2] = u; last.n[last.n.length - 1] = v;
      if (last.c === 'C') { last.n[2] += du; last.n[3] += dv; }
    }
  }
  return write(cmds);
}

/** Șterge punctul comenzii `i` (conturul trebuie să rămână cu cel puțin 3 puncte); null = nu se poate. */
export function deletePoint(d: string, i: number): string | null {
  const cmds = pathCommands(d);
  if (!cmds[i] || cmds[i].c === 'Z') return null;
  let s = i; while (s > 0 && cmds[s].c !== 'M') s--;
  let e = i; while (e + 1 < cmds.length && cmds[e + 1].c !== 'M' && cmds[e + 1].c !== 'Z') e++;
  const pts = editPoints(write(cmds.slice(s, e + 1).concat({ c: 'Z', n: [] })));
  if (pts.length <= 3) return null;
  if (cmds[i].c === 'M') {
    // Startul conturului: următorul punct devine start.
    const nx = cmds[i + 1];
    if (!nx || nx.c === 'Z' || nx.c === 'M') return null;
    cmds.splice(i, 2, { c: 'M', n: nx.n.slice(-2) });
  } else cmds.splice(i, 1);
  return write(cmds);
}

/**
 * Punct nou pe latura cea mai apropiată de (u, v), la mărimea casetei w × h (ca distanța să fie în pixeli).
 * Latura dreaptă se împarte în două linii, curba în două curbe (forma rămâne la fel). Întoarce traseul și indicele
 * comenzii punctului nou, sau null dacă locul e prea departe de contur (peste `max` pixeli).
 */
export function insertPoint(d: string, u: number, v: number, w: number, h: number, max = 12): { path: string; i: number } | null {
  const cmds = pathCommands(d);
  let best: { i: number; t: number; dist: number } | null = null, at: [number, number] = [0, 0], start: [number, number] = [0, 0];
  const lerp = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const pointOn = (from: number[], c: Cmd, t: number): number[] => {
    if (c.c === 'C') { const p1 = [c.n[0], c.n[1]], p2 = [c.n[2], c.n[3]], p3 = [c.n[4], c.n[5]]; const a = lerp(from, p1, t), b = lerp(p1, p2, t), e = lerp(p2, p3, t), ab = lerp(a, b, t), be = lerp(b, e, t); return lerp(ab, be, t); }
    if (c.c === 'Q') { const p1 = [c.n[0], c.n[1]], p2 = [c.n[2], c.n[3]]; return lerp(lerp(from, p1, t), lerp(p1, p2, t), t); }
    return lerp(from, c.c === 'Z' ? start : [c.n[0], c.n[1]], t);
  };
  cmds.forEach((c, i) => {
    if (c.c === 'M') { at = [c.n[0], c.n[1]]; start = at; return; }
    for (let k = 1; k < 40; k++) {
      const t = k / 40, p = pointOn(at, c, t), dist = Math.hypot((p[0] - u) * w, (p[1] - v) * h);
      if (!best || dist < best.dist) best = { i, t, dist };
    }
    at = c.c === 'Z' ? start : [c.n[c.n.length - 2], c.n[c.n.length - 1]];
  });
  if (!best || (best as { dist: number }).dist > max) return null;
  const { i, t } = best as { i: number; t: number };
  // Punctul de plecare al comenzii i.
  let from: number[] = [0, 0], st: number[] = [0, 0];
  for (let k = 0; k < i; k++) { const c = cmds[k]; if (c.c === 'M') { from = [c.n[0], c.n[1]]; st = from; } else from = c.c === 'Z' ? st : [c.n[c.n.length - 2], c.n[c.n.length - 1]]; }
  const c = cmds[i];
  if (c.c === 'C') {
    const p1 = [c.n[0], c.n[1]], p2 = [c.n[2], c.n[3]], p3 = [c.n[4], c.n[5]];
    const a = lerp(from, p1, t), b = lerp(p1, p2, t), e = lerp(p2, p3, t), ab = lerp(a, b, t), be = lerp(b, e, t), m = lerp(ab, be, t);
    cmds.splice(i, 1, { c: 'C', n: [...a, ...ab, ...m] }, { c: 'C', n: [...be, ...e, ...p3] });
  } else if (c.c === 'Q') {
    const p1 = [c.n[0], c.n[1]], p2 = [c.n[2], c.n[3]], a = lerp(from, p1, t), b = lerp(p1, p2, t), m = lerp(a, b, t);
    cmds.splice(i, 1, { c: 'Q', n: [...a, ...m] }, { c: 'Q', n: [...b, ...p2] });
  } else {
    // Latura dreaptă (și cea care închide conturul, Z): linie până la punctul nou.
    cmds.splice(i, 0, { c: 'L', n: pointOn(from, c, t) });
  }
  return { path: write(cmds), i };
}

/** Caseta se potrivește pe toate punctele traseului (și brațele curbelor): traseul nou în 0..1 și caseta în pixeli. */
export function fitPath(d: string, g: { x: number; y: number; w: number; h: number }): { path: string; x: number; y: number; w: number; h: number } {
  const cmds = pathCommands(d);
  const us = cmds.flatMap((c) => c.n.filter((_, k) => k % 2 === 0)), vs = cmds.flatMap((c) => c.n.filter((_, k) => k % 2 === 1));
  if (!us.length) return { path: d, ...g };
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const su = u1 - u0 > 1e-6 ? u1 - u0 : 1, sv = v1 - v0 > 1e-6 ? v1 - v0 : 1;
  const out = cmds.map(({ c, n }) => ({ c, n: n.map((val, k) => (k % 2 === 0 ? (val - u0) / su : (val - v0) / sv)) }));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { path: write(out), x: r2(g.x + u0 * g.w), y: r2(g.y + v0 * g.h), w: r2(Math.max(1, su * g.w)), h: r2(Math.max(1, sv * g.h)) };
}
