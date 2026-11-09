// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Date → Preluare date → Din PDF…: tabelele unui PDF (facturi, extrase de cont, liste de prețuri) ajung în Sheets, cu aceeași
// citire ca butonul → Sheets din modulul PDF (pdf/toSheet.ts). pdf.js (Apache-2.0) se încarcă doar când alegi un PDF.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { defuse } from '../pdf/guard';
import { pdfToSheet } from '../pdf/toSheet';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfSheet { content: string; tables: number; rows: number; scanned: number; pages: number }

export async function pdfFileToSheet(data: Uint8Array, title: string, progress?: (page: number, pages: number) => void): Promise<PdfSheet> {
  // pdf.js își ia octeții pentru el (îi mută în alt fir), deci îi dăm o copie.
  const doc = await pdfjs.getDocument({ data: defuse(data.slice()).data, isEvalSupported: false }).promise;
  try {
    const r = await pdfToSheet(doc, title, (n) => progress?.(n, doc.numPages));
    return { ...r, pages: doc.numPages };
  } finally {
    void doc.loadingTask.destroy();
  }
}
