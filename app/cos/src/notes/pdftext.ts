// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Textul unui PDF atașat la o notiță, ca să se găsească la căutare (facturi, contracte). Cu pdf.js (Apache-2.0),
// încărcat doar când atașezi un PDF. PDF-urile scanate (doar poze) nu au text; pentru ele există OCR în modulul PDF.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Cel mult atâtea pagini și caractere: caietul rămâne mic, iar căutarea găsește oricum facturile după primele pagini. */
const MAX_PAGES = 30;
const MAX_CHARS = 20000;

export async function pdfText(data: Uint8Array): Promise<string> {
  const doc = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
  try {
    let out = '';
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES) && out.length < MAX_CHARS; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      out += content.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim() + '\n';
    }
    return out.trim().slice(0, MAX_CHARS);
  } finally {
    await doc.loadingTask.destroy();
  }
}

/** Paginile PDF-ului ca poze PNG (pentru „🖨 Pagini”: PDF-ul ca imprimare în notiță), cel mult `max`, cu latura lungă de 1600 px. */
export async function pdfPageImages(data: Uint8Array, max: number): Promise<{ images: Blob[]; texts: string[]; pages: number }> {
  const doc = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
  const canvas = document.createElement('canvas');
  try {
    const images: Blob[] = [], texts: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, max); i++) {
      const pg = await doc.getPage(i);
      const base = pg.getViewport({ scale: 1 });
      const vp = pg.getViewport({ scale: Math.min(2.5, 1600 / Math.max(base.width, base.height)) });
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      const b = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
      // Textul paginii ține loc de OCR (pagina are deja text); o pagină scanată rămâne fără, deci se citește cu OCR.
      const t = (await pg.getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim();
      if (b) { images.push(b); texts.push(t); }
      pg.cleanup();
    }
    return { images, texts, pages: doc.numPages };
  } finally {
    canvas.width = canvas.height = 0;
    await doc.loadingTask.destroy();
  }
}
