// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Verifică compatibilitatea: ce se schimbă sau se pierde când documentul e salvat în alt format (.docx, .odt, .txt).
// Lista urmează exact ce fac exportatorii (docx.ts, odtExport.ts, plainExport.ts); când un exportator învață ceva nou,
// rândul de aici se scoate.
import type { JSONContent } from '@tiptap/react';
import { pageHeaderImage, pageWatermark, pageWatermarkImage, type PageSetup } from './format';

export type CompatFormat = 'docx' | 'odt' | 'txt';
export const COMPAT_FORMATS: { id: CompatFormat; name: string }[] = [
  { id: 'docx', name: '.docx' },
  { id: 'odt', name: '.odt' },
  { id: 'txt', name: '.txt (text simplu)' },
];

export interface CompatIssue { key: string; count: number; what: string; note: string }

/** Ce conține documentul (numărat o singură dată, folosit pentru toate formatele). */
export interface DocCounts {
  equations: number; charts: number; diagrams: number; images: number;
  toc: number; figures: number; index: number; bib: number;
  textBoxes: number; tables: number; comments: number; changes: number; footnotes: number; formatted: number;
}

export function countDoc(doc: JSONContent): DocCounts {
  const c: DocCounts = { equations: 0, charts: 0, diagrams: 0, images: 0, toc: 0, figures: 0, index: 0, bib: 0, textBoxes: 0, tables: 0, comments: 0, changes: 0, footnotes: 0, formatted: 0 };
  const comments = new Set<string>();
  const walk = (n: JSONContent) => {
    switch (n.type) {
      case 'image':
        if (n.attrs?.equation) c.equations++;
        else if (n.attrs?.chart) c.charts++;
        else if (n.attrs?.diagram) c.diagrams++;
        else c.images++;
        break;
      case 'tableOfContents': c.toc++; break;
      case 'tableOfFigures': c.figures++; break;
      case 'docIndex': case 'docAuthorities': c.index++; break;
      case 'bibliography': c.bib++; break;
      case 'textBox': c.textBoxes++; break;
      case 'table': c.tables++; break;
      case 'footnote': c.footnotes++; break;
      case 'text':
        for (const m of n.marks ?? []) {
          if (m.type === 'comment') comments.add(String(m.attrs?.id));
          else if (m.type === 'insertion' || m.type === 'deletion') c.changes++;
          else if (m.type !== 'link') { c.formatted++; break; }
        }
        break;
    }
    for (const k of n.content ?? []) walk(k);
  };
  walk(doc);
  c.comments = comments.size;
  return c;
}

const IMG_NOTE = 'apar ca imagini: se văd la fel, dar în alt program nu se mai pot modifica (în Cyber Office Studio, din fișierul Cyber Office Studio, da)';
const LIST_NOTE = 'ajung ca text obișnuit, fără numerele paginilor; în alt program nu se mai actualizează singure';

/** Ce se schimbă la salvarea în formatul dat. Lista e goală când documentul trece fără pierderi știute. */
export function compatIssues(c: DocCounts, page: PageSetup | undefined, fmt: CompatFormat): CompatIssue[] {
  const out: CompatIssue[] = [];
  const add = (key: string, count: number, what: string, note: string) => { if (count > 0) out.push({ key, count, what, note }); };
  if (fmt === 'txt') {
    add('fmt', c.formatted, 'Text formatat', 'fonturile, culorile, aldinul, cursivele și stilurile se pierd; rămâne doar textul');
    add('img', c.images + c.equations + c.charts + c.diagrams, 'Imagini, ecuații, grafice și diagrame', 'se pierd; rămân doar legendele lor');
    add('tbl', c.tables, 'Tabele', 'devin rânduri de text, cu celulele despărțite prin Tab');
    add('cmt', c.comments, 'Comentarii', 'se pierd');
    add('trk', c.changes, 'Modificări urmărite', 'se pierd marcajele; textul rămâne așa cum arată acum');
    add('fn', c.footnotes, 'Note de subsol', 'trec la sfârșitul textului, cu numere între paranteze');
    add('box', c.textBoxes, 'Casete de text', 'rămâne doar textul lor, în ordinea din document');
    return out;
  }
  // Ecuațiile se scriu ca ecuații adevărate (.docx: OMML, .odt: MathML; equationDocx.ts), care se pot modifica și în alt program.
  add('chart', c.charts, 'Grafice', IMG_NOTE);
  add('diag', c.diagrams, 'Diagrame', IMG_NOTE);
  // În .docx cuprinsul și listele de figuri (cu o etichetă) sunt câmpuri TOC, pe care Word le actualizează la deschidere.
  if (fmt === 'odt') add('toc', c.toc, 'Cuprins', LIST_NOTE);
  add('fig', c.figures, 'Liste de figuri sau tabele', fmt === 'odt' ? LIST_NOTE : 'devin câmpuri care se actualizează la deschidere, cu numerele paginilor; lista cu toate legendele (fără etichetă) ajunge ca text obișnuit');
  add('idx', c.index, 'Index', LIST_NOTE);
  add('bib', c.bib, 'Bibliografie', 'ajunge ca text obișnuit (sursele rămân scrise corect, dar nu se mai actualizează singure)');
  if (fmt === 'odt') {
    add('box', c.textBoxes, 'Casete de text', 'rămâne doar textul lor, ca paragrafe obișnuite (fără chenar, fundal și așezare lângă text)');
    add('cmt', c.comments, 'Comentarii', 'se pierd');
    add('trk', c.changes, 'Modificări urmărite', 'se salvează acceptate: textul adăugat rămâne, cel șters dispare, fără autor și dată');
    add('wm', pageWatermark(page) || pageWatermarkImage(page) ? 1 : 0, 'Filigran', 'se pierde');
    add('hdrimg', pageHeaderImage(page) ? 1 : 0, 'Imaginea din antet', 'se pierde (textul antetului rămâne)');
    add('lock', page?.restrict || page?.trackLock ? 1 : 0, 'Restricții de editare', 'se pierd: oricine poate modifica fișierul');
  }
  return out;
}
