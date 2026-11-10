// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// PDF căutabil: textul recunoscut cu OCR se pune invizibil peste poza paginii, cuvânt cu cuvânt, la locul lui.
// Așa, Ctrl+F și selectarea textului merg și în Acrobat, în browser sau aici, iar pagina arată la fel.
// Fontul e Liberation Sans (licență SIL OFL, vine cu pdf.js) și are toate literele românești (ă, â, î, ș, ț).
import fontkit from '@pdf-lib/fontkit';
import fontUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';
import boldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';
import italicUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Italic.ttf?url';
import boldItalicUrl from 'pdfjs-dist/standard_fonts/LiberationSans-BoldItalic.ttf?url';
import { degrees, PDFContentStream, PDFFont, popGraphicsState, pushGraphicsState, rgb, setCharacterSqueeze, setTextRenderingMode, TextRenderingMode } from 'pdf-lib';
import { open } from './edit';
import { toPdfPoint } from './sign';

/** Un cuvânt găsit cu OCR, în puncte, pe pagina așa cum se vede: (x, y) e începutul lui pe linia de bază. */
export interface OcrWord {
  text: string;
  x: number;
  y: number;
  /** Lățimea cuvântului și mărimea literelor. */
  w: number;
  size: number;
  /** Text vizibil (PDF cu text editabil), cu culoarea literelor (0–1); fără ea cuvântul rămâne invizibil, peste poză. */
  color?: { r: number; g: number; b: number };
  /** Aspectul literelor din poză (doar la textul vizibil): aldin, cursiv. */
  bold?: boolean;
  italic?: boolean;
}

/** Adaugă textul pe paginile date (numerotate de la 1): invizibil, sau vizibil la cuvintele cu `color`. */
export async function addTextLayer(bytes: Uint8Array, pages: Map<number, OcrWord[]>): Promise<Uint8Array> {
  const doc = await open(bytes);
  doc.registerFontkit(fontkit);
  // Variantele aldin / cursiv se pun în PDF doar dacă un cuvânt vizibil le folosește.
  const fonts = new Map<number, PDFFont>();
  const fontFor = async (w: OcrWord) => {
    const k = w.color ? (w.bold ? 1 : 0) + (w.italic ? 2 : 0) : 0;
    let f = fonts.get(k);
    if (!f) {
      f = await doc.embedFont(await (await fetch([fontUrl, boldUrl, italicUrl, boldItalicUrl][k])).arrayBuffer(), { subset: true });
      fonts.set(k, f);
    }
    return f;
  };
  const ctx = doc.context;
  for (const [n, words] of pages) {
    if (n < 1 || n > doc.getPageCount() || !words.length) continue;
    const page = doc.getPage(n - 1);
    // Conținutul vechi se închide între q…Q, ca o schimbare de poziție rămasă în el să nu mute textul nostru.
    page.node.wrapContentStreams(
      ctx.register(PDFContentStream.of(ctx.obj({}), [pushGraphicsState()])),
      ctx.register(PDFContentStream.of(ctx.obj({}), [popGraphicsState()])),
    );
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    const box = page.getCropBox();
    page.pushOperators(pushGraphicsState());
    for (const w of words) {
      const text = w.text.replace(/[\u0000-\u001f]/g, '').trim();
      if (!text || w.size < 2 || w.w < 1) continue;
      const font = await fontFor(w);
      const natural = font.widthOfTextAtSize(text, w.size);
      if (!natural) continue;
      // Literele se strâng sau se lățesc ca cuvântul să acopere exact locul lui din poză (pentru selecție).
      page.pushOperators(setTextRenderingMode(w.color ? TextRenderingMode.Fill : TextRenderingMode.Invisible), setCharacterSqueeze(Math.max(10, Math.min(500, (100 * w.w) / natural))));
      const [x, y] = toPdfPoint(w.x, w.y, box, rot);
      page.drawText(`${text} `, { x, y, size: w.size, font, rotate: degrees(rot), ...(w.color ? { color: rgb(w.color.r, w.color.g, w.color.b) } : {}) });
    }
    page.pushOperators(popGraphicsState());
  }
  return doc.save();
}
