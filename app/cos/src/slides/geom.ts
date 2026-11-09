// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formele desenate liber (a:custGeom din PowerPoint): conturul devine un traseu SVG cu coordonate între 0 și 1
// (M, L, C, Q, Z; arcele se aproximează cu segmente), desenat ca fundal întins pe toată caseta. La export .pptx traseul
// se scrie înapoi ca formă liberă.

const kidsOf = (n: Element | null | undefined, name: string) => (n ? [...n.children].filter((c) => c.localName === name) : []);
const kidOf = (n: Element | null | undefined, name: string) => kidsOf(n, name)[0] ?? null;

/** Cel mult atâtea comenzi într-un contur, ca un desen uriaș să nu încetinească slide-ul. */
const MAX_CMDS = 4000;

/**
 * Valorile ghidajelor (a:gd) dintr-o formă: „val”, „*∕”, „+-”, „+∕”, „?:”, abs, sqrt, max, min, pin, mod, sin, cos, at2…
 * Unghiurile sunt în 60000-imi de grad, ca în PowerPoint. Întoarce null dacă o formulă nu se poate calcula.
 */
function guides(geom: Element, w: number, h: number): Map<string, number> | null {
  const g = new Map<string, number>([
    ['w', w], ['h', h], ['l', 0], ['t', 0], ['r', w], ['b', h], ['wd2', w / 2], ['hd2', h / 2], ['hc', w / 2], ['vc', h / 2],
    ['wd4', w / 4], ['hd4', h / 4], ['wd8', w / 8], ['hd8', h / 8], ['ss', Math.min(w, h)], ['ls', Math.max(w, h)],
    ['cd2', 10800000], ['cd4', 5400000], ['3cd4', 16200000], ['cd8', 2700000],
  ]);
  const num = (s: string) => (g.has(s) ? g.get(s)! : /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN);
  const rad = (a: number) => (a / 60000) * Math.PI / 180;
  for (const list of [kidOf(geom, 'avLst'), kidOf(geom, 'gdLst')]) {
    for (const gd of kidsOf(list, 'gd')) {
      const name = gd.getAttribute('name') ?? '';
      const [op, ...a] = (gd.getAttribute('fmla') ?? '').trim().split(/\s+/);
      const [x, y, z] = a.map(num);
      let v: number;
      switch (op) {
        case 'val': v = x; break;
        case '*/': v = z ? (x * y) / z : 0; break;
        case '+-': v = x + y - z; break;
        case '+/': v = z ? (x + y) / z : 0; break;
        case '?:': v = x > 0 ? y : z; break;
        case 'abs': v = Math.abs(x); break;
        case 'sqrt': v = Math.sqrt(Math.max(0, x)); break;
        case 'max': v = Math.max(x, y); break;
        case 'min': v = Math.min(x, y); break;
        case 'pin': v = y < x ? x : y > z ? z : y; break;
        case 'mod': v = Math.sqrt(x * x + y * y + z * z); break;
        case 'sin': v = x * Math.sin(rad(y)); break;
        case 'cos': v = x * Math.cos(rad(y)); break;
        case 'tan': v = x * Math.tan(rad(y)); break;
        case 'at2': v = (Math.atan2(y, x) * 180 / Math.PI) * 60000; break;
        case 'cat2': v = x * Math.cos(Math.atan2(z, y)); break;
        case 'sat2': v = x * Math.sin(Math.atan2(z, y)); break;
        default: return null;
      }
      if (!name || !Number.isFinite(v)) return null;
      g.set(name, v);
    }
  }
  return g;
}

const fmt = (v: number) => String(Math.round(v * 10000) / 10000);

/** Conturul unei forme a:custGeom ca traseu SVG în 0..1, sau null dacă nu are contur umplut ori nu se poate citi. */
export function custGeomPath(geom: Element, wEmu: number, hEmu: number): string | null {
  const g = guides(geom, wEmu, hEmu);
  if (!g) return null;
  const val = (s: string | null) => (s === null ? NaN : g.has(s) ? g.get(s)! : Number(s));
  const out: string[] = [];
  for (const path of kidsOf(kidOf(geom, 'pathLst'), 'path')) {
    if (path.getAttribute('fill') === 'none') continue;
    const pw = Number(path.getAttribute('w') ?? 0) || wEmu, ph = Number(path.getAttribute('h') ?? 0) || hEmu;
    if (!pw || !ph) continue;
    // Coordonatele (numere sau ghidaje) sunt în spațiul traseului: 0..w, 0..h ale lui (sau ale formei, dacă traseul nu le spune).
    const sx = 1 / pw, sy = 1 / ph;
    const pt = (p: Element | null): [number, number] | null => {
      const x = val(p?.getAttribute('x') ?? null), y = val(p?.getAttribute('y') ?? null);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return [x * sx, y * sy];
    };
    let cur: [number, number] = [0, 0];
    for (const c of [...path.children]) {
      if (out.length > MAX_CMDS) return null;
      if (c.localName === 'close') { out.push('Z'); continue; }
      if (c.localName === 'arcTo') {
        // Arcul pornește din punctul curent: centrul se află înapoi pe elipsă, la unghiul de start.
        const wR = val(c.getAttribute('wR')), hR = val(c.getAttribute('hR'));
        const st = val(c.getAttribute('stAng')) / 60000 * Math.PI / 180, sw = val(c.getAttribute('swAng')) / 60000 * Math.PI / 180;
        if (![wR, hR, st, sw].every(Number.isFinite)) return null;
        const rx = wR * sx, ry = hR * sy;
        const cx = cur[0] - rx * Math.cos(st), cy = cur[1] - ry * Math.sin(st);
        const steps = Math.max(2, Math.ceil(Math.abs(sw) / (Math.PI / 16)));
        for (let i = 1; i <= steps; i++) {
          const a = st + (sw * i) / steps;
          cur = [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
          out.push(`L${fmt(cur[0])} ${fmt(cur[1])}`);
        }
        continue;
      }
      const pts = kidsOf(c, 'pt').map(pt);
      if (pts.some((p) => !p)) return null;
      const p = pts as [number, number][];
      if (c.localName === 'moveTo' && p[0]) { cur = p[0]; out.push(`M${fmt(cur[0])} ${fmt(cur[1])}`); }
      else if (c.localName === 'lnTo' && p[0]) { cur = p[0]; out.push(`L${fmt(cur[0])} ${fmt(cur[1])}`); }
      else if (c.localName === 'cubicBezTo' && p.length === 3) { cur = p[2]; out.push('C' + p.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' ')); }
      else if (c.localName === 'quadBezTo' && p.length === 2) { cur = p[1]; out.push('Q' + p.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' ')); }
      else return null;
    }
  }
  return out.some((s) => s[0] === 'L' || s[0] === 'C' || s[0] === 'Q') ? out.join(' ') : null;
}

/** Traseul ca fundal CSS (imagine SVG întinsă pe toată caseta). */
export function pathBackground(d: string, color: string, line?: { color: string; w: number; dash?: string }, grad?: { b: string; dir?: 'down' | 'right' | 'diag' | 'radial' }, img?: { src: string; alpha?: number }): string {
  // Conturul are aceeași grosime oricât de întinsă e forma (vector-effect).
  const stroke = line ? ` stroke="${line.color}" stroke-width="${line.w}" vector-effect="non-scaling-stroke" stroke-linejoin="round"${line.dash ? ` stroke-dasharray="${line.dash}"` : ''}` : '';
  // Degradeul (Umplere degrade): de la `color` la `grad.b`, în direcția aleasă.
  const stops = grad ? `<stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${grad.b}"/>` : '';
  const defs = !grad ? '' : grad.dir === 'radial' ? `<defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.5">${stops}</radialGradient></defs>`
    : `<defs><linearGradient id="g" x1="0" y1="0" x2="${grad.dir === 'down' || !grad.dir ? 0 : 1}" y2="${grad.dir === 'right' ? 0 : 1}">${stops}</linearGradient></defs>`;
  // Poza ca umplere: întinsă pe toată forma (ca „Întinde” din programele de prezentări).
  const pat = img ? `<defs><pattern id="p" patternContentUnits="objectBoundingBox" width="1" height="1"><image href="${img.src}" width="1" height="1" preserveAspectRatio="none"${img.alpha !== undefined && img.alpha < 1 ? ` opacity="${img.alpha}"` : ''}/></pattern></defs>` : defs;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none">${pat}<path d="${d}" fill="${img ? 'url(#p)' : grad ? 'url(#g)' : color}" fill-rule="evenodd"${stroke}/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`;
}

/** Un poligon scris ca la clip-path („50% 0,100% 100%,0 100%”) → traseu în 0..1. */
export function polygonPath(poly: string): string {
  const pts = poly.split(',').map((p) => p.trim().split(/\s+/).map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) || 0)));
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`).join(' ') + ' Z';
}

/** Comenzile traseului (doar M, L, C, Q, Z, cum le scrie custGeomPath). */
export function pathCommands(d: string): { c: string; n: number[] }[] {
  const out: { c: string; n: number[] }[] = [];
  for (const m of d.matchAll(/([MLCQZ])([^MLCQZ]*)/g)) out.push({ c: m[1], n: m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [] });
  return out;
}

/** Un traseu valid scris de noi (pentru fișierele deschise din disc). */
export const isPath = (d: unknown): d is string => typeof d === 'string' && d.length < 200000 && /^[MLCQZ0-9.\s-]+$/.test(d) && d.startsWith('M');

/** Câte puncte ține o formă liberă desenată cu mâna (mai multe se rărește). */
export const FREEFORM_MAX = 120;
/**
 * Forma liberă (Formă liberă: mâzgălitură): conturul tras cu mouse-ul (puncte de slide) → caseta lui și traseul închis în 0..1.
 * Punctele la sub 3 px se sar; null dacă desenul e prea mic (sub 10 px în ambele direcții) sau are sub 3 puncte.
 */
export function freeformFromStroke(raw: [number, number][]): { x: number; y: number; w: number; h: number; path: string } | null {
  const pts: [number, number][] = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 3) pts.push(p);
  }
  if (pts.length < 3) return null;
  const step = Math.ceil(pts.length / FREEFORM_MAX), few = pts.filter((_, k) => k % step === 0 || k === pts.length - 1);
  const xs = few.map((p) => p[0]), ys = few.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  if (w < 10 && h < 10) return null;
  const W = Math.max(w, 1), H = Math.max(h, 1);
  const path = few.map(([px, py], k) => `${k ? 'L' : 'M'}${fmt((px - x) / W)} ${fmt((py - y) / H)}`).join(' ') + ' Z';
  return { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)), path };
}
