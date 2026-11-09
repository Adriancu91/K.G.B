// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tipărirea directă (Ctrl+P) cu antetele pe care tipărirea obișnuită nu le poate pune: numerele paginilor, sigla,
// prima pagină / paginile pare diferite și antetul propriu al fiecărei secțiuni. Fereastra imprimantei din Chromium
// primește doar un rând de text sus și jos, așa că tipărim chiar PDF-ul făcut de aplicație (același ca la Export PDF):
// fiecare pagină desenată cu pdf.js (Apache-2.0) ca imagine de 300 dpi, una pe foaie, fără margini.
// Paginile se desenează una câte una (pe laptop cu 8 GB, o pagină A4 desenată ține ~35 MB doar cât se face imaginea).

type PdfDoc = { numPages: number; getPage(n: number): Promise<any>; loadingTask: { destroy(): Promise<void> } }; // eslint-disable-line @typescript-eslint/no-explicit-any

const DPI = 300;

/** Pune paginile PDF-ului în document (ascunse pe ecran), tipărește și le scoate. Întoarce numărul de pagini tipărite. */
export async function printPdfPages(data: Uint8Array, print: () => Promise<boolean>): Promise<number> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = (await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise) as unknown as PdfDoc;
  const box = document.createElement('div');
  box.className = 'doc-raster';
  const style = document.createElement('style');
  const urls: string[] = [];
  const sizes = new Map<string, string>();
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const v1 = pg.getViewport({ scale: 1 });
      const v = pg.getViewport({ scale: DPI / 72 });
      const c = document.createElement('canvas');
      c.width = Math.round(v.width); c.height = Math.round(v.height);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise;
      // Pentru teste: culoarea din colțul primei pagini (marginea foii trebuie să fie albă și cu tema întunecată).
      if (p === 1) (window as unknown as { __suiteRasterCorner?: number[] }).__suiteRasterCorner = [...ctx.getImageData(4, 4, 1, 1).data].slice(0, 3);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.95));
      c.width = c.height = 0;
      pg.cleanup?.();
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      // Foile pot avea mărimi diferite (o secțiune culcată): fiecare mărime are pagina ei cu nume (@page).
      const w = Math.round(v1.width * 100) / 100, h = Math.round(v1.height * 100) / 100;
      const key = `${w}x${h}`;
      if (!sizes.has(key)) sizes.set(key, `doc-raster-${sizes.size}`);
      const sheet = document.createElement('div');
      sheet.className = 'doc-raster-page';
      sheet.style.cssText = `page: ${sizes.get(key)}; width: ${w}pt; height: ${h}pt;`;
      const img = document.createElement('img');
      img.src = url; img.alt = `Pagina ${p}`;
      sheet.append(img);
      box.append(sheet);
    }
    style.textContent = [...sizes].map(([key, name]) => { const [w, h] = key.split('x'); return `@page ${name} { size: ${w}pt ${h}pt; margin: 0; }`; }).join('');
    document.head.append(style);
    document.body.append(box);
    await Promise.all([...box.querySelectorAll('img')].map((i) => i.decode().catch(() => undefined)));
    document.documentElement.classList.add('doc-raster-print');
    (window as unknown as { __suiteRasterPages?: number }).__suiteRasterPages = box.childElementCount;
    await print();
    return box.childElementCount;
  } finally {
    document.documentElement.classList.remove('doc-raster-print');
    box.remove(); style.remove();
    urls.forEach((u) => URL.revokeObjectURL(u));
    void doc.loadingTask.destroy();
  }
}
