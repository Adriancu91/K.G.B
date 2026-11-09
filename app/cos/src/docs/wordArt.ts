// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Textul artistic din Docs: un titlu scurt desenat cu degrade, contur sau umbră și pus în document ca imagine
// (ca formele: mărime, aliniere, text în jur; ajunge la fel în .docx, .odt, PDF). Textul și stilul rămân pe imagine, ca să poată fi schimbate.

export interface WordArtSpec {
  text: string;
  s: string;
  /** Alese de mână, peste stil: culoarea literelor, culoarea și grosimea conturului (0 = fără), umbra, fontul. */
  fill?: string;
  line?: string;
  lw?: number;
  shadow?: boolean;
  /** Strălucire în jurul literelor, în culoarea dată. */
  glow?: string;
  font?: string;
}

export const WORDART_FONTS: [id: string, name: string, css: string][] = [
  ['black', 'Gros', '900 96px "Arial Black", "Segoe UI Black", Impact, sans-serif'],
  ['impact', 'Îngust', '400 96px Impact, "Arial Narrow", sans-serif'],
  ['serif', 'Clasic', 'bold 96px Georgia, "Times New Roman", serif'],
  ['script', 'De mână', 'bold 96px "Segoe Script", "Comic Sans MS", cursive'],
  ['mono', 'Mașină de scris', 'bold 96px "Courier New", monospace'],
];
export const WORDART_GLOWS: [string, string][] = [['#facc15', 'Galben'], ['#38bdf8', 'Albastru'], ['#4ade80', 'Verde'], ['#f472b6', 'Roz'], ['#ffffff', 'Alb']];
export const WORDART_LINES: [number, string][] = [[0, 'Fără contur'], [4, 'Contur subțire'], [8, 'Contur mediu'], [14, 'Contur gros']];
const COLOR = /^#[0-9a-f]{6}$/i;

export const WORDART_STYLES: { id: string; name: string }[] = [
  { id: 'blue', name: 'Degrade albastru' },
  { id: 'gold', name: 'Auriu cu umbră' },
  { id: 'outline', name: 'Contur roșu' },
  { id: 'rainbow', name: 'Curcubeu' },
  { id: 'poster', name: 'Alb cu contur negru' },
];
const IDS = new Set(WORDART_STYLES.map((s) => s.id));
export const WORDART_MAX = 120;

export function parseWordArt(v: unknown): WordArtSpec | null {
  let o: unknown = v;
  if (typeof v === 'string') { try { o = JSON.parse(v); } catch { return null; } }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const text = typeof r.text === 'string' ? r.text.replace(/[\r\n\t]+/g, ' ').slice(0, WORDART_MAX) : '';
  if (!text.trim() || !IDS.has(String(r.s))) return null;
  const out: WordArtSpec = { text, s: String(r.s) };
  if (typeof r.fill === 'string' && COLOR.test(r.fill)) out.fill = r.fill.toLowerCase();
  if (typeof r.line === 'string' && COLOR.test(r.line)) out.line = r.line.toLowerCase();
  if (typeof r.lw === 'number' && Number.isFinite(r.lw)) out.lw = Math.max(0, Math.min(20, Math.round(r.lw)));
  if (typeof r.shadow === 'boolean') out.shadow = r.shadow;
  if (typeof r.glow === 'string' && COLOR.test(r.glow)) out.glow = r.glow.toLowerCase();
  if (typeof r.font === 'string' && WORDART_FONTS.some(([k]) => k === r.font)) out.font = r.font;
  return out;
}

const FONT_PX = 96;
const fontOf = (spec: WordArtSpec) => (WORDART_FONTS.find(([k]) => k === spec.font) ?? WORDART_FONTS[0])[2];

/** Desenează textul; întoarce poza (la dublă mărime) și lățimea de afișare pe pagină. */
export function renderWordArt(spec: WordArtSpec): { src: string; width: number } {
  const c = document.createElement('canvas');
  const g0 = c.getContext('2d')!;
  g0.font = fontOf(spec);
  const tw = Math.ceil(g0.measureText(spec.text).width);
  const pad = Math.round(FONT_PX * 0.3);
  c.width = Math.min(8000, tw + 2 * pad);
  c.height = Math.round(FONT_PX * 1.5);
  const g = c.getContext('2d')!;
  g.font = fontOf(spec);
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const x = pad, y = c.height / 2;
  const grad = (stops: string[]) => {
    const gr = g.createLinearGradient(0, y - FONT_PX / 2, 0, y + FONT_PX / 2);
    stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
    return gr;
  };
  // Ce dă stilul: umplerea, conturul (dedesubt, ca literele să rămână întregi), umbra.
  let fill: string | CanvasGradient | null = null, line: string | null = null, lw = 0, shadow = false;
  switch (spec.s) {
    case 'blue': fill = grad(['#7cc4ff', '#1d4ed8']); break;
    case 'gold': fill = grad(['#fde68a', '#d97706', '#92400e']); shadow = true; break;
    case 'outline': line = '#dc2626'; lw = 6; break;
    case 'rainbow': {
      const gr = g.createLinearGradient(x, 0, x + tw, 0);
      ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'].forEach((s, i, a) => gr.addColorStop(i / (a.length - 1), s));
      fill = gr;
      break;
    }
    default: fill = '#ffffff'; line = '#111111'; lw = 5;
  }
  if (spec.fill) fill = spec.fill;
  if (spec.line) { line = spec.line; if (!lw) lw = 8; }
  if (spec.lw !== undefined) lw = spec.lw;
  if (spec.shadow !== undefined) shadow = spec.shadow;
  if (!fill && (!line || !lw)) fill = '#111111'; // fără umplere și fără contur nu s-ar vedea nimic
  if (spec.glow) {
    // Strălucirea: textul desenat de câteva ori cu o umbră colorată, fără deplasare, sub tot restul.
    g.save();
    g.shadowColor = spec.glow;
    g.shadowBlur = 18;
    g.fillStyle = spec.glow;
    for (let i = 0; i < 3; i++) g.fillText(spec.text, x, y);
    g.restore();
  }
  if (shadow) { g.shadowColor = 'rgba(0, 0, 0, 0.45)'; g.shadowBlur = 8; g.shadowOffsetX = g.shadowOffsetY = 6; }
  if (line && lw) {
    // Cu umplere, conturul stă sub litere: îl desenăm de două ori mai gros, ca jumătatea din afară să aibă grosimea aleasă.
    g.lineWidth = fill ? lw * 2 : lw;
    g.strokeStyle = line;
    g.strokeText(spec.text, x, y);
    g.shadowColor = 'transparent';
  }
  if (fill) { g.fillStyle = fill; g.fillText(spec.text, x, y); }
  return { src: c.toDataURL('image/png'), width: Math.max(40, Math.round(c.width / 2)) };
}
