// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Export .docx: transformă documentul (JSON TipTap) într-un fișier Word.
// Biblioteca `docx` (MIT) se încarcă doar la export, ca pornirea să rămână rapidă.
import type { JSONContent } from '@tiptap/react';
import { DROP_EMPTY, decodeDrop, encodeDrop } from './formDropData';
import { cleanDate, dateText } from './formDate';
import type { Restrict, DocLabel } from './format';
import { customPropsXml } from './format';
import { FIELD_INSTR, fieldKindOf, macroBtnInstr } from './field';
import { clampOffset, isFloating } from './floating';
import { parseReplies } from './comment';
import { figureEntriesJson, figuresTitle } from './figuresTable';
import { indexLinesJson } from './indexEntry';
import { authLinesJson, TOA_TITLE } from './authorities';
import { BIB_TITLE, citeTextJson, cleanStyle, docSourcesJson, refPieces } from './citation';
import { docxBorders } from './tableLines';
import { docxCellBorders } from './cellLines';
import { tocLevels } from './toc';
import type * as D from 'docx';
import { docxRun } from './docStyles';
import { parseBoxLook } from './paragraphBox';
import { parseEquation } from './equation';
import { equationMath } from './equationDocx';

/** Chenarul paragrafului în .docx (w:pBdr): laturile alese, linia (grosimea în optimi de punct) și culoarea. */
function boxBorders(lib: typeof D, lookText: unknown) {
  const l = parseBoxLook(lookText);
  const style = { single: lib.BorderStyle.SINGLE, thick: lib.BorderStyle.SINGLE, double: lib.BorderStyle.DOUBLE, dashed: lib.BorderStyle.DASHED, dotted: lib.BorderStyle.DOTTED }[l.line];
  const size = l.line === 'thick' ? 18 : l.line === 'double' ? 4 : 6;
  const sides = l.sides === 'all' ? ['top', 'bottom', 'left', 'right'] : l.sides === 'tb' ? ['top', 'bottom'] : [l.sides];
  return Object.fromEntries(sides.map((k) => [k, { style, size: l.sides === 'left' ? 24 : size, color: l.color.slice(1).toUpperCase(), space: 4 }]));
}
import { HEADER_IMAGE_H, HEADER_IMAGE_MAX_W, pageHeaderImage, lineNums, docProps, pageBackground, pageBorder, type PageBorder, pageColumns, pageColLine, pageEven, pageFirst, pageMargins, hfSlots, numTokens, pageNumAt, pageNumStyle, pageWatermark, pageWatermarkColor, pageWatermarkFont, pageWatermarkImage, paperSize, type PageSetup } from './format';
import { WORD_UNDERLINE, type UnderlineStyle } from './underlineStyle';

/** mm → twips (1 mm = 56,69 twips; A4 = 11906 × 16838). */
const tw = (mm: number) => Math.round(mm * 56.693);
import { isLigatures, proofLangOf, spacingPt, type Ligatures } from './letterFormat';

// Biblioteca docx nu are w:outline și w:shadow: le scriem ca efecte vechi (w:effect, folosite doar ca semn) și le înlocuim după (textEffects).
const FX_OUTLINE = 'antsBlack', FX_SHADOW = 'antsRed', FX_BOTH = 'sparkle', FX_GLOW = 'lights';
// Strălucirea, cum o scrie Word (Efecte text → Strălucire): w14:glow la sfârșitul w:rPr, rază 8 pt, auriu, 60% opac.
// Ligaturile: semnul de lucru e lățimea literelor w:w de 1–5% (pe care nu o scriem altfel), înlocuită apoi cu w14:ligatures.
const LIG_CODES: Ligatures[] = ['none', 'standard', 'standardContextual', 'historicalDiscretional', 'all'];
const GLOW_XML = '<w14:glow w14:rad="101600"><w14:srgbClr w14:val="FFC000"><w14:alpha w14:val="40000"/></w14:srgbClr></w14:glow>';
import { bulletSymbol } from './listStyle';
import { sectionHf, sectionKind, sectionMargin, sectionOrient, type SectionKind, type SectionOrient } from './sectionKinds';
import { parseStops } from './tabStops';

type Lib = typeof D;
type Child = D.Paragraph | D.Table;

interface Ctx {
  lib: Lib;
  // Adâncimea în liste și tipul listei curente, pentru buline și numerotare.
  // „styled”: listă cu buline alese (✓, –…), scrisă tot ca numerotare proprie (ul0, ul1…).
  list: { kind: 'bullet' | 'ordered' | 'styled'; level: number; ref: string } | null;
  quote: boolean;
  orderedCount: number;
  /** Numărul de început al fiecărei liste numerotate (ol0, ol1…). */
  olStart: number[];
  /** Stilul fiecărei liste numerotate (a., I., 1)…) și al fiecărei liste cu buline alese. */
  olStyle: (string | null)[];
  ulStyles: string[];
  headings: { level: number; text: string }[];
  /** Documentul întreg (pentru Tabelul de figuri). */
  root: JSONContent;
  /** Comentariile: numărul lor în Word și câte bucăți de text comentat mai urmează. */
  notes: Map<string, Note>;
  /** Numărul următoarei modificări urmărite (Word cere numere unice). */
  revId: number;
  /** Caseta de text în care stă paragraful curent (cadru Word). */
  frame?: { align: string; width: number; border: string | null; fill: string | null } | null;
}

interface Note { num: number; left: number; started: boolean; text: string; author: string; date: string; done: boolean; replies: { num: number; author: string; date: string; text: string }[] }

// Comentariile din document (marcaje „comment” pe text), cu numărul de bucăți de text pe care le acoperă.
function collectNotes(doc: JSONContent): Map<string, Note> {
  const notes = new Map<string, Note>();
  const walk = (n: JSONContent) => {
    for (const m of n.type === 'text' ? n.marks ?? [] : []) {
      if (m.type !== 'comment') continue;
      const id = String(m.attrs?.id);
      const c = notes.get(id);
      if (c) c.left++;
      else notes.set(id, { num: notes.size + 1, left: 1, started: false, text: String(m.attrs?.text ?? ''), author: String(m.attrs?.author ?? ''), date: String(m.attrs?.date ?? ''), done: m.attrs?.done === '1',
        replies: parseReplies(m.attrs?.replies).map((r) => ({ ...r, num: 0 })) });
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  // Răspunsurile sunt în Word comentarii separate, legate de comentariul de sus (commentsExtended); primesc numerele de după.
  let next = notes.size + 1;
  for (const c of notes.values()) for (const r of c.replies) r.num = next++;
  return notes;
}

/** Semnul întreruperii de secțiune în lista de paragrafe (vezi splitSections). */
const SECT = '__suiteSection';
/** Felul secțiunii în biblioteca .docx (w:type din w:sectPr). */
const SECTION_TYPE = (lib: typeof D) => ({
  nextPage: lib.SectionType.NEXT_PAGE, continuous: lib.SectionType.CONTINUOUS, evenPage: lib.SectionType.EVEN_PAGE, oddPage: lib.SectionType.ODD_PAGE,
});
/**
 * Paragrafele împărțite în secțiuni, la semnele întreruperilor de secțiune. Felul unei secțiuni e felul întreruperii dinaintea ei
 * (în .docx, w:type spune cum începe secțiunea față de cea de dinainte).
 */
type Part = { kind: SectionKind; orient: SectionOrient; margin: number; hdr?: string | null; ftr?: string | null; items: D.FileChild[] };
function splitSections(children: D.FileChild[]): Part[] {
  const parts: Part[] = [{ kind: 'nextPage', orient: '', margin: 0, items: [] }];
  for (const c of children) {
    const k = (c as unknown as Record<string, unknown>)[SECT] as Omit<Part, 'items'> | undefined;
    if (k) parts.push({ ...k, items: [] });
    else parts[parts.length - 1].items.push(c);
  }
  return parts;
}

export async function docToDocx(doc: JSONContent, page?: PageSetup): Promise<Uint8Array> {
  const lib = await import('docx');
  const notes = collectNotes(doc);
  const ctx: Ctx = { lib, list: null, quote: false, orderedCount: 0, olStart: [], olStyle: [], ulStyles: [], headings: collectHeadings(doc), root: doc, notes, revId: 1 };
  const children = blocks(doc.content ?? [], ctx);
  // Fiecare listă numerotată primește propria referință, ca numerotarea să înceapă de la 1.
  // Felul numerotării de pe primul nivel (Buline și numerotare); nivelurile de dedesubt rămân 1. / a. / i.
  const FIRST: Record<string, [(typeof D.LevelFormat)[keyof typeof D.LevelFormat], string]> = {
    'decimal-paren': [lib.LevelFormat.DECIMAL, '%1)'], 'lower-alpha': [lib.LevelFormat.LOWER_LETTER, '%1.'], 'upper-alpha': [lib.LevelFormat.UPPER_LETTER, '%1.'],
    'lower-roman': [lib.LevelFormat.LOWER_ROMAN, '%1.'], 'upper-roman': [lib.LevelFormat.UPPER_ROMAN, '%1.'],
  };
  const first = (i: number, level: number) => (level === 0 ? FIRST[ctx.olStyle[i] ?? ''] : undefined);
  const numbering = Array.from({ length: ctx.orderedCount }, (_, i) => ({
    reference: `ol${i}`,
    levels: [0, 1, 2, 3, 4, 5].map((level) => ({
      level,
      // Pe niveluri: toate nivelurile cu cifre, fiecare cu numerele celor de deasupra (%1.%2.%3.).
      format: ctx.olStyle[i] === 'outline' ? lib.LevelFormat.DECIMAL : first(i, level)?.[0] ?? [lib.LevelFormat.DECIMAL, lib.LevelFormat.LOWER_LETTER, lib.LevelFormat.LOWER_ROMAN][level % 3],
      text: ctx.olStyle[i] === 'outline' ? Array.from({ length: level + 1 }, (_, k) => `%${k + 1}`).join('.') + '.' : first(i, level)?.[1] ?? `%${level + 1}.`,
      start: level === 0 ? ctx.olStart[i] ?? 1 : 1,
      alignment: lib.AlignmentType.START,
      style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
    })),
  }));
  // Listele cu buline alese: simbolul lor pe primul nivel, ◦ și ▪ mai jos.
  ctx.ulStyles.forEach((style, i) => numbering.push({
    reference: `ul${i}`,
    levels: [0, 1, 2, 3, 4, 5].map((level) => ({
      level,
      format: lib.LevelFormat.BULLET,
      text: level === 0 ? bulletSymbol(style) : ['◦', '▪'][(level - 1) % 2],
      start: 1,
      alignment: lib.AlignmentType.START,
      style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
    })),
  }));
  const file = new lib.Document({
    // Pagini pare diferite: w:evenAndOddHeaders în settings.xml, plus antetul / subsolul „even” din secțiune.
    ...(pageEven(page) ? { evenAndOddHeaderAndFooters: true } : {}),
    // Despărțirea automată în silabe (Aspect → Despărțire în silabe): w:autoHyphenation în settings.xml.
    ...(page?.hyphenate ? { hyphenation: { autoHyphenation: true } } : {}),
    // Cu cuprins sau listă de figuri: Word întreabă la deschidere dacă actualizează câmpurile (și pune numerele de pagină).
    ...(/"(tableOfContents|tableOfFigures)"/.test(JSON.stringify(doc)) ? { features: { updateFields: true } } : {}),
    // Proprietățile documentului (Fișier → Informații în Word).
    creator: docProps(page)?.author ?? 'Cyber Office Studio',
    ...(docProps(page)?.title ? { title: docProps(page)!.title } : {}),
    ...(docProps(page)?.subject ? { subject: docProps(page)!.subject } : {}),
    ...(docProps(page)?.keywords ? { keywords: docProps(page)!.keywords } : {}),
    // Culoarea paginii (Word: Proiectare → Culoare pagină).
    ...(pageBackground(page) ? { background: { color: pageBackground(page).slice(1).toUpperCase() } } : {}),
    styles: {
      // Stilurile schimbate în document (Modifică stilul): Normal, Title, Heading1–3.
      default: {
        document: { run: { font: 'Calibri', size: 22, ...docxRun(page?.styles?.normal) } },
        ...(page?.styles?.title ? { title: { run: docxRun(page.styles.title) } } : {}),
        ...(page?.styles?.h1 ? { heading1: { run: docxRun(page.styles.h1) } } : {}),
        ...(page?.styles?.h2 ? { heading2: { run: docxRun(page.styles.h2) } } : {}),
        ...(page?.styles?.h3 ? { heading3: { run: docxRun(page.styles.h3) } } : {}),
      },
      // Subtitlul din Word (gri, litere puțin rărite); Titlul există deja în stilurile implicite ale bibliotecii.
      paragraphStyles: [{ id: 'Subtitle', name: 'Subtitle', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { color: '5A5A5A', characterSpacing: 15 }, paragraph: { spacing: { after: 160 } } },
        // Legenda (Figura 1, Tabelul 1), cu numele stilului din Word, ca să intre în „Tabel de figuri”.
        { id: 'Caption', name: 'caption', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { italics: true, size: 18, color: '44546A' }, paragraph: { spacing: { after: 200 } } },
        // Stilurile noi, create în document, cu numele lor (în Word apar în galeria de stiluri).
        ...(page?.styles?.custom ?? []).map((c) => ({ id: 'Suite' + c.id, name: c.name, basedOn: 'Normal', quickFormat: true, run: docxRun(c.def) }))],
    },
    numbering: { config: numbering },
    comments: {
      children: [...notes.values()].flatMap((c) => [c, ...c.replies.map((r) => ({ ...r, parent: c.num }))].map((x) => ({
        id: x.num,
        author: x.author || 'Autor',
        initials: initials(x.author || 'Autor'),
        date: x.date && !Number.isNaN(Date.parse(x.date)) ? new Date(x.date) : undefined,
        ...('parent' in x ? { parentId: x.parent } : {}),
        ...(!('parent' in x) && x.done ? { resolved: true } : {}),
        children: (x.text || ' ').split('\n').map((line) => new lib.Paragraph({ children: [new lib.TextRun(line)] })),
      }))),
    },
    sections: splitSections(children).map((part, si) => ({
      // A4 (în twips); marginile din mm (1 mm = 56,7 twips).
      properties: { ...(si ? { type: SECTION_TYPE(lib)[part.kind] } : {}), page: {
        size: (part.orient ? part.orient === 'landscape' : page?.landscape)
          ? { width: tw(paperSize({ ...page, landscape: false } as PageSetup).w), height: tw(paperSize({ ...page, landscape: false } as PageSetup).h), orientation: lib.PageOrientation.LANDSCAPE } // biblioteca le inversează singură
          : { width: tw(paperSize({ ...page, landscape: false } as PageSetup).w), height: tw(paperSize({ ...page, landscape: false } as PageSetup).h) },
        // Marginile secțiunii (Doar secțiunea aceasta), altfel ale documentului.
        margin: Object.fromEntries((['top', 'bottom', 'left', 'right'] as const).map((k) => [k, Math.round((part.margin || pageMargins(page)[k]) * 56.7)])),
        ...(pageBorder(page) ? { borders: pageBordersFor(lib, pageBorder(page) as PageBorder) } : {}),
      }, ...(pageFirst(page) ? { titlePage: true } : {}), ...(pageColumns(page) > 1 ? { column: { count: pageColumns(page), space: 709, equalWidth: true, ...(pageColLine(page) ? { separate: true } : {}) } } : {}),
        ...(lineNums(page) ? { lineNumbers: { countBy: lineNums(page)!.by ?? 1, restart: lineNums(page)!.page ? lib.LineNumberRestartFormat.NEW_PAGE : lib.LineNumberRestartFormat.CONTINUOUS, distance: 360 } } : {}) },
      children: part.items.length ? part.items : [new lib.Paragraph('')],
      // Secțiunile de după prima preiau antetul și subsolul de dinainte (ca „Legat de anterior”), afară de cele cu antet / subsol propriu.
      ...(si ? sectionHeaderFooter(lib, page, part.hdr ?? null, part.ftr ?? null) : headerFooter(lib, page)),
    })),
  });
  const blob = await lib.Packer.toBlob(file);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const alts = /"alt(?:Title|Desc)":"/.test(JSON.stringify(doc)) ? await tableAlts(bytes, doc) : bytes;
  const fx = /"(?:textEffect|ligatures)":"/.test(JSON.stringify(doc)) ? await textEffects(alts) : alts;
  const fmt = /"formatChange"/.test(JSON.stringify(doc)) ? await fullRprChange(fx) : fx;
  const seq = /"(captionNum|docField|macroBtn|tableOfContents|tableOfFigures|formDrop|formDate)"/.test(JSON.stringify(doc)) ? await seqFields(fmt) : fmt;
  const marked = pageWatermarkImage(page) ? await addImageWatermark(seq, pageWatermarkImage(page)) : pageWatermark(page) ? await addWatermark(seq, pageWatermark(page), pageWatermarkColor(page), !!page?.watermarkFlat, pageWatermarkFont(page)) : seq;
  const label = docProps(page)?.label;
  const fin = page?.final || label ? await markFinal(marked, !!page?.final, label) : marked;
  return page?.trackLock || page?.restrict ? lockTracking(fin, !!page.trackLock, page.restrict) : fin;
}

/**
 * Textul alternativ al tabelelor (w:tblCaption, w:tblDescription), la capătul lui w:tblPr. Biblioteca nu le scrie, deci se pun după:
 * tabelele din document.xml sunt în aceeași ordine ca în document (unul câte unul, inclusiv cele din celule); dacă numărul nu se potrivește, nu se scrie nimic.
 */
async function tableAlts(bytes: Uint8Array, doc: JSONContent): Promise<Uint8Array> {
  const list: { t?: string; d?: string }[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === 'table') list.push({ t: n.attrs?.altTitle || undefined, d: n.attrs?.altDesc || undefined });
    n.content?.forEach(walk);
  };
  walk(doc);
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml || (xml.match(/<w:tbl>/g) ?? []).length !== list.length) return bytes;
  let i = 0;
  const out = xml.replace(/<w:tbl><w:tblPr>((?:(?!<[/]w:tblPr>)[^])*)<[/]w:tblPr>/g, (m, inner: string) => {
    const a = list[i++];
    if (!a?.t && !a?.d) return m;
    return `<w:tbl><w:tblPr>${inner}${a.t ? `<w:tblCaption w:val="${xmlEsc(a.t)}"/>` : ''}${a.d ? `<w:tblDescription w:val="${xmlEsc(a.d).replace(/\r?\n/g, '&#10;')}"/>` : ''}</w:tblPr>`;
  });
  zip.file('word/document.xml', out);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Schimbările de format urmărite: când formatul de dinainte era cel obișnuit, biblioteca scrie w:rPrChange gol, dar schema
 * cere în el un w:rPr (gol = fără format), altfel Word spune că fișierul e stricat.
 */
async function fullRprChange(bytes: Uint8Array): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return bytes;
  zip.file('word/document.xml', xml.replace(/<w:rPrChange( [^>]*)\/>/g, '<w:rPrChange$1><w:rPr/></w:rPrChange>'));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** Semnele w:effect de mai sus devin w:outline / w:shadow, la locul lor din w:rPr (după w:dstrike, înaintea lui w:emboss și a culorii). */
async function textEffects(bytes: Uint8Array): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return bytes;
  const AFTER = new RegExp('<w:(?:emboss|imprint|noProof|snapToGrid|vanish|webHidden|color|spacing|w|kern|position|sz|szCs|highlight|u|effect|bdr|shd|fitText|vertAlign|rtl|cs|em|lang|eastAsianLayout|specVanish|oMath)[ />]');
  const out = xml.replace(new RegExp('<w:rPr>((?:(?!</w:rPr>).)*)</w:rPr>', 'g'), (m, inner: string) => {
    const k = new RegExp('<w:effect w:val="(antsBlack|antsRed|sparkle|lights)"/>').exec(inner);
    const lg = /<w:w w:val="([1-5])"\/>/.exec(inner);
    if (!k && !lg) return m;
    let rest = lg ? inner.replace(lg[0], '') : inner;
    // w14:ligatures vine după w14:glow, la sfârșitul lui w:rPr (ordinea din schemă).
    const lig = lg ? `<w14:ligatures w14:val="${LIG_CODES[Number(lg[1]) - 1]}"/>` : '';
    if (!k) return '<w:rPr>' + rest + lig + '</w:rPr>';
    rest = rest.replace(k[0], '');
    if (k[1] === FX_GLOW) return '<w:rPr>' + rest + GLOW_XML + lig + '</w:rPr>';
    const add = (k[1] !== FX_SHADOW ? '<w:outline/>' : '') + (k[1] !== FX_OUTLINE ? '<w:shadow/>' : '');
    const at = rest.search(AFTER);
    return '<w:rPr>' + (at < 0 ? rest + add : rest.slice(0, at) + add + rest.slice(at)) + lig + '</w:rPr>';
  });
  zip.file('word/document.xml', out);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Blocarea urmăririi, cum o scrie Word: w:trackRevisions (urmărirea pornită) și w:documentProtection w:edit="trackedChanges" în settings.xml.
 * Cu restricționarea editării: w:edit="readOnly" / "comments", cu hash-ul parolei (SHA-512, sare, repetări), dacă are.
 */
async function lockTracking(bytes: Uint8Array, track = true, restrict?: Restrict): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const f = zip.file('word/settings.xml');
  if (!f) return bytes;
  let s = await f.async('string');
  s = s.replace(/<w:trackRevisions[^>]*\/>|<w:documentProtection[^>]*\/>/g, '');
  // Ordinea din schemă: trackRevisions, apoi documentProtection, ambele înaintea lui defaultTabStop / evenAndOddHeaders / compat.
  const editKind = restrict ? (restrict.mode === 'read' ? 'readOnly' : 'comments') : 'trackedChanges';
  const pw = restrict?.pw?.alg ? ` w:algorithmName="${restrict.pw.alg}" w:hashValue="${restrict.pw.hash}" w:saltValue="${restrict.pw.salt ?? ''}" w:spinCount="${restrict.pw.spin ?? 0}"` : '';
  const add = (track ? '<w:trackRevisions/>' : '') + `<w:documentProtection w:edit="${editKind}" w:enforcement="1"${pw}/>`;
  const at = s.search(/<w:(?:defaultTabStop|evenAndOddHeaders|compat)\b|<\/w:settings>/);
  s = at < 0 ? s : s.slice(0, at) + add + s.slice(at);
  zip.file('word/settings.xml', s);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * „Marcat ca final”, cum îl scrie Word: proprietatea _MarkAsFinal = adevărat în docProps/custom.xml. Word deschide atunci documentul
 * doar pentru citire, cu bara galbenă „Marcat ca final” și butonul „Editează oricum”.
 */
async function markFinal(bytes: Uint8Array, final = true, label?: DocLabel): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  // Și clasificarea: proprietatea „Clasificare” cu numele etichetei (Public, Uz general, Confidențial, Strict confidențial).
  zip.file('docProps/custom.xml', customPropsXml(final, label));
  let types = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
  if (!types.includes('/docProps/custom.xml')) {
    types = types.replace('</Types>', '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>');
    zip.file('[Content_Types].xml', types);
  }
  let rels = (await zip.file('_rels/.rels')?.async('string')) ?? '';
  if (!rels.includes('docProps/custom.xml')) {
    rels = rels.replace('</Relationships>', '<Relationship Id="rIdSuiteCustom" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>');
    zip.file('_rels/.rels', rels);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

const SEQ_OPEN = String.fromCharCode(0x27e6), SEQ_CLOSE = String.fromCharCode(0x27e7);
// Cuprinsul și lista de figuri: semnele începutului (cu instrucțiunea câmpului TOC) și sfârșitului, înlocuite în seqFields.
const TOC_OPEN = String.fromCharCode(0x2985), TOC_CLOSE = String.fromCharCode(0x2986);
// Câmpurile din text (field.ts): semnele dintre care se scoate instrucțiunea și rezultatul, înlocuite tot în seqFields.
const FLD_OPEN = String.fromCharCode(0x2983), FLD_SEP = String.fromCharCode(0x2980), FLD_CLOSE = String.fromCharCode(0x2984);
// Listele verticale (formDrop.ts): variantele și alegerea, codate între semne, înlocuite în seqFields cu w:sdt / w:dropDownList.
const DROP_OPEN = String.fromCharCode(0x2987), DROP_CLOSE = String.fromCharCode(0x2988);
// Selectoarele de dată (formDate.ts): data (AAAA-LL-ZZ, sau nimic) între semne, înlocuită în seqFields cu w:sdt / w:date.
const DATE_OPEN = String.fromCharCode(0x2989), DATE_CLOSE = String.fromCharCode(0x298a);

/**
 * Numerele legendelor devin câmpuri SEQ (begin / instrText / separate / rezultat / end), cu numărul deja scris, ca Word și
 * celelalte programe să-l arate fără actualizare, iar Word să-l poată renumerota. Biblioteca docx scrie câmpul fără rezultat.
 */
async function seqFields(bytes: Uint8Array): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return bytes;
  const re = new RegExp('<w:r>(<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)?<w:t xml:space="preserve">' + SEQ_OPEN + '([^ <]+) ([0-9]+)' + SEQ_CLOSE + '</w:t></w:r>', 'g');
  const out = xml.replace(re, (_m, rPr: string | undefined, label: string, n: string) => {
    const r = (inner: string) => '<w:r>' + (rPr ?? '') + inner + '</w:r>';
    return r('<w:fldChar w:fldCharType="begin"/>') + r('<w:instrText xml:space="preserve"> SEQ ' + label + ' \\* ARABIC </w:instrText>')
      + r('<w:fldChar w:fldCharType="separate"/>') + r('<w:t>' + n + '</w:t>') + r('<w:fldChar w:fldCharType="end"/>');
  });
  // Câmpurile din text (AUTHOR, NUMPAGES, DATE…): același câmp complet, cu rezultatul de acum.
  const fre = new RegExp('<w:r>(<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)?<w:t xml:space="preserve">' + FLD_OPEN + '([^<' + FLD_SEP + ']+)' + FLD_SEP + '([^<]*)' + FLD_CLOSE + '</w:t></w:r>', 'g');
  const out2 = out.replace(fre, (_m, rPr: string | undefined, instr: string, res: string) => {
    const r = (inner: string) => '<w:r>' + (rPr ?? '') + inner + '</w:r>';
    return r('<w:fldChar w:fldCharType="begin"/>') + r('<w:instrText xml:space="preserve"> ' + instr + ' </w:instrText>')
      + r('<w:fldChar w:fldCharType="separate"/>') + r('<w:t xml:space="preserve">' + res + '</w:t>') + r('<w:fldChar w:fldCharType="end"/>');
  });
  // Cuprinsul și lista de figuri: începutul câmpului TOC (begin / instrText / separate) și sfârșitul lui (end).
  const out3 = out2.replace(new RegExp('<w:r>(<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)?<w:t xml:space="preserve">' + TOC_OPEN + '([^<' + TOC_OPEN + ']+)' + TOC_OPEN + '</w:t></w:r>', 'g'),
    (_m, rPr: string | undefined, instr: string) => '<w:r>' + (rPr ?? '') + '<w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>')
    .replace(new RegExp('<w:r>(<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)?<w:t xml:space="preserve">' + TOC_CLOSE + '</w:t></w:r>', 'g'), '<w:r><w:fldChar w:fldCharType="end"/></w:r>');
  // Listele verticale: controlul de conținut cu w:dropDownList, cu alegerea de acum (sau textul de completat) în w:sdtContent.
  let dropId = 0;
  const out4 = out3.replace(new RegExp('<w:r>(<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)?<w:t xml:space="preserve">' + DROP_OPEN + '([^<' + DROP_CLOSE + ']*)' + DROP_CLOSE + '</w:t></w:r>', 'g'), (m, rPr: string | undefined, code: string) => {
    const d = decodeDrop(code);
    if (!d) return m;
    const list = d.items.map((it) => `<w:listItem w:displayText="${xmlEsc(it)}" w:value="${xmlEsc(it)}"/>`).join('');
    return `<w:sdt><w:sdtPr>${rPr ?? ''}<w:id w:val="${700000 + ++dropId}"/>` + (d.value ? '' : '<w:showingPlcHdr/>') + `<w:dropDownList>${list}</w:dropDownList></w:sdtPr>`
      + `<w:sdtContent><w:r>${rPr ?? ''}<w:t xml:space="preserve">${xmlEsc(d.value || DROP_EMPTY)}</w:t></w:r></w:sdtContent></w:sdt>`;
  });
  // Selectoarele de dată: controlul de conținut cu w:date (data întreagă, formatul zz.LL.aaaa, limba română), cu data scrisă.
  const out5 = out4.replace(new RegExp('<w:r>(<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)?<w:t xml:space="preserve">' + DATE_OPEN + '([0-9-]*)' + DATE_CLOSE + '</w:t></w:r>', 'g'), (_m, rPr: string | undefined, v: string) => {
    const value = cleanDate(v);
    return `<w:sdt><w:sdtPr>${rPr ?? ''}<w:id w:val="${700000 + ++dropId}"/>` + (value ? '' : '<w:showingPlcHdr/>')
      + `<w:date${value ? ` w:fullDate="${value}T00:00:00Z"` : ''}><w:dateFormat w:val="dd.MM.yyyy"/><w:lid w:val="ro-RO"/><w:storeMappedDataAs w:val="dateTime"/><w:calendar w:val="gregorian"/></w:date></w:sdtPr>`
      + `<w:sdtContent><w:r>${rPr ?? ''}<w:t xml:space="preserve">${xmlEsc(dateText({ value }))}</w:t></w:r></w:sdtContent></w:sdt>`;
  });
  zip.file('word/document.xml', out5);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Filigranul din imagine, cum îl scrie Word (Filigran → Filigran din imagine, cu Decolorare): o poză VML în antet, în mijlocul
 * paginii, în spatele textului, decolorată (gain / blacklevel). Poza intră în word/media, cu legătura ei în fiecare antet.
 */
async function addImageWatermark(bytes: Uint8Array, dataUrl: string): Promise<Uint8Array> {
  const m = /^data:image[/](png|jpeg);base64,(.+)$/.exec(dataUrl);
  if (!m) return bytes;
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const ext = m[1] === 'png' ? 'png' : 'jpeg';
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  // Mărimea: lățimea zonei de text de pe A4 (cel mult ~450 pt), cu proporțiile pozei.
  const size = imageSize(bin) ?? { w: 4, h: 3 };
  const w = 450, h = Math.round((450 * size.h) / Math.max(1, size.w));
  const [tw, th] = h > 620 ? [Math.round((w * 620) / h), 620] : [w, h];
  zip.file(`word/media/suite-watermark.${ext}`, bin);
  let types = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
  if (types && !new RegExp(`<Default Extension="${ext}"`, 'i').test(types)) types = types.replace('<Types ', '<Types ').replace(/(<Types[^>]*>)/, `$1<Default Extension="${ext}" ContentType="image/${ext}"/>`);
  if (types) zip.file('[Content_Types].xml', types);
  const NS_V = 'xmlns:v="urn:schemas-microsoft-com:vml"', NS_O = 'xmlns:o="urn:schemas-microsoft-com:office:office"', NS_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  for (const name of Object.keys(zip.files).filter((f) => /^word\/header\d*\.xml$/.test(f))) {
    const relName = name.replace('word/', 'word/_rels/') + '.rels';
    let rels = (await zip.file(relName)?.async('string')) ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    // O listă de legături goală e scrisă scurt (<Relationships …/>): o deschidem întâi.
    rels = rels.replace(/<Relationships([^>]*?)\s*\/>/, '<Relationships$1></Relationships>').replace('</Relationships>', `<Relationship Id="rIdSuiteWm" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/suite-watermark.${ext}"/></Relationships>`);
    zip.file(relName, rels);
    let xml = await zip.file(name)!.async('string');
    for (const ns of [NS_V, NS_O, NS_R]) if (!xml.includes(ns.split('=')[0] + '=')) xml = xml.replace('<w:hdr ', `<w:hdr ${ns} `);
    const shape = '<w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:pict>'
      + '<v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f"><v:stroke joinstyle="miter"/>'
      + '<v:formulas>' + ['if lineDrawn pixelLineWidth 0', 'sum @0 1 0', 'sum 0 0 @1', 'prod @2 1 2', 'prod @3 21600 pixelWidth', 'prod @3 21600 pixelHeight', 'sum @0 0 1', 'prod @6 1 2', 'prod @7 21600 pixelWidth', 'sum @8 21600 0', 'prod @7 21600 pixelHeight', 'sum @10 21600 0'].map((f) => `<v:f eqn="${f}"/>`).join('')
      + '</v:formulas><v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype>'
      + `<v:shape id="WordPictureWatermarkSuite1" o:spid="_x0000_s2050" type="#_x0000_t75" style="position:absolute;margin-left:0;margin-top:0;width:${tw}pt;height:${th}pt;z-index:-251656192;`
      + 'mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" o:allowincell="f">'
      + '<v:imagedata r:id="rIdSuiteWm" o:title="" gain="19661f" blacklevel="22938f"/></v:shape></w:pict></w:r></w:p>';
    zip.file(name, xml.replace('</w:hdr>', shape + '</w:hdr>'));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** Chenarul paginii ca în Word: la 24 pt de marginea foii, pe toate paginile. */
function pageBordersFor(lib: Lib, b: PageBorder) {
  const side = { style: b === 'double' ? lib.BorderStyle.DOUBLE : b === 'thick' ? lib.BorderStyle.THICK : lib.BorderStyle.SINGLE, size: b === 'thick' ? 18 : 6, color: '333333', space: 24 };
  return {
    pageBorders: { display: lib.PageBorderDisplay.ALL_PAGES, offsetFrom: lib.PageBorderOffsetFrom.PAGE },
    pageBorderTop: side, pageBorderBottom: side, pageBorderLeft: side, pageBorderRight: side,
  };
}

const xmlEsc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/**
 * Filigranul, cum îl scrie Word (Proiectare → Filigran): o formă cu text (WordArt VML) în antet, rotită, gri deschis,
 * în spatele textului, pe fiecare pagină. Biblioteca docx nu îl știe, așa că îl adăugăm în XML-ul antetului.
 * Culoarea aleasă devine fillcolor (fără ea, gri „silver”), iar filigranul orizontal nu are rotation.
 */
async function addWatermark(bytes: Uint8Array, text: string, color = '', flat = false, font = ''): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const shape = '<w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:pict>'
    + '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas>'
    + ['sum #0 0 10800', 'prod #0 2 1', 'sum 21600 0 @1', 'sum 0 0 @2', 'sum 21600 0 @3', 'if @0 @3 0', 'if @0 21600 @1', 'if @0 0 @2', 'if @0 @4 21600',
      'mid @5 @6', 'mid @8 @5', 'mid @7 @8', 'mid @6 @7', 'sum @6 0 @5'].map((f) => `<v:f eqn="${f}"/>`).join('')
    + '</v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/>'
    + '<v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>'
    + '<v:shape id="PowerPlusWaterMarkObject1" o:spid="_x0000_s2049" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:440pt;height:110pt;'
    + (flat ? '' : 'rotation:315;') + 'z-index:-251657216;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" '
    + `o:allowincell="f" fillcolor="${color || 'silver'}" stroked="f"><v:fill opacity=".5"/><v:textpath style="font-family:&quot;${xmlEsc(font || 'Calibri')}&quot;;font-size:1pt" string="${xmlEsc(text)}"/></v:shape>`
    + '</w:pict></w:r></w:p>';
  const NS_V = 'xmlns:v="urn:schemas-microsoft-com:vml"', NS_O = 'xmlns:o="urn:schemas-microsoft-com:office:office"';
  for (const name of Object.keys(zip.files).filter((f) => /^word\/header\d*\.xml$/.test(f))) {
    let xml = await zip.file(name)!.async('string');
    if (!xml.includes('xmlns:v=')) xml = xml.replace('<w:hdr ', `<w:hdr ${NS_V} `);
    if (!xml.includes('xmlns:o=')) xml = xml.replace('<w:hdr ', `<w:hdr ${NS_O} `);
    zip.file(name, xml.replace('</w:hdr>', shape + '</w:hdr>'));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

// Antetul (centrat) și subsolul (text la stânga, „Pagina 1 din 3” la dreapta), cu câmpuri de pagină pe care Word le completează.
// Cu „Prima pagină diferită”, prima pagină are antetul și subsolul ei (w:titlePg), de obicei goale.
type HF = { headers?: { default?: D.Header; first?: D.Header; even?: D.Header }; footers?: { default?: D.Footer; first?: D.Footer; even?: D.Footer } };
/** Antetul / subsolul propriu al unei secțiuni (doar w:type="default"; null = rămâne legat de cel de dinainte). */
function sectionHeaderFooter(lib: Lib, page: PageSetup | undefined, hdr: string | null, ftr: string | null): HF {
  if (!page || (hdr === null && ftr === null)) return {};
  const all = headerFooter(lib, { ...page, header: hdr ?? '', footer: ftr ?? '', firstPage: undefined, evenPage: undefined }, true);
  return { ...(hdr !== null ? { headers: { default: all.headers!.default } } : {}), ...(ftr !== null ? { footers: { default: all.footers!.default } } : {}) };
}

function headerFooter(lib: Lib, page?: PageSetup, force = false): HF {
  if (!page) return {};
  const small = { size: 18, color: '555555' };
  const first = pageFirst(page);
  // Numărul paginii: câmpurile PAGE / NUMPAGES, în forma aleasă.
  const numRun = () => new lib.TextRun({ ...small, children: numTokens(pageNumStyle(page)).map((t) => (t === 'P' ? lib.PageNumber.CURRENT : t === 'T' ? lib.PageNumber.TOTAL_PAGES : t)) });
  // Trei locuri (stânga, mijloc, dreapta) despărțite de tab-uri: unul la mijloc și unul la marginea din dreapta.
  const width = tw(paperSize(page).w) - Math.round((pageMargins(page).left + pageMargins(page).right) * 56.7);
  // Imaginea din antet (sigla), prima în paragraful antetului, la stânga, cât un rând mai înalt (proporțiile păstrate).
  const logo = /^data:image[/](png|jpeg);base64,(.+)$/.exec(pageHeaderImage(page));
  const logoRun = () => {
    if (!logo) return null;
    const bytes = Uint8Array.from(atob(logo[2]), (ch) => ch.charCodeAt(0));
    const s = imageSize(bytes) ?? { w: 4, h: 3 };
    const w = Math.min(HEADER_IMAGE_MAX_W, Math.round((s.w * HEADER_IMAGE_H) / s.h));
    return new lib.ImageRun({ type: logo[1] === 'png' ? 'png' : 'jpg', data: bytes, transformation: { width: w, height: Math.round((w * s.h) / s.w) }, altText: { name: 'Sigla', title: 'Sigla', description: 'Imaginea din antet' } });
  };
  const para = (text: string, top: boolean, numbers: boolean) => {
    const slots = hfSlots(text, top, numbers, pageNumAt(page));
    const runs: D.ParagraphChild[] = [];
    const lr = top ? logoRun() : null;
    if (lr) runs.push(lr);
    slots.forEach((s, i) => {
      if (i > 0 && (slots.slice(i).some((x) => x.text || x.num))) runs.push(new lib.TextRun({ ...small, children: [new lib.Tab()] }));
      if (s.text) runs.push(new lib.TextRun({ text: s.text + (s.num ? ' · ' : ''), ...small }));
      if (s.num) runs.push(numRun());
    });
    return new lib.Paragraph({
      tabStops: [{ type: lib.TabStopType.CENTER, position: Math.round(width / 2) }, { type: lib.TabStopType.RIGHT, position: width }],
      children: runs,
    });
  };
  const header = (text: string, numbers = page.numbers) => new lib.Header({ children: [para(text, true, numbers)] });
  const footer = (text: string, numbers: boolean) => new lib.Footer({ children: [para(text, false, numbers)] });
  const numTop = pageNumAt(page)[0] === 't';
  const out: HF = {};
  // Filigranul stă în antet (ca în Word), deci e nevoie de antet chiar dacă nu are text.
  if (force || page.header.trim() || pageWatermark(page) || pageWatermarkImage(page) || pageHeaderImage(page) || (numTop && page.numbers)) out.headers = { default: header(page.header) };
  if (force || page.footer.trim() || (!numTop && page.numbers)) out.footers = { default: footer(page.footer, page.numbers) };
  const even = pageEven(page);
  if (even) {
    out.headers = { default: header(page.header), ...out.headers, even: header(even.header) };
    out.footers = { default: footer(page.footer, page.numbers), ...out.footers, even: footer(even.footer, page.numbers) };
  }
  if (first) {
    out.headers = { ...out.headers, first: header(first.header, first.numbers) };
    out.footers = { ...out.footers, first: footer(first.footer, first.numbers) };
  }
  return out;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('').slice(0, 3);
}

// Titlurile documentului, pentru cuprins (fără cele din tabele, ca în editor).
function collectHeadings(doc: JSONContent): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  const text = (n: JSONContent): string => n.text ?? (n.content ?? []).map(text).join('');
  const walk = (n: JSONContent) => {
    if (n.type === 'heading') {
      const t = text(n).trim();
      if (t) out.push({ level: Number(n.attrs?.level) || 1, text: t });
    } else if (n.type !== 'table') (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return out;
}

function blocks(nodes: JSONContent[], ctx: Ctx): Child[] {
  return nodes.flatMap((n) => block(n, ctx));
}

function block(node: JSONContent, ctx: Ctx): Child[] {
  const { lib } = ctx;
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return node.attrs?.dropCap ? dropCap(node, ctx) : [paragraph(node, ctx)];
    case 'bulletList':
    case 'orderedList': {
      const prev = ctx.list;
      const kind = node.type === 'bulletList' ? 'bullet' : 'ordered';
      const level = prev ? prev.level + 1 : 0;
      const nested = prev?.kind === 'ordered';
      const style = typeof node.attrs?.listStyle === 'string' ? node.attrs.listStyle : null;
      if (kind === 'ordered' && !nested) { ctx.olStart[ctx.orderedCount] = Math.max(1, Number(node.attrs?.start) || 1); ctx.olStyle[ctx.orderedCount] = style; }
      const ref = kind === 'ordered' ? (nested ? prev!.ref : `ol${ctx.orderedCount++}`) : style ? `ul${ctx.ulStyles.push(style) - 1}` : '';
      ctx.list = { kind: kind === 'bullet' && style ? 'styled' : kind, level, ref };
      const out = (node.content ?? []).flatMap((item) => blocks(item.content ?? [], ctx));
      ctx.list = prev;
      return out;
    }
    case 'textBox': {
      // Caseta de text devine un cadru Word (w:framePr) cu chenar și fundal; paragrafele vecine cu același cadru stau în aceeași casetă.
      const prev = ctx.frame;
      ctx.frame = { align: String(node.attrs?.align ?? 'wrapRight'), width: Number(node.attrs?.width) || 240, border: hex(node.attrs?.border) ?? null, fill: hex(node.attrs?.fill) ?? null };
      const out = blocks(node.content ?? [], ctx);
      ctx.frame = prev;
      return out;
    }
    case 'blockquote': {
      const prev = ctx.quote;
      ctx.quote = true;
      const out = blocks(node.content ?? [], ctx);
      ctx.quote = prev;
      return out;
    }
    case 'horizontalRule':
      return [new lib.Paragraph({
        border: { bottom: { style: lib.BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
      })];
    case 'table':
      return [table(node, ctx)];
    case 'image': {
      // Word nu are „text în jurul imaginii” pentru imaginile din rând; păstrăm partea (stânga/dreapta).
      const a = String(node.attrs?.align ?? 'center');
      const side = a === 'wrapLeft' ? 'left' : a === 'wrapRight' ? 'right' : a;
      const alignment = ALIGN[side] ? lib.AlignmentType[ALIGN[side]] : undefined;
      const caption = String(node.attrs?.caption ?? '').trim();
      const pic = new lib.Paragraph({
        children: [mathOrImage(node, lib)].filter(Boolean) as D.ParagraphChild[],
        alignment,
        // Legenda rămâne pe aceeași pagină cu imaginea.
        keepNext: caption ? true : undefined,
      });
      if (!caption) return [pic];
      return [pic, new lib.Paragraph({ alignment, children: [new lib.TextRun({ text: caption, italics: true, size: 20, color: '555555' })] })];
    }
    case 'pageBreak':
      return [new lib.Paragraph({ children: [new lib.PageBreak()] })];
    case 'columnBreak':
      return [new lib.Paragraph({ children: [new lib.ColumnBreak()] })];
    // Întreruperea de secțiune: un semn pe care exportul îl folosește ca să împartă documentul în secțiuni (w:sectPr).
    case 'sectionBreak':
      return [{ [SECT]: { kind: sectionKind(node.attrs?.kind), orient: sectionOrient(node.attrs?.orient), margin: sectionMargin(node.attrs?.margin), hdr: sectionHf(node.attrs?.hdr), ftr: sectionHf(node.attrs?.ftr) } } as unknown as D.Paragraph];
    case 'tableOfContents':
      return tocParagraphs(ctx, tocLevels(node.attrs?.levels));
    // Tabelul de figuri: titlul și legendele, ca și cuprinsul într-un câmp TOC.
    case 'tableOfFigures': {
      const label = String(node.attrs?.label ?? '');
      return [
        new lib.Paragraph({ children: [new lib.TextRun({ text: figuresTitle(label), bold: true, size: 28 })], spacing: { after: 120 } }),
        // Cu eticheta aleasă: câmpul TOC \c „Figura” (al legendelor numerotate cu SEQ Figura); „toate” rămâne text.
        ...(label ? tocField(ctx, `TOC \\h \\z \\c "${label}"`, figureEntriesJson(ctx.root, label).map((t) => ({ children: [new lib.TextRun(t)] })))
          : figureEntriesJson(ctx.root, label).map((t) => new lib.Paragraph({ children: [new lib.TextRun(t)], spacing: { after: 40 } }))),
        new lib.Paragraph(''),
      ];
    }
    // Indexul: text obișnuit (literele și intrările, fără pagini, care se știu doar la afișare).
    case 'docIndex':
      return [
        new lib.Paragraph({ children: [new lib.TextRun({ text: 'Index', bold: true, size: 28 })], spacing: { after: 120 } }),
        ...indexLinesJson(ctx.root).map((l) => new lib.Paragraph({ children: [new lib.TextRun({ text: l.text, bold: !!l.letter })], spacing: { after: 40, ...(l.letter ? { before: 120 } : {}) }, ...(l.sub ? { indent: { left: 360 } } : {}) })),
        new lib.Paragraph(''),
      ];
    // Tabelul de autorități: categoriile și citările ca text (paginile se știu doar la afișare).
    case 'docAuthorities':
      return [
        new lib.Paragraph({ children: [new lib.TextRun({ text: TOA_TITLE, bold: true, size: 28 })], spacing: { after: 120 } }),
        ...authLinesJson(ctx.root, Number(node.attrs?.cat) || 0).map((l) => new lib.Paragraph({ children: [new lib.TextRun({ text: l.text, bold: l.head })], spacing: { after: 40, ...(l.head ? { before: 160 } : {}) }, ...(l.head ? {} : { indent: { left: 360, hanging: 360 } }) })),
        new lib.Paragraph(''),
      ];
    // Bibliografia: sursele citate, în stilul ales (titlurile cursive), cu rândurile următoare retrase (ca la bibliografii).
    case 'bibliography':
      return [
        new lib.Paragraph({ children: [new lib.TextRun({ text: BIB_TITLE, bold: true, size: 28 })], spacing: { after: 120 } }),
        ...docSourcesJson(ctx.root).map((s) => new lib.Paragraph({
          children: refPieces(s, cleanStyle(node.attrs?.style)).map((p) => new lib.TextRun({ text: p.t, italics: !!p.i })),
          spacing: { after: 80 }, indent: { left: 720, hanging: 720 },
        })),
        new lib.Paragraph(''),
      ];
    default:
      return node.content ? blocks(node.content, ctx) : [];
  }
}

// Cuprinsul ajunge în Word ca text obișnuit (titlurile, cu retragere pe nivel), ca să se vadă în orice program.
// Rândurile cuprinsului / listei de figuri puse într-un câmp TOC (Word le reface cu numerele de pagină la actualizare);
// textul de acum rămâne ca rezultat al câmpului, deci se vede și fără actualizare.
function tocField(ctx: Ctx, instr: string, rows: { children: D.ParagraphChild[]; indent?: number }[]): D.Paragraph[] {
  const { lib } = ctx;
  const list = rows.length ? rows : [{ children: [] as D.ParagraphChild[] }];
  return list.map((r, i) => new lib.Paragraph({
    children: [
      ...(i === 0 ? [new lib.TextRun(TOC_OPEN + instr + TOC_OPEN)] : []),
      ...r.children,
      ...(i === list.length - 1 ? [new lib.TextRun(TOC_CLOSE)] : []),
    ],
    ...(r.indent ? { indent: { left: r.indent } } : {}),
    spacing: { after: 40 },
  }));
}

function tocParagraphs(ctx: Ctx, levels: number): D.Paragraph[] {
  const { lib } = ctx;
  const headings = ctx.headings.filter((h) => h.level <= levels);
  return [
    new lib.Paragraph({ children: [new lib.TextRun({ text: 'Cuprins', bold: true, size: 28 })], spacing: { after: 120 } }),
    ...tocField(ctx, `TOC \\o "1-${levels}" \\h \\z \\u`, headings.map((h) => ({ children: [new lib.TextRun({ text: h.text, bold: h.level === 1 })], indent: 360 * (h.level - 1) }))),
    new lib.Paragraph(''),
  ];
}

const ALIGN: Record<string, keyof typeof D.AlignmentType> = {
  left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED',
};
const HEADING = ['HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6'] as const;

function paragraph(node: JSONContent, ctx: Ctx): D.Paragraph {
  const { lib, list } = ctx;
  const align = node.attrs?.textAlign as string | undefined;
  const level = node.type === 'heading' ? Number(node.attrs?.level ?? 1) : 0;
  // Retragerea (1,25 cm = 709 twips pe treaptă) și spațierea rândurilor (240 = un rând).
  const left = (ctx.quote ? 567 : 0) + Math.round((Number(node.attrs?.indent) || 0) * 709);
  const right = Math.round((Number(node.attrs?.indentRight) || 0) * 567);
  const lh = parseFloat(String(node.attrs?.lineHeight ?? ''));
  // Spațiul înainte / după (puncte → douăzecimi de punct) și prima linie (cm → twips; negativ = agățată).
  const num = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const before = num(node.attrs?.spaceBefore), after = num(node.attrs?.spaceAfter), first = num(node.attrs?.firstLine) ?? 0;
  const hang = first < 0 ? Math.round(-first * 567) : 0;
  const spacing = {
    ...(lh > 0 ? { line: Math.round(lh * 240), lineRule: lib.LineRuleType.AUTO } : {}),
    ...(before !== null ? { before: Math.round(before * 20) } : {}),
    ...(after !== null ? { after: Math.round(after * 20) } : {}),
  };
  const indent = {
    ...(left + hang ? { left: left + hang } : {}),
    ...(right ? { right } : {}),
    ...(hang ? { hanging: hang } : first > 0 ? { firstLine: Math.round(first * 567) } : {}),
  };
  // Opririle de tabulator (cm → twips de la margine).
  const TAB_TYPE = { l: lib.TabStopType.LEFT, c: lib.TabStopType.CENTER, r: lib.TabStopType.RIGHT, d: lib.TabStopType.DECIMAL };
  const TAB_LEADER = { '': undefined, '.': lib.LeaderType.DOT, '-': lib.LeaderType.HYPHEN, '_': lib.LeaderType.UNDERSCORE };
  const tabs = parseStops(node.attrs?.tabStops as string | null).map((t) => ({ type: TAB_TYPE[t.align], position: Math.round(t.pos * 567), leader: TAB_LEADER[t.leader] }));
  const fr = ctx.frame;
  const side = fr ? (fr.align === 'wrapLeft' ? 'left' : fr.align === 'wrapRight' ? 'right' : fr.align) : '';
  const paraRev = paraRevision(node, ctx);
  const frameBorder = fr?.border ? Object.fromEntries(['top', 'bottom', 'left', 'right'].map((k) => [k, { style: lib.BorderStyle.SINGLE, size: 6, color: fr.border!, space: 4 }])) : undefined;
  return new lib.Paragraph({
    children: inline(node.content ?? [], ctx),
    // 1 pixel = 15 twips; textul documentului curge pe lângă casetă doar la „cu textul în jur”.
    ...(fr ? { frame: {
      type: 'alignment' as const, width: Math.round(fr.width * 15), alignment: { x: side as 'left' | 'center' | 'right', y: lib.VerticalPositionAlign.TOP },
      anchor: { horizontal: lib.FrameAnchorType.MARGIN, vertical: lib.FrameAnchorType.TEXT },
      wrap: fr.align.startsWith('wrap') ? lib.FrameWrap.AROUND : lib.FrameWrap.NOT_BESIDE, space: { horizontal: 240, vertical: 60 },
    } } : {}),
    heading: level ? lib.HeadingLevel[HEADING[Math.min(level, 6) - 1]] : node.attrs?.pstyle === 'title' ? lib.HeadingLevel.TITLE : undefined,
    style: node.attrs?.cstyle && !level ? 'Suite' + node.attrs.cstyle : !level && node.attrs?.pstyle === 'subtitle' ? 'Subtitle' : !level && node.attrs?.pstyle === 'caption' ? 'Caption' : undefined,
    alignment: align && ALIGN[align] ? lib.AlignmentType[ALIGN[align]] : undefined,
    bullet: list?.kind === 'bullet' ? { level: list.level } : undefined,
    numbering: list && list.kind !== 'bullet' ? { reference: list.ref, level: list.level } : undefined,
    indent: Object.keys(indent).length ? indent : undefined,
    ...(node.attrs?.keepNext ? { keepNext: true } : {}),
    ...(tabs.length ? { tabStops: tabs } : {}),
    ...(node.attrs?.keepLines ? { keepLines: true } : {}),
    ...(node.attrs?.noWidow ? { widowControl: false } : {}),
    spacing: Object.keys(spacing).length ? spacing : undefined,
    border: fr ? frameBorder : ctx.quote ? { left: { style: lib.BorderStyle.SINGLE, size: 18, color: 'BBBBBB', space: 8 } }
      : node.attrs?.box ? boxBorders(lib, node.attrs?.boxLook)
      : undefined,
    // Fundalul paragrafului (umbrire Word).
    shading: fr?.fill ? { type: lib.ShadingType.CLEAR, fill: fr.fill, color: 'auto' } : hex(node.attrs?.shade) ? { type: lib.ShadingType.CLEAR, fill: hex(node.attrs?.shade), color: 'auto' } : undefined,
    // Paragraful schimbat cu urmărirea pornită (stil / aliniere): cum era înainte merge în w:pPrChange.
    ...(paraRev ? { revision: paraRev } : {}),
  });
}

/** w:pPrChange pentru un paragraf cu schimbare urmărită (track.ts ParaChange): felul și alinierea de dinainte. */
function paraRevision(node: JSONContent, ctx: Ctx) {
  let p: { author?: string; date?: string; old?: { type?: string; level?: number; textAlign?: string } } | null = null;
  try { p = node.attrs?.pchange ? JSON.parse(String(node.attrs.pchange)) : null; } catch { /* fără schimbare */ }
  if (!p?.old) return undefined;
  const { lib } = ctx;
  const lvl = p.old.type === 'heading' ? Math.min(6, Math.max(1, Number(p.old.level) || 1)) : 0;
  const al = p.old.textAlign && p.old.textAlign !== 'left' ? ALIGN[p.old.textAlign] : undefined;
  const o = p.old as Record<string, unknown>;
  // Retragerea de dinainte, ca la paragraful obișnuit: trepte de 709 twips + partea agățată, dreapta și prima linie în cm.
  const first = Number(o.firstLine) || 0, hang = first < 0 ? Math.round(-first * 567) : 0;
  const left = Math.round((Number(o.indent) || 0) * 709) + hang;
  const oldInd = {
    ...(left ? { left } : {}),
    ...(Number(o.indentRight) > 0 ? { right: Math.round(Number(o.indentRight) * 567) } : {}),
    ...(hang ? { hanging: hang } : first > 0 ? { firstLine: Math.round(first * 567) } : {}),
  };
  const spacing: [string, unknown][] = [
    ...(Number(o.spaceBefore) >= 0 && o.spaceBefore !== null && o.spaceBefore !== undefined ? [['before', Math.round(Number(o.spaceBefore) * 20)] as [string, unknown]] : []),
    ...(Number(o.spaceAfter) >= 0 && o.spaceAfter !== null && o.spaceAfter !== undefined ? [['after', Math.round(Number(o.spaceAfter) * 20)] as [string, unknown]] : []),
    ...(Number(o.lineHeight) > 0 ? [['line', Math.round(Number(o.lineHeight) * 240)] as [string, unknown], ['lineRule', lib.LineRuleType.AUTO] as [string, unknown]] : []),
  ];
  return {
    id: ctx.revId++, author: p.author || 'Autor', date: p.date || new Date().toISOString(),
    ...(lvl ? { heading: lib.HeadingLevel[HEADING[lvl - 1]] } : {}),
    ...(al ? { alignment: lib.AlignmentType[al] } : {}),
    // Retragerea (trepte de 1,25 cm) și spațierea de dinainte, doar cele schimbate.
    ...(Object.keys(oldInd).length ? { indent: oldInd } : {}),
    ...(spacing.length ? { spacing: Object.fromEntries(spacing) } : {}),
  };
}

/**
 * Letrina, cum o scrie Word: prima literă stă într-un paragraf separat, într-un cadru „drop” pe 3 rânduri,
 * iar textul paragrafului curge pe lângă ea.
 */
function dropCap(node: JSONContent, ctx: Ctx): D.Paragraph[] {
  const first = node.content?.[0];
  const chars = first?.type === 'text' ? [...(first.text ?? '')] : [];
  if (!chars.length) return [paragraph(node, ctx)];
  const { lib } = ctx;
  const letter = new lib.Paragraph({
    frame: {
      type: 'absolute', position: { x: 0, y: 0 }, dropCap: lib.DropCapType.DROP, lines: 3, wrap: lib.FrameWrap.AROUND,
      anchor: { horizontal: lib.FrameAnchorType.TEXT, vertical: lib.FrameAnchorType.TEXT },
    },
    spacing: { line: 1000, lineRule: lib.LineRuleType.EXACT, before: 0, after: 0 },
    children: [textRun({ ...first!, text: chars[0] }, ctx, 84)],
  });
  const rest = chars.slice(1).join('');
  const content = [...(rest ? [{ ...first!, text: rest }] : []), ...(node.content ?? []).slice(1)];
  return [letter, paragraph({ ...node, content }, ctx)];
}

function inline(nodes: JSONContent[], ctx: Ctx): D.ParagraphChild[] {
  const { lib, notes } = ctx;
  const out: D.ParagraphChild[] = [];
  for (const n of nodes) {
    if (n.type === 'text') {
      // Comentariile: început înaintea primei bucăți de text comentat, sfârșit și trimitere după ultima.
      const ids = (n.marks ?? []).filter((m) => m.type === 'comment').map((m) => String(m.attrs?.id));
      for (const id of ids) {
        const c = notes.get(id);
        if (c && !c.started) { c.started = true; out.push(new lib.CommentRangeStart(c.num), ...c.replies.map((r) => new lib.CommentRangeStart(r.num))); }
      }
      const link = (n.marks ?? []).find((m) => m.type === 'link');
      const href = String(link?.attrs?.href ?? '');
      // Legăturile devin legături Word (albastre, subliniate), doar spre adrese web și e-mail.
      if (/^(https?:|mailto:)/i.test(href)) out.push(new lib.ExternalHyperlink({ link: href, children: [textRun(n, ctx)] }));
      // Trimiterea spre un semn de carte din document.
      else if (href.startsWith('#') && href.length > 1) out.push(new lib.InternalHyperlink({ anchor: href.slice(1), children: [textRun(n, ctx)] }));
      else {
        const fld = (n.marks ?? []).find((m) => m.type === 'docField');
        const kind = fld ? fieldKindOf(String(fld.attrs?.kind ?? '')) : null;
        // Butonul cu macrocomandă: câmpul MACROBUTTON, cu textul afișat în instrucțiune și ca rezultat.
        const mb = (n.marks ?? []).find((m) => m.type === 'macroBtn');
        const mbName = mb ? String(mb.attrs?.macro ?? '').trim() : '';
        out.push(textRun(kind ? { ...n, text: FLD_OPEN + FIELD_INSTR[kind] + FLD_SEP + (n.text ?? '') + FLD_CLOSE }
          : mbName ? { ...n, text: FLD_OPEN + macroBtnInstr(mbName, n.text ?? '') + FLD_SEP + (n.text ?? '') + FLD_CLOSE } : n, ctx));
      }
      for (const id of ids) {
        const c = notes.get(id);
        if (c && --c.left === 0) {
          // Răspunsurile acoperă același text, ca în fișierele scrise de Word.
          for (const num of [c.num, ...c.replies.map((r) => r.num)]) out.push(new lib.CommentRangeEnd(num), new lib.TextRun({ children: [new lib.CommentReference(num)] }));
        }
      }
    }
    else if (n.type === 'hardBreak') out.push(new lib.TextRun({ text: '', break: 1 }));
    else if (n.type === 'tabChar') out.push(new lib.TextRun({ children: [new lib.Tab()] }));
    else if (n.type === 'bookmark' && n.attrs?.name) out.push(new lib.Bookmark({ id: String(n.attrs.name), children: [] }));
    // Numărul legendei: un semn de înlocuit mai jos (seqFields) cu un câmp SEQ.
    else if (n.type === 'captionNum') out.push(textRun({ ...n, type: 'text', text: SEQ_OPEN + String(n.attrs?.label ?? 'Figura') + ' ' + String(n.attrs?.n ?? 1) + SEQ_CLOSE }, ctx));
    else if (n.type === 'image') { const r = mathOrImage(n, lib); if (r) out.push(r); }
    else if (n.type === 'citation') out.push(textRun({ ...n, type: 'text', text: citeTextJson(n) }, ctx));
    // Caseta de selectare: controlul de conținut cu w14:checkbox (☒ / ☐ în fontul MS Gothic, ca în Word).
    else if (n.type === 'formCheck') out.push(new lib.CheckBox({ checked: !!n.attrs?.checked }));
    // Lista verticală: un semn cu variantele, înlocuit în seqFields cu controlul de conținut w:dropDownList.
    // Selectorul de dată: un semn cu data, înlocuit în seqFields cu controlul de conținut w:date.
    else if (n.type === 'formDate') out.push(textRun({ ...n, type: 'text', text: DATE_OPEN + cleanDate(String(n.attrs?.value ?? '')) + DATE_CLOSE }, ctx));
    else if (n.type === 'formDrop') out.push(textRun({ ...n, type: 'text', text: DROP_OPEN + encodeDrop(String(n.attrs?.items ?? '').split(String.fromCharCode(10)).filter(Boolean), String(n.attrs?.value ?? '')) + DROP_CLOSE }, ctx));
    // Notele de subsol devin note Word adevărate (numerotate de Word, jos pe pagină).
    else if (n.type === 'footnote') {
      const lines = String(n.attrs?.text ?? '').split(String.fromCharCode(10));
      const content = { children: lines.map((t) => new lib.Paragraph({ children: [new lib.TextRun(t)] })) };
      // Nota de final: la sfârșitul documentului, numerotată de Word i, ii, iii.
      out.push(n.attrs?.end ? new lib.EndnoteReferenceRun(content) : new lib.FootnoteReferenceRun(content));
    }
  }
  return out;
}

type RunOpts = { -readonly [K in keyof D.IRunOptions]: D.IRunOptions[K] };

/**
 * Semnele de format de dinainte de o schimbare urmărită (formatChange): schimbările (ce s-a pus / scos) se desfac
 * de la ultima la prima, pe lista de semne de acum.
 */
function marksBefore(marks: NonNullable<JSONContent['marks']>, opsJson: unknown): NonNullable<JSONContent['marks']> {
  let ops: { op: string; type: string; attrs?: Record<string, unknown> }[] = [];
  try { const v = JSON.parse(String(opsJson || '[]')); if (Array.isArray(v)) ops = v; } catch { /* fără schimbări */ }
  const same = (a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
  let out = marks.filter((m) => m.type !== 'formatChange' && m.type !== 'insertion' && m.type !== 'deletion');
  for (const o of [...ops].reverse()) {
    if (o.op === 'add') {
      const i = out.findIndex((m) => m.type === o.type && same(m.attrs, o.attrs));
      out = i >= 0 ? out.filter((_, k) => k !== i) : out.filter((m) => m.type !== o.type);
    } else out = [...out.filter((m) => m.type !== o.type), { type: o.type, ...(o.attrs ? { attrs: o.attrs } : {}) }];
  }
  return out;
}

function textRun(n: JSONContent, ctx: Ctx, size?: number): D.ParagraphChild {
  const opts = runOpts(n.marks ?? [], ctx, n.text ?? '');
  // Formatul schimbat cu urmărirea pornită: formatul de dinainte merge în w:rPrChange, ca Word să-l poată respinge.
  const fc = (n.marks ?? []).find((m) => m.type === 'formatChange');
  if (fc) {
    const { text: _t, ...old } = runOpts(marksBefore(n.marks ?? [], fc.attrs?.ops), ctx, '');
    opts.revision = { ...old, id: ctx.revId++, author: String(fc.attrs?.author || 'Autor'), date: String(fc.attrs?.date || new Date().toISOString()) };
  }
  return finishRun(opts, n, ctx, size);
}

function runOpts(marks: NonNullable<JSONContent['marks']>, ctx: Ctx, text: string): RunOpts {
  const { lib } = ctx;
  const opts: RunOpts = { text };
  for (const m of marks) {
    const a = m.attrs ?? {};
    if (m.type === 'bold') opts.bold = true;
    else if (m.type === 'italic') opts.italics = true;
    else if (m.type === 'underline') opts.underline = { type: WORD_UNDERLINE[a.style as UnderlineStyle] as (typeof D.UnderlineType)[keyof typeof D.UnderlineType] ?? 'single', ...(hex(a.color) ? { color: hex(a.color) } : {}) };
    else if (m.type === 'strike') opts.strike = true;
    else if (m.type === 'code') opts.font = 'Courier New';
    else if (m.type === 'superscript') opts.superScript = true;
    else if (m.type === 'subscript') opts.subScript = true;
    // Trimiterile spre semnele ascunse (cuprinsurile Word) rămân ca textul din jur.
    else if (m.type === 'link' && !String(a.href ?? '').startsWith('#_')) { opts.color ??= '0563C1'; opts.underline = {}; }
    else if (m.type === 'highlight') opts.shading = { type: lib.ShadingType.CLEAR, fill: hex(a.color) ?? 'FFF176', color: 'auto' };
    else if (m.type === 'textStyle') {
      if (a.color && hex(a.color)) opts.color = hex(a.color);
      if (a.fontFamily) opts.font = String(a.fontFamily).split(',')[0].replace(/["']/g, '').trim();
      const pt = parseFloat(String(a.fontSize ?? ''));
      if (pt) opts.size = Math.round(pt * 2); // docx măsoară în jumătăți de punct
      if (a.fontVariant === 'small-caps') opts.smallCaps = true;
      if (a.textTransform === 'uppercase') opts.allCaps = true;
      const ls = spacingPt(a.letterSpacing);
      if (ls) opts.characterSpacing = Math.round(ls * 20); // în douăzecimi de punct
      // Limba de verificare (w:lang) sau „nu verifica” (w:noProof).
      const pl = proofLangOf(a.proofLang);
      if (pl === 'none') opts.noProof = true;
      else if (pl) opts.language = { value: pl };
      if (isLigatures(a.ligatures)) opts.scale = LIG_CODES.indexOf(a.ligatures) + 1;
      if (a.textEffect === 'emboss') opts.emboss = true;
      else if (a.textEffect === 'imprint') opts.imprint = true;
      else if (a.textEffect === 'glow') (opts as { effect?: string }).effect = FX_GLOW;
    else if (a.textEffect === 'outline' || a.textEffect === 'shadow' || a.textEffect === 'outline-shadow') {
        (opts as { effect?: string }).effect = a.textEffect === 'outline' ? FX_OUTLINE : a.textEffect === 'shadow' ? FX_SHADOW : FX_BOTH;
      }
    }
  }
  return opts;
}

function finishRun(opts: RunOpts, n: JSONContent, ctx: Ctx, size?: number): D.ParagraphChild {
  const { lib } = ctx;
  // Modificările urmărite devin modificări Word (cu autor și dată), pe care Word le poate accepta sau respinge.
  const change = (n.marks ?? []).find((m) => m.type === 'deletion') ?? (n.marks ?? []).find((m) => m.type === 'insertion');
  if (change) {
    const rev = { id: ctx.revId++, author: String(change.attrs?.author || 'Autor'), date: String(change.attrs?.date || new Date().toISOString()) };
    return change.type === 'deletion' ? new lib.DeletedTextRun({ ...opts, ...rev }) : new lib.InsertedTextRun({ ...opts, ...rev });
  }
  if (size) opts.size = size; // letrina: mărimea în jumătăți de punct
  // Tab-urile din text (de exemplu după Tabel → text) devin w:tab, nu un caracter în w:t.
  if (opts.text?.includes('\t')) {
    const { text, ...rest } = opts;
    return new lib.TextRun({ ...rest, children: text.split('\t').flatMap((p, i) => [...(i ? [new lib.Tab()] : []), ...(p ? [p] : [])]) });
  }
  return new lib.TextRun(opts);
}

// Culoare CSS (#rgb, #rrggbb, rgb(...)) → „RRGGBB”.
export function hex(c: unknown): string | undefined {
  if (typeof c !== 'string') return undefined;
  const s = c.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return m[1].split('').map((x) => x + x).join('').toUpperCase();
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return m[1].toUpperCase();
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(s);
  if (m) return [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
}

/** O ecuație Suite (attrs.equation) se scrie ca ecuație adevărată (OMML), care se poate schimba; restul, ca imagine. */
function mathOrImage(n: JSONContent, lib: Lib): D.ParagraphChild | null {
  const eq = n.attrs?.equation ? parseEquation(n.attrs.equation) : null;
  return (eq && equationMath(eq.src, lib)) || imageRun(n, lib);
}

function imageRun(n: JSONContent, lib: Lib): D.ImageRun | null {
  const src = String(n.attrs?.src ?? '');
  const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(src);
  if (!m) return null; // webp și imaginile externe nu sunt acceptate de Word
  const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
  const size = imageSize(bytes) ?? { w: 400, h: 300 };
  // Lățimea aleasă în editor (dacă există), limitată la lățimea paginii A4 cu margini de 2 cm (aprox. 640 px).
  const wanted = Number(n.attrs?.width) > 0 ? Number(n.attrs?.width) : size.w;
  const scale = Math.min(wanted, 640) / size.w;
  const type = m[1].toLowerCase().startsWith('jp') ? 'jpg' : (m[1].toLowerCase() as 'png' | 'gif');
  return new lib.ImageRun({
    type,
    data: bytes,
    transformation: { width: Math.round(size.w * scale), height: Math.round(size.h * scale) },
    // Textul alternativ (Word: Format imagine → Text alternativ), citit de cititoarele de ecran.
    // În fața / în spatele textului: imagine ancorată, fără text în jur, la deplasarea din editor (px → EMU) și cu ordinea ei.
    ...(isFloating(n.attrs?.align) ? { floating: {
      horizontalPosition: { relative: lib.HorizontalPositionRelativeFrom.COLUMN, offset: Math.round(clampOffset(n.attrs?.dx) * 9525) },
      verticalPosition: { relative: lib.VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round(clampOffset(n.attrs?.dy) * 9525) },
      behindDocument: n.attrs?.align === 'behind', allowOverlap: true, wrap: { type: lib.TextWrappingType.NONE },
      zIndex: Math.max(0, Number(n.attrs?.z) || 0) + (n.attrs?.align === 'behind' ? 0 : 1000),
    } } : {}),
    ...(String(n.attrs?.alt ?? '').trim() ? { altText: { name: 'Imagine', description: String(n.attrs?.alt).trim().slice(0, 1000), title: '' } } : {}),
  });
}

// Dimensiunile imaginii, citite direct din antetul fișierului.
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: v.getUint32(16), h: v.getUint32(20) };
  if (b[0] === 0x47 && b[1] === 0x49) return { w: v.getUint16(6, true), h: v.getUint16(8, true) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = v.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: v.getUint16(i + 5), w: v.getUint16(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

function table(node: JSONContent, ctx: Ctx): D.Table {
  const { lib } = ctx;
  const saved = { list: ctx.list, quote: ctx.quote };
  ctx.list = null;
  ctx.quote = false;
  const rows = (node.content ?? []).map((row) => new lib.TableRow({
    // Rândurile de antet repetate pe fiecare pagină (w:tblHeader).
    tableHeader: row.attrs?.repeatHeader ? true : undefined,
    // Înălțimea rândului: cel puțin atât (cm → twips).
    // Rândul nu se rupe între pagini (w:cantSplit).
    cantSplit: row.attrs?.noSplit ? true : undefined,
    height: Number(row.attrs?.rowHeight) > 0 ? { value: Math.round(Number(row.attrs?.rowHeight) * 567), rule: lib.HeightRule.ATLEAST } : undefined,
    children: (row.content ?? []).map((cell) => {
      const width = (cell.attrs?.colwidth as number[] | null)?.reduce((a, b) => a + b, 0);
      const content = blocks(cell.content ?? [], ctx);
      return new lib.TableCell({
        children: content.length ? content : [new lib.Paragraph('')],
        columnSpan: cell.attrs?.colspan > 1 ? cell.attrs?.colspan : undefined,
        rowSpan: cell.attrs?.rowspan > 1 ? cell.attrs?.rowspan : undefined,
        // Alinierea verticală (w:vAlign); „sus” e implicită și nu se scrie.
        verticalAlign: cell.attrs?.verticalAlign === 'middle' ? lib.VerticalAlignTable.CENTER : cell.attrs?.verticalAlign === 'bottom' ? lib.VerticalAlignTable.BOTTOM : undefined,
        width: width ? { size: width * 15, type: lib.WidthType.DXA } : undefined,
        // Bordurile puse pe celulă (w:tcBorders), peste liniile tabelului.
        borders: docxCellBorders(lib, cell.attrs?.cellLines) as never,
        // Fundalul ales în editor; capul de tabel are gri deschis dacă nu are altă culoare.
        shading: hex(cell.attrs?.backgroundColor) || cell.type === 'tableHeader'
          ? { type: lib.ShadingType.CLEAR, fill: hex(cell.attrs?.backgroundColor) ?? 'F0F0F0', color: 'auto' }
          : undefined,
      });
    }),
  }));
  ctx.list = saved.list;
  ctx.quote = saved.quote;
  return new lib.Table({
    rows,
    // Așezarea tabelului pe pagină (w:jc).
    ...(node.attrs?.align === 'center' ? { alignment: lib.AlignmentType.CENTER } : node.attrs?.align === 'right' ? { alignment: lib.AlignmentType.RIGHT } : {}),
    // Potrivit conținutului: lățime automată, coloanele după text; altfel pe toată lățimea paginii.
    ...(node.attrs?.fit === 'content'
      ? { width: { size: 0, type: lib.WidthType.AUTO }, layout: lib.TableLayoutType.AUTOFIT }
      : { width: { size: 100, type: lib.WidthType.PERCENTAGE } }),
    // Încadrarea textului în jurul tabelului (w:tblpPr): tabel plutitor față de margine, la stânga / centru / dreapta, la 0,4 cm de text.
    ...(node.attrs?.wrap === 'around' ? { float: {
      horizontalAnchor: lib.TableAnchorType.MARGIN, verticalAnchor: lib.TableAnchorType.TEXT,
      relativeHorizontalPosition: node.attrs?.align === 'center' ? lib.RelativeHorizontalPosition.CENTER : node.attrs?.align === 'right' ? lib.RelativeHorizontalPosition.RIGHT : lib.RelativeHorizontalPosition.LEFT,
      leftFromText: 227, rightFromText: 227, bottomFromText: 113,
    } } : {}),
    // Indentarea de la stânga (w:tblInd) și marginile celulelor (w:tblCellMar), cm → twips.
    ...(Number(node.attrs?.indent) > 0 && !node.attrs?.align ? { indent: { size: Math.round(Number(node.attrs?.indent) * 567), type: lib.WidthType.DXA } } : {}),
    ...(node.attrs?.pad !== null && node.attrs?.pad !== undefined && Number(node.attrs?.pad) >= 0 ? (() => { const tw = Math.round(Number(node.attrs!.pad) * 567); return { margins: { top: tw, bottom: tw, left: tw, right: tw } }; })() : {}),
    ...(node.attrs?.borders === 'none' ? { borders: lib.TableBorders.NONE } : docxBorders(lib as never, node.attrs) ? { borders: docxBorders(lib as never, node.attrs) as never } : {}),
  });
}
