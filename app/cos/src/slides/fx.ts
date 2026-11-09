// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Efectele formelor și pozelor (Shape Effects): umbră, umbră mare, strălucire, margini estompate, reflexie, teșire.
// Pe ecran sunt filtre CSS drop-shadow (urmăresc conturul formei, și la triunghiuri sau stele);
// în .pptx sunt a:effectLst cu a:outerShdw / a:glow / a:softEdge / a:reflection în spPr, iar teșirea e a:sp3d cu a:bevelT.
// Reflexia e -webkit-box-reflect (sub obiect, stinsă în jos), teșirea un filtru SVG cu lumină (BEVEL_FILTER, desenat de SlideView).

export type ShapeFx = 'shadow' | 'shadowBig' | 'glow' | 'soft' | 'reflect' | 'bevel';

export const SHAPE_FX: [ShapeFx | '', string][] = [
  ['', '◻ Fără efect'],
  ['shadow', '◪ Umbră'],
  ['shadowBig', '◪ Umbră mare'],
  ['glow', '✺ Strălucire'],
  ['soft', '◌ Margini estompate'],
  ['reflect', '⧩ Reflexie'],
  ['bevel', '◈ Teșire'],
];
/** Efectele care se pot pune și pe linii (reflexia, teșirea și marginile estompate nu au sens acolo). */
export const LINE_FX = SHAPE_FX.filter(([k]) => k === '' || k === 'shadow' || k === 'shadowBig' || k === 'glow');
/** Id-ul filtrului SVG de teșire (lumină din stânga-sus pe marginile formei), pus o dată în fiecare cadru de slide. */
export const BEVEL_FILTER = 'sl-fx-bevel';

export const cleanFx = (v: unknown): ShapeFx | undefined => (SHAPE_FX.some(([k]) => k && k === v) ? (v as ShapeFx) : undefined);

/** Culoarea #rrggbb cu opacitatea a (0..1), ca rgba(). */
const rgba = (c: string, a: number) => {
  const n = parseInt(c.replace('#', '').slice(0, 6), 16) || 0;
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Filtrul CSS pentru efect (în pixeli de slide; 1 pt = 4/3 px). `glow` = culoarea strălucirii (accentul temei). */
export function fxCss(fx: ShapeFx | undefined, glow: string): string | undefined {
  if (fx === 'shadow') return 'drop-shadow(3px 3px 5px rgba(0, 0, 0, 0.4))';
  if (fx === 'shadowBig') return 'drop-shadow(6px 6px 16px rgba(0, 0, 0, 0.35))';
  if (fx === 'glow') return `drop-shadow(0 0 6px ${rgba(glow, 0.75)}) drop-shadow(0 0 4px ${rgba(glow, 0.75)})`;
  if (fx === 'bevel') return `url(#${BEVEL_FILTER})`;
  return undefined;
}

/** Marginile estompate: o mască ce se stinge spre margini pe 14 px (cât 10 pt), pe orizontală și pe verticală. */
export function fxMask(fx: ShapeFx | undefined): Record<string, string> | undefined {
  // Reflexia: o copie sub obiect, lipită de el, care se stinge pe jumătatea de sus a ei.
  if (fx === 'reflect') return { WebkitBoxReflect: 'below 2px linear-gradient(transparent 55%, rgba(255, 255, 255, 0.45))' };
  if (fx !== 'soft') return undefined;
  const g = (d: string) => `linear-gradient(${d}, transparent, #000 14px, #000 calc(100% - 14px), transparent)`;
  const m = `${g('to right')}, ${g('to bottom')}`;
  return { maskImage: m, WebkitMaskImage: m, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' };
}

/** a:effectLst pentru .pptx (EMU: 12700 pe punct; dir 2700000 = 45°, în jos-dreapta). */
export function fxXml(fx: ShapeFx | undefined, glow: string): string {
  const shdw = (blur: number, dist: number, alpha: number) =>
    `<a:effectLst><a:outerShdw blurRad="${blur}" dist="${dist}" dir="2700000" algn="tl" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="${alpha}"/></a:srgbClr></a:outerShdw></a:effectLst>`;
  if (fx === 'shadow') return shdw(50800, 38100, 40000);
  if (fx === 'shadowBig') return shdw(152400, 76200, 35000);
  if (fx === 'soft') return '<a:effectLst><a:softEdge rad="127000"/></a:effectLst>';
  // Reflexia strânsă, lipită de obiect (cum o scriu programele de prezentări pentru „reflexie apropiată”).
  if (fx === 'reflect') return '<a:effectLst><a:reflection blurRad="6350" stA="50000" endA="300" endPos="55000" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/></a:effectLst>';
  // Teșirea: scena 3D obișnuită (din față, trei lumini) și marginea de sus teșită cu 5 pt × 2 pt.
  if (fx === 'bevel') return '<a:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></a:scene3d><a:sp3d><a:bevelT w="63500" h="25400"/></a:sp3d>';
  if (fx === 'glow') return `<a:effectLst><a:glow rad="101600"><a:srgbClr val="${glow.replace('#', '').toUpperCase()}"><a:alpha val="60000"/></a:srgbClr></a:glow></a:effectLst>`;
  return '';
}

/** Efectul dintr-un a:effectLst citit din .pptx (umbra exterioară sau strălucirea; restul nu încă). */
export function fxOfEffects(effectLst: Element | null | undefined): ShapeFx | undefined {
  if (!effectLst) return undefined;
  const kids = [...effectLst.getElementsByTagName('*')].filter((e) => e.parentNode === effectLst);
  const sh = kids.find((e) => e.localName === 'outerShdw');
  if (sh) return +(sh.getAttribute('blurRad') ?? 0) >= 101600 ? 'shadowBig' : 'shadow';
  if (kids.some((e) => e.localName === 'glow')) return 'glow';
  if (kids.some((e) => e.localName === 'softEdge')) return 'soft';
  if (kids.some((e) => e.localName === 'reflection')) return 'reflect';
  return undefined;
}

/**
 * Rotirea 3-D a formelor și pozelor (presetările camerei din .pptx: a:scene3d → a:camera prst).
 * Pe ecran e o transformare CSS (perspectivă + rotire pe X / Y; izometricele fără perspectivă).
 */
export type Rot3d = 'perspectiveLeft' | 'perspectiveRight' | 'perspectiveAbove' | 'perspectiveBelow' | 'perspectiveRelaxed' | 'isometricLeftDown' | 'isometricRightUp' | 'isometricTopUp';
export const ROT3D: [Rot3d | '', string][] = [
  ['', '⬚ Fără rotire 3-D'],
  ['perspectiveLeft', '⧉ Perspectivă: stânga'],
  ['perspectiveRight', '⧉ Perspectivă: dreapta'],
  ['perspectiveAbove', '⧉ Perspectivă: sus'],
  ['perspectiveBelow', '⧉ Perspectivă: jos'],
  ['perspectiveRelaxed', '⧉ Perspectivă: culcată'],
  ['isometricLeftDown', '◇ Izometric: stânga'],
  ['isometricRightUp', '◇ Izometric: dreapta'],
  ['isometricTopUp', '◇ Izometric: sus'],
];
export const cleanRot3d = (v: unknown): Rot3d | undefined => (ROT3D.some(([k]) => k && k === v) ? (v as Rot3d) : undefined);

const ROT3D_CSS: Record<Rot3d, string> = {
  perspectiveLeft: 'perspective(900px) rotateY(24deg)',
  perspectiveRight: 'perspective(900px) rotateY(-24deg)',
  perspectiveAbove: 'perspective(900px) rotateX(24deg)',
  perspectiveBelow: 'perspective(900px) rotateX(-24deg)',
  perspectiveRelaxed: 'perspective(900px) rotateX(48deg)',
  isometricLeftDown: 'skewY(30deg) scaleX(0.866)',
  isometricRightUp: 'skewY(-30deg) scaleX(0.866)',
  isometricTopUp: 'rotateX(54.74deg) rotateZ(45deg)',
};
/** Transformarea CSS pentru rotirea 3-D, pusă înaintea rotirii obișnuite (perspectiva trebuie să fie prima). */
export const rot3dCss = (r: Rot3d | undefined): string | undefined => (r ? ROT3D_CSS[r] : undefined);

/** Rotirea 3-D din spPr (a:scene3d / a:camera prst); presetările necunoscute se apropie după nume. */
export function rot3dOfSpPr(spPr: Element | null | undefined): Rot3d | undefined {
  if (!spPr) return undefined;
  const scene = [...spPr.getElementsByTagName('*')].find((e) => e.parentNode === spPr && e.localName === 'scene3d');
  const p = scene && [...scene.getElementsByTagName('*')].find((e) => e.localName === 'camera')?.getAttribute('prst');
  if (!p || /^(orthographicFront|legacyObliqueFront|legacyPerspectiveFront)$/.test(p)) return undefined;
  const own = cleanRot3d(p);
  if (own) return own;
  if (/^isometric/.test(p)) return /Left/.test(p) ? 'isometricLeftDown' : /Right/.test(p) ? 'isometricRightUp' : 'isometricTopUp';
  if (/Relaxed/.test(p)) return 'perspectiveRelaxed';
  if (/Left/.test(p)) return 'perspectiveLeft';
  if (/Right/.test(p)) return 'perspectiveRight';
  if (/Above|Top/.test(p)) return 'perspectiveAbove';
  if (/Below|Bottom/.test(p)) return 'perspectiveBelow';
  return undefined;
}

/** Efectul și rotirea 3-D pentru spPr-ul din .pptx, în ordinea cerută: a:effectLst, a:scene3d, a:sp3d. */
export function fx3dXml(fx: ShapeFx | undefined, rot3d: Rot3d | undefined, glow: string): string {
  if (!rot3d) return fxXml(fx, glow);
  const eff = fx && fx !== 'bevel' ? fxXml(fx, glow) : '';
  return eff + `<a:scene3d><a:camera prst="${rot3d}"/><a:lightRig rig="threePt" dir="t"/></a:scene3d>`
    + (fx === 'bevel' ? '<a:sp3d><a:bevelT w="63500" h="25400"/></a:sp3d>' : '');
}

/** Efectul din spPr: cel din a:effectLst, altfel teșirea (a:sp3d cu a:bevelT / a:bevelB). */
export function fxOfSpPr(spPr: Element | null | undefined): ShapeFx | undefined {
  if (!spPr) return undefined;
  const kids = [...spPr.getElementsByTagName('*')].filter((e) => e.parentNode === spPr);
  const fx = fxOfEffects(kids.find((e) => e.localName === 'effectLst'));
  if (fx) return fx;
  const sp3d = kids.find((e) => e.localName === 'sp3d');
  return sp3d && [...sp3d.getElementsByTagName('*')].some((e) => e.localName === 'bevelT' || e.localName === 'bevelB') ? 'bevel' : undefined;
}

/** Stilurile rapide ale formelor (Shape Styles): umplere, contur și efect dintr-un singur clic, în culoarea temei. */
export interface QuickLook { fill: string; line?: string; lineW?: number; fx?: ShapeFx }
const tint = (c: string, k: number) => {
  const n = parseInt(c.replace('#', '').slice(0, 6), 16) || 0;
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k + 255 * (1 - k)).toString(16).padStart(2, '0')).join('');
};
export const QUICK_STYLES: [string, (accent: string) => QuickLook][] = [
  ['Plin', () => ({ fill: 'accent' })],
  ['Plin cu contur închis', () => ({ fill: 'accent', line: '#111827', lineW: 2 })],
  ['Doar contur colorat', (a) => ({ fill: '#ffffff', line: a, lineW: 3 })],
  ['Deschis cu contur', (a) => ({ fill: tint(a, 0.2), line: a, lineW: 2 })],
  ['Plin cu umbră', () => ({ fill: 'accent', fx: 'shadow' })],
  ['Intens (contur alb, umbră mare)', () => ({ fill: 'accent', line: '#ffffff', lineW: 3, fx: 'shadowBig' })],
  ['Strălucitor', (a) => ({ fill: tint(a, 0.35), fx: 'glow' })],
  ['Închis cu umbră', () => ({ fill: '#111827', fx: 'shadow' })],
];
/** Coloanele galeriei Stiluri rapide: culoarea temei ('accent'), apoi alte 5 culori. */
export const QUICK_COLORS: [string, string][] = [['accent', 'Culoarea temei'], ['#1f2937', 'Gri închis'], ['#dc2626', 'Roșu'], ['#16a34a', 'Verde'], ['#7c3aed', 'Violet'], ['#0891b2', 'Turcoaz']];
/** Stilul rapid în culoarea aleasă: umplerea „culoarea temei” devine culoarea coloanei. */
export function quickLook(i: number, color: string, accent: string): QuickLook | null {
  const st = QUICK_STYLES[i];
  if (!st) return null;
  const c = color === 'accent' ? accent : color;
  const q = st[1](c);
  return { ...q, fill: q.fill === 'accent' ? color : q.fill };
}
/** Miniatura din galerie (CSS): umplerea, conturul și efectul stilului. */
export function quickThumbCss(q: QuickLook, accent: string): Record<string, string> {
  const fill = q.fill === 'accent' ? accent : q.fill;
  const sh = q.fx === 'shadow' ? '2px 2px 3px rgba(0, 0, 0, 0.45)' : q.fx === 'shadowBig' ? '3px 4px 7px rgba(0, 0, 0, 0.5)' : q.fx === 'glow' ? `0 0 6px ${rgba(fill, 0.85)}` : '';
  return { background: fill, border: q.line ? `${Math.min(3, q.lineW ?? 2)}px solid ${q.line === 'accent' ? accent : q.line}` : '1px solid transparent', ...(sh ? { boxShadow: sh } : {}) };
}

// Stilurile pozei (galeria Picture Styles): rame, colțuri rotunjite, cerc, umbre, fotografie înclinată. Fiecare stil e o
// combinație de chenar, efect, formă de decupare și (la unul) rotire, deci se păstrează și în .pptx prin ce avem deja.
export interface PicLook { line?: string; lineW?: number; fx?: ShapeFx; clip?: 'ellipse' | 'roundRect'; rot?: number; rot3d?: Rot3d }
export const PIC_STYLES: [string, (accent: string) => PicLook][] = [
  ['Simplu (fără ramă)', () => ({})],
  ['Ramă albă cu umbră', () => ({ line: '#ffffff', lineW: 10, fx: 'shadow' })],
  ['Ramă neagră', () => ({ line: '#111111', lineW: 8 })],
  ['Ramă subțire gri', () => ({ line: '#9ca3af', lineW: 2 })],
  ['Ramă în culoarea temei', (a) => ({ line: a, lineW: 5 })],
  ['Colțuri rotunjite cu umbră', () => ({ clip: 'roundRect', fx: 'shadow' })],
  ['Cerc cu ramă albă', () => ({ clip: 'ellipse', line: '#ffffff', lineW: 6, fx: 'shadow' })],
  ['Oval cu umbră mare', () => ({ clip: 'ellipse', fx: 'shadowBig' })],
  ['Margini estompate', () => ({ fx: 'soft' })],
  ['Umbră mare', () => ({ fx: 'shadowBig' })],
  ['Strălucire', () => ({ fx: 'glow' })],
  ['Fotografie înclinată', () => ({ line: '#ffffff', lineW: 12, fx: 'shadowBig', rot: 356 })],
  ['Reflexie', () => ({ fx: 'reflect' })],
  ['Reflexie cu colțuri rotunjite', () => ({ clip: 'roundRect', fx: 'reflect' })],
  ['Perspectivă stânga cu umbră', () => ({ line: '#ffffff', lineW: 6, fx: 'shadowBig', rot3d: 'perspectiveLeft' })],
  ['Perspectivă dreapta cu umbră', () => ({ line: '#ffffff', lineW: 6, fx: 'shadowBig', rot3d: 'perspectiveRight' })],
  ['Culcată pe masă', () => ({ line: '#ffffff', lineW: 8, fx: 'shadow', rot3d: 'perspectiveRelaxed' })],
];

/** Poza cu stilul ales: scoate rama, efectul, forma și rotirea 3-D de dinainte (rotirea rămâne, în afară de stilul înclinat). */
export function applyPicStyle<T extends { line?: string; lineW?: number; lineDash?: unknown; fx?: ShapeFx; clip?: unknown; rot?: number; rot3d?: Rot3d }>(el: T, i: number, accent: string): T {
  const look = PIC_STYLES[i]?.[1](accent);
  if (!look) return el;
  const { line: _l, lineW: _w, lineDash: _d, fx: _f, clip: _c, rot3d: _r, ...rest } = el;
  const out = { ...rest } as T;
  if (look.line) { out.line = look.line; out.lineW = look.lineW ?? 2; }
  if (look.fx) out.fx = look.fx;
  if (look.clip) (out as { clip?: unknown }).clip = look.clip;
  if (look.rot !== undefined) out.rot = look.rot;
  if (look.rot3d) out.rot3d = look.rot3d;
  return out;
}

/** Ce stil din galerie are poza acum (-1 = niciunul, ales de mână). */
export function picStyleOf(el: { line?: string; lineW?: number; lineDash?: unknown; fx?: ShapeFx; clip?: unknown; rot?: number; rot3d?: Rot3d }, accent: string): number {
  return PIC_STYLES.findIndex(([, f]) => {
    const l = f(accent);
    return (l.line ?? '') === (el.line ?? '') && (l.line ? (l.lineW ?? 2) === (el.lineW ?? 2) && !el.lineDash : true) && (l.fx ?? '') === (el.fx ?? '')
      && (l.clip ?? '') === (el.clip ?? '') && (l.rot3d ?? '') === (el.rot3d ?? '') && (l.rot === undefined || l.rot === el.rot);
  });
}

// Efectele textului (Text Effects): umbră, strălucire, conturul literelor și reflexia. Pe ecran sunt text-shadow / -webkit-text-stroke,
// iar reflexia e -webkit-box-reflect pe textul casetei (slides.css, data-tfx); în .pptx sunt în a:rPr (a:effectLst cu a:outerShdw /
// a:glow / a:reflection și a:ln).
export type TextFx = 'shadow' | 'glow' | 'outline' | 'reflect';
export const TEXT_FX: [TextFx | '', string][] = [['', 'A Text simplu'], ['shadow', 'A Text cu umbră'], ['glow', 'A Text strălucitor'], ['outline', 'A Litere conturate'], ['reflect', 'A Text cu reflexie']];
export const cleanTextFx = (v: unknown): TextFx | undefined => (TEXT_FX.some(([k]) => k && k === v) ? (v as TextFx) : undefined);

export function textFxCss(fx: TextFx | undefined, accent: string): Record<string, string> | undefined {
  if (fx === 'shadow') return { textShadow: '2px 2px 3px rgba(0, 0, 0, 0.45)' };
  if (fx === 'glow') return { textShadow: `0 0 6px ${rgba(accent, 0.8)}, 0 0 12px ${rgba(accent, 0.6)}` };
  if (fx === 'outline') return { WebkitTextStroke: `1px ${accent}`, paintOrder: 'stroke fill' };
  // Reflexia: pe caseta din galeria WordArt (fără .sl-text), direct pe element.
  if (fx === 'reflect') return { WebkitBoxReflect: 'below -0.15em linear-gradient(transparent 45%, rgba(255, 255, 255, 0.45))' };
  return undefined;
}

/** Strălucirea de text cu culoarea asta e de fapt umbra (biblioteca de export nu scrie umbră pe text); vezi shadowFromMarker. */
const SHADOW_MARK = 'FE0D01';
/** La fel pentru reflexie (biblioteca nu scrie nici reflexie pe text). */
const REFLECT_MARK = 'FE0D02';
/** Opțiunile de export (pptxgenjs) pentru efectul textului. */
export function textFxOpts(fx: TextFx | undefined, accent: string): Record<string, unknown> {
  const c = accent.replace('#', '').toUpperCase();
  if (fx === 'glow') return { glow: { size: 8, opacity: 0.6, color: c } };
  if (fx === 'outline') return { outline: { size: 1, color: c } };
  if (fx === 'shadow') return { glow: { size: 1, opacity: 0.45, color: SHADOW_MARK } };
  if (fx === 'reflect') return { glow: { size: 1, opacity: 0.5, color: REFLECT_MARK } };
  return {};
}
/** Înlocuiește strălucirile-semn cu umbra și reflexia adevărate în XML-ul slide-ului. */
export const shadowFromMarker = (xml: string) => xml.replace(new RegExp(`<a:glow rad="[0-9]+"><a:srgbClr val="${REFLECT_MARK}"><a:alpha val="[0-9]+"/></a:srgbClr></a:glow>`, 'g'),
  '<a:reflection blurRad="6350" stA="55000" endA="300" endPos="45500" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/>').replace(new RegExp(`<a:glow rad="[0-9]+"><a:srgbClr val="${SHADOW_MARK}"><a:alpha val="([0-9]+)"/></a:srgbClr></a:glow>`, 'g'),
  '<a:outerShdw blurRad="38100" dist="25400" dir="2700000" algn="tl" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="$1"/></a:srgbClr></a:outerShdw>');

// Umplerea literelor cu gradient (Text Fill → Gradient): două culori, de sus în jos. Pe ecran e fundalul .sl-text decupat după
// litere (slides.css, data-tgrad); în .pptx e a:gradFill în a:rPr, în locul culorii (textGradXml).
export type TextGrad = [string, string];
export const TEXT_GRADS: [string, TextGrad][] = [
  ['Apus', ['#f97316', '#db2777']], ['Ocean', ['#06b6d4', '#1e3a8a']], ['Aur', ['#facc15', '#b45309']],
  ['Pădure', ['#84cc16', '#166534']], ['Ametist', ['#c084fc', '#5b21b6']], ['Argint', ['#d1d5db', '#374151']], ['Foc', ['#fde047', '#dc2626']],
];
const HEX6 = /^#[0-9a-f]{6}$/i;
export const cleanTextGrad = (v: unknown): TextGrad | undefined =>
  Array.isArray(v) && v.length === 2 && v.every((c) => typeof c === 'string' && HEX6.test(c)) ? [v[0].toLowerCase(), v[1].toLowerCase()] : undefined;
/** Numele presetării cu culorile astea (-1 = din fișier). */
export const textGradIndex = (g: TextGrad | undefined) => (g ? TEXT_GRADS.findIndex(([, [a, b]]) => a === g[0] && b === g[1]) : -1);
export const textGradCss = (g: TextGrad) => `linear-gradient(180deg, ${g[0]}, ${g[1]})`;
const gradFillXml = (g: TextGrad) => `<a:gradFill flip="none" rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${g[0].slice(1).toUpperCase()}"/></a:gs>`
  + `<a:gs pos="100000"><a:srgbClr val="${g[1].slice(1).toUpperCase()}"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill>`;
/** În XML-ul unei forme (p:sp), culoarea fiecărui a:rPr devine gradientul (conturul literelor, a:ln, rămâne cum e). */
export const textGradXml = (sp: string, g: TextGrad) => sp.replace(/(<a:rPr\b[^>]*>)([\s\S]*?)(<\/a:rPr>)/g, (_m, open: string, body: string, close: string) => {
  const ln = body.indexOf('</a:ln>');
  const from = ln < 0 ? 0 : ln + '</a:ln>'.length;
  const rest = body.slice(from).replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/, gradFillXml(g));
  return open + body.slice(0, from) + rest + close;
});
/** Gradientul literelor dintr-un a:rPr citit din .pptx: prima și ultima culoare din a:gsLst. */
export function textGradOf(rPr: Element | null | undefined, colorOf: (fill: Element | null) => string | undefined): TextGrad | undefined {
  const grad = rPr ? [...rPr.getElementsByTagName('*')].find((e) => e.parentNode === rPr && e.localName === 'gradFill') : undefined;
  const stops = grad ? [...grad.getElementsByTagName('*')].filter((e) => e.localName === 'gs').sort((a, b) => +(a.getAttribute('pos') ?? 0) - +(b.getAttribute('pos') ?? 0)) : [];
  if (stops.length < 2) return undefined;
  return cleanTextGrad([colorOf(stops[0]), colorOf(stops[stops.length - 1])]);
}

/** Efectul textului dintr-un a:rPr citit din .pptx. */
export function textFxOf(rPr: Element | null | undefined): TextFx | undefined {
  if (!rPr) return undefined;
  const kids = [...rPr.getElementsByTagName('*')].filter((e) => e.parentNode === rPr);
  const eff = kids.find((e) => e.localName === 'effectLst');
  const effKids = eff ? [...eff.getElementsByTagName('*')].filter((e) => e.parentNode === eff) : [];
  if (effKids.some((e) => e.localName === 'outerShdw')) return 'shadow';
  if (effKids.some((e) => e.localName === 'glow')) return 'glow';
  if (effKids.some((e) => e.localName === 'reflection')) return 'reflect';
  const ln = kids.find((e) => e.localName === 'ln');
  if (ln && [...ln.getElementsByTagName('*')].some((e) => e.localName === 'solidFill')) return 'outline';
  return undefined;
}
