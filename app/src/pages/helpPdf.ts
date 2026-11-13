// The user's guide as a PDF (8.9): the same chapters as the „Ajutor” page, in the language shown, with the app's
// own font (pdf-lib, as for the dossier papers).
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import regularUrl from "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url";
import boldUrl from "pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url";
import type { Chapter } from "./HelpPage";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;

function para(doc: PDFDocument, page: PDFPage, y: number, text: string, font: PDFFont, size: number): [PDFPage, number] {
  const width = A4[0] - 2 * MARGIN;
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  lines.push(line);
  for (const l of lines) {
    if (y < MARGIN + size) {
      page = doc.addPage(A4);
      y = A4[1] - MARGIN;
    }
    page.drawText(l, { x: MARGIN, y, size, font, color: rgb(0.1, 0.1, 0.1) });
    y -= size * 1.4;
  }
  return [page, y];
}

/** The chapters as they are shown (the page translates the text, so the PDF takes it from the page when it can). */
export async function guidePdf(chapters: Chapter[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const get = async (u: string) => new Uint8Array(await (await fetch(u)).arrayBuffer());
  const reg = await doc.embedFont(await get(regularUrl), { subset: true });
  const bold = await doc.embedFont(await get(boldUrl), { subset: true });
  const shown = (id: string) => document.querySelector<HTMLElement>(`[data-chapter="${id}"]`);
  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  const head = document.querySelector("main .page-head h1")?.textContent ?? "K.G.B.";
  [page, y] = para(doc, page, y, `K.G.B. — ${head}`, bold, 18);
  y -= 10;
  for (const c of chapters) {
    const el = shown(c.id);
    const title = el?.querySelector("h2")?.textContent ?? c.title;
    const paras = el ? [...el.querySelectorAll("p")].map((p) => p.textContent ?? "") : c.paras;
    y -= 8;
    [page, y] = para(doc, page, y, title, bold, 13);
    for (const p of paras) {
      [page, y] = para(doc, page, y, p, reg, 10.5);
      y -= 4;
    }
  }
  doc.setTitle("K.G.B.");
  return doc.save();
}
