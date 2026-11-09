// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Comprimare imagini în document: pozele se micșorează la rezoluția aleasă (ppi), după cât de late sunt în pagină
// (96 px în pagină = 1 inci), ca fișierul să fie mai mic de trimis. Poza nouă rămâne doar dacă iese mai mică.
// Graficele, diagramele, ecuațiile, formele și textul artistic nu se ating: ele se redesenează din datele lor.
import type { Editor } from '@tiptap/react';
import { shrinkData } from '../slides/compress';

export { COMPRESS_PPI } from '../slides/compress';

/** Poza se poate comprima (nu e desenată din date). */
export const canCompressDoc = (attrs: Record<string, unknown>) =>
  typeof attrs.src === 'string' && attrs.src.startsWith('data:image/') && !attrs.src.startsWith('data:image/svg')
  && !attrs.chart && !attrs.diagram && !attrs.equation && !attrs.shape && !attrs.wordart;

const naturalWidth = (src: string) => new Promise<number>((ok) => {
  const im = new Image();
  im.onload = () => ok(im.naturalWidth);
  im.onerror = () => ok(0);
  im.src = src;
});

/**
 * Comprimă pozele din document: doar cea de la `onlyPos` sau toate. Întoarce câte s-au micșorat și câți octeți s-au câștigat.
 * Totul intră într-un singur pas, deci Ctrl+Z le pune pe toate înapoi.
 */
export async function compressDocImages(editor: Editor, ppi: number, onlyPos?: number): Promise<{ count: number; saved: number }> {
  const pageW = (editor.view.dom as HTMLElement).clientWidth || 650;
  const todo: { pos: number; src: string; width: number | null }[] = [];
  editor.state.doc.descendants((n, pos) => {
    if (n.type.name === 'image' && (onlyPos === undefined || pos === onlyPos) && canCompressDoc(n.attrs)) {
      todo.push({ pos, src: n.attrs.src, width: Number(n.attrs.width) || null });
    }
    return true;
  });
  const done: { pos: number; src: string; old: string; width: number | null }[] = [];
  for (const t of todo) {
    const nat = await naturalWidth(t.src);
    if (!nat) continue;
    // Lățimea din pagină: cea aleasă de utilizator sau poza la mărimea ei, cel mult cât pagina.
    const shown = t.width ?? Math.min(nat, pageW);
    const k = Math.min(1, ((shown / 96) * ppi) / nat);
    const src = await shrinkData(t.src, k);
    // Fără lățime aleasă, poza mai mică s-ar vedea mai mică: primește lățimea pe care o avea în pagină.
    if (src) done.push({ pos: t.pos, src, old: t.src, width: t.width ?? (k < 1 ? Math.round(shown) : null) });
  }
  if (!done.length) return { count: 0, saved: 0 };
  const tr = editor.state.tr;
  let count = 0, saved = 0;
  for (const d of done) {
    const n = tr.doc.nodeAt(d.pos);
    // Documentul s-a schimbat între timp în locul acela: poza se lasă cum e.
    if (!n || n.type.name !== 'image' || n.attrs.src !== d.old) continue;
    tr.setNodeMarkup(d.pos, undefined, { ...n.attrs, src: d.src, width: d.width });
    count++;
    saved += d.old.length - d.src.length;
  }
  if (count) editor.view.dispatch(tr);
  // Data URL în base64: 4 litere = 3 octeți.
  return { count, saved: Math.round((saved * 3) / 4) };
}
