// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formele și casetele de text de pe foaie (Inserare → ⬠ Forme / ▤ Casetă de text). O formă e desenată ca în Docs (docs/shapes.ts),
// cu un text scris în ea (pe rânduri, centrat), și pusă pe foaie ca o poză (pics.ts). Descrierea rămâne pe poză (`sh`), ca să poată
// fi schimbată cu dublu-click și redesenată clar când e mărită.

import { parseShape, shapeSvg, type ShapeSpec } from '../docs/shapes';

export interface ShapeBox extends ShapeSpec {
  /** Textul din formă ('' = fără text); rândurile noi se păstrează. */
  text: string;
  /** Culoarea textului (#rrggbb). */
  tc: string;
  /** Mărimea textului, în pixeli (8–72). */
  fs: number;
  /** Aldin. */
  b?: boolean;
  /** Alinierea textului pe orizontală. */
  al?: 'l' | 'c' | 'r';
}

export const TEXT_MAX = 2000;
const HEX = /^#[0-9a-f]{6}$/i;

/** Caseta de text nouă: dreptunghi alb cu contur gri subțire, text negru aliniat la stânga. */
export const TEXT_BOX: ShapeBox = { k: 'rect', fill: '#ffffff', stroke: '#8a8a8a', sw: 1, text: '', tc: '#000000', fs: 14, al: 'l' };

/** Citește descrierea unei forme de pe foaie; null dacă lipsește sau e stricată. */
export function parseShapeBox(v: unknown): ShapeBox | null {
  const s = parseShape(v);
  if (!s || !v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const text = typeof o.text === 'string' ? o.text.replace(/\r\n?/g, '\n').slice(0, TEXT_MAX) : '';
  const tc = typeof o.tc === 'string' && HEX.test(o.tc) ? o.tc.toLowerCase() : '#000000';
  const fs = Math.min(72, Math.max(8, Math.round(Number(o.fs) || 14)));
  const al = o.al === 'l' || o.al === 'r' ? o.al : 'c';
  return { ...s, text, tc, fs, ...(o.b === true ? { b: true } : {}), al };
}

/** Cât de mult intră textul spre interior, ca proporție din lățime / înălțime: formele rotunde și ascuțite au mai puțin loc. */
export function textInset(k: ShapeSpec['k']): { x: number; y: number } {
  if (k === 'rect' || k === 'round') return { x: 0.04, y: 0.06 };
  if (k === 'callout') return { x: 0.1, y: 0.1 };
  if (k === 'ellipse' || k === 'heart') return { x: 0.16, y: 0.18 };
  if (k === 'triangle') return { x: 0.25, y: 0.4 };
  if (k.startsWith('arrow')) return { x: 0.18, y: 0.28 };
  return { x: 0.22, y: 0.24 };
}

/** Împarte textul pe rânduri care încap în lățimea `max` (cuvintele prea lungi se rup pe litere). */
export function wrapText(text: string, max: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/ +/)) {
      const tryLine = line ? line + ' ' + word : word;
      if (measure(tryLine) <= max) { line = tryLine; continue; }
      if (line) out.push(line);
      line = '';
      // Un cuvânt mai lung decât rândul: pe bucăți.
      let w = word;
      while (w && measure(w) > max) {
        let n = w.length - 1;
        while (n > 1 && measure(w.slice(0, n)) > max) n--;
        out.push(w.slice(0, n));
        w = w.slice(n);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

/** Forma cu textul ei ca imagine PNG, de 2 ori mai mare (clară la mărire și la tipărire). Doar în fereastra aplicației. */
export async function renderShapeBox(spec: ShapeBox, w: number, h: number): Promise<string> {
  const W = Math.max(8, Math.round(w)), H = Math.max(8, Math.round(h));
  const svg = shapeSvg(spec, W, H);
  // onload, nu decode(): decode() poate să nu se termine cât fereastra e minimizată.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('forma nu s-a putut desena'));
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, c.width, c.height);
  if (spec.text.trim()) {
    g.scale(2, 2);
    const ins = textInset(spec.k);
    const px = Math.max(4, W * ins.x), py = Math.max(3, H * ins.y);
    const maxW = Math.max(10, W - 2 * px);
    g.font = `${spec.b ? 'bold ' : ''}${spec.fs}px "Segoe UI", Arial, sans-serif`;
    g.fillStyle = spec.tc;
    g.textBaseline = 'middle';
    const lines = wrapText(spec.text, maxW, (s) => g.measureText(s).width);
    const lh = spec.fs * 1.25;
    // Caseta de text (aliniere la stânga) începe sus; celelalte forme au textul la mijloc.
    const top = spec.al === 'l' && (spec.k === 'rect' || spec.k === 'round') ? py + lh / 2 : H / 2 - ((lines.length - 1) * lh) / 2;
    g.save();
    g.beginPath();
    g.rect(px - 1, py - 1, W - 2 * px + 2, H - 2 * py + 2);
    g.clip();
    g.textAlign = spec.al === 'l' ? 'left' : spec.al === 'r' ? 'right' : 'center';
    const x = spec.al === 'l' ? px : spec.al === 'r' ? W - px : W / 2;
    lines.forEach((ln, i) => g.fillText(ln, x, top + i * lh));
    g.restore();
  }
  return c.toDataURL('image/png');
}
