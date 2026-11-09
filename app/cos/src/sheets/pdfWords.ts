// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Bucățile de text ale unui PDF, cu poziția lor (pentru extrasul de cont din PDF). Cu pdf.js (Apache-2.0), încărcat doar la import.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfWord } from './bankStatement';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Cel mult atâtea pagini: un extras pe un an are rar mai mult. */
const MAX_PAGES = 200;

export async function pdfWords(data: Uint8Array): Promise<{ words: PdfWord[]; pages: number }> {
  const doc = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
  try {
    const words: PdfWord[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      for (const it of tc.items) {
        if (!('str' in it) || !it.str.trim()) continue;
        const [a, b, c, d, x, y] = it.transform as number[];
        // Textul rotit (ștampile, margini scrise vertical) nu e din tabel.
        if (Math.abs(b) > 0.01 * Math.abs(a) || Math.abs(c) > 0.01 * Math.abs(d)) continue;
        words.push({ str: it.str, x, y, w: it.width, h: it.height || Math.abs(d), page: p });
      }
    }
    return { words, pages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}
