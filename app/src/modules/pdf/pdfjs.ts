// pdf.js (Apache-2.0, D-032) for showing PDF pages in the window. Safe
// settings: no system fonts, no network (the bytes come from the module);
// the CSP forbids eval anyway. The worker is bundled with the app.
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  const doc = await getDocument({ data, useSystemFonts: false, verbosity: 0 }).promise;
  if (doc.numPages > 0) viewportCompat((await doc.getPage(1)).getViewport({ scale: 1 }));
  return doc;
}

/**
 * Adaptare K.G.B. (nu din COS): pdf.js 6 nu mai are `PageViewport.convertToViewportRectangle`, pe care codul copiat
 * neschimbat din COS (pdf.js 4) îl folosește (TextEdit.tsx: rândurile paginii pentru „Editează text”). Metoda se pune
 * înapoi pe clasa vederilor, o dată, cu aceeași socoteală ca în pdf.js 4: cele două colțuri trecute prin matricea vederii.
 */
export function viewportCompat(vp: object): void {
  const proto = Object.getPrototypeOf(vp) as {
    convertToViewportRectangle?: (r: number[]) => number[];
    convertToViewportPoint(x: number, y: number): number[];
  };
  if (proto.convertToViewportRectangle) return;
  proto.convertToViewportRectangle = function (this: typeof proto, r: number[]) {
    const [x0, y0] = this.convertToViewportPoint(r[0]!, r[1]!);
    const [x1, y1] = this.convertToViewportPoint(r[2]!, r[3]!);
    return [x0!, y0!, x1!, y1!];
  };
}

/** Draws page `n` (1-based) into `canvas`, `width` CSS pixels wide. */
export async function drawPage(doc: PDFDocumentProxy, n: number, canvas: HTMLCanvasElement, width: number) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const ratio = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: (width / base.width) * ratio });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  // Height follows the width (CSS caps the width to the available space).
  canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
  await page.render({ canvas, viewport }).promise;
}
