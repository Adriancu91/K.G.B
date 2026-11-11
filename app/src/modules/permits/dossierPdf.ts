// The papers K.G.B. makes for a dossier (7.9b): the list of documents (opis), numbered, with what is ticked and
// what mandatory document is still missing, and a cover letter to the institution (adresă de înaintare) filled in
// with the firm's data. They are PDFs made with pdf-lib and the app's own font; the institution's official form,
// where it has one, stays a document of the checklist.
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import regularUrl from "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url";
import boldUrl from "pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url";

export interface DossierInfo {
  titlu: string;
  procedura: string;
  institutie: string;
  client: string;
  azi: string;
  documente: { text: string; obligatoriu: boolean; bifat: boolean }[];
  atasate: string[];
  firma: { nume: string; cui: string; adresa: string; reprezentant: string; telefon: string; email: string };
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;

async function fonts(doc: PDFDocument) {
  doc.registerFontkit(fontkit);
  const get = async (u: string) => new Uint8Array(await (await fetch(u)).arrayBuffer());
  return { reg: await doc.embedFont(await get(regularUrl), { subset: true }), bold: await doc.embedFont(await get(boldUrl), { subset: true }) };
}

/** Writes `text` wrapped to the width, from `y` down; new pages as needed. Returns the page and the next y. */
function para(doc: PDFDocument, page: PDFPage, y: number, text: string, font: PDFFont, size: number, indent = 0): [PDFPage, number] {
  const width = A4[0] - 2 * MARGIN - indent;
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    let line = "";
    for (const w of raw.split(/\s+/)) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    lines.push(line);
  }
  for (const l of lines) {
    if (y < MARGIN + size) {
      page = doc.addPage(A4);
      y = A4[1] - MARGIN;
    }
    page.drawText(l, { x: MARGIN + indent, y, size, font, color: rgb(0.1, 0.1, 0.1) });
    y -= size * 1.35;
  }
  return [page, y];
}

const date = (iso: string) => iso.split("-").reverse().join(".");

/** Opis: the documents of the dossier, numbered, with their state. */
export async function opisPdf(d: DossierInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f = await fonts(doc);
  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  [page, y] = para(doc, page, y, "OPIS", f.bold, 16);
  [page, y] = para(doc, page, y, `Dosar: ${d.titlu}`, f.bold, 11);
  [page, y] = para(doc, page, y, `Procedura: ${d.procedura}${d.institutie ? ` · ${d.institutie}` : ""}`, f.reg, 10);
  if (d.firma.nume) [page, y] = para(doc, page, y, `Solicitant: ${d.firma.nume}${d.firma.cui ? `, CUI ${d.firma.cui}` : ""}`, f.reg, 10);
  if (d.client) [page, y] = para(doc, page, y, `Pentru: ${d.client}`, f.reg, 10);
  [page, y] = para(doc, page, y, `Data: ${date(d.azi)}`, f.reg, 10);
  y -= 8;
  [page, y] = para(doc, page, y, "Documentele dosarului", f.bold, 12);
  d.documente.forEach((x, i) => {
    const state = x.bifat ? "pregătit" : x.obligatoriu ? "LIPSEȘTE (obligatoriu)" : "dacă e cazul";
    [page, y] = para(doc, page, y, `${i + 1}. ${x.text} — ${state}`, f.reg, 10, 0);
  });
  if (d.atasate.length) {
    y -= 8;
    [page, y] = para(doc, page, y, "Fișierele din acest folder", f.bold, 12);
    d.atasate.forEach((n, i) => {
      [page, y] = para(doc, page, y, `${String(i + 1).padStart(2, "0")} ${n}`, f.reg, 10);
    });
  }
  y -= 8;
  [page, y] = para(doc, page, y, "Listă pregătită cu K.G.B. după procedura din „Permise și autorizații”; verificați la instituție lista actuală înainte de depunere.", f.reg, 8);
  return doc.save();
}

/** Adresă de înaintare: the letter that goes on top of the dossier, to the institution. */
export async function coverLetterPdf(d: DossierInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f = await fonts(doc);
  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  const blank = "........................";
  const firm = d.firma;
  if (firm.nume) {
    [page, y] = para(doc, page, y, firm.nume, f.bold, 11);
    const contact = [firm.cui && `CUI ${firm.cui}`, firm.adresa, firm.telefon && `tel. ${firm.telefon}`, firm.email].filter(Boolean).join(" · ");
    if (contact) [page, y] = para(doc, page, y, contact, f.reg, 9);
  }
  y -= 18;
  [page, y] = para(doc, page, y, `Către: ${d.institutie || blank}`, f.bold, 11);
  y -= 14;
  [page, y] = para(doc, page, y, "ADRESĂ DE ÎNAINTARE", f.bold, 14);
  y -= 6;
  const who = firm.nume
    ? `Subscrisa ${firm.nume}${firm.cui ? `, CUI ${firm.cui}` : ""}${firm.adresa ? `, cu sediul în ${firm.adresa}` : ""}${firm.reprezentant ? `, reprezentată prin ${firm.reprezentant}` : ""}`
    : `Subsemnatul/Subscrisa ${blank}, cu sediul/domiciliul în ${blank}`;
  const body = `${who}, vă înaintăm dosarul pentru „${d.procedura}”${d.client ? `, privind ${d.client}` : ""}, conținând documentele enumerate în opisul anexat (${d.documente.length} poziții).`;
  [page, y] = para(doc, page, y, body, f.reg, 11);
  y -= 6;
  [page, y] = para(doc, page, y, "Vă rugăm să ne comunicați orice completare necesară la datele de contact de mai sus.", f.reg, 11);
  y -= 30;
  [page, y] = para(doc, page, y, `Data: ${date(d.azi)}`, f.reg, 11);
  [page, y] = para(doc, page, y, `Semnătura și ștampila: ${blank}`, f.reg, 11);
  y -= 30;
  [page, y] = para(doc, page, y, "Formularul oficial de cerere al instituției, dacă procedura are unul, se completează separat și se pune în dosar.", f.reg, 8);
  return doc.save();
}
