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
  return getDocument({ data, useSystemFonts: false, verbosity: 0 }).promise;
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
