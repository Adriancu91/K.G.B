// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Legătura dintre fișierele .psd (psd.ts, doar octeți) și documentul cu straturi din Imagini (pânze).

import type { PsdPath } from './psdPaths';
import { Doc, Layer, LayerGroup, bakedMask, blankCanvas, canvasesOf, chainOf, flatten, layerId, mergeDown } from './layers';
import { PsdChannel, PsdGroup, PsdOutLayer, readPSD, writePSD } from './psd';
import { hasFx, withFx } from './layerfx';
import type { PsdNote } from './psdNotes';

/** Numele stratului de referință pus deasupra când straturile citite nu arată exact ca fișierul. */
export const PSD_REFERENCE = 'Cum arăta fișierul';

const put = (c: HTMLCanvasElement, rgba: Uint8ClampedArray, w: number, h: number, x = 0, y = 0) =>
  c.getContext('2d')!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), x, y);

/** Deschide un .psd ca document cu straturi (toate pânzele au mărimea pozei). */
export async function docFromPsd(data: Uint8Array): Promise<{ doc: Doc; note: string; channels: PsdChannel[]; paths: PsdPath[]; annotations: PsdNote[] }> {
  const psd = await readPSD(data);
  const W = psd.width, H = psd.height;
  const layers: Layer[] = [];
  let base: Layer | null = null;
  // Un singur obiect de grup pentru toate straturile aceluiași grup din fișier.
  const groups = new Map<number, LayerGroup>();
  const groupOf = (p: PsdGroup): LayerGroup => {
    let g = groups.get(p.key);
    if (!g) {
      g = { id: layerId(), name: p.name, visible: p.visible, opacity: p.opacity, open: p.open, ...(p.parent ? { parent: groupOf(p.parent) } : {}) };
      groups.set(p.key, g);
    }
    return g;
  };
  for (const pl of psd.layers) {
    const c = blankCanvas(W, H);
    if (pl.w > 0 && pl.h > 0) put(c, pl.rgba, pl.w, pl.h, pl.left, pl.top);
    let mask: HTMLCanvasElement | undefined;
    if (pl.mask) {
      mask = blankCanvas(W, H);
      const mc = mask.getContext('2d')!;
      // Fondul măștii poate fi și gri (masca cu densitate mai mică, din .psd).
      const dv = pl.mask.def;
      mc.fillStyle = `rgb(${dv},${dv},${dv})`;
      mc.fillRect(0, 0, W, H);
      const m = pl.mask;
      if (m.data && m.w > 0 && m.h > 0) {
        const g = new Uint8ClampedArray(m.w * m.h * 4);
        for (let i = 0, j = 0; i < m.data.length; i++, j += 4) { g[j] = g[j + 1] = g[j + 2] = m.data[i]; g[j + 3] = 255; }
        put(mask, g, m.w, m.h, m.left, m.top);
      }
    }
    const layer: Layer = {
      id: layerId(), name: pl.name || `Strat ${layers.length + 1}`, c,
      visible: pl.visible, opacity: pl.opacity, blend: pl.blend,
      ...(pl.locked ? { locked: true } : {}),
      ...(pl.lockAlpha ? { lockAlpha: true } : {}),
      ...(pl.lockPixels ? { lockPixels: true } : {}),
      ...(pl.lockPos ? { lockPos: true } : {}),
      ...(mask ? { mask, maskOn: !pl.mask!.off } : {}),
      ...(pl.fx ? { fx: pl.fx } : {}),
      ...(pl.adj ? { adj: pl.adj } : {}),
      ...(pl.text ? { text: pl.text } : {}),
      ...(pl.link ? { link: pl.link } : {}),
    };
    if (pl.group) layer.group = groupOf(pl.group);
    // Masca de decupare: stratul se vede doar unde are pixeli stratul de bază de sub el (rămâne mască, se poate scoate).
    if (pl.clip && base) layer.clip = true;
    else base = layer;
    layers.push(layer);
  }
  const notes = [...psd.notes];
  if (!layers.length) {
    const c = blankCanvas(W, H);
    put(c, psd.composite!, W, H);
    layers.push({ id: layerId(), name: 'Fundal', c, visible: true, opacity: 1, blend: 'source-over' });
  } else if (psd.lossy && psd.composite) {
    // Ce n-am putut reface (ajustări, efecte) se vede în poza compusă: o punem deasupra, ascunsă, ca să se poată compara (👁).
    const c = blankCanvas(W, H);
    put(c, psd.composite, W, H);
    layers.push({ id: layerId(), name: PSD_REFERENCE, c, visible: false, opacity: 1, blend: 'source-over' });
    notes.push(`Stratul ascuns „${PSD_REFERENCE}” (sus) arată poza din fișier, ca să compari.`);
  }
  const top = layers.length - 1 - (layers[layers.length - 1].name === PSD_REFERENCE && layers.length > 1 ? 1 : 0);
  if (psd.channels.length) notes.push(psd.channels.length === 1 ? `Selecția salvată „${psd.channels[0].name}” e în lista „Încarcă selecția”.` : `Cele ${psd.channels.length} selecții salvate din fișier sunt în lista „Încarcă selecția”.`);
  if (psd.paths.length) notes.push(psd.paths.length === 1 ? `Traseul salvat „${psd.paths[0].name}” e în lista Trasee a uneltei ✒ Traseu.` : `Cele ${psd.paths.length} trasee salvate din fișier sunt în lista Trasee a uneltei ✒ Traseu.`);
  return { doc: { layers, active: top }, note: notes.join(' '), channels: psd.channels, paths: psd.paths, annotations: psd.annotations };
}

/** Pixelii măștii în tonuri de gri. */
function grayOf(m: HTMLCanvasElement): Uint8Array {
  const d = m.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, m.width, m.height).data;
  const o = new Uint8Array(m.width * m.height);
  for (let i = 0, j = 0; i < o.length; i++, j += 4) o[i] = (((d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8) * d[j + 3]) / 255;
  return o;
}

/** Documentul ca .psd. Straturile de ajustare se aplică pe stratul de sub ele (în fișier rămân pixeli).
 *  `channels`: selecțiile salvate, scrise ca canale alfa (cât poza); `paths`: traseele salvate (lista Trasee); `annos`: notele 🗒. */
export function psdFromDoc(doc: Doc, channels: PsdChannel[] = [], paths: PsdPath[] = [], annos: PsdNote[] = []): { data: Uint8Array; note: string } {
  let d: Doc = doc;
  let merged = 0;
  for (;;) {
    const i = d.layers.findIndex((l) => l.adj);
    if (i < 0) break;
    merged++;
    d = (i > 0 && mergeDown({ ...d, active: i })) || { ...d, layers: d.layers.filter((_, j) => j !== i), active: 0 };
  }
  const W = d.layers[0].c.width, H = d.layers[0].c.height;
  const flat = flatten(d);
  const composite = flat.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  flat.width = 0;
  try {
    // Grupurile: capătul grupului sub primul lui strat, dosarul (nume, ochi, opacitate, strâns) deasupra ultimului.
    // Grupurile în grupuri: între două straturi se închid grupurile pe care nu le mai au în comun, apoi se deschid cele noi.
    const out: PsdOutLayer[] = [];
    const folder = (g: LayerGroup): PsdOutLayer => ({ name: g.name, rgba: () => new Uint8ClampedArray(0), visible: g.visible, opacity: g.opacity, blend: 'source-over', section: g.open ? 1 : 2 });
    const end = (): PsdOutLayer => ({ name: '</Layer group>', rgba: () => new Uint8ClampedArray(0), visible: true, opacity: 1, blend: 'source-over', section: 3 });
    // De la grupul de sus spre cel mai apropiat.
    const outerFirst = (g: LayerGroup | undefined) => chainOf(g).reverse();
    let open: LayerGroup[] = [];
    for (const l of d.layers) {
      const want = outerFirst(l.group);
      let c = 0;
      while (c < open.length && c < want.length && open[c].id === want[c].id) c++;
      for (let k = open.length - 1; k >= c; k--) out.push(folder(open[k]));
      for (let k = c; k < want.length; k++) out.push(end());
      out.push(layerOut(l));
      open = want;
    }
    for (let k = open.length - 1; k >= 0; k--) out.push(folder(open[k]));
    const data = writePSD(W, H, out, composite, channels.filter((c) => c.data.length === W * H), paths, annos);
    const note = merged ? `${merged === 1 ? 'Stratul de ajustare s-a aplicat' : `${merged} straturi de ajustare s-au aplicat`} pe stratul de sub el (în .psd rămân pixeli).` : '';
    return { data, note };
  } finally {
    // Pânzele făcute doar pentru salvare (straturile unite) nu mai trebuie.
    const keep = canvasesOf([doc]);
    for (const c of canvasesOf([d])) if (!keep.has(c)) c.width = 0;
  }
  function layerOut(l: Layer): PsdOutLayer {
    return {
      name: l.name,
      // Stilurile stratului (umbră, contur…) intră în .psd ca pixeli.
      rgba: () => {
        if (!hasFx(l.fx) || l.adj) return l.c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
        const c = withFx(l.c, l.fx!, 1);
        const px = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
        c.width = 0;
        return px;
      },
      visible: l.visible,
      opacity: l.opacity,
      blend: l.blend,
      locked: l.locked,
      lockAlpha: l.lockAlpha,
      lockPixels: l.lockPixels,
      lockPos: l.lockPos,
      clip: l.clip,
      ...(l.mask ? { mask: () => grayOf(bakedMask(l)), maskOff: l.maskOn === false } : {}),
      // Textul neschimbat rămâne text (fără stiluri: acelea intră în pixeli și textul refăcut le-ar pierde).
      ...(l.text?.raw && !hasFx(l.fx) && !l.adj ? { typeTool: l.text.raw } : {}),
      ...(l.link ? { link: l.link } : {}),
    };
  }
}
