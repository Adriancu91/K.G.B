// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Stilurile de tabel (galeria Stiluri): ce culori au capul, rândurile și benzile alternate.
// Aceleași culori se folosesc pe ecran (SlideView) și la exportul .pptx (pptx.ts), ca să arate la fel.
import type { Theme } from './model';

/** Lipsă = stilul obișnuit: cap în culoarea temei, benzi gri. */
export type TableStyle = 'accent' | 'deschis' | 'intunecat' | 'simplu';

export const TABLE_STYLES: [TableStyle | '', string][] = [
  ['', '🎨 Stil mediu (benzi gri)'],
  ['accent', '🎨 Stil colorat (benzi în culoarea temei)'],
  ['deschis', '🎨 Stil deschis (cap subliniat)'],
  ['intunecat', '🎨 Stil întunecat'],
  ['simplu', '🎨 Stil simplu (fără culori)'],
];

export const cleanTStyle = (v: unknown): TableStyle | undefined =>
  TABLE_STYLES.some(([k]) => k && k === v) ? (v as TableStyle) : undefined;

/** Culoarea a amestecată în b cât spune k (0..1), ca #rrggbb. */
export function mix(a: string, b: string, k: number): string {
  const p = (c: string) => { const n = parseInt(c.replace('#', '').slice(0, 6), 16) || 0; return [n >> 16, (n >> 8) & 255, n & 255]; };
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v * k + y[i] * (1 - k)).toString(16).padStart(2, '0')).join('');
}

const onColor = (bg: string) => {
  const n = parseInt(bg.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160 ? '#111827' : '#ffffff';
};

export interface TableColors {
  /** Capul: fundal (lipsă = ca rândurile), text și, la stilul deschis, linia groasă de sub el. */
  head: { bg?: string; fg: string; line?: string };
  /** Fundalul rândurilor obișnuite și al celor alternate (lipsă = fără benzi). */
  body: string;
  band?: string;
  /** Textul și liniile din corpul tabelului. */
  fg: string;
}

// Culoarea stilului (variantele din galerie): lipsă = culoarea temei; altfel una dintre culorile de mai jos.
export const TABLE_COLORS: [string, string][] = [
  ['#2563eb', 'Albastru'], ['#ea580c', 'Portocaliu'], ['#16a34a', 'Verde'], ['#dc2626', 'Roșu'],
  ['#7c3aed', 'Mov'], ['#0e7490', 'Turcoaz'], ['#ca8a04', 'Auriu'], ['#6b7280', 'Gri'],
];
// Orice culoare #rrggbb: cele din rând, sau culoarea accentului dintr-un .pptx deschis (vezi pptxAccent).
export const cleanTColor = (v: unknown): string | undefined => cleanLineC(v);

export function tableColors(style: TableStyle | undefined, theme: Pick<Theme, 'bg' | 'fg' | 'accent'>, color?: string): TableColors {
  const t = color ? { ...theme, accent: color } : theme;
  // Stilul întunecat într-o culoare: capul aproape negru, rândurile în nuanțe închise ale culorii.
  if (style === 'intunecat' && color) return { head: { bg: mix(color, '#000000', 0.45), fg: '#ffffff' }, body: mix(color, '#111827', 0.3), band: mix(color, '#111827', 0.45), fg: '#f9fafb' };
  switch (style) {
    case 'accent':
      return { head: { bg: t.accent, fg: onColor(t.accent) }, body: mix(t.accent, t.bg, 0.12), band: mix(t.accent, t.bg, 0.26), fg: t.fg };
    case 'deschis':
      return { head: { fg: t.accent, line: t.accent }, body: t.bg, band: mix(t.accent, t.bg, 0.1), fg: t.fg };
    case 'intunecat':
      return { head: { bg: '#111827', fg: '#ffffff' }, body: '#374151', band: '#4b5563', fg: '#f9fafb' };
    case 'simplu':
      return { head: { fg: t.fg }, body: t.bg, fg: t.fg };
    default:
      return { head: { bg: t.accent, fg: onColor(t.accent) }, body: t.bg, band: mix(t.fg, t.bg, 0.06), fg: t.fg };
  }
}

// Stilurile de tabel din .pptx (a:tableStyleId), după numele lor din ppt/tableStyles.xml.
// La export scriem câte unul pentru fiecare stil al nostru (culorile sunt oricum scrise în fiecare celulă).
const PPTX_IDS: [string, TableStyle | ''][] = [
  ['{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}', ''], // Medium Style 2
  ['{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}', 'accent'], // Medium Style 2 - Accent 1 (implicitul PowerPoint)
  ['{3B4B98B0-60AC-42C2-AFA5-B58CD77FA1E5}', 'deschis'], // Light Style 1 - Accent 1
  ['{E8034E78-7F5D-4C2E-B375-FC64B27BC917}', 'intunecat'], // Dark Style 1
  ['{5940675A-B579-460E-94D1-54222C63F5DA}', 'simplu'], // No Style, Table Grid
  ['{2D5ABB26-0587-4C30-8999-92F81FD0307C}', 'simplu'], // No Style, No Grid
  ['{9D7B26C5-4107-4FEC-AEDC-1716B250A1EF}', 'deschis'], // Light Style 1
  ['{0E3FDE45-AF77-4B5C-9715-49D594BDF05E}', 'deschis'], // Light Style 1 - Accent 2..6
  ['{C083E6E3-FA7D-4D7B-A595-EF9225AFEA82}', 'deschis'],
  ['{D27102A9-8310-4765-A935-A1911B00CA55}', 'deschis'],
  ['{5FD0F851-EC5A-4D38-B0AD-8093EC10F338}', 'deschis'],
  ['{68D230F3-CF80-4859-8CE7-A43EE81993B5}', 'deschis'],
  ['{5202B0CA-FC54-4496-8BCA-5EF66A818D29}', 'intunecat'], // Dark Style 2
  ['{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}', 'accent'], // Medium Style 2 - Accent 2..6
  ['{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}', 'accent'],
  ['{00A15C55-8517-42AA-B614-E9B94910E393}', 'accent'],
  ['{7DF18680-E054-41AD-8BC1-D1AEF772440D}', 'accent'],
  ['{93296810-A885-4BE3-A3E7-6D5BEEA58F35}', 'accent'],
];

// Stilurile „Accent 2…6” (Light Style 1 și Medium Style 2): al câtelea accent al temei colorează tabelul.
const PPTX_ACCENTS: [string, number][] = [
  ['{0E3FDE45-AF77-4B5C-9715-49D594BDF05E}', 2], ['{C083E6E3-FA7D-4D7B-A595-EF9225AFEA82}', 3], ['{D27102A9-8310-4765-A935-A1911B00CA55}', 4],
  ['{5FD0F851-EC5A-4D38-B0AD-8093EC10F338}', 5], ['{68D230F3-CF80-4859-8CE7-A43EE81993B5}', 6],
  ['{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}', 2], ['{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}', 3], ['{00A15C55-8517-42AA-B614-E9B94910E393}', 4],
  ['{7DF18680-E054-41AD-8BC1-D1AEF772440D}', 5], ['{93296810-A885-4BE3-A3E7-6D5BEEA58F35}', 6],
];

/** Pentru un stil „Accent 2…6”: numele culorii din tema fișierului („accent2”…), altfel nimic (accent 1 = culoarea temei noastre). */
export const pptxAccent = (id: string | null | undefined): string | undefined => {
  const n = PPTX_ACCENTS.find(([g]) => g === (id ?? '').trim().toUpperCase())?.[1];
  return n ? 'accent' + n : undefined;
};

export const pptxStyleId = (s: TableStyle | undefined) => PPTX_IDS.find(([, k]) => k === (s ?? ''))![0];

/** Stilul nostru pentru un a:tableStyleId (lipsă / necunoscut = cel obișnuit). */
export const styleOfPptxId = (id: string | null | undefined): TableStyle | undefined =>
  cleanTStyle(PPTX_IDS.find(([g]) => g.toUpperCase() === (id ?? '').trim().toUpperCase())?.[1]);

// Grosimea liniilor din tabel, în pixeli de slide (lipsă = 1, subțiri) și culoarea lor (lipsă = textul, estompat).
export const TABLE_LINE_WS: [number, string][] = [[1, '─ Linii subțiri'], [2, '━ Linii de 2 px'], [3, '━ Linii de 3 px'], [5, '█ Linii de 5 px']];
export const cleanLineW = (v: unknown): number | undefined => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 2 && n <= 8 ? n : undefined;
};
export const cleanLineC = (v: unknown): string | undefined =>
  typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined;
