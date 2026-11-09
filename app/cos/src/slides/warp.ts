// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Transformarea textului (WordArt → Transformare): literele casetei merg pe un arc, pe un cerc sau pe un val.
// Pe ecran, cât caseta nu e în lucru, textul se desenează în SVG pe o cale (textPath), peste caseta ascunsă;
// la clic în casetă apare textul obișnuit, ca să se poată scrie. În .pptx e a:prstTxWarp în a:bodyPr (textArchUp …).

export type TextWarp = 'archUp' | 'archDown' | 'circle' | 'wave';

export const TEXT_WARPS: [TextWarp | '', string][] = [
  ['', '⟿ Fără transformare'],
  ['archUp', '◠ Arc în sus'],
  ['archDown', '◡ Arc în jos'],
  ['circle', '◯ Cerc'],
  ['wave', '∿ Val'],
];

/** Numele geometriei de text din .pptx pentru fiecare transformare. */
const PPTX_WARP: Record<TextWarp, string> = { archUp: 'textArchUp', archDown: 'textArchDown', circle: 'textCircle', wave: 'textWave1' };

export const cleanWarp = (v: unknown): TextWarp | undefined => (typeof v === 'string' && v in PPTX_WARP ? (v as TextWarp) : undefined);

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Calea pe care stau literele, în caseta w × h (pixeli de slide), pentru litere de mărimea `f`.
 * Arcul în sus e jumătatea de sus a elipsei din casetă, cu literele în afară; arcul în jos e jumătatea de jos;
 * cercul pleacă de jos, în sensul acelor de ceasornic, ca mijlocul textului să fie sus; valul e o curbă în S pe mijloc.
 */
export function warpPath(warp: TextWarp, w: number, h: number, f: number): string {
  const p = Math.min(f * 0.3, w / 6), cx = w / 2;
  if (warp === 'archUp') {
    const top = Math.min(f * 0.95, h / 2), cy = Math.max(top + 4, h - f * 0.2), ry = cy - top;
    return `M${r1(p)},${r1(cy)}A${r1(cx - p)},${r1(ry)} 0 0 1 ${r1(w - p)},${r1(cy)}`;
  }
  if (warp === 'archDown') {
    const cy = Math.min(f * 0.95, h / 2), bottom = Math.max(cy + 4, h - f * 0.3), ry = bottom - cy;
    return `M${r1(p)},${r1(cy)}A${r1(cx - p)},${r1(ry)} 0 0 0 ${r1(w - p)},${r1(cy)}`;
  }
  if (warp === 'circle') {
    const rx = Math.max(4, w / 2 - f), ry = Math.max(4, h / 2 - f), cy = h / 2;
    return `M${r1(cx)},${r1(cy + ry)}A${r1(rx)},${r1(ry)} 0 1 1 ${r1(cx)},${r1(cy - ry)}A${r1(rx)},${r1(ry)} 0 1 1 ${r1(cx)},${r1(cy + ry)}`;
  }
  const y0 = h / 2 + f * 0.35, a = Math.max(0, Math.min(h / 2 - f * 0.6, h * 0.3));
  return `M${r1(p)},${r1(y0)}C${r1(w / 3)},${r1(y0 - a)} ${r1((2 * w) / 3)},${r1(y0 + a)} ${r1(w - p)},${r1(y0)}`;
}

/** Lungimea căii (pixeli de slide), din aceleași puncte ca warpPath, ca literele să se întindă pe toată calea. */
export function warpLength(d: string): number {
  const n = (d.match(/-?[0-9.]+/g) ?? []).map(Number);
  // Jumătate de elipsă (Ramanujan): a = raza pe orizontală, b = pe verticală.
  const half = (a: number, b: number) => (Math.PI / 2) * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  if (d.includes('C')) {
    // Valul: curba Bézier măsurată pe 48 de bucăți.
    const [x0, y0, x1, y1, x2, y2, x3, y3] = n;
    let len = 0, px = x0, py = y0;
    for (let i = 1; i <= 48; i++) {
      const t = i / 48, u = 1 - t;
      const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
      const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
      len += Math.hypot(x - px, y - py); px = x; py = y;
    }
    return len;
  }
  const arcs = d.split('A').length - 1;
  return arcs ? arcs * half(n[2], n[3]) : 0;
}

/** Textul de pus pe cale: rândurile casetei unite cu un spațiu. */
export const warpText = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean).join(' ');

/** În XML-ul unei forme (p:sp), pune a:prstTxWarp primul în a:bodyPr (cum cere formatul). */
export function warpXml(sp: string, warp: TextWarp): string {
  const at = sp.indexOf('<a:bodyPr');
  if (at < 0 || sp.includes('<a:prstTxWarp')) return sp;
  const close = sp.indexOf('>', at);
  if (close < 0) return sp;
  const tag = `<a:prstTxWarp prst="${PPTX_WARP[warp]}"><a:avLst/></a:prstTxWarp>`;
  if (sp[close - 1] === '/') return sp.slice(0, close - 1).trimEnd() + '>' + tag + '</a:bodyPr>' + sp.slice(close + 1);
  return sp.slice(0, close + 1) + tag + sp.slice(close + 1);
}

/** Transformarea dintr-un a:bodyPr citit din .pptx (cele apropiate de ale noastre trec la cea mai asemănătoare). */
export function warpOf(bodyPr: Element | null | undefined): TextWarp | undefined {
  const w = bodyPr ? [...bodyPr.getElementsByTagName('*')].find((e) => e.parentNode === bodyPr && e.localName === 'prstTxWarp') : undefined;
  const prst = w?.getAttribute('prst') ?? '';
  if (prst === 'textArchUp' || prst === 'textArchUpPour' || prst === 'textCurveUp') return 'archUp';
  if (prst === 'textArchDown' || prst === 'textArchDownPour' || prst === 'textCurveDown') return 'archDown';
  if (prst === 'textCircle' || prst === 'textCirclePour' || prst === 'textButton' || prst === 'textButtonPour') return 'circle';
  if (/^textWave|^textDoubleWave/.test(prst)) return 'wave';
  return undefined;
}
