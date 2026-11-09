// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { cleanComments } from './comments';
import { cleanM3d, type Model3DKeep } from '../model3d';
import { cleanGuides, type Guides } from './guides';
import { cleanLink } from './links';
import { cleanClip, cleanCrop, Crop, type ClipShape } from './crop';
import { cleanBorder, cleanDir, cleanMerges, cleanPad, type Merge, type TableBorder, type TableDir, type TablePad } from './tableMerge';
import { cleanFx, cleanRot3d, cleanTextFx, cleanTextGrad, type Rot3d, type ShapeFx, type TextFx, type TextGrad } from './fx';
import { cleanWarp, type TextWarp } from './warp';
import { cleanLineC, cleanLineW, cleanTColor, cleanTStyle, type TableStyle } from './tableStyle';
import { cleanSection } from './sections';
import { cleanSlideMacros, type SlideMacro } from './macros';
import { cleanCellFmt, type CellFmtGrid } from './cellFmt';
import { cleanHandoutMaster, cleanNotesMaster, type HandoutMaster, type NotesMaster } from './printMaster';
import { cleanAdj, type ImgAdj } from './adjust';
import { parseIconSpec, type IconSpec } from '../icons/iconLib';
import { docProps, type DocProps } from '../docs/format';
// Formatul prezentărilor (.sslides): JSON cu tema și slide-urile. Fiecare slide are casete poziționate pe o pânză
// logică de 1280 × 720 (16:9); pe ecran, în miniaturi și la prezentare, aceeași pânză doar se micșorează sau se mărește.
export const SLIDE_W = 1280;
export const SLIDE_H = 720;

/** Formatul slide-urilor: lat (prezentări) sau pentru rețele sociale. Pânza are aceleași litere, doar alte proporții;
 *  la export PNG se mărește de 1,5 ori (1080 × 1080 la pătrat, 1080 × 1920 la vertical). */
export type SlideFormat = 'wide' | 'standard' | 'a4' | 'square' | 'portrait' | 'custom';
export interface Size { w: number; h: number }
export const FORMATS: [SlideFormat, string, Size][] = [
  ['wide', 'Lat 16:9 (prezentări)', { w: SLIDE_W, h: SLIDE_H }],
  // 4:3 = 10 × 7,5 inci și hârtie A4 = 10,83 × 7,5 inci, exact ca în PowerPoint (96 px = 1 inci).
  ['standard', 'Standard 4:3 (proiectoare vechi)', { w: 960, h: 720 }],
  ['a4', 'Hârtie A4 (pentru tipărire)', { w: 1040, h: 720 }],
  ['square', 'Pătrat 1:1 (postare)', { w: 720, h: 720 }],
  ['portrait', 'Vertical 9:16 (povești, clipuri scurte)', { w: 720, h: 1280 }],
];
export const sizeOf = (f?: SlideFormat): Size => (FORMATS.find(([id]) => id === f) ?? FORMATS[0])[2];
/** Mărimea proprie: între 1 și 56 de inci pe fiecare latură (2,54–142,24 cm), ca în celelalte programe de prezentări. */
export const MIN_SIDE = 96, MAX_SIDE = 5376;
export const cleanCustomSize = (v: unknown): Size | undefined => {
  const o = v as Partial<Size> | null;
  if (!o || typeof o !== 'object' || typeof o.w !== 'number' || typeof o.h !== 'number' || !Number.isFinite(o.w) || !Number.isFinite(o.h)) return undefined;
  return { w: Math.round(Math.min(MAX_SIDE, Math.max(MIN_SIDE, o.w))), h: Math.round(Math.min(MAX_SIDE, Math.max(MIN_SIDE, o.h))) };
};
export const deckSize = (d: Pick<Deck, 'size' | 'custom'>): Size => (d.size === 'custom' && d.custom ? d.custom : sizeOf(d.size));
/** Formatul pentru o mărime venită din alt fișier: unul de-al nostru dacă are aceleași proporții (±2%), altfel mărimea proprie. */
export function fitFormat(w: number, h: number): Pick<Deck, 'size' | 'custom'> {
  const r = w / h, hit = FORMATS.find(([, , s]) => Math.abs(s.w / s.h / r - 1) < 0.02);
  if (hit) return hit[0] === 'wide' ? {} : { size: hit[0] };
  const c = cleanCustomSize({ w, h });
  return c ? { size: 'custom', custom: c } : {};
}
/** Formatul cel mai apropiat de o mărime din alt program (lățime / înălțime, ±2%); altfel lat (16:9), cu slide-ul centrat. */
export function formatOf(w: number, h: number): SlideFormat {
  const r = w / h;
  return (FORMATS.find(([, , s]) => Math.abs(s.w / s.h / r - 1) < 0.02) ?? FORMATS[0])[0];
}
/** Aspectul clipului făcut din slide-uri (modulul Video). */
export const videoAspect = (s: Size): 'wide' | 'classic' | 'square' | 'portrait' => (s.w === s.h ? 'square' : s.w < s.h ? 'portrait' : s.w / s.h < 1.5 ? 'classic' : 'wide');

export type LayoutId = 'title' | 'content' | 'two' | 'section' | 'blank';
import { cleanInk, type Ink } from './ink';
import { PALETTES, SHEET_CHART_TYPES, type ChartType, type LegendPos } from '../sheets/chartSvg';
/** Graficele de pe slide: toate cele din Sheets, fără cele statistice (histograma și Pareto nu au încă loc în .pptx). */
/** Toate felurile din Sheets (și cascada, pâlnia, histograma…: se desenează din tabelul graficului, ca în Docs). */
export const SLIDE_CHART_TYPES = SHEET_CHART_TYPES;
import { isPath } from './geom';
import { marksAfterEdit, parseMarks, type TextMark } from './marks';

export type ElKind = 'title' | 'subtitle' | 'body' | 'text' | 'image' | 'shape' | 'table' | 'chart' | 'media';
/** Rolul unei forme dintr-o diagramă (vezi SlideEl.dgm). */
export type DiagramRole = 'main' | 'sub' | 'link';
/** Formele: primele trei se desenează cu colțuri, celelalte sunt poligoane (numele sunt cele din PowerPoint, ca la import / export). */
export type ShapeKind = 'rect' | 'round' | 'ellipse' | 'triangle' | 'rtTriangle' | 'diamond' | 'parallelogram' | 'trapezoid' | 'pentagon'
  | 'hexagon' | 'octagon' | 'star5' | 'plus' | 'rightArrow' | 'leftArrow' | 'upArrow' | 'downArrow' | 'leftRightArrow' | 'homePlate' | 'chevron' | 'star4' | 'wedgeRectCallout' | 'heart' | 'cloud' | 'moon' | 'lightningBolt'
  | 'heptagon' | 'decagon' | 'dodecagon' | 'star6' | 'star8' | 'upDownArrow' | 'notchedRightArrow' | 'line'
  | 'star7' | 'star10' | 'star12' | 'quadArrow' | 'snip1Rect' | 'flowChartManualInput' | 'flowChartMerge' | 'flowChartPreparation'
  | 'flowChartDecision' | 'flowChartExtract' | 'flowChartOffpageConnector' | 'flowChartPunchedCard' | 'snip2SameRect' | 'corner' | 'halfFrame' | 'diagStripe'
  | 'flowChartInputOutput' | 'flowChartManualOperation' | 'flowChartCollate' | 'rightArrowCallout' | 'leftArrowCallout' | 'upArrowCallout' | 'downArrowCallout' | 'mathMinus'
  | 'leftRightArrowCallout' | 'upDownArrowCallout' | 'quadArrowCallout' | 'leftUpArrow' | 'bentUpArrow' | 'leftRightUpArrow' | 'mathMultiply'
  | 'star16' | 'star24' | 'star32' | 'snip2DiagRect' | 'irregularSeal1' | 'irregularSeal2' | 'flowChartTerminator' | 'flowChartDelay'
  | 'flowChartDisplay' | 'flowChartDocument' | 'flowChartPunchedTape' | 'teardrop' | 'wave' | 'doubleWave'
  | 'pie' | 'chord' | 'plaque' | 'round1Rect' | 'flowChartOnlineStorage' | 'flowChartMagneticTape'
  | 'flowChartAlternateProcess' | 'flowChartConnector' | 'flowChartMagneticDisk' | 'round2DiagRect' | 'snipRoundRect' | 'pieWedge'
  | 'blockArc' | 'bentArrow' | 'frame' | 'donut' | 'can' | 'cube' | 'foldedCorner' | 'stripedRightArrow'
  | 'flowChartPredefinedProcess' | 'flowChartInternalStorage' | 'flowChartSort' | 'flowChartOr' | 'flowChartSummingJunction'
  | 'flowChartOfflineStorage' | 'flowChartMagneticDrum' | 'bevel' | 'gear6' | 'gear9' | 'uturnArrow' | 'wedgeRoundRectCallout' | 'wedgeEllipseCallout' | 'ribbon' | 'ribbon2' | 'horizontalScroll' | 'verticalScroll' | 'curvedRightArrow' | 'curvedLeftArrow' | 'curvedUpArrow' | 'curvedDownArrow' | 'ellipseRibbon' | 'ellipseRibbon2' | 'sun' | 'noSmoking' | 'smileyFace' | 'mathNotEqual' | 'nonIsoscelesTrapezoid' | 'flowChartMultidocument' | 'funnel' | 'cornerTabs' | 'squareTabs' | 'plaqueTabs' | 'cloudCallout' | 'callout1' | 'callout2' | 'callout3' | 'accentCallout1' | 'accentCallout2' | 'accentCallout3' | 'borderCallout1' | 'borderCallout2' | 'borderCallout3' | 'accentBorderCallout1' | 'accentBorderCallout2' | 'accentBorderCallout3' | 'actionButtonBlank' | 'actionButtonBackPrevious' | 'actionButtonForwardNext' | 'actionButtonBeginning' | 'actionButtonEnd' | 'actionButtonHome' | 'actionButtonInformation' | 'actionButtonDocument' | 'actionButtonSound' | 'actionButtonHelp' | 'actionButtonReturn' | 'actionButtonMovie' | 'leftRightCircularArrow' | 'leftRightRibbon' | 'leftBracket' | 'rightBracket' | 'leftBrace' | 'rightBrace' | 'bracketPair' | 'bracePair' | 'arc' | 'circularArrow' | 'leftCircularArrow' | 'swooshArrow' | 'mathPlus' | 'mathEqual' | 'mathDivide' | 'chartX' | 'chartStar' | 'chartPlus';
export const SHAPES: [ShapeKind, string][] = [['rect', 'Dreptunghi'], ['round', 'Dreptunghi rotunjit'], ['ellipse', 'Elipsă'],
  ['triangle', 'Triunghi'], ['rtTriangle', 'Triunghi dreptunghic'], ['diamond', 'Romb'], ['parallelogram', 'Paralelogram'], ['trapezoid', 'Trapez'],
  ['pentagon', 'Pentagon'], ['hexagon', 'Hexagon'], ['octagon', 'Octogon'], ['star5', 'Stea'], ['plus', 'Cruce'],
  ['rightArrow', 'Săgeată dreapta'], ['leftArrow', 'Săgeată stânga'], ['upArrow', 'Săgeată sus'], ['downArrow', 'Săgeată jos'],
  ['leftRightArrow', 'Săgeată dublă'], ['homePlate', 'Etichetă săgeată'], ['chevron', 'Chevron'], ['star4', 'Stea cu 4 colțuri'], ['wedgeRectCallout', 'Bulă de dialog'],
  ['heart', 'Inimă'], ['cloud', 'Nor'], ['moon', 'Semilună'], ['lightningBolt', 'Fulger'],
  ['heptagon', 'Heptagon'], ['decagon', 'Decagon'], ['dodecagon', 'Dodecagon'], ['star6', 'Stea cu 6 colțuri'], ['star8', 'Stea cu 8 colțuri'],
  ['upDownArrow', 'Săgeată sus-jos'], ['notchedRightArrow', 'Săgeată crestată'],
  ['star7', 'Stea cu 7 colțuri'], ['star10', 'Stea cu 10 colțuri'], ['star12', 'Stea cu 12 colțuri'], ['quadArrow', 'Săgeată în patru direcții'],
  ['snip1Rect', 'Dreptunghi cu colț tăiat'], ['flowChartManualInput', 'Schemă: Intrare manuală'], ['flowChartMerge', 'Schemă: Îmbinare'],
  ['flowChartPreparation', 'Schemă: Pregătire'], ['flowChartDecision', 'Schemă: Decizie'], ['flowChartExtract', 'Schemă: Extragere'],
  ['flowChartOffpageConnector', 'Schemă: Conector în altă pagină'], ['flowChartPunchedCard', 'Schemă: Cartelă'], ['snip2SameRect', 'Dreptunghi cu două colțuri tăiate'],
  ['corner', 'Colț (L)'], ['halfFrame', 'Jumătate de cadru'], ['diagStripe', 'Bandă diagonală'],
  ['flowChartInputOutput', 'Schemă: Date'], ['flowChartManualOperation', 'Schemă: Operație manuală'], ['flowChartCollate', 'Schemă: Colaționare'],
  ['rightArrowCallout', 'Explicație cu săgeată la dreapta'], ['leftArrowCallout', 'Explicație cu săgeată la stânga'], ['upArrowCallout', 'Explicație cu săgeată în sus'],
  ['downArrowCallout', 'Explicație cu săgeată în jos'], ['mathMinus', 'Minus'],
  ['leftRightArrowCallout', 'Explicație cu săgeți stânga-dreapta'], ['upDownArrowCallout', 'Explicație cu săgeți sus-jos'],
  ['quadArrowCallout', 'Explicație cu săgeți în patru direcții'], ['leftUpArrow', 'Săgeată stânga-sus'], ['bentUpArrow', 'Săgeată îndoită în sus'],
  ['leftRightUpArrow', 'Săgeată stânga-dreapta-sus'], ['mathMultiply', 'Înmulțire'],
  ['star16', 'Stea cu 16 colțuri'], ['star24', 'Stea cu 24 de colțuri'], ['star32', 'Stea cu 32 de colțuri'], ['snip2DiagRect', 'Dreptunghi cu colțuri opuse tăiate'],
  ['irregularSeal1', 'Explozie 1'], ['irregularSeal2', 'Explozie 2'], ['flowChartTerminator', 'Schemă: Început / sfârșit'], ['flowChartDelay', 'Schemă: Întârziere'],
  ['flowChartDisplay', 'Schemă: Afișare'], ['flowChartDocument', 'Schemă: Document'], ['flowChartPunchedTape', 'Schemă: Bandă perforată'],
  ['teardrop', 'Lacrimă'], ['wave', 'Val'], ['doubleWave', 'Val dublu'],
  ['pie', 'Felie de cerc'], ['chord', 'Coardă'], ['plaque', 'Placă'], ['round1Rect', 'Dreptunghi cu un colț rotunjit'],
  ['flowChartOnlineStorage', 'Schemă: Date stocate'], ['flowChartMagneticTape', 'Schemă: Acces secvențial'],
  ['flowChartAlternateProcess', 'Schemă: Proces alternativ'], ['flowChartConnector', 'Schemă: Conector'], ['flowChartMagneticDisk', 'Schemă: Disc magnetic'],
  ['round2DiagRect', 'Dreptunghi cu colțuri opuse rotunjite'], ['snipRoundRect', 'Dreptunghi cu un colț tăiat și unul rotunjit'], ['pieWedge', 'Sfert de cerc'],
  ['blockArc', 'Arc gros'], ['bentArrow', 'Săgeată îndoită'], ['frame', 'Cadru'], ['donut', 'Inel'],
  ['can', 'Cilindru'], ['cube', 'Cub'], ['foldedCorner', 'Colț îndoit'], ['stripedRightArrow', 'Săgeată dreapta cu dungi'],
  ['mathPlus', 'Plus'], ['mathEqual', 'Egal'], ['mathDivide', 'Împărțire'],
  ['chartX', 'Dreptunghi cu X'], ['chartPlus', 'Dreptunghi cu plus'], ['chartStar', 'Dreptunghi cu steluță'],
  ['flowChartPredefinedProcess', 'Schemă: Proces predefinit'], ['flowChartInternalStorage', 'Schemă: Memorie internă'], ['flowChartSort', 'Schemă: Sortare'],
  ['flowChartOr', 'Schemă: Sau'], ['flowChartSummingJunction', 'Schemă: Însumare'], ['flowChartOfflineStorage', 'Schemă: Arhivare'],
  ['flowChartMagneticDrum', 'Schemă: Acces direct'], ['bevel', 'Teșitură'],
  ['gear6', 'Roată dințată cu 6 dinți'], ['gear9', 'Roată dințată cu 9 dinți'], ['uturnArrow', 'Săgeată în U'],
  ['wedgeRoundRectCallout', 'Bulă de dialog rotunjită'], ['wedgeEllipseCallout', 'Bulă de dialog ovală'],
  ['ribbon', 'Panglică cu capetele în jos'], ['ribbon2', 'Panglică cu capetele în sus'],
  ['horizontalScroll', 'Sul orizontal'], ['verticalScroll', 'Sul vertical'],
  ['curvedRightArrow', 'Săgeată curbată spre dreapta'], ['curvedLeftArrow', 'Săgeată curbată spre stânga'],
  ['curvedUpArrow', 'Săgeată curbată în sus'], ['curvedDownArrow', 'Săgeată curbată în jos'],
  ['ellipseRibbon', 'Panglică curbată cu capetele în jos'], ['ellipseRibbon2', 'Panglică curbată cu capetele în sus'],
  ['sun', 'Soare'], ['noSmoking', 'Semn de interdicție'],
  ['circularArrow', 'Săgeată circulară'], ['leftCircularArrow', 'Săgeată circulară spre stânga'], ['leftRightCircularArrow', 'Săgeată circulară dublă'], ['leftRightRibbon', 'Panglică stânga-dreapta'], ['swooshArrow', 'Săgeată arcuită'], ['smileyFace', 'Față zâmbitoare'],
  ['mathNotEqual', 'Diferit'], ['nonIsoscelesTrapezoid', 'Trapez oarecare'], ['flowChartMultidocument', 'Schemă: Mai multe documente'],
  ['funnel', 'Pâlnie'], ['cornerTabs', 'Colțuri triunghiulare'], ['squareTabs', 'Colțuri pătrate'], ['plaqueTabs', 'Colțuri rotunde'], ['cloudCallout', 'Bulă de gândire'],
  ['callout1', 'Explicație cu linie'], ['callout2', 'Explicație cu linie frântă'], ['callout3', 'Explicație cu linie frântă de două ori'], ['accentCallout1', 'Explicație cu linie și bară'], ['accentCallout2', 'Explicație cu linie frântă și bară'], ['accentCallout3', 'Explicație cu linie frântă de două ori și bară'], ['borderCallout1', 'Explicație cu linie și chenar'], ['borderCallout2', 'Explicație cu linie frântă și chenar'], ['borderCallout3', 'Explicație cu linie frântă de două ori și chenar'], ['accentBorderCallout1', 'Explicație cu linie, bară și chenar'], ['accentBorderCallout2', 'Explicație cu linie frântă, bară și chenar'], ['accentBorderCallout3', 'Explicație cu linie frântă de două ori, bară și chenar'],
  ['actionButtonBlank', 'Buton de acțiune: Gol'], ['actionButtonBackPrevious', 'Buton de acțiune: Înapoi'], ['actionButtonForwardNext', 'Buton de acțiune: Înainte'], ['actionButtonBeginning', 'Buton de acțiune: Început'], ['actionButtonEnd', 'Buton de acțiune: Sfârșit'],
  ['actionButtonHome', 'Buton de acțiune: Acasă'], ['actionButtonInformation', 'Buton de acțiune: Informații'], ['actionButtonDocument', 'Buton de acțiune: Document'], ['actionButtonSound', 'Buton de acțiune: Sunet'],
  ['actionButtonHelp', 'Buton de acțiune: Ajutor'], ['actionButtonReturn', 'Buton de acțiune: Întoarcere'], ['actionButtonMovie', 'Buton de acțiune: Film'],
  ['leftBracket', 'Paranteză stânga'], ['rightBracket', 'Paranteză dreapta'], ['leftBrace', 'Acoladă stânga'], ['rightBrace', 'Acoladă dreapta'], ['bracketPair', 'Paranteze'], ['bracePair', 'Acolade'], ['arc', 'Arc'], ['line', 'Linie']];
/** Linia (Lines din PowerPoint): merge din colțul stânga-sus al casetei în cel dreapta-jos (oglindirea o întoarce);
 *  caseta poate avea lățimea sau înălțimea 0 (linie orizontală / verticală). */
export const isLine = (e: Pick<SlideEl, 'kind' | 'shape'>) => e.kind === 'shape' && e.shape === 'line';
/** Săgețile de la capetele liniei: 'end' = la capăt (unde ajunge linia), 'start' = la început, 'both' = la amândouă. */
export type LineEnds = 'end' | 'start' | 'both';
/** Traseul liniei: lipsă = dreaptă; 'elbow' = frântă în unghi drept (orizontal, vertical, orizontal), 'curve' = curbată în S. */
export type LineRoute = 'elbow' | 'curve';
export const LINE_ROUTES: [LineRoute | '', string][] = [['', '╲ Linie dreaptă'], ['elbow', '┐ Conector frânt'], ['curve', '∿ Conector curbat']];
export type LineAxes = 'hv' | 'vh' | 'vv';
export const LINE_ENDS: [LineEnds | '', string][] = [['', '— Fără săgeți'], ['end', '→ Săgeată la capăt'], ['start', '← Săgeată la început'], ['both', '↔ Săgeți la ambele capete']];
/** Punctele (0…1) întinse pe toată caseta și scrise în procente, pentru clip-path: polygon. */
function fitPct(pts: [number, number][]): string {
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 || 1, h = Math.max(...ys) - y0 || 1;
  return pts.map(([x, y]) => `${+((x - x0) / w * 100).toFixed(1)}% ${+((y - y0) / h * 100).toFixed(1)}%`).join(',');
}
const TAU = 2 * Math.PI;
/** Inima: curba x = 16 sin³t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t (cu vârful în jos), în 48 de puncte. */
const HEART = fitPct(Array.from({ length: 48 }, (_, i): [number, number] => {
  const t = (i / 48) * TAU;
  return [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
}));
/** Norul: o elipsă cu 9 umflături (fiecare un arc în afară), în 90 de puncte. */
const CLOUD = fitPct(Array.from({ length: 90 }, (_, i): [number, number] => {
  const t = (i / 90) * TAU, u = (i % 10) / 10;
  const k = 1 + 0.16 * Math.sin(Math.PI * u);
  return [Math.cos(t) * 0.5 * k, Math.sin(t) * 0.38 * k];
}));
/** Semiluna: arcul mare din stânga (de jos până sus), apoi cel mic înapoi, cu deschiderea spre dreapta. */
const MOON = fitPct([
  ...Array.from({ length: 25 }, (_, i): [number, number] => { const a = Math.PI / 2 + (i / 24) * Math.PI; return [1 + Math.cos(a), 0.5 + 0.5 * Math.sin(a)]; }),
  ...Array.from({ length: 23 }, (_, i): [number, number] => { const a = (3 * Math.PI) / 2 - ((i + 1) / 24) * Math.PI; return [1 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]; }),
]);
/** Steaua cu n colțuri, cu vârful sus și vârfurile interioare la `inner` din rază (ajustarea obișnuită din .pptx, adj / 50000). */
const star = (n: number, inner: number) => fitPct(Array.from({ length: 2 * n }, (_, i): [number, number] => {
  const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? inner : 1;
  return [r * Math.cos(a), r * Math.sin(a)];
}));
/** Punctele date pe o pânză W × H, scrise în procente (fără întindere pe casetă, ca la formele care ies puțin din ea). */
const onGrid = (pts: [number, number][], W = 1, H = W) => pts.map(([x, y]) => {
  const p = (v: number) => { const r = +Math.min(100, Math.max(0, v * 100)).toFixed(1); return r ? r + '%' : '0'; };
  return p(x / W) + ' ' + p(y / H);
}).join(',');
/** n + 1 puncte pe o curbă dată prin t de la 0 la 1. */
const along = (n: number, f: (t: number) => [number, number]) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
/** Arc de elipsă (centru, raze), de la unghiul a la b, în radiani (y în jos, deci π/2 = jos). */
const arc = (cx: number, cy: number, rx: number, ry: number, a: number, b: number, n = 16) =>
  along(n, (t) => { const u = a + (b - a) * t; return [cx + rx * Math.cos(u), cy + ry * Math.sin(u)]; });
/** Roata dințată: n dinți cu vârful sus, înălțimea dintelui h (din rază), dintele mai lat la bază decât la vârf, arce între dinți. */
const gear = (n: number, h: number) => {
  const step = TAU / n, base = step * 0.22, top = step * 0.15, rIn = 0.5 - h;
  const pt = (r: number, u: number): [number, number] => [0.5 + r * Math.cos(u), 0.5 + r * Math.sin(u)];
  return onGrid(Array.from({ length: n }, (_, i) => {
    const u = -Math.PI / 2 + i * step;
    return [pt(0.5, u - top), pt(0.5, u + top), ...arc(0.5, 0.5, rIn, rIn, u + base, u + step - base, 6)];
  }).flat());
};
/** Panglica (capetele în jos, ca ribbon din .pptx): mijlocul lat cât jumătate din casetă, sus; capetele cu crestătură, coborâte cu 1/6;
 *  sub mijloc se vede îndoitura (triunghiul dintre capăt și mijloc), cu linia ei desenată de contur. „up” o întoarce (ribbon2). */
const ribbonShape = (up: boolean, curved = false) => {
  const a = 1 / 6;
  const pts: [number, number][] = [[0, a], [0.25, a], [0.25, 0], [0.75, 0], [0.75, a], [1, a], [0.875, (1 + a) / 2], [1, 1], [0.875, 1], [0.75, 1],
    [0.75, 1 - a], [0.875, 1], [0.75, 1 - a], [0.25, 1 - a], [0.125, 1], [0.25, 1 - a], [0.25, 1], [0.125, 1], [0, 1], [0.125, (1 + a) / 2]];
  const flat = up ? pts.map(([x, y]): [number, number] => [x, 1 - y]) : pts;
  if (!curved) return onGrid(flat);
  // Panglica curbată (ellipseRibbon / ellipseRibbon2): fiecare latură împărțită în 8, apoi îndoită în arc cu 1/4 din înălțime:
  // în jos mijlocul rămâne sus și capetele coboară, în sus invers.
  const k = 0.25, bow = (x: number) => 4 * (x - 0.5) ** 2;
  const dense = flat.flatMap(([x, y], i) => { const [u, v] = flat[(i + 1) % flat.length]; return along(8, (t): [number, number] => [x + (u - x) * t, y + (v - y) * t]).slice(0, -1); });
  return onGrid(dense.map(([x, y]) => [x, y * (1 - k) + k * (up ? 1 - bow(x) : bow(x))]));
};
/** Sulul (horizontalScroll din .pptx): foaia, cu marginea de sus rulată spre dreapta și cea de jos spre stânga (rulourile groase de 1/8);
 *  marginea interioară a rulourilor e desenată de contur. „vertical” îl întoarce pe diagonală (rulourile în stânga și în dreapta). */
const scrollShape = (vertical: boolean) => {
  const r = 1 / 16, d = 2 * r;
  const pts: [number, number][] = [[r, r], ...arc(d, r, r, r, Math.PI, 1.5 * Math.PI, 6).slice(1), [1 - r, 0], ...arc(1 - r, r, r, r, -Math.PI / 2, Math.PI / 2, 8).slice(1),
    [d, d], [1 - r, d], [1 - r, 1 - r], ...arc(1 - d, 1 - r, r, r, 0, Math.PI / 2, 6).slice(1), [r, 1], ...arc(r, 1 - r, r, r, Math.PI / 2, 1.5 * Math.PI, 8).slice(1),
    [1 - d, 1 - d], [r, 1 - d]];
  return onGrid(vertical ? pts.map(([x, y]) => [y, x]) : pts);
};
/** Săgeata curbată (curvedRightArrow din .pptx): o bandă de 1/5 care pleacă din colțul din dreapta-sus, ocolește prin stânga
 *  și se termină jos în vârful spre dreapta (lung de 1/4). Celelalte trei sunt aceeași săgeată oglindită / întoarsă pe diagonală. */
const curvedArrow = (dir: 'right' | 'left' | 'up' | 'down') => {
  const pts: [number, number][] = [[1, 0], ...arc(0.75, 0.425, 0.75, 0.425, -Math.PI / 2, -1.5 * Math.PI, 24), [0.75, 0.95], [1, 0.75], [0.75, 0.55],
    ...arc(0.75, 0.425, 0.55, 0.225, Math.PI / 2, 1.5 * Math.PI, 20), [1, 0.2]];
  const t: Record<typeof dir, (p: [number, number]) => [number, number]> = {
    right: (p) => p, left: ([x, y]) => [1 - x, y], down: ([x, y]) => [y, x], up: ([x, y]) => [y, 1 - x] };
  return onGrid(pts.map(t[dir]));
};
/** Soarele: discul din mijloc (raza 1/4) și 8 raze triunghiulare, desprinse de disc; fiecare rază e legată de disc printr-o tăietură fără lățime. */
const sunShape = () => {
  const rc = 0.25, rb = 0.33, b = 0.16;
  const at = (r: number, u: number): [number, number] => [0.5 + r * Math.cos(u), 0.5 + r * Math.sin(u)];
  return onGrid(Array.from({ length: 8 }, (_, k) => {
    const u = (k * Math.PI) / 4;
    return [at(rc, u), at(rb, u), at(rb, u - b), at(0.5, u), at(rb, u + b), at(rb, u), ...arc(0.5, 0.5, rc, rc, u, u + Math.PI / 4, 6).slice(0, -1)];
  }).flat());
};
/** Semnul de interdicție (noSmoking din .pptx): inelul gros de 3/16 și bara pe diagonală (din stânga-sus în dreapta-jos), la fel de groasă;
 *  cele două jumătăți ale găurii sunt parcurse invers, legate de cercul mare prin tăieturi fără lățime. */
const noSmokingShape = () => {
  const r = 0.5 - 0.1875, hw = 0.1875 / 2, al = Math.acos(hw / r), q = Math.PI / 4;
  const hole = (m: number): [number, number][] => [[0.5 + 0.5 * Math.cos(m), 0.5 + 0.5 * Math.sin(m)], ...arc(0.5, 0.5, r, r, m, m - al, 8),
    ...arc(0.5, 0.5, r, r, m + al, m, 8), [0.5 + 0.5 * Math.cos(m), 0.5 + 0.5 * Math.sin(m)]];
  return onGrid([...arc(0.5, 0.5, 0.5, 0.5, -q, 3 * q, 24), ...hole(3 * q), ...arc(0.5, 0.5, 0.5, 0.5, 3 * q, 7 * q, 24).slice(1), ...hole(7 * q).slice(1)]);
};
/** Săgeata circulară (circularArrow din .pptx): o jumătate de inel (de la stânga, peste sus, până la dreapta), groasă de 1/8,
 *  cu vârful lat cât dublul benzii, întors în jos; totul întins pe toată caseta. „left” o oglindește (leftCircularArrow). */
const circularArrowShape = (left: boolean) => {
  const ro = 0.42, ri = 0.295, rm = (ro + ri) / 2, h = 0.125;
  const at = (r: number, u: number): [number, number] => [0.5 + r * Math.cos(u), 0.5 + r * Math.sin(u)];
  const pts: [number, number][] = [...arc(0.5, 0.5, ro, ro, Math.PI, 2 * Math.PI, 24), at(rm + h, 0), at(rm, 0.45), at(rm - h, 0), ...arc(0.5, 0.5, ri, ri, 2 * Math.PI, Math.PI, 20)];
  const xs = pts.map(([x]) => x), ys = pts.map(([, y]) => y), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, hh = Math.max(...ys) - y0;
  return onGrid(pts.map(([x, y]) => [left ? 1 - (x - x0) / w : (x - x0) / w, (y - y0) / hh]));
};
/** Săgeata circulară dublă (leftRightCircularArrow din .pptx): aceeași jumătate de inel, cu câte un vârf întors în jos la ambele capete. */
const leftRightCircularArrowShape = () => {
  const ro = 0.42, ri = 0.295, rm = (ro + ri) / 2, h = 0.125;
  const at = (r: number, u: number): [number, number] => [0.5 + r * Math.cos(u), 0.5 + r * Math.sin(u)];
  const pts: [number, number][] = [at(rm + h, Math.PI), ...arc(0.5, 0.5, ro, ro, Math.PI, 2 * Math.PI, 24), at(rm + h, 0), at(rm, 0.45), at(rm - h, 0),
    ...arc(0.5, 0.5, ri, ri, 2 * Math.PI, Math.PI, 20), at(rm - h, Math.PI), at(rm, Math.PI - 0.45)];
  const xs = pts.map(([x]) => x), ys = pts.map(([, y]) => y), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, hh = Math.max(...ys) - y0;
  return onGrid(pts.map(([x, y]) => [(x - x0) / w, (y - y0) / hh]));
};
/** Panglica stânga-dreapta (leftRightRibbon din .pptx): banda (groasă cât 3/5 din înălțime) e jos în stânga și sus în dreapta,
 *  trecând pe la mijloc; capetele sunt ascuțite, spre afară. */
const leftRightRibbonShape = () => onGrid([[0, 0.7], [0.12, 0.4], [0.42, 0.4], [0.42, 0], [0.88, 0], [1, 0.3], [0.88, 0.6], [0.58, 0.6], [0.58, 1], [0.12, 1]]);
/** Curba de gradul doi (a → b, trasă de c), în n + 1 puncte. */
const quad = (a: [number, number], c: [number, number], b: [number, number], n = 16) =>
  along(n, (t): [number, number] => [(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]]);
/** Fața zâmbitoare (smileyFace din .pptx): cercul plin cu ochii și gura ca găuri (parcurse invers), legate de vârful cercului
 *  prin tăieturi fără lățime; gura e o semilună între două arce de rază 0,3 cu centrele la 0,42 și 0,35. */
const smileyShape = () => {
  const top: [number, number] = [0.5, 0], d = Math.PI / 2, m0 = (25 * Math.PI) / 180, m1 = Math.PI - m0;
  const eye = (cx: number): [number, number][] => [top, ...arc(cx, 0.36, 0.06, 0.06, -d, -d - TAU, 16), top];
  const mouth: [number, number][] = [top, ...arc(0.5, 0.35, 0.3, 0.3, d, m1, 8), ...arc(0.5, 0.42, 0.3, 0.3, m1, m0, 16),
    ...arc(0.5, 0.35, 0.3, 0.3, m0, d, 8), top];
  return onGrid([...arc(0.5, 0.5, 0.5, 0.5, -d, -d + TAU, 48), ...eye(0.33), ...eye(0.67), ...mouth]);
};
/** Documentul (schemă) pe pânza de 21600: colțurile de sus și marginea de jos curbă (Bézier), închis înapoi în colțul stânga-sus. */
const docPts = (x0: number, y0: number, w: number, h: number): [number, number][] => [[x0, y0], [x0 + w, y0], ...along(24, (t): [number, number] => {
  const b = (p0: number, p1: number, p2: number, p3: number) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
  return [x0 + (w * b(21600, 10800, 10800, 0)) / 21600, y0 + (h * b(17322, 17322, 23922, 20172)) / 21600];
}), [x0, y0]];
/** Mai multe documente: trei documente suprapuse, decalate cu 1/12 spre dreapta-sus; se unesc (regula nonzero),
 *  legate prin tăieturi fără lățime pe aceeași diagonală dintre colțurile lor stânga-sus. */
const multiDocShape = () => { const o = 1800, w = 21600 - 2 * o; return onGrid([...docPts(0, 2 * o, w, w), ...docPts(o, o, w, w), ...docPts(2 * o, 0, w, w)], 21600); };
/** Diferit (≠): cele două bare ale semnului Egal și bara oblică (ca „/”, la 70° față de orizontală), toate parcurse în același sens,
 *  deci se unesc; legate prin tăieturi fără lățime. */
const notEqualShape = () => {
  const bars: [number, number][] = [[13.26, 20.6], [86.74, 20.6], [86.74, 44.12], [13.26, 44.12], [13.26, 20.6], [13.26, 55.88], [86.74, 55.88], [86.74, 79.4], [13.26, 79.4], [13.26, 55.88], [13.26, 20.6]];
  const dx = 50 / Math.tan((70 * Math.PI) / 180), hw = 23.52 / 2 / Math.sin((70 * Math.PI) / 180);
  const slash: [number, number][] = [[50 + dx - hw, 0], [50 + dx + hw, 0], [50 - dx + hw, 100], [50 - dx - hw, 100], [50 + dx - hw, 0]];
  return onGrid([...slash, ...bars], 100);
};
/** Pâlnia: buza de sus e o elipsă (cu gura ca gaură, parcursă invers), laturile coboară spre fundul mic și rotunjit. */
const funnelShape = () => onGrid([...arc(0.5, 0.125, 0.5, 0.125, Math.PI, TAU, 24), ...arc(0.5, 0.92, 0.1, 0.08, 0, Math.PI, 12),
  ...arc(0.5, 0.125, 0.45, 0.085, Math.PI, -Math.PI, 32)]);
/** Cele patru bucăți din colțuri (latura d din casetă), legate prin tăieturi fără lățime pe marginea casetei, parcurse dus-întors. */
const cornerPieces = (piece: (d: number) => [number, number][], d = 0.1) => {
  const at = (fx: boolean, fy: boolean) => {
    const p = piece(d).map(([x, y]): [number, number] => [fx ? 1 - x : x, fy ? 1 - y : y]);
    return fx !== fy ? [p[0], ...p.slice(1).reverse()] : p; // oglindită o singură dată: parcursă invers, ca toate să aibă același sens
  };
  return onGrid([...at(false, false), [0, 0], [1, 0], ...at(true, false), [1, 0], [1, 1], ...at(true, true), [1, 1], [0, 1],
    ...at(false, true), [0, 1], [1, 1], [1, 0]]);
};
/** Bula de gândire (cloudCallout din .pptx): norul în dreapta-sus (85% × 80% din casetă) și trei bulițe tot mai mici spre colțul
 *  stânga-jos (în .pptx bulițele ies din casetă; aici rămân în ea, ca la bulele de dialog), legate de nor prin tăieturi fără lățime. */
const cloudCalloutShape = () => {
  const raw = Array.from({ length: 90 }, (_, i): [number, number] => {
    const t = (i / 90) * TAU, k = 1 + 0.16 * Math.sin(Math.PI * ((i % 10) / 10));
    return [Math.cos(t) * 0.5 * k, Math.sin(t) * 0.38 * k];
  });
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const c = raw.map(([x, y]): [number, number] => [0.15 + (0.85 * (x - x0)) / (x1 - x0), (0.8 * (y - y0)) / (y1 - y0)]);
  const s = 34, start = c[s]; // punctul norului dinspre stânga-jos
  const bub = (cx: number, cy: number, r: number) => [...arc(cx, cy, r, r, (-3 * Math.PI) / 4, (-3 * Math.PI) / 4 + TAU, 16), start];
  return onGrid([...c.slice(s), ...c.slice(0, s), start, ...bub(0.22, 0.84, 0.06), ...bub(0.11, 0.93, 0.04), ...bub(0.04, 0.975, 0.022)]);
};
/** Explicațiile cu linie (callout1–3, cu bară / chenar): caseta și linia de legătură cu pozițiile implicite din .pptx (în procente din casetă,
 *  linia iese spre stânga-jos); totul e strâns în casetă, iar linia (și bara) sunt benzi subțiri, toate în același sens, legate de colțul casetei. */
const LINE_CALLOUT: Record<1 | 2 | 3, [number, number][]> = {
  1: [[-8.333, 18.75], [-38.333, 112.5]],
  2: [[-8.333, 18.75], [-16.667, 18.75], [-46.667, 112.5]],
  3: [[-8.333, 18.75], [-16.667, 18.75], [-16.667, 100], [-8.333, 112.963]],
};
const lineCallout = (n: 1 | 2 | 3, accent: boolean) => {
  const pts = LINE_CALLOUT[n], all: [number, number][] = [[0, 0], [100, 100], ...pts];
  const x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0])), y0 = Math.min(...all.map((p) => p[1])), y1 = Math.max(...all.map((p) => p[1]));
  const N = ([x, y]: [number, number]): [number, number] => [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)];
  const area = (q: [number, number][]) => q.reduce((s, [x, y], i) => { const [u, v] = q[(i + 1) % q.length]; return s + x * v - u * y; }, 0);
  const bar = (a: [number, number], b: [number, number]): [number, number][] => {
    const [ax, ay] = N(a), [bx, by] = N(b), l = Math.hypot(bx - ax, by - ay) || 1, t = 0.007, nx = (-(by - ay) / l) * t, ny = ((bx - ax) / l) * t;
    const q: [number, number][] = [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
    const r = area(q) < 0 ? [...q].reverse() : q;
    return [...r, r[0]];
  };
  const box: [number, number][] = [N([0, 0]), N([100, 0]), N([100, 100]), N([0, 100]), N([0, 0])];
  const bars = pts.slice(1).map((p, i) => bar(pts[i], p));
  if (accent) bars.push(bar([pts[0][0], 0], [pts[0][0], 100]));
  return onGrid([...box, ...bars.flatMap((b) => [...b, box[0]])]);
};
/** Butoanele de acțiune (Înainte, Înapoi, Acasă…): pătratul cu semnul ca gaură (parcursă invers), legat de colțul stânga-sus
 *  printr-o tăietură fără lățime; semnul ocupă jumătatea din mijloc. O bucată dată ca { solid } e plină din nou (litera „i” din cerc). */
const actionButton = (...holes: ([number, number][] | { solid: [number, number][] })[]) => {
  const area = (q: [number, number][]) => q.reduce((s, [x, y], i) => { const [u, v] = q[(i + 1) % q.length]; return s + x * v - u * y; }, 0);
  return onGrid([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0], ...holes.flatMap((p) => {
    const h = Array.isArray(p) ? p : p.solid, r = (area(h) > 0) === Array.isArray(p) ? [...h].reverse() : h;
    return [...r, r[0], [0, 0] as [number, number]];
  })]);
};
/** Valul: marginea de sus și cea de jos sunt aceeași undă (k perioade, amplitudinea a din înălțime), jos parcursă înapoi. */
const waveShape = (k: number, a: number) => onGrid([
  ...along(32, (t): [number, number] => [t, a - a * Math.sin(TAU * k * t)]),
  ...along(32, (t): [number, number] => [1 - t, 1 - a - a * Math.sin(TAU * k * (1 - t))]),
]);
/** Formele deschise (paranteze, acolade, arc): doar o linie, fără umplere, ca traseu SVG între 0 și 1. Se desenează cu conturul
 *  formei sau, fără contur, cu culoarea ei. Colțurile sunt sferturi de elipsă (k = 0,448 din rază pentru punctele de control). */
const bracket = (c: number) => `M1 0 C0.448 0 0 ${+(c * 0.448).toFixed(3)} 0 ${c} L0 ${1 - c} C0 ${+(1 - c * 0.448).toFixed(3)} 0.448 1 1 1`;
const brace = (c: number) => `M1 0 C0.724 0 0.5 ${+(c * 0.448).toFixed(3)} 0.5 ${c} L0.5 ${0.5 - c} C0.5 ${+(0.5 - c * 0.448).toFixed(3)} 0.276 0.5 0 0.5`
  + ` C0.276 0.5 0.5 ${+(0.5 + c * 0.448).toFixed(3)} 0.5 ${0.5 + c} L0.5 ${1 - c} C0.5 ${+(1 - c * 0.448).toFixed(3)} 0.724 1 1 1`;
/** Oglindirea stânga-dreapta a unui traseu (doar M, L, C). */
const mirrorX = (d: string) => d.replace(/([MLC])([^MLC]*)/g, (_, c: string, n: string) => c + n.trim().split(' ').map((v, i) => (i % 2 ? v : +(1 - +v).toFixed(3))).join(' ') + ' ').trim();
const shrinkX = (d: string, x0: number, w: number) => d.replace(/([MLC])([^MLC]*)/g, (_, c: string, n: string) => c + n.trim().split(' ').map((v, i) => (i % 2 ? v : +(x0 + +v * w).toFixed(3))).join(' ') + ' ').trim();
export const OPEN_PATHS: Partial<Record<ShapeKind, string>> = {
  leftBracket: bracket(0.05), rightBracket: mirrorX(bracket(0.05)),
  leftBrace: brace(0.05), rightBrace: mirrorX(brace(0.05)),
  bracketPair: shrinkX(bracket(0.1), 0, 0.1) + ' ' + mirrorX(shrinkX(bracket(0.1), 0, 0.1)),
  bracePair: shrinkX(brace(0.05), 0, 0.1) + ' ' + mirrorX(shrinkX(brace(0.05), 0, 0.1)),
  // Arcul din programele de prezentări: sfertul de elipsă de sus până în dreapta.
  arc: 'M0.5 0 C0.776 0 1 0.224 1 0.5',
};
/** Conturul poligoanelor, în procente din casetă (pentru clip-path: polygon). */
export const POLYGONS: Partial<Record<ShapeKind, string>> = {
  triangle: '50% 0,100% 100%,0 100%',
  rtTriangle: '0 0,100% 100%,0 100%',
  diamond: '50% 0,100% 50%,50% 100%,0 50%',
  parallelogram: '25% 0,100% 0,75% 100%,0 100%',
  trapezoid: '25% 0,75% 0,100% 100%,0 100%',
  pentagon: '50% 0,100% 38%,81% 100%,19% 100%,0 38%',
  hexagon: '25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%',
  octagon: '29% 0,71% 0,100% 29%,100% 71%,71% 100%,29% 100%,0 71%,0 29%',
  star5: '50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%',
  plus: '35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%',
  rightArrow: '0 25%,60% 25%,60% 0,100% 50%,60% 100%,60% 75%,0 75%',
  leftArrow: '100% 25%,40% 25%,40% 0,0 50%,40% 100%,40% 75%,100% 75%',
  upArrow: '25% 100%,25% 40%,0 40%,50% 0,100% 40%,75% 40%,75% 100%',
  downArrow: '25% 0,25% 60%,0 60%,50% 100%,100% 60%,75% 60%,75% 0',
  leftRightArrow: '0 50%,20% 0,20% 25%,80% 25%,80% 0,100% 50%,80% 100%,80% 75%,20% 75%,20% 100%',
  homePlate: '0 0,80% 0,100% 50%,80% 100%,0 100%',
  chevron: '0 0,75% 0,100% 50%,75% 100%,0 100%,25% 50%',
  // Steaua cu 4 colțuri, cu vârfurile interioare la un sfert din rază (ca star4 din .pptx, cu ajustarea obișnuită).
  star4: '50% 0,62.5% 37.5%,100% 50%,62.5% 62.5%,50% 100%,37.5% 62.5%,0 50%,37.5% 37.5%',
  // Bula de dialog: dreptunghiul pe trei sferturi din casetă, cu „coada” în jos-stânga, în casetă (în .pptx se scrie ca formă liberă).
  wedgeRectCallout: '0 0,100% 0,100% 75%,42% 75%,18% 100%,26% 75%,0 75%',
  // Inima, norul și semiluna sunt curbe, aproximate cu multe puncte; în .pptx se scriu cu forma cu același nume.
  heart: HEART,
  cloud: CLOUD,
  moon: MOON,
  // Fulgerul: o linie frântă de sus din stânga până jos în dreapta.
  lightningBolt: '39% 0,0 18%,35% 39%,23% 45%,57% 64%,46% 69%,100% 100%,68% 60%,77% 56%,51% 32%,59% 28%',
  // Poligoanele regulate, întinse pe casetă: heptagonul cu vârful sus, decagonul și dodecagonul cu latura de sus dreaptă.
  heptagon: '50% 0,90.1% 19.8%,100% 64.3%,72.3% 100%,27.7% 100%,0 64.3%,9.9% 19.8%',
  decagon: '0 50%,9.5% 19.1%,34.5% 0,65.5% 0,90.5% 19.1%,100% 50%,90.5% 80.9%,65.5% 100%,34.5% 100%,9.5% 80.9%',
  dodecagon: '0 36.6%,13.4% 13.4%,36.6% 0,63.4% 0,86.6% 13.4%,100% 36.6%,100% 63.4%,86.6% 86.6%,63.4% 100%,36.6% 100%,13.4% 86.6%,0 63.4%',
  // Stelele cu vârfurile interioare ca ajustarea obișnuită din .pptx (6 colțuri: 0,577 din rază; 8 colțuri: 0,765).
  star6: '50% 0,66.7% 25%,100% 25%,83.3% 50%,100% 75%,66.7% 75%,50% 100%,33.3% 75%,0 75%,16.7% 50%,0 25%,33.3% 25%',
  star8: '50% 0,64.6% 14.7%,85.4% 14.6%,85.3% 35.4%,100% 50%,85.3% 64.6%,85.4% 85.4%,64.6% 85.3%,50% 100%,35.4% 85.3%,14.6% 85.4%,14.7% 64.6%,0 50%,14.7% 35.4%,14.6% 14.6%,35.4% 14.7%',
  upDownArrow: '50% 0,100% 30%,75% 30%,75% 70%,100% 70%,50% 100%,0 70%,25% 70%,25% 30%,0 30%',
  notchedRightArrow: '0 25%,60% 25%,60% 0,100% 50%,60% 100%,60% 75%,0 75%,15% 50%',
  // 28.10: stelele cu 7, 10 și 12 colțuri (ajustările din .pptx: 34601, 42533, 37500), săgeata în patru direcții,
  // dreptunghiul cu colțul din dreapta-sus tăiat și trei forme din schemele logice.
  star7: star(7, 0.692),
  star10: star(10, 0.851),
  star12: star(12, 0.75),
  quadArrow: '50% 0,72.5% 22.5%,61.25% 22.5%,61.25% 38.75%,77.5% 38.75%,77.5% 27.5%,100% 50%,77.5% 72.5%,77.5% 61.25%,61.25% 61.25%,61.25% 77.5%,72.5% 77.5%,50% 100%,27.5% 77.5%,38.75% 77.5%,38.75% 61.25%,22.5% 61.25%,22.5% 72.5%,0 50%,22.5% 27.5%,22.5% 38.75%,38.75% 38.75%,38.75% 22.5%,27.5% 22.5%',
  snip1Rect: '0 0,83.3% 0,100% 16.7%,100% 100%,0 100%',
  flowChartManualInput: '0 20%,100% 0,100% 100%,0 100%',
  flowChartMerge: '0 0,100% 0,50% 100%',
  flowChartPreparation: '20% 0,80% 0,100% 50%,80% 100%,20% 100%,0 50%',
  // 29.10: încă patru din schemele logice și patru cadre, cu ajustările obișnuite din .pptx (colț 50%, jumătate de cadru 33%, bandă 50%).
  flowChartDecision: '50% 0,100% 50%,50% 100%,0 50%',
  flowChartExtract: '50% 0,100% 100%,0 100%',
  flowChartOffpageConnector: '0 0,100% 0,100% 80%,50% 100%,0 80%',
  flowChartPunchedCard: '20% 0,100% 0,100% 100%,0 100%,0 20%',
  snip2SameRect: '16.7% 0,83.3% 0,100% 16.7%,100% 100%,0 100%,0 16.7%',
  corner: '0 0,50% 0,50% 50%,100% 50%,100% 100%,0 100%',
  halfFrame: '0 0,100% 0,66.7% 33.3%,33.3% 33.3%,33.3% 66.7%,0 100%',
  diagStripe: '0 50%,50% 0,100% 0,0 100%',
  // 29.10: încă trei scheme logice, explicațiile cu săgeată (caseta 65%, vârful 25% din latură, coada 25%) și minusul, cu ajustările obișnuite.
  flowChartInputOutput: '20% 0,100% 0,80% 100%,0 100%',
  flowChartManualOperation: '0 0,100% 0,80% 100%,20% 100%',
  flowChartCollate: '0 0,100% 0,0 100%,100% 100%',
  rightArrowCallout: '0 0,65% 0,65% 37.5%,75% 37.5%,75% 25%,100% 50%,75% 75%,75% 62.5%,65% 62.5%,65% 100%,0 100%',
  leftArrowCallout: '35% 0,100% 0,100% 100%,35% 100%,35% 62.5%,25% 62.5%,25% 75%,0 50%,25% 25%,25% 37.5%,35% 37.5%',
  upArrowCallout: '0 35%,37.5% 35%,37.5% 25%,25% 25%,50% 0,75% 25%,62.5% 25%,62.5% 35%,100% 35%,100% 100%,0 100%',
  downArrowCallout: '0 0,100% 0,100% 65%,62.5% 65%,62.5% 75%,75% 75%,50% 100%,25% 75%,37.5% 75%,37.5% 65%,0 65%',
  mathMinus: '13.26% 38.24%,86.74% 38.24%,86.74% 61.76%,13.26% 61.76%',
  // 30.10: explicațiile cu săgeți duble / în patru direcții (caseta la mijloc, 48% din latură), săgețile frânte și semnul înmulțirii (brațe de 23,5%).
  leftRightArrowCallout: '25.94% 0,74.06% 0,74.06% 37.5%,75% 37.5%,75% 25%,100% 50%,75% 75%,75% 62.5%,74.06% 62.5%,74.06% 100%,25.94% 100%,25.94% 62.5%,25% 62.5%,25% 75%,0 50%,25% 25%,25% 37.5%,25.94% 37.5%',
  upDownArrowCallout: '0 25.94%,37.5% 25.94%,37.5% 25%,25% 25%,50% 0,75% 25%,62.5% 25%,62.5% 25.94%,100% 25.94%,100% 74.06%,62.5% 74.06%,62.5% 75%,75% 75%,50% 100%,25% 75%,37.5% 75%,37.5% 74.06%,0 74.06%',
  quadArrowCallout: '50% 0,68.52% 18.52%,59.26% 18.52%,59.26% 25.94%,74.06% 25.94%,74.06% 40.74%,81.48% 40.74%,81.48% 31.48%,100% 50%,81.48% 68.52%,81.48% 59.26%,74.06% 59.26%,74.06% 74.06%,59.26% 74.06%,59.26% 81.48%,68.52% 81.48%,50% 100%,31.48% 81.48%,40.74% 81.48%,40.74% 74.06%,25.94% 74.06%,25.94% 59.26%,18.52% 59.26%,18.52% 68.52%,0 50%,18.52% 31.48%,18.52% 40.74%,25.94% 40.74%,25.94% 25.94%,40.74% 25.94%,40.74% 18.52%,31.48% 18.52%',
  leftUpArrow: '75% 0,100% 25%,87.5% 25%,87.5% 87.5%,25% 87.5%,25% 100%,0 75%,25% 50%,25% 62.5%,62.5% 62.5%,62.5% 25%,50% 25%',
  bentUpArrow: '75% 0,100% 25%,87.5% 25%,87.5% 100%,0 100%,0 75%,62.5% 75%,62.5% 25%,50% 25%',
  leftRightUpArrow: '50% 0,75% 25%,62.5% 25%,62.5% 62.5%,75% 62.5%,75% 50%,100% 75%,75% 100%,75% 87.5%,25% 87.5%,25% 100%,0 75%,25% 50%,25% 62.5%,37.5% 62.5%,37.5% 25%,25% 25%',
  mathMultiply: '50% 33.37%,75.34% 8.03%,91.97% 24.66%,66.63% 50%,91.97% 75.34%,75.34% 91.97%,50% 66.63%,24.66% 91.97%,8.03% 75.34%,33.37% 50%,8.03% 24.66%,24.66% 8.03%',
  // 30.10: stelele mari (vârfurile interioare la 0,75 din rază, ajustarea obișnuită), exploziile (vârfurile pe pânza de 21600 din .pptx),
  // cinci scheme logice, lacrima (cerc cu colțul din dreapta-sus ascuțit) și valurile (amplitudinea 12,5% / 6,25%).
  star16: star(16, 0.75),
  star24: star(24, 0.75),
  star32: star(32, 0.75),
  snip2DiagRect: '0 0,83.3% 0,100% 16.7%,100% 100%,16.7% 100%,0 83.3%',
  irregularSeal1: onGrid([[10800, 5800], [14522, 0], [14155, 5325], [18380, 4457], [16702, 7315], [21097, 8137], [17607, 10475], [21600, 13290],
    [16837, 12942], [18145, 18095], [14020, 14457], [13247, 19737], [10532, 14935], [8485, 21600], [7715, 15627], [4762, 17617], [5667, 13937],
    [135, 14587], [3722, 11775], [0, 8615], [4627, 7617], [370, 2295], [7312, 6320], [8352, 2295]], 21600),
  irregularSeal2: onGrid([[11462, 4342], [14790, 0], [14525, 5777], [18007, 3172], [16380, 6532], [21600, 6645], [16985, 9402], [18270, 11290],
    [16380, 12310], [18877, 15632], [14640, 14350], [14942, 17370], [12180, 15935], [11612, 18842], [9872, 17370], [8700, 19712], [7527, 18125],
    [4917, 21600], [4805, 18240], [1285, 17825], [3330, 15370], [0, 12877], [3935, 11592], [1172, 8270], [5372, 7817], [4502, 3625], [8550, 6382], [9722, 1887]], 21600),
  // Început / sfârșit: capetele sunt jumătăți de elipsă late de 3475 / 21600 din casetă.
  flowChartTerminator: onGrid([...arc(0.1609, 0.5, 0.1609, 0.5, Math.PI / 2, 1.5 * Math.PI), ...arc(0.8391, 0.5, 0.1609, 0.5, -Math.PI / 2, Math.PI / 2)]),
  flowChartDelay: onGrid([[0, 0], ...arc(0.5, 0.5, 0.5, 0.5, -Math.PI / 2, Math.PI / 2, 24), [0, 1]]),
  flowChartDisplay: onGrid([[0, 0.5], [1 / 6, 0], ...arc(5 / 6, 0.5, 1 / 6, 0.5, -Math.PI / 2, Math.PI / 2), [1 / 6, 1]]),
  // Documentul: marginea de jos e o curbă (Bézier) de la 17322 la 20172 pe pânza de 21600, cu umflătura spre stânga-jos.
  flowChartDocument: onGrid([[0, 0], [21600, 0], ...along(24, (t): [number, number] => {
    const b = (p0: number, p1: number, p2: number, p3: number) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
    return [b(21600, 10800, 10800, 0), b(17322, 17322, 23922, 20172)];
  })], 21600),
  flowChartPunchedTape: onGrid([...along(32, (t): [number, number] => [t, 0.1 + 0.1 * Math.sin(TAU * t)]),
    ...along(32, (t): [number, number] => [1 - t, 0.9 + 0.1 * Math.sin(TAU * (1 - t))])]),
  teardrop: onGrid([...arc(0.5, 0.5, 0.5, 0.5, -Math.PI / 2, -2 * Math.PI, 36), [1, 0]]),
  wave: waveShape(1, 0.125),
  doubleWave: waveShape(2, 0.0625),
  // 30.10: felia (de la dreapta, în sensul acelor de ceas, până sus: lipsește sfertul din dreapta-sus), coarda (arc de la 45° la 270°,
  // închis cu o linie dreaptă), placa (colțuri scobite), dreptunghiul cu colțul din dreapta-sus rotunjit și două forme de schemă.
  pie: onGrid([[0.5, 0.5], ...arc(0.5, 0.5, 0.5, 0.5, 0, 1.5 * Math.PI, 36)]),
  chord: onGrid(arc(0.5, 0.5, 0.5, 0.5, Math.PI / 4, 1.5 * Math.PI, 36)),
  plaque: onGrid([...arc(0, 0, 1 / 6, 1 / 6, Math.PI / 2, 0, 8), ...arc(1, 0, 1 / 6, 1 / 6, Math.PI, Math.PI / 2, 8),
    ...arc(1, 1, 1 / 6, 1 / 6, 1.5 * Math.PI, Math.PI, 8), ...arc(0, 1, 1 / 6, 1 / 6, 0, -Math.PI / 2, 8)]),
  round1Rect: onGrid([[0, 0], ...arc(5 / 6, 1 / 6, 1 / 6, 1 / 6, -Math.PI / 2, 0, 8), [1, 1], [0, 1]]),
  flowChartOnlineStorage: onGrid([[1 / 6, 0], [1, 0], ...arc(1, 0.5, 1 / 6, 0.5, -Math.PI / 2, -1.5 * Math.PI, 16).slice(1, -1), [1, 1],
    ...arc(1 / 6, 0.5, 1 / 6, 0.5, Math.PI / 2, 1.5 * Math.PI, 16)]),
  flowChartMagneticTape: onGrid([...arc(0.5, 0.5, 0.5, 0.5, Math.PI / 2, 2.25 * Math.PI, 40), [1, 0.5 + 0.5 * Math.SQRT1_2], [1, 1]]),
  // 30.10: încă zece, cu ajustările obișnuite din .pptx socotite pe o casetă pătrată: colțurile de 1/6 (proces alternativ, colțurile
  // opuse, colțul tăiat + rotunjit), cilindrul cu elipsa de sus înaltă de 1/3, arcul gros (jumătatea de sus, grosimea 25%), săgeata
  // îndoită (coada 25%, vârful 25%, cotul 43,75%). Cadrul și inelul au gaură: conturul din interior e parcurs invers și legat de cel
  // din afară printr-o tăietură fără lățime, deci rămâne gol (regula „nonzero” din clip-path și din desenul pe pânză).
  flowChartAlternateProcess: onGrid([...arc(1 / 6, 1 / 6, 1 / 6, 1 / 6, Math.PI, 1.5 * Math.PI, 8), ...arc(5 / 6, 1 / 6, 1 / 6, 1 / 6, -Math.PI / 2, 0, 8),
    ...arc(5 / 6, 5 / 6, 1 / 6, 1 / 6, 0, Math.PI / 2, 8), ...arc(1 / 6, 5 / 6, 1 / 6, 1 / 6, Math.PI / 2, Math.PI, 8)]),
  flowChartConnector: onGrid(arc(0.5, 0.5, 0.5, 0.5, 0, TAU, 48).slice(0, -1)),
  flowChartMagneticDisk: onGrid([...arc(0.5, 1 / 6, 0.5, 1 / 6, Math.PI, TAU, 24), ...arc(0.5, 5 / 6, 0.5, 1 / 6, 0, Math.PI, 24)]),
  round2DiagRect: onGrid([...arc(1 / 6, 1 / 6, 1 / 6, 1 / 6, Math.PI, 1.5 * Math.PI, 8), [1, 0], ...arc(5 / 6, 5 / 6, 1 / 6, 1 / 6, 0, Math.PI / 2, 8), [0, 1]]),
  snipRoundRect: onGrid([...arc(1 / 6, 1 / 6, 1 / 6, 1 / 6, Math.PI, 1.5 * Math.PI, 8), [5 / 6, 0], [1, 1 / 6], [1, 1], [0, 1]]),
  pieWedge: onGrid([...arc(1, 1, 1, 1, Math.PI, 1.5 * Math.PI, 24), [1, 1]]),
  blockArc: onGrid([...arc(0.5, 0.5, 0.5, 0.5, Math.PI, TAU, 32), ...arc(0.5, 0.5, 0.25, 0.25, TAU, Math.PI, 24)]),
  bentArrow: onGrid([[0, 1], ...arc(0.4375, 0.5625, 0.4375, 0.4375, Math.PI, 1.5 * Math.PI, 16), [0.75, 0.125], [0.75, 0], [1, 0.25], [0.75, 0.5],
    [0.75, 0.375], ...arc(0.4375, 0.5625, 0.1875, 0.1875, 1.5 * Math.PI, Math.PI, 12), [0.25, 1]]),
  frame: onGrid([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0], [0.125, 0.125], [0.125, 0.875], [0.875, 0.875], [0.875, 0.125], [0.125, 0.125]]),
  donut: onGrid([...arc(0.5, 0.5, 0.5, 0.5, 0, TAU, 48), ...arc(0.5, 0.5, 0.25, 0.25, TAU, 0, 32)]),
  // Cilindrul (elipsele înalte de 1/4), cubul (adâncimea 25%), colțul îndoit (1/6) și săgeata cu dungi: cele două dungi și săgeata
  // sunt legate prin tăieturi fără lățime pe latura de sus, ca să fie un singur contur.
  can: onGrid([...arc(0.5, 0.125, 0.5, 0.125, Math.PI, TAU, 24), ...arc(0.5, 0.875, 0.5, 0.125, 0, Math.PI, 24)]),
  cube: onGrid([[0, 0.25], [0.25, 0], [1, 0], [1, 0.75], [0.75, 1], [0, 1]]),
  foldedCorner: onGrid([[0, 0], [1, 0], [1, 5 / 6], [5 / 6, 1], [0, 1]]),
  stripedRightArrow: onGrid([[0, 0.25], [0.03125, 0.25], [0.03125, 0.75], [0, 0.75], [0, 0.25], [0.0625, 0.25], [0.125, 0.25], [0.125, 0.75], [0.0625, 0.75],
    [0.0625, 0.25], [0.15625, 0.25], [0.5, 0.25], [0.5, 0], [1, 0.5], [0.5, 1], [0.5, 0.75], [0.15625, 0.75], [0.15625, 0.25], [0.0625, 0.25]]),
  // Scheme cu linii în interior (proces predefinit, memorie internă, sortare, sau, însumare, arhivare, acces direct) și teșitura:
  // liniile din interior sunt tăieturi fără lățime, parcurse dus-întors, deci umplerea rămâne întreagă, iar conturul le desenează.
  // Proporțiile sunt cele din definițiile standard ale formelor (ECMA-376): barele la 1/8, linia arhivării la 4/5, tamburul cu capete de 1/6.
  flowChartPredefinedProcess: onGrid([[0, 0], [0.125, 0], [0.125, 1], [0.125, 0], [0.875, 0], [0.875, 1], [0.875, 0], [1, 0], [1, 1], [0, 1]]),
  flowChartInternalStorage: onGrid([[0, 0], [0.125, 0], [0.125, 1], [0.125, 0], [1, 0], [1, 0.125], [0, 0.125], [1, 0.125], [1, 1], [0, 1]]),
  flowChartSort: onGrid([[0, 0.5], [0.5, 0], [1, 0.5], [0, 0.5], [1, 0.5], [0.5, 1]]),
  flowChartOr: onGrid([...arc(0.5, 0.5, 0.5, 0.5, -Math.PI / 2, 1.5 * Math.PI, 48), [0.5, 1], [0.5, 0.5], [0, 0.5], [1, 0.5], [0.5, 0.5]]),
  flowChartSummingJunction: onGrid([...arc(0.5, 0.5, 0.5, 0.5, -0.75 * Math.PI, 1.25 * Math.PI, 48), [0.5 + Math.SQRT1_2 / 2, 0.5 + Math.SQRT1_2 / 2], [0.5, 0.5],
    [0.5 + Math.SQRT1_2 / 2, 0.5 - Math.SQRT1_2 / 2], [0.5 - Math.SQRT1_2 / 2, 0.5 + Math.SQRT1_2 / 2], [0.5, 0.5]]),
  flowChartOfflineStorage: onGrid([[0, 0], [1, 0], [0.6, 0.8], [0.4, 0.8], [0.6, 0.8], [0.5, 1], [0.4, 0.8]]),
  flowChartMagneticDrum: onGrid([[1 / 6, 0], ...arc(5 / 6, 0.5, 1 / 6, 0.5, -Math.PI / 2, Math.PI / 2, 16), ...arc(5 / 6, 0.5, 1 / 6, 0.5, Math.PI / 2, 1.5 * Math.PI, 16).slice(1),
    ...arc(5 / 6, 0.5, 1 / 6, 0.5, 1.5 * Math.PI, Math.PI / 2, 16).slice(1), ...arc(1 / 6, 0.5, 1 / 6, 0.5, Math.PI / 2, 1.5 * Math.PI, 16)]),
  // Semnele din graficele de puncte (chartX, chartPlus, chartStar din .pptx): pătratul cu X, cu + sau cu X și linia verticală,
  // liniile fiind tot tăieturi fără lățime, parcurse dus-întors.
  chartX: onGrid([[0, 0], [1, 1], [0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]),
  chartPlus: onGrid([[0, 0], [0.5, 0], [0.5, 1], [0.5, 0], [1, 0], [1, 0.5], [0, 0.5], [1, 0.5], [1, 1], [0, 1]]),
  chartStar: onGrid([[0, 0], [1, 1], [0, 0], [0.5, 0], [0.5, 1], [0.5, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]),
  bevel: onGrid([[0, 0], [0.125, 0.125], [0.875, 0.125], [0.875, 0.875], [0.125, 0.875], [0.125, 0.125], [0, 0], [1, 0], [0.875, 0.125], [1, 0],
    [1, 1], [0.875, 0.875], [1, 1], [0, 1], [0.125, 0.875], [0, 1]]),
  // Roțile dințate (dinții de 15% / 10% din rază, ca în .pptx) și săgeata în U (brațul de 1/4, vârful în jos până la 3/4, ca în .pptx).
  gear6: gear(6, 0.15),
  gear9: gear(9, 0.1),
  uturnArrow: onGrid([[0, 1], ...arc(0.4375, 0.4375, 0.4375, 0.4375, Math.PI, TAU, 24), [0.875, 0.5], [1, 0.5], [0.75, 0.75], [0.5, 0.5], [0.625, 0.5],
    ...arc(0.4375, 0.4375, 0.1875, 0.1875, 0, -Math.PI, 16), [0.25, 1]]),
  // Bula rotunjită și cea ovală: corpul în partea de sus a casetei (3/4), coada în colțul din stânga-jos, ca la Bula de dialog.
  wedgeRoundRectCallout: onGrid([[0.08, 0], [0.92, 0], ...arc(0.92, 0.1067, 0.08, 0.1067, -Math.PI / 2, 0, 6).slice(1), [1, 0.6433],
    ...arc(0.92, 0.6433, 0.08, 0.1067, 0, Math.PI / 2, 6).slice(1), [0.42, 0.75], [0.18, 1], [0.26, 0.75], [0.08, 0.75],
    ...arc(0.08, 0.6433, 0.08, 0.1067, Math.PI / 2, Math.PI, 6).slice(1), [0, 0.1067], ...arc(0.08, 0.1067, 0.08, 0.1067, Math.PI, 1.5 * Math.PI, 6).slice(1, -1)]),
  ribbon: ribbonShape(false),
  ribbon2: ribbonShape(true),
  ellipseRibbon: ribbonShape(false, true),
  ellipseRibbon2: ribbonShape(true, true),
  sun: sunShape(),
  noSmoking: noSmokingShape(),
  smileyFace: smileyShape(),
  mathNotEqual: notEqualShape(),
  nonIsoscelesTrapezoid: '25% 0,75% 0,100% 100%,0 100%',
  flowChartMultidocument: multiDocShape(),
  funnel: funnelShape(),
  cornerTabs: cornerPieces((d) => [[0, 0], [d, 0], [0, d]]),
  squareTabs: cornerPieces((d) => [[0, 0], [d, 0], [d, d], [0, d]]),
  cloudCallout: cloudCalloutShape(),
  actionButtonBlank: '0 0,100% 0,100% 100%,0 100%',
  actionButtonHome: actionButton([[0.5, 0.22], [0.78, 0.48], [0.7, 0.48], [0.7, 0.78], [0.3, 0.78], [0.3, 0.48], [0.22, 0.48]]),
  actionButtonInformation: actionButton(arc(0.5, 0.5, 0.3, 0.3, 0, TAU, 32).slice(0, -1), { solid: arc(0.5, 0.34, 0.05, 0.05, 0, TAU, 12).slice(0, -1) },
    { solid: [[0.46, 0.44], [0.54, 0.44], [0.54, 0.72], [0.46, 0.72]] }),
  actionButtonDocument: actionButton([[0.3, 0.2], [0.6, 0.2], [0.7, 0.3], [0.7, 0.8], [0.3, 0.8]]),
  actionButtonSound: actionButton([[0.25, 0.4], [0.4, 0.4], [0.58, 0.24], [0.58, 0.76], [0.4, 0.6], [0.25, 0.6]], [[0.64, 0.46], [0.76, 0.46], [0.76, 0.54], [0.64, 0.54]]),
  // Semnul întrebării: cârligul (arc gros de sus până în dreapta-jos), coada în jos și punctul.
  actionButtonHelp: actionButton([...arc(0.5, 0.37, 0.15, 0.15, Math.PI, TAU + Math.PI / 3, 20), [0.54, 0.64], [0.46, 0.64], [0.46, 0.52],
    ...arc(0.5, 0.37, 0.07, 0.07, TAU + Math.PI / 3, Math.PI, 12)], arc(0.5, 0.75, 0.05, 0.05, 0, TAU, 12).slice(0, -1)),
  // Întoarcerea: bara de sus cu vârful spre stânga, cotul pe dreapta și coada jos.
  actionButtonReturn: actionButton([[0.22, 0.37], [0.36, 0.23], [0.36, 0.33], [0.6, 0.33], ...arc(0.6, 0.5, 0.17, 0.17, -Math.PI / 2, Math.PI / 2, 12).slice(1),
    [0.36, 0.67], [0.36, 0.59], ...arc(0.6, 0.5, 0.09, 0.09, Math.PI / 2, -Math.PI / 2, 8), [0.36, 0.41], [0.36, 0.51]]),
  // Filmul: camera (corpul, obiectivul în dreapta și cele două role deasupra).
  actionButtonMovie: actionButton([[0.22, 0.45], [0.62, 0.45], [0.62, 0.72], [0.22, 0.72]], [[0.64, 0.585], [0.8, 0.47], [0.8, 0.7]],
    arc(0.32, 0.34, 0.09, 0.09, 0, TAU, 16).slice(0, -1), arc(0.52, 0.34, 0.09, 0.09, 0, TAU, 16).slice(0, -1)),
  actionButtonForwardNext: actionButton([[0.25, 0.25], [0.75, 0.5], [0.25, 0.75]]),
  actionButtonBackPrevious: actionButton([[0.75, 0.25], [0.25, 0.5], [0.75, 0.75]]),
  actionButtonEnd: actionButton([[0.25, 0.25], [0.625, 0.5], [0.25, 0.75]], [[0.66, 0.25], [0.75, 0.25], [0.75, 0.75], [0.66, 0.75]]),
  actionButtonBeginning: actionButton([[0.75, 0.25], [0.375, 0.5], [0.75, 0.75]], [[0.25, 0.25], [0.34, 0.25], [0.34, 0.75], [0.25, 0.75]]),
  callout1: lineCallout(1, false),
  callout2: lineCallout(2, false),
  callout3: lineCallout(3, false),
  accentCallout1: lineCallout(1, true),
  accentCallout2: lineCallout(2, true),
  accentCallout3: lineCallout(3, true),
  borderCallout1: lineCallout(1, false),
  borderCallout2: lineCallout(2, false),
  borderCallout3: lineCallout(3, false),
  accentBorderCallout1: lineCallout(1, true),
  accentBorderCallout2: lineCallout(2, true),
  accentBorderCallout3: lineCallout(3, true),
  plaqueTabs: cornerPieces((d) => [[0, 0], ...arc(0, 0, d, d, 0, Math.PI / 2, 8)]),
  circularArrow: circularArrowShape(false),
  leftCircularArrow: circularArrowShape(true),
  leftRightCircularArrow: leftRightCircularArrowShape(),
  leftRightRibbon: leftRightRibbonShape(),
  // Săgeata arcuită (swooshArrow din .pptx): pornește subțire din colțul din stânga-jos, se îngroașă urcând spre dreapta și se termină în vârf, sus în dreapta.
  swooshArrow: onGrid([...quad([0, 1], [0.4, 0.5], [0.78, 0.3]), [0.8, 0.42], [1, 0.18], [0.74, 0], [0.75, 0.1], ...quad([0.75, 0.1], [0.3, 0.25], [0, 1]).slice(1, -1)]),
  horizontalScroll: scrollShape(false),
  verticalScroll: scrollShape(true),
  curvedRightArrow: curvedArrow('right'),
  curvedLeftArrow: curvedArrow('left'),
  curvedUpArrow: curvedArrow('up'),
  curvedDownArrow: curvedArrow('down'),
  wedgeEllipseCallout: onGrid([...arc(0.5, 0.375, 0.5, 0.375, (125 / 180) * Math.PI, (460 / 180) * Math.PI, 48), [0.18, 1]]),
  // Semnele Plus, Egal și Împărțire, cu proporțiile obișnuite din .pptx: liniile groase de 23,5%, late cât 73,5% din casetă;
  // la Egal cele două linii (și la Împărțire bara cu cele două puncte) sunt legate prin tăieturi fără lățime, ca să fie un singur contur.
  mathPlus: '13.26% 38.24%,38.24% 38.24%,38.24% 13.26%,61.76% 13.26%,61.76% 38.24%,86.74% 38.24%,86.74% 61.76%,61.76% 61.76%,61.76% 86.74%,38.24% 86.74%,38.24% 61.76%,13.26% 61.76%',
  mathEqual: '13.26% 20.6%,86.74% 20.6%,86.74% 44.12%,13.26% 44.12%,13.26% 55.88%,86.74% 55.88%,86.74% 79.4%,13.26% 79.4%',
  mathDivide: onGrid([[0.5, 0.3824], ...arc(0.5, 0.206, 0.1176, 0.1176, Math.PI / 2, Math.PI / 2 + TAU, 24), [0.5, 0.3824], [0.8674, 0.3824], [0.8674, 0.6176],
    [0.5, 0.6176], ...arc(0.5, 0.794, 0.1176, 0.1176, -Math.PI / 2, -Math.PI / 2 + TAU, 24), [0.5, 0.6176], [0.1326, 0.6176], [0.1326, 0.3824]]),
};
/** Culorile pentru forme: întâi culoarea temei, apoi câteva care merg pe orice temă. */
export const FILLS = ['accent', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#6b7280', '#ffffff', '#111827'];
export type LineDash = 'dash' | 'dot' | 'dashDot';
export const LINE_DASHES: [LineDash, string][] = [['dash', 'Întreruptă'], ['dot', 'Punctată'], ['dashDot', 'Linie-punct']];
/** Traseul liniei întrerupte, în multipli de grosime (ca liniile de sistem din .pptx). */
export function dashArray(dash: LineDash | undefined, w: number): string | undefined {
  if (!dash) return undefined;
  const k = Math.max(1, w);
  return (dash === 'dash' ? [3, 1] : dash === 'dot' ? [1, 1] : [3, 1, 1, 1]).map((v) => v * k).join(' ');
}
/** Culoarea #rrggbb cu transparența dată în procente (0 = opacă), ca rgba(). */
export function withTransp(color: string, transp: number | undefined): string {
  if (!transp || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  const n = parseInt(color.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round((100 - Math.min(100, transp))) / 100})`;
}

/** Un sunet păstrat în prezentare: numele unuia gata făcut (trSound.ts) sau fișierul propriu, ca data:audio/…. */
const cleanSnd = (v: unknown): v is string => typeof v === 'string' && (/^[a-z]{2,12}$/.test(v) || (v.startsWith('data:audio/') && /^[a-z0-9.+-]+;base64,/i.test(v.slice(11))));

export interface SlideEl {
  id: string;
  kind: ElKind;
  x: number; y: number; w: number; h: number;
  text: string;
  /** La clipuri video / sunete (kind 'media'): fișierul, ca data URL (video/… sau audio/…); numele lui e în `text`.
   *  `autoplay`: pornește singur când apare în prezentare; `loop`: o ia de la capăt la sfârșit. */
  autoplay?: boolean;
  loop?: boolean;
  /** La sunete: „Continuă pe slide-urile următoare” (muzică de fundal): pornește când apare slide-ul și ține până la sfârșitul
   *  prezentării sau până la alt sunet de același fel. */
  across?: boolean;
  /** La clipuri video: coperta (Poster Frame), poza care se vede înainte de pornire (data:image/…). */
  poster?: string;
  /** La clipuri: volumul (0 = fără sunet … 1 = tare; lipsă = tare); `full`: în prezentare rulează pe tot ecranul;
   *  `hideIdle`: în prezentare nu se vede cât nu rulează; `fadeIn` / `fadeOut`: secundele de apariție / stingere
   *  treptată la început și la sfârșit (imaginea și sunetul). */
  vol?: number;
  full?: boolean;
  hideIdle?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  /** La clipuri: decuparea (Trim), în secunde: de unde pornește (`trimA`) și unde se oprește (`trimB`); lipsă = de la început / până la sfârșit. */
  trimA?: number;
  trimB?: number;
  /** La clipuri: semnele de carte (Bookmarks), locurile însemnate din clip, în secunde, în ordine (vezi cleanBmk). */
  bmk?: number[];
  /** La sunete: narațiunea înregistrată cu 🎙 Înregistrează (pornește singură, nu se vede în prezentare); o înregistrare nouă o înlocuiește. */
  narr?: boolean;
  /** La imagini: poza, ca data URL (micșorată la cel mult 1920 px, ca fișierul să rămână mic). */
  src?: string;
  /** La forme: felul formei și culoarea ('accent' = culoarea temei). */
  shape?: ShapeKind;
  fill?: string;
  /** Umplerea în degrade a formei (ca Umplere degrade din PowerPoint): a doua culoare și direcția (lipsă = culoare plină). */
  fill2?: string;
  fillDir?: BgDir;
  /** Poza ca umplere a formei (ca Umplere cu imagine din PowerPoint), ca data URL, întinsă pe toată forma; are prioritate față de degrade. */
  fillImg?: string;
  /** La formele desenate liber (din PowerPoint): conturul, ca traseu SVG cu coordonate între 0 și 1. */
  path?: string;
  /** Conturul formei (linia de margine): culoarea și grosimea în pixeli; fără `line` forma n-are contur. */
  line?: string;
  lineW?: number;
  /** Felul liniei conturului: lipsă = continuă; 'dash' = întreruptă, 'dot' = punctată, 'dashDot' = linie-punct. */
  lineDash?: LineDash;
  /** La linii: săgețile de la capete (lipsă = fără). */
  ends?: LineEnds;
  /** La linii: traseul (lipsă = dreaptă). */
  route?: LineRoute;
  /** La liniile frânte / curbate: cum pleacă de la capete, întâi începutul ('h' orizontal, 'v' vertical); lipsă = 'hh'. */
  axes?: LineAxes;
  /** La conectorii cu două coturi: unde e segmentul din mijloc, ca parte din lungime (0…1; lipsă = 0,5, la jumătate). */
  bend?: number;
  /** Cameo: forma arată imaginea live de la camera web (cameo.tsx); umplerea ei se vede când camera e oprită. */
  cam?: boolean;
  /** Transparența umplerii formei, în procente (lipsă sau 0 = opacă; textul rămâne opac). */
  transp?: number;
  /** Efectul formei sau pozei: umbră, umbră mare sau strălucire (lipsă = fără); vezi fx.ts. */
  fx?: ShapeFx;
  /** Rotirea 3-D a formei sau pozei (perspectivă sau izometric; lipsă = fără); vezi fx.ts. */
  rot3d?: Rot3d;
  /** Efectul textului: umbră, strălucire sau litere conturate (lipsă = simplu); vezi fx.ts. */
  tfx?: TextFx;
  /** Umplerea literelor cu gradient (două culori, de sus în jos; lipsă = culoarea textului); vezi fx.ts. */
  tgrad?: TextGrad;
  /** Transformarea textului: literele pe un arc, pe un cerc sau pe un val (lipsă = drept); vezi warp.ts. */
  warp?: TextWarp;
  /** Limba de verificare a textului casetei („en-US”, „fr-FR”…; „none” = fără verificarea ortografiei); lipsă = română. */
  lang?: string;
  /** Animația de intrare în prezentare: caseta apare la click, după cele de dinaintea ei. */
  anim?: Anim;
  /** Când pornește animația (ca Pornire din PowerPoint): lipsă = la click; 'with' = odată cu precedenta; 'after' = după precedenta. */
  animStart?: AnimStart;
  /** Durata animației, în secunde (lipsă = cea obișnuită a efectului) și întârzierea ei. */
  animDur?: number;
  animDelay?: number;
  /** Direcția animației (Opțiuni efect din PowerPoint), la Zboară, Ștergere și Ieșire: Zboară; lipsă = de jos (la ieșire: în jos). */
  animDir?: AnimDir;
  /** Lungimea drumului la căile de mișcare (ca la tragerea capătului căii în programul cunoscut): 's' = scurt (jumătate), 'l' = lung (dublu); lipsă = mediu. */
  animLen?: AnimLen;
  /** Cale desenată de mână (Cale: Desenată de mână): punctele drumului, în pixeli de slide, față de locul casetei (fără 0 0 de la început). */
  animPts?: [number, number][];
  /** 'p' = casetele cu listă intră pe paragrafe (fiecare punct de pe primul nivel la click-ul lui, cu subpunctele lui), ca „După paragraf” din PowerPoint. */
  animBy?: 'p';
  /** Locul animației în ordinea slide-ului (Panoul de animații); lipsă = după ordinea casetelor, fără să schimbe ce e deasupra. */
  animOrder?: number;
  /** Declanșator (ca Trigger din PowerPoint): animația nu intră în rândul slide-ului, ci pornește în prezentare la click pe caseta cu acest id
   *  (de exemplu un buton „Răspuns” care arată răspunsul). Lipsă = în rândul slide-ului. Vezi trigOf, trigSteps. */
  animTrig?: string;
  /** Încă o animație (sau mai multe) pe aceeași casetă, după cea de sus (ca „Adăugare animație” din PowerPoint): de exemplu intră, se mișcă, apoi pleacă. */
  more?: AnimFx[];
  /** Ascunsă din Panoul de selecție: nu se vede pe slide și nici în prezentare, dar rămâne în fișier. */
  hide?: boolean;
  /** Grupul casetei (Grupează, Ctrl+G): casetele cu același grp se aleg și se mută împreună; vezi group.ts. */
  grp?: string;
  /** Diagrama din care face parte forma (◇ Diagramă, Conversie în diagramă): id-ul ei și rolul formei ('main' = căsuță
   *  principală, 'sub' = căsuță de al doilea rang, 'link' = linie / săgeată de legătură); vezi diagram.ts (Schimbare culori, Stiluri). */
  dgm?: string;
  dgmRole?: DiagramRole;
  /** Felul diagramei (proces, listă, ierarhie…), ca Adăugare formă / Mutare în sus să o poată reașeza; vezi diagram.ts. */
  dgmKind?: string;
  /** Nivelul căsuței într-o ierarhie pe mai multe rânduri (2 sau 3; lipsă = 1, direct sub vârf): Promovare / Retrogradare. */
  dgmLvl?: number;
  /** Legătura casetei în prezentare (adresă web / e-mail sau salt la un slide), vezi links.ts. */
  link?: string;
  /** Acțiunea casetei: sunetul care se aude la clic (Action Settings → Play sound), unul gata făcut (trSound.ts) sau propriu (data:audio/…);
   *  `linkHover`: legătura și sunetul pornesc la trecerea mouse-ului peste casetă, nu la clic (Mouse Over). */
  linkSnd?: string;
  linkHover?: boolean;
  /** Zoom de slide (ca Slide Zoom): poza e miniatura slide-ului din ; în prezentare, după slide-ul acela se revine aici. */
  szoom?: boolean;
  /** Zoom de secțiune (ca Section Zoom): saltul arată toată secțiunea care începe la slide-ul ales, apoi revine aici. */
  szsec?: boolean;
  /** La poze: cât se taie din fiecare latură (vezi crop.ts). */
  crop?: Crop;
  /** La poze: forma în care se vede poza (Decupează la formă). */
  clip?: ClipShape;
  /** La ecuații (poze desenate din text, vezi docs/equation.ts): textul ecuației, ca să poată fi schimbată. */
  eq?: string;
  /** La pictograme (☺ Pictograme, vezi icons/iconLib.ts): pictograma, culoarea și grosimea liniei, ca să poată fi recolorată. */
  icon?: IconSpec;
  /** La desenele de mână (✏ Desenează, vezi ink.ts): liniile, ca desenul să poată fi schimbat. */
  ink?: Ink;
  /** La modelele 3D (🧊 Modele 3D, vezi model3d.ts): fișierul modelului și rotirea, ca să poată fi rotit din nou. */
  m3d?: Model3DKeep;
  /** La poze: textul alternativ (ce arată poza), citit de cititoarele de ecran; Alt Text din PowerPoint. */
  alt?: string;
  /** La poze: luminozitatea, contrastul, saturația și culoarea (alb-negru / sepia), vezi adjust.ts. */
  adj?: ImgAdj;
  /** La poze: efectul artistic (schiță, acuarelă…, vezi artistic.ts) și poza de dinainte de el, ca efectul să poată fi scos. */
  art?: string;
  orig?: string;
  /** La poze: poza de dinainte de „Elimină fundalul” (vezi images/noBackground.ts), ca fundalul să poată fi pus înapoi. */
  nobg?: string;
  /** La tabele: textul celulelor, rând cu rând (primul rând e capul de tabel). La grafice: datele lui, ca în Sheets
   *  (primul rând = numele seriilor, prima coloană = etichetele de pe axă); titlul graficului e în `text`. */
  cells?: string[][];
  /** La tabele: opțiunile de stil (rândul de cap, rândurile alternate, prima coloană, rândul de total); lipsă = cele obișnuite. */
  tlook?: TableLook;
  /** La tabele: lățimea fiecărei coloane, ca parte din lățimea tabelului (suma = 1); lipsă = coloane egale. */
  colW?: number[];
  /** La tabele: înălțimea fiecărui rând, ca parte din înălțimea tabelului (suma = 1); lipsă = rânduri egale. */
  rowH?: number[];
  /** La tabele: celulele îmbinate, [rând, coloană, câte rânduri, câte coloane]; vezi tableMerge.ts. */
  merge?: Merge[];
  /** La tabele: ce linii au chenar (lipsă = toate); vezi tableMerge.ts. */
  tborder?: TableBorder;
  /** La tabele: stilul din galerie (lipsă = cel obișnuit); vezi tableStyle.ts. */
  tstyle?: TableStyle;
  /** La tabele: culoarea stilului (lipsă = a temei); una din TABLE_COLORS. */
  tcolor?: string;
  /** La tabele: grosimea liniilor în pixeli (lipsă = 1) și culoarea lor (lipsă = a textului, estompată). */
  tlineW?: number;
  tlineC?: string;
  /** La tabele: marginile din celule (lipsă = normale) și direcția textului (lipsă = orizontal). */
  tpad?: TablePad;
  tdir?: TableDir;
  /** La tabele: formatarea proprie a fiecărei celule (fundal, culoare, aldin, cursiv, aliniere), peste stilul tabelului; vezi cellFmt.ts. */
  cfmt?: CellFmtGrid;
  /** La tabele puse dintr-o foaie de calcul: fișierul (calea întreagă) și foaia, pentru ↻ Actualizează foile legate (sheetTable.ts). */
  slink?: { path: string; sheet: string };
  /** La grafice: tipul (coloane, bare, linie, arie, plăcintă, inel, puncte, combinat…), paleta de culori (indicele din PALETTES)
   * și titlurile axelor (orizontală / verticală). */
  chart?: ChartType;
  cpal?: number;
  cxt?: string;
  cyt?: string;
  /** Valorile scrise pe grafic. */
  clab?: boolean;
  /** Locul legendei (lipsă = jos; la plăcintă, în dreapta). */
  cleg?: LegendPos;
  /** Graficul fără linii de grilă; umplerea și conturul zonei diagramei (#rrggbb; lipsă = alb, fără contur). */
  cng?: boolean;
  cbg?: string;
  cln?: string;
  /** Fontul și culoarea textului din grafic (lipsă = Segoe UI, griurile obișnuite). */
  cfont?: string;
  cink?: string;
  /** La grafice: seriile ascunse (coloanele lor din tabel, de la 1), ca debifarea din Selectare date; datele rămân în tabel. */
  choff?: number[];
  /** Formatarea textului: mărimea (înmulțitor față de cea a temei), culoarea (lipsă = a temei), aldin, aliniere. */
  size?: number;
  color?: string;
  bold?: boolean;
  /** Cursiv, subliniat, tăiat și fontul: ca aldinul, pentru toată caseta. Fontul lipsă = cel al temei. */
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  font?: string;
  /** Formatul pe bucăți de text (aldin / cursiv / culoare doar pe cuvintele selectate), peste cel al casetei; vezi marks.ts. */
  marks?: TextMark[];
  align?: 'left' | 'center' | 'right' | 'justify';
  /** Spațierea rândurilor, ca în PowerPoint: 1 = simplă (lipsă), 1.5 = un rând și jumătate, 2 = dublă. */
  spacing?: number;
  /** Spațierea înainte (`spb`) și după (`spa`) fiecare paragraf din casetă, în puncte (vezi PARA_GAPS); lipsă = fără. */
  spb?: number;
  spa?: number;
  /** Alinierea și spațierea fiecărui paragraf (indicele = rândul din `text`), peste cele ale casetei; null = ca toată caseta. */
  pfmt?: (ParaFmt | null)[];
  /** La liste (kind 'body'): felul punctelor. Lipsă = buline; 'number' = 1. 2. 3.; 'paren' = 1) 2) 3); 'alpha' = a. b. c.;
   *  'upper' = A. B. C.; 'roman' = I. II. III.; 'none' = fără puncte. */
  list?: ListStyle;
  /** La listele numerotate: numărul primului punct de pe primul nivel (ca „Începe de la” din PowerPoint); lipsă = 1. */
  listStart?: number;
  /** Unde stă textul pe înălțimea casetei (ca Aliniere text din PowerPoint); lipsă = cum e obișnuit pentru felul casetei. */
  valign?: VAlign;
  /** Marginile interioare ale casetei (ca Format formă → Casetă text → margini), în px: sus, dreapta, jos, stânga.
   *  Lipsă = cele obișnuite ale felului de casetă (0 la casete, 12 / 18 px la forme). */
  inset?: Inset;
  /** Rotirea casetei, în grade, în sensul acelor de ceas (lipsă = 0), și oglindirea (ca Aranjare → Rotire din PowerPoint).
   *  Ca în PowerPoint, întâi se oglindește, apoi se rotește. Textul din forme rămâne citibil (nu se oglindește). */
  rot?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** La linii: capătul de început / de sfârșit lipit de punctul de conexiune `idx` (0 sus, 1 stânga, 2 jos, 3 dreapta) al formei `id` (connectors.ts). */
  stCxn?: { id: string; idx: number };
  endCxn?: { id: string; idx: number };
}

/** Casetele care se pot roti / oglindi (tabelele, graficele și clipurile nu, ca să rămână ușor de citit și în PowerPoint). */
export const canTurn = (e: Pick<SlideEl, 'kind'>) => e.kind !== 'table' && e.kind !== 'chart' && e.kind !== 'media';
/** Unghiul adus între 0 și 359,9 (0 = fără rotire). */
export const normRot = (deg: number) => { const r = Math.round((((deg % 360) + 360) % 360) * 10) / 10; return r >= 360 ? 0 : r; };
export type Turn = 'right' | 'left' | 'flipH' | 'flipV' | 'reset';
export const TURNS: [Turn, string][] = [['right', '↻ Rotește 90° la dreapta'], ['left', '↺ Rotește 90° la stânga'],
  ['flipH', '⇋ Oglindește orizontal'], ['flipV', '⇵ Oglindește vertical'], ['reset', '⊘ Fără rotire / oglindire']];
/** Rotirea sau oglindirea unei casete; câmpurile care ajung la 0 / fals dispar. */
export function turnEl(e: SlideEl, how: Turn | { deg: number }): SlideEl {
  const { rot: _r, flipH: _h, flipV: _v, ...rest } = e;
  let rot = e.rot ?? 0, flipH = !!e.flipH, flipV = !!e.flipV;
  if (typeof how === 'object') rot = how.deg;
  else if (how === 'right') rot += 90;
  else if (how === 'left') rot -= 90;
  else if (how === 'flipH') flipH = !flipH;
  else if (how === 'flipV') flipV = !flipV;
  else { rot = 0; flipH = false; flipV = false; }
  rot = normRot(rot);
  return { ...rest, ...(rot ? { rot } : {}), ...(flipH ? { flipH } : {}), ...(flipV ? { flipV } : {}) };
}
/** Un capăt de linie lipit: id-ul formei și punctul de conexiune 0–3 (la elipsă 0–7). */
const cxnOk = (c: unknown): c is { id: string; idx: number } =>
  !!c && typeof (c as { id: unknown }).id === 'string' && [0, 1, 2, 3, 4, 5, 6, 7].includes((c as { idx: number }).idx);
/** Transformarea CSS a casetei (întâi oglindirea, apoi rotirea, ca în PowerPoint); '' = niciuna. */
export function turnCss(e: Pick<SlideEl, 'rot' | 'flipH' | 'flipV'>): string {
  return [e.rot ? `rotate(${e.rot}deg)` : '', e.flipH ? 'scaleX(-1)' : '', e.flipV ? 'scaleY(-1)' : ''].filter(Boolean).join(' ');
}

/** Decuparea unui clip, curățată: începutul între 0 și 10 ore, sfârșitul cu cel puțin 0,1 s după început; zecimi de secundă. */
export function cleanTrim(a: unknown, b: unknown): { trimA?: number; trimB?: number } {
  const r = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 36000 ? Math.round(x * 10) / 10 : undefined);
  const A = r(a), B = r(b);
  return { ...(A ? { trimA: A } : {}), ...(B && B >= (A ?? 0) + 0.1 ? { trimB: B } : {}) };
}
/** Semnele de carte ale unui clip, curățate: între 0 și 10 ore, în zecimi de secundă, fără dubluri, în ordine, cel mult 20. */
export const BMK_MAX = 20;
export function cleanBmk(x: unknown): { bmk?: number[] } {
  if (!Array.isArray(x)) return {};
  const t = [...new Set(x.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 36000).map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b).slice(0, BMK_MAX);
  return t.length ? { bmk: t } : {};
}
/** Timpul clipului scris scurt: 75,5 → „1:15,5”. */
export const clipTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}${s % 1 ? ',' + Math.round((s % 1) * 10) : ''}`;
export type VAlign = 'top' | 'middle' | 'bottom';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';
/** Formatul unui paragraf: alinierea (a) și spațierea rândurilor (sp, ca `spacing`) și spațierea înainte / după
 *  (b / af, în puncte, ca `spb` / `spa`); câmpurile lipsă = ca toată caseta. */
export type ParaFmt = { a?: TextAlign; sp?: number; b?: number; af?: number };
const isAlign = (a: unknown): a is TextAlign => a === 'left' || a === 'center' || a === 'right' || a === 'justify';
/** Formatul paragrafelor, curățat: cel mult câte rânduri are textul; lipsă dacă niciun paragraf nu are format propriu. */
export function cleanPfmt(p: unknown, lines: number): (ParaFmt | null)[] | undefined {
  if (!Array.isArray(p)) return undefined;
  const out = p.slice(0, Math.max(0, lines)).map((x): ParaFmt | null => {
    const a = isAlign(x?.a) ? x.a : undefined, sp = typeof x?.sp === 'number' && x.sp >= 0.5 && x.sp <= 5 ? Math.round(x.sp * 100) / 100 : undefined;
    // Spațierea înainte (b) / după (af) paragraf, în puncte; 0 = fără, chiar dacă toată caseta are.
    const g = (v: unknown) => (v === 0 ? 0 : cleanGap(v)), b = g(x?.b), af = g(x?.af);
    return a || sp || b !== undefined || af !== undefined ? { ...(a ? { a } : {}), ...(sp ? { sp } : {}), ...(b !== undefined ? { b } : {}), ...(af !== undefined ? { af } : {}) } : null;
  });
  while (out.length && !out[out.length - 1]) out.pop();
  return out.length ? out : undefined;
}
/** Alinierea și spațierea paragrafului `i` (al lui sau ale casetei). */
export const paraAlign = (e: Pick<SlideEl, 'align' | 'pfmt'>, i: number) => e.pfmt?.[i]?.a ?? e.align;
export const paraSpacing = (e: Pick<SlideEl, 'spacing' | 'pfmt'>, i: number) => e.pfmt?.[i]?.sp ?? e.spacing;
export const VALIGNS: [VAlign, string][] = [['top', '⤒ Sus'], ['middle', '↕ La mijloc'], ['bottom', '⤓ Jos']];

export type ListStyle = 'number' | 'paren' | 'alpha' | 'upper' | 'roman' | 'none';
/** Felurile de liste din bară (ca Buline / Numerotare din PowerPoint); „” = buline. */
export const LIST_STYLES: [ListStyle | '', string][] = [['', '• Buline'], ['number', '1. Numerotare'], ['paren', '1) Numerotare cu paranteză'],
  ['alpha', 'a. Litere'], ['upper', 'A. Litere mari'], ['roman', 'I. Cifre romane'], ['none', 'Fără puncte']];
const NUMBERED: ListStyle[] = ['number', 'paren', 'alpha', 'upper', 'roman'];
/** Lista are numere (sau litere) în loc de buline. */
export const isNumbered = (list: ListStyle | undefined) => !!list && NUMBERED.includes(list);
export const cleanListStart = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 1 && v <= 9999 ? v : undefined);

/** Nivelurile din liste (ca Mărește / Micșorează nivelul din PowerPoint): în text, fiecare tab de la începutul rândului e un nivel. */
export const MAX_LEVEL = 4;
export const lineLevel = (l: string) => Math.min(MAX_LEVEL, /^\t*/.exec(l)![0].length);
export const lineText = (l: string) => l.replace(/^\t+/, '');
/** Rândul cu nivelul dat (0 = primul nivel). */
export const atLevel = (l: string, lvl: number) => '\t'.repeat(Math.max(0, Math.min(MAX_LEVEL, lvl))) + lineText(l);
/** Mută rândurile date (sau pe toate, la `null`) cu `by` niveluri mai la dreapta (+1) sau mai la stânga (−1). */
export function shiftLevels(text: string, lines: number[] | null, by: number): string {
  return text.split('\n').map((l, i) => (!lines || lines.includes(i) ? atLevel(l, lineLevel(l) + by) : l)).join('\n');
}
/** Numărul fiecărui punct într-o listă numerotată: fiecare nivel numără de la 1, iar un punct mai puțin retras o ia de la capăt pe cele de sub el. */
export function listNumbers(levels: number[], start = 1): number[] {
  const n: number[] = [];
  // Primul nivel începe de la numărul ales („Începe de la”); nivelurile de dedesubt de la 1.
  return levels.map((l) => { n[l] = (n[l] ?? (l ? 0 : start - 1)) + 1; n.length = l + 1; return n[l]; });
}
export type NumberType = 'decimal' | 'sl-paren' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman';
/** Felul numerelor pe fiecare nivel (ca în PowerPoint): primul nivel ca în listă, apoi a. → i. și de la capăt; la litere: a. → i. → 1. */
export function numberType(list: ListStyle | undefined, lvl: number): NumberType {
  const first: NumberType = list === 'paren' ? 'sl-paren' : list === 'alpha' ? 'lower-alpha' : list === 'upper' ? 'upper-alpha' : list === 'roman' ? 'upper-roman' : 'decimal';
  const seq: NumberType[] = list === 'alpha' ? [first, 'lower-roman', 'decimal'] : [first, 'lower-alpha', 'lower-roman'];
  return seq[lvl % 3];
}

export { changeCase, TEXT_CASES } from '../textCase';
export type { TextCase } from '../textCase';

/** Ordinea casetelor pe slide (ca Aranjare din PowerPoint): ultima din listă se desenează deasupra tuturor. */
export type Order = 'front' | 'forward' | 'backward' | 'back';
export function reorder(els: SlideEl[], ids: string[], how: Order): SlideEl[] {
  const chosen = new Set(ids);
  if (how === 'front') return [...els.filter((e) => !chosen.has(e.id)), ...els.filter((e) => chosen.has(e.id))];
  if (how === 'back') return [...els.filter((e) => chosen.has(e.id)), ...els.filter((e) => !chosen.has(e.id))];
  const out = [...els];
  // Un pas: fiecare casetă aleasă trece peste (sau sub) vecina ei care nu e aleasă.
  if (how === 'forward') {
    for (let i = out.length - 2; i >= 0; i--) if (chosen.has(out[i].id) && !chosen.has(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]];
  } else {
    for (let i = 1; i < out.length; i++) if (chosen.has(out[i].id) && !chosen.has(out[i - 1].id)) [out[i], out[i - 1]] = [out[i - 1], out[i]];
  }
  return out;
}

/** Spațierile din listă (ca în PowerPoint: Home → Line Spacing). */
export const SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3];
/** Spațierea înainte / după paragraf din listă, în puncte. */
export const PARA_GAPS = [0, 6, 12, 18, 24, 36];
/** Spațierea înainte / după paragraf, curățată: între 0,5 și 200 pt, în jumătăți de punct; altfel lipsă. */
export type Inset = [number, number, number, number];
/** Marginile interioare: patru numere între 0 și 200 px (la jumătate de pixel), altfel lipsă. */
export const cleanInset = (x: unknown): Inset | undefined =>
  Array.isArray(x) && x.length === 4 && x.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 200)
    ? (x.map((v) => Math.round(v * 2) / 2) as Inset) : undefined;
/** Marginile interioare de ales din bară (în px: sus, dreapta, jos, stânga; 96 px = 1 inci): fără, înguste, normale (0,1 / 0,05 inci), late. */
export const INSETS: [string, string, Inset][] = [
  ['none', '▭ Fără margini', [0, 0, 0, 0]],
  ['narrow', '▭ Margini înguste', [2.5, 5, 2.5, 5]],
  ['normal', '▭ Margini normale', [5, 9.5, 5, 9.5]],
  ['wide', '▭ Margini late', [10, 19, 10, 19]],
];
export const cleanGap = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0.5 && x <= 200 ? Math.round(x * 2) / 2 : undefined);
/** Punctele spațierii în pixelii slide-ului (literele: px × 0,75 = pt). */
export const gapPx = (pt: number) => Math.round((pt / 0.75) * 100) / 100;

/** Fonturile din lista casetelor (cele care sunt pe orice Windows); „” = fontul temei. */
export const SLIDE_FONTS: [string, string][] = [
  ['Fontul temei', ''], ['Segoe UI', 'Segoe UI'], ['Arial', 'Arial'], ['Calibri', 'Calibri'], ['Cambria', 'Cambria'],
  ['Georgia', 'Georgia'], ['Times New Roman', 'Times New Roman'], ['Verdana', 'Verdana'], ['Courier New', 'Courier New'],
];
/** Un nume de font păstrat din fișier: litere, cifre, spații, cratime (fără ghilimele sau alte semne). */
export const cleanFont = (f: unknown) => (typeof f === 'string' && /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,39}$/.test(f.trim()) ? f.trim() : '');

/** Culorile pentru text: lipsă = culoarea temei, apoi câteva clare. */
export const TEXT_COLORS = ['', '#111827', '#ffffff', '#ef4444', '#f59e0b', '#10b981', '#2563eb', '#8b5cf6'];

export type Anim = 'appear' | 'fade' | 'rise' | 'fly' | 'wipe' | 'split' | 'wheel' | 'bars' | 'zoom' | 'exit' | 'exitFade' | 'exitFly' | 'pulse' | 'spin' | 'grow' | 'teeter' | 'pathLine' | 'pathArc' | 'pathCircle' | 'pathSquare' | 'pathZigzag' | 'pathTurn' | 'pathLoop' | 'pathWave' | 'pathFree' | 'play' | 'pause' | 'stop';
export const ANIMS: [Anim | '', string][] = [
  ['', 'Fără'], ['appear', 'Apare'], ['fade', 'Se estompează'], ['rise', 'Urcă'], ['fly', 'Zboară înăuntru'], ['wipe', 'Ștergere'],
  ['split', 'Împărțire'], ['wheel', 'Roată'], ['bars', 'Bare'], ['zoom', 'Zoom'],
  ['exit', 'Ieșire: Dispare'], ['exitFade', 'Ieșire: Se estompează'], ['exitFly', 'Ieșire: Zboară afară'],
  ['pulse', 'Accent: Puls'], ['spin', 'Accent: Rotire'], ['grow', 'Accent: Crește'], ['teeter', 'Accent: Balans'],
  ['pathLine', 'Cale: Linie'], ['pathArc', 'Cale: Arc'], ['pathCircle', 'Cale: Cerc'],
  ['pathSquare', 'Cale: Pătrat'], ['pathZigzag', 'Cale: Zigzag'], ['pathTurn', 'Cale: Întoarcere'],
  ['pathLoop', 'Cale: Buclă'], ['pathWave', 'Cale: Undă'], ['pathFree', 'Cale: Desenată de mână'],
  ['play', 'Media: Redare'], ['pause', 'Media: Pauză'], ['stop', 'Media: Oprire'],
];
/** Redarea unui clip ca pas al animațiilor (ca „Redare” din PowerPoint): clipul se vede de la început și pornește la pasul lui. */
export const isPlay = (a?: Anim) => a === 'play';
/** Comenzile pentru clipuri ca pași ai animațiilor: Redare, Pauză (stă pe loc; o Redare de după continuă de acolo)
 *  și Oprire (se întoarce la început). Doar la clipuri. */
export const isMediaFx = (a?: Anim | '') => a === 'play' || a === 'pause' || a === 'stop';
/** Animațiile de ieșire: caseta se vede de la început și pleacă la pasul ei (ca Ieșire din PowerPoint). */
export const isExit = (a?: Anim) => a === 'exit' || a === 'exitFade' || a === 'exitFly';
/** Accentele: caseta se vede tot timpul și doar se mișcă la pasul ei (ca Accentuare din PowerPoint). */
export const isEmph = (a?: Anim) => a === 'pulse' || a === 'spin' || a === 'grow' || a === 'teeter';
/** Căile de mișcare: caseta se vede tot timpul și, la pasul ei, se mută pe o linie sau pe un arc (și rămâne acolo) ori face un cerc. */
export const isMotionPath = (a?: Anim) => a === 'pathLine' || a === 'pathArc' || a === 'pathCircle' || a === 'pathSquare' || a === 'pathZigzag' || a === 'pathTurn' || a === 'pathLoop' || a === 'pathWave' || a === 'pathFree';
/** Căile închise (caseta se întoarce la loc): nu au direcție. */
export const isClosedPath = (a?: Anim) => a === 'pathCircle' || a === 'pathSquare';
/** Direcția animației: de unde intră caseta (la ieșire: încotro pleacă). */
export type AnimDir = 'b' | 't' | 'l' | 'r';
export const ANIM_DIRS: [AnimDir, string, string][] = [['b', 'De jos', 'În jos'], ['t', 'De sus', 'În sus'], ['l', 'Din stânga', 'Spre stânga'], ['r', 'Din dreapta', 'Spre dreapta']];
/** Lungimea drumului la căile de mișcare: scurt (jumătate), lung (dublu); lipsă = mediu. */
export type AnimLen = 's' | 'l';
export const ANIM_LENS: ['m' | AnimLen, string][] = [['s', 'Scurt'], ['m', 'Mediu'], ['l', 'Lung']];
const LEN_SCALE = { s: 0.5, l: 2 } as const;
/** Animațiile care au direcție. */
export const hasAnimDir = (a?: Anim) => a === 'fly' || a === 'wipe' || a === 'exitFly' || a === 'pathLine' || a === 'pathArc' || a === 'pathZigzag' || a === 'pathTurn' || a === 'pathLoop' || a === 'pathWave';
/** Câte puncte are o cale (în CSS: --ap1 … --ap8, la 1/8, 2/8 … din durată). */
export const PATH_POINTS = 8;
/**
 * Punctele căii, în pixeli de slide, față de locul casetei: Linie = un sfert din slide în direcția aleasă (lipsă = în jos);
 * Arc = același capăt, cu o boltă într-o parte (jumătate din drum); Cerc = un cerc cu raza 1/8 din înălțime, înapoi la loc;
 * Pătrat = spre dreapta, în jos, spre stânga și în sus (latura 1/4 din înălțime), înapoi la loc; Zigzag = drumul liniei, în dinți
 * (1/8 din drum în lateral); Întoarcere = jumătate din drum înainte, apoi o curbă de 90° în partea bolții și încă o bucată drept;
 * Buclă = drumul liniei, cu un cerc (raza 1/6 din drum) la jumătate, în partea bolții; Undă = drumul liniei, cu o undă întreagă
 * (întâi în partea bolții, apoi în cealaltă, 1/6 din drum în lateral).
 */
export function pathPoints(a: Anim | undefined, d: AnimDir = 'b', w = SLIDE_W, h = SLIDE_H): [number, number][] {
  const end: [number, number] = d === 't' ? [0, -h / 4] : d === 'l' ? [-w / 4, 0] : d === 'r' ? [w / 4, 0] : [0, h / 4];
  const len = Math.hypot(end[0], end[1]);
  // Bolta arcului: perpendiculară pe drum, în sus la drumurile orizontale și spre dreapta la cele verticale.
  const perp: [number, number] = end[1] === 0 ? [0, -1] : [1, 0];
  const r = h / 8;
  const out: [number, number][] = [];
  for (let k = 1; k <= PATH_POINTS; k++) {
    const t = k / PATH_POINTS;
    if (a === 'pathCircle') out.push([r * Math.sin(2 * Math.PI * t), -r + r * Math.cos(2 * Math.PI * t)]);
    else if (a === 'pathSquare') { const s = h / 4; out.push(([[s / 2, 0], [s, 0], [s, s / 2], [s, s], [s / 2, s], [0, s], [0, s / 2], [0, 0]] as [number, number][])[k - 1]); }
    else if (a === 'pathZigzag') { const z = (len / 8) * Math.round(Math.sin((Math.PI * k) / 2)); out.push([t * end[0] + z * perp[0], t * end[1] + z * perp[1]]); }
    else if (a === 'pathTurn') {
      const u: [number, number] = [end[0] / len, end[1] / len], q = len / 4;
      const at = (f: number, g: number): [number, number] => [f * u[0] + g * perp[0], f * u[1] + g * perp[1]];
      if (k <= 3) out.push(at((len / 2) * (k / 3), 0));
      else if (k <= 6) { const th = ((k - 3) * Math.PI) / 6; out.push(at(len / 2 + q * Math.sin(th), q * (1 - Math.cos(th)))); }
      else out.push(at(len / 2 + q, q + q * (k - 6)));
    }
    else if (a === 'pathLoop') {
      const u: [number, number] = [end[0] / len, end[1] / len], rl = len / 6;
      const at = (f: number, g: number): [number, number] => [f * u[0] + g * perp[0], f * u[1] + g * perp[1]];
      if (k <= 2) out.push(at((len / 2) * (k / 2), 0));
      else if (k <= 6) { const th = ((k - 2) * Math.PI) / 2; out.push(at(len / 2 + rl * Math.sin(th), rl * (1 - Math.cos(th)))); }
      else out.push(at(len / 2 + (len / 2) * ((k - 6) / 2), 0));
    }
    else if (a === 'pathWave') { const z = (len / 6) * Math.sin((Math.PI * k) / 4); out.push([t * end[0] + z * perp[0], t * end[1] + z * perp[1]]); }
    else if (a === 'pathArc') { const b = Math.sin(Math.PI * t) * len / 2; out.push([t * end[0] + b * perp[0], t * end[1] + b * perp[1]]); }
    else out.push([t * end[0], t * end[1]]);
  }
  return out.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}
/** Punctele căii cu lungimea aleasă (scurt = jumătate, lung = dublu; la cerc și la pătrat, mărimea lor). */
export function pathPointsLen(a: Anim | undefined, d?: AnimDir, len?: AnimLen, w = SLIDE_W, h = SLIDE_H): [number, number][] {
  const f = len ? LEN_SCALE[len] : 1, pts = pathPoints(a, d, w, h);
  return f === 1 ? pts : pts.map(([x, y]) => [Math.round(x * f * 10) / 10, Math.round(y * f * 10) / 10]);
}
/** Câte puncte ține o cale desenată de mână (mai multe se reeșantionează). */
export const MAX_PATH_PTS = 64;
const r1 = (v: number) => Math.round(v * 10) / 10;
/** `n` puncte la distanțe egale pe drumul 0 0 → pts (fără 0 0), după lungimea lui. */
export function resamplePath(pts: [number, number][], n: number): [number, number][] {
  const all: [number, number][] = [[0, 0], ...pts];
  const cum = [0];
  for (let k = 1; k < all.length; k++) cum.push(cum[k - 1] + Math.hypot(all[k][0] - all[k - 1][0], all[k][1] - all[k - 1][1]));
  const total = cum[cum.length - 1];
  if (!total) return Array.from({ length: n }, () => [0, 0] as [number, number]);
  const out: [number, number][] = [];
  let j = 1;
  for (let k = 1; k <= n; k++) {
    const at = (total * k) / n;
    while (j < all.length - 1 && cum[j] < at) j++;
    const seg = cum[j] - cum[j - 1], f = seg ? (at - cum[j - 1]) / seg : 1;
    out.push([r1(all[j - 1][0] + f * (all[j][0] - all[j - 1][0])), r1(all[j - 1][1] + f * (all[j][1] - all[j - 1][1]))]);
  }
  return out;
}
/** Drumul tras cu mouse-ul (puncte de slide) → punctele căii față de primul punct; null dacă e prea scurt (sub 8 px). */
export function drawnPath(raw: [number, number][]): [number, number][] | null {
  if (raw.length < 2) return null;
  const [x0, y0] = raw[0];
  const pts: [number, number][] = [];
  let last: [number, number] = [0, 0], len = 0;
  for (const [x, y] of raw.slice(1)) {
    const p: [number, number] = [x - x0, y - y0], d = Math.hypot(p[0] - last[0], p[1] - last[1]);
    if (d < 3) continue;
    pts.push(p); len += d; last = p;
  }
  if (len < 8) return null;
  return pts.length > MAX_PATH_PTS ? resamplePath(pts, MAX_PATH_PTS) : pts.map(([x, y]) => [r1(x), r1(y)]);
}
/** Punctele unei căi desenate citite dintr-un fișier, verificate (perechi de numere, cel mult MAX_PATH_PTS); null dacă nu e bună. */
export function cleanPathPts(v: unknown): [number, number][] | null {
  if (!Array.isArray(v) || !v.length || v.length > MAX_PATH_PTS) return null;
  const ok = v.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 4 * SLIDE_W));
  return ok ? v.map(([x, y]) => [r1(x), r1(y)] as [number, number]) : null;
}
/** Punctele căii unei casete (cele 8 din CSS): la calea desenată, drumul ei reeșantionat; altfel ca pathPointsLen. */
export function elPathPoints(e: Pick<SlideEl, 'anim' | 'animDir' | 'animLen' | 'animPts'>): [number, number][] {
  if (e.anim !== 'pathFree' || !e.animPts?.length) return pathPointsLen(e.anim, e.animDir, e.animLen);
  const f = e.animLen ? LEN_SCALE[e.animLen] : 1;
  return resamplePath(e.animPts, PATH_POINTS).map(([x, y]) => [r1(x * f), r1(y * f)]);
}
/**
 * Inversarea căii (Inversare direcție cale): caseta face același drum, de la capăt spre început, pornind din locul ei.
 * Orice cale devine una desenată (la cele gata făcute, lungimea aleasă intră în puncte; la cea desenată rămâne Lungimea).
 */
export function reversePath(e: Pick<SlideEl, 'anim' | 'animDir' | 'animLen' | 'animPts'>): Pick<SlideEl, 'anim' | 'animPts' | 'animLen'> {
  const free = e.anim === 'pathFree' && !!e.animPts?.length;
  const all: [number, number][] = [[0, 0], ...(free ? e.animPts! : pathPointsLen(e.anim, e.animDir, e.animLen))];
  const [ex, ey] = all[all.length - 1];
  const pts = all.slice(0, -1).reverse().map(([x, y]) => [r1(x - ex), r1(y - ey)] as [number, number]);
  return { anim: 'pathFree', animPts: pts.length > MAX_PATH_PTS ? resamplePath(pts, MAX_PATH_PTS) : pts, ...(free && e.animLen ? { animLen: e.animLen } : {}) };
}
/** Calea casetei ca drum desenat, ca să i se poată muta punctele (la căile gata făcute, punctele lor cu lungimea aleasă). */
export function editablePath(e: Pick<SlideEl, 'anim' | 'animDir' | 'animLen' | 'animPts'>): Pick<SlideEl, 'anim' | 'animPts' | 'animLen'> {
  if (e.anim === 'pathFree' && e.animPts?.length) return { anim: 'pathFree', animPts: e.animPts, ...(e.animLen ? { animLen: e.animLen } : {}) };
  return { anim: 'pathFree', animPts: pathPointsLen(e.anim, e.animDir, e.animLen) };
}
/** Punctul k al căii mutat în (x, y), față de locul casetei. */
export function movePathPoint(pts: [number, number][], k: number, x: number, y: number): [number, number][] {
  if (k < 0 || k >= pts.length) return pts;
  const c = (v: number) => r1(Math.max(-4 * SLIDE_W, Math.min(4 * SLIDE_W, v)));
  return pts.map((p, j) => (j === k ? [c(x), c(y)] : p));
}
/** Punctul k scos din cale (rămâne cel puțin unul). */
export function removePathPoint(pts: [number, number][], k: number): [number, number][] {
  return pts.length <= 1 || k < 0 || k >= pts.length ? pts : pts.filter((_, j) => j !== k);
}
/** Un punct nou pe cale, în bucata cea mai apropiată de (x, y); întoarce și locul lui (-1 dacă sunt deja MAX_PATH_PTS). */
export function insertPathPoint(pts: [number, number][], x: number, y: number): { pts: [number, number][]; at: number } {
  if (pts.length >= MAX_PATH_PTS) return { pts, at: -1 };
  const all: [number, number][] = [[0, 0], ...pts];
  let best = 0, bd = Infinity;
  for (let k = 1; k < all.length; k++) {
    const [ax, ay] = all[k - 1], [bx, by] = all[k], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d < bd) { bd = d; best = k - 1; }
  }
  const out = pts.slice();
  out.splice(best, 0, [r1(x), r1(y)]);
  return { pts: out, at: best };
}
/** Variabilele CSS pentru direcție: --afrom (de unde zboară caseta) și --aclip (masca de la începutul ștergerii). */
export function animDirVars(e: SlideEl): Record<string, string> {
  const d = e.animDir;
  if (isMotionPath(e.anim)) return Object.fromEntries(elPathPoints(e).map(([x, y], k) => [`--ap${k + 1}`, `${x}px ${y}px`]));
  if (!d || d === 'b' || !hasAnimDir(e.anim)) return {};
  if (e.anim === 'wipe') return { '--aclip': d === 't' ? 'inset(0 0 100% 0)' : d === 'l' ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' };
  return { '--afrom': d === 't' ? '0 -1000px' : d === 'l' ? '-2000px 0' : '2000px 0' };
}
/** Ieșirile și accentele așteaptă pasul lor cu caseta la vedere. */
export const waitsVisible = (a?: Anim) => isExit(a) || isEmph(a) || isMotionPath(a) || isMediaFx(a);
const ANIM_SECONDS: Partial<Record<Anim, number>> = { appear: 0, exit: 0, play: 0, pause: 0, stop: 0, wheel: 1, spin: 2, grow: 2, teeter: 1, pathLine: 2, pathArc: 2, pathCircle: 2, pathSquare: 2, pathZigzag: 2, pathTurn: 2, pathLoop: 2, pathWave: 2, pathFree: 2 };
/** Câte click-uri are slide-ul (câte casete cu animație) și ce casete sunt încă ascunse după `step` click-uri. */
export type AnimStart = 'with' | 'after';
export const ANIM_STARTS: [AnimStart | '', string][] = [['', 'La click'], ['with', 'Odată cu precedenta'], ['after', 'După precedenta']];
export const ANIM_DURS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5];
export const ANIM_DELAYS = [0, 0.25, 0.5, 1, 1.5, 2, 3, 5];
/** Durata obișnuită a efectului, în secunde (Apare e pe loc, Roata ține o secundă). */
export const animDur = (e: SlideEl) => (e.anim === 'appear' || e.anim === 'exit' || isMediaFx(e.anim) ? 0 : e.animDur ?? ANIM_SECONDS[e.anim!] ?? 0.5);
/** Un pas al animațiilor: un click (sau începutul slide-ului, dacă prima animație nu e la click) și casetele care intră atunci,
 *  fiecare cu secunda la care începe (după „odată cu” / „după precedenta” și întârziere) și durata ei. */
export interface AnimStep { auto: boolean; items: { el: SlideEl; at: number; dur: number; start: AnimStart | 'click'; para?: number }[] }
/** Grupul de paragraf al fiecărui rând nevid al casetei: un punct de pe primul nivel, cu subpunctele de sub el. */
export function paraGroups(text: string): number[] {
  const out: number[] = [];
  let g = -1;
  for (const l of text.split('\n')) { if (!l.trim()) continue; if (g < 0 || !lineLevel(l)) g++; out.push(g); }
  return out;
}
/** Caseta intră pe paragrafe (doar casetele cu listă, doar la intrări, doar dacă are cel puțin două puncte). */
export const byPara = (e: SlideEl) => e.animBy === 'p' && e.kind === 'body' && !!e.anim && !waitsVisible(e.anim) && (paraGroups(e.text).at(-1) ?? 0) > 0;
/** Cheia unui pas animat: caseta sau paragraful ei („id#2”). */
export const animKey = (i: { el: SlideEl; para?: number }) => (i.para === undefined ? i.el.id : i.el.id + '#' + i.para);
/** O animație în plus a casetei (câmpurile ei au același rost ca anim, animStart… ale casetei). */
export interface AnimFx { anim: Anim; animStart?: AnimStart; animDur?: number; animDelay?: number; animDir?: AnimDir; animLen?: AnimLen; animPts?: [number, number][]; animOrder?: number }
/** Câte animații în plus poate avea o casetă. */
export const MAX_FX = 9;
/** Cheia animației a doua, a treia… a casetei: „id~1”, „id~2”; fxBase dă înapoi caseta. */
export const fxKey = (id: string, j: number) => `${id}~${j + 1}`;
export const fxBase = (key: string) => key.split('~')[0];
const fxIndex = (key: string) => (key.includes('~') ? Number(key.split('~')[1]) - 1 : -1);
/** Caseta cu animația ei în plus `j` în locul celei de sus (o copie cu cheia „id~j”, doar pentru calcule). */
function fxEl(e: SlideEl, m: AnimFx, j: number): SlideEl {
  const { animBy: _p, more: _m, animStart: _s, animDur: _d, animDelay: _l, animDir: _r, animLen: _n, animPts: _q, animOrder: _o, ...rest } = e;
  return { ...rest, ...m, id: fxKey(e.id, j) };
}
/** Curăță o animație în plus citită dintr-un fișier. */
export function cleanAnimFx(m: Partial<AnimFx> | null | undefined): AnimFx | null {
  if (!m || !ANIMS.some(([a]) => a && a === m.anim)) return null;
  return {
    anim: m.anim!,
    ...(m.animStart === 'with' || m.animStart === 'after' ? { animStart: m.animStart } : {}),
    ...(typeof m.animDur === 'number' && m.animDur >= 0.1 && m.animDur <= 20 ? { animDur: m.animDur } : {}),
    ...(typeof m.animDelay === 'number' && m.animDelay > 0 && m.animDelay <= 60 ? { animDelay: m.animDelay } : {}),
    ...(hasAnimDir(m.anim) && (m.animDir === 't' || m.animDir === 'l' || m.animDir === 'r') ? { animDir: m.animDir } : {}),
    ...(isMotionPath(m.anim) && (m.animLen === 's' || m.animLen === 'l') ? { animLen: m.animLen } : {}),
    ...(m.anim === 'pathFree' && cleanPathPts(m.animPts) ? { animPts: cleanPathPts(m.animPts)! } : {}),
    ...(Number.isInteger(m.animOrder) && m.animOrder! >= 0 && m.animOrder! < 10000 ? { animOrder: m.animOrder } : {}),
  };
}
/**
 * Casetele animate, în ordinea animațiilor: întâi cele cu loc ales (animOrder), apoi celelalte, în ordinea de pe slide.
 * O casetă cu mai multe animații apare de mai multe ori: o dată ea însăși, apoi câte o copie „id~j” pentru fiecare animație în plus
 * (fără loc ales, vin imediat după cea de dinainte a casetei). Casetele cu mai multe animații nu intră pe paragrafe.
 */
export function animOrdered(els: SlideEl[]): SlideEl[] {
  const out: { e: SlideEl; k: number }[] = [];
  els.forEach((e, i) => {
    if (!e.anim || trigOf(els, e)) return;
    const k = e.animOrder ?? 100000 + i;
    if (!e.more?.length) { out.push({ e, k }); return; }
    const { animBy: _p, ...main } = e;
    out.push({ e: main, k });
    e.more.forEach((m, j) => out.push({ e: fxEl(e, m, j), k: m.animOrder ?? k + (j + 1) / 100 }));
  });
  return out.sort((a, b) => a.k - b.k).map((x) => x.e);
}
/** Declanșatorul valid al casetei: id-ul altei casete de pe același slide; altfel undefined (animația e în rândul slide-ului). */
export function trigOf(els: SlideEl[], e: SlideEl): string | undefined {
  const t = e.animTrig;
  return e.anim && t && t !== e.id && els.some((x) => x.id === t) ? t : undefined;
}
/** Casetele care declanșează animații pe slide (fiecare o singură dată). */
export const triggers = (els: SlideEl[]): string[] => [...new Set(els.map((e) => trigOf(els, e)).filter((t): t is string => !!t))];
/** Animațiile pornite de un declanșator: toate la același click, una după alta dacă nu sunt „odată cu precedenta”. */
export function trigSteps(els: SlideEl[], trig: string): AnimStep['items'] {
  const mine = els.filter((e) => trigOf(els, e) === trig).map(({ animTrig: _t, more: _m, animBy: _p, ...e }, k) => (k && !e.animStart ? { ...e, animStart: 'after' as const } : e));
  return animSteps(mine).flatMap((x) => x.items).map((i, k) => (k ? i : { ...i, start: 'click' as const }));
}
/** Pune locul fiecărei animații (a casetei sau „id~j”) după lista de chei dată. */
function setOrder(els: SlideEl[], order: string[]): SlideEl[] {
  return els.map((e) => {
    if (!e.anim || trigOf(els, e)) return e;
    const more = e.more?.map((m, j) => ({ ...m, animOrder: order.indexOf(fxKey(e.id, j)) }));
    return { ...e, animOrder: order.indexOf(e.id), ...(more ? { more } : {}) };
  });
}
/** Mută o animație (a casetei, sau „id~j”) cu un loc mai sus (-1) sau mai jos (+1); toate animațiile primesc locul lor. */
export function moveAnim(els: SlideEl[], id: string, dir: -1 | 1): SlideEl[] {
  const order = animOrdered(els).map((e) => e.id);
  const i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return els;
  [order[i], order[j]] = [order[j], order[i]];
  return setOrder(els, order);
}
/** Adaugă încă o animație pe casetă (dacă n-are niciuna, devine animația ei); vine după ultima animație a casetei. */
export function addAnim(els: SlideEl[], id: string, anim: Anim): SlideEl[] {
  const e = els.find((x) => x.id === id);
  if (!e || (e.more?.length ?? 0) >= MAX_FX) return els;
  if (!e.anim) return els.map((x) => (x === e ? { ...x, anim } : x));
  // Ca „Adăugare animație” din PowerPoint: animația nouă vine la sfârșitul slide-ului (toate animațiile primesc locul lor).
  const order = [...animOrdered(els).map((x) => x.id), fxKey(id, e.more?.length ?? 0)];
  return setOrder(els.map((x) => (x === e ? { ...x, more: [...(x.more ?? []), { anim }] } : x)), order);
}
/** Scoate o animație: a casetei (atunci prima în plus îi ia locul) sau „id~j”. */
export function removeAnim(els: SlideEl[], key: string): SlideEl[] {
  const id = fxBase(key), j = fxIndex(key);
  return els.map((e) => {
    if (e.id !== id) return e;
    const { anim: _a, animStart: _s, animDur: _d, animDelay: _l, animOrder: _o, animDir: _r, animLen: _n, animPts: _q, animBy: _p, animTrig: _t, more = [], ...rest } = e;
    const left = j < 0 ? more : more.filter((_, k) => k !== j);
    if (j >= 0) return left.length ? { ...e, more: left } : (({ more: _x, ...r }) => r)(e);
    if (!left.length) return rest;
    const [first, ...others] = left;
    return { ...rest, ...first, ...(others.length ? { more: others } : {}) };
  });
}
/** Schimbă un câmp (pornire, durată, întârziere, direcție) al unei animații: a casetei sau „id~j”. */
export function setAnimField(els: SlideEl[], key: string, field: 'animStart' | 'animDur' | 'animDelay' | 'animDir' | 'animLen', v: unknown): SlideEl[] {
  const id = fxBase(key), j = fxIndex(key);
  const put = <T extends object>(o: T): T => { const { [field]: _old, ...r } = o as Record<string, unknown>; return (v === undefined ? r : { ...r, [field]: v }) as T; };
  return els.map((e) => (e.id !== id ? e : j < 0 ? put(e) : e.more?.[j] ? { ...e, more: e.more.map((m, k) => (k === j ? put(m) : m)) } : e));
}
export function animSteps(els: SlideEl[]): AnimStep[] {
  const steps: AnimStep[] = [];
  let groupAt = 0, end = 0;
  const add = (el: SlideEl, start: AnimStart | 'click', delay: number, para?: number) => {
    let cur = steps[steps.length - 1];
    if (start === 'click' || !cur) { cur = { auto: start !== 'click', items: [] }; steps.push(cur); groupAt = 0; end = 0; }
    else if (start === 'after') groupAt = end;
    const at = groupAt + delay, dur = animDur(el);
    end = Math.max(end, at + dur);
    cur.items.push({ el, at, dur, start, ...(para === undefined ? {} : { para }) });
  };
  for (const el of animOrdered(els)) {
    const start: AnimStart | 'click' = el.animStart ?? 'click';
    if (!byPara(el)) { add(el, start, el.animDelay ?? 0); continue; }
    // Pe paragrafe: primul punct pornește ca toată caseta; următoarele la click (sau după precedentul, dacă și caseta pornește singură).
    const n = (paraGroups(el.text).at(-1) ?? 0) + 1;
    for (let k = 0; k < n; k++) add(el, k ? (start === 'click' ? 'click' : 'after') : start, k ? 0 : el.animDelay ?? 0, k);
  }
  return steps;
}
/** Câte click-uri are slide-ul și ce casete sunt încă ascunse după `step` click-uri (cele pornite singure se văd de la început). */
export const animCount = (s: Slide) => animSteps(s.els).filter((x) => !x.auto).length;
export function hiddenEls(s: Slide, step: number): Set<string> {
  return new Set(animSteps(s.els).filter((x) => !x.auto).slice(step).flatMap((x) => x.items.filter((i) => !waitsVisible(i.el.anim)).map(animKey)));
}
/** Casetele cu ieșire sau accent al căror pas a venit (pleacă / se mișcă sau au făcut-o) după `step` click-uri; cele din pașii pornite singure, de la început. */
export function goneEls(s: Slide, step: number): Set<string> {
  let click = 0;
  const out = new Set<string>();
  for (const x of animSteps(s.els)) {
    if (!x.auto && ++click > step) break;
    for (const i of x.items) if (waitsVisible(i.el.anim)) out.add(i.el.id);
  }
  return out;
}
/** Întârzierea și durata fiecărei casete animate (pentru prezentare). */
export function animTimes(s: Slide): Map<string, { at: number; dur: number }> {
  return new Map(animSteps(s.els).flatMap((x) => x.items.map((i) => [animKey(i), { at: i.at, dur: i.dur }] as const)));
}
/**
 * Slide-ul așa cum îl arată prezentarea după `step` click-uri: ce casete sunt ascunse, ce ieșiri / accente au pornit și când.
 * O casetă cu mai multe animații joacă ultima animație a ei care a venit (înainte de prima: stă ca la începutul primei),
 * deci intră, apoi se mișcă, apoi pleacă, fiecare la pasul ei.
 */
/** Props-urile SlideView pentru prezentare (slide, hidden, gone, times). */
export const showProps = (s: Slide, step: number, fired: string[] = []) => showState(s, step, fired);
export function showState(s: Slide, step: number, fired: string[] = []): { slide: Slide; hidden: Set<string>; gone: Set<string>; times: Map<string, { at: number; dur: number }> } {
  const hidden = hiddenEls(s, step), gone = goneEls(s, step), times = animTimes(s);
  // Animațiile cu declanșator: ascunse (intrările) până la click pe declanșator; după el pornesc toate, cu timpii lor.
  for (const t of triggers(s.els)) for (const i of trigSteps(s.els, t)) {
    times.set(i.el.id, { at: i.at, dur: i.dur });
    if (!fired.includes(t)) { if (!waitsVisible(i.el.anim)) hidden.add(i.el.id); } else if (waitsVisible(i.el.anim)) gone.add(i.el.id);
  }
  if (!s.els.some((e) => e.anim && e.more?.length)) return { slide: s, hidden, gone, times };
  const first = new Map<string, SlideEl>(), last = new Map<string, SlideEl>();
  let click = 0, done = false;
  for (const x of animSteps(s.els)) {
    if (!x.auto && ++click > step) done = true;
    for (const i of x.items) { const b = fxBase(i.el.id); if (!first.has(b)) first.set(b, i.el); if (!done) last.set(b, i.el); }
  }
  const els = s.els.map((e) => {
    if (!e.anim || !e.more?.length || trigOf(s.els, e)) return e;
    const now = last.get(e.id), eff = now ?? first.get(e.id)!;
    for (const k of [...hidden]) if (fxBase(k) === e.id) hidden.delete(k);
    for (const k of [...gone]) if (fxBase(k) === e.id) gone.delete(k);
    if (!now && !waitsVisible(eff.anim)) hidden.add(e.id);
    if (now && waitsVisible(eff.anim)) gone.add(e.id);
    const t = times.get(eff.id);
    if (t) times.set(e.id, t);
    const { animBy: _p, more: _m, animStart: _s, animDur: _d, animDelay: _l, animDir: _r, animLen: _n, animPts: _q, ...rest } = e;
    return { ...rest, anim: eff.anim, ...(eff.animPts ? { animPts: eff.animPts } : {}), ...(eff.animStart ? { animStart: eff.animStart } : {}), ...(eff.animDur ? { animDur: eff.animDur } : {}), ...(eff.animDelay ? { animDelay: eff.animDelay } : {}), ...(eff.animDir ? { animDir: eff.animDir } : {}), ...(eff.animLen ? { animLen: eff.animLen } : {}) };
  });
  return { slide: { ...s, els }, hidden, gone, times };
}

/**
 * Pozele unui slide pentru video: câte una după fiecare click (0 … câte click-uri are), ca în prezentare, fiecare cu
 * casetele ajunse la capătul animației; ieșirile venite nu se mai văd. Slide-ul fără animații pe click dă o singură poză (null).
 * Cel mult 20 de poze (restul click-urilor intră în ultima).
 */
export function videoSteps(s: Slide): { slide: Slide; hidden: Set<string>; gone: Set<string> }[] | null {
  const n = animCount(s);
  if (!n) return null;
  return Array.from({ length: Math.min(n, 19) + 1 }, (_, k) => {
    const st = showState(s, k === 19 ? n : k);
    const hidden = new Set(st.hidden);
    for (const e of st.slide.els) if (st.gone.has(e.id) && isExit(e.anim)) hidden.add(e.id);
    return { slide: st.slide, hidden, gone: st.gone };
  });
}

/** Cum apare slide-ul în prezentare; lipsă = estompare (ca până acum). */
export type Transition = 'fade' | 'push' | 'wipe' | 'split' | 'cover' | 'uncover' | 'zoom' | 'flip' | 'vortex' | 'ferris' | 'gallery' | 'doors' | 'cube' | 'curtains' | 'curl' | 'pan' | 'conveyor' | 'rotate' | 'orbit' | 'morph' | 'none';
export const TRANSITIONS: [Transition, string][] = [
  ['fade', 'Estompare'], ['push', 'Împingere'], ['wipe', 'Ștergere'], ['split', 'Împărțire'], ['cover', 'Acoperire'], ['uncover', 'Descoperire'],
  ['zoom', 'Apropiere'],
  // Cele spectaculoase (în .pptx ca efectele din 2010 încoace, cu estompare pentru programele vechi).
  ['flip', 'Răsturnare'], ['vortex', 'Vârtej'], ['ferris', 'Roată'], ['gallery', 'Galerie'], ['doors', 'Uși'],
  ['cube', 'Cub'], ['curtains', 'Cortine'], ['curl', 'Pagină îndoită'],
  // Conținut dinamic: fundalul rămâne pe loc, doar casetele slide-ului se mișcă (slides.css, .tr-dyn).
  ['pan', 'Panoramare'], ['conveyor', 'Bandă rulantă'], ['rotate', 'Rotire'], ['orbit', 'Orbită'],
  // Transformare: ce apare pe ambele slide-uri alunecă și își schimbă mărimea lin (vezi morphPairs).
  ['morph', 'Transformare'],
  ['none', 'Fără'],
];
/** Tranzițiile spectaculoase și eticheta lor din .pptx (p14). */
export const P14_TRANSITIONS: Partial<Record<Transition, string>> = { flip: 'flip', vortex: 'vortex', ferris: 'ferris', gallery: 'gallery', doors: 'doors', cube: 'prism', pan: 'pan', conveyor: 'conveyor', rotate: 'prism', orbit: 'prism' };
/** Tranzițiile din 2013 încoace: în .pptx p15:prstTrans cu numele lor (cu estompare pentru programele vechi). */
export const P15_TRANSITIONS: Partial<Record<Transition, string>> = { curtains: 'curtains', curl: 'pageCurlDouble' };
/** Tranzițiile de conținut dinamic (în .pptx cu isContent la prism; fundalul și coordonatorul nu se mișcă). */
export const DYNAMIC_TRANSITIONS: Transition[] = ['pan', 'conveyor', 'rotate', 'orbit'];
/** Tranzițiile care au direcție (Opțiuni efect în PowerPoint). */
export const DIRECTED: Transition[] = ['push', 'wipe', 'cover', 'uncover'];
/** Încotro se mișcă slide-ul nou (ca atributul dir din PowerPoint); lipsă = spre stânga, adică intră din dreapta. */
export type TrDir = 'l' | 'r' | 'u' | 'd' | 'lu' | 'ru' | 'ld' | 'rd';
export const TR_DIRS: [TrDir, string][] = [['l', 'Din dreapta'], ['r', 'Din stânga'], ['u', 'De jos'], ['d', 'De sus'],
  // Pe diagonală (doar la Ștergere, Acoperire, Descoperire): lu = se mișcă spre stânga-sus, adică vine din dreapta jos.
  ['lu', 'Din dreapta jos'], ['ru', 'Din stânga jos'], ['ld', 'Din dreapta sus'], ['rd', 'Din stânga sus']];
/** Tranzițiile care primesc și direcțiile pe diagonală (Împingerea are doar patru, ca în format). */
export const DIAGONAL_TRANSITIONS: Transition[] = ['wipe', 'cover', 'uncover'];
/** Opțiunile Împărțirii (ca orient + dir din PowerPoint): v / h = linia de mijloc verticală / orizontală, o / i = spre exterior / interior; lipsă = vo. */
export type TrSplit = 'vo' | 'vi' | 'ho' | 'hi';
export const TR_SPLITS: [TrSplit, string][] = [['vo', 'Pe verticală, spre exterior'], ['vi', 'Pe verticală, spre interior'], ['ho', 'Pe orizontală, spre exterior'], ['hi', 'Pe orizontală, spre interior']];
/** Forma de început și de sfârșit a Împărțirii (clip-path cu același număr de puncte, ca să se poată anima). */
const SPLIT_CLIPS: Record<TrSplit, [string, string]> = {
  vo: ['inset(0 50% 0 50%)', 'inset(0)'],
  ho: ['inset(50% 0 50% 0)', 'inset(0)'],
  // Spre interior: două benzi care pornesc de la margini și se întâlnesc la mijloc.
  vi: ['polygon(0 0, 0 0, 0 100%, 100% 100%, 100% 0, 100% 0, 100% 100%, 0 100%)', 'polygon(0 0, 50% 0, 50% 100%, 50% 100%, 50% 0, 100% 0, 100% 100%, 0 100%)'],
  hi: ['polygon(0 0, 100% 0, 100% 0, 0 0, 0 100%, 100% 100%, 100% 100%, 0 100%)', 'polygon(0 0, 100% 0, 100% 50%, 0 50%, 0 50%, 100% 50%, 100% 100%, 0 100%)'],
};
/** Durata tranziției (ca spd din PowerPoint: rapid / mediu / lent); lipsă = medie. */
export type TrSpeed = 'fast' | 'med' | 'slow';
export const TR_SPEEDS: [TrSpeed, string][] = [['fast', 'Rapidă (0,5 s)'], ['med', 'Medie (0,75 s)'], ['slow', 'Lentă (1 s)']];
const TR_SECONDS: Record<TrSpeed, number> = { fast: 0.5, med: 0.75, slow: 1 };
export const trSeconds = (s: Slide) => s.trDur ?? TR_SECONDS[s.trSpeed ?? 'med'];
/** Durata aleasă în secunde (0,1–10 s, rotunjită la sutimi) sau undefined dacă nu e validă. */
export const cleanTrDur = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0.1 && v <= 10 ? Math.round(v * 100) / 100 : undefined);
/** Variabilele CSS pentru tranziția slide-ului: durata și de unde intră (--tx/--ty, --clip pentru Ștergere). */
/**
 * Perechile pentru tranziția Transformare: [element de pe slide-ul vechi, element de pe cel nou]. Se potrivesc întâi după
 * identitate (slide duplicat), apoi după fel și conținut (același text, aceeași poză, aceeași formă), apoi titlul cu titlul.
 */
export function morphPairs(a: Slide, b: Slide): [string, string][] {
  const plain = (t: string) => t.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const key = (e: SlideEl) => e.kind + '|' + (e.kind === 'image' ? (e.src ?? '').slice(-400) : (e.kind === 'shape' ? (e.shape ?? '') + '|' : '') + plain(e.text));
  const olds = a.els.filter((e) => !e.hide), news = b.els.filter((e) => !e.hide);
  const out: [string, string][] = [];
  const usedA = new Set<string>(), usedB = new Set<string>();
  const take = (o: SlideEl, n: SlideEl) => { out.push([o.id, n.id]); usedA.add(o.id); usedB.add(n.id); };
  for (const n of news) { const o = olds.find((x) => x.id === n.id && x.kind === n.kind); if (o) take(o, n); }
  for (const n of news) {
    if (usedB.has(n.id)) continue;
    const o = olds.find((x) => !usedA.has(x.id) && key(x) === key(n) && (n.kind !== 'text' || plain(n.text) !== ''));
    if (o) take(o, n);
  }
  for (const n of news) {
    if (usedB.has(n.id) || n.kind !== 'title') continue;
    const o = olds.find((x) => !usedA.has(x.id) && x.kind === 'title');
    if (o) take(o, n);
  }
  return out;
}

export function trStyle(s: Slide): import('react').CSSProperties {
  const d: string = s.trDir && (s.trDir.length === 1 || DIAGONAL_TRANSITIONS.includes(s.transition ?? 'fade')) ? s.trDir : (s.trDir ?? 'l').charAt(0);
  const tx = d.includes('l') ? '100vw' : d.includes('r') ? '-100vw' : '0px', ty = d.includes('u') ? '100vh' : d.includes('d') ? '-100vh' : '0px';
  // Ștergerea pornește din colțul sau latura de unde vine slide-ul.
  const clip = `inset(${d.includes('u') ? '100%' : '0'} ${d.includes('r') ? '100%' : '0'} ${d.includes('d') ? '100%' : '0'} ${d.includes('l') ? '100%' : '0'})`;
  const [sa, sb] = SPLIT_CLIPS[s.trSplit ?? 'vo'] ?? SPLIT_CLIPS.vo;
  return { '--tr-dur': `${trSeconds(s)}s`, '--tx': tx, '--ty': ty, '--clip': clip, '--split-a': sa, '--split-b': sb } as import('react').CSSProperties;
}

export interface Slide {
  id: string;
  layout: LayoutId;
  els: SlideEl[];
  notes: string;
  transition?: Transition;
  /** Direcția tranziției (doar la Împingere, Ștergere, Acoperire, Descoperire); lipsă = din dreapta. */
  trDir?: TrDir;
  /** Opțiunile Împărțirii; lipsă = pe verticală, spre exterior. */
  trSplit?: TrSplit;
  /** Durata tranziției; lipsă = medie. */
  trSpeed?: TrSpeed;
  /** Durata tranziției în secunde, aleasă liber (ca Duration din PowerPoint); are prioritate față de trSpeed. */
  trDur?: number;
  /** Sunetul tranziției (ca Sound din PowerPoint): unul gata făcut (vezi trSound.ts) sau unul propriu (data:audio/…). */
  trSound?: string;
  /** Fundalul slide-ului (culoare plină, ca Formatare fundal din PowerPoint); lipsă = fundalul temei. */
  bg?: string;
  /** Fundal în degrade: a doua culoare (prima e `bg`) și direcția (lipsă = de sus în jos). */
  bg2?: string;
  bgDir?: BgDir;
  /** Poză ca fundal (data:image/…), întinsă pe tot slide-ul; are întâietate față de culoare și degrade. */
  bgImg?: string;
  /** Slide ascuns (ca Ascunde slide-ul din PowerPoint): rămâne în editor, dar prezentarea trece peste el. */
  hidden?: boolean;
  /** Avans automat: după câte secunde trece singur mai departe (ca „După” din Tranziții în PowerPoint); lipsă = la click. */
  advance?: number;
  /** Aici începe o secțiune cu acest nume (ca Sections din PowerPoint); vezi `sections.ts`. */
  section?: string;
  /** Comentariile slide-ului (vezi comments.ts); nu apar pe slide. */
  comments?: import('./comments').SlideComment[];
  /** Ascunde grafica de fundal: casetele coordonatorului (deck.master) nu apar pe acest slide (ca Hide Background Graphics). */
  noMaster?: boolean;
}

/** Variantele de avans din listă (secunde; 0 = la click). */
export const ADVANCES = [0, 2, 3, 5, 8, 10, 15, 20, 30, 60];
/** Câte secunde de avans automat se acceptă din fișiere (cel mult o oră). */
export const cleanAdvance = (v: unknown) => (typeof v === 'number' && v >= 0.5 && v <= 3600 ? Math.round(v * 10) / 10 : undefined);

export interface Deck {
  format: 'suite-slides';
  version: 1;
  theme: ThemeId;
  /** Lipsă = lat 16:9. */
  size?: SlideFormat;
  /** Mărimea slide-ului când `size` e 'custom' (pixeli, 96 = 1 inci). */
  custom?: Size;
  /** Fonturile temei (titluri + text), alese peste cele ale temei (ca Variante → Fonturi); lipsă = ale temei. Vezi FONT_SETS. */
  fonts?: string;
  /** Varianta temei (1–3; ca Variants din PowerPoint): aceeași temă în alte culori; lipsă = varianta de bază. Vezi THEME_VARIANTS. */
  variant?: number;
  /** Culorile temei (fundal, text, titluri, accent), alese peste cele ale temei (ca Variante → Culori); lipsă = ale temei. Vezi COLOR_SETS. */
  colors?: string;
  /** Setul de culori creat de utilizator (folosit când `colors` e CUSTOM_COLORS); rămâne în prezentare și când alegi alt set. */
  customColors?: CustomColors;
  /** Numărul slide-ului în colțul de jos (Inserare → Număr slide în PowerPoint); nu apare pe slide-urile de titlu. */
  numbers?: boolean;
  /** Prezentarea o ia de la capăt după ultimul slide, până la Esc (ca „Buclă continuă” / kiosk din PowerPoint). */
  loop?: boolean;
  /** Chioșc: prezentarea merge singură (după secundele fiecărui slide), în buclă; clicurile și tastele nu o mută, doar legăturile merg și Esc o oprește. */
  kiosk?: boolean;
  /** Prezentarea nu folosește secundele de avans automat ale slide-urilor (Set Up Slide Show → Use Timings oprit): treci doar cu click / tastă. */
  noTimings?: boolean;
  /** Prezentarea nu redă narațiunile înregistrate (Set Up Slide Show → Play Narrations oprit). */
  noNarr?: boolean;
  /** Prezintă doar slide-urile de la `from` la `to` (numere de la 1, ca „Show slides From … To” din Set Up Slide Show); lipsă = toate. */
  range?: { from: number; to: number };
  /** Ghidajele (Vizualizare → Ghidaje): liniile de care se lipesc casetele, aceleași pe toate slide-urile; vezi guides.ts. */
  guides?: Guides;
  /** Antet și subsol (ca în PowerPoint): textul de jos, la mijloc, și data din stânga jos ('auto' = data de azi, altfel textul scris).
   *  Ca numărul slide-ului, nu apar pe slide-urile de titlu. */
  footer?: string;
  date?: string;
  /** Prezentări personalizate (Custom Slide Show): un nume și slide-urile alese (id-uri), în ordinea în care se arată. */
  shows?: CustomShow[];
  /** Coordonatorul de diapozitive (ca Slide Master): casetele lui (siglă, text, forme) apar în spatele fiecărui slide; vezi masterEls. */
  master?: { els: SlideEl[] };
  /** Aspectele coordonatorului (ca Slide Layouts): casete care apar doar pe slide-urile cu acel aspect, peste cele ale coordonatorului. */
  layoutMasters?: Partial<Record<LayoutId, SlideEl[]>>;
  /** Coordonatorul de pliante (Handout Master): antet, subsol, dată, număr de pagină și câte slide-uri pe pagină; vezi printMaster.ts. */
  handoutMaster?: HandoutMaster;
  /** Vizualizare → Macrocomenzi: macrocomenzile păstrate în prezentare (macros.ts). */
  macros?: SlideMacro[];
  /** Coordonatorul de notițe (Notes Master): colțurile paginilor de notițe, poza slide-ului și notițele arătate sau nu. */
  notesMaster?: NotesMaster;
  /** Fișier → Proprietăți…: titlul, subiectul, autorul, cuvintele cheie și clasificarea; în .pptx: docProps/core.xml și custom.xml. */
  props?: DocProps;
  /** Doar în prezentare (nu se salvează): numărul real al fiecărui slide, când se arată o prezentare personalizată. */
  numOf?: Record<string, number>;
  slides: Slide[];
  updatedAt: string;
}

export interface CustomShow { name: string; slides: string[] }

/** Prezentările personalizate curățate: nume nevid, doar slide-uri care există, fără liste goale. */
export function cleanShows(v: unknown, slides: Pick<Slide, 'id'>[]): CustomShow[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const ids = new Set(slides.map((s) => s.id));
  const out = v.filter((x) => x && typeof x.name === 'string' && x.name.trim() && Array.isArray(x.slides)).slice(0, 50)
    .map((x) => ({ name: String(x.name).trim().slice(0, 80), slides: [...new Set((x.slides as unknown[]).filter((id): id is string => typeof id === 'string' && ids.has(id)))] }))
    .filter((x) => x.slides.length);
  return out.length ? out : undefined;
}

/**
 * Prezentarea văzută printr-o prezentare personalizată: doar slide-urile ei, în ordinea ei (și cele ascunse, dacă au fost alese anume).
 * Numărul de pe slide rămâne cel real (`numOf`).
 */
/** Intervalul de slide-uri valid pentru o prezentare cu `n` slide-uri (1 ≤ from ≤ to ≤ n); null dacă lipsește, e greșit sau le cuprinde pe toate. */
export function cleanRange(r: unknown, n: number): { from: number; to: number } | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as { from?: unknown; to?: unknown };
  const from = Math.round(Number(o.from)), to = Math.round(Number(o.to));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from || from > n) return null;
  const t = Math.min(n, to);
  return from === 1 && t === n ? null : { from, to: t };
}
/** Slide-urile din intervalul ales pentru prezentare (fără cele ascunse); null = toată prezentarea. */
export function rangeIds(deck: Deck): string[] | null {
  const r = cleanRange(deck.range, deck.slides.length);
  if (!r) return null;
  return deck.slides.slice(r.from - 1, r.to).filter((s) => !s.hidden).map((s) => s.id);
}

export function deckForShow(deck: Deck, only: string[]): Deck {
  const byId = new Map(deck.slides.map((s, i) => [s.id, { s, n: i + 1 }]));
  const picked = only.map((id) => byId.get(id)).filter((x): x is { s: Slide; n: number } => !!x);
  return { ...deck, numOf: Object.fromEntries(picked.map(({ s, n }) => [s.id, n])), slides: picked.map(({ s }) => (s.hidden ? { ...s, hidden: undefined } : s)) };
}

/** Următorul slide care se arată în prezentare după `i` (sare peste cele ascunse); `deck.slides.length` = ecranul de final. */
export function nextShown(deck: Pick<Deck, 'slides'>, i: number): number {
  let j = i + 1;
  while (j < deck.slides.length && deck.slides[j].hidden) j++;
  return j;
}
/** Slide-ul care se arată înaintea lui `i`; -1 dacă nu mai e niciunul. */
export function prevShown(deck: Pick<Deck, 'slides'>, i: number): number {
  let j = Math.min(i, deck.slides.length) - 1;
  while (j >= 0 && deck.slides[j].hidden) j--;
  return j;
}

/** Data de azi, ca în România (19.10.2026). */
export const todayRo = () => new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
/** Ce se scrie jos pe slide: numărul, subsolul și data (nimic pe slide-urile de titlu). */
export function slideMarks(deck: Deck, s: Slide): { num?: number; footer?: string; date?: string; master?: SlideEl[] } {
  const master = masterEls(deck, s);
  if (s.layout === 'title') return master ? { master } : {};
  return {
    ...(master ? { master } : {}),
    num: slideNum(deck, s),
    ...(deck.footer?.trim() ? { footer: deck.footer } : {}),
    ...(deck.date?.trim() ? { date: deck.date === 'auto' ? todayRo() : deck.date } : {}),
  };
}

/** Prezentarea cu casetele coordonatorului copiate pe fiecare slide (în spatele celorlalte, fără animații), pentru formatele
 *  care nu au coordonator propriu (.pptx deocamdată, .odp). Id-urile copiilor sunt noi, ca să nu se ciocnească. */
export function flattenMaster(deck: Deck): Deck {
  if (!deck.master?.els.length && !deck.layoutMasters) return deck;
  return { ...deck, master: undefined, layoutMasters: undefined, slides: deck.slides.map((s, i) => {
    const m = masterEls(deck, s);
    if (!m) return s;
    const els = m.map((e) => { const { anim: _a, animStart: _s, animDur: _d, animDelay: _l, animDir: _r, animLen: _n, animPts: _q, animOrder: _o, animBy: _b, animTrig: _t, more: _m, ...rest } = e; return { ...rest, id: `m${i}-${e.id}` }; });
    return { ...s, els: [...els, ...s.els] };
  }) };
}

/** Id-ul „slide-ului” coordonatorului în editor (nu e în deck.slides). */
export const MASTER_ID = '__master';
/** Id-ul „slide-ului” unui aspect al coordonatorului în editor (de exemplu `__master:title`). */
export const layoutMasterId = (l: LayoutId) => `${MASTER_ID}:${l}`;
/** Aspectul editat, dacă `id` e al unui aspect al coordonatorului. */
export const layoutOfMasterId = (id: string): LayoutId | null => {
  const l = id.startsWith(MASTER_ID + ':') ? id.slice(MASTER_ID.length + 1) : '';
  return LAYOUTS.some(([x]) => x === l) ? (l as LayoutId) : null;
};
/** Casetele coordonatorului care se văd pe slide: ale coordonatorului, apoi ale aspectului slide-ului (nimic dacă nu are sau
 *  slide-ul ascunde grafica de fundal). Când se editează un aspect, în spate se văd doar cele ale coordonatorului. */
export function masterEls(deck: Deck, s: Pick<Slide, 'noMaster' | 'id' | 'layout'>): SlideEl[] | undefined {
  if (s.id === MASTER_ID || s.noMaster) return undefined;
  const lay = layoutOfMasterId(s.id) ? undefined : deck.layoutMasters?.[s.layout];
  const all = [...(deck.master?.els ?? []), ...(lay ?? [])].filter((e) => !e.hide);
  return all.length ? all : undefined;
}
/** Aspectele coordonatorului curățate (doar aspecte cunoscute, cu casete valide); undefined dacă nu rămâne niciunul. */
export function cleanLayoutMasters(v: unknown): Deck['layoutMasters'] {
  if (!v || typeof v !== 'object') return undefined;
  const out: Partial<Record<LayoutId, SlideEl[]>> = {};
  for (const [l] of LAYOUTS) {
    const els = cleanEls((v as Record<string, unknown>)[l]);
    if (els.length) out[l] = els;
  }
  return Object.keys(out).length ? out : undefined;
}
/** Prezentarea cu casetele aspectului `l` schimbate (fără câmp gol). */
export function withLayoutMaster(deck: Deck, l: LayoutId, els: SlideEl[]): Deck {
  const { [l]: _old, ...rest } = deck.layoutMasters ?? {};
  const lm = els.length ? { ...rest, [l]: els } : rest;
  return { ...deck, layoutMasters: Object.keys(lm).length ? lm : undefined };
}

/** Numărul scris pe slide, dacă prezentarea are numere; pe slide-urile de titlu nu apare (ca în PowerPoint). */
export const slideNum = (deck: Deck, s: Slide): number | undefined => (deck.numbers && s.layout !== 'title' ? deck.numOf?.[s.id] ?? deck.slides.indexOf(s) + 1 : undefined);

export type ThemeId = 'simplu' | 'albastru' | 'noapte' | 'cald' | 'natura' | 'elegant' | 'birou' | 'ardezie' | 'ocean' | 'vin' | 'creta' | 'retro' | 'lavanda' | 'grafit' | 'nisip' | 'contrast'
  | 'menta' | 'corai' | 'pruna' | 'maslin' | 'cer' | 'cafea' | 'smarald' | 'zmeura' | 'chihlimbar' | 'ghetar' | 'indigo' | 'piatra' | 'salvie' | 'otel' | 'teracota' | 'turcoaz' | 'mustar' | 'piersica' | 'bleumarin' | 'bordo' | 'cupru' | 'neon' | 'safir' | 'rodie' | 'brad' | 'ametist' | 'cerneala' | 'fistic' | 'grau' | 'perla' | 'cobalt' | 'petrol' | 'caramel' | 'tei' | 'laguna' | 'mandarina' | 'aurora' | 'cires' | 'furtuna' | 'bujor' | 'abanos' | 'vulcan' | 'iris' | 'scortisoara' | 'musetel' | 'delta' | 'miere' | 'marinar' | 'crama' | 'circuit' | 'rubin' | 'bronz' | 'alpin' | 'ger' | 'smalt' | 'cosmos' | 'izvor' | 'stejar' | 'bistro' | 'asfalt' | 'ipsos' | 'jar' | 'scanteie' | 'tipar' | 'carton' | 'pergament' | 'cetina' | 'piele' | 'lustru' | 'satin' | 'argila' | 'ceai' | 'moara' | 'hipodrom';
export interface Theme {
  id: ThemeId;
  name: string;
  bg: string;
  fg: string;
  title: string;
  accent: string;
  titleFont: string;
  bodyFont: string;
}

// Puține teme, dar îngrijite: culori care se citesc bine și pe proiector, fonturi care există pe orice Windows.
export const THEMES: Theme[] = [
  { id: 'simplu', name: 'Simplu', bg: '#ffffff', fg: '#1f2937', title: '#111827', accent: '#2563eb', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'albastru', name: 'Albastru', bg: '#0f3d7a', fg: '#e6eefb', title: '#ffffff', accent: '#5eb3ff', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'noapte', name: 'Noapte', bg: '#16181d', fg: '#d6d9df', title: '#ffffff', accent: '#f59e0b', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'cald', name: 'Cald', bg: '#fbf6ee', fg: '#4a3b30', title: '#9a3412', accent: '#ea580c', titleFont: 'Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'natura', name: 'Natură', bg: '#f1f7f2', fg: '#1f3b2c', title: '#14532d', accent: '#16a34a', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'elegant', name: 'Elegant', bg: '#1b2238', fg: '#e8e3d3', title: '#f4e3b2', accent: '#c9a54c', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'birou', name: 'Birou', bg: '#ffffff', fg: '#263238', title: '#0b3d5c', accent: '#0e7c86', titleFont: 'Calibri, "Segoe UI", sans-serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'ardezie', name: 'Ardezie', bg: '#2f3e46', fg: '#e3ebe6', title: '#ffffff', accent: '#84a98c', titleFont: 'Corbel, "Segoe UI", sans-serif', bodyFont: 'Corbel, "Segoe UI", sans-serif' },
  { id: 'ocean', name: 'Ocean', bg: '#eaf4f8', fg: '#173f5f', title: '#0b3954', accent: '#087e8b', titleFont: '"Trebuchet MS", "Segoe UI", sans-serif', bodyFont: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { id: 'vin', name: 'Vin', bg: '#3d0c11', fg: '#f3e6d8', title: '#ffffff', accent: '#e0b354', titleFont: 'Constantia, Georgia, serif', bodyFont: 'Candara, Calibri, sans-serif' },
  { id: 'creta', name: 'Cretă', bg: '#24372b', fg: '#eef3ea', title: '#ffffff', accent: '#f7d154', titleFont: '"Segoe Print", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'retro', name: 'Retro', bg: '#fdf0d5', fg: '#003049', title: '#9b1d20', accent: '#d96c06', titleFont: '"Franklin Gothic Medium", "Segoe UI", sans-serif', bodyFont: 'Georgia, serif' },
  // 28.10: Lavandă, Grafit, Nisip și Contrast mare (alb și galben pe negru, pentru săli luminoase sau pentru cine vede mai greu).
  { id: 'lavanda', name: 'Lavandă', bg: '#f5f3ff', fg: '#2e1065', title: '#4c1d95', accent: '#7c3aed', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'grafit', name: 'Grafit', bg: '#1f2933', fg: '#e4e7eb', title: '#ffffff', accent: '#3ebd93', titleFont: 'Bahnschrift, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'nisip', name: 'Nisip', bg: '#f3e7d3', fg: '#3f3a33', title: '#7c4a1e', accent: '#b7791f', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'contrast', name: 'Contrast mare', bg: '#000000', fg: '#ffffff', title: '#ffff00', accent: '#00e5ff', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 30.10: Mentă (verde deschis, proaspăt), Corai (piersică și roșu-corai), Prună (violet închis cu roz) și Măslin (verde-oliv cu auriu).
  { id: 'menta', name: 'Mentă', bg: '#effaf5', fg: '#16362a', title: '#065f46', accent: '#0f9d76', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'corai', name: 'Corai', bg: '#fff4ef', fg: '#3b2622', title: '#9f2d20', accent: '#e8553e', titleFont: '"Trebuchet MS", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'pruna', name: 'Prună', bg: '#2a1533', fg: '#f1e6f5', title: '#ffffff', accent: '#f08bc0', titleFont: 'Candara, Calibri, sans-serif', bodyFont: 'Candara, Calibri, sans-serif' },
  { id: 'maslin', name: 'Măslin', bg: '#f4f3e8', fg: '#2f3220', title: '#3f4a12', accent: '#8a7a1e', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 30.10, seara: Cer (albastru deschis, aerisit), Cafea (maro închis cu crem), Smarald (verde închis cu auriu) și Zmeură (roz-roșu pe alb).
  { id: 'cer', name: 'Cer', bg: '#eef6fd', fg: '#1e3a5f', title: '#0b4f8a', accent: '#1d8fe1', titleFont: '"Segoe UI Light", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'cafea', name: 'Cafea', bg: '#2b1d16', fg: '#efe2d0', title: '#f7ead7', accent: '#d4a373', titleFont: 'Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'smarald', name: 'Smarald', bg: '#0b3b2e', fg: '#e3f2ea', title: '#ffffff', accent: '#e9c46a', titleFont: 'Cambria, Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  // 31.10: Chihlimbar (galben-portocaliu cald pe maro închis) și Ghețar (turcoaz rece pe alb-albăstrui).
  { id: 'chihlimbar', name: 'Chihlimbar', bg: '#24170a', fg: '#f6e7cf', title: '#ffd27a', accent: '#f59e0b', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'ghetar', name: 'Ghețar', bg: '#f2fbfd', fg: '#14323d', title: '#0e5566', accent: '#06a3b7', titleFont: '"Segoe UI Light", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 31.10 seara: Indigo (albastru-violet închis, cu lavandă) și Piatră (gri cald, aerisit, cu roșu-cireașă).
  { id: 'indigo', name: 'Indigo', bg: '#1e1b4b', fg: '#e0e7ff', title: '#ffffff', accent: '#a5b4fc', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'piatra', name: 'Piatră', bg: '#f5f5f4', fg: '#292524', title: '#1c1917', accent: '#be123c', titleFont: 'Corbel, "Segoe UI", sans-serif', bodyFont: 'Corbel, "Segoe UI", sans-serif' },
  // 31.10, 20:15: Salvie (verde-gri liniștit, cu titluri Georgia) și Oțel (albastru-gri închis, cu portocaliu).
  { id: 'salvie', name: 'Salvie', bg: '#eef2ec', fg: '#2e3b31', title: '#1f2d23', accent: '#5b7f68', titleFont: 'Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'otel', name: 'Oțel', bg: '#1c2733', fg: '#d9e2ec', title: '#ffffff', accent: '#f97316', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 02.11, 16:15: Teracotă (crem cald, titluri Georgia cărămizii) și Turcoaz (verde-albăstrui închis, cu coral).
  { id: 'teracota', name: 'Teracotă', bg: '#fbf1ea', fg: '#3f2a1f', title: '#9a3412', accent: '#c2410c', titleFont: 'Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'turcoaz', name: 'Turcoaz', bg: '#0f3d3e', fg: '#d5f3ef', title: '#ffffff', accent: '#fb7185', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 02.11, 19:00: Muștar (crem deschis, titluri gri-cărbune, accent galben-muștar).
  // 03.11: Piersică (crem-piersică, titluri cărămizii, accent portocaliu-somon).
  { id: 'piersica', name: 'Piersică', bg: '#fff4ec', fg: '#3d2b25', title: '#7a2e1b', accent: '#e8784d', titleFont: 'Calibri, "Segoe UI", sans-serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 03.11, 08:45: Bleumarin (alb, titluri Cambria bleumarin, accent auriu): sobră, pentru prezentări de firmă.
  { id: 'bleumarin', name: 'Bleumarin', bg: '#ffffff', fg: '#1f2937', title: '#1b2a4a', accent: '#c9a227', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 03.11, 11:10: Bordo (crem, titluri Georgia bordo, accent auriu vechi): caldă și elegantă, pentru aniversări, gale și oferte.
  { id: 'bordo', name: 'Bordo', bg: '#fdf8f3', fg: '#2b2024', title: '#6b1d2a', accent: '#b08d57', titleFont: 'Georgia, Cambria, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 03.11, 17:39: Cupru (fundal antracit, titluri Palatino culoarea cuprului lustruit, accent cupru): întunecată și caldă, pentru proiecte tehnice, industrie și design.
  { id: 'cupru', name: 'Cupru', bg: '#22262b', fg: '#e7e1dc', title: '#f3c9a8', accent: '#c77d4a', titleFont: '"Palatino Linotype", Palatino, Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  // 03.11, 23:26: Neon (fundal bleumarin aproape negru, titluri cyan aprins, accent verde-lime): pentru tehnologie, jocuri, lansări și seri de petrecere.
  // 04.11, 03:30: Safir (albastru-safir închis cu titluri aurii și accent albastru deschis): pentru bănci, avocați, consultanță și gale.
  { id: 'safir', name: 'Safir', bg: '#0c1a3d', fg: '#e5e9f5', title: '#f2c14e', accent: '#60a5fa', titleFont: 'Georgia, Cambria, serif', bodyFont: '"Segoe UI", sans-serif' },
  // 04.11, 04:25: Rodie (fildeș cald, titluri Book Antiqua roșu-rodie, accent verde-petrol): pentru restaurante, cramă, nunți și oferte de toamnă.
  { id: 'rodie', name: 'Rodie', bg: '#fffaf5', fg: '#2d1f1f', title: '#9f1239', accent: '#0f766e', titleFont: '"Book Antiqua", Palatino, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 04.11, 05:15: Brad (alb-mesteacăn, titluri Cambria verde de brad, accent chihlimbar): pentru pensiuni la munte, ocoale silvice, firme de mobilă și oferte de iarnă.
  { id: 'brad', name: 'Brad', bg: '#fbfaf6', fg: '#1c2a22', title: '#14532d', accent: '#b45309', titleFont: 'Cambria, Georgia, serif', bodyFont: '"Segoe UI", Calibri, sans-serif' },
  // 04.11, 06:25: Ametist (alb-liliachiu, titluri Georgia violet-ametist, accent verde-apă): pentru saloane, cosmetică, florării și evenimente.
  { id: 'ametist', name: 'Ametist', bg: '#faf7fd', fg: '#2a2238', title: '#6b21a8', accent: '#0d9488', titleFont: 'Georgia, Cambria, serif', bodyFont: '"Segoe UI", Calibri, sans-serif' },
  // 04.11, 07:08: Cerneală (hârtie albă-crem, titluri Palatino albastru-cerneală, accent roșu de sigiliu): pentru cabinete de avocatură, notariate, edituri și arhive.
  { id: 'cerneala', name: 'Cerneală', bg: '#fbfaf7', fg: '#1f2430', title: '#1e293b', accent: '#b91c1c', titleFont: '"Palatino Linotype", "Book Antiqua", Georgia, serif', bodyFont: '"Segoe UI", Calibri, sans-serif' },
  { id: 'neon', name: 'Neon', bg: '#0f172a', fg: '#e2e8f0', title: '#22d3ee', accent: '#a3e635', titleFont: 'Bahnschrift, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'mustar', name: 'Muștar', bg: '#fbf7e9', fg: '#2b2a24', title: '#2b2a24', accent: '#c99a06', titleFont: '"Trebuchet MS", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'zmeura', name: 'Zmeură', bg: '#fff5f8', fg: '#3a1a26', title: '#9d174d', accent: '#db2777', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 03:18: Fistic (crem-verzui, titluri Candara verde-fistic, accent maro de coajă): pentru cofetării, produse bio, grădinițe și oferte de primăvară.
  { id: 'fistic', name: 'Fistic', bg: '#f5f8ec', fg: '#2b3320', title: '#3d6b21', accent: '#a05a2c', titleFont: 'Candara, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 04:14: Grâu (crem cald, titluri Book Antiqua auriu de spic, accent verde de câmp): pentru brutării, ferme, produse tradiționale și oferte de toamnă.
  { id: 'grau', name: 'Grâu', bg: '#fbf6e6', fg: '#33291a', title: '#8a5a00', accent: '#4d7c2a', titleFont: '"Book Antiqua", Palatino, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 04:42: Perlă (gri-perlă deschis, titluri Georgia gri-albăstrui, accent roz-auriu): pentru nunți, saloane de cosmetică, bijuterii și invitații elegante.
  { id: 'perla', name: 'Perlă', bg: '#f4f3f1', fg: '#2d2f36', title: '#3b4252', accent: '#a8576a', titleFont: 'Georgia, "Times New Roman", serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 04:59: Cobalt (alb-albăstrui, titluri Tahoma albastru-cobalt, accent portocaliu): pentru firme de construcții și instalații, logistică, rapoarte tehnice.
  { id: 'cobalt', name: 'Cobalt', bg: '#f5f8fc', fg: '#1c2433', title: '#0047ab', accent: '#e07a1f', titleFont: 'Tahoma, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 05:27: Petrol (alb-verzui, titluri Verdana albastru-petrol, accent roșu-coral): pentru energie, consultanță, rapoarte financiare.
  // 05.11, 06:25: Caramel (crem cald, titluri Trebuchet maro-caramel, accent verde-albastru): pentru cafenele, patiserii, ateliere, meniuri.
  // 05.11, 10:08: Cireș (alb-rozaliu, titluri Palatino roz-cireașă, accent verde de frunză): pentru florării, cofetării, saloane de înfrumusețare, nunți și evenimente de primăvară.
  { id: 'cires', name: 'Cireș', bg: '#fff6f8', fg: '#2b1d22', title: '#b0305c', accent: '#3f7d3a', titleFont: '"Palatino Linotype", Palatino, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 10:30: Furtună (gri-albăstrui de nor, titluri Verdana albastru-ardezie, accent galben de fulger): pentru firme de construcții, IT, asigurări, prezentări tehnice și rapoarte serioase.
  { id: 'furtuna', name: 'Furtună', bg: '#eef1f5', fg: '#1c2430', title: '#33415c', accent: '#d4a100', titleFont: 'Verdana, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 12:40: Mușețel (crem-gălbui, titluri Georgia verde-măsliniu, accent galben-auriu): pentru ceainării, farmacii naturiste, plafare, grădinițe, florării și prezentări de vară.
  { id: 'musetel', name: 'Mușețel', bg: '#fdfbef', fg: '#23281a', title: '#4a6b1f', accent: '#d9a400', titleFont: 'Georgia, "Times New Roman", serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 13:10: Deltă (alb-verzui de apă, titluri Cambria verde-albăstrui de baltă, accent auriu de stuf): pentru turism în deltă, pescuit, pensiuni, ecologie și prezentări despre ape.
  { id: 'delta', name: 'Deltă', bg: '#f3f7f5', fg: '#1a2a2a', title: '#1d5c63', accent: '#a8862d', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 14:15: Marinar (alb-albăstrui de briză, titluri Tahoma bleumarin de uniformă, accent roșu de colac de salvare): pentru porturi, școli de navigație, croaziere, pensiuni la mare și afișe de vacanță.
  { id: 'marinar', name: 'Marinar', bg: '#f5f8fb', fg: '#14213d', title: '#0f3460', accent: '#c8102e', titleFont: 'Tahoma, Verdana, "Segoe UI", sans-serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 15:05: Cramă (alb de piatră caldă, titluri Palatino vânăt de struguri copți, accent verde de viță): pentru crame, podgorii, degustări, meniuri de vinuri și culesul viei.
  // 05.11, 15:20: Circuit (alb-verzui, titluri Segoe UI verde de placă electronică, accent aramă): pentru service-uri IT, magazine de calculatoare, cursuri de informatică și prezentări tehnice.
  // 05.11, 16:10: Bronz (alb cald, titluri Cambria arămiu-bronz, accent verde de patină): pentru muzee, expoziții, istorie, aniversări de firmă și premii.
  // 05.11, 17:12: Ger (alb de zăpadă, titluri Verdana albastru de gheață, accent roșu de fular): pentru vacanțe de iarnă, pârtii, cabane, școli de schi și serbări de iarnă.
  { id: 'ger', name: 'Ger', bg: '#f6f9fc', fg: '#17212e', title: '#2b4c7e', accent: '#b3263c', titleFont: 'Verdana, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 17:43: Smalț (alb curat cu o umbră de turcoaz, titluri Tahoma verde-albastru de cabinet, accent corai): pentru cabinete stomatologice și medicale, clinici, saloane și sfaturi de sănătate.
  { id: 'smalt', name: 'Smalț', bg: '#f7fbfb', fg: '#18282b', title: '#0e6e78', accent: '#e0675a', titleFont: 'Tahoma, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 18:51: Stejar (crem de lemn deschis, titluri Cambria maro de stejar, accent verde de frunză): pentru ateliere de tâmplărie și mobilă, depozite de cherestea, case din lemn, ocolul silvic și cursuri de lucru în lemn.
  // 05.11, 20:35: Jar (crem de hârtie de măcelărie, titluri Verdana roșu-brun de carne afumată, accent portocaliu de jar): pentru măcelării, grătare și restaurante cu carne, oferte de sărbători și liste de prețuri la raionul de carne.
  { id: 'jar', name: 'Jar', bg: '#fbf5ef', fg: '#2a1a16', title: '#7a2318', accent: '#e8913a', titleFont: 'Verdana, "Segoe UI", sans-serif', bodyFont: 'Verdana, "Segoe UI", sans-serif' },
  // 05.11, 21:00: Scânteie (alb-gri rece de tablă, titluri Tahoma bleumarin de oțel, accent albastru de arc electric): pentru ateliere de sudură și lăcătușerie, structuri metalice, porți și garduri, service-uri industriale și instruiri de protecția muncii la sudură.
  { id: 'scanteie', name: 'Scânteie', bg: '#f4f6f9', fg: '#1b2130', title: '#25304a', accent: '#2f8fd8', titleFont: 'Tahoma, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 21:25: Tipar (hârtie albă de tipar, titluri Arial Black negru de cerneală, accent magenta de tipar): pentru tipografii, centre de copiere, ateliere de reclame, cataloage, broșuri și oferte pentru materiale tipărite.
  { id: 'tipar', name: 'Tipar', bg: '#fbfbf8', fg: '#16181d', title: '#16181d', accent: '#d61a7f', titleFont: '"Arial Black", Arial, sans-serif', bodyFont: 'Arial, sans-serif' },
  // 05.11, 22:25: Carton (fundal de carton kraft deschis, titluri Trebuchet maro închis, accent verde de reciclare): pentru puncte de colectare, firme de reciclare și ambalaje, rapoarte despre deșeuri și prezentări despre mediu.
  // 05.11, 22:52: Pergament (fundal de hârtie veche, titluri Palatino maro-roșcat de cerneală, accent auriu-ocru): pentru biblioteci și cluburi de lectură, librării și anticariate, prezentări de istorie, arhive și invitații clasice.
  { id: 'pergament', name: 'Pergament', bg: '#f3e9d2', fg: '#3a2e22', title: '#6b2a1a', accent: '#9a7b2a', titleFont: '"Palatino Linotype", Palatino, serif', bodyFont: 'Georgia, serif' },
  // 05.11, 23:30: Cetină (temă întunecată: fundal verde-negru de pădure deasă, titluri Trebuchet verde de ace tinere, accent portocaliu de rășină): pentru ocoale silvice și firme de exploatare, depozite de lemne de foc și peleți, pensiuni la munte, prezentări despre natură și drumeții.
  { id: 'cetina', name: 'Cetină', bg: '#16271f', fg: '#e3eadf', title: '#b9d98a', accent: '#d98c4a', titleFont: '"Trebuchet MS", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 23:50: Piele (temă întunecată: fundal maro închis de piele, titluri Georgia coniac, text Segoe UI crem, accent roșu de frizerie): pentru frizerii și saloane, ateliere de marochinărie și încălțăminte, magazine de mobilă, cafenele și baruri cu aer clasic.
  { id: 'piele', name: 'Piele', bg: '#2a1a12', fg: '#efe2d0', title: '#e0b07a', accent: '#d0453a', titleFont: 'Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  // 06.11, 00:15: Lustru (temă întunecată: fundal negru de cremă de ghete, titluri Constantia gri-argintiu, text Segoe UI deschis, accent roșu-vișiniu de piele lustruită): pentru ateliere de cizmărie și de copiat chei, magazine de încălțăminte și marochinărie, prezentări sobre de firmă.
  { id: 'lustru', name: 'Lustru', bg: '#15171b', fg: '#e6e4df', title: '#c8ced6', accent: '#b8404a', titleFont: 'Constantia, Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  // 06.11, 00:30: Satin (temă deschisă: fundal roz pal de satin, titluri Palatino roz închis, text Segoe UI prună, accent auriu): pentru școli de dans și de balet, spectacole de sfârșit de an, saloane de mireasă, invitații și prezentări festive.
  { id: 'satin', name: 'Satin', bg: '#fbf1f2', fg: '#3a2a30', title: '#9c3a5e', accent: '#b8901f', titleFont: '"Palatino Linotype", Palatino, Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  // 06.11, 00:55: Argilă (temă deschisă: fundal gri-bej de lut crud, titluri Cambria maro de lut ars, text Segoe UI maro închis, accent albastru de glazură): pentru ateliere de ceramică și olărit, cursuri de modelaj, târguri de meșteșuguri și magazine de obiecte lucrate manual.
  { id: 'argila', name: 'Argilă', bg: '#f2ede6', fg: '#38302a', title: '#7a4e32', accent: '#3f7a86', titleFont: 'Cambria, Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  // 06.11, 01:10: Ceai (temă deschisă: fundal verde pal de ceai, titluri Trebuchet MS verde de frunză, text Segoe UI verde-măslin închis, accent chihlimbar de miere): pentru plafare, magazine naturiste, ceainării, cursuri despre plante și meniuri de ceaiuri.
  { id: 'ceai', name: 'Ceai', bg: '#f1f4e8', fg: '#2f3424', title: '#4f6a2a', accent: '#b0742a', titleFont: '"Trebuchet MS", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 06.11, 01:35: Moară (temă deschisă: fundal gri de piatră de moară, titluri Georgia maro de lemn vechi, text Calibri aproape negru, accent auriu de grâu): pentru mori, brutării, magazine de cereale și făină, ferme și târguri de produse tradiționale.
  { id: 'moara', name: 'Moară', bg: '#eef0f1', fg: '#25272a', title: '#4a3a2a', accent: '#b8901f', titleFont: 'Georgia, "Times New Roman", serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 06.11, 01:47: Hipodrom (temă deschisă: fundal alb-verzui de pajiște, titluri Palatino verde închis de pistă, text Segoe UI aproape negru, accent roșu de mătase de jocheu): pentru cluburi de echitație, herghelii, concursuri hipice, școli de călărie și ferme cu cai.
  { id: 'hipodrom', name: 'Hipodrom', bg: '#f3f6f1', fg: '#1f2a22', title: '#1f5a3a', accent: '#a0302a', titleFont: '"Palatino Linotype", Palatino, Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'carton', name: 'Carton', bg: '#f4ead6', fg: '#3b2f22', title: '#4a3523', accent: '#2e8b57', titleFont: '"Trebuchet MS", sans-serif', bodyFont: 'Verdana, sans-serif' },
  // 05.11, 20:10: Ipsos (alb cald de tencuială, titluri Georgia albastru-gri de zugrav, accent ocru): pentru echipe de zugrăveli și finisaje, renovări, magazine de vopsele și materiale, designeri de interior.
  { id: 'ipsos', name: 'Ipsos', bg: '#faf7f2', fg: '#2a2622', title: '#3d5a73', accent: '#d98a2b', titleFont: 'Georgia, "Times New Roman", serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 19:37: Asfalt (gri deschis de beton, titluri Segoe UI gri antracit, accent portocaliu de semnalizare): pentru service-uri auto, vulcanizări, spălătorii, parcuri auto, firme de transport și drumuri.
  { id: 'asfalt', name: 'Asfalt', bg: '#f4f5f6', fg: '#1b1e22', title: '#2f343a', accent: '#e8701a', titleFont: '"Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 19:16: Bistro (crem de chiflă, titluri Arial Black roșu de ketchup, accent galben de muștar): pentru fast-food, pizzerii, shaormerii, meniuri, oferte de livrare și cantine.
  { id: 'bistro', name: 'Bistro', bg: '#fdf8ee', fg: '#2b1a12', title: '#b3261e', accent: '#e0a526', titleFont: '"Arial Black", Arial, sans-serif', bodyFont: 'Arial, "Segoe UI", sans-serif' },
  { id: 'stejar', name: 'Stejar', bg: '#f8f4ec', fg: '#2a1f14', title: '#6b4423', accent: '#4f7a3a', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 18:27: Izvor (alb ca apa limpede, titluri Verdana albastru de izvor, accent arămiu de țeavă): pentru instalatori, firme de apă și canal, asociații de proprietari, băi și piscine, prezentări despre consumul de apă.
  { id: 'izvor', name: 'Izvor', bg: '#f4f9fb', fg: '#13232b', title: '#1c6a8f', accent: '#c46a2b', titleFont: 'Verdana, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 18:02: Cosmos (alb rece, titluri Trebuchet albastru de cer înstelat, accent auriu de stea): pentru lecții de științe, proiecte școlare, planetarii, nopți de observare a cerului și petreceri cu tema spațiului.
  { id: 'cosmos', name: 'Cosmos', bg: '#f6f6fb', fg: '#151a30', title: '#1f2a5c', accent: '#d99a1e', titleFont: '"Trebuchet MS", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 16:50: Alpin (alb rece de aer de munte, titluri Trebuchet albastru de creastă, accent portocaliu de foc de tabără): pentru excursii, tabere, cluburi de drumeție, cabane și turism montan.
  { id: 'alpin', name: 'Alpin', bg: '#f3f6f8', fg: '#1a2530', title: '#24506b', accent: '#e06a2c', titleFont: '"Trebuchet MS", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'bronz', name: 'Bronz', bg: '#f7f4ef', fg: '#241c14', title: '#7a4a1c', accent: '#3f8f7a', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 15:50: Rubin (alb rozaliu, titluri Georgia roșu-rubin, accent auriu): pentru bijuterii, gale, premieri, oferte de lux și invitații elegante.
  { id: 'rubin', name: 'Rubin', bg: '#fbf7f7', fg: '#231a1c', title: '#9b1b30', accent: '#b8860b', titleFont: 'Georgia, "Times New Roman", serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'circuit', name: 'Circuit', bg: '#f4f8f5', fg: '#14241a', title: '#14532d', accent: '#b87333', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'crama', name: 'Cramă', bg: '#f8f4ee', fg: '#2a1a28', title: '#4a1d4a', accent: '#5f7f1f', titleFont: '"Palatino Linotype", Palatino, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 13:50: Miere (crem de fagure, titluri Palatino maro-miere, accent galben de miere): pentru apicultori, produse apicole, târguri, cofetării și oferte de toamnă.
  { id: 'miere', name: 'Miere', bg: '#fdf7e8', fg: '#2b1f0e', title: '#8a5300', accent: '#e0a100', titleFont: '"Palatino Linotype", "Book Antiqua", Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 12:20: Scorțișoară (crem cald, titluri Calibri maro-scorțișoară, accent verde-albăstrui): pentru cafenele, patiserii, magazine de mobilă, ateliere, meniuri de toamnă și prezentări calde.
  { id: 'scortisoara', name: 'Scorțișoară', bg: '#fbf5ee', fg: '#2a1e17', title: '#7b3f1d', accent: '#1f8a84', titleFont: '"Calibri Light", Calibri, "Segoe UI", sans-serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 12:00: Iris (alb-liliachiu, titluri Palatino violet-albăstrui, accent galben de polen): pentru florării, saloane, cursuri, nunți, evenimente culturale și prezentări de primăvară.
  { id: 'iris', name: 'Iris', bg: '#f6f5fc', fg: '#1f1c33', title: '#4338a0', accent: '#d4a017', titleFont: '"Palatino Linotype", Palatino, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 11:40: Vulcan (gri de cenușă, titluri Trebuchet gri-cărbune, accent portocaliu de lavă): pentru construcții, energie, industrie, sport și prezentări cu cifre.
  { id: 'vulcan', name: 'Vulcan', bg: '#f7f4f2', fg: '#211d1b', title: '#3a3330', accent: '#d9480f', titleFont: '"Trebuchet MS", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 11:20: Abanos (fildeș, titluri Cambria negru-cafeniu, accent auriu): pentru avocatură, notariate, bijuterii, invitații și prezentări de prestigiu.
  { id: 'abanos', name: 'Abanos', bg: '#faf7f0', fg: '#1c1a17', title: '#2b2622', accent: '#b8892b', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 10:55: Bujor (alb cald, titluri Georgia roșu de bujor, accent verde închis de frunză): pentru brutării, florării, evenimente de vară, comemorări și prezentări cu fotografii de câmp.
  { id: 'bujor', name: 'Bujor', bg: '#fffaf5', fg: '#24201c', title: '#c62828', accent: '#2e5e3e', titleFont: 'Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 09:40: Auroră (alb-albăstrui, titluri Segoe UI verde-albastru, accent violet): pentru firme de tehnologie și software, start-up-uri, conferințe, cursuri online.
  { id: 'aurora', name: 'Auroră', bg: '#f5f7fb', fg: '#1b2330', title: '#0f766e', accent: '#6d28d9', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 09:20: Mandarină (crem-piersică, titluri Trebuchet portocaliu-închis, accent bleumarin): pentru promoții, evenimente, firme de catering și transport, prezentări de toamnă.
  { id: 'mandarina', name: 'Mandarină', bg: '#fff8f1', fg: '#2a1f17', title: '#c2560a', accent: '#1e3a5f', titleFont: '"Trebuchet MS", "Segoe UI", sans-serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  // 05.11, 08:58: Lagună (alb-turcoaz, titluri Georgia verde-albastru adânc, accent coral): pentru turism la mare, spa-uri, piscine, firme de apă și mediu.
  { id: 'laguna', name: 'Lagună', bg: '#f1f8f8', fg: '#16292b', title: '#00727a', accent: '#e8684a', titleFont: 'Georgia, serif', bodyFont: '"Segoe UI", sans-serif' },
  // 05.11, 08:31: Tei (alb-verzui, titluri Cambria verde-crud, accent prună): pentru grădinițe și școli, ONG-uri de mediu, produse naturale, primăvara.
  { id: 'tei', name: 'Tei', bg: '#f8fbef', fg: '#1f2a14', title: '#4d7c0f', accent: '#7c3a6b', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'caramel', name: 'Caramel', bg: '#fbf6ef', fg: '#2e2218', title: '#8b4513', accent: '#1f7a7a', titleFont: '"Trebuchet MS", "Segoe UI", sans-serif', bodyFont: 'Georgia, serif' },
  { id: 'petrol', name: 'Petrol', bg: '#f4f8f8', fg: '#1b2a2e', title: '#0e4a5a', accent: '#d1495b', titleFont: 'Verdana, "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
];
export const themeOf = (id: ThemeId) => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** Variantele fiecărei teme (în afară de cea de bază): aceleași fonturi, alte culori, toate cu contrast bun și pe proiector. */
type Pal = { bg: string; fg: string; title: string; accent: string };
export const THEME_VARIANTS: Record<ThemeId, Pal[]> = {
  simplu: [
    { bg: '#ffffff', fg: '#1f2937', title: '#064e3b', accent: '#059669' },
    { bg: '#f3f4f6', fg: '#1f2937', title: '#3b0764', accent: '#7c3aed' },
    { bg: '#111827', fg: '#e5e7eb', title: '#ffffff', accent: '#60a5fa' },
  ],
  albastru: [
    { bg: '#0b4f4a', fg: '#e0f2f1', title: '#ffffff', accent: '#5eead4' },
    { bg: '#eaf2fc', fg: '#0f2747', title: '#0f3d7a', accent: '#2563eb' },
    { bg: '#1e1b4b', fg: '#e0e7ff', title: '#ffffff', accent: '#a5b4fc' },
  ],
  noapte: [
    { bg: '#16181d', fg: '#d6d9df', title: '#ffffff', accent: '#22d3ee' },
    { bg: '#1a1625', fg: '#e4dcef', title: '#ffffff', accent: '#f472b6' },
    { bg: '#fafafa', fg: '#27272a', title: '#18181b', accent: '#d97706' },
  ],
  cald: [
    { bg: '#fbf6ee', fg: '#4a3b30', title: '#7f1d1d', accent: '#b91c1c' },
    { bg: '#fbf6ee', fg: '#3b3a30', title: '#134e4a', accent: '#0f766e' },
    { bg: '#2b1d14', fg: '#f5e6d3', title: '#fdba74', accent: '#fb923c' },
  ],
  natura: [
    { bg: '#ecfeff', fg: '#164e63', title: '#155e75', accent: '#0d9488' },
    { bg: '#fefce8', fg: '#3f3f1f', title: '#4d7c0f', accent: '#ca8a04' },
    { bg: '#10261a', fg: '#d1fae5', title: '#ffffff', accent: '#4ade80' },
  ],
  elegant: [
    { bg: '#2a0f1f', fg: '#f3e8ee', title: '#f4e3b2', accent: '#c9a54c' },
    { bg: '#0f2a24', fg: '#e2efe9', title: '#f4e3b2', accent: '#d4af37' },
    { bg: '#faf7f0', fg: '#2b2b2b', title: '#1b2238', accent: '#a57f2c' },
  ],
  birou: [
    { bg: '#ffffff', fg: '#263238', title: '#1e3a8a', accent: '#d97706' },
    { bg: '#f4f6f8', fg: '#263238', title: '#7f1d1d', accent: '#b91c1c' },
    { bg: '#0b3d5c', fg: '#e6f0f5', title: '#ffffff', accent: '#5fd3dc' },
  ],
  ardezie: [
    { bg: '#2f3e46', fg: '#e3ebe6', title: '#ffffff', accent: '#f4a261' },
    { bg: '#22313f', fg: '#dfe7ee', title: '#ffffff', accent: '#7fb3d5' },
    { bg: '#eef2f0', fg: '#2f3e46', title: '#1b262c', accent: '#52796f' },
  ],
  ocean: [
    { bg: '#eaf4f8', fg: '#173f5f', title: '#0b3954', accent: '#e07a5f' },
    { bg: '#f2f7ee', fg: '#25402e', title: '#1d4d2b', accent: '#2a9d8f' },
    { bg: '#0b3954', fg: '#e3f2f7', title: '#ffffff', accent: '#5bc0be' },
  ],
  vin: [
    { bg: '#2d1b33', fg: '#efe4f3', title: '#ffffff', accent: '#d4a5e0' },
    { bg: '#1f2a1d', fg: '#ecf0e4', title: '#ffffff', accent: '#e0b354' },
    { bg: '#fbf5ee', fg: '#3d0c11', title: '#6b0f1a', accent: '#b5651d' },
  ],
  creta: [
    { bg: '#1f2a36', fg: '#eef2f6', title: '#ffffff', accent: '#ff9f80' },
    { bg: '#2b2b2b', fg: '#efefef', title: '#ffffff', accent: '#9be564' },
    { bg: '#f7f5ec', fg: '#24372b', title: '#1b2a20', accent: '#b8860b' },
  ],
  retro: [
    { bg: '#fdf0d5', fg: '#003049', title: '#003049', accent: '#c1121f' },
    { bg: '#f1faee', fg: '#1d3557', title: '#1d3557', accent: '#e63946' },
    { bg: '#003049', fg: '#fdf0d5', title: '#ffffff', accent: '#f4a261' },
  ],
  lavanda: [
    { bg: '#ffffff', fg: '#2e1065', title: '#5b21b6', accent: '#db2777' },
    { bg: '#fdf4ff', fg: '#3b0764', title: '#701a75', accent: '#a21caf' },
    { bg: '#2e1065', fg: '#ede9fe', title: '#ffffff', accent: '#c4b5fd' },
  ],
  grafit: [
    { bg: '#1f2933', fg: '#e4e7eb', title: '#ffffff', accent: '#f7c948' },
    { bg: '#323f4b', fg: '#f5f7fa', title: '#ffffff', accent: '#47a3f3' },
    { bg: '#f5f7fa', fg: '#1f2933', title: '#102a43', accent: '#0f766e' },
  ],
  nisip: [
    { bg: '#fffaf0', fg: '#3f3a33', title: '#7b341e', accent: '#c05621' },
    { bg: '#f6efe4', fg: '#2d3748', title: '#234e52', accent: '#2c7a7b' },
    { bg: '#3f3a33', fg: '#f6efe4', title: '#fbd38d', accent: '#ed8936' },
  ],
  contrast: [
    { bg: '#000000', fg: '#ffffff', title: '#00ff7f', accent: '#ffff00' },
    { bg: '#ffffff', fg: '#000000', title: '#000000', accent: '#0000cc' },
    { bg: '#00003c', fg: '#ffffff', title: '#ffff00', accent: '#ff9f1c' },
  ],
  menta: [
    { bg: '#ffffff', fg: '#16362a', title: '#065f46', accent: '#0e7490' },
    { bg: '#f0fdfa', fg: '#134e4a', title: '#115e59', accent: '#db2777' },
    { bg: '#0f2e24', fg: '#d8f3e8', title: '#ffffff', accent: '#5eead4' },
  ],
  corai: [
    { bg: '#ffffff', fg: '#3b2622', title: '#9f2d20', accent: '#0e7490' },
    { bg: '#fff7e8', fg: '#3b2a18', title: '#9a3412', accent: '#d97706' },
    { bg: '#3b1d1a', fg: '#fde8e2', title: '#ffffff', accent: '#ff8a70' },
  ],
  pruna: [
    { bg: '#2a1533', fg: '#f1e6f5', title: '#ffffff', accent: '#ffd166' },
    { bg: '#1c1630', fg: '#e8e4f7', title: '#ffffff', accent: '#9ad1ff' },
    { bg: '#faf5fb', fg: '#2a1533', title: '#5b1f6e', accent: '#b0306a' },
  ],
  maslin: [
    { bg: '#f4f3e8', fg: '#2f3220', title: '#3f4a12', accent: '#b4541a' },
    { bg: '#ffffff', fg: '#2f3220', title: '#334155', accent: '#6b7f1a' },
    { bg: '#2c3018', fg: '#eef0dc', title: '#ffffff', accent: '#d9c45c' },
  ],
  cer: [
    { bg: '#ffffff', fg: '#1e3a5f', title: '#0b4f8a', accent: '#ea580c' },
    { bg: '#f0f9ff', fg: '#0c4a6e', title: '#075985', accent: '#0d9488' },
    { bg: '#0c2a47', fg: '#dbeafe', title: '#ffffff', accent: '#7cc4fa' },
  ],
  cafea: [
    { bg: '#2b1d16', fg: '#efe2d0', title: '#f7ead7', accent: '#8fbf9f' },
    { bg: '#f6eee3', fg: '#3b2a20', title: '#6b3f22', accent: '#a0612b' },
    { bg: '#1e1612', fg: '#e8dccb', title: '#ffffff', accent: '#e0a458' },
  ],
  smarald: [
    { bg: '#0b3b2e', fg: '#e3f2ea', title: '#ffffff', accent: '#f4a261' },
    { bg: '#f0f7f3', fg: '#12372a', title: '#0b3b2e', accent: '#1f7a5a' },
    { bg: '#06261d', fg: '#d9efe4', title: '#e9c46a', accent: '#7fd1ae' },
  ],
  chihlimbar: [
    { bg: '#24170a', fg: '#f6e7cf', title: '#ffd27a', accent: '#5fb3a1' },
    { bg: '#fdf6e9', fg: '#3d2a12', title: '#8a4b08', accent: '#d97706' },
    { bg: '#140c04', fg: '#efdcc0', title: '#ffffff', accent: '#fbbf24' },
  ],
  ghetar: [
    { bg: '#ffffff', fg: '#14323d', title: '#0e5566', accent: '#2563eb' },
    { bg: '#e8f6f9', fg: '#123540', title: '#0b4a59', accent: '#0f766e' },
    { bg: '#0b2a33', fg: '#d6f1f6', title: '#ffffff', accent: '#5fd4e4' },
  ],
  indigo: [
    { bg: '#1e1b4b', fg: '#e0e7ff', title: '#ffffff', accent: '#fbbf24' },
    { bg: '#eef2ff', fg: '#1e1b4b', title: '#312e81', accent: '#4f46e5' },
    { bg: '#0f0c2e', fg: '#c7d2fe', title: '#ffffff', accent: '#22d3ee' },
  ],
  piatra: [
    { bg: '#f5f5f4', fg: '#292524', title: '#1c1917', accent: '#0f766e' },
    { bg: '#ffffff', fg: '#44403c', title: '#292524', accent: '#b45309' },
    { bg: '#292524', fg: '#e7e5e4', title: '#ffffff', accent: '#fb7185' },
  ],
  salvie: [
    { bg: '#eef2ec', fg: '#2e3b31', title: '#1f2d23', accent: '#b5651d' },
    { bg: '#ffffff', fg: '#34433a', title: '#2f4a3a', accent: '#5b7f68' },
    { bg: '#26352b', fg: '#e3ebe4', title: '#ffffff', accent: '#a3c4a8' },
  ],
  otel: [
    { bg: '#1c2733', fg: '#d9e2ec', title: '#ffffff', accent: '#38bdf8' },
    { bg: '#f1f5f9', fg: '#1e293b', title: '#0f172a', accent: '#ea580c' },
    { bg: '#0b1118', fg: '#cbd5e1', title: '#ffffff', accent: '#facc15' },
  ],
  teracota: [
    { bg: '#fbf1ea', fg: '#3f2a1f', title: '#7c2d12', accent: '#0f766e' },
    { bg: '#ffffff', fg: '#44342a', title: '#9a3412', accent: '#b45309' },
    { bg: '#3b2418', fg: '#f5e6dc', title: '#ffffff', accent: '#fdba74' },
  ],
  turcoaz: [
    { bg: '#0f3d3e', fg: '#d5f3ef', title: '#ffffff', accent: '#fde047' },
    { bg: '#f0fdfa', fg: '#134e4a', title: '#0f3d3e', accent: '#e11d48' },
    { bg: '#062426', fg: '#ccfbf1', title: '#ffffff', accent: '#5eead4' },
  ],
  piersica: [
    { bg: '#ffffff', fg: '#3d2b25', title: '#7a2e1b', accent: '#0f766e' },
    { bg: '#fde3d3', fg: '#3d2b25', title: '#5a2214', accent: '#b4532a' },
    { bg: '#3d2b25', fg: '#fbe7dc', title: '#ffffff', accent: '#f4a27f' },
  ],
  fistic: [
    { bg: '#ffffff', fg: '#2b3320', title: '#3d6b21', accent: '#0f766e' },
    { bg: '#e6efd2', fg: '#26301b', title: '#2a4a16', accent: '#8a4b22' },
    { bg: '#1f2a17', fg: '#e8f0dc', title: '#c5e1a5', accent: '#e0a370' },
  ],
  delta: [
    { bg: '#ffffff', fg: '#1a2a2a', title: '#1d5c63', accent: '#8f7224' },
    { bg: '#e6eee6', fg: '#16251f', title: '#174d52', accent: '#7a6020' },
    { bg: '#12282b', fg: '#e6f0ee', title: '#d9c27a', accent: '#7fc4c0' },
  ],
  ger: [
    { bg: '#ffffff', fg: '#17212e', title: '#2b4c7e', accent: '#a3253a' },
    { bg: '#e8eef6', fg: '#141d29', title: '#24426e', accent: '#9a2236' },
    { bg: '#14223a', fg: '#e9f0f8', title: '#ffffff', accent: '#e8586e' },
  ],
  smalt: [
    { bg: '#ffffff', fg: '#18282b', title: '#0e6e78', accent: '#c9554a' },
    { bg: '#e6f3f3', fg: '#142326', title: '#0b5d66', accent: '#b84a40' },
    { bg: '#0f2e33', fg: '#e8f4f4', title: '#ffffff', accent: '#f2897d' },
  ],
  tipar: [
    { bg: '#ffffff', fg: '#16181d', title: '#16181d', accent: '#0087bd' },
    { bg: '#fff8d6', fg: '#1d1a10', title: '#16181d', accent: '#c2156f' },
    { bg: '#16181d', fg: '#eceef2', title: '#ffffff', accent: '#ffd400' },
  ],
  piele: [
    { bg: '#ffffff', fg: '#2a1d16', title: '#7a3e1d', accent: '#a32a22' },
    { bg: '#f1e6d6', fg: '#2d2018', title: '#5a2e16', accent: '#1f4a5a' },
    { bg: '#141010', fg: '#e9ddd0', title: '#d29a5e', accent: '#d0453a' },
  ],
  lustru: [
    { bg: '#ffffff', fg: '#1d1f24', title: '#22262e', accent: '#8c2a32' },
    { bg: '#ecebe8', fg: '#25272c', title: '#2a2e36', accent: '#7a5a2e' },
    { bg: '#0e1320', fg: '#e3e6ec', title: '#e0c48a', accent: '#b8404a' },
  ],
  satin: [
    { bg: '#ffffff', fg: '#2e2228', title: '#8a2f52', accent: '#5a4a8a' },
    { bg: '#f2eef8', fg: '#2c2436', title: '#5a3a7a', accent: '#c0507a' },
    { bg: '#2a1a24', fg: '#f3e4ea', title: '#f0b8c8', accent: '#d9b24a' },
  ],
  argila: [
    { bg: '#ffffff', fg: '#2e2620', title: '#7a4e32', accent: '#3f7a86' },
    { bg: '#e9f1f2', fg: '#24363a', title: '#2f6470', accent: '#a0623c' },
    { bg: '#2b231d', fg: '#efe5da', title: '#e0b48a', accent: '#7fb7c0' },
  ],
  hipodrom: [
    { bg: '#ffffff', fg: '#1c1f1d', title: '#1f5a3a', accent: '#c08a2a' },
    { bg: '#f6efe4', fg: '#2e2418', title: '#7a4a24', accent: '#1f5a3a' },
    { bg: '#16261c', fg: '#e8efe9', title: '#e8c46a', accent: '#e06a5a' },
  ],
  moara: [
    { bg: '#ffffff', fg: '#222222', title: '#4a3a2a', accent: '#3f6f8f' },
    { bg: '#f7f3ea', fg: '#2e2a22', title: '#3f5f7a', accent: '#a0702a' },
    { bg: '#24221f', fg: '#ece8e0', title: '#e0c070', accent: '#8fb3cc' },
  ],
  ceai: [
    { bg: '#ffffff', fg: '#262a1e', title: '#4f6a2a', accent: '#8a5a9a' },
    { bg: '#f7efe0', fg: '#3a2e1e', title: '#8a5a1e', accent: '#4f6a2a' },
    { bg: '#1f2618', fg: '#e8eedc', title: '#c8dc9a', accent: '#e0b060' },
  ],
  cetina: [
    { bg: '#ffffff', fg: '#1f2a24', title: '#1f4d3a', accent: '#b0602a' },
    { bg: '#e6ecdc', fg: '#24302a', title: '#2f5a3c', accent: '#8a5a2b' },
    { bg: '#0f1a15', fg: '#dfe8dc', title: '#cfe3a8', accent: '#e0a050' },
  ],
  pergament: [
    { bg: '#ffffff', fg: '#2a221a', title: '#6b2a1a', accent: '#9a7b2a' },
    { bg: '#e9e0c9', fg: '#2d2418', title: '#3f4a2a', accent: '#7a2e1d' },
    { bg: '#2b2118', fg: '#efe3c8', title: '#f3dfb0', accent: '#d4a94a' },
  ],
  carton: [
    { bg: '#ffffff', fg: '#2b241c', title: '#4a3523', accent: '#b0702e' },
    { bg: '#e6f2e8', fg: '#1f2a22', title: '#1e5e3a', accent: '#a0662b' },
    { bg: '#3a2c1f', fg: '#f1e7d6', title: '#f6ead2', accent: '#7fcf8f' },
  ],
  scanteie: [
    { bg: '#ffffff', fg: '#1b2130', title: '#25304a', accent: '#1f74b8' },
    { bg: '#e4e9f0', fg: '#171c28', title: '#1f2940', accent: '#1d6aa8' },
    { bg: '#141a26', fg: '#e8edf5', title: '#ffffff', accent: '#4fb0ff' },
  ],
  jar: [
    { bg: '#ffffff', fg: '#2a1a16', title: '#7a2318', accent: '#c46f1c' },
    { bg: '#f3e6da', fg: '#26160f', title: '#6c1f15', accent: '#b5641a' },
    { bg: '#2b1714', fg: '#f6ece6', title: '#ffffff', accent: '#ffa552' },
  ],
  ipsos: [
    { bg: '#ffffff', fg: '#2a2622', title: '#3d5a73', accent: '#b8701c' },
    { bg: '#efe9df', fg: '#26221e', title: '#34506a', accent: '#a8641a' },
    { bg: '#26313b', fg: '#f2eee8', title: '#ffffff', accent: '#f0a54a' },
  ],
  asfalt: [
    { bg: '#ffffff', fg: '#1b1e22', title: '#2f343a', accent: '#c75a0c' },
    { bg: '#e6e8ea', fg: '#16191c', title: '#262a2f', accent: '#b8520b' },
    { bg: '#1d2126', fg: '#eef0f2', title: '#ffffff', accent: '#ff8a3d' },
  ],
  bistro: [
    { bg: '#ffffff', fg: '#2b1a12', title: '#b3261e', accent: '#c98a0e' },
    { bg: '#f6ead0', fg: '#2a180f', title: '#9e1f18', accent: '#b07a0c' },
    { bg: '#2b1410', fg: '#f7ede0', title: '#ffffff', accent: '#f2c14e' },
  ],
  stejar: [
    { bg: '#ffffff', fg: '#2a1f14', title: '#6b4423', accent: '#3f6b2e' },
    { bg: '#efe7d8', fg: '#251b11', title: '#5c3a1e', accent: '#3a6229' },
    { bg: '#2a1d12', fg: '#f3ece0', title: '#ffffff', accent: '#9cc47e' },
  ],
  izvor: [
    { bg: '#ffffff', fg: '#13232b', title: '#1c6a8f', accent: '#a9561d' },
    { bg: '#e7f2f6', fg: '#112027', title: '#175a79', accent: '#9c4f1a' },
    { bg: '#0c2a38', fg: '#e8f3f7', title: '#ffffff', accent: '#f0a066' },
  ],
  cosmos: [
    { bg: '#ffffff', fg: '#151a30', title: '#1f2a5c', accent: '#b47d10' },
    { bg: '#ecedf6', fg: '#121628', title: '#1a234f', accent: '#a5720e' },
    { bg: '#0d1230', fg: '#e9ebf7', title: '#ffffff', accent: '#f2c14e' },
  ],
  alpin: [
    { bg: '#ffffff', fg: '#1a2530', title: '#24506b', accent: '#c9561a' },
    { bg: '#e6edf1', fg: '#16212b', title: '#1d4560', accent: '#b84f17' },
    { bg: '#1b2a36', fg: '#e8eef2', title: '#f4f7f9', accent: '#f08a4b' },
  ],
  bronz: [
    { bg: '#ffffff', fg: '#241c14', title: '#7a4a1c', accent: '#2f7a68' },
    { bg: '#ece4d8', fg: '#21180f', title: '#6a3f16', accent: '#2c705f' },
    { bg: '#1f2a26', fg: '#efe9df', title: '#d9a866', accent: '#6cc4ad' },
  ],
  rubin: [
    { bg: '#ffffff', fg: '#231a1c', title: '#9b1b30', accent: '#a3760a' },
    { bg: '#f5e8ea', fg: '#231418', title: '#86172a', accent: '#946b09' },
    { bg: '#2b0d14', fg: '#f6eaec', title: '#f0cf7a', accent: '#e05a72' },
  ],
  circuit: [
    { bg: '#ffffff', fg: '#14241a', title: '#14532d', accent: '#a8652a' },
    { bg: '#e4efe7', fg: '#10261a', title: '#0f4424', accent: '#9a5a22' },
    { bg: '#0f2a1a', fg: '#e6f2ea', title: '#e8c060', accent: '#4ade80' },
  ],
  crama: [
    { bg: '#ffffff', fg: '#2a1a28', title: '#4a1d4a', accent: '#5a781d' },
    { bg: '#efe6ee', fg: '#2a1426', title: '#3f173f', accent: '#55711b' },
    { bg: '#33152f', fg: '#f4ece6', title: '#efdcb0', accent: '#a9c45a' },
  ],
  marinar: [
    { bg: '#ffffff', fg: '#14213d', title: '#0f3460', accent: '#b00e28' },
    { bg: '#e3edf6', fg: '#10203a', title: '#0c2b50', accent: '#a30d25' },
    { bg: '#0e2238', fg: '#eef3f8', title: '#f4ead2', accent: '#ef4b5a' },
  ],
  miere: [
    { bg: '#ffffff', fg: '#2b1f0e', title: '#8a5300', accent: '#c98a00' },
    { bg: '#f8ecc8', fg: '#2a1d08', title: '#7a4800', accent: '#9a6b00' },
    { bg: '#2a1a08', fg: '#f8ecd2', title: '#f2c14e', accent: '#e8a33a' },
  ],
  musetel: [
    { bg: '#ffffff', fg: '#23281a', title: '#4a6b1f', accent: '#b88a00' },
    { bg: '#f5f0cf', fg: '#20240f', title: '#3d5a18', accent: '#9a7300' },
    { bg: '#1e2614', fg: '#f3f4e6', title: '#f2d16b', accent: '#a8d07a' },
  ],
  scortisoara: [
    { bg: '#ffffff', fg: '#2a1e17', title: '#7b3f1d', accent: '#1b7a75' },
    { bg: '#f1e2d0', fg: '#26190f', title: '#6b3417', accent: '#176862' },
    { bg: '#24180f', fg: '#f3e9df', title: '#e8a774', accent: '#5cc8bf' },
  ],
  iris: [
    { bg: '#ffffff', fg: '#1f1c33', title: '#4338a0', accent: '#b8860b' },
    { bg: '#e9e6f6', fg: '#1b1830', title: '#362c8a', accent: '#9a6f00' },
    { bg: '#1d1a33', fg: '#ecebf7', title: '#b3a9ff', accent: '#f2c94c' },
  ],
  vulcan: [
    { bg: '#ffffff', fg: '#211d1b', title: '#3a3330', accent: '#c2410c' },
    { bg: '#e4e0dd', fg: '#1d1a18', title: '#2b2624', accent: '#b23a0b' },
    { bg: '#1c1918', fg: '#efe9e6', title: '#ff8a4c', accent: '#ffb347' },
  ],
  abanos: [
    { bg: '#ffffff', fg: '#1c1a17', title: '#2b2622', accent: '#a57a22' },
    { bg: '#f3ead6', fg: '#1f1b14', title: '#241f19', accent: '#8a6516' },
    { bg: '#15130f', fg: '#efe8da', title: '#e3c278', accent: '#c9a24a' },
  ],
  bujor: [
    { bg: '#ffffff', fg: '#24201c', title: '#c62828', accent: '#2e5e3e' },
    { bg: '#fdecea', fg: '#2a1c1a', title: '#a31f1f', accent: '#254d33' },
    { bg: '#2a1414', fg: '#f7e9e7', title: '#ffffff', accent: '#ef9a9a' },
  ],
  furtuna: [
    { bg: '#ffffff', fg: '#1c2430', title: '#33415c', accent: '#b8860b' },
    { bg: '#dfe5ee', fg: '#1a2230', title: '#26324a', accent: '#9a7000' },
    { bg: '#1c2430', fg: '#e6ebf2', title: '#ffffff', accent: '#f2c230' },
  ],
  cires: [
    { bg: '#ffffff', fg: '#2b1d22', title: '#b0305c', accent: '#3f7d3a' },
    { bg: '#fbe4ea', fg: '#2a1a20', title: '#8f2148', accent: '#2f6a2b' },
    { bg: '#2a1720', fg: '#f6e9ee', title: '#ffffff', accent: '#f48fb1' },
  ],
  aurora: [
    { bg: '#ffffff', fg: '#1b2330', title: '#0f766e', accent: '#6d28d9' },
    { bg: '#ece8fb', fg: '#1e1830', title: '#0b5f58', accent: '#5b21b6' },
    { bg: '#14202b', fg: '#e8eef5', title: '#ffffff', accent: '#5eead4' },
  ],
  mandarina: [
    { bg: '#ffffff', fg: '#2a1f17', title: '#c2560a', accent: '#1e3a5f' },
    { bg: '#fde9d6', fg: '#271c14', title: '#9a4307', accent: '#172d4a' },
    { bg: '#1e2a3a', fg: '#f5ece3', title: '#ffffff', accent: '#ff9f4a' },
  ],
  laguna: [
    { bg: '#ffffff', fg: '#16292b', title: '#00727a', accent: '#e8684a' },
    { bg: '#d9eeee', fg: '#122426', title: '#00545a', accent: '#c4482f' },
    { bg: '#0f2628', fg: '#e6f4f4', title: '#ffffff', accent: '#ff9a7a' },
  ],
  tei: [
    { bg: '#ffffff', fg: '#1f2a14', title: '#4d7c0f', accent: '#7c3a6b' },
    { bg: '#e9f2d4', fg: '#1b2611', title: '#355a08', accent: '#652d57' },
    { bg: '#1c2612', fg: '#eef5df', title: '#ffffff', accent: '#c6e07a' },
  ],
  caramel: [
    { bg: '#ffffff', fg: '#2e2218', title: '#8b4513', accent: '#1f7a7a' },
    { bg: '#f1e3cf', fg: '#2a1e14', title: '#6e370f', accent: '#17605f' },
    { bg: '#2b1d12', fg: '#f3e9dc', title: '#ffffff', accent: '#e0a560' },
  ],
  petrol: [
    { bg: '#ffffff', fg: '#1b2a2e', title: '#0e4a5a', accent: '#d1495b' },
    { bg: '#dcebec', fg: '#172528', title: '#08323d', accent: '#b83246' },
    { bg: '#0c2a31', fg: '#e6f0f1', title: '#ffffff', accent: '#f2808f' },
  ],
  cobalt: [
    { bg: '#ffffff', fg: '#1c2433', title: '#0047ab', accent: '#e07a1f' },
    { bg: '#dfe9f7', fg: '#18202e', title: '#00337a', accent: '#c2610f' },
    { bg: '#0b1f3f', fg: '#e8eef8', title: '#ffffff', accent: '#f59e42' },
  ],
  perla: [
    { bg: '#ffffff', fg: '#2d2f36', title: '#3b4252', accent: '#a8576a' },
    { bg: '#e9e6e1', fg: '#2a2c33', title: '#2b303b', accent: '#8a4a5a' },
    { bg: '#25272d', fg: '#ecebe8', title: '#e6dfd6', accent: '#e0a3b0' },
  ],
  grau: [
    { bg: '#ffffff', fg: '#33291a', title: '#8a5a00', accent: '#4d7c2a' },
    { bg: '#f3e6c4', fg: '#2e2414', title: '#6b4500', accent: '#3f6b20' },
    { bg: '#2a2010', fg: '#f6ecd4', title: '#f0c560', accent: '#a7c97a' },
  ],
  cerneala: [
    { bg: '#0f172a', fg: '#e2e8f0', title: '#f8fafc', accent: '#f87171' },
    { bg: '#ffffff', fg: '#1f2937', title: '#b91c1c', accent: '#1e293b' },
    { bg: '#f3efe4', fg: '#2b2620', title: '#1e293b', accent: '#a16207' },
  ],
  ametist: [
    { bg: '#2e1065', fg: '#f3e8ff', title: '#d8b4fe', accent: '#5eead4' },
    { bg: '#ffffff', fg: '#1f2937', title: '#0d9488', accent: '#7e22ce' },
    { bg: '#1e1b2e', fg: '#ede9fe', title: '#c084fc', accent: '#2dd4bf' },
  ],
  brad: [
    { bg: '#0f2a1d', fg: '#e7f2ea', title: '#86efac', accent: '#fbbf24' },
    { bg: '#ffffff', fg: '#1f2937', title: '#b45309', accent: '#15803d' },
    { bg: '#1c1917', fg: '#f5f5f4', title: '#4ade80', accent: '#f59e0b' },
  ],
  rodie: [
    { bg: '#3b0d18', fg: '#fde8ec', title: '#fda4af', accent: '#5eead4' },
    { bg: '#ffffff', fg: '#1f2937', title: '#0f766e', accent: '#be123c' },
    { bg: '#1f2937', fg: '#f3f4f6', title: '#fb7185', accent: '#2dd4bf' },
  ],
  safir: [
    { bg: '#111c44', fg: '#e0e7ff', title: '#93c5fd', accent: '#f2c14e' },
    { bg: '#1f2937', fg: '#f3f4f6', title: '#f2c14e', accent: '#38bdf8' },
    { bg: '#f8fafc', fg: '#0f172a', title: '#1e3a8a', accent: '#a16207' },
  ],
  neon: [
    { bg: '#111827', fg: '#e5e7eb', title: '#a3e635', accent: '#22d3ee' },
    { bg: '#1e1b4b', fg: '#e0e7ff', title: '#f0abfc', accent: '#22d3ee' },
    { bg: '#f8fafc', fg: '#0f172a', title: '#0e7490', accent: '#65a30d' },
  ],
  cupru: [
    { bg: '#2a2f35', fg: '#ece6e0', title: '#f6d5b8', accent: '#d08a55' },
    { bg: '#f5ede6', fg: '#2a2f35', title: '#7c3f1d', accent: '#b87333' },
    { bg: '#1b1e22', fg: '#e0d6cc', title: '#e9b48a', accent: '#6b8f71' },
  ],
  bordo: [
    { bg: '#f8eee8', fg: '#2b2024', title: '#6b1d2a', accent: '#8a6a2f' },
    { bg: '#f1e4dc', fg: '#3a1d24', title: '#561622', accent: '#9a3b2f' },
    { bg: '#5a1724', fg: '#f6ebe4', title: '#ffffff', accent: '#e0c38c' },
  ],
  bleumarin: [
    { bg: '#f4f6fa', fg: '#1f2937', title: '#1b2a4a', accent: '#b91c1c' },
    { bg: '#e7ecf5', fg: '#1b2a4a', title: '#14213d', accent: '#a16207' },
    { bg: '#1b2a4a', fg: '#e5e9f2', title: '#ffffff', accent: '#e9c46a' },
  ],
  mustar: [
    { bg: '#ffffff', fg: '#2b2a24', title: '#3a3a33', accent: '#b45309' },
    { bg: '#fdf3cf', fg: '#33301f', title: '#2b2a24', accent: '#4b6584' },
    { bg: '#2b2a24', fg: '#f3ecd6', title: '#ffffff', accent: '#e6b422' },
  ],
  zmeura: [
    { bg: '#ffffff', fg: '#3a1a26', title: '#9d174d', accent: '#7c3aed' },
    { bg: '#fdf2f8', fg: '#4a1d32', title: '#831843', accent: '#c2410c' },
    { bg: '#3b0f22', fg: '#fbe4ee', title: '#ffffff', accent: '#ff8fb8' },
  ],
};
/** Culorile variantei `v` a temei (0 = cele ale temei). */
export function variantColors(id: ThemeId, v: number | undefined): Pal {
  const t = themeOf(id);
  return (v && THEME_VARIANTS[t.id][v - 1]) || { bg: t.bg, fg: t.fg, title: t.title, accent: t.accent };
}

/** Perechi de fonturi pentru toată prezentarea (titluri / text), toate prezente pe orice Windows. */
export const FONT_SETS: { id: string; name: string; titleFont: string; bodyFont: string }[] = [
  { id: 'segoe', name: 'Segoe UI', titleFont: '"Segoe UI Semibold", "Segoe UI", sans-serif', bodyFont: '"Segoe UI", sans-serif' },
  { id: 'calibri', name: 'Calibri Light + Calibri', titleFont: '"Calibri Light", Calibri, sans-serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'cambria', name: 'Cambria + Calibri', titleFont: 'Cambria, Georgia, serif', bodyFont: 'Calibri, "Segoe UI", sans-serif' },
  { id: 'georgia', name: 'Georgia', titleFont: 'Georgia, serif', bodyFont: 'Georgia, serif' },
  { id: 'arial', name: 'Arial', titleFont: 'Arial, sans-serif', bodyFont: 'Arial, sans-serif' },
  { id: 'times', name: 'Times New Roman', titleFont: '"Times New Roman", Times, serif', bodyFont: '"Times New Roman", Times, serif' },
  { id: 'verdana', name: 'Verdana', titleFont: 'Verdana, sans-serif', bodyFont: 'Verdana, sans-serif' },
  { id: 'trebuchet', name: 'Trebuchet MS', titleFont: '"Trebuchet MS", sans-serif', bodyFont: '"Trebuchet MS", sans-serif' },
  { id: 'candara', name: 'Candara', titleFont: 'Candara, "Segoe UI", sans-serif', bodyFont: 'Candara, "Segoe UI", sans-serif' },
  { id: 'constantia', name: 'Constantia + Corbel', titleFont: 'Constantia, Georgia, serif', bodyFont: 'Corbel, "Segoe UI", sans-serif' },
  { id: 'garamond', name: 'Garamond + Gill Sans', titleFont: 'Garamond, Georgia, serif', bodyFont: '"Gill Sans MT", "Segoe UI", sans-serif' },
  { id: 'franklin', name: 'Franklin Gothic', titleFont: '"Franklin Gothic Medium", "Segoe UI", sans-serif', bodyFont: '"Franklin Gothic Book", "Segoe UI", sans-serif' },
];
/** Seturi de culori pentru toată prezentarea (fundal, text, titluri, accent), toate cu contrast bun și pe proiector. */
export const COLOR_SETS: { id: string; name: string; bg: string; fg: string; title: string; accent: string }[] = [
  { id: 'hartie', name: 'Hârtie', bg: '#ffffff', fg: '#222222', title: '#000000', accent: '#444444' },
  { id: 'ocean', name: 'Ocean', bg: '#f0f7fb', fg: '#16324f', title: '#0b4f7c', accent: '#0891b2' },
  { id: 'padure', name: 'Pădure', bg: '#f3f6ef', fg: '#2d3a24', title: '#3f6212', accent: '#65a30d' },
  { id: 'apus', name: 'Apus', bg: '#fff7ed', fg: '#431407', title: '#c2410c', accent: '#db2777' },
  { id: 'lavanda', name: 'Lavandă', bg: '#f7f5fd', fg: '#2e1065', title: '#5b21b6', accent: '#a855f7' },
  { id: 'grafit', name: 'Grafit', bg: '#26292f', fg: '#e5e7eb', title: '#ffffff', accent: '#38bdf8' },
  { id: 'miez', name: 'Miez de noapte', bg: '#0b1020', fg: '#cbd5e1', title: '#f8fafc', accent: '#facc15' },
  { id: 'vin', name: 'Vin', bg: '#3b0a1a', fg: '#fde7ee', title: '#ffffff', accent: '#fb7185' },
  { id: 'nisip', name: 'Nisip', bg: '#f6f0e4', fg: '#3f3a2e', title: '#7c5e10', accent: '#b45309' },
  { id: 'corporate', name: 'Birou', bg: '#ffffff', fg: '#1e293b', title: '#1e3a8a', accent: '#dc2626' },
];
/** Culorile unui set creat de utilizator (Culori → Creează culori…). */
export interface CustomColors { name: string; bg: string; fg: string; title: string; accent: string }
/** Valoarea lui `colors` pentru setul creat de utilizator. */
export const CUSTOM_COLORS = 'propriu';
const HEX6 = /^#[0-9a-f]{6}$/i;
/** Setul propriu citit dintr-un fișier: doar culori #rrggbb și un nume scurt; altfel undefined. */
export function cleanCustomColors(v: unknown): CustomColors | undefined {
  const c = v as Partial<CustomColors> | null;
  if (!c || typeof c !== 'object') return undefined;
  const ok = (['bg', 'fg', 'title', 'accent'] as const).every((k) => typeof c[k] === 'string' && HEX6.test(c[k]!));
  if (!ok) return undefined;
  return { name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 40) : 'Setul meu', bg: c.bg!.toLowerCase(), fg: c.fg!.toLowerCase(), title: c.title!.toLowerCase(), accent: c.accent!.toLowerCase() };
}
/** Tema prezentării, cu fonturile și culorile alese peste cele ale temei (dacă s-au ales). */
export function deckTheme(deck: Pick<Deck, 'theme' | 'variant' | 'fonts' | 'colors' | 'customColors'>): Theme {
  let t = themeOf(deck.theme);
  if (deck.variant) t = { ...t, ...variantColors(t.id, deck.variant) };
  const f = deck.fonts ? FONT_SETS.find((x) => x.id === deck.fonts) : undefined;
  if (f) t = { ...t, titleFont: f.titleFont, bodyFont: f.bodyFont };
  const c = deck.colors === CUSTOM_COLORS ? deck.customColors : deck.colors ? COLOR_SETS.find((x) => x.id === deck.colors) : undefined;
  if (c) t = { ...t, bg: c.bg, fg: c.fg, title: c.title, accent: c.accent };
  return t;
}
/** Perechea de fonturi după numele primului font (de exemplu cel citit dintr-un .pptx), sau undefined. */
export function fontSetOf(title: string, body: string): string | undefined {
  const first = (css: string) => css.split(',')[0].replace(/"/g, '').trim().toLowerCase();
  return FONT_SETS.find((x) => first(x.titleFont) === title.trim().toLowerCase() && first(x.bodyFont) === body.trim().toLowerCase())?.id;
}

export const LAYOUTS: [LayoutId, string][] = [
  ['title', 'Titlu'],
  ['content', 'Titlu și listă'],
  ['two', 'Două coloane'],
  ['section', 'Început de capitol'],
  ['blank', 'Gol'],
];

/** Mărimea literelor (în pixelii pânzei de 1280 × 720) pentru fiecare fel de casetă, după aspect. */
export function fontSize(kind: ElKind, layout: LayoutId): number {
  if (kind === 'title') return layout === 'title' ? 64 : layout === 'section' ? 56 : 44;
  if (kind === 'subtitle' || kind === 'text' || kind === 'shape') return 28;
  if (kind === 'table' || kind === 'chart') return 22;
  return 28;
}

/** Mărimile din lista de fonturi (în puncte, ca Font Size din PowerPoint). Slide-ul are 1280 px = 960 pt, deci 1 px = 0,75 pt. */
export const FONT_PTS = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
export const SIZE_MIN = 0.25, SIZE_MAX = 5;
/** Mărimea textului casetei, în puncte (rotunjită la jumătate de punct). */
export const ptOf = (e: Pick<SlideEl, 'kind' | 'size'>, layout: LayoutId) => Math.round(fontSize(e.kind, layout) * (e.size ?? 1) * 0.75 * 2) / 2;
/** Înmulțitorul `size` pentru o mărime în puncte (lipsă = cea a temei). */
export function sizeForPt(kind: ElKind, layout: LayoutId, pt: number): number | undefined {
  const s = Math.min(SIZE_MAX, Math.max(SIZE_MIN, +(pt / (fontSize(kind, layout) * 0.75)).toFixed(3)));
  return Math.abs(s - 1) < 0.001 ? undefined : s;
}

/** Textul de ajutor din casetele goale (doar în editor; la prezentare nu apare). */
export const PLACEHOLDER: Record<ElKind, string> = {
  title: 'Click și scrie titlul',
  subtitle: 'Subtitlu (de exemplu numele tău sau data)',
  body: 'Scrie ideile, câte una pe rând (Enter = punct nou)',
  text: 'Scrie aici',
  image: '',
  shape: '',
  table: '',
  chart: '',
  media: '',
};

/** Cel mult atâtea rânduri și coloane într-un tabel de pe slide (mai mult nu se mai citește de la distanță); 12 × 8 până la 29.10, ridicat pentru tabelele mari din .pptx și din foile de calcul. */
export const TABLE_MAX_ROWS = 30;
export const TABLE_MAX_COLS = 12;
/** Opțiunile de stil ale tabelului; ce lipsește înseamnă: cu cap colorat, cu rânduri alternate, fără prima coloană și fără rând de total. */
export interface TableLook { head?: boolean; band?: boolean; first?: boolean; last?: boolean }
export const TABLE_LOOKS: [keyof TableLook, string][] = [['head', 'Rând de antet'], ['band', 'Rânduri alternate'], ['first', 'Prima coloană'], ['last', 'Rând de total']];
export const tableLook = (e: Pick<SlideEl, 'tlook'>): Required<TableLook> => ({ head: e.tlook?.head ?? true, band: e.tlook?.band ?? true, first: !!e.tlook?.first, last: !!e.tlook?.last });
/** Doar ce diferă de opțiunile obișnuite (sau nimic). */
export function cleanLook(raw: unknown): TableLook | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>, o: TableLook = {};
  if (r.head === false) o.head = false;
  if (r.band === false) o.band = false;
  if (r.first === true) o.first = true;
  if (r.last === true) o.last = true;
  return Object.keys(o).length ? o : undefined;
}
/** Lățimile coloanelor (părți din 1), sau undefined dacă sunt (aproape) egale ori nu se potrivesc cu numărul de coloane. */
export function cleanColW(raw: unknown, cols: number): number[] | undefined {
  if (!Array.isArray(raw) || raw.length !== cols || cols < 2) return undefined;
  if (!raw.every((v) => typeof v === 'number' && isFinite(v) && v > 0)) return undefined;
  const sum = (raw as number[]).reduce((a, v) => a + v, 0);
  const w = (raw as number[]).map((v) => Math.round(Math.max(0.02, v / sum) * 10000) / 10000);
  return w.every((v) => Math.abs(v - 1 / cols) < 0.002) ? undefined : w;
}
/** Lățimile coloanelor tabelului (părți din 1), egale dacă nu sunt scrise. */
export const colFractions = (e: Pick<SlideEl, 'colW' | 'cells'>): number[] => {
  const n = e.cells?.[0]?.length ?? 1;
  return e.colW?.length === n ? e.colW : Array(n).fill(1 / n);
};
/** Înălțimile rândurilor tabelului (părți din 1), egale dacă nu sunt scrise. */
export const rowFractions = (e: Pick<SlideEl, 'rowH' | 'cells'>): number[] => {
  const n = e.cells?.length ?? 1;
  return e.rowH?.length === n ? e.rowH : Array(n).fill(1 / n);
};
/** Coloana c se lățește cu d (parte din lățimea tabelului), iar vecina din dreapta se îngustează la fel; fiecare rămâne de cel puțin 4%. */
export function dragColW(w: number[], c: number, d: number): number[] {
  if (c < 0 || c >= w.length - 1) return w;
  const min = 0.04, t = Math.max(min - w[c], Math.min(w[c + 1] - min, d));
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  return w.map((v, i) => (i === c ? r4(v + t) : i === c + 1 ? r4(v - t) : v));
}
export const newCells = (rows: number, cols: number): string[][] => Array.from({ length: rows }, () => Array(cols).fill(''));

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newSlide(layout: LayoutId, size: Size = { w: SLIDE_W, h: SLIDE_H }): Slide {
  // Pozițiile sunt gândite pe 1280 × 720 și se întind pe formatul ales.
  const kx = size.w / SLIDE_W, ky = size.h / SLIDE_H;
  const el = (kind: ElKind, x: number, y: number, w: number, h: number): SlideEl =>
    ({ id: uid(), kind, x: Math.round(x * kx), y: Math.round(y * ky), w: Math.round(w * kx), h: Math.round(h * ky), text: '' });
  const els: SlideEl[] = {
    title: [el('title', 100, 220, 1080, 170), el('subtitle', 100, 410, 1080, 90)],
    content: [el('title', 70, 40, 1140, 110), el('body', 70, 170, 1140, 500)],
    two: [el('title', 70, 40, 1140, 110), el('body', 70, 170, 555, 500), el('body', 655, 170, 555, 500)],
    section: [el('title', 100, 280, 1080, 170)],
    blank: [],
  }[layout];
  return { id: uid(), layout, els, notes: '' };
}

/**
 * Schimbă aspectul unui slide (ca Aspect din PowerPoint): titlul, subtitlul și listele trec în locurile noului aspect,
 * cu textul și formatarea lor; restul casetelor (poze, forme, casete de text) rămân unde sunt. Locurile goale de care noul aspect
 * n-are nevoie dispar. Cu `reset` (Resetează slide-ul), locurile revin la poziția, mărimea și formatarea temei.
 */
export function relayout(slide: Slide, to: LayoutId, size: Size = { w: SLIDE_W, h: SLIDE_H }, reset = false): Slide {
  const PH: ElKind[] = ['title', 'subtitle', 'body'];
  const used = new Set<string>();
  const take = (kinds: ElKind[]) => {
    for (const k of kinds) {
      const e = slide.els.find((x) => x.kind === k && !used.has(x.id) && (k === kinds[0] || x.text.trim()));
      if (e) { used.add(e.id); return e; }
    }
    return null;
  };
  const places = newSlide(to, size).els.map((p) => {
    // Întâi o casetă de același fel; subtitlul și lista se pot lua una pe alta, dacă au text.
    const old = take(p.kind === 'subtitle' ? ['subtitle', 'body'] : p.kind === 'body' ? ['body', 'subtitle'] : [p.kind]);
    if (!old) return p;
    const fmt: Partial<SlideEl> = reset ? {} : { ...old };
    if (reset) for (const k of ['anim', 'list'] as const) if (old[k] !== undefined) (fmt as Record<string, unknown>)[k] = old[k];
    // O listă care ajunge subtitlu (sau invers) își păstrează textul, nu și felul listei.
    if (old.kind !== p.kind) { delete fmt.list; delete fmt.listStart; }
    const text = old.kind !== p.kind && p.kind !== 'body' ? old.text.split('\n').map(lineText).join('\n') : old.text;
    return { ...fmt, id: old.id, kind: p.kind, x: p.x, y: p.y, w: p.w, h: p.h, text } as SlideEl;
  });
  const rest = slide.els.filter((e) => !used.has(e.id) && !(PH.includes(e.kind) && !e.text.trim()));
  return { ...slide, layout: to, els: [...places, ...rest] };
}

/** Găsește / Înlocuiește: unde apare textul căutat (caseta de pe slide și de câte ori, cu tot cu celulele tabelelor). */
export interface Hit { slide: number; el: string; count: number }
const lowerRo = (s: string) => { const l = s.toLocaleLowerCase('ro-RO'); return l.length === s.length ? l : s; };
/** Înlocuiește peste tot în `s` textul `q` (fără să țină cont de litere mari / mici); dă textul nou și de câte ori l-a găsit. */
export function replaceText(s: string, q: string, r: string): [string, number] {
  if (!q) return [s, 0];
  const hay = lowerRo(s), needle = lowerRo(q);
  let out = '', from = 0, n = 0;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, from)) { out += s.slice(from, i) + r; from = i + q.length; n++; }
  return [n ? out + s.slice(from) : s, n];
}
const countIn = (s: string, q: string) => replaceText(s, q, q)[1];
export function findHits(deck: Deck, q: string): Hit[] {
  const hits: Hit[] = [];
  if (!q) return hits;
  deck.slides.forEach((s, i) => s.els.forEach((e) => {
    const count = countIn(e.text, q) + (e.cells ?? []).flat().reduce((a, c) => a + countIn(c, q), 0);
    if (count) hits.push({ slide: i, el: e.id, count });
  }));
  return hits;
}
/** Înlocuiește în toată prezentarea (sau doar în caseta `only`); dă prezentarea nouă și câte înlocuiri a făcut. */
export function replaceInDeck(deck: Deck, q: string, r: string, only?: { slide: number; el: string }): { deck: Deck; count: number } {
  let count = 0;
  const rep = (t: string) => { const [o, n] = replaceText(t, q, r); count += n; return o; };
  const slides = deck.slides.map((s, i) => (only && only.slide !== i ? s : {
    ...s,
    els: s.els.map((e) => {
        if (only && only.el !== e.id) return e;
        const { marks: _m, ...rest } = e, text = rep(e.text), marks = marksAfterEdit(e.marks, e.text, text);
        return { ...rest, text, ...(marks ? { marks } : {}), ...(e.cells ? { cells: e.cells.map((row) => row.map(rep)) } : {}) };
      }),
  }));
  return { deck: count ? { ...deck, slides } : deck, count };
}

export function emptyDeck(): Deck {
  return { format: 'suite-slides', version: 1, theme: 'simplu', slides: [newSlide('title')], updatedAt: new Date().toISOString() };
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export type BgDir = 'down' | 'right' | 'diag' | 'radial';
export const BG_DIRS: [BgDir, string][] = [['down', '↓ De sus în jos'], ['right', '→ De la stânga la dreapta'], ['diag', '↘ Pe diagonală'], ['radial', '◎ Din centru']];
/** A doua culoare propusă pentru degrade: o nuanță mai deschisă a unui fundal închis, sau mai închisă a unuia deschis. */
export function gradPartner(c: string): string {
  const n = parseInt(c.slice(1), 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const dark = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] <= 160;
  return '#' + rgb.map((v) => Math.round(dark ? v + (255 - v) * 0.55 : v * 0.78).toString(16).padStart(2, '0')).join('');
}
/** Amestecă două culori #rrggbb: t = 0 dă prima, t = 1 a doua. */
export function mixHex(a: string, b: string, t: number): string {
  const p = (c: string) => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export interface BgStyle { id: string; name: string; bg: string; bg2?: string; bgDir?: BgDir }
/** Stilurile de fundal (ca Background Styles din PowerPoint): 12 fundaluri gata făcute din culorile temei,
 *  pe trei rânduri: deschise, cu degrade și închise. Se pun ca bg / bg2 / bgDir, deci se păstrează și în .pptx. */
export function backgroundStyles(t: Pick<Theme, 'bg' | 'fg' | 'accent'>): BgStyle[] {
  const W = '#ffffff', K = '#000000', light = textOn(t.bg) !== '#ffffff';
  const paper = light ? t.bg : mixHex(t.fg, W, 0.85), ink = light ? mixHex(t.fg, K, 0.35) : mixHex(t.bg, t.accent, 0.18);
  return [
    { id: 'tema', name: 'Fundalul temei', bg: t.bg },
    { id: 'gri', name: 'Gri deschis', bg: mixHex(t.fg, W, 0.92) },
    { id: 'pal', name: 'Accent pal', bg: mixHex(t.accent, W, 0.88) },
    { id: 'hartie', name: 'Hârtie', bg: mixHex(paper, mixHex(t.accent, '#806040', 0.5), 0.06) },
    { id: 'dsus', name: 'Lumină de sus', bg: W, bg2: mixHex(t.accent, W, 0.75) },
    { id: 'ddiag', name: 'Diagonală', bg: mixHex(t.accent, W, 0.9), bg2: mixHex(t.accent, W, 0.55), bgDir: 'diag' },
    { id: 'drad', name: 'Reflector', bg: W, bg2: mixHex(t.accent, W, 0.6), bgDir: 'radial' },
    { id: 'dacc', name: 'Accent în degrade', bg: t.accent, bg2: mixHex(t.accent, K, 0.45), bgDir: 'diag' },
    { id: 'accent', name: 'Accent plin', bg: mixHex(t.accent, K, 0.15) },
    { id: 'inchis', name: 'Închis', bg: ink },
    { id: 'noapte', name: 'Noapte', bg: mixHex(ink, K, 0.4), bg2: mixHex(t.accent, K, 0.6), bgDir: 'right' },
    { id: 'scena', name: 'Scenă', bg: mixHex(t.accent, K, 0.5), bg2: mixHex(ink, K, 0.7), bgDir: 'radial' },
  ];
}
/** Fundalul slide-ului pentru CSS: culoarea plină sau degradeul dintre `bg` și `bg2`. */
export function slideBackground(s: Pick<Slide, 'bg' | 'bg2' | 'bgDir' | 'bgImg'>, themeBg: string): string {
  const a = s.bg ?? themeBg;
  if (s.bgImg) return `url("${s.bgImg}") center / cover no-repeat ${a}`;
  if (!s.bg2) return a;
  if (s.bgDir === 'radial') return `radial-gradient(circle at center, ${a}, ${s.bg2})`;
  return `linear-gradient(${s.bgDir === 'right' ? 90 : s.bgDir === 'diag' ? 135 : 180}deg, ${a}, ${s.bg2})`;
}

/** O poză ca data URL (base64), singura formă acceptată pentru poze în fișierul Suite. */
const isImgData = (s: unknown): s is string => typeof s === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]+$/.test(s);

/** Umplerea formei pentru CSS: culoarea plină sau degradeul dintre `a` și `b`, cu transparența formei pe amândouă. */
export function shapeFillCss(a: string, b: string | undefined, dir: BgDir | undefined, transp?: number, img?: string): string {
  const ca = withTransp(a, transp);
  if (img) return `url("${img}") center / 100% 100% no-repeat${transp ? '' : ' ' + ca}`;
  if (!b) return ca;
  const cb = withTransp(b, transp);
  if (dir === 'radial') return `radial-gradient(circle at center, ${ca}, ${cb})`;
  return `linear-gradient(${dir === 'right' ? 90 : dir === 'diag' ? 135 : 180}deg, ${ca}, ${cb})`;
}

/** Citește un fișier .sslides; ce lipsește sau e stricat se completează, ca fișierul să se deschidă oricum. */
/** Casetele citite dintr-un fișier, curățate (tipuri, culori, mărimi valide); folosite la slide-uri și la coordonator. */
/** Limba de verificare: un cod ca „en-US” / „fr” sau „none”; româna (implicită) și altceva → undefined. */
export const cleanLang = (v: unknown): string | undefined => {
  const t = String(v ?? '').trim();
  return (t === 'none' || /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(t)) && !/^ro(?:-RO)?$/i.test(t) ? t : undefined;
};

export function cleanEls(v: unknown): SlideEl[] {
  return (Array.isArray(v) ? v : []).filter((e) => e && typeof e === 'object').map((e: Partial<SlideEl>) => ({
    id: typeof e?.id === 'string' ? e.id : uid(),
    kind: (['title', 'subtitle', 'body', 'text', 'image', 'shape', 'table', 'chart', 'media'] as ElKind[]).includes(e?.kind as ElKind) ? (e!.kind as ElKind) : 'body',
    x: num(e?.x, 100), y: num(e?.y, 100), w: num(e?.w, 400), h: num(e?.h, 100),
    text: typeof e?.text === 'string' ? e.text : '',
    ...(e?.kind === 'shape' ? { shape: SHAPES.some(([k]) => k === e.shape) ? e.shape : 'rect', fill: typeof e.fill === 'string' && /^(accent|#[0-9a-f]{6})$/i.test(e.fill) ? e.fill : 'accent' } : {}),
    ...(e?.kind === 'shape' && isPath(e.path) ? { path: e.path } : {}),
    ...(e?.kind === 'shape' && e.shape !== 'line' && isImgData(e.fillImg) ? { fillImg: e.fillImg } : {}),
    ...(e?.kind === 'shape' && e.shape !== 'line' && !isImgData(e.fillImg) && typeof e.fill2 === 'string' && /^#[0-9a-f]{6}$/i.test(e.fill2) ? { fill2: e.fill2, ...(BG_DIRS.some(([k]) => k === e.fillDir) && e.fillDir !== 'down' ? { fillDir: e.fillDir } : {}) } : {}),
    ...(e?.kind === 'shape' && e.shape === 'line' && LINE_ENDS.some(([k]) => k && k === e.ends) ? { ends: e.ends } : {}),
    ...(e?.kind === 'shape' && e.shape === 'line' && LINE_ROUTES.some(([k]) => k && k === e.route) ? { route: e.route } : {}),
    ...(e?.kind === 'shape' && e.shape === 'line' && e.route && ['hv', 'vh', 'vv'].includes(e.axes as string) ? { axes: e.axes } : {}),
    ...(e?.kind === 'shape' && e.shape === 'line' && e.route && typeof e.bend === 'number' && Number.isFinite(e.bend) && e.bend >= 0 && e.bend <= 1 && e.bend !== 0.5 ? { bend: e.bend } : {}),
    ...(e?.kind === 'shape' && e.shape !== 'line' && e.cam === true ? { cam: true } : {}),
    ...(e?.kind === 'shape' && e.shape === 'line' && cxnOk(e.stCxn) ? { stCxn: { id: e.stCxn.id, idx: e.stCxn.idx } } : {}),
    ...(e?.kind === 'shape' && e.shape === 'line' && cxnOk(e.endCxn) ? { endCxn: { id: e.endCxn.id, idx: e.endCxn.idx } } : {}),
    ...((e?.kind === 'shape' || e?.kind === 'image') && typeof e.line === 'string' && /^#[0-9a-f]{6}$/i.test(e.line)
      ? { line: e.line, lineW: Math.min(20, Math.max(0.5, num(e.lineW, 2))), ...(LINE_DASHES.some(([k]) => k === e.lineDash) ? { lineDash: e.lineDash } : {}) } : {}),
    ...((e?.kind === 'shape' || e?.kind === 'image') && cleanFx(e.fx) ? { fx: cleanFx(e.fx) } : {}),
    ...((e?.kind === 'shape' || e?.kind === 'image') && cleanRot3d(e.rot3d) ? { rot3d: cleanRot3d(e.rot3d) } : {}),
    ...((e?.kind === 'shape' || e?.kind === 'image') && typeof e.transp === 'number' && e.transp > 0 ? { transp: Math.min(100, Math.round(e.transp)) } : {}),
    ...(cleanLink(e?.link) ? { link: cleanLink(e?.link) } : {}),
    ...(cleanSnd(e?.linkSnd) ? { linkSnd: e.linkSnd } : {}),
    ...(e?.linkHover === true && (cleanLink(e.link) || cleanSnd(e.linkSnd)) ? { linkHover: true } : {}),
    ...(e?.kind === 'image' && e.szoom === true && cleanLink(e.link)?.startsWith('#s:') ? { szoom: true, ...(e.szsec === true ? { szsec: true } : {}) } : {}),
    ...(e?.hide === true ? { hide: true } : {}),
    ...(e?.kind !== 'table' && cleanLang(e?.lang) ? { lang: cleanLang(e?.lang) } : {}),
    ...(typeof e?.grp === 'string' && /^[\w-]{1,40}$/.test(e.grp) ? { grp: e.grp } : {}),
    ...(e?.kind === 'shape' && typeof e.dgm === 'string' && /^[\w-]{1,40}$/.test(e.dgm) ? { dgm: e.dgm, dgmRole: e.dgmRole === 'sub' || e.dgmRole === 'link' ? e.dgmRole : 'main' as DiagramRole, ...(typeof e.dgmKind === 'string' && /^[a-z]{1,20}$/.test(e.dgmKind) ? { dgmKind: e.dgmKind } : {}), ...(e.dgmRole === 'sub' && (e.dgmLvl === 2 || e.dgmLvl === 3) ? { dgmLvl: e.dgmLvl } : {}) } : {}),
    ...(e?.kind === 'image' && cleanCrop(e.crop) ? { crop: cleanCrop(e.crop) } : {}),
    ...(e?.kind === 'image' && cleanClip(e.clip) ? { clip: cleanClip(e.clip) } : {}),
    ...(e?.kind === 'image' && cleanInk(e.ink) ? { ink: cleanInk(e.ink) } : {}),
    ...(e?.kind === 'image' && cleanM3d(e.m3d) ? { m3d: cleanM3d(e.m3d) } : {}),
    ...(e?.kind === 'image' && typeof e.eq === 'string' && e.eq.trim() ? { eq: e.eq.trim().slice(0, 400) } : {}),
    ...(e?.kind === 'image' && parseIconSpec(e.icon) ? { icon: parseIconSpec(e.icon)! } : {}),
    ...(e?.kind === 'image' && typeof e.alt === 'string' && e.alt.trim() ? { alt: e.alt.trim().slice(0, 500) } : {}),
    ...(e?.kind === 'image' && cleanAdj(e.adj) ? { adj: cleanAdj(e.adj) } : {}),
    ...(e?.kind === 'image' && typeof e.art === 'string' && /^[a-z]{2,16}$/.test(e.art) && isImgData(e.orig) ? { art: e.art, orig: e.orig } : {}),
    ...(e?.kind === 'image' && isImgData(e.nobg) ? { nobg: e.nobg } : {}),
    ...(typeof e?.size === 'number' && e.size >= SIZE_MIN && e.size <= SIZE_MAX ? { size: e.size } : {}),
    ...(typeof e?.color === 'string' && /^#[0-9a-f]{6}$/i.test(e.color) ? { color: e.color } : {}),
    ...(e?.bold === true || e?.bold === false ? { bold: e.bold } : {}),
    ...(e?.italic === true ? { italic: true } : {}),
    ...(e?.underline === true ? { underline: true } : {}),
    ...(e?.strike === true ? { strike: true } : {}),
    ...(cleanTextFx(e?.tfx) && e?.kind !== 'table' && e?.kind !== 'chart' && e?.kind !== 'image' && e?.kind !== 'media' ? { tfx: cleanTextFx(e?.tfx) } : {}),
    ...(cleanWarp(e?.warp) && e?.kind !== 'table' && e?.kind !== 'chart' && e?.kind !== 'image' && e?.kind !== 'media' && !(e?.kind === 'shape' && e.shape === 'line') ? { warp: cleanWarp(e?.warp) } : {}),
    ...(cleanTextGrad(e?.tgrad) && e?.kind !== 'table' && e?.kind !== 'chart' && e?.kind !== 'image' && e?.kind !== 'media' ? { tgrad: cleanTextGrad(e?.tgrad) } : {}),
    ...(cleanFont(e?.font) ? { font: cleanFont(e?.font) } : {}),
    ...(parseMarks(e?.marks, typeof e?.text === 'string' ? e.text.length : 0) ? { marks: parseMarks(e?.marks, typeof e?.text === 'string' ? e.text.length : 0) } : {}),
    ...(e?.align === 'left' || e?.align === 'center' || e?.align === 'right' || e?.align === 'justify' ? { align: e.align } : {}),
    ...(typeof e?.spacing === 'number' && e.spacing >= 0.5 && e.spacing <= 5 && e.spacing !== 1 ? { spacing: e.spacing } : {}),
    ...(e?.kind !== 'table' && e?.kind !== 'chart' && e?.kind !== 'image' && e?.kind !== 'media' && cleanGap(e.spb) ? { spb: cleanGap(e.spb) } : {}),
    ...(e?.kind !== 'table' && e?.kind !== 'chart' && e?.kind !== 'image' && e?.kind !== 'media' && cleanGap(e.spa) ? { spa: cleanGap(e.spa) } : {}),
    ...(e?.kind !== 'table' && e?.kind !== 'chart' && e?.kind !== 'image' && e?.kind !== 'media' && cleanPfmt(e.pfmt, String(e.text ?? '').split('\n').length) ? { pfmt: cleanPfmt(e.pfmt, String(e.text ?? '').split('\n').length) } : {}),
    ...(e?.valign === 'top' || e?.valign === 'middle' || e?.valign === 'bottom' ? { valign: e.valign } : {}),
    ...(e?.kind !== 'table' && e?.kind !== 'chart' && e?.kind !== 'image' && e?.kind !== 'media' && !(e?.kind === 'shape' && e.shape === 'line') && cleanInset(e?.inset) ? { inset: cleanInset(e?.inset) } : {}),
    ...(canTurn({ kind: (e?.kind ?? 'body') as ElKind }) && typeof e?.rot === 'number' && normRot(e.rot) ? { rot: normRot(e.rot) } : {}),
    ...(canTurn({ kind: (e?.kind ?? 'body') as ElKind }) && e?.flipH === true ? { flipH: true } : {}),
    ...(canTurn({ kind: (e?.kind ?? 'body') as ElKind }) && e?.flipV === true ? { flipV: true } : {}),
    ...(e?.kind === 'body' && (isNumbered(e.list) || e.list === 'none') ? { list: e.list } : {}),
    ...(e?.kind === 'body' && isNumbered(e.list) && cleanListStart(e.listStart) ? { listStart: cleanListStart(e.listStart) } : {}),
    ...(e?.kind === 'table' || e?.kind === 'chart' ? { cells: cleanCells(e.cells) } : {}),
    ...(e?.kind === 'table' && cleanLook(e.tlook) ? { tlook: cleanLook(e.tlook) } : {}),
    ...(e?.kind === 'table' && cleanMerges(e.merge, cleanCells(e.cells).length, cleanCells(e.cells)[0].length) ? { merge: cleanMerges(e.merge, cleanCells(e.cells).length, cleanCells(e.cells)[0].length) } : {}),
    ...(e?.kind === 'table' && cleanBorder(e.tborder) ? { tborder: cleanBorder(e.tborder) } : {}),
    ...(e?.kind === 'table' && cleanTStyle(e.tstyle) ? { tstyle: cleanTStyle(e.tstyle) } : {}),
    ...(e?.kind === 'table' && cleanTColor(e.tcolor) ? { tcolor: cleanTColor(e.tcolor) } : {}),
    ...(e?.kind === 'table' && cleanLineW(e.tlineW) ? { tlineW: cleanLineW(e.tlineW) } : {}),
    ...(e?.kind === 'table' && cleanLineC(e.tlineC) ? { tlineC: cleanLineC(e.tlineC) } : {}),
    ...(e?.kind === 'table' && cleanPad(e.tpad) ? { tpad: cleanPad(e.tpad) } : {}),
    ...(e?.kind === 'table' && cleanDir(e.tdir) ? { tdir: cleanDir(e.tdir) } : {}),
    ...(e?.kind === 'table' && cleanCellFmt(e.cfmt, cleanCells(e.cells).length, cleanCells(e.cells)[0].length) ? { cfmt: cleanCellFmt(e.cfmt, cleanCells(e.cells).length, cleanCells(e.cells)[0].length) } : {}),
    ...(e?.kind === 'table' && e.slink && typeof e.slink.path === 'string' && /[\\/]/.test(e.slink.path) ? { slink: { path: e.slink.path.slice(0, 1000), sheet: String(e.slink.sheet ?? '').slice(0, 200) } } : {}),
    ...(e?.kind === 'table' && cleanColW(e.rowH, cleanCells(e.cells).length) ? { rowH: cleanColW(e.rowH, cleanCells(e.cells).length) } : {}),
    ...(e?.kind === 'table' && cleanColW(e.colW, cleanCells(e.cells)[0].length) ? { colW: cleanColW(e.colW, cleanCells(e.cells)[0].length) } : {}),
    ...(e?.kind === 'chart' ? {
      chart: SLIDE_CHART_TYPES.some(([k]) => k === e.chart) ? e.chart as ChartType : 'col' as const,
      ...(Number.isInteger(e.cpal) && e.cpal! > 0 && e.cpal! < PALETTES.length ? { cpal: e.cpal } : {}),
      ...(typeof e.cxt === 'string' && e.cxt.trim() ? { cxt: e.cxt.slice(0, 100) } : {}),
      ...(typeof e.cyt === 'string' && e.cyt.trim() ? { cyt: e.cyt.slice(0, 100) } : {}),
      ...(e.clab === true ? { clab: true } : {}),
      ...(e.cleg === 't' || e.cleg === 'r' || e.cleg === 'none' ? { cleg: e.cleg } : {}),
      ...(e.cng === true ? { cng: true } : {}),
      ...(typeof e.cbg === 'string' && /^#[0-9a-f]{6}$/i.test(e.cbg) ? { cbg: e.cbg.toLowerCase() } : {}),
      ...(typeof e.cln === 'string' && /^#[0-9a-f]{6}$/i.test(e.cln) ? { cln: e.cln.toLowerCase() } : {}),
      ...(cleanFont(e.cfont) ? { cfont: cleanFont(e.cfont) } : {}),
      ...(typeof e.cink === 'string' && /^#[0-9a-f]{6}$/i.test(e.cink) ? { cink: e.cink.toLowerCase() } : {}),
      ...(Array.isArray(e.choff) && e.choff.some((c) => Number.isInteger(c) && c > 0) ? { choff: [...new Set(e.choff.filter((c) => Number.isInteger(c) && c > 0 && c < 100))].sort((a, b) => a - b) } : {}),
    } : {}),
    ...(e?.anim && ANIMS.some(([a]) => a && a === e.anim) ? { anim: e.anim } : {}),
    ...(e?.anim && (e.animStart === 'with' || e.animStart === 'after') ? { animStart: e.animStart } : {}),
    ...(e?.anim && typeof e.animDur === 'number' && e.animDur >= 0.1 && e.animDur <= 20 ? { animDur: e.animDur } : {}),
    ...(e?.anim && Number.isInteger(e.animOrder) && e.animOrder! >= 0 && e.animOrder! < 10000 ? { animOrder: e.animOrder } : {}),
    ...(e?.anim && typeof e.animDelay === 'number' && e.animDelay > 0 && e.animDelay <= 60 ? { animDelay: e.animDelay } : {}),
    ...(e?.kind === 'body' && e.anim && e.animBy === 'p' ? { animBy: 'p' as const } : {}),
    ...(e?.anim && typeof e.animTrig === 'string' && /^[\w-]{1,40}$/.test(e.animTrig) ? { animTrig: e.animTrig } : {}),
    ...(e?.anim && ANIMS.some(([a]) => a && a === e.anim) && Array.isArray(e.more) && e.more.some((m) => cleanAnimFx(m)) ? { more: e.more.map((m) => cleanAnimFx(m)).filter((m): m is AnimFx => !!m).slice(0, MAX_FX) } : {}),
    ...(hasAnimDir(e?.anim) && (e.animDir === 't' || e.animDir === 'l' || e.animDir === 'r') ? { animDir: e.animDir } : {}),
    ...(isMotionPath(e?.anim) && (e.animLen === 's' || e.animLen === 'l') ? { animLen: e.animLen } : {}),
    ...(e?.anim === 'pathFree' && cleanPathPts(e.animPts) ? { animPts: cleanPathPts(e.animPts)! } : {}),
    ...(e?.kind === 'image' && typeof e.src === 'string' && e.src.startsWith('data:image/') ? { src: e.src } : {}),
    ...(e?.kind === 'media' && typeof e.src === 'string' && /^data:(video|audio)\//.test(e.src) ? { src: e.src } : {}),
    ...(e?.kind === 'media' && e.autoplay === true ? { autoplay: true } : {}),
    ...(e?.kind === 'media' && e.loop === true ? { loop: true } : {}),
    ...(e?.kind === 'media' && typeof e.poster === 'string' && e.poster.startsWith('data:image/') && typeof e.src === 'string' && e.src.startsWith('data:video/') ? { poster: e.poster } : {}),
    ...(e?.kind === 'media' && e.across === true && typeof e.src === 'string' && e.src.startsWith('data:audio/') ? { across: true } : {}),
    ...(e?.kind === 'media' && typeof e.vol === 'number' && e.vol >= 0 && e.vol < 1 ? { vol: e.vol } : {}),
    ...(e?.kind === 'media' && e.full === true ? { full: true } : {}),
    ...(e?.kind === 'media' && e.hideIdle === true ? { hideIdle: true } : {}),
    ...(e?.kind === 'media' && e.narr === true && typeof e.src === 'string' && e.src.startsWith('data:audio/') ? { narr: true } : {}),
    ...(e?.kind === 'media' && typeof e.fadeIn === 'number' && e.fadeIn > 0 && e.fadeIn <= 10 ? { fadeIn: e.fadeIn } : {}),
    ...(e?.kind === 'media' && typeof e.fadeOut === 'number' && e.fadeOut > 0 && e.fadeOut <= 10 ? { fadeOut: e.fadeOut } : {}),
    ...(e?.kind === 'media' ? cleanTrim(e.trimA, e.trimB) : {}),
    ...(e?.kind === 'media' ? cleanBmk(e.bmk) : {}),
  })).filter((e: SlideEl) => (e.kind !== 'image' && e.kind !== 'media') || e.src);
}

export function parseDeck(text: string): Deck {
  const d = JSON.parse(text);
  if (d?.format !== 'suite-slides' || !Array.isArray(d.slides)) throw new Error('Fișierul nu este o prezentare Cyber Office Studio.');
  const layouts = LAYOUTS.map(([id]) => id);
  const slides: Slide[] = d.slides.map((s: Partial<Slide>) => ({
    id: typeof s?.id === 'string' ? s.id : uid(),
    layout: layouts.includes(s?.layout as LayoutId) ? (s!.layout as LayoutId) : 'blank',
    ...(typeof s?.bg === 'string' && /^#[0-9a-f]{6}$/i.test(s.bg) ? { bg: s.bg } : {}),
    ...(typeof s?.bgImg === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]+$/.test(s.bgImg) ? { bgImg: s.bgImg } : {}),
    ...(typeof s?.bg2 === 'string' && /^#[0-9a-f]{6}$/i.test(s.bg2) ? { bg2: s.bg2, ...(BG_DIRS.some(([k]) => k === s.bgDir) && s.bgDir !== 'down' ? { bgDir: s.bgDir } : {}) } : {}),
    els: cleanEls(s?.els),
    notes: typeof s?.notes === 'string' ? s.notes : '',
    ...(s?.hidden === true ? { hidden: true } : {}),
    ...(s?.noMaster === true ? { noMaster: true } : {}),
    ...(cleanSection(s?.section) ? { section: cleanSection(s?.section) } : {}),
    ...(cleanComments(s?.comments) ? { comments: cleanComments(s?.comments) } : {}),
    ...(cleanAdvance(s?.advance) ? { advance: cleanAdvance(s?.advance) } : {}),
    ...(TRANSITIONS.some(([t]) => t === s?.transition) ? { transition: s!.transition } : {}),
    ...(TR_DIRS.some(([d]) => d === s?.trDir) && s.trDir !== 'l' ? { trDir: s.trDir } : {}),
    ...(TR_SPLITS.some(([d]) => d === s?.trSplit) && s.trSplit !== 'vo' ? { trSplit: s.trSplit } : {}),
    ...(s?.trSpeed === 'fast' || s?.trSpeed === 'slow' ? { trSpeed: s.trSpeed } : {}),
    ...(cleanTrDur(s?.trDur) ? { trDur: cleanTrDur(s?.trDur) } : {}),
    ...(cleanSnd(s?.trSound) ? { trSound: s.trSound } : {}),
  }));
  return {
    format: 'suite-slides', version: 1,
    theme: THEMES.some((t) => t.id === d.theme) ? d.theme : 'simplu',
    ...(d.size !== 'wide' && FORMATS.some(([f]) => f === d.size) ? { size: d.size } : {}),
    ...(d.size === 'custom' && cleanCustomSize(d.custom) ? { size: 'custom' as const, custom: cleanCustomSize(d.custom) } : {}),
    ...(Number.isInteger(d.variant) && d.variant! >= 1 && d.variant! <= 3 ? { variant: d.variant } : {}),
    ...(FONT_SETS.some((x) => x.id === d.fonts) ? { fonts: d.fonts } : {}),
    ...(COLOR_SETS.some((x) => x.id === d.colors) || (d.colors === CUSTOM_COLORS && cleanCustomColors(d.customColors)) ? { colors: d.colors } : {}),
    ...(cleanCustomColors(d.customColors) ? { customColors: cleanCustomColors(d.customColors) } : {}),
    ...(d.numbers === true ? { numbers: true } : {}),
    ...(d.loop === true ? { loop: true } : {}),
    ...(d.kiosk === true ? { kiosk: true } : {}),
    ...(d.noTimings === true && d.kiosk !== true ? { noTimings: true } : {}),
    ...(d.noNarr === true ? { noNarr: true } : {}),
    ...(cleanRange(d.range, slides.length) ? { range: cleanRange(d.range, slides.length)! } : {}),
    ...(cleanGuides(d.guides, deckSize(d)) ? { guides: cleanGuides(d.guides, deckSize(d))! } : {}),
    ...(typeof d.footer === 'string' && d.footer.trim() ? { footer: d.footer.slice(0, 200) } : {}),
    ...(typeof d.date === 'string' && d.date.trim() ? { date: d.date.slice(0, 60) } : {}),
    ...(cleanShows(d.shows, slides) ? { shows: cleanShows(d.shows, slides) } : {}),
    ...(d.master && cleanEls(d.master.els).length ? { master: { els: cleanEls(d.master.els) } } : {}),
    ...(cleanLayoutMasters(d.layoutMasters) ? { layoutMasters: cleanLayoutMasters(d.layoutMasters) } : {}),
    ...(cleanHandoutMaster(d.handoutMaster) ? { handoutMaster: cleanHandoutMaster(d.handoutMaster) } : {}),
    ...(cleanNotesMaster(d.notesMaster) ? { notesMaster: cleanNotesMaster(d.notesMaster) } : {}),
    ...(cleanDeckMacros(d.macros).length ? { macros: cleanDeckMacros(d.macros) } : {}),
    ...(docProps(d) ? { props: docProps(d) } : {}),
    slides: slides.length ? slides : [newSlide('title')],
    updatedAt: String(d.updatedAt ?? ''),
  };
}

/** Macrocomenzile prezentării (sau din setări), cu casetele noi din ele curățate ca la deschiderea unui fișier. */
export function cleanDeckMacros(v: unknown): SlideMacro[] {
  return cleanSlideMacros(v).map((m) => ({ ...m, steps: m.steps.flatMap((st) => {
    if (!st.add) return [st];
    const el = cleanEls([{ ...st.add, id: 'm' }])[0];
    if (!el) return [];
    const { id: _id, ...add } = el;
    return [{ ...st, add }];
  }) })).filter((m) => m.steps.length);
}

export function serializeDeck(deck: Deck): string {
  return JSON.stringify({ ...deck, updatedAt: new Date().toISOString() });
}

/** Titlul prezentării (pentru numele fișierului): primul titlu scris. */
export function deckTitle(deck: Deck): string {
  for (const s of deck.slides) for (const e of s.els) if (e.kind === 'title' && e.text.trim()) return e.text.trim().split('\n')[0];
  return 'Prezentare';
}

/** Culoarea reală a unei forme (în tema dată). */
export const fillOf = (fill: string | undefined, theme: Theme) => (!fill || fill === 'accent' ? theme.accent : fill);
/** Text alb pe culori închise, închis pe culori deschise. */
export function textOn(bg: string): string {
  const n = parseInt(bg.slice(1), 16);
  const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 160 ? '#111827' : '#ffffff';
}

/** Celulele citite dintr-un fișier: dreptunghiulare, doar text, în limitele de mai sus. */
function cleanCells(raw: unknown): string[][] {
  const rows = (Array.isArray(raw) ? raw : []).filter(Array.isArray).slice(0, TABLE_MAX_ROWS) as unknown[][];
  const cols = Math.min(TABLE_MAX_COLS, Math.max(1, ...rows.map((r) => r.length)));
  if (!rows.length) return newCells(3, 3);
  return rows.map((r) => Array.from({ length: cols }, (_, c) => (typeof r[c] === 'string' ? (r[c] as string) : '')));
}

/** Altă mărime de slide: casetele se întind cu slide-ul; pozele și graficele își păstrează proporțiile, centrate în locul lor. */
export function resizeDeck(deck: Deck, to: SlideFormat | Size): Deck {
  const a = deckSize(deck), b = typeof to === 'string' ? sizeOf(to) : cleanCustomSize(to) ?? a;
  const kx = b.w / a.w, ky = b.h / a.h;
  const { custom: _c, ...rest } = deck;
  return {
    ...rest,
    size: typeof to !== 'string' ? 'custom' : to === 'wide' ? undefined : to,
    ...(typeof to !== 'string' ? { custom: b } : {}),
    slides: deck.slides.map((s) => ({
      ...s,
      els: s.els.map((e) => {
        const box = { x: e.x * kx, y: e.y * ky, w: e.w * kx, h: e.h * ky };
        if (e.kind === 'image' || e.kind === 'chart' || e.kind === 'media') {
          // Media celor două întinderi (dus-întors rămâne aceeași mărime), dar cel mult cât încape pe slide.
          const k = Math.min(Math.sqrt(kx * ky), b.w / e.w, b.h / e.h), w = e.w * k, h = e.h * k;
          const x = Math.max(0, Math.min(b.w - w, box.x + (box.w - w) / 2)), y = Math.max(0, Math.min(b.h - h, box.y + (box.h - h) / 2));
          Object.assign(box, { x, y, w, h });
        }
        return { ...e, x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) };
      }),
    })),
  };
}
