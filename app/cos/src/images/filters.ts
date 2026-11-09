// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Imagini → 🌀 Filtre: filtrele care se uită la pixelii vecini (meniul Filter din Photoshop):
// estompări (Gaussian, cutie, mișcare, radială), zgomot (adaugă, median, praf și zgârieturi, scoate punctele),
// claritate (mască de claritate, trece-sus), stilizare (relief, margini, solarizare, mozaic, medie),
// pixelare (cristalizare, puantilism, semitonuri, mezzotintă), randare (nori, ramă), pictură în ulei, vânt, plăci,
// deformări (ciupire, vârtej, sferă, unduire, coordonate polare, înclinare, deplasare după hartă), maxim / minim și decalaj. Totul pe pixelii RGBA, fără biblioteci.

import { guessShakeAngle, shakeReduce } from './shake';
import { drawFlames, drawTree, FLAME_COLORS, FLAME_TYPES, TREE_TYPES } from './renderFx';
import { basRelief, chalkCharcoal, halftonePattern, HALFTONE_TYPES, LIGHT_DIRS, photocopy, SKETCH_INKS, stamp, tornEdges } from './sketchFx';
import { craquelure, grain, GRAIN_TYPES, mosaicTiles, patchwork, stainedGlass } from './textureFx';
import { coloredPencil, dryBrush, NEON_COLORS, neonGlow, paletteKnife, posterEdges, sponge } from './artisticFx';
import { angledStrokes, chrome, fresco, graphicPen, PEN_DIRS, plaster, roughPastels, sumie } from './galleryFx';

export type FilterId =
  | 'gauss' | 'box' | 'motion' | 'radial'
  | 'noise' | 'median' | 'dust' | 'despeckle'
  | 'unsharp' | 'highpass'
  | 'emboss' | 'edges' | 'solarize' | 'mosaic' | 'average'
  | 'pinch' | 'twirl' | 'spherize' | 'ripple'
  | 'max' | 'min' | 'offset'
  | 'surface' | 'smart' | 'tiltshift' | 'sharpedges'
  | 'oil' | 'wind' | 'diffuse' | 'tiles' | 'trace'
  | 'crystallize' | 'pointillize' | 'halftone' | 'mezzotint' | 'fragment'
  | 'clouds' | 'diffclouds' | 'polar' | 'shear'
  | 'lensblur' | 'iris' | 'reducenoise' | 'zigzag' | 'lenscorr' | 'wideangle'
  | 'lighting' | 'flare' | 'deinterlace' | 'ntsc' | 'hsb'
  | 'smartsharpen' | 'facet' | 'fibers' | 'spinblur' | 'pathblur' | 'custom'
  | 'sketch' | 'cutout' | 'watercolor' | 'canvas'
  | 'fieldblur' | 'extrude' | 'spatter' | 'crosshatch' | 'accented' | 'shapeblur' | 'hdr' | 'displace' | 'frame' | 'shake' | 'tree' | 'flame'
  | 'basrelief' | 'chalk' | 'photocopy' | 'stamp' | 'torn' | 'htpattern'
  | 'craquelure' | 'grain' | 'mosaictiles' | 'patchwork' | 'stainedglass'
  | 'posteredges' | 'drybrush' | 'paletteknife' | 'sponge' | 'colpencil' | 'neon'
  | 'fresco' | 'pastels' | 'chrome' | 'graphicpen' | 'plaster' | 'sumie' | 'angled';

export interface FilterParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  def: number;
  /** Valoare în pixeli: la previzualizarea pe poza micșorată se micșorează și ea. */
  px?: boolean;
  unit?: string;
  /** Bifă (0 = nu, 1 = da), nu glisor. */
  bool?: boolean;
  /** Listă de alegeri (valoarea = poziția în listă), nu glisor. */
  options?: string[];
}

/** Ramele filtrului Ramă și culorile pentru rama simplă / dublă / paspartu. */
export const FRAME_STYLES = ['Simplă', 'Dublă', 'Lemn', 'Aurie', 'Paspartu', 'Margine albă estompată'];
export const FRAME_COLORS: [string, [number, number, number]][] = [['Alb', [255, 255, 255]], ['Negru', [24, 24, 24]], ['Gri', [128, 128, 128]], ['Maro', [101, 67, 33]], ['Bleumarin', [20, 40, 90]], ['Roșu închis', [120, 20, 30]]];

export interface FilterDef { id: FilterId; label: string; group: string; hint: string; params: FilterParam[] }

const R = (def: number, max = 100, label = 'Rază'): FilterParam => ({ key: 'r', label, min: 1, max, def, px: true, unit: 'px' });

/** Formele pentru Estompare cu formă: (u, v) între -1 și 1, cu y în jos. */
export const SHAPES: [string, (u: number, v: number) => boolean][] = [
  ['Cerc', (u, v) => u * u + v * v <= 1],
  ['Inel', (u, v) => { const d = u * u + v * v; return d <= 1 && d >= 0.36; }],
  ['Pătrat', (u, v) => Math.abs(u) <= 1 && Math.abs(v) <= 1],
  ['Romb', (u, v) => Math.abs(u) + Math.abs(v) <= 1],
  ['Stea', (u, v) => {
    // Stea cu 5 colțuri: raza permisă variază între 0,4 și 1 după unghi.
    const d = Math.hypot(u, v);
    if (d > 1) return false;
    const a = ((Math.atan2(u, -v) % (2 * Math.PI / 5)) + 2 * Math.PI / 5) % (2 * Math.PI / 5), t = Math.abs(a - Math.PI / 5) / (Math.PI / 5);
    return d <= 0.4 + 0.6 * t * t;
  }],
  ['Inimă', (u, v) => { const x = u * 1.15, y = -v * 1.15 + 0.15; const q = x * x + y * y - 1; return q * q * q - x * x * y * y * y <= 0; }],
  ['Linie orizontală', (_u, v) => Math.abs(v) <= 0.12],
  ['Cruce', (u, v) => Math.abs(u) <= 0.2 || Math.abs(v) <= 0.2],
];

/** Forma ca bucăți de rânduri [dy, de la dx, până la dx], pentru sume pe rânduri. */
export function shapeKernel(shape: number, r: number): [number, number, number][] {
  const fn = (SHAPES[shape] ?? SHAPES[0])[1], segs: [number, number, number][] = [];
  for (let dy = -r; dy <= r; dy++) {
    let start = -1e9;
    for (let dx = -r; dx <= r + 1; dx++) {
      const inside = dx <= r && fn(dx / Math.max(0.5, r), dy / Math.max(0.5, r));
      if (inside && start === -1e9) start = dx;
      if (!inside && start !== -1e9) { segs.push([dy, start, dx - 1]); start = -1e9; }
    }
  }
  if (!segs.length) segs.push([0, 0, 0]);
  return segs;
}

/** Punctele filtrelor care se pot trage pe poză (cheile parametrilor în procente, x și / sau y). */
export const FILTER_PINS: Partial<Record<FilterId, { x?: string; y?: string }[]>> = {
  iris: [{ x: 'x', y: 'y' }],
  tiltshift: [{ x: 'cx', y: 'c' }],
  spinblur: [{ x: 'x', y: 'y' }],
  fieldblur: [{ x: 'x1', y: 'y1' }, { x: 'x2', y: 'y2' }],
  pathblur: [{ x: 'x0', y: 'y0' }, { x: 'cx', y: 'cy' }, { x: 'x1', y: 'y1' }],
  lighting: [{ x: 'x', y: 'y' }, { x: 'x2', y: 'y2' }],
  flare: [{ x: 'x', y: 'y' }],
  tree: [{ x: 'x', y: 'y' }],
  flame: [{ x: 'x', y: 'y' }],
};

export const FILTERS: FilterDef[] = [
  { id: 'gauss', group: 'Estompare', label: 'Estompare Gaussiană', hint: 'Încețoșează lin toată poza (Gaussian Blur)', params: [{ ...R(4), step: 0.5, min: 0.5 }] },
  { id: 'box', group: 'Estompare', label: 'Estompare în cutie', hint: 'Media pixelilor dintr-un pătrat (Box Blur)', params: [R(5)] },
  { id: 'motion', group: 'Estompare', label: 'Estompare de mișcare', hint: 'Ca o poză făcută din mers (Motion Blur)', params: [{ key: 'a', label: 'Unghi', min: -180, max: 180, def: 0, unit: '°' }, R(20, 200, 'Distanță')] },
  { id: 'radial', group: 'Estompare', label: 'Estompare radială', hint: 'Dungi spre centru, ca la un zoom rapid, sau în cerc, ca o roată care se învârte (Radial Blur: Zoom / Spin)', params: [{ key: 'v', label: 'Cât de tare', min: 1, max: 100, def: 20 }, { key: 'spin', label: 'Rotire (în cerc)', min: 0, max: 1, def: 0, bool: true }] },
  { id: 'surface', group: 'Estompare', label: 'Estompare de suprafață', hint: 'Netezește pielea și zonele plate, dar păstrează marginile (Surface Blur)', params: [R(5, 20), { key: 't', label: 'Prag', min: 2, max: 255, def: 15 }] },
  { id: 'smart', group: 'Estompare', label: 'Estompare inteligentă', hint: 'Estompează doar pixelii care seamănă între ei (Smart Blur). Modul „Doar margini” arată marginile albe pe negru, „Suprapunere margini” le pune albe peste poza estompată', params: [R(3, 20), { key: 't', label: 'Prag', min: 1, max: 100, def: 25 }, { key: 'm', label: 'Mod', min: 0, max: 2, def: 0, options: ['Normal', 'Doar margini', 'Suprapunere margini'] }] },
  { id: 'tiltshift', group: 'Estompare', label: 'Tilt-Shift (machetă)', hint: 'O bandă clară, restul estompat: orașul pare o machetă (Tilt-Shift)', params: [{ key: 'c', label: 'Banda clară: mijlocul', min: 0, max: 100, def: 50, unit: '%' }, { key: 'b', label: 'Banda clară: lățimea', min: 0, max: 100, def: 20, unit: '%' }, { key: 'f', label: 'Trecerea', min: 1, max: 100, def: 25, unit: '%' }, R(8, 50, 'Estompare'), { key: 'a', label: 'Unghiul benzii', min: -90, max: 90, def: 0, unit: '°' }, { key: 'cx', label: 'Banda clară: punctul pe orizontală', min: 0, max: 100, def: 50, unit: '%' }] },
  { id: 'noise', group: 'Zgomot', label: 'Adaugă zgomot', hint: 'Puncte mărunte, ca granulația unui film (Add Noise)', params: [{ key: 'v', label: 'Cantitate', min: 1, max: 100, def: 12, unit: '%' }, { key: 'mono', label: 'Monocromatic (gri)', min: 0, max: 1, def: 0, bool: true }] },
  { id: 'median', group: 'Zgomot', label: 'Median', hint: 'Scoate zgomotul păstrând marginile: fiecare pixel ia valoarea din mijloc a vecinilor (Median)', params: [R(2, 10)] },
  { id: 'dust', group: 'Zgomot', label: 'Praf și zgârieturi', hint: 'Șterge firele de praf și zgârieturile mici de pe scanări (Dust & Scratches)', params: [R(2, 10), { key: 't', label: 'Prag', min: 0, max: 255, def: 20 }] },
  { id: 'despeckle', group: 'Zgomot', label: 'Scoate punctele', hint: 'Netezește zonele plate, nu și marginile (Despeckle)', params: [] },
  { id: 'unsharp', group: 'Claritate', label: 'Mască de claritate', hint: 'Claritate cu rază și prag, ca la tipografie (Unsharp Mask)', params: [{ key: 'v', label: 'Cantitate', min: 1, max: 500, def: 80, unit: '%' }, { ...R(1.5, 50), step: 0.5, min: 0.5 }, { key: 't', label: 'Prag', min: 0, max: 255, def: 0 }] },
  { id: 'smartsharpen', group: 'Claritate', label: 'Claritate inteligentă', hint: 'Claritate doar pe luminozitate (fără margini colorate), cu zgomotul lăsat deoparte și fără contururi albe în jurul marginilor (Smart Sharpen)', params: [{ key: 'v', label: 'Cantitate', min: 1, max: 500, def: 150, unit: '%' }, { ...R(1, 64), step: 0.5, min: 0.5 }, { key: 'n', label: 'Reducere zgomot', min: 0, max: 100, def: 10, unit: '%' }, { key: 'halo', label: 'Limita contururilor', min: 5, max: 255, def: 40 }] },
  { id: 'shake', group: 'Claritate', label: 'Reducerea tremuratului', hint: 'Reface pozele mișcate când ai fotografiat cu mâna tremurândă: alegi unghiul și lungimea mișcării (sau lași unghiul ghicit din poză), iar urma se strânge la loc (Shake Reduction)', params: [{ key: 'auto', label: 'Unghiul ghicit din poză', min: 0, max: 1, def: 1, bool: true }, { key: 'a', label: 'Unghi', min: -90, max: 90, def: 0, unit: '°' }, R(8, 60, 'Lungimea mișcării'), { key: 'n', label: 'Tărie', min: 1, max: 30, def: 10 }] },
  { id: 'highpass', group: 'Claritate', label: 'Trece-sus', hint: 'Lasă doar marginile, pe gri (High Pass)', params: [{ ...R(10, 100), step: 0.5, min: 0.5 }] },
  { id: 'emboss', group: 'Stilizare', label: 'Relief', hint: 'Poza pare ștanțată în metal (Emboss)', params: [{ key: 'a', label: 'Unghi', min: -180, max: 180, def: 135, unit: '°' }, R(3, 10, 'Înălțime'), { key: 'v', label: 'Cantitate', min: 1, max: 500, def: 100, unit: '%' }] },
  { id: 'edges', group: 'Stilizare', label: 'Găsește marginile', hint: 'Marginile închise pe alb, ca un desen în creion (Find Edges)', params: [] },
  { id: 'solarize', group: 'Stilizare', label: 'Solarizare', hint: 'Luminile se întorc în negativ, ca o peliculă supraexpusă (Solarize)', params: [] },
  { id: 'mosaic', group: 'Pixelare', label: 'Mozaic', hint: 'Pătrate mari de culoare (Mosaic)', params: [R(12, 200, 'Mărimea pătratului')] },
  { id: 'average', group: 'Stilizare', label: 'Medie', hint: 'Toată poza (sau selecția) ia culoarea ei medie (Average)', params: [] },
  { id: 'pinch', group: 'Deformare', label: 'Ciupire', hint: 'Strânge mijlocul spre centru sau îl umflă (Pinch)', params: [{ key: 'v', label: 'Cât de tare', min: -100, max: 100, def: 50, unit: '%' }] },
  { id: 'twirl', group: 'Deformare', label: 'Vârtej', hint: 'Răsucește mijlocul pozei (Twirl)', params: [{ key: 'a', label: 'Unghi', min: -999, max: 999, def: 180, unit: '°' }] },
  { id: 'spherize', group: 'Deformare', label: 'Sferă', hint: 'Ca prin lupă sau pe o bilă (Spherize)', params: [{ key: 'v', label: 'Cât de tare', min: -100, max: 100, def: 60, unit: '%' }] },
  { id: 'ripple', group: 'Deformare', label: 'Unduire', hint: 'Valuri, ca reflexia în apă (Ripple / Wave): undă sinus, triunghi sau pătrat; mai mulți generatori amestecă valuri de lungimi diferite', params: [R(8, 100, 'Înălțimea valului'), { ...R(60, 400, 'Lungimea valului'), key: 'l', min: 4 }, { key: 'tp', label: 'Tipul valului', min: 0, max: 2, def: 0, options: ['Sinus', 'Triunghi', 'Pătrat'] }, { key: 'g', label: 'Generatori', min: 1, max: 5, def: 1 }] },
  { id: 'displace', group: 'Deformare', label: 'Deplasare', hint: 'Mută fiecare pixel după o hartă de gri (Displace): roșul hărții împinge pe orizontală, verdele pe verticală; griul mijlociu nu mută nimic. Hartă: poza însăși, nori, valuri, țesătură sau o poză aleasă din calculator', params: [{ key: 'map', label: 'Harta', min: 0, max: 4, def: 1, options: ['Poza însăși', 'Nori', 'Valuri', 'Țesătură', 'Din fișier'] }, { key: 'sx', label: 'Pe orizontală', min: -200, max: 200, def: 20, px: true, unit: 'px' }, { key: 'sy', label: 'Pe verticală', min: -200, max: 200, def: 20, px: true, unit: 'px' }, { ...R(40, 400, 'Mărimea hărții'), min: 2 }] },
  { id: 'max', group: 'Altele', label: 'Maxim', hint: 'Zonele luminoase cresc (Maximum)', params: [R(2, 20)] },
  { id: 'min', group: 'Altele', label: 'Minim', hint: 'Zonele întunecate cresc, liniile se îngroașă (Minimum)', params: [R(2, 20)] },
  { id: 'sharpedges', group: 'Claritate', label: 'Clarifică marginile', hint: 'Clarifică doar marginile, nu și zgomotul din zonele plate (Sharpen Edges)', params: [] },
  { id: 'oil', group: 'Stilizare', label: 'Pictură în ulei', hint: 'Pete de culoare ca tușele unui pensul, cu relieful vopselei luminat dintr-o parte (Oil Paint)', params: [R(3, 6, 'Pensula'), { key: 'n', label: 'Detaliu', min: 4, max: 40, def: 20 }, { key: 'sh', label: 'Strălucire (relieful tușelor)', min: 0, max: 100, def: 30, unit: '%' }, { key: 'la', label: 'Unghiul luminii', min: -180, max: 180, def: 135, unit: '°' }] },
  { id: 'wind', group: 'Stilizare', label: 'Vânt', hint: 'Dungi luminoase trase într-o parte (Wind)', params: [R(20, 200, 'Lungime'), { key: 'left', label: 'Bate din dreapta', min: 0, max: 1, def: 0, bool: true }, { key: 'm', label: 'Metoda', min: 0, max: 2, def: 0, options: ['Vânt', 'Rafală', 'Sacadat'] }] },
  { id: 'diffuse', group: 'Stilizare', label: 'Difuzie', hint: 'Pixelii se amestecă la întâmplare cu vecinii, ca pe sticlă mată (Diffuse)', params: [R(2, 20)] },
  { id: 'tiles', group: 'Stilizare', label: 'Plăci', hint: 'Poza tăiată în plăci, ușor deplasate (Tiles)', params: [{ key: 'n', label: 'Plăci pe lățime', min: 2, max: 50, def: 10 }, { key: 'o', label: 'Deplasare', min: 1, max: 90, def: 10, unit: '%' }] },
  { id: 'trace', group: 'Stilizare', label: 'Contur la nivel', hint: 'Linii subțiri acolo unde luminozitatea trece de un nivel, ca pe o hartă (Trace Contour)', params: [{ key: 'l', label: 'Nivel', min: 0, max: 255, def: 128 }] },
  { id: 'facet', group: 'Pixelare', label: 'Fațetare', hint: 'Zonele de culoare apropiată devin pete plate, cu marginile păstrate, ca o pictură (Facet)', params: [R(3, 12, 'Mărimea fațetelor')] },
  { id: 'crystallize', group: 'Pixelare', label: 'Cristalizare', hint: 'Poza din cristale (celule) de o culoare (Crystallize)', params: [R(12, 150, 'Mărimea celulei')] },
  { id: 'pointillize', group: 'Pixelare', label: 'Puantilism', hint: 'Puncte de culoare pe fond alb, ca Seurat (Pointillize)', params: [R(10, 150, 'Mărimea punctului')] },
  { id: 'halftone', group: 'Pixelare', label: 'Semitonuri color', hint: 'Puncte de tipar pe fiecare culoare, ca în ziare (Color Halftone)', params: [R(8, 60, 'Raza maximă')] },
  { id: 'mezzotint', group: 'Pixelare', label: 'Mezzotinta', hint: 'Puncte, linii sau tușe de culori pure, ca o gravură (Mezzotint)', params: [{ key: 't', label: 'Tipul', min: 0, max: 6, def: 0, options: ['Puncte fine', 'Puncte medii', 'Puncte mari', 'Linii scurte', 'Linii lungi', 'Tușe scurte', 'Tușe lungi'] }] },
  { id: 'fragment', group: 'Pixelare', label: 'Fragmentare', hint: 'Patru copii ușor decalate, ca o poză mișcată (Fragment)', params: [] },
  { id: 'clouds', group: 'Randare', label: 'Nori', hint: 'Înlocuiește poza cu nori alb-negru, buni pentru texturi și fundaluri (Clouds)', params: [R(120, 600, 'Mărime')] },
  { id: 'frame', group: 'Randare', label: 'Ramă', hint: 'Pune o ramă în jurul pozei, peste marginile ei: simplă, dublă, din lemn, aurie, cu paspartu sau o margine albă estompată (Picture Frame)', params: [
    { key: 'style', label: 'Rama', min: 0, max: FRAME_STYLES.length - 1, def: 2, options: FRAME_STYLES },
    { key: 'wd', label: 'Lățimea', min: 1, max: 30, def: 8, unit: '%' },
    { key: 'col', label: 'Culoarea (simplă, dublă, paspartu)', min: 0, max: FRAME_COLORS.length - 1, def: 1, options: FRAME_COLORS.map(([n]) => n) },
  ] },
  { id: 'tree', group: 'Randare', label: 'Copac', hint: 'Desenează un copac peste poză: trunchi, ramuri și frunze, după tipul ales; alt model dă alt copac (Tree)', params: [
    { key: 'tp', label: 'Tipul copacului', min: 0, max: TREE_TYPES.length - 1, def: 0, options: TREE_TYPES },
    { key: 'x', label: 'Locul (orizontal)', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'y', label: 'Baza (vertical)', min: 0, max: 100, def: 96, unit: '%' },
    { key: 'sz', label: 'Înălțimea', min: 5, max: 100, def: 70, unit: '%' },
    { key: 'th', label: 'Grosimea trunchiului', min: 30, max: 250, def: 100, unit: '%' },
    { key: 'lv', label: 'Frunze', min: 0, max: 100, def: 70, unit: '%' },
    { key: 'seed', label: 'Alt model', min: 1, max: 99, def: 1 },
  ] },
  { id: 'flame', group: 'Randare', label: 'Flăcări', hint: 'Desenează foc peste poză: de-a lungul marginii de jos, o flacără sau o lumânare; focul doar luminează, ca lumina adevărată (Flame)', params: [
    { key: 'tp', label: 'Tipul', min: 0, max: FLAME_TYPES.length - 1, def: 0, options: FLAME_TYPES },
    { key: 'col', label: 'Culoarea', min: 0, max: FLAME_COLORS.length - 1, def: 0, options: FLAME_COLORS },
    { key: 'ht', label: 'Înălțimea flăcărilor', min: 3, max: 100, def: 35, unit: '%' },
    { key: 'wd', label: 'Lățimea (o flacără, lumânare)', min: 5, max: 100, def: 30, unit: '%' },
    { key: 'x', label: 'Locul (o flacără, lumânare)', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'y', label: 'Baza (vertical)', min: 0, max: 100, def: 100, unit: '%' },
    { key: 'turb', label: 'Unduire', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'seed', label: 'Alt model', min: 1, max: 99, def: 1 },
  ] },
  { id: 'fibers', group: 'Randare', label: 'Fibre', hint: 'Înlocuiește poza cu fibre verticale, ca hârtia sau lemnul, bune pentru texturi (Fibers)', params: [{ key: 'var', label: 'Variație', min: 1, max: 64, def: 16 }, { key: 's', label: 'Tărie (lungimea fibrelor)', min: 1, max: 64, def: 4 }, { key: 'seed', label: 'Alt model', min: 1, max: 99, def: 1 }] },
  { id: 'diffclouds', group: 'Randare', label: 'Nori diferență', hint: 'Amestecă norii cu poza prin diferență (Difference Clouds)', params: [R(120, 600, 'Mărime')] },
  { id: 'polar', group: 'Deformare', label: 'Coordonate polare', hint: 'Poza îndoită în cerc (o panoramă devine o „planetă mică”), sau invers (Polar Coordinates)', params: [{ key: 'inv', label: 'Din polar în dreptunghi', min: 0, max: 1, def: 0, bool: true }] },
  { id: 'shear', group: 'Deformare', label: 'Înclinare', hint: 'Înclină poza pe orizontală după un unghi și o curbă cu cinci puncte (sus … jos), apoi o reia de la margine sau repetă pixelii de la margine (Shear)', params: [{ key: 'a', label: 'Unghi', min: -60, max: 60, def: 20, unit: '°' }, ...['Curba: sus', 'Curba: sfertul de sus', 'Curba: mijloc', 'Curba: sfertul de jos', 'Curba: jos'].map((label, i) => ({ key: 'c' + i, label, min: -50, max: 50, def: 0, unit: '%' })), { key: 'edge', label: 'Ce iese pe o parte', min: 0, max: 1, def: 0, options: ['Intră pe partea cealaltă', 'Repetă pixelii de la margine'] }] },
  { id: 'hdr', group: 'Fotografie', label: 'Tonuri HDR', hint: 'Umbrele se luminează și cerul ars se întunecă, dar detaliile mici ies mai clar: aspectul pozelor HDR, dintr-o singură poză (HDR Toning: Local Adaptation)', params: [R(30, 150), { key: 's', label: 'Tărie (cât se apropie luminile de umbre)', min: 0, max: 100, def: 50, unit: '%' }, { key: 'd', label: 'Detalii', min: -100, max: 300, def: 60, unit: '%' }, { key: 'e', label: 'Expunere', min: -100, max: 100, def: 0 }, { key: 'g', label: 'Gamma (tonurile medii)', min: 10, max: 200, def: 100, unit: '%' }, { key: 'sat', label: 'Saturație', min: -100, max: 100, def: 20, unit: '%' }] },
  { id: 'shapeblur', group: 'Estompare', label: 'Estompare cu formă', hint: 'Fiecare pixel se amestecă cu vecinii dintr-o formă aleasă: luminile mici iau forma ei (Shape Blur)', params: [{ key: 'shape', label: 'Forma', min: 0, max: SHAPES.length - 1, def: 0, options: SHAPES.map((x) => x[0]) }, R(8, 60)] },
  { id: 'lensblur', group: 'Estompare', label: 'Estompare de obiectiv', hint: 'Ca un obiectiv foto deschis larg: luminile devin discuri sau poligoane, după forma diafragmei (numărul de lamele, rotația și rotunjirea lor); cu o hartă de adâncime, doar ce e departe de distanța clară se estompează, iar zgomotul pune înapoi granulația (Lens Blur)', params: [R(6, 30), { key: 'hi', label: 'Luminile strălucesc', min: 0, max: 100, def: 30, unit: '%' }, { key: 'sh', label: 'Forma diafragmei', min: 0, max: 6, def: 0, options: ['Cerc', 'Triunghi', 'Pătrat', 'Pentagon', 'Hexagon', 'Heptagon', 'Octogon'] }, { key: 'rot', label: 'Rotația lamelelor', min: 0, max: 360, def: 0, unit: '°' }, { key: 'cv', label: 'Lamele rotunjite', min: 0, max: 100, def: 0, unit: '%' }, { key: 'dm', label: 'Harta de adâncime', min: 0, max: 4, def: 0, options: ['Fără (totul la fel)', 'Sus departe, jos aproape', 'Jos departe, sus aproape', 'Luminos = departe', 'Întunecat = departe'] }, { key: 'fz', label: 'Distanța clară', min: 0, max: 100, def: 0, unit: '%' }, { key: 'nz', label: 'Zgomot', min: 0, max: 100, def: 0, unit: '%' }, { key: 'nm', label: 'Zgomot monocromatic', min: 0, max: 1, def: 0, bool: true }] },
  { id: 'spinblur', group: 'Estompare', label: 'Estompare rotativă', hint: 'Un cerc ales se învârte, ca o roată sau o elice în mișcare; restul pozei rămâne clar (Spin Blur)', params: [{ key: 'x', label: 'Centrul: orizontal', min: 0, max: 100, def: 50, unit: '%' }, { key: 'y', label: 'Centrul: vertical', min: 0, max: 100, def: 50, unit: '%' }, { key: 's', label: 'Mărimea cercului', min: 5, max: 100, def: 40, unit: '%' }, { key: 'a', label: 'Unghiul de rotire', min: 1, max: 180, def: 15, unit: '°' }, { key: 'f', label: 'Trecerea la margine', min: 0, max: 100, def: 20, unit: '%' }] },
  { id: 'pathblur', group: 'Estompare', label: 'Estompare pe drum', hint: 'Mișcare de-a lungul unui drum curbat ales (de la început, prin cot, la sfârșit): o mașină care ia o curbă, apă care curge, un dansator (Path Blur)', params: [
    { key: 'x0', label: 'Începutul: orizontal', min: 0, max: 100, def: 10, unit: '%' }, { key: 'y0', label: 'Începutul: vertical', min: 0, max: 100, def: 70, unit: '%' },
    { key: 'cx', label: 'Cotul: orizontal', min: 0, max: 100, def: 50, unit: '%' }, { key: 'cy', label: 'Cotul: vertical', min: 0, max: 100, def: 20, unit: '%' },
    { key: 'x1', label: 'Sfârșitul: orizontal', min: 0, max: 100, def: 90, unit: '%' }, { key: 'y1', label: 'Sfârșitul: vertical', min: 0, max: 100, def: 70, unit: '%' },
    R(30, 200, 'Viteză (lungimea mișcării)'), { key: 'tp', label: 'Conicitate (mișcarea scade spre sfârșit)', min: 0, max: 100, def: 0, unit: '%' },
  ] },
  { id: 'iris', group: 'Estompare', label: 'Estompare iris', hint: 'O elipsă rămâne clară, în jurul ei poza se estompează; mută centrul trăgând de punctul de pe poză (Iris Blur)', params: [{ key: 's', label: 'Mărimea zonei clare', min: 0, max: 100, def: 40, unit: '%' }, { key: 'f', label: 'Trecerea', min: 1, max: 100, def: 30, unit: '%' }, R(8, 50, 'Estompare'), { key: 'x', label: 'Centrul: orizontal', min: 0, max: 100, def: 50, unit: '%' }, { key: 'y', label: 'Centrul: vertical', min: 0, max: 100, def: 50, unit: '%' }, { key: 'ar', label: 'Forma (− înaltă, + lată)', min: -100, max: 100, def: 0 }, { key: 'rot', label: 'Rotația elipsei', min: -90, max: 90, def: 0, unit: '°' }] },
  { id: 'reducenoise', group: 'Zgomot', label: 'Reducere zgomot', hint: 'Scoate granulația pozelor făcute seara, cu detaliile păstrate; zgomotul unui singur canal (de obicei albastrul) se scoate separat, iar detaliile se pot clarifica la final (Reduce Noise)', params: [{ key: 'v', label: 'Tărie', min: 1, max: 10, def: 6 }, { key: 'd', label: 'Păstrează detaliile', min: 0, max: 100, def: 40, unit: '%' }, { key: 'col', label: 'Zgomot de culoare (pete colorate)', min: 0, max: 100, def: 0, unit: '%' }, { key: 'jpeg', label: 'Scoate pătrățelele de la JPEG', min: 0, max: 1, def: 0, bool: true }, { key: 'cr', label: 'Încă pe canalul roșu', min: 0, max: 100, def: 0, unit: '%' }, { key: 'cg', label: 'Încă pe canalul verde', min: 0, max: 100, def: 0, unit: '%' }, { key: 'cb', label: 'Încă pe canalul albastru', min: 0, max: 100, def: 0, unit: '%' }, { key: 'sd', label: 'Clarifică detaliile', min: 0, max: 100, def: 0, unit: '%' }] },
  { id: 'zigzag', group: 'Deformare', label: 'Zigzag (cercuri în apă)', hint: 'Unde în cerc, ca o piatră aruncată în apă (ZigZag)', params: [{ key: 'v', label: 'Cât de tare', min: -100, max: 100, def: 40, unit: '%' }, { key: 'n', label: 'Creste', min: 1, max: 20, def: 6 }] },
  { id: 'lenscorr', group: 'Deformare', label: 'Corecție obiectiv', hint: 'Îndreaptă liniile curbate de obiectiv, luminează colțurile întunecate, scoate marginile colorate și îndreaptă perspectiva (clădirile care se apleacă spre spate), unghiul și scara (Lens Correction)', params: [{ key: 'd', label: 'Distorsiune (− butoi, + pernă)', min: -100, max: 100, def: 20 }, { key: 'vig', label: 'Vignetă (colțuri)', min: -100, max: 100, def: 0 }, { key: 'ca', label: 'Margini colorate (roșu / albastru)', min: -100, max: 100, def: 0 }, { key: 'vp', label: 'Perspectivă verticală (− lărgește sus)', min: -100, max: 100, def: 0 }, { key: 'hp', label: 'Perspectivă orizontală (− lărgește stânga)', min: -100, max: 100, def: 0 }, { key: 'ang', label: 'Unghi', min: -45, max: 45, step: 0.1, def: 0, unit: '°' }, { key: 'sc', label: 'Scara', min: 50, max: 150, def: 100, unit: '%' }, { key: 'edge', label: 'Marginile goale', min: 0, max: 1, def: 0, options: ['Întinde marginea', 'Transparente'] }] },
  { id: 'wideangle', group: 'Deformare', label: 'Unghi larg adaptiv', hint: 'Îndreaptă pozele făcute cu obiectiv ochi de pește sau cu unghi foarte larg: liniile curbate devin drepte, iar oamenii de la margini nu mai par întinși (Adaptive Wide Angle)', params: [{ key: 'tp', label: 'Corecția', min: 0, max: 2, def: 0, options: ['Ochi de pește', 'Perspectivă (margini mai puțin întinse)', 'Panoramă cilindrică'] }, { key: 'f', label: 'Focala (echivalent 35 mm)', min: 4, max: 50, step: 0.5, def: 12, unit: ' mm' }, { key: 'sc', label: 'Scara', min: 30, max: 200, def: 100, unit: '%' }, { key: 'edge', label: 'Marginile goale', min: 0, max: 1, def: 0, options: ['Întinde marginea', 'Transparente'] }] },
  { id: 'lighting', group: 'Randare', label: 'Efecte de lumină', hint: 'O lumină (punct, reflector sau de departe, ca soarele) luminează o parte din poză, restul se întunecă; culoarea luminii, a doua lumină și relieful din poză (Lighting Effects)', params: [{ key: 'tp', label: 'Tipul luminii', min: 0, max: 2, def: 0, options: ['Punct', 'Reflector', 'De departe (ca soarele)'] }, { key: 'x', label: 'Lumina: orizontal', min: 0, max: 100, def: 50, unit: '%' }, { key: 'y', label: 'Lumina: vertical', min: 0, max: 100, def: 40, unit: '%' }, { key: 'ang', label: 'Direcția (reflector, de departe)', min: -180, max: 180, def: 135, unit: '°' }, { key: 'r', label: 'Mărimea luminii', min: 5, max: 150, def: 60, unit: '%' }, { key: 'i', label: 'Intensitate', min: 0, max: 200, def: 100, unit: '%' }, { key: 'amb', label: 'Lumina din jur', min: 0, max: 100, def: 30, unit: '%' }, { key: 'col', label: 'Culoarea luminii', min: 0, max: 5, def: 0, options: ['Albă', 'Caldă', 'Rece', 'Roșie', 'Verde', 'Albastră'] }, { key: 'tex', label: 'Relief din poză', min: 0, max: 100, def: 0, unit: '%' }, { key: 'two', label: 'A doua lumină (albă)', min: 0, max: 1, def: 0, bool: true }, { key: 'x2', label: 'A doua lumină: orizontal', min: 0, max: 100, def: 75, unit: '%' }, { key: 'y2', label: 'A doua lumină: vertical', min: 0, max: 100, def: 60, unit: '%' }] },
  { id: 'flare', group: 'Randare', label: 'Reflexie de obiectiv', hint: 'Un soare care intră în obiectiv, cu inele și pete (Lens Flare)', params: [{ key: 'x', label: 'Orizontal', min: 0, max: 100, def: 30, unit: '%' }, { key: 'y', label: 'Vertical', min: 0, max: 100, def: 30, unit: '%' }, { key: 'v', label: 'Luminozitate', min: 10, max: 300, def: 100, unit: '%' }, { key: 'lens', label: 'Obiectivul', min: 0, max: 3, def: 0, options: ['Zoom 50–300 mm', 'Fix 35 mm', 'Fix 105 mm', 'Film (dungă orizontală)'] }] },
  { id: 'deinterlace', group: 'Video', label: 'Scoate întrețeserea', hint: 'Scoate liniile „pieptene” din cadrele luate de pe casete video (De-Interlace)', params: [{ key: 'even', label: 'Înlocuiește liniile pare', min: 0, max: 1, def: 0, bool: true }] },
  { id: 'ntsc', group: 'Video', label: 'Culori NTSC', hint: 'Reduce culorile prea vii pentru televizor (NTSC Colors)', params: [] },
  { id: 'hsb', group: 'Altele', label: 'HSB / HSL', hint: 'Pune nuanța, saturația și luminozitatea în locul culorilor roșu, verde, albastru (HSB/HSL)', params: [{ key: 'hsl', label: 'HSL (nu HSB)', min: 0, max: 1, def: 0, bool: true }] },
  { id: 'custom', group: 'Altele', label: 'Personalizat (matrice)', hint: 'Filtrul tău: fiecare pixel = suma vecinilor înmulțiți cu numerele din pătratul 3 × 3, împărțită la „Împărțire” și cu „Decalaj” adăugat (Custom). Implicit: claritate', params: [
    { key: 'k0', label: 'Matrice: sus, stânga', min: -20, max: 20, def: 0 },
    { key: 'k1', label: 'Matrice: sus, mijloc', min: -20, max: 20, def: -1 },
    { key: 'k2', label: 'Matrice: sus, dreapta', min: -20, max: 20, def: 0 },
    { key: 'k3', label: 'Matrice: mijloc, stânga', min: -20, max: 20, def: -1 },
    { key: 'k4', label: 'Matrice: centru', min: -20, max: 20, def: 5 },
    { key: 'k5', label: 'Matrice: mijloc, dreapta', min: -20, max: 20, def: -1 },
    { key: 'k6', label: 'Matrice: jos, stânga', min: -20, max: 20, def: 0 },
    { key: 'k7', label: 'Matrice: jos, mijloc', min: -20, max: 20, def: -1 },
    { key: 'k8', label: 'Matrice: jos, dreapta', min: -20, max: 20, def: 0 },
    { key: 'sc', label: 'Împărțire', min: 1, max: 100, def: 1 }, { key: 'off', label: 'Decalaj', min: -255, max: 255, def: 0 }] },
  // Galeria artistică (Filter Gallery: Sketch / Artistic / Texture).
  { id: 'sketch', group: 'Artistic', label: 'Schiță în creion', hint: 'Poza devine un desen în creion pe hârtie albă (Sketch / Photocopy)', params: [R(6, 30, 'Grosimea liniilor'), { key: 'v', label: 'Contrast', min: 0, max: 100, def: 40, unit: '%' }] },
  { id: 'cutout', group: 'Artistic', label: 'Decupaj din hârtie', hint: 'Pete plate de culoare, ca din hârtie colorată tăiată cu foarfeca (Cutout)', params: [{ key: 'n', label: 'Niveluri de culoare', min: 2, max: 8, def: 4 }, R(2, 6, 'Simplificare')] },
  { id: 'watercolor', group: 'Artistic', label: 'Acuarelă', hint: 'Culori moi, cu marginile închise ca la pensula udă pe hârtie (Watercolor)', params: [R(3, 8, 'Pensula'), { key: 'v', label: 'Umbrele marginilor', min: 0, max: 100, def: 45, unit: '%' }] },
  { id: 'canvas', group: 'Artistic', label: 'Pânză', hint: 'Textura unei pânze de pictură peste poză (Texturizer: Canvas)', params: [{ key: 'v', label: 'Relief', min: 0, max: 100, def: 40, unit: '%' }, R(4, 20, 'Mărimea ochiurilor')] },
  { id: 'fieldblur', group: 'Estompare', label: 'Estompare pe câmp', hint: 'Două puncte, fiecare cu estomparea lui: între ele estomparea trece lin de la una la alta, ca o adâncime de câmp aleasă de tine (Field Blur)', params: [{ key: 'x1', label: 'Punctul 1: orizontal', min: 0, max: 100, def: 50, unit: '%' }, { key: 'y1', label: 'Punctul 1: vertical', min: 0, max: 100, def: 20, unit: '%' }, { ...R(0, 50, 'Punctul 1: estompare'), key: 'b1', min: 0 }, { key: 'x2', label: 'Punctul 2: orizontal', min: 0, max: 100, def: 50, unit: '%' }, { key: 'y2', label: 'Punctul 2: vertical', min: 0, max: 100, def: 80, unit: '%' }, { ...R(12, 50, 'Punctul 2: estompare'), key: 'b2', min: 0 }] },
  { id: 'extrude', group: 'Stilizare', label: 'Extrudare', hint: 'Poza din blocuri sau piramide în relief, fiecare cu culoarea medie a locului (Extrude)', params: [R(16, 120, 'Mărimea blocului'), { key: 'd', label: 'Adâncimea marginilor', min: 5, max: 100, def: 30, unit: '%' }, { key: 'pyr', label: 'Piramide', min: 0, max: 1, def: 0, bool: true }] },
  // Schiță (Filter Gallery: Sketch): două culori, cerneala pentru umbre și hârtia pentru lumini (sketchFx.ts).
  { id: 'basrelief', group: 'Schiță', label: 'Basorelief', hint: 'Poza pare sculptată în piatră, luminată dintr-o parte (Bas Relief)', params: [{ key: 'd', label: 'Detaliu', min: 1, max: 100, def: 50, unit: '%' }, { key: 's', label: 'Netezire', min: 0.5, max: 15, step: 0.5, def: 2, px: true, unit: 'px' }, { key: 'dir', label: 'Lumina din', min: 0, max: 7, def: 0, options: LIGHT_DIRS }, { key: 'ink', label: 'Culorile (cerneală / hârtie)', min: 0, max: SKETCH_INKS.length - 1, def: 0, options: SKETCH_INKS.map(([n]) => n) }] },
  { id: 'chalk', group: 'Schiță', label: 'Cretă și cărbune', hint: 'Umbrele cu tușe de cărbune, luminile cu tușe de cretă, pe hârtie gri (Chalk & Charcoal)', params: [{ key: 'ch', label: 'Cărbune', min: 0, max: 100, def: 40, unit: '%' }, { key: 'ck', label: 'Cretă', min: 0, max: 100, def: 40, unit: '%' }, { key: 'p', label: 'Apăsare', min: 0, max: 100, def: 40, unit: '%' }, R(4, 20, 'Lungimea tușelor'), { key: 'ink', label: 'Culorile (cerneală / hârtie)', min: 0, max: SKETCH_INKS.length - 1, def: 0, options: SKETCH_INKS.map(([n]) => n) }] },
  { id: 'photocopy', group: 'Schiță', label: 'Fotocopie', hint: 'Ca o copie la copiator: rămân doar contururile și umbrele, restul se albește (Photocopy)', params: [{ ...R(4, 24, 'Detaliu'), step: 0.5, min: 0.5 }, { key: 'd', label: 'Întunecare', min: 0, max: 100, def: 40, unit: '%' }, { key: 'ink', label: 'Culorile (cerneală / hârtie)', min: 0, max: SKETCH_INKS.length - 1, def: 0, options: SKETCH_INKS.map(([n]) => n) }] },
  { id: 'stamp', group: 'Schiță', label: 'Ștampilă', hint: 'Poza în două culori, netedă, ca o ștampilă de cauciuc (Stamp)', params: [{ key: 'b', label: 'Echilibrul lumină / întuneric', min: 1, max: 99, def: 50, unit: '%' }, { key: 's', label: 'Netezire', min: 0.5, max: 10, step: 0.5, def: 2, px: true, unit: 'px' }, { key: 'ink', label: 'Culorile (cerneală / hârtie)', min: 0, max: SKETCH_INKS.length - 1, def: 0, options: SKETCH_INKS.map(([n]) => n) }] },
  { id: 'torn', group: 'Schiță', label: 'Margini rupte', hint: 'Poza în două culori, cu marginile zdrențuite ca hârtia ruptă (Torn Edges)', params: [{ key: 'b', label: 'Echilibrul lumină / întuneric', min: 1, max: 99, def: 50, unit: '%' }, { key: 's', label: 'Netezire', min: 0.5, max: 10, step: 0.5, def: 2, px: true, unit: 'px' }, { key: 'c', label: 'Contrast', min: 1, max: 25, def: 17 }, { key: 'ink', label: 'Culorile (cerneală / hârtie)', min: 0, max: SKETCH_INKS.length - 1, def: 0, options: SKETCH_INKS.map(([n]) => n) }] },
  { id: 'htpattern', group: 'Schiță', label: 'Model de semiton', hint: 'Puncte, cercuri sau linii, mai groase unde poza e mai închisă, ca la tipar (Halftone Pattern)', params: [{ key: 't', label: 'Modelul', min: 0, max: HALFTONE_TYPES.length - 1, def: 0, options: HALFTONE_TYPES }, R(6, 40, 'Mărimea'), { key: 'c', label: 'Contrast', min: 0, max: 100, def: 50, unit: '%' }, { key: 'ink', label: 'Culorile (cerneală / hârtie)', min: 0, max: SKETCH_INKS.length - 1, def: 0, options: SKETCH_INKS.map(([n]) => n) }] },
  // Artistic, partea a doua (artisticFx.ts).
  { id: 'posteredges', group: 'Artistic', label: 'Margini de afiș', hint: 'Culori în puține trepte și margini negre, ca un afiș tipărit (Poster Edges)', params: [{ key: 't', label: 'Grosimea marginilor', min: 0, max: 10, def: 2 }, { key: 'i', label: 'Intensitatea marginilor', min: 0, max: 10, def: 1 }, { key: 'n', label: 'Trepte de culoare', min: 2, max: 8, def: 6 }] },
  { id: 'drybrush', group: 'Artistic', label: 'Pensulă uscată', hint: 'Pete plate cu urme de pensulă, ca vopseaua întinsă cu o pensulă aproape uscată (Dry Brush)', params: [R(3, 10, 'Mărimea pensulei'), { key: 'd', label: 'Detaliu', min: 0, max: 10, def: 8 }, { key: 't', label: 'Textură', min: 1, max: 3, def: 1 }] },
  { id: 'paletteknife', group: 'Artistic', label: 'Spatulă', hint: 'Pete mari și plate de vopsea, puse cu spatula, cu marginile păstrate (Palette Knife)', params: [R(6, 25, 'Mărimea tușei'), { key: 's', label: 'Moliciune', min: 0, max: 10, def: 0 }] },
  { id: 'sponge', group: 'Artistic', label: 'Burete', hint: 'Vopsea pusă cu buretele: pete cu goluri mici, mai închise (Sponge)', params: [R(4, 10, 'Mărimea buretelui'), { key: 'd', label: 'Definiție', min: 0, max: 25, def: 12 }, { key: 's', label: 'Netezire', min: 1, max: 15, def: 5 }] },
  { id: 'colpencil', group: 'Artistic', label: 'Creion colorat', hint: 'Hașuri oblice în culorile pozei pe hârtie, mai dese unde poza e mai închisă (Colored Pencil)', params: [R(3, 24, 'Grosimea creionului'), { key: 'p', label: 'Apăsarea', min: 0, max: 15, def: 8 }, { key: 'b', label: 'Luminozitatea hârtiei', min: 0, max: 50, def: 50 }] },
  { id: 'neon', group: 'Artistic', label: 'Neon', hint: 'Poza în tonuri închise, cu marginile strălucind în culoarea aleasă (Neon Glow)', params: [R(3, 24, 'Mărimea strălucirii'), { key: 'b', label: 'Luminozitatea strălucirii', min: 0, max: 100, def: 50, unit: '%' }, { key: 'col', label: 'Culoarea', min: 0, max: NEON_COLORS.length - 1, def: 0, options: NEON_COLORS.map(([n]) => n) }] },
  // Ultimele din Galeria de filtre (galleryFx.ts).
  { id: 'fresco', group: 'Artistic', label: 'Frescă', hint: 'Pete scurte și plate, contrast mare și margini închise, ca pictura pe tencuială udă (Fresco)', params: [R(2, 10, 'Mărimea pensulei'), { key: 'd', label: 'Detaliu', min: 0, max: 10, def: 8 }, { key: 't', label: 'Textură', min: 1, max: 3, def: 1 }] },
  { id: 'pastels', group: 'Artistic', label: 'Pastel', hint: 'Tușe lungi și oblice de cretă colorată, pe hârtie cu granulație (Rough Pastels)', params: [R(6, 40, 'Lungimea tușei'), { key: 'v', label: 'Detaliul tușei', min: 0, max: 100, def: 40, unit: '%' }] },
  { id: 'chrome', group: 'Schiță', label: 'Crom', hint: 'Poza devine metal lustruit, cu dungi luminoase și întunecate (Chrome)', params: [{ key: 'd', label: 'Detaliu', min: 0, max: 10, def: 4 }, { key: 's', label: 'Netezire', min: 0.5, max: 15, step: 0.5, def: 4, px: true, unit: 'px' }] },
  { id: 'graphicpen', group: 'Schiță', label: 'Pix grafic', hint: 'Linii subțiri de cerneală, toate în aceeași direcție, mai dese unde poza e mai închisă (Graphic Pen)', params: [R(8, 30, 'Lungimea tușei'), { key: 'b', label: 'Echilibrul lumină / întuneric', min: 1, max: 99, def: 50, unit: '%' }, { key: 'dir', label: 'Direcția', min: 0, max: PEN_DIRS.length - 1, def: 0, options: PEN_DIRS }, { key: 'ink', label: 'Culorile (cerneală / hârtie)', min: 0, max: SKETCH_INKS.length - 1, def: 0, options: SKETCH_INKS.map(([n]) => n) }] },
  { id: 'plaster', group: 'Schiță', label: 'Ipsos', hint: 'Poza în două culori, umflată și luminată ca o formă turnată în ipsos (Plaster)', params: [{ key: 'b', label: 'Echilibrul lumină / întuneric', min: 1, max: 99, def: 50, unit: '%' }, { key: 's', label: 'Netezire', min: 0.5, max: 15, step: 0.5, def: 3, px: true, unit: 'px' }, { key: 'ink', label: 'Culorile (cerneală / hârtie)', min: 0, max: SKETCH_INKS.length - 1, def: 0, options: SKETCH_INKS.map(([n]) => n) }] },
  { id: 'sumie', group: 'Tușe de pensulă', label: 'Sumi-e', hint: 'Tușe late cu tuș negru pe hârtie de orez: umbre foarte închise, contururi moi (Sumi-e)', params: [R(4, 15, 'Lățimea tușei'), { key: 'p', label: 'Apăsarea', min: 0, max: 15, def: 4 }, { key: 'c', label: 'Contrast', min: 0, max: 40, def: 10 }] },
  { id: 'angled', group: 'Tușe de pensulă', label: 'Tușe oblice', hint: 'Luminile pictate cu tușe într-o diagonală, umbrele în cealaltă (Angled Strokes)', params: [R(8, 50, 'Lungimea tușei'), { key: 'b', label: 'Echilibrul direcțiilor', min: 0, max: 100, def: 50, unit: '%' }] },
  // Textură (Filter Gallery: Texture), în textureFx.ts; Pânza e la Artistic.
  { id: 'craquelure', group: 'Textură', label: 'Craquelură', hint: 'O rețea de crăpături fine, ca vopseaua veche uscată pe un tablou (Craquelure)', params: [R(15, 100, 'Distanța dintre crăpături'), { key: 'd', label: 'Adâncimea crăpăturilor', min: 0, max: 100, def: 60, unit: '%' }, { key: 'b', label: 'Luminozitatea', min: 0, max: 100, def: 50, unit: '%' }] },
  { id: 'grain', group: 'Textură', label: 'Granulație', hint: 'Grăunțe peste poză, de nouă feluri: fine, moi, stropi, aglomerate, mărite, puncte sau dungi (Grain)', params: [{ key: 't', label: 'Felul granulației', min: 0, max: GRAIN_TYPES.length - 1, def: 0, options: GRAIN_TYPES }, { key: 'v', label: 'Intensitate', min: 0, max: 100, def: 40, unit: '%' }, { key: 'c', label: 'Contrast', min: 0, max: 100, def: 0, unit: '%' }] },
  { id: 'mosaictiles', group: 'Textură', label: 'Plăci de mozaic', hint: 'Poza tăiată în plăcuțe pătrate, cu rosturi între ele, ca o faianță (Mosaic Tiles)', params: [R(14, 100, 'Mărimea plăcilor'), { ...R(1, 15, 'Lățimea rosturilor'), key: 'g', min: 0.5, step: 0.5 }, { key: 'b', label: 'Luminozitatea rosturilor', min: 0, max: 100, def: 60, unit: '%' }] },
  { id: 'patchwork', group: 'Textură', label: 'Patchwork', hint: 'Pătrățele de o singură culoare, fiecare cu relieful lui, ca o pătură cusută din petice (Patchwork)', params: [R(6, 40, 'Mărimea pătratelor'), { key: 'v', label: 'Relief', min: 0, max: 100, def: 60, unit: '%' }] },
  { id: 'stainedglass', group: 'Textură', label: 'Vitraliu', hint: 'Bucăți de sticlă colorată despărțite de margini închise, luminate din spate (Stained Glass)', params: [R(14, 100, 'Mărimea celulei'), { ...R(3, 20, 'Grosimea marginii'), key: 'b', min: 0.5, step: 0.5 }, { key: 'l', label: 'Lumina din spate', min: 0, max: 100, def: 30, unit: '%' }] },
  // Tușe de pensulă (Filter Gallery: Brush Strokes).
  { id: 'spatter', group: 'Tușe de pensulă', label: 'Stropire', hint: 'Marginile se împrăștie în stropi mărunți, ca vopseaua pulverizată (Spatter)', params: [R(6, 25, 'Raza stropilor'), { key: 's', label: 'Netezire', min: 0, max: 6, def: 2 }] },
  { id: 'crosshatch', group: 'Tușe de pensulă', label: 'Hașurare', hint: 'Tușe diagonale de creion, încrucișate în zonele întunecate (Crosshatch)', params: [R(8, 40, 'Lungimea tușelor'), { key: 'v', label: 'Tăria hașurii', min: 0, max: 100, def: 50, unit: '%' }, { ...R(5, 20, 'Distanța dintre linii'), key: 'p', min: 2 }] },
  { id: 'accented', group: 'Tușe de pensulă', label: 'Margini accentuate', hint: 'Marginile se îngroașă, luminoase ca o cretă sau închise ca o tușă (Accented Edges)', params: [R(2, 14, 'Lățimea marginilor'), { key: 'v', label: 'Luminozitatea marginilor (− închise, + luminoase)', min: -100, max: 100, def: 50 }] },
  { id: 'offset', group: 'Altele', label: 'Decalaj', hint: 'Mută poza și o reia de la margine, ca la texturile care se repetă (Offset)', params: [{ key: 'x', label: 'Orizontal', min: -100, max: 100, def: 50, unit: '%' }, { key: 'y', label: 'Vertical', min: -100, max: 100, def: 50, unit: '%' }] },
];

export const filterDef = (id: FilterId) => FILTERS.find((f) => f.id === id)!;
export const filterDefaults = (id: FilterId): Record<string, number> => Object.fromEntries(filterDef(id).params.map((p) => [p.key, p.def]));

type Px = Uint8ClampedArray;
const clampI = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v);

/** Estompare în cutie pe orizontală, apoi pe verticală (rază r), cu marginea repetată. */
function boxBlur(src: Px, w: number, h: number, r: number): Px {
  r = Math.max(0, Math.round(r));
  if (!r) return src.slice();
  const tmp = new Uint8ClampedArray(src.length), out = new Uint8ClampedArray(src.length), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let c = 0; c < 4; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[row + clampI(k, w - 1) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[row + x * 4 + c] = Math.round(acc / n);
        acc += src[row + clampI(x + r + 1, w - 1) * 4 + c] - src[row + clampI(x - r, w - 1) * 4 + c];
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      const col = x * 4 + c;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[clampI(k, h - 1) * w * 4 + col];
      for (let y = 0; y < h; y++) {
        out[y * w * 4 + col] = Math.round(acc / n);
        acc += tmp[clampI(y + r + 1, h - 1) * w * 4 + col] - tmp[clampI(y - r, h - 1) * w * 4 + col];
      }
    }
  }
  return out;
}

/** Estompare Gaussiană aproximată prin trei estompări în cutie (rază ≈ sigma, ca în Photoshop). */
export function gaussBlur(src: Px, w: number, h: number, sigma: number): Px {
  if (sigma < 0.3) return src.slice();
  const n = 3, wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  let cur = src;
  for (let i = 0; i < n; i++) {
    const size = i < m ? wl : wl + 2;
    const next = boxBlur(cur, w, h, (size - 1) / 2);
    cur = next;
  }
  return cur;
}

/** Medianul pe un pătrat de rază r, cu histograme care alunecă pe rând (algoritmul lui Huang). Alfa rămâne. */
export function medianFilter(src: Px, w: number, h: number, r: number): Px {
  r = Math.max(1, Math.round(r));
  const out = src.slice(), hist = new Uint16Array(768), half = ((2 * r + 1) * (2 * r + 1)) >> 1;
  const m = [0, 0, 0], lt = [0, 0, 0];
  const col = (x: number, y: number, sign: 1 | -1) => {
    const xi = clampI(x, w - 1) * 4;
    for (let k = -r; k <= r; k++) {
      const i = clampI(y + k, h - 1) * w * 4 + xi;
      for (let c = 0; c < 3; c++) {
        const v = src[i + c];
        hist[c * 256 + v] += sign;
        if (v < m[c]) lt[c] += sign;
      }
    }
  };
  for (let y = 0; y < h; y++) {
    hist.fill(0);
    m[0] = m[1] = m[2] = 0; lt[0] = lt[1] = lt[2] = 0;
    for (let k = -r; k <= r; k++) col(k, y, 1);
    for (let x = 0; x < w; x++) {
      if (x > 0) { col(x - r - 1, y, -1); col(x + r, y, 1); }
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const H = c * 256;
        while (lt[c] > half) { m[c]--; lt[c] -= hist[H + m[c]]; }
        while (lt[c] + hist[H + m[c]] <= half) { lt[c] += hist[H + m[c]]; m[c]++; }
        out[o + c] = m[c];
      }
    }
  }
  return out;
}

/** Maxim / minim pe un pătrat de rază r (pe orizontală, apoi pe verticală). */
function maxMin(src: Px, w: number, h: number, r: number, max: boolean): Px {
  r = Math.max(1, Math.round(r));
  const pick = max ? Math.max : Math.min;
  const pass = (a: Px, horiz: boolean) => {
    const b = a.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let v = a[o + c];
        for (let k = -r; k <= r; k++) {
          const i = horiz ? (y * w + clampI(x + k, w - 1)) * 4 : (clampI(y + k, h - 1) * w + x) * 4;
          v = pick(v, a[i + c]);
        }
        b[o + c] = v;
      }
    }
    return b;
  };
  return pass(pass(src, true), false);
}

/** Citește culoarea dintre pixeli (biliniar), cu marginea repetată. */
function sample(src: Px, w: number, h: number, x: number, y: number, out: Px, o: number) {
  x = x < 0 ? 0 : x > w - 1 ? w - 1 : x;
  y = y < 0 ? 0 : y > h - 1 ? h - 1 : y;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4;
  for (let k = 0; k < 4; k++) {
    const top = src[a + k] + (src[b + k] - src[a + k]) * fx, bot = src[c + k] + (src[d + k] - src[c + k]) * fx;
    out[o + k] = top + (bot - top) * fy;
  }
}

/** Deformările: pentru fiecare pixel din rezultat, map(x, y) spune de unde se ia culoarea. */
function warp(src: Px, w: number, h: number, map: (x: number, y: number) => [number, number] | null): Px {
  const out = src.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = map(x, y);
    if (s) sample(src, w, h, s[0], s[1], out, (y * w + x) * 4);
  }
  return out;
}

/**
 * Unghi larg adaptiv (Adaptive Wide Angle): poza se desface după felul obiectivului, din mijloc. Focala e în mm pe un
 * senzor de 35 mm (diagonala 43,27 mm = diagonala pozei). Rezultatul e mereu proiecția dreaptă (linii drepte), în afară de
 * „Perspectivă”, unde poza dreaptă de unghi larg devine stereografică (oamenii de la margini nu mai sunt lățiți).
 */
function wideAngle(src: Px, w: number, h: number, v: Record<string, number>): Px {
  const cx = (w - 1) / 2, cy = (h - 1) / 2, F = (Math.max(1, v.f) / 43.27) * Math.hypot(w, h);
  const sc = Math.max(0.1, (v.sc ?? 100) / 100), tp = Math.round(v.tp ?? 0), clear = !!v.edge;
  const out = src.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - cx) / sc, dy = (y - cy) / sc, o = (y * w + x) * 4;
    let sx: number, sy: number;
    if (tp === 2) {
      // Panoramă cilindrică: unghiul orizontal se întinde pe lățime, înălțimea scade spre margini.
      const q = Math.hypot(dx, F);
      sx = cx + F * Math.atan2(dx, F); sy = cy + (dy * F) / q;
    } else {
      const r = Math.hypot(dx, dy);
      let k = 1;
      if (r > 1e-9) {
        if (tp === 0) k = (F * Math.atan(r / F)) / r; // ochi de pește (unghi egal, rază egală) → drept
        else {
          const th = 2 * Math.atan(r / (2 * F)); // drept → stereografic
          k = th < Math.PI / 2 - 1e-3 ? (F * Math.tan(th)) / r : 1e6; // dincolo de 90°: departe în afara pozei
        }
      }
      sx = cx + dx * k; sy = cy + dy * k;
    }
    if (clear && (sx < -0.5 || sy < -0.5 || sx > w - 0.5 || sy > h - 0.5)) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue; }
    sample(src, w, h, sx, sy, out, o);
  }
  return out;
}

/** Deformările rotunde (ciupire, vârtej, sferă) lucrează în cercul din mijlocul pozei. */
function radialWarp(src: Px, w: number, h: number, f: (d: number) => { scale?: number; rot?: number }): Px {
  const cx = (w - 1) / 2, cy = (h - 1) / 2, rad = Math.min(w, h) / 2;
  return warp(src, w, h, (x, y) => {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) / rad;
    if (d >= 1 || d === 0) return null;
    const { scale = 1, rot = 0 } = f(d);
    const c = Math.cos(rot), s = Math.sin(rot);
    return [cx + (dx * c - dy * s) * scale, cy + (dx * s + dy * c) * scale];
  });
}

const lum = (d: Px, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** Pseudo-aleator cu sămânță: același zgomot la fiecare aplicare. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Celule (Voronoi) pe o grilă de mărime s, cu câte un punct pus la întâmplare în fiecare: eticheta celulei fiecărui pixel. */
function cells(w: number, h: number, s: number) {
  const gx = Math.ceil(w / s), gy = Math.ceil(h / s), rand = rng(777), sx = new Float32Array(gx * gy), sy = new Float32Array(gx * gy);
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { sx[j * gx + i] = (i + rand()) * s; sy[j * gx + i] = (j + rand()) * s; }
  const label = new Int32Array(w * h), dist = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ci = Math.floor(x / s), cj = Math.floor(y / s);
    let best = -1, bd = Infinity;
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      if (i < 0 || j < 0 || i >= gx || j >= gy) continue;
      const k = j * gx + i, d = (x - sx[k]) ** 2 + (y - sy[k]) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    label[y * w + x] = best;
    dist[y * w + x] = Math.sqrt(bd);
  }
  return { label, dist, n: gx * gy };
}

/** Culoarea medie a fiecărei celule. */
function cellMeans(src: Px, label: Int32Array, n: number) {
  const sum = new Float64Array(n * 4), cnt = new Uint32Array(n);
  for (let p = 0; p < label.length; p++) { const k = label[p]; cnt[k]++; for (let c = 0; c < 4; c++) sum[k * 4 + c] += src[p * 4 + c]; }
  for (let k = 0; k < n; k++) if (cnt[k]) for (let c = 0; c < 4; c++) sum[k * 4 + c] /= cnt[k];
  return sum;
}

/** Nori: zgomot de valoare pe 6 octave (0…1); size = mărimea celor mai mari pete, în pixeli. */
function cloudNoise(w: number, h: number, size: number): Float32Array {
  const hash = (x: number, y: number, o: number) => {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(o, 1442695041)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const sm = (t: number) => t * t * (3 - 2 * t);
  const out = new Float32Array(w * h), oct = 6;
  let norm = 0;
  for (let o = 0; o < oct; o++) norm += 0.5 ** o;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let o = 0; o < oct; o++) {
      const f = 2 ** o / Math.max(1, size), X = x * f, Y = y * f, ix = Math.floor(X), iy = Math.floor(Y), tx = sm(X - ix), ty = sm(Y - iy);
      const a = hash(ix, iy, o), b = hash(ix + 1, iy, o), c = hash(ix, iy + 1, o), d = hash(ix + 1, iy + 1, o);
      v += (0.5 ** o) * (a + (b - a) * tx + (c + (d - c) * tx - a - (b - a) * tx) * ty);
    }
    out[y * w + x] = v / norm;
  }
  return out;
}

/** Estompare care păstrează marginile: vecinii care diferă mult contează puțin (sau deloc, la cea inteligentă). */
function edgeBlur(src: Px, w: number, h: number, r: number, t: number, smart: boolean, mode = 0): Px {
  r = Math.max(1, Math.round(r));
  const st = Math.max(1, Math.round(r / 3)), out = src.slice(), lim = smart ? t * 2.55 : 2.5 * t;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, L = lum(src, o);
    const acc = [0, 0, 0], ws = [0, 0, 0];
    for (let dy = -r; dy <= r; dy += st) for (let dx = -r; dx <= r; dx += st) {
      const i = (clampI(y + dy, h - 1) * w + clampI(x + dx, w - 1)) * 4;
      if (smart) {
        if (Math.abs(lum(src, i) - L) > lim) continue;
        for (let c = 0; c < 3; c++) { acc[c] += src[i + c]; ws[c]++; }
      } else for (let c = 0; c < 3; c++) {
        const wt = 1 - Math.abs(src[i + c] - src[o + c]) / lim;
        if (wt > 0) { acc[c] += wt * src[i + c]; ws[c] += wt; }
      }
    }
    for (let c = 0; c < 3; c++) if (ws[c]) out[o + c] = acc[c] / ws[c];
    // Modurile Smart Blur: marginea = vecinul din dreapta sau de jos diferă peste prag (linie de 1 px).
    if (mode) {
      const edge = (x + 1 < w && Math.abs(lum(src, o + 4) - L) > lim) || (y + 1 < h && Math.abs(lum(src, o + w * 4) - L) > lim);
      if (edge) out[o] = out[o + 1] = out[o + 2] = 255;
      else if (mode === 1) out[o] = out[o + 1] = out[o + 2] = 0;
    }
  }
  return out;
}

/** Forma valului (faza în radiani): sinus, triunghi sau pătrat, toate între -1 și 1. */
function waveShape(kind: number, a: number): number {
  const s = Math.sin(a);
  if (kind === 1) return (2 / Math.PI) * Math.asin(s);
  if (kind === 2) return s >= 0 ? 1 : -1;
  return s;
}

/**
 * Aplică filtrul pe pixelii dați (RGBA, w × h) și întoarce pixelii noi.
 * k = cât de micșorată e poza (pe ecran, la previzualizare): valorile în pixeli se micșorează la fel.
 */
/**
 * Harta aleasă din fișier pentru Deplasare (Harta = „Din fișier”): pixelii ei RGBA și mărimea. Se întinde peste toată poza
 * (sau peste selecție), ca harta „întinsă” din programele mari. Fără hartă aleasă, „Din fișier” nu mută nimic.
 */
let displaceMap: { d: Uint8ClampedArray; w: number; h: number } | null = null;
export function setDisplaceMap(m: { d: Uint8ClampedArray; w: number; h: number } | null) { displaceMap = m; }
export const hasDisplaceMap = () => !!displaceMap;

/** Culorile luminii la Efecte de lumină (aceeași ordine ca în listă). */
const LIGHT_COLORS: [number, number, number][] = [[1, 1, 1], [1, 0.86, 0.66], [0.72, 0.84, 1], [1, 0.45, 0.4], [0.5, 1, 0.55], [0.45, 0.6, 1]];

/**
 * Reducere zgomot → reglajele pe canale și Clarifică detaliile: în pozele de seară zgomotul e de obicei mai tare pe un canal
 * (albastrul); acel canal se netezește separat, cu marginile păstrate, fără să atingă celelalte. La final, detaliile fine
 * pierdute se readuc printr-o mască de claritate mică, doar pe luminozitate (fără margini colorate).
 */
function noiseAdvanced(out: Px, w: number, h: number, v: Record<string, number>, k: number) {
  const amts = [v.cr, v.cg, v.cb];
  if (amts.some((a) => a > 0)) {
    const sm = edgeBlur(out, w, h, Math.max(1, 2 * k), 40, false);
    for (let c = 0; c < 3; c++) {
      const a = (amts[c] || 0) / 100;
      if (a > 0) for (let i = c; i < out.length; i += 4) out[i] = out[i] + (sm[i] - out[i]) * a;
    }
  }
  if (v.sd > 0) {
    const bl = gaussBlur(out, w, h, Math.max(0.6, k)), amt = (v.sd / 100) * 1.5;
    for (let i = 0; i < out.length; i += 4) {
      const d = ((out[i] - bl[i]) * 0.299 + (out[i + 1] - bl[i + 1]) * 0.587 + (out[i + 2] - bl[i + 2]) * 0.114) * amt;
      out[i] += d; out[i + 1] += d; out[i + 2] += d;
    }
  }
}

/** Formele diafragmei la Estomparea de obiectiv: numărul de lamele (0 = cerc). */
const IRIS_BLADES = [0, 3, 4, 5, 6, 7, 8];

/** Estompare de obiectiv (Lens Blur): discul (sau poligonul) diafragmei, cu lamele rotite și rotunjite. */
function lensBlur(src: Px, w: number, h: number, v: Record<string, number>): Px {
  const R = Math.max(1, Math.round(v.r)), g = 1 + (v.hi / 100) * 2, lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) lin[i] = (i / 255) ** g;
  const N = IRIS_BLADES[Math.max(0, Math.min(IRIS_BLADES.length - 1, Math.round(v.sh ?? 0)))], rot = ((v.rot ?? 0) * Math.PI) / 180, curv = (v.cv ?? 0) / 100;
  // Pe fiecare rând al formei, pixelii din ea sunt o bucată continuă (forma e convexă), deci se adună cu sume pe rânduri.
  // Luminile se întăresc înainte (ca să iasă pete luminoase cu forma diafragmei) și se readuc după.
  const blurAt = (r: number): Px => {
    const out = src.slice();
    if (r < 1) return out;
    // Raza poligonului cu N colțuri pe direcția t (cercul circumscris are raza r); lamelele rotunjite o împing spre cerc.
    const inside = (dx: number, dy: number) => {
      const d = Math.hypot(dx, dy);
      if (!N) return d <= r + 0.001;
      const seg = (2 * Math.PI) / N, t = Math.atan2(dy, dx) - rot - Math.PI / 2, m = ((t % seg) + seg) % seg;
      const rp = (r * Math.cos(Math.PI / N)) / Math.cos(m - Math.PI / N);
      return d <= rp * (1 - curv) + r * curv + 0.001;
    };
    const lo: number[] = [], hi: number[] = [];
    for (let j = 0; j <= 2 * r; j++) {
      let a = 1, e = -1;
      for (let dx = -r; dx <= r; dx++) if (inside(dx, j - r)) { if (a > e) a = dx; e = dx; }
      lo.push(a); hi.push(e);
    }
    const pre = new Float64Array((w + 1) * h);
    for (let c = 0; c < 3; c++) {
      for (let y = 0; y < h; y++) {
        const b = y * (w + 1);
        pre[b] = 0;
        for (let x = 0; x < w; x++) pre[b + x + 1] = pre[b + x] + lin[src[(y * w + x) * 4 + c]];
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let s = 0, n = 0;
        for (let j = 0; j <= 2 * r; j++) {
          const yy = y + j - r;
          if (yy < 0 || yy >= h || lo[j] > hi[j]) continue;
          const a = Math.max(0, x + lo[j]), e = Math.min(w - 1, x + hi[j]);
          if (a > e) continue;
          const b = yy * (w + 1);
          s += pre[b + e + 1] - pre[b + a]; n += e - a + 1;
        }
        out[(y * w + x) * 4 + c] = n ? 255 * (s / n) ** (1 / g) : src[(y * w + x) * 4 + c];
      }
    }
    return out;
  };
  const dm = Math.round(v.dm ?? 0);
  let out: Px;
  if (!dm) out = blurAt(R);
  else {
    // Harta de adâncime (0 = aproape, 1 = departe): cât de departe e fiecare pixel de planul clar dă raza lui.
    // Se estompează pe 4 trepte de rază și fiecare pixel ia amestecul dintre cele două trepte vecine.
    const depth = (y: number, o: number) =>
      dm === 1 ? 1 - y / Math.max(1, h - 1) : dm === 2 ? y / Math.max(1, h - 1)
        : dm === 3 ? (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255
          : 1 - (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255;
    const fz = (v.fz ?? 50) / 100, span = Math.max(fz, 1 - fz, 0.01), K = 4;
    const lv: Px[] = [src];
    for (let k = 1; k <= K; k++) lv.push(blurAt(Math.round((R * k) / K)));
    out = src.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, p = Math.min(1, Math.abs(depth(y, o) - fz) / span) * K, k0 = Math.floor(p), k1 = Math.min(K, k0 + 1), t = p - k0;
      for (let c = 0; c < 3; c++) out[o + c] = lv[k0][o + c] * (1 - t) + lv[k1][o + c] * t;
    }
  }
  // Zgomotul: estomparea șterge granulația pozei; aici se pune înapoi (uniform, la fel pe toată poza).
  const nz = (v.nz ?? 0) * 0.6;
  if (nz > 0) {
    const rand = rng(4242), mono = !!v.nm;
    for (let o = 0; o < out.length; o += 4) {
      const n0 = (rand() - 0.5) * 2 * nz;
      for (let c = 0; c < 3; c++) out[o + c] = out[o + c] + (mono ? n0 : c ? (rand() - 0.5) * 2 * nz : n0);
    }
  }
  return out;
}

/** Efecte de lumină (Lighting Effects): punct / reflector / lumină de departe, culoare, a doua lumină și relief din poză. */
function lightingFx(src: Px, w: number, h: number, v: Record<string, number>): Px {
  const D = Math.hypot(w, h), R = Math.max(1, (v.r / 100) * D * 0.5), amb = v.amb / 100, I = v.i / 100, out = src.slice();
  const tp = Math.round(v.tp ?? 0), a = ((v.ang ?? 0) * Math.PI) / 180, ca = Math.cos(a), sa = -Math.sin(a), tex = (v.tex ?? 0) / 100;
  const col = LIGHT_COLORS[Math.max(0, Math.min(LIGHT_COLORS.length - 1, Math.round(v.col ?? 0)))];
  // Fiecare lumină: poziția și culoarea; a doua are aceeași mărime și același tip, culoarea albă.
  const lights: [number, number, [number, number, number]][] = [[(v.x / 100) * w, (v.y / 100) * h, col]];
  if (v.two) lights.push([((v.x2 ?? 75) / 100) * w, ((v.y2 ?? 60) / 100) * h, [1, 1, 1]]);
  // Relieful: lumina pozei e înălțimea suprafeței; panta ei înclină suprafața spre lumină sau în umbră.
  let hgt: Float32Array | null = null;
  if (tex > 0) {
    hgt = new Float32Array(w * h);
    for (let i = 0, o = 0; i < w * h; i++, o += 4) hgt[i] = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255;
  }
  const zh = R * 0.5, k = tex * 12;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let nx = 0, ny = 0, nz = 1;
    if (hgt) {
      const i = y * w + x, l = hgt[x > 0 ? i - 1 : i], r = hgt[x < w - 1 ? i + 1 : i], u = hgt[y > 0 ? i - w : i], d = hgt[y < h - 1 ? i + w : i];
      nx = -(r - l) * k; ny = -(d - u) * k;
      const n = Math.hypot(nx, ny, 1); nx /= n; ny /= n; nz = 1 / n;
    }
    let fr = amb, fg = amb, fb = amb;
    for (const [lx, ly, c] of lights) {
      let fall: number, Lx: number, Ly: number, Lz: number;
      if (tp === 2) {
        // Lumină de departe (ca soarele): la fel peste tot, vine din unghiul ales.
        fall = 1; Lx = ca * 0.7; Ly = sa * 0.7; Lz = 0.7;
      } else {
        const dx = x - lx, dy = y - ly;
        let dd: number;
        if (tp === 1) {
          // Reflector: elipsă lungă în direcția unghiului, de 2,2 ori mai lungă decât lată.
          const along = dx * ca + dy * sa, across = -dx * sa + dy * ca;
          dd = (along / R) ** 2 + (across / (R * 0.45)) ** 2;
        } else dd = (dx * dx + dy * dy) / (R * R);
        fall = Math.max(0, 1 - dd);
        const n = Math.hypot(dx, dy, zh); Lx = -dx / n; Ly = -dy / n; Lz = zh / n;
      }
      if (fall <= 0) continue;
      // Pe o suprafață dreaptă umbrirea e 1 (ca fără relief); pantele spre lumină trec de 1, cele din spate scad spre 0.
      const shade = hgt ? Math.min(2, Math.max(0, nx * Lx + ny * Ly + nz * Lz) / Math.max(0.2, Lz)) : 1, f = I * fall * shade;
      fr += f * c[0]; fg += f * c[1]; fb += f * c[2];
    }
    const o = (y * w + x) * 4;
    out[o] = src[o] * fr; out[o + 1] = src[o + 1] * fg; out[o + 2] = src[o + 2] * fb;
  }
  return out;
}

/** Estompare pe drum (Path Blur), din parametrii filtrului. */
function pathBlur(src: Px, w: number, h: number, v: Record<string, number>): Px {
  // Drumul e o curbă cu un cot (Bézier pătratică). Fiecare pixel se estompează de-a lungul direcției celui mai apropiat
  // punct de pe drum; direcția se calculează pe o grilă de 8 px și se netezește între noduri, ca să meargă repede.
  const P = [[v.x0, v.y0], [v.cx, v.cy], [v.x1, v.y1]].map(([a, b]) => [(a / 100) * (w - 1), (b / 100) * (h - 1)]);
  const N = 64, bx = new Float64Array(N + 1), by = new Float64Array(N + 1), tx = new Float64Array(N + 1), ty = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    bx[i] = u * u * P[0][0] + 2 * u * t * P[1][0] + t * t * P[2][0];
    by[i] = u * u * P[0][1] + 2 * u * t * P[1][1] + t * t * P[2][1];
    let dx = 2 * u * (P[1][0] - P[0][0]) + 2 * t * (P[2][0] - P[1][0]), dy = 2 * u * (P[1][1] - P[0][1]) + 2 * t * (P[2][1] - P[1][1]);
    const l = Math.hypot(dx, dy);
    if (l < 1e-9) { dx = P[2][0] - P[0][0]; dy = P[2][1] - P[0][1]; }
    const L = Math.hypot(dx, dy) || 1;
    tx[i] = dx / L; ty[i] = dy / L;
  }
  const G = 8, gw = Math.ceil(w / G) + 1, gh = Math.ceil(h / G) + 1, gx = new Float32Array(gw * gh), gy = new Float32Array(gw * gh);
  const taper = v.tp / 100;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const px = i * G, py = j * G;
    let best = 0, bd = Infinity;
    for (let q = 0; q <= N; q++) { const d = (bx[q] - px) ** 2 + (by[q] - py) ** 2; if (d < bd) { bd = d; best = q; } }
    const len = v.r * (1 - taper * (best / N));
    gx[j * gw + i] = tx[best] * len; gy[j * gw + i] = ty[best] * len;
  }
  if (v.r < 1) return src.slice();
  const out = src.slice(), tmp = new Uint8ClampedArray(4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / G, fy = y / G, i0 = Math.floor(fx), j0 = Math.floor(fy), ax = fx - i0, ay = fy - j0;
    const k00 = j0 * gw + i0, k10 = k00 + 1, k01 = k00 + gw, k11 = k01 + 1;
    const dx = (gx[k00] * (1 - ax) + gx[k10] * ax) * (1 - ay) + (gx[k01] * (1 - ax) + gx[k11] * ax) * ay;
    const dy = (gy[k00] * (1 - ax) + gy[k10] * ax) * (1 - ay) + (gy[k01] * (1 - ax) + gy[k11] * ax) * ay;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    const n = Math.max(2, Math.min(24, Math.round(len) + 1));
    let r = 0, g = 0, b = 0, al = 0;
    for (let q = 0; q < n; q++) {
      const t = q / (n - 1) - 0.5;
      sample(src, w, h, x + dx * t, y + dy * t, tmp, 0);
      r += tmp[0]; g += tmp[1]; b += tmp[2]; al += tmp[3];
    }
    const o = (y * w + x) * 4;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = al / n;
  }
  return out;
}

/** Pătrățelele de la JPEG: la marginile blocurilor de 8 px, o treaptă mică (nu o margine adevărată) se întinde lin pe 4 pixeli. */
function jpegDeblock(out: Px, w: number, h: number) {
  const T = 28, step = (o: number, d: number) => {
    for (let c = 0; c < 3; c++) {
      const a = out[o - d + c], b = out[o + c], e = out[o + d + c], f = out[o + 2 * d + c], dl = e - b;
      if (!dl || Math.abs(dl) >= T || Math.abs(b - a) >= T / 2 || Math.abs(f - e) >= T / 2) continue;
      out[o - d + c] = a + dl / 8; out[o + c] = b + (3 * dl) / 8; out[o + d + c] = e - (3 * dl) / 8; out[o + 2 * d + c] = f - dl / 8;
    }
  };
  for (let y = 0; y < h; y++) for (let x = 7; x + 2 < w; x += 8) step((y * w + x) * 4, 4);
  for (let y = 7; y + 2 < h; y += 8) for (let x = 0; x < w; x++) step((y * w + x) * 4, w * 4);
}

/** Zgomotul de culoare: petele colorate se estompează doar în culoare; lumina (și deci detaliile) rămâne a pozei. */
function chromaDenoise(out: Px, w: number, h: number, col: number, k: number) {
  const ch = new Uint8ClampedArray(out.length), Y = new Float32Array(w * h);
  for (let p = 0, i = 0; p < Y.length; p++, i += 4) {
    const l = out[i] * 0.299 + out[i + 1] * 0.587 + out[i + 2] * 0.114;
    Y[p] = l; ch[i] = out[i] - l + 128; ch[i + 1] = out[i + 1] - l + 128; ch[i + 2] = out[i + 2] - l + 128; ch[i + 3] = 255;
  }
  const bl = gaussBlur(ch, w, h, Math.max(1, (1 + col / 15) * k)), m = col / 100;
  for (let p = 0, i = 0; p < Y.length; p++, i += 4) for (let c = 0; c < 3; c++) out[i + c] = Y[p] + (ch[i + c] + (bl[i + c] - ch[i + c]) * m) - 128;
}

export function filterPixels(src: Px, w: number, h: number, id: FilterId, p: Record<string, number>, k = 1): Px {
  const def = filterDef(id);
  const v: Record<string, number> = {};
  for (const q of def.params) v[q.key] = (p[q.key] ?? q.def) * (q.px ? k : 1);
  if (w < 1 || h < 1) return src.slice();
  switch (id) {
    case 'gauss': return gaussBlur(src, w, h, v.r);
    case 'box': return boxBlur(src, w, h, v.r);
    case 'shake': return shakeReduce(src, w, h, v.auto ? guessShakeAngle(src, w, h) : v.a, v.r, Math.round(v.n));
    case 'motion': {
      const a = (v.a * Math.PI) / 180, dist = v.r, n = Math.max(2, Math.min(31, Math.round(dist) + 1));
      if (dist < 1) return src.slice();
      const offs: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1) - 0.5) * dist;
        offs.push([Math.round(Math.cos(a) * t), Math.round(-Math.sin(a) * t)]);
      }
      const out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, al = 0;
        for (const [ox, oy] of offs) {
          const i = (clampI(y + oy, h - 1) * w + clampI(x + ox, w - 1)) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; al += src[i + 3];
        }
        const o = (y * w + x) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = al / n;
      }
      return out;
    }
    case 'radial': {
      const cx = (w - 1) / 2, cy = (h - 1) / 2, amt = (v.v / 100) * 0.4, n = 16, out = src.slice(), tmp = new Uint8ClampedArray(4);
      // Rotirea (Spin): mostrele se iau pe un arc de cerc, până la 60° la tărie maximă.
      const spin = v.spin >= 0.5, turn = (v.v / 100) * (Math.PI / 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, al = 0;
        for (let i = 0; i < n; i++) {
          if (spin) {
            const t = (i / (n - 1) - 0.5) * turn, c = Math.cos(t), s = Math.sin(t), dx = x - cx, dy = y - cy;
            sample(src, w, h, cx + dx * c - dy * s, cy + dx * s + dy * c, tmp, 0);
          } else {
            const s = 1 - (amt * i) / (n - 1);
            sample(src, w, h, cx + (x - cx) * s, cy + (y - cy) * s, tmp, 0);
          }
          r += tmp[0]; g += tmp[1]; b += tmp[2]; al += tmp[3];
        }
        const o = (y * w + x) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = al / n;
      }
      return out;
    }
    case 'spinblur': {
      // Doar în cerc: mostre pe un arc în jurul centrului ales; spre marginea cercului efectul scade lin (Trecerea).
      const cx = (v.x / 100) * (w - 1), cy = (v.y / 100) * (h - 1), rad = Math.max(2, (v.s / 100) * Math.min(w, h) / 2);
      const turn = (v.a * Math.PI) / 180, soft = Math.max(1e-3, v.f / 100), out = src.slice(), tmp = new Uint8ClampedArray(4);
      const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(h - 1, Math.ceil(cy + rad));
      const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(w - 1, Math.ceil(cx + rad));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) / rad;
        if (d >= 1) continue;
        const k = d <= 1 - soft ? 1 : (1 - d) / soft;
        // Câte mostre: după lungimea arcului (lângă centru arcul e scurt, deci ajung puține).
        const n = Math.max(2, Math.min(24, Math.ceil((turn * k * d * rad) / 3)));
        let r = 0, g = 0, b = 0, al = 0;
        for (let i = 0; i < n; i++) {
          const t = (i / (n - 1) - 0.5) * turn * k, c = Math.cos(t), sn = Math.sin(t);
          sample(src, w, h, cx + dx * c - dy * sn, cy + dx * sn + dy * c, tmp, 0);
          r += tmp[0]; g += tmp[1]; b += tmp[2]; al += tmp[3];
        }
        const o = (y * w + x) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = al / n;
      }
      return out;
    }
    case 'pathblur': return pathBlur(src, w, h, v);
    case 'custom': {
      const kk = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => Math.round(v['k' + i] ?? 0)), sc = Math.max(1, Math.round(v.sc)), off = Math.round(v.off);
      const out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let j = 0; j < 9; j++) if (kk[j]) sum += kk[j] * src[(clampI(y + ((j / 3) | 0) - 1, h - 1) * w + clampI(x + (j % 3) - 1, w - 1)) * 4 + c];
          out[o + c] = sum / sc + off;
        }
      }
      return out;
    }
    case 'noise': {
      const out = src.slice(), rand = rng(12345), amp = v.v * 2.55, mono = v.mono >= 0.5;
      for (let i = 0; i < out.length; i += 4) {
        if (mono) {
          const n = (rand() - 0.5) * 2 * amp;
          out[i] = src[i] + n; out[i + 1] = src[i + 1] + n; out[i + 2] = src[i + 2] + n;
        } else for (let c = 0; c < 3; c++) out[i + c] = src[i + c] + (rand() - 0.5) * 2 * amp;
      }
      return out;
    }
    case 'median': return medianFilter(src, w, h, v.r);
    case 'sketch': {
      // Gri, apoi „color dodge” cu negativul estompat: zonele plate se albesc, marginile rămân linii de creion.
      const gray = src.slice();
      for (let i = 0; i < gray.length; i += 4) { const g = lum(src, i); gray[i] = gray[i + 1] = gray[i + 2] = 255 - g; }
      const b = gaussBlur(gray, w, h, Math.max(0.5, v.r));
      const out = src.slice(), gain = 1 + v.v / 25;
      for (let i = 0; i < out.length; i += 4) {
        const g = 255 - gray[i], inv = b[i];
        const d = inv >= 255 ? 255 : Math.min(255, (g * 255) / (255 - inv));
        const c = 255 - (255 - d) * gain;
        out[i] = out[i + 1] = out[i + 2] = c;
      }
      return out;
    }
    case 'cutout': {
      const m = medianFilter(src, w, h, Math.max(1, v.r));
      const n = Math.max(2, Math.round(v.n)), st = 255 / (n - 1);
      // Luminozitatea în n trepte, iar culoarea (cât se abate fiecare canal de la gri) în trepte mari: pete plate, cu nuanța păstrată.
      for (let i = 0; i < m.length; i += 4) {
        const L = lum(m, i), q = Math.round(L / st) * st;
        for (let c = 0; c < 3; c++) m[i + c] = q + Math.round((m[i + c] - L) / 28) * 28;
      }
      return m;
    }
    case 'watercolor': {
      // Pete moi (median + estompare ușoară), culorile puțin mai vii, marginile mai închise (ca pigmentul strâns la margine).
      const m = gaussBlur(medianFilter(src, w, h, Math.max(1, v.r)), w, h, Math.max(0.5, v.r / 5));
      const out = m.slice(), dark = v.v / 100;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const L = (dx: number, dy: number) => lum(m, (clampI(y + dy, h - 1) * w + clampI(x + dx, w - 1)) * 4);
        const e = Math.min(1, Math.hypot(L(1, 0) - L(-1, 0), L(0, 1) - L(0, -1)) / 28);
        const avg = (m[o] + m[o + 1] + m[o + 2]) / 3;
        for (let c = 0; c < 3; c++) out[o + c] = (avg + (m[o + c] - avg) * 1.25) * (1 - dark * 0.75 * e);
      }
      return out;
    }
    case 'canvas': {
      // Țesătura: ochiuri alternative, unele cu firele pe orizontală, altele pe verticală, luminate din stânga sus.
      const sz = Math.max(2, v.r), amp = (v.v / 100) * 45, out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const cx = Math.floor(x / sz), cy = Math.floor(y / sz);
        const u = ((cx + cy) & 1) ? x / sz - cx : y / sz - cy;
        const t = Math.sin(u * Math.PI) - 0.64;
        const o = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) out[o + c] = src[o + c] + amp * t;
      }
      return out;
    }
    case 'dust': {
      const med = medianFilter(src, w, h, v.r), out = src.slice();
      for (let i = 0; i < out.length; i += 4) {
        const diff = Math.max(Math.abs(src[i] - med[i]), Math.abs(src[i + 1] - med[i + 1]), Math.abs(src[i + 2] - med[i + 2]));
        if (diff > v.t) { out[i] = med[i]; out[i + 1] = med[i + 1]; out[i + 2] = med[i + 2]; }
      }
      return out;
    }
    case 'despeckle': {
      const bl = boxBlur(src, w, h, 1), out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const at = (dx: number, dy: number) => lum(src, (clampI(y + dy, h - 1) * w + clampI(x + dx, w - 1)) * 4);
        const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
        const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
        if (Math.hypot(gx, gy) < 60) { const o = (y * w + x) * 4; out[o] = bl[o]; out[o + 1] = bl[o + 1]; out[o + 2] = bl[o + 2]; }
      }
      return out;
    }
    case 'unsharp': {
      const bl = gaussBlur(src, w, h, v.r), out = src.slice(), amt = v.v / 100;
      for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) {
        const d = src[i + c] - bl[i + c];
        if (Math.abs(d) >= v.t) out[i + c] = src[i + c] + amt * d;
      }
      return out;
    }
    case 'smartsharpen': {
      // Doar luminozitatea se clarifică (culorile nu capătă margini colorate); diferențele mici (zgomotul) se ignoră treptat,
      // iar schimbarea e limitată, ca marginile tari să nu capete contur alb / negru.
      const bl = gaussBlur(src, w, h, v.r), out = src.slice(), amt = v.v / 100, noise = (v.n / 100) * 12, lim = v.halo;
      for (let i = 0; i < out.length; i += 4) {
        const d = lum(src, i) - lum(bl, i), ad = Math.abs(d);
        if (ad <= noise) continue;
        const ch = Math.max(-lim, Math.min(lim, amt * Math.sign(d) * (ad - noise)));
        out[i] = src[i] + ch; out[i + 1] = src[i + 1] + ch; out[i + 2] = src[i + 2] + ch;
      }
      return out;
    }
    case 'facet': {
      // Kuwahara: din cele patru pătrate din jurul pixelului îl alege pe cel mai uniform și îi ia culoarea medie.
      const r = Math.max(1, Math.round(v.r)), out = src.slice();
      // Sume pe arii (sumed-area tables) pentru medie și pătratul luminozității, ca pătratele să coste la fel la orice rază.
      const W = w + 1, S = [0, 1, 2].map(() => new Float64Array(W * (h + 1))), Q = new Float64Array(W * (h + 1));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4, a = (y + 1) * W + x + 1, L = lum(src, o);
        for (let c = 0; c < 3; c++) S[c][a] = src[o + c] + S[c][a - 1] + S[c][a - W] - S[c][a - W - 1];
        Q[a] = L * L + Q[a - 1] + Q[a - W] - Q[a - W - 1];
      }
      const sum = (T: Float64Array, x0: number, y0: number, x1: number, y1: number) => T[(y1 + 1) * W + x1 + 1] - T[y0 * W + x1 + 1] - T[(y1 + 1) * W + x0] + T[y0 * W + x0];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let best = Infinity, m = [0, 0, 0];
        for (const [sx, sy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const x0 = clampI(x + sx * r, w - 1), y0 = clampI(y + sy * r, h - 1), x1 = clampI(x0 + r, w - 1), y1 = clampI(y0 + r, h - 1);
          const n = (x1 - x0 + 1) * (y1 - y0 + 1);
          const mr = sum(S[0], x0, y0, x1, y1) / n, mg = sum(S[1], x0, y0, x1, y1) / n, mb = sum(S[2], x0, y0, x1, y1) / n;
          const ml = 0.299 * mr + 0.587 * mg + 0.114 * mb, varL = sum(Q, x0, y0, x1, y1) / n - ml * ml;
          if (varL < best) { best = varL; m = [mr, mg, mb]; }
        }
        const o = (y * w + x) * 4;
        out[o] = m[0]; out[o + 1] = m[1]; out[o + 2] = m[2];
      }
      return out;
    }
    case 'frame': {
      // Distanța până la cea mai apropiată margine hotărăște ce se vede: rama (d < B) sau poza. Colțurile sunt tăiate în unghi,
      // ca la ramele adevărate: fiecare pixel ține de latura cea mai apropiată, iar lemnul are fibrele de-a lungul ei.
      const out = src.slice(), B = Math.max(1, (v.wd / 100) * Math.min(w, h)), st = Math.round(v.style);
      const col = FRAME_COLORS[Math.max(0, Math.min(FRAME_COLORS.length - 1, Math.round(v.col)))][1];
      const lum = (c: readonly number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      const gap: [number, number, number] = lum(col) > 140 ? [40, 40, 40] : [245, 242, 235];
      const hash = (a: number) => { const t = Math.sin(a * 127.1) * 43758.5453; return t - Math.floor(t); };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dl = x, dr = w - 1 - x, dt = y, db = h - 1 - y, d = Math.min(dl, dr, dt, db);
        if (d >= B) continue;
        const t = d / B, o = (y * w + x) * 4;
        // De-a lungul laturii (pentru fibrele lemnului) și latura (pentru lumina venită din stânga sus).
        const horiz = d === dt || d === db, along = horiz ? x : y, side = d === dt || d === dl ? 1 : -1;
        let c: number[] | null = null;
        if (st === 0) c = [...col];
        else if (st === 1) c = t < 0.4 || (t >= 0.65 && t < 0.8) ? [...col] : t < 0.65 ? [...gap] : null;
        else if (st === 2) {
          const grain = 0.82 + 0.12 * Math.sin(d * 1.7 + 6 * hash(Math.floor(d / 3) + 0.5) + along * 0.015) + 0.06 * hash(along * 0.37 + d * 3.1);
          const bevel = 1 + 0.25 * side * (t < 0.15 ? 1 : t > 0.85 ? -1 : 0);
          c = [128 * grain * bevel, 80 * grain * bevel, 42 * grain * bevel];
        } else if (st === 3) {
          const sh = 0.7 + 0.3 * Math.cos(t * Math.PI * 3) + 0.12 * side * Math.cos(t * Math.PI);
          c = [230 * sh, 185 * sh, 70 * sh];
        } else if (st === 4) {
          if (t < 0.3) c = [...col].map((k) => k * (1 + 0.15 * side));
          else if (t > 0.94) c = [gap[0] * 0.8, gap[1] * 0.8, gap[2] * 0.8];
          else c = lum(col) > 200 ? [235, 232, 225] : [245, 242, 235];
        } else {
          // Margine albă estompată: poza se pierde în alb spre margini.
          const k = t * t * (3 - 2 * t);
          for (let q = 0; q < 3; q++) out[o + q] = src[o + q] * k + 255 * (1 - k);
          out[o + 3] = 255;
          continue;
        }
        if (!c) continue;
        out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
      }
      return out;
    }
    case 'fibers': {
      // Fiecare coloană are o fibră: zgomot întins pe verticală (cu cât e mai tare, cu atât fibrele sunt mai lungi), gri.
      const rand = rng(1000 + Math.round(v.seed) * 7919), out = src.slice(), len = Math.max(1, Math.round(v.s * 4));
      const base = Array.from({ length: w }, () => 128 + (rand() - 0.5) * v.var * 4);
      for (let x = 1; x < w; x++) base[x] = base[x] * 0.6 + base[x - 1] * 0.4;
      for (let x = 0; x < w; x++) {
        let cur = base[x], target = base[x];
        for (let y = 0; y < h; y++) {
          if (y % len === 0) target = base[x] + (rand() - 0.5) * v.var * 3;
          cur += (target - cur) / len;
          const o = (y * w + x) * 4;
          out[o] = out[o + 1] = out[o + 2] = cur;
          out[o + 3] = 255;
        }
      }
      return out;
    }
    case 'highpass': {
      const bl = gaussBlur(src, w, h, v.r), out = src.slice();
      for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) out[i + c] = 128 + src[i + c] - bl[i + c];
      return out;
    }
    case 'emboss': {
      const a = (v.a * Math.PI) / 180, hgt = Math.max(1, v.r), amt = v.v / 100, out = src.slice();
      const ox = Math.round(Math.cos(a) * hgt), oy = Math.round(-Math.sin(a) * hgt);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p1 = lum(src, (clampI(y - oy, h - 1) * w + clampI(x - ox, w - 1)) * 4);
        const p2 = lum(src, (clampI(y + oy, h - 1) * w + clampI(x + ox, w - 1)) * 4);
        const g = 128 + (p2 - p1) * amt, o = (y * w + x) * 4;
        out[o] = out[o + 1] = out[o + 2] = g;
      }
      return out;
    }
    case 'edges': {
      const out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const at = (dx: number, dy: number) => src[(clampI(y + dy, h - 1) * w + clampI(x + dx, w - 1)) * 4 + c];
          const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
          const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
          out[o + c] = 255 - Math.hypot(gx, gy) / 2;
        }
      }
      return out;
    }
    case 'solarize': {
      const out = src.slice();
      for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) if (src[i + c] > 127) out[i + c] = 255 - src[i + c];
      return out;
    }
    case 'mosaic': {
      const s = Math.max(1, Math.round(v.r)), out = src.slice();
      for (let by = 0; by < h; by += s) for (let bx = 0; bx < w; bx += s) {
        const ex = Math.min(w, bx + s), ey = Math.min(h, by + s), acc = [0, 0, 0, 0];
        for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) { const i = (y * w + x) * 4; for (let c = 0; c < 4; c++) acc[c] += src[i + c]; }
        const n = (ex - bx) * (ey - by);
        for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) { const i = (y * w + x) * 4; for (let c = 0; c < 4; c++) out[i + c] = acc[c] / n; }
      }
      return out;
    }
    case 'average': {
      // Media se face doar pe pixelii care se văd (cei transparenți nu trag culoarea spre negru).
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < src.length; i += 4) { const a = src[i + 3]; r += src[i] * a; g += src[i + 1] * a; b += src[i + 2] * a; n += a; }
      const out = src.slice();
      if (!n) return out;
      for (let i = 0; i < out.length; i += 4) { out[i] = r / n; out[i + 1] = g / n; out[i + 2] = b / n; }
      return out;
    }
    case 'pinch': {
      const amt = v.v / 100;
      if (!amt) return src.slice();
      return radialWarp(src, w, h, (d) => ({ scale: Math.pow(Math.sin((Math.PI / 2) * d), -amt) }));
    }
    case 'twirl': {
      const a = (v.a * Math.PI) / 180;
      if (!a) return src.slice();
      return radialWarp(src, w, h, (d) => ({ rot: a * (1 - d) * (1 - d) }));
    }
    case 'spherize': {
      const e = Math.exp((v.v / 100) * 0.7);
      if (!v.v) return src.slice();
      return radialWarp(src, w, h, (d) => ({ scale: Math.pow(d, e) / d }));
    }
    case 'ripple': {
      // Generatorul k are lungimea și faza lui; cu un singur generator e valul simplu. Înălțimea se împarte între generatori.
      const len = Math.max(2, v.l), g = Math.max(1, Math.min(5, Math.round(v.g))), amp = v.r / g, kind = Math.round(v.tp);
      const gens = Array.from({ length: g }, (_, k) => ({ t: (2 * Math.PI) / (len * (1 + 0.37 * k)), ph: k * 1.7 }));
      const d = (q: number) => gens.reduce((sum, e) => sum + amp * waveShape(kind, q * e.t + e.ph), 0);
      return warp(src, w, h, (x, y) => [x + d(y), y + d(x)]);
    }
    case 'max': return maxMin(src, w, h, v.r, true);
    case 'min': return maxMin(src, w, h, v.r, false);
    case 'surface': return edgeBlur(src, w, h, v.r, v.t, false);
    case 'smart': return edgeBlur(src, w, h, v.r, v.t, true, Math.round(v.m));
    case 'tiltshift': {
      const bl = gaussBlur(src, w, h, v.r), out = src.slice(), f = Math.max(1, v.f);
      if (v.a) {
        // Banda rotită: distanța fiecărui pixel până la linia din mijlocul benzii (trece prin centrul pozei, la înălțimea c).
        const a = (v.a * Math.PI) / 180, sa = Math.sin(a), ca = Math.cos(a), cx = ((v.cx ?? 50) / 100) * w, cy = (v.c / 100) * h;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const d = (Math.abs(-(x + 0.5 - cx) * sa + (y + 0.5 - cy) * ca) / h) * 100 - v.b / 2, m = d <= 0 ? 0 : Math.min(1, d / f);
          if (!m) continue;
          for (let i = (y * w + x) * 4, e = i + 4; i < e; i++) out[i] = src[i] + (bl[i] - src[i]) * m;
        }
        return out;
      }
      for (let y = 0; y < h; y++) {
        const d = Math.abs(((y + 0.5) / h) * 100 - v.c) - v.b / 2, m = d <= 0 ? 0 : Math.min(1, d / f);
        if (!m) continue;
        for (let i = y * w * 4, e = i + w * 4; i < e; i++) out[i] = src[i] + (bl[i] - src[i]) * m;
      }
      return out;
    }
    case 'sharpedges': return filterPixels(src, w, h, 'unsharp', { v: 100, r: Math.max(0.5, k), t: 10 }, 1);
    case 'oil': {
      const r = Math.max(1, Math.round(v.r)), n = Math.round(v.n), cnt = new Uint32Array(n), sum = new Float64Array(n * 3), out = src.slice();
      const bin = new Uint8Array(w * h);
      for (let p = 0; p < bin.length; p++) bin[p] = Math.min(n - 1, Math.floor((lum(src, p * 4) * n) / 256));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        cnt.fill(0); sum.fill(0);
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r + r) continue;
          const p = clampI(y + dy, h - 1) * w + clampI(x + dx, w - 1), b = bin[p], i = p * 4;
          cnt[b]++; sum[b * 3] += src[i]; sum[b * 3 + 1] += src[i + 1]; sum[b * 3 + 2] += src[i + 2];
        }
        let best = 0;
        for (let b = 1; b < n; b++) if (cnt[b] > cnt[best]) best = b;
        const o = (y * w + x) * 4;
        out[o] = sum[best * 3] / cnt[best]; out[o + 1] = sum[best * 3 + 1] / cnt[best]; out[o + 2] = sum[best * 3 + 2] / cnt[best];
      }
      // Relieful tușelor: lumina petelor e luată drept înălțimea vopselei; partea dinspre lumină se luminează, cealaltă se umbrește.
      if (v.sh > 0) {
        const L = new Float32Array(w * h), a = (v.la * Math.PI) / 180, lx = Math.cos(a), ly = -Math.sin(a), k = (v.sh / 100) * 0.75;
        for (let p = 0; p < L.length; p++) L[p] = lum(out, p * 4);
        const shaded = out.slice();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const gx = L[y * w + clampI(x + 1, w - 1)] - L[y * w + clampI(x - 1, w - 1)], gy = L[clampI(y + 1, h - 1) * w + x] - L[clampI(y - 1, h - 1) * w + x];
          const s = -(gx * lx + gy * ly) * k, o = (y * w + x) * 4;
          if (s) { shaded[o] = out[o] + s; shaded[o + 1] = out[o + 1] + s; shaded[o + 2] = out[o + 2] + s; }
        }
        return shaded;
      }
      return out;
    }
    case 'wind': {
      // Fiecare culoare luminoasă lasă o dungă care se stinge treptat în direcția vântului.
      // Rafală: dungi de două ori mai lungi și mai puternice; Sacadat: fiecare rând are altă lungime (vânt în rafale neregulate).
      const out = src.slice(), left = v.left >= 0.5, m = Math.round(v.m ?? 0), rand = rng(777);
      for (let y = 0; y < h; y++) {
        const k = m === 1 ? 2 : m === 2 ? 0.3 + rand() * 1.4 : 1, drop = 255 / Math.max(1, v.r * k);
        for (let c = 0; c < 3; c++) {
          let cur = 0;
          for (let s = 0; s < w; s++) {
            const x = left ? w - 1 - s : s, i = (y * w + x) * 4 + c;
            cur = Math.max(src[i], cur - drop);
            out[i] = cur;
          }
        }
      }
      return out;
    }
    case 'diffuse': {
      const r = Math.max(1, Math.round(v.r)), rand = rng(4242), out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = clampI(x + Math.round((rand() * 2 - 1) * r), w - 1), sy = clampI(y + Math.round((rand() * 2 - 1) * r), h - 1);
        const i = (sy * w + sx) * 4, o = (y * w + x) * 4;
        out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = src[i + 3];
      }
      return out;
    }
    case 'tiles': {
      // Rosturile dintre plăci rămân albe (culoarea de fundal din Photoshop).
      const ts = w / Math.max(1, Math.round(v.n)), max = (v.o / 100) * ts, rand = rng(99), out = new Uint8ClampedArray(src.length).fill(255);
      for (let ty = 0; ty * ts < h; ty++) for (let tx = 0; tx * ts < w; tx++) {
        const x0 = Math.round(tx * ts), y0 = Math.round(ty * ts), x1 = Math.min(w, Math.round((tx + 1) * ts)), y1 = Math.min(h, Math.round((ty + 1) * ts));
        const ox = Math.round((rand() * 2 - 1) * max), oy = Math.round((rand() * 2 - 1) * max);
        for (let y = y0; y < y1; y++) {
          const dy = y + oy;
          if (dy < 0 || dy >= h) continue;
          for (let x = x0; x < x1; x++) {
            const dx = x + ox;
            if (dx < 0 || dx >= w) continue;
            const i = (y * w + x) * 4, o = (dy * w + dx) * 4;
            out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = src[i + 3];
          }
        }
      }
      return out;
    }
    case 'trace': {
      const out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4, r = (y * w + Math.min(w - 1, x + 1)) * 4, b = (Math.min(h - 1, y + 1) * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const a = src[o + c] > v.l;
          out[o + c] = a !== src[r + c] > v.l || a !== src[b + c] > v.l ? 0 : 255;
        }
      }
      return out;
    }
    case 'crystallize':
    case 'pointillize': {
      const s = Math.max(2, v.r), { label, dist, n } = cells(w, h, s), mean = cellMeans(src, label, n), out = src.slice(), dot = id === 'pointillize';
      for (let p = 0; p < label.length; p++) {
        const o = p * 4, kk = label[p] * 4;
        if (dot && dist[p] > s * 0.45) { out[o] = out[o + 1] = out[o + 2] = 255; continue; }
        out[o] = mean[kk]; out[o + 1] = mean[kk + 1]; out[o + 2] = mean[kk + 2];
      }
      return out;
    }
    case 'halftone': {
      // Fiecare culoare are grila ei de puncte, rotită ca la tipar (108°, 162°, 90°); punctul e mai mare unde culoarea e mai tare.
      const s = Math.max(2, v.r * 2), out = src.slice(), angles = [108, 162, 90];
      for (let c = 0; c < 3; c++) {
        const a = (angles[c] * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const u = x * ca + y * sa, t = -x * sa + y * ca;
          const cu = (Math.floor(u / s) + 0.5) * s, ct = (Math.floor(t / s) + 0.5) * s;
          const px = clampI(Math.round(cu * ca - ct * sa), w - 1), py = clampI(Math.round(cu * sa + ct * ca), h - 1);
          const val = src[(py * w + px) * 4 + c] / 255, rad = (s / 2) * Math.SQRT2 * Math.sqrt(val);
          out[(y * w + x) * 4 + c] = Math.hypot(u - cu, t - ct) < rad ? 255 : 0;
        }
      }
      return out;
    }
    case 'mezzotint': {
      const rand = rng(31337), out = src.slice(), t = Math.round(v.t ?? 0);
      if (!t) {
        for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) out[i + c] = src[i + c] > rand() * 255 ? 255 : 0;
        return out;
      }
      // Celelalte tipuri: pixelii aceleiași „celule” (pătrățel, linie orizontală sau tușă pe diagonală) au același prag
      // întâmplător, deci se aprind împreună. Pragul vine dintr-un amestec de numere (la fel la fiecare rulare).
      const sz = Math.max(1, Math.round([1, 2, 4, 4, 12, 4, 12][t] * k));
      const hash = (a: number, b: number, c: number) => {
        let x = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c + 1, 0x9e3779b9);
        x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
        x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
        return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
      };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let a: number, b: number;
        if (t <= 2) { a = Math.floor(x / sz); b = Math.floor(y / sz); }
        else if (t <= 4) { a = Math.floor((x + ((y * 7) % sz)) / sz); b = y; }
        else { a = x - y; b = Math.floor((x + y + ((x - y + 4096) * 5) % sz) / sz); }
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) out[i + c] = src[i + c] > hash(a, b, c) * 255 ? 255 : 0;
      }
      return out;
    }
    case 'fragment': {
      const d = Math.max(1, Math.round(4 * k)), out = src.slice(), offs = [[-d, -d], [d, -d], [-d, d], [d, d]];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          let s = 0;
          for (const [dx, dy] of offs) s += src[(clampI(y + dy, h - 1) * w + clampI(x + dx, w - 1)) * 4 + c];
          out[o + c] = s / 4;
        }
      }
      return out;
    }
    case 'clouds':
    case 'diffclouds': {
      const nz = cloudNoise(w, h, v.r), out = src.slice(), diff = id === 'diffclouds';
      for (let p = 0; p < nz.length; p++) {
        const g = nz[p] * 255, o = p * 4;
        if (diff) for (let c = 0; c < 3; c++) out[o + c] = Math.abs(src[o + c] - g);
        else { out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = 255; }
      }
      return out;
    }
    case 'displace': {
      // Griul 128 nu mută nimic; 255 mută cu toată forța într-o parte, 0 în cealaltă.
      const mx = new Float32Array(w * h), my = new Float32Array(w * h), map = Math.round(v.map), r = Math.max(1, v.r), TAU = Math.PI * 2;
      if (map === 0) {
        // Poza însăși, estompată: roșul ei mută pe orizontală, verdele pe verticală (ca o hartă salvată din poză).
        const b = gaussBlur(src, w, h, Math.max(0.5, r / 4));
        for (let p = 0; p < mx.length; p++) { mx[p] = b[p * 4] / 255; my[p] = b[p * 4 + 1] / 255; }
      } else if (map === 4) {
        // Harta din fișier, întinsă peste poză (cel mai apropiat pixel); fără hartă: gri 128 peste tot, adică nicio mutare.
        const m = displaceMap;
        if (!m) { mx.fill(128 / 255); my.fill(128 / 255); }
        else for (let y = 0; y < h; y++) {
          const my0 = Math.min(m.h - 1, Math.floor(((y + 0.5) * m.h) / h)) * m.w;
          for (let x = 0; x < w; x++) {
            const q = (my0 + Math.min(m.w - 1, Math.floor(((x + 0.5) * m.w) / w))) * 4, p = y * w + x;
            mx[p] = m.d[q] / 255;
            my[p] = m.d[q + 1] / 255;
          }
        }
      } else if (map === 1) {
        mx.set(cloudNoise(w, h, r));
        const t = cloudNoise(h, w, r);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) my[y * w + x] = t[x * h + y];
      } else {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const p = y * w + x, u = Math.sin((TAU * x) / r), q = Math.sin((TAU * y) / r);
          if (map === 2) { mx[p] = 0.5 + 0.5 * q; my[p] = 0.5 + 0.5 * u; }
          else { const wv = Math.sign(u * q) * Math.min(1, Math.abs(u * q) * 3); mx[p] = 0.5 + 0.5 * wv; my[p] = 0.5 - 0.5 * wv; }
        }
      }
      return warp(src, w, h, (x, y) => { const p = y * w + x; return [x + Math.max(-1, (mx[p] * 255 - 128) / 127) * v.sx, y + Math.max(-1, (my[p] * 255 - 128) / 127) * v.sy]; });
    }
    case 'polar': {
      const cx = (w - 1) / 2, cy = (h - 1) / 2, inv = v.inv >= 0.5, TAU = Math.PI * 2;
      return warp(src, w, h, (x, y) => {
        if (inv) {
          const th = (x / w) * TAU, rho = y / Math.max(1, h - 1);
          return [cx + rho * (w / 2) * Math.sin(th), cy - rho * (h / 2) * Math.cos(th)];
        }
        const dx = (x - cx) / (w / 2), dy = (y - cy) / (h / 2);
        let th = Math.atan2(dx, -dy);
        if (th < 0) th += TAU;
        return [(th / TAU) * (w - 1), Math.min(1, Math.hypot(dx, dy)) * (h - 1)];
      });
    }
    case 'shear': {
      // Deplasarea fiecărui rând = unghiul + curba prin cele cinci puncte (sus, sfert, mijloc, sfert, jos), netedă (Catmull-Rom).
      const t = Math.tan((v.a * Math.PI) / 180), cy = (h - 1) / 2, P = [0, 1, 2, 3, 4].map((i) => ((v['c' + i] ?? 0) / 100) * w);
      if (!t && P.every((q) => !q)) return src.slice();
      const curve = (y: number) => {
        const f = h > 1 ? (y / (h - 1)) * 4 : 0, i = Math.min(3, Math.floor(f)), u = f - i;
        const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(4, i + 2)];
        return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
      };
      const sh = Array.from({ length: h }, (_, y) => t * (y - cy) + curve(y)), wrap = !v.edge;
      return warp(src, w, h, (x, y) => { const sx = x - sh[y]; return [wrap ? ((sx % w) + w) % w : Math.max(0, Math.min(w - 1, sx)), y]; });
    }
    case 'lensblur': return lensBlur(src, w, h, v);
    case 'hdr': {
      // Adaptare locală: luminozitatea se desparte în „bază” (media pe raza aleasă, adică lumina zonei) și „detaliu” (ce rămâne).
      // Baza se strânge spre mijlocul tonurilor (umbrele urcă, luminile coboară), detaliul se întărește, apoi se pun la loc
      // expunerea și gamma; culorile urmează luminozitatea nouă (aceeași nuanță), cu saturația potrivită la final.
      const n = w * h, L = new Float32Array(n), gray = new Uint8ClampedArray(n * 4);
      let sum = 0;
      for (let i = 0, o = 0; i < n; i++, o += 4) { const l = lum(src, o); L[i] = l; sum += l; gray[o] = gray[o + 1] = gray[o + 2] = l; gray[o + 3] = 255; }
      const mid = Math.min(150, Math.max(100, sum / n));
      const base = gaussBlur(gray, w, h, Math.max(1, v.r));
      const comp = 1 - (v.s / 100) * 0.8, det = 1 + v.d / 100, exp = Math.pow(2, v.e / 50), gam = 100 / Math.max(10, v.g), sat = 1 + v.sat / 100;
      const out = src.slice();
      for (let i = 0, o = 0; i < n; i++, o += 4) {
        const b = base[o], l = L[i];
        let nl = mid + (b - mid) * comp + (l - b) * det;
        nl = 255 * Math.pow(Math.min(1.5, Math.max(0, (nl * exp) / 255)), gam);
        const ratio = (nl + 1) / (l + 1);
        let r = src[o] * ratio, g = src[o + 1] * ratio, bl = src[o + 2] * ratio;
        // Peste alb: nuanța rămâne, culoarea se apropie de alb în loc să se taie pe un singur canal.
        const mx = Math.max(r, g, bl);
        if (mx > 255) { const t = Math.min(1, (mx - 255) / mx); r += (255 - r) * t; g += (255 - g) * t; bl += (255 - bl) * t; const m2 = Math.max(r, g, bl); r *= 255 / m2; g *= 255 / m2; bl *= 255 / m2; }
        const y = 0.299 * r + 0.587 * g + 0.114 * bl;
        out[o] = y + (r - y) * sat; out[o + 1] = y + (g - y) * sat; out[o + 2] = y + (bl - y) * sat;
      }
      return out;
    }
    case 'shapeblur': {
      const r = Math.max(1, Math.round(v.r)), segs = shapeKernel(Math.round(v.shape), r), out = src.slice(), pre = new Float64Array((w + 1) * h);
      for (let c = 0; c < 3; c++) {
        for (let y = 0; y < h; y++) {
          const b = y * (w + 1);
          pre[b] = 0;
          for (let x = 0; x < w; x++) pre[b + x + 1] = pre[b + x] + src[(y * w + x) * 4 + c];
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let s = 0, n = 0;
          for (const [dy, a0, a1] of segs) {
            const yy = y + dy;
            if (yy < 0 || yy >= h) continue;
            const a = Math.max(0, x + a0), e = Math.min(w - 1, x + a1);
            if (e < a) continue;
            const b = yy * (w + 1);
            s += pre[b + e + 1] - pre[b + a]; n += e - a + 1;
          }
          out[(y * w + x) * 4 + c] = n ? s / n : src[(y * w + x) * 4 + c];
        }
      }
      return out;
    }
    case 'iris': {
      const bl = gaussBlur(src, w, h, v.r), out = src.slice(), s = v.s / 100, f = Math.max(0.01, v.f / 100);
      const cx = ((v.x ?? 50) / 100) * (w - 1), cy = ((v.y ?? 50) / 100) * (h - 1), e = Math.sqrt(Math.pow(2, (v.ar ?? 0) / 50));
      const an = ((v.rot ?? 0) * Math.PI) / 180, co = Math.cos(an), si = Math.sin(an), rx = (w / 2) * e, ry = h / 2 / e;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy, d = Math.hypot((dx * co + dy * si) / rx, (-dx * si + dy * co) / ry), m = d <= s ? 0 : Math.min(1, (d - s) / f);
        if (!m) continue;
        const o = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) out[o + c] = src[o + c] + (bl[o + c] - src[o + c]) * m;
      }
      return out;
    }
    case 'reducenoise': {
      const sm = edgeBlur(src, w, h, Math.max(1, (1 + v.v / 3) * k), 4 + v.v * 4, false), keep = v.d / 100, out = src.slice();
      for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) out[i + c] = sm[i + c] + (src[i + c] - sm[i + c]) * keep * 0.6;
      if (v.jpeg >= 0.5) jpegDeblock(out, w, h);
      if (v.col > 0) chromaDenoise(out, w, h, v.col, k);
      if (v.cr > 0 || v.cg > 0 || v.cb > 0 || v.sd > 0) noiseAdvanced(out, w, h, v, k);
      return out;
    }
    case 'zigzag': {
      const amt = (v.v / 100) * 0.12, n = Math.max(1, Math.round(v.n));
      if (!amt) return src.slice();
      return radialWarp(src, w, h, (d) => ({ scale: 1 + amt * Math.sin(d * n * 2 * Math.PI) * (1 - d) }));
    }
    case 'lenscorr': {
      const cx = (w - 1) / 2, cy = (h - 1) / 2, diag = Math.hypot(w / 2, h / 2), kd = (v.d / 100) * 0.25, vig = v.vig / 100, ca = (v.ca / 100) * 0.01;
      const out = src.slice(), tmp = new Uint8ClampedArray(4);
      // Transformarea (perspectivă, unghi, scară) se desface întâi: o omografie în jurul mijlocului, apoi corecția obiectivului.
      const kv = (v.vp ?? 0) / 200, kh = (v.hp ?? 0) / 200, an = (-(v.ang ?? 0) * Math.PI) / 180, co = Math.cos(an), si = Math.sin(an);
      const sc = Math.max(0.1, (v.sc ?? 100) / 100), R = Math.max(cx, cy, 1), clear = !!v.edge;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let dx = (x - cx) / sc, dy = (y - cy) / sc;
        if (an) { const t = dx * co - dy * si; dy = dx * si + dy * co; dx = t; }
        if (kv || kh) { const q = 1 + (kv * dy + kh * dx) / R; dx /= q; dy /= q; }
        const r2 = (dx * dx + dy * dy) / (diag * diag), s0 = 1 + kd * r2, o = (y * w + x) * 4;
        if (clear) { const sx = cx + dx * s0, sy = cy + dy * s0; if (sx < -0.5 || sy < -0.5 || sx > w - 0.5 || sy > h - 0.5) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue; } }
        for (let c = 0; c < 3; c++) {
          const s = s0 * (1 + (c === 0 ? ca : c === 2 ? -ca : 0));
          sample(src, w, h, cx + dx * s, cy + dy * s, tmp, 0);
          out[o + c] = tmp[c] * (1 + vig * r2 * 1.5);
          if (c === 1) out[o + 3] = tmp[3];
        }
      }
      return out;
    }
    case 'wideangle': return wideAngle(src, w, h, v);
    case 'lighting': return lightingFx(src, w, h, v);
    case 'tree': return drawTree(src, w, h, v);
    case 'flame': return drawFlames(src, w, h, v);
    case 'basrelief': return basRelief(src, w, h, v);
    case 'chalk': return chalkCharcoal(src, w, h, v);
    case 'photocopy': return photocopy(src, w, h, v);
    case 'stamp': return stamp(src, w, h, v);
    case 'torn': return tornEdges(src, w, h, v);
    case 'htpattern': return halftonePattern(src, w, h, v);
    case 'craquelure': return craquelure(src, w, h, v);
    case 'grain': return grain(src, w, h, v);
    case 'mosaictiles': return mosaicTiles(src, w, h, v);
    case 'patchwork': return patchwork(src, w, h, v);
    case 'stainedglass': return stainedGlass(src, w, h, v);
    case 'posteredges': return posterEdges(src, w, h, v);
    case 'drybrush': return dryBrush(src, w, h, v);
    case 'paletteknife': return paletteKnife(src, w, h, v);
    case 'sponge': return sponge(src, w, h, v);
    case 'colpencil': return coloredPencil(src, w, h, v);
    case 'neon': return neonGlow(src, w, h, v);
    case 'fresco': return fresco(src, w, h, v);
    case 'pastels': return roughPastels(src, w, h, v);
    case 'chrome': return chrome(src, w, h, v);
    case 'graphicpen': return graphicPen(src, w, h, v);
    case 'plaster': return plaster(src, w, h, v);
    case 'sumie': return sumie(src, w, h, v);
    case 'angled': return angledStrokes(src, w, h, v);
    case 'flare': {
      // Miezul alb, un inel portocaliu și pete pe linia spre centrul pozei, adunate peste poză (ca lumina).
      const fx = (v.x / 100) * w, fy = (v.y / 100) * h, D = Math.hypot(w, h), b = v.v / 100, cx = w / 2, cy = h / 2, out = src.slice();
      // Obiectivele diferă prin mărimea miezului, a strălucirii, inelul, petele de pe linie și dunga orizontală (la film).
      type Ghost = readonly [number, number, readonly [number, number, number]];
      const LENS: { core: number; glow: number; ring: number; ringA: number; ghosts: readonly Ghost[]; streak: number }[] = [
        { core: 0.0008, glow: 0.08, ring: 0.09, ringA: 0.25, ghosts: [[0.5, 0.03, [80, 120, 255]], [1.3, 0.05, [120, 255, 140]], [1.7, 0.02, [255, 120, 80]]], streak: 0 },
        { core: 0.0004, glow: 0.05, ring: 0.06, ringA: 0.3, ghosts: [[0.3, 0.015, [255, 200, 80]], [0.6, 0.025, [80, 120, 255]], [0.9, 0.012, [120, 255, 140]], [1.2, 0.035, [80, 200, 255]], [1.5, 0.018, [255, 120, 80]], [1.9, 0.045, [160, 120, 255]]], streak: 0 },
        { core: 0.0015, glow: 0.14, ring: 0, ringA: 0, ghosts: [[1.4, 0.07, [255, 170, 90]], [1.8, 0.04, [90, 140, 255]]], streak: 0 },
        { core: 0.0006, glow: 0.06, ring: 0, ringA: 0, ghosts: [[0.6, 0.02, [90, 150, 255]], [1.4, 0.03, [90, 150, 255]]], streak: 0.7 },
      ];
      const L = LENS[Math.max(0, Math.min(LENS.length - 1, Math.round(v.lens ?? 0)))], ghosts = L.ghosts;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - fx, y - fy) / D;
        const core = Math.exp(-(d * d) / L.core) + 0.35 * Math.exp(-d / L.glow), ring = L.ringA ? L.ringA * Math.exp(-(((d - L.ring) / 0.006) ** 2)) : 0;
        let add = [255 * core + 255 * ring, 240 * core + 170 * ring, 220 * core + 60 * ring];
        if (L.streak) {
          // Dunga albăstruie a obiectivelor de film: subțire pe verticală, lungă pe orizontală.
          const st = L.streak * Math.exp(-(((y - fy) / D / 0.004) ** 2)) * Math.exp(-Math.abs(x - fx) / D / 0.3);
          add = [add[0] + 120 * st, add[1] + 170 * st, add[2] + 255 * st];
        }
        for (const [t, rad, col] of ghosts) {
          const gx = fx + (cx - fx) * t, gy = fy + (cy - fy) * t, gd = Math.hypot(x - gx, y - gy) / D;
          if (gd < rad) { const k2 = 0.18 * (1 - gd / rad); add = [add[0] + col[0] * k2, add[1] + col[1] * k2, add[2] + col[2] * k2]; }
        }
        const o = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) out[o + c] = src[o + c] + add[c] * b;
      }
      return out;
    }
    case 'deinterlace': {
      const out = src.slice(), start = v.even >= 0.5 ? 0 : 1;
      for (let y = start; y < h; y += 2) {
        const a = y > 0 ? y - 1 : y + 1, b = y < h - 1 ? y + 1 : y - 1;
        if (a < 0 || b < 0 || a >= h || b >= h) continue;
        for (let x = 0; x < w * 4; x++) out[y * w * 4 + x] = (src[a * w * 4 + x] + src[b * w * 4 + x]) / 2;
      }
      return out;
    }
    case 'ntsc': {
      // În YIQ, culoarea (I, Q) se micșorează cât să nu treacă de limita semnalului de televiziune.
      const out = src.slice();
      for (let i = 0; i < out.length; i += 4) {
        const r = src[i] / 255, g = src[i + 1] / 255, b = src[i + 2] / 255;
        const Y = 0.299 * r + 0.587 * g + 0.114 * b, I2 = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
        const c = Math.hypot(I2, Q), lim = Math.max(0, Math.min(1.1 - Y, Y + 0.2, 0.42)), s = c > lim && c > 0 ? lim / c : 1;
        const i2 = I2 * s, q = Q * s;
        out[i] = 255 * (Y + 0.956 * i2 + 0.621 * q); out[i + 1] = 255 * (Y - 0.272 * i2 - 0.647 * q); out[i + 2] = 255 * (Y - 1.106 * i2 + 1.703 * q);
      }
      return out;
    }
    case 'hsb': {
      const out = src.slice(), hsl = v.hsl >= 0.5;
      for (let i = 0; i < out.length; i += 4) {
        const r = src[i] / 255, g = src[i + 1] / 255, b = src[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        let H = 0;
        if (d) H = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        H = ((H * 60) + 360) % 360;
        const L = (mx + mn) / 2, S = hsl ? (d ? d / (1 - Math.abs(2 * L - 1)) : 0) : mx ? d / mx : 0;
        out[i] = (H / 360) * 255; out[i + 1] = S * 255; out[i + 2] = (hsl ? L : mx) * 255;
      }
      return out;
    }
    case 'fieldblur': {
      // Estomparea fiecărui pixel = media celor două puncte, cântărită după distanță (cel apropiat contează mai mult);
      // pixelul ia amestecul dintre cele mai apropiate două niveluri de estompare calculate.
      const px = [[(v.x1 / 100) * w, (v.y1 / 100) * h, Math.max(0, v.b1)], [(v.x2 / 100) * w, (v.y2 / 100) * h, Math.max(0, v.b2)]];
      const top = Math.max(px[0][2], px[1][2]);
      if (top < 0.25) return src.slice();
      const N = 5, lev: Px[] = [src];
      for (let i = 1; i < N; i++) lev.push(gaussBlur(src, w, h, (top * i) / (N - 1)));
      const out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d1 = (x - px[0][0]) ** 2 + (y - px[0][1]) ** 2, d2 = (x - px[1][0]) ** 2 + (y - px[1][1]) ** 2;
        const b = d1 + d2 ? (px[0][2] * d2 + px[1][2] * d1) / (d1 + d2) : px[0][2];
        const t = (b / top) * (N - 1), i0 = Math.min(N - 2, Math.floor(t)), f = t - i0, a = lev[i0], c = lev[i0 + 1], o = (y * w + x) * 4;
        for (let k2 = 0; k2 < 4; k2++) out[o + k2] = a[o + k2] + (c[o + k2] - a[o + k2]) * f;
      }
      return out;
    }
    case 'extrude': {
      // Fiecare bloc ia culoarea medie; marginile lui sunt teșite: sus și stânga mai luminoase, jos și dreapta mai închise.
      const s = Math.max(2, Math.round(v.r)), bev = v.pyr >= 0.5 ? s / 2 : Math.max(1, (s / 2) * (v.d / 100)), out = src.slice();
      const shade = [1.35, 1.15, 0.85, 0.65]; // sus, stânga, dreapta, jos
      for (let by = 0; by < h; by += s) for (let bx = 0; bx < w; bx += s) {
        const ex = Math.min(w, bx + s), ey = Math.min(h, by + s), acc = [0, 0, 0];
        for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) { const i = (y * w + x) * 4; acc[0] += src[i]; acc[1] += src[i + 1]; acc[2] += src[i + 2]; }
        const n = (ex - bx) * (ey - by), bw = ex - bx, bh = ey - by;
        for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) {
          const u = x - bx + 0.5, q = y - by + 0.5, dt = q, dl = u, dr = bw - u, db = bh - q, m = Math.min(dt, dl, dr, db);
          const f = m >= bev ? 1 : shade[m === dt ? 0 : m === dl ? 1 : m === dr ? 2 : 3], o = (y * w + x) * 4;
          out[o] = (acc[0] / n) * f; out[o + 1] = (acc[1] / n) * f; out[o + 2] = (acc[2] / n) * f;
        }
      }
      return out;
    }
    case 'spatter': {
      const r = Math.max(1, Math.round(v.r)), rand = rng(777), out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = clampI(x + Math.round((rand() * 2 - 1) * r), w - 1), sy = clampI(y + Math.round((rand() * 2 - 1) * r), h - 1);
        const i = (sy * w + sx) * 4, o = (y * w + x) * 4;
        out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = src[i + 3];
      }
      const sm = Math.round(v.s * Math.min(1, k));
      return sm > 0 ? medianFilter(out, w, h, sm) : out;
    }
    case 'crosshatch': {
      // Tușe trase pe diagonală (două estompări de mișcare), apoi linii de hașură: o direcție în umbre, ambele în umbrele adânci.
      const a = filterPixels(src, w, h, 'motion', { a: 45, r: v.r }, 1), b = filterPixels(src, w, h, 'motion', { a: -45, r: v.r }, 1);
      const p = Math.max(2, Math.round(v.p)), st = v.v / 100, out = src.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4, dark = 1 - lum(src, o) / 255;
        let f = 1;
        if (dark > 0.35 && (x + y) % p === 0) f -= st * 0.6;
        if (dark > 0.65 && (((x - y) % p) + p) % p === 0) f -= st * 0.6;
        for (let c = 0; c < 3; c++) out[o + c] = ((a[o + c] + b[o + c]) / 2) * Math.max(0, f);
      }
      return out;
    }
    case 'accented': {
      // Marginile (schimbările de luminozitate) găsite pe poza ușor estompată, îngroșate cu raza aleasă.
      const bl = gaussBlur(src, w, h, Math.max(0.5, v.r / 2)), mag = new Float32Array(w * h), out = src.slice(), br = v.v / 100;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const L = (dx: number, dy: number) => lum(bl, (clampI(y + dy, h - 1) * w + clampI(x + dx, w - 1)) * 4);
        const gx = L(1, -1) + 2 * L(1, 0) + L(1, 1) - L(-1, -1) - 2 * L(-1, 0) - L(-1, 1);
        const gy = L(-1, 1) + 2 * L(0, 1) + L(1, 1) - L(-1, -1) - 2 * L(0, -1) - L(1, -1);
        mag[y * w + x] = Math.min(1, Math.hypot(gx, gy) / 255);
      }
      for (let p2 = 0; p2 < mag.length; p2++) {
        const e = mag[p2] * Math.abs(br), o = p2 * 4;
        if (!e) continue;
        for (let c = 0; c < 3; c++) out[o + c] = br > 0 ? src[o + c] + (255 - src[o + c]) * e : src[o + c] * (1 - e);
      }
      return out;
    }
    case 'offset': {
      const dx = Math.round((v.x / 100) * w), dy = Math.round((v.y / 100) * h), out = new Uint8ClampedArray(src.length);
      for (let y = 0; y < h; y++) {
        const sy = (((y - dy) % h) + h) % h;
        for (let x = 0; x < w; x++) {
          const sx = (((x - dx) % w) + w) % w, i = (sy * w + sx) * 4, o = (y * w + x) * 4;
          out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = src[i + 3];
        }
      }
      return out;
    }
  }
  return src.slice();
}

/** Aplică filtrul pe o pânză întreagă și întoarce una nouă. */
export function filterCanvas(src: HTMLCanvasElement, id: FilterId, p: Record<string, number>): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const data = src.getContext('2d')!.getImageData(0, 0, w, h);
  const res = filterPixels(data.data, w, h, id, p, 1);
  data.data.set(res);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.putImageData(data, 0, 0);
  return out;
}
